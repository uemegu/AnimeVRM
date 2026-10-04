/**
 * シナリオ同士のつながり（フラグと先行シナリオ）。プロジェクト全体のチャートに使う。
 * 日付や時間帯などの発生条件は app 固有なので扱わない。
 */

export interface ScenarioLinks {
  /** 立てるフラグ（シーン・選択肢・時間切れ・電話・メールの setFlags。false にするものは除く） */
  sets: string[];
  /** 発生に必要なフラグ（availability.requireFlags） */
  requires: string[];
  /** 立っていると発生しないフラグ（availability.unlessFlags） */
  unless: string[];
  /** 選択肢の表示条件に使うフラグ */
  conditions: string[];
  /** 先に見ておく必要があるシナリオの ID（availability.after） */
  after: string[];
}

const unique = (values: Iterable<string>) => [...new Set(values)].sort();

/** 形式（ストーリー・電話・メール）によらず、JSON をたどって集める */
export function scenarioLinks(data: unknown): ScenarioLinks {
  const sets = new Set<string>();
  const conditions = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'setFlags' && child && typeof child === 'object') {
        for (const [flag, v] of Object.entries(child)) if (v !== false) sets.add(flag);
      } else if (key === 'condition' && child && typeof child === 'object') {
        const condition = child as { flag?: unknown; requireFlags?: unknown; unlessFlags?: unknown };
        if (typeof condition.flag === 'string') conditions.add(condition.flag);
        for (const list of [condition.requireFlags, condition.unlessFlags]) {
          if (Array.isArray(list)) for (const flag of list) if (typeof flag === 'string') conditions.add(flag);
        }
      } else if (key !== 'availability') {
        walk(child);
      }
    }
  };
  walk(data);

  const availability = (data as { availability?: Record<string, unknown> } | null)?.availability ?? {};
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const after = availability.after as { all?: { scenarioId: string }[]; any?: { scenarioId: string }[] } | undefined;
  return {
    sets: unique(sets),
    requires: unique(strings(availability.requireFlags)),
    unless: unique(strings(availability.unlessFlags)),
    conditions: unique(conditions),
    after: unique([...(after?.all ?? []), ...(after?.any ?? [])].map((p) => p.scenarioId)),
  };
}
