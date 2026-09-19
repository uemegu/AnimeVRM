export type PreloadAssetType = 'vrm' | 'audio' | 'wasm' | 'binary' | 'image';

export interface PreloadTargetInput {
  /**
   * public ディレクトリからの相対パス（先頭のスラッシュあり）
   * 例: '/models/aoi/aoi-school.vrm'
   */
  url: string;
  /**
   * アセット固有のID（省略時はURLから自動導出）
   */
  id?: string;
  /**
   * 表示用ラベル（日英）
   */
  label?: {
    ja: string;
    en: string;
  };
  /**
   * アセット種別（省略時は拡張子から自動判定）
   */
  type?: PreloadAssetType;
}

/**
 * プリロード対象アセット定義リスト
 * 新しいアセットを追加したい場合は、この配列に url（および必要に応じて label）を追加するだけで、
 * ビルド時および開発時にファイルサイズが自動計算されてマニフェストへ反映されます。
 */
export const PRELOAD_TARGETS: PreloadTargetInput[] = [
  // --- ヒロイン3人: 通常制服モデル ---
  {
    id: 'aoi_school',
    url: '/models/aoi/aoi-school.vrm',
    label: { ja: 'アオイ（制服モデル）', en: 'Aoi (School)' },
    type: 'vrm',
  },
  {
    id: 'emili_school',
    url: '/models/emili/emili.vrm',
    label: { ja: 'エミリ（制服モデル）', en: 'Emili (School)' },
    type: 'vrm',
  },
  {
    id: 'shion_school',
    url: '/models/shion/shion-school.vrm',
    label: { ja: 'シオン（制服モデル）', en: 'Shion (School)' },
    type: 'vrm',
  },

  // --- ヒロイン3人: 制服リュック付きモデル (-with-bag) ---
  {
    id: 'aoi_school_bag',
    url: '/models/aoi/aoi-school-with-bag.vrm',
    label: { ja: 'アオイ（制服・リュック付き）', en: 'Aoi (School with Bag)' },
    type: 'vrm',
  },
  {
    id: 'emili_school_bag',
    url: '/models/emili/emili-school-with-bag.vrm',
    label: { ja: 'エミリ（制服・リュック付き）', en: 'Emili (School with Bag)' },
    type: 'vrm',
  },
  {
    id: 'shion_school_bag',
    url: '/models/shion/shion-school-with-bag.vrm',
    label: { ja: 'シオン（制服・リュック付き）', en: 'Shion (School with Bag)' },
    type: 'vrm',
  },

  // --- ヒロイン3人: 私服モデル ---
  {
    id: 'aoi_private',
    url: '/models/aoi/aoi-private.vrm',
    label: { ja: 'アオイ（私服モデル）', en: 'Aoi (Private)' },
    type: 'vrm',
  },
  {
    id: 'emili_private',
    url: '/models/emili/emili-private.vrm',
    label: { ja: 'エミリ（私服モデル）', en: 'Emili (Private)' },
    type: 'vrm',
  },
  {
    id: 'shion_private',
    url: '/models/shion/shion-private.vrm',
    label: { ja: 'シオン（私服モデル）', en: 'Shion (Private)' },
    type: 'vrm',
  },

  // --- サブキャラクター（先生） ---
  {
    id: 'teacher',
    url: '/models/teacher/teacher.vrm',
    label: { ja: '先生モデル', en: 'Teacher' },
    type: 'vrm',
  },

  // --- 主要BGM ---
  {
    id: 'bgm_main_theme',
    url: '/bgm/thema_music.mp3',
    label: { ja: 'メインテーマ曲', en: 'Main Theme' },
    type: 'audio',
  },
  {
    id: 'bgm_main_bgm',
    url: '/bgm/main_bgm.mp3',
    label: { ja: 'メインBGM', en: 'Main BGM' },
    type: 'audio',
  },

  // --- リップシンクモジュール ---
  {
    id: 'wasm_lipsync',
    url: '/wasm/lipsync.wasm',
    label: { ja: 'リップシンク解析モジュール', en: 'LipSync WASM' },
    type: 'wasm',
  },
  {
    id: 'worklet_lipsync',
    url: '/worklets/lipsync-processor.js',
    label: { ja: 'オーディオプロセッサ', en: 'Audio Worklet' },
    type: 'binary',
  },
];
