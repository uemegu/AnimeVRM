import { EffectPresetName } from '../effects/text/types';
import { CameraPreset, CameraStartAngle } from '../animation/types';
import { ScenePresetId } from '../presets/ScenePresets';
import { TearConfig } from '../effects/tears';
import { FocusLinesConfig } from '../effects/FocusLinesOverlay';
import { AnimeDreamBackgroundConfig } from '../effects/AnimeDreamBackground';
import type { CinematicFisheyeConfig } from '../Config';
import type { YandereOptions } from '../Avatar';

export interface ScenarioChoice {
  text: string;
  flag?: string;
  goto?: string;
  effectText?: EffectPresetName;
}

export type AvatarSlotPosition = 'left' | 'right' | 'center';

export const AVATAR_POSITION_PRESETS: Record<AvatarSlotPosition, [number, number, number]> = {
  left: [-0.65, 0, -0.45],
  right: [0.65, 0, -0.45],
  center: [0, 0, -0.3],
};

export const AVATAR_ROTATION_PRESETS: Record<AvatarSlotPosition, number> = {
  left: 0.22,
  right: -0.22,
  center: 0,
};

export interface ScenarioCharacterPlacement {
  id: string; // Character key in scenario (e.g. 'girl_01', 'girl_02')
  character: string; // Character Master ID (e.g. 'girl_01') or Model URL
  position?: AvatarSlotPosition | [number, number, number];
  rotationY?: number;
}

/** セリフ途中のアバター演出遷移キーフレーム（表情・モーション・視線等） */
export interface AvatarTransition {
  /** 発火タイミング（秒）- ボイス再生位置 or シーン経過時間 */
  at: number;
  // 表情
  expression?: string;
  expressionWeight?: number;
  // モーション
  motion?: string;
  motionLoop?: boolean;
  motionSpeed?: number;
  // 視線・顔向き
  lookAtCamera?: boolean;
  headLookAtCamera?: boolean;
  eyeLookAtCamera?: boolean;
  lookAtTarget?: 'player' | 'speaker' | 'partner' | 'camera' | 'forward' | string;
  eyeWander?: boolean | number;
  eyeOffset?: [number, number];
  headOffset?: [number, number];
  // ビジュアル
  faceTexture?: string;
  tears?: boolean;
  sweat?: boolean | 'fly4' | 'jito';
  effectText?: EffectPresetName | {
    preset: EffectPresetName;
    text?: string;
    duration?: number;
  };
  visible?: boolean;
}

/** セリフ途中のシーン全体遷移キーフレーム（カメラ・背景等） */
export interface SceneTransition {
  /** 発火タイミング（秒）- ボイス再生位置 or シーン経過時間 */
  at: number;
  cameraZoom?: CameraZoomType;
  cameraDistance?: number;
  cameraTransitionDuration?: number;
  cameraTransitionEasing?: CameraTransitionEasing;
  cameraTarget?: AvatarSlotPosition | [number, number, number] | string;
  background?: string;
  focusLines?: boolean | FocusLinesConfig;
}

export interface ScenarioSceneAvatarConfig {
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  motion?: string;    // Motion Master ID (e.g. 'greeting') or FBX URL
  motionLoop?: boolean; // モーションをループ再生するか（未指定時は idle/walking/chin_rest 等から自動判定）
  motionSpeed?: number; // アニメーション再生速度倍率 (デフォルト 1.0, 高速アクション用)
  motionDuration?: number; // モーションを再生する時間（秒）。経過後は nextMotion または待機モーションに自動遷移。transitions がある場合は無視される
  nextMotion?: string;     // motionDuration 経過後に再生するモーション（デフォルト: 'Standing Idle.fbx' または Idle）。transitions がある場合は無視される
  expression?: string;
  expressionWeight?: number;
  faceTexture?: string;
  visible?: boolean;
  position?: AvatarSlotPosition | [number, number, number];
  rotationY?: number;
  effectText?: EffectPresetName | {
    preset: EffectPresetName;
    text?: string;
    duration?: number;
  };
  lookAtCamera?: boolean;
  headLookAtCamera?: boolean; // 顔（首・頭）をカメラへ向ける（FBX歩行中も自然にカメラを振り向く）
  eyeLookAtCamera?: boolean;  // 目をカメラへ向ける（未指定時は lookAtCamera に従う）
  lookAtTarget?: 'player' | 'speaker' | 'partner' | 'camera' | 'forward' | string; // 個別の視線・顔向きターゲット指定
  shallowHeadAngle?: boolean; // 顔の向きを浅い角度にするか（デフォルト true）
  headMaxYaw?: number; // 首の最大水平回転角度（ラジアン）
  headWeight?: number; // 首の回転追従ウェイト
  eyeWander?: boolean | number; // 目が泳ぐ演出（true または強度 0.0 - 2.0）
  eyeOffset?: [number, number]; // 視線オフセット [yaw, pitch] (ラジアン)
  headOffset?: [number, number]; // 顔・首オフセット [yaw, pitch] (ラジアン)
  moveTo?: {
    target: [number, number, number];
    duration: number; // seconds
    rotationY?: number;
  };
  tears?: boolean;
  tearConfig?: Partial<TearConfig>;
  sweat?: boolean | 'fly4' | 'jito';
  motionBlur?: boolean; // 高速動作時の方向性輪郭ブラーのON/OFF
  yandere?: boolean | Partial<YandereOptions>; // 瞳ハイライト消去・暗黒化・首傾げ
  shafudo?: boolean; // エミリ等の「シャフ度」ポーズ
  /** セリフ中の表情・モーション・視線遷移タイムライン（at 昇順で指定） */
  transitions?: AvatarTransition[];
}

export type CameraZoomType =
  | 'speaker'               // 自動で発話者キャラへズーム (バストアップ)
  | 'speaker_close'         // 発話者キャラへクローズアップ (感情・告白・強調)
  | 'speaker_extreme_close' // 発話者キャラへ超至近距離ズーム (耳元ささやき・目線アップ)
  | 'wide'                  // 全体・引きのショット (2人全体・背景を広く写す)
  | 'medium'                // 標準的な会話ショット
  | 'none'                  // カメラ移動なし (現在の構図を維持)
  | 'hold';                 // 前の構図をキープ

export type CameraTransitionEasing =
  | 'gyuin'         // 勢いよく寄ってピタッと止まるアニメ的なダイナミックズーム (easeOutExpo)
  | 'smooth'        // なめらかな補間 (easeInOutCubic)
  | 'cut';          // 即座に切り替えるカット

export type ScreenTransitionType =
  | 'eyelid_close'  // 瞼を閉じるように上下から中央へ暗幕が閉じる
  | 'eyelid_blink'  // 瞬き（パチパチ）
  | 'fade_black'    // フェード黒
  | 'interlude'     // 4分割スライス幕間トランジション (sayin5min風)
  | 'none';

export interface ScenarioScrollingBackgroundConfig {
  enabled: boolean;
  textureUrl?: string; // e.g. '/textures/town_far.avif'
  speed?: number;      // slide speed (0 = stop, 1.2 = normal walking)
  blur?: number;       // 0.0 (sharp) - 1.0 (strong anime blur)
  direction?: 'left' | 'right';
  instantBlur?: boolean;
  featherWidth?: number; // 0.0 - 0.5 (ratio of edge width for seamless alpha blending, default 0.15)
}

export interface ScenarioScene {
  id: string;
  speaker?: string;
  speakerCharacterId?: string; // Character ID speaking in this scene (e.g. 'girl_01')
  lipSyncCharacterId?: string | null; // Optional override for lip-sync character (or null/'none' to disable)
  dialogueTarget?: 'player' | 'partner' | string; // 会話相手（自キャラ 'player'、相手キャラ 'partner'、またはキャラID）。未指定時のデフォルトは 'player'
  cameraTargetCharacterId?: string; // Optional character ID for camera framing/focus (if different from speaker)
  text: string;
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  voice?: string;     // Sound Master ID (e.g. 'confess_intro_1')
  voiceUrl?: string;  // Direct voice audio URL (Backward compatibility)
  voicePan?: number;  // Stereo Panning (-1.0 = Left, 0 = Center, 1.0 = Right only)
  screenTransition?: ScreenTransitionType; // 画面トランジション演出 (瞼閉じなど)
  scrollingBackground?: ScenarioScrollingBackgroundConfig; // 2枚板無限ループスライド＆ぼかし背景
  seUrl?: string;     // Scene specific SE URL (e.g. '/se/walking.mp3')
  seVolume?: number;  // Scene specific SE volume (default 0.3)
  seLoop?: boolean;   // Whether scene SE loops (default true for continuous action)
  avatar?: ScenarioSceneAvatarConfig;
  avatars?: Record<string, ScenarioSceneAvatarConfig>; // Multi-character per-avatar action configs
  location?: string;
  background?: string;
  backgroundZoom?: number;        // 背景テクスチャのズーム倍率オーバーライド (1.0 = 引いた等倍全体表示)
  backgroundOffset?: { x?: number; y?: number }; // 背景テクスチャのオフセット微調整
  panoramaBackgroundUrl?: string; // 360° Equirectangular パノラマ背景URL
  usePanoramaCamera?: boolean;    // パノラマ用の固定視点カメラ（原点固定・視線回転）
  scenePreset?: ScenePresetId;
  cameraStartAngle?: CameraStartAngle;
  cameraPreset?: CameraPreset;
  cameraStrength?: number;
  cameraZoom?: CameraZoomType;
  cameraDistance?: number; // Distance multiplier (e.g. 0.6 for close, 1.5 for far)
  cameraTransitionDuration?: number; // Transition duration in seconds (default 0.7s)
  cameraTransitionEasing?: CameraTransitionEasing; // Transition easing (gyuin / smooth / cut)
  cameraTarget?: AvatarSlotPosition | [number, number, number] | string;
  live2d?: boolean | { enabled?: boolean; basePath?: string; triggerDistance?: number }; // Live2D近接カットイン表示の有効化/画像パス指定
  cameraPosition?: [number, number, number]; // Direct camera position override (e.g. over-the-shoulder)
  cameraFov?: number; // Direct camera FOV override
  choices?: ScenarioChoice[];
  choiceDelaySec?: number; // 選択肢表示前のディレイ秒数（アバターの視線移動をしっかり見せるための待ち時間、デフォルト 1.0s）
  focusLines?: boolean | FocusLinesConfig; // 画面中央に向かうダイナミック効果線（集中線）
  dreamBackground?: boolean | 'heart' | AnimeDreamBackgroundConfig; // アニメ風ハート・パステル夢心地背景エフェクト
  motionBlur?: boolean; // シーン全体で高速動作時の方向性輪郭ブラーをONにするか (デフォルトOFF)
  motionSpeed?: number; // シーン全体または発話者のモーション再生速度倍率 (デフォルト 1.0)
  fisheye?: boolean | Partial<CinematicFisheyeConfig>; // 魚眼レンズ歪み・ドアスコープ円周魚眼
  yandere?: boolean | Partial<YandereOptions>; // シーン発話者または単体アバターのヤンデレモード
  shaftMode?: boolean; // シャフト演出モード (白背景・単色キャラ・太白輪郭・ローポリ教室)
  shaftSpaceStage?: 'orbit' | 'ghost_left_behind' | false; // シャフト宇宙ステージ (公転する地球と太陽 / 宇宙に取り残されるアオイ)
  shaftCutIn?: 'red_trouble' | 'green_closed' | 'none'; // 赤コマ・緑コマのタイポグラフィカットイン
  shaftCutInDuration?: number; // カットイン表示秒数
  shafudo?: boolean; // エミリ等の「シャフ度」ポーズ
  conditions?: string[];
  goto?: string;
  waitClick?: boolean;
  autoNextSec?: number;
  /** セリフ中のカメラ・背景遷移タイムライン（at 昇順で指定） */
  transitions?: SceneTransition[];
}

export interface ScenarioChapter {
  id: string;
  title: string;
  conditions?: string[];
  scenes: ScenarioScene[];
}

export interface ScenarioPackage {
  id: string;
  title: string;
  characters?: ScenarioCharacterPlacement[]; // Placements for multi-character scenarios
  panoramaBackgroundUrl?: string; // パッケージ全体のデフォルト360°パノラマ背景URL
  bgm?: string;       // Sound Master ID (e.g. 'bgm_main')
  bgmUrl?: string;    // Direct BGM URL (Backward compatibility)
  bgmVolume?: number;
  bgmLoop?: boolean;  // BGMのループ再生フラグ (デフォルト true。PVなどの単曲完結は false)
  se?: string;        // Sound Master ID (e.g. 'se_cicada')
  seUrl?: string;     // Direct SE URL (Backward compatibility)
  seVolume?: number;
  hideMessageWindow?: boolean; // PV等の演出用に標準メッセージウィンドウを非表示にする
  instantCameraCut?: boolean;  // カット切り替わり時にカメラをスムーズ補間せず一瞬でジャンプ切り替えする
  chapters: ScenarioChapter[];
}

export interface ScenarioState {
  chapterIndex: number;
  sceneIndex: number;
  flags: Set<string>;
  isPlaying: boolean;
  isTyping: boolean;
  isWaitingChoice: boolean;
}
