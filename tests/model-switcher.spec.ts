import { test, expect } from '@playwright/test';

test('Verify dynamic model switcher buttons and model loading for shion-private', async ({ page }) => {
  await page.goto('/');

  // Wait for initial model (aoi-school) to finish loading
  await page.waitForFunction(() => {
    const status = document.getElementById('loading-status');
    return status && status.textContent?.includes('ロード完了');
  }, { timeout: 30000 });

  // Verify all 5 model buttons are rendered dynamically
  const buttons = page.locator('#model-buttons button.model-btn:not(#open-local-vrm-btn)');
  await expect(buttons).toHaveCount(5);

  const buttonTexts = await buttons.allInnerTexts();
  console.log('Detected model buttons:', buttonTexts);

  expect(buttonTexts.some(t => t.includes('aoi-school'))).toBe(true);
  expect(buttonTexts.some(t => t.includes('aoi-school-with-bag'))).toBe(true);
  expect(buttonTexts.some(t => t.includes('emili'))).toBe(true);
  expect(buttonTexts.some(t => t.includes('shion-school'))).toBe(true);
  expect(buttonTexts.some(t => t.includes('shion-private'))).toBe(true);

  // Click shion-private button
  const shionPrivateBtn = page.locator('#model-buttons button[data-model*="shion-private"]');
  await expect(shionPrivateBtn).toBeVisible();
  await shionPrivateBtn.click();

  // Wait for shion-private to finish loading
  await page.waitForFunction(() => {
    const status = document.getElementById('loading-status');
    return status && status.textContent?.includes('ロード完了') && status.textContent?.includes('shion-private');
  }, { timeout: 30000 });

  await page.screenshot({ path: 'scratch/shion_private_loaded.png' });
  console.log('shion-private successfully loaded and screenshot captured.');
});
