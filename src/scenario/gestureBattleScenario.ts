import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';

export const GESTURE_BATTLE_SCENARIO_JA: ScenarioPackage = {
  id: 'gesture-battle',
  title: '放課後全力ジェスチャー！ 〜アオイとエミリの表現力バトル〜',
  characters: [
    {
      id: 'girl_01',
      character: '/models/aoi/aoi-school.vrm',
      position: 'left',
    },
    {
      id: 'girl_02',
      character: '/models/emili/emili.vrm',
      position: 'right',
    },
  ],
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.22,
  chapters: [
    {
      id: 'main',
      title: '校門前の表現力バトル',
      scenes: [
        // Scene 1: アオイの挑戦状（アオイへズーム、ひらめき→指差し）
        {
          id: 'gb_1',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'day_school',
          background: '/textures/school-gate-far.avif',
          text: '「ねえエミリちゃん！ 放課後の表現力勝負、どっちが全身で気持ちを伝えられるかバトルしよ！」',
          voiceUrl: '/voices/gb_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 1.8秒でピコーンとひらめくジェスチャー
                {
                  at: 1.8,
                  motion: '/animations/ardy_idea.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
                // 5.0秒でエミリをビシッと指差す
                {
                  at: 5.0,
                  motion: '/animations/ardy_point.fbx',
                  expression: 'happy',
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

        // Scene 2: エミリの受けて立つアピール（エミリへズーム、胸張り→ガッツポーズ）
        {
          id: 'gb_2',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'partner',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「望むところだよアオイ！ 私の全力のリアクション、甘く見ないでよね！」',
          voiceUrl: '/voices/gb_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 1.0秒で胸を張って満足げにアピール
                {
                  at: 1.0,
                  motion: '/animations/ardy_proud.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
                // 3.2秒で力強くガッツポーズ！
                {
                  at: 3.2,
                  motion: '/animations/ardy_victory.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'yatta',
                },
              ],
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Scene 3: 第1問・アオイのお題表現（お願い→断られた困惑顔）
        {
          id: 'gb_3',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「じゃあ行くよ！ どうしても宿題を教えてほしい時のお願い……からの、断られた時の顔！」',
          voiceUrl: '/voices/gb_3.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 1.2秒で胸の前で必死にお願い！
                {
                  at: 1.2,
                  motion: '/animations/ardy_beg.fbx',
                  expression: 'sad',
                  expressionWeight: 1.0,
                  lookAtTarget: 'partner',
                },
                // 5.5秒で後頭部に手を当てて困ったな〜の苦笑い
                {
                  at: 5.5,
                  motion: '/animations/ardy_troubled.fbx',
                  expression: 'relax',
                  expressionWeight: 1.0,
                  lookAtTarget: 'partner',
                },
              ],
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 6.0秒でアオイの表情を見てクスクス笑う
                {
                  at: 6.0,
                  motion: '/animations/ardy_laugh.fbx',
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

        // Scene 4: 第2問・エミリの全力表現（歓喜大ジャンプ→一口取られたすね顔）
        {
          id: 'gb_4',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'partner',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「ふふん、まだまだね！ 私ならこう！ 限定スイーツをゲットできた歓喜……と、一口取られた怒り！」',
          voiceUrl: '/voices/gb_4.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'partner',
              transitions: [
                // 4.0秒でエミリの大ジャンプに思わず両手を広げて呆れ笑い
                {
                  at: 4.0,
                  motion: '/animations/ardy_shrug.fbx',
                  expression: 'relax',
                  expressionWeight: 1.0,
                },
                // 7.2秒ですねるエミリを見て楽しそうに笑う
                {
                  at: 7.2,
                  motion: '/animations/ardy_laugh.fbx',
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
              lookAtTarget: 'partner',
              transitions: [
                // 1.0秒でドヤ顔
                {
                  at: 1.0,
                  motion: '/animations/ardy_proud.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
                // 3.5秒で両手を高く挙げて大喜びジャンプ！
                {
                  at: 3.5,
                  motion: '/animations/ardy_cheer.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
                // 6.8秒で腕組みをしてぷくっとすねる
                {
                  at: 6.8,
                  motion: '/animations/ardy_pout.fbx',
                  expression: 'angry',
                  expressionWeight: 1.0,
                },
              ],
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Scene 5: プレイヤーへ判定を求める（2ショットwide）
        {
          id: 'gb_5',
          speaker: 'アオイ & エミリ',
          dialogueTarget: 'player',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「どうかな？ どっちの全身ジェスチャーがより気持ちが伝わってきた？」',
          voiceUrl: '/voices/gb_5.wav',
          avatars: {
            girl_01: {
              motion: '/animations/ardy_shrug.fbx',
              expression: 'happy',
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
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },

        // Scene 6: 選択肢シーン（ガイドライン厳守: textは空文字、ナレーション・セリフ完全排除、2ショットwide）
        {
          id: 'gb_choice',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '',
          avatars: {
            girl_01: {
              motion: '/animations/ardy_beg.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02: {
              motion: '/animations/ardy_victory.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
          },
          cameraZoom: 'wide',
          choices: [
            {
              text: 'アオイの『必死なお願い』がめちゃくちゃ可愛かった！',
              goto: 'gb_reaction_aoi',
            },
            {
              text: 'エミリの『スイーツ歓喜ジャンプ』が全力すぎて最高だった！',
              goto: 'gb_reaction_emili',
            },
          ],
        },

        // Branch A: アオイの勝ち（2ショットwide）
        {
          id: 'gb_reaction_aoi',
          speaker: 'アオイ & エミリ',
          dialogueTarget: 'player',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「やったー！ 私の勝ちだね！ エミリちゃん、放課後アイス奢ってね〜！」',
          voiceUrl: '/voices/gb_reaction_aoi.wav',
          avatars: {
            girl_01: {
              motion: '/animations/ardy_victory.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 3.5,
                  motion: '/animations/ardy_wave.fbx',
                  expression: 'happy',
                  expressionWeight: 1.0,
                  effectText: 'kirakira',
                },
              ],
            },
            girl_02: {
              motion: '/animations/ardy_troubled.fbx',
              expression: 'sad',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 3.5,
                  motion: '/animations/ardy_pout.fbx',
                  expression: 'angry',
                  expressionWeight: 1.0,
                },
              ],
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
        },

        // Branch B: エミリの勝ち（2ショットwide）
        {
          id: 'gb_reaction_emili',
          speaker: 'エミリ & アオイ',
          dialogueTarget: 'player',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「よっしゃー！ やっぱり私の表現力は最強でしょ！ 次も勝っちゃうもんね！」',
          voiceUrl: '/voices/gb_reaction_emili.wav',
          avatars: {
            girl_01: {
              motion: '/animations/ardy_laugh.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 3.2,
                  motion: '/animations/ardy_stretch.fbx',
                  expression: 'relax',
                  expressionWeight: 1.0,
                },
              ],
            },
            girl_02: {
              motion: '/animations/ardy_cheer.fbx',
              expression: 'happy',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
              transitions: [
                {
                  at: 3.2,
                  motion: '/animations/ardy_proud.fbx',
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

        // Scene 8: エンディング（2ショットwide、2人で元気に手を振る）
        {
          id: 'gb_end',
          speaker: 'アオイ & エミリ',
          dialogueTarget: 'player',
          location: '校門前',
          background: '/textures/school-gate-far.avif',
          text: '「また放課後にいろんな動きで遊ぼうね！ 今日は付き合ってくれてありがとう！」',
          voiceUrl: '/voices/gb_end.wav',
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

export function getGestureBattleScenario(lang: Language = getLanguage()): ScenarioPackage {
  return GESTURE_BATTLE_SCENARIO_JA;
}
