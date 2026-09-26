import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BgmBook, cutStateAt, lastKeyframeAt, MotionBook, resolveCast, stageAtScene, type ScenarioPackage } from '../src/index.ts';

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
  const scene = {
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
    expect(cutStateAt(scene, 0.5)).toEqual({ avatars: {}, camera: {} });
    expect(cutStateAt(scene, 2.5).avatars.aoi).toEqual({ expression: 'happy', expressionWeight: 1, motion: 'Wave', motionLoop: undefined, motionAt: 2 });
    expect(cutStateAt(scene, 2.5).camera).toEqual({ shot: 'close', pose: undefined, at: 1.5, duration: undefined });
    expect(cutStateAt(scene, 5).avatars.aoi.lookAtTarget).toBe('camera');
    expect(cutStateAt(scene, 5).camera.pose?.position).toEqual([0, 1.4, 1.5]);
    expect(lastKeyframeAt(scene)).toBe(4);
  });
});
