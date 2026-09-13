import bpy,math,json,os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from math import sin,cos,pi,atan2,exp
ROOT='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v3/'
arm=bpy.data.objects['Armature'];scene=bpy.context.scene
bone_before={b.name:(tuple(b.head_local),tuple(b.tail_local),b.parent.name if b.parent else None) for b in arm.data.bones}
pose_before={p.name:list(p.matrix_basis) for p in arm.pose.bones}
spring=arm.data.vrm_addon_extension.spring_bone1;spring_enabled=spring.enable_animation;spring.enable_animation=False
col=bpy.data.collections.new('Feminine V3 • collar and fitted waist');scene.collection.children.link(col)
hidden=[]
for o in scene.objects:
 if o.type=='MESH' and any(s in o.name for s in ['Satchel','Shoulder_Bag','Bag_Flap','Bag_Clasp','Shoulder_Strap','Strap_Stitch']):
  o.hide_set(True);o.hide_render=True;hidden.append(o.name)
for o in scene.objects:
 if o.name.startswith('V2_') and any(s in o.name for s in ['Rounded_Collar','Collar_Edge','Collar_Inner_Stitch']):o.hide_set(True);o.hide_render=True

def rgb(h):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];return tuple(x/12.92 if x<.04045 else ((x+.055)/1.055)**2.4 for x in c)+(1,)
def mtoon(name,color):
 m=bpy.data.materials.new(name);g=m.vrm_addon_extension.mtoon1;g.enabled=True;g.alpha_mode='OPAQUE';g.double_sided=True;g.pbr_metallic_roughness.base_color_factor=color;m.diffuse_color=color
 t=g.extensions.vrmc_materials_mtoon;t.shade_color_factor=tuple(c*.82 for c in color[:3]);t.shading_shift_factor=.08;t.shading_toony_factor=.6;t.gi_equalization_factor=.9;t.outline_width_mode='worldCoordinates';t.outline_width_factor=.00025;t.outline_color_factor=rgb('B19993')[:3];t.outline_lighting_mix_factor=.4;t.enable_outline_preview=True
 return m
ivory=mtoon('V3 Ivory woven collar',rgb('F4EAE3'));pink=mtoon('V3 Dusty pink collar piping',rgb('B997A0'))
waistmat=bpy.data.materials['V2 muted rose woven fabric']
def mesh(name,vs,fs,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);col.objects.link(o);me.materials.append(mat)
 for p in me.polygons:p.use_smooth=True
 return o
def bind(o,bone):
 o.parent=arm;o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE');m=o.modifiers.new('Armature','ARMATURE');m.object=arm
def edge(name,pts,r,mat,bone,closed=False):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=2;sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,co in zip(sp.points,pts):p.co=(*co,1)
 sp.use_cyclic_u=closed;o=bpy.data.objects.new(name,cu);col.objects.link(o);cu.materials.append(mat)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bind(o,bone);return o

# Keep body, skeleton and pose intact. Cinch only the existing bodice cloth.
top=bpy.data.objects['V2_Knit_Bodice'];hips=top.vertex_groups.get('J_Bip_C_Hips') or top.vertex_groups.new(name='J_Bip_C_Hips')
for v in top.data.vertices:
 z=v.co.z;fall=exp(-((z-1.052)/.057)**2)
 if .99<z<1.20:
  v.co.x*=1-.078*fall;v.co.y=-.043+(v.co.y+.043)*(1-.045*fall)
 if z<1.125:
  h=max(0,min(1,(1.125-z)/.070));old=[(g.group,g.weight) for g in v.groups];total=sum(w for _,w in old)
  for idx,w in old:top.vertex_groups[idx].add([v.index],w/max(total,1e-8)*(1-h),'REPLACE')
  hips.add([v.index],h+next((w/max(total,1e-8)*(1-h) for idx,w in old if idx==hips.index),0),'REPLACE')

# A rest-space surface tree measures the actual fitted top rather than a circle.
states=[(m,m.show_viewport) for m in top.modifiers]
for m,_ in states:
 if m.type in {'ARMATURE','NODES','SOLIDIFY'}:m.show_viewport=False
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();ev=top.evaluated_get(dg);me=ev.to_mesh();tree=BVHTree.FromPolygons([v.co.copy() for v in me.vertices],[list(p.vertices) for p in me.polygons]);ev.to_mesh_clear()
for m,v in states:m.show_viewport=v
misses=[]
def fit(a,z,clear=.0018):
 center=Vector((0,-.043,z));u=Vector((cos(a),sin(a),0));hit,n,idx,d=tree.ray_cast(center+u*.4,-u,.5)
 if hit is None or (hit-center).dot(u)<.025:
  # The original shirt has split UV seams. Sample either side instead of
  # accidentally fitting to the opposite wall through a seam opening.
  radii=[]
  for da in [-.035,-.015,.015,.035]:
   v=Vector((cos(a+da),sin(a+da),0));h,_,_,_=tree.ray_cast(center+v*.4,-v,.5)
   if h is not None and (h-center).dot(v)>.025:radii.append((h-center).dot(v))
  if radii:return center+u*(sum(radii)/len(radii)+clear)
  misses.append((a,z));return Vector((.098*cos(a),-.043+.079*sin(a),z))+u*clear
 return hit+u*clear

# Close the back by fitting a continuous fabric band around the top's full contour.
oldband=bpy.data.objects['V2_Fitted_Waistband'];oldband.hide_set(True);oldband.hide_render=True
N=192;zs=[1.021,1.023,1.038,1.055,1.058];vs=[]
for z in zs:
 for i in range(N):vs.append(tuple(fit(2*pi*i/N,z,.0018)))
fs=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(len(zs)-1) for i in range(N)]
band=mesh('V3 Body-fitted waistband',vs,fs,waistmat);bind(band,'J_Bip_C_Hips');m=band.modifiers.new('Thin sewn waistband','SOLIDIFY');m.thickness=.0015;m.offset=0
# Inward-facing turn-under closes even the millimetre-sized gap at the top edge.
vs=[tuple(fit(2*pi*i/N,z,c)) for z,c in [(1.058,.002),(1.054,-.003)] for i in range(N)]
facing=mesh('V3 Waistband inner facing',vs,[(i,(i+1)%N,N+(i+1)%N,N+i) for i in range(N)],waistmat);bind(facing,'J_Bip_C_Hips')

# Match belt and all its attachments to that same contour, retaining their detail.
for o in bpy.data.collections['Feminine • reference detail revision'].objects:
 if o.type!='MESH' or not any(s in o.name for s in ['Slim_Leather_Belt','Belt_Edge','Belt_Loop','Rectangular_Belt_Buckle','Buckle_Pin','Belt_Tucked_End','Belt_Hole']):continue
 for v in o.data.vertices:
  a=atan2(v.co.y+.020,v.co.x);oldr=math.hypot(v.co.x,v.co.y+.020);p=fit(a,v.co.z,.0035);v.co=p+Vector((cos(a),sin(a),0))*(oldr-.114)

# Blend the skirt's top into the fitted band; leave the lower skirt unchanged.
for o in bpy.data.collections['Feminine • reference detail revision'].objects:
 if o.type!='MESH' or not any(s in o.name for s in ['Draped_Flare_Skirt','Skirt_Panel_Seam']):continue
 for v in o.data.vertices:
  t=max(0,min(1,(1.049-v.co.z)/.725))
  if t>=.26:continue
  a=atan2((v.co.y-(-.020+.025*t))/(.109+.108*t**.91+.05*t**1.22),v.co.x/(.108+.157*t**.88+.064*t**1.22))
  p=fit(a,1.041,.002);old=Vector((.108*cos(a),-.020+.109*sin(a),1.041));v.co+=(p-old)*(1-t/.26)**2

# Small, folded collar leaves with a pointed front and two pink edge lines.
inner=[(.003,-.061,1.297),(.016,-.044,1.308),(.031,-.017,1.319),(.038,.010,1.323),(.035,.038,1.323),(.023,.054,1.323),(.009,.060,1.322)]
outer=[(.008,-.092,1.279),(.030,-.111,1.261),(.059,-.076,1.282),(.068,-.025,1.301),(.064,.032,1.309),(.043,.067,1.315),(.009,.073,1.316)]
def interp(keys,t):
 q=t*(len(keys)-1);i=min(len(keys)-2,int(q));return Vector(keys[i]).lerp(Vector(keys[i+1]),q-i)
def surface(p):
 if p.y<.015:
  hit,_,_,_=tree.ray_cast(Vector((p.x,-.5,p.z)),Vector((0,1,0)),.65)
  if hit is not None and hit.y<.018:p.y=min(p.y,hit.y-.002)
 return p
for sign,side in [(1,'L'),(-1,'R')]:
 ns=60;nr=8;vs=[];out=[];inset=[]
 for i in range(ns+1):
  a=interp(inner,i/ns);b=a.lerp(interp(outer,i/ns),.78);a.x*=sign;b.x*=sign
  for j in range(nr+1):
   p=a.lerp(b,j/nr);p.z+=.0015*sin(pi*j/nr);vs.append(tuple(surface(p)))
  out.append(tuple(surface(b.copy())+Vector((0,-.0007,.0003))));inset.append(tuple(surface(a.lerp(b,.89))+Vector((0,-.0009,.0004))))
 fs=[(i*(nr+1)+j,(i+1)*(nr+1)+j,(i+1)*(nr+1)+j+1,i*(nr+1)+j+1) for i in range(ns) for j in range(nr)]
 if sign<0:fs=[tuple(reversed(f)) for f in fs]
 o=mesh('V3 Folded collar '+side,vs,fs,ivory);bind(o,'J_Bip_C_UpperChest');m=o.modifiers.new('Collar thickness','SOLIDIFY');m.thickness=.0012;m.offset=0
 edge('V3 Pink collar edge '+side,out,.00065,pink,'J_Bip_C_UpperChest');edge('V3 Pink collar second line '+side,inset,.0004,pink,'J_Bip_C_UpperChest')

for o in bpy.data.collections['Feminine • reference detail revision'].objects:
 if o.type=='MESH' and any(n in o.name for n in ['Ribbon_Loop','Ribbon_Tail','Ribbon_Knot']):
  for v in o.data.vertices:v.co.y-=.012

# Bake restrained cloth contrast into native MToon albedo textures.
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False
tex_results=[]
for name,tone,amount in [('V2_Knit_Bodice','F0E5DC',.20),('V2_Puffed_Sleeve_L','F0E5DC',.20),('V2_Puffed_Sleeve_R','F0E5DC',.20),('V2_Draped_Flare_Skirt','CAA9AE',.80)]:
 o=bpy.data.objects[name];orig=o.data.materials[0];src=orig.vrm_addon_extension.mtoon1.pbr_metallic_roughness.base_color_texture.index.source
 temp=bpy.data.materials.new('V3 temporary albedo bake');temp.use_nodes=True;nt=temp.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');tex=nt.nodes.new('ShaderNodeTexImage');tex.image=src;mix=nt.nodes.new('ShaderNodeMixRGB');mix.inputs[0].default_value=amount;mix.inputs[1].default_value=rgb(tone);nt.links.new(tex.outputs['Color'],mix.inputs[2]);nt.links.new(mix.outputs[0],em.inputs[0]);nt.links.new(em.outputs[0],out.inputs[0])
 img=bpy.data.images.new(name+'_V3_Albedo',width=2048 if 'Skirt' in name or 'Bodice' in name else 1024,height=2048 if 'Skirt' in name or 'Bodice' in name else 1024,alpha=False);target=nt.nodes.new('ShaderNodeTexImage');target.image=img;nt.nodes.active=target;o.data.materials[0]=temp
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;states=[(m,m.show_render,m.show_viewport) for m in o.modifiers]
 for m,_,_ in states:m.show_render=False;m.show_viewport=False
 bpy.ops.object.bake(type='EMIT',margin=12,use_clear=True)
 for m,r,v in states:m.show_render=r;m.show_viewport=v
 img.filepath_raw=ROOT+img.name+'.png';img.file_format='PNG';img.save();img.pack();new=orig.copy();new.name='MToon V3 '+name;o.data.materials[0]=new;ext=new.vrm_addon_extension.mtoon1;ext.pbr_metallic_roughness.base_color_texture.index.source=img;ext.extensions.vrmc_materials_mtoon.shade_multiply_texture.index.source=img;tex_results.append(img.filepath_raw)
scene.render.engine='BLENDER_EEVEE'
for name in ['V2 ivory collar and cuff','V2 warm fine seam']:
 m=bpy.data.materials.get(name)
 if m:m.vrm_addon_extension.mtoon1.pbr_metallic_roughness.base_color_factor=rgb('F0E5DC' if 'cuff' in name else 'CAB6AD')

bone_after={b.name:(tuple(b.head_local),tuple(b.tail_local),b.parent.name if b.parent else None) for b in arm.data.bones}
assert bone_before==bone_after,'Skeleton unexpectedly changed'
report={'bones_unchanged':True,'bone_count':len(bone_after),'bag_objects_hidden':hidden,'fitting_ray_misses':len(misses),'textures':tex_results,'waist_top_clearance_m':.0018,'waist_facing_overlap_m':.003}
with open(ROOT+'validation.json','w') as f:json.dump(report,f,indent=2)
spring.enable_animation=spring_enabled
bpy.ops.object.select_all(action='DESELECT');bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/girl_feminine_fitted_v3.blend')
print('V3_REPORT',json.dumps(report))
