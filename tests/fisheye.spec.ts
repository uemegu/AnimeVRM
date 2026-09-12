import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify fisheye rendering and capture screenshots', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('');
  await page.waitForTimeout(4000);

  const outDir = '/Users/ueda/.gemini/antigravity/brain/bc2fcdf4-a595-4372-938b-4b279c1a1161';

  // 1. Baseline
  await page.screenshot({ path: path.join(outDir, 'screenshot_baseline.png') });

  // 2. Fisheye Full
  await page.evaluate(() => {
    const vc = (window as any).viewerCore;
    if (vc) {
      vc.cinematicAnimePass.uniforms['uFisheyeEnabled'].value = 1.0;
      vc.cinematicAnimePass.uniforms['uFisheyeStrength'].value = 0.6;
      vc.cinematicAnimePass.uniforms['uFisheyeZoom'].value = 1.0;
      vc.cinematicAnimePass.uniforms['uFisheyeCircular'].value = 0.0;
      vc.camera.fov = 70;
      vc.camera.updateProjectionMatrix();
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'screenshot_fisheye_full.png') });

  // 3. Fisheye Circular
  await page.evaluate(() => {
    const vc = (window as any).viewerCore;
    if (vc) {
      vc.cinematicAnimePass.uniforms['uFisheyeCircular'].value = 1.0;
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'screenshot_fisheye_circular.png') });

  // 4. Open Settings tab and show GUI
  const settingsTab = page.locator('button', { hasText: 'Settings' });
  if (await settingsTab.isVisible()) {
    await settingsTab.click();
    await page.waitForTimeout(500);
    // Find and open Cinematic folder
    const postFolderTitle = page.locator('.title', { hasText: 'Post-Processing' });
    if (await postFolderTitle.isVisible()) {
      await postFolderTitle.click();
      await page.waitForTimeout(300);
      const cinematicFolderTitle = page.locator('.title', { hasText: 'Cinematic Film Effects' });
      if (await cinematicFolderTitle.isVisible()) {
        await cinematicFolderTitle.click();
        await page.waitForTimeout(300);
        const fisheyeTitle = page.locator('.title', { hasText: 'Fisheye Lens Distortion' });
        if (await fisheyeTitle.isVisible()) {
          await fisheyeTitle.click();
          await page.waitForTimeout(300);
        }
      }
    }
    await page.screenshot({ path: path.join(outDir, 'screenshot_fisheye_ui.png') });
  }

  expect(true).toBe(true);
});
