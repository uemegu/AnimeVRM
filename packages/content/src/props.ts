import * as THREE from 'three';
import type { HeldItemId } from '@anime-vrm/scenario';
import { PHONE_LENGTH, PHONE_THICKNESS, PHONE_WIDTH, registerHeldItem, type HeldItemSpec } from '@anime-vrm/engine/avatar/heldItem';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';

/** 手に持つ小物（缶・紙パック・スマホ・本（開いた本・閉じた本）・ノート）の形と見た目。寸法は実物の大きさ */

const TEXTURES = '/textures/props';
const OUTLINE = '#2a2230';
const loader = new THREE.TextureLoader();

function texture(name: string): THREE.Texture {
  const map = loader.load(resolveAssetUrl(`${TEXTURES}/${name}.avif`));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

/** キャラと同じセルの陰影（2段） */
let gradient: THREE.DataTexture | null = null;
function toon(color: THREE.ColorRepresentation, map?: THREE.Texture): THREE.MeshToonMaterial {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, map, gradientMap: gradient });
}

/** 裏面を少し太らせた輪郭線（キャラの線に合わせる） */
function withOutline(mesh: THREE.Mesh, width = 0.0035): THREE.Group {
  const group = new THREE.Group();
  const geometry = mesh.geometry.clone();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide }));
  outline.scale.set(1 + (2 * width) / Math.max(size.x, 1e-3), 1 + (2 * width) / Math.max(size.y, 1e-3), 1 + (2 * width) / Math.max(size.z, 1e-3));
  group.add(mesh, outline);
  return group;
}

/** 缶（190g のコーヒー缶くらい）の半径 */
const CAN_RADIUS = 0.027;

/** 缶：y 軸が缶の軸。側面にラベルを巻き、上下は金属 */
function can(label: string): THREE.Object3D {
  const metal = toon('#cfd3d8');
  const side = toon('#ffffff', texture(label));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(CAN_RADIUS, CAN_RADIUS, 0.105, 24, 1), [side, metal, metal]);
  return withOutline(body);
}

/** 紙パック：y 軸が縦。4面に同じ柄、上にストロー */
function carton(): THREE.Object3D {
  const art = toon('#ffffff', texture('carton_ichigo'));
  const plain = toon('#fbe3ea');
  const group = new THREE.Group();
  group.add(withOutline(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.088, 0.034), [art, art, plain, plain, art, art])));
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.07, 8).rotateZ(0.25), toon('#f4f4f4'));
  straw.position.set(-0.008, 0.074, 0);
  group.add(straw);
  return group;
}

/** スマホ：y 軸が長辺、z 軸が画面の向き */
function phone(): THREE.Object3D {
  const back = toon('#e9e4ef');
  const screen = toon('#1b2230');
  const edge = toon('#b9b3c2');
  return withOutline(new THREE.Mesh(new THREE.BoxGeometry(PHONE_WIDTH, PHONE_LENGTH, PHONE_THICKNESS), [edge, edge, edge, edge, screen, back]), 0.0025);
}

/** 開いた本：x 軸が左右、z 軸がページの向き（読む人の側） */
function openBook(): THREE.Object3D {
  const pages = toon('#ffffff', texture('book_pages'));
  const cover = toon('#ffffff', texture('book_cover'));
  const paper = toon('#efe6cf');
  const group = new THREE.Group();
  // 見開きを少しV字に開く
  for (const sign of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.012), [paper, paper, paper, paper, pages, cover]);
    const uv = half.geometry.attributes.uv as THREE.BufferAttribute;
    // +z 面（ページ）は見開きの半分ずつを貼る
    for (let i = 16; i < 20; i++) uv.setX(i, sign < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
    const pivot = new THREE.Group();
    const outlined = withOutline(half, 0.0025);
    outlined.position.x = sign * 0.065;
    pivot.add(outlined);
    pivot.rotation.y = -sign * 0.22;
    group.add(pivot);
  }
  return group;
}

/** 閉じたノート：y 軸が縦、z 軸が表紙の向き */
function notebook(): THREE.Object3D {
  const cover = toon('#ffffff', texture('notebook_cover'));
  const dark = toon('#1f2a44');
  const paper = toon('#efe9dc');
  return withOutline(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.018), [paper, dark, paper, paper, cover, dark]));
}

/** 閉じた本（ハードカバー）：y 軸が縦、z 軸が表紙の向き */
function closedBook(): THREE.Object3D {
  const cover = toon('#ffffff', texture('book_cover'));
  const spine = toon('#2f4a33');
  const paper = toon('#efe6cf');
  return withOutline(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.03), [paper, spine, paper, paper, cover, cover]));
}


const ITEMS: Record<HeldItemId, HeldItemSpec> = {
  can_coffee: { grip: 'fist', hand: 'right', build: () => can('can_coffee_label'), radius: CAN_RADIUS, shape: 'cylinder' },
  can_juice: { grip: 'fist', hand: 'right', build: () => can('can_juice_label'), radius: CAN_RADIUS, shape: 'cylinder' },
  carton_ichigo: { grip: 'fist', hand: 'right', build: carton, radius: 0.017 },
  phone: { grip: 'palm', hand: 'right', build: phone },
  book_open: { grip: 'both', hand: 'right', build: openBook },
  notebook: { grip: 'chest', hand: 'right', build: notebook },
  book: { grip: 'chest', hand: 'right', build: closedBook },
};

export function registerProps(): void {
  for (const [id, spec] of Object.entries(ITEMS)) registerHeldItem(id, spec);
}
