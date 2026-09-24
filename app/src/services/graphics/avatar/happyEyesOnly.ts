import * as THREE from 'three';
import { VRM, VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm';

const HAPPY_EYES_ONLY_SHAPE_KEYS = ['Fcl_EYE_Joy', 'Fcl_BRW_Joy'];

/**
 * VRoid の happy（Fcl_ALL_Joy）は口の形も含むため、リップシンクと重なると口が崩れて
 * 前歯だけが覗いたように見える。happy を目と眉だけの表情に差し替え、口はリップシンクに任せる。
 * 対応するシェイプキーがないモデルでは何もしない。
 */
export function replaceHappyWithEyesOnly(vrm: VRM): void {
  const manager = vrm.expressionManager;
  const original = manager?.getExpression('happy');
  if (!manager || !original) return;

  const primitivesByIndex = new Map<string, { index: number; primitives: THREE.Mesh[] }>();
  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary) return;
    for (const key of HAPPY_EYES_ONLY_SHAPE_KEYS) {
      const index = mesh.morphTargetDictionary[key];
      if (index === undefined) continue;
      const id = `${key}:${index}`;
      if (!primitivesByIndex.has(id)) primitivesByIndex.set(id, { index, primitives: [] });
      primitivesByIndex.get(id)!.primitives.push(mesh);
    }
  });
  const foundKeys = new Set([...primitivesByIndex.keys()].map((id) => id.split(':')[0]));
  if (!HAPPY_EYES_ONLY_SHAPE_KEYS.every((key) => foundKeys.has(key))) return;

  const happy = new VRMExpression('happy');
  happy.isBinary = original.isBinary;
  happy.overrideBlink = original.overrideBlink;
  happy.overrideLookAt = original.overrideLookAt;
  happy.overrideMouth = original.overrideMouth;
  for (const { index, primitives } of primitivesByIndex.values()) {
    happy.addBind(new VRMExpressionMorphTargetBind({ primitives, index, weight: 1.0 }));
  }

  manager.unregisterExpression(original);
  original.removeFromParent();
  vrm.scene.add(happy);
  manager.registerExpression(happy);
}
