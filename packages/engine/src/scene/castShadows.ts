import * as THREE from 'three';

/**
 * 地面に影を落とす小物の目印（castShadow）を付ける。影は StageManager が場所を置いたときに一度だけ描く。
 * 絵に日差しが描き込まれた建物には付けない（通りが大きく暗くなり、絵と食い違う）
 */
export function castShadows<T extends THREE.Object3D>(object: T): T {
  object.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
  return object;
}

/** parent にじかに部品を足す関数を呼び、足された物に影の目印を付ける */
export function castShadowsOfAdded(parent: THREE.Object3D, add: () => void): void {
  const before = new Set(parent.children);
  add();
  for (const child of parent.children) if (!before.has(child)) castShadows(child);
}
