import { SparklineChart } from '../charts';
import { SystemMetrics } from '../types';

export class CpuViewComponent {
  private container: HTMLElement;
  private coreSparklines: Map<number, SparklineChart> = new Map();
  private overallSparkline: SparklineChart | null = null;
  private renderedCoresCount = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderSkeleton();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2>CPU Core Inspector</h2>
          <p class="view-subtitle" id="cpu-arch-brand">Apple Silicon Architecture</p>
        </div>
        <div class="load-badge-group">
          <div class="load-pill">
            <span class="load-label">1m</span>
            <strong id="cpu-view-load1">0.00</strong>
          </div>
          <div class="load-pill">
            <span class="load-label">5m</span>
            <strong id="cpu-view-load5">0.00</strong>
          </div>
          <div class="load-pill">
            <span class="load-label">15m</span>
            <strong id="cpu-view-load15">0.00</strong>
          </div>
        </div>
      </div>

      <!-- CPU Overall Banner -->
      <div class="card overall-cpu-banner mb-4">
        <div class="banner-stat">
          <span class="banner-label">Overall CPU Utilization</span>
          <div class="banner-val-row">
            <span class="banner-number" id="cpu-overall-number">0.0%</span>
            <div class="progress-track-banner">
              <div class="progress-fill banner-fill" id="cpu-overall-bar" style="width: 0%;"></div>
            </div>
          </div>
        </div>
        <div class="banner-chart-box">
          <canvas id="cpu-overall-sparkline" height="56"></canvas>
        </div>
      </div>

      <!-- Core Grid -->
      <div class="cores-section-title">
        <h3>Individual Core Utilization</h3>
        <span class="subtext" id="cores-count-label">-- Cores Active</span>
      </div>

      <div class="core-grid" id="core-grid-container">
        <div class="loading-state">Initializing CPU core sensors...</div>
      </div>
    `;

    const overallCanvas = this.container.querySelector('#cpu-overall-sparkline') as HTMLCanvasElement;
    if (overallCanvas) {
      this.overallSparkline = new SparklineChart(overallCanvas, {
        strokeColor: '#0A84FF',
        fillColorStart: 'rgba(10, 132, 255, 0.4)',
        fillColorEnd: 'rgba(10, 132, 255, 0.02)',
        maxVal: 100,
      });
    }
  }

  public update(metrics: SystemMetrics): void {
    const archBrand = this.container.querySelector('#cpu-arch-brand');
    if (archBrand) {
      archBrand.textContent = `${metrics.system_info.cpu_brand} (${metrics.system_info.cpu_arch}) • ${metrics.system_info.physical_core_count} Physical / ${metrics.system_info.total_core_count} Logical Cores`;
    }

    const load1 = this.container.querySelector('#cpu-view-load1');
    const load5 = this.container.querySelector('#cpu-view-load5');
    const load15 = this.container.querySelector('#cpu-view-load15');
    if (load1) load1.textContent = metrics.cpu.load_average[0].toFixed(2);
    if (load5) load5.textContent = metrics.cpu.load_average[1].toFixed(2);
    if (load15) load15.textContent = metrics.cpu.load_average[2].toFixed(2);

    const overallNum = this.container.querySelector('#cpu-overall-number');
    const overallBar = this.container.querySelector('#cpu-overall-bar') as HTMLElement;
    if (overallNum) overallNum.textContent = `${metrics.cpu.global_usage.toFixed(1)}%`;
    if (overallBar) overallBar.style.width = `${Math.min(100, metrics.cpu.global_usage)}%`;
    if (this.overallSparkline) this.overallSparkline.push(metrics.cpu.global_usage);

    const coresCountLabel = this.container.querySelector('#cores-count-label');
    if (coresCountLabel) coresCountLabel.textContent = `${metrics.cpu.cores.length} Cores Live`;

    // Rebuild grid if core count changed or first run
    const grid = this.container.querySelector('#core-grid-container');
    if (!grid) return;

    if (this.renderedCoresCount !== metrics.cpu.cores.length) {
      this.renderedCoresCount = metrics.cpu.cores.length;
      this.coreSparklines.forEach((s) => s.destroy());
      this.coreSparklines.clear();

      grid.innerHTML = metrics.cpu.cores
        .map((core) => {
          return `
            <div class="card core-card" id="core-card-${core.id}">
              <div class="core-card-header">
                <div class="core-id-box">
                  <span class="core-name">${core.name}</span>
                  <span class="core-freq" id="core-freq-${core.id}">${core.frequency_mhz > 0 ? `${core.frequency_mhz} MHz` : 'Dynamic'}</span>
                </div>
                <strong class="core-usage-val" id="core-val-${core.id}">${core.usage.toFixed(1)}%</strong>
              </div>
              <div class="progress-track core-track">
                <div class="progress-fill core-fill" id="core-fill-${core.id}" style="width: ${core.usage}%;"></div>
              </div>
              <div class="core-chart-wrap">
                <canvas id="core-spark-${core.id}" class="core-spark-canvas" height="34"></canvas>
              </div>
            </div>
          `;
        })
        .join('');

      // Create sparklines for each core
      metrics.cpu.cores.forEach((core) => {
        const canvas = this.container.querySelector(`#core-spark-${core.id}`) as HTMLCanvasElement;
        if (canvas) {
          const spark = new SparklineChart(canvas, {
            strokeColor: '#30D158',
            fillColorStart: 'rgba(48, 209, 88, 0.35)',
            fillColorEnd: 'rgba(48, 209, 88, 0.02)',
            maxVal: 100,
            lineWidth: 1.5,
          });
          this.coreSparklines.set(core.id, spark);
        }
      });
    }

    // Update individual cores
    metrics.cpu.cores.forEach((core) => {
      const valEl = this.container.querySelector(`#core-val-${core.id}`);
      const fillEl = this.container.querySelector(`#core-fill-${core.id}`) as HTMLElement;
      const freqEl = this.container.querySelector(`#core-freq-${core.id}`);

      if (valEl) valEl.textContent = `${core.usage.toFixed(1)}%`;
      if (fillEl) {
        fillEl.style.width = `${Math.min(100, core.usage)}%`;
        if (core.usage > 85) {
          fillEl.style.backgroundColor = 'var(--color-red)';
        } else if (core.usage > 65) {
          fillEl.style.backgroundColor = 'var(--color-orange)';
        } else {
          fillEl.style.backgroundColor = 'var(--color-green)';
        }
      }
      if (freqEl && core.frequency_mhz > 0) {
        freqEl.textContent = `${core.frequency_mhz} MHz`;
      }

      const spark = this.coreSparklines.get(core.id);
      if (spark) spark.push(core.usage);
    });
  }

  public resize(): void {
    if (this.overallSparkline) this.overallSparkline.resize();
    this.coreSparklines.forEach((s) => s.resize());
  }
}
