import { describe, it, expect } from 'vitest';
import { resolveActiveCharacter, resolveLocationId, resolveTimeOfDay } from '../sceneView';
import { ScenarioResolvedScene } from '../../scenario/ScenarioEngine';

const scene = (overrides: Partial<ScenarioResolvedScene> = {}): ScenarioResolvedScene => ({
  id: 's1',
  speaker: '',
  text: '',
  ...overrides,
});

describe('sceneView', () => {
  it('時間帯はシーン指定を優先し、なければフェーズから決まること', () => {
    expect(resolveTimeOfDay('afterschool_action', null)).toBe('evening');
    expect(resolveTimeOfDay('afterschool_action', scene({ timeOfDay: 'divine' }))).toBe('divine');
  });

  it('場所はシーン背景 → 夜/朝の固定 → シナリオの舞台 → 選んだ場所の順で決まること', () => {
    const base = { phase: 'lunch_action' as const, scene: null, scenario: null, selectedLocationId: null };
    expect(resolveLocationId(base)).toBe('classroom');
    expect(resolveLocationId({ ...base, selectedLocationId: 'rooftop' })).toBe('rooftop');
    expect(
      resolveLocationId({ ...base, selectedLocationId: 'rooftop', scenario: { id: 'x', title: '', location: 'library' } })
    ).toBe('library');
    expect(resolveLocationId({ ...base, phase: 'night' })).toBe('myroom');
    expect(resolveLocationId({ ...base, phase: 'night', scene: scene({ background: 'shrine' }) })).toBe('shrine');
  });

  it('表示キャラは見えている最初のアバター、休日は私服モデルになること', () => {
    const s = scene({
      avatars: {
        emili: { characterId: 'emili', visible: false },
        aoi: { characterId: 'aoi', expression: 'happy' },
      },
    });
    expect(resolveActiveCharacter(s, 'lunch_action')).toEqual({
      charId: 'aoi',
      modelUrl: '/models/aoi/aoi-school.vrm',
      expression: 'happy',
    });
    expect(resolveActiveCharacter(s, 'holiday_action').modelUrl).toBe('/models/aoi/aoi-private.vrm');
    expect(resolveActiveCharacter(scene({ speakerCharacterId: 'shion' }), 'morning').charId).toBe('shion');
  });
});
