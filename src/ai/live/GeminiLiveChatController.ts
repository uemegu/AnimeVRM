import { Avatar } from '../../Avatar';
import { AudioLipSync } from '../../AudioLipSync';
import { resolveAssetUrl } from '../../utils/path';
import { MotionRecipeService, GeneratedMotionRecipe } from '../motion/MotionRecipeService';
import { GeminiLiveClient, ToolCallItem } from './GeminiLiveClient';
import { AudioRecorder } from './AudioRecorder';

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

  constructor(events: GeminiLiveChatEvents = {}) {
    this.events = events;
    this.motionService = new MotionRecipeService();
  }

  public setEvents(events: GeminiLiveChatEvents): void {
    this.events = events;
  }

  public setAvatar(avatar: Avatar | null): void {
    this.avatar = avatar;
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

    this.setState('connecting', 'Gemini Live に接続中...');

    try {
      this.client = new GeminiLiveClient(
        {
          apiKey: this.apiKey,
          model: this.model,
          voiceName: this.voiceName,
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
          onError: (err) => {
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

  private setState(state: GeminiLiveChatState, statusText?: string): void {
    this.state = state;
    this.events.onStateChange?.(state, statusText);
  }
}
