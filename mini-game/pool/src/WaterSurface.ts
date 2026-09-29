import * as THREE from 'three';
import type { FloatingIsland } from './FloatingIsland';
import { WaterSimulation } from './water/WaterSimulation';
import { Caustics } from './water/Caustics';
import { SplashSystem, CrownSheet } from './water/SplashSystem';
import { POOL_HALF, POOL_SIZE, POOL_DEPTH, WAVE_GLSL } from './water/WaterGLSL';

const SUN_POSITION = new THREE.Vector3(3.2, 4.3, -3.8);
const RIM_SAMPLES = 28;
const REFLECTION_SCALE = 0.5;
const GRID = WaterSimulation.GRID.toFixed(1);

/** プール底・側壁で共有するタイル＋コースティクスのシェーダー部品 */
const POOL_TILE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec3 poolTile(vec2 p) {
  vec2 tp = p / 0.30;
  vec2 tf = fract(tp);
  vec2 tid = floor(tp);
  float edge = min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y));
  float grout = 1.0 - smoothstep(0.0, 0.04, edge);
  vec3 tile = vec3(0.80, 0.94, 0.97) * (0.965 + hash21(tid) * 0.06);
  return mix(tile, vec3(0.50, 0.68, 0.75), grout * 0.75);
}
`;

export class WaterSurface {
  public group = new THREE.Group();

  private renderer: THREE.WebGLRenderer;
  private sim: WaterSimulation;
  private caustics: Caustics;
  private splash = new SplashSystem();
  private crowns: CrownSheet[] = [];
  private nextCrown = 0;

  private surface: THREE.Mesh;
  private poolFloor: THREE.Mesh;
  private poolWalls: THREE.Mesh[] = [];
  private floorUniforms: Record<string, THREE.IUniform>[] = [];

  // 平面反射
  private reflectionTarget: THREE.WebGLRenderTarget;
  private reflectionCamera = new THREE.PerspectiveCamera();
  private textureMatrix = new THREE.Matrix4();

  private sunDir = SUN_POSITION.clone().normalize();
  private time = 0;
  private island: FloatingIsland | null = null;
  private timers: Array<{ t: number; fn: () => void }> = [];

  // 島の縁が水を押す・叩く動きの追跡
  private rimPrevY = new Float32Array(RIM_SAMPLES);
  private rimCooldown = new Float32Array(RIM_SAMPLES);
  private rimInitialized = false;

  // 水に浮かんでいるキャラの波紋
  private floaters = new Map<string, { x: number; z: number; timer: number; sign: number }>();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    const floatLinear = renderer.extensions.has('OES_texture_float_linear');
    this.sim = new WaterSimulation(floatLinear);
    this.sim.setIslandSponge(1.55);
    this.caustics = new Caustics(this.sim.texture, this.sunDir);

    // 平面反射用のレンダーターゲット（画面の半分の解像度）
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.reflectionTarget = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(size.x * REFLECTION_SCALE)),
      Math.max(2, Math.floor(size.y * REFLECTION_SCALE)),
      { type: THREE.HalfFloatType, samples: 4 }
    );

    this.poolFloor = this.buildPoolInterior();
    this.buildDeck();
    this.surface = this.buildSurface();

    this.group.add(this.splash.mesh);
    for (let i = 0; i < 4; i++) {
      const crown = new CrownSheet();
      this.crowns.push(crown);
      this.group.add(crown.mesh);
    }

    scene.add(this.group);
  }

  public setIsland(island: FloatingIsland) {
    this.island = island;
    this.splash.islandRadius = island.radius;
    this.splash.islandTopY = island.height * 0.5;
    this.splash.onLanding = (e) => this.onDropletLanding(e.x, e.z, e.size, e.speed);
  }

  /** 画面サイズ変更（反射の解像度とスプラッシュのピクセル換算を更新） */
  public setSize(pixelWidth: number, pixelHeight: number) {
    this.reflectionTarget.setSize(
      Math.max(2, Math.floor(pixelWidth * REFLECTION_SCALE)),
      Math.max(2, Math.floor(pixelHeight * REFLECTION_SCALE))
    );
  }

  // ------------------------------------------------------------------
  // 構築
  // ------------------------------------------------------------------

  /** プール底と側壁（タイル＋コースティクス＋島の影） */
  private buildPoolInterior(): THREE.Mesh {
    const commonUniforms = () => ({
      uCaustics: { value: this.caustics.texture },
      uSunDir: { value: this.sunDir },
      uIslandCenter: { value: new THREE.Vector3() },
      uIslandR: { value: 1.55 },
    });

    const shadeFn = /* glsl */ `
      uniform sampler2D uCaustics;
      uniform vec3 uSunDir;
      uniform vec3 uIslandCenter;
      uniform float uIslandR;
      ${POOL_TILE_GLSL}

      // 島（水面に浮かぶ円盤）が落とす影。水中の光の進む向きをたどって水面の交点を求める。
      float islandShadow(vec3 wp) {
        vec3 r = refract(-normalize(uSunDir), vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
        float s = (0.0 - wp.y) / max(-r.y, 0.05);
        vec2 q = wp.xz - r.xz * s;
        float d = length(q - uIslandCenter.xz);
        return 1.0 - smoothstep(uIslandR - 0.12, uIslandR + 0.28, d);
      }
    `;

    // 底
    const floorU = commonUniforms();
    this.floorUniforms.push(floorU);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: floorU,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPos;
        ${shadeFn}
        void main() {
          vec2 uv = (vWorldPos.xz + ${POOL_HALF.toFixed(1)}) / ${POOL_SIZE.toFixed(1)};
          vec3 base = poolTile(vWorldPos.xz);
          float c = min(texture2D(uCaustics, uv).r, 4.0);
          float shadow = islandShadow(vWorldPos);
          float lit = 0.42 + 0.44 * pow(c, 1.1) * (1.0 - shadow * 0.9);
          gl_FragColor = vec4(base * lit, 1.0);
        }
      `,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(POOL_SIZE, POOL_SIZE), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -POOL_DEPTH;
    this.group.add(floor);

    // 側壁 4 枚（内向き）
    const wallU = commonUniforms();
    this.floorUniforms.push(wallU);
    const wallMat = new THREE.ShaderMaterial({
      uniforms: wallU,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPos;
        ${shadeFn}
        void main() {
          vec3 wp = vWorldPos;
          // 壁に沿った座標 a（x 壁なら z、z 壁なら x）
          float a = abs(abs(wp.x) - ${POOL_HALF.toFixed(2)}) < 0.02 ? wp.z : wp.x;
          vec3 base = poolTile(vec2(a, wp.y));
          vec2 cuv = vec2((a + ${POOL_HALF.toFixed(1)}) / ${POOL_SIZE.toFixed(1)}, 0.5 + (wp.y + 1.1) / ${POOL_SIZE.toFixed(1)});
          float c = min(texture2D(uCaustics, cuv).r, 4.0);
          float depth = clamp(-wp.y / ${POOL_DEPTH.toFixed(1)}, 0.0, 1.0);
          float lit = (0.34 + 0.45 * pow(c, 1.1)) * mix(1.0, 0.72, depth);
          gl_FragColor = vec4(base * lit, 1.0);
        }
      `,
    });
    const half = POOL_HALF;
    const defs: Array<[number, number, number, number]> = [
      [0, -half, 0, 0],            // 北壁 (z=-8) → 南向き
      [0, half, Math.PI, 0],       // 南壁 (z=+8)
      [-half, 0, Math.PI / 2, 0],  // 西壁
      [half, 0, -Math.PI / 2, 0],  // 東壁
    ];
    for (const [x, z, ry] of defs) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(POOL_SIZE, POOL_DEPTH), wallMat);
      wall.position.set(x, -POOL_DEPTH / 2, z);
      wall.rotation.y = ry;
      this.group.add(wall);
      this.poolWalls.push(wall);
    }
    return floor;
  }

  /** プールサイドのデッキ・外周壁・縁石 */
  private buildDeck() {
    const deckShape = new THREE.Shape();
    deckShape.moveTo(-36, -36);
    deckShape.lineTo(36, -36);
    deckShape.lineTo(36, 36);
    deckShape.lineTo(-36, 36);
    deckShape.closePath();

    const holePath = new THREE.Path();
    holePath.moveTo(-8, -8);
    holePath.lineTo(8, -8);
    holePath.lineTo(8, 8);
    holePath.lineTo(-8, 8);
    holePath.closePath();
    deckShape.holes.push(holePath);

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 256;
    tileCanvas.height = 256;
    const tCtx = tileCanvas.getContext('2d')!;
    tCtx.fillStyle = '#faf3e5';
    tCtx.fillRect(0, 0, 256, 256);
    tCtx.strokeStyle = '#e7d8c4';
    tCtx.lineWidth = 4;
    tCtx.strokeRect(2, 2, 252, 252);
    tCtx.fillStyle = 'rgba(215, 195, 170, 0.15)';
    for (let i = 0; i < 180; i++) {
      tCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tileTexture = new THREE.CanvasTexture(tileCanvas);
    tileTexture.colorSpace = THREE.SRGBColorSpace;
    tileTexture.wrapS = THREE.RepeatWrapping;
    tileTexture.wrapT = THREE.RepeatWrapping;
    tileTexture.anisotropy = 8;
    tileTexture.repeat.set(18, 18);

    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xfdf6ea,
      map: tileTexture,
      roughness: 0.35,
      metalness: 0.02,
    });
    const poolDeck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape), deckMat);
    poolDeck.rotation.x = -Math.PI / 2;
    poolDeck.position.y = 0.04;
    poolDeck.receiveShadow = true;
    this.group.add(poolDeck);

    const wallBorderMat = new THREE.MeshStandardMaterial({ color: 0xfdf8ee, roughness: 0.5, metalness: 0.0 });
    for (const x of [-18, 18]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 36), wallBorderMat);
      m.position.set(x, 0.25, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    for (const z of [-18, 18]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(36, 0.5, 0.35), wallBorderMat);
      m.position.set(0, 0.25, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }

    const copingMat = new THREE.MeshStandardMaterial({ color: 0xfffcf5, roughness: 0.2, metalness: 0.02 });
    const cNorth = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.12, 0.4), copingMat);
    cNorth.position.set(0, 0.06, -8.1);
    const cSouth = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.12, 0.4), copingMat);
    cSouth.position.set(0, 0.06, 8.1);
    const cEast = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 16.6), copingMat);
    cEast.position.set(8.1, 0.06, 0);
    const cWest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 16.6), copingMat);
    cWest.position.set(-8.1, 0.06, 0);
    this.group.add(cNorth, cSouth, cEast, cWest);
  }

  /** 水面: うねり＋高さ場の変位、さざ波の法線、平面反射、フレネル、太陽の反射、泡 */
  private buildSurface(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSim: { value: this.sim.texture },
        tReflection: { value: this.reflectionTarget.texture },
        uTextureMatrix: { value: this.textureMatrix },
        uSunDir: { value: this.sunDir },
        uDeepColor: { value: new THREE.Color('#0a8fb0') },
        uShallowColor: { value: new THREE.Color('#37d1d6') },
        uFoamColor: { value: new THREE.Color('#f4fbff') },
        uDistortion: { value: 0.30 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uSim;
        uniform mat4 uTextureMatrix;
        varying vec3 vWorldPos;
        varying vec4 vReflUv;
        varying vec2 vSimUv;
        ${WAVE_GLSL}

        void main() {
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          vReflUv = uTextureMatrix * vec4(p, 1.0);

          vec2 gMacro;
          float hMacro = macroWave(p.xz, uTime, gMacro);
          vec2 suv = (p.xz + ${POOL_HALF.toFixed(1)}) / ${POOL_SIZE.toFixed(1)};
          float hSim = texture2D(uSim, suv).r;
          // プールの縁では変位を抑える（デッキから水が飛び出して見えないように）
          float edge = smoothstep(0.0, 0.7, ${POOL_HALF.toFixed(1)} - max(abs(p.x), abs(p.z)));
          p.y += (hMacro + hSim) * edge;

          vWorldPos = p;
          vSimUv = suv;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uSim;
        uniform sampler2D tReflection;
        uniform vec3 uSunDir;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform float uDistortion;
        varying vec3 vWorldPos;
        varying vec4 vReflUv;
        varying vec2 vSimUv;
        ${WAVE_GLSL}

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          vec3 wp = vWorldPos;
          vec3 toCam = cameraPosition - wp;
          float dist = length(toCam);
          vec3 V = toCam / dist;
          vec3 L = normalize(uSunDir);

          // --- 法線: うねり + さざ波 + シミュレーション（波紋）---
          vec2 gMacro;
          macroWave(wp.xz, uTime, gMacro);
          float detail = 1.0 - smoothstep(10.0, 24.0, dist);
          vec2 gMicro = microGradient(wp.xz, uTime) * mix(0.35, 1.0, detail);
          const float E = 1.0 / ${GRID};
          const float CELL = ${POOL_SIZE.toFixed(1)} / ${GRID};
          vec4 sC = texture2D(uSim, vSimUv);
          float hR = texture2D(uSim, vSimUv + vec2(E, 0.0)).r;
          float hL = texture2D(uSim, vSimUv - vec2(E, 0.0)).r;
          float hU = texture2D(uSim, vSimUv + vec2(0.0, E)).r;
          float hD = texture2D(uSim, vSimUv - vec2(0.0, E)).r;
          vec2 gSim = vec2(hR - hL, hU - hD) / (2.0 * CELL);
          vec2 g = gMacro + gMicro + gSim;
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

          // --- フレネル反射 ---
          float NdotV = clamp(dot(N, V), 0.001, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

          vec2 ruv = vReflUv.xy / vReflUv.w;
          ruv += N.xz * uDistortion / (1.0 + dist * 0.12);
          vec3 reflection = texture2D(tReflection, ruv).rgb;

          // --- 水の体積色（視線が水中を通る距離で濃くなる）---
          float pathLen = ${POOL_DEPTH.toFixed(1)} / max(NdotV, 0.14);
          float bodyA = 1.0 - exp(-0.24 * pathLen);
          vec3 body = mix(uShallowColor, uDeepColor, 1.0 - exp(-0.13 * pathLen));
          body *= 0.72 + 0.45 * max(dot(N, L), 0.0);
          // 太陽側に傾いた波の面は透けて明るい青緑に
          body += vec3(0.02, 0.10, 0.10) * pow(max(dot(N, normalize(L + vec3(0.0, 0.4, 0.0))), 0.0), 3.0);

          // --- 太陽の反射（きらめき）---
          vec3 H = normalize(L + V);
          float NdotH = max(dot(N, H), 0.0);
          float spec = pow(NdotH, 1100.0) * 14.0 + pow(NdotH, 130.0) * 0.55;

          // --- 泡 ---
          float foamRaw = sC.g;
          float fn = noise(wp.xz * 8.0 + vec2(uTime * 0.10, -uTime * 0.07)) * 0.55
                   + noise(wp.xz * 21.0 - vec2(uTime * 0.16, uTime * 0.05)) * 0.45;
          float foam = smoothstep(0.22, 0.72, foamRaw * (0.30 + 1.15 * fn));
          vec3 foamCol = uFoamColor * (0.74 + 0.26 * max(dot(N, L), 0.0));

          // --- 合成（プリマルチプライド）---
          float aBody = bodyA * (1.0 - F);
          vec3 C = body * aBody + reflection * F + vec3(1.0, 0.98, 0.93) * spec;
          float A = aBody + F;
          C = mix(C, foamCol, foam);
          A = mix(A, 1.0, foam * 0.94);
          gl_FragColor = vec4(C, clamp(A, 0.0, 1.0));
        }
      `,
    });

    const geo = new THREE.PlaneGeometry(POOL_SIZE, POOL_SIZE, 192, 192);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------
  // 演出の発生
  // ------------------------------------------------------------------

  private later(delay: number, fn: () => void) {
    this.timers.push({ t: delay, fn });
  }

  private rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  /**
   * キャラクターが水に落ちた時の大しぶき。
   * 水面のへこみ → 王冠状の水膜と水滴 → 中央のジェット → 泡と波紋、の順に起こる。
   * strength は着水の勢い（1.0 が標準）。
   */
  public triggerBigSplash(position: THREE.Vector3, strength = 1) {
    const s = THREE.MathUtils.clamp(strength, 0.45, 1.5);
    const x = position.x, z = position.z;

    // 水面: へこみ→跳ね返り→第二波
    this.sim.addDrop(x, z, 0.55, -0.20 * s);
    this.sim.addFoam(x, z, 0.75 * s, 0.9);
    this.later(0.14, () => this.sim.addDrop(x, z, 0.24, 0.16 * s));
    this.later(0.30, () => this.sim.addDrop(x, z, 0.32, -0.055 * s));
    this.later(0.48, () => this.sim.addDrop(x, z, 0.30, 0.035 * s));

    // 王冠状の水膜
    const crown = this.crowns[this.nextCrown++ % this.crowns.length];
    crown.start(x, z, s);

    // 王冠のふちから飛び散る水滴
    const ringCount = Math.floor(260 + 200 * s);
    for (let i = 0; i < ringCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const elev = this.rand(0.7, 1.35);
      const speed = this.rand(1.8, 4.8) * (0.6 + 0.5 * s) * (Math.random() < 0.15 ? 1.4 : 1);
      const r0 = this.rand(0.18, 0.34);
      const size = this.rand(0.006, 0.014) * (Math.random() < 0.12 ? 1.6 : 1);
      this.splash.spawn(
        0,
        x + Math.cos(a) * r0, 0.02, z + Math.sin(a) * r0,
        Math.cos(a) * Math.cos(elev) * speed, Math.sin(elev) * speed, Math.sin(a) * Math.cos(elev) * speed,
        size, 2.4
      );
    }

    // 細かい飛沫（速くて小さい）
    const sprayCount = Math.floor(260 * s);
    for (let i = 0; i < sprayCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const elev = this.rand(0.5, 1.5);
      const speed = this.rand(2.8, 6.5) * (0.6 + 0.5 * s);
      this.splash.spawn(
        0,
        x + Math.cos(a) * 0.2, 0.03, z + Math.sin(a) * 0.2,
        Math.cos(a) * Math.cos(elev) * speed, Math.sin(elev) * speed, Math.sin(a) * Math.cos(elev) * speed,
        this.rand(0.004, 0.008), 2.0, 0.6
      );
    }

    // 中央のジェット（少し遅れて真上に噴き上がる）
    this.later(0.07, () => {
      const jetCount = Math.floor(110 * s);
      for (let i = 0; i < jetCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const spread = Math.random() * 0.5;
        const up = this.rand(3.0, 6.2) * (0.6 + 0.5 * s);
        this.splash.spawn(
          0,
          x + Math.cos(a) * 0.05, 0.05, z + Math.sin(a) * 0.05,
          Math.cos(a) * spread, up, Math.sin(a) * spread,
          this.rand(0.008, 0.018), 2.4, 0.2
        );
      }
    });

    // 水煙
    const mistCount = Math.floor(22 + 14 * s);
    for (let i = 0; i < mistCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = this.rand(0.15, 0.5);
      const speed = this.rand(0.3, 1.1);
      this.splash.spawn(
        1,
        x + Math.cos(a) * r0, this.rand(0.05, 0.5), z + Math.sin(a) * r0,
        Math.cos(a) * speed, this.rand(0.2, 1.1), Math.sin(a) * speed,
        this.rand(0.18, 0.36), this.rand(1.0, 1.7), 1.8
      );
    }

    // 水中: 巻き込まれた空気の白濁と気泡
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = Math.random() * 0.35;
      this.splash.spawn(
        1,
        x + Math.cos(a) * r0, this.rand(-0.75, -0.2), z + Math.sin(a) * r0,
        0, this.rand(-0.05, 0.1), 0,
        this.rand(0.22, 0.42), this.rand(1.4, 2.4), 2.5
      );
    }
    this.later(0.06, () => {
      const bubbleCount = Math.floor(70 * s);
      for (let i = 0; i < bubbleCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = Math.random() * 0.4;
        const v = this.rand(0.35, 1.0);
        this.splash.spawn(
          2,
          x + Math.cos(a) * r0, this.rand(-0.85, -0.15), z + Math.sin(a) * r0,
          0, v, 0,
          this.rand(0.006, 0.022), this.rand(1.0, 2.6)
        );
      }
    });
  }

  /**
   * 島が水面を叩いた時のしぶき（ヒップアタックの衝撃）。
   * 打たれた側の島の縁が沈んで水を跳ね上げる。
   */
  public triggerImpactSplash(position: THREE.Vector3, strength = 1) {
    const s = THREE.MathUtils.clamp(strength, 0.4, 1.5);
    const isl = this.island;
    const cx = isl ? isl.group.position.x : 0;
    const cz = isl ? isl.group.position.z : 0;
    const R = isl ? isl.radius : 1.55;

    let dx = position.x - cx;
    let dz = position.z - cz;
    if (Math.hypot(dx, dz) < 0.35 && isl) {
      // 中央付近（相殺など）: 島がいちばん傾いて沈んだ側の縁で受ける
      dx = -Math.tan(isl.tiltZ);
      dz = Math.tan(isl.tiltX);
      if (Math.hypot(dx, dz) < 1e-4) { dx = 1; dz = 0; }
    }
    const ang = Math.atan2(dz, dx);
    const rx = cx + Math.cos(ang) * (R + 0.06);
    const rz = cz + Math.sin(ang) * (R + 0.06);

    this.sim.addDrop(rx, rz, 0.38, 0.05 * s);
    this.sim.addFoam(rx, rz, 0.6 * s, 0.9);
    this.later(0.12, () => this.sim.addDrop(rx, rz, 0.3, -0.035 * s));

    this.emitFan(rx, rz, ang, 0.7, Math.floor(150 * s), 1.2 + 0.6 * s);
    this.emitFan(rx, rz, ang, 0.25, Math.floor(50 * s), 1.6 + 0.6 * s);
    for (let i = 0; i < 12; i++) {
      const a = ang + this.rand(-0.6, 0.6);
      this.splash.spawn(
        1, rx, this.rand(0.05, 0.3), rz,
        Math.cos(a) * this.rand(0.2, 0.7), this.rand(0.2, 0.7), Math.sin(a) * this.rand(0.2, 0.7),
        this.rand(0.14, 0.28), this.rand(0.9, 1.5), 1.8
      );
    }
  }

  /** ある向きへ扇状に飛ぶ水滴 */
  private emitFan(x: number, z: number, angle: number, spread: number, count: number, speedScale: number) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() + Math.random() - 1) * spread;
      const elev = this.rand(0.55, 1.4);
      const speed = this.rand(1.0, 3.2) * speedScale;
      this.splash.spawn(
        0,
        x + Math.cos(a) * 0.05, 0.02, z + Math.sin(a) * 0.05,
        Math.cos(a) * Math.cos(elev) * speed, Math.sin(elev) * speed, Math.sin(a) * Math.cos(elev) * speed,
        this.rand(0.005, 0.012), 2.0
      );
    }
  }

  /** 水に浮かぶキャラの周りに、ゆらゆらと小さな波紋を出し続ける */
  public setFloater(id: string, x: number, z: number, active: boolean) {
    if (!active) {
      this.floaters.delete(id);
      return;
    }
    const f = this.floaters.get(id);
    if (f) {
      f.x = x;
      f.z = z;
    } else {
      this.floaters.set(id, { x, z, timer: 0.15, sign: 1 });
    }
  }

  /** 落ちてきた水滴が水面に戻った時の小さな波紋 */
  private onDropletLanding(x: number, z: number, size: number, speed: number) {
    const amp = Math.min(0.014, size * speed * 0.35);
    this.sim.addDrop(x, z, 0.09 + size * 3.0, -amp);
    this.sim.addFoam(x, z, 0.09, 0.05);
  }

  /** 島の縁が水を押す・叩く動き（沈む縁の泡、水の盛り上がり、跳ねる水滴）*/
  private updateIslandWake(delta: number) {
    const isl = this.island;
    if (!isl || delta <= 0) return;

    const cx = isl.group.position.x;
    const cz = isl.group.position.z;
    const R = isl.radius;
    const gy = isl.group.position.y - isl.height / 2;
    const tX = Math.tan(isl.tiltX);
    const tZ = Math.tan(isl.tiltZ);

    for (let i = 0; i < RIM_SAMPLES; i++) {
      const th = (i / RIM_SAMPLES) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const yBottom = gy - tX * (R * s) + tZ * (R * c);
      const prev = this.rimInitialized ? this.rimPrevY[i] : yBottom;
      this.rimPrevY[i] = yBottom;
      this.rimCooldown[i] -= delta;

      const vy = (yBottom - prev) / delta;
      const depth = -yBottom; // 正: 縁が水中に入っている
      if (depth < -0.03) continue;

      const ox = cx + c * (R + 0.09);
      const oz = cz + s * (R + 0.09);
      const contact = THREE.MathUtils.clamp(depth * 7 + 0.2, 0, 1);

      this.sim.addFoam(ox, oz, 0.22, delta * (0.35 + Math.abs(vy) * 2.2) * contact);
      // 縁が沈めば水が押されて盛り上がり、上がれば引かれる
      this.sim.addDrop(ox, oz, 0.24, -vy * delta * 0.55 * contact);

      if (vy < -0.28 && depth > -0.02 && this.rimCooldown[i] <= 0) {
        this.rimCooldown[i] = 0.10;
        this.emitFan(ox, oz, th, 0.5, Math.min(16, Math.floor(-vy * 12)), 0.7 + Math.min(-vy, 1.5) * 0.5);
      }
    }
    this.rimInitialized = true;
  }

  // ------------------------------------------------------------------
  // 更新・描画
  // ------------------------------------------------------------------

  public update(delta: number, camera?: THREE.PerspectiveCamera) {
    this.time += delta;

    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= delta;
      if (this.timers[i].t <= 0) {
        const fn = this.timers[i].fn;
        this.timers.splice(i, 1);
        fn();
      }
    }

    this.updateIslandWake(delta);

    for (const [, f] of this.floaters) {
      f.timer -= delta;
      if (f.timer <= 0) {
        f.timer = this.rand(0.22, 0.42);
        f.sign = -f.sign;
        const ox = f.x + this.rand(-0.18, 0.18);
        const oz = f.z + this.rand(-0.18, 0.18);
        this.sim.addDrop(ox, oz, 0.2, 0.011 * f.sign);
        this.sim.addFoam(f.x, f.z, 0.34, 0.06);
      }
    }

    this.sim.update(delta);
    this.splash.update(delta);
    for (const crown of this.crowns) crown.update(delta);

    if (camera) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.splash.setViewport(camera, size.x, size.y);
    }

    const isl = this.island;
    for (const u of this.floorUniforms) {
      if (isl) (u.uIslandCenter.value as THREE.Vector3).set(isl.group.position.x, 0, isl.group.position.z);
    }
    (this.surface.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;

    // コースティクス（水面の形から毎フレーム作り直す）
    this.caustics.render(this.renderer, this.time);
  }

  /**
   * 平面反射の描画。カメラを水面で鏡写しにした仮想カメラでシーンを描き、水面シェーダーが参照する。
   * カメラの最終位置が決まったあと、本描画の直前に呼ぶ。
   */
  public renderReflection(scene: THREE.Scene, camera: THREE.PerspectiveCamera, hide: THREE.Object3D[] = []) {
    camera.updateMatrixWorld();
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y <= 0.05) return;

    const cam = this.reflectionCamera;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const target = camPos.clone().add(fwd);

    cam.position.set(camPos.x, -camPos.y, camPos.z);
    cam.up.set(up.x, -up.y, up.z);
    cam.lookAt(target.x, -target.y, target.z);
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    // 水面上の点を反射テクスチャの座標へ変換する行列
    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    this.textureMatrix.multiply(cam.projectionMatrix);
    this.textureMatrix.multiply(cam.matrixWorldInverse);

    // 水面より下を切り落とす斜め近クリップ面
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    plane.applyMatrix4(cam.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1.0,
      (1.0 + pm.elements[10]) / pm.elements[14]
    );
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0 - 0.003;
    pm.elements[14] = clip.w;

    const hidden: Array<[THREE.Object3D, boolean]> = [];
    const hideList = [this.surface, this.poolFloor, ...this.poolWalls, ...hide];
    for (const o of hideList) {
      hidden.push([o, o.visible]);
      o.visible = false;
    }

    const prevTarget = this.renderer.getRenderTarget();
    const prevShadowAuto = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setRenderTarget(this.reflectionTarget);
    this.renderer.clear();
    this.renderer.render(scene, cam);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.shadowMap.autoUpdate = prevShadowAuto;

    for (const [o, v] of hidden) o.visible = v;
  }

  public get activeParticles() {
    return this.splash.activeCount;
  }

  public clearEffects() {
    this.splash.clear();
    this.timers.length = 0;
    this.floaters.clear();
  }
}
