import type { TextConfig, TextAnimationPreset } from './types';
import type { AvatarConfig } from '../Config';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class TypographyOverlay {
  private bgLayer: HTMLElement;
  private backLayer: HTMLElement;
  private frontLayer: HTMLElement;

  private backTextEl: HTMLElement;
  private frontTextEl: HTMLElement;

  constructor() {
    // 1. Animation Background Layer
    let bg = document.getElementById('animation-background');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'animation-background';
      document.body.prepend(bg);
    }
    this.bgLayer = bg;

    // 2. Back Text Layer (behind WebGL canvas)
    let back = document.getElementById('animation-text-back');
    if (!back) {
      back = document.createElement('div');
      back.id = 'animation-text-back';
      const canvas = document.getElementById('app');
      if (canvas && canvas.parentNode) {
        canvas.parentNode.insertBefore(back, canvas);
      } else {
        document.body.appendChild(back);
      }
    }
    this.backLayer = back;

    // 3. Front Text Layer (in front of WebGL canvas)
    let front = document.getElementById('animation-text-front');
    if (!front) {
      front = document.createElement('div');
      front.id = 'animation-text-front';
      const canvas = document.getElementById('app');
      if (canvas && canvas.parentNode) {
        canvas.parentNode.insertBefore(front, canvas.nextSibling);
      } else {
        document.body.appendChild(front);
      }
    }
    this.frontLayer = front;

    // Text elements
    this.backTextEl = document.createElement('div');
    this.backTextEl.className = 'typography-item back-item';
    this.backLayer.appendChild(this.backTextEl);

    this.frontTextEl = document.createElement('div');
    this.frontTextEl.className = 'typography-item front-item';
    this.frontLayer.appendChild(this.frontTextEl);

    this.clear();
  }

  public enterTransparentMode(cfg: AvatarConfig): void {
    this.bgLayer.style.display = 'block';
    this.bgLayer.style.backgroundImage = 'none';
    this.bgLayer.style.backgroundColor = cfg.environment.backgroundColor || '#ffffff';
  }

  public exitTransparentMode(): void {
    this.bgLayer.style.display = 'none';
    this.bgLayer.style.backgroundImage = 'none';
    this.clear();
  }

  public clear(): void {
    this.backTextEl.style.display = 'none';
    this.backTextEl.textContent = '';
    this.frontTextEl.style.display = 'none';
    this.frontTextEl.textContent = '';
  }

  public update(progress: number, backConfig?: TextConfig, frontConfig?: TextConfig): void {
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Update Back Text
    if (backConfig && backConfig.text && backConfig.text.trim().length > 0) {
      this.renderText(this.backTextEl, backConfig, clampedProgress);
    } else {
      this.backTextEl.style.display = 'none';
    }

    // Update Front Text
    if (frontConfig && frontConfig.text && frontConfig.text.trim().length > 0) {
      this.renderText(this.frontTextEl, frontConfig, clampedProgress);
    } else {
      this.frontTextEl.style.display = 'none';
    }
  }

  private renderText(element: HTMLElement, config: TextConfig, t: number): void {
    element.style.display = 'block';
    element.textContent = config.text;
    element.style.left = `${config.x}%`;
    element.style.top = `${config.y}%`;
    element.style.fontSize = `${config.fontSize}vw`;
    element.style.color = config.color;
    element.style.fontWeight = `${config.fontWeight}`;

    const { transform, opacity } = this.calculateMotion(config.animationPreset, t);
    element.style.transform = transform;
    element.style.opacity = `${opacity}`;
  }

  private calculateMotion(
    preset: TextAnimationPreset,
    t: number
  ): { transform: string; opacity: number } {
    switch (preset) {
      case 'fade': {
        const fadeIn = Math.min(t / 0.25, 1.0);
        const fadeOut = t > 0.85 ? (1.0 - t) / 0.15 : 1.0;
        const opacity = easeOutCubic(fadeIn) * fadeOut;
        return {
          transform: 'translate(-50%, -50%)',
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }

      case 'slideLeft': {
        // Slide in from right (+12vw) to center, then drift left (-3vw)
        const entryT = Math.min(t / 0.35, 1.0);
        const easeEntry = easeOutCubic(entryT);
        const startX = 12 * (1.0 - easeEntry);
        const driftX = -3 * t;
        const currentOffset = startX + driftX;
        const opacity = Math.min(t / 0.15, 1.0);
        return {
          transform: `translate(calc(-50% + ${currentOffset}vw), -50%)`,
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }

      case 'slideRight': {
        // Slide in from left (-12vw) to center, then drift right (+3vw)
        const entryT = Math.min(t / 0.35, 1.0);
        const easeEntry = easeOutCubic(entryT);
        const startX = -12 * (1.0 - easeEntry);
        const driftX = 3 * t;
        const currentOffset = startX + driftX;
        const opacity = Math.min(t / 0.15, 1.0);
        return {
          transform: `translate(calc(-50% + ${currentOffset}vw), -50%)`,
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }

      case 'slideUp': {
        // Slide in from bottom (+10vh) to center, then drift up (-2vh)
        const entryT = Math.min(t / 0.35, 1.0);
        const easeEntry = easeOutCubic(entryT);
        const startY = 10 * (1.0 - easeEntry);
        const driftY = -2 * t;
        const currentOffset = startY + driftY;
        const opacity = Math.min(t / 0.15, 1.0);
        return {
          transform: `translate(-50%, calc(-50% + ${currentOffset}vh))`,
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }

      case 'scaleIn': {
        // Scale from 0.45 to 1.0 with smooth easing
        const scaleT = Math.min(t / 0.4, 1.0);
        const scale = 0.45 + 0.55 * easeOutCubic(scaleT);
        const opacity = Math.min(t / 0.15, 1.0);
        return {
          transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }

      case 'punch': {
        // Pop in quickly with overshoot (1.5x -> 1.0x)
        let scale: number;
        if (t < 0.2) {
          const punchT = t / 0.2;
          scale = 1.0 + 0.5 * (1.0 - punchT);
        } else {
          scale = 1.0;
        }
        const opacity = Math.min(t / 0.08, 1.0);
        return {
          transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
          opacity: Math.max(0, Math.min(1, opacity)),
        };
      }

      case 'static':
      default:
        return {
          transform: 'translate(-50%, -50%)',
          opacity: 1.0,
        };
    }
  }

  public dispose(): void {
    this.clear();
    this.bgLayer.remove();
    this.backLayer.remove();
    this.frontLayer.remove();
  }
}
