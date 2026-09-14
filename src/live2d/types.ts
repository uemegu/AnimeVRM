export interface Live2DConfig {
  /** Live2D近接切り替え機能の有効/無効 */
  enabled: boolean;
  /** アセットのベースパス（例: '/reference-live2d/'） */
  basePath: string;
  /** マニフェストパス（未指定時は `${basePath}manifest.json`） */
  manifestUrl?: string;
  /** 表情マニフェストパス（未指定時は `${basePath}expressions/manifest.json`） */
  expressionManifestUrl?: string;
  /** 近接切り替えトリガー距離（m）。これより近くなるとLive2Dへ切り替え（デフォルト: 1.55） */
  triggerDistance: number;
  /** 復帰トリガー距離（m）。これより離れるとVRMへ復帰（デフォルト: 1.75） */
  restoreDistance: number;
  /** 背景ぼかしの強さ（px。デフォルト: 12） */
  blurAmount: number;
  /** 対象とするモデルURLの部分一致文字列（デフォルト: ['aoi-school']） */
  targetModelSubstrings: string[];
  /** 暗転フェードアウト時間（ms。デフォルト: 160） */
  fadeOutDurationMs?: number;
  /** 暗転保持時間（ms。デフォルト: 50） */
  holdDurationMs?: number;
  /** 明転フェードイン時間（ms。デフォルト: 180） */
  fadeInDurationMs?: number;
  /** キャラクター描画スケール（デフォルト: 1.04） */
  characterScale?: number;
  /** キャラクターの縦オフセット（NDC単位。負数で下げる。デフォルト: -0.09） */
  characterOffsetY?: number;
  /** Live2D表示時の背景ズーム倍率（CSS scale。デフォルト: 1.22） */
  backgroundZoomScale?: number;
}

export const DEFAULT_LIVE2D_CONFIG: Live2DConfig = {
  enabled: true,
  basePath: '/reference-live2d/',
  triggerDistance: 1.55,
  restoreDistance: 1.75,
  blurAmount: 12,
  targetModelSubstrings: ['aoi-school'],
  fadeOutDurationMs: 160,
  holdDurationMs: 50,
  fadeInDurationMs: 180,
  characterScale: 1.04,
  characterOffsetY: -0.09,
  backgroundZoomScale: 1.22,
};

export interface Live2DLayer {
  name: string;
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  texture?: WebGLTexture;
}

export interface Live2DManifest {
  width: number;
  height: number;
  layers: Live2DLayer[];
}

export interface Live2DExpressionManifest {
  mouthRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  entries: Array<{
    name: string;
    file: string;
    x: number;
    y: number;
    width: number;
    height: number;
    texture?: WebGLTexture;
  }>;
}
