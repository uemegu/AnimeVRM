import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

const ARTIFACT_DIR = '/Users/ueda/.gemini/antigravity/brain/f2f8888a-3304-4632-9db0-496c35809e2d';

async function run() {
  console.log('Starting vite preview on port 5196...');
  const appDir = path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5196,
      host: '127.0.0.1',
    },
  });

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

  page.on('console', (msg) => console.log(`[Browser ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[Browser PageError] ${err.message}`));

  try {
    console.log('Navigating to http://127.0.0.1:5196/ ...');
    await page.goto('http://127.0.0.1:5196/');

    // 1. ロード画面: STARTボタンをクリック
    await page.waitForSelector('.loading-start-btn', { timeout: 10000 });
    console.log('Clicking START button...');
    await page.click('.loading-start-btn');

    // 2. タイトル画面待機
    console.log('Waiting for title screen...');
    await page.waitForSelector('.title-screen-container', { timeout: 60000 });
    console.log('Title screen loaded! Clicking "はじめから"...');
    await page.waitForSelector('[data-testid="btn-start"]', { timeout: 5000 });
    await page.click('[data-testid="btn-start"]');

    // 3. 幕間および朝イベント会話待機
    console.log('Waiting for dialogue message container (morning)...');
    await page.waitForSelector('.adv-message-container, .dialogue-window', { timeout: 30000 });

    // 朝イベントの会話を進めて場所選択画面へ
    console.log('Advancing morning dialogue...');
    while (await page.$('.adv-message-container, .dialogue-window')) {
      await page.click('.adv-message-container, .dialogue-window');
      await page.waitForTimeout(250);
      if (await page.$('.action-select-overlay')) break;
    }

    await page.waitForSelector('.action-select-overlay', { timeout: 10000 });
    console.log('Action select overlay visible!');

    // --- ロケーション1: 中庭 (courtyard) ---
    console.log('Selecting Courtyard (中庭)...');
    const cards1 = await page.$$('.location-item-card');
    let clickedCourtyard = false;
    for (const card of cards1) {
      const text = await card.innerText();
      if (text.includes('中庭')) {
        await card.click();
        clickedCourtyard = true;
        break;
      }
    }
    if (!clickedCourtyard) {
      throw new Error('Courtyard card not found in sidebar');
    }

    // 確認ダイアログではいをクリック
    await page.waitForSelector('.confirm-modal-btn.confirm', { timeout: 5000 });
    await page.click('.confirm-modal-btn.confirm');
    console.log('Confirmed move to Courtyard.');

    // 幕間演出待機 & 中庭シーン描画待機
    await page.waitForTimeout(4500);
    const courtyardShot = `${ARTIFACT_DIR}/stage_courtyard.png`;
    await page.screenshot({ path: courtyardShot });
    console.log(`Saved courtyard screenshot: ${courtyardShot}`);

    // 中庭の会話を進めて昼の場所選択へ
    console.log('Advancing courtyard dialogue...');
    while (await page.$('.adv-message-container, .dialogue-window, .adv-choice-btn')) {
      const choice = await page.$('.adv-choice-btn');
      if (choice) {
        await choice.click();
        await page.waitForTimeout(500);
      } else {
        await page.click('.adv-message-container, .dialogue-window');
        await page.waitForTimeout(250);
      }
      if (await page.$('.action-select-overlay')) break;
    }

    await page.waitForSelector('.action-select-overlay', { timeout: 10000 });
    console.log('Reached Lunch action select overlay!');

    // --- ロケーション2: 図書室 (library) ---
    console.log('Selecting Library (図書室)...');
    const cards2 = await page.$$('.location-item-card');
    let clickedLibrary = false;
    for (const card of cards2) {
      const text = await card.innerText();
      if (text.includes('図書室')) {
        await card.click();
        clickedLibrary = true;
        break;
      }
    }
    if (!clickedLibrary) {
      throw new Error('Library card not found in sidebar');
    }

    await page.waitForSelector('.confirm-modal-btn.confirm', { timeout: 5000 });
    await page.click('.confirm-modal-btn.confirm');
    console.log('Confirmed move to Library.');

    await page.waitForTimeout(4500);
    const libraryShot = `${ARTIFACT_DIR}/stage_library.png`;
    await page.screenshot({ path: libraryShot });
    console.log(`Saved library screenshot: ${libraryShot}`);

    // 図書室の会話を進めて放課後の場所選択へ
    console.log('Advancing library dialogue...');
    while (await page.$('.adv-message-container, .dialogue-window, .adv-choice-btn')) {
      const choice = await page.$('.adv-choice-btn');
      if (choice) {
        await choice.click();
        await page.waitForTimeout(500);
      } else {
        await page.click('.adv-message-container, .dialogue-window');
        await page.waitForTimeout(250);
      }
      if (await page.$('.action-select-overlay')) break;
    }

    await page.waitForSelector('.action-select-overlay', { timeout: 10000 });
    console.log('Reached Afterschool action select overlay!');

    // --- ロケーション3: 購買・カフェ (cafeteria) ---
    console.log('Selecting Cafeteria (購買・学食)...');
    const cards3 = await page.$$('.location-item-card');
    let clickedCafeteria = false;
    for (const card of cards3) {
      const text = await card.innerText();
      if (text.includes('購買') || text.includes('学食')) {
        await card.click();
        clickedCafeteria = true;
        break;
      }
    }
    if (!clickedCafeteria) {
      throw new Error('Cafeteria card not found in sidebar');
    }

    await page.waitForSelector('.confirm-modal-btn.confirm', { timeout: 5000 });
    await page.click('.confirm-modal-btn.confirm');
    console.log('Confirmed move to Cafeteria.');

    await page.waitForTimeout(4000);
    const cafeteriaShot = `${ARTIFACT_DIR}/stage_cafeteria.png`;
    await page.screenshot({ path: cafeteriaShot });
    console.log(`Saved cafeteria screenshot: ${cafeteriaShot}`);

    console.log('=== All 3 background stages verified and captured! ===');
  } catch (err) {
    console.error('Verification script failed:', err);
  } finally {
    await browser.close();
    await previewServer.close();
  }
}

run();
