import { CrowdMemberConfig } from './Persona5CrowdController';
import { resolveAssetUrl } from '../utils/path';

/**
 * Crowd preset for the painted 2.5D classroom stage (昼休みの擬似3D教室).
 *
 * Geometry layout in painted-classroom (see PaintedClassroom.ts):
 * - Desk row standees at z = -2.6 … -6.85, desks packed from |x| ≈ 0.5 to 3.05
 * - Free floor: centre aisle (|x| < 0.5), side aisles (3.05 < |x| < 3.5),
 *   and the front of the room (z ≈ -7.2 … -8.6, podium at x = 0, z = -7.9)
 * - Main avatars (Aoi & Emily) at z = -1.9, x = ±0.32
 *
 * Crowd students stand only in those aisles so they never cut through a desk card.
 */
export const PAINTED_CLASSROOM_CROWD_PRESET: CrowdMemberConfig[] = [
  // Corridor-side aisle pair (visible in AOI_SHOT and WIDE)
  {
    id: 'mob_pc_boy_talking',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_chat_gesture.fbx'),
    position: [3.27, 0, -3.7],
    rotationY: 2.7,
    scale: 0.98,
    animTimeOffset: 0.3,
  },
  {
    id: 'mob_pc_girl_listening',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_listen_nod.fbx'),
    position: [3.27, 0, -4.6],
    rotationY: -0.3,
    scale: 0.95,
    animTimeOffset: 1.2,
  },

  // Centre aisle, far back (visible between Aoi & Emily in WIDE / TWO_SHOT)
  {
    id: 'mob_pc_girl2_center',
    modelUrl: resolveAssetUrl('/models/mob/girl2.vrm'),
    motionUrl: resolveAssetUrl('/animations/Standing Idle.fbx'),
    position: [0.08, 0, -5.4],
    rotationY: 0.4,
    scale: 0.95,
    animTimeOffset: 2.1,
  },
  {
    id: 'mob_pc_boy2_laughing',
    modelUrl: resolveAssetUrl('/models/mob/boy.vrm'),
    motionUrl: resolveAssetUrl('/animations/ardy_laugh.fbx'),
    position: [-0.6, 0, -7.4],
    rotationY: 0.5,
    scale: 0.98,
    animTimeOffset: 0.8,
  },

  // Window-side aisle (visible in EMILY_SHOT and WIDE)
  {
    id: 'mob_pc_girl_window',
    modelUrl: resolveAssetUrl('/models/mob/girl.vrm'),
    motionUrl: resolveAssetUrl('/animations/mob_listen_nod.fbx'),
    position: [-3.27, 0, -4.0],
    rotationY: 0.9,
    scale: 0.94,
    animTimeOffset: 1.5,
  },
];
