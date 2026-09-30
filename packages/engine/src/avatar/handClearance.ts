import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { forEachVertex, mainBone, measureHand, restPosition, skinPart } from './handShape';

/**
 * 手が肌（頭・太もも）に入り込まないよう、手を肌の表面で止める。
 *
 * 布や髪は手に押されて動く側（clothDent.ts・handColliders.ts）で、手は動かさない。肌は押せないので、
 * モーションの手が肌に入ったときだけ、手の向きを保ったまま手首を肌の外へずらし、上腕と前腕を2ボーン IK で解き直す。
 * 肌は骨と一緒に動く固い形として扱うので、揺れものに合わせて手が動くことはない。
 * モーションの姿勢（正規化ボーン）に足すので、揺れものや布のへこみはずらした後の手を見る。
 *
 * 肌の形は読み込み時にメッシュから測る（服を除いた肌の部品だけ）。服の下の肌が削られているモデルでは、
 * 削られた所を周りから補う。
 *
 * - precise: 手のひら・指の線分の中点も調べる
 * - simple: 線分の端だけ調べる（軽い）
 * - off: 何もしない
 */
export type HandClearanceMode = 'precise' | 'simple' | 'off';

/** 1フレームで解き直す回数（1回で押し出すのは一番深い点だけなので、残りを拾う） */
const ITERATIONS = 4;
/** 太ももと手の間に残す隙間。スカートが手と太ももの間に挟まる分 */
const THIGH_CLOTH_GAP = 0.006;
/** 太ももの両端から、この距離をかけて判定を弱める（境目で手が跳ねないように） */
const LIMB_FADE = 0.03;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _local = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _shift = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _m = new THREE.Matrix4();

// ---- 距離の表 ----

/**
 * 角度（1周で折り返す）× 位置（端で止める）の2次元表。セルの値は「中心からの距離の最大値」で、
 * 引くときは双線形補間する（セルの境目で押し出す量が飛ばないように）
 */
class RadiusTable {
  private readonly values: Float32Array;

  constructor(private readonly cols: number, private readonly rows: number) {
    this.values = new Float32Array(cols * rows).fill(NaN);
  }

  /** u: 0〜1（1周）、v: 0〜1 */
  put(u: number, v: number, radius: number): void {
    const i = ((Math.floor(u * this.cols) % this.cols) + this.cols) % this.cols;
    const j = THREE.MathUtils.clamp(Math.round(v * (this.rows - 1)), 0, this.rows - 1);
    const k = j * this.cols + i;
    if (!(this.values[k] >= radius)) this.values[k] = radius;
  }

  /** 空のセルを隣の平均で埋める。1つも値がなければ false */
  fill(): boolean {
    const { values, cols, rows } = this;
    if (values.every(Number.isNaN)) return false;
    while (values.some(Number.isNaN)) {
      const next = values.slice();
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (!Number.isNaN(values[j * cols + i])) continue;
          let sum = 0;
          let count = 0;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const jj = j + dj;
            if (jj < 0 || jj >= rows) continue;
            const value = values[jj * cols + ((i + di + cols) % cols)];
            if (!Number.isNaN(value)) {
              sum += value;
              count++;
            }
          }
          if (count) next[j * cols + i] = sum / count;
        }
      }
      values.set(next);
    }
    return true;
  }

  max(): number {
    let max = 0;
    for (const value of this.values) if (value > max) max = value;
    return max;
  }

  sample(u: number, v: number): number {
    const x = u * this.cols - 0.5;
    const i0 = Math.floor(x);
    const tx = x - i0;
    const a = ((i0 % this.cols) + this.cols) % this.cols;
    const b = (a + 1) % this.cols;
    const y = THREE.MathUtils.clamp(v, 0, 1) * (this.rows - 1);
    const j0 = Math.min(Math.floor(y), this.rows - 2);
    const ty = y - j0;
    const at = (i: number, j: number) => this.values[j * this.cols + i];
    const low = at(a, j0) * (1 - tx) + at(b, j0) * tx;
    const high = at(a, j0 + 1) * (1 - tx) + at(b, j0 + 1) * tx;
    return low * (1 - ty) + high * ty;
  }
}

// ---- 肌の形 ----

/** 骨に付いた肌の形。点が内側に入ったら、外へ出す向き（骨のローカル座標）を out に入れて深さを返す */
interface Hull {
  bone: THREE.Object3D;
  /** 形を包む球（骨のローカル座標）。手がこの外なら判定を飛ばす */
  center: THREE.Vector3;
  reach: number;
  depth(local: THREE.Vector3, radius: number, out: THREE.Vector3): number;
}

/** 主に raw の骨で動く肌の頂点（normalized の骨のローカル座標）。part で使う部品を選ぶ */
function skinPoints(vrm: VRM, raw: THREE.Object3D, normalized: THREE.Object3D, part: (mesh: THREE.SkinnedMesh) => boolean): THREE.Vector3[] {
  const inverse = _m.copy(normalized.matrixWorld).invert();
  const points: THREE.Vector3[] = [];
  forEachVertex(
    vrm,
    (mesh, vertex) => {
      if (mainBone(mesh, vertex) === raw) points.push(restPosition(mesh, vertex).applyMatrix4(inverse));
    },
    part
  );
  return points;
}

/** 頭：中心から見た向きごとの半径。顔の部品も含め、髪は除く（髪は手に押されて動く側） */
function headHull(vrm: VRM): Hull | null {
  const bone = vrm.humanoid.getNormalizedBoneNode('head');
  const raw = vrm.humanoid.getRawBoneNode('head');
  if (!bone || !raw) return null;
  const notHair = (mesh: THREE.SkinnedMesh) => !(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((m) => /hair/i.test(m.name));
  const points = skinPoints(vrm, raw, bone, notHair);
  if (points.length < 50) return null;

  const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  const table = new RadiusTable(24, 13);
  const uv = (d: THREE.Vector3, length: number) =>
    [Math.atan2(d.x, d.z) / (Math.PI * 2) + 0.5, Math.asin(THREE.MathUtils.clamp(d.y / length, -1, 1)) / Math.PI + 0.5] as const;
  for (const p of points) {
    const d = _v.subVectors(p, center);
    const length = d.length();
    if (length > 1e-5) table.put(...uv(d, length), length);
  }
  if (!table.fill()) return null;
  const maxRadius = table.max();

  return {
    bone,
    center,
    reach: maxRadius,
    depth(local, radius, out) {
      out.subVectors(local, center);
      const length = out.length();
      if (length < 1e-5 || length > maxRadius + radius) return 0;
      const depth = table.sample(...uv(out, length)) + radius - length;
      out.divideScalar(length);
      return depth;
    },
  };
}

/**
 * 手足：骨から子の骨へ向かう軸まわりの、位置ごと・向きごとの半径。肌の部品だけで測る。
 * gap は肌と手の間に残す隙間（間に挟まる服の分）
 */
function limbHull(vrm: VRM, skin: THREE.SkinnedMesh | null, boneName: VRMHumanBoneName, childName: VRMHumanBoneName, gap: number): Hull | null {
  const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
  const raw = vrm.humanoid.getRawBoneNode(boneName);
  const child = vrm.humanoid.getNormalizedBoneNode(childName);
  if (!bone || !raw || !child || !skin) return null;
  const tip = bone.worldToLocal(child.getWorldPosition(new THREE.Vector3()));
  const length = tip.length();
  if (length < 0.05) return null;
  const axis = tip.clone().divideScalar(length);
  const side = new THREE.Vector3(1, 0, 0).addScaledVector(axis, -axis.x);
  if (side.lengthSq() < 1e-6) side.set(0, 0, 1).addScaledVector(axis, -axis.z);
  side.normalize();
  const front = new THREE.Vector3().crossVectors(axis, side);

  const points = skinPoints(vrm, raw, bone, (mesh) => mesh === skin);
  if (points.length < 50) return null;
  const table = new RadiusTable(24, Math.max(2, Math.ceil(length / 0.02) + 1));
  const u = (d: THREE.Vector3) => Math.atan2(d.dot(front), d.dot(side)) / (Math.PI * 2) + 0.5;
  for (const p of points) {
    const t = p.dot(axis) / length;
    if (t < -0.1 || t > 1.1) continue;
    const d = _v.copy(p).addScaledVector(axis, -t * length);
    table.put(u(d), t, d.length());
  }
  if (!table.fill()) return null;
  const maxRadius = table.max();

  return {
    bone,
    center: tip.clone().multiplyScalar(0.5),
    reach: Math.hypot(maxRadius + gap, length / 2 + LIMB_FADE),
    depth(local, radius, out) {
      const t = local.dot(axis) / length;
      const beyond = Math.max(-t, t - 1) * length;
      const fade = 1 - THREE.MathUtils.clamp(beyond / LIMB_FADE, 0, 1);
      if (fade <= 0) return 0;
      out.copy(local).addScaledVector(axis, -t * length);
      const r = out.length();
      if (r < 1e-5 || r > maxRadius + gap + radius) return 0;
      const surface = table.sample(u(out), t);
      out.divideScalar(r);
      return (surface + gap + radius - r) * fade;
    },
  };
}

// ---- 手 ----

/** 当たりを調べる点。骨のローカル座標で持ち、毎フレームワールドへ移す */
interface Probe {
  bone: THREE.Object3D;
  local: THREE.Vector3;
  /** 点から肉の表面までの距離 */
  radius: number;
  /** 線分の中点。precise のときだけ調べる */
  fine: boolean;
}

interface Arm {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  probes: Probe[];
  /** 手首からいちばん遠い点までの距離（読み込み時） */
  reach: number;
}

function buildArm(vrm: VRM, side: 'left' | 'right', skin: THREE.SkinnedMesh | null): Arm | null {
  const humanoid = vrm.humanoid;
  const upper = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
  const lower = humanoid.getNormalizedBoneNode(`${side}LowerArm`);
  const hand = humanoid.getNormalizedBoneNode(`${side}Hand`);
  const segments = measureHand(vrm, side, skin);
  if (!upper || !lower || !hand || !segments) return null;

  const probes: Probe[] = [];
  for (const segment of segments) {
    const bone = humanoid.getNormalizedBoneNode(segment.bone);
    if (!bone) continue;
    for (const t of [0, 0.5, 1]) {
      probes.push({ bone, local: bone.worldToLocal(segment.start.clone().lerp(segment.end, t)), radius: segment.radius, fine: t === 0.5 });
    }
  }
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const reach = Math.max(...probes.map((probe) => probe.bone.localToWorld(probe.local.clone()).distanceTo(wrist) + probe.radius));
  return { upper, lower, hand, probes, reach };
}

// ---- 本体 ----

export class HandClearance {
  /** 前のフレームで書き換えた骨と、その前の回転（モーションが書かない骨を戻すため） */
  private readonly saved = new Map<THREE.Object3D, THREE.Quaternion>();
  /** 形ごとの、ワールド → 骨のローカルの行列と、包む球の中心（ワールド）。毎フレーム作り直さないよう持っておく */
  private readonly inverses: THREE.Matrix4[];
  private readonly centers: THREE.Vector3[];

  private constructor(
    private readonly vrm: VRM,
    private readonly hulls: Hull[],
    private readonly arms: Arm[],
    private mode: HandClearanceMode
  ) {
    this.inverses = hulls.map(() => new THREE.Matrix4());
    this.centers = hulls.map(() => new THREE.Vector3());
  }

  /** 読み込み直後（モーションを当てる前の姿勢）に呼ぶ。測れる肌の形も腕もなければ null */
  static create(vrm: VRM, mode: HandClearanceMode): HandClearance | null {
    if (!vrm.humanoid) return null;
    vrm.scene.updateMatrixWorld(true);
    const skin = skinPart(vrm);
    const hulls = [
      headHull(vrm),
      limbHull(vrm, skin, 'leftUpperLeg', 'leftLowerLeg', THIGH_CLOTH_GAP),
      limbHull(vrm, skin, 'rightUpperLeg', 'rightLowerLeg', THIGH_CLOTH_GAP),
    ].filter((hull): hull is Hull => !!hull);
    const arms = (['left', 'right'] as const).map((side) => buildArm(vrm, side, skin)).filter((arm): arm is Arm => !!arm);
    if (hulls.length === 0 || arms.length === 0) return null;
    return new HandClearance(vrm, hulls, arms, mode);
  }

  setMode(mode: HandClearanceMode): void {
    this.mode = mode;
  }

  /** モーションを当てる前に呼ぶ。前のフレームでずらした腕を戻す */
  restore(): void {
    for (const [bone, quaternion] of this.saved) bone.quaternion.copy(quaternion);
    this.saved.clear();
  }

  /** モーション・顔の向きを当てた後、vrm.update の前に呼ぶ */
  apply(): void {
    if (this.mode === 'off') return;
    const precise = this.mode === 'precise';

    this.vrm.humanoid.normalizedHumanBonesRoot.updateWorldMatrix(true, true);
    const { hulls, inverses, centers } = this;
    for (let h = 0; h < hulls.length; h++) {
      inverses[h].copy(hulls[h].bone.matrixWorld).invert();
      centers[h].copy(hulls[h].center).applyMatrix4(hulls[h].bone.matrixWorld);
    }

    for (const arm of this.arms) {
      // 手の届く範囲にある形だけを調べる
      const wrist = arm.hand.getWorldPosition(_w);
      const near: number[] = [];
      for (let h = 0; h < hulls.length; h++) {
        const reach = hulls[h].reach * hulls[h].bone.matrixWorld.getMaxScaleOnAxis() + arm.reach;
        if (wrist.distanceToSquared(centers[h]) < reach * reach) near.push(h);
      }
      if (near.length === 0) continue;

      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        let deepest = 0;
        let deepestHull = 0;
        for (const probe of arm.probes) {
          if (probe.fine && !precise) continue;
          // localToWorld は呼ぶたびに親の行列を計算し直して重い。骨の行列は動かすたびに更新しているので、そのまま使う
          const world = _v.copy(probe.local).applyMatrix4(probe.bone.matrixWorld);
          for (const h of near) {
            const depth = hulls[h].depth(_local.copy(world).applyMatrix4(inverses[h]), probe.radius, _normal);
            if (depth > deepest) {
              deepest = depth;
              deepestHull = h;
              _shift.copy(_normal);
            }
          }
        }
        if (deepest < 1e-4) break;
        // 押し出す向きをワールドへ（骨の拡大縮小ぶんも掛かる）
        const matrix = hulls[deepestHull].bone.matrixWorld;
        _shift.transformDirection(matrix).multiplyScalar(deepest * matrix.getMaxScaleOnAxis());
        this.moveWrist(arm, _shift);
      }
    }
  }

  /** 手の向きを保ったまま、手首を shift（ワールド）だけずらす */
  private moveWrist(arm: Arm, shift: THREE.Vector3): void {
    for (const bone of [arm.upper, arm.lower, arm.hand]) {
      if (!this.saved.has(bone)) this.saved.set(bone, bone.quaternion.clone());
    }
    const handWorld = arm.hand.getWorldQuaternion(new THREE.Quaternion());
    const target = arm.hand.getWorldPosition(new THREE.Vector3()).add(shift);
    reach(arm.upper, arm.lower, arm.hand, target);
    arm.hand.quaternion.copy(arm.lower.getWorldQuaternion(_q).invert().multiply(handWorld));
    arm.hand.updateMatrixWorld(true);
  }
}

/** 2ボーン IK。肘は今曲がっている側に保つ */
function reach(upper: THREE.Object3D, lower: THREE.Object3D, hand: THREE.Object3D, target: THREE.Vector3): void {
  const shoulder = upper.getWorldPosition(new THREE.Vector3());
  const elbow = lower.getWorldPosition(new THREE.Vector3());
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const upperLength = shoulder.distanceTo(elbow);
  const lowerLength = elbow.distanceTo(wrist);
  const toTarget = target.clone().sub(shoulder);
  const distance = THREE.MathUtils.clamp(toTarget.length(), Math.abs(upperLength - lowerLength) + 1e-4, upperLength + lowerLength - 1e-4);
  const aim = toTarget.normalize();
  const pole = elbow.clone().sub(shoulder);
  pole.addScaledVector(aim, -pole.dot(aim));
  if (pole.lengthSq() < 1e-10) pole.set(0, -1, 0).addScaledVector(aim, aim.y);
  pole.normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  turnToward(upper, lower, shoulder.clone().addScaledVector(aim, along).addScaledVector(pole, height));
  turnToward(lower, hand, shoulder.addScaledVector(aim, distance));
}

function turnToward(joint: THREE.Object3D, child: THREE.Object3D, destination: THREE.Vector3): void {
  const origin = joint.getWorldPosition(new THREE.Vector3());
  const from = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const to = destination.clone().sub(origin).normalize();
  const parentWorld = joint.parent!.getWorldQuaternion(_r);
  const delta = parentWorld.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(from, to)).multiply(parentWorld);
  joint.quaternion.premultiply(delta).normalize();
  joint.updateMatrixWorld(true);
}
