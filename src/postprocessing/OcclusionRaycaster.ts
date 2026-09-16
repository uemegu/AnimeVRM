import * as THREE from 'three';

interface VertexCache {
  positions: Float64Array;
  valid: Uint8Array;
}

/** Reuse skinned vertex positions only within one synchronous occlusion query. */
export class OcclusionRaycaster {
  private caches = new WeakMap<THREE.SkinnedMesh, VertexCache>();

  public intersectObjects(
    raycaster: THREE.Raycaster,
    objects: THREE.Object3D[]
  ): THREE.Intersection[] {
    const restore: Array<() => void> = [];
    const prepared = new Set<THREE.SkinnedMesh>();

    try {
      for (const object of objects) {
        const mesh = object as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh || prepared.has(mesh)) continue;
        prepared.add(mesh);

        const count = mesh.geometry.attributes.position.count;
        let cache = this.caches.get(mesh);
        if (!cache || cache.valid.length !== count) {
          cache = {
            // Float32 would round CPU positions and could change intersection results.
            positions: new Float64Array(count * 3),
            valid: new Uint8Array(count),
          };
          this.caches.set(mesh, cache);
        }
        cache.valid.fill(0);
        const { positions, valid } = cache;
        const original = mesh.getVertexPosition;
        const descriptor = Object.getOwnPropertyDescriptor(mesh, 'getVertexPosition');
        restore.push(() => {
          if (descriptor) Object.defineProperty(mesh, 'getVertexPosition', descriptor);
          else Reflect.deleteProperty(mesh, 'getVertexPosition');
        });
        mesh.getVertexPosition = function (index, target) {
          const offset = index * 3;
          if (valid[index]) return target.fromArray(positions, offset);
          const result = original.call(this, index, target);
          result.toArray(positions, offset);
          valid[index] = 1;
          return result;
        };
      }

      return raycaster.intersectObjects(objects, false);
    } finally {
      // Never leave cached positions active during animation updates or other raycasts.
      for (const reset of restore) reset();
    }
  }
}
