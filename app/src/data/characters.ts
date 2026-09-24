import { LocalizedString } from '../types/scenario';

export interface CharacterMaster {
  id: string;
  name: LocalizedString;
  defaultModelUrl: string;
  /** 休日など私服で登場するときのモデル */
  privateModelUrl?: string;
  /** 朝の登校中（通学カバンを背負った）モデル */
  commuteModelUrl?: string;
  themeColor: string;
}

export const CHARACTERS: Record<string, CharacterMaster> = {
  aoi: {
    id: 'aoi',
    name: { ja: 'アオイ', en: 'Aoi' },
    defaultModelUrl: '/models/aoi/aoi-school.vrm',
    privateModelUrl: '/models/aoi/aoi-private.vrm',
    commuteModelUrl: '/models/aoi/aoi-school-with-bag.vrm',
    themeColor: '#eab308',
  },
  emili: {
    id: 'emili',
    name: { ja: 'エミリ', en: 'Emili' },
    defaultModelUrl: '/models/emili/emili.vrm',
    privateModelUrl: '/models/emili/emili-private.vrm',
    commuteModelUrl: '/models/emili/emili-school-with-bag.vrm',
    themeColor: '#ef4444',
  },
  shion: {
    id: 'shion',
    name: { ja: 'シオン', en: 'Shion' },
    defaultModelUrl: '/models/shion/shion-school.vrm',
    privateModelUrl: '/models/shion/shion-private.vrm',
    commuteModelUrl: '/models/shion/shion-school-with-bag.vrm',
    themeColor: '#3b82f6',
  },
  god: {
    id: 'god',
    name: { ja: '女神', en: 'Goddess' },
    defaultModelUrl: '/models/god.vrm',
    themeColor: '#f59e0b',
  },
  // 担任。クールで厳しいが、少女漫画と恋バナに目がない
  teacher: {
    id: 'teacher',
    name: { ja: '白石先生', en: 'Ms. Shiraishi' },
    defaultModelUrl: '/models/teacher/teacher.vrm',
    themeColor: '#64748b',
  },
  // 主人公の悪友。恋愛経験ゼロの自称恋愛マスター
  naruse: {
    id: 'naruse',
    name: { ja: 'ナルセ', en: 'Naruse' },
    defaultModelUrl: '/models/boy.vrm',
    themeColor: '#0ea5e9',
  },
  // クラスメイトの噂好きコンビ
  yui: {
    id: 'yui',
    name: { ja: 'ユイ', en: 'Yui' },
    defaultModelUrl: '/models/mob/classmate_yui.vrm',
    themeColor: '#a855f7',
  },
  kana: {
    id: 'kana',
    name: { ja: 'カナ', en: 'Kana' },
    defaultModelUrl: '/models/mob/classmate_kana.vrm',
    themeColor: '#14b8a6',
  },
};

/** 好感度を持つヒロイン */
export const HEROINE_IDS = ['aoi', 'emili', 'shion'] as const;

