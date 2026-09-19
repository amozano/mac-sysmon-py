import { SparklineChart } from '../charts';
import { SystemMetrics } from '../types';
import { formatBytes, formatPercent } from '../utils';

export class MemoryViewComponent {
  private container: HTMLElement;
  private memorySparkline: SparklineChart | null = null;
  private swapSparkline: SparklineChart | null = null;
  private onSelectProcess: (pid: number) => void;

  constructor(container: HTMLElement, onSelectProcess: (pid: number) => void) {
    this.container = container;
    this.onSelectProcess = onSelectProcess;
    this.renderSkeleton();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2>Memory Inspector</h2>
          <p class="view-subtitle">Unified Memory Architecture & Swap Management</p>
        </div>
        <div class="mem-pressure-badge" id="mem-pressure-pill">
          <span class="pressure-dot normal"></span>
          <span id="mem-pressure-label">Pressure: Normal</span>
        </div>
      </div>

      <!-- Memory Overview Cards -->
      <div class="mem-stat-cards-grid mb-4">
        <div class="card mem-subcard">
          <span class="subcard-label">Total Unified RAM</span>
          <span class="subcard-val" id="mem-v-total">--</span>
          <span class="subcard-hint">Hardware Pool</span>
        </div>
        <div class="card mem-subcard">
          <span class="subcard-label">Active / Used RAM</span>
          <span class="subcard-val text-blue" id="mem-v-used">--</span>
          <span class="subcard-hint" id="mem-v-used-pct">--% utilized</span>
        </div>
        <div class="card mem-subcard">
          <span class="subcard-label">Available / Cache</span>
          <span class="subcard-val text-green" id="mem-v-avail">--</span>
          <span class="subcard-hint">Immediately allocatable</span>
        </div>
        <div class="card mem-subcard">
          <span class="subcard-label">Swap / Compressed</span>
          <span class="subcard-val text-purple" id="mem-v-swap">--</span>
          <span class="subcard-hint" id="mem-v-swap-pct">SSD Paged</span>
        </div>
      </div>

      <!-- Segmented Memory Distribution Bar -->
      <div class="card mem-distribution-card mb-4">
        <div class="card-header">
          <h3>Unified Memory Allocation</h3>
          <span class="subtext" id="mem-dist-sub">Real-time allocation</span>
        </div>
        <div class="stacked-bar-container">
          <div class="stacked-bar-fill bar-used" id="bar-mem-used" style="width: 50%;"></div>
          <div class="stacked-bar-fill bar-avail" id="bar-mem-avail" style="width: 30%;"></div>
          <div class="stacked-bar-fill bar-free" id="bar-mem-free" style="width: 20%;"></div>
        </div>
        <div class="stacked-bar-legend">
          <div class="legend-item"><span class="legend-box bar-used"></span> Used Memory (<span id="leg-used-bytes">--</span>)</div>
          <div class="legend-item"><span class="legend-box bar-avail"></span> Available Cache (<span id="leg-avail-bytes">--</span>)</div>
          <div class="legend-item"><span class="legend-box bar-free"></span> Free (<span id="leg-free-bytes">--</span>)</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="dashboard-grid mb-4">
        <div class="card chart-card">
          <div class="card-header">
            <h3>Physical RAM History (60s)</h3>
          </div>
          <div class="chart-box">
            <canvas id="mem-history-chart" height="70"></canvas>
          </div>
        </div>
        <div class="card chart-card">
          <div class="card-header">
            <h3>Swap Memory History</h3>
          </div>
          <div class="chart-box">
            <canvas id="swap-history-chart" height="70"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Memory Applications Table -->
      <div class="card table-card">
        <div class="card-header">
          <h3>Top Memory Consumer Processes</h3>
          <span class="subtext">Ranked by Resident Set Size (RSS)</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Process / Application</th>
                <th>Resident (RAM)</th>
                <th>Share %</th>
                <th>Virtual Mem</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="mem-proc-tbody">
              <tr><td colspan="7" class="loading-state">Loading process memory rankings...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const memCanvas = this.container.querySelector('#mem-history-chart') as HTMLCanvasElement;
    if (memCanvas) {
      this.memorySparkline = new SparklineChart(memCanvas, {
        strokeColor: '#30D158',
        fillColorStart: 'rgba(48, 209, 88, 0.4)',
        fillColorEnd: 'rgba(48, 209, 88, 0.02)',
        maxVal: 100,
      });
    }

    const swapCanvas = this.container.querySelector('#swap-history-chart') as HTMLCanvasElement;
    if (swapCanvas) {
      this.swapSparkline = new SparklineChart(swapCanvas, {
        strokeColor: '#BF5AF2',
        fillColorStart: 'rgba(191, 90, 242, 0.4)',
        fillColorEnd: 'rgba(191, 90, 242, 0.02)',
        maxVal: 0, // auto-scale
      });
    }
  }

  public update(metrics: SystemMetrics): void {
    const total = metrics.memory.total_bytes;
    const used = metrics.memory.used_bytes;
    const avail = metrics.memory.available_bytes;
    const free = metrics.memory.free_bytes;
    const swapUsed = metrics.memory.swap_used_bytes;
    const swapTotal = metrics.memory.swap_total_bytes;

    const elTotal = this.container.querySelector('#mem-v-total');
    const elUsed = this.container.querySelector('#mem-v-used');
    const elUsedPct = this.container.querySelector('#mem-v-used-pct');
    const elAvail = this.container.querySelector('#mem-v-avail');
    const elSwap = this.container.querySelector('#mem-v-swap');
    const elSwapPct = this.container.querySelector('#mem-v-swap-pct');

    if (elTotal) elTotal.textContent = formatBytes(total);
    if (elUsed) elUsed.textContent = formatBytes(used);
    if (elUsedPct) elUsedPct.textContent = `${metrics.memory.usage_percent.toFixed(1)}% utilized`;
    if (elAvail) elAvail.textContent = formatBytes(avail);
    if (elSwap) elSwap.textContent = `${formatBytes(swapUsed)} / ${formatBytes(swapTotal)}`;
    if (elSwapPct) {
      const swapPct = swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;
      elSwapPct.textContent = `${swapPct.toFixed(1)}% swap utilized`;
    }

    // Memory Pressure
    const pressurePill = this.container.querySelector('#mem-pressure-pill');
    const pressureDot = this.container.querySelector('.pressure-dot');
    const pressureLabel = this.container.querySelector('#mem-pressure-label');
    if (pressureDot && pressureLabel) {
      if (metrics.memory.usage_percent > 90) {
        pressureDot.className = 'pressure-dot critical';
        pressureLabel.textContent = 'Pressure: Critical (>90%)';
      } else if (metrics.memory.usage_percent > 75) {
        pressureDot.className = 'pressure-dot warning';
        pressureLabel.textContent = 'Pressure: Warning (>75%)';
      } else {
        pressureDot.className = 'pressure-dot normal';
        pressureLabel.textContent = 'Pressure: Normal';
      }
    }

    // Stacked bar
    if (total > 0) {
      const usedPct = (used / total) * 100;
      const availPct = Math.min(100 - usedPct, (avail / total) * 100);
      const freePct = Math.max(0, 100 - usedPct - availPct);

      const barUsed = this.container.querySelector('#bar-mem-used') as HTMLElement;
      const barAvail = this.container.querySelector('#bar-mem-avail') as HTMLElement;
      const barFree = this.container.querySelector('#bar-mem-free') as HTMLElement;

      if (barUsed) barUsed.style.width = `${usedPct}%`;
      if (barAvail) barAvail.style.width = `${availPct}%`;
      if (barFree) barFree.style.width = `${freePct}%`;

      const legUsed = this.container.querySelector('#leg-used-bytes');
      const legAvail = this.container.querySelector('#leg-avail-bytes');
      const legFree = this.container.querySelector('#leg-free-bytes');
      if (legUsed) legUsed.textContent = formatBytes(used);
      if (legAvail) legAvail.textContent = formatBytes(avail);
      if (legFree) legFree.textContent = formatBytes(free);
    }

    // Charts
    if (this.memorySparkline) this.memorySparkline.push(metrics.memory.usage_percent);
    if (this.swapSparkline) this.swapSparkline.push(swapUsed);

    // Top memory consumers table
    const topMemProcs = [...metrics.processes]
      .filter((p) => p.memory_bytes > 5 * 1024 * 1024)
      .sort((a, b) => b.memory_bytes - a.memory_bytes)
      .slice(0, 12);

    const tbody = this.container.querySelector('#mem-proc-tbody');
    if (tbody) {
      if (topMemProcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No significant memory consumers found</td></tr>';
      } else {
        tbody.innerHTML = topMemProcs
          .map((p) => {
            const displayName = p.app_name || p.name;
            const appBadge = p.is_app ? '<span class="badge-app">APP</span>' : '';
            return `
              <tr class="proc-table-row" data-pid="${p.pid}">
                <td class="font-mono text-muted">${p.pid}</td>
                <td>
                  <div class="proc-name-cell">
                    <span class="proc-name-title">${displayName}</span>
                    ${appBadge}
                  </div>
                </td>
                <td class="font-mono font-bold">${formatBytes(p.memory_bytes)}</td>
                <td class="font-mono">
                  <div class="share-cell">
                    <span>${p.memory_percent.toFixed(1)}%</span>
                    <div class="mini-bar-track">
                      <div class="mini-bar-fill mem-fill" style="width: ${Math.min(100, p.memory_percent * 4)}%;"></div>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-muted">${formatBytes(p.virtual_memory_bytes)}</td>
                <td><span class="status-tag status-${p.status.toLowerCase()}">${p.status}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm inspect-btn" data-pid="${p.pid}">Inspect</button>
                </td>
              </tr>
            `;
          })
          .join('');

        tbody.querySelectorAll<HTMLButtonElement>('.inspect-btn').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pid = parseInt(btn.getAttribute('data-pid') || '0', 10);
            if (pid > 0) this.onSelectProcess(pid);
          });
        });

        tbody.querySelectorAll<HTMLTableRowElement>('.proc-table-row').forEach((row) => {
          row.addEventListener('click', () => {
            const pid = parseInt(row.getAttribute('data-pid') || '0', 10);
            if (pid > 0) this.onSelectProcess(pid);
          });
        });
      }
    }
  }

  public resize(): void {
    if (this.memorySparkline) this.memorySparkline.resize();
    if (this.swapSparkline) this.swapSparkline.resize();
  }
}
