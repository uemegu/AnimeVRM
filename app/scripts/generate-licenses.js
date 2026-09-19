import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

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
export function generateLicenses() {
  const packageJsonPath = path.join(APP_ROOT, 'package.json');
  const packageLockPath = path.join(APP_ROOT, 'package-lock.json');
  const assetCreditsPath = path.join(APP_ROOT, 'src', 'data', 'assetCredits.json');

  if (!fs.existsSync(packageLockPath)) {
    throw new Error(`package-lock.json not found at ${packageLockPath}`);
  }

  const lockContent = JSON.parse(fs.readFileSync(packageLockPath, 'utf-8'));
  const packages = lockContent.packages || {};

  // 本番依存（dev が false または undefined）かつ root自身以外
  const prodEntries = Object.entries(packages).filter(([pkgPath, info]) => {
    if (!pkgPath || pkgPath === '') return false;
    return !info.dev;
  });

  const libraries = [];

  for (const [pkgRelPath, lockInfo] of prodEntries) {
    const dir = path.join(APP_ROOT, pkgRelPath);
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

    const name = pkgJson.name || pkgRelPath.replace(/^node_modules\//, '');
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
  const outputPublicPath = path.join(APP_ROOT, 'public', 'licenses.json');

  fs.mkdirSync(path.dirname(outputSrcPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputPublicPath), { recursive: true });

  const formattedJson = JSON.stringify(resultData, null, 2) + '\n';
  fs.writeFileSync(outputSrcPath, formattedJson, 'utf-8');
  fs.writeFileSync(outputPublicPath, formattedJson, 'utf-8');

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
