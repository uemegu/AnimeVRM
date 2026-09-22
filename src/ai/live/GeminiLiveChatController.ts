import { Avatar } from '../../Avatar';
import { AudioLipSync } from '../../AudioLipSync';
import { resolveAssetUrl } from '../../utils/path';
import { MotionRecipeService, GeneratedMotionRecipe } from '../motion/MotionRecipeService';
import { GeminiLiveClient, ToolCallItem } from './GeminiLiveClient';
import { AudioRecorder } from './AudioRecorder';
import { ArdyMotionService, type ArdyMotionState } from '../motion/ardy/ArdyMotionService';
import { createArdyAnimationClip } from '../motion/ardy/createArdyAnimationClip';
import { FingerMotionService, describeFingerMotion, applyFingerMotion } from '../motion/FingerMotion';

import { parseArdyMotionPlan, type ArdyMotionStep } from './ArdyMotionPlan';
import { ArdyMotionSequence } from './ArdyMotionSequence';
import { GeminiMotionPlanner, DEFAULT_MOTION_PLANNER_MODEL } from './GeminiMotionPlanner';

interface MotionRequest {
  id: string;
  abort: AbortController;
  sequence: ArdyMotionSequence;
  source: 'reply' | 'autonomous' | 'preview';
}

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
  private ardyRequest: MotionRequest | null = null;
  private pendingAutonomous: MotionRequest | null = null;
  private autonomousEnabled = true;
  private plannerModel = DEFAULT_MOTION_PLANNER_MODEL;
  private planner = new GeminiMotionPlanner();
  private plannerAbort: AbortController | null = null;
  private autonomousTimer: ReturnType<typeof setTimeout> | null = null;
  private autonomousFailures = 0;
  private recentMotions: string[] = [];
  private waitingForReply = false;
  private receivedReply = false;
  private inputMessage: LiveChatMessage | null = null;
  private pendingAudio: Array<{ pcm: Int16Array; rate: number }> = [];
  private audioWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private motionStartTimer: ReturnType<typeof setTimeout> | null = null;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  private speechStarted = false;
  private serverTurnComplete = true;
  private fingerMotionService = new FingerMotionService();

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
    const operation = this.startArdyMotion({ id: crypto.randomUUID(), name: 'generateArdyMotion', args: { prompt, duration } }, 'preview');
    this.currentAssistantMessage = null;
    await operation;
  }

  public getAutonomousEnabled(): boolean { return this.autonomousEnabled; }
  public getPlannerModel(): string { return this.plannerModel; }
  public setPlannerModel(model: string): void { this.plannerModel = model.trim() || DEFAULT_MOTION_PLANNER_MODEL; }

  public setAutonomousEnabled(enabled: boolean): void {
    this.autonomousEnabled = enabled;
    this.autonomousFailures = 0;
    this.cancelAutonomous();
    if (!enabled && this.ardyRequest?.source === 'autonomous') this.stopActiveMotion();
    if (enabled) this.scheduleAutonomous();
    this.events.onArdyStateChange?.(this.ardyState, this.ardyDetail);
  }

  private stopActiveMotion(): void {
    if (this.motionStartTimer) clearTimeout(this.motionStartTimer);
    this.motionStartTimer = null;
    this.ardyRequest?.abort.abort();
    this.ardyRequest = null;
    this.avatar?.stopGeneratedAnimation();
  }

  private cancelAutonomous(): void {
    if (this.autonomousTimer) clearTimeout(this.autonomousTimer);
    this.autonomousTimer = null;
    this.plannerAbort?.abort();
    this.plannerAbort = null;
    this.pendingAutonomous?.abort.abort();
    this.pendingAutonomous = null;
  }

  private cancelArdyMotion(): void {
    this.cancelAutonomous();
    this.stopActiveMotion();
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
            this.autonomousFailures = 0;
            this.scheduleAutonomous(1500);
          },
          onAudioData: (pcmInt16, sampleRate) => this.receiveAudio(pcmInt16, sampleRate),
          onTextChunk: (chunk) => {
            this.receivedReply = true;
            this.appendAssistantText(chunk);
          },
          onInputTranscription: (text) => this.receiveInputTranscription(text),
          onInterrupted: () => {
            this.beginUserTurn();
            this.setState(this.isMicActive ? 'listening' : 'connected', '聞き取り中...');
          },
          onTurnComplete: () => {
            this.currentAssistantMessage = null;
            // An interrupted turn can finish while the user is still speaking.
            if (this.receivedReply || !this.waitingForReply) {
              this.inputMessage = null;
              this.waitingForReply = false;
            }
            this.serverTurnComplete = true;
            this.fitMotionToSpeech();
            this.checkSpeechEnd();
            if (!this.speechStarted && !this.pendingAudio.length) this.scheduleAutonomous();
          },
          onToolCall: async (tool) => {
            this.receivedReply = true;
            return await this.handleToolExecution(tool);
          },
          onToolCallCancelled: (ids) => {
            if (this.ardyRequest && ids.includes(this.ardyRequest.id)) this.cancelArdyMotion();
          },
          onError: (err) => {
            this.cancelArdyMotion();
            this.clearSpeech();
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
    this.clearSpeech();
    this.waitingForReply = false;
    this.inputMessage = null;
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
    this.beginUserTurn();

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
      try {
        // Wait only for the first clip. Gemini can then speak while later clips generate.
        await this.startArdyMotion(tool);
        return { status: 'ready', tool: tool.name };
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

  private startArdyMotion(tool: ToolCallItem, source: 'reply' | 'preview' = 'reply'): Promise<void> {
    const steps = parseArdyMotionPlan(tool.args);
    if (!this.avatar?.vrm) throw new Error('アバターを読み込んでください。');
    this.cancelArdyMotion();
    if (source === 'reply') {
      this.waitingForReply = false;
      // Audio may already have completed receipt while motion generation was queued.
      if (!this.speechStarted && !this.pendingAudio.length) this.serverTurnComplete = false;
    }
    if (!this.currentAssistantMessage) this.appendAssistantText('');
    const request = this.createMotionRequest(tool.id, steps, source, this.currentAssistantMessage!);
    this.ardyRequest = request;
    return request.sequence.prepare().then(() => {
      request.abort.signal.throwIfAborted();
      if (source === 'preview' || this.speechStarted) {
        request.sequence.start();
        this.fitMotionToSpeech();
      } else if (this.pendingAudio.length) {
        this.flushAudio();
      } else {
        // A tool-only response is still allowed to move without waiting forever for audio.
        this.motionStartTimer = setTimeout(() => {
          this.motionStartTimer = null;
          if (this.ardyRequest === request && !request.abort.signal.aborted) request.sequence.start();
        }, 1500);
      }
    });
  }

  private createMotionRequest(id: string, steps: ArdyMotionStep[], source: MotionRequest['source'], message?: LiveChatMessage): MotionRequest {
    const avatar = this.avatar!;
    const abort = new AbortController();
    const tags = steps.map((step, index) => ({
      name: 'generateArdyMotion', detail: `ardy-mini ${index + 1}/${steps.length}: ${step.prompt} — 待機`,
    }));
    if (message) {
      (message.tools ??= []).push(...tags);
      this.events.onMessageUpdated?.(message);
    }
    const ensureCurrent = () => {
      abort.signal.throwIfAborted();
      if (this.avatar !== avatar || !avatar.vrm) throw new DOMException('Avatar changed', 'AbortError');
    };
    const request: MotionRequest = { id, abort, source, sequence: new ArdyMotionSequence(steps, abort.signal, {
      prepare: async step => {
        const motion = await this.ardyService.generate(step.prompt, step.duration, abort.signal);
        ensureCurrent();
        const targets = await this.fingerMotionService.createTargets(step.fingers, avatar.vrm!);
        ensureCurrent();
        const clip = createArdyAnimationClip(motion, avatar.vrm!);
        return { clip, applyFingers: () => applyFingerMotion(clip, avatar.vrm!, targets) };
      },
      play: (clip, finished) => {
        ensureCurrent();
        return avatar.playAnimationClip(clip, 0.25, finished);
      },
      onStep: (index, state, error) => {
        const step = steps[index];
        const labels = { generating: '生成中', ready: '準備完了', playing: '再生', finished: '完了', cancelled: 'キャンセル', error: '失敗' };
        tags[index].detail = `ardy-mini ${index + 1}/${steps.length}: ${step.prompt} (${step.duration}s) — ${labels[state]}${error ? `: ${error instanceof Error ? error.message : String(error)}` : ''} / Finger Motion: ${describeFingerMotion(step.fingers)} (1s → 保持)`;
        if (message) this.events.onMessageUpdated?.(message);
        if (state === 'playing') {
          this.recentMotions = [...this.recentMotions, step.prompt].slice(-6);
          console.debug('[ardy-mini] sequence playback', { id, source, index, prompt: step.prompt });
        }
      },
      onLowWater: () => { if (source !== 'preview' && this.ardyRequest === request) this.scheduleAutonomous(); },
      onComplete: () => {
        if (this.ardyRequest !== request) return;
        this.ardyRequest = null;
        if (source !== 'preview') this.advanceAutonomous();
      },
      onError: error => {
        if (this.ardyRequest === request) {
          this.stopActiveMotion();
          this.flushAudio();
        }
        if (source === 'autonomous') this.autonomousError(error);
        else if (source !== 'preview') this.scheduleAutonomous(2000);
      },
    }) };
    return request;
  }

  private beginUserTurn(): void {
    if (this.receivedReply || !this.waitingForReply) this.inputMessage = null;
    this.waitingForReply = true;
    this.receivedReply = false;
    this.cancelArdyMotion();
    this.clearSpeech();
    this.currentAssistantMessage = null;
    if (this.state === 'speaking') this.setState(this.isMicActive ? 'listening' : 'connected', '聞き取り中...');
  }

  private receiveInputTranscription(text: string): void {
    if (!this.inputMessage) {
      this.beginUserTurn();
      this.inputMessage = { id: crypto.randomUUID(), role: 'user', content: '', timestamp: Date.now() };
      this.history.push(this.inputMessage);
      this.events.onMessageAdded?.(this.inputMessage);
    }
    this.inputMessage.content += text;
    this.events.onMessageUpdated?.(this.inputMessage);
  }

  private clearSpeech(): void {
    if (this.audioWaitTimer) clearTimeout(this.audioWaitTimer);
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.audioWaitTimer = this.speechTimer = null;
    this.pendingAudio = [];
    this.speechStarted = false;
    this.serverTurnComplete = true;
    this.audioLipSync?.stopPcmStream();
  }

  private receiveAudio(pcm: Int16Array, rate: number): void {
    if (!pcm.length) return;
    this.serverTurnComplete = false;
    this.receivedReply = true;
    this.waitingForReply = false;
    if (this.state !== 'speaking') this.setState('speaking', 'アバター発話中...');
    if (!this.speechStarted) {
      // A newly spoken response has priority over silent, speculative movement.
      if (!this.pendingAudio.length) this.cancelAutonomous();
      if (this.ardyRequest?.source === 'autonomous') this.stopActiveMotion();
      this.pendingAudio.push({ pcm, rate });
      if (!this.ardyEnabled) { this.flushAudio(); return; }
      if (!this.audioWaitTimer) {
        // Bound added latency if a tool is absent, slow, cancelled, or fails.
        this.audioWaitTimer = setTimeout(() => this.flushAudio(), 1500);
        const request = this.ardyRequest;
        if (request?.source === 'reply') {
          void request.sequence.ready.then(() => {
            if (this.ardyRequest === request && !request.abort.signal.aborted) this.flushAudio();
          }).catch(() => {});
        }
      }
    } else {
      this.audioLipSync?.playPcmChunk(pcm, rate);
    }
  }

  private flushAudio(): void {
    if (this.audioWaitTimer) clearTimeout(this.audioWaitTimer);
    this.audioWaitTimer = null;
    if (!this.pendingAudio.length) return;
    this.speechStarted = true;
    for (const { pcm, rate } of this.pendingAudio) this.audioLipSync?.playPcmChunk(pcm, rate);
    this.pendingAudio = [];
    if (this.ardyRequest?.source === 'reply') {
      if (this.motionStartTimer) clearTimeout(this.motionStartTimer);
      this.motionStartTimer = null;
      this.ardyRequest.sequence.start();
    }
    this.fitMotionToSpeech();
    this.checkSpeechEnd();
  }

  private fitMotionToSpeech(): void {
    if (this.serverTurnComplete && this.speechStarted && this.ardyRequest?.source === 'reply') {
      this.ardyRequest.sequence.fitToSpeech(this.audioLipSync?.getPcmRemainingSeconds() ?? 0);
    }
  }

  private checkSpeechEnd(): void {
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = null;
    if (!this.speechStarted) return;
    if (this.serverTurnComplete && !this.pendingAudio.length && (this.audioLipSync?.getPcmRemainingSeconds() ?? 0) <= 0) {
      this.speechStarted = false;
      if (this.state === 'speaking') this.setState(this.isMicActive ? 'listening' : 'connected', this.isMicActive ? '待機中 (お話しください)' : '接続完了');
      if (this.ardyRequest?.source === 'reply') this.stopActiveMotion();
      this.advanceAutonomous();
      return;
    }
    this.speechTimer = setTimeout(() => this.checkSpeechEnd(), 50);
  }

  private canMoveAutonomously(): boolean {
    return this.autonomousEnabled && this.ardyEnabled && this.ardyService.ready && !!this.avatar?.vrm &&
      !!this.client?.connected && this.client.setupComplete && !this.waitingForReply &&
      !['disconnected', 'connecting', 'error'].includes(this.state);
  }

  private scheduleAutonomous(delay = 0): void {
    if (!this.canMoveAutonomously() || this.pendingAutonomous || this.autonomousTimer) return;
    this.autonomousTimer = setTimeout(() => {
      this.autonomousTimer = null;
      void this.prepareAutonomous();
    }, delay);
  }

  private async prepareAutonomous(): Promise<void> {
    if (!this.canMoveAutonomously() || this.plannerAbort || this.pendingAutonomous) return;
    const abort = new AbortController();
    this.plannerAbort = abort;
    try {
      const steps = await this.planner.generate(this.apiKey, this.plannerModel, {
        conversation: this.history.filter(message => message.content).slice(-8).map(({ role, content }) => ({ role, content: content.slice(-2000) })),
        recentMotions: this.recentMotions,
        speaking: this.speechStarted,
        remainingSpeechSeconds: this.audioLipSync?.getPcmRemainingSeconds() ?? 0,
      }, abort.signal);
      abort.signal.throwIfAborted();
      if (!this.canMoveAutonomously()) return;
      const request = this.createMotionRequest(crypto.randomUUID(), steps, 'autonomous');
      this.pendingAutonomous = request;
      await request.sequence.prepare();
      abort.signal.throwIfAborted();
      request.abort.signal.throwIfAborted();
      this.autonomousFailures = 0;
      // Only consume a speculative result after the foreground sequence finishes.
      if (!this.ardyRequest) this.advanceAutonomous();
    } catch (error) {
      if (!abort.signal.aborted) this.autonomousError(error);
    } finally {
      if (this.plannerAbort === abort) this.plannerAbort = null;
    }
  }

  private advanceAutonomous(): void {
    if (!this.canMoveAutonomously() || this.ardyRequest) return;
    const next = this.pendingAutonomous;
    if (next && !next.abort.signal.aborted) {
      this.pendingAutonomous = null;
      this.ardyRequest = next;
      next.sequence.start();
    } else {
      this.scheduleAutonomous();
    }
  }

  private autonomousError(error: unknown): void {
    this.cancelAutonomous();
    this.autonomousFailures++;
    console.warn('[ardy-mini] autonomous motion failed', error);
    this.ardyDetail = `自律動作: ${error instanceof Error ? error.message : String(error)}`;
    if (this.autonomousFailures >= 3) {
      this.autonomousEnabled = false;
      this.ardyDetail += ' — 3回失敗したため停止。自律動作をONにすると再試行します。';
    } else {
      this.scheduleAutonomous(5000 * this.autonomousFailures);
    }
    this.events.onArdyStateChange?.(this.ardyState, this.ardyDetail);
  }

  private setState(state: GeminiLiveChatState, statusText?: string): void {
    this.state = state;
    this.events.onStateChange?.(state, statusText);
  }
}
