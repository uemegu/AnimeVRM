import { test, expect } from '@playwright/test';
async function start(page) { await page.goto('http://127.0.0.1:5174/AnimeVRM/motion.html'); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); }

test('wave only between seconds 2 and 4 while walking for 6 seconds; drag trims the tail', async ({ page }) => {
  await start(page); await page.getByRole('button', { name: '歩きながら挨拶', exact: true }).click();
  const walk = page.locator('.layer').first(), wave = page.locator('.layer').last();
  await expect(walk.getByLabel('開始', { exact: true })).toHaveValue('0'); await expect(walk.getByLabel('終了', { exact: true })).toHaveValue('6');
  await expect(wave.getByLabel('開始', { exact: true })).toHaveValue('2'); await expect(wave.getByLabel('終了', { exact: true })).toHaveValue('4');
  const results = await page.evaluate(() => {
    const { engine, recipe } = window.motionMixer, errors = [];
    for (const t of [1, 3, 5]) {
      engine.sample(recipe, t); const q = engine.rest.get('RightArm').node.quaternion.clone();
      engine.sample({ ...recipe, layers: [recipe.layers[0]] }, t);
      errors.push(q.angleTo(engine.rest.get('RightArm').node.quaternion));
    }
    return errors;
  });
  expect(results[0]).toBeLessThan(.001); expect(results[1]).toBeGreaterThan(.05); expect(results[2]).toBeLessThan(.001);
  await wave.locator('[data-drag="end"]').scrollIntoViewIfNeeded();
  const handle = await wave.locator('[data-drag="end"]').boundingBox(), bar = await wave.locator('.timeline').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - bar.width / 6, handle.y + handle.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(wave.getByLabel('終了', { exact: true })).toHaveValue('3'); await expect(walk.getByLabel('終了', { exact: true })).toHaveValue('6');
  await wave.getByLabel('終了', { exact: true }).fill('4'); await wave.getByLabel('終了', { exact: true }).press('Tab');
  await page.locator('#seek').fill('3.5'); await wave.getByRole('button', { name: '再生位置で後ろをカット', exact: true }).click();
  await expect(wave.getByLabel('終了', { exact: true })).toHaveValue('3.5');
  await page.reload(); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); await expect(page.locator('.layer').last().getByLabel('終了', { exact: true })).toHaveValue('3.5');
});

test('two second alternating sway repeats with continuous seams and is baked to FBX', async ({ page }) => {
  await start(page); await page.getByRole('button', { name: '左右に2秒ずつ', exact: true }).click();
  await expect(page.locator('.repeat-clip')).toHaveCount(2);
  const result = await page.evaluate(async () => {
    const { FBXLoader } = await import('/AnimeVRM/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const { engine, recipe } = window.motionMixer;
    const sample = t => { engine.sample(recipe, t); return engine.rest.get('Spine1').node.quaternion.clone(); };
    const right = sample(1), left = sample(3), again = sample(5);
    let seamError = 0;
    for (const t of [2, 4, 6]) seamError = Math.max(seamError, sample(t - .001).angleTo(sample(t + .001)));
    const exported = new FBXLoader().parse(window.motionMixer.exportFBX(), '');
    engine.sample(recipe, 0); const first = [...engine.rest.values()].map(r => r.node.quaternion.clone()); engine.sample(recipe, 8);
    return { difference: right.angleTo(left), repeat: right.angleTo(again), seamError, closure: Math.max(...[...engine.rest.values()].map((r, i) => r.node.quaternion.angleTo(first[i]))), duration: exported.animations[0].duration };
  });
  expect(result.difference).toBeGreaterThan(.3); expect(result.repeat).toBeLessThan(.001); expect(result.seamError).toBeLessThan(.002); expect(result.closure).toBeLessThan(.001); expect(result.duration).toBe(8);
  await page.locator('#seek').fill('1'); await page.screenshot({ path: '/tmp/motion-v3-metronome.png', fullPage: true });
  await page.reload(); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); await expect(page.locator('.repeat-clip')).toHaveCount(2);
});

test('contact poses keep fingers tangent and support persistent outward adjustment', async ({ page }) => {
  await start(page); await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  while (await page.locator('.layer').count()) await page.locator('.layer').first().getByRole('button', { name: '削除', exact: true }).click();
  for (const id of ['@hair', '@right-cheek', '@right-hip', '@right-chest']) {
    await page.locator(`[data-source="${id}"]`).click(); await page.locator('#seek').fill('2');
    const data = await page.evaluate(id => {
      const { engine, recipe, vrm } = window.motionMixer;
      engine.sample(recipe, 2); const r = engine.rest.get('RightHand').node;
      return { finite: r.quaternion.toArray().every(Number.isFinite), source: id, vrmHand: vrm.humanoid.getNormalizedBoneNode('rightHand').position.toArray() };
    }, id);
    expect(data.finite).toBe(true);
    await page.screenshot({ path: `/tmp/motion-v3-${id.slice(1)}.png`, fullPage: true });
    if (id === '@right-chest') {
      const before = await page.evaluate(() => { const e = window.motionMixer.engine; e.sample(window.motionMixer.recipe, 2); return e.rest.get('RightHand').node.matrixWorld.elements.slice(12, 15); });
      await page.getByLabel('体から離す距離', { exact: true }).fill('5');
      const after = await page.evaluate(() => { const e = window.motionMixer.engine; e.sample(window.motionMixer.recipe, 2); return e.rest.get('RightHand').node.matrixWorld.elements.slice(12, 15); });
      expect(after[2] - before[2]).toBeGreaterThan(.04);
      await page.reload(); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); await expect(page.getByLabel('体から離す距離', { exact: true })).toHaveValue('5');
    } else await page.locator('.layer').first().getByRole('button', { name: '削除', exact: true }).click();
  }
});
