import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { generateLicenses } from './scripts/generate-licenses.js';
import { generatePreloadManifest } from './scripts/generate-preload-manifest.js';
import { generateScenarioIndex, SCENARIOS_DIR } from './scripts/generate-scenario-index.js';

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

function scenarioIndexPlugin(): Plugin {
  const run = () => {
    const result = generateScenarioIndex();
    if (result.changed) console.log(`[scenario-index] Generated scenarioIndex.json (${result.count} scenarios)`);
  };
  return {
    name: 'vite-plugin-generate-scenario-index',
    buildStart() {
      run();
    },
    // 開発中に scenario.json を編集したら目次を作り直す
    configureServer(server) {
      server.watcher.add(SCENARIOS_DIR);
      const onChange = (file: string) => {
        if (!file.startsWith(SCENARIOS_DIR) || !file.endsWith('scenario.json')) return;
        try {
          run();
        } catch (err) {
          console.warn('[scenario-index] Failed to generate scenario index:', err);
        }
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  plugins: [react(), licenseGeneratorPlugin(), preloadManifestPlugin(), scenarioIndexPlugin()],
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

