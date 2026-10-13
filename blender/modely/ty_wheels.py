# Tesla Model Y 2025 - wheels (20" five-spoke alloy, 255/40R20), brakes, wheel wells, underbody.
# Wheel local frame: axis = Y, outer face towards +Y, centre at the origin.
RUBBER, ALLOY, ALLOY_DARK = "TY_Rubber_Tire", "TY_Alloy_Graphite", "TY_Alloy_Barrel"
DISC, CALIPER, CHROME, LINER = "TY_Brake_Disc", "TY_Caliper", "TY_Chrome", "TY_Liner_Black"
RIM_R = 0.254   # 20" bead seat radius


def lathe(prof, nseg, a0=0.0, a1=2 * math.pi, closed=True):
    prof = np.asarray(prof, float)
    th = np.linspace(a0, a1, nseg, endpoint=not closed)
    r, y = prof[:, 0][:, None], prof[:, 1][:, None]
    return np.stack([r * np.cos(th)[None], y + 0 * th[None], r * np.sin(th)[None]], 2)


def mesh_obj(name, mb, mats, coll="Wheels", recalc=True, sharp=35, parent=None):
    ob = mb.build(name, coll, mats, weld=1e-5, parent=False)
    if recalc:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data); bm.free()
    if sharp:
        ob.data.set_sharp_from_angle(angle=math.radians(sharp))
    if parent is not None:
        ob.parent = parent
    return ob


def curve_mesh(loops, depth, name="tmp"):
    """Filled, extruded 2D polygon(s) -> (verts, faces) in the XY plane, extruded along +/-Z."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = depth
    for lp in loops:
        sp = cu.splines.new('POLY')
        sp.points.add(len(lp) - 1)
        for p, c in zip(sp.points, lp):
            p.co = (c[0], c[1], 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    v = np.array([p.co[:] for p in me.vertices])
    f = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)
    return v, f


def text_mesh(body, size, depth):
    cu = bpy.data.curves.new("tmp_txt", 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth
    cu.align_x = 'CENTER'
    ob = bpy.data.objects.new("tmp_txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    v = np.array([p.co[:] for p in me.vertices])
    f = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)
    return v, f


def tesla_t(scale=1.0):
    """Stylised 'T' emblem outline loops (unit height), centred on x."""
    xs = np.linspace(-0.5, 0.5, 21)
    arc_o = [(x, 1.0 - 0.50 * x * x) for x in xs]
    arc_i = [(x, 0.925 - 0.42 * x * x) for x in xs[::-1]]
    top = [(x, 0.86 - 0.40 * x * x) for x in np.linspace(-0.455, 0.455, 17)]
    body = top[::-1] + [(-0.455, 0.735), (-0.30, 0.71), (-0.17, 0.665), (-0.095, 0.60), (-0.07, 0.40), (-0.04, 0.12),
                        (0.0, 0.0), (0.04, 0.12), (0.07, 0.40), (0.095, 0.60), (0.17, 0.665), (0.30, 0.71), (0.455, 0.735)]
    f = lambda L: [((x) * scale, (y - 0.5) * scale) for x, y in L]
    return [f(arc_o + arc_i), f(body)]


# ---------------------------------------------------------------- tyre
def build_tire_mesh():
    R = TIRE_R
    D = 0.0070
    grooves = [(0.062, 0.009), (0.021, 0.011), (-0.021, 0.011), (-0.062, 0.009)]
    EDGE = 0.104
    ys, dd, zone = [], [], []
    def rib(y0, y1, z):
        n = max(2, int(round(abs(y0 - y1) / 0.0055)))
        for y in np.linspace(y0, y1, n + 1)[1:-1]:
            ys.append(y); dd.append(0.0); zone.append(z)
    ys.append(EDGE); dd.append(0.0); zone.append(0)
    prev = EDGE
    for gi, (c, w) in enumerate(grooves):
        rib(prev, c + w / 2, gi)
        for y, d, z in ((c + w / 2, 0.0, gi), (c + w / 2 - 0.0012, D, -1), (c - w / 2 + 0.0012, D, -1), (c - w / 2, 0.0, gi + 1)):
            ys.append(y); dd.append(d); zone.append(z)
        prev = c - w / 2
    rib(prev, -EDGE, 4)
    ys.append(-EDGE); dd.append(0.0); zone.append(4)
    ys, dd, zone = np.array(ys), np.array(dd), np.array(zone)
    crown = R - 0.0042 * (np.abs(ys) / EDGE) ** 2.2
    side = catmull([(R - 0.0042, EDGE), (0.3490, 0.1135), (0.3430, 0.1220), (0.3340, 0.1285), (0.3200, 0.1330),
                    (0.3040, 0.1345), (0.2900, 0.1325), (0.2830, 0.1318), (0.2795, 0.1345), (0.2760, 0.1340),
                    (0.2732, 0.1290), (0.2690, 0.1240), (0.2620, 0.1210)], 26)
    side = polyline(side, 22)
    nso = len(side) - 1
    prof_r = np.r_[side[::-1][:-1, 0], crown, side[1:, 0]]
    prof_y = np.r_[side[::-1][:-1, 1], ys, -side[1:, 1]]
    prof_d = np.r_[np.zeros(nso), dd, np.zeros(nso)]
    prof_z = np.r_[np.zeros(nso, int), zone, np.full(nso, 4)]
    is_tread = np.r_[np.zeros(nso, bool), np.ones(len(ys), bool), np.zeros(nso, bool)]
    # shoulder slots also notch the first two sidewall-side samples
    NP = 64
    tq = np.array([0.0, 0.085, 0.105, 0.225, 0.245, 0.42, 0.585, 0.600, 0.650, 0.665, 0.84])
    slotA = np.array([0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0], float)       # shoulder slots
    sipeB = np.array([0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0], float)       # rib sipes
    th = (np.arange(NP)[:, None] + tq[None, :]).ravel() / NP * 2 * math.pi
    A = np.tile(slotA, NP); Bm = np.tile(sipeB, NP)
    nth = len(th)
    skew = 0.42 * (2 * math.pi / NP) * (np.abs(prof_y) / EDGE) ** 1.3
    TH = th[None, :] + skew[:, None]
    lat = np.zeros((len(prof_r), nth))
    sh = is_tread & ((prof_z == 0) | (prof_z == 4)) & (np.abs(prof_y) > 0.070)
    lat[sh] = A[None, :] * 0.0052
    # carry the slot a little onto the shoulder
    for k in np.where(~is_tread)[0]:
        if abs(prof_y[k]) < 0.1225 and prof_r[k] > 0.342:
            lat[k] = A * 0.0035
    rb = is_tread & ((prof_z == 1) | (prof_z == 3))
    lat[rb] = Bm[None, :] * 0.0035
    cz = is_tread & (prof_z == 2)
    lat[cz] = np.roll(Bm, 3)[None, :] * 0.0025
    depth = np.maximum(prof_d[:, None], lat)
    Rr = prof_r[:, None] - depth
    V = np.stack([Rr * np.cos(TH), prof_y[:, None] + 0 * TH, Rr * np.sin(TH)], 2)
    mb = MeshB()
    mb.grid(V, closed_u=True)
    # raised sidewall lettering on both sides
    sw_r, sw_y = side[::-1][:, 0], side[::-1][:, 1]
    for txt, ang, Rt, size in (("255/40 R20 101W XL", 90, 0.3170, 0.0125), ("255/40 R20 101W XL", 270, 0.3170, 0.0125),
                               ("RADIAL  TUBELESS", 0, 0.3010, 0.0080), ("RADIAL  TUBELESS", 180, 0.3010, 0.0080),
                               ("T0", 45, 0.3020, 0.0090), ("T0", 225, 0.3020, 0.0090)):
        tv_, tf_ = text_mesh(txt, size, 0.0006)
        xc = (tv_[:, 0].min() + tv_[:, 0].max()) / 2
        yc = (tv_[:, 1].min() + tv_[:, 1].max()) / 2
        for sgn in (1, -1):
            thx = math.radians(ang) + sgn * (tv_[:, 0] - xc) / Rt
            rr = Rt + (tv_[:, 1] - yc)
            yy = np.interp(rr, sw_r, sw_y) + tv_[:, 2] + 0.0002
            P = np.stack([rr * np.cos(thx), sgn * yy, rr * np.sin(thx)], 1)
            mb.raw(P, tf_)
    return mb


# ---------------------------------------------------------------- rim
def build_rim_mesh():
    mb = MeshB()
    barrel = [(0.2500, 0.1180), (0.2545, 0.1205), (0.2700, 0.1235), (0.2735, 0.1270), (0.2738, 0.1320), (0.2715, 0.1362),
              (0.2640, 0.1375), (0.2555, 0.1340), (0.2500, 0.1270), (0.2450, 0.1150), (0.2405, 0.0900), (0.2370, 0.0500),
              (0.2360, 0.0000), (0.2360, -0.0900), (0.2420, -0.1150), (0.2520, -0.1290), (0.2640, -0.1345), (0.2715, -0.1340),
              (0.2735, -0.1290), (0.2700, -0.1235), (0.2545, -0.1205), (0.2500, -0.1180), (0.2400, -0.0900), (0.2340, 0.0000),
              (0.2400, 0.0900)]
    mb.grid(lathe(barrel, 96), closed_u=True, closed_v=True, mat=1)
    # hub / centre section
    hub = [(0.0000, 0.0880), (0.0300, 0.0880), (0.0340, 0.0860), (0.0345, 0.0800), (0.0370, 0.0790), (0.0720, 0.0800),
           (0.0800, 0.0830), (0.0880, 0.0900), (0.0900, 0.0700), (0.0860, 0.0500), (0.0780, 0.0450), (0.0000, 0.0450)]
    mb.grid(lathe(hub, 60), closed_u=True, mat=0)
    # spokes: 5 pairs, twisting from the hub to the barrel
    r0, r1 = 0.074, 0.2440
    nt, ns = 28, 16
    for i in range(5):
        base = i * 2 * math.pi / 5
        for sgn in (-1, 1):
            t = np.linspace(0, 1, nt)
            r = r0 + (r1 - r0) * t
            phi = base + 0.22 * t ** 1.2 + sgn * (0.085 + 0.105 * t ** 1.1)
            yf = 0.0935 + 0.0330 * t ** 1.6 - 0.006 * np.sin(math.pi * t)
            w = 0.052 - 0.014 * t + 0.014 * np.exp(-t / 0.10) + 0.016 * np.exp(-(1 - t) / 0.07)
            hgt = 0.032 - 0.008 * t + 0.010 * np.exp(-(1 - t) / 0.08)
            C = np.stack([r * np.cos(phi), yf - hgt / 2, r * np.sin(phi)], 1)
            T = np.gradient(C, axis=0); T[:, 1] = 0
            T /= np.linalg.norm(T, axis=1)[:, None]
            Bn = np.stack([-T[:, 2], 0 * T[:, 0], T[:, 0]], 1)            # in-plane normal to the path
            a = np.linspace(0, 2 * math.pi, ns, endpoint=False)
            e = 6.0
            cx = np.sign(np.cos(a)) * np.abs(np.cos(a)) ** (2 / e)
            cy = np.sign(np.sin(a)) * np.abs(np.sin(a)) ** (2 / e)
            # trapezoid: narrower on the outer face for a chamfered look
            taper = 1.0 - 0.22 * (cy > 0) * cy
            V = (C[:, None, :] + Bn[:, None, :] * (cx * taper)[None, :, None] * (w / 2)[:, None, None]
                 + np.array([0, 1, 0])[None, None, :] * cy[None, :, None] * (hgt / 2)[:, None, None])
            mb.grid(V, closed_u=True, mat=0)
    return mb


def build_wheel_parts():
    """Create the shared wheel meshes once; returns dict name -> (mesh, materials)."""
    parts = {}
    tmp = get_coll("TY_tmp")
    def stash(name, mb, mats, **kw):
        ob = mesh_obj("TMP_" + name, mb, mats, coll=tmp, **kw)
        me = ob.data
        me.name = "TY_" + name
        bpy.data.objects.remove(ob)
        parts[name] = me
    stash("Tire", build_tire_mesh(), [RUBBER], recalc=True, sharp=28)
    stash("Rim", build_rim_mesh(), [ALLOY, ALLOY_DARK], sharp=40)
    # centre cap + emblem
    mb = MeshB()
    cap = [(0.0, 0.0915), (0.012, 0.0914), (0.024, 0.0908), (0.0295, 0.0895), (0.0300, 0.0870), (0.0, 0.0870)]
    mb.grid(lathe(cap, 48), closed_u=True, mat=0)
    v, f = curve_mesh(tesla_t(0.030), 0.0005)
    mb.raw(np.stack([-v[:, 0], 0.0916 + v[:, 2] + 0.0003, v[:, 1]], 1), f, mat=1)
    stash("CenterCap", mb, [ALLOY_DARK, CHROME], sharp=30)
    # lug nuts
    mb = MeshB()
    for i in range(5):
        a = math.radians(36 + i * 72)
        cx, cz = 0.05715 * math.cos(a), 0.05715 * math.sin(a)
        nut = np.array([(0.0105, 0.0795), (0.0105, 0.0925), (0.0085, 0.0945), (0.0, 0.0945)])
        V = lathe(nut, 6)
        V[:, :, 0] += cx; V[:, :, 2] += cz
        mb.grid(V, closed_u=True)
    stash("LugNuts", mb, [ALLOY_DARK], sharp=20)
    # valve stem
    mb = MeshB()
    st = np.array([(0.0045, 0.0), (0.0045, 0.018), (0.0032, 0.020), (0.0032, 0.030), (0.0040, 0.031), (0.0040, 0.040), (0.0, 0.040)])
    V = lathe(st, 12)
    a = math.radians(-72)
    Vr = V.copy()
    # stem points outwards (+Y) and slightly towards the hub, sitting on the barrel's outer face
    Vr[:, :, 1] = 0.108 + V[:, :, 1] * 0.75
    Vr[:, :, 0] = V[:, :, 0] + 0.2395 - V[:, :, 1] * 0.55
    ca, sa = math.cos(a), math.sin(a)
    X, Z = Vr[:, :, 0].copy(), Vr[:, :, 2].copy()
    Vr[:, :, 0], Vr[:, :, 2] = X * ca - Z * sa, X * sa + Z * ca
    mb.grid(Vr, closed_u=True)
    stash("ValveStem", mb, [RUBBER], sharp=30)
    return parts


def build_brake(name, disc_r, side, caliper_front, parent):
    """Disc + caliper + hub carrier in wheel-local frame (not rotating with the wheel visually)."""
    mb = MeshB()
    yc, th = 0.020, 0.025 if disc_r > 0.17 else 0.020
    disc = [(0.085, 0.045), (0.086, yc + th / 2), (disc_r - 0.001, yc + th / 2), (disc_r, yc + th / 2 - 0.001),
            (disc_r, yc + 0.004), (disc_r - 0.004, yc + 0.003), (disc_r - 0.004, yc - 0.003), (disc_r, yc - 0.004),
            (disc_r, yc - th / 2 + 0.001), (disc_r - 0.001, yc - th / 2), (0.090, yc - th / 2), (0.075, yc - th / 2 - 0.004),
            (0.060, -0.02), (0.0, -0.02)]
    mb.grid(lathe([(0.0, 0.0455), (0.060, 0.0455), (0.078, 0.0450), (0.085, 0.045)] + disc[1:], 72), closed_u=True, mat=0)
    # hub carrier / upright stub behind the disc
    mb.grid(lathe([(0.055, -0.02), (0.055, -0.10), (0.035, -0.11), (0.035, -0.22), (0.0, -0.22)], 24), closed_u=True, mat=2)
    # caliper
    ri, ro = disc_r - 0.058, disc_r + 0.022
    y0, y1 = yc - 0.048, yc + 0.046
    cp = [(ri + 0.008, y0), (ro - 0.012, y0), (ro, y0 + 0.012), (ro, y1 - 0.012), (ro - 0.012, y1), (ri + 0.008, y1),
          (ri, y1 - 0.008), (ri, yc + 0.020), (ri + 0.016, yc + 0.018), (ri + 0.016, yc - 0.018), (ri, yc - 0.020), (ri, y0 + 0.008)]
    ac = math.radians(0 if caliper_front else 180)
    span = math.radians(31)
    V = lathe(cp, 20, ac - span, ac + span, closed=False)
    b = mb.grid(V, closed_v=True, mat=1)
    n = V.shape[1]
    m = len(cp)
    mb.f.append(tuple(b + j * n for j in range(m))); mb.mi.append(1)
    mb.f.append(tuple(b + j * n + n - 1 for j in range(m))[::-1]); mb.mi.append(1)
    ob = mesh_obj(name, mb, [DISC, CALIPER, LINER], sharp=30, parent=parent)
    bv = ob.modifiers.new("Bevel", 'BEVEL'); bv.width = 0.002; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    return ob


def build_wheels():
    clear_prefix("Wheel_"); clear_prefix("Brake_")
    parts = build_wheel_parts()
    root = get_root()
    coll = sub("Wheels")
    for nm, x, sgn in (("FR", 0.0, 1), ("FL", 0.0, -1), ("RR", WB, 1), ("RL", WB, -1)):
        e = bpy.data.objects.new("Wheel_" + nm, None)
        e.empty_display_size = 0.15
        e.location = (x, sgn * TRACK / 2, TIRE_R)
        e.rotation_euler = (0, math.radians(17 if x == 0 else -31), 0 if sgn > 0 else math.pi)
        coll.objects.link(e)
        e.parent = root
        for pn, me in parts.items():
            o = bpy.data.objects.new(f"Wheel_{nm}_{pn}", me)
            coll.objects.link(o)
            o.parent = e
        b = bpy.data.objects.new("Brake_" + nm, None)
        b.empty_display_size = 0.1
        b.location = (x, sgn * TRACK / 2, TIRE_R)
        b.rotation_euler = (0, 0, 0 if sgn > 0 else math.pi)
        coll.objects.link(b)
        b.parent = root
        front = (x == 0)
        # calipers sit towards the middle of the car on both axles
        towards_rear = front
        cal_front_local = towards_rear if sgn > 0 else (not towards_rear)
        build_brake(f"Brake_{nm}_Assembly", 0.1775 if front else 0.1675, sgn, cal_front_local, b)


def build_underbody():
    clear_prefix("Under_")
    # wheel-well liners
    for nm, x in (("F", 0.0), ("R", WB)):
        mb = MeshB()
        Rw = 0.398
        prof = [(Rw, 0.925), (Rw, 0.56), (0.0, 0.56)]
        V = lathe(prof, 40, math.radians(-25), math.radians(205), closed=False)
        V[:, :, 0] += x; V[:, :, 2] += TIRE_R
        mb.grid(V)
        a = mb.build("Under_WheelWell_" + nm + "_R", "Underbody", LINER)
        b = mb.mirrored().build("Under_WheelWell_" + nm + "_L", "Underbody", LINER)
    # flat underbody tray following the rim of the body
    xs = np.linspace(-0.50, 3.42, 60)
    rim = M.eval(xs, np.ones_like(xs))
    yy = np.linspace(0, 1, 8)
    V = np.stack([np.broadcast_to(xs[None, :], (8, 60)), yy[:, None] * (rim[:, 1][None, :] - 0.012),
                  np.broadcast_to((rim[:, 2] + 0.004)[None, :], (8, 60)) - 0.06 * (1 - yy[:, None] ** 2)], 2)
    # cut away the wheel areas
    mb = MeshB()
    mb.grid(V)
    ob = mb.build("Under_Tray", "Underbody", LINER)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    kill = [f for f in bm.faces if any(abs(f.calc_center_median().x - cx) < 0.415 for cx in (0.0, WB)) and f.calc_center_median().y > 0.53]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ob.data); bm.free()
    m = ob.modifiers.new("Mirror", 'MIRROR'); m.use_axis = (False, True, False)
