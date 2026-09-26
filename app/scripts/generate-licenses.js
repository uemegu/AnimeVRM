import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');
// npm workspaces のため lockfile はリポジトリ直下に1つだけある
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const packageLockPath = path.join(REPO_ROOT, 'package-lock.json');
const APP_LOCK_PATH = path.relative(REPO_ROOT, APP_ROOT);

/**
 * lockfile 内で、location にあるパッケージから name を解決する（Node の node_modules 探索と同じ順）
 */
function resolveInLock(packages, location, name) {
  let dir = location;
  for (;;) {
    const candidate = dir ? `${dir}/node_modules/${name}` : `node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!dir) return null;
    const idx = dir.lastIndexOf('/node_modules/');
    dir = idx >= 0 ? dir.slice(0, idx) : '';
  }
}

/**
 * app の dependencies から本番で使うパッケージを lockfile 上でたどる。
 * ワークスペース（packages/*）は中身の依存だけをたどり、パッケージ自体は一覧に含めない。
 */
function collectProductionPackages(packages) {
  const result = new Map();
  const visited = new Set();
  const visit = (location) => {
    if (visited.has(location)) return;
    visited.add(location);
    let info = packages[location];
    if (!info) return;
    if (info.link) {
      visit(info.resolved);
      return;
    }
    const isWorkspace = !location.includes('node_modules/');
    if (!isWorkspace) result.set(location, info);
    for (const dep of Object.keys({ ...info.dependencies, ...info.optionalDependencies })) {
      const resolved = resolveInLock(packages, location, dep);
      if (resolved) visit(resolved);
    }
  };
  visit(APP_LOCK_PATH);
  return [...result.entries()];
}

const LICENSE_FILENAMES = [
  'LICENSE',
  'LICENSE.txt',
  'LICENSE.md',
  'license',
  'license.txt',
  'license.md',
  'LICENCE',
  'LICENCE.txt',
  'LICENCE.md',
];

/**
 * 本番依存パッケージのライセンス一覧およびアセットクレジットを収集・生成する
 */

/** generatedAt 以外が同じなら書き込まない（開発サーバーを起動するたびに差分が出ないように） */
function writeIfChanged(filePath, data, trailingNewline) {
  if (fs.existsSync(filePath)) {
    try {
      const { generatedAt: _previous, ...before } = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const { generatedAt: _next, ...after } = data;
      if (JSON.stringify(before) === JSON.stringify(after)) return false;
    } catch {
      // 読めなければ書き直す
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + (trailingNewline ? '\n' : ''), 'utf-8');
  return true;
}

export function generateLicenses() {
  const assetCreditsPath = path.join(APP_ROOT, 'src', 'data', 'assetCredits.json');

  if (!fs.existsSync(packageLockPath)) {
    throw new Error(`package-lock.json not found at ${packageLockPath}`);
  }

  const lockContent = JSON.parse(fs.readFileSync(packageLockPath, 'utf-8'));
  const prodEntries = collectProductionPackages(lockContent.packages || {});

  const libraries = [];

  for (const [pkgRelPath, lockInfo] of prodEntries) {
    const dir = path.join(REPO_ROOT, pkgRelPath);
    let pkgJson = {};
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      } catch {
        pkgJson = {};
      }
    }

    let licenseText = '';
    for (const cand of LICENSE_FILENAMES) {
      const candidatePath = path.join(dir, cand);
      if (fs.existsSync(candidatePath)) {
        licenseText = fs.readFileSync(candidatePath, 'utf-8');
        break;
      }
    }

    const name = pkgJson.name || pkgRelPath.replace(/^.*node_modules\//, '');
    const version = pkgJson.version || lockInfo.version || '';
    const licenseType = pkgJson.license || lockInfo.license || 'UNKNOWN';

    let repository = '';
    if (typeof pkgJson.repository === 'string') {
      repository = pkgJson.repository;
    } else if (pkgJson.repository && typeof pkgJson.repository.url === 'string') {
      repository = pkgJson.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
    } else if (pkgJson.homepage) {
      repository = pkgJson.homepage;
    }

    let author = '';
    if (typeof pkgJson.author === 'string') {
      author = pkgJson.author;
    } else if (pkgJson.author && typeof pkgJson.author.name === 'string') {
      author = pkgJson.author.name;
    }

    libraries.push({
      name,
      version,
      licenseType,
      author,
      repository,
      licenseText: licenseText.trim(),
    });
  }

  // 名前の昇順にソート
  libraries.sort((a, b) => a.name.localeCompare(b.name));

  // アセットクレジット読み込み
  let assets = [];
  if (fs.existsSync(assetCreditsPath)) {
    assets = JSON.parse(fs.readFileSync(assetCreditsPath, 'utf-8'));
  }

  const resultData = {
    generatedAt: new Date().toISOString(),
    assets,
    libraries,
  };

  const outputSrcPath = path.join(APP_ROOT, 'src', 'data', 'licenses.json');
  const outputPublicPath = path.join(APP_ROOT, '..', 'assets', 'licenses.json');

  fs.mkdirSync(path.dirname(outputSrcPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputPublicPath), { recursive: true });

  writeIfChanged(outputSrcPath, resultData, true);
  writeIfChanged(outputPublicPath, resultData, true);

  return {
    libraryCount: libraries.length,
    assetCount: assets.length,
    outputSrcPath,
    outputPublicPath,
  };
}

// スクリプトとして直接実行された場合
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = generateLicenses();
  console.log(
    `[generate-licenses] Successfully generated licenses.json: ${result.libraryCount} libraries, ${result.assetCount} assets.`
  );
}
