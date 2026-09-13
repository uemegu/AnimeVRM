import bpy,json,math,os
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
root='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v3/'
arm=bpy.data.objects['Armature'];spring=arm.data.vrm_addon_extension.spring_bone1;enabled=spring.enable_animation;spring.enable_animation=False
poses={p.name:tuple(x for r in p.matrix_basis for x in r) for p in arm.pose.bones}
vs=[];fs=[]
for o in [bpy.data.objects['V2_Knit_Bodice']]+[o for o in bpy.data.collections['Feminine V3 • collar and fitted waist'].objects if o.name.startswith('V3 Folded collar')]:
 states=[(m,m.show_viewport) for m in o.modifiers]
 for m,_ in states:
  if m.type in {'ARMATURE','SOLIDIFY','NODES'}:m.show_viewport=False
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();offset=len(vs);vs.extend([v.co.copy() for v in me.vertices]);fs.extend([[offset+i for i in p.vertices] for p in me.polygons]);ev.to_mesh_clear()
 for m,v in states:m.show_viewport=v
tree=BVHTree.FromPolygons(vs,fs)
for o in bpy.data.collections['Feminine • reference detail revision'].objects:
 if o.type!='MESH':continue
 if any(n in o.name for n in ['Ribbon_Loop','Ribbon_Tail']):
  for v in o.data.vertices:
   hit,_,_,_=tree.ray_cast(Vector((v.co.x,-.5,v.co.z)),Vector((0,1,0)),.6)
   if hit is not None and hit.y<.02:v.co.y=hit.y-.0032
 elif 'Ribbon_Knot' in o.name:
  co=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices);hit,_,_,_=tree.ray_cast(Vector((co.x,-.5,co.z)),Vector((0,1,0)),.6)
  if hit is not None:
   for v in o.data.vertices:v.co.y+=hit.y-.006-co.y
 if any(n in o.name for n in ['Rectangular_Belt_Buckle','Buckle_Pin']):
  for v in o.data.vertices:v.co.y-=.005

collections=[bpy.data.collections['Feminine • reference detail revision'],bpy.data.collections['Feminine V3 • collar and fitted waist']]
visible=[o for c in collections for o in c.objects if o.type=='MESH' and not o.hide_render and not o.hide_get()]
assert all(m.vrm_addon_extension.mtoon1.enabled for o in visible for m in o.data.materials if m)
assert not any(any(k in o.name for k in ['Satchel','Shoulder_Strap','Strap_Stitch']) for o in visible)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
for name in ['Body','Face','Hair']:bpy.data.objects[name].select_set(True)
for o in visible:o.select_set(True)
bpy.context.view_layer.objects.active=arm
vrm='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/girl_feminine_fitted_v3.vrm'
out=bpy.ops.export_scene.vrm(filepath=vrm,export_only_selections=True,export_invisibles=False,armature_object_name=arm.name,ignore_warning=False,export_lights=False)
bpy.ops.object.select_all(action='DESELECT');spring.enable_animation=enabled
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.region_3d.view_rotation=Quaternion((1,0,0),math.pi/2);a.spaces.active.region_3d.view_location=(0,0,.84);a.spaces.active.region_3d.view_distance=1.9
report={'bone_count':len(arm.data.bones),'pose_max_delta':max(abs(v-poses[p.name][i]) for p in arm.pose.bones for i,v in enumerate(x for r in p.matrix_basis for x in r)),'all_visible_clothing_mtoon':True,'bag_visible':False,'vrm_export':list(out)}
with open(root+'final_validation.json','w') as f:json.dump(report,f,indent=2)
text=bpy.data.texts.new('V3 fitting changes');text.write('Clothing-only revision: smaller folded ivory collar with double dusty-pink piping; subtler knit albedo; fitted bodice and full-contour waistband with inner facing; top of skirt fitted at back. All bag components hidden. Original 195 bones unchanged. No walking-animation fix is claimed in this revision. Original recovered Blender session preserved in feminine_outfit/v3/recovered_before_v3.blend.\n')
bpy.ops.wm.save_as_mainfile(filepath='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/girl_feminine_fitted_v3.blend')
print('V3_FINAL',json.dumps(report))
# Final visual checks, without altering the saved camera or the user's pose.
spring.enable_animation=False;s=bpy.context.scene;c=s.camera
for name,loc,target,scale,res in [('front',(0,-3.8,1.0),(0,0,.83),1.74,(1000,1400)),('collar',(.15,-3,1.5),(0,0,1.22),.54,(1100,1000))]:
 c.location=loc;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale;s.render.resolution_x,s.render.resolution_y=res;s.render.filepath=root+name+'.png';bpy.ops.render.render(write_still=True)
