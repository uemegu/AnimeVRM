import { test, expect } from '@playwright/test';

test('Verify conversational LookAt target and shallow head angle without infinite accumulation', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/');

  // Wait for initial model loading
  await page.waitForTimeout(3000);

  // Click the 2-girl scenario button
  console.log('Starting 2-girl scenario...');
  await page.click('#scenario-twogirls-btn');

  // Wait for models to load and scenario to start
  await page.waitForTimeout(4000);

  // Helper to get avatars lookAt state
  const getAvatarsState = async () => {
    return await page.evaluate(() => {
      const win = window;
      const avatarMgr = win.avatarManager || win.__viewer?.avatarManager;
      const sc = win.scenarioController;
      const engine = sc?.scenarioEngine;
      const curScene = engine?.currentScene;
      
      const avatarsMap = avatarMgr?.scenarioAvatars || sc?.avatarManager?.scenarioAvatars;
      const result = {
        sceneId: curScene?.id,
        speaker: curScene?.speaker,
        speakerCharacterId: curScene?.speakerCharacterId,
        dialogueTarget: curScene?.dialogueTarget,
        avatars: {}
      };

      if (avatarsMap) {
        for (const [id, av] of avatarsMap.entries()) {
          const eyeCfg = av.getEyeLookAtConfig();
          const headCfg = av.getHeadLookAtConfig();
          const vrm = av.vrm;
          let neckDeg = 0;
          let headDeg = 0;
          if (vrm?.humanoid) {
            const neck = vrm.humanoid.getNormalizedBoneNode('neck');
            const head = vrm.humanoid.getNormalizedBoneNode('head');
            if (neck) {
              const e = new THREE.Euler().setFromQuaternion(neck.quaternion, 'YXZ');
              neckDeg = Math.hypot(e.x, e.y) * 180 / Math.PI;
            }
            if (head) {
              const e = new THREE.Euler().setFromQuaternion(head.quaternion, 'YXZ');
              headDeg = Math.hypot(e.x, e.y) * 180 / Math.PI;
            }
          }

          result.avatars[id] = {
            eyeMode: eyeCfg.mode,
            eyeTargetPos: eyeCfg.targetPos ? [eyeCfg.targetPos.x, eyeCfg.targetPos.y, eyeCfg.targetPos.z] : null,
            hasDynamicEyeTarget: Boolean(eyeCfg.targetGetter),
            headEnabled: headCfg.enabled,
            headMaxYawDeg: (headCfg.maxYaw * 180 / Math.PI).toFixed(1),
            headWeight: headCfg.weight,
            hasDynamicHeadTarget: Boolean(headCfg.targetGetter),
            currentHeadYawDeg: (av.currentHeadYaw ? (av.currentHeadYaw * 180 / Math.PI).toFixed(1) : '0'),
            neckAngleDeg: neckDeg.toFixed(1),
            headAngleDeg: headDeg.toFixed(1),
            isAnimationRunning: Boolean(av.currentAction && av.currentAction.isRunning()),
          };
        }
      }
      return result;
    });
  };

  // Wait 3 seconds in Scene 1 to ensure rotations do not accumulate
  await page.waitForTimeout(3000);
  const state1 = await getAvatarsState();
  console.log('--- Scene 1 State (after 3s in scene) ---');
  console.log(JSON.stringify(state1, null, 2));

  expect(state1.dialogueTarget).toBe('partner');
  expect(state1.avatars.girl_01.hasDynamicEyeTarget).toBe(true);
  expect(state1.avatars.girl_02.hasDynamicEyeTarget).toBe(true);
  // Verify that bone angles did not accumulate to horror angles (< 30 deg)
  expect(parseFloat(state1.avatars.girl_01.neckAngleDeg)).toBeLessThan(30);
  expect(parseFloat(state1.avatars.girl_02.neckAngleDeg)).toBeLessThan(30);

  // Advance to Scene 2
  console.log('Advancing to Scene 2...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);

  const state2 = await getAvatarsState();
  console.log('--- Scene 2 State ---');
  console.log(JSON.stringify(state2, null, 2));
  expect(parseFloat(state2.avatars.girl_01.neckAngleDeg)).toBeLessThan(30);
  expect(parseFloat(state2.avatars.girl_02.neckAngleDeg)).toBeLessThan(30);

  // Advance to Scene 3 (Choice scene)
  console.log('Advancing to Scene 3 (Choice)...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);

  const state3 = await getAvatarsState();
  console.log('--- Scene 3 State (Choice) ---');
  console.log(JSON.stringify(state3, null, 2));
  expect(state3.avatars.girl_01.eyeMode).toBe('camera');
  expect(state3.avatars.girl_02.eyeMode).toBe('camera');
  expect(parseFloat(state3.avatars.girl_01.neckAngleDeg)).toBeLessThan(30);
  expect(parseFloat(state3.avatars.girl_02.neckAngleDeg)).toBeLessThan(30);

  console.log('Verification passed: Neck rotation remains stable and shallow throughout conversation!');
});
