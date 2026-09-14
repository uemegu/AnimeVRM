import { ScenarioPackage } from './types';
import { resolveAssetUrl } from '../utils/path';

/**
 * PV「5秒の告白」シナリオパッケージ
 * 
 * BGM: /bgm/thema_music.mp3 (全長 65.4秒)
 * - 0:00 - 0:06.3 : Cut 1 [屋上青空・制服3人] 問いかけ (音声 6.28s)
 * - 0:06.3 - 0:12.3 : Cut 2 [教室・制服アオイ] 秘めた想い (音声 5.04s + 0.96s)
 * - 0:12.3 - 0:18.5 : Cut 3 [カフェ・私服白ワンピエミリ] ツンデレな問いかけ (音声 6.08s + 0.12s)
 * - 0:18.5 - 0:25.3 : Cut 4 [廊下・制服シオン] クールな振り返り (音声 6.56s + 0.24s)
 * - 0:25.3 - 0:32.0 : Cut 5 [屋上・私服サマーニットアオイ] 風と高まる鼓動 (音声 4.00s + 2.70s)
 *                     ★ 32.0秒 ジャストでサビ突入！
 * - 0:32.0 - 0:40.0 : Cut 6 [街角・白ワンピエミリ] 【★サビ開始！】手繋ぎのお誘い (音声 5.40s + 2.60s)
 * - 0:40.0 - 0:48.0 : Cut 7 [夕暮れ展望台・私服黒ノースリーブシオン] 本音の告白 (音声 6.48s + 1.52s)
 * - 0:48.0 - 0:56.0 : Cut 8 [夜祭り・花火・私服3人] カウントダウン (音声 5.48s + 2.52s)
 *                     ★ 56.0秒 ジャストで「恋してるの〜」歌声開始！
 * - 0:56.0 - 1:00.0 : Cut 9A [夕暮れ展望台・私服3人] 【★56秒〜「恋してるの〜」歌声パート (4.0s)】
 *                     ★ 1:00.0 ジャストで「大好きだよ！」＆ Kawaiiタイトルロゴ！
 * - 1:00.0 - 1:05.4 : Cut 9B [夕暮れ展望台・私服3人] 【★1:00〜「大好きだよ！」＆ Kawaiiタイトルロゴ (5.4s)】
 */
export const FIVE_SECONDS_CONFESSION_PV_SCENARIO: ScenarioPackage = {
  id: 'five_seconds_confession_pv',
  title: '【PV】5秒の告白 〜5 Seconds Confession〜',
  bgmUrl: resolveAssetUrl('/bgm/thema_music.mp3'),
  bgmVolume: 0.45,
  bgmLoop: false,
  hideMessageWindow: true,
  characters: [
    // 制服グループ (Cut 1, Cut 2, Cut 4)
    {
      id: 'girl_01_school', // アオイ制服
      character: resolveAssetUrl('/models/aoi/aoi-school.vrm'),
      position: [-0.42, -0.05, -1.2],
      rotationY: 0.2,
    },
    {
      id: 'girl_02_school', // エミリ制服
      character: resolveAssetUrl('/models/emili/emili.vrm'),
      position: [0.0, -0.05, -1.1],
      rotationY: 0.0,
    },
    {
      id: 'girl_04_school', // シオン制服
      character: resolveAssetUrl('/models/shion/shion-school.vrm'),
      position: [0.42, -0.05, -1.2],
      rotationY: -0.2,
    },
    // 私服グループ (Cut 3, Cut 5, Cut 6, Cut 7, Cut 8, Cut 9)
    {
      id: 'girl_01_private', // アオイ私服（サマーニット）
      character: resolveAssetUrl('/models/aoi/aoi-private.vrm'),
      position: [-0.34, -0.05, -1.15],
      rotationY: 0.15,
    },
    {
      id: 'girl_02_private', // エミリ私服（白ワンピース）
      character: resolveAssetUrl('/models/emili/emili-private.vrm'),
      position: [0.34, -0.05, -1.15],
      rotationY: -0.15,
    },
    {
      id: 'girl_04_private', // シオン私服（黒ノースリーブ）
      character: resolveAssetUrl('/models/shion/shion-private.vrm'),
      position: [0.0, -0.05, -1.2],
      rotationY: 0.0,
    },
  ],
  chapters: [
    {
      id: 'pv_main',
      title: '5秒の告白 PV',
      scenes: [
        // ============================================================
        // Cut 1 (0:00 - 0:06.0): 屋上・青空 (朝〜昼の学校) 3人制服集合
        // ============================================================
        {
          id: 'pv_cut1',
          speaker: 'ナレーション',
          lipSyncCharacterId: null, // ナレーションのため、誰のリップシンクとも同期しない
          dialogueTarget: 'player',
          location: '屋上・青空の下',
          screenTransition: 'none',
          scenePreset: 'day_school',
          background: resolveAssetUrl('/textures/school-rooftop-far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut1_aoi.wav'),
          text: '「ねえ、もし……あと5秒しかなかったら、何て伝える？」',
          cameraPosition: [0, 1.25, 0.95],
          cameraTarget: [0, 1.25, -1.15],
          cameraZoom: 'wide',
          cameraTransitionDuration: 0.8,
          cameraPreset: 'pushIn',
          cameraStrength: 0.7,
          autoNextSec: 0.12,
          avatars: {
            girl_01_school: {
              visible: true,
              position: [-0.42, -0.05, -1.2],
              rotationY: 0.2,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02_school: {
              visible: true,
              position: [0.0, -0.05, -1.1],
              rotationY: 0.0,
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_04_school: {
              visible: true,
              position: [0.42, -0.05, -1.2],
              rotationY: -0.2,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_01_private: { visible: false },
            girl_02_private: { visible: false },
            girl_04_private: { visible: false },
          },
        },

        // ============================================================
        // Cut 2 (0:06.0 - 0:11.5): 教室・昼 制服アオイ (頬杖・座り姿勢)
        // ============================================================
        {
          id: 'pv_cut2',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01_school',
          dialogueTarget: 'player',
          location: '放課後の教室',
          screenTransition: 'none',
          scenePreset: 'day_school',
          background: resolveAssetUrl('/textures/school_classroom_far.avif'),
          backgroundZoom: 1.0,
          voiceUrl: resolveAssetUrl('/voices/pv_cut2_aoi.wav'),
          text: '「放課後の教室で、君のことばかり目で追ってたの……」',
          cameraPosition: [-0.19, 1.21, -0.02],
          cameraTarget: [-0.38, 1.18, -1.2],
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'hold',
          autoNextSec: 0.50,
          avatars: {
            girl_01_school: {
              visible: true,
              position: [-0.38, -0.05, -1.2],
              rotationY: 0.15,
              motion: resolveAssetUrl('/animations/chin_rest.fbx'),
              motionLoop: true,
              expression: 'normal',
              expressionWeight: 1.0,
              faceTexture: resolveAssetUrl('/textures/girl_face_blush.png'),
              lookAtTarget: 'player',
            },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: { visible: false },
            girl_02_private: { visible: false },
            girl_04_private: { visible: false },
          },
        },

        // ============================================================
        // Cut 3 (0:11.5 - 0:17.8): カフェ店内・昼 白ワンピエミリ
        // ============================================================
        {
          id: 'pv_cut3',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02_private',
          dialogueTarget: 'player',
          location: 'お気に入りのカフェ',
          screenTransition: 'none',
          scenePreset: 'bright_indoor',
          background: resolveAssetUrl('/textures/cafe_far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut3_emili.wav'),
          text: '「私のこと、ただの友達としか思ってないんでしょ？ ……ばーか」',
          cameraPosition: [0.34, 1.25, 0.05],
          cameraTarget: [0.34, 1.25, -1.15],
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'punchIn',
          cameraStrength: 0.6,
          autoNextSec: 0.30,
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: { visible: false },
            girl_02_private: {
              visible: true,
              position: [0.34, -0.05, -1.15],
              rotationY: -0.05,
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_04_private: { visible: false },
          },
        },

        // ============================================================
        // Cut 4 (0:17.8 - 0:25.8): 学校の廊下・昼 制服シオン (体を捻って振り返る)
        // ============================================================
        {
          id: 'pv_cut4',
          speaker: 'シオン',
          speakerCharacterId: 'girl_04_school',
          dialogueTarget: 'player',
          location: '学校の廊下',
          screenTransition: 'none',
          scenePreset: 'day_school',
          background: resolveAssetUrl('/textures/school-corridor-far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut4_shion.wav'),
          text: '「……別に。あんたのことなんて、気にしてないし。……嘘だけど。」',
          cameraPosition: [0.20, 1.25, -0.02],
          cameraTarget: [0.42, 1.25, -1.2],
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'orbitRightHalf',
          cameraStrength: 0.5,
          autoNextSec: 0.04,
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: {
              visible: true,
              position: [0.42, -0.05, -1.2],
              rotationY: -1.57, // Y軸-90度回転で体をカメラ方向へ捻る
              motion: resolveAssetUrl('/animations/torso_twist_left.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              faceTexture: resolveAssetUrl('/textures/girl_face_blush.png'),
              headLookAtCamera: true, // 首と頭をカメラへ向けて自然な振り返り
              lookAtCamera: true,
              lookAtTarget: 'player',
            },
            girl_01_private: { visible: false },
            girl_02_private: { visible: false },
            girl_04_private: { visible: false },
          },
        },

        // ============================================================
        // Cut 5 (0:25.8 - 0:32.0): 海の見える公園 私服アオイ (サビ前高まり)
        // ============================================================
        {
          id: 'pv_cut5',
          speaker: 'アオイ',
          speakerCharacterId: 'girl_01_private',
          dialogueTarget: 'player',
          location: '海の見える公園',
          screenTransition: 'none',
          scenePreset: 'day_outdoor',
          background: resolveAssetUrl('/textures/park-with-sea-far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut5_aoi.wav'),
          text: '「風が吹くたび、胸がぎゅってなるの……！」',
          cameraPosition: [-0.05, 1.26, 0.01],
          cameraTarget: [-0.34, 1.26, -1.15],
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'gyuin',
          cameraTransitionDuration: 0.55,
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.7,
          autoNextSec: 1.16, // サビ入りを1.0秒早めて音ハメ
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: {
              visible: true,
              position: [-0.34, -0.05, -1.15],
              rotationY: 0.15,
              motion: resolveAssetUrl('/animations/clasp_hands_front.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02_private: { visible: false },
            girl_04_private: { visible: false },
          },
        },

        // ============================================================
        // Cut 6 (0:32.0 - 0:39.5): 街角・昼 白ワンピエミリ 【★32秒サビ突入！】
        // ============================================================
        {
          id: 'pv_cut6',
          speaker: 'エミリ',
          speakerCharacterId: 'girl_02_private',
          dialogueTarget: 'player',
          location: 'きらめく街角',
          screenTransition: 'none',
          scenePreset: 'day_outdoor',
          background: resolveAssetUrl('/textures/town_far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut6_emili.wav'),
          text: '「ねえ、もっとこっち来て！ 手、繋いでもいいよ？」',
          cameraPosition: [0.34, 1.22, -0.38],
          cameraTarget: [0.34, 1.25, -1.15],
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'cut',
          cameraTransitionDuration: 0.1,
          cameraPreset: 'spiralRise',
          cameraStrength: 0.8,
          dreamBackground: 'heart',
          autoNextSec: 2.82,
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: { visible: false },
            girl_02_private: {
              visible: true,
              position: [0.34, -0.05, -1.15],
              rotationY: -0.1,
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_04_private: { visible: false },
          },
        },

        // ============================================================
        // Cut 7 (0:39.5 - 0:48.5): 夕暮れ展望台 私服シオン
        // ============================================================
        {
          id: 'pv_cut7',
          speaker: 'シオン',
          speakerCharacterId: 'girl_04_private',
          dialogueTarget: 'player',
          location: '夕暮れの丘・茜色の空',
          screenTransition: 'none',
          scenePreset: 'evening_outdoor',
          background: resolveAssetUrl('/textures/town_far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut7_shion.wav'),
          text: '「夕焼けが綺麗だから……じゃない。あんたが隣にいるからだよ。」',
          cameraPosition: [0.0, 1.25, 0.0],
          cameraTarget: [0.0, 1.25, -1.2],
          cameraZoom: 'speaker_close',
          cameraTransitionEasing: 'smooth',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'pushIn',
          cameraStrength: 0.5,
          autoNextSec: 0.40,
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: { visible: false },
            girl_02_private: { visible: false },
            girl_04_private: {
              visible: true,
              position: [0.0, -0.05, -1.2],
              rotationY: -0.1,
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              faceTexture: resolveAssetUrl('/textures/girl_face_blush.png'),
              lookAtTarget: 'player',
            },
          },
        },

        // ============================================================
        // Cut 8 (0:48.5 - 0:56.0): 夜祭り・花火 私服3人 (浴衣ではなく私服)
        // ============================================================
        {
          id: 'pv_cut8',
          speaker: 'ナレーション',
          lipSyncCharacterId: null, // ナレーションのためリップシンク無効
          dialogueTarget: 'player',
          location: '夜の夏祭り・花火の空',
          screenTransition: 'none',
          scenePreset: 'night_festival',
          background: resolveAssetUrl('/textures/night-festival-far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut8_all.wav'),
          text: '「あと少しだけ、私たちの気持ち……受け止めて！」',
          cameraPosition: [0, 1.22, 1.0],
          cameraTarget: [0, 1.22, -1.15],
          cameraZoom: 'wide',
          cameraTransitionDuration: 0.7,
          cameraPreset: 'punchIn',
          cameraStrength: 0.8,
          autoNextSec: 2.94, // 56.0秒「恋してるの〜」歌声開始にジャストフィット
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: {
              visible: true,
              position: [-0.34, -0.05, -1.15],
              rotationY: 0.18,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02_private: {
              visible: true,
              position: [0.34, -0.05, -1.15],
              rotationY: -0.18,
              motion: resolveAssetUrl('/animations/Excited.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_04_private: {
              visible: true,
              position: [0.0, -0.05, -1.2],
              rotationY: 0.0,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
          },
        },

        // ============================================================
        // Cut 9A (0:56.0 - 1:00.0, 4.0秒): 夕暮れ展望台 【★56秒〜「恋してるの〜」歌声パート】
        // ============================================================
        {
          id: 'pv_cut9_intro',
          speaker: 'アオイ・エミリ・シオン',
          dialogueTarget: 'player',
          location: '夕暮れの展望台',
          screenTransition: 'none',
          scenePreset: 'evening_outdoor',
          background: resolveAssetUrl('/textures/town_far.avif'),
          text: '（♪ 〜 恋してるの 〜）',
          cameraPosition: [0, 1.25, 0.75],
          cameraTarget: [0, 1.25, -1.15],
          cameraZoom: 'wide',
          cameraTransitionDuration: 0.6,
          cameraPreset: 'orbitLeftHalf',
          cameraStrength: 0.4,
          autoNextSec: 4.0, // 1:00.0ちょうどまで待機
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: {
              visible: true,
              position: [-0.34, -0.05, -1.15],
              rotationY: 0.15,
              motion: resolveAssetUrl('/animations/clasp_hands_front.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              faceTexture: resolveAssetUrl('/textures/girl_face_blush.png'),
              lookAtTarget: 'player',
            },
            girl_02_private: {
              visible: true,
              position: [0.34, -0.05, -1.15],
              rotationY: -0.15,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_04_private: {
              visible: true,
              position: [0.0, -0.05, -1.2],
              rotationY: 0.0,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              faceTexture: resolveAssetUrl('/textures/girl_face_blush.png'),
              lookAtTarget: 'player',
            },
          },
        },

        // ============================================================
        // Cut 9B (1:00.0 - 1:05.4, 5.4秒): 【★1:00〜「大好きだよ！」＆ Kawaiiタイトルロゴ】
        // ============================================================
        {
          id: 'pv_cut9_climax',
          speaker: '3人',
          dialogueTarget: 'player',
          location: '夕暮れの展望台',
          screenTransition: 'none',
          scenePreset: 'evening_outdoor',
          background: resolveAssetUrl('/textures/town_far.avif'),
          voiceUrl: resolveAssetUrl('/voices/pv_cut9_daisuki.wav'),
          text: '「「「大好きだよっ！」」」 ―― 奇跡の5秒間が、今始まる。',
          cameraPosition: [0, 1.25, 0.65],
          cameraTarget: [0, 1.25, -1.15],
          cameraZoom: 'speaker_close',
          cameraTransitionDuration: 0.5,
          cameraPreset: 'pushIn',
          cameraStrength: 0.5,
          autoNextSec: 5.0,
          avatars: {
            girl_01_school: { visible: false },
            girl_02_school: { visible: false },
            girl_04_school: { visible: false },
            girl_01_private: {
              visible: true,
              position: [-0.34, -0.05, -1.15],
              rotationY: 0.15,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_02_private: {
              visible: true,
              position: [0.34, -0.05, -1.15],
              rotationY: -0.15,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
            girl_04_private: {
              visible: true,
              position: [0.0, -0.05, -1.2],
              rotationY: 0.0,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'normal',
              expressionWeight: 1.0,
              lookAtTarget: 'player',
            },
          },
        },
      ],
    },
  ],
};

export function getFiveSecondsConfessionPvScenario(): ScenarioPackage {
  return FIVE_SECONDS_CONFESSION_PV_SCENARIO;
}
