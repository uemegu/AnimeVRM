/**
 * BGMプリセット定義およびマスターデータ
 */

export type BgmId = 'main_theme' | 'main_bgm' | 'night_room' | 'bad_ending';

export interface BgmPreset {
  /** BGM識別ID */
  id: BgmId;
  /** 音声ファイルパス（public配下） */
  url: string;
  /** デフォルト音量スケール (0.0 - 1.0) */
  defaultVolumeScale: number;
  /** 曲名・概要 */
  title: { ja: string; en: string };
}

export const BGM_PRESETS: Record<BgmId, BgmPreset> = {
  main_theme: {
    id: 'main_theme',
    url: '/bgm/thema_music.mp3',
    defaultVolumeScale: 1.0,
    title: { ja: 'メインテーマ', en: 'Main Theme' },
  },
  main_bgm: {
    id: 'main_bgm',
    url: '/bgm/main_bgm.mp3',
    defaultVolumeScale: 1.0,
    title: { ja: '日常（メインBGM）', en: 'Daily Life (Main BGM)' },
  },
  night_room: {
    id: 'night_room',
    url: '/bgm/night_music.mp3',
    // 夜の自室BGMは落ち着いた静かな雰囲気のため、音量を下げて再生
    defaultVolumeScale: 0.45,
    title: { ja: '静寂の夜（自室）', en: 'Quiet Night (My Room)' },
  },
  bad_ending: {
    id: 'bad_ending',
    url: '/bgm/bad_music.mp3',
    defaultVolumeScale: 0.8,
    title: { ja: '陰りゆく日々', en: 'Shadowed Days' },
  },
};

/**
 * BgmId または任意のURLからプリセット情報（またはフォールバック）を解決する
 */
export function resolveBgmInfo(idOrUrl: BgmId | string): { url: string; volumeScale: number; id?: BgmId } {
  if (idOrUrl in BGM_PRESETS) {
    const preset = BGM_PRESETS[idOrUrl as BgmId];
    return {
      id: preset.id,
      url: preset.url,
      volumeScale: preset.defaultVolumeScale,
    };
  }

  // URL直接指定の場合（後方互換性）
  return {
    url: idOrUrl,
    volumeScale: 1.0,
  };
}
