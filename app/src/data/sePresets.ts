/**
 * 効果音プリセット定義（UI操作音・通知音）
 * 画面側はファイル名や音量を持たず、ID で soundManager.playUiSe を呼ぶ
 */

export type UiSeId = 'shown' | 'hover' | 'select' | 'cancel' | 'mailNotification' | 'phoneVibe';

export interface SePreset {
  /** 音声ファイルパス（public配下） */
  url: string;
  /** 音量スケール (0.0 - 1.0) */
  volumeScale: number;
}

export const UI_SE_PRESETS: Record<UiSeId, SePreset> = {
  /** メニュー・選択肢・ダイアログの表示 */
  shown: { url: '/se/items_shown.mp3', volumeScale: 0.6 },
  /** 項目へのホバー */
  hover: { url: '/se/items_hover.mp3', volumeScale: 0.45 },
  /** 決定 */
  select: { url: '/se/items_chose.mp3', volumeScale: 0.65 },
  /** キャンセル */
  cancel: { url: '/se/items_chose.mp3', volumeScale: 0.55 },
  /** メール着信 */
  mailNotification: { url: '/sounds/mail_notification.mp3', volumeScale: 1.0 },
  /** 電話の着信バイブ（ループ再生） */
  phoneVibe: { url: '/sounds/phone_vibe.mp3', volumeScale: 1.0 },
};
