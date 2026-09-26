import type { ScenarioPackage, ScenarioScene, ScenarioSceneAvatarConfig } from './types';
import { AVATAR_POSITION, LIBRARY_SHOTS } from '../scene/painted-library/layout';
import { resolveAssetUrl } from '../utils/path';
import type { ScenePresetId } from '../presets/ScenePresets';

// Shion sits across the reading table from the camera (the player's seat). The
// chin-rest clip has no seat, so its legs are replaced (seated) and the root is
// lowered onto the chair (AVATAR_POSITION).

type Shot = Pick<ScenarioScene, 'cameraPosition' | 'cameraTarget' | 'cameraFov'>;
const shot = (index: number): Shot => {
  const { position, target, fov } = LIBRARY_SHOTS[index];
  return { cameraPosition: [...position], cameraTarget: [...target], cameraFov: fov };
};
const ACROSS = shot(0), CLOSE = shot(1), WINDOW_SIDE = shot(2), AISLE_SIDE = shot(3), WIDE = shot(4);

const CUT = { cameraPreset: 'hold', cameraTransitionDuration: 0, cameraTransitionEasing: 'cut' } as const;
const glide = (seconds: number) => ({ cameraPreset: 'hold', cameraTransitionDuration: seconds, cameraTransitionEasing: 'smooth' } as const);

const shion = (config: ScenarioSceneAvatarConfig): ScenarioSceneAvatarConfig => ({
  visible: true, position: AVATAR_POSITION, rotationY: 0, seated: true,
  motion: resolveAssetUrl('/animations/chin_rest.fbx'), motionLoop: true, lookAtTarget: 'player',
  expression: 'neutral', expressionWeight: 1.0, ...config,
});
const SHION = { speaker: 'シオン', speakerCharacterId: 'shion', dialogueTarget: 'player' } as const;

const voice = (name: string) => resolveAssetUrl(`/voices/${name}.mp3`);

/** Viewing check for the painted library: the same seat in the morning, at noon and after school. */
export function getPaintedLibraryScenario(): ScenarioPackage {
  const period = (id: string, scenePreset: ScenePresetId, location: string, narration: string, line: string, expression: string): ScenarioScene[] => [
    {
      id: `${id}_1`, location, scenePreset, ...WIDE, ...CUT, cameraPreset: 'pushIn', cameraStrength: 0.3,
      text: narration,
      autoNextSec: 2.2,
      avatars: { shion: shion({ lookAtTarget: 'forward' }) },
    },
    {
      id: `${id}_2`, location, ...SHION, ...ACROSS, ...glide(1.6),
      text: line,
      voiceUrl: voice(`pl_${id}_2`),
      autoNextSec: 0.8,
      avatars: { shion: shion({ expression }) },
    },
    {
      id: `${id}_3`, location, ...SHION, ...(id === 'evening' ? CLOSE : id === 'morning' ? WINDOW_SIDE : AISLE_SIDE), ...CUT,
      text: '「……用がないなら、静かにしてて」',
      voiceUrl: voice(`pl_${id}_3`),
      autoNextSec: id === 'evening' ? 1.2 : 1.0,
      avatars: { shion: shion({ expression: 'neutral' }) },
    },
  ];
  const scenes: ScenarioScene[] = [
    ...period('morning', 'morning_school', '朝の図書室', '始業前の図書室。窓際の席で、シオンが頬杖をついてページをめくっている。', '「……おはよう。朝から図書室なんて、珍しいのね」', 'neutral'),
    ...period('day', 'day_school', '昼休みの図書室', '昼休みの図書室。木漏れ日が机の上で揺れている。', '「また来たの？ ……別に、嫌とは言ってない」', 'relax'),
    ...period('evening', 'evening_school', '放課後の図書室', '放課後の図書室。西日が本棚を橙色に染めている。', '「もうこんな時間。……あなたといると、読むのが進まない」', 'relax'),
  ];
  return {
    id: 'painted-library',
    title: '図書室のシオン（簡易3D）',
    stage: 'painted-library',
    bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
    bgmVolume: 0.12,
    characters: [
      { id: 'shion', character: resolveAssetUrl('/models/shion/shion-school.vrm'), position: AVATAR_POSITION, rotationY: 0 },
    ],
    chapters: [{ id: 'library', title: '図書室', scenes }],
  };
}
