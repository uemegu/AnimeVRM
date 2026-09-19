import { describe, it, expect } from 'vitest';
import preloadManifest from '../../../data/preloadManifest.json';
import { PRELOAD_TARGETS } from '../../../config/preloadTargets';
import { AssetPreloader, INITIAL_PRELOAD_ITEMS } from '../AssetPreloader';

describe('PreloadManifest (プリロード設定・マニフェスト自動生成検証)', () => {
  it('PRELOAD_TARGETS に必要な全アセット（リュック付き・先生モデル含む）が登録されていること', () => {
    const urls = PRELOAD_TARGETS.map((t) => t.url);

    // ヒロインリュック付きモデル
    expect(urls).toContain('/models/aoi/aoi-school-with-bag.vrm');
    expect(urls).toContain('/models/emili/emili-school-with-bag.vrm');
    expect(urls).toContain('/models/shion/shion-school-with-bag.vrm');

    // 先生モデル
    expect(urls).toContain('/models/teacher/teacher.vrm');

    // コアBGM
    expect(urls).toContain('/bgm/thema_music.mp3');
    expect(urls).toContain('/bgm/main_bgm.mp3');

    // リップシンク
    expect(urls).toContain('/wasm/lipsync.wasm');
    expect(urls).toContain('/worklets/lipsync-processor.js');
  });

  it('preloadManifest.json の各アイテムが有効なファイルサイズ（>0）を持つこと', () => {
    expect(preloadManifest.itemCount).toBe(PRELOAD_TARGETS.length);
    expect(preloadManifest.items.length).toBe(PRELOAD_TARGETS.length);
    expect(preloadManifest.totalBytes).toBeGreaterThan(150 * 1024 * 1024); // 150MB以上

    for (const item of preloadManifest.items) {
      expect(item.id).toBeTruthy();
      expect(item.url).toMatch(/^\//);
      expect(item.sizeBytes).toBeGreaterThan(0);
      expect(['vrm', 'audio', 'wasm', 'binary', 'image']).toContain(item.type);
      expect(item.label.ja).toBeTruthy();
      expect(item.label.en).toBeTruthy();
    }
  });

  it('リュック付きモデルと先生モデルのサイズが10MB以上で自動計算されていること', () => {
    const bagAoi = preloadManifest.items.find((i) => i.id === 'aoi_school_bag');
    const bagEmili = preloadManifest.items.find((i) => i.id === 'emili_school_bag');
    const bagShion = preloadManifest.items.find((i) => i.id === 'shion_school_bag');
    const teacher = preloadManifest.items.find((i) => i.id === 'teacher');

    expect(bagAoi).toBeDefined();
    expect(bagAoi!.sizeBytes).toBeGreaterThan(10 * 1024 * 1024);

    expect(bagEmili).toBeDefined();
    expect(bagEmili!.sizeBytes).toBeGreaterThan(10 * 1024 * 1024);

    expect(bagShion).toBeDefined();
    expect(bagShion!.sizeBytes).toBeGreaterThan(10 * 1024 * 1024);

    expect(teacher).toBeDefined();
    expect(teacher!.sizeBytes).toBeGreaterThan(10 * 1024 * 1024);
  });

  it('AssetPreloader がマニフェストから自動計算されたサイズを反映すること', () => {
    expect(INITIAL_PRELOAD_ITEMS.length).toBe(preloadManifest.items.length);
    expect(AssetPreloader.getTotalPreloadBytes()).toBe(preloadManifest.totalBytes);
  });
});
