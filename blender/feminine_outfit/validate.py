import bpy, importlib, math
from mathutils import Quaternion
from mathutils.bvhtree import BVHTree
arm=bpy.data.objects['Armature'];s=arm.data.vrm_addon_extension.spring_bone1
h=importlib.import_module('bl_ext.blender_org.vrm.editor.spring_bone1.handler')
def intersections():
 so=bpy.data.objects['Feminine_Flare_Skirt'];solid=next(m for m in so.modifiers if m.type=='SOLIDIFY');solid.show_viewport=False;bpy.context.view_layer.update()
 dg=bpy.context.evaluated_depsgraph_get();a=so.evaluated_get(dg);am=a.to_mesh();b=bpy.data.objects['Body'].evaluated_get(dg);bm=b.to_mesh()
 af=[list(p.vertices) for p in am.polygons];bf=[list(p.vertices) for p in bm.polygons if all(.29<bm.vertices[i].co.z<.97 for i in p.vertices)]
 at=BVHTree.FromPolygons([a.matrix_world@v.co for v in am.vertices],af);bt=BVHTree.FromPolygons([b.matrix_world@v.co for v in bm.vertices],bf);count=len(at.overlap(bt));a.to_mesh_clear();b.to_mesh_clear();solid.show_viewport=True;return count
result={};s.enable_animation=True
for angle in [0,-20,20]:
 arm.pose.bones['J_Bip_L_UpperLeg'].rotation_quaternion=Quaternion((1,0,0),math.radians(angle))
 bpy.context.view_layer.update()
 for i in range(75):h.update_pose_bone_rotations(bpy.context,1/60);bpy.context.view_layer.update()
 result[str(angle)]=intersections()
s.enable_animation=False
for p in arm.pose.bones:p.rotation_quaternion=Quaternion()
bpy.context.view_layer.update()
result['rest_without_simulation']=intersections()
sk=bpy.data.objects['Feminine_Flare_Skirt'];result['unweighted_vertices']=sum(1 for v in sk.data.vertices if abs(sum(g.weight for g in v.groups)-1)>.0001)
