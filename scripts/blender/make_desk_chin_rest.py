"""
chin_rest.fbx（座面のない中腰の頬杖）から、椅子に座って机に両肘をつく頬杖 desk_chin_rest.fbx を作る。

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    -P scripts/blender/make_desk_chin_rest.py -- assets/animations/chin_rest.fbx assets/animations/desk_chin_rest.fbx

元の動き（体の揺れ・頭の傾き・右手の頬の位置）は残し、毎フレーム次を上書きする。
- 腰: 座面の高さまで下げ、上半身を前へ倒す
- 脚: 太ももを水平、すねを垂直（股関節・膝が90度）、足裏を床に
- 右腕: 手は元の頬の位置（頭に対する位置・向き）のまま、肘を机の上に置く（2関節のIK）
- 左腕: 肘から先を机の上に寝かせる

寸法はメートル、Blender の世界座標（Z が上、キャラクターは -Y を向く）。腰の真下を原点とする。
机は場所の座標で、椅子の座面 0.45m・机の高さ 0.66m・腰から机の手前の縁まで 0.13m を想定する
（packages/content/src/sets/painted-aoi-room/layout.ts の DESK・DESK_CHAIR）。
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

SRC, DST = sys.argv[-2], sys.argv[-1]

HIPS_Z = 0.62          # 腰（Hips の付け根）の高さ。座面 0.45m に尻が乗る
LEAN = math.radians(12)  # 上半身を前へ倒す角度
DESK_TOP = 0.66
FOREARM_ON_DESK = DESK_TOP + float(__import__("os").environ.get("FOREARM_LIFT", "0.045"))  # 前腕の太さの半分＋アオイの体格で下がる分だけ机より上
ANKLE_Z = 0.085

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
action = arm.animation_data.action
scene = bpy.context.scene
start, end = (int(v) for v in action.frame_range)
scene.frame_start, scene.frame_end = start, end

bones = arm.pose.bones
P = lambda name: bones[f'mixamorig{name}']
W = arm.matrix_world
W_inv = W.inverted()


def update():
    bpy.context.view_layer.update()


def world(pb):
    return W @ pb.matrix


def set_world(pb, matrix):
    pb.matrix = W_inv @ matrix
    update()


def head(pb):
    return W @ pb.head


def tail(pb):
    return W @ pb.tail


def point_at(pb, target):
    """ボーンの向き（Y軸）を target へ向ける。ひねりは最小の回転で保つ。"""
    m = world(pb)
    current = (tail(pb) - head(pb)).normalized()
    wanted = (target - head(pb)).normalized()
    rot = current.rotation_difference(wanted).to_matrix().to_4x4()
    pivot = head(pb)
    set_world(pb, Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot) @ m)


def two_bone_ik(shoulder, target, upper, lower, pole):
    """肩・手の位置と骨の長さから肘の位置。pole の側に肘を出す。"""
    d = target - shoulder
    dist = min(d.length, upper + lower - 1e-4)
    axis = d.normalized()
    a = (upper * upper - lower * lower + dist * dist) / (2 * dist)
    h = math.sqrt(max(upper * upper - a * a, 0.0))
    side = (pole - axis * pole.dot(axis)).normalized()
    return shoulder + axis * a + side * h


def hand_basis(fingers, palm):
    """左手の回転：ボーンの Y を fingers、手のひらの向き（基準のTポーズで下を向く軸）を palm にする。"""
    rest = (W @ arm.data.bones['mixamorigLeftHand'].matrix_local).to_3x3().normalized()
    axes = {'X': rest.col[0], '-X': -rest.col[0], 'Z': rest.col[2], '-Z': -rest.col[2]}
    name = max(axes, key=lambda k: axes[k].dot(Vector((0, 0, -1))))
    y = fingers.normalized()
    p = (palm - y * palm.dot(y)).normalized()
    if name in ('Z', '-Z'):
        z = p if name == 'Z' else -p
        x = y.cross(z)
    else:
        x = p if name == 'X' else -p
        z = x.cross(y)
    return Matrix((x, y, z)).transposed().to_4x4()


def length(pb):
    return (tail(pb) - head(pb)).length


scene.frame_set(start)
LEN = {n: length(P(n)) for n in ['LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'RightArm', 'RightForeArm', 'LeftArm', 'LeftForeArm']}
print('lengths', {k: round(v, 3) for k, v in LEN.items()})

keyed = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
         'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand']
poses = {}
for frame in range(start, end + 1):
    scene.frame_set(frame)
    # 右手の頬の位置・向きを、元の姿勢の頭からの相対で覚えておく
    hand_from_head = world(P('Head')).inverted() @ world(P('RightHand'))

    # 腰: 原点の真上へ下げ、腰の付け根を軸に前へ倒す（X軸まわりの正の回転で頭が -Y へ出る）
    hips = P('Hips')
    h = head(hips)
    lean = Matrix.Translation(h) @ Matrix.Rotation(LEAN, 4, 'X') @ Matrix.Translation(-h)
    # 腰の付け根は前後を原点、高さを座面に合わせる（左右の揺れは残す）
    set_world(hips, Matrix.Translation(Vector((0, -h.y, HIPS_Z - h.z))) @ lean @ world(hips))

    # 脚: 太もも水平・すね垂直・足裏を床に
    for side in ['Left', 'Right']:
        up, leg, foot = P(f'{side}UpLeg'), P(f'{side}Leg'), P(f'{side}Foot')
        hip_joint = head(up)
        knee = hip_joint + Vector((0.02 if side == 'Left' else -0.02, -LEN[f'{side}UpLeg'], 0))
        knee.z = hip_joint.z - 0.03
        point_at(up, knee)
        knee = tail(up)
        ankle = Vector((knee.x, knee.y - 0.03, ANKLE_Z))
        point_at(leg, ankle)
        ankle = tail(leg)
        point_at(foot, ankle + Vector((0, -0.12, -0.06)))

    # 右腕: 手は頭に対する元の位置、肘は机の上
    hand_world = world(P('Head')) @ hand_from_head
    hand_pos = hand_world.to_translation()
    shoulder = head(P('RightArm'))
    elbow = two_bone_ik(shoulder, hand_pos, LEN['RightArm'], LEN['RightForeArm'], Vector((-0.15, -0.34, FOREARM_ON_DESK)) - shoulder)
    point_at(P('RightArm'), elbow)
    point_at(P('RightForeArm'), hand_pos)
    rot_only = hand_world.to_quaternion().to_matrix().to_4x4()
    set_world(P('RightHand'), Matrix.Translation(head(P('RightHand'))) @ rot_only)

    # 左腕: 肘を机の上、前腕を机の上に寝かせて手を体の中央へ
    shoulder = head(P('LeftArm'))
    left_hand = Vector((0.0, head(P("Hips")).y - 0.47, FOREARM_ON_DESK))
    elbow = two_bone_ik(shoulder, left_hand, LEN['LeftArm'], LEN['LeftForeArm'], Vector((0.22, -0.4, FOREARM_ON_DESK)) - shoulder)
    point_at(P('LeftArm'), elbow)
    point_at(P('LeftForeArm'), left_hand)
    # 手は前腕の先へ伸ばし、手のひらを机へ伏せる（元の下ろした手の向きのままだと手の下半分が天板に沈む）
    fingers = (tail(P('LeftForeArm')) - head(P('LeftForeArm')))
    fingers.z = 0
    fingers = (fingers.normalized() + Vector((0, 0, -0.08))).normalized()
    set_world(P('LeftHand'), Matrix.Translation(head(P('LeftHand'))) @ hand_basis(fingers, Vector((0, 0, -1))))

    poses[frame] = {n: P(n).matrix.copy() for n in keyed}
    if frame == start:
        print('frame', frame, 'hips', head(P('Hips')), 'R elbow', tail(P('RightArm')), 'R hand', tail(P('RightForeArm')),
              'L elbow', tail(P('LeftArm')), 'L hand', tail(P('LeftForeArm')), 'knee', tail(P('LeftUpLeg')), 'ankle', tail(P('LeftLeg')),
              'head', head(P('Head')))

# 計算した姿勢をキーにする（計算中は元のキーで評価したいので、最後にまとめて書く）
for frame, pose in poses.items():
    scene.frame_set(frame)
    for name, matrix in pose.items():
        pb = P(name)
        pb.matrix = matrix
        update()
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        if name == 'Hips':
            pb.keyframe_insert('location', frame=frame)

# FBX の書き出しは今のフレームの姿勢を各ボーンの基準（Lcl）として書く。エンジンは基準を
# Tポーズとして変換するので、範囲外のフレーム 0 に基準姿勢のキーを置き、そこで書き出す
for pb in bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.scale = (1, 1, 1)
    for path in ('location', 'rotation_quaternion', 'scale'):
        pb.keyframe_insert(path, frame=start - 1)
scene.frame_set(start - 1)

action.name = 'mixamo.com'
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.fbx(
    filepath=DST, use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
    bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False, bake_anim_simplify_factor=0.0,
)
print('wrote', DST)
