import * as THREE from 'three';
import { resolveAssetUrl } from '../../../utils/path';

/**
 * 歩きながらの会話で使う、横に流れ続ける背景（ルートの ScrollingBackgroundManager の移植）。
 * カメラの前に同じ背景を3枚並べ、つなぎ目を半透明でぼかしながら横にずらし続ける。
 * 空が透過した背景なら、後ろの空（SkyBackground）がそのまま見える。
 */
const ScrollingBlurShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uBlurAmount: { value: 0.0 },
    uFeatherWidth: { value: 0.2 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uBlurAmount;
    uniform float uFeatherWidth;
    varying vec2 vUv;

    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      // 左右の端を半透明にして、隣の板とつなぎ目なく重ねる
      float edgeAlpha = 1.0;
      if (uFeatherWidth > 0.001) {
        edgeAlpha = smoothstep(0.0, uFeatherWidth, vUv.x) * smoothstep(1.0, 1.0 - uFeatherWidth, vUv.x);
      }

      if (uBlurAmount <= 0.002) {
        vec4 col = texture2D(tDiffuse, vUv);
        gl_FragColor = vec4(col.rgb, col.a * edgeAlpha);
        return;
      }

      // すりガラス風のぼかし（キャラに視線を集める）
      float noise = (hash21(vUv * 600.0) - 0.5) * 2.0;
      float radius = uBlurAmount * 0.012;
      vec2 taps[16];
      taps[0]  = vec2( 0.0,  0.0);  taps[1]  = vec2( 0.28,  0.15);
      taps[2]  = vec2(-0.25, 0.32); taps[3]  = vec2( 0.35, -0.28);
      taps[4]  = vec2(-0.38,-0.18); taps[5]  = vec2( 0.58,  0.42);
      taps[6]  = vec2(-0.62, 0.38); taps[7]  = vec2( 0.45, -0.58);
      taps[8]  = vec2(-0.52,-0.55); taps[9]  = vec2( 0.82,  0.12);
      taps[10] = vec2(-0.85,-0.10); taps[11] = vec2( 0.12,  0.85);
      taps[12] = vec2(-0.15,-0.88); taps[13] = vec2( 0.75, -0.65);
      taps[14] = vec2(-0.72, 0.68); taps[15] = vec2( 0.95,  0.75);
      vec4 sum = vec4(0.0);
      float total = 0.0;
      for (int i = 0; i < 16; i++) {
        vec2 sampleUv = vUv + taps[i] * radius + vec2(noise * 0.0018 * uBlurAmount);
        float w = 1.0 - length(taps[i]) * 0.45;
        sum += texture2D(tDiffuse, sampleUv) * w;
        total += w;
      }
      vec4 frosted = sum / total;
      vec3 rgb = mix(frosted.rgb, vec3(0.96, 0.98, 1.0), 0.09 * uBlurAmount) + noise * 0.014 * uBlurAmount;
      gl_FragColor = vec4(rgb, frosted.a * edgeAlpha);
    }
  `,
};

export interface ScrollingBackgroundSettings {
  textureUrl: string;
  /** 流れる速さ（0 で止まる） */
  speed: number;
  /** ぼかし 0.0〜1.0 */
  blur: number;
  direction: 'left' | 'right';
  /** 板の端をぼかす幅（板の幅に対する比率） */
  featherWidth: number;
}

const PLANE_DISTANCE = 4.5;

export class ScrollingBackground {
  private readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly materials: THREE.ShaderMaterial[];
  private readonly planes: THREE.Mesh[];
  private readonly textureLoader = new THREE.TextureLoader();
  private texture: THREE.Texture | null = null;
  private textureUrl = '';
  private settings: ScrollingBackgroundSettings | null = null;
  private currentBlur = 0;
  private slideOffset = 0;

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera) {
    this.group.visible = false;
    this.materials = [0, 1, 2].map(
      () =>
        new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(ScrollingBlurShader.uniforms),
          vertexShader: ScrollingBlurShader.vertexShader,
          fragmentShader: ScrollingBlurShader.fragmentShader,
          depthWrite: false,
          transparent: true,
        })
    );
    this.planes = this.materials.map((material, i) => {
      const mesh = new THREE.Mesh(this.geometry, material);
      // 描画順を固定して重なりのちらつきを防ぐ（キャラより奥）
      mesh.renderOrder = -5 + i;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });
    this.scene.add(this.group);
  }

  public get isVisible(): boolean {
    return this.settings !== null;
  }

  /** 流れる背景を表示する（null で消す）。同じ背景のまま速さ等だけ変えても流れは途切れない */
  public set(settings: ScrollingBackgroundSettings | null): void {
    if (!settings) {
      this.settings = null;
      this.group.visible = false;
      this.slideOffset = 0;
      return;
    }
    if (!this.settings) this.currentBlur = settings.blur;
    this.settings = settings;
    this.group.visible = true;
    for (const material of this.materials) {
      material.uniforms.uFeatherWidth.value = Math.max(0, Math.min(0.49, settings.featherWidth));
    }
    this.loadTexture(settings.textureUrl);
  }

  private loadTexture(url: string): void {
    const resolved = resolveAssetUrl(url);
    if (resolved === this.textureUrl) return;
    this.textureUrl = resolved;
    this.textureLoader.load(resolved, (texture) => {
      if (this.textureUrl !== resolved) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      this.texture?.dispose();
      this.texture = texture;
      for (const material of this.materials) material.uniforms.tDiffuse.value = texture;
    });
  }

  public update(delta: number): void {
    const settings = this.settings;
    if (!settings) return;

    // ぼかしの切り替えはなめらかに
    const step = delta * 3.5;
    this.currentBlur =
      this.currentBlur < settings.blur
        ? Math.min(settings.blur, this.currentBlur + step)
        : Math.max(settings.blur, this.currentBlur - step);
    for (const material of this.materials) material.uniforms.uBlurAmount.value = this.currentBlur;

    this.slideOffset += (settings.direction === 'left' ? -1 : 1) * settings.speed * delta;

    // カメラの正面に、視野より大きい板を3枚並べる
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    this.group.position.copy(this.camera.position).addScaledVector(forward, PLANE_DISTANCE);
    this.group.quaternion.copy(this.camera.quaternion);

    const frustumHeight = 2 * PLANE_DISTANCE * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const planeHeight = frustumHeight * 1.6;
    const planeWidth = frustumHeight * this.camera.aspect * 1.8;
    const stepSpan = planeWidth * (1 - Math.max(0, Math.min(0.49, settings.featherWidth)));

    let offset = this.slideOffset % stepSpan;
    if (offset > 0) offset -= stepSpan;
    [offset - stepSpan, offset, offset + stepSpan].forEach((x, i) => {
      this.planes[i].position.set(x, 0, -0.004 * i);
      this.planes[i].scale.set(planeWidth, planeHeight, 1);
    });
  }

  public dispose(): void {
    this.scene.remove(this.group);
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.texture?.dispose();
  }
}
