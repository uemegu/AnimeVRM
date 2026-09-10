import { test, expect } from '@playwright/test';
import path from 'path';

test('verify anime fast motion effects and scenario execution', async ({ page }) => {
  const artifactDir = '/Users/ueda/.gemini/antigravity/brain/af386fd4-5a59-46b2-a7f9-7005aa7dfa07';

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  // Navigate to viewer
  await page.goto('');

  // Wait for initial VRM model to load
  await page.waitForFunction(() => {
    const el = document.getElementById('loading-status');
    return el && el.textContent && el.textContent.includes('ロード完了');
  }, { timeout: 35000 });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(artifactDir, '01_initial_loaded.png') });

  // Switch to Stage tab where scenarios live
  const stageTabBtn = page.locator('.studio-tab-btn[data-tab="stage"]');
  await stageTabBtn.click();

  // Locate and click the Fast Motion scenario button
  const fastMotionBtn = page.locator('#scenario-fastmotion-btn');
  await expect(fastMotionBtn).toBeVisible();
  await fastMotionBtn.click();

  // Wait for multi-character setup (Scene 1: intro - blur disabled)
  await page.waitForTimeout(3000);
  const blurScene1 = await page.evaluate(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[0]?.fastMotionEffect?.getConfig()?.directionalBlurEnabled;
  });
  expect(blurScene1).toBe(false);

  // Advance to Scene 2: Aoi waving hands fast (blur enabled, 2.0x speed)
  await page.evaluate(() => (window as any).scenarioController.scenarioEngine.next());
  await page.waitForFunction(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[0]?.getMotionSpeed() === 2.0;
  }, { timeout: 10000 });

  const blurScene2 = await page.evaluate(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[0]?.fastMotionEffect?.getConfig()?.directionalBlurEnabled;
  });
  expect(blurScene2).toBe(true);

  // Wait for the fast waving motion to swing the arm at 2x speed
  let capturedWave = false;
  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(100);
    const waveInfo = await page.evaluate(() => {
      const am = (window as any).avatarManager;
      const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
      const aoi = scAvs[0];
      const tracker = (aoi?.fastMotionEffect as any)?.tracker;
      const pos = tracker?.getCurrentPositions('rightArm');
      return tracker ? {
        handY: pos?.tip?.y ?? 0,
        speed: tracker.getSpeed('rightArm'),
        intensity: tracker.getIntensity('rightArm'),
      } : null;
    });

    if (waveInfo && (waveInfo.intensity > 0.3 || waveInfo.handY > 1.1) && !capturedWave) {
      await page.screenshot({ path: path.join(artifactDir, '02_fastmotion_waving.png') });
      capturedWave = true;
      console.log('Successfully captured waving at:', waveInfo);
      break;
    }
  }
  if (!capturedWave) {
    await page.screenshot({ path: path.join(artifactDir, '02_fastmotion_waving.png') });
  }

  // Advance to Scene 3: Emily ready (blur disabled)
  await page.evaluate(() => (window as any).scenarioController.scenarioEngine.next());
  await page.waitForTimeout(1000);
  const blurScene3 = await page.evaluate(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[1]?.fastMotionEffect?.getConfig()?.directionalBlurEnabled;
  });
  expect(blurScene3).toBe(false);

  // Advance to Scene 4: Emily Punching fast! (blur enabled)
  await page.evaluate(() => (window as any).scenarioController.scenarioEngine.next());
  const blurScene4 = await page.evaluate(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[1]?.fastMotionEffect?.getConfig()?.directionalBlurEnabled;
  });
  expect(blurScene4).toBe(true);

  await page.waitForFunction(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[1]?.getMotionSpeed() === 1.4;
  }, { timeout: 10000 });

  // Monitor velocity and capture screenshots during active punch thrust
  let capturedPunch = false;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(100);
    const punchInfo = await page.evaluate(() => {
      const am = (window as any).avatarManager;
      const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
      const emily = scAvs[1]; // girl_02 Emily
      const tracker = (emily?.fastMotionEffect as any)?.tracker;
      return tracker ? {
        leftSpeed: tracker.getSpeed('leftArm'),
        rightSpeed: tracker.getSpeed('rightArm'),
        leftIntensity: tracker.getIntensity('leftArm'),
        rightIntensity: tracker.getIntensity('rightArm'),
      } : null;
    });

    if (punchInfo && (punchInfo.leftIntensity > 0.5 || punchInfo.rightIntensity > 0.5) && !capturedPunch) {
      await page.screenshot({ path: path.join(artifactDir, '03_fastmotion_punching.png') });
      capturedPunch = true;
      console.log('Successfully captured punch at peak intensity:', punchInfo);
      break;
    }
  }

  if (!capturedPunch) {
    await page.screenshot({ path: path.join(artifactDir, '03_fastmotion_punching.png') });
  }

  // Advance to Scene 5: Aoi praise (blur disabled)
  await page.evaluate(() => (window as any).scenarioController.scenarioEngine.next());
  await page.waitForTimeout(1000);
  const blurScene5 = await page.evaluate(() => {
    const am = (window as any).avatarManager;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    return scAvs[0]?.fastMotionEffect?.getConfig()?.directionalBlurEnabled;
  });
  expect(blurScene5).toBe(false);

  // Verify that avatars have FastMotionEffect instances attached and active
  const effectReport = await page.evaluate(() => {
    const am = (window as any).avatarManager;
    const av = am?.avatarInstance;
    const scAvs = Array.from((am?.scenarioAvatars as Map<string, any>)?.values() || []);
    const all = av ? [av, ...scAvs] : scAvs;

    return all.map((avatar) => {
      const effect = avatar.fastMotionEffect;
      return {
        hasEffect: !!effect,
        config: effect ? effect.getConfig() : null,
      };
    });
  });

  console.log('Effect verification report:', JSON.stringify(effectReport, null, 2));
  expect(effectReport.length).toBeGreaterThan(0);
  expect(effectReport.every((r) => r.hasEffect)).toBe(true);

  // Check for critical exceptions
  const criticalErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('AudioContext') && !e.includes('WebGL')
  );
  expect(criticalErrors).toHaveLength(0);
});
