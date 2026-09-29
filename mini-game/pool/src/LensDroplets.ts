import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * カメラのレンズに付いた水滴（ポストプロセス）。
 * 水滴は小さな球レンズとして像を上下左右反転・広角に映し、縁が暗く、光の反射点が入る。
 * 大きな水滴は筋を引いて流れ落ち、濡れが引くと小さいものから消える。
 */
const LensDropletsShader = {
  name: 'LensDropletsShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uWet: { value: 0 },
    uAspect: { value: 16 / 9 },
    uResolution: { value: new THREE.Vector2(1280, 720) },
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
    uniform float uTime;
    uniform float uWet;
    uniform float uAspect;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float h11(float p) { return fract(sin(p * 127.1 + 311.7) * 43758.5453); }
    float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec2 h22(vec2 p) {
      return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }

    // 水滴 1 つ分の見え方
    struct Drop {
      vec2 off;   // 屈折で像をずらす量 (uv)
      float mask; // 水滴の内側
      float spec; // 光の反射点
      float rim;  // 縁の暗さ
      float bot;  // 下側の内壁に集まる明るい光
    };

    Drop emptyDrop() { return Drop(vec2(0.0), 0.0, 0.0, 0.0, 0.0); }

    // 球レンズ: q は水滴の中心からの位置 (uv の y 単位)、rad は半径
    Drop lens(vec2 q, float rad, float mag) {
      Drop d = emptyDrop();
      vec2 qs = vec2(q.x, q.y / 0.88); // 少し縦長
      float dd = length(qs) / rad;
      d.mask = 1.0 - smoothstep(0.90, 1.0, dd);
      if (d.mask <= 0.0) return d;
      vec2 n = qs / rad;
      d.off = -vec2(q.x / uAspect, q.y) * (1.0 + mag);
      d.spec = 1.0 - smoothstep(0.0, 0.30, length(n - vec2(-0.40, 0.42)));
      d.rim = smoothstep(0.58, 1.0, dd);
      d.bot = smoothstep(0.50, 0.92, dd) * smoothstep(-0.05, -0.85, n.y);
      return d;
    }

    void accumulate(inout Drop acc, Drop d) {
      acc.off += d.off * d.mask;
      acc.spec = max(acc.spec, d.spec * d.mask);
      acc.rim = max(acc.rim, d.rim * d.mask);
      acc.bot = max(acc.bot, d.bot * d.mask);
      acc.mask = max(acc.mask, d.mask);
    }

    // 位置が固定の水滴（格子の各マスに 1 つ）
    Drop staticDrops(vec2 uv, float scale, float seed, float wet, float minR, float maxR, float onset, float density) {
      vec2 p = vec2(uv.x * uAspect, uv.y) * scale;
      vec2 id = floor(p);
      vec2 f = fract(p) - 0.5;
      float thr = onset + (1.0 - onset) * h12(id * 1.37 + seed * 3.1);
      float present = smoothstep(thr, thr + 0.14, wet) * step(h12(id * 2.17 + seed * 5.3), density);
      if (present <= 0.0) return emptyDrop();
      float rad = mix(minR, maxR, h12(id + seed * 7.7)) * present;
      vec2 c = (h22(id + seed) - 0.5) * (1.0 - 2.0 * rad);
      vec2 q = (f - c) / scale; // uv の y 単位へ
      return lens(q, rad / scale, 1.7);
    }

    // 筋を引いて流れ落ちる水滴（列ごとに 1 つ）
    Drop slideDrops(vec2 uv, float cols, float seed, float wet, float t, float minR, float maxR, float onset) {
      Drop acc = emptyDrop();
      float colW = uAspect / cols;
      float colIdx = floor(uv.x * cols);
      float fx = (fract(uv.x * cols) - 0.5) * colW;

      for (int k = -1; k <= 1; k++) {
        float col = colIdx + float(k);
        float rnd = h11(col + seed);
        float thr = onset + (1.0 - onset) * rnd;
        float present = smoothstep(thr, thr + 0.12, wet);
        if (present <= 0.0) continue;

        float rd = mix(minR, maxR, h11(col * 3.3 + seed)) * present;
        float cx = (h11(col * 7.1 + seed) - 0.5) * 0.45 * colW + float(k) * colW;
        float period = mix(9.0, 20.0, h11(col * 5.5 + seed));
        // 流れる速さは濡れが少ないほどゆっくり
        float s = fract(t / period * (0.4 + 0.6 * wet) + h11(col * 9.9 + seed));
        float y = 1.08 - 1.25 * pow(s, 1.5);
        float wob = sin(y * 26.0 + col * 2.0) * rd * 0.10;

        vec2 dv = vec2(fx - cx + wob, uv.y - y);
        accumulate(acc, lens(dv, rd, 1.7));

        // 水滴の上に伸びる筋
        float trailLen = 0.10 + 0.32 * (1.0 - s);
        float ty = (uv.y - y) / trailLen;
        if (ty > 0.0 && ty < 1.0) {
          float w = rd * 0.34 * (1.0 - ty * 0.7);
          float tm = (1.0 - smoothstep(w * 0.5, w, abs(dv.x))) * (1.0 - ty) * 0.85;
          Drop tr = emptyDrop();
          tr.mask = tm;
          tr.off = vec2(dv.x / max(w, 1e-4) * 0.0045 / uAspect, 0.0) * tm;
          tr.rim = 0.55 * tm;
          acc.off += tr.off;
          acc.rim = max(acc.rim, tr.rim);
          acc.spec = max(acc.spec, 0.10 * tm);
          acc.mask = max(acc.mask, tm * 0.55);
        }
      }
      return acc;
    }

    void main() {
      vec2 uv = vUv;
      float wet = clamp(uWet, 0.0, 1.0);
      if (wet <= 0.001) {
        gl_FragColor = texture2D(tDiffuse, uv);
        return;
      }

      Drop d = emptyDrop();
      accumulate(d, staticDrops(uv, 6.0, 1.0, wet, 0.13, 0.27, 0.0, 0.50));
      accumulate(d, staticDrops(uv, 14.0, 5.0, wet, 0.14, 0.30, 0.20, 0.70));
      accumulate(d, staticDrops(uv, 34.0, 9.0, wet, 0.12, 0.30, 0.45, 0.90));
      Drop s1 = slideDrops(uv, 9.0, 3.0, wet, uTime, 0.020, 0.036, 0.05);
      Drop s2 = slideDrops(uv, 17.0, 11.0, wet, uTime * 0.8 + 7.0, 0.011, 0.020, 0.30);
      accumulate(d, s1);
      accumulate(d, s2);

      // 濡れたレンズのわずかなにじみ（水滴の外側だけ）
      vec2 px = 1.0 / uResolution;
      float blurR = wet * 2.6;
      vec3 sharp = texture2D(tDiffuse, uv).rgb;
      vec3 blur = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 2.399963;
        float r = sqrt((float(i) + 0.5) / 8.0) * blurR;
        blur += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * px).rgb;
      }
      blur /= 8.0;
      vec3 col = mix(sharp, blur, 0.55 * wet * (1.0 - d.mask));

      // 水滴の内側: 屈折した像
      vec3 refracted = texture2D(tDiffuse, uv + d.off).rgb;
      refracted *= vec3(0.97, 1.0, 1.03);
      refracted *= 1.0 - 0.38 * d.rim;
      refracted += vec3(1.0) * (d.bot * 0.18 + d.spec * 0.85);
      col = mix(col, refracted, clamp(d.mask * 1.4, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/** 水滴の濡れ具合（0..1）を管理する */
export class LensDroplets {
  public readonly pass: ShaderPass;

  private wet = 0;
  private target = 0;
  private rampUp = 1.7; // 付く速さ (1/s)
  private dry = 0.03;   // 自然に乾く速さ (1/s)
  private wipe = false;
  private time = 0;

  constructor(width: number, height: number) {
    this.pass = new ShaderPass(LensDropletsShader);
    this.setSize(width, height);
  }

  public setSize(width: number, height: number) {
    this.pass.uniforms.uResolution.value.set(width, height);
    this.pass.uniforms.uAspect.value = width / height;
  }

  /** 水しぶきを浴びた（一気に水滴が付く）*/
  public splash(amount = 1) {
    this.wipe = false;
    this.target = Math.max(this.target, amount);
  }

  /** レンズを拭き取る */
  public clear() {
    this.wipe = true;
    this.target = 0;
  }

  public get wetness() {
    return this.wet;
  }

  /** 濡れ具合を直接指定する（確認用）*/
  public setWetness(value: number) {
    this.wet = value;
    this.target = value;
    this.wipe = false;
  }

  public update(delta: number) {
    this.time += delta;
    if (this.wet < this.target) {
      this.wet = Math.min(this.target, this.wet + this.rampUp * delta);
    } else if (this.wipe || this.wet <= 0) {
      this.wet = Math.max(0, this.wet - 1.6 * delta);
    } else {
      // ゆっくり乾いて水滴が減っていく（少し残る）
      this.wet = Math.max(0.12, this.wet - this.dry * delta);
      this.target = Math.min(this.target, this.wet);
    }
    this.pass.enabled = this.wet > 0.001;
    this.pass.uniforms.uWet.value = this.wet;
    this.pass.uniforms.uTime.value = this.time;
  }
}
