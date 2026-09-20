import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/b9e90cf7-b7e1-4fc0-af48-03b02a9e6b62';
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5197,
      host: '127.0.0.1',
    },
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    await page.goto('http://127.0.0.1:5197/');

    const startLoadingBtn = await page.$('.loading-start-btn');
    if (startLoadingBtn) {
      await startLoadingBtn.click();
      await page.waitForSelector('.title-screen-container', { timeout: 15000 });
    }

    // セーブデータを注入
    await page.evaluate(() => {
      const nightSave = {
        version: 1,
        savedAt: new Date().toISOString(),
        gameState: {
          day: 1,
          phase: 'night',
          flags: { met_aoi: true },
          affinities: { aoi: 3, emili: 1, shion: 0 },
          currentScenarioId: null,
        },
        summary: {
          day: 1,
          phase: 'night',
          chapterTitle: 'Day 1 夜（自室）',
        },
      };
      localStorage.setItem('galgame_save_slot_1', JSON.stringify(nightSave));
    });

    await page.reload();
    const startLoadingBtn2 = await page.$('.loading-start-btn');
    if (startLoadingBtn2) {
      await startLoadingBtn2.click();
      await page.waitForSelector('.title-screen-container', { timeout: 15000 });
    }

    // 「つづきから」押下 -> ロードモーダルが開く
    await page.click('[data-testid="btn-continue"]');
    await page.waitForSelector('.save-load-modal-window');
    await page.waitForTimeout(400);

    // ロード画面を撮影
    await page.screenshot({ path: `${artifactDir}/save_load_modal_load.png` });
    console.log('Saved save_load_modal_load.png');

    // スロット1をクリックしてロード実行
    await page.click('[data-testid="slot-1"]');
    await page.waitForSelector('.confirm-modal-overlay');
    await page.click('.confirm-modal-btn.confirm');

    await page.waitForTimeout(600);
    const okBtn = await page.$('.confirm-modal-btn.confirm');
    if (okBtn) {
      await okBtn.click();
    }

    // 自室画面を待機
    await page.waitForSelector('.room-overlay', { timeout: 10000 });
    await page.waitForTimeout(500);

    // 自室の「ゲームをセーブする」カードをクリック
    const saveCard = await page.$('.room-menu-card:has-text("ゲームをセーブする")');
    if (saveCard) {
      await saveCard.click();
      await page.waitForSelector('.save-load-modal-window', { timeout: 5000 });
      await page.waitForTimeout(400);

      // セーブ画面を撮影
      await page.screenshot({ path: `${artifactDir}/save_load_modal_save.png` });
      console.log('Saved save_load_modal_save.png');
    }
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await browser.close();
    previewServer.httpServer.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
