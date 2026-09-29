// ビルド結果（docs/pool）を Pages と同じサブパスで配信して動作確認する
// 使い方: npm run build:pool && node mini-game/pool/scripts/built.js
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../test-output');
fs.mkdirSync(outDir, { recursive: true });
const server = await preview({ configFile: path.resolve(__dirname, '../vite.config.ts'), preview: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' });
const url = 'http://127.0.0.1:5199/AnimeVRM/pool/';
const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`); });
page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(url);
await page.waitForTimeout(6000);
await page.locator('#btn-start').click();
await page.waitForTimeout(800);
await page.evaluate(() => {
  const s = window.__GAME__.sound; window.__calls = [];
  const orig = s.play.bind(s); s.play = (id, v) => { window.__calls.push(id); return orig(id, v); };
});
await page.evaluate(() => window.__GAME__.submitPrediction('aoi'));
await page.evaluate(() => window.__GAME__.fighterAoi.playVoice('attack', 0));
await page.waitForTimeout(1200);
const lip = await page.evaluate(() => `worklet=${window.__GAME__.fighterAoi.lipSync.isWorkletReady} phoneme=${window.__GAME__.fighterAoi.lipSync.currentPhoneme}`);
for (let i = 0; i < 120; i++) {
  if (await page.evaluate(() => window.__GAME__.gameState === 'round_end')) break;
  await page.waitForTimeout(500);
}
await page.screenshot({ path: path.join(outDir, 'built.png') });
const info = await page.evaluate(() => `sounds=[${window.__calls}] buffers=[${[...window.__GAME__.sound.buffers.keys()]}]`);
console.log(lip); console.log(info);
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no problems');
await browser.close(); await server.close();
