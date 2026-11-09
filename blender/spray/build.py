"""
Water-spray sprite atlas for the splashes (9-11-2026, audit block 3).

Until then the water thrown up by the re-entry's splashdown was drawn with the steam puffs' atlas
(src/sim/plume.js puffTexture): cauliflower domes, which read as cotton wool, not water. This
renders, in Blender (Cycles, headless), sixteen clusters of water in a 4 × 4 atlas with the same
encoding the vapour shader reads (src/sim/plume.js VAPOR_FRAG): RGB the surface normal in camera
space packed to 0..1, A the coverage. Each cluster is a crown of droplets with power-law sizes,
some drawn out into streaks along their flight, and a few thin torn sheets — the look of spray
in splash photographs (≈: shapes by hand, not a fluid simulation).

    blender -b --factory-startup --python blender/spray/build.py -- <out.png>

Seeded: the same atlas every run. Needs Pillow-free Blender only; the atlas is composed in numpy.
"""
import bpy, math, random, sys, os
import numpy as np

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/spray-atlas.png'
CELL, N = 256, 4
rng = random.Random(1309)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = CELL
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '16'
scene.view_settings.view_transform = 'Standard'
scene.display_settings.display_device = 'sRGB'
scene.sequencer_colorspace_settings.name = 'Non-Color' if hasattr(scene, 'sequencer_colorspace_settings') else None

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 2.0
cam = bpy.data.objects.new('cam', cam_data)
cam.location = (0, -10, 0)
cam.rotation_euler = (math.pi / 2, 0, 0)       # looking along +Y, Z up
scene.collection.objects.link(cam)
scene.camera = cam

# Emission of the camera-space normal, packed: the image IS the normal map (no lighting).
mat = bpy.data.materials.new('normal')
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
geo = nt.nodes.new('ShaderNodeNewGeometry')
vt = nt.nodes.new('ShaderNodeVectorTransform')
vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'CAMERA'
# Blender's camera space looks down −Z with +Y up; the vapour shader's +Z faces the viewer.
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
comb = nt.nodes.new('ShaderNodeCombineXYZ')
neg = nt.nodes.new('ShaderNodeMath'); neg.operation = 'MULTIPLY'; neg.inputs[1].default_value = -1.0
mad = nt.nodes.new('ShaderNodeVectorMath'); mad.operation = 'MULTIPLY_ADD'
mad.inputs[1].default_value = (0.5, 0.5, 0.5); mad.inputs[2].default_value = (0.5, 0.5, 0.5)
em = nt.nodes.new('ShaderNodeEmission')
outn = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(geo.outputs['Normal'], vt.inputs['Vector'])
nt.links.new(vt.outputs['Vector'], sep.inputs['Vector'])
nt.links.new(sep.outputs['X'], comb.inputs['X'])
nt.links.new(sep.outputs['Y'], comb.inputs['Y'])
nt.links.new(sep.outputs['Z'], neg.inputs[0])
nt.links.new(neg.outputs[0], comb.inputs['Z'])
nt.links.new(comb.outputs['Vector'], mad.inputs[0])
nt.links.new(mad.outputs['Vector'], em.inputs['Color'])
nt.links.new(em.outputs['Emission'], outn.inputs['Surface'])

def sphere(x, z, r, sx=1.0, sz=1.0, rot=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r, location=(x, 0, z))
    o = bpy.context.active_object
    o.scale = (sx, 1.0, sz)
    o.rotation_euler = (0, rot, 0)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o

def cluster(seed):
    r = random.Random(seed)
    objs = []
    kind = seed % 4
    # A crown or a plume, centred low in the cell so a sprite's base sits on the water.
    for _ in range(r.randint(70, 140)):
        a = r.uniform(-math.pi * 0.95, math.pi * 0.95) * (0.5 if kind == 0 else 1.0)
        d = abs(r.gauss(0, 0.42))
        x = math.sin(a) * d
        z = -0.55 + abs(math.cos(a)) * d * (1.6 if kind != 2 else 1.0) + r.uniform(0, 0.25)
        if abs(x) > 0.9 or z > 0.9 or z < -0.92:
            continue
        rad = 0.012 + 0.07 * r.random() ** 3.2          # many small, few large
        streak = r.random() < 0.35
        if streak:
            # Drawn out along its flight: away from the centre and up.
            ang = math.atan2(x, z + 0.6)
            objs.append(sphere(x, z, rad, 0.55, 2.6 + 2.5 * r.random(), ang))
        else:
            objs.append(sphere(x, z, rad))
    # Thin, torn sheets at the base (the splash's skirt).
    for _ in range(r.randint(2, 5)):
        x = r.uniform(-0.6, 0.6)
        objs.append(sphere(x, -0.62 + r.uniform(0, 0.15), r.uniform(0.08, 0.16), 1.8 + r.random(), 0.22, r.uniform(-0.5, 0.5)))
    return objs

atlas = np.zeros((CELL * N, CELL * N, 4), dtype=np.float32)
tmp = os.path.join(os.path.dirname(out) or '.', '_spray_cell.png')
for c in range(N * N):
    objs = cluster(1309 + c * 7)
    scene.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)[::-1]   # top row first
    bpy.data.images.remove(img)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    cy, cx = divmod(c, N)
    atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = px
    print(f'cell {c + 1}/{N * N}', flush=True)
os.remove(tmp)

# Straight alpha: the normal is valid where there is coverage; elsewhere the flat (0.5, 0.5, 1).
a = atlas[..., 3:4]
flat = np.array([0.5, 0.5, 1.0], dtype=np.float32)
rgb = np.where(a > 1e-4, atlas[..., :3] / np.maximum(a, 1e-4), flat)
atlas[..., :3] = np.clip(rgb, 0, 1)
img = bpy.data.images.new('spray', CELL * N, CELL * N, alpha=True, float_buffer=False)
img.colorspace_settings.name = 'Non-Color'
img.pixels[:] = atlas[::-1].ravel()
img.filepath_raw = out
img.file_format = 'PNG'
img.save()
print('written', out)
