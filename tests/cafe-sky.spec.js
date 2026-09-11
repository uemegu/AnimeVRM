import { test, expect } from '@playwright/test';

test('café alpha sky animates, follows framing, and leaves other backgrounds intact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/cafe-preview', route => route.fulfill({
    contentType: 'text/html',
    body: '<body style="margin:0"><div id="viewport-wrapper" style="width:1280px;height:720px"><div id="viewport-container"><canvas id="app"></canvas></div></div></body>',
  }));
  await page.goto('http://127.0.0.1:5173/AnimeVRM/cafe-preview');
  await page.evaluate(async () => {
    const { ViewerCore } = await import('/AnimeVRM/src/scene/ViewerCore.ts');
    const { DEFAULT_CONFIG, cloneConfig } = await import('/AnimeVRM/src/Config.ts');
    const { getLocationPreset } = await import('/AnimeVRM/src/presets/ScenePresets.ts');
    const cfg = cloneConfig(DEFAULT_CONFIG);
    Object.assign(cfg.environment, getLocationPreset('cafe').environment);
    cfg.postProcessing.bloom.enabled = false;
    const viewer = new ViewerCore(document.querySelector('canvas'), cfg);
    viewer.applyConfig(cfg);
    window.cafeTest = { viewer, cfg };
  });
  await page.waitForFunction(() => window.cafeTest.viewer.skyBackground.mesh.visible);
  const first = await page.evaluate(() => {
    const { viewer, cfg } = window.cafeTest;
    viewer.render(0, 0, cfg, []);
    return viewer.canvas.toDataURL();
  });
  await page.locator('#app').screenshot({ path: '/tmp/cafe-sky-preview.png' });
  const later = await page.evaluate(() => {
    const { viewer, cfg } = window.cafeTest;
    viewer.render(0, 20, cfg, []);
    return viewer.canvas.toDataURL();
  });
  expect(later).not.toBe(first);
  const state = await page.evaluate(async () => {
    const { viewer, cfg } = window.cafeTest;
    viewer.updateBackgroundZoom({ zoomScale: 2, panOffsetX: 0.1, panOffsetY: 0 });
    const repeat = viewer.skyBackground.material.uniforms.uRepeat.value.x;
    const offset = viewer.skyBackground.material.uniforms.uOffset.value.x;
    cfg.environment.showBackgroundImage = false;
    viewer.updateBackgroundDisplay(cfg);
    const hidden = !viewer.skyBackground.mesh.visible && viewer.scene.background.isColor;
    cfg.environment.showBackgroundImage = true;
    viewer.updateBackgroundDisplay(cfg);
    viewer.hideSkyBackground();
    await Promise.resolve();
    return { repeat, offset, hidden, transparentHidden: !viewer.skyBackground.mesh.visible };
  });
  expect(state).toEqual({ repeat: 0.5, offset: 0.15, hidden: true, transparentHidden: true });
  const panorama = await page.evaluate(async () => {
    const { viewer, cfg } = window.cafeTest;
    viewer.updateBackgroundDisplay(cfg);
    await Promise.resolve();
    viewer.panoramaController.activate(viewer.skyBackground.material.uniforms.uPainting.value.clone());
    const hidden = !viewer.skyBackground.mesh.visible;
    viewer.panoramaController.deactivate();
    await Promise.resolve();
    return { hidden, restored: viewer.skyBackground.mesh.visible };
  });
  expect(panorama).toEqual({ hidden: true, restored: true });
  // A custom background with no café filename must use the same animated sky.
  const custom = await page.evaluate(async () => {
    const { viewer, cfg } = window.cafeTest;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#607040';
    ctx.fillRect(0, 16, 32, 16);
    cfg.environment.backgroundImageUrl = canvas.toDataURL();
    cfg.environment.farFogEnabled = true;
    cfg.environment.farFogIntensity = 0.3;
    cfg.activeScene.location = 'modern_park';
    viewer.updateBackgroundDisplay(cfg);
    await new Promise(resolve => {
      const poll = () => viewer.skyBackground.mesh.visible ? resolve() : requestAnimationFrame(poll);
      poll();
    });
    viewer.updateBackgroundZoom(null);
    const uniforms = viewer.skyBackground.material.uniforms;
    const fogged = uniforms.uPainting.value.image.getContext('2d');
    const skyAlpha = fogged.getImageData(8, 8, 1, 1).data[3];
    const groundAlpha = fogged.getImageData(8, 24, 1, 1).data[3];
    uniforms.uTime.value = 0;
    viewer.renderer.render(viewer.scene, viewer.camera);
    const first = viewer.canvas.toDataURL();
    uniforms.uTime.value = 20;
    viewer.renderer.render(viewer.scene, viewer.camera);
    const animated = first !== viewer.canvas.toDataURL();
    return { skyAlpha, groundAlpha, animated, shadowStrength: uniforms.uInteriorShadowStrength.value };
  });
  expect(custom).toEqual({ skyAlpha: 0, groundAlpha: 255, animated: true, shadowStrength: 0 });
  expect(errors).toEqual([]);
});
