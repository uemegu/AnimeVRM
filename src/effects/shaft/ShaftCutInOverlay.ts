export type ShaftCutInPreset = 'red_trouble' | 'green_closed';

export interface ShaftCutInOptions {
  preset: ShaftCutInPreset;
  duration?: number; // 表示秒数 (自動消去する場合)。未指定時は手動または次シーンで消去
  onComplete?: () => void;
}

export class ShaftCutInOverlay {
  private containerEl: HTMLElement | null = null;
  private redCutInEl: HTMLElement | null = null;
  private greenCutInEl: HTMLElement | null = null;
  private timeoutId: number | null = null;

  constructor() {
    this.initDOM();
  }

  private initDOM(): void {
    let container = document.getElementById('shaft-cutin-overlay');
    if (!container) {
      container = document.createElement('div');
      container.id = 'shaft-cutin-overlay';
      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.pointerEvents = 'none';
      container.style.userSelect = 'none';
      container.style.zIndex = '50';
      container.style.display = 'none';
      container.style.overflow = 'hidden';

      const parent = document.getElementById('viewport-container') || document.body;
      parent.appendChild(container);
    }
    this.containerEl = container;

    // 1. Red Cut-In (上下黒帯 + 中央赤背景 + 漢字カタカナ白明朝体)
    const red = document.createElement('div');
    red.className = 'shaft-cutin-red';
    red.style.position = 'absolute';
    red.style.inset = '0';
    red.style.display = 'none';
    red.style.flexDirection = 'column';
    red.style.justifyContent = 'space-between';
    red.style.backgroundColor = 'transparent';

    red.innerHTML = `
      <div style="height: 14%; width: 100%; background: #000000;"></div>
      <div style="flex: 1; width: 100%; background: #dc2626; display: flex; align-items: center; justify-content: center; padding: 2rem 4rem; box-sizing: border-box;">
        <div style="max-width: 900px; color: #ffffff; font-family: 'Shippori Mincho', 'Yu Mincho', serif; text-align: left;">
          <div style="font-size: clamp(1.4rem, 3.0vw, 2.2rem); font-weight: 800; letter-spacing: 0.18em; line-height: 1.5; margin-bottom: 0.8rem;">
            何ダカ面倒ナ話ガ始マッタ。
          </div>
          <div style="font-size: clamp(0.95rem, 1.8vw, 1.35rem); font-weight: 600; letter-spacing: 0.12em; line-height: 1.8; opacity: 0.95;">
            居ルカドウカモ分カラナイ存在ガ重力ニ縛ラレタ存在デアルカドウカヲ議論スル事ニドレホドノ意味ガアルノカ分カラナイガ、此処ハ話ヲ進メルシカナイダロウ。
          </div>
        </div>
      </div>
      <div style="height: 14%; width: 100%; background: #000000;"></div>
    `;
    container.appendChild(red);
    this.redCutInEl = red;

    // 2. Green Cut-In (上下白帯 + 中央緑背景 + 「閉」 + 「close」)
    const green = document.createElement('div');
    green.className = 'shaft-cutin-green';
    green.style.position = 'absolute';
    green.style.inset = '0';
    green.style.display = 'none';
    green.style.flexDirection = 'column';
    green.style.justifyContent = 'space-between';
    green.style.backgroundColor = 'transparent';

    green.innerHTML = `
      <div style="height: 15%; width: 100%; background: #ffffff;"></div>
      <div style="flex: 1; width: 100%; background: #15803d; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">
        <div style="color: #ffffff; font-family: 'Shippori Mincho', 'Yu Mincho', serif; font-weight: 800; font-size: clamp(3.5rem, 9vw, 6.5rem); letter-spacing: 0.2em; text-indent: 0.2em; line-height: 1;">
          閉
        </div>
        <div style="color: #ffffff; font-family: 'Montserrat', sans-serif; font-weight: 500; font-size: clamp(0.85rem, 1.8vw, 1.25rem); letter-spacing: 0.4em; text-indent: 0.4em; margin-top: 0.8rem; text-transform: lowercase; opacity: 0.9;">
          close
        </div>
      </div>
      <div style="height: 15%; width: 100%; background: #ffffff;"></div>
    `;
    container.appendChild(green);
    this.greenCutInEl = green;
  }

  public show(preset: ShaftCutInPreset, duration?: number, onComplete?: () => void): void {
    this.hide();

    if (!this.containerEl) return;
    this.containerEl.style.display = 'block';

    if (preset === 'red_trouble' && this.redCutInEl) {
      this.redCutInEl.style.display = 'flex';
    } else if (preset === 'green_closed' && this.greenCutInEl) {
      this.greenCutInEl.style.display = 'flex';
    }

    if (duration && duration > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.hide();
        if (onComplete) onComplete();
      }, duration * 1000);
    }
  }

  public hide(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.containerEl) {
      this.containerEl.style.display = 'none';
    }
    if (this.redCutInEl) {
      this.redCutInEl.style.display = 'none';
    }
    if (this.greenCutInEl) {
      this.greenCutInEl.style.display = 'none';
    }
  }

  public dispose(): void {
    this.hide();
    if (this.containerEl && this.containerEl.parentNode) {
      this.containerEl.parentNode.removeChild(this.containerEl);
    }
  }
}
