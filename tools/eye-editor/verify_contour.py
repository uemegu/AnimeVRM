"""Run in Blender with an initialized engine; restore settings on every exit."""
import math
import sys
engine = sys.modules['vroid_eye_editor']
s = engine.SESSION
saved = dict(s['params'])
original = {k.name: [v.co.copy() for v in k.data] for k in s['source'].data.shape_keys.key_blocks}
try:
    keys = s['preview'].data.shape_keys.key_blocks
    for control in ('jaw_roundness', 'face_slim'):
        engine.update({**engine.DEFAULTS, control: 1})
        changed = [i for i,v in enumerate(keys[0].data) if (v.co-s['coords'][keys[0].name][i]).length > 1e-6]
        assert changed, control
        assert set(changed) <= s['skin_vertices']
        if control == 'face_slim':
            assert all(abs(keys[0].data[i].co.x) < abs(s['coords'][keys[0].name][i].x) for i in changed)
        for key in keys:
            assert all(math.isfinite(x) for v in key.data for x in v.co)
            for i in changed:
                delta = key.data[i].co - keys[0].data[i].co
                old = s['coords'][key.name][i] - s['coords'][keys[0].name][i]
                assert (delta-old).length < 2e-7
        assert all(keys[0].data[i].co == s['coords'][keys[0].name][i] for eye in s['eyes'] for i in eye['loop'])
    for angle in (-1, 1):
        engine.update({**engine.DEFAULTS, 'length':1, 'thickness':3, 'corner_ratio':3, 'corner_angle':angle})
        assert all(math.isfinite(x) for o in s['lines'] for k in o.data.shape_keys.key_blocks for v in k.data for x in v.co)
        coords = [[v.co.copy() for v in o.data.shape_keys.key_blocks[0].data] for o in s['lines']]
        for a,b in zip(*coords):
            # Finite-difference tangents amplify float32 noise at maximum width.
            assert abs(a.x+b.x)<1e-5 and abs(a.z-b.z)<1e-5
        engine.update({'corner_angle':0})
        assert any((v.co-coords[0][i]).length > 1e-5 for i,v in enumerate(s['lines'][0].data.shape_keys.key_blocks[0].data))
    engine.update({**engine.DEFAULTS, 'jaw_roundness':.65,'face_slim':.35,'corner_angle':.4,'corner_ratio':2})
    settings=engine.export_settings()
    before=[[v.co.copy() for v in k.data] for k in keys]
    engine.import_settings(settings)
    assert all(v.co==before[j][i] for j,k in enumerate(keys) for i,v in enumerate(k.data))
    engine.update(dict(engine.DEFAULTS))
    assert all(v.co==s['coords'][k.name][i] for k in keys for i,v in enumerate(k.data))
    assert all(v.co==original[k.name][i] for k in s['source'].data.shape_keys.key_blocks for i,v in enumerate(k.data))
    result={'passed':True,'independent_contour_controls':True,'eye_openings_fixed':True,'expression_deltas_preserved':True,'mirrored_angles':True,'exact_reset':True,'source_unchanged':True}
finally:
    engine.update(saved)
