import { ScenarioPackage } from '../types/scenario';

/** 教室イベント: アオイとの雑談 */
export const ACTION_SCENARIO_CLASSROOM_AOI: ScenarioPackage = {
  id: 'action_classroom_aoi',
  title: { ja: '教室: アオイとノートの貸し借り', en: 'Classroom: Borrowing notes with Aoi' },
  actionHints: [
    {
      locationId: 'classroom',
      hintCharacterIds: ['aoi'],
      hintText: {
        ja: 'アオイの元気な声が聞こえてくる。',
        en: 'Aoi can be heard energetically nearby.',
      },
      phases: ['morning_action'],
    },
    {
      locationId: 'sports_ground',
      hintCharacterIds: ['aoi'],
      hintText: {
        ja: 'アオイの元気な声が聞こえてくる。',
        en: 'Aoi can be heard energetically nearby.',
      },
    },
  ],
  characters: [{ id: 'aoi', modelUrl: '/models/aoi/aoi.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'あ、ちょうどよかった！前の授業のノート、ちょっと見せてもらえないかな？',
        en: 'Ah, perfect timing! Could you lend me your notebook from the last class?',
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's_choice',
      text: '', // 選択肢シーンはtext空文字（ルール遵守）
      choices: [
        {
          text: { ja: 'いいよ、ここ見やすくなってるよ', en: 'Sure, here is the clean copy.' },
          goto: 's_accept',
          setFlags: { helped_aoi_notes: true },
          addAffinity: { aoi: 5 },
        },
        {
          text: { ja: '字が汚いけどそれでも良ければ…', en: "My handwriting is messy, but if you don't mind..." },
          goto: 's_humble',
          addAffinity: { aoi: 3 },
        },
      ],
    },
    {
      id: 's_accept',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'わあ、助かる！いつも丁寧にとっててすごいよね。後でお礼にジュースおごるね！',
        en: "Wow, thank you! Your notes are always so tidy. I'll buy you a juice later!",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_humble',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'ふふ、大丈夫！読める読める！貸してくれてありがとね。',
        en: "Haha, don't worry! I can read it just fine! Thanks for lending it to me.",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: 'アオイと和やかに言葉を交わし、楽しい休み時間を過ごした。',
        en: 'We shared a pleasant conversation and enjoyed our break together.',
      },
    },
  ],
};

/** 図書室イベント: シオンとの出会い / 読書 */
export const ACTION_SCENARIO_LIBRARY_SHION: ScenarioPackage = {
  id: 'action_library_shion',
  title: { ja: '図書室: シオンと静かな時間', en: 'Library: Quiet time with Shion' },
  actionHints: [
    {
      locationId: 'library',
      hintCharacterIds: ['shion'],
      hintText: {
        ja: '静かに本を読むシオンの姿が見える。',
        en: 'Shion is seen quietly reading a book.',
      },
    },
  ],
  characters: [{ id: 'shion', modelUrl: '/models/shion/shion.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '静かな図書室の奥、窓際の席でシオンが分厚い本を読んでいた。',
        en: 'In the quiet corner of the library by the window, Shion is immersed in a thick book.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: '……あ。こんにちは。あなたも本を探しに来たのですか？',
        en: '...Ah. Hello. Did you come looking for a book as well?',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's_choice',
      text: '', // 選択肢シーンはtext空文字（ルール遵守）
      choices: [
        {
          text: { ja: 'シオンのおすすめの本を教えてほしい', en: "I'd like you to recommend a book." },
          goto: 's_recommend',
          setFlags: { asked_shion_book: true },
          addAffinity: { shion: 5 },
        },
        {
          text: { ja: '邪魔しないように隣で静かに本を読むよ', en: "I'll read quietly next to you so I don't disturb you." },
          goto: 's_quiet',
          addAffinity: { shion: 4 },
        },
      ],
    },
    {
      id: 's_recommend',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: '私のおすすめ……ですか？それなら、この短編集が読みやすくて素敵ですよ。',
        en: 'My recommendation...? In that case, this short story collection is wonderfully written.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_quiet',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: '……ふふ、お気遣いありがとうございます。どうぞ、こちらへ。',
        en: '...Fufu, thank you for being considerate. Please, have a seat.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: '本のページをめくる心地よい音とともに、穏やかな時間が流れた。',
        en: 'Peaceful time passed accompanied by the gentle sound of turning pages.',
      },
    },
  ],
};

/** 屋上イベント: エミリと空を見上げる */
export const ACTION_SCENARIO_ROOFTOP_EMILI: ScenarioPackage = {
  id: 'action_rooftop_emili',
  title: { ja: '屋上: エミリと青空', en: 'Rooftop: Blue sky with Emili' },
  actionHints: [
    {
      locationId: 'rooftop',
      hintCharacterIds: ['emili'],
      hintText: {
        ja: '風に揺れる金髪のエミリがいるようだ。',
        en: 'Emili seems to be enjoying the breeze here.',
      },
    },
  ],
  characters: [{ id: 'emili', modelUrl: '/models/emili/emili.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '屋上のフェンスに寄りかかり、金髪を風になびかせるエミリの姿があった。',
        en: 'Leaning against the rooftop railing, Emili stood with her golden hair fluttering in the breeze.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'あら、ごきげんよう。日本の学校の屋上って、本当に開放的で素敵ね。',
        en: 'Oh, good day. Rooftops in Japanese schools are wonderfully open and refreshing.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's_choice',
      text: '', // 選択肢シーンはtext空文字
      choices: [
        {
          text: { ja: '風が気持ちいいね、学校にはもう慣れた？', en: 'The breeze feels great. Have you gotten used to school?' },
          goto: 's_friendly',
          addAffinity: { emili: 5 },
        },
        {
          text: { ja: 'お弁当一緒に食べる？', en: 'Would you like to eat lunch together?' },
          goto: 's_lunch',
          addAffinity: { emili: 5 },
        },
      ],
    },
    {
      id: 's_friendly',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: 'ええ、みんな親切でとても楽しいわ。あなたとこうして話せるのも嬉しいこと。',
        en: 'Yes, everyone is so kind and fun. Talking with you like this brings me joy too.',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_lunch',
      speaker: { ja: 'エミリ', en: 'Emili' },
      speakerCharacterId: 'emili',
      text: {
        ja: '嬉しいお誘いね！私のシェフが作ったサンドイッチ、ぜひ召し上がって！',
        en: 'What a lovely invitation! You must try the sandwiches prepared by my chef!',
      },
      avatars: {
        emili: { characterId: 'emili', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
      nextSceneId: 's_end',
    },
    {
      id: 's_end',
      speaker: '',
      text: {
        ja: '澄み渡る青空の下、エミリと楽しいひとときを分かち合った。',
        en: 'Under the clear blue sky, we shared a delightful moment together.',
      },
    },
  ],
};

/** 中庭・その他汎用日常イベント */
export const ACTION_SCENARIO_GENERIC: ScenarioPackage = {
  id: 'action_generic',
  title: { ja: '放課後のひと休み', en: 'Afternoon Break' },
  actionHints: [
    {
      locationId: 'courtyard',
      hintText: {
        ja: '生徒たちがベンチでくつろいでいる。',
        en: 'Students are relaxing on the benches.',
      },
    },
    {
      locationId: 'cafeteria',
      hintText: {
        ja: '美味しそうなパンの香りが漂っている。',
        en: 'The sweet scent of freshly baked bread fills the air.',
      },
    },
  ],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '穏やかな陽気のなか、静かに気分転換の時間を過ごした。',
        en: 'Spent some peaceful time relaxing under the pleasant weather.',
      },
    },
    {
      id: 's2',
      speaker: '',
      text: {
        ja: '心地よい風が通り抜け、心身ともにリフレッシュできた。',
        en: 'A pleasant breeze blew by, refreshing mind and body.',
      },
    },
  ],
};

/** 全行動シナリオ一覧（場所候補・ヒント判定用） */
export const ALL_ACTION_SCENARIOS: ScenarioPackage[] = [
  ACTION_SCENARIO_CLASSROOM_AOI,
  ACTION_SCENARIO_LIBRARY_SHION,
  ACTION_SCENARIO_ROOFTOP_EMILI,
  ACTION_SCENARIO_GENERIC,
];
