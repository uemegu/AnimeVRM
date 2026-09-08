"""Model-aware, reversible eye editing. Executed in Blender's main thread."""
import json
import math
import os
import tempfile
from collections import Counter, defaultdict
from datetime import datetime

import bpy
from mathutils import Quaternion, Vector

SESSION = globals().get('SESSION')


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
    SESSION = dict(source=source, preview=preview, eyes=eyes, movable=movable,
                   coords=original_coords, values=original_values,
                   hidden=source.hide_get(), render_hidden=source.hide_render,
                   params=dict(flatness=0.0, length=0.0, thickness=0.45, blink=0.0, before=False), lines=lines)
    SESSION['params'].update(params)
    source.hide_set(True)
    source.hide_render = True
    if not lines:
        make_lines()
    update(SESSION['params'])
    return status()


def warp(point, params):
    p = point.copy()
    amount = params['flatness']
    if not amount:
        return p
    basis = SESSION['coords'][next(iter(SESSION['coords']))]
    for eye in SESSION['eyes']:
        if p.x * eye['sign'] <= 0:
            continue
        lower = sorted([basis[i] for i in eye['lower']], key=lambda c: c.x)
        if not lower[0].x <= p.x <= lower[-1].x:
            continue
        for a, b in zip(lower, lower[1:]):
            if a.x <= p.x <= b.x:
                t = (p.x - a.x) / max(b.x - a.x, 1e-9)
                edge = a.lerp(b, t)
                break
        floor = min(v.z for v in lower) + eye['width'] * 0.16
        lift = max(0.0, floor - edge.z) * amount
        # A compact field shared by every expression: coincident closed lids
        # remain coincident, and the cheek transition has no hard boundary.
        distance = abs(p.z - edge.z) / (eye['width'] * (0.38 if p.z < edge.z else 0.13))
        depth = abs(p.y - edge.y) / (eye['width'] * 0.35)
        weight = max(0.0, 1 - distance * distance) ** 2 * max(0.0, 1 - depth * depth) ** 2
        p.z += lift * weight
        p.y -= lift * weight * 0.65
    return p


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
    s['params'].update(params)
    p = s['params']
    preview = s['preview']
    for key in preview.data.shape_keys.key_blocks:
        for i in s['movable']:
            key.data[i].co = warp(s['coords'][key.name][i], p)
        key.value = s['values'][key.name]
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
                width = p['thickness'] / 1000 * math.sin(math.pi * t) ** 0.45
                pos.y -= 0.00065
                key.data[j*2].co = pos - normal * width * .22
                key.data[j*2+1].co = pos + normal * width * .78
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
                expressions=len(SESSION['coords']))


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
        update(dict(blink=0.0, before=False))
        bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    finally:
        update(previous)
    return dict(path=path)
