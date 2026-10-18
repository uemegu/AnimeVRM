/**
 * シナリオ JSON（assets/scenarios/<category>/<id>/scenario.json）のスキーマ。
 * 通常のシナリオ・夜の電話・夜のメールの3種類がある。
 *
 * 場所・時間帯・BGM・モーションなどの ID はマスターデータ側で管理するので、ここでは文字列として受け付ける。
 * ID が実在するかどうかはマスターデータと突き合わせて別に確かめる。
 */
import { z } from 'zod';
import {
  CameraMove,
  CameraPose,
  CameraShift,
  CameraShot,
  CutinConfig,
  EffectText,
  LocalizedString,
  SceneEffects,
  ScreenTransition,
  ScrollingBackgroundConfig,
  StillImageConfig,
  SweatMode,
  TextContent,
  Vec3,
} from '@anime-vrm/engine/schema/stage';

// カメラ・演出・一枚絵など舞台に渡す部分は engine の schema/stage.ts を使う
export * from '@anime-vrm/engine/schema/stage';

/** 心の声（全角かっこで囲んだセリフ）か。話者がいても口を動かさない */
export function isInnerVoice(text: TextContent | undefined): boolean {
  const s = (typeof text === 'string' ? text : text?.ja ?? '').trim();
  return s.startsWith('（') && s.endsWith('）');
}

export const FlagValue = z.union([z.boolean(), z.number(), z.string()]);
export const FlagMap = z.record(z.string(), FlagValue);
/** キャラ ID → 好感度の加算値 */
export const AffinityMap = z.record(z.string(), z.number());

export const Vec2 = z.tuple([z.number(), z.number()]);

/** キャラクターの立ち位置スロット */
export const AvatarSlotPosition = z.enum(['left', 'right', 'center']);
export type AvatarSlotPosition = z.infer<typeof AvatarSlotPosition>;

/** 'player' | 'speaker' | 'partner' | 'camera' | 'forward' またはキャラ ID */
const LookAtTarget = z.string();

/** 表情（VRM の標準の表情） */
export const Expression = z.enum(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'nima', 'komari']);
export type Expression = z.infer<typeof Expression>;

/** 顔の向きを視線の先へどれだけ向けるか（0 = 目だけ、1 = 顔も大きく向ける） */
const HeadTurn = z.number().min(0).max(1);

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
  /** 赤面（blush より濃く広い。強い反応のとき） */
  redface: z.boolean().optional(),
  /** 涙目（目が潤み、目尻に涙の粒がたまる） */
  tearyEyes: z.boolean().optional(),
  /** あわあわ口（波打つ大きな口。板なので正面を向いた構図で使う）。赤面・涙目と組み合わせると泣き叫ぶ顔になる */
  awawaMouth: z.boolean().optional(),
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
  /** この時刻から寄る相手を替える（キャラ ID。省略で話者） */
  cameraFocus: z.string().optional(),
  /** 肩越し（ots）の手前の人（キャラ ID。省略で寄る相手が見ている人・話者・一番近い人） */
  cameraOver: z.string().optional(),
  /** 切り替えた構図からカメラをずらす（省略で真ん中） */
  cameraShift: CameraShift.optional(),
  /** この時刻からカメラを直接指定の位置へ動かす（移動にかける秒数は cameraTransitionDuration） */
  cameraPose: CameraPose.optional(),
  cameraTransitionDuration: z.number().nonnegative().optional(),
  /** この時刻からカメラを動かす（false で止める。構図を切り替えて動きを書かないときも止まる） */
  cameraMove: z.union([CameraMove, z.literal(false)]).optional(),
  /** この時刻から集中線を出す・消す */
  focusLines: z.boolean().optional(),
});
export type SceneTransition = z.infer<typeof SceneTransition>;

/**
 * 手に持つ小物（形と持ち方はエンジンの heldItem.ts）。
 * 缶・紙パックは片手で握る、スマホは手のひらに沿わせる、本は両手で開いて持つ、ノートは胸に抱える
 */
export const HeldItemId = z.enum(['can_coffee', 'can_juice', 'carton_ichigo', 'phone', 'book_open', 'book', 'notebook']);
export type HeldItemId = z.infer<typeof HeldItemId>;

/** 小物の指定。文字列は小物の ID だけ（持つ手は小物ごとの既定）。false で手放す */
export const HeldItemConfig = z.union([
  HeldItemId,
  z.literal(false),
  z.strictObject({ item: HeldItemId, hand: z.enum(['left', 'right']).optional() }),
]);
export type HeldItemConfig = z.infer<typeof HeldItemConfig>;

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
  /** 雨で濡れた具合（0 = 乾いている、1 = ずぶ濡れ）。シャツが襟から裾へ濡れ（濡れた布越しに肌の色がうっすら出る）、あご・指先から水滴が落ちる。変えると数秒かけて濡れる */
  wet: z.number().min(0).max(1).optional(),
  /** 手に持つ小物。モーションを変えたシーンで指定がなければ手放す */
  heldItem: HeldItemConfig.optional(),
  ...AvatarLookFields,
  ...AvatarOneShotFields,
  transitions: z.array(AvatarTransition).optional(),
});
export type SceneAvatarConfig = z.infer<typeof SceneAvatarConfig>;

/**
 * 選択肢を出す条件（書いた項目すべてを満たすときだけ出す）。
 * ★の選択肢（その時点の好感度が基準以上のときだけ出る）は minAffinity で書く
 */
export const ChoiceCondition = z.strictObject({
  /** このフラグの値が value と一致する */
  flag: z.string().optional(),
  value: FlagValue.optional(),
  /** すべて立っている */
  requireFlags: z.array(z.string()).optional(),
  /** どれも立っていない */
  unlessFlags: z.array(z.string()).optional(),
  /** 好感度がそれぞれ値以上 */
  minAffinity: AffinityMap.optional(),
});
export type ChoiceCondition = z.infer<typeof ChoiceCondition>;

export const ScenarioChoice = z.strictObject({
  /** 履歴条件から参照する ID（省略時は goto 先のシーン ID） */
  id: z.string().optional(),
  text: TextContent,
  goto: z.string(),
  setFlags: FlagMap.optional(),
  addAffinity: AffinityMap.optional(),
  /** 条件を満たすときだけ表示する */
  condition: ChoiceCondition.optional(),
});
export type ScenarioChoice = z.infer<typeof ScenarioChoice>;

/** シーン（1セリフまたは1演出ステップ） */
export const ScenarioScene = z.strictObject({
  id: z.string().min(1),
  speaker: TextContent.optional(),
  speakerCharacterId: z.string().optional(),
  /** 選択肢のあるシーンでは空文字にする（開発ルール） */
  text: TextContent,
  /** この条件を満たさないときは、このシーンを飛ばして次へ進む（選んだ答えで一言だけ変える場合など） */
  condition: ChoiceCondition.optional(),
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
  /** 寄る相手（キャラ ID）。省略で話者。話者でない人の反応を撮るときに使う */
  cameraFocus: z.string().optional(),
  /** 肩越し（ots）の手前の人（キャラ ID）。省略で寄る相手が見ている人、いなければ話者、それもいなければ一番近い人 */
  cameraOver: z.string().optional(),
  /** 構図からカメラを上下左右へずらす（省略で真ん中） */
  cameraShift: CameraShift.optional(),
  /** カメラを直接指定する（camera の構図より優先。このカットだけに効く） */
  cameraPose: CameraPose.optional(),
  /** カットの頭からカメラを動かす（パン・ドリー・オービットなど） */
  cameraMove: CameraMove.optional(),
  /** true なら前のシーンの登場キャラを全員下げてから avatars を適用する */
  clearCast: z.boolean().optional(),
  /** 以降のシーンに引き継ぐ。false で止めて通常の背景に戻す */
  scrollingBackground: z.union([ScrollingBackgroundConfig, z.literal(false)]).optional(),
  /** 雨を降らせる（場所によらない画面の雨）。以降のシーンに引き継ぎ、false で止める */
  rain: z.boolean().optional(),
  /** 画面いっぱいの一枚絵（3D の舞台を覆う）。以降のシーンに引き継ぎ、false で消す */
  cg: z.union([z.string(), StillImageConfig, z.literal(false)]).optional(),
  /** 舞台の端に載せるカットインの絵。以降のシーンに引き継ぎ、false で消す */
  cutin: z.union([z.string(), CutinConfig, z.literal(false)]).optional(),
  /**
   * 条件に合う選択肢が1つもないときの扱い。
   * highest_affinity: minAffinity の条件を持つ選択肢のうち、そのキャラの好感度が最も高いもの1つだけを出す（ルート分岐）
   */
  choiceFallback: z.enum(['highest_affinity']).optional(),
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
  /** その日のうちに満たしたこと（「〜の日の夜」の電話・メール、電話の直後のメールなど） */
  sameDay: z.boolean().optional(),
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
  /** いずれかに一致すれば発生（'morning' | 'afternoon' | 'afterschool' | 'holiday' | 'evening'。evening は放課後の行動のあと、下校時の強制イベント） */
  timeSlots: z.array(z.string()).optional(),
  /** この日のどれかで発生（dayRange と併用すると両方を満たす日） */
  days: z.array(z.number().int().min(1)).optional(),
  /** 天気（'rain' = 雨の日。雨の日は app の暦で決まる） */
  weather: z.array(z.enum(['clear', 'rain'])).optional(),
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

/**
 * 画面の向き
 * - landscape: 横型（16:9）
 * - portrait: 縦型（9:16。ショート動画向け）
 */
export const ScreenAspect = z.enum(['landscape', 'portrait']);
export type ScreenAspect = z.infer<typeof ScreenAspect>;

/** 通常シナリオ（scenario.json の中身） */
export const ScenarioPackage = z.strictObject({
  /** 形式の版。省略時は 1 */
  schemaVersion: z.literal(1).optional(),
  id: z.string().min(1),
  title: TextContent,
  /** 省略時は game */
  playMode: PlayMode.optional(),
  /** 再生画面の向き。省略時は landscape（再生画面でも切り替えられる） */
  aspect: ScreenAspect.optional(),
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
  /** 条件を満たすときだけ表示する（★の選択肢など） */
  condition: ChoiceCondition.optional(),
});

export const CallSceneStep = z.strictObject({
  id: z.string(),
  speaker: TextContent,
  /** 話者のキャラ ID（電話の相手のほか、そばにいる人の声も）。口を動かすのは電話の相手のときだけ */
  speakerCharacterId: z.string().optional(),
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
  /** 音声のみの通話（相手の姿を映さない） */
  audioOnly: z.boolean().optional(),
  initialStepId: z.string(),
  steps: z.record(z.string(), CallSceneStep),
});
export type CallScenario = z.infer<typeof CallScenario>;

/** メールの吹き出しの中身（本文・スタンプ・写真のどれか1つ以上） */
const MailContentFields = {
  text: TextContent.optional(),
  /** スタンプの画像（'/' 始まりは assets/ 基準。例: /stamps/aoi/rabbit_bow.avif） */
  stamp: z.string().optional(),
  /** 写真の画像 */
  image: z.string().optional(),
  /** 届いてからこの秒数で「送信を取り消しました」に変わる（誤爆の取り消し） */
  retractAfterSec: z.number().positive().optional(),
};
const hasMailContent = (m: { text?: unknown; stamp?: unknown; image?: unknown }) =>
  m.text !== undefined || m.stamp !== undefined || m.image !== undefined;

export const MailMessage = z
  .strictObject({
    id: z.string(),
    sender: z.enum(['heroine', 'player']),
    ...MailContentFields,
    time: z.string(),
  })
  .refine(hasMailContent, { message: 'text・stamp・image のどれかが必要です' });
export type MailMessage = z.infer<typeof MailMessage>;

/** 返信のあとに相手から届くメッセージ */
export const MailReaction = z
  .strictObject({ ...MailContentFields, time: z.string().optional() })
  .refine(hasMailContent, { message: 'text・stamp・image のどれかが必要です' });

export const MailReplyOption = z
  .strictObject({
    id: z.string(),
    text: TextContent,
    /** 返信への反応（1通）。複数届くときは reactions。どちらもなければ既読のまま */
    reactionText: TextContent.optional(),
    reactionTime: z.string().optional(),
    /** 返信への反応（順に届く。スタンプ・写真も送れる） */
    reactions: z.array(MailReaction).optional(),
    setFlags: FlagMap.optional(),
    addAffinity: AffinityMap.optional(),
    /** 条件を満たすときだけ表示する */
    condition: ChoiceCondition.optional(),
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
