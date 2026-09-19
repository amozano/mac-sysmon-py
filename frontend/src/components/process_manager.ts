import { SysmonClient } from '../api';
import { ProcessDetail, ProcessMetrics, ProcessSortField, SortOrder } from '../types';
import { escapeHtml, formatBytes, formatPercent, formatRate } from '../utils';

export class ProcessManagerComponent {
  private container: HTMLElement;
  private client: SysmonClient;
  private processes: ProcessMetrics[] = [];
  private searchQuery = '';
  private filterAppsOnly = false;
  private sortField: ProcessSortField = 'cpu_usage';
  private sortOrder: SortOrder = 'desc';
  private selectedPid: number | null = null;
  private modalContainer: HTMLElement | null = null;

  constructor(container: HTMLElement, client: SysmonClient) {
    this.container = container;
    this.client = client;
    this.renderSkeleton();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2>Process & Application Manager</h2>
          <p class="view-subtitle" id="proc-summary-subtitle">Live Process Monitor</p>
        </div>
        <div class="proc-actions-bar">
          <div class="search-box-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              id="proc-search-input"
              class="search-input"
              placeholder="Filter processes by name or PID... (⌘F)"
              autocomplete="off"
              spellcheck="false"
            />
            <button id="clear-search-btn" class="clear-search-btn" style="display: none;">✕</button>
          </div>

          <div class="filter-toggle-group">
            <label class="toggle-pill">
              <input type="checkbox" id="toggle-apps-only" />
              <span>Apps Only</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Process Table Card -->
      <div class="card table-card mt-3">
        <div class="table-responsive">
          <table class="data-table proc-table" id="process-table">
            <thead>
              <tr>
                <th data-sort="pid" class="sortable">PID <span class="sort-indicator"></span></th>
                <th data-sort="name" class="sortable">Application / Process Name <span class="sort-indicator"></span></th>
                <th data-sort="cpu_usage" class="sortable active desc">CPU % <span class="sort-indicator">▼</span></th>
                <th data-sort="memory_bytes" class="sortable">RAM (RSS) <span class="sort-indicator"></span></th>
                <th>RAM Share</th>
                <th data-sort="disk_read" class="sortable">Disk Read <span class="sort-indicator"></span></th>
                <th data-sort="disk_write" class="sortable">Disk Write <span class="sort-indicator"></span></th>
                <th data-sort="user" class="sortable">User <span class="sort-indicator"></span></th>
                <th data-sort="status" class="sortable">Status <span class="sort-indicator"></span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="proc-table-tbody">
              <tr><td colspan="10" class="loading-state">Populating process table...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span id="proc-count-display">Showing 0 processes</span>
          <span class="subtext">Click any header to sort • Click row to inspect</span>
        </div>
      </div>

      <!-- Modal Container -->
      <div id="proc-modal-host"></div>
    `;

    // Bind Search Input
    const searchInput = this.container.querySelector('#proc-search-input') as HTMLInputElement;
    const clearBtn = this.container.querySelector('#clear-search-btn') as HTMLButtonElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.style.display = this.searchQuery ? 'block' : 'none';
        }
        this.renderTableBody();
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
        this.renderTableBody();
      });
    }

    // Bind Apps Only Toggle
    const appsToggle = this.container.querySelector('#toggle-apps-only') as HTMLInputElement;
    if (appsToggle) {
      appsToggle.addEventListener('change', () => {
        this.filterAppsOnly = appsToggle.checked;
        this.renderTableBody();
      });
    }

    // Bind Sort Headers
    const headers = this.container.querySelectorAll<HTMLTableCellElement>('th.sortable');
    headers.forEach((th) => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort') as ProcessSortField;
        if (!field) return;

        if (this.sortField === field) {
          this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = field;
          this.sortOrder = field === 'name' || field === 'user' || field === 'pid' ? 'asc' : 'desc';
        }

        // Update indicators
        headers.forEach((h) => {
          h.classList.remove('active', 'asc', 'desc');
          const ind = h.querySelector('.sort-indicator');
          if (ind) ind.textContent = '';
        });

        th.classList.add('active', this.sortOrder);
        const ind = th.querySelector('.sort-indicator');
        if (ind) ind.textContent = this.sortOrder === 'asc' ? '▲' : '▼';

        this.renderTableBody();
      });
    });

    this.modalContainer = this.container.querySelector('#proc-modal-host');
  }

  public updateProcesses(processes: ProcessMetrics[]): void {
    this.processes = processes;
    this.renderTableBody();

    const subtitle = this.container.querySelector('#proc-summary-subtitle');
    if (subtitle) {
      const appCount = processes.filter((p) => p.is_app).length;
      subtitle.textContent = `${processes.length} Total Processes • ${appCount} User Applications Active`;
    }
  }

  public focusSearch(): void {
    const searchInput = this.container.querySelector('#proc-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  public selectAndInspect(pid: number): void {
    this.selectedPid = pid;
    this.openInspectModal(pid);
  }

  private renderTableBody(): void {
    const tbody = this.container.querySelector('#proc-table-tbody');
    if (!tbody) return;

    let filtered = this.processes;

    // Filter by Apps Only
    if (this.filterAppsOnly) {
      filtered = filtered.filter((p) => p.is_app);
    }

    // Filter by Search
    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter(
        (p) =>
          p.pid.toString().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.app_name && p.app_name.toLowerCase().includes(q)) ||
          (p.user_name && p.user_name.toLowerCase().includes(q)) ||
          (p.exe_path && p.exe_path.toLowerCase().includes(q))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (this.sortField) {
        case 'pid':
          valA = a.pid;
          valB = b.pid;
          break;
        case 'name':
          valA = (a.app_name || a.name).toLowerCase();
          valB = (b.app_name || b.name).toLowerCase();
          break;
        case 'cpu_usage':
          valA = a.cpu_usage;
          valB = b.cpu_usage;
          break;
        case 'memory_bytes':
          valA = a.memory_bytes;
          valB = b.memory_bytes;
          break;
        case 'disk_read':
          valA = a.disk_read_bytes_per_sec;
          valB = b.disk_read_bytes_per_sec;
          break;
        case 'disk_write':
          valA = a.disk_written_bytes_per_sec;
          valB = b.disk_written_bytes_per_sec;
          break;
        case 'user':
          valA = (a.user_name || '').toLowerCase();
          valB = (b.user_name || '').toLowerCase();
          break;
        case 'status':
          valA = a.status.toLowerCase();
          valB = b.status.toLowerCase();
          break;
        default:
          valA = a.cpu_usage;
          valB = b.cpu_usage;
      }

      if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const countDisplay = this.container.querySelector('#proc-count-display');
    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length} of ${this.processes.length} processes`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state">
            No processes match "${escapeHtml(this.searchQuery)}"
          </td>
        </tr>
      `;
      return;
    }

    // Render rows
    tbody.innerHTML = filtered
      .map((p) => {
        const displayName = p.app_name || p.name;
        const isChromeOrApp = p.is_app;
        const appBadge = isChromeOrApp ? '<span class="badge-app">APP</span>' : '';
        const cpuHighlight = p.cpu_usage > 50 ? 'text-red font-bold' : p.cpu_usage > 15 ? 'text-orange font-bold' : '';

        return `
          <tr class="proc-table-row ${this.selectedPid === p.pid ? 'selected' : ''}" data-pid="${p.pid}">
            <td class="font-mono text-muted">${p.pid}</td>
            <td>
              <div class="proc-name-cell">
                <span class="proc-icon">${isChromeOrApp ? '📦' : '⚙️'}</span>
                <span class="proc-name-title" title="${escapeHtml(p.exe_path || p.name)}">${escapeHtml(displayName)}</span>
                ${appBadge}
              </div>
            </td>
            <td class="font-mono ${cpuHighlight}">${p.cpu_usage.toFixed(1)}%</td>
            <td class="font-mono font-bold">${formatBytes(p.memory_bytes)}</td>
            <td class="font-mono">
              <div class="share-cell">
                <span>${p.memory_percent.toFixed(1)}%</span>
                <div class="mini-bar-track">
                  <div class="mini-bar-fill mem-fill" style="width: ${Math.min(100, p.memory_percent * 4)}%;"></div>
                </div>
              </div>
            </td>
            <td class="font-mono text-blue">${p.disk_read_bytes_per_sec > 0 ? formatRate(p.disk_read_bytes_per_sec) : '-'}</td>
            <td class="font-mono text-orange">${p.disk_written_bytes_per_sec > 0 ? formatRate(p.disk_written_bytes_per_sec) : '-'}</td>
            <td class="text-sub font-mono">${escapeHtml(p.user_name || p.user_id || 'system')}</td>
            <td><span class="status-tag status-${p.status.toLowerCase()}">${p.status}</span></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-secondary btn-xs inspect-action-btn" data-pid="${p.pid}" title="Inspect process details">
                  Inspect
                </button>
                <button class="btn btn-danger btn-xs kill-action-btn" data-pid="${p.pid}" data-name="${escapeHtml(displayName)}" title="Terminate process">
                  End
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    // Attach row inspection handlers
    tbody.querySelectorAll<HTMLButtonElement>('.inspect-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = parseInt(btn.getAttribute('data-pid') || '0', 10);
        if (pid > 0) this.openInspectModal(pid);
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('.kill-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = parseInt(btn.getAttribute('data-pid') || '0', 10);
        const name = btn.getAttribute('data-name') || `PID ${pid}`;
        if (pid > 0) this.promptKillConfirmation(pid, name);
      });
    });

    tbody.querySelectorAll<HTMLTableRowElement>('.proc-table-row').forEach((row) => {
      row.addEventListener('click', () => {
        const pid = parseInt(row.getAttribute('data-pid') || '0', 10);
        if (pid > 0) this.openInspectModal(pid);
      });
    });
  }

  private async openInspectModal(pid: number): Promise<void> {
    if (!this.modalContainer) return;

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Inspect Process (PID ${pid})</h3>
            <button class="modal-close-btn" id="modal-close-x">✕</button>
          </div>
          <div class="modal-body" id="modal-content-body">
            <div class="loading-state">Retrieving kernel process inspection data...</div>
          </div>
        </div>
      </div>
    `;

    this.bindModalClose();

    try {
      const detail = await this.client.getProcessDetail(pid);
      const content = this.modalContainer.querySelector('#modal-content-body');
      if (!content) return;

      const p = detail.process;
      const cmdStr = p.cmd && p.cmd.length > 0 ? p.cmd.join(' ') : (p.exe_path || p.name);

      content.innerHTML = `
        <div class="modal-inspect-grid">
          <div class="inspect-field">
            <span class="field-label">Process Name</span>
            <span class="field-val"><strong>${escapeHtml(p.app_name || p.name)}</strong></span>
          </div>
          <div class="inspect-field">
            <span class="field-label">PID / Parent PID</span>
            <span class="field-val font-mono">PID: ${p.pid} • PPID: ${detail.parent_pid ?? 'None (root/daemon)'}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">User / UID</span>
            <span class="field-val font-mono">${escapeHtml(p.user_name || 'unknown')} (${p.user_id || '0'})</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Status</span>
            <span class="field-val"><span class="status-tag status-${p.status.toLowerCase()}">${p.status}</span></span>
          </div>
          <div class="inspect-field">
            <span class="field-label">CPU Usage</span>
            <span class="field-val font-mono">${p.cpu_usage.toFixed(1)}%</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Memory (RSS / Virt)</span>
            <span class="field-val font-mono">${formatBytes(p.memory_bytes)} (${p.memory_percent.toFixed(1)}%) • Virt: ${formatBytes(p.virtual_memory_bytes)}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Disk I/O</span>
            <span class="field-val font-mono">Read: ${formatRate(p.disk_read_bytes_per_sec)} • Write: ${formatRate(p.disk_written_bytes_per_sec)}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Executable Path</span>
            <span class="field-val font-mono text-break">${escapeHtml(p.exe_path || 'Unknown')}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Current Working Directory</span>
            <span class="field-val font-mono text-break">${escapeHtml(detail.cwd || 'N/A')}</span>
          </div>
          <div class="inspect-field full-width">
            <span class="field-label">Full Command Line</span>
            <pre class="code-box">${escapeHtml(cmdStr)}</pre>
          </div>
        </div>

        <div class="modal-footer mt-4">
          <div class="kill-btn-group">
            <button class="btn btn-secondary btn-sm" id="btn-term-sig">Send SIGTERM (Graceful End)</button>
            <button class="btn btn-danger btn-sm" id="btn-kill-sig">Send SIGKILL (Force Quit)</button>
          </div>
          <button class="btn btn-primary btn-sm" id="modal-done-btn">Done</button>
        </div>
      `;

      // Attach Terminate Buttons
      const termBtn = content.querySelector('#btn-term-sig');
      const killBtn = content.querySelector('#btn-kill-sig');
      const doneBtn = content.querySelector('#modal-done-btn');

      if (termBtn) {
        termBtn.addEventListener('click', () => this.sendSignal(pid, 'SIGTERM'));
      }
      if (killBtn) {
        killBtn.addEventListener('click', () => this.sendSignal(pid, 'SIGKILL'));
      }
      if (doneBtn) {
        doneBtn.addEventListener('click', () => this.closeModal());
      }
    } catch (err: any) {
      const content = this.modalContainer.querySelector('#modal-content-body');
      if (content) {
        content.innerHTML = `
          <div class="error-banner">
            <p>Failed to retrieve process details: ${escapeHtml(err.message || String(err))}</p>
            <p class="subtext">The process may have already exited.</p>
          </div>
          <div class="modal-footer mt-4">
            <button class="btn btn-secondary btn-sm" id="modal-done-btn">Close</button>
          </div>
        `;
        const doneBtn = content.querySelector('#modal-done-btn');
        if (doneBtn) doneBtn.addEventListener('click', () => this.closeModal());
      }
    }
  }

  private promptKillConfirmation(pid: number, name: string): void {
    if (!this.modalContainer) return;

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card modal-confirm">
          <div class="modal-header">
            <h3>Terminate Process?</h3>
            <button class="modal-close-btn" id="modal-close-x">✕</button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to terminate <strong>${escapeHtml(name)}</strong> (PID <code>${pid}</code>)?</p>
            <p class="text-sub mt-2">Choose termination signal level:</p>
            <div class="signal-options mt-3">
              <label class="radio-pill">
                <input type="radio" name="kill_sig" value="SIGTERM" checked />
                <span>SIGTERM (15) - Clean Graceful Shutdown</span>
              </label>
              <label class="radio-pill">
                <input type="radio" name="kill_sig" value="SIGKILL" />
                <span>SIGKILL (9) - Immediate Force Termination</span>
              </label>
            </div>
            <div id="kill-feedback-banner" class="mt-3"></div>
          </div>
          <div class="modal-footer mt-4">
            <button class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-danger btn-sm" id="modal-confirm-kill-btn">Terminate Process</button>
          </div>
        </div>
      </div>
    `;

    this.bindModalClose();

    const cancelBtn = this.modalContainer.querySelector('#modal-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

    const confirmBtn = this.modalContainer.querySelector('#modal-confirm-kill-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const checkedSig = this.modalContainer?.querySelector('input[name="kill_sig"]:checked') as HTMLInputElement;
        const sig = (checkedSig?.value as 'SIGTERM' | 'SIGKILL') || 'SIGTERM';
        await this.sendSignal(pid, sig);
      });
    }
  }

  private async sendSignal(pid: number, signal: 'SIGTERM' | 'SIGKILL'): Promise<void> {
    const banner = this.modalContainer?.querySelector('#kill-feedback-banner');
    try {
      const res = await this.client.killProcess(pid, signal);
      if (res.success) {
        if (banner) {
          banner.innerHTML = `<div class="success-banner">✓ ${escapeHtml(res.message)}</div>`;
        }
        setTimeout(() => this.closeModal(), 1200);
      } else {
        if (banner) {
          banner.innerHTML = `<div class="error-banner">✗ ${escapeHtml(res.message)}</div>`;
        }
      }
    } catch (err: any) {
      if (banner) {
        banner.innerHTML = `<div class="error-banner">✗ Failed to send signal: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  private bindModalClose(): void {
    const closeBtn = this.modalContainer?.querySelector('#modal-close-x');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

    const backdrop = this.modalContainer?.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeModal();
      });
    }
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.innerHTML = '';
    }
  }
}
