/**
 * AudioRecorder: Captures microphone audio and converts to 16kHz 16-bit PCM for Gemini Live
 */

export interface AudioRecorderCallbacks {
  onAudioChunk?: (pcmData: Int16Array) => void;
  onError?: (error: Error) => void;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private callbacks: AudioRecorderCallbacks;
  private isRunning = false;
  private isMuted = false;

  constructor(callbacks: AudioRecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public get active(): boolean {
    return this.isRunning;
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Try to request 16000Hz AudioContext, or fall back to system sample rate
      try {
        this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      } catch {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      // Use buffer size of 2048 (about 46ms at 44.1kHz, 128ms at 16kHz)
      this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      const targetSampleRate = 16000;
      const inputSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRunning || this.isMuted) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        let resampled: Float32Array;

        if (inputSampleRate === targetSampleRate) {
          resampled = inputChannelData;
        } else {
          // Linear interpolation downsampling to 16000Hz
          const ratio = inputSampleRate / targetSampleRate;
          const newLength = Math.round(inputChannelData.length / ratio);
          resampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const srcIdx = i * ratio;
            const i0 = Math.floor(srcIdx);
            const i1 = Math.min(i0 + 1, inputChannelData.length - 1);
            const t = srcIdx - i0;
            resampled[i] = inputChannelData[i0] * (1 - t) + inputChannelData[i1] * t;
          }
        }

        // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        const pcmInt16 = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]));
          pcmInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        this.callbacks.onAudioChunk?.(pcmInt16);
      };

      this.sourceNode.connect(this.processorNode);
      // Destination connection is required for ScriptProcessorNode to fire in some browsers,
      // but we connect through a mute gain so mic doesn't feedback through speakers!
      const muteGain = this.audioContext.createGain();
      muteGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.processorNode.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.isRunning = true;
    } catch (err: any) {
      console.error('[AudioRecorder] Failed to start microphone:', err);
      this.stop();
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  public stop(): void {
    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {
        // ignore
      }
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.stream = null;
    }

    this.isRunning = false;
  }
}
