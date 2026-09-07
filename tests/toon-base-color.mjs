import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { MToonMaterial } from '@pixiv/three-vrm';
// Resolve extensionless TypeScript imports using Node's built-in type stripping.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}});
const { applyToonShader } = await import('../src/ToonShader.ts');
const scene = new THREE.Scene();
const originals = [new THREE.Color(.009, .010, .012), new THREE.Color(.78, .77, .74), new THREE.Color(1, 1, 1)];
const materials = originals.map((color, i) => {
  const material = new MToonMaterial();
  material.name = `Backpack_${i}_Cloth`;
  material.color.copy(color);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  return material;
});
const controller = applyToonShader({ scene }, scene, {});
function check(tint) {
  controller.updateMaterialStyle('cloth', { color: tint, shadingToonyFactor: 1 });
  materials.forEach((m, i) => {
    const expected = originals[i].clone().multiply(new THREE.Color(tint));
    assert(m.color.toArray().every((c, k) => Math.abs(c - expected.toArray()[k]) < 1e-7));
    assert.equal(m.shadingToonyFactor, 1);
  });
}
check('#ffffff');
check('#80a0c0');
check('#80a0c0'); // Repeated updates must not progressively darken the material.
check('#ffffff'); // Reset restores each material's own imported color.
console.log('PASS: MToon black/white colors survive neutral tint, tint updates, and reset at 100% toon.');
