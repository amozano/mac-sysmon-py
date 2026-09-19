export interface SparklineOptions {
  strokeColor?: string;
  fillColorStart?: string;
  fillColorEnd?: string;
  maxPoints?: number;
  minVal?: number;
  maxVal?: number;
  lineWidth?: number;
  showPoints?: boolean;
}

export class SparklineChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: number[] = [];
  private options: Required<SparklineOptions>;
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, options: SparklineOptions = {}) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not supported');
    }
    this.ctx = context;

    this.options = {
      strokeColor: options.strokeColor || '#0A84FF',
      fillColorStart: options.fillColorStart || 'rgba(10, 132, 255, 0.35)',
      fillColorEnd: options.fillColorEnd || 'rgba(10, 132, 255, 0.02)',
      maxPoints: options.maxPoints || 60,
      minVal: options.minVal ?? 0,
      maxVal: options.maxVal ?? 100,
      lineWidth: options.lineWidth || 2,
      showPoints: options.showPoints ?? false,
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }

  public push(value: number): void {
    this.data.push(value);
    if (this.data.length > this.options.maxPoints) {
      this.data.shift();
    }
    this.render();
  }

  public setData(values: number[]): void {
    this.data = values.slice(-this.options.maxPoints);
    this.render();
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  public render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width <= 0 || height <= 0) return;

    this.ctx.clearRect(0, 0, width, height);
    if (this.data.length < 2) return;

    const min = this.options.minVal;
    let max = this.options.maxVal;
    // Auto-scale if maxVal is not fixed or data exceeds it
    if (this.options.maxVal === 0 || Math.max(...this.data) > max) {
      max = Math.max(...this.data, 1);
    }
    const range = max - min || 1;

    const step = width / (this.options.maxPoints - 1);
    const startX = width - (this.data.length - 1) * step;

    // Build path
    const points: [number, number][] = this.data.map((val, i) => {
      const x = startX + i * step;
      const normalized = Math.max(0, Math.min(1, (val - min) / range));
      const y = height - normalized * (height - 6) - 3;
      return [x, y];
    });

    // Draw area fill
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], height);
    for (const [x, y] of points) {
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(points[points.length - 1][0], height);
    this.ctx.closePath();

    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, this.options.fillColorStart);
    gradient.addColorStop(1, this.options.fillColorEnd);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i][0], points[i][1]);
    }
    this.ctx.strokeStyle = this.options.strokeColor;
    this.ctx.lineWidth = this.options.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();

    // Draw end pulsing point
    const lastPoint = points[points.length - 1];
    this.ctx.beginPath();
    this.ctx.arc(lastPoint[0], lastPoint[1], 3.5, 0, Math.PI * 2);
    this.ctx.fillStyle = this.options.strokeColor;
    this.ctx.fill();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }

  public destroy(): void {
    this.resizeObserver.disconnect();
  }
}

export class CircularGauge {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private percentage: number = 0;
  private color: string;
  private label: string;

  constructor(canvas: HTMLCanvasElement, label: string = '', color: string = '#0A84FF') {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
    this.label = label;
    this.color = color;
    this.resize();
  }

  public setPercentage(val: number): void {
    this.percentage = Math.max(0, Math.min(100, val));
    this.render();
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  public render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) / 2 - 10;
    if (radius <= 0) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    const totalSweep = endAngle - startAngle;

    // Background track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active progress arc
    const currentAngle = startAngle + (this.percentage / 100) * totalSweep;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, currentAngle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center percentage text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 ${Math.floor(radius * 0.48)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
    ctx.fillText(`${this.percentage.toFixed(1)}%`, centerX, centerY - 4);

    // Bottom label text
    if (this.label) {
      ctx.font = `500 ${Math.floor(radius * 0.22)}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(this.label, centerX, centerY + radius * 0.35);
    }
  }
}
