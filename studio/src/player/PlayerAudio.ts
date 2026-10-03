import type { AudioPan } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { VoiceAnalyser } from '@anime-vrm/engine/audio/VoiceAnalyser';

const BGM_VOLUME = 0.35;
const AMBIENCE_VOLUME = 0.25;
const SE_VOLUME = 0.7;
const VOICE_VOLUME = 1;
const MUTE_KEY = 'player_audio_muted';

/** 音量の倍率とチャネル（シナリオのカットで指定する） */
export interface AudioMix {
  /** 既定の音量に掛ける倍率（省略時 1） */
  volume?: number;
  /** 省略時は stereo */
  pan?: AudioPan;
}

const PAN_VALUE: Record<AudioPan, number> = { stereo: 0, left: -1, right: 1 };

/**
 * 音声要素の出口。音声要素 → （解析など）→ 左右 → 音量 → スピーカーとつなぐ。
 * Web Audio が使えなければ音声要素の音量だけで鳴らす（チャネルは効かない）
 */
class Output {
  private gain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;

  constructor(
    readonly audio: HTMLAudioElement,
    context: AudioContext | null,
    private readonly base: number,
    /** 左右・音量の前から分岐する解析経路 */
    analyse?: (source: MediaElementAudioSourceNode) => void
  ) {
    if (!context) return;
    try {
      const source = context.createMediaElementSource(audio);
      this.panner = context.createStereoPanner();
      this.gain = context.createGain();
      source.connect(this.panner);
      analyse?.(source);
      this.panner.connect(this.gain);
      this.gain.connect(context.destination);
    } catch {
      this.panner = null;
      this.gain = null;
    }
  }

  get routed(): boolean {
    return this.gain !== null;
  }

  /** ミュートは音量を 0 にする（音声要素を muted にすると解析にも音が来なくなるため） */
  apply(mix: AudioMix, muted: boolean): void {
    const volume = this.base * (mix.volume ?? 1);
    if (this.gain && this.panner) {
      this.gain.gain.value = muted ? 0 : volume;
      this.panner.pan.value = PAN_VALUE[mix.pan ?? 'stereo'];
    } else {
      this.audio.volume = Math.min(1, volume);
      this.audio.muted = muted;
    }
  }
}

/** ループ再生する音（BGM・環境音）。同じ URL なら鳴らし続け、音量・チャネルだけ変える */
class LoopTrack {
  private output: Output | null = null;
  private url: string | null = null;
  private mix: AudioMix = {};
  constructor(
    private readonly volume: number,
    private readonly context: () => AudioContext | null
  ) {}

  play(url: string | null, muted: boolean, mix: AudioMix = {}): void {
    this.mix = mix;
    if (url === this.url) {
      this.output?.apply(mix, muted);
      return;
    }
    this.stop();
    this.url = url;
    if (!url) return;
    const audio = new Audio(resolveAssetUrl(url));
    audio.loop = true;
    this.output = new Output(audio, this.context(), this.volume);
    this.output.apply(mix, muted);
    void audio.play().catch(() => {});
  }

  setMuted(muted: boolean): void {
    this.output?.apply(this.mix, muted);
  }

  /** 鳴らしたまま音量・チャネルを変える */
  setMix(mix: AudioMix, muted: boolean): void {
    this.mix = mix;
    this.output?.apply(mix, muted);
  }

  stop(): void {
    this.output?.audio.pause();
    this.output = null;
    this.url = null;
  }
}

/**
 * 再生画面の音（BGM・環境音・効果音・ボイス）。ボイスの再生位置と音量から、
 * カット内のタイムラインの時刻と口パクの形を返す
 */
export class PlayerAudio {
  private context: AudioContext | null = null;
  private readonly bgm = new LoopTrack(BGM_VOLUME, () => this.audioContext());
  private readonly ambience = new LoopTrack(AMBIENCE_VOLUME, () => this.audioContext());
  /** 鳴っている効果音（ミュートの切り替えを反映するため） */
  private readonly ses = new Map<Output, AudioMix>();
  private voice: Output | null = null;
  private voiceFinished = false;
  private voiceMix: AudioMix = {};
  private voiceAnalyser: VoiceAnalyser | null = null;
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
    for (const [output, mix] of this.ses) output.apply(mix, muted);
    this.voice?.apply(this.voiceMix, muted);
  }

  /** BGM（URL と音量・チャネル。null で止める）。音量は bgm.json の volumeScale を掛けたものを渡す */
  playBgm(url: string | null, mix: AudioMix = {}): void {
    this.bgm.play(url, this.mutedState, mix);
  }

  /** 鳴っている BGM の音量・チャネルを変える（試聴しながら調整するため） */
  setBgmMix(mix: AudioMix): void {
    this.bgm.setMix(mix, this.mutedState);
  }

  playAmbience(url: string | null): void {
    this.ambience.play(url, this.mutedState);
  }

  /** 効果音を1回鳴らす。止めたいときのために音声要素を返す */
  playSe(url: string, mix: AudioMix = {}): HTMLAudioElement {
    const audio = new Audio(resolveAssetUrl(url));
    const output = new Output(audio, this.audioContext(), SE_VOLUME);
    output.apply(mix, this.mutedState);
    this.ses.set(output, mix);
    const done = () => this.ses.delete(output);
    audio.addEventListener('ended', done);
    audio.addEventListener('pause', done);
    void audio.play().catch(done);
    return audio;
  }

  /** ボイスを鳴らす（前のボイスは止める）。終わったら onEnd を呼ぶ */
  playVoice(url: string | null, onEnd?: () => void, mix: AudioMix = {}): void {
    this.stopVoice();
    if (!url) return;
    const audio = new Audio(resolveAssetUrl(url));
    const context = this.audioContext();
    const output = new Output(audio, context, VOICE_VOLUME, (source) => {
      if (context) this.voiceAnalyser = new VoiceAnalyser(context, source);
    });
    this.voice = output;
    this.voiceFinished = false;
    this.voiceMix = mix;
    output.apply(mix, this.mutedState);
    this.onVoiceEnd = onEnd ?? null;
    const reset = () => {
      if (this.voice === output) this.voiceAnalyser?.reset();
    };
    const finish = () => {
      if (this.voice !== output || this.voiceFinished) return;
      this.voiceFinished = true;
      reset();
      const onEnd = this.onVoiceEnd;
      this.onVoiceEnd = null;
      onEnd?.();
    };
    audio.addEventListener('pause', reset);
    audio.addEventListener('error', finish);
    audio.addEventListener('ended', finish);
    void audio.play().catch(() => {
      // 再生できなければ（自動再生の制限など）、終わったものとして扱う
      finish();
    });
  }

  stopVoice(): void {
    this.onVoiceEnd = null;
    this.voice?.audio.pause();
    this.voice = null;
    this.voiceAnalyser?.dispose();
    this.voiceAnalyser = null;
  }

  /** ボイスの再生位置（再生していなければ undefined） */
  getVoiceTime(): number | undefined {
    const voice = this.voice?.audio;
    return voice && !this.voiceFinished && !voice.paused && !voice.ended ? voice.currentTime : undefined;
  }

  /** WASM が解析した口の形。ミュート中も口は動かす */
  getPhoneme(): string | undefined {
    if (this.getVoiceTime() === undefined) return undefined;
    const phoneme = this.voiceAnalyser?.getFrame().phoneme;
    return phoneme === 'nn' ? undefined : phoneme;
  }

  /** WASM が解析した録音の特徴による口の開き。再生音量やミュートには影響されない */
  getMouthOpen(): number {
    if (this.getVoiceTime() === undefined) return 0;
    return this.voiceAnalyser?.getFrame().mouthOpen ?? 0;
  }

  /** 共有の AudioContext（作れなければ null）。再生の操作のたびに呼び、止まっていれば再開する */
  private audioContext(): AudioContext | null {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.stopVoice();
    for (const output of [...this.ses.keys()]) output.audio.pause();
    this.bgm.stop();
    this.ambience.stop();
    void this.context?.close();
    this.context = null;
  }
}
