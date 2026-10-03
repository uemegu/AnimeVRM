import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STALL, STALL_BANDS, STALL_COLORS, STALLS, type StallKind } from './layout';
import { festivalUniforms } from './lights';

/**
 * Food stalls. Each is real geometry (posts, a striped canvas roof, side
 * cloths, a counter, the back wall) so it holds its shape from any angle; the
 * painting of its front (a straight-on elevation, see layout.ts) is cut into
 * three bands: the signboard, the lit interior on the back wall and the
 * counter front. Everything is unlit (the lighting is painted in); the
 * firework flash tints the outside surfaces (lights.ts).
 */

const { width: W, depth: D, height: H } = STALL;

/** Unlit material that takes the firework flash on surfaces facing the sky / the river. */
function flashMaterial(params: THREE.MeshBasicMaterialParameters, flashAmount = 1): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, ...params });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlash = festivalUniforms.uFlash;
    shader.uniforms.uFlashAmount = { value: flashAmount };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vFlashNormal;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFlashNormal = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uFlash;\nuniform float uFlashAmount;\nvarying vec3 vFlashNormal;\nvoid main() {')
      .replace('#include <opaque_fragment>', [
        // Fireworks are high over the river (-z): surfaces facing up or towards the river catch them.
        'float flashFacing = clamp(0.35 + 0.65 * max(vFlashNormal.y, 0.0) + 0.5 * max(-vFlashNormal.z, 0.0), 0.0, 1.0);',
        'outgoingLight += diffuseColor.rgb * uFlash * flashFacing * uFlashAmount;',
        '#include <opaque_fragment>',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => `festival-flash-${flashAmount}`;
  return material;
}
export { flashMaterial };

/** Image band [v0, v1] of the front painting on a plane `w` wide and `h` tall. */
function bandPlane(w: number, h: number, v0: number, v1: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(w, h);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  return geometry;
}

/** Vertical stripes of the two colours, with a scalloped valance at the bottom (the front edge of the roof). */
function stripeTexture([a, b]: [string, string]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    context.fillStyle = i % 2 ? b : a;
    context.fillRect(i * canvas.width / stripes, 0, canvas.width / stripes + 1, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.name = `Stripes ${a}`;
  return texture;
}

function scallopTexture([a, b]: [string, string]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const count = 8, w = canvas.width / count;
  for (let i = 0; i < count; i++) {
    context.fillStyle = i % 2 ? b : a;
    context.beginPath();
    context.moveTo(i * w, 0);
    context.lineTo((i + 1) * w, 0);
    context.lineTo((i + 1) * w, 34);
    context.arc(i * w + w / 2, 34, w / 2, 0, Math.PI);
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `Valance ${a}`;
  return texture;
}

/** Paper lantern (chochin): a lathe of ribs, glowing; `color` the paper. Height 1 at scale 1, centred. */
export function lanternGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = t - 0.5;
    points.push(new THREE.Vector2(0.06 + 0.3 * Math.sin(Math.PI * (0.12 + 0.76 * t)), y));
  }
  const body = new THREE.LatheGeometry(points, 14);
  const capTop = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14).translate(0, 0.52, 0);
  const capBottom = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14).translate(0, -0.52, 0);
  // Colour attribute: paper bright with darker rib rings; caps black.
  const tint = (geometry: THREE.BufferGeometry, fn: (y: number) => number) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = g.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) colors.fill(fn(position.getY(i)), i * 3, i * 3 + 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const merged = mergeGeometries([
    tint(body, (y) => 0.75 + 0.25 * Math.pow(Math.abs(Math.cos(y * Math.PI * 7)), 0.3)),
    tint(capTop, () => 0.05), tint(capBottom, () => 0.05),
  ]);
  return merged;
}

/**
 * Glowing paper of a lantern: brightest where the paper faces the viewer (the light shines through
 * it), darker and deeper in colour towards the silhouette, so it reads as a lit paper ball rather
 * than a flat shape. Works for instanced lanterns too (instance colours).
 */
export function lanternMaterial(color?: THREE.Color): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, color: color ?? new THREE.Color(1, 1, 1), toneMapped: false, fog: false });
  material.name = 'Lantern';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vLanternNormal;\nvarying vec3 vLanternView;\nvoid main() {')
      .replace('#include <project_vertex>', [
        '#include <project_vertex>',
        'vec3 lanternNormal = normal;',
        '#ifdef USE_INSTANCING',
        'lanternNormal = mat3(instanceMatrix) * lanternNormal;',
        '#endif',
        'vLanternNormal = normalize(normalMatrix * lanternNormal);',
        'vLanternView = -mvPosition.xyz;',
      ].join('\n'));
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec3 vLanternNormal;\nvarying vec3 vLanternView;\nvoid main() {')
      .replace('#include <opaque_fragment>', [
        'float facing = abs(dot(normalize(vLanternNormal), normalize(vLanternView)));',
        'vec3 deep = diffuseColor.rgb * vec3(0.75, 0.32, 0.2);',
        'outgoingLight = mix(deep, diffuseColor.rgb * 1.25, pow(facing, 1.2)) + vec3(1.0, 0.8, 0.55) * pow(facing, 6.0) * 0.6 * step(0.2, diffuseColor.r);',
        '#include <opaque_fragment>',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => 'festival-lantern';
  return material;
}

type StallParts = { group: THREE.Group; dispose: () => void };

export function createStalls(fronts: Record<StallKind, THREE.Texture>): StallParts {
  const group = new THREE.Group();
  group.name = 'Stalls';
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(item: T) => { disposables.push(item); return item; };

  // Shared geometry, in the stall's frame (front at z = +D/2).
  const counterBodyGeometry = keep(new THREE.BoxGeometry(W, STALL.counterHeight, STALL.counterDepth));
  const roofLength = Math.hypot(D + STALL.overhang, STALL.roofBack - STALL.roofFront);
  const roofGeometry = keep(new THREE.PlaneGeometry(W + 0.12, roofLength));
  const valanceGeometry = keep(new THREE.PlaneGeometry(W + 0.12, 0.22));
  const sideGeometry = keep(new THREE.PlaneGeometry(D, STALL.counterHeight));
  const rearGeometry = keep(new THREE.PlaneGeometry(W, STALL.roofBack));
  const lowerBackGeometry = keep(new THREE.BoxGeometry(W, STALL.counterHeight, 0.4));
  const floorGeometry = keep(new THREE.PlaneGeometry(W, D));
  const postGeometry = keep(new THREE.BoxGeometry(STALL.postSize, STALL.roofFront, STALL.postSize));
  const bulbGeometry = keep(new THREE.SphereGeometry(0.05, 10, 8));
  const lantern = keep(lanternGeometry());

  const wood = keep(flashMaterial({ color: '#4a3524' }, 0.6));
  const darkWood = keep(flashMaterial({ color: '#2b1f17' }, 0.3));
  // The canvas at the back of every stall: plain dark cloth, so the backs of the rows recede.
  const rear = keep(flashMaterial({ color: '#1b1e30', side: THREE.DoubleSide }, 0.4));
  const counterTop = keep(flashMaterial({ color: '#8a6644' }, 0.3));
  const floor = keep(new THREE.MeshBasicMaterial({ color: '#3a2a20', toneMapped: false, fog: false }));
  const bulb = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3), toneMapped: false, fog: false }));
  const redLantern = keep(lanternMaterial(new THREE.Color('#ff5a3c').multiplyScalar(1.6)));

  const perKind = new Map<StallKind, { headerGeometry: THREE.BufferGeometry; backGeometry: THREE.BufferGeometry; counterFrontGeometry: THREE.BufferGeometry; header: THREE.Material; back: THREE.Material; counterFront: THREE.Material; roof: THREE.Material; valance: THREE.Material; side: THREE.Material }>();
  for (const kind of Object.keys(fronts) as StallKind[]) {
    const colors = STALL_COLORS[kind];
    const stripes = keep(stripeTexture(colors));
    stripes.repeat.x = 1.5;
    const scallop = keep(scallopTexture(colors));
    const front = fronts[kind];
    const bands = STALL_BANDS[kind];
    perKind.set(kind, {
      headerGeometry: keep(bandPlane(W, H - STALL.headerBottom, 1 - bands.header, 1)),
      backGeometry: keep(bandPlane(W, STALL.headerBottom - STALL.counterHeight, 1 - bands.counter, 1 - bands.header)),
      counterFrontGeometry: keep(bandPlane(W, STALL.counterHeight, 0, 1 - bands.counter)),
      header: keep(flashMaterial({ map: front }, 0.5)),
      // The interior is lit by its own bulbs: no flash.
      back: keep(new THREE.MeshBasicMaterial({ map: front, toneMapped: false, fog: false })),
      counterFront: keep(flashMaterial({ map: front }, 0.4)),
      roof: keep(flashMaterial({ map: stripes, side: THREE.DoubleSide, color: '#c9c2c8' }, 1)),
      valance: keep(flashMaterial({ map: scallop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }, 0.8)),
      // Side skirts below the counter (open above, so the goods show from along the street).
      side: keep(flashMaterial({ color: new THREE.Color(colors[0]).multiplyScalar(0.35), side: THREE.DoubleSide }, 0.5)),
    });
  }

  for (const stall of STALLS) {
    const m = perKind.get(stall.kind)!;
    const s = new THREE.Group();
    s.name = `Stall | ${stall.kind}`;
    // The counter front on (x, z), facing the street or the river.
    s.rotation.y = Math.atan2(stall.facing[0], stall.facing[1]);
    s.position.set(stall.x - stall.facing[0] * D / 2, 0, stall.z - stall.facing[1] * D / 2);

    const add = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number, rx = 0, ry = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, 0);
      s.add(mesh);
      return mesh;
    };
    const front = D / 2;
    add(m.headerGeometry, m.header, 0, (STALL.headerBottom + H) / 2, front + 0.02);
    add(m.backGeometry, m.back, 0, (STALL.counterHeight + STALL.headerBottom) / 2, -front + 0.4);
    add(lowerBackGeometry, darkWood, 0, STALL.counterHeight / 2, -front + 0.2);
    // The canvas at the back, seen from behind the stall.
    add(rearGeometry, rear, 0, STALL.roofBack / 2, -front, 0, Math.PI);
    add(m.counterFrontGeometry, m.counterFront, 0, STALL.counterHeight / 2, front + 0.001);
    add(counterBodyGeometry, [darkWood, darkWood, counterTop, darkWood, darkWood, darkWood], 0, STALL.counterHeight / 2, front - STALL.counterDepth / 2);
    add(floorGeometry, floor, 0, 0.005, 0, -Math.PI / 2);
    for (const sx of [-1, 1]) {
      add(sideGeometry, m.side, sx * W / 2, STALL.counterHeight / 2, 0, 0, Math.PI / 2);
      for (const sz of [-1, 1]) add(postGeometry, wood, sx * (W / 2 - 0.03), STALL.roofFront / 2, sz * (front - 0.03));
    }
    // Roof: from the back top, sloping down over the front by the overhang.
    const roofTilt = Math.atan2(STALL.roofBack - STALL.roofFront, D + STALL.overhang);
    add(roofGeometry, m.roof, 0, (STALL.roofBack + STALL.roofFront) / 2, STALL.overhang / 2, -Math.PI / 2 + roofTilt);
    add(valanceGeometry, m.valance, 0, STALL.roofFront - 0.11, front + STALL.overhang);
    // Bare bulbs under the roof, and a pair of lanterns at the front corners.
    for (const bx of [-0.6, 0.6]) add(bulbGeometry, bulb, bx, STALL.headerBottom - 0.15, front - 0.5).name = 'Bulb';
    for (const lx of [-1, 1]) {
      const l = add(lantern, redLantern, lx * (W / 2 - 0.15), STALL.headerBottom - 0.35, front + 0.25);
      l.scale.setScalar(0.42);
      l.name = 'Stall lantern';
    }
    group.add(s);
  }
  return { group, dispose: () => disposables.forEach((item) => item.dispose()) };
}
