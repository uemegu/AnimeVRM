import { FINGER_MOTION_OPTIONS, FINGER_MOTION_SCHEMA, parseFingerMotion, type FingerMotionSelection } from '../motion/FingerMotion';

export interface ArdyMotionStep {
  prompt: string;
  duration: number;
  fingers: FingerMotionSelection;
}

export const ARDY_PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    motions: {
      type: 'ARRAY', minItems: 1, maxItems: 6,
      description: 'Ordered sequence of simple physical actions. One motion description per item; played continuously in array order.',
      items: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING', description: '1–512 characters of concrete English body-part movement, starting with A person.' },
          duration: { type: 'NUMBER', minimum: 2, maximum: 8, description: 'Seconds for this step, 2–8. Total duration should roughly match the spoken reply.' },
          fingerMotion: FINGER_MOTION_SCHEMA,
        },
        required: ['prompt', 'duration', 'fingerMotion'],
      },
    },
  },
  required: ['motions'],
};

export const ARDY_BODY_PROMPT = `
【ardy-mini の動作指示】
motions は英語のモーションテキストを順番に並べる配列です。各要素は {prompt, duration, fingerMotion}。1〜6個の動作を配列順に連続再生します。
1要素は2〜8秒の単純な動作1つです。複数の動作や複雑な振り付けは、短い動きに分けて別々の要素にしてください。
ardy-mini は抽象的な感情や複雑な動きをうまく生成できません。「喜ぶ」「考える」「かわいく」「説明する」のような抽象語だけで指示しないでください。
意図を、頭・胴体・左右の肩・腕・肘・手・脚の位置、動かす方向、速度、動かさない部位に翻訳します。
prompt は "A person ..." で始める512文字以内の英語1〜2文です。必要な部位だけを具体的に書き、関節角度や多数の同時動作は避けます。
例「考える」: "A person stands still, bends their right elbow and slowly brings their right hand near their chin. Their left arm stays lowered."
例「喜ぶ」: "A person stands in place and slowly raises both forearms to chest height, keeping their elbows close to their torso."
連続動作の例: 右前腕を肩の高さまで上げる → 右手を左右に小さく振る → 右腕を下ろす、を3つの英語promptに分けます。
原則その場に立った小さな身振りにし、足は地面に置きます。速い回転、ジャンプ、移動、物との接触はユーザーが明示した場合以外避けてください。

【Finger Motion（指の形の指定）】
各要素の fingerMotion は right / left の各選択肢を YES または NO にします。
選択肢: ${FINGER_MOTION_OPTIONS.map(({ id, label }) => `${id}=${label}`).join('、')}。
片手につき YES は最大1つ。指定しない手はすべて NO。指の形は ardy-mini のpromptに任せずこの欄で指定します。
各動作の再生開始から1秒で指定した手の形にし、動作終了まで保持します。指の時間軸は指定しません。
これらの指示は音声で読み上げず、モーション生成専用のデータとして返します。`;

export const ARDY_LIVE_PROMPT = `${ARDY_BODY_PROMPT}
各応答の最初、発話を始める前に generateArdyMotion({motions: [...]}) を一度呼び出してください。
日本語の応答の流れに合わせて動きを分割し、配列全体の秒数を発話の見込み時間に近づけてください。
最初の動作が準備できるとツールが応答し、音声と一緒に再生開始します。後続は先行生成して連続再生します。
ツールが失敗しても日本語の会話は続けてください。動作指示を読み上げたり、失敗した動作を成功したと言ったりしないでください。`;

export function parseArdyMotionPlan(value: unknown): ArdyMotionStep[] {
  if (!value || typeof value !== 'object') throw new Error('Motion plan must be an object.');
  const args = value as Record<string, unknown>;
  // Keep single-prompt local previews and older tool calls compatible.
  const items = args.motions === undefined ? [args] : args.motions;
  if (!Array.isArray(items) || items.length < 1 || items.length > 6) throw new Error('motions must contain 1–6 steps.');
  return items.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Each motion needs a prompt, duration and fingerMotion.');
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
    const duration = item.duration ?? 4;
    if (!prompt || prompt.length > 512) throw new Error('Motion prompt must contain 1–512 characters.');
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 2 || duration > 8) throw new Error('Motion duration must be 2–8 seconds.');
    return { prompt, duration, fingers: parseFingerMotion(item.fingerMotion) };
  });
}
