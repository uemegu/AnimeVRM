const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const outputDir = '/Users/ueda/.gemini/antigravity/brain/4c48b90a-0e13-485e-8576-59e9fd03df33/scratch';
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  console.log('Navigating to Night Room...');
  await page.goto('http://localhost:5174/?phase=night');
  await page.waitForTimeout(2000);

  try {
    await page.waitForSelector('.game-header', { timeout: 10000 });
  } catch (e) {
    console.error('Wait for .game-header failed');
    throw e;
  }
  await page.waitForTimeout(1000);

  // ヘッダー全体を含む画面キャプチャ
  const fullPath = path.join(outputDir, 'header_updated_full.png');
  await page.screenshot({ path: fullPath });
  console.log('Saved header_updated_full.png');

  // ヘッダー要素のみの切り抜きキャプチャ
  const header = page.locator('.game-header');
  const headerPath = path.join(outputDir, 'header_updated_crop.png');
  await header.screenshot({ path: headerPath });
  console.log('Saved header_updated_crop.png');

  await browser.close();
  console.log('Finished capturing header screenshots.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
