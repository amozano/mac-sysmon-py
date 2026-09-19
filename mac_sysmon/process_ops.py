import os
import signal
import sys
from typing import Any, Optional

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


def kill_process(pid: int, signal_name: Optional[str] = "SIGTERM") -> tuple[bool, str]:
    """
    Sends a termination signal to a process with safety interlocks.
    """
    # 1. Protected system PIDs
    if pid == 0 or pid == 1:
        return False, f"Operation not permitted: Cannot terminate protected system PID {pid}"

    # 2. Self termination guard
    my_pid = os.getpid()
    if pid == my_pid:
        return False, "Operation rejected: Cannot terminate self (sysmon server)"

    # 3. Parent process termination guard
    parent_pid = os.getppid()
    if pid == parent_pid:
        return False, f"Operation rejected: Cannot terminate parent process (PID {pid})"

    # 4. Validate signal
    sig_str = (signal_name or "SIGTERM").upper()
    sig_map = {
        "SIGTERM": signal.SIGTERM,
        "TERM": signal.SIGTERM,
        "15": signal.SIGTERM,
        "SIGKILL": signal.SIGKILL,
        "KILL": signal.SIGKILL,
        "9": signal.SIGKILL,
        "SIGHUP": signal.SIGHUP,
        "1": signal.SIGHUP,
        "SIGINT": signal.SIGINT,
        "2": signal.SIGINT,
    }

    if sig_str not in sig_map:
        return False, f"Unsupported signal: {signal_name}. Supported signals: SIGTERM, SIGKILL"

    sig = sig_map[sig_str]

    # 5. Check protected process names like launchd and WindowServer
    if HAS_PSUTIL:
        try:
            p = psutil.Process(pid)
            name_lower = (p.name() or "").lower()
            if name_lower in ("launchd", "windowserver"):
                return False, f"Operation not permitted: Cannot terminate protected system process '{p.name()}' (PID {pid})"
        except psutil.NoSuchProcess:
            return False, f"Process with PID {pid} not found"
        except (psutil.AccessDenied, Exception):
            pass

    try:
        os.kill(pid, sig)
        return True, f"Signal {sig_str} delivered successfully to PID {pid}"
    except ProcessLookupError:
        return False, f"Process with PID {pid} not found"
    except PermissionError:
        return False, f"Permission denied: Insufficient privileges to signal PID {pid}"
    except OSError as e:
        return False, f"Failed to deliver signal to PID {pid}: {e}"


def get_process_detail(pid: int, cached_process: Optional[dict] = None) -> dict[str, Any]:
    """
    Retrieves deep inspection metadata for a process: PPID, cmdline, cwd, environment.
    """
    proc_info = cached_process or {
        "pid": pid,
        "name": f"pid-{pid}",
        "app_name": None,
        "exe_path": None,
        "cmd": [],
        "cpu_usage": 0.0,
        "memory_bytes": 0,
        "memory_percent": 0.0,
        "virtual_memory_bytes": 0,
        "disk_read_bytes_per_sec": 0,
        "disk_written_bytes_per_sec": 0,
        "total_read_bytes": 0,
        "total_written_bytes": 0,
        "status": "Unknown",
        "user_id": None,
        "user_name": None,
        "start_time": 0,
        "run_time": 0,
        "is_app": False,
    }

    parent_pid = None
    cwd = None
    environ: list[str] = []

    if HAS_PSUTIL:
        try:
            p = psutil.Process(pid)
            parent_pid = p.ppid()
            try:
                cwd = p.cwd()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                cwd = None
            try:
                env_dict = p.environ()
                environ = [f"{k}={v}" for k, v in env_dict.items()]
            except (psutil.AccessDenied, psutil.ZombieProcess, Exception):
                environ = []
            try:
                if not proc_info["cmd"]:
                    proc_info["cmd"] = p.cmdline()
                if not proc_info["exe_path"]:
                    proc_info["exe_path"] = p.exe()
            except Exception:
                pass
        except psutil.NoSuchProcess:
            raise FileNotFoundError(f"Process with PID {pid} not found")
        except Exception:
            pass
    else:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            raise FileNotFoundError(f"Process with PID {pid} not found")
        except PermissionError:
            pass


    return {
        "process": proc_info,
        "parent_pid": parent_pid,
        "cwd": cwd,
        "root": None,
        "environ": environ,
    }
