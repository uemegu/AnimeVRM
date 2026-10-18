import * as THREE from 'three';

/**
 * Procedural sea for the painted seaside park. Each fragment intersects its
 * view ray with the water plane, so the geometry (a disc and a wall around it)
 * only decides where the sea is drawn: the water itself reaches the horizon.
 *
 * - Waves: a height field of travelling sines and drifting noise. The backs
 *   of the waves are a cel step darker; detail fades with distance so the far
 *   sea stays calm instead of aliasing. Light ripple lines (thin ridges of
 *   noise stretched across) drift in towards the shore.
 * - Sun path: how likely the ripples hold a facet mirroring the sun (a slope
 *   distribution around the wave's normal) makes a column of glitter under
 *   the sun, with a silvery sheen where it is densest.
 * - Glints: thin wavy lines along the ripples, broken into dashes that drift
 *   and twinkle, lit along the sun path. The ripples grow with distance so
 *   they stay a few pixels on screen. Brighter than white so the stage's
 *   bloom makes them glow.
 *
 * Unlit and not tone mapped, like the paintings. Time comes from the clock on
 * each render (onBeforeRender), so no per-frame hook in the stage is needed.
 */
export type SeaOptions = { level: number; radius: number; sun: readonly [number, number, number] };

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime, uLevel;
  uniform vec3 uSun;
  uniform vec3 uDeep, uMid, uHaze, uRipple, uSheen, uSparkle;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
  }

  // Height of the water (m) at q (world xz). detail fades the small waves out with distance.
  float waves(vec2 q, float detail) {
    float t = uTime;
    float h = 0.0;
    h += 0.06 * sin(dot(q, vec2(0.10, 0.62)) + t * 0.9);
    h += 0.04 * sin(dot(q, vec2(-0.32, 0.81)) + t * 1.3);
    h += 0.03 * sin(dot(q, vec2(0.55, 1.10)) + t * 1.7);
    // Choppy noise drifting in towards the shore, stretched across so it reads as wave rows.
    vec2 n = vec2(q.x * 0.55, q.y * 1.4);
    h += 0.05 * (noise(n + vec2(t * 0.05, t * 0.35)) - 0.5);
    h += detail * 0.035 * (noise(n * 2.3 + vec2(-t * 0.1, t * 0.6)) - 0.5);
    h += detail * 0.018 * (noise(n * 5.1 + vec2(t * 0.2, t * 1.0)) - 0.5);
    return h;
  }

  // Ripple glints at one scale. size: the ripple spacing across (x) and towards the horizon (z), m.
  // Noise stretched across has its mid-level contour as thin wavy lines along the ripples; a second
  // noise drifting the other way breaks them into dashes that appear and fade (the twinkle).
  float rippleGlints(vec2 q, vec2 size, float threshold, float seed) {
    float t = uTime;
    vec2 p = q / size + seed * 17.3;
    float n = noise(p + vec2(t * 0.15, t * 0.9)) * 0.65 + noise(p * 2.1 + vec2(-t * 0.25, t * 1.4)) * 0.35;
    float line = 1.0 - abs(n * 2.0 - 1.0);
    float dash = noise(p * vec2(1.3, 0.7) + vec2(-t * 0.5, t * 0.4) + 9.1);
    float v = line * mix(0.4, 1.0, dash);
    float aa = fwidth(v) + 0.02;
    return smoothstep(threshold - aa, threshold + aa, v);
  }

  // Ripples grow with distance so they stay a few pixels on screen: across with distance, towards
  // the horizon also with the foreshortening (dist / eye). Neighbouring scales are blended so there
  // are no seams where the size steps.
  float glints(vec2 q, float dist, float eye, float density) {
    if (density < 0.01) return 0.0;
    float threshold = 0.93 - 0.3 * density;
    vec2 level = vec2(log2(max(dist / 5.0, 1.0)), log2(max(dist / (eye * 3.0), 1.0)));
    vec2 i = floor(level), w = fract(level);
    vec2 base = vec2(0.35, 0.07);
    float g00 = rippleGlints(q, base * exp2(vec2(i.x, i.x + i.y)), threshold, i.x + i.y * 5.0);
    float g10 = rippleGlints(q, base * exp2(vec2(i.x + 1.0, i.x + 1.0 + i.y)), threshold, i.x + 1.0 + i.y * 5.0);
    float g01 = rippleGlints(q, base * exp2(vec2(i.x, i.x + i.y + 1.0)), threshold, i.x + (i.y + 1.0) * 5.0);
    float g11 = rippleGlints(q, base * exp2(vec2(i.x + 1.0, i.x + i.y + 2.0)), threshold, i.x + 1.0 + (i.y + 1.0) * 5.0);
    return mix(mix(g00, g10, w.x), mix(g01, g11, w.x), w.y) * smoothstep(0.0, 0.25, density);
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    // Rays at or above the horizon never meet the water: the sky behind shows.
    if (dir.y > -0.0005) discard;
    float dist = (uLevel - cameraPosition.y) / dir.y;
    if (dist <= 0.0) discard;
    vec3 p = cameraPosition + dir * dist;
    vec2 q = p.xz;

    float detail = 1.0 - smoothstep(12.0, 70.0, dist);
    float e = 0.04 + dist * 0.004;
    float h = waves(q, detail);
    vec3 normal = normalize(vec3(-(waves(q + vec2(e, 0.0), detail) - h) / e, 1.0, -(waves(q + vec2(0.0, e), detail) - h) / e));
    // Far away the slopes are seen edge-on; flatten them so the far sea reads as smooth bands.
    normal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), smoothstep(25.0, 85.0, dist) * 0.7));

    // Base colour: deeper nearby, lighter towards the horizon.
    float far = smoothstep(4.0, 80.0, dist);
    vec3 color = mix(uDeep, uMid, far);
    // Cel shade from the slope: the backs of the waves (turned away from the viewer) a step darker.
    float back = dot(normal, normalize(vec3(-dir.x, 0.0, -dir.z)));
    color = mix(color, uDeep * 0.82, smoothstep(-0.01, 0.01, -back - 0.02) * 0.4 * detail);
    // Light ripple lines: ridges of noise stretched across, broken up so they read as short wave crests.
    vec2 r = vec2(q.x * 0.22, q.y * 1.5);
    float wave = noise(r + vec2(uTime * 0.03, uTime * 0.45)) * 0.7 + noise(r * 2.3 + vec2(-uTime * 0.05, uTime * 0.7)) * 0.3;
    float ridge = 1.0 - abs(wave * 2.0 - 1.0);
    float width = fwidth(ridge) * 1.5;
    float crest = smoothstep(0.9 - width, 0.93 + width, ridge) * smoothstep(0.35, 0.65, noise(q * vec2(0.18, 0.5) + uTime * 0.02));
    color = mix(color, uRipple, crest * 0.7 * (1.0 - far * 0.5));
    // Haze at the horizon.
    float grazing = -dir.y;
    color = mix(color, uHaze, exp(-grazing * 28.0) * 0.85);

    // Sun path. mirror is the facet normal that would reflect the sun into the eye; how far it leans
    // from the wave's normal says how likely the ripples on that wave hold such a facet (a slope
    // distribution, wider across than along, so the column of glitter under the sun is broad).
    vec3 up = normalize(mix(normal, vec3(0.0, 1.0, 0.0), 0.4));
    vec3 side = normalize(cross(up, vec3(0.0, 0.0, 1.0)));
    vec3 mirror = normalize(uSun - dir);
    float cosLean = max(dot(mirror, up), 0.05);
    vec2 lean = vec2(dot(mirror, side), dot(mirror, cross(side, up))) / cosLean;
    float density = exp(-dot(lean * lean, vec2(1.0 / 0.2, 1.0 / 0.08)));
    // A soft silvery sheen where the glitter is densest.
    color = mix(color, uSheen, exp(-dot(lean * lean, vec2(1.0 / 0.05, 1.0 / 0.02))) * 0.55 + density * 0.15);

    // Glints: thin lines along the ripples, broken into dashes that come and go, lit where the sun
    // path is dense (more and longer dashes towards its centre). Brighter than white for the bloom.
    float eye = max(cameraPosition.y - uLevel, 0.5);
    float sparkle = glints(q, dist, eye, density);
    color = mix(color, uSparkle, clamp(sparkle * 1.3, 0.0, 1.0));
    color += uSparkle * sparkle * 0.9;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSea({ level, radius, sun }: SeaOptions): THREE.Group {
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: level },
      uSun: { value: new THREE.Vector3(...sun).normalize() },
      uDeep: { value: new THREE.Color('#1f6fae') },
      uMid: { value: new THREE.Color('#3f97cf') },
      uHaze: { value: new THREE.Color('#bfe3f2') },
      uRipple: { value: new THREE.Color('#b4e4f7') },
      uSheen: { value: new THREE.Color('#d9f2fb') },
      uSparkle: { value: new THREE.Color('#ffffff') },
    },
    vertexShader,
    fragmentShader,
  });
  material.name = 'Sea';
  const clock = new THREE.Clock();
  const tick = () => { material.uniforms.uTime.value = clock.getElapsedTime(); };

  const group = new THREE.Group();
  group.name = 'Sea';
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), material);
  disc.name = 'Sea | water';
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = level;
  disc.onBeforeRender = tick;
  // Rays that pass over the disc's rim still meet the water further out: a wall catches them.
  const wallHeight = 60;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, wallHeight, 64, 1, true), material);
  wall.name = 'Sea | horizon';
  wall.position.y = level + wallHeight / 2;
  wall.onBeforeRender = tick;
  group.add(disc, wall);
  return group;
}
