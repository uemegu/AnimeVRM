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

      // 3. Synthesize Voice
      this.setState('synthesizing', '音声生成中 (0%)...');
      console.log(`[AvatarChatController] Synthesizing speech: "${reply.speech}"...`);
      const { wavBlob } = await this.ttsService.synthesize(reply.speech, {
        numSteps: 8,
        onProgress: (pct) => {
          this.setState('synthesizing', `音声生成中 (${pct}%)...`);
        },
      });

      console.log('[AvatarChatController] TTS synthesized successfully.');

      // 4. Play Animation, Expression & Audio
      this.setState('speaking', '再生中');
      await this.playAvatarReaction(reply, wavBlob, responseStartTime);
    } catch (err: any) {
      console.error('[AvatarChatController] Error during chat turnaround:', err);
      const errMsg = err?.message || '処理中にエラーが発生しました';
      this.setState('error', errMsg);
      this.events.onError?.(err);
      this.isProcessing = false;
    }
  }

  private async playAvatarReaction(
    reply: AvatarReply,
    wavBlob: Blob,
    responseStartTime: number
  ): Promise<void> {
    // Apply expression
    if (this.avatar) {
      this.avatar.setExpression(reply.expression, 1.0);
    }

    // Apply motion
    const motionUrl = MOTIONS[reply.motion] || MOTIONS.idle;
    const isLoop = reply.motion === 'idle' || reply.motion === 'standing';
    if (this.avatar) {
      this.avatar.playAnimation(motionUrl, isLoop, 0.4);
    }

    // Play Audio with AudioLipSync
    if (this.audioLipSync) {
      const file = new File([wavBlob], 'ai-response.wav', { type: 'audio/wav' });
      console.log(`[AvatarChatController] Loading wav to AudioLipSync (${wavBlob.size} bytes)...`);

      let finished = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        this.isProcessing = false;
        this.setState('ready', '準備完了');
        console.log('[AvatarChatController] Speech playback completed.');
      };

      const originalAudioElem = (this.audioLipSync as any).audioElement as HTMLAudioElement;
      if (originalAudioElem) {
        originalAudioElem.addEventListener('ended', cleanup, { once: true });
        originalAudioElem.addEventListener('error', (e) => {
          console.error('[AvatarChatController] Audio element error:', e);
          cleanup();
        }, { once: true });
      }

      // Fallback timer (30s)
      setTimeout(() => {
        if (!finished && this.state === 'speaking') {
          console.warn('[AvatarChatController] Playback timeout fallback triggered.');
          cleanup();
        }
      }, 30000);

      this.audioLipSync.loadAudioFile(file);
      try {
        await this.audioLipSync.play();
        console.log('[AvatarChatController] AudioLipSync play started.');
      } catch (playErr) {
        console.error('[AvatarChatController] Error calling audioLipSync.play():', playErr);
        cleanup();
      }

      const speechStartMs = performance.now() - responseStartTime;
      console.log(`[Chat] response -> speech start: ${speechStartMs.toFixed(1)} ms`);
    } else {
      this.isProcessing = false;
      this.setState('ready', '準備完了');
    }
  }
}
