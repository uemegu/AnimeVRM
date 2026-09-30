import * as THREE from 'three';
import { VRM, VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm';

/** シェイプキーを組み合わせて作る表情（VRM に元からない表情） */
const SHAPE_KEY_EXPRESSIONS: Record<string, { shapeKey: string; weight: number }[]> = {
  // ニマニマ：困り眉に笑った口
  nima: [
    { shapeKey: 'Fcl_BRW_Sorrow', weight: 1.0 },
    { shapeKey: 'Fcl_MTH_Fun', weight: 1.0 },
  ],
};

/**
 * SHAPE_KEY_EXPRESSIONS の表情を VRM に登録し、setExpression の名前で使えるようにする。
 * シェイプキーがそろっていないモデルでは、その表情は登録しない
 */
export function registerShapeKeyExpressions(vrm: VRM): void {
  const manager = vrm.expressionManager;
  if (!manager) return;

  for (const [name, keys] of Object.entries(SHAPE_KEY_EXPRESSIONS)) {
    if (manager.getExpression(name)) continue;
    const binds = keys.map(({ shapeKey, weight }) => {
      const primitives: THREE.Mesh[] = [];
      let index = -1;
      vrm.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const found = mesh.isMesh ? mesh.morphTargetDictionary?.[shapeKey] : undefined;
        if (found === undefined) return;
        index = found;
        primitives.push(mesh);
      });
      return primitives.length > 0 ? new VRMExpressionMorphTargetBind({ primitives, index, weight }) : null;
    });
    if (binds.some((bind) => !bind)) continue;

    const expression = new VRMExpression(name);
    binds.forEach((bind) => expression.addBind(bind!));
    vrm.scene.add(expression);
    manager.registerExpression(expression);
  }
}
