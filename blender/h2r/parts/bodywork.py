"""
The bodywork as moulded and pressed panels, not sheets: each panel is welded into one surface, its
folds marked where the photographs show a crease, given its wall (≈2.5 mm, the H2R's carbon and
the mirror-coated plastic panels; ≈), its edges rolled by a fine bevel that catches the light the
way a real panel's edge does, and its normals hardened so the pressed planes read flat and the
folds sharp. The rounded mouldings (the tank's cover and sides, the tail, the seat) are smoothed
by subdivision with their folds kept; the pressed, faceted panels (the cowl, the side panels, the
wings) keep their planes. The decals are wrapped onto the finished surfaces.

The outlines are the ones fitted earlier to the calibrated photographs (src/vehicles/h2r/bodywork/,
≈ ±1 cm), which the side-view comparison (lib/review.py) confirms; the wall and the bevels ≈.
"""
import math

import bmesh
import bpy

# name: (wall m, subdivision levels, fold angle deg)
PANELS = {
    'h2r-tank-top': (0.0025, 2, 38), 'h2r-tank-side': (0.0025, 2, 38),
    'h2r-tail': (0.0025, 2, 34), 'h2r-tail-panel': (0.0025, 2, 34), 'h2r-side-cover': (0.0025, 1, 34),
    'h2r-seat': (0.012, 2, 50),
    'h2r-cowl': (0.0025, 0, 20), 'h2r-cowl-horn': (0.0025, 0, 20), 'h2r-side-panel': (0.0025, 0, 12),
    'h2r-wings': (0.003, 0, 20), 'h2r-keel': (0.0025, 0, 20), 'h2r-lower-cowl': (0.0025, 0, 20),
    'h2r-lower-wing-plate': (0.0025, 0, 20), 'h2r-lower-wing-slats': (0.002, 0, 20), 'h2r-under-eye': (0.002, 0, 20),
    'h2r-chevron': (0.002, 0, 20), 'h2r-lower-face': (0.0025, 0, 20), 'h2r-mouth-lip': (0.0025, 0, 20),
}
DECALS = {'h2r-decal-kawasaki': 'h2r-tank-top', 'h2r-decal-ninja': 'h2r-side-panel', 'h2r-decal-h2r': 'h2r-side-panel',
          'h2r-decal-ninja-tail': 'h2r-tail-panel'}


def _base(name):
    return name.split('.')[0]


def _weld(ob, angle):
    """One surface: coincident vertices merged, folds past `angle` marked sharp and creased."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    lim = math.radians(angle)
    # (The lofts were quads cut in two: joined again, so the subdivision runs on quads, smoothly.)
    bmesh.ops.join_triangles(bm, faces=bm.faces, angle_face_threshold=math.radians(12), angle_shape_threshold=math.radians(40))
    crease = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim:
            e.smooth = False; e[crease] = 1.0
        else:
            e.smooth = True
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me); bm.free()
    me.update()


def _apply(ob):
    """The modifiers made real (the walls' rims are new faces, which the next step maps)."""
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def _map_unmapped(ob):
    """The faces the wall and the bevels add carry no UV area of their own (their corners copy the
    face they grew from): mapped as the code mapped the panels, by position (u = 3x + 3z, v = 3y in
    the model's frame; Blender's X = x, Y = -z, Z = y, here by the axis each face's normal is
    nearest), so the surface detail and the checks see a mapped surface everywhere."""
    me = ob.data
    if not me.uv_layers:
        return
    uv = me.uv_layers[0].data
    mw = ob.matrix_world
    # (Triangle by triangle, as the file will carry them: a bevel's quad can keep its area while
    # one of its two triangles has none.)
    me.calc_loop_triangles()
    bad = set()
    for t in me.loop_triangles:
        a, b, c = (uv[i].uv for i in t.loops)
        if abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) < 1e-9 and t.area > 1e-12:
            bad.add(t.polygon_index)
    for p in (me.polygons[i] for i in bad):
        # (Faces that projection sees edge-on: by the axis their normal is nearest instead.)
        n = (mw.to_3x3() @ p.normal)
        ax = max(range(3), key=lambda k: abs(n[k]))
        for li, vi in zip(range(p.loop_start, p.loop_start + p.loop_total), p.vertices):
            w = mw @ me.vertices[vi].co
            uv[li].uv = ((3 * w.y, 3 * w.z), (3 * w.x, 3 * w.z), (3 * w.x, 3 * w.y))[ax]


def refine():
    done = []
    for ob in list(bpy.data.objects):
        if ob.type != 'MESH' or _base(ob.name) not in PANELS:
            continue
        wall, levels, angle = PANELS[_base(ob.name)]
        _weld(ob, angle)
        if levels:
            sub = ob.modifiers.new('subdivision', 'SUBSURF')
            sub.levels = sub.render_levels = levels
            sub.use_creases = True; sub.boundary_smooth = 'PRESERVE_CORNERS'
        sol = ob.modifiers.new('wall', 'SOLIDIFY')
        sol.thickness = wall; sol.offset = -1.0; sol.use_even_offset = True; sol.use_rim = True; sol.use_quality_normals = True
        bev = ob.modifiers.new('edges', 'BEVEL')
        bev.width = min(0.0009, wall * 0.4); bev.segments = 2; bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(35)
        bev.harden_normals = True
        wn = ob.modifiers.new('normals', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
        _apply(ob)
        _map_unmapped(ob)
        done.append(ob.name)
    # The decals wrapped onto the finished surfaces, a hair proud.
    for ob in list(bpy.data.objects):
        target = DECALS.get(_base(ob.name))
        if ob.type != 'MESH' or not target:
            continue
        tgt = bpy.data.objects.get(target)
        if tgt is None:
            continue
        sw = ob.modifiers.new('onto', 'SHRINKWRAP')
        sw.target = tgt; sw.wrap_method = 'NEAREST_SURFACEPOINT'; sw.offset = 0.0006; sw.wrap_mode = 'OUTSIDE_SURFACE'
        _apply(ob)
    return done
