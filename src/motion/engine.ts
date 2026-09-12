import * as T from 'three';
import { basics } from './basics';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export const jointNames: Record<string, string> = { Hips: '腰', Spine: '背骨（下）', Spine1: '胸', Spine2: '胸（上）', Neck: '首', Head: '頭' };
for (const [side, label] of [['Right', '右'], ['Left', '左']]) {
  for (const [bone, name] of Object.entries({ Shoulder: '肩', Arm: '上腕', ForeArm: 'ひじ', Hand: '手首', UpLeg: '股関節', Leg: 'ひざ', Foot: '足首', ToeBase: 'つま先' })) jointNames[side + bone] = label + name;
  for (const [finger, name] of Object.entries({ Thumb: '親指', Index: '人差し指', Middle: '中指', Ring: '薬指', Pinky: '小指' }))
    for (let i = 1; i <= 3; i++) jointNames[`${side}Hand${finger}${i}`] = `${label}${name} ${i}（付け根から）`;
}
export const sources = [
  ['@joint', '関節を自由に曲げる', '全身'],
  ['Standing Idle', '自然に立つ', '全身'], ['Walking', '歩く', '全身'], ['Jogging', '走る', '全身'],
  ['Standing Greeting', '手を振る', '右腕'], ['Salute', '敬礼する', '右腕'], ['Quick Formal Bow', 'お辞儀', '上半身'],
  ['Acknowledging', 'うなずく', '上半身'], ['Excited', '喜ぶ', '全身'], ['Angry', '怒る', '上半身'],
  ['Dismissing Gesture', '払いのける', '右腕'], ['Punching', 'パンチ', '上半身'],
  ['@raise', '手を挙げる', '右腕'], ['@twist', '腰を捻る', '体幹'], ['@bend', '腰を曲げる', '体幹'],
  ['@hair', '髪をかきあげる', '右腕'],
  ...Object.entries(basics).map(([id, pose]) => [id, pose.label, pose.mask]),
];
export const masks = ['全身', '上半身', '下半身', '右腕', '左腕', '体幹', '頭', '右手', '左手', '右手首', '左手首', '右脚', '左脚', '右肩', '左肩', '両肩'];
export interface Layer { id: string; source: string; mask: string; weight: number; start: number; duration: number; speed: number; from: number; to: number; fade: number; loop: boolean; enabled: boolean; repeatEvery?: number; envelope?: 'flat' | 'sine'; poseMode?: 'motion' | 'hold'; contactGap?: number; balance?: boolean; shoulderFollow?: number; joint?: string; jointX?: number; jointY?: number; jointZ?: number; jointSpace?: 'local' | 'world'; jointEase?: number; }
export interface Recipe { version: 1; duration: number; fps: number; layers: Layer[]; loop?: boolean; transition?: number; }
export interface Rest { node: T.Object3D; p: T.Vector3; q: T.Quaternion; s: T.Vector3; world: T.Quaternion; parentWorld: T.Quaternion; }
interface Source { root: T.Group; clip: T.AnimationClip; rest: Map<string, Rest>; tracks: { bone: string; property: string; sample: T.Interpolant }[]; }
export interface SavedMotion { id: string; name: string; duration: number; mask: string; times: number[]; tracks: { bone: string; positions: number[]; rotations: number[] }[]; }
export const totalDuration = (recipe: Recipe) => recipe.duration + (recipe.loop ? recipe.transition ?? 1 : 0);
const clean = (name: string) => name.replace(/^.*mixamorig\d*[:_]?/i, '');
export function matches(name: string, mask: string) {
  const n = clean(name);
  if (mask === '全身') return true;
  if (mask === '両肩') return /^(Right|Left)Shoulder$/.test(n);
  if (mask === '右肩' || mask === '左肩') return n === (mask === '右肩' ? 'RightShoulder' : 'LeftShoulder');
  if (mask === '右手首' || mask === '左手首') return n === (mask === '右手首' ? 'RightHand' : 'LeftHand');
  if (mask === '右脚' || mask === '左脚') return n.startsWith(mask === '右脚' ? 'Right' : 'Left') && /UpLeg|Leg|Foot|Toe/.test(n);
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
  groundAdjustment?: () => number;
  private grounded = false;
  private floating = false;
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
      const endGrounded = this.grounded, endFloating = this.floating;
      const end = [...this.rest.values()].map(r => ({ p: r.node.position.clone(), q: r.node.quaternion.clone() }));
      this.sampleContent(recipe, 0);
      this.grounded ||= endGrounded; this.floating ||= endFloating;
      const blend = T.MathUtils.smoothstep(time, recipe.duration, totalDuration(recipe));
      [...this.rest.values()].forEach((r, index) => { r.node.position.copy(end[index].p.lerp(r.node.position, blend)); r.node.quaternion.copy(end[index].q.slerp(r.node.quaternion, blend)); });
    } else this.sampleContent(recipe, T.MathUtils.clamp(time, 0, recipe.duration));
    if (this.grounded && !this.floating && this.groundAdjustment) this.rest.get('Hips')!.node.position.y += this.groundAdjustment();
    this.rest.get('Hips')?.node.updateWorldMatrix(true, true);
  }
  private sampleContent(recipe: Recipe, time: number) {
    this.grounded = false; this.floating = false;
    for (const r of this.rest.values()) { r.node.position.copy(r.p); r.node.quaternion.copy(r.q); r.node.scale.copy(r.s); }
    // Idle is the stable underlying pose, while each card overrides only its selected region.
    this.applySource('Standing Idle', recipe.loop && recipe.transition === 0 ? 0 : time % this.cache.get('Standing Idle')!.clip.duration, '全身', 1);
    for (const layer of recipe.layers) {
      if (!layer.enabled || time < layer.start) continue;
      const offset = time - layer.start;
      // At the non-looping endpoint, finish the preceding repeat instead of
      // sampling the first frame of a repeat that will never be played.
      const cycle = layer.repeatEvery ? Math.max(0, !recipe.loop && time >= recipe.duration ? Math.ceil(offset / layer.repeatEvery) - 1 : Math.floor(offset / layer.repeatEvery)) : 0;
      const elapsed = offset - cycle * (layer.repeatEvery ?? 0);
      const holdsEnd = !recipe.loop && layer.start + cycle * (layer.repeatEvery ?? 0) + layer.duration >= recipe.duration - 1e-8;
      if (elapsed > layer.duration) continue;
      const edge = layer.envelope === 'sine' ? 1 : layer.fade <= 0 ? 1 : Math.min(1, !layer.repeatEvery && recipe.loop && layer.start === 0 ? 1 : elapsed / layer.fade, (holdsEnd || !layer.repeatEvery && recipe.loop && layer.start + layer.duration >= recipe.duration) ? 1 : (layer.duration - elapsed) / layer.fade);
      const w = layer.weight * T.MathUtils.smoothstep(Math.max(0, edge), 0, 1) * (layer.envelope === 'sine' ? Math.sin(Math.PI * elapsed / layer.duration) : 1);
      const length = Math.max(1 / 30, (layer.to - layer.from) / 30);
      const phase = elapsed * layer.speed;
      const local = layer.poseMode === 'hold' ? layer.to / 30 : layer.from / 30 + (layer.loop ? phase % length : Math.min(length, phase));
      if (layer.source === '@joint') {
        const r = this.rest.get(layer.joint ?? 'RightForeArm');
        if (r && matches(layer.joint ?? 'RightForeArm', layer.mask)) {
          // Timeline-based easing also applies to older held-pose cards and every repeat.
          const ease = Math.min(layer.jointEase ?? .7, layer.duration / 2);
          const amount = w * (ease <= 0 ? 1 : T.MathUtils.smoothstep(elapsed, 0, ease) * (holdsEnd ? 1 : T.MathUtils.smoothstep(layer.duration - elapsed, 0, ease)));
          const delta = new T.Quaternion().setFromEuler(new T.Euler(...[layer.jointX ?? 0, layer.jointY ?? 0, layer.jointZ ?? 0].map(v => T.MathUtils.degToRad(v)) as [number, number, number]));
          delta.copy(new T.Quaternion().slerp(delta, amount));
          if (layer.jointSpace === 'world') {
            r.node.updateWorldMatrix(true, false);
            const parent = r.node.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion();
            r.node.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
          } else r.node.quaternion.multiply(delta);
        }
      }
      else if (layer.source.startsWith('@')) this.procedural(layer.source, local, layer.mask, w, layer.contactGap ?? 0, layer.balance !== false, layer.shoulderFollow ?? 1);
      else if (layer.source.startsWith('saved:')) {
        const before = ['RightArm', 'LeftArm'].map(name => this.rest.get(name)!.node.quaternion.clone());
        this.applySaved(layer.source, local, layer.mask, w);
        // Respect an authored torso. Add support only when a reusable motion
        // contains an arm without any torso tracks and is used in full-body mode.
        const tracks = this.custom.get(layer.source)?.tracks ?? [];
        if (layer.mask === '全身' && layer.balance !== false && !tracks.some(t => /^Spine/.test(t.bone))) {
          ['Right', 'Left'].forEach((side, i) => {
            if (!tracks.some(t => t.bone === `${side}Arm`)) return;
            const strength = Math.min(1, before[i].angleTo(this.rest.get(`${side}Arm`)!.node.quaternion) / 1.5);
            const direction = side === 'Right' ? -1 : 1;
            this.rest.get('Spine')!.node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, .07 * direction * strength)));
            this.rest.get(side === 'Right' ? 'LeftShoulder' : 'RightShoulder')!.node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(.04 * strength, 0, -.035 * direction * strength)));
          });
        }
      }
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
  procedural(name: string, time: number, mask: string, weight: number, contactGap = 0, balance = true, shoulderFollow = 1) {
    const amount = T.MathUtils.smoothstep(Math.min(time / .7, 1), 0, 1) * weight;
    const rotate = (bone: string, x: number, y: number, z: number) => {
      const r = this.rest.get(bone); if (r && matches(bone, mask)) r.node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x * amount, y * amount, z * amount)));
    };
    const pose = basics[name];
    if (mask === '全身' && balance && !pose?.wrist && !pose?.fingers && !pose?.leg) {
      const side = name === '@raise' || name === '@hair' ? 'Right' : pose?.reach?.side;
      if (side) { const direction = side === 'Right' ? -1 : 1; rotate('Spine', 0, 0, .055 * direction); rotate('Spine1', 0, 0, .035 * direction); rotate('Head', 0, 0, -.04 * direction); rotate(side === 'Right' ? 'LeftShoulder' : 'RightShoulder', .04, 0, -.035 * direction); }
      else if (pose?.rotations) for (const [bone, x, y, z] of pose.rotations) {
        if (/Head|Neck/.test(bone)) rotate('Spine1', -.15 * x, -.15 * y, -.15 * z);
        else if (/Spine/.test(bone)) rotate('Head', -.2 * x, -.2 * y, -.2 * z);
      }
    }
    if (name === '@twist') { rotate('Spine', 0, .35, 0); rotate('Spine1', 0, .45, 0); }
    if (name === '@bend') { rotate('Spine', .35, 0, 0); rotate('Spine1', .45, 0, 0); }
    if (name === '@raise') this.reach('Right', 'RightArm', new T.Vector3(-22, 52, 4), mask, amount, undefined, 0, shoulderFollow);
    if (name === '@hair') this.hairReach(time, mask, amount, contactGap, shoulderFollow);
    if (!pose) return;
    if (pose.shoulder) {
      const p = pose.shoulder, phase = time * Math.PI;
      for (const side of p.side ? [p.side] : ['Right', 'Left'] as const)
        this.moveShoulder(side, p.circle ? .25 * Math.sin(phase) : p.elevation, p.circle ? .25 * (1 - Math.cos(phase)) : p.forward, mask, amount);
    }
    if (pose.leg) this.legPose(pose.leg, mask, amount, balance);
    if (pose.wrist) { const w = pose.wrist; const phase = time * Math.PI; rotate(`${w.side}Hand`, w.circle ? .5 * Math.sin(phase) : w.x, w.y, w.circle ? .35 * Math.cos(phase) : w.z); }
    for (const rotation of pose.rotations ?? []) rotate(...rotation);
    if (pose.reach) this.reach(pose.reach.side, pose.reach.anchor, new T.Vector3(...pose.reach.offset), mask, amount, pose.reach.contact, contactGap, shoulderFollow);
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
  private moveShoulder(side: 'Right' | 'Left', elevation: number, forward: number, mask: string, amount: number) {
    const shoulder = this.rest.get(`${side}Shoulder`)?.node;
    if (!shoulder || !matches(shoulder.name, mask) || amount <= 0) return;
    shoulder.updateWorldMatrix(true, true);
    const chest = this.rest.get('Spine2')!;
    const body = chest.node.getWorldQuaternion(new T.Quaternion()).multiply(chest.world.clone().invert());
    const sign = side === 'Right' ? -1 : 1;
    // Anatomical directions in torso space; Mixamo bone-local axes differ by side.
    const delta = new T.Quaternion().setFromEuler(new T.Euler(0, -sign * forward * amount, sign * elevation * amount));
    delta.premultiply(body).multiply(body.clone().invert());
    const parent = shoulder.parent!.getWorldQuaternion(new T.Quaternion());
    shoulder.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    shoulder.updateWorldMatrix(true, true);
  }
  private hairReach(time: number, mask: string, amount: number, gap: number, shoulderFollow: number) {
    const sweep = T.MathUtils.smoothstep(time, .7, 1.8);
    this.reach('Right', 'Head', new T.Vector3(-18, 2 + sweep * 3, 9 - sweep * 8), mask, amount, 'head', gap, shoulderFollow);
  }
  private reach(side: 'Right' | 'Left', anchorName: string, offset: T.Vector3, mask: string, amount: number, contact?: 'head' | 'front' | 'hip', gap = 0, shoulderFollow = 1) {
    const upper = this.rest.get(`${side}Arm`)?.node, elbow = this.rest.get(`${side}ForeArm`)?.node, hand = this.rest.get(`${side}Hand`)?.node, anchor = this.rest.get(anchorName)?.node;
    if (!upper || !elbow || !hand || !anchor || !matches(upper.name, mask) || !matches(elbow.name, mask) || amount <= 0) return;
    this.rest.get('Hips')!.node.updateWorldMatrix(true, true);
    const before = [upper.quaternion.clone(), elbow.quaternion.clone(), hand.quaternion.clone()];
    const chest = this.rest.get('Spine2')!;
    const body = chest.node.getWorldQuaternion(new T.Quaternion()).multiply(chest.world.clone().invert());
    const scale = upper.getWorldScale(new T.Vector3()).x;
    const normal = new T.Vector3(contact === 'front' ? 0 : side === 'Right' ? -1 : 1, 0, contact === 'front' ? 1 : 0);
    if (contact) offset.addScaledVector(normal, gap);
    const target = anchor.getWorldPosition(new T.Vector3()).add(offset.multiplyScalar(scale).applyQuaternion(body));
    // Capture the hand target before moving the clavicle, including Arm-relative
    // targets. Then solve the elbow from the new shoulder origin.
    const relative = target.clone().sub(upper.getWorldPosition(new T.Vector3())).applyQuaternion(body.clone().invert()).divideScalar(scale);
    const elevation = contact === 'hip' ? .18 : .1 + .25 * T.MathUtils.clamp(relative.y / 55, 0, 1);
    const forward = contact === 'hip' ? -.06 : .18 * T.MathUtils.clamp(relative.z / 40, 0, 1);
    this.moveShoulder(side, elevation, forward, mask, amount * shoulderFollow);
    const a = upper.getWorldPosition(new T.Vector3()), b = elbow.getWorldPosition(new T.Vector3()), c = hand.getWorldPosition(new T.Vector3());
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
  private legPose(pose: NonNullable<(typeof basics)[string]['leg']>, mask: string, amount: number, balance: boolean) {
    if (amount <= 0) return;
    const hips = this.rest.get('Hips')!.node;
    if (pose.float) { if (mask === '全身' || mask === '下半身') { hips.position.y += pose.float * amount; this.floating = true; } return; }
    const sides = (['Right', 'Left'] as const).filter(side => matches(`${side}UpLeg`, mask));
    if (!sides.length) return;
    this.grounded = true;
    hips.updateWorldMatrix(true, true);
    const scale = hips.getWorldScale(new T.Vector3()).x;
    const targets = new Map(['Right', 'Left'].map(side => { const foot = this.rest.get(`${side}Foot`)!.node; return [side, { p: foot.getWorldPosition(new T.Vector3()), q: foot.getWorldQuaternion(new T.Quaternion()) }]; }));
    const full = mask === '全身' || mask === '下半身';
    if (full) {
      hips.position.y -= (pose.squat ?? 5) * amount;
      if (pose.side && balance && mask === '全身') { hips.position.x += (pose.side === 'Right' ? 3 : -3) * amount; this.rest.get('Spine')!.node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, (pose.side === 'Right' ? -.04 : .04) * amount))); }
    }
    for (const side of sides) {
      const target = targets.get(side)!;
      if (pose.side === side && pose.offset) target.p.add(new T.Vector3(...pose.offset).multiplyScalar(scale * amount));
      const upper = this.rest.get(`${side}UpLeg`)!.node, knee = this.rest.get(`${side}Leg`)!.node, foot = this.rest.get(`${side}Foot`)!.node;
      this.solveLimb(upper, knee, foot, target.p, new T.Vector3(0, 0, 1));
      foot.quaternion.copy(foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(target.q));
    }
    hips.updateWorldMatrix(true, true);
    // A supporting sole stays at its original level. Explicit float is the only
    // primitive allowed to lift both feet; all corrections are baked into hips.
    const lowest = Math.min(...['Right', 'Left'].map(side => this.rest.get(`${side}Foot`)!.node.getWorldPosition(new T.Vector3()).y));
    const baseline = Math.min(...[...targets.values()].map(t => t.p.y));
    hips.position.y -= (lowest - baseline) / scale;
    hips.updateWorldMatrix(true, true);
  }
  private solveLimb(upper: T.Object3D, joint: T.Object3D, end: T.Object3D, target: T.Vector3, pole: T.Vector3) {
    upper.updateWorldMatrix(true, true);
    const a = upper.getWorldPosition(new T.Vector3()), b = joint.getWorldPosition(new T.Vector3()), c = end.getWorldPosition(new T.Vector3());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), direction = target.clone().sub(a).normalize();
    const distance = T.MathUtils.clamp(a.distanceTo(target), Math.abs(l1 - l2) + 1e-5, l1 + l2 - 1e-5);
    const goal = a.clone().addScaledVector(direction, distance);
    pole.addScaledVector(direction, -pole.dot(direction)); if (pole.lengthSq() < 1e-8) pole.set(1, 0, 0).addScaledVector(direction, -direction.x); pole.normalize();
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    const bend = a.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    for (const [bone, child, position] of [[upper, joint, bend], [joint, end, goal]] as const) {
      bone.updateWorldMatrix(true, true); const origin = bone.getWorldPosition(new T.Vector3());
      const delta = new T.Quaternion().setFromUnitVectors(child.getWorldPosition(new T.Vector3()).sub(origin).normalize(), position.clone().sub(origin).normalize());
      const parent = bone.parent!.getWorldQuaternion(new T.Quaternion()); bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    }
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
    const affected = [...this.rest.entries()].filter(([bone]) => active.some(l => matches(bone, l.mask) && (l.source !== '@joint' || bone === (l.joint ?? 'RightForeArm')) && (!l.source.startsWith('saved:') || this.custom.get(l.source)?.tracks.some(t => t.bone === bone))));
    const tracks = affected.map(([bone]) => ({ bone, positions: [] as number[], rotations: [] as number[] }));
    for (const time of times) { this.sample(recipe, time); affected.forEach(([, r], i) => { tracks[i].positions.push(...r.node.position.toArray().map(v => Number(v.toFixed(6)))); tracks[i].rotations.push(...r.node.quaternion.toArray().map(v => Number(v.toFixed(6)))); }); }
    return { id: `saved:${crypto.randomUUID()}`, name, duration, mask: active.every(l => l.mask === active[0].mask) ? active[0].mask : '全身', times, tracks };
  }

}
export function newLayer(source: string, engine: MotionEngine, duration: number): Layer {
  return { id: crypto.randomUUID(), source, mask: engine.custom.has(source) ? '全身' : (source.startsWith('@') && !basics[source]?.wrist && !basics[source]?.fingers && !basics[source]?.shoulder ? '全身' : sources.find(s => s[0] === source)?.[2] ?? '全身'), weight: 1, start: 0, duration, speed: 1, from: 0, to: engine.frames(source), fade: .3, loop: !source.startsWith('@'), enabled: true, ...(source === '@joint' ? { joint: 'RightForeArm', jointX: 0, jointY: 0, jointZ: 0, jointSpace: 'local' as const, jointEase: .7, poseMode: 'hold' as const, fade: 0 } : {}) };
}
export function validateRecipe(value: unknown, savedIds = new Set<string>()): Recipe {
  const r = value as Recipe;
  const finite = (v: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!r || r.version !== 1 || !finite(r.duration, .5, 60) || ![24, 30, 60].includes(r.fps) || !Array.isArray(r.layers) || r.layers.length > 32) throw new Error('レシピの形式が正しくありません');
  for (const l of r.layers) if (!(sources.some(s => s[0] === l.source) || savedIds.has(l.source)) || !masks.includes(l.mask) || !finite(l.weight, 0, 1) || !finite(l.start, 0, 60) || !finite(l.duration, .1, 60) || !finite(l.speed, .1, 3) || !finite(l.from, 0, 100000) || !finite(l.to, l.from + 1, 100001) || !finite(l.fade, 0, 5) || typeof l.loop !== 'boolean' || typeof l.enabled !== 'boolean') throw new Error('レシピの動作設定が正しくありません');
  for (const l of r.layers) if (l.shoulderFollow !== undefined && !finite(l.shoulderFollow, 0, 1) || l.balance !== undefined && typeof l.balance !== 'boolean' || l.repeatEvery !== undefined && l.repeatEvery !== 0 && !finite(l.repeatEvery, l.duration, 60) || l.envelope !== undefined && !['flat', 'sine'].includes(l.envelope) || l.poseMode !== undefined && !['motion', 'hold'].includes(l.poseMode) || l.contactGap !== undefined && !finite(l.contactGap, -10, 20)) throw new Error('配置の繰り返し・接触設定が正しくありません');
  for (const l of r.layers) if (l.jointEase !== undefined && !finite(l.jointEase, 0, 10) || l.joint !== undefined && !Object.hasOwn(jointNames, l.joint) || [l.jointX, l.jointY, l.jointZ].some(v => v !== undefined && !finite(v, -180, 180)) || l.jointSpace !== undefined && !['local', 'world'].includes(l.jointSpace)) throw new Error('関節の設定が正しくありません');
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
