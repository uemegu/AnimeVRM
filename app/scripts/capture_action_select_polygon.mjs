import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/c05918e5-1514-4cea-9d79-641b0c5d7800';
  console.log('Starting vite preview on port 5198...');
  const appDir = process.cwd().endsWith('app') ? process.cwd() : path.resolve(process.cwd(), 'app');
  const previewServer = await preview({
    root: appDir,
    preview: {
      port: 5198,
      host: '127.0.0.1',
    },
  });

  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('Navigating to http://127.0.0.1:5198/ ...');
    await page.goto('http://127.0.0.1:5198/');

    // 1. ローディング画面のSTARTボタンをクリック
    await page.waitForSelector('.loading-start-btn', { timeout: 10000 });
    await page.click('.loading-start-btn');

    // 2. タイトル画面の表示を待機
    await page.waitForSelector('.title-screen-container', { timeout: 60000 });

    const capturePhase = async (phase, filename) => {
      console.log(`Setting up phase ${phase}...`);
      await page.evaluate((p) => {
        const save = {
          version: 1,
          savedAt: new Date().toISOString(),
          gameState: {
            day: 1,
            phase: p,
            currentScenarioId: null,
            flags: {},
            affinities: { aoi: 2, shion: 1, emili: 1 },
            dayStartSnapshot: {
              day: 1,
              flags: {},
              affinities: { aoi: 0, shion: 0, emili: 0 },
            },
          },
          summary: {
            day: 1,
            phase: p,
            chapterTitle: `第1日 行動`,
          },
        };
        localStorage.setItem('galgame_save_data', JSON.stringify(save));
      }, phase);

      // リロードしてタイトル画面へ戻る
      await page.reload();
      await page.waitForSelector('.loading-start-btn', { timeout: 10000 });
      await page.click('.loading-start-btn');
      await page.waitForSelector('.title-screen-container', { timeout: 60000 });

      // 「つづきから」をクリック
      console.log(`Clicking continue for ${phase}...`);
      await page.click('[data-testid="btn-continue"]');

      // 行動選択画面表示待機
      await page.waitForSelector(`.action-select-overlay.phase-${phase}`, { timeout: 15000 });
      await page.waitForTimeout(600);

      // スクリーンショット撮影
      await page.screenshot({ path: `${artifactDir}/${filename}` });
      console.log(`Saved ${artifactDir}/${filename}`);
    };

    // 1. 午前（morning_action）
    await capturePhase('morning_action', 'action_select_morning.png');

    // 2. 昼（lunch_action）
    await capturePhase('lunch_action', 'action_select_lunch.png');

    // 3. 夕方（afterschool_action）
    await capturePhase('afterschool_action', 'action_select_afterschool.png');

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
