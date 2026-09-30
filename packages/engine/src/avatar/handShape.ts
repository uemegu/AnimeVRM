import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

/**
 * 読み込み時のメッシュから、手の形（手のひら・指・手首を線分と太さで表したもの）を測る。
 * 手が肌で止まる処理（handClearance.ts）と、手が布を押す処理（clothDent.ts）で使う。
 */

/** 手の太さを測れなかったときの値。メートル */
const DEFAULT_PALM_RADIUS = 0.015;
const DEFAULT_FINGER_RADIUS = 0.007;

const FINGERS: [string, string[]][] = [
  ['Thumb', ['Metacarpal', 'Proximal', 'Distal']],
  ['Index', ['Proximal', 'Intermediate', 'Distal']],
  ['Middle', ['Proximal', 'Intermediate', 'Distal']],
  ['Ring', ['Proximal', 'Intermediate', 'Distal']],
  ['Little', ['Proximal', 'Intermediate', 'Distal']],
];

const _v = new THREE.Vector3();

// ---- メッシュの頂点 ----

/**
 * メッシュ（glTF の1プリミティブ）が使う頂点の番号。VRoid の VRM は部品どうしで頂点の置き場を共有しているので、
 * 置き場の全頂点ではなく、インデックスから引く
 */
export function partVertices(mesh: THREE.SkinnedMesh): number[] {
  const index = mesh.geometry.index;
  if (!index) return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
  return [...new Set(index.array as unknown as Iterable<number>)];
}

export function materialNames(mesh: THREE.Mesh): string[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.name);
}

/** 頂点のウェイトのうち、条件に合う骨の分の合計 */
export function weightOf(mesh: THREE.SkinnedMesh, vertex: number, test: (bone: THREE.Bone) => boolean): number {
  const { skinIndex, skinWeight } = mesh.geometry.attributes;
  let weight = 0;
  for (let slot = 0; slot < 4; slot++) {
    const bone = mesh.skeleton.bones[skinIndex.getComponent(vertex, slot)];
    if (bone && test(bone)) weight += skinWeight.getComponent(vertex, slot);
  }
  return weight;
}

/** 頂点を一番強く動かす骨 */
export function mainBone(mesh: THREE.SkinnedMesh, vertex: number): THREE.Bone | undefined {
  const { skinIndex, skinWeight } = mesh.geometry.attributes;
  let best = 0;
  let bone: THREE.Bone | undefined;
  for (let slot = 0; slot < 4; slot++) {
    const weight = skinWeight.getComponent(vertex, slot);
    if (weight > best) {
      best = weight;
      bone = mesh.skeleton.bones[skinIndex.getComponent(vertex, slot)];
    }
  }
  return bone;
}

/** 読み込み時の姿勢での頂点のワールド座標 */
export function restPosition(mesh: THREE.SkinnedMesh, vertex: number): THREE.Vector3 {
  return mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
}

/** 頂点を1つずつ見る。置き場を共有する部品で同じ頂点を2度見ない。part で部品を選べる */
export function forEachVertex(
  vrm: VRM,
  visit: (mesh: THREE.SkinnedMesh, vertex: number) => void,
  part: (mesh: THREE.SkinnedMesh, vertices: number[]) => boolean = () => true
): void {
  const seen = new Map<THREE.BufferAttribute | THREE.InterleavedBufferAttribute, Set<number>>();
  vrm.scene.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || !object.geometry.attributes.skinIndex) return;
    const vertices = partVertices(object);
    if (!part(object, vertices)) return;
    const position = object.geometry.attributes.position;
    let done = seen.get(position);
    if (!done) seen.set(position, (done = new Set()));
    for (const vertex of vertices) {
      if (done.has(vertex)) continue;
      done.add(vertex);
      visit(object, vertex);
    }
  });
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

/** 手の肌がある部品（手の骨で動く頂点がいちばん多い部品）。肌の形を測るときに、服を除くのに使う */
export function skinPart(vrm: VRM): THREE.SkinnedMesh | null {
  const hands = new Set([vrm.humanoid.getRawBoneNode('leftHand'), vrm.humanoid.getRawBoneNode('rightHand')].filter(Boolean));
  const counts = new Map<THREE.SkinnedMesh, number>();
  forEachVertex(vrm, (mesh, vertex) => {
    const bone = mainBone(mesh, vertex);
    if (bone && hands.has(bone)) counts.set(mesh, (counts.get(mesh) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ---- 手の形 ----

/** 手の一部を表す線分（読み込み時のワールド座標）と、線分から肉の表面までの距離 */
export interface HandSegment {
  /** 線分を動かす骨 */
  bone: VRMHumanBoneName;
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  kind: 'forearm' | 'palm' | 'finger';
}

/**
 * 手のひら（手首 → 人差し指・中指・小指の付け根）、指（関節 → 次の関節。指先はメッシュの先端）、
 * 前腕の手首寄りの半分（手首の肌は前腕の骨で動くので）を線分で表す。
 * 太さは、その骨で動く肌の頂点の線分からの距離の 90%（外れ値を避けつつ、親指の付け根のふくらみまで覆う）。
 * 前腕は袖に覆われているので、袖を含めないよう肌の部品だけで測る
 */
export function measureHand(vrm: VRM, side: 'left' | 'right', skin: THREE.SkinnedMesh | null): HandSegment[] | null {
  const humanoid = vrm.humanoid;
  const name = (bone: string) => `${side}${bone}` as VRMHumanBoneName;
  const raw = (bone: string) => humanoid.getRawBoneNode(name(bone));
  const world = (bone: string) => raw(bone)?.getWorldPosition(new THREE.Vector3()) ?? null;
  const hand = world('Hand');
  const lower = world('LowerArm');
  if (!hand || !lower) return null;

  // 骨ごとの頂点（読み込み時のワールド座標）
  const byBone = new Map<THREE.Object3D, string>();
  for (const [finger, joints] of [['', ['LowerArm', 'Hand']] as [string, string[]], ...FINGERS]) {
    for (const joint of joints) {
      const bone = raw(`${finger}${joint}`);
      if (bone) byBone.set(bone, `${finger}${joint}`);
    }
  }
  const vertices = new Map<string, THREE.Vector3[]>();
  forEachVertex(vrm, (mesh, vertex) => {
    const { skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let slot = 0; slot < 4; slot++) {
      const bone = byBone.get(mesh.skeleton.bones[skinIndex.getComponent(vertex, slot)]);
      if (!bone || skinWeight.getComponent(vertex, slot) < 0.5) continue;
      if (bone === 'LowerArm' && skin && mesh !== skin) return;
      const list = vertices.get(bone) ?? [];
      list.push(restPosition(mesh, vertex));
      vertices.set(bone, list);
      return;
    }
  });

  const segments: HandSegment[] = [];
  const distance = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => new THREE.Line3(a, b).closestPointToPoint(p, true, _v).distanceTo(p);
  const along = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => _v.subVectors(p, a).dot(b.clone().sub(a)) / Math.max(1e-8, a.distanceToSquared(b));
  /** 線分の範囲に入る頂点で太さを測る */
  const radiusOf = (bone: string, lines: [THREE.Vector3, THREE.Vector3][], fallback: number) => {
    const own = (vertices.get(bone) ?? []).filter((p) => lines.some(([a, b]) => { const t = along(p, a, b); return t >= -0.2 && t <= 1.2; }));
    if (own.length < 10) return fallback;
    return THREE.MathUtils.clamp(percentile(own.map((p) => Math.min(...lines.map(([a, b]) => distance(p, a, b)))), 0.9), 0.004, 0.05);
  };

  // 前腕の手首寄り
  const wristHalf: [THREE.Vector3, THREE.Vector3] = [lower.clone().lerp(hand, 0.5), hand.clone()];
  segments.push({ bone: name('LowerArm'), start: wristHalf[0], end: wristHalf[1], radius: radiusOf('LowerArm', [wristHalf], DEFAULT_PALM_RADIUS * 2), kind: 'forearm' });

  // 手のひら
  const knuckles = ['IndexProximal', 'MiddleProximal', 'LittleProximal'].map(world).filter((p): p is THREE.Vector3 => !!p);
  const palmLines = knuckles.map((knuckle) => [hand.clone(), knuckle] as [THREE.Vector3, THREE.Vector3]);
  const palmRadius = radiusOf('Hand', palmLines, DEFAULT_PALM_RADIUS);
  for (const [start, end] of palmLines) segments.push({ bone: name('Hand'), start, end, radius: palmRadius, kind: 'palm' });

  // 指
  for (const [finger, joints] of FINGERS) {
    const chain = joints.map((joint) => ({ joint: `${finger}${joint}`, at: world(`${finger}${joint}`) })).filter((entry): entry is { joint: string; at: THREE.Vector3 } => !!entry.at);
    if (chain.length < 2) continue;
    chain.forEach(({ joint, at }, i) => {
      let end: THREE.Vector3;
      if (i < chain.length - 1) {
        end = chain[i + 1].at.clone();
      } else {
        // 指先：最後の骨で動く頂点が、骨の向きにどこまで延びているか
        const direction = at.clone().sub(chain[i - 1].at);
        const previousLength = direction.length();
        direction.normalize();
        const own = vertices.get(joint) ?? [];
        const reach = own.length >= 10 ? percentile(own.map((p) => _v.subVectors(p, at).dot(direction)), 0.95) : previousLength;
        end = at.clone().addScaledVector(direction, Math.max(0.005, reach - DEFAULT_FINGER_RADIUS));
      }
      segments.push({ bone: name(joint), start: at.clone(), end, radius: radiusOf(joint, [[at, end]], DEFAULT_FINGER_RADIUS), kind: 'finger' });
    });
  }
  return segments;
}
