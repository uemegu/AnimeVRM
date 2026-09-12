import bpy, bmesh, math
from math import sin, cos, pi, exp, atan2
from mathutils import Vector, Quaternion

ROOT='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v2/'
arm=bpy.data.objects['Armature']
arm.data.vrm_addon_extension.spring_bone1.enable_animation=False
for p in arm.pose.bones:
 p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion()
for o in bpy.data.collections['Feminine Outfit'].objects:
 o.hide_set(True);o.hide_render=True
col=bpy.data.collections.new('Feminine • reference detail revision');bpy.context.scene.collection.children.link(col)
atlas=bpy.data.images.load(ROOT+'fabric_atlas.png',check_existing=True)

def lin(v):return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def rgba(h):return tuple(lin(int(h[i:i+2],16)/255) for i in (0,2,4))+(1,)
def mat(name,h,cloth=None):
 m=bpy.data.materials.new('V2 '+name);m.diffuse_color=rgba(h);m.use_nodes=True
 nt=m.node_tree;nt.nodes.clear();n=nt.nodes;l=nt.links
 out=n.new('ShaderNodeOutputMaterial');out.location=(800,0)
 em=n.new('ShaderNodeEmission');em.location=(600,0);l.new(em.outputs[0],out.inputs['Surface'])
 diffuse=n.new('ShaderNodeBsdfDiffuse');diffuse.inputs['Color'].default_value=(.8,.8,.8,1);diffuse.inputs['Roughness'].default_value=.8;diffuse.location=(-400,-300)
 rgb=n.new('ShaderNodeShaderToRGB');rgb.location=(-220,-300);l.new(diffuse.outputs[0],rgb.inputs[0])
 ramp=n.new('ShaderNodeValToRGB');ramp.location=(-20,-260);l.new(rgb.outputs[0],ramp.inputs[0]);ramp.color_ramp.interpolation='EASE';ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[0].color=(.64,.59,.59,1);ramp.color_ramp.elements[1].position=.67;ramp.color_ramp.elements[1].color=(1.0,1.0,1.0,1)
 mul=n.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=rgba(h);mul.location=(380,0);l.new(ramp.outputs['Color'],mul.inputs[2]);l.new(mul.outputs[0],em.inputs[0])
 if cloth is not None:
  uv=n.new('ShaderNodeTexCoord');uv.location=(-1000,150)
  scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(3,3,1);scale.location=(-830,150);l.new(uv.outputs['UV'],scale.inputs[0])
  fract=n.new('ShaderNodeVectorMath');fract.operation='FRACTION';fract.location=(-660,150);l.new(scale.outputs['Vector'],fract.inputs[0])
  remap=n.new('ShaderNodeVectorMath');remap.operation='MULTIPLY_ADD';remap.inputs[1].default_value=(.46,.96,1);remap.inputs[2].default_value=(.02 if cloth=='knit' else .52,.02,0);remap.location=(-490,150);l.new(fract.outputs['Vector'],remap.inputs[0])
  tex=n.new('ShaderNodeTexImage');tex.image=atlas;tex.interpolation='Linear';tex.location=(-300,150);l.new(remap.outputs['Vector'],tex.inputs['Vector'])
  mix=n.new('ShaderNodeMixRGB');mix.inputs[0].default_value=.20 if cloth=='knit' else .16;mix.inputs[1].default_value=rgba(h);mix.location=(70,80);l.new(tex.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],mul.inputs[1])
 return m
ivory=mat('ivory fine gauge knit','E8DDD0','knit')
collarMat=mat('ivory collar and cuff','F2E8DE','knit')
stitch=mat('warm fine seam','C0A99B')
rose=mat('muted rose woven fabric','BE9FA7','woven')
roseDark=mat('soft skirt seam','A4838B')
roseLight=mat('hem edge highlight','D3B8BC')
ribbonMat=mat('dusty rose grosgrain','B78C98','woven')
ribbonEdge=mat('ribbon edge','D9BAC2')
beltMat=mat('taupe rose belt','9E7D83')
leather=mat('greige leather','A99A8B')
leatherDark=mat('leather piping','857568')
bagMat=mat('warm ivory bag leather','E9DDC6')
bagSeam=mat('bag stitching','BAA58A')
gold=mat('antique gold','C5A26B')
goldLight=mat('gold highlight','E8C892')
soleMat=mat('taupe rubber sole','71665D')

def mesh(name,vs,fs,material,uvs=None):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('V2_'+name,me);col.objects.link(o);me.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 uv=me.uv_layers.new(name='Garment UV')
 for p in me.polygons:
  for li in p.loop_indices:
   idx=me.loops[li].vertex_index;co=me.vertices[idx].co;uv.data[li].uv=uvs[idx] if uvs else (co.x*3+.5,co.z*3)
 return o
def weights(o,fn):
 groups={}
 for v in o.data.vertices:
  w=fn(v)
  for name,value in w.items():
   if value<1e-6:continue
   if name not in groups:groups[name]=o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
   groups[name].add([v.index],value,'REPLACE')
def torso_weights(v):
 z=v.co.z
 levels=[(1.0,'J_Bip_C_Spine'),(1.105,'J_Bip_C_Chest'),(1.205,'J_Bip_C_UpperChest')]
 if z<=levels[0][0]:return {levels[0][1]:1}
 for (a,n),(b,m) in zip(levels,levels[1:]):
  if z<=b:
   t=(z-a)/(b-a);return {n:1-t,m:t}
 return {'J_Bip_C_UpperChest':1}
def bind(o,bone=None,fn=None):
 o.parent=arm
 if bone:weights(o,lambda v:{bone:1})
 if fn:weights(o,fn)
 m=o.modifiers.new('Clothing skinning','ARMATURE');m.object=arm
def finish(o,sub=1,thick=.0015):
 if sub:m=o.modifiers.new('Soft garment surface','SUBSURF');m.levels=sub;m.render_levels=sub
 if thick:m=o.modifiers.new('Sewn material thickness','SOLIDIFY');m.thickness=thick;m.offset=0
def curve(name,pts,r,material,bone=None,fn=None,closed=False,smooth=True):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12;cu.bevel_depth=r;cu.bevel_resolution=2
 sp=cu.splines.new('BEZIER' if smooth else 'POLY')
 if smooth:
  sp.bezier_points.add(len(pts)-1)
  for p,co in zip(sp.bezier_points,pts):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 else:
  sp.points.add(len(pts)-1)
  for p,co in zip(sp.points,pts):p.co=(*co,1)
 sp.use_cyclic_u=closed;o=bpy.data.objects.new('V2_'+name,cu);col.objects.link(o);cu.materials.append(material)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object;bind(o,bone,fn);return o
def rounded(name,loc,size,material,bone,bevel=.005):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name='V2_'+name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for v in o.data.vertices:v.co+=o.location
 o.location=(0,0,0)
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o);o.data.materials.append(material);m=o.modifiers.new('Rounded construction','BEVEL');m.width=bevel;m.segments=4
 for p in o.data.polygons:p.use_smooth=True
 m=o.modifiers.new('Panel normals','WEIGHTED_NORMAL');bind(o,bone);return o

# The source torso supplies fitting and deformation, but its shirt sleeves are replaced.
src=bpy.data.objects['Feminine_Blouse'];top=src.copy();top.data=src.data.copy();top.name='V2_Knit_Bodice';col.objects.link(top);top.hide_set(False);top.hide_render=False
bm=bmesh.new();bm.from_mesh(top.data)
remaining=set(bm.verts);remove=[]
while remaining:
 stack=[remaining.pop()];component=[]
 while stack:
  v=stack.pop();component.append(v)
  for e in v.link_edges:
   n=e.other_vert(v)
   if n in remaining:remaining.remove(n);stack.append(n)
 if len(component)<500:remove.extend(component)
bmesh.ops.delete(bm,geom=remove,context='VERTS')
# Remove disconnected back-of-neck artifact from source clothing.
bmesh.ops.delete(bm,geom=[f for f in bm.faces if all(v.co.z>1.34 for v in f.verts)],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(top.data);bm.free();top.data.materials.clear();top.data.materials.append(ivory)
for p in top.data.polygons:p.material_index=0
for v in top.data.vertices:
 x,y,z=v.co
 # Small knit blousing above the tucked waist and fine gathered folds.
 if z<1.18:
  k=exp(-((z-1.080)/.058)**2);v.co.x*=1+.04*k
  if y<-.03:v.co.y-=.003*k*(1+.55*cos(x*150+z*20))
for m in list(top.modifiers):
 if m.type!='ARMATURE':top.modifiers.remove(m)
finish(top,2,.0015)

# Soft, elbow-length puff sleeves with separately modelled folded cuffs.
for sign,side in [(1,'L'),(-1,'R')]:
 n=64;rows=22;vs=[];uv=[]
 for j in range(rows+1):
  t=j/rows;x=.105+.178*t
  ry=.041+.020*sin(pi*t)**.8-.006*t;rz=.047+.018*sin(pi*t)**.8-.011*t
  cz=1.267-.004*t;cy=.021
  for i in range(n+1):
   a=2*pi*i/n;gather=(.001+.0016*t)*sin(10*a+.7*t)*sin(pi*t)
   vs.append((sign*x,cy+(ry+gather)*cos(a),cz+(rz+gather)*sin(a)));uv.append((i/n,t))
 fs=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(rows) for i in range(n)]
 if sign<0:fs=[tuple(reversed(f)) for f in fs]
 o=mesh('Puffed_Sleeve_'+side,vs,fs,ivory,uv)
 def sleeve_weights(v,side=side):
  t=max(0,min(1,(abs(v.co.x)-.105)/.063));return {'J_Bip_C_UpperChest':1-t,'J_Bip_'+side+'_UpperArm':t}
 bind(o,fn=sleeve_weights);finish(o,1,.0016)
 vs=[];uv=[]
 for j in range(5):
  x=.268+j*.005;bulge=.001*sin(pi*j/4)
  for i in range(n+1):
   a=2*pi*i/n;vs.append((sign*x,.021+(.039+bulge)*cos(a),1.263+(.041+bulge)*sin(a)));uv.append((i/n,j/4))
 fs=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(4) for i in range(n)]
 if sign<0:fs=[tuple(reversed(f)) for f in fs]
 cuff=mesh('Turned_Cuff_'+side,vs,fs,collarMat,uv);bind(cuff,'J_Bip_'+side+'_UpperArm');finish(cuff,1,.002)
 for x in [.271,.285]:curve('Cuff_Stitch_'+side,[(sign*x,.021+.040*cos(2*pi*i/64),1.263+.042*sin(2*pi*i/64)) for i in range(64)],.00045,stitch,'J_Bip_'+side+'_UpperArm',closed=True)

# Two real, rounded Peter Pan collar leaves, each with edge piping and stitching.
for sign,side in [(1,'L'),(-1,'R')]:
 vs=[];uv=[];segments=48;across=8;outer=[]
 for i in range(segments+1):
  t=i/segments;a=-pi/2+pi*t
  inner=Vector((sign*(.003+.036*cos(a)),.015+.042*sin(a),1.315+.004*sin(a)))
  front=max(0,-sin(a));lobe=sin(pi*t)**.55
  out=Vector((sign*(.006+.069*cos(a)),.015+(.052+.043*front*lobe)*sin(a),1.310-.048*front*lobe-.026*front*(1-lobe)))
  outer.append(out)
  for j in range(across+1):
   f=j/across;p=inner.lerp(out,f);p.z+=.002*sin(pi*f);vs.append(tuple(p));uv.append((t,f))
 fs=[(i*(across+1)+j,(i+1)*(across+1)+j,(i+1)*(across+1)+j+1,i*(across+1)+j+1) for i in range(segments) for j in range(across)]
 if sign<0:fs=[tuple(reversed(f)) for f in fs]
 o=mesh('Rounded_Collar_'+side,vs,fs,collarMat,uv);bind(o,'J_Bip_C_UpperChest');finish(o,1,.0018)
 curve('Collar_Edge_'+side,[tuple(p+Vector((0,-.0005,.0005))) for p in outer],.0007,stitch,'J_Bip_C_UpperChest')
 curve('Collar_Inner_Stitch_'+side,[tuple(Vector(vs[i*(across+1)+across-1])+Vector((0,-.0007,.0005))) for i in range(segments+1)],.00035,stitch,'J_Bip_C_UpperChest')

# Narrow flat grosgrain ribbon, with folded loops rather than round tubes.
def strip(name,pts,widths,material,bone,edge=False):
 vs=[];uv=[];points=[Vector(p) for p in pts]
 for i,p in enumerate(points):
  tang=points[min(i+1,len(points)-1)]-points[max(0,i-1)];side=Vector((-tang.z,0,tang.x)).normalized();w=widths[i] if isinstance(widths,list) else widths
  for k in [-1,0,1]:
   co=p+side*w*.5*k;co.y-=.0007*(1-abs(k));vs.append(tuple(co));uv.append(((k+1)*.5,i/(len(points)-1)))
 fs=[(3*i+k,3*i+k+1,3*(i+1)+k+1,3*(i+1)+k) for i in range(len(points)-1) for k in range(2)]
 o=mesh(name,vs,fs,material,uv);bind(o,bone);finish(o,1,.0008)
 if edge:
  for k in [0,2]:curve(name+'_Edge',[vs[3*i+k] for i in range(len(points))],.0003,ribbonEdge,bone)
 return o
for sign,side in [(1,'L'),(-1,'R')]:
 pts=[]
 for i in range(41):
  t=i/40;a=2*pi*t
  pts.append((sign*(.004+.030*sin(pi*t)), -.085-.006*sin(pi*t),1.282+.014*sin(a)-.005*sin(pi*t)))
 strip('Ribbon_Loop_'+side,pts,[.0035+.002*sin(pi*i/40) for i in range(41)],ribbonMat,'J_Bip_C_UpperChest',True)
 pts=[(sign*(.003+.013*t+.003*sin(pi*t)),-.084-.042*t,1.283-(.086 if sign>0 else .077)*t) for t in [i/24 for i in range(25)]]
 strip('Ribbon_Tail_'+side,pts,.0065,ribbonMat,'J_Bip_C_UpperChest',True)
rounded('Ribbon_Knot',(0,-.088,1.281),(.010,.008,.011),ribbonMat,'J_Bip_C_UpperChest',.003)
# A subtle knit center placket and small covered buttons.
curve('Bodice_Center_Seam',[(0,-.120,1.205),(0,-.135,1.15),(0,-.129,1.095),(0,-.116,1.06)],.0004,stitch,fn=torso_weights)
for z,y in [(1.19,-.128),(1.145,-.136),(1.10,-.131)]:
 rounded('Covered_Button',(0,y,z),(.0038,.002,.0038),collarMat,'J_Bip_C_Chest',.0014)

# Asymmetric broad folds: gentle fitted hips, then hanging, flared gores.
N=192;R=64;CHAINS=12;SEG=4
def skirtpoint(t,a,fold=True):
 rx=.108+.157*(t**.88);ry=.109+.108*(t**.91);cy=-.020+.025*t
 phase=12*a+.34*sin(2*a)+.34*t*sin(3*a+.4)
 wave=.70*cos(phase)+.23*cos(2*phase+.7)+.10*sin(7*a+1.6)
 amp=(.0025+.023*t**.83)*(1+.18*sin(3*a+.3)) if fold else 0
 # Each gore changes direction slightly, avoiding a rigid cone silhouette.
 shift=.007*sin(2*a+1.1)*sin(pi*t)
 x=(rx+amp*wave)*cos(a)+shift
 y=cy+(ry+amp*wave)*sin(a)
 z=1.049-.725*t+t**4*(.007*sin(3*a+.7)+.009*sin(5*a-.4))
 return (x,y,z)
vs=[skirtpoint(j/R,2*pi*i/N) for j in range(R+1) for i in range(N+1)];uv=[(i/N,1-j/R) for j in range(R+1) for i in range(N+1)]
fs=[(j*(N+1)+i,(j+1)*(N+1)+i,(j+1)*(N+1)+i+1,j*(N+1)+i+1) for j in range(R) for i in range(N)]
skirt=mesh('Draped_Flare_Skirt',vs,fs,rose,uv)
def skirtweights(v):
 t=max(0,min(1,(1.049-v.co.z)/.725));a=atan2((v.co.y-(-.020+.025*t))/(.109+.108*t**.91),v.co.x/(.108+.157*t**.88))%(2*pi)
 around=a/(2*pi)*CHAINS;ci=int(around)%CHAINS;cf=around-int(around);along=max(0,min(SEG-1,t*SEG-.4));j=int(along);jf=along-j;hip=max(0,1-t/.12);w={'J_Bip_C_Hips':hip}
 for i,iw in [(ci,1-cf),((ci+1)%CHAINS,cf)]:
  for k,kw in [(j,1-jf),(min(SEG-1,j+1),jf)]:
   name=f'Feminine_Skirt_{i:02d}_{k:02d}';w[name]=w.get(name,0)+(1-hip)*iw*kw
 return w
bind(skirt,fn=skirtweights);finish(skirt,1,.002)
for t,matr,rad in [(.988,roseDark,.0006),(.998,roseLight,.00055)]:
 curve('Stitched_Hem',[(lambda p:(p[0]*1.002,p[1]*1.002,p[2]))(skirtpoint(t,2*pi*i/192)) for i in range(192)],rad,matr,fn=skirtweights,closed=True)
# Six delicate panel seams, fine enough to read as sewn rather than drawn stripes.
for a in [pi/6,pi/2,5*pi/6,7*pi/6,3*pi/2,11*pi/6]:
 pts=[]
 for j in range(49):
  t=.028+.947*j/48;p=Vector(skirtpoint(t,a));p+=Vector((cos(a),sin(a),0))*.001;pts.append(tuple(p))
 curve('Skirt_Panel_Seam',pts,.00037,roseDark,fn=skirtweights)

# Refit all spring bones to the revised silhouette without changing their identities.
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for i in range(CHAINS):
 for j in range(SEG+1):
  b=arm.data.edit_bones[f'Feminine_Skirt_{i:02d}_{j:02d}'];b.use_connect=False;b.head=skirtpoint(j/SEG,2*pi*i/CHAINS,False);b.tail=skirtpoint((j+1)/SEG,2*pi*i/CHAINS,False) if j<SEG else Vector(b.head)+Vector((0,0,-.025))
for i in range(CHAINS):
 for j in range(1,SEG+1):arm.data.edit_bones[f'Feminine_Skirt_{i:02d}_{j:02d}'].use_connect=True
bpy.ops.object.mode_set(mode='OBJECT')

def waistband(name,z0,z1,rx,ry,matr):
 n=128;vs=[(rx*cos(2*pi*i/n),-.020+ry*sin(2*pi*i/n),z) for z in [z0,z1] for i in range(n+1)];uv=[(i/n,j) for j in range(2) for i in range(n+1)]
 fs=[(i,(i+1),n+1+i+1,n+1+i) for i in range(n)];o=mesh(name,vs,fs,matr,uv);bind(o,'J_Bip_C_Hips');finish(o,1,.002);return o
waistband('Fitted_Waistband',1.026,1.056,.111,.111,rose)
waistband('Slim_Leather_Belt',1.033,1.046,.114,.114,beltMat)
for z in [1.034,1.045]:curve('Belt_Edge',[(.1146*cos(2*pi*i/128),-.020+.1146*sin(2*pi*i/128),z) for i in range(128)],.0004,roseLight,'J_Bip_C_Hips',closed=True)
for a in [-pi/2-.43,-pi/2+.43,.2,pi-.2]:
 x=.116*cos(a);y=-.020+.116*sin(a);curve('Belt_Loop',[(x,y,1.024),(x*1.007,y*1.007,1.038),(x,y,1.054)],.0017,roseDark,'J_Bip_C_Hips')
# Rounded rectangle buckle, pin, belt end and punched holes.
pts=[(-.012,-.136,1.031),(-.015,-.137,1.034),(-.015,-.137,1.047),(-.012,-.136,1.050),(.009,-.136,1.050),(.012,-.137,1.047),(.012,-.137,1.034),(.009,-.136,1.031)]
curve('Rectangular_Belt_Buckle',pts,.00125,gold,'J_Bip_C_Hips',closed=True,smooth=False)
curve('Buckle_Pin',[(-.014,-.139,1.040),(.008,-.139,1.040)],.0007,goldLight,'J_Bip_C_Hips',smooth=False)
rounded('Belt_Tucked_End',(.024,-.133,1.040),(.035,.002,.011),beltMat,'J_Bip_C_Hips',.002)
for x in [.026,.032,.038]:rounded('Belt_Hole',(x,-.135,1.040),(.0009,.0007,.0011),leatherDark,'J_Bip_C_Hips',.0003)

# Compact satchel: shaped flap, gusset, leather piping, hardware and stitched strap.
bc=Vector((.216,-.047,.855));bw=.137;bh=.113;bd=.051
rounded('Satchel_Body',bc,(bw,bd,bh),bagMat,'J_Bip_C_Hips',.012)
rounded('Satchel_Back_Panel',bc+Vector((0,.022,.003)),(.129,.012,.108),bagMat,'J_Bip_C_Hips',.011)
flap=[(-.063,.053),(.063,.053),(.066,.043),(.064,-.009),(.055,-.017),(0,-.024),(-.055,-.017),(-.064,-.009),(-.066,.043)]
fv=[tuple(bc+Vector((x,-.029,z))) for x,z in flap];o=mesh('Satchel_Envelope_Flap',fv,[tuple(range(len(fv)))],bagMat);bind(o,'J_Bip_C_Hips');finish(o,0,.005);be=o.modifiers.new('Soft flap edge','BEVEL');be.width=.002;be.segments=3
curve('Satchel_Flap_Piping',[tuple(bc+Vector((x,-.033,z))) for x,z in flap],.0007,bagSeam,'J_Bip_C_Hips',closed=True,smooth=False)
curve('Satchel_Body_Piping',[tuple(bc+Vector((x,-.027,z))) for x,z in [(-.06,.040),(-.061,-.038),(-.052,-.051),(.052,-.051),(.061,-.038),(.061,.040)]],.00065,bagSeam,'J_Bip_C_Hips')
rounded('Satchel_Clasp_Plate',bc+Vector((0,-.035,-.013)),(.019,.005,.024),gold,'J_Bip_C_Hips',.003)
rounded('Satchel_Clasp_Inset',bc+Vector((0,-.039,-.012)),(.012,.003,.014),goldLight,'J_Bip_C_Hips',.0015)
rounded('Satchel_Clasp_Turnlock',bc+Vector((0,-.042,-.012)),(.013,.003,.004),gold,'J_Bip_C_Hips',.0012)
for sign in [-1,1]:
 x=bc.x+sign*.061;z=bc.z+.049
 curve('Satchel_D_Ring',[(x-.005,bc.y-.006,z+.006),(x-.005,bc.y-.006,z+.015),(x+.005,bc.y-.006,z+.015),(x+.005,bc.y-.006,z+.006)],.0011,gold,'J_Bip_C_Hips',closed=True)
 rounded('Satchel_Strap_Tab',(x,bc.y-.006,z+.003),(.008,.007,.02),bagMat,'J_Bip_C_Hips',.002)
strappts=[(.155,-.052,.915),(.142,-.083,1.02),(.125,-.081,1.15),(.116,-.049,1.265),(.109,.008,1.311),(.118,.063,1.278),(.147,.070,1.15),(.205,.025,1.00),(.278,-.052,.915)]
o=strip('Leather_Shoulder_Strap',strappts,.007,leather,'J_Bip_C_UpperChest');o.vertex_groups.clear()
def strapweights(v):
 t=max(0,min(1,(v.co.z-.98)/.29));return {'J_Bip_C_Hips':1-t,'J_Bip_C_UpperChest':t}
weights(o,strapweights)
for dx in [-.0027,.0027]:curve('Strap_Stitch',[(x+dx,y-.001,z) for x,y,z in strappts],.00028,bagSeam,fn=strapweights)

# Low-heel rounded loafers with a shaped vamp, welt, apron seams and little bows.
for side,sign in [('L',1),('R',-1)]:
 bone='J_Bip_'+side+'_Foot';cx=sign*.07636;n=96
 def outline(a,rx=.042,ry=.114,cy=-.028):return (cx+rx*cos(a)*(1-.08*max(0,-sin(a))),cy+ry*sin(a))
 rings=[(.042,.115,-.029,.024),(.043,.116,-.029,.031),(.043,.113,-.027,.052),(.041,.106,-.023,.068),(.031,.047,.024,.084)]
 vs=[];uv=[]
 for j,(rx,ry,cy,z) in enumerate(rings):
  for i in range(n+1):
   a=2*pi*i/n;x,y=outline(a,rx,ry,cy);zz=z+(.005*max(0,-sin(a)) if j==3 else 0);vs.append((x,y,zz));uv.append((i/n,j/4))
 fs=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(4) for i in range(n)]
 o=mesh('Soft_Leather_Loafer_'+side,vs,fs,leather,uv);bind(o,bone);finish(o,2,.002)
 # Fully modelled thin outsole rather than a contrasting white block.
 vs=[]
 for z in [.017,.027]:
  for i in range(n):
   x,y=outline(2*pi*i/n,.0435,.117,-.029);vs.append((x,y,z))
 fs=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]+[tuple(reversed(range(n))),tuple(range(n,2*n))]
 o=mesh('Loafer_Outsole_'+side,vs,fs,soleMat);bind(o,bone);be=o.modifiers.new('Sole bevel','BEVEL');be.width=.002;be.segments=3
 rounded('Low_Heel_'+side,(cx,.048,.011),(.062,.061,.022),soleMat,bone,.004)
 curve('Loafer_Welt_'+side,[(*outline(2*pi*i/n,.0438,.116,-.029),.029) for i in range(n)],.0009,leatherDark,bone,closed=True)
 curve('Loafer_Opening_'+side,[(cx+.031*cos(2*pi*i/n),.024+.047*sin(2*pi*i/n),.0845) for i in range(n)],.0014,leatherDark,bone,closed=True)
 # Raised moccasin apron with double fine stitching.
 for offset,r,matr in [(0,.00075,leatherDark),(-.002,.00035,bagMat)]:
  pts=[]
  for i in range(49):
   a=pi+pi*i/48;pts.append((cx+(.033+offset)*cos(a),-.046+(.083+offset)*sin(a),.071-.008*abs(cos(a))))
  curve('Moccasin_Apron_'+side,pts,r,matr,bone)
 for sg in [-1,1]:
  pts=[(cx,-.054,.080),(cx+sg*.012,-.064,.081),(cx+sg*.023,-.054,.080),(cx+sg*.01,-.048,.081),(cx,-.054,.080)]
  curve('Loafer_Bow_'+side,pts,.0018,leather,bone)
  curve('Loafer_Bow_Tip_'+side,[(cx,-.054,.081),(cx+sg*.008,-.073,.078)],.0013,leather,bone)
 rounded('Loafer_Bow_Knot_'+side,(cx,-.054,.082),(.007,.008,.004),gold,bone,.0012)

for o in bpy.context.selected_objects:o.select_set(False)
bpy.context.view_layer.update()
result={'new_objects':len(col.objects),'skirt_vertices':len(skirt.data.vertices),'fabric_image':atlas.filepath}
