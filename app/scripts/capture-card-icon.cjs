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
    await page.waitForSelector('.phone-notification-card', { timeout: 10000 });
  } catch (e) {
    console.error('Wait for .phone-notification-card failed');
    throw e;
  }
  await page.waitForTimeout(1000);

  // 全体画面キャプチャ
  const fullPath = path.join(outputDir, 'notif_card_clean_full.png');
  await page.screenshot({ path: fullPath, animations: 'disabled' });
  console.log('Saved notif_card_clean_full.png');

  // 通知カード要素の切り抜きキャプチャ
  const card = page.locator('.phone-notification-card');
  const cardPath = path.join(outputDir, 'notif_card_clean_crop.png');
  await card.screenshot({ path: cardPath, animations: 'disabled' });
  console.log('Saved notif_card_clean_crop.png');

  await browser.close();
  console.log('Finished capturing.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
