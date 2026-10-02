import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveAssetUrl } from '../../utils/path';
import { boxMesh, farStandee, groundPlane, projectedMaterial, skyDome, type Projection } from '../painted-gate/PaintedGate';
import {
  EDGE_Z, FAR, GROUND, GROUND_PAINTING_FADE, ISLANDS, KERB, LAMPS, LAMP_HEIGHT, RAILING, REFERENCE_CAMERA, SEA_RADIUS, SEA_Y, SUN_DIRECTION, TILES, TREES, referenceCamera,
} from './layout';
import { createSea } from './Sea';

/**
 * Painted 2.5D seaside park. The promenade and its kerb are a painting
 * projected from the reference camera (as in the painted gate); the railing is
 * real geometry so the sea shows between its rails; the sea is procedural
 * (Sea.ts: moving waves and sparkles); trees, lamps, the islands on the horizon
 * and the park and town on the land side are standee paintings.
 * Layout and units: see layout.ts.
 */
const TEXTURE_DIR = '/textures/painted-seaside';

async function loadTexture(file: string, repeat?: boolean): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(resolveAssetUrl(`${TEXTURE_DIR}/${file}`));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.name = file;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Cut-out painting standing upright facing +z, `height` m tall, bottom centre at (x, y, z). The images are cropped to the object. */
function standee(name: string, texture: THREE.Texture, height: number, x: number, z: number, y = 0): THREE.Mesh {
  const image = texture.image as { width: number; height: number };
  const width = height * image.width / image.height;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, alphaTest: 0.5, side: THREE.DoubleSide });
  material.name = name;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(x, y + height / 2, z);
  return mesh;
}

/** Turns a standee about its vertical axis to face the camera on every render, so a round object (a tree, a lamp) never shows its edge. */
function faceCamera(mesh: THREE.Mesh): THREE.Mesh {
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const local = mesh.parent ? mesh.parent.worldToLocal(camera.getWorldPosition(new THREE.Vector3())) : camera.position.clone();
    mesh.rotation.y = Math.atan2(local.x - mesh.position.x, local.z - mesh.position.z);
    mesh.updateMatrix();
    mesh.matrixWorld.multiplyMatrices(mesh.parent?.matrixWorld ?? new THREE.Matrix4(), mesh.matrix);
  };
  return mesh;
}

/** Away from the sun along the ground (the sun is over the sea, so shadows fall towards the camera side). */
const SHADOW_AWAY = new THREE.Vector2(-SUN_DIRECTION[0], -SUN_DIRECTION[2]).normalize();

/** Soft dark ellipse on the ground under a standee, pushed away from the light. */
function contactShadow(name: string, map: THREE.Texture, width: number, depth: number, x: number, z: number): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ map, color: '#2c3d5a', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
  material.name = name;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x + SHADOW_AWAY.x * depth * 0.3, 0.01, z + SHADOW_AWAY.y * depth * 0.3);
  mesh.renderOrder = 1;
  return mesh;
}

function radialTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Contact shadow';
  return texture;
}

/** Bakes two cel tones into vertex colours: faces towards the sun (over the sea, ahead and to the left) lit, the rest in shade. */
function celShade(geometry: THREE.BufferGeometry, base: THREE.Color): THREE.BufferGeometry {
  const light = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(normals.count * 3);
  const n = new THREE.Vector3(), color = new THREE.Color();
  for (let i = 0; i < normals.count; i++) {
    n.fromBufferAttribute(normals, i);
    const lit = n.dot(light) > 0.25 ? 1.12 : 0.78;
    color.copy(base).multiplyScalar(lit).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Posts on the kerb and two round rails, merged into one mesh. */
function railing(): THREE.Mesh {
  const base = new THREE.Color('#34485e');
  const parts: THREE.BufferGeometry[] = [];
  for (let x = RAILING.minX; x <= RAILING.maxX; x += RAILING.postSpacing) {
    const post = new THREE.BoxGeometry(RAILING.postSize, RAILING.height, RAILING.postSize);
    post.translate(x, KERB.max[1] + RAILING.height / 2, RAILING.z);
    parts.push(post);
  }
  for (const height of RAILING.rails) {
    const rail = new THREE.CylinderGeometry(RAILING.railRadius, RAILING.railRadius, RAILING.maxX - RAILING.minX, 10, 1);
    rail.rotateZ(Math.PI / 2);
    rail.translate((RAILING.minX + RAILING.maxX) / 2, KERB.max[1] + height, RAILING.z);
    parts.push(rail.toNonIndexed());
  }
  const geometry = mergeGeometries(parts.map((part) => celShade(part.index ? part.toNonIndexed() : part, base)));
  parts.forEach((part) => part.dispose());
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  material.name = 'Railing';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Railing';
  return mesh;
}

export async function loadPaintedSeaside(): Promise<THREE.Group> {
  const camera = referenceCamera();
  const projection: Projection = {
    matrix: new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    eye: new THREE.Vector3(...REFERENCE_CAMERA.position),
  };
  const [scene, paving, stone, treeA, treeB, lamp, islands, farPark] = await Promise.all([
    loadTexture('scene.avif'), loadTexture('tile-paving.avif', true), loadTexture('tile-stone.avif', true),
    loadTexture('tree-a.avif'), loadTexture('tree-b.avif'), loadTexture('lamp.avif'),
    loadTexture('far-islands.avif'), loadTexture('far-park.avif'),
  ]);
  const group = new THREE.Group();
  group.name = 'Painted seaside';

  group.add(skyDome());
  group.add(createSea({ level: SEA_Y, radius: SEA_RADIUS, sun: SUN_DIRECTION }));
  group.add(groundPlane('Ground', projectedMaterial(scene, projection, { map: paving, size: [TILES.paving, TILES.paving], fadeDistance: [...GROUND_PAINTING_FADE] }),
    GROUND.minX, GROUND.maxX, GROUND.nearZ, GROUND.farZ));
  group.add(boxMesh(KERB, projectedMaterial(scene, projection, { map: stone, size: [TILES.stone, TILES.stone] })));
  group.add(railing());

  const shadow = radialTexture();
  const trees = { 'tree-a': treeA, 'tree-b': treeB };
  for (const tree of TREES) {
    const mesh = faceCamera(standee(`Tree | ${tree.image}`, trees[tree.image], tree.height, tree.x, tree.z));
    group.add(mesh);
    const width = (mesh.geometry as THREE.PlaneGeometry).parameters.width;
    group.add(contactShadow('Tree shadow', shadow, width * 0.8, width * 0.5, tree.x, tree.z));
  }
  for (const position of LAMPS) {
    group.add(faceCamera(standee('Lamp', lamp, LAMP_HEIGHT, position.x, position.z)));
    group.add(contactShadow('Lamp shadow', shadow, 0.7, 0.4, position.x, position.z));
  }

  islands.wrapS = THREE.RepeatWrapping;
  const horizon = standee('Far | islands', islands, ISLANDS.height, (ISLANDS.minX + ISLANDS.maxX) / 2, ISLANDS.z, ISLANDS.bottom);
  horizon.scale.x = (ISLANDS.maxX - ISLANDS.minX) / (horizon.geometry as THREE.PlaneGeometry).parameters.width;
  islands.repeat.x = (ISLANDS.maxX - ISLANDS.minX) / ISLANDS.repeat;
  group.add(horizon);
  group.add(farStandee('Far | park south', farPark, [FAR.east, FAR.south], [FAR.west, FAR.south], FAR.repeat));
  group.add(farStandee('Far | park west', farPark, [FAR.west, FAR.south], [FAR.west, EDGE_Z], FAR.repeat));
  group.add(farStandee('Far | park east', farPark, [FAR.east, EDGE_Z], [FAR.east, FAR.south], FAR.repeat));
  return group;
}

export function disposePaintedSeaside(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  group.removeFromParent();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
