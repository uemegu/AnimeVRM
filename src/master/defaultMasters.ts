import { MasterDatabase } from './types';
import { SCENE_PRESETS } from '../presets/ScenePresets';
import { resolveAssetUrl } from '../utils/path';

export const DEFAULT_CHARACTERS: MasterDatabase['characters'] = {
  girl_01: {
    id: 'girl_01',
    name: '👧 アオイ (aoi-school.vrm)',
    modelUrl: '/models/aoi/aoi-school.vrm',
    faceBlushTexture: '/textures/girl_face_blush.png',
    defaultVoiceGender: 'female',
    description: '標準的な学生服スタイルのVRMキャラクター (アオイ)',
  },
  girl_02: {
    id: 'girl_02',
    name: '👱‍♀️ エミリ (emili.vrm)',
    modelUrl: '/models/emili/emili.vrm',
    faceBlushTexture: '/textures/girl2_face_blush.png',
    defaultVoiceGender: 'female',
    description: 'ブロンドヘアのVRMキャラクター (エミリ)',
  },
  girl_03: {
    id: 'girl_03',
    name: '👩 アオイ [鞄付き] (aoi-school-with-bag.vrm)',
    modelUrl: '/models/aoi/aoi-school-with-bag.vrm',
    defaultVoiceGender: 'female',
    description: '学生鞄を携えたアオイのVRMキャラクター',
  },
  girl_04: {
    id: 'girl_04',
    name: '💤 シオン [制服] (shion-school.vrm)',
    modelUrl: '/models/shion/shion-school.vrm',
    defaultVoiceGender: 'female',
    description: '制服スタイルのダウナー系VRMキャラクター (シオン)',
  },
  girl_05: {
    id: 'girl_05',
    name: '💤 シオン [私服] (shion-private.vrm)',
    modelUrl: '/models/shion/shion-private.vrm',
    defaultVoiceGender: 'female',
    description: '私服スタイルのVRMキャラクター (シオン)',
  },
  teacher: {
    id: 'teacher',
    name: '👩‍🏫 桐島 先生 (teacher.vrm)',
    modelUrl: '/models/teacher/teacher.vrm',
    defaultVoiceGender: 'female',
    description: '凛とした佇まいの20代後半の女性教師 (桐島 先生)',
  },
};

export const DEFAULT_MOTIONS: MasterDatabase['motions'] = {
  idle: {
    id: 'idle',
    name: '待機',
    file: '/animations/Idle.fbx',
    isLoop: true,
    fadeInSec: 0.5,
    category: 'idle',
  },
  standing_idle: {
    id: 'standing_idle',
    name: '立ち待機',
    file: '/animations/Standing Idle.fbx',
    isLoop: true,
    fadeInSec: 0.5,
    category: 'idle',
  },
  standing_pose: {
    id: 'standing_pose',
    name: '立ちポーズ',
    file: '/animations/Female Standing Pose.fbx',
    isLoop: true,
    fadeInSec: 0.5,
    category: 'idle',
  },
  walking: {
    id: 'walking',
    name: '歩行',
    file: '/animations/Walking.fbx',
    isLoop: true,
    fadeInSec: 0.5,
    category: 'action',
  },
  jogging: {
    id: 'jogging',
    name: 'ジョギング',
    file: '/animations/Jogging.fbx',
    isLoop: true,
    fadeInSec: 0.5,
    category: 'action',
  },
  greeting: {
    id: 'greeting',
    name: '挨拶',
    file: '/animations/Standing Greeting.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'greeting',
  },
  bow: {
    id: 'bow',
    name: 'お辞儀',
    file: '/animations/Quick Formal Bow.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'greeting',
  },
  acknowledging: {
    id: 'acknowledging',
    name: 'うなずく',
    file: '/animations/Acknowledging.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'greeting',
  },
  dismissing: {
    id: 'dismissing',
    name: '手を振る',
    file: '/animations/Dismissing Gesture.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'greeting',
  },
  salute: {
    id: 'salute',
    name: '敬礼',
    file: '/animations/Salute.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'action',
  },
  excited: {
    id: 'excited',
    name: '喜ぶ',
    file: '/animations/Excited.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'emotion',
  },
  angry: {
    id: 'angry',
    name: '怒り',
    file: '/animations/Angry.fbx',
    isLoop: false,
    fadeInSec: 0.5,
    category: 'emotion',
  },
  punching: {
    id: 'punching',
    name: 'パンチ',
    file: '/animations/Punching.fbx',
    isLoop: false,
    fadeInSec: 0.4,
    category: 'action',
  },
};

export const DEFAULT_SOUNDS: MasterDatabase['sounds'] = {
  // BGM
  bgm_main: {
    id: 'bgm_main',
    name: '日常・公園BGM',
    type: 'bgm',
    file: '/bgm/bgm.mp3',
    volume: 0.35,
  },
  // SE
  se_cicada: {
    id: 'se_cicada',
    name: 'ヒグラシの鳴き声',
    type: 'se',
    file: '/se/large_brown_cicada.mp3',
    volume: 0.15,
  },
  // Voices (告白イベント用)
  confess_intro_1: {
    id: 'confess_intro_1',
    name: '告白導入1: 来てくれたんだ',
    type: 'voice',
    file: '/voices/confess_intro_1.wav',
  },
  confess_intro_2: {
    id: 'confess_intro_2',
    name: '告白導入2: 伝えたいことがあって',
    type: 'voice',
    file: '/voices/confess_intro_2.wav',
  },
  confess_intro_3: {
    id: 'confess_intro_3',
    name: '告白導入3: どう思ってる？',
    type: 'voice',
    file: '/voices/confess_intro_3.wav',
  },
  confess_love_1: {
    id: 'confess_love_1',
    name: '告白成功1: やったーっ！',
    type: 'voice',
    file: '/voices/confess_love_1.wav',
  },
  confess_love_2: {
    id: 'confess_love_2',
    name: '告白成功2: すっごく嬉しい',
    type: 'voice',
    file: '/voices/confess_love_2.wav',
  },
  confess_love_3: {
    id: 'confess_love_3',
    name: '告白成功3: これからもずっと隣にいてね',
    type: 'voice',
    file: '/voices/confess_love_3.wav',
  },
  confess_money_1: {
    id: 'confess_money_1',
    name: '告白失敗1: え……？500円？',
    type: 'voice',
    file: '/voices/confess_money_1.wav',
  },
  confess_money_2: {
    id: 'confess_money_2',
    name: '告白失敗2: ドキドキを返してよー！',
    type: 'voice',
    file: '/voices/confess_money_2.wav',
  },
  confess_money_3: {
    id: 'confess_money_3',
    name: '告白失敗3: ほら500円！バカーッ！',
    type: 'voice',
    file: '/voices/confess_money_3.wav',
  },
  confess_silent_2: {
    id: 'confess_silent_2',
    name: '告白沈黙2: なんで何も言わないの',
    type: 'voice',
    file: '/voices/confess_silent_2.wav',
  },
  confess_silent_3: {
    id: 'confess_silent_3',
    name: '告白沈黙3: もう一回やり直してあげる',
    type: 'voice',
    file: '/voices/confess_silent_3.wav',
  },
  // シーケンス用ボイス
  scenario_01: {
    id: 'scenario_01',
    name: 'シーケンス1: ストーカー？',
    type: 'voice',
    file: '/voices/scenario_01.wav',
  },
  scenario_02: {
    id: 'scenario_02',
    name: 'シーケンス2: 冗談だよ',
    type: 'voice',
    file: '/voices/scenario_02.wav',
  },
  scenario_03: {
    id: 'scenario_03',
    name: 'シーケンス3: 何してるの？',
    type: 'voice',
    file: '/voices/scenario_03.wav',
  },
  girl4_ref: {
    id: 'girl4_ref',
    name: 'ダウナー少女 (girl4): 眠いし',
    type: 'voice',
    file: '/voices/girl4_ref.wav',
  },
};

export const DEFAULT_MASTER_DATABASE: MasterDatabase = {
  characters: DEFAULT_CHARACTERS,
  motions: DEFAULT_MOTIONS,
  sounds: DEFAULT_SOUNDS,
  scenes: SCENE_PRESETS,
};
