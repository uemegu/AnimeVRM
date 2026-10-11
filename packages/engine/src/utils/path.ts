/**
 * Resolves a public asset path considering Vite's base path (e.g. GitHub Pages repository subpath).
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

  const base = import.meta.env.BASE_URL || '/';
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
