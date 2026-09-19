import * as THREE from 'three';
import preloadManifest from '../../data/preloadManifest.json';

// Three.js のメモリキャッシュを有効化
THREE.Cache.enabled = true;

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
          const res = await fetch(url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            // Three.js キャッシュへ追加
            THREE.Cache.add(url, buffer);
            this.cachedUrls.add(url);
          }
        } catch (e) {
          console.warn(`[AssetPreloader] Failed to preload: ${url}`, e);
        }
      })
    );
  }

  /**
   * 幕間待機中に特定ロケーションとシナリオに必要なアセットを一括ロード
   */
  public static async preloadInterludeAssets(
    locationUrls: (string | undefined | null)[] = [],
    scenarioVoiceUrls: (string | undefined | null)[] = [],
    motionUrls: string[] = ['/animations/Standing Idle.fbx']
  ): Promise<void> {
    const allUrls = [...locationUrls, ...scenarioVoiceUrls, ...motionUrls];
    await this.preloadAssets(allUrls);
  }

  /**
   * 単一リソースのストリーミングダウンロードと進捗通知
   */
  private static async fetchWithProgress(
    url: string,
    onDelta: (bytesDelta: number) => void
  ): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for ${url}`);
      }

      if (!response.body) {
        const buffer = await response.arrayBuffer();
        THREE.Cache.add(url, buffer);
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

      THREE.Cache.add(url, allChunks.buffer);
    } catch (e) {
      console.warn(`[AssetPreloader] Fetch failed for ${url}:`, e);
    }
  }
}
