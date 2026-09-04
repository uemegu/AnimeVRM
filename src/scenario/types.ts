import { EffectPresetName } from '../effects/text/types';
import { CameraPreset, CameraStartAngle } from '../animation/types';
import { ScenePresetId } from '../presets/ScenePresets';

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

export interface ScenarioSceneAvatarConfig {
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  motion?: string;    // Motion Master ID (e.g. 'greeting') or FBX URL
  expression?: string;
  expressionWeight?: number;
  faceTexture?: string;
  position?: AvatarSlotPosition | [number, number, number];
  rotationY?: number;
  effectText?: EffectPresetName | {
    preset: EffectPresetName;
    text?: string;
    duration?: number;
  };
  lookAtCamera?: boolean;
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
  textureUrl?: string; // e.g. '/textures/town_far.png'
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
  text: string;
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  voice?: string;     // Sound Master ID (e.g. 'confess_intro_1')
  voiceUrl?: string;  // Direct voice audio URL (Backward compatibility)
  voicePan?: number;  // Stereo Panning (-1.0 = Left, 0 = Center, 1.0 = Right only)
  screenTransition?: ScreenTransitionType; // 画面トランジション演出 (瞼閉じなど)
  scrollingBackground?: ScenarioScrollingBackgroundConfig; // 2枚板無限ループスライド＆ぼかし背景
  avatar?: ScenarioSceneAvatarConfig;
  avatars?: Record<string, ScenarioSceneAvatarConfig>; // Multi-character per-avatar action configs
  location?: string;
  background?: string;
  scenePreset?: ScenePresetId;
  cameraStartAngle?: CameraStartAngle;
  cameraPreset?: CameraPreset;
  cameraStrength?: number;
  cameraZoom?: CameraZoomType;
  cameraDistance?: number; // Distance multiplier (e.g. 0.6 for close, 1.5 for far)
  cameraTransitionDuration?: number; // Transition duration in seconds (default 0.7s)
  cameraTransitionEasing?: CameraTransitionEasing;
  cameraTarget?: AvatarSlotPosition | [number, number, number] | string;
  choices?: ScenarioChoice[];
  conditions?: string[];
  goto?: string;
  waitClick?: boolean;
  autoNextSec?: number;
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
  bgm?: string;       // Sound Master ID (e.g. 'bgm_main')
  bgmUrl?: string;    // Direct BGM URL (Backward compatibility)
  bgmVolume?: number;
  se?: string;        // Sound Master ID (e.g. 'se_cicada')
  seUrl?: string;     // Direct SE URL (Backward compatibility)
  seVolume?: number;
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
