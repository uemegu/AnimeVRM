import { LocationVisualPreset } from '../types/visual';

/**
 * ロケーション別ビジュアルプリセット
 * 時間帯に依存しない、純粋な多層背景（遠景・中景・近景）のアセット定義
 */
export const LOCATION_VISUAL_PRESETS: Record<string, LocationVisualPreset> = {
  // 教室
  classroom: {
    id: 'classroom',
    name: '教室',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/school_classroom_far.avif',
      },
    },
  },

  // 廊下
  corridor: {
    id: 'corridor',
    name: '廊下',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/school-corridor-far.avif',
      },
    },
  },

  // 中庭
  courtyard: {
    id: 'courtyard',
    name: '中庭',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/modern-park-far.avif',
      },
      midground: {
        url: '/textures/modern-park-mid.avif',
        position: { x: 0, y: 1.35, z: -0.25 },
        scale: 1.15,
        opacity: 1.0,
      },
    },
  },

  // 屋上
  rooftop: {
    id: 'rooftop',
    name: '屋上',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/school-rooftop-far.avif',
      },
    },
  },

  // 図書室
  library: {
    id: 'library',
    name: '図書室',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/school-classroom-far2.avif',
      },
    },
  },

  // 運動場 / グラウンド
  sports_ground: {
    id: 'sports_ground',
    name: '運動場',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/park-background.avif',
      },
    },
  },

  // 購買・カフェ
  cafeteria: {
    id: 'cafeteria',
    name: '購買・学食',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/cafe_far.avif',
      },
      nearground: {
        url: '/textures/cafe_near.avif',
        position: { x: 0, y: 0.8, z: 0.6 },
        scale: 1.0,
        opacity: 1.0,
      },
    },
  },

  // 校門・通学路（朝イベント等）
  school_gate: {
    id: 'school_gate',
    name: '校門',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/school-gate-far.avif',
      },
    },
  },

  // 自室（夜フェーズ）
  myroom: {
    id: 'myroom',
    name: '自室',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/myroom_far.avif',
      },
    },
  },

  // 通学路・街
  town: {
    id: 'town',
    name: '通学路',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/town_far.avif',
      },
    },
  },
};
