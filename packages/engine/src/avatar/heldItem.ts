import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { HeldItemId } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '../utils/path';
import { forEachVertex, mainBone, measureHand, restPosition, skinPart } from './handShape';
import { reach } from './handClearance';

/**
 * 手に持つ小物（缶・紙パック・スマホ・本・ノート）。
 * 骨の向きはモデルごとに違うので、毎フレーム、手首と指の付け根の位置から手のひらの向きを求めて置く。
 * 持つ手の指（親指を含む）は、モーションの指の形を捨てて小物に合わせた形にする。
 * 寸法は実物の大きさで作り、キャラの手の大きさに合わせて縮める（アニメ調のモデルは手が小さい）。
 */

type Side = 'left' | 'right';
/** fist = 握る、palm = 背面を手のひらに当てて指を添える、both = 両手で開いて持つ、chest = 胸に抱える */
type Grip = 'fist' | 'palm' | 'both' | 'chest';

interface ItemSpec {
  grip: Grip;
  hand: Side;
  build: () => THREE.Object3D;
  /** 握る小物の太さの半分（手のひらから中心までの距離と、指の曲げの深さを決める） */
  radius?: number;
  /** 指が当たるかを調べる形。省略で箱 */
  shape?: 'cylinder';
}

const TEXTURES = '/textures/props';
const OUTLINE = '#2a2230';
/** 手首が耳からこの距離より近ければ、電話を耳に当てる */
const EAR_SNAP_DISTANCE = 0.25;
/** 耳に当てた電話の傾き（縦から後ろへ、ラジアン）。上端が耳、下端が口元の向き */
const EAR_TILT = 0.5;
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

const PHONE_LENGTH = 0.148;
const PHONE_THICKNESS = 0.009;
const PHONE_WIDTH = 0.071;

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

const ITEMS: Record<HeldItemId, ItemSpec> = {
  can_coffee: { grip: 'fist', hand: 'right', build: () => can('can_coffee_label'), radius: CAN_RADIUS, shape: 'cylinder' },
  can_juice: { grip: 'fist', hand: 'right', build: () => can('can_juice_label'), radius: CAN_RADIUS, shape: 'cylinder' },
  carton_ichigo: { grip: 'fist', hand: 'right', build: carton, radius: 0.017 },
  phone: { grip: 'palm', hand: 'right', build: phone },
  book_open: { grip: 'both', hand: 'right', build: openBook },
  notebook: { grip: 'chest', hand: 'right', build: notebook },
};

/** 実物の手（手首から中指の付け根まで）の長さ。小物はこの手に合わせた寸法で作ってある */
const REAL_HAND_LENGTH = 0.095;

/** 指を曲げる角度（付け根・中・先、ラジアン）。まっすぐ伸ばした指からの角度。握る小物は太さから求める */
const CURL: Record<'palm' | 'both', [number, number, number]> = {
  // 背面に指の腹を添える（曲げると指が小物に入る）
  palm: [0.12, 0, 0],
  both: [0.35, 0.45, 0.25],
};
/** 握るときに曲げられる上限（付け根・中・先） */
const MAX_CURL: [number, number, number] = [1.6, 1.9, 1.3];
/** 平たい物の向こうの縁へ指を巻き付ける上限（中・先）。付け根の節は背面に当てる */
const EDGE_CURL: [number, number] = [1.7, 1.3];
/** 握る物を、高さのこの割合だけ人差し指の側へずらして持つ */
const GRIP_RAISE = 0.22;
/** 握る物に巻き付けた親指の先の位置。円柱の断面で、手のひらの接点から手首の側へ回る角度 */
const THUMB_WRAP_ANGLE = 2.6;
/**
 * 親指の形の範囲（ラジアン）。中手の骨の向きは、手のひらの面から手のひらの前へ起こす角（rise）と、
 * 指の向きから人差し指の側へ開く角（open）で決める。付け根の節・先の節は、親指の腹の向きへ曲げるだけ
 */
const THUMB_RANGE = {
  rise: [0.1, 1.1],
  open: [0.25, 1.2],
  proximal: [0, 0.9],
  distal: [0, 1.2],
} as const;
/** 電話を手の中で斜めに持つ角度（指の付け根の並びから指先の側へ、ラジアン）。手に持つとき・耳に当てるとき */
const PHONE_HOLD_ANGLE = 0.5;
const PHONE_EAR_ANGLE = 0.7;
/** 耳に当てるとき、手首を前腕の向きから曲げてよい角度（ラジアン） */
const WRIST_DEVIATION = 0.35;
const THUMB: Record<Grip, [number, number, number]> = {
  fist: [0.6, 0.55, 0.45],
  palm: [0, 0, 0],
  both: [0.3, 0.2, 0.15],
  chest: [0, 0, 0],
};
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const;
const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const;
const THUMB_JOINTS = ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'] as const;

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
const _r = new THREE.Quaternion();

export class HeldItem {
  private item: { id: HeldItemId; hand: Side } | null = null;
  private object: THREE.Object3D | null = null;
  /** 前のフレームで書き換えた骨と、書き換える前の回転（モーションが指を動かさない場合に備えて、次のフレームで戻す） */
  private applied: Array<{ bone: THREE.Object3D; before: THREE.Quaternion }> = [];
  /** 小物の外形（小物のローカル座標） */
  private bounds: THREE.Box3 | null = null;
  private probes: THREE.Vector3[] = [];
  /** 手のひらに当てる物の背面の高さ（applyGrip で指の形から求める） */
  private palmOffset = 0.012;
  /** 電話を手の中で傾ける角度（指の付け根の並びから指先の側へ）。耳に当てるときに決める */
  private phoneAngle = PHONE_HOLD_ANGLE;
  /** 電話を耳に当てているか（applyGrip で決める） */
  private atEar = false;

  /** 読み込み時の手の形（骨ごとの太さと長さ）。指が小物に入らないよう、置き場所と指の曲げをこれに合わせる */
  private readonly shape: Record<Side, Map<string, { radius: number; length: number }>>;

  constructor(private readonly vrm: VRM) {
    vrm.scene.updateMatrixWorld(true);
    const skin = skinPart(vrm);
    const measure = (side: Side) => {
      const map = new Map<string, { radius: number; length: number }>();
      for (const segment of measureHand(vrm, side, skin) ?? []) {
        if (segment.kind === 'forearm' || map.has(segment.bone)) continue;
        map.set(segment.bone, { radius: segment.radius, length: segment.start.distanceTo(segment.end) });
      }
      return map;
    };
    this.shape = { left: measure('left'), right: measure('right') };
    this.ears = this.measureEars();
    this.thumbPad = { left: this.measureThumbPad('left'), right: this.measureThumbPad('right') };
  }

  /** 伸ばした親指の腹の向き（親指の先の正規化ボーンのローカル座標）。測れなければ null */
  private readonly thumbPad: Record<Side, THREE.Vector3 | null>;

  /**
   * 親指の先の節の肌の断面から、厚みの向き（爪と腹を結ぶ向き）を測る。親指は幅より厚みが薄いので、
   * 骨に直交する面での広がりがいちばん小さい向きが厚みの向き。向きは手のひらの側（腹の側）にそろえる
   */
  private measureThumbPad(side: Side): THREE.Vector3 | null {
    const humanoid = this.vrm.humanoid;
    const proximal = humanoid.getRawBoneNode(`${side}ThumbProximal`);
    const distal = humanoid.getRawBoneNode(`${side}ThumbDistal`);
    const f = this.handFrame(side);
    if (!proximal || !distal || !f) return null;
    const start = proximal.getWorldPosition(new THREE.Vector3());
    const joint = distal.getWorldPosition(new THREE.Vector3());
    const axis = joint.clone().sub(start).normalize();
    const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    const points: Array<[number, number]> = [];
    forEachVertex(this.vrm, (mesh, vertex) => {
      if (mainBone(mesh, vertex) !== distal) return;
      const d = restPosition(mesh, vertex).sub(joint);
      points.push([d.dot(u), d.dot(v)]);
    });
    if (points.length < 12) return null;
    const mean = points.reduce((m, [a, b]) => [m[0] + a / points.length, m[1] + b / points.length], [0, 0]);
    let xx = 0, xy = 0, yy = 0;
    for (const [a, b] of points) {
      xx += (a - mean[0]) ** 2;
      xy += (a - mean[0]) * (b - mean[1]);
      yy += (b - mean[1]) ** 2;
    }
    // 2x2 の共分散のうち、小さい固有値の固有ベクトル
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy) + Math.PI / 2;
    const pad = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle)).normalize();
    if (pad.dot(f.palm) < 0) pad.negate();
    // 正規化ボーンの座標で持つ（シーンの回転に左右されないように）
    const normalized = humanoid.getNormalizedBoneNode(`${side}ThumbDistal`);
    return normalized ? pad.applyQuaternion(normalized.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
  }

  /** 左右の耳に電話を当てる位置（頭の骨のローカル座標）。髪が耳を覆っていれば髪の外側 */
  private readonly ears: Record<Side, THREE.Vector3> | null;

  private measureEars(): Record<Side, THREE.Vector3> | null {
    const raw = this.vrm.humanoid.getRawBoneNode('head');
    const bone = this.vrm.humanoid.getNormalizedBoneNode('head');
    if (!raw || !bone) return null;
    const isHair = (mesh: THREE.SkinnedMesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((m) => /hair/i.test(m.name));
    // 肌（髪を除く頭の部品）の外形から耳の位置を見積もる
    const box = new THREE.Box3();
    forEachVertex(
      this.vrm,
      (mesh, vertex) => {
        if (mainBone(mesh, vertex) === raw) box.expandByPoint(bone.worldToLocal(restPosition(mesh, vertex)));
      },
      (mesh) => !isHair(mesh)
    );
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const y = center.y - size.y * 0.12;
    const z = center.z - size.z * 0.1;
    // 耳のまわりの髪のいちばん外側
    const reach = { left: box.max.x, right: -box.min.x };
    const near = Math.max(size.y, size.z) * 0.12;
    forEachVertex(
      this.vrm,
      (mesh, vertex) => {
        const p = bone.worldToLocal(restPosition(mesh, vertex));
        if (Math.abs(p.y - y) > near || Math.abs(p.z - z) > near) return;
        if (p.x > 0) reach.left = Math.max(reach.left, p.x);
        else reach.right = Math.max(reach.right, -p.x);
      },
      isHair
    );
    // 正規化ボーンの頭は +x がキャラの左
    return { left: new THREE.Vector3(reach.left, y, z), right: new THREE.Vector3(-reach.right, y, z) };
  }

  /** 手首と指の付け根を結ぶ線から手のひらの表面まで。測った太さは幅も含むので、厚みはその7割と見る */
  private palmThickness(side: Side): number {
    return (this.shape[side].get(`${side}Hand`)?.radius ?? 0.018) * 0.7;
  }

  private fingerRadius(side: Side, bone: string): number {
    return this.shape[side].get(bone)?.radius ?? 0.009;
  }

  set(spec: { item: HeldItemId; hand?: Side } | null | undefined): void {
    const next = spec ? { id: spec.item, hand: spec.hand ?? ITEMS[spec.item].hand } : null;
    if (next?.id === this.item?.id && next?.hand === this.item?.hand) return;
    this.removeObject();
    this.item = next;
    if (!next) return;
    this.object = ITEMS[next.id].build();
    this.object.name = `Held item | ${next.id}`;
    this.bounds = new THREE.Box3().setFromObject(this.object);
    this.object.matrixAutoUpdate = false;
    this.object.visible = false; // 最初の置き場所が決まるまで隠す
    this.vrm.scene.add(this.object);
  }

  /** モーションを再生する前に、前のフレームで曲げた指を戻す */
  restore(): void {
    for (let i = this.applied.length - 1; i >= 0; i--) this.applied[i].bone.quaternion.copy(this.applied[i].before);
    this.applied = [];
  }

  /** モーションの後（vrm.update の前）に、持つ手の指を小物に合わせた形にする */
  applyGrip(): void {
    this.probes = [];
    this.phoneAngle = PHONE_HOLD_ANGLE;
    this.atEar = false;
    if (!this.item) return;
    const spec = ITEMS[this.item.id];
    const grip = spec.grip;
    if (grip === 'chest') return;
    const sides: Side[] = grip === 'both' ? ['left', 'right'] : [this.item.hand];
    // 骨の向きはモデル（VRM0/1）で違うので、指を手のひらへ向ける回転軸を位置から求める
    const node = (name: VRMHumanBoneName) => this.vrm.humanoid.getNormalizedBoneNode(name);
    this.vrm.humanoid.normalizedHumanBonesRoot.updateWorldMatrix(true, true);
    for (const side of sides) {
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
            this.applied.push({ bone: hand, before: hand.quaternion.clone() });
            hand.quaternion.multiply(rotation);
            hand.updateMatrixWorld(true);
            f = this.handFrame(side, node) ?? f;
          }
        }
      }
      // 頭の近くで持つ電話は、耳に当てる（モーションの手の位置が口元などでも）
      if (grip === 'palm' && this.toEar(side, f, node)) f = this.handFrame(side, node) ?? f;
      // モーションの指の形は使わない。まっすぐ伸ばしてから小物に合わせて曲げる
      const fingers = [...FINGERS.flatMap((finger) => JOINTS.map((joint) => `${side}${finger}${joint}`)), ...THUMB_JOINTS.map((joint) => `${side}${joint}`)];
      for (const name of fingers) {
        const bone = node(name as VRMHumanBoneName);
        if (!bone) continue;
        this.applied.push({ bone, before: bone.quaternion.clone() });
        bone.quaternion.identity();
      }
      node(`${side}Hand`)?.updateMatrixWorld(true);
      const axis = new THREE.Vector3().crossVectors(f.along, f.palm).normalize();
      // 平たい物を持つ指は、開かずにそろえる
      if (grip === 'palm') {
        for (const finger of FINGERS) {
          const proximal = node(`${side}${finger}Proximal` as VRMHumanBoneName);
          const intermediate = node(`${side}${finger}Intermediate` as VRMHumanBoneName);
          if (!proximal || !intermediate) continue;
          const dir = intermediate.getWorldPosition(new THREE.Vector3()).sub(proximal.getWorldPosition(new THREE.Vector3()));
          dir.addScaledVector(f.palm, -dir.dot(f.palm)).normalize();
          const angle = Math.atan2(new THREE.Vector3().crossVectors(dir, f.along).dot(f.palm), dir.dot(f.along));
          this.bend(proximal, f.palm, angle);
        }
      }
      // 握る物は、指の節が円柱の周りに沿うように曲げる（円柱は付け根で指に接する）
      const wrapRadius = this.gripOffset(side, f);
      for (const finger of FINGERS) {
        const names = JOINTS.map((joint) => `${side}${finger}${joint}`);
        const bones = names.map((name) => node(name as VRMHumanBoneName));
        const curl = grip === 'fist' ? this.wrap(bones, wrapRadius, this.shape[side].get(names[2])?.length) : CURL[grip];
        bones.forEach((bone, i) => this.bend(bone, axis, curl[i]));
      }
      if (grip === 'palm') {
        // 電話は指に対して斜めに持つ。背面は指の腹に当て、向こうの縁は中の関節の手前に置き、
        // 中・先の節を縁へ巻き付ける（小物に当たる手前で止める）。耳に当てるときは人差し指を背面に伸ばしたままにする
        this.palmOffset = this.backOffset(side, f, node);
        const world = this.worldMatrix(node);
        if (world) {
          for (const finger of FINGERS) {
            if (this.atEar && finger === 'Index') continue;
            const bones = JOINTS.map((joint) => node(`${side}${finger}${joint}` as VRMHumanBoneName));
            if (bones.some((bone) => !bone)) continue;
            const chain = bones as THREE.Object3D[];
            const tipLength = this.shape[side].get(`${side}${finger}Distal`)?.length ?? 0.015;
            const touches = () => this.chainTouches(side, chain, 1, tipLength, `${side}${finger}`, world);
            this.bendUntil(chain[1], axis, EDGE_CURL[0], touches);
            this.bendUntil(chain[2], axis, EDGE_CURL[1], touches);
          }
        }
      }
      const thumb = THUMB_JOINTS.map((joint) => node(`${side}${joint}` as VRMHumanBoneName));
      const thumbAxis = (i: number) => {
        const from = thumb[i]!.getWorldPosition(new THREE.Vector3());
        const next = thumb[i + 1] ?? null;
        const to = next ? next.getWorldPosition(new THREE.Vector3()) : from.clone().sub(thumb[i - 1]?.getWorldPosition(new THREE.Vector3()) ?? f.wrist).add(from);
        return new THREE.Vector3().crossVectors(to.sub(from).normalize(), f.palm).normalize();
      };
      if (grip === 'fist' || grip === 'palm') {
        // 親指は人の親指が取れる形の中から、小物に当たらず目標に近い形を探す。
        // 握る物は円柱の向こう側（指と反対の側から巻き付く）、電話は手前の縁が目標
        const world = this.worldMatrix(node);
        if (world) this.poseThumb(side, thumb, f, world, grip);
        continue;
      }
      // 親指は向きが指ごとに違うので、関節ごとに「今の親指の向きを手のひらへ倒す」軸で曲げる
      thumb.forEach((bone, i) => bone && this.bend(bone, thumbAxis(i), THUMB[grip][i]));
    }
    // 片手で持つ小物は、手が肌に入らない処理で手の一部として扱う（顔や太ももに小物が入らないように）
    if (grip !== 'both' && this.bounds) {
      const hand = node(`${this.item.hand}Hand`);
      const world = this.worldMatrix(node);
      if (hand && world) {
        const { min, max } = this.bounds;
        for (const x of [0, 0.5, 1]) for (const y of [0, 0.5, 1]) for (const z of [0, 0.5, 1]) {
          if (x === 0.5 && y === 0.5 && z === 0.5) continue;
          const point = new THREE.Vector3(THREE.MathUtils.lerp(min.x, max.x, x), THREE.MathUtils.lerp(min.y, max.y, y), THREE.MathUtils.lerp(min.z, max.z, z));
          this.probes.push(hand.worldToLocal(point.applyMatrix4(world)));
        }
      }
    }
  }

  /** 小物の形を調べる点（持つ手の正規化ボーンのローカル座標）。applyGrip で作り直す */
  itemProbes(): { side: Side; points: THREE.Vector3[] } | null {
    return this.item && this.probes.length ? { side: this.item.hand, points: this.probes } : null;
  }

  /**
   * 手が頭の近くにあれば、手の向きと位置を変えて電話の上端を耳に当てる（腕は2ボーン IK で解き直す）。
   * 手のひらを頭へ向け、指は口元から耳への向き（上やや後ろ）にそろえる。耳に入った分は手が肌に入らない処理が押し出す
   */
  private toEar(side: Side, f: HandFrame, node: (name: VRMHumanBoneName) => THREE.Object3D | null): boolean {
    const head = node('head');
    const upper = node(`${side}UpperArm`);
    const lower = node(`${side}LowerArm`);
    const hand = node(`${side}Hand`);
    if (!head || !upper || !lower || !hand || !this.ears) return false;
    // 頭のローカル座標は、正規化ボーンなので +x がキャラの左、+y が上、+z が前
    const outward = side === 'left' ? 1 : -1;
    const ear = head.localToWorld(this.ears[side].clone());
    if (f.wrist.distanceTo(ear) > EAR_SNAP_DISTANCE) return false;

    const headQ = head.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(headQ);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(headQ);
    const toHead = new THREE.Vector3(-outward, 0, 0).applyQuaternion(headQ);
    // 電話の長辺は口元から耳へ（上へ、少し後ろへ）
    const phoneUp = up.clone().multiplyScalar(Math.cos(EAR_TILT)).addScaledVector(forward, -Math.sin(EAR_TILT)).normalize();
    const sign = side === 'left' ? 1 : -1;
    const scale = this.scaleFor(f);
    for (const bone of [upper, lower, hand]) this.applied.push({ bone, before: bone.quaternion.clone() });
    // 手のひらは頭へ向け（前腕まわりのひねり）、指の向きは前腕の向きから WRIST_DEVIATION までの範囲で曲げる。
    // その範囲で、電話の長辺（口元から耳）が手の中で PHONE_EAR_ANGLE の斜めになる向きを選ぶ。
    // 手首の位置で前腕の向きが変わるので、数回解き直す
    this.atEar = true;
    for (let iteration = 0; iteration < 4; iteration++) {
      const elbow = lower.getWorldPosition(new THREE.Vector3());
      const forearm = hand.getWorldPosition(new THREE.Vector3()).sub(elbow).normalize();
      const palm = toHead.clone().addScaledVector(forearm, -toHead.dot(forearm)).normalize();
      let best: { along: THREE.Vector3; across: THREE.Vector3; angle: number; top: number } | null = null;
      for (let i = 0; i <= 14; i++) {
        const deviation = -WRIST_DEVIATION + (2 * WRIST_DEVIATION * i) / 14;
        const along = forearm.clone().applyAxisAngle(palm, deviation);
        const across = new THREE.Vector3().crossVectors(palm, along).multiplyScalar(sign);
        // 手の中での電話の角度（指の付け根の並びから、指先の側へ）。どちらの端を上にしてもよい
        let angle = Math.atan2(phoneUp.dot(along), phoneUp.dot(across));
        let top = 1;
        if (angle > Math.PI / 2) (angle -= Math.PI), (top = -1);
        else if (angle <= -Math.PI / 2) (angle += Math.PI), (top = -1);
        if (!best || Math.abs(angle - PHONE_EAR_ANGLE) < Math.abs(best.angle - PHONE_EAR_ANGLE)) best = { along, across, angle, top };
      }
      const { along, across, top } = best!;
      this.phoneAngle = THREE.MathUtils.clamp(best!.angle, PHONE_HOLD_ANGLE * 0.5, PHONE_EAR_ANGLE * 1.5);
      // 手の向きを合わせる
      const current = this.handFrame(side, node);
      if (!current) break;
      const from = new THREE.Matrix4().makeBasis(current.along, current.palm, new THREE.Vector3().crossVectors(current.along, current.palm));
      const to = new THREE.Matrix4().makeBasis(along, palm, new THREE.Vector3().crossVectors(along, palm));
      const turn = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
      hand.quaternion.premultiply(hand.parent!.getWorldQuaternion(_q).invert().multiply(turn).multiply(hand.parent!.getWorldQuaternion(new THREE.Quaternion())));
      hand.updateMatrixWorld(true);
      // 電話の上端の画面が耳に来る手首の位置
      const frame = { ...current, wrist: hand.getWorldPosition(new THREE.Vector3()), along, across, palm };
      const offset = this.phoneOffset(side, frame);
      const axis = this.phoneAxis(frame).multiplyScalar(top);
      const wrist = ear.clone().sub(offset).addScaledVector(axis, -PHONE_LENGTH * scale * 0.42).addScaledVector(palm, -(PHONE_THICKNESS / 2) * scale);
      const handWorld = hand.getWorldQuaternion(new THREE.Quaternion());
      reach(upper, lower, hand, wrist);
      hand.quaternion.copy(lower.getWorldQuaternion(_q).invert().multiply(handWorld));
      hand.updateMatrixWorld(true);
    }
    return true;
  }

  /**
   * 手首から電話の中心まで（ワールドの向き）。長辺は指の付け根の並びから phoneAngle だけ指先の側へ傾け、
   * 指先の側の縁を中指の中の関節の手前に置く。背面は指の腹に当てる
   */
  private phoneOffset(side: Side, f: HandFrame): THREE.Vector3 {
    const scale = this.scaleFor(f);
    const proximal = this.shape[side].get(`${side}MiddleProximal`)?.length ?? f.length * 0.5;
    const radius = this.fingerRadius(side, `${side}MiddleIntermediate`);
    return f.along.clone().multiplyScalar(f.length + proximal - radius * 0.5)
      .addScaledVector(this.phoneWidth(f), -(PHONE_WIDTH / 2) * scale)
      .addScaledVector(f.palm, this.palmOffset + (PHONE_THICKNESS / 2) * scale);
  }

  /** 電話の長辺の向き（指の付け根の並びから phoneAngle だけ指先の側へ） */
  private phoneAxis(f: HandFrame): THREE.Vector3 {
    return f.across.clone().multiplyScalar(Math.cos(this.phoneAngle)).addScaledVector(f.along, Math.sin(this.phoneAngle));
  }

  /** 電話の幅の向き（手の面の中で長辺に直交し、指先の側） */
  private phoneWidth(f: HandFrame): THREE.Vector3 {
    return f.along.clone().multiplyScalar(Math.cos(this.phoneAngle)).addScaledVector(f.across, -Math.sin(this.phoneAngle));
  }

  /** 握る円柱の中心から、手首と指の付け根を結ぶ線まで（円柱の半径＋手のひら・指の厚み） */
  private gripOffset(side: Side, f: HandFrame): number {
    const radius = (ITEMS[this.item!.id].radius ?? 0.03) * this.scaleFor(f);
    return radius + Math.max(this.palmThickness(side), this.fingerRadius(side, `${side}MiddleIntermediate`));
  }

  /** 手のひらに当てる平たい物の背面を置く高さ（手のひらの向きに、手首から）。伸ばした指の腹がいちばん出ている所に合わせる */
  private backOffset(side: Side, f: HandFrame, node: (name: VRMHumanBoneName) => THREE.Object3D | null, fingers: readonly string[] = FINGERS): number {
    let offset = this.palmThickness(side);
    for (const finger of fingers) {
      const names = JOINTS.map((joint) => `${side}${finger}${joint}`);
      const points = names.map((name) => node(name as VRMHumanBoneName)?.getWorldPosition(new THREE.Vector3()) ?? null);
      if (points.some((p) => !p)) continue;
      const [, intermediate, distal] = points as THREE.Vector3[];
      const tip = distal.clone().addScaledVector(distal.clone().sub(intermediate).normalize(), this.shape[side].get(names[2])?.length ?? 0.015);
      [...(points as THREE.Vector3[]), tip].forEach((point, i) => {
        const radius = this.fingerRadius(side, names[Math.min(i, 2)]);
        offset = Math.max(offset, point.clone().sub(f.wrist).dot(f.palm) + radius);
      });
    }
    return offset;
  }

  /** 半径 radius の円柱に巻き付く指の曲げ角。節の長さを弦として、付け根で接する円に沿わせる */
  private wrap(bones: Array<THREE.Object3D | null>, radius: number, tipLength?: number): [number, number, number] {
    const [proximal, intermediate, distal] = bones.map((bone) => bone?.getWorldPosition(new THREE.Vector3()) ?? null);
    if (!proximal || !intermediate || !distal) return [0.8, 0.9, 0.5];
    const lengths = [proximal.distanceTo(intermediate), intermediate.distanceTo(distal)];
    lengths.push(tipLength ?? lengths[1] * 0.8);
    const turn = lengths.map((length) => 2 * Math.asin(Math.min(1, length / (2 * radius))));
    return [turn[0] / 2, (turn[0] + turn[1]) / 2, (turn[1] + turn[2]) / 2].map((angle, i) => Math.min(angle, MAX_CURL[i])) as [number, number, number];
  }

  /**
   * 親指の形を、人の親指が取れる形の中から選ぶ。
   * 中手の骨の向きは、手のひらの面から前へ起こす角（rise）と、指の向きから人差し指の側へ開く角（open）で決め、
   * 付け根の節・先の節は、親指の腹の向き（小物の側）へ同じ面の中で曲げるだけにする。横へ折れたり反ったりする形は作らない。
   * この形の範囲を探し、小物に当たらず、親指の腹が目標にいちばん近い形にする
   */
  private poseThumb(side: Side, thumb: Array<THREE.Object3D | null>, f: HandFrame, world: THREE.Matrix4, grip: 'fist' | 'palm'): void {
    if (thumb.some((bone) => !bone)) return;
    const bones = thumb as THREE.Object3D[];
    const at = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());
    // 伸ばした親指（全関節が初期の向き）の骨の向きと長さ
    const base = at(bones[0]);
    const restJoints = [base, at(bones[1]), at(bones[2])];
    const restDirs = [restJoints[1].clone().sub(restJoints[0]).normalize(), restJoints[2].clone().sub(restJoints[1]).normalize()];
    restDirs.push(restDirs[1].clone());
    const restWorld = bones.map((bone) => bone.getWorldQuaternion(new THREE.Quaternion()));
    const lengths = [restJoints[0].distanceTo(restJoints[1]), restJoints[1].distanceTo(restJoints[2]), this.shape[side].get(`${side}ThumbDistal`)?.length ?? 0.015];
    const radii = THUMB_JOINTS.map((joint) => this.fingerRadius(side, `${side}${joint}`) * 0.5);
    const focus = new THREE.Vector3().setFromMatrixPosition(world);
    const inverse = world.clone().invert();
    const scale = world.getMaxScaleOnAxis();

    const perpendicular = (v: THREE.Vector3, d: THREE.Vector3, fallback: THREE.Vector3) => {
      const out = v.clone().addScaledVector(d, -v.dot(d));
      return out.lengthSq() > 1e-8 ? out.normalize() : fallback.clone().addScaledVector(d, -fallback.dot(d)).normalize();
    };
    const chain = (rise: number, open: number, proximalAngle: number, distalAngle: number) => {
      const d0 = f.along.clone().multiplyScalar(Math.cos(open)).addScaledVector(f.across, Math.sin(open)).multiplyScalar(Math.cos(rise)).addScaledVector(f.palm, Math.sin(rise)).normalize();
      const n0 = perpendicular(focus.clone().sub(base), d0, f.palm);
      const d1 = d0.clone().multiplyScalar(Math.cos(proximalAngle)).addScaledVector(n0, Math.sin(proximalAngle));
      const n1 = n0.clone().multiplyScalar(Math.cos(proximalAngle)).addScaledVector(d0, -Math.sin(proximalAngle));
      const d2 = d1.clone().multiplyScalar(Math.cos(distalAngle)).addScaledVector(n1, Math.sin(distalAngle));
      const n2 = n1.clone().multiplyScalar(Math.cos(distalAngle)).addScaledVector(d1, -Math.sin(distalAngle));
      const p1 = base.clone().addScaledVector(d0, lengths[0]);
      const p2 = p1.clone().addScaledVector(d1, lengths[1]);
      const p3 = p2.clone().addScaledVector(d2, lengths[2]);
      return { dirs: [d0, d1, d2], pads: [n0, n1, n2], joints: [base, p1, p2, p3] };
    };
    // 中手の骨の根元の側は手のひらのふくらみの中なので、先の側から調べる
    const collides = (joints: THREE.Vector3[]) => {
      for (let i = 0; i < 3; i++) {
        for (const t of i === 0 ? [0.7, 1] : [0.5, 1]) {
          if (this.insideItem(joints[i].clone().lerp(joints[i + 1], t), radii[i], inverse, scale)) return true;
        }
      }
      return false;
    };
    const target = this.thumbTarget(side, f, world, grip, base, lengths[0] + lengths[1]);
    const steps = (range: readonly [number, number], count: number) => Array.from({ length: count }, (_, i) => range[0] + ((range[1] - range[0]) * i) / (count - 1));
    let best: ReturnType<typeof chain> | null = null;
    let bestScore = Infinity;
    for (const rise of steps(THUMB_RANGE.rise, 9)) {
      for (const open of steps(THUMB_RANGE.open, 9)) {
        for (const proximalAngle of steps(THUMB_RANGE.proximal, 7)) {
          for (const distalAngle of steps(THUMB_RANGE.distal, 7)) {
            const candidate = chain(rise, open, proximalAngle, distalAngle);
            const [, , p2] = candidate.joints;
            const pad = p2.clone().addScaledVector(candidate.dirs[2], lengths[2] * 0.5).addScaledVector(candidate.pads[2], radii[2]);
            const score = pad.distanceTo(target);
            if (score >= bestScore || collides(candidate.joints)) continue;
            bestScore = score;
            best = candidate;
          }
        }
      }
    }
    if (!best) best = chain(0.3, 0.6, 0.2, 0.2);
    // 骨に当てる：伸ばした親指の（向き, 腹）を、選んだ形の（向き, 腹）へ回す
    let parentWorld = bones[0].parent!.getWorldQuaternion(new THREE.Quaternion());
    // 伸ばした親指の腹の向きは、メッシュから測った向きを今の手に移して使う（親指の骨はどれも初期の向きなので同じ座標）
    const measured = this.thumbPad[side];
    bones.forEach((bone, i) => {
      const restPad = measured
        ? perpendicular(measured.clone().applyQuaternion(restWorld[i]), restDirs[i], f.palm)
        : perpendicular(f.palm, restDirs[i], f.across);
      const from = new THREE.Matrix4().makeBasis(restDirs[i], restPad, new THREE.Vector3().crossVectors(restDirs[i], restPad));
      const to = new THREE.Matrix4().makeBasis(best!.dirs[i], best!.pads[i], new THREE.Vector3().crossVectors(best!.dirs[i], best!.pads[i]));
      const turn = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
      const worldQ = turn.multiply(restWorld[i]);
      bone.quaternion.copy(parentWorld.clone().invert().multiply(worldQ));
      bone.updateMatrixWorld(true);
      parentWorld = worldQ;
    });
  }

  /** 点（半径 radius の球）が小物の外形に入っているか。inverse は小物の置き場所の逆行列 */
  private insideItem(point: THREE.Vector3, radius: number, inverse: THREE.Matrix4, scale: number): boolean {
    if (!this.bounds) return false;
    const p = point.clone().applyMatrix4(inverse);
    const r = radius / scale;
    const box = this.bounds;
    const spec = ITEMS[this.item!.id];
    if (spec.shape === 'cylinder') return Math.hypot(p.x, p.z) < spec.radius! + r && p.y > box.min.y - r && p.y < box.max.y + r;
    return p.x > box.min.x - r && p.x < box.max.x + r && p.y > box.min.y - r && p.y < box.max.y + r && p.z > box.min.z - r && p.z < box.max.z + r;
  }

  /**
   * 親指の腹を置く所。握る物は円柱の向こう側（手のひらの接点から手首の側へ回った所）、
   * 電話は手前の縁（指先と反対の側）の外。reach は親指の付け根から腹までのおおよその長さ
   */
  private thumbTarget(side: Side, f: HandFrame, world: THREE.Matrix4, grip: 'fist' | 'palm', base: THREE.Vector3, reach: number): THREE.Vector3 {
    const center = new THREE.Vector3().setFromMatrixPosition(world);
    const scale = world.getMaxScaleOnAxis();
    const axis = new THREE.Vector3().setFromMatrixColumn(world, 1).normalize();
    const thumbRadius = this.fingerRadius(side, `${side}ThumbDistal`) * 0.5;
    const half = this.bounds ? ((this.bounds.max.y - this.bounds.min.y) / 2) * scale : 0;
    if (grip === 'fist') {
      const radius = (ITEMS[this.item!.id].radius ?? 0.03) * scale + thumbRadius;
      const height = THREE.MathUtils.clamp(base.clone().sub(center).dot(axis), -half * 0.6, half * 0.6);
      return center
        .addScaledVector(f.palm, -Math.cos(THUMB_WRAP_ANGLE) * radius)
        .addScaledVector(f.along, -Math.sin(THUMB_WRAP_ANGLE) * radius)
        .addScaledVector(axis, height);
    }
    // 手前の縁の線の上で、親指の届くあたり
    const width = this.phoneWidth(f);
    const edge = center.clone().addScaledVector(width, -((PHONE_WIDTH / 2) * scale + thumbRadius));
    const toward = base.clone().addScaledVector(f.along, reach * 0.6).sub(edge).dot(axis);
    return edge.addScaledVector(axis, THREE.MathUtils.clamp(toward, -half * 0.8, half * 0.8));
  }

  /** 骨を少しずつ曲げ、touches が真になる手前で止める */
  private bendUntil(bone: THREE.Object3D, axis: THREE.Vector3, limit: number, touches: () => boolean): void {
    const step = 0.05;
    for (let angle = step; angle <= limit + 1e-6; angle += step) {
      this.bend(bone, axis, step);
      if (touches()) {
        this.bend(bone, axis, -step);
        return;
      }
    }
  }

  /**
   * 指の節（first 番目の節から先、指先まで。節の中点と先）が、world に置いた小物の外形に入っているか。
   * 指の名前（例: rightIndex）から節ごとの太さを引く
   */
  private chainTouches(side: Side, bones: THREE.Object3D[], first: number, tipLength: number, finger: string, world: THREE.Matrix4): boolean {
    if (!this.bounds) return false;
    const inverse = _m.copy(world).invert();
    const scale = world.getMaxScaleOnAxis();
    const joints = bones.map((bone) => bone.getWorldPosition(new THREE.Vector3()));
    const last = joints.length - 1;
    joints.push(joints[last].clone().addScaledVector(joints[last].clone().sub(joints[last - 1]).normalize(), tipLength));
    const names = finger.endsWith('Thumb') ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
    const box = this.bounds;
    // 円柱（缶）は軸からの距離で調べる。y 軸が円柱の軸
    const cylinder = ITEMS[this.item!.id].shape === 'cylinder' ? ITEMS[this.item!.id].radius! : 0;
    for (let i = first; i < joints.length - 1; i++) {
      // 測った太さは付け根のふくらみや指の幅を含むので、半分を指の厚みと見る
      const radius = (this.fingerRadius(side, `${finger}${names[Math.min(i, 2)]}`) * 0.5) / scale;
      for (const t of [0.5, 1]) {
        const p = joints[i].clone().lerp(joints[i + 1], t).applyMatrix4(inverse);
        if (cylinder) {
          if (Math.hypot(p.x, p.z) < cylinder + radius && p.y > box.min.y - radius && p.y < box.max.y + radius) return true;
          continue;
        }
        if (p.x > box.min.x - radius && p.x < box.max.x + radius && p.y > box.min.y - radius && p.y < box.max.y + radius && p.z > box.min.z - radius && p.z < box.max.z + radius) return true;
      }
    }
    return false;
  }

  /** 骨を、ワールドの軸のまわりに曲げる */
  private bend(bone: THREE.Object3D | null, axis: THREE.Vector3, angle: number): void {
    if (!bone || angle === 0) return;
    const local = axis.clone().applyQuaternion(bone.getWorldQuaternion(_q).invert());
    bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(local, angle));
    bone.updateMatrixWorld(true);
  }

  /** 手の大きさに合わせた小物の縮尺 */
  private scaleFor(f: HandFrame): number {
    return THREE.MathUtils.clamp(f.length / REAL_HAND_LENGTH, 0.4, 1.2);
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

  /** node を渡すと正規化ボーン（vrm.update 前の姿勢）で求める */
  private worldMatrix(node?: (name: VRMHumanBoneName) => THREE.Object3D | null): THREE.Matrix4 | null {
    const { id, hand } = this.item!;
    const grip = ITEMS[id].grip;
    if (grip === 'fist') {
      const f = this.handFrame(hand, node);
      if (!f) return null;
      // 握った指の内側。軸は指の付け根の並び（指が巻き付く向き）、人差し指の側が上。
      // 手のひらから小物の表面までにすき間を空ける
      const scale = this.scaleFor(f);
      // 握る位置は小物の下寄り（上端が人差し指の上に出て、親指が側面に届く）
      const height = this.bounds ? this.bounds.max.y - this.bounds.min.y : 0;
      const center = f.wrist.clone()
        .addScaledVector(f.along, f.length * 0.95)
        .addScaledVector(f.palm, this.gripOffset(hand, f))
        .addScaledVector(f.across, height * GRIP_RAISE * scale);
      return this.compose(f.palm.clone().negate(), f.across, center).scale(new THREE.Vector3(scale, scale, scale));
    }
    if (grip === 'palm') {
      const f = this.handFrame(hand, node);
      if (!f) return null;
      // 指の付け根の節へ渡す（耳に当てるときは斜め）。画面は手のひらの外側
      const scale = this.scaleFor(f);
      const center = f.wrist.clone().add(this.phoneOffset(hand, f));
      const axis = this.phoneAxis(f);
      return this.compose(new THREE.Vector3().crossVectors(axis, f.palm), axis, center).scale(new THREE.Vector3(scale, scale, scale));
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
