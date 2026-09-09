export interface FocusLinesConfig {
  /** 中心X (0.0 - 1.0, デフォルト 0.5) */
  centerX?: number;
  /** 中心Y (0.0 - 1.0, デフォルト 0.45) */
  centerY?: number;
  /** 線の本数 (デフォルト 75) */
  lineCount?: number;
  /** 中央のクリア領域（顔が見える穴）の半径比率 (0.0 - 1.0, デフォルト 0.22) */
  innerRadiusRatio?: number;
  /** 線の色 (デフォルト 'rgba(15, 23, 42, 0.88)') */
  lineColor?: string;
  /** アニメーションの更新頻度 (ミリ秒, デフォルト 45ms = 約22fps) */
  updateIntervalMs?: number;
}

export class FocusLinesOverlay {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isVisible = false;
  private config: Required<FocusLinesConfig>;
  private animationFrameId: number | null = null;
  private lastUpdateTimestamp = 0;
  private container: HTMLElement;

  constructor(container: HTMLElement = document.body, config?: FocusLinesConfig) {
    this.container = container;
    this.config = {
      centerX: config?.centerX ?? 0.5,
      centerY: config?.centerY ?? 0.45,
      lineCount: config?.lineCount ?? 75,
      innerRadiusRatio: config?.innerRadiusRatio ?? 0.22,
      lineColor: config?.lineColor ?? 'rgba(15, 23, 42, 0.88)',
      updateIntervalMs: config?.updateIntervalMs ?? 45,
    };
  }

  private initCanvas(): void {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'focus-lines-overlay';
    this.canvas.style.position = 'fixed';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '45'; // Above 3D viewer, below dialogue window
    this.canvas.style.opacity = '0';
    this.canvas.style.transition = 'opacity 0.15s ease-out';

    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.resize();

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    if (this.isVisible) {
      this.resize();
    }
  };

  private resize(): void {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
  }

  public show(customConfig?: FocusLinesConfig): void {
    if (customConfig) {
      this.config = {
        ...this.config,
        ...customConfig,
      };
    }

    this.initCanvas();
    if (!this.canvas || !this.ctx) return;

    this.resize();
    this.isVisible = true;
    this.canvas.style.opacity = '1';
    this.lastUpdateTimestamp = 0;

    if (!this.animationFrameId) {
      this.loop(performance.now());
    }
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    if (this.canvas) {
      this.canvas.style.opacity = '0';
      setTimeout(() => {
        if (!this.isVisible && this.ctx && this.canvas) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
      }, 150);
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (timestamp: number): void => {
    if (!this.isVisible) return;

    if (timestamp - this.lastUpdateTimestamp >= this.config.updateIntervalMs) {
      this.renderLines();
      this.lastUpdateTimestamp = timestamp;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * 放射状集中線を画面中央に向かって描画
   */
  private renderLines(): void {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w * this.config.centerX;
    const cy = h * this.config.centerY;
    const maxRadius = Math.sqrt(w * w + h * h) * 0.75;
    const minRadius = Math.min(w, h) * this.config.innerRadiusRatio;

    const count = this.config.lineCount;
    const baseAngleStep = (Math.PI * 2) / count;

    ctx.fillStyle = this.config.lineColor;

    for (let i = 0; i < count; i++) {
      // 少しランダムに間引いて線の濃淡・リズムを作る
      if (Math.random() < 0.12) continue;

      const baseAngle = i * baseAngleStep;
      // 角度の微小な揺らぎ
      const angleJitter = (Math.random() - 0.5) * baseAngleStep * 0.6;
      const angle = baseAngle + angleJitter;

      // 線の太さ（楔形底辺の幅）
      const angularWidth = baseAngleStep * (0.35 + Math.random() * 0.75);

      // 線の先端（中心側）の到達距離（ランダムに内側に入り込む）
      const innerReach = minRadius * (0.75 + Math.random() * 0.55);

      // 楔形ポリゴン（外側の2点から中心側の1点へ向かう尖った三角形）
      const a1 = angle - angularWidth * 0.5;
      const a2 = angle + angularWidth * 0.5;

      const xOuter1 = cx + Math.cos(a1) * maxRadius;
      const yOuter1 = cy + Math.sin(a1) * maxRadius;

      const xOuter2 = cx + Math.cos(a2) * maxRadius;
      const yOuter2 = cy + Math.sin(a2) * maxRadius;

      const xInner = cx + Math.cos(angle) * innerReach;
      const yInner = cy + Math.sin(angle) * innerReach;

      ctx.beginPath();
      ctx.moveTo(xOuter1, yOuter1);
      ctx.lineTo(xOuter2, yOuter2);
      ctx.lineTo(xInner, yInner);
      ctx.closePath();
      ctx.fill();
    }
  }

  public dispose(): void {
    this.hide();
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
