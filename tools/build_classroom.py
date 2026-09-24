"""Rebuild the explorable school classroom and export its GLB/previews.

Run with Blender in background mode against school-environments.blend:
  Blender -b public/models/school-environments/school-environments.blend \
    --python tools/build_classroom.py

The corridor collection is left intact.  Classroom pieces stay separate and
editable in the .blend; a temporary joined copy is exported for the viewer.
"""

import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(bpy.data.filepath).parent
TEXTURES = ROOT / "textures"
W, L, H = 12.8, 14.8, 4.2
XW, YW = W / 2, L / 2
ROOM_SCALE = (0.70, 0.72, 0.85)
DESK_COLUMNS = (-4.35, -2.75, -1.20, 1.20, 2.75, 4.35)
DESK_ROWS = (-5.0, -3.32, -1.64, 0.04, 1.72, 3.40)
# Blackboard center height before ROOM_SCALE (the viewer's chalk layer follows it).
BOARD_Z = 2.05
scene = bpy.context.scene

# Remove the previous classroom before creating fresh materials, keeping the
# separate corridor assets untouched. This also makes repeated builds stable.
for obj in list(scene.objects):
    if obj.name.startswith('Classroom |') or obj.name.startswith('School Classroom Far2 |'):
        bpy.data.objects.remove(obj, do_unlink=True)
for name in ('CLASSROOM | rebuilt', 'CAMERA AND LIGHT | rebuilt'):
    old = bpy.data.collections.get(name)
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
bpy.ops.outliner.orphans_purge(do_recursive=True)
COLLECTION = bpy.data.collections.new('CLASSROOM | rebuilt')
CAMERAS = bpy.data.collections.new('CAMERA AND LIGHT | rebuilt')
scene.collection.children.link(COLLECTION)
scene.collection.children.link(CAMERAS)


def rgba(hex_color, alpha=1.0):
    hex_color = hex_color.lstrip('#')
    rgb = tuple(int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (*rgb, alpha)


def warm_texture(source, output, dark_hex, light_hex):
    """Recolor a cool painted texture into a warm afternoon palette.

    Luminance keeps the brush detail; the two colors set the new range.
    """
    import numpy as np
    image = bpy.data.images.load(str(TEXTURES / source), check_existing=False)
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    luminance = pixels[..., :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lo, hi = np.percentile(luminance, (1, 99))
    t = np.clip((luminance - lo) / max(hi - lo, 1e-4), 0.0, 1.0)[..., None]
    dark = np.array(rgba(dark_hex)[:3], dtype=np.float32)
    light = np.array(rgba(light_hex)[:3], dtype=np.float32)
    pixels[..., :3] = dark + (light - dark) * t
    warm = bpy.data.images.new(output, width, height, alpha=True)
    warm.pixels.foreach_set(pixels.ravel())
    warm.filepath_raw = str(TEXTURES / output)
    warm.file_format = 'PNG'
    warm.save()
    bpy.data.images.remove(warm)
    bpy.data.images.remove(image)
    return output


WALL_TEXTURE = warm_texture("wall-plaster-cel.png", "wall-plaster-warm-cel.png", "dfd2bf", "f7f1e6")
FLOOR_TEXTURE = warm_texture("floor-tile-cel.png", "floor-tile-warm-cel.png", "9a8b77", "ddd3c2")


def material(name, color, texture=None, alpha=1.0, roughness=0.78,
             emission=0.0, texture_alpha=False):
    mat = bpy.data.materials.new(f"MToon | {name}")
    mat.diffuse_color = rgba(color, alpha)
    mat.use_nodes = True
    mat.use_backface_culling = False
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = rgba(color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Alpha"].default_value = alpha
    if emission:
        shader.inputs["Emission Color"].default_value = rgba(color)
        shader.inputs["Emission Strength"].default_value = emission
    mat.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    if texture:
        node = nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(TEXTURES / texture), check_existing=True)
        node.image.pack()
        mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
        if texture_alpha:
            mat.node_tree.links.new(node.outputs["Alpha"], shader.inputs["Alpha"])
    if alpha < 1.0 or texture_alpha:
        mat.surface_render_method = 'DITHERED'
    mat["mtoon_shade_color_factor"] = [0.52, 0.57, 0.64]
    return mat


M = {
    "wall": material("warm cream plaster", "f1e9dc", WALL_TEXTURE),
    "lower": material("porcelain wainscot", "d3cbbb"),
    "trim": material("silver window trim", "aab3b6"),
    "dark_trim": material("dark window metal", "6d767b"),
    "floor": material("ceramic floor tile", "d8cfbf", FLOOR_TEXTURE),
    "ceiling": material("matte ceiling", "f0ebe2"),
    "ceiling_seam": material("ceiling panel seams", "d3ccc0"),
    "window": material("daylight glass", "c8e7f5", alpha=0.27, roughness=0.12),
    "door": material("classroom sliding door", "cdbfa6"),
    "wood": material("sunlit honey wood", "d6a06d", "desk-wood-cel.png", roughness=0.82),
    "wood_dark": material("warm walnut edge", "976b4a"),
    "wood_light": material("beech cabinet", "dbc09a"),
    "metal": material("silver painted steel", "9aa4aa", roughness=0.45),
    "metal_dark": material("dark seat support", "5b6468"),
    "board": material("blank deep green board", "244c43", "chalkboard-blank-cel.png"),
    "cork": material("warm notice cork", "aa7954"),
    "poster": material("school bulletin posters", "ffffff", "classroom-posters-cel.png", texture_alpha=True),
    "paper": material("unwritten paper", "f2eee4"),
    "green": material("leaf green", "70a472"),
    "green_dark": material("deep leaf green", "4a7c64"),
    "soil": material("pot soil", "6d5c4a"),
    "pot": material("ceramic planter", "e8d7b8"),
    "light": material("fluorescent warm white", "ecfaff", roughness=0.2, emission=1.9),
    "outside_window": material("neighboring school windows", "9ebbd0"),
    "book_blue": material("blue textbook", "6e9bb4"),
    "book_red": material("coral textbook", "c88987"),
    "book_green": material("green textbook", "8aa997"),
    "curtain": material("sheer linen curtain", "f6f0e1", alpha=0.7),
    "hall_floor": material("corridor stone", "b5ad9f"),
}
DESK_TOP_MATERIALS = tuple(
    material(f"varnished desk top {i + 1}", "d6a06d", "desk-wood-cel.png", roughness=roughness)
    for i, roughness in enumerate((0.25, 0.38, 0.52, 0.68))
)


# Furniture is modelled at true size in final coordinates, so the room-wide
# ROOM_SCALE squash never distorts round pipes or desk proportions.
FINAL_SPACE = [False]


def link_new(obj, name):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    COLLECTION.objects.link(obj)
    obj["classroom_export"] = True
    obj["final_space"] = FINAL_SPACE[0]
    return obj


def box(name, center, size, mat, bevel=0.0, uv_scale=(1, 1), yaw=0.0, tilt=0.0, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = link_new(bpy.context.object, name)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = (tilt, 0.0, yaw)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        for loop_idx in face.loop_indices:
            uv = obj.data.uv_layers.active.data[loop_idx].uv
            uv.x *= uv_scale[0]
            uv.y *= uv_scale[1]
    if bevel:
        modifier = obj.modifiers.new("Soft manufactured edges", 'BEVEL')
        modifier.width = bevel
        modifier.segments = segments
        modifier.affect = 'EDGES'
        obj.modifiers.new("Weighted face normals", 'WEIGHTED_NORMAL')
    return obj


def rounded_path(points, radius):
    # Replace each interior corner with a short arc, like bent steel tube.
    points = [Vector(p) for p in points]
    result = [points[0]]
    for a, b, c in zip(points, points[1:], points[2:]):
        r = min(radius, (b - a).length * 0.45, (c - b).length * 0.45)
        start = b + (a - b).normalized() * r
        end = b + (c - b).normalized() * r
        for i in range(5):
            t = i / 4
            result.append(start * (1 - t) ** 2 + b * 2 * t * (1 - t) + end * t * t)
    result.append(points[-1])
    return result


def pipe(name, points, radius, mat, bend=0.045):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
    path = rounded_path(points, bend)
    spline = curve.splines.new('POLY')
    spline.points.add(len(path) - 1)
    for point, co in zip(spline.points, path):
        point.co = (*co, 1.0)
    temp = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(temp)
    bpy.context.view_layer.update()
    mesh = bpy.data.meshes.new_from_object(temp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(temp, do_unlink=True)
    bpy.data.curves.remove(curve)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.clear()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    COLLECTION.objects.link(obj)
    obj["classroom_export"] = True
    obj["final_space"] = FINAL_SPACE[0]
    return obj


def cylinder(name, center, radius, depth, mat, vertices=24, rotate_x=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = link_new(bpy.context.object, name)
    obj.rotation_euler.x = rotate_x
    obj.data.materials.append(mat)
    return obj


def wall_image(name, y, x, z, width, height, mat, uv=(0, 0, 1, 1)):
    # UV ranges select an individual picture from the 3 by 3 poster atlas.
    verts = [(x - width / 2, y, z - height / 2),
             (x + width / 2, y, z - height / 2),
             (x + width / 2, y, z + height / 2),
             (x - width / 2, y, z + height / 2)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new()
    u0, v0, u1, v1 = uv
    for idx, coord in enumerate(((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        uv_layer.data[idx].uv = coord
    obj = bpy.data.objects.new(name, mesh)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(mat)
    obj["classroom_export"] = True
    return obj


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def desk(x, y, row, col):
    """A Japanese school desk and chair at true size (65 x 45 cm top)."""
    prefix = f"Desk {row + 1:02d}-{col + 1:02d}"
    cx, cy = x * ROOM_SCALE[0], y * ROOM_SCALE[1]
    FINAL_SPACE[0] = True
    # The class faces +Y; the book box opens toward the student's chair at -Y.
    top_material = DESK_TOP_MATERIALS[(row * 3 + col * 5) % len(DESK_TOP_MATERIALS)]
    box(prefix + " / tabletop", (cx, cy, 0.708), (0.65, 0.45, 0.024), top_material, 0.009, segments=3)
    box(prefix + " / edge band", (cx, cy, 0.706), (0.656, 0.456, 0.011), M["wood_dark"], 0.004)
    box(prefix + " / top frame", (cx, cy, 0.683), (0.60, 0.40, 0.026), M["metal"], 0.004)
    box(prefix + " / book box floor", (cx, cy + 0.02, 0.585), (0.56, 0.34, 0.008), M["metal"])
    box(prefix + " / book box back", (cx, cy + 0.19, 0.628), (0.56, 0.008, 0.094), M["metal"])
    for side in (-1, 1):
        box(prefix + " / book box side", (cx + side * 0.28, cy + 0.02, 0.628),
            (0.008, 0.34, 0.094), M["metal"])
        lx = cx + side * 0.295
        for dy in (-0.19, 0.19):
            pipe(prefix + " / desk leg", [(lx, cy + dy, 0.67), (lx, cy + dy, 0.012)], 0.012, M["metal"])
            box(prefix + " / leg cap", (lx, cy + dy, 0.012), (0.03, 0.03, 0.024), M["metal_dark"], 0.006)
        pipe(prefix + " / side stretcher", [(lx, cy - 0.19, 0.13), (lx, cy + 0.19, 0.13)], 0.009, M["metal"])
    pipe(prefix + " / foot rest", [(cx - 0.295, cy + 0.19, 0.13), (cx + 0.295, cy + 0.19, 0.13)],
         0.009, M["metal"])
    box(prefix + " / bag hook", (cx + 0.315, cy - 0.05, 0.64), (0.012, 0.02, 0.05), M["metal_dark"], 0.004)

    # Chairs are left slightly askew, as students leave them.
    jitter = math.sin(row * 12.9898 + col * 78.233) * 43758.5453
    jitter -= math.floor(jitter)
    yaw = (jitter - 0.5) * 0.16
    sx, sy = cx + (jitter - 0.5) * 0.05, cy - 0.47 - jitter * 0.06
    cos_a, sin_a = math.cos(yaw), math.sin(yaw)

    def at(dx, dy, z):
        return (sx + dx * cos_a - dy * sin_a, sy + dx * sin_a + dy * cos_a, z)

    box(prefix + " / seat", at(0, 0, 0.415), (0.40, 0.38, 0.02), M["wood"], 0.008, yaw=yaw, segments=3)
    box(prefix + " / backrest", at(0, -0.205, 0.695), (0.38, 0.018, 0.16), M["wood"], 0.007,
        yaw=yaw, tilt=0.12, segments=3)
    for side in (-1, 1):
        px = side * 0.185
        pipe(prefix + " / chair front frame",
             [at(px, 0.17, 0.012), at(px, 0.17, 0.395), at(px, -0.16, 0.395)], 0.011, M["metal"])
        pipe(prefix + " / chair rear frame",
             [at(px, -0.19, 0.012), at(px, -0.175, 0.395), at(px, -0.225, 0.79)], 0.011, M["metal"])
        box(prefix + " / leg cap", at(px, 0.17, 0.012), (0.028, 0.028, 0.024), M["metal_dark"], 0.006, yaw=yaw)
        box(prefix + " / leg cap", at(px, -0.19, 0.012), (0.028, 0.028, 0.024), M["metal_dark"], 0.006, yaw=yaw)
    for dy in (0.15, -0.15):
        pipe(prefix + " / seat stretcher", [at(-0.185, dy, 0.38), at(0.185, dy, 0.38)], 0.009, M["metal"])
    # A few objects on desks make the room feel used without obstructing play.
    if (row, col) in {(0, 1), (1, 4), (2, 2), (3, 0), (4, 5), (5, 3)}:
        book_mat = [M["book_blue"], M["book_red"], M["book_green"]][(row + col) % 3]
        box(prefix + " / exercise book", (cx - 0.12, cy + 0.04, 0.727), (0.18, 0.257, 0.012), book_mat,
            0.003, yaw=0.15)
    FINAL_SPACE[0] = False


def teacher_lectern(cx, cy):
    """A wooden lectern (kyotaku) facing the class, open on the teacher's side."""
    FINAL_SPACE[0] = True
    box("Teacher desk top", (cx, cy, 0.935), (0.98, 0.60, 0.035), DESK_TOP_MATERIALS[1], 0.01, segments=3)
    box("Teacher desk top edge", (cx, cy, 0.932), (0.986, 0.606, 0.014), M["wood_dark"], 0.004)
    for side in (-1, 1):
        box("Teacher desk side panel", (cx + side * 0.45, cy, 0.46), (0.03, 0.54, 0.88), M["wood_light"], 0.006)
    box("Teacher desk front panel", (cx, cy - 0.26, 0.47), (0.87, 0.022, 0.86), M["wood_light"], 0.004)
    box("Teacher desk front inset", (cx, cy - 0.274, 0.50), (0.72, 0.008, 0.56), M["wood"], 0.003)
    for z in (0.21, 0.79):
        box("Teacher desk front rail", (cx, cy - 0.276, z), (0.80, 0.012, 0.03), M["wood_dark"], 0.004)
    box("Teacher desk shelf", (cx, cy + 0.02, 0.52), (0.87, 0.48, 0.02), M["wood_light"])
    box("Teacher desk plinth", (cx, cy, 0.035), (0.90, 0.52, 0.07), M["wood_dark"], 0.004)
    box("Teacher attendance book", (cx - 0.22, cy + 0.02, 0.962), (0.24, 0.32, 0.018), M["book_blue"],
        0.004, yaw=-0.08)
    box("Teacher chalk box", (cx + 0.28, cy + 0.08, 0.975), (0.14, 0.09, 0.045), M["paper"], 0.004)
    FINAL_SPACE[0] = False


def pot_plant(x, y, scale=1.0):
    cylinder("Ceramic plant pot", (x, y, 0.38 * scale), 0.25 * scale, 0.5 * scale, M["pot"], 12)
    cylinder("Plant soil", (x, y, 0.64 * scale), 0.225 * scale, 0.025, M["soil"], 12)
    cylinder("Plant stem", (x, y, 1.03 * scale), 0.035 * scale, 0.75 * scale, M["green_dark"], 10)
    for i in range(9):
        a = i * 2.4
        r = (0.19 + (i % 3) * 0.08) * scale
        z = (1.12 + (i % 4) * 0.13) * scale
        leaf = box("Potted plant leaf", (x + math.cos(a) * r, y + math.sin(a) * r, z),
                   (0.17 * scale, 0.39 * scale, 0.035 * scale),
                   M["green"] if i % 2 else M["green_dark"], 0.015)
        leaf.rotation_euler.z = a - math.pi / 2
        leaf.rotation_euler.x = 0.32 if i % 2 else -0.32


def build_shell():
    floor = box("Continuous ceramic classroom floor", (0, 0, -0.09), (W, L, 0.18), M["floor"])
    uv_layer = floor.data.uv_layers.active
    for face in floor.data.polygons:
        if face.normal.z > 0.9:
            for idx in face.loop_indices:
                vertex = floor.data.vertices[floor.data.loops[idx].vertex_index].co
                uv_layer.data[idx].uv = ((vertex.x + XW) / W * 4.0,
                                         (vertex.y + YW) / L * 4.8)
    box("Rear continuous plaster wall", (0, -YW, H / 2), (W, 0.16, H), M["wall"])
    box("Front continuous plaster wall", (0, YW, H / 2), (W, 0.16, H), M["wall"])
    # Left: uninterrupted banks of real window openings.
    box("Window wall lower", (-XW, 0, 0.51), (0.16, L, 1.02), M["lower"])
    box("Window wall upper", (-XW, 0, 3.73), (0.16, L, 0.94), M["wall"])
    for y in (-YW, YW):
        box("Wall skirting", (0, y - (0.04 if y > 0 else -0.04), 0.12),
            (W - 0.1, 0.06, 0.24), M["trim"])
    for x in (-XW, XW):
        box("Wall cornice", (x - (0.05 if x > 0 else -0.05), 0, 4.08),
            (0.10, L, 0.12), M["trim"])
    box("Ceiling white plane", (0, 0, 4.18), (W, L, 0.08), M["ceiling"])
    for x in [(-XW + i * 1.28) for i in range(1, 10)]:
        box("Ceiling panel joint", (x, 0, 4.134), (0.013, L - 0.1, 0.006), M["ceiling_seam"])
    for y in [(-YW + i * 1.23) for i in range(1, 12)]:
        box("Ceiling panel joint", (0, y, 4.134), (W - 0.1, 0.013, 0.006), M["ceiling_seam"])
    for x in (-2.55, 2.55):
        for y in (-4.85, -1.6, 1.65, 4.9):
            box("Recessed light surround", (x, y, 4.11), (1.25, 0.21, 0.09), M["trim"], 0.018)
            box("Fluorescent diffuser", (x, y, 4.05), (1.14, 0.115, 0.035), M["light"], 0.012)


def sheer_curtain(y, width, top=3.38, bottom=1.12, columns=48, rows=12):
    # Gentle pleats in depth, with the hem drifting into the room.
    x0 = -XW + 0.31
    verts, faces, uvs = [], [], []
    for r in range(rows + 1):
        v = r / rows
        z = bottom + (top - bottom) * v
        for c in range(columns + 1):
            u = c / columns
            pleat = math.sin(u * math.pi * 2 * width * 5.2) * 0.045
            drift = 0.10 * (1 - v) ** 2
            verts.append((x0 + pleat + drift, y + (u - 0.5) * width, z))
            uvs.append((u, v))
    for r in range(rows):
        for c in range(columns):
            i = r * (columns + 1) + c
            faces.append((i, i + 1, i + columns + 2, i + columns + 1))
    mesh = bpy.data.meshes.new("Sheer curtain")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new()
    for poly in mesh.polygons:
        for loop_idx in poly.loop_indices:
            uv_layer.data[loop_idx].uv = uvs[mesh.loops[loop_idx].vertex_index]
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new("Sheer curtain", mesh)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(M["curtain"])
    obj["classroom_export"] = True
    return obj


def build_windows():
    # Four equal daylight bays; the exterior shapes give the glass a visible world.
    for i in range(5):
        y = -6.15 + i * 3.075
        box("Window structural pier", (-XW, y, 2.15), (0.18, 0.19, 2.3), M["wall"])
        box("Powder blue mullion", (-XW + 0.10, y, 2.15), (0.07, 0.075, 2.3), M["trim"])
    for i in range(4):
        y = -4.6125 + i * 3.075
        box("Window pale glass", (-XW + 0.025, y, 2.18), (0.03, 2.9, 2.22), M["window"])
        box("Window middle rail", (-XW + 0.11, y, 2.17), (0.065, 2.95, 0.065), M["trim"])
        box("Window lower sill", (-XW + 0.16, y, 1.02), (0.27, 2.95, 0.08), M["paper"], 0.012)
        box("Window upper header", (-XW + 0.09, y, 3.32), (0.10, 2.95, 0.09), M["trim"])
    # Sheer curtains half cover the bays, as in the painted classroom.
    # The viewer sways them from the rail, so each panel stays one thin sheet.
    for y, width in ((-5.55, 1.05), (-2.45, 1.30), (0.60, 1.05), (3.65, 1.30), (5.70, 0.95)):
        sheer_curtain(y, width)
    box("Curtain rail", (-XW + 0.23, 0, 3.43), (0.07, 13.1, 0.06), M["metal"])
    # The courtyard beyond the glass is a painted backdrop added by the viewer.


def sliding_door(y):
    # The door is on the corridor wall (+X), between wall segments, with its
    # glass entirely inside the door leaf.  Neither entrance overlaps a window.
    box("Sliding door overhead track", (XW - 0.11, y, 2.68), (0.18, 1.75, 0.10), M["dark_trim"])
    box("Sliding door recessed shadow", (XW - 0.02, y, 1.30), (0.055, 1.53, 2.56), M["dark_trim"])
    box("Sliding door leaf", (XW - 0.11, y, 1.29), (0.065, 1.43, 2.5), M["door"])
    box("Sliding door glass", (XW - 0.17, y, 1.72), (0.025, 0.43, 0.95), M["window"])
    for dy in (-0.25, 0.25):
        box("Door pane vertical frame", (XW - 0.19, y + dy, 1.72), (0.04, 0.035, 1.02), M["trim"])
    for z in (1.22, 2.22):
        box("Door pane horizontal frame", (XW - 0.19, y, z), (0.04, 0.54, 0.04), M["trim"])
    box("Inset door handle", (XW - 0.21, y + 0.5, 1.08), (0.02, 0.035, 0.18), M["metal_dark"])
    box("Sliding door floor guide", (XW - 0.1, y, 0.02), (0.1, 1.53, 0.035), M["dark_trim"])


def build_corridor_wall():
    doors = (-5.05, 4.95)
    opening_half = 0.78
    boundaries = [-YW, doors[0] - opening_half, doors[0] + opening_half,
                  doors[1] - opening_half, doors[1] + opening_half, YW]
    for i in (0, 2, 4):
        a, b = boundaries[i], boundaries[i + 1]
        center = (a + b) / 2
        length = b - a
        box("Corridor wall lower uninterrupted", (XW, center, 0.59),
            (0.16, length, 1.18), M["lower"])
        box("Corridor wall above glazing", (XW, center, 3.78),
            (0.16, length, 0.84), M["wall"])
        # Corridor-facing clerestory does not occupy a door opening.
        box("Corridor clerestory glass", (XW, center, 2.33),
            (0.035, max(0.12, length - 0.24), 2.02), M["window"])
        box("Corridor window middle rail", (XW - 0.11, center, 2.24),
            (0.06, length - 0.15, 0.065), M["trim"])
        box("Corridor sill", (XW - 0.10, center, 1.18),
            (0.13, length - 0.05, 0.08), M["trim"])
        box("Corridor window head", (XW - 0.10, center, 3.38),
            (0.13, length - 0.05, 0.08), M["trim"])
    for y in doors:
        box("Wall over door", (XW, y, 3.45), (0.16, 1.56, 1.5), M["wall"])
        for side in (-1, 1):
            box("Door jamb", (XW - 0.09, y + side * opening_half, 1.32),
                (0.12, 0.11, 2.64), M["trim"])
        sliding_door(y)
    for y in [-YW, *boundaries[1:-1], YW]:
        box("Corridor structural pier", (XW, y, 2.3), (0.20, 0.11, 3.7), M["wall"])


def build_hallway_glimpse():
    # A shallow corridor makes the door windows and transoms read as openings.
    box("Hallway blue stone floor", (7.48, 0, -0.09), (2.16, L, 0.18), M["hall_floor"])
    box("Hallway opposite plaster wall", (8.60, 0, 2.10), (0.16, L, H), M["wall"])
    box("Hallway ceiling", (7.48, 0, 4.18), (2.16, L, 0.08), M["ceiling"])
    for y in (-5.45, -1.85, 1.75, 5.35):
        box("Hallway opposite window", (8.49, y, 2.35),
            (0.03, 2.15, 1.55), M["outside_window"])
        for dy in (-1.12, 1.12):
            box("Hallway window side rail", (8.44, y + dy, 2.35),
                (0.045, 0.055, 1.64), M["trim"])
        box("Hallway window center rail", (8.44, y, 2.35),
            (0.045, 0.035, 1.64), M["trim"])
    for y in (-5.2, 0, 5.2):
        box("Hallway ceiling lamp", (7.5, y, 4.06),
            (0.45, 1.0, 0.07), M["light"], 0.012)


def build_front():
    # Keep the board low enough to write on: the chalk rail lands near 0.93 m.
    board_y, board_z = YW - 0.105, BOARD_Z
    box("Blank blackboard backing", (0, board_y, board_z), (6.60, 0.095, 1.88), M["dark_trim"], 0.015)
    box("Blank chalkboard textured surface", (0, board_y - 0.06, board_z),
        (6.38, 0.022, 1.63), M["board"])
    for x in (-3.29, 3.29):
        box("Blackboard silver side frame", (x, board_y - 0.08, board_z),
            (0.06, 0.10, 1.94), M["trim"])
    for dz in (-0.94, 0.94):
        box("Blackboard silver top bottom frame", (0, board_y - 0.08, board_z + dz),
            (6.62, 0.10, 0.055), M["trim"])
    box("Blackboard chalk rail", (0, board_y - 0.2, board_z - 0.96),
        (6.75, 0.23, 0.06), M["metal"], 0.008)
    for x in (-2.8, -2.65, 1.9):
        box("Unused white chalk", (x, board_y - 0.25, board_z - 0.90),
            (0.09, 0.014, 0.025), M["paper"], 0.005)
    teacher_lectern(0, 5.62 * ROOM_SCALE[1])
    # Simple analogue clock with no labels or text.
    cylinder("Front wall clock rim", (3.67, YW - 0.12, 3.75), 0.29, 0.09,
             M["metal"], 32, math.pi / 2)
    cylinder("Front wall clock face", (3.67, YW - 0.18, 3.75), 0.25, 0.025,
             M["paper"], 32, math.pi / 2)
    for a in range(12):
        angle = 2 * math.pi * a / 12
        box("Clock hour marker", (3.67 + math.sin(angle) * 0.205, YW - 0.2,
             3.75 + math.cos(angle) * 0.205), (0.014, 0.012, 0.027), M["metal_dark"])
    hand = box("Clock minute hand", (3.69, YW - 0.21, 3.81),
               (0.013, 0.013, 0.16), M["metal_dark"])
    hand.rotation_euler.y = 0.3
    hand = box("Clock hour hand", (3.63, YW - 0.22, 3.76),
               (0.013, 0.013, 0.11), M["metal_dark"])
    hand.rotation_euler.y = -1.0
    box("Wall speaker", (-3.63, YW - 0.16, 3.75), (0.48, 0.18, 0.34), M["paper"], 0.02)
    cylinder("Wall speaker grille", (-3.63, YW - 0.28, 3.75), 0.105, 0.015,
             M["metal"], 20, math.pi / 2)


def build_rear():
    # Shallow storage leaves a normal walking strip behind the last chair row.
    y = -YW + 0.24
    box("Rear low cubby rear panel", (0, y, 0.65), (8.30, 0.12, 1.20), M["metal_dark"])
    box("Rear cubby cream top", (0, y + 0.20, 1.22), (8.46, 0.43, 0.07), M["wood_light"], 0.014)
    box("Rear cubby base", (0, y + 0.20, 0.12), (8.42, 0.43, 0.14), M["wood_light"])
    for z in (0.68,):
        box("Rear cubby center shelf", (0, y + 0.20, z), (8.38, 0.43, 0.045), M["wood_light"])
    for x in [-4.18 + i * 0.76 for i in range(12)]:
        box("Rear cubby vertical divider", (x, y + 0.20, 0.67),
            (0.045, 0.43, 1.11), M["wood_light"])
    book_mats = (M["book_blue"], M["book_red"], M["book_green"], M["paper"])
    for bay in range(11):
        for level in (0, 1):
            if (bay + level) % 3 == 0:
                continue
            x0 = -3.75 + bay * 0.76
            for j in range(2 + (bay + level) % 3):
                box("Book in rear cubby", (x0 + j * 0.11, y + 0.16, 0.43 + level * 0.53),
                    (0.055 + 0.016 * (j % 2), 0.20, 0.33 + 0.05 * ((bay + j) % 2)),
                    book_mats[(bay + j + level) % 4], 0.005)
    # The reference's large rear display is one board, with different pinned
    # notices instead of three repeated copies of the whole texture sheet.
    board_y = -YW + 0.095
    box("Rear bulletin board wooden frame", (0, board_y, 2.49),
        (7.85, 0.10, 1.72), M["wood_dark"], 0.018)
    box("Rear bulletin board cork", (0, board_y + 0.064, 2.49),
        (7.61, 0.035, 1.51), M["cork"])
    for i in range(7):
        x = -3.23 + i * 1.075
        col, row = i % 3, (i // 3) % 3
        u0, u1 = col / 3 + 0.012, (col + 1) / 3 - 0.012
        v0, v1 = (2 - row) / 3 + 0.012, (3 - row) / 3 - 0.012
        wall_image("Individual rear wall poster", board_y + 0.09, x, 2.51,
                   0.87, 1.19, M["poster"], (u0, v0, u1, v1))
        cylinder("Colored poster pin", (x, board_y + 0.095, 3.10),
                 0.025, 0.014, (M["book_red"], M["book_blue"], M["book_green"])[i % 3],
                 12, math.pi / 2)
    box("Rear class schedule frame", (5.15, board_y, 2.54),
        (1.34, 0.085, 1.56), M["trim"])
    box("Rear class schedule paper", (5.15, board_y + 0.054, 2.54),
        (1.15, 0.012, 1.38), M["paper"])
    for i in range(6):
        box("Blank schedule ruling", (5.15, board_y + 0.064, 2.90 - i * 0.14),
            (0.92, 0.004, 0.012), M["trim"])
    pot_plant(-5.44, -6.95, 1.0)


def configure_preview(camera_name, position, target, output):
    camera = bpy.data.objects.new(camera_name, bpy.data.cameras.new(camera_name))
    CAMERAS.objects.link(camera)
    camera.location = position
    look_at(camera, target)
    camera.data.lens = 23
    camera.data.clip_start = 0.04
    scene.camera = camera
    scene.render.filepath = str(ROOT / output)
    bpy.ops.render.render(write_still=True)


def configure_lighting():
    world = bpy.data.worlds.new("Classroom late afternoon")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = rgba("c3c2dc")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42
    scene.world = world
    # Low sun through the window bank, matching the viewer's key light.
    sun = bpy.data.lights.new("Classroom window sun", 'SUN')
    sun.energy = 3.2
    sun.color = rgba("ffd3a3")[:3]
    sun.angle = math.radians(1.5)
    obj = bpy.data.objects.new("Classroom window sun", sun)
    CAMERAS.objects.link(obj)
    obj.location = (-10.0, -2.6, 5.4)
    look_at(obj, (0, 0, 0))
    for name, location, energy, size, color, target in (
        ("Classroom ceiling fill", (-1.5, 0.2, 3.20), 260, 5.0, "c9cdea", (0, 0, 0)),
    ):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.shape = 'DISK'
        data.size = size
        data.color = rgba(color)[:3]
        data.use_shadow = True
        obj = bpy.data.objects.new(name, data)
        CAMERAS.objects.link(obj)
        obj.location = location
        look_at(obj, target)


def configure_preview_toon_materials():
    """Keep Eevee cel materials in the .blend and PBR fallbacks for GLB export."""
    fallback_outputs = []
    for mat in (*M.values(), *DESK_TOP_MATERIALS):
        nodes = mat.node_tree.nodes
        pbr_output = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
        fallback_outputs.append(pbr_output)
        principled = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        image = next((n for n in nodes if n.type == 'TEX_IMAGE'), None)
        if principled.inputs['Alpha'].is_linked or principled.inputs['Alpha'].default_value < 1.0:
            continue
        if principled.inputs['Emission Strength'].default_value > 0.0:
            continue

        diffuse = nodes.new('ShaderNodeBsdfDiffuse')
        diffuse.inputs['Color'].default_value = (1, 1, 1, 1)
        shader_to_rgb = nodes.new('ShaderNodeShaderToRGB')
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        dark, light = ramp.color_ramp.elements
        dark.position = 0.25
        dark.color = (0.36, 0.36, 0.55, 1)
        mid = ramp.color_ramp.elements.new(0.57)
        mid.color = (0.74, 0.70, 0.78, 1)
        light.position = 0.84
        light.color = (1.0, 0.92, 0.80, 1)
        ramp.color_ramp.elements.new(0.95).color = (1, 1, 1, 1)
        normalize = nodes.new('ShaderNodeMath')
        normalize.operation = 'MULTIPLY'
        normalize.inputs[1].default_value = 0.42
        base = nodes.new('ShaderNodeRGB')
        base.outputs['Color'].default_value = principled.inputs['Base Color'].default_value
        shaded_color = nodes.new('ShaderNodeMixRGB')
        shaded_color.blend_type = 'MULTIPLY'
        shaded_color.inputs[0].default_value = 1.0
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 2.2
        noise.inputs['Detail'].default_value = 2.0
        noise_range = nodes.new('ShaderNodeMapRange')
        noise_range.inputs['To Min'].default_value = 0.94
        noise_range.inputs['To Max'].default_value = 1.05
        varied_color = nodes.new('ShaderNodeMixRGB')
        varied_color.blend_type = 'MULTIPLY'
        varied_color.inputs[0].default_value = 1.0
        emission = nodes.new('ShaderNodeEmission')
        toon_output = nodes.new('ShaderNodeOutputMaterial')
        toon_output.is_active_output = True
        links = mat.node_tree.links
        links.new(diffuse.outputs['BSDF'], shader_to_rgb.inputs['Shader'])
        links.new(shader_to_rgb.outputs['Color'], normalize.inputs[0])
        links.new(normalize.outputs[0], ramp.inputs['Fac'])
        links.new(image.outputs['Color'] if image else base.outputs['Color'], shaded_color.inputs[1])
        links.new(ramp.outputs['Color'], shaded_color.inputs[2])
        links.new(shaded_color.outputs['Color'], varied_color.inputs[1])
        links.new(noise.outputs['Fac'], noise_range.inputs['Value'])
        links.new(noise_range.outputs['Result'], varied_color.inputs[2])
        links.new(varied_color.outputs['Color'], emission.inputs['Color'])
        links.new(emission.outputs['Emission'], toon_output.inputs['Surface'])
    return fallback_outputs


def patch_mtoon_extension(path):
    # Blender's glTF writer emits PBR fallbacks.  The VRM 1.0 MToon extension
    # makes the exported materials usable by MToon-aware clients as well.
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2 and length == len(data)
    offset = 12
    chunks = []
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from('<I4s', data, offset)
        offset += 8
        chunks.append((chunk_type, data[offset:offset + chunk_length]))
        offset += chunk_length
    document = json.loads(chunks[0][1])
    document.setdefault('extensionsUsed', [])
    if 'VRMC_materials_mtoon' not in document['extensionsUsed']:
        document['extensionsUsed'].append('VRMC_materials_mtoon')
    for mat in document.get('materials', []):
        name = mat['name'].lower()
        if any(part in name for part in ('wood', 'walnut', 'beech', 'varnished desk top')):
            shade = [0.20, 0.31, 0.43]
        elif 'board' in name:
            shade = [0.07, 0.17, 0.22]
        elif any(part in name for part in ('steel', 'metal', 'support')):
            shade = [0.15, 0.28, 0.40]
        elif any(part in name for part in ('floor', 'tile')):
            shade = [0.41, 0.52, 0.65]
        else:
            shade = [0.44, 0.55, 0.67]
        outlined = any(part in name for part in (
            'sunlit honey wood', 'warm walnut edge', 'varnished desk top', 'classroom sliding door',
            'beech cabinet', 'blank deep green board',
            'blue grey painted steel', 'dark seat support',
            'powder blue trim', 'slate window metal',
        ))
        mat.setdefault('extensions', {})['VRMC_materials_mtoon'] = {
            'specVersion': '1.0',
            'shadeColorFactor': shade,
            'shadingShiftFactor': 0.0,
            'shadingToonyFactor': 0.95,
            'giEqualizationFactor': 0.9,
            'outlineWidthMode': 'worldCoordinates' if outlined else 'none',
            'outlineWidthFactor': 0.0035 if outlined else 0.0,
            'outlineColorFactor': [0.14, 0.23, 0.33],
            'outlineLightingMixFactor': 0.0,
        }
    json_chunk = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    json_chunk += b' ' * ((4 - len(json_chunk) % 4) % 4)
    chunks[0] = (b'JSON', json_chunk)
    body = b''.join(struct.pack('<I4s', len(chunk), kind) + chunk for kind, chunk in chunks)
    Path(path).write_bytes(struct.pack('<4sII', b'glTF', 2, 12 + len(body)) + body)


build_shell()
build_windows()
build_corridor_wall()
build_hallway_glimpse()
build_front()
build_rear()
for row, y in enumerate(DESK_ROWS):
    for col, x in enumerate(DESK_COLUMNS):
        desk(x, y, row, col)

# Reduce the room footprint without making the student furniture child-sized.
# Mesh space is transformed so each editable piece retains its own origin.
bpy.context.view_layer.update()
for obj in COLLECTION.objects:
    if obj.type != 'MESH':
        continue
    world = obj.matrix_world.copy()
    sx, sy, sz = ROOM_SCALE
    if obj.get("final_space"):
        sx = sy = sz = 1.0
    scale = Matrix.Diagonal((sx, sy, sz, 1.0))
    obj.data.transform(scale @ world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
configure_lighting()
fallback_outputs = configure_preview_toon_materials()

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.render.image_settings.color_mode = 'RGBA'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.file.pack_all()

configure_preview('Classroom | view toward blank blackboard', (0.05, -4.75, 1.65),
                  (0.0, 1.7, 1.60), 'preview-classroom.png')
front_camera = scene.camera
configure_preview('Classroom | view toward rear display', (0.10, 4.52, 1.65),
                  (0.0, -1.8, 1.60), 'preview-classroom-rear.png')
scene.camera = front_camera
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'school-environments.blend'))

# The browser reads the GLB's MToon extension; preserve texture-based PBR
# fallbacks in the glTF so other viewers can read it as well.
for output in fallback_outputs:
    output.is_active_output = True

# The .blend keeps all pieces editable. Apply modifiers and join by material
# only in this transient process so the GLB has a few dozen draw calls.
bpy.ops.object.select_all(action='DESELECT')
for obj in COLLECTION.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in COLLECTION.objects if o.type == 'MESH')
bpy.ops.object.convert(target='MESH')
for mat in (*M.values(), *DESK_TOP_MATERIALS):
    group = [o for o in COLLECTION.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0] == mat]
    if len(group) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.join()
    group[0].name = 'Classroom | ' + mat.name
bpy.ops.object.select_all(action='DESELECT')
for obj in COLLECTION.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in COLLECTION.objects if o.type == 'MESH')
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'school-classroom-3d.glb'),
                          export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True)
patch_mtoon_extension(ROOT / 'school-classroom-3d.glb')
print('BUILT CLASSROOM', len(COLLECTION.objects), 'parts; 36 desks; two doors; two previews')
