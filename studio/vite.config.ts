import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { contentDirs, loadExternalProjects } from '@anime-vrm/scenario/node';
import { contentDirsPlugin } from '@anime-vrm/scenario/vite';

const REPO_ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(REPO_ROOT, 'assets');
// Studio の外にあるプロジェクト（studio-projects.txt・STUDIO_PROJECTS）のシナリオと素材も、assets/ と同じ URL の並びで配信する
const externalDirs = contentDirs({ repoRoot: REPO_ROOT, assetsDir: ASSETS, projects: loadExternalProjects(REPO_ROOT) }).slice(1);

// Studio はローカル専用。素材はリポジトリ直下の assets/ を共有し、保存などは server/（5190）に任せる
export default defineConfig({
  plugins: [react(), contentDirsPlugin(externalDirs)],
  publicDir: ASSETS,
  // ardy-mini の推論ワーカーは ES モジュール
  worker: { format: 'es' },
  // 生成のページを開いた途中で依存の前処理が走って読み直しにならないよう、起動時に済ませる
  optimizeDeps: { include: ['@huggingface/tokenizers', 'ardy-onnxruntime-web/webgpu'] },
  server: {
    port: 5175,
    proxy: {
      // サーバーのポートを変えたとき（STUDIO_SERVER_PORT）はそちらへ
      '/api': `http://127.0.0.1:${process.env.STUDIO_SERVER_PORT ?? 5190}`,
    },
  },
});
