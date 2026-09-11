import { Avatar } from '../Avatar';
import { AudioLipSync } from '../AudioLipSync';
import { ChatMessage, AvatarExpression } from './types';
import { MOTIONS } from './AvatarChatController';
import { VadService } from './vad/VadService';
import { GeminiApiService } from './gemini/GeminiApiService';
import { LocalIrodoriTTSService } from './tts/LocalIrodoriTTSService';
import { MotionRecipeService } from './motion/MotionRecipeService';

export type GeminiVadChatState =
  | 'idle'
  | 'listening'
  | 'speaking_user'
  | 'thinking'
  | 'synthesizing'
  | 'speaking_avatar'
  | 'error';

export interface GeminiVadChatEvents {
  onStateChange?: (state: GeminiVadChatState, statusText?: string) => void;
  onMessageAdded?: (
    message: ChatMessage,
    meta?: { expression?: AvatarExpression; motionLayers?: string[] }
  ) => void;
  onError?: (error: Error | string) => void;
}

export class GeminiVadChatController {
  private vadService: VadService;
  private geminiService: GeminiApiService;
  private ttsService: LocalIrodoriTTSService;
  private motionService: MotionRecipeService;

  private avatar: Avatar | null = null;
  private audioLipSync: AudioLipSync | null = null;
  private state: GeminiVadChatState = 'idle';
  private history: ChatMessage[] = [];
  private events: GeminiVadChatEvents;
  private isProcessingTurn = false;
  private isConversationActive = false;

  constructor(events: GeminiVadChatEvents = {}) {
    this.events = events;
    this.geminiService = new GeminiApiService();
    this.ttsService = new LocalIrodoriTTSService();
    this.motionService = new MotionRecipeService();

    this.vadService = new VadService({
      onSpeechStart: () => {
        if (!this.isProcessingTurn) {
          this.setState('speaking_user', '音声を検出中...');
        }
      },
      onSpeechEnd: (wavBlob) => {
        if (!this.isProcessingTurn && this.isConversationActive) {
          void this.handleUserVoiceInput(wavBlob);
        }
      },
      onVADMisfire: () => {
        if (this.isConversationActive && !this.isProcessingTurn) {
          this.setState('listening', 'お話しください（待機中）');
        }
      },
      onError: (err) => {
        console.error('[GeminiVadChatController] VAD error:', err);
        this.setState('error', typeof err === 'string' ? err : err.message);
        this.events.onError?.(err);
      },
    });
  }

  public setEvents(events: GeminiVadChatEvents): void {
    this.events = events;
  }

  public setAvatar(avatar: Avatar | null): void {
    this.avatar = avatar;
  }

  public setAudioLipSync(audioLipSync: AudioLipSync | null): void {
    this.audioLipSync = audioLipSync;
  }

  public setApiKey(apiKey: string): void {
    this.geminiService.setApiKey(apiKey);
  }

  public hasApiKey(): boolean {
    return this.geminiService.hasApiKey();
  }

  public setTtsServerUrl(url: string): void {
    this.ttsService.setServerUrl(url);
  }

  public getTtsServerUrl(): string {
    return this.ttsService.getServerUrl();
  }

  public setTtsRefPath(ref: string): void {
    this.ttsService.setDefaultRef(ref);
  }

  public getTtsRefPath(): string {
    return this.ttsService.getDefaultRef();
  }

  public setTtsSteps(steps: number): void {
    this.ttsService.setDefaultSteps(steps);
  }

  public getTtsSteps(): number {
    return this.ttsService.getDefaultSteps();
  }

  public getState(): GeminiVadChatState {
    return this.state;
  }

  public getHistory(): readonly ChatMessage[] {
    return this.history;
  }

  private setState(state: GeminiVadChatState, statusText?: string): void {
    this.state = state;
    this.events.onStateChange?.(state, statusText);
  }

  /**
   * Start listening via VAD microphone
   */
  public async startConversation(): Promise<void> {
    if (!this.hasApiKey()) {
      throw new Error('Gemini APIキーを入力してください。');
    }

    try {
      this.setState('idle', 'システムを準備中...');
      // Pre-warm resources
      await this.motionService.initialize();

      await this.vadService.start();
      this.isConversationActive = true;
      this.setState('listening', 'お話しください（待機中）');
    } catch (err: any) {
      console.error('[GeminiVadChatController] Failed to start conversation:', err);
      this.setState('error', err?.message || '会話の開始に失敗しました');
      this.events.onError?.(err);
      throw err;
    }
  }

  /**
   * Stop conversation & pause microphone
   */
  public async stopConversation(): Promise<void> {
    this.isConversationActive = false;
    await this.vadService.pause();
    this.setState('idle', '停止中');
  }

  /**
   * Handle recorded audio from VAD
   */
  private async handleUserVoiceInput(wavBlob: Blob): Promise<void> {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;

    // Temporarily pause VAD while processing and speaking
    await this.vadService.pause();

    try {
      this.setState('thinking', 'Geminiが思考中...');

      // 1. Add user audio placeholder message to history
      const userMessage: ChatMessage = { role: 'user', content: '🎙️ [音声入力]' };
      this.history.push(userMessage);
      this.events.onMessageAdded?.(userMessage);

      // 2. Generate Aoi's reply from voice via Gemini API
      const reply = await this.geminiService.generateAvatarReply(wavBlob, this.history);
      console.log('[GeminiVadChatController] Received reply:', reply);

      await this.processTurnResponse(reply);
    } catch (err: any) {
      console.error('[GeminiVadChatController] Turn error:', err);
      this.setState('error', err?.message || '応答処理中にエラーが発生しました');
      this.events.onError?.(err);
    } finally {
      this.isProcessingTurn = false;
      if (this.isConversationActive) {
        await this.vadService.start();
        this.setState('listening', 'お話しください（待機中）');
      }
    }
  }

  /**
   * Send a text message manually
   */
  public async sendTextMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.isProcessingTurn) return;

    if (!this.hasApiKey()) {
      throw new Error('Gemini APIキーを入力してください。');
    }

    this.isProcessingTurn = true;
    const wasListening = this.vadService.listening;
    if (wasListening) {
      await this.vadService.pause();
    }

    try {
      this.setState('thinking', 'Geminiが思考中...');

      const userMessage: ChatMessage = { role: 'user', content: trimmed };
      this.history.push(userMessage);
      this.events.onMessageAdded?.(userMessage);

      // Pre-warm motion service if needed
      await this.motionService.initialize();

      const reply = await this.geminiService.generateAvatarReply(trimmed, this.history);
      console.log('[GeminiVadChatController] Received reply:', reply);

      await this.processTurnResponse(reply);
    } catch (err: any) {
      console.error('[GeminiVadChatController] Text turn error:', err);
      this.setState('error', err?.message || '応答処理中にエラーが発生しました');
      this.events.onError?.(err);
    } finally {
      this.isProcessingTurn = false;
      if (this.isConversationActive) {
        await this.vadService.start();
        this.setState('listening', 'お話しください（待機中）');
      } else {
        this.setState('idle', '待機中');
      }
    }
  }

  /**
   * Parallel execution:
   * 1. Irodori-TTS speech synthesis
   * 2. Gemini dynamic motion generation & FBX baking
   * Then synchronized playback with lipsync!
   */
  private async processTurnResponse(reply: {
    speech: string;
    expression: AvatarExpression;
  }): Promise<void> {
    this.setState('synthesizing', '音声＆モーションを生成中...');

    // Apply expression to avatar immediately
    if (this.avatar) {
      this.avatar.setExpression(reply.expression, 0.85);
    }

    // Parallel tasks:
    // Task 1: TTS synthesis with local server
    const ttsTask = this.ttsService.synthesize(reply.speech);

    // Task 2: Motion generation via gemini-3.5-flash-lite + FBX bake
    const motionTask = (async () => {
      try {
        const recipeDef = await this.geminiService.generateAvatarMotion(
          reply.speech,
          reply.expression
        );
        return await this.motionService.bakeMotionToFBXUrl(recipeDef);
      } catch (motionErr) {
        console.warn('[GeminiVadChatController] Motion generation fallback:', motionErr);
        return null;
      }
    })();

    // Await both tasks in parallel
    const [audioBlob, motionResult] = await Promise.all([ttsTask, motionTask]);

    // Add assistant message to UI history
    const assistantMessage: ChatMessage = { role: 'assistant', content: reply.speech };
    this.history.push(assistantMessage);
    this.events.onMessageAdded?.(assistantMessage, {
      expression: reply.expression,
      motionLayers: motionResult?.layerSummary,
    });

    // Playback audio + motion
    this.setState('speaking_avatar', 'アバターが発話中...');

    // Trigger motion
    if (this.avatar && motionResult) {
      console.log('[GeminiVadChatController] Playing custom baked motion:', motionResult.layerSummary);
      this.avatar.playAnimation(motionResult.blobUrl, false, 0.35, MOTIONS.idle);
    } else if (this.avatar) {
      this.avatar.playAnimation(MOTIONS.greeting, false, 0.35, MOTIONS.idle);
    }

    // Play audio with lip-sync
    if (this.audioLipSync) {
      const audioFile = new File([audioBlob], 'aoi_reply.wav', { type: 'audio/wav' });
      this.audioLipSync.loadAudioFile(audioFile);
      await this.audioLipSync.play();

      // Wait until playback finishes
      await new Promise<void>((resolve) => {
        const checkPlaying = () => {
          if (!this.audioLipSync?.isPlaying) {
            resolve();
          } else {
            setTimeout(checkPlaying, 60);
          }
        };
        setTimeout(checkPlaying, 120);
      });
    }

    // Reset expression and restore idle
    if (this.avatar) {
      this.avatar.setExpression('neutral', 0.5);
      this.avatar.playAnimation(MOTIONS.idle, true, 0.5);
    }
  }

  public dispose(): void {
    void this.stopConversation();
    void this.vadService.destroy();
    this.motionService.dispose();
  }
}
