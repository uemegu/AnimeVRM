import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openEditor(page: Page, mock = true) {
  if (mock) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
      const WorkerClass = window.Worker;
      window.Worker = class extends WorkerClass {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(String(url).includes('inference.worker') ? '/AnimeVRM/test/fixtures/motion-editor-ardy.worker.ts' : url, options);
        }
      };
    });
  }
  await page.goto('./motion.html');
  await expect(page.locator('#export')).toBeEnabled();
}

async function loadModel(page: Page) {
  await page.locator('#ardy-generator > summary').click();
  await page.locator('#ardy-load').click();
  await expect(page.locator('#ardy-generate')).toBeEnabled();
}

test('all sidebar accordions start closed, search reveals matches, and AI controls do not auto-download', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('huggingface.co')) requests.push(request.url()); });
  await openEditor(page, false);
  expect(await page.locator('aside details').count()).toBeGreaterThan(10);
  await expect(page.locator('aside details[open]')).toHaveCount(0);
  await page.locator('#search').fill('ピース');
  await expect(page.locator('#library details[open]')).toHaveCount(2);
  await page.locator('#search').fill('');
  await expect(page.locator('#library details[open]')).toHaveCount(0);
  await page.locator('#ardy-generator > summary').click();
  await expect(page.locator('#ardy-generate')).toBeDisabled();
  await expect(page.locator('#ardy-load')).toBeEnabled();
  await page.screenshot({ path: '/tmp/motion-ardy-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#ardy-generator').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/motion-ardy-mobile.png', fullPage: true });
  expect(requests).toEqual([]);
});

test('generated motion mixes by body mask, trims, appends, persists and exports the composed pose', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page);
  await loadModel(page);
  await page.locator('#seek').fill('1');
  await page.locator('#ardy-name').fill('右腕の生成素材');
  await page.locator('#ardy-duration').fill('2');
  await page.locator('#ardy-mask').selectOption('右腕');
  await page.locator('#ardy-generate').click();
  await expect(page.locator('.layer')).toHaveCount(2);
  await expect(page.locator('#ardy-status')).toContainText('生成・追加');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const first = await page.evaluate(() => {
    const { engine, recipe } = (window as any).motionMixer;
    const generated = recipe.layers.at(-1);
    engine.sample({ ...recipe, layers: recipe.layers.slice(0, -1) }, 2);
    const leg = engine.rest.get('LeftUpLeg').node.quaternion.clone().normalize();
    const arm = engine.rest.get('RightArm').node.quaternion.clone().normalize();
    engine.sample(recipe, 2);
    return {
      start: generated.start, duration: generated.duration, to: generated.to, loop: generated.loop,
      legDelta: leg.angleTo(engine.rest.get('LeftUpLeg').node.quaternion.clone().normalize()),
      armDelta: arm.angleTo(engine.rest.get('RightArm').node.quaternion.clone().normalize()),
      lastTime: engine.custom.get(generated.source).times.at(-1),
    };
  });
  expect(first.start).toBe(1);
  expect(first.duration).toBe(2);
  expect(first.to).toBe(60);
  expect(first.loop).toBe(false);
  expect(first.lastTime).toBe(2);
  expect(first.legDelta).toBeLessThan(1e-6);
  expect(first.armDelta).toBeGreaterThan(.1);
  const card = page.locator('.layer').last();
  await card.getByLabel('元の開始', { exact: true }).fill('15');
  await card.getByLabel('元の開始', { exact: true }).press('Tab');
  await card.getByLabel('元の終了', { exact: true }).fill('45');
  await card.getByLabel('元の終了', { exact: true }).press('Tab');
  await card.getByRole('button', { name: '範囲を適用' }).click();
  await expect(card.getByLabel('区間の長さ', { exact: true })).toHaveValue('1');
  await page.locator('#ardy-placement').selectOption('end');
  await page.locator('#ardy-mask').selectOption('全身');
  await page.locator('#ardy-name').fill('後ろに続く動作');
  await page.locator('#ardy-generate').click();
  await expect(page.locator('.layer')).toHaveCount(3);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  expect(await page.evaluate(() => (window as any).motionMixer.recipe.layers.at(-1).start)).toBe(6);
  await expect(page.locator('#duration')).toHaveValue('8');
  const exported = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    // @ts-expect-error Vite browser import
    const { FBXLoader } = await import('/AnimeVRM/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const { engine, recipe, exportFBX } = (window as any).motionMixer;
    const root = new FBXLoader().parse(exportFBX(), '');
    const mixer = new T.AnimationMixer(root); mixer.clipAction(root.animations[0]).play();
    let angleError = 0, positionError = 0;
    for (const time of [1.5, 2, 6.5, 7, 7.9]) {
      engine.sample(recipe, time); mixer.setTime(time);
      for (const rest of engine.rest.values()) {
        const bone = root.getObjectByName(rest.node.name);
        angleError = Math.max(angleError, bone.quaternion.clone().normalize().angleTo(rest.node.quaternion.clone().normalize()));
        positionError = Math.max(positionError, bone.position.distanceTo(rest.node.position));
      }
    }
    return { angleError, positionError, duration: root.animations[0].duration };
  });
  expect(exported.angleError).toBeLessThan(.005);
  expect(exported.positionError).toBeLessThan(.002);
  expect(exported.duration).toBe(8);
  const downloading = page.waitForEvent('download');
  await page.locator('#save').click();
  const download = await downloading;
  const content = await readFile((await download.path())!, 'utf8');
  const bundle = JSON.parse(content);
  expect(bundle.motions).toHaveLength(2);
  await page.reload();
  await expect(page.locator('.layer')).toHaveCount(3);
  await expect(page.locator('aside details[open]')).toHaveCount(0);
  await expect(page.locator('.layer').last().locator('.layer-title')).toContainText('後ろに続く動作');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('.layer')).toHaveCount(1);
  await page.locator('#file').setInputFiles({ name: 'motion-recipe.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await expect(page.locator('.layer')).toHaveCount(3);
  expect(await page.evaluate(() => (window as any).motionMixer.engine.custom.size)).toBe(2);
  expect(errors).toEqual([]);
});

test('cancellation and inference errors leave the composition intact and allow another generation', async ({ page }) => {
  await openEditor(page);
  await loadModel(page);
  await page.locator('#ardy-prompt').fill('A person waves. [slow]');
  await page.locator('#ardy-generate').click();
  await expect(page.locator('#ardy-cancel')).toBeVisible();
  await expect(page.locator('#export')).toBeDisabled();
  await page.locator('#ardy-cancel').click();
  await expect(page.locator('#ardy-status')).toContainText('キャンセルしました');
  await page.waitForTimeout(600);
  await expect(page.locator('.layer')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).motionMixer.engine.custom.size)).toBe(0);
  await page.locator('#ardy-prompt').fill('A person waves. [fail]');
  await page.locator('#ardy-generate').click();
  await expect(page.locator('#ardy-status')).toContainText('Fixture inference failed');
  await expect(page.locator('.layer')).toHaveCount(1);
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#ardy-prompt').fill('A person waves their right hand.');
  await page.locator('#ardy-generate').click();
  await expect(page.locator('.layer')).toHaveCount(2);
  await page.locator('#ardy-unload').click();
  await expect(page.locator('#ardy-status')).toHaveText('モデル未読込');
  await expect(page.locator('#ardy-generate')).toBeDisabled();
  await expect(page.locator('.layer')).toHaveCount(2);
});

test('ARDY converts to the Mixamo rest axes without changing the current pose or source buffers', async ({ page }) => {
  await openEditor(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser import
    const { createArdySavedMotion } = await import('/AnimeVRM/src/motion/createArdySavedMotion.ts');
    // @ts-expect-error Vite browser import
    const { CORE27_SKELETON } = await import('/AnimeVRM/src/ai/motion/ardy/vendor/motion-data.ts');
    // @ts-expect-error Vite browser import
    const { createVrmRetargetPlan, retargetMotionFrame } = await import('/AnimeVRM/src/ai/motion/ardy/vendor/vrm-retarget.ts');
    // @ts-expect-error Vite browser import
    const { MIXAMO_VRM_BONES } = await import('/AnimeVRM/src/motion/rig.ts');
    // @ts-expect-error Vite browser import
    const { validateSaved } = await import('/AnimeVRM/src/motion/engine.ts');
    // @ts-expect-error Vite browser import
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { engine, recipe } = (window as any).motionMixer;
    engine.sample(recipe, 1);
    const before = [...engine.rest.values()].map((r: any) => [...r.node.position.toArray(), ...r.node.quaternion.toArray()]);
    const rotations = new Float32Array(2 * 27 * 4);
    for (let frame = 0; frame < 2; frame++) for (let i = 0; i < 27; i++) {
      const q = new T.Quaternion().setFromEuler(new T.Euler(.02 * i, .01 * frame, .01 * i));
      rotations.set(q.toArray(), (frame * 27 + i) * 4);
    }
    const positions = new Float32Array(2 * 81);
    positions[0] = 9; positions[81] = 20;
    positions[1] = .9544128252334833; positions[82] = .9544128252334833 + .1;
    const motion = { skeleton: CORE27_SKELETON, frameCount: 2, fps: 20, positions, positionsShape: [2, 27, 3], globalRotations: { values: rotations, shape: [2, 27, 4], format: 'quaternion-xyzw' } };
    const input = Array.from(rotations);
    const saved = createArdySavedMotion(motion, engine, 'generated');
    validateSaved([saved]);
    const targets = saved.tracks.map((track: any) => MIXAMO_VRM_BONES[track.bone]);
    const plan = createVrmRetargetPlan(CORE27_SKELETON, { presentBones: targets, targetHipsHeight: engine.rest.get('Hips').p.y, metaVersion: '1' });
    let error = 0;
    for (let frame = 0; frame < 2; frame++) {
      const pose = retargetMotionFrame(motion, frame, plan);
      for (const track of saved.tracks) {
        const rest = engine.rest.get(track.bone);
        const actual = new T.Quaternion().fromArray(track.rotations, frame * 4).premultiply(rest.parentWorld).multiply(rest.world.clone().invert()).normalize();
        const expected = new T.Quaternion().fromArray(pose.rotations.find((r: any) => r.targetBone === MIXAMO_VRM_BONES[track.bone]).rotation);
        error = Math.max(error, actual.angleTo(expected));
      }
    }
    const after = [...engine.rest.values()].map((r: any) => [...r.node.position.toArray(), ...r.node.quaternion.toArray()]);
    const hips = saved.tracks.find((t: any) => t.bone === 'Hips');
    return { error, untouched: JSON.stringify(before) === JSON.stringify(after), unchangedInput: input.every((v, i) => v === rotations[i]), times: saved.times, hipX: [hips.positions[0], hips.positions[3]], expectedX: engine.rest.get('Hips').p.x, raised: hips.positions[4] - hips.positions[1] };
  });
  expect(result.error).toBeLessThan(2e-6);
  expect(result.untouched).toBe(true);
  expect(result.unchangedInput).toBe(true);
  expect(result.times).toEqual([0, .05, .1]);
  for (const x of result.hipX) expect(x).toBeCloseTo(result.expectedX, 5);
  expect(result.raised).toBeGreaterThan(5);
});
