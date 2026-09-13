import { test, expect } from '@playwright/test';

test('verify fixes for female ee/oh and male deep voice', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('lipsync.html');
  await page.waitForTimeout(3000);

  // 1. Verify Female "ee" (えーーーーー)
  console.log('Testing Female "ee" track...');
  const selectAudio = page.locator('#select-audio-track');
  await selectAudio.selectOption({ label: '🌟 [Irodori-TTS] えーーーーー (女性)' });
  await page.waitForTimeout(300);

  const btnPlay = page.locator('#btn-play');
  await btnPlay.click();
  await page.waitForTimeout(2500);

  let hudChar = await page.locator('#hud-phoneme-char').textContent();
  let hudTag = await page.locator('#hud-phoneme-tag').textContent();
  console.log(`Female "ee" result: char=${hudChar}, tag=${hudTag}`);
  expect(hudTag).toContain('ee');

  const btnStop = page.locator('#btn-stop');
  await btnStop.click();
  await page.waitForTimeout(500);

  // 2. Verify Female "oh" (おーーーーー)
  console.log('Testing Female "oh" track...');
  await selectAudio.selectOption({ label: '🌟 [Irodori-TTS] おーーーーー (女性)' });
  await page.waitForTimeout(300);

  await btnPlay.click();
  // Check during active speech (e.g. 800ms in, duration is ~1.7s)
  await page.waitForTimeout(800);

  hudChar = await page.locator('#hud-phoneme-char').textContent();
  hudTag = await page.locator('#hud-phoneme-tag').textContent();
  console.log(`Female "oh" result: char=${hudChar}, tag=${hudTag}`);
  expect(hudTag).toContain('oh');

  await btnStop.click();
  await page.waitForTimeout(500);

  // Take screenshot of female "oh" result
  await page.screenshot({ path: 'scratch/lipsync_fix_female_oh.png' });

  // 3. Verify Male Deep Voice Track
  console.log('Testing Male Switch and Deep Voice Track...');
  const btnMale = page.locator('#btn-gender-male');
  await btnMale.click();
  await page.waitForTimeout(500);

  await selectAudio.selectOption({ label: '🌟 [Irodori-TTS] あーいーうーえーおー (男性)' });
  await page.waitForTimeout(300);

  // Clear stats
  await page.locator('#btn-reset-stats').click();
  await page.waitForTimeout(300);

  await btnPlay.click();
  console.log('Playing Male "あーいーうーえーおー"...');
  await page.waitForTimeout(4000);

  const statCount = await page.locator('#stat-count').textContent();
  const statAvg = await page.locator('#stat-avg').textContent();
  console.log(`Male playback stats: count=${statCount}, avgLatency=${statAvg}ms`);
  expect(parseInt(statCount || '0', 10)).toBeGreaterThan(10);

  await page.screenshot({ path: 'scratch/lipsync_fix_male_playback.png' });

  await btnStop.click();
  console.log('All verification checks passed successfully!');
});
