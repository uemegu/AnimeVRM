import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { HeldItemId } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '../utils/path';

/**
 * 手に持つ小物（缶・紙パック・スマホ・本・ノート）。
 * 骨の向きはモデルごとに違うので、毎フレーム、手首と指の付け根の位置から手のひらの向きを求めて置く。
 * 握る小物では、その手の指を曲げる（モーションの指の形より優先）。
 */

type Side = 'left' | 'right';
/** fist = 握る、flat = 手のひらに沿わせる、both = 両手で開いて持つ、chest = 胸に抱える */
type Grip = 'fist' | 'flat' | 'both' | 'chest';

interface ItemSpec {
  grip: Grip;
  hand: Side;
  build: () => THREE.Object3D;
  /** 握る小物の太さの半分（手のひらから中心までの距離と、指の曲げの深さを決める） */
  radius?: number;
}

const TEXTURES = '/textures/props';
const OUTLINE = '#2a2230';
/** 飲み物を立てるために手首をひねる上限（ラジアン） */
const MAX_TWIST = 1.2;
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
  return withOutline(new THREE.Mesh(new THREE.BoxGeometry(0.071, 0.148, 0.009), [edge, edge, edge, edge, screen, back]), 0.0025);
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

const ITEMS: Record<HeldItemId, ItemSpec> = {
  can_coffee: { grip: 'fist', hand: 'right', build: () => can('can_coffee_label'), radius: CAN_RADIUS },
  can_juice: { grip: 'fist', hand: 'right', build: () => can('can_juice_label'), radius: CAN_RADIUS },
  carton_ichigo: { grip: 'fist', hand: 'right', build: carton, radius: 0.017 },
  phone: { grip: 'flat', hand: 'right', build: phone },
  book_open: { grip: 'both', hand: 'right', build: openBook },
  notebook: { grip: 'chest', hand: 'right', build: notebook },
};

/** 指を曲げる角度（付け根・中・先、ラジアン） */
const CURL: Record<'fist' | 'flat', [number, number, number]> = {
  fist: [1.15, 1.25, 0.7],
  flat: [0.35, 0.45, 0.25],
};
/** 握る物の表面と手のひら・指の腹のすき間（指が小物に食い込まないように） */
const GRIP_CLEARANCE = 0.012;

/** 太い物ほど指を浅く曲げる（指先が小物の中に入らないように）。基準は紙パックくらいの太さ */
function curlFor(spec: ItemSpec): [number, number, number] {
  if (spec.grip !== 'fist') return CURL.flat;
  const scale = THREE.MathUtils.clamp(0.017 / (spec.radius ?? 0.017), 0.55, 1);
  return CURL.fist.map((angle) => angle * scale) as [number, number, number];
}
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const;
const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const;

interface HandFrame {
  wrist: THREE.Vector3;
  /** 指の向き */
  along: THREE.Vector3;
  /** 小指から人差し指への向き */
  across: THREE.Vector3;
  /** 手のひらの向き */
  palm: THREE.Vector3;
  /** 手首から中指の付け根まで */
  length: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

export class HeldItem {
  private item: { id: HeldItemId; hand: Side } | null = null;
  private object: THREE.Object3D | null = null;
  /** 前のフレームで指に入れた回転（モーションが指を動かさない場合に積み重ならないよう、次のフレームで戻す） */
  private applied: Array<{ bone: THREE.Object3D; rotation: THREE.Quaternion }> = [];

  constructor(private readonly vrm: VRM) {}

  set(spec: { item: HeldItemId; hand?: Side } | null | undefined): void {
    const next = spec ? { id: spec.item, hand: spec.hand ?? ITEMS[spec.item].hand } : null;
    if (next?.id === this.item?.id && next?.hand === this.item?.hand) return;
    this.removeObject();
    this.item = next;
    if (!next) return;
    this.object = ITEMS[next.id].build();
    this.object.name = `Held item | ${next.id}`;
    this.object.matrixAutoUpdate = false;
    this.object.visible = false; // 最初の置き場所が決まるまで隠す
    this.vrm.scene.add(this.object);
  }

  /** モーションを再生する前に、前のフレームで曲げた指を戻す */
  restore(): void {
    for (const { bone, rotation } of this.applied) bone.quaternion.multiply(rotation.invert());
    this.applied = [];
  }

  /** モーションの後（vrm.update の前）に、握る手の指を曲げる */
  applyGrip(): void {
    if (!this.item) return;
    const grip = ITEMS[this.item.id].grip;
    if (grip === 'chest') return;
    const sides: Side[] = grip === 'both' ? ['left', 'right'] : [this.item.hand];
    const curl = curlFor(ITEMS[this.item.id]);
    this.vrm.humanoid.normalizedHumanBonesRoot.updateWorldMatrix(true, true);
    for (const side of sides) {
      // 骨の向きはモデル（VRM0/1）で違うので、指を手のひらへ向ける回転軸を位置から求める
      const node = (name: VRMHumanBoneName) => this.vrm.humanoid.getNormalizedBoneNode(name);
      let f = this.handFrame(side, node);
      if (!f) continue;
      // 握った物は指の付け根の並びに沿う。飲み物は立てて持つので、前腕まわりに手首をひねって並びを縦に近づける
      if (grip === 'fist') {
        const up = new THREE.Vector3(0, 1, 0).addScaledVector(f.along, -f.along.y);
        if (up.lengthSq() > 0.1) {
          up.normalize();
          const angle = THREE.MathUtils.clamp(Math.atan2(new THREE.Vector3().crossVectors(f.across, up).dot(f.along), f.across.dot(up)), -MAX_TWIST, MAX_TWIST);
          const hand = node(`${side}Hand`);
          if (hand && Math.abs(angle) > 1e-3) {
            const rotation = new THREE.Quaternion().setFromAxisAngle(f.along.clone().applyQuaternion(hand.getWorldQuaternion(_q).invert()), angle);
            hand.quaternion.multiply(rotation);
            hand.updateMatrixWorld(true);
            this.applied.push({ bone: hand, rotation });
            f = this.handFrame(side, node) ?? f;
          }
        }
      }
      const axis = new THREE.Vector3().crossVectors(f.along, f.palm).normalize();
      for (const finger of FINGERS) {
        JOINTS.forEach((joint, i) => {
          const bone = this.vrm.humanoid.getNormalizedBoneNode(`${side}${finger}${joint}` as VRMHumanBoneName);
          if (!bone) return;
          const local = axis.clone().applyQuaternion(bone.getWorldQuaternion(_q).invert());
          const rotation = new THREE.Quaternion().setFromAxisAngle(local, curl[i]);
          bone.quaternion.multiply(rotation);
          bone.updateMatrixWorld(true);
          this.applied.push({ bone, rotation });
        });
      }
    }
  }

  /** vrm.update の後に、骨の位置から小物を置く */
  place(): void {
    if (!this.item || !this.object) return;
    const world = this.worldMatrix();
    if (!world) {
      this.object.visible = false;
      return;
    }
    this.vrm.scene.updateWorldMatrix(true, false);
    this.object.matrix.copy(_m.copy(this.vrm.scene.matrixWorld).invert().multiply(world));
    this.object.matrixWorldNeedsUpdate = true;
    this.object.visible = true;
  }

  dispose(): void {
    this.removeObject();
    this.item = null;
    this.applied = [];
  }

  private removeObject(): void {
    if (!this.object) return;
    this.object.removeFromParent();
    this.object.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (material as THREE.MeshToonMaterial).map?.dispose();
        material.dispose();
      }
    });
    this.object = null;
  }

  private bonePosition(name: VRMHumanBoneName, node = (n: VRMHumanBoneName) => this.vrm.humanoid.getRawBoneNode(n)): THREE.Vector3 | null {
    const bone = node(name);
    return bone ? bone.getWorldPosition(new THREE.Vector3()) : null;
  }

  private handFrame(side: Side, node?: (name: VRMHumanBoneName) => THREE.Object3D | null): HandFrame | null {
    const at = (name: VRMHumanBoneName) => this.bonePosition(name, node);
    const wrist = at(`${side}Hand`);
    const middle = at(`${side}MiddleProximal`);
    const index = at(`${side}IndexProximal`);
    const little = at(`${side}LittleProximal`) ?? at(`${side}RingProximal`);
    if (!wrist || !middle || !index || !little) return null;
    const along = middle.clone().sub(wrist);
    const length = along.length();
    along.normalize();
    const across = index.clone().sub(little);
    across.addScaledVector(along, -across.dot(along)).normalize();
    // T ポーズ（左手の指が +x、人差し指が前）で手のひらが下を向く向き
    const palm = new THREE.Vector3().crossVectors(along, across).multiplyScalar(side === 'left' ? 1 : -1);
    return { wrist, along, across, palm, length };
  }

  /** 軸（x, y, z）と中心から行列を作る */
  private compose(x: THREE.Vector3, y: THREE.Vector3, center: THREE.Vector3): THREE.Matrix4 {
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const yy = new THREE.Vector3().crossVectors(z, x).normalize();
    return new THREE.Matrix4().makeBasis(x.clone().normalize(), yy, z).setPosition(center);
  }

  /** キャラの正面の向き（水平） */
  private forward(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vrm.scene.getWorldQuaternion(_q));
    forward.y = 0;
    return forward.normalize();
  }

  private worldMatrix(): THREE.Matrix4 | null {
    const { id, hand } = this.item!;
    const grip = ITEMS[id].grip;
    if (grip === 'fist') {
      const f = this.handFrame(hand);
      if (!f) return null;
      // 握った指の内側。軸は指の付け根の並び（指が巻き付く向き）、人差し指の側が上。
      // 手のひらから小物の表面までにすき間を空ける
      const radius = ITEMS[id].radius ?? 0.03;
      const center = f.wrist.clone().addScaledVector(f.along, f.length * 0.85).addScaledVector(f.palm, radius + GRIP_CLEARANCE);
      return this.compose(f.palm.clone().negate(), f.across, center);
    }
    if (grip === 'flat') {
      const f = this.handFrame(hand);
      if (!f) return null;
      // 手のひらに沿わせる。長辺は指の向き、画面は手のひらの側
      const center = f.wrist.clone().addScaledVector(f.along, f.length * 0.9).addScaledVector(f.palm, 0.014);
      return this.compose(f.across.clone().multiplyScalar(hand === 'left' ? 1 : -1), f.along, center);
    }
    if (grip === 'both') {
      const left = this.handFrame('left');
      const right = this.handFrame('right');
      const head = this.bonePosition('head');
      if (!left || !right || !head) return null;
      const palmCenter = (f: HandFrame) => f.wrist.clone().addScaledVector(f.along, f.length * 0.9).addScaledVector(f.palm, 0.02);
      const l = palmCenter(left);
      const r = palmCenter(right);
      const center = l.clone().add(r).multiplyScalar(0.5);
      // ページは顔へ向け、見開きの左右は体の左右に合わせる（手の上下の並びには依らない）
      const normal = head.clone().sub(center).normalize();
      const bodyRight = this.forward().cross(new THREE.Vector3(0, 1, 0)).normalize();
      const x = bodyRight.addScaledVector(normal, -bodyRight.dot(normal)).normalize();
      const y = new THREE.Vector3().crossVectors(normal, x).normalize();
      center.addScaledVector(normal, 0.015);
      return this.compose(x, y, center);
    }
    // chest：胸の前、表紙を前に向けて立てる
    const chest = this.bonePosition('upperChest') ?? this.bonePosition('chest');
    if (!chest) return null;
    const forward = this.forward();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, forward).normalize();
    const center = chest.clone().addScaledVector(forward, 0.13).addScaledVector(up, -0.06);
    return this.compose(side, up, center);
  }
}
