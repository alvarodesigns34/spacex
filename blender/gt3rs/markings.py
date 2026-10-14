"""
The Porsche 911 GT3 RS's own markings, built in Blender (14-10-2026, when the centre began to carry
the real vehicles' markings): the crest on the front lid, the PORSCHE lettering across the rear light
band and the crest on each centre-lock cap. Exported as assets/gt3rs/markings.glb; the runtime
(vehicles/gt3rsMarkings.js) hangs the body's markings in gt3-sprung, so they ride the springs and the
dents with the body, and one cap crest on each wheel's spinning part.

Run headless (it reads the code-built car only to find the surfaces, by casting rays at it):
    node tools/vehicle-export.mjs gt3rs
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P blender/gt3rs/markings.py

PROVENANCE: where each marking sits and how big it is is read off Porsche's studio photographs of the
car (newsroom.porsche.com, reference only), ≈ ±1 cm: the crest at the front lid's leading edge on the
centre line, ≈7.5 cm wide; the lettering centred in the black band at the light bar's height, ≈0.34 m
long, letters ≈2.4 cm tall; the crest on the black cap of the centre-lock nut. The crest is drawn as
shapes — the shield, its quartered field of red and black bars on gold, the small centre shield — not
copied artwork. The lettering is a plain extended sans in Blender's own font, not Porsche's.

Frames: the code's (x forward from mid-wheelbase, y up, z right) is Blender's X = x, Y = -z, Z = y.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SOURCE = os.path.join(HERE, 'source', 'code-parts.glb')
OUT = os.path.join(ROOT, 'assets', 'gt3rs', 'markings.glb')


def mat(name, color, metal, rough, coat=0.0):
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    return m


def body_hit(origin, direction, required=True):
    """The first hit on the code-built body (its mesh objects only) along a ray, in Blender's frame."""
    dg = bpy.context.evaluated_depsgraph_get()
    ok, loc, nrm, _i, ob, _m = bpy.context.scene.ray_cast(dg, Vector(origin), Vector(direction).normalized())
    if not ok:
        if not required:
            return None
        raise SystemExit(f'no surface along {origin} -> {direction}')
    return loc, nrm, ob.name


def frame(loc, nrm, up_hint):
    """A frame on the surface: z out of it, y towards `up_hint` projected onto it, x = y × z."""
    z = nrm.normalized()
    y = (Vector(up_hint) - z * z.dot(Vector(up_hint))).normalized()
    x = y.cross(z)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = loc
    return m


def shield_outline(w, h, n=24):
    """The crest's shield: straight top with rounded shoulders, sides bowing in to a point (≈)."""
    pts = []
    for i in range(n + 1):                       # right side, top to the point
        t = i / n
        x = w / 2 * (1 - t ** 3.2) ** 0.6
        y = h / 2 - h * t
        pts.append((x, y))
    left = [(-x, y) for x, y in reversed(pts[1:-1])]
    top = [(w / 2 * 0.98, h / 2 + 0.004 * h), (0.0, h / 2 + 0.02 * h), (-w / 2 * 0.98, h / 2 + 0.004 * h)]
    return top[1:] + pts + left + top[:1]


def flat_poly_bm(pts, depth):
    """A polygon (counter-clockwise, x/y) extruded by `depth` along +z from z = 0, capped."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    hi = [bm.verts.new((x, y, depth)) for x, y in pts]
    bm.faces.new(hi)
    bm.faces.new(list(reversed(lo)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def clip_rect(poly, x0, x1, y0, y1):
    """Sutherland–Hodgman: the part of a convex-ish polygon inside a rectangle."""
    def clip(P, inside, cut):
        out = []
        for i in range(len(P)):
            a, b = P[i - 1], P[i]
            ia, ib = inside(a), inside(b)
            if ib:
                if not ia:
                    out.append(cut(a, b))
                out.append(b)
            elif ia:
                out.append(cut(a, b))
        return out
    def lerp_x(a, b, x):
        t = (x - a[0]) / (b[0] - a[0]); return (x, a[1] + t * (b[1] - a[1]))
    def lerp_y(a, b, y):
        t = (y - a[1]) / (b[1] - a[1]); return (a[0] + t * (b[0] - a[0]), y)
    P = poly
    for inside, cut in ((lambda p: p[0] >= x0, lambda a, b: lerp_x(a, b, x0)), (lambda p: p[0] <= x1, lambda a, b: lerp_x(a, b, x1)),
                        (lambda p: p[1] >= y0, lambda a, b: lerp_y(a, b, y0)), (lambda p: p[1] <= y1, lambda a, b: lerp_y(a, b, y1))):
        P = clip(P, inside, cut)
        if len(P) < 3:
            return []
    return P


def crest(name, width, coll, M, place):
    """The crest at `place` (a surface frame): a gold rim, the field quartered — red and black bars in
    the first and fourth quarters, gold in the others — and a small gold centre shield, as raised
    enamel; ≈ in every proportion."""
    h = width * 1.28
    parts = []
    outer = shield_outline(width, h)
    parts.append(('gold', flat_poly_bm(outer, 0.0012)))
    inner = shield_outline(width * 0.88, h * 0.9)
    # Quarters: the inner field cut by the cross; bars in two of them.
    xs = [p[0] for p in inner]; ys = [p[1] for p in inner]
    cx, cy = 0.0, (max(ys) + min(ys)) / 2 + h * 0.08
    quads = [(-1, 1), (1, 1), (-1, -1), (1, -1)]
    for k, (sx, sy) in enumerate(quads):
        x0, x1 = (min(xs), cx - 0.0025) if sx < 0 else (cx + 0.0025, max(xs))
        y0, y1 = (cy + 0.0025, max(ys)) if sy > 0 else (min(ys), cy - 0.0025)
        q = clip_rect(inner, x0, x1, y0, y1)
        if not q:
            continue
        barred = k in (0, 3)
        if barred:
            nbar = 6
            for b in range(nbar):
                by0 = y0 + (y1 - y0) * b / nbar
                by1 = y0 + (y1 - y0) * (b + 1) / nbar
                piece = clip_rect(q, x0, x1, by0, by1)
                if len(piece) >= 3:
                    parts.append(('red' if b % 2 == 0 else 'black', transform(flat_poly_bm(piece, 0.0006), Matrix.Translation((0, 0, 0.0012)))))
        else:
            parts.append(('gold2', transform(flat_poly_bm(q, 0.0006), Matrix.Translation((0, 0, 0.0012)))))
    small = shield_outline(width * 0.34, h * 0.32)
    parts.append(('gold', transform(flat_poly_bm([(x, y + cy) for x, y in small], 0.0004), Matrix.Translation((0, 0, 0.0018)))))
    small_in = shield_outline(width * 0.26, h * 0.24)
    parts.append(('black', transform(flat_poly_bm([(x, y + cy) for x, y in small_in], 0.0003), Matrix.Translation((0, 0, 0.0022)))))
    # Script above the field, as a thin gold bar standing for the PORSCHE on the crest's top band (≈).
    parts.append(('black', transform(flat_poly_bm([(-width * 0.33, h * 0.405), (width * 0.33, h * 0.405), (width * 0.33, h * 0.445), (-width * 0.33, h * 0.445)], 0.0003), Matrix.Translation((0, 0, 0.0012)))))
    return build(name, parts, coll, M, place)


def transform(bm, m):
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def build(name, parts, coll, M, place):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    keys = []
    for key, part in parts:
        if key not in keys:
            keys.append(key)
        tmp = bpy.data.meshes.new('_t')
        part.to_mesh(tmp)
        part.free()
        start = len(bm.faces)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[start:]:
            f.material_index = keys.index(key)
    bmesh.ops.transform(bm, matrix=place, verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    for k in keys:
        me.materials.append(M[k])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def lettering(name, text, size, coll, M, place, mat_key, depth=0.0015, spacing=1.6):
    cu = bpy.data.curves.new('_txt', 'FONT')
    cu.body = text
    cu.size = size
    cu.extrude = depth / 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_character = spacing
    tmp = bpy.data.objects.new('_txt', cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, depth / 2)), verts=bm.verts)
    return build(name, [(mat_key, bm)], coll, M, place)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not os.path.exists(SOURCE):
        raise SystemExit(f'{SOURCE} is missing: run `node tools/vehicle-export.mjs gt3rs` first')
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    code = list(bpy.context.scene.objects)
    # Only the body's own surfaces take the rays: not the cabin seen through the glass, not the wheels.
    for o in code:
        if o.type == 'MESH' and ('cabin' in o.name or 'wheel' in o.name or 'glass' in o.name.lower()):
            o.hide_set(True)
            o.hide_viewport = True
    M = {
        'gold': mat('gt3-mark-gold', (0.80, 0.58, 0.22), 1.0, 0.22, 0.6),
        'gold2': mat('gt3-mark-gold-field', (0.74, 0.52, 0.18), 1.0, 0.3, 0.8),
        'red': mat('gt3-mark-red', (0.55, 0.02, 0.02), 0.0, 0.2, 1.0),
        'black': mat('gt3-mark-black', (0.015, 0.015, 0.016), 0.0, 0.2, 1.0),
        'chrome': mat('gt3-mark-letters', (0.80, 0.80, 0.80), 1.0, 0.12),
    }
    coll = bpy.data.collections.new('GT3RS_MARKINGS')
    bpy.context.scene.collection.children.link(coll)
    # Front crest: the lid's leading edge on the centre line. Ray straight down at the x where the lid
    # meets the nose (found as the foremost hit above 0.66 m), then 4 cm back onto the lid.
    x_front = None
    for i in range(400):
        x = 2.35 - i * 0.005
        hit = body_hit((x, 0.0, 3.0), (0, 0, -1), required=False)
        if hit and hit[0].z > 0.66:
            x_front = x
            break
    loc, nrm, nm = body_hit((x_front - 0.06, 0.0, 3.0), (0, 0, -1))
    # (Its top towards the windscreen: it reads from in front of the car.)
    place = frame(loc + nrm * 0.0003, nrm, (-1, 0, 0))
    a = crest('gt3-mark-crest-front', 0.075, coll, M, place)
    a['surface'] = nm
    # Rear lettering: centred in the black band, at the light bar's height (0.79 m, ≈ under the bar's
    # 0.81–0.823 m), letters ≈2.4 cm tall over ≈0.34 m.
    loc, nrm, nm = body_hit((-4.0, 0.0, 0.795), (1, 0, 0))
    place = frame(loc + nrm * 0.0004, nrm, (0, 0, 1))
    b = lettering('gt3-mark-porsche-rear', 'PORSCHE', 0.041, coll, M, place, 'chrome', spacing=2.3)
    b['surface'] = nm
    # Cap crest: built at the origin facing +z (the wheel's own frame: the runtime puts it on each cap).
    c = crest('gt3-mark-crest-cap', 0.036, coll, M, Matrix.Identity(4))
    for o in (a, b, c):
        o['source'] = 'blender/gt3rs/markings.py'
    # Export the markings alone.
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in coll.objects:
        o.hide_viewport = False
        o.select_set(True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, use_selection=True, export_apply=True,
                              export_materials='EXPORT', export_extras=True, export_animations=False)
    print('MARKINGS', OUT, os.path.getsize(OUT), {o.name: [round(v, 4) for v in o.matrix_world.translation] for o in coll.objects})
    print('BOUNDS', {o.name: [[round(min(v.co[i] for v in o.data.vertices), 4) for i in range(3)], [round(max(v.co[i] for v in o.data.vertices), 4) for i in range(3)]] for o in coll.objects})


main()
