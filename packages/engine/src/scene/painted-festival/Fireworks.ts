import * as THREE from 'three';
import { FIREWORKS } from './layout';
import { festivalUniforms } from './lights';

/**
 * Fireworks over the river, all on the GPU: every shell has a slot; its
 * particles fly out from the burst with drag and gravity, each drawn as a
 * short trail of fading points. A rising spark leads up to each burst, and a
 * wide soft glow lights the smoke around it while it is bright.
 *
 * The CPU only schedules shells (random positions, kinds and colours, now and
 * then a quick salvo) and works out how bright each burst is, which drives
 * the light the fireworks cast: `uFlash` (the set's surfaces), the reflection
 * in the river, and a directional light on the avatars (`light`).
 *
 * Time comes from a clock on each render (onBeforeRender), so the stage needs
 * no per-frame hook.
 */
const SLOTS = 8;
const PARTICLES = 150;
const TRAIL = 7;
const RISE_POINTS = 18;
const RISE_TIME = 1.25;

/** Kinds: 0 chrysanthemum (sphere, long trails), 1 peony (sphere, short), 2 ring, 3 willow (gold, drooping), 4 colour change. */
type Shell = { kind: number; speed: number; life: number; gravity: number; colors: [THREE.Color, THREE.Color]; size: number };

const PALETTE = ['#ff4a5a', '#ffb347', '#ffe066', '#6dff8a', '#5ab8ff', '#c77dff', '#ff7ad9', '#ffffff'].map((c) => new THREE.Color(c));
const GOLD = new THREE.Color('#ffc46b');

const vertexShader = /* glsl */ `
  #define SLOTS ${SLOTS}
  uniform float uTime, uScale, uLaunchY, uRiseTime;
  uniform vec4 uSlotA[SLOTS]; // centre xyz, burst time
  uniform vec4 uSlotB[SLOTS]; // speed, life, kind, gravity
  uniform vec4 uSlotC[SLOTS]; // size
  uniform vec3 uColorA[SLOTS], uColorB[SLOTS];
  attribute vec3 aDir;
  attribute vec4 aInfo; // slot, trail index, seed, kind of point (0 star, 1 rise, 2 glow)
  varying vec3 vColor;
  varying float vSoft;

  void hide() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); }

  void main() {
    int slot = int(aInfo.x);
    vec4 a = uSlotA[slot], b = uSlotB[slot];
    float trail = aInfo.y, seed = aInfo.z, point = aInfo.w;
    float age = uTime - a.w;
    float life = b.y, kind = b.z;
    vec3 world;
    float size, bright;
    vSoft = 0.0;
    if (point > 1.5) {
      // Glow lighting the smoke around the burst.
      if (age < 0.0 || age > life) { hide(); return; }
      world = a.xyz;
      size = b.x * 2.6;
      bright = 0.16 * exp(-age * 1.6);
      vColor = uColorA[slot] * bright;
      vSoft = 1.0;
    } else if (point > 0.5) {
      // Rising spark with a short tail of embers.
      float t = age + uRiseTime - trail * 0.035;
      if (t < 0.0 || t > uRiseTime || age > 0.0) { hide(); return; }
      float k = t / uRiseTime;
      float rise = 1.0 - (1.0 - k) * (1.0 - k);
      world = vec3(a.x + sin(t * 9.0 + seed * 6.0) * 0.15, mix(uLaunchY, a.y, rise), a.z);
      size = mix(0.45, 0.2, trail / ${RISE_POINTS.toFixed(1)});
      bright = (1.0 - trail / ${RISE_POINTS.toFixed(1)}) * 1.4;
      vColor = vec3(1.0, 0.72, 0.4) * bright;
    } else {
      float t = age - trail * (kind > 2.5 && kind < 3.5 ? 0.07 : 0.04);
      if (t < 0.0 || t > life) { hide(); return; }
      vec3 dir = aDir;
      if (kind > 1.5 && kind < 2.5) dir = normalize(vec3(dir.x, dir.y * 0.08, dir.z) + vec3(0.0, 0.0, 0.0001));
      float drag = kind > 2.5 && kind < 3.5 ? 1.2 : 2.4;
      float speed = b.x * (0.85 + 0.15 * fract(seed * 7.13));
      world = a.xyz + dir * speed * (1.0 - exp(-drag * t)) / drag;
      world.y -= 0.5 * b.w * t * t;
      float fade = 1.0 - t / life;
      bright = pow(fade, 1.4) * (1.0 - trail / ${TRAIL.toFixed(1)});
      // Twinkle as the stars burn out.
      bright *= mix(1.0, step(0.5, fract(sin(seed * 91.7 + floor(uTime * 18.0)) * 43758.5)), smoothstep(0.55, 0.9, t / life));
      // A white flash at the very start.
      bright *= 1.0 + 2.5 * exp(-t * 14.0);
      vec3 color = kind > 3.5 ? mix(uColorA[slot], uColorB[slot], step(0.45, t / life)) : mix(uColorA[slot], uColorB[slot], step(0.5, seed));
      vColor = color * bright * 2.2;
      size = uSlotC[slot].x * (trail < 0.5 ? 1.0 : 0.7);
    }
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(size * 1.6 * uScale / -mv.z, 2.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vSoft;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    // A hot core with a soft halo (the stage may run without bloom at night).
    float core = mix(exp(-r2 * 14.0) + 0.22 * exp(-r2 * 2.5), (1.0 - r2) * (1.0 - r2), vSoft);
    gl_FragColor = vec4(vColor * core, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Fireworks {
  readonly object: THREE.Points;
  /** Directional light on the avatars, coloured and aimed by the bursts. */
  readonly light = new THREE.DirectionalLight('#ffffff', 0);
  /** Burst centres and brightness, for the river's reflection. */
  readonly uniforms = {
    uBursts: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
    uBurstColors: { value: Array.from({ length: SLOTS }, () => new THREE.Color()) },
  };
  private readonly material: THREE.ShaderMaterial;
  private readonly clock = new THREE.Clock();
  private readonly shells: (Shell & { burst: number; center: THREE.Vector3 })[] = [];
  private nextLaunch = 0.2;
  private salvo = 0;
  private seed = 12345;
  private readonly size = new THREE.Vector2();

  constructor() {
    const count = SLOTS * (PARTICLES * TRAIL + RISE_POINTS + 1);
    const dirs = new Float32Array(count * 3);
    const info = new Float32Array(count * 4);
    let n = 0;
    for (let slot = 0; slot < SLOTS; slot++) {
      for (let p = 0; p < PARTICLES; p++) {
        // Even directions on the sphere (golden spiral) with a little jitter.
        const y = 1 - 2 * (p + 0.5) / PARTICLES;
        const r = Math.sqrt(1 - y * y), phi = p * 2.39996 + slot;
        const dir = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).addScalar((this.random() - 0.5) * 0.06).normalize();
        const seed = this.random();
        for (let t = 0; t < TRAIL; t++, n++) {
          dir.toArray(dirs, n * 3);
          info.set([slot, t, seed, 0], n * 4);
        }
      }
      const seed = this.random();
      for (let t = 0; t < RISE_POINTS; t++, n++) info.set([slot, t, seed, 1], n * 4);
      info.set([slot, 0, 0, 2], n++ * 4);
    }
    const geometry = new THREE.BufferGeometry();
    // Positions are computed in the shader; this only sizes the draw.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    geometry.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 500 },
        uLaunchY: { value: FIREWORKS.launchY },
        uRiseTime: { value: RISE_TIME },
        uSlotA: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, 0, 0, -100)) },
        uSlotB: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(1, 1, 0, 0)) },
        uSlotC: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0.5, 0, 0, 0)) },
        uColorA: { value: Array.from({ length: SLOTS }, () => new THREE.Color()) },
        uColorB: { value: Array.from({ length: SLOTS }, () => new THREE.Color()) },
      },
      vertexShader,
      fragmentShader,
    });
    this.material.name = 'Fireworks';
    this.object = new THREE.Points(geometry, this.material);
    this.object.name = 'Fireworks';
    this.object.frustumCulled = false;
    // After the sky dome, before nothing else matters (additive).
    this.object.renderOrder = -5;
    this.object.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(this.size);
      this.material.uniforms.uScale.value = this.size.y * (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] / 2;
      this.update(this.clock.getElapsedTime());
    };
    this.light.name = 'Fireworks light';
    this.light.target.position.set(0, 1, 0);
    for (let i = 0; i < SLOTS; i++) this.shells.push({ kind: 0, speed: 1, life: 1, gravity: 0, colors: [new THREE.Color(), new THREE.Color()], size: 0.5, burst: -100, center: new THREE.Vector3() });
  }

  private random(): number {
    // Deterministic, so screenshots of the same moment look alike.
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  private launch(now: number): void {
    const free = this.shells.findIndex((shell) => now > shell.burst + shell.life + 0.2);
    if (free < 0) return;
    const shell = this.shells[free];
    const rnd = () => this.random();
    shell.kind = Math.floor(rnd() * 5);
    shell.center.set(
      THREE.MathUtils.lerp(FIREWORKS.minX, FIREWORKS.maxX, rnd()),
      THREE.MathUtils.lerp(FIREWORKS.height[0], FIREWORKS.height[1], rnd()),
      THREE.MathUtils.lerp(FIREWORKS.z[0], FIREWORKS.z[1], rnd()),
    );
    const big = 0.7 + rnd() * 0.5;
    shell.speed = (shell.kind === 3 ? 19 : 25) * big;
    shell.life = shell.kind === 3 ? 3.4 : shell.kind === 1 ? 1.7 : 2.3;
    shell.gravity = shell.kind === 3 ? 3.2 : 1.6;
    shell.size = (shell.kind === 3 ? 0.8 : 1.0) * big;
    const a = PALETTE[Math.floor(rnd() * PALETTE.length)];
    const b = PALETTE[Math.floor(rnd() * PALETTE.length)];
    shell.colors[0].copy(shell.kind === 3 ? GOLD : a);
    shell.colors[1].copy(shell.kind === 3 ? GOLD : shell.kind === 0 ? a : b);
    shell.burst = now + RISE_TIME;

    const u = this.material.uniforms;
    u.uSlotA.value[free].set(shell.center.x, shell.center.y, shell.center.z, shell.burst);
    u.uSlotB.value[free].set(shell.speed, shell.life, shell.kind, shell.gravity);
    u.uSlotC.value[free].x = shell.size;
    u.uColorA.value[free].copy(shell.colors[0]);
    u.uColorB.value[free].copy(shell.colors[1]);
  }

  private update(now: number): void {
    festivalUniforms.uTime.value = now;
    this.material.uniforms.uTime.value = now;
    // After a long pause (hidden tab) don't fire everything at once.
    if (now - this.nextLaunch > 3) this.nextLaunch = now;
    while (now >= this.nextLaunch) {
      this.launch(this.nextLaunch);
      if (this.salvo > 0) {
        this.salvo--;
        this.nextLaunch += 0.25 + this.random() * 0.3;
      } else {
        this.nextLaunch += 0.9 + this.random() * 1.8;
        if (this.random() < 0.15) this.salvo = 2 + Math.floor(this.random() * 3);
      }
    }

    // Light: each burst flares then fades; sum them into one colour and a direction.
    const flash = festivalUniforms.uFlash.value.setRGB(0, 0, 0);
    const direction = new THREE.Vector3();
    let total = 0;
    this.shells.forEach((shell, i) => {
      const t = now - shell.burst;
      const w = t < 0 || t > shell.life ? 0 : Math.exp(-t * 1.6) * (0.6 + 0.4 * Math.min(1, t * 20)) * shell.speed / 25;
      this.uniforms.uBursts.value[i].set(shell.center.x, shell.center.y, shell.center.z, w);
      this.uniforms.uBurstColors.value[i].copy(shell.colors[0]).lerp(shell.colors[1], 0.5);
      if (w <= 0) return;
      flash.r += this.uniforms.uBurstColors.value[i].r * w;
      flash.g += this.uniforms.uBurstColors.value[i].g * w;
      flash.b += this.uniforms.uBurstColors.value[i].b * w;
      direction.addScaledVector(shell.center.clone().normalize(), w);
      total += w;
    });
    flash.multiplyScalar(0.18);
    if (total > 0) {
      this.light.color.copy(flash).multiplyScalar(1 / Math.max(flash.r, flash.g, flash.b, 1e-4));
      this.light.position.copy(direction.normalize()).multiplyScalar(10).add(this.light.target.position);
    }
    this.light.intensity = Math.min(total, 1.6) * 2.4;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
    this.light.dispose();
  }
}
