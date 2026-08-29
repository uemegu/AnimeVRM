import { ScenarioChoice } from '../scenario/types';

export interface AdventureMessageWindowOptions {
  onNextClick?: () => void;
  onStopClick?: () => void;
  typingSpeedMs?: number;
}

export class AdventureMessageWindow {
  private container: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;
  private speakerEl: HTMLDivElement | null = null;
  private locationBadgeEl: HTMLDivElement | null = null;
  private nextIconEl: HTMLDivElement | null = null;
  private choicesContainerEl: HTMLDivElement | null = null;

  private fullText = '';
  private currentSpeaker = '';
  private currentLocation = '';
  private currentDisplayedLength = 0;
  private typingTimer: number | null = null;
  private typingSpeedMs = 24;
  private onNextClick?: () => void;
  private onStopClick?: () => void;
  private isVisible = false;
  private isChoicesVisible = false;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: AdventureMessageWindowOptions = {}) {
    this.typingSpeedMs = options.typingSpeedMs ?? 24;
    this.onNextClick = options.onNextClick;
    this.onStopClick = options.onStopClick;
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('adv-message-window-styles')) return;

    const style = document.createElement('style');
    style.id = 'adv-message-window-styles';
    style.textContent = `
      /* --- Message Window Container --- */
      .adv-message-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: clamp(210px, 30vh, 290px);
        background: linear-gradient(to bottom, rgba(3, 7, 18, 0) 0%, rgba(3, 7, 18, 0.78) 24%, rgba(3, 7, 18, 0.96) 100%);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 40px 24px 24px;
        box-sizing: border-box;
        z-index: 9990;
        pointer-events: auto;
        cursor: pointer;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }

      .adv-message-container.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* --- Top Left Location Badge --- */
      .adv-location-badge {
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 9995;
        background: rgba(15, 23, 42, 0.85);
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.3);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', serif;
        font-weight: 500;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0;
        transform: translateX(-10px);
        transition: all 0.3s ease;
        pointer-events: none;
      }

      .adv-location-badge.visible {
        opacity: 1;
        transform: translateX(0);
      }

      /* --- Top Right Floating Controls --- */
      .adv-top-controls {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .adv-top-controls.visible {
        opacity: 1;
      }

      .adv-stop-btn {
        background: rgba(15, 23, 42, 0.75);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-family: sans-serif;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .adv-stop-btn:hover {
        background: rgba(239, 68, 68, 0.85);
        border-color: rgba(239, 68, 68, 1);
        transform: scale(1.05);
      }

      /* --- Message Body --- */
      .adv-message-body {
        max-width: 720px;
        width: 100%;
        color: #ccfbf1;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', serif;
        font-size: clamp(17px, 2.2vw, 22px);
        font-weight: 500;
        line-height: 1.85;
        letter-spacing: 0.04em;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9), 0 0 20px rgba(15, 23, 42, 0.8);
        position: relative;
        padding-bottom: 8px;
      }

      .adv-speaker-name {
        color: #7dd3fc;
        font-weight: 700;
        font-size: 0.92em;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .adv-speaker-name::before {
        content: '◆';
        font-size: 0.7em;
        color: #38bdf8;
      }

      .adv-quote-mark {
        color: #93c5fd;
      }

      .adv-next-indicator {
        position: absolute;
        right: 0;
        bottom: -6px;
        display: none;
        animation: adv-bounce 1.2s infinite ease-in-out;
      }

      .adv-next-indicator.show {
        display: block;
      }

      .adv-next-indicator svg {
        width: 24px;
        height: 24px;
        fill: #38bdf8;
        filter: drop-shadow(0 2px 6px rgba(56, 189, 248, 0.6));
      }

      /* --- Choice Dialog & Backdrop --- */
      .adv-choices-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(4px);
        z-index: 9996;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .adv-choices-backdrop.visible {
        opacity: 1;
        pointer-events: auto;
      }

      .adv-choices-container {
        position: fixed;
        top: 48%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9998;
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 90%;
        max-width: 580px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .adv-choices-container.visible {
        pointer-events: auto;
        opacity: 1;
        transform: translate(-50%, -50%);
      }

      .adv-choice-btn {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 249, 255, 0.88) 100%);
        color: #0f172a;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', serif;
        font-size: clamp(16px, 1.8vw, 19px);
        font-weight: 600;
        padding: 16px 24px;
        border-radius: 16px;
        border: 2px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 0 15px rgba(56, 189, 248, 0.25);
        cursor: pointer;
        text-align: center;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        backdrop-filter: blur(10px);
        position: relative;
        overflow: hidden;
      }

      .adv-choice-btn:hover {
        background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
        border-color: #38bdf8;
        color: #0284c7;
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.4), 0 0 25px rgba(56, 189, 248, 0.5);
      }

      .adv-choice-btn:active {
        transform: translateY(0) scale(0.99);
      }

      @keyframes adv-bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(6px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  public show(): void {
    if (this.isVisible) return;
    this.createDOM();
    this.isVisible = true;

    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.onStopClick?.();
      }
    };
    window.addEventListener('keydown', this.boundKeyHandler);

    requestAnimationFrame(() => {
      if (this.container) {
        this.container.classList.add('visible');
      }
      const topControls = document.getElementById('adv-top-controls');
      if (topControls) {
        topControls.classList.add('visible');
      }
      if (this.locationBadgeEl && this.currentLocation) {
        this.locationBadgeEl.classList.add('visible');
      }
    });
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.stopTyping();
    this.hideChoices();

    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler);
      this.boundKeyHandler = null;
    }

    const topControls = document.getElementById('adv-top-controls');
    if (topControls) {
      topControls.classList.remove('visible');
    }
    if (this.locationBadgeEl) {
      this.locationBadgeEl.classList.remove('visible');
    }

    if (this.container) {
      this.container.classList.remove('visible');
      setTimeout(() => {
        if (!this.isVisible && this.container) {
          this.container.remove();
          this.container = null;
          this.contentEl = null;
          this.speakerEl = null;
          this.locationBadgeEl?.remove();
          this.locationBadgeEl = null;
          this.nextIconEl = null;
          this.choicesContainerEl?.remove();
          this.choicesContainerEl = null;
          document.getElementById('adv-choices-backdrop')?.remove();
          topControls?.remove();
        }
      }, 400);
    }
  }

  public setLocation(location: string): void {
    this.currentLocation = location;
    if (this.locationBadgeEl) {
      this.locationBadgeEl.innerHTML = `📍 ${this.escapeHTML(location)}`;
      if (location) {
        this.locationBadgeEl.classList.add('visible');
      } else {
        this.locationBadgeEl.classList.remove('visible');
      }
    }
  }

  public setText(text: string, speakerName: string = ''): void {
    this.show();
    this.hideChoices();
    this.stopTyping();
    this.fullText = text;
    this.currentSpeaker = speakerName;
    this.currentDisplayedLength = 0;

    if (this.nextIconEl) {
      this.nextIconEl.classList.remove('show');
    }

    this.typeNextChar();
  }

  public isShowingChoices(): boolean {
    return this.isChoicesVisible;
  }

  public showChoices(
    choices: ScenarioChoice[],
    onSelect: (choice: ScenarioChoice) => void
  ): void {
    this.isChoicesVisible = true;
    if (this.nextIconEl) {
      this.nextIconEl.classList.remove('show');
    }

    if (!this.choicesContainerEl) {
      this.createChoicesDOM();
    }

    const backdrop = document.getElementById('adv-choices-backdrop');
    if (backdrop) {
      backdrop.classList.add('visible');
    }

    if (this.choicesContainerEl) {
      this.choicesContainerEl.innerHTML = '';
      choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = 'adv-choice-btn';
        btn.innerHTML = this.escapeHTML(choice.text);
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideChoices();
          onSelect(choice);
        });
        this.choicesContainerEl!.appendChild(btn);
      });
      this.choicesContainerEl.classList.add('visible');
    }
  }

  public hideChoices(): void {
    this.isChoicesVisible = false;
    const backdrop = document.getElementById('adv-choices-backdrop');
    if (backdrop) {
      backdrop.classList.remove('visible');
    }
    if (this.choicesContainerEl) {
      this.choicesContainerEl.classList.remove('visible');
    }
  }

  private typeNextChar(): void {
    if (this.currentDisplayedLength < this.fullText.length) {
      this.currentDisplayedLength++;
      this.renderContent(this.fullText.slice(0, this.currentDisplayedLength));

      this.typingTimer = window.setTimeout(() => {
        this.typeNextChar();
      }, this.typingSpeedMs);
    } else {
      this.renderContent(this.fullText);
      if (this.nextIconEl && !this.isChoicesVisible) {
        this.nextIconEl.classList.add('show');
      }
    }
  }

  private renderContent(text: string): void {
    if (!this.contentEl) return;

    if (this.speakerEl) {
      if (this.currentSpeaker) {
        this.speakerEl.innerHTML = `<span class="adv-speaker-name">${this.escapeHTML(this.currentSpeaker)}</span>`;
        this.speakerEl.style.display = 'block';
      } else {
        this.speakerEl.innerHTML = '';
        this.speakerEl.style.display = 'none';
      }
    }

    const formatted = text
      .split('\n')
      .map((line) => {
        return this.escapeHTML(line)
          .replace(/「/g, '<span class="adv-quote-mark">「</span>')
          .replace(/」/g, '<span class="adv-quote-mark">」</span>');
      })
      .join('<br>');

    this.contentEl.innerHTML = `<div>${formatted}</div>`;
  }

  private stopTyping(): void {
    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  private createDOM(): void {
    if (this.container) return;

    // Location Badge (Top Left)
    const locationBadge = document.createElement('div');
    locationBadge.className = 'adv-location-badge';
    if (this.currentLocation) {
      locationBadge.innerHTML = `📍 ${this.escapeHTML(this.currentLocation)}`;
    }
    document.body.appendChild(locationBadge);
    this.locationBadgeEl = locationBadge;

    // Bottom Message Container
    const container = document.createElement('div');
    container.className = 'adv-message-container';

    const body = document.createElement('div');
    body.className = 'adv-message-body';

    const speakerEl = document.createElement('div');
    body.appendChild(speakerEl);
    this.speakerEl = speakerEl;

    const content = document.createElement('div');
    body.appendChild(content);
    this.contentEl = content;

    const nextIcon = document.createElement('div');
    nextIcon.className = 'adv-next-indicator';
    nextIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
        <path d="M480-83 240-323l56-56 184 183 184-183 56 56L480-83Zm0-238L240-561l56-56 184 183 184-183 56 56-240 240Zm0-238L240-799l56-56 184 183 184-183 56 56-240 240Z"/>
      </svg>
    `;
    body.appendChild(nextIcon);
    this.nextIconEl = nextIcon;

    container.appendChild(body);

    container.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isChoicesVisible) return;

      if (this.currentDisplayedLength < this.fullText.length) {
        // Instant complete typing
        this.stopTyping();
        this.currentDisplayedLength = this.fullText.length;
        this.renderContent(this.fullText);
        if (this.nextIconEl) {
          this.nextIconEl.classList.add('show');
        }
      } else {
        this.onNextClick?.();
      }
    });

    document.body.appendChild(container);
    this.container = container;

    // Top Right Floating Controls (Stop Button)
    const topControls = document.createElement('div');
    topControls.id = 'adv-top-controls';
    topControls.className = 'adv-top-controls';
    topControls.innerHTML = `
      <button class="adv-stop-btn" title="シナリオを終了 (ESC)">
        <span>⏹</span> シナリオ終了
      </button>
    `;
    topControls.querySelector('.adv-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onStopClick?.();
    });
    document.body.appendChild(topControls);

    this.createChoicesDOM();
  }

  private createChoicesDOM(): void {
    if (document.getElementById('adv-choices-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'adv-choices-backdrop';
    backdrop.className = 'adv-choices-backdrop';
    document.body.appendChild(backdrop);

    const choicesContainer = document.createElement('div');
    choicesContainer.className = 'adv-choices-container';
    document.body.appendChild(choicesContainer);
    this.choicesContainerEl = choicesContainer;
  }

  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose(): void {
    this.hide();
  }
}
