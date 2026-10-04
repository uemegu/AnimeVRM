#!/usr/bin/env node
/**
 * シナリオのカットを撮影する（Studio のプレビューと同じ描画。サーバーなしで動く）。
 *
 *   npm run shot -- demo/test_demo                   すべてのカット → scratch/shots/demo/test_demo/<番号>_<シーンID>.png
 *   npm run shot -- demo/test_demo --scene s3        指定したカットだけ（シーン ID か 0 始まりの番号。カンマ区切りで複数）
 *   npm run shot -- demo/test_demo --scene s3 --time 2.5 -o out.png
 *   npm run shot -- demo/test_demo --file draft.json 保存していない JSON を撮る（相対パスの基準は <種類>/<ID> のディレクトリ）
 *
 * そのほか: --outfit default|private|commute、--width / --height（既定 1280x720。縦型のシナリオは 720x1280）、--no-dialogue（セリフ枠を消す）、
 * --no-hud（左上の場所・時間帯・構図の表示を消す）、--settle 秒（読み込み後に待つ時間。既定 1.5）、
 * --url http://127.0.0.1:5175/（起動中の Studio の開発サーバーを使う）、--headed
 *
 * 音は鳴らさない（ブラウザを --mute-audio で起動する）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, type Browser } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scene: { type: 'string', short: 's' },
    time: { type: 'string', short: 't', default: '0' },
    output: { type: 'string', short: 'o' },
    file: { type: 'string' },
    outfit: { type: 'string', default: 'default' },
    width: { type: 'string' },
    height: { type: 'string' },
    'no-dialogue': { type: 'boolean', default: false },
    'no-hud': { type: 'boolean', default: false },
    settle: { type: 'string', default: '1.5' },
    url: { type: 'string' },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (options.help || positionals.length !== 1) {
  console.log('使い方: npm run shot -- <種類>/<ID> [--scene <ID|番号>[,...]] [--time 秒] [-o 出力.png] [--file 下書き.json] ...');
  process.exit(options.help ? 0 : 1);
}

const [category, id] = positionals[0].split('/');
if (!category || !id) fail('シナリオは <種類>/<ID> で指定してください（例: demo/test_demo）');
if (category === 'call' || category === 'mail') fail('電話・メールは撮影できません');
const scenarioFile = options.file ? path.resolve(options.file) : path.join(REPO_ROOT, 'assets/scenarios', category, id, 'scenario.json');
if (!fs.existsSync(scenarioFile)) fail(`シナリオがありません: ${path.relative(REPO_ROOT, scenarioFile)}`);
const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8')) as { scenes?: { id: string }[]; aspect?: string };
const scenes = scenario.scenes ?? [];
if (scenes.length === 0) fail('シーンがありません');

/** 撮るカットの番号 */
const indices = options.scene
  ? options.scene.split(',').map((key) => {
      const index = /^\d+$/.test(key) ? Number(key) : scenes.findIndex((s) => s.id === key);
      if (index < 0 || index >= scenes.length) fail(`カット "${key}" がありません（${scenes.map((s) => s.id).join(', ')}）`);
      return index;
    })
  : scenes.map((_, i) => i);
if (options.output && indices.length !== 1) fail('-o は1カットだけ撮るときに使います（複数なら出力先は scratch/shots/）');

const time = Number(options.time);
const settleMs = Number(options.settle) * 1000;
const portrait = scenario.aspect === 'portrait';
const width = Number(options.width ?? (portrait ? 720 : 1280));
const height = Number(options.height ?? (portrait ? 1280 : 720));
if (![time, settleMs, width, height].every(Number.isFinite)) fail('--time・--settle・--width・--height は数値で指定してください');
if (!['default', 'private', 'commute'].includes(options.outfit)) fail('--outfit は default / private / commute のいずれかです');

const outputDir = path.join(REPO_ROOT, 'scratch/shots', category, id);
const outputOf = (index: number) =>
  options.output ? path.resolve(options.output) : path.join(outputDir, `${String(index).padStart(3, '0')}_${scenes[index].id.replace(/[^\w-]/g, '_')}.png`);

// Studio の開発サーバー（素材は assets/ を配信する）。--url がなければこの場で立てる
let viteServer: { close: () => Promise<void>; listen: () => Promise<unknown>; httpServer: { address: () => unknown } | null } | null = null;
let baseUrl = options.url;
if (!baseUrl) {
  const { createServer } = await import('vite');
  const studioRoot = path.join(REPO_ROOT, 'studio');
  const server = await createServer({ root: studioRoot, configFile: path.join(studioRoot, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  viteServer = server as unknown as typeof viteServer;
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') fail('Vite の待ち受けポートが分かりません');
  baseUrl = `http://127.0.0.1:${address.port}/`;
}

let browser: Browser | null = null;
try {
  browser = await chromium.launch({ headless: !options.headed, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(new URL('shot.html', baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shot?.ready || window.__shot?.error, undefined, { timeout: 60_000 });
  const setupError = await page.evaluate(() => window.__shot?.error);
  if (setupError) throw new Error(setupError);

  fs.mkdirSync(outputDir, { recursive: true });
  for (const index of indices) {
    const before = errors.length;
    await page.evaluate(
      (request) => window.__shot!.render(request),
      {
        scenario: scenario as never,
        baseUrl: `/scenarios/${category}/${id}/`,
        sceneIndex: index,
        time,
        outfit: options.outfit as 'default',
        dialogue: !options['no-dialogue'],
        hud: !options['no-hud'],
      }
    );
    // モデル・モーション・背景の読み込みを待ち、カメラの移動と表情の切り替えが落ち着くまで待つ
    await page.waitForLoadState('networkidle', { timeout: 120_000 });
    await page.waitForTimeout(settleMs);
    const file = outputOf(index);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
    console.log(`${path.relative(process.cwd(), file)}  （${index}: ${scenes[index].id}）`);
    for (const message of errors.slice(before)) console.error(`  ブラウザのエラー: ${message}`);
  }
  if (errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await viteServer?.close();
}
