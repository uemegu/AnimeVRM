import { pipeline, TextStreamer } from '@huggingface/transformers';
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

export class LfmService {
  private generator: any = null;
  private isLoading = false;
  private isLoaded = false;

  public async load(onProgress?: (info: string) => void): Promise<void> {
    if (this.isLoaded && this.generator) return;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return;
    }

    if (!navigator.gpu) {
      throw new Error(
        'この機能を利用するにはWebGPU対応ブラウザが必要です。Chrome最新版を使用してください。'
      );
    }

    this.isLoading = true;
    onProgress?.('LFM2.5 (WebGPU) をロード中...');
    const t0 = performance.now();

    try {
      this.generator = await pipeline('text-generation', 'LiquidAI/LFM2.5-2.6B-ONNX', {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && progress.file) {
            onProgress?.(`LFM2.5: ${progress.file} (${Math.round(progress.progress || 0)}%)`);
          }
        },
      });

      this.isLoaded = true;
      const loadTime = performance.now() - t0;
      console.log(`[LFM] load: ${loadTime.toFixed(1)} ms`);
    } finally {
      this.isLoading = false;
    }
  }

  public get ready(): boolean {
    return this.isLoaded && this.generator !== null;
  }

  public async generate(
    history: ChatMessage[],
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT
  ): Promise<{ reply: AvatarReply; rawText: string; ttftMs: number; totalMs: number }> {
    if (!this.ready) {
      throw new Error('LFM2.5 is not loaded yet');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8), // 直近4往復程度
    ];

    const t0 = performance.now();
    let ttftMs = 0;
    let firstTokenLogged = false;

    // Streamer to measure TTFT
    const streamer = new TextStreamer(this.generator.tokenizer, {
      skip_prompt: true,
      callback_function: () => {
        if (!firstTokenLogged) {
          ttftMs = performance.now() - t0;
          firstTokenLogged = true;
          console.log(`[Chat] LLM TTFT: ${ttftMs.toFixed(1)} ms`);
        }
      },
    });

    const output = await this.generator(messages, {
      max_new_tokens: 256,
      temperature: 0.7,
      top_p: 0.9,
      streamer,
    });

    const totalMs = performance.now() - t0;
    console.log(`[Chat] LLM total: ${totalMs.toFixed(1)} ms`);

    const generatedText = Array.isArray(output)
      ? output[0]?.generated_text
      : (output as any)?.generated_text;

    let responseStr = '';
    if (Array.isArray(generatedText)) {
      const lastMsg = generatedText[generatedText.length - 1];
      responseStr = typeof lastMsg === 'object' ? lastMsg.content : String(lastMsg);
    } else if (typeof generatedText === 'string') {
      responseStr = generatedText;
    } else if (typeof output === 'string') {
      responseStr = output;
    }

    const reply = this.parseReply(responseStr);
    return {
      reply,
      rawText: responseStr,
      ttftMs: ttftMs || totalMs,
      totalMs,
    };
  }

  private parseReply(text: string): AvatarReply {
    // 1. Remove thinking tokens
    let cleaned = text;
    if (cleaned.includes('</think>')) {
      cleaned = cleaned.substring(cleaned.lastIndexOf('</think>') + '</think>'.length);
    } else if (cleaned.includes('<think>')) {
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');
    }

    // 2. Remove markdown code blocks if any
    cleaned = cleaned.trim();
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
      } catch {
        // Fallback below
      }
    }

    // 4. Fallback if JSON parsing fails
    console.warn('[LFM] Failed to parse structured JSON reply. Using fallback. Raw:', cleaned);
    let fallbackSpeech = cleaned.replace(/[\{\}"\[\]]/g, '').trim();
    if (!fallbackSpeech) {
      fallbackSpeech = 'こんにちは！';
    }

    return {
      speech: fallbackSpeech,
      expression: 'neutral',
      motion: 'idle',
    };
  }
}
