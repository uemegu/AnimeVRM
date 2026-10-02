import * as THREE from 'three';
import type { VRM, VRMSpringBoneJoint } from '@pixiv/three-vrm';

/**
 * 風で髪とスカートを揺らす。
 *
 * 揺れもの（SpringBone）の関節ごとの重力に、風の向き × 強さを足す。揺れものは簡単なバネなので、強い風だと
 * 髪が頭や体に入ったり、形が崩れたりする。そよ風（強さ 0.1 前後まで）で使うこと。
 *
 * 効きは骨の名前で決める。髪はそのまま、スカートは脚に入らないよう半分、胸などは揺らさない。
 * 強さはゆっくり強弱し（gust）、向きも少し振れる。
 */
export interface WindSettings {
  /** 風の吹いていく向き（ワールド座標。長さは問わない） */
  direction: { x: number; y: number; z: number };
  /** 強さ（揺れものの重力と同じ単位） */
  strength: number;
  /** 強弱の揺らぎ（0 = 一定、1 = 止む瞬間がある） */
  gust?: number;
}

const DEFAULT_GUST = 0.6;
/** 向きの振れ幅（ラジアン、gust 1 のとき） */
const DIRECTION_SWAY = 0.25;

function windWeight(boneName: string): number {
  if (/hair/i.test(boneName)) return 1;
  if (/skirt/i.test(boneName)) return 0.5;
  return 0;
}

const _wind = new THREE.Vector3();
const _gravity = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class SpringWind {
  private time = 0;
  private blowing = false;

  private constructor(private readonly joints: { joint: VRMSpringBoneJoint; gravity: THREE.Vector3; weight: number }[]) {}

  static create(vrm: VRM): SpringWind | null {
    const joints = [...(vrm.springBoneManager?.joints ?? [])]
      .map((joint) => ({
        joint,
        // 元の重力（向き × 強さ）。風はこれに足す
        gravity: joint.settings.gravityDir.clone().multiplyScalar(joint.settings.gravityPower),
        weight: windWeight(joint.bone.name),
      }))
      .filter((entry) => entry.weight > 0);
    return joints.length ? new SpringWind(joints) : null;
  }

  /** 揺れものの更新（vrm.update）の前に呼ぶ。wind が null なら元の重力に戻す */
  update(delta: number, wind: WindSettings | null | undefined): void {
    this.time += delta;
    if (!wind && !this.blowing) return;
    this.blowing = !!wind;

    _wind.set(0, 0, 0);
    if (wind) {
      const t = this.time;
      const gust = wind.gust ?? DEFAULT_GUST;
      // ゆっくりした強弱（周期の違う正弦波の和、-1〜1）
      const swell = 0.5 * Math.sin(t * 1.1) + 0.3 * Math.sin(t * 2.3 + 1.7) + 0.2 * Math.sin(t * 0.47 + 4.1);
      _wind.set(wind.direction.x, wind.direction.y, wind.direction.z);
      if (_wind.lengthSq() > 0) {
        _wind.normalize()
          .applyAxisAngle(_up, DIRECTION_SWAY * gust * Math.sin(t * 0.31 + 0.6))
          .multiplyScalar(wind.strength * Math.max(0, 1 + gust * swell));
      }
    }
    for (const { joint, gravity, weight } of this.joints) {
      _gravity.copy(gravity).addScaledVector(_wind, weight);
      const power = _gravity.length();
      joint.settings.gravityPower = power;
      if (power > 1e-6) joint.settings.gravityDir.copy(_gravity).divideScalar(power);
    }
  }
}
