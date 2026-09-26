import path from 'node:path';

/** URL から受け取る ID（カテゴリ・シナリオ ID・ファイル名の本体など）に使える文字 */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function isSafeSegment(value: string): boolean {
  return SEGMENT.test(value) && !value.includes('..');
}

/**
 * base の中に収まるパスだけを返す。外に出る（../ など）場合や不正な区切りは null
 */
export function resolveInside(base: string, ...segments: string[]): string | null {
  if (segments.some((s) => !s.split('/').every(isSafeSegment))) return null;
  const resolved = path.resolve(base, ...segments);
  const root = path.resolve(base);
  return resolved === root || resolved.startsWith(root + path.sep) ? resolved : null;
}
