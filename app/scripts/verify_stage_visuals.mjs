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

  // サーバー起動待機
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('Launching browser with WebGL enabled...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`[Browser Error] ${msg.text()}`);
    } else {
      console.log(`[Browser Log] ${msg.text()}`);
    }
  });

  try {
    console.log('Navigating to http://127.0.0.1:5189/ ...');
    await page.goto('http://127.0.0.1:5189/');

    // 1. ヘッダーとCanvasの確認
    await page.waitForSelector('.game-header');
    await page.waitForSelector('canvas');
    console.log('Canvas element is present in DOM!');

    // アセット読み込みと初回描画待機
    await page.waitForTimeout(3000);

    // 朝の登校画面スクリーンショット
    const morningScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/fd37ce74-3f84-4849-ae4b-6d351fd16d77/stage_morning_aoi.png';
    await page.screenshot({ path: morningScreenshotPath });
    console.log(`Saved morning stage screenshot to: ${morningScreenshotPath}`);

    // 2. 会話を1回進めてアオイの笑顔を確認
    await page.click('.dialogue-window');
    await page.waitForTimeout(1000);
    const smileScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/fd37ce74-3f84-4849-ae4b-6d351fd16d77/stage_morning_smile.png';
    await page.screenshot({ path: smileScreenshotPath });
    console.log(`Saved smile stage screenshot to: ${smileScreenshotPath}`);

    // 3. 会話をクリックして進め、午前場所選択へ
    while (await page.$('.dialogue-window')) {
      await page.click('.dialogue-window');
      await page.waitForTimeout(250);
      if (await page.$('.action-select-overlay')) break;
    }

    await page.waitForSelector('.action-select-overlay');
    console.log('Action select overlay opened.');

    // 教室を選択
    const cards = await page.$$('.location-item-card');
    if (cards.length > 0) {
      await cards[0].click();
      console.log('Clicked first location (Classroom)');
    }

    await page.waitForTimeout(2000);
    const classroomScreenshotPath = '/Users/ueda/.gemini/antigravity/brain/fd37ce74-3f84-4849-ae4b-6d351fd16d77/stage_day_classroom.png';
    await page.screenshot({ path: classroomScreenshotPath });
    console.log(`Saved classroom stage screenshot to: ${classroomScreenshotPath}`);

    console.log('=== Stage Visual Verification Completed Successfully! ===');
    console.log(`Errors count: ${consoleErrors.length}`);
  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await browser.close();
    server.kill();
  }
}

run();
