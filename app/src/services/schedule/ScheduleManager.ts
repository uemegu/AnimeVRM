import {
  GameState,
  DayPhase,
  ActionLocationId,
  ActionLocationOption,
  isHoliday,
  FINAL_DAY,
} from '../../types/game';
import { ScenarioCategory, ScenarioIndexEntry, ScenarioMeta, ScenarioTimeSlot } from '../../types/scenario';
import { HeroineId, NightCommunication } from '../../types/communication';
import {
  LOCATION_DEFINITIONS,
  SCHOOL_ACTION_LOCATIONS,
  HOLIDAY_ACTION_LOCATIONS,
} from '../../data/locations';
import { scenarioRepository } from '../scenario/ScenarioRepository';

/**
 * シナリオの選択はすべて目次（メタ情報）だけで行う。
 * 戻り値の本文は scenarioRepository.load(id) で読み込むこと。
 */

export class ScheduleManager {
  /**
   * 初期ゲーム状態を生成
   */
  public static createInitialState(): GameState {
    const initialDay = 1;
    const initialFlags = {};
    const initialAffinities = {};
    const state: GameState = {
      day: initialDay,
      phase: 'morning',
      flags: initialFlags,
      affinities: initialAffinities,
      scenarioHistory: [],
      currentScenarioId: null,
      dayStartSnapshot: {
        day: initialDay,
        flags: { ...initialFlags },
        affinities: { ...initialAffinities },
        scenarioHistory: [],
      },
    };
    state.currentScenarioId = this.getMorningScenario(state).id;
    return state;
  }

  /**
   * 1日の開始フェーズ（平日は朝の登校イベント、土日は昼の休日行動から始まる）
   */
  public static getDayStartPhase(day: number): DayPhase {
    return isHoliday(day) ? 'holiday_action' : 'morning';
  }

  /**
   * 朝フェーズのシナリオを取得
   */
  public static getMorningScenario(gameState: GameState): ScenarioIndexEntry {
    return this.selectScenario('morning', gameState);
  }

  /**
   * 行動ターンにおける各場所の事前情報（滞在キャラ・ヒント文）を生成
   * シナリオデータ（ScenarioPackage.actionHints）から情報を解決
   */
  public static getActionLocationOptions(gameState: GameState): ActionLocationOption[] {
    const locations: ActionLocationId[] =
      gameState.phase === 'holiday_action'
        ? HOLIDAY_ACTION_LOCATIONS
            .filter((location) => !location.unlockFlag || Boolean(gameState.flags[location.unlockFlag]))
            .map((location) => location.id)
        : SCHOOL_ACTION_LOCATIONS;

    return locations.map((locId) => {
      const base = LOCATION_DEFINITIONS[locId];
      let hintCharacterIds: string[] = [];
      let hintText: { ja: string; en?: string } | undefined;

      const selectedScenario = this.getEligibleActionScenarios(locId, gameState)[0];
      const matchingHint = selectedScenario?.actionHints?.find((hint) => {
        if (hint.locationId !== locId) return false;
        return !hint.phases || hint.phases.includes(gameState.phase);
      });

      if (matchingHint?.hintCharacterIds) {
        hintCharacterIds = [...matchingHint.hintCharacterIds];
      }
      if (matchingHint?.hintText) {
        hintText = matchingHint.hintText;
      }

      return {
        ...base,
        hintCharacterIds,
        hintText,
      };
    });
  }

  /**
   * 日中の強制割り込みイベントがあるかチェック
   * 未遭遇のキャラ救済イベント等を判定
   */
  public static checkForcedInterruption(gameState: GameState): ScenarioIndexEntry | null {
    return this.getEligibleScenarios(['forced'], gameState)[0] ?? null;
  }

  /**
   * 今夜ヒロインから届く電話・メール（1人につき1件まで）
   * - 今夜すでに応答・拒否・既読にしたものがあれば、その人からは他に届かない
   * - なければ、条件を満たし未完了のものから優先度の高いもの（同値なら電話→メール、目次順）
   */
  public static getNightCommunications(gameState: GameState): NightCommunication[] {
    const history = gameState.scenarioHistory ?? [];
    const isCompleted = (id: string, onDay?: number) =>
      history.some(
        (entry) => entry.scenarioId === id && entry.type === 'completed' && (onDay === undefined || entry.day === onDay)
      );
    const communications = this.getEligibleScenarios(['call', 'mail'], gameState, undefined, true);
    const all = [...scenarioRepository.list('call'), ...scenarioRepository.list('mail')];

    const result: NightCommunication[] = [];
    const heroines = new Set(all.map((entry) => entry.characterId).filter((id): id is HeroineId => Boolean(id)));
    for (const characterId of heroines) {
      const doneTonight = all.find((entry) => entry.characterId === characterId && isCompleted(entry.id, gameState.day));
      const selected =
        doneTonight ??
        communications.find((entry) => entry.characterId === characterId && !isCompleted(entry.id));
      if (!selected) continue;
      result.push({
        kind: selected.category === 'call' ? 'call' : 'mail',
        id: selected.id,
        characterId,
        previewText: selected.previewText,
        time: selected.time,
        done: Boolean(doneTonight),
      });
    }
    return result;
  }

  /**
   * 条件を満たすエンディング（決着のシナリオが立てたフラグ等で決まる）。なければ null
   */
  public static getEndingScenario(gameState: GameState): ScenarioIndexEntry | null {
    const played = new Set((gameState.scenarioHistory ?? []).map((entry) => entry.scenarioId));
    return (
      this.getEligibleScenarios(['ending'], gameState, undefined, true).find(
        (scenario) => !scenario.fallback && !played.has(scenario.id)
      ) ?? null
    );
  }

  /**
   * 選択された場所に応じたシナリオを決定（ScenarioMeta.actionHints / availability より解決）
   */
  public static getScenarioForLocation(locationId: ActionLocationId, gameState: GameState): ScenarioIndexEntry {
    return (
      this.getEligibleActionScenarios(locationId, gameState)[0] ??
      this.getFallbackScenario(gameState.phase === 'holiday_action' ? 'holiday' : 'action')
    );
  }

  /** 条件に合う最優先のシナリオ。なければその種類の汎用シナリオ（fallback） */
  private static selectScenario(category: ScenarioCategory, gameState: GameState): ScenarioIndexEntry {
    return this.getEligibleScenarios([category], gameState)[0] ?? this.getFallbackScenario(category);
  }

  private static getFallbackScenario(category: ScenarioCategory): ScenarioIndexEntry {
    const fallback = scenarioRepository.list(category).find((scenario) => scenario.fallback);
    if (!fallback) throw new Error(`No fallback scenario for category: ${category}`);
    return fallback;
  }

  /** 行動フェーズで選ばれ得るシナリオ（場所ヒント表示用）を優先順位順で返す */
  private static getEligibleActionScenarios(locationId: ActionLocationId, gameState: GameState): ScenarioIndexEntry[] {
    return this.getEligibleScenarios(['action', 'holiday'], gameState, locationId);
  }

  /** 条件に一致するシナリオを優先順位順で返す（汎用シナリオは最後、同優先度は目次順） */
  private static getEligibleScenarios(
    categories: ScenarioCategory[],
    gameState: GameState,
    locationId?: ActionLocationId,
    ignoreTimeSlots = false
  ): ScenarioIndexEntry[] {
    return categories
      .flatMap((category) => scenarioRepository.list(category))
      .map((scenario, index) => ({ scenario, index }))
      .filter(({ scenario }) => this.matchesScenarioAvailability(scenario, gameState, locationId, ignoreTimeSlots))
      .sort((a, b) => {
        const priorityDifference = this.getScenarioPriority(b.scenario) - this.getScenarioPriority(a.scenario);
        return priorityDifference || a.index - b.index;
      })
      .map(({ scenario }) => scenario);
  }

  private static getScenarioPriority(scenario: ScenarioMeta): number {
    return scenario.fallback ? Number.NEGATIVE_INFINITY : scenario.priority ?? 0;
  }

  /** シナリオの日付・時間帯・場所・フラグ・進行履歴条件を判定 */
  private static matchesScenarioAvailability(
    scenario: ScenarioMeta,
    gameState: GameState,
    locationId?: ActionLocationId,
    ignoreTimeSlots = false
  ): boolean {
    const availability = scenario.availability;
    if (availability?.requireFlags?.some((flag) => !gameState.flags[flag])) return false;
    if (availability?.unlessFlags?.some((flag) => Boolean(gameState.flags[flag]))) return false;
    const affinityOf = (charId: string) => gameState.affinities[charId] ?? 0;
    if (Object.entries(availability?.minAffinity ?? {}).some(([charId, min]) => affinityOf(charId) < min)) return false;
    if (Object.entries(availability?.maxAffinity ?? {}).some(([charId, max]) => affinityOf(charId) >= max)) return false;
    const dayRange = availability?.dayRange;
    if (dayRange?.from !== undefined && gameState.day < dayRange.from) return false;
    if (dayRange?.to !== undefined && gameState.day > dayRange.to) return false;

    const locationHints = locationId
      ? scenario.actionHints?.filter((hint) => hint.locationId === locationId) ?? []
      : [];
    if (availability?.locations) {
      if (!locationId || !availability.locations.includes(locationId)) return false;
    } else if (locationId && scenario.actionHints?.length && locationHints.length === 0) {
      return false;
    }
    if (locationId && !availability?.timeSlots && locationHints.length > 0) {
      const matchesLegacyPhase = locationHints.some(
        (hint) => !hint.phases || hint.phases.includes(gameState.phase)
      );
      if (!matchesLegacyPhase) return false;
    }

    if (availability?.timeSlots && !ignoreTimeSlots) {
      if (!availability.timeSlots.some((timeSlot) => this.matchesTimeSlot(timeSlot, gameState))) {
        return false;
      }
    }

    const prerequisites = availability?.after;
    const history = gameState.scenarioHistory ?? [];
    const matchesPrerequisite = (condition: { scenarioId: string; choiceId?: string }): boolean =>
      history.some((entry) => {
        if (entry.scenarioId !== condition.scenarioId) return false;
        if (condition.choiceId !== undefined) {
          return entry.type === 'choice' && entry.choiceId === condition.choiceId;
        }
        return entry.type === 'completed';
      });

    if (prerequisites?.all && !prerequisites.all.every(matchesPrerequisite)) return false;
    if (prerequisites?.any && !prerequisites.any.some(matchesPrerequisite)) return false;
    return true;
  }

  private static matchesTimeSlot(timeSlot: ScenarioTimeSlot, gameState: GameState): boolean {
    switch (timeSlot) {
      case 'morning':
        return gameState.phase === 'morning' || gameState.phase === 'morning_action';
      case 'afternoon':
        return gameState.phase === 'lunch_action';
      case 'afterschool':
        return gameState.phase === 'afterschool_action';
      case 'holiday':
        return isHoliday(gameState.day);
    }
    return false;
  }

  /**
   * 行動シナリオ終了時の次のフェーズを算出
   */
  public static getNextPhase(currentPhase: DayPhase): DayPhase {
    switch (currentPhase) {
      case 'morning':
        return 'morning_action';
      case 'morning_action':
        return 'lunch_action';
      case 'lunch_action':
        return 'afterschool_action';
      case 'afterschool_action':
        return 'night';
      case 'holiday_action':
        // 休日の行動は1日1回
        return 'night';
      case 'night':
        return 'morning';
    }
  }

  /**
   * 就寝処理（日付を1日進め、翌朝の状態へ）
   * 最終日を超える場合はエンディング判定フラグを立てる
   */
  public static advanceToNextDay(gameState: GameState): { nextState: GameState; isEnding: boolean } {
    const nextDay = gameState.day + 1;
    if (nextDay > FINAL_DAY) {
      return {
        nextState: gameState,
        isEnding: true,
      };
    }

    const nextState: GameState = {
      ...gameState,
      day: nextDay,
      phase: this.getDayStartPhase(nextDay),
      currentScenarioId: null,
      dayStartSnapshot: {
        day: nextDay,
        flags: { ...gameState.flags },
        affinities: { ...gameState.affinities },
        scenarioHistory: [...(gameState.scenarioHistory ?? [])],
      },
    };

    return {
      nextState,
      isEnding: false,
    };
  }

  /**
   * 1日をやり直す（当日の朝開始時点の状態へ巻き戻す）
   */
  public static rollbackToday(gameState: GameState): GameState {
    if (!gameState.dayStartSnapshot) {
      return {
        ...gameState,
        phase: this.getDayStartPhase(gameState.day),
        scenarioHistory: (gameState.scenarioHistory ?? []).filter((entry) => entry.day < gameState.day),
        currentScenarioId: null,
      };
    }

    return {
      ...gameState,
      day: gameState.dayStartSnapshot.day,
      phase: this.getDayStartPhase(gameState.dayStartSnapshot.day),
      flags: { ...gameState.dayStartSnapshot.flags },
      affinities: { ...gameState.dayStartSnapshot.affinities },
      scenarioHistory: [...(gameState.dayStartSnapshot.scenarioHistory ?? [])],
      currentScenarioId: null,
    };
  }

  // TODO: エンディング仕様確定後に実装
}
