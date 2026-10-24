// 服の垂れ下がる部分（スカート・ペプラムの裾）に揺れ用の骨（VRMC_springBone）を自動で付ける。
// merge_tripo_clothing.mjs から使う。
//
// 腰の縦軸のまわりに chains 本の骨の列を並べる。各列は揺れ始める高さ（スカートは上端の少し下、
// 上衣はウエスト）から、その向きの布のいちばん下までを 3 つに分ける。布の頂点は、向き・高さの近い
// 骨へ寄せて、揺れ始める所から下ほど強く骨で動かす（上端は元のウェイトのまま体に付いていく）。
// 当たり判定は、素体にある太ももの判定を使う。

// --- 4x4 行列（glTF と同じ列優先） ---
function fromTRS(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = r;
  const [sx, sy, sz] = s;
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}

function invert(m) {
  const inv = new Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  return inv.map((v) => v / det);
}

const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** シーンのノードごとの、バインド姿勢でのワールド行列と親 */
export function nodeWorlds(json) {
  const world = new Array(json.nodes.length);
  const parent = new Array(json.nodes.length).fill(-1);
  const walk = (i, pm) => {
    const n = json.nodes[i];
    world[i] = mul(pm, n.matrix ?? fromTRS(n.translation, n.rotation, n.scale));
    for (const c of n.children ?? []) {
      parent[c] = i;
      walk(c, world[i]);
    }
  };
  for (const i of json.scenes[0].nodes) walk(i, fromTRS());
  return { world, parent };
}

/**
 * 揺れの骨を足し、頂点のウェイトを書き換える。
 * positions: Float32Array(count*3)、joints: Uint16Array(count*4)（素体のスキンの番号）、weights: Float32Array(count*4)
 * 足した骨の番号は ctx.newJoints（{ node, ibm }）に積む。springs は ctx.springs に積む。
 */
export function addSway(ctx, spec, positions, joints, weights) {
  const sway = spec.sway;
  if (sway === false) return;
  const { json } = ctx;
  const { world } = nodeWorlds(json);
  const nodeByName = new Map(json.nodes.map((n, i) => [n.name, i]));
  const hipsNode = nodeByName.get('J_Bip_C_Hips');
  const hips = apply(world[hipsNode], [0, 0, 0]);
  const count = positions.length / 3;
  const ys = Array.from({ length: count }, (_, i) => positions[i * 3 + 1]);
  const topY = Math.max(...ys);

  // 揺れ始める高さ
  let startY;
  if (spec.kind === 'skirt') startY = topY - (sway?.band ?? 0.05);
  else if (spec.kind === 'top') startY = apply(world[nodeByName.get('J_Bip_C_Chest')], [0, 0, 0])[1] - (sway?.below_chest ?? 0.015);
  else return;
  if (sway?.start_y !== undefined) startY = sway.start_y;

  const K = sway?.chains ?? 8;
  const SEG = 3;
  const hang = [];
  for (let i = 0; i < count; i++) if (ys[i] < startY) hang.push(i);
  if (hang.length < 200) return;

  const angleOf = (i) => Math.atan2(positions[i * 3] - hips[0], positions[i * 3 + 2] - hips[2]);
  const radiusOf = (i) => Math.hypot(positions[i * 3] - hips[0], positions[i * 3 + 2] - hips[2]);

  // 列ごとに、その向きの布の下端と、高さごとの半径を測って骨を置く
  const chains = [];
  for (let k = 0; k < K; k++) {
    const th = (k / K) * Math.PI * 2 - Math.PI;
    const sector = hang.filter((i) => {
      let d = angleOf(i) - th;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) < Math.PI / K;
    });
    if (sector.length < 40) {
      chains.push(null);
      continue;
    }
    const sy = sector.map((i) => ys[i]).sort((a, b) => a - b);
    const bottom = sy[Math.floor(sy.length * 0.05)];
    if (startY - bottom < (sway?.min_length ?? 0.06)) {
      chains.push(null);
      continue;
    }
    const nodes = [];
    let parent = hipsNode;
    let lastR = null;
    for (let s = 0; s <= SEG; s++) {
      const y = startY - ((startY - bottom) * s) / SEG;
      const near = sector.filter((i) => Math.abs(ys[i] - y) < 0.025).map(radiusOf).sort((a, b) => a - b);
      const r = near.length ? near[Math.floor(near.length / 2)] * 0.95 : lastR ?? 0.1;
      lastR = r;
      const pos = [hips[0] + Math.sin(th) * r, y, hips[2] + Math.cos(th) * r];
      const local = apply(invert(world[parent]), pos);
      const idx = json.nodes.length;
      json.nodes.push({ name: `J_Sec_${spec.name}_${k}_${s}`, translation: local });
      (json.nodes[parent].children ??= []).push(idx);
      world[idx] = mul(world[parent], fromTRS(local));
      nodes.push(idx);
      parent = idx;
    }
    chains.push({ th, bottom, nodes });
  }
  const valid = chains.map((c, k) => (c ? k : -1)).filter((k) => k >= 0);
  if (!valid.length) return;

  // 骨をスキンに足す（末端の骨はウェイトを持たないが、揺れの向きを決めるので足す）
  const jointIndex = new Map();
  for (const k of valid) {
    for (const node of chains[k].nodes) {
      jointIndex.set(node, ctx.skinJointCount + ctx.newJoints.length);
      ctx.newJoints.push({ node, ibm: invert(world[node]) });
    }
  }

  // 太ももに巻き付く所（ガーターベルトなど）は揺らさず、脚に付いていく元のウェイトのままにする。
  // 太ももの骨の線分からの距離が、脚の太さ＋ hug_margin 以内なら揺らさない
  const legs = ['L', 'R'].map((side) => {
    const a = apply(world[nodeByName.get(`J_Bip_${side}_UpperLeg`)], [0, 0, 0]);
    const b = apply(world[nodeByName.get(`J_Bip_${side}_LowerLeg`)], [0, 0, 0]);
    const legColliders = (json.extensions?.VRMC_springBone?.colliders ?? []).filter((c) => json.nodes[c.node].name === `J_Bip_${side}_UpperLeg`);
    const r = Math.max(0.05, ...legColliders.map((c) => c.shape?.sphere?.radius ?? c.shape?.capsule?.radius ?? 0));
    return { a, b, r };
  });
  const legDist = (i) => Math.min(...legs.map(({ a, b, r }) => {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
    return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t) - r;
  }));
  const hug = sway?.hug_margin ?? 0.03;

  // ウェイト
  const strength = sway?.strength ?? 1.0;
  for (const i of hang) {
    const a = angleOf(i);
    // 両隣の有効な列と、その間の位置
    let best = null;
    for (const ka of valid) {
      for (const kb of valid) {
        const ta = chains[ka].th;
        let span = chains[kb].th - ta;
        span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (ka === kb) span = 2 * Math.PI;
        let off = a - ta;
        off = ((off % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (off <= span && (!best || span < best.span)) best = { ka, kb, span, u: span > 0 ? off / span : 0 };
      }
    }
    const pairs = best.ka === best.kb ? [[best.ka, 1]] : [[best.ka, 1 - best.u], [best.kb, best.u]];
    const add = new Map();
    let tAvg = 0;
    for (const [k, wk] of pairs) {
      const c = chains[k];
      const t = Math.min(1, Math.max(0, (startY - ys[i]) / (startY - c.bottom)));
      tAvg += t * wk;
      const p = Math.min(SEG - 1, Math.max(0, t * SEG - 0.5));
      const s0 = Math.floor(p);
      const s1 = Math.min(SEG - 1, s0 + 1);
      const u = p - s0;
      for (const [s, w] of [[s0, 1 - u], [s1, u]]) {
        const j = jointIndex.get(c.nodes[s]);
        add.set(j, (add.get(j) ?? 0) + w * wk);
      }
    }
    const h = smoothstep(0, sway?.blend ?? 0.3, tAvg) * strength * smoothstep(hug, hug + 0.02, legDist(i));
    const all = new Map();
    for (let q = 0; q < 4; q++) {
      const w = weights[i * 4 + q] * (1 - h);
      if (w > 0) all.set(joints[i * 4 + q], (all.get(joints[i * 4 + q]) ?? 0) + w);
    }
    for (const [j, w] of add) all.set(j, (all.get(j) ?? 0) + w * h);
    const top = [...all].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((acc, [, w]) => acc + w, 0);
    for (let q = 0; q < 4; q++) {
      joints[i * 4 + q] = top[q]?.[0] ?? 0;
      weights[i * 4 + q] = top[q] ? top[q][1] / sum : 0;
    }
  }

  // 揺れの設定。当たり判定は太もも（名前で探す）。胴の判定は球が大きく、置いたときから裾を外へ押し出してしまうので使わない
  const sb = json.extensions?.VRMC_springBone;
  const groups = (sb?.colliderGroups ?? [])
    .map((g, gi) => [g, gi])
    .filter(([g]) => /UpperLeg/.test(g.name ?? json.nodes[sb.colliders[g.colliders[0]].node].name))
    .map(([, gi]) => gi);
  // 上衣の裾（ペプラム）は外へ広がった形なので、重力で下へ引くと内側へ垂れて下の服に食い込む。
  // 重力はかけず、硬めにして動いたときの揺れだけにする
  const isTop = spec.kind === 'top';
  const stiff = sway?.stiffness ?? (isTop ? [2.2, 1.8, 1.5] : [1.6, 1.2, 1.0]);
  const gravity = sway?.gravity ?? (isTop ? 0 : 0.2);
  for (const k of valid) {
    ctx.springs.push({
      name: `${spec.name}_${k}`,
      colliderGroups: groups,
      joints: chains[k].nodes.map((node, s) => ({
        node,
        hitRadius: sway?.hit_radius ?? 0.02,
        stiffness: stiff[Math.min(s, stiff.length - 1)],
        gravityPower: gravity,
        gravityDir: [0, -1, 0],
        dragForce: sway?.drag ?? 0.5,
      })),
    });
  }
  console.log(`[揺れ ${spec.name}] 骨の列 ${valid.length} 本（高さ ${startY.toFixed(3)} から下、頂点 ${hang.length}）`);
}

/**
 * 細長く垂れ下がった小さな部品（袖口・脇の紐など）に、重力で下へ垂れる骨を付ける。
 * T ポーズで縦に長い（高さが幅の aspect 倍以上）、ひとつながりの小さな部品を探し、上端から下端へ骨を並べる。
 * 骨の親は、その部品の上端の頂点をいちばん強く動かしている骨（袖口なら前腕・手）。
 */
export function addDangles(ctx, spec, positions, indices, joints, weights) {
  const opt = spec.dangle;
  if (opt === false || spec.kind === 'hair') return;
  const { json } = ctx;
  const { world } = nodeWorlds(json);
  const count = positions.length / 3;

  // UV の境目で分かれた頂点を位置でまとめ、三角形でつながる部品に分ける
  const key = (i) => `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a, b) => { parent[find(a)] = find(b); };
  const first = new Map();
  for (let i = 0; i < count; i++) {
    const k = key(i);
    if (first.has(k)) unite(i, first.get(k));
    else first.set(k, i);
  }
  for (let t = 0; t < indices.length; t += 3) {
    unite(indices[t], indices[t + 1]);
    unite(indices[t], indices[t + 2]);
  }
  const comps = new Map();
  for (let i = 0; i < count; i++) {
    const r = find(i);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(i);
  }

  const aspect = opt?.aspect ?? 2.5;
  const minLen = opt?.min_length ?? 0.03;
  const SEG = 3;
  let made = 0;
  for (const verts of comps.values()) {
    if (verts.length > count * 0.05) continue;
    const xs = verts.map((i) => positions[i * 3]);
    const ys = verts.map((i) => positions[i * 3 + 1]);
    const zs = verts.map((i) => positions[i * 3 + 2]);
    const h = Math.max(...ys) - Math.min(...ys);
    const w = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    // 細い紐、または蝶結びごと垂れた長い紐（結び目の輪で幅が広い）
    const thin = h >= minLen && h >= aspect * w;
    const long = h >= (opt?.long_length ?? 0.08) && h >= 1.2 * w;
    if (!thin && !long) continue;
    const top = Math.max(...ys);
    const bottom = Math.min(...ys);

    // 親の骨：上端の頂点のウェイトがいちばん大きい骨
    const score = new Map();
    for (const i of verts) {
      if (positions[i * 3 + 1] < top - 0.01) continue;
      for (let q = 0; q < 4; q++) score.set(joints[i * 4 + q], (score.get(joints[i * 4 + q]) ?? 0) + weights[i * 4 + q]);
    }
    const parentJoint = [...score].sort((a, b) => b[1] - a[1])[0][0];
    let parentNode = parentJoint < ctx.skinJointCount
      ? json.skins[0].joints[parentJoint]
      : ctx.newJoints[parentJoint - ctx.skinJointCount].node;

    const nodes = [];
    for (let s = 0; s <= SEG; s++) {
      const y = top - (h * s) / SEG;
      const near = verts.filter((i) => Math.abs(positions[i * 3 + 1] - y) < h / SEG / 2 + 1e-4);
      const pos = [0, 1, 2].map((a) => near.reduce((acc, i) => acc + positions[i * 3 + a], 0) / near.length);
      pos[1] = y;
      const local = apply(invert(world[parentNode]), pos);
      const idx = json.nodes.length;
      json.nodes.push({ name: `J_Sec_${spec.name}_Dangle${made}_${s}`, translation: local });
      (json.nodes[parentNode].children ??= []).push(idx);
      world[idx] = mul(world[parentNode], fromTRS(local));
      nodes.push(idx);
      parentNode = idx;
    }
    const jointIdx = nodes.map((node) => {
      ctx.newJoints.push({ node, ibm: invert(world[node]) });
      return ctx.skinJointCount + ctx.newJoints.length - 1;
    });

    // 上端は元のウェイトのまま、下ほど骨で動かす
    for (const i of verts) {
      const t = (top - positions[i * 3 + 1]) / Math.max(h, 1e-6);
      const p = Math.min(SEG - 1, Math.max(0, t * SEG - 0.5));
      const s0 = Math.floor(p);
      const s1 = Math.min(SEG - 1, s0 + 1);
      const u = p - s0;
      const k = smoothstep(0, 0.2, t);
      const all = new Map();
      for (let q = 0; q < 4; q++) {
        const wv = weights[i * 4 + q] * (1 - k);
        if (wv > 0) all.set(joints[i * 4 + q], (all.get(joints[i * 4 + q]) ?? 0) + wv);
      }
      all.set(jointIdx[s0], (all.get(jointIdx[s0]) ?? 0) + (1 - u) * k);
      all.set(jointIdx[s1], (all.get(jointIdx[s1]) ?? 0) + u * k);
      const best = [...all].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = best.reduce((acc, [, wv]) => acc + wv, 0);
      for (let q = 0; q < 4; q++) {
        joints[i * 4 + q] = best[q]?.[0] ?? 0;
        weights[i * 4 + q] = best[q] ? best[q][1] / sum : 0;
      }
    }

    // 紐は軽いので、硬さを弱く重力を強くして下へ垂らす
    ctx.springs.push({
      name: `${spec.name}_Dangle${made}`,
      joints: nodes.map((node) => ({
        node,
        hitRadius: opt?.hit_radius ?? 0.005,
        stiffness: opt?.stiffness ?? 0.3,
        gravityPower: opt?.gravity ?? 1.0,
        gravityDir: [0, -1, 0],
        dragForce: opt?.drag ?? 0.4,
      })),
    });
    made++;
  }
  if (made) console.log(`[垂れる紐 ${spec.name}] ${made} 本`);
}
