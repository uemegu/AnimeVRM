import { defineConfig, Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function vrmModelsPlugin(): Plugin {
  const virtualModuleId = 'virtual:vrm-models';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  function scanModels() {
    const modelsDir = path.resolve(__dirname, 'public/models');
    if (!fs.existsSync(modelsDir)) return [];

    const iconMap: Record<string, string> = {
      aoi: '👧',
      emili: '👱‍♀️',
      shion: '💤',
    };

    const results: Array<{
      id: string;
      label: string;
      character: string;
      fileName: string;
      url: string;
      icon: string;
    }> = [];

    function walk(dir: string, relDir: string = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.vrm')) {
          const parts = relPath.split('/');
          const character = parts.length > 1 ? parts[0] : 'other';
          const fileName = entry.name;
          const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
          const label = parts.length > 1 ? `${character}/${nameWithoutExt}` : nameWithoutExt;

          results.push({
            id: relPath.replace(/\.[^/.]+$/, ''),
            label,
            character,
            fileName,
            url: `/models/${relPath}`,
            icon: iconMap[character.toLowerCase()] || '👤',
          });
        }
      }
    }

    walk(modelsDir);
    return results;
  }

  return {
    name: 'vite-plugin-vrm-models',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const models = scanModels();
        return `export default ${JSON.stringify(models, null, 2)};`;
      }
    },
    configureServer(server) {
      const modelsDir = path.resolve(__dirname, 'public/models');
      server.watcher.add(modelsDir);
      server.watcher.on('all', (event, filePath) => {
        if (filePath.startsWith(modelsDir)) {
          const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vrmModelsPlugin()],
  base: '/AnimeVRM/',
  resolve: {
    // Transformers.js also imports ONNX Runtime. Force both the LLM and TTS
    // paths onto one module instance so they share the WebGPU backend/device.
    dedupe: ['onnxruntime-web', 'onnxruntime-common'],
  },
  assetsInclude: ['**/*.onnx'],
  build: {
    rollupOptions: {
      input: {
        viewer: 'index.html',
        motion: 'motion.html',
        lipsync: 'lipsync.html',
      },
    },
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
