import motionBook from '../../../assets/studio/motions.json';

/**
 * モーション（assets/animations/<名前>.fbx）の再生方法。中身は Studio のモーション情報（assets/studio/motions.json）。
 * 待機・歩行など、繰り返して自然なものだけループする。身振りは1回再生して待機モーションに戻る
 */
export const LOOPING_MOTIONS = new Set(
  Object.entries(motionBook.motions as Record<string, { loop?: boolean }>)
    .filter(([, info]) => info.loop)
    .map(([name]) => name)
);
