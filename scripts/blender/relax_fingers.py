"""
片手の指の形を、別のモーション（Standing Idle など）の自然な指の形に置き換える（指が鉤爪のように曲がったポーズを直す。例：pose_offer_hand の空いている手）。

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    -P scripts/blender/relax_fingers.py -- 入力.fbx 出力.fbx Left|Right 指の形を取るモーション.fbx

毎フレーム、指の骨の向きを「手の骨から見た向き」が手本のモーションの 1 フレーム目と同じになるようにする（手首から先の位置と腕は元のまま）。
"""
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
SRC, DST, SIDE = args[0], args[1], args[2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
action = arm.animation_data.action
scene = bpy.context.scene
start, end = (int(v) for v in action.frame_range)
bones = arm.pose.bones

# 手本の指の形（手の骨から見た向き）
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=args[3])
model = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o not in before)
model_start = int(model.animation_data.action.frame_range[0])
scene.frame_set(model_start)
bpy.context.view_layer.update()
hand = f'mixamorig:{SIDE}Hand'
FINGERS = [pb.name for pb in arm.pose.bones if pb.name.startswith(f'mixamorig:{SIDE}Hand') and pb.name != hand]
# 付け根から先へ（親を先に置く）
FINGERS.sort(key=lambda name: len(bones[name].parent_recursive))
relative = {}
for name in FINGERS:
    if name not in model.pose.bones:
        continue
    relative[name] = model.pose.bones[hand].matrix.inverted() @ model.pose.bones[name].matrix
bpy.data.objects.remove(model)


def update():
    bpy.context.view_layer.update()


poses = {}
for frame in range(start, end + 1):
    scene.frame_set(frame)
    update()
    for name, rel in relative.items():
        pb = bones[name]
        location = pb.location.copy()
        target = bones[hand].matrix @ rel
        # 向きだけを合わせる（位置は親の骨から決まるまま）
        target.translation = pb.matrix.translation
        pb.matrix = target
        pb.location = location
        update()
    poses[frame] = {name: bones[name].rotation_quaternion.copy() for name in relative}

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
print('wrote', DST, 'fingers', len(relative))
