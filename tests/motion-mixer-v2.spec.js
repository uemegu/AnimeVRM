import { test, expect } from '@playwright/test';
const url = 'http://127.0.0.1:5174/AnimeVRM/motion.html';
async function start(page) { await page.goto(url); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); }

test('trim from a visible source frame, shorten playback and start without the idle lead-in', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: '歩きながら挨拶', exact: true }).click();
  await expect(page.locator('.layer')).toHaveCount(2); // Wait for the preset's asynchronous FBX load.
  const card = page.locator('.layer').last();
  await card.getByLabel('素材のフレーム', { exact: true }).fill('45');
  await expect(page.locator('#model-state')).toContainText('45f');
  await card.getByRole('button', { name: 'このフレームから', exact: true }).click();
  await card.getByRole('button', { name: '範囲を適用', exact: true }).click();
  const result = await page.evaluate(() => {
    const { recipe, engine } = window.motionMixer, layer = recipe.layers[1];
    engine.sample(recipe, layer.start);
    const bone = engine.rest.get('RightArm').node, actual = bone.quaternion.clone();
    engine.applySource(layer.source, 1.5, layer.mask, 1);
    return { from: layer.from, fade: layer.fade, duration: layer.duration, expectedDuration: (layer.to - 45) / 30, error: actual.angleTo(bone.quaternion) };
  });
  expect(result.from).toBe(45); expect(result.fade).toBe(0); expect(result.duration).toBeCloseTo(result.expectedDuration); expect(result.error).toBeLessThan(.001);
});

test('global loop appends a smooth return and bakes identical endpoints in FBX', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: '髪をかきあげる', exact: true }).click();
  await page.locator('#global-loop').check(); await page.locator('#transition').fill('1.4'); await page.locator('#transition').press('Tab');
  await expect(page.locator('#total-length')).toContainText('7.4秒');
  const result = await page.evaluate(async () => {
    const { FBXLoader } = await import('/AnimeVRM/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const { engine, recipe } = window.motionMixer;
    engine.sample(recipe, 0); const first = [...engine.rest.values()].map(r => ({ q: r.node.quaternion.clone(), p: r.node.position.clone() }));
    engine.sample(recipe, 7.4);
    const errors = [...engine.rest.values()].map((r, i) => Math.max(first[i].q.angleTo(r.node.quaternion), first[i].p.distanceTo(r.node.position)));
    const fbx = new FBXLoader().parse(window.motionMixer.exportFBX(), '');
    let exportError = 0;
    for (const track of fbx.animations[0].tracks) {
      const size = track.getValueSize(); for (let i = 0; i < size; i++) exportError = Math.max(exportError, Math.abs(track.values[i] - track.values[track.values.length - size + i]));
    }
    return { error: Math.max(...errors), exportError, duration: fbx.animations[0].duration };
  });
  expect(result.error).toBeLessThan(.001); expect(result.exportError).toBeLessThan(.001); expect(result.duration).toBeCloseTo(7.4);
  await page.locator('#seek').fill('6.7'); await expect(page.locator('#model-state')).toContainText('接続中');
  await page.reload(); await expect(page.locator('#global-loop')).toBeChecked({ timeout: 60000 }); await expect(page.locator('#transition')).toHaveValue('1.4');
});

test('saved motions can be nested, survive reload, and travel with a recipe file', async ({ page }) => {
  await start(page); await page.getByRole('button', { name: '髪をかきあげる', exact: true }).click();
  await page.locator('#add-library').click(); await page.locator('#motion-name').fill('髪＋ひねり <自作>'); await page.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(page.locator('#save-dialog')).not.toBeVisible();
  await page.locator('#category').selectOption('saved'); await expect(page.locator('.motion-card')).toHaveCount(1);
  await expect(page.locator('.motion-card')).toContainText('髪＋ひねり <自作>');
  const first = await page.evaluate(() => [...window.motionMixer.engine.custom.values()][0]);
  while (await page.locator('.layer').count()) await page.locator('.layer').first().getByRole('button', { name: '削除', exact: true }).click();
  await page.locator('.motion-card').click();
  const error = await page.evaluate(() => {
    const { engine, recipe } = window.motionMixer;
    recipe.layers[0].fade = 0; recipe.layers[0].loop = false;
    engine.sample(recipe, 2); const saved = [...engine.custom.values()][0], index = saved.times.findIndex(t => t === 2);
    return Math.max(...saved.tracks.flatMap(t => engine.rest.get(t.bone).node.quaternion.toArray().map((v, j) => Math.abs(v - t.rotations[index * 4 + j]))));
  });
  expect(error).toBeLessThan(.001);
  await page.locator('#add-library').click(); await page.locator('#motion-name').fill('再利用した動作'); await page.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(page.locator('.motion-card')).toHaveCount(2);
  const exported = page.waitForEvent('download'); await page.locator('#save').click(); const file = await exported; const filePath = await file.path();
  await page.reload(); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); await page.locator('#category').selectOption('saved'); await expect(page.locator('.motion-card')).toHaveCount(2);
  expect(await page.evaluate(() => window.motionMixer.recipe.layers[0].source)).toBe(first.id);
  await page.evaluate(() => localStorage.clear()); await page.reload(); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 });
  await page.locator('#file').setInputFiles(filePath); await expect(page.locator('#status')).toHaveText('レシピを開きました');
  expect(await page.evaluate(() => window.motionMixer.recipe.layers[0].source)).toBe(first.id);
  await page.locator('#category').selectOption('saved'); await expect(page.locator('.motion-card')).toHaveCount(1);
});

test('hair elbow keeps a stable bend plane and all new basics stay finite', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { newLayer } = await import('/AnimeVRM/src/motion/engine.ts');
    const { basics } = await import('/AnimeVRM/src/motion/basics.ts');
    const engine = window.motionMixer.engine, layer = newLayer('@hair', engine, 6); layer.fade = 0;
    let minDot = 1, previous, determinism = 0;
    const saved = [];
    for (let frame = 24; frame <= 180; frame++) {
      engine.sample({ version: 1, duration: 6, fps: 30, layers: [layer] }, frame / 30);
      const a = engine.rest.get('RightArm').node.getWorldPosition(new T.Vector3()), b = engine.rest.get('RightForeArm').node.getWorldPosition(new T.Vector3()), c = engine.rest.get('RightHand').node.getWorldPosition(new T.Vector3());
      const normal = b.clone().sub(a).cross(c.clone().sub(b)).normalize();
      if (previous) minDot = Math.min(minDot, previous.dot(normal)); previous = normal;
      saved.push(engine.rest.get('RightArm').node.quaternion.clone());
    }
    for (let frame = 180; frame >= 24; frame--) {
      engine.sample({ version: 1, duration: 6, fps: 30, layers: [layer] }, frame / 30);
      determinism = Math.max(determinism, saved[frame - 24].angleTo(engine.rest.get('RightArm').node.quaternion));
    }
    let finite = true;
    for (const id of Object.keys(basics)) for (const time of [0, .5, 1, 1.9]) {
      engine.sample({ version: 1, duration: 6, fps: 30, layers: [newLayer(id, engine, 6)] }, time);
      for (const r of engine.rest.values()) finite &&= [...r.node.position.toArray(), ...r.node.quaternion.toArray()].every(Number.isFinite);
    }
    return { minDot, determinism, finite, count: Object.keys(basics).length };
  });
  expect(result.minDot).toBeGreaterThan(.95); expect(result.determinism).toBeLessThan(.001); expect(result.finite).toBe(true); expect(result.count).toBeGreaterThanOrEqual(40);
  await page.getByRole('button', { name: '髪をかきあげる', exact: true }).click(); await page.locator('#seek').fill('4.5');
  await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  await page.screenshot({ path: '/tmp/motion-mixer-v2-hair.png', fullPage: true });
});

test('new arm and finger primitives combine without moving the other arm', async ({ page }) => {
  await start(page);
  while (await page.locator('.layer').count()) await page.locator('.layer').first().getByRole('button', { name: '削除', exact: true }).click();
  await page.locator('[data-source="@right-forward"]').click();
  await page.locator('[data-source="@right-index"]').click();
  await page.locator('#seek').fill('1.5');
  await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  const result = await page.evaluate(async () => {
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { engine, recipe } = window.motionMixer;
    engine.sample({ ...recipe, layers: [recipe.layers[0]] }, 1.5);
    const arm = engine.rest.get('RightArm').node.quaternion.clone(), left = engine.rest.get('LeftArm').node.quaternion.clone();
    const hand = engine.rest.get('RightHand').node.getWorldPosition(new T.Vector3()), shoulder = engine.rest.get('RightArm').node.getWorldPosition(new T.Vector3());
    engine.sample(recipe, 1.5);
    return { armError: arm.angleTo(engine.rest.get('RightArm').node.quaternion), leftError: left.angleTo(engine.rest.get('LeftArm').node.quaternion), forward: hand.z - shoulder.z };
  });
  expect(result.armError).toBeLessThan(.001); expect(result.leftError).toBeLessThan(.001); expect(result.forward).toBeGreaterThan(.3);
  await page.screenshot({ path: '/tmp/motion-mixer-v2-point.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/motion-mixer-v2-mobile.png', fullPage: true });
});
