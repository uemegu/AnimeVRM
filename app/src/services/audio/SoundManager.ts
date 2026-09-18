import { resolveAssetUrl } from '../../utils/path';

export interface SoundManagerOptions {
  masterVolume?: number;
  bgmVolume?: number;
  seVolume?: number;
  voiceVolume?: number;
}

export class SoundManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmUrl: string | null = null;
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
  }

  /**
   * BGM 再生（ループ再生、同曲の場合は継続）
   */
  public playBgm(url: string, volumeScale: number = 1.0): void {
    const resolvedUrl = resolveAssetUrl(url);
    if (this.currentBgmUrl === resolvedUrl && this.bgmAudio && !this.bgmAudio.paused) {
      // 既に再生中の同一曲ならボリューム更新のみ
      this.bgmAudio.volume = this.masterVolume * this.bgmVolume * volumeScale;
      return;
    }

    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }

    this.currentBgmUrl = resolvedUrl;
    this.bgmAudio = new Audio(resolvedUrl);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume * volumeScale));
    this.bgmAudio.play().catch((err) => {
      console.warn('BGM auto-play was blocked or failed:', err);
    });
  }

  /**
   * BGM 停止
   */
  public stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
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
