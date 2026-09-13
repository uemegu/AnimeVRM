/**
 * PvTitleOverlay
 * 商業アニメ映画トレイラー仕様のシネマティック・動的タイポグラフィ＆Kawaiiタイトルロゴ表示コンポーネント。
 * 
 * 特徴:
 * - 外部CSS/Tailwindに一切依存しない完全自己完結型ピュアCSS
 * - 静止した文字を完全撤廃し、常時呼吸・ドリフト・スライドするモーショングラフィックス
 * - 話者名（AOI/SHION等）やメッセージウィンドウを完全排除
 * - 「L字直交配置（横書き日本語 ✕ 縦書きプロポーショナル英語）」
 * - 「ゴースト英字ウォーターマーク ✕ サビスマッシュ（叩きつけ）」
 * - 「ステップ・カスケード（階段配置 ✕ Cinzel英語）」
 * - 「シネマティック・プッシュ（奥からの迫り出し ✕ ルビーレッドのアクセント）」
 * - シーン光（昼・青空／夕暮れ／夜）と連動するカラーグレーディング
 * - 1:00 クライマックスでKawaiiタイトルロゴ『5秒の告白』が弾むアニメーション
 */

export interface StepCascadeLine {
  text: string;
  en?: string;
}

export interface PvSubtitleConfig {
  layout?: 'l-shape' | 'ghost-smash' | 'step-cascade' | 'cinema-push' | 'bottom-glow';
  side?: 'left' | 'right';
  titleText?: string;
  verticalEn?: string;
  subText?: string;
  ghostText?: string;
  lines?: StepCascadeLine[];
  theme?: 'day' | 'sunset' | 'night';
}

export class PvTitleOverlay {
  private container: HTMLDivElement;
  private typoWrapper: HTMLDivElement;
  private titleLogoWrapper: HTMLDivElement;
  private isVisible = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'pv-overlay-root';
    this.container.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 999;
      display: none;
      overflow: hidden;
    `;

    // タイポグラフィ動的ラッパー
    this.typoWrapper = document.createElement('div');
    this.typoWrapper.className = 'pv-dynamic-typo-container';
    this.typoWrapper.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      display: flex;
      transition: opacity 0.5s ease;
      opacity: 0;
    `;
    this.container.appendChild(this.typoWrapper);

    // Kawaii タイトルロゴ「5秒の告白」（1:00〜登場）
    this.titleLogoWrapper = document.createElement('div');
    this.titleLogoWrapper.className = 'pv-title-logo-wrapper';
    this.titleLogoWrapper.style.cssText = `
      position: absolute;
      top: 38%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.65);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: all 0.75s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    this.titleLogoWrapper.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Montserrat:wght@300;400;600;800;900&family=Shippori+Mincho:wght@500;600;700;800&display=swap');

        /* --- 共通フォント --- */
        .pv-font-mincho {
          font-family: 'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif;
        }
        .pv-font-cinzel {
          font-family: 'Cinzel', 'Times New Roman', serif;
        }
        .pv-font-sans-proportional {
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* --- 自己完結型レイアウトスタイル --- */
        .pv-l-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 20px;
          pointer-events: none;
        }
        .pv-l-vert-right {
          position: absolute;
          right: 24px;
          top: 15%;
          bottom: 24%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .pv-l-vert-left {
          position: absolute;
          left: 24px;
          top: 15%;
          bottom: 24%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        /* --- シネマティック文字縁取り ＆ 輪郭強化 --- */
        .pv-main-catchphrase {
          -webkit-text-stroke: 1.5px rgba(0, 0, 0, 0.9);
          paint-order: stroke fill;
        }
        .pv-sub-catchphrase {
          -webkit-text-stroke: 0.6px rgba(0, 0, 0, 0.85);
          paint-order: stroke fill;
        }

        .pv-l-horiz-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          padding: 10px 48px 12px 24px;
          background: radial-gradient(ellipse closest-side at 80% 50%, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.22) 65%, transparent 100%);
          backdrop-filter: blur(2.5px);
          -webkit-backdrop-filter: blur(2.5px);
          border-radius: 20px;
        }
        .pv-l-horiz-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: 10px 24px 12px 48px;
          background: radial-gradient(ellipse closest-side at 20% 50%, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.22) 65%, transparent 100%);
          backdrop-filter: blur(2.5px);
          -webkit-backdrop-filter: blur(2.5px);
          border-radius: 20px;
        }
        .pv-smash-container {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          pointer-events: none;
        }
        .pv-ghost-text {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
        .pv-step-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-left: 70px;
          padding-right: 70px;
          pointer-events: none;
        }
        .pv-cinema-push-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          pointer-events: none;
          background: radial-gradient(ellipse 75% 55% at 50% 50%, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.25) 65%, transparent 100%);
          backdrop-filter: blur(2.5px);
          -webkit-backdrop-filter: blur(2.5px);
        }
        .pv-bottom-glow-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 48px;
          text-align: center;
          pointer-events: none;
        }

        /* --- アニメーション定義 --- */
        @keyframes pvVertLineEnter {
          0% { opacity: 0; transform: translateY(-16px); letter-spacing: 0.25em; }
          100% { opacity: 0.9; transform: translateY(0); letter-spacing: 0.45em; }
        }
        @keyframes pvHorizTextEnter {
          0% { opacity: 0; transform: translateX(16px); filter: blur(8px); letter-spacing: 0.08em; }
          100% { opacity: 1; transform: translateX(0); filter: blur(0px); letter-spacing: 0.18em; }
        }
        @keyframes pvTextFloatDrift {
          0%, 100% { transform: scale(1.0); }
          50% { transform: scale(1.025) translate(-2px, -2px); }
        }
        @keyframes pvSmashImpact {
          0% { opacity: 0; transform: scale(2.0) rotate(-4deg); filter: blur(14px); }
          25% { opacity: 1; transform: scale(0.97) rotate(-4deg); filter: blur(0px); }
          40% { transform: scale(1.02) rotate(-4deg); }
          100% { transform: scale(1.0) rotate(-4deg); }
        }
        @keyframes pvGhostSlide {
          0% { transform: translateX(6%); opacity: 0; }
          20% { opacity: 0.14; }
          100% { transform: translateX(-6%); opacity: 0.18; }
        }
        @keyframes pvStepLine {
          0% { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0px); }
        }
        @keyframes pvCinematicPushIn {
          0% { opacity: 0; transform: scale(0.75); letter-spacing: 0.08em; filter: blur(12px); }
          20% { opacity: 1; filter: blur(0px); }
          100% { opacity: 1; transform: scale(1.08); letter-spacing: 0.20em; filter: blur(0px); }
        }
        @keyframes pvBottomGlowEnter {
          0% { opacity: 0; transform: translateY(12px); filter: blur(8px); letter-spacing: 0.12em; }
          100% { opacity: 1; transform: translateY(0); filter: blur(0px); letter-spacing: 0.22em; }
        }

        /* --- Kawaii ロゴアニメーション --- */
        @keyframes kawaiiFloat {
          0%, 100% { transform: translateY(0px) rotate(-1.5deg); }
          50% { transform: translateY(-10px) rotate(1.5deg); }
        }
        @keyframes kawaiiHeartSparkle {
          0% { transform: scale(0.8) translateY(0); opacity: 0; }
          50% { transform: scale(1.2) translateY(-15px); opacity: 1; }
          100% { transform: scale(0.9) translateY(-30px); opacity: 0; }
        }
        @keyframes logoShine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .kawaii-logo-main {
          display: flex;
          align-items: center;
          gap: 6px;
          animation: kawaiiFloat 3s ease-in-out infinite;
          filter: drop-shadow(0 14px 30px rgba(255, 64, 129, 0.5));
        }
        .kawaii-num {
          font-size: clamp(70px, 12vw, 110px);
          font-weight: 900;
          color: #ff3377;
          background: linear-gradient(135deg, #ff1493 0%, #ff69b4 50%, #ff85a2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke: 5px #ffffff;
          filter: drop-shadow(0 4px 0 #ff007f);
          transform: rotate(-6deg);
          display: inline-block;
        }
        .kawaii-text {
          font-size: clamp(54px, 9vw, 84px);
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ff2d87;
          background: linear-gradient(135deg, #ff007f 0%, #ff69b4 40%, #ffb6c1 80%, #ffffff 100%);
          background-size: 200% 200%;
          animation: logoShine 4s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke: 4.5px #ffffff;
          filter: drop-shadow(0 4px 0 #e60067);
          text-shadow: 0 4px 20px rgba(255, 105, 180, 0.6);
        }
        .kawaii-heart-icon {
          font-size: clamp(34px, 5vw, 50px);
          display: inline-block;
          animation: kawaiiFloat 2s ease-in-out infinite;
          filter: drop-shadow(0 4px 8px rgba(255, 20, 147, 0.5));
        }
        .kawaii-subtitle-badge {
          margin-top: 14px;
          padding: 8px 30px;
          background: linear-gradient(90deg, #ff1493, #a855f7, #38bdf8);
          border: 2px solid #ffffff;
          border-radius: 999px;
          color: #ffffff;
          font-size: clamp(14px, 2vw, 19px);
          font-weight: 800;
          letter-spacing: 0.22em;
          box-shadow: 0 8px 24px rgba(255, 20, 147, 0.45);
          text-transform: uppercase;
        }
        .sparkle-particle {
          position: absolute;
          pointer-events: none;
          animation: kawaiiHeartSparkle 2s ease-out infinite;
        }
      </style>

      <div class="kawaii-logo-main">
        <span class="kawaii-heart-icon">💖</span>
        <span class="kawaii-num">5</span>
        <span class="kawaii-text">秒の告白</span>
        <span class="kawaii-heart-icon">✨</span>
      </div>
      <div class="kawaii-subtitle-badge">
        5 SECONDS CONFESSION 〜恋する奇跡の瞬間〜
      </div>

      <!-- キラキラ・ハート装飾 -->
      <div class="sparkle-particle" style="top: -20px; left: 10%; font-size: 32px; animation-delay: 0.2s;">✨</div>
      <div class="sparkle-particle" style="top: -30px; right: 15%; font-size: 36px; animation-delay: 0.7s;">💕</div>
      <div class="sparkle-particle" style="bottom: -15px; left: 20%; font-size: 28px; animation-delay: 1.1s;">🌸</div>
      <div class="sparkle-particle" style="bottom: -20px; right: 25%; font-size: 30px; animation-delay: 1.5s;">🌟</div>
    `;

    this.container.appendChild(this.titleLogoWrapper);

    const appEl = document.getElementById('app');
    if (appEl && appEl.parentNode) {
      appEl.parentNode.insertBefore(this.container, appEl.nextSibling);
    } else {
      document.body.appendChild(this.container);
    }
  }

  public show(): void {
    this.container.style.display = 'block';
    this.isVisible = true;
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.typoWrapper.style.opacity = '0';
    this.typoWrapper.innerHTML = '';
    this.titleLogoWrapper.style.opacity = '0';
    this.titleLogoWrapper.style.transform = 'translate(-50%, -50%) scale(0.65)';
    this.isVisible = false;
  }

  /**
   * シネマティック・動的タイポグラフィ更新
   */
  public updateSubtitle(config: PvSubtitleConfig): void {
    if (!this.isVisible) this.show();

    // テーマ設定
    const themeName = config.theme || 'day';
    const t = this.getThemeStyles(themeName);
    const layout = config.layout || 'bottom-glow';

    let html = '';

    if (layout === 'l-shape') {
      const isRight = config.side !== 'left';
      const horizContainerClass = isRight ? 'pv-l-horiz-right' : 'pv-l-horiz-left';
      const vertPosClass = isRight ? 'pv-l-vert-right' : 'pv-l-vert-left';

      html = `
        <div class="pv-l-container" style="animation: pvTextFloatDrift 6s ease-in-out infinite;">
          <!-- 縦のプロポーショナル英字 ＆ ヘアライン -->
          <div class="${vertPosClass}">
            <div style="width: 1px; flex: 1; background: linear-gradient(to bottom, transparent, ${t.lineColor}, transparent);"></div>
            <div class="pv-font-sans-proportional" style="
              writing-mode: vertical-rl;
              font-size: clamp(10px, 1.2vw, 13px);
              font-weight: 700;
              letter-spacing: 0.45em;
              text-transform: uppercase;
              color: ${t.enColor};
              animation: pvVertLineEnter 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            ">
              ${config.verticalEn || '5 SECONDS CONFESSION'}
            </div>
          </div>

          <!-- 底辺の日本語主文（横書きで「、」「っ」が完全に自然） -->
          <div class="${horizContainerClass}">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(19px, 2.7vw, 36px);
              font-weight: 700;
              color: ${t.mainText};
              white-space: nowrap;
              filter: ${t.textShadow};
              animation: pvHorizTextEnter 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            ">
              ${config.titleText || ''}
            </div>
            ${config.subText ? `
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 8px;
                font-size: clamp(11px, 1.3vw, 15px);
                font-weight: 600;
                letter-spacing: 0.35em;
                text-transform: uppercase;
                color: ${t.enColor};
                animation: pvHorizTextEnter 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
              ">
                ${config.subText}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (layout === 'ghost-smash') {
      html = `
        <div class="pv-smash-container">
          <!-- 背景の巨大ゴースト英字（プロポーショナル・幾何学サンセリフ） -->
          <div class="pv-ghost-text" style="animation: pvGhostSlide 9s linear infinite;">
            <span class="pv-font-sans-proportional" style="
              font-size: clamp(70px, 14vw, 150px);
              font-weight: 900;
              color: #ffffff;
              letter-spacing: 0.25em;
              white-space: nowrap;
              opacity: 0.15;
            ">
              ${config.ghostText || 'FALL IN LOVE'}
            </span>
          </div>

          <!-- 手前に叩きつけられる斜めコピー -->
          <div style="
            position: relative;
            z-index: 10;
            text-align: center;
            animation: pvSmashImpact 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          ">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(34px, 5.8vw, 76px);
              font-weight: 800;
              color: ${t.mainText};
              white-space: nowrap;
              filter: ${t.textShadow};
            ">
              ${config.titleText || ''}
            </div>
            ${config.subText ? `
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 12px;
                font-size: clamp(14px, 1.8vw, 22px);
                font-weight: 700;
                letter-spacing: 0.38em;
                text-transform: uppercase;
                color: ${t.enColor};
              ">
                ${config.subText}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (layout === 'step-cascade') {
      const lines = config.lines || [
        { text: 'もしも、', en: 'IF EVER' },
        { text: '世界が今日', en: 'THE WORLD ENDS' },
        { text: '終わるなら。', en: 'RIGHT TODAY' }
      ];

      html = `
        <div class="pv-step-container" style="animation: pvTextFloatDrift 6s ease-in-out infinite;">
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${lines.map((line, idx) => `
              <div class="pv-font-mincho" style="
                font-size: clamp(20px, 3.0vw, 36px);
                font-weight: 700;
                color: ${t.mainText};
                padding-left: ${idx * 48}px;
                display: flex;
                align-items: center;
                gap: 14px;
                filter: ${t.textShadow};
                animation: pvStepLine 1s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.28}s forwards;
                opacity: 0;
              ">
                <span class="pv-main-catchphrase">${line.text}</span>
                ${line.en ? `
                  <span class="pv-font-cinzel" style="
                    font-size: clamp(10px, 1.1vw, 13px);
                    font-weight: 700;
                    letter-spacing: 0.28em;
                    color: ${t.enColor};
                    text-transform: uppercase;
                  ">${line.en}</span>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (layout === 'cinema-push') {
      html = `
        <div class="pv-cinema-push-container">
          <div style="animation: pvCinematicPushIn 4.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(24px, 3.8vw, 48px);
              font-weight: 700;
              color: ${t.mainText};
              white-space: nowrap;
              filter: ${t.textShadow};
            ">
              ${config.titleText || ''}
            </div>
            ${config.subText ? `
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 14px;
                font-size: clamp(11px, 1.3vw, 15px);
                font-weight: 700;
                letter-spacing: 0.45em;
                text-transform: uppercase;
                color: ${t.enColor};
              ">
                ${config.subText}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      // bottom-glow
      html = `
        <div class="pv-bottom-glow-container" style="animation: pvTextFloatDrift 6s ease-in-out infinite;">
          <div style="text-align: center; animation: pvBottomGlowEnter 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
            <div class="pv-font-mincho pv-main-catchphrase" style="
              font-size: clamp(24px, 3.6vw, 46px);
              font-weight: 700;
              color: ${t.mainText};
              white-space: nowrap;
              filter: ${t.textShadow};
            ">
              ${config.titleText || ''}
            </div>
            ${config.subText ? `
              <div class="pv-font-cinzel pv-sub-catchphrase" style="
                margin-top: 10px;
                font-size: clamp(11px, 1.3vw, 15px);
                font-weight: 600;
                letter-spacing: 0.38em;
                text-transform: uppercase;
                color: ${t.enColor};
              ">
                ${config.subText}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    this.typoWrapper.innerHTML = html;
    this.typoWrapper.style.opacity = '1';
  }

  private getThemeStyles(theme: 'day' | 'sunset' | 'night') {
    switch (theme) {
      case 'sunset':
        return {
          mainText: '#fffbeb',
          textShadow: '0 0 4px #000000, 0 0 10px #000000, 0 2px 14px rgba(0,0,0,0.95), 0 0 30px rgba(245,158,11,0.5)',
          accentColor: '#f43f5e',
          enColor: '#fef3c7',
          lineColor: 'rgba(245, 158, 11, 0.8)',
        };
      case 'night':
        return {
          mainText: '#ffffff',
          textShadow: '0 0 4px #000000, 0 0 10px #000000, 0 2px 14px rgba(0,0,0,0.98), 0 0 24px rgba(168,85,247,0.65)',
          accentColor: '#e11d48',
          enColor: '#f3e8ff',
          lineColor: 'rgba(168, 85, 247, 0.8)',
        };
      case 'day':
      default:
        return {
          mainText: '#ffffff',
          textShadow: '0 0 4px #000000, 0 0 10px #000000, 0 2px 12px rgba(0,0,0,0.95), 0 0 25px rgba(56,189,248,0.45)',
          accentColor: '#38bdf8',
          enColor: '#e0f2fe',
          lineColor: 'rgba(56, 189, 248, 0.8)',
        };
    }
  }

  /**
   * Kawaiiタイトルロゴの表示（1:00 のクライマックスに呼び出す）
   */
  public showKawaiiTitleLogo(): void {
    if (!this.isVisible) this.show();
    this.typoWrapper.style.opacity = '0';

    this.titleLogoWrapper.style.display = 'flex';
    this.titleLogoWrapper.style.opacity = '1';
    requestAnimationFrame(() => {
      this.titleLogoWrapper.style.transform = 'translate(-50%, -50%) scale(1.05)';
      setTimeout(() => {
        this.titleLogoWrapper.style.transform = 'translate(-50%, -50%) scale(1.0)';
      }, 350);
    });
  }

  public hideKawaiiTitleLogo(): void {
    this.titleLogoWrapper.style.opacity = '0';
    this.titleLogoWrapper.style.transform = 'translate(-50%, -50%) scale(0.65)';
  }

  public dispose(): void {
    this.container.remove();
  }
}
