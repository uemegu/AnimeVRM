import { defineConfig } from 'vite';

export default defineConfig({
  base: '/AnimeVRM/',
  resolve: {
    // Transformers.js also imports ONNX Runtime. Force both the LLM and TTS
    // paths onto one module instance so they share the WebGPU backend/device.
    dedupe: ['onnxruntime-web', 'onnxruntime-common'],
  },
  assetsInclude: ['**/*.onnx'],
  build: {
    rollupOptions: { input: { viewer: 'index.html', motion: 'motion.html' } },
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/irodori-api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/irodori-api/, ''),
      },
    },
  },
});
