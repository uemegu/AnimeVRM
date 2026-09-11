"""Run in a disposable Blender process containing an imported Eye Atelier VRM.

Checks baseline fidelity, reversible edits, reconnect, export and actual reimport.
This integration test replaces the scene in its process for the last check.
"""
import bpy,sys,importlib.util,math,json
from pathlib import Path
p=str(Path(__file__).with_name('blender_engine.py'))
spec=importlib.util.spec_from_file_location('vroid_eye_editor',p);e=importlib.util.module_from_spec(spec);sys.modules[spec.name]=e;spec.loader.exec_module(e)
before={o.as_pointer():{k.name:[v.co.copy() for v in k.data] for k in o.data.shape_keys.key_blocks} for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys}
print('INIT',e.initialize());s=e.SESSION;params=dict(s['params'])
assert s['preview'].name == 'Face'
assert s['preview']['eye_editor_source'] == s['source'].name
for src,obj in [(s['source'],s['preview']),*zip(s['source_lines'],s['lines'])]:
 assert all(v.co==before[src.as_pointer()][k.name][i] for k in obj.data.shape_keys.key_blocks for i,v in enumerate(k.data)),obj.name
count=len(bpy.data.objects);e.initialize();assert len(bpy.data.objects)==count
for control,value in [('face_slim',.5),('eye_x',.3),('thickness',2),('corner_angle',.5)]:
 e.update({**params,control:value})
 assert all(math.isfinite(x) for obj in [s['preview'],*s['lines']] for k in obj.data.shape_keys.key_blocks for v in k.data for x in v.co)
 if control in ('thickness','corner_angle','eye_x'):
  assert any(v.co!=before[s['source_lines'][0].as_pointer()]['Basis'][i] for i,v in enumerate(s['lines'][0].data.shape_keys.key_blocks[0].data))
e.update(params)
for src,obj in [(s['source'],s['preview']),*zip(s['source_lines'],s['lines'])]:
 assert all(v.co==before[src.as_pointer()][k.name][i] for k in obj.data.shape_keys.key_blocks for i,v in enumerate(k.data)),obj.name
 assert all(v.co==before[src.as_pointer()][k.name][i] for k in src.data.shape_keys.key_blocks for i,v in enumerate(k.data)),src.name
e.update({'before':True});assert all(o.hide_get() for o in [s['preview'],*s['lines']]);assert all(not o.hide_get() for o in [s['source'],*s['source_lines']]);e.update(params)
binds=[(n,[(getattr(b,a).mesh_object_name,b.index,b.weight) for b in bs]) for n,bs,a in e.expression_collections()]
e.repair_expression_bindings();assert binds==[(n,[(getattr(b,a).mesh_object_name,b.index,b.weight) for b in bs]) for n,bs,a in e.expression_collections()]
e.SESSION=None;e.initialize();assert len(bpy.data.objects)==count
print('REIMPORT_TEST_PASSED')
exported=e.export_vrm('/tmp/eye-reimport-test')
print('EXPORT',exported)
# A second real VRM import must also be editable (not just reconnectable).
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.import_scene.vrm(filepath=exported['path'])
e.SESSION=None
again=e.initialize()
assert again['rebased'] and len(e.SESSION['lines'])==2
assert again['model'] == 'Face'
assert len([o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_get() and o.get('eye_editor_role')=='line'])==2
e.update(again['reset_params'])
print('SECOND_VRM_IMPORT_PASSED')
