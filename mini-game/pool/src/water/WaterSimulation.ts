import * as THREE from 'three';
import { POOL_HALF, POOL_SIZE } from './WaterGLSL';

const N = 256; // 格子数（1 セル ≒ 6.25cm）
const CELL = POOL_SIZE / N;
const STEP = 1 / 120; // 固定タイムステップ
const WAVE_SPEED = 2.2; // 見た目重視の伝播速度 (m/s)
const CFL2 = Math.pow((WAVE_SPEED * STEP) / CELL, 2);
const VEL_DAMPING = 0.9935; // 1 ステップごとの速度減衰
const FOAM_DECAY = 0.55; // 泡が消える速さ (1/s)
const MAX_SUBSTEPS = 4;

/**
 * 水面の高さ場シミュレーション（2 次元の波動方程式）。
 * 着水・島の縁・落ちてきた水滴が起こした波が、円形に広がって壁で跳ね返る。
 * 高さと泡を RG のテクスチャとして水面シェーダーへ渡す。
 */
export class WaterSimulation {
  public readonly texture: THREE.DataTexture;

  private h = new Float32Array(N * N);
  private v = new Float32Array(N * N);
  private foam = new Float32Array(N * N);
  private sponge = new Float32Array(N * N).fill(1);

  private floatData: Float32Array | null;
  private halfData: Uint16Array | null;
  private accumulator = 0;
  private dirty = true;
  private quiet = false;

  constructor(supportsFloatLinear: boolean) {
    if (supportsFloatLinear) {
      this.floatData = new Float32Array(N * N * 2);
      this.halfData = null;
      this.texture = new THREE.DataTexture(this.floatData, N, N, THREE.RGFormat, THREE.FloatType);
    } else {
      this.floatData = null;
      this.halfData = new Uint16Array(N * N * 2);
      this.texture = new THREE.DataTexture(this.halfData, N, N, THREE.RGFormat, THREE.HalfFloatType);
    }
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  /** 島の真下は波を吸収する（島が水を押さえているので、下から波が湧き出さないように） */
  public setIslandSponge(radius: number) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) * CELL - POOL_HALF;
        const z = (j + 0.5) * CELL - POOL_HALF;
        const d = Math.hypot(x, z);
        const t = THREE.MathUtils.smoothstep(d, radius - 0.35, radius - 0.05);
        this.sponge[j * N + i] = 1 - 0.14 * (1 - t);
      }
    }
  }

  private worldToCell(x: number, z: number) {
    return { fx: (x + POOL_HALF) / CELL - 0.5, fz: (z + POOL_HALF) / CELL - 0.5 };
  }

  /** 滑らかな山型の高さを足す（amount < 0 で凹み） */
  public addDrop(x: number, z: number, radius: number, amount: number) {
    const { fx, fz } = this.worldToCell(x, z);
    const rc = radius / CELL;
    const i0 = Math.max(1, Math.floor(fx - rc)), i1 = Math.min(N - 2, Math.ceil(fx + rc));
    const j0 = Math.max(1, Math.floor(fz - rc)), j1 = Math.min(N - 2, Math.ceil(fz + rc));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d2 = ((i - fx) * (i - fx) + (j - fz) * (j - fz)) / (rc * rc);
        if (d2 >= 1) continue;
        const w = (1 - d2) * (1 - d2);
        this.h[j * N + i] += amount * w;
      }
    }
    this.dirty = true;
    this.quiet = false;
  }

  /** 速度を足す（水を叩く・持ち上げる） */
  public addImpulse(x: number, z: number, radius: number, amount: number) {
    const { fx, fz } = this.worldToCell(x, z);
    const rc = radius / CELL;
    const i0 = Math.max(1, Math.floor(fx - rc)), i1 = Math.min(N - 2, Math.ceil(fx + rc));
    const j0 = Math.max(1, Math.floor(fz - rc)), j1 = Math.min(N - 2, Math.ceil(fz + rc));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d2 = ((i - fx) * (i - fx) + (j - fz) * (j - fz)) / (rc * rc);
        if (d2 >= 1) continue;
        const w = (1 - d2) * (1 - d2);
        this.v[j * N + i] += amount * w;
      }
    }
    this.dirty = true;
    this.quiet = false;
  }

  /** 泡（フォーム）を足す。1.0 で真っ白 */
  public addFoam(x: number, z: number, radius: number, amount: number) {
    const { fx, fz } = this.worldToCell(x, z);
    const rc = radius / CELL;
    const i0 = Math.max(0, Math.floor(fx - rc)), i1 = Math.min(N - 1, Math.ceil(fx + rc));
    const j0 = Math.max(0, Math.floor(fz - rc)), j1 = Math.min(N - 1, Math.ceil(fz + rc));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d2 = ((i - fx) * (i - fx) + (j - fz) * (j - fz)) / (rc * rc);
        if (d2 >= 1) continue;
        const idx = j * N + i;
        this.foam[idx] = Math.min(1.4, this.foam[idx] + amount * (1 - d2));
      }
    }
    this.dirty = true;
    this.quiet = false;
  }

  public update(delta: number) {
    this.accumulator = Math.min(this.accumulator + delta, STEP * MAX_SUBSTEPS);
    let steps = 0;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.step();
      steps++;
    }
    if (steps > 0) {
      const foamK = Math.exp(-FOAM_DECAY * STEP * steps);
      const f = this.foam;
      for (let i = 0; i < f.length; i++) f[i] *= foamK;
      this.dirty = true;
    }
    if (this.dirty && !this.quiet) this.upload();
  }

  private step() {
    const h = this.h, v = this.v, sp = this.sponge;
    let energy = 0;
    for (let j = 0; j < N; j++) {
      const jm = j > 0 ? j - 1 : 0;
      const jp = j < N - 1 ? j + 1 : N - 1;
      const row = j * N, rowM = jm * N, rowP = jp * N;
      for (let i = 0; i < N; i++) {
        const im = i > 0 ? i - 1 : 0;
        const ip = i < N - 1 ? i + 1 : N - 1;
        const c = h[row + i];
        const lap = h[row + im] + h[row + ip] + h[rowM + i] + h[rowP + i] - 4 * c;
        const idx = row + i;
        const nv = (v[idx] + CFL2 * lap) * VEL_DAMPING * sp[idx];
        v[idx] = nv;
        energy += nv * nv;
      }
    }
    for (let idx = 0; idx < h.length; idx++) h[idx] += v[idx];
    this.quiet = energy < 1e-9 && this.maxFoam() < 0.002;
  }

  private maxFoam(): number {
    let m = 0;
    const f = this.foam;
    for (let i = 0; i < f.length; i += 7) if (f[i] > m) m = f[i];
    return m;
  }

  private upload() {
    const h = this.h, f = this.foam;
    if (this.floatData) {
      const d = this.floatData;
      for (let i = 0, k = 0; i < h.length; i++, k += 2) {
        d[k] = h[i];
        d[k + 1] = f[i];
      }
    } else if (this.halfData) {
      const d = this.halfData;
      for (let i = 0, k = 0; i < h.length; i++, k += 2) {
        d[k] = THREE.DataUtils.toHalfFloat(h[i]);
        d[k + 1] = THREE.DataUtils.toHalfFloat(f[i]);
      }
    }
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  public static readonly GRID = N;
  public static readonly CELL_SIZE = CELL;
}
