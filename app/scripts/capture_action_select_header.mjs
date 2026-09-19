import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/4dd46d6e-d000-4187-8fed-3a9c75e3b49b';
  console.log('Starting vite preview on port 5193...');
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5193,
      host: '127.0.0.1',
    },
  });

  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5193/ ...');
    await page.goto('http://127.0.0.1:5193/');

    await page.waitForSelector('.title-screen-container');
    console.log('Clicking "はじめから"...');
    await page.click('[data-testid="btn-start"]');

    // 朝会話をスキップして午前行動選択へ
    await page.waitForSelector('.adv-message-container', { timeout: 6000 });
    while (await page.$('.adv-message-container')) {
      const choiceBtn = await page.$('.choice-card');
      if (choiceBtn) {
        await choiceBtn.click();
        await page.waitForTimeout(200);
        continue;
      }
      await page.click('.adv-message-container');
      await page.waitForTimeout(80);
      if (await page.$('.action-select-overlay')) break;
    }

    console.log('Waiting for action select overlay...');
    await page.waitForSelector('.action-select-overlay', { timeout: 8000 });
    await page.waitForTimeout(500);

    // 移動場所選択画面（ヘッダーに場所ラベルがなく、日付・時間帯のみであることを確認）
    await page.screenshot({ path: `${artifactDir}/action_select_header_verified.png` });
    console.log('Saved action_select_header_verified.png');
  } catch (err) {
    console.error('Error during capture:', err);
    throw err;
  } finally {
    await browser.close();
    previewServer.httpServer.close();
    console.log('Done.');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
