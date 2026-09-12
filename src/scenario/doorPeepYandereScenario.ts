import { ScenarioPackage } from './types';
import { Language, getLanguage } from '../i18n';
import { resolveAssetUrl } from '../utils/path';

export const DOOR_PEEP_YANDERE_SCENARIO_JA: ScenarioPackage = {
  id: 'door_peep_yandere',
  title: '🚪 覗き穴の訪問者〜深夜のヤンデレ〜',
  characters: [
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: [0, -100, 0], // 初期状態は自室の外（非表示）
      rotationY: 0,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/Waiting_Beneath_the_Boards.mp3'),
  bgmVolume: 0.2,
  chapters: [
    {
      id: 'main',
      title: 'ドアスコープの向こう側',
      scenes: [
        // Scene 0: 自室・深夜2時の静寂
        {
          id: 'scene_0_midnight',
          speaker: 'あなた',
          location: '自室 (深夜2:00)',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/myroom_far.avif'),
          cameraZoom: 'wide',
          cameraPosition: [0, 1.25, 2.8],
          cameraTarget: [0, 1.25, 0],
          text: '深夜2時。部屋の明かりを落とし、ベッドに入ろうとしていたその時だった。',
          fisheye: false,
          avatars: {
            girl_01: {
              visible: false,
              position: [0, 0, 0],
            },
          },
          autoNextSec: 3.5,
        },
        // Scene 1: 自室に響き渡るインターホン
        {
          id: 'scene_1_chime',
          speaker: 'あなた',
          location: '自室 (深夜2:00)',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/myroom_far.avif'),
          cameraZoom: 'wide',
          cameraPosition: [0, 1.25, 2.8],
          cameraTarget: [0, 1.25, 0],
          seUrl: resolveAssetUrl('/se/door_chime.mp3'),
          seVolume: 0.85,
          seLoop: false,
          text: '（ピンポーン……ピンポーン……）\n不意に、静まり返った部屋にインターホンの呼び鈴が響き渡った。\nこんな真夜中に、一体誰だ……？',
          fisheye: false,
          avatars: {
            girl_01: {
              visible: false,
              position: [0, 0, 0],
            },
          },
          autoNextSec: 4.0,
        },
        // Scene 2: 玄関へ移動し、覗き穴へ目を近づける
        {
          id: 'scene_2_approach_door',
          speaker: 'あなた',
          location: '玄関前',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/myroom_far.avif'),
          cameraZoom: 'wide',
          cameraPosition: [0, 1.25, 2.8],
          cameraTarget: [0, 1.25, 0],
          text: '足音を忍ばせて玄関へと向かう。モニター画面のボタンを押すが、真っ暗で何も映らない。\n……仕方なく、ドアの丸い覗き穴（ドアスコープ）にそっと目を当てた。',
          fisheye: false,
          avatars: {
            girl_01: {
              visible: false,
              position: [0, 0, 0],
            },
          },
        },
        // Scene 3: ドアスコープ越しに覗く（円周魚眼マスク発動！）
        {
          id: 'scene_3_peep_start',
          speaker: 'あなた',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/apartment_door_far.avif'),
          seUrl: resolveAssetUrl('/se/piano_note.mp3'),
          seVolume: 0.85,
          seLoop: false,
          text: '丸く歪んだ魚眼レンズの向こう側……外廊下の薄暗い照明の下に、制服姿の彼女がうつむいて立ち尽くしている。',
          fisheye: {
            enabled: true,
            strength: 0.75,
            zoom: 0.95,
            circular: true,
          },
          cameraTarget: [0, 1.30, 0],
          cameraDistance: 1.0,
          avatars: {
            girl_01: {
              visible: true,
              position: [0, 0, -1.6],
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
              headOffset: [0, -0.25], // うつむく
              lookAtCamera: false,
              headLookAtCamera: false,
            },
          },
        },
        // Scene 4: ゆっくりと顔を持ち上げる（ヤンデレ瞳ハイライト消去！ビクッ漫符は除去）
        {
          id: 'scene_4_head_up',
          speaker: 'あなた',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          text: '不意に、彼女がギチ……ギチ……と首を傾げながら、ゆっくりと顔を上げた。',
          fisheye: {
            enabled: true,
            strength: 0.85,
            zoom: 0.95,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -1.6],
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.16,
              },
              lookAtCamera: true,
              headLookAtCamera: true,
            },
          },
        },
        // Scene 5: ドアスコープ越しに視線が合致（漫符は除去し不気味さを純化）
        {
          id: 'scene_5_eye_contact',
          speaker: 'あなた',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          text: 'ヒッ……！？\nまるでこちらが覗いていることが分かっているかのように、光の消えた真っ黒な瞳が正確にレンズを射抜いてくる。',
          fisheye: {
            enabled: true,
            strength: 0.9,
            zoom: 0.95,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -1.6],
              expression: 'neutral',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.2,
              },
              lookAtCamera: true,
            },
          },
        },
        // Scene 6: 彼女のささやき声
        {
          id: 'scene_6_voice_whisper',
          speaker: '少女',
          speakerCharacterId: 'girl_01',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_whisper.wav'),
          text: '「……ねえ。中にいるんでしょ……？ 息の音、ちゃんと聞こえてるよ……？」',
          fisheye: {
            enabled: true,
            strength: 0.95,
            zoom: 0.95,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -1.6],
              expression: 'happy',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.22,
              },
              lookAtCamera: true,
            },
          },
        },
        // Scene 7: 1秒だけ歩いて近づいてくる演出（motionDuration: 1.0）
        {
          id: 'scene_7_step_closer',
          speaker: '少女',
          speakerCharacterId: 'girl_01',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_closer.wav'),
          text: '「メッセージ……なんで既読スルーするの？ 電話も拒否したよね……？ だからね、直接会いに来ちゃった♡」',
          fisheye: {
            enabled: true,
            strength: 1.05,
            zoom: 1.0,
            circular: true,
          },
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              motionDuration: 1.0, // 1秒だけ歩いて立ち止まる！
              nextMotion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              moveTo: {
                target: [0, 0, -0.65],
                duration: 1.0,
              },
              expression: 'happy',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.18,
              },
              lookAtCamera: true,
            },
          },
        },
        // Scene 8: 覗き穴への極限超接写（線伸びが解消されたクリアな円周魚眼！）
        {
          id: 'scene_8_panic_face',
          speaker: '少女',
          speakerCharacterId: 'girl_01',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_scream.wav'),
          seUrl: resolveAssetUrl('/se/door_knock.mp3'),
          seVolume: 0.9,
          seLoop: false,
          text: '「ねえ、開けてよ……！ 開けて開けて開けて開けて開けて開けて開けてッ！！」',
          fisheye: {
            enabled: true,
            strength: 1.25,
            zoom: 1.0,
            circular: true,
          },
          cameraTarget: [0, 1.30, 0],
          cameraDistance: 0.55,
          avatars: {
            girl_01: {
              position: [0, 0, -0.28], // ドアのガラス直前
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'angry',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.25,
              },
              lookAtCamera: true,
              effectText: 'wanawana', // ドアを叩き狂乱する少女の感情としてぴったり
            },
          },
        },
        // Scene 9: ドア越し迫真の選択
        {
          id: 'scene_9_choice',
          speaker: 'あなた',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          seUrl: resolveAssetUrl('/se/door_knock.mp3'),
          seVolume: 0.75,
          seLoop: false,
          text: 'ガラス越しに鼻先が触れるほどの距離で、彼女がドアをガンガンと叩きながら狂ったように叫んでいる……！ どうする……！？',
          fisheye: {
            enabled: true,
            strength: 1.25,
            zoom: 1.0,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -0.28],
              expression: 'angry',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.25,
              },
              lookAtCamera: true,
            },
          },
          choices: [
            {
              text: '🔑 ドアの鍵を開ける',
              goto: 'scene_open_door',
              effectText: 'doki',
            },
            {
              text: '🤫 息を殺して居留守を決め込む',
              goto: 'scene_stay_silent',
              effectText: 'biku',
            },
          ],
        },
        // Scene 10-A: 鍵を開けた結末
        {
          id: 'scene_open_door',
          speaker: '少女',
          speakerCharacterId: 'girl_01',
          location: '玄関口',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/apartment_door_far.avif'),
          voiceUrl: resolveAssetUrl('/voices/doorpeep_opendoor.wav'),
          text: 'ガチャリ……と鍵を開けると、ドアが勢いよく開け放たれた。\n「……ふふっ、やっと開けてくれた♡ もう絶対に離さないから……ずーっと、一生一緒だよ？」',
          fisheye: false, // ドアが開いたので通常の視界へ
          cameraZoom: 'speaker_close',
          avatars: {
            girl_01: {
              position: [0, 0, -0.7],
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              yandere: {
                hideHighlights: true,
                tiltHead: true,
                tiltAngle: -0.15,
              },
              lookAtCamera: true,
              effectText: 'kirakira',
            },
          },
        },
        // Scene 10-B: 居留守を使った結末
        {
          id: 'scene_stay_silent',
          speaker: '少女',
          speakerCharacterId: 'girl_01',
          location: 'ドアスコープ越し (アパート前)',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_silent.wav'),
          seUrl: resolveAssetUrl('/se/door_rattle.mp3'),
          seVolume: 0.95,
          seLoop: false,
          text: 'ガチャガチャガチャガチャッ！！ ドアノブが狂乱の勢いで激しく回される！\n「嘘つき……そこに立ってるの、見えてるんだからね……絶対に逃がさないんだからッ……！！」',
          fisheye: {
            enabled: true,
            strength: 1.35,
            zoom: 1.0,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -0.26],
              expression: 'angry',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.28,
              },
              lookAtCamera: true,
              effectText: 'wanawana',
            },
          },
        },
      ],
    },
  ],
};

export const DOOR_PEEP_YANDERE_SCENARIO_EN: ScenarioPackage = {
  id: 'door_peep_yandere',
  title: '🚪 The Peep-hole Visitor: Midnight Yandere',
  characters: [
    {
      id: 'girl_01',
      character: resolveAssetUrl('/models/girl.vrm'),
      position: [0, -100, 0],
      rotationY: 0,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/Waiting_Beneath_the_Boards.mp3'),
  bgmVolume: 0.2,
  chapters: [
    {
      id: 'main',
      title: 'Through the Peep-hole',
      scenes: [
        // Scene 0: Midnight silence in bedroom
        {
          id: 'scene_0_midnight',
          speaker: 'You',
          location: 'My Room (2:00 AM)',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/myroom_far.avif'),
          cameraZoom: 'wide',
          cameraPosition: [0, 1.25, 2.8],
          cameraTarget: [0, 1.25, 0],
          text: '2:00 AM. Just as I turned off the lights in my room and was about to climb into bed...',
          fisheye: false,
          avatars: {
            girl_01: {
              visible: false,
              position: [0, 0, 0],
            },
          },
          autoNextSec: 3.5,
        },
        // Scene 1: Chime echoes in the dark room
        {
          id: 'scene_1_chime',
          speaker: 'You',
          location: 'My Room (2:00 AM)',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/myroom_far.avif'),
          cameraZoom: 'wide',
          cameraPosition: [0, 1.25, 2.8],
          cameraTarget: [0, 1.25, 0],
          seUrl: resolveAssetUrl('/se/door_chime.mp3'),
          seVolume: 0.85,
          seLoop: false,
          text: '(Ding-dong... Ding-dong...)\nSuddenly, the doorbell chimed through the dead silence of the apartment.\nWho on earth could it be at this ungodly hour...?',
          fisheye: false,
          avatars: {
            girl_01: {
              visible: false,
              position: [0, 0, 0],
            },
          },
          autoNextSec: 4.0,
        },
        // Scene 2: Heading to the door
        {
          id: 'scene_2_approach_door',
          speaker: 'You',
          location: 'Front Door',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/myroom_far.avif'),
          cameraZoom: 'wide',
          cameraPosition: [0, 1.25, 2.8],
          cameraTarget: [0, 1.25, 0],
          text: 'Stealthily, I made my way to the entrance. I pressed the intercom screen button, but the display remained completely pitch black.\n...With no other choice, I carefully pressed my eye against the peephole.',
          fisheye: false,
          avatars: {
            girl_01: {
              visible: false,
              position: [0, 0, 0],
            },
          },
        },
        // Scene 3: Looking through the peephole (Circular fisheye active!)
        {
          id: 'scene_3_peep_start',
          speaker: 'You',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/apartment_door_far.avif'),
          seUrl: resolveAssetUrl('/se/piano_note.mp3'),
          seVolume: 0.85,
          seLoop: false,
          text: 'Beyond the curved, distorted circle of the fisheye lens... Under the dim corridor lighting, a girl in school uniform stood motionless, looking down.',
          fisheye: {
            enabled: true,
            strength: 0.75,
            zoom: 0.95,
            circular: true,
          },
          cameraTarget: [0, 1.30, 0],
          cameraDistance: 1.0,
          avatars: {
            girl_01: {
              visible: true,
              position: [0, 0, -1.6],
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'sad',
              headOffset: [0, -0.25],
              lookAtCamera: false,
              headLookAtCamera: false,
            },
          },
        },
        // Scene 4: Raising her head with yandere eyes
        {
          id: 'scene_4_head_up',
          speaker: 'You',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          text: 'Slowly, stiffly tilting her neck with an eerie stillness, she raised her head.',
          fisheye: {
            enabled: true,
            strength: 0.85,
            zoom: 0.95,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -1.6],
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'surprised',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.16,
              },
              lookAtCamera: true,
              headLookAtCamera: true,
            },
          },
        },
        // Scene 5: Eye contact
        {
          id: 'scene_5_eye_contact',
          speaker: 'You',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          text: 'Gasp...!?\nAs if she knew with certainty that I was peering out, her lifeless, pitch-black eyes locked right onto the glass lens.',
          fisheye: {
            enabled: true,
            strength: 0.9,
            zoom: 0.95,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -1.6],
              expression: 'neutral',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.2,
              },
              lookAtCamera: true,
            },
          },
        },
        // Scene 6: Whisper
        {
          id: 'scene_6_voice_whisper',
          speaker: 'Girl',
          speakerCharacterId: 'girl_01',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_whisper.wav'),
          text: '"...Hey. You\'re in there, aren\'t you...? I can hear the sound of your breath, you know...?"',
          fisheye: {
            enabled: true,
            strength: 0.95,
            zoom: 0.95,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -1.6],
              expression: 'happy',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.22,
              },
              lookAtCamera: true,
            },
          },
        },
        // Scene 7: Steps closer (1-second walk with motionDuration)
        {
          id: 'scene_7_step_closer',
          speaker: 'Girl',
          speakerCharacterId: 'girl_01',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_closer.wav'),
          text: '"Why did you leave my messages on read? You declined my calls too, didn\'t you...? So I came all the way to see you in person♡"',
          fisheye: {
            enabled: true,
            strength: 1.05,
            zoom: 1.0,
            circular: true,
          },
          avatars: {
            girl_01: {
              motion: resolveAssetUrl('/animations/Walking.fbx'),
              motionDuration: 1.0,
              nextMotion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              moveTo: {
                target: [0, 0, -0.65],
                duration: 1.0,
              },
              expression: 'happy',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.18,
              },
              lookAtCamera: true,
            },
          },
        },
        // Scene 8: Extreme close-up panic face
        {
          id: 'scene_8_panic_face',
          speaker: 'Girl',
          speakerCharacterId: 'girl_01',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_scream.wav'),
          seUrl: resolveAssetUrl('/se/door_knock.mp3'),
          seVolume: 0.9,
          seLoop: false,
          text: '"Hey, open up...! OPEN IT OPEN IT OPEN IT OPEN IT OPEN UP NOW!!"',
          fisheye: {
            enabled: true,
            strength: 1.25,
            zoom: 1.0,
            circular: true,
          },
          cameraTarget: [0, 1.30, 0],
          cameraDistance: 0.55,
          avatars: {
            girl_01: {
              position: [0, 0, -0.28],
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'angry',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.25,
              },
              lookAtCamera: true,
              effectText: 'wanawana',
            },
          },
        },
        // Scene 9: Choice
        {
          id: 'scene_9_choice',
          speaker: 'You',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          seUrl: resolveAssetUrl('/se/door_knock.mp3'),
          seVolume: 0.75,
          seLoop: false,
          text: 'Her face is pressed right against the glass as she violently pounds on the metal door, screaming with insane fury...! What should I do...?!',
          fisheye: {
            enabled: true,
            strength: 1.25,
            zoom: 1.0,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -0.28],
              expression: 'angry',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.25,
              },
              lookAtCamera: true,
            },
          },
          choices: [
            {
              text: '🔑 Unlock and open the door',
              goto: 'scene_open_door',
              effectText: 'doki',
            },
            {
              text: '🤫 Hold your breath and stay silent',
              goto: 'scene_stay_silent',
              effectText: 'biku',
            },
          ],
        },
        // Scene 10-A: Door Opened
        {
          id: 'scene_open_door',
          speaker: 'Girl',
          speakerCharacterId: 'girl_01',
          location: 'Entrance Doorway',
          scenePreset: 'dark_indoor',
          background: resolveAssetUrl('/textures/apartment_door_far.avif'),
          voiceUrl: resolveAssetUrl('/voices/doorpeep_opendoor.wav'),
          text: 'Click... With a heavy turn of the lock, the door was thrown wide open.\n"...Fufu, you finally opened it for me♡ I\'ll never let you go now... Together forever and ever, okay?"',
          fisheye: false,
          cameraZoom: 'speaker_close',
          avatars: {
            girl_01: {
              position: [0, 0, -0.7],
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'happy',
              yandere: {
                hideHighlights: true,
                tiltHead: true,
                tiltAngle: -0.15,
              },
              lookAtCamera: true,
              effectText: 'kirakira',
            },
          },
        },
        // Scene 10-B: Stay Silent
        {
          id: 'scene_stay_silent',
          speaker: 'Girl',
          speakerCharacterId: 'girl_01',
          location: 'Through the Peephole',
          scenePreset: 'dark_indoor',
          voiceUrl: resolveAssetUrl('/voices/doorpeep_silent.wav'),
          seUrl: resolveAssetUrl('/se/door_rattle.mp3'),
          seVolume: 0.95,
          seLoop: false,
          text: 'Rattle-rattle-rattle-CLANK!! The doorknob was rattled with insane violence!\n"Liar... I can see you standing right there... You\'re never getting away from me... NEVER!!" ',
          fisheye: {
            enabled: true,
            strength: 1.35,
            zoom: 1.0,
            circular: true,
          },
          avatars: {
            girl_01: {
              position: [0, 0, -0.26],
              expression: 'angry',
              yandere: {
                hideHighlights: true,
                dimEyeWhite: true,
                tiltHead: true,
                tiltAngle: -0.28,
              },
              lookAtCamera: true,
              effectText: 'wanawana',
            },
          },
        },
      ],
    },
  ],
};

export function getDoorPeepYandereScenario(language: Language): ScenarioPackage {
  return language === 'ja' ? DOOR_PEEP_YANDERE_SCENARIO_JA : DOOR_PEEP_YANDERE_SCENARIO_EN;
}
