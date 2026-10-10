import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * 水上ヒップアタック相撲（プール）。
 *  - 開発: npm run pool（http://localhost:5178）。リポジトリ直下の assets/（モデル・モーション・リップシンクの WASM）も配信する
 *  - 本番: npm run build:pool で docs/pool/ に書き出す。Pages では https://uemegu.github.io/AnimeVRM/pool/
 */
const REPO = path.resolve(__dirname, '../..');
const ROOT_ASSETS = path.join(REPO, 'assets'); // リポジトリ共通の素材
const POOL_ASSETS = path.join(__dirname, 'assets'); // プール専用の素材（モーション・ボイス・BGM・SE）
const OUT = process.env.POOL_OUT_DIR ? path.resolve(process.env.POOL_OUT_DIR) : path.join(REPO, 'docs/pool');
const BASE = '/AnimeVRM/pool/';

/** 本番に出す素材。共通 assets/ からは使うものだけ、プール専用 assets/ からは種類ごとに絞ってコピーする */
function collectAssets(): Array<{ from: string; to: string }> {
  const list: Array<{ from: string; to: string }> = [];
  const add = (fromDir: string, toDir: string, file: string) => list.push({ from: path.join(fromDir, file), to: path.join(OUT, toDir, file) });

  for (const f of ['models/aoi/aoi-swim.vrm', 'models/emili/emili-swim.vrm', 'worklets/lipsync-processor.js', 'wasm/lipsync.wasm']) {
    add(ROOT_ASSETS, '', f);
  }
  const each = (sub: string, keep: (name: string) => boolean) => {
    for (const name of fs.readdirSync(path.join(POOL_ASSETS, sub))) {
      if (keep(name)) add(POOL_ASSETS, 'assets', `${sub}/${name}`);
    }
  };
  each('motions', (n) => n.endsWith('.fbx'));
  each('voices', (n) => n.endsWith('.wav') && !n.endsWith('_ref.wav')); // 参照音声は生成用
  each('se', (n) => n.endsWith('.mp3'));
  each('bgm', (n) => n.endsWith('.mp3'));
  return list;
}

/** ビルド後に、使う素材だけを出力先へコピーする */
function poolAssets(): Plugin {
  return {
    name: 'pool-assets',
    apply: 'build',
    closeBundle() {
      const files = collectAssets();
      let bytes = 0;
      for (const { from, to } of files) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        bytes += fs.statSync(from).size;
      }
      fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
      console.log(`[pool] 素材 ${files.length} 件（${(bytes / 1024 / 1024).toFixed(1)} MB）をコピーしました`);
    },
  };
}

/** 開発サーバー: 共通 assets/ の素材を、Pages と同じ URL で配信する */
function serveRootAssets(): Plugin {
  return {
    name: 'serve-root-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = decodeURIComponent(req.url.split('?')[0]);
        const types: Record<string, string> = {
          '/models/': 'model/gltf-binary',
          '/animations/': 'application/octet-stream',
          '/worklets/': 'text/javascript',
          '/wasm/': 'application/wasm',
        };
        const prefix = Object.keys(types).find((p) => url.startsWith(p));
        if (prefix) {
          const filePath = path.join(ROOT_ASSETS, url.slice(1));
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', types[prefix]);
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  root: __dirname,
  // ビルドと、ビルド結果の確認（vite preview）は Pages と同じサブパスで配信する
  base: command === 'build' || isPreview ? BASE : '/',
  publicDir: false,
  resolve: {
    alias: {
      '@anime-vrm/engine': path.join(REPO, 'packages/engine/src'),
      '@anime-vrm/scenario': path.join(REPO, 'packages/scenario/src'),
    },
  },
  server: {
    port: 5178,
    fs: { allow: [REPO] },
  },
  preview: { port: 5179 },
  plugins: [serveRootAssets(), poolAssets()],
  build: {
    outDir: OUT,
    // docs/ には Studio の Pages 版もあるので、docs/pool/ の中だけを空にする
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
}));
