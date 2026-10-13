# Tesla Model Y 2025 - PBR materials (Cycles), studio lighting, cameras and render helpers.
def _new(name, view=(0.5, 0.5, 0.5, 1)):
    m = get_mat(name)
    m.diffuse_color = view
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (500, 0)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled'); b.location = (100, 0)
    nt.links.new(b.outputs[0], out.inputs[0])
    return m, nt, b, out


def _set(b, **kw):
    names = {'base': 'Base Color', 'metal': 'Metallic', 'rough': 'Roughness', 'ior': 'IOR', 'coat': 'Coat Weight',
             'coat_rough': 'Coat Roughness', 'coat_ior': 'Coat IOR', 'sheen': 'Sheen Weight', 'sheen_rough': 'Sheen Roughness',
             'trans': 'Transmission Weight', 'emit': 'Emission Color', 'emit_s': 'Emission Strength', 'spec': 'Specular IOR Level',
             'alpha': 'Alpha', 'coat_tint': 'Coat Tint', 'aniso': 'Anisotropic'}
    for k, v in kw.items():
        if names[k] in b.inputs:
            b.inputs[names[k]].default_value = v


def pbr(name, **kw):
    base = kw.get('base', (0.5, 0.5, 0.5, 1))
    m, nt, b, out = _new(name, base)
    _set(b, **kw)
    return m, nt, b, out


def add_bump(nt, b, scale, strength, kind='NOISE', detail=2.0, dist=0.001, inp='Normal'):
    tc = nt.nodes.new('ShaderNodeTexCoord'); tc.location = (-700, -300)
    if kind == 'NOISE':
        tx = nt.nodes.new('ShaderNodeTexNoise'); tx.inputs['Scale'].default_value = scale; tx.inputs['Detail'].default_value = detail
        o = tx.outputs[0]
    else:
        tx = nt.nodes.new('ShaderNodeTexVoronoi'); tx.inputs['Scale'].default_value = scale
        o = tx.outputs['Distance']
    tx.location = (-500, -300)
    nt.links.new(tc.outputs['Object'], tx.inputs['Vector'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.location = (-250, -300)
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = dist
    nt.links.new(o, bp.inputs['Height'])
    nt.links.new(bp.outputs[0], b.inputs[inp])
    return tx


def glass(name, tint, rough=0.0, ior=1.52, view=(0.1, 0.12, 0.13, 1)):
    """Glass that lets shadow rays through (tinted), so the cabin is lit without noisy caustics."""
    m, nt, b, out = _new(name, view)
    _set(b, base=tint, trans=1.0, rough=rough, ior=ior)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.location = (100, -350)
    tr.inputs[0].default_value = tint
    lp = nt.nodes.new('ShaderNodeLightPath'); lp.location = (-200, 300)
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.location = (320, 0)
    nt.links.new(lp.outputs['Is Shadow Ray'], mx.inputs[0])
    nt.links.new(b.outputs[0], mx.inputs[1])
    nt.links.new(tr.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    return m


def build_materials():
    # ---- Ultra Red multi-coat: tinted metallic base with fine flake normals under a smooth clear coat
    m, nt, b, out = pbr("TY_Paint_UltraRed", base=(0.33, 0.006, 0.010, 1), metal=0.55, rough=0.36,
                        coat=1.0, coat_rough=0.025, coat_ior=1.55, spec=0.5)
    m.diffuse_color = (0.55, 0.02, 0.03, 1)
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.location = (-500, 250); lw.inputs['Blend'].default_value = 0.35
    ramp = nt.nodes.new('ShaderNodeMix'); ramp.data_type = 'RGBA'; ramp.location = (-250, 250)
    ramp.inputs['A'].default_value = (0.46, 0.010, 0.014, 1)      # facing
    ramp.inputs['B'].default_value = (0.12, 0.000, 0.004, 1)      # grazing: darker, deeper red
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Factor'])
    nt.links.new(ramp.outputs['Result'], b.inputs['Base Color'])
    add_bump(nt, b, 9000.0, 0.10, 'VORONOI', dist=0.0002)
    b.inputs['Coat Tint'].default_value = (1.0, 0.86, 0.86, 1)

    glass("TY_Glass_Clear", (0.86, 0.93, 0.90, 1))
    glass("TY_Glass_Tinted", (0.10, 0.12, 0.125, 1), view=(0.03, 0.035, 0.04, 1))
    glass("TY_Lens_Clear", (0.95, 0.97, 1.0, 1), ior=1.49)
    glass("TY_Lens_Red", (0.55, 0.004, 0.006, 1), ior=1.49, view=(0.4, 0.0, 0.0, 1))
    pbr("TY_Black_Gloss", base=(0.006, 0.006, 0.007, 1), rough=0.06, coat=1.0, coat_rough=0.03)
    m, nt, b, out = pbr("TY_Plastic_Textured", base=(0.016, 0.016, 0.017, 1), rough=0.58, spec=0.35)
    add_bump(nt, b, 1400.0, 0.25, 'NOISE', 4.0, 0.0004)
    pbr("TY_Plastic_Satin", base=(0.012, 0.012, 0.013, 1), rough=0.34, spec=0.45)
    m, nt, b, out = pbr("TY_Rubber_Tire", base=(0.011, 0.011, 0.012, 1), rough=0.72, spec=0.32)
    add_bump(nt, b, 600.0, 0.08, 'NOISE', 3.0, 0.0003)
    pbr("TY_Alloy_Graphite", base=(0.20, 0.205, 0.215, 1), metal=1.0, rough=0.30, coat=0.6, coat_rough=0.08)
    pbr("TY_Alloy_Barrel", base=(0.045, 0.046, 0.050, 1), metal=1.0, rough=0.42)
    pbr("TY_Brake_Disc", base=(0.46, 0.46, 0.47, 1), metal=1.0, rough=0.33, aniso=0.6)
    pbr("TY_Caliper", base=(0.035, 0.036, 0.040, 1), metal=0.3, rough=0.4, coat=0.7, coat_rough=0.1)
    pbr("TY_Chrome", base=(0.86, 0.87, 0.88, 1), metal=1.0, rough=0.07)
    pbr("TY_Body_Inner", base=(0.02, 0.02, 0.021, 1), rough=0.6)
    pbr("TY_Liner_Black", base=(0.010, 0.010, 0.010, 1), rough=0.92, spec=0.2)
    pbr("TY_Mirror_Glass", base=(0.92, 0.94, 0.95, 1), metal=1.0, rough=0.005)
    pbr("TY_Plate_White", base=(0.82, 0.82, 0.80, 1), rough=0.35, coat=0.5)
    pbr("TY_Plate_Black", base=(0.012, 0.012, 0.012, 1), rough=0.45)
    pbr("TY_Emit_DRL_White", base=(0.9, 0.9, 0.9, 1), emit=(1.0, 0.96, 0.90, 1), emit_s=22.0, rough=0.2)
    pbr("TY_Emit_Tail_Red", base=(0.5, 0.0, 0.0, 1), emit=(1.0, 0.012, 0.006, 1), emit_s=14.0, rough=0.2)
    # ---- interior
    m, nt, b, out = pbr("TY_Int_Leather_Black", base=(0.014, 0.014, 0.015, 1), rough=0.52, spec=0.4)
    add_bump(nt, b, 2600.0, 0.22, 'VORONOI', dist=0.0003)
    m, nt, b, out = pbr("TY_Int_Leather_Perforated", base=(0.016, 0.016, 0.017, 1), rough=0.55, spec=0.4)
    add_bump(nt, b, 900.0, 0.5, 'VORONOI', dist=0.0004)
    m, nt, b, out = pbr("TY_Int_Fabric_Grey", base=(0.075, 0.077, 0.082, 1), rough=0.95, sheen=0.6, sheen_rough=0.5, spec=0.2)
    add_bump(nt, b, 3200.0, 0.5, 'NOISE', 6.0, 0.0004)
    m, nt, b, out = pbr("TY_Int_Carpet", base=(0.012, 0.012, 0.013, 1), rough=1.0, sheen=0.4, spec=0.1)
    add_bump(nt, b, 5000.0, 0.8, 'NOISE', 2.0, 0.0008)
    m, nt, b, out = pbr("TY_Int_Headliner", base=(0.035, 0.035, 0.037, 1), rough=0.95, sheen=0.5, spec=0.15)
    add_bump(nt, b, 4000.0, 0.4, 'NOISE', 4.0, 0.0003)
    m, nt, b, out = pbr("TY_Int_Plastic_Soft", base=(0.018, 0.018, 0.019, 1), rough=0.62, spec=0.35)
    add_bump(nt, b, 2200.0, 0.18, 'NOISE', 4.0, 0.0003)
    pbr("TY_Int_Plastic_Hard", base=(0.014, 0.014, 0.015, 1), rough=0.42, spec=0.4)
    pbr("TY_Int_Aluminium", base=(0.55, 0.56, 0.57, 1), metal=1.0, rough=0.28)
    pbr("TY_Int_Stitch", base=(0.30, 0.30, 0.31, 1), rough=0.8)
    pbr("TY_Int_Belt", base=(0.02, 0.02, 0.021, 1), rough=0.75, sheen=0.3)
    pbr("TY_Int_Buckle_Red", base=(0.5, 0.01, 0.01, 1), rough=0.4)
    pbr("TY_Int_Rubber", base=(0.012, 0.012, 0.012, 1), rough=0.8)
    pbr("TY_Int_Speaker_Mesh", base=(0.02, 0.02, 0.021, 1), metal=0.6, rough=0.5)
    pbr("TY_Emit_Ambient", base=(0.8, 0.8, 0.8, 1), emit=(0.85, 0.90, 1.0, 1), emit_s=4.0)
    pbr("TY_Emit_Dome", base=(0.8, 0.8, 0.8, 1), emit=(1.0, 0.95, 0.88, 1), emit_s=1.5)
    # studio
    pbr("TY_Studio_Floor", base=(0.105, 0.105, 0.11, 1), rough=0.30, spec=0.5)
    pbr("TY_Studio_Softbox", base=(1, 1, 1, 1), emit=(1, 1, 1, 1), emit_s=1.0)


def build_studio():
    clear_prefix("TY_Studio_"); clear_prefix("TY_Light_")
    coll = sub("Presentation")
    # large studio floor; the local lighting lets it fall off into the dark background
    mb = MeshB()
    g = np.linspace(-45, 45, 3)
    mb.grid(np.stack([np.broadcast_to(g[None, :], (3, 3)), np.broadcast_to(g[:, None], (3, 3)), np.zeros((3, 3))], 2))
    o = mb.build("TY_Studio_Floor", coll, "TY_Studio_Floor", weld=None, parent=False)
    def area(name, loc, rot, size, power, color=(1, 1, 1), spread=math.radians(150)):
        L = bpy.data.lights.new(name, 'AREA')
        L.shape = 'RECTANGLE'; L.size, L.size_y = size
        L.energy = power; L.color = color
        L.spread = spread
        ob = bpy.data.objects.new(name, L)
        ob.location = loc; ob.rotation_euler = [math.radians(a) for a in rot]
        coll.objects.link(ob)
        return ob
    area("TY_Light_Top_Softbox", (0, 0, 4.2), (0, 0, 0), (7.5, 3.2), 330)
    area("TY_Light_Side_Strip_L", (0.0, -5.2, 2.4), (62, 0, 0), (8.5, 1.3), 230)
    area("TY_Light_Side_Strip_R", (0.0, 5.2, 2.6), (-62, 0, 0), (8.5, 1.3), 140)
    area("TY_Light_Front_Fill", (-6.5, 0, 2.2), (0, -68, 0), (2.2, 4.5), 110)
    area("TY_Light_Rear_Fill", (6.5, 0, 2.4), (0, 68, 0), (2.2, 4.5), 110)
    fill = area("TY_Light_Interior_Fill", (0.15, 0, 1.40), (0, 0, 0), (0.9, 0.7), 14, (1.0, 0.97, 0.93))
    fill.visible_camera = False; fill.visible_glossy = False; fill.visible_transmission = False
    area("TY_Light_Low_Kicker", (-3.5, -4.8, 0.5), (86, 0, -30), (3.0, 0.6), 30)
    w = bpy.data.worlds.get("TY_World") or bpy.data.worlds.new("TY_World")
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.020, 0.021, 0.024, 1)
        bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = w


CAMS = {
    "Hero_FrontQuarter": ((-6.4, -4.9, 1.45), (-0.05, 0.0, 0.68), 58),
    "RearQuarter": ((6.4, -4.9, 1.60), (0.05, 0.0, 0.72), 58),
    "Front": ((-9.5, 0.0, 0.95), (0, 0, 0.78), 85),
    "Rear": ((9.5, 0.0, 1.05), (0, 0, 0.80), 85),
    "Side": ((0.0, -11.5, 0.95), (0, 0, 0.80), 85),
    "Top": ((0.0, -0.001, 13.0), (0, 0, 0), 70),
    "Detail_Wheel": ((-2.75, -2.55, 0.62), (-1.445, -0.90, 0.37), 85),
    "Detail_Headlight": ((-3.75, -1.75, 0.95), (-2.20, -0.60, 0.72), 85),
    "Detail_Taillight": ((3.9, -1.9, 1.35), (2.25, -0.55, 1.02), 85),
    "Interior_From_Outside": ((-0.35, -2.65, 1.42), (-0.05, 0.0, 0.92), 40),
    "Interior_Driver": ((0.16, -0.37, 1.19), (-0.75, -0.14, 0.98), 18),
    "Interior_Rear_Seat": ((0.75, 0.0, 1.22), (-0.75, 0.0, 0.92), 18),
}


def build_cameras():
    clear_prefix("TY_Cam_")
    coll = sub("Presentation")
    for nm, (loc, tgt, lens) in CAMS.items():
        cam = bpy.data.objects.new("TY_Cam_" + nm, bpy.data.cameras.new("TY_Cam_" + nm))
        cam.location = loc
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        cam.data.sensor_width = 36
        cam.data.clip_start, cam.data.clip_end = 0.02, 200
        coll.objects.link(cam)
    bpy.context.scene.camera = bpy.data.objects["TY_Cam_Hero_FrontQuarter"]


def setup_render(samples=160, res=(1920, 1080)):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == 'OPTIX'
        sc.cycles.device = 'GPU'
    except Exception as ex:
        sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 10
    sc.cycles.transmission_bounces = 12
    sc.cycles.glossy_bounces = 6
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.render.film_transparent = False


def render_cam(name, path, samples=None, res=None):
    sc = bpy.context.scene
    old = (sc.camera, sc.cycles.samples, sc.render.resolution_x, sc.render.resolution_y)
    sc.camera = bpy.data.objects["TY_Cam_" + name]
    if samples:
        sc.cycles.samples = samples
    if res:
        sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'JPEG' if path.lower().endswith('jpg') else 'PNG'
    sc.render.image_settings.quality = 92
    bpy.ops.render.render(write_still=True)
    sc.camera, sc.cycles.samples, sc.render.resolution_x, sc.render.resolution_y = old
