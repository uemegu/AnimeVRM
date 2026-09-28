import dagre from '@dagrejs/dagre';
import type { ScenarioSummary } from '../../api/client';

/**
 * require: 発生に必要なフラグ、unless: 立っていると発生しないフラグ、
 * condition: 選択肢の表示条件に使うフラグ、after: 先に見ておくシナリオ
 */
export type ProjectEdgeKind = 'require' | 'unless' | 'condition' | 'after';

export interface ProjectEdge {
  id: string;
  from: string;
  to: string;
  kind: ProjectEdgeKind;
  /** つながりの元になったフラグ（after では空） */
  flags: string[];
}

export interface MissingFlag {
  flag: string;
  /** そのフラグを条件に使っているシナリオ */
  users: string[];
}

export interface ProjectGraph {
  edges: ProjectEdge[];
  /** ほかのシナリオとつながっているもの */
  connected: string[];
  /** どこともつながっていないもの */
  isolated: string[];
  /** 条件に使われているのに、プロジェクト内のどのシナリオも立てないフラグ */
  missing: MissingFlag[];
}

export const scenarioKey = (s: Pick<ScenarioSummary, 'category' | 'id'>) => `${s.category}/${s.id}`;

/** プロジェクト内のシナリオを、フラグと先行シナリオでつなぐ */
export function buildProjectGraph(scenarios: ScenarioSummary[]): ProjectGraph {
  const setters = new Map<string, string[]>();
  for (const s of scenarios) {
    for (const flag of s.links.sets) setters.set(flag, [...(setters.get(flag) ?? []), scenarioKey(s)]);
  }
  const byId = new Map(scenarios.map((s) => [s.id, scenarioKey(s)]));

  const merged = new Map<string, ProjectEdge>();
  const add = (from: string, to: string, kind: ProjectEdgeKind, flag?: string) => {
    if (from === to) return;
    const id = `${from}->${to}:${kind}`;
    const edge = merged.get(id) ?? { id, from, to, kind, flags: [] };
    if (flag && !edge.flags.includes(flag)) edge.flags.push(flag);
    merged.set(id, edge);
  };

  const missing = new Map<string, string[]>();
  for (const s of scenarios) {
    const key = scenarioKey(s);
    const uses: [ProjectEdgeKind, string[]][] = [
      ['require', s.links.requires],
      ['unless', s.links.unless],
      ['condition', s.links.conditions],
    ];
    for (const [kind, flags] of uses) {
      for (const flag of flags) {
        const from = setters.get(flag);
        if (!from) missing.set(flag, [...new Set([...(missing.get(flag) ?? []), key])]);
        else for (const f of from) add(f, key, kind, flag);
      }
    }
    for (const id of s.links.after) {
      const from = byId.get(id);
      if (from) add(from, key, 'after');
    }
  }

  const edges = [...merged.values()];
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
  const keys = scenarios.map(scenarioKey);
  return {
    edges,
    connected: keys.filter((k) => linked.has(k)),
    isolated: keys.filter((k) => !linked.has(k)),
    missing: [...missing.entries()].map(([flag, users]) => ({ flag, users })).sort((a, b) => a.flag.localeCompare(b.flag)),
  };
}

/** 上から下へ流れる配置（dagre）。戻り値はノードの左上の座標 */
export function layoutProject(ids: string[], edges: ProjectEdge[], size: { width: number; height: number }): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: 'TB', nodesep: 16, ranksep: 56, marginx: 20, marginy: 20 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) graph.setNode(id, { width: size.width, height: size.height });
  // 立っていると起きない（unless）は流れの向きを決めない。循環しやすく、並びが崩れるため
  for (const edge of edges) if (edge.kind !== 'unless') graph.setEdge(edge.from, edge.to, {}, edge.id);
  dagre.layout(graph);
  return Object.fromEntries(
    ids.map((id) => {
      const node = graph.node(id);
      return [id, { x: node.x - size.width / 2, y: node.y - size.height / 2 }];
    })
  );
}
