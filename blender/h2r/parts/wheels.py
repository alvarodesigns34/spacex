"""
The H2R's wheels refined in Blender (15-10-2026), on the code-built wheels' frames (each '-spin' empty: the axle along
local Y, the bike's right side towards -Y).

  - Spokes: the code had the right layout (five spokes; the front's each splitting into a narrow Y at the rim, the
    rear's a five-pointed star) but drew them as thin bars, which read as wire. Close crops of Commons photographs of
    the bike (right side, rear wheel; reference only) show broad tapering arms: ≈52 mm across near the hub, narrowing
    to a point at the rim, each folded along its length - one half machined bright, the other black, the two-tone of
    the real wheel. Widths, fold and depth ≈.
  - The tyres' sidewall markings, raised 0.6 mm: BRIDGESTONE, BATTLAX V01 (the slicks on the photographed bikes) and
    the published sizes, 120/600 R17 and 190/650 R17 (data/h2r.js). A plain sans in Blender's font, not the maker's.
"""
import math

import bmesh
import bpy
import numpy as np


def _find(spin, base):
    return [c for c in spin.children if c.name.split('.')[0] == base]


def _mesh(name, verts, faces, mats, mi, parent):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set('material_index', mi)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(30))
    # a first UV set, so that the baked occlusion lands in the second, where its materials read it
    me.uv_layers.new(name='UVMap')
    o = bpy.data.objects.new(name, me)
    parent.users_collection[0].objects.link(o)
    o.parent = parent
    return o


def star(spin, face_y, depth, r_hub, r_tip, w_hub, fork=None):
    """Five folded arms in the plane y = face_y (outer face towards -y). fork: (radius, half-angle) where each arm
    splits into two prongs (the front wheel's Y)."""
    V, F, MI = [], [], []
    ns = 26

    def arm(a, s0, s1, off_ang, w0, w1, r0, r1):
        base = len(V)
        for k, s in enumerate(np.linspace(0, 1, ns)):
            r = r0 + (r1 - r0) * s
            ang = a + off_ang * s
            c = np.array([r * math.cos(ang), r * math.sin(ang)])
            t = np.array([-math.sin(ang), math.cos(ang)])
            hw = (w0 * (1 - s) ** 0.85 + w1 * s) / 2
            ridge = 0.0045 * (1 - 0.6 * s)
            d = depth * (1 - 0.45 * s)
            loop = [(-hw, 0.0), (0.0, -ridge), (hw, 0.0), (hw * 0.9, d), (-hw * 0.9, d)]
            for u, dy in loop:
                p = c + t * u
                V.append((p[0], face_y + dy, p[1]))
        m = 5
        for k in range(ns - 1):
            for j in range(m):
                j1 = (j + 1) % m
                F.append((base + k * m + j, base + k * m + j1, base + (k + 1) * m + j1, base + (k + 1) * m + j))
                MI.append(1 if j == 0 else 0)          # the leading facet machined, the rest black
        F.append(tuple(base + j for j in range(m))[::-1]); MI.append(0)
        F.append(tuple(base + (ns - 1) * m + j for j in range(m))); MI.append(0)

    for i in range(5):
        a = i * 2 * math.pi / 5
        if fork is None:
            arm(a, 0, 1, 0.0, w_hub, 0.010, r_hub, r_tip)
        else:
            rf, half = fork
            arm(a, 0, 1, 0.0, w_hub, 0.030, r_hub, rf + 0.012)
            for s in (-1, 1):
                arm(a, 0, 1, s * half, 0.020, 0.008, rf, r_tip)
    return V, F, MI


def spokes(spin, front):
    old = _find(spin, 'h2r-spokes') + _find(spin, 'h2r-spoke-edges')
    if not old:
        return None
    ys = np.concatenate([[v.co.y for v in o.data.vertices] for o in old])
    face_y = float(ys.min())
    black = bpy.data.materials.get('h2r-rim')
    bright = bpy.data.materials.get('h2r-machined')
    name = old[0].name if old[0].name.startswith('h2r-spokes') else 'h2r-spokes'
    for o in old:
        bpy.data.objects.remove(o)
    if front:
        V, F, MI = star(spin, face_y, 0.024, 0.040, 0.212, 0.052, fork=(0.165, math.radians(7.0)))
    else:
        V, F, MI = star(spin, face_y, 0.034, 0.040, 0.212, 0.056)
    return _mesh(name, V, F, [black, bright], MI, spin)


def _text(body, size):
    cu = bpy.data.curves.new('tmp_txt', 'FONT')
    cu.body = body; cu.size = size; cu.extrude = 0.0003; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    ob = bpy.data.objects.new('tmp_txt', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    v = np.array([p.co[:] for p in me.vertices]); f = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)
    return v, f


def sidewall_text(spin, front):
    tyre = next(c for c in spin.children if c.name.startswith('h2r-tyre-'))
    co = np.array([v.co[:] for v in tyre.data.vertices])
    rad = np.hypot(co[:, 0], co[:, 2])
    R, rr = rad.max(), 17 * 0.0254 / 2
    bands = np.linspace(rr + 0.012, R - 0.012, 50)
    out = []
    for b in bands:
        sel = np.abs(rad - b) < 0.003
        out.append(co[sel, 1].min() if sel.any() else np.nan)
    out = np.array(out); ok = ~np.isnan(out)
    sy = lambda r: np.interp(r, bands[ok], out[ok])
    h = R - rr
    size = '120/600 R17' if front else '190/650 R17'
    rows = [('BRIDGESTONE', 0.22 * h, rr + 0.58 * h, math.pi * 0.25), ('BRIDGESTONE', 0.22 * h, rr + 0.58 * h, math.pi * 1.25),
            ('BATTLAX V01', 0.18 * h, rr + 0.58 * h, math.pi * 0.75), ('BATTLAX V01', 0.18 * h, rr + 0.58 * h, math.pi * 1.75),
            (size, 0.10 * h, rr + 0.32 * h, math.pi * 0.25), (size, 0.10 * h, rr + 0.32 * h, math.pi * 1.25)]
    V, F = [], []
    for text, sz, rt, ang in rows:
        v, f = _text(text, sz)
        th = ang - v[:, 0] / rt
        r = rt + v[:, 1]
        y = sy(r) - 0.0002 - v[:, 2] * 2.0
        P = np.stack([r * np.cos(th), y, r * np.sin(th)], 1)
        F += [tuple(i + len(V) for i in x) for x in f]; V += P.tolist()
    mat = tyre.data.materials[-1]
    return _mesh('h2r-tyre-text-' + ('f' if front else 'r'), V, F, [mat], [0] * len(F), spin)


def rebuild():
    for name, front in (('h2r-wheel-f-spin', True), ('h2r-wheel-r-spin', False)):
        spin = bpy.data.objects[name]
        spokes(spin, front)
        sidewall_text(spin, front)
