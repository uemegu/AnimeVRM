/**
 * 選択肢を出す条件の判定（app の再生・Studio の再生・電話・メールで共有）
 */
import type { ChoiceCondition } from './schema.ts';

type FlagValue = boolean | number | string;

export interface ChoiceContext {
  flags: Record<string, FlagValue>;
  /** 省略時は好感度の条件を満たしたものとして扱う（Studio のプレビューなど、好感度を持たない再生） */
  affinities?: Record<string, number>;
}

/** 条件に書いた項目をすべて満たすか */
export function matchesChoiceCondition(condition: ChoiceCondition | undefined, context: ChoiceContext): boolean {
  if (!condition) return true;
  const { flags, affinities } = context;
  if (condition.flag !== undefined && flags[condition.flag] !== (condition.value ?? true)) return false;
  if (condition.requireFlags?.some((flag) => !flags[flag])) return false;
  if (condition.unlessFlags?.some((flag) => Boolean(flags[flag]))) return false;
  if (affinities && Object.entries(condition.minAffinity ?? {}).some(([id, min]) => (affinities[id] ?? 0) < min)) return false;
  return true;
}

/**
 * 今出す選択肢。条件に合うものがなく choiceFallback が highest_affinity なら、
 * 好感度の条件を持つ選択肢のうち、そのキャラの好感度が最も高いもの1つだけ（同点は先に書いたもの）
 */
export function availableChoices<T extends { condition?: ChoiceCondition }>(
  choices: readonly T[] | undefined,
  context: ChoiceContext,
  fallback?: 'highest_affinity'
): T[] {
  const list = choices ?? [];
  const matched = list.filter((choice) => matchesChoiceCondition(choice.condition, context));
  if (matched.length > 0 || fallback !== 'highest_affinity') return matched;
  const affinities = context.affinities ?? {};
  let best: { choice: T; value: number } | null = null;
  for (const choice of list) {
    const ids = Object.keys(choice.condition?.minAffinity ?? {});
    if (ids.length === 0) continue;
    // 好感度以外の条件は満たしていること
    const { minAffinity: _min, ...rest } = choice.condition!;
    if (!matchesChoiceCondition(rest, context)) continue;
    const value = Math.min(...ids.map((id) => affinities[id] ?? 0));
    if (!best || value > best.value) best = { choice, value };
  }
  return best ? [best.choice] : [];
}

/** 条件を短い文にする（Studio のフロー図のラベル。例: 「aoi≥12」「★aoi_c08」） */
export function describeChoiceCondition(condition: ChoiceCondition | undefined): string {
  if (!condition) return '';
  const parts: string[] = [];
  if (condition.flag !== undefined) parts.push(`${condition.flag}=${String(condition.value ?? true)}`);
  for (const flag of condition.requireFlags ?? []) parts.push(flag);
  for (const flag of condition.unlessFlags ?? []) parts.push(`!${flag}`);
  for (const [id, min] of Object.entries(condition.minAffinity ?? {})) parts.push(`${id}≥${min}`);
  return parts.join(' ');
}

/** 条件に使っているフラグ */
export function choiceConditionFlags(condition: ChoiceCondition | undefined): string[] {
  if (!condition) return [];
  return [...(condition.flag !== undefined ? [condition.flag] : []), ...(condition.requireFlags ?? []), ...(condition.unlessFlags ?? [])];
}
