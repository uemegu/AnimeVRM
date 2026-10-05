import * as THREE from 'three';
import preloadManifest from '../../data/preloadManifest.json';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';
import { ScenarioPackage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';
import { DayPhase } from '../../types/game';
import { outfitModelUrl } from '../stage/sceneView';
import { resolveAssetUrl } from '../../utils/path';
import { installBoundedAssetCache } from './assetCache';

// Three.js のメモリキャッシュを、容量の上限付きで有効化
installBoundedAssetCache();

/**
 * 先読みしたデータを three.js のローダー（FileLoader）が使えるよう、同じキー（file:<URL>）で置く。
 * 画像（ImageLoader が別のキーで画像要素を持つ）と音声（three.js を通さない）はメモリに持たず、
 * 取得してブラウザのキャッシュに載せるだけにする
 */
function cacheForLoaders(resolvedUrl: string, buffer: ArrayBuffer): void {
  if (/\.(vrm|glb|gltf|fbx|bin|wasm)(\?|$)/i.test(resolvedUrl)) THREE.Cache.add(`file:${resolvedUrl}`, buffer);
}

export interface PreloadItem {
  id: string;
  url: string;
  label: { ja: string; en: string };
  sizeBytes: number;
  type: 'vrm' | 'audio' | 'wasm' | 'binary' | 'image';
}

export interface PreloadProgress {
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
  currentItem: PreloadItem | null;
}

/**
 * 初回タイトル画面前に読み込むコアアセット定義
 * scripts/generate-preload-manifest.js により実ファイルサイズ付きで自動生成されます。
 */
export const INITIAL_PRELOAD_ITEMS: PreloadItem[] = preloadManifest.items as PreloadItem[];

export class AssetPreloader {
  private static cachedUrls = new Set<string>();

  /**
   * 事前アセットリストの合計バイト数を取得
   */
  public static getTotalPreloadBytes(items: PreloadItem[] = INITIAL_PRELOAD_ITEMS): number {
    if (items === INITIAL_PRELOAD_ITEMS && preloadManifest.totalBytes) {
      return preloadManifest.totalBytes;
    }
    return items.reduce((acc, item) => acc + item.sizeBytes, 0);
  }

  /**
   * 初回タイトル画面前のアセット一括プリロード
   */
  public static async preloadInitialAssets(
    onProgress?: (progress: PreloadProgress) => void,
    items: PreloadItem[] = INITIAL_PRELOAD_ITEMS
  ): Promise<void> {
    const totalBytes = this.getTotalPreloadBytes(items);
    let loadedBytesTotal = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      onProgress?.({
        loadedBytes: loadedBytesTotal,
        totalBytes,
        percentage: Math.min(100, Math.round((loadedBytesTotal / totalBytes) * 100)),
        currentItem: item,
      });

      if (!this.cachedUrls.has(item.url)) {
        await this.fetchWithProgress(item.url, (bytesLoadedDelta) => {
          loadedBytesTotal += bytesLoadedDelta;
          onProgress?.({
            loadedBytes: loadedBytesTotal,
            totalBytes,
            percentage: Math.min(100, Math.round((loadedBytesTotal / totalBytes) * 100)),
            currentItem: item,
          });
        });
        this.cachedUrls.add(item.url);
      } else {
        loadedBytesTotal += item.sizeBytes;
        onProgress?.({
          loadedBytes: loadedBytesTotal,
          totalBytes,
          percentage: Math.min(100, Math.round((loadedBytesTotal / totalBytes) * 100)),
          currentItem: item,
        });
      }
    }

    onProgress?.({
      loadedBytes: totalBytes,
      totalBytes,
      percentage: 100,
      currentItem: null,
    });
  }

  /**
   * 幕間などで必要な個別アセット（モーション・背景・ボイス等）を事前読み込み
   */
  public static async preloadAssets(urls: (string | undefined | null)[]): Promise<void> {
    const validUrls = urls.filter((u): u is string => !!u && !this.cachedUrls.has(u));
    if (validUrls.length === 0) return;

    await Promise.all(
      validUrls.map(async (url) => {
        try {
          // 公開先のサブディレクトリ（base）を付けた URL で取得し、ローダーが引くのと同じキーでキャッシュする
          const resolved = resolveAssetUrl(url);
          const res = await fetch(resolved);
          if (res.ok) {
            cacheForLoaders(resolved, await res.arrayBuffer());
            this.cachedUrls.add(url);
          }
        } catch (e) {
          console.warn(`[AssetPreloader] Failed to preload: ${url}`, e);
        }
      })
    );
  }

  /**
   * 幕間待機中に、次に映す場所の背景とシナリオのボイス・登場キャラのモデル・モーションを一括ロード
   * （途中で登場するキャラが遅れて表示されないように）
   */
  public static async preloadSceneAssets(
    locationId?: string,
    scenario?: ScenarioPackage | null,
    options: { phase?: DayPhase } = {}
  ): Promise<void> {
    const layers = locationId ? LOCATION_VISUAL_PRESETS[locationId]?.layers : undefined;
    const urls = [layers?.background?.url, layers?.midground?.url, layers?.nearground?.url, '/animations/Standing Idle.fbx'];
    for (const scene of scenario?.scenes ?? []) {
      urls.push(scene.voiceUrl);
      if (scene.background) urls.push(LOCATION_VISUAL_PRESETS[scene.background]?.layers.background?.url);
      for (const [id, avatar] of Object.entries(scene.avatars ?? {})) {
        const character = CHARACTERS[avatar.characterId ?? id];
        urls.push(avatar.modelUrl ?? outfitModelUrl(character, options.phase ?? 'morning_action'));
        if (avatar.motion) urls.push(`/animations/${avatar.motion}.fbx`);
      }
    }
    await this.preloadAssets([...new Set(urls)]);
  }

  /**
   * 単一リソースのストリーミングダウンロードと進捗通知
   */
  private static async fetchWithProgress(
    url: string,
    onDelta: (bytesDelta: number) => void
  ): Promise<void> {
    try {
      const resolved = resolveAssetUrl(url);
      const response = await fetch(resolved);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for ${url}`);
      }

      if (!response.body) {
        const buffer = await response.arrayBuffer();
        cacheForLoaders(resolved, buffer);
        onDelta(buffer.byteLength);
        return;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          onDelta(value.length);
        }
      }

      // 取得した全チャンクを結合して ArrayBuffer としてキャッシュ
      const allChunks = new Uint8Array(receivedBytes);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      cacheForLoaders(resolved, allChunks.buffer);
    } catch (e) {
      console.warn(`[AssetPreloader] Fetch failed for ${url}:`, e);
    }
  }
}
