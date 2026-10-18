import * as THREE from 'three';
import { festivalUniforms } from './lights';
import { FAR_BANK, MOON_DIRECTION } from './layout';
import type { Fireworks } from './Fireworks';

/**
 * The river at night. Each fragment intersects its view ray with the water
 * plane, bends a reflected ray by the ripples and looks it up in what is
 * actually there: the far bank painting (its lit windows and lantern rows
 * become long wavering streaks, as in the reference picture), the night sky,
 * the moon and the fireworks bursting overhead. The ripples tilt much more
 * across the river than along it, which stretches the reflections downwards.
 *
 * Unlit and not tone mapped; brightest bits go above 1 for the bloom.
 */
export type RiverOptions = { level: number; nearZ: number; farZ: number; minX: number; maxX: number; farBank: THREE.Texture; fireworks: Fireworks };

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  #define MAX_BURSTS 8
  uniform float uTime, uLevel;
  uniform sampler2D uBank;
  uniform vec4 uBankRect; // z, bottom y, height, repeat width
  uniform float uBankMinX;
  uniform vec3 uMoon, uFlash;
  uniform vec4 uBursts[MAX_BURSTS]; // xyz centre, w brightness
  uniform vec3 uBurstColors[MAX_BURSTS];
  uniform vec3 uDeep, uSky, uSkyHigh;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
  }
  // Ripple height: rows across the river drifting downstream (+x), finer on top.
  float ripples(vec2 q, float detail) {
    float t = uTime;
    vec2 p = vec2(q.x * 0.35 - t * 0.25, q.y * 2.2);
    float h = noise(p) * 0.6 + noise(p * 2.3 + vec2(-t * 0.4, t * 0.3)) * 0.3;
    h += detail * noise(p * 5.1 + vec2(t * 0.6, -t * 0.5)) * 0.15;
    return h * 0.06;
  }

  vec3 sky(vec3 r) {
    return mix(uSky, uSkyHigh, smoothstep(0.0, 0.5, r.y)) + uFlash * 0.25;
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    if (dir.y > -0.0005) discard;
    float dist = (uLevel - cameraPosition.y) / dir.y;
    vec3 p = cameraPosition + dir * dist;
    vec2 q = p.xz;

    float detail = 1.0 - smoothstep(8.0, 40.0, dist);
    float e = 0.03 + dist * 0.003;
    float h = ripples(q, detail);
    vec2 slope = vec2(ripples(q + vec2(e, 0.0), detail) - h, ripples(q + vec2(0.0, e), detail) - h) / e;
    // Tilt across the river (z) much more than along it: reflections stretch into vertical streaks.
    vec3 normal = normalize(vec3(-slope.x * 0.6, 1.0, -slope.y * 3.2));
    vec3 r = reflect(dir, normal);
    r.y = abs(r.y);

    // Darker water close by (looking down into it), more reflective at grazing angles.
    float fresnel = 0.25 + 0.75 * pow(1.0 - max(-dir.y, 0.0), 5.0);
    vec3 color = uDeep;
    vec3 reflection = sky(r);

    // Far bank painting: intersect the reflected ray with its plane.
    float s = (uBankRect.x - p.z) / r.z;
    if (r.z < 0.0 && s > 0.0) {
      vec3 b = p + r * s;
      float v = (b.y - uBankRect.y) / uBankRect.z;
      if (v >= 0.0 && v <= 1.0) {
        vec2 uv = vec2((b.x - uBankMinX) / uBankRect.w, v);
        // A few taps along the streak soften it.
        vec4 bank = vec4(0.0);
        for (int i = 0; i < 4; i++) bank += texture2D(uBank, uv + vec2(0.0, float(i) * 0.006));
        bank *= 0.25;
        // Bright lights carry over the dark water; the dark buildings mostly don't.
        float lum = dot(bank.rgb, vec3(0.299, 0.587, 0.114));
        reflection = mix(reflection, bank.rgb * (0.6 + 1.6 * smoothstep(0.25, 0.7, lum)), bank.a);
      }
    }
    // Light streaks: under each light of the far bank, a vertical streak broken into ripples all the
    // way to the near shore (the anime look of the reference picture, more than real reflection would give).
    // Follow the line from the eye through this point out to the bank, so the streaks are vertical on screen.
    float toBank = (uBankRect.x - cameraPosition.z) / (p.z - cameraPosition.z);
    float bankX = cameraPosition.x + (p.x - cameraPosition.x) * toBank;
    float wobble = (noise(q * vec2(0.5, 1.6) + vec2(-uTime * 0.3, uTime * 0.1)) - 0.5) * 0.9;
    float u = (bankX + wobble - uBankMinX) / uBankRect.w;
    vec3 lights = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      vec4 c = texture2D(uBank, vec2(u, 0.07 + float(i) * 0.045));
      lights += c.rgb * c.a * smoothstep(0.35, 0.75, dot(c.rgb, vec3(0.299, 0.587, 0.114)));
    }
    lights /= 6.0;
    float dashes = smoothstep(0.4, 0.7, noise(q * vec2(0.7, 4.5) + vec2(-uTime * 0.5, uTime * 0.1))) * mix(0.6, 1.0, detail);
    float reach = mix(0.45, 1.0, smoothstep(uBankRect.x + 30.0, uBankRect.x, p.z));
    vec3 streaks = lights * dashes * reach * 1.9;
    // Moon glint.
    float moon = pow(max(dot(r, uMoon), 0.0), 900.0);
    reflection += vec3(0.85, 0.9, 1.0) * moon * 1.5;
    // Fireworks: soft glow around each burst's reflection.
    for (int i = 0; i < MAX_BURSTS; i++) {
      if (uBursts[i].w <= 0.0) continue;
      vec3 toBurst = normalize(uBursts[i].xyz - p);
      float a = max(dot(r, toBurst), 0.0);
      reflection += uBurstColors[i] * uBursts[i].w * (pow(a, 300.0) * 1.6 + pow(a, 25.0) * 0.12);
    }
    color = mix(color, reflection, fresnel) + streaks;
    // Small sparkle on ripple crests from all the lights around.
    float crest = smoothstep(0.82, 0.95, noise(q * vec2(1.2, 6.0) + vec2(-uTime * 0.6, 0.0))) * detail;
    color += (vec3(1.0, 0.72, 0.4) * 0.08 + uFlash * 0.3) * crest;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createRiver({ level, nearZ, farZ, minX, maxX, farBank, fireworks }: RiverOptions): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTime: festivalUniforms.uTime,
      uFlash: festivalUniforms.uFlash,
      uLevel: { value: level },
      uBank: { value: farBank },
      uBankRect: { value: new THREE.Vector4(FAR_BANK.z, FAR_BANK.bottom, 0, FAR_BANK.repeat) },
      uBankMinX: { value: FAR_BANK.minX },
      uMoon: { value: new THREE.Vector3(...MOON_DIRECTION).normalize() },
      uBursts: fireworks.uniforms.uBursts,
      uBurstColors: fireworks.uniforms.uBurstColors,
      uDeep: { value: new THREE.Color('#0d0a28') },
      uSky: { value: new THREE.Color('#1c2350') },
      uSkyHigh: { value: new THREE.Color('#0b1030') },
    },
    vertexShader,
    fragmentShader,
  });
  const image = farBank.image as { width: number; height: number };
  material.uniforms.uBankRect.value.z = FAR_BANK.repeat * image.height / image.width;
  material.name = 'River';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, nearZ - farZ), material);
  mesh.name = 'River';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, level, (nearZ + farZ) / 2);
  return mesh;
}
