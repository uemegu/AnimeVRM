/**
 * Gemini Multimodal Live API WebSocket Client
 * Protocol: GenerativeService.BidiGenerateContent (WebSocket)
 */
import { ARDY_LIVE_PROMPT, ARDY_PLAN_SCHEMA } from './ArdyMotionPlan';

export interface GeminiLiveConfig {
  apiKey: string;
  model?: string; // e.g. "gemini-3.8-live", "gemini-3.8-live-extended-thinking", "gemini-2.0-flash-exp"
  voiceName?: string; // e.g. "Aoede", "Kore", "Puck", "Charon", etc. (30 official prebuilt voices)
  systemPrompt?: string;
  ardyMotionEnabled?: boolean;
}

export interface ToolCallItem {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface GeminiLiveCallbacks {
  onOpen?: () => void;
  onSetupComplete?: () => void;
  onAudioData?: (pcmData: Int16Array, sampleRate: number) => void;
  onTextChunk?: (text: string) => void;
  onInputTranscription?: (text: string) => void;
  onInterrupted?: () => void;
  onToolCallCancelled?: (ids: string[]) => void;
  onTurnComplete?: () => void;
  onToolCall?: (tool: ToolCallItem) => Promise<Record<string, any> | void> | Record<string, any> | void;
  onError?: (error: Error | Event) => void;
  onClose?: (event: CloseEvent) => void;
}

const DEFAULT_SYSTEM_PROMPT = `あなたの名前は「アオイ」です。
芯のある凛とした女性キャラクターとして、ユーザーと自然な日本語でリアルタイムに対話してください。

【キャラクター設定・性格】
- 性格: 芯が強く、自分の意志や軸をしっかり持っている。真面目で落ち着いているが、冷たさはなく、相手を包み込むような温かさと優しさがある。
- 一人称: 私（わたし）
- 二人称: あなた
- 口調: 自然体で落ち着きがあり、親しみやすくも凛とした言葉遣い（「〜だよ」「〜だね」「〜しよう」「〜かな」「〜だからね」）。
- 会話例:
  - 「こんにちは。今日も一日お疲れさま。少し私とお話ししていかない？」
  - 「ふふっ、無理しすぎは良くないよ。集中した後は、ちゃんと息抜きも大切だからね」
  - 「大丈夫。あなたならきっと上手くいくよ。私も応援してるからね」

【表情とモーションのツール呼び出し】
会話の文脈や感情の変化に合わせて、積極的にツール（関数）を呼び出してください：
- 表情を変更したいときは setExpression(expression: "neutral"|"happy"|"angry"|"sad"|"relaxed"|"surprised") を呼び出します。
発話と同時に自然にモーションや表情を組み合わせて表現してください。`;

const LEGACY_MOTION_PROMPT = `
- 挨拶やお辞儀、リアクションなどの動作を行いたいときは setMotion(motion: "greeting"|"bow"|"acknowledge"|"dismiss"|"salute"|"excited"|"angry"|"idle") を呼び出します。
- より複雑な動き（例: 歩きながら挨拶する、髪をかきあげる、左右を向く等）を表現したいときは composeMotion(duration, layers) を呼び出します。
`;

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private callbacks: GeminiLiveCallbacks;
  private isConnected = false;
  private isSetupComplete = false;

  constructor(config: GeminiLiveConfig, callbacks: GeminiLiveCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public get setupComplete(): boolean {
    return this.isSetupComplete;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      const apiKey = this.config.apiKey.trim();
      if (!apiKey) {
        reject(new Error('API key is required for Gemini Live connection'));
        return;
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }

      let settled = false;

      this.ws.onopen = () => {
        this.isConnected = true;
        this.callbacks.onOpen?.();
        this.sendSetup();
      };

      this.ws.onmessage = async (event) => {
        try {
          let textData: string;
          if (typeof event.data === 'string') {
            textData = event.data;
          } else if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            textData = new TextDecoder().decode(event.data);
          } else {
            return;
          }

          const msg = JSON.parse(textData);
          await this.handleServerMessage(msg);

          if (!settled && this.isSetupComplete) {
            settled = true;
            resolve();
          }
        } catch (err) {
          console.error('[GeminiLiveClient] Error parsing message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[GeminiLiveClient] WebSocket error:', err);
        this.callbacks.onError?.(err);
        if (!settled) {
          settled = true;
          reject(new Error('WebSocket connection failed'));
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.isSetupComplete = false;
        this.callbacks.onClose?.(event);
        if (!settled) {
          settled = true;
          reject(new Error(`WebSocket closed before setup completed (code ${event.code}: ${event.reason || 'none'})`));
        }
      };
    });
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.isSetupComplete = false;
  }

  private sendSetup(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const rawModel = (this.config.model || 'gemini-3.8-live').trim();
    const model = rawModel.startsWith('models/') ? rawModel : `models/${rawModel}`;
    const voiceName = (this.config.voiceName || 'Aoede').trim();
    const systemPrompt = (this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT) +
      (this.config.ardyMotionEnabled ? ARDY_LIVE_PROMPT : LEGACY_MOTION_PROMPT);

    const setupPayload = {
      setup: {
        model,
        outputAudioTranscription: {},
        ...(this.config.ardyMotionEnabled ? { inputAudioTranscription: {} } : {}),
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        tools: [
          {
            functionDeclarations: [
              ...(this.config.ardyMotionEnabled ? [{
                name: 'generateArdyMotion',
                description: 'Prepare an ordered array of simple avatar motions. Call once before speaking. The first motion is prepared before returning; remaining motions are generated ahead and played continuously with the speech.',
                parameters: ARDY_PLAN_SCHEMA,
              }] : []),
              {
                name: 'setExpression',
                description: 'アバターの表情を変更します。感情に合わせて呼び出してください。',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    expression: {
                      type: 'STRING',
                      description: '表情名',
                      enum: ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'],
                    },
                  },
                  required: ['expression'],
                },
              },
              {
                name: 'setMotion',
                description: 'アバターの基本モーション・ジェスチャーを再生します。',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    motion: {
                      type: 'STRING',
                      description: 'モーション名',
                      enum: [
                        'idle',
                        'greeting',
                        'bow',
                        'acknowledge',
                        'dismiss',
                        'salute',
                        'excited',
                        'angry',
                      ],
                    },
                  },
                  required: ['motion'],
                },
              },
              {
                name: 'composeMotion',
                description: '複数の基本動作（歩く、手を振る、頷く、お辞儀、髪をかきあげる、喜ぶ、怒る等）や部位（上半身、右腕、頭、体幹等）を時間軸上で組み合わせて新しいカスタムモーションを合成・再生します。',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    duration: { type: 'NUMBER', description: '全体の長さ(秒、例: 3.0)' },
                    layers: {
                      type: 'ARRAY',
                      description: '合成する動作レイヤーの配列',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          source: {
                            type: 'STRING',
                            description: '動作素材名: Standing Idle, Walking, Standing Greeting, Salute, Quick Formal Bow, Acknowledging, Excited, Angry, Dismissing Gesture, @hair, @raise, @twist, @bend',
                          },
                          mask: {
                            type: 'STRING',
                            description: '適用部位: 全身, 上半身, 下半身, 右腕, 左腕, 頭, 体幹',
                          },
                          start: { type: 'NUMBER', description: '開始秒' },
                          duration: { type: 'NUMBER', description: '継続秒' },
                          weight: { type: 'NUMBER', description: 'ブレンドの強さ (0.0〜1.0)' },
                        },
                        required: ['source'],
                      },
                    },
                  },
                  required: ['duration', 'layers'],
                },
              },
            ].filter((tool) => !this.config.ardyMotionEnabled || !['setMotion', 'composeMotion'].includes(tool.name)),
          },
        ],
      },
    };

    this.sendJson(setupPayload);
  }

  private async handleServerMessage(msg: any): Promise<void> {
    if (Array.isArray(msg.toolCallCancellation?.ids)) {
      this.callbacks.onToolCallCancelled?.(msg.toolCallCancellation.ids);
    }
    // 1. Setup complete
    if (msg.setupComplete || msg.setupComplete !== undefined) {
      this.isSetupComplete = true;
      this.callbacks.onSetupComplete?.();
      return;
    }

    // 2. Server Content (Audio / Text / Interrupted / Turn Complete)
    if (msg.serverContent) {
      const content = msg.serverContent;

      if (content.interrupted) {
        this.callbacks.onInterrupted?.();
      }

      if (content.inputTranscription?.text) {
        this.callbacks.onInputTranscription?.(content.inputTranscription.text);
      }

      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.text) {
            this.callbacks.onTextChunk?.(part.text);
          }
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || '';
            let sampleRate = 24000;
            const match = mime.match(/rate=(\d+)/);
            if (match) {
              sampleRate = parseInt(match[1], 10);
            }
            const pcmInt16 = this.base64ToInt16(part.inlineData.data);
            this.callbacks.onAudioData?.(pcmInt16, sampleRate);
          }
        }
      }

      if (content.outputTranscription?.text) {
        this.callbacks.onTextChunk?.(content.outputTranscription.text);
      }

      if (content.turnComplete) {
        this.callbacks.onTurnComplete?.();
      }
    }

    // 3. Tool Calls
    if (msg.toolCall && msg.toolCall.functionCalls) {
      const calls: any[] = msg.toolCall.functionCalls;
      const functionResponses: any[] = [];

      for (const call of calls) {
        let resultOutput: Record<string, any> = { success: true };
        try {
          if (this.callbacks.onToolCall) {
            const res = await this.callbacks.onToolCall({
              id: call.id,
              name: call.name,
              args: call.args || {},
            });
            if (res && typeof res === 'object') {
              resultOutput = res;
            }
          }
        } catch (err: any) {
          resultOutput = { error: err.message || 'Tool execution error' };
        }

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            output: resultOutput,
          },
        });
      }

      // Send toolResponse back
      this.sendJson({
        toolResponse: {
          functionResponses,
        },
      });
    }
  }

  /**
   * Send text prompt to the Live session
   */
  public sendTextMessage(text: string): void {
    if (!this.isConnected || !this.ws) return;
    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };
    this.sendJson(payload);
  }

  /**
   * Stream 16kHz PCM audio chunk from microphone
   */
  public sendRealtimeAudio(pcmInt16: Int16Array): void {
    if (!this.isConnected || !this.ws) return;
    const base64Data = this.int16ToBase64(pcmInt16);
    const payload = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Data,
        },
      },
    };
    this.sendJson(payload);
  }

  private sendJson(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  }

  private int16ToBase64(int16: Int16Array): string {
    const uint8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunk)));
    }
    return btoa(binary);
  }
}
