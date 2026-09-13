import { test, expect } from '@playwright/test';

test('verify Face shading border shift GUI control and material update', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('');
  await page.waitForTimeout(4000);

  // 1. Click Visual tab
  const visualTab = page.locator('button[data-tab="visual"]');
  await expect(visualTab).toBeVisible();
  await visualTab.click();
  await page.waitForTimeout(1000);

  // 2. Open root Visual GUI if closed
  const rootGui = page.locator('#gui-mount-point-visual .lil-gui.root');
  await expect(rootGui).toBeVisible();
  const rootTitle = rootGui.locator('> .title');
  if (await rootTitle.isVisible()) {
    const isRootClosed = await rootGui.evaluate((el) => el.classList.contains('closed'));
    if (isRootClosed) {
      await rootTitle.click();
      await page.waitForTimeout(300);
    }
  }

  // 3. Open Body & Skin Material folder
  const bodyFolder = rootGui.locator('.lil-gui', {
    hasText: /体・肌マテリアル|Body & Skin Material/,
  }).first();
  await expect(bodyFolder).toBeVisible();

  const isBodyClosed = await bodyFolder.evaluate((el) => el.classList.contains('closed'));
  if (isBodyClosed) {
    await bodyFolder.locator('> .title').click();
    await page.waitForTimeout(300);
  }

  // 3. Verify Face Shading Shift controller is visible
  const faceShiftController = bodyFolder.locator('.controller', {
    hasText: /顔の明暗境界シフト|Face Shading Border Shift/,
  });
  await expect(faceShiftController).toBeVisible();

  // Verify initial input value is 0.65
  const input = faceShiftController.locator('input');
  await expect(input).toHaveValue('0.65');

  // 4. Change Face Shading Shift to 0.20
  await input.fill('0.20');
  await input.press('Enter');
  await page.waitForTimeout(500);

  // 5. Evaluate that currentConfig reflects 0.20
  const configVal = await page.evaluate(() => {
    return (window as any).currentConfig?.materials?.body?.faceShadingShiftFactor;
  });
  expect(configVal).toBe(0.20);

  // 6. If VRM avatar is loaded, evaluate that face materials reflect 0.20
  const faceShadingShiftVal = await page.evaluate(() => {
    const avatar = (window as any).avatarManager?.avatarInstance;
    if (!avatar || !avatar.currentVrm) return null;

    const faceMaterials: any[] = [];
    avatar.currentVrm.scene.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (/Face|Mouth|顔|口/i.test(m.name || '') || /Face|Mouth|顔|口/i.test(obj.name || '')) {
            if (!/Eyeline|Eyelash|Eye|Brow|アイライン|まつ毛|まつげ|目|眉/i.test(m.name || '')) {
              faceMaterials.push(m);
            }
          }
        }
      }
    });

    return faceMaterials.map((m) => ({
      name: m.name,
      shadingShiftFactor: m.shadingShiftFactor,
      uniformVal: m.uniforms?.shadingShiftFactor?.value,
    }));
  });

  if (faceShadingShiftVal && faceShadingShiftVal.length > 0) {
    for (const m of faceShadingShiftVal) {
      expect(Math.abs(m.shadingShiftFactor - 0.20)).toBeLessThan(0.01);
    }
  }
});
