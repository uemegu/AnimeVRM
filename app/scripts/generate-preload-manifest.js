import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

/**
 * 拡張子からアセット種別を自動推論
 */
function inferAssetType(url) {
  const ext = path.extname(url).toLowerCase();
  switch (ext) {
    case '.vrm':
      return 'vrm';
    case '.mp3':
    case '.wav':
    case '.ogg':
    case '.m4a':
      return 'audio';
    case '.wasm':
      return 'wasm';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.avif':
    case '.webp':
      return 'image';
    default:
      return 'binary';
  }
}

/**
 * URLから自動IDを生成
 */
function generateIdFromUrl(url) {
  const clean = url.replace(/^\/+/, '').replace(/[^\w-]/g, '_');
  return clean;
}

/**
 * URLから自動ラベルを生成
 */
function generateLabelFromUrl(url) {
  const basename = path.basename(url, path.extname(url));
  return {
    ja: basename,
    en: basename,
  };
}

/**
 * プリロード対象マニフェスト（ファイルサイズ付き）を自動生成する
 */
export async function generatePreloadManifest() {
  const targetsModulePath = path.join(APP_ROOT, 'src', 'config', 'preloadTargets.ts');
  const publicDir = path.join(APP_ROOT, 'public');
  const outputPath = path.join(APP_ROOT, 'src', 'data', 'preloadManifest.json');

  const { PRELOAD_TARGETS } = await import(targetsModulePath);

  if (!Array.isArray(PRELOAD_TARGETS)) {
    throw new Error(`PRELOAD_TARGETS is not exported as an array from ${targetsModulePath}`);
  }

  let totalBytes = 0;
  const items = [];

  for (const target of PRELOAD_TARGETS) {
    if (!target.url) continue;

    // public ディレクトリ内の実ファイルパス
    // target.url は '/models/aoi/...' のように先頭に / が付いている前提
    const relativePath = target.url.replace(/^\/+/, '');
    const diskPath = path.join(publicDir, relativePath);

    let sizeBytes = 0;
    if (fs.existsSync(diskPath)) {
      const stat = fs.statSync(diskPath);
      sizeBytes = stat.size;
    } else {
      console.warn(`[preload-manifest] Warning: Target file not found at ${diskPath}`);
    }

    const item = {
      id: target.id || generateIdFromUrl(target.url),
      url: target.url,
      label: target.label || generateLabelFromUrl(target.url),
      sizeBytes,
      type: target.type || inferAssetType(target.url),
    };

    items.push(item);
    totalBytes += sizeBytes;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    totalBytes,
    totalMb: Number((totalBytes / (1024 * 1024)).toFixed(1)),
    items,
  };

  // 出力先ディレクトリの確保
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return manifest;
}

// CLIから直接実行された場合
if (process.argv[1] === __filename) {
  generatePreloadManifest()
    .then((manifest) => {
      console.log(
        `[preload-manifest] Successfully generated preloadManifest.json (${manifest.itemCount} items, ${manifest.totalMb} MB)`
      );
    })
    .catch((err) => {
      console.error('[preload-manifest] Generation failed:', err);
      process.exit(1);
    });
}
