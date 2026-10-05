import * as THREE from 'three';

/**
 * three.js のローダーのキャッシュ（THREE.Cache）を、容量の上限付きにする。
 * 素のままでは読み込んだ VRM・モーション・画像をゲーム終了まで全部持ち続け、21日遊ぶとメモリが膨らむ。
 * 上限を超えたら、最後に使ってから時間が経ったものから捨てる（次に要るときはブラウザのキャッシュから読み直す）。
 */

/** 上限（バイト）。1シーンに出るキャラのモデル（1体 15〜20MB）と、よく使うモーション・背景が収まるくらい */
export const ASSET_CACHE_BUDGET = 192 * 1024 * 1024;

/** キャッシュの中身のおおよその大きさ */
function sizeOf(file: unknown): number {
  if (file instanceof ArrayBuffer) return file.byteLength;
  if (ArrayBuffer.isView(file)) return file.byteLength;
  if (typeof file === 'string') return file.length * 2;
  const image = file as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null;
  if (image && typeof image === 'object') {
    const w = image.naturalWidth || image.width || 0;
    const h = image.naturalHeight || image.height || 0;
    return w * h * 4;
  }
  return 0;
}

let installed = false;

export function installBoundedAssetCache(budget = ASSET_CACHE_BUDGET): void {
  if (installed) return;
  installed = true;
  /** 使った順（Map の挿入順。使うたびに末尾へ） */
  const entries = new Map<string, { file: unknown; size: number }>();
  let total = 0;
  const cache = THREE.Cache as unknown as {
    enabled: boolean;
    files: Record<string, unknown>;
    add: (key: string, file: unknown) => void;
    get: (key: string) => unknown;
    remove: (key: string) => void;
    clear: () => void;
  };
  const evict = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    total -= entry.size;
  };
  cache.enabled = true;
  cache.add = (key, file) => {
    if (key.includes('blob:')) return;
    evict(key);
    const size = sizeOf(file);
    // 上限より大きい物は持たない
    if (size > budget) return;
    entries.set(key, { file, size });
    total += size;
    for (const oldest of entries.keys()) {
      if (total <= budget) break;
      if (oldest === key) continue;
      evict(oldest);
    }
  };
  cache.get = (key) => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    entries.delete(key);
    entries.set(key, entry);
    return entry.file;
  };
  cache.remove = (key) => evict(key);
  cache.clear = () => {
    entries.clear();
    total = 0;
  };
  // 計測・デバッグ用（開発時に容量を確かめる）
  Object.defineProperty(cache, 'files', { get: () => Object.fromEntries([...entries].map(([k, v]) => [k, v.file])) });
  (cache as unknown as { totalBytes: () => number }).totalBytes = () => total;
}
