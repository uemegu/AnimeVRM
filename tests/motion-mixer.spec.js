import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

test('compose, persist, and export a Mixamo FBX matching the preview', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5174/AnimeVRM/motion.html');
  await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: '歩きながら挨拶', exact: true }).click();
  await expect(page.locator('.layer')).toHaveCount(2);
  await page.locator('.layer').last().getByLabel('強さ', { exact: true }).fill('0.65');
  await page.locator('.layer').last().getByLabel('開始', { exact: true }).fill('0.8');
  await page.locator('.layer').last().getByLabel('開始', { exact: true }).press('Tab');
  await page.getByRole('button', { name: '再生', exact: true }).click();
  await expect(page.locator('#time')).not.toHaveText('0.00 / 6.00 s');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const validation = await page.evaluate(async () => {
    const { FBXLoader } = await import('/AnimeVRM/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const api = window.motionMixer; const buffer = api.exportFBX(); const out = new FBXLoader().parse(buffer, '');
    const mixer = new T.AnimationMixer(out); mixer.clipAction(out.animations[0]).play();
    let angleError = 0, positionError = 0;
    for (const time of [0, .5, 1, 2.5, 4, 5.9]) {
      api.engine.sample(api.recipe, time); mixer.setTime(time);
      for (const rest of api.engine.rest.values()) {
        const bone = out.getObjectByName(rest.node.name);
        angleError = Math.max(angleError, bone.quaternion.angleTo(rest.node.quaternion));
        positionError = Math.max(positionError, bone.position.distanceTo(rest.node.position));
      }
    }
    return { angleError, positionError, duration: out.animations[0].duration, bones: api.engine.rest.size };
  });
  expect(validation.angleError).toBeLessThan(.005);
  expect(validation.positionError).toBeLessThan(.002);
  expect(validation.duration).toBe(6);
  expect(validation.bones).toBeGreaterThan(45);
  const download = page.waitForEvent('download'); await page.locator('#export').click();
  const file = await download; await file.saveAs('/tmp/motion-mix-test.fbx');
  const bytes = fs.readFileSync('/tmp/motion-mix-test.fbx');
  expect(bytes.subarray(0, 19).toString()).toBe('Kaydara FBX Binary ');
  const parsed = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  expect(parsed.animations[0].name).toBe('mixamo.com');
  await page.reload(); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 });
  await expect(page.locator('.layer')).toHaveCount(2);
  expect(await page.evaluate(() => window.motionMixer.recipe.layers[1].weight)).toBe(.65);
  await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  await page.screenshot({ path: '/tmp/motion-mixer-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/motion-mixer-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('procedural composition retargets through the existing viewer loader', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/AnimeVRM/motion.html');
  await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  await page.getByRole('button', { name: '髪をかきあげる', exact: true }).click();
  await expect(page.locator('.layer')).toHaveCount(3);
  await page.locator('#seek').fill('2.3');
  const result = await page.evaluate(async () => {
    const { loadMixamoAnimation } = await import('/AnimeVRM/src/Avatar.ts');
    const api = window.motionMixer, url = URL.createObjectURL(new Blob([api.exportFBX()]));
    try {
      const clip = await loadMixamoAnimation(url, api.vrm);
      const q = api.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const track = clip.tracks.find(t => t.name === `${q.name}.quaternion`);
      const v = track.createInterpolant().evaluate(2.3);
      return { tracks: clip.tracks.length, dot: Math.abs(q.quaternion.x*v[0] + q.quaternion.y*v[1] + q.quaternion.z*v[2] + q.quaternion.w*v[3]), duration: clip.duration };
    } finally { URL.revokeObjectURL(url); }
  });
  expect(result.tracks).toBeGreaterThan(40); expect(result.duration).toBe(6); expect(result.dot).toBeGreaterThan(.999);
  await page.screenshot({ path: '/tmp/motion-mixer-hair.png', fullPage: true });
});

test('basic reach motions have usable hand positions', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/AnimeVRM/motion.html');
  await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 });
  const reach = await page.evaluate(async () => {
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { newLayer } = await import('/AnimeVRM/src/motion/engine.ts');
    const engine = window.motionMixer.engine;
    const head = engine.rest.get('Head').node, hand = engine.rest.get('RightHand').node;
    const results = {};
    for (const source of ['@raise', '@hair']) {
      engine.sample({ version: 1, duration: 6, fps: 30, layers: [newLayer(source, engine, 6)] }, 2);
      hand.updateWorldMatrix(true, false); head.updateWorldMatrix(true, false);
      const h = hand.getWorldPosition(new T.Vector3()), t = head.getWorldPosition(new T.Vector3());
      const scale = head.getWorldScale(new T.Vector3()).x;
      results[source] = { aboveHead: (h.y - t.y) / scale, headDistance: h.distanceTo(t) / scale };
    }
    return results;
  });
  expect(reach['@raise'].aboveHead).toBeGreaterThan(0);
  expect(reach['@hair'].headDistance).toBeLessThan(25);
});
