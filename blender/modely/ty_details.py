# Tesla Model Y 2025 - exterior details: light signatures, mirrors, handles, wipers, badges, plates, cameras.
EMIT_W, EMIT_R, LENS_RED, MIRROR = "TY_Emit_DRL_White", "TY_Emit_Tail_Red", "TY_Lens_Red", "TY_Mirror_Glass"
PLATE_W, PLATE_K = "TY_Plate_White", "TY_Plate_Black"


def resample3(P, n):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n + 1)
    return np.stack([np.interp(t, d, P[:, i]) for i in range(3)], 1)


def outward(V):
    fl, N = flipflag(V)
    return (-N if fl else N), fl


def tube(P, r, ns=8, squash=1.0, up=None):
    """Tube mesh grid along the polyline P (n, 3)."""
    P = np.asarray(P, float)
    T = np.gradient(P, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1)[:, None], 1e-9)
    ref = np.array([0, 0, 1.0]) if up is None else np.asarray(up, float)
    if ref.ndim == 1:
        ref = np.broadcast_to(ref, P.shape)
    B = np.cross(T, ref)
    B /= np.maximum(np.linalg.norm(B, axis=1)[:, None], 1e-9)
    Nn = np.cross(B, T)
    a = np.linspace(0, 2 * math.pi, ns, endpoint=False)
    return (P[:, None, :] + B[:, None, :] * (np.cos(a) * r)[None, :, None]
            + Nn[:, None, :] * (np.sin(a) * r * squash)[None, :, None])


def box_section(P, Nrm, w, h, lift=0.0):
    """Rectangular-section sweep along P with surface normals Nrm."""
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    B = np.cross(T, Nrm)
    B /= np.linalg.norm(B, axis=1)[:, None]
    c = P + Nrm * lift
    ring = [(-w / 2, 0), (w / 2, 0), (w / 2, h * 0.6), (0.2 * w, h), (-w / 2, h * 0.75)]
    return np.stack([c + B * a + Nrm * b for a, b in ring], 1)


def stadium(xc, zc, L, h, n=26, m=6):
    r = h / 2
    dz = np.linspace(-r, r, m + 1)
    half = L / 2 - r + np.sqrt(np.maximum(r * r - dz * dz, 0))
    f = np.linspace(-1, 1, n + 1)
    X = xc + half[:, None] * f[None, :]
    Z = zc + dz[:, None] + 0 * X
    return X, Z


def side_decal(X, Z, offset):
    uv = M.uv_side(np.stack([X.ravel(), Z.ravel()], 1))
    V = M.eval(uv[:, 0], uv[:, 1]).reshape(X.shape + (3,))
    N, fl = outward(V)
    return V + N * offset, fl


def frame_at(surf, u, v, e=1e-3):
    P = surf.eval(u, v)
    Tu = surf.eval(u + e, v) - P
    Tv = surf.eval(u, v + e) - P
    Tu /= np.linalg.norm(Tu); Tv /= np.linalg.norm(Tv)
    N = np.cross(Tu, Tv); N /= np.linalg.norm(N)
    return P, Tu, Tv, N


def rects_mesh(mb, rects, O, ex, ey, ez, depth, mat=0):
    """Extruded rectangles (x0, x1, y0, y1) in the local frame O + x*ex + y*ey, thickness along ez."""
    for x0, x1, y0, y1 in rects:
        vs = []
        for d in (0.0, depth):
            for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
                vs.append(O + ex * x + ey * y + ez * d)
        mb.raw(vs, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], mat)


WORDMARK = {
    'T': [(0, 1.2, 0.80, 1.0), (0.45, 0.75, 0.0, 0.68)],
    'E': [(0, 1.1, 0.80, 1.0), (0, 1.1, 0.40, 0.60), (0, 1.1, 0.0, 0.20)],
    'S': [(0, 1.1, 0.80, 1.0), (0, 1.1, 0.40, 0.60), (0, 1.1, 0.0, 0.20), (0, 0.28, 0.5, 0.9), (0.82, 1.1, 0.1, 0.5)],
    'L': [(0, 0.28, 0.0, 1.0), (0, 1.1, 0.0, 0.20)],
    'A': [(0, 1.1, 0.80, 1.0), (0, 0.28, 0.0, 0.68), (0.82, 1.1, 0.0, 0.68)],
}


def build_details(BODY):
    shf, shr = BODY['shf'], BODY['shr']
    # ------------------------------------------------ front light bar
    A = resample3(shf['V'][-1], 96)
    B = resample3(BODY['hood_lead'], 96)
    R = ruled(A, B, 4)
    N, fl = outward(R)
    dep = np.array([0.0, 0.007, 0.009, 0.007, 0.0])[:, None, None]
    R = R - N * dep
    mb = MeshB(); mb.grid(R, flip=fl)
    finish(mb.build("Lightbar_Front_Housing", "Lights", BLK_GLOSS, weld=1e-5), gap=0, thick=0.004, bevel=0, mirror=True)
    led = (R[2] + N[2] * 0.003)[:88]
    mb = MeshB(); mb.grid(tube(led, 0.0042, 8, 0.6, up=N[2][:88]), closed_u=True)
    finish(mb.build("Lightbar_Front_LED", "Lights", EMIT_W, weld=1e-5), gap=0, thick=0, bevel=0, mirror=True, sharp=0)

    # ------------------------------------------------ headlamp projector modules
    blkV = blk(shf, 5, 6, 2, 3)
    Nb, _ = outward(blkV)
    mb = MeshB()
    nv_, nu_ = blkV.shape[:2]
    for fu in (0.22, 0.50, 0.78):
        j, i = int(0.5 * (nv_ - 1)), int((0.30 + 0.62 * fu) * (nu_ - 1))
        P = blkV[j, i] - Nb[j, i] * 0.021
        n = Nb[j, i]
        t1 = np.cross(n, [0, 0, 1.0]); t1 /= np.linalg.norm(t1)
        t2 = np.cross(n, t1)
        for prof, mat in (([(0.0, 0.012), (0.010, 0.0105), (0.0165, 0.0065), (0.0190, 0.0)], 1),
                          ([(0.0190, 0.0), (0.0225, 0.004), (0.0245, 0.004), (0.0260, 0.0)], 0)):
            pr = np.array(prof) * 0.78
            th = np.linspace(0, 2 * math.pi, 24, endpoint=False)
            V = (P[None, None, :] + n[None, None, :] * pr[:, 1][:, None, None]
                 + (t1[None, None, :] * np.cos(th)[None, :, None] + t2[None, None, :] * np.sin(th)[None, :, None]) * pr[:, 0][:, None, None])
            mb.grid(V, closed_u=True, mat=mat)
    a = mb.build("Headlamp_Projectors_R", "Lights", [CHROME, "TY_Lens_Clear"], weld=1e-5)
    b = mb.mirrored().build("Headlamp_Projectors_L", "Lights", [CHROME, "TY_Lens_Clear"], weld=1e-5)

    # ------------------------------------------------ rear light bar LED + outer lamp elements + wordmark
    v_lb, v_lt, xtg = BODY['v_lb'], BODY['v_lt'], BODY['xtg']
    vm = 0.5 * (v_lb + v_lt)
    def cap_line(C, xi0, xi1, v, off, n=80):
        xi = np.linspace(xi0, xi1, n)
        e = 1e-3
        P = C.eval(xi, np.full(n, v))
        Tu = C.eval(xi + e, np.full(n, v)) - P
        Tv = C.eval(xi, np.full(n, v + e)) - P
        Nn = np.cross(Tu, Tv); Nn /= np.linalg.norm(Nn, axis=1)[:, None]
        c = P.copy(); c[:, 0] -= np.clip(c[:, 0], 0.3, 2.6); c[:, 2] -= 0.7
        if (Nn * c).sum() < 0:
            Nn = -Nn
        return P + Nn * off, Nn
    vv = v_lb + 0.34 * (v_lt - v_lb)
    P, Nn = cap_line(CR, 0.0, float(xtg(vv)) - 0.012, vv, -0.0135)
    mb = MeshB(); mb.grid(tube(P, 0.0120, 10, 0.35, up=Nn), closed_u=True)
    finish(mb.build("Taillight_Bar_LED", "Lights", EMIT_R, weld=1e-5), gap=0, thick=0, bevel=0, mirror=True, sharp=0)
    mb = MeshB()
    for f in (0.25, 0.75):
        vv = v_lb + f * (v_lt - v_lb)
        P, Nn = cap_line(CR, float(xtg(vv)) + 0.02, 1.0, vv, -0.016, 40)
        mb.grid(tube(P, 0.0055, 8, 0.7, up=Nn), closed_u=True)
    mb.build("Taillight_Outer_LED_R", "Lights", EMIT_R, weld=1e-5)
    mb.mirrored().build("Taillight_Outer_LED_L", "Lights", EMIT_R, weld=1e-5)
    # TESLA wordmark in the light band
    mb = MeshB()
    hgt = 0.019
    pitch = 0.105
    vw = v_lb + 0.76 * (v_lt - v_lb)
    for k, ch in enumerate("TESLA"):
        yc = (k - 2) * pitch            # seen from behind the car the reader's right is +Y
        xi = float(inv2d(CR, [[abs(yc), CR.eval(0.0, vw)[2]]], (1, 2), (0, 0.6), (vw - 0.02, vw + 0.02))[0, 0]) if abs(yc) > 1e-6 else 0.0
        P, Tu, Tv, Nn = frame_at(CR, xi, vw)
        if Nn[0] < 0:
            Nn = -Nn
        P = P - Nn * 0.0175
        ey = np.array([0, 0, 1.0]) - Nn * Nn[2]; ey /= np.linalg.norm(ey)
        Nn = Nn * np.array([1.0, (1.0 if yc >= 0 else -1.0), 1.0])
        ey = np.array([0, 0, 1.0]) - Nn * Nn[2]; ey /= np.linalg.norm(ey)
        ex = np.cross(ey, Nn)
        if ex[1] < 0:
            ex = -ex
        P = np.array([P[0], yc, P[2]])
        w = 1.2 if ch == 'T' else 1.1
        O = P - ex * (w * hgt / 2) - ey * (hgt / 2)
        rects_mesh(mb, [(a * hgt, b * hgt, c * hgt, d * hgt) for a, b, c, d in WORDMARK[ch]], O, ex, ey, Nn, 0.0022)
    mb.build("Badge_TESLA_Wordmark", "Details", CHROME, weld=0)

    # ------------------------------------------------ rear reflectors, reverse lamp, cameras
    vz = CR.v_from_z
    def cap_patch(C, xi0, xi1, v0, v1, off, n=14, m=4):
        xi = np.linspace(xi0, xi1, n)[None, :]
        v = np.linspace(v0, v1, m)[:, None]
        V = C.eval(xi + 0 * v, v + 0 * xi)
        Nn, fl = outward(V)
        return V + Nn * off, fl
    V, fl = cap_patch(CR, 0.60, 0.80, vz(0.505), vz(0.530), 0.0008)
    mb = MeshB(); mb.grid(V, flip=fl)
    for o in (mb.build("Reflector_Rear_R", "Lights", LENS_RED), mb.mirrored().build("Reflector_Rear_L", "Lights", LENS_RED)):
        add_shell(o, thick=0.003, bevel=0.0005)
    V, fl = cap_patch(CR, 0.0, 0.06, vz(0.315), vz(0.345), 0.0008)
    mb = MeshB(); mb.grid(V, flip=fl)
    finish(mb.build("Lamp_Reverse_Fog", "Lights", "TY_Lens_Clear"), gap=0, thick=0.003, bevel=0.0005, mirror=True)
    V, fl = cap_patch(CR, 0.0, 0.012, vz(0.545), vz(0.565), 0.004, 4, 4)
    mb = MeshB(); mb.grid(V, flip=fl)
    finish(mb.build("Camera_Rear", "Details", BLK_GLOSS), gap=0, thick=0.008, bevel=0.002, mirror=True)
    V, fl = cap_patch(CF, 0.0, 0.016, CF.v_from_z(0.565), CF.v_from_z(0.590), 0.002, 4, 4)
    mb = MeshB(); mb.grid(V, flip=fl)
    finish(mb.build("Camera_Front_Bumper", "Details", BLK_GLOSS), gap=0, thick=0.006, bevel=0.002, mirror=True)
    V, fl = cap_patch(CF, 0.83, 0.90, CF.v_from_z(0.345), CF.v_from_z(0.535), 0.0008, 5, 14)
    mb = MeshB(); mb.grid(V, flip=fl)
    for o in (mb.build("Bumper_Front_AirCurtain_R", "Details", BLK_PLASTIC), mb.mirrored().build("Bumper_Front_AirCurtain_L", "Details", BLK_PLASTIC)):
        add_shell(o, thick=0.004, bevel=0.0008)

    # ------------------------------------------------ licence plates (EU 520 x 110)
    for nm, C, vpl, off in (("Rear", CR, 0.5 * (BODY['v_p0'] + BODY['v_p1']), -0.012), ("Front", CF, CF.v_from_z(0.478), 0.006)):
        P, Tu, Tv, Nn = frame_at(C, 0.0, vpl)
        sgn = 1.0 if nm == "Rear" else -1.0
        if Nn[0] * sgn < 0:
            Nn = -Nn
        Nn = np.array([Nn[0], 0, Nn[2]]); Nn /= np.linalg.norm(Nn)
        ex = np.array([0, sgn, 0.0])
        ey = np.cross(Nn, ex)
        if ey[2] < 0:
            ey = -ey
        O = P + Nn * off
        mb = MeshB()
        rects_mesh(mb, [(-0.264, 0.264, -0.059, 0.059)], O, ex, ey, Nn, 0.004, 1)
        rects_mesh(mb, [(-0.260, 0.260, -0.055, 0.055)], O + Nn * 0.0041, ex, ey, Nn, 0.0008, 0)
        tv_, tf_ = text_mesh("MODEL Y", 0.062, 0.0006)
        yc = (tv_[:, 1].min() + tv_[:, 1].max()) / 2
        Pt = O[None, :] + Nn[None, :] * (0.0052 + tv_[:, 2:3]) + ex[None, :] * tv_[:, 0:1] + ey[None, :] * (tv_[:, 1:2] - yc)
        mb.raw(Pt, tf_, 1)
        mb.build("Plate_" + nm, "Details", [PLATE_W, PLATE_K], weld=0)

    # ------------------------------------------------ door handles, side cameras, charge port
    for nm, xc, zc in (("Front", 1.535, 0.968), ("Rear", 2.585, 1.022)):
        mb = MeshB()
        X, Z = stadium(xc, zc, 0.222, 0.036); V, fl = side_decal(X, Z, 0.0003); mb.grid(V, flip=fl, mat=1)
        X, Z = stadium(xc, zc, 0.212, 0.027); V, fl = side_decal(X, Z, 0.0016); mb.grid(V, flip=fl, mat=0)
        for o in (mb.build(f"DoorHandle_{nm}_R", "Details", [PAINT, BLK_SATIN], weld=0), mb.mirrored().build(f"DoorHandle_{nm}_L", "Details", [PAINT, BLK_SATIN], weld=0)):
            add_shell(o, thick=0.0015, bevel=0.0006)
    mb = MeshB()
    X, Z = stadium(0.345, 0.915, 0.085, 0.024, 16, 6); V, fl = side_decal(X, Z, 0.004); mb.grid(V, flip=fl)
    for o in (mb.build("Camera_Fender_R", "Details", BLK_GLOSS), mb.mirrored().build("Camera_Fender_L", "Details", BLK_GLOSS)):
        add_shell(o, thick=0.006, bevel=0.002)
    mb = MeshB()
    X, Z = stadium(1.752, 1.275, 0.030, 0.022, 8, 6); V, fl = side_decal(X, Z, 0.0005); mb.grid(V, flip=fl)
    for o in (mb.build("Camera_BPillar_R", "Details", "TY_Lens_Clear"), mb.mirrored().build("Camera_BPillar_L", "Details", "TY_Lens_Clear")):
        add_shell(o, thick=0.002, bevel=0.0005)

    # ------------------------------------------------ mirrors
    ys = [0.880, 0.905, 0.925, 0.940, 0.955, 0.985, 1.020, 1.045, 1.058, 1.0640]
    cxs = [0.560, 0.563, 0.570, 0.585, 0.600, 0.605, 0.607, 0.610, 0.613, 0.615]
    czs = [1.103, 1.104, 1.108, 1.128, 1.146, 1.152, 1.152, 1.150, 1.147, 1.145]
    axs = [0.045, 0.045, 0.045, 0.058, 0.070, 0.074, 0.072, 0.062, 0.042, 0.012]
    azs = [0.016, 0.016, 0.019, 0.044, 0.068, 0.078, 0.076, 0.064, 0.044, 0.012]
    S = catmull(np.stack([ys, cxs, czs, axs, azs], 1), 60)
    S = polyline(S, 34)
    ns_ = 36
    a = np.linspace(0, 2 * math.pi, ns_, endpoint=False)
    e = 2.7
    ca = np.sign(np.cos(a)) * np.abs(np.cos(a)) ** (2 / e)
    sa = np.sign(np.sin(a)) * np.abs(np.sin(a)) ** (2 / e)
    cap = np.minimum(ca, 0.55)
    head = np.clip((S[:, 0] - 0.930) / 0.02, 0, 1)                    # 0 on the arm, 1 on the housing
    X = S[:, 1][:, None] + S[:, 3][:, None] * (ca[None, :] * (1 - head[:, None]) + cap[None, :] * head[:, None])
    rec = (np.cos(a) > 0.72)[None, :] & (head[:, None] > 0.99) & (S[:, 0][:, None] < 1.052)
    X = X - 0.006 * rec
    Zm = S[:, 2][:, None] + S[:, 4][:, None] * sa[None, :]
    Ym = S[:, 0][:, None] + 0 * X
    V = np.stack([X, Ym, Zm], 2)
    mb = MeshB()
    nrow = V.shape[0]
    base = mb.raw(V.reshape(-1, 3), [])
    for j in range(nrow - 1):
        for i in range(ns_):
            i1 = (i + 1) % ns_
            q = (base + j * ns_ + i, base + j * ns_ + i1, base + (j + 1) * ns_ + i1, base + (j + 1) * ns_ + i)
            if rec[j, i] and rec[j, i1] and rec[j + 1, i] and rec[j + 1, i1]:
                mt = 2
            elif head[j] < 0.5 or math.sin(a[i] + 0.09) < -0.25:
                mt = 1
            else:
                mt = 0
            mb.f.append(q); mb.mi.append(mt)
    mb.f.append(tuple(base + (nrow - 1) * ns_ + i for i in range(ns_))); mb.mi.append(0)
    for o in (mb.build("Mirror_R", "Details", [PAINT, BLK_SATIN, MIRROR], weld=1e-5), mb.mirrored().build("Mirror_L", "Details", [PAINT, BLK_SATIN, MIRROR], weld=1e-5)):
        bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
        o.data.set_sharp_from_angle(angle=math.radians(40))

    # ------------------------------------------------ wipers
    cow = catmull(COWL, 200)
    xcow = lambda y: np.interp(np.abs(y), cow[:, 1], cow[:, 0])
    def glass_pts(yy, dx):
        uv = M.uv_top(np.stack([xcow(yy) + dx, np.abs(yy)], 1))
        P = M.eval(uv[:, 0], uv[:, 1])
        e = 1e-3
        Pu = M.eval(uv[:, 0] + e, uv[:, 1]) - P
        Pv = M.eval(uv[:, 0], np.clip(uv[:, 1] + e, 0, 1)) - P
        Nn = np.cross(Pu, Pv); Nn /= np.linalg.norm(Nn, axis=1)[:, None]
        Nn[Nn[:, 2] < 0] *= -1
        P[:, 1] *= np.sign(yy) + (yy == 0)
        Nn[:, 1] *= np.sign(yy) + (yy == 0)
        return P, Nn
    mb = MeshB()
    for y0, y1, yp in ((-0.61, 0.03, -0.63), (0.13, 0.60, 0.04)):
        yy = np.linspace(y0, y1, 30)
        P, Nn = glass_pts(yy, 0.042)
        mb.grid(box_section(P, Nn, 0.009, 0.011, 0.002), closed_u=True, mat=0)
        mb.grid(box_section(P[4:-4], Nn[4:-4], 0.005, 0.005, 0.013), closed_u=True, mat=0)
        Pp, Np = glass_pts(np.array([yp, yp + 0.001]), -0.02)
        mid = len(yy) // 2
        arm = np.stack([Pp[0] + Np[0] * 0.010, Pp[0] * 0.4 + P[mid] * 0.6 + Nn[mid] * 0.022, P[mid] + Nn[mid] * 0.019])
        arm = polyline(arm, 12)
        mb.grid(tube(arm, 0.0050, 8, 0.6, up=Nn[mid]), closed_u=True, mat=0)
        piv = np.stack([Pp[0] - Np[0] * 0.01, Pp[0] + Np[0] * 0.02])
        mb.grid(tube(polyline(piv, 3), 0.013, 12, 1.0, up=np.array([1.0, 0, 0])), closed_u=True, mat=0)
    mb.build("Wipers_Front", "Details", [BLK_SATIN], weld=0)

    # ------------------------------------------------ charge port door (left rear quarter, beside the tail lamp)
    mb = MeshB()
    X, Z = stadium(3.315, 1.092, 0.115, 0.050, 14, 6); V, fl = side_decal(X, Z, 0.0003); mb.grid(V, flip=fl, mat=1)
    X, Z = stadium(3.315, 1.092, 0.108, 0.043, 14, 6); V, fl = side_decal(X, Z, 0.0014); mb.grid(V, flip=fl, mat=0)
    o = mb.mirrored().build("ChargePort_Door_L", "Details", [PAINT, BLK_SATIN], weld=0)
    add_shell(o, thick=0.0015, bevel=0.0005)
