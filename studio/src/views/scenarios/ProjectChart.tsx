import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ScenarioCategory, ScenarioProject } from '@anime-vrm/scenario';
import type { ScenarioSummary } from '../../api/client';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';
import { buildProjectGraph, layoutProject, scenarioKey, type ProjectEdgeKind } from './projectGraph';

const NODE = { width: 200, height: 54 };

/** 種類ごとの色（ノードの左の帯） */
export const CATEGORY_COLORS: Record<ScenarioCategory, string> = {
  morning: '#0ea5e9',
  action: '#6366f1',
  holiday: '#10b981',
  forced: '#f97316',
  special: '#a855f7',
  ending: '#0f172a',
  call: '#14b8a6',
  mail: '#94a3b8',
  demo: '#ec4899',
};

const EDGE_STYLE: Record<ProjectEdgeKind, { stroke: string; dash?: string }> = {
  require: { stroke: '#2563eb' },
  unless: { stroke: '#dc2626', dash: '6 4' },
  condition: { stroke: '#ea580c', dash: '2 3' },
  after: { stroke: '#475569' },
};

interface ScenarioNodeData extends Record<string, unknown> {
  title: string;
  id: string;
  category: string;
  color: string;
  state: 'normal' | 'selected' | 'dim';
}

function ScenarioNode({ data }: NodeProps<Node<ScenarioNodeData>>) {
  return (
    <div className={`project-node ${data.state}`} style={{ borderLeftColor: data.color }}>
      <Handle type="target" position={Position.Top} />
      <div className="project-node-title">{data.title}</div>
      <div className="project-node-meta">
        {data.category} ・ {data.id}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const NODE_TYPES = { scenario: ScenarioNode };

/**
 * プロジェクト全体のチャート。シナリオ同士を、フラグ（立てる→条件に使う）と先行シナリオでつなぐ。
 * 日付などの発生条件は app 固有なので出さない
 */
export function ProjectChart({ project, scenarios, onOpen, onPlay }: { project: ScenarioProject; scenarios: ScenarioSummary[]; onOpen: (s: ScenarioSummary) => void; onPlay: (s: ScenarioSummary) => void }) {
  const { t, language } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const byKey = useMemo(() => new Map(scenarios.map((s) => [scenarioKey(s), s])), [scenarios]);
  const graph = useMemo(() => buildProjectGraph(scenarios), [scenarios]);
  const layout = useMemo(() => layoutProject(graph.connected, graph.edges, NODE), [graph]);

  // 選んだシナリオと、線でつながっているシナリオ
  const neighbors = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    set.add(selected);
    for (const e of graph.edges) {
      if (e.from === selected) set.add(e.to);
      if (e.to === selected) set.add(e.from);
    }
    return set;
  }, [graph, selected]);

  // 選んだらつながりが収まるように寄る。選択を外したら全体に戻す
  useEffect(() => {
    if (!flow) return;
    const nodes = selected ? [...neighbors].map((id) => ({ id })) : undefined;
    void flow.fitView({ nodes, padding: selected ? 0.25 : 0.04, maxZoom: 1, duration: 250 });
  }, [flow, selected, neighbors]);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = graph.connected.map((key) => {
      const s = byKey.get(key)!;
      return {
        id: key,
        type: 'scenario',
        position: layout[key],
        width: NODE.width,
        height: NODE.height,
        data: {
          title: s.title,
          id: s.id,
          category: t.scenarios.categories[s.category],
          color: CATEGORY_COLORS[s.category],
          state: !selected ? 'normal' : key === selected ? 'selected' : neighbors.has(key) ? 'normal' : 'dim',
        } satisfies ScenarioNodeData,
      };
    });
    const edges: Edge[] = graph.edges.map((e) => {
      const style = EDGE_STYLE[e.kind];
      const active = !selected || e.from === selected || e.to === selected;
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        // フラグ名は選んだシナリオの線にだけ出す（全部出すと重なって読めない）
        label: selected && active && e.flags.length ? e.flags.join(', ') : undefined,
        style: { stroke: style.stroke, strokeWidth: active && selected ? 2 : 1.4, strokeDasharray: style.dash, opacity: active ? 1 : 0.12 },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke },
        labelStyle: { fontSize: 11, fill: '#334155' },
        labelBgStyle: { fill: '#ffffff' },
        zIndex: active ? 1 : 0,
      };
    });
    return { nodes, edges };
  }, [graph, layout, byKey, selected, neighbors, t]);

  const current = selected ? byKey.get(selected) : undefined;
  const isolatedByCategory = project.categories
    .map((c) => ({ category: c, items: graph.isolated.map((k) => byKey.get(k)!).filter((s) => s.category === c) }))
    .filter((g) => g.items.length);
  const chart = t.scenarios.chart;

  return (
    <div className="project-chart">
      <header className="project-chart-header">
        <div>
          <h1>{project.name[language] ?? project.name.ja}</h1>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
        <span className="muted">{format(chart.summary, { total: scenarios.length, connected: graph.connected.length, edges: graph.edges.length })}</span>
      </header>
      <div className="project-chart-body">
        <div className="project-chart-canvas">
          {graph.connected.length ? (
            <>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                onNodeClick={(_, node) => setSelected(node.id === selected ? null : node.id)}
                onNodeDoubleClick={(_, node) => onOpen(byKey.get(node.id)!)}
                onPaneClick={() => setSelected(null)}
                onInit={setFlow}
                nodesDraggable={false}
                nodesConnectable={false}
                fitView
                fitViewOptions={{ padding: 0.04 }}
                minZoom={0.1}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={20} color="#e2e8f0" />
                <Controls showInteractive={false} />
              </ReactFlow>
              <div className="flow-legend">
                {(Object.keys(EDGE_STYLE) as ProjectEdgeKind[]).map((kind) => (
                  <div key={kind}>
                    <svg width="22" height="6" aria-hidden>
                      <line x1="0" y1="3" x2="22" y2="3" stroke={EDGE_STYLE[kind].stroke} strokeWidth="2" strokeDasharray={EDGE_STYLE[kind].dash} />
                    </svg>
                    {chart.legend[kind]}
                  </div>
                ))}
                <div className="muted">{chart.hint}</div>
              </div>
            </>
          ) : (
            <div className="scenarios-message">{chart.noLinks}</div>
          )}
        </div>

        <aside className="project-chart-side">
          {current ? (
            <div className="project-detail">
              <div className="project-detail-head">
                <span className="project-chip" style={{ background: CATEGORY_COLORS[current.category] }} />
                <span className="muted">
                  {t.scenarios.categories[current.category]} ・ {current.id}
                </span>
                <button type="button" className="btn icon" title={chart.close} onClick={() => setSelected(null)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
              <h2>{current.title}</h2>
              {current.description && <p className="muted">{current.description}</p>}
              <div className="project-detail-actions">
                <button type="button" className="btn primary" onClick={() => onOpen(current)}>
                  {chart.open}
                </button>
                {current.kind === 'story' && (
                  <button type="button" className="btn" onClick={() => onPlay(current)}>
                    {chart.play}
                  </button>
                )}
              </div>
              <FlagList label={chart.links.sets} flags={current.links.sets} />
              <FlagList label={chart.links.requires} flags={current.links.requires} />
              <FlagList label={chart.links.unless} flags={current.links.unless} />
              <FlagList label={chart.links.conditions} flags={current.links.conditions} />
              <FlagList label={chart.links.after} flags={current.links.after} />
            </div>
          ) : (
            <>
              {graph.missing.length > 0 && (
                <section className="project-side-section warn">
                  <h2>{chart.missing}</h2>
                  <p className="field-hint">{chart.missingHint}</p>
                  {graph.missing.map((m) => (
                    <div key={m.flag} className="project-missing">
                      <code>{m.flag}</code>
                      <span className="muted">{m.users.map((k) => byKey.get(k)?.id).join(', ')}</span>
                    </div>
                  ))}
                </section>
              )}
              <section className="project-side-section">
                <h2>{format(chart.isolated, { count: graph.isolated.length })}</h2>
                <p className="field-hint">{chart.isolatedHint}</p>
                {isolatedByCategory.map((g) => (
                  <div key={g.category} className="project-isolated-group">
                    <h3>
                      <span className="project-chip" style={{ background: CATEGORY_COLORS[g.category] }} />
                      {t.scenarios.categories[g.category]}
                    </h3>
                    {g.items.map((s) => (
                      <button key={s.id} type="button" className="scenario-item" onClick={() => onOpen(s)}>
                        <span className="scenario-item-title">{s.title}</span>
                        <span className="scenario-item-meta">{s.id}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function FlagList({ label, flags }: { label: string; flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div className="project-flags">
      <span className="field-label">{label}</span>
      <div>
        {flags.map((f) => (
          <code key={f}>{f}</code>
        ))}
      </div>
    </div>
  );
}
