/**
 * 画面に重ねる雨。場所によらずどこでも降らせられる
 *
 * - 斜めの雨の筋: 遠・中・近の3層。近いほど太く長く速く、遠いほど細く短く薄い（速さと太さで奥行きを出す）
 */

/** 雨の層。speed は画面の高さ（900px 換算）あたりの px/秒 */
const LAYERS = [
  { share: 0.5, length: [18, 30], speed: [2600, 3200], width: 0.8, alpha: 0.3 },
  { share: 0.35, length: [32, 52], speed: [3600, 4400], width: 1.2, alpha: 0.44 },
  { share: 0.15, length: [60, 100], speed: [5200, 6400], width: 2.0, alpha: 0.58 },
] as const;
/** 画面 1500px² あたりの雨粒の数と上限 */
const DROP_AREA = 800;
const MAX_DROPS = 2400;
/** 少し左へ流れる斜めの雨（横 / 縦） */
const SLANT = 0.22;

interface Streak {
  x: number;
  y: number;
  length: number;
  speed: number;
  layer: number;
}

export class RainOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private streaks: Streak[] = [];
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
    const count = Math.min(MAX_DROPS, Math.round(((rect.width * rect.height) / DROP_AREA) * 1.4));
    this.streaks = Array.from({ length: count }, (_, i) => this.newStreak(true, i / count));
  }

  private newStreak(anywhere: boolean, order: number): Streak {
    const { width, height } = this.canvas;
    const scale = height / 900;
    // 並びの割合で層を割り当てる（数が変わっても層の比率が保たれる）
    let layer = 0;
    for (let acc = 0; layer < LAYERS.length - 1; layer++) {
      acc += LAYERS[layer].share;
      if (order < acc) break;
    }
    const spec = LAYERS[layer];
    const between = ([a, b]: readonly number[]) => a + Math.random() * (b - a);
    return {
      x: Math.random() * width * 1.3,
      y: anywhere ? Math.random() * height : -Math.random() * height * 0.3,
      length: between(spec.length) * scale,
      speed: between(spec.speed) * scale,
      layer,
    };
  }

  private tick = (time: number): void => {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const ctx = this.context;
    if (ctx) {
      const { width, height } = this.canvas;
      ctx.clearRect(0, 0, width, height);
      const scale = height / 900;

      // 雨の筋は、層ごとにまとめて 1 回で描く（粒ごとに描くと数千回になる）
      ctx.lineCap = 'round';
      const paths = LAYERS.map(() => new Path2D());
      for (let i = 0; i < this.streaks.length; i++) {
        const s = this.streaks[i];
        s.y += s.speed * dt;
        s.x -= s.speed * SLANT * dt;
        if (s.y - s.length > height || s.x < -60) {
          const order = (i + 0.5) / this.streaks.length;
          this.streaks[i] = this.newStreak(false, order);
          continue;
        }
        paths[s.layer].moveTo(s.x, s.y);
        paths[s.layer].lineTo(s.x + s.length * SLANT, s.y - s.length);
      }
      LAYERS.forEach((spec, layer) => {
        ctx.strokeStyle = `rgba(225, 233, 247, ${spec.alpha})`;
        ctx.lineWidth = Math.max(1, spec.width * scale * 1.2);
        ctx.stroke(paths[layer]);
      });
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
