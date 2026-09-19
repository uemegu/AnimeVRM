/**
 * ギャルゲーアプリ セーブ/ロード用型定義
 */

import { GameState } from './game';

/** セーブデータ構造 */
export interface SaveData {
  /** 保存バージョン */
  version: number;
  /** セーブ日時 (ISO 8601 文字列) */
  savedAt: string;
  /** 進行状態 */
  gameState: GameState;
  /** シナリオ再生中の場合の位置情報 */
  scenarioState?: {
    scenarioId: string;
    sceneId: string;
  } | null;
  /** 概要・メタデータ（ロード画面用） */
  summary: {
    day: number;
    phase: string;
    chapterTitle?: string;
  };
}

/** localStorage 保存キー */
export const SAVE_STORAGE_KEY_PREFIX = 'galgame_save_slot_';
export const SAVE_SLOT_COUNT = 3;
export const DAY_BACKUP_STORAGE_KEY = 'galgame_day_backup_data';

export const getSaveSlotKey = (slotId: number): string => `${SAVE_STORAGE_KEY_PREFIX}${slotId}`;

/** セーブスロット情報 */
export interface SaveSlotInfo {
  slotId: number;
  data: SaveData | null;
}
