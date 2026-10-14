"""
Kawasaki's River Mark on the nose (14-10-2026, when the centre began to carry the real vehicles' markings): the
emblem the H2 and H2R were the first to wear, on the carbon upper cowl under the screen, on the centre line (Commons
photographs of the H2R head-on and three-quarter, reference only). It is drawn as shapes — a chrome rim round a
pointed oval, a black field and three chrome waves — not copied artwork; ≈6 cm across, ≈ in every proportion.
It is placed by casting a ray at the finished cowl, so it sits on its surface a hair proud.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def _mat(name, color, metal, rough, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    return m


def _lens(w, h, n=40):
    """A pointed oval: two circular arcs meeting at points left and right."""
    r = (w * w / 4 + h * h / 4) / h
    a = math.asin((w / 2) / r)
    top = [(r * math.sin(t), r * math.cos(t) - (r - h / 2)) for t in [a - 2 * a * i / n for i in range(n + 1)]]
    bot = [(x, -y) for x, y in reversed(top[1:-1])]
    return top + bot


def _slab(pts, z0, z1):
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(hi)
    bm.faces.new(list(reversed(lo)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _wave(y, w, amp, thick, z0, z1, n=24):
    pts_top, pts_bot = [], []
    for i in range(n + 1):
        x = -w / 2 + w * i / n
        yy = y + amp * math.sin(2 * math.pi * i / n * 1.5)
        pts_top.append((x, yy + thick / 2))
        pts_bot.append((x, yy - thick / 2))
    return _slab(pts_top + list(reversed(pts_bot)), z0, z1)


def add(width=0.060, height=0.034):
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    # The cowl's surface on the centre line, 4 cm below the screen's lower edge (≈ the photographs).
    ok, loc, nrm, _i, ob, _m = sc.ray_cast(dg, Vector((3.0, 0.0, 0.835)), Vector((-1.0, 0.0, 0.0)))
    if not ok or not ob.name.startswith('h2r-cowl'):
        print('river mark: no cowl under the ray, not placed', ob.name if ok else None)
        return None
    z = nrm.normalized()
    up = Vector((0, 0, 1))
    y = (up - z * z.dot(up)).normalized()
    x = y.cross(z)
    place = Matrix((x, y, z)).transposed().to_4x4()
    place.translation = loc + z * 0.0004
    chrome = _mat('h2r-emblem-chrome', (0.82, 0.83, 0.85), 1.0, 0.08)
    black = _mat('h2r-emblem-field', (0.012, 0.012, 0.014), 0.0, 0.25, 1.0)
    parts = [(0, _slab(_lens(width, height), 0.0, 0.0018)),
             (1, _slab(_lens(width * 0.86, height * 0.78), 0.0018, 0.0024))]
    for k, yy in enumerate((0.0065, 0.0, -0.0065)):
        parts.append((0, _wave(yy, width * (0.62 - 0.08 * abs(k - 1)), 0.0016, 0.0022, 0.0024, 0.0030)))
    me = bpy.data.meshes.new('h2r-river-mark')
    bm = bmesh.new()
    for mi, part in parts:
        tmp = bpy.data.meshes.new('_t')
        part.to_mesh(tmp)
        part.free()
        start = len(bm.faces)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[start:]:
            f.material_index = mi
    bmesh.ops.transform(bm, matrix=place, verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(chrome)
    me.materials.append(black)
    o = bpy.data.objects.new('h2r-river-mark', me)
    root = bpy.data.objects.get('h2r')
    (root.users_collection[0] if root else sc.collection).objects.link(o)
    if root is not None:
        o.parent = root
        o.matrix_parent_inverse = root.matrix_world.inverted()
    print('river mark on', ob.name, [round(c, 4) for c in loc])
    return o
