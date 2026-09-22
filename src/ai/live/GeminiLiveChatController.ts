import { Avatar } from '../../Avatar';
import { AudioLipSync } from '../../AudioLipSync';
import { resolveAssetUrl } from '../../utils/path';
import { MotionRecipeService, GeneratedMotionRecipe } from '../motion/MotionRecipeService';
import { GeminiLiveClient, ToolCallItem } from './GeminiLiveClient';
import { AudioRecorder } from './AudioRecorder';
import { ArdyMotionService, type ArdyMotionState } from '../motion/ardy/ArdyMotionService';
import { createArdyAnimationClip } from '../motion/ardy/createArdyAnimationClip';

export type GeminiLiveChatState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'error';

export interface ChatMessageTool {
  name: string;
  detail: string;
}

export interface LiveChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: ChatMessageTool[];
  timestamp: number;
}

export interface GeminiLiveChatEvents {
  onStateChange?: (state: GeminiLiveChatState, statusText?: string) => void;
  onMessageAdded?: (message: LiveChatMessage) => void;
  onMessageUpdated?: (message: LiveChatMessage) => void;
  onError?: (error: Error | string) => void;
  onMicStateChange?: (active: boolean) => void;
  onArdyStateChange?: (state: ArdyMotionState, detail?: string) => void;
}

export const LIVE_MOTIONS: Record<string, string> = {
  idle: '/animations/Idle.fbx',
  standing: '/animations/Female Standing Pose.fbx',
  greeting: '/animations/Standing Greeting.fbx',
  bow: '/animations/Quick Formal Bow.fbx',
  acknowledge: '/animations/Acknowledging.fbx',
  dismiss: '/animations/Dismissing Gesture.fbx',
  salute: '/animations/Salute.fbx',
  excited: '/animations/Excited.fbx',
  angry: '/animations/Angry.fbx',
  clasp_hands: '/animations/clasp_hands_front.fbx',
  chin_rest: '/animations/chin_rest.fbx',
  walking: '/animations/Walking.fbx',
  jogging: '/animations/Jogging.fbx',
  punching: '/animations/Punching.fbx',
  ohoho: '/animations/Ohoho.fbx',
};

export class GeminiLiveChatController {
  private client: GeminiLiveClient | null = null;
  private recorder: AudioRecorder | null = null;
  private motionService: MotionRecipeService;

  private avatar: Avatar | null = null;
  private audioLipSync: AudioLipSync | null = null;

  private state: GeminiLiveChatState = 'disconnected';
  private apiKey = '';
  private model = 'gemini-3.8-live';
  private voiceName = 'Aoede';

  private history: LiveChatMessage[] = [];
  private currentAssistantMessage: LiveChatMessage | null = null;
  private events: GeminiLiveChatEvents;
  private isMicActive = false;
  private ardyEnabled = false;
  private ardyService: ArdyMotionService;
  private ardyState: ArdyMotionState = 'unloaded';
  private ardyDetail = '';
  private ardyRequest: { id: string; abort: AbortController } | null = null;

  constructor(events: GeminiLiveChatEvents = {}) {
    this.events = events;
    this.motionService = new MotionRecipeService();
    this.ardyService = new ArdyMotionService((state, detail) => {
      this.ardyState = state;
      this.ardyDetail = detail || '';
      this.events.onArdyStateChange?.(state, detail);
    });
  }

  public setEvents(events: GeminiLiveChatEvents): void {
    this.events = events;
  }

  public setAvatar(avatar: Avatar | null): void {
    if (this.avatar !== avatar) this.cancelArdyMotion();
    this.avatar = avatar;
  }

  public getArdyEnabled(): boolean { return this.ardyEnabled; }
  public getArdyState(): ArdyMotionState { return this.ardyState; }
  public getArdyDetail(): string { return this.ardyDetail; }

  public setArdyEnabled(enabled: boolean): void {
    if (this.state !== 'disconnected' && this.state !== 'error') {
      throw new Error('モーション方式を変更する前に会話を切断してください。');
    }
    this.ardyEnabled = enabled;
    if (!enabled) {
      this.cancelArdyMotion();
      this.ardyService.dispose();
    }
  }

  public async loadArdyModel(): Promise<void> { await this.ardyService.initialize(); }

  /** Also available without a Gemini API key to test local motion generation. */
  public async previewArdyMotion(prompt: string, duration = 4): Promise<void> {
    if (this.state !== 'disconnected' && this.state !== 'error') throw new Error('会話を切断してからモーションを試してください。');
    if (!this.ardyEnabled || !this.ardyService.ready) throw new Error('ardy-mini のモデルを読み込んでください。');
    const operation = this.startArdyMotion({ id: crypto.randomUUID(), name: 'generateArdyMotion', args: { prompt, duration } });
    this.currentAssistantMessage = null;
    await operation;
  }

  private cancelArdyMotion(): void {
    this.ardyRequest?.abort.abort();
    this.ardyRequest = null;
    this.avatar?.stopGeneratedAnimation();
  }

  public setAudioLipSync(audioLipSync: AudioLipSync | null): void {
    this.audioLipSync = audioLipSync;
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  public setModel(model: string): void {
    this.model = model.trim() || 'gemini-3.8-live';
  }

  public getModel(): string {
    return this.model;
  }

  public setVoice(voice: string): void {
    this.voiceName = voice.trim() || 'Aoede';
  }

  public getVoice(): string {
    return this.voiceName;
  }

  public getState(): GeminiLiveChatState {
    return this.state;
  }

  public getHistory(): readonly LiveChatMessage[] {
    return this.history;
  }

  public getIsMicActive(): boolean {
    return this.isMicActive;
  }

  public async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected' || this.state === 'speaking' || this.state === 'listening') {
      return;
    }

    if (!this.apiKey) {
      this.setState('error', 'APIキーを入力してください');
      throw new Error('APIキーが入力されていません');
    }

    if (this.ardyEnabled && !this.ardyService.ready) {
      throw new Error('先に ardy-mini のモデルを読み込んでください。');
    }

    this.setState('connecting', 'Gemini Live に接続中...');

    try {
      this.client = new GeminiLiveClient(
        {
          apiKey: this.apiKey,
          model: this.model,
          voiceName: this.voiceName,
          ardyMotionEnabled: this.ardyEnabled,
        },
        {
          onOpen: () => {
            console.log('[GeminiLive] WebSocket connected, waiting for setup...');
          },
          onSetupComplete: () => {
            console.log('[GeminiLive] Setup complete!');
            this.setState('connected', '接続完了 (待機中)');
            // Automatically start microphone once connected
            void this.startMicrophone().catch(() => {});
          },
          onAudioData: (pcmInt16, sampleRate) => {
            if (this.state !== 'speaking') {
              this.setState('speaking', 'アバター発話中...');
            }
            this.audioLipSync?.playPcmChunk(pcmInt16, sampleRate);
          },
          onTextChunk: (chunk) => {
            this.appendAssistantText(chunk);
          },
          onInterrupted: () => {
            console.log('[GeminiLive] Interrupted by user');
            this.audioLipSync?.stopPcmStream();
            this.cancelArdyMotion();
            this.setState(this.isMicActive ? 'listening' : 'connected', '聞き取り中...');
          },
          onTurnComplete: () => {
            this.currentAssistantMessage = null;
            if (this.state === 'speaking') {
              this.setState(this.isMicActive ? 'listening' : 'connected', this.isMicActive ? '待機中 (お話しください)' : '接続完了');
            }
          },
          onToolCall: async (tool) => {
            return await this.handleToolExecution(tool);
          },
          onToolCallCancelled: (ids) => {
            if (this.ardyRequest && ids.includes(this.ardyRequest.id)) this.cancelArdyMotion();
          },
          onError: (err) => {
            this.cancelArdyMotion();
            console.error('[GeminiLive] Error:', err);
            this.setState('error', '通信エラーが発生しました');
            this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
          },
          onClose: (event) => {
            console.log('[GeminiLive] WebSocket closed:', event.code, event.reason);
            this.cleanupSession();
            this.setState('disconnected', '切断されました');
          },
        }
      );

      await this.client.connect();
    } catch (err: any) {
      this.cleanupSession();
      const msg = err instanceof Error ? err.message : String(err);
      this.setState('error', `接続エラー: ${msg}`);
      throw err;
    }
  }

  public disconnect(): void {
    this.cleanupSession();
    this.setState('disconnected', '切断しました');
  }

  private cleanupSession(): void {
    this.cancelArdyMotion();
    this.stopMicrophone();
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.audioLipSync?.stopPcmStream();
    this.currentAssistantMessage = null;
  }

  public async toggleMicrophone(): Promise<boolean> {
    if (this.isMicActive) {
      this.stopMicrophone();
      return false;
    } else {
      await this.startMicrophone();
      return true;
    }
  }

  public async startMicrophone(): Promise<void> {
    if (this.isMicActive) return;

    if (!this.recorder) {
      this.recorder = new AudioRecorder({
        onAudioChunk: (pcm16) => {
          if (this.client?.connected && this.client.setupComplete) {
            this.client.sendRealtimeAudio(pcm16);
          }
        },
        onError: (err) => {
          console.error('[GeminiLive] AudioRecorder error:', err);
          this.stopMicrophone();
        },
      });
    }

    try {
      await this.recorder.start();
      this.isMicActive = true;
      this.events.onMicStateChange?.(true);
      if (this.state === 'connected') {
        this.setState('listening', '待機中 (お話しください)');
      }
    } catch (err) {
      this.isMicActive = false;
      this.events.onMicStateChange?.(false);
      throw err;
    }
  }

  public stopMicrophone(): void {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    this.isMicActive = false;
    this.events.onMicStateChange?.(false);
    if (this.state === 'listening') {
      this.setState('connected', '接続完了 (待機中)');
    }
  }

  public sendTextMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!this.client || !this.client.connected) {
      throw new Error('Gemini Live に接続されていません');
    }
    this.cancelArdyMotion();

    // Add user message to history
    const userMsg: LiveChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    this.history.push(userMsg);
    this.events.onMessageAdded?.(userMsg);

    this.client.sendTextMessage(trimmed);
  }

  private appendAssistantText(text: string): void {
    if (!this.currentAssistantMessage) {
      this.currentAssistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        tools: [],
        timestamp: Date.now(),
      };
      this.history.push(this.currentAssistantMessage);
      this.events.onMessageAdded?.(this.currentAssistantMessage);
    } else {
      this.currentAssistantMessage.content += text;
      this.events.onMessageUpdated?.(this.currentAssistantMessage);
    }
  }

  private async handleToolExecution(tool: ToolCallItem): Promise<Record<string, any>> {
    console.log('[GeminiLive] Tool call received:', tool.name, tool.args);

    let detailStr = '';

    if (tool.name === 'generateArdyMotion') {
      if (!this.ardyEnabled || !this.ardyService.ready) return { error: 'ardy-mini is not loaded.' };
      // Acknowledge immediately so GPU inference does not block Gemini audio.
      // The captured message is updated on completion even after turnComplete.
      try {
        const operation = this.startArdyMotion(tool);
        void operation.catch(() => {}); // Failure is recorded on the motion tag.
        return { status: 'generating', tool: tool.name };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
    if (this.ardyEnabled && ['setMotion', 'composeMotion'].includes(tool.name)) {
      return { error: 'Use generateArdyMotion while ardy-mini is enabled.' };
    }

    if (tool.name === 'setExpression') {
      const expr = String(tool.args.expression || 'neutral');
      detailStr = `表情: ${expr}`;
      if (this.avatar) {
        this.avatar.setExpression(expr, 1.0, 0.3);
      }
    } else if (tool.name === 'setMotion') {
      const motionName = String(tool.args.motion || 'idle');
      detailStr = `モーション: ${motionName}`;
      if (this.avatar) {
        const motionUrl = LIVE_MOTIONS[motionName] || LIVE_MOTIONS.idle;
        const resolved = resolveAssetUrl(motionUrl);
        const isLoop = motionName === 'idle' || motionName === 'standing';
        this.avatar.playAnimation(resolved, isLoop);
      }
    } else if (tool.name === 'composeMotion') {
      const duration = Number(tool.args.duration) || 3.0;
      const layers = Array.isArray(tool.args.layers) ? tool.args.layers : [];
      detailStr = `合成モーション (${layers.length} レイヤー / ${duration}s)`;

      if (this.avatar) {
        try {
          const recipe: GeneratedMotionRecipe = { duration, layers };
          const baked = await this.motionService.bakeMotionToFBXUrl(recipe);
          console.log('[GeminiLive] Playing baked motion FBX:', baked.layerSummary);
          this.avatar.playAnimation(baked.blobUrl, false);
          detailStr += `: ${baked.layerSummary.join(', ')}`;
        } catch (err: any) {
          console.warn('[GeminiLive] Failed to bake composite motion:', err);
          return { error: err.message || 'Motion bake failed' };
        }
      }
    }

    // Record tool call in the assistant message
    if (detailStr) {
      if (!this.currentAssistantMessage) {
        this.currentAssistantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          tools: [{ name: tool.name, detail: detailStr }],
          timestamp: Date.now(),
        };
        this.history.push(this.currentAssistantMessage);
        this.events.onMessageAdded?.(this.currentAssistantMessage);
      } else {
        this.currentAssistantMessage.tools = this.currentAssistantMessage.tools || [];
        this.currentAssistantMessage.tools.push({ name: tool.name, detail: detailStr });
        this.events.onMessageUpdated?.(this.currentAssistantMessage);
      }
    }

    return { status: 'success', tool: tool.name };
  }

  private startArdyMotion(tool: ToolCallItem): Promise<void> {
    const prompt = typeof tool.args.prompt === 'string' ? tool.args.prompt.trim() : '';
    const duration = tool.args.duration ?? 4;
    if (!prompt || prompt.length > 512) throw new Error('Motion prompt must contain 1–512 characters.');
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 2 || duration > 8) {
      throw new Error('Motion duration must be 2–8 seconds.');
    }
    const avatar = this.avatar;
    if (!avatar?.vrm) throw new Error('アバターを読み込んでください。');
    this.cancelArdyMotion();
    const abort = new AbortController();
    this.ardyRequest = { id: tool.id, abort };
    if (!this.currentAssistantMessage) this.appendAssistantText('');
    const message = this.currentAssistantMessage!;
    const tag: ChatMessageTool = { name: tool.name, detail: `ardy-mini: ${prompt} (${duration}s) — 生成中` };
    (message.tools ??= []).push(tag);
    this.events.onMessageUpdated?.(message);
    return this.ardyService.generate(prompt, duration, abort.signal).then((motion) => {
      abort.signal.throwIfAborted();
      if (this.avatar !== avatar || !avatar.vrm) throw new DOMException('Avatar changed', 'AbortError');
      const clip = createArdyAnimationClip(motion, avatar.vrm);
      if (!avatar.playAnimationClip(clip)) throw new Error('Motion playback failed.');
      tag.detail = `ardy-mini: ${prompt} (${duration}s) — 再生`;
    }).catch((error: unknown) => {
      const cancelled = abort.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      tag.detail = `ardy-mini: ${prompt} — ${cancelled ? 'キャンセル' : `失敗: ${error instanceof Error ? error.message : String(error)}`}`;
      throw error;
    }).finally(() => {
      // Keep the request identity after playback begins so a server cancellation stops it too.
      this.events.onMessageUpdated?.(message);
    });
  }

  private setState(state: GeminiLiveChatState, statusText?: string): void {
    this.state = state;
    this.events.onStateChange?.(state, statusText);
  }
}
