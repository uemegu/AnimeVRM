import type { ScenarioPackage, ScenarioSceneAvatarConfig, ScenarioScene, ScenarioCrowdConfig } from './types';
import { PAINTED_CLASSROOM_SHOTS } from '../scene/painted-classroom/PaintedClassroom';
import { resolveAssetUrl } from '../utils/path';

// The painted set only holds up near its reference camera (the original image's
// viewpoint). Measured limits: at conversation distance (~1.3 m to the avatars,
// FOV ≈ 30°) the camera can shift about ±0.4 m sideways and ~0.9 m forward.
// Wider lenses or larger side moves expose the edges of the projected shell.
// So the shots below are shot/reverse-shot from inside the aisle, not orbits.

// Both stand just in front of the front desk row, opened toward the camera so
// their faces stay visible while the head turns the rest of the way.
const AOI_POSITION: [number, number, number] = [0.32, 0, -1.9];
const AOI_ROTATION_Y = -0.55;
const EMILY_POSITION: [number, number, number] = [-0.32, 0, -1.9];
const EMILY_ROTATION_Y = 0.55;

type Shot = Pick<ScenarioScene, 'cameraPosition' | 'cameraTarget' | 'cameraFov'>;
const REFERENCE = PAINTED_CLASSROOM_SHOTS[0];
/** The original painting's own composition. Both are framed from the thighs up. */
const WIDE: Shot = { cameraPosition: [...REFERENCE.position], cameraTarget: [...REFERENCE.target], cameraFov: REFERENCE.fov };
const TWO_SHOT: Shot = { cameraPosition: [0, 1.3, -0.55], cameraTarget: [0, 1.22, -1.9], cameraFov: 40 };
// Speaker shots are taken from the listener's side, over the aisle.
const AOI_SHOT: Shot = { cameraPosition: [-0.36, 1.32, -0.65], cameraTarget: [0.26, 1.28, -1.9], cameraFov: 30 };
const EMILY_SHOT: Shot = { cameraPosition: [0.30, 1.32, -0.65], cameraTarget: [-0.12, 1.28, -1.9], cameraFov: 28 };
/** Bust-up for the key line. Still well short of an extreme close-up. */
const AOI_CLOSE: Shot = { cameraPosition: [-0.22, 1.37, -0.95], cameraTarget: [0.3, 1.31, -1.9], cameraFov: 28 };

const CUT = { cameraPreset: 'hold', cameraTransitionDuration: 0, cameraTransitionEasing: 'cut' } as const;
const glide = (seconds: number) => ({ cameraPreset: 'hold', cameraTransitionDuration: seconds, cameraTransitionEasing: 'smooth' } as const);

const anim = (name: string) => resolveAssetUrl(`/animations/${name}.fbx`);
const voice = (name: string) => resolveAssetUrl(`/voices/${name}.wav`);
const FACE_PARTNER = { lookAtTarget: 'partner', shallowHeadAngle: false } as const;
const aoi = (config: ScenarioSceneAvatarConfig): ScenarioSceneAvatarConfig =>
  ({ visible: true, position: AOI_POSITION, rotationY: AOI_ROTATION_Y, ...FACE_PARTNER, ...config });
const emily = (config: ScenarioSceneAvatarConfig): ScenarioSceneAvatarConfig =>
  ({ visible: true, position: EMILY_POSITION, rotationY: EMILY_ROTATION_Y, ...FACE_PARTNER, ...config });

const CLASSROOM_CROWD: ScenarioCrowdConfig = {
  enabled: true,
  preset: 'painted-classroom',
  opacity: 0.65,
};

const LOCATION = '昼休みの教室';
const AOI = { speaker: 'アオイ', speakerCharacterId: 'aoi', dialogueTarget: 'partner', crowd: CLASSROOM_CROWD } as const;
const EMILY = { speaker: 'エミリ', speakerCharacterId: 'emily', dialogueTarget: 'partner', crowd: CLASSROOM_CROWD } as const;

/** Classroom conversation with background mob and voice acting in the painted 3D set. */
export function getPaintedClassroomScenario(): ScenarioPackage {
  const scenes: ScenarioScene[] = [
    {
      id: 'pc_1', location: LOCATION, scenePreset: 'day_school', ...WIDE, ...CUT, crowd: CLASSROOM_CROWD,
      // A slow creep into the painting sells its depth before anyone speaks.
      cameraPreset: 'pushIn', cameraStrength: 0.35,
      text: '昼休みの教室。クラスメイトたちの賑やかな声が響く中、窓際で二人が話していた。',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0, lookAtTarget: 'forward' }),
        emily: emily({ motion: anim('Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_2', location: LOCATION, ...EMILY, ...EMILY_SHOT, ...CUT,
      voiceUrl: voice('pc_2'),
      text: '「アオイ、午後の小テストの範囲、もう見直した？ 古典の文法が全然頭に入らなくて……！」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('mob_chat_gesture'), expression: 'surprised', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_3', location: LOCATION, ...AOI, ...AOI_SHOT, ...CUT,
      voiceUrl: voice('pc_3'),
      text: '「ふふ、大丈夫だよエミリちゃん。大事なところ、後で一緒におさらいしよっか」',
      avatars: {
        aoi: aoi({ motion: anim('clasp_hands_front'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_4', location: LOCATION, ...EMILY, ...TWO_SHOT, ...glide(1.6),
      voiceUrl: voice('pc_4'),
      text: '「ほんと！？ さすがアオイ、頼りになる〜！ 助かったぁ……！」',
      avatars: {
        aoi: aoi({ motion: anim('clasp_hands_front'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('ardy_laugh'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_5', location: LOCATION, ...AOI, ...AOI_SHOT, ...CUT,
      voiceUrl: voice('pc_5'),
      text: '「もう、大げさなんだから。その代わり、今日の放課後は購買のパン、付き合ってね？」',
      avatars: {
        aoi: aoi({ motion: anim('Dismissing Gesture'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_6', location: LOCATION, ...EMILY, ...EMILY_SHOT, ...CUT,
      cameraPreset: 'pushIn', cameraStrength: 0.4,
      voiceUrl: voice('pc_6'),
      text: '「もちろん！ 新作のいちごデニッシュ、半分こしよ！」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Standing Greeting'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_7', location: LOCATION, ...AOI, ...AOI_CLOSE, ...glide(2.2),
      voiceUrl: voice('pc_7'),
      text: '「うん、約束ね。……ふふっ、エミリちゃんといると、何気ない時間もすごく楽しいな」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'relax', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_8', location: LOCATION, ...EMILY, ...TWO_SHOT, ...CUT,
      voiceUrl: voice('pc_8'),
      text: '「……なに急に、照れるじゃん。でも……私もだよ！」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Acknowledging'), expression: 'relax', expressionWeight: 1.0, lookAtTarget: 'forward' }),
      },
    },
    {
      id: 'pc_9', location: LOCATION, ...AOI, ...WIDE, ...glide(3.5),
      voiceUrl: voice('pc_9'),
      text: '「さ、予習しよっか。午後の授業も一緒に頑張ろうね！」',
      avatars: {
        aoi: aoi({ motion: anim('ardy_wave'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
  ];
  return {
    id: 'painted-classroom',
    title: '昼休みの教室（簡易3D日常会話）',
    stage: 'painted-classroom',
    bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
    bgmVolume: 0.15,
    characters: [
      { id: 'aoi', character: resolveAssetUrl('/models/aoi/aoi-school.vrm'), position: AOI_POSITION, rotationY: AOI_ROTATION_Y },
      { id: 'emily', character: resolveAssetUrl('/models/emili/emili.vrm'), position: EMILY_POSITION, rotationY: EMILY_ROTATION_Y },
    ],
    chapters: [{ id: 'lunch-break', title: '昼休みの教室', scenes }],
  };
}
