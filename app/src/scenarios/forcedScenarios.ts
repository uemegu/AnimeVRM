import { ScenarioPackage } from '../types/scenario';

/** 強制イベント: 廊下でシオンとぶつかる（未遭遇救済） */
export const FORCED_SCENARIO_MEET_SHION: ScenarioPackage = {
  id: 'forced_meet_shion',
  title: { ja: '偶然の出会い: 廊下のシオン', en: 'Fateful Encounter: Shion in the Corridor' },
  characters: [{ id: 'shion', modelUrl: '/models/shion/shion.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '移動教室のため廊下を急いでいると、曲がり角で本を抱えた生徒とぶつかりそうになった。',
        en: 'While rushing down the corridor between classes, I nearly bumped into a student carrying books.',
      },
    },
    {
      id: 's2',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: 'きゃっ……！ あ、危ないところでした……。',
        en: 'Eek...! Ah, that was close...',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'surprised', expressionWeight: 1.0 },
      },
    },
    {
      id: 's3',
      speaker: '',
      text: {
        ja: '床に落ちた本を拾い集めて手渡した。彼女は胸に本を抱え直すと、静かに頭を下げた。',
        en: 'I picked up the books that fell and handed them to her. Clutching them to her chest, she bowed gently.',
      },
    },
    {
      id: 's4',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: 'ありがとうございます。私は図書委員のシオンと申します。助かりました。',
        en: 'Thank you very much. I am Shion from the library committee. You truly saved me.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      setFlags: { met_shion: true },
    },
  ],
};

/** 強制イベント: 中庭でエミリに道を聞かれる（未遭遇救済） */
export const FORCED_SCENARIO_MEET_EMILI: ScenarioPackage = {
  id: 'forced_meet_emili',
  title: { ja: '偶然の出会い: 迷子のエミリ', en: 'Fateful Encounter: Lost Emili' },
  characters: [{ id: 'emili', modelUrl: '/models/emili/emili.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '中庭を歩いていると、キョロキョロと校舎を見上げている金髪の少女がいた。',
        en: 'Walking across the courtyard, I spotted a blonde girl looking around curiously at the buildings.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'Excuse me... あ、あの、職員室はどちらかしら？まだ校舎の配置に不慣れで……。',
        en: "Excuse me... Um, could you tell me where the staff room is? I'm not familiar with the layout yet...",
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'surprised', expressionWeight: 1.0 },
      },
    },
    {
      id: 's3',
      speaker: '',
      text: {
        ja: '職員室への道を丁寧に案内すると、彼女はパッと表情を明るくした。',
        en: 'When I carefully guided her to the staff room, her face immediately brightened with joy.',
      },
    },
    {
      id: 's4',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'Thank you! とても親切にしてくださって感謝しますわ。私はエミリと申します。またお会いしましょうね。',
        en: 'Thank you! You are so kind. My name is Emili. I hope to see you again soon.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      setFlags: { met_emili: true },
    },
  ],
};
