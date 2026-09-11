import { AvatarExpression, ChatMessage } from '../types';

export interface MotionLayerDef {
  source: string;
  mask: string;
  weight: number;
  start: number;       // タイムライン開始時刻（秒）
  duration: number;    // タイムライン再生時間（秒）
  speed?: number;      // 再生速度倍率（0.5〜2.0、デフォルト 1.0）
  from?: number;       // 元モーションのトリミング開始フレーム（30fps換算、0〜）
  to?: number;         // 元モーションのトリミング終了フレーム（30fps換算）
  fade?: number;       // フェードイン・アウト秒数（0.1〜0.8、デフォルト 0.3）
  loop?: boolean;      // 素材自体の繰り返し（デフォルト false）
  repeatEvery?: number;// タイムライン上の反復周期（秒、交互反復など）
  envelope?: 'flat' | 'sine';   // 強さの変化（'flat' または 'sine'）
  poseMode?: 'motion' | 'hold'; // 基本動作の再生形式 ('motion' または 'hold': 姿勢維持)
}

export interface GeneratedMotionRecipe {
  duration: number;
  layers: MotionLayerDef[];
}

export interface GeminiReplyResult {
  speech: string;
  expression: AvatarExpression;
}

const AOI_CHARACTER_PROMPT = `あなたの名前は「アオイ」です。
芯のある凛とした女性キャラクターとして、ユーザーと自然な日本語で会話してください。

【キャラクター設定・性格】
- 性格: 芯が強く、自分の意志や軸をしっかり持っている。真面目で落ち着いているが、冷たさはなく、相手を包み込むような温かさと優しさがある。
- 一人称: 私（わたし）
- 二人称: あなた
- 口調: 自然体で落ち着きがあり、親しみやすくも凛とした言葉遣い（「〜だよ」「〜だね」「〜しよう」「〜かな」「〜だからね」）。
- 会話例:
  - 「こんにちは。今日も一日お疲れさま。少し私とお話ししていかない？」
  - 「ふふっ、無理しすぎは良くないよ。集中した後は、ちゃんと息抜きも大切だからね」
  - 「大丈夫。あなたならきっと上手くいくよ。私も応援してるからね」

【会話のルール】
1. 音声合成で自然に読み上げるため、基本的に1〜2文程度（40文字前後）の短く自然なテンポの良い会話にしてください（長文の説明は行わないでください）。
2. アオイのセリフの内容に合わせて、表情（expression）を次の候補から1つ選んでください。
   候補: neutral, happy, angry, sad, surprised, relaxed

【出力フォーマット】
必ず次のJSONオブジェクトのみを返してください。Markdownのバッククォート等のコードブロック記号や前置きは含めないでください。
{
  "speech": "アオイとしての日本語のセリフ",
  "expression": "表情"
}`;

const MOTION_GENERATOR_PROMPT = `あなたは3Dアバターのアニメーションディレクターです。
キャラクター「アオイ」のセリフと表情に合わせて、モーションミキサーアプリのように**任意の動作の任意の区間をタイムライン（時間軸）上の任意の時間に重ね合わせた重み付きブレンド構成**をJSONで生成してください。

【利用可能な動作（source）と標準適用部位（mask）】
■ 全身モーション
- Standing Idle (自然に立つ, 全身)
- Walking (歩く, 全身)
- Jogging (走る, 全身)
- Standing Greeting (手を振る, 右腕)
- Salute (敬礼する, 右腕)
- Quick Formal Bow (お辞儀, 上半身)
- Acknowledging (うなずく, 上半身)
- Excited (喜ぶ, 全身)
- Angry (怒る, 上半身)
- Dismissing Gesture (払いのける, 右腕)
- Punching (パンチ, 上半身)

■ 特殊プロシージャル動作
- @raise (手を挙げる, 右腕)
- @twist (腰を捻る, 体幹)
- @bend (腰を曲げる, 体幹)
- @hair (髪をかきあげる, 右腕)

■ 頭・首
- @look-down (首を下に向ける, 頭)
- @look-up (首を上に向ける, 頭)
- @look-left (首を左に向ける, 頭)
- @look-right (首を右に向ける, 頭)
- @tilt-left (首を左に傾ける, 頭)
- @tilt-right (首を右に傾ける, 頭)

■ 体幹
- @lean-back (上体を反らす, 体幹)
- @lean-left (上体を左に倒す, 体幹)
- @lean-right (上体を右に倒す, 体幹)
- @twist-left (上体を左に捻る, 体幹)
- @twist-right (上体を右に捻る, 体幹)
- @small-bow (軽く会釈する, 体幹)

■ 腕 (左右)
- @right-forward / @left-forward (腕を前に突き出す, 右腕/左腕)
- @right-up / @left-up (腕を上に伸ばす, 右腕/左腕)
- @right-side / @left-side (腕を横に伸ばす, 右腕/左腕)
- @right-diagonal / @left-diagonal (腕を斜め上に伸ばす, 右腕/左腕)
- @right-mouth / @left-mouth (手を口元に寄せる, 右腕/左腕)
- @right-cheek / @left-cheek (手を頬に添える, 右腕/左腕)
- @right-chest / @left-chest (手を胸に当てる, 右腕/左腕)
- @right-hip / @left-hip (手を腰に当てる, 右腕/左腕)
- @right-offer (手を前に差し出す, 右腕)

■ 手指 (左右)
- @right-index / @left-index (人差し指を立てる, 右手/左手)
- @right-peace / @left-peace (ピースをする, 右手/左手)
- @right-thumb / @left-thumb (親指を立てる, 右手/左手)
- @right-open / @left-open (手を開く, 右手/左手)
- @right-fist / @left-fist (握りこぶし, 右手/左手)

■ 脚・下半身
- @right-knee-up / @left-knee-up (膝を上げる, 右脚/左脚)
- @right-step-forward / @left-step-forward (足を一歩前に出す, 右脚/左脚)
- @small-crouch (膝を軽くゆるめる, 下半身)

【指定可能な部位 (mask)】
全身, 上半身, 下半身, 右腕, 左腕, 体幹, 頭, 右手, 左手, 右脚, 左脚

【時間軸・区間指定（タイムライン＆トリミング）パラメータ】
各レイヤーはモーションミキサーと同様に、時間軸と元動作の区間を自由に指定できます。
- start: タイムライン上で再生を開始する秒数（例: 0.0, 1.2）
- duration: タイムライン上で再生する長さ（秒）（例: 2.0）
- weight: 重み（0.3〜1.0）
- fade: 前後とのブレンド・フェード秒数（0.1〜0.5、通常 0.2〜0.3）
- from: 元モーションのトリミング開始フレーム（30fps換算。特定タイミングの動きを切り出す場合。省略時は0）
- to: 元モーションのトリミング終了フレーム（30fps換算。省略時は素材末尾）
- speed: 再生速度倍率（0.5〜2.0、デフォルト 1.0）
- loop: 素材自体の繰り返し（歩行など連続動作の場合に true）
- repeatEvery: タイムライン区間の反復周期（秒。例: 左右の傾きを交互に繰り返す場合など）
- envelope: 強さの変化（"flat": 一定、"sine": 山なり・往復向き）
- poseMode: 基本動作（@動作）の再生形式（"motion": 動作として再生、"hold": 到達した最後の姿勢を維持。首を傾けたまま話す、手を胸に当てたまま話す等に最適）

【時間軸演出の組み立て例】
- 挨拶とお辞儀のタイミング差:
  0.0s〜1.5s に体幹の会釈 (@small-bow)、0.5s〜3.0s に右腕の手振り (Standing Greeting)、1.0s〜3.0s に頭の傾き (@tilt-right, poseMode: "hold") を重ねる。
- 考えながら話す:
  0.3s〜2.5s に手を頬に添える (@right-cheek, poseMode: "hold")、0.5s〜2.0s に少し上を見る (@look-up, poseMode: "hold")。

【出力フォーマット】
必ず以下の形式の有効なJSONのみを出力してください（説明文やMarkdownコードブロックは不要です）。
{
  "duration": 3.5,
  "layers": [
    {
      "source": "Standing Greeting",
      "mask": "右腕",
      "weight": 0.85,
      "start": 0.5,
      "duration": 2.5,
      "fade": 0.3,
      "speed": 1.0
    },
    {
      "source": "@small-bow",
      "mask": "体幹",
      "weight": 0.6,
      "start": 0.0,
      "duration": 1.5,
      "fade": 0.2
    },
    {
      "source": "@tilt-right",
      "mask": "頭",
      "weight": 0.5,
      "start": 1.0,
      "duration": 2.2,
      "fade": 0.3,
      "poseMode": "hold"
    }
  ]
}`;

export class GeminiApiService {
  private apiKey: string = '';
  private modelName: string = 'gemini-3.5-flash-lite';

  constructor(apiKey?: string, modelName?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (modelName) this.modelName = modelName;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  public hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  public getModelName(): string {
    return this.modelName;
  }

  private getEndpointUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.modelName
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  private async convertBlobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }

  /**
   * Send user voice (WAV Blob) or text along with character info to Gemini API,
   * returning Aoi's speech and expression.
   */
  public async generateAvatarReply(
    input: Blob | string,
    history: ChatMessage[] = []
  ): Promise<GeminiReplyResult> {
    if (!this.hasApiKey()) {
      throw new Error('Gemini APIキーが設定されていません。入力欄にAPIキーを入力してください。');
    }

    const contents: any[] = [];

    // History turns (last 6 messages = 3 turns)
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Current turn
    if (typeof input === 'string') {
      contents.push({
        role: 'user',
        parts: [{ text: input }],
      });
    } else {
      const base64Data = await this.convertBlobToBase64(input);
      contents.push({
        role: 'user',
        parts: [
          {
            text: 'ユーザーからの音声入力です。聞いて日本語で返答してください。',
          },
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: base64Data,
            },
          },
        ],
      });
    }

    const requestBody = {
      systemInstruction: {
        parts: [{ text: AOI_CHARACTER_PROMPT }],
      },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    };

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // ignore
      }
      const message = errorJson?.error?.message || errorText || `HTTP ${response.status}`;
      throw new Error(`Gemini API エラー (${response.status}): ${message}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini APIから空の応答が返却されました。');
    }

    return this.parseReplyJson(rawText);
  }

  /**
   * Request Gemini to synthesize a dynamic motion recipe based on speech & expression.
   */
  public async generateAvatarMotion(
    speech: string,
    expression: string
  ): Promise<GeneratedMotionRecipe> {
    if (!this.hasApiKey()) {
      throw new Error('Gemini APIキーが設定されていません。');
    }

    const userPrompt = `アオイの返答セリフ: 「${speech}」
表情: ${expression}

このセリフと表情にふさわしい、自然で魅力的なモーションの組み合わせをJSON形式で生成してください。`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: MOTION_GENERATOR_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.5,
      },
    };

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[GeminiApiService] Motion generation failed, falling back:', errorText);
      return this.getFallbackMotion(expression);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return this.getFallbackMotion(expression);
    }

    try {
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.layers) && typeof parsed.duration === 'number') {
        return parsed as GeneratedMotionRecipe;
      }
      return this.getFallbackMotion(expression);
    } catch (e) {
      console.warn('[GeminiApiService] Failed to parse motion JSON:', e, rawText);
      return this.getFallbackMotion(expression);
    }
  }

  private parseReplyJson(raw: string): GeminiReplyResult {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      const speech = typeof parsed.speech === 'string' ? parsed.speech.trim() : '';
      const validExpressions: AvatarExpression[] = [
        'neutral',
        'happy',
        'angry',
        'sad',
        'surprised',
        'relaxed',
      ];
      const expression = validExpressions.includes(parsed.expression)
        ? (parsed.expression as AvatarExpression)
        : 'neutral';

      if (!speech) {
        throw new Error('応答にセリフが含まれていませんでした。');
      }

      return { speech, expression };
    } catch (err: any) {
      console.error('[GeminiApiService] JSON parse error:', err, raw);
      // Fallback regex extraction if JSON was malformed
      const speechMatch = raw.match(/"speech"\s*:\s*"([^"]+)"/);
      if (speechMatch) {
        return {
          speech: speechMatch[1],
          expression: 'neutral',
        };
      }
      return {
        speech: raw.slice(0, 100),
        expression: 'neutral',
      };
    }
  }

  private getFallbackMotion(expression: string): GeneratedMotionRecipe {
    switch (expression) {
      case 'happy':
      case 'relaxed':
        return {
          duration: 3.0,
          layers: [
            { source: 'Standing Greeting', mask: '右腕', weight: 0.8, start: 0, duration: 2.2, fade: 0.3 },
            { source: '@tilt-right', mask: '頭', weight: 0.5, start: 0.2, duration: 2.0, fade: 0.3 },
          ],
        };
      case 'angry':
        return {
          duration: 3.0,
          layers: [
            { source: 'Angry', mask: '上半身', weight: 0.8, start: 0, duration: 2.5, fade: 0.3 },
          ],
        };
      case 'sad':
        return {
          duration: 3.0,
          layers: [
            { source: '@look-down', mask: '頭', weight: 0.6, start: 0, duration: 2.5, fade: 0.3 },
            { source: '@small-bow', mask: '体幹', weight: 0.4, start: 0.2, duration: 2.0, fade: 0.3 },
          ],
        };
      default:
        return {
          duration: 3.0,
          layers: [
            { source: 'Acknowledging', mask: '上半身', weight: 0.7, start: 0, duration: 1.8, fade: 0.3 },
            { source: '@tilt-left', mask: '頭', weight: 0.4, start: 0.3, duration: 2.0, fade: 0.3 },
          ],
        };
    }
  }
}
