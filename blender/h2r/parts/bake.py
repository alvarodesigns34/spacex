"""
Ambient occlusion baked into the model: the contact shadows in every corner, joint and recess (the
cylinders between the frame's tubes, the clutch cover against the case, a panel's edge over the
engine) that a real-time renderer's ambient light cannot find on its own. One atlas for the whole
bike on a second UV set ('ao'), baked by Cycles with every part present so that each shades the
others, exported as the glTF materials' occlusion texture (three.js: aoMap on UV channel 1, which
darkens only the ambient and environment light, as occlusion does).
"""
import os

import bpy

SIZE = 4096
SKIP_MATERIALS = ('h2r-screen', 'h2r-screen-inside', 'h2r-reservoir', 'h2r-reservoir-amber', 'h2r-tail-lamp', 'h2r-lcd', 'h2r-dash-face')


def _meshes():
    return [o for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith('review-')]


def _apply_modifiers(objs):
    """The final shapes (subdivision, walls, bevels) made real: the bake and the UVs need them."""
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError as e:
                print('modifier not applied', o.name, m.name, e)


def _unwrap(objs):
    """A second UV set on every mesh, all packed together into one atlas."""
    for o in objs:
        me = o.data
        if 'ao' not in me.uv_layers:
            me.uv_layers.new(name='ao')
        me.uv_layers.active = me.uv_layers['ao']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.002, area_weight=1.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=0.0015, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    # (The first set stays the one the materials' own textures use.)
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers[0]


def _gltf_settings_group():
    """The node group the glTF exporter reads the occlusion from ('glTF Material Output')."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g:
        return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def _wire(materials, image):
    group = _gltf_settings_group()
    # (A material without occlusion still needs an active image for Cycles to bake its objects:
    # a tiny one, wired to nothing.)
    dummy = bpy.data.images.get('ao-unused') or bpy.data.images.new('ao-unused', 8, 8)
    for m in materials:
        if m is None or not m.use_nodes:
            continue
        if m.name.split('.')[0] in SKIP_MATERIALS:
            t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = dummy; m.node_tree.nodes.active = t
            continue
        nt = m.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.name = tex.label = 'ao-bake'; tex.image = image
        tex.interpolation = 'Linear'
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'ao'
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
        out = nt.nodes.new('ShaderNodeGroup'); out.node_tree = group
        nt.links.new(sep.outputs[0], out.inputs['Occlusion'])
        nt.nodes.active = tex


def bake(cache_dir, samples=48):
    objs = _meshes()
    _apply_modifiers(objs)
    _unwrap(objs)
    image = bpy.data.images.new('h2r-ao', SIZE, SIZE, alpha=False, float_buffer=False)
    image.colorspace_settings.name = 'Non-Color'
    mats = {s.material for o in objs for s in o.material_slots}
    _wire(mats, image)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.render.bake.margin = 6
    if s.world is None:
        s.world = bpy.data.worlds.new('bake-world')
    s.world.light_settings.distance = 0.25          # occlusion within 25 cm
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='AO', uv_layer='ao', margin=6, use_clear=True)
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, 'h2r-ao.jpg')
    image.filepath_raw = path; image.file_format = 'JPEG'
    s.render.image_settings.quality = 92
    image.save()
    return path
