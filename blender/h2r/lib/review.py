"""
Review renders made in Blender itself: the side view at 1 px = 1 mm over the same frame as the
calibrated right-side photograph's warp (x from -0.9 to 0.9 m, y from 0 to 1.2 m, the photograph
itself never in the repository), and free three-quarter views. Workbench (fast, flat-lit shapes)
or Eevee (materials).
"""
import math

import bpy
from mathutils import Vector


def _camera(name, loc, target, ortho=None, lens=50):
    cam = bpy.data.cameras.new(name)
    if ortho:
        cam.type = 'ORTHO'; cam.ortho_scale = ortho
    else:
        cam.lens = lens
    cam.clip_start = 0.01; cam.clip_end = 100
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def lighting():
    """A physical sky and its sun (late morning), and a ground, for Eevee and Cycles reviews."""
    s = bpy.context.scene
    w = s.world or bpy.data.worlds.new('review-world'); s.world = w
    w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(38); sky.sun_rotation = math.radians(140)
    except (TypeError, AttributeError):
        pass
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 0.35
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], out.inputs[0])
    if not bpy.data.objects.get('review-ground'):
        bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
        g = bpy.context.object; g.name = 'review-ground'
        m = bpy.data.materials.new('review-asphalt'); m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.08, 0.08, 0.085, 1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
        g.data.materials.append(m)
        sun = bpy.data.lights.new('review-sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(1.5)
        so = bpy.data.objects.new('review-sun', sun); s.collection.objects.link(so)
        so.rotation_euler = (math.radians(52), 0, math.radians(140))


def blender_xyz(x, y, z):
    """The model's frame (three.js: x forward, y up, z right) in Blender's (z up): X = x, Y = -z, Z = y."""
    return (x, -z, y)


OBJECT_COLOURS = ['MATERIAL']


def render(path, cam, engine='BLENDER_WORKBENCH', w=1800, h=1200, samples=16):
    s = bpy.context.scene
    s.camera = cam
    s.render.engine = engine
    s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = w, h, 100
    s.render.film_transparent = False
    if engine == 'BLENDER_WORKBENCH':
        s.display.shading.light = 'STUDIO'; s.display.shading.color_type = OBJECT_COLOURS[0]
        s.display.shading.show_cavity = True; s.display.shading.show_shadows = False
    elif engine == 'BLENDER_EEVEE':
        s.eevee.taa_render_samples = samples
    else:
        s.cycles.samples = samples
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)


def side_mm(path, engine='BLENDER_WORKBENCH', by_object=False):
    """The right side, orthographic, 1800 x 1200 px over x -0.9..0.9, y 0..1.2 m: pixel (i, j) is
    x = -0.9 + i/1000, y = 1.2 - j/1000 (the photograph's warp, model_mm.png, is the same grid)."""
    cam = _camera('review-side', blender_xyz(0.0, 0.6, 5.0), blender_xyz(0.0, 0.6, 0.0), ortho=1.8)
    OBJECT_COLOURS[0] = 'RANDOM' if by_object else 'MATERIAL'
    render(path, cam, engine)
    bpy.data.objects.remove(cam, do_unlink=True)


def view(path, eye, target, lens=50, engine='BLENDER_WORKBENCH', w=1280, h=720, samples=16):
    """A perspective view, eye and target in the model's frame."""
    cam = _camera('review-view', blender_xyz(*eye), blender_xyz(*target), lens=lens)
    render(path, cam, engine, w, h, samples)
    bpy.data.objects.remove(cam, do_unlink=True)


__all__ = ['side_mm', 'view', 'blender_xyz', 'math']
