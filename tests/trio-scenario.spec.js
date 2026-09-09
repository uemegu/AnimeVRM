import { test, expect } from '@playwright/test';

test('Verify Trio 3-person conversation scenario with conversational LookAt attention and bust-up framing', async ({ page }) => {
  test.setTimeout(60000);
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log('Navigating to http://localhost:5173/AnimeVRM/ ...');
  await page.goto('http://localhost:5173/AnimeVRM/');

  // Wait for initial model loading
  await page.waitForTimeout(3000);

  // Click the Trio scenario button
  console.log('Starting 3-person (Trio) scenario...');
  await page.evaluate(() => {
    const btn = document.getElementById('scenario-trio-btn');
    if (btn) btn.click();
  });

  // Wait for both avatars to load and scenario to start
  await page.waitForFunction(() => {
    const sc = window.scenarioController;
    const avatars = sc?.avatarManager?.scenarioAvatars;
    return avatars && avatars.has('girl_01') && avatars.has('girl_02') && avatars.get('girl_01')?.vrm && avatars.get('girl_02')?.vrm;
  }, { timeout: 25000 });
  await page.waitForTimeout(2000);

  // Helper to get avatars lookAt state
  const getAvatarsState = async () => {
    return await page.evaluate(() => {
      const win = window;
      const avatarMgr = win.avatarManager || win.__viewer?.avatarManager;
      const sc = win.scenarioController;
      const engine = sc?.scenarioEngine;
      const curScene = engine?.currentScene;
      
      const avatarsMap = avatarMgr?.scenarioAvatars || sc?.avatarManager?.scenarioAvatars;
      const result = {
        sceneId: curScene?.id,
        speaker: curScene?.speaker,
        speakerCharacterId: curScene?.speakerCharacterId,
        dialogueTarget: curScene?.dialogueTarget,
        voiceUrl: curScene?.voiceUrl,
        activePreset: win.scenePresetManager?.getActivePresetId?.() || win.__viewer?.scenePresetManager?.getActivePresetId?.() || win.config?.activeScene?.presetId || curScene?.scenePreset,
        isAudioPlaying: Boolean(sc?.soundManager?.isPlayingVoice?.() || sc?.soundManager?.currentVoiceAudio),
        focusLinesVisible: document.querySelector('.focus-lines-overlay')?.style.opacity === '1',
        cameraPreset: sc?.dialogueCameraController?.currentPreset,
        cameraPosition: win.__viewer?.camera?.position ? [
          +win.__viewer.camera.position.x.toFixed(2),
          +win.__viewer.camera.position.y.toFixed(2),
          +win.__viewer.camera.position.z.toFixed(2)
        ] : null,
        cameraTarget: win.__viewer?.controls?.target ? [
          +win.__viewer.controls.target.x.toFixed(2),
          +win.__viewer.controls.target.y.toFixed(2),
          +win.__viewer.controls.target.z.toFixed(2)
        ] : null,
        avatars: {}
      };

      if (avatarsMap) {
        for (const [id, av] of avatarsMap.entries()) {
          const eyeCfg = av.getEyeLookAtConfig();
          const headCfg = av.getHeadLookAtConfig();
          const vrm = av.vrm;
          let neckDeg = 0;
          let headDeg = 0;
          let pos = null;
          if (vrm?.scene) {
            pos = [
              vrm.scene.position.x.toFixed(2),
              vrm.scene.position.y.toFixed(2),
              vrm.scene.position.z.toFixed(2),
            ];
          }
          if (vrm?.humanoid) {
            const neck = vrm.humanoid.getNormalizedBoneNode('neck');
            const head = vrm.humanoid.getNormalizedBoneNode('head');
            if (neck) {
              const q = neck.quaternion;
              neckDeg = 2 * Math.acos(Math.min(1, Math.max(-1, q.w))) * 180 / Math.PI;
            }
            if (head) {
              const q = head.quaternion;
              headDeg = 2 * Math.acos(Math.min(1, Math.max(-1, q.w))) * 180 / Math.PI;
            }
          }

          result.avatars[id] = {
            position: pos,
            eyeMode: eyeCfg.mode,
            hasDynamicEyeTarget: Boolean(eyeCfg.targetGetter),
            headEnabled: headCfg.enabled,
            hasDynamicHeadTarget: Boolean(headCfg.targetGetter),
            neckAngleDeg: neckDeg.toFixed(1),
            headAngleDeg: headDeg.toFixed(1),
            expression: av.currentExpression,
            effectKey: av.currentEffectKey,
          };
        }
      }
      return result;
    });
  };

  // Scene 1: Aoi -> Player (Emily looks at Aoi)
  const state1 = await getAvatarsState();
  console.log('--- Scene 1 State (Aoi -> Player) ---');
  console.log(JSON.stringify(state1, null, 2));
  expect(state1.sceneId).toBe('trio_intro_1');
  expect(state1.activePreset).toBe('day_school');
  expect(state1.dialogueTarget).toBe('player');
  expect(state1.avatars.girl_01.eyeMode).toBe('camera');
  expect(state1.avatars.girl_02.hasDynamicEyeTarget).toBe(true);
  await page.screenshot({ path: 'scratch/trio_scene_1.png' });

  // Advance to Scene 2: Emily -> Aoi (partner) - Emiri angry face & dynamic focus lines!
  console.log('Advancing to Scene 2 (Emily -> Aoi)...');
  await page.evaluate(() => {
    window.scenarioController?.scenarioEngine?.next();
  });
  await page.waitForTimeout(2000);
  const state2 = await getAvatarsState();
  console.log('--- Scene 2 State (Emily -> Aoi) ---');
  console.log(JSON.stringify(state2, null, 2));
  expect(state2.sceneId).toBe('trio_intro_2');
  expect(state2.dialogueTarget).toBe('partner');
  expect(state2.avatars.girl_02.expression).toBe('angry');
  expect(state2.focusLinesVisible).toBe(true);
  await page.screenshot({ path: 'scratch/trio_scene_2.png' });

  // Advance to Scene 3: Aoi -> Emily (partner) - Aoi cold sweat (asease)
  console.log('Advancing to Scene 3 (Aoi -> Emily)...');
  await page.evaluate(() => {
    window.scenarioController?.scenarioEngine?.next();
  });
  await page.waitForTimeout(2000);
  const state3 = await getAvatarsState();
  console.log('--- Scene 3 State (Aoi -> Emily) ---');
  console.log(JSON.stringify(state3, null, 2));
  expect(state3.sceneId).toBe('trio_intro_3');
  expect(state3.dialogueTarget).toBe('partner');
  expect(state3.avatars.girl_01.effectKey).toContain('asease');
  expect(state3.focusLinesVisible).toBe(false);
  await page.screenshot({ path: 'scratch/trio_scene_3.png' });

  // Advance to Scene 4: Emily -> Player
  console.log('Advancing to Scene 4 (Emily -> Player)...');
  await page.evaluate(() => {
    window.scenarioController?.scenarioEngine?.next();
  });
  await page.waitForTimeout(2000);
  const state4 = await getAvatarsState();
  console.log('--- Scene 4 State (Emily -> Player) ---');
  console.log(JSON.stringify(state4, null, 2));
  expect(state4.sceneId).toBe('trio_intro_4');
  expect(state4.dialogueTarget).toBe('player');
  expect(state4.avatars.girl_02.eyeMode).toBe('camera');
  await page.screenshot({ path: 'scratch/trio_scene_4.png' });

  // Advance to Scene 5: Choice scene (both look at Player)
  console.log('Advancing to Scene 5 (Choice)...');
  await page.evaluate(() => {
    window.scenarioController?.scenarioEngine?.next();
  });
  await page.waitForTimeout(2000);
  const state5 = await getAvatarsState();
  console.log('--- Scene 5 State (Choice) ---');
  console.log(JSON.stringify(state5, null, 2));
  expect(state5.sceneId).toBe('trio_choice');
  expect(state5.avatars.girl_01.eyeMode).toBe('camera');
  expect(state5.avatars.girl_02.eyeMode).toBe('camera');
  await page.screenshot({ path: 'scratch/trio_scene_choice.png' });

  // Click the first choice (Cafe route)
  console.log('Selecting Choice 1 (Cafe Route)...');
  await page.evaluate(() => {
    const sc = window.scenarioController;
    const choices = sc?.scenarioEngine?.currentScene?.choices;
    if (sc?.scenarioEngine && choices && choices.length > 0) {
      sc.scenarioEngine.selectChoice(choices[0]);
    } else {
      const choiceBtn = document.querySelector('.adv-choice-btn');
      if (choiceBtn) choiceBtn.click();
    }
  });
  await page.waitForTimeout(2000);
  const state6 = await getAvatarsState();
  console.log('--- Scene 6 State (Route Cafe 1: Emiri Spiral Rise) ---');
  console.log(JSON.stringify(state6, null, 2));
  expect(state6.sceneId).toBe('route_cafe_1');
  expect(state6.cameraPreset).toBe('spiralRise');
  await page.screenshot({ path: 'scratch/trio_scene_cafe_1_emiri_zoom.png' });

  // Advance to Route Cafe 2: Aoi speaks, camera pulls back to wide
  console.log('Advancing to Route Cafe 2 (Aoi speaks, camera pulls back)...');
  await page.evaluate(() => {
    window.scenarioController?.scenarioEngine?.next();
  });
  await page.waitForTimeout(2000);
  const state7 = await getAvatarsState();
  console.log('--- Scene 7 State (Route Cafe 2: Camera Pull Back) ---');
  console.log(JSON.stringify(state7, null, 2));
  expect(state7.sceneId).toBe('route_cafe_2');
  await page.screenshot({ path: 'scratch/trio_scene_cafe_2_pull_back.png' });

  console.log('All scenes tested and screenshots captured successfully!');
});
