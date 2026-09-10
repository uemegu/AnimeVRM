import { test, expect } from '@playwright/test';
async function start(page) { await page.goto('http://127.0.0.1:5174/AnimeVRM/motion.html'); await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 }); }

test('independent detail panels, category accordions and persistent visible preview', async ({ page }) => {
  await start(page);
  await page.locator('[data-source="@right-wrist-bend"]').click();
  await page.locator('[data-source="@left-knee-up"]').click();
  await expect(page.locator('.layer .details')).toHaveCount(3);
  await page.locator('.layer').first().locator('.layer-title').click();
  await expect(page.locator('.layer .details')).toHaveCount(2);
  await page.locator('.layer').first().locator('.layer-title').click();
  await expect(page.locator('.layer .details')).toHaveCount(3);
  const group = page.locator('.motion-category[data-group="右手・手首"]');
  await group.locator('summary').click(); await expect(group).not.toHaveAttribute('open', '');
  await group.locator('summary').click(); await expect(group).toHaveAttribute('open', '');
  await page.locator('#search').fill('手首を回す'); await expect(page.locator('.motion-card')).toHaveCount(2); await page.locator('#search').fill('');
  await page.locator('.layer').last().getByLabel('速度', { exact: true }).scrollIntoViewIfNeeded();
  let rect = await page.locator('#stage').boundingBox(); expect(rect.y).toBeGreaterThanOrEqual(0); expect(rect.y + rect.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: '/tmp/motion-v4-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.layer').last().getByLabel('速度', { exact: true }).scrollIntoViewIfNeeded();
  rect = await page.locator('#stage').boundingBox(); expect(rect.y).toBeGreaterThanOrEqual(0); expect(rect.y + rect.height).toBeLessThan(440);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/motion-v4-mobile.png' });
});

test('wrist only rotates wrist; full body balance is optional; raised elbow stays outside torso', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { newLayer } = await import('/AnimeVRM/src/motion/engine.ts'); const e = window.motionMixer.engine;
    const sample = (layers) => e.sample({ version: 1, duration: 6, fps: 30, layers }, 1.5);
    sample([]); const arm = e.rest.get('RightArm').node.quaternion.clone(), wrist = e.rest.get('RightHand').node.quaternion.clone(), shoulder = e.rest.get('LeftShoulder').node.quaternion.clone();
    sample([newLayer('@right-wrist-turn-in', e, 6)]);
    const wristDelta = wrist.angleTo(e.rest.get('RightHand').node.quaternion), armDelta = arm.angleTo(e.rest.get('RightArm').node.quaternion);
    const raise = newLayer('@raise', e, 6); sample([raise]);
    const balanceDelta = shoulder.angleTo(e.rest.get('LeftShoulder').node.quaternion);
    const upper = e.rest.get('RightArm').node.getWorldPosition(new T.Vector3()), elbow = e.rest.get('RightForeArm').node.getWorldPosition(new T.Vector3()), hand = e.rest.get('RightHand').node.getWorldPosition(new T.Vector3()), head = e.rest.get('Head').node.getWorldPosition(new T.Vector3());
    sample([{ ...raise, mask: '右腕' }]); const maskedDelta = shoulder.angleTo(e.rest.get('LeftShoulder').node.quaternion);
    sample([{ ...raise, balance: false }]); const disabledDelta = shoulder.angleTo(e.rest.get('LeftShoulder').node.quaternion);
    return { wristDelta, armDelta, balanceDelta, maskedDelta, disabledDelta, elbowOut: upper.x - elbow.x, handAboveHead: hand.y - head.y };
  });
  expect(result.wristDelta).toBeGreaterThan(.5); expect(result.armDelta).toBeLessThan(.001);
  expect(result.balanceDelta).toBeGreaterThan(.02); expect(result.maskedDelta).toBeLessThan(.001); expect(result.disabledDelta).toBeLessThan(.001);
  expect(result.elbowOut).toBeGreaterThan(.015); expect(result.handAboveHead).toBeGreaterThan(.1);
});

test('leg primitives retain a supporting foot on the VRM; float is explicit and FBX keeps grounding', async ({ page }) => {
  await start(page); await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  const result = await page.evaluate(async () => {
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { newLayer } = await import('/AnimeVRM/src/motion/engine.ts');
    const { loadMixamoAnimation } = await import('/AnimeVRM/src/Avatar.ts');
    const { exportFBX } = await import('/AnimeVRM/src/motion/fbx.ts');
    const api = window.motionMixer, e = api.engine;
    const sole = () => Math.min(...['rightFoot', 'leftFoot', 'rightToes', 'leftToes'].map(n => api.vrm.humanoid.getNormalizedBoneNode(n).getWorldPosition(new T.Vector3()).y));
    const sample = (source, t) => { const recipe = { version: 1, duration: 6, fps: 30, layers: source ? [newLayer(source, e, 6)] : [] }; e.sample(recipe, t); api.syncPose(); return recipe; };
    sample(null, 0); const ground = sole(); let error = 0, finite = true;
    for (const source of ['@right-knee-up', '@left-knee-up', '@right-heel-back', '@left-heel-back', '@right-step-forward', '@left-step-side', '@crouch', '@small-crouch']) for (const t of [.2, .7, 1.5, 3, 5.9]) {
      sample(source, t); error = Math.max(error, Math.abs(sole() - ground)); finite &&= [...e.rest.values()].every(r => r.node.quaternion.toArray().every(Number.isFinite));
    }
    sample('@float', 1.5); const floatHeight = sole() - ground;
    const recipe = sample('@right-knee-up', 1.5); const kneeLift = api.vrm.humanoid.getNormalizedBoneNode('rightFoot').getWorldPosition(new T.Vector3()).y - api.vrm.humanoid.getNormalizedBoneNode('leftFoot').getWorldPosition(new T.Vector3()).y; const blob = URL.createObjectURL(new Blob([exportFBX(e, recipe)]));
    const clip = await loadMixamoAnimation(blob, api.vrm); URL.revokeObjectURL(blob);
    const mixer = new T.AnimationMixer(api.vrm.scene); mixer.clipAction(clip).play(); mixer.setTime(1.5); api.vrm.update(0); api.vrm.scene.updateMatrixWorld(true);
    const exportError = Math.abs(sole() - ground); mixer.stopAllAction();
    return { error, finite, floatHeight, exportError, kneeLift };
  });
  expect(result.kneeLift).toBeGreaterThan(.1); expect(result.finite).toBe(true); expect(result.error).toBeLessThan(.015); expect(result.floatHeight).toBeGreaterThan(.15); expect(result.exportError).toBeLessThan(.015);
  await page.locator('[data-source="@right-knee-up"]').click(); await page.locator('#seek').fill('1.5'); await page.screenshot({ path: '/tmp/motion-v4-knee.png' });
});


test('an arm-only saved primitive can receive optional full-body support', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { newLayer } = await import('/AnimeVRM/src/motion/engine.ts'); const e = window.motionMixer.engine;
    const recipe = { version: 1, duration: 6, fps: 30, layers: [{ ...newLayer('@raise', e, 6), mask: '右腕', fade: 0 }] };
    const saved = e.bakeSaved(recipe, '腕だけ'); e.registerSaved(saved);
    const layer = newLayer(saved.id, e, 6);
    e.sample({ ...recipe, layers: [{ ...layer, balance: false }] }, 1.5); const before = e.rest.get('LeftShoulder').node.quaternion.clone();
    e.sample({ ...recipe, layers: [layer] }, 1.5);
    return { mask: layer.mask, support: before.angleTo(e.rest.get('LeftShoulder').node.quaternion) };
  });
  expect(result.mask).toBe('全身'); expect(result.support).toBeGreaterThan(.02);
});
