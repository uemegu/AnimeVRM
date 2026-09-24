import { describe, it, expect } from 'vitest';
import { ScenarioEngine } from '../ScenarioEngine';
import { validateScenario } from '../ScenarioValidator';
import { ScenarioPackage } from '../../../types/scenario';
import sampleScenario from './fixtures/sampleScenario.json';

const SAMPLE_SCENARIO = sampleScenario as ScenarioPackage;

describe('ScenarioValidator (シナリオ静的検証)', () => {
  it('SAMPLE_SCENARIO が正常にバリデーションを通過すること', () => {
    const result = validateScenario(SAMPLE_SCENARIO);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('存在しない goto ターゲットがある場合にエラーを検出すること', () => {
    const brokenScenario: ScenarioPackage = {
      id: 'broken',
      title: 'Broken Scenario',
      scenes: [
        {
          id: 'sc1',
          text: '',
          choices: [
            {
              text: '壊れたリンク',
              goto: 'non_existent_scene',
            },
          ],
        },
      ],
    };

    const result = validateScenario(brokenScenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('non_existent_scene'))).toBe(true);
  });

  it('重複したシーンIDを検出すること', () => {
    const dupScenario: ScenarioPackage = {
      id: 'duplicate',
      title: 'Duplicate ID',
      scenes: [
        { id: 'same_id', text: '1回目' },
        { id: 'same_id', text: '2回目' },
      ],
    };

    const result = validateScenario(dupScenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('重複するシーンID'))).toBe(true);
  });
});

describe('ScenarioEngine (Headless シナリオ進行・フラグ検証)', () => {
  it('画面なしで全シーンを順次進行し、完了すること（受諾ルート）', () => {
    const engine = new ScenarioEngine(SAMPLE_SCENARIO);

    // Scene 1
    const scene1 = engine.getCurrentScene();
    expect(scene1?.id).toBe('scene_01');
    expect(scene1?.speaker).toBe('アオイ');
    expect(scene1?.text).toBe('おはよう！今日もいい天気だね。');
    expect(scene1?.voiceUrl).toBe('/voices/aoi_morning_01.wav');

    // 次へ
    expect(engine.next()).toBe(false);

    // Scene 2
    const scene2 = engine.getCurrentScene();
    expect(scene2?.id).toBe('scene_02');

    // 次へ -> 選択肢シーン
    expect(engine.next()).toBe(false);
    expect(engine.isWaitingForChoice()).toBe(true);

    // 選択肢待ち中は next() で進行できないこと
    expect(engine.next()).toBe(false);
    expect(engine.getCurrentScene()?.id).toBe('scene_choice');

    // 選択肢1（一緒に行く）を選択
    engine.choose(0);

    // 受諾シーンへジャンプしていること
    const acceptScene = engine.getCurrentScene();
    expect(acceptScene?.id).toBe('scene_accept');
    expect(acceptScene?.text).toBe('やった！約束だよ、楽しみにしてるね！');

    // フラグと好感度が更新されていること
    expect(engine.getFlags()['promised_library_with_aoi']).toBe(true);
    expect(engine.getAffinities()['girl_01']).toBe(5);

    // 次へ（scene_accept の nextSceneId: scene_end）
    expect(engine.next()).toBe(false);
    const endScene = engine.getCurrentScene();
    expect(endScene?.id).toBe('scene_end');

    // 終了
    expect(engine.next()).toBe(true);
    expect(engine.isFinished()).toBe(true);
  });

  it('断るルートでフラグが false になり好感度が加算されないこと', () => {
    const engine = new ScenarioEngine(SAMPLE_SCENARIO);

    engine.next(); // scene_01 -> scene_02
    engine.next(); // scene_02 -> scene_choice

    // 選択肢2（断る）を選択
    engine.choose(1);

    const declineScene = engine.getCurrentScene();
    expect(declineScene?.id).toBe('scene_decline');
    expect(engine.getFlags()['promised_library_with_aoi']).toBe(false);
    expect(engine.getAffinities()['girl_01']).toBeUndefined();

    // 終了まで進行
    engine.next(); // -> scene_end
    expect(engine.next()).toBe(true);
    expect(engine.isFinished()).toBe(true);
  });

  it('多言語切り替え（英語）で英語テキストが解決されること', () => {
    const engine = new ScenarioEngine(SAMPLE_SCENARIO, {}, {}, 'en');

    const scene1 = engine.getCurrentScene();
    expect(scene1?.speaker).toBe('Aoi');
    expect(scene1?.text).toBe('Good morning! Beautiful weather today, right?');
    // 日本語ボイスURLは英語表示時でもそのまま維持されること
    expect(scene1?.voiceUrl).toBe('/voices/aoi_morning_01.wav');
  });
});
