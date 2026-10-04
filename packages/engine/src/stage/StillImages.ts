import { resolveAssetUrl } from '../utils/path';
import { RainOverlay } from '../effects/RainOverlay';

/** 画面いっぱいの一枚絵 */
export interface StillImageSettings {
  url: string;
  /** cover = 余白なく切り抜く、contain = 全体を収めて余白を暗くする */
  fit?: 'cover' | 'contain';
}

/** 舞台の端に載せるカットイン */
export interface CutinSettings {
  url: string;
  side?: 'left' | 'right';
  /** 画面の幅に対する小窓の幅 */
  size?: number;
}

const FADE_SEC = 0.35;
const SLIDE_SEC = 0.32;
const DEFAULT_CUTIN_SIZE = 0.24;

/**
 * 舞台の上に重ねる雨と一枚絵（画面いっぱいのイベント絵と、端に載せるカットイン）。
 * 集中線・瞼などの画面演出と同じく canvas の親要素の中に置くので、メッセージウィンドウより下に描かれる
 */
export class StillImages {
  private readonly layer: HTMLDivElement;
  private readonly cg: HTMLDivElement;
  private readonly cgImage: HTMLImageElement;
  private readonly cutin: HTMLDivElement;
  private readonly cutinImage: HTMLImageElement;
  /** 雨（舞台のすぐ上。カットイン・一枚絵より下） */
  private readonly rain: RainOverlay;
  private cgKey = '';
  private cutinKey = '';

  constructor(container: HTMLElement) {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    this.layer = document.createElement('div');
    Object.assign(this.layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    container.appendChild(this.layer);
    this.rain = new RainOverlay(this.layer);

    // カットインはイベント絵の下（イベント絵を出すときは舞台ごと覆う）
    this.cutin = document.createElement('div');
    Object.assign(this.cutin.style, {
      position: 'absolute',
      // 集中線（z 45）より上、瞼・暗転（z 60）より下
      zIndex: '50',
      top: '0',
      bottom: '0',
      opacity: '0',
      transition: `transform ${SLIDE_SEC}s cubic-bezier(0.22, 1, 0.36, 1), opacity ${SLIDE_SEC}s ease`,
      filter: 'drop-shadow(0 8px 22px rgba(15, 23, 42, 0.35))',
    });
    // 斜めに切った白い縁の小窓（ペルソナの選択肢の場面のような差し込み）
    const frame = document.createElement('div');
    Object.assign(frame.style, { position: 'absolute', inset: '0', background: '#ffffff' });
    this.cutin.appendChild(frame);
    const inner = document.createElement('div');
    Object.assign(inner.style, { position: 'absolute', inset: '0', overflow: 'hidden', background: '#e2e8f0' });
    this.cutinImage = document.createElement('img');
    Object.assign(this.cutinImage.style, { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' });
    this.cutinImage.alt = '';
    // 読み込めなかった絵は出さない（壊れた画像のアイコンを見せない）
    this.cutinImage.addEventListener('error', () => this.setCutin(null));
    inner.appendChild(this.cutinImage);
    this.cutin.appendChild(inner);
    this.layer.appendChild(this.cutin);

    this.cg = document.createElement('div');
    Object.assign(this.cg.style, {
      position: 'absolute',
      // 舞台と雨より上、集中線より下
      zIndex: '20',
      inset: '0',
      background: '#000',
      opacity: '0',
      transition: `opacity ${FADE_SEC}s ease`,
    });
    this.cgImage = document.createElement('img');
    Object.assign(this.cgImage.style, { width: '100%', height: '100%', display: 'block' });
    this.cgImage.alt = '';
    this.cgImage.addEventListener('error', () => this.setCg(null));
    this.cg.appendChild(this.cgImage);
    this.layer.appendChild(this.cg);

    this.applyCutinShape('right', DEFAULT_CUTIN_SIZE, false);
  }

  /** 画面いっぱいの一枚絵（null で消す） */
  public setCg(settings: StillImageSettings | null): void {
    const key = settings ? JSON.stringify(settings) : '';
    if (key === this.cgKey) return;
    this.cgKey = key;
    if (!settings) {
      this.cg.style.opacity = '0';
      return;
    }
    this.cgImage.style.objectFit = settings.fit ?? 'cover';
    this.cgImage.src = resolveAssetUrl(settings.url);
    this.cg.style.opacity = '1';
  }

  /** 端のカットイン（null で引っ込める） */
  public setCutin(settings: CutinSettings | null): void {
    const key = settings ? JSON.stringify(settings) : '';
    if (key === this.cutinKey) return;
    const wasShown = this.cutinKey !== '';
    this.cutinKey = key;
    if (!settings) {
      this.applyCutinShape(this.cutin.dataset.side === 'left' ? 'left' : 'right', Number(this.cutin.dataset.size) || DEFAULT_CUTIN_SIZE, false);
      return;
    }
    this.cutinImage.src = resolveAssetUrl(settings.url);
    const side = settings.side ?? 'right';
    const size = settings.size ?? DEFAULT_CUTIN_SIZE;
    // 側が変わったら一度引っ込めた位置から出す
    if (wasShown && this.cutin.dataset.side !== side) this.applyCutinShape(side, size, false, true);
    requestAnimationFrame(() => this.applyCutinShape(side, size, true));
  }

  private applyCutinShape(side: 'left' | 'right', size: number, shown: boolean, instant = false): void {
    const style = this.cutin.style;
    this.cutin.dataset.side = side;
    this.cutin.dataset.size = String(size);
    style.transition = instant ? 'none' : `transform ${SLIDE_SEC}s cubic-bezier(0.22, 1, 0.36, 1), opacity ${SLIDE_SEC}s ease`;
    style.width = `${size * 100}%`;
    style.left = side === 'left' ? '0' : '';
    style.right = side === 'right' ? '0' : '';
    // 舞台側の辺を斜めに切る（縁の白と絵で同じ形）
    const slant = '18%';
    const clip = side === 'right' ? `polygon(${slant} 0, 100% 0, 100% 100%, 0 100%)` : `polygon(0 0, 100% 0, calc(100% - ${slant}) 100%, 0 100%)`;
    const innerClip =
      side === 'right'
        ? `polygon(calc(${slant} + 10px) 0, 100% 0, 100% 100%, 10px 100%)`
        : `polygon(0 0, calc(100% - 10px) 0, calc(100% - ${slant} - 10px) 100%, 0 100%)`;
    (this.cutin.children[0] as HTMLElement).style.clipPath = clip;
    (this.cutin.children[1] as HTMLElement).style.clipPath = innerClip;
    style.transform = shown ? 'translateX(0)' : `translateX(${side === 'right' ? 105 : -105}%)`;
    style.opacity = shown ? '1' : '0';
  }

  /** 画面に雨を降らせる */
  public setRain(active: boolean): void {
    this.rain.set(active);
  }

  public resize(): void {
    this.rain.resize();
  }

  public dispose(): void {
    this.rain.dispose();
    this.layer.remove();
  }
}
