"""
腕を体の外へ開いて、手が胴に食い込むポーズを直す（例：腰に手を当てる pose_hands_on_hips_proud）。

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    -P scripts/blender/spread_arms.py -- 入力.fbx 出力.fbx 上腕の角度 [前腕の角度]

毎フレーム、左右の上腕を肩を中心に体の外へ「上腕の角度」（度）だけ開く（正面から見た面の中の回転）。
「前腕の角度」を付けると、肘を中心に前腕を同じ向きにさらに開く（手首から先と体の揺れは元のまま）。
Blender の世界座標は Z が上、キャラクターは -Y を向く。
"""
import math
import sys

import bpy
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = args[0], args[1]
UPPER = math.radians(float(args[2]))
FORE = math.radians(float(args[3])) if len(args) > 3 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
action = arm.animation_data.action
scene = bpy.context.scene
start, end = (int(v) for v in action.frame_range)
bones = arm.pose.bones
W = arm.matrix_world
W_inv = W.inverted()


def update():
    bpy.context.view_layer.update()


def spread(pb, angle):
    """pb を付け根を中心に、正面から見た面の中で体の外へ angle だけ回す"""
    world = W @ pb.matrix
    head = world.to_translation()
    side = 1 if head.x > 0 else -1  # +X がキャラクターの左
    # 下を向いた腕を外（side 方向）へ振る：Y 軸まわりに -side*angle
    rot = Matrix.Translation(head) @ Matrix.Rotation(-side * angle, 4, 'Y') @ Matrix.Translation(-head)
    pb.matrix = W_inv @ (rot @ world)
    update()


poses = {}
for frame in range(start, end + 1):
    scene.frame_set(frame)
    for name in ('LeftArm', 'RightArm'):
        spread(bones[f'mixamorig:{name}'], UPPER)
    if FORE:
        for name in ('LeftForeArm', 'RightForeArm'):
            spread(bones[f'mixamorig:{name}'], FORE)
    poses[frame] = {pb.name: pb.matrix.copy() for pb in bones if pb.name.endswith(('Arm', 'ForeArm'))}

for frame, pose in poses.items():
    scene.frame_set(frame)
    for name, matrix in pose.items():
        bones[name].matrix = matrix
        update()
        bones[name].keyframe_insert('rotation_quaternion', frame=frame)

# 書き出しの基準（Tポーズ）を範囲外のフレームに置く（make_desk_chin_rest.py と同じ）
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
