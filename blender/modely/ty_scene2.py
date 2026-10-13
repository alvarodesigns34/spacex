# Tesla Model Y 2025 - v2 look development: richer materials, HDRI-assisted studio with cyclorama, gradient softboxes, DOF.
import os


def _noise_ramp(nt, scale, lo, hi, detail=4.0, rough=0.6):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    tx = nt.nodes.new('ShaderNodeTexNoise')
    tx.inputs['Scale'].default_value = scale; tx.inputs['Detail'].default_value = detail; tx.inputs['Roughness'].default_value = rough
    nt.links.new(tc.outputs['Object'], tx.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.3; mr.inputs['From Max'].default_value = 0.7
    mr.inputs['To Min'].default_value = lo; mr.inputs['To Max'].default_value = hi
    nt.links.new(tx.outputs[0], mr.inputs['Value'])
    return mr.outputs[0]


def build_materials_v2():
    build_materials()
    # ---- Ultra Red: deep candy base + sparkling flake layer + clear coat with faint orange peel
    m, nt, b, out = pbr("TY_Paint_UltraRed", base=(0.30, 0.004, 0.008, 1), metal=0.50, rough=0.27,
                        coat=1.0, coat_rough=0.016, coat_ior=1.6, spec=0.5)
    m.diffuse_color = (0.55, 0.02, 0.03, 1)
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.30
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (0.30, 0.004, 0.008, 1)
    mix.inputs['B'].default_value = (0.045, 0.000, 0.002, 1)
    nt.links.new(lw.outputs['Facing'], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    add_bump(nt, b, 16000.0, 0.38, 'VORONOI', dist=0.00012)
    add_bump(nt, b, 110.0, 0.030, 'NOISE', 1.0, 0.00010, inp='Coat Normal')
    b.inputs['Coat Tint'].default_value = (1.0, 0.80, 0.80, 1)

    # ---- glazing: tint is per surface, panes are solid (two surfaces)
    glass("TY_Glass_Clear", (0.905, 0.955, 0.930, 1), view=(0.25, 0.3, 0.3, 1))
    glass("TY_Glass_Tinted", (0.50, 0.545, 0.54, 1), view=(0.05, 0.06, 0.06, 1))
    glass("TY_Glass_Roof", (0.36, 0.40, 0.40, 1), view=(0.03, 0.035, 0.04, 1))
    glass("TY_Lens_Smoke", (0.42, 0.10, 0.10, 1), ior=1.49, view=(0.1, 0.0, 0.0, 1))
    glass("TY_Lens_Clear", (0.96, 0.98, 1.0, 1), ior=1.49)

    # ---- rubber, discs, plastics
    m, nt, b, out = pbr("TY_Rubber_Tire", base=(0.017, 0.017, 0.018, 1), rough=0.80, spec=0.28)
    add_bump(nt, b, 900.0, 0.12, 'NOISE', 5.0, 0.0003)
    nt.links.new(_noise_ramp(nt, 14.0, 0.70, 0.90), b.inputs['Roughness'])
    m, nt, b, out = pbr("TY_Brake_Disc", base=(0.50, 0.50, 0.51, 1), metal=1.0, rough=0.30, aniso=0.7)
    tc = nt.nodes.new('ShaderNodeTexCoord'); wv = nt.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'RINGS'; wv.rings_direction = 'Y'; wv.inputs['Scale'].default_value = 260.0; wv.inputs['Distortion'].default_value = 0.4
    nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.12; bp.inputs['Distance'].default_value = 0.0002
    nt.links.new(wv.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs[0], b.inputs['Normal'])
    m, nt, b, out = pbr("TY_Plastic_Textured", base=(0.020, 0.020, 0.021, 1), rough=0.62, spec=0.32)
    add_bump(nt, b, 2600.0, 0.35, 'VORONOI', dist=0.00025)
    m, nt, b, out = pbr("TY_Alloy_Graphite", base=(0.20, 0.205, 0.215, 1), metal=1.0, rough=0.26, coat=0.8, coat_rough=0.06)
    add_bump(nt, b, 9000.0, 0.10, 'VORONOI', dist=0.0001)
    pbr("TY_Emit_DRL_White", base=(0.9, 0.9, 0.9, 1), emit=(1.0, 0.97, 0.93, 1), emit_s=32.0, rough=0.2)
    pbr("TY_Emit_Tail_Red", base=(0.5, 0.0, 0.0, 1), emit=(1.0, 0.010, 0.004, 1), emit_s=20.0, rough=0.2)

    # ---- interior: black & white trim
    m, nt, b, out = pbr("TY_Int_Leather_White", base=(0.74, 0.73, 0.71, 1), rough=0.46, spec=0.4, sheen=0.1)
    add_bump(nt, b, 2600.0, 0.20, 'VORONOI', dist=0.00025)
    nt.links.new(_noise_ramp(nt, 30.0, 0.40, 0.54), b.inputs['Roughness'])
    m, nt, b, out = pbr("TY_Int_Leather_White_Perf", base=(0.72, 0.71, 0.69, 1), rough=0.50, spec=0.4)
    tx = add_bump(nt, b, 650.0, 0.9, 'VORONOI', dist=0.0005)
    m, nt, b, out = pbr("TY_Int_Leather_Black", base=(0.016, 0.016, 0.017, 1), rough=0.50, spec=0.4)
    add_bump(nt, b, 2600.0, 0.22, 'VORONOI', dist=0.00025)
    m, nt, b, out = pbr("TY_Int_Fabric_Grey", base=(0.33, 0.335, 0.34, 1), rough=0.95, sheen=0.7, sheen_rough=0.5, spec=0.15)
    add_bump(nt, b, 2400.0, 0.7, 'NOISE', 8.0, 0.0005)
    m, nt, b, out = pbr("TY_Int_Headliner", base=(0.13, 0.13, 0.135, 1), rough=0.95, sheen=0.6, spec=0.12)
    add_bump(nt, b, 3500.0, 0.5, 'NOISE', 6.0, 0.0003)
    pbr("TY_Emit_Ambient", base=(0.8, 0.8, 0.8, 1), emit=(0.55, 0.75, 1.0, 1), emit_s=6.0)

    # ---- studio surfaces
    m, nt, b, out = pbr("TY_Studio_Floor", base=(0.16, 0.16, 0.165, 1), rough=0.16, spec=0.5)
    nt.links.new(_noise_ramp(nt, 1.6, 0.07, 0.24, 8.0, 0.7), b.inputs['Roughness'])
    add_bump(nt, b, 3.0, 0.02, 'NOISE', 8.0, 0.002)
    pbr("TY_Studio_Wall", base=(0.20, 0.20, 0.21, 1), rough=0.75, spec=0.2)


def build_studio_v2():
    clear_prefix("TY_Studio_"); clear_prefix("TY_Light_")
    coll = sub("Presentation")
    # round cyclorama: polished floor + matte wall with a large fillet
    Rr, fil = 19.0, 4.0
    a = np.linspace(0, math.pi / 2, 12)
    prof = [(0.0, 0.0), (Rr - fil, 0.0)] + [(Rr - fil + fil * math.sin(t), fil - fil * math.cos(t)) for t in a[1:]] + [(Rr, 11.0)]
    th = np.linspace(0, 2 * math.pi, 96, endpoint=False)
    def ring(pts):
        p = np.array(pts)
        return np.stack([p[:, 0][:, None] * np.cos(th)[None], p[:, 0][:, None] * np.sin(th)[None], p[:, 1][:, None] + 0 * th[None]], 2)
    mb = MeshB(); mb.grid(ring(prof[:2]), closed_u=True)
    mb.build("TY_Studio_Floor", coll, "TY_Studio_Floor", weld=1e-5, parent=False)
    mb = MeshB(); mb.grid(ring(prof[1:]), closed_u=True)
    mb.build("TY_Studio_Wall", coll, "TY_Studio_Wall", weld=None, parent=False)

    def area(name, loc, rot, size, power, color=(1, 1, 1), grad=True):
        L = bpy.data.lights.new(name, 'AREA')
        L.shape = 'RECTANGLE'; L.size, L.size_y = size
        L.energy = power; L.color = color
        if grad:   # soft-edged emission so reflections read as gradients, not hard rectangles
            L.use_nodes = True
            nt = L.node_tree
            em = nt.nodes.get('Emission') or nt.nodes.new('ShaderNodeEmission')
            geo = nt.nodes.new('ShaderNodeNewGeometry')
            sep = nt.nodes.new('ShaderNodeSeparateXYZ')
            nt.links.new(geo.outputs['Parametric'], sep.inputs[0])
            outs = []
            for ax in ('X', 'Y'):
                m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY_ADD'; m1.inputs[1].default_value = 2.0; m1.inputs[2].default_value = -1.0
                nt.links.new(sep.outputs[ax], m1.inputs[0])
                m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'POWER'; m2.inputs[1].default_value = 2.0
                m3 = nt.nodes.new('ShaderNodeMath'); m3.operation = 'ABSOLUTE'
                nt.links.new(m1.outputs[0], m3.inputs[0]); nt.links.new(m3.outputs[0], m2.inputs[0])
                m4 = nt.nodes.new('ShaderNodeMath'); m4.operation = 'SUBTRACT'; m4.inputs[0].default_value = 1.0
                nt.links.new(m2.outputs[0], m4.inputs[1])
                outs.append(m4.outputs[0])
            mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'
            nt.links.new(outs[0], mm.inputs[0]); nt.links.new(outs[1], mm.inputs[1])
            ms = nt.nodes.new('ShaderNodeMath'); ms.operation = 'MULTIPLY'; ms.inputs[1].default_value = 2.2
            nt.links.new(mm.outputs[0], ms.inputs[0])
            nt.links.new(ms.outputs[0], em.inputs['Strength'])
        ob = bpy.data.objects.new(name, L)
        ob.location = loc; ob.rotation_euler = [math.radians(v) for v in rot]
        coll.objects.link(ob)
        return ob
    area("TY_Light_Top_Softbox", (0.3, 0.0, 4.6), (0, 0, 0), (9.5, 4.2), 500)
    area("TY_Light_Side_Strip_L", (0.0, -6.0, 2.7), (64, 0, 0), (10.0, 1.8), 400)
    area("TY_Light_Side_Strip_R", (0.0, 6.0, 2.9), (-64, 0, 0), (10.0, 1.8), 250)
    area("TY_Light_Front_Fill", (-7.5, 0, 2.6), (0, -66, 0), (2.6, 6.0), 170)
    area("TY_Light_Rear_Fill", (7.5, 0, 2.8), (0, 66, 0), (2.6, 6.0), 170)
    area("TY_Light_Wall_Wash", (0, 0, 9.0), (0, 0, 0), (30, 30), 330, grad=False)
    fill = area("TY_Light_Interior_Fill", (0.15, 0, 1.40), (0, 0, 0), (0.9, 0.7), 4, (1.0, 0.97, 0.93), grad=False)
    fill.visible_camera = False; fill.visible_glossy = False; fill.visible_transmission = False
    for i, yy in enumerate((-2.1, 0.0, 2.1)):
        area("TY_Light_Tube_%d" % (i + 1), (0.2, yy, 4.0), (0, 0, 0), (11.0, 0.10), 130, grad=False)
    wash = bpy.data.objects["TY_Light_Wall_Wash"]
    wash.visible_camera = False; wash.visible_glossy = False

    # world: Blender's bundled studio HDRI adds detail to reflections; packed into the file
    w = bpy.data.worlds.get("TY_World") or bpy.data.worlds.new("TY_World")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    outn = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    info = "none"
    try:
        d = os.path.join(bpy.utils.system_resource('DATAFILES'), 'studiolights', 'world')
        names = sorted(os.listdir(d))
        pick = next((n for n in ("interior.exr", "studio.exr", "city.exr") if n in names), names[0])
        img = bpy.data.images.load(os.path.join(d, pick), check_existing=True)
        img.name = "TY_HDRI_" + pick
        img.pack()
        env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = img
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(70))
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs[0], env.inputs['Vector'])
        nt.links.new(env.outputs[0], bg.inputs[0])
        bg.inputs[1].default_value = 0.7
        info = pick + " of " + ",".join(names)
    except Exception as ex:
        bg.inputs[0].default_value = (0.05, 0.05, 0.055, 1)
        info = "fallback: " + str(ex)
    nt.links.new(bg.outputs[0], outn.inputs[0])
    bpy.context.scene.world = w
    return info


def build_cameras_v2():
    build_cameras()
    for nm, (loc, tgt, lens) in CAMS.items():
        cam = bpy.data.objects["TY_Cam_" + nm]
        d = (Vector(tgt) - Vector(loc)).length
        cam.data.dof.use_dof = not nm.startswith("Interior") and nm != "Top"
        cam.data.dof.focus_distance = d
        cam.data.dof.aperture_fstop = 5.6 if nm.startswith("Detail") else 9.0
