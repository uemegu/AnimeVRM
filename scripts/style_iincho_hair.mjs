// 手で配置した委員長の Tripo 髪を、UV・MToon・揺れ付きの Hair メッシュへ変換する。
// node scripts/style_iincho_hair.mjs source.vrm hair-strands-gradient.png output.vrm [hair-braid.png]
// source.vrm は attach_vrm_node.mjs で接続した版（変換済みの版を入力しない）。
// 今回の元データ: assets/models/iincho/source/iincho-school-hair2-static.vrm
// テクスチャ: assets/models/iincho/textures/hair-strands-gradient.png（VRM 互換性のため PNG を埋め込む）
// 三つ編み: assets/models/iincho/textures/hair-braid.png（Tripo の編み目のテクスチャを髪色に塗り直したもの。
//   scripts/blender/recolor_hair_texture.py で作る）。指定すると三つ編みのパーツだけ元の UV でこれを貼る
import fs from 'node:fs';
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { nodeWorlds } from './sway_bones.mjs';

const [input, texturePath, output, braidTexturePath] = process.argv.slice(2);
if (!input || !texturePath || !output) throw new Error('source.vrm texture.png output.vrm [braid.png] を指定してください');
const BRAID_PART = 'tripo_part_0.001'; // 左のこめかみから後ろへ回る三つ編み
const file = fs.readFileSync(input);
const jsonLength = file.readUInt32LE(12);
const json = JSON.parse(file.subarray(20, 20 + jsonLength));
const bin = file.subarray(28 + jsonLength, 28 + jsonLength + file.readUInt32LE(20 + jsonLength));
const { world } = nodeWorlds(json);
const bones = json.extensions.VRMC_vrm.humanoid.humanBones;
const head = bones.head.node;
const hairNodes = json.nodes.flatMap((n, i) => n.name?.startsWith('tripo_part') && n.mesh !== undefined ? [i] : []);
if (hairNodes.length !== 62) throw new Error(`元の髪62パーツが必要です: ${hairNodes.length}`);
const rootIndex = json.nodes.findIndex((n) => n.children?.length === 62 && n.children.every((i) => hairNodes.includes(i)));
if (rootIndex < 0) throw new Error('髪のルートが見つかりません');
const floatTypes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function readAccessor(index) {
  const a = json.accessors[index], view = json.bufferViews[a.bufferView];
  const components = floatTypes[a.type], size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const read = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: components }, (_, c) => bin[read]((view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? components * size) + c * size)));
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const vertices = [], triangles = [], vertexMap = new Map();
for (const nodeIndex of hairNodes) {
  const node = json.nodes[nodeIndex], matrix = new Matrix4().fromArray(world[nodeIndex]);
  const normalMatrix = new Matrix3().getNormalMatrix(matrix);
  const isBraid = braidTexturePath && node.name === BRAID_PART;
  for (const primitive of json.meshes[node.mesh].primitives) {
    const positions = readAccessor(primitive.attributes.POSITION), normals = readAccessor(primitive.attributes.NORMAL);
    const uvs = isBraid ? readAccessor(primitive.attributes.TEXCOORD_0) : null;
    const remap = positions.map((position, i) => {
      const p = new Vector3().fromArray(position).applyMatrix4(matrix).toArray();
      const n = new Vector3().fromArray(normals[i]).applyNormalMatrix(normalMatrix).toArray();
      // 三つ編みは元の UV を使うので、UV の継ぎ目で分かれた頂点はまとめない
      const key = [...p.map((x) => Math.round(x * 1e6)), ...n.map((x) => Math.round(x * 1e3)), ...(uvs ? ['b', ...uvs[i].map((x) => Math.round(x * 1e5))] : [])].join(',');
      if (!vertexMap.has(key)) { vertexMap.set(key, vertices.length); vertices.push(uvs ? { p, n, braidUv: uvs[i] } : { p, n }); }
      return vertexMap.get(key);
    });
    const indices = readAccessor(primitive.indices).flat();
    for (let i = 0; i < indices.length; i += 3) triangles.push(indices.slice(i, i + 3).map((j) => remap[j]));
  }
}

// 長い三角形を分割し、毛先までなめらかに骨で曲がる密度にする。面を削らない。
const midpointCache = new Map(), refined = [];
function midpoint(a, b) {
  const key = a < b ? `${a},${b}` : `${b},${a}`;
  if (!midpointCache.has(key)) {
    const va = vertices[a], vb = vertices[b];
    const n = new Vector3().fromArray(va.n).add(new Vector3().fromArray(vb.n)).normalize().toArray();
    midpointCache.set(key, vertices.length);
    const braidUv = va.braidUv && vb.braidUv ? va.braidUv.map((v, k) => (v + vb.braidUv[k]) * 0.5) : undefined;
    vertices.push({ p: va.p.map((v, k) => (v + vb.p[k]) * 0.5), n, ...(braidUv ? { braidUv } : {}) });
  }
  return midpointCache.get(key);
}
function subdivide(a, b, c) {
  const pairs = [[a, b, c], [b, c, a], [c, a, b]];
  const lengths = pairs.map(([i, j]) => vertices[i].p.reduce((s, v, k) => s + (v - vertices[j].p[k]) ** 2, 0));
  const longest = lengths.indexOf(Math.max(...lengths));
  if (lengths[longest] <= 0.024 ** 2) { refined.push([a, b, c]); return; }
  const [i, j, k] = pairs[longest], m = midpoint(i, j);
  subdivide(i, m, k); subdivide(m, j, k);
}
triangles.forEach((t) => subdivide(...t));

// 襟足から毛先へ滑らかに幅を絞る。前髪・編み込みは保つ。
const backAngle = ([x, , z]) => Math.atan2(x, -(z + 0.025));
const angles = Array.from({ length: 9 }, (_, i) => -1.55 + i * 3.1 / 8);
const anchors = angles.map((a) => [Math.sin(a) * 0.13, -0.025 - Math.cos(a) * 0.13]);
function straighten(p) {
  const [x, y, z] = p;
  const strength = smooth(1.39, 1.10, y) * smooth(-0.035, -0.085, z);
  if (strength === 0) return [...p];
  const q = [x * (1 - 0.34 * strength), y, z + 0.045 * strength];
  // 胴との隙間は襟足から徐々に作る。高さで一斉に押すと髪に横向きの段ができる。
  const clearance = -0.025 - 0.106 * Math.sqrt(Math.max(0, 1 - (q[0] / 0.19) ** 2));
  const depth = q[2] - clearance;
  const push = (depth + Math.sqrt(depth * depth + 0.004 ** 2)) * 0.5;
  q[2] -= push * smooth(1.39, 1.21, y) * smooth(-0.035, -0.085, z);
  return q;
}
for (const v of vertices) {
  v.original = [...v.p];
  const epsilon = 0.0001;
  const columns = [0, 1, 2].map((k) => {
    const a = [...v.p], b = [...v.p]; a[k] += epsilon; b[k] -= epsilon;
    const pa = straighten(a), pb = straighten(b); return pa.map((x, j) => (x - pb[j]) / (2 * epsilon));
  });
  const jacobian = new Matrix3().set(...[0, 1, 2].flatMap((k) => columns.map((c) => c[k])));
  v.n = new Vector3().fromArray(v.n).applyMatrix3(jacobian.invert().transpose()).normalize().toArray();
  v.p = straighten(v.p);
  // Tripo の細片ごとの法線を、頭頂と髪の外周に沿う滑らかな法線へ寄せる。
  const [x, y, z] = v.p, crown = smooth(1.35, 1.49, y);
  const radial = new Vector3(x / 0.13 ** 2, Math.max(0, y - 1.43) / 0.14 ** 2 * crown, (z + 0.025) / 0.12 ** 2).normalize();
  const detail = new Vector3().fromArray(v.n);
  if (detail.dot(radial) < 0) detail.negate();
  v.n = radial.multiplyScalar(0.9).addScaledVector(detail, 0.1).normalize().toArray();
}
// 顔の横の毛束が頬・こめかみに刺さらないよう、顔の肌の表面から CLEARANCE だけ外へ出す。
// 押した量は近くの頂点へなめらかに広げる（押した頂点だけ動かすと毛束が折れる）。
const CLEARANCE = 0.004, SPREAD = 0.03;
const isNearFace = ([, y, z]) => y > 1.33 && y < 1.52 && z > -0.035;
const faceTriangles = [];
json.nodes.forEach((node, nodeIndex) => {
  if (node.mesh === undefined || !json.meshes[node.mesh].primitives.some((p) => /Face_00_SKIN/.test(json.materials[p.material]?.name ?? ''))) return;
  const matrix = new Matrix4().fromArray(world[nodeIndex]);
  for (const primitive of json.meshes[node.mesh].primitives) {
    if (!/Face_00_SKIN/.test(json.materials[primitive.material]?.name ?? '')) continue;
    const positions = readAccessor(primitive.attributes.POSITION).map((p) => new Vector3().fromArray(p).applyMatrix4(matrix));
    const indices = readAccessor(primitive.indices).flat();
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3).map((j) => positions[j]);
      if (![a, b, c].some((p) => p.y > 1.3 && p.y < 1.55 && p.z > -0.06)) continue;
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (normal.lengthSq() < 1e-14) continue;
      // 頭の外を向いた面だけ使う（内側を向いた面で、外にある髪を「中」と誤って判定しないように）
      const center = a.clone().add(b).add(c).divideScalar(3);
      const outward = new Vector3(center.x, center.y - 1.43, center.z + 0.025).normalize();
      if (normal.normalize().dot(outward) < 0.2) continue;
      faceTriangles.push({ a, b, c, normal });
    }
  }
});
function closestOnTriangle(p, { a, b, c }) {
  // Ericson『Real-Time Collision Detection』の三角形上の最近点
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return a.clone();
  const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return b.clone();
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return a.clone().addScaledVector(ab, d1 / (d1 - d3));
  const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return c.clone();
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return a.clone().addScaledVector(ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return b.clone().addScaledVector(c.clone().sub(b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
  const denom = 1 / (va + vb + vc);
  return a.clone().addScaledVector(ab, vb * denom).addScaledVector(ac, vc * denom);
}
const pushes = [];
for (const v of vertices) {
  if (!isNearFace(v.p)) continue;
  const p = new Vector3().fromArray(v.p);
  let best = null, bestDistance = Infinity;
  for (const tri of faceTriangles) {
    const q = closestOnTriangle(p, tri), distance = q.distanceTo(p);
    if (distance < bestDistance) { bestDistance = distance; best = { q, tri }; }
  }
  if (!best || bestDistance > 0.06) continue;
  const signed = p.clone().sub(best.q).dot(best.tri.normal);
  if (signed < CLEARANCE) pushes.push({ p, d: best.tri.normal.clone().multiplyScalar(CLEARANCE - signed) });
}
if (pushes.length) {
  for (const v of vertices) {
    if (!isNearFace(v.p)) continue;
    const p = new Vector3().fromArray(v.p);
    let move = null, size = 0;
    for (const push of pushes) {
      const d = push.d.clone().multiplyScalar(smooth(SPREAD, 0, push.p.distanceTo(p)));
      if (d.length() > size) { size = d.length(); move = d; }
    }
    if (move) v.p = p.add(move).toArray();
  }
}
console.error(`顔に刺さる毛束の頂点: ${pushes.length}（最大 ${(Math.max(0, ...pushes.map((x) => x.d.length())) * 1000).toFixed(1)} mm 外へ）`);

// 薄い毛束の面を外向きにそろえ、両面描画で法線が三角形ごとに反転するのを防ぐ。
for (const tri of refined) {
  const [a, b, c] = tri.map((i) => new Vector3().fromArray(vertices[i].p));
  const normal = b.clone().sub(a).cross(c.clone().sub(a));
  const average = tri.reduce((sum, i) => sum.add(new Vector3().fromArray(vertices[i].n)), new Vector3());
  if (normal.dot(average) < 0) [tri[1], tri[2]] = [tri[2], tri[1]];
}

const chunks = [bin]; let byteLength = bin.length;
function addView(bytes, target) {
  const padding = (4 - byteLength % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding; }
  const view = { buffer: 0, byteOffset: byteLength, byteLength: bytes.length, ...(target ? { target } : {}) };
  chunks.push(bytes); byteLength += bytes.length; json.bufferViews.push(view); return json.bufferViews.length - 1;
}
function addAccessor(values, type, componentType = 5126, target = 34962) {
  const array = componentType === 5126 ? new Float32Array(values) : componentType === 5123 ? new Uint16Array(values) : new Uint32Array(values);
  const a = { bufferView: addView(Buffer.from(array.buffer), target), componentType, count: values.length / floatTypes[type], type };
  if (type === 'VEC3') {
    a.min = [0, 1, 2].map((k) => values.filter((_, i) => i % 3 === k).reduce((m, v) => Math.min(m, v), Infinity));
    a.max = [0, 1, 2].map((k) => values.filter((_, i) => i % 3 === k).reduce((m, v) => Math.max(m, v), -Infinity));
  }
  json.accessors.push(a); return json.accessors.length - 1;
}
const sb = json.extensions.VRMC_springBone;
const colliderIndices = [];
function collider(bone, start, end, radius) {
  const inverse = new Matrix4().fromArray(world[bone]).invert();
  const local = (p) => new Vector3().fromArray(p).applyMatrix4(inverse).toArray();
  sb.colliders.push({ node: bone, shape: end ? { capsule: { offset: local(start), tail: local(end), radius } } : { sphere: { offset: local(start), radius } } });
  colliderIndices.push(sb.colliders.length - 1);
}
collider(head, [0, 1.464, -0.025], null, 0.078);
collider(bones.upperChest.node, [0, 1.08, -0.025], [0, 1.275, -0.025], 0.096);
collider(bones.upperChest.node, [-0.145, 1.265, -0.012], [-0.205, 1.245, -0.012], 0.055);
collider(bones.upperChest.node, [0.145, 1.265, -0.012], [0.205, 1.245, -0.012], 0.055);
collider(bones.neck.node, [0, 1.29, -0.025], [0, 1.395, -0.025], 0.043);
sb.colliderGroups.push({ name: 'Hair_Body', colliders: colliderIndices });
const colliderGroup = sb.colliderGroups.length - 1;
const skinJoints = [head], inverseBinds = [new Matrix4().fromArray(world[head]).invert().elements];
const chains = [];
function chain(name, points, stiffness, gravity, hitRadius) {
  const nodes = [], joints = []; let parent = head;
  for (let i = 0; i < points.length; i++) {
    const local = new Vector3().fromArray(points[i]).applyMatrix4(new Matrix4().fromArray(world[parent]).invert()).toArray();
    const index = json.nodes.length;
    json.nodes.push({ name: `J_Sec_Hair_${name}_${i}`, translation: local });
    (json.nodes[parent].children ??= []).push(index);
    world[index] = new Matrix4().fromArray(world[parent]).multiply(new Matrix4().makeTranslation(...local)).elements;
    nodes.push(index); joints.push(skinJoints.length); skinJoints.push(index);
    inverseBinds.push(new Matrix4().fromArray(world[index]).invert().elements); parent = index;
  }
  sb.springs.push({ name: `Hair_${name}`, center: bones.hips.node, colliderGroups: [colliderGroup], joints: nodes.map((node, i) => ({ node, stiffness: stiffness[Math.min(i, stiffness.length - 1)], gravityPower: gravity, gravityDir: [0, -1, 0], dragForce: 0.55, hitRadius })) });
  const c = { name, points, joints }; chains.push(c); return c;
}
const backChains = angles.map((angle, i) => {
  const [x, z] = anchors[i];
  return chain(`Back_${i}`, Array.from({ length: 6 }, (_, j) => [x, 1.38 - j * 0.073, Math.min(z, -0.025 - 0.106 * Math.sqrt(Math.max(0, 1 - (x / 0.19) ** 2)))]), [0.75, 0.55, 0.4, 0.3, 0.22], 0.85, 0.006);
});
const sideChains = [-1, 1].map((s) => chain(s < 0 ? 'Side_R' : 'Side_L', Array.from({ length: 4 }, (_, j) => [s * 0.092, 1.425 - j * 0.09, 0.022]), [1.5, 0.9, 0.6], 0.5, 0.004));
const bangChains = [-1, 0, 1].map((s) => chain(`Bangs_${s + 1}`, Array.from({ length: 3 }, (_, j) => [s * 0.04, 1.50 - j * 0.06, 0.063 + j * 0.006]), [3.5, 2.5], 0.15, 0.002));
function addChainWeights(map, c, y, weight) {
  const segment = c.points[0][1] - c.points[1][1];
  const t = clamp((c.points[0][1] - y) / segment, 0, c.joints.length - 2);
  const i = Math.min(c.joints.length - 3, Math.floor(t)), u = t - i;
  for (const [j, w] of [[i, 1 - u], [i + 1, u]]) map.set(c.joints[j], (map.get(c.joints[j]) ?? 0) + w * weight);
}
for (const v of vertices) {
  const [x, y, z] = v.p, back = smooth(-0.035, -0.075, v.original[2]) * smooth(1.405, 1.35, y);
  const weights = new Map();
  if (back > 0) {
    const angle = backAngle(v.original), a = clamp((angle - angles[0]) / (angles[1] - angles[0]), 0, angles.length - 1);
    const i = Math.min(angles.length - 2, Math.floor(a));
    addChainWeights(weights, backChains[i], y, back * (1 - (a - i)));
    addChainWeights(weights, backChains[i + 1], y, back * (a - i));
  }
  const side = (1 - back) * smooth(0.055, 0.085, Math.abs(x)) * smooth(-0.065, -0.005, z) * smooth(1.455, 1.40, y);
  if (side > 0) addChainWeights(weights, sideChains[x < 0 ? 0 : 1], y, side);
  const bangs = (1 - back - side) * smooth(0.025, 0.065, z) * smooth(0.085, 0.055, Math.abs(x)) * smooth(1.49, 1.43, y);
  if (bangs > 0) addChainWeights(weights, bangChains[clamp(Math.round(x / 0.04) + 1, 0, 2)], y, bangs);
  weights.set(0, Math.max(0, 1 - back - side - bangs));
  const best = [...weights].filter(([, w]) => w > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4), total = best.reduce((sum, [, w]) => sum + w, 0);
  v.joints = Array.from({ length: 4 }, (_, i) => best[i]?.[0] ?? 0);
  v.weights = Array.from({ length: 4 }, (_, i) => (best[i]?.[1] ?? 0) / total);
}

// 球面の経線に沿った UV。後頭部の継ぎ目は頂点を複製してテクスチャの折り返しを避ける。
function hairTextureV(p) {
  const frontAngle = Math.abs(Math.atan2(p[0], p[2] + 0.025));
  const fringe = 1 - smooth(0.65, 1.15, frontAngle);
  const side = 1 - smooth(1.25, 1.85, frontAngle);
  const tipHeight = 1.03 + 0.14 * side + 0.215 * fringe;
  return clamp((1.575 - p[1]) / (1.575 - tipHeight));
}
// 髪の内側（一番外の層より奥にある面）を頂点カラーで暗くする。頭の中心（頭頂より下は縦の軸）から見た向きごとに
// 一番外の髪までの距離を測り、それより奥にある頂点ほど暗くする。顔の横や襟足から見える毛束の裏側も暗くなる。
const INNER_DARK = 0.4;
const shellCoord = (p) => {
  const cy = Math.min(p[1], 1.43), dx = p[0], dy = p[1] - cy, dz = p[2] + 0.025, r = Math.hypot(dx, dy, dz);
  const az = Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * 72) % 72;
  const h = Math.floor((p[1] > 1.43 ? 1.43 + Math.asin(clamp(dy / Math.max(r, 1e-6))) * 0.14 : p[1]) / 0.01);
  return { az, h, r };
};
const outer = new Map();
for (const v of vertices) {
  const { az, h, r } = shellCoord(v.p), key = `${az},${h}`;
  outer.set(key, Math.max(outer.get(key) ?? 0, r));
}
for (const v of vertices) {
  const { az, h, r } = shellCoord(v.p);
  let rOuter = r;
  for (let da = -1; da <= 1; da++) for (let dh = -1; dh <= 1; dh++) rOuter = Math.max(rOuter, outer.get(`${(az + da + 72) % 72},${h + dh}`) ?? 0);
  const shade = 1 - INNER_DARK * smooth(0.005, 0.018, rOuter - r); // 浅い重なりは暗くしない（外側にまだらが出る）
  v.color = [shade, shade, shade];
}

const outputVertices = [], outputIndices = [], braidIndices = [], uvVertexMap = new Map();
for (const tri of refined) {
  if (vertices[tri[0]].braidUv) {
    for (const index of tri) {
      const key = `${index}:b`;
      if (!uvVertexMap.has(key)) { uvVertexMap.set(key, outputVertices.length); outputVertices.push({ ...vertices[index], uv: vertices[index].braidUv }); }
      braidIndices.push(uvVertexMap.get(key));
    }
    continue;
  }
  const rawU = tri.map((i) => Math.atan2(vertices[i].original[0], vertices[i].original[2] + 0.025) / (2 * Math.PI) + 0.5);
  const seam = Math.max(...rawU) - Math.min(...rawU) > 0.5;
  tri.forEach((index, k) => {
    const wrap = seam && rawU[k] < 0.5 ? 1 : 0, key = `${index}:${wrap}`;
    if (!uvVertexMap.has(key)) {
      const v = vertices[index], p = v.original;
      // 縦方向は根元→毛先の1回だけ。前髪・横髪・後ろ髪の長さに合わせ、
      // 頭頂と毛先が暗く、中ほどが明るいテクスチャを各毛束へ対応させる。
      const vCoord = hairTextureV(p);
      uvVertexMap.set(key, outputVertices.length); outputVertices.push({ ...v, uv: [(rawU[k] + wrap) * 3, vCoord] });
    }
    outputIndices.push(uvVertexMap.get(key));
  });
}
const attributes = {
  POSITION: addAccessor(outputVertices.flatMap((v) => v.p), 'VEC3'),
  NORMAL: addAccessor(outputVertices.flatMap((v) => v.n), 'VEC3'),
  TEXCOORD_0: addAccessor(outputVertices.flatMap((v) => v.uv), 'VEC2'),
  JOINTS_0: addAccessor(outputVertices.flatMap((v) => v.joints), 'VEC4', 5123),
  WEIGHTS_0: addAccessor(outputVertices.flatMap((v) => v.weights), 'VEC4'),
  COLOR_0: addAccessor(outputVertices.flatMap((v) => v.color), 'VEC3'),
};
const indices = addAccessor(outputIndices, 'SCALAR', outputVertices.length > 65535 ? 5125 : 5123, 34963);
const skin = json.skins.length;
json.skins.push({ name: 'Hair_Skin', skeleton: head, joints: skinJoints, inverseBindMatrices: addAccessor(inverseBinds.flat(), 'MAT4', 5126, 0) });
const imageIndex = json.images.length;
json.images.push({ name: 'Hair_Strand_Albedo', mimeType: 'image/png', bufferView: addView(fs.readFileSync(texturePath)) });
const sampler = json.samplers.length;
json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 });
const texture = json.textures.length;
json.textures.push({ name: 'Hair_Albedo', sampler, source: imageIndex });
const material = json.materials.length;
json.materials.push({
  name: 'Hair_MToon', doubleSided: true, alphaMode: 'OPAQUE',
  // 縦に長い後ろ髪は、硬いトゥーンの境界が斜めの色帯に見えるため広めにぼかす。
  extras: { hairRing: true, hairRingStrength: 0.25, hairCrownJitter: 0.008, hairShadeStrength: 0.35, hairMaxToony: 0.25, bakedShading: false, useVertexColor: true },
  pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], baseColorTexture: { index: texture }, metallicFactor: 0, roughnessFactor: 0.9 },
  extensions: {
    VRMC_materials_mtoon: {
      specVersion: '1.0', transparentWithZWrite: false, renderQueueOffsetNumber: 0,
      shadeColorFactor: [0.7, 0.61, 0.75], shadeMultiplyTexture: { index: texture },
      shadingShiftFactor: -0.05, shadingToonyFactor: 0.25, giEqualizationFactor: 0.9,
      parametricRimColorFactor: [0, 0, 0], parametricRimFresnelPowerFactor: 5, parametricRimLiftFactor: 0,
      outlineWidthMode: 'worldCoordinates', outlineWidthFactor: 0.001,
      outlineColorFactor: [0.018, 0.012, 0.02], outlineLightingMixFactor: 1,
    },
  },
});
const primitives = [{ attributes, indices, material, mode: 4 }];
if (braidIndices.length) {
  // 三つ編み：同じ材質の設定で、テクスチャだけ編み目のものにする（UV は Tripo の元のまま）
  const braidImage = json.images.length;
  json.images.push({ name: 'Hair_Braid_Albedo', mimeType: 'image/png', bufferView: addView(fs.readFileSync(braidTexturePath)) });
  const braidSampler = json.samplers.length;
  json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 });
  const braidTexture = json.textures.length;
  json.textures.push({ name: 'Hair_Braid', sampler: braidSampler, source: braidImage });
  const braidMaterial = structuredClone(json.materials[material]);
  braidMaterial.name = 'Hair_Braid_MToon';
  braidMaterial.pbrMetallicRoughness.baseColorTexture = { index: braidTexture };
  braidMaterial.extensions.VRMC_materials_mtoon.shadeMultiplyTexture = { index: braidTexture };
  braidMaterial.extras = { ...braidMaterial.extras, hairRing: false };
  json.materials.push(braidMaterial);
  primitives.push({ attributes, indices: addAccessor(braidIndices, 'SCALAR', outputVertices.length > 65535 ? 5125 : 5123, 34963), material: json.materials.length - 1, mode: 4 });
}
json.meshes.push({ name: 'Hair', primitives });
for (const node of json.nodes) if (node.children) node.children = node.children.filter((i) => i !== rootIndex);
for (const scene of json.scenes) scene.nodes = scene.nodes.filter((i) => i !== rootIndex);
json.nodes[rootIndex] = { name: 'Hair', mesh: json.meshes.length - 1, skin };
json.scenes[json.scene ?? 0].nodes.push(rootIndex);
// 地毛にも同じテクスチャと色係数を使う。根元の高さに合わせて同じ濃さを読む。
const hairMaterial = json.materials[material];
for (const [materialIndex, mat] of json.materials.entries()) if (/HairBack/.test(mat.name ?? '')) {
  mat.alphaMode = 'OPAQUE'; delete mat.alphaCutoff; delete mat.normalTexture; delete mat.emissiveTexture;
  mat.emissiveFactor = [0, 0, 0];
  mat.pbrMetallicRoughness = structuredClone(hairMaterial.pbrMetallicRoughness);
  mat.extensions = structuredClone(hairMaterial.extensions);
  mat.extras = structuredClone(hairMaterial.extras);
  mat.extensions.VRMC_materials_mtoon.outlineWidthMode = 'none';
  mat.extensions.VRMC_materials_mtoon.outlineWidthFactor = 0;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    if (primitive.material !== materialIndex) continue;
    const positions = readAccessor(primitive.attributes.POSITION);
    // 横方向は同じ色の列を使い、頭皮の UV 継ぎ目に細かい模様が集まるのを避ける。
    primitive.attributes.TEXCOORD_0 = addAccessor(positions.flatMap((p) => [0.5, hairTextureV(p)]), 'VEC2');
  }
}
json.buffers[0].byteLength = byteLength;
const jsonBytes = Buffer.from(JSON.stringify(json)), jsonPad = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 0x20); jsonBytes.copy(jsonPad);
const binary = Buffer.concat(chunks), binPad = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(binPad);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPad.length + binPad.length, 8); header.writeUInt32LE(jsonPad.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binPad.length); binHeader.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(output, Buffer.concat([header, jsonPad, binHeader, binPad]));
console.log(JSON.stringify({ output, vertices: outputVertices.length, triangles: refined.length, chains: chains.length, hairJoints: skinJoints.length, sourceParts: hairNodes.length }, null, 2));
