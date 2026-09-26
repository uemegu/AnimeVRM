import { describe, expect, it } from 'vitest';
import type { ScenarioScene } from '@anime-vrm/scenario';
import { addKey, keyKinds, laneKeys, removeKey, updateKey } from '../timelineEdit';

const scene: ScenarioScene = { id: 's1', text: '', avatars: { aoi: { expression: 'neutral', transitions: [{ at: 1, expression: 'happy' }] } } };
const aoi = { kind: 'avatar' as const, id: 'aoi' };

describe('タイムラインの編集', () => {
  it('キーを足すと時刻順に並び、足したキーの位置を返す', () => {
    const { scene: next, index } = addKey(scene, aoi, { at: 0.5, motion: 'Wave' });
    expect(laneKeys(next, aoi).map((k) => k.at)).toEqual([0.5, 1]);
    expect(index).toBe(0);
  });

  it('時刻を動かすと並べ替え、動かしたキーの新しい位置を返す', () => {
    const two = addKey(scene, aoi, { at: 2, motion: 'Wave' }).scene;
    const { scene: next, index } = updateKey(two, { lane: aoi, index: 0 }, { at: 3.123, expression: 'happy' });
    expect(laneKeys(next, aoi).map((k) => k.at)).toEqual([2, 3.12]);
    expect(index).toBe(1);
  });

  it('最後のキーを消すと transitions ごと消える', () => {
    const next = removeKey(scene, { lane: aoi, index: 0 });
    expect(next.avatars?.aoi).toEqual({ expression: 'neutral' });
  });

  it('カメラの行はシーンの transitions', () => {
    const { scene: next } = addKey(scene, { kind: 'camera' }, { at: 1, camera: 'close' });
    expect(next.transitions).toEqual([{ at: 1, camera: 'close' }]);
    expect(keyKinds(next.transitions![0])).toEqual(['camera']);
  });
});
