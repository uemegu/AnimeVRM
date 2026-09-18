import { ScenarioPackage } from '../types/scenario';

/**
 * 動作確認・テスト用のサンプルシナリオ
 * 単一インスタンス・多言語テキスト保持（英語ボイスなし・日本語ボイスURLのみ管理）
 */
export const SAMPLE_SCENARIO: ScenarioPackage = {
  id: 'morning_encounter',
  title: {
    ja: 'Day 1 朝の出会い',
    en: 'Day 1 Morning Encounter',
  },
  scenes: [
    {
      id: 'scene_01',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'girl_01',
      text: {
        ja: 'おはよう！今日もいい天気だね。',
        en: 'Good morning! Beautiful weather today, right?',
      },
      voiceUrl: '/voices/aoi_morning_01.wav',
      avatars: {
        girl_01: {
          characterId: 'girl_01',
          expression: 'happy',
          expressionWeight: 1.0,
          position: 'center',
        },
      },
    },
    {
      id: 'scene_02',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'girl_01',
      text: {
        ja: '放課後、一緒に図書室に行かない？',
        en: 'Do you want to go to the library together after school?',
      },
      voiceUrl: '/voices/aoi_morning_02.wav',
      avatars: {
        girl_01: {
          characterId: 'girl_01',
          expression: 'neutral',
          expressionWeight: 1.0,
          position: 'center',
        },
      },
    },
    {
      id: 'scene_choice',
      text: '', // 選択肢シーンはルールに基づきテキスト空
      choices: [
        {
          text: {
            ja: 'もちろん、一緒に行こう！',
            en: 'Of course, let\'s go together!',
          },
          goto: 'scene_accept',
          setFlags: { promised_library_with_aoi: true },
          addAffinity: { girl_01: 5 },
        },
        {
          text: {
            ja: 'ごめん、今日は用事があるんだ。',
            en: 'Sorry, I have something else to do today.',
          },
          goto: 'scene_decline',
          setFlags: { promised_library_with_aoi: false },
        },
      ],
    },
    {
      id: 'scene_accept',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'girl_01',
      text: {
        ja: 'やった！約束だよ、楽しみにしてるね！',
        en: 'Yay! It\'s a promise then, can\'t wait!',
      },
      voiceUrl: '/voices/aoi_accept.wav',
      avatars: {
        girl_01: {
          characterId: 'girl_01',
          expression: 'happy',
          expressionWeight: 1.0,
          position: 'center',
        },
      },
      nextSceneId: 'scene_end',
    },
    {
      id: 'scene_decline',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'girl_01',
      text: {
        ja: 'そっか……残念。また今度誘うね。',
        en: 'I see... That\'s too bad. I\'ll ask you again another time.',
      },
      voiceUrl: '/voices/aoi_decline.wav',
      avatars: {
        girl_01: {
          characterId: 'girl_01',
          expression: 'sad',
          expressionWeight: 1.0,
          position: 'center',
        },
      },
      nextSceneId: 'scene_end',
    },
    {
      id: 'scene_end',
      text: {
        ja: 'アオイと別れて教室へ向かった。',
        en: 'I parted ways with Aoi and headed to the classroom.',
      },
      // 次のシーンがないためここでシナリオ終了
    },
  ],
};
