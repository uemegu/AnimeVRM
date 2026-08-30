import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';

export const PARK_CONFESSION_SCENARIO_JA: ScenarioPackage = {
  id: 'park_confession',
  title: '夕暮れの公園と放課後の期待',
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.35,
  seUrl: '/se/large_brown_cicada.mp3',
  seVolume: 0.15,
  chapters: [
    {
      id: 'main',
      title: '放課後の呼び出し',
      scenes: [
        // Scene 1: 導入 - 呼び出された主人公と待っていた女の子
        {
          id: 'intro_1',
          speaker: '女の子',
          location: '夕暮れの公園',
          scenePreset: 'evening_park',
          text: '「あ、来てくれたんだ……！ 急にこんな公園に呼び出したりして、ごめんね」',
          voiceUrl: '/voices/confess_intro_1.wav',
          avatar: {
            motion: '/animations/Standing Greeting.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
            effectText: 'doki',
          },
          cameraStartAngle: 'front',
          cameraPreset: 'pushIn',
          cameraStrength: 0.8,
        },
        // Scene 2: 告白を期待してそわそわする女の子
        {
          id: 'intro_2',
          speaker: '女の子',
          location: '夕暮れの公園・ベンチ前',
          text: '「あのね……ずっと前から、あなたに伝えたいことがあって……」',
          voiceUrl: '/voices/confess_intro_2.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
            faceTexture: '/textures/face_blush.png',
            effectText: 'doki',
          },
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.5,
        },
        // Scene 3: 問いかけと選択肢
        {
          id: 'intro_3',
          speaker: '女の子',
          location: '夕暮れの公園・ベンチ前',
          text: '「私のこと……どう思ってる……？」',
          voiceUrl: '/voices/confess_intro_3.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
            faceTexture: '/textures/face_blush.png',
            effectText: 'doki',
          },
          cameraPreset: 'hold',
          choices: [
            {
              text: '「俺もずっと好きだった！付き合ってください！」',
              flag: 'confess_love',
              goto: 'route_love_1',
              effectText: 'yatta',
            },
            {
              text: '「先週貸した500円、返してほしいんだけど」',
              flag: 'ask_money',
              goto: 'route_money_1',
              effectText: 'gaan',
            },
            {
              text: '（何も言わずにじっと見つめる）',
              flag: 'silent_stare',
              goto: 'route_silent_1',
              effectText: 'shiin',
            },
          ],
        },

        // -------------------------------------------------------------
        // ルートA: 告白成功ルート (love_confess)
        // -------------------------------------------------------------
        {
          id: 'route_love_1',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「やったーっ！ え……！？ ほんとに……！？ 夢じゃないよね……！？」',
          voiceUrl: '/voices/confess_love_1.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 1.0,
            faceTexture: '/textures/face_blush.png',
            effectText: 'yatta',
          },
          cameraStartAngle: 'closeUp',
          cameraPreset: 'punchIn',
          cameraStrength: 1.2,
        },
        {
          id: 'route_love_2',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「すっごく嬉しい……！ 私、ずっとあなたのことばかり考えてたの……っ！」',
          voiceUrl: '/voices/confess_love_2.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 1.0,
            faceTexture: '/textures/face_blush.png',
            effectText: {
              preset: 'doki',
              text: 'ドキドキ♡',
            },
          },
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.6,
        },
        {
          id: 'route_love_3',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「ふふっ、これからもずっと隣にいてね！ 約束だよ♪」',
          voiceUrl: '/voices/confess_love_3.wav',
          avatar: {
            motion: '/animations/Quick Formal Bow.fbx',
            expression: 'happy',
            expressionWeight: 0.9,
            faceTexture: '/textures/face_blush.png',
            effectText: 'kirakira',
          },
          cameraPreset: 'pullOut',
          cameraStrength: 0.8,
          goto: 'ending_common',
        },

        // -------------------------------------------------------------
        // ルートB: 500円請求ルート (ask_money) -> ガーン・イライラ
        // -------------------------------------------------------------
        {
          id: 'route_money_1',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「え……？ ご、500えん……？」',
          voiceUrl: '/voices/confess_money_1.wav',
          avatar: {
            motion: '/animations/Dismissing Gesture.fbx',
            expression: 'surprised',
            expressionWeight: 1.0,
            effectText: 'gaan',
          },
          cameraStartAngle: 'closeUp',
          cameraPreset: 'punchIn',
          cameraStrength: 1.0,
        },
        {
          id: 'route_money_2',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「そ、そんな理由でこんな呼び出しに応じたの……！？ 私の心の準備とドキドキを返してよー！！」',
          voiceUrl: '/voices/confess_money_2.wav',
          avatar: {
            motion: '/animations/Angry.fbx',
            expression: 'angry',
            expressionWeight: 1.0,
            effectText: 'iraira',
          },
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.8,
        },
        {
          id: 'route_money_3',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「ほら！ 500円！ これで文句ないでしょ！ もうっ、鈍感バカーッ！」',
          voiceUrl: '/voices/confess_money_3.wav',
          avatar: {
            motion: '/animations/Angry.fbx',
            expression: 'angry',
            expressionWeight: 0.8,
            effectText: 'wanawana',
          },
          cameraPreset: 'panRight',
          cameraStrength: 0.7,
          goto: 'ending_common',
        },

        // -------------------------------------------------------------
        // ルートC: 沈黙ルート (silent_stare) -> シーン・ビクッ
        // -------------------------------------------------------------
        {
          id: 'route_silent_1',
          speaker: '',
          location: '夕暮れの公園',
          text: '（…………静寂が流れる…………）',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.5,
            effectText: 'shiin',
          },
          cameraPreset: 'hold',
          cameraStrength: 0.2,
        },
        {
          id: 'route_silent_2',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「ちょ、ちょっと……なんで何も言わないの……！？ 気まずいから何か言ってよ〜っ！」',
          voiceUrl: '/voices/confess_silent_2.wav',
          avatar: {
            motion: '/animations/Acknowledging.fbx',
            expression: 'surprised',
            expressionWeight: 0.9,
            effectText: 'biku',
          },
          cameraStartAngle: 'closeUp',
          cameraPreset: 'punchIn',
          cameraStrength: 1.1,
        },
        {
          id: 'route_silent_3',
          speaker: '女の子',
          location: '夕暮れの公園',
          text: '「うぅ……からかわないでよね……。もう一回、ちゃんと最初からやり直してあげるからね！」',
          voiceUrl: '/voices/confess_silent_3.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.7,
            effectText: 'doki',
          },
          cameraPreset: 'pullOut',
          cameraStrength: 0.7,
          goto: 'ending_common',
        },

        // -------------------------------------------------------------
        // エピローグ / 終了
        // -------------------------------------------------------------
        {
          id: 'ending_common',
          speaker: '',
          location: '夕暮れの公園',
          text: '―― 夕暮れの公園での出来事は、こうして幕を閉じた。 【シナリオ終了】',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.5,
          },
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.4,
        },
      ],
    },
  ],
};

export const PARK_CONFESSION_SCENARIO_EN: ScenarioPackage = {
  id: 'park_confession',
  title: 'Twilight Park & After-School Anticipation',
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.35,
  seUrl: '/se/large_brown_cicada.mp3',
  seVolume: 0.15,
  chapters: [
    {
      id: 'main',
      title: 'After-School Summons',
      scenes: [
        // Scene 1: Intro
        {
          id: 'intro_1',
          speaker: 'Girl',
          location: 'Twilight Park',
          scenePreset: 'evening_park',
          text: '"Ah, you came...! Sorry for calling you out to this park so suddenly."',
          voiceUrl: '/voices/confess_intro_1.wav',
          avatar: {
            motion: '/animations/Standing Greeting.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
            effectText: 'doki',
          },
          cameraStartAngle: 'front',
          cameraPreset: 'pushIn',
          cameraStrength: 0.8,
        },
        // Scene 2: Hesitation
        {
          id: 'intro_2',
          speaker: 'Girl',
          location: 'Twilight Park - Near Bench',
          text: '"Um, you know... there\'s something I\'ve been meaning to tell you for a long time..."',
          voiceUrl: '/voices/confess_intro_2.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
            faceTexture: '/textures/face_blush.png',
            effectText: 'doki',
          },
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.5,
        },
        // Scene 3: Question & Choices
        {
          id: 'intro_3',
          speaker: 'Girl',
          location: 'Twilight Park - Near Bench',
          text: '"How... how do you feel about me...?"',
          voiceUrl: '/voices/confess_intro_3.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
            faceTexture: '/textures/face_blush.png',
            effectText: 'doki',
          },
          cameraPreset: 'hold',
          choices: [
            {
              text: '"I\'ve always loved you too! Please go out with me!"',
              flag: 'confess_love',
              goto: 'route_love_1',
              effectText: 'yatta',
            },
            {
              text: '"Can I have back the 500 yen I lent you last week?"',
              flag: 'ask_money',
              goto: 'route_money_1',
              effectText: 'gaan',
            },
            {
              text: '(Stare at her silently without saying a word)',
              flag: 'silent_stare',
              goto: 'route_silent_1',
              effectText: 'shiin',
            },
          ],
        },

        // -------------------------------------------------------------
        // Route A: Confession Success (love_confess)
        // -------------------------------------------------------------
        {
          id: 'route_love_1',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"Yay!! Wait... really!? You mean it!? This isn\'t a dream, right...!?"',
          voiceUrl: '/voices/confess_love_1.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 1.0,
            faceTexture: '/textures/face_blush.png',
            effectText: 'yatta',
          },
          cameraStartAngle: 'closeUp',
          cameraPreset: 'punchIn',
          cameraStrength: 1.2,
        },
        {
          id: 'route_love_2',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"I\'m so happy...! I\'ve been thinking about you non-stop all this time...!"',
          voiceUrl: '/voices/confess_love_2.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 1.0,
            faceTexture: '/textures/face_blush.png',
            effectText: {
              preset: 'doki',
              text: 'Heart Thump♡',
            },
          },
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.6,
        },
        {
          id: 'route_love_3',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"Hehe, stay by my side forever, okay? It\'s a promise♪"',
          voiceUrl: '/voices/confess_love_3.wav',
          avatar: {
            motion: '/animations/Quick Formal Bow.fbx',
            expression: 'happy',
            expressionWeight: 0.9,
            faceTexture: '/textures/face_blush.png',
            effectText: 'kirakira',
          },
          cameraPreset: 'pullOut',
          cameraStrength: 0.8,
          goto: 'ending_common',
        },

        // -------------------------------------------------------------
        // Route B: 500 Yen (ask_money)
        // -------------------------------------------------------------
        {
          id: 'route_money_1',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"Huh...? F-Five hundred yen...?"',
          voiceUrl: '/voices/confess_money_1.wav',
          avatar: {
            motion: '/animations/Dismissing Gesture.fbx',
            expression: 'surprised',
            expressionWeight: 1.0,
            effectText: 'gaan',
          },
          cameraStartAngle: 'closeUp',
          cameraPreset: 'punchIn',
          cameraStrength: 1.0,
        },
        {
          id: 'route_money_2',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"Is that why you showed up today...!? Give me back my heartfelt anticipation and racing heart!!"',
          voiceUrl: '/voices/confess_money_2.wav',
          avatar: {
            motion: '/animations/Angry.fbx',
            expression: 'angry',
            expressionWeight: 1.0,
            effectText: 'iraira',
          },
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.8,
        },
        {
          id: 'route_money_3',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"Here! Take your 500 yen! Happy now?! Geez, you dense idiot!"',
          voiceUrl: '/voices/confess_money_3.wav',
          avatar: {
            motion: '/animations/Angry.fbx',
            expression: 'angry',
            expressionWeight: 0.8,
            effectText: 'wanawana',
          },
          cameraPreset: 'panRight',
          cameraStrength: 0.7,
          goto: 'ending_common',
        },

        // -------------------------------------------------------------
        // Route C: Silent Stare (silent_stare)
        // -------------------------------------------------------------
        {
          id: 'route_silent_1',
          speaker: '',
          location: 'Twilight Park',
          text: '(...... An awkward silence settles in ......)',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.5,
            effectText: 'shiin',
          },
          cameraPreset: 'hold',
          cameraStrength: 0.2,
        },
        {
          id: 'route_silent_2',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"W-Wait... why aren\'t you saying anything...!? This is so awkward, say something already~!"',
          voiceUrl: '/voices/confess_silent_2.wav',
          avatar: {
            motion: '/animations/Acknowledging.fbx',
            expression: 'surprised',
            expressionWeight: 0.9,
            effectText: 'biku',
          },
          cameraStartAngle: 'closeUp',
          cameraPreset: 'punchIn',
          cameraStrength: 1.1,
        },
        {
          id: 'route_silent_3',
          speaker: 'Girl',
          location: 'Twilight Park',
          text: '"Ugh... don\'t tease me like that... Fine, I\'ll let you start over properly from the beginning!"',
          voiceUrl: '/voices/confess_silent_3.wav',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.7,
            effectText: 'doki',
          },
          cameraPreset: 'pullOut',
          cameraStrength: 0.7,
          goto: 'ending_common',
        },

        // -------------------------------------------------------------
        // Epilogue / Ending
        // -------------------------------------------------------------
        {
          id: 'ending_common',
          speaker: '',
          location: 'Twilight Park',
          text: '— And so, the after-school moment in the twilight park drew to a close. [Scenario End]',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.5,
          },
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.4,
        },
      ],
    },
  ],
};

export function getParkConfessionScenario(lang: Language = getLanguage()): ScenarioPackage {
  return lang === 'en' ? PARK_CONFESSION_SCENARIO_EN : PARK_CONFESSION_SCENARIO_JA;
}

export const PARK_CONFESSION_SCENARIO: ScenarioPackage = PARK_CONFESSION_SCENARIO_JA;
