import { test, expect } from '@playwright/test';

test('joint editing is isolated, repeatable, persisted and exportable', async ({ page }) => {
  await page.goto('motion.html');
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#add-joint').click();
  const card = page.locator('.layer').last();
  await card.getByLabel('関節', { exact: true }).selectOption('RightForeArm');
  await card.getByLabel('X軸の角度', { exact: true }).fill('65');
  await card.getByLabel('X軸の角度', { exact: true }).press('Tab');
  await card.getByLabel('回転の基準').selectOption('world');
  const result = await page.evaluate(() => {
    const { engine, recipe, exportFBX } = (window as any).motionMixer;
    const layer = recipe.layers.at(-1);
    engine.sample({ ...recipe, layers: recipe.layers.slice(0, -1) }, 1);
    const before = engine.rest.get('RightForeArm').node.quaternion.clone().normalize();
    const other = engine.rest.get('LeftForeArm').node.quaternion.clone().normalize();
    engine.sample(recipe, 1);
    const after = engine.rest.get('RightForeArm').node.quaternion.clone().normalize();
    const isolated = other.angleTo(engine.rest.get('LeftForeArm').node.quaternion.clone().normalize());
    engine.sample(recipe, 1);
    const repeat = after.angleTo(engine.rest.get('RightForeArm').node.quaternion.clone().normalize());
    const saved = engine.bakeSaved({ ...recipe, layers: [layer] }, 'joint');
    return { angle: before.angleTo(after), isolated, repeat, bones: saved.tracks.map((t: any) => t.bone), bytes: exportFBX().byteLength };
  });
  expect(result.angle).toBeCloseTo(65 * Math.PI / 180, 5);
  expect(result.isolated).toBeLessThan(1e-6);
  expect(result.repeat).toBeLessThan(1e-6);
  expect(result.bones).toEqual(['RightForeArm']);
  expect(result.bytes).toBeGreaterThan(1000);
  await page.reload();
  await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('.layer').last().getByLabel('X軸の角度', { exact: true })).toHaveValue('65');
  await page.locator('.layer').last().getByRole('button', { name: '角度をリセット' }).click();
  await expect(page.locator('.layer').last().getByLabel('X軸の角度', { exact: true })).toHaveValue('0');
});

test('joint rotations ease at both boundaries, including legacy cards and repeats', async ({ page }) => {
  await page.goto('motion.html');
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#add-joint').click();
  await expect(page.getByLabel('補間時間', { exact: true })).toHaveValue('0.7');
  const angles = await page.evaluate(() => {
    const { engine, recipe } = (window as any).motionMixer;
    const layer = { ...recipe.layers.at(-1), jointX: 90, start: 1, duration: 2, repeatEvery: 3, jointEase: undefined, poseMode: 'hold', fade: 0 };
    const angleAt = (time: number, item = layer) => {
      engine.sample({ ...recipe, layers: [] }, time);
      const base = engine.rest.get('RightForeArm').node.quaternion.clone().normalize();
      engine.sample({ ...recipe, layers: [item] }, time);
      return base.angleTo(engine.rest.get('RightForeArm').node.quaternion.clone().normalize());
    };
    return {
      samples: [1, 1.35, 1.7, 2.3, 2.65, 3, 4, 4.35].map(t => angleAt(t)),
      instant: angleAt(1, { ...layer, jointEase: 0 }),
      short: [1, 1.1, 1.2].map(t => angleAt(t, { ...layer, duration: .2 })),
    };
  });
  for (const [i, expected] of [0, 45, 90, 90, 45, 0, 0, 45].entries()) expect(angles.samples[i]).toBeCloseTo(expected * Math.PI / 180, 5);
  expect(angles.instant).toBeCloseTo(Math.PI / 2, 5);
  for (const [i, expected] of [0, 90, 0].entries()) expect(angles.short[i]).toBeCloseTo(expected * Math.PI / 180, 5);
});

test('non-looping playback retains the final pose in preview and baked motion', async ({ page }) => {
  await page.goto('motion.html');
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#add-joint').click();
  const result = await page.evaluate(() => {
    const { engine, recipe } = (window as any).motionMixer;
    const layer = { ...recipe.layers.at(-1), jointX: 90, duration: 2, fade: .3 };
    const composition = { ...recipe, duration: 2, loop: false, layers: [layer] };
    const pose = (r: any, t: number) => {
      engine.sample(r, t);
      return engine.rest.get('RightForeArm').node.quaternion.clone().normalize();
    };
    const angle = (r: any, t: number) => pose({ ...r, layers: [] }, t).angleTo(pose(r, t));
    const end = pose(composition, 2);
    const frozen = end.angleTo(pose(composition, 3));
    const saved = engine.bakeSaved(composition, 'end pose');
    engine.registerSaved(saved);
    const restored = { ...layer, source: saved.id, from: 0, to: 60, fade: 0, poseMode: 'hold' };
    return {
      before: angle(composition, 1.9), end: angle(composition, 2), frozen,
      loopEnd: angle({ ...composition, loop: true }, 2),
      repeatEnd: angle({ ...composition, layers: [{ ...layer, duration: 1, repeatEvery: 1 }] }, 2),
      baked: end.angleTo(pose({ ...composition, layers: [restored] }, 2)),
    };
  });
  expect(result.before).toBeCloseTo(Math.PI / 2, 5);
  expect(result.end).toBeCloseTo(Math.PI / 2, 5);
  expect(result.repeatEnd).toBeCloseTo(Math.PI / 2, 5);
  expect(result.loopEnd).toBeLessThan(1e-6);
  expect(result.frozen).toBeLessThan(1e-6);
  expect(result.baked).toBeLessThan(1e-5);
});
