import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ServerConfig } from '../config.ts';
import { resolveInside } from '../safePath.ts';

const AUDIO = ['.mp3', '.ogg', '.wav'];
const IMAGE = ['.avif', '.png', '.jpg', '.jpeg', '.webp'];

/** アセットの種類 → assets/ 以下のディレクトリと拡張子 */
export const ASSET_KINDS = {
  models: { dir: 'models', extensions: ['.vrm'] },
  environments: { dir: 'models', extensions: ['.glb', '.gltf'] },
  animations: { dir: 'animations', extensions: ['.fbx'] },
  textures: { dir: 'textures', extensions: IMAGE },
  bgm: { dir: 'bgm', extensions: AUDIO },
  se: { dir: 'se', extensions: AUDIO },
  voices: { dir: 'voices', extensions: AUDIO },
} as const;
export type AssetKind = keyof typeof ASSET_KINDS;

export interface AssetEntry {
  /** ページから参照する URL パス（例: /models/aoi/aoi-school.vrm） */
  url: string;
  size: number;
  updatedAt: string;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  );
  return files.flat();
}

function isKind(kind: string): kind is AssetKind {
  return Object.hasOwn(ASSET_KINDS, kind);
}

export function assetRoutes(config: ServerConfig) {
  const app = new Hono();

  app.get('/', (c) => c.json(Object.keys(ASSET_KINDS)));

  app.get('/:kind', async (c) => {
    const kind = c.req.param('kind');
    if (!isKind(kind)) return c.json({ error: '不明なアセットの種類です' }, 404);
    const { dir, extensions } = ASSET_KINDS[kind];
    const base = path.join(config.assetsDir, dir);
    const files = (await walk(base)).filter((f) => (extensions as readonly string[]).includes(path.extname(f).toLowerCase()));
    const result: AssetEntry[] = await Promise.all(
      files.sort().map(async (f) => {
        const stat = await fs.stat(f);
        return {
          url: '/' + path.relative(config.assetsDir, f).split(path.sep).join('/'),
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      })
    );
    return c.json(result);
  });

  /**
   * アップロード（本文がファイルの中身）。既にあるファイルは ?overwrite=1 のときだけ上書きする
   * 例: PUT /api/assets/animations/ardy/wave.fbx
   */
  app.put('/:kind/:name{.+}', bodyLimit({ maxSize: 300 * 1024 * 1024 }), async (c) => {
    const kind = c.req.param('kind');
    if (!isKind(kind)) return c.json({ error: '不明なアセットの種類です' }, 404);
    const name = c.req.param('name');
    const { dir, extensions } = ASSET_KINDS[kind];
    if (!(extensions as readonly string[]).includes(path.extname(name).toLowerCase())) {
      return c.json({ error: `拡張子は ${extensions.join(' / ')} のいずれかにしてください` }, 400);
    }
    const file = resolveInside(path.join(config.assetsDir, dir), name);
    if (!file) return c.json({ error: 'ファイル名が不正です' }, 400);
    const exists = await fs.stat(file).then(() => true, () => false);
    if (exists && c.req.query('overwrite') !== '1') {
      return c.json({ error: '同じ名前のファイルがあります（上書きするなら overwrite=1）' }, 409);
    }
    const body = Buffer.from(await c.req.arrayBuffer());
    if (body.length === 0) return c.json({ error: '中身が空です' }, 400);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return c.json({ ok: true, url: '/' + path.relative(config.assetsDir, file).split(path.sep).join('/') }, exists ? 200 : 201);
  });

  return app;
}
