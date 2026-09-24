import { CrowdMemberConfig } from './Persona5CrowdController';
import { resolveAssetUrl } from '../utils/path';

/**
 * Crowd preset for the school corridor (廊下).
 * Students stand in casual conversation pairs/groups with ardy-mini generated talking animations.
 * No translation movement - standing and chatting in place.
 */
export const CORRIDOR_CROWD_PRESET: CrowdMemberConfig[] = [
  // Pair 1: Left corridor midground (Boy talking with hand gestures, Girl listening & nodding)
  {
    id: 'mob_corridor_boy_talking',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_chat_gesture.fbx'),
    position: [-1.15, 0, -1.8],
    rotationY: 0.85, // facing slightly rightwards towards girl
    scale: 0.98,
    animTimeOffset: 0.2,
  },
  {
    id: 'mob_corridor_girl_listening',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_listen_nod.fbx'),
    position: [-0.68, 0, -1.9],
    rotationY: -2.1, // facing boy
    scale: 0.96,
    animTimeOffset: 1.1,
  },

  // Pair 2: Right side near classroom sliding door / window
  {
    id: 'mob_corridor_girl2_talking',
    modelUrl: resolveAssetUrl('/models/mob/girl2.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_chat_gesture.fbx'),
    position: [1.35, 0, -2.4],
    rotationY: -1.3, // facing left towards partner
    scale: 0.95,
    animTimeOffset: 1.8,
  },
  {
    id: 'mob_corridor_boy2_listening',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_listen_nod.fbx'),
    position: [0.85, 0, -2.5],
    rotationY: 1.6, // facing girl2
    scale: 1.0,
    animTimeOffset: 0.5,
  },

  // Background solitary student standing near corridor window in distance
  {
    id: 'mob_corridor_girl_far',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/Standing Idle.fbx'),
    position: [-1.65, 0, -3.8],
    rotationY: 0.2,
    scale: 0.9,
    animTimeOffset: 2.3,
  },
];
