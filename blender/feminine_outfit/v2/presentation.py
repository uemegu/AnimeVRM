import bpy, math
from math import sin,cos,pi,exp,atan2,radians
from mathutils import Vector,Quaternion
arm=bpy.data.objects['Armature'];col=bpy.data.collections['Feminine • reference detail revision']

# Close the armhole overlap and make the sleeve volume more restrained.
for side,sign in [('L',1),('R',-1)]:
 o=bpy.data.objects['V2_Puffed_Sleeve_'+side];n=64;rows=22
 for v in o.data.vertices:
  j=v.index//(n+1);i=v.index%(n+1);t=j/rows;a=2*pi*i/n
  x=.080+.203*t
  ry=.044+.012*sin(pi*t)**.8-.009*t;rz=.041+.013*sin(pi*t)**.8-.005*t
  g=(.0007+.002*t)*sin(10*a+.7*t)*sin(pi*t)
  v.co=(sign*x,.021+(ry+g)*cos(a),1.266-.003*t+(rz+g)*sin(a))
 o.vertex_groups.clear();gc=o.vertex_groups.new(name='J_Bip_C_UpperChest');ga=o.vertex_groups.new(name='J_Bip_'+side+'_UpperArm')
 for v in o.data.vertices:
  t=max(0,min(1,(abs(v.co.x)-.080)/.080));ga.add([v.index],t,'REPLACE');gc.add([v.index],1-t,'REPLACE')

# Painted fold values follow the actual irregular drape, supplementing real lighting.
sk=bpy.data.objects['V2_Draped_Flare_Skirt'];attr=sk.data.color_attributes.new(name='Painted fold shading',type='FLOAT_COLOR',domain='POINT')
for v in sk.data.vertices:
 j=v.index//193;i=v.index%193;t=j/64;a=2*pi*i/192
 phase=12*a+.34*sin(2*a)+.34*t*sin(3*a+.4)
 val=.98+.145*sin(phase+.35)-.065*max(0,-cos(phase))**5
 val+=.024*sin(3*a+.5)*sin(pi*t)+.013*sin(phase*2+.8)*t
 val=1+(val-1)*(.52+.48*t**.4)
 attr.data[v.index].color=(val,val*.997,val*.992,1)
m=bpy.data.materials['V2 muted rose woven fabric'];nt=m.node_tree
em=next(n for n in nt.nodes if n.type=='EMISSION');old=em.inputs[0].links[0].from_socket;at=nt.nodes.new('ShaderNodeVertexColor');at.layer_name='Painted fold shading';mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;nt.links.new(old,mix.inputs[1]);nt.links.new(at.outputs['Color'],mix.inputs[2]);nt.links.new(mix.outputs[0],em.inputs[0])

# A presentation pose close to the reference, keeping hands in front of the fabric.
def orient(name,q):
 p=arm.pose.bones[name];rest=p.bone.matrix_local.to_quaternion();pd=p.parent.matrix.to_quaternion()@p.parent.bone.matrix_local.to_quaternion().inverted() if p.parent else Quaternion();p.rotation_quaternion=rest.inverted()@pd.inverted()@q@rest;bpy.context.view_layer.update()
for sign,side in [(1,'L'),(-1,'R')]:
 orient('J_Bip_'+side+'_UpperArm',Quaternion((1,0,0),radians(-22))@Quaternion((0,1,0),radians(sign*77)))
 orient('J_Bip_'+side+'_LowerArm',Quaternion((1,0,0),radians(-40))@Quaternion((0,1,0),radians(sign*114)))

scene=bpy.context.scene
studio=bpy.data.collections.new('Feminine • comparison studio');scene.collection.children.link(studio)
for o in scene.objects:
 if o.type=='LIGHT':o.hide_render=True
camdata=bpy.data.cameras.new('Feminine reference portrait');cam=bpy.data.objects.new('Feminine reference portrait',camdata);studio.objects.link(cam)
cam.location=(.10,-3.8,1.03);target=Vector((0,0,.815));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=1.74;scene.camera=cam
def area(name,loc,power,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);studio.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
area('Feminine large softbox',(-2.5,-3.5,4),420,3)
area('Feminine gentle fill',(2,-1,2.8),130,3)
area('Feminine rim',(.5,1,3.5),220,2)
world=bpy.data.worlds.new('Feminine warm paper');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.72,.69,.65,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8;scene.world=world
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));ground=bpy.context.object;ground.name='Feminine paper ground'
for c in list(ground.users_collection):c.objects.unlink(ground)
studio.objects.link(ground);mat=bpy.data.materials.new('Feminine warm studio floor');mat.diffuse_color=(.78,.74,.70,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.78,.74,.70,1);mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9;ground.data.materials.append(mat)
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1100;scene.render.resolution_y=1500;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
for a in bpy.context.screen.areas:
 if a.type=='VIEW_3D':
  a.spaces.active.region_3d.view_distance=1.86;a.spaces.active.region_3d.view_location=(0,0,.84);a.spaces.active.overlay.show_overlays=False
bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.update()
result={'pose':'reference-like hands in front','camera':cam.name}
