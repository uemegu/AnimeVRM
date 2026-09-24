import * as THREE from 'three';

/**
 * 顔の SDF 陰影（原神風のフェイスシャドウマップ）。
 *
 * 顔の陰を法線（ポリゴンの凹凸）で決めると、横からの光で頬や鼻まわりが斑になる。
 * 代わりに「テクセルごとに、光が正面から何度まで回り込んだら陰になるか」を
 * テクスチャに持たせ、光の水平角と比べて明暗を決める。境目は角度に応じて
 * なめらかに移動し、鼻の横には光の角度に応じて伸びる三角の影が出る。
 *
 * マップは読み込んだ顔メッシュから自動で作る（顔を楕円体で近似＋鼻の影）。
 * R/G: 頭の +X 側 / -X 側から光が来たときの頬の陰のしきい値（0 = 正面, 1 = 真後ろ）
 * B/A: 同じく +X 側 / -X 側から光が来たときの、鼻の影の三角の中での位置
 *      （0 = 鼻の付け根, 1 = 最大の三角の外）。大きさと出始めは実行時に決める。
 */

export interface FaceSdfParams {
  enabled: boolean;
  /** 明暗の境目のぼかし幅（光の角度, 度） */
  softness: number;
  /** 鼻の影の大きさ（0 = なし, 1 = 最大。最大は顔の半幅の 3 割の三角） */
  noseSize: number;
  /** 鼻の影が出始める光の角度（度）。ここから 90° にかけて広がる */
  noseStart: number;
  /** 光の角度がこの範囲にある間は途中の影を飛ばす（開始の影を保ち、中ほどで終了の影へ切り替える）。同じ値なら無効 */
  skipStart: number;
  skipEnd: number;
  /** 飛ばす範囲の中ほどで切り替えるときの幅（度） */
  skipBlend: number;
}

export const DEFAULT_FACE_SDF_PARAMS: FaceSdfParams = {
  enabled: true,
  softness: 3,
  noseSize: 0.5,
  noseStart: 30,
  skipStart: 60,
  skipEnd: 120,
  skipBlend: 4,
};

export const FACE_SDF_UNIFORMS = {
  uFaceSdfEnabled: { value: DEFAULT_FACE_SDF_PARAMS.enabled ? 1 : 0 },
  uFaceSdfSoftness: { value: DEFAULT_FACE_SDF_PARAMS.softness },
  uFaceSdfNoseSize: { value: DEFAULT_FACE_SDF_PARAMS.noseSize },
  uFaceSdfNoseStart: { value: DEFAULT_FACE_SDF_PARAMS.noseStart },
  uFaceSdfSkipStart: { value: DEFAULT_FACE_SDF_PARAMS.skipStart },
  uFaceSdfSkipEnd: { value: DEFAULT_FACE_SDF_PARAMS.skipEnd },
  uFaceSdfSkipBlend: { value: DEFAULT_FACE_SDF_PARAMS.skipBlend },
};

export function setFaceSdfParams(params: Partial<FaceSdfParams>): void {
  const u = FACE_SDF_UNIFORMS;
  if (params.enabled !== undefined) u.uFaceSdfEnabled.value = params.enabled ? 1 : 0;
  if (params.softness !== undefined) u.uFaceSdfSoftness.value = params.softness;
  if (params.noseSize !== undefined) u.uFaceSdfNoseSize.value = params.noseSize;
  if (params.noseStart !== undefined) u.uFaceSdfNoseStart.value = params.noseStart;
  if (params.skipStart !== undefined) u.uFaceSdfSkipStart.value = params.skipStart;
  if (params.skipEnd !== undefined) u.uFaceSdfSkipEnd.value = params.skipEnd;
  if (params.skipBlend !== undefined) u.uFaceSdfSkipBlend.value = params.skipBlend;
}

/** アバターごとのマップと頭の向き。顔を構成する全マテリアルで共有する。 */
export interface FaceSdfFrame {
  map: { value: THREE.Texture };
  /** 頭の横方向（マップの +X）と前方向（ワールド座標） */
  right: { value: THREE.Vector3 };
  forward: { value: THREE.Vector3 };
}

let placeholder: THREE.DataTexture | null = null;
function placeholderTexture(): THREE.DataTexture {
  if (!placeholder) {
    placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    placeholder.needsUpdate = true;
  }
  return placeholder;
}

export function createFaceSdfFrame(): FaceSdfFrame {
  return {
    map: { value: placeholderTexture() },
    right: { value: new THREE.Vector3(1, 0, 0) },
    forward: { value: new THREE.Vector3(0, 0, 1) },
  };
}

/**
 * 顔のメッシュ群（肌・口まわりなど、同じ顔テクスチャの UV を使うもの）から
 * 1 枚のマップを作り、描画のたびに頭の向きを渡すようにする。
 * 作れなかった（頭の骨がない等）ときは false を返し、従来の陰影のままにする。
 */
export function attachFaceSdf(
  meshes: THREE.Mesh[],
  headBone: THREE.Object3D,
  frame: FaceSdfFrame,
  size = 512
): boolean {
  const built = buildFaceSdfMap(meshes, headBone, size);
  if (!built) return false;
  frame.map.value = built.texture;

  const quat = new THREE.Quaternion();
  for (const mesh of meshes) {
    const prevOnBeforeRender = mesh.onBeforeRender;
    mesh.onBeforeRender = function (...args) {
      headBone.getWorldQuaternion(quat);
      frame.right.value.set(1, 0, 0).applyQuaternion(quat);
      frame.forward.value.set(0, 0, built.frontSign).applyQuaternion(quat);
      prevOnBeforeRender.apply(this, args);
    };
  }
  return true;
}

/**
 * 顔の頂点を頭の骨の座標系（バインド姿勢）で読み、UV 空間に焼き込んでしきい値マップを作る。
 * 頭の座標系で作るので、実行時は頭の向きに対する光の角度だけでマップを引ける。
 */
function buildFaceSdfMap(
  meshes: THREE.Mesh[],
  headBone: THREE.Object3D,
  size: number
): { texture: THREE.DataTexture; frontSign: number } | null {
  // 全メッシュの頂点を頭の骨の空間（バインド姿勢）にまとめる。アニメーション中でも崩れない。
  const positions: number[] = [];
  const uvs: number[] = [];
  const triangles: number[] = [];
  const v = new THREE.Vector3();
  const toHead = new THREE.Matrix4();
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    if (!position || !uv) continue;
    const skinned = mesh as THREE.SkinnedMesh;
    const boneIndex = skinned.isSkinnedMesh ? skinned.skeleton.bones.indexOf(headBone as THREE.Bone) : -1;
    if (boneIndex >= 0) {
      toHead.multiplyMatrices(skinned.skeleton.boneInverses[boneIndex], skinned.bindMatrix);
    } else {
      mesh.updateWorldMatrix(true, false);
      headBone.updateWorldMatrix(true, false);
      toHead.copy(headBone.matrixWorld).invert().multiply(mesh.matrixWorld);
    }
    const base = positions.length / 3;
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(toHead);
      positions.push(v.x, v.y, v.z);
      uvs.push(uv.getX(i), uv.getY(i));
    }
    const index = geometry.getIndex();
    const indexCount = index ? index.count : position.count;
    for (let k = 0; k < indexCount; k += 1) {
      triangles.push(base + (index ? index.getX(k) : k));
    }
  }

  const count = positions.length / 3;
  if (count === 0) return null;
  const local = Float32Array.from(positions);
  let sumZ = 0;
  for (let i = 0; i < count; i += 1) sumZ += local[i * 3 + 2];
  // 顔は頭の骨より前にある。前が -Z のモデル（VRM0）でも同じ計算にするため向きをそろえる。
  const frontSign = sumZ >= 0 ? 1 : -1;
  for (let i = 0; i < count; i += 1) local[i * 3 + 2] *= frontSign;

  // 顔の大きさと中心
  const xs: number[] = [];
  const ys: number[] = [];
  let sumX = 0;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i += 1) {
    xs.push(local[i * 3]);
    ys.push(local[i * 3 + 1]);
    sumX += local[i * 3];
    maxZ = Math.max(maxZ, local[i * 3 + 2]);
  }
  const x0 = sumX / count;
  const halfWidth = percentile(xs.map((x) => Math.abs(x - x0)), 0.97);
  const yMin = percentile(ys, 0.02);
  const yMax = percentile(ys, 0.98);
  const height = Math.max(yMax - yMin, 1e-4);
  if (halfWidth < 1e-4) return null;
  // 横長すぎない楕円体。奥行きの中心は顔の最前面から少し後ろ。
  const radiusX = halfWidth;
  const radiusZ = halfWidth * 0.85;
  const centerZ = maxZ - radiusZ;

  // 鼻先: 顔の中央付近・高さの中ほどで最も前に出ている点
  let noseY = yMin + height * 0.4;
  let noseZ = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const x = local[i * 3];
    const y = local[i * 3 + 1];
    const z = local[i * 3 + 2];
    if (Math.abs(x - x0) < halfWidth * 0.1 && y > yMin + height * 0.2 && y < yMin + height * 0.65 && z > noseZ) {
      noseZ = z;
      noseY = y;
    }
  }
  // 鼻の影の最大の三角: 鼻筋の上端で細く、鼻先で最も広い。実行時の noseSize でこれを相似に縮める
  const noseTop = noseY + height * 0.1;
  const noseBottom = noseY - height * 0.025;
  const noseMaxWidth = halfWidth * 0.3;

  const halfPi = Math.PI / 2;
  // 鼻の影の三角の中での位置（0 = 鼻の付け根, 1 以上 = 外）。distance は光と反対側への距離
  const noseMetric = (distance: number, y: number, z: number): number => {
    if (distance <= 0 || z <= centerZ || y <= noseBottom || y >= noseTop) return 1;
    const vertical = y >= noseY ? (y - noseY) / (noseTop - noseY) : (noseY - y) / (noseY - noseBottom);
    return Math.min(1, distance / noseMaxWidth + vertical);
  };
  const channels = (x: number, y: number, z: number): [number, number, number, number] => {
    const phi = Math.atan2((x - x0) / radiusX, (z - centerZ) / radiusZ);
    // 正面からの光では必ず明るい
    const right = clamp01(Math.max((phi + halfPi) / Math.PI, 0.03));
    const left = clamp01(Math.max((halfPi - phi) / Math.PI, 0.03));
    return [right, left, noseMetric(x0 - x, y, z), noseMetric(x - x0, y, z)];
  };

  // UV 空間に三角形ごとに焼き込む（glTF の UV は画像の左上が原点。flipY なしの DataTexture と同じ向き）
  const values = new Float32Array(size * size * 4);
  const filled = new Uint8Array(size * size);
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    const a = triangles[t];
    const b = triangles[t + 1];
    const c = triangles[t + 2];
    const ax = uvs[a * 2] * size, ay = uvs[a * 2 + 1] * size;
    const bx = uvs[b * 2] * size, by = uvs[b * 2 + 1] * size;
    const cx = uvs[c * 2] * size, cy = uvs[c * 2 + 1] * size;
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const sx = px + 0.5;
        const sy = py + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (cx - sx) * (by - sy)) / area;
        const w1 = ((cx - sx) * (ay - sy) - (ax - sx) * (cy - sy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const x = w0 * local[a * 3] + w1 * local[b * 3] + w2 * local[c * 3];
        const y = w0 * local[a * 3 + 1] + w1 * local[b * 3 + 1] + w2 * local[c * 3 + 1];
        const z = w0 * local[a * 3 + 2] + w1 * local[b * 3 + 2] + w2 * local[c * 3 + 2];
        const p = py * size + px;
        values.set(channels(x, y, z), p * 4);
        filled[p] = 1;
      }
    }
  }

  dilate(values, filled, size, 4);
  const smoothed = boxBlur(values, size);

  const data = new Uint8Array(size * size * 4);
  for (let p = 0; p < size * size; p += 1) {
    for (let k = 0; k < 4; k += 1) data[p * 4 + k] = Math.round(clamp01(smoothed[p * 4 + k]) * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return { texture, frontSign };
}

/** 顔の外（UV の隙間）に隣の値を広げ、境目でのにじみを防ぐ。 */
function dilate(values: Float32Array, filled: Uint8Array, size: number, passes: number): void {
  const sum = new Float32Array(4);
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Array<[number, Float32Array]> = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const p = y * size + x;
        if (filled[p]) continue;
        sum.fill(0);
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const q = ny * size + nx;
          if (!filled[q]) continue;
          for (let k = 0; k < 4; k += 1) sum[k] += values[q * 4 + k];
          n += 1;
        }
        if (n > 0) next.push([p, sum.map((value) => value / n)]);
      }
    }
    for (const [p, average] of next) {
      values.set(average, p * 4);
      filled[p] = 1;
    }
  }
  // 顔から遠い所は明るい側・鼻の影の外（使われないが、念のため）
  for (let p = 0; p < size * size; p += 1) {
    if (!filled[p]) values.fill(1, p * 4, p * 4 + 4);
  }
}

/** 3x3 の平均で、三角形の継ぎ目や鼻の影の角のギザギザをならす。 */
function boxBlur(values: Float32Array, size: number): Float32Array {
  const out = new Float32Array(values.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const p = y * size + x;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const q = Math.min(size - 1, Math.max(0, y + dy)) * size + Math.min(size - 1, Math.max(0, x + dx));
          for (let k = 0; k < 4; k += 1) out[p * 4 + k] += values[q * 4 + k] / 9;
        }
      }
    }
  }
  return out;
}

function percentile(list: number[], q: number): number {
  if (list.length === 0) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * MToon の直接光の陰影で、顔だけ法線の代わりにマップで明暗を決める。
 * 全 MToon マテリアルに同じコードを入れ、使うかどうかは uFaceSdfTarget で切り替える。
 */
export function injectFaceSdf(
  shader: THREE.WebGLProgramParametersWithUniforms,
  target: { value: number },
  frame: FaceSdfFrame
): void {
  Object.assign(shader.uniforms, FACE_SDF_UNIFORMS);
  shader.uniforms.uFaceSdfTarget = target;
  shader.uniforms.uFaceSdfMap = frame.map;
  shader.uniforms.uFaceSdfRight = frame.right;
  shader.uniforms.uFaceSdfForward = frame.forward;

  shader.fragmentShader = shader.fragmentShader.replace(
    'float getShading(',
    /* glsl */ `
    uniform float uFaceSdfEnabled;
    uniform float uFaceSdfSoftness;
    uniform float uFaceSdfNoseSize;
    uniform float uFaceSdfNoseStart;
    uniform float uFaceSdfSkipStart;
    uniform float uFaceSdfSkipEnd;
    uniform float uFaceSdfSkipBlend;
    uniform float uFaceSdfTarget;
    uniform sampler2D uFaceSdfMap;
    uniform vec3 uFaceSdfRight;
    uniform vec3 uFaceSdfForward;

    // 1 = 光が当たる, 0 = 陰。光の向き（ビュー空間）を頭の水平面に投影した角度でマップを引く。
    float faceSdfLit( const in vec3 lightDir ) {
      #ifdef MTOON_USE_UV
        vec3 rightView = normalize( ( viewMatrix * vec4( uFaceSdfRight, 0.0 ) ).xyz );
        vec3 forwardView = normalize( ( viewMatrix * vec4( uFaceSdfForward, 0.0 ) ).xyz );
        float lx = dot( lightDir, rightView );
        float lz = dot( lightDir, forwardView );
        float angle = degrees( atan( abs( lx ), lz ) );

        // 途中の影を飛ばす: 開始の角度の影を保ち、中ほどで素早く終了の角度の影へ切り替える
        if ( uFaceSdfSkipEnd > uFaceSdfSkipStart && angle > uFaceSdfSkipStart && angle < uFaceSdfSkipEnd ) {
          float middle = 0.5 * ( uFaceSdfSkipStart + uFaceSdfSkipEnd );
          float blend = max( uFaceSdfSkipBlend, 0.01 );
          angle = mix( uFaceSdfSkipStart, uFaceSdfSkipEnd, smoothstep( middle - blend, middle + blend, angle ) );
        }

        vec4 sdf = texture2D( uFaceSdfMap, vUv );
        // 真正面・真後ろを光が横切るときに左右の切り替えで跳ねないよう少し混ぜる
        float side = smoothstep( -0.05, 0.05, lx );
        float threshold = mix( sdf.g, sdf.r, side ) * 180.0;

        // 鼻の影: 三角の中の位置が noseSize より内側なら、noseStart から 90° にかけて広がる
        float nose = mix( sdf.a, sdf.b, side );
        if ( uFaceSdfNoseSize > 0.001 ) {
          threshold = min( threshold, uFaceSdfNoseStart + ( 90.0 - uFaceSdfNoseStart ) * nose / uFaceSdfNoseSize );
        }

        float softness = max( uFaceSdfSoftness, 0.01 );
        return smoothstep( -softness, softness, threshold - angle );
      #else
        return 1.0;
      #endif
    }

    float getShading(`
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    'float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );',
    /* glsl */ `float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );
    if ( uFaceSdfTarget > 0.5 && uFaceSdfEnabled > 0.5 ) {
      // getShading は shadingShift を足してから shadingToonyFactor の幅で硬くする。
      // その逆算をしておき、マップで決めた明暗（ぼかし込み）がそのまま陰影になるようにする。
      float toonyEdge = max( 1.0 - shadingToonyFactor, 0.001 );
      dotNL = -toonyEdge + 2.0 * toonyEdge * faceSdfLit( directLight.direction ) - material.shadingShift;
    }`
  );
}
