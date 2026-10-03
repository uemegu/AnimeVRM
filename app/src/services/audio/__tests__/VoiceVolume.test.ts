import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceAnalyser } from '@anime-vrm/engine/audio/VoiceAnalyser';
import { AudioLipSync } from '../AudioLipSync';
import { SoundManager } from '../SoundManager';
import { PlayerAudio } from '../../../../../studio/src/player/PlayerAudio';

class MockNode {
  connect = vi.fn((node: unknown) => node);
  disconnect = vi.fn();
}

class MockParam {
  value = 1;
  setValueAtTime(value: number) { this.value = value; }
}

class MockGain extends MockNode {
  gain = new MockParam();
}

class MockAnalyser extends MockNode {
  fftSize = 1024;
  smoothingTimeConstant = 0;
  getFloatTimeDomainData = vi.fn((samples: Float32Array) => samples.fill(this.context.rms));
  constructor(private readonly context: MockContext) { super(); }
}

class MockContext {
  static instances: MockContext[] = [];
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  rms = 0.1;
  destination = new MockNode();
  analyser: MockAnalyser | undefined;
  gains: MockGain[] = [];
  audioWorklet = { addModule: vi.fn(async () => {}) };
  resume = async () => {};
  close = async () => { this.state = 'closed'; };
  constructor() { MockContext.instances.push(this); }
  createMediaElementSource() { return new MockNode(); }
  createAnalyser() {
    this.analyser = new MockAnalyser(this);
    return this.analyser;
  }
  createGain() {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }
  createDelay() { return Object.assign(new MockNode(), { delayTime: new MockParam() }); }
  createStereoPanner() { return Object.assign(new MockNode(), { pan: new MockParam() }); }
}

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  volume = 1;
  muted = false;
  loop = false;
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 2;
  crossOrigin = '';
  private readonly listeners = new Map<string, EventListener[]>();
  constructor(src = '') {
    this.src = src;
    MockAudio.instances.push(this);
  }
  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }
  play = async () => {
    this.paused = false;
    this.ended = false;
    this.emit('play');
  };
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.emit('pause');
  }
  load() { this.currentTime = 0; this.ended = false; }
}

type PortMessage = { type: string; data?: Record<string, unknown> };

class MockWorklet extends MockNode {
  static instances: MockWorklet[] = [];
  onprocessorerror: (() => void) | null = null;
  port = {
    onmessage: null as ((event: { data: PortMessage }) => void) | null,
    postMessage: vi.fn<(message: PortMessage) => void>(),
  };
  constructor() { super(); MockWorklet.instances.push(this); }
  emit(type: string, data?: Record<string, unknown>) { this.port.onmessage?.({ data: { type, data } }); }
  get generation() {
    const reset = [...this.port.postMessage.mock.calls].reverse().find(([message]) => message.type === 'reset');
    return reset?.[0].data?.generation ?? 0;
  }
  analyse(mouthOpen: number, generation = this.generation) {
    this.emit('analysis-result', {
      generation, mouthOpen, rms: 0.18, phoneme: 'oh', processingTimeMs: 0.2,
      f1: 500, f2: 900, distances: { aa: 1, ee: 2, ih: 3, oh: 0, ou: 1 },
    });
  }
}

async function readyWorklet(): Promise<MockWorklet> {
  await vi.waitFor(() => expect(MockWorklet.instances.length).toBeGreaterThan(0));
  const worklet = MockWorklet.instances.at(-1)!;
  worklet.emit('wasm-ready', { abiVersion: 2 });
  return worklet;
}

beforeEach(() => {
  MockContext.instances = [];
  MockAudio.instances = [];
  MockWorklet.instances = [];
  vi.stubGlobal('Audio', MockAudio);
  vi.stubGlobal('AudioContext', MockContext);
  vi.stubGlobal('AudioWorkletNode', MockWorklet);
  vi.stubGlobal('window', { AudioContext: MockContext });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('continuous voice opening', () => {
  it('handles quiet voices in the fallback and releases smoothly into silence', () => {
    const context = new MockContext();
    const analyser = new VoiceAnalyser(context as unknown as AudioContext, new MockNode() as unknown as AudioNode, { useWasm: false });
    context.rms = 0.01;
    const quiet = analyser.getFrame();
    expect(quiet.phoneme).not.toBe('nn');
    expect(quiet.mouthOpen).toBeGreaterThan(0);
    context.rms = 0.25;
    context.currentTime = 0.5;
    const loud = analyser.getFrame().mouthOpen;
    expect(loud).toBeGreaterThan(quiet.mouthOpen);
    context.rms = 0;
    context.currentTime = 0.6;
    const release = analyser.getFrame();
    expect(release.phoneme).toBe('nn');
    expect(release.mouthOpen).toBeGreaterThan(0);
    expect(release.mouthOpen).toBeLessThan(loud);
    context.currentTime = 2;
    expect(analyser.getFrame().mouthOpen).toBe(0);
    analyser.dispose();
  });

  it('keeps recorded delivery independent of output volume and mute', async () => {
    const voice = new AudioLipSync();
    voice.engineMode = 'legacy';
    voice.setVolume(0.25);
    voice.setMuted(true);
    voice.loadAudioUrl('/voices/test.wav');
    await voice.play();
    const context = MockContext.instances[0];
    expect(voice.audioElement.volume).toBe(1);
    expect(voice.audioElement.muted).toBe(false);
    expect(context.gains[0].gain.value).toBe(0);
    const opening = voice.getMouthOpen();
    expect(opening).toBeGreaterThan(0);
    voice.setVolume(0.9);
    voice.setMuted(false);
    expect(context.gains[0].gain.value).toBe(0.9);
    expect(voice.getMouthOpen()).toBe(opening);
    voice.pause();
    expect(voice.getMouthOpen()).toBe(0);
    expect(voice.currentRms).toBe(0);
    voice.dispose();
  });

  it('shares module initialization and WASM loading across voices in one context', async () => {
    const context = new MockContext();
    const first = new VoiceAnalyser(context as unknown as AudioContext, new MockNode() as unknown as AudioNode);
    const second = new VoiceAnalyser(context as unknown as AudioContext, new MockNode() as unknown as AudioNode);
    await vi.waitFor(() => expect(MockWorklet.instances).toHaveLength(2));
    expect(context.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    first.dispose();
    second.dispose();
  });

  it('uses WASM opening directly, stops JS sampling and drops results from the previous voice', async () => {
    const voice = new AudioLipSync();
    voice.loadAudioUrl('/voices/first.wav');
    await voice.play();
    const worklet = await readyWorklet();
    const context = MockContext.instances[0];
    context.rms = 0.9;
    worklet.analyse(0.36);
    expect(voice.getMouthOpen()).toBe(0.36);
    expect(voice.getPhoneme()).toBe('oh');
    expect(voice.getStats().rms).toBe(0.18);
    expect(context.analyser?.getFloatTimeDomainData).not.toHaveBeenCalled();
    const previousGeneration = worklet.generation;
    voice.loadAudioUrl('/voices/second.wav');
    await voice.play();
    worklet.analyse(0.9, previousGeneration);
    expect(voice.getMouthOpen()).toBe(0);
    expect(voice.currentRms).toBe(0);
    worklet.analyse(0.2);
    expect(voice.getMouthOpen()).toBe(0.2);
    voice.stop();
    worklet.analyse(0.8, previousGeneration);
    expect(voice.getMouthOpen()).toBe(0);
    voice.dispose();
  });

  it('resumes RMS fallback after a processor failure and retries failed module loading', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = new MockContext();
    context.audioWorklet.addModule.mockRejectedValueOnce(new Error('unsupported module'));
    const unavailable = new VoiceAnalyser(context as unknown as AudioContext, new MockNode() as unknown as AudioNode);
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(unavailable.ready).toBe(false);
    expect(unavailable.getFrame().mouthOpen).toBeGreaterThan(0);
    const onReady = vi.fn();
    const retry = new VoiceAnalyser(context as unknown as AudioContext, new MockNode() as unknown as AudioNode, { onReady });
    const worklet = await readyWorklet();
    expect(context.audioWorklet.addModule).toHaveBeenCalledTimes(2);
    worklet.analyse(0.7);
    expect(retry.getFrame().mouthOpen).toBe(0.7);
    context.rms = 0.01;
    worklet.onprocessorerror?.();
    expect(retry.ready).toBe(false);
    expect(onReady).toHaveBeenLastCalledWith(false);
    const fallback = retry.getFrame();
    expect(fallback.mouthOpen).toBeGreaterThan(0);
    expect(fallback.mouthOpen).toBeLessThan(0.7);
    unavailable.dispose();
    retry.dispose();
  });

  it('keeps RMS fallback for an old worklet without the versioned opening protocol', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onReady = vi.fn();
    const context = new MockContext();
    const analyser = new VoiceAnalyser(context as unknown as AudioContext, new MockNode() as unknown as AudioNode, { onReady });
    await vi.waitFor(() => expect(MockWorklet.instances).toHaveLength(1));
    MockWorklet.instances[0].emit('wasm-ready');
    expect(analyser.ready).toBe(false);
    expect(onReady).toHaveBeenLastCalledWith(false);
    expect(console.warn).toHaveBeenCalledWith('LipSync AudioWorklet ABI mismatch:', undefined);
    expect(analyser.getFrame().mouthOpen).toBeGreaterThan(0);
    expect(context.analyser?.getFloatTimeDomainData).toHaveBeenCalled();
    analyser.dispose();
  });

  it('exposes opening through SoundManager and applies the ASMR file reference once', async () => {
    const manager = new SoundManager({ masterVolume: 0.4, voiceVolume: 0.5 });
    manager.setMuted(true);
    manager.playVoice('/voices/asmr_hello.wav');
    const worklet = await readyWorklet();
    worklet.analyse(0.5);
    expect(manager.getVoiceMouthOpen()).toBeCloseTo(0.325);
    expect(manager.getVoicePhoneme()).toBe('oh');
    const context = MockContext.instances[0];
    expect(context.gains[0].gain.value).toBe(0);
    manager.setMuted(false);
    manager.setMasterVolume(0.8);
    expect(context.gains[0].gain.value).toBe(0.4);
    expect(manager.getVoiceMouthOpen()).toBeCloseTo(0.325);
    manager.stopVoice();
    expect(manager.getVoiceMouthOpen()).toBe(0);
    manager.dispose();
  });

  it('shares WASM voice analysis with Studio while playback is muted', async () => {
    const player = new PlayerAudio();
    player.setMuted(true);
    player.playVoice('/voices/asmr_studio.wav', undefined, { volume: 0.2 });
    const worklet = await readyWorklet();
    worklet.analyse(0.6);
    expect(player.getPhoneme()).toBe('oh');
    expect(player.getMouthOpen()).toBeCloseTo(0.39);
    const context = MockContext.instances[0];
    expect(context.gains[0].gain.value).toBe(0);
    expect(context.analyser?.getFloatTimeDomainData).not.toHaveBeenCalled();
    player.setMuted(false);
    expect(context.gains[0].gain.value).toBe(0.2);
    expect(player.getMouthOpen()).toBeCloseTo(0.39);
    MockAudio.instances[0].pause();
    expect(player.getMouthOpen()).toBe(0);
    player.stopVoice();
    expect(player.getPhoneme()).toBeUndefined();
    player.dispose();
  });

  it('finishes Studio voice once on a later media error without finishing a stopped or replaced voice', async () => {
    const player = new PlayerAudio();
    const firstDone = vi.fn();
    const secondDone = vi.fn();
    player.playVoice('/voices/first.wav', firstDone);
    await Promise.resolve();
    const first = MockAudio.instances[0];
    first.emit('error');
    expect(firstDone).toHaveBeenCalledTimes(1);
    expect(player.getMouthOpen()).toBe(0);
    first.emit('ended');
    expect(firstDone).toHaveBeenCalledTimes(1);
    player.playVoice('/voices/second.wav', secondDone);
    const second = MockAudio.instances[1];
    first.emit('error');
    first.emit('ended');
    expect(firstDone).toHaveBeenCalledTimes(1);
    expect(secondDone).not.toHaveBeenCalled();
    player.stopVoice();
    second.emit('error');
    second.emit('ended');
    expect(secondDone).not.toHaveBeenCalled();
    player.dispose();
  });

  it('does not finish Studio voice twice when error and ended are followed by a rejected play request', async () => {
    let rejectPlay: ((reason: Error) => void) | undefined;
    class RejectedAudio extends MockAudio {
      override play = () => {
        this.paused = false;
        this.emit('play');
        return new Promise<void>((_resolve, reject) => { rejectPlay = reject; });
      };
    }
    vi.stubGlobal('Audio', RejectedAudio);
    const player = new PlayerAudio();
    const done = vi.fn();
    player.playVoice('/voices/rejected.wav', done);
    MockAudio.instances[0].emit('error');
    MockAudio.instances[0].emit('ended');
    rejectPlay?.(new Error('play failed'));
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
    expect(player.getMouthOpen()).toBe(0);
    player.dispose();
  });

  it('closes the mouth on playback failure and ending', async () => {
    const onError = vi.fn();
    const voice = new AudioLipSync({ onError });
    voice.loadAudioUrl('/voices/end.wav');
    await voice.play();
    const worklet = await readyWorklet();
    worklet.analyse(0.7);
    const audio = MockAudio.instances[0];
    audio.ended = true;
    audio.emit('ended');
    expect(voice.getMouthOpen()).toBe(0);
    expect(voice.currentPhoneme).toBe('nn');
    expect(voice.currentRms).toBe(0);
    const failure = new Error('blocked');
    audio.play = vi.fn(async () => { throw failure; });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await voice.play();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(voice.isPlaying).toBe(false);
    expect(voice.getMouthOpen()).toBe(0);
    voice.dispose();
  });
});
