import * as THREE from 'three';
import type { LocationEnvironment } from '@anime-vrm/scenario';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveAssetUrl } from '../utils/path';

export interface BuiltinEnvironment {
  load: () => Promise<THREE.Group>;
  dispose: (group: THREE.Group) => void;
}

/** 組み込みの3D背景（builtin:<名前>）。中身は利用側が registerEnvironment で登録する（AnimeVRM のセットは @anime-vrm/content） */
const BUILTINS = new Map<string, BuiltinEnvironment>();

export function registerEnvironment(name: string, environment: BuiltinEnvironment): void {
  BUILTINS.set(`builtin:${name}`, environment);
}

/** 場所の3D背景を読み込む。model は builtin:<名前> か glb の URL */
export async function loadEnvironment(model: string): Promise<THREE.Object3D> {
  const builtin = BUILTINS.get(model);
  if (builtin) return builtin.load();
  if (model.startsWith('builtin:')) throw new Error(`登録されていない3D背景: ${model}`);
  const gltf = await new GLTFLoader().loadAsync(resolveAssetUrl(model));
  return gltf.scene;
}

export function disposeEnvironment(model: string, object: THREE.Object3D): void {
  const builtin = BUILTINS.get(model);
  if (builtin) {
    builtin.dispose(object as THREE.Group);
    return;
  }
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
}

/** 位置・向き（度）・大きさを当てる */
export function placeEnvironment(object: THREE.Object3D, placement: LocationEnvironment): void {
  object.position.set(placement.position.x, placement.position.y, placement.position.z);
  object.rotation.set(0, THREE.MathUtils.degToRad(placement.rotationY), 0);
  object.scale.setScalar(placement.scale);
  object.userData.configureEnvironment?.(placement);
}
