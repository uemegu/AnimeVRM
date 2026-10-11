import * as THREE from 'three';

/**
 * 雨の地面: 濡れて暗くなった地面と、雨粒の跳ね返り。
 *
 * 暗くするのは、地面すれすれに置いた板を乗算で重ねるだけ（3D背景の素材は変えない）。
 * 板は地面（高さ 0）の上にだけ見え、遠くは薄くして奥の背景の絵と自然につなぐ。
 * 跳ね返りは、カメラの注視点のまわりの地面に、広がる輪と小さく跳ねる粒を出す。
 */

/** 暗くした地面の明るさ（1 = 元のまま） */
const WET_GROUND_SHADE = 0.5;
/** 暗くする範囲（注視点からの距離、m）。inner までは全部、outer で元の明るさに戻る */
const DARKEN_INNER = 7;
const DARKEN_OUTER = 14;
/** 跳ね返りを出す範囲（注視点からの距離、m）と、1 秒に出す数 */
const SPLASH_RADIUS = 4.5;
const SPLASHES_PER_SECOND = 70;
const MAX_SPLASHES = 64;
const SPLASH_SECONDS = 0.28;
/** 1 つの跳ね返りで跳ねる粒の数 */
const BEADS_PER_SPLASH = 2;
const GRAVITY = 9.8;
/** 3D背景の床の重ね（0.01〜0.02m）の上、地面の影（0.025m）の下 */
const GROUND_Y = 0.022;

interface Splash {
  position: THREE.Vector3;
  age: number;
  beads: { velocity: THREE.Vector3; position: THREE.Vector3 }[];
}

const _matrix = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export class RainGround {
  private readonly darken: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private readonly rings: THREE.InstancedMesh;
  private readonly beads: THREE.InstancedMesh;
  private readonly splashes: Splash[] = [];
  private active = false;
  private untilNext = 0;

  constructor(private readonly scene: THREE.Scene) {
    // 中心から離れるほど薄くなる乗算の板
    this.darken = new THREE.Mesh(
      new THREE.CircleGeometry(DARKEN_OUTER, 64),
      new THREE.ShaderMaterial({
        uniforms: { uShade: { value: WET_GROUND_SHADE }, uInner: { value: DARKEN_INNER }, uOuter: { value: DARKEN_OUTER } },
        vertexShader: /* glsl */ `
          varying vec2 vLocal;
          void main() {
            vLocal = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,
        fragmentShader: /* glsl */ `
          uniform float uShade, uInner, uOuter;
          varying vec2 vLocal;
          void main() {
            float fade = 1.0 - smoothstep( uInner, uOuter, length( vLocal ) );
            gl_FragColor = vec4( vec3( mix( 1.0, uShade, fade ) ), 1.0 );
          }`,
        blending: THREE.MultiplyBlending,
        premultipliedAlpha: true,
        transparent: true,
        depthWrite: false,
      })
    );
    this.darken.name = 'Wet ground';
    this.darken.rotation.x = -Math.PI / 2;
    this.darken.position.y = GROUND_Y;
    // 地面の影（同じ高さの透明な板）のあとに描いて、影も一緒に暗くする
    this.darken.renderOrder = 1;
    this.darken.visible = false;
    scene.add(this.darken);

    const material = new THREE.MeshBasicMaterial({ color: 0xdde8f5, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.8, 1, 20), material, MAX_SPLASHES);
    this.beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), material.clone(), MAX_SPLASHES * BEADS_PER_SPLASH);
    (this.beads.material as THREE.MeshBasicMaterial).opacity = 0.85;
    for (const mesh of [this.rings, this.beads]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, _hidden);
      mesh.visible = false;
      scene.add(mesh);
    }
  }

  setActive(active: boolean): void {
    this.active = active;
    this.darken.visible = active;
    if (!active) {
      this.splashes.length = 0;
      this.rings.visible = this.beads.visible = false;
    }
  }

  /** center はカメラの注視点（地面の高さは問わない） */
  update(delta: number, center: THREE.Vector3): void {
    if (!this.active) return;
    this.darken.position.set(center.x, GROUND_Y, center.z);

    this.untilNext -= delta;
    while (this.untilNext <= 0) {
      this.untilNext += 1 / SPLASHES_PER_SECOND;
      if (this.splashes.length >= MAX_SPLASHES) continue;
      // 範囲の中に一様に（中心ほど密にならないよう半径は平方根で取る）
      const r = Math.sqrt(Math.random()) * SPLASH_RADIUS;
      const a = Math.random() * Math.PI * 2;
      const position = new THREE.Vector3(center.x + Math.cos(a) * r, GROUND_Y + 0.002, center.z + Math.sin(a) * r);
      const beads = Array.from({ length: BEADS_PER_SPLASH }, () => {
        const b = Math.random() * Math.PI * 2;
        const out = 0.15 + Math.random() * 0.25;
        return { position: position.clone(), velocity: new THREE.Vector3(Math.cos(b) * out, 0.5 + Math.random() * 0.5, Math.sin(b) * out) };
      });
      this.splashes.push({ position, age: 0, beads });
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const splash = this.splashes[i];
      splash.age += delta;
      if (splash.age >= SPLASH_SECONDS) {
        this.splashes.splice(i, 1);
        continue;
      }
      for (const bead of splash.beads) {
        bead.velocity.y -= GRAVITY * delta;
        bead.position.addScaledVector(bead.velocity, delta);
      }
    }

    for (let i = 0; i < MAX_SPLASHES; i++) {
      const splash = this.splashes[i];
      if (!splash) {
        this.rings.setMatrixAt(i, _hidden);
        for (let j = 0; j < BEADS_PER_SPLASH; j++) this.beads.setMatrixAt(i * BEADS_PER_SPLASH + j, _hidden);
        continue;
      }
      const t = splash.age / SPLASH_SECONDS;
      // 輪は広がりながら細く消える（不透明度は共通なので、消え際は大きさで細らせる）
      const radius = 0.012 + 0.07 * Math.sqrt(t);
      _scale.set(radius, radius, radius * (1 - t));
      _matrix.compose(splash.position, _flat, _scale);
      this.rings.setMatrixAt(i, _matrix);
      for (let j = 0; j < BEADS_PER_SPLASH; j++) {
        const bead = splash.beads[j];
        const size = bead.position.y > GROUND_Y ? 0.006 * (1 - t * 0.5) : 0;
        _scale.set(size, size * 1.6, size);
        _matrix.compose(bead.position, _quat, _scale);
        this.beads.setMatrixAt(i * BEADS_PER_SPLASH + j, _matrix);
      }
    }
    this.rings.instanceMatrix.needsUpdate = true;
    this.beads.instanceMatrix.needsUpdate = true;
    this.rings.visible = this.beads.visible = this.splashes.length > 0;
  }

  dispose(): void {
    for (const mesh of [this.darken, this.rings, this.beads]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
