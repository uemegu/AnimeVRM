/** ビューアで使う、Git 管理下の素材だけを Pages に含める。 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_MOTION } from '../src/defaultMotion';

const STUDIO_FILES = ['characters', 'locations', 'time-of-day', 'bgm'].map((name) => `studio/${name}.json`);

export function collectPagesAssets(assetsDir: string): string[] {
  const repoRoot = path.dirname(assetsDir);
  const prefix = `${path.basename(assetsDir)}/`;
  // ローカルだけの Mixamo FBX や制作途中の素材を公開しない。CI と手元で同じ一覧にする。
  const tracked = new Set(
    execFileSync('git', ['-C', repoRoot, 'ls-files', '-z', '--', prefix], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .map((file) => file.slice(prefix.length))
  );
  const characters = JSON.parse(fs.readFileSync(path.join(assetsDir, 'studio/characters.json'), 'utf8')) as {
    characters: { models: { url: string }[] }[];
  };
  const models = new Set(characters.characters.flatMap((c) => c.models.map((m) => m.url.replace(/^\//, ''))));
  const files = [...tracked].filter((file) =>
    STUDIO_FILES.includes(file) ||
    models.has(file) ||
    // 組み込み3D背景・表情・小物の絵柄も含む。シナリオ素材・生成用モデルは不要。
    (/^textures\//.test(file) && /\.(avif|png|jpe?g|webp)$/i.test(file)) ||
    (/^animations\//.test(file) && /\.fbx$/i.test(file)) ||
    (/^(bgm|se|voices)\//.test(file) && /\.(mp3|ogg|wav)$/i.test(file)) ||
    file === 'ogp/studio.png'
  );
  const required = [...STUDIO_FILES, `animations/${DEFAULT_MOTION}.fbx`, 'ogp/studio.png'];
  const missing = [...new Set([...required, ...files])].filter((file) => !tracked.has(file) || !fs.existsSync(path.join(assetsDir, file)));
  if (missing.length) throw new Error(`Pages の素材が見つかりません:\n${missing.join('\n')}`);
  return files.sort();
}
