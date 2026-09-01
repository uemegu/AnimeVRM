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
}

export interface ScenarioScene {
  id: string;
  speaker?: string;
  speakerCharacterId?: string; // Character ID speaking in this scene (e.g. 'girl_01')
  text: string;
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  voice?: string;     // Sound Master ID (e.g. 'confess_intro_1')
  voiceUrl?: string;  // Direct voice audio URL (Backward compatibility)
  avatar?: ScenarioSceneAvatarConfig;
  avatars?: Record<string, ScenarioSceneAvatarConfig>; // Multi-character per-avatar action configs
  location?: string;
  background?: string;
  scenePreset?: ScenePresetId;
  cameraStartAngle?: CameraStartAngle;
  cameraPreset?: CameraPreset;
  cameraStrength?: number;
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
