// fit_tripo_clothing.py で合わせた服を、素体の VRM にまとめて 1 つの VRM にする。
//
//   node scripts/merge_tripo_clothing.mjs scripts/outfits/peplum_shorts.json
//
// - 服ごとの GLB（骨付き）のメッシュを素体のスキンにつなぎ、MToon のマテリアルを付けて足す
// - 服に隠れる素体の面（body_hidden_vertices.json の頂点だけでできた三角形）を消す
// VRM の拡張（VRMC_vrm・SpringBone・MToon）は JSON をそのまま残すので失われない。
import fs from 'node:fs';
import path from 'node:path';
import { addDangles, addSway } from './sway_bones.mjs';

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outPath = cfg.output_vrm;

function readGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const binStart = 20 + jsonLen + 8;
  return { json, bin: buf.subarray(binStart, binStart + binLen) };
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

const COMPONENT_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

// アクセサの中身を、要素ごとに詰めたバイト列で取り出す
function readAccessorBytes(gltf, accIdx) {
  const acc = gltf.json.accessors[accIdx];
  const bv = gltf.json.bufferViews[acc.bufferView];
  const elem = COMPONENT_SIZE[acc.componentType] * TYPE_COUNT[acc.type];
  const stride = bv.byteStride || elem;
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = Buffer.alloc(acc.count * elem);
  for (let i = 0; i < acc.count; i++) gltf.bin.copy(out, i * elem, start + i * stride, start + i * stride + elem);
  return { acc, bytes: out };
}

function readIndices(gltf, accIdx) {
  const { acc, bytes } = readAccessorBytes(gltf, accIdx);
  const out = new Uint32Array(acc.count);
  for (let i = 0; i < acc.count; i++) {
    out[i] = acc.componentType === 5125 ? bytes.readUInt32LE(i * 4)
      : acc.componentType === 5123 ? bytes.readUInt16LE(i * 2) : bytes.readUInt8(i);
  }
  return out;
}

const vrm = readGlb(cfg.body);
const binChunks = [vrm.bin];
let byteLength = vrm.bin.length;

function appendBufferView(bytes, target) {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) {
    binChunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const view = { buffer: 0, byteOffset: byteLength, byteLength: bytes.length };
  if (target) view.target = target;
  binChunks.push(Buffer.from(bytes));
  byteLength += bytes.length;
  vrm.json.bufferViews.push(view);
  return vrm.json.bufferViews.length - 1;
}

function appendAccessor(bytes, template, target) {
  const acc = { bufferView: appendBufferView(bytes, target), componentType: template.componentType, count: template.count, type: template.type };
  if (template.min) acc.min = template.min;
  if (template.max) acc.max = template.max;
  if (template.normalized) acc.normalized = true;
  vrm.json.accessors.push(acc);
  return vrm.json.accessors.length - 1;
}

function indexAccessor(indices, count) {
  const big = count > 65535;
  const bytes = Buffer.alloc(indices.length * (big ? 4 : 2));
  indices.forEach((v, i) => (big ? bytes.writeUInt32LE(v, i * 4) : bytes.writeUInt16LE(v, i * 2)));
  return appendAccessor(bytes, { componentType: big ? 5125 : 5123, count: indices.length, type: 'SCALAR' }, 34963);
}

// --- 服に隠れる素体の面を消す ---
const key = (x, y, z) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
const hiddenJson = JSON.parse(fs.readFileSync(path.join(cfg.work_dir, 'body_hidden_vertices.json'), 'utf8'));
const hiddenKeys = new Set(hiddenJson.positions.map(([x, y, z]) => key(x, y, z)));

const bodyMesh = vrm.json.meshes.find((m) => m.name.startsWith('Body'));
// 全部が服の下に入る素体のインナーは、メッシュごと外す
const removeMaterials = new Set(hiddenJson.remove_materials ?? []);
const strip = (cfg.strip_body_materials ?? []).map((k) => k.toLowerCase());
bodyMesh.primitives = bodyMesh.primitives.filter((p) => {
  const name = vrm.json.materials[p.material]?.name ?? '';
  return !removeMaterials.has(name) && !strip.some((k) => name.toLowerCase().includes(k));
});
const KEEP_MATERIALS = /hair|shoes/i;
const positionCache = new Map();
let matched = 0;
for (const prim of bodyMesh.primitives) {
  const matName = vrm.json.materials[prim.material]?.name ?? '';
  if (KEEP_MATERIALS.test(matName)) continue;
  let hidden = positionCache.get(prim.attributes.POSITION);
  if (!hidden) {
    const { acc, bytes } = readAccessorBytes(vrm, prim.attributes.POSITION);
    hidden = new Uint8Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      hidden[i] = hiddenKeys.has(key(bytes.readFloatLE(i * 12), bytes.readFloatLE(i * 12 + 4), bytes.readFloatLE(i * 12 + 8))) ? 1 : 0;
    }
    matched = hidden.reduce((a, b) => a + b, 0);
    positionCache.set(prim.attributes.POSITION, hidden);
  }
  const ind = readIndices(vrm, prim.indices);
  const kept = [];
  for (let i = 0; i < ind.length; i += 3) {
    if (hidden[ind[i]] && hidden[ind[i + 1]] && hidden[ind[i + 2]]) continue;
    kept.push(ind[i], ind[i + 1], ind[i + 2]);
  }
  prim.indices = indexAccessor(kept, vrm.json.accessors[prim.attributes.POSITION].count);
  console.log(`[素体 ${matName}] 三角形 ${ind.length / 3} → ${kept.length / 3}`);
}
console.log(`隠す頂点 ${hiddenKeys.size} 件のうち素体と一致 ${matched}`);

// 元の Hair001 は髪型ごと残すと後ろや前髪にはみ出す。シーンからは外し、体の HairBack だけ赤く残す。
const hairSpec = cfg.garments.find((g) => g.kind === 'hair');
if (hairSpec) {
  const scene = vrm.json.scenes[0];
  const hairNodes = scene.nodes.filter((n) => vrm.json.meshes[vrm.json.nodes[n].mesh]?.name?.startsWith('Hair'));
  scene.nodes = scene.nodes.filter((n) => !hairNodes.includes(n));
  // 地毛は毛束の奥に見えるので、毛の色より暗い影の色にする（明るいと毛束の隙間にまだらに浮く）
  const base = hairSpec.cap_color ?? (hairSpec.base_color ?? [0.3, 0.04, 0.06]).map((c) => c * 0.45);
  for (const p of bodyMesh.primitives) {
    const mat = vrm.json.materials[p.material];
    if (!/hairback/i.test(mat?.name ?? '')) continue;
    // テクスチャは灰色で、しかも半分が透明。色を赤にしても隙間から空が透ける。
    // テクスチャを外して不透明な赤にすると、毛束の隙間は地毛に見える。
    mat.alphaMode = 'OPAQUE';
    delete mat.alphaCutoff;
    mat.doubleSided = true;
    mat.emissiveFactor = [0, 0, 0];
    delete mat.emissiveTexture;
    delete mat.normalTexture;
    delete mat.extensions?.KHR_materials_unlit;
    mat.pbrMetallicRoughness.baseColorFactor = [...base, 1];
    delete mat.pbrMetallicRoughness.baseColorTexture;
    const mtoon = mat.extensions?.VRMC_materials_mtoon;
    if (mtoon) {
      mtoon.shadeColorFactor = base.map((c) => c * 0.85);
      delete mtoon.shadeMultiplyTexture;
      mtoon.outlineWidthMode = 'none';
      mtoon.outlineWidthFactor = 0;
    }
  }
  console.log(`元の髪を外した（メッシュ ${hairNodes.length}）。HairBack を不透明な赤 ${base.join(', ')} にした`);
}

// --- 服を足す ---
const skin = vrm.json.skins[0];
const jointByName = new Map(skin.joints.map((node, j) => [vrm.json.nodes[node].name, j]));

// 髪の内側の層（fit_tripo_clothing.py が <名前>Inner1.glb, Inner2.glb … に書き出す）は、髪のすぐ後に暗い色で足す
// 外側の層ほど明るく、奥の層ほど暗くする
const layers = cfg.garments.flatMap((g) => {
  if (g.kind !== 'hair' || g.inner_layer === false) return [g];
  const inner = [];
  for (let k = 1; fs.existsSync(path.join(cfg.work_dir, `${g.name}Inner${k}.glb`)); k++) {
    inner.push({ ...g, name: `${g.name}Inner${k}`, color_scale: (g.inner_color_scale ?? 0.6) ** k });
  }
  return [g, ...inner];
});
const swayCtx = { json: vrm.json, skinJointCount: skin.joints.length, newJoints: [], springs: [] };
for (const spec of layers) {
  const cloth = readGlb(path.join(cfg.work_dir, `${spec.name}.glb`));
  const cSkin = cloth.json.skins[0];
  const remap = cSkin.joints.map((node) => {
    const name = cloth.json.nodes[node].name;
    const j = jointByName.get(name);
    if (j === undefined) throw new Error(`${spec.name}: 骨 ${name} が素体にない`);
    return j;
  });
  const meshNode = cloth.json.nodes.find((n) => n.mesh !== undefined);
  const primitives = [];
  for (const cPrim of cloth.json.meshes[meshNode.mesh].primitives) {
    const attributes = {};
    // 骨とウェイトは素体のスキンの番号に直してから、垂れる部分に揺れの骨を足す
    const { acc: jAcc, bytes: jBytes } = readAccessorBytes(cloth, cPrim.attributes.JOINTS_0);
    const joints = new Uint16Array(jAcc.count * 4);
    for (let i = 0; i < jAcc.count * 4; i++) {
      joints[i] = remap[jAcc.componentType === 5121 ? jBytes.readUInt8(i) : jBytes.readUInt16LE(i * 2)];
    }
    const { acc: wAcc, bytes: wBytes } = readAccessorBytes(cloth, cPrim.attributes.WEIGHTS_0);
    const wScale = wAcc.componentType === 5126 ? 1 : wAcc.componentType === 5121 ? 1 / 255 : 1 / 65535;
    const weights = new Float32Array(wAcc.count * 4);
    for (let i = 0; i < wAcc.count * 4; i++) {
      weights[i] = wAcc.componentType === 5126 ? wBytes.readFloatLE(i * 4)
        : (wAcc.componentType === 5121 ? wBytes.readUInt8(i) : wBytes.readUInt16LE(i * 2)) * wScale;
    }
    const { bytes: pBytes } = readAccessorBytes(cloth, cPrim.attributes.POSITION);
    const positions = new Float32Array(pBytes.buffer.slice(pBytes.byteOffset, pBytes.byteOffset + pBytes.length));
    addSway(swayCtx, spec, positions, joints, weights);
    addDangles(swayCtx, spec, positions, readIndices(cloth, cPrim.indices), joints, weights);
    for (const [name, accIdx] of Object.entries(cPrim.attributes)) {
      const { acc, bytes } = readAccessorBytes(cloth, accIdx);
      if (name === 'JOINTS_0') {
        const out = Buffer.from(joints.buffer);
        attributes[name] = appendAccessor(out, { ...acc, componentType: 5123 }, 34962);
      } else if (name === 'WEIGHTS_0') {
        attributes[name] = appendAccessor(Buffer.from(weights.buffer), { ...acc, componentType: 5126, normalized: false }, 34962);
      } else {
        attributes[name] = appendAccessor(bytes, acc, 34962);
      }
    }
    const count = vrm.json.accessors[attributes.POSITION].count;
    const indices = indexAccessor(Array.from(readIndices(cloth, cPrim.indices)), count);

    // 色のテクスチャ（Tripo の GLB は 1 枚）
    const cMat = cloth.json.materials?.[cPrim.material ?? 0];
    const texInfo = cMat?.pbrMetallicRoughness?.baseColorTexture;
    let texIdx;
    if (texInfo) {
      const img = cloth.json.images[cloth.json.textures[texInfo.index].source];
      const v = cloth.json.bufferViews[img.bufferView];
      const imgView = appendBufferView(cloth.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
      vrm.json.images.push({ name: `${spec.name}_basecolor`, mimeType: img.mimeType || 'image/jpeg', bufferView: imgView });
      vrm.json.textures.push({ sampler: 0, source: vrm.json.images.length - 1 });
      texIdx = vrm.json.textures.length - 1;
    }
    const k = spec.color_scale ?? 1;
    const baseFactor = (cMat?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).map((c, i) => (i < 3 ? c * k : c));
    // テクスチャのない裏地は、影色に服の設定を使うと白っぽくなって隙間が残って見える
    const shadeFactor = texIdx !== undefined
      ? (spec.shade_color ?? [0.8, 0.8, 0.85]).map((c) => c * k)
      : baseFactor.slice(0, 3).map((c) => c * 0.55);
    vrm.json.materials.push({
      name: `${spec.name}_MToon`,
      // 髪はテクスチャにハイライトが描いてあるので、エンジンの天使の輪を重ねない
      // ライトの影も付けない（bakedShading）。トゥーンの影を重ねると後頭部がギザギザに暗く切れる
      ...(spec.kind === 'hair' && spec.hair_ring !== true ? { extras: { hairRing: false, bakedShading: true } } : {}),
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: baseFactor,
        ...(texIdx !== undefined ? { baseColorTexture: { index: texIdx } } : {}),
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
      extensions: {
        VRMC_materials_mtoon: {
          specVersion: '1.0',
          transparentWithZWrite: false,
          renderQueueOffsetNumber: 0,
          shadeColorFactor: shadeFactor,
          ...(texIdx !== undefined ? { shadeMultiplyTexture: { index: texIdx } } : {}),
          shadingShiftFactor: -0.05,
          shadingToonyFactor: 0.85,
          giEqualizationFactor: 0.9,
          parametricRimColorFactor: [0, 0, 0],
          parametricRimFresnelPowerFactor: 5,
          parametricRimLiftFactor: 0,
          outlineWidthMode: texIdx !== undefined ? 'worldCoordinates' : 'none',
          outlineWidthFactor: texIdx !== undefined ? 0.0011 : 0,
          outlineColorFactor: spec.outline_color ?? [0.3, 0.3, 0.3],
          outlineLightingMixFactor: 1,
        },
      },
    });
    primitives.push({ attributes, indices, material: vrm.json.materials.length - 1, mode: 4 });
  }
  vrm.json.meshes.push({ name: spec.name, primitives });
  vrm.json.nodes.push({ name: spec.name, mesh: vrm.json.meshes.length - 1, skin: 0 });
  vrm.json.scenes[0].nodes.push(vrm.json.nodes.length - 1);
  console.log(`[服 ${spec.name}] 追加`);
}

// 地毛は頭蓋の大きさしかない。横髪の隙間はそこを外れて空を見るので、
// 前髪と首は動かさず、横・後ろ・頭頂だけ毛束のすぐ内側まで広げる。
if (hairSpec) {
  const center = [0, 1.45, -0.02];
  const inset = 0.005;
  const hairFile = readGlb(path.join(cfg.work_dir, `${hairSpec.name}.glb`));
  const hairMesh = hairFile.json.meshes[hairFile.json.nodes.find((n) => n.mesh !== undefined).mesh];
  const hairTris = [];
  for (const prim of hairMesh.primitives) {
    const { bytes } = readAccessorBytes(hairFile, prim.attributes.POSITION);
    const idx = readIndices(hairFile, prim.indices);
    for (let i = 0; i < idx.length; i += 3) {
      const tri = [];
      for (const vi of [idx[i], idx[i + 1], idx[i + 2]]) {
        tri.push(bytes.readFloatLE(vi * 12), bytes.readFloatLE(vi * 12 + 4), bytes.readFloatLE(vi * 12 + 8));
      }
      hairTris.push(tri);
    }
  }
  const rayHit = (origin, dir) => {
    let best = Infinity;
    for (const t of hairTris) {
      const ax = t[0], ay = t[1], az = t[2], bx = t[3], by = t[4], bz = t[5], cx = t[6], cy = t[7], cz = t[8];
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const px = dir[1] * e2z - dir[2] * e2y, py = dir[2] * e2x - dir[0] * e2z, pz = dir[0] * e2y - dir[1] * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-8) continue;
      const inv = 1 / det;
      const sx = origin[0] - ax, sy = origin[1] - ay, sz = origin[2] - az;
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (dist > 1e-4 && dist < best) best = dist;
    }
    return best;
  };
  let moved = 0;
  for (const p of bodyMesh.primitives) {
    const mat = vrm.json.materials[p.material];
    if (!/hairback/i.test(mat?.name ?? '')) continue;
    const { acc, bytes } = readAccessorBytes(vrm, p.attributes.POSITION);
    const pos = Buffer.from(bytes);
    const normals = Buffer.alloc(acc.count * 12);
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < acc.count; i++) {
      const v = [pos.readFloatLE(i * 12), pos.readFloatLE(i * 12 + 4), pos.readFloatLE(i * 12 + 8)];
      const d = [v[0] - center[0], v[1] - center[1], v[2] - center[2]];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      const dir = d.map((c) => c / len);
      // +Z は顔の前。前髪の下と首筋は広げると輪郭からはみ出す。
      // こめかみ・生え際（前寄りでも頭の中心より上）は広げないと、毛束の隙間から額がのぞく。
      // 前寄りは顔の前に垂れた前髪まで届かないよう、広げる幅を 3cm までにする
      const front = dir[2] >= 0.45;
      if ((!front || dir[1] > 0.1) && dir[1] > -0.5) {
        const hit = rayHit(center, dir);
        if (hit < Infinity && hit > len + 0.002 && (!front || hit < len + 0.03)) {
          const nt = hit - inset;
          v[0] = center[0] + dir[0] * nt;
          v[1] = center[1] + dir[1] * nt;
          v[2] = center[2] + dir[2] * nt;
          moved++;
        }
      }
      pos.writeFloatLE(v[0], i * 12);
      pos.writeFloatLE(v[1], i * 12 + 4);
      pos.writeFloatLE(v[2], i * 12 + 8);
      normals.writeFloatLE(dir[0], i * 12);
      normals.writeFloatLE(dir[1], i * 12 + 4);
      normals.writeFloatLE(dir[2], i * 12 + 8);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
    p.attributes.POSITION = appendAccessor(pos, { ...acc, min, max }, 34962);
    const nAcc = vrm.json.accessors[p.attributes.NORMAL];
    p.attributes.NORMAL = appendAccessor(normals, { ...nAcc, count: acc.count, min: [-1, -1, -1], max: [1, 1, 1] }, 34962);
    console.log(`地毛を毛の内側まで広げた（${moved} 頂点、x ${min[0].toFixed(3)}..${max[0].toFixed(3)}）`);
  }
}

// 足した揺れの骨をスキンと VRMC_springBone に登録する
if (swayCtx.newJoints.length) {
  const { bytes: oldIbm } = readAccessorBytes(vrm, skin.inverseBindMatrices);
  const extra = Buffer.alloc(swayCtx.newJoints.length * 64);
  swayCtx.newJoints.forEach(({ ibm }, n) => ibm.forEach((v, q) => extra.writeFloatLE(v, n * 64 + q * 4)));
  skin.joints.push(...swayCtx.newJoints.map(({ node }) => node));
  skin.inverseBindMatrices = appendAccessor(Buffer.concat([oldIbm, extra]), { componentType: 5126, count: skin.joints.length, type: 'MAT4' });
  const sb = (vrm.json.extensions.VRMC_springBone ??= { specVersion: '1.0', colliders: [], colliderGroups: [], springs: [] });
  sb.springs.push(...swayCtx.springs);
  console.log(`揺れの骨 ${swayCtx.newJoints.length} 本、揺れの列 ${swayCtx.springs.length} 本を足した`);
}

const bin = Buffer.concat(binChunks);
vrm.json.buffers[0].byteLength = bin.length;
writeGlb(outPath, vrm.json, bin);
console.log(`書き出し ${outPath}`);
