import { ConnectionState } from '../api';
import { SystemInfo, TabId } from '../types';
import { formatUptime } from '../utils';

export class NavbarComponent {
  private container: HTMLElement;
  private onTabSelect: (tab: TabId) => void;
  private currentTab: TabId = 'overview';

  constructor(container: HTMLElement, onTabSelect: (tab: TabId) => void) {
    this.container = container;
    this.onTabSelect = onTabSelect;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <header class="app-header">
        <div class="header-left">
          <div class="window-controls">
            <span class="control-dot close"></span>
            <span class="control-dot minimize"></span>
            <span class="control-dot zoom"></span>
          </div>
          <div class="app-branding">
            <div class="app-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <div class="app-title-group">
              <span class="app-name">mac-sysmon</span>
              <span class="app-version">v0.1.0</span>
            </div>
          </div>
          <div class="sys-badge-group" id="sys-info-pills">
            <span class="sys-pill" id="pill-host">Host: --</span>
            <span class="sys-pill" id="pill-os">macOS --</span>
            <span class="sys-pill" id="pill-uptime">Uptime: --</span>
          </div>
        </div>

        <nav class="header-center">
          <div class="segmented-control">
            <button class="segment-btn active" data-tab="overview">
              <span class="icon">📊</span>
              <span>Overview</span>
              <span class="kbd-hint">⌘1</span>
            </button>
            <button class="segment-btn" data-tab="cpu">
              <span class="icon">⚡</span>
              <span>CPU Cores</span>
              <span class="kbd-hint">⌘2</span>
            </button>
            <button class="segment-btn" data-tab="memory">
              <span class="icon">🧠</span>
              <span>Memory</span>
              <span class="kbd-hint">⌘3</span>
            </button>
            <button class="segment-btn" data-tab="disks">
              <span class="icon">💾</span>
              <span>Storage</span>
              <span class="kbd-hint">⌘4</span>
            </button>
            <button class="segment-btn" data-tab="processes">
              <span class="icon">⚙️</span>
              <span>Processes</span>
              <span class="kbd-hint">⌘5</span>
            </button>
          </div>
        </nav>

        <div class="header-right">
          <div class="connection-status-badge" id="conn-badge">
            <span class="status-indicator-dot connecting"></span>
            <span class="status-label" id="conn-label">Connecting</span>
          </div>
        </div>
      </header>
    `;

    // Attach tab click events
    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.segment-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as TabId;
        if (tab) {
          this.setTab(tab);
        }
      });
    });
  }

  public setTab(tab: TabId): void {
    if (this.currentTab === tab) return;
    this.currentTab = tab;

    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.segment-btn');
    buttons.forEach((btn) => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.onTabSelect(tab);
  }

  public updateSystemInfo(info: SystemInfo): void {
    const hostEl = this.container.querySelector('#pill-host');
    const osEl = this.container.querySelector('#pill-os');
    const uptimeEl = this.container.querySelector('#pill-uptime');

    if (hostEl) hostEl.textContent = info.hostname;
    if (osEl) osEl.textContent = `${info.os_name} ${info.os_version}`;
    if (uptimeEl) uptimeEl.textContent = `Up: ${formatUptime(info.uptime_secs)}`;
  }

  public updateConnectionState(state: ConnectionState): void {
    const badge = this.container.querySelector('#conn-badge');
    const dot = this.container.querySelector('.status-indicator-dot');
    const label = this.container.querySelector('#conn-label');

    if (!badge || !dot || !label) return;

    dot.className = `status-indicator-dot ${state}`;

    switch (state) {
      case 'connected':
        label.textContent = 'LIVE (1Hz)';
        break;
      case 'connecting':
        label.textContent = 'Connecting...';
        break;
      case 'disconnected':
        label.textContent = 'Disconnected';
        break;
      case 'error':
        label.textContent = 'Error';
        break;
    }
  }
}
