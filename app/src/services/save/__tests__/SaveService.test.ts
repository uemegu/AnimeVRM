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
    storage.setItem('galgame_save_slot_1', 'invalid-json-structure{{{');
    const loaded = service.loadGame(1);
    expect(loaded).toBeNull();
  });

  it('複数スロット（スロット1〜3）への個別保存・ロード・一覧取得が正しく動作すること', () => {
    // スロット1に保存
    service.saveGame(mockGameState, 1, 'スロット1のデータ');

    // スロット2に別状態を保存
    const mockState2: GameState = {
      ...mockGameState,
      day: 12,
      phase: 'lunch_action',
    };
    service.saveGame(mockState2, 2, 'スロット2のデータ');

    expect(service.hasSaveData(1)).toBe(true);
    expect(service.hasSaveData(2)).toBe(true);
    expect(service.hasSaveData(3)).toBe(false);
    expect(service.hasSaveData()).toBe(true);

    const slot1Data = service.loadGame(1);
    const slot2Data = service.loadGame(2);
    const slot3Data = service.loadGame(3);

    expect(slot1Data?.gameState.day).toBe(5);
    expect(slot2Data?.gameState.day).toBe(12);
    expect(slot3Data).toBeNull();

    const allSlots = service.getAllSlots();
    expect(allSlots.length).toBe(3);
    expect(allSlots[0].slotId).toBe(1);
    expect(allSlots[0].data?.summary.chapterTitle).toBe('スロット1のデータ');
    expect(allSlots[1].slotId).toBe(2);
    expect(allSlots[1].data?.summary.chapterTitle).toBe('スロット2のデータ');
    expect(allSlots[2].slotId).toBe(3);
    expect(allSlots[2].data).toBeNull();
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
