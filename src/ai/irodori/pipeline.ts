// Environment-agnostic Irodori-TTS inference core (Node + browser).
// Exact TypeScript port of https://github.com/ngc-shj/irodori-tts-webgpu (runtime/pipeline.mjs)

const HOP = 1920;
const SR = 48000;
const LATENT_DIM = 32;
const BOS = 1;

export interface EncodedText {
  state: Float32Array;
  S: number;
  dim: number;
  mask: Uint8Array;
}

export interface EncodedSpeaker {
  state: Float32Array;
  Tspk: number;
  dim: number;
  mask: Uint8Array;
}

export interface SynthesisOptions {
  numSteps?: number;
  seed?: number;
  seconds?: number;
  durationScale?: number;
  cfgText?: number;
  cfgSpk?: number;
  cfgMinT?: number;
  cfgMaxT?: number;
  onStep?: (step: number, total: number, stepMs: number) => void;
}

// ---- text normalization (port of irodori_tts/text_normalization.py) ----
const SIMPLE: [string, string][] = [
  ['\t', ''],
  ['[n]', ''],
  ['\\[n\\]', ''],
  ['　', ''],
  ['？', '?'],
  ['！', '!'],
  ['♥', '♡'],
  ['●', '○'],
  ['◯', '○'],
  ['〇', '○'],
];

function stripOuterBrackets(text: string): string {
  const pairs: Record<string, string> = { '「': '」', '『': '』', '（': '）', '【': '】', '(': ')' };
  while (text.length >= 2) {
    const s = text[0],
      e = text[text.length - 1];
    if (pairs[s] === e) {
      let depth = 0,
        all = true;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === s) depth++;
        else if (text[i] === e) depth--;
        if (depth === 0 && i < text.length - 1) {
          all = false;
          break;
        }
      }
      if (all && depth === 0) {
        text = text.slice(1, -1);
        continue;
      }
    }
    break;
  }
  return text;
}

export function normalizeText(t: string): string {
  for (const [a, b] of SIMPLE) t = t.split(a).join(b);
  t = t.replace(/[;▼♀♂《》≪≫①②③④⑤⑥]/g, '');
  t = t.replace(/[˗‐-―⁃−⎯⏤─━⸺⸻]/g, '');
  t = t.replace(/[～〜]/g, 'ー');
  t = t.replace(/…{3,}/g, '……');
  t = stripOuterBrackets(t);
  t = t.normalize('NFKC');
  t = t.split('...').join('…').split('..').join('…');
  return t;
}

// ---- seeded Gaussian noise (browser default; Node verify injects x0) ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianNoise(n: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rng(), 1e-12),
      u2 = rng();
    out[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return out;
}

// ---- ITU-R BS.1770 integrated loudness + normalization ----
const KW_48K = [
  {
    b: [1.5351828863637502, -2.691804030199196, 1.198426263333146],
    a: [1.0, -1.6906995865986896, 0.7325047060963897],
  },
  {
    b: [0.9950442970178917, -1.9900885940357833, 0.9950442970178917],
    a: [1.0, -1.990076284018423, 0.9901009040531438],
  },
];

function lfilter(x: Float32Array | Float64Array, b: number[], a: number[]): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const xn = x[n];
    const yn = b[0] * xn + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    y[n] = yn;
    x2 = x1;
    x1 = xn;
    y2 = y1;
    y1 = yn;
  }
  return y;
}

export function integratedLoudness(wav: Float32Array, rate: number): number | null {
  let d: Float64Array = new Float64Array(wav);
  for (const f of KW_48K) d = lfilter(d, f.b, f.a);
  const kernel = Math.round(0.4 * rate);
  const stride = Math.round(0.4 * rate * 0.25);
  if (d.length < kernel) return null;
  const nf = Math.ceil((d.length - kernel) / stride) + 1;
  const z = new Float64Array(nf),
    l = new Float64Array(nf);
  for (let j = 0; j < nf; j++) {
    let s = 0;
    const off = j * stride;
    for (let i = 0; i < kernel; i++) {
      const idx = off + i;
      if (idx < d.length) {
        const v = d[idx];
        s += v * v;
      }
    }
    z[j] = s / kernel;
    l[j] = -0.691 + 10 * Math.log10(z[j]);
  }
  const absKeep: number[] = [];
  for (let j = 0; j < nf; j++) if (l[j] > -70.0) absKeep.push(j);
  if (!absKeep.length) return null;
  const zAbsMean = absKeep.reduce((acc, j) => acc + z[j], 0) / absKeep.length;
  const gammaR = -0.691 + 10 * Math.log10(zAbsMean) - 10.0;
  const relKeep = absKeep.filter((j) => l[j] > gammaR);
  if (!relKeep.length) return null;
  const zMean = relKeep.reduce((acc, j) => acc + z[j], 0) / relKeep.length;
  return -0.691 + 10 * Math.log10(zMean);
}

export function lufsNormalize(wav: Float32Array, rate: number, targetDb: number): Float32Array {
  const out = Float32Array.from(wav);
  const lufs = integratedLoudness(out, rate);
  if (lufs !== null && Number.isFinite(lufs)) {
    const gain = Math.pow(10, (targetDb - lufs) / 20);
    for (let i = 0; i < out.length; i++) out[i] *= gain;
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 1) {
    const g = 1 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  return out;
}

export class IrodoriTTS {
  public ort: any;
  public s: Record<string, any>;
  public tok: any;

  constructor({ ort, sessions, tokenizer }: { ort: any; sessions: Record<string, any>; tokenizer: any }) {
    this.ort = ort;
    this.s = sessions; // {text, speaker, duration, dit, dac, enc}
    this.tok = tokenizer;
  }

  private _t(data: any, shape: number[], type = 'float32') {
    return new this.ort.Tensor(type, data, shape);
  }

  public tokenize(text: string): Int32Array {
    const norm = normalizeText(text);
    let ids: any;
    if (typeof this.tok.encode === 'function') {
      ids = this.tok.encode(norm, { add_special_tokens: false });
    } else {
      const res = this.tok(norm, { add_special_tokens: false });
      ids = res.input_ids?.data || res.input_ids || res;
    }
    const idList: number[] = Array.isArray(ids)
      ? ids
      : Array.from(ids?.data || ids || []);
    return Int32Array.from([BOS, ...idList].map(Number));
  }

  public async encodeText(text: string): Promise<EncodedText> {
    const ids = this.tokenize(text);
    const S = ids.length;
    const idsBig = BigInt64Array.from(ids, (x) => BigInt(x));
    const mask = new Uint8Array(S).fill(1);
    const out = await this.s.text.run({
      input_ids: this._t(idsBig, [1, S], 'int64'),
      mask: this._t(mask, [1, S], 'bool'),
    });
    return {
      state: out.text_state.data as Float32Array,
      S,
      dim: out.text_state.dims[2] as number,
      mask,
    };
  }

  public async encodeRefLatent(
    refLatent: Float32Array,
    T: number,
    refMask?: Uint8Array
  ): Promise<EncodedSpeaker> {
    const mask = refMask || new Uint8Array(T).fill(1);
    const out = await this.s.speaker.run({
      ref_latent: this._t(refLatent, [1, T, LATENT_DIM]),
      ref_mask: this._t(mask, [1, T], 'bool'),
    });
    return {
      state: out.speaker_state.data as Float32Array,
      Tspk: out.speaker_state.dims[1] as number,
      dim: out.speaker_state.dims[2] as number,
      mask: out.speaker_mask.data as Uint8Array,
    };
  }

  public async wavToRefLatent(
    wav: Float32Array,
    sr: number,
    { normalizeDb = -16.0, ensureMax = true }: { normalizeDb?: number | null; ensureMax?: boolean } = {}
  ) {
    if (sr !== SR) throw new Error(`expected ${SR} Hz reference, got ${sr}`);
    let x = wav;
    if (normalizeDb !== null && normalizeDb !== undefined) {
      x = lufsNormalize(x, sr, normalizeDb);
    } else if (ensureMax) {
      let peak = 0;
      for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
      if (peak > 1) {
        x = Float32Array.from(x, (v) => v / peak);
      }
    }
    const padded = Math.ceil(x.length / HOP) * HOP;
    const buf = new Float32Array(padded);
    buf.set(x);
    const out = await this.s.enc.run({ wav: this._t(buf, [1, 1, padded]) });
    return { latent: out.latent.data as Float32Array, T: out.latent.dims[1] as number };
  }

  public async predictDuration(
    text: EncodedText,
    spk: EncodedSpeaker,
    { durationScale = 1.0, minSeconds = 0.5, maxSeconds = 30.0 }: { durationScale?: number; minSeconds?: number; maxSeconds?: number } = {}
  ) {
    const aux = new Float32Array(14);
    const out = await this.s.duration.run({
      text_state: this._t(text.state, [1, text.S, text.dim]),
      text_mask: this._t(text.mask, [1, text.S], 'bool'),
      aux: this._t(aux, [1, 14]),
      speaker_state: this._t(spk.state, [1, spk.Tspk, spk.dim]),
      speaker_mask: this._t(spk.mask, [1, spk.Tspk], 'bool'),
      has_speaker: this._t(new Uint8Array([1]), [1], 'bool'),
    });
    const logFrames = (out.log_frames.data as Float32Array)[0];
    const predFrames = Math.expm1(logFrames) * durationScale;
    const minF = Math.ceil((minSeconds * SR) / HOP);
    const maxF = Math.floor((maxSeconds * SR) / HOP);
    return Math.max(minF, Math.min(maxF, Math.round(predFrames)));
  }

  public async rfLoop(
    text: EncodedText,
    spk: EncodedSpeaker,
    seqLen: number,
    {
      numSteps = 16,
      cfgText = 3.0,
      cfgSpk = 5.0,
      cfgMinT = 0.5,
      cfgMaxT = 1.0,
      initScale = 0.999,
      seed = 0,
      x0 = null as Float32Array | null,
      onStep = undefined as
        | ((step: number, totalSteps: number, stepMs: number) => void)
        | undefined,
    } = {}
  ) {
    const S = seqLen,
      D = LATENT_DIM,
      SD = S * D;
    let xt = x0 ? Float32Array.from(x0) : gaussianNoise(SD, seed);

    const St = text.S,
      Dt = text.dim,
      Ts = spk.Tspk,
      Ds = spk.dim;
    const zerosT = new Float32Array(St * Dt),
      zerosTm = new Uint8Array(St);
    const zerosS = new Float32Array(Ts * Ds),
      zerosSm = new Uint8Array(Ts);

    const cat3 = (a: Float32Array, b: Float32Array, c: Float32Array, n: number) => {
      const o = new Float32Array(3 * n);
      o.set(a, 0);
      o.set(b, n);
      o.set(c, 2 * n);
      return o;
    };
    const cat3b = (a: Uint8Array, b: Uint8Array, c: Uint8Array, n: number) => {
      const o = new Uint8Array(3 * n);
      o.set(a, 0);
      o.set(b, n);
      o.set(c, 2 * n);
      return o;
    };

    const textB = cat3(text.state, zerosT, text.state, St * Dt);
    const textMB = cat3b(text.mask, zerosTm, text.mask, St);
    const spkB = cat3(spk.state, spk.state, zerosS, Ts * Ds);
    const spkMB = cat3b(spk.mask, spk.mask, zerosSm, Ts);

    const tSched = new Float32Array(numSteps + 1);
    for (let i = 0; i <= numSteps; i++) tSched[i] = (1 - i / numSteps) * initScale;

    const textStateB3 = this._t(textB, [3, St, Dt]);
    const textMaskB3 = this._t(textMB, [3, St], 'bool');
    const spkStateB3 = this._t(spkB, [3, Ts, Ds]);
    const spkMaskB3 = this._t(spkMB, [3, Ts], 'bool');
    const textState1 = this._t(text.state, [1, St, Dt]);
    const textMask1 = this._t(text.mask, [1, St], 'bool');
    const spkState1 = this._t(spk.state, [1, Ts, Ds]);
    const spkMask1 = this._t(spk.mask, [1, Ts], 'bool');

    for (let i = 0; i < numSteps; i++) {
      const stepT0 = performance.now();
      const t = tSched[i],
        dt = tSched[i + 1] - t;
      let v: Float32Array;
      if (t >= cfgMinT && t <= cfgMaxT) {
        const xc = new Float32Array(3 * SD);
        xc.set(xt, 0);
        xc.set(xt, SD);
        xc.set(xt, 2 * SD);
        const o = await this.s.dit.run({
          x_t: this._t(xc, [3, S, D]),
          t: this._t(new Float32Array([t, t, t]), [3]),
          text_state: textStateB3,
          text_mask: textMaskB3,
          speaker_state: spkStateB3,
          speaker_mask: spkMaskB3,
        });
        const outTensor = o.v || o[Object.keys(o)[0]];
        const v3 = outTensor.data as Float32Array;
        v = new Float32Array(SD);
        for (let j = 0; j < SD; j++) {
          const vc = v3[j];
          v[j] = vc + cfgText * (vc - v3[SD + j]) + cfgSpk * (vc - v3[2 * SD + j]);
        }
      } else {
        const o = await this.s.dit.run({
          x_t: this._t(xt, [1, S, D]),
          t: this._t(new Float32Array([t]), [1]),
          text_state: textState1,
          text_mask: textMask1,
          speaker_state: spkState1,
          speaker_mask: spkMask1,
        });
        const outTensor = o.v || o[Object.keys(o)[0]];
        v = outTensor.data as Float32Array;
      }
      const nxt = new Float32Array(SD);
      for (let j = 0; j < SD; j++) nxt[j] = xt[j] + v[j] * dt;
      xt = nxt;
      const stepMs = performance.now() - stepT0;
      console.log(`[IrodoriTTS] rfLoop step ${i + 1}/${numSteps}: ${stepMs.toFixed(1)}ms`);
      onStep?.(i + 1, numSteps, stepMs);
    }
    return xt;
  }

  public async decode(latent: Float32Array, S: number): Promise<Float32Array> {
    const D = LATENT_DIM;
    const z = new Float32Array(D * S);
    for (let s = 0; s < S; s++) {
      for (let d = 0; d < D; d++) {
        z[d * S + s] = latent[s * D + d];
      }
    }
    const out = await this.s.dac.run({ z: this._t(z, [1, D, S]) });
    const audioTensor = out.audio || out[Object.keys(out)[0]];
    return audioTensor.data as Float32Array;
  }

  /**
   * Reference conditioning is invariant for a fixed voice. Cache this result and
   * pass it to synthesizePrepared() so the large reference encoder does not run
   * again for every chat response.
   */
  public async prepareSpeaker(refWav: Float32Array, sr: number = SR): Promise<EncodedSpeaker> {
    const ref = await this.wavToRefLatent(refWav, sr);
    return this.encodeRefLatent(ref.latent, ref.T);
  }

  public async synthesizePrepared(
    text: string,
    spk: EncodedSpeaker,
    opts: SynthesisOptions = {}
  ): Promise<{ audio: Float32Array; sampleRate: number; seqLen: number }> {
    const encodedText = await this.encodeText(text);
    const seqLen = opts.seconds
      ? Math.max(1, Math.round((opts.seconds * SR) / HOP))
      : await this.predictDuration(encodedText, spk, opts);
    const latent = await this.rfLoop(encodedText, spk, seqLen, opts);
    const audio = await this.decode(latent, seqLen);
    return { audio, sampleRate: SR, seqLen };
  }

  public async synthesize(
    text: string,
    refWav: Float32Array,
    sr: number = SR,
    opts: SynthesisOptions = {}
  ): Promise<{ audio: Float32Array; sampleRate: number; seqLen: number }> {
    const spk = await this.prepareSpeaker(refWav, sr);
    return this.synthesizePrepared(text, spk, opts);
  }
}

export function encodeWav(f32: Float32Array, sr: number): Blob {
  const n = f32.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  ws(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const sample = Math.max(-1, Math.min(1, Number.isFinite(f32[i]) ? f32[i] : 0));
    dv.setInt16(44 + i * 2, sample * 32767, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
