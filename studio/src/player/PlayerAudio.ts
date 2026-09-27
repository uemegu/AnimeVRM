import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

const BGM_VOLUME = 0.35;
const AMBIENCE_VOLUME = 0.25;
const SE_VOLUME = 0.7;
const VOICE_VOLUME = 1;
const MUTE_KEY = 'player_audio_muted';

/** ループ再生する音（BGM・環境音）。同じ URL なら鳴らし続ける */
class LoopTrack {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  constructor(private readonly volume: number) {}

  play(url: string | null, muted: boolean, scale = 1): void {
    if (url === this.url) return;
    this.stop();
    this.url = url;
    if (!url) return;
    const audio = new Audio(resolveAssetUrl(url));
    audio.loop = true;
    audio.volume = this.volume * scale;
    audio.muted = muted;
    void audio.play().catch(() => {});
    this.audio = audio;
  }

  setMuted(muted: boolean): void {
    if (this.audio) this.audio.muted = muted;
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.url = null;
  }
}

/**
 * 再生画面の音（BGM・環境音・効果音・ボイス）。ボイスの再生位置と音量から、
 * カット内のタイムラインの時刻と口パクの形を返す
 */
export class PlayerAudio {
  private readonly bgm = new LoopTrack(BGM_VOLUME);
  private readonly ambience = new LoopTrack(AMBIENCE_VOLUME);
  private voice: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  /** ボイスの音量（ミュートはここで絞る。音声要素を muted にすると口パク用の解析にも音が来なくなる） */
  private voiceGain: GainNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  private mutedState: boolean;
  private onVoiceEnd: (() => void) | null = null;

  constructor() {
    let saved = false;
    try {
      saved = localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      // 保存できない環境では鳴らす
    }
    this.mutedState = saved;
  }

  get muted(): boolean {
    return this.mutedState;
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    try {
      localStorage.setItem(MUTE_KEY, String(muted));
    } catch {
      // 保存できなくても切り替えは効く
    }
    this.bgm.setMuted(muted);
    this.ambience.setMuted(muted);
    if (this.voiceGain) this.voiceGain.gain.value = muted ? 0 : 1;
    else if (this.voice) this.voice.muted = muted;
  }

  /** BGM（URL と音量の倍率。null で止める） */
  playBgm(url: string | null, volumeScale = 1): void {
    this.bgm.play(url, this.mutedState, volumeScale);
  }

  playAmbience(url: string | null): void {
    this.ambience.play(url, this.mutedState);
  }

  playSe(url: string): void {
    const audio = new Audio(resolveAssetUrl(url));
    audio.volume = SE_VOLUME;
    audio.muted = this.mutedState;
    void audio.play().catch(() => {});
  }

  /** ボイスを鳴らす（前のボイスは止める）。終わったら onEnd を呼ぶ */
  playVoice(url: string | null, onEnd?: () => void): void {
    this.stopVoice();
    if (!url) return;
    const audio = new Audio(resolveAssetUrl(url));
    audio.volume = VOICE_VOLUME;
    this.onVoiceEnd = onEnd ?? null;
    audio.addEventListener('ended', () => {
      if (this.voice === audio) this.onVoiceEnd?.();
    });
    if (!this.connectAnalyser(audio)) audio.muted = this.mutedState;
    void audio.play().catch(() => {
      // 再生できなければ（自動再生の制限など）、終わったものとして扱う
      if (this.voice === audio) this.onVoiceEnd?.();
    });
    this.voice = audio;
  }

  stopVoice(): void {
    this.onVoiceEnd = null;
    this.voice?.pause();
    this.voice = null;
  }

  /** ボイスの再生位置（再生していなければ undefined） */
  getVoiceTime(): number | undefined {
    const voice = this.voice;
    return voice && !voice.paused && !voice.ended ? voice.currentTime : undefined;
  }

  /** 口の形（声の大きさから。ミュート中も口は動かす） */
  getPhoneme(): string | undefined {
    if (!this.analyser || !this.samples || this.getVoiceTime() === undefined) return undefined;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const v of this.samples) sum += v * v;
    const rms = Math.sqrt(sum / this.samples.length);
    if (rms < 0.02) return undefined;
    // 母音は解析しないので、時間でゆるく口の形を変える
    const shapes = ['aa', 'oh', 'ih', 'aa', 'ee'];
    return shapes[Math.floor(performance.now() / 110) % shapes.length];
  }

  /** ボイス → 解析 → 音量 → 出力 とつなぐ。つなげなければ false */
  private connectAnalyser(audio: HTMLAudioElement): boolean {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
      const source = this.context.createMediaElementSource(audio);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.samples = new Float32Array(this.analyser.fftSize);
      this.voiceGain = this.context.createGain();
      this.voiceGain.gain.value = this.mutedState ? 0 : 1;
      source.connect(this.analyser);
      this.analyser.connect(this.voiceGain);
      this.voiceGain.connect(this.context.destination);
      return true;
    } catch {
      this.analyser = null;
      this.voiceGain = null;
      return false;
    }
  }

  dispose(): void {
    this.stopVoice();
    this.bgm.stop();
    this.ambience.stop();
    void this.context?.close();
    this.context = null;
  }
}
