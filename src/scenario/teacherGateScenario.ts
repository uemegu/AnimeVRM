import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';
import { resolveAssetUrl } from '../utils/path';

export const TEACHER_GATE_SCENARIO_JA: ScenarioPackage = {
  id: 'teacher_gate',
  title: '校門の邂逅 〜シオンと桐島先生の秘密の推し〜',
  characters: [
    {
      id: 'shion',
      character: resolveAssetUrl('/models/shion/shion-school.vrm'),
      position: [0.12, 0, -0.4],
      rotationY: -0.22,
    },
    {
      id: 'teacher',
      character: resolveAssetUrl('/models/teacher/teacher.vrm'),
      position: [-0.45, 0, -0.5],
      rotationY: 0.3,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.22,
  chapters: [
    {
      id: 'main',
      title: '登校と校門の出会い',
      scenes: [
        // ============================================================
        // Part 1: シオンと並んで登校（無限ループ歩行）
        // ============================================================
        {
          id: 'walk_1',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'player',
          location: '朝の並木道',
          text: '「ふぁあ……おはよ……。朝って、なんでこんなに光合成しづらい空気なんだろ……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_1.mp3'),
          scrollingBackground: {
            enabled: true,
            textureUrl: resolveAssetUrl('/textures/town_far.avif'),
            speed: 0.65,
            blur: 1.0,
            direction: 'left',
          },
          cameraZoom: 'speaker_close',
          cameraStartAngle: 'left',
          cameraDistance: 0.88,
          cameraTarget: [0, 1.30, 0],
          cameraPreset: 'hold',
          cameraTransitionDuration: 0,
          cameraTransitionEasing: 'cut',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'sleepy',
              expressionWeight: 1.0,
              position: [0.12, 0, -0.4],
              rotationY: -0.22,
              headOffset: [0, -0.12],
            },
            teacher: {
              visible: false,
            },
          },
        },
        {
          id: 'walk_2',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'player',
          location: '朝の並木道',
          text: '「昨日も……気づいたら朝の四時まで、海外の古生物学会の論文読んでて……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_2.mp3'),
          scrollingBackground: {
            enabled: true,
            textureUrl: resolveAssetUrl('/textures/town_far.avif'),
            speed: 0.65,
            blur: 1.0,
            direction: 'left',
          },
          cameraZoom: 'speaker_close',
          cameraStartAngle: 'left',
          cameraDistance: 0.88,
          cameraTarget: [0, 1.30, 0],
          cameraPreset: 'hold',
          cameraTransitionDuration: 0,
          cameraTransitionEasing: 'cut',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'sleepy',
              expressionWeight: 1.0,
              position: [0.12, 0, -0.4],
              rotationY: -0.22,
              headOffset: [0, -0.12],
            },
            teacher: {
              visible: false,
            },
          },
        },

        // --- 選択肢シーン（※ルールに従いセリフ・テキストは完全排除） ---
        {
          id: 'walk_choice',
          speaker: '',
          location: '朝の並木道',
          text: '',
          scrollingBackground: {
            enabled: true,
            textureUrl: resolveAssetUrl('/textures/town_far.avif'),
            speed: 0.65,
            blur: 1.0,
            direction: 'left',
          },
          cameraZoom: 'speaker_close',
          cameraStartAngle: 'left',
          cameraDistance: 0.88,
          cameraTarget: [0, 1.30, 0],
          cameraPreset: 'hold',
          cameraTransitionDuration: 0,
          cameraTransitionEasing: 'cut',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'sleepy',
              expressionWeight: 1.0,
              position: [0.12, 0, -0.4],
              rotationY: -0.22,
              headOffset: [0, -0.12],
            },
            teacher: {
              visible: false,
            },
          },
          choices: [
            {
              text: '「夜更かししすぎ！ 授業中寝たら桐島先生に怒られるぞ」',
              flag: 'choice_scold',
              goto: 'walk_route_scold',
            },
            {
              text: '「古生物……？ 相変わらずマニアックなこと調べてるな」',
              flag: 'choice_maniac',
              goto: 'walk_route_maniac',
            },
          ],
        },

        // --- ルートA: 先生に怒られるぞ ---
        {
          id: 'walk_route_scold',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'player',
          location: '朝の並木道',
          text: '「う……桐島先生、普段は落ち着いてるけど指導は鋭いから……見つかったら怒られちゃう……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_scold.mp3'),
          scrollingBackground: {
            enabled: true,
            textureUrl: resolveAssetUrl('/textures/town_far.avif'),
            speed: 0.65,
            blur: 1.0,
            direction: 'left',
          },
          cameraZoom: 'speaker_close',
          cameraStartAngle: 'left',
          cameraDistance: 0.88,
          cameraTarget: [0, 1.30, 0],
          cameraPreset: 'hold',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              position: [0.12, 0, -0.4],
              rotationY: -0.22,
              lookAtCamera: true,
            },
            teacher: {
              visible: false,
            },
          },
          goto: 'gate_arrive',
        },

        // --- ルートB: マニアックだな ---
        {
          id: 'walk_route_maniac',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'player',
          location: '朝の並木道',
          text: '「マニアックじゃないよ……。カンブリア紀の不条理な生態系こそ、世界の真理なんだから……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_maniac.mp3'),
          scrollingBackground: {
            enabled: true,
            textureUrl: resolveAssetUrl('/textures/town_far.avif'),
            speed: 0.65,
            blur: 1.0,
            direction: 'left',
          },
          cameraZoom: 'speaker_close',
          cameraStartAngle: 'left',
          cameraDistance: 0.88,
          cameraTarget: [0, 1.30, 0],
          cameraPreset: 'hold',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              position: [0.12, 0, -0.4],
              rotationY: -0.22,
              lookAtCamera: true,
            },
            teacher: {
              visible: false,
            },
          },
          goto: 'gate_arrive',
        },

        // ============================================================
        // Part 2: 校門へ到着・桐島先生との出会い
        // ============================================================
        {
          id: 'gate_arrive',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「おはよう、二人とも。……あら、シオンさん？ また随分と眠そうな顔をして……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_greeting.mp3'),
          scrollingBackground: {
            enabled: false,
          },
          cameraZoom: 'wide',
          cameraTransitionEasing: 'cut',
          cameraTransitionDuration: 0,
          cameraPreset: 'hold',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sleepy',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
              lookAtCamera: true,
            },
          },
        },
        {
          id: 'gate_shion_reply',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「う……桐島先生……お、おはようございます……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_gate.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Quick Formal Bow.fbx'),
              expression: 'sad',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'neutral',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
            },
          },
        },
        {
          id: 'gate_teacher_notice',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「ふふ、遅刻ギリギリセーフですよ。……ん？ ちょっと待って。あなたのその鞄のストラップ……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_notice.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Acknowledging.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.45],
              rotationY: 0.35,
            },
          },
        },
        {
          id: 'gate_teacher_discover',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「……これ、まさかハルキゲニアの最新復元モデル！？ 背中のトゲの角度からして、最新論文準拠の造形じゃない！」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_discover.mp3'),
          cameraZoom: 'wide',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.4,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.45],
              rotationY: 0.35,
              lookAtCamera: true,
            },
          },
        },
        {
          id: 'gate_shion_shock',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「えっ……！？ せ、先生……これ、わかるの……！？ イカの足だと思って誰も相手にしてくれなかったのに……！」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_shock.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
              lookAtCamera: true,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.45],
              rotationY: 0.35,
            },
          },
        },
        {
          id: 'gate_teacher_geek',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「当たり前でしょう！ あの奇妙極まりない歩行器官と、頭部特定で覆された学説史……あの時代の狂気とロマン、最高に美しいわよね！」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_geek.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.4,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.45],
              rotationY: 0.35,
            },
          },
        },
        {
          id: 'gate_shion_passion',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「そう……！ 化石の上下が逆さまだったところから、電子顕微鏡で単眼が見つかった瞬間が一番熱い……！」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_passion.mp3'),
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.45],
              rotationY: 0.35,
            },
          },
        },

        // --- 選択肢シーン（※ルールに従いセリフ・テキストは完全排除） ---
        {
          id: 'gate_choice',
          speaker: '',
          location: '校門前',
          text: '',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.45],
              rotationY: 0.35,
            },
          },
          choices: [
            {
              text: '「（……二人とも、完全に自分の世界に入り込んでる……）」',
              flag: 'world_in',
              goto: 'gate_teacher_calmdown',
            },
            {
              text: '「先生……それ、生徒を生活指導する顔じゃないですよ」',
              flag: 'point_out',
              goto: 'gate_teacher_calmdown',
            },
          ],
        },

        // ============================================================
        // Part 3: 結び 〜放課後の約束〜
        // ============================================================
        {
          id: 'gate_teacher_calmdown',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'player',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「コホン……！ い、いけないわね。教師たるもの、校門で熱弁を振るうところだったわ」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_calmdown.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'relax',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
              lookAtCamera: true,
            },
          },
        },
        {
          id: 'gate_teacher_invite',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「シオンさん。続きは放課後、準備室でじっくり語り合いましょう。私の秘蔵の化石レプリカ、見せてあげるわ」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_invite.mp3'),
          cameraZoom: 'wide',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'relax',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
            },
          },
        },
        {
          id: 'gate_shion_excited',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「……！ 放課後……絶対行く……！ 先生、最高……」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_excited.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
              lookAtCamera: true,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
            },
          },
        },
        {
          id: 'gate_teacher_condition',
          speaker: '桐島先生',
          speakerCharacterId: 'teacher',
          dialogueTarget: 'partner',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「ふふ。その代わり、今日の小テストで赤点を取ったら準備室立ち入り禁止ですからね？」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_teacher_condition.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
              lookAtCamera: true,
            },
          },
        },
        {
          id: 'gate_shion_promise',
          speaker: 'シオン',
          speakerCharacterId: 'shion',
          dialogueTarget: 'player',
          location: '校門前',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          text: '「……っ、頑張る……！ 今日のテスト、絶対満点取ってみせる……！」',
          voiceUrl: resolveAssetUrl('/voices/teacher/walk_shion_promise.mp3'),
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.5,
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Punching.fbx'),
              expression: 'angry',
              expressionWeight: 1.0,
              position: [0.45, 0, -0.5],
              rotationY: -0.3,
              lookAtCamera: true,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [-0.45, 0, -0.5],
              rotationY: 0.3,
            },
          },
        },
        // --- 結びナレーション ---
        {
          id: 'ending_scene',
          speaker: '',
          location: '校門前',
          text: '――普段はやる気ゼロのシオンが、まさかの古生物オタク仲間を得て情熱に燃え上がった朝。放課後の準備室は、きっと熱い議論で盛り上がることだろう。[シナリオ完]',
          scenePreset: 'morning_school',
          background: resolveAssetUrl('/textures/school-gate-far.avif'),
          cameraZoom: 'wide',
          cameraStartAngle: 'front',
          cameraDistance: 1.5,
          cameraPreset: 'pullOut',
          cameraStrength: 0.4,
          cameraTransitionDuration: 1.2,
          cameraTransitionEasing: 'smooth',
          avatars: {
            shion: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.35, 0, -0.5],
              rotationY: -0.2,
            },
            teacher: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'relaxed',
              expressionWeight: 1.0,
              position: [-0.35, 0, -0.5],
              rotationY: 0.2,
            },
          },
        },
      ],
    },
  ],
};

export const TEACHER_GATE_SCENARIO_EN: ScenarioPackage = {
  ...TEACHER_GATE_SCENARIO_JA,
  title: 'Encounter at the School Gate ~Shion and Ms. Kirishima~',
  chapters: [
    {
      ...TEACHER_GATE_SCENARIO_JA.chapters[0],
      title: 'Morning Walk and the School Gate',
      scenes: TEACHER_GATE_SCENARIO_JA.chapters[0].scenes.map((s) => {
        if (s.id === 'walk_1') return { ...s, text: "Yaaawn... morning... Why does the morning air feel so hard to photosynthesize in..." };
        if (s.id === 'walk_2') return { ...s, text: "Yesterday too... before I knew it, it was 4 AM while reading paleontology papers..." };
        if (s.id === 'walk_choice') return {
          ...s,
          choices: [
            { text: "Staying up too late! Ms. Kirishima will scold you if you fall asleep.", flag: 'choice_scold', goto: 'walk_route_scold' },
            { text: "Paleontology...? Researching niche things as always, huh.", flag: 'choice_maniac', goto: 'walk_route_maniac' },
          ],
        };
        if (s.id === 'walk_route_scold') return { ...s, text: "Ugh... Ms. Kirishima is usually calm, but her discipline is sharp... I'll get scolded if she catches me..." };
        if (s.id === 'walk_route_maniac') return { ...s, text: "It's not niche...! The absurd ecosystem of the Cambrian period is the true essence of the world..." };
        if (s.id === 'gate_arrive') return { ...s, text: "Good morning, both of you. ...Oh? Shion, looking quite sleepy again, aren't you?" };
        if (s.id === 'gate_shion_reply') return { ...s, text: "Ugh... Ms. Kirishima... g-good morning..." };
        if (s.id === 'gate_teacher_notice') return { ...s, text: "Fufu, barely on time. ...Wait, that strap on your school bag..." };
        if (s.id === 'gate_teacher_discover') return { ...s, text: "...Could this be the latest reconstruction model of Hallucigenia!? Look at the angle of those dorsal spines!" };
        if (s.id === 'gate_shion_shock') return { ...s, text: "Eh...!? M-Ms. Kirishima... you know about this...!? Everyone else just called it squid legs...!" };
        if (s.id === 'gate_teacher_geek') return { ...s, text: "Of course I do! Those bizarre locomotory organs, the overturned hypotheses... the sheer madness and romance of that era!" };
        if (s.id === 'gate_shion_passion') return { ...s, text: "Exactly...! Going from upside-down fossils to finding simple eyes under electron microscopy is the peak hype...!" };
        if (s.id === 'gate_choice') return {
          ...s,
          choices: [
            { text: "(...Both of them are completely lost in their own world...)", flag: 'world_in', goto: 'gate_teacher_calmdown' },
            { text: "Sensei... that's not the face of a teacher giving morning discipline.", flag: 'point_out', goto: 'gate_teacher_calmdown' },
          ],
        };
        if (s.id === 'gate_teacher_calmdown') return { ...s, text: "Ahem...! Oh my, excuse me. As an educator, I almost gave a full lecture at the front gate." };
        if (s.id === 'gate_teacher_invite') return { ...s, text: "Shion. Let's discuss this thoroughly after school in the science prep room. I'll show you my treasured fossil replicas." };
        if (s.id === 'gate_shion_excited') return { ...s, text: "...! After school... I'm definitely going...! Sensei, you're the best..." };
        if (s.id === 'gate_teacher_condition') return { ...s, text: "Fufu. However, if you fail today's quiz, you're banned from the prep room, understand?" };
        if (s.id === 'gate_shion_promise') return { ...s, text: "...I will try my best...! I'm getting a perfect score on today's test...!" };
        if (s.id === 'ending_scene') return { ...s, text: "--- And so, the normally unmotivated Shion found an unexpected fossil-nerd ally and reignited her passion. [Scenario End]" };
        return s;
      }),
    },
  ],
};

export function getTeacherGateScenario(lang: Language = getLanguage()): ScenarioPackage {
  return lang === 'en' ? TEACHER_GATE_SCENARIO_EN : TEACHER_GATE_SCENARIO_JA;
}
