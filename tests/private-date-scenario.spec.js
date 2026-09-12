import { test, expect } from '@playwright/test';

test('Verify Private Holiday Date scenario with 3 casual VRM avatars (emili, shion, aoi) across 6 scenes', async ({ page }) => {
  test.setTimeout(120000);
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log('Navigating to http://localhost:5173/AnimeVRM/ ...');
  await page.goto('http://localhost:5173/AnimeVRM/');

  // Wait for viewer initialization
  await page.waitForTimeout(3000);

  // Helper to advance scene safely
  const advance = async () => {
    await page.waitForFunction(() => {
      const se = window.scenarioController?.scenarioEngine;
      return se && !se['isSceneTransitioning'];
    }, { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scenarioController?.scenarioEngine?.next());
  };

  // Click Holiday Date Scenario button
  console.log('Starting Holiday Private Date scenario...');
  await page.evaluate(() => {
    const btn = document.getElementById('scenario-privatedate-btn');
    if (btn) btn.click();
  });

  // Wait for all 3 avatars (girl_02: emili, girl_04: shion, girl_01: aoi) to load
  await page.waitForFunction(() => {
    const sc = window.scenarioController;
    const avatars = sc?.avatarManager?.scenarioAvatars;
    return (
      avatars &&
      avatars.has('girl_02') &&
      avatars.has('girl_04') &&
      avatars.has('girl_01') &&
      avatars.get('girl_02')?.vrm &&
      avatars.get('girl_04')?.vrm &&
      avatars.get('girl_01')?.vrm
    );
  }, { timeout: 45000 });

  console.log('All 3 casual outfit avatars loaded successfully!');

  // Check current scene: prep_1 (Scene 1: Room prep)
  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'prep_1';
  }, { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/date_scene_1_prep.png' });
  console.log('Scene 1 (Room) verified.');

  // Advance to prep_2 (Chime)
  await advance();
  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'prep_2';
  }, { timeout: 5000 });
  await page.waitForTimeout(600);

  // Advance to door_1 (Scene 2: Emily at Apartment Door)
  await advance();
  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'door_1';
  }, { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/date_scene_2_door.png' });
  console.log('Scene 2 (Door dialogue) verified.');

  // Advance to door_choice (Separate scene for choice)
  await advance();
  await page.waitForFunction(() => {
    const se = window.scenarioController?.scenarioEngine;
    return se?.currentScene?.id === 'door_choice' && (se?.currentScene?.choices?.length ?? 0) > 0;
  }, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const se = window.scenarioController?.scenarioEngine;
    if (se?.currentScene?.choices) {
      se.selectChoice(se.currentScene.choices[0]);
    }
  });

  // Wait for door_choice_1 and advance to walk_1 (Scene 3: Town Walk)
  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'door_choice_1';
  }, { timeout: 5000 });
  await advance(); // goes to door_depart

  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'door_depart';
  }, { timeout: 5000 });
  await advance(); // goes to walk_1

  await page.waitForFunction(() => {
    const sc = window.scenarioController;
    return sc?.scenarioEngine?.currentScene?.id === 'walk_1' && sc?.scrollingBackgroundManager?.isVisible;
  }, { timeout: 12000 });

  const isScrollingBg = await page.evaluate(() => {
    return window.scenarioController?.scrollingBackgroundManager?.isVisible ?? false;
  });
  console.log('Scrolling background active:', isScrollingBg);
  expect(isScrollingBg).toBe(true);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/date_scene_3_walk.png' });
  console.log('Scene 3 (Walk) verified.');

  // Advance to shion_1 (Scene 4: Shion encounter in town)
  await advance(); // walk_2
  await advance(); // walk_3
  await advance(); // shion_1

  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'shion_1';
  }, { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/date_scene_4_shion.png' });
  console.log('Scene 4 (Shion encounter) verified.');

  // Advance through Shion conversation to cafe_1 (Scene 5: Cafe meeting Aoi)
  await advance(); // shion_2
  await advance(); // shion_3
  await advance(); // shion_4
  await advance(); // cafe_1

  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'cafe_1';
  }, { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/date_scene_5_cafe_aoi.png' });
  console.log('Scene 5 (Cafe Aoi encounter) verified.');

  // Advance through Cafe conversation to park_1 (Scene 6: Sunset Park)
  await advance(); // cafe_2
  await advance(); // cafe_3
  await advance(); // cafe_4
  await advance(); // cafe_5
  await advance(); // cafe_6
  await advance(); // park_1

  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'park_1';
  }, { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/date_scene_6_park_sunset.png' });
  console.log('Scene 6 (Sunset Park) verified.');

  // Advance to park_3 (Dialogue)
  await advance(); // park_2
  await advance(); // park_3
  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'park_3';
  }, { timeout: 8000 });
  await page.waitForTimeout(600);

  // Advance to park_choice (Separate choice scene)
  await advance(); // park_choice
  await page.waitForFunction(() => {
    const se = window.scenarioController?.scenarioEngine;
    return se?.currentScene?.id === 'park_choice' && (se?.currentScene?.choices?.length ?? 0) > 1;
  }, { timeout: 10000 });
  await page.waitForTimeout(500);

  // Select Choice 2: また二人でデートしようね
  await page.evaluate(() => {
    const se = window.scenarioController?.scenarioEngine;
    if (se?.currentScene?.choices && se.currentScene.choices.length > 1) {
      se.selectChoice(se.currentScene.choices[1]);
    }
  });

  await page.waitForFunction(() => {
    return window.scenarioController?.scenarioEngine?.currentScene?.id === 'park_choice_2';
  }, { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scratch/date_scene_6_park_heart.png' });
  console.log('Scene 6 (Park Heart Ending) verified.');

  console.log('All 6 scenes verified successfully!');
});
