"""
Tripo などで作った服（GLB）を VRM の素体に着せるための前処理（Blender で実行）。

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/fit_tripo_clothing.py -- scripts/outfits/peplum_shorts.json
  髪だけ直すときは末尾に --only Hair（服の GLB と、隠れる頂点の一覧は上書きしない）

固定の座標は使わず、素体の骨と体の断面、服の断面から位置・大きさ・袖や脚の角度を測って合わせる。

1. 服の断面から脇の下（上衣）・股（下衣）の高さと、袖・脚の傾きを測る
2. 素体の腕・脚を服の袖・脚の傾きに合わせたポーズにする
3. 脇の下／股の高さと胴回りの幅で、服を素体に合わせて拡大縮小・移動する
4. 体に近い部分（上衣はウエストより上、下衣は股より上）だけを体に沿わせる。補正は空間的に平滑化して加える（シワ・装飾は残る）
5. 体にめり込んだ所を外へ押し出す。押し出しは周りへなめらかに広げ、布の表と裏の組は同じだけ動かす（層が入れ替わって裏の面が見えないように）
6. 体に近い頂点は素体のウェイトをそのまま写し、離れた頂点（ペプラム・裾など）は近い頂点から拡散する。下衣は全部写す
7. ポーズを逆にかけて（逆スキニング）T ポーズに戻し、腕を下ろす・歩く姿でめり込む所を T ポーズの形で広げる
8. 重ね着：内側の服が外側の服より外へ出る所を押し込み、外側に隠れる面を消す
9. 腕を下ろす・歩く・座る姿のすべてで服に隠れる（または服を突き抜ける）素体の頂点を調べる（統合時に消す）

出力: 服ごとの GLB（骨付き）と、隠れる素体頂点の一覧 JSON。VRM への統合は merge_tripo_clothing.mjs。
"""

import bpy
import json
import math
import os
import sys

import numpy as np
from mathutils import Matrix, Vector, kdtree
from mathutils.bvhtree import BVHTree

HIDDEN_MATERIAL_KEYWORDS = ("hair", "shoes")  # 体の当たり判定・ウェイトの写し元から外す


# ---------------------------------------------------------------------------
# 汎用
# ---------------------------------------------------------------------------

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def weld(mesh):
    """同じ位置の頂点（UV の境目で分かれたもの）を 1 つにまとめた点と隣接関係を作る。"""
    key_to_c = {}
    v2c = np.zeros(len(mesh.vertices), dtype=np.int64)
    c2v = []
    cco = []
    for v in mesh.vertices:
        k = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
        c = key_to_c.get(k)
        if c is None:
            c = len(cco)
            key_to_c[k] = c
            cco.append(tuple(v.co))
            c2v.append([])
        c2v[c].append(v.index)
        v2c[v.index] = c
    edges = set()
    for e in mesh.edges:
        a, b = v2c[e.vertices[0]], v2c[e.vertices[1]]
        if a != b:
            edges.add((min(a, b), max(a, b)))
    edges = np.array(sorted(edges), dtype=np.int64).reshape(-1, 2)
    return v2c, c2v, np.array(cco), edges


def make_neighbors(I, J, W):
    """隣接（I→J、重み W）を、点ごとの重み付き平均が速く取れる形にする。"""
    o = np.argsort(I, kind="stable")
    I, J, W = I[o], J[o], W[o]
    nodes, starts = np.unique(I, return_index=True)
    return J, W, starts, nodes


def neighbor_avg(V, nbrs):
    J, W, starts, nodes = nbrs
    vals = V[J] * (W[:, None] if V.ndim == 2 else W)
    out = V.copy()
    out[nodes] = np.add.reduceat(vals, starts, axis=0)
    return out


def graph_neighbors(edges, n):
    i = np.concatenate([edges[:, 0], edges[:, 1]])
    j = np.concatenate([edges[:, 1], edges[:, 0]])
    deg = np.bincount(i, minlength=n).astype(float)
    return make_neighbors(i, j, 1.0 / deg[i])


def spatial_neighbors(P, radius):
    """半径内の点をガウス重みで結ぶ（布の表と裏のように、つながりが遠くても近い点を一緒に動かす）。"""
    kd = kdtree.KDTree(len(P))
    for idx, p in enumerate(P):
        kd.insert(p, idx)
    kd.balance()
    I, J, W = [], [], []
    sigma = radius * 0.5
    for i, p in enumerate(P):
        for (_, j, d) in kd.find_range(p, radius):
            I.append(i)
            J.append(j)
            W.append(math.exp(-(d / sigma) ** 2))
    I = np.array(I)
    J = np.array(J)
    W = np.array(W)
    s = np.bincount(I, weights=W, minlength=len(P))
    return make_neighbors(I, J, W / s[I])


def spread(push, nbrs, iterations=40):
    """押し出しの必要な点（push が 0 でない点）では少なくともその分だけ押し、
    ほかの点は周りの平均で埋める（なめらかな変位の場）。

    服は厚みのある殻なので、近くの表と裏は同じだけ動く。押す所だけを動かすと布が折れて裏返る。
    """
    mag = np.linalg.norm(push, axis=1)
    m = mag > 1e-9
    n = push[m] / mag[m][:, None]
    D = push.copy()
    for _ in range(iterations):
        D = neighbor_avg(D, nbrs)
        short = mag[m] - np.einsum("ij,ij->i", D[m], n)
        D[m] += n * np.maximum(short, 0.0)[:, None]
    return D


def smooth(V, nbrs, iterations, lam):
    for _ in range(iterations):
        V = (1 - lam) * V + lam * neighbor_avg(V, nbrs)
    return V


def surface_samples(co, polys, n, seed=0):
    """面の上に面積に比例して点をばらまく（頂点だけでは断面がまばらになるため）。"""
    tris = np.array([(p[0], p[i], p[i + 1]) for p in polys for i in range(1, len(p) - 1)])
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    rng = np.random.default_rng(seed)
    pick = rng.choice(len(tris), size=n, p=area / area.sum())
    u, v = rng.random(n), rng.random(n)
    flip = u + v > 1
    u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    return a[pick] + (b[pick] - a[pick]) * u[:, None] + (c[pick] - a[pick]) * v[:, None]


def slice_clusters(P, z, band, gap):
    """高さ z の水平断面の点を x 方向の隙間で分けた塊（xmin, xmax, ymin, ymax）の一覧。"""
    sel = P[np.abs(P[:, 2] - z) < band * 0.5]
    if len(sel) == 0:
        return []
    sel = sel[np.argsort(sel[:, 0])]
    cuts = np.where(np.diff(sel[:, 0]) > gap)[0]
    out = []
    for part in np.split(sel, cuts + 1):
        out.append((part[0, 0], part[-1, 0], part[:, 1].min(), part[:, 1].max()))
    return out


def central(clusters):
    for c in clusters:
        if c[0] <= 0.0 <= c[1]:
            return c
    return min(clusters, key=lambda c: abs(0.5 * (c[0] + c[1]))) if clusters else None


def fit_line(xs, ys):
    xs = np.asarray(xs)
    ys = np.asarray(ys)
    A = np.vstack([xs, np.ones_like(xs)]).T
    slope, icpt = np.linalg.lstsq(A, ys, rcond=None)[0]
    return slope, icpt


# ---------------------------------------------------------------------------
# 素体
# ---------------------------------------------------------------------------

class Body:
    def __init__(self, path, strip=()):
        bpy.ops.import_scene.gltf(filepath=path)
        self.arm = bpy.data.objects["Armature"]
        self.obj = bpy.data.objects["Body"]
        for o in list(bpy.data.objects):
            if o.type == "MESH" and o.name.startswith("Icosphere"):
                bpy.data.objects.remove(o, do_unlink=True)
        me = self.obj.data
        hidden = {
            i for i, m in enumerate(me.materials)
            if m and any(k in m.name.lower() for k in HIDDEN_MATERIAL_KEYWORDS + tuple(k.lower() for k in strip))
        }
        self.poly_ok = np.array([p.material_index not in hidden for p in me.polygons])
        self.polys = [tuple(p.vertices) for p in me.polygons]
        used = np.zeros(len(me.vertices), dtype=bool)
        for p, ok in zip(self.polys, self.poly_ok):
            if ok:
                used[list(p)] = True
        self.vert_ok = used
        # 頂点ウェイト（正規化済み）
        self.group_names = [g.name for g in self.obj.vertex_groups]
        self.weights = []
        for v in me.vertices:
            row = {g.group: g.weight for g in v.groups if g.weight > 1e-5}
            s = sum(row.values())
            self.weights.append({k: w / s for k, w in row.items()} if s > 0 else {})
        # 腕の頂点（腕・手の骨のウェイトが半分を超える）。袖の当たり判定とウェイトの写し元に使う
        self.arm_vert = {}
        for side in ("L", "R"):
            arm_g = {i for i, n in enumerate(self.group_names) if n.startswith(f"J_Bip_{side}_") and
                     any(k in n for k in ("UpperArm", "LowerArm", "Hand", "Thumb", "Index", "Middle", "Ring", "Little"))}
            self.arm_vert[side] = np.array([sum(w for g, w in row.items() if g in arm_g) > 0.5 for row in self.weights])
        # 頂点のつながり（隠れる頂点を縮める処理用）
        e = np.array([tuple(ed.vertices) for ed in me.edges], dtype=np.int64)
        self.edges = e
        self.rest_co = np.array([tuple(self.obj.matrix_world @ v.co) for v in me.vertices])

    # --- ポーズ ---
    def set_pose(self, rotations):
        """rotations: [(骨の名前, 軸 'X'|'Y'|'Z', 角度[度])]。現在の姿勢の骨の根元を中心に、アーマチュア空間で回す。

        文字列なら、エンジンから書き出した姿勢（骨ごとのスキニング行列、glTF の座標）の JSON を読む。
        """
        for pb in self.arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        if isinstance(rotations, str):
            self.set_engine_pose(rotations)
            return
        for name, axis, deg in rotations:
            pb = self.arm.pose.bones[name]
            cur = pb.matrix.copy()
            h = cur.translation.copy()
            pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h) @ cur
            bpy.context.view_layer.update()

    def set_engine_pose(self, path):
        with open(path) as f:
            data = json.load(f)
        C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # glTF（Y 上）→ Blender（Z 上）

        def walk(b):
            if b.name in data:
                e = data[b.name]
                S = Matrix([[e[c * 4 + r] for c in range(4)] for r in range(4)])  # three.js は列優先
                self.arm.pose.bones[b.name].matrix = C @ S @ C.inverted() @ b.matrix_local
                bpy.context.view_layer.update()
            for ch in b.children:
                walk(ch)

        for b in self.arm.data.bones:
            if b.parent is None:
                walk(b)

    def skin_matrices(self):
        aw = self.arm.matrix_world
        out = {}
        for pb in self.arm.pose.bones:
            out[pb.name] = np.array(aw @ pb.matrix @ pb.bone.matrix_local.inverted() @ aw.inverted())
        return out

    def bone_head(self, name):
        return np.array(self.arm.matrix_world @ self.arm.pose.bones[name].head)

    # --- 現在のポーズの形 ---
    def evaluate(self):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = self.obj.evaluated_get(dg)
        me = ev.to_mesh()
        M = self.obj.matrix_world
        co = np.array([tuple(M @ v.co) for v in me.vertices])
        ev.to_mesh_clear()
        polys = [p for p, ok in zip(self.polys, self.poly_ok) if ok]
        poly_idx = np.nonzero(self.poly_ok)[0]
        bvh = BVHTree.FromPolygons([Vector(c) for c in co], polys)
        # 頂点法線
        vn = np.zeros_like(co)
        for p in polys:
            a, b, c = co[p[0]], co[p[1]], co[p[2]]
            n = np.cross(b - a, c - a)
            for vi in p:
                vn[vi] += n
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-9)
        arm = {}
        for side in ("L", "R"):
            ap = [p for p in polys if all(self.arm_vert[side][list(p)])]
            arm[side] = (BVHTree.FromPolygons([Vector(c) for c in co], ap), ap)
        return {"co": co, "vn": vn, "bvh": bvh, "polys": polys, "poly_idx": poly_idx, "arm": arm}


def nearest_signed(bvh, P, max_dist=1.0):
    """各点から面までの最短点・外向き法線・符号付き距離。"""
    n = len(P)
    loc = np.zeros((n, 3))
    nor = np.zeros((n, 3))
    sd = np.full(n, np.inf)
    face = np.full(n, -1)
    for i, p in enumerate(P):
        l, nm, fi, d = bvh.find_nearest(Vector(p), max_dist)
        if l is None:
            continue
        diff = np.array(p) - np.array(l)
        nm = np.array(nm)
        s = 1.0 if diff.dot(nm) >= 0 else -1.0
        loc[i] = l
        nor[i] = nm
        sd[i] = s * d
        face[i] = fi
    return loc, nor, sd, face


def combined_bvh(objs):
    verts, polys = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        base = len(verts)
        verts.extend(o.matrix_world @ v.co for v in me.vertices)
        polys.extend(tuple(base + i for i in p.vertices) for p in me.polygons)
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys)


# ---------------------------------------------------------------------------
# 断面の解析
# ---------------------------------------------------------------------------

def is_split(cl, need_center):
    """断面が左右の塊に分かれているか（need_center=True なら真ん中の塊もある＝胴と両腕）。"""
    has_l = any(k[1] < 0.0 for k in cl)
    has_r = any(k[0] > 0.0 for k in cl)
    has_c = any(k[0] <= 0.0 <= k[1] for k in cl)
    return has_l and has_r and has_c == need_center


def analyze_top(P, step, gap):
    """上衣：脇の下の高さ、胴の中心、袖の下がり角（度）。"""
    zs = np.arange(P[:, 2].min() + step, P[:, 2].max(), step)
    sl = [(z, slice_clusters(P, z, step * 1.2, gap)) for z in zs]
    armpit = None
    for z, cl in sl:
        if is_split(cl, True):
            armpit = z
    if armpit is None:
        # 袖が真横に伸びた（T ポーズの）服は、断面が袖と胴に分かれない。幅が急に狭くなる高さを脇の下とする
        H = P[:, 2].max() - P[:, 2].min()
        armpit = armpit_by_width(P, P[:, 2].min() + 0.4 * H, P[:, 2].max(), step, gap)
        if armpit is None:
            raise RuntimeError("脇の下の高さが見つからない")
    c = central(slice_clusters(P, armpit, step * 1.2, gap))
    hw = max(abs(c[0]), abs(c[1]))
    # 袖の点：脇より下では胴と分かれた塊、脇より上では胴幅より外
    sleeve = []
    side_ranges = []
    for z, cl in reversed(sl):  # 脇の下から下へ、袖が胴と分かれている間だけ（裾のフリルを拾わない）
        if z > armpit:
            continue
        if not is_split(cl, True):
            break
        mid = central(cl)
        side_ranges.append((z, [(k[0], k[1]) for k in cl if k is not mid]))
        for k in [k for k in cl if k is not mid]:
            m = (np.abs(P[:, 2] - z) < step * 0.6) & (P[:, 0] >= k[0]) & (P[:, 0] <= k[1])
            sleeve.append(P[m])
    upper = P[(P[:, 2] >= armpit) & (np.abs(P[:, 0]) > hw)]
    S = np.vstack(sleeve + [upper])
    ax = np.abs(S[:, 0])
    cuff = S[ax > ax.max() - 0.04 * (P[:, 0].max() - P[:, 0].min())]
    return {"armpit": armpit, "hw": hw, "side_ranges": side_ranges,
            "cuff": (float(np.abs(cuff[:, 0]).mean()), float(cuff[:, 2].mean()))}


def sleeve_mask(P, info, step):
    """袖の点：脇の下より上では胴の幅より外、下では胴と分かれた塊の中。"""
    x, z = P[:, 0], P[:, 2]
    m = (z >= info["armpit"]) & (np.abs(x) > info["hw"])
    for zs, ranges in info["side_ranges"]:
        band = np.abs(z - zs) < step * 0.6
        for x0, x1 in ranges:
            m |= band & (x >= x0 - step * 0.5) & (x <= x1 + step * 0.5)
    return m


def lowest_split_run(P, z_from, z_to, step, gap, need_center):
    """下から見て、断面が左右に分かれ続ける一番上の高さ。"""
    top = None
    started = False
    for z in np.arange(z_from, z_to, step):
        cl = slice_clusters(P, z, step * 1.2, gap)
        if is_split(cl, need_center):
            started = True
            top = z
        elif started:
            break
    return top


def analyze_bottom(P, step, gap):
    """下衣：股の高さ、脚の開き角（度）。"""
    crotch = lowest_split_run(P, P[:, 2].min() + step, P[:, 2].max(), step, gap, False)
    if crotch is None:
        raise RuntimeError("左右の脚が分かれる断面が見つからない")
    zmin, zmax = P[:, 2].min(), P[:, 2].max()
    if crotch - zmin < 0.3 * (zmax - zmin):
        # 脚の部分が短い（ショートパンツ・スカパン）と傾きが測れないので、脚はまっすぐのまま合わせる
        return {"crotch": crotch, "spread_deg": 0.0}
    zz, xx = [], []
    for z in np.arange(zmin + step, crotch - 2 * step, step):
        right = [k for k in slice_clusters(P, z, step * 1.2, gap) if k[0] > 0.0]
        if right:
            k = max(right, key=lambda k: k[1] - k[0])
            zz.append(z)
            xx.append(0.5 * (k[0] + k[1]))
    slope, _ = fit_line(zz, xx)  # x = a z + b
    return {"crotch": crotch, "spread_deg": float(np.clip(math.degrees(math.atan(-slope)), -20, 20))}


def body_profile(body_pts, z_from, z_to, step, gap):
    out = []
    for z in np.arange(z_from, z_to, step):
        c = central(slice_clusters(body_pts, z, step * 1.2, gap))
        if c:
            out.append((z, c))
    return out


def armpit_by_width(P, z_from, z_to, step, gap):
    """上から下へ見て、袖・腕の分だけ幅が急に狭くなる高さ（袖・腕が水平で断面が分かれないとき用）。"""
    rows = []
    for z in np.arange(z_to, z_from, -step):
        c = central(slice_clusters(P, z, step * 1.2, gap))
        if c:
            rows.append((z, c[1] - c[0]))
    if not rows:
        return None
    k = int(np.argmax([w for _, w in rows]))
    wmax = rows[k][1]
    for z, w in rows[k:]:
        if w < 0.6 * wmax:
            return z
    return None


def body_armpit(body_pts, z_from, z_to, step, gap):
    best = None
    for z in np.arange(z_from, z_to, step):
        if is_split(slice_clusters(body_pts, z, step * 1.2, gap), True):
            best = z
    return best if best is not None else armpit_by_width(body_pts, z_from, z_to, step, gap)


# ---------------------------------------------------------------------------
# 服の合わせ込み
# ---------------------------------------------------------------------------

class Garment:
    def __init__(self, spec, body):
        self.spec = spec
        self.name = spec["name"]
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=spec["input"])
        new = [o for o in bpy.data.objects if o not in before]
        self.obj = [o for o in new if o.type == "MESH"][0]
        self.obj.name = self.name
        for o in bpy.data.objects:
            o.select_set(False)
        self.obj.select_set(True)
        bpy.context.view_layer.objects.active = self.obj
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for o in new:
            if o != self.obj and o.name in bpy.data.objects:
                bpy.data.objects.remove(o, do_unlink=True)
        self.body = body
        self.v2c, self.c2v, self.P0, self.edges = weld(self.obj.data)
        self.nc = len(self.P0)
        self.tris = np.array([
            (self.v2c[p.vertices[0]], self.v2c[p.vertices[i]], self.v2c[p.vertices[i + 1]])
            for p in self.obj.data.polygons for i in range(1, len(p.vertices) - 1)
        ])
        self.gnb = graph_neighbors(self.edges, self.nc)
        self.pair = self.shell_pairs()

    def shell_pairs(self, max_depth=0.03):
        """布の表と裏で向かい合う点の組（各点から内側へ光線を出し、裏の面に当たった点）。

        Tripo の服は厚みのある閉じた殻なので、表と裏を別々に動かすと層が入れ替わって裏の面が見える。
        組になった点は同じだけ動かす。
        """
        P = self.P0
        fn = self.face_normals(P)
        vn = np.zeros_like(P)
        for k in range(3):
            np.add.at(vn, self.tris[:, k], fn)
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
        bvh = BVHTree.FromPolygons([Vector(p) for p in P], [tuple(t) for t in self.tris])
        pair = np.arange(self.nc)
        for i in range(self.nc):
            o = Vector(P[i] - vn[i] * 1e-5)
            hit = bvh.ray_cast(o, Vector(-vn[i]), max_depth)
            if hit[0] is None or fn[hit[2]] @ vn[i] > 0:  # 向かい合う（法線が逆向きの）面だけ
                continue
            t = self.tris[hit[2]]
            pair[i] = t[np.argmin(np.linalg.norm(P[t] - np.array(hit[0]), axis=1))]
        self.log(f"表と裏の組 {(pair != np.arange(self.nc)).sum()} / {self.nc}")
        return pair

    def tie_pairs(self, X, iterations=4):
        """組になった点の値（変位・ウェイト）をそろえる。"""
        for _ in range(iterations):
            X = 0.5 * (X + X[self.pair])
        return X

    def log(self, *a):
        print(f"  [{self.name}]", *a)

    # --- 1-3: 姿勢と大まかな位置合わせ ---
    def coarse_fit(self):
        kind = self.spec["kind"]
        body = self.body
        xc = 0.5 * (self.P0[:, 0].min() + self.P0[:, 0].max())
        polys = [[self.v2c[i] for i in p.vertices] for p in self.obj.data.polygons]
        P = surface_samples(self.P0, polys, 300000)
        P[:, 0] -= xc
        norm = P[:, 0].max() - P[:, 0].min()
        g_step, g_gap = 0.01 * norm, 0.012 * norm

        if kind == "top":
            info = analyze_top(P, g_step, g_gap)
            self.log(f"脇の下 z={info['armpit']:.3f}（服の座標）")
            Pc = self.P0.copy()
            Pc[:, 0] -= xc
            self.sleeve = sleeve_mask(Pc, info, g_step)
            body.set_pose([])
            self.shoulder_z = body.bone_head("J_Bip_L_UpperArm")[2]
            self.log(f"袖の点 {self.sleeve.sum()} / {self.nc}")
            # 袖口の中心が肩の付け根からどれだけ下がっているかで腕の角度を決め、合わせ直して収束させる
            ang = 20.0
            h = body.bone_head("J_Bip_L_UpperArm")
            for _ in range(5):
                self.pose = [("J_Bip_L_UpperArm", "Y", ang), ("J_Bip_R_UpperArm", "Y", -ang)]
                fit = self.fit_affine(P, info["armpit"])
                cx = fit["s"] * info["cuff"][0]
                cz = fit["map_z"](info["cuff"][1])
                new = math.degrees(math.atan2(h[2] - cz, cx - h[0]))
                done = abs(new - ang) < 0.5
                ang = new
                if done:
                    break
            self.pose = [("J_Bip_L_UpperArm", "Y", ang), ("J_Bip_R_UpperArm", "Y", -ang)]
            fit = self.fit_affine(P, info["armpit"])
            self.log(f"袖の下がり {ang:.1f}°  素体の脇の下 z={fit['anchor_b']:.3f}")
        elif kind == "skirt":
            # スカートは脚に分かれないので、上端（ウエストバンド）を素体の腰に合わせ、その下の幅で倍率を決める
            self.pose = []
            fit = self.fit_affine(P, P[:, 2].max())
            self.log(f"スカートの上端を z={fit['anchor_b'] - self.spec.get('waist_drop', 0.03):.3f} に合わせた")
        else:
            info = analyze_bottom(P, g_step, g_gap)
            ang = info["spread_deg"]
            self.pose = [("J_Bip_L_UpperLeg", "Y", -ang), ("J_Bip_R_UpperLeg", "Y", ang)]
            self.log(f"股 z={info['crotch']:.3f}（服の座標） 脚の開き {ang:.1f}°")
            fit = self.fit_affine(P, info["crotch"])
            self.log(f"素体の股 z={fit['anchor_b']:.3f}")
        self.log(f"倍率 横・高さ {fit['s']:.3f} 奥行き {fit['sy']:.3f}（幅の誤差 平均 {fit['err'] * 1000:.1f} mm）")

        Q = self.P0.copy()
        Q[:, 0] -= xc
        Q[:, 1] = fit["sy"] * (Q[:, 1] - fit["gy"]) + fit["by"]
        Q[:, 2] = fit["map_z"](Q[:, 2])
        Q[:, 0] *= fit["s"]
        self.P = Q
        self.zone_lo = fit["zone_lo"]
        # 体との隙間（点ごと）。上衣の脇の下は腕を前後に振ると体が折れ込むので、ゆとりを広く取る
        ease = self.spec.get("ease", 0.005)
        self.ease = np.full(self.nc, ease)
        self.armpit_w = np.zeros(self.nc)
        if kind == "top" and fit["armpit_hw"]:
            y = self.body.bone_head("J_Bip_L_UpperArm")[1]
            for sx in (1.0, -1.0):
                a = np.array([sx * fit["armpit_hw"], y, fit["anchor_b"]])
                d = np.linalg.norm(self.P - a, axis=1)
                w = 1.0 - smoothstep(0.03, 0.08, d)
                self.ease = np.maximum(self.ease, ease + (self.spec.get("armpit_ease", 0.008) - ease) * w)
                r0, r1 = self.spec.get("armpit_blur_range", (0.05, 0.13))
                # 肩の上まで混ぜると、腕を下ろしたときに肩の布が残って潰れるので、脇の高さより下だけにする
                low = 1.0 - smoothstep(fit["anchor_b"], fit["anchor_b"] + 0.03, self.P[:, 2])
                self.armpit_w = np.maximum(self.armpit_w, (1.0 - smoothstep(r0, r1, d)) * low)
        self.log(f"体に沿わせる範囲 z>{self.zone_lo:.3f}")
        return fit["ev"]

    def fit_affine(self, P, anchor_g):
        """今のポーズの素体に対して、脇の下／股の高さをそろえ、胴回りの幅が合う倍率を探す。"""
        body = self.body
        kind = self.spec["kind"]
        norm = P[:, 0].max() - P[:, 0].min()
        g_step, g_gap = 0.01 * norm, 0.012 * norm
        body.set_pose(self.pose)
        ev = body.evaluate()
        bpts = surface_samples(ev["co"], ev["polys"], 300000)
        hips = body.bone_head("J_Bip_C_Hips")[2]
        neck = body.bone_head("J_Bip_C_Neck")[2]
        knee = body.bone_head("J_Bip_L_LowerLeg")[2]
        ease_w = self.spec.get("width_ease", 0.008)
        if kind == "top":
            anchor_b = body_armpit(bpts, hips, neck, 0.01, 0.01)
            drop = self.spec.get("armpit_drop", 0.025)
            zb_range = (anchor_b - 0.25, anchor_b - 0.03)
        elif kind == "skirt":
            # 腰（脇の下から腰骨の間で胴がいちばん細い高さ）から waist_drop 下に上端を置く
            arm = body_armpit(bpts, hips, neck, 0.01, 0.01)
            waist = body_profile(bpts, hips, arm, 0.01, 0.01)
            anchor_b = min(waist, key=lambda r: r[1][1] - r[1][0])[0]
            drop = self.spec.get("waist_drop", 0.03)
            band = self.spec.get("fit_band", 0.06)
            zb_range = (anchor_b - drop - band, anchor_b - drop - 0.01)
        else:
            anchor_b = lowest_split_run(bpts, knee, hips + 0.1, 0.01, 0.01, False)
            drop = self.spec.get("crotch_drop", 0.015)
            zb_range = (anchor_b + 0.03, anchor_b + 0.16)
        prof = body_profile(bpts, *zb_range, 0.01, 0.01)
        # 体に沿わせる範囲の下端：上衣は胴のいちばん細い所（ウエスト）、下衣は股
        armpit_hw = None
        if kind == "top":
            c = central(slice_clusters(bpts, anchor_b - 0.01, 0.012, 0.01))
            armpit_hw = max(abs(c[0]), abs(c[1])) if c else None
            waist = body_profile(bpts, hips, anchor_b, 0.01, 0.01)
            zone_lo = min(waist, key=lambda r: r[1][1] - r[1][0])[0]
        elif kind == "skirt":
            zone_lo = anchor_b - drop - self.spec.get("snug_depth", 0.08)  # 体に沿わせるのはウエストバンドの辺りだけ
        else:
            zone_lo = anchor_b

        def g_slice(zg):
            return central(slice_clusters(P, zg, g_step * 1.2, g_gap))

        best = None
        for s in np.arange(0.2, 1.2, 0.0025):
            cost = 0.0
            for zb, c in prof:
                gc = g_slice((zb - anchor_b + drop) / s + anchor_g)
                if gc is None:
                    cost += 0.03
                    continue
                cost += min(abs(s * (gc[1] - gc[0]) - (c[1] - c[0] + 2 * ease_w)), 0.03)
            if best is None or cost < best[0]:
                best = (cost, s)
        s = best[1]
        ratios, gyc, byc = [], [], []
        for zb, c in prof:
            gc = g_slice((zb - anchor_b + drop) / s + anchor_g)
            if gc is None or gc[3] - gc[2] < 1e-6:
                continue
            ratios.append((c[3] - c[2] + 2 * ease_w) / (gc[3] - gc[2]))
            gyc.append(0.5 * (gc[2] + gc[3]))
            byc.append(0.5 * (c[2] + c[3]))
        return {
            "ev": ev, "s": s, "anchor_b": anchor_b, "zone_lo": zone_lo, "armpit_hw": armpit_hw,
            "sy": float(np.clip(np.median(ratios), 0.8 * s, 1.3 * s)),
            "gy": float(np.median(gyc)), "by": float(np.median(byc)),
            "err": best[0] / max(1, len(prof)),
            "map_z": lambda z: s * (z - anchor_g) + anchor_b - drop,
        }

    # --- 4-5: 体に沿わせる補正とめり込みの押し出し ---
    def conform(self, ev):
        ease = self.ease
        pull = self.spec.get("pull", 0.65)  # 体から浮いた分を何割詰めるか
        snug_lo, snug_hi = self.spec.get("snug_range", (0.02, 0.045))
        snb = spatial_neighbors(self.P, self.spec.get("smooth_radius", 0.02))

        loc, nor, sd, _ = nearest_signed(ev["bvh"], self.P)
        pull = np.full(self.nc, pull)
        snug_hi = np.full(self.nc, snug_hi)
        if self.spec["kind"] == "top":
            # 首の付け根から肩（肩の付け根より内側・上）は、離れていても強く詰めて襟ぐりを浮かせない
            sh = self.body.bone_head("J_Bip_L_UpperArm")
            neck = (smoothstep(sh[2] - 0.07, sh[2] - 0.03, self.P[:, 2])
                    * (1.0 - smoothstep(sh[0] - 0.01, sh[0] + 0.03, np.abs(self.P[:, 0]))))
            pull = pull + (self.spec.get("neck_pull", 0.9) - pull) * neck
            snug_hi = snug_hi + (0.08 - snug_hi) * neck
        target = np.where(sd < ease, ease, ease + (1 - pull) * (sd - ease))
        w = (1.0 - smoothstep(snug_lo, snug_hi, sd)) * smoothstep(self.zone_lo - 0.03, self.zone_lo, self.P[:, 2])
        corr = (loc + nor * target[:, None] - self.P) * w[:, None]
        corr = smooth(corr, snb, 12, 0.6)
        self.P = self.P + corr
        if self.spec.get("fit_legs"):
            self.fit_legs(ev, snb)
        self.push_out(ev, ease, snb)

    def fit_legs(self, ev, snb):
        """下衣の脚の筒を太ももに沿わせる（広がった裾を詰める）。

        股より下の点を、太ももの骨の軸から放射方向に、体との隙間が leg_ease になるまで詰める。
        変位は空間的に平滑化し、布の表と裏の組は同じだけ動かすので、ポケットなどの凹凸と厚みは残る。
        """
        leg_ease = self.spec.get("leg_ease", 0.012)
        body = self.body
        z0 = self.zone_lo  # 股の高さ
        w = smoothstep(z0, z0 - 0.04, self.P[:, 2])
        corr = np.zeros_like(self.P)
        n = 0
        for side in ("L", "R"):
            a = body.bone_head(f"J_Bip_{side}_UpperLeg")[:3]
            b = body.bone_head(f"J_Bip_{side}_LowerLeg")[:3]
            ab = b - a
            on_side = (self.P[:, 0] > 0) == (a[0] > 0)
            for i in np.nonzero(on_side & (w > 0))[0]:
                t = np.clip((self.P[i] - a) @ ab / (ab @ ab), 0, 1)
                foot = a + t * ab
                d = self.P[i] - foot
                d -= ab * (d @ ab) / (ab @ ab)  # 軸に垂直な成分だけ
                r = np.linalg.norm(d)
                if r < 1e-6:
                    continue
                u = d / r
                hit = ev["bvh"].ray_cast(Vector(foot), Vector(u), 0.3)
                if hit[0] is None:
                    continue
                gap = r - hit[3]
                if gap > leg_ease:
                    corr[i] = -u * (gap - leg_ease) * w[i]
                    n += 1
        corr = self.tie_pairs(smooth(corr, snb, 12, 0.6))
        self.P = self.P + corr
        self.log(f"脚の筒を太ももに沿わせた点 {n}（最大 {np.linalg.norm(corr, axis=1).max() * 1000:.0f} mm 詰めた）")

    def push_out(self, ev, ease, snb, iterations=8):
        """体にめり込んだ所・近すぎる所を外へ押し出す。押し出しは周りへなめらかに広げる。"""
        before = self.P.copy()
        first = None
        for it in range(iterations):
            _, u, sd, _ = self.nearest_body(ev, self.P)
            e = np.broadcast_to(ease, sd.shape)
            m = np.isfinite(sd) & (sd < e - 1e-4) & ~getattr(self, "hidden_inside", np.zeros(self.nc, dtype=bool))
            if not m.any():
                break
            if first is None:
                first = float((e[m] - sd[m]).max())
            # 向きも周りとそろえる（布の表と裏が別の向きに押されると裏返る）
            u[~np.isfinite(sd)] = 0.0
            u = smooth(u, snb, 3, 1.0)
            u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)
            push = np.zeros_like(self.P)
            push[m] = u[m] * (e[m] - sd[m])[:, None]
            self.P = self.P + spread(push, snb)
        self.untangle(before)
        self.log(f"めり込み押し出し {it + 1} 回（最大 {(first or 0) * 1000:.1f} mm、残り {int(m.sum())} 点）")

    def face_normals(self, P):
        a, b, c = P[self.tris[:, 0]], P[self.tris[:, 1]], P[self.tris[:, 2]]
        return np.cross(b - a, c - a)

    def untangle(self, before, iterations=60):
        """before からの変形で向きが裏返った面の周りだけ、変位をなめらかにして裏返りを直す。"""
        n0 = self.face_normals(before)
        D = self.tie_pairs(self.P - before)
        for it in range(iterations):
            flipped = np.einsum("ij,ij->i", n0, self.face_normals(before + D)) <= 0
            if not flipped.any():
                break
            mark = np.zeros(self.nc, dtype=bool)
            mark[self.tris[flipped].ravel()] = True
            mark = neighbor_avg(mark.astype(float), self.gnb) > 0  # 1 周広げる
            D = self.tie_pairs(np.where(mark[:, None], neighbor_avg(D, self.gnb), D), 1)
        if it:
            self.log(f"裏返りを直した（{it} 回、残り {int(flipped.sum())} 面）")
        self.P = before + D

    def nearest_body(self, ev, P, max_dist=0.08):
        """体の面までの最短点・法線・符号付き距離。

        袖の下側（肩の付け根の高さより下）は腕の面だけを見る（脇の下で胴の面を拾って押す向きを誤らない）。
        肩の上は体全体を見る（腕の面だけだと、肩の上の肌が袖を突き抜けても気づかない）。
        """
        loc, nor, sd, face = nearest_signed(ev["bvh"], P, max_dist)
        sleeve = getattr(self, "sleeve", None)
        if sleeve is not None and sleeve.any():
            below = self.P[:, 2] < self.shoulder_z  # self.P は T ポーズの形
            for side, sign in (("L", 1.0), ("R", -1.0)):
                idx = np.nonzero(sleeve & below & (np.sign(self.P[:, 0]) == sign))[0]
                if len(idx):
                    l2, n2, s2, _ = nearest_signed(ev["arm"][side][0], P[idx], max_dist)
                    ok = np.isfinite(s2)
                    loc[idx[ok]], nor[idx[ok]], sd[idx[ok]] = l2[ok], n2[ok], s2[ok]
        return loc, nor, sd, face

    # --- 髪（かつら）---
    def fit_hair(self, body):
        """髪を頭にかぶせる。頭（顔と元の後ろ髪の土台）に入り込まない最小の大きさを探し、頭の骨に固定する。"""
        dg = bpy.context.evaluated_depsgraph_get()
        verts, polys = [], []
        face = bpy.data.objects.get("Face")
        brow_z = None
        if face:
            me = face.evaluated_get(dg).to_mesh()
            verts.extend(face.matrix_world @ v.co for v in me.vertices)
            polys.extend(tuple(p.vertices) for p in me.polygons)
            brow_mats = {i for i, m in enumerate(me.materials) if m and "brow" in m.name.lower()}
            bz = [verts[v].z for p in me.polygons if p.material_index in brow_mats for v in p.vertices]
            brow_z = max(bz) if bz else None
            face.evaluated_get(dg).to_mesh_clear()
        bme = body.obj.data
        base = len(verts)
        verts.extend(body.obj.matrix_world @ v.co for v in bme.vertices)
        cap = {i for i, m in enumerate(bme.materials) if m and "hairback" in m.name.lower()}
        polys.extend(tuple(base + i for i in p.vertices) for p in bme.polygons if p.material_index in cap)
        used = np.array(sorted({i for p in polys for i in p}))
        H = np.array([tuple(verts[i]) for i in used])
        bvh = BVHTree.FromPolygons(verts, polys)
        top = H[:, 2].max()
        upper = H[H[:, 2] > top - 0.08]
        cy = 0.5 * (upper[:, 1].min() + upper[:, 1].max())
        center = np.array([0.0, cy, top - 0.09])
        self.lining_center = center
        self.brow_z = brow_z

        W = self.P0
        wx = 0.5 * (W[:, 0].min() + W[:, 0].max())
        wtop = W[:, 2].max()
        wu = W[W[:, 2] > wtop - 0.3 * (wtop - W[:, 2].min())]
        wy = 0.5 * (wu[:, 1].min() + wu[:, 1].max())
        gap = self.spec.get("crown_gap", 0.01)
        def inside_head(Q):
            # 頭の面は閉じていない（首・顔の内側が開いている）ので、頭の中心から光線を出して表面より内側かを見る
            out = np.zeros(len(Q), dtype=bool)
            for i, q in enumerate(Q):
                d = q - center
                r = np.linalg.norm(d)
                hit = bvh.ray_cast(Vector(center), Vector(d / max(r, 1e-9)), r + 0.2)
                out[i] = hit[0] is not None and hit[3] > r
            return out

        # Tripo の髪には内側にマネキンの頭の面が入っていて、どの大きさでも一部は頭の中に入る。
        # 大きさを上げていくと中に入る割合が下げ止まる（毛束が頭の外に出て、マネキンだけが残る）。
        # 下げ止まりに inside_tolerance を足した割合まで下がった最初の（いちばん小さい）大きさにする
        sample = W[np.random.default_rng(0).choice(len(W), min(2000, len(W)), replace=False)]
        rows = []
        for sc in np.arange(0.15, 0.45, 0.0025):
            Q = (sample - [wx, wy, wtop]) * sc + [0.0, cy, top + gap]
            Q = Q[Q[:, 2] > top - 0.12]
            rows.append((sc, inside_head(Q).mean()))
        floor = min(r for _, r in rows)
        best = next(sc for sc, r in rows if r < floor + self.spec.get("inside_tolerance", 0.06))
        best = self.spec.get("scale", best)  # 大きさを直接決めたいとき
        self.P = (W - [wx, wy, wtop]) * best + [0.0, cy, top + gap]
        inside = inside_head(self.P)
        # 前髪の下端（顔の前の真ん中の毛先）が目の上（眉の上端から bangs_above_brow 下）に来るまで、髪全体を持ち上げる
        if brow_z is not None:
            bangs = ~inside & (np.abs(self.P[:, 0]) < 0.04) & (self.P[:, 1] < cy - 0.03)
            if bangs.any():
                lift = brow_z + self.spec.get("bangs_above_brow", -0.012) - self.P[bangs, 2].min()
                if lift > 0:
                    self.P[:, 2] += lift
                    inside = inside_head(self.P)
                    self.log(f"前髪を目の上へ {lift * 1000:.0f} mm 持ち上げた")
        self.log(f"倍率 {best:.3f}（頭の中に入る点 {inside.mean():.0%}、下げ止まり {floor:.0%}）")
        # 髪は形を変えない（押し出すと毛束が曲がる）。頭の中に入る点（主に内側のマネキンの面）のうち、
        # 顔の前（額より下）だけ消す。残りは頭の中に隠れ、地肌は素体の髪の土台（色を髪に合わせる）が受け持つ。
        # 横幅を詰めたあとで消し直すと、こめかみの毛まで消えて地肌がのぞくので、消す面は詰める前に決める
        # 内側のマネキンの頭の面は、毛束の隙間から平らな色の面としてのぞく（後ろのまだら、こめかみの白い筋）。
        # 中に入る割合が下げ止まる大きさで頭の中に入る点がマネキンなので、それを全部消す。隙間は地毛の土台が埋める
        sc_floor = next(sc for sc, r in rows if r <= floor + 0.01)
        mannequin = inside_head((W - [wx, wy, wtop]) * sc_floor + [0.0, cy, top + gap])
        self.hidden_inside = mannequin
        self.log(f"マネキンの点 {mannequin.mean():.0%}（倍率 {sc_floor:.3f} で頭の中に入る点）")
        # 顔と髪は別々に作ってあるので、前髪の高さを決めたあと、外にはみ出した毛束だけを内側へずらす。
        # 全体を同じ倍率で縮めると毛束の間隔が変わり、横から奥の隙間がのぞく。頭に沿う毛は動かさない
        width = float(self.spec.get("width_scale", 1.0))
        if width != 1.0:
            ax = np.abs(self.P[:, 0])
            half = float(ax.max())
            inset = half * (1.0 - width)
            inner = float(self.spec.get("width_inner", 0.07))
            # 狭い帯で急にずらすと、その境目で毛束が折れて横から隙間がのぞく
            t = smoothstep(inner, inner + float(self.spec.get("width_band", 0.06)), ax)
            self.P[:, 0] -= np.sign(self.P[:, 0]) * inset * t
            self.log(f"外側の毛を {inset * 1000:.0f} mm 内側へずらした（頭から {inner * 1000:.0f} mm 以内はそのまま）")
        self.ease = np.full(self.nc, self.spec.get("ease", 0.003))
        self.head_center, self.head_bvh, self.brow_z, self.head_cy = center, bvh, brow_z, cy
        head = body.group_names.index("J_Bip_C_Head")
        self.bone_names = body.group_names
        self.w_idx = np.zeros((self.nc, 4), dtype=np.int64)
        self.w_idx[:, 0] = head
        self.w_val = np.zeros((self.nc, 4))
        self.w_val[:, 0] = 1.0

    # --- 6: ウェイト ---
    def transfer_weights(self, ev):
        body = self.body
        loc, nor, sd, face = nearest_signed(ev["bvh"], self.P)
        names = body.group_names
        W = np.zeros((self.nc, len(names)))
        co = ev["co"]
        polys = list(ev["polys"])
        sleeve = getattr(self, "sleeve", np.zeros(self.nc, dtype=bool))
        if sleeve.any():
            # 袖は腕の面だけから写す。脇に近い袖の裏が胴のウェイトを拾うと、腕を下ろしたときに裾が裂ける
            for side, sign in (("L", 1.0), ("R", -1.0)):
                bvh, arm_polys = ev["arm"][side]
                base = len(polys)
                polys.extend(arm_polys)
                for c in np.nonzero(sleeve & (np.sign(self.P[:, 0]) == sign))[0]:
                    l, _, fi, _ = bvh.find_nearest(Vector(self.P[c]))
                    if l is not None:
                        loc[c] = l
                        face[c] = base + fi
        for c in range(self.nc):
            if face[c] < 0:
                continue
            tri = polys[face[c]]
            pts = co[list(tri)]
            if len(tri) == 3:
                bc = barycentric(loc[c], pts)
            else:
                d = np.linalg.norm(pts - loc[c], axis=1)
                bc = 1.0 / np.maximum(d, 1e-6)
                bc /= bc.sum()
            for vi, b in zip(tri, bc):
                for g, wv in body.weights[vi].items():
                    W[c, g] += b * wv
        # 体から離れた頂点は、体に近い頂点のウェイトから拡散させる（裾・フリルが脚に引っ張られない）
        # 下衣は脚を包む筒なので、離れた所（広い裾）も近い脚のウェイトをそのまま使う
        snug = self.spec.get("weight_snug", 0.025 if self.spec["kind"] == "top" else 1.0)
        fixed = (np.abs(sd) < snug) | sleeve
        if sleeve.any():
            # 袖は腕の骨だけで動かす。脇の下に近い袖の下側が胴のウェイトを拾うと、腕を上げたときに
            # 袖の下側が脇に残り、腕が袖から抜ける。身頃とのつなぎ目から 3 周までは元のウェイトとなめらかにつなぐ
            ring = np.full(self.nc, np.inf)
            reached = ~sleeve
            for k in range(1, 4):
                reached = reached | (neighbor_avg(reached.astype(float), self.gnb) > 0)
                ring[reached & sleeve & ~np.isfinite(ring)] = k
            blend = np.where(np.isfinite(ring), (ring - 1) / 3.0, 1.0)
            # 肩の付け根より上の袖山は、下の肌（肩と腕のウェイトが混ざる）と同じ動きにする。
            # 腕だけで動かすと、腕を下ろしたときに肩の肌が盛り上がって袖山を突き抜ける
            blend *= 1.0 - smoothstep(self.shoulder_z - 0.03, self.shoulder_z, self.P[:, 2])
            for side, sign in (("L", 1.0), ("R", -1.0)):
                cols_arm = [i for i, n in enumerate(names) if n.startswith(f"J_Bip_{side}_") and
                            any(k in n for k in ("UpperArm", "LowerArm", "Hand"))]
                m = sleeve & (np.sign(self.P[:, 0]) == sign)
                arm_w = np.zeros_like(W[m])
                arm_w[:, cols_arm] = W[m][:, cols_arm]
                tot = arm_w.sum(axis=1, keepdims=True)
                up = names.index(f"J_Bip_{side}_UpperArm")
                arm_w[tot[:, 0] < 1e-6, up] = 1.0
                arm_w /= np.maximum(arm_w.sum(axis=1, keepdims=True), 1e-9)
                W[m] = W[m] * (1 - blend[m, None]) + arm_w * blend[m, None]
        self.log(f"ウェイトを写した頂点 {fixed.sum()} / {self.nc}")
        cols = np.nonzero(W.sum(axis=0) > 1e-6)[0]
        Wc = W[:, cols]
        X = Wc.copy()
        X[~fixed] = 0.0
        for _ in range(400):
            X = np.where(fixed[:, None], Wc, neighbor_avg(X, self.gnb))
        # 体に近い頂点は素体と同じウェイトのまま（平滑化すると素体と違う動きになり、腕を下ろしたときに肌が突き抜ける）
        X = np.where(fixed[:, None], Wc, smooth(X, self.gnb, 4, 0.5))
        # 布の表と裏（数 mm 離れた点）は同じ動きにする。違うと T ポーズへ戻したときに表裏が入れ替わり、穴に見える
        X = self.tie_pairs(smooth(X, spatial_neighbors(self.P, self.spec.get("shell_radius", 0.006)), 2, 1.0))
        if self.spec["kind"] == "skirt":
            # スカートは左右の脚のウェイトを横へなだらかに混ぜる。前の布が片脚だけに付くと、脚を上げたときに裂ける
            low = 1.0 - smoothstep(self.zone_lo - 0.02, self.zone_lo + 0.04, self.P[:, 2])
            blur = smooth(X, spatial_neighbors(self.P, 0.05), self.spec.get("leg_blur", 30), 1.0)
            X = self.tie_pairs(X * (1 - low[:, None]) + blur * low[:, None])
        aw = getattr(self, "armpit_w", np.zeros(self.nc))
        if aw.any():
            # 脇の周りは腕と胴のウェイトを広くぼかす。肌と同じウェイトのままだと、腕を振ったときに
            # 布が肌の折れ目に沿って体の中へ折れ込む。ぼかすと布が折れ目の上を渡る
            blur = smooth(X, spatial_neighbors(self.P, 0.03), self.spec.get("armpit_blur", 40), 1.0)
            X = self.tie_pairs(X * (1 - aw[:, None]) + blur * aw[:, None])
        W = np.zeros_like(W)
        W[:, cols] = X
        X = W
        # 指の骨は手へ寄せる
        idx = {n: i for i, n in enumerate(names)}
        for n, i in idx.items():
            for side in ("L", "R"):
                if n.startswith(f"J_Bip_{side}_") and any(k in n for k in ("Thumb", "Index", "Middle", "Ring", "Little")):
                    X[:, idx[f"J_Bip_{side}_Hand"]] += X[:, i]
                    X[:, i] = 0.0
        # 上位 4 本に絞って正規化
        order = np.argsort(-X, axis=1)[:, :4]
        top = np.take_along_axis(X, order, axis=1)
        top /= np.maximum(top.sum(axis=1, keepdims=True), 1e-9)
        self.w_idx, self.w_val = order, top
        self.bone_names = names

    # --- 7: T ポーズへ戻す ---
    def unpose(self):
        S = self.body.skin_matrices()
        mats = np.stack([S.get(n, np.eye(4)) for n in self.bone_names])
        M = np.einsum("ck,ckij->cij", self.w_val, mats[self.w_idx])
        Minv = np.linalg.inv(M)
        Ph = np.hstack([self.P, np.ones((self.nc, 1))])
        self.P = np.einsum("cij,cj->ci", Minv, Ph)[:, :3]

    def posed_positions(self, S):
        """今の骨の行列 S で、服の各点をスキニングした位置と、その変換行列。"""
        mats = np.stack([S.get(n, np.eye(4)) for n in self.bone_names])
        M = np.einsum("ck,ckij->cij", self.w_val, mats[self.w_idx])
        Ph = np.hstack([self.P, np.ones((self.nc, 1))])
        return np.einsum("cij,cj->ci", M, Ph)[:, :3], M

    def relax_in_poses(self, poses, rounds=3):
        """よく使うポーズ（腕を下ろす・歩く・座る）で体にめり込む所を、元の形（T ポーズ）で外へ広げる。

        同じウェイトで動かしても、体が折れ曲がる所（脇の下・股）では服が体に入り込む。
        ポーズごとに押し出す量を求め、その点の変換の逆で T ポーズの形へ戻して足す。
        """
        ease = self.ease
        snb = spatial_neighbors(self.P, self.spec.get("smooth_radius", 0.02))
        before = self.P.copy()
        for r in range(rounds):
            total = np.zeros_like(self.P)
            counts = []
            for name in poses:
                self.body.set_pose(TEST_POSES[name])
                ev = self.body.evaluate()
                Q, M = self.posed_positions(self.body.skin_matrices())
                _, u, sd, _ = self.nearest_body(ev, Q)
                m = np.isfinite(sd) & (sd < ease)
                counts.append(int(m.sum()))
                push = np.zeros_like(Q)
                push[m] = u[m] * (ease[m] - sd[m])[:, None]
                rest_push = np.einsum("cij,cj->ci", np.linalg.inv(M[:, :3, :3]), push)
                bigger = np.linalg.norm(rest_push, axis=1) > np.linalg.norm(total, axis=1)
                total[bigger] = rest_push[bigger]
            self.log(f"ポーズ別のめり込み（{r + 1} 回目） {dict(zip(poses, counts))}")
            if not total.any():
                break
            self.P = self.P + spread(total, snb)
        self.untangle(before)
        self.body.set_pose([])

    # --- 書き込み ---
    def write_mesh(self):
        me = self.obj.data
        for c, vs in enumerate(self.c2v):
            for vi in vs:
                me.vertices[vi].co = self.P[c]
        me.update()
        cn = np.zeros((self.nc, 3))
        for poly in me.polygons:
            for vi in poly.vertices:
                cn[self.v2c[vi]] += np.array(poly.normal)
        cn /= np.maximum(np.linalg.norm(cn, axis=1, keepdims=True), 1e-9)
        me.normals_split_custom_set([tuple(cn[self.v2c[l.vertex_index]]) for l in me.loops])

    def bind(self):
        o = self.obj
        arm = self.body.arm
        o.parent = arm
        o.matrix_parent_inverse = arm.matrix_world.inverted()
        mod = o.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = arm
        o.vertex_groups.clear()
        groups = {}
        for c, vs in enumerate(self.c2v):
            for k in range(4):
                w = float(self.w_val[c, k])
                if w < 1e-4:
                    continue
                n = self.bone_names[self.w_idx[c, k]]
                if n not in groups:
                    groups[n] = o.vertex_groups.new(name=n)
                groups[n].add(vs, w, "REPLACE")


def barycentric(p, tri):
    a, b, c = tri
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
    d20, d21 = v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-14:
        return np.array([1 / 3, 1 / 3, 1 / 3])
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    bc = np.clip(np.array([1 - v - w, v, w]), 0, 1)
    return bc / bc.sum()


# ---------------------------------------------------------------------------
# 確認用のポーズ（隠れる素体頂点の判定・めり込みの集計に使う）
# ---------------------------------------------------------------------------

TEST_POSES = {
    "rest": [],
    "arms_down": [("J_Bip_L_UpperArm", "Y", 70), ("J_Bip_R_UpperArm", "Y", -70)],
    # 待機モーション（Standing Idle）に近い、腕を体の横まで下ろして少し後ろへ引いた姿
    "idle": [
        ("J_Bip_L_UpperArm", "Y", 82), ("J_Bip_R_UpperArm", "Y", -82),
        ("J_Bip_L_UpperArm", "X", 10), ("J_Bip_R_UpperArm", "X", 10),
        ("J_Bip_L_LowerArm", "Z", -15), ("J_Bip_R_LowerArm", "Z", 15),
    ],
    "arms_forward": [("J_Bip_L_UpperArm", "Z", -80), ("J_Bip_R_UpperArm", "Z", 80)],
    # 歩くときの腕の振り（体の横に下ろした腕を前後へ振り切った姿）
    "swing_front": [
        ("J_Bip_L_UpperArm", "Y", 78), ("J_Bip_R_UpperArm", "Y", -78),
        ("J_Bip_L_UpperArm", "X", -25), ("J_Bip_R_UpperArm", "X", -25),
        ("J_Bip_L_LowerArm", "Z", -20), ("J_Bip_R_LowerArm", "Z", 20),
    ],
    "swing_back": [
        ("J_Bip_L_UpperArm", "Y", 78), ("J_Bip_R_UpperArm", "Y", -78),
        ("J_Bip_L_UpperArm", "X", 25), ("J_Bip_R_UpperArm", "X", 25),
    ],
    "walk": [
        ("J_Bip_L_UpperArm", "Y", 68), ("J_Bip_R_UpperArm", "Y", -68),
        ("J_Bip_L_UpperLeg", "X", -30), ("J_Bip_R_UpperLeg", "X", 20), ("J_Bip_L_LowerLeg", "X", 35),
    ],
    "sit": [
        ("J_Bip_L_UpperArm", "Y", 68), ("J_Bip_R_UpperArm", "Y", -68),
        ("J_Bip_L_UpperLeg", "X", -85), ("J_Bip_R_UpperLeg", "X", -85),
        ("J_Bip_L_LowerLeg", "X", 85), ("J_Bip_R_LowerLeg", "X", 85),
    ],
}


# 隠れる面の判定に使うポーズ。T ポーズ・腕を前に伸ばす姿は場面にほぼ出ないので使わない
# （使うと、そのポーズでだけ見える脇の下の肌が残り、腕を下ろしたときに袖を突き抜けて見える）
VISIBILITY_POSES = ("arms_down", "idle", "swing_front", "swing_back", "walk", "sit")


def ray_dirs(n):
    """法線と、法線から 50° 傾けた上下左右の 4 方向。服の開口部から覗ける所は隠れない扱いになる。"""
    n = Vector(n)
    t1 = n.orthogonal().normalized()
    t2 = n.cross(t1).normalized()
    up = Vector((0, 0, 1))
    if abs(n.dot(up)) < 0.95:
        t1 = (up - n * n.dot(up)).normalized()
        t2 = n.cross(t1).normalized()
    c, s = math.cos(math.radians(50)), math.sin(math.radians(50))
    return [n, n * c + t1 * s, n * c - t1 * s, n * c + t2 * s, n * c - t2 * s]


def covered(points_in_pose, occluders, body, max_dist=0.15, poke_depth=0.0):
    """全テストポーズで、外側の服（occluders）に覆われて見えない点。

    points_in_pose(): 今のポーズでの点の位置。光線の向きは、点にいちばん近い体の面の外向き法線から決める。
    poke_depth > 0 のときは、内向きにその距離以内に服の面がある点（服を突き抜けている点）も隠れる扱いにする。
    腕を下ろしたときの脇の下のように、体が折れて肌が服を突き抜ける所は、肌を消せば後ろの服が見える。
    """
    mask = None
    for name, rot in TEST_POSES.items():
        if name not in VISIBILITY_POSES:
            continue
        body.set_pose(rot)
        ev = body.evaluate()
        P = points_in_pose()
        _, nor, _, _ = nearest_signed(ev["bvh"], P)
        occ = combined_bvh(occluders)
        hit = np.zeros(len(P), dtype=bool)
        todo = range(len(P)) if mask is None else np.nonzero(mask)[0]
        for i in todo:
            o = Vector(P[i]) + Vector(nor[i]) * 1e-3
            hit[i] = all(occ.ray_cast(o, d, max_dist)[0] is not None for d in ray_dirs(nor[i]))
            if not hit[i] and poke_depth > 0:
                hit[i] = occ.ray_cast(Vector(P[i]), -Vector(nor[i]), poke_depth)[0] is not None
        mask = hit if mask is None else (mask & hit)
    body.set_pose([])
    return mask


def erode(mask, edges):
    """見える所と接する点を外す（開口部の縁を 1 周ぶん残す）。"""
    border = np.zeros_like(mask)
    border[edges[:, 0]] |= ~mask[edges[:, 1]]
    border[edges[:, 1]] |= ~mask[edges[:, 0]]
    return mask & ~border


def evaluated_points(obj, indices=None):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    P = np.array([tuple(obj.matrix_world @ v.co) for v in me.vertices])
    ev.to_mesh_clear()
    return P if indices is None else P[indices]


def penetration_report(body, garments):
    report = {}
    for name, rot in TEST_POSES.items():
        body.set_pose(rot)
        ev = body.evaluate()
        report[name] = {}
        for g in garments:
            _, _, sd, _ = nearest_signed(ev["bvh"], evaluated_points(g.obj), 0.05)
            report[name][g.name] = int((sd < -0.002).sum())
        print(f"  [pose {name}] 体へのめり込み（2mm 超の頂点数） {report[name]}")
    body.set_pose([])
    return report


def tuck_under(inner, outers, body, layer_ease=0.003, min_gap=0.0015):
    """内側の服が外側の服より外へ出ている所を、体の法線に沿って外側の服の内側へ押し込む（T ポーズで）。"""
    ev = body.evaluate()
    occ = combined_bvh([o.obj for o in outers])
    loc, nor, sd, _ = nearest_signed(ev["bvh"], inner.P)
    disp = np.zeros_like(inner.P)
    for i in range(inner.nc):
        hit = occ.ray_cast(Vector(loc[i] + nor[i] * 1e-3), Vector(nor[i]), 0.12)
        if hit[0] is None:
            continue
        t_o = hit[3] + 1e-3
        if sd[i] > t_o - layer_ease:
            disp[i] = nor[i] * (max(min_gap, t_o - layer_ease) - sd[i])
    n = int((np.linalg.norm(disp, axis=1) > 1e-5).sum())
    snb = spatial_neighbors(inner.P, 0.015)
    inner.P = inner.P + spread(disp, snb)
    inner.write_mesh()
    inner.log(f"外側の服の下へ押し込んだ点 {n}")


def delete_hidden_faces(g, outers, body):
    first = np.array([vs[0] for vs in g.c2v])
    hidden = covered(lambda: evaluated_points(g.obj, first), [o.obj for o in outers], body, poke_depth=0.02)
    delete_faces(g, erode(hidden, g.edges), "外側の服に隠れる面を削除")


class _Layer:
    def __init__(self, name, obj):
        self.name, self.obj = name, obj


def make_inner_hair(g, ratio, turn_deg, name):
    """髪を頭の中心へ向けて ratio 倍に縮めた内側の層を作る（統合時に暗い色にする）。

    毛束の隙間から額や頭がのぞく所を、奥の暗い毛でふさぐ。頭の中に入る点は頭の表面のすぐ外へ出す。
    """
    obj = g.obj.copy()
    obj.data = g.obj.data.copy()
    obj.name = name
    bpy.context.scene.collection.objects.link(obj)
    c = g.head_center
    ease = g.spec.get("ease", 0.003)
    n = 0
    R = Matrix.Rotation(math.radians(turn_deg), 3, "Z")
    for v in obj.data.vertices:
        p = np.array(tuple(v.co))
        d = np.array(R @ Vector(p - c))
        r = np.linalg.norm(d)
        if r < 1e-6:
            continue
        u = d / r
        q = c + u * r * ratio
        hit = g.head_bvh.ray_cast(Vector(c), Vector(u), r + 0.2)
        if hit[0] is not None and r * ratio < hit[3] + ease:
            q = c + u * min(r, hit[3] + ease)
            n += 1
        v.co = q
    obj.data.update()
    # 顔の前（眉より下）に来る毛は消す。前髪の奥に暗い毛が重なると目に掛かる
    if g.brow_z is not None:
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        front = [f for f in bm.faces if all(v.co.z < g.brow_z + 0.01 and v.co.y < g.head_cy - 0.02 for v in f.verts)]
        bmesh.ops.delete(bm, geom=front, context="FACES")
        bm.to_mesh(obj.data)
        bm.free()
    g.log(f"内側の層を作った（倍率 {ratio}、回転 {turn_deg}°、頭の表面で止めた点 {n}）")
    return _Layer(obj.name, obj)


def delete_faces(g, hidden, label):
    """頂点がすべて hidden（溶接した点の単位）の面を消す。"""
    me = g.obj.data
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    faces = [f for f in bm.faces if all(hidden[g.v2c[v.index]] for v in f.verts)]
    bmesh.ops.delete(bm, geom=faces, context="FACES_ONLY")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    g.log(f"{label} {len(faces)}")


def add_hair_lining(g, inset=0.0012):
    """正面から見て右のこめかみに、縦に背景が透ける細い隙間がある。そこだけ塞ぐ。

    位置は顔アップのカメラ（距離 0.85、レンズ 2.2）で、左右が毛なのに当たらない画素の
    両脇の面から測った。頭全体に裏地を張ると前髪が平らな赤になるので、この隙間だけにする。
    """
    import bmesh

    me = g.obj.data
    # Blender 座標（X 幅、Y 奥行き、Z 高さ）。正面カメラで測った隙間の中心
    centers = [
        (0.0804, 0.0203, 1.5342),
        (0.0831, 0.0204, 1.5288),
        (0.0855, 0.0211, 1.5235),
        (0.0874, 0.0222, 1.5190),
        (0.0901, 0.0200, 1.5117),
        (0.0927, 0.0180, 1.5038),
        (0.0944, 0.0160, 1.4960),
        (0.0966, 0.0140, 1.4879),
        (0.0980, 0.0153, 1.4826),
    ]
    mat = bpy.data.materials.new("HairLining")
    mat.use_nodes = True
    mat.use_backface_culling = False
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.40, 0.045, 0.06, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.85
    mat_idx = len(me.materials)
    me.materials.append(mat)
    bm = bmesh.new()
    bm.from_mesh(me)
    deform = bm.verts.layers.deform.verify()
    head_index = g.obj.vertex_groups["J_Bip_C_Head"].index
    right = Vector((1.0, 0.0, 0.0))
    up = Vector((0.0, 0.0, 1.0))
    rx, ry = 0.0028, 0.005
    n = 0
    for c in centers:
        mid = Vector(c)
        corners = (
            mid + right * rx + up * ry,
            mid - right * rx + up * ry,
            mid - right * rx - up * ry,
            mid + right * rx - up * ry,
        )
        verts = [bm.verts.new(p) for p in corners]
        for vert in verts:
            vert[deform][head_index] = 1.0
        face = bm.faces.new(verts)
        face.material_index = mat_idx
        n += 1
    bm.to_mesh(me)
    bm.free()
    try:
        me.free_normals_split()
    except AttributeError:
        pass
    me.update()
    g.log(f"右のこめかみの隙間を {n} 枚で塞いだ")



# ---------------------------------------------------------------------------

def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    cfg_path = args[0]
    only = None
    if "--only" in args:
        only = {name.strip() for name in args[args.index("--only") + 1].split(",") if name.strip()}
    with open(cfg_path) as f:
        cfg = json.load(f)
    os.makedirs(cfg["work_dir"], exist_ok=True)

    # エンジンで実際のモーションを再生して書き出した姿勢（scripts/dump_engine_pose.ts）も、確認と補正に使う
    global VISIBILITY_POSES
    for name, path in cfg.get("engine_poses", {}).items():
        TEST_POSES[name] = path
        VISIBILITY_POSES = VISIBILITY_POSES + (name,)
    engine_names = list(cfg.get("engine_poses", {}))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    # 素体に作り込まれた服（strip_body_materials）は当たり判定から外し、統合時に消す
    body = Body(cfg["body"], cfg.get("strip_body_materials", []))
    done = []
    hairs = []  # 髪は重ね着・隠れる肌の判定に入れない
    for spec in cfg["garments"]:  # 内側の服から順に
        if only and spec["name"] not in only:
            print(f"\n=== {spec['name']} は飛ばす ===")
            continue
        print(f"\n=== {spec['name']} ({spec['kind']}) ===")
        g = Garment(spec, body)
        if spec["kind"] == "hair":
            g.fit_hair(body)
            g.write_mesh()
            g.bind()
            delete_faces(g, g.hidden_inside, "マネキンの面を削除")
            hairs.append(g)
            if spec.get("inner_layer", True):
                # 中心へ縮めるだけだと毛束の隙間も同じ向きに並ぶので、層ごとに頭の縦軸まわりに少し回す
                for k, (ratio, turn) in enumerate(spec.get("inner_layers", [[0.95, 5.0], [0.9, -5.0]])):
                    hairs.append(make_inner_hair(g, ratio, turn, f"{g.name}Inner{k + 1}"))
            continue
        ev = g.coarse_fit()
        g.conform(ev)
        g.transfer_weights(ev)
        g.unpose()
        body.set_pose([])
        g.write_mesh()
        g.bind()
        snb = spatial_neighbors(g.P, spec.get("smooth_radius", 0.02))
        g.push_out(body.evaluate(), g.ease, snb, 6)
        # 座る姿の股の付け根のような深い折れ目まで広げると服が膨らむので、よく出る立ち姿だけで広げる。
        # 残るめり込みは、服を突き抜ける肌を消すことで隠す（covered の poke_depth）
        g.relax_in_poses(spec.get("relax_poses", ["arms_down", "idle", "swing_front", "swing_back", "walk"]) + engine_names)
        g.push_out(body.evaluate(), g.ease, snb, 3)
        g.write_mesh()
        done.append(g)

    # --only のときは服の再計算と、隠れる頂点の上書きをしない（髪だけ直すとき服の結果を残す）
    if not only:
        print("\n=== 重ね着 ===")
        for k, g in enumerate(done[:-1]):
            tuck_under(g, done[k + 1:], body)
            g.push_out(body.evaluate(), 0.0015, spatial_neighbors(g.P, 0.015), 4)
            g.write_mesh()
        for k, g in enumerate(done[:-1]):
            delete_hidden_faces(g, done[k + 1:], body)

        print("\n=== 確認 ===")
        report = penetration_report(body, done)
        body_pts = np.nonzero(body.vert_ok)[0]
        hidden = np.zeros(len(body.rest_co), dtype=bool)
        hidden[body_pts] = covered(lambda: body.evaluate()["co"][body_pts], [g.obj for g in done], body, poke_depth=0.02)
        hidden = erode(hidden, body.edges)
        # 素体に作り込まれたインナー（VRoid の Onepiece など）は、服から 6cm 以内なら見え方によらず消す
        # （首元・袖口から下のインナーがのぞくと、服の下に別の服を着ているように見える）
        keys = [k.lower() for k in cfg.get("remove_body_materials_under_garments", [])]
        removed_materials = []
        if keys:
            me = body.obj.data
            mats = {i for i, m in enumerate(me.materials) if m and any(k in m.name.lower() for k in keys)}
            verts = sorted({v for p in me.polygons if p.material_index in mats for v in p.vertices})
            gb = combined_bvh([g.obj for g in done])
            r = cfg.get("remove_body_materials_distance", 0.06)
            near = [v for v in verts if gb.find_nearest(Vector(body.rest_co[v]), r)[0] is not None]
            hidden[near] = True
            print(f"  服の下のインナーの頂点 {len(near)} / {len(verts)}")
            if len(near) == len(verts):  # 全部が服の下なら、統合時にメッシュごと外す
                removed_materials = [me.materials[i].name for i in mats]
        gltf_co = [[round(float(p[0]), 6), round(float(p[2]), 6), round(float(-p[1]), 6)] for p in body.rest_co[hidden]]
        with open(os.path.join(cfg["work_dir"], "body_hidden_vertices.json"), "w") as f:
            json.dump({"positions": gltf_co, "remove_materials": removed_materials, "penetration": report}, f)
        print(f"  服に隠れる素体の頂点 {hidden.sum()}")

    for g in done + hairs:
        for o in bpy.data.objects:
            o.select_set(False)
        body.arm.select_set(True)
        g.obj.select_set(True)
        bpy.context.view_layer.objects.active = body.arm
        out = os.path.join(cfg["work_dir"], f"{g.name}.glb")
        bpy.ops.export_scene.gltf(
            filepath=out, export_format="GLB", use_selection=True, export_skins=True,
            export_all_influences=False, export_yup=True, export_apply=False,
        )
        print(f"書き出し {out}")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(cfg["work_dir"], "fitted.blend")))


if __name__ == "__main__":
    main()
