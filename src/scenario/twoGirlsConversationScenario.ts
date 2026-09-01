import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';

export const TWO_GIRLS_CONVERSATION_SCENARIO_JA: ScenarioPackage = {
  id: 'two_girls_chat',
  title: '放課後の寄り道〜アオイとエミリ〜',
  characters: [
    {
      id: 'girl_01',
      character: '/models/girl.vrm',
      position: 'left',
    },
    {
      id: 'girl_02',
      character: '/models/girl2.vrm',
      position: 'right',
    },
  ],
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.3,
  chapters: [
    {
      id: 'main',
      title: '放課後の約束',
      scenes: [
        // Scene 1: アオイからの呼びかけ
        {
          id: 'chat_intro_1',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '放課後の教室',
          scenePreset: 'morning_school',
          text: '「エミリちゃん！ 今日の放課後、もし予定なかったら一緒にどこか寄っていかない？」',
          voiceUrl: '/voices/chat_intro_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Dismissing Gesture.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'doki',
            },
            girl_02: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'pushIn',
          cameraStrength: 0.6,
        },
        // Scene 2: エミリの返答
        {
          id: 'chat_intro_2',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '放課後の教室',
          text: '「あ、アオイ！ ちょうど声かけようと思ってたの！ 駅前に新しくできたカフェ、行ってみない？」',
          voiceUrl: '/voices/chat_intro_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Excited.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'kirakira',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.5,
        },
        // Scene 3: 選択肢
        {
          id: 'chat_choice',
          speaker: 'アオイ & エミリ',
          location: '放課後の教室',
          text: '「どこに行こうか？ 一緒に決めよっ！」',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Greeting.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Standing Pose.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
          choices: [
            {
              text: '🍰 新作スイーツがあるカフェに行こう！',
              flag: 'choice_cafe',
              goto: 'route_cafe_1',
              effectText: 'yatta',
            },
            {
              text: '📚 明日の小テストに向けて図書館で勉強しよう！',
              flag: 'choice_study',
              goto: 'route_study_1',
              effectText: 'gaan',
            },
            {
              text: '🍃 夕暮れの公園でゆっくりおしゃべりしよう',
              flag: 'choice_park',
              goto: 'route_park_1',
              effectText: 'doki',
            },
          ],
        },

        // -------------------------------------------------------------
        // ルート1: カフェルート (cafe)
        // -------------------------------------------------------------
        {
          id: 'route_cafe_1',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '駅前カフェ通り',
          text: '「やったぁ！ 期間限定の特製ストロベリーパフェがあるんだって！ 楽しみ〜！」',
          voiceUrl: '/voices/chat_cafe_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Excited.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'yatta',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'pushIn',
          cameraStrength: 0.4,
        },
        {
          id: 'route_cafe_2',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '駅前カフェ通り',
          text: '「ふふっ、エミリちゃん本当にスイーツ大好きだよね。私も写真いっぱい撮っちゃお♪」',
          voiceUrl: '/voices/chat_cafe_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Quick Formal Bow.fbx',
              expression: 'happy',
              expressionWeight: 0.6,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.6,
          goto: 'ending_chat',
        },

        // -------------------------------------------------------------
        // ルート2: 勉強ルート (study)
        // -------------------------------------------------------------
        {
          id: 'route_study_1',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '学校の図書室',
          text: '「えぇ〜っ！？ 放課後なのに勉強〜！？ アオイ、真面目すぎるよ〜っ！」',
          voiceUrl: '/voices/chat_study_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Angry.fbx',
              expression: 'surprised',
              expressionWeight: 0.8,
              effectText: 'gaan',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'hold',
          cameraStrength: 0.5,
        },
        {
          id: 'route_study_2',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '学校の図書室',
          text: '「大丈夫、1時間だけ集中して終わったら美味しいジュースおごってあげるから！」',
          voiceUrl: '/voices/chat_study_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Acknowledging.fbx',
              expression: 'relaxed',
              expressionWeight: 0.7,
              effectText: 'doki',
            },
            girl_02: {
              motion: '/animations/Dismissing Gesture.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'pushIn',
          cameraStrength: 0.6,
          goto: 'ending_chat',
        },

        // -------------------------------------------------------------
        // ルート3: 公園お散歩ルート (park)
        // -------------------------------------------------------------
        {
          id: 'route_park_1',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '夕暮れの公園',
          scenePreset: 'evening_park',
          text: '「夕方の風が気持ちいいね。たまにはこうやってのんびり歩くのもいいかも」',
          voiceUrl: '/voices/chat_park_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'relaxed',
              expressionWeight: 0.7,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: '/animations/Walking.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'panRight',
          cameraStrength: 0.6,
        },
        {
          id: 'route_park_2',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '夕暮れの公園',
          text: '「うん！ 綺麗な夕焼けだね。アオイとおしゃべりしながら歩くの大好き♪」',
          voiceUrl: '/voices/chat_park_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Quick Formal Bow.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'doki',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.5,
          goto: 'ending_chat',
        },

        // -------------------------------------------------------------
        // エピローグ
        // -------------------------------------------------------------
        {
          id: 'ending_chat',
          speaker: 'アオイ & エミリ',
          location: '帰り道',
          text: '「「それじゃあ、行こっか！」」 ―― 2人の楽しい放課後が始まった。【シナリオ終了】',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Greeting.fbx',
              expression: 'happy',
              expressionWeight: 0.7,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: '/animations/Standing Greeting.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'yatta',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'pullOut',
          cameraStrength: 0.8,
        },
      ],
    },
  ],
};

export const TWO_GIRLS_CONVERSATION_SCENARIO_EN: ScenarioPackage = {
  id: 'two_girls_chat',
  title: 'After-School Hangout ~Aoi & Emiri~',
  characters: [
    {
      id: 'girl_01',
      character: '/models/girl.vrm',
      position: 'left',
    },
    {
      id: 'girl_02',
      character: '/models/girl2.vrm',
      position: 'right',
    },
  ],
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.3,
  chapters: [
    {
      id: 'main',
      title: 'After-School Promise',
      scenes: [
        {
          id: 'chat_intro_1',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Classroom after school',
          scenePreset: 'morning_school',
          text: '"Emiri! If you have no plans after school, want to hang out somewhere together?"',
          voiceUrl: '/voices/chat_intro_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Dismissing Gesture.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'doki',
            },
            girl_02: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'pushIn',
          cameraStrength: 0.6,
        },
        {
          id: 'chat_intro_2',
          speaker: 'Emiri',
          speakerCharacterId: 'girl_02',
          location: 'Classroom after school',
          text: '"Ah, Aoi! I was just about to ask you! Want to check out the new cafe in front of the station?"',
          voiceUrl: '/voices/chat_intro_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Excited.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'kirakira',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.5,
        },
        {
          id: 'chat_choice',
          speaker: 'Aoi & Emiri',
          location: 'Classroom after school',
          text: '"Where should we go? Let\'s decide together!"',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Greeting.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Standing Pose.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
          choices: [
            {
              text: '🍰 Let\'s go to the cafe for seasonal sweets!',
              flag: 'choice_cafe',
              goto: 'route_cafe_1',
              effectText: 'yatta',
            },
            {
              text: '📚 Let\'s study at the library for tomorrow\'s quiz!',
              flag: 'choice_study',
              goto: 'route_study_1',
              effectText: 'gaan',
            },
            {
              text: '🍃 Let\'s take a relaxing walk in the twilight park',
              flag: 'choice_park',
              goto: 'route_park_1',
              effectText: 'doki',
            },
          ],
        },
        {
          id: 'route_cafe_1',
          speaker: 'Emiri',
          speakerCharacterId: 'girl_02',
          location: 'Cafe Street',
          text: '"Yay! I heard they have a limited strawberry parfait! Can\'t wait~!"',
          voiceUrl: '/voices/chat_cafe_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Excited.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'yatta',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'pushIn',
          cameraStrength: 0.4,
        },
        {
          id: 'route_cafe_2',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Cafe Street',
          text: '"Hehe, Emiri really loves sweets. I\'m definitely taking lots of photos♪"',
          voiceUrl: '/voices/chat_cafe_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Quick Formal Bow.fbx',
              expression: 'happy',
              expressionWeight: 0.6,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.6,
          goto: 'ending_chat',
        },
        {
          id: 'route_study_1',
          speaker: 'Emiri',
          speakerCharacterId: 'girl_02',
          location: 'School Library',
          text: '"Whaaat!? Studying after school!? Aoi, you\'re way too serious~!"',
          voiceUrl: '/voices/chat_study_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Angry.fbx',
              expression: 'surprised',
              expressionWeight: 0.8,
              effectText: 'gaan',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'hold',
          cameraStrength: 0.5,
        },
        {
          id: 'route_study_2',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'School Library',
          text: '"It\'s okay, just 1 hour of focus and I\'ll buy you a delicious drink afterwards!"',
          voiceUrl: '/voices/chat_study_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Acknowledging.fbx',
              expression: 'relaxed',
              expressionWeight: 0.7,
              effectText: 'doki',
            },
            girl_02: {
              motion: '/animations/Dismissing Gesture.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'pushIn',
          cameraStrength: 0.6,
          goto: 'ending_chat',
        },
        {
          id: 'route_park_1',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Twilight Park',
          scenePreset: 'evening_park',
          text: '"The evening breeze feels so nice. It\'s great to just take a relaxing walk like this once in a while."',
          voiceUrl: '/voices/chat_park_1.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Female Standing Pose.fbx',
              expression: 'relaxed',
              expressionWeight: 0.7,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: '/animations/Walking.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'panRight',
          cameraStrength: 0.6,
        },
        {
          id: 'route_park_2',
          speaker: 'Emiri',
          speakerCharacterId: 'girl_02',
          location: 'Twilight Park',
          text: '"Yeah! The sunset is so pretty. I love chatting with you while we walk, Aoi♪"',
          voiceUrl: '/voices/chat_park_2.wav',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Idle.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: '/animations/Quick Formal Bow.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'doki',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.5,
          goto: 'ending_chat',
        },
        {
          id: 'ending_chat',
          speaker: 'Aoi & Emiri',
          location: 'Way home',
          text: '"\\"Well then, let\'s go!\\"" — And so began their delightful after-school time. [Scenario End]',
          avatars: {
            girl_01: {
              motion: '/animations/Standing Greeting.fbx',
              expression: 'happy',
              expressionWeight: 0.7,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: '/animations/Standing Greeting.fbx',
              expression: 'neutral',
              expressionWeight: 0.6,
              effectText: 'yatta',
            },
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'pullOut',
          cameraStrength: 0.8,
        },
      ],
    },
  ],
};

export function getTwoGirlsConversationScenario(lang: Language = getLanguage()): ScenarioPackage {
  return lang === 'en' ? TWO_GIRLS_CONVERSATION_SCENARIO_EN : TWO_GIRLS_CONVERSATION_SCENARIO_JA;
}
