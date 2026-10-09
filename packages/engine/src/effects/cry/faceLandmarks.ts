import * as THREE from 'three';
import type { VRM, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm';

/** 頭のボーンから見た顔の目印（口・目尻）。読み込み時の形（バインドポーズ）から測る */
export interface FaceLandmarks {
  head: THREE.Object3D;
  /** 頭のボーンの座標系での、モデルの上・正面の向き */
  up: THREE.Vector3;
  forward: THREE.Vector3;
  /** 口の真ん中と、口の幅・開いたときの高さ（m） */
  mouth: { center: THREE.Vector3; width: number; height: number } | null;
  /** 左右の目尻（下まぶたの外側の端） */
  eyeCorners: THREE.Vector3[];
}

interface Sample {
  /** モデル座標（glTF のシーン座標）での位置 */
  position: THREE.Vector3;
  /** シェイプキーを入れ切ったときの位置（モデル座標） */
  morphed: THREE.Vector3;
  /** シェイプキーで動く量 */
  moved: number;
}

/**
 * 表情（aa・blink）のシェイプキーで大きく動く頂点から、口と目尻の位置を求める。
 * 頂点はバインドポーズのモデル座標で測り、頭のボーンの座標系へ移す
 */
export function measureFaceLandmarks(vrm: VRM): FaceLandmarks | null {
  const head = vrm.humanoid?.getRawBoneNode('head');
  const manager = vrm.expressionManager;
  if (!head || !manager) return null;

  // モデル座標 → 頭のボーンの座標。スキンメッシュならバインド時の逆行列を使う
  let modelToHead: THREE.Matrix4 | null = null;
  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (modelToHead || !mesh.isSkinnedMesh) return;
    const index = mesh.skeleton.bones.indexOf(head as THREE.Bone);
    if (index >= 0) modelToHead = mesh.skeleton.boneInverses[index].clone();
  });
  if (!modelToHead) {
    vrm.scene.updateMatrixWorld(true);
    modelToHead = head.matrixWorld.clone().invert().multiply(vrm.scene.matrixWorld);
  }
  const toHead = modelToHead as THREE.Matrix4;

  // VRM0 は -Z、VRM1 は +Z を向いて作られている（rotateVRM0 はシーンを回すだけで、頂点は元のまま）
  const facing = vrm.meta?.metaVersion === '0' ? -1 : 1;
  const basis = new THREE.Matrix3().setFromMatrix4(toHead);
  const forward = new THREE.Vector3(0, 0, facing).applyMatrix3(basis).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyMatrix3(basis).normalize();

  const mouthSamples = movedVertices(vrm, 'aa');
  const blinkSamples = movedVertices(vrm, 'blink');

  let mouth: FaceLandmarks['mouth'] = null;
  if (mouthSamples.length) {
    const box = new THREE.Box3();
    for (const s of mouthSamples) box.expandByPoint(s.position);
    const center = box.getCenter(new THREE.Vector3());
    // 正面に一番出ている唇の位置まで前に出す
    center.z = facing > 0 ? box.max.z : box.min.z;
    mouth = {
      center: center.applyMatrix4(toHead),
      width: box.max.x - box.min.x,
      height: box.max.y - box.min.y,
    };
  }

  const eyeCorners: THREE.Vector3[] = [];
  for (const side of [1, -1]) {
    // まばたきで動く頂点（上まぶた）のうち、顔の片側にあるもの。閉じたときの位置が目の下の線になる
    const lids = blinkSamples.filter((s) => Math.sign(s.position.x) === side && Math.abs(s.position.x) > 0.005);
    if (!lids.length) continue;
    const box = new THREE.Box3();
    const closed = new THREE.Box3();
    for (const s of lids) {
      box.expandByPoint(s.position);
      closed.expandByPoint(s.morphed);
    }
    const outerX = side > 0 ? box.max.x : box.min.x;
    const width = box.max.x - box.min.x;
    // まぶたの範囲（目頭〜まつ毛の外のはね）の外から 3.5 割、下まぶたの縁（閉じたまぶたの線）の高さ
    const corner = new THREE.Vector3(
      outerX - side * width * 0.35,
      closed.min.y + (box.max.y - closed.min.y) * 0.06,
      facing > 0 ? box.max.z : box.min.z,
    );
    eyeCorners.push(corner.applyMatrix4(toHead));
  }

  if (!mouth && !eyeCorners.length) return null;
  return { head, up, forward, mouth, eyeCorners };
}

/** 表情のシェイプキーで大きく動く頂点（最大の 35% 以上動くもの）をモデル座標で集める */
function movedVertices(vrm: VRM, expressionName: string): Sample[] {
  const expression = vrm.expressionManager?.getExpression(expressionName);
  if (!expression) return [];
  const samples: Sample[] = [];
  const position = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (const bind of expression.binds) {
    const morph = bind as VRMExpressionMorphTargetBind;
    if (!morph.primitives || typeof morph.index !== 'number') continue;
    for (const mesh of morph.primitives) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const base = geometry.getAttribute('position');
      const target = geometry.morphAttributes.position?.[morph.index];
      if (!base || !target) continue;
      const skinned = mesh as THREE.SkinnedMesh;
      const toModel = skinned.isSkinnedMesh ? skinned.bindMatrix : mesh.matrixWorld;
      const relative = geometry.morphTargetsRelative;
      for (let i = 0; i < base.count; i++) {
        position.fromBufferAttribute(base, i);
        offset.fromBufferAttribute(target, i);
        if (!relative) offset.sub(position);
        const moved = offset.length();
        if (moved > 1e-5) {
          samples.push({
            position: position.clone().applyMatrix4(toModel),
            morphed: position.clone().add(offset).applyMatrix4(toModel),
            moved,
          });
        }
      }
    }
  }
  const max = samples.reduce((m, s) => Math.max(m, s.moved), 0);
  return samples.filter((s) => s.moved >= max * 0.35);
}

