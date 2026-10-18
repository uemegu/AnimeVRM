/**
 * 素材の置き場所の設定。
 * - base: 素材のパス（/textures/... など）の前に付ける基準。省略時は Vite の BASE_URL（なければ /）
 * - motionUrl: モーション名から FBX の URL を作る
 * - idleMotion: モーションの指定がないときの待機モーション
 */
export interface AssetConfig {
  base: string;
  motionUrl: (name: string) => string;
  idleMotion: string;
}

const assetConfig: AssetConfig = {
  base: import.meta.env?.BASE_URL || '/',
  motionUrl: (name) => `/animations/${name}.fbx`,
  idleMotion: 'Standing Idle',
};

/** 素材の置き場所を変える（アプリの入口で、描画を始める前に呼ぶ） */
export function configureAssets(config: Partial<AssetConfig>): void {
  Object.assign(assetConfig, config);
}

/** モーション名（または URL）から FBX の URL */
export function motionUrl(motion: string): string {
  return /^(blob:|data:|https?:|\/)/.test(motion) ? motion : assetConfig.motionUrl(motion);
}

/** 待機モーションの URL */
export function idleMotionUrl(): string {
  return motionUrl(assetConfig.idleMotion);
}

/**
 * Resolves a public asset path considering the asset base (e.g. GitHub Pages repository subpath).
 * Idempotent: will not duplicate the base path if already present.
 */
export function resolveAssetUrl(path: string): string {
  const url = resolvePath(path);
  return preloaded.get(url)?.url ?? url;
}

function resolvePath(path: string): string {
  if (!path) return path;
  if (
    path.startsWith('blob:') ||
    path.startsWith('data:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }

  const base = assetConfig.base;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  // If path already starts with normalizedBase, return it as is
  if (path.startsWith(normalizedBase)) {
    return path;
  }

  // If path starts with base without leading slash
  if (normalizedBase.startsWith('/') && path.startsWith(normalizedBase.slice(1))) {
    return `/${path}`;
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${cleanPath}`;
}

/** 先に読み込んでメモリに持っている素材（解決後の URL → blob URL）。同じ素材を複数から読んだ数も数える */
const preloaded = new Map<string, { url: string; users: number }>();
const loading = new Map<string, Promise<void>>();

/**
 * 素材をまとめて読み込み、以後 resolveAssetUrl がメモリ上のものを返すようにする。
 * 読めなかった素材は飛ばす（使うときに通常どおり読む）。返す関数で手放す
 */
export async function preloadAssets(paths: string[], onProgress?: (done: number, total: number) => void): Promise<() => void> {
  const urls = [...new Set(paths.map(resolvePath))];
  let done = 0;
  const held: string[] = [];
  await Promise.all(urls.map(async (url) => {
    const existing = preloaded.get(url);
    if (existing) {
      existing.users++;
      held.push(url);
    } else {
      let pending = loading.get(url);
      if (!pending) {
        pending = fetch(url)
          .then(async (res) => {
            if (!res.ok) throw new Error(`${res.status}`);
            const blob = await res.blob();
            preloaded.set(url, { url: URL.createObjectURL(blob), users: 0 });
          })
          .catch((error) => console.warn(`素材を先読みできません: ${url}`, error))
          .finally(() => loading.delete(url));
        loading.set(url, pending);
      }
      await pending;
      const entry = preloaded.get(url);
      if (entry) {
        entry.users++;
        held.push(url);
      }
    }
    onProgress?.(++done, urls.length);
  }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const url of held) {
      const entry = preloaded.get(url);
      if (!entry || --entry.users > 0) continue;
      URL.revokeObjectURL(entry.url);
      preloaded.delete(url);
    }
  };
}
