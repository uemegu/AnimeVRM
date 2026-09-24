import { resolveAssetUrl } from '../../utils/path';
import { BgmId, resolveBgmInfo } from '../../data/bgmPresets';
import { AudioLipSync, Phoneme } from './AudioLipSync';

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
  private loopSeAudios = new Set<HTMLAudioElement>();
  // ボイスは口パク解析付きで再生するため AudioLipSync を使う（初回使用時に生成）
  private voiceAudio: AudioLipSync | null = null;

  private isMuted: boolean = false;

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
   * ミュート状態の設定
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = muted;
    }
    if (this.currentSeAudio) {
      this.currentSeAudio.muted = muted;
      if (muted) {
        this.currentSeAudio.pause();
      }
    }
    // ループSE（着信バイブ等）は停止せず無音にするだけ（解除時にそのまま鳴り続ける）
    this.loopSeAudios.forEach((audio) => {
      audio.muted = muted;
    });
    // ボイスは出力だけ消音し、口パク解析は続ける
    this.voiceAudio?.setMuted(muted);
  }

  public getIsMuted(): boolean {
    return this.isMuted;
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
      this.bgmAudio.muted = this.isMuted;
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
    this.bgmAudio.muted = this.isMuted;
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

      // ボイス用の AudioContext もユーザー操作コンテキスト内で作成・再開
      const voice = this.getVoiceAudio();
      voice.initAudioContext();
      if (voice.audioContext?.state === 'suspended') {
        voice.audioContext.resume().catch(() => {});
      }

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
    if (this.isMuted) return;
    try {
      const resolvedUrl = resolveAssetUrl(url);
      const audio = new Audio(resolvedUrl);
      audio.muted = this.isMuted;
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * this.seVolume * volumeScale));
      audio.play().catch(() => {});
      this.currentSeAudio = audio;
    } catch {
      // Audio playback fallback
    }
  }

  /**
   * SE（効果音）のループ再生。戻り値の関数で停止する
   */
  public playLoopSe(url: string, volumeScale: number = 1.0): () => void {
    let audio: HTMLAudioElement;
    try {
      audio = new Audio(resolveAssetUrl(url));
      audio.loop = true;
      audio.muted = this.isMuted;
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * this.seVolume * volumeScale));
      audio.play().catch(() => {});
      this.loopSeAudios.add(audio);
    } catch {
      return () => {};
    }
    return () => {
      audio.pause();
      audio.currentTime = 0;
      this.loopSeAudios.delete(audio);
    };
  }

  private getVoiceAudio(): AudioLipSync {
    if (!this.voiceAudio) {
      this.voiceAudio = new AudioLipSync();
      this.voiceAudio.setMuted(this.isMuted);
    }
    return this.voiceAudio;
  }

  /**
   * ボイス再生（口パク解析付き）。前のボイスは差し替えられる
   */
  public playVoice(url: string, title?: string): void {
    const voice = this.getVoiceAudio();
    voice.setVolume(this.masterVolume * this.voiceVolume);
    voice.loadAudioUrl(url, title);
    voice.play().catch(() => {});
  }

  public stopVoice(): void {
    this.voiceAudio?.stop();
  }

  public isVoicePlaying(): boolean {
    return this.voiceAudio?.isPlaying ?? false;
  }

  /**
   * ボイス再生終了（エラー含む）の通知先を登録する
   */
  public setVoiceEndedHandler(handler: () => void): void {
    this.getVoiceAudio().setEvents({ onEnded: handler, onError: handler });
  }

  /**
   * 口パク用の現在の音素。ボイス再生中でなければ undefined
   */
  public getVoicePhoneme(): Phoneme | 'nn' | undefined {
    return this.voiceAudio?.isPlaying ? this.voiceAudio.currentPhoneme : undefined;
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
    this.loopSeAudios.forEach((audio) => audio.pause());
    this.loopSeAudios.clear();
    this.voiceAudio?.dispose();
    this.voiceAudio = null;
  }
}

/**
 * アプリ全体で共有するサウンドサービス。
 * ミュート状態はここで一元管理するため、各画面はミュートを気にせず playSe を呼べばよい。
 */
export const soundManager = new SoundManager();
