// 対戦のテンポ: 決着までの秒数、攻撃回数、命中回数を複数ラウンドで測る
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rounds = Number(process.argv[2] || 6);
const server = await createServer({ configFile: path.resolve(__dirname, '../vite.config.ts'), server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error(e));
await page.addInitScript(() => localStorage.setItem('player_audio_muted', 'true'));
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(5000);
for (let r = 0; r < rounds; r++) {
  const res = await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g.__step) { g.__step = g.update.bind(g); g.update = () => {}; }
    g.startRound(); g.selectedPrediction = 'aoi'; g.gameState = 'fight'; g.fightTime = 0;
    let attacks = 0, hits = 0, longestIdle = 0, cur = 0;
    const flags = { aa: false, as: false, ea: false, es: false };
    const log = [];
    let t = 0, nextLog = 0;
    while (t < 90) {
      g.__step(1 / 60); t += 1 / 60;
      const A = g.fighterAoi, E = g.fighterEmili;
      if (A.state === 'attack' && !flags.aa) attacks++;
      if (E.state === 'attack' && !flags.ea) attacks++;
      if (A.state === 'stumble' && !flags.as) hits++;
      if (E.state === 'stumble' && !flags.es) hits++;
      flags.aa = A.state === 'attack'; flags.ea = E.state === 'attack';
      flags.as = A.state === 'stumble'; flags.es = E.state === 'stumble';
      const busy = ['attack', 'stumble', 'falling'].some((s) => A.state === s || E.state === s);
      if (!busy) { cur += 1 / 60; longestIdle = Math.max(longestIdle, cur); } else cur = 0;
      if (t >= nextLog) { nextLog += 3; log.push(`${t.toFixed(0)}s z=(${A.position.z.toFixed(2)},${E.position.z.toFixed(2)}) gap=${(A.rearZ - E.rearZ).toFixed(2)}`); }
      if (g.gameState === 'round_end') break;
    }
    const g2 = window.__GAME__;
    return { finishedAt: t.toFixed(1), attacks, hits, longestIdle: longestIdle.toFixed(2), winner: g2.fighterAoi.state === 'won' ? 'aoi' : 'emili', log: log.join(' | ') };
  });
  console.log(`round ${r + 1}:`, JSON.stringify(res));
}
await browser.close(); await server.close();
