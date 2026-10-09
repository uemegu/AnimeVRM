import type { HandClearanceMode } from '../avatar/handClearance';

/**
 * 描画・計算の重さの設定。端末の性能に合わせて減らす。
 *
 * 段階（high / low）ごとに既定値を持ち、項目ごとに上書きできる。重い処理を足すときは、ここに項目を足して
 * low での扱いを決める（ポストプロセスなどもここへ寄せていく）。
 * low は high のおよそ半分の重さを目安にする（scripts/profile-render.ts で測る）。
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
  /**
   * 描画の画素比の上限。重さは画素数にほぼ比例する（2 → 1.5 で画素数は 56%）。
   * ポストプロセスが十数枚あり、ほとんどが全画素を読み書きするので、いちばん効く
   */
  maxPixelRatio: number;
  /** 光の筋（postprocessing/GodRaysShader.ts）で、1画素あたり画面を読む回数 */
  godRaysSamples: number;
}

export type StageQualityLevel = 'high' | 'low';

export const STAGE_QUALITY_PRESETS: Record<StageQualityLevel, StageQuality> = {
  high: { handClearance: 'precise', clothDent: true, depthOfField: true, shadowMapSize: 2048, maxPixelRatio: 2, godRaysSamples: 45 },
  low: { handClearance: 'simple', clothDent: true, depthOfField: false, shadowMapSize: 1024, maxPixelRatio: 1.5, godRaysSamples: 20 },
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
  return stageQualityOf(requestedLevel() ?? (isLevel(option) ? option : deviceLevel()), option);
}

/** 段階の既定値に、option の項目ごとの上書きを重ねる */
export function stageQualityOf(level: StageQualityLevel, option?: StageQualityLevel | Partial<StageQuality>): StageQuality {
  return { ...STAGE_QUALITY_PRESETS[level], ...(isLevel(option) || !option ? {} : option) };
}

/**
 * 描画チェック：実際に回したフレームの間隔を見て、描画が間に合っているかを判定する。
 * 判定するだけで、品質は変えない（StageManager の onSlowFrames で使う側に知らせ、使う側が決める）。
 *
 * タブの切り替えや長い読み込みで止まったフレーム（MAX_FRAME_SEC 超）は数えない。シェーダーのコンパイルなどの
 * 一時的な引っかかりは、中央値で見るので数えても判定は変わらない（遅い端末の 10fps 前後は数える必要がある）。
 * 直近 WINDOW フレームの間隔の中央値が BUDGET_SEC を超えたら、間に合っていないとする。
 * 60Hz の画面で間に合わないと、間隔は 1/30 秒付近に落ちるので、中央値で見れば一時的な引っかかりには反応しない。
 */
export class FrameRateCheck {
  /** これより遅いと不合格（45fps 相当） */
  static readonly BUDGET_SEC = 1 / 45;
  /** 判定に使うフレーム数（60fps で1秒。20fps の端末でも、数え始めから3秒で落とせる） */
  static readonly WINDOW = 60;
  /** 始めのフレームは、読み込み直後で落ち着かないので数えない */
  static readonly WARMUP = 30;
  /** これより長い間隔は、止まっていたものとして数えない */
  static readonly MAX_FRAME_SEC = 0.5;

  private readonly intervals: number[] = [];
  private seen = 0;

  /** フレームの間隔（秒）を足す。間に合っていなければ true */
  add(deltaSec: number): boolean {
    if (++this.seen <= FrameRateCheck.WARMUP) return false;
    if (!(deltaSec > 0) || deltaSec > FrameRateCheck.MAX_FRAME_SEC) return false;
    this.intervals.push(deltaSec);
    if (this.intervals.length > FrameRateCheck.WINDOW) this.intervals.shift();
    // 中央値の計算は15フレームごと
    if (this.intervals.length < FrameRateCheck.WINDOW || this.seen % 15 !== 0) return false;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    return sorted[sorted.length >> 1] > FrameRateCheck.BUDGET_SEC;
  }
}
