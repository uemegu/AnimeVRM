const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173/AnimeVRM/');
  await page.waitForTimeout(3000);

  // Start Trio Scenario
  console.log('Starting trio scenario...');
  await page.evaluate(() => {
    const btn = document.getElementById('scenario-trio-btn');
    if (btn) btn.click();
  });

  // Wait for avatars
  await page.waitForFunction(() => {
    const sc = window.scenarioController;
    const avatars = sc?.avatarManager?.scenarioAvatars;
    return avatars && avatars.has('girl_01') && avatars.has('girl_02') && avatars.get('girl_01')?.vrm && avatars.get('girl_02')?.vrm;
  }, { timeout: 25000 });
  await page.waitForTimeout(2000);

  // Jump to Choice scene (Scene 5)
  console.log('Fast-forwarding to trio_choice...');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      window.scenarioController?.scenarioEngine?.next();
    });
    await page.waitForTimeout(800);
  }

  // Verify at choice scene
  const choiceSceneId = await page.evaluate(() => window.scenarioController?.scenarioEngine?.currentScene?.id);
  console.log('Current scene before choice:', choiceSceneId);

  // Select Cafe choice
  console.log('Selecting Cafe choice to trigger route_cafe_1 spiral camera...');
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

  // Frame 1: t ~ 0.45s (Camera rising, spiral active, dream heart background at 100% opacity)
  await page.waitForTimeout(450);
  const dreamState1 = await page.evaluate(() => {
    const bg = window.scenarioController?.dreamBackground;
    return {
      isActive: bg?.isActive,
      opacity: bg?.opacity,
      meshVisible: bg?.mesh?.visible,
    };
  });
  console.log('Dream BG state at t=0.45s:', dreamState1);
  const shotPath1 = '/Users/ueda/.gemini/antigravity/brain/119f9e3c-6752-45af-97a3-02a633688c2a/dream_bg_t045.png';
  await page.screenshot({ path: shotPath1 });

  // Frame 2: t ~ 1.2s (Mid-spiral 360 rotation around Emiri, dream background active)
  await page.waitForTimeout(750);
  const dreamState2 = await page.evaluate(() => {
    const bg = window.scenarioController?.dreamBackground;
    return {
      isActive: bg?.isActive,
      opacity: bg?.opacity,
      meshVisible: bg?.mesh?.visible,
    };
  });
  console.log('Dream BG state at t=1.2s:', dreamState2);
  const shotPath2 = '/Users/ueda/.gemini/antigravity/brain/119f9e3c-6752-45af-97a3-02a633688c2a/dream_bg_t120.png';
  await page.screenshot({ path: shotPath2 });

  // Frame 3: t ~ 1.95s (Spiral finishing, cross-fading back to classroom background)
  await page.waitForTimeout(750);
  const dreamState3 = await page.evaluate(() => {
    const bg = window.scenarioController?.dreamBackground;
    return {
      isActive: bg?.isActive,
      opacity: bg?.opacity,
      meshVisible: bg?.mesh?.visible,
    };
  });
  console.log('Dream BG state at t=1.95s:', dreamState3);
  const shotPath3 = '/Users/ueda/.gemini/antigravity/brain/119f9e3c-6752-45af-97a3-02a633688c2a/dream_bg_t195.png';
  await page.screenshot({ path: shotPath3 });

  // Frame 4: t ~ 2.6s (Camera settled at Emiri zoom position, fully back to classroom background)
  await page.waitForTimeout(650);
  const dreamState4 = await page.evaluate(() => {
    const bg = window.scenarioController?.dreamBackground;
    return {
      isActive: bg?.isActive,
      opacity: bg?.opacity,
      meshVisible: bg?.mesh?.visible,
    };
  });
  console.log('Dream BG state at t=2.6s:', dreamState4);
  const shotPath4 = '/Users/ueda/.gemini/antigravity/brain/119f9e3c-6752-45af-97a3-02a633688c2a/dream_bg_t260.png';
  await page.screenshot({ path: shotPath4 });

  console.log('Screenshots saved successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
