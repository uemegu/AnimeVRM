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
  motion?: string;
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
  voiceUrl?: string;
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
  bgmUrl?: string;
  bgmVolume?: number;
  seUrl?: string;
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
