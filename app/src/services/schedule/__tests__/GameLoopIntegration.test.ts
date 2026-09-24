import { describe, it, expect } from 'vitest';
import { ScheduleManager } from '../ScheduleManager';
import { ScenarioEngine } from '../../scenario/ScenarioEngine';
import { SaveService } from '../../save/SaveService';
import { GameState } from '../../../types/game';
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

describe('GameLoopIntegration (ゲームループ・28日間コアループ結合テスト)', () => {
  it('Day 1: 朝 → 午前(教室) → 昼(図書室) → 放課後(屋上) → 夜(自室) → 就寝 → Day 2朝へ正常に完走できること', async () => {
    let state: GameState = ScheduleManager.createInitialState();
    expect(state.day).toBe(1);
    expect(state.phase).toBe('morning');

    // 1. 朝シナリオ再生
    const morningScenario = await loadScenario(ScheduleManager.getMorningScenario(state).id);
    const morningEngine = new ScenarioEngine(morningScenario, state.flags, state.affinities);
    while (!morningEngine.isFinished()) {
      morningEngine.next();
    }
    state = {
      ...state,
      flags: morningEngine.getFlags(),
      affinities: morningEngine.getAffinities(),
      phase: ScheduleManager.getNextPhase(state.phase), // -> morning_action
    };
    expect(state.phase).toBe('morning_action');
    expect(state.flags.met_aoi).toBe(true);

    // 2. 午前行動: 教室を選択
    const morningLocScenario = await loadScenario(ScheduleManager.getScenarioForLocation('classroom', state).id);
    const morningLocEngine = new ScenarioEngine(morningLocScenario, state.flags, state.affinities);
    // 選択肢分岐をシミュレート
    morningLocEngine.next();
    if (morningLocEngine.isWaitingForChoice()) {
      morningLocEngine.choose(0); // ノートを貸す
    }
    while (!morningLocEngine.isFinished()) {
      morningLocEngine.next();
    }
    state = {
      ...state,
      flags: morningLocEngine.getFlags(),
      affinities: morningLocEngine.getAffinities(),
      phase: ScheduleManager.getNextPhase(state.phase), // -> lunch_action
    };
    expect(state.phase).toBe('lunch_action');
    expect(state.affinities.aoi).toBe(5);

    // 3. 昼行動: 図書室を選択
    const lunchLocScenario = await loadScenario(ScheduleManager.getScenarioForLocation('library', state).id);
    const lunchLocEngine = new ScenarioEngine(lunchLocScenario, state.flags, state.affinities);
    lunchLocEngine.next();
    lunchLocEngine.next();
    if (lunchLocEngine.isWaitingForChoice()) {
      lunchLocEngine.choose(0); // おすすめの本を聞く
    }
    while (!lunchLocEngine.isFinished()) {
      lunchLocEngine.next();
    }
    state = {
      ...state,
      flags: lunchLocEngine.getFlags(),
      affinities: lunchLocEngine.getAffinities(),
      phase: ScheduleManager.getNextPhase(state.phase), // -> afterschool_action
    };
    expect(state.phase).toBe('afterschool_action');
    expect(state.affinities.shion).toBe(5);

    // 4. 放課後行動: 屋上を選択
    const afterschoolScenario = await loadScenario(ScheduleManager.getScenarioForLocation('rooftop', state).id);
    const afterschoolEngine = new ScenarioEngine(afterschoolScenario, state.flags, state.affinities);
    afterschoolEngine.next();
    afterschoolEngine.next();
    if (afterschoolEngine.isWaitingForChoice()) {
      afterschoolEngine.choose(0);
    }
    while (!afterschoolEngine.isFinished()) {
      afterschoolEngine.next();
    }
    state = {
      ...state,
      flags: afterschoolEngine.getFlags(),
      affinities: afterschoolEngine.getAffinities(),
      phase: ScheduleManager.getNextPhase(state.phase), // -> night
    };
    expect(state.phase).toBe('night');
    expect(state.affinities.emili).toBe(5);

    // 5. 夜の自室: 就寝
    const { nextState, isEnding } = ScheduleManager.advanceToNextDay(state);
    expect(isEnding).toBe(false);
    expect(nextState.day).toBe(2);
    expect(nextState.phase).toBe('morning');
    expect(nextState.affinities.aoi).toBe(5);
    expect(nextState.affinities.shion).toBe(5);
    expect(nextState.affinities.emili).toBe(5);
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

  it('28日目を完走したとき、正しくエンディング到達判定（isEnding: true）となること', () => {
    let state: GameState = {
      day: 28,
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
