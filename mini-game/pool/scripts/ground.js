// 足裏（メッシュの最下点）と島の表面の差を、状態ごとに測る
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = await createServer({ configFile: path.resolve(__dirname, '../vite.config.ts'), server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('pageerror', (e) => console.error(e));
await page.addInitScript(() => localStorage.setItem('player_audio_muted', 'true'));
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(5000);
const res = await page.evaluate(() => {
  const g = window.__GAME__;
  g.__step = g.update.bind(g); g.update = () => {};
  const out = [];
  const V = g.camera.position.constructor;
  const measure = (f) => {
    let minY = 9; const p = new V();
    f.vrm.scene.updateMatrixWorld(true);
    f.vrm.scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const n = o.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 2) { o.getVertexPosition(i, p); p.applyMatrix4(o.matrixWorld); if (p.y < minY) minY = p.y; }
    });
    const surf = g.island.getSurfaceHeightAt(f.position.x, f.position.z);
    return { solesAboveSurface: minY - surf, groupY: f.group.position.y, surf };
  };
  const run = (label, f, setup, seconds) => {
    setup();
    for (let i = 0; i < Math.round(seconds * 60); i += 6) {
      for (let k = 0; k < 6; k++) g.__step(1 / 60);
      const m = measure(f);
      out.push(`${label} t=${((i + 6) / 60).toFixed(2)} state=${f.state} soleΔ=${m.solesAboveSurface.toFixed(3)} tilt=(${g.island.tiltX.toFixed(2)},${g.island.tiltZ.toFixed(2)})`);
    }
  };
  g.gameState = 'ready';
  run('ready', g.fighterAoi, () => {}, 0.6);
  run('attack', g.fighterAoi, () => g.fighterAoi.triggerAttack('normal'), 1.2);
  run('hit', g.fighterEmili, () => g.fighterEmili.takeHit(new V(0, 0, 0.6), 'normal'), 1.2);
  return out;
});
console.log(res.join('\n'));
await browser.close(); await server.close();
