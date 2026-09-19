import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';

async function run() {
  const artifactDir = process.env.ARTIFACT_DIR || '/Users/ueda/.gemini/antigravity/brain/c05918e5-1514-4cea-9d79-641b0c5d7800';
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

    // 1. ローディング案内画面の確認・撮影
    await page.waitForSelector('.loading-card');
    await page.waitForSelector('.loading-prompt-content');
    console.log('Taking screenshot of loading prompt...');
    await page.screenshot({ path: `${artifactDir}/loading_prompt.png` });
    console.log(`Saved ${artifactDir}/loading_prompt.png`);

    // 2. STARTボタンを押してローディング中の進捗表示を撮影
    console.log('Clicking START button to trigger loading...');
    await page.click('.loading-start-btn');
    await page.waitForSelector('.loading-progress-content');
    // 少し待機してプログレスバーが動いている状態を撮影
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${artifactDir}/loading_progress.png` });
    console.log(`Saved ${artifactDir}/loading_progress.png`);

    // 3. ローディング完了まで待機し、タイトル画面へ遷移
    console.log('Waiting for title screen to appear after loading completion...');
    await page.waitForSelector('.title-screen-container', { timeout: 60000 });
    console.log('Title screen appeared!');

    // BGMの再生状態を確認
    await page.waitForTimeout(600);
    const audioState = await page.evaluate(() => {
      const sm = window.__soundManager;
      if (!sm) return { error: 'SoundManager not found' };
      const bgmAudio = sm.getBgmAudio();
      return {
        currentBgm: sm.getCurrentBgm(),
        hasAudio: !!bgmAudio,
        paused: bgmAudio ? bgmAudio.paused : true,
        currentTime: bgmAudio ? bgmAudio.currentTime : 0,
        volume: bgmAudio ? bgmAudio.volume : 0,
      };
    });
    console.log('Audio state on title screen:', audioState);

    // タイトル画面のスクリーンショットも撮影
    await page.screenshot({ path: `${artifactDir}/title_screen_loaded.png` });
    console.log(`Saved ${artifactDir}/title_screen_loaded.png`);

  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
    await previewServer.close();
    console.log('Done.');
  }
}

run();
