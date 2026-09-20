import { ActionLocationId, ActionLocationOption } from '../types/game';

export const LOCATION_DEFINITIONS: Record<ActionLocationId, ActionLocationOption> = {
  classroom: {
    id: 'classroom',
    name: { ja: '教室', en: 'Classroom' },
  },
  courtyard: {
    id: 'courtyard',
    name: { ja: '中庭', en: 'Courtyard' },
  },
  corridor: {
    id: 'corridor',
    name: { ja: '廊下', en: 'Corridor' },
  },
  rooftop: {
    id: 'rooftop',
    name: { ja: '屋上', en: 'Rooftop' },
  },
  library: {
    id: 'library',
    name: { ja: '図書室', en: 'Library' },
  },
  sports_ground: {
    id: 'sports_ground',
    name: { ja: '運動場', en: 'Sports Ground' },
  },
  cafeteria: {
    id: 'cafeteria',
    name: { ja: '購買・学食', en: 'Cafeteria' },
  },
};
