import { ScenarioChoice } from '../scenario/types';
import { t } from '../i18n';
import { resolveAssetUrl } from '../utils/path';

export interface AdventureMessageWindowOptions {
  container?: HTMLElement | null;
  onNextClick?: () => void;
  onStopClick?: () => void;
  typingSpeedMs?: number;
}

export class AdventureMessageWindow {
  private parentContainer: HTMLElement | null = null;
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
    this.parentContainer = options.container ?? null;
    this.typingSpeedMs = options.typingSpeedMs ?? 24;
    this.onNextClick = options.onNextClick;
    this.onStopClick = options.onStopClick;
    this.injectStyles();
  }

  private getParentContainer(): HTMLElement {
    return this.parentContainer ?? document.getElementById('viewport-container') ?? document.body;
  }

  private injectStyles(): void {
    if (document.getElementById('adv-message-window-styles')) return;

    const style = document.createElement('style');
    style.id = 'adv-message-window-styles';
    style.textContent = `
      /* --- Message Window Container --- */
      .adv-message-container {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: clamp(160px, 30%, 270px);
        background: linear-gradient(to bottom, rgba(3, 7, 18, 0) 0%, rgba(3, 7, 18, 0.78) 24%, rgba(3, 7, 18, 0.96) 100%);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 36px 24px 20px;
        box-sizing: border-box;
        z-index: 50;
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
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 60;
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
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 60;
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
        font-size: clamp(16px, 2.2vw, 22px);
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

      /* --- Persona/Anime Style Choice Dialog & Backdrop --- */
      .adv-choices-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.5);
        backdrop-filter: blur(8px);
        z-index: 70;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        overflow: hidden;
      }

      .adv-choices-backdrop.visible {
        opacity: 1;
        pointer-events: auto;
      }

      /* Dynamic VFX Prominent Speedlines & Diagonal Action Bands */
      .adv-vfx-speedlines {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 1;
      }

      /* Solid dynamic action bands (Visible & gentle continuous floating) */
      .adv-vfx-band {
        position: absolute;
        left: -60%;
        width: 220%;
        transform: rotate(-18deg);
        pointer-events: none;
      }

      .adv-vfx-band.b1 {
        top: 14%;
        height: 42px;
        background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #1e3a8a 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 24px rgba(29, 78, 216, 0.45);
        opacity: 0.7;
        animation: vfx-light-flow-slow 7.5s linear infinite, vfx-band-sway-1 8s ease-in-out infinite alternate;
      }

      .adv-vfx-band.b2 {
        top: 60%;
        height: 30px;
        background: linear-gradient(90deg, #0369a1 0%, #0ea5e9 50%, #0369a1 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 20px rgba(2, 132, 199, 0.45);
        opacity: 0.75;
        animation: vfx-light-flow-rev 6.5s linear infinite, vfx-band-sway-2 7s ease-in-out infinite alternate;
      }

      .adv-vfx-band.b3 {
        top: 82%;
        height: 18px;
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #0284c7 100%);
        background-size: 200% 100%;
        opacity: 0.8;
        animation: vfx-light-flow-slow 6s linear infinite, vfx-band-sway-3 6s ease-in-out infinite alternate;
      }

      /* Glowing Laser Slashes (Continuous dynamic floating & light streams) */
      .adv-vfx-beam {
        position: absolute;
        left: -60%;
        width: 220%;
        transform: rotate(-18deg);
        pointer-events: none;
      }

      /* Cyan Laser Beam */
      .adv-vfx-beam.m1 {
        top: 22%;
        height: 8px;
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 25%, #ffffff 50%, #38bdf8 75%, #0284c7 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 20px #38bdf8, 0 0 36px rgba(56, 189, 248, 0.9);
        opacity: 0.9;
        animation: vfx-light-flow-fast 4.5s linear infinite, vfx-beam-sway-1 5.5s ease-in-out infinite alternate;
      }

      /* Deep Blue Laser Beam */
      .adv-vfx-beam.m2 {
        top: 46%;
        height: 9px;
        background: linear-gradient(90deg, #1e40af 0%, #3b82f6 30%, #93c5fd 50%, #3b82f6 70%, #1e40af 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 22px #38bdf8, 0 0 44px rgba(37, 99, 235, 0.95);
        opacity: 0.9;
        animation: vfx-light-flow-slow 5.5s linear infinite, vfx-beam-sway-2 6.8s ease-in-out infinite alternate;
      }

      /* Yellow Laser Beam */
      .adv-vfx-beam.m3 {
        top: 72%;
        height: 8px;
        background: linear-gradient(90deg, #ca8a04 0%, #facc15 25%, #fef08a 50%, #facc15 75%, #ca8a04 100%);
        background-size: 200% 100%;
        box-shadow: 0 0 18px rgba(250, 204, 21, 0.95), 0 0 32px rgba(250, 204, 21, 0.6);
        opacity: 0.92;
        animation: vfx-light-flow-fast 4.8s linear infinite, vfx-beam-sway-3 5.8s ease-in-out infinite alternate;
      }

      /* Sharp Speed Cuts */
      .adv-vfx-line {
        position: absolute;
        left: -60%;
        width: 220%;
        height: 2px;
        background: #38bdf8;
        transform: rotate(-18deg);
        opacity: 0.8;
        pointer-events: none;
      }

      .adv-vfx-line.l1 {
        top: 8%;
        animation: vfx-beam-sway-1 4.2s ease-in-out infinite alternate;
      }

      .adv-vfx-line.l2 {
        top: 34%;
        height: 3px;
        animation: vfx-beam-sway-3 5s ease-in-out infinite alternate;
      }

      .adv-vfx-line.l3 {
        top: 56%;
        animation: vfx-beam-sway-2 5.5s ease-in-out infinite alternate;
      }

      .adv-vfx-line.l4 {
        top: 88%;
        height: 3px;
        animation: vfx-beam-sway-1 6.2s ease-in-out infinite alternate;
      }

      /* Streaming light across borders */
      @keyframes vfx-light-flow-fast {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      @keyframes vfx-light-flow-slow {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      @keyframes vfx-light-flow-rev {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      /* Vertical / Transverse Sway Motions (Visibly drifting without being too fast) */
      @keyframes vfx-band-sway-1 {
        0% {
          transform: rotate(-18deg) translateY(-14px);
        }
        100% {
          transform: rotate(-18deg) translateY(16px);
        }
      }

      @keyframes vfx-band-sway-2 {
        0% {
          transform: rotate(-18deg) translateY(18px);
        }
        100% {
          transform: rotate(-18deg) translateY(-16px);
        }
      }

      @keyframes vfx-band-sway-3 {
        0% {
          transform: rotate(-18deg) translateY(-12px);
        }
        100% {
          transform: rotate(-18deg) translateY(14px);
        }
      }

      @keyframes vfx-beam-sway-1 {
        0% {
          transform: rotate(-18deg) translateY(-20px);
        }
        100% {
          transform: rotate(-18deg) translateY(22px);
        }
      }

      @keyframes vfx-beam-sway-2 {
        0% {
          transform: rotate(-18deg) translateY(24px);
        }
        100% {
          transform: rotate(-18deg) translateY(-18px);
        }
      }

      @keyframes vfx-beam-sway-3 {
        0% {
          transform: rotate(-18deg) translateY(-22px);
        }
        100% {
          transform: rotate(-18deg) translateY(25px);
        }
      }

      /* Dynamic VFX Shockwave Rings */
      .adv-vfx-rings {
        position: absolute;
        left: 10%;
        bottom: 10%;
        width: 10px;
        height: 10px;
        pointer-events: none;
        z-index: 1;
      }

      .adv-vfx-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 2px solid rgba(59, 130, 246, 0.7);
        border-radius: 50%;
        opacity: 0;
      }

      .adv-vfx-ring.r1 {
        animation: vfx-ring-ripple 0.75s cubic-bezier(0.1, 0.85, 0.25, 1) 0.08s forwards;
      }

      .adv-vfx-ring.r2 {
        animation: vfx-ring-ripple 0.85s cubic-bezier(0.1, 0.85, 0.25, 1) 0.18s forwards;
      }

      .adv-vfx-ring.r3 {
        animation: vfx-ring-ripple 0.95s cubic-bezier(0.1, 0.85, 0.25, 1) 0.28s forwards;
      }

      @keyframes vfx-ring-ripple {
        0% {
          width: 20px;
          height: 20px;
          opacity: 0.95;
          border-color: rgba(96, 165, 250, 0.95);
        }
        100% {
          width: 440px;
          height: 440px;
          opacity: 0;
          border-color: rgba(37, 99, 235, 0);
        }
      }

      /* Bottom Solid Accent Bar (in front of characters) */
      .adv-vfx-bottom-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: clamp(28px, 4vh, 38px);
        background: #1d4ed8;
        border-top: 2px solid #38bdf8;
        clip-path: polygon(0 35%, 100% 0%, 100% 100%, 0% 100%);
        z-index: 10;
        box-shadow: 0 -6px 20px rgba(29, 78, 216, 0.6);
        animation: vfx-bottom-bar-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        pointer-events: none;
      }

      @keyframes vfx-bottom-bar-slide {
        0% {
          transform: translateY(100%);
          opacity: 0;
        }
        100% {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* Character Cut-Ins */
      .adv-cutin-char {
        position: absolute;
        bottom: 0;
        pointer-events: none;
        user-select: none;
        z-index: 3;
      }

      .adv-cutin-left {
        left: -1%;
        height: 85%;
        max-height: 88%;
        animation: cutin-slide-left 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .adv-cutin-right {
        right: 0%;
        height: 76%;
        max-height: 80%;
        animation: cutin-slide-right 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
      }

      .adv-char-shadow {
        position: absolute;
        inset: 0;
        z-index: 1;
        transform: translate(14px, -10px);
        filter: brightness(0) saturate(100%) invert(11%) sepia(94%) saturate(6000%) hue-rotate(230deg) brightness(85%) contrast(120%);
        opacity: 0.96;
      }

      .adv-char-shadow img,
      .adv-char-main img {
        height: 100%;
        width: auto;
        max-height: 100%;
        object-fit: contain;
        display: block;
      }

      .adv-char-main {
        position: relative;
        height: 100%;
        z-index: 2;
        filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.65));
      }

      @keyframes cutin-slide-left {
        0% {
          opacity: 0;
          transform: translate(-50px, 40px) scale(0.94);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
      }

      @keyframes cutin-slide-right {
        0% {
          opacity: 0;
          transform: translate(50px, 40px) scale(0.94);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
      }

      /* Thinking Time Circular Badge (Solid Blue) */
      .adv-thinking-circle-badge {
        position: absolute;
        left: 2%;
        bottom: 2%;
        width: clamp(135px, 18.5vw, 180px);
        height: clamp(135px, 18.5vw, 180px);
        border-radius: 50%;
        background: #1d4ed8;
        border: 3px solid #000000;
        box-shadow: -6px 6px 0px #000000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 12;
        user-select: none;
        pointer-events: none;
        animation: badge-pop-in 0.4s cubic-bezier(0.12, 1.25, 0.28, 1.15) 0.12s both;
      }

      @keyframes badge-pop-in {
        0% {
          opacity: 0;
          transform: scale(0.3) rotate(-15deg);
        }
        100% {
          opacity: 1;
          transform: scale(1) rotate(-4deg);
        }
      }

      .adv-tt-line {
        display: flex;
        justify-content: center;
        align-items: center;
        white-space: nowrap;
        font-family: 'Impact', 'Arial Black', sans-serif;
        color: #ffffff;
        text-shadow: 2px 2px 0px #000000, 0 0 10px rgba(255, 255, 255, 0.5);
        line-height: 1.05;
        letter-spacing: 0.04em;
      }

      .adv-tt-line1 {
        font-size: clamp(20px, 2.7vw, 26px);
      }

      .adv-tt-line2 {
        font-size: clamp(24px, 3.2vw, 32px);
        font-weight: 900;
      }

      .adv-tt-char {
        display: inline-block;
        opacity: 0;
        transform: translateY(-14px) scale(1.6);
        animation: tt-char-drop 0.28s cubic-bezier(0.12, 1.25, 0.28, 1.15) forwards;
      }

      .adv-tt-space {
        display: inline-block;
        width: 0.3em;
      }

      @keyframes tt-char-drop {
        0% {
          opacity: 0;
          transform: translateY(-14px) scale(1.6) rotate(-8deg);
        }
        70% {
          opacity: 1;
          transform: translateY(2px) scale(0.92) rotate(2deg);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1) rotate(0deg);
        }
      }

      /* Dynamic Persona Typography Title (Top Center) */
      .adv-persona-title-container {
        position: absolute;
        top: 10%;
        left: 50%;
        transform: translateX(-50%) skewX(-8deg);
        z-index: 25;
        pointer-events: none;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 20px;
      }

      /* Dynamic Slash Background Accent */
      .adv-p-bg-slash {
        position: absolute;
        top: 50%;
        left: -40px;
        right: -40px;
        height: clamp(38px, 4.8vw, 56px);
        background: #0f172a;
        transform: translateY(-50%) skewX(-10deg);
        z-index: 1;
        opacity: 0;
        border-top: 3px solid #38bdf8;
        border-bottom: 3px solid #38bdf8;
        box-shadow: 0 0 24px rgba(56, 189, 248, 0.45);
        animation: persona-slash-enter 0.34s cubic-bezier(0.16, 1, 0.3, 1) 0.04s forwards;
      }

      @keyframes persona-slash-enter {
        0% {
          opacity: 0;
          transform: translateY(-50%) skewX(-10deg) scaleX(0.1);
        }
        100% {
          opacity: 0.92;
          transform: translateY(-50%) skewX(-10deg) scaleX(1);
        }
      }

      .adv-persona-text-row {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: clamp(10px, 1.8vw, 22px);
      }

      .adv-p-word {
        display: flex;
        align-items: center;
        gap: 3px;
      }

      /* Persona Letter Cutout Tile */
      .adv-p-char {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'Impact', 'Montserrat', 'Arial Black', sans-serif;
        font-size: clamp(28px, 3.8vw, 48px);
        font-weight: 900;
        line-height: 1;
        padding: clamp(4px, 0.6vw, 8px) clamp(8px, 1.1vw, 14px);
        background: #0f172a;
        color: #ffffff;
        border: 2.5px solid #ffffff;
        box-shadow: 4px 4px 0px #0b1d47;
        border-radius: 3px;
        opacity: 0;
        transform-origin: center center;
        animation: persona-char-slam 0.28s cubic-bezier(0.12, 1.25, 0.28, 1.15) forwards;
        animation-delay: var(--delay, 0s);
      }

      /* High-contrast tiles for Persona typography rhythm */
      .adv-p-char.accent {
        background: #ffffff;
        color: #0f172a;
        border-color: #0f172a;
        box-shadow: 4px 4px 0px #0284c7;
      }

      .adv-p-char.accent-cyan {
        background: #0284c7;
        color: #ffffff;
        border-color: #ffffff;
        box-shadow: 4px 4px 0px #0b1d47;
      }

      .adv-p-char.bang {
        background: #facc15;
        color: #0f172a;
        border-color: #0f172a;
        box-shadow: 4px 4px 0px #0b1d47;
        font-size: clamp(30px, 4.2vw, 52px);
      }

      @keyframes persona-char-slam {
        0% {
          opacity: 0;
          transform: scale(2.8) translateY(-40px) rotate(-16deg);
          filter: blur(6px);
        }
        65% {
          opacity: 1;
          transform: scale(0.92) translateY(3px) rotate(calc(var(--rot, 0deg) * -0.5));
          filter: blur(0);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0) rotate(var(--rot, 0deg));
        }
      }

      /* Choices Container */
      .adv-choices-container {
        position: absolute;
        top: 54%;
        left: 51%;
        transform: translate(-50%, -50%);
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 20px;
        width: 52%;
        max-width: 580px;
        min-width: 350px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .adv-choices-container.visible {
        pointer-events: auto;
        opacity: 1;
      }

      /* Pop & Bold Anime Choice Card (White bg, thick outline, solid shadow) */
      .adv-choice-btn {
        position: relative;
        background: #ffffff;
        color: #0f172a;
        font-family: 'Kiwi Maru', 'Hiragino Mincho ProN', sans-serif;
        font-size: clamp(15px, 1.6vw, 19px);
        font-weight: 800;
        letter-spacing: 0.02em;
        padding: 16px 24px 16px 56px;
        border: 3.5px solid #0f172a;
        border-radius: 8px;
        overflow: visible;
        box-shadow: 7px 7px 0px #0b1d47;
        cursor: pointer;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 14px;
        user-select: none;
        transform-origin: center center;
        transform: skewX(-6deg);
        opacity: 0;
        z-index: 1;
        transition: transform 0.2s cubic-bezier(0.18, 1.25, 0.32, 1.15), background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
      }

      .adv-choice-btn.slam-in {
        animation: choice-slice-in 0.36s cubic-bezier(0.12, 1.2, 0.28, 1.15) both;
      }

      @keyframes choice-slice-in {
        0% {
          opacity: 0;
          transform: translate(90px, -6px) skewX(-6deg) scaleX(1.12);
          filter: blur(8px);
        }
        65% {
          opacity: 1;
          transform: translate(-5px, 1px) skewX(-6deg) scaleX(0.98);
          filter: blur(0);
        }
        100% {
          opacity: 1;
          transform: translate(0, 0) skewX(-6deg) scaleX(1);
        }
      }

      /* Number Badge: Large, Bold, Overflowing/Popping Out of the Card (Ahead of speech tail) */
      .adv-choice-badge {
        position: absolute;
        left: -18px;
        top: -12px;
        background: #0284c7;
        color: #ffffff;
        border: 3px solid #0f172a;
        box-shadow: 3px 3px 0px #0f172a;
        font-family: 'Impact', 'Arial Black', sans-serif;
        font-size: clamp(24px, 2.5vw, 32px);
        font-weight: 900;
        padding: 3px 12px;
        border-radius: 6px;
        transform: rotate(-6deg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 0.05em;
        line-height: 1;
        flex-shrink: 0;
        z-index: 15;
        transition: transform 0.2s cubic-bezier(0.18, 1.25, 0.32, 1.15), background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
      }

      .adv-choice-text {
        position: relative;
        z-index: 5;
        flex: 1;
        line-height: 1.4;
      }

      /* Hover States: Slightly bigger, deeper shadow, pop colors */
      .adv-choice-btn:hover {
        background: #ffffff;
        border-color: #0284c7;
        color: #0284c7;
        transform: translate(-10px, -2px) skewX(-6deg) scale(1.05);
        box-shadow: 11px 11px 0px #0b1d47;
      }

      .adv-choice-btn:hover .adv-choice-badge {
        background: #facc15;
        color: #0f172a;
        border-color: #0f172a;
        transform: rotate(-2deg) scale(1.12);
        box-shadow: 4px 4px 0px #0f172a;
      }

      .adv-choice-btn:active {
        transform: translate(-6px, 1px) skewX(-6deg) scale(0.99);
        box-shadow: 5px 5px 0px #0b1d47;
      }

      /* Seamless Speech Balloon Arrow on Hover (Behind badge z-index:1, no box-shadow, matching cyan border) */
      .adv-choice-speech-tail {
        position: absolute;
        right: calc(100% - 3px);
        top: 0;
        bottom: 0;
        transform: scaleX(0);
        transform-origin: right center;
        width: clamp(80px, 11vw, 150px);
        pointer-events: none;
        z-index: 1;
        opacity: 0;
        overflow: visible;
        transition: transform 0.22s cubic-bezier(0.12, 1.25, 0.28, 1.15), opacity 0.18s ease;
      }

      .adv-choice-btn:hover .adv-choice-speech-tail {
        transform: scaleX(1);
        opacity: 1;
      }

      .adv-speech-tail-svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }

      @keyframes adv-bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(6px);
        }
      }

      /* --- Eyelid Closing / Opening Transition Curtains --- */
      .adv-eyelid-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 45;
        overflow: hidden;
      }

      .adv-eyelid {
        position: absolute;
        left: -8%;
        width: 116%;
        height: 56%;
        background: #000000;
        transition: transform 0.95s cubic-bezier(0.22, 1, 0.36, 1);
        box-shadow: 0 0 50px 30px rgba(0, 0, 0, 0.95);
      }

      .adv-eyelid-top {
        top: 0;
        transform: translateY(-102%);
        border-bottom-left-radius: 50% 60px;
        border-bottom-right-radius: 50% 60px;
      }

      .adv-eyelid-bottom {
        bottom: 0;
        transform: translateY(102%);
        border-top-left-radius: 50% 60px;
        border-top-right-radius: 50% 60px;
      }

      .adv-eyelid-overlay.closed .adv-eyelid-top {
        transform: translateY(0%);
      }

      .adv-eyelid-overlay.closed .adv-eyelid-bottom {
        transform: translateY(0%);
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

    this.resetEyelids();

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
          this.eyelidOverlayEl?.remove();
          this.eyelidOverlayEl = null;
          topControls?.remove();
        }
      }, 400);
    }
  }

  private eyelidOverlayEl: HTMLDivElement | null = null;

  private createEyelidOverlay(): void {
    if (this.eyelidOverlayEl) return;
    const parent = this.getParentContainer();
    const overlay = document.createElement('div');
    overlay.className = 'adv-eyelid-overlay';
    overlay.innerHTML = `
      <div class="adv-eyelid adv-eyelid-top"></div>
      <div class="adv-eyelid adv-eyelid-bottom"></div>
    `;
    parent.appendChild(overlay);
    this.eyelidOverlayEl = overlay;
  }

  public setEyelidClosed(closed: boolean): void {
    this.createEyelidOverlay();
    if (closed) {
      this.eyelidOverlayEl?.classList.add('closed');
    } else {
      this.eyelidOverlayEl?.classList.remove('closed');
    }
  }

  public resetEyelids(): void {
    if (this.eyelidOverlayEl) {
      this.eyelidOverlayEl.classList.remove('closed');
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

  private buildAnimatedLetters(text: string, startDelaySec: number, stepSec = 0.032): string {
    return text
      .split('')
      .map((ch, idx) => {
        if (ch === ' ') return '<span class="adv-tt-space">&nbsp;</span>';
        const delay = (startDelaySec + idx * stepSec).toFixed(3);
        return `<span class="adv-tt-char" style="animation-delay: ${delay}s">${ch}</span>`;
      })
      .join('');
  }

  private getSpeechTailSVG(index: number, total: number): string {
    let targetY = 30;
    if (total === 1) targetY = 30;
    else if (index === 0) targetY = 56; // points down-left towards Hero's mouth
    else if (index === 1) targetY = 16; // points up-left towards Hero's mouth
    else targetY = -14; // points up-left towards Hero's mouth

    return `
      <div class="adv-choice-speech-tail">
        <svg class="adv-speech-tail-svg" viewBox="0 0 150 60" preserveAspectRatio="none">
          <!-- Seamless Speech Balloon Arrow Polygon Fill (White matching button) -->
          <polygon points="150,16 150,44 0,${targetY}" fill="#ffffff" />
          <!-- Speech Balloon Arrow Outline with cyan border matching button hover -->
          <path d="M 150,16 L 0,${targetY} L 150,44" fill="none" stroke="#0284c7" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </div>
    `;
  }

  private buildPersonaChoiceTitle(): string {
    const words = [
      {
        letters: [
          { ch: 'M', cls: 'accent', rot: -6 },
          { ch: 'a', cls: '', rot: 3 },
          { ch: 'k', cls: '', rot: -4 },
          { ch: 'e', cls: '', rot: 2 },
        ],
      },
      {
        letters: [
          { ch: 'Y', cls: 'accent-cyan', rot: 4 },
          { ch: 'o', cls: '', rot: -3 },
          { ch: 'u', cls: '', rot: 5 },
          { ch: 'r', cls: '', rot: -2 },
        ],
      },
      {
        letters: [
          { ch: 'C', cls: 'accent', rot: -5 },
          { ch: 'h', cls: '', rot: 3 },
          { ch: 'o', cls: '', rot: -3 },
          { ch: 'i', cls: '', rot: 4 },
          { ch: 'c', cls: '', rot: -4 },
          { ch: 'e', cls: '', rot: 3 },
          { ch: '!', cls: 'bang', rot: -6 },
          { ch: '!', cls: 'bang', rot: 6 },
        ],
      },
    ];

    let delay = 0.08;
    const step = 0.038;

    const wordsHtml = words
      .map((w) => {
        const lettersHtml = w.letters
          .map((item) => {
            const currentDelay = delay.toFixed(3);
            delay += step;
            const extraCls = item.cls ? ` ${item.cls}` : '';
            return `<span class="adv-p-char${extraCls}" style="--delay: ${currentDelay}s; --rot: ${item.rot}deg;">${item.ch}</span>`;
          })
          .join('');
        return `<div class="adv-p-word">${lettersHtml}</div>`;
      })
      .join('');

    return `
      <div class="adv-persona-title-container">
        <div class="adv-p-bg-slash"></div>
        <div class="adv-persona-text-row">
          ${wordsHtml}
        </div>
      </div>
    `;
  }

  private playSE(url: string, volume = 0.5): void {
    try {
      const audio = new Audio(resolveAssetUrl(url));
      audio.volume = volume;
      audio.play().catch(() => {
        // Safe catch for autoplay restrictions
      });
    } catch {
      // Safe catch
    }
  }

  public showChoices(
    choices: ScenarioChoice[],
    onSelect: (choice: ScenarioChoice) => void
  ): void {
    this.isChoicesVisible = true;
    if (this.nextIconEl) {
      this.nextIconEl.classList.remove('show');
    }

    // Play Choices Shown SE
    this.playSE('/se/items_shown.mp3', 0.6);

    let backdrop = document.getElementById('adv-choices-backdrop') as HTMLDivElement | null;
    if (!backdrop) {
      const parent = this.getParentContainer();
      backdrop = document.createElement('div');
      backdrop.id = 'adv-choices-backdrop';
      backdrop.className = 'adv-choices-backdrop';
      parent.appendChild(backdrop);
    }

    // 1. Render Dynamic Prominent VFX, Cut-Ins, Bottom Bar, Thinking Time Badge, and Persona Dynamic Title
    backdrop.innerHTML = `
      <div class="adv-vfx-speedlines">
        <div class="adv-vfx-band b1"></div>
        <div class="adv-vfx-band b2"></div>
        <div class="adv-vfx-band b3"></div>
        <div class="adv-vfx-beam m1"></div>
        <div class="adv-vfx-beam m2"></div>
        <div class="adv-vfx-beam m3"></div>
        <div class="adv-vfx-line l1"></div>
        <div class="adv-vfx-line l2"></div>
        <div class="adv-vfx-line l3"></div>
        <div class="adv-vfx-line l4"></div>
      </div>
      <div class="adv-vfx-rings">
        <div class="adv-vfx-ring r1"></div>
        <div class="adv-vfx-ring r2"></div>
        <div class="adv-vfx-ring r3"></div>
      </div>

      <!-- Persona Dynamic Cutout Typography Title -->
      ${this.buildPersonaChoiceTitle()}

      <!-- Left Character: Hero with dark blue silhouette shadow -->
      <div class="adv-cutin-char adv-cutin-left">
        <div class="adv-char-shadow">
          <img src="${resolveAssetUrl('/img/hero.png')}" alt="" />
        </div>
        <div class="adv-char-main">
          <img src="${resolveAssetUrl('/img/hero.png')}" alt="Hero" />
        </div>
        <div class="adv-thinking-circle-badge">
          <div class="adv-tt-line adv-tt-line1">${this.buildAnimatedLetters('Thinking', 0.10, 0.026)}</div>
          <div class="adv-tt-line adv-tt-line2">${this.buildAnimatedLetters('Time', 0.32, 0.035)}</div>
        </div>
      </div>

      <!-- Right Character: Aoi with dark blue silhouette shadow -->
      <div class="adv-cutin-char adv-cutin-right">
        <div class="adv-char-shadow">
          <img src="${resolveAssetUrl('/img/aoi.png')}" alt="" />
        </div>
        <div class="adv-char-main">
          <img src="${resolveAssetUrl('/img/aoi.png')}" alt="Aoi" />
        </div>
      </div>

      <!-- Front Bottom Accent Bar (in front of characters) -->
      <div class="adv-vfx-bottom-bar"></div>
    `;

    // 2. Choices Container (Center)
    const choicesContainer = document.createElement('div');
    choicesContainer.className = 'adv-choices-container';
    backdrop.appendChild(choicesContainer);
    this.choicesContainerEl = choicesContainer;

    choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      btn.className = 'adv-choice-btn slam-in';
      btn.style.animationDelay = `${(0.26 + index * 0.09).toFixed(2)}s`;

      btn.innerHTML = `
        ${this.getSpeechTailSVG(index, choices.length)}
        <span class="adv-choice-badge">0${index + 1}</span>
        <span class="adv-choice-text">${this.escapeHTML(choice.text)}</span>
      `;

      // Play Hover SE on mouseenter
      btn.addEventListener('mouseenter', () => {
        this.playSE('/se/items_hover.mp3', 0.45);
      });

      // Play Select SE on click
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playSE('/se/items_chose.mp3', 0.65);
        this.hideChoices();
        onSelect(choice);
      });
      choicesContainer.appendChild(btn);
    });

    requestAnimationFrame(() => {
      backdrop?.classList.add('visible');
      choicesContainer.classList.add('visible');
    });
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
    setTimeout(() => {
      if (!this.isChoicesVisible && backdrop) {
        backdrop.innerHTML = '';
        this.choicesContainerEl = null;
      }
    }, 300);
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
    const parent = this.getParentContainer();

    // Location Badge (Top Left)
    const locationBadge = document.createElement('div');
    locationBadge.className = 'adv-location-badge';
    if (this.currentLocation) {
      locationBadge.innerHTML = `📍 ${this.escapeHTML(this.currentLocation)}`;
    }
    parent.appendChild(locationBadge);
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

    parent.appendChild(container);
    this.container = container;

    // Top Right Floating Controls (Stop Button)
    const topControls = document.createElement('div');
    topControls.id = 'adv-top-controls';
    topControls.className = 'adv-top-controls';
    topControls.innerHTML = `
      <button class="adv-stop-btn" title="${t().scenario.endScenario} (ESC)">
        <span>⏹</span> ${t().scenario.endScenario}
      </button>
    `;
    topControls.querySelector('.adv-stop-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onStopClick?.();
    });
    parent.appendChild(topControls);

    this.createChoicesDOM();
  }

  private createChoicesDOM(): void {
    if (document.getElementById('adv-choices-backdrop')) return;
    const parent = this.getParentContainer();

    const backdrop = document.createElement('div');
    backdrop.id = 'adv-choices-backdrop';
    backdrop.className = 'adv-choices-backdrop';
    parent.appendChild(backdrop);
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
