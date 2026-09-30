import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { forEachVertex, mainBone, measureHand, percentile, restPosition, skinPart, weightOf } from './handShape';

/**
 * 手に押されてスカートがへこむ。
 *
 * スカートの揺れの骨は周りに6本しかなく、骨を動かすとスカートの1/6がまるごと動いてしまう（手の当たった所だけを
 * へこませられない）。そこで骨は使わず、描画のときにスカートの頂点を直接動かす。ボーン変形の後、手の線分
 * （手のひら・指・手首。handShape.ts）の裏側へ頂点を押し込み、周りはなだらかな坂でつなぐ。へこみの幅は深さに
 * 合わせて広がる。押し込む向きは、腰の軸から手へ向かう向きの逆（体の中心へ向かう向き）。
 *
 * へこみには底がある。スカートの下の体（腰を高さごとの楕円、太ももを太さの変わる円柱で近似。肌のメッシュから
 * 測る）の表面より奥へは押し込まない。手がそれより奥へ入るモーションでは、手がスカートにめり込む（モーション側で直す）。
 *
 * 手は動かさない。スカートの奥の太ももで手が止まるのは handClearance.ts が受け持つ。
 * 輪郭線やキャラのマスクも同じマテリアルで描くので、へこみは全部に効く。形だけを変えるので、布のしわは出ない。
 */

/** シェーダーに渡す線分の数の上限（片手 19 本 × 2） */
const MAX_CAPSULES = 40;
/** 手の裏とスカートの間に残す隙間 */
const GAP = 0.002;
/** へこみの外側の坂の傾き（1 で 45 度） */
const SLOPE = 1.0;
/** へこみの底：体の表面とスカートの間に残す隙間 */
const FLOOR_GAP = 0.004;
/** 腰の断面を表す楕円の数（高さ方向） */
const PELVIS_BANDS = 4;
/** 腰の断面の楕円を、外接する箱の角の肉まで覆うよう広げる倍率 */
const PELVIS_SPREAD = 1.08;

interface Capsule {
  /** 線分を動かす骨（raw）と、その骨のローカル座標での両端 */
  bone: THREE.Object3D;
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  hand: 0 | 1;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _up = new THREE.Vector3();
const _hips = new THREE.Vector3();
const _inverse = new THREE.Matrix4();
const _frame = new THREE.Matrix4();

/** へこみの底にする体の形 */
interface BodyFloor {
  /** 腰の骨（raw）と、その骨のワールド行列に右から掛けて「体の向きにそろえた腰の座標」にする行列 */
  hips: THREE.Object3D;
  align: THREE.Matrix4;
  /** 腰の座標での、高さごとの断面の楕円（中心 x, z と半径 x, z）。bottom〜top を等分した各帯の中央 */
  bands: THREE.Vector4[];
  bottom: number;
  top: number;
  /** 太もも：骨（raw）のローカル座標での付け根・膝と、それぞれの太さ */
  thighs: { bone: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; startRadius: number; endRadius: number }[];
}

/** スカートの下の体の形を、肌のメッシュから測る。腰の肌がなければ null（底なし） */
function measureFloor(vrm: VRM, skin: THREE.SkinnedMesh | null): BodyFloor | null {
  const humanoid = vrm.humanoid;
  const hips = humanoid.getRawBoneNode('hips');
  const normalizedHips = humanoid.getNormalizedBoneNode('hips');
  if (!hips || !normalizedHips || !skin) return null;
  // 正規化した腰は、読み込み時の姿勢で体の向き（上・左右・前）にそろっている
  const align = hips.matrixWorld.clone().invert().multiply(normalizedHips.matrixWorld);
  const toFrame = normalizedHips.matrixWorld.clone().invert();

  const legs = (['left', 'right'] as const).map((side) => ({ upper: humanoid.getRawBoneNode(`${side}UpperLeg`), lower: humanoid.getRawBoneNode(`${side}LowerLeg`) }));
  const pelvis: THREE.Vector3[] = [];
  const thighPoints = legs.map(() => [] as THREE.Vector3[]);
  forEachVertex(
    vrm,
    (mesh, vertex) => {
      const bone = mainBone(mesh, vertex);
      if (bone === hips) pelvis.push(restPosition(mesh, vertex).applyMatrix4(toFrame));
      legs.forEach((leg, i) => {
        if (bone === leg.upper) thighPoints[i].push(restPosition(mesh, vertex));
      });
    },
    (mesh) => mesh === skin
  );
  if (pelvis.length < 50) return null;

  const bottom = Math.min(...pelvis.map((p) => p.y));
  const top = Math.max(...pelvis.map((p) => p.y));
  const step = (top - bottom) / PELVIS_BANDS;
  const bands: THREE.Vector4[] = [];
  for (let i = 0; i < PELVIS_BANDS; i++) {
    const y = bottom + step * (i + 0.5);
    const slice = pelvis.filter((p) => Math.abs(p.y - y) <= step);
    if (slice.length < 5) {
      bands.push(bands[i - 1]?.clone() ?? new THREE.Vector4());
      continue;
    }
    const box = new THREE.Box3().setFromPoints(slice);
    bands.push(new THREE.Vector4(
      (box.min.x + box.max.x) / 2,
      (box.min.z + box.max.z) / 2,
      ((box.max.x - box.min.x) / 2) * PELVIS_SPREAD,
      ((box.max.z - box.min.z) / 2) * PELVIS_SPREAD
    ));
  }

  const thighs: BodyFloor['thighs'] = [];
  legs.forEach(({ upper, lower }, i) => {
    const points = thighPoints[i];
    if (!upper || !lower || points.length < 20) return;
    const a = upper.getWorldPosition(new THREE.Vector3());
    const b = lower.getWorldPosition(new THREE.Vector3());
    const line = new THREE.Line3(a, b);
    const measured = points.map((p) => ({ t: line.closestPointToPointParameter(p, false), d: line.closestPointToPoint(p, true, _a).distanceTo(p) }));
    const radiusNear = (from: number, to: number) => {
      const near = measured.filter(({ t }) => t >= from && t <= to).map(({ d }) => d);
      return near.length >= 5 ? percentile(near, 0.9) : percentile(measured.map(({ d }) => d), 0.9);
    };
    thighs.push({ bone: upper, start: upper.worldToLocal(a.clone()), end: upper.worldToLocal(b.clone()), startRadius: radiusNear(0, 0.35), endRadius: radiusNear(0.65, 1) });
  });
  return { hips, align, bands, bottom, top, thighs };
}

/** 頂点の半分以上がスカートの骨で動く部品（上着の裾 CoatSkirt は除く） */
function skirtMeshes(vrm: VRM): THREE.SkinnedMesh[] {
  const isSkirtBone = (bone: THREE.Bone) => /skirt/i.test(bone.name) && !/coat/i.test(bone.name);
  const meshes: THREE.SkinnedMesh[] = [];
  forEachVertex(
    vrm,
    () => {},
    (mesh, vertices) => {
      if (vertices.filter((vertex) => weightOf(mesh, vertex, isSkirtBone) > 0).length >= vertices.length * 0.5) meshes.push(mesh);
      return false;
    }
  );
  return meshes;
}

const DECLARATIONS = /* glsl */ `
uniform vec4 uDentA[${MAX_CAPSULES}];
uniform vec4 uDentB[${MAX_CAPSULES}];
uniform vec3 uDentN[2];
uniform int uDentCount;
uniform int uFloorEnabled;
uniform mat4 uFloorFrame;
uniform vec4 uFloorBands[${PELVIS_BANDS}];
uniform vec2 uFloorY;
uniform vec4 uFloorThighA[2];
uniform vec4 uFloorThighB[2];
uniform int uFloorThighCount;

/** 点（メッシュ座標）が、へこみの底にする体の形（＋隙間）の中にあるか */
bool dentInsideBody(vec3 p) {
  vec3 q = (uFloorFrame * vec4(p, 1.0)).xyz;
  if (q.y > uFloorY.x && q.y < uFloorY.y) {
    float f = clamp((q.y - uFloorY.x) / (uFloorY.y - uFloorY.x) * ${PELVIS_BANDS}.0 - 0.5, 0.0, ${PELVIS_BANDS - 1}.0);
    int i0 = min(int(f), ${PELVIS_BANDS - 2});
    vec4 band = mix(uFloorBands[i0], uFloorBands[i0 + 1], f - float(i0));
    vec2 d = (q.xz - band.xy) / (band.zw + ${FLOOR_GAP.toFixed(4)});
    if (dot(d, d) < 1.0) return true;
  }
  for (int k = 0; k < 2; k++) {
    if (k >= uFloorThighCount) break;
    vec3 a = uFloorThighA[k].xyz;
    vec3 ba = uFloorThighB[k].xyz - a;
    float t = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
    float r = mix(uFloorThighA[k].w, uFloorThighB[k].w, t) + ${FLOOR_GAP.toFixed(4)};
    if (length(p - a - ba * t) < r) return true;
  }
  return false;
}
`;

/**
 * transformed（ボーン変形後のメッシュ座標）を、手の裏側へ押し込む。
 * n は腰の軸から手へ向かう外向き。n に沿って見て、線分の真後ろ（横方向の距離 l が太さ r 以内）は手の裏から
 * さらに GAP だけ奥まで、外側は坂で戻す。
 * 線分ごとに必要な押し込み量を求め、一番大きいものを使う。
 * 押し込んだ先が体の中なら、体の表面の手前まで（二分探索）に減らす。もともと体の中にある頂点は動かさない
 */
const DENT = /* glsl */ `
if (uDentCount > 0) {
  float dentPush = 0.0;
  vec3 dentDir = vec3(0.0);
  for (int i = 0; i < ${MAX_CAPSULES}; i++) {
    if (i >= uDentCount) break;
    vec4 dentA = uDentA[i];
    vec4 dentB = uDentB[i];
    vec3 n = dentB.w < 0.5 ? uDentN[0] : uDentN[1];
    vec3 pa = transformed - dentA.xyz;
    vec3 ba = dentB.xyz - dentA.xyz;
    vec3 paFlat = pa - n * dot(pa, n);
    vec3 baFlat = ba - n * dot(ba, n);
    float t = clamp(dot(paFlat, baFlat) / max(dot(baFlat, baFlat), 1e-10), 0.0, 1.0);
    vec3 pc = pa - ba * t;
    float h = dot(pc, n);
    float l = length(pc - n * h);
    float r = dentA.w;
    float back = l < r ? sqrt(r * r - l * l) : 0.0;
    float allowed = -(back + ${GAP.toFixed(4)}) + ${SLOPE.toFixed(2)} * max(0.0, l - r);
    float push = h - allowed;
    if (push > dentPush) {
      dentPush = push;
      dentDir = n;
    }
  }
  if (dentPush > 0.0 && uFloorEnabled > 0) {
    if (dentInsideBody(transformed)) {
      dentPush = 0.0;
    } else if (dentInsideBody(transformed - dentDir * dentPush)) {
      float lo = 0.0;
      float hi = dentPush;
      for (int k = 0; k < 8; k++) {
        float mid = 0.5 * (lo + hi);
        if (dentInsideBody(transformed - dentDir * mid)) hi = mid;
        else lo = mid;
      }
      dentPush = lo;
    }
  }
  transformed -= dentDir * dentPush;
}
`;

export class ClothDent {
  private readonly uniforms = {
    uDentA: { value: Array.from({ length: MAX_CAPSULES }, () => new THREE.Vector4()) },
    uDentB: { value: Array.from({ length: MAX_CAPSULES }, () => new THREE.Vector4()) },
    uDentN: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uDentCount: { value: 0 },
    uFloorEnabled: { value: 0 },
    uFloorFrame: { value: new THREE.Matrix4() },
    uFloorBands: { value: Array.from({ length: PELVIS_BANDS }, () => new THREE.Vector4()) },
    uFloorY: { value: new THREE.Vector2() },
    uFloorThighA: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uFloorThighB: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uFloorThighCount: { value: 0 },
  };

  private constructor(
    private readonly vrm: VRM,
    /** へこませるメッシュ（座標の基準。部品どうしは同じ位置にある） */
    private readonly mesh: THREE.SkinnedMesh,
    private readonly capsules: Capsule[],
    /** 手ごとの手のひらの中心（raw の手の骨のローカル座標） */
    private readonly palms: { bone: THREE.Object3D; local: THREE.Vector3 }[],
    /** へこみの底（測れなければ底なし） */
    private readonly floor: BodyFloor | null,
    private enabled: boolean
  ) {
    if (floor) {
      this.uniforms.uFloorEnabled.value = 1;
      floor.bands.forEach((band, i) => this.uniforms.uFloorBands.value[i].copy(band));
      this.uniforms.uFloorY.value.set(floor.bottom, floor.top);
      this.uniforms.uFloorThighCount.value = floor.thighs.length;
    }
  }

  /** 読み込み直後（モーションを当てる前の姿勢）に呼ぶ。スカートがなければ null */
  static create(vrm: VRM, enabled: boolean): ClothDent | null {
    if (!vrm.humanoid) return null;
    vrm.scene.updateMatrixWorld(true);
    const meshes = skirtMeshes(vrm);
    if (meshes.length === 0) return null;

    const skin = skinPart(vrm);
    const capsules: Capsule[] = [];
    const palms: { bone: THREE.Object3D; local: THREE.Vector3 }[] = [];
    (['left', 'right'] as const).forEach((side, hand) => {
      const segments = measureHand(vrm, side, skin) ?? [];
      for (const segment of segments) {
        const bone = vrm.humanoid.getRawBoneNode(segment.bone);
        if (!bone || capsules.length >= MAX_CAPSULES) continue;
        capsules.push({ bone, start: bone.worldToLocal(segment.start.clone()), end: bone.worldToLocal(segment.end.clone()), radius: segment.radius, hand: hand as 0 | 1 });
      }
      const palm = segments.filter((segment) => segment.kind === 'palm');
      const rawHand = vrm.humanoid.getRawBoneNode(`${side}Hand`);
      if (rawHand && palm.length) {
        const center = palm.reduce((sum, segment) => sum.add(segment.start).add(segment.end), new THREE.Vector3()).divideScalar(palm.length * 2);
        palms[hand] = { bone: rawHand, local: rawHand.worldToLocal(center) };
      }
    });
    if (capsules.length === 0 || palms.length < 2) return null;

    const dent = new ClothDent(vrm, meshes[0], capsules, palms, measureFloor(vrm, skin), enabled);
    for (const mesh of meshes) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) dent.patch(material);
    }
    return dent;
  }

  private patch(material: THREE.Material): void {
    const baseCompile = material.onBeforeCompile;
    const baseCacheKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      baseCompile.call(material, shader, renderer);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${DECLARATIONS}\nvoid main() {`)
        .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${DENT}`);
    };
    material.customProgramCacheKey = () => `${baseCacheKey.call(material)},clothDent`;
    material.needsUpdate = true;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.uniforms.uDentCount.value = 0;
  }

  /** 揺れもの・腕を当てた後（vrm.update の後）、描画の前に呼ぶ */
  update(): void {
    if (!this.enabled) return;
    const humanoid = this.vrm.humanoid;
    // 手の骨の行列を今の姿勢にする（親の腕・体も、子の指も）
    for (const side of ['leftHand', 'rightHand'] as const) humanoid.getRawBoneNode(side)?.updateWorldMatrix(true, true);
    this.mesh.updateWorldMatrix(true, false);
    _inverse.copy(this.mesh.matrixWorld).invert();
    const scale = _inverse.getMaxScaleOnAxis();

    // n：腰の軸（体の上向き）から手のひらへ向かう水平な向き。スカートは -n の向き（体の中心側）へ押し込む
    const hips = humanoid.getRawBoneNode('hips');
    if (!hips) return;
    hips.getWorldPosition(_hips);
    _up.setFromMatrixColumn(this.vrm.scene.matrixWorld, 1).normalize();
    this.palms.forEach((palm, hand) => {
      _n.copy(palm.local).applyMatrix4(palm.bone.matrixWorld).sub(_hips);
      _n.addScaledVector(_up, -_n.dot(_up));
      if (_n.lengthSq() < 1e-8) _n.set(0, 0, 1);
      this.uniforms.uDentN.value[hand].copy(_n).transformDirection(_inverse);
    });

    this.capsules.forEach((capsule, i) => {
      _a.copy(capsule.start).applyMatrix4(capsule.bone.matrixWorld).applyMatrix4(_inverse);
      _b.copy(capsule.end).applyMatrix4(capsule.bone.matrixWorld).applyMatrix4(_inverse);
      this.uniforms.uDentA.value[i].set(_a.x, _a.y, _a.z, capsule.radius * scale);
      this.uniforms.uDentB.value[i].set(_b.x, _b.y, _b.z, capsule.hand);
    });
    this.uniforms.uDentCount.value = this.capsules.length;

    // へこみの底：体の向きにそろえた腰の座標と、太もも（メッシュ座標）
    const floor = this.floor;
    if (!floor) return;
    for (const thigh of floor.thighs) thigh.bone.updateWorldMatrix(true, false);
    _frame.multiplyMatrices(floor.hips.matrixWorld, floor.align).invert();
    this.uniforms.uFloorFrame.value.multiplyMatrices(_frame, this.mesh.matrixWorld);
    floor.thighs.forEach((thigh, i) => {
      _a.copy(thigh.start).applyMatrix4(thigh.bone.matrixWorld).applyMatrix4(_inverse);
      _b.copy(thigh.end).applyMatrix4(thigh.bone.matrixWorld).applyMatrix4(_inverse);
      this.uniforms.uFloorThighA.value[i].set(_a.x, _a.y, _a.z, thigh.startRadius * scale);
      this.uniforms.uFloorThighB.value[i].set(_b.x, _b.y, _b.z, thigh.endRadius * scale);
    });
  }
}
