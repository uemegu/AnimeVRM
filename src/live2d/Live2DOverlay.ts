import { resolveAssetUrl } from '../utils/path';
import type { Live2DConfig, Live2DManifest, Live2DExpressionManifest, Live2DLayer } from './types';

export const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;
export type Vowel = (typeof VOWELS)[number];

const clamp = (x: number, fallback = 0) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback);

export class Live2DExpressionController {
  public mix: number[] = [1, 0, 0, 0, 0];
  public target: number[] = [1, 0, 0, 0, 0];
  public open: number = 0;
  public targetOpen: number = 0;
  public silence: number = 1;
  public blush: number = 0;
  public targetBlush: number = 0;

  public setVisemes(weights: Partial<Record<Vowel, number>> = {}, openness?: number): void {
    const values = VOWELS.map((v) => clamp(weights[v] ?? 0));
    const sum = values.reduce((a, b) => a + b, 0);
    this.targetOpen = clamp(openness ?? Math.min(1, sum));
    if (sum > 0) this.target = values.map((v) => v / sum);
    if (this.targetOpen > 0) this.silence = 0;
  }

  public setPhoneme(phoneme: string, openness = 1): void {
    const isVowel = (VOWELS as readonly string[]).includes(phoneme);
    this.setVisemes(
      isVowel ? ({ [phoneme]: 1 } as Partial<Record<Vowel, number>>) : {},
      isVowel ? openness : 0
    );
  }

  public setBlush(value: number): void {
    this.targetBlush = clamp(value);
  }

  public stopSpeaking(): void {
    this.targetOpen = 0;
    this.silence = 1;
  }

  public update(dt: number) {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    if (this.targetOpen === 0) this.silence += safeDt;
    const target = this.targetOpen === 0 && this.silence < 0.1 ? this.open : this.targetOpen;
    const articulation = 1 - Math.exp(-safeDt / 0.065);
    this.mix = this.mix.map((v, i) => v + (this.target[i] - v) * articulation);
    this.open += (target - this.open) * (1 - Math.exp(-safeDt / (target > this.open ? 0.045 : 0.11)));
    this.blush += (this.targetBlush - this.blush) * (1 - Math.exp(-safeDt / 0.24));
    return this.state;
  }

  public get state() {
    const ambiguity = Math.min(1, (1 - Math.max(...this.mix)) * 2);
    const openness = this.open * (1 - 0.5 * ambiguity);
    const half = openness <= 0.5 ? 2 * openness : 2 * (1 - openness);
    const full = Math.max(0, 2 * openness - 1);
    const weights: Record<string, number> = {};
    VOWELS.forEach((v, i) => {
      weights[`mouth_${v}_half`] = half * this.mix[i];
      weights[`mouth_${v}`] = full * this.mix[i];
    });
    return {
      weights,
      rest: Math.max(0, 1 - 2 * openness),
      openness,
      inputOpenness: this.open,
      blush: this.blush,
    };
  }
}

export function blinkWeights(closure: number) {
  const x = clamp(closure);
  return {
    open: Math.max(0, 1 - 2 * x),
    half: 1 - Math.abs(2 * x - 1),
    closed: Math.max(0, 2 * x - 1),
  };
}

export class Live2DOverlay {
  public canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private container: HTMLElement;
  private config: Live2DConfig;

  public isReady: boolean = false;
  public isVisible: boolean = false;

  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private vertexBuffer: WebGLBuffer | null = null;
  private vertexCount: number = 0;

  private manifest: Live2DManifest | null = null;
  private expressionManifest: Live2DExpressionManifest | null = null;
  private layers: Live2DLayer[] = [];
  private halfEye: Live2DLayer | null = null;
  private openEye: Live2DLayer | null = null;
  private mouthAtlas: { x: number; y: number; width: number; height: number; texture?: WebGLTexture } | null = null;

  public expressions = new Live2DExpressionController();

  private clock: number = 0;
  private forcedBlinkTime: number = -10;
  private spring = {
    l: { x: 0, v: 0 },
    r: { x: 0, v: 0 },
    ribbon: { x: 0, v: 0 },
  };

  constructor(options: { container?: HTMLElement; config: Live2DConfig }) {
    this.container = options.container ?? document.getElementById('viewport-container') ?? document.body;
    this.config = options.config;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'live2d-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    this.canvas.style.objectPosition = 'center bottom';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '15';
    this.canvas.style.display = 'none';

    this.container.appendChild(this.canvas);
  }

  public async init(): Promise<void> {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.warn('[Live2DOverlay] WebGL is not available for Live2DOverlay');
      return;
    }
    this.gl = gl;

    const basePath = this.config.basePath.endsWith('/') ? this.config.basePath : `${this.config.basePath}/`;
    const manifestUrl = resolveAssetUrl(this.config.manifestUrl || `${basePath}manifest.json`);
    const exprManifestUrl = resolveAssetUrl(
      this.config.expressionManifestUrl || `${basePath}expressions/manifest.json`
    );

    try {
      const [manifestRes, exprRes] = await Promise.all([
        fetch(manifestUrl).then((r) => r.json() as Promise<Live2DManifest>),
        fetch(exprManifestUrl).then((r) => r.json() as Promise<Live2DExpressionManifest>),
      ]);

      this.manifest = manifestRes;
      this.expressionManifest = exprRes;
      this.canvas.width = manifestRes.width;
      this.canvas.height = manifestRes.height;

      this.initShaders(manifestRes.width, manifestRes.height);
      this.initGeometry(manifestRes.width, manifestRes.height);

      // Load layer textures
      const loadTex = (path: string) => this.loadTexture(resolveAssetUrl(path.startsWith('/') ? path : `${basePath}${path}`));

      this.layers = await Promise.all(
        manifestRes.layers.map(async (l) => ({
          ...l,
          texture: await loadTex(l.file),
        }))
      );

      const hEye = exprRes.entries.find((e) => e.name === 'eye_half');
      if (hEye) {
        this.halfEye = {
          ...hEye,
          texture: await loadTex(hEye.file),
        };
      }

      const oEye = exprRes.entries.find((e) => e.name === 'eye_open');
      if (oEye) {
        this.openEye = {
          ...oEye,
          texture: await loadTex(oEye.file),
        };
      }

      this.mouthAtlas = {
        ...exprRes.mouthRegion,
        texture: await loadTex('expressions/mouth-atlas.png'),
      };

      this.isReady = true;
    } catch (err) {
      console.error('[Live2DOverlay] Failed to load Live2D assets:', err);
    }
  }

  private initShaders(W: number, H: number): void {
    const gl = this.gl!;
    const vsSource = `
      attribute vec2 p;
      uniform float angle, breathing, hairL, hairR, ribbon;
      uniform vec4 crop;
      uniform vec2 characterTransform;
      varying vec2 uv;
      varying vec2 sourcePoint;

      float bell(vec2 p, vec2 c, vec2 s) {
        vec2 q = (p - c) / s;
        return exp(-dot(q, q) * 2.0);
      }

      void main() {
        vec2 q = p;
        float hw = 1.0 - smoothstep(600.0, 1050.0, p.y);
        vec2 pivot = vec2(725.0, 516.0);
        vec2 d = p - pivot;
        float a = angle * hw;
        q = pivot + mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
        q.y -= breathing * 3.0 * (1.0 - smoothstep(620.0, 1190.0, p.y));
        q.x += hairL * bell(p, vec2(335.0, 545.0), vec2(100.0, 140.0));
        q.x += hairR * bell(p, vec2(827.0, 452.0), vec2(52.0, 115.0));
        q.x += ribbon * bell(p, vec2(570.0, 930.0), vec2(53.0, 125.0));
        uv = (p - crop.xy) / crop.zw;
        sourcePoint = p;
        float scale = characterTransform.x;
        float offY = characterTransform.y;
        gl_Position = vec4(
          (q.x / ${W}.0 * 2.0 - 1.0) * scale * 0.95,
          (1.0 - q.y / ${H}.0 * 2.0) * scale + offY,
          0,
          1
        );
      }
    `;

    const fsSource = `
      precision highp float;
      uniform sampler2D tex;
      uniform float opacity, iris, blush, wet, mouthMode, eyeStage, eyeClosure;
      uniform float mouthWeights[10];
      uniform vec2 gaze;
      uniform vec4 crop;
      varying vec2 uv;
      varying vec2 sourcePoint;

      float spot(vec2 center, vec2 size) {
        vec2 d = (sourcePoint - center) / size;
        return exp(-dot(d, d) * 2.0);
      }

      void main() {
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
        vec4 c = texture2D(tex, uv);

        if (eyeStage >= 0.0) {
          vec2 center = sourcePoint.x < 560.0 ? vec2(464.0, 443.0) : vec2(665.0, 379.0);
          float localY = sourcePoint.y - center.y + (sourcePoint.x - center.x) * 0.30;
          float targetLid = mix(-19.0, 8.0, eyeClosure);
          float sourceLid = mix(-19.0, 8.0, eyeStage);
          float mappedY = localY < targetLid
            ? mix(-45.0, sourceLid, clamp((localY + 45.0) / (targetLid + 45.0), 0.0, 1.0))
            : mix(sourceLid, 28.0, clamp((localY - targetLid) / (28.0 - targetLid), 0.0, 1.0));
          if (localY <= -45.0 || localY >= 28.0 || abs(eyeClosure - eyeStage) < 0.00001) mappedY = localY;
          float eyeInfluence = 1.0 - smoothstep(39.0, 54.0, abs(sourcePoint.x - center.x));
          vec2 coord = uv + vec2(0.0, (mappedY - localY) * eyeInfluence / crop.w);
          float pupil = spot(center, vec2(24.0, 23.0));
          coord -= gaze / crop.zw * pupil * (1.0 - eyeClosure);
          vec4 sampleEye = texture2D(tex, coord);
          if (sampleEye.a > 0.1) c.rgb = sampleEye.rgb * c.a / sampleEye.a;
        }

        if (mouthMode > 0.5) {
          c = vec4(0.0);
          for (int i = 0; i < 10; i++) {
            float f = float(i);
            vec2 tile = vec2(mod(f, 5.0), floor(f / 5.0));
            c += texture2D(tex, (tile + uv) / vec2(5.0, 2.0)) * mouthWeights[i];
          }
        }

        if (iris > 0.5) {
          vec4 shifted = texture2D(tex, uv - gaze / crop.zw);
          c.rgb = mix(vec3(0.96, 0.94, 0.95) * c.a, shifted.rgb * c.a / max(shifted.a, 0.001), min(1.0, shifted.a / max(c.a, 0.001)));
        }

        float cheeks = spot(vec2(473.0, 493.0), vec2(55.0, 29.0)) + spot(vec2(690.0, 439.0), vec2(38.0, 26.0));
        c.rgb = mix(c.rgb, vec3(0.97, 0.40, 0.49) * c.a, min(0.30, cheeks * blush * 0.30));

        float highlights = spot(vec2(476.0, 430.0) + gaze, vec2(5.0, 6.0)) + spot(vec2(666.0, 367.0) + gaze, vec2(5.0, 6.0));
        float rim = spot(vec2(478.0, 458.0) + gaze, vec2(14.0, 3.0)) + spot(vec2(665.0, 397.0) + gaze, vec2(13.0, 3.0));
        float purple = smoothstep(0.025, 0.10, (c.b - c.g) / max(c.a, 0.001));
        c.rgb = mix(c.rgb, vec3(1.0, 0.95, 1.0) * c.a, min(0.65, wet * (highlights * 0.65 + rim * 0.32) * purple));

        gl_FragColor = vec4(c.rgb * opacity, c.a * opacity);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) || 'Shader compilation failed');
      }
      return s;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }
    this.program = program;
    gl.useProgram(program);

    const uniformNames = [
      'angle', 'breathing', 'hairL', 'hairR', 'ribbon', 'crop', 'gaze',
      'iris', 'opacity', 'blush', 'wet', 'mouthMode', 'mouthWeights',
      'eyeStage', 'eyeClosure', 'characterTransform'
    ];
    for (const n of uniformNames) {
      this.uniforms[n] = gl.getUniformLocation(program, n === 'mouthWeights' ? 'mouthWeights[0]' : n);
    }
  }

  private initGeometry(W: number, H: number): void {
    const gl = this.gl!;
    const vertices: number[] = [];
    const nx = 60;
    const ny = 80;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const l = (x * W) / nx;
        const r = ((x + 1) * W) / nx;
        const t = (y * H) / ny;
        const b = ((y + 1) * H) / ny;
        vertices.push(l, t, r, t, l, b, l, b, r, t, r, b);
      }
    }
    this.vertexCount = vertices.length / 2;

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(this.program!, 'p');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.vertexBuffer = buffer;
  }

  private async loadTexture(src: string): Promise<WebGLTexture> {
    const gl = this.gl!;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.src = src;
    await im.decode();
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    return t;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.canvas.style.display = visible ? 'block' : 'none';
  }

  private stepSpring(s: { x: number; v: number }, target: number, dt: number): number {
    s.v += (target - s.x) * 18 * dt;
    s.v *= Math.exp(-6 * dt);
    s.x += s.v * dt;
    return s.x;
  }

  private blinkAt(t: number): number {
    const cycle = t % 4.9;
    const p = (cycle - 3.5) / 0.24;
    return p >= 0 && p <= 1 ? Math.sin(p * Math.PI) ** 1.1 : 0;
  }

  public render(dt = 1 / 60): void {
    if (!this.isReady || !this.isVisible || !this.gl || !this.manifest) return;

    this.clock += dt;
    const t = this.clock;
    const gl = this.gl;
    const W = this.manifest.width;
    const H = this.manifest.height;

    const expression = this.expressions.update(dt);
    const angle = (0.8 * Math.PI) / 180 * Math.sin(t * 0.49);
    const breathing = Math.sin(t * 1.35);
    const blink = Math.max(
      this.blinkAt(t),
      t - this.forcedBlinkTime >= 0 && t - this.forcedBlinkTime < 0.45
        ? Math.sin(((t - this.forcedBlinkTime) / 0.45) * Math.PI)
        : 0
    );

    const hl = this.stepSpring(this.spring.l, Math.sin(t * 1.4) * 1.25, dt);
    const hr = this.stepSpring(this.spring.r, Math.sin(t * 1.23 + 1) * 0.8, dt);
    const rb = this.stepSpring(this.spring.ribbon, Math.sin(t * 1.1) * 0.7, dt);
    const gx = Math.sin(t * 0.7) * 0.7;
    const gy = Math.sin(t * 0.43) * 0.35;

    const eyeWeights = blinkWeights(blink);
    const blushValue = expression.blush;

    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.angle!, angle);
    gl.uniform1f(this.uniforms.breathing!, breathing);
    gl.uniform1f(this.uniforms.hairL!, hl);
    gl.uniform1f(this.uniforms.hairR!, hr);
    gl.uniform1f(this.uniforms.ribbon!, rb);
    gl.uniform2f(this.uniforms.gaze!, gx, gy);
    gl.uniform2f(
      this.uniforms.characterTransform!,
      this.config.characterScale ?? 1.04,
      this.config.characterOffsetY ?? -0.09
    );

    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);

    const ls = [...this.layers];
    if (this.halfEye) ls.push(this.halfEye);
    if (this.openEye) ls.push(this.openEye);

    gl.uniform1f(this.uniforms.mouthMode!, 0);

    for (const l of ls) {
      if (['underpaint', 'eyewhite', 'irides', 'eyelash'].includes(l.name)) continue;

      let opacity = 1;
      if (l.name === 'eye_close') opacity = eyeWeights.closed;
      else if (l.name === 'eye_half') opacity = eyeWeights.half;
      else if (l.name === 'eye_open') opacity = eyeWeights.open;

      gl.uniform1f(
        this.uniforms.eyeStage!,
        l.name === 'eye_open' ? 0 : l.name === 'eye_half' ? 0.5 : l.name === 'eye_close' ? 1 : -1
      );
      gl.uniform1f(this.uniforms.eyeClosure!, blink);
      gl.uniform1f(this.uniforms.blush!, l.name === 'face' ? blushValue : 0);
      gl.uniform1f(this.uniforms.wet!, ['irides', 'eye_half', 'eye_open'].includes(l.name) ? blushValue : 0);
      gl.uniform1f(this.uniforms.opacity!, opacity);
      gl.uniform1f(this.uniforms.iris!, l.name === 'irides' ? 1 : 0);
      gl.uniform4f(this.uniforms.crop!, l.x, l.y, l.width, l.height);
      gl.bindTexture(gl.TEXTURE_2D, l.texture ?? null);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }

    if (this.mouthAtlas?.texture) {
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(this.uniforms.mouthMode!, 1);
      gl.uniform1f(this.uniforms.eyeStage!, -1);
      gl.uniform1f(this.uniforms.opacity!, 1);
      gl.uniform1f(this.uniforms.iris!, 0);
      gl.uniform1f(this.uniforms.blush!, 0);
      gl.uniform1f(this.uniforms.wet!, 0);

      const weights = expression.weights;
      const mouthArray = [
        ...VOWELS.map((v) => weights[`mouth_${v}`] ?? 0),
        ...VOWELS.map((v) => weights[`mouth_${v}_half`] ?? 0),
      ];
      gl.uniform1fv(this.uniforms.mouthWeights!, new Float32Array(mouthArray));
      gl.uniform4f(
        this.uniforms.crop!,
        this.mouthAtlas.x,
        this.mouthAtlas.y,
        this.mouthAtlas.width,
        this.mouthAtlas.height
      );
      gl.bindTexture(gl.TEXTURE_2D, this.mouthAtlas.texture);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
  }

  public dispose(): void {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.remove();
    }
    this.gl = null;
  }
}
