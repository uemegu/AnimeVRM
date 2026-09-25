import type { ScenarioPackage, ScenarioSceneAvatarConfig, ScenarioScene } from './types';
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
const EMILY_SHOT: Shot = { cameraPosition: [0.36, 1.32, -0.65], cameraTarget: [-0.26, 1.28, -1.9], cameraFov: 30 };
/** Bust-up for the key line. Still well short of an extreme close-up. */
const AOI_CLOSE: Shot = { cameraPosition: [-0.22, 1.37, -0.95], cameraTarget: [0.3, 1.31, -1.9], cameraFov: 28 };

const CUT = { cameraPreset: 'hold', cameraTransitionDuration: 0, cameraTransitionEasing: 'cut' } as const;
const glide = (seconds: number) => ({ cameraPreset: 'hold', cameraTransitionDuration: seconds, cameraTransitionEasing: 'smooth' } as const);

const anim = (name: string) => resolveAssetUrl(`/animations/${name}.fbx`);
const FACE_PARTNER = { lookAtTarget: 'partner', shallowHeadAngle: false } as const;
const aoi = (config: ScenarioSceneAvatarConfig): ScenarioSceneAvatarConfig =>
  ({ visible: true, position: AOI_POSITION, rotationY: AOI_ROTATION_Y, ...FACE_PARTNER, ...config });
const emily = (config: ScenarioSceneAvatarConfig): ScenarioSceneAvatarConfig =>
  ({ visible: true, position: EMILY_POSITION, rotationY: EMILY_ROTATION_Y, ...FACE_PARTNER, ...config });

const LOCATION = '放課後の教室';
const AOI = { speaker: 'アオイ', speakerCharacterId: 'aoi', dialogueTarget: 'partner' } as const;
const EMILY = { speaker: 'エミリ', speakerCharacterId: 'emily', dialogueTarget: 'partner' } as const;

/** Silent conversation that checks whether dialogue camerawork reads naturally in the painted set. */
export function getPaintedClassroomScenario(): ScenarioPackage {
  const scenes: ScenarioScene[] = [
    {
      id: 'pc_1', location: LOCATION, ...WIDE, ...CUT,
      // A slow creep into the painting sells its depth before anyone speaks.
      cameraPreset: 'pushIn', cameraStrength: 0.35,
      text: '放課後。みんなが部活に行ったあとの教室に、二人だけが残っていた。',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0, lookAtTarget: 'forward' }),
        emily: emily({ motion: anim('Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_2', location: LOCATION, ...EMILY, ...EMILY_SHOT, ...CUT,
      text: '「アオイ、まだ帰らないの？ もうみんな行っちゃったよ」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('mob_chat_gesture'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_3', location: LOCATION, ...AOI, ...AOI_SHOT, ...CUT,
      text: '「うん……。もうちょっとだけ、ここにいたくて」',
      avatars: {
        aoi: aoi({ motion: anim('clasp_hands_front'), expression: 'relax', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_4', location: LOCATION, ...EMILY, ...TWO_SHOT, ...glide(1.6),
      text: '「なにそれ、黄昏れちゃって。アオイらしくないなー」',
      avatars: {
        aoi: aoi({ motion: anim('clasp_hands_front'), expression: 'neutral', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('ardy_laugh'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_5', location: LOCATION, ...AOI, ...AOI_SHOT, ...CUT,
      text: '「た、黄昏れてないってば！ ……たぶん」',
      avatars: {
        aoi: aoi({ motion: anim('Dismissing Gesture'), expression: 'angry', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_6', location: LOCATION, ...EMILY, ...EMILY_SHOT, ...CUT,
      cameraPreset: 'pushIn', cameraStrength: 0.5,
      text: '「ふーん？ じゃあ、何考えてたの？」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Standing Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_7', location: LOCATION, ...AOI, ...AOI_CLOSE, ...glide(2.2),
      text: '「来年も、この教室でみんなと一緒だったらいいなって」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'relax', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'neutral', expressionWeight: 1.0 }),
      },
    },
    {
      id: 'pc_8', location: LOCATION, ...EMILY, ...TWO_SHOT, ...CUT,
      text: '「……なに急に。そういうの、ずるいんだけど」',
      avatars: {
        aoi: aoi({ motion: anim('Standing Idle'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Acknowledging'), expression: 'relax', expressionWeight: 1.0, lookAtTarget: 'forward' }),
      },
    },
    {
      id: 'pc_9', location: LOCATION, ...AOI, ...WIDE, ...glide(3.5),
      text: '「ふふっ。帰ろっか、エミリちゃん」',
      avatars: {
        aoi: aoi({ motion: anim('ardy_wave'), expression: 'happy', expressionWeight: 1.0 }),
        emily: emily({ motion: anim('Idle'), expression: 'happy', expressionWeight: 1.0 }),
      },
    },
  ];
  return {
    id: 'painted-classroom', title: '放課後の教室（簡易3D会話テスト）', stage: 'painted-classroom',
    characters: [
      { id: 'aoi', character: resolveAssetUrl('/models/aoi/aoi-school.vrm'), position: AOI_POSITION, rotationY: AOI_ROTATION_Y },
      { id: 'emily', character: resolveAssetUrl('/models/emili/emili.vrm'), position: EMILY_POSITION, rotationY: EMILY_ROTATION_Y },
    ],
    chapters: [{ id: 'after-school', title: '放課後の教室', scenes }],
  };
}
