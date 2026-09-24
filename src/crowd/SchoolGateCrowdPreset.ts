import { CrowdMemberConfig } from './Persona5CrowdController';
import { resolveAssetUrl } from '../utils/path';

/**
 * Crowd configuration for Morning School Gate scene.
 * Characters pass through or stand around the gate in the background/midground.
 */
export const MORNING_SCHOOL_GATE_CROWD: CrowdMemberConfig[] = [
  // 1. Male student walking towards gate entrance (right-midground)
  {
    id: 'mob_student_walk_right',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/Walking.fbx'),
    position: [1.2, 0, -1.8],
    rotationY: -Math.PI * 0.4,
    scale: 0.94,
    animTimeOffset: 0.3,
    movement: {
      endPosition: [0.4, 0, -2.6],
      speed: 0.45,
      loop: true,
    },
  },
  // 2. Male student walking across in far background
  {
    id: 'mob_student_walk_left',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/Walking.fbx'),
    position: [-1.4, 0, -2.4],
    rotationY: Math.PI * 0.48,
    scale: 0.92,
    animTimeOffset: 1.1,
    movement: {
      endPosition: [-0.2, 0, -2.3],
      speed: 0.4,
      loop: true,
    },
  },
  // 3. Student standing by the right gate pillar
  {
    id: 'mob_student_standing_right',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/Standing Idle.fbx'),
    position: [1.6, 0, -1.6],
    rotationY: -0.9,
    scale: 0.95,
    animTimeOffset: 1.8,
  },
  // 4. Student standing on left side talking / waiting
  {
    id: 'mob_student_standing_left',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/Standing Idle.fbx'),
    position: [-1.5, 0, -1.5],
    rotationY: 0.7,
    scale: 0.96,
    animTimeOffset: 0.6,
  },
];
