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
 */
export const HORIZON_ROW = 248 / 1024;
/** The ground tile covers this many metres. */
const GROUND_TILE = 60;

/** One 90-degree band, heading 0 = -z, turning right (+x) as `tile` increases. */
function band(tile: number, map: THREE.Texture): THREE.Mesh {
  const R = PANORAMA.radius;
  const width = R * Math.PI / 2;
  const image = map.image as { width: number; height: number };
  const height = width * image.height / image.width;
  const top = PANORAMA.horizonY + height * HORIZON_ROW;
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
  map.wrapS = THREE.ClampToEdgeWrapping;
  const material = new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
  });
  material.userData.cel = false;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `Panorama ${tile}`;
  // Drawn first among the set, right over the sky.
  mesh.renderOrder = -10;
  return mesh;
}

export function buildPanorama(tiles: THREE.Texture[], ground: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Panorama';
  tiles.forEach((map, i) => group.add(band(i, map)));
  ground.wrapS = ground.wrapT = THREE.RepeatWrapping;
  const R = PANORAMA.radius;
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
