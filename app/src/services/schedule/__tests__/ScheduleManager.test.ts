import { describe, it, expect } from 'vitest';
import { ScheduleManager } from '../ScheduleManager';
import { GameState, ScenarioHistoryEntry } from '../../../types/game';

describe('ScheduleManager (ゲームループ・スケジュール管理)', () => {
  it('初期状態が正しく生成されること', () => {
    const state = ScheduleManager.createInitialState();
    expect(state.day).toBe(1);
    expect(state.phase).toBe('morning');
    expect(state.dayStartSnapshot?.day).toBe(1);
    expect(state.dayStartSnapshot?.flags).toEqual({});
  });

  const at = (overrides: Partial<GameState>): GameState => ({ ...ScheduleManager.createInitialState(), ...overrides });
  const done = (...ids: string[]): ScenarioHistoryEntry[] => ids.map((scenarioId) => ({ scenarioId, day: 1, type: 'completed' }));

  it('1日目の朝はプロローグ、ほかの日は条件に合う朝のイベント（なければいつもの登校）になること', () => {
    expect(ScheduleManager.getMorningScenario(at({ day: 1 })).id).toBe('prologue_day1');
    expect(ScheduleManager.getMorningScenario(at({ day: 5, scenarioHistory: done('aoi_d04_rooftop') })).id).toBe('aoi_d05_stairs');
    // 日常の朝をすべて見終えたら、いつもの登校
    const allSeen = done('daily_taka_alkaline', 'daily_town_dirt', 'daily_balcony_aoi');
    expect(ScheduleManager.getMorningScenario(at({ day: 4, scenarioHistory: allSeen })).id).toBe('morning_default');
  });

  it('一度見たイベントは繰り返さず、次のイベントやその場所の日常になること', () => {
    const state = at({ day: 1, phase: 'afterschool_action', scenarioHistory: done('prologue_day1') });
    expect(ScheduleManager.getScenarioForLocation('classroom', state).id).toBe('aoi_d01_classroom');
    const seen = { ...state, scenarioHistory: done('prologue_day1', 'aoi_d01_classroom') };
    expect(ScheduleManager.getScenarioForLocation('classroom', seen).id).not.toBe('aoi_d01_classroom');
    // 汎用シナリオ（その場所の日常）は何度でも選ばれる
    const sportsGround = at({ day: 2, phase: 'lunch_action', scenarioHistory: done('daily_sports_ground') });
    expect(ScheduleManager.getScenarioForLocation('sports_ground', sportsGround).id).toBe('daily_sports_ground');
  });

  it('行動場所に、そこで起きるイベントのキャラのヒントが出ること', () => {
    const options = ScheduleManager.getActionLocationOptions(at({ day: 1, phase: 'afterschool_action', scenarioHistory: done('prologue_day1') }));
    const classroom = options.find((opt) => opt.id === 'classroom');
    expect(classroom?.hintCharacterIds).toContain('aoi');
    expect(classroom?.hintText?.ja).toContain('アオイ');
  });

  it('Day 11 の午前の前に、ルート分岐の強制イベントが割り込むこと', () => {
    expect(ScheduleManager.checkForcedInterruption(at({ day: 11, phase: 'morning_action' }))?.id).toBe('common_d11_button');
    expect(ScheduleManager.checkForcedInterruption(at({ day: 10, phase: 'morning_action' }))).toBeNull();
    // 一度見たら割り込まない
    expect(ScheduleManager.checkForcedInterruption(at({ day: 11, phase: 'morning_action', scenarioHistory: done('common_d11_button') }))).toBeNull();
  });

  it('アオイルートでは Day 11 の昼・放課後に強制イベントが続くこと', () => {
    const flags = { route_aoi: true };
    expect(ScheduleManager.checkForcedInterruption(at({ day: 11, phase: 'lunch_action', flags }))?.id).toBe('aoi_d11_lunch');
    const gate = at({ day: 11, phase: 'afterschool_action', flags });
    expect(ScheduleManager.checkForcedInterruption(gate)?.id).toBe('aoi_d11_gate');
    expect(ScheduleManager.checkForcedInterruption({ ...gate, scenarioHistory: done('aoi_d11_gate') })?.id).toBe('aoi_d11_gym');
    // ルートが違えば起きない
    expect(ScheduleManager.checkForcedInterruption(at({ day: 11, phase: 'lunch_action' }))).toBeNull();
  });

  it('下校時の強制イベントは、放課後の行動を終えたときだけ選ばれること', () => {
    const state = at({ day: 3, phase: 'afterschool_action', scenarioHistory: done('aoi_d02_library') });
    expect(ScheduleManager.checkEveningEvent(state)?.id).toBe('aoi_d03_door');
    // 行動ターンの開始では割り込まない
    expect(ScheduleManager.checkForcedInterruption(state)).toBeNull();
  });

  it('雨の日だけ起きるイベントがあること', () => {
    // Day 9 は雨（data/calendar.ts）
    expect(ScheduleManager.checkEveningEvent(at({ day: 9, phase: 'afterschool_action' }))?.id).toBe('daily_rain_limo');
    expect(ScheduleManager.checkEveningEvent(at({ day: 8, phase: 'afterschool_action' }))).toBeNull();
  });

  describe('エンディング', () => {
    const final = (flags: Record<string, boolean>) => at({ day: 21, phase: 'holiday_action', flags });

    it('「好きだ」と★が2つそろえば TRUE END になること', () => {
      const flags = { route_aoi: true, finale_love: true, finale_answered: true, aoi_c08: true, aoi_c09: true };
      expect(ScheduleManager.getEndingScenario(final(flags))?.id).toBe('ending_aoi_true');
    });

    it('★が足りなければ「好きだ」でも GOOD END、「隣にいたい」も GOOD END になること', () => {
      expect(ScheduleManager.getEndingScenario(final({ route_aoi: true, finale_love: true, finale_answered: true, aoi_c08: true }))?.id).toBe(
        'ending_aoi_good'
      );
      expect(ScheduleManager.getEndingScenario(final({ route_aoi: true, finale_stay: true, finale_answered: true, aoi_c08: true, aoi_c09: true }))?.id).toBe(
        'ending_aoi_good'
      );
    });

    it('時間切れで BAD END、決着前はエンディングにならないこと', () => {
      expect(ScheduleManager.getEndingScenario(final({ route_aoi: true, finale_timeout: true }))?.id).toBe('ending_aoi_bad');
      expect(ScheduleManager.getEndingScenario(final({ route_aoi: true, aoi_c08: true, aoi_c09: true }))).toBeNull();
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

    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(state);
    expect(isEnding).toBe(false);
    expect(nextState.day).toBe(21);
    // Day 21 は日曜なので休日の行動から始まる
    expect(nextState.phase).toBe('holiday_action');

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
      expect(ScheduleManager.getScenarioForLocation('park', holidayState({ scenarioHistory: done('aoi_d02_library') })).id).toBe('aoi_d06_park');
      expect(ScheduleManager.getScenarioForLocation('home', holidayState()).id).toBe('daily_home_sneaker');
      expect(ScheduleManager.getScenarioForLocation('home', holidayState({ scenarioHistory: done('daily_home_sneaker') })).id).toBe('daily_home');
    });

    it('招待された土曜はアオイの家、最終日は決着のイベントが割り込むこと', () => {
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 13 }))).toBeNull();
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 13, flags: { invited_aoi_house: true } }))?.id).toBe('aoi_d13_house');
      expect(ScheduleManager.checkForcedInterruption(holidayState({ day: 21, flags: { route_aoi: true } }))?.id).toBe('aoi_d21_finale');
    });
  });

  describe('夜の電話・メール', () => {
    const night = (day: number, history: GameState['scenarioHistory'] = [], flags: GameState['flags'] = {}): GameState => ({
      ...ScheduleManager.createInitialState(),
      day,
      phase: 'night',
      scenarioHistory: history,
      flags,
    });
    const summary = (state: GameState) =>
      ScheduleManager.getNightCommunications(state).map((c) => `${c.characterId}:${c.id}${c.done ? '(done)' : ''}`);

    it('条件を満たすものが1人1件ずつ届くこと', () => {
      expect(summary(night(2, done('prologue_day1')))).toEqual(['aoi:aoi_call_kairanban']);
    });

    it('ルートの電話・メールは、ほかの連絡より優先されること', () => {
      expect(summary(night(20, done('prologue_day1', 'aoi_d02_library'), { route_aoi: true }))[0]).toBe('aoi:aoi_d20_call');
    });

    it('今夜応答したら、同じ人からは他の電話・メールが届かないこと', () => {
      const history: ScenarioHistoryEntry[] = [...done('prologue_day1'), { scenarioId: 'aoi_call_kairanban', day: 2, type: 'completed' }];
      expect(summary(night(2, history))).toEqual(['aoi:aoi_call_kairanban(done)']);
    });

    it('前の夜に終えたものは届かないこと', () => {
      const history: ScenarioHistoryEntry[] = [...done('prologue_day1'), { scenarioId: 'aoi_call_kairanban', day: 2, type: 'completed' }];
      expect(summary(night(3, history))).toEqual(['aoi:aoi_mail_photo']);
    });
  });
});
