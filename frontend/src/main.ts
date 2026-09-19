import { SysmonClient } from './api';
import { CpuViewComponent } from './components/cpu_view';
import { DashboardComponent } from './components/dashboard';
import { DisksViewComponent } from './components/disks_view';
import { MemoryViewComponent } from './components/memory_view';
import { NavbarComponent } from './components/navbar';
import { ProcessManagerComponent } from './components/process_manager';
import { TabId } from './types';

class MacSysmonApp {
  private client: SysmonClient;
  private navbar: NavbarComponent;
  private dashboard: DashboardComponent;
  private cpuView: CpuViewComponent;
  private memoryView: MemoryViewComponent;
  private disksView: DisksViewComponent;
  private processManager: ProcessManagerComponent;
  private currentTab: TabId = 'overview';
  private latestMetrics: SystemMetrics | null = null;

  constructor() {
    this.client = new SysmonClient();

    // Containers
    const navEl = document.getElementById('navbar-container')!;
    const overviewEl = document.getElementById('tab-overview')!;
    const cpuEl = document.getElementById('tab-cpu')!;
    const memoryEl = document.getElementById('tab-memory')!;
    const disksEl = document.getElementById('tab-disks')!;
    const processesEl = document.getElementById('tab-processes')!;

    // Jump callback to inspect process from any view
    const jumpToProcess = (pid: number) => {
      this.switchTab('processes');
      this.processManager.selectAndInspect(pid);
    };

    // Initialize components
    this.navbar = new NavbarComponent(navEl, (tab) => this.switchTab(tab));
    this.dashboard = new DashboardComponent(overviewEl, jumpToProcess);
    this.cpuView = new CpuViewComponent(cpuEl);
    this.memoryView = new MemoryViewComponent(memoryEl, jumpToProcess);
    this.disksView = new DisksViewComponent(disksEl, jumpToProcess);
    this.processManager = new ProcessManagerComponent(processesEl, this.client);

    this.setupEvents();
    this.setupKeybindings();
  }

  private setupEvents(): void {
    // Client connection state listener
    this.client.onStateChange((state) => {
      this.navbar.updateConnectionState(state);
    });

    // Real-time metrics streaming
    this.client.onMetrics((metrics) => {
      this.latestMetrics = metrics;

      try {
        this.navbar.updateSystemInfo(metrics.system_info);
      } catch (e) {
        console.error('Failed to update navbar:', e);
      }

      // Update all views so data and history are always continuous
      try {
        this.dashboard.update(metrics);
      } catch (e) {
        console.error('Failed to update dashboard:', e);
      }

      try {
        this.processManager.updateProcesses(metrics.processes);
      } catch (e) {
        console.error('Failed to update process manager:', e);
      }

      try {
        this.cpuView.update(metrics);
      } catch (e) {
        console.error('Failed to update CPU view:', e);
      }

      try {
        this.memoryView.update(metrics);
      } catch (e) {
        console.error('Failed to update memory view:', e);
      }

      try {
        this.disksView.update(metrics);
      } catch (e) {
        console.error('Failed to update disks view:', e);
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.dashboard.resize();
      this.cpuView.resize();
      this.memoryView.resize();
      this.disksView.resize();
    });
  }

  private setupKeybindings(): void {
    window.addEventListener('keydown', (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      switch (e.key) {
        case '1':
          e.preventDefault();
          this.switchTab('overview');
          break;
        case '2':
          e.preventDefault();
          this.switchTab('cpu');
          break;
        case '3':
          e.preventDefault();
          this.switchTab('memory');
          break;
        case '4':
          e.preventDefault();
          this.switchTab('disks');
          break;
        case '5':
          e.preventDefault();
          this.switchTab('processes');
          break;
        case 'f':
          e.preventDefault();
          this.switchTab('processes');
          this.processManager.focusSearch();
          break;
      }
    });
  }

  public switchTab(tab: TabId): void {
    this.currentTab = tab;
    this.navbar.setTab(tab);

    const tabs: TabId[] = ['overview', 'cpu', 'memory', 'disks', 'processes'];
    tabs.forEach((t) => {
      const el = document.getElementById(`tab-${t}`);
      if (el) {
        el.style.display = (t === tab) ? 'block' : 'none';
      }
    });

    // If we have cached metrics, immediately render this tab!
    if (this.latestMetrics) {
      try {
        if (tab === 'overview') this.dashboard.update(this.latestMetrics);
        else if (tab === 'cpu') this.cpuView.update(this.latestMetrics);
        else if (tab === 'memory') this.memoryView.update(this.latestMetrics);
        else if (tab === 'disks') this.disksView.update(this.latestMetrics);
        else if (tab === 'processes') this.processManager.updateProcesses(this.latestMetrics.processes);
      } catch (e) {
        console.error(`Failed to refresh tab ${tab} on switch:`, e);
      }
    }

    // Trigger chart resize on tab reveal once DOM layout updates
    setTimeout(() => {
      try {
        if (tab === 'overview') this.dashboard.resize();
        else if (tab === 'cpu') this.cpuView.resize();
        else if (tab === 'memory') this.memoryView.resize();
        else if (tab === 'disks') this.disksView.resize();
      } catch (e) {
        console.error(`Failed to resize tab ${tab}:`, e);
      }
    }, 40);
  }
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MacSysmonApp();
  });
} else {
  new MacSysmonApp();
}
