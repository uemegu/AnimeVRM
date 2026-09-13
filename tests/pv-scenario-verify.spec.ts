import { test, expect } from '@playwright/test';

test('Verify PV scenario with correct voices, animations (chin_rest, torso_twist), seaside park, and typography', async ({ page }) => {
  test.setTimeout(120000);
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log('Navigating to http://127.0.0.1:5173/AnimeVRM/ ...');
  await page.goto('http://127.0.0.1:5173/AnimeVRM/');
  await page.waitForTimeout(3000);

  // Start PV
  console.log('Starting PV scenario...');
  await page.evaluate(() => {
    const btn = document.getElementById('scenario-pv-btn');
    if (btn) btn.click();
  });

  // Wait for scenario engine to start
  await page.waitForFunction(() => {
    const sc = (window as any).scenarioController;
    return sc?.scenarioEngine?.isPlaying === true;
  }, { timeout: 35000 });

  console.log('PV scenario is playing!');

  // Helper to jump directly to a scene for inspection
  const jumpToScene = async (sceneId: string) => {
    await page.evaluate((id) => {
      const sc = (window as any).scenarioController;
      if (sc?.scenarioEngine) {
        sc.scenarioEngine.jumpToTarget(id);
      }
    }, sceneId);
    await page.waitForTimeout(2000);
  };

  // 0. Verify Cut 1 (Rooftop Narration, No Lip-Sync)
  console.log('Inspecting Cut 1 (Rooftop Narration)...');
  await page.waitForTimeout(3500); // wait for initial interlude to fully fade
  const cut1Info = await page.evaluate(() => {
    const sc = (window as any).scenarioController;
    const scene = sc.scenarioEngine.currentScene;
    return {
      sceneId: scene?.id,
      speaker: scene?.speaker,
      lipSyncCharacterId: scene?.lipSyncCharacterId,
    };
  });
  console.log('Cut 1 info:', JSON.stringify(cut1Info, null, 2));
  expect(cut1Info.sceneId).toBe('pv_cut1');
  expect(cut1Info.speaker).toBe('ナレーション');
  expect(cut1Info.lipSyncCharacterId).toBeNull();

  // Verify Cut 1 has no backdrop-filter / blur board
  const cut1Styles = await page.evaluate(() => {
    const el = document.querySelector('.pv-step-container');
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    return {
      backdropFilter: computed.backdropFilter || (computed as any).webkitBackdropFilter,
      backgroundImage: computed.backgroundImage,
    };
  });
  console.log('Cut 1 styles:', cut1Styles);
  expect(cut1Styles?.backdropFilter).toMatch(/none|^$/);
  expect(cut1Styles?.backgroundImage).toBe('none');

  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut1_rooftop_narration.png' });

  // 1. Verify Cut 2 (Classroom chin_rest)
  console.log('Inspecting Cut 2 (Classroom chin_rest)...');
  await jumpToScene('pv_cut2');
  await page.waitForTimeout(1500); // wait for camera and pose settle
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut2_chin_rest.png' });

  // Check Cut 2 avatar motion and camera
  const cut2Info = await page.evaluate(() => {
    const sc = (window as any).scenarioController;
    const scene = sc.scenarioEngine.currentScene;
    const typo = document.querySelector('.pv-main-catchphrase')?.textContent;
    const sub = document.querySelector('.pv-sub-catchphrase')?.textContent;
    return {
      sceneId: scene?.id,
      motion: scene?.avatars?.girl_01_school?.motion,
      expression: scene?.avatars?.girl_01_school?.expression,
      cameraPos: scene?.cameraPosition,
      cameraTarget: scene?.cameraTarget,
      typo,
      sub,
    };
  });
  console.log('Cut 2 info:', JSON.stringify(cut2Info, null, 2));
  expect(cut2Info.motion).toContain('chin_rest.fbx');
  expect(cut2Info.expression).toBe('relaxed');

  // 2. Verify Cut 4 (Corridor Shion torso_twist_left)
  console.log('Inspecting Cut 4 (Corridor Shion torso_twist_left)...');
  await jumpToScene('pv_cut4');
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut4_torso_twist.png' });

  const cut4Info = await page.evaluate(() => {
    const sc = (window as any).scenarioController;
    const scene = sc.scenarioEngine.currentScene;
    const typo = document.querySelector('.pv-main-catchphrase')?.textContent;
    return {
      sceneId: scene?.id,
      motion: scene?.avatars?.girl_04_school?.motion,
      rotationY: scene?.avatars?.girl_04_school?.rotationY,
      headLookAtCamera: scene?.avatars?.girl_04_school?.headLookAtCamera,
      typo,
    };
  });
  console.log('Cut 4 info:', JSON.stringify(cut4Info, null, 2));
  expect(cut4Info.motion).toContain('torso_twist_left.fbx');
  expect(cut4Info.rotationY).toBeCloseTo(-1.57, 1);
  expect(cut4Info.headLookAtCamera).toBe(true);

  // 3. Verify Cut 5 (Seaside park)
  console.log('Inspecting Cut 5 (Seaside park)...');
  await jumpToScene('pv_cut5');
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut5_seaside_park.png' });

  const cut5Info = await page.evaluate(() => {
    const sc = (window as any).scenarioController;
    const scene = sc.scenarioEngine.currentScene;
    return {
      location: scene?.location,
      background: scene?.background,
      motion: scene?.avatars?.girl_01_private?.motion,
      autoNextSec: scene?.autoNextSec,
    };
  });
  console.log('Cut 5 info:', JSON.stringify(cut5Info, null, 2));
  expect(cut5Info.background).toContain('park-with-sea-far.avif');
  expect(cut5Info.motion).not.toContain('Female Standing Pose.fbx');
  expect(cut5Info.autoNextSec).toBeCloseTo(1.16, 2);

  // 3.5 Verify Cut 6 (32s Sabi explosion, ghost-smash)
  console.log('Inspecting Cut 6 (32s Sabi explosion, ghost-smash)...');
  await jumpToScene('pv_cut6');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut6_sabi_smash.png' });
  const cut6Info = await page.evaluate(() => {
    const typo = document.querySelector('.pv-main-catchphrase') as HTMLElement;
    const ghost = document.querySelector('.pv-font-sans-proportional')?.textContent;
    const container = document.querySelector('.pv-smash-container');
    const computed = container ? window.getComputedStyle(container) : null;
    const typoComputed = typo ? window.getComputedStyle(typo) : null;
    return {
      typo: typo?.textContent,
      ghost: ghost?.trim(),
      backdropFilter: computed ? (computed.backdropFilter || (computed as any).webkitBackdropFilter) : null,
      backgroundImage: computed ? computed.backgroundImage : null,
      fontSizePx: typoComputed ? parseFloat(typoComputed.fontSize) : 0,
    };
  });
  console.log('Cut 6 info:', JSON.stringify(cut6Info, null, 2));
  expect(cut6Info.typo).toContain('この夏、君に');
  expect(cut6Info.ghost).toBe('FALL IN LOVE');
  expect(cut6Info.backdropFilter).toMatch(/none|^$/);
  expect(cut6Info.backgroundImage).toBe('none');
  expect(cut6Info.fontSizePx).toBeGreaterThanOrEqual(34);

  // 4. Verify Cut 8 (Festival 3 girls, narration, no blur board)
  console.log('Inspecting Cut 8 (Festival 3 girls)...');
  await jumpToScene('pv_cut8');
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut8_festival.png' });

  const cut8Info = await page.evaluate(() => {
    const sc = (window as any).scenarioController;
    const scene = sc.scenarioEngine.currentScene;
    const container = document.querySelector('.pv-bottom-glow-container');
    const computed = container ? window.getComputedStyle(container) : null;
    return {
      speaker: scene?.speaker,
      lipSyncCharacterId: scene?.lipSyncCharacterId,
      focusLines: scene?.focusLines,
      backdropFilter: computed ? (computed.backdropFilter || (computed as any).webkitBackdropFilter) : null,
      backgroundImage: computed ? computed.backgroundImage : null,
      g1_expr: scene?.avatars?.girl_01_private?.expression,
      g2_expr: scene?.avatars?.girl_02_private?.expression,
      g4_expr: scene?.avatars?.girl_04_private?.expression,
    };
  });
  console.log('Cut 8 info:', JSON.stringify(cut8Info, null, 2));
  expect(cut8Info.speaker).toBe('ナレーション');
  expect(cut8Info.lipSyncCharacterId).toBeNull();
  expect(cut8Info.focusLines).toBeFalsy();
  expect(cut8Info.backdropFilter).toMatch(/none|^$/);
  expect(cut8Info.backgroundImage).toBe('none');
  expect(cut8Info.g1_expr).toBe('relaxed');
  expect(cut8Info.g2_expr).toBe('relaxed');
  expect(cut8Info.g4_expr).toBe('relaxed');

  // 5. Verify Cut 9A (56s "恋してるの〜" Tagline)
  console.log('Inspecting Cut 9A (56s "恋してるの〜" Tagline)...');
  await jumpToScene('pv_cut9_intro');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut9_56s_phrase.png' });
  const cut9AInfo = await page.evaluate(() => {
    const typo = document.querySelector('.pv-main-catchphrase')?.textContent;
    return { typo };
  });
  console.log('Cut 9A info:', JSON.stringify(cut9AInfo, null, 2));
  expect(cut9AInfo.typo?.trim()).toBe('たった５秒の勇気で、世界は変わる。');

  // 6. Verify Cut 9B (Climax Kawaii Title Logo)
  console.log('Inspecting Cut 9B (Climax Kawaii Title Logo)...');
  await jumpToScene('pv_cut9_climax');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/ueda/.gemini/antigravity/brain/9aec7e4c-6538-4e22-978c-53ee49aca83c/screenshots/test_cut9_logo.png' });

  const logoInfo = await page.evaluate(() => {
    const logo = document.querySelector('.pv-title-logo-wrapper') as HTMLElement;
    const sc = (window as any).scenarioController;
    return {
      exists: !!logo,
      styleDisplay: logo?.style?.display,
      styleOpacity: logo?.style?.opacity,
      computedOpacity: logo ? window.getComputedStyle(logo).opacity : 'null',
      sceneId: sc?.scenarioEngine?.currentScene?.id,
    };
  });
  console.log('Logo info:', JSON.stringify(logoInfo, null, 2));
  expect(logoInfo.styleDisplay).toBe('flex');

  // 7. Verify ScenarioPackage Level: bgmLoop === false and zero effectText anywhere
  const packageChecks = await page.evaluate(() => {
    const sc = (window as any).scenarioController;
    const pkg = sc?.currentPackage || sc?.scenarioEngine?.currentPackage;
    const scenes = pkg?.chapters?.[0]?.scenes || [];
    let effectTextCount = 0;
    for (const scene of scenes) {
      if (scene.avatars) {
        for (const avatar of Object.values(scene.avatars) as any[]) {
          if (avatar && avatar.effectText) {
            effectTextCount++;
          }
        }
      }
    }
    const bgmAudio = sc?.scenarioEngine?.bgmAudio;
    return {
      bgmLoop: pkg?.bgmLoop,
      bgmAudioLoop: bgmAudio ? bgmAudio.loop : null,
      effectTextCount,
    };
  });
  console.log('Package checks:', JSON.stringify(packageChecks, null, 2));
  expect(packageChecks.bgmLoop).toBe(false);
  expect(packageChecks.bgmAudioLoop).toBe(false);
  expect(packageChecks.effectTextCount).toBe(0);

  console.log('All PV verifications passed successfully!');
});
