import { ScenarioPackage } from './types';
import { resolveAssetUrl } from '../utils/path';

export const DOF_EAVESDROP_SCENARIO_JA: ScenarioPackage = {
  id: 'dof_eavesdrop_test',
  title: '教室の告白と盗み聞き（被写界深度DoFテスト）',
  characters: [
    {
      id: 'girl_02',
      character: resolveAssetUrl('/models/girl2.vrm'),
      position: [0.15, 0, -0.9], // エミリ：目の前で対面
      rotationY: 0,
    },
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: [2.4, 0, -2.6], // アオイ：教室の右奥から登場
      rotationY: -Math.PI / 2,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.2,
  panoramaBackgroundUrl: resolveAssetUrl('/textures/class_room_3d.avif'),
  chapters: [
    {
      id: 'main',
      title: '放課後の告白と立ち聞き',
      scenes: [
        // Scene 1: エミリとの勉強風景（夕暮れの教室）
        {
          id: 'scene_1_study',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '夕暮れの教室',
          scenePreset: 'evening_school', // 茜色の夕陽が差し込む夕方設定
          panoramaBackgroundUrl: resolveAssetUrl('/textures/class_room_3d.avif'),
          text: '「……ちょっと、さっきから何ぼーっとしてるのよ。勉強教えてくれるって言ったの、アンタでしょ？」',
          voiceUrl: resolveAssetUrl('/voices/dof_emily_1.wav'),
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'neutral',
              expressionWeight: 0.8,
              position: [0.15, 0, -0.9],
              rotationY: 0,
            },
            girl_01: {
              // アオイはまだ教室の奥で機嫌よく待機（明るい表情）
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 0.7,
              position: [2.4, 0, -2.6],
              rotationY: -Math.PI / 2,
            },
          },
          cameraTarget: [0.15, 1.25, -0.9],
          cameraPosition: [0.0, 1.25, 0.2],
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          dof: { enabled: false },
        },

        // Scene 2: 自キャラのモノローグ ＆ アオイが鼻歌交じりに歩いてくる
        {
          id: 'scene_2_walk_in',
          speaker: 'あなた',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '（ごめんごめん、エミリの真面目な顔が可愛くて見とれてた……と、教室の奥をアオイが歩いてくる）',
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_01: {
              // 放課後のん気に楽しそうに歩く
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              moveTo: {
                target: [0.0, 0, -2.6],
                duration: 3.2,
                rotationY: -Math.PI / 2,
              },
            },
          },
          cameraTarget: [0.1, 1.25, -1.5],
          cameraPosition: [0.0, 1.3, 0.4],
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          dof: { enabled: false },
          autoNextSec: 3.5,
        },

        // Scene 3: エミリの照れ怒り ＆ アオイが勉強中の2人に気づく
        {
          id: 'scene_3_blush',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '「ばっ……！ バカなこと言ってないで、ノート開きなさいよ……！」',
          voiceUrl: resolveAssetUrl('/voices/dof_emily_2.wav'),
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              effectText: {
                preset: 'doki',
                text: 'カァァッ！',
                duration: 3.0,
              },
            },
            girl_01: {
              // 「あ、まだ勉強してる〜」と微笑ましく笑顔で立ち止まる
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
              position: [0.0, 0, -2.6],
              rotationY: Math.PI / 6,
            },
          },
          cameraTarget: [0.15, 1.25, -0.9],
          cameraPosition: [0.05, 1.25, -0.2],
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          dof: { enabled: false },
        },

        // Scene 4: 小声で耳打ち「アオイには内緒だよ」
        {
          id: 'scene_4_secret',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '「……ねえ。これ、アオイには絶対内緒にしてほしいんだけど……」',
          voiceUrl: resolveAssetUrl('/voices/dof_emily_3.wav'),
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'surprised',
              expressionWeight: 0.5,
            },
            girl_01: {
              // 「え？ 私に内緒……？」と不思議に思って首をかしげる（好奇心）
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 0.4,
            },
          },
          cameraTarget: [0.15, 1.25, -0.9],
          cameraPosition: [0.1, 1.25, -0.3],
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          dof: { enabled: false },
        },

        // Scene 5: 奥のアオイが聞き耳を立てる
        {
          id: 'scene_5_eavesdrop',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '（……あ、二人ともまだ残ってたんだ。声かけよっか……え？）',
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'neutral',
              expressionWeight: 0.7,
            },
            girl_01: {
              // 「なんだろ？」と耳を澄ます（好奇心の驚き・まだ曇っていない）
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 0.6,
              rotationY: Math.PI / 8,
            },
          },
          cameraTarget: [0.0, 1.25, -2.6],
          cameraPosition: [0.0, 1.27, -0.48],
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.9,
          dof: { enabled: false },
        },

        // Scene 6: エミリの真剣な告白（アオイは目を見張り硬直）
        {
          id: 'scene_6_confess',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '「私、本当はずっと……アンタのことが好きだったの。アオイには悪いけど……譲る気ないから」',
          voiceUrl: resolveAssetUrl('/voices/dof_emily_4.wav'),
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.9,
            },
            girl_01: {
              // 告白を聞いて「え……？」と目を見開いて固まる（衝撃・硬直。まだ泣いていない）
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
            },
          },
          cameraTarget: [0.15, 1.28, -0.9],
          cameraPosition: [0.1, 1.25, -0.2],
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          dof: { enabled: false },
        },

        // Scene 7: ⭐️決定的演出：エミリの肩越し（OTS）から奥のアオイへフォーカス！手前エミリが大きく前ボケ！
        {
          id: 'scene_7_dof_focus',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '「っ……！（ショックで言葉を失い、息を呑む）」',
          voiceUrl: resolveAssetUrl('/voices/dof_aoi_gasp.wav'),
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.8,
              position: [0.15, 0, -0.9],
              rotationY: 0.15,
              lookAtCamera: false,
            },
            girl_01: {
              // ここで初めて絶望・深い悲しみとショックの表情（悲痛な瞳）
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              effectText: {
                preset: 'gaan',
                text: 'ショック……！',
                duration: 3.5,
              },
              lookAtCamera: true,
            },
          },
          // エミリの右肩越し構図
          cameraPosition: [0.0, 1.27, -0.48],
          cameraTarget: [0.0, 1.25, -2.6],
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.7,
          // ⭐️焦点距離2.12m（奥のアオイに完全一致）。手前のエミリ（約0.45m）は大きな前ボケ！
          dof: {
            enabled: true,
            focus: 2.12,
            aperture: 0.045,
            maxblur: 0.022,
            duration: 0.5,
          },
        },

        // Scene 8: アオイが耐えきれず猛ダッシュで逃走（カメラは追従せず固定！アオイが画面外へ消える）
        {
          id: 'scene_8_run_away',
          speaker: 'あなた',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '（アオイがショックを受けた顔で後ずさり……脱兎の如く走り去っていった……！）',
          seUrl: resolveAssetUrl('/se/walking.mp3'),
          seVolume: 0.5,
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.8,
              lookAtCamera: false,
            },
            girl_01: {
              motion: resolveAssetUrl('/animations/Jogging.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              // カメラを追従させず、画面の左外側（X = -4.0）へ一気に走り去ってフレームアウト！
              moveTo: {
                target: [-4.0, 0, -2.6],
                duration: 1.8,
                rotationY: -Math.PI / 2,
              },
              lookAtCamera: false,
            },
          },
          // ⭐️カメラはScene 7と同じ構図のまま固定！アオイを追わず、アオイが走り去って画面から消える演出
          cameraPosition: [0.0, 1.27, -0.48],
          cameraTarget: [0.0, 1.25, -2.6],
          cameraTransitionEasing: 'cut',
          cameraTransitionDuration: 0.0,
          dof: {
            enabled: true,
            focus: 2.12,
            aperture: 0.045,
            maxblur: 0.022,
            duration: 0.6,
          },
          autoNextSec: 2.2,
        },

        // Scene 9: 自キャラの困惑「あれ、アオイがいた気がする…」
        {
          id: 'scene_9_monologue',
          speaker: 'あなた',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '（あれ……？ 今、教室の奥をアオイが走っていったような……？）',
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'neutral',
              expressionWeight: 0.8,
              lookAtCamera: true,
            },
            girl_01: {
              // 画面外へ完全退場
              position: [100, 100, 100],
            },
          },
          cameraTarget: [0.15, 1.25, -0.9],
          cameraPosition: [0.0, 1.25, 0.2],
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          dof: {
            enabled: false,
            duration: 0.5,
          },
        },

        // Scene 10: エミリは気づかず赤面して返事を迫る
        {
          id: 'scene_10_aftermath',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '夕暮れの教室',
          scenePreset: 'evening_school',
          text: '「……ちょっと、どこ見てるのよ？ 私、真面目に告白してるんだけど……アンタはどうなのよ？」',
          voiceUrl: resolveAssetUrl('/voices/dof_emily_5.wav'),
          avatars: {
            girl_02: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'angry',
              expressionWeight: 0.85,
              effectText: {
                preset: 'iraira',
                text: 'むすっ……！',
                duration: 3.5,
              },
            },
            girl_01: {
              position: [100, 100, 100],
            },
          },
          cameraTarget: [0.15, 1.28, -0.9],
          cameraPosition: [0.1, 1.25, -0.15],
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          dof: { enabled: false },
        },
      ],
    },
  ],
};

export function getDofEavesdropScenario(): ScenarioPackage {
  return DOF_EAVESDROP_SCENARIO_JA;
}
