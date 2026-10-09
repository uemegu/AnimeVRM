import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { measureFaceLandmarks, type FaceLandmarks } from './faceLandmarks';

/** 正面から何度までは口の絵を出し切るか・何度で消し切るか（cos） */
const MOUTH_FULL_COS = Math.cos(THREE.MathUtils.degToRad(28));
const MOUTH_HIDDEN_COS = Math.cos(THREE.MathUtils.degToRad(48));
/** 涙の粒も板なので、真横に近づいたら消す */
const DROP_FULL_COS = Math.cos(THREE.MathUtils.degToRad(55));
const DROP_HIDDEN_COS = Math.cos(THREE.MathUtils.degToRad(75));

const MOUTH_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * 大きく開いた口（漫画の泣き叫ぶ口）。輪郭が波打ち、全体が伸び縮みする。
 * 板の縦横比 1:0.7 の中に、下が広い丸い台形を描く（上の縁は真ん中がくぼむ）
 */
const MOUTH_FRAGMENT = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uOutline;
  uniform vec3 uInner;
  uniform vec3 uShade;
  uniform vec3 uTongue;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(2.0, 1.4);
    float t = uTime;
    // 全体の伸び縮み（ふにゃふにゃ）
    float squash = sin(t * 8.3) * 0.05 + sin(t * 13.1) * 0.025;
    vec2 q = p / vec2(0.86 * (1.0 + squash), 0.54 * (1.0 - squash * 1.2));
    // 下が広く上がすぼまる（口の端は下側ほど外へ）
    q.x /= mix(1.08, 0.84, clamp(q.y * 0.5 + 0.5, 0.0, 1.0));
    q.y += 0.06;
    // 上の縁の真ん中をくぼませる
    q.y += step(0.0, q.y) * 0.2 * exp(-q.x * q.x * 9.0);

    // 角の丸い四角に近い形の輪郭を、角度ごとに波打たせる
    float n = 3.0;
    float f = pow(pow(abs(q.x), n) + pow(abs(q.y), n), 1.0 / n);
    float a = atan(q.y, q.x);
    float edge = 1.0
      + 0.03 * sin(a * 5.0 + t * 10.0)
      + 0.014 * sin(a * 8.0 - t * 7.3)
      + 0.02 * sin(a * 3.0 + t * 4.1);
    float d = f - edge;

    float aa = fwidth(d) * 1.2;
    float shape = 1.0 - smoothstep(-aa, aa, d);
    if (shape <= 0.001) discard;

    // 縁の線（太さは少し揺らす）
    float lineWidth = 0.065 + 0.012 * sin(a * 4.0 + t * 9.0);
    float line = smoothstep(-lineWidth - aa, -lineWidth + aa, d);

    // 中：上唇の下に影、下に舌
    vec3 color = uInner;
    float shadeEdge = 0.42 + 0.06 * sin(q.x * 5.0 + t * 6.0);
    color = mix(color, uShade, smoothstep(shadeEdge - 0.03, shadeEdge + 0.03, q.y));
    float tongue = length((q - vec2(0.0, -0.95)) / vec2(0.75, 0.55));
    color = mix(color, uTongue, 1.0 - smoothstep(0.92, 1.0, tongue));
    color = mix(color, uOutline, line);

    gl_FragColor = vec4(color, shape * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** 目尻にたまる涙の粒。上が細く下がふくらんだ形で、ふちと下側が明るく光る */
const DROP_FRAGMENT = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uPhase;
  uniform vec3 uWater;
  uniform vec3 uRim;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float t = uTime + uPhase;
    // ぷるぷる揺れる
    float wob = sin(t * 5.2) * 0.04 + sin(t * 8.7) * 0.02;
    p.x *= 1.0 + wob;
    p.y *= 1.0 - wob * 0.8;

    // しずく形：下の円と、上へ細くなる先
    vec2 c = p - vec2(0.0, -0.22);
    float body = length(c / vec2(0.62, 0.66));
    float taper = clamp((p.y + 0.22) / 1.05, 0.0, 1.0);
    float width = mix(0.62, 0.05, pow(taper, 0.75));
    float top = abs(p.x) / max(width, 0.001);
    float inside = p.y > -0.22 ? max(top, (p.y - 0.83) * 8.0 + 1.0) : body;
    float aa = fwidth(inside) * 1.2;
    float shape = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, inside);
    if (shape <= 0.001) discard;

    // 中は薄く透け、ふちと下側ほど濃く明るい
    float rim = smoothstep(0.62, 1.0, inside);
    float bottom = smoothstep(0.0, -0.85, p.y);
    vec3 color = mix(uWater, uRim, rim * 0.7 + bottom * 0.35);
    float alpha = 0.35 + rim * 0.45 + bottom * 0.2;

    // 左上の大きな光と、右下の小さな光（時々強くきらめく）
    float glint = 0.75 + 0.25 * sin(t * 3.1);
    float hi = 1.0 - smoothstep(0.1, 0.17, length(p - vec2(-0.2, -0.02)));
    float hi2 = 1.0 - smoothstep(0.05, 0.09, length(p - vec2(0.24, -0.55)));
    float hi3 = 1.0 - smoothstep(0.04, 0.07, length(p - vec2(-0.05, 0.38)));
    float spark = max(max(hi, hi2 * 0.9), hi3 * 0.8) * glint;
    color = mix(color, vec3(1.0), spark);
    alpha = max(alpha, spark);

    gl_FragColor = vec4(color, alpha * shape * uOpacity);
    #include <colorspace_fragment>
  }
`;

/**
 * 顔の前に貼る板の演出：目尻の涙の粒（涙目）と、波打つ大きな口（あわあわ口）。
 * どちらも板なので、正面から外れるほど薄くして消す
 */
export class CryFaceEffect {
  private readonly landmarks: FaceLandmarks | null;
  private readonly group = new THREE.Group();
  private mouth: THREE.Mesh | null = null;
  private drops: THREE.Mesh[] = [];
  private readonly mouthMaterial: THREE.ShaderMaterial;
  private readonly dropMaterials: THREE.ShaderMaterial[] = [];
  private mouthOn = false;
  private dropsOn = false;
  private mouthFade = 0;
  private dropFade = 0;

  private readonly normal = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly toCamera = new THREE.Vector3();

  constructor(vrm: VRM) {
    this.group.name = 'CryFaceEffect';
    this.group.visible = false;
    this.landmarks = measureFaceLandmarks(vrm);

    this.mouthMaterial = new THREE.ShaderMaterial({
      vertexShader: MOUTH_VERTEX,
      fragmentShader: MOUTH_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uOutline: { value: new THREE.Color('#5a1f2b') },
        uInner: { value: new THREE.Color('#f2898f') },
        uShade: { value: new THREE.Color('#c9505f') },
        uTongue: { value: new THREE.Color('#ffa3a3') },
      },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });

    const lm = this.landmarks;
    if (!lm) return;
    lm.head.add(this.group);
    const basis = faceBasis(lm);

    if (lm.mouth) {
      // 閉じた口の幅の 1.3 倍ほど。開いた口は下に伸びるので中心を少し下げる
      const width = Math.max(lm.mouth.width * 1.28, 0.021);
      const height = width * 0.7;
      this.mouth = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.mouthMaterial);
      this.mouth.name = 'CryFaceEffect_Mouth';
      this.mouth.renderOrder = 210;
      this.mouth.frustumCulled = false;
      this.mouth.quaternion.setFromRotationMatrix(basis);
      this.mouth.position.copy(lm.mouth.center)
        .addScaledVector(lm.forward, 0.004)
        .addScaledVector(lm.up, -height * 0.08);
      this.group.add(this.mouth);
    }

    lm.eyeCorners.forEach((corner, i) => {
      const size = 0.0095;
      const material = new THREE.ShaderMaterial({
        vertexShader: MOUTH_VERTEX,
        fragmentShader: DROP_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uPhase: { value: i * 1.7 },
          uWater: { value: new THREE.Color('#bfe9ff') },
          uRim: { value: new THREE.Color('#ffffff') },
        },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      });
      const drop = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.25), material);
      drop.name = `CryFaceEffect_Drop${i}`;
      drop.renderOrder = 210;
      drop.frustumCulled = false;
      drop.quaternion.setFromRotationMatrix(basis);
      // 粒の上の先を目尻に合わせ、少し前に浮かせる
      drop.position.copy(corner)
        .addScaledVector(lm.forward, 0.003)
        .addScaledVector(lm.up, -size * 0.4);
      this.dropMaterials.push(material);
      this.drops.push(drop);
      this.group.add(drop);
    });
  }

  /** あわあわ口 */
  public setMouth(enabled: boolean): void {
    this.mouthOn = enabled;
  }

  /** 目尻の涙の粒 */
  public setDrops(enabled: boolean): void {
    this.dropsOn = enabled;
  }

  public update(delta: number, elapsed: number, camera: THREE.Camera): void {
    const rate = Math.min(1, delta * 8);
    this.mouthFade = approach(this.mouthFade, this.mouthOn && !!this.mouth, rate);
    this.dropFade = approach(this.dropFade, this.dropsOn && this.drops.length > 0, rate);
    this.group.visible = this.mouthFade > 0 || this.dropFade > 0;
    if (!this.group.visible) return;

    // 顔の正面とカメラへの向きのなす角で、板（口・粒）を薄くする
    const plate = this.mouth ?? this.drops[0];
    plate.getWorldPosition(this.position);
    this.normal.set(0, 0, 1).transformDirection(plate.matrixWorld);
    camera.getWorldPosition(this.toCamera).sub(this.position).normalize();
    const cos = this.normal.dot(this.toCamera);

    const dropFacing = THREE.MathUtils.smoothstep(cos, DROP_HIDDEN_COS, DROP_FULL_COS);
    for (const material of this.dropMaterials) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uOpacity.value = this.dropFade * dropFacing;
    }
    for (const drop of this.drops) drop.visible = this.dropFade > 0;
    if (this.mouth) {
      const facing = THREE.MathUtils.smoothstep(cos, MOUTH_HIDDEN_COS, MOUTH_FULL_COS);
      this.mouthMaterial.uniforms.uTime.value = elapsed;
      this.mouthMaterial.uniforms.uOpacity.value = this.mouthFade * facing;
      this.mouth.visible = this.mouthFade > 0 && facing > 0.001;
    }
  }

  public dispose(): void {
    this.group.parent?.remove(this.group);
    this.mouth?.geometry.dispose();
    this.mouthMaterial.dispose();
    for (const drop of this.drops) drop.geometry.dispose();
    for (const material of this.dropMaterials) material.dispose();
  }
}

/** フェードの値を目標（出す 1・消す 0）へ近づける。消し切ったら 0 にそろえる */
function approach(value: number, on: boolean, rate: number): number {
  const next = value + ((on ? 1 : 0) - value) * rate;
  return !on && next < 0.01 ? 0 : next;
}

/** 板の向き：Z を顔の正面、Y を上にした回転 */
function faceBasis(lm: FaceLandmarks): THREE.Matrix4 {
  const z = lm.forward.clone().normalize();
  const x = new THREE.Vector3().crossVectors(lm.up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}
