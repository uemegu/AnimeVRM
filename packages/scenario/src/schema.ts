/**
 * シナリオ JSON（assets/scenarios/<category>/<id>/scenario.json）のスキーマ。
 * 通常のシナリオ・夜の電話・夜のメールの3種類がある。
 *
 * 場所・時間帯・BGM・モーションなどの ID はマスターデータ側で管理するので、ここでは文字列として受け付ける。
 * ID が実在するかどうかはマスターデータと突き合わせて別に確かめる。
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

export const FlagValue = z.union([z.boolean(), z.number(), z.string()]);
export const FlagMap = z.record(z.string(), FlagValue);
/** キャラ ID → 好感度の加算値 */
export const AffinityMap = z.record(z.string(), z.number());

export const Vec2 = z.tuple([z.number(), z.number()]);
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** キャラクターの立ち位置スロット */
export const AvatarSlotPosition = z.enum(['left', 'right', 'center']);
export type AvatarSlotPosition = z.infer<typeof AvatarSlotPosition>;

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

/** 'player' | 'speaker' | 'partner' | 'camera' | 'forward' またはキャラ ID */
const LookAtTarget = z.string();

/** カメラの位置・注視点・画角を直接指定する（構図の自動決定より優先） */
export const CameraPose = z.strictObject({
  position: Vec3,
  target: Vec3,
  fov: z.number().min(10).max(90).optional(),
});
export type CameraPose = z.infer<typeof CameraPose>;

/** 表情（VRM の標準の表情） */
export const Expression = z.enum(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'nima', 'komari']);
export type Expression = z.infer<typeof Expression>;

/** 顔の向きを視線の先へどれだけ向けるか（0 = 目だけ、1 = 顔も大きく向ける） */
const HeadTurn = z.number().min(0).max(1);

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

/** 音を鳴らすチャネル（stereo はそのまま。left / right は片側だけから鳴らす） */
export const AudioPan = z.enum(['stereo', 'left', 'right']);
export type AudioPan = z.infer<typeof AudioPan>;
/** 音量の倍率（既定の音量に掛ける。省略時は 1） */
export const AudioVolume = z.number().min(0).max(1);

/** 目が泳ぐ（true または強さ 0〜2。false・0 で止める） */
const EyeWander = z.union([z.boolean(), z.number().min(0).max(2)]);

/**
 * 顔・体の演出。一度指定すると、次に指定を変えるまで続く
 */
const AvatarLookFields = {
  /** 頬を赤らめる（目も潤む） */
  blush: z.boolean().optional(),
  /** 怒りマーク */
  anger: z.boolean().optional(),
  /** 涙を流す */
  tears: z.boolean().optional(),
  eyeWander: EyeWander.optional(),
  /** モーションの再生速度（1 が通常） */
  motionSpeed: z.number().positive().max(4).optional(),
};

/** そのカット（キー）で1回だけ出す演出 */
const AvatarOneShotFields = {
  /** 漫画風の文字演出 */
  effectText: EffectText.optional(),
  /** 汗の演出 */
  sweat: SweatMode.optional(),
};

/** セリフ途中の移動・退場（at から始まる。モーションは別に motion で指定する） */
const AvatarMoveFields = {
  /** この座標まで一定の速さで移動する（進行方向を向く。走って去る・歩いてくるなど） */
  moveTo: Vec3.optional(),
  /** moveTo にかける秒数（省略時 1） */
  moveDuration: z.number().positive().optional(),
  /** この秒数かけて透明になり、消える（去っていくキャラを画面から消すとき） */
  fadeOut: z.number().positive().optional(),
};

/** セリフ途中のアバター演出（表情・モーション・視線など）。at はボイス再生位置またはシーン経過秒 */
export const AvatarTransition = z.strictObject({
  at: z.number().nonnegative(),
  expression: Expression.optional(),
  expressionWeight: z.number().min(0).max(1).optional(),
  motion: z.string().optional(),
  motionLoop: z.boolean().optional(),
  lookAtTarget: LookAtTarget.optional(),
  headTurn: HeadTurn.optional(),
  visible: z.boolean().optional(),
  ...AvatarLookFields,
  ...AvatarOneShotFields,
  ...AvatarMoveFields,
});
export type AvatarTransition = z.infer<typeof AvatarTransition>;

/** セリフ途中のシーン全体の演出（カメラ・集中線） */
export const SceneTransition = z.strictObject({
  at: z.number().nonnegative(),
  /** この時刻から構図を切り替える */
  camera: CameraShot.optional(),
  /** 切り替えた構図からカメラをずらす（省略で真ん中） */
  cameraShift: CameraShift.optional(),
  /** この時刻からカメラを直接指定の位置へ動かす（移動にかける秒数は cameraTransitionDuration） */
  cameraPose: CameraPose.optional(),
  cameraTransitionDuration: z.number().nonnegative().optional(),
  /** この時刻から集中線を出す・消す */
  focusLines: z.boolean().optional(),
});
export type SceneTransition = z.infer<typeof SceneTransition>;

/** シーン内のアバター指定。前のシーンの指定を引き継ぎ、書いた項目だけ上書きする（effectText・sweat はそのシーンだけ） */
export const SceneAvatarConfig = z.strictObject({
  /** 省略時はキー名をキャラ ID として使う */
  characterId: z.string().optional(),
  /** assets/animations/<motion>.fbx */
  motion: z.string().optional(),
  motionLoop: z.boolean().optional(),
  modelUrl: z.string().optional(),
  /** 3D の代わりに、キャラの 2D デフォルメ画像（characters.json の sprites の key）を立てる。表情・モーション・視線は使わない */
  sprite: z.union([z.string(), z.literal(false)]).optional(),
  /** sprite の高さ（メートル。省略時はキャラの設定） */
  spriteHeight: z.number().positive().optional(),
  expression: Expression.optional(),
  /** 原則 1.0 または 0.0 */
  expressionWeight: z.number().min(0).max(1).optional(),
  position: z.union([AvatarSlotPosition, Vec3]).optional(),
  rotationY: z.number().optional(),
  lookAtTarget: LookAtTarget.optional(),
  headTurn: HeadTurn.optional(),
  visible: z.boolean().optional(),
  /** 速い動きに残像とスピード線をつける */
  fastMotion: z.boolean().optional(),
  /** 日なたの明るさ（暗い店内から見た窓の外の人物など。0 で室内の光だけ、1 を超えると白く飛ぶ） */
  daylight: z.number().min(0).max(3).optional(),
  ...AvatarLookFields,
  ...AvatarOneShotFields,
  transitions: z.array(AvatarTransition).optional(),
});
export type SceneAvatarConfig = z.infer<typeof SceneAvatarConfig>;

/** 画面の切り替え演出（fade_black = 暗転してから映す、eyelid_close = 瞼を閉じるように暗くなる、eyelid_blink = まばたき） */
export const ScreenTransition = z.enum(['fade_black', 'eyelid_close', 'eyelid_blink']);
export type ScreenTransition = z.infer<typeof ScreenTransition>;

export const ScenarioChoice = z.strictObject({
  /** 履歴条件から参照する ID（省略時は goto 先のシーン ID） */
  id: z.string().optional(),
  text: TextContent,
  goto: z.string(),
  setFlags: FlagMap.optional(),
  addAffinity: AffinityMap.optional(),
  /** 指定フラグが一致するときだけ表示する */
  condition: z.strictObject({ flag: z.string(), value: FlagValue }).optional(),
});
export type ScenarioChoice = z.infer<typeof ScenarioChoice>;

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

/** シーン（1セリフまたは1演出ステップ） */
export const ScenarioScene = z.strictObject({
  id: z.string().min(1),
  speaker: TextContent.optional(),
  speakerCharacterId: z.string().optional(),
  /** 選択肢のあるシーンでは空文字にする（開発ルール） */
  text: TextContent,
  /** '/' で始まらなければシナリオのディレクトリからの相対パス */
  voiceUrl: z.string().optional(),
  /** @deprecated 旧データの読み込み用。開口度は音声解析で決まり、この指定は使わない */
  voiceWhisper: z.boolean().optional(),
  /** ボイスの音量の倍率 */
  voiceVolume: AudioVolume.optional(),
  /** ボイスを鳴らすチャネル（省略時は stereo） */
  voicePan: AudioPan.optional(),
  /** 場所のプリセット ID または画像 URL */
  background: z.string().optional(),
  /** BGM の ID または URL */
  bgm: z.string().optional(),
  /** @deprecated bgm を使う */
  bgmUrl: z.string().optional(),
  /** BGM の音量の倍率（bgm.json の volumeScale にさらに掛ける）。BGM が変わるまで引き継ぐ */
  bgmVolume: AudioVolume.optional(),
  /** BGM を鳴らすチャネル。BGM が変わるまで引き継ぐ */
  bgmPan: AudioPan.optional(),
  /** シーンの始めに1回鳴らす効果音 */
  seUrl: z.string().optional(),
  /** 効果音の音量の倍率 */
  seVolume: AudioVolume.optional(),
  /** 効果音を鳴らすチャネル（省略時は stereo） */
  sePan: AudioPan.optional(),
  /** 特殊効果（花火など）。true でこのシーンから始め、false で止める。効果ごとに以降のシーンに引き継ぐ */
  effects: SceneEffects.optional(),
  /** 環境音（ループ。セミの声・足音など）。以降のシーンに引き継ぎ、false で止める */
  ambience: z.union([z.string(), z.literal(false)]).optional(),
  avatars: z.record(z.string(), SceneAvatarConfig).optional(),
  /** 省略時は配列の次のシーンへ進む */
  nextSceneId: z.string().optional(),
  /** true ならこのシーンのあとシナリオを終える（分岐したルートの最後など） */
  end: z.literal(true).optional(),
  choices: z.array(ScenarioChoice).optional(),
  setFlags: FlagMap.optional(),
  flashEffect: z.enum(['white', 'none']).optional(),
  /** このカットの画面の切り替え演出 */
  screenTransition: ScreenTransition.optional(),
  /** このカットの間、集中線を出す */
  focusLines: z.boolean().optional(),
  /** オートで進むまでの待ち秒数。ムービーではボイス・最後のキーが終わってから次のカットまでの間 */
  autoNextSec: z.number().nonnegative().optional(),
  /** ムービーでのカットの長さ（秒）。指定するとボイスやキーを待たずにこの秒数で次へ進む */
  duration: z.number().positive().optional(),
  timeOfDay: z.string().optional(),
  transitions: z.array(SceneTransition).optional(),
  camera: CameraShot.optional(),
  /** 構図からカメラを上下左右へずらす（省略で真ん中） */
  cameraShift: CameraShift.optional(),
  /** カメラを直接指定する（camera の構図より優先。このカットだけに効く） */
  cameraPose: CameraPose.optional(),
  /** true なら前のシーンの登場キャラを全員下げてから avatars を適用する */
  clearCast: z.boolean().optional(),
  /** 以降のシーンに引き継ぐ。false で止めて通常の背景に戻す */
  scrollingBackground: z.union([ScrollingBackgroundConfig, z.literal(false)]).optional(),
  /** 選択肢の制限時間。省略時は10秒で1番目を自動選択 */
  choiceTimeout: z
    .strictObject({
      seconds: z.number().positive(),
      goto: z.string().optional(),
      setFlags: FlagMap.optional(),
    })
    .optional(),
});
export type ScenarioScene = z.infer<typeof ScenarioScene>;

/** 先行シナリオ（choiceId 指定時はその選択肢を選んだこと、省略時は完了） */
export const ScenarioPrerequisite = z.strictObject({
  scenarioId: z.string(),
  choiceId: z.string().optional(),
});

/** 発生条件。項目間は AND、配列の中身は項目ごとの説明に従う */
export const ScenarioAvailability = z.strictObject({
  /** all 内は AND、any 内は OR */
  after: z
    .strictObject({
      all: z.array(ScenarioPrerequisite).optional(),
      any: z.array(ScenarioPrerequisite).optional(),
    })
    .optional(),
  /** いずれかに一致すれば発生（'morning' | 'afternoon' | 'afterschool' | 'holiday'） */
  timeSlots: z.array(z.string()).optional(),
  /** 両端を含む日の範囲 */
  dayRange: z
    .strictObject({ from: z.number().int().min(1).optional(), to: z.number().int().min(1).optional() })
    .optional(),
  /** いずれかの場所で発生 */
  locations: z.array(z.string()).optional(),
  /** すべて立っていれば発生 */
  requireFlags: z.array(z.string()).optional(),
  /** いずれかが立っていれば発生しない */
  unlessFlags: z.array(z.string()).optional(),
  /** 好感度の下限（すべて満たすこと） */
  minAffinity: AffinityMap.optional(),
  /** 好感度の上限（値より小さいこと） */
  maxAffinity: AffinityMap.optional(),
});
export type ScenarioAvailability = z.infer<typeof ScenarioAvailability>;

/** 行動ターンでの場所のヒント */
export const ActionLocationHint = z.strictObject({
  locationId: z.string(),
  hintCharacterIds: z.array(z.string()).optional(),
  hintText: LocalizedString.optional(),
  /** 省略時はその場所の全行動フェーズ */
  phases: z.array(z.string()).optional(),
});

/**
 * 再生のしかた
 * - game: メッセージウィンドウつき。クリックで進み、選択肢を選ぶ
 * - movie: メッセージウィンドウを出さず、カットが自動で進む（選択肢は出さず、時間切れと同じ扱いで進む）
 */
export const PlayMode = z.enum(['game', 'movie']);
export type PlayMode = z.infer<typeof PlayMode>;

/** 通常シナリオ（scenario.json の中身） */
export const ScenarioPackage = z.strictObject({
  /** 形式の版。省略時は 1 */
  schemaVersion: z.literal(1).optional(),
  id: z.string().min(1),
  title: TextContent,
  /** 省略時は game */
  playMode: PlayMode.optional(),
  /** 一覧に出す紹介文 */
  description: TextContent.optional(),
  /** 舞台の場所。場所選択を経ずに始まるシナリオの背景に使う */
  location: z.string().optional(),
  /** 条件に合うシナリオが他にないときだけ選ばれる汎用シナリオ */
  fallback: z.boolean().optional(),
  /** その時間帯の行動を使い切る（終わったら次の時間帯へ） */
  consumesTurn: z.boolean().optional(),
  availability: ScenarioAvailability.optional(),
  /** 条件が重なったとき大きいものを優先 */
  priority: z.number().optional(),
  actionHints: z.array(ActionLocationHint).optional(),
  /** 開始時の BGM（ID または URL。'silence' で無音） */
  bgm: z.string().optional(),
  /** 開始時の環境音（ループ） */
  ambience: z.string().optional(),
  timeOfDay: z.string().optional(),
  characters: z
    .array(
      z.strictObject({
        id: z.string(),
        modelUrl: z.string(),
        initialPosition: AvatarSlotPosition.optional(),
      })
    )
    .optional(),
  scenes: z.array(ScenarioScene).min(1),
});
export type ScenarioPackage = z.infer<typeof ScenarioPackage>;

/** 夜の電話・メールの共通項目 */
const CommunicationMeta = {
  schemaVersion: z.literal(1).optional(),
  id: z.string().min(1),
  characterId: z.string(),
  title: TextContent,
  /** 日付範囲・フラグ・先行シナリオなど。時間帯と場所は使わない */
  availability: ScenarioAvailability.optional(),
  priority: z.number().optional(),
};

export const CallChoice = z.strictObject({
  id: z.string(),
  text: TextContent,
  goto: z.string(),
  setFlags: FlagMap.optional(),
  addAffinity: AffinityMap.optional(),
});

export const CallSceneStep = z.strictObject({
  id: z.string(),
  speaker: TextContent,
  text: TextContent,
  expression: Expression.optional(),
  expressionWeight: z.number().min(0).max(1).optional(),
  motion: z.string().optional(),
  choices: z.array(CallChoice).optional(),
  /** null なら通話終了 */
  nextStepId: z.string().nullable().optional(),
  voiceUrl: z.string().optional(),
  /** @deprecated 旧データの読み込み用。開口度は音声解析で決まり、この指定は使わない */
  voiceWhisper: z.boolean().optional(),
});

/** 夜の TV 電話 */
export const CallScenario = z.strictObject({
  ...CommunicationMeta,
  modelUrl: z.string().optional(),
  initialStepId: z.string(),
  steps: z.record(z.string(), CallSceneStep),
});
export type CallScenario = z.infer<typeof CallScenario>;

export const MailMessage = z.strictObject({
  id: z.string(),
  sender: z.enum(['heroine', 'player']),
  text: TextContent,
  time: z.string(),
});

export const MailReplyOption = z.strictObject({
  id: z.string(),
  text: TextContent,
  reactionText: TextContent,
  reactionTime: z.string().optional(),
  setFlags: FlagMap.optional(),
  addAffinity: AffinityMap.optional(),
});

/** 夜のメール */
export const MailScenario = z.strictObject({
  ...CommunicationMeta,
  /** 通知カードに出す本文プレビュー */
  previewText: TextContent,
  /** 通知カードに出す受信時刻 */
  time: z.string(),
  messages: z.array(MailMessage),
  replyOptions: z.array(MailReplyOption).optional(),
});
export type MailScenario = z.infer<typeof MailScenario>;

/** シナリオの種類（assets/scenarios/<category>/ のディレクトリ名）。demo はゲーム本編に出ない演出の見本（Pages で再生する） */
export const ScenarioCategory = z.enum(['morning', 'action', 'holiday', 'forced', 'ending', 'special', 'call', 'mail', 'demo']);
export type ScenarioCategory = z.infer<typeof ScenarioCategory>;

/** 種類に応じたスキーマ */
export function schemaForCategory(category: ScenarioCategory) {
  if (category === 'call') return CallScenario;
  if (category === 'mail') return MailScenario;
  return ScenarioPackage;
}
