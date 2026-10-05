#!/usr/bin/env node
/**
 * カットの構図のチェック：話者の顔が画面に入っているか（GEMINI.md「カメラは話者の顔を映す」）。
 * 撮影ツール（npm run shot）と同じ描画で各カットを映し、話者の頭の画面上の位置を調べる。
 *
 *   npm run check:framing                           ゲーム本編のシナリオ全部（demo を除く）
 *   npm run check:framing -- action/aoi_d01_classroom forced   <種類>/<ID> か <種類> で絞る
 *   npm run check:framing -- --shots                 外れたカットを scratch/shots/framing/ に撮る
 *
 * 外れとみなす：頭が画面の外・上端に切れる・下のセリフ枠に隠れる位置。一枚絵を出しているカットは調べない。
 * 音は鳴らさない（--mute-audio）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { stageAtScene, type ScenarioPackage } from '../packages/scenario/src/index.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS = path.join(REPO_ROOT, 'assets/scenarios');

const { values: options, positionals: filters } = parseArgs({
  allowPositionals: true,
  options: {
    shots: { type: 'boolean', default: false },
    settle: { type: 'string', default: '1.2' },
    json: { type: 'boolean', default: false },
  },
});

/** 頭の位置（-1〜1、上が +1）がこの範囲なら顔が見えている。下はセリフ枠（画面の下 3 割ほど）の上端 */
const LIMIT = { x: 0.92, top: 0.92, bottom: -0.38 };

const targets: { category: string; id: string; scenario: ScenarioPackage }[] = [];
for (const category of fs.readdirSync(SCENARIOS).sort()) {
  if (['demo', 'call', 'mail'].includes(category)) continue;
  const dir = path.join(SCENARIOS, category);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const id of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, id, 'scenario.json');
    if (!fs.existsSync(file)) continue;
    if (filters.length && !filters.some((f) => f === category || f === `${category}/${id}`)) continue;
    targets.push({ category, id, scenario: JSON.parse(fs.readFileSync(file, 'utf8')) });
  }
}

const { createServer } = await import('vite');
const studioRoot = path.join(REPO_ROOT, 'studio');
const server = await createServer({ root: studioRoot, configFile: path.join(studioRoot, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === 'string') throw new Error('Vite の待ち受けポートが分かりません');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const findings: { scenario: string; scene: string; index: number; speaker: string; x: number; y: number; reason: string }[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${address.port}/shot.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shot?.ready || window.__shot?.error, undefined, { timeout: 60_000 });
  for (const { category, id, scenario } of targets) {
    for (const [index, scene] of scenario.scenes.entries()) {
      const speaker = scene.speakerCharacterId;
      if (!speaker || speaker === 'player') continue;
      const stage = stageAtScene(scenario, index);
      if (stage.cg || !stage.cast[speaker]) continue;
      await page.evaluate((request) => window.__shot!.render(request), {
        scenario: scenario as never,
        baseUrl: `/scenarios/${category}/${id}/`,
        sceneIndex: index,
        time: 0,
        outfit: 'default' as const,
        dialogue: true,
        hud: false,
      });
      await page.waitForLoadState('networkidle', { timeout: 120_000 });
      await page.waitForTimeout(Number(options.settle) * 1000);
      const head = (await page.evaluate(() => window.__shot!.heads?.() ?? [])).find((h) => h.id === speaker);
      if (!head) continue;
      const reason = head.behind
        ? 'カメラの後ろ'
        : Math.abs(head.x) > LIMIT.x
          ? '画面の左右の外'
          : head.y > LIMIT.top
            ? '頭が上に切れている（カメラが下を向いている）'
            : head.y < LIMIT.bottom
              ? '顔がセリフ枠に隠れる高さ'
              : '';
      if (!reason) continue;
      const finding = { scenario: `${category}/${id}`, scene: scene.id, index, speaker, x: +head.x.toFixed(2), y: +head.y.toFixed(2), reason };
      findings.push(finding);
      if (!options.json) console.log(`${finding.scenario}  ${index}:${scene.id}  ${speaker}  (${finding.x}, ${finding.y})  ${reason}`);
      if (options.shots) {
        const file = path.join(REPO_ROOT, 'scratch/shots/framing', category, id, `${String(index).padStart(3, '0')}_${scene.id}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await page.screenshot({ path: file });
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (options.json) console.log(JSON.stringify(findings, null, 2));
else console.log(`\n${targets.length} 本を調べ、顔が映っていないカット ${findings.length} 件`);
