// 対戦を横から撮る（ゲームループを止めて 1/60 秒ずつ進める）
// 使い方: node mini-game/pool/scripts/fight.js <プレフィックス> [開始秒] [終了秒] [間隔秒]
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prefix = process.argv[2] || 'fight';
const from = Number(process.argv[3] || 0), to = Number(process.argv[4] || 6), every = Number(process.argv[5] || 0.25);
const outDir = path.resolve(__dirname, '../test-output');
fs.mkdirSync(outDir, { recursive: true });
const server = await createServer({ configFile: path.resolve(__dirname, '../vite.config.ts'), server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.error(e));
await page.addInitScript(() => { localStorage.setItem('player_audio_muted', 'true'); Math.random = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })(); });
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const g = window.__GAME__;
  g.__step = g.update.bind(g); g.update = () => {};
  document.querySelectorAll('.hud-header, .prediction-deck, .hud-footer, .deck-speech-bubble, .start-overlay, .center-banner').forEach((e) => (e.style.display = 'none'));
  g.startRound(); g.selectedPrediction = 'aoi'; g.gameState = 'fight'; g.fightTime = 0;
  g.cameraMode = 'free';
});
let t = 0;
const step = (sec) => page.evaluate((n) => { const g = window.__GAME__; for (let i = 0; i < n; i++) { g.__step(1 / 60); g.camera.position.set(3.1, 1.0, 0.0); g.controls.target.set(0, 0.75, 0); g.controls.update(); } }, Math.round(sec * 60));
await step(from); t = from;
let i = 0;
while (t < to) {
  await step(every); t += every;
  const info = await page.evaluate(() => { const g = window.__GAME__; return `${g.fighterAoi.state}/${g.fighterEmili.state} gap=${(g.fighterAoi.rearZ - g.fighterEmili.rearZ).toFixed(3)}`; });
  await page.screenshot({ path: path.join(outDir, `${prefix}_${String(i).padStart(2, '0')}.png`) });
  console.log(String(i).padStart(2, '0'), t.toFixed(2), info);
  i++;
}
await browser.close(); await server.close();
