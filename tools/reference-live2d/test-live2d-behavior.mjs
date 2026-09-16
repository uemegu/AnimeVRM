import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const outDir = 'output/reference-live2d/verification-test';
await fs.mkdir(outDir, { recursive: true });

console.log('1. Navigating to main page...');
await page.goto('http://localhost:5173/AnimeVRM/');

// Wait for initialization
await page.waitForFunction(
  () => window.live2DTransitionManager?.live2dOverlay?.isReady && !!window.avatarManager?.avatarInstance,
  { timeout: 20000 }
);

console.log('Avatar and Live2D ready.');

// Check initial mode: Should be 'vrm'
let mode = await page.evaluate(() => window.live2DTransitionManager.mode);
assert.equal(mode, 'vrm');
console.log('✓ Initial mode is VRM');

// ==========================================
// TEST 1: Camera Proximity must NOT trigger Live2D
// ==========================================
console.log('\n--- TEST 1: Camera Proximity Check ---');
console.log('Moving camera very close (0.8m) to avatar...');
await page.evaluate(() => {
  const cam = window.viewerCore.camera;
  const target = window.viewerCore.controls.target;
  cam.position.set(target.x, target.y + 0.05, target.z + 0.8);
  cam.lookAt(target);
});

// Wait 1.5s to ensure no transition happens
await page.waitForTimeout(1500);

mode = await page.evaluate(() => window.live2DTransitionManager.mode);
const dist = await page.evaluate(() => window.live2DTransitionManager.calculateDistance());
console.log(`Current distance: ${dist.toFixed(3)}m, Mode: ${mode}`);
assert.equal(mode, 'vrm', 'Mode must remain VRM even when camera is close');
console.log('✓ SUCCESS: Camera proximity did NOT trigger Live2D mode!');
await page.screenshot({ path: `${outDir}/test1-proximity-stays-vrm.png` });

// ==========================================
// TEST 2: Live2D Button in UnifiedPanel
// ==========================================
console.log('\n--- TEST 2: Live2D Button Manual Toggle ---');
const live2dBtn = page.locator('#live2d-toggle-btn');
assert(await live2dBtn.isVisible(), 'Live2D button should be visible in UI');

console.log('Clicking Live2D button...');
await live2dBtn.click();

// Wait for transition to live2d
await page.waitForFunction(
  () => window.live2DTransitionManager.mode === 'live2d',
  {},
  { timeout: 5000 }
);

const btnTextActive = await live2dBtn.textContent();
console.log('Live2D button text after click:', btnTextActive);
assert(btnTextActive.includes('Live2D中'), 'Button text should indicate active state');

const isOverlayVisible = await page.evaluate(() => window.live2DTransitionManager.live2dOverlay.isVisible);
assert.equal(isOverlayVisible, true, 'Overlay must be visible in Live2D mode');
console.log('✓ SUCCESS: Live2D button successfully activated Live2D mode!');
await page.screenshot({ path: `${outDir}/test2-button-live2d-active.png` });

console.log('Clicking Live2D button again to restore VRM...');
await live2dBtn.click();

// Wait for transition back to vrm
await page.waitForFunction(
  () => window.live2DTransitionManager.mode === 'vrm',
  {},
  { timeout: 5000 }
);

const isAvatarVisible = await page.evaluate(() => window.avatarManager.avatarInstance.getVisible());
assert.equal(isAvatarVisible, true, 'VRM avatar must be visible again');
console.log('✓ SUCCESS: Live2D button successfully returned to VRM mode!');
await page.screenshot({ path: `${outDir}/test2-button-vrm-restored.png` });

// ==========================================
// TEST 3: Scenario with Explicit Live2D Setting
// ==========================================
console.log('\n--- TEST 3: Scenario Explicit Live2D Check ---');
await page.goto('http://localhost:5173/AnimeVRM/scenarios/rooftop-nap.html');

// Wait for start button to be visible
const startBtn = page.locator('#start-btn');
await startBtn.waitFor({ state: 'visible', timeout: 10000 });
console.log('Clicking start scenario button...');
await startBtn.click();

// Wait for avatar and scenario initialization
await page.waitForFunction(
  () => window.live2DTransitionManager?.live2dOverlay?.isReady && !!window.avatarManager?.avatarInstance,
  { timeout: 20000 }
);

// Wait for scenario to be playing
await page.waitForFunction(
  () => !!window.scenarioController?.scenarioEngine?.isPlaying,
  { timeout: 10000 }
);

// Initial scene has live2d: false -> mode must be 'vrm'
mode = await page.evaluate(() => window.live2DTransitionManager.mode);
const scene0Id = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.id);
console.log(`Rooftop scenario playing, scene: ${scene0Id}, mode: ${mode}`);
assert.equal(mode, 'vrm', 'Initial scenes without live2d: true must stay in VRM mode');

console.log('Advancing scenario to scene 4 (rooftop_live2d_4)...');
for (let i = 0; i < 8; i++) {
  const currentSceneId = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.id);
  const currentMode = await page.evaluate(() => window.live2DTransitionManager.mode);
  console.log(`Step ${i}: scene = ${currentSceneId}, mode = ${currentMode}`);

  if (currentSceneId === 'rooftop_live2d_4' || currentMode === 'live2d') {
    break;
  }

  // Click advance on message window or canvas
  const messageBox = page.locator('.adv-message-window, #app');
  await messageBox.first().click({ force: true });
  await page.waitForTimeout(800);
}

// Wait for transition to live2d
await page.waitForFunction(
  () => window.live2DTransitionManager.mode === 'live2d',
  {},
  { timeout: 8000 }
);

mode = await page.evaluate(() => window.live2DTransitionManager.mode);
const sceneLive2dId = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.id);
console.log(`At explicit Live2D scene: ${sceneLive2dId}, mode: ${mode}`);
assert.equal(mode, 'live2d');
console.log('✓ SUCCESS: Explicit live2d: true in scenario activated Live2D mode!');
await page.screenshot({ path: `${outDir}/test3-scenario-live2d-active.png` });

console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
await browser.close();
