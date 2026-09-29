// 水表現の確認用: 通常時の水面と、落下〜着水〜水滴の連写を撮る
// 使い方: node mini-game/pool/scripts/water.js <出力プレフィックス>
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prefix = process.argv[2] || 'water';
const outDir = path.resolve(__dirname, '../test-output');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
    server: { port: 5196, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();

  const browser = await chromium.launch({
    args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) console.log(`[console ${msg.type()}]`, msg.text().slice(0, 400));
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err));

  await page.addInitScript(() => {
    localStorage.setItem('player_audio_muted', 'true');
  });
  await page.goto('http://127.0.0.1:5196/');
  await page.waitForTimeout(5000);
  await page.locator('#btn-start').click();
  await page.waitForTimeout(500);

  // 1. 予想フェーズの初期構図（水面が広く映る）
  await page.screenshot({ path: path.join(outDir, `${prefix}_01_idle.png`) });

  // 2. 水面を低い位置から見るカメラ（free）
  await page.evaluate(() => {
    const g = window.__GAME__;
    g.cameraMode = 'free';
    g.camera.position.set(4.6, 1.0, 3.2);
    g.controls.target.set(0, 0.2, 0);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, `${prefix}_02_low.png`) });

  // 2.5 フレームレート（ヘッドレスの目安）
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
          else resolve((n * 1000) / (performance.now() - t0));
        };
        requestAnimationFrame(tick);
      })
  );
  console.log('fps (idle):', fps.toFixed(1));

  // 3. 試合を進めて落下を待つ（dramatic カメラに戻す）
  await page.evaluate(() => {
    window.__GAME__.cameraMode = 'dramatic';
  });
  await page.locator('#btn-predict-aoi').click();

  // 対戦中のフレームレート
  await page.waitForTimeout(2500);
  const fpsFight = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
          else resolve((n * 1000) / (performance.now() - t0));
        };
        requestAnimationFrame(tick);
      })
  );
  console.log('fps (fight):', fpsFight.toFixed(1));

  let fell = false;
  for (let i = 0; i < 400 && !fell; i++) {
    fell = await page.evaluate(() => {
      const g = window.__GAME__;
      return g.fighterAoi.state === 'falling' || g.fighterEmili.state === 'falling';
    });
    if (!fell) await page.waitForTimeout(50);
  }
  console.log('fell:', fell);
  const t0 = Date.now();
  for (let i = 0; i < 14; i++) {
    await page.screenshot({ path: path.join(outDir, `${prefix}_fall_${String(i).padStart(2, '0')}.png`) });
    await page.waitForTimeout(120);
  }
  console.log('burst ms', Date.now() - t0);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, `${prefix}_fall_late.png`) });

  await browser.close();
  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
