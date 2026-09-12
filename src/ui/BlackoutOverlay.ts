/**
 * Blackout Overlay (画面暗転・フェードトランジション)
 *
 * ロケーション切り替え時や明示的なフェード黒指定時に、
 * 画面全体をなめらかに暗転（フェードアウト→フェードイン）させて
 * カメラの移動、背景テクスチャのロード、魚眼歪みなどの切り替えのチラつきを自然に隠します。
 */

export class BlackoutOverlay {
  private overlayEl: HTMLDivElement | null = null;
  private container?: HTMLElement;

  constructor(container?: HTMLElement) {
    this.container = container;
    this.injectStyles();
    this.ensureElement();
  }

  private getParentContainer(): HTMLElement {
    return this.container ?? document.getElementById('viewport-container') ?? document.body;
  }

  private injectStyles(): void {
    if (document.getElementById('blackout-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'blackout-overlay-styles';
    style.textContent = `
      .scenario-blackout-overlay {
        position: absolute;
        inset: 0;
        background-color: #000000;
        z-index: 70;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .scenario-blackout-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  }

  private ensureElement(): HTMLDivElement {
    if (!this.overlayEl) {
      const parent = this.getParentContainer();
      if (!parent) return document.createElement('div');
      const el = document.createElement('div');
      el.className = 'scenario-blackout-overlay';
      parent.appendChild(el);
      this.overlayEl = el;
    }
    return this.overlayEl;
  }

  /**
   * 画面を暗転させる（フェードアウト：徐々に黒くする）
   */
  public async fadeOut(durationMs = 320): Promise<void> {
    const el = this.ensureElement();
    el.style.transitionDuration = `${durationMs}ms`;
    el.classList.add('active');
    await new Promise((r) => setTimeout(r, durationMs));
  }

  /**
   * 画面を明転させる（フェードイン：徐々に黒を解除）
   */
  public async fadeIn(durationMs = 320): Promise<void> {
    const el = this.ensureElement();
    el.style.transitionDuration = `${durationMs}ms`;
    el.classList.remove('active');
    await new Promise((r) => setTimeout(r, durationMs));
  }

  /**
   * 暗転トランジション（黒フェードアウト → action実行 → 黒フェードイン）
   */
  public async fadeTransition(
    action: () => void | Promise<void>,
    fadeOutMs = 300,
    holdMs = 80,
    fadeInMs = 320
  ): Promise<void> {
    await this.fadeOut(fadeOutMs);
    try {
      await action();
    } catch (err) {
      console.error('[BlackoutOverlay] Error during transition action:', err);
    }
    if (holdMs > 0) {
      await new Promise((r) => setTimeout(r, holdMs));
    }
    await this.fadeIn(fadeInMs);
  }

  /**
   * 暗転を即座にリセット
   */
  public reset(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('active');
      this.overlayEl.style.transitionDuration = '0ms';
    }
  }

  public dispose(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }
}
