import { ScenePresetData, ScenePresetId } from '../presets/ScenePresets';
import { EffectPresetName } from '../effects/text/types';
import { CameraPreset, CameraStartAngle } from '../animation/types';

export interface CharacterMasterItem {
  id: string;
  name: string;
  modelUrl: string;
  defaultVoiceGender?: 'female' | 'male';
  initialScale?: number;
  description?: string;
  thumbnail?: string;
}

export interface MotionMasterItem {
  id: string;
  name: string;
  file: string;
  isLoop: boolean;
  fadeInSec?: number;
  category?: 'idle' | 'action' | 'greeting' | 'emotion' | 'other';
  description?: string;
}

export interface SoundMasterItem {
  id: string;
  name: string;
  type: 'bgm' | 'se' | 'voice';
  file: string;
  volume?: number;
  description?: string;
}

export interface MasterDatabase {
  characters: Record<string, CharacterMasterItem>;
  motions: Record<string, MotionMasterItem>;
  sounds: Record<string, SoundMasterItem>;
  scenes: Record<string, ScenePresetData>;
}
