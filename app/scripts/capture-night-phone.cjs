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

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to Night Room directly...');
  await page.goto('http://localhost:5174/?phase=night');
  await page.waitForTimeout(2000);

  // 自室が表示されるのを待機
  try {
    await page.waitForSelector('.room-overlay', { timeout: 10000 });
  } catch (e) {
    console.error('Wait for .room-overlay failed');
    throw e;
  }
  await page.waitForTimeout(1500);

  // 1. 夜の自室画面（着信通知カード表示中：復元されたサイドバーと明るいアイコン背景）
  const roomPath = path.join(outputDir, '01_night_room_incoming_call.png');
  await page.screenshot({ path: roomPath });
  console.log('Saved 01_night_room_incoming_call.png');

  // 2. 着信カードの「応答」をクリックして TV電話（スマホ通話）を起動
  console.log('Answering incoming call...');
  const answerBtn = page.locator('.phone-notif-btn-answer');
  if (await answerBtn.isVisible()) {
    await answerBtn.click({ force: true });
    await page.waitForSelector('.phone-call-container', { timeout: 8000 });
    // 3Dアバターの描画とライティング反映を待機
    await page.waitForTimeout(3500);

    // 2a. TV通話中：室内明アバター顔アップ ＋ 下部通常セリフウィンドウ
    const callDialoguePath = path.join(outputDir, '02a_phone_tv_call_dialogue.png');
    await page.screenshot({ path: callDialoguePath });
    console.log('Saved 02a_phone_tv_call_dialogue.png');

    // セリフボックス（.adv-message-container）をクリック（1回目で全文表示、2回目で選択肢へ）
    const dialogueBox = page.locator('.adv-message-container');
    if (await dialogueBox.isVisible()) {
      console.log('Clicking dialogue to complete typing...');
      await dialogueBox.click({ force: true });
      await page.waitForTimeout(600);
      console.log('Clicking dialogue to proceed to choices...');
      await dialogueBox.click({ force: true });
      await page.waitForTimeout(1500);

      // 2b. 通常の選択肢表示
      const choiceBox = page.locator('.adv-choices-container');
      try {
        await choiceBox.waitFor({ state: 'visible', timeout: 5000 });
        const callChoicePath = path.join(outputDir, '02b_phone_tv_call_choice.png');
        await page.screenshot({ path: callChoicePath });
        console.log('Saved 02b_phone_tv_call_choice.png');

        // 1つ目の選択肢を選択
        console.log('Clicking first choice...');
        await page.locator('.adv-choice-btn').first().click({ force: true });
        await page.waitForTimeout(1500);

        // 2c. 返答セリフ表示
        const callReactionPath = path.join(outputDir, '02c_phone_tv_call_reaction.png');
        await page.screenshot({ path: callReactionPath });
        console.log('Saved 02c_phone_tv_call_reaction.png');

        // リアクションセリフをクリックして通話終了（タイピング完了＋次へ）
        if (await dialogueBox.isVisible()) {
          console.log('Clicking reaction dialogue to finish typing...');
          await dialogueBox.click({ force: true });
          await page.waitForTimeout(600);
          console.log('Clicking reaction dialogue to finish call...');
          await dialogueBox.click({ force: true });
          await page.waitForTimeout(2000);
        }
      } catch (err) {
        console.warn('ChoiceBox error:', err.message);
      }
    }
  }

  // 3. 通話終了後、シオンの新着メール通知カードが表示されるのをキャプチャ
  console.log('Capturing mail notification card in restored night room...');
  await page.waitForTimeout(1500);
  const mailNotifPath = path.join(outputDir, '03_night_room_mail_notification.png');
  await page.screenshot({ path: mailNotifPath });
  console.log('Saved 03_night_room_mail_notification.png');

  // 4. 新着メール通知カードをクリックして LINE風メールを開く
  console.log('Opening mail modal...');
  const mailCard = page.locator('.phone-notification-card');
  if (await mailCard.isVisible()) {
    await mailCard.click({ force: true });
    await page.waitForSelector('.phone-mail-container', { timeout: 5000 });
    await page.waitForTimeout(1000);

    const mailPath = path.join(outputDir, '04_phone_mail_line.png');
    await page.screenshot({ path: mailPath });
    console.log('Saved 04_phone_mail_line.png');

    // 返信選択肢をクリックして返信の様子をキャプチャ
    const replyBtn = page.locator('.phone-mail-reply-btn').first();
    if (await replyBtn.isVisible()) {
      await replyBtn.click({ force: true });
      // リアクション返信が届くまで待機
      await page.waitForTimeout(2000);

      const mailRepliedPath = path.join(outputDir, '05_phone_mail_replied.png');
      await page.screenshot({ path: mailRepliedPath });
      console.log('Saved 05_phone_mail_replied.png');
    }

    // 戻るボタンをクリックして閉じる
    const backBtn = page.locator('.phone-mail-back-btn');
    if (await backBtn.isVisible()) {
      await backBtn.click({ force: true });
      await page.waitForTimeout(1000);

      const roomRestoredPath = path.join(outputDir, '06_night_room_restored.png');
      await page.screenshot({ path: roomRestoredPath });
      console.log('Saved 06_night_room_restored.png');
    }
  }

  await browser.close();
  console.log('Finished capturing all screenshots.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
