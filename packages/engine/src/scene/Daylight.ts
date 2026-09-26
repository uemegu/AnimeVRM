import * as THREE from 'three';

/**
 * Lights every MToon material under `root` with flat daylight: `amount` times its albedo
 * is added to whatever the scene lights give it.
 *
 * three.js lights can't be limited to some objects (Object3D.layers only filters what a
 * camera draws), so passers-by seen through a dark room's window get their sunlight here.
 * Above 1 the color leaves the display range; the composer's half-float target keeps it
 * and bloom blows it out, the way a camera exposed for the room sees the street.
 */
export function setDaylight(root: THREE.Object3D, amount: number): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material as { isMToonMaterial?: boolean }).isMToonMaterial) continue;
      const uniform = material.userData.daylight as { value: number } | undefined;
      if (uniform) uniform.value = amount;
      else if (amount !== 0) patch(material, amount);
    }
  });
}

const LIT_COLOR = 'vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;';

function patch(material: THREE.Material, amount: number): void {
  const uniform = { value: amount };
  material.userData.daylight = uniform;
  const baseCompile = material.onBeforeCompile;
  const baseCacheKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile.call(material, shader, renderer);
    shader.uniforms.uDaylight = uniform;
    shader.fragmentShader = `uniform float uDaylight;\n${shader.fragmentShader.replace(
      LIT_COLOR,
      `${LIT_COLOR}\n  col += diffuseColor.rgb * uDaylight;`
    )}`;
  };
  material.customProgramCacheKey = () => `${baseCacheKey.call(material)},daylight`;
  material.needsUpdate = true;
}
