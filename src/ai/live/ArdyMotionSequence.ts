import type { AnimationAction, AnimationClip } from 'three';
import type { ArdyMotionStep } from './ArdyMotionPlan';

export interface PreparedArdyMotion { clip: AnimationClip; applyFingers: () => void }
interface SequenceCallbacks {
  prepare: (step: ArdyMotionStep) => Promise<PreparedArdyMotion>;
  play: (clip: AnimationClip, finished: () => void) => AnimationAction | null;
  onStep: (index: number, state: 'generating' | 'ready' | 'playing' | 'finished' | 'cancelled' | 'error', error?: unknown) => void;
  onLowWater: () => void;
  onComplete: () => void;
  onError: (error: unknown) => void;
}

/** Retiming keeps elapsed motion and the one-second finger transition intact. */
function retimeClip(clip: AnimationClip, duration: number, elapsed = 0): void {
  const pivot = Math.min(clip.duration, Math.max(1, elapsed));
  if (clip.duration <= pivot || duration <= pivot) return;
  const scale = (duration - pivot) / (clip.duration - pivot);
  const updatedTimes = new Set<Float32Array>();
  for (const track of clip.tracks) {
    // Retargeted body tracks share one Float32Array of sample times.
    if (updatedTimes.has(track.times)) continue;
    updatedTimes.add(track.times);
    for (let i = 0; i < track.times.length; i++) {
      if (track.times[i] > pivot) track.times[i] = pivot + (track.times[i] - pivot) * scale;
    }
  }
  clip.duration = duration;
}

/** One bounded queue per reply; generation runs ahead while the mixer plays each clip once. */
export class ArdyMotionSequence {
  readonly ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (reason: unknown) => void;
  private prepared: Array<PreparedArdyMotion | undefined> = [];
  private durations: number[];
  private index = 0;
  private activated = false;
  private action: AnimationAction | null = null;
  private failed = false;
  private preparing = false;
  private completed = false;
  private states: string[];
  private abortListener: () => void;

  constructor(readonly steps: ArdyMotionStep[], private signal: AbortSignal, private callbacks: SequenceCallbacks) {
    this.durations = steps.map(step => step.duration);
    this.states = steps.map(() => 'waiting');
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    this.abortListener = () => {
      this.rejectReady(signal.reason);
      this.steps.forEach((_, i) => {
        if (!['finished', 'error'].includes(this.states[i])) this.report(i, 'cancelled');
      });
      this.prepared = [];
    };
    signal.addEventListener('abort', this.abortListener, { once: true });
    // A speculative sequence can be cancelled before its owner awaits readiness.
    void this.ready.catch(() => {});
  }

  prepare(): Promise<void> {
    if (!this.preparing) {
      this.preparing = true;
      void this.fill();
    }
    return this.ready;
  }

  start(): void {
    this.activated = true;
    this.playNext();
  }

  /** Called when the final PCM chunk is known, using the audio clock's remaining time. */
  fitToSpeech(seconds: number): void {
    if (this.completed || this.failed || this.signal.aborted || seconds <= 0) return;
    const elapsed = this.action?.time ?? 0;
    const remaining = this.durations.slice(this.index).reduce((sum, duration) => sum + duration, 0) - elapsed;
    if (remaining <= 0) return;
    // Avoid turning short gestures into frantic or extremely slow motion.
    const scale = Math.max(0.5, Math.min(2, seconds / remaining));
    for (let i = this.index; i < this.durations.length; i++) {
      this.durations[i] = i === this.index ? elapsed + (this.durations[i] - elapsed) * scale : this.durations[i] * scale;
      this.durations[i] = Math.max(i === this.index ? elapsed + 0.05 : 1, this.durations[i]);
    }
    if (this.action) retimeClip(this.action.getClip(), this.durations[this.index], elapsed);
  }

  private async fill(): Promise<void> {
    try {
      for (let i = 0; i < this.steps.length; i++) {
        this.signal.throwIfAborted();
        this.report(i, 'generating');
        const prepared = await this.callbacks.prepare(this.steps[i]);
        this.signal.throwIfAborted();
        this.prepared[i] = prepared;
        this.report(i, 'ready');
        if (i === 0) this.resolveReady();
        this.playNext();
      }
    } catch (error) {
      this.rejectReady(error);
      if (!this.signal.aborted) {
        this.failed = true;
        this.signal.removeEventListener('abort', this.abortListener);
        this.steps.forEach((_, i) => { if (this.states[i] !== 'finished') this.report(i, 'error', error); });
        this.callbacks.onError(error);
      }
    }
  }

  private playNext(): void {
    if (!this.activated || this.action || this.signal.aborted || this.failed || this.completed) return;
    if (this.index === this.steps.length) {
      this.completed = true;
      this.signal.removeEventListener('abort', this.abortListener);
      this.callbacks.onComplete();
      return;
    }
    const prepared = this.prepared[this.index];
    if (!prepared) return;
    try {
      retimeClip(prepared.clip, this.durations[this.index]);
      // Capture the fingers' actual pose at playback, not during speculative generation.
      prepared.applyFingers();
      this.action = this.callbacks.play(prepared.clip, () => {
        if (this.signal.aborted || this.failed) return;
        this.report(this.index, 'finished');
        this.prepared[this.index] = undefined;
        this.action = null;
        this.index++;
        this.playNext();
      });
      if (!this.action) throw new Error('Motion playback failed.');
      this.report(this.index, 'playing');
      if (this.index === this.steps.length - 1) this.callbacks.onLowWater();
    } catch (error) {
      this.failed = true;
      this.report(this.index, 'error', error);
      this.callbacks.onError(error);
    }
  }

  private report(index: number, state: Parameters<SequenceCallbacks['onStep']>[1], error?: unknown): void {
    this.states[index] = state;
    this.callbacks.onStep(index, state, error);
  }
}
