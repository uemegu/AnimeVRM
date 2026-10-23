import type { SpeechTone, TextContent } from './schema.ts';

/** 言いよどみ・驚きの言い出し（セリフの頭） */
const SURPRISED_START = /^(ええ?[っ!！?？、]|えぇ|うそ[っ!！?？…、]|嘘[っ!！?？…、]|まさか|なっ|はあ?[!！?？]|ひゃ|わっ)/;
const SURPRISED_MARK = /[!！][?？]|[?？][!！]/;
const HESITANT_START = /^(あの|えっと|えと|その[…‥、])/;
const SHY = /ふふ|えへ|あはは|てへ|へへ|うふ|照れ/;

/**
 * セリフの文字から話し方の調子を決める（簡易な判定。文末の記号と、言い出し・笑いの言葉、途中の ！・… を見る）。
 * 驚き → 問いかけ → 勢い → 照れ → ためらい の順に当てはめ、どれでもなければ calm
 */
export function speechToneOf(text: TextContent | undefined): SpeechTone {
  const raw = typeof text === 'string' ? text : (text?.ja ?? '');
  const s = raw.replace(/[「」『』\s]/g, '');
  if (!s) return 'calm';
  if (SURPRISED_START.test(s) || SURPRISED_MARK.test(s)) return 'surprised';
  const end = s.replace(/[…‥]+$/, '').slice(-1);
  if (end === '？' || end === '?') return 'question';
  if (end === '！' || end === '!' || end === '♪') return 'excited';
  if (SHY.test(s)) return 'shy';
  if (/[…‥]$/.test(s) || HESITANT_START.test(s)) return 'hesitant';
  // 文末でなくても、途中の ！ は勢い、… はためらい
  if (/[!！♪]/.test(s)) return 'excited';
  if (/[…‥]/.test(s)) return 'hesitant';
  return 'calm';
}
