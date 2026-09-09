import * as T from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export const sources = [
  ['Standing Idle', '自然に立つ', '全身'], ['Walking', '歩く', '全身'], ['Jogging', '走る', '全身'],
  ['Standing Greeting', '手を振る', '右腕'], ['Salute', '敬礼する', '右腕'], ['Quick Formal Bow', 'お辞儀', '上半身'],
  ['Acknowledging', 'うなずく', '上半身'], ['Excited', '喜ぶ', '全身'], ['Angry', '怒る', '上半身'],
  ['Dismissing Gesture', '払いのける', '右腕'], ['Punching', 'パンチ', '上半身'],
  ['@raise', '手を挙げる', '右腕'], ['@twist', '腰を捻る', '体幹'], ['@bend', '腰を曲げる', '体幹'],
  ['@hair', '髪をかきあげる', '右腕'],
];
export const masks = ['全身', '上半身', '下半身', '右腕', '左腕', '体幹', '頭'];
export interface Layer { id: string; source: string; mask: string; weight: number; start: number; duration: number; speed: number; from: number; to: number; fade: number; loop: boolean; enabled: boolean; }
export interface Recipe { version: 1; duration: number; fps: number; layers: Layer[]; }
export interface Rest { node: T.Object3D; p: T.Vector3; q: T.Quaternion; s: T.Vector3; world: T.Quaternion; parentWorld: T.Quaternion; }
interface Source { root: T.Group; clip: T.AnimationClip; rest: Map<string, Rest>; tracks: { bone: string; property: string; sample: T.Interpolant }[]; }
const clean = (name: string) => name.replace(/^.*mixamorig\d*[:_]?/i, '');
export function matches(name: string, mask: string) {
  const n = clean(name);
  if (mask === '全身') return true;
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
  root!: T.Group;
  rest!: Map<string, Rest>;
  async load(name: string) {
    if (name.startsWith('@') || this.cache.has(name)) return;
    const root = await new FBXLoader().loadAsync(`${import.meta.env.BASE_URL}animations/${encodeURIComponent(name)}.fbx`);
    const clip = root.animations[0];
    if (!clip) throw new Error(`${name}: アニメーションがありません`);
    const tracks = clip.tracks.map(track => { const dot = track.name.lastIndexOf('.'); return { bone: clean(track.name.slice(0, dot)), property: track.name.slice(dot + 1), sample: (track as T.KeyframeTrack & { createInterpolant(): T.Interpolant }).createInterpolant() }; });
    this.cache.set(name, { root, clip, rest: restOf(root), tracks });
  }
  async init() { await this.load('Standing Idle'); this.root = this.cache.get('Standing Idle')!.root; this.rest = restOf(this.root); }
  frames(name: string) { return Math.floor((this.cache.get(name)?.clip.duration ?? 2) * 30); }
  sample(recipe: Recipe, time: number) {
    for (const r of this.rest.values()) { r.node.position.copy(r.p); r.node.quaternion.copy(r.q); r.node.scale.copy(r.s); }
    // Idle is the stable underlying pose, while each card overrides only its selected region.
    this.applySource('Standing Idle', time % this.cache.get('Standing Idle')!.clip.duration, '全身', 1);
    for (const layer of recipe.layers) {
      if (!layer.enabled || time < layer.start || time > layer.start + layer.duration) continue;
      const elapsed = time - layer.start;
      const edge = layer.fade <= 0 ? 1 : Math.min(1, elapsed / layer.fade, (layer.duration - elapsed) / layer.fade);
      const w = layer.weight * T.MathUtils.smoothstep(Math.max(0, edge), 0, 1);
      const length = Math.max(1 / 30, (layer.to - layer.from) / 30);
      const phase = elapsed * layer.speed;
      const local = layer.from / 30 + (layer.loop ? phase % length : Math.min(length, phase));
      if (layer.source.startsWith('@')) this.procedural(layer.source, local, layer.mask, w);
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
  procedural(name: string, time: number, mask: string, weight: number) {
    const amount = T.MathUtils.smoothstep(Math.min(time / .7, 1), 0, 1) * weight;
    const rotate = (bone: string, x: number, y: number, z: number) => {
      const r = this.rest.get(bone); if (r && matches(bone, mask)) r.node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x * amount, y * amount, z * amount)));
    };
    if (name === '@twist') { rotate('Spine', 0, .35, 0); rotate('Spine1', 0, .45, 0); }
    if (name === '@bend') { rotate('Spine', .35, 0, 0); rotate('Spine1', .45, 0, 0); }
    if (name === '@raise') { rotate('RightArm', 0, 0, -2.5); rotate('RightForeArm', 0, -.25, 0); }
    if (name === '@hair') this.hairReach(time, mask, amount);
  }
  private hairReach(time: number, mask: string, amount: number) {
    const head = this.rest.get('Head')?.node, hand = this.rest.get('RightHand')?.node;
    const joints = ['RightForeArm', 'RightArm'].filter(name => matches(name, mask)).map(name => this.rest.get(name)!.node);
    if (!head || !hand || !joints.length || amount <= 0) return;
    const before = joints.map(joint => joint.quaternion.clone());
    head.updateWorldMatrix(true, false);
    const scale = head.getWorldScale(new T.Vector3()).x;
    const sweep = T.MathUtils.smoothstep(time, .7, 1.8);
    const target = head.getWorldPosition(new T.Vector3()).add(new T.Vector3(-10 + sweep * 2, 9 + sweep * 3, 9 - sweep * 14).multiplyScalar(scale));
    // A short CCD reach puts the hand near the temple while retaining the same baked FBX path.
    for (let iteration = 0; iteration < 12; iteration++) for (const joint of joints) {
      joint.updateWorldMatrix(true, true);
      const origin = joint.getWorldPosition(new T.Vector3());
      const from = hand.getWorldPosition(new T.Vector3()).sub(origin).normalize();
      const to = target.clone().sub(origin).normalize();
      const worldDelta = new T.Quaternion().setFromUnitVectors(from, to);
      const parent = joint.parent!.getWorldQuaternion(new T.Quaternion());
      joint.quaternion.premultiply(parent.clone().invert().multiply(worldDelta).multiply(parent));
    }
    joints.forEach((joint, index) => joint.quaternion.copy(before[index].slerp(joint.quaternion, amount)));
    hand.updateWorldMatrix(true, false);
  }
}
export function newLayer(source: string, engine: MotionEngine, duration: number): Layer {
  return { id: crypto.randomUUID(), source, mask: sources.find(s => s[0] === source)?.[2] ?? '全身', weight: 1, start: 0, duration, speed: 1, from: 0, to: engine.frames(source), fade: .3, loop: !source.startsWith('@'), enabled: true };
}
export function validateRecipe(value: unknown): Recipe {
  const r = value as Recipe;
  const finite = (v: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!r || r.version !== 1 || !finite(r.duration, .5, 60) || ![24, 30, 60].includes(r.fps) || !Array.isArray(r.layers) || r.layers.length > 32) throw new Error('レシピの形式が正しくありません');
  for (const l of r.layers) if (!sources.some(s => s[0] === l.source) || !masks.includes(l.mask) || !finite(l.weight, 0, 1) || !finite(l.start, 0, 60) || !finite(l.duration, .1, 60) || !finite(l.speed, .1, 3) || !finite(l.from, 0, 100000) || !finite(l.to, l.from + 1, 100001) || !finite(l.fade, 0, 5) || typeof l.loop !== 'boolean' || typeof l.enabled !== 'boolean') throw new Error('レシピの動作設定が正しくありません');
  return { version: 1, duration: r.duration, fps: r.fps, layers: r.layers.map(l => ({ ...l, id: crypto.randomUUID() })) };
}
