import { describe, expect, it } from 'vitest';
import type { ScenarioLinks } from '@anime-vrm/scenario';
import type { ScenarioSummary } from '../../../api/client';
import { buildProjectGraph, layoutProject } from '../projectGraph';

const scenario = (category: ScenarioSummary['category'], id: string, links: Partial<ScenarioLinks>): ScenarioSummary => ({
  category,
  id,
  kind: 'story',
  title: id,
  lineCount: 1,
  updatedAt: '',
  links: { sets: [], requires: [], unless: [], conditions: [], after: [], ...links },
});

const scenarios = [
  scenario('action', 'a', { sets: ['met', 'seen_a'], unless: ['seen_a'] }),
  scenario('holiday', 'b', { sets: ['met'], requires: ['met'] }),
  scenario('forced', 'c', { requires: ['met', 'ghost'], conditions: ['met'], after: ['a'] }),
  scenario('action', 'd', {}),
];

describe('プロジェクトのチャート', () => {
  const graph = buildProjectGraph(scenarios);

  it('フラグを立てるシナリオから条件に使うシナリオへつなぎ、同じ組の線はまとめる', () => {
    expect(graph.edges.map((e) => [e.from, e.to, e.kind, e.flags])).toEqual([
      ['action/a', 'holiday/b', 'require', ['met']],
      ['action/a', 'forced/c', 'require', ['met']],
      ['holiday/b', 'forced/c', 'require', ['met']],
      ['action/a', 'forced/c', 'condition', ['met']],
      ['holiday/b', 'forced/c', 'condition', ['met']],
      ['action/a', 'forced/c', 'after', []],
    ]);
  });

  it('自分で立てて自分で使うフラグは線にしない', () => {
    expect(graph.edges.some((e) => e.kind === 'unless')).toBe(false);
  });

  it('どこともつながらないシナリオと、誰も立てないフラグを分ける', () => {
    expect(graph.isolated).toEqual(['action/d']);
    expect(graph.missing).toEqual([{ flag: 'ghost', users: ['forced/c'] }]);
  });

  it('条件に使う側を下に置く', () => {
    const layout = layoutProject(graph.connected, graph.edges, { width: 100, height: 40 });
    expect(layout['action/a'].y).toBeLessThan(layout['holiday/b'].y);
    expect(layout['holiday/b'].y).toBeLessThan(layout['forced/c'].y);
  });
});
