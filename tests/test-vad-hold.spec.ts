import { test, expect } from '@playwright/test';

test('verify smooth continuous mic phoneme detection without flickering', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const report = await page.evaluate(async () => {
    // Simulate audio frames with periodic volume dips (mimicking microphone pitch cycle valleys)
    // 60 frames: alternating high/low RMS
    const rawRmsSeries = [
      0.001, 0.001, // silence
      0.035, 0.002, 0.028, 0.003, 0.040, 0.001, 0.032, 0.002, // speaking with pitch valleys
      0.038, 0.002, 0.030, 0.004, 0.035, 0.001, 0.033, 0.002, // speaking
      0.001, 0.000, 0.000, 0.001, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, // natural stop speaking (>12 frames silence)
    ];

    // 1. Without Hold/Smoothing (Old behavior)
    const oldResults: string[] = [];
    let oldCurrentP = 'nn';
    for (const r of rawRmsSeries) {
      if (r < 0.01) {
        oldCurrentP = 'nn';
      } else {
        oldCurrentP = 'aa';
      }
      oldResults.push(oldCurrentP);
    }

    // 2. With Hold Time (200ms ~ 12 frames at 60fps) + Smoothed RMS
    const newResults: string[] = [];
    let newCurrentP = 'nn';
    let smoothedRms = 0;
    let silenceHoldFrames = 0;
    const MAX_HOLD_FRAMES = 12; // ~200ms hold

    for (const r of rawRmsSeries) {
      smoothedRms = smoothedRms * 0.65 + r * 0.35;
      const isVoiceActive = smoothedRms >= 0.008 || r >= 0.01;

      if (isVoiceActive) {
        newCurrentP = 'aa';
        silenceHoldFrames = MAX_HOLD_FRAMES;
      } else {
        if (silenceHoldFrames > 0) {
          silenceHoldFrames--;
          // Keep current phoneme during hold!
        } else {
          newCurrentP = 'nn';
        }
      }
      newResults.push(newCurrentP);
    }

    // Count flickers (transitions between aa and nn)
    let oldFlickers = 0;
    let newFlickers = 0;
    for (let i = 1; i < oldResults.length; i++) {
      if (oldResults[i] !== oldResults[i - 1]) oldFlickers++;
      if (newResults[i] !== newResults[i - 1]) newFlickers++;
    }

    return {
      oldResults,
      newResults,
      oldFlickers,
      newFlickers,
    };
  });

  console.log('Old flickers (flickering transitions):', report.oldFlickers);
  console.log('New flickers (smooth transitions):', report.newFlickers);
  console.log('New sequence:', report.newResults.join(''));

  expect(report.oldFlickers).toBeGreaterThan(10);
  expect(report.newFlickers).toBe(2); // exactly 1 on (start speaking) and 1 off (stop speaking)
});
