import fs from 'node:fs/promises';
import path from 'node:path';

interface GLTFBufferView {
  buffer?: number;
  byteOffset?: number;
  byteLength: number;
}

interface GLTFImage {
  name?: string;
  mimeType?: string;
  bufferView?: number;
}

interface GLTFTexture {
  source?: number;
}

interface GLTFJson {
  images?: GLTFImage[];
  textures?: GLTFTexture[];
  bufferViews?: GLTFBufferView[];
  extensions?: {
    VRM?: {
      meta?: {
        texture?: number;
      };
    };
    VRMC_vrm?: {
      meta?: {
        thumbnailImage?: number;
      };
    };
  };
}

export interface ExtractedThumbnail {
  buffer: Buffer;
  mimeType: string;
  ext: string;
}

const SUPPORTED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

/**
 * VRM（.glb）のバイナリバッファからサムネイル画像を抽出する。
 * VRM 1.0 (VRMC_vrm.meta.thumbnailImage) および VRM 0.0 (VRM.meta.texture) に対応。
 */
export function extractVRMThumbnail(buf: Buffer): ExtractedThumbnail | null {
  if (buf.length < 20) return null;

  // GLB Header
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) return null; // 'glTF'

  // Chunk 0: JSON
  const jsonChunkLen = buf.readUInt32LE(12);
  const jsonChunkType = buf.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) return null; // 'JSON'

  const jsonEnd = 20 + jsonChunkLen;
  if (buf.length < jsonEnd) return null;

  const jsonStr = buf.toString('utf8', 20, jsonEnd);
  let gltf: GLTFJson;
  try {
    gltf = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  // Chunk 1: BIN
  const binChunkOffset = jsonEnd;
  if (buf.length < binChunkOffset + 8) return null;

  const binChunkType = buf.readUInt32LE(binChunkOffset + 4);
  if (binChunkType !== 0x004e4942) return null; // 'BIN\0'

  const binOffset = binChunkOffset + 8;

  // サムネイル画像の index を特定
  let imageIndex: number | null = null;
  const vrm1 = gltf.extensions?.VRMC_vrm;
  const vrm0 = gltf.extensions?.VRM;

  if (typeof vrm1?.meta?.thumbnailImage === 'number') {
    imageIndex = vrm1.meta.thumbnailImage;
  } else if (typeof vrm0?.meta?.texture === 'number') {
    const texIdx = vrm0.meta.texture;
    imageIndex = gltf.textures?.[texIdx]?.source ?? texIdx;
  }

  if (imageIndex === null || !gltf.images || !gltf.images[imageIndex]) {
    return null;
  }

  const imgInfo = gltf.images[imageIndex];
  if (typeof imgInfo.bufferView !== 'number' || !gltf.bufferViews || !gltf.bufferViews[imgInfo.bufferView]) {
    return null;
  }

  const bv = gltf.bufferViews[imgInfo.bufferView];
  const start = binOffset + (bv.byteOffset || 0);
  const end = start + bv.byteLength;

  if (buf.length < end) return null;

  const imgBuf = buf.subarray(start, end);
  let mimeType = imgInfo.mimeType || 'image/png';
  let ext = '.png';

  // マジックバイトで正確な画像種別を判別
  if (imgBuf.length >= 3 && imgBuf[0] === 0xff && imgBuf[1] === 0xd8 && imgBuf[2] === 0xff) {
    mimeType = 'image/jpeg';
    ext = '.jpg';
  } else if (
    imgBuf.length >= 8 &&
    imgBuf[0] === 0x89 &&
    imgBuf[1] === 0x50 &&
    imgBuf[2] === 0x4e &&
    imgBuf[3] === 0x47
  ) {
    mimeType = 'image/png';
    ext = '.png';
  } else if (
    imgBuf.length >= 12 &&
    imgBuf.toString('ascii', 0, 4) === 'RIFF' &&
    imgBuf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    mimeType = 'image/webp';
    ext = '.webp';
  }

  return {
    buffer: Buffer.from(imgBuf),
    mimeType,
    ext,
  };
}

/**
 * 指定された相対パス（拡張子なし）に対応するサムネイルファイルが既に存在するか確認する
 */
export async function findThumbnail(
  thumbnailsDir: string,
  relPathWithoutExt: string
): Promise<{ fullPath: string; fileName: string } | null> {
  for (const ext of SUPPORTED_IMAGE_EXTS) {
    const candidate = path.join(thumbnailsDir, `${relPathWithoutExt}${ext}`);
    try {
      await fs.access(candidate);
      return { fullPath: candidate, fileName: `${relPathWithoutExt}${ext}` };
    } catch {
      // not found
    }
  }
  return null;
}

/**
 * 単一の VRM ファイルからサムネイルを抽出して保存する
 */
export async function extractThumbnailForVrm(
  vrmPath: string,
  thumbnailsDir: string,
  relWithoutExt: string
): Promise<string | null> {
  try {
    const vrmBuf = await fs.readFile(vrmPath);
    const extracted = extractVRMThumbnail(vrmBuf);
    if (!extracted) return null;

    const outPath = path.join(thumbnailsDir, `${relWithoutExt}${extracted.ext}`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    // 画像の形式が変わったときに前の形式のファイルが残ると、そちらが見つかってしまう
    for (const ext of SUPPORTED_IMAGE_EXTS) {
      if (ext !== extracted.ext) await fs.rm(path.join(thumbnailsDir, `${relWithoutExt}${ext}`), { force: true });
    }
    await fs.writeFile(outPath, extracted.buffer);
    return `${relWithoutExt}${extracted.ext}`;
  } catch (err) {
    console.error(`[vrmThumbnail] Failed to extract thumbnail for ${relWithoutExt}:`, err);
    return null;
  }
}

/**
 * モデルのサムネイルを用意する。まだないか、モデルのほうが新しい（差し替えられた）ときは取り出し直す。
 * 返すのはサムネイルのファイル名（thumbnailsDir 基準）と更新時刻。取り出せなければ前のものか null
 */
export async function ensureVrmThumbnail(
  vrmPath: string,
  thumbnailsDir: string,
  relWithoutExt: string
): Promise<{ fileName: string; updatedAt: number; extracted: boolean } | null> {
  const existing = await findThumbnail(thumbnailsDir, relWithoutExt);
  const vrmTime = (await fs.stat(vrmPath)).mtimeMs;
  if (existing) {
    const thumbTime = (await fs.stat(existing.fullPath)).mtimeMs;
    if (thumbTime >= vrmTime) return { fileName: existing.fileName, updatedAt: thumbTime, extracted: false };
  }
  const saved = await extractThumbnailForVrm(vrmPath, thumbnailsDir, relWithoutExt);
  const fileName = saved ?? existing?.fileName;
  if (!fileName) return null;
  const updatedAt = (await fs.stat(path.join(thumbnailsDir, fileName))).mtimeMs;
  return { fileName, updatedAt, extracted: saved !== null };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  );
  return files.flat();
}

/**
 * サーバー起動時などに assets/models/ 以下の全 VRM を走査し、
 * サムネイルが未作成か、モデルより古いものだけ抽出して assets/thumbnails/ に保存する。
 */
export async function ensureVrmThumbnails(assetsDir: string): Promise<number> {
  const modelsDir = path.join(assetsDir, 'models');
  const thumbnailsDir = path.join(assetsDir, 'thumbnails');

  const files = await walk(modelsDir);
  const vrmFiles = files.filter((f) => path.extname(f).toLowerCase() === '.vrm');

  let extractedCount = 0;
  for (const vrmFile of vrmFiles) {
    const relToModels = path.relative(modelsDir, vrmFile);
    const relWithoutExt = relToModels.slice(0, -path.extname(relToModels).length);

    // サムネイルがモデルより新しければスキップ
    const result = await ensureVrmThumbnail(vrmFile, thumbnailsDir, relWithoutExt);
    if (result?.extracted) extractedCount++;
  }

  return extractedCount;
}
