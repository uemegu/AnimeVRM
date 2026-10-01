import type { HandClearanceMode } from '../avatar/handClearance';

/**
 * 描画・計算の重さの設定。端末の性能に合わせて減らす。
 *
 * 段階（high / low）ごとに既定値を持ち、項目ごとに上書きできる。重い処理を足すときは、ここに項目を足して
 * low での扱いを決める（ポストプロセスなどもここへ寄せていく）。
 */
export interface StageQuality {
  /** 手が肌（頭・太もも）で止まる処理（avatar/handClearance.ts） */
  handClearance: HandClearanceMode;
  /** 手に押されてスカートがへこむ（avatar/clothDent.ts）。頂点シェーダーで行うので軽い */
  clothDent: boolean;
  /** 背景ぼかし（postprocessing/DepthOfField.ts）。画面の全画素で40回ずつ読むので重い */
  depthOfField: boolean;
  /** キャラが地面に落とす影の解像度 */
  shadowMapSize: number;
}

export type StageQualityLevel = 'high' | 'low';

export const STAGE_QUALITY_PRESETS: Record<StageQualityLevel, StageQuality> = {
  high: { handClearance: 'precise', clothDent: true, depthOfField: true, shadowMapSize: 2048 },
  low: { handClearance: 'simple', clothDent: true, depthOfField: false, shadowMapSize: 1024 },
};

/** 段階の手動指定。URL の ?quality=low か、localStorage の stage_quality（検証・切り替え用） */
const STORAGE_KEY = 'stage_quality';

function isLevel(value: unknown): value is StageQualityLevel {
  return value === 'high' || value === 'low';
}

/** 手動指定の段階。なければ null */
function requestedLevel(): StageQualityLevel | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('quality');
  if (isLevel(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLevel(stored)) return stored;
  } catch {
    // localStorage が使えない環境（プライベートブラウズなど）は手動指定なし
  }
  return null;
}

/** 端末から段階を決める。指で操作する端末（スマホ・タブレット）は low */
function deviceLevel(): StageQualityLevel {
  if (typeof window === 'undefined' || !window.matchMedia) return 'high';
  return window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
}

/**
 * 設定を決める。段階は 手動指定（URL・localStorage）> option の段階名 > 端末 の順で決め、
 * option が項目ごとの上書きなら、その段階の既定値に重ねる
 */
export function resolveStageQuality(option?: StageQualityLevel | Partial<StageQuality>): StageQuality {
  const level = requestedLevel() ?? (isLevel(option) ? option : deviceLevel());
  return { ...STAGE_QUALITY_PRESETS[level], ...(isLevel(option) ? {} : option) };
}
