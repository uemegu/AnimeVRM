import { ScenarioPackage } from '../types/scenario';

export const GOD_EXPERIMENT_SCENARIO: ScenarioPackage = {
  id: 'god_prologue_experiment',
  title: {
    ja: '【実験】神社と女神の宣告',
    en: 'Experiment: Goddess at the Shrine',
  },
  scenes: [
    // 1. 神社にいる
    {
      id: 'scene_01_shrine_enter',
      speaker: '',
      text: {
        ja: '放課後、アオイに誘われて近くの神社に立ち寄った。',
        en: 'After school, Aoi invited me to stop by the nearby shrine.',
      },
      background: 'shrine',
      timeOfDay: 'day',
      avatars: {
        aoi: {
          characterId: 'aoi',
          visible: true,
          position: 'right',
          expression: 'neutral',
          expressionWeight: 1.0,
        },
      },
    },
    // アオイとの会話
    {
      id: 'scene_02_aoi_talk',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'ここ、静かで落ち着くよね。……ねえ、ちょっとお願い事していかない？',
        en: "It's so peaceful and calming here... Hey, want to make a wish together?",
      },
      voiceUrl: '/voices/god_exp_01_aoi.wav',
      background: 'shrine',
      timeOfDay: 'day',
      avatars: {
        aoi: {
          characterId: 'aoi',
          visible: true,
          position: 'right',
          expression: 'happy',
          expressionWeight: 1.0,
        },
      },
    },
    // 2. 突然明るくなる（ホワイトフラッシュ）
    {
      id: 'scene_03_sudden_flash',
      speaker: '',
      text: {
        ja: '――っ！？ 突如として視界全体が目も眩むような閃光に呑み込まれる。',
        en: 'What...!? Suddenly, the entire field of vision is engulfed in a blinding white flash.',
      },
      background: 'god_realm',
      timeOfDay: 'divine',
      flashEffect: 'white',
      avatars: {
        god: {
          characterId: 'god',
          visible: true,
          position: 'center',
          expression: 'neutral',
          expressionWeight: 1.0,
        },
      },
    },
    // 3. Godが表示される（背景は白）＆ 4. リバーブのかかった声で女神が喋る
    {
      id: 'scene_04_god_appear',
      speaker: { ja: '？？？', en: '???' },
      speakerCharacterId: 'god',
      text: {
        ja: '……迷える人の子よ。私の声が聞こえますか？',
        en: '...Lost mortal child. Can you hear my voice?',
      },
      voiceUrl: '/voices/god_exp_02_god.wav',
      background: 'god_realm',
      timeOfDay: 'divine',
      avatars: {
        god: {
          characterId: 'god',
          visible: true,
          position: 'center',
          expression: 'neutral',
          expressionWeight: 1.0,
        },
      },
    },
    // 5. なんか会話
    {
      id: 'scene_05_god_talk',
      speaker: { ja: '女神', en: 'Goddess' },
      speakerCharacterId: 'god',
      text: {
        ja: 'そなたの煮え切らない想い……見ていて少々じれったくなってしまいました。',
        en: 'Watching your indecisive feelings... has made me rather impatient.',
      },
      voiceUrl: '/voices/god_exp_03_god.wav',
      background: 'god_realm',
      timeOfDay: 'divine',
      avatars: {
        god: {
          characterId: 'god',
          visible: true,
          position: 'center',
          expression: 'neutral',
          expressionWeight: 1.0,
        },
      },
    },
    // 5（後半）. 「私がGOといったら5秒で告白しなさい。5秒で告白しないと◯すから。」（ピー音）
    {
      id: 'scene_06_god_censor',
      speaker: { ja: '女神', en: 'Goddess' },
      speakerCharacterId: 'god',
      text: {
        ja: '私がGOといったら5秒で告白しなさい。5秒で告白しないと◯すから。',
        en: 'When I say GO, confess your love in 5 seconds. If you don’t within 5 seconds, I will [BLEEP] you.',
      },
      voiceUrl: '/voices/god_exp_04_god.wav',
      background: 'god_realm',
      timeOfDay: 'divine',
      avatars: {
        god: {
          characterId: 'god',
          visible: true,
          position: 'center',
          expression: 'angry',
          expressionWeight: 1.0,
        },
      },
    },
    // 6. 閃光とともにGod消えて神社に戻る
    {
      id: 'scene_07_flash_return',
      speaker: '',
      text: {
        ja: 'え……！？ ちょ、ちょっと待ってくれ――！',
        en: 'Wait...!? Hold on a second—!',
      },
      background: 'shrine',
      timeOfDay: 'day',
      flashEffect: 'white',
      avatars: {
        aoi: {
          characterId: 'aoi',
          visible: true,
          position: 'center',
          expression: 'surprised',
          expressionWeight: 1.0,
        },
      },
    },
    // 7. アオイがどうしたの？的な感じで話しかけてくる
    {
      id: 'scene_08_aoi_concern',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: '……？ どうしたの？ 急にぼーっとして、顔真っ青だよ？',
        en: '...? Are you okay? You suddenly zoned out and turned pale!',
      },
      voiceUrl: '/voices/god_exp_05_aoi.wav',
      background: 'shrine',
      timeOfDay: 'day',
      avatars: {
        aoi: {
          characterId: 'aoi',
          visible: true,
          position: 'center',
          expression: 'surprised',
          expressionWeight: 1.0,
        },
      },
    },
    // 終わり
    {
      id: 'scene_09_ending_monologue',
      speaker: '',
      text: {
        ja: '（さっきのは……幻覚？ いや……でも、5秒で告白しないと◯すって……絶対本気だったぞ……！？）',
        en: '(Was that a hallucination...? But "confess in 5 seconds or else"... She was definitely dead serious...!)',
      },
      background: 'shrine',
      timeOfDay: 'day',
      avatars: {
        aoi: {
          characterId: 'aoi',
          visible: true,
          position: 'center',
          expression: 'neutral',
          expressionWeight: 1.0,
        },
      },
    },
  ],
};
