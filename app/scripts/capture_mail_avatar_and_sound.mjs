import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function main() {
  const artifactDir = '/Users/ueda/.gemini/antigravity/brain/0c921703-fff8-47e5-98f6-31d886bd6b15';
  fs.mkdirSync(artifactDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--no-sandbox', '--disable-setuid-sandbox']
  });

  // ポート 5174 または 5173 を試す
  let targetUrl = 'http://localhost:5174/?phase=night';

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log(`Navigating to ${targetUrl}...`);
  try {
    await page.goto(targetUrl, { timeout: 5000 });
  } catch (e) {
    targetUrl = 'http://localhost:5173/?phase=night';
    console.log(`Fallback navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { timeout: 10000 });
  }

  // 自室が表示されるのを待機
  await page.waitForSelector('.room-overlay', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // 着信があれば応答して通話を終わらせる、またはメール通知カードを探す
  const answerBtn = page.locator('.phone-notif-btn-answer');
  if (await answerBtn.isVisible()) {
    console.log('Answering incoming call to clear it...');
    await answerBtn.click({ force: true });
    await page.waitForSelector('.phone-call-container', { timeout: 8000 });
    await page.waitForTimeout(2000);

    const dialogueBox = page.locator('.adv-message-container');
    if (await dialogueBox.isVisible()) {
      await dialogueBox.click({ force: true });
      await page.waitForTimeout(500);
      await dialogueBox.click({ force: true });
      await page.waitForTimeout(1000);

      const choiceBtn = page.locator('.adv-choice-btn').first();
      if (await choiceBtn.isVisible()) {
        await choiceBtn.click({ force: true });
        await page.waitForTimeout(1000);
        if (await dialogueBox.isVisible()) {
          await dialogueBox.click({ force: true });
          await page.waitForTimeout(500);
          await dialogueBox.click({ force: true });
          await page.waitForTimeout(1500);
        }
      }
    }
  }

  // メール通知カードのキャプチャ
  console.log('Checking for mail notification card...');
  await page.waitForTimeout(1500);
  const mailCard = page.locator('.phone-notification-card');
  if (await mailCard.isVisible()) {
    const mailNotifPath = path.join(artifactDir, 'mail_notification_card.png');
    await page.screenshot({ path: mailNotifPath });
    console.log('Saved mail_notification_card.png');

    // メールモーダルを開く
    await mailCard.click({ force: true });
    await page.waitForSelector('.phone-mail-container', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // メール画面キャプチャ（ヘッダーとヒロイン吹き出し横のアイコン背景色が確認できる）
    const mailModalPath = path.join(artifactDir, 'mail_modal_view.png');
    await page.screenshot({ path: mailModalPath });
    console.log('Saved mail_modal_view.png');

    // 返信ボタンをクリックして返信時の様子（ヒロインのリアクション）もキャプチャ
    const replyBtn = page.locator('.phone-mail-reply-btn').first();
    if (await replyBtn.isVisible()) {
      await replyBtn.click({ force: true });
      await page.waitForTimeout(2500);

      const mailRepliedPath = path.join(artifactDir, 'mail_modal_replied.png');
      await page.screenshot({ path: mailRepliedPath });
      console.log('Saved mail_modal_replied.png');
    }
  } else {
    console.log('No mail notification card found directly, capturing room...');
    await page.screenshot({ path: path.join(artifactDir, 'room_state.png') });
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error running capture:', err);
  process.exit(1);
});
