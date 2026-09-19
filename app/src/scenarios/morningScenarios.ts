import { ScenarioPackage } from '../types/scenario';

export const MORNING_SCENARIO_DAY_1: ScenarioPackage = {
  id: 'morning_day_1',
  title: { ja: '第1日 朝: 新学期の始まり', en: 'Day 1 Morning: Start of the Semester' },
  characters: [{ id: 'aoi', modelUrl: '/models/aoi/aoi.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 'scene_1',
      speaker: '',
      text: {
        ja: '暖かな春の陽光が桜並木を照らす。今日から新しい学期が始まる。',
        en: 'Warm spring sunlight illuminates the cherry blossoms. A new semester starts today.',
      },
      bgm: 'main_bgm',
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 'scene_2',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'おーい！おはよう！やっぱりここであったね。',
        en: 'Heeey! Good morning! I knew I would run into you here.',
      },
      voiceUrl: '/voices/001.wav',
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 'scene_3',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: '今日から2年生だよ！放課後も部活あるから、時間があったらグラウンド見に来てね！',
        en: "We're 2nd years now! I have track club after school, come check it out if you have time!",
      },
      voiceUrl: '/voices/chat_intro_1.wav',
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      setFlags: { met_aoi: true },
    },
    {
      id: 'scene_4',
      speaker: '',
      text: {
        ja: 'アオイと笑顔を交わしながら校門をくぐった。今日も良い1日になりそうだ。',
        en: 'We walked through the school gate together, smiling. Today feels like the start of something great.',
      },
    },
  ],
};

export const MORNING_SCENARIO_DEFAULT: ScenarioPackage = {
  id: 'morning_default',
  title: { ja: '朝の登校', en: 'Morning Walk to School' },
  scenes: [
    {
      id: 'scene_1',
      speaker: '',
      text: {
        ja: '爽やかな朝の風を感じながら、通学路を歩く。',
        en: 'Walking along the school route, feeling the refreshing morning breeze.',
      },
    },
    {
      id: 'scene_2',
      speaker: '',
      text: {
        ja: '教室に向かって歩みを進めた。さあ、今日も1日頑張ろう。',
        en: "Heading towards the classroom. Let's make the most of today.",
      },
    },
  ],
};
