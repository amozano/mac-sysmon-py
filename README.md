<p align="center">
  <a href="#mac-sysmon-py-">
    <img src="./logo.svg" alt="mac-sysmon Logo" width="200" height="200" />
  </a>
</p>

<h1 align="center">mac-sysmon-py ⚡</h1>

<p align="center">
  <strong>High-Performance macOS System Resource &amp; Process Monitor for Apple Silicon</strong><br>
  <em>Asynchronous Python Backend • Zero-Dependency Fallback • Real-Time WebSocket Streaming • Apple Dark Mode</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Platform-macOS%20(Apple%20Silicon%20%7C%20Intel)-000000?logo=apple&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Streaming-WebSocket%20%40%201Hz-00f2fe" alt="WebSocket" />
</p>

---

**mac-sysmon-py** is a high-performance Python implementation of the macOS system resource and process monitoring application. Built specifically for Apple Silicon (and Intel) MacBook Pros, it couples an asynchronous Python backend (`aiohttp`, `psutil`, or native stdlib fallback) with the zero-dependency **Vanilla TypeScript** frontend delivering an Apple-native Dark Mode aesthetic, 60fps Canvas charts, and real-time WebSocket streaming.

---

## Key Highlights

- **Dual-Engine Telemetry Collector**:
  - High-performance acceleration with `psutil` (when installed).
  - Robust **zero-dependency native macOS fallback** using standard library tools (`sysctl`, `vm_stat`, `df`, `ps`, `netstat`) ensuring it works in any restricted environment out of the box.
- **Full Apple Silicon Architecture Support**:
  - Per-core CPU utilization (Performance & Efficiency cores) with operating frequency.
  - Unified Memory (RAM) monitoring, active/wired cache breakdown, and swap tracking.
  - APFS container and storage disk inspection.
- **Process Resource Breakdown**:
  - Live process table with macOS `.app` bundle extraction (e.g., Chrome, Slack, VS Code).
  - Sub-millisecond fuzzy/prefix search (`⌘F`) and multi-column sorting.
  - Process inspection modal and safety-guarded signal termination (`SIGTERM` / `SIGKILL`).
- **Turnkey Launch**:
  - Instant launch via `./run.sh --open` (automatically opens default browser).

---

## Feature Matrix

| Domain | Metrics & Capabilities |
|---|---|
| **RAM & Unified Memory** | Total, Used, Available Cache, Free, Swap / Compressed, % utilization, memory pressure indicator, 60s Canvas sparkline |
| **SSD & Storage** | All mounted APFS volumes, capacity, free space, usage warning thresholds (>80%, >90%), read/write I/O throughput rates |
| **CPU Cores** | Global utilization %, load averages (1m, 5m, 15m), per-core grid with operating frequency (MHz) and individual mini-sparklines |
| **Telemetry Extras** | Network download/upload rates, cumulative bytes, system uptime, macOS & kernel versions, CPU architecture |
| **Process Manager** | PID, App Name, CPU %, RSS Memory, Memory Share %, Disk Read/Write rates, User, Status, modal inspection, and signal controls |

---

## Quickstart

### Prerequisites
- macOS (Apple Silicon or Intel)
- Python 3.10+ (tested on Python 3.14)

### One-Command Launch
```bash
cd mac-sysmon-py

# Launch server and automatically open browser
./run.sh --open
```

The application will launch on:
```
http://localhost:3000
```

---

## CLI Options

```bash
mac-sysmon-py [OPTIONS]

Options:
  -H, --host <HOST>          Host address to bind server [default: 127.0.0.1]
  -p, --port <PORT>          Port to listen on [default: 3000]
  -i, --interval <INTERVAL>  Sampling interval in milliseconds [default: 1000]
      --open                 Automatically open default browser on launch
  -v, --verbose              Enable debug logging
  -h, --help                 Show help message
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘1` | Switch to **Dashboard Overview** |
| `⌘2` | Switch to **CPU Core Grid** |
| `⌘3` | Switch to **Memory Inspector** |
| `⌘4` | Switch to **Storage & Disks** |
| `⌘5` | Switch to **Process Manager** |
| `⌘F` | Focus Process Search input |

---

## API Reference

### WebSocket Stream
- `GET /ws`: Real-time 1Hz WebSocket stream emitting full `SystemMetrics` JSON payloads.

### REST Endpoints
- `GET /api/system`: Returns current system telemetry snapshot.
- `GET /api/processes`: Returns list of all active processes.
- `GET /api/processes/<pid>`: Returns detailed inspection for a single process.
- `POST /api/processes/<pid>/kill`: Sends termination signal (`SIGTERM` or `SIGKILL`). Body: `{"signal": "SIGTERM"}`.

---

## License

This project is licensed under the **Apache License, Version 2.0**. You may obtain a copy of the License in the [LICENSE](LICENSE) file or at:

```
http://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Copyright (c) 2026 Ashton Mozano / mac-sysmon-py contributors.
