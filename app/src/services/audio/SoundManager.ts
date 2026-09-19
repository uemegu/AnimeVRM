import { resolveAssetUrl } from '../../utils/path';
import { BgmId, resolveBgmInfo } from '../../data/bgmPresets';

export interface SoundManagerOptions {
  masterVolume?: number;
  bgmVolume?: number;
  seVolume?: number;
  voiceVolume?: number;
}

export class SoundManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmTarget: BgmId | string | null = null;
  private currentBgmUrl: string | null = null;
  private currentVolumeScale: number = 1.0;
  private currentSeAudio: HTMLAudioElement | null = null;

  public masterVolume: number = 1.0;
  public bgmVolume: number = 0.4;
  public seVolume: number = 0.6;
  public voiceVolume: number = 1.0;

  constructor(options: SoundManagerOptions = {}) {
    if (options.masterVolume !== undefined) this.masterVolume = options.masterVolume;
    if (options.bgmVolume !== undefined) this.bgmVolume = options.bgmVolume;
    if (options.seVolume !== undefined) this.seVolume = options.seVolume;
    if (options.voiceVolume !== undefined) this.voiceVolume = options.voiceVolume;

    if (typeof window !== 'undefined') {
      (window as any).__soundManager = this;
    }
  }

  /**
   * BGM 再生（BGM ID または URL による指定、同一曲の場合はシームレス継続）
   * @param target BGM ID ('main_theme', 'main_bgm', 'night_room', etc.) または直接URL
   * @param volumeScale 任意の音量倍率（未指定時はプリセットのデフォルト値を使用）
   */
  public playBgm(target: BgmId | string, volumeScale?: number): void {
    const bgmInfo = resolveBgmInfo(target);
    const resolvedUrl = resolveAssetUrl(bgmInfo.url);
    const finalScale = volumeScale !== undefined ? volumeScale : bgmInfo.volumeScale;

    this.currentVolumeScale = finalScale;

    // 既に同一の曲（IDまたはURL）で bgmAudio が存在する場合
    const isSameTarget = this.currentBgmTarget === target || this.currentBgmUrl === resolvedUrl;
    if (isSameTarget && this.bgmAudio) {
      this.bgmAudio.volume = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume * finalScale));
      this.currentBgmTarget = target;
      if (this.bgmAudio.paused) {
        this.bgmAudio.play().catch((err) => {
          console.warn('BGM auto-play was blocked or failed:', err);
        });
      }
      return;
    }

    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }

    this.currentBgmTarget = target;
    this.currentBgmUrl = resolvedUrl;
    this.bgmAudio = new Audio(resolvedUrl);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume * finalScale));
    this.bgmAudio.play().catch((err) => {
      console.warn('BGM auto-play was blocked or failed:', err);
    });
  }

  /**
   * ユーザー操作時にオーディオ再生制限を解除するためのアンロック処理
   * ユーザーインタラクションのイベントハンドラ内で呼び出す
   */
  public unlockAudio(): void {
    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      silentAudio.volume = 0;
      silentAudio.play().then(() => {
        silentAudio.pause();
      }).catch(() => {});

      // メインテーマ用オーディオ要素をユーザー操作コンテキスト内で事前作成・アンロック
      if (!this.bgmAudio) {
        const bgmInfo = resolveBgmInfo('main_theme');
        const resolvedUrl = resolveAssetUrl(bgmInfo.url);
        this.currentBgmTarget = 'main_theme';
        this.currentBgmUrl = resolvedUrl;
        this.bgmAudio = new Audio(resolvedUrl);
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0;
        this.bgmAudio.play().then(() => {
          if (this.bgmAudio && this.currentBgmTarget === 'main_theme') {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
          }
        }).catch(() => {});
      }
    } catch {
      // noop
    }
  }

  /**
   * 現在再生中のBGM情報を取得
   */
  public getCurrentBgm(): { target: BgmId | string | null; url: string | null; volumeScale: number } {
    return {
      target: this.currentBgmTarget,
      url: this.currentBgmUrl,
      volumeScale: this.currentVolumeScale,
    };
  }

  /**
   * 内部オーディオ要素の参照（テストや詳細プロパティ参照用）
   */
  public getBgmAudio(): HTMLAudioElement | null {
    return this.bgmAudio;
  }

  /**
   * BGM 停止
   */
  public stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.bgmAudio = null;
      this.currentBgmTarget = null;
      this.currentBgmUrl = null;
    }
  }

  /**
   * SE（効果音）単発再生
   */
  public playSe(url: string, volumeScale: number = 1.0): void {
    try {
      const resolvedUrl = resolveAssetUrl(url);
      const audio = new Audio(resolvedUrl);
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * this.seVolume * volumeScale));
      audio.play().catch(() => {});
      this.currentSeAudio = audio;
    } catch {
      // Audio playback fallback
    }
  }

  /**
   * 全体音量の一括変更
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.masterVolume * this.bgmVolume;
    }
  }

  public setBgmVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.masterVolume * this.bgmVolume;
    }
  }

  public dispose(): void {
    this.stopBgm();
    if (this.currentSeAudio) {
      this.currentSeAudio.pause();
      this.currentSeAudio = null;
    }
  }
}
