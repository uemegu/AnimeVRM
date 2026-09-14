import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';

export interface WateryEyeConfig {
  enabled: boolean;
  intensity: number;          // 全体強度 (0.0 ~ 2.0)
  waveSpeed: number;          // 水膜のゆらめき速度
  waveScale: number;          // 水面波紋の細かさ
  meniscusIntensity: number;  // 下まぶたの涙だまり強度
  sparkleIntensity: number;   // きらめき光粒の強度
  waterColor: string;         // 水膜・潤みカラー (薄いアクアブルー)
  sparkleColor: string;       // 光粒・ハイライトカラー (ピュアホワイト)
  eyeRadius: number;          // 水膜メッシュの半径 (約2.2cm)
  leftEyeOffset: { x: number; y: number; z: number };
  rightEyeOffset: { x: number; y: number; z: number };
}

export const DEFAULT_WATERY_EYE_CONFIG: WateryEyeConfig = {
  enabled: false,
  intensity: 1.0,
  waveSpeed: 2.8,
  waveScale: 14.0,
  meniscusIntensity: 1.2,
  sparkleIntensity: 1.1,
  waterColor: '#c2f0ff',
  sparkleColor: '#ffffff',
  eyeRadius: 0.022,
  // Head ボーン基準のフォールバック用オフセット
  leftEyeOffset: { x: 0.034, y: 0.052, z: 0.086 },
  rightEyeOffset: { x: -0.034, y: 0.052, z: 0.086 },
};

/**
 * 瞳の表面で水滴・涙膜が水々しく波打ち、光粒がきらめく「ウルウル瞳」シェーダーエフェクト
 */
export class WateryEyeEffect {
  public config: WateryEyeConfig;
  public group: THREE.Group;

  private vrm: VRM;
  private headBone: THREE.Object3D | null = null;
  private leftEyeBone: THREE.Object3D | null = null;
  private rightEyeBone: THREE.Object3D | null = null;

  private leftEyeMesh: THREE.Mesh | null = null;
  private rightEyeMesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;

  private elapsedTime = 0.0;
  private currentIntensity = 0.0; // フェードイン/アウト用
  private attachedToEyeBones = false;

  constructor(vrm: VRM, config?: Partial<WateryEyeConfig>) {
    this.vrm = vrm;
    this.config = { ...DEFAULT_WATERY_EYE_CONFIG, ...config };
    this.group = new THREE.Group();
    this.group.name = 'WateryEyeEffectGroup';

    this.init();
  }

  private init(): void {
    // 1. ボーンの探索 (NormalizedBone または RawBone)
    this.headBone = this.vrm.humanoid?.getNormalizedBoneNode('head') ??
      this.vrm.humanoid?.getRawBoneNode('head') ??
      this.vrm.scene;

    this.leftEyeBone = this.vrm.humanoid?.getNormalizedBoneNode('leftEye') ??
      this.vrm.humanoid?.getRawBoneNode('leftEye') ??
      null;

    this.rightEyeBone = this.vrm.humanoid?.getNormalizedBoneNode('rightEye') ??
      this.vrm.humanoid?.getRawBoneNode('rightEye') ??
      null;

    // 2. マテリアルとメッシュの生成
    this.createMaterial();
    this.rebuildMeshes();
  }

  private createMaterial(): void {
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uBlinkWeight;
      uniform float uWaveSpeed;
      uniform float uWaveScale;
      uniform float uMeniscusIntensity;
      uniform float uSparkleIntensity;
      uniform vec3 uWaterColor;
      uniform vec3 uSparkleColor;

      varying vec2 vUv;
      varying vec3 vNormal;

      // 擬似乱数ノイズ
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // 星屑・光粒 (ダイヤ/十字のキラメキ)
      float drawGlint(vec2 uv, vec2 center, float size, float rot) {
        vec2 p = uv - center;
        float s = sin(rot);
        float c = cos(rot);
        p = mat2(c, -s, s, c) * p;
        p = abs(p);

        // 十字星形状
        float arm = max(p.x + p.y * 0.2, p.y + p.x * 0.2);
        float star = smoothstep(size, 0.0, arm);

        // 中央コアの光
        float core = smoothstep(size * 0.45, 0.0, length(p));
        return star * 0.7 + core * 0.8;
      }

      void main() {
        if (uIntensity <= 0.001 || uBlinkWeight >= 0.95) {
          discard;
        }

        // 中心 (0,0) を基準にした座標 [-0.5 ~ 0.5]
        vec2 uv = vUv - 0.5;
        float dist = length(uv);

        // 瞳の輪郭マスク (丸くソフトに減衰)
        float eyeMask = smoothstep(0.48, 0.20, dist);
        if (eyeMask <= 0.01) {
          discard;
        }

        float t = uTime * uWaveSpeed;

        // 1. 水面波紋・コースティクス (波打つ水のゆらめき)
        // 2つの干渉波によって水滴がたぷたぷと揺れる有機的な質感
        float w1 = sin(uv.x * uWaveScale + t + cos(uv.y * (uWaveScale * 0.8) + t * 0.7));
        float w2 = cos(uv.y * (uWaveScale * 1.1) - t * 0.85 + sin(uv.x * (uWaveScale * 0.7) - t * 0.5));
        float caustics = pow(clamp(w1 * w2 * 0.5 + 0.5, 0.0, 1.0), 3.2);

        // 瞳全体の潤んだ水膜グラデーション (中心〜下部にかけて潤い光彩)
        float moistGlow = smoothstep(0.45, -0.1, uv.y) * 0.45;

        // 2. 下まぶたの涙だまり (水たまりハイライト: 下まぶたのキワでぷっくり波打つ)
        // uv.y が -0.1 ~ -0.4 の領域に三日月型の水膜を形成
        float meniscusY = smoothstep(-0.45, -0.22, uv.y) * smoothstep(0.02, -0.18, uv.y);
        float meniscusX = smoothstep(0.42, 0.0, abs(uv.x));
        // たぷたぷと有機的に波打つ伸縮
        float wobble = 1.0 + 0.28 * sin(t * 1.35 + uv.x * 12.0) + 0.15 * cos(t * 2.1 - uv.x * 8.0);
        float meniscus = meniscusY * meniscusX * wobble * uMeniscusIntensity;

        // 3. 瞳の中のキラキラ星屑・光粒 (アニメ調の潤みハイライト)
        // (A) メインの大きな潤み光粒 (瞳の斜め下で呼吸するように明滅)
        vec2 gPos1 = vec2(-0.12 + 0.02 * sin(t * 0.8), -0.15 + 0.015 * cos(t * 1.1));
        float pulse1 = 0.75 + 0.35 * sin(t * 1.6);
        float glint1 = drawGlint(uv, gPos1, 0.09 * pulse1, t * 0.3) * pulse1;

        // (B) サブの小さな星粒 (反対側でキラリと点滅)
        vec2 gPos2 = vec2(0.14 + 0.015 * cos(t * 1.2), -0.08 + 0.02 * sin(t * 0.9));
        float pulse2 = 0.65 + 0.45 * cos(t * 2.3 + 1.2);
        float glint2 = drawGlint(uv, gPos2, 0.065 * pulse2, -t * 0.4) * pulse2;

        // (C) 瞳上部の微細な反射ハイライト
        vec2 gPos3 = vec2(-0.02 + 0.01 * sin(t * 0.5), 0.16 + 0.01 * cos(t * 0.7));
        float pulse3 = 0.5 + 0.3 * sin(t * 1.2 + 2.5);
        float glint3 = drawGlint(uv, gPos3, 0.05 * pulse3, t * 0.2) * pulse3;

        float sparkles = (glint1 + glint2 + glint3) * uSparkleIntensity;

        // 4. カラーとアルファの合成
        // 水膜カラー: 淡い透明アクアブルー
        // 光彩・スパークル: クリアなホワイト
        vec3 waterCol = uWaterColor * (moistGlow + caustics * 0.55);
        vec3 highlightCol = uSparkleColor * (meniscus * 1.2 + sparkles * 1.4);
        vec3 finalCol = waterCol + highlightCol;

        // まばたき(まぶた閉)時はアルファをゼロにし、まぶたの突き抜けを防止
        float blinkFade = 1.0 - smoothstep(0.15, 0.75, uBlinkWeight);
        float alpha = (moistGlow * 0.5 + caustics * 0.45 + meniscus * 0.85 + sparkles * 0.95);
        alpha *= eyeMask * uIntensity * blinkFade;

        gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 0.95));
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0.0 },
        uIntensity: { value: 0.0 },
        uBlinkWeight: { value: 0.0 },
        uWaveSpeed: { value: this.config.waveSpeed },
        uWaveScale: { value: this.config.waveScale },
        uMeniscusIntensity: { value: this.config.meniscusIntensity },
        uSparkleIntensity: { value: this.config.sparkleIntensity },
        uWaterColor: { value: new THREE.Color(this.config.waterColor) },
        uSparkleColor: { value: new THREE.Color(this.config.sparkleColor) },
      },
    });
  }

  public rebuildMeshes(): void {
    // 既存メッシュのクリーンアップ
    if (this.leftEyeMesh) {
      this.leftEyeMesh.parent?.remove(this.leftEyeMesh);
      this.leftEyeMesh.geometry.dispose();
      this.leftEyeMesh = null;
    }
    if (this.rightEyeMesh) {
      this.rightEyeMesh.parent?.remove(this.rightEyeMesh);
      this.rightEyeMesh.geometry.dispose();
      this.rightEyeMesh = null;
    }

    if (!this.material) return;

    const r = this.config.eyeRadius;
    const geo = new THREE.PlaneGeometry(r * 2.0, r * 2.2);

    this.leftEyeMesh = new THREE.Mesh(geo, this.material);
    this.leftEyeMesh.name = 'WateryEyeMesh_Left';
    this.leftEyeMesh.renderOrder = 200; // 瞳の上に手前描画

    this.rightEyeMesh = new THREE.Mesh(geo.clone(), this.material);
    this.rightEyeMesh.name = 'WateryEyeMesh_Right';
    this.rightEyeMesh.renderOrder = 200;

    // Eyeボーンへの接続 (優先) または Headボーンへのフォールバック接続
    if (this.leftEyeBone && this.rightEyeBone) {
      this.attachedToEyeBones = true;
      // Eyeボーンの子として追加 (瞳の前方にわずかにオフセット)
      this.leftEyeMesh.position.set(0, 0, 0.016);
      this.rightEyeMesh.position.set(0, 0, 0.016);
      this.leftEyeBone.add(this.leftEyeMesh);
      this.rightEyeBone.add(this.rightEyeMesh);
    } else if (this.headBone) {
      this.attachedToEyeBones = false;
      const lx = this.config.leftEyeOffset.x;
      const ly = this.config.leftEyeOffset.y;
      const lz = this.config.leftEyeOffset.z;
      const rx = this.config.rightEyeOffset.x;
      const ry = this.config.rightEyeOffset.y;
      const rz = this.config.rightEyeOffset.z;

      this.leftEyeMesh.position.set(lx, ly, lz);
      this.rightEyeMesh.position.set(rx, ry, rz);

      this.group.add(this.leftEyeMesh);
      this.group.add(this.rightEyeMesh);
      this.headBone.add(this.group);
    }
  }

  public update(delta: number, elapsed: number, blinkWeight: number = 0.0): void {
    this.elapsedTime = elapsed;

    // フェードイン / フェードアウトの平滑化
    const targetIntensity = this.config.enabled ? this.config.intensity : 0.0;
    this.currentIntensity += (targetIntensity - this.currentIntensity) * Math.min(delta * 6.0, 1.0);

    const isVisible = this.currentIntensity > 0.001;
    if (this.leftEyeMesh) this.leftEyeMesh.visible = isVisible;
    if (this.rightEyeMesh) this.rightEyeMesh.visible = isVisible;

    if (!isVisible || !this.material) return;

    this.material.uniforms.uTime.value = this.elapsedTime;
    this.material.uniforms.uIntensity.value = this.currentIntensity;
    this.material.uniforms.uBlinkWeight.value = blinkWeight;
    this.material.uniforms.uWaveSpeed.value = this.config.waveSpeed;
    this.material.uniforms.uWaveScale.value = this.config.waveScale;
    this.material.uniforms.uMeniscusIntensity.value = this.config.meniscusIntensity;
    this.material.uniforms.uSparkleIntensity.value = this.config.sparkleIntensity;
    this.material.uniforms.uWaterColor.value.set(this.config.waterColor);
    this.material.uniforms.uSparkleColor.value.set(this.config.sparkleColor);
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  public updateConfig(newConfig: Partial<WateryEyeConfig>): void {
    Object.assign(this.config, newConfig);
    if (newConfig.eyeRadius !== undefined) {
      this.rebuildMeshes();
    }
  }

  public dispose(): void {
    if (this.leftEyeMesh) {
      this.leftEyeMesh.parent?.remove(this.leftEyeMesh);
      this.leftEyeMesh.geometry.dispose();
      this.leftEyeMesh = null;
    }
    if (this.rightEyeMesh) {
      this.rightEyeMesh.parent?.remove(this.rightEyeMesh);
      this.rightEyeMesh.geometry.dispose();
      this.rightEyeMesh = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
