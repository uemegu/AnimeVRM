import * as THREE from 'three';
import { resolveAssetUrl } from '../../utils/path';
import {
  BACKDROP, BUILDING, FACADE_TILE_TOP, FAR, GATE_BOXES, GROUND, GROUND_PAINTING_FADE, GUARDHOUSE, REFERENCE_CAMERA, ROAD, SKY_RADIUS, TILES, referenceCamera, type Box,
} from './layout';

/**
 * Painted 2.5D school gate (camera-projection matte painting): the view from
 * the reference camera was painted once over a blockout render and is projected
 * back from that camera onto boxes of the blockout, so the painting keeps its
 * perspective and still gets parallax when the camera moves a little. Three
 * paintings, front to back: the gate layer (wall, pillars, sliding gate), the
 * guardhouse, and the scene with both painted out, so moving sideways reveals
 * what is behind them instead of a second copy of them.
 *
 * Everything the paintings do not cover (outside their frame, or facing away
 * from the reference camera) falls back to seamless tiles, and the distance on
 * all four sides is standee paintings, so the set holds up from any direction.
 * The sky dome is for viewers without a sky of their own (Studio's overview);
 * the stage hides it (userData.setSky) and draws its time-of-day sky instead.
 * Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-gate';
/** Fully transparent background image: the viewer then draws only its sky behind the set. */
export const SKY_ONLY_BACKGROUND = '/textures/painted-classroom/sky-only.png';

/** repeat: 'xy' tiles both ways, 'x' only across (the top row then extends upwards, e.g. the sky above a facade). */
async function loadTexture(file: string, repeat?: 'xy' | 'x'): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = THREE.RepeatWrapping;
  if (repeat === 'xy') texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

type Projection = { matrix: THREE.Matrix4; eye: THREE.Vector3 };

/**
 * Unlit material whose map is projected from the reference camera instead of
 * using UVs. With a fallback tile, surfaces the painting does not cover (outside
 * its frame, facing away from the reference camera, or transparent in it) show
 * the tile in world space instead, blending over a margin at the frame edge;
 * transparent parts of the tile are cut out. Without one they are cut out.
 */
function projectedMaterial(painting: THREE.Texture, projection: Projection,
  fallback?: { map: THREE.Texture; size: [number, number]; offset?: [number, number]; fadeDistance?: [number, number] }): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ map: painting, toneMapped: false, side: THREE.DoubleSide, alphaTest: 0.5 });
  material.name = painting.name;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.paintingProjection = { value: projection.matrix };
    shader.uniforms.paintingEye = { value: projection.eye };
    shader.uniforms.tileMap = { value: fallback?.map ?? null };
    shader.uniforms.tileSize = { value: new THREE.Vector2(...(fallback?.size ?? [1, 1])) };
    shader.uniforms.tileOffset = { value: new THREE.Vector2(...(fallback?.offset ?? [0, 0])) };
    shader.uniforms.fadeDistance = { value: new THREE.Vector2(...(fallback?.fadeDistance ?? [1e5, 1e5 + 1])) };
    if (fallback) shader.defines = { ...shader.defines, PAINTING_FALLBACK: '' };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform mat4 paintingProjection;\nvarying vec4 vPainting;\nvarying vec3 vWorld;\nvarying vec3 vWorldNormal;\nvoid main() {')
      .replace('#include <project_vertex>', [
        '#include <project_vertex>',
        'vec4 paintingWorld = modelMatrix * vec4(transformed, 1.0);',
        'vWorld = paintingWorld.xyz;',
        'vWorldNormal = normalize(mat3(modelMatrix) * normal);',
        'vPainting = paintingProjection * paintingWorld;',
      ].join('\n'));
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', [
        'uniform vec3 paintingEye;',
        'uniform sampler2D tileMap;',
        'uniform vec2 tileSize, tileOffset, fadeDistance;',
        'varying vec4 vPainting;',
        'varying vec3 vWorld;',
        'varying vec3 vWorldNormal;',
        'void main() {',
      ].join('\n'))
      .replace('#include <map_fragment>', [
        'vec2 paintingUv = vPainting.xy / vPainting.w * 0.5 + 0.5;',
        'float paintingEdge = min(min(paintingUv.x, 1.0 - paintingUv.x), min(paintingUv.y, 1.0 - paintingUv.y));',
        'vec4 painted = texture2D(map, clamp(paintingUv, 0.0, 1.0));',
        'float covered = step(0.0, vPainting.w) * smoothstep(0.0, 0.03, paintingEdge);',
        '#ifdef PAINTING_FALLBACK',
        '  covered *= step(0.0, dot(vWorldNormal, paintingEye - vWorld)) * painted.a;',
        '  covered *= 1.0 - smoothstep(fadeDistance.x, fadeDistance.y, distance(vWorld, paintingEye));',
        '  vec3 n = abs(vWorldNormal);',
        '  // Ground: image top towards -z from tileOffset. Walls: image bottom on the ground.',
        '  vec2 tileUv = n.y > max(n.x, n.z) ? vec2(vWorld.x - tileOffset.x, tileOffset.y - vWorld.z) : (n.x > n.z ? vWorld.zy : vWorld.xy);',
        '  vec4 tile = texture2D(tileMap, tileUv / tileSize);',
        '  diffuseColor *= mix(tile, painted, covered);',
        '#else',
        '  diffuseColor *= vec4(painted.rgb, painted.a * step(0.001, covered));',
        '#endif',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => `painted-gate-projection-${fallback ? 'tile' : 'cut'}`;
  return material;
}

/** Facade tile size (m) at which the facade in tile-facade.avif (opaque from the bottom up) is BUILDING tall. */
function facadeTileSize(texture: THREE.Texture): [number, number] {
  const image = texture.image as { width: number; height: number };
  const height = BUILDING.max[1] * image.height / (image.height - FACADE_TILE_TOP);
  return [height * image.width / image.height, height];
}

function boxMesh(box: Box, material: THREE.Material): THREE.Mesh {
  const size = box.max.map((v, i) => v - box.min[i]);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = box.name;
  mesh.position.set(...box.min.map((v, i) => v + size[i] / 2) as [number, number, number]);
  return mesh;
}

function groundPlane(name: string, material: THREE.Material, minX: number, maxX: number, nearZ: number, farZ: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, nearZ - farZ), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, 0, (nearZ + farZ) / 2);
  return mesh;
}

/** Standee painting standing on the ground from `from` to `to` (world xz), facing the set; the image's bottom edge is the ground. */
function farStandee(name: string, texture: THREE.Texture, from: [number, number], to: [number, number], repeatEvery?: number): THREE.Mesh {
  const image = texture.image as { width: number; height: number };
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const tileWidth = repeatEvery ?? length;
  const height = tileWidth * image.height / image.width;
  const geometry = new THREE.PlaneGeometry(length, height);
  if (repeatEvery) {
    texture.wrapS = THREE.RepeatWrapping;
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length / repeatEvery);
  }
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, alphaTest: 0.5, side: THREE.DoubleSide });
  material.name = name;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set((from[0] + to[0]) / 2, height / 2, (from[1] + to[1]) / 2);
  // Plane faces +z; turn it so its front faces the set's centre.
  mesh.rotation.y = Math.atan2(-(to[1] - from[1]), to[0] - from[0]);
  return mesh;
}

/** Morning sky with drifting clouds on a dome, for viewers without a sky of their own. */
function skyDome(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uZenith: { value: new THREE.Color('#078fff') }, uHorizon: { value: new THREE.Color('#9ce9ff') }, uCloud: { value: new THREE.Color('#fff9eb') } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith, uHorizon, uCloud;
      varying vec3 vDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
      }
      void main() {
        float up = max(vDirection.y, 0.0);
        vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, up));
        vec2 p = vDirection.xz / max(up, 0.08) * 1.6;
        float body = noise(p) * 0.6 + noise(p * 2.1) * 0.28 + noise(p * 4.3) * 0.12;
        float clouds = smoothstep(0.52, 0.66, body) * smoothstep(0.02, 0.2, up);
        gl_FragColor = vec4(mix(sky, uCloud, clouds * 0.85), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = 'Sky dome';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), material);
  mesh.name = 'Sky dome';
  mesh.renderOrder = -10;
  mesh.userData.setSky = true;
  return mesh;
}

export async function loadPaintedGate(): Promise<THREE.Group> {
  const camera = referenceCamera();
  const projection: Projection = {
    matrix: new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    eye: new THREE.Vector3(...REFERENCE_CAMERA.position),
  };
  const [scene, guardhouse, gate, paving, road, wall, stone, facade, farCampus, farHouses] = await Promise.all([
    loadTexture('scene.avif'), loadTexture('guardhouse.avif'), loadTexture('gate.avif'),
    loadTexture('tile-paving.avif', 'xy'), loadTexture('tile-road.avif', 'xy'), loadTexture('tile-wall.avif', 'xy'), loadTexture('tile-stone.avif', 'xy'),
    loadTexture('tile-facade.avif', 'x'),
    loadTexture('far-campus.avif'), loadTexture('far-houses.avif'),
  ]);
  const roadDepth = ROAD.farZ - ROAD.nearZ;
  const roadImage = road.image as { width: number; height: number };
  const materials = {
    // Far ground is seen at a grazing angle from the reference camera, so its painting stretches from other views.
    ground: projectedMaterial(scene, projection, { map: paving, size: [TILES.paving, TILES.paving], fadeDistance: [...GROUND_PAINTING_FADE] }),
    road: projectedMaterial(scene, projection, { map: road, size: [roadDepth * roadImage.width / roadImage.height, roadDepth], offset: [0, ROAD.nearZ] }),
    // The building runs on past the painting's frame as a plain facade.
    backdrop: projectedMaterial(scene, projection, { map: facade, size: facadeTileSize(facade) }),
    guardhouse: projectedMaterial(guardhouse, projection, { map: wall, size: [...TILES.wall] }),
    wall: projectedMaterial(gate, projection, { map: wall, size: [...TILES.wall] }),
    pillar: projectedMaterial(gate, projection, { map: stone, size: [TILES.stone, TILES.stone] }),
    // The sliding gate is see-through bars: cut out, painted the same from both sides.
    slidingGate: projectedMaterial(gate, projection),
  };
  const group = new THREE.Group();
  group.name = 'Painted gate';

  group.add(skyDome());
  group.add(groundPlane('Ground', materials.ground, GROUND.minX, GROUND.maxX, GROUND.nearZ, GROUND.farZ));
  group.add(groundPlane('Road', materials.road, GROUND.minX, GROUND.maxX, ROAD.farZ, ROAD.nearZ));
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(BACKDROP.maxX - BACKDROP.minX, BACKDROP.height), materials.backdrop);
  backdrop.name = 'Backdrop | building and trees';
  backdrop.position.set((BACKDROP.minX + BACKDROP.maxX) / 2, BACKDROP.height / 2, BACKDROP.z);
  group.add(backdrop);
  group.add(boxMesh(GUARDHOUSE, materials.guardhouse));
  for (const box of GATE_BOXES) {
    group.add(boxMesh(box, box.name.includes('pillar') ? materials.pillar : box.name.includes('wall') ? materials.wall : materials.slidingGate));
  }

  group.add(farStandee('Far | campus', farCampus, [FAR.west, FAR.north], [FAR.east, FAR.north], FAR.campusRepeat));
  group.add(farStandee('Far | houses south', farHouses, [FAR.east, FAR.south], [FAR.west, FAR.south], FAR.housesRepeat));
  group.add(farStandee('Far | houses west', farHouses, [FAR.west, FAR.south], [FAR.west, FAR.north], FAR.housesRepeat));
  group.add(farStandee('Far | houses east', farHouses, [FAR.east, FAR.north], [FAR.east, FAR.south], FAR.housesRepeat));
  return group;
}

export function disposePaintedGate(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) textures.add(map);
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
