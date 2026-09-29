/**
 * BGM・効果音の再生（Web Audio）。
 * ループは AudioBufferSource で継ぎ目なく回し、フェードは GainNode で行う。
 * ボイスは Fighter 側（HTMLAudioElement）が鳴らすので、ここでは扱わない。
 */

import { resolveAssetUrl } from '../../../app/src/utils/path';

const URLS = {
  bgm: '/assets/bgm/bgm.mp3',
  water: '/assets/se/water.mp3',
  drop: '/assets/se/drop.mp3',
  finish: '/assets/se/finish.mp3',
  attack: '/assets/se/attack.mp3',
} as const;

export type SoundId = keyof typeof URLS;

/** 音量（bgm は小さめ。water は元の音がもともと小さいので 1.0 近くにしてある） */
const VOLUME: Record<SoundId, number> = {
  bgm: 0.13,
  water: 0.9,
  drop: 0.9,
  finish: 0.8,
  attack: 0.85,
};

export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  private loading = new Map<SoundId, Promise<AudioBuffer | null>>();
  private loops = new Map<SoundId, { src: AudioBufferSourceNode; gain: GainNode }>();
  private master: GainNode | null = null;
  private wanted = new Set<SoundId>(); // ロード完了前に再生要求されたループ

  /** 検証用: localStorage の player_audio_muted が true なら鳴らさない */
  private muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('player_audio_muted') === 'true';
    } catch {
      this.muted = false;
    }
  }

  /** ユーザー操作（START）のあとで呼ぶ。AudioContext の作成と再開、音の先読みをする */
  public unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    for (const id of Object.keys(URLS) as SoundId[]) void this.load(id);
  }

  private load(id: SoundId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return Promise.resolve(cached);
    let p = this.loading.get(id);
    if (!p) {
      p = (async () => {
        if (!this.ctx) return null;
        try {
          const res = await fetch(resolveAssetUrl(URLS[id]));
          const data = await res.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(data);
          this.buffers.set(id, buf);
          return buf;
        } catch (err) {
          console.warn(`[Sound] failed to load ${id}`, err);
          return null;
        }
      })();
      this.loading.set(id, p);
    }
    return p;
  }

  /** 1 回だけ鳴らす */
  public play(id: SoundId, volume = 1) {
    if (this.muted || !this.ctx || !this.master) return;
    const buf = this.buffers.get(id);
    if (!buf) {
      void this.load(id);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = VOLUME[id] * volume;
    src.connect(gain).connect(this.master);
    src.start();
  }

  /** ループ再生（すでに鳴っていれば何もしない）。fade 秒でフェードイン */
  public startLoop(id: SoundId, fade = 0.5) {
    if (this.muted || !this.ctx || !this.master) return;
    this.wanted.add(id);
    const existing = this.loops.get(id);
    if (existing) {
      const t = this.ctx.currentTime;
      existing.gain.gain.cancelScheduledValues(t);
      existing.gain.gain.setTargetAtTime(VOLUME[id], t, fade / 3);
      return;
    }
    void this.load(id).then((buf) => {
      if (!buf || !this.ctx || !this.master || !this.wanted.has(id) || this.loops.has(id)) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(VOLUME[id], this.ctx.currentTime, fade / 3);
      src.connect(gain).connect(this.master);
      src.start();
      this.loops.set(id, { src, gain });
    });
  }

  /** ループをフェードアウトして止める */
  public stopLoop(id: SoundId, fade = 0.6) {
    this.wanted.delete(id);
    const l = this.loops.get(id);
    if (!l || !this.ctx) return;
    this.loops.delete(id);
    const t = this.ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setTargetAtTime(0, t, fade / 3);
    l.src.stop(t + fade + 0.2);
  }
}
