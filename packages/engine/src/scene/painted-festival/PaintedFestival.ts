import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';
import { farStandee } from '../painted-gate/PaintedGate';
import { Fireworks } from './Fireworks';
import {
  ANDON_POSTS, BANNER, EDGE_Z, EMBANKMENT, FAR, FAR_BANK, GROUND, LANTERN_STRINGS, RAILING, RIVER_Y, STALL_COLORS, STREET_HALF, TILES, type StallKind,
} from './layout';
import { AVATAR_LIGHTS, festivalUniforms, WARM_POOLS } from './lights';
import { nightSky } from './NightSky';
import { createRiver } from './River';
import { createStalls, flashMaterial, lanternGeometry } from './Stalls';

/**
 * Summer festival at night (simple 3D set). A street lined with food stalls
 * ends at a riverside railing; across the river the far bank is lit with
 * lanterns, and fireworks go up over it. The stalls are real geometry with
 * painted fronts (Stalls.ts), the river reflects the far bank and the
 * fireworks (River.ts), the sky is the set's own (NightSky.ts). Paintings and
 * shaders are unlit; the avatars get real lights: warm point lights at the
 * nearest stalls and the fireworks' flash (Fireworks.ts).
 * Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-festival';

async function loadTexture(file: string, repeat?: boolean): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.name = file;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Stone paving lit by the night, with warm pools of light from the stalls and lanterns and the fireworks' flash. */
function ground(tile: THREE.Texture): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTile: { value: tile },
      uTileSize: { value: TILES.paving },
      uPools: { value: WARM_POOLS.map((pool) => new THREE.Vector4(...pool)) },
      uNight: { value: new THREE.Color('#1a2042') },
      uWarm: { value: new THREE.Color('#ff9c4f') },
      uFlash: festivalUniforms.uFlash,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      #define POOLS ${WARM_POOLS.length}
      uniform sampler2D uTile;
      uniform float uTileSize;
      uniform vec4 uPools[POOLS];
      uniform vec3 uNight, uWarm, uFlash;
      varying vec3 vWorld;
      void main() {
        vec3 tile = texture2D(uTile, vWorld.xz / uTileSize).rgb;
        float warm = 0.0;
        for (int i = 0; i < POOLS; i++) {
          float d = distance(vWorld.xz, uPools[i].xy) / uPools[i].z;
          warm += uPools[i].w * exp(-d * d * 2.2);
        }
        // Wet-looking sheen: the warm light glints on the stones towards the viewer.
        vec3 view = normalize(cameraPosition - vWorld);
        float sheen = pow(1.0 - view.y, 3.0) * 0.6;
        vec3 color = tile * (uNight + uWarm * warm * (1.0 + sheen)) + tile * uFlash * 0.6;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = 'Ground';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GROUND.maxX - GROUND.minX, GROUND.nearZ - GROUND.farZ), material);
  mesh.name = 'Ground';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((GROUND.minX + GROUND.maxX) / 2, 0, (GROUND.nearZ + GROUND.farZ) / 2);
  return mesh;
}

/** Stone (posts, embankment): the paving tile in world space, tops warmed by the lanterns, sides in the night's blue. */
function stoneMaterial(tile: THREE.Texture): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTile: { value: tile },
      uPools: { value: WARM_POOLS.map((pool) => new THREE.Vector4(...pool)) },
      uTop: { value: new THREE.Color('#5a5060') },
      uSide: { value: new THREE.Color('#1c1f36') },
      uWarm: { value: new THREE.Color('#ff9c4f') },
      uFlash: festivalUniforms.uFlash,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld, vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      #define POOLS ${WARM_POOLS.length}
      uniform sampler2D uTile;
      uniform vec4 uPools[POOLS];
      uniform vec3 uTop, uSide, uWarm, uFlash;
      varying vec3 vWorld, vNormal;
      void main() {
        vec3 n = abs(vNormal);
        vec2 uv = n.y > max(n.x, n.z) ? vWorld.xz : (n.x > n.z ? vWorld.zy : vWorld.xy);
        vec3 tile = texture2D(uTile, uv / 1.6).rgb;
        float warm = 0.0;
        for (int i = 0; i < POOLS; i++) {
          float d = distance(vWorld.xz, uPools[i].xy) / uPools[i].z;
          warm += uPools[i].w * exp(-d * d * 2.2);
        }
        // Lit from above by the lanterns, so faces darken downwards; the river face is darkest.
        float up = max(vNormal.y, 0.0);
        float height = smoothstep(-1.5, 1.2, vWorld.y);
        vec3 light = mix(uSide * mix(0.5, 1.0, height), uTop, up) + uWarm * warm * mix(0.35, 1.0, up) * height;
        light *= vNormal.z < -0.5 ? 0.6 : 1.0;
        gl_FragColor = vec4(tile * (light + uFlash * 0.5), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = 'Stone';
  return material;
}

/** Shoji paper for the andons: cream with a dark lattice. */
function shojiTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 96);
  gradient.addColorStop(0, '#ffe2a8');
  gradient.addColorStop(0.5, '#fff1cf');
  gradient.addColorStop(1, '#ffcf86');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 96);
  context.strokeStyle = '#3a2416';
  context.lineWidth = 6;
  context.strokeRect(0, 0, 64, 96);
  context.lineWidth = 2;
  for (const x of [21, 43]) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 96); context.stroke(); }
  for (const y of [32, 64]) { context.beginPath(); context.moveTo(0, y); context.lineTo(64, y); context.stroke(); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = 'Shoji';
  return texture;
}

/** Bakes a cel tone into vertex colours: tops lit by the warm lanterns, sides in the night's blue. */
function celShade(geometry: THREE.BufferGeometry, lit: THREE.Color, shade: THREE.Color): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const normals = g.getAttribute('normal');
  const colors = new Float32Array(normals.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < normals.count; i++) {
    const ny = normals.getY(i), nz = normals.getZ(i);
    // Tops catch the lantern light; faces towards the street a little; the river side stays dark.
    color.copy(ny > 0.5 ? lit : nz > 0.5 ? shade.clone().lerp(lit, 0.45) : shade).toArray(colors, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Wooden rails between square stone posts, an andon lantern on some posts. */
function railing(tile: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Railing';
  const wood: THREE.BufferGeometry[] = [];
  const stone: THREE.BufferGeometry[] = [];
  for (let x = RAILING.minX; x <= RAILING.maxX + 0.01; x += RAILING.postSpacing) {
    stone.push(new THREE.BoxGeometry(RAILING.postSize, RAILING.height + 0.1, RAILING.postSize).translate(x, EMBANKMENT.top + (RAILING.height + 0.1) / 2, RAILING.z));
  }
  for (const height of RAILING.rails) {
    wood.push(new THREE.BoxGeometry(RAILING.maxX - RAILING.minX, RAILING.railSize[1], RAILING.railSize[0]).translate((RAILING.minX + RAILING.maxX) / 2, EMBANKMENT.top + height, RAILING.z));
  }
  // Thin vertical balusters between the rails.
  for (let x = RAILING.minX; x < RAILING.maxX; x += RAILING.postSpacing / 6) {
    wood.push(new THREE.BoxGeometry(0.035, RAILING.rails[1] - RAILING.rails[0], 0.035).translate(x, EMBANKMENT.top + (RAILING.rails[0] + RAILING.rails[1]) / 2, RAILING.z));
  }
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  material.name = 'Railing';
  const woodMesh = new THREE.Mesh(mergeGeometries(wood.map((g) => celShade(g, new THREE.Color('#7a5034'), new THREE.Color('#24191a')))), material);
  const stoneMesh = new THREE.Mesh(mergeGeometries(stone), stoneMaterial(tile));
  wood.concat(stone).forEach((g) => g.dispose());
  woodMesh.name = 'Railing | wood';
  stoneMesh.name = 'Railing | posts';
  group.add(woodMesh, stoneMesh);

  // Andons: glowing paper boxes under a dark wooden cap.
  const paper = new THREE.MeshBasicMaterial({ map: shojiTexture(), color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false, fog: false });
  paper.name = 'Andon paper';
  const frame = new THREE.MeshBasicMaterial({ color: '#2a1c14', toneMapped: false, fog: false });
  frame.name = 'Andon frame';
  const paperGeometry = new THREE.BoxGeometry(0.3, 0.38, 0.3);
  const capGeometry = new THREE.BoxGeometry(0.42, 0.06, 0.42);
  const top = EMBANKMENT.top + RAILING.height + 0.1;
  for (const x of ANDON_POSTS) {
    const andon = new THREE.Mesh(paperGeometry, paper);
    andon.position.set(x, top + 0.19, RAILING.z);
    const cap = new THREE.Mesh(capGeometry, frame);
    cap.position.set(x, top + 0.41, RAILING.z);
    group.add(andon, cap);
  }
  return group;
}

/** Strings of paper lanterns across the street, sagging between the stall roofs. */
function lanternStrings(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Lantern strings';
  const half = STREET_HALF + 0.2;
  const count = Math.round(2 * half / LANTERN_STRINGS.spacing);
  const geometry = lanternGeometry();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  material.name = 'Lanterns';
  const mesh = new THREE.InstancedMesh(geometry, material, LANTERN_STRINGS.z.length * count);
  mesh.name = 'Lanterns';
  const red = new THREE.Color('#ff4d38').multiplyScalar(1.8), white = new THREE.Color('#fff0d0').multiplyScalar(1.8);
  const wire: number[] = [];
  const sag = (x: number) => LANTERN_STRINGS.height - LANTERN_STRINGS.sag * (1 - (x / half) ** 2);
  const matrix = new THREE.Matrix4();
  let i = 0;
  for (const z of LANTERN_STRINGS.z) {
    for (let k = 0; k < count; k++) {
      const x = -half + (k + 0.5) * 2 * half / count;
      matrix.makeScale(0.22, 0.3, 0.22).setPosition(x, sag(x) - 0.2, z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i++, k % 2 ? white : red);
    }
    for (let k = 0; k < 24; k++) {
      const a = -half + k * 2 * half / 24, b = -half + (k + 1) * 2 * half / 24;
      wire.push(a, sag(a), z, b, sag(b), z);
    }
  }
  group.add(mesh);
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  const wireMaterial = new THREE.LineBasicMaterial({ color: '#1a1414', toneMapped: false, fog: false });
  wireMaterial.name = 'Lantern wire';
  const lines = new THREE.LineSegments(wireGeometry, wireMaterial);
  lines.name = 'Lantern wire';
  group.add(lines);
  return group;
}

/** Embankment: the stone edge of the street, its river face down into the water. */
function embankment(tile: THREE.Texture): THREE.Mesh {
  const height = EMBANKMENT.top - RIVER_Y + 0.3;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(EMBANKMENT.maxX - EMBANKMENT.minX, height, EMBANKMENT.depth), stoneMaterial(tile));
  mesh.name = 'Embankment';
  mesh.position.set((EMBANKMENT.minX + EMBANKMENT.maxX) / 2, EMBANKMENT.top - height / 2, EMBANKMENT.z - EMBANKMENT.depth / 2);
  return mesh;
}

export async function loadPaintedFestival(): Promise<THREE.Group> {
  const kinds = Object.keys(STALL_COLORS) as StallKind[];
  const [paving, farBank, farTown, banner, ...fronts] = await Promise.all([
    loadTexture('tile-paving.avif', true), loadTexture('far-bank.avif'), loadTexture('far-town.avif'), loadTexture('banner.avif'),
    ...kinds.map((kind) => loadTexture(`stall-${kind}.avif`)),
  ]);
  const group = new THREE.Group();
  group.name = 'Painted festival';
  const fireworks = new Fireworks();

  group.add(nightSky());
  group.add(fireworks.object);
  group.add(ground(paving));
  group.add(embankment(paving));
  group.add(railing(paving));
  group.add(createRiver({ level: RIVER_Y, nearZ: EDGE_Z - EMBANKMENT.depth, farZ: FAR_BANK.z, minX: -100, maxX: 100, farBank, fireworks }));

  const stalls = createStalls(Object.fromEntries(kinds.map((kind, i) => [kind, fronts[i]])) as Record<StallKind, THREE.Texture>);
  stalls.group.userData.dispose = stalls.dispose;
  group.add(stalls.group);
  group.add(lanternStrings());

  const bannerImage = banner.image as { width: number; height: number };
  const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(BANNER.height * bannerImage.width / bannerImage.height, BANNER.height), flashMaterial({ map: banner, alphaTest: 0.5, side: THREE.DoubleSide }, 0.4));
  bannerMesh.name = 'Banner';
  bannerMesh.position.set(BANNER.x, BANNER.height / 2, BANNER.z);
  bannerMesh.rotation.y = -0.35;
  group.add(bannerMesh);

  // Far bank: its bottom edge on the water line.
  const bank = farStandee('Far | bank', farBank, [FAR_BANK.minX, FAR_BANK.z], [FAR_BANK.maxX, FAR_BANK.z], FAR_BANK.repeat);
  bank.position.y += FAR_BANK.bottom;
  group.add(bank);
  group.add(farStandee('Far | town south', farTown, [FAR.east, FAR.south], [FAR.west, FAR.south], FAR.repeat));
  group.add(farStandee('Far | town west', farTown, [FAR.west, FAR.south], [FAR.west, EDGE_Z], FAR.repeat));
  group.add(farStandee('Far | town east', farTown, [FAR.east, EDGE_Z], [FAR.east, FAR.south], FAR.repeat));
  for (const far of group.children) {
    if (far.name.startsWith('Far |')) ((far as THREE.Mesh).material as THREE.MeshBasicMaterial).fog = false;
  }

  // Lights for the avatars (the set itself is unlit).
  for (const { position, color } of AVATAR_LIGHTS) {
    const light = new THREE.PointLight(color, 8, 7, 2);
    light.name = 'Stall light';
    light.position.set(...position);
    group.add(light);
  }
  const overhead = new THREE.PointLight('#ff8a5c', 3, 6, 2);
  overhead.name = 'Lantern light';
  overhead.position.set(0, LANTERN_STRINGS.height - 0.3, LANTERN_STRINGS.z[1]);
  group.add(overhead);
  group.add(fireworks.light, fireworks.light.target);
  group.userData.fireworks = fireworks;
  return group;
}

export function disposePaintedFestival(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (object.userData.dispose) object.userData.dispose();
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
      }
    }
  });
  (group.userData.fireworks as Fireworks | undefined)?.dispose();
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
