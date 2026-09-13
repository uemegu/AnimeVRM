import bpy,os,json
ROOT='/Users/ueda/git/practice/vrm-view/vrm-genshin-like/blender/feminine_outfit/v2/'
col=bpy.data.collections['Feminine • reference detail revision'];scene=bpy.context.scene
def native_mtoon(m,color,image=None,outline=.00038):
 ext=m.vrm_addon_extension.mtoon1;ext.enabled=True;ext.alpha_mode='OPAQUE';ext.double_sided=True
 ext.pbr_metallic_roughness.base_color_factor=(1,1,1,1) if image else tuple(color)
 ext.pbr_metallic_roughness.base_color_texture.index.source=image
 toon=ext.extensions.vrmc_materials_mtoon
 toon.shade_multiply_texture.index.source=image
 toon.shade_color_factor=(.78,.73,.75) if image else tuple(c*.79 for c in color[:3])
 toon.shading_shift_factor=.05;toon.shading_toony_factor=.55;toon.gi_equalization_factor=.9
 toon.parametric_rim_color_factor=(0,0,0);toon.matcap_factor=(0,0,0)
 toon.outline_width_mode='worldCoordinates';toon.outline_width_factor=outline;toon.outline_color_factor=(.23,.16,.17);toon.outline_lighting_mix_factor=.4;toon.enable_outline_preview=True
 ext.emissive_factor=(0,0,0)
 return m

def bake(name,size):
 o=bpy.data.objects[name];orig=o.data.materials[0];temp=orig.copy();temp.name='TEMP albedo bake '+name;o.data.materials[0]=temp
 nt=temp.node_tree;em=next(n for n in nt.nodes if n.type=='EMISSION')
 base=next(n for n in nt.nodes if n.type=='MIX_RGB' and n.blend_type=='MULTIPLY' and n.inputs[2].is_linked and n.inputs[2].links[0].from_node.type=='VALTORGB')
 if base.inputs[1].is_linked:socket=base.inputs[1].links[0].from_socket
 else:
  rgb=nt.nodes.new('ShaderNodeRGB');rgb.outputs[0].default_value=base.inputs[1].default_value;socket=rgb.outputs[0]
 if name=='V2_Draped_Flare_Skirt':
  at=nt.nodes.new('ShaderNodeVertexColor');at.layer_name='Painted fold shading';mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;nt.links.new(socket,mix.inputs[1]);nt.links.new(at.outputs[0],mix.inputs[2]);socket=mix.outputs[0]
 nt.links.new(socket,em.inputs['Color'])
 image=bpy.data.images.new(name.replace('V2_','')+'_Albedo',width=size,height=size,alpha=False)
 image.colorspace_settings.name='sRGB';tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image
 for n in nt.nodes:n.select=False
 tex.select=True;nt.nodes.active=tex
 bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
 mods=[(m,m.show_render,m.show_viewport) for m in o.modifiers]
 for m,_,_ in mods:m.show_render=False;m.show_viewport=False
 bpy.context.view_layer.update();bpy.ops.object.bake(type='EMIT',margin=12,use_clear=True)
 for m,r,v in mods:m.show_render=r;m.show_viewport=v
 image.filepath_raw=ROOT+image.name+'.png';image.file_format='PNG';image.save();image.pack()
 final=bpy.data.materials.new('MToon '+name.replace('V2_',''));native_mtoon(final,(1,1,1,1),image,.0005 if 'Skirt' in name else .0003);o.data.materials[0]=final
 return {'object':name,'image':image.filepath_raw,'mtoon':final.vrm_addon_extension.mtoon1.enabled}

scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.render.bake.use_selected_to_active=False
records=[]
for name,size in [('V2_Knit_Bodice',2048),('V2_Puffed_Sleeve_L',1024),('V2_Puffed_Sleeve_R',1024),('V2_Draped_Flare_Skirt',2048)]:records.append(bake(name,size))
scene.render.engine='BLENDER_EEVEE'
converted=set()
for o in col.objects:
 if o.type!='MESH' or o.hide_render:continue
 for mat in o.data.materials:
  if not mat or mat.vrm_addon_extension.mtoon1.enabled or mat.name in converted:continue
  color=tuple(mat.diffuse_color);native_mtoon(mat,color,None,.00025);converted.add(mat.name)
# Explicitly verify every visible outfit material uses the VRM addon native schema.
fail=[(o.name,m.name) for o in col.objects if o.type=='MESH' and not o.hide_render for m in o.data.materials if m and not m.vrm_addon_extension.mtoon1.enabled]
result={'baked':records,'other_materials_converted':len(converted),'non_mtoon_outfit_materials':fail}
with open(ROOT+'material_validation.json','w') as f:json.dump(result,f,indent=2)
