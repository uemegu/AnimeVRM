import { ScenarioPackage, ScenarioCrowdConfig } from './types';
import { resolveAssetUrl } from '../utils/path';

// Both stand in the classroom's center aisle (desks start at |x| ≈ 0.5), facing each
// other across it but opened toward the room, so their faces stay visible; the head
// turns the rest of the way to look at the partner (see FACE_PARTNER).
const AOI_POSITION: [number, number, number] = [0.32, 0, -0.45];
const AOI_ROTATION_Y = -0.9;
const EMILY_POSITION: [number, number, number] = [-0.32, 0, -0.45];
const EMILY_ROTATION_Y = 0.9;

/** Look at the partner's face, turning the head fully (not the default shallow turn). */
const FACE_PARTNER = { lookAtTarget: 'partner', shallowHeadAngle: false } as const;

// Speaker shots from in front of the listener's side: about 35° off the speaker's
// line of sight, so the face is seen three-quarters on with the listener's shoulder
// at the frame edge. Both cameras stay on the room side of the line between them.
const AOI_SHOT = { cameraPosition: [-0.68, 1.38, 0.98] as [number, number, number], cameraTarget: 'aoi' };
const AOI_CLOSE_SHOT = { cameraPosition: [-0.31, 1.36, 0.45] as [number, number, number], cameraTarget: 'aoi' };
const EMILY_SHOT = { cameraPosition: [0.68, 1.38, 0.98] as [number, number, number], cameraTarget: 'emily' };

const CLASSROOM_CROWD: ScenarioCrowdConfig = {
  enabled: true,
  preset: 'classroom',
  opacity: 0.6,
};

const LOCATION = '2年の教室・休み時間';

export const CORRIDOR_CONVERSATION_SCENARIO: ScenarioPackage = {
  id: 'corridor_conversation',
  title: '休み時間の教室 〜アオイとエミリ、同じ班になれたね〜',
  stage: 'classroom',
  characters: [
    {
      id: 'aoi',
      character: resolveAssetUrl('/models/aoi/aoi-school.vrm'),
      position: AOI_POSITION,
      rotationY: AOI_ROTATION_Y,
    },
    {
      id: 'emily',
      character: resolveAssetUrl('/models/emili/emili.vrm'),
      position: EMILY_POSITION,
      rotationY: EMILY_ROTATION_Y,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.2,
  chapters: [
    {
      id: 'main',
      title: '休み時間の教室',
      scenes: [
        // ============================================================
        // Scene 1: エミリが嬉しそうに駆け寄ってくる
        // ============================================================
        {
          id: 'cm_1',
          speaker: 'エミリ',
          speakerCharacterId: 'emily',
          dialogueTarget: 'partner',
          location: LOCATION,
          text: '「アオイ〜！ 聞いて聞いて、次の理科の実験、同じ班になれたよ！」',
          voiceUrl: resolveAssetUrl('/voices/cm_1.wav'),
          crowd: CLASSROOM_CROWD,
          cameraZoom: 'wide',
          cameraDistance: 1.1,
          cameraTransitionDuration: 0,
          cameraTransitionEasing: 'cut',
          avatars: {
            aoi: {
              visible: true,
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 0.6,
              position: AOI_POSITION,
              rotationY: AOI_ROTATION_Y,
              ...FACE_PARTNER,
            },
            emily: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: EMILY_POSITION,
              rotationY: EMILY_ROTATION_Y,
              ...FACE_PARTNER,
              transitions: [
                // 「同じ班になれたよ！」で両手を上げて喜ぶ
                { at: 3.9, motion: resolveAssetUrl('/animations/Excited.fbx'), effectText: 'yatta' },
              ],
            },
          },
        },
        // ============================================================
        // Scene 2: アオイがほっとして喜ぶ
        // ============================================================
        {
          id: 'cm_2',
          speaker: 'アオイ',
          speakerCharacterId: 'aoi',
          dialogueTarget: 'partner',
          location: LOCATION,
          text: '「ほんと！？ よかったぁ……。エミリちゃんと一緒なら心強いな。」',
          voiceUrl: resolveAssetUrl('/voices/cm_2.wav'),
          crowd: CLASSROOM_CROWD,
          ...AOI_SHOT,
          cameraTransitionDuration: 0.7,
          cameraTransitionEasing: 'smooth',
          avatars: {
            aoi: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'surprised',
              expressionWeight: 0.8,
              ...FACE_PARTNER,
              transitions: [
                // 「よかったぁ」でうんうんとうなずいて安心する
                {
                  at: 1.7,
                  motion: resolveAssetUrl('/animations/Acknowledging.fbx'),
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
              ],
            },
            emily: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              ...FACE_PARTNER,
            },
          },
        },
        // ============================================================
        // Scene 3: エミリが前回の失敗をからかう
        // ============================================================
        {
          id: 'cm_3',
          speaker: 'エミリ',
          speakerCharacterId: 'emily',
          dialogueTarget: 'partner',
          location: LOCATION,
          text: '「でもさ〜、前回ビーカー割りそうになったの、誰だったっけ？」',
          voiceUrl: resolveAssetUrl('/voices/cm_3.wav'),
          crowd: CLASSROOM_CROWD,
          ...EMILY_SHOT,
          cameraTransitionDuration: 0.6,
          cameraTransitionEasing: 'smooth',
          avatars: {
            aoi: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'happy',
              expressionWeight: 0.6,
              ...FACE_PARTNER,
              transitions: [
                { at: 3.9, expression: 'surprised', expressionWeight: 0.9 },
              ],
            },
            emily: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'relaxed',
              expressionWeight: 0.8,
              ...FACE_PARTNER,
              transitions: [
                // 「誰だったっけ？」でいたずらっぽく笑う
                {
                  at: 3.7,
                  expression: 'happy',
                  expressionWeight: 1.0,
                },
              ],
            },
          },
        },
        // ============================================================
        // Scene 4: アオイが慌てて言い返し、むくれる
        // ============================================================
        {
          id: 'cm_4',
          speaker: 'アオイ',
          speakerCharacterId: 'aoi',
          dialogueTarget: 'partner',
          location: LOCATION,
          text: '「あ、あれはたまたまだってば！ 今日はちゃんと気をつけるもん……。」',
          voiceUrl: resolveAssetUrl('/voices/cm_4.wav'),
          crowd: CLASSROOM_CROWD,
          ...AOI_CLOSE_SHOT,
          cameraTransitionDuration: 0.4,
          cameraTransitionEasing: 'gyuin',
          avatars: {
            aoi: {
              motion: resolveAssetUrl('/animations/Dismissing Gesture.fbx'),
              expression: 'surprised',
              expressionWeight: 0.9,
              ...FACE_PARTNER,
              sweat: 'fly4',
              transitions: [
                // 「気をつけるもん……」でむくれる
                {
                  at: 3.5,
                  expression: 'angry',
                  expressionWeight: 0.55,
                  sweat: false,
                },
              ],
            },
            emily: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              ...FACE_PARTNER,
            },
          },
        },
        // ============================================================
        // Scene 5: エミリが笑ってなだめ、理科室へ誘う
        // ============================================================
        {
          id: 'cm_5',
          speaker: 'エミリ',
          speakerCharacterId: 'emily',
          dialogueTarget: 'partner',
          location: LOCATION,
          text: '「ふふっ、冗談だよ。ほら、チャイム鳴る前に理科室いこ！」',
          voiceUrl: resolveAssetUrl('/voices/cm_5.wav'),
          crowd: CLASSROOM_CROWD,
          ...EMILY_SHOT,
          cameraTransitionDuration: 0.6,
          cameraTransitionEasing: 'smooth',
          avatars: {
            aoi: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'angry',
              expressionWeight: 0.35,
              ...FACE_PARTNER,
              transitions: [
                { at: 2.0, expression: 'happy', expressionWeight: 0.8 },
              ],
            },
            emily: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              ...FACE_PARTNER,
            },
          },
        },
        // ============================================================
        // Scene 6: 二人で出発
        // ============================================================
        {
          id: 'cm_6',
          speaker: 'アオイ',
          speakerCharacterId: 'aoi',
          dialogueTarget: 'partner',
          location: LOCATION,
          text: '「うん！ ノートと教科書、持った？ ……よし、出発！」',
          voiceUrl: resolveAssetUrl('/voices/cm_6.wav'),
          crowd: CLASSROOM_CROWD,
          cameraZoom: 'wide',
          cameraDistance: 1.0,
          cameraTransitionDuration: 0.8,
          cameraTransitionEasing: 'smooth',
          avatars: {
            aoi: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              ...FACE_PARTNER,
              transitions: [
                // 「出発！」で元気よく敬礼
                { at: 4.4, motion: resolveAssetUrl('/animations/Salute.fbx') },
              ],
            },
            emily: {
              motion: resolveAssetUrl('/animations/Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              ...FACE_PARTNER,
              transitions: [
                { at: 4.6, motion: resolveAssetUrl('/animations/Excited.fbx') },
              ],
            },
          },
        },
      ],
    },
  ],
};

export function getCorridorConversationScenario(): ScenarioPackage {
  return CORRIDOR_CONVERSATION_SCENARIO;
}
