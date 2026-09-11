import { test, expect } from '@playwright/test';

test('Gemini VAD Chat UI verification and Start Conversation', async ({ page, context }) => {
  // Grant microphone permission for VAD
  await context.grantPermissions(['microphone']);

  page.on('console', (msg) => {
    console.log(`[Browser Console ${msg.type()}] ${msg.text()}`);
  });

  // Navigate to the viewer
  await page.goto('./');

  // Wait for canvas to load
  await page.waitForSelector('#app');

  // Wait for panel container
  const panel = page.locator('#panel-container');
  await expect(panel).toBeVisible();
  const isHidden = await panel.evaluate((el) => el.classList.contains('hidden'));
  if (isHidden) {
    await page.click('#settings-open-btn');
  }

  // Select Japanese language
  const langSelect = page.locator('#language-select');
  if (await langSelect.isVisible()) {
    await langSelect.selectOption('ja');
    await page.waitForTimeout(500);
  }

  // Click Others (System) tab
  const systemTab = page.locator('.studio-tab-btn[data-tab="system"]');
  await systemTab.click();
  await page.waitForTimeout(300);

  // Verify Gemini VAD Chat container is visible
  const title = page.locator('#tab-pane-system').getByText('AIアバター音声会話 (Gemini API & VAD)');
  await expect(title).toBeVisible();

  // Verify status badge
  const badge = page.locator('#gemini-vad-badge');
  await expect(badge).toBeVisible();

  // Verify API Key input field is password type
  const apiKeyInput = page.locator('#gemini-api-key-input');
  await expect(apiKeyInput).toBeVisible();
  await expect(apiKeyInput).toHaveAttribute('type', 'password');

  // Test toggle visibility button
  const toggleKeyBtn = page.locator('#gemini-toggle-key-visibility');
  await toggleKeyBtn.click();
  await expect(apiKeyInput).toHaveAttribute('type', 'text');
  await toggleKeyBtn.click();
  await expect(apiKeyInput).toHaveAttribute('type', 'password');

  // Type a test dummy API key
  const testKey = 'TEST_GEMINI_API_KEY_12345';
  await apiKeyInput.fill(testKey);

  // Assert API Key is NEVER stored in localStorage
  const localStorageKeys = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        keys.push(k);
        const val = localStorage.getItem(k);
        if (val && val.includes('TEST_GEMINI_API_KEY_12345')) {
          throw new Error(`API key was found in localStorage key: ${k}`);
        }
      }
    }
    return keys;
  });
  console.log('localStorage keys verified:', localStorageKeys);

  // Verify TTS Server URL field
  const ttsUrlInput = page.locator('#gemini-tts-url-input');
  await expect(ttsUrlInput).toBeVisible();
  const ttsVal = await ttsUrlInput.inputValue();
  expect(ttsVal).toBe('/irodori-api/tts');

  // Verify TTS Ref and Steps fields
  const ttsRefInput = page.locator('#gemini-tts-ref-input');
  await expect(ttsRefInput).toBeVisible();
  const ttsRefVal = await ttsRefInput.inputValue();
  expect(ttsRefVal).toContain('voices/001.wav');

  const ttsStepsSelect = page.locator('#gemini-tts-steps-select');
  await expect(ttsStepsSelect).toBeVisible();
  const ttsStepsVal = await ttsStepsSelect.inputValue();
  expect(ttsStepsVal).toBe('8');

  // Verify and click Start voice button
  const toggleBtn = page.locator('#gemini-vad-toggle-btn');
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toHaveText(/音声会話を開始/);

  // Click start voice button to initialize VAD & test start flow
  console.log('Clicking Start Voice Chat button...');
  await toggleBtn.click();

  // Wait for VAD to initialize and badge to transition to listening (待機中)
  await expect(badge).toHaveText(/待機中/, { timeout: 15000 });
  await expect(toggleBtn).toHaveText(/会話を停止/);
  console.log('Successfully transitioned to listening state!');

  // Capture screenshot of listening state
  await page.screenshot({ path: 'scratch/gemini-vad-listening-ui.png', fullPage: false });

  // Click stop button
  await toggleBtn.click();
  await expect(badge).toHaveText(/停止中/);
  await expect(toggleBtn).toHaveText(/音声会話を開始/);
  console.log('Successfully stopped conversation!');
});
