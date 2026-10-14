# Tesla Model Y 2025 - exterior panels, glass and trims built as patches on the design surfaces.
H = 0.020          # target cell size
GAP = 0.0020       # half panel gap
RP, RA = 0.428, 0.400   # wheel-arch radii: painted edge / cladding inner edge
ROCK = 0.335       # top of the black rocker cladding
PAINT, GLASS, GLASS_T = "TY_Paint_UltraRed", "TY_Glass_Clear", "TY_Glass_Tinted"
BLK_GLOSS, BLK_PLASTIC, BLK_SATIN = "TY_Black_Gloss", "TY_Plastic_Textured", "TY_Plastic_Satin"

# ---------------------------------------------------------------- helpers
def ncell(surf, uv):
    return max(1, int(round(length3d(surf, uv) / H)))

def _counts(surf, segs):
    out = []
    for uv, n in segs:
        if isinstance(n, str):
            out.append([len(uv) - 1, True])
        elif n is None:
            out.append([ncell(surf, uv), False])
        else:
            out.append([int(n), True])
    return out

def fit_pair(surf, A, B):
    ca, cb = _counts(surf, A), _counts(surf, B)
    sa, sb = sum(c[0] for c in ca), sum(c[0] for c in cb)
    la, lb = all(c[1] for c in ca), all(c[1] for c in cb)
    if la and lb:
        assert sa == sb, ("locked side mismatch", sa, sb)
    tgt = sa if la else sb if lb else max(sa, sb)
    for c, s in ((ca, sa), (cb, sb)):
        if tgt - s:
            autos = [x for x in c if not x[1]]
            tot = sum(x[0] for x in autos)
            for x in autos[:-1]:
                x[0] = max(1, x[0] + int(round((tgt - s) * x[0] / tot)))
            autos[-1][0] += tgt - sum(x[0] for x in c)
            assert autos[-1][0] >= 1
    f = lambda S, c: [(uv, ('x' if isinstance(n, str) else k[0])) for (uv, n), k in zip(S, c)]
    return f(A, ca), f(B, cb)

def mkside2(surf, segs):
    out = []
    for uv, n in segs:
        r = np.asarray(uv, float) if isinstance(n, str) else resample(surf, uv, n)
        out.append(r if not out else r[1:])
    return np.vstack(out)

def flipflag(V):
    N = grid_normals(V)
    c = V.copy()
    c[:, :, 0] -= np.clip(c[:, :, 0], 0.3, 2.6)
    c[:, :, 2] -= 0.7
    return bool((N * c).sum() < 0), N

def tpatch(surf, B, T, L, R, offset=0.0):
    B, T = fit_pair(surf, B, T)
    L, R = fit_pair(surf, L, R)
    G = tfi(mkside2(surf, B), mkside2(surf, T), mkside2(surf, L), mkside2(surf, R))
    V = surf.eval(G[:, :, 0], G[:, :, 1])
    fl, N = flipflag(V)
    if offset:
        onc = np.abs(V[:, :, 1]) < 1e-9
        V = V + (-N if fl else N) * offset
        V[onc, 1] = 0.0
    return V, fl

def add(mb, V, mat=0, offset=0.0):
    fl, N = flipflag(V)
    if offset:
        onc = np.abs(V[:, :, 1]) < 1e-9
        V = V + (-N if fl else N) * offset
        V[onc, 1] = 0.0
    mb.grid(V, flip=fl, mat=mat)

def sv(pts, smooth=True, n=200):
    return M.uv_side(catmull(pts, n) if (smooth and len(pts) > 2) else polyline(pts, n))

def tv(pts, smooth=True, n=200):
    return M.uv_top(catmull(pts, n) if (smooth and len(pts) > 2) else polyline(pts, n))

def uvline(a, b, n=60):
    t = np.linspace(0, 1, n)[:, None]
    return np.asarray(a, float)[None] * (1 - t) + np.asarray(b, float)[None] * t

def arc(cx, r, a0, a1, n=260):
    a = np.radians(np.linspace(a0, a1, n))
    return M.uv_side(np.stack([cx + r * np.cos(a), TIRE_R + r * np.sin(a)], 1))

def trim_rim(uv):
    """Drop the leading part of a polyline that lies below the rim (s == 1)."""
    ok = uv[:, 1] < 1 - 1e-6
    if not ok[0]:
        i = int(np.argmax(ok))
        uv = uv[max(i - 1, 0):].copy()
        uv[0, 1] = 1.0
    return uv

def cap_to_main(C, xi, v):
    return np.stack([C.xv + C.sign * (np.asarray(xi) - 1), C.sj(np.asarray(v))], 1)

def main_to_cap(C, uv):
    return np.stack([C.xi_from_x(uv[:, 0]), C.v_from_s(uv[:, 1])], 1)

def cap_sheet(C, vbreaks, cols, h=None):
    h = h or H
    vs, ridx = [], [0]
    for a, b in zip(vbreaks[:-1], vbreaks[1:]):
        L = max(np.linalg.norm(C.eval(0.0, b) - C.eval(0.0, a)), np.linalg.norm(C.eval(1.0, b) - C.eval(1.0, a)))
        n = max(1, int(round(L / h)))
        vs += list(np.linspace(a, b, n, endpoint=False))
        ridx.append(len(vs))
    vs.append(vbreaks[-1])
    vs = np.array(vs)
    Bk = [np.asarray(f(vs), float) * np.ones_like(vs) if callable(f) else np.full(vs.shape, float(f)) for f in cols]
    parts, cidx = [], [0]
    tt = np.linspace(0, 1, 24)
    for k in range(len(Bk) - 1):
        Lmax = 0
        for j in np.linspace(0, len(vs) - 1, 9).astype(int):
            xi = Bk[k][j] + (Bk[k + 1][j] - Bk[k][j]) * tt
            P = C.eval(xi, np.full_like(xi, vs[j]))
            Lmax = max(Lmax, np.linalg.norm(np.diff(P, axis=0), axis=1).sum())
        n = max(1, int(round(Lmax / h)))
        f = np.linspace(0, 1, n, endpoint=False)[None, :]
        parts.append(Bk[k][:, None] + (Bk[k + 1] - Bk[k])[:, None] * f)
        cidx.append(cidx[-1] + n)
    parts.append(Bk[-1][:, None])
    XI = np.hstack(parts)
    V = C.eval(XI, vs[:, None])
    return dict(V=V, XI=XI, vs=vs, ridx=ridx, cidx=cidx, C=C)

def blk(sh, r0, r1, c0, c1):
    return sh['V'][sh['ridx'][r0]:sh['ridx'][r1] + 1, sh['cidx'][c0]:sh['cidx'][c1] + 1]

def inset_boundary(me, gap, center=True):
    bm = bmesh.new()
    bm.from_mesh(me)
    moves = {}
    for v in bm.verts:
        if not v.is_boundary:
            continue
        on_c = center and abs(v.co.y) < 1e-6
        if on_c:
            be = [e for e in v.link_edges if e.is_boundary]
            if all(abs(e.other_vert(v).co.y) < 1e-6 for e in be):
                continue
            nb = [e.other_vert(v) for e in be if abs(e.other_vert(v).co.y) < 1e-6]
        else:
            nb = [e.other_vert(v) for e in v.link_edges if not e.is_boundary]
            nb = [o for o in nb if not o.is_boundary] or nb
        if nb:
            tgt = sum((o.co for o in nb), Vector()) / len(nb)
        else:
            tgt = sum((f.calc_center_median() for f in v.link_faces), Vector()) / len(v.link_faces)
        d = tgt - v.co
        if d.length > 1e-9:
            moves[v] = v.co + d.normalized() * gap
    for v, c in moves.items():
        v.co = c
    bm.to_mesh(me)
    bm.free()

def finish(ob, gap=GAP, thick=0.010, bevel=0.0010, mirror=False, sharp=38):
    if gap:
        inset_boundary(ob.data, gap, center=mirror)
    if sharp:
        ob.data.set_sharp_from_angle(angle=math.radians(sharp))
    add_shell(ob, thick=thick, bevel=bevel, mirror=mirror)
    if thick and len(ob.data.materials) == 1 and ob.data.materials[0].name == PAINT:
        ob.data.materials.append(get_mat("TY_Body_Inner"))
        ob.modifiers["Solidify"].material_offset = 1
    return ob

def panel(mb, name, coll, mats, lr=False, **kw):
    if lr:
        a = mb.build(name + "_R", coll, mats, weld=3e-4)
        b = mb.mirrored().build(name + "_L", coll, mats, weld=3e-4)
        return finish(a, **kw), finish(b, **kw)
    kw.setdefault("mirror", True)
    return finish(mb.build(name, coll, mats, weld=3e-4), **kw)

def frit(surf, B, T, L, R, name, wb, wt, wr, cam=False):
    """Black ceramic band printed on the inside of a glass pane (ring of faces under the glass)."""
    V, fl = tpatch(surf, B, T, L, R, offset=-0.0078)
    nv, nu = V.shape[:2]
    mb = MeshB()
    mb.raw(V.reshape(-1, 3), [])
    for j in range(nv - 1):
        for i in range(nu - 1):
            keep = j < wb or j >= nv - 1 - wt or i >= nu - 1 - wr
            if cam and i < 5 and j >= nv - 1 - 7:
                keep = True
            if keep:
                q = (j * nu + i, j * nu + i + 1, (j + 1) * nu + i + 1, (j + 1) * nu + i)
                mb.f.append(q[::-1] if fl else q); mb.mi.append(0)
    ob = mb.build(name, "Glass", BLK_GLOSS, weld=0)
    add_shell(ob, thick=0, bevel=0, mirror=True)
    return ob

def ruled(A, B, n=2):
    t = np.linspace(0, 1, n + 1)[:, None, None]
    return A[None] * (1 - t) + B[None] * t

# ---------------------------------------------------------------- feature curves
ZTOPR_S = float(M.s_from_z([3.01], [1.33])[0])
_bd = catmull([(0.47, 1.085), (1.0, 1.103), (1.735, 1.132), (2.4, 1.165), (2.785, 1.207)], 300)
_bd = np.vstack([_bd, [(2.90, 1.268), (3.01, 1.330)]])
_td = catmull([(0.47, 1.087), (0.56, 1.135), (0.65, 1.190), (0.90, 1.345), (1.15, 1.475), (1.45, 1.527),
               (1.75, 1.540), (2.2, 1.522), (2.55, 1.478), (2.78, 1.42), (2.93, 1.365), (3.01, 1.330)], 400)
zb = lambda x: np.interp(x, _bd[:, 0], _bd[:, 1])
zt = lambda x: np.interp(x, _td[:, 0], _td[:, 1])
DOOR_F = [(0.50, ROCK), (0.492, 0.70), (0.47, 1.085)]
DOOR_B = [(1.665, ROCK), (1.70, 0.80), (1.735, float(zb(1.735)))]
DOOR_R = [(2.42, ROCK), (2.445, 0.47), (2.50, 0.62), (2.60, 0.80), (2.70, 0.98), (2.76, 1.10), (2.785, 1.207)]
HOOD_SIDE = [(-0.35, 0.775), (-0.10, 0.787), (0.15, 0.795), (0.36, 0.800)]
HOOD_REAR = [(0.165, 0.0), (0.20, 0.30), (0.27, 0.55), (0.33, 0.72), (0.36, 0.80)]
COWL = [(0.205, 0.0), (0.24, 0.30), (0.31, 0.55), (0.375, 0.72), (0.41, 0.775)]
WS_SIDE = [(0.41, 0.775), (0.65, 0.722), (0.90, 0.652), (1.15, 0.590)]
HEADER = [(1.128, 0.0), (1.135, 0.30), (1.15, 0.590)]
ROOF_SIDE = [(1.15, 0.590), (1.45, 0.578), (1.80, 0.570), (2.20, 0.555), (2.55, 0.535), (2.72, 0.522)]
HINGE = [(2.735, 0.0), (2.732, 0.30), (2.72, 0.522)]
YJ = float(M.eval(XV_R, CR.s_top)[1])
TG_SIDE = [(2.72, 0.522), (3.00, 0.575), (3.25, 0.660), (XV_R, YJ)]
BL_TOP = [(2.80, 0.0), (2.80, 0.30), (2.80, 0.455)]
BL_SIDE = [(2.80, 0.455), (3.05, 0.490), (3.30, 0.545), (3.40, 0.575)]
BL_BOT = [(3.43, 0.0), (3.425, 0.30), (3.40, 0.575)]


def build_body():
    out = {}
    # ====================================================== FRONT CAP SHEET
    A_SF = 148.0
    Kf = trim_rim(arc(0.0, RP, 205, A_SF))
    Kf = main_to_cap(CF, Kf)
    seam_top = np.array([CF.xi_from_x(-0.545), 1.0])
    Kf = np.vstack([Kf, uvline(Kf[-1], seam_top, 80)[1:]])
    Kf[0, 1], Kf[-1, 1] = 0.0, 1.0
    v_sa_f = float(main_to_cap(CF, arc(0.0, RP, A_SF, A_SF, 2))[0, 1])
    xe_f = lambda v: np.interp(v, Kf[:, 1], Kf[:, 0])
    vz = CF.v_from_z
    v_i0, v_i1, v_s0, v_s1 = float(vz(0.285)), float(vz(0.395)), float(vz(0.617)), float(vz(0.668))
    vbf = [0.0, vz(0.262), v_i0, v_i1, v_sa_f, v_s0, v_s1, 1.0]
    assert all(b > a + 0.01 for a, b in zip(vbf[:-1], vbf[1:])), vbf
    # The lower grille runs almost the width of the nose, between the two dark lamp blades (Commons photographs of the
    # Juniper, ≈): ±0.80 of the half-width at its foot, ±0.74 at its top edge. It was ±0.46, a slot under the plate.
    b_int = lambda v: np.interp(v, [v_i0, v_i1], [0.80, 0.74])
    b_pod = lambda v: np.interp(v, [v_s0, v_s1], [0.585, 0.47])
    b_mid = lambda v: np.where(np.asarray(v) >= v_s0, b_pod(v), np.maximum(b_pod(v), np.interp(v, [v_i0, v_i1, v_s0], [0.83, 0.79, 0.585])))
    shf = cap_sheet(CF, vbf, [0.0, b_int, b_mid, 0.87, xe_f])
    out['shf'] = shf
    # bumper cover (everything except intake + headlamp pods)
    mb = MeshB()
    for r in range(1, 7):
        for c in range(4):
            if (r == 2 and c == 0) or (r == 5 and c == 2):
                continue
            add(mb, blk(shf, r, r + 1, c, c + 1))
    panel(mb, "Bumper_Front", "Body", PAINT, thick=0.028)
    mb = MeshB()
    for c in range(4):
        add(mb, blk(shf, 0, 1, c, c + 1))
    panel(mb, "Bumper_Front_Lip", "Body", BLK_PLASTIC, thick=0.02)
    mb = MeshB(); add(mb, blk(shf, 2, 3, 0, 1), offset=-0.030)
    panel(mb, "Bumper_Front_Intake", "Body", BLK_PLASTIC, gap=0, thick=0.004, bevel=0)
    mb = MeshB(); add(mb, blk(shf, 5, 6, 2, 3), offset=-0.026)
    panel(mb, "Headlamp_Housing", "Lights", BLK_GLOSS, lr=True, gap=0, thick=0.003, bevel=0)
    mb = MeshB(); add(mb, blk(shf, 5, 6, 2, 3), offset=-0.0015)
    panel(mb, "Headlamp_Lens", "Lights", GLASS, lr=True, gap=0.001, thick=0.003, bevel=0)

    # ====================================================== HOOD
    tr = shf['V'][-1]                                   # cap top rail (3D)
    xtr = lambda y: np.interp(y, tr[:, 1], tr[:, 0])
    ys = np.linspace(0, 0.69, 60)
    lead = np.stack([xtr(ys) + 0.014, ys], 1)
    pc2 = np.array([xtr(0.70) + 0.095, 0.756])
    lead = np.vstack([lead, catmull([lead[-1], (xtr(0.735) + 0.040, 0.741), pc2], 30)[1:]])
    lead_uv = M.uv_top(lead)
    side_uv = tv([tuple(pc2)] + HOOD_SIDE)
    rear_uv = tv(HOOD_REAR)
    cl = lambda x0, x1: uvline((x0, 0.0), (x1, 0.0))
    V, fl = tpatch(M, [(lead_uv, None)], [(rear_uv, None)], [(cl(lead[0, 0], HOOD_REAR[0][0]), None)], [(side_uv, None)])
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Hood", "Body", PAINT)
    out['hood_lead'] = M.eval(lead_uv[:, 0], lead_uv[:, 1])
    out['pc2'] = pc2

    # cowl + windshield + roof glass
    cowl_uv, ws_uv, hd_uv = tv(COWL), tv(WS_SIDE), tv(HEADER)
    h0, w0 = rear_uv[-1], cowl_uv[-1]
    V, fl = tpatch(M, [(rear_uv, None)], [(cowl_uv, None)], [(cl(HOOD_REAR[0][0], COWL[0][0]), None)], [(uvline(h0, w0, 20), None)], offset=-0.008)
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Cowl_Panel", "Trim", BLK_PLASTIC, gap=0, thick=0.004, bevel=0)
    V, fl = tpatch(M, [(cowl_uv, None)], [(hd_uv, None)], [(cl(COWL[0][0], HEADER[0][0]), None)], [(ws_uv, None)], offset=-0.002)
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Glass_Windshield", "Glass", GLASS, thick=0.005, bevel=0)
    frit(M, [(cowl_uv, None)], [(hd_uv, None)], [(cl(COWL[0][0], HEADER[0][0]), None)], [(ws_uv, None)], "Glass_Windshield_Frit", 3, 2, 2, cam=True)
    rs_uv, hg_uv = tv(ROOF_SIDE), tv(HINGE)
    V, fl = tpatch(M, [(hd_uv, None)], [(hg_uv, None)], [(cl(HEADER[0][0], HINGE[0][0]), None)], [(rs_uv, None)], offset=-0.002)
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Glass_Roof", "Glass", "TY_Glass_Roof", thick=0.005, bevel=0)
    frit(M, [(hd_uv, None)], [(hg_uv, None)], [(cl(HEADER[0][0], HINGE[0][0]), None)], [(rs_uv, None)], "Glass_Roof_Frit", 3, 3, 2)

    # ====================================================== FENDER
    j_sa = shf['ridx'][4]
    seam_main = cap_to_main(CF, shf['XI'][j_sa:, -1], shf['vs'][j_sa:])
    pc2_uv = side_uv[0]
    d0 = M.uv_side([DOOR_F[-1]])[0]
    V, fl = tpatch(M,
                   [(arc(0.0, RP, A_SF, -2.81), None), (sv([(RP * math.cos(math.radians(2.81)), ROCK), DOOR_F[0]], False), None)],
                   [(side_uv, None), (uvline(h0, w0, 20), None), (uvline(w0, d0, 40), None)],
                   [(seam_main, 'x'), (uvline(seam_main[-1], pc2_uv, 20), None)],
                   [(sv(DOOR_F), None)])
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Fender", "Body", PAINT, lr=True)

    # ====================================================== DOORS
    belt = lambda x0, x1: sv([(x, float(zb(x))) for x in np.linspace(x0, x1, 40)], False)
    rock = lambda x0, x1: sv([(x0, ROCK), (x1, ROCK)], False)
    V, fl = tpatch(M, [(rock(DOOR_F[0][0], DOOR_B[0][0]), None)], [(belt(DOOR_F[-1][0], DOOR_B[-1][0]), None)],
                   [(sv(DOOR_F), None)], [(sv(DOOR_B), None)])
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Door_Front", "Body", PAINT, lr=True)
    V, fl = tpatch(M, [(rock(DOOR_B[0][0], DOOR_R[0][0]), None)], [(belt(DOOR_B[-1][0], DOOR_R[-1][0]), None)],
                   [(sv(DOOR_B), None)], [(sv(DOOR_R), None)])
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Door_Rear", "Body", PAINT, lr=True)

    # ====================================================== REAR CAP SHEET
    vz = CR.v_from_z
    A_SA = 38.0
    Kr = trim_rim(arc(WB, RP, -30, A_SA))
    Kr = main_to_cap(CR, Kr)
    v_sa = float(Kr[-1, 1])
    v_d, v_p0, v_p1, v_tgb, v_lb, v_lt = vz(0.60), vz(0.40), vz(0.52), vz(0.685), vz(1.005), vz(1.10)
    Kr = np.vstack([Kr, uvline(Kr[-1], (1.02, v_lb), 80)[1:], [(1.10, v_lt)], [(1.10, 1.0)]])
    Kr[0, 1] = 0.0
    xe_r = lambda v: np.interp(v, Kr[:, 1], Kr[:, 0])
    xtg = lambda v: np.where(np.asarray(v) <= v_lt, np.interp(v, [0, v_tgb, v_lb, v_lt], [0.42, 0.42, 0.445, 0.46]), 0.46 + 0.54 * (np.clip((np.asarray(v) - v_lt) / (1 - v_lt), 0, 1)) ** 2.4)
    vbr = [0.0, v_p0, v_p1, v_d, v_sa, v_tgb, v_lb, v_lt, 1.0]
    assert all(b > a + 0.008 for a, b in zip(vbr[:-1], vbr[1:])), vbr
    shr = cap_sheet(CR, vbr, [0.0, 0.17, xtg, xe_r])
    out['shr'] = shr
    out.update(v_lb=v_lb, v_lt=v_lt, xtg=xtg, v_p0=v_p0, v_p1=v_p1, v_d=v_d)
    mb = MeshB()
    for r in range(3):
        for c in range(3):
            if not (r == 1 and c == 0):
                add(mb, blk(shr, r, r + 1, c, c + 1))
    panel(mb, "Bumper_Rear_Diffuser", "Body", BLK_PLASTIC, thick=0.02)
    mb = MeshB()
    for r in range(3, 6):
        for c in range(3):
            if r == 5 and c < 2:
                continue
            add(mb, blk(shr, r, r + 1, c, c + 1))
    panel(mb, "Bumper_Rear", "Body", PAINT, thick=0.02)
    mb = MeshB(); add(mb, blk(shr, 1, 2, 0, 1), offset=-0.014)
    panel(mb, "Bumper_Rear_PlateRecess", "Body", BLK_PLASTIC, gap=0, thick=0.003, bevel=0)
    mb = MeshB()
    add(mb, blk(shr, 6, 7, 0, 1), offset=-0.018); add(mb, blk(shr, 6, 7, 1, 2), offset=-0.018)
    panel(mb, "Taillight_Bar_Housing", "Lights", BLK_GLOSS, gap=0, thick=0.003, bevel=0)
    mb = MeshB(); add(mb, blk(shr, 6, 7, 2, 3), offset=-0.022)
    panel(mb, "Taillight_Outer_Housing", "Lights", BLK_GLOSS, lr=True, gap=0, thick=0.003, bevel=0)
    mb = MeshB(); add(mb, blk(shr, 6, 7, 2, 3), offset=-0.001)
    panel(mb, "Taillight_Outer_Lens", "Lights", "TY_Lens_Smoke", lr=True, gap=0.001, thick=0.003, bevel=0)

    # ====================================================== TAILGATE
    mb = MeshB()
    for c in range(2):
        add(mb, blk(shr, 5, 6, c, c + 1))
        add(mb, blk(shr, 7, 8, c, c + 1))
    ci = shr['cidx'][2]
    top3 = shr['V'][-1, :ci + 1]
    xi_top = shr['XI'][-1, :ci + 1]
    te = np.stack([top3[:, 0] + 0.026 * (1 - xi_top ** 3), top3[:, 1]], 1)
    te_uv = M.uv_top(te)
    te_uv[-1] = (XV_R, CR.s_top)
    te3 = M.eval(te_uv[:, 0], te_uv[:, 1])
    Rb = ruled(top3, te3, 2)
    mb.grid(Rb, flip=flipflag(Rb)[0])
    bt_uv, bs_uv, bb_uv = tv(BL_TOP), tv(BL_SIDE), tv(BL_BOT)
    tgs_uv = tv(TG_SIDE)
    tgs_uv[-1] = (XV_R, CR.s_top)
    d1 = uvline(hg_uv[-1], bt_uv[-1], 12)      # hinge corner -> glass front corner
    d2 = uvline(bb_uv[-1], tgs_uv[-1], 30)     # glass rear corner -> J
    nd1 = nd2 = 7
    V, fl = tpatch(M, [(hg_uv, None)], [(bt_uv, None)], [(cl(HINGE[0][0], BL_TOP[0][0]), None)], [(d1, nd1)])
    mb.grid(V, flip=fl)
    V, fl = tpatch(M, [(bs_uv, None)], [(tgs_uv, None)], [(d1[::-1], nd1)], [(d2, nd2)])
    mb.grid(V, flip=fl)
    V, fl = tpatch(M, [(bb_uv, None)], [(te_uv, 'x')], [(cl(BL_BOT[0][0], te[0, 0]), None)], [(d2, nd2)])
    mb.grid(V, flip=fl)
    panel(mb, "Tailgate", "Body", PAINT, thick=0.02)
    V, fl = tpatch(M, [(bt_uv, None)], [(bb_uv, None)], [(cl(BL_TOP[0][0], BL_BOT[0][0]), None)], [(bs_uv, None)], offset=-0.002)
    mb = MeshB(); mb.grid(V, flip=fl)
    panel(mb, "Glass_Backlight", "Glass", GLASS_T, thick=0.004, bevel=0)
    frit(M, [(bt_uv, None)], [(bb_uv, None)], [(cl(BL_TOP[0][0], BL_BOT[0][0]), None)], [(bs_uv, None)], "Glass_Backlight_Frit", 2, 3, 2)

    # ====================================================== BODY SIDE (A-pillar, roof rail, C-pillar, quarter)
    mb = MeshB()
    add(mb, blk(shr, 7, 8, 2, 3))                                   # tab above the tail lamp
    j0 = shr['ridx'][4]
    b2_main = cap_to_main(CR, shr['XI'][j0:, -1], shr['vs'][j0:])    # seam + lamp end + tab edge (bottom -> top)
    x_tab = float(b2_main[-1, 0])
    s_top = CR.s_top
    tip = np.array([3.01, s_top])
    iso_q = uvline((x_tab, s_top), tip, 60)
    n_q = ncell(M, iso_q)
    gl_edge = sv([(2.785, 1.207), (2.90, 1.268), (3.01, 1.330)], False)
    gl_edge[-1] = tip
    Dd = catmull(DOOR_R, 200)
    kd = int(np.argmin(np.abs(Dd[:, 1] - 0.80)))
    dc_lo, dc_up = M.uv_side(Dd[:kd + 1]), M.uv_side(Dd[kd:])
    A_DG = 100.0
    pa = (WB + RP * math.cos(math.radians(A_DG)), TIRE_R + RP * math.sin(math.radians(A_DG)))
    dg_line = sv([tuple(Dd[kd]), pa], False)
    V, fl = tpatch(M, [(rock(DOOR_R[0][0], WB - RP * math.cos(math.radians(2.81))), 6)], [(dg_line, 6)],
                   [(dc_lo, None)], [(arc(WB, RP, 182.81, A_DG), None)])
    mb.grid(V, flip=fl)
    V, fl = tpatch(M,
                   [(dg_line, 6), (arc(WB, RP, A_DG, A_SA), None)],
                   [(gl_edge, None), (iso_q[::-1], n_q)],
                   [(dc_up, None)],
                   [(b2_main, 'x')])
    mb.grid(V, flip=fl)
    # roof-rail strip
    tabtop = cap_to_main(CR, shr['XI'][-1, shr['cidx'][2]:], shr['vs'][-1] * np.ones(shr['cidx'][3] - shr['cidx'][2] + 1))
    dlo_top = sv([(x, float(zt(x))) for x in np.linspace(0.47, 3.01, 140)], False)
    dlo_top[0], dlo_top[-1] = d0, tip
    k = int(np.argmin(np.abs(tgs_uv[:, 0] - 3.25)))
    V, fl = tpatch(M,
                   [(dlo_top, None), (iso_q[::-1], n_q), (tabtop[::-1], 'x')],
                   [(ws_uv, None), (rs_uv, None), (tgs_uv[:k + 1], None)],
                   [(uvline(d0, w0, 40), None)],
                   [(tgs_uv[k:][::-1], None)])
    mb.grid(V, flip=fl)
    panel(mb, "BodySide", "Body", PAINT, lr=True, thick=0.02)

    # ====================================================== SIDE GLASS + TRIMS
    def dlo(xl0, xl1, xr0, xr1, ob, ot, offset):
        bot = sv([(x, float(zb(x)) + ob) for x in np.linspace(xl0, xr0, 60)], False)
        top = sv([(x, float(zt(x)) - ot) for x in np.linspace(xl1, xr1, 60)], False)
        return tpatch(M, [(bot, None)], [(top, None)], [(uvline(bot[0], top[0], 30), None)], [(uvline(bot[-1], top[-1], 30), None)], offset=offset)
    BM, TM = 0.016, 0.011
    for nm, a, mat in (("Glass_Door_Front", (0.615, 0.675, 1.685, 1.715), GLASS),
                       ("Glass_Door_Rear", (1.79, 1.82, 2.765, 2.765), GLASS_T),
                       ("Glass_Quarter", (2.80, 2.80, 2.975, 2.975), GLASS_T)):
        V, fl = dlo(*a, BM, TM, -0.003)
        mb = MeshB(); mb.grid(V, flip=fl)
        panel(mb, nm, "Glass", mat, lr=True, gap=0.001, thick=0.004, bevel=0)
    mb = MeshB()
    for a, ob, ot in (((0.478, 0.482, 0.615, 0.675), BM, TM), ((1.685, 1.715, 1.79, 1.82), BM, TM), ((2.765, 2.765, 2.80, 2.80), BM, TM)):
        V, fl = dlo(*a, ob, ot, -0.0015)
        mb.grid(V, flip=fl)
    panel(mb, "Trim_Pillar_Appliques", "Trim", BLK_GLOSS, lr=True, gap=0.0005, thick=0.004, bevel=0.0005)
    mb = MeshB()
    bot = sv([(x, float(zb(x))) for x in np.linspace(0.475, 2.99, 120)], False)
    top = sv([(x, float(zb(x)) + BM) for x in np.linspace(0.475, 2.99, 120)], False)
    V, fl = tpatch(M, [(bot, None)], [(top, None)], [(uvline(bot[0], top[0], 4), 1)], [(uvline(bot[-1], top[-1], 4), 1)], offset=0.0005)
    mb.grid(V, flip=fl)
    bot = sv([(x, float(zt(x)) - TM) for x in np.linspace(0.50, 2.99, 140)], False)
    top = sv([(x, float(zt(x))) for x in np.linspace(0.50, 2.99, 140)], False)
    V, fl = tpatch(M, [(bot, None)], [(top, None)], [(uvline(bot[0], top[0], 4), 1)], [(uvline(bot[-1], top[-1], 4), 1)], offset=0.0005)
    mb.grid(V, flip=fl)
    panel(mb, "Trim_Window_Surround", "Trim", BLK_SATIN, lr=True, gap=0.0006, thick=0.006, bevel=0.0008)

    # ====================================================== CLADDING (arches + rocker)
    mb = MeshB()
    for cx in (0.0, WB):
        inner, outer = arc(cx, RA, 196, -16), arc(cx, RP, 194.3, -14.3)
        inner, outer = trim_rim(inner)[::-1], trim_rim(outer)[::-1]
        inner, outer = trim_rim(inner)[::-1], trim_rim(outer)[::-1]
        V, fl = tpatch(M, [(inner, None)], [(outer, None)], [(uvline(inner[0], outer[0], 4), 2)], [(uvline(inner[-1], outer[-1], 4), 2)], offset=0.0025)
        mb.grid(V, flip=fl)
    x0, x1 = RP * math.cos(math.radians(2.81)), WB - RP * math.cos(math.radians(2.81))
    lo = uvline((RP * math.cos(math.radians(14.3)), 1.0), (WB - RP * math.cos(math.radians(14.3)), 1.0), 100)
    V, fl = tpatch(M, [(lo, None)], [(rock(x0, x1), None)],
                   [(arc(0.0, RP, -14.3, -2.81, 20), None)], [(arc(WB, RP, 194.3, 182.81, 20), None)], offset=0.0025)
    V2 = V.copy()
    mb.grid(V, flip=fl)
    panel(mb, "Cladding_Arches_Rocker", "Trim", BLK_PLASTIC, lr=True, gap=0.0, thick=0.03, bevel=0.0015)
    out.update(dlo_top=dlo_top, ws_uv=ws_uv, rs_uv=rs_uv, tgs_uv=tgs_uv, d0=d0, w0=w0)
    return out
