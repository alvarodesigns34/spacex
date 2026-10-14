"""
Review tool for the Blender builds, run headless on a saved .blend or a .glb:
    blender -b --factory-startup -P blender/common/review.py -- <file> stats
    blender -b --factory-startup -P blender/common/review.py -- <file> render <out.png> ex ey ez tx ty tz [lens] [w h] [samples]
Stats print one JSON line (objects, triangles, materials, top-level names); render makes a Cycles still on
the GPU under a sun and a sky, the same rig for every vehicle, so the passes can be compared.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def open_file(path):
    """A .blend, or one or more .glb joined by '+' (a vehicle and its separate parts, together)."""
    if path.lower().endswith('.blend'):
        bpy.ops.wm.open_mainfile(filepath=path)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        for p in path.split('+'):
            bpy.ops.import_scene.gltf(filepath=p)


def stats():
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    meshes = 0
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH' or ob.hide_render:
            continue
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        meshes += 1
        ob.evaluated_get(dg).to_mesh_clear()
    mats = sorted({s.material.name for o in bpy.context.scene.objects if o.type == 'MESH' for s in o.material_slots if s.material})
    print('STATS ' + json.dumps({'meshes': meshes, 'triangles': tris, 'materials': len(mats), 'material_names': mats,
                                  'top': sorted(o.name for o in bpy.context.scene.objects if o.parent is None)[:40]}))


def render(out, eye, target, lens=50, size=(1600, 1000), samples=96):
    sc = bpy.context.scene
    cam = bpy.data.objects.new('review_cam', bpy.data.cameras.new('review_cam'))
    sc.collection.objects.link(cam)
    cam.data.lens = lens
    cam.data.clip_start, cam.data.clip_end = 0.02, 5000
    cam.location = eye
    cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    # Only our light: whatever studio lamps a build left are switched off for the comparison.
    for o in sc.objects:
        if o.type == 'LIGHT':
            o.hide_render = True
    sun = bpy.data.objects.new('review_sun', bpy.data.lights.new('review_sun', 'SUN'))
    sc.collection.objects.link(sun)
    sun.data.energy = 4.0
    sun.data.angle = math.radians(0.6)
    sun.rotation_euler = (math.radians(45), 0, math.radians(-40))
    w = bpy.data.worlds.new('review_world')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    sky = w.node_tree.nodes.new('ShaderNodeTexSky')
    w.node_tree.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.4
    sc.world = w
    # A ground plane, grey asphalt-like, so the car sits on something and shadows read.
    me = bpy.data.meshes.new('review_ground')
    me.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [(0, 1, 2, 3)])
    g = bpy.data.objects.new('review_ground', me)
    sc.collection.objects.link(g)
    gm = bpy.data.materials.new('review_ground')
    gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.12, 0.12, 0.12, 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.85
    me.materials.append(gm)
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'OPTIX'
        prefs.refresh_devices()
        for d in prefs.devices:
            d.use = d.type == 'OPTIX'
        sc.cycles.device = 'GPU'
    except Exception:
        sc.cycles.device = 'CPU'
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED ' + out)


def main(a):
    open_file(a[0])
    if a[1] == 'stats':
        stats()
    elif a[1] == 'render':
        f = [float(x) for x in a[3:]]
        lens = f[6] if len(f) > 6 else 50
        size = (int(f[7]), int(f[8])) if len(f) > 8 else (1600, 1000)
        samples = int(f[9]) if len(f) > 9 else 96
        render(a[2], tuple(f[0:3]), tuple(f[3:6]), lens, size, samples)


main(sys.argv[sys.argv.index('--') + 1:])
