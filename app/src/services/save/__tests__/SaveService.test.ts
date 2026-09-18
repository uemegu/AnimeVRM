import { describe, it, expect, beforeEach } from 'vitest';
import { SaveService } from '../SaveService';
import { GameState } from '../../../types/game';

// インメモリストレージモック
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

describe('SaveService (セーブ/ロード機能検証)', () => {
  let storage: Storage;
  let service: SaveService;

  const mockGameState: GameState = {
    day: 5,
    phase: 'night',
    flags: { met_aoi: true, helped_shion: true },
    affinities: { aoi: 15, shion: 20 },
    currentScenarioId: null,
    dayStartSnapshot: {
      day: 5,
      flags: { met_aoi: true },
      affinities: { aoi: 10, shion: 10 },
    },
  };

  beforeEach(() => {
    storage = new MemoryStorage();
    service = new SaveService(storage);
  });

  it('初期状態ではセーブデータが存在しないこと', () => {
    expect(service.hasSaveData()).toBe(false);
    expect(service.loadGame()).toBeNull();
  });

  it('正常にセーブとロードが行われ、状態が完全復元されること', () => {
    const ok = service.saveGame(mockGameState, '第5日 夜');
    expect(ok).toBe(true);
    expect(service.hasSaveData()).toBe(true);

    const loaded = service.loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.gameState.day).toBe(5);
    expect(loaded?.gameState.phase).toBe('night');
    expect(loaded?.gameState.flags.helped_shion).toBe(true);
    expect(loaded?.gameState.affinities.aoi).toBe(15);
    expect(loaded?.summary.day).toBe(5);
  });

  it('データ破損時に null を返しクラッシュしないこと', () => {
    storage.setItem('galgame_save_data', 'invalid-json-structure{{{');
    const loaded = service.loadGame();
    expect(loaded).toBeNull();
  });

  it('当日朝のスナップショットのバックアップと復元ができること', () => {
    const snapshot = {
      day: 5,
      flags: { flagA: true },
      affinities: { aoi: 10 },
    };
    service.saveDayStartBackup(snapshot);
    const loaded = service.loadDayStartBackup();
    expect(loaded).toEqual(snapshot);

    service.clearDayStartBackup();
    expect(service.loadDayStartBackup()).toBeNull();
  });
});
