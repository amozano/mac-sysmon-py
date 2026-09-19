import { ApiResponse, ProcessDetail, SystemMetrics } from './types';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
export type MetricsListener = (metrics: SystemMetrics) => void;
export type StateListener = (state: ConnectionState) => void;

export class SysmonClient {
  private ws: WebSocket | null = null;
  private metricsListeners: Set<MetricsListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private isExplicitlyClosed = false;

  constructor() {
    this.fetchInitialSnapshot();
    this.connect();
  }

  private async fetchInitialSnapshot(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      this.notifyMetrics(metrics);
    } catch (e) {
      console.warn('Initial REST snapshot fetch skipped or failed:', e);
    }
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState('connected');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        let metrics: SystemMetrics;
        try {
          metrics = JSON.parse(event.data);
        } catch (e) {
          console.error('Failed to parse WebSocket JSON payload:', e);
          return;
        }

        try {
          this.notifyMetrics(metrics);
        } catch (e) {
          console.error('Error in notifyMetrics handler:', e);
        }
      };

      this.ws.onerror = (event: Event) => {
        console.warn('WebSocket encountered error:', event);
        this.setState('error');
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.scheduleReconnect();
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectTimer !== null) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      for (const listener of this.stateListeners) {
        listener(state);
      }
    }
  }

  public onMetrics(listener: MetricsListener): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private notifyMetrics(metrics: SystemMetrics): void {
    for (const listener of this.metricsListeners) {
      try {
        listener(metrics);
      } catch (e) {
        console.error('Error executing metrics listener:', e);
      }
    }
  }

  // REST API Methods
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const res = await fetch('/api/system');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const json: ApiResponse<SystemMetrics> = await res.json();
    if (!json.data) throw new Error(json.message || 'No data received');
    return json.data;
  }

  public async getProcessDetail(pid: number): Promise<ProcessDetail> {
    const res = await fetch(`/api/processes/${pid}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const json: ApiResponse<ProcessDetail> = await res.json();
    if (!json.data) throw new Error(json.message || 'Process detail not found');
    return json.data;
  }

  public async killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): Promise<ApiResponse> {
    const res = await fetch(`/api/processes/${pid}/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal }),
    });
    return await res.json();
  }
}
