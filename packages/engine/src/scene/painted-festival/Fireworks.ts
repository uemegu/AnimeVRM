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
const PARTICLES = 220;
const TRAIL = 12;
const RISE_POINTS = 18;
const RISE_TIME = 1.25;

/**
 * Kinds (Japanese shells): 0 kiku (chrysanthemum: long tails that burn orange, the stars change
 * colour), 1 botan (peony: bright stars, short tails), 2 wa (a ring, tilted), 3 yanagi (willow: gold
 * stars drooping on long glittering tails), 4 yaeshin (double sphere: an inner pistil of another
 * colour).
 */
type Shell = { kind: number; speed: number; life: number; gravity: number; colors: [THREE.Color, THREE.Color]; size: number; tilt: THREE.Vector3 };

const PALETTE = ['#ff3d5a', '#ff9a3c', '#ffe066', '#5dff9a', '#4aa8ff', '#b77dff', '#ff6ad5', '#f4f7ff', '#4ff0ff'].map((c) => new THREE.Color(c));
const GOLD = new THREE.Color('#ffbf5e');

const vertexShader = /* glsl */ `
  #define SLOTS ${SLOTS}
  #define TRAIL ${TRAIL.toFixed(1)}
  uniform float uTime, uScale, uLaunchY, uRiseTime;
  uniform vec4 uSlotA[SLOTS]; // centre xyz, burst time
  uniform vec4 uSlotB[SLOTS]; // speed, life, kind, gravity
  uniform vec4 uSlotC[SLOTS]; // ring tilt (normal) xyz, size
  uniform vec3 uColorA[SLOTS], uColorB[SLOTS];
  attribute vec3 aDir;
  attribute vec4 aInfo; // slot, trail index, seed, kind of point (0 star, 1 rise, 2 glow)
  varying vec3 vColor;
  varying float vSoft;

  void hide() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); }
  float rand(float x) { return fract(sin(x * 91.7) * 43758.5453); }

  void main() {
    int slot = int(aInfo.x);
    vec4 a = uSlotA[slot], b = uSlotB[slot], c = uSlotC[slot];
    float trail = aInfo.y, seed = aInfo.z, point = aInfo.w;
    float age = uTime - a.w;
    float life = b.y, kind = floor(b.z + 0.5);
    vec3 world;
    float size;
    vSoft = 0.0;
    if (point > 1.5) {
      // The flash of the bursting charge, then a glow lighting the smoke around the burst.
      if (age < 0.0 || age > life) { hide(); return; }
      world = a.xyz;
      size = b.x * 2.4;
      vColor = vec3(1.0, 0.95, 0.85) * 0.22 * exp(-age * 12.0) + uColorA[slot] * 0.06 * exp(-age * 1.3);
      vSoft = 1.0;
    } else if (point > 0.5) {
      // Rising spark with a short tail of embers.
      float t = age + uRiseTime - trail * 0.03;
      if (t < 0.0 || t > uRiseTime || age > 0.0) { hide(); return; }
      float k = t / uRiseTime;
      float rise = 1.0 - (1.0 - k) * (1.0 - k);
      world = vec3(a.x + sin(t * 9.0 + seed * 6.0) * 0.15, mix(uLaunchY, a.y, rise), a.z);
      float f = trail / ${RISE_POINTS.toFixed(1)};
      size = mix(0.4, 0.15, f);
      vColor = vec3(1.0, 0.68, 0.35) * (1.0 - f) * 1.6;
    } else {
      bool willow = kind == 3.0;
      float spacing = kind == 0.0 ? 0.05 : kind == 1.0 ? 0.014 : willow ? 0.1 : 0.03;
      float t = age - trail * spacing;
      if (t < 0.0 || t > life) { hide(); return; }
      vec3 dir = aDir;
      float speed = b.x * (0.92 + 0.08 * rand(seed));
      bool pistil = kind == 4.0 && seed < 0.4;
      if (kind == 2.0) dir = normalize(dir - c.xyz * dot(dir, c.xyz) * 0.94);
      if (pistil) speed *= 0.5;
      float drag = willow ? 1.0 : 2.2;
      world = a.xyz + dir * speed * (1.0 - exp(-drag * t)) / drag;
      world.y -= 0.5 * b.w * t * t;
      float fade = 1.0 - t / life;
      float tail = trail / TRAIL;
      float bright = pow(fade, willow ? 0.8 : 1.3) * pow(1.0 - tail, 1.6);
      // Glitter as the stars burn out (all through a willow's fall).
      float glitter = step(0.45, rand(seed * 13.1 + trail + floor(uTime * 20.0)));
      bright *= mix(1.0, glitter * 1.6, willow ? smoothstep(0.15, 0.4, t / life) : smoothstep(0.6, 0.9, t / life));
      // White-hot just after the burst. At the very start every star and its tail sit on the same
      // spot: fade them in, or the additive pile-up overflows the half-float target (a black dot).
      bright *= (1.0 + 1.5 * exp(-t * 12.0)) * smoothstep(0.0, 0.06, t);
      vec3 head = pistil ? uColorB[slot] : kind == 0.0 ? mix(uColorA[slot], uColorB[slot], smoothstep(0.42, 0.5, t / life)) : uColorA[slot];
      // Tails burn charcoal orange, cooling towards their end.
      vec3 ember = vec3(1.0, 0.5, 0.18);
      vec3 color = mix(head, ember, (kind == 0.0 || willow) ? smoothstep(0.0, 0.5, tail) : tail * 0.3);
      color = mix(color, vec3(1.0), 0.2 * exp(-t * 6.0));
      // Peony stars are fat: while they are still bunched up they would blow out into one blob.
      vColor = color * bright * (kind == 1.0 ? 1.8 : 2.6) * mix(0.35, 1.0, smoothstep(0.0, 0.35, t));
      size = c.w * mix(1.0, 0.45, tail) * (pistil ? 0.8 : 1.0);
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
    // A hot white-ish core inside a soft coloured halo.
    float halo = exp(-r2 * 3.0) * 0.25;
    float core = exp(-r2 * 16.0);
    vec3 star = vColor * (core + halo) + vec3(dot(vColor, vec3(0.33))) * core * 0.35;
    gl_FragColor = vec4(min(mix(star, vColor * (1.0 - r2) * (1.0 - r2), vSoft), vec3(16.0)), 1.0);
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
        uSlotC: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, 1, 0, 0.5)) },
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
    for (let i = 0; i < SLOTS; i++) this.shells.push({ kind: 0, speed: 1, life: 1, gravity: 0, colors: [new THREE.Color(), new THREE.Color()], size: 0.5, tilt: new THREE.Vector3(0, 0, 1), burst: -100, center: new THREE.Vector3() });
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
    const big = 0.75 + rnd() * 0.5;
    const willow = shell.kind === 3;
    shell.speed = (willow ? 18 : 26) * big;
    shell.life = willow ? 4.2 : shell.kind === 1 ? 2.0 : 2.6;
    shell.gravity = willow ? 2.6 : 1.4;
    shell.size = (willow ? 0.75 : shell.kind === 1 ? 1.0 : 0.95) * big;
    const a = PALETTE[Math.floor(rnd() * PALETTE.length)];
    let b = PALETTE[Math.floor(rnd() * PALETTE.length)];
    if (b === a) b = PALETTE[(PALETTE.indexOf(a) + 3) % PALETTE.length];
    shell.colors[0].copy(willow ? GOLD : a);
    shell.colors[1].copy(willow ? GOLD : b);
    // Rings face the viewer, tilted a little.
    shell.tilt.set((rnd() - 0.5) * 0.9, (rnd() - 0.5) * 0.9, 1).normalize();
    shell.burst = now + RISE_TIME;

    const u = this.material.uniforms;
    u.uSlotA.value[free].set(shell.center.x, shell.center.y, shell.center.z, shell.burst);
    u.uSlotB.value[free].set(shell.speed, shell.life, shell.kind, shell.gravity);
    u.uSlotC.value[free].set(shell.tilt.x, shell.tilt.y, shell.tilt.z, shell.size);
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
      const w = t < 0 || t > shell.life ? 0 : Math.exp(-t * 1.6) * (0.6 + 0.4 * Math.min(1, t * 20)) * shell.speed / 26;
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
    // Several bursts at once must not wash the whole night out.
    const peak = Math.max(flash.r, flash.g, flash.b);
    if (peak > 0.11) flash.multiplyScalar(0.11 / peak);
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
