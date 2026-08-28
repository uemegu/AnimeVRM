export interface AdventureMessageWindowOptions {
  onNextClick?: () => void;
  onStopClick?: () => void;
  typingSpeedMs?: number;
}

export class AdventureMessageWindow {
  private container: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;
  private nextIconEl: HTMLDivElement | null = null;
  private fullText = '';
  private currentDisplayedLength = 0;
  private typingTimer: number | null = null;
  private typingSpeedMs = 32;
  private onNextClick?: () => void;
  private onStopClick?: () => void;
  private isVisible = false;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: AdventureMessageWindowOptions = {}) {
    this.typingSpeedMs = options.typingSpeedMs ?? 32;
    this.onNextClick = options.onNextClick;
    this.onStopClick = options.onStopClick;
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('adv-message-window-styles')) return;

    const style = document.createElement('style');
    style.id = 'adv-message-window-styles';
    style.textContent = `
      .adv-message-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: clamp(220px, 32vh, 320px);
        background: linear-gradient(to bottom, rgba(3, 7, 18, 0) 0%, rgba(3, 7, 18, 0.72) 35%, rgba(3, 7, 18, 0.96) 100%);
        display: flex;
        justify-content: center;
        align-items: flex-end;
        padding: 24px 20px 36px;
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

      .adv-message-body {
        max-width: 680px;
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

      .adv-message-body .speaker-name {
        color: #7dd3fc;
        font-weight: 700;
        font-size: 0.9em;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .adv-message-body .speaker-name::before {
        content: '◆';
        font-size: 0.7em;
        color: #38bdf8;
      }

      .adv-message-body .quote-mark {
        color: #93c5fd;
      }

      .adv-next-indicator {
        position: absolute;
        right: 0;
        bottom: -10px;
        display: none;
        animation: adv-bounce 1.2s infinite ease-in-out;
      }

      .adv-next-indicator.show {
        display: block;
      }

      .adv-next-indicator svg {
        width: 22px;
        height: 22px;
        fill: #38bdf8;
        filter: drop-shadow(0 2px 6px rgba(56, 189, 248, 0.6));
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
    });
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.stopTyping();

    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler);
      this.boundKeyHandler = null;
    }

    const topControls = document.getElementById('adv-top-controls');
    if (topControls) {
      topControls.classList.remove('visible');
    }

    if (this.container) {
      this.container.classList.remove('visible');
      setTimeout(() => {
        if (!this.isVisible && this.container) {
          this.container.remove();
          this.container = null;
          this.contentEl = null;
          this.nextIconEl = null;
          topControls?.remove();
        }
      }, 400);
    }
  }

  public setText(text: string, speakerName: string = ''): void {
    this.show();
    this.stopTyping();
    this.fullText = text;
    this.currentDisplayedLength = 0;
    this.typingSpeedMs = 18; // 高速表示（約18ms/文字）

    if (this.nextIconEl) {
      this.nextIconEl.classList.remove('show');
    }

    this.typeNextChar(speakerName);
  }

  public appendText(additionalText: string, speakerName: string = ''): void {
    this.show();
    this.stopTyping();
    this.fullText += additionalText;

    if (this.nextIconEl) {
      this.nextIconEl.classList.remove('show');
    }

    this.typeNextChar(speakerName);
  }

  private typeNextChar(speakerName: string): void {
    if (this.currentDisplayedLength < this.fullText.length) {
      this.currentDisplayedLength++;
      this.renderContent(speakerName, this.fullText.slice(0, this.currentDisplayedLength));

      this.typingTimer = window.setTimeout(() => {
        this.typeNextChar(speakerName);
      }, this.typingSpeedMs);
    } else {
      this.renderContent(speakerName, this.fullText);
      if (this.nextIconEl) {
        this.nextIconEl.classList.add('show');
      }
    }
  }

  private renderContent(speakerName: string, text: string): void {
    if (!this.contentEl) return;

    let html = '';
    if (speakerName) {
      html += `<div class="speaker-name">${this.escapeHTML(speakerName)}</div>`;
    }

    // Format sentences & quotes
    const formatted = text
      .split('\n')
      .map((line) => {
        return this.escapeHTML(line)
          .replace(/「/g, '<span class="quote-mark">「</span>')
          .replace(/」/g, '<span class="quote-mark">」</span>');
      })
      .join('<br>');

    html += `<div>${formatted}</div>`;
    this.contentEl.innerHTML = html;
  }

  private stopTyping(): void {
    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  private createDOM(): void {
    if (this.container) return;

    const container = document.createElement('div');
    container.className = 'adv-message-container';

    const body = document.createElement('div');
    body.className = 'adv-message-body';

    const content = document.createElement('div');
    body.appendChild(content);

    const nextIcon = document.createElement('div');
    nextIcon.className = 'adv-next-indicator';
    nextIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
        <path d="M480-83 240-323l56-56 184 183 184-183 56 56L480-83Zm0-238L240-561l56-56 184 183 184-183 56 56-240 240Zm0-238L240-799l56-56 184 183 184-183 56 56-240 240Z"/>
      </svg>
    `;
    body.appendChild(nextIcon);

    container.appendChild(body);

    container.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentDisplayedLength < this.fullText.length) {
        // Instant complete typing
        this.stopTyping();
        this.currentDisplayedLength = this.fullText.length;
        this.renderContent('', this.fullText);
        if (this.nextIconEl) {
          this.nextIconEl.classList.add('show');
        }
      } else {
        this.onNextClick?.();
      }
    });

    document.body.appendChild(container);
    this.container = container;
    this.contentEl = content;
    this.nextIconEl = nextIcon;

    // Top Right Floating Controls (Stop Button)
    const topControls = document.createElement('div');
    topControls.id = 'adv-top-controls';
    topControls.className = 'adv-top-controls';
    topControls.innerHTML = `
      <button class="adv-stop-btn" title="会話シーケンスを終了 (ESC)">
        <span>⏹</span> 会話終了
      </button>
    `;
    topControls.querySelector('.adv-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onStopClick?.();
    });
    document.body.appendChild(topControls);
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
