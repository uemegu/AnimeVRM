import bpy,bmesh,math,os
from mathutils import Vector,Quaternion
from math import sin,cos,pi,atan2,exp,radians
ROOT='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v2/'
arm=bpy.data.objects['Armature'];col=bpy.data.collections['Feminine • reference detail revision']
# Restore the fitted shoulder topology, then reshape the sleeve toward its cuff.
src=bpy.data.objects['Feminine_Blouse']
for side,sign in [('L',1),('R',-1)]:
 old=bpy.data.objects['V2_Puffed_Sleeve_'+side];old.name='V2_Archived_Cylindrical_Sleeve_'+side;old.hide_render=True;old.hide_set(True)
 o=src.copy();o.data=src.data.copy();o.name='V2_Puffed_Sleeve_'+side;col.objects.link(o);o.hide_set(False);o.hide_render=False
 bm=bmesh.new();bm.from_mesh(o.data);remaining=set(bm.verts);keep=set()
 while remaining:
  stack=[remaining.pop()];comp=[]
  while stack:
   v=stack.pop();comp.append(v)
   for e in v.link_edges:
    n=e.other_vert(v)
    if n in remaining:remaining.remove(n);stack.append(n)
  if 150<len(comp)<300 and sum(v.co.x for v in comp)*sign>0:keep.update(comp)
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in keep],context='VERTS');bm.to_mesh(o.data);bm.free()
 for v in o.data.vertices:
  x=abs(v.co.x)
  if x>.14:
   t=min(1,(x-.14)/.161);v.co.x=sign*(.14+(x-.14)*.889)
   # Rounded fabric fullness, tapered toward the folded cuff.
   f=1+.08*sin(pi*t)-.05*t
   v.co.y=.021+(v.co.y-.021)*f;v.co.z=1.263+(v.co.z-1.263)*f
 o.data.materials.clear();o.data.materials.append(bpy.data.materials['V2 ivory fine gauge knit'])
 for p in o.data.polygons:p.material_index=0
 for m in list(o.modifiers):
  if m.type!='ARMATURE':o.modifiers.remove(m)
 m=o.modifiers.new('Soft knit surface','SUBSURF');m.levels=2;m.render_levels=2;m=o.modifiers.new('Knit thickness','SOLIDIFY');m.thickness=.0015;m.offset=0

# Widen the lower flare to the reference waist-to-hem ratio.
def expand(p):
 t=max(0,min(1,(1.049-p.z)/.725));a=atan2((p.y-(-.020+.025*t))/(.109+.108*t**.91),p.x/(.108+.157*t**.88));delta=.064*t**1.22
 return Vector((delta*cos(a),delta*.78*sin(a),0))
for o in col.objects:
 if o.type=='MESH' and any(s in o.name for s in ['Draped_Flare_Skirt','Stitched_Hem','Skirt_Panel_Seam']):
  for v in o.data.vertices:v.co+=expand(v.co)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for b in arm.data.edit_bones:
 if b.name.startswith('Feminine_Skirt_'):b.use_connect=False;b.head+=expand(b.head);b.tail+=expand(b.tail)
for b in arm.data.edit_bones:
 if b.name.startswith('Feminine_Skirt_') and not b.name.endswith('_00'):b.use_connect=True
bpy.ops.object.mode_set(mode='OBJECT')
sk=bpy.data.objects['V2_Draped_Flare_Skirt'];attr=sk.data.color_attributes['Painted fold shading']
for v in sk.data.vertices:
 j=v.index//193;i=v.index%193;t=j/64;a=2*pi*i/192;phase=12*a+.34*sin(2*a)+.34*t*sin(3*a+.4)
 # Unequal broad planes and narrow shaded creases, avoiding a satin-like sine sheen.
 f=(phase/(2*pi))%1
 if f<.17:val=.81+f/.17*.12
 elif f<.54:val=.93+(f-.17)/.37*.14
 elif f<.86:val=1.07-(f-.54)/.32*.08
 else:val=.99-(f-.86)/.14*.18
 val+=.035*sin(5*a+.6)*sin(pi*t)+.018*sin(phase*2+.8)*t
 val=1+(val-1)*(.65+.35*t**.4)
 attr.data[v.index].color=(val,val*.997,val*.992,1)
# All non-skirt uses of the same fabric get a neutral paint attribute.
for o in col.objects:
 if o.type=='MESH' and o!=sk and any(m and m.name=='V2 muted rose woven fabric' for m in o.data.materials):
  at=o.data.color_attributes.get('Painted fold shading') or o.data.color_attributes.new(name='Painted fold shading',type='FLOAT_COLOR',domain='POINT')
  for d in at.data:d.color=(1,1,1,1)

# Let the backs of the hands face forward, with naturally relaxed fingers.
for sign,side in [(1,'L'),(-1,'R')]:
 p=arm.pose.bones['J_Bip_'+side+'_Hand'];q=p.matrix.to_quaternion()@p.bone.matrix_local.to_quaternion().inverted();normal=q@Vector((0,0,1));axis=(p.tail-p.head).normalized();target=Vector((0,-1,0));normal=(normal-axis*normal.dot(axis)).normalized();target=(target-axis*target.dot(axis)).normalized();angle=atan2(axis.dot(normal.cross(target)),normal.dot(target));p.rotation_quaternion=p.rotation_quaternion@Quaternion((0,1,0),angle)
 for finger in ['Index','Middle','Ring','Little']:
  for j,angle in [(1,8),(2,12),(3,7)]:
   p=arm.pose.bones.get(f'J_Bip_{side}_{finger}{j}')
   if p:p.rotation_quaternion=Quaternion(p.bone.matrix_local.to_quaternion().inverted()@Vector((0,1,0)),radians(sign*angle))

# The source toes must be covered by a closed outsole.
for side in ['L','R']:
 o=bpy.data.objects['V2_Loafer_Outsole_'+side]
 for v in o.data.vertices:
  if v.co.z<.02:v.co.z=.0035
 # Lower heel bottom to match the outsole bottom.
 o=bpy.data.objects['V2_Low_Heel_'+side]
 for v in o.data.vertices:
  if v.co.z<.01:v.co.z=.002

# Let the bag hang at a slight angle, as in the illustration.
bc=Vector((.216,-.047,.855));rot=Quaternion((0,1,0),radians(-9));move=Vector((.002,-.025,.032))
for o in col.objects:
 if o.type!='MESH':continue
 if 'Satchel' in o.name:
  for v in o.data.vertices:v.co=bc+rot@(v.co-bc)+move
 elif any(n in o.name for n in ['Leather_Shoulder_Strap','Strap_Stitch']):
  for v in o.data.vertices:
   f=max(0,min(1,(1.19-v.co.z)/.27));v.co=v.co.lerp(bc+rot@(v.co-bc)+move,f)

bpy.context.view_layer.update()
result={'fitted':True}
