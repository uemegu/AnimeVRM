import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/7fe7e8cd-98e9-41d9-b2f0-750726488cdc';
  console.log('Starting vite preview on port 5195...');
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5195,
      host: '127.0.0.1',
    },
  });

  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5195/ ...');
    await page.goto('http://127.0.0.1:5195/');

    // 初回ローディング画面が表示される場合は START ボタンをクリックしてタイトルへ
    const startLoadingBtn = await page.$('.loading-start-btn');
    if (startLoadingBtn) {
      console.log('Clicking START on loading screen...');
      await startLoadingBtn.click();
      await page.waitForSelector('.title-screen-container', { timeout: 15000 });
    } else {
      await page.waitForSelector('.title-screen-container', { timeout: 8000 });
    }

    await page.waitForTimeout(600);

    // 1. タイトル画面（通常・サウンドON）
    await page.screenshot({ path: `${artifactDir}/title_screen_mute.png` });
    console.log('Saved title_screen_mute.png');

    // 2. タイトル画面でミュート切り替え
    const muteBtn = await page.$('[data-testid="btn-mute"]');
    if (muteBtn) {
      console.log('Clicking mute button on title screen...');
      await muteBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${artifactDir}/title_screen_muted.png` });
      console.log('Saved title_screen_muted.png');
      // ミュート解除に戻す
      await muteBtn.click();
      await page.waitForTimeout(200);
    }

    // 3. ゲーム開始（はじめから）
    console.log('Clicking "はじめから"...');
    await page.click('[data-testid="btn-start"]');

    // 朝の会話が始まるのを待つ
    await page.waitForSelector('.adv-message-container', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 4. ゲームプレイ中ヘッダー（LOG, AUTO, MUTE等）
    await page.screenshot({ path: `${artifactDir}/gameplay_header_controls.png` });
    console.log('Saved gameplay_header_controls.png');

    // 会話を最後まで進めて行動マップへ移行
    console.log('Advancing through morning scenario to action selection...');
    for (let attempts = 0; attempts < 25; attempts++) {
      const overlay = await page.$('.action-select-overlay');
      if (overlay && await overlay.isVisible()) {
        console.log('Reached action selection screen.');
        break;
      }
      const msgBox = await page.$('.adv-message-container');
      if (msgBox && await msgBox.isVisible()) {
        await msgBox.click();
      }
      await page.waitForTimeout(400);
    }

    await page.waitForTimeout(1500);

    // 行動フェーズ（「午前」バッジ）のヘッダーを撮影
    await page.screenshot({ path: `${artifactDir}/gameplay_header_controls.png` });
    console.log('Saved gameplay_header_controls.png (in morning_action)');

    try {
      // 「教室」カードを選択してアオイの行動イベントを開始
      const classroomCard = await page.$('.location-item-card');
      if (classroomCard) {
        console.log('Clicking classroom location card...');
        await classroomCard.click();
        await page.waitForSelector('.confirm-modal-btn.confirm', { timeout: 5000 });
        await page.waitForTimeout(400);
        await page.click('.confirm-modal-btn.confirm');
        console.log('Confirmed location selection.');
        await page.waitForTimeout(2000);
      }

      // 会話ウィンドウが表示されるのを待つ
      await page.waitForSelector('.adv-message-container', { timeout: 15000 });
      await page.waitForTimeout(600);

      // アオイのセリフを進めて選択肢を表示
      console.log('Advancing to choices...');
      for (let attempts = 0; attempts < 15; attempts++) {
        const choiceBtn = await page.$('.adv-choice-btn');
        if (choiceBtn && await choiceBtn.isVisible()) {
          console.log('Choice button is visible.');
          break;
        }
        const msgBox = await page.$('.adv-message-container');
        if (msgBox && await msgBox.isVisible()) {
          await msgBox.click();
        }
        await page.waitForTimeout(500);
      }

      await page.waitForSelector('.adv-choice-btn', { timeout: 8000 });
      await page.waitForTimeout(400);

      // 選択肢1（「いいよ、ここ見やすくなってるよ」）をクリック
      console.log('Selecting choice 1...');
      await page.click('.adv-choice-btn:first-child');
      await page.waitForTimeout(1000);
    } catch (e) {
      console.warn('Could not advance to action choice automatically, opening history with available logs:', e.message);
    }

    // 5. 会話履歴モーダル（LOGボタン押下）
    const logBtn = await page.$('.header-history-btn');
    if (logBtn) {
      console.log('Opening history modal via LOG button...');
      await logBtn.click();
      await page.waitForSelector('.history-modal-window', { timeout: 5000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${artifactDir}/dialogue_history_modal.png` });
      console.log('Saved dialogue_history_modal.png');

      // 履歴モーダルを閉じる
      await page.click('.history-close-btn');
      await page.waitForTimeout(400);
    }

    // 6. 自室へ進めるか、またはスロットセーブモーダルの表示確認
    // 朝〜行動を経て自室へ進める、または直接セーブ/ロードモーダルをトリガー
    // テスト用にlocalStorageにスロットセーブデータを1件注入し、タイトル画面へ戻って「つづきから」でのスロット選択モーダルを撮影
    console.log('Injecting sample save data to slot 1 and returning to title to test SaveLoadModal...');
    await page.evaluate(() => {
      const sampleSave = {
        version: 1,
        savedAt: new Date().toISOString(),
        gameState: {
          day: 3,
          phase: 'lunch_action',
          flags: { met_aoi: true },
          affinities: { aoi: 5, emili: 2, shion: 0 },
          currentScenarioId: null,
        },
        summary: {
          day: 3,
          phase: 'lunch_action',
          chapterTitle: 'Day 3 昼休み',
        },
      };
      localStorage.setItem('galgame_save_slot_1', JSON.stringify(sampleSave));
    });

    // ページ再読み込みしてタイトル画面へ
    await page.reload();
    const startLoadingBtn2 = await page.$('.loading-start-btn');
    if (startLoadingBtn2) {
      await startLoadingBtn2.click();
      await page.waitForSelector('.title-screen-container', { timeout: 15000 });
    } else {
      await page.waitForSelector('.title-screen-container', { timeout: 8000 });
    }

    await page.waitForTimeout(500);

    // 「つづきから」が活性化されていることを確認してクリック
    const continueBtn = await page.$('[data-testid="btn-continue"]');
    if (continueBtn && !(await continueBtn.isDisabled())) {
      console.log('Clicking "つづきから" to open SaveLoadModal...');
      await continueBtn.click();
      await page.waitForSelector('.save-load-modal-window', { timeout: 4000 });
      await page.waitForTimeout(400);

      // 7. スロット選択モーダル（ロードモード: Slot 1にデータあり、Slot 2/3は空き）
      await page.screenshot({ path: `${artifactDir}/save_load_modal_load.png` });
      console.log('Saved save_load_modal_load.png');
    }

  } catch (err) {
    console.error('Error during capture:', err);
    throw err;
  } finally {
    await browser.close();
    previewServer.httpServer.close();
    console.log('Capture finished.');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
