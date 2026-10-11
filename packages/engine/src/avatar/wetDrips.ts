import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

/**
 * 濡れたあご・指先からポタポタ落ちる水滴。
 *
 * あごの先と中指の先で水滴が少しずつふくらみ、離れると重力で落ちる。
 * あごの滴は胸元の高さで服に吸われて消え、指先の滴は足元で小さな波紋になって消える。
 * 落ちる間隔は濡れ具合で決まる（0 で落ちない）。
 * 髪の毛先からは落とさない（毛先は髪の中にあり、真下は頭・肩・胸に入って見えない）。
 */

/** 滴がふくらむ時間（秒） */
const SWELL_SECONDS = 0.8;
const GRAVITY = 9.8;
const MAX_DROPS = 8;
const MAX_RIPPLES = 6;
const RIPPLE_SECONDS = 0.4;
/** 水滴の半径（m） */
const DROP_RADIUS = 0.0016;
/** あごの滴が服に吸われる高さ（あごからの落下距離、m） */
const CHIN_FALL = 0.11;

interface Emitter {
  /** 骨と、その骨から見た滴の出る点 */
  bone: THREE.Object3D;
  offset: THREE.Vector3;
  /** 濡れ具合 1 のとき、1 秒に落ちる滴の数 */
  rate: number;
  /** 足元まで落ちて波紋になる（あごの滴は胸元で消える） */
  toGround: boolean;
  untilNext: number;
  hanging: boolean;
}

interface Drop {
  emitter: Emitter;
  age: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  falling: boolean;
  /** この高さまで落ちたら消える */
  endY: number;
}

interface Ripple {
  position: THREE.Vector3;
  age: number;
}

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _v = new THREE.Vector3();
const _rel = new THREE.Vector3();

/** 顔の肌のメッシュから、あごの先（顔の正面の中心線で一番低い点）を頭の骨から見た位置で求める */
function findChin(vrm: VRM, head: THREE.Object3D): THREE.Vector3 | null {
  vrm.scene.updateMatrixWorld(true);
  const headPos = head.getWorldPosition(new THREE.Vector3());
  // VRM0 は読み込み時に向きを直しているので、正面は vrm.scene の +Z
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(vrm.scene.matrixWorld);
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  let chin: THREE.Vector3 | null = null;
  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    const groups = mesh.geometry.groups.length
      ? mesh.geometry.groups
      : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }];
    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0];
      if (!material || !/Face.*SKIN/i.test(material.name) || /Outline/i.test(material.name)) continue;
      for (let i = group.start; i < group.start + group.count; i++) {
        _v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
        _rel.subVectors(_v, headPos);
        if (_rel.dot(forward) < 0.02 || Math.abs(_rel.dot(right)) > 0.015) continue;
        if (!chin || _v.y < chin.y) chin = _v.clone();
      }
    }
  });
  return chin ? head.worldToLocal(chin) : null;
}

export class WetDrips {
  private readonly drops: Drop[] = [];
  private readonly ripples: Ripple[] = [];
  private readonly dropMesh: THREE.InstancedMesh;
  private readonly rippleMesh: THREE.InstancedMesh;
  private wetness = 0;

  private constructor(private readonly vrm: VRM, private readonly emitters: Emitter[], scene: THREE.Scene) {
    const dropMaterial = new THREE.MeshBasicMaterial({ color: 0xeef8ff, transparent: true, opacity: 0.7, depthWrite: false });
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dropMaterial, MAX_DROPS);
    const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xeef8ff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    this.rippleMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 24), rippleMaterial, MAX_RIPPLES);
    for (const mesh of [this.dropMesh, this.rippleMesh]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, _hidden);
      mesh.visible = false;
      scene.add(mesh);
    }
  }

  static create(vrm: VRM, scene: THREE.Scene): WetDrips | null {
    const emitters: Emitter[] = [];
    const emitter = (bone: THREE.Object3D, offset: THREE.Vector3, rate: number, toGround: boolean): Emitter =>
      ({ bone, offset, rate, toGround, untilNext: Math.random() / rate, hanging: false });
    const head = vrm.humanoid?.getRawBoneNode('head');
    const chin = head ? findChin(vrm, head) : null;
    if (head && chin) emitters.push(emitter(head, chin, 0.6, false));
    // 指先（中指の先の骨から、指の向きに先の骨と同じ長さだけ伸ばした点）
    vrm.scene.updateMatrixWorld(true);
    for (const name of ['leftMiddleDistal', 'rightMiddleDistal'] as const) {
      const bone = vrm.humanoid?.getRawBoneNode(name);
      if (!bone?.parent) continue;
      const tip = bone.getWorldPosition(new THREE.Vector3());
      tip.add(tip.clone().sub(bone.parent.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.8));
      emitters.push(emitter(bone, bone.worldToLocal(tip), 0.35, true));
    }
    return emitters.length ? new WetDrips(vrm, emitters, scene) : null;
  }

  /** 濡れ具合（0〜1） */
  setWetness(wetness: number): void {
    this.wetness = wetness;
  }

  update(delta: number): void {
    if (!this.vrm.scene.visible || (this.wetness <= 0 && this.drops.length === 0 && this.ripples.length === 0)) {
      this.dropMesh.visible = this.rippleMesh.visible = false;
      return;
    }
    const groundY = this.vrm.scene.position.y + 0.003;

    // 滴の出る点ごとに、1 滴ずつふくらませる（間隔はばらつかせる）
    for (const emitter of this.emitters) {
      if (this.wetness <= 0 || emitter.hanging || this.drops.length >= MAX_DROPS) continue;
      emitter.untilNext -= delta;
      if (emitter.untilNext > 0) continue;
      emitter.untilNext = (0.6 + Math.random() * 0.8) / (emitter.rate * this.wetness);
      emitter.hanging = true;
      this.drops.push({ emitter, age: 0, position: this.pointOf(emitter, new THREE.Vector3()), velocity: new THREE.Vector3(), falling: false, endY: groundY });
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.age += delta;
      if (!drop.falling) {
        // 点の少し下にぶら下がってふくらむ
        this.pointOf(drop.emitter, drop.position).y -= DROP_RADIUS * Math.min(drop.age / SWELL_SECONDS, 1);
        if (drop.age >= SWELL_SECONDS) {
          drop.falling = true;
          drop.emitter.hanging = false;
          drop.endY = drop.emitter.toGround ? groundY : drop.position.y - CHIN_FALL;
        }
        continue;
      }
      drop.velocity.y -= GRAVITY * delta;
      drop.position.addScaledVector(drop.velocity, delta);
      if (drop.position.y <= drop.endY) {
        if (drop.emitter.toGround && this.ripples.length < MAX_RIPPLES) {
          this.ripples.push({ position: new THREE.Vector3(drop.position.x, groundY, drop.position.z), age: 0 });
        }
        this.drops.splice(i, 1);
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += delta;
      if (this.ripples[i].age >= RIPPLE_SECONDS) this.ripples.splice(i, 1);
    }

    for (let i = 0; i < MAX_DROPS; i++) {
      const drop = this.drops[i];
      if (!drop) {
        this.dropMesh.setMatrixAt(i, _hidden);
        continue;
      }
      if (drop.falling) {
        // 落ちる速さに合わせて少しだけ縦に伸ばす
        const stretch = 1.2 + Math.min(-drop.velocity.y * 0.25, 0.8);
        _scale.set(DROP_RADIUS, DROP_RADIUS * stretch, DROP_RADIUS);
      } else {
        const swell = Math.min(drop.age / SWELL_SECONDS, 1);
        _scale.set(DROP_RADIUS, DROP_RADIUS * 1.15, DROP_RADIUS).multiplyScalar(0.25 + 0.75 * swell);
      }
      _matrix.compose(drop.position, _quat.identity(), _scale);
      this.dropMesh.setMatrixAt(i, _matrix);
    }
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const ripple = this.ripples[i];
      if (!ripple) {
        this.rippleMesh.setMatrixAt(i, _hidden);
        continue;
      }
      const radius = 0.004 + 0.02 * Math.sqrt(ripple.age / RIPPLE_SECONDS);
      _scale.set(radius, radius, radius);
      _matrix.compose(ripple.position, _flat, _scale);
      this.rippleMesh.setMatrixAt(i, _matrix);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;
    this.rippleMesh.instanceMatrix.needsUpdate = true;
    this.dropMesh.visible = this.drops.length > 0;
    this.rippleMesh.visible = this.ripples.length > 0;
  }

  dispose(): void {
    for (const mesh of [this.dropMesh, this.rippleMesh]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  /** 滴の出る点（ワールド） */
  private pointOf(emitter: Emitter, out: THREE.Vector3): THREE.Vector3 {
    return emitter.bone.localToWorld(out.copy(emitter.offset));
  }
}
