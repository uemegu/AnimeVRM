import { LocalizedString } from '../types/scenario';

export interface CharacterMaster {
  id: string;
  name: LocalizedString;
  defaultModelUrl: string;
  themeColor: string;
}

export const CHARACTERS: Record<string, CharacterMaster> = {
  aoi: {
    id: 'aoi',
    name: { ja: 'アオイ', en: 'Aoi' },
    defaultModelUrl: '/models/aoi/aoi-school.vrm',
    themeColor: '#eab308',
  },
  emili: {
    id: 'emili',
    name: { ja: 'エミリ', en: 'Emili' },
    defaultModelUrl: '/models/emili/emili.vrm',
    themeColor: '#ef4444',
  },
  shion: {
    id: 'shion',
    name: { ja: 'シオン', en: 'Shion' },
    defaultModelUrl: '/models/shion/shion-school.vrm',
    themeColor: '#3b82f6',
  },
  god: {
    id: 'god',
    name: { ja: '女神', en: 'Goddess' },
    defaultModelUrl: '/models/god.vrm',
    themeColor: '#f59e0b',
  },
};

