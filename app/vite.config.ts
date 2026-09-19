import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { generateLicenses } from './scripts/generate-licenses.js';
import { generatePreloadManifest } from './scripts/generate-preload-manifest.js';

function licenseGeneratorPlugin(): Plugin {
  return {
    name: 'vite-plugin-generate-licenses',
    buildStart() {
      try {
        const result = generateLicenses();
        console.log(
          `[license-plugin] Generated licenses.json (${result.libraryCount} libs, ${result.assetCount} assets)`
        );
      } catch (err) {
        console.warn('[license-plugin] Failed to generate licenses:', err);
      }
    },
  };
}

function preloadManifestPlugin(): Plugin {
  return {
    name: 'vite-plugin-generate-preload-manifest',
    async buildStart() {
      try {
        const manifest = await generatePreloadManifest();
        console.log(
          `[preload-plugin] Generated preloadManifest.json (${manifest.itemCount} items, ${manifest.totalMb} MB)`
        );
      } catch (err) {
        console.warn('[preload-plugin] Failed to generate preload manifest:', err);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), licenseGeneratorPlugin(), preloadManifestPlugin()],
  server: {
    port: 5174,
  },
  // Vitest設定
  // @ts-expect-error vitest config field
  test: {
    globals: true,
    environment: 'node',
  },
});

