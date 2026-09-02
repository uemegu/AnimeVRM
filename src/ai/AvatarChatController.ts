import { Avatar } from '../Avatar';
import { AudioLipSync } from '../AudioLipSync';
import { LfmService } from './LfmService';
import { GeminiNanoService } from './GeminiNanoService';
import { IrodoriTTSService } from './IrodoriTTSService';
import { AvatarMotion, AvatarReply, ChatMessage, ChatState, LlmProvider } from './types';

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
    // A short but complete sentence such as "こんにちは。" is an excellent
    // first streaming chunk. Only merge tiny/incomplete fragments.
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
  private lfmService: LfmService;
  private geminiNanoService: GeminiNanoService;
  private ttsService: IrodoriTTSService;
  private llmProvider: LlmProvider = 'gemini-nano';
  private avatar: Avatar | null = null;
  private audioLipSync: AudioLipSync | null = null;
  private state: ChatState = 'unloaded';
  private history: ChatMessage[] = [];
  private events: AvatarChatControllerEvents;
  private isProcessing = false;
  private ttsNumSteps = 8;

  constructor(events: AvatarChatControllerEvents = {}) {
    this.events = events;
    this.lfmService = new LfmService();
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

  public setLlmProvider(provider: LlmProvider): void {
    if (this.llmProvider === provider) return;
    this.llmProvider = provider;
    // If not ready with the new provider, reset to unloaded
    const isReady =
      (provider === 'gemini-nano' ? this.geminiNanoService.ready : this.lfmService.ready) &&
      this.ttsService.ready;
    if (!isReady && this.state === 'ready') {
      this.setState('unloaded', 'LLMが変更されました。「AIを準備」を押してください');
    }
  }

  public getLlmProvider(): LlmProvider {
    return this.llmProvider;
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
      this.setState('loading', 'AIモデルを初期化中...');

      // 1. Load Selected LLM
      if (this.llmProvider === 'gemini-nano') {
        await this.geminiNanoService.load((msg) => {
          this.setState('loading', msg);
        });
      } else {
        await this.lfmService.load((msg) => {
          this.setState('loading', msg);
        });
      }

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
      console.log(`[AvatarChatController] Generating reply with ${this.llmProvider}...`);
      
      const { reply } =
        this.llmProvider === 'gemini-nano'
          ? await this.geminiNanoService.generate(this.history)
          : await this.lfmService.generate(this.history);

      console.log('[AvatarChatController] LLM parsed reply:', reply);

      // Add assistant speech to history
      const assistantMessage: ChatMessage = { role: 'assistant', content: reply.speech };
      this.history.push(assistantMessage);
      this.events.onMessageAdded?.(assistantMessage, {
        expression: reply.expression,
        motion: reply.motion,
      });

      // 3. Generate speech in punctuation-delimited chunks. Once the first
      // chunk is ready, play it while WebGPU generates the next one.
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
    responseStartTime: number
  ): Promise<void> {
    const chunks = splitSpeechIntoChunks(reply.speech);
    if (chunks.length === 0) return;

    const numSteps = this.ttsNumSteps;
    let hasStartedPlayback = false;
    let hasLoggedSpeechStart = false;
    console.log(
      `[AvatarChatController] Streaming TTS: ${chunks.length} chunk(s), ${numSteps} steps`,
      chunks
    );

    type Synthesis = Awaited<ReturnType<IrodoriTTSService['synthesize']>>;
    type SettledSynthesis = { value: Synthesis } | { error: unknown };
    const queueSynthesis = (index: number): Promise<SettledSynthesis> => {
      const displayIndex = index + 1;
      this.events.onTtsGpuActivityChange?.(true);
      return this.ttsService
        .synthesize(chunks[index], {
          numSteps,
          onProgress: (pct) => {
            if (hasStartedPlayback) {
              this.setState(
                'speaking',
                `再生中 · 次の音声生成中 (${displayIndex}/${chunks.length}, ${pct}%)`
              );
            } else {
              this.setState(
                'synthesizing',
                `音声生成中 (${displayIndex}/${chunks.length}, ${pct}%)...`
              );
            }
          },
        })
        .then(
          (value) => ({ value }),
          (error) => ({ error })
        )
        .finally(() => {
          this.events.onTtsGpuActivityChange?.(false);
        });
    };

    this.setState('synthesizing', `音声生成中 (1/${chunks.length}, 0%)...`);
    let pendingSynthesis = queueSynthesis(0);

    // Apply one expression and motion across all audio chunks.
    if (this.avatar) {
      this.avatar.setExpression(reply.expression, 1.0);
      const motionUrl = MOTIONS[reply.motion] || MOTIONS.idle;
      const isLoop = reply.motion === 'idle' || reply.motion === 'standing';
      this.avatar.playAnimation(motionUrl, isLoop, 0.4);
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const synthesized = await pendingSynthesis;
      if ('error' in synthesized) throw synthesized.error;

      hasStartedPlayback = true;
      pendingSynthesis =
        index + 1 < chunks.length
          ? queueSynthesis(index + 1)
          : Promise.resolve({ value: synthesized.value });

      this.setState('speaking', `再生中 (${index + 1}/${chunks.length})`);
      await this.playAudioChunk(synthesized.value.wavBlob, index, chunks.length, () => {
        if (hasLoggedSpeechStart) return;
        hasLoggedSpeechStart = true;
        const speechStartMs = performance.now() - responseStartTime;
        console.log(`[Chat] response -> speech start: ${speechStartMs.toFixed(1)} ms`);
      });
    }

    console.log('[AvatarChatController] Streaming speech playback completed.');
  }

  private playAudioChunk(
    wavBlob: Blob,
    index: number,
    total: number,
    onStarted: () => void
  ): Promise<void> {
    if (!this.audioLipSync) return Promise.resolve();

    const lipSync = this.audioLipSync;
    const audioElement = lipSync.audioElement;
    const file = new File([wavBlob], `ai-response-${index + 1}.wav`, { type: 'audio/wav' });
    console.log(
      `[AvatarChatController] Playing audio chunk ${index + 1}/${total} (${wavBlob.size} bytes)`
    );

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        finish(new Error(`音声チャンク ${index + 1}/${total} の再生がタイムアウトしました`));
      }, 60000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        audioElement.removeEventListener('ended', handleEnded);
        audioElement.removeEventListener('error', handleError);
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const handleEnded = () => finish();
      const handleError = () => {
        const mediaError = audioElement.error;
        finish(
          new Error(
            `音声チャンクの再生に失敗しました${mediaError ? ` (code: ${mediaError.code})` : ''}`
          )
        );
      };

      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('error', handleError);

      try {
        lipSync.loadAudioFile(file);
        void lipSync.play().then(
          () => {
            if (audioElement.paused) {
              finish(new Error('ブラウザが音声再生を開始できませんでした'));
              return;
            }
            onStarted();
          },
          (error) => {
            finish(error instanceof Error ? error : new Error(String(error)));
          }
        );
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
