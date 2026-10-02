import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BgmBook, CUT_ONE_SHOT_DELAY, cutStateAt, lastKeyframeAt, mergeStageState, movieCutDuration, MotionBook, resolveCast, stageAtScene, type ScenarioPackage, type ScenarioScene } from '../src/index.ts';

const STUDIO = path.resolve(import.meta.dirname, '../../../assets/studio');

describe('舞台の状態', () => {
  const scenario: ScenarioPackage = {
    id: 's',
    title: 't',
    bgm: 'main',
    scenes: [
      { id: 's1', text: '', background: 'classroom', avatars: { aoi: { position: 'left', expression: 'happy' } } },
      { id: 's2', text: '', avatars: { emili: { position: 'right' }, aoi: { motion: 'Wave' } } },
      { id: 's3', text: '', avatars: { aoi: { visible: false } } },
    ],
  };

  it('途中のカットまで順にたどって、引き継いだ状態になること', () => {
    const stage = stageAtScene(scenario, 1);
    expect(stage.background).toBe('classroom');
    expect(stage.bgm).toBe('main');
    expect(stage.cast.aoi).toEqual({ position: 'left', expression: 'happy', motion: 'Wave' });
    expect(Object.keys(stageAtScene(scenario, 2).cast)).toEqual(['emili']);
  });

  it('BGM の音量・チャネルは同じ BGM のあいだ引き継ぎ、BGM が変わると既定に戻ること', () => {
    const withMix: ScenarioPackage = {
      id: 'm',
      title: 't',
      bgm: 'main',
      scenes: [
        { id: 'm1', text: '', bgmVolume: 0.5, bgmPan: 'left' },
        { id: 'm2', text: '' },
        { id: 'm3', text: '', bgm: 'night' },
        { id: 'm4', text: '', bgm: 'love', bgmVolume: 0.3 },
      ],
    };
    expect(stageAtScene(withMix, 1)).toMatchObject({ bgm: 'main', bgmVolume: 0.5, bgmPan: 'left' });
    expect(stageAtScene(withMix, 2)).toMatchObject({ bgm: 'night', bgmVolume: undefined, bgmPan: undefined });
    expect(stageAtScene(withMix, 3)).toMatchObject({ bgm: 'love', bgmVolume: 0.3, bgmPan: undefined });
  });

  it('キャラの服装とループは呼び出し側の決まりで解決すること', () => {
    const cast = resolveCast(stageAtScene(scenario, 1), {
      modelUrlFor: (id) => `/models/${id}.vrm`,
      isLoopingMotion: (m) => m === 'Idle',
    });
    expect(cast.map((m) => [m.id, m.slot, m.modelUrl, m.motionLoop])).toEqual([
      ['aoi', 'left', '/models/aoi.vrm', false],
      ['emili', 'right', '/models/emili.vrm', true],
    ]);
  });

  it('bgm.json がスキーマに合い、音声ファイルが存在すること', () => {
    const book = BgmBook.parse(JSON.parse(fs.readFileSync(path.join(STUDIO, 'bgm.json'), 'utf8')));
    expect(Object.values(book.bgm).filter((b) => !fs.existsSync(path.join(STUDIO, '..', b.url)))).toEqual([]);
  });

  it('motions.json がスキーマに合うこと', () => {
    const book = JSON.parse(fs.readFileSync(path.join(STUDIO, 'motions.json'), 'utf8'));
    expect(MotionBook.safeParse(book).success).toBe(true);
  });
});

describe('カット内のタイムライン', () => {
  const scene: ScenarioScene = {
    id: 's1',
    text: '',
    avatars: {
      aoi: {
        expression: 'neutral',
        transitions: [
          { at: 2, motion: 'Wave' },
          { at: 1, expression: 'happy', expressionWeight: 1 },
          { at: 3, lookAtTarget: 'camera', headTurn: 0.5 },
        ],
      },
    },
    transitions: [
      { at: 1.5, camera: 'close' as const },
      { at: 4, cameraPose: { position: [0, 1.4, 1.5] as [number, number, number], target: [0, 1.3, 0] as [number, number, number] }, cameraTransitionDuration: 1 },
    ],
  };

  it('時刻までのキーフレームを順に重ねる', () => {
    expect(cutStateAt(scene, 0.5)).toEqual({ avatars: {}, camera: {}, focusLines: false, oneShots: [] });
    expect(cutStateAt(scene, 2.5).avatars.aoi).toEqual({ expression: 'happy', expressionWeight: 1, motion: 'Wave', motionLoop: undefined, motionAt: 2 });
    expect(cutStateAt(scene, 2.5).camera).toEqual({ shot: 'close', pose: undefined, at: 1.5, duration: undefined });
    expect(cutStateAt(scene, 5).avatars.aoi.lookAtTarget).toBe('camera');
    expect(cutStateAt(scene, 5).camera.pose?.position).toEqual([0, 1.4, 1.5]);
    expect(lastKeyframeAt(scene)).toBe(4);
  });
});

describe('感情演出', () => {
  const noCast = { modelUrlFor: () => '/models/a.vrm', isLoopingMotion: () => false };

  it('頬赤などは次のシーンに引き継ぎ、文字演出・汗はそのシーンだけ', () => {
    const first: ScenarioScene = { id: 's1', text: '', avatars: { aoi: { blush: true, eyeWander: true, effectText: 'doki', sweat: 'fly4' } } };
    const second: ScenarioScene = { id: 's2', text: '', avatars: { aoi: { anger: true } } };
    const stage = mergeStageState(mergeStageState({ cast: {} }, first), second);
    expect(stage.cast.aoi).toEqual({ blush: true, eyeWander: true, anger: true });
    const [aoi] = resolveCast(stage, noCast);
    expect(aoi.look).toEqual({ blush: true, anger: true, tears: false, eyeWander: 1, fastMotion: false, motionSpeed: 1 });
  });

  it('カットの文字演出は少し待ってから、キーの演出は時刻が来たら出す', () => {
    const scene: ScenarioScene = {
      id: 'c',
      text: '',
      focusLines: true,
      avatars: { aoi: { effectText: 'gaan', transitions: [{ at: 2, sweat: 'jito', tears: true }] } },
      transitions: [{ at: 3, focusLines: false }],
    };
    expect(cutStateAt(scene, 0).oneShots).toEqual([]);
    expect(cutStateAt(scene, CUT_ONE_SHOT_DELAY).oneShots.map((s) => s.key)).toEqual(['aoi@cut']);
    const later = cutStateAt(scene, 2.5);
    expect(later.oneShots.map((s) => [s.key, s.sweat])).toEqual([['aoi@cut', undefined], ['aoi@0', 'jito']]);
    expect(later.avatars.aoi.tears).toBe(true);
    expect(later.focusLines).toBe(true);
    expect(cutStateAt(scene, 3).focusLines).toBe(false);
  });
});

describe('ムービーのカットの長さ', () => {
  it('duration があればボイスやキーを待たない', () => {
    expect(movieCutDuration({ id: 'a', text: '', duration: 2, transitions: [{ at: 5 }] }, 4)).toBe(2);
  });
  it('ボイスと最後のキーの遅い方に間を足す', () => {
    expect(movieCutDuration({ id: 'a', text: '', transitions: [{ at: 5 }] }, 4)).toBeCloseTo(5.6);
    expect(movieCutDuration({ id: 'a', text: '', autoNextSec: 1 }, 4)).toBe(5);
  });
  it('ボイスもキーもなければ既定の長さ', () => {
    expect(movieCutDuration({ id: 'a', text: '' }, 0)).toBe(3);
    expect(movieCutDuration({ id: 'a', text: '', autoNextSec: 1.5 }, 0)).toBe(1.5);
  });
});
