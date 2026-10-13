# Tesla Model Y 2025 - interior: seats, dashboard, screen, steering wheel, console, door cards, trims, trunk.
LEA, LEAP, FAB, CARPET, HEADL = "TY_Int_Leather_Black", "TY_Int_Leather_Perforated", "TY_Int_Fabric_Grey", "TY_Int_Carpet", "TY_Int_Headliner"
SOFT, HARD, ALU, BELT, RUB = "TY_Int_Plastic_Soft", "TY_Int_Plastic_Hard", "TY_Int_Aluminium", "TY_Int_Belt", "TY_Int_Rubber"
FLOOR_Z = 0.360
DRV_Y = -0.37      # left-hand drive: the driver sits on the car's left (-Y)


def rotY(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rbox(mb, c, size, R=None, r=0.015, seg=3, mat=0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    r = min(r, 0.49 * min(size))
    if r > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, segments=seg, affect='EDGES', profile=0.5)
    bm.verts.ensure_lookup_table()
    P = np.array([v.co[:] for v in bm.verts])
    F = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    R = np.eye(3) if R is None else R
    mb.raw(P @ R.T + np.asarray(c, float), F, mat)


def pillow(mb, c, R, sx, sy, h, mat=0, ch=0, depth=0.005, n=26, p=5.0):
    nx = 64 if ch else n
    u = np.sin(np.linspace(-1, 1, nx) * math.pi / 2)
    v = np.sin(np.linspace(-1, 1, n) * math.pi / 2)
    f = lambda t: (1 - np.abs(t) ** p) ** (1 / p)
    U, Vv = np.meshgrid(u, v)
    Z = h * f(U) * f(Vv)
    if ch:
        for xk in np.linspace(-1, 1, ch + 2)[1:-1]:
            Z -= depth * np.exp(-((U - xk) * sx / 2 / 0.007) ** 2) * f(Vv) ** 0.5
    P = np.stack([U * sx / 2, Vv * sy / 2, Z], 2)
    W = P @ R.T + np.asarray(c, float)
    mb.grid(W, flip=bool(np.linalg.det(R) < 0), mat=mat)


def cyl(mb, p0, p1, r, n=16, mat=0, caps=True, r1=None):
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    ax = p1 - p0; ax /= np.linalg.norm(ax)
    t = np.cross(ax, [0, 0, 1.0])
    if np.linalg.norm(t) < 1e-6:
        t = np.array([1.0, 0, 0])
    t /= np.linalg.norm(t); b = np.cross(ax, t)
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    ring = lambda p, rr: p[None] + (t[None] * np.cos(a)[:, None] + b[None] * np.sin(a)[:, None]) * rr
    r1 = r if r1 is None else r1
    V = np.stack([ring(p0, r), ring(p1, r1)], 0)
    base = mb.grid(V, closed_u=True, mat=mat)
    if caps:
        mb.f.append(tuple(base + i for i in range(n))[::-1]); mb.mi.append(mat)
        mb.f.append(tuple(base + n + i for i in range(n))); mb.mi.append(mat)


def fix_normals(ob, sharp=40):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    ob.data.set_sharp_from_angle(angle=math.radians(sharp))
    return ob


def ibuild(mb, name, mats, sharp=40, recalc=True):
    ob = mb.build(name, "Interior", mats, weld=None)
    if recalc:
        fix_normals(ob, sharp)
    else:
        ob.data.set_sharp_from_angle(angle=math.radians(sharp))
    return ob


# ---------------------------------------------------------------- screen UI texture
def make_ui_image():
    W, Hh = 1280, 760
    img = np.zeros((Hh, W, 4), np.float32); img[..., 3] = 1
    Y, X = np.mgrid[0:Hh, 0:W].astype(np.float32)
    def rect(x0, y0, x1, y1, c, rad=0):
        m = (X >= x0) & (X < x1) & (Y >= y0) & (Y < y1)
        if rad:
            dx = np.maximum(np.maximum(x0 + rad - X, X - (x1 - rad)), 0)
            dy = np.maximum(np.maximum(y0 + rad - Y, Y - (y1 - rad)), 0)
            m &= (dx * dx + dy * dy) <= rad * rad
        img[m, :3] = c
    def line(pts, w, c):
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            vx, vy = bx - ax, by - ay
            t = np.clip(((X - ax) * vx + (Y - ay) * vy) / (vx * vx + vy * vy), 0, 1)
            d = np.hypot(X - (ax + t * vx), Y - (ay + t * vy))
            img[(d <= w / 2) & (X > 432), :3] = c
    rect(0, 0, W, Hh, (0.90, 0.905, 0.89))                      # map base
    rect(700, 420, 980, 640, (0.74, 0.86, 0.72), 30)            # park
    rect(1060, 90, 1280, 300, (0.74, 0.86, 0.72), 40)
    rect(470, 90, 640, 210, (0.62, 0.78, 0.92), 30)             # water
    for pts, w in (([(432, 250), (760, 300), (1280, 330)], 26), ([(600, 70), (640, 400), (610, 760)], 22),
                   ([(432, 560), (900, 520), (1280, 600)], 18), ([(980, 70), (1010, 420), (1100, 760)], 18),
                   ([(432, 420), (640, 400), (1010, 420), (1280, 450)], 12), ([(800, 70), (820, 300), (760, 520), (780, 760)], 12),
                   ([(1150, 70), (1170, 330), (1200, 760)], 10), ([(432, 150), (1280, 180)], 10)):
        line(pts, w, (0.99, 0.99, 0.99))
    line([(640, 400), (760, 300), (820, 300), (1010, 420), (1100, 700)], 9, (0.16, 0.45, 0.95))    # route
    rect(742, 282, 778, 318, (0.16, 0.45, 0.95), 18)
    rect(752, 292, 768, 308, (1, 1, 1), 8)
    rect(452, 672, 800, 730, (1, 1, 1), 22)                     # search bar
    rect(476, 694, 620, 706, (0.6, 0.6, 0.62), 5)
    rect(0, 0, 432, Hh, (0.955, 0.957, 0.96))                   # driving visualisation panel
    for i in range(7):
        rect(120, 150 + i * 60, 126, 185 + i * 60, (0.75, 0.76, 0.78))
        rect(306, 150 + i * 60, 312, 185 + i * 60, (0.75, 0.76, 0.78))
    rect(168, 210, 264, 420, (0.62, 0.05, 0.06), 34)            # the car, seen from above
    rect(182, 300, 250, 380, (0.10, 0.11, 0.13), 16)
    rect(180, 240, 252, 286, (0.16, 0.17, 0.19), 14)
    # speed "0" and gear selector marks
    rect(186, 610, 246, 700, (0.12, 0.12, 0.13), 26); rect(200, 624, 232, 686, (0.955, 0.957, 0.96), 14)
    for i, c in enumerate(((0.12, 0.12, 0.13), (0.7, 0.7, 0.72), (0.7, 0.7, 0.72), (0.7, 0.7, 0.72))):
        rect(300 + i * 26, 690, 318 + i * 26, 708, c, 4)
    rect(40, 640, 110, 660, (0.2, 0.7, 0.3), 8)                 # battery
    rect(40, 668, 130, 676, (0.6, 0.6, 0.62), 3)
    rect(0, 0, W, 70, (0.10, 0.10, 0.11))                       # dock
    cols = [(0.85, 0.85, 0.87), (0.2, 0.6, 1.0), (0.95, 0.3, 0.3), (0.3, 0.8, 0.4), (1.0, 0.7, 0.1), (0.7, 0.4, 0.9), (0.85, 0.85, 0.87), (0.2, 0.8, 0.8)]
    for i, c in enumerate(cols):
        rect(330 + i * 82, 16, 370 + i * 82, 56, c, 10)
    rect(60, 22, 150, 50, (0.85, 0.85, 0.87), 8); rect(1120, 22, 1220, 50, (0.85, 0.85, 0.87), 8)
    im = bpy.data.images.get("TY_Screen_UI") or bpy.data.images.new("TY_Screen_UI", W, Hh)
    im.pixels.foreach_set(img.ravel())
    im.pack()
    m, nt, b, out = _new("TY_Int_Screen_UI", (0.8, 0.8, 0.85, 1))
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = im; tx.location = (-300, 0)
    _set(b, base=(0, 0, 0, 1), rough=0.05, emit_s=1.4, coat=1.0)
    nt.links.new(tx.outputs[0], b.inputs['Emission Color'])
    return m


def uv_quad(name, corners, mat):
    """Single textured quad (bl, br, tr, tl)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(c) for c in corners], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for l, c in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l.uv = c
    me.materials.append(mat)
    remove_obj(name)
    ob = bpy.data.objects.new(name, me)
    sub("Interior").objects.link(ob)
    ob.parent = get_root()
    return ob


# ---------------------------------------------------------------- seats
def seat_front(name, y):
    mb = MeshB()
    Rc = rotY(7)
    rbox(mb, (1.37, y, 0.525), (0.50, 0.50, 0.13), Rc, 0.045, 4, 0)
    pillow(mb, np.array([1.37, y, 0.59]) + Rc @ np.array([0, 0, 0.0]), Rc, 0.47, 0.29, 0.036, 1, ch=4)
    for s in (-1, 1):
        pillow(mb, np.array([1.37, y + s * 0.198, 0.592]), Rc, 0.48, 0.115, 0.062, 0)
    up = np.array([math.sin(math.radians(21)), 0, math.cos(math.radians(21))])
    n = np.array([-up[2], 0, up[0]])
    Rb = np.stack([up, [0, 1, 0], n], 1)                 # columns: local x -> up, y -> y, z -> front normal
    hinge = np.array([1.615, y, 0.60])
    rbox(mb, hinge + up * 0.33 - n * 0.045, (0.105, 0.50, 0.66), rotY(21), 0.045, 4, 0)
    pillow(mb, hinge + up * 0.33 + n * 0.005, Rb, 0.60, 0.275, 0.034, 1, ch=5)
    for s in (-1, 1):
        pillow(mb, hinge + up * 0.31 + n * 0.006 + np.array([0, s * 0.195, 0]), Rb, 0.56, 0.115, 0.072, 0)
    # shoulders + integrated head restraint
    rbox(mb, hinge + up * 0.70 - n * 0.030, (0.10, 0.40, 0.14), rotY(21), 0.045, 4, 0)
    rbox(mb, hinge + up * 0.835 - n * 0.005, (0.115, 0.265, 0.19), rotY(14), 0.05, 4, 0)
    pillow(mb, hinge + up * 0.835 + n * 0.052, np.stack([[math.sin(math.radians(14)), 0, math.cos(math.radians(14))], [0, 1, 0],
                                                          [-math.cos(math.radians(14)), 0, math.sin(math.radians(14))]], 1), 0.17, 0.235, 0.016, 1)
    # plastic base, side shroud, rails
    rbox(mb, (1.38, y, 0.435), (0.44, 0.44, 0.13), None, 0.02, 2, 2)
    for s in (-1, 1):
        rbox(mb, (1.42, y + s * 0.255, 0.50), (0.46, 0.022, 0.13), rotY(4), 0.01, 2, 2)
        rbox(mb, (1.38, y + s * 0.19, 0.375), (0.62, 0.035, 0.03), None, 0.006, 2, 3)
    rbox(mb, (1.625, y, 0.585), (0.07, 0.50, 0.07), None, 0.03, 3, 2)      # recliner cover
    return ibuild(mb, name, ["TY_Int_Leather_White", "TY_Int_Leather_White_Perf", HARD, ALU])


def seat_rear():
    mb = MeshB()
    Rc = rotY(6)
    rbox(mb, (2.27, 0, 0.515), (0.52, 1.30, 0.15), Rc, 0.05, 4, 0)
    for yc, w in ((-0.42, 0.42), (0.0, 0.34), (0.42, 0.42)):
        pillow(mb, np.array([2.27, yc, 0.588]), Rc, 0.48, w, 0.034, 1, ch=4)
    ang = 25
    up = np.array([math.sin(math.radians(ang)), 0, math.cos(math.radians(ang))])
    n = np.array([-up[2], 0, up[0]])
    Rb = np.stack([up, [0, 1, 0], n], 1)
    hinge = np.array([2.52, 0, 0.60])
    for yc, w in ((-0.415, 0.47), (0.24, 0.82)):          # 40/60 split backrest
        rbox(mb, hinge + up * 0.30 - n * 0.045 + np.array([0, yc, 0]), (0.10, w, 0.62), rotY(ang), 0.04, 4, 0)
    for yc, w in ((-0.42, 0.40), (0.0, 0.32), (0.42, 0.40)):
        pillow(mb, hinge + up * 0.30 + n * 0.005 + np.array([0, yc, 0]), Rb, 0.56, w, 0.036, 1, ch=5)
        rbox(mb, hinge + up * 0.685 - n * 0.02 + np.array([0, yc, 0]), (0.085, 0.23 if yc else 0.19, 0.13 if yc else 0.10), rotY(ang - 6), 0.04, 4, 0)
        for s in (-0.05, 0.05):
            cyl(mb, hinge + up * 0.58 - n * 0.03 + np.array([0, yc + s, 0]), hinge + up * 0.66 - n * 0.03 + np.array([0, yc + s, 0]), 0.006, 10, 3)
    rbox(mb, (2.16, 0, 0.42), (0.36, 1.26, 0.13), None, 0.02, 2, 2)        # riser under the bench
    # buckles
    for yb in (-0.22, 0.20, 0.26, 0.60, -0.62):
        rbox(mb, (2.47, yb, 0.615), (0.035, 0.045, 0.05), rotY(-20), 0.006, 2, 2)
        rbox(mb, (2.462, yb, 0.642), (0.012, 0.03, 0.006), rotY(-20), 0.002, 1, 4)
    return ibuild(mb, "Seat_Rear_Bench", ["TY_Int_Leather_White", "TY_Int_Leather_White_Perf", HARD, ALU, "TY_Int_Buckle_Red"])


# ---------------------------------------------------------------- cabin shell built from offset body patches
def offset_patch(V, fl, dfun):
    N = grid_normals(V)
    if fl:
        N = -N
    nv = V.shape[0]
    t = np.linspace(0, 1, nv)[:, None, None]
    return V - N * dfun(t)


def build_interior(BODY):
    clear_prefix("Int_"); clear_prefix("Seat_")
    ui = make_ui_image()
    # ------------------------------------------------ door cards
    belt = lambda x0, x1: sv([(x, float(zb(x))) for x in np.linspace(x0, x1, 40)], False)
    rock = lambda x0, x1: sv([(x0, ROCK), (x1, ROCK)], False)
    def dprof(t):
        arm = 0.050 * np.exp(-((t - 0.60) / 0.055) ** 2)
        top = np.clip((t - 0.86) / 0.14, 0, 1) ** 1.5
        pocket = -0.020 * np.exp(-((t - 0.20) / 0.07) ** 2)
        return (0.105 + arm + pocket) * (1 - top) + 0.030 * top
    for nm, L, Rr in (("Front", DOOR_F, DOOR_B), ("Rear", DOOR_B, DOOR_R)):
        V, fl = tpatch(M, [(rock(L[0][0], Rr[0][0]), None)], [(belt(L[-1][0], Rr[-1][0]), None)], [(sv(L), None)], [(sv(Rr), None)])
        W = offset_patch(V, fl, dprof)
        nv = W.shape[0]
        mb = MeshB()
        cuts = [0, int(0.30 * nv), int(0.52 * nv), int(0.68 * nv), int(0.88 * nv), nv - 1]
        for (a, b), mt in zip(zip(cuts[:-1], cuts[1:]), (0, 1, 2, 5, 0)):
            mb.grid(W[a:b + 1], flip=not fl, mat=mt)
        # speaker grille + door pull + window switch pod
        j, i = int(0.20 * nv), int(0.22 * W.shape[1])
        P = W[j, i]; nn = np.cross(W[j, i + 1] - P, W[j + 1, i] - P); nn /= np.linalg.norm(nn)
        nn = nn if nn[1] < 0 else -nn
        cyl(mb, P + nn * 0.001, P + nn * 0.009, 0.072, 28, 3)
        j, i = int(0.60 * nv), int(0.45 * W.shape[1])
        P = W[j, i]
        rbox(mb, P + np.array([0.0, -0.012, 0.012]), (0.20, 0.03, 0.012), None, 0.005, 2, 4)
        rbox(mb, P + np.array([-0.16, -0.010, 0.014]), (0.09, 0.05, 0.008), None, 0.003, 2, 3)
        j, i = int(0.80 * nv), int(0.30 * W.shape[1])
        P = W[j, i]
        rbox(mb, P + np.array([0.0, -0.006, 0.0]), (0.035, 0.012, 0.02), None, 0.004, 2, 4)      # door release button
        a = mb.build(f"Int_DoorCard_{nm}_R", "Interior", [SOFT, "TY_Int_Leather_White", LEA, "TY_Int_Speaker_Mesh", ALU, FAB], weld=None)
        b = mb.mirrored().build(f"Int_DoorCard_{nm}_L", "Interior", [SOFT, "TY_Int_Leather_White", LEA, "TY_Int_Speaker_Mesh", ALU, FAB], weld=None)
        for o in (a, b):
            o.data.set_sharp_from_angle(angle=math.radians(40))

    # ------------------------------------------------ pillars / roof rails / B-pillar / headers
    dlo_top, ws_uv, rs_uv, tgs_uv, d0, w0 = (BODY[k] for k in ("dlo_top", "ws_uv", "rs_uv", "tgs_uv", "d0", "w0"))
    k2 = int(np.argmin(np.abs(tgs_uv[:, 0] - 3.0)))
    V, fl = tpatch(M, [(dlo_top, None)], [(ws_uv, None), (rs_uv, None), (tgs_uv[:k2 + 1], None)],
                   [(uvline(d0, w0, 30), None)], [(uvline(dlo_top[-1], tgs_uv[k2], 20), None)], offset=-0.045)
    mb = MeshB(); mb.grid(V, flip=not fl)
    def dlo2(xl0, xl1, xr0, xr1, ob, ot, offset):
        bot = sv([(x, float(zb(x)) + ob) for x in np.linspace(xl0, xr0, 12)], False)
        top = sv([(x, float(zt(x)) - ot) for x in np.linspace(xl1, xr1, 12)], False)
        return tpatch(M, [(bot, None)], [(top, None)], [(uvline(bot[0], top[0], 30), None)], [(uvline(bot[-1], top[-1], 30), None)], offset=offset)
    V, fl = dlo2(1.655, 1.69, 1.815, 1.85, -0.06, -0.03, -0.075)
    mb.grid(V, flip=not fl)
    V, fl = dlo2(2.75, 2.75, 2.815, 2.815, -0.03, -0.02, -0.06)
    mb.grid(V, flip=not fl)
    a = mb.build("Int_Pillar_Trims_R", "Interior", [HEADL], weld=None)
    b = mb.mirrored().build("Int_Pillar_Trims_L", "Interior", [HEADL], weld=None)
    for o in (a, b):
        add_shell(o, thick=0.02, bevel=0)
    mb = MeshB()
    for x0, x1, yw in ((0.99, 1.26, 0.60), (2.60, 2.88, 0.55)):
        lo, hi = tv([(x0, 0.0), (x0, yw)], False), tv([(x1, 0.0), (x1, yw)], False)
        V, fl = tpatch(M, [(lo, None)], [(hi, None)], [(uvline(lo[0], hi[0], 20), None)], [(uvline(lo[-1], hi[-1], 20), None)], offset=-0.034)
        mb.grid(V, flip=not fl)
    o = mb.build("Int_Headliner_Headers", "Interior", [HEADL], weld=None)
    add_shell(o, thick=0.022, bevel=0, mirror=True)

    # ------------------------------------------------ quarter / trunk side trims, tailgate inner, floors
    s_top = CR.s_top
    gl_edge = sv([(2.785, 1.207), (2.90, 1.268), (3.01, 1.330)], False); gl_edge[-1] = (3.01, s_top)
    lo = sv([(2.79, 0.60), (3.44, 0.60)], False)
    V, fl = tpatch(M, [(lo, None)], [(gl_edge, None), (uvline((3.01, s_top), (3.44, s_top), 40), None)],
                   [(uvline(lo[0], gl_edge[0], 40), None)], [(uvline(lo[-1], (3.44, s_top), 40), None)], offset=-0.10)
    mb = MeshB(); mb.grid(V, flip=not fl)
    mb.build("Int_Trunk_SideTrim_R", "Interior", [CARPET], weld=None)
    mb.mirrored().build("Int_Trunk_SideTrim_L", "Interior", [CARPET], weld=None)
    shr = BODY['shr']
    mb = MeshB()
    for r0 in range(1, 8):
        for c in range(3):
            Vb = blk(shr, r0, r0 + 1, c, c + 1)
            fl, N = flipflag(Vb)
            mb.grid(Vb - (-N if fl else N) * (0.075 if r0 >= 5 else 0.10), flip=not fl, mat=0 if r0 >= 5 else 1)
    o = mb.build("Int_Tailgate_Trim", "Interior", [HARD, CARPET], weld=None)
    add_shell(o, thick=0, bevel=0, mirror=True)

    mb = MeshB()
    def slab(x0, x1, yw, z, mat, th=0.02):
        rbox(mb, ((x0 + x1) / 2, 0, z - th / 2), (x1 - x0, 2 * yw, th), None, 0.004, 1, mat)
    slab(0.36, 2.62, 0.845, FLOOR_Z, 0)                     # cabin floor
    slab(2.50, 3.74, 0.74, 0.615, 0)                        # trunk floor
    rbox(mb, (2.56, 0, 0.49), (0.12, 1.50, 0.27), None, 0.01, 1, 0)       # step up behind the rear footwell
    rbox(mb, (0.42, 0, 0.64), (0.04, 1.50, 0.60), rotY(-12), 0.0, 1, 0)   # firewall / toe board
    for xc, yc, lx, ly in ((0.98, -0.37, 0.50, 0.40), (0.98, 0.37, 0.50, 0.40), (1.98, -0.40, 0.42, 0.42), (1.98, 0.40, 0.42, 0.42)):
        rbox(mb, (xc, yc, FLOOR_Z + 0.006), (lx, ly, 0.012), None, 0.004, 2, 2)      # floor mats
    for s in (-1, 1):
        rbox(mb, (1.56, s * 0.835, FLOOR_Z + 0.02), (2.05, 0.05, 0.04), None, 0.008, 2, 1)   # sill plates
    rbox(mb, (3.11, 0, 1.115), (0.62, 1.12, 0.014), rotY(-3), 0.004, 1, 3)   # parcel shelf
    ibuild(mb, "Int_Floor_Trunk", [CARPET, HARD, RUB, HEADL])

    # ------------------------------------------------ dashboard
    prof = np.array([(0.20, 1.020), (0.34, 1.040), (0.50, 1.052), (0.66, 1.052), (0.80, 1.046), (0.862, 1.036), (0.880, 1.020), (0.884, 0.998),
                     (0.874, 0.990), (0.858, 0.984), (0.856, 0.966), (0.872, 0.960), (0.880, 0.945), (0.882, 0.900), (0.872, 0.872),
                     (0.840, 0.855), (0.800, 0.830), (0.760, 0.760), (0.700, 0.620), (0.620, 0.470), (0.540, 0.370)])
    ysd = np.linspace(-0.845, 0.845, 61)
    wrap = 0.075 * (np.abs(ysd) / 0.845) ** 5
    mb = MeshB()
    V = np.stack([prof[:, 0][:, None] + wrap[None, :] * np.clip((prof[:, 0][:, None] - 0.5) / 0.38, 0, 1),
                  ysd[None, :] * np.interp(prof[:, 0], [0.20, 0.42, 0.62], [0.60, 0.80, 1.0])[:, None],
                  np.broadcast_to(prof[:, 1][:, None], (len(prof), len(ysd)))], 2)
    for (a, b), mt in (((0, 8), 0), ((8, 11), 1), ((11, 14), 2), ((14, 20), 0)):
        mb.grid(V[a:b + 1], mat=mt)
    led = np.stack([0.868 + wrap, ysd, np.full_like(ysd, 0.9765)], 1)
    mb.grid(tube(led, 0.0028, 6), closed_u=True, mat=3)
    # glovebox seam + lower knee panel detail
    rbox(mb, (0.735, 0.40, 0.70), (0.012, 0.50, 0.20), rotY(-24), 0.004, 2, 1)
    o = ibuild(mb, "Int_Dashboard", [SOFT, HARD, FAB, "TY_Emit_Ambient"], sharp=50)
    sb = o.modifiers.new("Subsurf", 'SUBSURF'); sb.levels = 1; sb.render_levels = 1

    # ------------------------------------------------ centre screen
    tilt = rotY(-8)
    cS = np.array([0.918, 0.0, 1.012])
    mb = MeshB()
    rbox(mb, cS, (0.011, 0.372, 0.222), tilt, 0.005, 3, 0)
    rbox(mb, cS + tilt @ np.array([-0.035, 0, -0.03]), (0.06, 0.10, 0.09), tilt, 0.012, 2, 1)
    ibuild(mb, "Int_Screen_Body", ["TY_Black_Gloss", HARD])
    hw, hh = 0.178, 0.1035
    corners = [cS + tilt @ np.array([0.0058, sy_ * hw, sz_ * hh]) for sy_, sz_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    # seen from the cabin (looking towards -X) the viewer's right is +Y
    uv_quad("Int_Screen_Display", corners, ui)

    # ------------------------------------------------ steering wheel + column + stalk
    a_ = np.array([math.cos(math.radians(22)), 0, math.sin(math.radians(22))])
    e1 = np.array([0, 1.0, 0]); e2 = np.cross(a_, e1)
    Rw = np.stack([a_, e1, e2], 1)
    Cw = np.array([1.065, DRV_Y, 0.990])
    mb = MeshB()
    th = np.linspace(0, 2 * math.pi, 72, endpoint=False)
    ph = np.linspace(0, 2 * math.pi, 14, endpoint=False)
    Rr, rt = 0.182, 0.0155
    ring = (Cw[None, None] + (e1[None, None] * np.cos(th)[:, None, None] + e2[None, None] * np.sin(th)[:, None, None]) * (Rr + rt * np.cos(ph)[None, :, None])
            + a_[None, None] * (rt * 1.15 * np.sin(ph))[None, :, None])
    mb.grid(ring, closed_u=True, closed_v=True, mat=0)
    rbox(mb, Cw - a_ * 0.030, (0.055, 0.165, 0.125), Rw, 0.03, 4, 0)
    for s in (-1, 1):
        rbox(mb, Cw + e1 * s * 0.118 - a_ * 0.020 - e2 * 0.004, (0.028, 0.105, 0.046), Rw, 0.012, 3, 1)
        cyl(mb, Cw + e1 * s * 0.088 - a_ * 0.006 + e2 * 0.004, Cw + e1 * s * 0.098 - a_ * 0.006 + e2 * 0.004, 0.0115, 16, 2)
        rbox(mb, Cw + e1 * s * 0.118 - a_ * 0.005 - e2 * 0.004, (0.004, 0.030, 0.012), Rw, 0.002, 1, 2)
    rbox(mb, Cw - e2 * 0.115 - a_ * 0.024, (0.026, 0.050, 0.115), Rw, 0.012, 3, 1)
    v, f = curve_mesh(tesla_t(0.032), 0.0005)
    mb.raw(Cw[None] + a_[None] * (0.0005 + v[:, 2:3]) + e1[None] * v[:, 0:1] + e2[None] * v[:, 1:2], f, 3)
    cyl(mb, Cw - a_ * 0.045, Cw - a_ * 0.26, 0.042, 20, 1, r1=0.050)
    cyl(mb, Cw - a_ * 0.11 - e1 * 0.04 + e2 * 0.01, Cw - a_ * 0.10 - e1 * 0.165 + e2 * 0.025, 0.008, 10, 1, r1=0.011)
    ibuild(mb, "Int_SteeringWheel", [LEA, HARD, ALU, CHROME], sharp=45)

    # ------------------------------------------------ pedals
    mb = MeshB()
    rbox(mb, (0.60, DRV_Y + 0.115, 0.48), (0.018, 0.058, 0.17), rotY(-32), 0.006, 2, 0)
    rbox(mb, (0.635, DRV_Y - 0.03, 0.52), (0.018, 0.115, 0.07), rotY(-28), 0.006, 2, 0)
    cyl(mb, (0.63, DRV_Y - 0.03, 0.53), (0.52, DRV_Y - 0.03, 0.78), 0.009, 8, 1)
    rbox(mb, (0.585, DRV_Y - 0.245, 0.47), (0.02, 0.10, 0.26), rotY(-38), 0.006, 2, 0)
    ibuild(mb, "Int_Pedals", [RUB, ALU])

    # ------------------------------------------------ centre console
    mb = MeshB()
    rbox(mb, (1.31, 0, 0.505), (1.00, 0.27, 0.30), None, 0.025, 3, 0)
    rbox(mb, (0.86, 0, 0.66), (0.14, 0.24, 0.36), rotY(-18), 0.02, 3, 0)              # rises to the dash
    rbox(mb, (0.975, 0, 0.668), (0.20, 0.225, 0.012), rotY(11), 0.004, 2, 1)           # twin wireless-charging pad
    rbox(mb, (0.975, 0, 0.676), (0.19, 0.006, 0.012), rotY(11), 0.002, 1, 2)
    rbox(mb, (1.185, 0, 0.6565), (0.20, 0.225, 0.006), None, 0.002, 1, 3)              # sliding cover
    rbox(mb, (1.185, 0, 0.6600), (0.006, 0.225, 0.003), None, 0.001, 1, 2)
    # cup holders: plate with two circular openings + cups
    zt_, r_, hs = 0.6565, 0.040, 0.0575
    for yc in (-0.0575, 0.0575):
        cx = 1.385
        a = np.linspace(0, 2 * math.pi, 32, endpoint=False) + math.pi / 4
        circ = np.stack([cx + r_ * np.cos(a), yc + r_ * np.sin(a), np.full(32, zt_)], 1)
        m_ = np.maximum(np.abs(np.cos(a)), np.abs(np.sin(a)))
        sq = np.stack([cx + hs * np.cos(a) / m_, yc + hs * np.sin(a) / m_, np.full(32, zt_)], 1)
        mb.grid(np.stack([circ, sq], 0), closed_u=True, mat=3)
        wall = np.stack([circ, circ - np.array([0, 0, 0.075])], 0)
        b0 = mb.grid(wall, closed_u=True, mat=1)
        mb.f.append(tuple(b0 + 32 + i for i in range(32))); mb.mi.append(1)
    rbox(mb, (1.655, 0, 0.700), (0.31, 0.245, 0.075), None, 0.03, 4, 4)                # padded armrest
    rbox(mb, (1.812, 0, 0.47), (0.012, 0.20, 0.05), None, 0.004, 2, 2)                 # rear vents
    ibuild(mb, "Int_Console", [SOFT, RUB, ALU, HARD, LEA], sharp=45)
    cR = np.array([1.8125, 0.0, 0.60])
    mb = MeshB(); rbox(mb, cR, (0.010, 0.205, 0.125), rotY(-8), 0.004, 2, 0)
    ibuild(mb, "Int_RearScreen_Body", ["TY_Black_Gloss"])
    t8 = rotY(-8)
    cr = [cR + t8 @ np.array([0.0053, sy_ * 0.095, sz_ * 0.055]) for sy_, sz_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    uv_quad("Int_RearScreen_Display", cr, ui)

    # ------------------------------------------------ mirror, sun visors, dome lights, belts
    mb = MeshB()
    zh = float(M.eval(1.10, 0.0)[2])
    rbox(mb, (1.115, 0, zh - 0.095), (0.035, 0.235, 0.062), rotY(-8), 0.014, 3, 0)
    rbox(mb, (1.134, 0, zh - 0.095), (0.002, 0.215, 0.048), rotY(-8), 0.0005, 1, 1)
    cyl(mb, (1.10, 0, zh - 0.085), (1.06, 0, zh - 0.035), 0.012, 10, 0)
    rbox(mb, (1.00, 0, float(M.eval(1.00, 0.0)[2]) - 0.045), (0.16, 0.16, 0.06), rotY(-27), 0.015, 2, 0)   # camera housing
    for s in (-1, 1):
        zv = float(M.eval(1.21, M.s_from_y([1.21], [0.34])[0])[2])
        rbox(mb, (1.215, s * 0.34, zv - 0.062), (0.16, 0.37, 0.018), rotY(-9), 0.008, 2, 2)
        rbox(mb, (1.265, s * 0.115, zv - 0.052), (0.05, 0.035, 0.006), None, 0.002, 1, 3)
    ibuild(mb, "Int_Mirror_Visors_Lights", [HARD, MIRROR, HEADL, "TY_Emit_Dome"])
    mb = MeshB()
    for s in (-1, 1):
        P = polyline(np.array([(1.83, s * 0.765, 1.34), (1.815, s * 0.785, 0.95), (1.80, s * 0.79, 0.50)]), 14)
        mb.grid(tube(P, 0.024, 8, 0.07, up=np.array([1.0, 0, 0])), closed_u=True, mat=0)
        rbox(mb, (1.83, s * 0.76, 1.35), (0.03, 0.02, 0.07), None, 0.006, 2, 1)
        rbox(mb, (1.56, s * 0.135, 0.60), (0.03, 0.022, 0.09), rotY(-15), 0.006, 2, 1)
        rbox(mb, (1.572, s * 0.135, 0.647), (0.012, 0.018, 0.006), rotY(-15), 0.002, 1, 2)
        P = polyline(np.array([(2.83, s * 0.69, 1.19), (2.74, s * 0.66, 1.05), (2.58, s * 0.63, 0.66)]), 14)
        mb.grid(tube(P, 0.024, 8, 0.07, up=np.array([1.0, 0, 0])), closed_u=True, mat=0)
    ibuild(mb, "Int_SeatBelts", [BELT, HARD, "TY_Int_Buckle_Red"])
    seat_front("Seat_Front_L", -0.37)
    seat_front("Seat_Front_R", 0.37)
    seat_rear()
