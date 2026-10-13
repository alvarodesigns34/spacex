# Debug preview of the raw design surfaces + quick render helper.
import os

def shot(path, loc, tgt, lens=70, ortho=None, res=(960, 540), engine='BLENDER_WORKBENCH', samples=48):
    sc = bpy.context.scene
    cam = bpy.data.objects.get("TY_cam_debug")
    if cam is None:
        cam = bpy.data.objects.new("TY_cam_debug", bpy.data.cameras.new("TY_cam_debug"))
        sc.collection.objects.link(cam)
    cam.location = loc
    d = Vector(tgt) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
    cam.data.clip_start, cam.data.clip_end = 0.05, 200
    old = (sc.camera, sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath)
    sc.camera = cam
    sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG' if path.lower().endswith('png') else 'JPEG'
    if engine == 'BLENDER_WORKBENCH':
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'MATERIAL'
        sh.show_cavity = True
        sh.show_specular_highlight = True
        sh.show_shadows = False
    elif engine == 'CYCLES':
        sc.cycles.samples = samples
    bpy.ops.render.render(write_still=True)
    sc.camera, sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath = old


def debug_surfaces():
    clear_prefix("DBG_")
    coll = get_coll("TY_DEBUG", get_coll(MAIN_COLL))
    mat = get_mat("TY_dbg")
    mb = MeshB()
    xs = np.linspace(XV_F, XV_R, 220)
    ss = np.linspace(0, 1, 90)
    V = M.eval(xs[None, :], ss[:, None])
    mb.grid(V, flip=True)
    xs = np.linspace(-0.86, XV_F, 20)
    ss = np.linspace(0, 0.33, 30)
    mb.grid(M.eval(xs[None, :], ss[:, None]), flip=True)
    xs = np.linspace(XV_R, 3.625, 12)
    ss = np.linspace(0, 0.33, 30)
    mb.grid(M.eval(xs[None, :], ss[:, None]), flip=True)
    for C, fl in ((CF, False), (CR, True)):
        xi = np.linspace(0, 1, 50)
        vv = np.linspace(0, 1, 50)
        mb.grid(C.eval(xi[None, :], vv[:, None]), flip=fl)
    o = mb.build("DBG_half", coll, mat, weld=0)
    m = o.modifiers.new("Mirror", 'MIRROR')
    m.use_axis = (False, True, False)
    # wheels as discs for proportion check
    for i, x in enumerate((0.0, WB)):
        for sgn in (1, -1):
            me = bpy.data.meshes.new("DBG_wheel")
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=TIRE_R, radius2=TIRE_R, depth=0.255)
            bm.to_mesh(me); bm.free()
            w = bpy.data.objects.new("DBG_wheel", me)
            w.rotation_euler = (math.pi / 2, 0, 0)
            w.location = (x, sgn * TRACK / 2, TIRE_R)
            coll.objects.link(w)
            w.parent = get_root()
    return o


def views(prefix, engine='BLENDER_WORKBENCH', which=("side", "front", "rear", "top", "fq", "rq")):
    cx = 0.0
    V = {
        "side": dict(loc=(cx, -30, 0.8), tgt=(cx, 0, 0.8), ortho=5.4),
        "front": dict(loc=(-30, 0, 0.8), tgt=(0, 0, 0.8), ortho=3.2),
        "rear": dict(loc=(30, 0, 0.8), tgt=(0, 0, 0.8), ortho=3.2),
        "top": dict(loc=(cx, 0, 30), tgt=(cx, 0.0001, 0), ortho=5.4),
        "fq": dict(loc=(-5.6, -4.2, 1.5), tgt=(-0.1, 0, 0.7), lens=60),
        "rq": dict(loc=(5.6, -4.2, 1.6), tgt=(0.1, 0, 0.7), lens=60),
    }
    out = []
    for k in which:
        p = os.path.join(OUT, f"{prefix}_{k}.jpg")
        shot(p, engine=engine, **V[k])
        out.append(p)
    return out
