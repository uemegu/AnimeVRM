import { ScenarioPackage } from './types';
import { Language } from '../i18n';
import { getFiveSecondsConfessionPvScenario } from './fiveSecondsConfessionPvScenario';
import { getRooftopNapScenario } from './rooftopNapScenario';
import { getParkConfessionScenario } from './parkConfessionScenario';
import { getTwoGirlsConversationScenario } from './twoGirlsConversationScenario';
import { getTrioConversationScenario } from './trioConversationScenario';
import { getHaremConversationScenario } from './haremScenario';
import { getTownWalkScenario } from './townWalkScenario';
import { getBehindYouScenario } from './behindYouScenario';
import { getNisaScenario } from './nisaScenario';
import { getFastMotionScenario } from './fastMotionScenario';
import { getDoorPeepYandereScenario } from './doorPeepYandereScenario';
import { getPrivateDateScenario } from './privateDateScenario';
import { GHOST_MASS_SCENARIO } from './ghostMassScenario';
import { getTeacherGateScenario } from './teacherGateScenario';
import { getSilverWeekScenario } from './silverWeekScenario';
import { getGestureBattleScenario } from './gestureBattleScenario';

export interface ScenarioMeta {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  ogpImage: string;
  getScenario: (lang?: Language) => ScenarioPackage;
  playOptions?: {
    withInterlude?: boolean;
    interludeTitle?: string;
    interludeSubtitle?: string;
  };
}

export const SCENARIO_REGISTRY: Record<string, ScenarioMeta> = {
  'five-seconds-pv': {
    id: 'five-seconds-pv',
    title: '【PV】5秒の告白 〜5 Seconds Confession〜',
    shortTitle: '5秒の告白 PV',
    description: 'たった5秒の勇気で、世界は変わる。楽曲と完全同期するAnimeVRMオリジナル短編アニメーションPV。',
    ogpImage: '/ogp/five-seconds-pv.png',
    getScenario: () => getFiveSecondsConfessionPvScenario(),
    playOptions: {
      withInterlude: true,
      interludeTitle: '5秒の告白',
      interludeSubtitle: '5 SECONDS CONFESSION - OFFICIAL PV -',
    },
  },
  'rooftop-nap': {
    id: 'rooftop-nap',
    title: '屋上の昼寝と、覗き込みハプニング',
    shortTitle: '屋上の昼寝',
    description: 'ぽかぽか陽気の屋上で居眠りしていたら……？アオイの覗き込みドキドキショートストーリー。',
    ogpImage: '/ogp/rooftop-nap.png',
    getScenario: (lang = 'ja') => getRooftopNapScenario(lang),
  },
  'park-confession': {
    id: 'park-confession',
    title: '夕暮れの公園と放課後の期待',
    shortTitle: '夕暮れの公園',
    description: '夕暮れの公園に呼び出されたあなた。茜色に染まる並木道で、アオイが伝えたかった想いとは――。',
    ogpImage: '/ogp/park-confession.png',
    getScenario: (lang = 'ja') => getParkConfessionScenario(lang),
  },
  'two-girls': {
    id: 'two-girls',
    title: '放課後の寄り道〜アオイとエミリ〜',
    shortTitle: '放課後の寄り道',
    description: 'アオイとエミリの放課後カフェトーク。2人の掛け合いを楽しめるインタラクティブシナリオ。',
    ogpImage: '/ogp/two-girls.png',
    getScenario: (lang = 'ja') => getTwoGirlsConversationScenario(lang),
  },
  'trio': {
    id: 'trio',
    title: '放課後トライアングル〜アオイとエミリとあなた〜',
    shortTitle: '放課後トライアングル',
    description: 'アオイとエミリとあなたの3人。放課後どこに行くかをめぐるドキドキ作戦会議！',
    ogpImage: '/ogp/trio.png',
    getScenario: (lang = 'ja') => getTrioConversationScenario(lang),
  },
  'harem': {
    id: 'harem',
    title: '放課後大波乱!? 一体誰が本命なのよ〜！',
    shortTitle: '本命決着裁判',
    description: '4人のヒロインが勢揃い！修羅場と選択肢が待ち受けるマルチキャラクター裁判シナリオ。',
    ogpImage: '/ogp/harem.png',
    getScenario: (lang = 'ja') => getHaremConversationScenario(lang),
  },
  'town-walk': {
    id: 'town-walk',
    title: '放課後の並木道 〜君と歩く帰り道〜',
    shortTitle: '放課後の並木道',
    description: '放課後の美しい並木道をアオイと一緒に歩く、臨場感あふれるスクロール背景シナリオ。',
    ogpImage: '/ogp/town-walk.png',
    getScenario: (lang = 'ja') => getTownWalkScenario(lang),
  },
  'behind-you': {
    id: 'behind-you',
    title: '噂話は背後にご注意〜教室の秘密〜',
    shortTitle: '背後にご注意',
    description: '放課後の教室で噂話をしていたら……真後ろに気配が！？360度パノラマ視点シナリオ。',
    ogpImage: '/ogp/behind-you.png',
    getScenario: (lang = 'ja') => getBehindYouScenario(lang),
  },
  'nisa': {
    id: 'nisa',
    title: '夕暮れの校門とオルカンの憂鬱',
    shortTitle: 'オルカンの憂鬱',
    description: '夕暮れの校門前で繰り広げられる、全力で真面目な新NISA・全世界株式インデックス投資相談ストーリー。',
    ogpImage: '/ogp/nisa.png',
    getScenario: (lang = 'ja') => getNisaScenario(lang),
  },
  'fast-motion': {
    id: 'fast-motion',
    title: '疾風怒濤！高速アクション特訓',
    shortTitle: '高速アクション特訓',
    description: 'アニメ作画風の残像やスピードリボン、ダイナミックブラーを駆使した高速アクション演出。',
    ogpImage: '/ogp/fast-motion.png',
    getScenario: (lang = 'ja') => getFastMotionScenario(lang),
  },
  'door-peep': {
    id: 'door-peep',
    title: '🚪 覗き穴の訪問者〜深夜のヤンデレ〜',
    shortTitle: '覗き穴の訪問者',
    description: '深夜に響くインターホン……ドアスコープを覗くとそこに立っていたのは？魚眼レンズホラー演出。',
    ogpImage: '/ogp/door-peep.png',
    getScenario: (lang = 'ja') => getDoorPeepYandereScenario(lang),
  },
  'private-date': {
    id: 'private-date',
    title: '休日デート〜私服のエミリと街歩き〜',
    shortTitle: '休日デート',
    description: '休日に私服のエミリと待ち合わせ。カフェテラスでの特別なひとときを過ごすデートシナリオ。',
    ogpImage: '/ogp/private-date.png',
    getScenario: (lang = 'ja') => getPrivateDateScenario(lang),
  },
  'ghost-mass': {
    id: 'ghost-mass',
    title: '👻 幽霊の質量（シャフト風）',
    shortTitle: '幽霊の質量',
    description: '単色キャラクター・白輪郭・ローポリ教室・赤緑カットイン・シャフ度を散りばめたシャフト風演出シナリオ。',
    ogpImage: '/ogp/ghost-mass.png',
    getScenario: () => GHOST_MASS_SCENARIO,
  },
  'teacher-gate': {
    id: 'teacher-gate',
    title: '校門の邂逅 〜シオンと桐島先生の秘密の推し〜',
    shortTitle: '校門の邂逅',
    description: '眠そうに登校するシオンと校門で待ち受けるクールな桐島先生。2人がまさかのニッチな古生物トークで意気投合！？',
    ogpImage: '/ogp/teacher-gate.png',
    getScenario: (lang = 'ja') => getTeacherGateScenario(lang),
  },
  'silver-week': {
    id: 'silver-week',
    title: 'シルバーウィークの黄昏 〜アオイとエミリの帰り道〜',
    shortTitle: 'シルバーウィークの黄昏',
    description: '連休最終日の夕暮れ。私服のアオイとエミリが街を歩きながら、名残惜しそうに語り合うショートシナリオ。',
    ogpImage: '/ogp/silver-week.png',
    getScenario: (lang = 'ja') => getSilverWeekScenario(lang),
  },
  'gesture-battle': {
    id: 'gesture-battle',
    title: '放課後全力ジェスチャー！ 〜アオイとエミリの表現力バトル〜',
    shortTitle: '放課後ジェスチャーバトル',
    description: 'アオイとエミリが昼の校門前で全身ジェスチャー対決！ひらめき、歓喜、おねだり、ツッコミが炸裂する多彩なモーションシナリオ。',
    ogpImage: '/ogp/silver-week.png',
    getScenario: (lang = 'ja') => getGestureBattleScenario(lang),
  },
};

export function getScenarioMeta(id: string): ScenarioMeta | undefined {
  return SCENARIO_REGISTRY[id];
}
