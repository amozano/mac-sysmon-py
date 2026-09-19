import asyncio
import json
import os
import unittest
from pathlib import Path

import aiohttp
from aiohttp import web

from mac_sysmon.collector import MetricsCollector
from mac_sysmon.native_collector import NativeMacCollector
from mac_sysmon.process_ops import kill_process, get_process_detail
from mac_sysmon.server import SysmonServer


class TestMacSysmonIntegration(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.collector = MetricsCollector()
        self.native_collector = NativeMacCollector()
        self.dist_dir = Path(__file__).parent.parent / "dist"

    def test_native_collector_telemetry(self):
        """Test the pure-Python zero-dependency native collector."""
        snapshot = self.native_collector.collect()
        self.assertIn("timestamp", snapshot)
        self.assertIn("system_info", snapshot)
        self.assertIn("cpu", snapshot)
        self.assertIn("memory", snapshot)
        self.assertIn("disks", snapshot)
        self.assertIn("network", snapshot)
        self.assertIn("processes", snapshot)

        self.assertGreater(snapshot["memory"]["total_bytes"], 0)
        self.assertGreater(len(snapshot["disks"]), 0)
        self.assertGreater(len(snapshot["cpu"]["cores"]), 0)
        self.assertGreater(len(snapshot["processes"]), 0)

    def test_metrics_collector_schema(self):
        """Test the primary metrics collector schema and fields."""
        snapshot = self.collector.collect()

        # Check system_info
        sys_info = snapshot["system_info"]
        self.assertTrue(sys_info["hostname"])
        self.assertEqual(sys_info["os_name"], "macOS")
        self.assertGreater(sys_info["total_core_count"], 0)

        # Check CPU
        cpu = snapshot["cpu"]
        self.assertIsInstance(cpu["global_usage"], (int, float))
        self.assertEqual(len(cpu["load_average"]), 3)
        self.assertGreater(len(cpu["cores"]), 0)

        # Check Memory
        mem = snapshot["memory"]
        self.assertGreater(mem["total_bytes"], 0)
        self.assertGreater(mem["used_bytes"], 0)
        self.assertIsInstance(mem["usage_percent"], (int, float))

        # Check Disks
        self.assertGreater(len(snapshot["disks"]), 0)
        first_disk = snapshot["disks"][0]
        self.assertIn("name", first_disk)
        self.assertIn("mount_point", first_disk)
        self.assertIn("total_bytes", first_disk)
        self.assertIn("used_bytes", first_disk)

        # Check Network
        net = snapshot["network"]
        self.assertIn("received_bytes_per_sec", net)
        self.assertIn("transmitted_bytes_per_sec", net)

        # Check Processes
        procs = snapshot["processes"]
        self.assertGreater(len(procs), 0)
        first_proc = procs[0]
        self.assertIn("pid", first_proc)
        self.assertIn("name", first_proc)
        self.assertIn("cpu_usage", first_proc)
        self.assertIn("memory_bytes", first_proc)

    def test_process_ops_safety(self):
        """Test that safety guards prevent killing protected PIDs."""
        # PID 0
        ok, msg = kill_process(0, "SIGTERM")
        self.assertFalse(ok)
        self.assertIn("Cannot terminate protected system PID 0", msg)

        # PID 1
        ok, msg = kill_process(1, "SIGKILL")
        self.assertFalse(ok)
        self.assertIn("Cannot terminate protected system PID 1", msg)

        # Self PID
        ok, msg = kill_process(os.getpid(), "SIGTERM")
        self.assertFalse(ok)
        self.assertIn("Cannot terminate self", msg)

        # Invalid Signal
        ok, msg = kill_process(999999, "INVALID_SIG")
        self.assertFalse(ok)
        self.assertIn("Unsupported signal", msg)

    async def test_server_rest_and_websocket_endpoints(self):
        """Test live HTTP REST endpoints, static file serving, and WebSocket streaming."""
        server = SysmonServer(self.collector, str(self.dist_dir))
        runner = web.AppRunner(server.app)
        await runner.setup()

        # Ephemeral port
        site = web.TCPSite(runner, host="127.0.0.1", port=39123)
        await site.start()

        base_url = "http://127.0.0.1:39123"

        async with aiohttp.ClientSession() as session:
            # 1. Test Static Index
            async with session.get(f"{base_url}/") as resp:
                self.assertEqual(resp.status, 200)
                html = await resp.text()
                self.assertIn("mac-sysmon", html)

            # 2. Test Static Bundle
            async with session.get(f"{base_url}/bundle.js") as resp:
                self.assertEqual(resp.status, 200)
                self.assertIn("javascript", resp.headers.get("Content-Type", ""))

            # 3. Test GET /api/system
            async with session.get(f"{base_url}/api/system") as resp:
                self.assertEqual(resp.status, 200)
                data = await resp.json()
                self.assertTrue(data["success"])
                self.assertIn("system_info", data["data"])

            # 4. Test GET /api/processes
            async with session.get(f"{base_url}/api/processes") as resp:
                self.assertEqual(resp.status, 200)
                data = await resp.json()
                self.assertTrue(data["success"])
                self.assertIsInstance(data["data"], list)
                self.assertGreater(len(data["data"]), 0)

            # 5. Test GET /api/processes/<pid>
            my_pid = os.getpid()
            async with session.get(f"{base_url}/api/processes/{my_pid}") as resp:
                self.assertEqual(resp.status, 200)
                data = await resp.json()
                self.assertTrue(data["success"])
                self.assertEqual(data["data"]["process"]["pid"], my_pid)

            # 6. Test POST /api/processes/0/kill (Safety rejection)
            async with session.post(f"{base_url}/api/processes/0/kill", json={"signal": "SIGTERM"}) as resp:
                self.assertEqual(resp.status, 400)
                data = await resp.json()
                self.assertFalse(data["success"])

            # 7. Test WebSocket /ws
            async with session.ws_connect(f"ws://127.0.0.1:39123/ws") as ws:
                msg = await asyncio.wait_for(ws.receive_str(), timeout=5.0)
                payload = json.loads(msg)
                self.assertIn("timestamp", payload)
                self.assertIn("cpu", payload)
                self.assertIn("memory", payload)
                await ws.close()

            # 8. Test concurrent WebSocket broadcast without Set changed size during iteration
            async with session.ws_connect(f"ws://127.0.0.1:39123/ws") as ws1, \
                       session.ws_connect(f"ws://127.0.0.1:39123/ws") as ws2:
                snapshot = self.collector.collect()

                async def _connect_transient():
                    async with session.ws_connect(f"ws://127.0.0.1:39123/ws") as ws3:
                        await ws3.receive_str()

                await asyncio.gather(
                    server._broadcast_metrics(snapshot),
                    server._broadcast_metrics(snapshot),
                    _connect_transient(),
                )

        await runner.cleanup()


if __name__ == "__main__":
    unittest.main()
