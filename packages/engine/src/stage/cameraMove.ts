import * as THREE from 'three';
import type { ResolvedCameraMove } from '../schema/stage';

const UP = new THREE.Vector3(0, 1, 0);
const deg = THREE.MathUtils.degToRad;

/** amount 1 のときの動きの大きさ */
const PAN_RAD = deg(45);
const TILT_RAD = deg(30);
/** オービットは amount 1 で1周（amount が周回数） */
const ORBIT_RAD = Math.PI * 2;
const DUTCH_RAD = deg(18);
/** 離れる量（注視点までの距離に対する割合） */
const DOLLY_IN_BACK = 1.2;
const DOLLY_OUT_BACK = 2;
const DOLLY_ZOOM_BACK = 2;
const CRANE_BACK = 0.8;
/** 昇る高さ（m） */
const CRANE_RAISE = 2.5;
/** ズームインで寄る倍率（1 で画面の幅が半分）・ズームアウトで広げる倍率 */
const ZOOM_IN_SCALE = 1;
const ZOOM_OUT_SCALE = 1;
/** 手持ち風の揺れ（度） */
const HANDHELD_DEG = 0.8;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 構図のカメラ（base）にカメラの動きを重ねて camera に当てる。time はカット内の時刻（頭出ししても同じ絵になる）。
 * ドリーインは構図から離れた所から始めて構図へ着地する。ズームインは構図から画角で寄っていく
 */
export function applyCameraMove(
  camera: THREE.PerspectiveCamera,
  base: { position: THREE.Vector3; target: THREE.Vector3 },
  /** 寄る相手の顔の位置（ズームインで寄るほど視線をここへ移し、顔が画面の外へ切れないようにする） */
  face: THREE.Vector3 | null,
  baseFov: number,
  move: ResolvedCameraMove,
  time: number
): void {
  const progress = move.duration > 0 ? THREE.MathUtils.clamp((time - move.at) / move.duration, 0, 1) : 1;
  const eased = easeInOutCubic(progress);
  // 構図へ着地する動きは 1 → 0、構図から離れる動きは 0 → 1
  const landing = (1 - eased) * move.amount;
  const leaving = eased * move.amount;

  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let orbit = 0;
  let back = 0;
  let raise = 0;
  let widen = 0;
  let narrow = 0;
  let keepSize = false;
  let lookAtFace = 0;
  switch (move.type) {
    case 'pan_left':
      yaw = -PAN_RAD * landing;
      break;
    case 'pan_right':
      yaw = PAN_RAD * landing;
      break;
    case 'tilt_up':
      pitch = -TILT_RAD * landing;
      break;
    case 'tilt_down':
      pitch = TILT_RAD * landing;
      break;
    case 'dolly_in':
      back = DOLLY_IN_BACK * landing;
      break;
    case 'dolly_out':
      back = DOLLY_OUT_BACK * leaving;
      break;
    case 'zoom_in':
      narrow = ZOOM_IN_SCALE * leaving;
      lookAtFace = eased;
      break;
    case 'zoom_out':
      widen = ZOOM_OUT_SCALE * leaving;
      break;
    case 'orbit_left':
      orbit = ORBIT_RAD * landing;
      break;
    case 'orbit_right':
      orbit = -ORBIT_RAD * landing;
      break;
    case 'crane_up':
      raise = CRANE_RAISE * leaving;
      back = CRANE_BACK * leaving;
      break;
    case 'dolly_zoom':
      back = DOLLY_ZOOM_BACK * leaving;
      keepSize = true;
      break;
    case 'handheld': {
      // 周期のそろわない遅い揺れを重ねて、息づかいのような手ぶれにする
      const a = deg(HANDHELD_DEG) * move.amount;
      const w = (hz: number, phase: number) => Math.sin(2 * Math.PI * hz * time + phase);
      yaw = a * (0.6 * w(0.31, 0) + 0.4 * w(0.83, 1.7));
      pitch = a * (0.6 * w(0.27, 0.5) + 0.4 * w(0.71, 2.3));
      roll = a * 0.5 * w(0.19, 1.1);
      break;
    }
    case 'dutch_left':
      roll = -DUTCH_RAD * leaving;
      break;
    case 'dutch_right':
      roll = DUTCH_RAD * leaving;
      break;
  }

  const position = base.position.clone();
  const target = base.target.clone();
  if (face && lookAtFace) target.lerp(face, lookAtFace);
  if (orbit) position.sub(target).applyAxisAngle(UP, orbit).add(target);
  const distance = position.distanceTo(target);
  if (back) position.addScaledVector(position.clone().sub(target).normalize(), back * distance);
  position.y += raise;
  if (yaw || pitch) {
    const view = target.clone().sub(position);
    const right = new THREE.Vector3().crossVectors(view, UP).normalize();
    view.applyAxisAngle(right, pitch).applyAxisAngle(UP, yaw);
    target.copy(position).add(view);
  }
  camera.position.copy(position);
  camera.lookAt(target);
  if (roll) camera.rotateZ(roll);

  // 画角：ズームは画面の幅を広げ、ドリーズームは離れた分だけ狭めて被写体の大きさを保つ
  const scale = keepSize ? distance / position.distanceTo(base.target) : (1 + widen) / (1 + narrow);
  const fov = scale === 1 ? baseFov : Math.min(90, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(deg(baseFov) / 2) * scale)));
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}
