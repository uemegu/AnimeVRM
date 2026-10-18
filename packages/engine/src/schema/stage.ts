/**
 * 描画に渡す形（舞台・カメラ・演出）。engine が受け取るものはすべてここで決め、
 * シナリオ（@anime-vrm/scenario）はこれに合わせて組み立てる。
 */
import { z } from 'zod';

/** 日本語必須・英語任意の文字列 */
export const LocalizedString = z.strictObject({
  ja: z.string(),
  en: z.string().optional(),
});
export type LocalizedString = z.infer<typeof LocalizedString>;

/** 素の文字列（日本語のみ）または多言語文字列 */
export const TextContent = z.union([z.string(), LocalizedString]);
export type TextContent = z.infer<typeof TextContent>;

export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

/**
 * カメラの構図。極端な接写は禁止（開発ルール）なので close でもバストアップまで
 * - wide: 登場キャラ全員が入る引き
 * - medium: 話者を中心に隣の人物も入る会話ショット
 * - speaker: 話者のウェストアップ（1人の場面の既定）
 * - close: 話者のバストアップ（感情の強調）
 * - side: 話者を横から（並んで歩きながらの会話。話者は画面の左寄りに横向きで映る）
 */
export const CameraShot = z.enum(['wide', 'medium', 'speaker', 'close', 'side']);
export type CameraShot = z.infer<typeof CameraShot>;

/**
 * 構図からカメラを上下左右へずらす位置（3x3 の真ん中以外の8方向。省略で真ん中）。
 * 注視点はそのままなので、少し上から・下から・斜めから見る形になる
 */
export const CameraShift = z.enum(['up_left', 'up', 'up_right', 'left', 'right', 'down_left', 'down', 'down_right']);
export type CameraShift = z.infer<typeof CameraShift>;

/**
 * カメラの動き（構図・直接指定に重ねて、カットの間に動かす）。多くは動いた末に指定した構図へ着地する
 * - pan_left / pan_right: その場で横に振って構図へ着地する（左へ振る / 右へ振る）
 * - tilt_up / tilt_down: その場で縦に振って構図へ着地する（下から上へ / 上から下へ）
 * - dolly_in: 遠くからカメラごと被写体へ近づいて構図へ着地する
 * - dolly_out: 構図からカメラごと離れていく
 * - zoom_in / zoom_out: 位置はそのまま、構図から画角で寄っていく / 引いていく
 * - orbit_left / orbit_right: 被写体の周りを1周して構図へ戻る（カメラが左へ / 右へ回る。amount が周回数）
 * - crane_up: 構図からカメラが上へ昇りながら引いていく（被写体は見続ける）
 * - dolly_zoom: 被写体の大きさはそのまま、背景だけ寄って見える（カメラは離れ、画角を狭める）
 * - handheld: 手持ち風にわずかに揺らし続ける
 * - dutch_left / dutch_right: 画面を斜めに傾ける（画面の左側が下がる / 右側が下がる）
 */
export const CameraMoveType = z.enum([
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
  'dolly_in',
  'dolly_out',
  'zoom_in',
  'zoom_out',
  'orbit_left',
  'orbit_right',
  'crane_up',
  'dolly_zoom',
  'handheld',
  'dutch_left',
  'dutch_right',
]);
export type CameraMoveType = z.infer<typeof CameraMoveType>;

/** カメラの動き。種類だけ、または秒数（duration）・大きさの倍率（amount）付き */
export const CameraMove = z.union([
  CameraMoveType,
  z.strictObject({
    type: CameraMoveType,
    /** 動きにかける秒数（handheld では使わない） */
    duration: z.number().positive().optional(),
    /** 動きの大きさの倍率（1 で標準） */
    amount: z.number().positive().max(3).optional(),
  }),
]);
export type CameraMove = z.infer<typeof CameraMove>;

/** カメラの位置・注視点・画角を直接指定する（構図の自動決定より優先） */
export const CameraPose = z.strictObject({
  position: Vec3,
  target: Vec3,
  fov: z.number().min(10).max(90).optional(),
});
export type CameraPose = z.infer<typeof CameraPose>;

/** 漫画風の文字演出のプリセット */
export const EffectTextPreset = z.enum(['doki', 'kirakira', 'yatta', 'iraira', 'gaan', 'wanawana', 'shiin', 'biku', 'nima', 'asease']);
export type EffectTextPreset = z.infer<typeof EffectTextPreset>;

/** 文字演出（プリセット名、または文字・表示秒数の指定つき） */
export const EffectText = z.union([
  EffectTextPreset,
  z.strictObject({
    preset: EffectTextPreset,
    /** 省略時はプリセットの文字 */
    text: TextContent.optional(),
    duration: z.number().positive().optional(),
  }),
]);
export type EffectText = z.infer<typeof EffectText>;

/** 汗の演出（fly4 = 汗が飛ぶ、jito = じわっとにじむ） */
export const SweatMode = z.enum(['fly4', 'jito']);
export type SweatMode = z.infer<typeof SweatMode>;

/** 画面の切り替え演出（fade_black = 暗転してから映す、black = 暗転したまま次のカットまで映さない、white = 白く飛ばしたまま次のカットまで映さない、eyelid_close = 瞼を閉じるように暗くなる、eyelid_blink = まばたき） */
export const ScreenTransition = z.enum(['fade_black', 'black', 'white', 'eyelid_close', 'eyelid_blink']);
export type ScreenTransition = z.infer<typeof ScreenTransition>;

/**
 * 一枚絵（画面いっぱいのイベント絵・カットイン）。文字列は画像の URL だけの指定
 * - fit: 画面いっぱいの絵の合わせ方（cover = 余白なく切り抜く、contain = 全体を収めて余白を暗くする。既定 cover）
 */
export const StillImageConfig = z.strictObject({
  url: z.string(),
  fit: z.enum(['cover', 'contain']).optional(),
});
export type StillImageConfig = z.infer<typeof StillImageConfig>;

/**
 * カットイン（舞台の上の端に載せる小窓の絵。ペルソナの選択肢の場面のように、主人公の格好や反応を見せる）
 * - side: 載せる側（既定 right）
 * - size: 画面の幅に対する小窓の幅（0.15〜0.5、既定 0.24）
 */
export const CutinConfig = z.strictObject({
  url: z.string(),
  side: z.enum(['left', 'right']).optional(),
  size: z.number().min(0.15).max(0.5).optional(),
});
export type CutinConfig = z.infer<typeof CutinConfig>;

/** 流れる背景（歩きながらの会話など） */
export const ScrollingBackgroundConfig = z.strictObject({
  textureUrl: z.string().optional(),
  speed: z.number().optional(),
  blur: z.number().min(0).max(1).optional(),
  direction: z.enum(['left', 'right']).optional(),
  featherWidth: z.number().optional(),
});
export type ScrollingBackgroundConfig = z.infer<typeof ScrollingBackgroundConfig>;

/**
 * シーンの特殊効果。その効果を持つ場所でだけ働く（ない場所では何もしない）。
 * 効果を足すときは、ここに項目を足し、場所の3D背景（userData.setEffects）で受け取る
 */
export const SCENE_EFFECT_IDS = ['fireworks', 'crowd'] as const;
export type SceneEffectId = (typeof SCENE_EFFECT_IDS)[number];
export const SceneEffects = z.strictObject({
  /** 花火（夏祭り）。止めると新しく上げず、上がっている花火は消えるまで残る。どこでも指定がなければ上がり続ける */
  fireworks: z.boolean().optional(),
  /** 群衆（場所の stage.crowd があるところ）。淡い色のモブを並べる。どこでも指定がなければ出す */
  crowd: z.boolean().optional(),
});
export type SceneEffects = z.infer<typeof SceneEffects>;

/** 舞台に立てる 2D のデフォルメ画像（描画に渡す形） */
export interface StageSprite {
  frames: string[];
  fps: number;
  playback: 'once' | 'loop' | 'pingpong';
  /** 高さ（メートル） */
  height: number;
}

/** 舞台に出すキャラ1人分（描画に渡す形） */
export interface StageCastMember {
  id: string;
  /** sprite があるときは空 */
  modelUrl: string;
  /** 2D のデフォルメ画像。あれば 3D のモデルは出さない */
  sprite?: StageSprite;
  /** 立ち位置の座標。省略時は slot から、場所の設定（または既定）の位置を使う */
  position?: [number, number, number];
  slot?: 'left' | 'center' | 'right';
  /** 省略時は横に立つほど少し内側を向く */
  rotationY?: number;
  expression: string;
  expressionWeight: number;
  motion?: string;
  motionLoop: boolean;
  /** モーションを指定したシーン（変わったら同じモーションでも再生し直す） */
  motionCue?: string;
  /** 視線の先（player / camera / partner / speaker / forward / キャラ ID）。なければ正面のまま */
  lookAtTarget?: string;
  /** 顔の向きを視線の先へどれだけ向けるか（0〜1） */
  headTurn?: number;
  /** 顔・体の演出（指定を変えるまで続く）。省略時は何もしない */
  look?: AvatarLook;
  /** 日なたの明るさ（窓の外の人物など） */
  daylight?: number;
  /** 雨で濡れた具合（0〜1） */
  wet?: number;
  /** 手に持つ小物（hand を省略したら小物ごとの既定の手） */
  heldItem?: { item: string; hand?: 'left' | 'right' };
}

/** 顔・体の演出の状態 */
export interface AvatarLook {
  blush: boolean;
  /** 赤面・涙目・あわあわ口（省略は false） */
  redface?: boolean;
  tearyEyes?: boolean;
  awawaMouth?: boolean;
  /** 涙目で目尻の涙の粒を出すか（キャラの設定。省略は出す） */
  tearDrops?: boolean;
  anger: boolean;
  tears: boolean;
  /** 顔に汗のテクスチャを重ねる（今はビューアの試し用で、シナリオからは指定できない） */
  faceSweat?: boolean;
  /** 目が泳ぐ強さ（0 で止まる） */
  eyeWander: number;
  fastMotion: boolean;
  motionSpeed: number;
}

export const DEFAULT_AVATAR_LOOK: AvatarLook = { blush: false, anger: false, tears: false, eyeWander: 0, fastMotion: false, motionSpeed: 1 };

/** 1回だけ出す演出（文字演出・汗）。key はカット内で同じ演出を二重に出さないための識別子 */
export interface AvatarOneShot {
  id: string;
  at: number;
  key: string;
  effectText?: EffectText;
  sweat?: SweatMode;
}

/** 流れる背景（描画に渡す形。省略項目は既定値で埋めたもの） */
export interface ScrollingBackgroundSettings {
  textureUrl: string;
  speed: number;
  blur: number;
  direction: 'left' | 'right';
  featherWidth: number;
}

/** カット内のある時刻のキャラの状態（タイムラインのキーフレームで上書きされた項目だけ） */
export interface CutAvatarState {
  expression?: string;
  expressionWeight?: number;
  motion?: string;
  motionLoop?: boolean;
  /** 今のモーションを始めた時刻（頭出しでモーションの途中から再生するため） */
  motionAt?: number;
  lookAtTarget?: string;
  headTurn?: number;
  visible?: boolean;
  blush?: boolean;
  redface?: boolean;
  tearyEyes?: boolean;
  awawaMouth?: boolean;
  anger?: boolean;
  tears?: boolean;
  eyeWander?: number;
  motionSpeed?: number;
  /** 移動（at から duration 秒で to へ）と退場（at から duration 秒で透明になる） */
  move?: { at: number; to: [number, number, number]; duration: number };
  fadeOut?: { at: number; duration: number };
}

/** 秒数・大きさを埋めたカメラの動きと、動き始める時刻 */
export interface ResolvedCameraMove {
  type: CameraMoveType;
  duration: number;
  amount: number;
  at: number;
}

/** カット内のある時刻のカメラ（キーフレームで切り替えた構図・直接指定） */
export interface CutCameraState {
  shot?: CameraShot;
  /** 構図を切り替えたキーのずらし（省略で真ん中） */
  shift?: CameraShift;
  pose?: CameraPose;
  /** 切り替えた時刻と、動かすのにかける秒数 */
  at?: number;
  duration?: number;
  /** 今のカメラの動き（カットの指定、またはキーで始めた動き） */
  move?: ResolvedCameraMove;
}

/** カット内のある時刻の状態 */
export interface CutState {
  avatars: Record<string, CutAvatarState>;
  camera: CutCameraState;
  focusLines: boolean;
  /** 時刻 t までに出す1回きりの演出（カットの指定は at 0） */
  oneShots: AvatarOneShot[];
}

/** カット1つ分（StageManager.setCutTimeline に渡す形）。stateAt はカット内の時刻 t の状態を返す */
export interface CutTimeline {
  stateAt: (t: number) => CutState;
  /** カットの頭の切り替え演出 */
  screenTransition?: ScreenTransition;
  /** カメラを構図から上下左右へずらす位置 */
  cameraShift?: CameraShift;
  /** 心の声か（話者がいても、ボイスで口を動かさない） */
  innerVoice?: boolean;
}
