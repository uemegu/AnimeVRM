import dagre from '@dagrejs/dagre';
import type { ScenarioPackage } from '@anime-vrm/scenario';
import { describeChoiceCondition } from '@anime-vrm/scenario';
import { textJa } from './scenarioEdit';

export type FlowEdgeKind = 'next' | 'jump' | 'choice' | 'timeout';

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  kind: FlowEdgeKind;
  label?: string;
}

/**
 * シナリオのつながり。next は配列の次の行へ自然に進むもの、jump は nextSceneId、
 * choice は選択肢、timeout は選択肢の時間切れ
 */
export function buildFlowEdges(scenario: ScenarioPackage): FlowEdge[] {
  const edges: FlowEdge[] = [];
  scenario.scenes.forEach((scene, index) => {
    if (scene.choices?.length) {
      scene.choices.forEach((choice, i) => {
        const condition = choice.condition ? `［${describeChoiceCondition(choice.condition)}］` : '';
        edges.push({ id: `${scene.id}-c${i}`, from: scene.id, to: choice.goto, kind: 'choice', label: `${condition}${textJa(choice.text)}` });
      });
      if (scene.choiceTimeout?.goto) {
        edges.push({ id: `${scene.id}-t`, from: scene.id, to: scene.choiceTimeout.goto, kind: 'timeout', label: `${scene.choiceTimeout.seconds}s` });
      }
      return;
    }
    if (scene.end) return;
    if (scene.nextSceneId) {
      edges.push({ id: `${scene.id}-j`, from: scene.id, to: scene.nextSceneId, kind: 'jump' });
      return;
    }
    const next = scenario.scenes[index + 1];
    if (next) edges.push({ id: `${scene.id}-n`, from: scene.id, to: next.id, kind: 'next' });
  });
  return edges;
}

/** 上から下へ流れる配置（dagre）。戻り値はノードの左上の座標 */
export function layoutFlow(ids: string[], edges: FlowEdge[], size: { width: number; height: number }): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 44, marginx: 20, marginy: 20 });
  graph.setDefaultEdgeLabel(() => ({}));
  const known = new Set(ids);
  for (const id of ids) graph.setNode(id, { width: size.width, height: size.height });
  for (const edge of edges) if (known.has(edge.to)) graph.setEdge(edge.from, edge.to);
  dagre.layout(graph);
  return Object.fromEntries(
    ids.map((id) => {
      const node = graph.node(id);
      return [id, { x: node.x - size.width / 2, y: node.y - size.height / 2 }];
    })
  );
}
