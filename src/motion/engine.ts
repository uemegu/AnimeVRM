import * as T from 'three';
import { basics } from './basics';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export const sources = [
  ['Standing Idle', '自然に立つ', '全身'], ['Walking', '歩く', '全身'], ['Jogging', '走る', '全身'],
  ['Standing Greeting', '手を振る', '右腕'], ['Salute', '敬礼する', '右腕'], ['Quick Formal Bow', 'お辞儀', '上半身'],
  ['Acknowledging', 'うなずく', '上半身'], ['Excited', '喜ぶ', '全身'], ['Angry', '怒る', '上半身'],
  ['Dismissing Gesture', '払いのける', '右腕'], ['Punching', 'パンチ', '上半身'],
  ['@raise', '手を挙げる', '右腕'], ['@twist', '腰を捻る', '体幹'], ['@bend', '腰を曲げる', '体幹'],
  ['@hair', '髪をかきあげる', '右腕'],
  ...Object.entries(basics).map(([id, pose]) => [id, pose.label, pose.mask]),
];
export const masks = ['全身', '上半身', '下半身', '右腕', '左腕', '体幹', '頭', '右手', '左手'];
export interface Layer { id: string; source: string; mask: string; weight: number; start: number; duration: number; speed: number; from: number; to: number; fade: number; loop: boolean; enabled: boolean; repeatEvery?: number; envelope?: 'flat' | 'sine'; poseMode?: 'motion' | 'hold'; contactGap?: number; }
export interface Recipe { version: 1; duration: number; fps: number; layers: Layer[]; loop?: boolean; transition?: number; }
export interface Rest { node: T.Object3D; p: T.Vector3; q: T.Quaternion; s: T.Vector3; world: T.Quaternion; parentWorld: T.Quaternion; }
interface Source { root: T.Group; clip: T.AnimationClip; rest: Map<string, Rest>; tracks: { bone: string; property: string; sample: T.Interpolant }[]; }
export interface SavedMotion { id: string; name: string; duration: number; mask: string; times: number[]; tracks: { bone: string; positions: number[]; rotations: number[] }[]; }
export const totalDuration = (recipe: Recipe) => recipe.duration + (recipe.loop ? recipe.transition ?? 1 : 0);
const clean = (name: string) => name.replace(/^.*mixamorig\d*[:_]?/i, '');
export function matches(name: string, mask: string) {
  const n = clean(name);
  if (mask === '全身') return true;
  if (mask === '右手' || mask === '左手') return n.startsWith(mask === '右手' ? 'RightHand' : 'LeftHand');
  if (mask === '右腕' || mask === '左腕') return n.startsWith(mask === '右腕' ? 'Right' : 'Left') && /Shoulder|Arm|Hand/.test(n);
  if (mask === '体幹') return /Spine/.test(n);
  if (mask === '頭') return /Head|Neck/.test(n);
  const lower = /Hips|UpLeg|Leg|Foot|Toe/.test(n);
  return mask === '下半身' ? lower : !lower;
}
function restOf(root: T.Group) {
  root.updateMatrixWorld(true);
  const rest = new Map<string, Rest>();
  root.traverse(node => { if ((node as T.Bone).isBone) rest.set(clean(node.name), { node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone(), world: node.getWorldQuaternion(new T.Quaternion()), parentWorld: node.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion() }); });
  return rest;
}
export class MotionEngine {
  cache = new Map<string, Source>();
  custom = new Map<string, SavedMotion>();
  private customTracks = new Map<string, { bone: string; p: T.Interpolant; q: T.Interpolant }[]>();
  root!: T.Group;
  rest!: Map<string, Rest>;
  async load(name: string) {
    if (name.startsWith('saved:')) { if (!this.custom.has(name)) throw new Error('保存した動作が見つかりません'); return; }
    if (name.startsWith('@') || this.cache.has(name)) return;
    const root = await new FBXLoader().loadAsync(`${import.meta.env.BASE_URL}animations/${encodeURIComponent(name)}.fbx`);
    const clip = root.animations[0];
    if (!clip) throw new Error(`${name}: アニメーションがありません`);
    const tracks = clip.tracks.map(track => { const dot = track.name.lastIndexOf('.'); return { bone: clean(track.name.slice(0, dot)), property: track.name.slice(dot + 1), sample: (track as T.KeyframeTrack & { createInterpolant(): T.Interpolant }).createInterpolant() }; });
    this.cache.set(name, { root, clip, rest: restOf(root), tracks });
  }
  async init() { await this.load('Standing Idle'); this.root = this.cache.get('Standing Idle')!.root; this.rest = restOf(this.root); }
  frames(name: string) { return Math.floor((this.custom.get(name)?.duration ?? this.cache.get(name)?.clip.duration ?? 2) * 30); }
  sample(recipe: Recipe, time: number) {
    if (recipe.loop && time > recipe.duration) {
      this.sampleContent(recipe, recipe.duration);
      const end = [...this.rest.values()].map(r => ({ p: r.node.position.clone(), q: r.node.quaternion.clone() }));
      this.sampleContent(recipe, 0);
      const blend = T.MathUtils.smoothstep(time, recipe.duration, totalDuration(recipe));
      [...this.rest.values()].forEach((r, index) => { r.node.position.copy(end[index].p.lerp(r.node.position, blend)); r.node.quaternion.copy(end[index].q.slerp(r.node.quaternion, blend)); });
    } else this.sampleContent(recipe, Math.max(0, time));
    this.rest.get('Hips')?.node.updateWorldMatrix(true, true);
  }
  private sampleContent(recipe: Recipe, time: number) {
    for (const r of this.rest.values()) { r.node.position.copy(r.p); r.node.quaternion.copy(r.q); r.node.scale.copy(r.s); }
    // Idle is the stable underlying pose, while each card overrides only its selected region.
    this.applySource('Standing Idle', recipe.loop && recipe.transition === 0 ? 0 : time % this.cache.get('Standing Idle')!.clip.duration, '全身', 1);
    for (const layer of recipe.layers) {
      if (!layer.enabled || time < layer.start) continue;
      const elapsed = layer.repeatEvery ? (time - layer.start) % layer.repeatEvery : time - layer.start;
      if (elapsed > layer.duration) continue;
      const edge = layer.envelope === 'sine' ? 1 : layer.fade <= 0 ? 1 : Math.min(1, !layer.repeatEvery && recipe.loop && layer.start === 0 ? 1 : elapsed / layer.fade, !layer.repeatEvery && recipe.loop && layer.start + layer.duration >= recipe.duration ? 1 : (layer.duration - elapsed) / layer.fade);
      const w = layer.weight * T.MathUtils.smoothstep(Math.max(0, edge), 0, 1) * (layer.envelope === 'sine' ? Math.sin(Math.PI * elapsed / layer.duration) : 1);
      const length = Math.max(1 / 30, (layer.to - layer.from) / 30);
      const phase = elapsed * layer.speed;
      const local = layer.poseMode === 'hold' ? layer.to / 30 : layer.from / 30 + (layer.loop ? phase % length : Math.min(length, phase));
      if (layer.source.startsWith('@')) this.procedural(layer.source, local, layer.mask, w, layer.contactGap ?? 0);
      else if (layer.source.startsWith('saved:')) this.applySaved(layer.source, local, layer.mask, w);
      else this.applySource(layer.source, local, layer.mask, w);
    }
    this.root.updateMatrixWorld(true);
  }
  applySource(name: string, time: number, mask: string, weight: number) {
    const source = this.cache.get(name); if (!source) return;
    for (const track of source.tracks) {
      const r = this.rest.get(track.bone), sr = source.rest.get(track.bone);
      if (!r || !sr || !matches(track.bone, mask)) continue;
      const v = track.sample.evaluate(time);
      if (track.property === 'quaternion') {
        const q = new T.Quaternion().fromArray(v).premultiply(sr.parentWorld).multiply(sr.world.clone().invert()).multiply(r.world).premultiply(r.parentWorld.clone().invert());
        r.node.quaternion.slerp(q, weight);
      } else if (track.property === 'position' && track.bone === 'Hips') {
        // In-place motion: retain vertical bounce; avoid sliding back at every walk loop.
        const p = r.p.clone(); p.y += (v[1] - sr.p.y) * (r.p.y / (sr.p.y || 1)); r.node.position.lerp(p, weight);
      }
    }
  }
  procedural(name: string, time: number, mask: string, weight: number, contactGap = 0) {
    const amount = T.MathUtils.smoothstep(Math.min(time / .7, 1), 0, 1) * weight;
    const rotate = (bone: string, x: number, y: number, z: number) => {
      const r = this.rest.get(bone); if (r && matches(bone, mask)) r.node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x * amount, y * amount, z * amount)));
    };
    if (name === '@twist') { rotate('Spine', 0, .35, 0); rotate('Spine1', 0, .45, 0); }
    if (name === '@bend') { rotate('Spine', .35, 0, 0); rotate('Spine1', .45, 0, 0); }
    if (name === '@raise') { rotate('RightArm', 0, 0, -2.5); rotate('RightForeArm', 0, -.25, 0); }
    if (name === '@hair') this.hairReach(time, mask, amount, contactGap);
    const pose = basics[name];
    if (!pose) return;
    for (const rotation of pose.rotations ?? []) rotate(...rotation);
    if (pose.reach) this.reach(pose.reach.side, pose.reach.anchor, new T.Vector3(...pose.reach.offset), mask, amount, pose.reach.contact, contactGap);
    if (pose.fingers) {
      const { side, open } = pose.fingers;
      for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let joint = 1; joint <= 3; joint++) {
        const bone = `${side}Hand${finger}${joint}`, r = this.rest.get(bone);
        if (!r || !matches(bone, mask)) continue;
        const curl = open.includes(finger) ? 0 : finger === 'Thumb' ? .55 : 1.25;
        const q = r.q.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(curl, 0, 0)));
        r.node.quaternion.slerp(q, amount);
      }
    }
  }
  private hairReach(time: number, mask: string, amount: number, gap: number) {
    const sweep = T.MathUtils.smoothstep(time, .7, 1.8);
    this.reach('Right', 'Head', new T.Vector3(-18, 2 + sweep * 3, 9 - sweep * 8), mask, amount, 'head', gap);
  }
  private reach(side: 'Right' | 'Left', anchorName: string, offset: T.Vector3, mask: string, amount: number, contact?: 'head' | 'front' | 'hip', gap = 0) {
    const upper = this.rest.get(`${side}Arm`)?.node, elbow = this.rest.get(`${side}ForeArm`)?.node, hand = this.rest.get(`${side}Hand`)?.node, anchor = this.rest.get(anchorName)?.node;
    if (!upper || !elbow || !hand || !anchor || !matches(upper.name, mask) || !matches(elbow.name, mask) || amount <= 0) return;
    this.rest.get('Hips')!.node.updateWorldMatrix(true, true);
    const before = [upper.quaternion.clone(), elbow.quaternion.clone(), hand.quaternion.clone()];
    const chest = this.rest.get('Spine2')!;
    const body = chest.node.getWorldQuaternion(new T.Quaternion()).multiply(chest.world.clone().invert());
    const scale = upper.getWorldScale(new T.Vector3()).x;
    const a = upper.getWorldPosition(new T.Vector3()), b = elbow.getWorldPosition(new T.Vector3()), c = hand.getWorldPosition(new T.Vector3());
    const normal = new T.Vector3(contact === 'front' ? 0 : side === 'Right' ? -1 : 1, 0, contact === 'front' ? 1 : 0);
    if (contact) offset.addScaledVector(normal, gap);
    const target = anchor.getWorldPosition(new T.Vector3()).add(offset.multiplyScalar(scale).applyQuaternion(body));
    const length1 = a.distanceTo(b), length2 = b.distanceTo(c);
    const direction = target.clone().sub(a).normalize();
    const distance = T.MathUtils.clamp(a.distanceTo(target), Math.abs(length1 - length2) + .01 * scale, length1 + length2 - .1 * scale);
    target.copy(a).addScaledVector(direction, distance);
    // Fixed body-relative pole: the elbow always bends outwards/downwards, never changes branch.
    const pole = new T.Vector3(side === 'Right' ? -1 : 1, -.65, .35).applyQuaternion(body);
    pole.addScaledVector(direction, -pole.dot(direction));
    if (pole.lengthSq() < 1e-6) pole.set(0, 0, 1).applyQuaternion(body).addScaledVector(direction, -new T.Vector3(0, 0, 1).applyQuaternion(body).dot(direction));
    pole.normalize();
    const along = (length1 * length1 - length2 * length2 + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, length1 * length1 - along * along));
    const desiredElbow = a.clone().addScaledVector(direction, along).addScaledVector(pole, height);
    const aim = (joint: T.Object3D, child: T.Object3D, destination: T.Vector3) => {
      joint.updateWorldMatrix(true, true);
      const origin = joint.getWorldPosition(new T.Vector3());
      const delta = new T.Quaternion().setFromUnitVectors(child.getWorldPosition(new T.Vector3()).sub(origin).normalize(), destination.clone().sub(origin).normalize());
      const parent = joint.parent!.getWorldQuaternion(new T.Quaternion());
      joint.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    };
    aim(upper, elbow, desiredElbow); aim(elbow, hand, target);
    if (contact) {
      // Keep the open palm tangent to the body. The wrist is the IK target, so
      // moving it outside alone would still allow inward-pointing fingers to penetrate.
      const fingerDirection = contact === 'hip' ? new T.Vector3(0, -1, 0) : contact === 'front' && anchorName === 'Spine2' ? new T.Vector3(side === 'Right' ? 1 : -1, 0, 0) : new T.Vector3(0, 1, 0);
      const palmDirection = normal.clone().negate();
      const wristWorld = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(fingerDirection.clone().cross(palmDirection).normalize(), fingerDirection, palmDirection)).premultiply(body);
      hand.updateWorldMatrix(true, false);
      hand.quaternion.copy(hand.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(wristWorld));
      hand.quaternion.copy(before[2].slerp(hand.quaternion, amount));
      for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let joint = 1; joint <= 3; joint++) {
        const r = this.rest.get(`${side}Hand${finger}${joint}`); if (r && matches(r.node.name, mask)) r.node.quaternion.slerp(r.q, amount);
      }
    }
    upper.quaternion.copy(before[0].slerp(upper.quaternion, amount)); elbow.quaternion.copy(before[1].slerp(elbow.quaternion, amount));
    upper.updateWorldMatrix(true, true);
  }
  removeSaved(id: string) { this.custom.delete(id); this.customTracks.delete(id); }
  registerSaved(motion: SavedMotion) {
    this.custom.set(motion.id, motion);
    this.customTracks.set(motion.id, motion.tracks.map(track => ({ bone: track.bone,
      p: new T.LinearInterpolant(new Float32Array(motion.times), new Float32Array(track.positions), 3), q: new T.QuaternionLinearInterpolant(new Float32Array(motion.times), new Float32Array(track.rotations), 4) })));
  }
  private applySaved(id: string, time: number, mask: string, weight: number) {
    for (const track of this.customTracks.get(id) ?? []) {
      const r = this.rest.get(track.bone); if (!r || !matches(track.bone, mask)) continue;
      r.node.position.lerp(new T.Vector3().fromArray(track.p.evaluate(time)), weight);
      r.node.quaternion.slerp(new T.Quaternion().fromArray(track.q.evaluate(time)), weight);
    }
  }
  bakeSaved(recipe: Recipe, name: string): SavedMotion {
    const active = recipe.layers.filter(l => l.enabled && l.weight > 0);
    if (!active.length) throw new Error('保存する動作を追加してください');
    const duration = totalDuration(recipe), times = Array.from({ length: Math.ceil(duration * 30 - 1e-8) + 1 }, (_, i) => Math.min(i / 30, duration));
    const affected = [...this.rest.entries()].filter(([bone]) => active.some(l => matches(bone, l.mask) && (!l.source.startsWith('saved:') || this.custom.get(l.source)?.tracks.some(t => t.bone === bone))));
    const tracks = affected.map(([bone]) => ({ bone, positions: [] as number[], rotations: [] as number[] }));
    for (const time of times) { this.sample(recipe, time); affected.forEach(([, r], i) => { tracks[i].positions.push(...r.node.position.toArray().map(v => Number(v.toFixed(6)))); tracks[i].rotations.push(...r.node.quaternion.toArray().map(v => Number(v.toFixed(6)))); }); }
    return { id: `saved:${crypto.randomUUID()}`, name, duration, mask: active.every(l => l.mask === active[0].mask) ? active[0].mask : '全身', times, tracks };
  }

}
export function newLayer(source: string, engine: MotionEngine, duration: number): Layer {
  return { id: crypto.randomUUID(), source, mask: engine.custom.get(source)?.mask ?? sources.find(s => s[0] === source)?.[2] ?? '全身', weight: 1, start: 0, duration, speed: 1, from: 0, to: engine.frames(source), fade: .3, loop: !source.startsWith('@'), enabled: true };
}
export function validateRecipe(value: unknown, savedIds = new Set<string>()): Recipe {
  const r = value as Recipe;
  const finite = (v: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!r || r.version !== 1 || !finite(r.duration, .5, 60) || ![24, 30, 60].includes(r.fps) || !Array.isArray(r.layers) || r.layers.length > 32) throw new Error('レシピの形式が正しくありません');
  for (const l of r.layers) if (!(sources.some(s => s[0] === l.source) || savedIds.has(l.source)) || !masks.includes(l.mask) || !finite(l.weight, 0, 1) || !finite(l.start, 0, 60) || !finite(l.duration, .1, 60) || !finite(l.speed, .1, 3) || !finite(l.from, 0, 100000) || !finite(l.to, l.from + 1, 100001) || !finite(l.fade, 0, 5) || typeof l.loop !== 'boolean' || typeof l.enabled !== 'boolean') throw new Error('レシピの動作設定が正しくありません');
  for (const l of r.layers) if (l.repeatEvery !== undefined && l.repeatEvery !== 0 && !finite(l.repeatEvery, l.duration, 60) || l.envelope !== undefined && !['flat', 'sine'].includes(l.envelope) || l.poseMode !== undefined && !['motion', 'hold'].includes(l.poseMode) || l.contactGap !== undefined && !finite(l.contactGap, -10, 20)) throw new Error('配置の繰り返し・接触設定が正しくありません');
  if (r.loop !== undefined && typeof r.loop !== 'boolean' || r.transition !== undefined && !finite(r.transition, 0, 10)) throw new Error('ループ設定が正しくありません');
  return { version: 1, duration: r.duration, fps: r.fps, loop: r.loop ?? false, transition: r.transition ?? 1, layers: r.layers.map(l => ({ ...l, id: crypto.randomUUID() })) };
}

export function validateSaved(value: unknown): SavedMotion[] {
  if (!Array.isArray(value) || value.length > 80) throw new Error('保存動作の形式が正しくありません');
  const ids = new Set<string>();
  for (const m of value as SavedMotion[]) {
    if (!m || typeof m.id !== 'string' || !/^saved:[a-zA-Z0-9-]+$/.test(m.id) || ids.has(m.id) || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 60 || !Number.isFinite(m.duration) || m.duration < .1 || m.duration > 70 || !masks.includes(m.mask) || !Array.isArray(m.times) || m.times.length < 2 || m.times.length > 4201 || m.times[0] !== 0 || Math.abs(m.times.at(-1)! - m.duration) > .001 || m.times.some((v, i) => !Number.isFinite(v) || i > 0 && v <= m.times[i - 1]) || !Array.isArray(m.tracks) || m.tracks.length > 100) throw new Error('保存動作のデータが正しくありません');
    ids.add(m.id); const bones = new Set<string>();
    for (const t of m.tracks) {
      if (!t || typeof t.bone !== 'string' || !/^[a-zA-Z0-9_]+$/.test(t.bone) || bones.has(t.bone) || !Array.isArray(t.positions) || !Array.isArray(t.rotations) || t.positions.length !== m.times.length * 3 || t.rotations.length !== m.times.length * 4 || [...t.positions, ...t.rotations].some(v => !Number.isFinite(v) || Math.abs(v) > 100000)) throw new Error('保存動作のトラックが正しくありません');
      for (let i = 0; i < t.rotations.length; i += 4) if (Math.abs(Math.hypot(...t.rotations.slice(i, i + 4)) - 1) > .01) throw new Error('保存動作の回転が正しくありません');
      bones.add(t.bone);
    }
  }
  return value;
}
