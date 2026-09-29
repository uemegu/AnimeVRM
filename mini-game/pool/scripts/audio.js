// 音: 読み込み、BGM/水のループ、効果音の呼び出しを検証する（--mute-audio で実際には鳴らさない）
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = await createServer({ configFile: path.resolve(__dirname, '../vite.config.ts'), server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.error('[pageerror]', e));
page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[Sound]')) console.log('[console]', m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const s = window.__GAME__.sound;
  window.__calls = [];
  const orig = s.play.bind(s);
  s.play = (id, v) => { window.__calls.push(`play:${id}`); return orig(id, v); };
  const start = s.startLoop.bind(s);
  s.startLoop = (id, f) => { window.__calls.push(`loop:${id}`); return start(id, f); };
  const stop = s.stopLoop.bind(s);
  s.stopLoop = (id, f) => { window.__calls.push(`stop:${id}`); return stop(id, f); };
});
await page.locator('#btn-start').click();
await page.waitForTimeout(2500);
const st = () => page.evaluate(() => { const s = window.__GAME__.sound; return `ctx=${s.ctx && s.ctx.state} buffers=[${[...s.buffers.keys()]}] loops=[${[...s.loops.keys()]}]`; });
console.log('after start:', await st());
await page.evaluate(() => window.__GAME__.submitPrediction('aoi'));
await page.waitForTimeout(1500);
console.log('after predict:', await st());
for (let i = 0; i < 200; i++) {
  const done = await page.evaluate(() => window.__GAME__.gameState === 'round_end');
  if (done) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(2500);
console.log('after finish:', await st());
console.log('calls:', (await page.evaluate(() => window.__calls)).join(', '));
await browser.close(); await server.close();
