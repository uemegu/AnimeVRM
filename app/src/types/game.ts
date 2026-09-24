/**
 * ギャルゲーアプリ ゲーム進行・コアループ型定義
 */

/** 1日の時間帯フェーズ */
export type DayPhase =
  | 'morning'              // 朝: 登校イベント等（1回固定）
  | 'morning_action'      // 午前: 行動ターン（場所選択）
  | 'lunch_action'        // 昼: 行動ターン（場所選択）
  | 'afterschool_action'  // 放課後: 行動ターン（場所選択）
  | 'holiday_action'      // 休日（土日）の昼: 行動ターン（1日1回・街マップから選択）
  | 'night';              // 夜: 自室（セーブ/ロード/やり直し/就寝）

/** 曜日 */
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/** 行動ターンで選択可能な固定場所ID */
export type ActionLocationId =
  | 'classroom'     // 教室
  | 'courtyard'     // 中庭
  | 'corridor'      // 廊下
  | 'rooftop'       // 屋上
  | 'library'       // 図書室
  | 'sports_ground' // 運動場
  | 'cafeteria'     // 購買・学食
  // 休日（街マップ）
  | 'park'            // 公園
  | 'shopping_street' // 商店街
  | 'cinema'          // 映画館
  | 'home'            // 自宅
  | 'amusement_park'  // 遊園地（条件付きで解放）
  | 'aquarium'        // 水族館（条件付きで解放）
  | 'shrine'          // 神社（女神の社）
  | 'aoi_house';      // アオイの部屋（招待されると解放）

/** 行動場所の定義と事前情報 */
export interface ActionLocationOption {
  id: ActionLocationId;
  name: {
    ja: string;
    en?: string;
  };
  /** 事前情報: 誰がいそうか（目撃ヒント・滞在キャラID一覧） */
  hintCharacterIds?: string[];
  /** 事前情報のヒント文（例: 「窓の外に運動部の姿が見える」等） */
  hintText?: {
    ja: string;
    en?: string;
  };
}

/** ゲーム全体の状態 */
export interface GameState {
  /** 現在の日数 (1〜FINAL_DAY) */
  day: number;
  /** 現在の時間帯フェーズ */
  phase: DayPhase;
  /** シナリオ進行フラグ (例: { met_aoi: true, helped_shion: true }) */
  flags: Record<string, boolean | number | string>;
  /** キャラクター別好感度/親愛度 (例: { girl_01: 15, girl_02: 5 }) */
  affinities: Record<string, number>;
  /** シナリオ完了・選択肢選択の履歴（解放条件の判定に使用） */
  scenarioHistory?: ScenarioHistoryEntry[];
  /** 現在再生中のシナリオID（nullの場合はメニューや選択肢画面） */
  currentScenarioId: string | null;
  /** 当日の開始時点（朝）のスナップショット（「1日をやり直す」用） */
  dayStartSnapshot?: DayRollbackSnapshot | null;
}

/** 1日をやり直すための朝開始時スナップショット */
export interface DayRollbackSnapshot {
  day: number;
  flags: Record<string, boolean | number | string>;
  affinities: Record<string, number>;
  /** やり直し時に当日分のシナリオ履歴も巻き戻す */
  scenarioHistory?: ScenarioHistoryEntry[];
}

/** シナリオ解放条件で参照する進行履歴 */
export interface ScenarioHistoryEntry {
  scenarioId: string;
  day: number;
  type: 'choice' | 'completed';
  /** 選択肢ID。ID未指定の既存シナリオでは goto 先シーンIDを使用 */
  choiceId?: string;
}

/** 曜日計算ヘルパー (1日目 = 月曜始まり) */
export function getDayOfWeek(day: number): DayOfWeek {
  const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[(day - 1) % 7];
}

/** 週番号 (1〜4週目) */
export function getWeekNumber(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

/** 休日（土日）判定 */
export function isHoliday(day: number): boolean {
  const dayOfWeek = getDayOfWeek(day);
  return dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
}

/** 最終日（女神の期限。21日目の日曜に決着する） */
export const FINAL_DAY = 21;

/** 最終日判定 */
export function isFinalDay(day: number): boolean {
  return day >= FINAL_DAY;
}
