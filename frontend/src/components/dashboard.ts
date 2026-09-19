import { CircularGauge, SparklineChart } from '../charts';
import { SystemMetrics } from '../types';
import { formatBytes, formatPercent, formatRate } from '../utils';

export class DashboardComponent {
  private container: HTMLElement;
  private cpuGauge: CircularGauge | null = null;
  private memGauge: CircularGauge | null = null;
  private cpuSparkline: SparklineChart | null = null;
  private memSparkline: SparklineChart | null = null;
  private netSparkline: SparklineChart | null = null;
  private diskSparkline: SparklineChart | null = null;
  private onSelectProcess: (pid: number) => void;

  constructor(container: HTMLElement, onSelectProcess: (pid: number) => void) {
    this.container = container;
    this.onSelectProcess = onSelectProcess;
    this.renderSkeleton();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="dashboard-grid">
        <!-- CPU Card -->
        <div class="card metric-card cpu-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon cpu-icon">⚡</span>
              <h3>CPU Utilization</h3>
            </div>
            <div class="card-badge" id="cpu-core-count">-- Cores</div>
          </div>
          <div class="metric-body">
            <div class="gauge-container">
              <canvas id="cpu-gauge-canvas" width="130" height="130"></canvas>
            </div>
            <div class="metric-details">
              <div class="load-avg-row">
                <div class="load-stat">
                  <span class="stat-label">1m Load</span>
                  <span class="stat-value" id="cpu-load-1">--</span>
                </div>
                <div class="load-stat">
                  <span class="stat-label">5m Load</span>
                  <span class="stat-value" id="cpu-load-5">--</span>
                </div>
                <div class="load-stat">
                  <span class="stat-label">15m Load</span>
                  <span class="stat-value" id="cpu-load-15">--</span>
                </div>
              </div>
              <div class="chart-box">
                <div class="chart-header-mini">History (60s)</div>
                <canvas id="cpu-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Memory Card -->
        <div class="card metric-card memory-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon mem-icon">🧠</span>
              <h3>Memory (Unified RAM)</h3>
            </div>
            <div class="card-badge" id="mem-total-badge">-- GB Total</div>
          </div>
          <div class="metric-body">
            <div class="gauge-container">
              <canvas id="mem-gauge-canvas" width="130" height="130"></canvas>
            </div>
            <div class="metric-details">
              <div class="stats-grid-2x2">
                <div class="stat-item">
                  <span class="stat-label">Used</span>
                  <span class="stat-value" id="mem-used-val">--</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Available</span>
                  <span class="stat-value" id="mem-avail-val">--</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Swap / Compressed</span>
                  <span class="stat-value" id="mem-swap-val">--</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Free</span>
                  <span class="stat-value" id="mem-free-val">--</span>
                </div>
              </div>
              <div class="chart-box">
                <div class="chart-header-mini">Memory Pressure History</div>
                <canvas id="mem-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Storage Card -->
        <div class="card metric-card storage-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon disk-icon">💾</span>
              <h3>Storage & Disks</h3>
            </div>
            <div class="io-rates" id="disk-io-rate">
              <span>↓ <strong id="disk-read-rate">0 B/s</strong></span>
              <span>↑ <strong id="disk-write-rate">0 B/s</strong></span>
            </div>
          </div>
          <div class="storage-summary-body" id="storage-summary-list">
            <div class="loading-state">Scanning storage volumes...</div>
          </div>
          <div class="chart-box mt-2">
            <div class="chart-header-mini">Disk I/O Activity</div>
            <canvas id="disk-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
          </div>
        </div>

        <!-- Network Card -->
        <div class="card metric-card network-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon net-icon">🌐</span>
              <h3>Network Throughput</h3>
            </div>
            <div class="io-rates">
              <span>↓ <strong id="net-rx-rate">0 B/s</strong></span>
              <span>↑ <strong id="net-tx-rate">0 B/s</strong></span>
            </div>
          </div>
          <div class="net-summary-body">
            <div class="net-stat-row">
              <div class="net-stat-col">
                <span class="net-sublabel">Total Downloaded</span>
                <span class="net-big-val" id="net-total-rx">--</span>
              </div>
              <div class="net-stat-col">
                <span class="net-sublabel">Total Uploaded</span>
                <span class="net-big-val" id="net-total-tx">--</span>
              </div>
            </div>
            <div class="chart-box mt-3">
              <div class="chart-header-mini">Throughput History (60s)</div>
              <canvas id="net-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Consumers Row -->
      <div class="top-consumers-row mt-4">
        <!-- Top CPU Consumers -->
        <div class="card consumer-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon">🔥</span>
              <h3>Top Applications by CPU</h3>
            </div>
            <span class="subtext">Click app to inspect</span>
          </div>
          <div class="consumer-list" id="top-cpu-list">
            <div class="loading-state">Analyzing active threads...</div>
          </div>
        </div>

        <!-- Top Memory Consumers -->
        <div class="card consumer-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon">📈</span>
              <h3>Top Applications by Memory</h3>
            </div>
            <span class="subtext">Click app to inspect</span>
          </div>
          <div class="consumer-list" id="top-mem-list">
            <div class="loading-state">Analyzing resident memory...</div>
          </div>
        </div>
      </div>
    `;

    // Initialize charts
    const cpuCanvas = this.container.querySelector('#cpu-gauge-canvas') as HTMLCanvasElement;
    if (cpuCanvas) this.cpuGauge = new CircularGauge(cpuCanvas, 'CPU Load', '#0A84FF');

    const memCanvas = this.container.querySelector('#mem-gauge-canvas') as HTMLCanvasElement;
    if (memCanvas) this.memGauge = new CircularGauge(memCanvas, 'Memory', '#30D158');

    const cpuSpark = this.container.querySelector('#cpu-sparkline-canvas') as HTMLCanvasElement;
    if (cpuSpark) {
      this.cpuSparkline = new SparklineChart(cpuSpark, {
        strokeColor: '#0A84FF',
        fillColorStart: 'rgba(10, 132, 255, 0.4)',
        fillColorEnd: 'rgba(10, 132, 255, 0.02)',
        maxVal: 100,
      });
    }

    const memSpark = this.container.querySelector('#mem-sparkline-canvas') as HTMLCanvasElement;
    if (memSpark) {
      this.memSparkline = new SparklineChart(memSpark, {
        strokeColor: '#30D158',
        fillColorStart: 'rgba(48, 209, 88, 0.4)',
        fillColorEnd: 'rgba(48, 209, 88, 0.02)',
        maxVal: 100,
      });
    }

    const netSpark = this.container.querySelector('#net-sparkline-canvas') as HTMLCanvasElement;
    if (netSpark) {
      this.netSparkline = new SparklineChart(netSpark, {
        strokeColor: '#64D2FF',
        fillColorStart: 'rgba(100, 210, 255, 0.4)',
        fillColorEnd: 'rgba(100, 210, 255, 0.02)',
        maxVal: 0, // auto-scale
      });
    }

    const diskSpark = this.container.querySelector('#disk-sparkline-canvas') as HTMLCanvasElement;
    if (diskSpark) {
      this.diskSparkline = new SparklineChart(diskSpark, {
        strokeColor: '#FF9F0A',
        fillColorStart: 'rgba(255, 159, 10, 0.4)',
        fillColorEnd: 'rgba(255, 159, 10, 0.02)',
        maxVal: 0, // auto-scale
      });
    }
  }

  public update(metrics: SystemMetrics): void {
    // 1. CPU Card Update
    if (this.cpuGauge) this.cpuGauge.setPercentage(metrics.cpu.global_usage);
    if (this.cpuSparkline) this.cpuSparkline.push(metrics.cpu.global_usage);

    const coreCountEl = this.container.querySelector('#cpu-core-count');
    if (coreCountEl) {
      coreCountEl.textContent = `${metrics.system_info.total_core_count} Cores (${metrics.system_info.cpu_arch})`;
    }

    const load1 = this.container.querySelector('#cpu-load-1');
    const load5 = this.container.querySelector('#cpu-load-5');
    const load15 = this.container.querySelector('#cpu-load-15');
    if (load1) load1.textContent = metrics.cpu.load_average[0].toFixed(2);
    if (load5) load5.textContent = metrics.cpu.load_average[1].toFixed(2);
    if (load15) load15.textContent = metrics.cpu.load_average[2].toFixed(2);

    // 2. Memory Card Update
    if (this.memGauge) this.memGauge.setPercentage(metrics.memory.usage_percent);
    if (this.memSparkline) this.memSparkline.push(metrics.memory.usage_percent);

    const memTotal = this.container.querySelector('#mem-total-badge');
    if (memTotal) memTotal.textContent = `${formatBytes(metrics.memory.total_bytes, 0)} Total`;

    const memUsed = this.container.querySelector('#mem-used-val');
    const memAvail = this.container.querySelector('#mem-avail-val');
    const memSwap = this.container.querySelector('#mem-swap-val');
    const memFree = this.container.querySelector('#mem-free-val');
    if (memUsed) memUsed.textContent = formatBytes(metrics.memory.used_bytes);
    if (memAvail) memAvail.textContent = formatBytes(metrics.memory.available_bytes);
    if (memSwap) memSwap.textContent = `${formatBytes(metrics.memory.swap_used_bytes)} / ${formatBytes(metrics.memory.swap_total_bytes)}`;
    if (memFree) memFree.textContent = formatBytes(metrics.memory.free_bytes);

    // 3. Storage Card Update
    const diskRead = this.container.querySelector('#disk-read-rate');
    const diskWrite = this.container.querySelector('#disk-write-rate');
    if (diskRead) diskRead.textContent = formatRate(metrics.disk_io.read_bytes_per_sec);
    if (diskWrite) diskWrite.textContent = formatRate(metrics.disk_io.written_bytes_per_sec);
    if (this.diskSparkline) {
      this.diskSparkline.push(metrics.disk_io.read_bytes_per_sec + metrics.disk_io.written_bytes_per_sec);
    }

    const diskList = this.container.querySelector('#storage-summary-list');
    if (diskList && metrics.disks.length > 0) {
      diskList.innerHTML = metrics.disks
        .slice(0, 3) // show top 3 mounted volumes
        .map((d) => {
          const pct = d.usage_percent;
          const barColor = pct > 90 ? 'var(--color-red)' : pct > 80 ? 'var(--color-orange)' : 'var(--color-blue)';
          return `
            <div class="disk-row-item">
              <div class="disk-meta-row">
                <div class="disk-name-box">
                  <span class="disk-name-label">${d.name}</span>
                  <span class="disk-mount-label">${d.mount_point} (${d.file_system.toUpperCase()})</span>
                </div>
                <div class="disk-space-box">
                  <span>${formatBytes(d.used_bytes)} / ${formatBytes(d.total_bytes)}</span>
                  <strong class="disk-pct">${pct.toFixed(1)}%</strong>
                </div>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    // 4. Network Card Update
    const netRx = this.container.querySelector('#net-rx-rate');
    const netTx = this.container.querySelector('#net-tx-rate');
    const netTotRx = this.container.querySelector('#net-total-rx');
    const netTotTx = this.container.querySelector('#net-total-tx');
    if (netRx) netRx.textContent = formatRate(metrics.network.received_bytes_per_sec);
    if (netTx) netTx.textContent = formatRate(metrics.network.transmitted_bytes_per_sec);
    if (netTotRx) netTotRx.textContent = formatBytes(metrics.network.total_received_bytes);
    if (netTotTx) netTotTx.textContent = formatBytes(metrics.network.total_transmitted_bytes);
    if (this.netSparkline) {
      this.netSparkline.push(metrics.network.received_bytes_per_sec + metrics.network.transmitted_bytes_per_sec);
    }

    // 5. Top Consumers Leaderboards
    this.updateTopConsumers(metrics);
  }

  private updateTopConsumers(metrics: SystemMetrics): void {
    // Top 5 CPU
    const topCpu = [...metrics.processes]
      .filter((p) => p.cpu_usage > 0.1)
      .sort((a, b) => b.cpu_usage - a.cpu_usage)
      .slice(0, 5);

    const cpuListEl = this.container.querySelector('#top-cpu-list');
    if (cpuListEl) {
      if (topCpu.length === 0) {
        cpuListEl.innerHTML = '<div class="empty-state">System idle (no high CPU processes)</div>';
      } else {
        cpuListEl.innerHTML = topCpu
          .map((p) => {
            const displayName = p.app_name || p.name;
            const maxVal = topCpu[0].cpu_usage || 100;
            const relWidth = Math.min(100, Math.max(5, (p.cpu_usage / maxVal) * 100));
            return `
              <div class="consumer-row" data-pid="${p.pid}">
                <div class="consumer-info">
                  <div class="consumer-title-box">
                    <span class="consumer-name">${displayName}</span>
                    <span class="consumer-pid">PID ${p.pid}</span>
                  </div>
                  <div class="consumer-stat">
                    <strong>${p.cpu_usage.toFixed(1)}%</strong>
                  </div>
                </div>
                <div class="progress-track-mini">
                  <div class="progress-fill cpu-fill" style="width: ${relWidth}%;"></div>
                </div>
              </div>
            `;
          })
          .join('');

        cpuListEl.querySelectorAll<HTMLElement>('.consumer-row').forEach((el) => {
          el.addEventListener('click', () => {
            const pid = parseInt(el.getAttribute('data-pid') || '0', 10);
            if (pid > 0) this.onSelectProcess(pid);
          });
        });
      }
    }

    // Top 5 Memory
    const topMem = [...metrics.processes]
      .filter((p) => p.memory_bytes > 10 * 1024 * 1024)
      .sort((a, b) => b.memory_bytes - a.memory_bytes)
      .slice(0, 5);

    const memListEl = this.container.querySelector('#top-mem-list');
    if (memListEl) {
      if (topMem.length === 0) {
        memListEl.innerHTML = '<div class="empty-state">No significant memory consumers</div>';
      } else {
        memListEl.innerHTML = topMem
          .map((p) => {
            const displayName = p.app_name || p.name;
            const maxVal = topMem[0].memory_bytes || 1;
            const relWidth = Math.min(100, Math.max(5, (p.memory_bytes / maxVal) * 100));
            return `
              <div class="consumer-row" data-pid="${p.pid}">
                <div class="consumer-info">
                  <div class="consumer-title-box">
                    <span class="consumer-name">${displayName}</span>
                    <span class="consumer-pid">PID ${p.pid}</span>
                  </div>
                  <div class="consumer-stat">
                    <span>${formatBytes(p.memory_bytes)}</span>
                    <strong class="text-sub">(${p.memory_percent.toFixed(1)}%)</strong>
                  </div>
                </div>
                <div class="progress-track-mini">
                  <div class="progress-fill mem-fill" style="width: ${relWidth}%;"></div>
                </div>
              </div>
            `;
          })
          .join('');

        memListEl.querySelectorAll<HTMLElement>('.consumer-row').forEach((el) => {
          el.addEventListener('click', () => {
            const pid = parseInt(el.getAttribute('data-pid') || '0', 10);
            if (pid > 0) this.onSelectProcess(pid);
          });
        });
      }
    }
  }

  public resize(): void {
    if (this.cpuGauge) this.cpuGauge.resize();
    if (this.memGauge) this.memGauge.resize();
    if (this.cpuSparkline) this.cpuSparkline.resize();
    if (this.memSparkline) this.memSparkline.resize();
    if (this.netSparkline) this.netSparkline.resize();
    if (this.diskSparkline) this.diskSparkline.resize();
  }
}
