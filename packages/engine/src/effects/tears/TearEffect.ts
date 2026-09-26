import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';

export interface TearConfig {
  enabled: boolean;
  side: 'left' | 'right' | 'both'; // 流す目（デフォルト: leftで一筋）
  speed: number;              // 涙が流れる速度
  glowIntensity: number;      // 発光強度 (Bloom連動)
  trailLength: number;        // 涙の筋の長さ (1.0で全体が残る)
  tearColor: string;          // 涙の基本色
  glowColor: string;          // 発光色
  width: number;              // 涙の筋の太さ
  loop: boolean;              // ループするか（falseで一筋流れてそのまま残る）
  leftEyeOffset: { x: number; y: number; z: number };
  rightEyeOffset: { x: number; y: number; z: number };
}

export const DEFAULT_TEAR_CONFIG: TearConfig = {
  enabled: true,
  side: 'left',
  speed: 0.45,
  glowIntensity: 1.8,
  trailLength: 1.0,           // 消えずにそのまま残る
  tearColor: '#c8f0ff',
  glowColor: '#ffffff',
  width: 0.0032,
  loop: false,                // 一筋流れてそのまま留まる
  leftEyeOffset: { x: 0.054, y: 0.047, z: 0.085 },
  rightEyeOffset: { x: -0.054, y: 0.047, z: 0.085 },
};

/**
 * 涙の筋（リボンメッシュ）と発光・流れるアニメーションを制御するクラス
 */
export class TearEffect {
  public group: THREE.Group;
  public config: TearConfig;

  private leftTearMesh: THREE.Mesh | null = null;
  private rightTearMesh: THREE.Mesh | null = null;
  private tearMaterial: THREE.ShaderMaterial | null = null;

  private vrm: VRM;
  private headBone: THREE.Object3D | null = null;
  private progress = 0.0;
  private elapsedTime = 0.0;

  constructor(vrm: VRM, config?: Partial<TearConfig>) {
    this.vrm = vrm;
    this.config = { ...DEFAULT_TEAR_CONFIG, ...config };
    this.group = new THREE.Group();
    this.group.name = 'TearEffectGroup';

    this.init();
  }

  private init(): void {
    // VRM の Head ボーンを取得
    this.headBone = this.vrm.humanoid?.getNormalizedBoneNode('head') ?? null;
    if (!this.headBone) {
      this.headBone = this.vrm.humanoid?.getRawBoneNode('head') ?? this.vrm.scene;
    }

    this.createTearMaterial();
    this.rebuildTearMeshes();

    if (this.headBone) {
      this.headBone.add(this.group);
    }
  }

  /**
   * 涙の流れるアニメーション＆発光シェーダーマテリアルの生成
   */
  private createTearMaterial(): void {
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform float uProgress;
      uniform float uGlowIntensity;
      uniform float uTrailLength;
      uniform vec3 uTearColor;
      uniform vec3 uGlowColor;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        // vUv.y: 0.0 (目の下) -> 1.0 (頬の中央)
        float headPos = uProgress;

        // 涙の先端より先は非表示（流れる前）
        if (vUv.y > headPos) {
          discard;
        }

        // 涙の筋の長さ（uTrailLength = 1.0 で消えずにずっと残る）
        float trailStart = max(0.0, headPos - uTrailLength);
        float trailMask = smoothstep(trailStart, min(headPos, 0.15) + (headPos >= 1.0 ? 0.85 : 0.0), vUv.y);

        // 涙の筋の横方向プロファイル (中央が濃く、端はフェード)
        float edgeDist = abs(vUv.x - 0.5) * 2.0; // 0.0 ~ 1.0
        float centerProfile = pow(1.0 - edgeDist, 1.6);

        // 涙の先端の水滴（ぷっくりとした雫）
        float distToHead = abs(vUv.y - min(headPos, 1.0));
        float dropShape = smoothstep(0.08, 0.0, distToHead) * 1.4;

        // 【たまにキラッと光る演出】(約3.5秒ごとに光のパルスがスーッと走る)
        float glintCycle = mod(uTime + 0.5, 3.5);
        float glintProgress = glintCycle / 0.9; // 0.9秒かけて上から下へ通過
        float glintDist = abs(vUv.y - glintProgress);
        float occasionalSweep = (glintCycle < 1.0) ? pow(clamp(1.0 - glintDist * 4.5, 0.0, 1.0), 3.0) * 2.5 : 0.0;

        // 先端の水滴の優しいパルス輝き
        float dropGlint = (glintCycle > 0.6 && glintCycle < 1.5) ? sin((glintCycle - 0.6) / 0.9 * 3.14159) * 2.0 : 0.0;

        // 微細な常時ツヤ感
        float subtleGlint = pow(clamp(sin((vUv.y * 10.0 - uTime * 2.0)) * 0.5 + 0.5, 0.0, 1.0), 12.0) * 0.25;

        // アルファ計算
        float alpha = (centerProfile * 0.65 + dropShape * 0.45) * max(trailMask, 0.75);
        alpha = clamp(alpha, 0.0, 0.92);

        if (alpha < 0.01) {
          discard;
        }

        // 基本カラー + キラッと光る発光成分 (Bloom)
        vec3 baseCol = uTearColor;
        float totalGlow = (occasionalSweep + dropGlint * dropShape + subtleGlint) * uGlowIntensity;
        vec3 glowCol = uGlowColor * (0.25 + totalGlow);
        
        vec3 finalColor = baseCol + glowCol;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    this.tearMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uProgress: { value: 0.0 },
        uGlowIntensity: { value: this.config.glowIntensity },
        uTrailLength: { value: this.config.trailLength },
        uTearColor: { value: new THREE.Color(this.config.tearColor) },
        uGlowColor: { value: new THREE.Color(this.config.glowColor) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
  }

  /**
   * 左右の頬のカーブに沿ったリボンメッシュを生成（半分の長さに調整）
   */
  public rebuildTearMeshes(): void {
    if (this.leftTearMesh) {
      this.group.remove(this.leftTearMesh);
      this.leftTearMesh.geometry.dispose();
      this.leftTearMesh = null;
    }
    if (this.rightTearMesh) {
      this.group.remove(this.rightTearMesh);
      this.rightTearMesh.geometry.dispose();
      this.rightTearMesh = null;
    }

    if (!this.tearMaterial) return;

    const lx = this.config.leftEyeOffset.x;
    const ly = this.config.leftEyeOffset.y;
    const lz = this.config.leftEyeOffset.z;

    const rx = this.config.rightEyeOffset.x;
    const ry = this.config.rightEyeOffset.y;
    const rz = this.config.rightEyeOffset.z;

    // 左目の涙カーブ（目の直下から頬の中央・チーク付近までのコンパクトな長さ）
    const leftCurvePoints = [
      new THREE.Vector3(lx, ly, lz),
      new THREE.Vector3(lx * 0.98, ly - 0.012, lz + 0.001), // 頬の少し膨らんだ部分
      new THREE.Vector3(lx * 0.94, ly - 0.026, lz - 0.001), // 頬の中央上寄り
      new THREE.Vector3(lx * 0.88, ly - 0.038, lz - 0.003), // 頬の中央
      new THREE.Vector3(lx * 0.82, ly - 0.048, lz - 0.006), // 頬の下端でストップ
    ];

    // 右目の涙カーブ（対称）
    const rightCurvePoints = [
      new THREE.Vector3(rx, ry, rz),
      new THREE.Vector3(rx * 0.98, ry - 0.012, rz + 0.001),
      new THREE.Vector3(rx * 0.94, ry - 0.026, rz - 0.001),
      new THREE.Vector3(rx * 0.88, ry - 0.038, rz - 0.003),
      new THREE.Vector3(rx * 0.82, ry - 0.048, rz - 0.006),
    ];

    const leftGeo = this.createRibbonGeometry(leftCurvePoints, this.config.width);
    const rightGeo = this.createRibbonGeometry(rightCurvePoints, this.config.width);

    this.leftTearMesh = new THREE.Mesh(leftGeo, this.tearMaterial);
    this.leftTearMesh.name = 'LeftTearRibbon';
    this.leftTearMesh.renderOrder = 999;

    this.rightTearMesh = new THREE.Mesh(rightGeo, this.tearMaterial);
    this.rightTearMesh.name = 'RightTearRibbon';
    this.rightTearMesh.renderOrder = 999;

    this.leftTearMesh.visible = this.config.side === 'left' || this.config.side === 'both';
    this.rightTearMesh.visible = this.config.side === 'right' || this.config.side === 'both';

    this.group.add(this.leftTearMesh);
    this.group.add(this.rightTearMesh);

    this.group.visible = this.config.enabled;
  }

  /**
   * カーブ制御点から帯状（リボン）のバッファジオメトリを生成
   */
  private createRibbonGeometry(points: THREE.Vector3[], width: number): THREE.BufferGeometry {
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = 24;
    const curvePoints = curve.getPoints(segments);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const p = curvePoints[i];
      const t = i / segments; // 0.0 ~ 1.0 (上から下へ)
      
      // 法線・接線の計算
      const halfW = width * 0.5 * (1.0 + Math.sin(t * Math.PI) * 0.3);

      // 左右の頂点
      positions.push(p.x - halfW, p.y, p.z);
      positions.push(p.x + halfW, p.y, p.z);

      normals.push(0, 0, 1);
      normals.push(0, 0, 1);

      uvs.push(0, t);
      uvs.push(1, t);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * 毎フレームの更新処理
   */
  public update(delta: number): void {
    if (!this.config.enabled) {
      if (this.group.visible) this.group.visible = false;
      return;
    }
    if (!this.group.visible) this.group.visible = true;

    this.elapsedTime += delta;

    // 涙の進行度（loop: false の場合は 1.0 で留まる）
    if (this.progress < 1.05) {
      this.progress += delta * this.config.speed;
      if (this.progress >= 1.05 && this.config.loop) {
        this.progress = 0.0;
      }
    } else if (this.config.loop) {
      this.progress += delta * this.config.speed;
      if (this.progress > 1.3) {
        this.progress = 0.0;
      }
    }

    // シェーダーユニフォームの更新
    if (this.tearMaterial) {
      this.tearMaterial.uniforms.uTime.value = this.elapsedTime;
      this.tearMaterial.uniforms.uProgress.value = Math.min(this.progress, 1.0);
      this.tearMaterial.uniforms.uGlowIntensity.value = this.config.glowIntensity;
      this.tearMaterial.uniforms.uTrailLength.value = this.config.trailLength;
      this.tearMaterial.uniforms.uTearColor.value.set(this.config.tearColor);
      this.tearMaterial.uniforms.uGlowColor.value.set(this.config.glowColor);
    }

    // 左右の可視性
    if (this.leftTearMesh) {
      this.leftTearMesh.visible = this.config.side === 'left' || this.config.side === 'both';
    }
    if (this.rightTearMesh) {
      this.rightTearMesh.visible = this.config.side === 'right' || this.config.side === 'both';
    }
  }

  /**
   * 涙のアニメーションを最初からリスタート
   */
  public restart(): void {
    this.progress = 0.0;
  }

  /**
   * 設定の更新
   */
  public updateConfig(newConfig: Partial<TearConfig>): void {
    const oldWidth = this.config.width;
    const oldL = { ...this.config.leftEyeOffset };
    const oldR = { ...this.config.rightEyeOffset };

    Object.assign(this.config, newConfig);

    if (this.leftTearMesh) {
      this.leftTearMesh.visible = this.config.side === 'left' || this.config.side === 'both';
    }
    if (this.rightTearMesh) {
      this.rightTearMesh.visible = this.config.side === 'right' || this.config.side === 'both';
    }

    if (
      this.config.width !== oldWidth ||
      this.config.leftEyeOffset.x !== oldL.x ||
      this.config.leftEyeOffset.y !== oldL.y ||
      this.config.leftEyeOffset.z !== oldL.z ||
      this.config.rightEyeOffset.x !== oldR.x ||
      this.config.rightEyeOffset.y !== oldR.y ||
      this.config.rightEyeOffset.z !== oldR.z
    ) {
      this.rebuildTearMeshes();
    }
  }

  public dispose(): void {
    if (this.leftTearMesh) {
      this.leftTearMesh.geometry.dispose();
    }
    if (this.rightTearMesh) {
      this.rightTearMesh.geometry.dispose();
    }
    if (this.tearMaterial) {
      this.tearMaterial.dispose();
    }
    this.group.removeFromParent();
  }
}
