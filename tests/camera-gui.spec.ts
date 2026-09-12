import { test, expect } from '@playwright/test';

test('verify Stage camera controls in normal and panorama modes', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('');
  await page.waitForTimeout(4000);

  // 1. Click Stage tab
  const stageTab = page.locator('button[data-tab="stage"]');
  await expect(stageTab).toBeVisible();
  await stageTab.click();
  await page.waitForTimeout(1000);

  // 2. Normal stage mode tests
  console.log('--- Testing in Normal Mode ---');

  // Initial state check
  const initNormal = await page.evaluate(() => {
    const vc = (window as any).viewerCore;
    return {
      camY: vc.camera.position.y,
      targetY: vc.controls.target.y,
      fov: vc.camera.fov,
      panoramaActive: vc.panoramaController.isActive,
    };
  });
  console.log('Initial Normal State:', initNormal);
  expect(initNormal.panoramaActive).toBe(false);

  // Adjust Camera Height
  const cameraYController = page.locator('#gui-mount-point-stage .controller', { hasText: /カメラ高さ|Camera Height/ });
  await expect(cameraYController).toBeVisible();
  const cameraYInput = cameraYController.locator('input');
  await cameraYInput.fill('1.80');
  await cameraYInput.press('Enter');
  await page.waitForTimeout(500);

  const afterCamY = await page.evaluate(() => (window as any).viewerCore.camera.position.y);
  console.log('After setting Camera Y to 1.80:', afterCamY);
  expect(Math.abs(afterCamY - 1.80)).toBeLessThan(0.05);

  // Adjust FOV
  const fovController = page.locator('#gui-mount-point-stage .controller', { hasText: /視野角|Field of View/ });
  await expect(fovController).toBeVisible();
  const fovInput = fovController.locator('input');
  await fovInput.fill('45');
  await fovInput.press('Enter');
  await page.waitForTimeout(500);

  const afterFov = await page.evaluate(() => (window as any).viewerCore.camera.fov);
  console.log('After setting FOV to 45:', afterFov);
  expect(Math.abs(afterFov - 45)).toBeLessThan(1);

  // Adjust Yaw (horizontal angle)
  const yawController = page.locator('#gui-mount-point-stage .controller', { hasText: /水平角|Yaw/ });
  await expect(yawController).toBeVisible();
  const yawInput = yawController.locator('input');
  await yawInput.fill('90');
  await yawInput.press('Enter');
  await page.waitForTimeout(500);

  const afterYaw = await page.evaluate(() => {
    const vc = (window as any).viewerCore;
    const target = vc.controls.target;
    const dx = vc.camera.position.x - target.x;
    const dz = vc.camera.position.z - target.z;
    return Math.round((Math.atan2(dx, dz) * 180) / Math.PI);
  });
  console.log('After setting Yaw to 90:', afterYaw);
  expect(Math.abs(afterYaw - 90)).toBeLessThan(2);

  // Adjust Pitch (vertical angle)
  const pitchController = page.locator('#gui-mount-point-stage .controller', { hasText: /仰角|Pitch/ });
  await expect(pitchController).toBeVisible();
  const pitchInput = pitchController.locator('input');
  await pitchInput.fill('25');
  await pitchInput.press('Enter');
  await page.waitForTimeout(500);

  const afterPitch = await page.evaluate(() => {
    const vc = (window as any).viewerCore;
    const target = vc.controls.target;
    const dx = vc.camera.position.x - target.x;
    const dz = vc.camera.position.z - target.z;
    const distXZ = Math.hypot(dx, dz);
    const dy = vc.camera.position.y - target.y;
    return Math.round((Math.atan2(dy, distXZ) * 180) / Math.PI);
  });
  console.log('After setting Pitch to 25:', afterPitch);
  expect(Math.abs(afterPitch - 25)).toBeLessThan(2);

  // Reset View
  const resetBtn = page.locator('#gui-mount-point-stage button, #gui-mount-point-stage .name', { hasText: /視点リセット|Reset View/ }).first();
  await resetBtn.click();
  await page.waitForTimeout(500);

  const resetState = await page.evaluate(() => {
    const vc = (window as any).viewerCore;
    return {
      camY: vc.camera.position.y,
      fov: vc.camera.fov,
    };
  });
  console.log('After Reset View:', resetState);
  expect(Math.abs(resetState.camY - 1.1)).toBeLessThan(0.05);
  expect(Math.abs(resetState.fov - 30)).toBeLessThan(1);

  console.log('All camera adjustments in Normal Stage mode successfully verified!');

  // 3. Panorama mode tests
  console.log('--- Testing in Panorama Mode ---');
  const testClassroomBtn = page.locator('#gui-mount-point-stage button, #gui-mount-point-stage .name', { hasText: /教室360°|Classroom 360°/ }).first();
  await testClassroomBtn.click();
  await page.waitForTimeout(2500);

  const isPanoramaActive = await page.evaluate(() => (window as any).viewerCore.panoramaController.isActive);
  console.log('Is Panorama Active:', isPanoramaActive);
  expect(isPanoramaActive).toBe(true);

  // Adjust Camera Height in Panorama
  await cameraYInput.fill('1.60');
  await cameraYInput.press('Enter');
  await page.waitForTimeout(500);

  const panoramaCamY = await page.evaluate(() => (window as any).viewerCore.panoramaController.cameraY);
  console.log('After setting Panorama Camera Y to 1.60:', panoramaCamY);
  expect(Math.abs(panoramaCamY - 1.60)).toBeLessThan(0.05);

  // Adjust FOV in Panorama
  await fovInput.fill('70');
  await fovInput.press('Enter');
  await page.waitForTimeout(500);

  const panoramaFov = await page.evaluate(() => (window as any).viewerCore.panoramaController.targetFov);
  console.log('After setting Panorama FOV to 70:', panoramaFov);
  expect(Math.abs(panoramaFov - 70)).toBeLessThan(1);

  // Reset View in Panorama
  await resetBtn.click();
  await page.waitForTimeout(500);

  const panoramaResetFov = await page.evaluate(() => (window as any).viewerCore.panoramaController.targetFov);
  console.log('After Panorama Reset FOV:', panoramaResetFov);
  expect(Math.abs(panoramaResetFov - 60)).toBeLessThan(1);

  console.log('Both Normal and Panorama camera adjustments successfully verified!');
});
