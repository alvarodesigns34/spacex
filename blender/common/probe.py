"""
Headless probe: runs a Python snippet against a saved .blend and prints what it assigns to `out`.
    blender -b --factory-startup -P blender/common/probe.py -- <file.blend> <snippet.py>
The snippet sees bpy, numpy as np, Vector and a `world_verts(ob)` helper (evaluated, world space).
"""
import json
import sys

import bpy
import numpy as np
from mathutils import Vector


def world_verts(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    a = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get('co', a)
    a = a.reshape(-1, 3)
    m = np.array(ob.matrix_world)
    ob.evaluated_get(dg).to_mesh_clear()
    return a @ m[:3, :3].T + m[:3, 3]


a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
ns = {'bpy': bpy, 'np': np, 'Vector': Vector, 'world_verts': world_verts, 'out': None}
exec(open(a[1], encoding='utf-8').read(), ns)
print('PROBE ' + json.dumps(ns['out'], default=str))
