import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';

export const SILVER_WEEK_SCENARIO_JA: ScenarioPackage = {
  id: 'silver-week',
  title: 'シルバーウィークの黄昏 〜アオイとエミリの帰り道〜',
  characters: [
    {
      id: 'girl_01',
      character: '/models/aoi/aoi-private.vrm',
      position: 'left',
    },
    {
      id: 'girl_02',
      character: '/models/emili/emili-private.vrm',
      position: 'right',
    },
  ],
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.22,
  chapters: [
    {
      id: 'main',
      title: '連休の終わりと夕焼けの街',
      scenes: [
        // Scene 1: 街の夕暮れ、アオイの背伸び＆ため息（アオイへズーム、カット内複数モーション・表情遷移）
        {
          id: 'sw_1',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '夕暮れの並木道',
          scenePreset: 'evening_outdoor',
          background: '/textures/town_far.avif',
          text: '「ふあぁ……楽しかったシルバーウィークも、とうとう今日で終わっちゃうね……」',
          voiceUrl: '/voices/sw_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'relax',
              expressionWeight: 1.0,
              lookAtCamera: false,
              headLookAtCamera: false,
              transitions: [
                // 1.5秒で大きく背伸び
                {
                  at: 1.5,
                  motion: '/animations/ardy_stretch.fbx',
                  expression: 'sad',
                  expressionWeight: 1.0,
                },
                // 4.0秒で両手を広げて「やれやれ」のジェスチャー、エミリに視線を向ける
                {
                  at: 4.0,
                  motion: '/animations/ardy_shrug.fbx',
                  expression: 'neutral',
                  expressionWeight: 1.0,
                  lookAtTarget: 'partner',
                },
              ],
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },

        // Scene 2: エミリのポジティブな返し（エミリへズーム、カット内複数遷移）
        {
          id: 'sw_2',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'partner',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '「ほんと、あっという間だったよね！ でもアオイとショッピングもカフェも行けて、最高に充実してたよ！」',
          voiceUrl: '/voices/sw_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'relax',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 1.8秒で胸を張って満足げにアピール
                {
                  at: 1.8,
                  motion: '/animations/ardy_proud.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
                // 4.5秒で元気に手を振る
                {
                  at: 4.5,
                  motion: '/animations/ardy_wave.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
              ],
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Scene 3: アオイのうなずきと笑顔（アオイへズーム、カット内遷移）
        {
          id: 'sw_3',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '「うん！ エミリちゃんのおかげで、毎日すっごく笑ってた気がするな〜」',
          voiceUrl: '/voices/sw_3.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Acknowledging.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 2.5秒でリラックス笑顔＆両手を広げる
                {
                  at: 2.5,
                  motion: '/animations/ardy_shrug.fbx',
                  expression: 'relax',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
              ],
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Scene 4: エミリが明日からの学校について問いかける（エミリへズーム）
        {
          id: 'sw_4',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'player',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '「ねえ、明日からまた学校だけど……放課後の約束、どうする？」',
          voiceUrl: '/voices/sw_4.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02: {
              motion: '/animations/ardy_proud.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
        },

        // Scene 5: 選択肢シーン（ガイドライン厳守: textは空文字、ナレーション・セリフ完全排除、2ショットwide）
        {
          id: 'sw_choice',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
          },
          cameraZoom: 'wide',
          choices: [
            {
              text: '明日、みんなで一緒に登校しよう！',
              goto: 'sw_reaction_together',
            },
            {
              text: '次の連休も、また一緒に遊びに行こう！',
              goto: 'sw_reaction_next_trip',
            },
          ],
        },

        // Branch A: 一緒に登校（2ショットwide）
        {
          id: 'sw_reaction_together',
          speaker: 'アオイ & エミリ',
          dialogueTarget: 'player',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '「賛成！ じゃあ明日の朝、いつもの交差点で待ち合わせね！」',
          voiceUrl: '/voices/sw_reaction_together.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 1.5,
                  motion: '/animations/ardy_wave.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
              ],
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 1.8,
                  motion: '/animations/ardy_proud.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
              ],
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Branch B: 次の連休も（2ショットwide）
        {
          id: 'sw_reaction_next_trip',
          speaker: 'エミリ & アオイ',
          dialogueTarget: 'player',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '「やったー！ 約束だよ！ 次はもっと遠くまでお出かけしちゃおう！」',
          voiceUrl: '/voices/sw_reaction_next_trip.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'relax',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 1.6,
                  motion: '/animations/ardy_stretch.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
              ],
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 1.5,
                  motion: '/animations/ardy_wave.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
              ],
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Scene 6: エンディング・手を振ってお別れ（2ショットwide）
        {
          id: 'sw_end',
          speaker: 'アオイ & エミリ',
          dialogueTarget: 'player',
          location: '夕暮れの並木道',
          background: '/textures/town_far.avif',
          text: '「それじゃあ、また明日ね！ 気をつけて帰ってね〜！」',
          voiceUrl: '/voices/sw_end.wav',
          avatars: {
            girl_01: {
              motion: '/animations/ardy_wave.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02: {
              motion: '/animations/ardy_wave.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },
      ],
    },
  ],
};

export function getSilverWeekScenario(lang: Language = getLanguage()): ScenarioPackage {
  return SILVER_WEEK_SCENARIO_JA;
}
