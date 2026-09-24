import { ScenarioPackage } from '../types/scenario';

/**
 * 休日（土日の昼）の行動シナリオ
 * ヒロインは私服モデルで登場する（App 側で休日フェーズ時に privateModelUrl を使用）
 * 遊園地・水族館は、ここでの選択肢で立つ unlock フラグにより行き先に追加される
 */

/** 公園: アオイと散歩（水族館の解放） */
export const HOLIDAY_SCENARIO_PARK_AOI: ScenarioPackage = {
  id: 'holiday_park_aoi',
  title: { ja: '公園: アオイと休日の散歩', en: 'Park: A holiday walk with Aoi' },
  availability: { timeSlots: ['holiday'] },
  actionHints: [
    {
      locationId: 'park',
      hintCharacterIds: ['aoi'],
      hintText: {
        ja: '噴水のそばで、聞き覚えのある明るい声がする。',
        en: 'A familiar cheerful voice can be heard by the fountain.',
      },
    },
  ],
  scenes: [
    {
      id: 's1',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'あれ、こんなところで会うなんて！休みの日も散歩してるんだ？',
        en: "Oh, fancy meeting you here! You go for walks on your days off too?",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'そうだ、海のほうに水族館があるでしょ？イルカのショーが新しくなったんだって。見てみたいなあ。',
        en: "Oh right, you know the aquarium by the sea? They say the dolphin show is brand new. I'd love to see it.",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'relaxed', expressionWeight: 1.0 },
      },
    },
    {
      id: 's_choice',
      text: '',
      choices: [
        {
          id: 'park_invite_aquarium',
          text: { ja: '今度、一緒に行こうか', en: "Let's go together sometime." },
          goto: 's_invite',
          setFlags: { unlock_aquarium: true },
          addAffinity: { aoi: 5 },
        },
        {
          id: 'park_just_listen',
          text: { ja: '楽しそうだね', en: 'Sounds fun.' },
          goto: 's_listen',
          addAffinity: { aoi: 2 },
        },
      ],
    },
    {
      id: 's_invite',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'ほんと！？じゃあ約束ね！次のお休み、水族館で待ってるから！',
        en: "Really!? It's a promise then! I'll be waiting at the aquarium next holiday!",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_listen',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'でしょ？いつか行けたらいいなあ。',
        en: 'Right? I hope I can go someday.',
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'relaxed', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: 'そのままアオイと公園を一周して、のんびりした休日を過ごした。',
        en: 'We walked around the park together and spent a relaxing holiday.',
      },
    },
  ],
};

/** 商店街: エミリと買い物（遊園地の解放） */
export const HOLIDAY_SCENARIO_SHOPPING_EMILI: ScenarioPackage = {
  id: 'holiday_shopping_emili',
  title: { ja: '商店街: エミリと福引き', en: 'Shopping Street: A lottery with Emili' },
  availability: { timeSlots: ['holiday'] },
  actionHints: [
    {
      locationId: 'shopping_street',
      hintCharacterIds: ['emili'],
      hintText: {
        ja: '福引き所の前に、見覚えのある赤い髪が見える。',
        en: 'A familiar head of red hair is by the lottery stand.',
      },
    },
  ],
  scenes: [
    {
      id: 's1',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'ちょっと、見て見て！福引きで遊園地のペアチケットが当たったんだけど！',
        en: 'Hey, look look! I won a pair of amusement park tickets in the lottery!',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: '……で、一枚余ってるのよね。別に、誰かと行きたいとかじゃないんだけど。',
        en: "...So, I have one extra. Not that I want to go with anyone in particular.",
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's_choice',
      text: '',
      choices: [
        {
          id: 'shopping_accept_ticket',
          text: { ja: 'よかったら一緒に行きたい', en: "I'd like to go with you, if that's okay." },
          goto: 's_accept',
          setFlags: { unlock_amusement_park: true },
          addAffinity: { emili: 5 },
        },
        {
          id: 'shopping_decline_ticket',
          text: { ja: '友達を誘ってみたら？', en: 'Why not invite a friend?' },
          goto: 's_decline',
          addAffinity: { emili: -1 },
        },
      ],
    },
    {
      id: 's_accept',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'し、仕方ないわね！次のお休みに遊園地ね。遅れたら承知しないから！',
        en: "W-well, if you insist! Next holiday at the amusement park. Don't you dare be late!",
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_decline',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: '……ふーん。まあ、そうするわ。',
        en: '...Hmph. Fine, I will.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'angry', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: 'エミリの買い物に付き合って、商店街をひと通り見て回った。',
        en: "I tagged along on Emili's shopping and looked around the shopping street.",
      },
    },
  ],
};

/** 映画館: シオンと映画 */
export const HOLIDAY_SCENARIO_CINEMA_SHION: ScenarioPackage = {
  id: 'holiday_cinema_shion',
  title: { ja: '映画館: シオンと同じ映画', en: 'Cinema: The same movie as Shion' },
  availability: { timeSlots: ['holiday'] },
  actionHints: [
    {
      locationId: 'cinema',
      hintCharacterIds: ['shion'],
      hintText: {
        ja: 'ロビーで上映時間を確かめている人影がある。',
        en: 'Someone in the lobby is checking the showtimes.',
      },
    },
  ],
  scenes: [
    {
      id: 's1',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: '……あなたも、この映画を？原作の小説、読んだことがあるの。',
        en: "...You're seeing this movie too? I've read the original novel.",
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's_choice',
      text: '',
      choices: [
        {
          id: 'cinema_sit_together',
          text: { ja: 'せっかくだし隣で観ない？', en: 'Want to sit together?' },
          goto: 's_together',
          addAffinity: { shion: 5 },
        },
        {
          id: 'cinema_ask_novel',
          text: { ja: '原作はどんな話？', en: "What's the novel like?" },
          goto: 's_novel',
          addAffinity: { shion: 3 },
        },
      ],
    },
    {
      id: 's_together',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: '……ええ。観終わったら、感想を聞かせて。',
        en: '...Sure. Tell me what you thought when it ends.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_novel',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: 'それは観てからのお楽しみ。……よかったら、あとで本を貸してあげる。',
        en: "You'll find out when you watch it. ...I can lend you the book later, if you want.",
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'relaxed', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: '映画のあと、シオンと少しだけ感想を話して別れた。',
        en: 'After the movie, Shion and I talked about it briefly before parting.',
      },
    },
  ],
};

/** 遊園地: エミリとの約束（unlock_amusement_park で解放） */
export const HOLIDAY_SCENARIO_AMUSEMENT_EMILI: ScenarioPackage = {
  id: 'holiday_amusement_emili',
  title: { ja: '遊園地: エミリと観覧車', en: 'Amusement Park: The Ferris wheel with Emili' },
  availability: { timeSlots: ['holiday'] },
  priority: 1,
  actionHints: [
    {
      locationId: 'amusement_park',
      hintCharacterIds: ['emili'],
      hintText: {
        ja: 'エミリとの約束の場所だ。',
        en: 'This is where I promised to meet Emili.',
      },
    },
  ],
  scenes: [
    {
      id: 's1',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'やっと来た！まずはジェットコースターからよ。怖いなんて言わせないんだから！',
        en: "Finally! Roller coaster first. I won't let you say you're scared!",
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: '……最後は観覧車。ここからだと、街全部が見えるのね。今日は、その、楽しかった。',
        en: '...The Ferris wheel to finish. You can see the whole town from up here. Today was, um, fun.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'relaxed', expressionWeight: 1.0 },
      },
      setFlags: { date_amusement_emili: true },
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: '夕方まで遊び尽くして、エミリと並んで帰り道を歩いた。',
        en: 'We played until evening, then walked home side by side.',
      },
    },
  ],
};

/** 水族館: アオイとの約束（unlock_aquarium で解放） */
export const HOLIDAY_SCENARIO_AQUARIUM_AOI: ScenarioPackage = {
  id: 'holiday_aquarium_aoi',
  title: { ja: '水族館: アオイとイルカショー', en: 'Aquarium: The dolphin show with Aoi' },
  availability: { timeSlots: ['holiday'] },
  priority: 1,
  actionHints: [
    {
      locationId: 'aquarium',
      hintCharacterIds: ['aoi'],
      hintText: {
        ja: 'アオイとの約束の場所だ。',
        en: 'This is where I promised to meet Aoi.',
      },
    },
  ],
  scenes: [
    {
      id: 's1',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'こっちこっち！ショー、もうすぐ始まるよ！前の席、取っておいたんだ。',
        en: "Over here! The show's about to start! I saved us seats up front.",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: '見た！？今の大ジャンプ！……えへへ、一緒に来られてよかった。',
        en: 'Did you see that!? That huge jump! ...Hehe, I\'m glad we came together.',
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      setFlags: { date_aquarium_aoi: true },
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: '水槽の青い光の中を、アオイと並んでゆっくり歩いた。',
        en: 'Aoi and I walked slowly side by side through the blue light of the tanks.',
      },
    },
  ],
};

/** 自宅 / 休日の汎用: 誰とも会わずに過ごす */
export const HOLIDAY_SCENARIO_GENERIC: ScenarioPackage = {
  id: 'holiday_generic',
  title: { ja: '休日のひと休み', en: 'A Quiet Holiday' },
  availability: { timeSlots: ['holiday'] },
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '今日は特に予定もない。ゆっくり過ごすことにした。',
        en: 'No particular plans today. I decided to take it easy.',
      },
    },
    {
      id: 's2',
      speaker: '',
      text: {
        ja: '平日の疲れが抜けて、明日への元気が湧いてきた。',
        en: "The week's fatigue faded, and I felt ready for tomorrow.",
      },
    },
  ],
};

/** 全休日シナリオ一覧（場所候補・ヒント判定用） */
export const ALL_HOLIDAY_SCENARIOS: ScenarioPackage[] = [
  HOLIDAY_SCENARIO_PARK_AOI,
  HOLIDAY_SCENARIO_SHOPPING_EMILI,
  HOLIDAY_SCENARIO_CINEMA_SHION,
  HOLIDAY_SCENARIO_AMUSEMENT_EMILI,
  HOLIDAY_SCENARIO_AQUARIUM_AOI,
];
