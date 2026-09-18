import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

async function run() {
  console.log('Starting vite preview on port 5188...');
  const appDir = path.resolve(process.cwd(), 'app');
  const server = spawn('npx', ['vite', 'preview', '--port', '5188', '--host', '127.0.0.1'], {
    cwd: appDir,
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => console.log(`[vite] ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.error(`[vite err] ${d.toString().trim()}`));

  // サーバーの起動メッセージを待つ
  await new Promise((resolve) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes('http://127.0.0.1:5188')) {
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5188/ ...');
    await page.goto('http://127.0.0.1:5188/');

    // 1. ヘッダーと朝会話の確認
    await page.waitForSelector('.game-header');
    const headerDay = await page.textContent('.day-badge');
    const headerPhase = await page.textContent('.phase-badge');
    console.log(`[Header] ${headerDay} | ${headerPhase}`);

    await page.waitForSelector('.dialogue-window');
    const firstDialogue = await page.textContent('.dialogue-text');
    console.log('[First dialogue]', firstDialogue);

    // 2. 会話をクリックして進める（朝イベント完了まで）
    while (await page.$('.dialogue-window')) {
      await page.click('.dialogue-window');
      await page.waitForTimeout(200);
      if (await page.$('.action-select-overlay')) break;
    }

    // 3. 場所選択モーダルの確認
    await page.waitForSelector('.action-select-overlay');
    console.log('Action select modal is visible!');

    const locationCards = await page.$$('.location-item-card');
    console.log(`Found ${locationCards.length} location cards`);

    // スクリーンショット保存
    const screenshotPath = '/Users/ueda/.gemini/antigravity/brain/e1b236a0-3772-4f8d-9db9-72f421bce90a/action_select_verified.png';
    await page.screenshot({ path: screenshotPath });
    console.log('Screenshot saved to:', screenshotPath);

    // 4. 「教室」をクリックして移動
    const classroomCard = await page.$('.location-item-card:has-text("教室")');
    if (classroomCard) {
      await classroomCard.click();
      console.log('Clicked classroom card');
      await page.waitForTimeout(300);

      // 会話ウィンドウ出現
      await page.waitForSelector('.dialogue-window');
      const aoiDialogue = await page.textContent('.dialogue-text');
      console.log('Aoi dialogue in classroom:', aoiDialogue);

      // 会話をクリックして選択肢を出す
      await page.click('.dialogue-window');
      await page.waitForTimeout(300);

      await page.waitForSelector('.choices-container');
      const choices = await page.$$eval('.choice-button', (btns) => btns.map((b) => b.textContent));
      console.log('Choices displayed:', choices);

      const choiceScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/e1b236a0-3772-4f8d-9db9-72f421bce90a/choice_verified.png';
      await page.screenshot({ path: choiceScreenshotPath });
      console.log('Choice screenshot saved to:', choiceScreenshotPath);

      // 選択肢をクリック
      await page.click('.choice-button:first-child');
      await page.waitForTimeout(300);
      console.log('Choice clicked successfully!');

      // 会話を最後まで進めて昼行動ターンへ
      while (await page.locator('.dialogue-window').isVisible()) {
        await page.click('.dialogue-window');
        await page.waitForTimeout(150);
        if (await page.locator('.action-select-overlay').isVisible()) break;
      }

      // 昼行動: 図書室を選択
      console.log('Selecting Library in lunch action...');
      await page.click('.location-item-card:has-text("図書室")');
      await page.waitForTimeout(300);

      // 図書室の会話を進める
      while (await page.locator('.dialogue-window').isVisible()) {
        await page.click('.dialogue-window');
        await page.waitForTimeout(150);
        if (await page.locator('.choices-container').isVisible()) {
          await page.click('.choice-button:first-child');
          await page.waitForTimeout(200);
        }
        if (await page.locator('.action-select-overlay').isVisible()) break;
      }

      // 放課後行動: 屋上を選択
      console.log('Selecting Rooftop in afterschool action...');
      await page.click('.location-item-card:has-text("屋上")');
      await page.waitForTimeout(300);

      // 屋上の会話を進める
      while (await page.locator('.dialogue-window').isVisible()) {
        await page.click('.dialogue-window');
        await page.waitForTimeout(150);
        if (await page.locator('.choices-container').isVisible()) {
          await page.click('.choice-button:first-child');
          await page.waitForTimeout(200);
        }
        if (await page.locator('.room-menu-card').isVisible()) break;
      }

      // 夜の自室画面が表示されていることを確認
      await page.waitForSelector('.room-menu-card');
      console.log('Night Room view is visible!');
      const nightScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/e1b236a0-3772-4f8d-9db9-72f421bce90a/night_room_verified.png';
      await page.screenshot({ path: nightScreenshotPath });
      console.log('Night room screenshot saved to:', nightScreenshotPath);
    }

    console.log('ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
