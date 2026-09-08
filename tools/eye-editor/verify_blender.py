"""Run through Blender MCP after connecting. Preserves the current settings."""
import math
import sys

engine = sys.modules['vroid_eye_editor']
s = engine.SESSION
previous = dict(s['params'])
source_coords = {k.name: [p.co.copy() for p in k.data] for k in s['source'].data.shape_keys.key_blocks}
try:
    engine.update(dict(flatness=1.0, length=1.0, thickness=1.2, blink=1.0, before=False))
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
    engine.update(dict(flatness=0.0, length=0.0, blink=0.0))
    for key in s['preview'].data.shape_keys.key_blocks:
        assert all(p.co == s['coords'][key.name][i] for i, p in enumerate(key.data)), key.name
    assert all(o.hide_get() for o in s['lines'])
    for key in s['source'].data.shape_keys.key_blocks:
        assert all(p.co == source_coords[key.name][i] for i, p in enumerate(key.data)), key.name
    result = dict(passed=True, expressions=len(s['coords']), original_unchanged=True,
                  reset_exact=True, iris_unchanged=True)
finally:
    engine.update(previous)
