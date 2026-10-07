/**
 * Pages に出す素材（ビルド出力）の中身から、Studio サーバーの GET API を JSON に書き出す（api/<パス>.json）。
 * 本番の Studio はサーバーなしの読み取り専用なので、この JSON を API の代わりに読む（studio/src/api/client.ts）。
 * 一覧はコピーした素材だけを返したいので、サーバーの読み取りルートをコピー後のディレクトリに向けて呼ぶ。
 *
 * 使い方: node pages/bakeApi.ts <ビルド出力のディレクトリ>
 */
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { ASSET_KINDS, assetRoutes } from '../../server/src/routes/assets.ts';
import { characterRoutes } from '../../server/src/routes/characters.ts';
import { projectRoutes } from '../../server/src/routes/projects.ts';
import { scenarioRoutes } from '../../server/src/routes/scenarios.ts';
import { studioDataRoutes } from '../../server/src/routes/studioData.ts';
import { ScenarioStore } from '../../server/src/scenarioStore.ts';
import type { ServerConfig } from '../../server/src/config.ts';

interface Json {
  [key: string]: any;
}

const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(path.join(out, 'studio'))) throw new Error('使い方: node pages/bakeApi.ts <ビルド出力のディレクトリ>');

const readJson = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};
/** サイト内の絶対パス（/models/...）の素材があるか。外部 URL などパスでないものは「ある」とみなす */
const has = (url: unknown) => typeof url !== 'string' || !url.startsWith('/') || fs.existsSync(path.join(out, url));

// 1. コピーしなかった素材を指す項目を、マスターデータから除く
const studio = (name: string) => path.join(out, 'studio', `${name}.json`);

const characters = readJson(studio('characters'));
characters.characters = (characters.characters as Json[])
  .map((c) => ({ ...c, models: (c.models as Json[]).filter((m) => has(m.url)) }))
  .filter((c) => c.models.length > 0);
writeJson(studio('characters'), characters);

const locations = readJson(studio('locations'));
locations.presets = Object.fromEntries(
  Object.entries(locations.presets as Record<string, Json>).filter(([, p]) => Object.values((p.layers ?? {}) as Record<string, Json>).every((l) => has(l?.url)))
);
writeJson(studio('locations'), locations);

const bgm = readJson(studio('bgm'));
bgm.bgm = Object.fromEntries(Object.entries(bgm.bgm as Record<string, Json>).filter(([, b]) => has(b.url)));
writeJson(studio('bgm'), bgm);

// 中身のあるプロジェクトだけを残す
const projects = readJson(studio('projects'));
projects.projects = (projects.projects as Json[]).filter((p) => (p.categories as string[]).some((c) => fs.existsSync(path.join(out, 'scenarios', c))));
writeJson(studio('projects'), projects);

// 2. サーバーの読み取りルートを呼んで書き出す
const config = { assetsDir: out, repoRoot: out } as ServerConfig;
const store = new ScenarioStore(config);
const app = new Hono();
app.route('/projects', projectRoutes(config));
app.route('/scenarios', scenarioRoutes(config, store));
app.route('/assets', assetRoutes(config));
app.route('/studio-data', studioDataRoutes(config));
app.route('/characters', characterRoutes(config, store));

let count = 0;
async function bake(route: string): Promise<unknown> {
  const res = await app.request(route);
  if (!res.ok) throw new Error(`${route} が ${res.status} を返しました`);
  const data = await res.json();
  // VRM のサムネイルは静的ファイルとして配信する
  const text = JSON.stringify(data, null, 2).replaceAll('/api/assets/thumbnails/', '/thumbnails/');
  const file = path.join(out, 'api', `${route}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text + '\n');
  count += 1;
  return JSON.parse(text);
}

await bake('/projects');
const scenarios = (await bake('/scenarios')) as { category: string; id: string }[];
for (const { category, id } of scenarios) await bake(`/scenarios/${category}/${encodeURIComponent(id)}`);
const book = (await bake('/characters')) as { characters: { id: string }[] };
for (const c of book.characters) await bake(`/characters/${encodeURIComponent(c.id)}/usage`);
for (const kind of Object.keys(ASSET_KINDS)) await bake(`/assets/${kind}`);
for (const name of (await bake('/studio-data')) as string[]) await bake(`/studio-data/${encodeURIComponent(name)}`);

console.log(`[pages] API の JSON を ${count} 件書き出しました`);
