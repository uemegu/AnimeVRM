import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BgmBook, MotionBook, resolveCast, stageAtScene, type ScenarioPackage } from '../src/index.ts';

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
