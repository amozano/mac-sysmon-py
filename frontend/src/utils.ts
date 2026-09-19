export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.max(0, Math.min(i, sizes.length - 1));
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

export function formatRate(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) return '0 B/s';
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

export function formatPercent(val: number, decimals: number = 1): string {
  if (typeof val !== 'number' || !isFinite(val)) return '0.0%';
  return `${val.toFixed(decimals)}%`;
}

export function formatUptime(uptimeSecs: number): string {
  if (!uptimeSecs || uptimeSecs <= 0 || !isFinite(uptimeSecs)) return '0m';
  const days = Math.floor(uptimeSecs / 86400);
  const hours = Math.floor((uptimeSecs % 86400) / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

