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
page.on('console', (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));

console.log('Navigating to http://localhost:5173/AnimeVRM/ ...');
await page.goto('http://localhost:5173/AnimeVRM/');

// Wait for avatarManager and live2DTransitionManager to initialize
try {
  await page.waitForFunction(
    () => window.live2DTransitionManager?.live2dOverlay?.isReady && !!window.avatarManager?.avatarInstance,
    { timeout: 20000 }
  );
} catch (e) {
  const status = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    hasLive2DManager: !!window.live2DTransitionManager,
    isReady: window.live2DTransitionManager?.live2dOverlay?.isReady,
    hasAvatarManager: !!window.avatarManager,
    hasAvatarInstance: !!window.avatarManager?.avatarInstance,
  }));
  console.log('Timeout inspection status:', status);
  await page.screenshot({ path: 'output/reference-live2d/cutin-test/debug-timeout.png' });
  throw e;
}

console.log('Avatar and Live2D loaded successfully.');

const outDir = 'output/reference-live2d/cutin-test';
await fs.mkdir(outDir, { recursive: true });

// Check initial mode: Should be 'vrm'
let mode = await page.evaluate(() => window.live2DTransitionManager.mode);
let dist = await page.evaluate(() => window.live2DTransitionManager.calculateDistance());
console.log(`Initial distance: ${dist.toFixed(3)}m, Mode: ${mode}`);
assert.equal(mode, 'vrm');

// Capture initial VRM state
await page.screenshot({ path: `${outDir}/01-vrm-initial.png` });

// Move camera close to avatar: distance = 1.35m (well under 1.55m threshold)
console.log('Moving camera close to avatar (target distance: 1.35m)...');
await page.evaluate(() => {
  const cam = window.viewerCore.camera;
  const target = window.viewerCore.controls.target;
  cam.position.set(target.x, target.y + 0.05, target.z + 1.35);
  cam.lookAt(target);
});

// Wait for transition to live2d
console.log('Waiting for Live2D transition...');
await page.waitForFunction(
  () => window.live2DTransitionManager.mode === 'live2d',
  {},
  { timeout: 5000 }
);

// Verify Live2D state
const live2dState = await page.evaluate(() => {
  const lm = window.live2DTransitionManager;
  const appCanvas = window.viewerCore.canvas;
  const avatar = window.avatarManager.avatarInstance;
  return {
    mode: lm.mode,
    overlayVisible: lm.live2dOverlay.isVisible,
    appCanvasFilter: appCanvas.style.filter,
    appCanvasTransform: appCanvas.style.transform,
    avatarVisible: avatar.getVisible(),
    distance: lm.calculateDistance(),
  };
});

console.log('Live2D state:', live2dState);
assert.equal(live2dState.mode, 'live2d');
assert.equal(live2dState.overlayVisible, true);
assert.equal(live2dState.avatarVisible, false);
assert(live2dState.appCanvasFilter.includes('blur'), 'Canvas filter should include blur');
assert(live2dState.appCanvasTransform.includes('scale(1.22)'), 'Canvas transform should include scale(1.22)');

// Capture Live2D close-up state
await page.screenshot({ path: `${outDir}/02-live2d-closeup.png` });

// Test portrait/mobile viewport (like the user uploaded screenshot)
await page.setViewportSize({ width: 600, height: 760 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/02b-live2d-portrait.png` });
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(200);

// Move camera away: distance = 2.2m (over 1.75m restore threshold)
console.log('Moving camera away (target distance: 2.2m)...');
await page.evaluate(() => {
  const cam = window.viewerCore.camera;
  const target = window.viewerCore.controls.target;
  cam.position.set(target.x, target.y + 0.05, target.z + 2.2);
  cam.lookAt(target);
});

// Wait for transition back to VRM
console.log('Waiting for VRM restore transition...');
await page.waitForFunction(
  () => window.live2DTransitionManager.mode === 'vrm',
  {},
  { timeout: 5000 }
);

// Verify restored VRM state
const restoredState = await page.evaluate(() => {
  const lm = window.live2DTransitionManager;
  const appCanvas = window.viewerCore.canvas;
  const avatar = window.avatarManager.avatarInstance;
  return {
    mode: lm.mode,
    overlayVisible: lm.live2dOverlay.isVisible,
    appCanvasFilter: appCanvas.style.filter,
    avatarVisible: avatar.getVisible(),
    distance: lm.calculateDistance(),
  };
});

console.log('Restored state:', restoredState);
assert.equal(restoredState.mode, 'vrm');
assert.equal(restoredState.overlayVisible, false);
assert.equal(restoredState.avatarVisible, true);
assert.equal(restoredState.appCanvasFilter, '');

// Capture restored state
await page.screenshot({ path: `${outDir}/03-vrm-restored.png` });

console.log('Errors logged:', errors);
assert.equal(errors.length, 0);

await browser.close();
console.log('Test completed successfully: VRM -> Dark Fade -> Live2D with Background Blur -> Dark Fade -> VRM Restored!');
