import bpy, bmesh, math, uuid
from mathutils import Vector
from math import sin, cos, pi

arm=bpy.data.objects['Armature']
body=bpy.data.objects['Body']
col=bpy.data.collections.new('Feminine Outfit');bpy.context.scene.collection.children.link(col)
backup=body.copy();backup.data=body.data.copy();backup.name='Body_Original_Backup';col.objects.link(backup);backup.hide_render=True;backup.hide_set(True)

def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.72;p.inputs['Metallic'].default_value=metal
 return m
ivory=material('Feminine • warm ivory knit',(.87,.79,.69))
rose=material('Feminine • dusty rose skirt',(.48,.285,.33))
trim=material('Feminine • rose ribbon and belt',(.34,.185,.21))
gold=material('Feminine • brushed champagne hardware',(.65,.47,.22),.7)
shoe=material('Feminine • taupe leather',(.30,.235,.20))

def mesh(name,vs,fs,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);col.objects.link(o);o.data.materials.append(mat)
 for p in me.polygons:p.use_smooth=True
 return o
def bind(o,bone=None):
 o.parent=arm
 if bone:o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('Feminine armature','ARMATURE');mod.object=arm
def finish(o,thickness=.002,sub=1):
 if sub:mod=o.modifiers.new('Soft fabric surface','SUBSURF');mod.levels=sub
 mod=o.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=0

# Work on copies of the merged geometry, preserving all source weights and UVs.
blouse=body.copy();blouse.data=body.data.copy();blouse.name='Feminine_Blouse';col.objects.link(blouse)
bm=bmesh.new();bm.from_mesh(blouse.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index!=2],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(blouse.data);bm.free()
blouse.data.materials.clear();blouse.data.materials.append(ivory)
for p in blouse.data.polygons:p.material_index=0
for m in list(blouse.modifiers):
 if m.type!='ARMATURE':blouse.modifiers.remove(m)
# Slightly puff the existing short sleeves.
for v in blouse.data.vertices:
 x,y,z=v.co
 if abs(x)>.14 and z<1.34:
  puff=1+.17*sin(pi*min(1,max(0,(abs(x)-.14)/.16)))
  v.co.y=.022+(y-.022)*puff;v.co.z=1.263+(z-1.263)*puff
finish(blouse,.0015,1)
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index in {2,4,5}],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free()
body.data.materials[3]=shoe;body.data.materials[6]=shoe
for m in list(body.modifiers):
 if m.type=='NODES':body.modifiers.remove(m)

N=96;R=32;CHAINS=12;SEG=4
def point(t,a,pleat=True):
 rx=.108+.205*t**.80;ry=.080+.159*t**.88
 fold=(.002+.013*t)*cos(12*a)+.003*t*cos(24*a) if pleat else 0
 return ((rx+fold)*cos(a),.008+(ry+fold)*sin(a),1.04-.79*t+.003*t*sin(12*a))
vs=[point(j/R,2*pi*i/N) for j in range(R+1) for i in range(N)]
fs=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(R) for i in range(N)]
# Reverse winding so outside normals face outward.
skirt=mesh('Feminine_Flare_Skirt',vs,[tuple(reversed(f)) for f in fs],rose)
for o in bpy.context.selected_objects:o.select_set(False)
arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for i in range(CHAINS):
 parent=arm.data.edit_bones['J_Bip_C_Hips']
 for j in range(SEG+1):
  b=arm.data.edit_bones.new(f'Feminine_Skirt_{i:02d}_{j:02d}');b.head=point(j/SEG,2*pi*i/CHAINS,False);b.tail=point((j+1)/SEG,2*pi*i/CHAINS,False) if j<SEG else Vector(b.head)+Vector((0,0,-.035));b.parent=parent;b.use_connect=j>0;parent=b
bpy.ops.object.mode_set(mode='OBJECT')
groups={(i,j):skirt.vertex_groups.new(name=f'Feminine_Skirt_{i:02d}_{j:02d}') for i in range(CHAINS) for j in range(SEG)}
hips=skirt.vertex_groups.new(name='J_Bip_C_Hips')
for j in range(R+1):
 t=j/R;h=max(0,1-t/.15);along=max(0,min(SEG-1,t*SEG-.45));lo=int(along);f=along-lo
 for i in range(N):
  idx=j*N+i;around=i/N*CHAINS;a=int(around);g=around-a
  if h:hips.add([idx],h,'REPLACE')
  weights={}
  for ci,cw in [(a,1-g),((a+1)%CHAINS,g)]:
   for sj,sw in [(lo,1-f),(min(SEG-1,lo+1),f)]:weights[(ci,sj)]=weights.get((ci,sj),0)+cw*sw*(1-h)
  for key,w in weights.items():
   if w>0:groups[key].add([idx],w,'REPLACE')
bind(skirt);finish(skirt,.003,1)

def band(name,z0,z1,rx,ry,mat):
 vs=[(rx*cos(2*pi*i/96),.008+ry*sin(2*pi*i/96),z) for z in [z0,z1] for i in range(96)]
 o=mesh(name,vs,[(i,(i+1)%96,96+(i+1)%96,96+i) for i in range(96)],mat);bind(o,'J_Bip_C_Hips');finish(o,.003,1);return o
band('Feminine_Waistband',1.013,1.050,.113,.087,rose)
band('Feminine_Thin_Belt',1.024,1.039,.116,.090,trim)

def tube(name,pts,radius,mat,bone):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=radius;cu.bevel_resolution=3
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for p,co in zip(sp.bezier_points,pts):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,cu);col.objects.link(o);cu.materials.append(mat)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bind(o,bone);return o
tube('Feminine_Belt_Buckle',[(-.013,-.086,1.021),(-.013,-.088,1.042),(.013,-.088,1.042),(.013,-.086,1.021),(-.013,-.086,1.021)],.002,gold,'J_Bip_C_Hips')
for side in [-1,1]:
 tube('Feminine_Bow_Loop',[(0,-.089,1.291),(side*.026,-.096,1.302),(side*.040,-.097,1.285),(side*.022,-.099,1.278),(0,-.089,1.291)],.0038,trim,'J_Bip_C_UpperChest')
 tube('Feminine_Bow_Tail',[(side*.003,-.09,1.29),(side*.011,-.108,1.267),(side*.018,-.127,1.224)],.004,trim,'J_Bip_C_UpperChest')

# VRM 1.0 spring chains and leg capsules, stored in the native addon schema.
s=arm.data.vrm_addon_extension.spring_bone1
cg=s.collider_groups.add();cg.vrm_name='Feminine skirt legs';cg.uuid=uuid.uuid4().hex
for side in ['L','R']:
 for part,radius in [('UpperLeg',.071),('LowerLeg',.050)]:
  name=f'J_Bip_{side}_{part}';b=arm.data.bones[name];c=s.colliders.add();c.uuid=uuid.uuid4().hex;c.node.bone_name=name;c.shape_type='Capsule'
  c.shape.capsule.offset=(0,0,0);c.shape.capsule.tail=(0,b.length,0);c.shape.capsule.radius=radius
  ref=cg.colliders.add();ref.collider_uuid=c.uuid
for i in range(CHAINS):
 spring=s.springs.add();spring.vrm_name=f'Feminine long skirt {i+1:02d}';spring.center.bone_name='J_Bip_C_Hips'
 for j in range(SEG+1):
  joint=spring.joints.add();joint.node.bone_name=f'Feminine_Skirt_{i:02d}_{j:02d}';joint.hit_radius=.025;joint.stiffness=1.3 if j<2 else .65;joint.gravity_power=.12;joint.gravity_dir=(0,0,-1);joint.drag_force=.6
 ref=spring.collider_groups.add();ref.collider_group_uuid=cg.uuid
bpy.context.view_layer.update()
result={'outfit_objects':[o.name for o in col.objects],'skirt_vertices':len(skirt.data.vertices),'new_bones':CHAINS*(SEG+1),'spring_chains':CHAINS,'capsules':4}
