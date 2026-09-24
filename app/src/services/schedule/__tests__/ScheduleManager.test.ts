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

  const at = (overrides: Partial<GameState>): GameState => ({ ...ScheduleManager.createInitialState(), ...overrides });

  it('朝シナリオが日付に応じて選ばれること（1日目はプロローグ、特別な日がなければ通常の登校）', () => {
    expect(ScheduleManager.getMorningScenario(at({ day: 1 })).id).toBe('prologue_day1');
    expect(ScheduleManager.getMorningScenario(at({ day: 2 })).id).toBe('morning_d2_door');
    expect(ScheduleManager.getMorningScenario(at({ day: 15 })).id).toBe('morning_d15_dream');
    expect(ScheduleManager.getMorningScenario(at({ day: 11 })).id).toBe('morning_default');
  });

  it('各行動場所に、そこにいるキャラのヒントが出ること', () => {
    const options = ScheduleManager.getActionLocationOptions(at({ day: 1, phase: 'afterschool_action' }));
    const library = options.find((opt) => opt.id === 'library');
    expect(library?.hintCharacterIds).toContain('shion');
    expect(library?.hintText?.ja).toContain('シオン');
  });

  it('物語の節目では強制イベントが割り込むこと', () => {
    expect(ScheduleManager.checkForcedInterruption(at({ day: 1, phase: 'morning_action' }))?.id).toBe('homeroom_day1');
    expect(ScheduleManager.checkForcedInterruption(at({ day: 2, phase: 'morning_action' }))).toBeNull();
    expect(ScheduleManager.checkForcedInterruption(at({ day: 9, phase: 'lunch_action' }))?.id).toBe('blazer_swap');
    // 黒服の襲撃はブレザー交換が済んでいることが前提
    expect(ScheduleManager.checkForcedInterruption(at({ day: 11, phase: 'afterschool_action' }))).toBeNull();
    expect(
      ScheduleManager.checkForcedInterruption(at({ day: 11, phase: 'afterschool_action', flags: { blazer_swapped: true } }))?.id
    ).toBe('black_suits');
  });

  it('アオイのイベントは、前のイベントで正解を選んだ時だけ続くこと（好感度だけでは進まない）', () => {
    const lunch = { day: 2, phase: 'lunch_action' as const };
    expect(ScheduleManager.getScenarioForLocation('library', at({ ...lunch, affinities: { aoi: 99 } })).id).not.toBe('aoi_t2_library');
    expect(ScheduleManager.getScenarioForLocation('library', at({ ...lunch, flags: { aoi_t1_textbook: true } })).id).toBe('aoi_t2_library');
  });

  it('一度見たイベントは繰り返さず、その場所の日常になること', () => {
    const state = at({ day: 1, phase: 'afterschool_action' });
    expect(ScheduleManager.getScenarioForLocation('classroom', state).id).toBe('aoi_t1_textbook');
    const seen = at({ day: 1, phase: 'afterschool_action', flags: { seen_aoi_t1_textbook: true } });
    expect(ScheduleManager.getScenarioForLocation('classroom', seen).id).toBe('daily_classroom');
  });

  describe('エンディング', () => {
    const final = (flags: Record<string, boolean>, aoi: number) => at({ day: 21, phase: 'holiday_action', flags, affinities: { aoi } });
    const TRUE_ROUTE = { aoi_t10_promise: true, confessed: true, confession_sincere: true };

    it('約束と本気の告白に加え、好感度が足りていれば TRUE END になること', () => {
      expect(ScheduleManager.getEndingScenario(final(TRUE_ROUTE, 30))?.id).toBe('ending_true');
    });

    it('好感度が高くても、約束のフラグがなければ TRUE END にはならないこと', () => {
      expect(ScheduleManager.getEndingScenario(final({ confessed: true, confession_sincere: true }, 99))?.id).toBe('ending_good');
    });

    it('フラグがそろっていても、好感度が足りなければ TRUE END にはならないこと', () => {
      expect(ScheduleManager.getEndingScenario(final(TRUE_ROUTE, 10))?.id).toBe('ending_good');
    });

    it('告白に失敗したら BAD END、決着前はエンディングにならないこと', () => {
      expect(ScheduleManager.getEndingScenario(final({ confession_failed: true }, 30))?.id).toBe('ending_bad');
      expect(ScheduleManager.getEndingScenario(final({}, 30))).toBeNull();
    });
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

  it('就寝で翌日へ進み、最終日（Day 21）を超えるとエンディング判定になること', () => {
    const state: GameState = {
      day: 20,
      phase: 'night',
      flags: {},
      affinities: {},
      currentScenarioId: null,
      dayStartSnapshot: null,
    };

    // Day 20 -> Day 21
    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(state);
    expect(isEnding).toBe(false);
    expect(nextState.day).toBe(21);
    // Day 21 は日曜なので休日の行動から始まる
    expect(nextState.phase).toBe('holiday_action');

    // Day 21 -> 就寝でエンディング
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

    it('初期の行き先は公園・商店街・映画館・自宅・神社で、フラグで遊園地・水族館・アオイの家が増えること', () => {
      const ids = ScheduleManager.getActionLocationOptions(holidayState()).map((opt) => opt.id);
      expect(ids).toEqual(['park', 'shopping_street', 'cinema', 'home', 'shrine']);

      const unlocked = ScheduleManager.getActionLocationOptions(
        holidayState({ flags: { unlock_amusement_park: true, unlock_aquarium: true, invited_aoi_house: true } })
      ).map((opt) => opt.id);
      expect(unlocked).toEqual(['park', 'shopping_street', 'cinema', 'home', 'amusement_park', 'aquarium', 'shrine', 'aoi_house']);
    });

    it('休日の行き先ごとにシナリオが決まり、何もなければその場所の日常になること', () => {
      expect(ScheduleManager.getScenarioForLocation('park', holidayState()).id).toBe('daily_park');
      expect(ScheduleManager.getScenarioForLocation('park', holidayState({ flags: { aoi_t3_danish: true } })).id).toBe('aoi_t4_hoodie');
      expect(ScheduleManager.getScenarioForLocation('shopping_street', holidayState()).id).toBe('emili_lottery');
      expect(ScheduleManager.getScenarioForLocation('cinema', holidayState()).id).toBe('shion_cinema');
      expect(ScheduleManager.getScenarioForLocation('home', holidayState()).id).toBe('daily_home');
    });

    it('休日には強制イベントが割り込まず、最終日だけ決着のイベントになること', () => {
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 13 }))).toBeNull();
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 21 }))?.id).toBe('finale_default');
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 21, flags: { aoi_t10_promise: true } }))?.id).toBe('finale_promised');
    });
  });

  describe('夜の電話・メール', () => {
    const night = (day: number, history: GameState['scenarioHistory'] = []): GameState => ({
      ...ScheduleManager.createInitialState(),
      day,
      phase: 'night',
      scenarioHistory: history,
    });
    const summary = (state: GameState) =>
      ScheduleManager.getNightCommunications(state).map((c) => `${c.characterId}:${c.id}${c.done ? '(done)' : ''}`);

    it('条件を満たすものが1人1件ずつ届くこと', () => {
      expect(summary(night(1))).toEqual(['aoi:aoi_mail_d1', 'emili:emili_mail_d1']);
    });

    it('条件のフラグがそろうと、優先度の高いものが届くこと', () => {
      const state = { ...night(20), flags: { aoi_t9_corridor: true } };
      expect(summary(state)[0]).toBe('aoi:aoi_call_d20');
    });

    it('今夜応答したら、同じ人からは他の電話・メールが届かないこと', () => {
      const state = { ...night(20, [{ scenarioId: 'aoi_call_d20', day: 20, type: 'completed' as const }]), flags: { aoi_t9_corridor: true } };
      expect(summary(state)[0]).toBe('aoi:aoi_call_d20(done)');
    });

    it('前の夜に終えたものは届かないこと', () => {
      const state = night(2, [{ scenarioId: 'emili_mail_d1', day: 1, type: 'completed' as const }]);
      expect(summary(state).some((line) => line.startsWith('emili:'))).toBe(false);
    });

    it('期間外のものは届かないこと', () => {
      expect(summary(night(21))).toEqual([]);
    });
  });
});
