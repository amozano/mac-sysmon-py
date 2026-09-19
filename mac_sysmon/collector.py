import asyncio
import os
import platform
import re
import subprocess
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

from .native_collector import NativeMacCollector


class MetricsCollector:
    """
    High-performance system telemetry collector with differential rate calculations.
    Seamlessly uses psutil if installed, or falls back to NativeMacCollector.
    """

    def __init__(self):
        self.use_psutil = HAS_PSUTIL
        self.native = NativeMacCollector()

        self.last_tick = time.monotonic()
        self.last_net_totals: Dict[str, Tuple[int, int]] = {}
        self.last_disk_totals: Tuple[int, int] = (0, 0)
        self.last_proc_io: Dict[int, Tuple[int, int]] = {}

        self.sys_info = self._init_sys_info()
        self.latest_metrics: dict = {}
        self.listeners: Set[Callable[[dict], Any]] = set()
        self._running = False

        # Baseline snapshot
        self.collect()

    def _init_sys_info(self) -> dict:
        hostname = platform.node()
        os_name = "macOS"
        os_ver = platform.mac_ver()[0] or "Unknown"
        kernel_ver = platform.release()
        cpu_arch = platform.machine()

        cpu_brand = "Apple Silicon"
        try:
            out = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip()
            if out:
                cpu_brand = out
        except Exception:
            pass

        if self.use_psutil:
            logical_cores = psutil.cpu_count(logical=True) or 8
            physical_cores = psutil.cpu_count(logical=False) or logical_cores
        else:
            logical_cores = os.cpu_count() or 8
            physical_cores = logical_cores

        return {
            "hostname": hostname,
            "os_name": os_name,
            "os_version": os_ver,
            "kernel_version": kernel_ver,
            "cpu_arch": cpu_arch,
            "cpu_brand": cpu_brand,
            "physical_core_count": physical_cores,
            "total_core_count": logical_cores,
        }

    def collect(self) -> dict:
        now = time.monotonic()
        elapsed = max(0.001, now - self.last_tick)
        self.last_tick = now

        if not self.use_psutil:
            snapshot = self.native.collect()
            self.latest_metrics = snapshot
            return snapshot

        # --- Psutil Metrics Collection ---
        # 1. System Info
        uptime_secs = int(time.time() - psutil.boot_time())
        sys_info = dict(self.sys_info)
        sys_info["uptime_secs"] = uptime_secs

        # 2. CPU Metrics (Overall + Per-Core)
        global_cpu = psutil.cpu_percent(interval=None)
        per_core = psutil.cpu_percent(interval=None, percpu=True)
        load1, load5, load15 = os.getloadavg()

        cores = []
        for idx, usage in enumerate(per_core):
            cores.append({
                "id": idx,
                "name": f"CPU {idx}",
                "usage": round(usage, 1),
                "frequency_mhz": 3200,
            })

        cpu_metrics = {
            "global_usage": round(global_cpu, 1),
            "load_average": [round(load1, 2), round(load5, 2), round(load15, 2)],
            "cores": cores,
        }

        # 3. Memory Metrics
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()

        memory_metrics = {
            "total_bytes": vm.total,
            "used_bytes": vm.used,
            "free_bytes": vm.free,
            "available_bytes": vm.available,
            "swap_total_bytes": swap.total,
            "swap_used_bytes": swap.used,
            "swap_free_bytes": swap.free,
            "usage_percent": round(vm.percent, 1),
        }

        # 4. Storage & Disks
        disks = []
        try:
            partitions = psutil.disk_partitions(all=False)
            seen_mounts = set()
            for part in partitions:
                if part.mountpoint in seen_mounts:
                    continue
                seen_mounts.add(part.mountpoint)

                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    # Exclude small system volumes (<500MB)
                    if usage.total < 500 * 1024 * 1024:
                        continue

                    name = os.path.basename(part.mountpoint) or "Macintosh HD"
                    if part.mountpoint == "/":
                        name = "Macintosh HD"

                    is_removable = "/Volumes/" in part.mountpoint and part.mountpoint != "/Volumes/Macintosh HD"

                    disks.append({
                        "name": name,
                        "mount_point": part.mountpoint,
                        "total_bytes": usage.total,
                        "available_bytes": usage.free,
                        "used_bytes": usage.used,
                        "usage_percent": round(usage.percent, 1),
                        "file_system": part.fstype or "apfs",
                        "is_removable": is_removable,
                        "kind": "SSD",
                    })
                except (PermissionError, OSError):
                    continue
        except Exception:
            disks = self.native.get_disk_metrics()

        # 5. Disk I/O Throughput
        try:
            disk_counters = psutil.disk_io_counters()
            tot_read = disk_counters.read_bytes if disk_counters else 0
            tot_write = disk_counters.write_bytes if disk_counters else 0
            prev_read, prev_write = self.last_disk_totals

            read_rate = int(max(0, tot_read - prev_read) / elapsed) if prev_read > 0 else 0
            write_rate = int(max(0, tot_write - prev_write) / elapsed) if prev_write > 0 else 0
            self.last_disk_totals = (tot_read, tot_write)
        except Exception:
            read_rate = 0
            write_rate = 0
            tot_read = 0
            tot_write = 0

        disk_io = {
            "read_bytes_per_sec": read_rate,
            "written_bytes_per_sec": write_rate,
            "total_read_bytes": tot_read,
            "total_written_bytes": tot_write,
        }

        # 6. Network Throughput
        net_counters = psutil.net_io_counters(pernic=True)
        interfaces = []
        tot_rx_rate = 0
        tot_tx_rate = 0
        tot_rx = 0
        tot_tx = 0

        for name, net in net_counters.items():
            tot_rx += net.bytes_recv
            tot_tx += net.bytes_sent

            prev_rx, prev_tx = self.last_net_totals.get(name, (net.bytes_recv, net.bytes_sent))
            rx_rate = int(max(0, net.bytes_recv - prev_rx) / elapsed)
            tx_rate = int(max(0, net.bytes_sent - prev_tx) / elapsed)

            tot_rx_rate += rx_rate
            tot_tx_rate += tx_rate
            self.last_net_totals[name] = (net.bytes_recv, net.bytes_sent)

            interfaces.append({
                "name": name,
                "received_bytes_per_sec": rx_rate,
                "transmitted_bytes_per_sec": tx_rate,
                "total_received_bytes": net.bytes_recv,
                "total_transmitted_bytes": net.bytes_sent,
            })

        network_metrics = {
            "received_bytes_per_sec": tot_rx_rate,
            "transmitted_bytes_per_sec": tot_tx_rate,
            "total_received_bytes": tot_rx,
            "total_transmitted_bytes": tot_tx,
            "interfaces": interfaces,
        }

        # 7. Processes
        processes = []
        for p in psutil.process_iter([
            "pid", "name", "cmdline", "exe", "cpu_percent", "memory_info", "memory_percent", "status", "username"
        ]):
            try:
                p_info = p.info
                pid = p_info["pid"]
                name = p_info["name"] or f"pid-{pid}"
                exe = p_info["exe"] or ""
                cmd = p_info["cmdline"] or []
                cpu_pct = p_info["cpu_percent"] or 0.0
                mem_info = p_info["memory_info"]
                rss = mem_info.rss if mem_info else 0
                vms = mem_info.vms if mem_info else 0
                mem_pct = p_info["memory_percent"] or 0.0
                status_raw = p_info["status"] or "running"
                user = p_info["username"] or ""

                app_name, is_app = self._detect_macos_app(exe, name)

                # Process disk I/O rates
                p_read_rate = 0
                p_write_rate = 0
                try:
                    io = p.io_counters()
                    prev_r, prev_w = self.last_proc_io.get(pid, (io.read_bytes, io.write_bytes))
                    p_read_rate = int(max(0, io.read_bytes - prev_r) / elapsed)
                    p_write_rate = int(max(0, io.write_bytes - prev_w) / elapsed)
                    self.last_proc_io[pid] = (io.read_bytes, io.write_bytes)
                except Exception:
                    pass

                processes.append({
                    "pid": pid,
                    "name": name,
                    "app_name": app_name,
                    "exe_path": exe,
                    "cmd": cmd,
                    "cpu_usage": round(cpu_pct, 1),
                    "memory_bytes": rss,
                    "memory_percent": round(mem_pct, 1),
                    "virtual_memory_bytes": vms,
                    "disk_read_bytes_per_sec": p_read_rate,
                    "disk_written_bytes_per_sec": p_write_rate,
                    "total_read_bytes": 0,
                    "total_written_bytes": 0,
                    "status": self._format_status(status_raw),
                    "user_id": None,
                    "user_name": user,
                    "start_time": 0,
                    "run_time": 0,
                    "is_app": is_app,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Prune dead PIDs from last_proc_io cache to prevent memory leak
        active_pids = {p["pid"] for p in processes}
        self.last_proc_io = {pid: v for pid, v in self.last_proc_io.items() if pid in active_pids}

        snapshot = {
            "timestamp": int(time.time() * 1000),
            "system_info": sys_info,
            "cpu": cpu_metrics,
            "memory": memory_metrics,
            "disks": disks,
            "disk_io": disk_io,
            "network": network_metrics,
            "processes": processes,
        }

        self.latest_metrics = snapshot
        return snapshot

    def _detect_macos_app(self, exe_path: str, name: str) -> Tuple[Optional[str], bool]:
        if exe_path:
            m = re.search(r"/([^/]+)\.app(?:/|$)", exe_path)
            if m:
                return m.group(1), True

            if exe_path.startswith("/Applications/") or exe_path.startswith("/System/Applications/"):
                clean = os.path.basename(exe_path).removesuffix(".app")
                return clean, True

        if name.endswith(" Helper") or name.endswith(" Service"):
            return None, False

        return None, False

    def _format_status(self, status: str) -> str:
        s = status.lower()
        if "running" in s:
            return "Run"
        elif "sleeping" in s or "idle" in s:
            return "Sleep"
        elif "stopped" in s:
            return "Stop"
        elif "zombie" in s:
            return "Zombie"
        return "Run"

    async def run_loop(self, interval_ms: int = 1000):
        self._running = True
        sec = interval_ms / 1000.0
        while self._running:
            start = time.monotonic()
            try:
                snapshot = self.collect()
                for listener in list(self.listeners):
                    try:
                        res = listener(snapshot)
                        if asyncio.iscoroutine(res):
                            task = asyncio.create_task(res)
                            task.add_done_callback(lambda t: None if t.cancelled() else t.exception())
                    except Exception as e:
                        pass
            except Exception as e:
                pass

            dur = time.monotonic() - start
            wait_time = max(0.1, sec - dur)
            await asyncio.sleep(wait_time)

    def stop(self):
        self._running = False
