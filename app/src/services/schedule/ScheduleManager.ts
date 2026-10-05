import {
  GameState,
  DayPhase,
  ActionLocationId,
  ActionLocationOption,
  isHoliday,
  FINAL_DAY,
} from '../../types/game';
import { ActionLocationHint, ScenarioCategory, ScenarioIndexEntry, ScenarioMeta, ScenarioTimeSlot } from '../../types/scenario';
import { MAP_CHARACTER_IDS } from '../../data/characters';
import { HeroineId, NightCommunication } from '../../types/communication';
import {
  LOCATION_DEFINITIONS,
  SCHOOL_ACTION_LOCATIONS,
  HOLIDAY_ACTION_LOCATIONS,
} from '../../data/locations';
import { scenarioRepository } from '../scenario/ScenarioRepository';
import { weatherOf } from '../../data/calendar';

/** 汎用シナリオの並びを日と時間帯で入れ替えるための値（同じ日・時間帯なら同じ値） */
function rotationKey(id: string, gameState: Pick<GameState, 'day' | 'phase'>): number {
  let hash = 2166136261;
  for (const ch of `${id}:${gameState.day}:${gameState.phase}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** 一度見たら再び選ばれない種類（汎用シナリオは何度でも選ばれる） */
const ONCE_CATEGORIES: ReadonlySet<ScenarioCategory> = new Set(['morning', 'action', 'holiday', 'forced']);

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
    const plan = this.planActionLocations(gameState);
    return this.actionLocations(gameState).map((locId) => {
      const { hint, characters } = plan.get(locId)!;
      return {
        ...LOCATION_DEFINITIONS[locId],
        hintCharacterIds: characters,
        hintText: hint?.hintText,
      };
    });
  }

  /** 今の行動フェーズで選べる場所 */
  private static actionLocations(gameState: GameState): ActionLocationId[] {
    return gameState.phase === 'holiday_action'
      ? HOLIDAY_ACTION_LOCATIONS
          .filter((location) => !location.unlockFlag || Boolean(gameState.flags[location.unlockFlag]))
          .map((location) => location.id)
      : SCHOOL_ACTION_LOCATIONS;
  }

  /**
   * 場所ごとに、選んだら流れるシナリオと、地図に出す人を決める（地図の表示と実際の場面を一致させる）。
   * 地図に出す人は、場所のヒントに書いた人。ヒントがなければそのシナリオに登場する人（汎用シナリオも含む）。
   * 同じ人が同じ時間に複数の場所に出てもよい（期間の短いイベントを取りこぼさないため）
   */
  private static planActionLocations(
    gameState: GameState
  ): Map<ActionLocationId, { scenario: ScenarioIndexEntry; hint?: ActionLocationHint; characters: string[] }> {
    const plan = new Map<ActionLocationId, { scenario: ScenarioIndexEntry; hint?: ActionLocationHint; characters: string[] }>();
    for (const locationId of this.actionLocations(gameState)) {
      const scenario =
        this.getEligibleActionScenarios(locationId, gameState)[0] ??
        this.getFallbackScenario(gameState.phase === 'holiday_action' ? 'holiday' : 'action');
      const hint = scenario.actionHints?.find(
        (h) => h.locationId === locationId && (!h.phases || h.phases.includes(gameState.phase))
      );
      const characters = hint?.hintCharacterIds
        ? [...hint.hintCharacterIds]
        : (scenario.cast ?? []).filter((id) => MAP_CHARACTER_IDS.includes(id));
      plan.set(locationId, { scenario, hint, characters });
    }
    return plan;
  }

  /**
   * 日中の強制割り込みイベントがあるかチェック
   * 未遭遇のキャラ救済イベント等を判定
   */
  public static checkForcedInterruption(gameState: GameState): ScenarioIndexEntry | null {
    return this.getEligibleScenarios(['forced'], gameState)[0] ?? null;
  }

  /**
   * 放課後の行動を終えたあと、夜の自室へ戻る前の強制イベント（下校時・帰宅時。timeSlots に 'evening'）
   */
  public static checkEveningEvent(gameState: GameState): ScenarioIndexEntry | null {
    return this.getEligibleScenarios(['forced'], gameState, undefined, false, true)[0] ?? null;
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
    // 今夜終えた電話・メールの続き（after に今夜のものを sameDay で指定したもの）は、同じ人からでも届く
    const isFollowUpOfTonight = (entry: ScenarioIndexEntry) =>
      [...(entry.availability?.after?.all ?? []), ...(entry.availability?.after?.any ?? [])].some(
        (p) => p.sameDay && all.some((c) => c.id === p.scenarioId) && isCompleted(p.scenarioId, gameState.day)
      );
    for (const characterId of heroines) {
      const doneTonight = all.filter((entry) => entry.characterId === characterId && isCompleted(entry.id, gameState.day));
      const followUp = communications.find(
        (entry) => entry.characterId === characterId && !isCompleted(entry.id) && isFollowUpOfTonight(entry)
      );
      const selected =
        followUp ??
        doneTonight[doneTonight.length - 1] ??
        communications.find((entry) => entry.characterId === characterId && !isCompleted(entry.id));
      if (!selected) continue;
      result.push({
        kind: selected.category === 'call' ? 'call' : 'mail',
        id: selected.id,
        characterId,
        previewText: selected.previewText,
        time: selected.time,
        done: selected !== followUp && doneTonight.includes(selected),
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
      this.planActionLocations(gameState).get(locationId)?.scenario ??
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
    ignoreTimeSlots = false,
    evening = false
  ): ScenarioIndexEntry[] {
    const completed = new Set(
      (gameState.scenarioHistory ?? []).filter((entry) => entry.type === 'completed').map((entry) => entry.scenarioId)
    );
    return categories
      .flatMap((category) => scenarioRepository.list(category))
      .map((scenario, index) => ({ scenario, index }))
      .filter(({ scenario }) => scenario.fallback || !ONCE_CATEGORIES.has(scenario.category) || !completed.has(scenario.id))
      .filter(({ scenario }) => this.matchesScenarioAvailability(scenario, gameState, locationId, ignoreTimeSlots, evening))
      .sort((a, b) => {
        const priorityDifference = this.getScenarioPriority(b.scenario) - this.getScenarioPriority(a.scenario);
        if (priorityDifference) return priorityDifference;
        // 汎用どうしは、日と時間帯で並びを変える（同じ場所でも日によって違う一コマが流れる）
        if (a.scenario.fallback && b.scenario.fallback) {
          return rotationKey(a.scenario.id, gameState) - rotationKey(b.scenario.id, gameState) || a.index - b.index;
        }
        return a.index - b.index;
      })
      .map(({ scenario }) => scenario);
  }

  /** 汎用シナリオは最後。汎用どうしでは、場所を指定したもの（その場所らしい一コマ）を、どこでも起きるものより先にする */
  private static getScenarioPriority(scenario: ScenarioMeta): number {
    if (scenario.fallback) return -1e9 + (scenario.availability?.locations?.length ? 1 : 0);
    return scenario.priority ?? 0;
  }

  /** シナリオの日付・時間帯・場所・フラグ・進行履歴条件を判定 */
  private static matchesScenarioAvailability(
    scenario: ScenarioMeta,
    gameState: GameState,
    locationId?: ActionLocationId,
    ignoreTimeSlots = false,
    evening = false
  ): boolean {
    const availability = scenario.availability;
    // 下校時の強制イベントは、放課後の行動を終えたときだけ（ほかの時間帯の判定では選ばない）
    const isEveningEvent = availability?.timeSlots?.includes('evening') ?? false;
    if (isEveningEvent !== evening) return false;
    if (availability?.days && !availability.days.includes(gameState.day)) return false;
    if (availability?.weather && !availability.weather.includes(weatherOf(gameState.day))) return false;
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

    if (availability?.timeSlots && !ignoreTimeSlots && !evening) {
      if (!availability.timeSlots.some((timeSlot) => this.matchesTimeSlot(timeSlot, gameState))) {
        return false;
      }
    }

    const prerequisites = availability?.after;
    const history = gameState.scenarioHistory ?? [];
    const matchesPrerequisite = (condition: { scenarioId: string; choiceId?: string; sameDay?: boolean }): boolean =>
      history.some((entry) => {
        if (entry.scenarioId !== condition.scenarioId) return false;
        if (condition.sameDay && entry.day !== gameState.day) return false;
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
      case 'evening':
        return false;
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
