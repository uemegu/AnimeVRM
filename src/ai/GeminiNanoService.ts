import { AvatarExpression, AvatarMotion, AvatarReply, ChatMessage } from './types';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';

const VALID_EXPRESSIONS: Set<string> = new Set([
  'neutral',
  'happy',
  'angry',
  'sad',
  'surprised',
  'relaxed',
]);

const VALID_MOTIONS: Set<string> = new Set([
  'idle',
  'standing',
  'greeting',
  'bow',
  'acknowledge',
  'dismiss',
  'salute',
  'excited',
  'angry',
]);

export class GeminiNanoService {
  private session: any = null;
  private isLoaded = false;
  private isLoading = false;

  /**
   * Find LanguageModel interface across W3C standard and Chrome variants:
   * 1. window.LanguageModel / globalThis.LanguageModel (Latest W3C / Chrome Stable)
   * 2. window.ai.languageModel / globalThis.ai.languageModel (Chrome Preview)
   * 3. window.ai.assistant (Early preview)
   */
  private getLmInterface(): any {
    const g = globalThis as any;
    const w = typeof window !== 'undefined' ? (window as any) : {};
    return (
      w.LanguageModel ||
      g.LanguageModel ||
      w.ai?.languageModel ||
      g.ai?.languageModel ||
      w.ai?.assistant ||
      g.ai?.assistant ||
      null
    );
  }

  /** Latest Prompt API options. Use the exact same options for availability()
   * and create(), including the expected Japanese input/output languages. */
  private getSessionOptions(): any {
    return {
      initialPrompts: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }],
      expectedInputs: [{ type: 'text', languages: ['ja'] }],
      expectedOutputs: [{ type: 'text', languages: ['ja'] }],
    };
  }

  private getAvailabilityStatus(value: any): string | null {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;

    const status = value.available ?? value.availability ?? value.status;
    if (status === true) return 'available';
    if (status === false) return 'unavailable';
    return typeof status === 'string' ? status : null;
  }

  private isReadyWithoutDownload(status: string | null): boolean {
    // "readily" is retained only for the older Chrome preview API.
    return status === 'available' || status === 'readily';
  }

  public async isAvailable(): Promise<boolean> {
    const lm = this.getLmInterface();
    if (!lm) return false;

    try {
      if (typeof lm.availability === 'function') {
        const avail = await lm.availability(this.getSessionOptions());
        return this.isReadyWithoutDownload(this.getAvailabilityStatus(avail));
      }

      if (typeof lm.capabilities === 'function') {
        const caps = await lm.capabilities();
        return this.isReadyWithoutDownload(this.getAvailabilityStatus(caps));
      }

      // Without an availability signal we cannot guarantee that create() will
      // not initiate a download, so fail closed.
      return false;
    } catch {
      return false;
    }
  }

  public async load(onProgress?: (info: string) => void): Promise<void> {
    if (this.isLoaded && this.session) return;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return;
    }

    const lm = this.getLmInterface();
    if (!lm) {
      throw new Error(
        'Chrome Built-in AI (window.LanguageModel / ai.languageModel) が検出されませんでした。\n' +
          '最新のGoogle Chromeをご利用いただくか、chrome://flags/#prompt-api-for-gemini-nano の設定をご確認ください。'
      );
    }

    this.isLoading = true;
    onProgress?.('Gemini Nano (LanguageModel) を初期化中...');
    const t0 = performance.now();

    try {
      const sessionOptions = this.getSessionOptions();
      let availabilityStatus: string | null = null;

      // Never call create() unless Chrome confirms that no download is needed.
      if (typeof lm.availability === 'function') {
        const avail = await lm.availability(sessionOptions);
        availabilityStatus = this.getAvailabilityStatus(avail);
        console.log('[Gemini Nano] LanguageModel.availability():', avail);
      } else if (typeof lm.capabilities === 'function') {
        const caps = await lm.capabilities();
        availabilityStatus = this.getAvailabilityStatus(caps);
        console.log('[Gemini Nano] LanguageModel.capabilities():', caps);
      }

      if (!this.isReadyWithoutDownload(availabilityStatus)) {
        if (
          availabilityStatus === 'downloadable' ||
          availabilityStatus === 'downloading' ||
          availabilityStatus === 'after-download'
        ) {
          throw new Error(
            `Gemini Nano はダウンロードが必要な状態です (${availabilityStatus})。` +
              '自動ダウンロードは無効にしているため開始しません。'
          );
        }
        throw new Error(
          `Gemini Nano をダウンロードなしで利用できません (availability: ${availabilityStatus ?? 'unknown'})。`
        );
      }

      // No monitor is attached: availability is already "available", and this
      // app must never opt into the Prompt API download flow.
      this.session = await lm.create(sessionOptions);

      this.isLoaded = true;
      const loadTime = performance.now() - t0;
      console.log(`[Gemini Nano] Session created successfully in ${loadTime.toFixed(1)} ms`);
    } finally {
      this.isLoading = false;
    }
  }

  public get ready(): boolean {
    return this.isLoaded && this.session !== null;
  }

  public async generate(
    history: ChatMessage[],
    _systemPrompt: string = DEFAULT_SYSTEM_PROMPT
  ): Promise<{ reply: AvatarReply; rawText: string; ttftMs: number; totalMs: number }> {
    if (!this.ready) {
      throw new Error('Gemini Nano is not ready');
    }

    const t0 = performance.now();
    let ttftMs = 0;

    // Format prompt context from history
    const recent = history.slice(-6);
    let promptText = '';
    for (const msg of recent) {
      if (msg.role === 'user') {
        promptText += `ユーザー: ${msg.content}\n`;
      } else {
        promptText += `アシスタント: ${msg.content}\n`;
      }
    }
    promptText += 'アシスタント: ';

    let responseStr = '';

    // Prompt execution
    if (typeof this.session.promptStreaming === 'function') {
      try {
        const stream = this.session.promptStreaming(promptText);
        let isFirst = true;
        let accumulated = '';
        for await (const chunk of stream) {
          if (isFirst) {
            ttftMs = performance.now() - t0;
            isFirst = false;
            console.log(`[Chat] Gemini Nano TTFT: ${ttftMs.toFixed(1)} ms`);
          }
          if (chunk.startsWith(accumulated)) {
            // chunk is full accumulated string
            accumulated = chunk;
          } else {
            // chunk is incremental delta
            accumulated += chunk;
          }
        }
        responseStr = accumulated;
      } catch (streamErr) {
        console.warn('[Gemini Nano] promptStreaming fallback to prompt:', streamErr);
        responseStr = await this.session.prompt(promptText);
        ttftMs = performance.now() - t0;
      }
    } else {
      responseStr = await this.session.prompt(promptText);
      ttftMs = performance.now() - t0;
    }

    const totalMs = performance.now() - t0;
    console.log(`[Gemini Nano] Raw response (${totalMs.toFixed(1)}ms):\n${responseStr}`);

    const reply = this.parseReply(responseStr);
    return {
      reply,
      rawText: responseStr,
      ttftMs: ttftMs || totalMs,
      totalMs,
    };
  }

  private parseReply(text: string): AvatarReply {
    if (!text || !text.trim()) {
      console.warn('[Gemini Nano] Empty response from model, using fallback.');
      return {
        speech: 'こんにちは！何か御用ですか？',
        expression: 'neutral',
        motion: 'idle',
      };
    }

    let cleaned = text.trim();

    // 1. Remove thinking tokens if any
    if (cleaned.includes('</think>')) {
      cleaned = cleaned.substring(cleaned.lastIndexOf('</think>') + '</think>'.length).trim();
    } else if (cleaned.includes('<think>')) {
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    // 2. Remove markdown code blocks if any
    cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();

    // 3. Try to extract JSON substring { ... }
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const speech = typeof parsed.speech === 'string' ? parsed.speech.trim() : '';
        const rawExpr = typeof parsed.expression === 'string' ? parsed.expression.toLowerCase().trim() : '';
        const rawMotion = typeof parsed.motion === 'string' ? parsed.motion.toLowerCase().trim() : '';

        const expression: AvatarExpression = VALID_EXPRESSIONS.has(rawExpr)
          ? (rawExpr as AvatarExpression)
          : 'neutral';

        const motion: AvatarMotion = VALID_MOTIONS.has(rawMotion)
          ? (rawMotion as AvatarMotion)
          : 'idle';

        if (speech) {
          return { speech, expression, motion };
        }
      } catch (err) {
        console.warn('[Gemini Nano] JSON parse error in extracted substring:', err, jsonMatch[0]);
      }
    }

    // 4. Fallback if plain text response was returned
    console.log('[Gemini Nano] Plain text response received, parsing directly:', cleaned);
    let fallbackSpeech = cleaned
      .replace(/^[\{\}"'\[\]]+|[\{\}"'\[\]]+$/g, '')
      .replace(/^(?:speech|アシスタント|返答)[:：]\s*/i, '')
      .trim();

    if (!fallbackSpeech) {
      fallbackSpeech = 'こんにちは！何か御用ですか？';
    }

    // Basic heuristic for expression/motion
    let expression: AvatarExpression = 'neutral';
    let motion: AvatarMotion = 'idle';

    if (/ありがとう|うれしい|嬉しい|楽しい|わーい|！/i.test(fallbackSpeech)) {
      expression = 'happy';
      motion = 'greeting';
    } else if (/怒|ひどい|ぷんぷん/i.test(fallbackSpeech)) {
      expression = 'angry';
      motion = 'angry';
    } else if (/えっ|本当|びっくり|まさか/i.test(fallbackSpeech)) {
      expression = 'surprised';
      motion = 'salute';
    } else if (/こんにちは|初めまして|よろしく/i.test(fallbackSpeech)) {
      expression = 'happy';
      motion = 'bow';
    }

    return {
      speech: fallbackSpeech,
      expression,
      motion,
    };
  }
}
