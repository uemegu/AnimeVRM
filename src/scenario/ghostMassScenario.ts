import { ScenarioPackage } from './types';

export const GHOST_MASS_SCENARIO: ScenarioPackage = {
  id: 'ghost-mass',
  title: '幽霊の質量（シャフト風）',
  hideMessageWindow: true,
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
  chapters: [
    {
      id: 'main',
      title: '幽霊の質量',
      scenes: [
        // 1. アオイズーム: ねぇエミリ
        {
          id: 'ghost_1',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '教室',
          scenePreset: 'day_school',
          background: '/textures/school-classroom-far2.avif',
          text: 'ねぇエミリ',
          voiceUrl: '/voices/shaft_01_aoi.wav',
          autoNextSec: 0.6,
          cameraZoom: 'speaker',
          cameraPreset: 'pushIn',
          cameraStrength: 0.4,
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.7,
            },
            girl_02: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'neutral',
            },
          },
        },
        // 2. エミリズーム: なぁに、アオイ？
        {
          id: 'ghost_2',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'partner',
          text: 'なぁに、アオイ？',
          voiceUrl: '/voices/shaft_02_emili.wav',
          autoNextSec: 0.6,
          cameraZoom: 'speaker',
          cameraPreset: 'pushIn',
          cameraStrength: 0.3,
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
            },
            girl_02: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'happy',
              expressionWeight: 0.5,
            },
          },
        },
        // 3. アオイズーム: 幽霊って質量あるのかな？
        {
          id: 'ghost_3',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          text: '幽霊って質量あるのかな？',
          voiceUrl: '/voices/shaft_03_aoi.wav',
          autoNextSec: 0.6,
          cameraZoom: 'speaker',
          cameraPreset: 'pushIn',
          cameraStrength: 0.6,
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'surprised',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Female Standing Pose.fbx',
            },
          },
        },
        // 4. 二人引き: 私たちは地球の重力に縛られることによって今この場にいるわけだけど、幽霊はどうなんだろう？
        {
          id: 'ghost_4',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          text: '私たちは地球の重力に縛られることによって今この場にいるわけだけど、幽霊はどうなんだろう？',
          voiceUrl: '/voices/shaft_04_aoi.wav',
          autoNextSec: 0.6,
          cameraZoom: 'wide',
          cameraPreset: 'pullOut',
          cameraStrength: 0.5,
          avatars: {
            girl_01: {
              motion: '/animations/Dismissing Gesture.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'neutral',
            },
          },
        },
        // 5. シャフト赤コマカットイン
        {
          id: 'ghost_5_cutin',
          speaker: '',
          text: '',
          shaftCutIn: 'red_trouble',
          shaftCutInDuration: 3.5,
          autoNextSec: 3.5,
        },
        // 6. シャフトモード開始: 例えば私が幽霊になったとする。
        {
          id: 'ghost_6_shaft_intro',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          shaftMode: true,
          text: '例えば私が幽霊になったとする。',
          voiceUrl: '/voices/shaft_05_aoi.wav',
          autoNextSec: 0.6,
          cameraPosition: [0, 1.1, 2.65],
          cameraTarget: [0, 1.15, 0],
          cameraFov: 30,
          avatars: {
            girl_01: {
              position: [-0.1285, 0.048, -1.3482],
              rotationY: 0.26,
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
            },
            girl_02: {
              position: [0.85, 0.048, -1.3482],
              rotationY: -0.26,
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'neutral',
            },
          },
        },
        // 7. シャフトモード: 地球は宇宙空間を常に高速で動いてるけど地球の重力によって、私たちは地球と一緒に動いている。
        {
          id: 'ghost_7_shaft_earth',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          shaftMode: true,
          text: '地球は宇宙空間を常に高速で動いてるけど地球の重力によって、私たちは地球と一緒に動いている。',
          voiceUrl: '/voices/shaft_06_aoi.wav',
          autoNextSec: 0.6,
          cameraPosition: [0, 1.1, 2.65],
          cameraTarget: [0, 1.15, 0],
          cameraFov: 30,
          avatars: {
            girl_01: {
              position: [-0.1285, 0.048, -1.3482],
              rotationY: 0.26,
              motion: '/animations/Dismissing Gesture.fbx',
            },
            girl_02: {
              position: [0.85, 0.048, -1.3482],
              rotationY: -0.26,
            },
          },
        },
        // 8. シャフトモード: もし幽霊に質量がないとしたら、重力に縛られないわけだから、地球に置いて行かれて宇宙空間に放り出されちゃうんじゃないかって。 (アオイスライドアウト)
        {
          id: 'ghost_8_shaft_slideout',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          shaftMode: true,
          text: 'もし幽霊に質量がないとしたら、重力に縛られないわけだから、地球に置いて行かれて宇宙空間に放り出されちゃうんじゃないかって。',
          voiceUrl: '/voices/shaft_07_aoi.wav',
          autoNextSec: 0.6,
          cameraPosition: [0, 1.15, 3.2],
          cameraTarget: [0, 1.15, 0],
          cameraFov: 32,
          avatars: {
            girl_01: {
              position: [-0.1285, 0.048, -1.3482],
              rotationY: 0.26,
              moveTo: {
                target: [-3.5, 0.048, -1.3482],
                duration: 1.5,
              },
            },
            girl_02: {
              position: [0.85, 0.048, -1.3482],
              rotationY: -0.26,
            },
          },
        },
        // 9. シャフトモード: 質量があるなら、地球と一緒に動けるから、この部屋にいられる。
        {
          id: 'ghost_9_shaft_room',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          shaftMode: true,
          text: '質量があるなら、地球と一緒に動けるから、この部屋にいられる。',
          voiceUrl: '/voices/shaft_08_aoi.wav',
          autoNextSec: 0.6,
          cameraPosition: [0, 1.1, 2.65],
          cameraTarget: [0, 1.15, 0],
          cameraFov: 30,
          avatars: {
            girl_01: {
              position: [-0.1285, 0.048, -1.3482],
              rotationY: 0.26,
              motion: '/animations/Standing Idle.fbx',
              expression: 'smile',
              expressionWeight: 0.6,
            },
            girl_02: {
              position: [0.85, 0.048, -1.3482],
              rotationY: -0.26,
            },
          },
        },
        // 10. エミリのシャフ度 (体をY軸90度回転、仰向け方向に体を倒し、顔をカメラに向ける)
        {
          id: 'ghost_10_shafudo',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          shaftMode: false,
          background: '/textures/white.png',
          text: '質量があるとすると、それはエネルギーを持っていると言うことね',
          voiceUrl: '/voices/shaft_09_emili.wav',
          autoNextSec: 0.8,
          cameraPosition: [0, 1.25, 1.7],
          cameraTarget: [0.15, 1.22, 0],
          cameraFov: 28,
          avatars: {
            girl_01: {
              visible: false,
            },
            girl_02: {
              visible: true,
              position: [0.15, 0, 0],
              rotationY: -Math.PI / 2, // 体をY軸に90度回す（真横）
              shafudo: true,          // 仰向け方向に体を倒し、顔をカメラに向ける
              eyeLookAtCamera: true,
              lookAtCamera: true,
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'smug',
              expressionWeight: 0.85,
            },
          },
        },
        // 11. 緑コマカットイン (「閉」 + 「close」)
        {
          id: 'ghost_11_cutin_closed',
          speaker: '',
          text: '',
          shafudo: false,
          shaftCutIn: 'green_closed',
          shaftCutInDuration: 3.0,
          autoNextSec: 3.0,
        },
      ],
    },
  ],
};
