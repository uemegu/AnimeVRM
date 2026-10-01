import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposePaintedClassroom, loadPaintedClassroom } from '../scene/painted-classroom/PaintedClassroom';
import { disposePaintedGate, loadPaintedGate } from '../scene/painted-gate/PaintedGate';
import { disposePaintedLibrary, loadPaintedLibrary } from '../scene/painted-library/PaintedLibrary';
import { resolveAssetUrl } from '../utils/path';

/** 組み込みの3D背景（builtin:<名前>） */
const BUILTINS: Record<string, { load: () => Promise<THREE.Group>; dispose: (group: THREE.Group) => void }> = {
  'builtin:painted-classroom': { load: loadPaintedClassroom, dispose: disposePaintedClassroom },
  'builtin:painted-library': { load: loadPaintedLibrary, dispose: disposePaintedLibrary },
  'builtin:painted-gate': { load: loadPaintedGate, dispose: disposePaintedGate },
};

/** 場所の3D背景を読み込む。model は builtin:<名前> か glb の URL */
export async function loadEnvironment(model: string): Promise<THREE.Object3D> {
  const builtin = BUILTINS[model];
  if (builtin) return builtin.load();
  const gltf = await new GLTFLoader().loadAsync(resolveAssetUrl(model));
  return gltf.scene;
}

export function disposeEnvironment(model: string, object: THREE.Object3D): void {
  const builtin = BUILTINS[model];
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
export function placeEnvironment(object: THREE.Object3D, placement: { position: { x: number; y: number; z: number }; rotationY: number; scale: number }): void {
  object.position.set(placement.position.x, placement.position.y, placement.position.z);
  object.rotation.set(0, THREE.MathUtils.degToRad(placement.rotationY), 0);
  object.scale.setScalar(placement.scale);
}
