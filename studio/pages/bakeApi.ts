/** コピー済みのビューア素材から、サーバー不要の GET API JSON とサムネイルを作る。 */
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { assetRoutes } from '../../server/src/routes/assets.ts';
import type { ServerConfig } from '../../server/src/config.ts';

const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(path.join(out, 'studio'))) throw new Error('使い方: node pages/bakeApi.ts <ビルド出力のディレクトリ>');

const studioFile = (name: string) => path.join(out, 'studio', `${name}.json`);
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};
const has = (url: string) => !url.startsWith('/') || fs.existsSync(path.join(out, url));

const characters = readJson(studioFile('characters'));
characters.characters = characters.characters
  .map((c: { models: { url: string }[] }) => ({ ...c, models: c.models.filter((m) => has(m.url)) }))
  .filter((c: { models: unknown[] }) => c.models.length > 0);
writeJson(studioFile('characters'), characters);
writeJson(path.join(out, 'api/characters.json'), characters);

const bgm = readJson(studioFile('bgm'));
bgm.bgm = Object.fromEntries(Object.entries(bgm.bgm as Record<string, { url: string }>).filter(([, b]) => has(b.url)));
writeJson(studioFile('bgm'), bgm);
writeJson(path.join(out, 'api/studio-data/bgm.json'), bgm);

// 一覧はサーバーと同じ処理を使う。VRM に埋め込まれたサムネイルもここで取り出す。
const app = new Hono();
app.route('/assets', assetRoutes({ assetsDir: out } as ServerConfig));
for (const kind of ['models', 'animations', 'voices', 'bgm', 'se']) {
  const res = await app.request(`/assets/${kind}`);
  if (!res.ok) throw new Error(`/assets/${kind} が ${res.status} を返しました`);
  const json = JSON.stringify(await res.json()).replaceAll('/api/assets/thumbnails/', '/thumbnails/');
  writeJson(path.join(out, 'api/assets', `${kind}.json`), JSON.parse(json));
}

console.log('[pages] ビューア用 API の JSON を 7 件書き出しました');
