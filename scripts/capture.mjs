import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--enable-webgl',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  console.log('Waiting for VRM model to load...');
  await page.waitForTimeout(6000);

  // Close the right panel to focus on the 3D scene
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.panel-close') || document.getElementById('settings-close-btn');
    if (closeBtn) closeBtn.click();

    // Adjust camera directly to face close-up
    const vc = window.__viewerCore;
    if (vc) {
      vc.controls.target.set(0, 1.35, 0);
      vc.camera.position.set(0, 1.35, 0.75);
      vc.controls.update();
    }
  });

  await page.waitForTimeout(1000);

  // 1. Default / Frontal light
  const frontCap = '/Users/ueda/.gemini/antigravity/brain/c1e6a581-69d8-4f52-a036-df8ffa6ac9f8/face_lighting_front.png';
  await page.screenshot({ path: frontCap });
  console.log('Saved:', frontCap);

  // 2. Light from 45 deg angle (the angle that previously caused ugly cheek / nose shadows)
  await page.evaluate(() => {
    const vc = window.__viewerCore;
    if (vc && vc.directionalLight) {
      vc.directionalLight.position.set(2.0, 1.5, 1.5).normalize();
    }
  });
  await page.waitForTimeout(1000);
  const angle45Cap = '/Users/ueda/.gemini/antigravity/brain/c1e6a581-69d8-4f52-a036-df8ffa6ac9f8/face_lighting_45deg.png';
  await page.screenshot({ path: angle45Cap });
  console.log('Saved:', angle45Cap);

  // 3. Side light (lateral angle where contour shadow should appear cleanly)
  await page.evaluate(() => {
    const vc = window.__viewerCore;
    if (vc && vc.directionalLight) {
      vc.directionalLight.position.set(3.0, 0.5, 0.5).normalize();
    }
  });
  await page.waitForTimeout(1000);
  const sideCap = '/Users/ueda/.gemini/antigravity/brain/c1e6a581-69d8-4f52-a036-df8ffa6ac9f8/face_lighting_side.png';
  await page.screenshot({ path: sideCap });
  console.log('Saved:', sideCap);

  // 4. Rotate camera to 3/4 side profile view to inspect jawline & cheek contour
  await page.evaluate(() => {
    const vc = window.__viewerCore;
    if (vc) {
      // Rotate camera around face to roughly 40 degrees side angle
      vc.camera.position.set(0.48, 1.35, 0.60);
      vc.controls.update();
    }
  });
  await page.waitForTimeout(1000);
  const profileCap = '/Users/ueda/.gemini/antigravity/brain/c1e6a581-69d8-4f52-a036-df8ffa6ac9f8/face_side_profile.png';
  await page.screenshot({ path: profileCap });
  console.log('Saved:', profileCap);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
