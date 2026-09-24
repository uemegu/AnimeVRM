import { LocationVisualPreset } from '../types/visual';

/** 遠景1枚だけの場所 */
function preset(id: string, name: string, isIndoor: boolean, url: string): LocationVisualPreset {
  return { id, name, isIndoor, layers: { background: { url } } };
}

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

  // 自宅マンションの玄関前
  apartment_door: preset('apartment_door', 'マンションの玄関前', false, '/textures/apartment_door_far.avif'),
  // 体育館
  gym: preset('gym', '体育館', true, '/textures/gym_far.avif'),
  // 職員室
  staff_room: preset('staff_room', '職員室', true, '/textures/staff_room_far.avif'),
  // 黒塗りのセダンが並ぶ校門前
  gate_ambush: preset('gate_ambush', '校門前', false, '/textures/gate_ambush_far.avif'),
  // 夕立の神社
  shrine_rain: preset('shrine_rain', '神社', true, '/textures/shrine_rain_far.avif'),
  // 病室
  hospital: preset('hospital', '病室', true, '/textures/hospital_far.avif'),

  // ---- 休日（街マップ）の行き先 ----

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
  shopping_street: preset('shopping_street', '商店街', false, '/textures/town2_far.avif'),

  // 映画館
  cinema: preset('cinema', '映画館', true, '/textures/cinema_far.avif'),

  // アオイの部屋
  aoi_house: preset('aoi_house', 'アオイの部屋', true, '/textures/aoi_room_far.avif'),

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

  // 遊園地
  amusement_park: preset('amusement_park', '遊園地', false, '/textures/amusement_park_far.avif'),

  // 水族館
  aquarium: preset('aquarium', '水族館', true, '/textures/aquarium_far.avif'),
};
