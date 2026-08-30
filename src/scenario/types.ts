import { EffectPresetName } from '../effects/text/types';
import { CameraPreset, CameraStartAngle } from '../animation/types';
import { ScenePresetId } from '../presets/ScenePresets';

export interface ScenarioChoice {
  text: string;
  flag?: string;
  goto?: string;
  effectText?: EffectPresetName;
}

export interface ScenarioSceneAvatarConfig {
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  motion?: string;    // Motion Master ID (e.g. 'greeting') or FBX URL
  expression?: string;
  expressionWeight?: number;
  faceTexture?: string;
  effectText?: EffectPresetName | {
    preset: EffectPresetName;
    text?: string;
    duration?: number;
  };
}

export interface ScenarioScene {
  id: string;
  speaker?: string;
  text: string;
  character?: string; // Character Master ID (e.g. 'girl_01') or Model URL
  voice?: string;     // Sound Master ID (e.g. 'confess_intro_1')
  voiceUrl?: string;  // Direct voice audio URL (Backward compatibility)
  avatar?: ScenarioSceneAvatarConfig;
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
