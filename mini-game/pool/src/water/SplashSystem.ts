import * as THREE from 'three';

const MAX_PARTICLES = 7000;
const GRAVITY = 9.8;

export type ParticleKind = 0 | 1 | 2; // 0: 水滴, 1: ミスト（霧状の水煙）, 2: 気泡

export interface LandingEvent {
  x: number;
  z: number;
  size: number;
  speed: number;
}

/**
 * 水しぶきの粒子。
 * 速度の向きに伸びる水滴（モーションブラー）、水煙、水中の気泡を 1 回の描画でまとめて描く。
 * 水滴が水面に戻ったときは onLanding で通知するので、呼び出し側が小さな波紋を起こせる。
 */
export class SplashSystem {
  public readonly mesh: THREE.Mesh;
  public onLanding: ((e: LandingEvent) => void) | null = null;
  /** 島の上面（この半径・高さより内側に落ちた水滴は消す） */
  public islandRadius = 1.55;
  public islandTopY = 0.1;

  private geometry: THREE.InstancedBufferGeometry;
  private material: THREE.ShaderMaterial;
  private aPos: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private aMisc: THREE.InstancedBufferAttribute;

  private pos = new Float32Array(MAX_PARTICLES * 3);
  private vel = new Float32Array(MAX_PARTICLES * 3);
  private misc = new Float32Array(MAX_PARTICLES * 4); // size, age(0..1), kind, seed
  private life = new Float32Array(MAX_PARTICLES);
  private maxLife = new Float32Array(MAX_PARTICLES);
  private drag = new Float32Array(MAX_PARTICLES);
  private count = 0;

  constructor() {
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry = quad;

    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aMisc = new THREE.InstancedBufferAttribute(this.misc, 4).setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('iPos', this.aPos);
    quad.setAttribute('iVel', this.aVel);
    quad.setAttribute('iMisc', this.aMisc);
    quad.instanceCount = 0;

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uPxSize: { value: 0.001 }, // 距離 1m で 1px が何 m か
        uViewport: { value: new THREE.Vector2(1280, 720) },
        uStretch: { value: 0.017 }, // モーションブラーの長さ (s)
        uSunDir: { value: new THREE.Vector3(0.4, 0.75, -0.5).normalize() },
      },
      vertexShader: /* glsl */ `
        uniform float uPxSize;
        uniform vec2 uViewport;
        uniform float uStretch;
        attribute vec3 iPos;
        attribute vec3 iVel;
        attribute vec4 iMisc;
        varying vec2 vLocal;   // px 単位の (進行方向, 直交方向)
        varying float vHalfLen; // 尾の半分の長さ (px)
        varying float vSizePx;
        varying vec4 vMisc;

        void main() {
          float size = iMisc.x;
          float kind = iMisc.z;
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float dist = max(-mv.z, 0.05);
          float sizePx = max(size / (uPxSize * dist), 1.3);

          vec3 vv = mat3(modelViewMatrix) * iVel;
          vec4 headClip = projectionMatrix * mv;
          vec4 tailClip = projectionMatrix * vec4(mv.xyz - vv * uStretch * (kind < 0.5 ? 1.0 : 0.0), 1.0);
          vec2 headN = headClip.xy / headClip.w;
          vec2 tailN = tailClip.xy / tailClip.w;
          vec2 sv = (headN - tailN) * uViewport * 0.5;
          float len = length(sv);
          len = min(len, 60.0);
          vec2 axis = len > 1e-3 ? sv / max(length(sv), 1e-4) : vec2(1.0, 0.0);
          vec2 perp = vec2(-axis.y, axis.x);

          float halfAlong = len * 0.5 + sizePx;
          float s = position.x * halfAlong;
          float t = position.y * sizePx;
          vec2 centerN = headN - axis * len * 0.5 / (uViewport * 0.5);
          vec2 offN = (axis * s + perp * t) / (uViewport * 0.5);

          vLocal = vec2(s, t);
          vHalfLen = len * 0.5;
          vSizePx = sizePx;
          vMisc = vec4(size / (sizePx * uPxSize * dist), iMisc.y, iMisc.z, iMisc.w);
          gl_Position = vec4((centerN + offN) * headClip.w, headClip.z, headClip.w);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        varying vec2 vLocal;
        varying float vHalfLen;
        varying float vSizePx;
        varying vec4 vMisc; // x: 実サイズ/描画サイズ, y: 年齢, z: 種類, w: 乱数

        void main() {
          float kind = vMisc.z;
          float age = vMisc.y;
          float dx = max(abs(vLocal.x) - vHalfLen, 0.0);
          vec2 q = vec2(dx * sign(vLocal.x), vLocal.y) / vSizePx;
          float d = length(q);
          if (d > 1.0) discard;

          vec3 n = vec3(q, sqrt(max(1.0 - d * d, 0.0)));
          vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
          float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
          float rim = pow(d, 2.6);

          vec3 col;
          float a;
          if (kind < 0.5) {
            // 水滴: 透明な球。縁が少し暗く、光の当たる側に点の反射
            float streak = clamp(2.0 * vSizePx / (2.0 * vSizePx + vHalfLen * 2.0), 0.30, 1.0);
            col = mix(vec3(0.90, 0.97, 1.0), vec3(1.0), 0.25 + spec);
            a = (0.42 + 0.35 * rim + 1.0 * spec) * streak;
            a *= clamp(vMisc.x, 0.30, 1.0);
            a *= 1.0 - smoothstep(0.85, 1.0, age);
          } else if (kind < 1.5) {
            // 水煙: ふわっとした白い霧
            float soft = pow(1.0 - d, 1.6);
            col = vec3(0.93, 0.975, 1.0);
            a = soft * 0.20 * min(age * 10.0, 1.0) * pow(1.0 - age, 1.4);
          } else {
            // 気泡: 縁が明るい輪＋点の反射
            col = mix(vec3(0.85, 0.97, 1.0), vec3(1.0), spec);
            a = (0.10 + 0.62 * rim + 1.0 * spec) * 0.85;
            a *= 1.0 - smoothstep(0.8, 1.0, age);
          }
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        }
      `,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  public setViewport(camera: THREE.PerspectiveCamera, pixelWidth: number, pixelHeight: number) {
    const u = this.material.uniforms;
    u.uPxSize.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / pixelHeight;
    (u.uViewport.value as THREE.Vector2).set(pixelWidth, pixelHeight);
  }

  public spawn(
    kind: ParticleKind,
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    size: number, life: number, drag = 0.35
  ) {
    if (this.count >= MAX_PARTICLES) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.misc[i * 4] = size; this.misc[i * 4 + 1] = 0; this.misc[i * 4 + 2] = kind; this.misc[i * 4 + 3] = Math.random();
    this.life[i] = 0;
    this.maxLife[i] = life;
    this.drag[i] = drag;
  }

  private remove(i: number) {
    const last = --this.count;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.misc.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.drag[i] = this.drag[last];
  }

  public update(delta: number) {
    let landings = 0;
    const p = this.pos, v = this.vel, m = this.misc;
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] += delta;
      const age = this.life[i] / this.maxLife[i];
      m[i * 4 + 1] = age;
      if (age >= 1) { this.remove(i); continue; }

      const kind = m[i * 4 + 2];
      const k = i * 3;
      if (kind < 0.5) {
        v[k + 1] -= GRAVITY * delta;
        const damp = Math.exp(-delta * this.drag[i]);
        v[k] *= damp; v[k + 2] *= damp;
        p[k] += v[k] * delta; p[k + 1] += v[k + 1] * delta; p[k + 2] += v[k + 2] * delta;

        if (p[k + 1] < 0 && v[k + 1] < 0) {
          const inIsland = Math.hypot(p[k], p[k + 2]) < this.islandRadius;
          if (!inIsland && this.onLanding && landings < 36 && m[i * 4] > 0.006) {
            landings++;
            this.onLanding({ x: p[k], z: p[k + 2], size: m[i * 4], speed: -v[k + 1] });
          }
          this.remove(i);
          continue;
        }
        if (p[k + 1] < this.islandTopY && Math.hypot(p[k], p[k + 2]) < this.islandRadius && v[k + 1] < 0) {
          this.remove(i);
        }
      } else if (kind < 1.5) {
        v[k + 1] += 0.35 * delta;
        const damp = Math.exp(-delta * this.drag[i]);
        v[k] *= damp; v[k + 1] *= damp; v[k + 2] *= damp;
        p[k] += v[k] * delta; p[k + 1] += v[k + 1] * delta; p[k + 2] += v[k + 2] * delta;
        m[i * 4] *= 1 + delta * 0.9; // 広がりながら薄れる
      } else {
        // 気泡は少しふらつきながら浮上し、水面で消える
        const wob = m[i * 4 + 3] * 6.28;
        v[k] = Math.sin(this.life[i] * 5 + wob) * 0.05;
        v[k + 2] = Math.cos(this.life[i] * 4.3 + wob) * 0.05;
        p[k] += v[k] * delta; p[k + 1] += v[k + 1] * delta; p[k + 2] += v[k + 2] * delta;
        if (p[k + 1] > -0.02) this.remove(i);
      }
    }

    this.geometry.instanceCount = this.count;
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, this.count * 3); this.aPos.needsUpdate = true;
    this.aVel.clearUpdateRanges(); this.aVel.addUpdateRange(0, this.count * 3); this.aVel.needsUpdate = true;
    this.aMisc.clearUpdateRanges(); this.aMisc.addUpdateRange(0, this.count * 4); this.aMisc.needsUpdate = true;
  }

  public get activeCount() {
    return this.count;
  }

  public clear() {
    this.count = 0;
    this.geometry.instanceCount = 0;
  }

  public setSunDirection(dir: THREE.Vector3) {
    this.material.uniforms.uSunDir.value.copy(dir).normalize();
  }
}

/**
 * 着水直後に立ち上がる、薄い水の膜（王冠状のスプラッシュ）。
 * ふちがぎざぎざに崩れながら広がって沈む。
 */
export class CrownSheet {
  public readonly mesh: THREE.Mesh;

  private material: THREE.ShaderMaterial;
  private t = 0;
  private duration = 0.6;
  private maxRadius = 0.9;
  private startRadius = 0.2;
  private maxHeight = 0.7;
  private active = false;

  constructor() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 14, true);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uRadius: { value: 0.2 },
        uHeight: { value: 0.01 },
        uLife: { value: 0 },
        uSeed: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uRadius;
        uniform float uHeight;
        uniform float uSeed;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vView;

        void main() {
          vUv = uv;
          float v = uv.y;
          float ang = atan(position.z, position.x);
          float wob = 1.0 + 0.10 * sin(ang * 7.0 + uSeed) + 0.06 * sin(ang * 13.0 + uSeed * 2.1);
          float r = uRadius * (1.0 + 0.55 * v * v + 0.18 * v) * wob;
          float h = uHeight * (0.82 + 0.18 * sin(ang * 5.0 + uSeed * 1.7));
          vec3 p = vec3(cos(ang) * r, v * h, sin(ang) * r);
          vec3 worldP = (modelMatrix * vec4(p, 1.0)).xyz;
          vN = normalize(vec3(cos(ang), 0.55, sin(ang)));
          vView = cameraPosition - worldP;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uLife;
        uniform float uSeed;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vView;

        float hash(float n) { return fract(sin(n) * 43758.5453); }
        float noise1(float x) {
          float i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(hash(i), hash(i + 1.0), f);
        }
        float noise2(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i.x + i.y * 57.0), b = hash(i.x + 1.0 + i.y * 57.0);
          float c = hash(i.x + (i.y + 1.0) * 57.0), d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          float v = vUv.y;
          float a = vUv.x * 96.0;
          // ふちのぎざぎざ（指のように伸びる水の筋）
          float fingers = noise1(a * 0.55 + uSeed) * 0.6 + noise1(a * 1.7 + uSeed * 3.0) * 0.4;
          float limit = (0.42 + 0.58 * fingers) * (1.0 - 0.55 * uLife) + 0.05;
          float edge = 1.0 - smoothstep(limit - 0.22, limit, v);
          // 水の筋（縦に伸びたムラ）
          float streak = noise2(vec2(a * 1.4 + uSeed, v * 2.6 - uLife * 1.5));
          float body = 0.45 + 0.65 * streak;

          vec3 V = normalize(vView);
          float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
          vec3 col = mix(vec3(0.80, 0.94, 1.0), vec3(1.0), 0.45 * fres + 0.6 * v);

          float fade = smoothstep(0.0, 0.06, uLife) * (1.0 - smoothstep(0.50, 1.0, uLife));
          float alpha = edge * body * fade * (0.62 + 0.30 * fres);
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  public start(x: number, z: number, strength: number) {
    this.mesh.position.set(x, 0, z);
    this.t = 0;
    this.duration = 0.55 + 0.25 * strength;
    this.startRadius = 0.16 + 0.05 * strength;
    this.maxRadius = 0.55 + 0.6 * strength;
    this.maxHeight = 0.32 + 0.55 * strength;
    this.material.uniforms.uSeed.value = Math.random() * 100;
    this.active = true;
    this.mesh.visible = true;
  }

  public update(delta: number) {
    if (!this.active) return;
    this.t += delta;
    const u = this.t / this.duration;
    if (u >= 1) {
      this.active = false;
      this.mesh.visible = false;
      return;
    }
    const rise = Math.sin(Math.pow(u, 0.6) * Math.PI);
    const grow = 1 - Math.pow(1 - u, 2);
    this.material.uniforms.uRadius.value = this.startRadius + (this.maxRadius - this.startRadius) * grow;
    this.material.uniforms.uHeight.value = Math.max(0.01, this.maxHeight * rise);
    this.material.uniforms.uLife.value = u;
  }

  public get isActive() {
    return this.active;
  }
}
