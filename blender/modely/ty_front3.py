# Tesla Model Y 2025 - v3 front fascia (15-10-2026): the bumper cover as one painted shell with real openings cut
# through it (a Boolean modifier, so every opening shows the cover's own return), and what sits in them, redrawn from
# close crops of Commons photographs of the Juniper (Stealth Grey, front; plate 520 x 110 mm for scale):
#  - the headlamp: a smoked slit ≈0.25 m long and ≈5 cm tall in each corner, square at the outer end and pointed
#    at the inner one, under the light bar;
#  - the "J": a dark slot ≈2.4 cm wide that drops from the lamp's outer end and turns in at its foot;
#  - the lower grille: a wide trapezoid with slanted ends, horizontal slats and vertical ribs, sitting straight on the
#    black chin, with the front camera at the middle of its top edge;
#  - the light bar: a dark band between the bonnet's leading edge and the cover; it used to twist, because its two
#    edges were matched by arc length although the bonnet's edge turns back long before the cover's does.
# The layout and the sizes are read off the photographs (≈ ±1 cm); the heights follow the earlier calibrated fit.
# Every opening is built as a "ladder" between two design chains, so its cutter and its recess are always closed.
LENS_DARK = "TY_Lens_Smoke_Dark"
FRONT3_OLD = ["Bumper_Front", "Bumper_Front_Intake", "Headlamp_Housing_R", "Headlamp_Housing_L", "Headlamp_Lens_R",
              "Headlamp_Lens_L", "Headlamp_Projectors_R", "Headlamp_Projectors_L", "Bumper_Front_AirCurtain_R",
              "Bumper_Front_AirCurtain_L", "Lightbar_Front_Housing", "Lightbar_Front_LED", "Camera_Front_Bumper"]


def f3_uv(pts):
    """Front-view design points (y, z) -> (xi, v) on the front cap (xi > 1 runs onto the main surface)."""
    return inv2d(CF, np.asarray(pts, float), (1, 2), (0.0, 1.35), (0.0, 1.0), ng=110, it=24)


def f3_eval(uv):
    uv = np.asarray(uv, float)
    P = CF.eval(uv[:, 0], uv[:, 1])
    e = 1e-3
    Pu = CF.eval(uv[:, 0] + e, uv[:, 1]) - P
    Pv = CF.eval(uv[:, 0], np.clip(uv[:, 1] + e, 0, 1)) - P
    N = np.cross(Pu, Pv)
    N /= np.maximum(np.linalg.norm(N, axis=1)[:, None], 1e-12)
    out = P.copy(); out[:, 0] -= 0.4; out[:, 2] -= 0.6       # outward = away from a point inside the nose
    N[(N * out).sum(1) < 0] *= -1
    return P, N






def ladder(a_yz, b_yz, n):
    """Two design chains (y, z) running the same way, n points each, on the surface: (Pa, Na, Pb, Nb)."""
    A, B = rs2(rs2(a_yz, 400), n), rs2(rs2(b_yz, 400), n)
    Pa, Na = f3_eval(f3_uv(A))
    Pb, Nb = f3_eval(f3_uv(B))
    return Pa, Na, Pb, Nb


def ladder_prism(L, above, below, mb, mat=0):
    """A closed prism over the ladder's outline, from `above` out to `below` in."""
    Pa, Na, Pb, Nb = L
    n = len(Pa)
    P = np.vstack([Pa, Pb[::-1]]); N = np.vstack([Na, Nb[::-1]])
    base = mb.raw(np.vstack([P + N * above, P - N * below]), [], mat)
    k = 2 * n
    for i in range(k):
        j = (i + 1) % k
        mb.f.append((base + i, base + j, base + k + j, base + k + i)); mb.mi.append(mat)
    for i in range(n - 1):
        a0, a1, b0, b1 = i, i + 1, k - 1 - i, k - 2 - i
        mb.f.append((base + a0, base + b0, base + b1, base + a1)); mb.mi.append(mat)
        mb.f.append((base + k + a1, base + k + b1, base + k + b0, base + k + a0)); mb.mi.append(mat)


def ladder_tray(L, d0, d1, mb, mat=0):
    """The recess behind an opening: walls from depth d0 to d1, and a back."""
    Pa, Na, Pb, Nb = L
    n = len(Pa)
    P = np.vstack([Pa, Pb[::-1]]); N = np.vstack([Na, Nb[::-1]])
    mb.grid(np.stack([P - N * d0, P - N * d1], 0), closed_u=True, mat=mat)
    mb.grid(np.stack([Pa - Na * d1, Pb - Nb * d1], 0), mat=mat)


def lens_patch(L, nv, off):
    """The lens over an opening: a grid from chain b to chain a, lying on the surface (TFI in (xi, v))."""
    Pa, Na, Pb, Nb = L
    t = np.linspace(0, 1, nv + 1)[:, None, None]
    P = Pb[None] * (1 - t) + Pa[None] * t
    N = Nb[None] * (1 - t) + Na[None] * t
    # project the blended points back onto the cap
    shp = P.shape[:2]
    yz = P.reshape(-1, 3)[:, 1:]
    Q, Nq = f3_eval(f3_uv(yz))
    return (Q + Nq * off).reshape(shp + (3,))


def mirror_both(mb):
    m2 = mb.mirrored()
    out = MeshB()
    for src in (mb, m2):
        base = len(out.v)
        out.v.extend(src.v)
        out.f.extend(tuple(base + i for i in f) for f in src.f)
        out.mi.extend(src.mi)
    return out




# ---------------------------------------------------------------- the design (right-hand side, +Y)
HL_TOP = [(0.618, 0.664), (0.640, 0.677), (0.868, 0.680)]                 # headlamp slit: inner tip -> outer top
HL_BOT = [(0.6205, 0.6612), (0.672, 0.627), (0.868, 0.627)]               # (2.5 mm off the tip) -> outer bottom
J_W = 0.024
J_PATH = [(0.856, 0.640), (0.858, 0.520), (0.852, 0.430), (0.832, 0.388), (0.790, 0.372), (0.748, 0.371)]
GR = dict(z0=0.262, z1=0.392, y_top=0.600, y_bot=0.650)                   # lower grille opening


def j_ladder(n=90):
    jp = rs2(rounded(J_PATH, 0.03, 10), 300)
    tng = np.gradient(jp, axis=0); tng /= np.linalg.norm(tng, axis=1)[:, None]
    nrm = np.stack([-tng[:, 1], tng[:, 0]], 1)
    return ladder(jp + nrm * J_W / 2, jp - nrm * J_W / 2, n)


def grille_ladder(n=60):
    """Across the whole nose: the cap is only defined for y >= 0, so the half is built and mirrored."""
    g = GR
    top = [(y, g['z1']) for y in np.linspace(0.0, g['y_top'], 60)]
    bot = [(y, g['z0'] - 0.004) for y in np.linspace(0.0, g['y_bot'], 60)]
    Pa, Na, Pb, Nb = ladder(top, bot, n)
    m = np.array([1.0, -1.0, 1.0])
    full = lambda P: np.vstack([(P * m)[:0:-1], P])
    return full(Pa), full(Na), full(Pb), full(Nb)


def build_front3(BODY):
    for nm in FRONT3_OLD:
        remove_obj(nm)
    clear_prefix("F3_")
    shf = BODY['shf']
    glass(LENS_DARK, (0.30, 0.31, 0.33, 1), ior=1.49, view=(0.02, 0.02, 0.025, 1))
    cut_coll = get_coll("TY_Cutters", get_coll(MAIN_COLL))
    cut_coll.hide_render = True

    # ---- the cover: one sheet from the chin to the light bar and out to the wheel arch, both halves in one mesh
    # (the earlier cover was cut from the cap sheet's blocks, two of whose columns crossed above the grille and
    # folded the surface over: the dark "bow" and the row of pin-holes beside the headlamps).
    v_lip = float(shf['vs'][shf['ridx'][1]])
    xe = lambda v: np.interp(v, shf['vs'], shf['XI'][:, -1])
    shc = cap_sheet(CF, [v_lip, 1.0], [0.0, 0.45, 0.80, xe], h=0.012)
    mb = MeshB()
    add(mb, shc['V'])
    cover = merge(mb, mb.mirrored()).build("Bumper_Front", "Body", PAINT, weld=3e-4)
    finish(cover, thick=0.028, bevel=0.0025, mirror=False)

    HL, JL, GL = ladder(HL_TOP, HL_BOT, 60), j_ladder(), grille_ladder()
    # ---- cutters (both sides in one object; the cover's mirror is applied before the cut)
    side = MeshB()
    ladder_prism(HL, 0.03, 0.08, side)
    ladder_prism(JL, 0.03, 0.05, side)
    mid = MeshB()
    ladder_prism(GL, 0.04, 0.09, mid)
    cutter = merge(mirror_both(side), mid).build("F3_Cutter_Front", cut_coll, ["TY_Body_Inner"], weld=0, smooth=False, parent=False)
    bm = bmesh.new(); bm.from_mesh(cutter.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cutter.data); bm.free()
    cutter.matrix_world = get_root().matrix_world.copy()          # in the car's frame, but not under its root (not exported)
    cutter.hide_viewport = True; cutter.hide_render = True
    # The uncut cover lends the cut one its normals, so the long thin faces the cut leaves shade as the smooth panel.
    src = bpy.data.objects.new("F3_Cover_NormalSource", cover.data)
    cut_coll.objects.link(src)
    src.matrix_world = get_root().matrix_world.copy()
    for m in cover.modifiers:
        n2 = src.modifiers.new(m.name, m.type)
        for k in ('thickness', 'offset', 'use_even_offset', 'use_rim', 'material_offset', 'width', 'segments', 'limit_method', 'angle_limit'):
            if hasattr(m, k):
                setattr(n2, k, getattr(m, k))
    src.hide_viewport = True; src.hide_render = True
    bo = cover.modifiers.new("Openings", 'BOOLEAN')
    bo.operation = 'DIFFERENCE'; bo.solver = 'EXACT'; bo.object = cutter
    bo.use_self = True; bo.use_hole_tolerant = True
    dt = cover.modifiers.new("Normals", 'DATA_TRANSFER')
    dt.object = src; dt.use_object_transform = True
    dt.use_loop_data = True; dt.data_types_loops = {'CUSTOM_NORMAL'}; dt.loop_mapping = 'POLYINTERP_NEAREST'

    # ---- headlamps: black recess, two dark projector lenses, an LED strip along the top, a smoked lens
    mb = MeshB(); ladder_tray(HL, 0.006, 0.050, mb, 0)
    for fu, rr in ((0.45, 0.016), (0.72, 0.018)):
        yc = 0.618 + (0.868 - 0.618) * fu
        c, n = f3_eval(f3_uv([(yc, 0.652)]))
        c, n = c[0] - n[0] * 0.030, n[0]
        t1 = np.cross(n, [0, 0, 1.0]); t1 /= np.linalg.norm(t1); t2 = np.cross(n, t1)
        th = np.linspace(0, 2 * math.pi, 28, endpoint=False)
        for prof, mt in (([(0.0, 0.006), (0.6, 0.0045), (1.0, 0.0)], 1), ([(1.0, 0.0), (1.25, 0.002), (1.4, -0.006)], 2)):
            pr = np.array(prof)
            V = (c[None, None, :] + n[None, None, :] * pr[:, 1][:, None, None]
                 + (t1[None, None, :] * np.cos(th)[None, :, None] + t2[None, None, :] * np.sin(th)[None, :, None]) * (pr[:, 0] * rr)[:, None, None])
            mb.grid(V, closed_u=True, mat=mt)
    Pt, Nt = f3_eval(f3_uv([(y, z - 0.009) for y, z in rs2(HL_TOP, 40)[3:]]))
    mb.grid(tube(Pt - Nt * 0.012, 0.0022, 6, 1.0), closed_u=True, mat=3)
    o = mirror_both(mb).build("Headlamp_Unit", "Lights", [BLK_GLOSS, "TY_Lens_Clear", CHROME, EMIT_W], weld=1e-6)
    o.data.set_sharp_from_angle(angle=math.radians(40))
    V = lens_patch(HL, 6, -0.0035)
    mb = MeshB(); mb.grid(V, flip=flipflag(V)[0])
    o = mirror_both(mb).build("Headlamp_Lens", "Lights", [LENS_DARK], weld=1e-6)
    add_shell(o, thick=0.003, bevel=0)

    # ---- the J slots: a black recess
    mb = MeshB(); ladder_tray(JL, 0.004, 0.022, mb, 0)
    mirror_both(mb).build("Bumper_Front_J", "Details", [BLK_PLASTIC], weld=1e-6).data.set_sharp_from_angle(angle=math.radians(40))

    # ---- grille: the recess, six slats, ribs every ≈0.11 m, and the front camera at the top edge
    g = GR
    mb = MeshB(); ladder_tray(GL, 0.008, 0.055, mb, 0)
    mm = np.array([1.0, -1.0, 1.0])
    for z in np.linspace(g['z0'] + 0.016, g['z1'] - 0.016, 6):
        hw = np.interp(z, [g['z0'], g['z1']], [g['y_bot'], g['y_top']]) - 0.012
        Pl, Nl = f3_eval(f3_uv([(y, z) for y in np.linspace(0.0, hw, 40)]))
        Pl, Nl = np.vstack([(Pl * mm)[:0:-1], Pl]), np.vstack([(Nl * mm)[:0:-1], Nl])
        mb.grid(box_section(Pl - Nl * 0.030, Nl, 0.004, 0.022, -0.004), closed_u=True, mat=0)
    ribs = MeshB()
    for y in np.arange(0.055, 0.551, 0.11):
        Pc, Nc = f3_eval(f3_uv([(y, z) for z in np.linspace(g['z0'] + 0.006, g['z1'] - 0.006, 12)]))
        ribs.grid(box_section(Pc - Nc * 0.032, Nc, 0.003, 0.024, -0.004), closed_u=True, mat=0)
    merge(mb, mirror_both(ribs)).build("Grille_Front", "Details", [BLK_PLASTIC], weld=1e-6).data.set_sharp_from_angle(angle=math.radians(35))
    c, n = f3_eval(f3_uv([(0.0, g['z1'] - 0.016)]))
    c, n = c[0] - n[0] * 0.012, n[0]
    mb = MeshB()
    th = np.linspace(0, 2 * math.pi, 32, endpoint=False)
    t1 = np.array([0, 1.0, 0]); t2 = np.cross(n, t1)
    for prof, mt in (([(0.0, 0.012), (0.012, 0.0115), (0.016, 0.008), (0.017, 0.0)], 0), ([(0.0, 0.0125), (0.006, 0.0124), (0.0075, 0.0118)], 1)):
        pr = np.array(prof)
        V = (c[None, None, :] + n[None, None, :] * pr[:, 1][:, None, None]
             + (t1[None, None, :] * np.cos(th)[None, :, None] + t2[None, None, :] * np.sin(th)[None, :, None]) * pr[:, 0][:, None, None])
        mb.grid(V, closed_u=True, mat=mt)
    mb.build("Camera_Front_Bumper", "Details", [BLK_GLOSS, "TY_Lens_Clear"], weld=1e-6)

    # ---- the light bar: matched by y across the middle, by arc length in the corner where the bonnet's edge turns back
    A, Bh = shf['V'][-1], BODY['hood_lead']
    A, Bh = A[np.argsort(A[:, 1])], Bh[np.argsort(Bh[:, 1])]
    split = 0.70
    ys = np.linspace(0, split, 110)
    Am = np.stack([np.interp(ys, A[:, 1], A[:, i]) for i in range(3)], 1)
    Bm = np.stack([np.interp(ys, Bh[:, 1], Bh[:, i]) for i in range(3)], 1)
    At = np.vstack([Am[-1:], A[A[:, 1] > split]])
    Bt = np.vstack([Bm[-1:], Bh[Bh[:, 1] > split]])
    lower = np.vstack([Am, rs2(At, 30)[1:]])
    upper = np.vstack([Bm, rs2(Bt, 30)[1:]])
    R = ruled(lower, upper, 4)
    Nn, fl = outward(R)
    dep = np.array([0.0, 0.006, 0.008, 0.006, 0.0])[:, None, None]
    R = R - Nn * dep
    mb = MeshB(); mb.grid(R, flip=fl)
    finish(mb.build("Lightbar_Front_Housing", "Lights", BLK_GLOSS, weld=1e-5), gap=0, thick=0.004, bevel=0, mirror=True)
    k = len(lower) - 8
    led = R[2][:k] + Nn[2][:k] * 0.0025
    taper = np.clip((np.arange(k) - (k - 30)) / 30, 0, 1)
    w = 0.0036 * (1 - 0.5 * taper)
    T = np.gradient(led, axis=0); T /= np.linalg.norm(T, axis=1)[:, None]
    Bn = np.cross(T, Nn[2][:k]); Bn /= np.linalg.norm(Bn, axis=1)[:, None]
    a = np.linspace(0, 2 * math.pi, 8, endpoint=False)
    V = led[:, None, :] + Bn[:, None, :] * (np.cos(a)[None, :, None] * w[:, None, None]) + Nn[2][:k][:, None, :] * (np.sin(a)[None, :, None] * 0.0018)
    mb = MeshB(); mb.grid(V, closed_u=True)
    finish(mb.build("Lightbar_Front_LED", "Lights", EMIT_W, weld=1e-5), gap=0, thick=0, bevel=0, mirror=True, sharp=0)
    return cover
