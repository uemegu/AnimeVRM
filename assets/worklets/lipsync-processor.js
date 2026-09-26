// LipSync AudioWorkletProcessor with WebAssembly Micro-Engine
// Runs entirely inside the audio rendering thread off the main thread.

class LipSyncProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.wasmInstance = null;
    this.wasmMemory = null;
    this.ringBuffer = new Float32Array(1024);
    this.writeIndex = 0;
    this.totalSamples = 0;

    // Throttle analysis to ~60Hz (approx every 735 samples at 44.1kHz or 800 samples at 48kHz)
    // 735 samples / 128 quantum = ~5.74 quantum blocks (~16.6ms)
    this.analysisIntervalSamples = 735;
    this.samplesSinceLastAnalysis = 0;

    this.phonemeMap = ['aa', 'ee', 'ih', 'oh', 'ou'];

    this.port.onmessage = async (event) => {
      const { type, data } = event.data;
      if (type === 'init-wasm') {
        try {
          const { wasmBytes, sampleRate } = data;
          const wasmModule = await WebAssembly.compile(wasmBytes);
          this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
            env: {
              abort: (msg, file, line, col) => {
                console.error(`WASM abort at ${file}:${line}:${col}`);
              }
            }
          });

          this.wasmMemory = this.wasmInstance.exports.memory;
          this.inputOffset = (this.wasmInstance.exports.INPUT_OFFSET ? Number(this.wasmInstance.exports.INPUT_OFFSET.value ?? this.wasmInstance.exports.INPUT_OFFSET) : 32768) >> 2;
          this.statsOffset = (this.wasmInstance.exports.STATS_OFFSET ? Number(this.wasmInstance.exports.STATS_OFFSET.value ?? this.wasmInstance.exports.STATS_OFFSET) : 53424) >> 2;
          this.distancesOffset = (this.wasmInstance.exports.DISTANCES_OFFSET ? Number(this.wasmInstance.exports.DISTANCES_OFFSET.value ?? this.wasmInstance.exports.DISTANCES_OFFSET) : 53404) >> 2;

          if (this.wasmInstance.exports.init) {
            this.wasmInstance.exports.init(sampleRate || 44100.0);
          }
          this.analysisIntervalSamples = Math.round((sampleRate || 44100.0) / 60); // 60fps
          this.port.postMessage({ type: 'wasm-ready' });
        } catch (err) {
          this.port.postMessage({ type: 'wasm-error', error: String(err) });
        }
      } else if (type === 'set-gender') {
        if (this.wasmInstance?.exports?.setVoiceGender) {
          this.wasmInstance.exports.setVoiceGender(data.gender === 'male' ? 1 : 0);
        }
      } else if (type === 'set-rms-threshold') {
        if (this.wasmInstance?.exports?.setRmsThreshold) {
          this.wasmInstance.exports.setRmsThreshold(data.threshold);
        }
      } else if (type === 'set-hold-frames') {
        if (this.wasmInstance?.exports?.setHoldFrames) {
          this.wasmInstance.exports.setHoldFrames(data.frames);
        }
      } else if (type === 'reset') {
        this.writeIndex = 0;
        this.totalSamples = 0;
        this.samplesSinceLastAnalysis = 0;
        this.ringBuffer.fill(0);
        if (this.wasmInstance?.exports?.resetState) {
          this.wasmInstance.exports.resetState();
        }
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const len = channelData.length;

    // Append samples to circular buffer
    for (let i = 0; i < len; i++) {
      this.ringBuffer[this.writeIndex] = channelData[i];
      this.writeIndex = (this.writeIndex + 1) & 1023; // mod 1024
    }

    this.totalSamples += len;
    this.samplesSinceLastAnalysis += len;

    // Analyze when enough samples have accumulated (approx 60Hz) and at least 1024 samples recorded
    if (
      this.wasmInstance &&
      this.totalSamples >= 1024 &&
      this.samplesSinceLastAnalysis >= this.analysisIntervalSamples
    ) {
      this.samplesSinceLastAnalysis = 0;
      this.runAnalysis();
    }

    return true;
  }

  runAnalysis() {
    const hasPerf = typeof performance !== 'undefined' && typeof performance.now === 'function';
    const t0 = hasPerf ? performance.now() : currentTime * 1000;

    const memF32 = new Float32Array(this.wasmMemory.buffer);
    const memI32 = new Int32Array(this.wasmMemory.buffer);

    // Unroll ringBuffer in chronological order into WASM INPUT_OFFSET
    const inOffset = this.inputOffset || 8192;
    let readIdx = this.writeIndex; // oldest sample
    for (let i = 0; i < 1024; i++) {
      memF32[inOffset + i] = this.ringBuffer[readIdx];
      readIdx = (readIdx + 1) & 1023;
    }

    // Execute WASM processFrame()
    this.wasmInstance.exports.processFrame();

    // Read STATS_OFFSET
    // [phoneme_idx (i32), rms (f32), f1 (f32), f2 (f32)]
    const statsIdx = this.statsOffset || 13356;
    const rawPhonemeIdx = memI32[statsIdx];
    const rms = memF32[statsIdx + 1];
    const f1 = memF32[statsIdx + 2];
    const f2 = memF32[statsIdx + 3];

    // Read DISTANCES_OFFSET
    // 0: aa, 1: ee, 2: ih, 3: oh, 4: ou
    const distIdx = this.distancesOffset || 13351;
    const distances = {
      aa: memF32[distIdx],
      ee: memF32[distIdx + 1],
      ih: memF32[distIdx + 2],
      oh: memF32[distIdx + 3],
      ou: memF32[distIdx + 4],
    };

    const phoneme = (rawPhonemeIdx >= 0 && rawPhonemeIdx < 5) ? this.phonemeMap[rawPhonemeIdx] : 'nn';

    const t1 = hasPerf ? performance.now() : currentTime * 1000;
    const duration = Math.max(0.01, t1 - t0);

    // Send result to main thread
    this.port.postMessage({
      type: 'analysis-result',
      data: {
        phoneme,
        rms,
        f1,
        f2,
        distances,
        processingTimeMs: duration
      }
    });
  }
}

registerProcessor('lipsync-processor', LipSyncProcessor);
