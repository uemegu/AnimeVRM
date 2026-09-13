import { test } from '@playwright/test';

test('inspect microphone audio processing and rms thresholding', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const logs = await page.evaluate(async () => {
    const records: any[] = [];
    const btnMic = document.getElementById('tab-btn-mic') as HTMLButtonElement;
    btnMic.click();

    const toggle = document.getElementById('btn-mic-toggle') as HTMLButtonElement;
    toggle.click();

    // Wait 1.5 seconds and collect stats
    await new Promise((r) => setTimeout(r, 1500));

    // Monitor for 120 frames (~2 sec)
    for (let i = 0; i < 120; i++) {
      const char = document.getElementById('hud-phoneme-char')?.textContent;
      const tag = document.getElementById('hud-phoneme-tag')?.textContent;
      const rms = document.getElementById('stat-rms')?.textContent;
      const count = document.getElementById('stat-count')?.textContent;
      records.push({ frame: i, char, tag, rms, count });
      await new Promise((r) => requestAnimationFrame(r));
    }

    return records;
  });

  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/1cfdc2f8-2c73-43fa-a2db-e99a119938e6/lipsync_mic_active.png' });
  console.log('Saved screenshot to lipsync_mic_active.png');
});
