// VRM の顔の輪郭（エラ・頬）を、参照の頭の GLB の正面の輪郭に寄せる。
//
//   node scripts/reshape_face_contour.mjs <素体.vrm> <参照.glb> <出力.vrm> [--strength 1] [--report]
//
// - 顔のメッシュの頂点を左右（X）方向にだけ動かす。高さ・奥行きは変えない
// - 鼻・口・目のまわり（顔の中央と目より上）は動かさない。動かすのは顔の外側、鼻の高さより下が中心
// - 大きさは「あご先〜鼻先の高さ」でそろえ、高さごとの横幅の比を参照に合わせる
// - 表情のシェイプキーは差分なので、そのまま新しい輪郭の上で動く
// VRM の拡張（VRMC_vrm・SpringBone・MToon）は JSON をそのまま残す。
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i < 0 ? def : Number(args[i + 1]);
};
const [inPath, refPath, outPath] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--report'));
const STRENGTH = flag('--strength', 1);
const REPORT = args.includes('--report');
const EAR_DEPTH = flag('--ear-depth', 1.2); // 鼻先からこれ×（あご〜鼻の高さ）より奥は耳として輪郭の測定から外す

function readGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const binStart = 20 + jsonLen + 8;
  return { json, bin: Buffer.from(buf.subarray(binStart, binStart + binLen)) };
}

function writeGlb(filePath, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
  const binPad = Buffer.alloc((4 - (bin.length % 4)) % 4, 0);
  const jsonChunk = Buffer.concat([jsonBuf, jsonPad]);
  const binChunk = Buffer.concat([bin, binPad]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonChunk.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binChunk.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(filePath, Buffer.concat([header, jh, jsonChunk, bh, binChunk]));
}

function vec3View(json, ai) {
  const ac = json.accessors[ai];
  const bv = json.bufferViews[ac.bufferView];
  return { count: ac.count, stride: bv.byteStride || 12, offset: (bv.byteOffset || 0) + (ac.byteOffset || 0) };
}

function readVec3(json, bin, ai) {
  const { count, stride, offset } = vec3View(json, ai);
  const out = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = bin.readFloatLE(offset + i * stride + k * 4);
  return out;
}

function writeVec3(json, bin, ai, data) {
  const { count, stride, offset } = vec3View(json, ai);
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) bin.writeFloatLE(data[i * 3 + k], offset + i * stride + k * 4);
}

function readIndices(json, bin, ai) {
  const ac = json.accessors[ai];
  const bv = json.bufferViews[ac.bufferView];
  const off = (bv.byteOffset || 0) + (ac.byteOffset || 0);
  const size = { 5121: 1, 5123: 2, 5125: 4 }[ac.componentType];
  const out = new Uint32Array(ac.count);
  for (let i = 0; i < ac.count; i++) out[i] = size === 4 ? bin.readUInt32LE(off + i * 4) : size === 2 ? bin.readUInt16LE(off + i * 2) : bin.readUInt8(off + i);
  return out;
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// 三角形の辺を高さ y の水平面で切った点（+Z が正面、+Y が上）
function slice(edges, y) {
  const out = [];
  for (const [a, b] of edges) {
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
    const s = (y - a[1]) / (b[1] - a[1]);
    out.push([a[0] + (b[0] - a[0]) * s, y, a[2] + (b[2] - a[2]) * s]);
  }
  return out;
}

// 三角形の辺から、鼻先・あご先と、高さごとの正面の半幅を測る
function measure(edges, label) {
  let minY = Infinity, maxY = -Infinity;
  for (const [a] of edges) {
    minY = Math.min(minY, a[1]);
    maxY = Math.max(maxY, a[1]);
  }
  // 正中線（x=0 の断面）の一番前の線を、高さごとに取る
  const NB = 300;
  const front = [];
  for (let b = 1; b < NB; b++) {
    const y = minY + ((maxY - minY) * b) / NB;
    const s = slice(edges, y);
    let z = -Infinity, w = Infinity;
    for (const p of s) {
      if (p[2] > z && Math.abs(p[0]) < (maxY - minY) * 0.04) z = p[2];
      w = Math.min(w, Math.abs(p[0]));
    }
    if (z > -Infinity) front.push([y, z]);
  }
  // 鼻先：下 3/4 で一番前
  const lower = front.filter(([y]) => y < minY + (maxY - minY) * 0.75);
  const nose = lower.reduce((a, b) => (b[1] > a[1] ? b : a));
  // あご先：鼻より下を下へたどり、前後位置が一番大きく下がる所（あごの下）。なければメッシュの下端
  const below = front.filter(([y]) => y < nose[0]).sort((a, b) => b[0] - a[0]);
  let chinY = below.length ? below[below.length - 1][0] : minY;
  let bestDrop = 0;
  const depth = nose[1] - Math.min(...front.map((f) => f[1]));
  for (let i = 1; i < below.length; i++) {
    const drop = below[i - 1][1] - below[i][1];
    if (drop > bestDrop && drop > depth * 0.12) {
      bestDrop = drop;
      chinY = below[i - 1][0];
    }
  }
  const H = nose[0] - chinY;
  const zCut = nose[1] - EAR_DEPTH * H;
  // 高さ t（あご先 0・鼻先 1）ごとの半幅（H で割った値）
  const T_STEP = 0.05;
  const T_MAX = 2.4;
  const widths = [];
  for (let t = 0; t <= T_MAX + 1e-9; t += T_STEP) {
    let w = 0;
    for (const p of slice(edges, chinY + t * H)) if (p[2] > zCut) w = Math.max(w, Math.abs(p[0]));
    widths.push(w / H);
  }
  return { label, noseY: nose[0], noseZ: nose[1], chinY, H, zCut, widths, T_STEP };
}

function triEdges(pos, indices) {
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const edges = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = P(indices[i]), b = P(indices[i + 1]), c = P(indices[i + 2]);
    edges.push([a, b], [b, c], [c, a]);
  }
  return edges;
}

function widthAt(m, t) {
  const f = Math.min(Math.max(t / m.T_STEP, 0), m.widths.length - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, m.widths.length - 1);
  return m.widths[i] * (1 - (f - i)) + m.widths[j] * (f - i);
}

// --- 参照 ---
const ref = readGlb(refPath);
const refEdges = [];
for (const mesh of ref.json.meshes) {
  for (const p of mesh.primitives) {
    const v = readVec3(ref.json, ref.bin, p.attributes.POSITION);
    const idx = p.indices !== undefined ? readIndices(ref.json, ref.bin, p.indices) : Uint32Array.from({ length: v.length / 3 }, (_, i) => i);
    refEdges.push(...triEdges(v, idx));
  }
}
const refM = measure(refEdges, 'ref');

// --- 素体 ---
const vrm = readGlb(inPath);
const { json, bin } = vrm;
const matName = (p) => json.materials?.[p.material]?.name ?? '';
const faceMesh = json.meshes.find((m) => m.primitives.some((p) => /Face_00_SKIN/i.test(matName(p))));
if (!faceMesh) throw new Error('顔のメッシュ（Face_00_SKIN の材質）が見つからない');
const posAccessors = [...new Set(faceMesh.primitives.map((p) => p.attributes.POSITION))];
const positions = new Map(posAccessors.map((ai) => [ai, readVec3(json, bin, ai)]));
const skinEdges = [];
let eyeMinY = Infinity;
for (const p of faceMesh.primitives) {
  const pos = positions.get(p.attributes.POSITION);
  const idx = readIndices(json, bin, p.indices);
  if (/Face_00_SKIN/i.test(matName(p))) skinEdges.push(...triEdges(pos, idx));
  if (/Eye(Iris|White)|FaceEyeline/i.test(matName(p))) for (const i of idx) eyeMinY = Math.min(eyeMinY, pos[i * 3 + 1]);
}
const vrmM = measure(skinEdges, 'vrm');
const eyeBottomT = (eyeMinY - vrmM.chinY) / vrmM.H;

// 縮める比：高さ t ごとに「参照の幅 ÷ 素体の幅」。細くする方向だけ使い、目の下端に向けて 1 に戻す
const T_FULL = flag('--taper-start', 0.5); // この高さ（あご先 0・鼻先 1）までは全部。そこから目の下端へなだらかに戻す（急に戻すと頬に段ができる）
const T_ZERO = Math.max(T_FULL + 0.3, eyeBottomT - 0.02);
const T_MIN = 0.12; // あご先付近は幅が小さく比が不安定なので、この高さの値を使う
function rawScale(t) {
  if (t >= T_ZERO) return 1;
  const tc = Math.max(t, T_MIN);
  const ratio = Math.min(widthAt(refM, tc) / Math.max(widthAt(vrmM, tc), 1e-6), 1);
  return 1 + (ratio - 1) * STRENGTH * (1 - smoothstep(T_FULL, T_ZERO, t));
}
// 高さ方向になめらかにする
const STEP = 0.02;
const table = [];
for (let t = -0.5; t <= 3 + 1e-9; t += STEP) table.push(rawScale(t));
// 縮み方は下（エラ）ほど大きく、上へ単調に減らす。頬の真ん中だけ大きく縮めると頬がこけて見える
for (let i = table.length - 2; i >= 0; i--) table[i] = Math.min(table[i], table[i + 1]);
const smoothed = table.map((_, i) => {
  let s = 0, n = 0;
  for (let k = -6; k <= 6; k++) {
    const j = i + k;
    if (j >= 0 && j < table.length) {
      s += table[j];
      n++;
    }
  }
  return s / n;
});
const scaleAt = (t) => {
  const f = Math.min(Math.max((t + 0.5) / STEP, 0), smoothed.length - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, smoothed.length - 1);
  return smoothed[i] * (1 - (f - i)) + smoothed[j] * (f - i);
};

// 肌の縁（あごの下の首とのつなぎ目など）は動かさない。動かすと首の体のメッシュとずれて、あごの下に線が出る
const PIN_RADIUS = flag('--pin-radius', 0.35); // 縁からこの距離（あご〜鼻の高さに対する比）までで 0 から全部へ戻す
const edgeCount = new Map();
const keyOf = (p) => p.map((v) => Math.round(v * 1e5)).join(',');
for (const [a, b] of skinEdges) {
  const ka = keyOf(a), kb = keyOf(b);
  if (ka === kb) continue;
  const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  const e = edgeCount.get(key);
  if (e) e.n++;
  else edgeCount.set(key, { n: 1, a, b });
}
const rimPts = [];
for (const { n, a, b } of edgeCount.values()) {
  if (n !== 1) continue;
  for (const p of [a, b]) if ((p[1] - vrmM.chinY) / vrmM.H < T_ZERO + PIN_RADIUS) rimPts.push(p);
}
function rimWeight(p) {
  let d2 = Infinity;
  for (const q of rimPts) d2 = Math.min(d2, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
  return smoothstep(0, PIN_RADIUS * vrmM.H, Math.sqrt(d2));
}

// 頂点の移動：頬のふくらみごと寄せる（外側ほど大きく、中央の鼻・口はほぼ 0）。
// 輪郭の端だけを引っ込めると頬がこけて見えるので、内側からなだらかに効かせる
function contour(p) {
  const t = (p[1] - vrmM.chinY) / vrmM.H;
  const w = Math.max(widthAt(vrmM, Math.max(t, T_MIN)), 1e-6);
  const u = Math.abs(p[0]) / vrmM.H / w;
  const k = (scaleAt(t) - 1) * smoothstep(0.1, 1.0, u);
  if (k === 0) return p;
  return [p[0] * (1 + k * rimWeight(p)), p[1], p[2]];
}

// 耳：頭の横から張り出した分（付け根より外側）を EAR_SCALE 倍にして、正面から見た張り出しを小さくする。
// 耳は顔の肌の一部で、頬より奥（z が鼻先から後ろ）・目のあたりの高さにある。付け根より内側は動かさない
const EAR_SCALE = flag('--ear-scale', 1);
const EAR_ROOT = flag('--ear-root', 1.5); // 付け根の |x|（あご〜鼻の高さに対する比）
function ear(p) {
  if (EAR_SCALE === 1) return p;
  const t = (p[1] - vrmM.chinY) / vrmM.H;
  const z = p[2] / vrmM.H;
  const ax = Math.abs(p[0]) / vrmM.H;
  if (ax <= EAR_ROOT) return p;
  const wgt = smoothstep(-0.3, -0.5, z) * smoothstep(0.8, 1.0, t) * (1 - smoothstep(2.2, 2.4, t));
  const nx = EAR_ROOT + (ax - EAR_ROOT) * (1 + (EAR_SCALE - 1) * wgt);
  return [Math.sign(p[0]) * nx * vrmM.H, p[1], p[2]];
}

const deform = (p) => ear(contour(p));

if (REPORT || !outPath) {
  for (const m of [refM, vrmM]) console.log(`${m.label}: 鼻先 y=${m.noseY.toFixed(4)} z=${m.noseZ.toFixed(4)}  あご先 y=${m.chinY.toFixed(4)}  あご〜鼻 H=${m.H.toFixed(4)}  耳の除外 z<${m.zCut.toFixed(4)}`);
  console.log(`vrm: 目の下端 t=${eyeBottomT.toFixed(2)}  動かす範囲 t<${T_ZERO.toFixed(2)}`);
  console.log('   t   参照幅  素体幅  比   輪郭の縮み');
  for (let t = 0; t <= 2.4 + 1e-9; t += 0.1) {
    const r = widthAt(refM, t), v = widthAt(vrmM, t);
    console.log(`${t.toFixed(1).padStart(4)}  ${r.toFixed(3)}  ${v.toFixed(3)}  ${(r / v).toFixed(2)}  ${((scaleAt(t) - 1) * 100).toFixed(1)}%`);
  }
  if (!outPath) process.exit(0);
}

// --- 位置と法線を書き換える ---
const EPS = 1e-4;
let moved = 0, maxMove = 0;
function apply(ai, normalAi, fn) {
  const pos = readVec3(json, bin, ai);
  const n = normalAi !== undefined ? readVec3(json, bin, normalAi) : null;
  const out = new Float64Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const q = fn(p);
    out.set(q, i * 3);
    const d = Math.abs(q[0] - p[0]);
    if (d > 1e-6) moved++;
    maxMove = Math.max(maxMove, d);
    if (n && d > 1e-7) {
      // 法線は変形のヤコビアンの逆転置で回す（数値微分）
      const J = [0, 1, 2].map((k) => {
        const a = p.slice(), b = p.slice();
        a[k] += EPS;
        b[k] -= EPS;
        const qa = fn(a), qb = fn(b);
        return [0, 1, 2].map((r) => (qa[r] - qb[r]) / (2 * EPS)); // 列 k
      });
      // J は列ベクトルの並び。x' のみ変わるので J^{-T} n は n.x を J[0][0] で割り、y・z 成分から x 方向の傾きを引く形になる
      const jxx = J[0][0], jxy = J[1][0], jxz = J[2][0];
      const nx = n[i * 3] / jxx;
      const ny = n[i * 3 + 1] - jxy * nx;
      const nz = n[i * 3 + 2] - jxz * nx;
      const len = Math.hypot(nx, ny, nz) || 1;
      n[i * 3] = nx / len;
      n[i * 3 + 1] = ny / len;
      n[i * 3 + 2] = nz / len;
    }
  }
  writeVec3(json, bin, ai, out);
  const ac = json.accessors[ai];
  if (ac.min && ac.max) {
    for (let k = 0; k < 3; k++) {
      let mn = Infinity, mx = -Infinity;
      for (let i = k; i < out.length; i += 3) {
        mn = Math.min(mn, out[i]);
        mx = Math.max(mx, out[i]);
      }
      ac.min[k] = mn;
      ac.max[k] = mx;
    }
  }
  if (n) writeVec3(json, bin, normalAi, n);
}

const normalOf = (prims, ai) => prims.find((p) => p.attributes.POSITION === ai)?.attributes.NORMAL;
for (const ai of posAccessors) apply(ai, normalOf(faceMesh.primitives, ai), deform);

// 眼鏡（材質名に Glasses）：耳を寄せた分、蝶番より後ろのつるを内側へ傾けて、つるが耳の外に浮かないようにする
const glassPrims = json.meshes.flatMap((m) => (m === faceMesh ? [] : m.primitives.filter((p) => /Glasses/i.test(matName(p)))));
if (EAR_SCALE !== 1 && glassPrims.length) {
  const gAcc = [...new Set(glassPrims.map((p) => p.attributes.POSITION))];
  const gPts = gAcc.flatMap((ai) => {
    const v = readVec3(json, bin, ai);
    return Array.from({ length: v.length / 3 }, (_, i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]);
  });
  const maxAbsX = Math.max(...gPts.map((p) => Math.abs(p[0])));
  // 蝶番：レンズまわり（外側 6 割より内）で一番奥の z
  const zHinge = Math.min(...gPts.filter((p) => Math.abs(p[0]) < maxAbsX * 0.6).map((p) => p[2]));
  const ARM_RAMP = 0.03; // 蝶番からこの奥行きで傾け終える
  let push = 0;
  for (const p of gPts) if (p[2] < zHinge - ARM_RAMP) push = Math.max(push, Math.abs(p[0]) - Math.abs(ear(p)[0]));
  const glasses = (p) => [p[0] - Math.sign(p[0]) * push * smoothstep(zHinge, zHinge - ARM_RAMP, p[2]), p[1], p[2]];
  for (const ai of gAcc) apply(ai, normalOf(glassPrims, ai), glasses);
  console.log(`眼鏡：つるを ${(push * 1000).toFixed(1)} mm 内側へ`);
}
writeGlb(outPath, json, bin);
console.log(`${outPath}: ${moved} 頂点を動かした（最大 ${(maxMove * 1000).toFixed(1)} mm）`);
