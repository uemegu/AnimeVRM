"""Blender integration checks for independent eye/iris transforms."""
import math
import sys

engine = sys.modules['vroid_eye_editor']
s = engine.SESSION
saved = dict(s['params'])
checks = []
try:
    engine.update(dict(engine.DEFAULTS))
    basis = s['coords'][next(iter(s['coords']))]
    preview_keys = s['preview'].data.shape_keys.key_blocks
    for name, value in dict(iris_x=.6, iris_z=-.6, iris_width=.75, iris_height=1.25).items():
        engine.update({**engine.DEFAULTS, name: value})
        assert any((preview_keys[0].data[i].co-basis[i]).length > 1e-5 for i in s['iris_vertices']), name
        for key in preview_keys:
            assert all(p.co == s['coords'][key.name][i] for i,p in enumerate(key.data)
                       if i not in s['iris_vertices']), name
        checks.append(name + ': iris/highlight only')
    for name, value in dict(eye_x=.7, eye_z=.6, eye_width=1.2, eye_height=.8).items():
        engine.update({**engine.DEFAULTS, name: value})
        for eye in s['eyes']:
            for i in eye['loop']:
                original, actual = basis[i], preview_keys[0].data[i].co
                expected = original.copy()
                if name == 'eye_x': expected.x += eye['sign']*eye['width']*.15*value
                if name == 'eye_z': expected.z += eye['height']*.20*value
                if name == 'eye_width': expected.x = eye['center'].x+(original.x-eye['center'].x)*value
                if name == 'eye_height': expected.z = eye['center'].z+(original.z-eye['center'].z)*value
                assert (actual-expected).length < 2e-7, (name,i,actual,expected)
        checks.append(name + ': both eyelid boundaries follow exact transform')
    # Resize ratios and translations of the iris/highlight bounding box.
    for eye in s['eyes']:
        ids = [i for i in s['iris_vertices'] if basis[i].x*eye['sign'] > 0]
        engine.update({**engine.DEFAULTS, 'iris_width':.7, 'iris_height':1.3})
        for axis, ratio in ((0,.7),(2,1.3)):
            old = max(basis[i][axis] for i in ids)-min(basis[i][axis] for i in ids)
            new = max(preview_keys[0].data[i].co[axis] for i in ids)-min(preview_keys[0].data[i].co[axis] for i in ids)
            assert abs(new/old-ratio) < 2e-5
    combined = dict(flatness=.5, length=.8, thickness=.7, upper_peak=.5,
                    eye_x=.3, eye_z=.2, eye_width=1.1, eye_height=.9,
                    iris_x=-.2, iris_z=.15, iris_width=.8, iris_height=1.1)
    engine.update({**engine.DEFAULTS, **combined})
    for expression in ('none', 'happy'):
        engine.update(dict(expression=expression))
        for key in preview_keys:
            assert all(math.isfinite(v) for p in key.data for v in p.co)
            assert all(p.co == s['coords'][key.name][i] for i,p in enumerate(key.data)
                       if i not in s['editable'])
    engine.update(dict(engine.DEFAULTS))
    for key in preview_keys:
        assert all(p.co == s['coords'][key.name][i] for i,p in enumerate(key.data)), key.name
    for key in s['source'].data.shape_keys.key_blocks:
        assert all(p.co == s['coords'][key.name][i] for i,p in enumerate(key.data)), key.name
    result = dict(passed=True, checks=checks, iris_scale_ratios=True,
                  combined_expressions=True, exact_reset=True, source_unchanged=True)
finally:
    engine.update(saved)
