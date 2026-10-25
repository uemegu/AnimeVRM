// Blender で配置済みの髪・小物を、見た目の位置を保って VRM 1.0 のボーンに接続する。
// node scripts/attach_vrm_node.mjs input.vrm ROOT.001 head output.vrm
// スキニング済みのメッシュには使わない（ボーン変形と親子変形が二重になるため）。
import fs from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';

const [input, nodeName, boneName, output] = process.argv.slice(2);
if (!input || !nodeName || !boneName || !output || process.argv.length !== 6) {
  throw new Error('使い方: node scripts/attach_vrm_node.mjs input.vrm nodeName humanoidBone output.vrm');
}
const source = fs.readFileSync(input);
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2
  || source.readUInt32LE(8) !== source.length || source.readUInt32LE(16) !== 0x4e4f534a) {
  throw new Error('GLB 2.0 形式の VRM が必要です');
}
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
const matches = gltf.nodes.flatMap((node, index) => node.name === nodeName ? [index] : []);
if (matches.length !== 1) throw new Error(`ノード名 ${nodeName} が一意ではありません`);
const nodeIndex = matches[0];
const boneIndex = gltf.extensions?.VRMC_vrm?.humanoid?.humanBones?.[boneName]?.node;
if (boneIndex === undefined) throw new Error(`VRM 1.0 のボーン ${boneName} がありません`);

const parents = new Map();
gltf.nodes.forEach((node, index) => {
  for (const child of node.children ?? []) {
    if (parents.has(child)) throw new Error('複数の親を持つノードがあります');
    parents.set(child, index);
  }
});
function subtree(index, seen = new Set()) {
  if (seen.has(index)) throw new Error('ノード階層に循環があります');
  seen.add(index);
  for (const child of gltf.nodes[index].children ?? []) subtree(child, seen);
  return seen;
}
const attachmentNodes = subtree(nodeIndex);
if (attachmentNodes.has(boneIndex)) throw new Error('接続先が接続元の子孫です');
if ([...attachmentNodes].some((i) => gltf.nodes[i].skin !== undefined)) {
  throw new Error('スキニング済みのメッシュは接続できません');
}
if ((gltf.animations ?? []).some((animation) => animation.channels.some((c) => c.target.node === nodeIndex))) {
  throw new Error('接続元の変換にアニメーションがあるため、先にベイクしてください');
}
function localMatrix(node) {
  return node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1]),
  );
}
function worldMatrix(index, seen = new Set()) {
  if (seen.has(index)) throw new Error('ノード階層に循環があります');
  seen.add(index);
  const local = localMatrix(gltf.nodes[index]);
  return parents.has(index) ? worldMatrix(parents.get(index), seen).multiply(local) : local;
}
const previousWorld = worldMatrix(nodeIndex);
const boneWorld = worldMatrix(boneIndex);
if (Math.abs(boneWorld.determinant()) < 1e-12) throw new Error('接続先の変換行列を逆変換できません');
const local = boneWorld.clone().invert().multiply(previousWorld);
const translation = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
local.decompose(translation, rotation, scale);
const reconstructed = boneWorld.clone().multiply(new Matrix4().compose(translation, rotation, scale));
const error = Math.max(...previousWorld.elements.map((v, i) => Math.abs(v - reconstructed.elements[i])));
if (error > 1e-6) throw new Error(`親の非一様スケールによる歪みが大きすぎます: ${error}`);

const oldParent = parents.get(nodeIndex);
if (oldParent !== undefined) {
  gltf.nodes[oldParent].children = gltf.nodes[oldParent].children.filter((i) => i !== nodeIndex);
}
for (const scene of gltf.scenes) scene.nodes = scene.nodes.filter((i) => i !== nodeIndex);
(gltf.nodes[boneIndex].children ??= []).push(nodeIndex);
const node = gltf.nodes[nodeIndex];
delete node.matrix;
node.translation = translation.toArray();
node.rotation = rotation.toArray();
node.scale = scale.toArray();

// JSON 以外のチャンクはバイト単位で残す（形状・テクスチャ・表情・ウェイトは変更しない）。
const jsonBytes = Buffer.from(JSON.stringify(gltf));
const paddedJson = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 0x20);
jsonBytes.copy(paddedJson);
const remainingChunks = source.subarray(20 + jsonLength);
const header = Buffer.from(source.subarray(0, 20));
header.writeUInt32LE(20 + paddedJson.length + remainingChunks.length, 8);
header.writeUInt32LE(paddedJson.length, 12);
fs.writeFileSync(output, Buffer.concat([header, paddedJson, remainingChunks]));
console.log(`${nodeName} → ${gltf.nodes[boneIndex].name} (${attachmentNodes.size} ノード、配置誤差 ${error.toExponential(2)})`);
console.log(output);
