import { ActionLocationId, ActionLocationOption } from '../types/game';
import { SupportedLanguage } from '../types/scenario';

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
  park: {
    id: 'park',
    name: { ja: '公園', en: 'Park' },
  },
  shopping_street: {
    id: 'shopping_street',
    name: { ja: '商店街', en: 'Shopping Street' },
  },
  cinema: {
    id: 'cinema',
    name: { ja: '映画館', en: 'Cinema' },
  },
  home: {
    id: 'home',
    name: { ja: '自宅', en: 'Home' },
  },
  amusement_park: {
    id: 'amusement_park',
    name: { ja: '遊園地', en: 'Amusement Park' },
  },
  aquarium: {
    id: 'aquarium',
    name: { ja: '水族館', en: 'Aquarium' },
  },
};

/** 平日の行動ターンで選べる場所（学校マップ） */
export const SCHOOL_ACTION_LOCATIONS: ActionLocationId[] = [
  'classroom',
  'courtyard',
  'rooftop',
  'library',
  'cafeteria',
  'sports_ground',
];

/**
 * 休日の行動ターンで選べる場所（街マップ）
 * unlockFlag を持つ場所は、そのフラグが立つまで選択肢に出ない
 */
export const HOLIDAY_ACTION_LOCATIONS: Array<{ id: ActionLocationId; unlockFlag?: string }> = [
  { id: 'park' },
  { id: 'shopping_street' },
  { id: 'cinema' },
  { id: 'home' },
  { id: 'amusement_park', unlockFlag: 'unlock_amusement_park' },
  { id: 'aquarium', unlockFlag: 'unlock_aquarium' },
];

/** 行動ターンでは選べないがシナリオの舞台になる場所の表示名 */
const SCENE_LOCATION_NAMES: Record<string, { ja: string; en: string }> = {
  myroom: { ja: '自室', en: 'My Room' },
  school_gate: { ja: '正門前', en: 'School Gate' },
  shrine: { ja: '神社', en: 'Shrine' },
  god_realm: { ja: '神界', en: 'God Realm' },
};

/** 場所IDの表示名（未登録ならIDをそのまま返す） */
export function getLocationName(locationId: string, lang: SupportedLanguage): string {
  const name =
    SCENE_LOCATION_NAMES[locationId] ?? LOCATION_DEFINITIONS[locationId as ActionLocationId]?.name;
  return name ? name[lang] || name.ja : locationId;
}
