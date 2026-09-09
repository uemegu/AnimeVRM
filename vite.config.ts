import { defineConfig } from 'vite';

export default defineConfig({
  base: '/AnimeVRM/',
  resolve: {
    // Transformers.js also imports ONNX Runtime. Force both the LLM and TTS
    // paths onto one module instance so they share the WebGPU backend/device.
    dedupe: ['onnxruntime-web', 'onnxruntime-common'],
  },
  build: {
    rollupOptions: { input: { viewer: 'index.html', motion: 'motion.html' } },
    outDir: 'docs',
    emptyOutDir: true,
  },
});
