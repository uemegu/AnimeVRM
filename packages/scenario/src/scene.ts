/** シーン設定（assets/studio/time-of-day.json・locations.json）の形。engine の schema/visual.ts を使う */
export * from '@anime-vrm/engine/schema/visual';

/** 組み込みの3D背景（コードで組み立てるセット） */
export const BUILTIN_ENVIRONMENTS = {
  'builtin:painted-classroom': { ja: '簡易3D 教室', en: 'Painted classroom' },
  'builtin:painted-library': { ja: '簡易3D 図書室', en: 'Painted library' },
  'builtin:painted-aoi-room': { ja: '簡易3D アオイの部屋', en: "Painted Aoi's room" },
  'builtin:painted-gym': { ja: '簡易3D 体育館', en: 'Painted gymnasium' },
  'builtin:painted-gate': { ja: '簡易3D 校門', en: 'Painted school gate' },
  'builtin:painted-ground': { ja: '簡易3D 運動場', en: 'Painted sports ground' },
  'builtin:painted-seaside': { ja: '簡易3D 海の見える公園', en: 'Painted seaside park' },
  'builtin:painted-festival': { ja: '簡易3D 夏祭り', en: 'Painted summer festival' },
  'builtin:shopping-street': { ja: '簡易3D 商店街', en: 'Shopping street' },
  'builtin:painted-shrine': { ja: '簡易3D 神社', en: 'Shrine' },
  'builtin:painted-gondola': { ja: '簡易3D 観覧車のゴンドラ', en: 'Ferris wheel gondola' },
} as const;
