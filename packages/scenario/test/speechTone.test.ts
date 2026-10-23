import { describe, expect, it } from 'vitest';
import { speechToneOf } from '../src/speechTone.ts';

describe('セリフの調子', () => {
  it('文末の記号と言い出しで決める', () => {
    expect(speechToneOf('「えっ、本当に？」')).toBe('surprised');
    expect(speechToneOf('「そんなの聞いてない！？」')).toBe('surprised');
    expect(speechToneOf('「一緒にどこか寄っていかない？」')).toBe('question');
    expect(speechToneOf('「それ、本当……？」')).toBe('question');
    expect(speechToneOf({ ja: '「行ってみよう！」', en: '"Let\'s go!"' })).toBe('excited');
    expect(speechToneOf('「えへへ、ありがと」')).toBe('shy');
    expect(speechToneOf('「あの、ちょっといいかな」')).toBe('hesitant');
    expect(speechToneOf('「そう、なんだ……」')).toBe('hesitant');
    expect(speechToneOf('「まさか、そんなこと」')).toBe('surprised');
    expect(speechToneOf('「やった！ じゃあ放課後ね」')).toBe('excited');
    expect(speechToneOf('「それは……また今度ね」')).toBe('hesitant');
    expect(speechToneOf('「おはよう。今日は晴れたね」')).toBe('calm');
    expect(speechToneOf(undefined)).toBe('calm');
  });
});
