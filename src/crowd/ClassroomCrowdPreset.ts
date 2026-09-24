import { CrowdMemberConfig } from './Persona5CrowdController';
import { resolveAssetUrl } from '../utils/path';

/**
 * Crowd preset for the 3D classroom stage (教室の休み時間).
 * Coordinates are in the classroom's space: blackboard at -Z, windows at -X.
 * The desks leave only narrow aisles, so the students gather in the open
 * floor between the front row (z ≈ -2.7) and the lectern (z ≈ -3.75),
 * behind a speaker standing in the center aisle near the origin.
 */
export const CLASSROOM_CROWD_PRESET: CrowdMemberConfig[] = [
  // Group 1: front-left, a boy telling a story to two girls
  {
    id: 'mob_classroom_boy_talking',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_chat_gesture.fbx'),
    position: [-1.5, 0, -3.05],
    rotationY: 2.07, // toward the girl on his right
    scale: 0.98,
    animTimeOffset: 0.2,
  },
  {
    id: 'mob_classroom_girl_listening',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_listen_nod.fbx'),
    position: [-0.95, 0, -3.35],
    rotationY: -1.07, // facing the boy
    scale: 0.95,
    animTimeOffset: 1.1,
  },
  {
    id: 'mob_classroom_girl_laughing',
    modelUrl: resolveAssetUrl('/models/mob/girl2.vrm'),
    motionUrl: resolveAssetUrl('/animations/ardy_laugh.fbx'),
    position: [-2.15, 0, -3.45],
    rotationY: 1.1, // turned in toward the pair
    scale: 0.94,
    animTimeOffset: 0.7,
  },

  // Group 2: front-right, a pair chatting by the teacher's desk
  {
    id: 'mob_classroom_girl2_talking',
    modelUrl: resolveAssetUrl('/models/mob/girl2.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_chat_gesture.fbx'),
    position: [1.0, 0, -3.15],
    rotationY: 1.2, // toward the boy on her left (screen right)
    scale: 0.95,
    animTimeOffset: 1.8,
  },
  {
    id: 'mob_classroom_boy2_listening',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_listen_nod.fbx'),
    position: [1.65, 0, -2.95],
    rotationY: -1.9, // facing girl2
    scale: 1.0,
    animTimeOffset: 0.5,
  },

  // Student on duty at the blackboard, back to the room
  {
    id: 'mob_classroom_girl_board',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/Standing Idle.fbx'),
    position: [-1.9, 0, -4.55],
    rotationY: Math.PI,
    scale: 0.93,
    animTimeOffset: 2.3,
  },
];
