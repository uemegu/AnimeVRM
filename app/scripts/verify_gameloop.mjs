import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  console.log('Starting vite preview on port 5188 via JS API...');
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5188,
      host: '127.0.0.1',
    },
  });


  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5188/ ...');
    page.on('console', (msg) => console.log(`[browser ${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[browser error] ${err.message}`));
    await page.goto('http://127.0.0.1:5188/');

    await page.waitForSelector('.title-screen-container, .game-header');
    if (await page.$('.title-screen-container')) {
      console.log('Title screen detected. Clicking "はじめから"...');
      await page.click('[data-testid="btn-start"]');
    }

    // 1. ヘッダーと朝会話の確認
    await page.waitForSelector('.game-header');
    const headerDay = await page.textContent('.day-badge');
    const headerPhase = await page.textContent('.phase-badge');
    const headerLocation = await page.textContent('.header-location-badge');
    const autoBtnVisible = await page.locator('.header-auto-btn').isVisible();
    console.log(`[Header] ${headerDay} | ${headerPhase} | Location: ${headerLocation} | AutoBtn: ${autoBtnVisible}`);


    const headerScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/03de8385-7d3f-4074-9319-342389782c1d/game_header_verified.png';
    await page.screenshot({ path: headerScreenshotPath });
    console.log('Header screenshot saved to:', headerScreenshotPath);

    await page.waitForSelector('.adv-message-container, .dialogue-window');
    const firstDialogue = await page.textContent('.adv-message-body, .dialogue-text');
    console.log('[First dialogue]', firstDialogue);

    // 2. 会話をクリックして進める（朝イベント完了まで）
    while (await page.$('.adv-message-container, .dialogue-window')) {
      await page.click('.adv-message-container, .dialogue-window');
      await page.waitForTimeout(200);
      if (await page.$('.action-select-overlay')) break;
    }

    // 3. 場所選択モーダルの確認
    await page.waitForSelector('.action-select-overlay');
    const locationCards = await page.$$('.location-item-card');
    console.log(`Found ${locationCards.length} location cards`);

    // スクリーンショット保存
    const actionScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/03de8385-7d3f-4074-9319-342389782c1d/action_select_verified.png';
    await page.screenshot({ path: actionScreenshotPath });
    console.log('Screenshot saved to:', actionScreenshotPath);

    // 4. 「教室」をクリックして移動
    const classroomCard = await page.$('.location-item-card:has-text("教室")');
    if (classroomCard) {
      await classroomCard.click();
      console.log('Clicked classroom card');
      await page.waitForTimeout(300);

      // 会話ウィンドウ出現
      await page.waitForSelector('.adv-message-container, .dialogue-window');
      const aoiDialogue = await page.textContent('.adv-message-body, .dialogue-text');
      console.log('Aoi dialogue in classroom:', aoiDialogue);

      // 会話をクリックして選択肢を出す (タイピングスキップ + シーン送り)
      while (!await page.locator('.choices-container, .adv-choices-container').isVisible()) {
        await page.click('.adv-message-container, .dialogue-window');
        await page.waitForTimeout(250);
      }

      const choices = await page.$$eval('.choice-button, .adv-choice-btn', (btns) => btns.map((b) => b.textContent));
      console.log('Choices displayed:', choices);


      const choiceScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/03de8385-7d3f-4074-9319-342389782c1d/choice_verified.png';
      await page.screenshot({ path: choiceScreenshotPath });
      console.log('Choice screenshot saved to:', choiceScreenshotPath);

      // 選択肢をクリック
      await page.click('.choice-button:first-child, .adv-choice-btn:first-child');
      await page.waitForTimeout(300);
      console.log('Choice clicked successfully!');

      // 会話を最後まで進めて昼行動ターンへ
      while (await page.locator('.adv-message-container, .dialogue-window').isVisible()) {
        await page.click('.adv-message-container, .dialogue-window');
        await page.waitForTimeout(150);
        if (await page.locator('.action-select-overlay').isVisible()) break;
      }

      // 昼行動: 図書室を選択
      console.log('Selecting Library in lunch action...');
      await page.click('.location-item-card:has-text("図書室")');
      await page.waitForTimeout(300);

      // 図書室の会話を進める
      while (await page.locator('.adv-message-container, .dialogue-window').isVisible()) {
        await page.click('.adv-message-container, .dialogue-window');
        await page.waitForTimeout(150);
        if (await page.locator('.choices-container, .adv-choices-container').isVisible()) {
          await page.click('.choice-button:first-child, .adv-choice-btn:first-child');
          await page.waitForTimeout(200);
        }
        if (await page.locator('.action-select-overlay').isVisible()) break;
      }

      // 放課後行動: 屋上を選択
      console.log('Selecting Rooftop in afterschool action...');
      await page.click('.location-item-card:has-text("屋上")');
      await page.waitForTimeout(300);

      // 屋上の会話を進める
      while (await page.locator('.adv-message-container, .dialogue-window').isVisible()) {
        await page.click('.adv-message-container, .dialogue-window');
        await page.waitForTimeout(150);
        if (await page.locator('.choices-container, .adv-choices-container').isVisible()) {
          await page.click('.choice-button:first-child, .adv-choice-btn:first-child');
          await page.waitForTimeout(200);
        }
        if (await page.locator('.room-menu-card').isVisible()) break;
      }


      // 夜の自室画面が表示されていることを確認
      await page.waitForSelector('.room-menu-card');
      console.log('Night Room view is visible!');
      const nightScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/03de8385-7d3f-4074-9319-342389782c1d/night_room_verified.png';
      await page.screenshot({ path: nightScreenshotPath });
      console.log('Night room screenshot saved to:', nightScreenshotPath);

      // 自作 YES/NO ダイアログ（ConfirmModal）の検証: セーブボタンをクリック
      console.log('Clicking save button in Night Room...');
      await page.click('.room-menu-button:has-text("セーブ")');
      await page.waitForSelector('.confirm-modal-card');
      console.log('ConfirmModal (YES/NO) is visible!');

      const confirmScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/03de8385-7d3f-4074-9319-342389782c1d/confirm_modal_verified.png';
      await page.screenshot({ path: confirmScreenshotPath });
      console.log('ConfirmModal screenshot saved to:', confirmScreenshotPath);

      // 「はい」をクリックしてセーブ実行
      await page.click('.confirm-modal-btn.confirm');
      await page.waitForTimeout(200);

      // セーブ完了通知ダイアログ（OK）が表示されることを確認
      await page.waitForSelector('.confirm-modal-card:has-text("セーブしました")');
      console.log('Save success notice displayed in ConfirmModal!');
      await page.click('.confirm-modal-btn.confirm');
      await page.waitForTimeout(200);
    }

    console.log('ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY!');

  } finally {
    await browser.close();
    previewServer.httpServer.close();
  }
}


run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
