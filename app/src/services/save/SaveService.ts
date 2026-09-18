import { GameState, DayRollbackSnapshot } from '../../types/game';
import { SaveData, SAVE_STORAGE_KEY, DAY_BACKUP_STORAGE_KEY } from '../../types/save';

export class SaveService {
  private storage: Storage;

  constructor(storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)) {
    this.storage = storage;
  }

  /**
   * 現在のゲーム進行状態をセーブする
   */
  public saveGame(gameState: GameState, summaryTitle?: string): boolean {
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
          chapterTitle: summaryTitle,
        },
      };
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('[SaveService] Failed to save game:', e);
      return false;
    }
  }

  /**
   * 保存されたゲームデータをロードする
   */
  public loadGame(): SaveData | null {
    try {
      const raw = this.storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (!data || !data.gameState || typeof data.gameState.day !== 'number') {
        console.warn('[SaveService] Corrupt save data found.');
        return null;
      }
      return data;
    } catch (e) {
      console.error('[SaveService] Failed to load save data:', e);
      return null;
    }
  }

  /**
   * セーブデータが存在するか確認
   */
  public hasSaveData(): boolean {
    try {
      return Boolean(this.storage.getItem(SAVE_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  /**
   * セーブデータを削除
   */
  public clearSaveData(): void {
    try {
      this.storage.removeItem(SAVE_STORAGE_KEY);
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
