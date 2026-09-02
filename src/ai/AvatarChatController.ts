import { Avatar } from '../Avatar';
import { AudioLipSync } from '../AudioLipSync';
import { GeminiNanoService } from './GeminiNanoService';
import { IrodoriTTSService } from './IrodoriTTSService';
import { AvatarMotion, AvatarReply, ChatMessage, ChatState } from './types';

export const MOTIONS: Record<AvatarMotion, string> = {
  idle: '/animations/Idle.fbx',
  standing: '/animations/Female Standing Pose.fbx',
  greeting: '/animations/Standing Greeting.fbx',
  bow: '/animations/Quick Formal Bow.fbx',
  acknowledge: '/animations/Acknowledging.fbx',
  dismiss: '/animations/Dismissing Gesture.fbx',
  salute: '/animations/Salute.fbx',
  excited: '/animations/Excited.fbx',
  angry: '/animations/Angry.fbx',
};

export interface AvatarChatControllerEvents {
  onStateChange?: (state: ChatState, statusText?: string) => void;
  onMessageAdded?: (
    message: ChatMessage,
    replyMeta?: { expression: string; motion: string }
  ) => void;
  onError?: (error: Error | string) => void;
  /** Pause competing GPU rendering while an Irodori WebGPU run is active. */
  onTtsGpuActivityChange?: (active: boolean) => void;
}

const MIN_SPEECH_CHUNK_CHARS = 8;
const MAX_SPEECH_CHUNK_CHARS = 32;

/**
 * Split Japanese speech at natural punctuation boundaries for chunked TTS.
 * Very short fragments are joined to a neighbour because tiny TTS requests
 * add latency and tend to sound less natural.
 */
export function splitSpeechIntoChunks(text: string): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  const fragments =
    normalized.match(/[^、，,。．.!！?？…]+(?:[、，,。．.!！?？…]+|$)/gu) || [normalized];
  const rawChunks: string[] = [];
  let current = '';

  for (const fragmentValue of fragments) {
    const fragment = fragmentValue.trim();
    if (!fragment) continue;

    if (current && current.length + fragment.length > MAX_SPEECH_CHUNK_CHARS) {
      rawChunks.push(current);
      current = fragment;
    } else {
      current += fragment;
    }

    const isSentenceEnd = /[。．.!！?？]+$/u.test(fragment);
    const isClauseEnd = /[、，,…]+$/u.test(fragment);
    if (
      isSentenceEnd ||
      current.length >= MAX_SPEECH_CHUNK_CHARS ||
      (isClauseEnd && current.length >= MIN_SPEECH_CHUNK_CHARS)
    ) {
      rawChunks.push(current);
      current = '';
    }
  }
  if (current) rawChunks.push(current);

  const chunks: string[] = [];
  let leadingShortChunk = '';
  for (const chunk of rawChunks) {
    const isCompleteShortSentence = chunk.length >= 4 && /[。．.!！?？]+$/u.test(chunk);
    if (chunk.length < MIN_SPEECH_CHUNK_CHARS && !isCompleteShortSentence) {
      if (chunks.length > 0) {
        chunks[chunks.length - 1] += chunk;
      } else {
        leadingShortChunk += chunk;
      }
      continue;
    }
    chunks.push(leadingShortChunk + chunk);
    leadingShortChunk = '';
  }
  if (leadingShortChunk) {
    if (chunks.length > 0) chunks[chunks.length - 1] += leadingShortChunk;
    else chunks.push(leadingShortChunk);
  }

  return chunks;
}

export class AvatarChatController {
  private geminiNanoService: GeminiNanoService;
  private ttsService: IrodoriTTSService;
  private avatar: Avatar | null = null;
  private audioLipSync: AudioLipSync | null = null;
  private state: ChatState = 'unloaded';
  private history: ChatMessage[] = [];
  private events: AvatarChatControllerEvents;
  private isProcessing = false;
  private ttsNumSteps = 8;

  constructor(events: AvatarChatControllerEvents = {}) {
    this.events = events;
    this.geminiNanoService = new GeminiNanoService();
    this.ttsService = new IrodoriTTSService();
  }

  public setEvents(events: AvatarChatControllerEvents): void {
    this.events = events;
  }

  public setAvatar(avatar: Avatar | null): void {
    this.avatar = avatar;
  }

  public setAudioLipSync(audioLipSync: AudioLipSync | null): void {
    this.audioLipSync = audioLipSync;
  }

  public setTtsNumSteps(numSteps: number): void {
    if (!Number.isFinite(numSteps)) return;
    this.ttsNumSteps = Math.max(1, Math.min(32, Math.round(numSteps)));
    console.log(`[AvatarChatController] TTS sampling steps: ${this.ttsNumSteps}`);
  }

  public getTtsNumSteps(): number {
    return this.ttsNumSteps;
  }

  public getState(): ChatState {
    return this.state;
  }

  public getHistory(): readonly ChatMessage[] {
    return this.history;
  }

  private setState(state: ChatState, statusText?: string): void {
    this.state = state;
    this.events.onStateChange?.(state, statusText);
  }

  public async initialize(): Promise<void> {
    if (this.state === 'loading') return;

    if (!navigator.gpu) {
      const err = new Error(
        'この機能を利用するにはWebGPU対応ブラウザが必要です。Chrome最新版を使用してください。'
      );
      this.setState('error', err.message);
      this.events.onError?.(err);
      return;
    }

    try {
      this.setState('loading', 'Gemini Nanoを初期化中...');

      // 1. Load Gemini Nano
      await this.geminiNanoService.load((msg) => {
        this.setState('loading', msg);
      });

      // 2. Load TTS
      await this.ttsService.load((msg) => {
        this.setState('loading', msg);
      });

      this.setState('ready', '準備完了');
    } catch (err: any) {
      console.error('[AvatarChatController] Init error:', err);
      const errMsg = err?.message || 'モデルの読み込みに失敗しました';
      this.setState('error', errMsg);
      this.events.onError?.(err);
    }
  }

  public async sendMessage(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed || this.isProcessing || this.state !== 'ready') return;

    this.isProcessing = true;
    const responseStartTime = performance.now();

    // 1. Add user message
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    this.history.push(userMessage);
    this.events.onMessageAdded?.(userMessage);

    // Keep history manageable (last 8 messages = 4 turns)
    if (this.history.length > 8) {
      this.history = this.history.slice(-8);
    }

    try {
      // 2. Generate LLM Reply
      this.setState('generating', '考え中...');
      console.log('[AvatarChatController] Generating reply with Gemini Nano...');
      
      const { reply } = await this.geminiNanoService.generate(this.history);

      console.log('[AvatarChatController] LLM parsed reply:', reply);

      // Add assistant speech to history
      const assistantMessage: ChatMessage = { role: 'assistant', content: reply.speech };
      this.history.push(assistantMessage);
      this.events.onMessageAdded?.(assistantMessage, {
        expression: reply.expression,
        motion: reply.motion,
      });

      // 3. Generate speech in punctuation-delimited chunks.
      await this.streamAvatarReaction(reply, responseStartTime);
      this.isProcessing = false;
      this.setState('ready', '準備完了');
    } catch (err: any) {
      console.error('[AvatarChatController] Error during chat turnaround:', err);
      const errMsg = err?.message || '処理中にエラーが発生しました';
      this.setState('error', errMsg);
      this.events.onError?.(err);
      this.isProcessing = false;
    }
  }

  private async streamAvatarReaction(
    reply: AvatarReply,
    turnaroundStartTime: number
  ): Promise<void> {
    if (!this.avatar || !this.audioLipSync) {
      console.warn('[AvatarChatController] Avatar or AudioLipSync is missing, skipping reaction playback.');
      return;
    }

    const chunks = splitSpeechIntoChunks(reply.speech);
    if (chunks.length === 0) {
      console.warn('[AvatarChatController] No speech text to synthesize.');
      return;
    }

    console.log(`[AvatarChatController] Synthesizing speech in ${chunks.length} chunk(s):`, chunks);

    // Initial avatar motion & expression on speech start
    if (reply.motion && MOTIONS[reply.motion]) {
      this.avatar.playAnimation(MOTIONS[reply.motion], false, 0.35, MOTIONS.idle);
    }
    if (reply.expression) {
      this.avatar.setExpression(reply.expression, 0.85);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkLabel = `(${i + 1}/${chunks.length})`;

      this.setState('synthesizing', `音声生成中 ${chunkLabel}...`);
      this.events.onTtsGpuActivityChange?.(true);

      const synthResult = await this.ttsService.synthesize(chunkText, {
        numSteps: this.ttsNumSteps,
        onProgress: (pct) => {
          this.setState('synthesizing', `音声生成中 ${chunkLabel} (${pct}%)...`);
        },
      });

      this.events.onTtsGpuActivityChange?.(false);

      if (i === 0) {
        const timeToFirstAudioMs = performance.now() - turnaroundStartTime;
        console.log(`[Chat] Time to First Audio Playback: ${timeToFirstAudioMs.toFixed(1)} ms`);
      }

      this.setState('speaking', `再生中 ${chunkLabel}`);

      const chunkFile = new File([synthResult.wavBlob], `speech_chunk_${i}.wav`, {
        type: 'audio/wav',
      });
      this.audioLipSync.loadAudioFile(chunkFile);
      await this.audioLipSync.play();

      await new Promise<void>((resolve) => {
        const checkPlaying = () => {
          if (!this.audioLipSync?.isPlaying) {
            resolve();
          } else {
            setTimeout(checkPlaying, 50);
          }
        };
        setTimeout(checkPlaying, 100);
      });
    }

    // Reset expression to neutral and switch to idle after speaking completes
    if (this.avatar) {
      this.avatar.setExpression('neutral', 0.5);
      this.avatar.playAnimation(MOTIONS.idle, true, 0.5);
    }
  }
}
