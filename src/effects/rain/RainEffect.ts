import * as THREE from 'three';

export interface RainConfig {
  enabled: boolean;
  count: number;
  speed: number;
  length: number;
  angle: number; // 傾き角度（度数法）
  color: string;
  opacity: number;
  splashEnabled: boolean;
  splashCount: number;
}

export const DEFAULT_RAIN_CONFIG: RainConfig = {
  enabled: false,
  count: 600,
  speed: 9.5,
  length: 0.14,
  angle: 2,
  color: '#cce2ff',
  opacity: 0.45,
  splashEnabled: false,
  splashCount: 110,
};

const vertexShader = /* glsl */ `
  attribute float aTail;
  attribute float aSpeed;
  attribute float aLength;
  attribute vec3 aOffset;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uLength;
  uniform float uAngleRad;
  uniform vec3 uBoxSize;
  uniform vec3 uBoxCenter;

  varying float vAlpha;

  void main() {
    float dropSpeed = uSpeed * aSpeed;
    float boxH = uBoxSize.y;
    float boxW = uBoxSize.x;
    float boxD = uBoxSize.z;

    // 1. 雨粒の基準点（Base point）の計算
    // 上から下への循環落下
    float totalFall = uTime * dropSpeed + aOffset.y * 3.7;
    float fallInBox = mod(totalFall, boxH);
    float baseY = (uBoxCenter.y + boxH * 0.5) - fallInBox;

    // 傾き（風・重力）によるX方向のドリフト
    float xDrift = sin(uAngleRad) * fallInBox;

    // 雨粒の基準点に対してのみボックス内ラップ（mod）を実行
    // これにより head と tail が境界で引き裂かれる（横線バグ）のを 100% 防止
    float baseX = mod(aOffset.x + xDrift - uBoxCenter.x + boxW * 0.5, boxW) + uBoxCenter.x - boxW * 0.5;
    float baseZ = mod(aOffset.z - uBoxCenter.z + boxD * 0.5, boxD) + uBoxCenter.z - boxD * 0.5;

    // 2. 雨筋ベクトル（下向き基準、尾部 aTail=1.0 は斜め上方向へ）
    float actualLength = uLength * aLength;
    vec3 streakVector = vec3(sin(uAngleRad), cos(uAngleRad), 0.0) * actualLength;

    // 3. 頂点位置 = 基準点 + (aTail * 雨筋ベクトル)
    vec3 pos = vec3(baseX, baseY, baseZ) + streakVector * aTail;

    // 4. アルファフェード
    // 尾部フェードアウト (頭部=1.0, 尾部=0.15)
    float alpha = mix(1.0, 0.15, aTail);

    // 上下端での滑らかなフェードアウト
    float yRel = (baseY - (uBoxCenter.y - boxH * 0.5)) / boxH;
    if (yRel < 0.08) {
      alpha *= smoothstep(0.0, 0.08, yRel);
    } else if (yRel > 0.92) {
      alpha *= smoothstep(1.0, 0.92, yRel);
    }

    // 地面付近でのフェードアウト (y < 0.05)
    if (pos.y < 0.05) {
      alpha *= max(0.0, pos.y / 0.05);
    }

    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vAlpha);
  }
`;

const splashVertexShader = /* glsl */ `
  attribute vec3 aSplashPos;
  attribute float aPhase;
  attribute float aScale;

  uniform float uTime;
  uniform float uSplashSpeed;

  varying float vLife;

  void main() {
    // 0.0 〜 1.0 のライフサイクル
    float progress = mod(uTime * uSplashSpeed + aPhase, 1.0);
    vLife = progress;

    // 外側へ広がりながら少し跳ね上がる
    float angle = aPhase * 6.2831853;
    float radius = progress * 0.06 * aScale;
    float yOffset = sin(progress * 3.1415926) * 0.04 * aScale;

    vec3 pos = aSplashPos;
    pos.x += cos(angle) * radius;
    pos.z += sin(angle) * radius;
    pos.y += yOffset;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.0 - progress) * 16.0 * aScale * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const splashFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vLife;

  void main() {
    // 丸いパーティクル
    vec2 coord = gl_PointCoord - vec2(0.5);
    if (length(coord) > 0.5) discard;

    float alpha = (1.0 - vLife) * uOpacity * 0.8;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export class RainEffect {
  public group: THREE.Group;
  private lineSegments: THREE.LineSegments | null = null;
  private splashPoints: THREE.Points | null = null;
  private rainMaterial: THREE.ShaderMaterial;
  private splashMaterial: THREE.ShaderMaterial;

  private readonly boxSize = new THREE.Vector3(8.0, 5.5, 8.0);
  private readonly boxCenter = new THREE.Vector3(0, 1.8, 0);

  private config: RainConfig;
  private currentCount = 0;
  private currentSplashCount = 0;

  constructor(scene: THREE.Scene, config: Partial<RainConfig> = {}) {
    this.config = { ...DEFAULT_RAIN_CONFIG, ...config };
    this.group = new THREE.Group();
    this.group.name = 'RainEffectGroup';

    this.rainMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: this.config.speed },
        uLength: { value: this.config.length },
        uAngleRad: { value: (this.config.angle * Math.PI) / 180 },
        uBoxSize: { value: this.boxSize },
        uBoxCenter: { value: this.boxCenter },
        uColor: { value: new THREE.Color(this.config.color) },
        uOpacity: { value: this.config.opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.splashMaterial = new THREE.ShaderMaterial({
      vertexShader: splashVertexShader,
      fragmentShader: splashFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSplashSpeed: { value: 3.5 },
        uColor: { value: new THREE.Color(this.config.color) },
        uOpacity: { value: this.config.opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.rebuildRainMesh();
    this.rebuildSplashMesh();

    scene.add(this.group);
    this.group.visible = this.config.enabled;
  }

  private rebuildRainMesh(): void {
    if (this.lineSegments) {
      this.group.remove(this.lineSegments);
      this.lineSegments.geometry.dispose();
      this.lineSegments = null;
    }

    const count = this.config.count;
    this.currentCount = count;

    // 各雨粒は2頂点（head と tail）
    const totalVertices = count * 2;
    const positions = new Float32Array(totalVertices * 3);
    const aTail = new Float32Array(totalVertices);
    const aSpeed = new Float32Array(totalVertices);
    const aLength = new Float32Array(totalVertices);
    const aOffset = new Float32Array(totalVertices * 3);

    for (let i = 0; i < count; i++) {
      const idx = i * 2;

      // ボックス内のランダムオフセット
      const ox = (Math.random() - 0.5) * this.boxSize.x + this.boxCenter.x;
      const oy = (Math.random() - 0.5) * this.boxSize.y + this.boxCenter.y;
      const oz = (Math.random() - 0.5) * this.boxSize.z + this.boxCenter.z;

      const speedVariation = 0.85 + Math.random() * 0.3; // 0.85 〜 1.15
      const lengthVariation = 0.8 + Math.random() * 0.4; // 0.8 〜 1.2

      // Head vertex
      positions[idx * 3] = ox;
      positions[idx * 3 + 1] = oy;
      positions[idx * 3 + 2] = oz;
      aOffset[idx * 3] = ox;
      aOffset[idx * 3 + 1] = oy;
      aOffset[idx * 3 + 2] = oz;
      aTail[idx] = 0.0;
      aSpeed[idx] = speedVariation;
      aLength[idx] = lengthVariation;

      // Tail vertex
      positions[(idx + 1) * 3] = ox;
      positions[(idx + 1) * 3 + 1] = oy;
      positions[(idx + 1) * 3 + 2] = oz;
      aOffset[(idx + 1) * 3] = ox;
      aOffset[(idx + 1) * 3 + 1] = oy;
      aOffset[(idx + 1) * 3 + 2] = oz;
      aTail[idx + 1] = 1.0;
      aSpeed[idx + 1] = speedVariation;
      aLength[idx + 1] = lengthVariation;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aTail', new THREE.BufferAttribute(aTail, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
    geometry.setAttribute('aLength', new THREE.BufferAttribute(aLength, 1));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(aOffset, 3));

    this.lineSegments = new THREE.LineSegments(geometry, this.rainMaterial);
    this.lineSegments.frustumCulled = false;
    this.group.add(this.lineSegments);
  }

  private rebuildSplashMesh(): void {
    if (this.splashPoints) {
      this.group.remove(this.splashPoints);
      this.splashPoints.geometry.dispose();
      this.splashPoints = null;
    }

    if (!this.config.splashEnabled) return;

    const count = this.config.splashCount;
    this.currentSplashCount = count;

    const positions = new Float32Array(count * 3);
    const aSplashPos = new Float32Array(count * 3);
    const aPhase = new Float32Array(count);
    const aScale = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * this.boxSize.x * 0.9 + this.boxCenter.x;
      const oy = 0.02 + Math.random() * 0.03; // 地面付近
      const oz = (Math.random() - 0.5) * this.boxSize.z * 0.9 + this.boxCenter.z;

      positions[i * 3] = ox;
      positions[i * 3 + 1] = oy;
      positions[i * 3 + 2] = oz;

      aSplashPos[i * 3] = ox;
      aSplashPos[i * 3 + 1] = oy;
      aSplashPos[i * 3 + 2] = oz;

      aPhase[i] = Math.random();
      aScale[i] = 0.7 + Math.random() * 0.6;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSplashPos', new THREE.BufferAttribute(aSplashPos, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(aScale, 1));

    this.splashPoints = new THREE.Points(geometry, this.splashMaterial);
    this.splashPoints.frustumCulled = false;
    this.group.add(this.splashPoints);
  }

  public updateConfig(newConfig: Partial<RainConfig>): void {
    const prevCount = this.config.count;
    const prevSplashCount = this.config.splashCount;
    const prevSplashEnabled = this.config.splashEnabled;

    Object.assign(this.config, newConfig);

    this.group.visible = !!this.config.enabled;

    if (!this.config.enabled) return;

    if (this.config.count !== prevCount) {
      this.rebuildRainMesh();
    }
    if (this.config.splashCount !== prevSplashCount || this.config.splashEnabled !== prevSplashEnabled) {
      this.rebuildSplashMesh();
    }

    // Update uniforms
    this.rainMaterial.uniforms.uSpeed.value = this.config.speed;
    this.rainMaterial.uniforms.uLength.value = this.config.length;
    this.rainMaterial.uniforms.uAngleRad.value = (this.config.angle * Math.PI) / 180;
    this.rainMaterial.uniforms.uColor.value.set(this.config.color);
    this.rainMaterial.uniforms.uOpacity.value = this.config.opacity;

    this.splashMaterial.uniforms.uColor.value.set(this.config.color);
    this.splashMaterial.uniforms.uOpacity.value = this.config.opacity;
  }

  public update(elapsed: number): void {
    if (!this.config.enabled) return;

    this.rainMaterial.uniforms.uTime.value = elapsed;
    this.splashMaterial.uniforms.uTime.value = elapsed;
  }

  public setCameraPosition(cameraPos: THREE.Vector3): void {
    this.boxCenter.x = cameraPos.x;
    this.boxCenter.z = cameraPos.z;
    this.rainMaterial.uniforms.uBoxCenter.value.copy(this.boxCenter);
  }

  public dispose(): void {
    if (this.lineSegments) {
      this.group.remove(this.lineSegments);
      this.lineSegments.geometry.dispose();
      this.lineSegments = null;
    }
    if (this.splashPoints) {
      this.group.remove(this.splashPoints);
      this.splashPoints.geometry.dispose();
      this.splashPoints = null;
    }
    this.rainMaterial.dispose();
    this.splashMaterial.dispose();
  }
}
