import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/2f94a9ea-3131-4b82-8f53-c6b08847f03a';
  console.log('Starting vite preview on port 5190...');
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5190,
      host: '127.0.0.1',
    },
  });

  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5190/ ...');
    await page.goto('http://127.0.0.1:5190/');

    await page.waitForSelector('.title-screen-container');
    console.log('Clicking "はじめから"...');
    await page.click('[data-testid="btn-start"]');

    // 朝会話をスキップ
    await page.waitForSelector('.adv-message-container');
    while (await page.$('.adv-message-container')) {
      await page.click('.adv-message-container');
      await page.waitForTimeout(80);
      if (await page.$('.action-select-overlay')) break;
    }

    // 午前 行動選択画面
    await page.waitForSelector('.action-select-overlay');
    console.log('Morning action select reached.');

    // 1. 教室（アオイ: 淡い黄色）ホバー
    console.log('Hovering Classroom (Aoi)...');
    await page.hover('.location-item-card:has-text("教室")');
    await page.waitForSelector('.action-focus-heroine-box');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${artifactDir}/heroine_focus_aoi.png` });
    console.log('Saved heroine_focus_aoi.png');

    // 2. 屋上（エミリ: 淡い赤）ホバー
    console.log('Hovering Rooftop (Emili)...');
    await page.hover('.location-item-card:has-text("屋上")');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${artifactDir}/heroine_focus_emili.png` });
    console.log('Saved heroine_focus_emili.png');

    // 3. 図書室（シオン: 淡い青）ホバー
    console.log('Hovering Library (Shion)...');
    await page.hover('.location-item-card:has-text("図書室")');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${artifactDir}/heroine_focus_shion.png` });
    console.log('Saved heroine_focus_shion.png');

    // 4. 中庭（？: 濃いグレー）ホバー
    console.log('Hovering Courtyard (Unknown ?)...');
    await page.hover('.location-item-card:has-text("中庭")');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${artifactDir}/heroine_focus_unknown.png` });
    console.log('Saved heroine_focus_unknown.png');

    // 教室を選択して昼へ進める
    await page.click('.location-item-card:has-text("教室")');
    await page.waitForSelector('.confirm-modal-card');
    await page.click('.confirm-modal-btn.confirm');
    await page.waitForTimeout(300);

    // 会話・選択肢をスキップ
    while (!await page.locator('.adv-choices-container').isVisible()) {
      if (await page.locator('.adv-message-container').isVisible()) {
        await page.click('.adv-message-container');
      }
      await page.waitForTimeout(80);
    }
    await page.click('.adv-choice-btn:first-child');
    await page.waitForTimeout(200);

    while (!await page.locator('.action-select-overlay').isVisible()) {
      if (await page.locator('.adv-message-container').isVisible()) {
        await page.click('.adv-message-container');
      }
      await page.waitForTimeout(80);
    }

    // 5. 昼 行動選択画面（黄色を抑えた新背景）
    console.log('Lunch action select reached (adjusted soft ivory background)...');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${artifactDir}/action_select_lunch_adjusted.png` });
    console.log('Saved action_select_lunch_adjusted.png');

    // 図書室を選択して夕方へ進める
    await page.click('.location-item-card:has-text("図書室")');
    await page.waitForSelector('.confirm-modal-card');
    await page.click('.confirm-modal-btn.confirm');
    await page.waitForTimeout(300);

    while (!await page.locator('.action-select-overlay').isVisible()) {
      if (await page.locator('.adv-choices-container').isVisible()) {
        await page.click('.adv-choice-btn:first-child');
        await page.waitForTimeout(150);
      } else if (await page.locator('.adv-message-container').isVisible()) {
        await page.click('.adv-message-container');
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(50);
    }

    // 屋上を選択して夜へ進める
    await page.click('.location-item-card:has-text("屋上")');
    await page.waitForSelector('.confirm-modal-card');
    await page.click('.confirm-modal-btn.confirm');
    await page.waitForTimeout(300);

    while (!await page.locator('.room-overlay').isVisible()) {
      if (await page.locator('.adv-choices-container').isVisible()) {
        await page.click('.adv-choice-btn:first-child');
        await page.waitForTimeout(150);
      } else if (await page.locator('.adv-message-container').isVisible()) {
        await page.click('.adv-message-container');
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(50);
    }

    // 6. 新しい夜の自室画面（myroom-night_far.avif）
    console.log('Night room view reached (with myroom-night_far.avif)...');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${artifactDir}/night_room_new_texture.png` });
    console.log('Saved night_room_new_texture.png');

    console.log('All verification screenshots captured successfully!');
  } finally {
    await browser.close();
    previewServer.httpServer.close();
  }
}

run().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
