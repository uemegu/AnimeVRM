import { test, expect } from '@playwright/test';

test('verify lipsync.html features: mouth close-up, gender switch, speech samples, mic input, and latency stats', async ({ page }) => {
  test.setTimeout(90000);

  // 1. Open lipsync.html
  console.log('Navigating to lipsync.html...');
  await page.goto('lipsync.html');
  await page.waitForLoadState('domcontentloaded');

  // Verify basic UI elements exist
  const canvas = page.locator('#app');
  await expect(canvas).toBeVisible();

  const hudBox = page.locator('#active-phoneme-hud');
  await expect(hudBox).toBeVisible();

  const dashboard = page.locator('#dashboard-panel');
  await expect(dashboard).toBeVisible();

  // Wait for VRM model loading
  console.log('Waiting for VRM model to load...');
  await page.waitForTimeout(4000);

  // Take initial close-up screenshot
  await page.screenshot({ path: 'scratch/lipsync_01_initial_closeup.png' });

  // 2. Test Camera Presets
  console.log('Testing camera presets...');
  const btnFace = page.locator('#cam-preset-face');
  await btnFace.click();
  await page.waitForTimeout(1000);
  await expect(btnFace).toHaveClass(/active/);

  const btnMouth = page.locator('#cam-preset-mouth');
  await btnMouth.click();
  await page.waitForTimeout(1000);
  await expect(btnMouth).toHaveClass(/active/);

  // 3. Test Gender Toggle
  console.log('Testing gender profile toggle...');
  const btnMale = page.locator('#btn-gender-male');
  const btnFemale = page.locator('#btn-gender-female');

  await expect(btnFemale).toHaveClass(/active/);
  await btnMale.click();
  await page.waitForTimeout(500);
  await expect(btnMale).toHaveClass(/active/);
  await expect(btnFemale).not.toHaveClass(/active/);

  // Verify sample tracks updated to male tracks
  const selectAudio = page.locator('#select-audio-track');
  let optionText = await selectAudio.locator('option:checked').textContent();
  console.log('Selected male track:', optionText);
  expect(optionText).toContain('男性');

  // Switch back to female
  await btnFemale.click();
  await page.waitForTimeout(500);
  await expect(btnFemale).toHaveClass(/active/);
  optionText = await selectAudio.locator('option:checked').textContent();
  console.log('Selected female track:', optionText);
  expect(optionText).toContain('女性');

  // 4. Test Sample Audio Playback & Vowel Recognition
  console.log('Testing audio playback of vowels...');
  const btnPlay = page.locator('#btn-play');
  await btnPlay.click();
  console.log('Audio playback started, waiting for analysis frames...');

  // Wait 3 seconds for audio playback and lipsync analysis
  await page.waitForTimeout(3000);

  // Verify latency statistics have populated
  const statCount = page.locator('#stat-count');
  const countVal = await statCount.textContent();
  const countNum = parseInt(countVal || '0', 10);
  console.log('Analysis count:', countNum);
  expect(countNum).toBeGreaterThan(5);

  const statCurrent = await page.locator('#stat-current').textContent();
  const statAvg = await page.locator('#stat-avg').textContent();
  console.log(`Latency Current: ${statCurrent}ms, Avg: ${statAvg}ms`);
  expect(parseFloat(statAvg || '0')).toBeGreaterThan(0);

  // Screenshot during speech analysis
  await page.screenshot({ path: 'scratch/lipsync_02_playing_speech.png' });

  // 5. Test Latency Reset Button
  console.log('Testing reset stats button...');
  const btnResetStats = page.locator('#btn-reset-stats');
  await btnResetStats.click();
  await page.waitForTimeout(500);

  // Stop playback
  const btnStop = page.locator('#btn-stop');
  await btnStop.click();
  await page.waitForTimeout(500);

  // 6. Test Microphone Input Mode
  console.log('Testing microphone input mode...');
  const tabMic = page.locator('#tab-btn-mic');
  await tabMic.click();
  await page.waitForTimeout(500);

  const btnMicToggle = page.locator('#btn-mic-toggle');
  await btnMicToggle.click();
  await page.waitForTimeout(1000);
  await expect(btnMicToggle).toHaveClass(/recording/);
  console.log('Microphone mode active!');

  await page.screenshot({ path: 'scratch/lipsync_03_mic_recording.png' });

  // Stop mic
  await btnMicToggle.click();
  await page.waitForTimeout(500);
  await expect(btnMicToggle).not.toHaveClass(/recording/);

  console.log('All lipsync features verified successfully!');
});
