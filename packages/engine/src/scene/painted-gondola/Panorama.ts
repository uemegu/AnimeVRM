import * as THREE from 'three';
import { GROUND_Y, PANORAMA } from './layout';

/**
 * The view from the gondola: a painted 360-degree panorama (amusement park, bay and the
 * town, sky cut out) on a cylinder around the set, and the park seen straight down on a
 * disc at the ground. The sky behind is the viewer's SkyBackground.
 *
 * The panorama is four 90-degree tiles (pano-0..3: front, right, back, left), each a
 * 2:1 cylindrical projection with the horizon HORIZON_ROW from the top; a pixel is the
 * same size horizontally and vertically, so the cylinder height follows from its width.
 *
 * The open water is not the painting: the bays (sea-mask.avif, from
 * scripts/painted-gondola/sea-mask.py) are redrawn per pixel as a water plane at the
 * ground, so the ripples stay sharp at any resolution and move. The water mirrors the
 * painting itself about the far shore's waterline, broken up by the ripples, and carries the
 * sun's glitter path. The painted lights are lifted above the bloom threshold so they glow.
 */
export const HORIZON_ROW = 248 / 1024;
/** The ground tile covers this many metres. */
const GROUND_TILE = 60;
/** Painted lights are multiplied up to this much over the bloom threshold. */
const LIGHT_GLOW = 1.6;
/** The low sun over the bay, where the painting has its path of light (heading, elevation, degrees). */
const SUN = { heading: 5, elevation: 1.2 };

const R = PANORAMA.radius;
const BAND_WIDTH = R * Math.PI / 2;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uPano0, uPano1, uPano2, uPano3, uMask;
  uniform float uTile, uTime, uPix, uTop, uHeight;
  uniform vec3 uEye;
  uniform vec2 uSun;
  varying vec2 vUv;
  varying vec3 vLocal;

  #define PI 3.14159265
  const float RADIUS = ${R.toFixed(3)};
  const float HORIZON_Y = ${PANORAMA.horizonY.toFixed(3)};
  const float GROUND = ${GROUND_Y.toFixed(3)};
  const float HORIZON_ROW = ${(HORIZON_ROW * 1024).toFixed(1)};
  const float GLOW = ${LIGHT_GLOW.toFixed(2)};

  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + 1.0), f.x), f.y);
  }

  /**
   * The panorama strip at (u 0-1 round from heading -45 degrees, v 0-1 bottom to top).
   * The mip level comes from the unwrapped coordinates, so the seams between tiles
   * (where u jumps back to 0) do not drop to the smallest mip and show as dotted lines.
   */
  vec4 pano(vec2 s) {
    vec2 g = vec2(s.x * 4.0, s.y);
    vec2 dx = dFdx(g), dy = dFdy(g);
    float u = fract(s.x) * 4.0;
    vec2 uv = vec2(fract(u), clamp(s.y, 0.0, 1.0));
    if (u < 1.0) return textureGrad(uPano0, uv, dx, dy);
    if (u < 2.0) return textureGrad(uPano1, uv, dx, dy);
    if (u < 3.0) return textureGrad(uPano2, uv, dx, dy);
    return textureGrad(uPano3, uv, dx, dy);
  }
  vec2 stripAt(float heading, float elevation) {
    return vec2((heading + PI * 0.25) / (2.0 * PI), (HORIZON_Y + RADIUS * tan(elevation) - (uTop - uHeight)) / uHeight);
  }
  /** Painted lights (bright and warm) lifted over the bloom threshold. */
  vec3 glow(vec3 c) {
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float warm = smoothstep(0.0, 0.25, c.r - c.b);
    return c * (1.0 + GLOW * smoothstep(0.30, 0.75, luma) * warm);
  }
  /** Sky for the reflections where the painting is cut out: warm towards the sun. */
  vec3 skyTone(float heading, float elevation) {
    float toSun = pow(max(cos(heading - uSun.x), 0.0), 60.0) * 0.8;
    vec3 low = mix(srgb(vec3(0.42, 0.46, 0.80)), srgb(vec3(0.86, 0.62, 0.50)), toSun);
    return mix(low, srgb(vec3(0.45, 0.50, 0.86)), smoothstep(0.0, 0.5, elevation));
  }

  void main() {
    vec2 strip = vec2((uTile + vUv.x) * 0.25, vUv.y);
    vec4 painted = uTile < 0.5 ? texture2D(uPano0, vUv) : uTile < 1.5 ? texture2D(uPano1, vUv)
      : uTile < 2.5 ? texture2D(uPano2, vUv) : texture2D(uPano3, vUv);
    vec4 col = vec4(glow(painted.rgb), painted.a);
    vec3 mask = texture2D(uMask, strip).rgb;
    vec3 rd = normalize(vLocal - uEye);
    if (mask.r > 0.0 && rd.y < 0.0) {
      // Where this pixel's ray meets the water plane, and how much water one pixel covers.
      float t = (uEye.y - GROUND) / -rd.y;
      vec2 q = uEye.xz + rd.xz * t;
      float stretch = t * uPix / max(-rd.y, 0.004);
      // Ripples, long across the view as in the painting, fading out below a pixel.
      vec2 grad = vec2(0.0);
      float wl = 2.0;
      for (int i = 0; i < 6; i++) {
        float fade = 1.0 - smoothstep(0.35, 1.0, stretch / wl);
        vec2 p = q / wl * vec2(0.5, 1.0) + vec2(uTime * 0.04, uTime * 0.10) + float(i) * 7.3;
        float n0 = noise2(p);
        grad += vec2((noise2(p + vec2(0.05, 0.0)) - n0) * 0.3, noise2(p + vec2(0.0, 0.05)) - n0) / 0.05 * 0.07 * fade;
        wl *= 2.2;
      }
      vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
      vec3 r = reflect(rd, n);
      float re = asin(clamp(r.y, 0.0, 1.0));
      float rh = atan(r.x, -r.z);
      // Mirror the painting about the far shore's waterline in this column.
      float shoreY = uTop - uHeight * (HORIZON_ROW + mask.g * 255.0) / 1024.0;
      float shoreE = atan(shoreY - HORIZON_Y, RADIUS);
      vec4 mirrored = pano(stripAt(rh, 2.0 * shoreE + re));
      vec3 reflection = mix(skyTone(rh, re), glow(mirrored.rgb), mirrored.a);
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      vec3 water = mix(srgb(vec3(0.27, 0.31, 0.60)), reflection, clamp(fresnel, 0.0, 0.7));
      // The sun's glitter path.
      // Narrow across, long down the water: where a ripple tilts the reflection onto the sun.
      float across = (rh - uSun.x) / 0.025, along = (re - uSun.y) / 0.06;
      float path = exp(-across * across - along * along);
      water += srgb(vec3(1.0, 0.66, 0.30)) * (path * 2.5 + exp(-across * across * 0.15 - along * along * 0.3) * 0.12);
      col = mix(col, vec4(water, 1.0), mask.r);
    }
    gl_FragColor = col;
    #include <colorspace_fragment>
  }
`;

/** One 90-degree band, heading 0 = -z, turning right (+x) as `tile` increases. */
function band(tile: number, material: THREE.ShaderMaterial, height: number, top: number): THREE.Mesh {
  const segments = 48;
  const positions: number[] = [], uvs: number[] = [], index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const heading = (tile - 0.5 + u) * Math.PI / 2;
    const x = R * Math.sin(heading), z = -R * Math.cos(heading);
    positions.push(x, top, z, x, top - height, z);
    uvs.push(u, 1, u, 0);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `Panorama ${tile}`;
  // Drawn first among the set, right over the sky.
  mesh.renderOrder = -10;
  return mesh;
}

export function buildPanorama(tiles: THREE.Texture[], ground: THREE.Texture, mask: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Panorama';
  const image = tiles[0].image as { width: number; height: number };
  const height = BAND_WIDTH * image.height / image.width;
  const top = PANORAMA.horizonY + height * HORIZON_ROW;
  for (const map of tiles) map.wrapS = THREE.ClampToEdgeWrapping;
  mask.wrapS = THREE.RepeatWrapping;
  // Shared by the four bands; only the tile index differs.
  const shared = {
    uPano0: { value: tiles[0] }, uPano1: { value: tiles[1] }, uPano2: { value: tiles[2] }, uPano3: { value: tiles[3] },
    uMask: { value: mask },
    uTime: { value: 0 },
    uPix: { value: 0.001 },
    uTop: { value: top },
    uHeight: { value: height },
    uEye: { value: new THREE.Vector3(0, PANORAMA.horizonY, 0) },
    uSun: { value: new THREE.Vector2(THREE.MathUtils.degToRad(SUN.heading), THREE.MathUtils.degToRad(SUN.elevation)) },
  };
  const start = performance.now();
  const size = new THREE.Vector2();
  tiles.forEach((_, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, uTile: { value: i } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    material.name = `Panorama ${i}`;
    material.userData.cel = false;
    const mesh = band(i, material, height, top);
    // The eye, the time and the pixel size, once per frame (the first band drawn sets them for all).
    mesh.onBeforeRender = (renderer, _scene, camera) => {
      shared.uEye.value.setFromMatrixPosition(camera.matrixWorld);
      mesh.worldToLocal(shared.uEye.value);
      shared.uTime.value = (performance.now() - start) / 1000;
      const target = renderer.getRenderTarget();
      const pixels = target ? target.height : renderer.getDrawingBufferSize(size).y;
      if (camera instanceof THREE.PerspectiveCamera) {
        shared.uPix.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom / pixels;
      }
    };
    group.add(mesh);
  });

  ground.wrapS = ground.wrapT = THREE.RepeatWrapping;
  ground.repeat.set(2 * R / GROUND_TILE, 2 * R / GROUND_TILE);
  const material = new THREE.MeshBasicMaterial({ map: ground, toneMapped: false, fog: false });
  material.userData.cel = false;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), material);
  disc.name = 'Park below';
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = GROUND_Y;
  // CircleGeometry UVs span 0-1 across the diameter.
  group.add(disc);
  return group;
}
