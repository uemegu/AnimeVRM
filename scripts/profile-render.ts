#!/usr/bin/env node
/**
 * 描画の重さを測る（Studio の撮影ページ shot.html を Playwright で開く。サーバーなしで動く）。
 *
 *   npm run profile -- demo/shopping_street            カット 0 を測る（npm run profile は node scripts/profile-render.ts）
 *   npm run profile -- demo/two_girls --scene 3 --quality low --quick   1フレームの時間だけ
 *
 * 測り方：描画ループを手動で続けて回して GPU の完了まで待ち、1フレームの時間（中央値）を測る。処理を1つずつ切ってどれだけ減るかも出す。
 * （Apple の GPU は timer query の値が当てにならず、処理ごとに GPU を待つと待ち時間が乗るため、切って比べる）
 * --eval で、測る前に設定を変えられる（m が StageManager。例: --eval "m.setQuality({ maxPixelRatio: 1.25 })"）。
 * 既定の画面は iPad Air 相当（1180x820、画素比 2）。--width / --height / --dpr で変える。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium, type Browser } from '@playwright/test';
import { assetsDirOfCategory, loadExternalProjects } from '../packages/scenario/src/node.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scene: { type: 'string', short: 's', default: '0' },
    quality: { type: 'string', default: 'high' },
    width: { type: 'string', default: '1180' },
    height: { type: 'string', default: '820' },
    dpr: { type: 'string', default: '2' },
    frames: { type: 'string', default: '150' },
    settle: { type: 'string', default: '3' },
    headed: { type: 'boolean', default: false },
    // 測る前にページで実行する JS（m が StageManager）。設定を変えたときの重さを試す用
    eval: { type: 'string' },
    // 切って比べるのを省き、1フレームの時間だけ測る
    quick: { type: 'boolean', default: false },
  },
});

const [category, id] = (positionals[0] ?? '').split('/');
if (!category || !id) {
  console.log('使い方: node scripts/profile-render.ts <種類>/<ID> [--scene 番号] [--quality high|low] [--width] [--height] [--dpr]');
  process.exit(1);
}
const workspace = { repoRoot: REPO_ROOT, assetsDir: path.join(REPO_ROOT, 'assets'), projects: loadExternalProjects(REPO_ROOT) };
const scenarioFile = path.join(assetsDirOfCategory(workspace, category), 'scenarios', category, id, 'scenario.json');
const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
const sceneIndex = Number(options.scene);
const frames = Number(options.frames);

const { createServer } = await import('vite');
const studioRoot = path.join(REPO_ROOT, 'studio');
const server = await createServer({ root: studioRoot, configFile: path.join(studioRoot, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === 'string') throw new Error('Vite の待ち受けポートが分かりません');
const baseUrl = `http://127.0.0.1:${address.port}/`;

let browser: Browser | null = null;
try {
  browser = await chromium.launch({
    headless: !options.headed,
    args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: { width: Number(options.width), height: Number(options.height) },
    deviceScaleFactor: Number(options.dpr),
  });
  page.on('pageerror', (err) => console.error('ブラウザのエラー:', err.message));
  await page.goto(new URL(`shot.html?quality=${options.quality}`, baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shot?.ready || window.__shot?.error, undefined, { timeout: 60_000 });
  await page.evaluate((request) => window.__shot!.render(request), {
    scenario, baseUrl: `/scenarios/${category}/${id}/`, sceneIndex, time: 0, outfit: 'default' as const, dialogue: true, hud: false,
  });
  await page.waitForLoadState('networkidle', { timeout: 120_000 });
  await page.waitForTimeout(Number(options.settle) * 1000);

  if (options.eval) {
    await page.evaluate((code) => new Function('m', code)(window.__shot!.manager!()), options.eval);
    await page.waitForTimeout(500);
  }
  const result = await page.evaluate(async ({ frameCount, quick }) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const m = window.__shot!.manager!() as any;
    const renderer = m.renderer;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    // 描画ループ（StageManager の animate）を rAF から外し、手動で続けて回す。画面への表示や rAF の間隔の揺れを除くため
    const originalRaf = window.requestAnimationFrame.bind(window);
    let animate: FrameRequestCallback | null = null;
    window.requestAnimationFrame = (callback) => {
      if (callback.name === 'animate') {
        animate = callback;
        return 0;
      }
      return originalRaf(callback);
    };
    for (let i = 0; i < 30 && !animate; i++) await new Promise((r) => setTimeout(r, 50));
    if (!animate) throw new Error('描画ループを捕まえられません');
    const syncTarget = new m.composer.renderTarget1.constructor(1, 1);
    // 読み出すだけでは、その的に書く処理しか待たない（ANGLE Metal）。先に clear を積んで、それまでの処理をすべて待つ
    const sync = () => {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(syncTarget);
      renderer.clear();
      renderer.setRenderTarget(previous);
      renderer.readRenderTargetPixels(syncTarget, 0, 0, 1, 1, new Uint8Array(4));
    };
    const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
    // 1フレームの時間：20フレームずつ続けて回して GPU の完了まで待ち、その中央値
    const measure = async () => {
      const batch = 20;
      const times: number[] = [];
      for (let k = 0; k < Math.max(3, Math.round(frameCount / batch)); k++) {
        await new Promise((r) => setTimeout(r, 0));
        sync();
        const t0 = performance.now();
        for (let i = 0; i < batch; i++) animate!(performance.now());
        sync();
        times.push((performance.now() - t0) / batch);
      }
      return median(times);
    };
    for (let i = 0; i < 10; i++) animate(performance.now());

    // 1つずつ切って、どれだけ速くなるかを見る。off は元に戻す関数を返す
    const noop = (obj: any, method: string) => {
      const original = obj[method];
      obj[method] = () => {};
      return () => (obj[method] = original);
    };
    const setValue = (obj: any, key: string, value: unknown) => {
      const original = obj[key];
      obj[key] = value;
      return () => (obj[key] = original);
    };
    const resizeTo = (ratio: number) => {
      const original = m.getPixelRatio;
      m.getPixelRatio = () => ratio;
      m.resize(window.innerWidth, window.innerHeight);
      return () => {
        m.getPixelRatio = original;
        m.resize(window.innerWidth, window.innerHeight);
      };
    };
    const passOff = (pass: any) => (pass.enabled ? setValue(pass, 'enabled', false) : null);
    const uniformOff = (pass: any) => (pass.uniforms.uEnabled.value > 0.5 ? setValue(pass.uniforms.uEnabled, 'value', 0) : null);
    const toggles: [string, () => (() => void) | null][] = [
      ['画素比 1.5', () => resizeTo(1.5)],
      ['画素比 1.0', () => resizeTo(1)],
      ['MSAA なし（シーンの描画）', () => {
        const rt = m.renderPass.target;
        const samples = rt.samples;
        if (!samples) return null;
        rt.samples = 0;
        rt.dispose();
        return () => { rt.samples = samples; rt.dispose(); };
      }],
      ['影なし（キャラ・置物）', () => {
        const a = setValue(m.directionalLight, 'castShadow', false);
        const b = setValue(m.groundShadow, 'visible', false);
        return () => { a(); b(); };
      }],
      ['前髪の影の深度を描かない', () => noop(m.hairShadow, 'render')],
      ['人物マスクを描かない', () => {
        const a = noop(m.characterMask, 'render');
        const b = noop(m.eyeMask, 'render');
        return () => { a(); b(); };
      }],
      // パスの enabled は描画ループが毎フレーム決め直すので、元の設定のほうを切る
      ['GodRays（光の筋）', () => (m.sunShaftsEnabled ? setValue(m, 'sunShaftsEnabled', false) : null)],
      ['Bloom', () => passOff(m.bloomPass)],
      ['人物のにじみ（CharacterGlow）', () => {
        if (!m.characterGlowPass.enabled) return null;
        const a = setValue(m.characterGlowPass, 'enabled', false);
        const b = setValue(m.characterGlowPass.depthCapture, 'enabled', false);
        return () => { a(); b(); };
      }],
      ['LightWrap', () => uniformOff(m.lightWrapPass)],
      ['パラ（Para）', () => uniformOff(m.paraPass)],
      ['色調補正（CinematicAnime）', () => passOff(m.cinematicAnimePass)],
      ['人物の仕上げ（CharacterFinish）', () => passOff(m.characterFinishPass)],
      ['SMAA', () => passOff(m.smaaPass)],
      ['Overlay（文字演出・汗）', () => passOff(m.composer.passes.find((p: any) => p.constructor.name === 'OverlayPass'))],
      ['背景ぼかし（DoF）', () => passOff(m.depthOfFieldPass)],
      ['アバターの更新（CPU）', () => {
        const restores = [...m.loadedAvatars.values()].map((a: any) => noop(a, 'update'));
        return () => restores.forEach((r) => r());
      }],
    ];

    // 揺れるので、項目ごとに 基準→切る→基準 と測り、前後の基準の平均と比べる
    const baselines: number[] = [];
    const rows: [string, number][] = [];
    let before = await measure();
    baselines.push(before);
    for (const [name, off] of quick ? [] : toggles) {
      const restore = off();
      if (!restore) {
        rows.push([name + '（元から無効）', 0]);
        continue;
      }
      const ms = await measure();
      restore();
      const after = await measure();
      baselines.push(after);
      rows.push([name, (before + after) / 2 - ms]);
      before = after;
    }
    if (quick) for (let i = 0; i < 4; i++) baselines.push(await measure());
    const baseline = median(baselines);
    const baselineAfter = Math.max(...baselines) - Math.min(...baselines);

    let calls = 0, triangles = 0, renders = 0;
    const origRender = renderer.render;
    renderer.render = function (...args: unknown[]) {
      const out = origRender.apply(this, args);
      calls += renderer.info.render.calls;
      triangles += renderer.info.render.triangles;
      renders++;
      return out;
    };
    animate(performance.now());
    calls = 0; triangles = 0; renders = 0;
    animate(performance.now());
    renderer.render = origRender;

    window.requestAnimationFrame = originalRaf;
    originalRaf(animate);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      baseline, baselineAfter, rows,
      drawCalls: calls, triangles, renders,
      buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?',
      quality: m.quality,
      castShadow: m.directionalLight.castShadow,
      shadowMapSizes: [m.directionalLight.shadow.mapSize.x, m.staticShadowLight.shadow.mapSize.x + 'x' + m.staticShadowLight.shadow.mapSize.y],
    };
  }, { frameCount: frames, quick: options.quick });

  console.log(`${category}/${id} カット ${sceneIndex}  画面 ${result.buffer.join('x')}  GPU ${result.gpu}`);
  console.log(`品質 ${JSON.stringify(result.quality)}  影 ${result.castShadow ? result.shadowMapSizes.join(' / ') : 'なし'}`);
  console.log(`描画呼び出し ${result.drawCalls} 回 / 三角形 ${result.triangles.toLocaleString()} / render() ${result.renders} 回（1フレームあたり）`);
  console.log(`1フレーム（続けて回したときの中央値）: ${result.baseline.toFixed(1)} ms（測るたびの揺れ幅 ${result.baselineAfter.toFixed(1)} ms）`);
  if (result.rows.length) console.log('切ったときに減る時間:');
  for (const [name, ms] of result.rows) {
    console.log(`  ${ms.toFixed(1).padStart(6)} ms  ${((ms / result.baseline) * 100).toFixed(0).padStart(4)}%  ${name}`);
  }
} finally {
  await browser?.close();
  await server.close();
}
