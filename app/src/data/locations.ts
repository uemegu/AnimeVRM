import { ActionLocationId, ActionLocationOption } from '../types/game';

export const LOCATION_DEFINITIONS: Record<ActionLocationId, ActionLocationOption> = {
  classroom: {
    id: 'classroom',
    name: { ja: '教室', en: 'Classroom' },
    description: {
      ja: 'いつもの教室。休み時間には友人たちが雑談している。',
      en: 'Our usual classroom. Friends gather here during breaks.',
    },
  },
  courtyard: {
    id: 'courtyard',
    name: { ja: '中庭', en: 'Courtyard' },
    description: {
      ja: '緑豊かな校舎の中庭。ベンチがあり、のんびり過ごすのに最適。',
      en: 'A lush green courtyard between school buildings with benches.',
    },
  },
  corridor: {
    id: 'corridor',
    name: { ja: '廊下', en: 'Corridor' },
    description: {
      ja: '生徒たちが行き交う廊下。掲示板や昇降口へ通じている。',
      en: 'The hallway connecting classrooms and stairs.',
    },
  },
  rooftop: {
    id: 'rooftop',
    name: { ja: '屋上', en: 'Rooftop' },
    description: {
      ja: '見晴らしの良い屋上。風が心地よく、昼休みには人気の穴場。',
      en: 'The open rooftop with a wide sky view and gentle breeze.',
    },
  },
  library: {
    id: 'library',
    name: { ja: '図書室', en: 'Library' },
    description: {
      ja: '静寂に包まれた図書室。読書や自習をする生徒がいる。',
      en: 'A quiet library filled with books, perfect for study and reading.',
    },
  },
  sports_ground: {
    id: 'sports_ground',
    name: { ja: '運動場', en: 'Sports Ground' },
    description: {
      ja: '広大なグラウンド。体育の授業や運動部の熱気で活気がある。',
      en: 'The wide school sports ground bustling with club activities.',
    },
  },
  cafeteria: {
    id: 'cafeteria',
    name: { ja: '購買・学食', en: 'Cafeteria' },
    description: {
      ja: 'パンやお弁当を求める生徒で賑わう購買スペース。',
      en: 'The bustling cafeteria and bakery shop.',
    },
  },
};
