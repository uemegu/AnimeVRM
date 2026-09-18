import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');

async function run() {
  const PORT = 5203;
  console.log(`Starting vite preview on port ${PORT}...`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: appDir,
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => console.log(`[vite] ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.error(`[vite err] ${d.toString().trim()}`));

  await new Promise((resolve) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes(String(PORT))) resolve();
    });
    setTimeout(resolve, 3000);
  });

  console.log('Launching Playwright Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    const url = `http://127.0.0.1:${PORT}/`;
    console.log(`Navigating to ${url} ...`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // 1. タイトル画面要素の検証
    console.log('Waiting for title screen container...');
    await page.waitForSelector('.title-screen-container', { timeout: 5000 });

    const titleLogo = await page.textContent('.title-logo-main');
    const titleSub = await page.textContent('.title-logo-sub');
    console.log(`[Title] ${titleLogo?.trim()} | [Subtitle] ${titleSub?.trim()}`);

    // ボタン存在確認
    const startBtn = await page.waitForSelector('[data-testid="btn-start"]');
    const continueBtn = await page.waitForSelector('[data-testid="btn-continue"]');
    const langBtn = await page.waitForSelector('[data-testid="btn-language"]');

    const isContinueDisabled = await continueBtn.isDisabled();
    console.log(`[Continue Button Disabled State (No save data)]: ${isContinueDisabled}`);
    if (!isContinueDisabled) {
      throw new Error('Continue button should be disabled when there is no save data');
    }

    // 3キャラのスリットカードの検証
    const slitCards = await page.$$('.title-slit-card');
    console.log(`[Slit Cards count]: ${slitCards.length}`);
    if (slitCards.length !== 3) {
      throw new Error(`Expected 3 slit cards, got ${slitCards.length}`);
    }

    // 画像の読み込み確認
    const slitImages = await page.$$('.title-slit-img');
    for (let i = 0; i < slitImages.length; i++) {
      const src = await slitImages[i].getAttribute('src');
      console.log(`[Card ${i + 1} Image Source]: ${src}`);
    }

    // スクリーンショット保存: タイトル画面
    const screenshotTitlePath = path.resolve(__dirname, 'title_screen.png');
    await page.screenshot({ path: screenshotTitlePath });
    console.log(`Saved screenshot to: ${screenshotTitlePath}`);

    // 2. 言語切り替えテスト
    console.log('Testing language switch...');
    await langBtn.click();
    const titleSubEn = await page.textContent('.title-logo-sub');
    const startBtnTextEn = await page.textContent('[data-testid="btn-start"]');
    console.log(`[After EN switch] Subtitle: ${titleSubEn}, Start: ${startBtnTextEn}`);

    await langBtn.click(); // 日本語に戻す
    const titleSubJa = await page.textContent('.title-logo-sub');
    console.log(`[Reverted to JA] Subtitle: ${titleSubJa}`);

    // 3. 「はじめから」クリックによるゲーム開始遷移テスト
    console.log('Clicking "New Game" (はじめから)...');
    await startBtn.click();

    // ゲーム画面の出現を確認
    await page.waitForSelector('.game-header', { timeout: 10000 });
    const headerDay = await page.textContent('.day-badge');
    const headerPhase = await page.textContent('.phase-badge');
    console.log(`[Game Started Successfully! Header]: ${headerDay} | ${headerPhase}`);

    await page.waitForSelector('.dialogue-window', { timeout: 10000 });
    const dialogueText = await page.textContent('.dialogue-text');
    console.log(`[Day 1 Morning Dialogue]: Text="${dialogueText}"`);

    // ゲーム開始後のスクリーンショット保存
    const screenshotGamePath = path.resolve(__dirname, 'game_started_day1.png');
    await page.screenshot({ path: screenshotGamePath });
    console.log(`Saved game screenshot to: ${screenshotGamePath}`);

    console.log('All title screen verifications PASSED successfully!');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

run();
