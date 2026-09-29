import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { PAGES_ENTRIES, SITE_NAME, SITE_URL } from './pages/catalog';
import { collectPagesAssets } from './pages/collectAssets';

/**
 * GitHub Pages 用の本番ビルド。Studio 本体を読み取り専用（サーバーなし）で出す。ビルドはリポジトリ直下の docs/ に書き出す。
 * 素材は assets/ から Pages に出すデモのシナリオが使うものだけをコピーし、API は bakeApi.ts が JSON にする（npm run build:pages）
 */
const ASSETS = path.resolve(__dirname, '../assets');
// 確認用に別の場所へ書き出すときは PAGES_OUT_DIR を指定する
const OUT = process.env.PAGES_OUT_DIR ? path.resolve(process.env.PAGES_OUT_DIR) : path.resolve(__dirname, '../docs');
const BASE = '/AnimeVRM/';

/** 旧 Pages にあって、今はないシナリオ（共有されたリンクは一覧へ転送する） */
const REMOVED_SLUGS = ['behind-you', 'door-peep', 'ghost-mass', 'five-seconds-pv', 'corridor-mob', 'rooftop-nap'];

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const ja = (value: unknown) => (typeof value === 'string' ? value : ((value as { ja?: string } | undefined)?.ja ?? ''));

/** 旧 URL（scenarios/<slug>.html）から新しい再生画面へ転送するページ。共有カード用の OGP は残す */
function redirectPage(target: string, meta?: { title: string; description: string; image: string; slug: string }): string {
  const tags = meta
    ? `
  <title>${escape(meta.title)} | ${SITE_NAME}</title>
  <meta name="description" content="${escape(meta.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE_URL}scenarios/${meta.slug}.html" />
  <meta property="og:title" content="${escape(meta.title)} | ${SITE_NAME}" />
  <meta property="og:description" content="${escape(meta.description)}" />
  <meta property="og:image" content="${SITE_URL}${meta.image.replace(/^\//, '')}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(meta.title)} | ${SITE_NAME}" />
  <meta name="twitter:description" content="${escape(meta.description)}" />
  <meta name="twitter:image" content="${SITE_URL}${meta.image.replace(/^\//, '')}" />`
    : `\n  <title>${SITE_NAME}</title>`;
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />${tags}
  <meta http-equiv="refresh" content="0; url=${target}" />
  <script>location.replace(${JSON.stringify(target)});</script>
</head>
<body><a href="${target}">${SITE_NAME}</a></body>
</html>
`;
}

function pagesOutput(): Plugin {
  return {
    name: 'anime-vrm-pages-output',
    apply: 'build',
    closeBundle() {
      const ids = PAGES_ENTRIES.map((e) => e.id);
      const files = collectPagesAssets(ASSETS, ids, PAGES_ENTRIES.flatMap((e) => (e.ogp ? [e.ogp] : [])));
      let bytes = 0;
      for (const file of files) {
        const from = path.join(ASSETS, file);
        const to = path.join(OUT, file);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.cpSync(from, to, { recursive: true });
        bytes += fs.statSync(from).isDirectory() ? 0 : fs.statSync(from).size;
      }
      fs.mkdirSync(path.join(OUT, 'scenarios'), { recursive: true });
      for (const entry of PAGES_ENTRIES) {
        const scenario = JSON.parse(fs.readFileSync(path.join(ASSETS, 'scenarios/demo', entry.id, 'scenario.json'), 'utf8'));
        const locations = JSON.parse(fs.readFileSync(path.join(ASSETS, 'studio/locations.json'), 'utf8')).presets;
        const image = entry.ogp ?? locations[scenario.location]?.layers.background.url ?? '/ogp/park-confession.png';
        const html = redirectPage(`../#/player/demo/${entry.id}`, { title: ja(scenario.title), description: ja(scenario.description), image, slug: entry.slug });
        fs.writeFileSync(path.join(OUT, 'scenarios', `${entry.slug}.html`), html);
      }
      for (const slug of REMOVED_SLUGS) fs.writeFileSync(path.join(OUT, 'scenarios', `${slug}.html`), redirectPage('../'));
      // GitHub Pages で _ から始まるファイルも配信する
      fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
      console.log(`[pages] 素材 ${files.length} 件（ディレクトリ以外 ${(bytes / 1024 / 1024).toFixed(1)} MB）をコピーしました`);
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  // ビルドと、ビルド結果の確認（vite preview）は Pages と同じサブパスで配信する
  base: command === 'build' || isPreview ? BASE : '/',
  // ビルドでは使う素材だけをコピーする（pagesOutput）
  publicDir: false,
  plugins: [react(), pagesOutput()],
  preview: { port: 5177 },
  // ardy-mini の推論ワーカーは ES モジュール
  worker: { format: 'es' },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
}));
