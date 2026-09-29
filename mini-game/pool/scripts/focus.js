// 予想画面: カードにフォーカスしたとき、顔がカメラを向くか
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../test-output');
fs.mkdirSync(outDir, { recursive: true });
const prefix = process.argv[2] || 'focus';
const server = await createServer({ configFile: path.resolve(__dirname, '../vite.config.ts'), server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(e));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console error]', m.text().slice(0, 300)); });
await page.addInitScript(() => localStorage.setItem('player_audio_muted', 'true'));
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(5000);
await page.locator('#btn-start').click();
await page.waitForTimeout(600);
for (const who of ['aoi', 'emili']) {
  await page.locator(`#card-${who}`).hover();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(outDir, `${prefix}_${who}.png`) });
}
await page.mouse.move(640, 100);
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, `${prefix}_none.png`) });
await browser.close(); await server.close();
