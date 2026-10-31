import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { collectPagesAssets } from './pages/collectAssets';

/** GitHub Pages はビューア専用。編集画面・シナリオ・ミニゲームはビルドに含めない。 */
const ASSETS = path.resolve(__dirname, '../assets');
const OUT = process.env.PAGES_OUT_DIR ? path.resolve(process.env.PAGES_OUT_DIR) : path.resolve(__dirname, '../docs');
const BASE = '/AnimeVRM/';

function pagesOutput(): Plugin {
  return {
    name: 'anime-vrm-pages-output',
    apply: 'build',
    closeBundle() {
      const files = collectPagesAssets(ASSETS);
      let bytes = 0;
      for (const file of files) {
        const from = path.join(ASSETS, file);
        const to = path.join(OUT, file);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        bytes += fs.statSync(from).size;
      }
      fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
      console.log(`[pages] 素材 ${files.length} 件（${(bytes / 1024 / 1024).toFixed(1)} MB）をコピーしました`);
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  root: path.resolve(__dirname, 'pages'),
  base: command === 'build' || isPreview ? BASE : '/',
  publicDir: false,
  plugins: [react(), pagesOutput()],
  preview: { port: 5177 },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
}));
