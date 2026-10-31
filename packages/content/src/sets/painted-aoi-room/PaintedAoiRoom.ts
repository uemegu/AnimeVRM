import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { castShadows } from '@anime-vrm/engine/scene/castShadows';
import { BACK_Z, FRONT_Z, HEIGHT, LEFT_X, PROPS, RIGHT_X, type PropPlacement } from './layout';

/**
 * Painted 2.5D bedroom of Aoi: each wall is one generated painting and the floor is a tile;
 * the furniture and small things are textured models (props/*.glb, made with Tripo) so they
 * can be sat on and shot from any side. The sky outside the balcony door is not painted:
 * the viewer's SkyBackground shows through. Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-aoi-room';

async function texture(file: string): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function painted(map: THREE.Texture, cutout = false): THREE.MeshBasicMaterial {
  // Front side only: the walls, floor and ceiling face into the room, so a camera that leaves the
  // small room looks through the wall behind it (back-face culled) instead of at its outside.
  const material = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.FrontSide });
  // The paintings carry their own light; only the modelled parts get the cel light/shade.
  material.userData.cel = false;
  if (cutout) {
    material.alphaTest = 0.5;
    material.alphaToCoverage = true;
  }
  return material;
}

function flat(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function plane(name: string, material: THREE.Material, width: number, height: number,
  position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

/** Yellow-and-white gingham for the floor cushion. */
function ginghamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fffaf0';
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = 'rgba(244, 196, 64, 0.55)';
  for (let i = 0; i < 4; i++) {
    context.fillRect(i * 32, 0, 16, 128);
    context.fillRect(0, i * 32, 128, 16);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  return map;
}

/**
 * Loads a prop and fits it to its placement. The models' PBR materials become unlit textured
 * ones so they match the paintings; the cel light gives them their sunlit and shaded sides.
 */
async function prop(placement: PropPlacement): Promise<THREE.Object3D> {
  const gltf = await new GLTFLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/props/${placement.file}.glb`));
  const model = gltf.scene;
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.material as THREE.MeshStandardMaterial;
    if (source.map) source.map.anisotropy = 8;
    object.material = new THREE.MeshBasicMaterial({ map: source.map, toneMapped: false });
    source.dispose();
  });
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const [width, height, depth] = placement.size;
  model.scale.set(width / size.x * (placement.mirror ? -1 : 1), height / size.y, depth / size.z);
  const group = new THREE.Group();
  group.name = placement.file;
  group.add(model);
  group.position.set(placement.at[0], 0, placement.at[1]);
  group.rotation.y = placement.rotationY ?? 0;
  return placement.shadow === false ? group : castShadows(group);
}

export async function loadPaintedAoiRoom(): Promise<THREE.Group> {
  const [[front, left, right, back, floor], props] = await Promise.all([
    Promise.all(['wall-front.avif', 'wall-left.avif', 'wall-right.avif', 'wall-back.avif', 'floor.avif'].map(texture)),
    Promise.all(PROPS.map(prop)),
  ]);
  const width = RIGHT_X - LEFT_X, depth = BACK_Z - FRONT_Z;
  const cx = (LEFT_X + RIGHT_X) / 2, cz = (FRONT_Z + BACK_Z) / 2;
  const group = new THREE.Group();
  group.name = 'Painted Aoi room';

  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.repeat.set(width / 1.8, depth / 1.8);
  group.add(plane('Floor', painted(floor), width, depth, [cx, 0, cz], [-Math.PI / 2, 0, 0]));
  group.add(plane('Ceiling', flat('#f6f0e6'), width, depth, [cx, HEIGHT, cz], [Math.PI / 2, 0, 0]));
  // Only the downward face, so it does not float over the room when the ceiling is culled from above.
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), flat('#fffaf0'));
  lamp.name = 'Ceiling light';
  lamp.position.set(cx, HEIGHT - 0.04, cz);
  lamp.rotation.x = Math.PI / 2;
  group.add(lamp);
  // Wall paintings are seen from inside the room.
  group.add(plane('Window wall', painted(front, true), width, HEIGHT, [cx, HEIGHT / 2, FRONT_Z]));
  group.add(plane('Left wall | bed', painted(left), depth, HEIGHT, [LEFT_X, HEIGHT / 2, cz], [0, Math.PI / 2, 0]));
  group.add(plane('Right wall | desk', painted(right), depth, HEIGHT, [RIGHT_X, HEIGHT / 2, cz], [0, -Math.PI / 2, 0]));
  group.add(plane('Back wall | door', painted(back), width, HEIGHT, [cx, HEIGHT / 2, BACK_Z], [0, Math.PI, 0]));

  // Furniture casts onto the floor when the location has light.shadow (baked once by the stage).
  for (const item of props) group.add(item);
  const gingham = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.13, 0.45, 4, 0.06),
    new THREE.MeshBasicMaterial({ map: ginghamTexture(), toneMapped: false }));
  gingham.name = 'Gingham cushion';
  gingham.position.set(0.85, 0.075, -2.1);
  gingham.rotation.y = 0.3;
  group.add(castShadows(gingham));
  return group;
}

export function disposePaintedAoiRoom(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const map of [(material as THREE.MeshBasicMaterial).map, (material as THREE.MeshBasicMaterial).alphaMap]) {
        if (map) textures.add(map);
      }
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((map) => map.dispose());
}
