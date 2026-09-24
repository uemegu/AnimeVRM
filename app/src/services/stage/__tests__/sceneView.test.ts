import { describe, it, expect } from 'vitest';
import {
  EMPTY_STAGE,
  mergeStageState,
  resolveCameraShot,
  resolveCast,
  resolveLocationId,
  resolveScrollingBackground,
  resolveTimeOfDay,
} from '../sceneView';
import { ScenarioResolvedScene } from '../../scenario/ScenarioEngine';
import { ScenarioScene } from '../../../types/scenario';

const scene = (overrides: Partial<ScenarioResolvedScene> = {}): ScenarioResolvedScene => ({
  id: 's1',
  speaker: '',
  text: '',
  ...overrides,
});
const raw = (overrides: Partial<ScenarioScene> = {}): ScenarioScene => ({ id: 's', text: '', ...overrides });

describe('sceneView', () => {
  it('舞台の背景・時間帯・BGM・キャラは、指定のない項目を前のシーンから引き継ぐこと', () => {
    let stage = mergeStageState(EMPTY_STAGE, raw({
      background: 'gym',
      bgm: 'love_bgm',
      avatars: { aoi: { position: 'left', expression: 'happy' }, emili: { position: 'right' } },
    }));
    stage = mergeStageState(stage, raw({ avatars: { aoi: { expression: 'surprised' }, emili: { visible: false } } }));

    expect(stage.background).toBe('gym');
    expect(stage.bgm).toBe('love_bgm');
    expect(stage.cast).toEqual({ aoi: { position: 'left', expression: 'surprised' } });
    expect(mergeStageState(stage, raw({ clearCast: true })).cast).toEqual({});
  });

  it('流れる背景は止めるまで次のシーンに引き継がれ、画像を省略すればその場所の遠景を流すこと', () => {
    let stage = mergeStageState(EMPTY_STAGE, raw({ background: 'town', scrollingBackground: {} }));
    stage = mergeStageState(stage, raw({ text: '会話が続く' }));
    expect(resolveScrollingBackground(stage, 'town')).toEqual({
      textureUrl: '/textures/town_far.avif',
      speed: 0.65,
      blur: 1.0,
      direction: 'left',
      featherWidth: 0.2,
    });
    stage = mergeStageState(stage, raw({ scrollingBackground: { speed: 1.6 } }));
    expect(resolveScrollingBackground(stage, 'town')?.speed).toBe(1.6);
    stage = mergeStageState(stage, raw({ background: 'shrine', scrollingBackground: false }));
    expect(resolveScrollingBackground(stage, 'shrine')).toBeNull();
  });

  it('時間帯は舞台の指定を優先し、なければフェーズから決まること', () => {
    expect(resolveTimeOfDay('afterschool_action', EMPTY_STAGE)).toBe('evening');
    expect(resolveTimeOfDay('afterschool_action', { ...EMPTY_STAGE, timeOfDay: 'divine' })).toBe('divine');
  });

  it('場所は舞台の背景 → 夜/朝の固定 → シナリオの舞台 → 選んだ場所の順で決まること', () => {
    const base = { phase: 'lunch_action' as const, stage: EMPTY_STAGE, scenario: null, selectedLocationId: null };
    expect(resolveLocationId(base)).toBe('classroom');
    expect(resolveLocationId({ ...base, selectedLocationId: 'rooftop' })).toBe('rooftop');
    expect(
      resolveLocationId({ ...base, selectedLocationId: 'rooftop', scenario: { id: 'x', title: '', location: 'library' } })
    ).toBe('library');
    expect(resolveLocationId({ ...base, phase: 'night' })).toBe('myroom');
    expect(resolveLocationId({ ...base, phase: 'night', stage: { ...EMPTY_STAGE, background: 'shrine' } })).toBe('shrine');
  });

  it('登場キャラは位置とモデルを解決し、休日は私服・朝は通学カバン付き、誰もいなければ話者を出すこと', () => {
    const stage = { cast: { aoi: { position: 'left' as const, expression: 'happy' }, emili: { position: 'right' as const } } };
    const cast = resolveCast(stage, null, 'lunch_action');
    expect(cast.map((m) => [m.id, m.position[0], m.modelUrl])).toEqual([
      ['aoi', -0.45, '/models/aoi/aoi-school.vrm'],
      ['emili', 0.45, '/models/emili/emili.vrm'],
    ]);
    expect(resolveCast(stage, null, 'holiday_action')[0].modelUrl).toBe('/models/aoi/aoi-private.vrm');
    // 朝の登校中は通学カバンを背負ったモデル
    expect(resolveCast(stage, null, 'morning').map((m) => m.modelUrl)).toEqual([
      '/models/aoi/aoi-school-with-bag.vrm',
      '/models/emili/emili-school-with-bag.vrm',
    ]);
    expect(resolveCast(EMPTY_STAGE, scene({ speakerCharacterId: 'shion' }), 'morning').map((m) => m.id)).toEqual(['shion']);
  });

  it('カメラは1人なら話者、複数人の会話は話者中心、選択肢は全体になること', () => {
    const two = resolveCast({ cast: { aoi: { position: 'left' }, emili: { position: 'right' } } }, null, 'lunch_action');
    expect(resolveCameraShot(scene(), two.slice(0, 1))).toBe('speaker');
    expect(resolveCameraShot(scene({ speakerCharacterId: 'aoi' }), two)).toBe('medium');
    expect(resolveCameraShot(scene({ choices: [] as never }), two)).toBe('wide');
    expect(resolveCameraShot(scene({ camera: 'close' }), two)).toBe('close');
  });
});
