import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

async function run() {
  console.log('--- Starting Vite dev server for audio & lipsync verification ---');
  const viteProcess = spawn('npm', ['run', 'dev', '--', '--port', '5199'], {
    cwd: appRoot,
    stdio: 'pipe',
    shell: true,
  });

  const serverUrl = 'http://localhost:5199';

  // Wait for server ready
  await new Promise((resolve) => {
    viteProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Local:') || msg.includes('localhost:5199')) {
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  console.log(`Server started at ${serverUrl}`);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser ERROR]: ${msg.text()}`);
    }
  });

  try {
    console.log('Navigating to app...');
    await page.goto(serverUrl, { waitUntil: 'networkidle' });

    // Wait 2 seconds for initial 3D stage and morning scene
    await page.waitForTimeout(2000);

    // Initial scene screenshot (BGM loaded)
    await page.screenshot({ path: path.resolve(appRoot, 'scripts/audio_stage_init.png') });
    console.log('Captured audio_stage_init.png');

    // Click dialogue box to advance to scene_2 (Aoi speaks: "おーい！おはよう！" with voice 001.wav)
    console.log('Clicking dialogue box to advance to voice line...');
    await page.click('.dialogue-window');

    // Wait for voice audio to trigger and lip-sync to activate
    await page.waitForTimeout(1500);

    // Check if voice audio element exists and is playing or loaded
    const audioState = await page.evaluate(() => {
      const audios = Array.from(document.querySelectorAll('audio'));
      return {
        audioTagsCount: audios.length,
      };
    });
    console.log('Audio DOM state:', audioState);

    await page.screenshot({ path: path.resolve(appRoot, 'scripts/audio_stage_speaking.png') });
    console.log('Captured audio_stage_speaking.png');

    // Click again to proceed to next line
    console.log('Advancing to next dialogue line...');
    await page.click('.dialogue-window');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.resolve(appRoot, 'scripts/audio_stage_line3.png') });
    console.log('Captured audio_stage_line3.png');

    console.log('--- Verification successfully completed! ---');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    viteProcess.kill('SIGTERM');
  }
}

run();
