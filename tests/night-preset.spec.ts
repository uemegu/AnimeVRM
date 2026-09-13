import { test, expect } from '@playwright/test';

test('verify outdoor night preset and scene switching', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('');
  await page.waitForTimeout(4000);

  // 1. Stageタブを開く
  const stageTab = page.locator('button[data-tab="stage"]');
  await expect(stageTab).toBeVisible();
  await stageTab.click();
  await page.waitForTimeout(500);

  // 2. 屋外の夜ボタンが存在することを確認
  const nightBtn = page.locator('button[data-timeofday="night"]');
  await expect(nightBtn).toBeVisible();
  await expect(nightBtn).toHaveText(/夜|Night/);

  // 3. 夜ボタンをクリック
  await nightBtn.click();
  await page.waitForTimeout(1000);

  // 4. ボタンがアクティブになっていることを確認
  await expect(nightBtn).toHaveClass(/active/);

  // 5. 設定が反映されたことを確認
  const state = await page.evaluate(() => {
    const spm = (window as any).scenePresetManager;
    const vc = (window as any).viewerCore;
    return {
      activeTod: spm.getActiveTimeOfDay(),
      activePresetId: spm.getActivePresetId(),
      directionalIntensity: vc.dirLight.intensity,
      ambientIntensity: vc.ambientLight.intensity,
      directionalColor: '#' + vc.dirLight.color.getHexString(),
      ambientColor: '#' + vc.ambientLight.color.getHexString(),
    };
  });

  console.log('Night Preset State (Park):', state);
  expect(state.activeTod).toBe('night');
  expect(state.activePresetId).toBe('night_park');
  expect(state.directionalIntensity).toBe(3);
  expect(state.ambientIntensity).toBe(0.5);
  expect(state.directionalColor.toLowerCase()).toBe('#ffffff');
  expect(state.ambientColor.toLowerCase()).toBe('#ffebeb');

  // 6. 夏祭りロケーションをクリック
  const festivalBtn = page.locator('button[data-location="night_festival"]');
  await expect(festivalBtn).toBeVisible();
  await festivalBtn.click();
  await page.waitForTimeout(1000);

  const festivalState = await page.evaluate(() => {
    const spm = (window as any).scenePresetManager;
    const vc = (window as any).viewerCore;
    return {
      activeTod: spm.getActiveTimeOfDay(),
      activePresetId: spm.getActivePresetId(),
      skyZenith: '#' + vc.skyBackground.material.uniforms.uZenith.value.getHexString(),
      skyGlow: vc.skyBackground.material.uniforms.uSkyGlow.value,
    };
  });
  console.log('Festival State:', festivalState);
  expect(festivalState.activeTod).toBe('night');
  expect(festivalState.activePresetId).toBe('night_festival');
  expect(festivalState.skyZenith.toLowerCase()).toBe('#183655');
  expect(festivalState.skyGlow).toBe(0.12);

  // 7. スクリーンショットを撮影して保存
  await page.screenshot({ path: 'tests/screenshots/night-preset-verification.png' });
});
