import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';
import { resolveAssetUrl } from '../utils/path';

export const BEHIND_YOU_SCENARIO_JA: ScenarioPackage = {
  id: 'behind_you_emily',
  title: '噂話は背後にご注意〜教室の秘密〜',
  characters: [
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: [0, 0, -1.3], // 正面・目の前（アオイ）
      rotationY: 0,
    },
    {
      id: 'girl_02',
      character: resolveAssetUrl('/models/girl2.vrm'),
      position: [0, 0, 1.3], // 背後・後ろ（エミリ）
      rotationY: Math.PI,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.25,
  panoramaBackgroundUrl: resolveAssetUrl('/textures/class_room_3d.png'),
  chapters: [
    {
      id: 'main',
      title: '背後のエミリ',
      scenes: [
        // Scene 1: アオイとの2人きりの内緒話
        {
          id: 'scene_1_intro',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '放課後の教室',
          scenePreset: 'morning_school',
          panoramaBackgroundUrl: resolveAssetUrl('/textures/class_room_3d.png'),
          text: '「ねえねえ、ちょっとここだけの内緒話なんだけど……聞いてくれる？」',
          voiceUrl: resolveAssetUrl('/voices/behind_intro_1.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'normal',
              expressionWeight: 1,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.5,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
        },
        // Scene 2: エミリの噂話を始める
        {
          id: 'scene_2_gossip',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '放課後の教室',
          text: '「実はね、エミリちゃん……普段はあんなにツンツンしてるのに、家ではめちゃくちゃ可愛いピンクのぬいぐるみに囲まれて寝てるらしいの！」',
          voiceUrl: resolveAssetUrl('/voices/behind_gossip_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
        },
        // Scene 3: 調子に乗って暴露を続ける
        {
          id: 'scene_3_deep_secret',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '放課後の教室',
          text: '「しかも毎日『くまちゃん、今日も大好きだよ〜♡』ってぎゅーって抱きしめてるんだって！ ふふっ、エミリちゃんがここにいなくて本当に良かった〜！」',
          voiceUrl: resolveAssetUrl('/voices/behind_secret_3.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Acknowledging.fbx'),
              expression: 'happy',
              expressionWeight: 1,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
        },
        // Scene 4: 背後から冷たい声が響く（恐怖の瞬間）
        {
          id: 'scene_4_behind_voice',
          speaker: '？？？ (背後から)',
          speakerCharacterId: 'girl_02', // セリフの発話者はエミリ(girl_02)
          cameraTargetCharacterId: 'girl_01', // カメラはアオイ(girl_01)を映したまま
          location: '放課後の教室',
          text: '「……へぇ？ 私のくまちゃんの話、随分と盛り上がってるみたいじゃない……？」',
          voiceUrl: resolveAssetUrl('/voices/behind_emily_4.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              effectText: {
                preset: 'biku',
                text: 'ビクッ！！！',
                duration: 2.5,
              },
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
              expressionWeight: 0.9,
              effectText: 'iraira',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
          cameraPreset: 'hold',
        },
        // Scene 5: アオイの戦慄
        {
          id: 'scene_5_aoi_panic',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01',
          location: '放課後の教室',
          text: '「ひ、ひぃぃぃっ！？ う、後ろ……！ あなたの真後ろにエミリちゃんが立ってる……！！」',
          voiceUrl: resolveAssetUrl('/voices/behind_panic_5.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              effectText: {
                preset: 'gaan',
                text: 'ガーン！',
                duration: 3.0,
              },
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
          cameraPreset: 'hold',
        },
        // Scene 6: 恐る恐る後ろを振り返る（カメラが180°後方へスムーズに旋回！）
        {
          id: 'scene_6_turn_around',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02', // エミリへカメラが180°旋回
          location: '放課後の教室',
          text: '「私のいない場所で、一体何を話してたのかなぁ……？ じっくり聞かせてもらおうじゃない」',
          voiceUrl: resolveAssetUrl('/voices/behind_turn_6.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
              expressionWeight: 0.8,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
              expressionWeight: 0.9,
              effectText: {
                preset: 'iraira',
                text: 'じとーーーーー (怒)',
                duration: 3.5,
              },
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.4, // ゆっくり恐る恐る振り返る演出
          cameraPreset: 'hold',
        },
        // Scene 7: 選択肢
        {
          id: 'scene_7_choice',
          speaker: 'あなた (選択肢)',
          speakerCharacterId: 'girl_02', // エミリを向き続ける
          cameraZoom: 'speaker',
          location: '放課後の教室',
          text: '（どうやってこのピンチを切り抜けよう……！？）',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
            },
          },
          choices: [
            {
              text: '✨「エミリの可愛さを熱弁してたんだよ！」',
              goto: 'route_praise',
              effectText: 'kirakira',
            },
            {
              text: '👉「アオイが全部言いました！！」',
              goto: 'route_blame',
              effectText: 'wanawana',
            },
            {
              text: '🙇「ひぃっ！ ごめんなさい！！」',
              goto: 'route_apology',
              effectText: 'doki',
            },
          ],
        },

        // ----------------------------------------------------
        // Route A: 褒めてごまかす
        // ----------------------------------------------------
        {
          id: 'route_praise',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '放課後の教室',
          text: '「な、なによそれ……！ か、可愛いだなんて、そんなこと言って誤魔化そうとしても無駄なんだからねっ///」',
          voiceUrl: resolveAssetUrl('/voices/behind_praise.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.7,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.9,
              faceTexture: resolveAssetUrl('/textures/girl2_face_blush.png'),
              effectText: 'doki',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
          goto: 'route_praise_2',
        },
        {
          id: 'route_praise_2',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01', // アオイ側へカメラが振り返る
          location: '放課後の教室',
          text: '「ふふっ、エミリちゃん顔真っ赤だよ〜！ すっごく可愛い〜♪」',
          voiceUrl: resolveAssetUrl('/voices/behind_praise_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.6,
              faceTexture: resolveAssetUrl('/textures/girl2_face_blush.png'),
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
          goto: 'scene_ending',
        },

        // ----------------------------------------------------
        // Route B: アオイに責任転嫁
        // ----------------------------------------------------
        {
          id: 'route_blame',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01', // アオイ側へカメラが戻る
          location: '放課後の教室',
          text: '「えええっ！？ ちょっと、自分だけ助かろうとするなんてひどいよ〜〜！！」',
          voiceUrl: resolveAssetUrl('/voices/behind_blame_1.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Angry.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              effectText: 'wanawana',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
          goto: 'route_blame_2',
        },
        {
          id: 'route_blame_2',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02', // 再びエミリへ
          location: '放課後の教室',
          text: '「ふふっ、醜い責任の擦り付け合いね……！ 二人まとめてお仕置き決定♪」',
          voiceUrl: resolveAssetUrl('/voices/behind_blame_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
              effectText: 'iraira',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
          goto: 'scene_ending',
        },

        // ----------------------------------------------------
        // Route C: 素直に謝罪
        // ----------------------------------------------------
        {
          id: 'route_apology',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '放課後の教室',
          text: '「……まったく。素直に謝ったから今回は許してあげる。でも次くまちゃんの話をしたら、本当に怒るからね！」',
          voiceUrl: resolveAssetUrl('/voices/behind_apology.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'neutral',
              expressionWeight: 0.7,
              effectText: 'shiin',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'hold',
          goto: 'route_apology_2',
        },
        {
          id: 'route_apology_2',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01', // アオイ側へカメラが振り返る
          location: '放課後の教室',
          text: '「ふぅ〜〜よかったぁ……！ 許してもらえて命拾いしたね！」',
          voiceUrl: resolveAssetUrl('/voices/behind_apology_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
              effectText: 'doki',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
          goto: 'scene_ending',
        },

        // ----------------------------------------------------
        // エンディング
        // ----------------------------------------------------
        {
          id: 'scene_ending',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02',
          location: '放課後の教室',
          text: '「さ、放課後なんだから三人で駅前カフェ行くわよ！ 二人とも、私の奢りなんだから感謝しなさいよね！」',
          voiceUrl: resolveAssetUrl('/voices/behind_ending.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
          goto: 'scene_ending_aoi',
        },
        {
          id: 'scene_ending_aoi',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01', // 最後は正面のアオイへ振り返って完結
          location: '放課後の教室',
          text: '「ふふっ、エミリちゃん本当にスイーツ大好きだよね。写真いっぱい撮っちゃお♪ カフェ行こ行こー！」',
          voiceUrl: resolveAssetUrl('/voices/behind_ending_aoi.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
        },
      ],
    },
  ],
};

export const BEHIND_YOU_SCENARIO_EN: ScenarioPackage = {
  id: 'behind_you_emily',
  title: 'Watch Your Back: Secrets in the Classroom',
  characters: [
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: [0, 0, -1.0],
      rotationY: 0,
    },
    {
      id: 'girl_02',
      character: resolveAssetUrl('/models/girl2.vrm'),
      position: [0, 0, 1.0],
      rotationY: Math.PI,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.25,
  panoramaBackgroundUrl: resolveAssetUrl('/textures/class_room_3d.png'),
  chapters: [
    {
      id: 'main',
      title: 'Emily Behind You',
      scenes: [
        {
          id: 'scene_1_intro',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Classroom After School',
          scenePreset: 'morning_school',
          panoramaBackgroundUrl: resolveAssetUrl('/textures/class_room_3d.png'),
          text: '"Hey, can you keep a secret just between us...?"',
          voiceUrl: resolveAssetUrl('/voices/behind_intro_1.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.7,
              effectText: 'doki',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.5,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
        },
        {
          id: 'scene_2_gossip',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Classroom After School',
          text: '"The truth is, even though Emily is always acting so tsundere... she sleeps surrounded by cute pink plushies at home!"',
          voiceUrl: resolveAssetUrl('/voices/behind_gossip_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
        },
        {
          id: 'scene_3_deep_secret',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Classroom After School',
          text: '"And she literally hugs her teddy bear saying \'I love you so much today too, Teddy♡\' every day! Ahaha, I\'m so glad Emily isn\'t here right now~!"',
          voiceUrl: resolveAssetUrl('/voices/behind_secret_3.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Acknowledging.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'wanawana',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
              expressionWeight: 0.6,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
        },
        {
          id: 'scene_4_behind_voice',
          speaker: '??? (From Behind)',
          speakerCharacterId: 'girl_02',
          cameraTargetCharacterId: 'girl_01',
          location: 'Classroom After School',
          text: '"...Oh really? Sounds like you two are having quite a thrilling conversation about my teddy bear...?"',
          voiceUrl: resolveAssetUrl('/voices/behind_emily_4.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Angry.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              effectText: {
                preset: 'biku',
                text: 'Eeeek!',
                duration: 2.5,
              },
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
              expressionWeight: 0.9,
              effectText: 'iraira',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
          cameraPreset: 'hold',
        },
        {
          id: 'scene_5_aoi_panic',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Classroom After School',
          text: '"E-Eeeek!? B-Behind you...! Emily is standing right behind you...!!" ',
          voiceUrl: resolveAssetUrl('/voices/behind_panic_5.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              effectText: {
                preset: 'gaan',
                text: 'OMG!',
                duration: 3.0,
              },
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
        },
        {
          id: 'scene_6_turn_around',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          location: 'Classroom After School',
          text: '"What were you two gossiping about behind my back, huh? Why don\'t you tell me all the details?"',
          voiceUrl: resolveAssetUrl('/voices/behind_turn_6.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
              expressionWeight: 0.8,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
              expressionWeight: 0.9,
              effectText: {
                preset: 'iraira',
                text: 'Glare...',
                duration: 3.5,
              },
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.4,
          cameraPreset: 'hold',
        },
        {
          id: 'scene_7_choice',
          speaker: 'You (Choice)',
          speakerCharacterId: 'girl_02',
          cameraZoom: 'speaker',
          location: 'Classroom After School',
          text: '(How do I get out of this alive...!?)',
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'angry',
            },
          },
          choices: [
            {
              text: '✨ "I was just praising how adorable you are!"',
              goto: 'route_praise',
              effectText: 'kirakira',
            },
            {
              text: '👉 "Aoi said everything, not me!!"',
              goto: 'route_blame',
              effectText: 'wanawana',
            },
            {
              text: '🙇 "Eeeep! I\'m so sorry!!" ',
              goto: 'route_apology',
              effectText: 'doki',
            },
          ],
        },
        {
          id: 'route_praise',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          location: 'Classroom After School',
          text: '"W-What are you saying...?! C-Calling me cute won\'t save you, okay...?!///"',
          voiceUrl: resolveAssetUrl('/voices/behind_praise.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.7,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.9,
              faceTexture: resolveAssetUrl('/textures/girl2_face_blush.png'),
              effectText: 'doki',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'hold',
          goto: 'route_praise_2',
        },
        {
          id: 'route_praise_2',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01', // Turns back to Aoi
          location: 'Classroom After School',
          text: '"Hehe, Emily\'s face is completely red! She\'s so adorable~♪"',
          voiceUrl: resolveAssetUrl('/voices/behind_praise_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 0.6,
              faceTexture: resolveAssetUrl('/textures/girl2_face_blush.png'),
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
          goto: 'scene_ending',
        },
        {
          id: 'route_blame',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01',
          location: 'Classroom After School',
          text: '"Whaaat?! How could you betray me just to save yourself?!"',
          voiceUrl: resolveAssetUrl('/voices/behind_blame_1.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Angry.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              effectText: 'wanawana',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 0.8,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
          goto: 'route_blame_2',
        },
        {
          id: 'route_blame_2',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          location: 'Classroom After School',
          text: '"Hehe, throwing each other under the bus, are we? You\'re both getting punished together♪"',
          voiceUrl: resolveAssetUrl('/voices/behind_blame_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
              effectText: 'iraira',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
          goto: 'scene_ending',
        },
        {
          id: 'route_apology',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          location: 'Classroom After School',
          text: '"...Good grief. Since you apologized honestly, I\'ll let you off this once. But mention my teddy bear again and you\'ll regret it!"',
          voiceUrl: resolveAssetUrl('/voices/behind_apology.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 0.6,
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Female Standing Pose.fbx'),
              expression: 'neutral',
              expressionWeight: 0.7,
              effectText: 'shiin',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'hold',
          goto: 'route_apology_2',
        },
        {
          id: 'route_apology_2',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01', // Turns back to Aoi
          location: 'Classroom After School',
          text: '"Phew~~ What a relief...! We barely survived that one!"',
          voiceUrl: resolveAssetUrl('/voices/behind_apology_2.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.8,
              effectText: 'doki',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
          goto: 'scene_ending',
        },
        {
          id: 'scene_ending',
          speaker: 'Emily',
          speakerCharacterId: 'girl_02',
          location: 'Classroom After School',
          text: '"Alright, school\'s over so the three of us are heading to the station cafe! And of course, it\'s on you two♪"',
          voiceUrl: resolveAssetUrl('/voices/behind_ending.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'hold',
          goto: 'scene_ending_aoi',
        },
        {
          id: 'scene_ending_aoi',
          speaker: 'Aoi',
          speakerCharacterId: 'girl_01', // Final turn to front Aoi
          location: 'Classroom After School',
          text: '"Yay! Going to the cafe together with Emily! Let\'s go, let\'s go~♪"',
          voiceUrl: resolveAssetUrl('/voices/behind_ending_aoi.wav'),
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
              effectText: 'kirakira',
            },
            girl_02: {
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 0.9,
            },
          },
          cameraZoom: 'speaker',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 1.0,
          cameraPreset: 'hold',
        },
      ],
    },
  ],
};

export function getBehindYouScenario(lang: Language = getLanguage()): ScenarioPackage {
  return lang === 'ja' ? BEHIND_YOU_SCENARIO_JA : BEHIND_YOU_SCENARIO_EN;
}
