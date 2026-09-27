import { FocusLinesOverlay } from '../effects/FocusLinesOverlay';

/** 画面の切り替え演出（fade_black = 暗転してから映す、eyelid_close = 瞼を閉じる、eyelid_blink = まばたき） */
export type ScreenTransitionKind = 'fade_black' | 'eyelid_close' | 'eyelid_blink';

const EYELID_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EYELID_CLOSE_SEC = 0.95;

/**
 * 舞台の上に重ねる画面演出（集中線・瞼・暗転）。canvas の親要素の中に置くので、
 * メッセージウィンドウなど親要素の外の UI より下に描かれる
 */
export class ScreenEffects {
  private readonly layer: HTMLDivElement;
  private readonly focusLines: FocusLinesOverlay;
  private readonly eyelidTop: HTMLDivElement;
  private readonly eyelidBottom: HTMLDivElement;
  private readonly blackout: HTMLDivElement;
  private focusLinesOn = false;
  private eyelidsClosed = false;
  private timers: number[] = [];

  constructor(container: HTMLElement) {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    this.layer = document.createElement('div');
    Object.assign(this.layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    container.appendChild(this.layer);

    this.focusLines = new FocusLinesOverlay(this.layer);
    this.eyelidTop = this.createEyelid('top');
    this.eyelidBottom = this.createEyelid('bottom');
    this.blackout = document.createElement('div');
    Object.assign(this.blackout.style, { position: 'absolute', inset: '0', background: '#000', opacity: '0' });
    this.layer.appendChild(this.blackout);
  }

  /** 上下から閉じる暗幕（端を丸くして瞼に見せる） */
  private createEyelid(side: 'top' | 'bottom'): HTMLDivElement {
    const eyelid = document.createElement('div');
    Object.assign(eyelid.style, {
      position: 'absolute',
      left: '-8%',
      width: '116%',
      height: '56%',
      background: '#000',
      boxShadow: '0 0 50px 30px rgba(0, 0, 0, 0.95)',
      [side]: '0',
      transform: `translateY(${side === 'top' ? -102 : 102}%)`,
      transition: `transform ${EYELID_CLOSE_SEC}s ${EYELID_EASING}`,
      ...(side === 'top'
        ? { borderBottomLeftRadius: '50% 60px', borderBottomRightRadius: '50% 60px' }
        : { borderTopLeftRadius: '50% 60px', borderTopRightRadius: '50% 60px' }),
    });
    this.layer.appendChild(eyelid);
    return eyelid;
  }

  public setFocusLines(enabled: boolean): void {
    if (this.focusLinesOn === enabled) return;
    this.focusLinesOn = enabled;
    if (enabled) this.focusLines.show();
    else this.focusLines.hide();
  }

  /** 瞼を閉じる・開ける（seconds は動かす秒数。0 で即座に） */
  private setEyelids(closed: boolean, seconds = EYELID_CLOSE_SEC): void {
    this.eyelidsClosed = closed;
    for (const [eyelid, sign] of [[this.eyelidTop, -1], [this.eyelidBottom, 1]] as const) {
      eyelid.style.transition = seconds > 0 ? `transform ${seconds}s ${EYELID_EASING}` : 'none';
      eyelid.style.transform = `translateY(${closed ? 0 : sign * 102}%)`;
    }
  }

  /**
   * カットの切り替え演出。カットが変わるたびに呼ぶ（null なら瞼を開けて何もしない）。
   * instant が true なら動きを見せずに最終の状態にする（Studio で途中の時刻へ飛んだとき）
   */
  public playTransition(kind: ScreenTransitionKind | null, instant = false): void {
    this.clearTimers();
    this.blackout.style.transition = 'none';
    this.blackout.style.opacity = '0';
    if (kind === 'eyelid_close') {
      this.setEyelids(true, instant ? 0 : EYELID_CLOSE_SEC);
      return;
    }
    if (this.eyelidsClosed) this.setEyelids(false, instant ? 0 : 0.6);
    if (instant) return;
    if (kind === 'eyelid_blink') {
      // パチ、パチと2回まばたく
      [0, 0.42].forEach((start) => {
        this.later(start, () => this.setEyelids(true, 0.12));
        this.later(start + 0.16, () => this.setEyelids(false, 0.2));
      });
    } else if (kind === 'fade_black') {
      // 暗転したところから新しいカットを映す（モデルの切り替えが見えないよう少し黒で待つ）
      this.blackout.style.opacity = '1';
      this.later(0.35, () => {
        this.blackout.style.transition = 'opacity 0.5s ease-out';
        this.blackout.style.opacity = '0';
      });
    }
  }

  private later(seconds: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, seconds * 1000));
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];
  }

  public resize(): void {
    if (this.focusLinesOn) this.focusLines.resize();
  }

  public dispose(): void {
    this.clearTimers();
    this.focusLines.dispose();
    this.layer.remove();
  }
}
