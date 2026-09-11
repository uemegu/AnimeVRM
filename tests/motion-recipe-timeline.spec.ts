import { test, expect } from '@playwright/test';
import { MotionRecipeService } from '../src/ai/motion/MotionRecipeService';

test('MotionRecipeService bakes dynamic timeline and trimming motion correctly in browser', async ({ page }) => {
  await page.goto('./');
  await page.waitForSelector('#app');

  const result = await page.evaluate(async () => {
    // Access MotionRecipeService
    const { MotionRecipeService } = await import('/AnimeVRM/src/ai/motion/MotionRecipeService.ts');
    const service = new MotionRecipeService();
    await service.initialize();

    const recipe = {
      duration: 4.0,
      layers: [
        {
          source: 'Standing Greeting',
          mask: '右腕',
          weight: 0.85,
          start: 0.5,
          duration: 2.5,
          speed: 1.2,
          from: 10,
          to: 70,
          fade: 0.3,
        },
        {
          source: '@small-bow',
          mask: '体幹',
          weight: 0.6,
          start: 0.0,
          duration: 1.5,
          fade: 0.2,
        },
        {
          source: '@tilt-right',
          mask: '頭',
          weight: 0.5,
          start: 1.0,
          duration: 2.5,
          poseMode: 'hold' as const,
          fade: 0.3,
        },
      ],
    };

    const baked = await service.bakeMotionToFBXUrl(recipe);
    return {
      duration: baked.duration,
      layerSummary: baked.layerSummary,
      hasBlobUrl: Boolean(baked.blobUrl && baked.blobUrl.startsWith('blob:')),
    };
  });

  expect(result.hasBlobUrl).toBe(true);
  expect(result.duration).toBe(4.0);
  expect(result.layerSummary.length).toBe(3);
  expect(result.layerSummary[0]).toContain('0.5~3.0s');
  expect(result.layerSummary[0]).toContain('1.2x');
  expect(result.layerSummary[2]).toContain('hold');
  console.log('Browser baked timeline summary:', result.layerSummary);
});
