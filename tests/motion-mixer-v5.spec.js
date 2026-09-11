import { test, expect } from '@playwright/test';
test('shoulder directions, masks, reach coupling and saved/exported pose', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/AnimeVRM/motion.html');
  await expect(page.locator('#export')).toBeEnabled({ timeout: 60000 });
  const result = await page.evaluate(async () => {
    const T = await import('/AnimeVRM/node_modules/three/build/three.module.js');
    const { newLayer, validateRecipe } = await import('/AnimeVRM/src/motion/engine.ts');
    const { FBXLoader } = await import('/AnimeVRM/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const { exportFBX } = await import('/AnimeVRM/src/motion/fbx.ts');
    const e = window.motionMixer.engine;
    const recipe = layers => ({version:1,duration:3,fps:30,layers});
    const layer = source => ({...newLayer(source,e,3),fade:0,balance:false});
    const sample = layers => e.sample(recipe(layers),1.5);
    const pos = bone => e.rest.get(bone).node.getWorldPosition(new T.Vector3());
    const rows = [];
    for (const side of ['Right','Left']) {
      sample([]); const base = pos(side+'Arm'), opposite = e.rest.get((side==='Right'?'Left':'Right')+'Shoulder').node.quaternion.clone();
      const direction = {};
      for(const id of ['up','down','forward','back']) {
        sample([layer('@'+side.toLowerCase()+'-shoulder-'+id)]);
        direction[id] = pos(side+'Arm').sub(base).toArray();
      }
      const isolated = opposite.angleTo(e.rest.get((side==='Right'?'Left':'Right')+'Shoulder').node.quaternion);
      const reach = {...layer('@'+side.toLowerCase()+'-hip'), mask:side==='Right'?'右腕':'左腕'};
      sample([{...reach,shoulderFollow:0}]); const hand = pos(side+'Hand'), arm = pos(side+'Arm');
      sample([reach]); rows.push({direction,isolated,lift:pos(side+'Arm').y-arm.y,handError:pos(side+'Hand').distanceTo(hand)});
    }
    const r = recipe([layer('@both-shoulder-up')]); sample(r.layers);
    const original = e.rest.get('RightShoulder').node.quaternion.clone();
    const saved = e.bakeSaved(r,'肩'); e.registerSaved(saved); sample([layer(saved.id)]);
    const savedError = original.angleTo(e.rest.get('RightShoulder').node.quaternion);
    const fbx = new FBXLoader().parse(exportFBX(e,r),'');
    const mixer = new T.AnimationMixer(fbx); mixer.clipAction(fbx.animations[0]).play(); mixer.setTime(1.5);
    let exportError = 99; fbx.traverse(n=>{if(n.name.endsWith('RightShoulder')) exportError=original.angleTo(n.quaternion);});
    let rejects = false; try {validateRecipe(recipe([{...layer('@right-hip'),shoulderFollow:2}]))} catch {rejects=true;}
    return {rows,savedError,exportError,rejects};
  });
  for(const row of result.rows) {
    expect(row.direction.up[1]).toBeGreaterThan(.015); expect(row.direction.down[1]).toBeLessThan(-.01);
    expect(row.direction.forward[2]).toBeGreaterThan(.015); expect(row.direction.back[2]).toBeLessThan(-.015);
    expect(row.isolated).toBeLessThan(.001); expect(row.lift).toBeGreaterThan(.01); expect(row.handError).toBeLessThan(.001);
  }
  expect(result.savedError).toBeLessThan(.001); expect(result.exportError).toBeLessThan(.001); expect(result.rejects).toBe(true);
  await page.locator('[data-source="@right-hip"]').click();
  const slider = page.locator('.layer').last().getByLabel('腕に連動する肩');
  await slider.fill('0.4'); await page.reload(); await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('.layer').last().getByLabel('腕に連動する肩')).toHaveValue('0.4');
  await expect(page.locator('.motion-category[data-group="両肩"] .motion-card')).toHaveCount(5);
  await page.locator('[data-source="@both-shoulder-up"]').click();
  await expect(page.locator('#model-state')).toHaveText('VRMプレビュー', { timeout: 60000 });
  await page.locator('#seek').fill('1.5');
  await page.screenshot({path:'/tmp/motion-v5-shoulders.png'});
});
