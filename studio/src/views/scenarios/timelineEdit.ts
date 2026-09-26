import type { AvatarTransition, ScenarioScene, SceneTransition } from '@anime-vrm/scenario';

/** タイムラインの行：カメラ（シーン全体）か、キャラごと */
export type LaneId = { kind: 'camera' } | { kind: 'avatar'; id: string };
export type KeyRef = { lane: LaneId; index: number };

const round = (t: number) => Math.max(0, Math.round(t * 100) / 100);
const byTime = <T extends { at: number }>(keys: T[]) => [...keys].sort((a, b) => a.at - b.at);

export function laneKeys(scene: ScenarioScene, lane: LaneId): Array<AvatarTransition | SceneTransition> {
  return lane.kind === 'camera' ? (scene.transitions ?? []) : (scene.avatars?.[lane.id]?.transitions ?? []);
}

function setLaneKeys(scene: ScenarioScene, lane: LaneId, keys: Array<AvatarTransition | SceneTransition>): ScenarioScene {
  const sorted = byTime(keys);
  if (lane.kind === 'camera') {
    const { transitions: _old, ...rest } = scene;
    return sorted.length ? { ...rest, transitions: sorted as SceneTransition[] } : rest;
  }
  const { transitions: _oldKeys, ...avatar } = scene.avatars?.[lane.id] ?? {};
  return { ...scene, avatars: { ...scene.avatars, [lane.id]: sorted.length ? { ...avatar, transitions: sorted as AvatarTransition[] } : avatar } };
}

/** キーを足して、並べ替えたあとの位置を返す */
export function addKey(scene: ScenarioScene, lane: LaneId, key: AvatarTransition | SceneTransition): { scene: ScenarioScene; index: number } {
  const added = { ...key, at: round(key.at) };
  const next = setLaneKeys(scene, lane, [...laneKeys(scene, lane), added]);
  return { scene: next, index: laneKeys(next, lane).indexOf(added) };
}

export function updateKey(scene: ScenarioScene, ref: KeyRef, key: AvatarTransition | SceneTransition): { scene: ScenarioScene; index: number } {
  const keys = laneKeys(scene, ref.lane).map((k, i) => (i === ref.index ? { ...key, at: round(key.at) } : k));
  const moved = keys[ref.index];
  const next = setLaneKeys(scene, ref.lane, keys);
  return { scene: next, index: laneKeys(next, ref.lane).indexOf(moved) };
}

export function removeKey(scene: ScenarioScene, ref: KeyRef): ScenarioScene {
  return setLaneKeys(scene, ref.lane, laneKeys(scene, ref.lane).filter((_, i) => i !== ref.index));
}

/** キーの種類（色分け用） */
export function keyKinds(key: AvatarTransition | SceneTransition): string[] {
  const kinds: string[] = [];
  if ('expression' in key && key.expression !== undefined) kinds.push('expression');
  if ('motion' in key && key.motion !== undefined) kinds.push('motion');
  if ('lookAtTarget' in key && (key.lookAtTarget !== undefined || key.headTurn !== undefined)) kinds.push('gaze');
  if ('visible' in key && key.visible !== undefined) kinds.push('visible');
  if ('camera' in key && (key.camera !== undefined || key.cameraPose !== undefined)) kinds.push('camera');
  return kinds;
}
