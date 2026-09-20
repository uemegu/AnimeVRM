import {
  GameState,
  DayPhase,
  ActionLocationId,
  ActionLocationOption,
} from '../../types/game';
import { ScenarioPackage } from '../../types/scenario';
import { LOCATION_DEFINITIONS } from '../../data/locations';
import {
  MORNING_SCENARIO_DAY_1,
  MORNING_SCENARIO_DEFAULT,
} from '../../scenarios/morningScenarios';
import {
  ALL_ACTION_SCENARIOS,
  ACTION_SCENARIO_GENERIC,
} from '../../scenarios/actionScenarios';
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
      currentScenarioId: MORNING_SCENARIO_DAY_1.id,
      dayStartSnapshot: {
        day: initialDay,
        flags: { ...initialFlags },
        affinities: { ...initialAffinities },
      },
    };
  }

  /**
   * 朝フェーズのシナリオを取得
   */
  public static getMorningScenario(gameState: GameState): ScenarioPackage {
    if (gameState.day === 1) {
      return MORNING_SCENARIO_DAY_1;
    }
    return MORNING_SCENARIO_DEFAULT;
  }

  /**
   * 行動ターンにおける各場所の事前情報（滞在キャラ・ヒント文）を生成
   * シナリオデータ（ScenarioPackage.actionHints）から情報を解決
   */
  public static getActionLocationOptions(gameState: GameState): ActionLocationOption[] {
    const locations: ActionLocationId[] = [
      'classroom',
      'courtyard',
      'rooftop',
      'library',
      'cafeteria',
      'sports_ground',
    ];

    return locations.map((locId) => {
      const base = LOCATION_DEFINITIONS[locId];
      let hintCharacterIds: string[] = [];
      let hintText: { ja: string; en?: string } | undefined;

      // シナリオデータ（ScenarioPackage.actionHints）から該当フェーズ・場所のヒントを取得
      for (const scenario of ALL_ACTION_SCENARIOS) {
        if (!scenario.actionHints) continue;
        const matchingHint = scenario.actionHints.find((h) => {
          if (h.locationId !== locId) return false;
          if (h.phases && !h.phases.includes(gameState.phase)) return false;
          return true;
        });

        if (matchingHint) {
          if (matchingHint.hintCharacterIds) {
            hintCharacterIds = [...matchingHint.hintCharacterIds];
          }
          if (matchingHint.hintText) {
            hintText = matchingHint.hintText;
          }
          break;
        }
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
    // 既に会っていないシオンの救済: Day 2以降、午前行動開始時
    if (gameState.day >= 2 && !gameState.flags.met_shion && gameState.phase === 'morning_action') {
      return FORCED_SCENARIO_MEET_SHION;
    }
    // 既に会っていないエミリの救済: Day 3以降、昼行動開始時
    if (gameState.day >= 3 && !gameState.flags.met_emili && gameState.phase === 'lunch_action') {
      return FORCED_SCENARIO_MEET_EMILI;
    }
    return null;
  }

  /**
   * 選択された場所に応じたシナリオを決定（ScenarioPackage.actionHints より解決）
   */
  public static getScenarioForLocation(locationId: ActionLocationId, gameState: GameState): ScenarioPackage {
    for (const scenario of ALL_ACTION_SCENARIOS) {
      if (!scenario.actionHints) continue;
      const matches = scenario.actionHints.some((h) => {
        if (h.locationId !== locationId) return false;
        if (h.phases && !h.phases.includes(gameState.phase)) return false;
        return true;
      });
      if (matches) {
        return scenario;
      }
    }
    return ACTION_SCENARIO_GENERIC;
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
      phase: 'morning',
      currentScenarioId: null,
      dayStartSnapshot: {
        day: nextDay,
        flags: { ...gameState.flags },
        affinities: { ...gameState.affinities },
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
      return { ...gameState, phase: 'morning', currentScenarioId: null };
    }

    return {
      ...gameState,
      day: gameState.dayStartSnapshot.day,
      phase: 'morning',
      flags: { ...gameState.dayStartSnapshot.flags },
      affinities: { ...gameState.dayStartSnapshot.affinities },
      currentScenarioId: null,
    };
  }

  // TODO: エンディング仕様確定後に実装
}
