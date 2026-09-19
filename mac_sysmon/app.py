import argparse
import asyncio
import logging
import os
import signal
import sys
import webbrowser
from pathlib import Path

from aiohttp import web

from .collector import MetricsCollector
from .server import SysmonServer


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


async def main_async(args):
    setup_logging(args.verbose)
    logger = logging.getLogger("mac_sysmon")

    logger.info("Starting macOS System Monitor (mac-sysmon-py v0.1.0)")
    logger.info(f"Target Host: {args.host}, Port: {args.port}, Sampling Interval: {args.interval}ms")

    # Locate static dist directory
    base_dir = Path(__file__).parent.parent
    static_dir = base_dir / "dist"
    if not static_dir.exists() or not (static_dir / "index.html").exists():
        logger.warning(f"Static directory {static_dir} not found or incomplete. Verifying frontend/...")

    # Initialize metrics collector
    collector = MetricsCollector()

    # Start background collector loop
    collector_task = asyncio.create_task(collector.run_loop(args.interval))

    # Create and start web server
    server = SysmonServer(collector, str(static_dir))
    runner = web.AppRunner(server.app)
    await runner.setup()

    site = web.TCPSite(runner, host=args.host, port=args.port)
    await site.start()

    local_url = f"http://{args.host}:{args.port}"
    logger.info("========================================================")
    logger.info(f"🚀 mac-sysmon-py is live and listening on {local_url}")
    logger.info(f"📊 Real-time WebSocket stream available at ws://{args.host}:{args.port}/ws")
    logger.info("========================================================")

    # Automatically open browser if requested
    if args.open:
        async def _open_browser():
            await asyncio.sleep(0.3)
            logger.info(f"Opening default browser at {local_url}...")
            webbrowser.open(local_url)
        asyncio.create_task(_open_browser())

    # Graceful shutdown event
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _on_signal():
        logger.info("Received termination signal, shutting down gracefully...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _on_signal)
        except NotImplementedError:
            pass

    try:
        await stop_event.wait()
    finally:
        logger.info("Cleaning up server and background collectors...")
        collector.stop()
        collector_task.cancel()
        await runner.cleanup()
        logger.info("mac-sysmon-py shut down cleanly.")


def main():
    parser = argparse.ArgumentParser(
        prog="mac-sysmon-py",
        description="macOS System Resource & Process Monitor (Python implementation with Vanilla TS UI)",
    )
    parser.add_argument(
        "-H", "--host",
        default="127.0.0.1",
        help="Host address to bind server to [default: 127.0.0.1]",
    )
    parser.add_argument(
        "-p", "--port",
        type=int,
        default=3000,
        help="Port to listen on [default: 3000]",
    )
    parser.add_argument(
        "-i", "--interval",
        type=int,
        default=1000,
        help="Telemetry sampling interval in milliseconds [default: 1000]",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Automatically open web browser on startup",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable debug logging",
    )

    args = parser.parse_args()
    try:
        asyncio.run(main_async(args))
    except (KeyboardInterrupt, SystemExit):
        pass


if __name__ == "__main__":
    main()
