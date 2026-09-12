import bpy, math, bmesh
from mathutils import Vector
from math import sin,cos,pi
arm=bpy.data.objects['Armature'];col=bpy.data.collections['Feminine Outfit']
rose=bpy.data.materials['Feminine • dusty rose skirt'];gold=bpy.data.materials['Feminine • brushed champagne hardware'];shoe=bpy.data.materials['Feminine • taupe leather'];ivory=bpy.data.materials['Feminine • warm ivory knit']
skirt=bpy.data.objects['Feminine_Flare_Skirt']
for v in skirt.data.vertices:
 t=max(0,min(1,(1.04-v.co.z)/.79));v.co.y-=.024*(1-t);v.co.y=-.016+(v.co.y+.016)*(1+.34*(1-t)**3)
for name in ['Feminine_Waistband','Feminine_Thin_Belt']:
 o=bpy.data.objects[name]
 for v in o.data.vertices:v.co.y=-.016+(v.co.y-.008)*1.35
for v in bpy.data.objects['Feminine_Belt_Buckle'].data.vertices:v.co.y-=.047

def bind(o,bone):
 o.parent=arm;o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE');m=o.modifiers.new('Feminine armature','ARMATURE');m.object=arm
def cube(name,loc,scale,mat,bone,bevel):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 # bake coordinates for ordinary armature skinning
 for v in o.data.vertices:v.co+=o.location
 o.location=(0,0,0)
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o);o.data.materials.append(mat);m=o.modifiers.new('Rounded leather edges','BEVEL');m.width=bevel;m.segments=4
 for p in o.data.polygons:p.use_smooth=True
 m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bind(o,bone);return o
bag=cube('Feminine_Shoulder_Bag',(.213,-.098,.85),(.145,.068,.115),ivory,'J_Bip_C_Hips',.012)
cube('Feminine_Bag_Flap',(.213,-.135,.875),(.14,.012,.070),ivory,'J_Bip_C_Hips',.009)
cube('Feminine_Bag_Clasp',(.213,-.145,.85),(.018,.009,.024),gold,'J_Bip_C_Hips',.003)
def ribbon(name,pts,width,mat,bone):
 verts=[]
 for x,y,z in pts:verts.extend([(x-width/2,y,z),(x+width/2,y,z)])
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(pts)-1)]);me.update();o=bpy.data.objects.new(name,me);col.objects.link(o);me.materials.append(mat);bind(o,bone);s=o.modifiers.new('Leather thickness','SOLIDIFY');s.thickness=.002
 return o
strap=ribbon('Feminine_Shoulder_Strap',[(.155,-.109,.90),(.144,-.110,1.06),(.123,-.080,1.22),(.106,-.017,1.303),(.109,.055,1.30),(.149,.09,1.1),(.252,-.065,.905)],.009,shoe,'J_Bip_C_UpperChest')
# Blend strap bottom toward hips.
strap.vertex_groups.clear();gh=strap.vertex_groups.new(name='J_Bip_C_Hips');gc=strap.vertex_groups.new(name='J_Bip_C_UpperChest')
for v in strap.data.vertices:
 w=min(1,max(0,(v.co.z-.95)/.32));gh.add([v.index],1-w,'REPLACE');gc.add([v.index],w,'REPLACE')
# Replace original sandal faces with rounded low-heel pumps.
body=bpy.data.objects['Body'];bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index in {3,6}],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free()
for side,sign in [('L',1),('R',-1)]:
 bone=f'J_Bip_{side}_Foot';x=sign*.07636
 cube('Feminine_LowHeel_'+side,(x,.052,.019),(.064,.061,.033),shoe,bone,.008)
 # Rings form sole, toe box, and an open ankle neckline.
 rings=[(.045,.118,-.024,.022),(.045,.118,-.024,.043),(.043,.109,-.022,.071),(.032,.052,.016,.086)]
 vs=[];n=48
 for rx,ry,cy,z in rings:
  for i in range(n):
   a=2*pi*i/n;vs.append((x+rx*cos(a),cy+ry*sin(a),z))
 fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(3) for i in range(n)]
 me=bpy.data.meshes.new('Pump');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Feminine_Pump_'+side,me);col.objects.link(o);me.materials.append(shoe)
 for p in me.polygons:p.use_smooth=True
 bind(o,bone);m=o.modifiers.new('Soft leather','SUBSURF');m.levels=2;m=o.modifiers.new('Leather thickness','SOLIDIFY');m.thickness=.002
 cube('Feminine_Shoe_Ornament_'+side,(x,-.054,.079),(.031,.012,.006),gold,bone,.003)
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.update()
result={'finished':True}
