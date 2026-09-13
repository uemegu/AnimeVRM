import bpy,importlib,math,json
from mathutils import Quaternion
from mathutils.bvhtree import BVHTree
ROOT='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v2/'
arm=bpy.data.objects['Armature'];spring=arm.data.vrm_addon_extension.spring_bone1
handler=importlib.import_module('bl_ext.blender_org.vrm.editor.spring_bone1.handler')
saved={p.name:p.rotation_quaternion.copy() for p in arm.pose.bones};enabled=spring.enable_animation
def overlaps():
 o=bpy.data.objects['V2_Draped_Flare_Skirt'];states=[(m,m.show_viewport) for m in o.modifiers if m.type in {'SOLIDIFY','NODES'}]
 for m,_ in states:m.show_viewport=False
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();a=o.evaluated_get(dg);am=a.to_mesh();b=bpy.data.objects['Body'].evaluated_get(dg);bm=b.to_mesh()
 af=[list(p.vertices) for p in am.polygons];bf=[list(p.vertices) for p in bm.polygons if all(.35<bm.vertices[i].co.z<1.025 for i in p.vertices)]
 at=BVHTree.FromPolygons([a.matrix_world@v.co for v in am.vertices],af);bt=BVHTree.FromPolygons([b.matrix_world@v.co for v in bm.vertices],bf);pairs=at.overlap(bt)
 points=[bm.vertices[v].co for _,j in pairs for v in bf[j]]
 result={'triangle_overlaps':len(pairs),'bounds':[[min(v[k] for v in points),max(v[k] for v in points)] for k in range(3)] if points else []}
 a.to_mesh_clear();b.to_mesh_clear()
 for m,v in states:m.show_viewport=v
 return result
result={'poses':{}}
try:
 spring.enable_animation=False
 for p in arm.pose.bones:p.rotation_quaternion=Quaternion()
 bpy.context.view_layer.update();result['poses']['rest_static']=overlaps()
 for label,angles in [('standing',{}),('left_step',{'L_UpperLeg':20}),('right_step',{'R_UpperLeg':-20}),('walking',{'L_UpperLeg':20,'R_UpperLeg':-20,'R_LowerLeg':25})]:
  spring.enable_animation=False
  for p in arm.pose.bones:p.rotation_quaternion=Quaternion()
  for name,degrees in angles.items():arm.pose.bones['J_Bip_'+name].rotation_quaternion=Quaternion((1,0,0),math.radians(degrees))
  spring.enable_animation=True;bpy.context.view_layer.update()
  for i in range(75):handler.update_pose_bone_rotations(bpy.context,1/60);bpy.context.view_layer.update()
  result['poses'][label]=overlaps()
 sk=bpy.data.objects['V2_Draped_Flare_Skirt'];result['unnormalized_skirt_vertices']=sum(abs(sum(g.weight for g in v.groups)-1)>.0001 for v in sk.data.vertices)
 result['missing_deform_bones']=sorted({g.name for g in sk.vertex_groups if g.name not in arm.data.bones})
 result['native_mtoon']=all(m.vrm_addon_extension.mtoon1.enabled for o in bpy.data.collections['Feminine • reference detail revision'].objects if o.type=='MESH' and not o.hide_render for m in o.data.materials if m)
finally:
 spring.enable_animation=False
 for name,q in saved.items():arm.pose.bones[name].rotation_quaternion=q
 spring.enable_animation=enabled;bpy.context.view_layer.update()
with open(ROOT+'motion_validation.json','w') as f:json.dump(result,f,indent=2)
