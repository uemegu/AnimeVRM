import { DayPhase } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';

export interface DialogueCaptureInfo {
  speaker?: string;
  text: string;
}

export interface ShareOptions {
  day: number;
  phase: DayPhase;
  locationName?: string;
  lang: SupportedLanguage;
  canvasSelector?: string;
  dialogue?: DialogueCaptureInfo;
  openDelayMs?: number;
  forceNativeShare?: boolean;
}

export interface ShareResult {
  success: boolean;
  mode: 'native' | 'clipboard' | 'canceled' | 'failed';
  message: string;
  tweetUrl?: string;
}

export class ShareService {
  /**
   * テキストの自動折り返し計算
   */
  public static wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const lines: string[] = [];
    const rawLines = text.split('\n');

    for (const rawLine of rawLines) {
      let currentLine = '';
      for (let i = 0; i < rawLine.length; i++) {
        const char = rawLine[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    return lines;
  }

  /**
   * 現在表示されている描画キャンバスとセリフ枠を合成した Blob を生成
   */
  public static async captureCanvasBlob(
    canvasSelector = 'canvas',
    dialogue?: DialogueCaptureInfo
  ): Promise<Blob | null> {
    if (typeof document === 'undefined') return null;

    let baseCanvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
    let baseImg: HTMLImageElement | null = null;

    // canvas がない場合は背景画像（自室など）を探索
    if (!baseCanvas) {
      baseImg = document.querySelector<HTMLImageElement>('.room-main-img');
      if (!baseImg) return null;
    }

    const width = baseCanvas ? baseCanvas.width : (baseImg?.naturalWidth || 1280);
    const height = baseCanvas ? baseCanvas.height : (baseImg?.naturalHeight || 720);

    // オフスクリーンキャンバスで合成
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      // 2Dコンテキストが取得できない場合は元のキャンバスからBlob取得
      if (baseCanvas) {
        return new Promise((resolve) => baseCanvas?.toBlob(resolve, 'image/png'));
      }
      return null;
    }

    // 1. ベースの3D画面または背景画像を描画
    if (baseCanvas) {
      ctx.drawImage(baseCanvas, 0, 0, width, height);
    } else if (baseImg) {
      ctx.drawImage(baseImg, 0, 0, width, height);
    }

    // 2. セリフ枠（メッセージウィンドウ）の合成描画
    if (dialogue && dialogue.text && dialogue.text.trim().length > 0) {
      const scale = Math.max(1, width / 1280);
      const boxHeight = Math.max(160 * scale, height * 0.28);

      // 下部グラデーション背景
      const grad = ctx.createLinearGradient(0, height - boxHeight, 0, height);
      grad.addColorStop(0, 'rgba(3, 7, 18, 0)');
      grad.addColorStop(0.25, 'rgba(3, 7, 18, 0.82)');
      grad.addColorStop(1, 'rgba(3, 7, 18, 0.96)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - boxHeight, width, boxHeight);

      // テキスト描画エリア設定
      const maxBodyWidth = Math.min(width * 0.88, 860 * scale);
      const startX = (width - maxBodyWidth) / 2;
      let currentY = height - boxHeight + 46 * scale;

      // 話者名
      if (dialogue.speaker) {
        const speakerFontSize = Math.round(18 * scale);
        ctx.font = `bold ${speakerFontSize}px "Kiwi Maru", "Hiragino Mincho ProN", "Yu Mincho", "Noto Sans JP", sans-serif`;
        ctx.fillStyle = '#7dd3fc';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6 * scale;
        ctx.fillText(`◆ ${dialogue.speaker}`, startX, currentY);
        currentY += speakerFontSize * 1.5;
      }

      // セリフ本文
      const textFontSize = Math.round(21 * scale);
      ctx.font = `500 ${textFontSize}px "Kiwi Maru", "Hiragino Mincho ProN", "Yu Mincho", "Noto Sans JP", sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 8 * scale;
      const lineHeight = textFontSize * 1.7;

      const lines = this.wrapText(ctx, dialogue.text, maxBodyWidth);
      for (const line of lines) {
        ctx.fillText(line, startX, currentY);
        currentY += lineHeight;
      }
    }

    return new Promise((resolve) => {
      try {
        offscreen.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * 投稿用のシェアテキストを生成
   */
  public static generateShareText(options: {
    day: number;
    phase: DayPhase;
    locationName?: string;
    lang: SupportedLanguage;
  }): string {
    const { day, phase, locationName, lang } = options;

    const phaseJaMap: Record<DayPhase, string> = {
      morning: '朝',
      morning_action: '午前',
      lunch_action: '昼休み',
      afterschool_action: '放課後',
      night: '夜',
    };

    const phaseEnMap: Record<DayPhase, string> = {
      morning: 'Morning',
      morning_action: 'Morning Action',
      lunch_action: 'Lunch',
      afterschool_action: 'After School',
      night: 'Night',
    };

    if (lang === 'ja') {
      const locText = locationName ? `【${locationName}】` : '';
      return `AnimeVRM Day ${day}（${phaseJaMap[phase]}）${locText}をプレイ中！\n#AnimeVRM`;
    } else {
      const locText = locationName ? ` at ${locationName}` : '';
      return `Playing AnimeVRM: Day ${day} (${phaseEnMap[phase]})${locText}!\n#AnimeVRM`;
    }
  }

  /**
   * モバイル端末（iOS / Android）かどうかの判定
   */
  public static isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isTouchMac =
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1 &&
      /Macintosh/i.test(ua);
    return /iPhone|iPad|iPod|Android/i.test(ua) || isTouchMac;
  }

  /**
   * Xへのシェア実行
   * 1. モバイル端末の場合: Web Share API (files) でネイティブファイル渡しを試行
   * 2. デスクトップ環境または非対応/失敗時:
   *    - 画像をクリップボードにコピー
   *    - 1.5秒待機後に Web Intent を開く（Toastを視認させるため）
   */
  public static async shareToX(options: ShareOptions): Promise<ShareResult> {
    const shareText = this.generateShareText(options);
    const shareUrl = window.location.href;
    const blob = await this.captureCanvasBlob(options.canvasSelector, options.dialogue);
    const isMobile = options.forceNativeShare ?? this.isMobileDevice();

    // 1. モバイル端末のみ Web Share API (ファイル渡し) の試行
    if (isMobile && blob && typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const file = new File([blob], `AnimeVRM_Day${options.day}.png`, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            text: shareText,
            url: shareUrl,
          });

          return {
            success: true,
            mode: 'native',
            message:
              options.lang === 'ja'
                ? '共有メニューを開きました'
                : 'Opened share menu with screenshot',
          };
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return {
            success: true,
            mode: 'canceled',
            message: '',
          };
        }
      }
    }

    // 2. デスクトップ環境フォールバック:
    // クリップボードに画像をコピーし、指定秒数（デフォルト1.5秒）後にWeb Intentを開く
    let copiedToClipboard = false;
    if (
      blob &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof ClipboardItem !== 'undefined'
    ) {
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        copiedToClipboard = true;
      } catch {
        copiedToClipboard = false;
      }
    }

    const tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}`;

    const delayMs = options.openDelayMs ?? 1500;

    // 1.5秒後に別タブで開く
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        try {
          window.open(tweetIntentUrl, '_blank', 'noopener,noreferrer');
        } catch {
          // ポップアップがブロックされた場合は何もしない（トースト側で開ける）
        }
      }, delayMs);
    }

    if (copiedToClipboard) {
      return {
        success: true,
        mode: 'clipboard',
        tweetUrl: tweetIntentUrl,
        message:
          options.lang === 'ja'
            ? '画面画像をコピーしました。1.5秒後にXを開きます（Cmd+Vで貼付）。'
            : 'Screenshot copied! Opening X in 1.5s (paste with Cmd+V).',
      };
    }

    return {
      success: true,
      mode: 'clipboard',
      tweetUrl: tweetIntentUrl,
      message:
        options.lang === 'ja'
          ? '1.5秒後にXの投稿画面を開きます'
          : 'Opening X post window in 1.5s...',
    };
  }
}
