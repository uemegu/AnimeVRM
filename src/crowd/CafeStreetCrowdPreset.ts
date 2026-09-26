import { CrowdMemberConfig } from './Persona5CrowdController';
import { resolveAssetUrl } from '../utils/path';

/**
 * Crowd preset for cafe outdoor street (カフェの窓の外を往来する通行人モブ).
 * All members are placed behind the midground window (renderOrder: -2) and lit by flat daylight (daylight).
 */
export const CAFE_STREET_CROWD_PRESET: CrowdMemberConfig[] = [
  // 1. Girl walking from left to right on the foreground outdoor sidewalk
  {
    id: 'mob_street_girl_walk_r',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/Walking.fbx'),
    position: [-3.2, 0, -2.8],
    rotationY: Math.PI * 0.5,
    scale: 0.95,
    animTimeOffset: 0.2,
    daylight: 0.6,
    renderOrder: -2,
    movement: {
      endPosition: [3.2, 0, -2.8],
      speed: 0.65,
      loop: true,
    },
  },
  // 2. Boy walking from right to left on the outdoor street
  {
    id: 'mob_street_boy_walk_l',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/Walking.fbx'),
    position: [3.2, 0, -3.1],
    rotationY: -Math.PI * 0.5,
    scale: 0.98,
    animTimeOffset: 1.4,
    daylight: 0.6,
    renderOrder: -2,
    movement: {
      endPosition: [-3.2, 0, -3.1],
      speed: 0.7,
      loop: true,
    },
  },
  // 3. Second girl walking across in the further distance
  {
    id: 'mob_street_girl2_walk_r',
    modelUrl: resolveAssetUrl('/models/mob/girl2.vrm'),
    motionUrl: resolveAssetUrl('/animations/Walking.fbx'),
    position: [-1.8, 0, -3.5],
    rotationY: Math.PI * 0.5,
    scale: 0.9,
    animTimeOffset: 0.8,
    daylight: 0.6,
    renderOrder: -2,
    movement: {
      endPosition: [3.2, 0, -3.5],
      speed: 0.55,
      loop: true,
    },
  },
];
