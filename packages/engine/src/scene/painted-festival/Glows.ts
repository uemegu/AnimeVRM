import * as THREE from 'three';
import { BANNER, EDGE_Z, JUNCTION_Z, STREET_HALF } from './layout';
import { festivalUniforms } from './lights';

/**
 * The air of the festival: a soft glow around every light (lanterns, andons,
 * bulbs) that the bloom then spreads, and out-of-focus light orbs (bokeh)
 * drifting in the street, as anime films do for a night of lanterns.
 * Both are additive points sized in metres.
 */
const vertexShader = /* glsl */ `
  uniform float uTime, uScale;
  attribute vec3 color;
  attribute vec2 aSize; // size (m), seed
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec3 p = position;
    #ifdef BOKEH
    // Drift slowly and breathe.
    p += vec3(sin(uTime * 0.21 + aSize.y * 30.0), sin(uTime * 0.17 + aSize.y * 51.0) * 0.6, cos(uTime * 0.19 + aSize.y * 17.0)) * 0.25;
    vColor = color * (0.55 + 0.45 * sin(uTime * 0.8 + aSize.y * 40.0));
    #else
    vColor = color * (0.92 + 0.08 * sin(uTime * 7.0 + aSize.y * 40.0));
    #endif
    vSeed = aSize.y;
    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize.x * uScale / max(-mv.z, 0.05);
    #ifdef BOKEH
    // Orbs right in front of the lens would fill the screen: keep them small and fade them out.
    vColor *= smoothstep(1.2, 2.5, -mv.z);
    gl_PointSize = min(gl_PointSize, 70.0 * uScale / 500.0);
    #endif
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    if (r > 1.0) discard;
    #ifdef BOKEH
    // A lens bokeh disc: flat inside, a slightly brighter rim, soft edge.
    float disc = smoothstep(1.0, 0.86, r) * (0.55 + 0.45 * smoothstep(0.55, 0.92, r));
    gl_FragColor = vec4(vColor * disc, 1.0);
    #else
    float glow = exp(-r * r * 5.0) + 0.25 * exp(-r * r * 1.5);
    gl_FragColor = vec4(vColor * glow * (1.0 - r), 1.0);
    #endif
    #include <colorspace_fragment>
  }
`;

function pointsMaterial(bokeh: boolean): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    defines: bokeh ? { BOKEH: '' } : {},
    uniforms: { uTime: festivalUniforms.uTime, uScale: { value: 500 } },
    vertexShader,
    fragmentShader,
  });
  material.name = bokeh ? 'Bokeh' : 'Light glows';
  return material;
}

function points(name: string, material: THREE.ShaderMaterial, entries: { position: THREE.Vector3; color: THREE.Color; size: number }[]): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(entries.flatMap((e) => e.position.toArray()), 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(entries.flatMap((e) => e.color.toArray()), 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(entries.flatMap((e, i) => [e.size, (i * 0.618034) % 1]), 2));
  const object = new THREE.Points(geometry, material);
  object.name = name;
  object.frustumCulled = false;
  const size = new THREE.Vector2();
  object.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(size);
    material.uniforms.uScale.value = size.y * (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] / 2;
  };
  return object;
}

export class Glows {
  readonly halos: THREE.Points;
  readonly bokeh: THREE.Points;

  /** `set` must have its world matrices up to date: the lights are found by name. */
  constructor(set: THREE.Object3D) {
    const halos: { position: THREE.Vector3; color: THREE.Color; size: number }[] = [];
    const inverse = new THREE.Matrix4().copy(set.matrixWorld).invert();
    const local = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    set.traverse((object) => {
      if (object.name === 'Stall lantern') halos.push({ position: local(object), color: new THREE.Color('#ff5530').multiplyScalar(0.55), size: 1.1 });
      if (object.name === 'Bulb') halos.push({ position: local(object), color: new THREE.Color('#ffc070').multiplyScalar(0.5), size: 0.7 });
      if (object.name === 'Andon') halos.push({ position: local(object), color: new THREE.Color('#ffb060').multiplyScalar(0.55), size: 1.3 });
      if (object instanceof THREE.InstancedMesh && object.name === 'Lanterns') {
        const matrix = new THREE.Matrix4(), color = new THREE.Color();
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix);
          object.getColorAt(i, color);
          halos.push({ position: new THREE.Vector3().setFromMatrixPosition(matrix), color: color.clone().multiplyScalar(0.3), size: 0.9 });
        }
      }
    });
    // The lantern hanging from the banner pole (painted).
    halos.push({ position: new THREE.Vector3(BANNER.x + 0.35, BANNER.height * 0.8, BANNER.z - 0.1), color: new THREE.Color('#ffa850').multiplyScalar(0.6), size: 1.4 });
    this.halos = points('Light glows', pointsMaterial(false), halos);

    // Bokeh: a scatter of warm orbs along the street, denser near the stalls.
    const bokeh: { position: THREE.Vector3; color: THREE.Color; size: number }[] = [];
    const tints = ['#ffb35c', '#ff7a4a', '#ffd38a', '#ff8fb0', '#ffe2a8'].map((c) => new THREE.Color(c));
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      // Two thirds in the street, the rest along the promenade.
      const street = i % 3 !== 0;
      bokeh.push({
        position: street
          ? new THREE.Vector3(side * STREET_HALF * (0.35 + rnd() * 0.75), 0.6 + rnd() * 3.2, JUNCTION_Z + rnd() * 15)
          : new THREE.Vector3(side * rnd() * 16, 0.6 + rnd() * 3.2, THREE.MathUtils.lerp(JUNCTION_Z, EDGE_Z, rnd())),
        color: tints[i % tints.length].clone().multiplyScalar(0.07 + rnd() * 0.08),
        size: 0.12 + rnd() * 0.22,
      });
    }
    this.bokeh = points('Bokeh', pointsMaterial(true), bokeh);
    this.bokeh.renderOrder = 10;
  }
}
