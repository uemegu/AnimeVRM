import { test, expect } from '@playwright/test';

test('Verify 4-person harem scenario with 3 avatars (left: girl_01, center: girl_04, right: girl_02) and interactive choice', async ({ page }) => {
  test.setTimeout(90000);
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log('Navigating to http://localhost:5173/AnimeVRM/ ...');
  await page.goto('http://localhost:5173/AnimeVRM/');

  // Wait for viewer initialization
  await page.waitForTimeout(3000);

  // Click Harem Scenario button
  console.log('Starting 4-person Harem scenario...');
  await page.evaluate(() => {
    const btn = document.getElementById('scenario-harem-btn');
    if (btn) btn.click();
  });

  // Wait for 3 avatars (girl_01, girl_04, girl_02) to load
  await page.waitForFunction(() => {
    const sc = window.scenarioController;
    const avatars = sc?.avatarManager?.scenarioAvatars;
    return (
      avatars &&
      avatars.has('girl_01') &&
      avatars.has('girl_04') &&
      avatars.has('girl_02') &&
      avatars.get('girl_01')?.vrm &&
      avatars.get('girl_04')?.vrm &&
      avatars.get('girl_02')?.vrm
    );
  }, { timeout: 35000 });

  console.log('All 3 avatars loaded successfully!');

  // Check positions: left (girl_01), center (girl_04), right (girl_02)
  const avatarPositions = await page.evaluate(() => {
    const sc = window.scenarioController;
    const avatars = sc.avatarManager.scenarioAvatars;
    const g1 = avatars.get('girl_01').vrm.scene.position;
    const g4 = avatars.get('girl_04').vrm.scene.position;
    const g2 = avatars.get('girl_02').vrm.scene.position;
    return {
      girl_01: [g1.x, g1.y, g1.z],
      girl_04: [g4.x, g4.y, g4.z],
      girl_02: [g2.x, g2.y, g2.z],
    };
  });

  console.log('Avatar positions:', JSON.stringify(avatarPositions));

  // Verify left, center, right slots
  expect(avatarPositions.girl_01[0]).toBeLessThan(-0.3); // left (< 0)
  expect(Math.abs(avatarPositions.girl_04[0])).toBeLessThan(0.2); // center (~ 0)
  expect(avatarPositions.girl_02[0]).toBeGreaterThan(0.3); // right (> 0)

  // Wait for Scene 1 (harem_intro_1)
  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'harem_intro_1';
  }, { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/harem_intro_1.png' });
  console.log('Screenshot saved to scratch/harem_intro_1.png');

  // Advance scene: harem_intro_1 -> harem_intro_2
  console.log('Advancing to intro 2...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(600);

  // Advance scene: harem_intro_2 -> harem_intro_3 (Shion)
  console.log('Advancing to intro 3 (Shion)...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(600);

  const scene3Speaker = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.speaker);
  expect(scene3Speaker).toBe('シオン');

  // Advance scene: harem_intro_3 -> harem_intro_4 (Aoi - 3 people wide)
  console.log('Advancing to intro 4...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/harem_intro_4.png' });
  console.log('Screenshot saved to scratch/harem_intro_4.png');

  // Advance scene: harem_intro_4 -> harem_choice
  console.log('Advancing to choice...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(1000);

  // Wait for choices to appear after choiceDelaySec
  await page.waitForSelector('.adv-choice-btn', { timeout: 5000 });

  // Check choices appear in DOM
  const choicesCount = await page.locator('.adv-choice-btn').count();
  console.log(`Found ${choicesCount} choices!`);
  expect(choicesCount).toBe(4);

  // Take screenshot of 3 avatars + choices screen (wide)
  await page.screenshot({ path: 'scratch/harem_choice_screen.png' });
  console.log('Screenshot saved to scratch/harem_choice_screen.png');

  // Click Choice 3: Shion route (3番目の選択肢)
  console.log('Selecting Shion route...');
  await page.locator('.adv-choice-btn').nth(2).click();
  await page.waitForTimeout(1000);

  const afterChoiceScene = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.id);
  console.log(`Current scene after choice: ${afterChoiceScene}`);
  expect(afterChoiceScene).toBe('route_shion_1');

  // Advance through route_shion_1 -> route_shion_2 -> route_shion_3 -> harem_ending
  console.log('Advancing to route_shion_2...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(600);

  console.log('Advancing to route_shion_3...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(600);

  console.log('Advancing to harem_ending...');
  await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  await page.waitForTimeout(1000);

  const endingSceneId = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.id);
  expect(endingSceneId).toBe('harem_ending');

  await page.screenshot({ path: 'scratch/harem_ending.png' });
  console.log('Screenshot saved to scratch/harem_ending.png');
});
