import {
  GameState,
  DayPhase,
  ActionLocationId,
  ActionLocationOption,
  isHoliday,
} from '../../types/game';
import { ScenarioPackage, ScenarioTimeSlot } from '../../types/scenario';
import {
  LOCATION_DEFINITIONS,
  SCHOOL_ACTION_LOCATIONS,
  HOLIDAY_ACTION_LOCATIONS,
} from '../../data/locations';
import {
  MORNING_SCENARIO_DAY_1,
  MORNING_SCENARIO_DEFAULT,
} from '../../scenarios/morningScenarios';
import {
  ALL_ACTION_SCENARIOS,
  ACTION_SCENARIO_GENERIC,
} from '../../scenarios/actionScenarios';
import {
  ALL_HOLIDAY_SCENARIOS,
  HOLIDAY_SCENARIO_GENERIC,
} from '../../scenarios/holidayScenarios';
import {
  FORCED_SCENARIO_MEET_SHION,
  FORCED_SCENARIO_MEET_EMILI,
} from '../../scenarios/forcedScenarios';

export class ScheduleManager {
  /**
   * 初期ゲーム状態を生成
   */
  public static createInitialState(): GameState {
    const initialDay = 1;
    const initialFlags = {};
    const initialAffinities = {};
    return {
      day: initialDay,
      phase: 'morning',
      flags: initialFlags,
      affinities: initialAffinities,
      scenarioHistory: [],
      currentScenarioId: MORNING_SCENARIO_DAY_1.id,
      dayStartSnapshot: {
        day: initialDay,
        flags: { ...initialFlags },
        affinities: { ...initialAffinities },
        scenarioHistory: [],
      },
    };
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
  public static getMorningScenario(gameState: GameState): ScenarioPackage {
    const candidates = [MORNING_SCENARIO_DAY_1, MORNING_SCENARIO_DEFAULT]
      .map((scenario, index) => ({ scenario, index }))
      .filter(({ scenario }) => this.matchesScenarioAvailability(scenario, gameState))
      .sort((a, b) => {
        const priorityDifference =
          this.getScenarioPriority(b.scenario, MORNING_SCENARIO_DEFAULT.id) -
          this.getScenarioPriority(a.scenario, MORNING_SCENARIO_DEFAULT.id);
        return priorityDifference || a.index - b.index;
      });
    return candidates[0]?.scenario ?? MORNING_SCENARIO_DEFAULT;
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
  public static checkForcedInterruption(gameState: GameState): ScenarioPackage | null {
    const candidates = [
      { scenario: FORCED_SCENARIO_MEET_SHION, requiredFlag: 'met_shion' },
      { scenario: FORCED_SCENARIO_MEET_EMILI, requiredFlag: 'met_emili' },
    ]
      .map((candidate, index) => ({ ...candidate, index }))
      .filter(({ scenario, requiredFlag }) => {
        return !gameState.flags[requiredFlag] && this.matchesScenarioAvailability(scenario, gameState);
      })
      .sort((a, b) => {
        const priorityDifference = (b.scenario.priority ?? 0) - (a.scenario.priority ?? 0);
        return priorityDifference || a.index - b.index;
      });
    return candidates[0]?.scenario ?? null;
  }

  /**
   * 選択された場所に応じたシナリオを決定（ScenarioPackage.actionHints より解決）
   */
  public static getScenarioForLocation(locationId: ActionLocationId, gameState: GameState): ScenarioPackage {
    const fallback = gameState.phase === 'holiday_action' ? HOLIDAY_SCENARIO_GENERIC : ACTION_SCENARIO_GENERIC;
    return this.getEligibleActionScenarios(locationId, gameState)[0] ?? fallback;
  }

  /** 条件に一致する行動シナリオを優先順位順で返す */
  private static getEligibleActionScenarios(
    locationId: ActionLocationId,
    gameState: GameState
  ): ScenarioPackage[] {
    return [...ALL_ACTION_SCENARIOS, ...ALL_HOLIDAY_SCENARIOS]
      .map((scenario, index) => ({ scenario, index }))
      .filter(({ scenario }) => this.matchesScenarioAvailability(scenario, gameState, locationId))
      .sort((a, b) => {
        const priorityDifference =
          this.getScenarioPriority(b.scenario, ACTION_SCENARIO_GENERIC.id) -
          this.getScenarioPriority(a.scenario, ACTION_SCENARIO_GENERIC.id);
        return priorityDifference || a.index - b.index;
      })
      .map(({ scenario }) => scenario);
  }

  private static getScenarioPriority(scenario: ScenarioPackage, fallbackScenarioId: string): number {
    const isFallback = scenario.id === fallbackScenarioId || scenario.id === HOLIDAY_SCENARIO_GENERIC.id;
    return isFallback ? Number.NEGATIVE_INFINITY : scenario.priority ?? 0;
  }

  /** シナリオの日付・時間帯・場所・進行履歴条件を判定 */
  private static matchesScenarioAvailability(
    scenario: ScenarioPackage,
    gameState: GameState,
    locationId?: ActionLocationId
  ): boolean {
    const availability = scenario.availability;
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

    if (availability?.timeSlots) {
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
   * 28日目を超える場合はエンディング判定フラグを立てる
   */
  public static advanceToNextDay(gameState: GameState): { nextState: GameState; isEnding: boolean } {
    const nextDay = gameState.day + 1;
    if (nextDay > 28) {
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
