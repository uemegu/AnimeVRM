// しぶきの各瞬間を、ゲームループを止めて時間を手動で進めながら撮る
// 使い方: node mini-game/pool/scripts/splash.js <出力プレフィックス> [big|impact|lens]
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prefix = process.argv[2] || 'splash';
const mode = process.argv[3] || 'big';
const outDir = path.resolve(__dirname, '../test-output');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
    server: { port: 5197, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();
  const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    const t = msg.text();
    if (['error', 'warning'].includes(msg.type()) && !t.includes('Mismatch between texture format') && !t.includes('removeUnnecessaryJoints'))
      console.log(`[console ${msg.type()}]`, t.slice(0, 400));
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err));

  await page.addInitScript(() => localStorage.setItem('player_audio_muted', 'true'));
  await page.goto('http://127.0.0.1:5197/');
  await page.waitForTimeout(5000);
  await page.locator('#btn-start').click();
  await page.waitForTimeout(400);

  // ゲームループを止め、update を手動で呼べるようにする
  await page.evaluate(() => {
    const g = window.__GAME__;
    g.__step = g.update.bind(g);
    g.update = () => {};
    g.cameraMode = 'free';
    // UI を隠して水だけ見る
    document.querySelectorAll('.hud-header, .prediction-deck, .hud-footer, .deck-speech-bubble').forEach((e) => (e.style.display = 'none'));
  });
  const step = (n) =>
    page.evaluate((n) => {
      const g = window.__GAME__;
      for (let i = 0; i < n; i++) g.__step(1 / 60);
    }, n);
  const shot = async (name) => {
    await step(1);
    await page.screenshot({ path: path.join(outDir, `${prefix}_${name}.png`) });
  };
  const setCam = (pos, target) =>
    page.evaluate(([p, t]) => {
      const g = window.__GAME__;
      g.camera.position.set(...p);
      g.controls.target.set(...t);
      g.controls.update();
    }, [pos, target]);

  if (mode === 'fall') {
    // 実際の対戦を動かし、誰かが落ち始めた瞬間に止めて、そこから手動で進める
    await page.evaluate(() => {
      const g = window.__GAME__;
      g.update = g.__step;
      g.cameraMode = 'dramatic';
    });
    await page.evaluate(() => window.__GAME__.submitPrediction('aoi'));
    for (let i = 0; i < 600; i++) {
      const fell = await page.evaluate(() => {
        const g = window.__GAME__;
        return g.fighterAoi.state === 'falling' || g.fighterEmili.state === 'falling';
      });
      if (fell) break;
      await page.waitForTimeout(30);
    }
    await page.evaluate(() => {
      const g = window.__GAME__;
      g.update = () => {};
    });
    let t = 0;
    for (const target of [0.0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0, 1.3, 1.7, 2.2]) {
      await step(Math.round((target - t) * 60));
      t = target;
      const info = await page.evaluate(() => {
        const g = window.__GAME__;
        const c = g.camera.position;
        return `cam(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) splashTimer=${g.splashCamTimer.toFixed(2)} aoi=${g.fighterAoi.state} emili=${g.fighterEmili.state} particles=${g.water.activeParticles}`;
      });
      console.log(target, info);
      await shot(`fall-${String(Math.round(target * 100)).padStart(3, '0')}`);
    }
    await browser.close();
    await server.close();
    return;
  }

  await step(120);

  if (mode === 'big') {
    await setCam([4.9, 1.05, 3.4], [2.6, 0.35, 0.6]);
    await step(60);
    await shot('t-000_before');
    await page.evaluate(() => {
      const g = window.__GAME__;
      const V = g.camera.position.constructor;
      g.water.triggerBigSplash(new V(2.6, 0, 0.6), 1.0);
    });
    let t = 0;
    for (const target of [0.04, 0.1, 0.18, 0.28, 0.4, 0.55, 0.75, 1.0, 1.5, 2.2, 3.2]) {
      const n = Math.round((target - t) * 60);
      await step(n);
      t = target;
      await shot(`t-${String(Math.round(target * 100)).padStart(3, '0')}`);
    }
  } else if (mode === 'impact') {
    await setCam([3.9, 0.85, 2.6], [1.0, 0.2, 0.4]);
    await step(60);
    await page.evaluate(() => {
      const g = window.__GAME__;
      const V = g.camera.position.constructor;
      const p = new V(1.0, 0.1, 0.6);
      g.island.applyImpulse(new V(0, -2.4, 2.2), p);
      g.water.triggerImpactSplash(p, 1.2);
    });
    let t = 0;
    for (const target of [0.05, 0.15, 0.3, 0.5, 0.8, 1.3]) {
      await step(Math.round((target - t) * 60));
      t = target;
      await shot(`t-${String(Math.round(target * 100)).padStart(3, '0')}`);
    }
  } else if (mode === 'perf') {
    // 大しぶき中の update 1 回あたりの CPU 時間
    await setCam([4.9, 1.05, 3.4], [2.6, 0.35, 0.6]);
    await step(60);
    const idle = await page.evaluate(() => {
      const g = window.__GAME__;
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) g.__step(1 / 60);
      return (performance.now() - t0) / 60;
    });
    await page.evaluate(() => {
      const g = window.__GAME__;
      const V = g.camera.position.constructor;
      g.water.triggerBigSplash(new V(2.6, 0, 0.6), 1.4);
      g.water.triggerBigSplash(new V(-2.6, 0, 0.6), 1.4);
    });
    const busy = await page.evaluate(() => {
      const g = window.__GAME__;
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) g.__step(1 / 60);
      return { ms: (performance.now() - t0) / 30, particles: g.water.activeParticles };
    });
    console.log('idle ms/update', idle.toFixed(2), ' splash ms/update', busy.ms.toFixed(2), 'particles(after 0.5s)', busy.particles);
  } else if (mode === 'next') {
    // 落水後に次のラウンドへ進んだとき、レンズの水滴としぶきが消えること
    await page.evaluate(() => {
      const g = window.__GAME__;
      const V = g.camera.position.constructor;
      g.water.triggerBigSplash(new V(2.6, 0, 0.6), 1.0);
      g.lensDroplets.setWetness(1);
    });
    await step(90);
    await shot('before-next');
    await page.evaluate(() => window.__GAME__.startRound());
    await step(30);
    await shot('next-0.5s');
    await step(90);
    await shot('next-2s');
    console.log(await page.evaluate(() => `wet=${window.__GAME__.lensDroplets.wetness.toFixed(3)} particles=${window.__GAME__.water.activeParticles}`));
  } else if (mode === 'debug') {
    await setCam([4.9, 1.05, 3.4], [2.6, 0.35, 0.6]);
    await step(60);
    for (const d of [0, 1, 2, 3, 4]) {
      await page.evaluate((d) => {
        window.__GAME__.water.surface.material.uniforms.uDebug.value = d;
      }, d);
      await shot(`dbg-${d}`);
    }
  } else if (mode === 'lens') {
    await setCam([0.0, 1.3, 4.0], [0, 0.9, 0]);
    await step(30);
    for (const w of [0.25, 0.6, 1.0]) {
      await page.evaluate((w) => window.__GAME__.lensDroplets.setWetness(w), w);
      await step(30);
      await shot(`wet-${Math.round(w * 100)}`);
    }
  }

  await browser.close();
  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
