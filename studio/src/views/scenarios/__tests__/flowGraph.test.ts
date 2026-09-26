import { describe, expect, it } from 'vitest';
import type { ScenarioPackage } from '@anime-vrm/scenario';
import { buildFlowEdges, layoutFlow } from '../flowGraph';

const scenario: ScenarioPackage = {
  id: 'x',
  title: 't',
  scenes: [
    { id: 's1', text: 'a' },
    { id: 's2', text: '', choices: [{ text: 'はい', goto: 's3' }, { text: 'いいえ', goto: 's4', condition: { flag: 'brave', value: true } }], choiceTimeout: { seconds: 5, goto: 's4' } },
    { id: 's3', text: 'b', nextSceneId: 's5' },
    { id: 's4', text: 'c' },
    { id: 's5', text: 'd' },
  ],
};

describe('フローチャート', () => {
  it('順送り・飛び先・選択肢・時間切れを辺にする', () => {
    expect(buildFlowEdges(scenario).map((e) => [e.from, e.to, e.kind, e.label])).toEqual([
      ['s1', 's2', 'next', undefined],
      ['s2', 's3', 'choice', 'はい'],
      ['s2', 's4', 'choice', '［brave=true］いいえ'],
      ['s2', 's4', 'timeout', '5s'],
      ['s3', 's5', 'jump', undefined],
      ['s4', 's5', 'next', undefined],
    ]);
  });

  it('分岐は横に並び、先へ進むほど下に置く', () => {
    const pos = layoutFlow(scenario.scenes.map((s) => s.id), buildFlowEdges(scenario), { width: 200, height: 60 });
    expect(pos.s2.y).toBeGreaterThan(pos.s1.y);
    expect(pos.s3.y).toBe(pos.s4.y);
    expect(pos.s3.x).not.toBe(pos.s4.x);
    expect(pos.s5.y).toBeGreaterThan(pos.s3.y);
  });
});
