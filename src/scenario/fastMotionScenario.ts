import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';
import { resolveAssetUrl } from '../utils/path';

export const FAST_MOTION_SCENARIO_JA: ScenarioPackage = {
  id: 'fast_motion_action',
  title: '疾風怒濤！高速アクション特訓',
  characters: [
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: 'left',
    },
    {
      id: 'girl_02',
      character: resolveAssetUrl('/models/girl2.vrm'),
      position: 'right',
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.28,
  chapters: [
    {
      id: 'main',
      title: 'アニメ作画風モーションエフェクト検証',
      scenes: [
        // Scene 1: アオイの提案
        {
          id: 'motion_intro',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '放課後の校門前',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_01_aoi.wav'),
          text: '「エミリちゃん！アニメの格闘シーンみたいに、腕を高速で動かしたときのスピード線や残像エフェクトを試してみようよ！」',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'neutral',
              expressionWeight: 0.5,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.9,
        },
        // Scene 2: アオイが高速で手を振る (ブラーモードON)
        {
          id: 'motion_waving',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '放課後の校門前',
          scenePreset: 'day_school',
          motionBlur: true,
          voiceUrl: resolveAssetUrl('/voices/fastmotion_02_aoi.wav'),
          text: '「まずは高速手振り！ブンブン振ると、手首や肘の軌道に沿ってスピード線と残像がシュババッと走るよ！」',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              motionSpeed: 2.0,
              expression: 'happy',
              expressionWeight: 1.0,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'medium',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.7,
        },
        // Scene 3: エミリのツッコミと構え
        {
          id: 'motion_emily_ready',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'partner',
          location: '放課後の校門前',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_03_emily.wav'),
          text: '「ふふっ、甘いわねアオイ。スピード線の本気を見たいなら、私の鋭いストレートパンチを見てなさい！」',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'neutral',
              expressionWeight: 0.5,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },
        // Scene 4: エミリの連続パンチ！ (ブラーモードON)
        {
          id: 'motion_emily_punch',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'camera',
          location: '放課後の校門前',
          scenePreset: 'day_school',
          motionBlur: true,
          voiceUrl: resolveAssetUrl('/voices/fastmotion_04_emily.wav'),
          text: '「せいっ！やあっ！――腕の軌跡に沿うスピード線、背後に残る残像、そして逆方向に伸びるぼかしアウトライン！」',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              effectText: 'biku',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              motionSpeed: 1.4,
              expression: 'angry',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'medium',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
        },
        // Scene 5: アオイの絶賛
        {
          id: 'motion_praise',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: '放課後の校門前',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_05_aoi.wav'),
          text: '「すごーい！全身のモーションブラーじゃなくて、動いた腕の周辺だけにピタッと追従して超カッコいい作画になってる！」',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Salute.fbx'),
              expression: 'happy',
              expressionWeight: 0.7,
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
        },
        // Scene 6: まとめ
        {
          id: 'motion_outro',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'camera',
          location: '放課後の校門前',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_06_emily.wav'),
          text: '「腕も脚も、一定以上の速度で振り抜いた瞬間だけ自動発生するわ。これぞアニメ作画の真骨頂ね！」',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Acknowledging.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'medium',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },
      ],
    },
  ],
};

export const FAST_MOTION_SCENARIO_EN: ScenarioPackage = {
  id: 'fast_motion_action',
  title: 'Fast Action Motion Effects Showcase',
  characters: [
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: 'left',
    },
    {
      id: 'girl_02',
      character: resolveAssetUrl('/models/girl2.vrm'),
      position: 'right',
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.28,
  chapters: [
    {
      id: 'main',
      title: 'Anime Fast Motion Effects Test',
      scenes: [
        {
          id: 'motion_intro',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: 'School Gate after School',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_01_aoi.wav'),
          text: '"Emily! Let\'s test out anime-style speed lines and afterimage effects when moving arms at high speed!"',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'neutral',
              expressionWeight: 0.5,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.9,
        },
        {
          id: 'motion_waving',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: 'School Gate after School',
          scenePreset: 'day_school',
          motionBlur: true,
          voiceUrl: resolveAssetUrl('/voices/fastmotion_02_aoi.wav'),
          text: '"First, rapid hand waving! Speed lines and afterimages instantly emerge along the wrist trajectory!"',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              motionSpeed: 2.0,
              expression: 'happy',
              expressionWeight: 1.0,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'medium',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.7,
        },
        {
          id: 'motion_emily_ready',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'partner',
          location: 'School Gate after School',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_03_emily.wav'),
          text: '"Hehe, not bad Aoi! But if you want to see true action velocity, watch my rapid punches!"',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'neutral',
              expressionWeight: 0.5,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },
        {
          id: 'motion_emily_punch',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'camera',
          location: 'School Gate after School',
          scenePreset: 'day_school',
          motionBlur: true,
          voiceUrl: resolveAssetUrl('/voices/fastmotion_04_emily.wav'),
          text: '"Take that! Sharp tapered speed lines, ghost afterimages behind the arm, and directional trailing blur outline!"',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              effectText: 'biku',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              motionSpeed: 1.4,
              expression: 'angry',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'medium',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
        },
        {
          id: 'motion_praise',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          dialogueTarget: 'partner',
          location: 'School Gate after School',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_05_aoi.wav'),
          text: '"Incredible! Instead of whole-screen blur, it perfectly pinpoints the moving arms and looks like hand-drawn anime sakuga!"',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Salute.fbx'),
              expression: 'happy',
              expressionWeight: 0.7,
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
        },
        {
          id: 'motion_outro',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          dialogueTarget: 'camera',
          location: 'School Gate after School',
          scenePreset: 'day_school',
          voiceUrl: resolveAssetUrl('/voices/fastmotion_06_emily.wav'),
          text: '"Both arms and legs trigger dynamically whenever swinging past threshold speeds. Anime motion at its finest!"',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Acknowledging.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'medium',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },
      ],
    },
  ],
};

export function getFastMotionScenario(lang?: Language): ScenarioPackage {
  const currentLang = lang ?? getLanguage();
  return currentLang === 'en' ? FAST_MOTION_SCENARIO_EN : FAST_MOTION_SCENARIO_JA;
}
