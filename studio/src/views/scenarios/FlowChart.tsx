import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CharacterBook, ScenarioPackage } from '@anime-vrm/scenario';
import { choiceConditionFlags } from '@anime-vrm/scenario';
import { useI18n } from '../../i18n';
import { buildFlowEdges, layoutFlow, type FlowEdgeKind } from './flowGraph';
import { textJa } from './scenarioEdit';

const NODE = { width: 220, height: 74 };
const START = '__start__';

interface CutNodeData extends Record<string, unknown> {
  id: string;
  speaker: string;
  color: string;
  text: string;
  flags: string[];
  voice: boolean;
  selected: boolean;
  ending: boolean;
}

interface StartNodeData extends Record<string, unknown> {
  conditions: string[];
}

const EDGE_STYLE: Record<FlowEdgeKind, { stroke: string; dashed?: boolean }> = {
  next: { stroke: '#94a3b8' },
  jump: { stroke: '#2563eb' },
  choice: { stroke: '#ea580c' },
  timeout: { stroke: '#ea580c', dashed: true },
};

function CutNode({ data }: NodeProps<Node<CutNodeData>>) {
  const { t } = useI18n();
  return (
    <div className={`flow-node${data.selected ? ' selected' : ''}`} style={{ borderLeftColor: data.color }}>
      <Handle type="target" position={Position.Top} />
      <div className="flow-node-meta">
        <span className="flow-node-id">{data.id}</span>
        <span className="flow-node-speaker">{data.speaker}</span>
        {data.voice && <span className="flow-node-dot" title={t.scenarios.voice} />}
      </div>
      <div className="flow-node-text">{data.text || '—'}</div>
      {(data.flags.length > 0 || data.ending) && (
        <div className="flow-node-flags">
          {data.flags.map((f) => (
            <span key={f}>{f}</span>
          ))}
          {data.ending && <span className="end">{t.scenarios.flowEnd}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function StartNode({ data }: NodeProps<Node<StartNodeData>>) {
  const { t } = useI18n();
  return (
    <div className="flow-start">
      <strong>{t.scenarios.flowStart}</strong>
      {data.conditions.map((c) => (
        <span key={c}>{c}</span>
      ))}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const NODE_TYPES = { cut: CutNode, start: StartNode };

/** 発生条件を短い文にする（フラグ・日付・好感度・先行シナリオ） */
function describeAvailability(scenario: ScenarioPackage): string[] {
  const a = scenario.availability;
  if (!a) return [];
  const lines: string[] = [];
  if (a.requireFlags?.length) lines.push(`+ ${a.requireFlags.join(', ')}`);
  if (a.unlessFlags?.length) lines.push(`− ${a.unlessFlags.join(', ')}`);
  if (a.dayRange) lines.push(`Day ${a.dayRange.from ?? ''}〜${a.dayRange.to ?? ''}`);
  if (a.timeSlots?.length) lines.push(a.timeSlots.join(' / '));
  if (a.locations?.length) lines.push(a.locations.join(' / '));
  if (a.minAffinity) lines.push(Object.entries(a.minAffinity).map(([k, v]) => `${k} ≥ ${v}`).join(', '));
  if (a.maxAffinity) lines.push(Object.entries(a.maxAffinity).map(([k, v]) => `${k} < ${v}`).join(', '));
  const after = [...(a.after?.all ?? []), ...(a.after?.any ?? [])];
  if (after.length) lines.push(`after: ${after.map((p) => p.scenarioId + (p.choiceId ? `#${p.choiceId}` : '')).join(', ')}`);
  return lines;
}

/**
 * シナリオのフローチャート。カットをクリックするとそのカットを選ぶ
 */
export function FlowChart({ scenario, characters, selectedId, onSelect }: { scenario: ScenarioPackage; characters: CharacterBook; selectedId: string; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const { nodes, edges } = useMemo(() => {
    const flowEdges = buildFlowEdges(scenario);
    const ids = scenario.scenes.map((s) => s.id);
    const first = ids[0];
    const withStart = [START, ...ids];
    const layout = layoutFlow(withStart, [{ id: 'start', from: START, to: first, kind: 'next' }, ...flowEdges], NODE);
    const outgoing = new Set(flowEdges.map((e) => e.from));
    const colorOf = (id?: string) => characters.characters.find((c) => c.id === id)?.themeColor ?? '#cbd5e1';

    const cutNodes: Node[] = scenario.scenes.map((scene) => ({
      id: scene.id,
      type: 'cut',
      position: layout[scene.id],
      data: {
        id: scene.id,
        speaker: textJa(scene.speaker) || t.scenarios.narration,
        color: scene.speakerCharacterId ? colorOf(scene.speakerCharacterId) : '#e2e8f0',
        text: textJa(scene.text) || (scene.choices?.length ? `［${t.scenarios.choices.replace('{count}', String(scene.choices.length))}］` : ''),
        flags: [...new Set([...Object.keys(scene.setFlags ?? {}), ...(scene.choices ?? []).flatMap((c) => Object.keys(c.setFlags ?? {}))])],
        voice: !!scene.voiceUrl,
        selected: scene.id === selectedId,
        ending: !outgoing.has(scene.id),
      } satisfies CutNodeData,
      width: NODE.width,
      height: NODE.height,
    }));
    const startNode: Node = { id: START, type: 'start', position: layout[START], data: { conditions: describeAvailability(scenario) } satisfies StartNodeData, selectable: false };

    const edges: Edge[] = [
      { id: 'start', source: START, target: first, style: { stroke: '#94a3b8' } },
      ...flowEdges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label,
        animated: e.kind === 'timeout',
        style: { stroke: EDGE_STYLE[e.kind].stroke, strokeWidth: e.kind === 'next' ? 1.2 : 1.8, strokeDasharray: EDGE_STYLE[e.kind].dashed ? '5 4' : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STYLE[e.kind].stroke },
        labelStyle: { fontSize: 11, fill: '#334155' },
        labelBgStyle: { fill: '#ffffff' },
      })),
    ];
    return { nodes: [startNode, ...cutNodes], edges };
  }, [scenario, characters, selectedId, t]);

  // シナリオ全体で立てるフラグ・条件に使うフラグ
  const flagSummary = useMemo(() => {
    const set = new Set<string>();
    const used = new Set<string>();
    for (const scene of scenario.scenes) {
      Object.keys(scene.setFlags ?? {}).forEach((f) => set.add(f));
      for (const c of scene.choices ?? []) {
        Object.keys(c.setFlags ?? {}).forEach((f) => set.add(f));
        choiceConditionFlags(c.condition).forEach((f) => used.add(f));
      }
    }
    scenario.availability?.requireFlags?.forEach((f) => used.add(f));
    scenario.availability?.unlessFlags?.forEach((f) => used.add(f));
    return { set: [...set], used: [...used] };
  }, [scenario]);

  // 選んだカットを読める倍率で真ん中に出す（全体は Controls の「全体を表示」で見られる）
  useEffect(() => {
    const node = nodes.find((n) => n.id === selectedId);
    if (!flow || !node) return;
    void flow.setCenter(node.position.x + NODE.width / 2, node.position.y + NODE.height / 2, { zoom: Math.max(flow.getZoom(), 0.85), duration: 250 });
  }, [flow, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flow-chart">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={(_, node) => node.id !== START && onSelect(node.id)}
        onInit={setFlow}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="flow-legend">
        <div>
          <span className="flow-legend-line next" />
          {t.scenarios.flowLegend.next}
        </div>
        <div>
          <span className="flow-legend-line jump" />
          {t.scenarios.flowLegend.jump}
        </div>
        <div>
          <span className="flow-legend-line choice" />
          {t.scenarios.flowLegend.choice}
        </div>
        {flagSummary.set.length > 0 && <div className="flow-legend-flags">{`${t.scenarios.flowFlagsSet}: ${flagSummary.set.join(', ')}`}</div>}
        {flagSummary.used.length > 0 && <div className="flow-legend-flags">{`${t.scenarios.flowFlagsUsed}: ${flagSummary.used.join(', ')}`}</div>}
      </div>
    </div>
  );
}
