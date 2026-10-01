import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureVrmThumbnails, extractVRMThumbnail } from '../src/vrmThumbnail.ts';
import { createApp } from '../src/app.ts';

function createFakeVRM({
  isV1 = true,
  imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
  hasThumbnail = true,
}: {
  isV1?: boolean;
  imageBuffer?: Buffer;
  hasThumbnail?: boolean;
} = {}) {
  const gltf: any = {
    asset: { version: '2.0' },
  };

  if (hasThumbnail) {
    gltf.images = [{ bufferView: 0, mimeType: 'image/png' }];
    gltf.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: imageBuffer.length }];
    gltf.buffers = [{ byteLength: imageBuffer.length }];
    if (isV1) {
      gltf.extensions = { VRMC_vrm: { meta: { thumbnailImage: 0 } } };
    } else {
      gltf.textures = [{ source: 0 }];
      gltf.extensions = { VRM: { meta: { texture: 0 } } };
    }
  }

  let jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  while (jsonBuf.length % 4 !== 0) {
    jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')]);
  }

  let binBuf = hasThumbnail ? imageBuffer : Buffer.alloc(0);
  while (binBuf.length % 4 !== 0) {
    binBuf = Buffer.concat([binBuf, Buffer.from([0])]);
  }

  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuf.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binBuf]);
}

describe('vrmThumbnail', () => {
  let tmpDir: string;
  let assetsDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vrm-thumb-test-'));
    assetsDir = path.join(tmpDir, 'assets');
    await fs.mkdir(path.join(assetsDir, 'models', 'chara'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('VRM 1.0 のバイナリから PNG サムネイルを抽出できる', () => {
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22]);
    const vrm = createFakeVRM({ isV1: true, imageBuffer: pngMagic });
    const result = extractVRMThumbnail(vrm);
    expect(result).not.toBeNull();
    expect(result?.ext).toBe('.png');
    expect(result?.mimeType).toBe('image/png');
    expect(result?.buffer.equals(pngMagic)).toBe(true);
  });

  it('VRM 0.0 のバイナリから JPEG サムネイルを抽出できる', () => {
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const vrm = createFakeVRM({ isV1: false, imageBuffer: jpegMagic });
    const result = extractVRMThumbnail(vrm);
    expect(result).not.toBeNull();
    expect(result?.ext).toBe('.jpg');
    expect(result?.mimeType).toBe('image/jpeg');
    expect(result?.buffer.equals(jpegMagic)).toBe(true);
  });

  it('サムネイル情報がない場合は null を返す', () => {
    const vrm = createFakeVRM({ hasThumbnail: false });
    const result = extractVRMThumbnail(vrm);
    expect(result).toBeNull();
  });

  it('GLB でない破損データでは null を返す', () => {
    const corrupt = Buffer.from('hello world not a glb');
    const result = extractVRMThumbnail(corrupt);
    expect(result).toBeNull();
  });

  it('ensureVrmThumbnails: 未抽出のモデルのみ抽出し、既存のものはスキップする', async () => {
    const vrmPath = path.join(assetsDir, 'models', 'chara', 'test.vrm');
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(vrmPath, createFakeVRM({ imageBuffer: pngMagic }));

    // 初回: 抽出される（1件）
    const count1 = await ensureVrmThumbnails(assetsDir);
    expect(count1).toBe(1);

    const thumbPath = path.join(assetsDir, 'thumbnails', 'chara', 'test.png');
    const saved = await fs.readFile(thumbPath);
    expect(saved.equals(pngMagic)).toBe(true);

    // サムネイルファイルを書き換えてみる
    const modifiedContent = Buffer.from('already-extracted-dummy');
    await fs.writeFile(thumbPath, modifiedContent);

    // 2回目: 既にサムネイルが存在するためスキップされる（0件）
    const count2 = await ensureVrmThumbnails(assetsDir);
    expect(count2).toBe(0);

    // 書き換えた内容が上書きされずに保持されていることを確認（スキップされた証拠）
    const afterCheck = await fs.readFile(thumbPath);
    expect(afterCheck.equals(modifiedContent)).toBe(true);
  });

  it('ensureVrmThumbnails: モデルがサムネイルより新しければ取り出し直す', async () => {
    const vrmPath = path.join(assetsDir, 'models', 'chara', 'test.vrm');
    const thumbPath = path.join(assetsDir, 'thumbnails', 'chara', 'test.png');
    await fs.writeFile(vrmPath, createFakeVRM({ imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]) }));
    await ensureVrmThumbnails(assetsDir);

    // モデルを差し替える（サムネイルより新しい時刻にする）
    const replaced = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x02]);
    await fs.writeFile(vrmPath, createFakeVRM({ imageBuffer: replaced }));
    const later = new Date(Date.now() + 60_000);
    await fs.utimes(vrmPath, later, later);

    expect(await ensureVrmThumbnails(assetsDir)).toBe(1);
    expect((await fs.readFile(thumbPath)).subarray(0, replaced.length).equals(replaced)).toBe(true);
  });

  it('API 経由でサムネイル画像を取得でき、models 一覧に thumbnailUrl が含まれる', async () => {
    const vrmPath = path.join(assetsDir, 'models', 'chara', 'test.vrm');
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(vrmPath, createFakeVRM({ imageBuffer: pngMagic }));

    await ensureVrmThumbnails(assetsDir);

    const app = createApp({
      repoRoot: tmpDir,
      assetsDir,
      workDir: path.join(tmpDir, 'work'),
      onScenarioSaved: () => {},
      voiceTools: {
        synthesize: async () => {},
        postprocess: async () => {},
        toMp3: async () => {},
      },
    });

    // 1. GET /api/assets/models で thumbnailUrl が返る
    const modelsRes = await app.request('/api/assets/models', {
      headers: { host: 'localhost:5190' },
    });
    expect(modelsRes.status).toBe(200);
    const models = (await modelsRes.json()) as any[];
    expect(models).toHaveLength(1);
    expect(models[0].url).toBe('/models/chara/test.vrm');
    expect(models[0].thumbnailUrl).toMatch(/^\/api\/assets\/thumbnails\/chara\/test\.png\?v=\d+$/);

    // 2. GET /api/assets/thumbnails/chara/test.png で画像バイナリが返る
    const thumbRes = await app.request('/api/assets/thumbnails/chara/test.png', {
      headers: { host: 'localhost:5190' },
    });
    expect(thumbRes.status).toBe(200);
    expect(thumbRes.headers.get('content-type')).toBe('image/png');
    const body = Buffer.from(await thumbRes.arrayBuffer());
    expect(body.equals(pngMagic)).toBe(true);
  });
});
