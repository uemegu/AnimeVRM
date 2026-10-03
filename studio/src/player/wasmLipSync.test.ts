import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface AnalyzerExports {
  memory: WebAssembly.Memory;
  INPUT_OFFSET: WebAssembly.Global;
  STATS_OFFSET: WebAssembly.Global;
  LIP_SYNC_ABI_VERSION: WebAssembly.Global;
  init: (sampleRate: number) => void;
  processFrame: () => void;
  resetState: () => void;
  setFrameDuration: (seconds: number) => void;
}

async function analyzer() {
  const bytes = readFileSync(new URL('../../../assets/wasm/lipsync.wasm', import.meta.url));
  const result = await WebAssembly.instantiate(bytes, { env: { abort: () => { throw new Error('WASM abort'); } } });
  const wasm = result.instance.exports as unknown as AnalyzerExports;
  expect(Number(wasm.LIP_SYNC_ABI_VERSION.value)).toBe(2);
  wasm.init(48000);
  wasm.setFrameDuration(1024 / 48000);
  const pcm = new Float32Array(wasm.memory.buffer, Number(wasm.INPUT_OFFSET.value), 1024);
  const stats = new Float32Array(wasm.memory.buffer, Number(wasm.STATS_OFFSET.value), 5);
  let frame = 0;
  return {
    wasm, stats,
    feed(rms: number, highBandAmplitude = 0.01) {
      let energy = 0;
      for (let i = 0; i < pcm.length; i++) {
        const t = (frame * pcm.length + i) / 48000;
        pcm[i] = Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 440 * t) + highBandAmplitude * Math.sin(2 * Math.PI * 3200 * t);
        energy += pcm[i] * pcm[i];
      }
      const scale = rms / Math.sqrt(energy / pcm.length);
      for (let i = 0; i < pcm.length; i++) pcm[i] *= scale;
      wasm.processFrame();
      frame++;
      return stats[4];
    },
  };
}

describe('WASM mouth opening from the recording', () => {
  it('falls back safely when the Worklet receives an incompatible binary', async () => {
    const messages: Array<{ type: string; error?: string }> = [];
    const sandbox = {
      AudioWorkletProcessor: class {
        port = { postMessage: (message: { type: string }) => messages.push(message) };
      },
      WebAssembly: {
        compile: async () => ({}),
        instantiate: async () => ({ exports: { LIP_SYNC_ABI_VERSION: { value: 1 } } }),
      },
      sampleRate: 48000,
      registerProcessor: (_name: string, processor: unknown) => { sandbox.processor = processor; },
      processor: undefined as unknown,
    };
    const source = readFileSync(new URL('../../../assets/worklets/lipsync-processor.js', import.meta.url), 'utf8');
    runInNewContext(source, sandbox);
    const Processor = sandbox.processor as new () => {
      port: { onmessage: (event: unknown) => Promise<void> };
      wasmInstance: unknown;
      process: (inputs: Float32Array[][]) => boolean;
    };
    const worklet = new Processor();
    await worklet.port.onmessage({ data: { type: 'init-wasm', data: { wasmBytes: new ArrayBuffer(0), sampleRate: 48000 } } });
    expect(messages[0].type).toBe('wasm-error');
    expect(messages[0].error).toContain('version mismatch');
    expect(worklet.wasmInstance).toBeNull();
    for (let i = 0; i < 12; i++) expect(worklet.process([[new Float32Array(128)]])).toBe(true);
  });

  it('responds continuously to absolute RMS without normalizing each recording', async () => {
    const quiet = await analyzer();
    const loud = await analyzer();
    for (let i = 0; i < 60; i++) {
      quiet.feed(0.04);
      loud.feed(0.2);
    }
    expect(quiet.stats[4]).toBeGreaterThan(0);
    expect(loud.stats[4]).toBeGreaterThan(quiet.stats[4] * 4);
    expect(loud.stats[4]).toBeLessThanOrEqual(1);
  });

  it('estimates stronger delivery from high-band energy at identical recording volume', async () => {
    const soft = await analyzer();
    const strong = await analyzer();
    for (let i = 0; i < 60; i++) {
      soft.feed(0.16, 0.01);
      strong.feed(0.16, 0.4);
    }
    expect(strong.stats[1]).toBeCloseTo(soft.stats[1], 5);
    expect(strong.stats[4]).toBeGreaterThan(soft.stats[4] * 2);
  });

  it('closes on silence independently of phoneme hangover and resets between recordings', async () => {
    const voice = await analyzer();
    for (let i = 0; i < 30; i++) voice.feed(0.25, 0.4);
    expect(voice.stats[4]).toBeGreaterThan(0.5);
    for (let i = 0; i < 40; i++) voice.feed(0);
    expect(voice.stats[4]).toBe(0);
    for (let i = 0; i < 30; i++) voice.feed(0.25, 0.4);
    voice.wasm.resetState();
    expect(voice.stats[4]).toBe(0);
    expect(voice.feed(0)).toBe(0);
  });
});
