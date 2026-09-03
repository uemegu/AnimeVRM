/**
 * Interlude Overlay (幕間シーン切り替えアニメーション)
 *
 * Inspired by /Users/ueda/git/sayin5min/src/controls/common/LoadingOverlay.tsx:
 * 4 horizontal alternating slices slide in from left/right to cover the screen,
 * hiding avatar motion transitions, camera jumps, and texture loading,
 * then gracefully slide out to reveal the new scene.
 */

export interface InterludeTransitionOptions {
  title?: string;
  subtitle?: string;
  onCovered?: () => void | Promise<void>;
  holdDurationMs?: number;
}

export class InterludeOverlay {
  private container: HTMLDivElement | null = null;
  private slice1: HTMLDivElement | null = null;
  private slice2: HTMLDivElement | null = null;
  private slice3: HTMLDivElement | null = null;
  private slice4: HTMLDivElement | null = null;
  private titleEl: HTMLElement | null = null;
  private subtitleEl: HTMLElement | null = null;

  private isRunning = false;

  constructor() {
    this.injectStyles();
    this.createElements();
  }

  private getParentContainer(): HTMLElement {
    return document.getElementById('viewport-container') ?? document.body;
  }

  private injectStyles(): void {
    if (document.getElementById('interlude-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'interlude-overlay-styles';
    style.textContent = `
      .interlude-overlay-container {
        position: absolute;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        overflow: hidden;
        display: none;
      }

      .interlude-overlay-container.visible {
        display: block;
        pointer-events: auto;
      }

      .interlude-slice {
        position: absolute;
        left: 0;
        right: 0;
        height: 25%;
        transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }

      /* Alternating horizontal slices with anime sky/blue palette */
      .interlude-slice-1 {
        top: 0;
        background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
        transform: translateX(101%);
      }

      .interlude-slice-2 {
        top: 25%;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        transform: translateX(-101%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 20px;
        box-sizing: border-box;
      }

      .interlude-slice-3 {
        top: 50%;
        background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
        transform: translateX(101%);
      }

      .interlude-slice-4 {
        top: 75%;
        background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
        transform: translateX(-101%);
      }

      /* Active State: All slices slide in to cover screen */
      .interlude-overlay-container.covered .interlude-slice-1,
      .interlude-overlay-container.covered .interlude-slice-2,
      .interlude-overlay-container.covered .interlude-slice-3,
      .interlude-overlay-container.covered .interlude-slice-4 {
        transform: translateX(0);
      }

      /* Exit State: Slices exit to opposite sides for dynamic theatrical wipe */
      .interlude-overlay-container.exiting .interlude-slice-1 {
        transform: translateX(-101%);
      }
      .interlude-overlay-container.exiting .interlude-slice-2 {
        transform: translateX(101%);
      }
      .interlude-overlay-container.exiting .interlude-slice-3 {
        transform: translateX(-101%);
      }
      .interlude-overlay-container.exiting .interlude-slice-4 {
        transform: translateX(101%);
      }

      /* Center Title / Typography */
      .interlude-content {
        text-align: center;
        user-select: none;
      }

      .interlude-subtitle {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #0284c7;
        margin-bottom: 4px;
      }

      .interlude-title {
        margin: 0;
        font-size: clamp(18px, 3.2vw, 28px);
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
        font-weight: 700;
        color: #0c4a6e;
        letter-spacing: 0.1em;
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.85);
      }

      .interlude-deco-bar {
        width: 48px;
        height: 2px;
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 100%);
        margin: 6px auto 0;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  private createElements(): void {
    const parent = this.getParentContainer();
    const existing = document.getElementById('interlude-overlay-container');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'interlude-overlay-container';
    container.className = 'interlude-overlay-container';

    container.innerHTML = `
      <div class="interlude-slice interlude-slice-1"></div>
      <div class="interlude-slice interlude-slice-2">
        <div class="interlude-content">
          <span class="interlude-subtitle">SCENE TRANSITION</span>
          <h2 class="interlude-title">街の散歩道</h2>
          <div class="interlude-deco-bar"></div>
        </div>
      </div>
      <div class="interlude-slice interlude-slice-3"></div>
      <div class="interlude-slice interlude-slice-4"></div>
    `;

    parent.appendChild(container);
    this.container = container;
    this.slice1 = container.querySelector('.interlude-slice-1');
    this.slice2 = container.querySelector('.interlude-slice-2');
    this.slice3 = container.querySelector('.interlude-slice-3');
    this.slice4 = container.querySelector('.interlude-slice-4');
    this.titleEl = container.querySelector('.interlude-title');
    this.subtitleEl = container.querySelector('.interlude-subtitle');
  }

  /**
   * Run full alternating slice interlude transition:
   * 1. Slices slide in to cover screen (420ms)
   * 2. onCovered callback executes while fully covered
   * 3. Hold for holdDurationMs (default 320ms)
   * 4. Slices slide out to reveal new scene (420ms)
   */
  public async playTransition(options: InterludeTransitionOptions = {}): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    if (!this.container || !document.contains(this.container)) {
      this.createElements();
    }

    if (this.titleEl) {
      this.titleEl.textContent = options.title ?? '街の散歩道';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = options.subtitle ?? 'SCENE TRANSITION';
    }

    const holdMs = options.holdDurationMs ?? 320;
    const container = this.container!;

    // 1. Prepare container
    container.classList.remove('exiting', 'covered');
    container.classList.add('visible');

    // Trigger reflow
    void container.offsetHeight;

    // 2. Slide In to cover screen
    container.classList.add('covered');
    await new Promise((resolve) => setTimeout(resolve, 430));

    // 3. Execute scene setup while completely covered
    if (options.onCovered) {
      try {
        await options.onCovered();
      } catch (err) {
        console.error('Error during interlude onCovered:', err);
      }
    }

    // 4. Hold momentarily so user can read scene title & screen stabilizes
    await new Promise((resolve) => setTimeout(resolve, holdMs));

    // 5. Slide Out to opposite side
    container.classList.remove('covered');
    container.classList.add('exiting');
    await new Promise((resolve) => setTimeout(resolve, 430));

    // 6. Reset & Hide
    container.classList.remove('visible', 'exiting');
    this.isRunning = false;
  }
}
