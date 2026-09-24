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
    // Day 28 は日曜なので休日の行動から始まる
    expect(nextState.phase).toBe('holiday_action');

    // Day 28 -> 就寝でエンディング
    const { isEnding: finalEnding } = ScheduleManager.advanceToNextDay(nextState);
    expect(finalEnding).toBe(true);
  });

  describe('休日（土日）', () => {
    const holidayState = (overrides: Partial<GameState> = {}): GameState => ({
      day: 6,
      phase: 'holiday_action',
      flags: {},
      affinities: {},
      currentScenarioId: null,
      dayStartSnapshot: null,
      ...overrides,
    });

    it('金曜の夜に就寝すると土曜は休日の行動から始まり、行動後は夜になること', () => {
      const friday: GameState = { ...holidayState({ day: 5, phase: 'night' }) };
      const { nextState } = ScheduleManager.advanceToNextDay(friday);
      expect(nextState.day).toBe(6);
      expect(nextState.phase).toBe('holiday_action');
      expect(ScheduleManager.getNextPhase('holiday_action')).toBe('night');

      const { nextState: monday } = ScheduleManager.advanceToNextDay({ ...nextState, day: 7, phase: 'night' });
      expect(monday.day).toBe(8);
      expect(monday.phase).toBe('morning');
    });

    it('休日のやり直しは休日の行動から始まること', () => {
      const rolledBack = ScheduleManager.rollbackToday(
        holidayState({ phase: 'night', dayStartSnapshot: { day: 6, flags: {}, affinities: {} } })
      );
      expect(rolledBack.phase).toBe('holiday_action');
    });

    it('初期の行き先は公園・商店街・映画館・自宅で、フラグで遊園地・水族館が増えること', () => {
      const ids = ScheduleManager.getActionLocationOptions(holidayState()).map((opt) => opt.id);
      expect(ids).toEqual(['park', 'shopping_street', 'cinema', 'home']);

      const unlocked = ScheduleManager.getActionLocationOptions(
        holidayState({ flags: { unlock_amusement_park: true, unlock_aquarium: true } })
      ).map((opt) => opt.id);
      expect(unlocked).toEqual(['park', 'shopping_street', 'cinema', 'home', 'amusement_park', 'aquarium']);
    });

    it('休日の行き先ごとにシナリオが決まり、自宅は休日の汎用シナリオになること', () => {
      const state = holidayState();
      expect(ScheduleManager.getScenarioForLocation('park', state).id).toBe('holiday_park_aoi');
      expect(ScheduleManager.getScenarioForLocation('shopping_street', state).id).toBe('holiday_shopping_emili');
      expect(ScheduleManager.getScenarioForLocation('cinema', state).id).toBe('holiday_cinema_shion');
      expect(ScheduleManager.getScenarioForLocation('home', state).id).toBe('holiday_generic');
      expect(ScheduleManager.getScenarioForLocation('aquarium', state).id).toBe('holiday_aquarium_aoi');
    });

    it('休日には未遭遇キャラの強制イベントが割り込まないこと', () => {
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 13 }))).toBeNull();
    });
  });
});
