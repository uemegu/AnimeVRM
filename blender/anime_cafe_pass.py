import bpy, math, random
from mathutils import Vector, Euler
from pathlib import Path
random.seed(107)
s=bpy.context.scene
base=Path(bpy.data.filepath).parent
bpy.ops.wm.save_as_mainfile(filepath=str(base/'cafe_anime_terrace.blend'))
col=bpy.data.collections.new('Anime_Trees_and_Terrace');s.collection.children.link(col)
def link(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o)
 return o
def mat(n,c,rough=.75):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough
 return m
bark=mat('Anime_Bark',(.19,.115,.06));iron=mat('Terrace_Painted_Iron',(.065,.095,.085));rattan=mat('Terrace_Honey_Rattan',(.52,.31,.115));cream=mat('Terrace_Ivory',(.84,.79,.61));navy=mat('Terrace_Canvas_Blue',(.045,.125,.23));soil=mat('Terrace_Soil',(.07,.045,.025));pink=mat('Terrace_Petals',(.82,.39,.43));white=mat('Terrace_Petal_Cream',(.97,.89,.65))
greens=[mat('Anime_Canopy_'+str(i),c) for i,c in enumerate([(.07,.16,.065),(.12,.265,.06),(.24,.39,.075),(.37,.49,.095),(.48,.57,.16)])]
def box(n,p,d,m,b=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=link(bpy.context.object);o.name=n;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if b:mod=o.modifiers.new('Soft edges','BEVEL');mod.width=b;mod.segments=2
 return o
def rod(n,a,b,r,m,r2=None):
 a,b=Vector(a),Vector(b);v=b-a;bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r,radius2=r if r2 is None else r2,depth=v.length,location=(a+b)/2);o=link(bpy.context.object);o.name=n;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def sphere(n,p,scale,m,sub=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=p);o=link(bpy.context.object);o.name=n;o.scale=scale;o.data.materials.append(m)
 for poly in o.data.polygons:poly.use_smooth=True
 return o
def hide(o):o.hide_render=True;o.hide_set(True)
# preserve previous experiments in their original collections
for o in list(s.objects):
 if o.name.startswith(('Brushup_Individual_Leaves','Tree_Trunk','Foliage','Plant_Leaf')):hide(o)
 if o.name.startswith('Table_') and o.location.y>0:hide(o)
 if o.name.startswith('Chair_Root') and o.location.y>0:
  hide(o)
  for ch in o.children_recursive:hide(ch)
# organic, contiguous lobed crowns with connected tapering branches
leafverts=[];leaffaces=[];leafmats=[]
def leaf(p,size):
 rot=Euler((random.uniform(-.8,.8),random.uniform(-.8,.8),random.uniform(0,6.28))).to_matrix();i=len(leafverts)
 for v in [(0,-size,0),(-size*.45,0,0),(0,size,0),(size*.45,0,0),(0,0,size*.13)]:leafverts.append(Vector(p)+rot@Vector(v))
 leaffaces.extend([(i,i+1,i+4),(i+1,i+2,i+4),(i+2,i+3,i+4),(i+3,i,i+4)]);leafmats.extend([random.randrange(1,5)]*4)
def crown(p,sc):
 o=sphere('Anime_Connected_Crown',p,sc,greens[1],3)
 for m in greens[2:]:o.data.materials.append(m)
 for v in o.data.vertices:
  co=v.co;co*=1+.12*math.sin(co.x*10+co.z*4)*math.cos(co.y*9)+random.uniform(-.025,.025)
 for poly in o.data.polygons:
  z=sum(o.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)
  poly.material_index=max(0,min(3,int((z+1)*1.5)+random.choice([0,0,1])))
 for k in range(190):
  v=Vector((random.gauss(0,1),random.gauss(0,1),random.gauss(0,1))).normalized();pt=Vector(p)+Vector((v.x*sc[0]*1.02,v.y*sc[1]*1.02,v.z*sc[2]*1.02));leaf(pt,random.uniform(.055,.095))
def tree(x,y,h):
 p0=(x,y,.05);p1=(x+.1,y,1.65);p2=(x-.12,y+.08,h*.68);p3=(x+.12,y,h*.95)
 rod('Anime_Trunk',p0,p1,.18,bark,.135);rod('Anime_Trunk',p1,p2,.135,bark,.085);rod('Anime_Leader',p2,p3,.085,bark,.025)
 for j in range(8):
  a=j*2.399;start=Vector((x,y,h*.47+j*.10));end=Vector((x+math.cos(a)*1.02,y+math.sin(a)*.82,h*.75+random.uniform(-.25,.35)))
  mid=start.lerp(end,.6);mid.z-=.13
  rod('Anime_Main_Branch',start,mid,.075,bark,.045);rod('Anime_Branch_Tip',mid,end,.045,bark,.012)
  crown(end,(random.uniform(.7,.95),random.uniform(.60,.82),random.uniform(.58,.78)))
 crown((x,y,h+.05),(.92,.82,.72))
 for j in range(4):
  a=j*1.57;rod('Anime_Root',(x+math.cos(a)*.42,y+math.sin(a)*.42,.025),(x,y,.45),.035,bark,.09)
# side trees leave the cafe seating legible; the third tree stands to the left of the terrace
tree(-5.6,5.5,4.15);tree(5.5,5.8,4.65);tree(-3.9,8.9,3.85)
# restore bushy planting at existing pots
for o in [o for o in s.objects if o.name.split('.')[0]=='Planter']:
 x,y,z=o.location
 crown((x,y,z+o.dimensions.z*.7),(.42,.40,.38))
# outdoor seating on a defined terrace in front of the shop
box('Terrace_Paving_Inlay',(.5,8.3,.035),(8.0,3.5,.045),bpy.data.materials['Street_Warm_Stone'],.01)
# one broad pitched awning identifies the cafe frontage
for o in list(s.objects):
 if o.name.startswith('Awning') and abs(o.location.x)<2:hide(o)
aw=box('Terrace_Continuous_Awning',(.3,9.6,3.20),(6.0,1.7,.08),navy);aw.rotation_euler.x=math.radians(10)
box('Terrace_Awning_Valance',(.3,8.76,3.00),(6,.055,.26),navy)
for x in [-2.65,3.25]:rod('Terrace_Awning_Support',(x,10.4,2.4),(x,8.8,3.0),.023,iron)
# chairs use curved tubular backs and woven seats, oriented toward each table
chair_records=[]
def chair(cx,cy,angle):
 def tr(p):return (cx+p[0]*math.cos(angle)-p[1]*math.sin(angle),cy+p[0]*math.sin(angle)+p[1]*math.cos(angle),p[2])
 for x in [-.23,.23]:
  for y in [-.22,.22]:rod('Terrace_Chair_Leg',tr((x*1.15,y*1.15,.07)),tr((x,y,.47)),.021,rattan)
 seat=box('Terrace_Chair_Woven_Seat',tr((0,0,.49)),(.52,.48,.065),cream,.05);seat.rotation_euler.z=angle
 for x in [-.24,.24]:rod('Terrace_Chair_Back_Post',tr((x,.20,.40)),tr((x,.26,.98)),.025,rattan)
 pts=[(-.24,.26,.93),(-.20,.28,1.03),(0,.30,1.065),(.20,.28,1.03),(.24,.26,.93)]
 for a,b in zip(pts,pts[1:]):rod('Terrace_Chair_Curved_Top',tr(a),tr(b),.028,rattan)
 for x in [-.15,-.075,0,.075,.15]:rod('Terrace_Chair_Weave',tr((x,.23,.64)),tr((x,.285,1.015)),.013,cream)
 for x in [-.22,.22]:rod('Terrace_Chair_Stretcher',tr((x,-.22,.23)),tr((x,.22,.23)),.014,rattan)
 chair_records.append((cx,cy,angle))
for i,(x,y) in enumerate([(-1.8,8.4),(.65,8.35),(3.1,8.35)]):
 rod('Terrace_Table_Top',(x,y,.78),(x,y,.835),.49,cream)
 rod('Terrace_Table_Pedestal',(x,y,.10),(x,y,.78),.045,iron)
 for a in [0,2.094,4.189]:rod('Terrace_Table_Foot',(x,y,.14),(x+math.cos(a)*.32,y+math.sin(a)*.32,.065),.026,iron)
 for a in [0.12,math.pi+.12]:
  cx=x+math.cos(a)*.82;cy=y+math.sin(a)*.82;chair(cx,cy,a-math.pi/2)
 rod('Terrace_Sugar_Pot',(x+.14,y,.84),(x+.14,y,.94),.04,rattan)
 rod('Terrace_Flower_Vase',(x,y,.84),(x,y,1.00),.048,cream,.035)
 for k in range(5):
  a=k*2.4;tip=(x+math.cos(a)*.08,y+math.sin(a)*.08,1.12+random.uniform(-.025,.04));rod('Terrace_Flower_Stem',(x,y,.95),tip,.005,greens[0]);sphere('Terrace_Table_Blossom',tip,(.035,.035,.025),white,1)
# low flower boxes define terrace edge, keeping an entrance gap and the foreground street clear
for x in [-2.5,.0,3.7]:
 y=6.77
 box('Terrace_Boundary_Planter',(x,y,.29),(1.65,.38,.5),rattan)
 box('Terrace_Planter_Soil',(x,y,.555),(1.54,.31,.035),soil,0)
 for z in [.16,.36,.51]:box('Terrace_Planter_Band',(x,y-.20,z),(1.69,.035,.038),iron,.006)
 for k in range(9):
  p=(x-.7+k*.175,y,.66+random.uniform(0,.1));sphere('Terrace_Dense_Green',p,(.23,.20,.20),random.choice(greens[:3]),2)
  for j in range(3):
   pt=(p[0]+random.uniform(-.13,.13),y+random.uniform(-.15,.15),p[2]+.17);sphere('Terrace_Blossoms',pt,(.045,.04,.03),white if j else pink,1)
# batch fine foliage is confined to the crowns, with no floating overhead leaf field
me=bpy.data.meshes.new('Anime_Crown_Edge_Leaves');me.from_pydata(leafverts,[],leaffaces);me.update();o=bpy.data.objects.new('Anime_Crown_Edge_Leaves',me);col.objects.link(o)
for m in greens:me.materials.append(m)
for p,idx in zip(me.polygons,leafmats):p.material_index=idx
# background-art palette: broader quiet colour areas, reduced microcontrast
for n in ['Cafe_Honey_Wood','Cafe_Warm_Wood']:
 m=bpy.data.materials[n];nt=m.node_tree
 for node in nt.nodes:
  if node.type=='VALTORGB':
   c=(.39,.21,.085) if n=='Cafe_Honey_Wood' else (.23,.115,.052)
   node.color_ramp.elements[0].color=(*[v*.82 for v in c],1);node.color_ramp.elements[1].color=(*[v*1.10 for v in c],1)
  if node.type=='BUMP':node.inputs['Strength'].default_value=.045
  if node.type=='BSDF_PRINCIPLED':node.inputs['Roughness'].default_value=.55
for n,c in [('Street_Light_Stone',(.78,.75,.64)),('Street_Warm_Stone',(.60,.62,.59)),('Cafe_Cream_Plaster',(.77,.65,.47)),('Cafe_Dark_Frames',(.043,.052,.055))]:
 p=bpy.data.materials[n].node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.65
sun=bpy.data.objects['Golden_Afternoon_Sun'];sun.data.energy=3.7;sun.data.color=(1,.84,.61);sun.data.angle=math.radians(2.3)
s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.53,.69,1,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
s.view_settings.view_transform='AgX';s.view_settings.exposure=.45
s.render.resolution_percentage=65;s.cycles.samples=32;s.cycles.use_denoising=True
s.render.filepath=str(base.parent/'renders/cafe_anime_terrace.png')
s['anime_pass_notes']='Connected branching trees with contiguous lobed crowns; 3 two-person terrace tables facing inward; planters separate seating from pedestrian street; restrained wood texture and warm/cool lighting.'
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
result={'saved':bpy.data.filepath,'new_objects':len(col.objects),'terrace_chairs':chair_records,'leaf_faces':len(leaffaces)}
