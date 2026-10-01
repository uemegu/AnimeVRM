/**
 * Pages に出すシナリオ（assets/scenarios/demo/）の並び順と、旧 Pages の URL・共有用画像。
 * slug は旧 Pages の scenarios/<slug>.html（共有されたリンクを新しい再生画面へ転送する）
 */
export interface PagesEntry {
  id: string;
  slug: string;
  /** assets/ 基準の共有用画像（なければ場所の背景） */
  ogp?: string;
}

export const PAGES_ENTRIES: PagesEntry[] = [
  { id: 'park_confession', slug: 'park-confession', ogp: '/ogp/park-confession.png' },
  { id: 'two_girls', slug: 'two-girls', ogp: '/ogp/two-girls.png' },
  { id: 'trio', slug: 'trio', ogp: '/ogp/trio.png' },
  { id: 'harem', slug: 'harem', ogp: '/ogp/harem.png' },
  { id: 'town_walk', slug: 'town-walk', ogp: '/ogp/town-walk.png' },
  { id: 'private_date', slug: 'private-date', ogp: '/ogp/private-date.png' },
  { id: 'teacher_gate', slug: 'teacher-gate', ogp: '/ogp/teacher-gate.png' },
  { id: 'silver_week', slug: 'silver-week', ogp: '/ogp/silver-week.png' },
  { id: 'nisa', slug: 'nisa', ogp: '/ogp/nisa.png' },
  { id: 'fast_motion', slug: 'fast-motion', ogp: '/ogp/fast-motion.png' },
  { id: 'gesture_battle', slug: 'gesture-battle' },
  { id: 'painted_classroom', slug: 'painted-classroom' },
  { id: 'painted_library', slug: 'painted-library' },
  { id: 'painted_gate', slug: 'painted-gate' },
  { id: 'cafe_monitoring', slug: 'cafe-monitoring' },
];

export const SITE_URL = 'https://uemegu.github.io/AnimeVRM/';
export const SITE_NAME = 'AnimeVRM';
