"""Run in Blender; restore the user's current parameters even on failure."""
import sys
import math
engine = sys.modules['vroid_eye_editor']
s = engine.SESSION
saved = dict(s['params'])
try:
    engine.update(dict(engine.DEFAULTS))
    keys=s['preview'].data.shape_keys.key_blocks
    for name,value in dict(brow_x=.6,brow_z=.6,brow_peak=.7,brow_curve=.7).items():
        engine.update({**engine.DEFAULTS,name:value})
        assert any((keys[0].data[i].co-s['coords']['Basis'][i]).length>1e-5 for i in s['brow_vertices']), name
        for key in keys:
            assert all(p.co == s['coords'][key.name][i] for i,p in enumerate(key.data) if i not in s['brow_vertices']),name
            assert all(math.isfinite(v) for p in key.data for v in p.co)
    engine.update(dict(saved,brow_curve=.6,brow_peak=.5,brow_z=.4,expression='happy'))
    settings=engine.export_settings()
    expected={k:v for k,v in s['params'].items() if k in engine.settings_schema.DEFAULTS}
    engine.update(dict(engine.DEFAULTS))
    engine.import_settings(settings)
    assert all(s['params'][k]==v for k,v in expected.items())
    coords=[[p.co.copy() for p in key.data] for key in keys]
    engine.import_settings(settings)
    assert all(p.co==coords[j][i] for j,key in enumerate(keys) for i,p in enumerate(key.data))
    bad=engine.export_settings();bad['parameters']['brow_z']=100
    try: engine.import_settings(bad)
    except ValueError: pass
    else: raise AssertionError('Invalid import accepted')
    assert engine.export_settings()['parameters']==expected
    # Original expression deltas of the brow survive the edit (xz axes).
    basis=keys[0]
    for key in keys[1:]:
        for i in s['brow_vertices']:
            original_delta=s['coords'][key.name][i]-s['coords']['Basis'][i]
            delta=key.data[i].co-basis.data[i].co
            assert abs(delta.x-original_delta.x)<2e-7 and abs(delta.z-original_delta.z)<2e-7
    engine.update(dict(engine.DEFAULTS))
    assert all(p.co==s['coords'][key.name][i] for key in keys for i,p in enumerate(key.data))
    result=dict(passed=True,brow_vertices=len(s['brow_vertices']),independent_controls=True,
                roundtrip=True,repeat_import_identical=True,invalid_import_unchanged=True,
                expression_deltas_preserved=True,exact_reset=True)
finally:
    engine.update(saved)
