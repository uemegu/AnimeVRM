import { GameState, DayRollbackSnapshot } from '../../types/game';
import {
  SaveData,
  SAVE_SLOT_COUNT,
  getSaveSlotKey,
  SaveSlotInfo,
  DAY_BACKUP_STORAGE_KEY,
} from '../../types/save';

export class SaveService {
  private storage: Storage;

  constructor(storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)) {
    this.storage = storage;
  }

  /**
   * 指定スロットにゲーム進行状態をセーブする（デフォルト: slotId = 1）
   * @param slotIdOrTitle スロット番号（1〜3）または概要タイトル
   * @param summaryTitle 概要タイトル
   */
  public saveGame(
    gameState: GameState,
    slotIdOrTitle: number | string = 1,
    summaryTitle?: string
  ): boolean {
    const slotId = typeof slotIdOrTitle === 'number' ? slotIdOrTitle : 1;
    const finalTitle = typeof slotIdOrTitle === 'string' ? slotIdOrTitle : summaryTitle;

    try {
      const saveData: SaveData = {
        version: 1,
        savedAt: new Date().toISOString(),
        gameState: {
          ...gameState,
          // スナップショットも含めて保存
        },
        summary: {
          day: gameState.day,
          phase: gameState.phase,
          chapterTitle: finalTitle,
        },
      };
      this.storage.setItem(getSaveSlotKey(slotId), JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error(`[SaveService] Failed to save game to slot ${slotId}:`, e);
      return false;
    }
  }

  /**
   * 指定スロットからセーブデータをロードする（デフォルト: slotId = 1）
   */
  public loadGame(slotId: number = 1): SaveData | null {
    try {
      const raw = this.storage.getItem(getSaveSlotKey(slotId));
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (!data || !data.gameState || typeof data.gameState.day !== 'number') {
        console.warn(`[SaveService] Corrupt save data found in slot ${slotId}.`);
        return null;
      }
      return data;
    } catch (e) {
      console.error(`[SaveService] Failed to load save data from slot ${slotId}:`, e);
      return null;
    }
  }

  /**
   * セーブデータが存在するか確認（slotId省略時は全スロット中のいずれか）
   */
  public hasSaveData(slotId?: number): boolean {
    try {
      if (slotId !== undefined) {
        return Boolean(this.storage.getItem(getSaveSlotKey(slotId)));
      }
      for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
        if (this.storage.getItem(getSaveSlotKey(i))) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 特定スロットの情報を取得
   */
  public getSlotInfo(slotId: number): SaveSlotInfo {
    return {
      slotId,
      data: this.loadGame(slotId),
    };
  }

  /**
   * 全スロット（1..SAVE_SLOT_COUNT）の情報を取得
   */
  public getAllSlots(): SaveSlotInfo[] {
    const slots: SaveSlotInfo[] = [];
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      slots.push(this.getSlotInfo(i));
    }
    return slots;
  }

  /**
   * セーブデータを削除（slotId指定時はそのスロット、未指定時は全スロット）
   */
  public clearSaveData(slotId?: number): void {
    try {
      if (slotId !== undefined) {
        this.storage.removeItem(getSaveSlotKey(slotId));
      } else {
        for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
          this.storage.removeItem(getSaveSlotKey(i));
        }
      }
    } catch (e) {
      console.error('[SaveService] Failed to clear save data:', e);
    }
  }

  /**
   * 当日朝の開始スナップショットをバックアップ保存
   */
  public saveDayStartBackup(snapshot: DayRollbackSnapshot): boolean {
    try {
      this.storage.setItem(DAY_BACKUP_STORAGE_KEY, JSON.stringify(snapshot));
      return true;
    } catch (e) {
      console.error('[SaveService] Failed to save day backup:', e);
      return false;
    }
  }

  /**
   * 当日朝のバックアップを読み出し
   */
  public loadDayStartBackup(): DayRollbackSnapshot | null {
    try {
      const raw = this.storage.getItem(DAY_BACKUP_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DayRollbackSnapshot;
    } catch (e) {
      console.error('[SaveService] Failed to load day backup:', e);
      return null;
    }
  }

  /**
   * 当日朝のバックアップをクリア
   */
  public clearDayStartBackup(): void {
    try {
      this.storage.removeItem(DAY_BACKUP_STORAGE_KEY);
    } catch (e) {
      console.error('[SaveService] Failed to clear day backup:', e);
    }
  }
}
