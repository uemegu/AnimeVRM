import { ScenarioPackage } from '../types/scenario';

export const ENDING_SCENARIO_AOI: ScenarioPackage = {
  id: 'ending_aoi',
  title: { ja: 'エンディング: アオイとの約束', en: 'Ending: Promise with Aoi' },
  characters: [{ id: 'aoi', modelUrl: '/models/aoi/aoi.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '28日間の月日が流れ、夕暮れのグラウンドにアオイの姿があった。',
        en: 'Twenty-eight days have passed. Aoi stands on the school ground bathed in sunset.',
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'neutral', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'この1ヶ月、ずっと一緒にいてくれて本当に嬉しかったよ。',
        en: 'Spending this entire month with you made me so truly happy.',
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's3',
      speaker: { ja: 'アオイ', en: 'Aoi' },
      speakerCharacterId: 'aoi',
      text: {
        ja: 'これからも、ずっと隣で走ってくれるよね？……約束だよ！',
        en: "You will keep running alongside me from now on, won't you? ...It's a promise!",
      },
      avatars: {
        aoi: { characterId: 'aoi', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's4',
      speaker: '',
      text: {
        ja: '夕焼け空の下、アオイと指切りを交わした。二人の未来へ続く物語の幕開けだった。',
        en: 'Under the sunset sky, we made a pinky promise. A new chapter of our story begins.',
      },
    },
  ],
};

export const ENDING_SCENARIO_SHION: ScenarioPackage = {
  id: 'ending_shion',
  title: { ja: 'エンディング: シオンと紡ぐ物語', en: 'Ending: Story woven with Shion' },
  characters: [{ id: 'shion', modelUrl: '/models/shion/shion.vrm', initialPosition: 'center' }],
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: '放課後の図書室。夕暮れの光が窓から差し込み、シオンが静かに微笑んでいた。',
        en: 'In the after-school library. Sunset sunlight poured through the window as Shion smiled softly.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's2',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: 'あなたと過ごした日々は、私が読んできたどんな物語よりも温かい時間でした。',
        en: 'The days I spent with you were warmer and more precious than any story I have ever read.',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's3',
      speaker: { ja: 'シオン', en: 'Shion' },
      speakerCharacterId: 'shion',
      text: {
        ja: '次の物語のページも……あなたと一緒にめくってもいいですか？',
        en: 'May I continue to turn the pages of the next chapter... together with you?',
      },
      avatars: {
        shion: { characterId: 'shion', position: 'center', visible: true, expression: 'happy', expressionWeight: 1.0 },
      },
    },
    {
      id: 's4',
      speaker: '',
      text: {
        ja: '本を閉じたシオンと静かに手を重ね合わせた。',
        en: 'As Shion closed her book, our hands gently intertwined.',
      },
    },
  ],
};

export const ENDING_SCENARIO_NORMAL: ScenarioPackage = {
  id: 'ending_normal',
  title: { ja: 'エンディング: 充実した28日間', en: 'Ending: A Month Well Spent' },
  scenes: [
    {
      id: 's1',
      speaker: '',
      text: {
        ja: 'こうして充実した新学期の4週間、全28日間が幕を閉じた。',
        en: 'And so, the four eventful weeks of the new semester—all 28 days—came to a close.',
      },
    },
    {
      id: 's2',
      speaker: '',
      text: {
        ja: '学校生活の中で得た様々な思い出を胸に、明日からも前を向いて歩んでいこう。',
        en: 'With cherished memories from school life held in heart, forward we step into tomorrow.',
      },
    },
  ],
};
