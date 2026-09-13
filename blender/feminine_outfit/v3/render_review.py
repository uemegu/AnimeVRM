import bpy
from mathutils import Vector
root='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v3/'
s=bpy.context.scene;a=bpy.data.objects['Armature'];a.data.vrm_addon_extension.spring_bone1.enable_animation=False
c=s.camera;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
for name,loc,target,scale,res in [
 ('front',(0,-3.8,1.0),(0,0,.83),1.74,(1000,1400)),
 ('back_waist',(0,2.5,2.0),(0,-.02,1.075),.77,(1100,1100)),
 ('collar',(.15,-3,1.5),(0,0,1.22),.54,(1100,1000)),
 ('rear_oblique',(1.3,2,1.8),(0,0,1.08),.76,(1000,1000))]:
 c.location=loc;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale;s.render.resolution_x,s.render.resolution_y=res;s.render.filepath=root+name+'.png';bpy.ops.render.render(write_still=True)
