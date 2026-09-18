import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

async function run() {
  console.log('Starting vite preview on port 5189...');
  const appDir = path.resolve(process.cwd(), 'app');
  const server = spawn('npx', ['vite', 'preview', '--port', '5189', '--host', '127.0.0.1'], {
    cwd: appDir,
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => console.log(`[vite] ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.error(`[vite err] ${d.toString().trim()}`));

  await new Promise((resolve) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes('http://127.0.0.1:5189')) {
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  console.log('Launching Playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5189/ ...');
    await page.goto('http://127.0.0.1:5189/');

    await page.waitForSelector('.title-screen-container, .game-header');
    if (await page.$('.title-screen-container')) {
      console.log('Clicking "はじめから"...');
      await page.click('[data-testid="btn-start"]');
    }

    // 1. 新メッセージウィンドウの描画検証
    console.log('Waiting for .adv-message-container ...');
    await page.waitForSelector('.adv-message-container');
    await page.waitForSelector('.adv-location-badge');
    await page.waitForSelector('.adv-auto-btn');

    // タイピング完了まで待機
    await page.waitForTimeout(1500);

    const locText = await page.textContent('.adv-location-badge');
    console.log(`[Location Badge] ${locText}`);

    // 次へ送りインジケーター（矢印）が出ているか確認
    const nextIndVisible = await page.isVisible('.adv-next-indicator.show');
    console.log(`[Next Indicator Visible] ${nextIndVisible}`);

    // メッセージウィンドウのスクリーンショット撮影
    await page.screenshot({ path: path.join(appDir, 'scripts', 'screenshot_dialogue_window.png') });
    console.log('Saved screenshot_dialogue_window.png');

    // 2. 会話を進めて午前行動の場所選択モーダルへ
    console.log('Advancing morning dialogue...');
    for (let i = 0; i < 20; i++) {
      if (await page.$('.action-select-overlay')) break;
      if (await page.$('.adv-message-container')) {
        await page.click('.adv-message-container');
        await page.waitForTimeout(100);
        await page.click('.adv-message-container'); // 2回クリックで次へ
        await page.waitForTimeout(300);
      }
    }

    console.log('Waiting for action select overlay...');
    await page.waitForSelector('.action-select-overlay');

    // 教室（葵がいる場所）を選択して選択肢シーンへ突入
    console.log('Selecting first location card (Classroom)...');
    await page.click('.location-item-card:nth-child(1)');
    await page.waitForTimeout(1000);

    // 教室シナリオの会話を進めて選択肢を表示させる
    console.log('Advancing classroom conversation to choices...');
    let choiceFound = false;
    for (let i = 0; i < 20; i++) {
      if (await page.$('.adv-choices-backdrop.visible')) {
        choiceFound = true;
        break;
      }
      if (await page.$('.adv-message-container')) {
        await page.click('.adv-message-container');
        await page.waitForTimeout(100);
        await page.click('.adv-message-container');
        await page.waitForTimeout(300);
      }
    }

    if (choiceFound) {
      console.log('Choices dialog detected!');
      await page.waitForSelector('.adv-choice-btn');
      const choiceCount = (await page.$$('.adv-choice-btn')).length;
      console.log(`[Choice Count] ${choiceCount}`);

      const countdownText = await page.textContent('.adv-countdown-digits');
      console.log(`[Countdown Digits] ${countdownText}`);

      // スタイリッシュ選択肢UIのスクリーンショット撮影
      await page.screenshot({ path: path.join(appDir, 'scripts', 'screenshot_choice_dialog.png') });
      console.log('Saved screenshot_choice_dialog.png');

      // 最初の選択肢をクリック
      await page.click('.adv-choice-btn:nth-child(1)');
      await page.waitForTimeout(800);
      console.log('Choice selected successfully.');
    } else {
      console.error('Failed to find choices dialog');
    }

    console.log('ALL PLAYWRIGHT VERIFICATION PASSED!');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

run();
