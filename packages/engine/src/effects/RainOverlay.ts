/**
 * 画面に重ねる雨（2D の斜めの筋）。場所によらずどこでも降らせられる
 */
export class RainOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private drops: { x: number; y: number; length: number; speed: number; alpha: number }[] = [];
  private frame: number | null = null;
  private lastTime = 0;
  private active = false;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '10', opacity: '0', transition: 'opacity 0.6s ease' });
    parent.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');
  }

  public set(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.canvas.style.opacity = active ? '1' : '0';
    if (active && this.frame === null) {
      this.resize();
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    // 画面の広さに合わせた粒の数
    const count = Math.round((rect.width * rect.height) / 2600);
    this.drops = Array.from({ length: Math.min(count, 900) }, () => this.newDrop(true));
  }

  private newDrop(anywhere: boolean) {
    const { width, height } = this.canvas;
    const scale = height / 900;
    return {
      x: Math.random() * width * 1.2,
      y: anywhere ? Math.random() * height : -Math.random() * height * 0.2,
      length: (18 + Math.random() * 26) * scale,
      speed: (1300 + Math.random() * 900) * scale,
      alpha: 0.18 + Math.random() * 0.3,
    };
  }

  private tick = (time: number): void => {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const ctx = this.context;
    if (ctx) {
      const { width, height } = this.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = Math.max(1, height / 700);
      ctx.lineCap = 'round';
      // 少し左へ流れる斜めの雨
      const slant = 0.22;
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        d.y += d.speed * dt;
        d.x -= d.speed * slant * dt;
        if (d.y - d.length > height || d.x < -40) this.drops[i] = this.newDrop(false);
        ctx.strokeStyle = `rgba(220, 230, 245, ${d.alpha})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.length * slant, d.y - d.length);
        ctx.stroke();
      }
    }
    // 消えきったら止める
    if (!this.active && getComputedStyle(this.canvas).opacity === '0') {
      this.frame = null;
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  public dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.canvas.remove();
  }
}
