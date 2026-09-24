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
        url: '/textures/school-courtyard-far.avif',
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
        url: '/textures/school-library-far.avif',
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
        url: '/textures/school-ground-far.avif',
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
        url: '/textures/school-cafeteria-far.avif',
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

  // 神社（実験シナリオ・イベント用）
  shrine: {
    id: 'shrine',
    name: '神社',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/shrine_far.avif',
      },
    },
  },

  // 神界（白背景）
  god_realm: {
    id: 'god_realm',
    name: '神界',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/white_far.avif',
      },
    },
  },

  // ---- 休日（街マップ）の行き先 ----
  // TODO: 映画館・遊園地・水族館は専用背景がないため既存背景で代用中

  // 公園
  park: {
    id: 'park',
    name: '公園',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/park-background.avif',
      },
    },
  },

  // 商店街
  shopping_street: {
    id: 'shopping_street',
    name: '商店街',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/town_far.avif',
      },
    },
  },

  // 映画館（代用: カフェ）
  cinema: {
    id: 'cinema',
    name: '映画館',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/cafe_far.avif',
      },
    },
  },

  // 自宅（昼の自室）
  home: {
    id: 'home',
    name: '自宅',
    isIndoor: true,
    layers: {
      background: {
        url: '/textures/myroom_far.avif',
      },
    },
  },

  // 遊園地（代用: 公園の俯瞰）
  amusement_park: {
    id: 'amusement_park',
    name: '遊園地',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/modern-park-far.avif',
      },
    },
  },

  // 水族館（代用: 海の見える公園）
  aquarium: {
    id: 'aquarium',
    name: '水族館',
    isIndoor: false,
    layers: {
      background: {
        url: '/textures/park-with-sea-far.avif',
      },
    },
  },
};
