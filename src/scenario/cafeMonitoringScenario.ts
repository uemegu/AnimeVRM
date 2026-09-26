import { ScenarioPackage } from './types';
import { Language } from '../i18n';
import { resolveAssetUrl } from '../utils/path';

export const CAFE_MONITORING_SCENARIO_JA: ScenarioPackage = {
  id: 'cafe-monitoring',
  title: '窓越しの観測者 〜アオイの休日〜',
  characters: [
    {
      id: 'indoor_emily',
      character: resolveAssetUrl('/models/emili/emili-private.vrm'),
      position: [0.30, -0.12, 0.45],
      rotationY: -0.35,
      renderOrder: 0,
    },
    {
      id: 'outdoor_aoi',
      character: resolveAssetUrl('/models/aoi/aoi-private.vrm'),
      position: [-1.4, 0.0, -2.9],
      rotationY: Math.PI * 0.5,
      daylight: 0.6,
      renderOrder: -2,
      fastMotion: false, // アオイの歩行時の残像エフェクトを無効化
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.25,
  chapters: [
    {
      id: 'main',
      title: '窓の外の観測',
      scenes: [
        // Scene 1: 静かなカフェ店内
        {
          id: 'scene_01',
          speaker: 'エミリ',
          speakerCharacterId: 'indoor_emily',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '「……ふぅ。ここのお店、落ち着いてていいね。外の光も綺麗だし……たまにはこういう静かな場所も悪くないかも。」',
          voiceUrl: resolveAssetUrl('/voices/cafe_mon_01.mp3'),
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'relax',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.35,
              renderOrder: 0,
              lookAtCamera: false,
              headLookAtCamera: false,
            },
            outdoor_aoi: {
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              position: [-1.4, 0.0, -2.9],
              rotationY: Math.PI * 0.5,
              daylight: 0.6,
              renderOrder: -2,
              fastMotion: false,
            },
          },
          cameraPosition: [0.12, 1.15, 1.55],
          cameraTarget: [0.08, 1.15, -1.0],
        },
        // Scene 2: 窓の外の発見（アオイが歩いてきて立ち止まる）
        {
          id: 'scene_02',
          speaker: 'エミリ',
          speakerCharacterId: 'indoor_emily',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '「……ん？ 待って。あの水色のカーディガン……あそこ歩いてるの、アオイじゃない？」',
          voiceUrl: resolveAssetUrl('/voices/cafe_mon_02.mp3'),
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.35,
              renderOrder: 0,
              lookAtCamera: false,
              headLookAtCamera: false,
              headOffset: [-0.4, 0.0],
            },
            outdoor_aoi: {
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              daylight: 0.6,
              renderOrder: -2,
              fastMotion: false,
              moveTo: {
                target: [-0.75, 0.0, -2.9],
                duration: 3.0,
                rotationY: Math.PI * 0.45,
              },
            },
          },
          cameraPosition: [0.12, 1.14, 1.55],
          cameraTarget: [-0.10, 1.14, -1.1],
        },
        // Scene 3: 窓越しの観察（左側の広い窓ガラスの中で立ち止まってキョロキョロ）
        {
          id: 'scene_03',
          speaker: 'エミリ',
          speakerCharacterId: 'indoor_emily',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '「誰か探してるみたい……待ち合わせかな。あんなにキョロキョロしてたら、すぐ迷子になっちゃいそうだけど。」',
          voiceUrl: resolveAssetUrl('/voices/cafe_mon_03.mp3'),
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.35,
              renderOrder: 0,
              lookAtCamera: false,
              headLookAtCamera: false,
              headOffset: [-0.45, 0.0],
            },
            outdoor_aoi: {
              // 柱に隠れない左側の窓ガラス中央で立ち止まり＆キョロキョロ首振り演出
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              position: [-0.75, 0.0, -2.9],
              rotationY: Math.PI * 0.35,
              daylight: 0.6,
              renderOrder: -2,
              fastMotion: false,
              transitions: [
                { at: 0.6, headOffset: [-0.4, 0.0] },
                { at: 2.0, headOffset: [0.4, 0.0] },
                { at: 3.5, headOffset: [0.0, 0.0] },
              ],
            },
          },
          cameraPosition: [0.12, 1.15, 1.55],
          cameraTarget: [-0.12, 1.15, -1.1],
        },
        // Scene 4: エミリの照れ怒り（怒りマーク 💢 ＆ 見切れゼロの安定構図）
        {
          id: 'scene_04',
          speaker: 'エミリ',
          speakerCharacterId: 'indoor_emily',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '「……って、ちょっと！ 私といるのに、そんなにアオイのことばっかり凝視しないでよ。」',
          voiceUrl: resolveAssetUrl('/voices/cafe_mon_04.mp3'),
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.15,
              renderOrder: 0,
              lookAtCamera: true,
              headLookAtCamera: true,
              faceOverlays: {
                anger: true, // 顔の重ね表示: 怒りマーク
              },
            },
            outdoor_aoi: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              position: [3.5, 0.0, -2.9],
              daylight: 0.6,
              renderOrder: -2,
              visible: false,
              fastMotion: false,
            },
          },
          cameraPosition: [0.18, 1.16, 1.45],
          cameraTarget: [0.28, 1.15, 0.45],
        },
        // Scene 5: 選択肢専用シーン（セリフ・ナレーション完全排除、怒りマーク継続）
        {
          id: 'scene_05_choice',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '',
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.15,
              renderOrder: 0,
              lookAtCamera: true,
              headLookAtCamera: true,
              faceOverlays: {
                anger: true, // 怒りマーク維持
              },
            },
          },
          cameraPosition: [0.18, 1.16, 1.45],
          cameraTarget: [0.28, 1.15, 0.45],
          choices: [
            {
              text: '「アオイを呼んで一緒に合流する？」',
              goto: 'scene_06a',
            },
            {
              text: '「今はエミリと二人の時間だからさ」',
              goto: 'scene_06b',
            },
          ],
        },
        // Scene 6a: アオイを呼ぶルート（終了フラグ isEnding: true で 6b へのフォールスルーを防止）
        {
          id: 'scene_06a',
          speaker: 'エミリ',
          speakerCharacterId: 'indoor_emily',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '「まったく……お人好しなんだから。ほら、手振ったら気づくかもよ？ ……しょうがないなぁ。」',
          voiceUrl: resolveAssetUrl('/voices/cafe_mon_06a.mp3'),
          isEnding: true, // 1個目選択後にシナリオを正常終了
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.15,
              renderOrder: 0,
              lookAtCamera: true,
              headLookAtCamera: true,
              faceOverlays: {
                anger: false,
                blush: false,
              },
            },
          },
          cameraPosition: [0.18, 1.16, 1.45],
          cameraTarget: [0.28, 1.15, 0.45],
        },
        // Scene 6b: 二人の時間ルート（赤らめ 😊 ＆ 終了フラグ isEnding: true）
        {
          id: 'scene_06b',
          speaker: 'エミリ',
          speakerCharacterId: 'indoor_emily',
          location: 'cafe_indoor',
          scenePreset: 'dark_indoor_2',
          text: '「……っ！ な、何よ急に真面目な顔して……バカ。……じゃあ、もうちょっとだけ、ここで二人で休んでいこっか。」',
          voiceUrl: resolveAssetUrl('/voices/cafe_mon_06b.mp3'),
          isEnding: true,
          crowd: {
            enabled: true,
            preset: 'cafe_street',
            opacity: 0.85,
          },
          avatars: {
            indoor_emily: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.30, -0.12, 0.45],
              rotationY: -0.15,
              renderOrder: 0,
              lookAtCamera: true,
              headLookAtCamera: true,
              faceOverlays: {
                anger: false,
                blush: true, // 顔の重ね表示: 赤らめ
              },
            },
          },
          cameraPosition: [0.22, 1.16, 1.30],
          cameraTarget: [0.29, 1.15, 0.45],
        },
      ],
    },
  ],
};

export function getCafeMonitoringScenario(lang: Language = 'ja'): ScenarioPackage {
  return CAFE_MONITORING_SCENARIO_JA;
}
