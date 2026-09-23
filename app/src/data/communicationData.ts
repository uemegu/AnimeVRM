/**
 * 夜の自室におけるTV電話・メール（LINE風）シナリオマスターデータ
 */

import {
  HeroineId,
  CallScenario,
  MailScenario,
  HeroineCommunicationStatus,
} from '../types/communication';

/** TV電話シナリオ群 */
export const CALL_SCENARIOS: Record<string, CallScenario> = {
  aoi_day1_call: {
    id: 'aoi_day1_call',
    characterId: 'aoi',
    day: 1,
    modelUrl: '/models/aoi/aoi-private.vrm',
    title: { ja: '夜の通話', en: 'Night Call' },
    initialStepId: 'step_1',
    steps: {
      step_1: {
        id: 'step_1',
        speaker: { ja: 'アオイ', en: 'Aoi' },
        text: {
          ja: 'もしもし？ 夜遅くに急にかけてごめんね……。今日、放課後に少し話せて嬉しかったから、なんだか声が聞きたくなっちゃって。',
          en: 'Hello? Sorry for calling so late... I was just so happy we talked after school today that I wanted to hear your voice.',
        },
        expression: 'relaxed',
        expressionWeight: 1.0,
        nextStepId: 'step_1_choice',
      },
      step_1_choice: {
        id: 'step_1_choice',
        speaker: { ja: '', en: '' },
        text: { ja: '', en: '' },
        choices: [
          {
            id: 'aoi_call_choice_1',
            text: { ja: '俺も話せて嬉しかったよ', en: 'I was really happy to talk with you too.' },
            goto: 'step_happy',
            setFlags: { night_call_aoi_happy: true },
            addAffinity: { aoi: 1 },
          },
          {
            id: 'aoi_call_choice_2',
            text: { ja: '急にどうしたの？ 何かあった？', en: 'Is everything okay? What happened?' },
            goto: 'step_shy',
            setFlags: { night_call_aoi_shy: true },
            addAffinity: { aoi: 1 },
          },
        ],
      },
      step_happy: {
        id: 'step_happy',
        speaker: { ja: 'アオイ', en: 'Aoi' },
        text: {
          ja: 'ふふ、よかった……！ そう言ってもらえると安心するな。じゃあ、夜も遅いし今日はもう休んでね。明日学校で会えるの、楽しみにしてるよ。おやすみ！',
          en: "Fufu, I'm so glad...! Hearing you say that puts me at ease. Well, it's late so get some rest. Looking forward to seeing you at school tomorrow. Good night!",
        },
        expression: 'happy',
        expressionWeight: 1.0,
        nextStepId: null, // 通話終了
      },
      step_shy: {
        id: 'step_shy',
        speaker: { ja: 'アオイ', en: 'Aoi' },
        text: {
          ja: 'う、ううん、何でもないの！ ちょっと気になっちゃっただけ……変なこと言ってごめんね。明日また教室で話そうね。おやすみなさい！',
          en: "N-No, nothing's wrong! I was just wondering... sorry for the weird call. Let's chat in class tomorrow. Good night!",
        },
        expression: 'surprised',
        expressionWeight: 1.0,
        nextStepId: null, // 通話終了
      },
    },
  },
};

/** メールシナリオ群 */
export const MAIL_SCENARIOS: Record<string, MailScenario> = {
  aoi_day1_mail: {
    id: 'aoi_day1_mail',
    characterId: 'aoi',
    day: 1,
    previewText: {
      ja: '……少しだけ、話せるかな？',
      en: '...Can we talk for a moment?',
    },
    time: '23:42',
    messages: [
      {
        id: 'msg_1',
        sender: 'heroine',
        text: { ja: '今日もお疲れさま！', en: 'Thanks for today!' },
        time: '23:40',
      },
      {
        id: 'msg_2',
        sender: 'heroine',
        text: {
          ja: '……少しだけ、話せるかな？ 明日の小テストの範囲、ノート見せてもらってもいいかな？',
          en: '...Can we talk for a moment? Could I look at your notes for tomorrow’s quiz?',
        },
        time: '23:42',
      },
    ],
    replyOptions: [
      {
        id: 'reply_notes',
        text: {
          ja: 'もちろん！ 明日の朝一番で見せるよ',
          en: 'Of course! I’ll show you first thing in the morning.',
        },
        reactionText: {
          ja: 'ありがとう！ すごく助かるよ〜！ 明日楽しみにしてるね！',
          en: 'Thank you! You saved me! Looking forward to tomorrow!',
        },
        reactionTime: '23:43',
        setFlags: { night_mail_aoi_notes_ok: true },
        addAffinity: { aoi: 1 },
      },
      {
        id: 'reply_study',
        text: {
          ja: '俺も不安だから明日の朝一緒に勉強しよう',
          en: 'I’m worried too, so let’s study together tomorrow morning.',
        },
        reactionText: {
          ja: 'えっ、本当！？ すごく心強いよ！ 明日一緒に頑張ろうね！',
          en: 'Really?! That’s so reassuring! Let’s do our best tomorrow!',
        },
        reactionTime: '23:43',
        setFlags: { night_mail_aoi_study_together: true },
        addAffinity: { aoi: 2 },
      },
    ],
  },
  emili_day1_mail: {
    id: 'emili_day1_mail',
    characterId: 'emili',
    day: 1,
    previewText: {
      ja: '明日の購買パン争奪戦、協力要請！',
      en: 'Help needed for tomorrow’s bakery rush!',
    },
    time: '22:15',
    messages: [
      {
        id: 'emili_msg_1',
        sender: 'heroine',
        text: {
          ja: 'やっほー！ 明日の昼休み、購買の限定メロンパン一緒に並ばない？ 1人だと絶対売り切れるんだよね！',
          en: 'Yahoo! Want to line up for the limited melon pan tomorrow at lunch? They always sell out if I go alone!',
        },
        time: '22:15',
      },
    ],
    replyOptions: [
      {
        id: 'reply_emili_run',
        text: {
          ja: 'いいよ、ダッシュで買いに行こう！',
          en: 'Sure, let’s sprint there!',
        },
        reactionText: {
          ja: 'よっしゃー！ さすが頼りになる〜！ 購買前集合ね！',
          en: 'Awesome! So reliable! Meet you in front of the bakery!',
        },
        reactionTime: '22:16',
        setFlags: { night_mail_emili_melonpan_ok: true },
        addAffinity: { emili: 1 },
      },
      {
        id: 'reply_emili_share',
        text: {
          ja: '並ぶのはいいけど一口ちょうだいね',
          en: 'I’ll wait in line, but give me a bite!',
        },
        reactionText: {
          ja: 'え〜！？ しょうがないな〜、半分こならいいよ！ 約束ね！',
          en: 'Eh?! Fine, we can split it in half! Deal!',
        },
        reactionTime: '22:16',
        setFlags: { night_mail_emili_melonpan_share: true },
        addAffinity: { emili: 1 },
      },
    ],
  },
  shion_day1_mail: {
    id: 'shion_day1_mail',
    characterId: 'shion',
    day: 1,
    previewText: {
      ja: '……図書室のあの本について',
      en: '...Regarding that book in the library',
    },
    time: '21:50',
    messages: [
      {
        id: 'shion_msg_1',
        sender: 'heroine',
        text: {
          ja: '……夜分に失礼します。今日、図書室であなたが気にしていた本……私も少し興味がありました。もし読み終わったら、感想を聞かせてください。',
          en: '...Excuse me for messaging so late. The book you were looking at in the library today... I was curious about it too. If you finish reading it, please tell me your thoughts.',
        },
        time: '21:50',
      },
    ],
    replyOptions: [
      {
        id: 'reply_shion_tell',
        text: {
          ja: '明日感想を伝えに行くよ',
          en: 'I’ll come share my thoughts tomorrow.',
        },
        reactionText: {
          ja: '……ありがとうございます。楽しみにしていますね。おやすみなさい。',
          en: '...Thank you. I look forward to it. Good night.',
        },
        reactionTime: '21:52',
        setFlags: { night_mail_shion_report_ok: true },
        addAffinity: { shion: 1 },
      },
      {
        id: 'reply_shion_mystery',
        text: {
          ja: 'シオンが好きそうなミステリーだよ',
          en: 'It’s a mystery book you’d probably love.',
        },
        reactionText: {
          ja: '……！ なぜ私がミステリー好きだと……？ 明日、詳しく聞かせてください。',
          en: '...! How did you know I like mystery novels...? Please tell me more tomorrow.',
        },
        reactionTime: '21:52',
        setFlags: { night_mail_shion_mystery_talk: true },
        addAffinity: { shion: 2 },
      },
    ],
  },
};

/** 現在のゲーム状態からヒロインごとのコミュニケーション状態を取得 */
export function getHeroineCommunicationStatuses(
  day: number,
  flags: Record<string, boolean | number | string>
): Record<HeroineId, HeroineCommunicationStatus> {
  // Day 1 アオイの着信判定（まだ通話しておらず、着信拒否もしていない場合）
  const aoiCallDone = Boolean(flags['night_call_completed_day1_aoi']);
  const aoiCallRejected = Boolean(flags['night_call_rejected_day1_aoi']);
  const hasAoiIncomingCall = day === 1 && !aoiCallDone && !aoiCallRejected;

  // アオイのメール
  const aoiMailReplied = Boolean(flags['night_mail_replied_day1_aoi']);
  const aoiMailRead = Boolean(flags['night_mail_read_day1_aoi']);
  const aoiUnreadCount = aoiMailReplied || aoiMailRead ? 0 : 1;

  // エミリのメール
  const emiliMailReplied = Boolean(flags['night_mail_replied_day1_emili']);
  const emiliMailRead = Boolean(flags['night_mail_read_day1_emili']);
  const emiliUnreadCount = emiliMailReplied || emiliMailRead ? 0 : 1;

  // シオンのメール
  const shionMailReplied = Boolean(flags['night_mail_replied_day1_shion']);
  const shionMailRead = Boolean(flags['night_mail_read_day1_shion']);
  const shionUnreadCount = shionMailReplied || shionMailRead ? 0 : 1;

  return {
    aoi: {
      characterId: 'aoi',
      statusText: { ja: '今、話せる？', en: 'Can we talk now?' },
      hasIncomingCall: hasAoiIncomingCall,
      incomingCallScenario: CALL_SCENARIOS.aoi_day1_call,
      unreadMailCount: aoiUnreadCount,
      activeMailScenario: MAIL_SCENARIOS.aoi_day1_mail,
      callCompleted: aoiCallDone,
      mailReplied: aoiMailReplied,
    },
    emili: {
      characterId: 'emili',
      statusText: { ja: 'また話そーね！', en: 'Let’s talk again!' },
      hasIncomingCall: false,
      unreadMailCount: emiliUnreadCount,
      activeMailScenario: MAIL_SCENARIOS.emili_day1_mail,
      callCompleted: false,
      mailReplied: emiliMailReplied,
    },
    shion: {
      characterId: 'shion',
      statusText: { ja: '……また、夜に。', en: '...Again, at night.' },
      hasIncomingCall: false,
      unreadMailCount: shionUnreadCount,
      activeMailScenario: MAIL_SCENARIOS.shion_day1_mail,
      callCompleted: false,
      mailReplied: shionMailReplied,
    },
  };
}
