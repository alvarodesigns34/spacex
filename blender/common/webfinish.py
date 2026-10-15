"""
The finish a Blender build gives its model for the web (October 2026, from the Model Y's ty_bake.py):
  - modifiers applied through the data API (no operator, no context);
  - ambient occlusion baked by Cycles (on the GPU when there is one) into one atlas on a second UV set
    ('ao'), each mesh unwrapped on its own and given a square of the atlas in proportion to its surface,
    and wired to every material as the glTF occlusion texture (three.js: aoMap on UV channel 1).
Run headless: the unwrapping and the bake use operators, which can bring down an open session.
"""
import os

import bpy
import numpy as np


def apply_modifiers(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if not o.modifiers:
            continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        old = o.data
        o.modifiers.clear()
        o.data = me
        me.name = old.name
        if old.users == 0:
            bpy.data.meshes.remove(old)


def _gpu(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.refresh_devices()
        if any(d.type == 'OPTIX' for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == 'OPTIX'
            scene.cycles.device = 'GPU'
    except (TypeError, KeyError):
        pass


def _shelf(sizes, size):
    order = sorted(range(len(sizes)), key=lambda i: -sizes[i])
    out, x, y, sh = [None] * len(sizes), 0.0, 0.0, 0.0
    lim = 1 - 6 / size
    for i in order:
        s = sizes[i]
        if x + s > lim:
            x, y, sh = 0.0, y + sh, 0.0
        if y + s > lim:
            return None
        out[i] = (x, y); x += s; sh = max(sh, s)
    return out


def unwrap_atlas(objs, size, layer='ao'):
    """Each mesh (once, if several objects share it) unwrapped by Smart UV Project, its islands packed, then
    scaled into its own square of the atlas so that the texel is the same size everywhere."""
    uniq, seen = [], set()
    for o in objs:
        if o.data.name in seen or len(o.data.polygons) == 0:
            continue
        seen.add(o.data.name); uniq.append(o)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    tiles = []
    for o in uniq:
        me = o.data
        # The occlusion is always the second set (glTF TEXCOORD_1): a material shared by several meshes names one
        # set for all of them, so a mesh without UVs of its own gets a first set to stand in that place.
        if not me.uv_layers:
            me.uv_layers.new(name='UVMap')
        if layer not in me.uv_layers:
            me.uv_layers.new(name=layer)
        me.uv_layers.active = me.uv_layers[layer]
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.0, scale_to_bounds=False)
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(margin=0.003, rotate=True, shape_method='CONCAVE')
        bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
        area = sum(p.area for p in me.polygons)
        uvd = me.uv_layers[layer].data
        co = np.empty(len(uvd) * 2); uvd.foreach_get('uv', co); co = co.reshape(-1, 2)
        cov = 0.0
        for p in me.polygons:
            q = co[p.loop_start:p.loop_start + p.loop_total]
            cov += 0.5 * abs(np.sum(q[:, 0] * np.roll(q[:, 1], 1) - np.roll(q[:, 0], 1) * q[:, 1]))
        tiles.append((o, (area / max(cov, 1e-6)) ** 0.5))
    pad = 3.0 / size
    lo, hi = 0.0, 10.0
    for _ in range(40):
        k = (lo + hi) / 2
        if _shelf([t * k + pad for _, t in tiles], size) is None:
            hi = k
        else:
            lo = k
    corners = _shelf([t * lo + pad for _, t in tiles], size)
    for (o, t), (x, y) in zip(tiles, corners):
        uvd = o.data.uv_layers[layer].data
        co = np.empty(len(uvd) * 2); uvd.foreach_get('uv', co); co = co.reshape(-1, 2)
        uvd.foreach_set('uv', (np.array([x, y]) + pad / 2 + co * t * lo).ravel())
        o.data.uv_layers.active = o.data.uv_layers[0]
    print(f'ao atlas: {len(tiles)} meshes, texel ≈{1 / (lo * size) * 1000:.1f} mm')
    return uniq


def _occlusion_group():
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        g.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def bake_ao(objs, cache, name, size=4096, distance=0.30, samples=64, skip=lambda o: False, no_occlusion=lambda m: False):
    """objs: the meshes to export. Those `skip` says (glass, lenses, lamps) are hidden while the rest bakes and get
    no occlusion; materials `no_occlusion` says are left unwired. Returns the atlas's path."""
    hidden = [o for o in objs if skip(o)]
    for o in hidden:
        o.hide_render = True
    baked = unwrap_atlas([o for o in objs if o not in hidden], size)
    image = bpy.data.images.new(name, size, size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    group = _occlusion_group()
    for m in {s.material for o in baked for s in o.material_slots if s.material}:
        if not m.use_nodes:
            m.use_nodes = True
        nt = m.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.name = tex.label = 'ao-bake'; tex.image = image
        if not no_occlusion(m):
            uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'ao'
            nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
            g = nt.nodes.new('ShaderNodeGroup'); g.node_tree = group
            nt.links.new(sep.outputs[0], g.inputs['Occlusion'])
        nt.nodes.active = tex
    s = bpy.context.scene
    _gpu(s)
    s.cycles.samples = samples
    if s.world is None:
        s.world = bpy.data.worlds.new('bake-world')
    s.world.light_settings.distance = distance
    for o in baked:
        o.select_set(True)
    bpy.context.view_layer.objects.active = baked[0]
    bpy.ops.object.bake(type='AO', uv_layer='ao', margin=8, use_clear=True)
    for o in hidden:
        o.hide_render = False
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, name + '.jpg')
    image.filepath_raw = path; image.file_format = 'JPEG'
    s.render.image_settings.quality = 92
    image.save()
    return path
