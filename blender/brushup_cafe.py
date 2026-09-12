import bpy, math, random
from mathutils import Vector, Euler
random.seed(42)
s=bpy.context.scene
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//cafe_before_brushup.blend'),copy=True)
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath('//cafe_brushed.blend'))
col=bpy.data.collections.new('Cafe_Brushup_Details');s.collection.children.link(col)
def box(name,p,d,mat,parent=None,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.dimensions=d
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o)
 if mat:o.data.materials.append(bpy.data.materials[mat])
 if parent:o.parent=parent
 if bevel: m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=3
 return o
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
cam=s.camera;cam.location=(2.1,-8.6,2.15);aim(cam,(-1.3,.5,2.05));cam.data.lens=27
s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=65
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True
s.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.64,.77,1,1)
s.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.45
sun=bpy.data.objects['Golden_Afternoon_Sun'];sun.data.energy=3.2;sun.data.color=(1,.82,.58);sun.data.angle=math.radians(1.4)
sun.rotation_euler=Vector((-.48,-.80,-.52)).to_track_quat('-Z','Y').to_euler()
bpy.data.objects['Interior_Fill'].data.energy=650
bpy.data.objects['Interior_Fill'].data.color=(1,.84,.65)
bpy.data.objects['Light'].hide_render=True
s.view_settings.view_transform='AgX';s.view_settings.exposure=.5
for o in list(s.objects):
 if o.name.startswith('Floorboard_'):o.hide_render=True;o.hide_set(True)
 if o.name.startswith('Glass_Panel'):o.visible_shadow=False
# actual clear glazing, avoiding the previous blue alpha tint
m=bpy.data.materials['Cafe_Glass'];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(.98,.99,1,1);p.inputs['Alpha'].default_value=1;p.inputs['Transmission Weight'].default_value=1;p.inputs['Roughness'].default_value=.035;p.inputs['IOR'].default_value=1.45
# directional grain, colour and microscopic normal variation
for name in ['Cafe_Honey_Wood','Cafe_Warm_Wood']:
 m=bpy.data.materials[name];nt=m.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');base=list(p.inputs['Base Color'].default_value)
 tex=nt.nodes.new('ShaderNodeTexCoord');v=nt.nodes.new('ShaderNodeVectorMath');v.operation='MULTIPLY';v.inputs[1].default_value=(2,65,5);nt.links.new(tex.outputs['Generated'],v.inputs[0])
 n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=3;n.inputs['Detail'].default_value=3;nt.links.new(v.outputs[0],n.inputs['Vector'])
 r=nt.nodes.new('ShaderNodeValToRGB');r.color_ramp.elements[0].position=.18;r.color_ramp.elements[0].color=tuple(x*.45 for x in base[:3])+(1,);r.color_ramp.elements[1].position=.8;r.color_ramp.elements[1].color=tuple(min(1,x*1.35) for x in base[:3])+(1,)
 nt.links.new(n.outputs['Fac'],r.inputs[0]);nt.links.new(r.outputs[0],p.inputs['Base Color'])
 b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.17;b.inputs['Distance'].default_value=.008;nt.links.new(n.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs[0],p.inputs['Normal']);p.inputs['Roughness'].default_value=.34
for row in range(42):
 y=-10.2+row*.245
 for j in range(5):
  x=-7.8+j*3.05+(row%3)*1.01
  if x<-6.5 or x>6.5:continue
  box('Brushup_Parquet',(x,y,.025),(3.043,.239,.035),'Cafe_Honey_Wood',bevel=.003)
# replace broad chair backs with open slats, retaining original hidden geometry
for o in list(s.objects):
 if o.name.startswith('Chair_Back'):
  o.hide_render=True;o.hide_set(True);pa=o.parent
  box('Brushup_Chair_Top',(0,.37,1.43),(.86,.12,.19),'Cafe_Warm_Wood',pa,.035)
  for x in [-.35,-.17,0,.17,.35]:box('Brushup_Chair_Slat',(x,.37,1),(.06,.065,.78),'Cafe_Warm_Wood',pa,.018)
  box('Brushup_Chair_Rail',(0,.37,.69),(.82,.09,.09),'Cafe_Warm_Wood',pa)
# leaf geometry batches: pointed leaves with a raised midrib
verts=[];faces=[];mi=[]
def leaf(c,sz):
 rot=Euler((random.uniform(-1,1),random.uniform(-1,1),random.uniform(0,6.28))).to_matrix();i=len(verts)
 for p in [(0,-sz,0),(-sz*.45,0,0),(0,sz,0),(sz*.45,0,0),(0,0,sz*.16)]:verts.append(Vector(c)+rot@Vector(p))
 faces.extend([(i,i+1,i+4),(i+1,i+2,i+4),(i+2,i+3,i+4),(i+3,i,i+4)]);mi.extend([random.randrange(3)]*4)
for o in list(s.objects):
 if o.name.startswith(('Foliage','Plant_Leaf')):
  c=o.location.copy();d=o.dimensions.copy();o.hide_render=True;o.hide_set(True)
  for k in range(160 if o.name.startswith('Foliage') else 18):
   p=c+Vector((random.gauss(0,d.x*.30),random.gauss(0,d.y*.30),random.gauss(0,d.z*.30)))
   leaf(p,random.uniform(.045,.105))
# overhanging foliage creates real dappled shadows through the windows
for k in range(1700):
 x=random.uniform(-6,6);y=random.uniform(.4,3.2)
 if math.sin(x*2+y*3)+random.random()>.05:leaf((x,y,random.uniform(3.8,4.8)),random.uniform(.055,.115))
me=bpy.data.meshes.new('Brushup_Leaf_Mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Brushup_Individual_Leaves',me);col.objects.link(o)
for n in ['Leaf_Deep','Leaf_Green','Leaf_Sunlit']:me.materials.append(bpy.data.materials[n])
for poly,idx in zip(me.polygons,mi):poly.material_index=idx
# readable chalkboard on the left side, rows separated vertically
for i,o in enumerate(sorted([o for o in s.objects if o.name.startswith('Menu_Line')],key=lambda o:o.name)):
 o.location.y=-5.12;o.location.z=3.65-i*.34;o.data.size=.20;o.data.extrude=.001
# a shelf and books under the board
box('Brushup_Bookshelf',(-5.65,-4,2.08),(.65,3.3,.12),'Cafe_Warm_Wood')
for i in range(19):
 o=box('Brushup_Book',(-5.64,-5.4+i*.135,2.36),(.31,.10,random.uniform(.35,.52)),random.choice(['Awning_Navy','Cafe_Warm_Wood','Street_Light_Stone','Awning_Wine']),bevel=.007)
# frames at the top of glazing
for x in [-5.08,-3.12,-1.04,1.04,3.12,5.08]:box('Brushup_Transom',(x,-.10,3.95),(1.9,.14,.10),'Cafe_Dark_Frames')
for a in bpy.context.screen.areas:
 if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
s.render.filepath=bpy.path.abspath('//../renders/cafe_brushed_preview.png')
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
result={'saved':bpy.data.filepath,'added':len(col.objects),'leaf_faces':len(faces)}
