"""Run through Blender MCP after connecting. Preserves the current settings."""
import math
import sys

engine = sys.modules['vroid_eye_editor']
s = engine.SESSION
previous = dict(s['params'])
source_coords = {k.name: [p.co.copy() for p in k.data] for k in s['source'].data.shape_keys.key_blocks}
try:
    engine.repair_expression_bindings()
    count = sum(len(binds) for _, binds, _ in engine.expression_collections())
    engine.repair_expression_bindings()
    assert count == sum(len(binds) for _, binds, _ in engine.expression_collections())
    for _, binds, attr in engine.expression_collections():
        assert all(getattr(b, attr).mesh_object_name != s['source'].name for b in binds)
    peaks = []
    for shift in (-1.0, 1.0):
        engine.update(dict(flatness=0.0, upper_peak=shift, expression='none', blink=0.0))
        basis = s['preview'].data.shape_keys.key_blocks[0]
        peaks.append([abs(max((basis.data[i].co for i in eye['upper']), key=lambda p: p.z).x)
                      for eye in s['eyes']])
    assert all(a < b for a, b in zip(*peaks)), peaks
    engine.update(dict(flatness=1.0, length=1.0, thickness=1.2, corner_ratio=.1, upper_peak=1.0, blink=1.0, before=False))
    basis = s['preview'].data.shape_keys.key_blocks[0]
    assert max((p.co - s['coords']['Basis'][i]).length for i, p in enumerate(basis.data)) > .001
    for key in s['preview'].data.shape_keys.key_blocks:
        for i, p in enumerate(key.data):
            assert all(math.isfinite(x) for x in p.co)
            if i not in s['movable']:
                assert p.co == s['coords'][key.name][i], (key.name, i)
    for obj in s['lines']:
        assert obj.visible_get()
        assert len(obj.data.shape_keys.key_blocks) == len(s['coords'])
        assert all(math.isfinite(x) for key in obj.data.shape_keys.key_blocks for p in key.data for x in p.co)
    assert engine.line_width(.66, .6, s['params']) < engine.line_width(.12, .1, s['params']) / 3
    engine.update(dict(expression='happy', blink=0.0))
    happy = s['preview'].data.shape_keys.key_blocks.get('Fcl_ALL_Joy')
    assert happy is not None and happy.value == 1.0
    for line in s['lines']:
        assert line.data.shape_keys.key_blocks[happy.name].value == happy.value
    engine.update(dict(flatness=0.0, length=0.0, upper_peak=0.0, blink=0.0, expression='none'))
    for key in s['preview'].data.shape_keys.key_blocks:
        assert all(p.co == s['coords'][key.name][i] for i, p in enumerate(key.data)), key.name
    assert all(o.hide_get() for o in s['lines'])
    for key in s['source'].data.shape_keys.key_blocks:
        assert all(p.co == source_coords[key.name][i] for i, p in enumerate(key.data)), key.name
    result = dict(passed=True, expressions=len(s['coords']), original_unchanged=True,
                  reset_exact=True, iris_unchanged=True, peak_positions=peaks,
                  binding_count=count, bindings_idempotent=True, happy_preview=True,
                  tapered_inner_line=True)
finally:
    engine.update(previous)
