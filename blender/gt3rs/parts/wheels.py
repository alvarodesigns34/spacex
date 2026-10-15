"""
The GT3 RS's wheels in Blender (15-10-2026), on the code-built wheels' own frames (each wheel's '-spin' empty:
the axle along local Y, the outer face towards -Y; the left wheels are the right ones mirrored by that empty).

  - Spokes: the forged centre-lock wheel's five Y-spokes (the code had ten; photographs of the rear wheel side-on
    show five stems, ≈50 mm wide, each forking at ≈0.4 of the radius into two arms, the ten arms meeting the rim every 36°) but with a
    real section: a flat top rounded at its edges over deep sides (≈45 mm at the hub, ≈28 mm at the rim), the arms ≈40 → 28 mm wide, straight,
    instead of thin flat bars. The face is dished as before (front ≈40 mm, rear ≈65 mm). Widths and depths ≈, from
    Commons photographs of a white car on red wheels (reference only).
  - The rim's outer flange machined bright: a thin silver edge round the red face, as on those photographs.
  - The tyres' sidewall markings, raised 0.6 mm in the rubber: MICHELIN, PILOT SPORT CUP 2 R and the size (275/35 ZR 20
    in front, 335/30 ZR 21 behind: Porsche's technical data), twice round each tyre. The tyre is the one Porsche
    fits to the car; the lettering is a plain sans in Blender's own font, not Michelin's artwork.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

WHEELS = ('gt3-wheel-fl', 'gt3-wheel-fr', 'gt3-wheel-rl', 'gt3-wheel-rr')


def _mesh(name, verts, faces, mat, parent, smooth=True, sharp=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate(clean_customdata=False)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    if sharp:
        me.set_sharp_from_angle(angle=math.radians(sharp))
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    parent.users_collection[0].objects.link(o)
    o.parent = parent
    return o


def _grid_faces(nr, nc, closed_c=True, base=0):
    f = []
    for i in range(nr - 1):
        for j in range(nc if closed_c else nc - 1):
            j1 = (j + 1) % nc
            f.append((base + i * nc + j, base + i * nc + j1, base + (i + 1) * nc + j1, base + (i + 1) * nc + j))
    return f


def _bar(path, width, depth, face_y, ns=14):
    """A spoke along `path` (n, 2) in the wheel plane (x, z): its section a flat top rounded at its edges over deep sides, its top on
    face_y(r) (local y, the outer face towards -y). Returns verts, faces (ends capped)."""
    path = np.asarray(path, float)
    t = np.gradient(path, axis=0); t /= np.linalg.norm(t, axis=1)[:, None]
    nrm = np.stack([-t[:, 1], t[:, 0]], 1)
    # section: (across in [-1, 1], down in [0, 1]); the top rounded, the sides straight, the bottom flat
    a = np.linspace(0, math.pi, ns // 2 + 1)
    top = [(-math.cos(x), 0.07 * (1 - math.sin(x))) for x in a]          # a nearly flat top, rounded at its edges
    sec = [(-1.0, 0.16)] + top[1:-1] + [(1.0, 0.16), (1.0, 0.55), (0.92, 1.0), (-0.92, 1.0), (-1.0, 0.55)]
    V = []
    for k, (p, n) in enumerate(zip(path, nrm)):
        r = float(np.hypot(*p)); y0 = face_y(r)
        for u, d in sec:
            q = p + n * (u * width[k] / 2)
            V.append((q[0], y0 + d * depth[k], q[1]))
    m = len(sec)
    F = _grid_faces(len(path), m)
    F.append(tuple(range(m))[::-1]); F.append(tuple((len(path) - 1) * m + i for i in range(m)))
    return V, F


def spokes(name, front):
    spin = bpy.data.objects[name + '-spin']
    old = bpy.data.objects.get(name + '-spokes')
    rim = bpy.data.objects[name + '-rim']
    ry = np.array([v.co.y for v in rim.data.vertices])
    rr = 0.254 if front else 0.2667
    z_face = float(ry.min()) + 0.014
    dish = 0.040 if front else 0.065
    r0, r1 = 0.052, rr - 0.010
    face_y = lambda r: z_face + dish * max(0.0, 1 - (r - r0) / (r1 - r0)) ** 1.4
    V, F = [], []
    rs = rr * 0.40
    spread = math.pi / 10                     # the ten arms meet the rim every 36°
    for k in range(5):
        a = k * 2 * math.pi / 5
        # stem
        rr_ = np.linspace(r0 - 0.004, rs + 0.016, 12)
        path = np.stack([rr_ * math.cos(a), rr_ * math.sin(a)], 1)
        w = np.linspace(0.052, 0.046, len(path)); d = np.linspace(0.048, 0.042, len(path))
        v, f = _bar(path, w, d, face_y); F += [tuple(i + len(V) for i in x) for x in f]; V += v
        # two straight arms from the fork into the rim
        for s in (-1, 1):
            tt = np.linspace(0, 1, 18)
            p0 = (rs - 0.004) * np.array([math.cos(a), math.sin(a)])
            p1 = (r1 + 0.004) * np.array([math.cos(a + s * spread), math.sin(a + s * spread)])
            path = p0[None] * (1 - tt[:, None]) + p1[None] * tt[:, None]
            w = 0.040 - 0.012 * tt; d = 0.042 - 0.014 * tt
            v, f = _bar(path, w, d, face_y); F += [tuple(i + len(V) for i in x) for x in f]; V += v
    mat = old.data.materials[0] if old else bpy.data.materials['gt3Wheel']
    if old:
        bpy.data.objects.remove(old)
    o = _mesh(name + '-spokes', V, F, mat, spin, sharp=40)
    # the machined edge of the outer flange: a thin bright ring on the face's rim
    lip = bpy.data.materials.get('gt3WheelLip') or _lip_material()
    prof = [(rr + 0.004, z_face - 0.010), (rr + 0.013, z_face - 0.0125), (rr + 0.0155, z_face - 0.008), (rr + 0.0145, z_face - 0.004)]
    th = np.linspace(0, 2 * math.pi, 160, endpoint=False)
    V = [(r * math.cos(t), y, r * math.sin(t)) for r, y in prof for t in th]
    _mesh(name + '-lip', V, _grid_faces(len(prof), len(th)), lip, spin, sharp=35)
    return o


def _lip_material():
    m = bpy.data.materials.new('gt3WheelLip')
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.78, 0.79, 0.80, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.22
    return m


def _text(body, size):
    cu = bpy.data.curves.new('tmp_txt', 'FONT')
    cu.body = body; cu.size = size; cu.extrude = 0.0003; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.space_character = 1.08
    ob = bpy.data.objects.new('tmp_txt', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    v = np.array([p.co[:] for p in me.vertices]); f = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)
    return v, f


def sidewall_text(name, front):
    tyre = bpy.data.objects[name + '-tyre']
    spin = tyre.parent
    me = tyre.data
    co = np.array([v.co[:] for v in me.vertices])
    rad = np.hypot(co[:, 0], co[:, 2])
    R, rr = rad.max(), (0.254 if front else 0.2667)
    # the sidewall's height (along y, outer face -y) as a function of radius: the outermost sample in each band
    bands = np.linspace(rr + 0.01, R - 0.01, 60)
    side_y = []
    for b in bands:
        sel = np.abs(rad - b) < 0.003
        side_y.append(co[sel, 1].min() if sel.any() else np.nan)
    side_y = np.array(side_y)
    ok = ~np.isnan(side_y)
    sy = lambda r: np.interp(r, bands[ok], side_y[ok])
    size = '275/35 ZR 20' if front else '335/30 ZR 21'
    h = R - rr
    # (text, letter height, radius, angle): each marking twice, opposite each other
    rows = [('MICHELIN', 0.30 * h, rr + 0.60 * h, math.pi * 0.25), ('MICHELIN', 0.30 * h, rr + 0.60 * h, math.pi * 1.25),
            ('PILOT SPORT CUP 2 R', 0.13 * h, rr + 0.62 * h, math.pi * 0.75), ('PILOT SPORT CUP 2 R', 0.13 * h, rr + 0.62 * h, math.pi * 1.75),
            (size, 0.10 * h, rr + 0.36 * h, math.pi * 0.25), (size, 0.10 * h, rr + 0.36 * h, math.pi * 1.25)]
    V, F = [], []
    for text, sz, rt, ang in rows:
        v, f = _text(text, sz)
        # wrap: x along the arc (anticlockwise seen from outside), y outward along the radius, z out of the rubber
        th = ang - v[:, 0] / rt
        r = rt + v[:, 1]
        y = sy(r) - 0.0002 - v[:, 2] * 2.0
        P = np.stack([r * np.cos(th), y, r * np.sin(th)], 1)
        F += [tuple(i + len(V) for i in x) for x in f]; V += P.tolist()
    old = bpy.data.objects.get(name + '-tyre-text')
    if old:
        bpy.data.objects.remove(old)
    return _mesh(name + '-tyre-text', V, F, me.materials[0], spin, smooth=False)


def rebuild():
    for n in WHEELS:
        front = n in ('gt3-wheel-fl', 'gt3-wheel-fr')
        spokes(n, front)
        sidewall_text(n, front)
