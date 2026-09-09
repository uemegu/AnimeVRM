"""Model-aware, reversible eye editing. Executed in Blender's main thread."""
import json
import math
import os
import tempfile
import importlib.util
from collections import Counter, defaultdict
from datetime import datetime

import bpy
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

SESSION = globals().get('SESSION')
_schema_spec = importlib.util.spec_from_file_location('eye_atelier_schema', os.path.join(os.path.dirname(__file__), 'settings_schema.py'))
settings_schema = importlib.util.module_from_spec(_schema_spec)
_schema_spec.loader.exec_module(settings_schema)
DEFAULTS = dict(settings_schema.DEFAULTS, blink=0.0, expression='none', before=False)


def boundary_loops(mesh, material):
    edges = Counter(tuple(sorted(e)) for p in mesh.polygons
                    if p.material_index == material for e in p.edge_keys)
    adjacent = defaultdict(set)
    for (a, b), count in edges.items():
        if count == 1:
            adjacent[a].add(b)
            adjacent[b].add(a)
    visited, loops = set(), []
    for seed in adjacent:
        if seed in visited:
            continue
        component, todo = [], [seed]
        while todo:
            i = todo.pop()
            if i in visited:
                continue
            visited.add(i)
            component.append(i)
            todo.extend(adjacent[i] - visited)
        if any(len(adjacent[i]) != 2 for i in component):
            continue
        ordered, prev, current = [seed], seed, min(adjacent[seed])
        while current != seed:
            ordered.append(current)
            prev, current = current, next(i for i in adjacent[current] if i != prev)
        loops.append(ordered)
    return loops


def detect(source):
    mesh = source.data
    skin = [i for i, m in enumerate(mesh.materials) if m and 'Face_00_SKIN' in m.name]
    iris = [i for i, m in enumerate(mesh.materials) if m and 'EyeIris' in m.name]
    if len(skin) != 1 or len(iris) != 1:
        raise ValueError('VRoidの顔・瞳マテリアルを特定できません。現在の試作版は標準名のモデル用です。')
    iris_ids = {v for p in mesh.polygons if p.material_index == iris[0] for v in p.vertices}
    loops = boundary_loops(mesh, skin[0])
    eyes = []
    for sign in (-1, 1):
        points = [mesh.vertices[i].co for i in iris_ids if mesh.vertices[i].co.x * sign > 0]
        center = sum(points, Vector()) / len(points)
        choices = [loop for loop in loops if 12 <= len(loop) <= 80
                   and all(mesh.vertices[i].co.x * sign > 0 for i in loop)]
        loop = min(choices, key=lambda c: (sum((mesh.vertices[i].co for i in c), Vector()) / len(c) - center).length)
        coords = [mesh.vertices[i].co for i in loop]
        width = max(p.x for p in coords) - min(p.x for p in coords)
        lc = sum(coords, Vector()) / len(coords)
        if (lc - center).length > width or not 0.005 < width < 0.1:
            raise ValueError('目の縁の検出に確信がありません。モデルの向き・大きさを確認してください。')
        inner = min(range(len(loop)), key=lambda j: abs(coords[j].x))
        outer = max(range(len(loop)), key=lambda j: abs(coords[j].x))
        paths = []
        for direction in (-1, 1):
            ids, j = [], inner
            while True:
                ids.append(loop[j])
                if j == outer:
                    break
                j = (j + direction) % len(loop)
            paths.append(ids)
        lower = min(paths, key=lambda p: sum(mesh.vertices[i].co.z for i in p) / len(p))
        upper = max(paths, key=lambda p: sum(mesh.vertices[i].co.z for i in p) / len(p))
        eyes.append(dict(loop=loop, lower=lower, upper=upper, width=width, center=lc, sign=sign))
    movable_materials = {skin[0]} | {i for i, m in enumerate(mesh.materials)
                                    if m and ('Eyeline' in m.name or 'Eyeliner' in m.name)}
    movable = {i for p in mesh.polygons if p.material_index in movable_materials for i in p.vertices}
    return eyes, movable


def initialize():
    global SESSION
    if SESSION:
        try:
            valid = (bpy.data.objects.get(SESSION['source'].name) == SESSION['source']
                     and bpy.data.objects.get(SESSION['preview'].name) == SESSION['preview']
                     and SESSION['source'].data == SESSION.get('source_mesh', SESSION['source'].data)
                     and len(SESSION['source'].data.vertices) == len(next(iter(SESSION['coords'].values()))))
        except ReferenceError:
            valid = False
        if not valid:
            SESSION = None
    if SESSION:
        upgrade_session()
        repair_expression_bindings()
        return status()
    if bpy.context.mode != 'OBJECT':
        raise ValueError('初回だけBlenderをオブジェクトモードにしてください。')
    source = bpy.data.objects.get('Face')
    if not source or source.type != 'MESH' or not source.data.shape_keys:
        raise ValueError('シェイプキーを持つFaceオブジェクトが見つかりません。')
    eyes, movable = detect(source)
    existing = [o for o in bpy.data.objects if o.get('eye_editor_role') == 'face']
    if len(existing) > 1:
        raise ValueError('編集対象が複数あります。一つのモデルを開いてください。')
    if existing:
        preview = existing[0]
        lines = sorted([o for o in bpy.data.objects if o.get('eye_editor_role') == 'line'],
                       key=lambda o: o['eye_editor_side'])
        if len(lines) != 2 or len(preview.data.vertices) != len(source.data.vertices):
            raise ValueError('保存した編集データの構造が変わっています。元のモデルから開始してください。')
        params = json.loads(preview.get('eye_editor_settings', '{}'))
    else:
        preview = source.copy()
        preview.data = source.data.copy()
        preview.name = 'EyeEditor.Preview'
        preview['eye_editor_preview'] = True
        preview['eye_editor_role'] = 'face'
        source.users_collection[0].objects.link(preview)
        lines, params = [], {}
    original_values = {k.name: k.value for k in source.data.shape_keys.key_blocks}
    original_coords = {k.name: [p.co.copy() for p in k.data] for k in source.data.shape_keys.key_blocks}
    SESSION = dict(source=source, source_mesh=source.data, preview=preview, eyes=eyes, movable=movable,
                   coords=original_coords, values=original_values,
                   hidden=source.hide_get(), render_hidden=source.hide_render,
                   params=dict(DEFAULTS), lines=lines)
    SESSION['params'].update(params)
    source.hide_set(True)
    source.hide_render = True
    if not lines:
        make_lines()
    upgrade_session()
    repair_expression_bindings()
    update(SESSION['params'])
    return status()


def upgrade_session():
    s = SESSION
    for name, value in DEFAULTS.items():
        s['params'].setdefault(name, value)
    basis = s['coords'][next(iter(s['coords']))]
    mesh = s['source'].data
    iris_mats = {i for i, m in enumerate(mesh.materials) if m and 'EyeIris' in m.name}
    detail_mats = iris_mats | {i for i, m in enumerate(mesh.materials) if m and 'EyeHighlight' in m.name}
    eye_mats = detail_mats | {i for i, m in enumerate(mesh.materials) if m and 'EyeWhite' in m.name}
    s['iris_vertices'] = {v for poly in mesh.polygons if poly.material_index in detail_mats for v in poly.vertices}
    s['eye_vertices'] = {v for poly in mesh.polygons if poly.material_index in eye_mats for v in poly.vertices}
    iris_only = {v for poly in mesh.polygons if poly.material_index in iris_mats for v in poly.vertices}
    brow_mats = {i for i,m in enumerate(mesh.materials) if m and 'FaceBrow' in m.name}
    s['brow_vertices'] = {v for poly in mesh.polygons if poly.material_index in brow_mats for v in poly.vertices}
    skin_faces = [list(poly.vertices) for poly in mesh.polygons
                  if mesh.materials[poly.material_index] and 'Face_00_SKIN' in mesh.materials[poly.material_index].name]
    s['skin_surface'] = BVHTree.FromPolygons(basis, skin_faces)
    s['skin_front'] = min(p.y for p in basis)-.1
    s['editable'] = s['movable'] | s['eye_vertices'] | s['brow_vertices']
    for eye in s['eyes']:
        eye['lower_points'] = sorted([basis[i] for i in eye['lower']], key=lambda c: c.x)
        eye['upper_points'] = sorted([basis[i] for i in eye['upper']], key=lambda c: abs(c.x))
        eye['inner_x'] = abs(eye['upper_points'][0].x)
        peak = max(eye['upper_points'], key=lambda c: c.z)
        eye['peak_t'] = (abs(peak.x) - eye['inner_x']) / eye['width']
        points = [basis[i] for i in eye['loop']]
        eye['height'] = max(p.z for p in points) - min(p.z for p in points)
        iris = [basis[i] for i in iris_only if basis[i].x * eye['sign'] > 0]
        eye['iris_center'] = Vector([(min(p[j] for p in iris)+max(p[j] for p in iris))/2 for j in range(3)])
        brow = [basis[i] for i in s['brow_vertices'] if basis[i].x * eye['sign'] > 0]
        if brow:
            xmin, xmax = min(abs(p.x) for p in brow), max(abs(p.x) for p in brow)
            eye['brow_min'], eye['brow_width'] = xmin, xmax-xmin
            # Centerline samples group the two edges of the eyebrow strip.
            groups = []
            for point in sorted(brow, key=lambda p:abs(p.x)):
                if not groups or abs(point.x)-abs(groups[-1][0].x) > (xmax-xmin)*.035:
                    groups.append([])
                groups[-1].append(point)
            eye['brow_profile'] = [sum(group,Vector())/len(group) for group in groups]


def position_brow(point, reference, eye, params):
    p = point.copy()
    if not any(params[k] for k in ('brow_x','brow_z','brow_peak','brow_curve')):
        return p
    width = eye['brow_width']
    t = min(1.0,max(0.0,(abs(reference.x)-eye['brow_min'])/width))
    peak = .5 + params['brow_peak']*.3
    old_t = t*.5/peak if t <= peak else .5+(t-peak)*.5/(1-peak)
    profile = eye['brow_profile']
    old = interpolate(profile,abs(reference.x),absolute=True)
    remapped = interpolate(profile,eye['brow_min']+old_t*width,absolute=True)
    # Add a smooth arch with zero displacement/slope at its ends and peak.
    phase = t/peak if t<=peak else (1-t)/(1-peak)
    arch = phase*phase*(3-2*phase)
    if params['brow_peak']:
        p.z += remapped.z-old.z
    p.z += width*.20*params['brow_curve']*arch + eye['height']*.35*params['brow_z']
    p.x += eye['sign']*eye['width']*.20*params['brow_x']
    # Preserve the original depth relative to skin as the brow moves across
    # the curved forehead. Never bake a Shrinkwrap modifier into the mesh.
    surface = SESSION['skin_surface']
    old_hit = surface.ray_cast(Vector((point.x,SESSION['skin_front'],point.z)), Vector((0,1,0)))[0]
    new_hit = surface.ray_cast(Vector((p.x,SESSION['skin_front'],p.z)), Vector((0,1,0)))[0]
    if old_hit is not None and new_hit is not None:
        p.y += new_hit.y-old_hit.y
    return p


def export_settings():
    if not SESSION:
        raise ValueError('先にモデルへ接続してください。')
    upgrade_session()
    return settings_schema.export_document(SESSION['params'])


def import_settings(document):
    params = settings_schema.import_document(document)
    if not SESSION:
        raise ValueError('先にモデルへ接続してください。')
    previous = dict(SESSION['params'])
    try:
        return update(dict(params, blink=0.0, expression='none', before=False))
    except Exception:
        update(previous)
        raise


def smooth_falloff(value, full, end):
    t = min(1.0, max(0.0, (value-full)/(end-full)))
    return 1-t*t*(3-2*t)


def position_iris(point, eye, params):
    """Iris and highlight share a center; apply before the whole-eye transform."""
    p = point.copy()
    if any(params[k] != DEFAULTS[k] for k in ('iris_x', 'iris_z', 'iris_width', 'iris_height')):
        center = eye['iris_center']
        p.x = center.x + (p.x-center.x)*params['iris_width'] + eye['sign']*eye['width']*.20*params['iris_x']
        p.z = center.z + (p.z-center.z)*params['iris_height'] + eye['height']*.20*params['iris_z']
    return p


def position_eye(point, eye, params, rigid=False, reference=None):
    """Affine transform inside the opening, smooth falloff into facial skin.

    Skin weights use the original expression position, independent of other
    sliders. The nose centerline is fixed. Eye meshes/line ribbons move fully.
    """
    p = point.copy()
    if all(params[k] == DEFAULTS[k] for k in ('eye_x', 'eye_z', 'eye_width', 'eye_height')):
        return p
    center = eye['center']
    weight = 1.0
    if not rigid:
        ref = reference if reference is not None else point
        radius = math.hypot((ref.x-center.x)/(eye['width']*.80),
                            (ref.z-center.z)/(eye['height']*.95))
        weight = smooth_falloff(radius, 1.0, 1.65)
        weight *= smooth_falloff(abs(ref.y-center.y)/eye['width'], .50, 1.10)
        weight *= 1-smooth_falloff(abs(ref.x), 0.0, eye['inner_x']*.75)
    p.x += ((p.x-center.x)*(params['eye_width']-1) + eye['sign']*eye['width']*.15*params['eye_x'])*weight
    p.z += ((p.z-center.z)*(params['eye_height']-1) + eye['height']*.20*params['eye_z'])*weight
    return p


def interpolate(points, coordinate, absolute=False):
    axis = (lambda p: abs(p.x)) if absolute else (lambda p: p.x)
    if coordinate <= axis(points[0]):
        return points[0]
    for a, b in zip(points, points[1:]):
        if coordinate <= axis(b):
            return a.lerp(b, (coordinate - axis(a)) / max(axis(b) - axis(a), 1e-9))
    return points[-1]


def warp(point, params):
    p = point.copy()
    amount = params['flatness']
    peak_shift = params.get('upper_peak', 0.0)
    if not amount and not peak_shift:
        return p
    for eye in SESSION['eyes']:
        if p.x * eye['sign'] <= 0:
            continue
        lower = eye['lower_points']
        if not lower[0].x <= p.x <= lower[-1].x:
            continue
        edge = interpolate(lower, p.x)
        floor = min(v.z for v in lower) + eye['width'] * 0.16
        lift = max(0.0, floor - edge.z) * amount
        # A compact field shared by every expression: coincident closed lids
        # remain coincident, and the cheek transition has no hard boundary.
        distance = abs(p.z - edge.z) / (eye['width'] * (0.38 if p.z < edge.z else 0.13))
        depth = abs(p.y - edge.y) / (eye['width'] * 0.35)
        weight = max(0.0, 1 - distance * distance) ** 2 * max(0.0, 1 - depth * depth) ** 2
        p.z += lift * weight
        p.y -= lift * weight * 0.65
        if peak_shift:
            # Resample the upper profile around a movable apex. Endpoints stay
            # fixed. Evaluate the same field for every expression to preserve
            # coincident closed-lid positions; iris/white are excluded by caller.
            upper = eye['upper_points']
            t = (abs(point.x) - eye['inner_x']) / eye['width']
            original_peak = eye['peak_t']
            target_peak = max(.15, min(.85, original_peak + peak_shift * .25))
            old_t = (t * original_peak / target_peak if t < target_peak else
                     original_peak + (t-target_peak) * (1-original_peak) / (1-target_peak))
            edge_upper = interpolate(upper, abs(point.x), absolute=True)
            target = interpolate(upper, eye['inner_x'] + old_t * eye['width'], absolute=True)
            distance = abs(point.z-edge_upper.z) / (eye['width'] * (.50 if point.z >= edge_upper.z else .25))
            depth = abs(point.y-edge_upper.y) / (eye['width'] * .50)
            influence = max(0.0, 1-distance*distance)**2 * max(0.0, 1-depth*depth)**2
            p.z += (target.z-edge_upper.z) * influence
    return p


def expression_collections():
    armature = SESSION['source'].find_armature()
    if not armature or not hasattr(armature.data, 'vrm_addon_extension'):
        return []
    ext = armature.data.vrm_addon_extension
    if ext.spec_version == '1.0':
        return [(name, expression.morph_target_binds, 'node')
                for name, expression in ext.vrm1.expressions.all_name_to_expression_dict().items()]
    return [(g.preset_name if g.preset_name != 'unknown' else g.name, g.binds, 'mesh')
            for g in ext.vrm0.blend_shape_master.blend_shape_groups]


def repair_expression_bindings():
    """Redirect source binds, preserving key/weight and unrelated expressions.

    Explicit line binds are necessary: Blender drivers are not VRM expressions.
    Repeated calls are idempotent, including reopening an edited .blend file.
    """
    s = SESSION
    source, preview = s['source'], s['preview']
    repaired = 0
    for _, binds, attr in expression_collections():
        for bind in list(binds):
            if getattr(bind, attr).mesh_object_name == source.name:
                getattr(bind, attr).mesh_object_name = preview.name
                repaired += 1
        face_binds = [b for b in binds if getattr(b, attr).mesh_object_name == preview.name]
        for bind in face_binds:
            for line in s['lines']:
                if bind.index not in line.data.shape_keys.key_blocks:
                    continue
                match = next((b for b in binds if getattr(b, attr).mesh_object_name == line.name
                              and b.index == bind.index), None)
                if match is None:
                    match = binds.add()
                    getattr(match, attr).mesh_object_name = line.name
                    match.index = bind.index
                    repaired += 1
                if match.weight != bind.weight:
                    match.weight = bind.weight
    # Preserve first-person visibility semantics where the source was listed.
    armature = source.find_armature()
    if armature and hasattr(armature.data, 'vrm_addon_extension'):
        ext = armature.data.vrm_addon_extension
        if ext.spec_version == '1.0':
            annotations = ext.vrm1.first_person.mesh_annotations
            for annotation in list(annotations):
                if annotation.node.mesh_object_name == source.name:
                    annotation.node.mesh_object_name = preview.name
                if annotation.node.mesh_object_name == preview.name:
                    for line in s['lines']:
                        if not any(a.node.mesh_object_name == line.name for a in annotations):
                            a = annotations.add()
                            a.node.mesh_object_name = line.name
                            a.type = annotation.type
    return repaired


def line_width(u, t, params):
    # u=0 is the upper lid, u=4/6 the inner corner. Keep the profile
    # anchored to this landmark even when the line length changes.
    inner = min(1.0, max(0.0, u / (4/6)))
    smooth = inner * inner * (3 - 2 * inner)
    ratio = 1 - (1 - params.get('corner_ratio', .18)) * smooth
    taper = max(0.0, math.sin(math.pi * t)) ** .25
    return params['thickness'] / 1000 * ratio * taper


def make_lines():
    s = SESSION
    material = bpy.data.materials.new('EyeEditor.InnerLine')
    material.diffuse_color = (0.018, 0.009, 0.008, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = material.diffuse_color
    output = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
    for eye in s['eyes']:
        mesh = bpy.data.meshes.new('EyeEditor.LineMesh')
        mesh.from_pydata([(0, 0, 0)] * 66, [], [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(32)])
        obj = bpy.data.objects.new('EyeEditor.InnerLine', mesh)
        obj['eye_editor_preview'] = True
        obj['eye_editor_role'] = 'line'
        obj['eye_editor_side'] = eye['sign']
        s['preview'].users_collection[0].objects.link(obj)
        obj.parent = s['preview'].parent
        obj.matrix_world = s['preview'].matrix_world.copy()
        obj.data.materials.append(material)
        for group in s['source'].vertex_groups:
            obj.vertex_groups.new(name=group.name)
        for index, name in enumerate(s['coords']):
            key = obj.shape_key_add(name=name, from_mix=False)
            if index:
                driver = key.driver_add('value').driver
                driver.type = 'AVERAGE'
                variable = driver.variables.new()
                variable.name = 'expression'
                variable.type = 'SINGLE_PROP'
                variable.targets[0].id_type = 'KEY'
                variable.targets[0].id = s['preview'].data.shape_keys
                variable.targets[0].data_path = s['preview'].data.shape_keys.key_blocks[name].path_from_id('value')
        for mod in s['source'].modifiers:
            if mod.type == 'ARMATURE':
                arm = obj.modifiers.new('Armature', 'ARMATURE')
                arm.object = mod.object
        s['lines'].append(obj)


def line_sample(eye, coords, u):
    # Trace the actual eyelid from the inner upper arc, through the inner corner,
    # to the lower inner arc. No hand-entered model vertex indices.
    path = list(reversed(eye['upper'][:5])) + eye['lower'][1:3]
    f = max(0.0, min(len(path)-1.000001, u * (len(path)-1)))
    j, t = int(f), f % 1
    return coords[path[j]].lerp(coords[path[j+1]], t), path[j], path[j+1], t


def update(params):
    s = SESSION
    if not s:
        raise ValueError('先にモデルへ接続してください。')
    upgrade_session()
    if 'expression' in params and params['expression'] not in {'none'} | {n for n, _, _ in expression_collections()}:
        raise ValueError('このモデルには指定された表情がありません。')
    s['params'].update(params)
    p = s['params']
    preview = s['preview']
    for key in preview.data.shape_keys.key_blocks:
        for i in s['editable']:
            original = s['coords'][key.name][i]
            reference = s['coords'][next(iter(s['coords']))][i]
            eye = s['eyes'][0] if reference.x < 0 else s['eyes'][1]
            if i in s['brow_vertices']:
                key.data[i].co = position_brow(original, reference, eye, p)
                continue
            point = warp(original, p) if i in s['movable'] else original.copy()
            if i in s['iris_vertices']:
                point = position_iris(point, eye, p)
            key.data[i].co = position_eye(point, eye, p, rigid=i in s['eye_vertices'], reference=original)
        key.value = s['values'][key.name]
    for name, binds, attr in expression_collections():
        if name == p['expression']:
            for bind in binds:
                if getattr(bind, attr).mesh_object_name == preview.name:
                    key = preview.data.shape_keys.key_blocks.get(bind.index)
                    if key:
                        key.value = bind.weight
    close = preview.data.shape_keys.key_blocks.get('Fcl_EYE_Close')
    if close:
        close.value = p['blink']
    for eye, obj in zip(s['eyes'], s['lines']):
        for key in obj.data.shape_keys.key_blocks:
            coords = s['coords'][key.name]
            for j in range(33):
                t = j / 32
                # Length zero hides this whole object; increasing it traces
                # more of the existing opening, without moving the eye itself.
                u = 0.06 + t * p['length'] * 0.91
                pos, ia, ib, blend = line_sample(eye, coords, u)
                pos = warp(pos, p)
                prev = warp(line_sample(eye, coords, max(0, u - .005))[0], p)
                nxt = warp(line_sample(eye, coords, min(1, u + .005))[0], p)
                tangent = nxt - prev
                normal = Vector((-tangent.z, 0, tangent.x)).normalized()
                if normal.dot(pos - eye['center']) < 0:
                    normal.negate()
                width = line_width(u, t, p)
                pos.y -= 0.00065
                key.data[j*2].co = position_eye(pos - normal * width * .22, eye, p, rigid=True)
                key.data[j*2+1].co = position_eye(pos + normal * width * .78, eye, p, rigid=True)
                if key == obj.data.shape_keys.key_blocks[0]:
                    weights = defaultdict(float)
                    for idx, w in ((ia, 1-blend), (ib, blend)):
                        for g in s['source'].data.vertices[idx].groups:
                            weights[g.group] += g.weight * w
                    for group in obj.vertex_groups:
                        group.remove([j*2, j*2+1])
                    for group, weight in weights.items():
                        obj.vertex_groups[group].add([j*2, j*2+1], weight, 'REPLACE')
            key.value = preview.data.shape_keys.key_blocks[key.name].value
        obj.hide_set(p['before'] or p['length'] == 0 or p['thickness'] == 0)
        obj.hide_render = obj.hide_get()
        obj.data.update()
    s['source'].hide_set(not p['before'])
    s['source'].hide_render = not p['before']
    preview.hide_set(p['before'])
    preview.hide_render = p['before']
    preview.data.update()
    preview['eye_editor_settings'] = json.dumps(p)
    bpy.context.view_layer.update()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.tag_redraw()
    return status()


def status():
    if not SESSION:
        return dict(connected=False)
    return dict(connected=True, model=SESSION['source'].name,
                params=SESSION['params'], eye_vertices=[len(e['loop']) for e in SESSION['eyes']],
                expressions=len(SESSION['coords']),
                expression_names=[n for n, binds, _ in expression_collections() if len(binds)])


def view(angle=0, zoom=1):
    areas = [a for a in bpy.context.window.screen.areas if a.type == 'VIEW_3D']
    if not areas:
        raise ValueError('Blenderに3Dビューが必要です。Layoutタブを開いてください。')
    area = max(areas, key=lambda a: a.width*a.height)
    space = area.spaces.active
    center = sum((e['center'] for e in SESSION['eyes']), Vector()) / 2
    center.z -= 0.018
    space.region_3d.view_location = SESSION['preview'].matrix_world @ center
    space.region_3d.view_rotation = Quaternion((0, 0, 1), math.radians(angle)) @ Quaternion((1, 0, 0), math.pi/2)
    space.region_3d.view_distance = 0.32 / zoom
    space.region_3d.view_perspective = 'ORTHO'
    space.overlay.show_overlays = False
    area.tag_redraw()
    return dict(ok=True)


def screenshot():
    area = max((a for a in bpy.context.window.screen.areas if a.type == 'VIEW_3D'), key=lambda a: a.width*a.height)
    fd, path = tempfile.mkstemp(suffix='.png', prefix='eye-editor-')
    os.close(fd)
    try:
        with bpy.context.temp_override(window=bpy.context.window, area=area):
            bpy.ops.screen.screenshot_area(filepath=path)
        return dict(path=path)
    except Exception:
        os.unlink(path)
        raise


def save(directory):
    # Copy saves never change the user's current .blend destination.
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, 'eye-edit-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.blend')
    previous = dict(SESSION['params'])
    try:
        repair_expression_bindings()
        update(dict(blink=0.0, expression='none', before=False))
        bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    finally:
        update(previous)
    return dict(path=path)


def export_vrm(directory):
    """Use the installed VRM exporter, then validate its serialized bindings."""
    import importlib.util
    s = SESSION
    armature = s['source'].find_armature()
    if not armature or not hasattr(armature.data, 'vrm_addon_extension'):
        raise ValueError('VRMアドオンのArmatureを特定できません。')
    if armature.data.vrm_addon_extension.spec_version != '1.0':
        raise ValueError('ブラウザからのVRM書き出しは現在VRM 1.0に対応しています。')
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, 'eye-edit-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.vrm')
    previous = dict(s['params'])
    arm_hidden = (armature.hide_get(), armature.hide_viewport)
    try:
        repair_expression_bindings()
        update(dict(blink=0.0, expression='none', before=False))
        armature.hide_viewport = False
        armature.hide_set(False)
        # Export with no preview expression baked as the initial mesh weights.
        for key in s['preview'].data.shape_keys.key_blocks[1:]:
            key.value = 0.0
        bpy.context.view_layer.update()
        expected = {name: [(getattr(b, attr).mesh_object_name, b.index, b.weight) for b in binds
                           if getattr(b, attr).mesh_object_name == s['preview'].name
                           or (getattr(b, attr).mesh_object_name in {o.name for o in s['lines']}
                               and s['params']['length'] > 0 and s['params']['thickness'] > 0)]
                    for name, binds, attr in expression_collections()}
        outcome = bpy.ops.export_scene.vrm(filepath=path, armature_object_name=armature.name,
                    use_addon_preferences=False, export_invisibles=False, export_only_selections=False,
                    export_gltf_animations=False, export_try_sparse_sk=False)
        if 'FINISHED' not in outcome or not os.path.isfile(path):
            raise RuntimeError('VRM書き出しが完了しませんでした。BlenderのVRM検証エラーを確認してください。')
        spec = importlib.util.spec_from_file_location('eye_editor_verify_vrm', os.path.join(os.path.dirname(__file__), 'verify_vrm.py'))
        verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verifier)
        report = verifier.verify(path, expected, s['source'].name)
        return dict(path=path, validation=report)
    finally:
        armature.hide_viewport = arm_hidden[1]
        armature.hide_set(arm_hidden[0])
        update(previous)
