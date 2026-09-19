export interface SystemMetrics {
  timestamp: number;
  system_info: SystemInfo;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskMetrics[];
  disk_io: DiskIoSummary;
  network: NetworkMetrics;
  processes: ProcessMetrics[];
}

export interface SystemInfo {
  hostname: string;
  os_name: string;
  os_version: string;
  kernel_version: string;
  uptime_secs: number;
  cpu_arch: string;
  cpu_brand: string;
  physical_core_count: number;
  total_core_count: number;
}

export interface CpuMetrics {
  global_usage: number;
  load_average: [number, number, number]; // 1m, 5m, 15m
  cores: CpuCoreMetrics[];
}

export interface CpuCoreMetrics {
  id: number;
  name: string;
  usage: number;
  frequency_mhz: number;
}

export interface MemoryMetrics {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  available_bytes: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
  swap_free_bytes: number;
  usage_percent: number;
}

export interface DiskMetrics {
  name: string;
  mount_point: string;
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  usage_percent: number;
  file_system: string;
  is_removable: boolean;
  kind: string;
}

export interface DiskIoSummary {
  read_bytes_per_sec: number;
  written_bytes_per_sec: number;
  total_read_bytes: number;
  total_written_bytes: number;
}

export interface NetworkMetrics {
  received_bytes_per_sec: number;
  transmitted_bytes_per_sec: number;
  total_received_bytes: number;
  total_transmitted_bytes: number;
  interfaces: NetworkInterfaceMetrics[];
}

export interface NetworkInterfaceMetrics {
  name: string;
  received_bytes_per_sec: number;
  transmitted_bytes_per_sec: number;
  total_received_bytes: number;
  total_transmitted_bytes: number;
}

export interface ProcessMetrics {
  pid: number;
  name: string;
  app_name?: string | null;
  exe_path?: string | null;
  cmd: string[];
  cpu_usage: number;
  memory_bytes: number;
  memory_percent: number;
  virtual_memory_bytes: number;
  disk_read_bytes_per_sec: number;
  disk_written_bytes_per_sec: number;
  total_read_bytes: number;
  total_written_bytes: number;
  status: string;
  user_id?: string | null;
  user_name?: string | null;
  start_time: number;
  run_time: number;
  is_app: boolean;
}

export interface ProcessDetail {
  process: ProcessMetrics;
  parent_pid?: number | null;
  cwd?: string | null;
  root?: string | null;
  environ: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export type TabId = 'overview' | 'cpu' | 'memory' | 'disks' | 'processes';

export type ProcessSortField =
  | 'pid'
  | 'name'
  | 'cpu_usage'
  | 'memory_bytes'
  | 'disk_read'
  | 'disk_write'
  | 'status'
  | 'user';

export type SortOrder = 'asc' | 'desc';
