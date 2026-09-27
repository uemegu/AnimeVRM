import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Studio はローカル専用。素材はリポジトリ直下の assets/ を共有し、保存などは server/（5190）に任せる
export default defineConfig({
  plugins: [react()],
  publicDir: '../assets',
  // ardy-mini の推論ワーカーは ES モジュール
  worker: { format: 'es' },
  // 生成のページを開いた途中で依存の前処理が走って読み直しにならないよう、起動時に済ませる
  optimizeDeps: { include: ['@huggingface/tokenizers', 'ardy-onnxruntime-web/webgpu'] },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://127.0.0.1:5190',
    },
  },
});
