import os
import platform
import re
import subprocess
import time
from typing import Any, Dict, List, Optional, Tuple


class NativeMacCollector:
    """
    Zero-dependency pure Python collector using standard macOS tools:
    sysctl, vm_stat, df, ps, netstat.
    """

    def __init__(self):
        self.page_size = self._get_page_size()
        self.last_net_bytes: Dict[str, Tuple[int, int]] = {}
        self.last_net_tick = time.monotonic()
        self.sys_info = self._get_static_sys_info()

    def _get_page_size(self) -> int:
        try:
            return os.sysconf("SC_PAGESIZE")
        except Exception:
            return 16384  # Default Apple Silicon page size is 16KB

    def _get_static_sys_info(self) -> dict:
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

        logical_cores = os.cpu_count() or 8
        physical_cores = logical_cores
        try:
            out = subprocess.check_output(["sysctl", "-n", "hw.physicalcpu"], text=True).strip()
            if out.isdigit():
                physical_cores = int(out)
        except Exception:
            pass

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

    def get_uptime(self) -> int:
        try:
            out = subprocess.check_output(["sysctl", "-n", "kern.boottime"], text=True)
            # { sec = 1726350000, usec = 0 }
            m = re.search(r"sec\s*=\s*(\d+)", out)
            if m:
                boot_sec = int(m.group(1))
                return int(time.time() - boot_sec)
        except Exception:
            pass
        return 0

    def get_memory_metrics(self) -> dict:
        total_bytes = 0
        try:
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True).strip()
            if out.isdigit():
                total_bytes = int(out)
        except Exception:
            total_bytes = 16 * 1024 * 1024 * 1024

        free_bytes = 0
        active_bytes = 0
        inactive_bytes = 0
        wired_bytes = 0

        try:
            vm_out = subprocess.check_output(["vm_stat"], text=True)
            for line in vm_out.splitlines():
                if "Pages free:" in line:
                    free_bytes = int(re.search(r"\d+", line).group(0)) * self.page_size
                elif "Pages active:" in line:
                    active_bytes = int(re.search(r"\d+", line).group(0)) * self.page_size
                elif "Pages inactive:" in line:
                    inactive_bytes = int(re.search(r"\d+", line).group(0)) * self.page_size
                elif "Pages wired down:" in line:
                    wired_bytes = int(re.search(r"\d+", line).group(0)) * self.page_size
        except Exception:
            pass

        used_bytes = wired_bytes + active_bytes
        available_bytes = free_bytes + inactive_bytes
        if used_bytes == 0:
            used_bytes = max(0, total_bytes - available_bytes)

        swap_total = 0
        swap_used = 0
        swap_free = 0
        try:
            sw_out = subprocess.check_output(["sysctl", "-n", "vm.swapusage"], text=True)
            # total = 3072.00M  used = 128.00M  free = 2944.00M
            m_tot = re.search(r"total\s*=\s*([\d\.]+)M", sw_out)
            m_usd = re.search(r"used\s*=\s*([\d\.]+)M", sw_out)
            m_fre = re.search(r"free\s*=\s*([\d\.]+)M", sw_out)
            if m_tot:
                swap_total = int(float(m_tot.group(1)) * 1024 * 1024)
            if m_usd:
                swap_used = int(float(m_usd.group(1)) * 1024 * 1024)
            if m_fre:
                swap_free = int(float(m_fre.group(1)) * 1024 * 1024)
        except Exception:
            pass

        usage_pct = (used_bytes / total_bytes * 100.0) if total_bytes > 0 else 0.0

        return {
            "total_bytes": total_bytes,
            "used_bytes": used_bytes,
            "free_bytes": free_bytes,
            "available_bytes": available_bytes,
            "swap_total_bytes": swap_total,
            "swap_used_bytes": swap_used,
            "swap_free_bytes": swap_free,
            "usage_percent": round(usage_pct, 1),
        }

    def get_disk_metrics(self) -> List[dict]:
        disks = []
        try:
            df_out = subprocess.check_output(["df", "-k"], text=True)
            lines = df_out.strip().splitlines()
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 9 and parts[0].startswith("/dev/"):
                    dev_name = parts[0]
                    total_bytes = int(parts[1]) * 1024
                    used_bytes = int(parts[2]) * 1024
                    avail_bytes = int(parts[3]) * 1024
                    mount_point = " ".join(parts[8:])

                    # Skip internal small partitions
                    if total_bytes < 500 * 1024 * 1024:
                        continue

                    usage_pct = (used_bytes / total_bytes * 100.0) if total_bytes > 0 else 0.0

                    friendly_name = os.path.basename(mount_point) or "Macintosh HD"
                    if mount_point == "/":
                        friendly_name = "Macintosh HD"

                    disks.append({
                        "name": friendly_name,
                        "mount_point": mount_point,
                        "total_bytes": total_bytes,
                        "available_bytes": avail_bytes,
                        "used_bytes": used_bytes,
                        "usage_percent": round(usage_pct, 1),
                        "file_system": "apfs",
                        "is_removable": "/Volumes/" in mount_point and mount_point != "/Volumes/Macintosh HD",
                        "kind": "SSD",
                    })
        except Exception:
            pass

        if not disks:
            # Fallback statvfs on root
            try:
                st = os.statvfs("/")
                tot = st.f_blocks * st.f_frsize
                free = st.f_bavail * st.f_frsize
                used = tot - free
                pct = (used / tot * 100.0) if tot > 0 else 0.0
                disks.append({
                    "name": "Macintosh HD",
                    "mount_point": "/",
                    "total_bytes": tot,
                    "available_bytes": free,
                    "used_bytes": used,
                    "usage_percent": round(pct, 1),
                    "file_system": "apfs",
                    "is_removable": False,
                    "kind": "SSD",
                })
            except Exception:
                pass

        return disks

    def get_network_metrics(self) -> Tuple[dict, List[dict]]:
        now = time.monotonic()
        elapsed = max(0.001, now - self.last_net_tick)
        self.last_net_tick = now

        current_ifaces: Dict[str, Tuple[int, int]] = {}
        try:
            netstat_out = subprocess.check_output(["netstat", "-ib", "-n"], text=True)
            for line in netstat_out.splitlines()[1:]:
                parts = line.split()
                if len(parts) >= 11:
                    name = parts[0]
                    # Filter physical / active interfaces (en0, en1, lo0, etc.)
                    if name.endswith("*"):
                        continue
                    try:
                        rx = int(parts[6])
                        tx = int(parts[9])
                        if name not in current_ifaces:
                            current_ifaces[name] = (rx, tx)
                    except (ValueError, IndexError):
                        pass
        except Exception:
            pass

        interfaces = []
        tot_rx_rate = 0
        tot_tx_rate = 0
        tot_rx = 0
        tot_tx = 0

        for name, (rx, tx) in current_ifaces.items():
            tot_rx += rx
            tot_tx += tx

            prev_rx, prev_tx = self.last_net_bytes.get(name, (rx, tx))
            rx_rate = int(max(0, rx - prev_rx) / elapsed)
            tx_rate = int(max(0, tx - prev_tx) / elapsed)

            tot_rx_rate += rx_rate
            tot_tx_rate += tx_rate

            self.last_net_bytes[name] = (rx, tx)

            interfaces.append({
                "name": name,
                "received_bytes_per_sec": rx_rate,
                "transmitted_bytes_per_sec": tx_rate,
                "total_received_bytes": rx,
                "total_transmitted_bytes": tx,
            })

        summary = {
            "received_bytes_per_sec": tot_rx_rate,
            "transmitted_bytes_per_sec": tot_tx_rate,
            "total_received_bytes": tot_rx,
            "total_transmitted_bytes": tot_tx,
            "interfaces": interfaces,
        }
        return summary, interfaces

    def get_cpu_and_processes(self, total_mem_bytes: int) -> Tuple[dict, List[dict]]:
        # Load average
        load1, load5, load15 = os.getloadavg()

        # Parse ps aux
        processes = []
        total_cpu_sum = 0.0

        try:
            ps_cmd = ["ps", "-axo", "pid,ppid,user,%cpu,%mem,rss,vsz,state,comm,args"]
            out = subprocess.check_output(ps_cmd, text=True)
            lines = out.strip().splitlines()

            for line in lines[1:]:
                parts = line.strip().split(None, 9)
                if len(parts) >= 9:
                    try:
                        pid = int(parts[0])
                        ppid = int(parts[1])
                        user = parts[2]
                        cpu_pct = float(parts[3])
                        mem_pct = float(parts[4])
                        rss_bytes = int(parts[5]) * 1024
                        vsz_bytes = int(parts[6]) * 1024
                        state = parts[7]
                        comm = parts[8]
                        args_str = parts[9] if len(parts) > 9 else comm

                        total_cpu_sum += cpu_pct

                        name = os.path.basename(comm)
                        app_name, is_app = self._detect_app(comm)

                        processes.append({
                            "pid": pid,
                            "name": name,
                            "app_name": app_name,
                            "exe_path": comm,
                            "cmd": args_str.split(),
                            "cpu_usage": round(cpu_pct, 1),
                            "memory_bytes": rss_bytes,
                            "memory_percent": round(mem_pct, 1),
                            "virtual_memory_bytes": vsz_bytes,
                            "disk_read_bytes_per_sec": 0,
                            "disk_written_bytes_per_sec": 0,
                            "total_read_bytes": 0,
                            "total_written_bytes": 0,
                            "status": self._map_status(state),
                            "user_id": None,
                            "user_name": user,
                            "start_time": 0,
                            "run_time": 0,
                            "is_app": is_app,
                        })
                    except (ValueError, IndexError):
                        continue
        except Exception:
            pass

        # Global CPU calculation
        logical_cores = self.sys_info["total_core_count"]
        global_usage = min(100.0, round(total_cpu_sum / max(1, logical_cores), 1))

        # Core breakdown
        cores = []
        for i in range(logical_cores):
            # Estimate per-core load distributed evenly or with slight variance
            core_usage = min(100.0, round(global_usage * (0.85 + (i % 3) * 0.15), 1))
            cores.append({
                "id": i,
                "name": f"CPU {i}",
                "usage": core_usage,
                "frequency_mhz": 3200,
            })

        cpu_metrics = {
            "global_usage": global_usage,
            "load_average": [round(load1, 2), round(load5, 2), round(load15, 2)],
            "cores": cores,
        }

        return cpu_metrics, processes

    def _detect_app(self, path_str: str) -> Tuple[Optional[str], bool]:
        if not path_str:
            return None, False

        m = re.search(r"/([^/]+)\.app(?:/|$)", path_str)
        if m:
            return m.group(1), True

        if path_str.startswith("/Applications/") or path_str.startswith("/System/Applications/"):
            clean = os.path.basename(path_str).removesuffix(".app")
            return clean, True

        return None, False

    def _map_status(self, state: str) -> str:
        s = state[0] if state else "R"
        if s == "R":
            return "Run"
        elif s in ("S", "I"):
            return "Sleep"
        elif s == "U":
            return "Idle"
        elif s == "Z":
            return "Zombie"
        elif s == "T":
            return "Stop"
        return "Run"

    def collect(self) -> dict:
        uptime = self.get_uptime()
        sys_info = dict(self.sys_info)
        sys_info["uptime_secs"] = uptime

        memory = self.get_memory_metrics()
        disks = self.get_disk_metrics()
        net_summary, _ = self.get_network_metrics()
        cpu, processes = self.get_cpu_and_processes(memory["total_bytes"])

        return {
            "timestamp": int(time.time() * 1000),
            "system_info": sys_info,
            "cpu": cpu,
            "memory": memory,
            "disks": disks,
            "disk_io": {
                "read_bytes_per_sec": 0,
                "written_bytes_per_sec": 0,
                "total_read_bytes": 0,
                "total_written_bytes": 0,
            },
            "network": net_summary,
            "processes": processes,
        }
