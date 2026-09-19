import { describe, it, expect } from 'vitest';
import { ScheduleManager } from '../ScheduleManager';
import { GameState } from '../../../types/game';

describe('ScheduleManager (ゲームループ・スケジュール管理)', () => {
  it('初期状態が正しく生成されること', () => {
    const state = ScheduleManager.createInitialState();
    expect(state.day).toBe(1);
    expect(state.phase).toBe('morning');
    expect(state.dayStartSnapshot?.day).toBe(1);
    expect(state.dayStartSnapshot?.flags).toEqual({});
  });

  it('朝シナリオが日付に応じて適切に取得できること', () => {
    const day1State = ScheduleManager.createInitialState();
    const scenario1 = ScheduleManager.getMorningScenario(day1State);
    expect(scenario1.id).toBe('morning_day_1');

    const day2State: GameState = { ...day1State, day: 2 };
    const scenario2 = ScheduleManager.getMorningScenario(day2State);
    expect(scenario2.id).toBe('morning_default');
  });

  it('各行動場所の事前情報（ヒント・滞在キャラ）が生成されること', () => {
    const state = ScheduleManager.createInitialState();
    const options = ScheduleManager.getActionLocationOptions(state);

    expect(options.length).toBeGreaterThan(0);
    const libraryOpt = options.find((opt) => opt.id === 'library');
    expect(libraryOpt).toBeDefined();
    expect(libraryOpt?.hintCharacterIds).toContain('shion');
    expect(libraryOpt?.hintText?.ja).toContain('シオン');
  });

  it('未遭遇キャラ救済（強制割り込みイベント）が正しく判定されること', () => {
    // Day 1: 強制イベントなし
    const day1State = ScheduleManager.createInitialState();
    expect(ScheduleManager.checkForcedInterruption(day1State)).toBeNull();

    // Day 2 morning_action でシオン未遭遇: 強制遭遇イベント発生
    const day2State: GameState = {
      ...day1State,
      day: 2,
      phase: 'morning_action',
      flags: {},
    };
    const forced = ScheduleManager.checkForcedInterruption(day2State);
    expect(forced).not.toBeNull();
    expect(forced?.id).toBe('forced_meet_shion');

    // 既に会っている場合は発生しない
    const metState: GameState = {
      ...day2State,
      flags: { met_shion: true },
    };
    expect(ScheduleManager.checkForcedInterruption(metState)).toBeNull();
  });

  it('場所に応じたシナリオが返されること', () => {
    const state = ScheduleManager.createInitialState();
    const scenario = ScheduleManager.getScenarioForLocation('library', state);
    expect(scenario.id).toBe('action_library_shion');
  });

  it('フェーズが正しく順番に遷移すること', () => {
    expect(ScheduleManager.getNextPhase('morning')).toBe('morning_action');
    expect(ScheduleManager.getNextPhase('morning_action')).toBe('lunch_action');
    expect(ScheduleManager.getNextPhase('lunch_action')).toBe('afterschool_action');
    expect(ScheduleManager.getNextPhase('afterschool_action')).toBe('night');
    expect(ScheduleManager.getNextPhase('night')).toBe('morning');
  });

  it('1日のやり直しで当日の朝の状態に巻き戻ること', () => {
    const state: GameState = {
      day: 3,
      phase: 'night',
      flags: { todayActionDone: true, extraFlag: 123 },
      affinities: { aoi: 20 },
      currentScenarioId: null,
      dayStartSnapshot: {
        day: 3,
        flags: { initialMorningFlag: true },
        affinities: { aoi: 5 },
      },
    };

    const rolledBack = ScheduleManager.rollbackToday(state);
    expect(rolledBack.day).toBe(3);
    expect(rolledBack.phase).toBe('morning');
    expect(rolledBack.flags).toEqual({ initialMorningFlag: true });
    expect(rolledBack.affinities).toEqual({ aoi: 5 });
  });

  it('就寝で翌日へ進み、Day 28を超えるとエンディング判定になること', () => {
    const state: GameState = {
      day: 27,
      phase: 'night',
      flags: {},
      affinities: {},
      currentScenarioId: null,
      dayStartSnapshot: null,
    };

    // Day 27 -> Day 28
    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(state);
    expect(isEnding).toBe(false);
    expect(nextState.day).toBe(28);
    expect(nextState.phase).toBe('morning');

    // Day 28 -> 就寝でエンディング
    const { isEnding: finalEnding } = ScheduleManager.advanceToNextDay(nextState);
    expect(finalEnding).toBe(true);
  });

  it('好感度に応じたエンディングシナリオが選択されること', () => {
    const stateAoi: GameState = {
      ...ScheduleManager.createInitialState(),
      affinities: { aoi: 25, shion: 5 },
    };
    expect(ScheduleManager.getEndingScenario(stateAoi).id).toBe('ending_aoi');

    const stateShion: GameState = {
      ...ScheduleManager.createInitialState(),
      affinities: { aoi: 5, shion: 30 },
    };
    expect(ScheduleManager.getEndingScenario(stateShion).id).toBe('ending_shion');

    const stateLow: GameState = {
      ...ScheduleManager.createInitialState(),
      affinities: { aoi: 2, shion: 3 },
    };
    expect(ScheduleManager.getEndingScenario(stateLow).id).toBe('ending_normal');
  });
});
