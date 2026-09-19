import { SparklineChart } from '../charts';
import { SystemMetrics } from '../types';
import { formatBytes, formatRate } from '../utils';

export class DisksViewComponent {
  private container: HTMLElement;
  private diskIoSparkline: SparklineChart | null = null;
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
          <h2>Storage & Disks Inspector</h2>
          <p class="view-subtitle">APFS Containers, Physical Volumes & Real-Time Disk Throughput</p>
        </div>
        <div class="disk-rates-banner">
          <div class="io-pill">
            <span class="io-arrow text-blue">↓</span>
            <span class="io-text">Read: <strong id="dv-read-rate">0 B/s</strong></span>
          </div>
          <div class="io-pill">
            <span class="io-arrow text-orange">↑</span>
            <span class="io-text">Write: <strong id="dv-write-rate">0 B/s</strong></span>
          </div>
        </div>
      </div>

      <!-- Live Disk I/O Graph -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">
            <span class="card-icon">⚡</span>
            <h3>Total Disk I/O Activity (Read + Write Throughput)</h3>
          </div>
        </div>
        <div class="chart-box">
          <canvas id="disk-io-sparkline" height="70"></canvas>
        </div>
      </div>

      <!-- Mounted Disks Section -->
      <div class="section-title-group mb-2">
        <h3>Mounted Volumes & APFS Partitions</h3>
        <span class="subtext" id="disks-count-sub">-- Volumes Detected</span>
      </div>

      <div class="disks-cards-grid mb-4" id="disks-cards-container">
        <div class="loading-state">Inspecting disk partitions...</div>
      </div>

      <!-- Top Disk Consumers Table -->
      <div class="card table-card">
        <div class="card-header">
          <h3>Active Process Disk I/O Consumers</h3>
          <span class="subtext">Processes actively generating read/write throughput</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Application / Process</th>
                <th>Read Rate</th>
                <th>Write Rate</th>
                <th>Lifetime Read</th>
                <th>Lifetime Written</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="disk-proc-tbody">
              <tr><td colspan="7" class="loading-state">Measuring process I/O rates...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector('#disk-io-sparkline') as HTMLCanvasElement;
    if (canvas) {
      this.diskIoSparkline = new SparklineChart(canvas, {
        strokeColor: '#FF9F0A',
        fillColorStart: 'rgba(255, 159, 10, 0.4)',
        fillColorEnd: 'rgba(255, 159, 10, 0.02)',
        maxVal: 0, // auto-scale
      });
    }
  }

  public update(metrics: SystemMetrics): void {
    const readRate = this.container.querySelector('#dv-read-rate');
    const writeRate = this.container.querySelector('#dv-write-rate');
    if (readRate) readRate.textContent = formatRate(metrics.disk_io.read_bytes_per_sec);
    if (writeRate) writeRate.textContent = formatRate(metrics.disk_io.written_bytes_per_sec);

    if (this.diskIoSparkline) {
      this.diskIoSparkline.push(metrics.disk_io.read_bytes_per_sec + metrics.disk_io.written_bytes_per_sec);
    }

    const countSub = this.container.querySelector('#disks-count-sub');
    if (countSub) countSub.textContent = `${metrics.disks.length} Volumes Mounted`;

    // Disks cards
    const disksContainer = this.container.querySelector('#disks-cards-container');
    if (disksContainer && metrics.disks.length > 0) {
      disksContainer.innerHTML = metrics.disks
        .map((d) => {
          const pct = d.usage_percent;
          const barColor = pct > 90 ? 'var(--color-red)' : pct > 80 ? 'var(--color-orange)' : 'var(--color-blue)';
          const removableBadge = d.is_removable ? '<span class="badge-removable">Removable</span>' : '';
          return `
            <div class="card disk-detail-card">
              <div class="disk-card-header">
                <div class="disk-title-box">
                  <span class="disk-icon-big">💾</span>
                  <div>
                    <h4 class="disk-h4">${d.name}</h4>
                    <span class="disk-path">${d.mount_point}</span>
                  </div>
                </div>
                ${removableBadge}
              </div>

              <div class="disk-stats-row mt-3">
                <div class="disk-stat-col">
                  <span class="d-label">Used Space</span>
                  <span class="d-val font-mono">${formatBytes(d.used_bytes)}</span>
                </div>
                <div class="disk-stat-col">
                  <span class="d-label">Available Free</span>
                  <span class="d-val font-mono text-green">${formatBytes(d.available_bytes)}</span>
                </div>
                <div class="disk-stat-col">
                  <span class="d-label">Total Capacity</span>
                  <span class="d-val font-mono">${formatBytes(d.total_bytes)}</span>
                </div>
              </div>

              <div class="progress-track mt-3">
                <div class="progress-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
              </div>
              <div class="disk-pct-label mt-1">
                <span>${pct.toFixed(1)}% full</span>
                <span class="text-muted">FS: ${d.file_system.toUpperCase()} • ${d.kind}</span>
              </div>
            </div>
          `;
        })
        .join('');
    }

    // Top process I/O consumers
    const ioProcs = [...metrics.processes]
      .filter((p) => p.disk_read_bytes_per_sec > 0 || p.disk_written_bytes_per_sec > 0 || p.total_read_bytes > 10 * 1024 * 1024)
      .sort(
        (a, b) =>
          b.disk_read_bytes_per_sec +
          b.disk_written_bytes_per_sec -
          (a.disk_read_bytes_per_sec + a.disk_written_bytes_per_sec) ||
          b.total_written_bytes - a.total_written_bytes
      )
      .slice(0, 10);

    const tbody = this.container.querySelector('#disk-proc-tbody');
    if (tbody) {
      if (ioProcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No significant disk I/O activity detected</td></tr>';
      } else {
        tbody.innerHTML = ioProcs
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
                <td class="font-mono text-blue font-bold">${formatRate(p.disk_read_bytes_per_sec)}</td>
                <td class="font-mono text-orange font-bold">${formatRate(p.disk_written_bytes_per_sec)}</td>
                <td class="font-mono text-muted">${formatBytes(p.total_read_bytes)}</td>
                <td class="font-mono text-muted">${formatBytes(p.total_written_bytes)}</td>
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
    if (this.diskIoSparkline) this.diskIoSparkline.resize();
  }
}
