#!/usr/bin/env node
/**
 * 別の VRM（GLB）から、名前が指定の文字で始まるメッシュ（鞄など）を持ってきて付け足す。
 * 人の部分を作り直した VRM に、前の版の小物をそのまま移すのに使う。
 *
 *   node scripts/transplant-vrm-meshes.ts <土台.vrm> <持ってくる元.vrm> <メッシュ名の先頭> -o <出力.vrm>
 *   例: node scripts/transplant-vrm-meshes.ts shion-school.vrm shion-school-with-bag.vrm Backpack -o shion-school-with-bag.vrm
 *
 * - スキンメッシュは、骨を名前で土台の骨に対応させる（土台に同じ名前の骨がなければエラー）。
 *   逆バインド行列は元のものを使うので、土台の骨の位置が元と違っても、小物はその骨に付いて動く。
 * - マテリアル・テクスチャ（MToon の影などのテクスチャも）も一緒に移す。
 * - -o に土台と同じファイルを指定してもよい（読み込んでから書き出す）。
 */
import fs from 'node:fs';
import { parseArgs } from 'node:util';

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { output: { type: 'string', short: 'o' } },
});
const [basePath, donorPath, prefix] = positionals;
if (!basePath || !donorPath || !prefix || !options.output) {
  console.log('使い方: node scripts/transplant-vrm-meshes.ts <土台.vrm> <持ってくる元.vrm> <メッシュ名の先頭> -o <出力.vrm>');
  process.exit(1);
}

type Json = Record<string, any>;
type Glb = { json: Json; bin: Buffer };

function readGlb(path: string): Glb {
  const glb = fs.readFileSync(path);
  if (glb.toString('ascii', 0, 4) !== 'glTF') throw new Error(`GLB ではありません: ${path}`);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as Json;
  const binStart = 20 + jsonLength + 8;
  const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLength));
  return { json, bin };
}

function writeGlb(path: string, json: Json, bin: Buffer): void {
  const pad = (buf: Buffer, fill: number) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, fill)]);
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binChunk = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHeader = (length: number, type: string) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(length, 0);
    h.write(type, 4, 'ascii');
    return h;
  };
  fs.writeFileSync(path, Buffer.concat([header, chunkHeader(jsonChunk.length, 'JSON'), jsonChunk, chunkHeader(binChunk.length, 'BIN\0'), binChunk]));
}

const base = readGlb(basePath);
const donor = readGlb(donorPath);
const out = base.json;
const binParts: Buffer[] = [base.bin];
let binLength = base.bin.length;

for (const key of ['accessors', 'bufferViews', 'meshes', 'materials', 'textures', 'images', 'samplers', 'skins', 'nodes']) out[key] ??= [];

const nodeName = (json: Json, index: number) => json.nodes[index]?.name as string | undefined;
const baseNodeByName = new Map<string, number>();
out.nodes.forEach((node: Json, i: number) => {
  if (node.name && !baseNodeByName.has(node.name)) baseNodeByName.set(node.name, i);
});

function memo<T>(fn: (index: number) => T): (index: number) => T {
  const cache = new Map<number, T>();
  return (index) => {
    if (!cache.has(index)) cache.set(index, fn(index));
    return cache.get(index)!;
  };
}

// bufferView は元の BIN から切り出して末尾に足す（4 バイト境界にそろえる）
const copyBufferView = memo((index: number) => {
  const view = donor.json.bufferViews[index];
  const data = donor.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const padding = (4 - (binLength % 4)) % 4;
  if (padding) {
    binParts.push(Buffer.alloc(padding));
    binLength += padding;
  }
  binParts.push(data);
  out.bufferViews.push({ ...view, buffer: 0, byteOffset: binLength });
  binLength += data.length;
  return out.bufferViews.length - 1;
});

const copyAccessor = memo((index: number) => {
  const accessor = donor.json.accessors[index];
  if (accessor.sparse) throw new Error(`sparse accessor には対応していません（accessor ${index}）`);
  out.accessors.push({ ...accessor, ...(accessor.bufferView !== undefined ? { bufferView: copyBufferView(accessor.bufferView) } : {}) });
  return out.accessors.length - 1;
});

const copySampler = memo((index: number) => {
  out.samplers.push(structuredClone(donor.json.samplers[index]));
  return out.samplers.length - 1;
});

const copyImage = memo((index: number) => {
  const image = structuredClone(donor.json.images[index]);
  if (image.bufferView === undefined) throw new Error(`外部ファイルの画像には対応していません（image ${index}）`);
  image.bufferView = copyBufferView(image.bufferView);
  out.images.push(image);
  return out.images.length - 1;
});

const copyTexture = memo((index: number) => {
  const texture = structuredClone(donor.json.textures[index]);
  if (texture.source !== undefined) texture.source = copyImage(texture.source);
  if (texture.sampler !== undefined) texture.sampler = copySampler(texture.sampler);
  out.textures.push(texture);
  return out.textures.length - 1;
});

/** マテリアルの中のテクスチャ参照（{ index: n } を持つ *Texture / *Map）を付け替える */
function remapTextures(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Json)) {
    if (/(Texture|Map)$/.test(key) && child && typeof child === 'object' && typeof (child as Json).index === 'number') {
      (child as Json).index = copyTexture((child as Json).index);
    }
    remapTextures(child);
  }
}

const copyMaterial = memo((index: number) => {
  const material = structuredClone(donor.json.materials[index]);
  remapTextures(material);
  out.materials.push(material);
  for (const name of Object.keys(material.extensions ?? {})) {
    out.extensionsUsed ??= [];
    if (!out.extensionsUsed.includes(name)) out.extensionsUsed.push(name);
  }
  return out.materials.length - 1;
});

const copyMesh = memo((index: number) => {
  const mesh = structuredClone(donor.json.meshes[index]);
  for (const primitive of mesh.primitives) {
    for (const [key, accessor] of Object.entries(primitive.attributes as Record<string, number>)) primitive.attributes[key] = copyAccessor(accessor);
    if (primitive.indices !== undefined) primitive.indices = copyAccessor(primitive.indices);
    if (primitive.material !== undefined) primitive.material = copyMaterial(primitive.material);
    primitive.targets = primitive.targets?.map((target: Record<string, number>) =>
      Object.fromEntries(Object.entries(target).map(([key, accessor]) => [key, copyAccessor(accessor)]))
    );
    if (!primitive.targets) delete primitive.targets;
  }
  out.meshes.push(mesh);
  return out.meshes.length - 1;
});

// 骨は名前で土台の骨に対応させる。逆バインド行列は元のまま
const copySkin = memo((index: number) => {
  const skin = structuredClone(donor.json.skins[index]);
  skin.joints = skin.joints.map((joint: number) => {
    const name = nodeName(donor.json, joint);
    const mapped = name !== undefined ? baseNodeByName.get(name) : undefined;
    if (mapped === undefined) throw new Error(`土台に骨「${name}」がありません`);
    return mapped;
  });
  if (skin.skeleton !== undefined) {
    const mapped = baseNodeByName.get(nodeName(donor.json, skin.skeleton) ?? '');
    if (mapped === undefined) delete skin.skeleton;
    else skin.skeleton = mapped;
  }
  if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = copyAccessor(skin.inverseBindMatrices);
  out.skins.push(skin);
  return out.skins.length - 1;
});

const targets = donor.json.nodes
  .map((node: Json, index: number) => ({ node, index }))
  .filter(({ node }: { node: Json }) => node.mesh !== undefined && typeof node.name === 'string' && node.name.startsWith(prefix));
if (targets.length === 0) throw new Error(`「${prefix}」で始まるメッシュが ${donorPath} にありません`);
const existing = out.nodes.filter((node: Json) => node.mesh !== undefined && node.name?.startsWith(prefix));
if (existing.length > 0) throw new Error(`土台にすでに「${prefix}」で始まるメッシュがあります: ${existing.map((n: Json) => n.name).join(', ')}`);

const sceneIndex = out.scene ?? 0;
for (const { node } of targets) {
  // 親の変換は持ってこないので、ルート直下の物だけ扱う（スキンメッシュは骨で位置が決まる）
  const hasParent = donor.json.nodes.some((parent: Json) => parent.children?.includes(donor.json.nodes.indexOf(node)));
  if (hasParent && node.skin === undefined) throw new Error(`「${node.name}」は親の下にあるスキンなしのメッシュです（未対応）`);
  const copied: Json = { name: node.name, mesh: copyMesh(node.mesh) };
  for (const key of ['translation', 'rotation', 'scale', 'matrix']) if (node[key] !== undefined) copied[key] = node[key];
  if (node.skin !== undefined) copied.skin = copySkin(node.skin);
  out.nodes.push(copied);
  out.scenes[sceneIndex].nodes.push(out.nodes.length - 1);
}

const bin = Buffer.concat(binParts);
out.buffers = [{ ...out.buffers[0], byteLength: bin.length }];
writeGlb(options.output, out, bin);
console.log(`${targets.length} 個のメッシュを移しました → ${options.output}`);
