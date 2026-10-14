"""
片腕（肩・上腕・前腕・手首・指）の動きを、反対の腕へ左右反転して写す（片方の腕だけ不自然なポーズを直す。
例：腰に手を当てる pose_hands_on_hips_proud で、右の前腕のひねりが左と違い、右手が横腹でなくお腹の前に来て手のひらが上を向く）。

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    -P scripts/blender/mirror_arm.py -- 入力.fbx 出力.fbx 写す元の腕（Left|Right）

Mixamo の骨は左右が X 軸で鏡写しなので、各フレームの回転 (w, x, y, z) を (w, x, -y, -z) にして反対の骨へ入れる。
"""
import sys

import bpy
from mathutils import Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
SRC, DST, SIDE = args[0], args[1], args[2]
OTHER = 'Right' if SIDE == 'Left' else 'Left'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
action = arm.animation_data.action
scene = bpy.context.scene
start, end = (int(v) for v in action.frame_range)
bones = arm.pose.bones

parts = ('Shoulder', 'Arm', 'ForeArm', 'Hand')
source = [pb.name for pb in bones if any(pb.name.startswith(f'mixamorig:{SIDE}{p}') for p in parts)]

poses = {}
for frame in range(start, end + 1):
    scene.frame_set(frame)
    pose = {}
    for name in source:
        q = bones[name].rotation_quaternion
        target = name.replace(f'mixamorig:{SIDE}', f'mixamorig:{OTHER}', 1)
        if target in bones:
            pose[target] = Quaternion((q.w, q.x, -q.y, -q.z))
    poses[frame] = pose

for frame, pose in poses.items():
    for name, quat in pose.items():
        bones[name].rotation_quaternion = quat
        bones[name].keyframe_insert('rotation_quaternion', frame=frame)

# 書き出しの基準（Tポーズ）を範囲外のフレームに置く（spread_arms.py と同じ）
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
print('wrote', DST, 'bones', len(poses.get(start, {})))
