import { describe, it, expect } from 'vitest';
import { ScheduleManager } from '../ScheduleManager';
import { ScenarioEngine } from '../../scenario/ScenarioEngine';
import { SaveService } from '../../save/SaveService';
import { ActionLocationId, GameState } from '../../../types/game';
import { loadScenario } from '../../scenario/__tests__/diskScenarioRepository';

// インメモリストレージ
class MemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear(): void {
    this.store = {};
  }
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
}

describe('GameLoopIntegration (ゲームループ・21日間コアループ結合テスト)', () => {
  /** シナリオを最後まで進める。選択肢は choiceIds の順に、なければ1番目を選ぶ */
  async function play(id: string, state: GameState, choiceIds: string[] = []): Promise<GameState> {
    const scenario = await loadScenario(id);
    const engine = new ScenarioEngine(scenario, state.flags, state.affinities);
    const history = [...(state.scenarioHistory ?? [])];
    const wanted = [...choiceIds];
    for (let guard = 0; !engine.isFinished() && guard < 500; guard++) {
      if (engine.isWaitingForChoice()) {
        const choices = engine.getAvailableChoices();
        const next = wanted[0];
        const index = next ? choices.findIndex((c) => (c.id ?? c.goto) === next) : 0;
        expect(index, `${id}: 選択肢 ${next} が選べない`).toBeGreaterThanOrEqual(0);
        if (next) wanted.shift();
        engine.choose(index);
        history.push({ scenarioId: id, day: state.day, type: 'choice', choiceId: engine.getLastSelectedChoiceId()! });
      } else {
        engine.next();
      }
    }
    expect(engine.isFinished()).toBe(true);
    expect(wanted, `${id}: 使われなかった選択 ${wanted}`).toEqual([]);
    history.push({ scenarioId: id, day: state.day, type: 'completed' });
    return { ...state, flags: engine.getFlags(), affinities: engine.getAffinities(), scenarioHistory: history };
  }

  /** 場所を選んでシナリオを再生（期待するシナリオが選ばれることも確認） */
  async function visit(state: GameState, location: ActionLocationId, expectedId: string, choiceIds: string[] = []) {
    expect(ScheduleManager.getScenarioForLocation(location, state).id).toBe(expectedId);
    return play(expectedId, state, choiceIds);
  }

  const on = (state: GameState, day: number, phase: GameState['phase']): GameState => ({ ...state, day, phase });

  it('Day 1: プロローグ → ホームルーム → 昼 → 放課後 → 夜 → 就寝で Day 2 の朝へ進めること', async () => {
    let state: GameState = ScheduleManager.createInitialState();
    state = await play(ScheduleManager.getMorningScenario(state).id, state);

    state = on(state, 1, 'morning_action');
    const homeroom = ScheduleManager.checkForcedInterruption(state);
    expect(homeroom?.id).toBe('homeroom_day1');
    state = await play(homeroom!.id, state);

    state = await visit(on(state, 1, 'lunch_action'), 'rooftop', 'emili_rooftop', ['c1_1']);
    expect(state.affinities.emili).toBe(2);
    state = await visit(on(state, 1, 'afterschool_action'), 'classroom', 'aoi_t1_textbook', ['c1_1']);
    expect(state.flags.aoi_t1_textbook).toBe(true);

    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(on(state, 1, 'night'));
    expect(isEnding).toBe(false);
    expect(nextState.day).toBe(2);
    expect(nextState.phase).toBe('morning');
    expect(nextState.affinities.aoi).toBe(2);
  });

  /** True 連鎖を正解で進める（step を指定するとそこだけ外す） */
  async function playAoiRoute(missStep?: string): Promise<GameState> {
    let s: GameState = ScheduleManager.createInitialState();
    const step = async (id: string, state: GameState, loc: ActionLocationId | null, correct: string[], wrong: string[]) => {
      const choices = id === missStep ? wrong : correct;
      return loc ? visit(state, loc, id, choices) : play(id, state, choices);
    };
    s = await step('aoi_t1_textbook', on(s, 1, 'afterschool_action'), 'classroom', ['c1_1'], ['c1_2']);
    if (missStep === 'aoi_t1_textbook') return s;
    s = await step('aoi_t2_library', on(s, 2, 'lunch_action'), 'library', ['c1_1'], ['c1_2']);
    s = await step('aoi_t3_danish', on(s, 4, 'lunch_action'), 'cafeteria', ['c1_1'], ['c1_2']);
    s = await step('aoi_t4_hoodie', on(s, 6, 'holiday_action'), 'park', ['c1_2'], ['c1_1']);
    s = await step('aoi_t5_uchiwa', on(s, 8, 'afterschool_action'), 'sports_ground', ['c1_1'], ['c1_2']);
    s = await play('blazer_swap', on(s, 9, 'lunch_action'));
    const heroChoices = missStep === 'aoi_t6_hero' ? ['c1_1', 'c2_2'] : ['c1_1', 'c2_1'];
    s = await play('black_suits', on(s, 11, 'afterschool_action'), heroChoices);
    // 招待メール（主人公の一言で アオイの家 が解放される）
    if (s.flags.aoi_t6_hero) s = { ...s, flags: { ...s.flags, invited_aoi_house: true }, affinities: { ...s.affinities, aoi: (s.affinities.aoi ?? 0) + 2 } };
    s = await step('aoi_aquarium', on(s, 7, 'holiday_action'), 'aquarium', ['c1_1'], ['c1_1']);
    if (!s.flags.invited_aoi_house) return s;
    s = await step('aoi_t7_lap', on(s, 13, 'holiday_action'), 'aoi_house', ['c1_1'], ['c1_2']);
    if (!s.flags.aoi_t7_lap) return s;
    s = await step('aoi_t8_rain', on(s, 14, 'holiday_action'), 'shrine', ['c1_1'], ['c1_2']);
    if (!s.flags.aoi_t8_rain) return s;
    s = await play('aoi_t9_corridor', on(s, 18, 'afterschool_action'), missStep === 'aoi_t9_corridor' ? ['c1_3'] : ['c1_1']);
    if (s.flags.aoi_t9_corridor) s = { ...s, flags: { ...s.flags, aoi_t10_promise: true }, affinities: { ...s.affinities, aoi: (s.affinities.aoi ?? 0) + 2 } };
    return s;
  }

  it('アオイのイベントで正解を選び続けると、最終日に約束の神社へ行き TRUE END になること', async () => {
    let state = await playAoiRoute();
    expect(state.flags.aoi_t10_promise).toBe(true);
    state = on(state, 21, 'holiday_action');
    const finale = ScheduleManager.checkForcedInterruption(state);
    expect(finale?.id).toBe('finale_promised');
    state = await play(finale!.id, state, ['confess_sincere']);
    expect(ScheduleManager.getEndingScenario(state)?.id).toBe('ending_true');
  });

  it('連鎖の途中で1つ外すと以降のイベントが起きず、好感度があっても TRUE END にならないこと', async () => {
    let state = await playAoiRoute('aoi_t8_rain');
    expect(state.flags.aoi_t9_corridor).toBeUndefined();
    state = { ...on(state, 21, 'holiday_action'), affinities: { aoi: 99 } };
    const finale = ScheduleManager.checkForcedInterruption(state);
    expect(finale?.id).toBe('finale_default');
    state = await play(finale!.id, state, ['confess_sincere']);
    expect(ScheduleManager.getEndingScenario(state)?.id).toBe('ending_good');
  });

  it('告白を飾りすぎると BAD END になること', async () => {
    let state = on(ScheduleManager.createInitialState(), 21, 'holiday_action');
    state = await play('finale_default', state, ['confess_poem']);
    expect(ScheduleManager.getEndingScenario(state)?.id).toBe('ending_bad');
  });

  it('夜に「1日をやり直す」を実行すると、その日の朝の開始スナップショットへ完全復元されること', () => {
    let state = ScheduleManager.createInitialState();
    // 朝の開始時点（affinities={}, flags={}）
    expect(state.dayStartSnapshot?.flags).toEqual({});

    // 行動によって状態が変化
    state.flags = { met_aoi: true, actionDone: true };
    state.affinities = { aoi: 15 };
    state.phase = 'night';

    // 1日をやり直す
    const rolledBack = ScheduleManager.rollbackToday(state);
    expect(rolledBack.day).toBe(1);
    expect(rolledBack.phase).toBe('morning');
    expect(rolledBack.flags).toEqual({});
    expect(rolledBack.affinities).toEqual({});
  });

  it('夜のセーブ・ロードでゲーム状態が正確に保存・復元されること', () => {
    const storage = new MemoryStorage();
    const saveService = new SaveService(storage);

    const state: GameState = {
      day: 14,
      phase: 'night',
      flags: { met_aoi: true, met_shion: true },
      affinities: { aoi: 20, shion: 15 },
      currentScenarioId: null,
      dayStartSnapshot: {
        day: 14,
        flags: { met_aoi: true },
        affinities: { aoi: 15, shion: 10 },
      },
    };

    saveService.saveGame(state);
    const loaded = saveService.loadGame();
    expect(loaded?.gameState).toEqual(state);
  });

  it('最終日を完走したとき、正しくエンディング到達判定（isEnding: true）となること', () => {
    let state: GameState = {
      day: 21,
      phase: 'night',
      flags: {},
      affinities: { aoi: 35, shion: 10 },
      currentScenarioId: null,
      dayStartSnapshot: null,
    };

    const { isEnding } = ScheduleManager.advanceToNextDay(state);
    expect(isEnding).toBe(true);
  });
});
