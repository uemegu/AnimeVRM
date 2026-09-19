import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/4dd46d6e-d000-4187-8fed-3a9c75e3b49b';
  console.log('Starting vite preview on port 5192...');
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5192,
      host: '127.0.0.1',
    },
  });

  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5192/ ...');
    await page.goto('http://127.0.0.1:5192/');

    await page.waitForSelector('.title-screen-container');

    // 1. 幕間トランジションが完全に覆われた状態をキャプチャ
    console.log('Triggering "はじめから" for interlude transition capture...');
    await page.click('[data-testid="btn-start"]');
    await page.waitForSelector('.interlude-overlay-container.covered');
    // スライドインアニメーション（420ms）が完了しホールド中の状態を撮影
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${artifactDir}/interlude_transition_covered.png` });
    console.log('Saved interlude_transition_covered.png');

    // 2. 夜フェーズのセーブデータを localStorage に直接注入して夜の自室へ移動
    console.log('Injecting night phase save data into localStorage...');
    await page.evaluate(() => {
      const nightSave = {
        version: 1,
        savedAt: new Date().toISOString(),
        gameState: {
          day: 1,
          phase: 'night',
          currentScenarioId: null,
          flags: {},
          affinities: { aoi: 3, shion: 2, emili: 1 },
          dayStartSnapshot: {
            day: 1,
            flags: {},
            affinities: { aoi: 0, shion: 0, emili: 0 },
          },
        },
        summary: {
          day: 1,
          phase: 'night',
          chapterTitle: '第1日 夜: 自室',
        },
      };
      localStorage.setItem('galgame_save_data', JSON.stringify(nightSave));
    });

    // ページをリロードして「つづきから」をクリック
    console.log('Reloading page...');
    await page.reload();
    await page.waitForSelector('.title-screen-container');

    console.log('Clicking "つづきから"...');
    await page.click('[data-testid="btn-continue"]');

    // 夜の自室画面が表示されるのを待機
    console.log('Waiting for night room overlay...');
    await page.waitForSelector('.room-overlay', { timeout: 10000 });
    await page.waitForTimeout(600); // フェードイン完了待ち

    // 夜の自室（背景 #1A1A1A ＋ 白基調メニューカード）
    await page.screenshot({ path: `${artifactDir}/night_room_new_ui.png` });
    console.log('Saved night_room_new_ui.png');

    // 就寝カードホバー状態
    await page.hover('.room-menu-card.card-sleep');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${artifactDir}/night_room_hover_sleep.png` });
    console.log('Saved night_room_hover_sleep.png');

    // セーブカードホバー状態
    await page.hover('.room-menu-card:has-text("ゲームをセーブする")');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${artifactDir}/night_room_hover_save.png` });
    console.log('Saved night_room_hover_save.png');

    // セーブカードをクリックしてダイアログ表示状態をキャプチャ
    console.log('Clicking save card to capture confirm modal...');
    await page.click('.room-menu-card:has-text("ゲームをセーブする")');
    await page.waitForSelector('.confirm-modal-overlay', { timeout: 3000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${artifactDir}/night_room_save_dialog.png` });
    console.log('Saved night_room_save_dialog.png');

    console.log('All screenshots captured successfully!');
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
