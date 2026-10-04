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
  /**
   * シナリオを最後まで進める。選択肢は choiceIds の順に、なければ1番目を選ぶ。
   * choiceIds に 'timeout' を書くと、その選択肢は時間切れにする
   */
  async function play(id: string, state: GameState, choiceIds: string[] = []): Promise<GameState> {
    const scenario = await loadScenario(id);
    const engine = new ScenarioEngine(scenario, state.flags, state.affinities);
    const history = [...(state.scenarioHistory ?? [])];
    const wanted = [...choiceIds];
    for (let guard = 0; !engine.isFinished() && guard < 500; guard++) {
      if (engine.isWaitingForChoice()) {
        const choices = engine.getAvailableChoices();
        const next = wanted[0];
        if (next) wanted.shift();
        if (next === 'timeout') {
          engine.timeout();
          continue;
        }
        const index = next ? choices.findIndex((c) => (c.id ?? c.goto) === next) : 0;
        expect(index, `${id}: 選択肢 ${next} が選べない（${choices.map((c) => c.id).join(', ')}）`).toBeGreaterThanOrEqual(0);
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

  /** 強制イベントが割り込むことを確かめて再生 */
  async function forced(state: GameState, expectedId: string, choiceIds: string[] = []) {
    expect(ScheduleManager.checkForcedInterruption(state)?.id).toBe(expectedId);
    return play(expectedId, state, choiceIds);
  }

  const on = (state: GameState, day: number, phase: GameState['phase']): GameState => ({ ...state, day, phase });

  /** Day 1〜10 でアオイと過ごし、Day 11 にアオイルートへ入る（careless なら◎を外し続ける） */
  async function enterAoiRoute(careless = false): Promise<GameState> {
    const pick = (good: string, bad: string) => [careless ? bad : good];
    let s: GameState = ScheduleManager.createInitialState();
    s = await play(ScheduleManager.getMorningScenario(s).id, s, ['prologue_c1']);
    s = await visit(on(s, 1, 'afterschool_action'), 'classroom', 'aoi_d01_classroom', pick('aoi_d01_catch', 'aoi_d01_mop'));
    s = await visit(on(s, 2, 'lunch_action'), 'library', 'aoi_d02_library', pick('aoi_d02_changed', 'aoi_d02_muscle'));
    s = await play('aoi_d03_door', on(s, 3, 'afterschool_action'), pick('aoi_d03_ceiling', 'aoi_d03_stare'));
    s = await visit(on(s, 4, 'lunch_action'), 'cafeteria', 'aoi_d04_rooftop', pick('aoi_d04_sugar', 'aoi_d04_finger'));
    s = await play('aoi_d05_stairs', on(s, 5, 'morning'), pick('aoi_d05_sky', 'aoi_d05_look'));
    s = await visit(on(s, 6, 'holiday_action'), 'park', 'aoi_d06_park', pick('aoi_d06_hoodie', 'aoi_d06_home'));
    s = await visit(on(s, 8, 'afterschool_action'), 'sports_ground', 'aoi_d08_ground', pick('aoi_d08_water', 'aoi_d08_freeze'));
    s = await forced(on(s, 11, 'morning_action'), 'common_d11_button', ['route_aoi']);
    expect(s.flags.route_aoi).toBe(true);
    return s;
  }

  /** Day 11〜21 のアオイルート（★を取るかどうかを選べる） */
  async function playAoiRoute(s: GameState, stars: { c08: boolean; c09: boolean }, finaleChoice: string): Promise<GameState> {
    s = await forced(on(s, 11, 'lunch_action'), 'aoi_d11_lunch', ['aoi_d11_promise']);
    s = await forced(on(s, 11, 'afterschool_action'), 'aoi_d11_gate', ['aoi_d11_run']);
    s = await forced(s, 'aoi_d11_gym');
    s = await play('aoi_d12_morning', on(s, 12, 'morning'), ['aoi_d12_slow']);
    s = { ...s, flags: { ...s.flags, invited_aoi_house: true } };
    s = await forced(on(s, 13, 'holiday_action'), 'aoi_d13_house', [stars.c08 ? 'aoi_d13_honest' : 'aoi_d13_bug']);
    s = await play('aoi_d15_classroom', on(s, 15, 'morning'), ['aoi_d15_stop']);
    s = await play('aoi_d16_rain', on(s, 16, 'afterschool_action'), [stars.c09 ? 'aoi_d16_umbrella' : 'aoi_d16_seen']);
    s = await visit(on(s, 18, 'lunch_action'), 'classroom', 'aoi_d19_ticket', ['aoi_d19_thanks']);
    s = await visit(on(s, 20, 'holiday_action'), 'amusement_park', 'aoi_d20_amusement', ['aoi_d20_back']);
    return forced(on(s, 21, 'holiday_action'), 'aoi_d21_finale', [finaleChoice]);
  }

  it('Day 1: プロローグ → 放課後の教室 → 就寝で Day 2 の朝へ進めること', async () => {
    let state: GameState = ScheduleManager.createInitialState();
    expect(ScheduleManager.getMorningScenario(state).id).toBe('prologue_day1');
    state = await play('prologue_day1', state, ['prologue_c1']);
    state = await visit(on(state, 1, 'afterschool_action'), 'classroom', 'aoi_d01_classroom', ['aoi_d01_catch']);
    expect(state.flags.aoi_c01).toBe(true);

    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(on(state, 1, 'night'));
    expect(isEnding).toBe(false);
    expect(nextState.day).toBe(2);
    expect(nextState.phase).toBe('morning');
    expect(nextState.affinities.aoi).toBe(4);
  });

  it('アオイと過ごすと Day 11 でアオイルートの選択肢が出て、★を2つ取って「好きだ」で TRUE END になること', async () => {
    let state = await enterAoiRoute();
    state = await playAoiRoute(state, { c08: true, c09: true }, 'aoi_finale_love');
    expect(state.flags.aoi_c08 && state.flags.aoi_c09).toBe(true);
    expect(ScheduleManager.getEndingScenario(state)?.id).toBe('ending_aoi_true');
  });

  it('★が1つ欠けると「好きだ」でも GOOD END になること', async () => {
    let state = await enterAoiRoute();
    state = await playAoiRoute(state, { c08: true, c09: false }, 'aoi_finale_love');
    expect(ScheduleManager.getEndingScenario(state)?.id).toBe('ending_aoi_good');
  });

  it('5秒の告白で時間切れになると BAD END になること', async () => {
    let state = await enterAoiRoute();
    state = await playAoiRoute(state, { c08: true, c09: true }, 'timeout');
    expect(ScheduleManager.getEndingScenario(state)?.id).toBe('ending_aoi_bad');
  });

  it('GOOD END の女神の一言は、「好きだ」と「隣にいたい」で変わること', async () => {
    const scenario = await loadScenario('ending_aoi_good');
    const firstLine = (flags: Record<string, boolean>) => new ScenarioEngine(scenario, flags, {}).getCurrentScene()?.text;
    expect(firstLine({ finale_love: true, finale_answered: true })).toContain('まだ答えを出せない');
    expect(firstLine({ finale_stay: true, finale_answered: true })).toContain('激しさには欠けますが');
  });

  it('好感度が足りないと★の選択肢は出ないこと', async () => {
    const scenario = await loadScenario('aoi_d13_house');
    const choicesAt = (aoi: number) => {
      const engine = new ScenarioEngine(scenario, {}, { aoi });
      while (!engine.isWaitingForChoice()) engine.next();
      return engine.getAvailableChoices().map((c) => c.id);
    };
    expect(choicesAt(13)).toEqual(['aoi_d13_bug']);
    expect(choicesAt(14)).toEqual(['aoi_d13_honest', 'aoi_d13_bug']);
  });

  it('Day 11 で誰の好感度も基準に届かなければ、いちばん高いヒロインの選択肢だけが出ること', async () => {
    const scenario = await loadScenario('common_d11_button');
    const choicesAt = (affinities: Record<string, number>) => {
      const engine = new ScenarioEngine(scenario, {}, affinities);
      while (!engine.isWaitingForChoice()) engine.next();
      return engine.getAvailableChoices().map((c) => c.id);
    };
    expect(choicesAt({ aoi: 3, emili: 5, shion: 1 })).toEqual(['route_emili']);
    expect(choicesAt({ aoi: 9, emili: 8, shion: 2 })).toEqual(['route_aoi', 'route_emili']);
  });

  /** エミリと過ごして Day 11 にエミリルートへ入り、Day 21 の告白まで進める */
  async function playEmiliRoute(stars: { c09: boolean; c10: boolean }, finaleChoice: string): Promise<GameState> {
    let s: GameState = ScheduleManager.createInitialState();
    s = await play('prologue_day1', s, ['prologue_c1']);
    expect(ScheduleManager.checkEveningEvent(on(s, 1, 'afterschool_action'))?.id).toBe('emili_d01_gate');
    s = await play('emili_d01_gate', on(s, 1, 'afterschool_action'), ['emili_d01_lead']);
    s = await visit(on(s, 3, 'lunch_action'), 'cafeteria', 'emili_d03_cafeteria', ['emili_d03_pay']);
    s = await visit(on(s, 4, 'afterschool_action'), 'classroom', 'emili_d04_dagashi', ['emili_d04_anko']);
    s = await visit(on(s, 6, 'holiday_action'), 'shopping_street', 'emili_d07_gamecenter', ['emili_d07_me']);
    s = await visit(on(s, 8, 'afterschool_action'), 'classroom', 'emili_d09_cleaning', ['emili_d09_teach']);
    s = await forced(on(s, 11, 'morning_action'), 'common_d11_button', ['route_emili']);
    s = await forced(on(s, 11, 'lunch_action'), 'emili_d11_sewing', ['emili_d11_care']);
    s = await forced(on(s, 11, 'afterschool_action'), 'emili_d11_raid', ['emili_d11_charge']);
    s = await forced(s, 'emili_d11_gym', ['emili_d11_slide']);
    s = await play('emili_d12_gate', on(s, 12, 'morning'), ['emili_d12_fun']);
    s = await forced(on(s, 13, 'holiday_action'), 'emili_d13_burger', ['emili_d13_lady']);
    s = await play('emili_d15_classroom', on(s, 15, 'morning'), [stars.c09 ? 'emili_d15_sit' : 'emili_d15_fine']);
    s = await play('emili_d17_rain', on(s, 16, 'afterschool_action'), [stars.c10 ? 'emili_d17_umbrella' : 'emili_d17_serious']);
    s = await visit(on(s, 20, 'holiday_action'), 'park', 'emili_d20_park', ['emili_d20_just']);
    return forced(on(s, 21, 'holiday_action'), 'emili_d21_finale', [finaleChoice]);
  }

  /** シオンと過ごして Day 11 にシオンルートへ入り、Day 21 の告白まで進める */
  async function playShionRoute(stars: { c08: boolean; trust: boolean }, finaleChoice: string): Promise<GameState> {
    let s: GameState = ScheduleManager.createInitialState();
    s = await play('prologue_day1', s, ['prologue_c1']);
    s = await visit(on(s, 1, 'afterschool_action'), 'library', 'shion_d01_library', ['shion_d01_honest']);
    s = await visit(on(s, 3, 'afterschool_action'), 'library', 'shion_d03_library', ['shion_d03_clean']);
    s = await visit(on(s, 6, 'holiday_action'), 'shopping_street', 'shion_d06_parfait', ['shion_d06_human']);
    s = await visit(on(s, 7, 'holiday_action'), 'shrine', 'shion_d07_shrine', ['shion_d07_jacket']);
    s = await visit(on(s, 8, 'afterschool_action'), 'library', 'shion_d09_ladder', ['shion_d09_hurt']);
    s = await forced(on(s, 11, 'morning_action'), 'common_d11_button', ['route_shion']);
    s = await forced(on(s, 11, 'afterschool_action'), 'shion_d11_kura', ['shion_d11_penlight']);
    s = await forced(on(s, 13, 'holiday_action'), 'shion_d13_cafe', ['shion_d13_tasty']);
    s = await forced(on(s, 15, 'afterschool_action'), 'shion_d15_reveal', [stars.c08 ? 'shion_d15_yes' : 'shion_d15_silent']);
    s = await play('shion_d17_room', on(s, 16, 'afterschool_action'), ['shion_d17_know']);
    s = await play('shion_d18_teacher', on(s, 18, 'afterschool_action'), ['shion_d18_thanks']);
    s = await forced(on(s, 20, 'holiday_action'), 'shion_d20_shrine', ['shion_d20_pray']);
    // 夜の電話（★）は通話なので、選んだ結果だけを反映する
    s = {
      ...s,
      flags: { ...s.flags, shion_promise: true, ...(stars.trust && (s.affinities.shion ?? 0) >= 19 ? { shion_trust: true } : {}) },
    };
    return forced(on(s, 21, 'holiday_action'), 'shion_d21_finale', [finaleChoice]);
  }

  it('エミリルート：★2つで TRUE、★が欠ければ GOOD、時間切れで BAD になること', async () => {
    expect(ScheduleManager.getEndingScenario(await playEmiliRoute({ c09: true, c10: true }, 'emili_finale_love'))?.id).toBe('ending_emili_true');
    expect(ScheduleManager.getEndingScenario(await playEmiliRoute({ c09: false, c10: true }, 'emili_finale_love'))?.id).toBe('ending_emili_good');
    expect(ScheduleManager.getEndingScenario(await playEmiliRoute({ c09: true, c10: true }, 'timeout'))?.id).toBe('ending_emili_bad');
  });

  it('シオンルート：★2つで TRUE、「隣で調べ物を」は GOOD になること', async () => {
    const trueRoute = await playShionRoute({ c08: true, trust: true }, 'shion_finale_love');
    expect(trueRoute.flags.shion_trust).toBe(true);
    expect(ScheduleManager.getEndingScenario(trueRoute)?.id).toBe('ending_shion_true');
    expect(ScheduleManager.getEndingScenario(await playShionRoute({ c08: true, trust: true }, 'shion_finale_stay'))?.id).toBe('ending_shion_good');
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
