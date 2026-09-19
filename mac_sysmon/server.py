import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Set

from aiohttp import web, WSMsgType

from .collector import MetricsCollector
from .process_ops import kill_process, get_process_detail

logger = logging.getLogger("mac_sysmon")


class SysmonServer:
    def __init__(self, collector: MetricsCollector, static_dir: str):
        self.collector = collector
        self.static_dir = Path(static_dir).resolve()
        self.app = web.Application()
        self.ws_clients: Set[web.WebSocketResponse] = set()

        self._setup_routes()
        self.collector.listeners.add(self._broadcast_metrics)

    def _setup_routes(self):
        self.app.router.add_get("/api/system", self.handle_api_system)
        self.app.router.add_get("/api/processes", self.handle_api_processes)
        self.app.router.add_get("/api/processes/{pid}", self.handle_api_process_detail)
        self.app.router.add_post("/api/processes/{pid}/kill", self.handle_api_process_kill)
        self.app.router.add_get("/ws", self.handle_ws)

        # Static assets
        self.app.router.add_get("/", self.handle_index)
        self.app.router.add_get("/bundle.js", self.handle_bundle_js)
        self.app.router.add_get("/bundle.js.map", self.handle_bundle_map)
        self.app.router.add_get("/styles.css", self.handle_styles_css)
        self.app.router.add_get("/favicon.svg", self.handle_favicon)
        self.app.router.add_static("/static", path=self.static_dir, show_index=False)

        # Fallback to index.html for client-side routing
        self.app.router.add_get("/{tail:.*}", self.handle_spa_fallback)

    async def handle_index(self, request: web.Request) -> web.Response:
        index_file = self.static_dir / "index.html"
        if not index_file.exists():
            return web.Response(text="mac-sysmon: frontend assets not found in dist/", status=404)
        return web.FileResponse(index_file)

    async def handle_bundle_js(self, request: web.Request) -> web.Response:
        f = self.static_dir / "bundle.js"
        if f.exists():
            return web.FileResponse(f, headers={"Content-Type": "application/javascript"})
        return web.Response(status=404)

    async def handle_bundle_map(self, request: web.Request) -> web.Response:
        f = self.static_dir / "bundle.js.map"
        if f.exists():
            return web.FileResponse(f, headers={"Content-Type": "application/json"})
        return web.Response(status=404)

    async def handle_styles_css(self, request: web.Request) -> web.Response:
        f = self.static_dir / "styles.css"
        if f.exists():
            return web.FileResponse(f, headers={"Content-Type": "text/css"})
        return web.Response(status=404)

    async def handle_favicon(self, request: web.Request) -> web.Response:
        f = self.static_dir / "favicon.svg"
        if f.exists():
            return web.FileResponse(f, headers={"Content-Type": "image/svg+xml"})
        return web.Response(status=404)

    async def handle_spa_fallback(self, request: web.Request) -> web.Response:
        target = self.static_dir / request.match_info["tail"]
        if target.exists() and target.is_file():
            return web.FileResponse(target)
        return await self.handle_index(request)

    async def handle_api_system(self, request: web.Request) -> web.Response:
        metrics = self.collector.latest_metrics or self.collector.collect()
        return web.json_response({
            "success": True,
            "message": "System metrics snapshot retrieved",
            "data": metrics,
        })

    async def handle_api_processes(self, request: web.Request) -> web.Response:
        metrics = self.collector.latest_metrics or self.collector.collect()
        return web.json_response({
            "success": True,
            "message": "Process list retrieved",
            "data": metrics.get("processes", []),
        })

    async def handle_api_process_detail(self, request: web.Request) -> web.Response:
        pid_str = request.match_info.get("pid")
        try:
            pid = int(pid_str)
        except (ValueError, TypeError):
            return web.json_response({"success": False, "message": f"Invalid PID: {pid_str}", "data": None}, status=400)

        # Check cached process info
        cached_proc = None
        for p in self.collector.latest_metrics.get("processes", []):
            if p.get("pid") == pid:
                cached_proc = p
                break

        try:
            detail = get_process_detail(pid, cached_proc)
            return web.json_response({
                "success": True,
                "message": f"Process {pid} details retrieved",
                "data": detail,
            })
        except FileNotFoundError as e:
            return web.json_response({"success": False, "message": str(e), "data": None}, status=404)
        except Exception as e:
            return web.json_response({"success": False, "message": str(e), "data": None}, status=500)

    async def handle_api_process_kill(self, request: web.Request) -> web.Response:
        pid_str = request.match_info.get("pid")
        try:
            pid = int(pid_str)
        except (ValueError, TypeError):
            return web.json_response({"success": False, "message": f"Invalid PID: {pid_str}", "data": None}, status=400)

        signal_name = "SIGTERM"
        try:
            body = await request.json()
            if isinstance(body, dict) and "signal" in body:
                signal_name = body["signal"]
        except Exception:
            pass

        ok, msg = kill_process(pid, signal_name)
        status_code = 200 if ok else 400
        return web.json_response({"success": ok, "message": msg, "data": None}, status=status_code)

    async def handle_ws(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse(heartbeat=20.0)
        await ws.prepare(request)

        self.ws_clients.add(ws)
        logger.info(f"WebSocket client connected from {request.remote} (Total: {len(self.ws_clients)})")

        # Send immediate initial snapshot
        snapshot = self.collector.latest_metrics or self.collector.collect()
        try:
            await ws.send_str(json.dumps(snapshot))
        except Exception as e:
            logger.warning(f"Failed to send initial snapshot: {e}")

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    # Client messages (pings/commands)
                    pass
                elif msg.type == WSMsgType.ERROR:
                    logger.warning(f"WebSocket connection closed with error: {ws.exception()}")
        finally:
            self.ws_clients.discard(ws)
            logger.info(f"WebSocket client disconnected (Remaining: {len(self.ws_clients)})")

        return ws

    async def _broadcast_metrics(self, snapshot: dict):
        if not self.ws_clients:
            return

        payload = json.dumps(snapshot)
        disconnected = set()

        for ws in self.ws_clients:
            try:
                await ws.send_str(payload)
            except Exception:
                disconnected.add(ws)

        if disconnected:
            self.ws_clients.difference_update(disconnected)
