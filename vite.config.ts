import { defineConfig } from 'vite';

export default defineConfig({
  base: '/AnimeVRM/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
});
