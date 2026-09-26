import bgmBook from '../../../assets/studio/bgm.json';

/**
 * BGM のマスターデータ。中身は Studio の BGM 一覧（assets/studio/bgm.json）
 */
export type BgmId = string;

export interface BgmPreset {
  /** BGM識別ID */
  id: BgmId;
  /** 音声ファイルパス（assets/ 基準） */
  url: string;
  /** デフォルト音量スケール (0.0 - 1.0) */
  defaultVolumeScale: number;
  /** 曲名・概要 */
  title: { ja: string; en: string };
}

export const BGM_PRESETS: Record<BgmId, BgmPreset> = Object.fromEntries(
  Object.entries(bgmBook.bgm).map(([id, bgm]) => [id, { id, url: bgm.url, defaultVolumeScale: bgm.volumeScale, title: bgm.title }])
);

/**
 * BgmId または任意のURLからプリセット情報（またはフォールバック）を解決する
 */
export function resolveBgmInfo(idOrUrl: BgmId | string): { url: string; volumeScale: number; id?: BgmId } {
  const preset = BGM_PRESETS[idOrUrl];
  if (preset) {
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
