/**
 * Resolves a public asset path considering Vite's base path (e.g. GitHub Pages repository subpath).
 * Idempotent: will not duplicate the base path if already present.
 */
export function resolveAssetUrl(path: string): string {
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
