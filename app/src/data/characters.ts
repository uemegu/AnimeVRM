import { LocalizedString } from '../types/scenario';

export interface CharacterMaster {
  id: string;
  name: LocalizedString;
  shortDescription: LocalizedString;
  defaultModelUrl: string;
  themeColor: string;
}

export const CHARACTERS: Record<string, CharacterMaster> = {
  aoi: {
    id: 'aoi',
    name: { ja: 'アオイ', en: 'Aoi' },
    shortDescription: {
      ja: '元気で明るい幼馴染。陸上部所属でいつもグラウンドを走っている。',
      en: 'A cheerful childhood friend. Belongs to the track club and is always seen running.',
    },
    defaultModelUrl: '/models/aoi/aoi-school.vrm',
    themeColor: '#38bdf8',
  },
  shion: {
    id: 'shion',
    name: { ja: 'シオン', en: 'Shion' },
    shortDescription: {
      ja: '物静かで読書好きな図書委員。放課後は図書室や教室で静かに過ごしている。',
      en: 'A quiet, book-loving library committee member. Often spends after-school hours in the library.',
    },
    defaultModelUrl: '/models/shion/shion-school.vrm',
    themeColor: '#a855f7',
  },
  emili: {
    id: 'emili',
    name: { ja: 'エミリ', en: 'Emili' },
    shortDescription: {
      ja: '海外からやってきたお嬢様転校生。屋上や中庭で日向ぼっこをしていることが多い。',
      en: 'A transfer student from abroad. Often found relaxing in the courtyard or on the rooftop.',
    },
    defaultModelUrl: '/models/emili/emili.vrm',
    themeColor: '#fbbf24',
  },
};
