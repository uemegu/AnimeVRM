import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';

export const NISA_SCENARIO_JA: ScenarioPackage = {
  id: 'nisa_all_country',
  title: '夕暮れの校門とオルカンの憂鬱',
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.35,
  seUrl: '/se/large_brown_cicada.mp3',
  seVolume: 0.15,
  chapters: [
    {
      id: 'main',
      title: '放課後の投資相談',
      scenes: [
        // Scene 1: 導入 - 夕暮れの校門で待っていた葵
        {
          id: 'intro_1',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          scenePreset: 'evening_school',
          text: '「あ、来てくれたんだ……！ 放課後に校門の前で待っててなんて言って、急にごめんね。」',
          voiceUrl: '/voices/nisa_01.mp3',
          avatar: {
            motion: '/animations/Standing Greeting.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'pushIn',
          cameraStrength: 0.4,
        },
        // Scene 2: 深刻な切り出し（シリアスな空気）
        {
          id: 'intro_2',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「あのね……ずっと一人で悩んでて、誰にも言えなかったんだけど……あなたにだけは、正直に相談したくて……。」',
          voiceUrl: '/voices/nisa_02.mp3',
          avatar: {
            expression: 'sorrow',
            expressionWeight: 0.7,
            effectText: 'doki',
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
        },
        // Scene 3: NISAを始めた告白
        {
          id: 'intro_3',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「私ね……今年から新NISA、始めたんだ……。」',
          voiceUrl: '/voices/nisa_03.mp3',
          avatar: {
            motion: '/animations/Acknowledging.fbx',
            expression: 'happy',
            expressionWeight: 0.9,
            effectText: 'doki',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
        },
        // Scene 4: オルカンの常識への不安
        {
          id: 'intro_4',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「ネットのみんなはさ、『思考停止でオルカン一本買っとけば20年後には勝てる』って言うでしょ……？」',
          voiceUrl: '/voices/nisa_04.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'angry',
            expressionWeight: 0.8,
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
        },
        // Scene 5: 涙の吐露（不安が頂点に達し、涙エフェクト発動。以降モーションはIdleに固定）
        {
          id: 'intro_5',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「でも……もしこれから世界的な大恐慌が来たらどうするの……っ！？ 人口動態とか地政学リスクとか……本当に全世界株式一本で大丈夫なの……っ！？」',
          voiceUrl: '/voices/nisa_05.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'sorrow',
            expressionWeight: 1.0,
            tears: true,
            tearConfig: {
              side: 'both',
              speed: 0.45,
              glowIntensity: 2.0,
              trailLength: 1.0,
              loop: false,
            },
          },
          cameraZoom: 'speaker',
          cameraPreset: 'pushIn',
          cameraStrength: 0.5,
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
        },
        // Scene 6: 助けを求める問いかけと選択肢
        {
          id: 'intro_6',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「私……毎月の積立日になるたびに胃が痛くて……っ。ねえ、私どうしたらいいと思う……？」',
          voiceUrl: '/voices/nisa_06.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'sorrow',
            expressionWeight: 0.9,
            tears: true,
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          choices: [
            {
              text: '「世界の成長を信じて気絶ホールド一択だよ」',
              flag: 'choice_hold',
              goto: 'route_hold_1',
              effectText: 'kirakira',
            },
            {
              text: '「不安なら少し現金比率を高めようか」',
              flag: 'choice_cash',
              goto: 'route_cash_1',
              effectText: 'doki',
            },
            {
              text: '「全財産をレバナスにぶち込めば悩みも消えるよ」',
              flag: 'choice_reva',
              goto: 'route_reva_1',
              effectText: 'biku',
            },
          ],
        },

        // -------------------------------------------------------------
        // ルートA: 気絶ホールド
        // -------------------------------------------------------------
        {
          id: 'route_hold_1',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「気絶ホールド……！ そっか、アプリを消して20年間寝てればいいんだね……！ なんだか少し心が軽くなったかも……ありがとう……！」',
          voiceUrl: '/voices/nisa_hold_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.85,
            tears: true,
            effectText: 'yatta',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          goto: 'epilogue_1',
        },

        // -------------------------------------------------------------
        // ルートB: 現金比率
        // -------------------------------------------------------------
        {
          id: 'route_cash_1',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「現金比率……！ そうだよね、無リスク資産でリスク許容度を整えるのが基本だった……！ 冷静になれたよ、ありがとう……！」',
          voiceUrl: '/voices/nisa_cash_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.8,
            tears: true,
            effectText: 'kirakira',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          goto: 'epilogue_1',
        },

        // -------------------------------------------------------------
        // ルートC: レバナス全力（ツッコミ）
        // -------------------------------------------------------------
        {
          id: 'route_reva_1',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「えっ、全財産レバナス……！？ それ、不安どころか破滅に向かってない……！？ もう、バカぁ……っ！」',
          voiceUrl: '/voices/nisa_reva_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'angry',
            expressionWeight: 0.85,
            tears: true,
            effectText: 'iraira',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          goto: 'epilogue_1',
        },

        // -------------------------------------------------------------
        // エピローグ
        // -------------------------------------------------------------
        {
          id: 'epilogue_1',
          speaker: '葵',
          location: '放課後・夕暮れの校門',
          text: '「ふふっ、あなたに相談してよかった。……じゃあ、一緒にアイスでも食べて帰ろ？ 私のNISA口座から出すわけにはいかないから、割り勘ね！」',
          voiceUrl: '/voices/nisa_epilogue_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 1.0,
            tears: true,
            effectText: 'kirakira',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
        },
      ],
    },
  ],
};

export const NISA_SCENARIO_EN: ScenarioPackage = {
  id: 'nisa_all_country',
  title: 'Sunset at School Gate: The All-Country ETF Anxiety',
  bgmUrl: '/bgm/bgm.mp3',
  bgmVolume: 0.35,
  seUrl: '/se/large_brown_cicada.mp3',
  seVolume: 0.15,
  chapters: [
    {
      id: 'main',
      title: 'Afterschool Investment Consultation',
      scenes: [
        {
          id: 'intro_1',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          scenePreset: 'evening_school',
          text: '"Ah, you came...! Sorry for asking you out to the school gate after class out of nowhere."',
          voiceUrl: '/voices/nisa_01.mp3',
          avatar: {
            motion: '/animations/Standing Greeting.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'pushIn',
          cameraStrength: 0.4,
        },
        {
          id: 'intro_2',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"The truth is... I\'ve been agonizing over this alone, but you\'re the only one I can truly confide in..."',
          voiceUrl: '/voices/nisa_02.mp3',
          avatar: {
            motion: '/animations/Female Standing Pose.fbx',
            expression: 'sorrow',
            expressionWeight: 0.7,
            effectText: 'doki',
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
        },
        {
          id: 'intro_3',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"I... I opened a new NISA account and started investing this year..."',
          voiceUrl: '/voices/nisa_03.mp3',
          avatar: {
            motion: '/animations/Acknowledging.fbx',
            expression: 'neutral',
            expressionWeight: 0.9,
            effectText: 'wanawana',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
        },
        {
          id: 'intro_4',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"Everyone online says, \'Just buy All-Country index and sleep for 20 years and you win\', right...?"',
          voiceUrl: '/voices/nisa_04.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'neutral',
            expressionWeight: 0.8,
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
        },
        {
          id: 'intro_5',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"But... what if the whole world economy enters a Great Depression...?! What about demographics and geopolitical risks... Is All-Country really foolproof...?!',
          voiceUrl: '/voices/nisa_05.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'sorrow',
            expressionWeight: 1.0,
            tears: true,
            tearConfig: {
              side: 'both',
              speed: 0.45,
              glowIntensity: 2.0,
              trailLength: 1.0,
              loop: false,
            },
            effectText: 'gaan',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'pushIn',
          cameraStrength: 0.5,
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.6,
        },
        {
          id: 'intro_6',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"My stomach hurts every month when auto-invest triggers...! What do you think I should do...?"',
          voiceUrl: '/voices/nisa_06.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'sorrow',
            expressionWeight: 0.9,
            tears: true,
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          choices: [
            {
              text: '"Trust global growth and knock yourself out holding."',
              flag: 'choice_hold',
              goto: 'route_hold_1',
              effectText: 'kirakira',
            },
            {
              text: '"If you\'re worried, just raise your cash ratio."',
              flag: 'choice_cash',
              goto: 'route_cash_1',
              effectText: 'doki',
            },
            {
              text: '"Dump all your life savings into Leveraged NASDAQ."',
              flag: 'choice_reva',
              goto: 'route_reva_1',
              effectText: 'biku',
            },
          ],
        },
        {
          id: 'route_hold_1',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"Knock myself out holding...! You\'re right, just delete the app and hibernate for 20 years...! I feel so much lighter... Thank you...!"',
          voiceUrl: '/voices/nisa_hold_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.85,
            tears: true,
            effectText: 'yatta',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          goto: 'epilogue_1',
        },
        {
          id: 'route_cash_1',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"Cash ratio...! That\'s true, keeping risk-free assets to balance risk tolerance is the golden rule...! I feel calm now, thank you...!"',
          voiceUrl: '/voices/nisa_cash_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 0.8,
            tears: true,
            effectText: 'kirakira',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          goto: 'epilogue_1',
        },
        {
          id: 'route_reva_1',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"Wait, 100% Leveraged NASDAQ...?! That\'s not solving anxiety, that\'s a speedrun to financial ruin...! Dummy...!"',
          voiceUrl: '/voices/nisa_reva_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'angry',
            expressionWeight: 0.85,
            tears: true,
            effectText: 'iraira',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
          goto: 'epilogue_1',
        },
        {
          id: 'epilogue_1',
          speaker: 'Aoi',
          location: 'School Gate at Sunset',
          text: '"Hehe, I\'m so glad I talked to you. Let\'s get some ice cream on the way home! We\'re splitting the bill though, can\'t touch my NISA funds!"',
          voiceUrl: '/voices/nisa_epilogue_01.mp3',
          avatar: {
            motion: '/animations/Idle.fbx',
            expression: 'happy',
            expressionWeight: 1.0,
            tears: true,
            effectText: 'kirakira',
          },
          cameraZoom: 'speaker',
          cameraPreset: 'hold',
        },
      ],
    },
  ],
};

export function getNisaScenario(lang: Language = getLanguage()): ScenarioPackage {
  return lang === 'en' ? NISA_SCENARIO_EN : NISA_SCENARIO_JA;
}

export const NISA_SCENARIO: ScenarioPackage = NISA_SCENARIO_JA;
