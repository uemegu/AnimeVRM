import * as THREE from 'three';
import type { Fireworks } from './Fireworks';
import { festivalUniforms } from './lights';
import { MOON_DIRECTION, SKY_RADIUS } from './layout';

/**
 * The night sky of the festival, drawn by the set itself (not the stage's
 * time-of-day sky) so the place is always a festival night: a deep blue
 * gradient warmed by the town's glow at the horizon, stars, a moon, and thin
 * smoke that the fireworks light up.
 */
export function nightSky(fireworks: Fireworks): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: festivalUniforms.uTime,
      uSmoke: fireworks.smoke,
      uSmokeStrength: { value: 0 },
      uSmokeLifetime: { value: 10 },
      uEye: { value: new THREE.Vector3() },
      uFlash: festivalUniforms.uFlash,
      uMoon: { value: new THREE.Vector3(...MOON_DIRECTION).normalize() },
      uZenith: { value: new THREE.Color('#060a22') },
      uMid: { value: new THREE.Color('#0c1436') },
      uHorizon: { value: new THREE.Color('#292640') },
      uGlow: { value: new THREE.Color('#7a4a52') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSmokeStrength, uSmokeLifetime;
      uniform vec4 uSmoke[24];
      uniform vec3 uEye;
      uniform vec3 uFlash, uMoon, uZenith, uMid, uHorizon, uGlow;
      varying vec3 vDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float n = 0.0, weight = 0.5;
        mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          n += weight * noise(p);
          p = turn * p * 2.03 + vec2(17.2, 9.1);
          weight *= 0.5;
        }
        return n;
      }
      void main() {
        vec3 d = normalize(vDirection);
        float up = max(d.y, 0.0);
        vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.18, up));
        sky = mix(sky, uZenith, smoothstep(0.18, 0.7, up));
        // The town's warm glow low over the horizon.
        sky += uGlow * exp(-up * 14.0) * 0.5;
        // Stars, fewer near the horizon glow.
        vec2 sp = vec2(atan(d.z, d.x) * 120.0, up * 260.0);
        vec2 cell = floor(sp);
        float star = step(0.985, hash(cell)) * smoothstep(0.4, 0.0, length(fract(sp) - 0.5));
        star *= (0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 3.1) * 40.0)) * smoothstep(0.12, 0.4, up);
        sky += vec3(0.85, 0.88, 1.0) * star * 0.9;
        // Moon with a soft halo.
        float m = dot(d, uMoon);
        sky += vec3(1.0, 0.97, 0.88) * smoothstep(0.99975, 0.99982, m) * 1.6;
        sky += vec3(0.4, 0.45, 0.7) * pow(max(m, 0.0), 2000.0) * 0.3;
        // Residual smoke is tied to each burst in world space. It expands and drifts,
        // stays faintly moonlit, then catches the colour of subsequent fireworks.
        if (uSmokeStrength > 0.0) {
          float density = 0.0;
          vec2 cloudUv = d.xz / max(d.y + 0.35, 0.15) * 10.0;
          float cloud = fbm(cloudUv + vec2(-uTime * 0.025, uTime * 0.009));
          for (int i = 0; i < 24; i++) {
            float age = uTime - uSmoke[i].w;
            if (age <= 0.0 || age >= uSmokeLifetime) continue;
            vec3 centre = uSmoke[i].xyz + vec3(age * 0.38, age * 0.16, 0.0) - uEye;
            float distanceToSmoke = max(length(centre), 1.0);
            float radius = (2.0 + 6.0 * (1.0 - exp(-age * 0.8)) + age * 0.25) / distanceToSmoke;
            float r = length(d - centre / distanceToSmoke) / radius;
            float envelope = exp(-r * r * 2.4) * smoothstep(0.0, 0.9, age)
              * (1.0 - smoothstep(uSmokeLifetime * 0.25, uSmokeLifetime, age));
            density += envelope * smoothstep(0.22, 0.75, cloud);
          }
          density = min(density * uSmokeStrength, 0.65);
          sky *= 1.0 - density * 0.3;
          sky += (vec3(0.055, 0.065, 0.105) + uFlash * 2.8) * density;
        }
        gl_FragColor = vec4(sky, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = 'Night sky';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), material);
  mesh.name = 'Night sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  // Keep the dome around the camera: centred on the set, its far side would fall past the
  // viewer's draw distance (100 m) when the camera stands near the river looking inland.
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const local = mesh.parent ? mesh.parent.worldToLocal(camera.getWorldPosition(new THREE.Vector3())) : camera.position.clone();
    material.uniforms.uEye.value.copy(local);
    mesh.position.copy(local);
    mesh.updateMatrix();
    mesh.matrixWorld.multiplyMatrices(mesh.parent?.matrixWorld ?? new THREE.Matrix4(), mesh.matrix);
  };
  return mesh;
}
