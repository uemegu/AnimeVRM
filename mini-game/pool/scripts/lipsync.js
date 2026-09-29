// リップシンク: 声を鳴らして、解析された母音と口の重みが時間とともに変わるか確認する
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
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('Mismatch') && !m.text().includes('removeUnnec')) console.log('[console]', m.type(), m.text().slice(0, 300)); });
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url()));
page.on('response', (r) => { if (r.status() >= 400) console.log('[http', r.status() + ']', r.url()); });
await page.addInitScript(() => localStorage.setItem('player_audio_muted', 'true'));
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(5000);
await page.locator('#btn-start').click();
await page.waitForTimeout(400);
await page.evaluate(() => window.__GAME__.fighterAoi.playVoice('ready', 0));
await page.waitForTimeout(600);
const rows = await page.evaluate(async () => {
  const f = window.__GAME__.fighterAoi;
  const out = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 4500) {
    await new Promise((r) => setTimeout(r, 150));
    const ls = f.lipSync;
    const w = f.phonemeWeights;
    const em = f.vrm.expressionManager;
    out.push(`${((performance.now() - t0) / 1000).toFixed(2)}s playing=${ls.isPlaying} worklet=${ls.isWorkletReady} phoneme=${ls.currentPhoneme} rms=${ls.currentRms.toFixed(3)} aa=${em.getValue('aa').toFixed(2)} ee=${em.getValue('ee').toFixed(2)} ih=${em.getValue('ih').toFixed(2)} oh=${em.getValue('oh').toFixed(2)} ou=${em.getValue('ou').toFixed(2)}`);
  }
  return out;
});
console.log(rows.join('\n'));
await browser.close(); await server.close();
