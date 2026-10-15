# Tesla Model Y (2025 "Juniper") - core surface maths and mesh helpers.
# Model space: X = distance behind the front axle (front of the car is -X),
# Y = lateral (+Y is the car's right-hand side), Z = up from the ground. Metres.
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix

WB = 2.890          # wheelbase
TRACK = 1.636
TIRE_R = 0.356      # 255/45R19
ROOT_NAME = "TESLA_MODEL_Y_ROOT"
MAIN_COLL = "TESLA_MODEL_Y"

# ----------------------------------------------------------------------------
# B-spline helpers
# ----------------------------------------------------------------------------
def bs_basis(m, s):
    """Clamped uniform cubic B-spline basis for m control points, s in [0,1] -> (N, m)."""
    s = np.clip(np.asarray(s, float).ravel(), 0.0, 1.0)
    nseg = m - 3
    t = s * nseg
    knots = np.concatenate([[0, 0, 0], np.arange(nseg + 1), [nseg, nseg, nseg]]).astype(float)
    N = np.zeros((len(t), m + 3))
    for i in range(m + 3):
        N[:, i] = (t >= knots[i]) & (t < knots[i + 1])
    last = t >= nseg
    N[last, :] = 0
    N[last, m - 1] = 1
    for d in range(1, 4):
        Nn = np.zeros((len(t), m + 3 - d))
        for i in range(m + 3 - d):
            a = knots[i + d] - knots[i]
            b = knots[i + d + 1] - knots[i + 1]
            term = 0
            if a > 0:
                term = term + (t - knots[i]) / a * N[:, i]
            if b > 0:
                term = term + (knots[i + d + 1] - t) / b * N[:, i + 1]
            Nn[:, i] = term
        N = Nn
    return N


def bs_curve(P, n=400):
    """Sample the clamped cubic B-spline with control points P (m, d)."""
    P = np.asarray(P, float)
    return bs_basis(len(P), np.linspace(0, 1, n)) @ P


def rail_fn(xk, vk):
    C = bs_curve(np.stack([xk, vk], 1), 3000)
    cx, cv = C[:, 0].copy(), C[:, 1].copy()
    return lambda x: np.interp(x, cx, cv)


def catmull(pts, n=200):
    """Dense interpolating (centripetal Catmull-Rom) polyline through pts (k, d)."""
    P = np.asarray(pts, float)
    if len(P) == 2:
        t = np.linspace(0, 1, n)[:, None]
        return P[0] * (1 - t) + P[1] * t
    Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    per = max(4, n // (len(P) - 1))
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-9) ** 0.5
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-9) ** 0.5
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-9) ** 0.5
        t = np.linspace(t1, t2, per, endpoint=False)[:, None]
        A1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
        A2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
        A3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
        B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2
        B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3
        out.append((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2)
    out.append(P[-1][None])
    return np.vstack(out)


def polyline(pts, n=200):
    """Dense piecewise-linear polyline through pts."""
    P = np.asarray(pts, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, P[:, i]) for i in range(P.shape[1])], 1)


# ----------------------------------------------------------------------------
# Main body surface: lofted x-sections, each a cubic B-spline of 10 control points
# ----------------------------------------------------------------------------
class SMain:
    NC = 10

    def __init__(self, table):
        T = np.array(table, float)
        self.x0, self.x1 = T[0, 0], T[-1, 0]
        self.f = [rail_fn(T[:, 0], T[:, i]) for i in range(1, T.shape[1])]

    def ctrl(self, x):
        g = [f(x) for f in self.f]
        zc, pk, cr, yT, zT = g[0], g[1], g[2], g[3], g[4]
        Y = [0 * x, 0.45 * (yT - cr), yT - cr, yT, g[5], g[7], g[9], g[11], g[13], g[15]]
        Z = [zc, zc, zc + pk, zT, g[6], g[8], g[10], g[12], g[14], g[16]]
        return np.stack(Y, 1), np.stack(Z, 1)

    def eval(self, x, s):
        x = np.asarray(x, float)
        s = np.asarray(s, float)
        shp = np.broadcast(x, s).shape
        xr = np.broadcast_to(x, shp).ravel()
        sr = np.broadcast_to(s, shp).ravel()
        Y, Z = self.ctrl(xr)
        B = bs_basis(self.NC, sr)
        return np.stack([xr, (B * Y).sum(1), (B * Z).sum(1)], 1).reshape(shp + (3,))

    def _samp(self, x, NS=449):
        ss = np.linspace(0, 1, NS)
        return ss, self.eval(x[:, None], ss[None, :])

    def s_from_z(self, x, z):
        """Section parameter on the side branch where the surface height equals z."""
        x = np.atleast_1d(np.asarray(x, float))
        z = np.broadcast_to(np.asarray(z, float), x.shape)
        ss, P = self._samp(x)
        Z = P[:, :, 2]
        ge = Z >= z[:, None]
        idx = Z.shape[1] - 1 - np.argmax(ge[:, ::-1], 1)
        idx = np.clip(idx, 0, len(ss) - 2)
        r = np.arange(len(x))
        z0, z1 = Z[r, idx], Z[r, idx + 1]
        den = np.where(np.abs(z0 - z1) < 1e-12, 1e-12, z0 - z1)
        f = np.clip((z0 - z) / den, 0, 1)
        return ss[idx] + f * (ss[1] - ss[0])

    def s_from_y(self, x, y):
        """Section parameter on the top branch where the half-width equals y."""
        x = np.atleast_1d(np.asarray(x, float))
        y = np.broadcast_to(np.asarray(y, float), x.shape)
        ss, P = self._samp(x)
        Y = P[:, :, 1]
        ge = Y >= y[:, None]
        idx = np.clip(np.argmax(ge, 1) - 1, 0, len(ss) - 2)
        r = np.arange(len(x))
        y0, y1 = Y[r, idx], Y[r, idx + 1]
        den = np.where(np.abs(y1 - y0) < 1e-12, 1e-12, y1 - y0)
        f = np.clip((y - y0) / den, 0, 1)
        return ss[idx] + f * (ss[1] - ss[0])

    # uv helpers (u = x, v = s)
    def uv_side(self, xz):
        """Side-view polyline (x, z) -> uv."""
        xz = np.asarray(xz, float)
        return np.stack([xz[:, 0], self.s_from_z(xz[:, 0], xz[:, 1])], 1)

    def uv_top(self, xy):
        """Plan-view polyline (x, y) -> uv."""
        xy = np.asarray(xy, float)
        return np.stack([xy[:, 0], self.s_from_y(xy[:, 0], xy[:, 1])], 1)


# ----------------------------------------------------------------------------
# End caps: rails run from the centreline, round the corner (cubic Bezier) and
# continue onto the main surface along iso-s lines.  u = xi, v = rail parameter.
# ----------------------------------------------------------------------------
class Cap:
    def __init__(self, M, prof, xv, sign, ztopj, k1, k2):
        self.M, self.xv, self.sign = M, xv, sign
        C = bs_curve(np.asarray(prof, float), 1201)
        self._vg = np.linspace(0, 1, 1201)
        self._cx, self._cz = C[:, 0], C[:, 1]
        self.k1 = k1 if callable(k1) else (lambda v, k=k1: k + 0 * v)
        self.k2 = k2 if callable(k2) else (lambda v, k=k2: k + 0 * v)
        zr = M.eval(xv, 1.0)[2]
        vg = np.linspace(0, 1, 401)
        zc = self.cz(vg)
        f = (zc - zc[0]) / (zc[-1] - zc[0])
        sj = M.s_from_z(np.full_like(vg, xv), zr + f * (ztopj - zr))
        sj[0] = 1.0
        self._sjv, self._sj = vg, sj
        self.s_top = sj[-1]

    def cx(self, v):
        return np.interp(v, self._vg, self._cx)

    def cz(self, v):
        return np.interp(v, self._vg, self._cz)

    def v_from_z(self, z):
        return np.interp(z, self._cz, self._vg)

    def sj(self, v):
        return np.interp(v, self._sjv, self._sj)

    def v_from_s(self, s):
        return np.interp(s, self._sj[::-1], self._sjv[::-1])

    def xi_from_x(self, x):
        return 1.0 + self.sign * (np.asarray(x, float) - self.xv)

    def eval(self, xi, v):
        xi = np.asarray(xi, float)
        v = np.asarray(v, float)
        shp = np.broadcast(xi, v).shape
        xi = np.broadcast_to(xi, shp).ravel()
        v = np.clip(np.broadcast_to(v, shp).ravel(), 0, 1)
        M, xv, sg = self.M, self.xv, self.sign
        s = self.sj(v)
        Pj = M.eval(np.full_like(s, xv), s)
        e = 2e-3
        T = (M.eval(np.full_like(s, xv - sg * e), s) - Pj)
        T = T / np.abs(T[:, :1])
        cx, cz = self.cx(v), self.cz(v)
        B0 = np.stack([cx, 0 * cx, cz], 1)
        B1 = B0 + np.stack([0 * cx, self.k1(v) * Pj[:, 1], 0 * cx], 1)
        B2 = Pj + T * (self.k2(v) * np.abs(cx - xv))[:, None]
        t = np.clip(xi, 0, 1)[:, None]
        bez = ((1 - t) ** 3) * B0 + 3 * ((1 - t) ** 2) * t * B1 + 3 * (1 - t) * t * t * B2 + (t ** 3) * Pj
        main = M.eval(xv + sg * np.maximum(xi - 1, 0), s)
        out = np.where((xi > 1)[:, None], main, bez)
        return out.reshape(shp + (3,))


def inv2d(surf, tgt, axes, urange, vrange, ng=70, it=12):
    """Find (u, v) so that surf.eval(u, v)[axes] == tgt (N, 2).  Grid seed + Gauss-Newton."""
    tgt = np.asarray(tgt, float)
    ug = np.linspace(urange[0], urange[1], ng)
    vg = np.linspace(vrange[0], vrange[1], ng)
    G = surf.eval(ug[None, :], vg[:, None])[:, :, list(axes)].reshape(-1, 2)
    d = ((G[None, :, :] - tgt[:, None, :]) ** 2).sum(2)
    k = d.argmin(1)
    u = ug[k % ng].copy()
    v = vg[k // ng].copy()
    e = 1e-4
    for _ in range(it):
        P = surf.eval(u, v)[:, list(axes)]
        Pu = (surf.eval(u + e, v)[:, list(axes)] - P) / e
        Pv = (surf.eval(u, v + e)[:, list(axes)] - P) / e
        r = tgt - P
        det = Pu[:, 0] * Pv[:, 1] - Pu[:, 1] * Pv[:, 0]
        det = np.where(np.abs(det) < 1e-9, 1e-9, det)
        du = (r[:, 0] * Pv[:, 1] - r[:, 1] * Pv[:, 0]) / det
        dv = (Pu[:, 0] * r[:, 1] - Pu[:, 1] * r[:, 0]) / det
        u = np.clip(u + np.clip(du, -0.1, 0.1), urange[0], urange[1])
        v = np.clip(v + np.clip(dv, -0.1, 0.1), vrange[0], vrange[1])
    return np.stack([u, v], 1)


# ----------------------------------------------------------------------------
# Patches (transfinite grids on a surface)
# ----------------------------------------------------------------------------
def resample(surf, uv, n):
    uv = np.asarray(uv, float)
    P = surf.eval(uv[:, 0], uv[:, 1])
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n + 1)
    return np.stack([np.interp(t, d, uv[:, 0]), np.interp(t, d, uv[:, 1])], 1)


def length3d(surf, uv):
    P = surf.eval(uv[:, 0], uv[:, 1])
    return float(np.linalg.norm(np.diff(P, axis=0), axis=1).sum())


def mkside(surf, segs):
    """segs: list of (dense uv polyline, n cells) -> concatenated resampled side."""
    out = []
    for uv, n in segs:
        r = resample(surf, uv, n)
        out.append(r if not out else r[1:])
    return np.vstack(out)


def tfi(bottom, top, left, right):
    nu, nv = len(bottom) - 1, len(left) - 1
    a = np.linspace(0, 1, nu + 1)[None, :, None]
    b = np.linspace(0, 1, nv + 1)[:, None, None]
    return ((1 - b) * bottom[None] + b * top[None] + (1 - a) * left[:, None] + a * right[:, None]
            - ((1 - a) * (1 - b) * bottom[0] + a * (1 - b) * bottom[-1]
               + (1 - a) * b * top[0] + a * b * top[-1]))


def grid_normals(V):
    du = np.gradient(V, axis=1)
    dv = np.gradient(V, axis=0)
    n = np.cross(du, dv)
    n /= np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-12)
    return n


def patch(surf, bottom, top, left, right, inset=0.0, sides="btlr", offset=0.0):
    """Grid of 3D points (nv+1, nu+1, 3) with outward-facing orientation flag."""
    G = tfi(bottom, top, left, right)
    V = surf.eval(G[:, :, 0], G[:, :, 1])
    N = grid_normals(V)
    c = V - np.array([0, 0, 0.75]) * 1.0
    c[:, :, 0] = 0
    flip = (N * c).sum() < 0
    if flip:
        N = -N
    if inset > 0:
        V = V.copy()
        def nrm(a):
            return a / np.maximum(np.linalg.norm(a, axis=-1, keepdims=True), 1e-9)
        if "b" in sides:
            V[0] += nrm(V[1] - V[0]) * inset
        if "t" in sides:
            V[-1] += nrm(V[-2] - V[-1]) * inset
        if "l" in sides:
            V[:, 0] += nrm(V[:, 1] - V[:, 0]) * inset
        if "r" in sides:
            V[:, -1] += nrm(V[:, -2] - V[:, -1]) * inset
    if offset:
        V = V + N * offset
    return V, flip


# ----------------------------------------------------------------------------
# Blender object helpers
# ----------------------------------------------------------------------------
def get_coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def sub(name):
    return get_coll("TY_" + name, get_coll(MAIN_COLL))


def get_root():
    r = bpy.data.objects.get(ROOT_NAME)
    if r is None:
        r = bpy.data.objects.new(ROOT_NAME, None)
        r.empty_display_type = 'PLAIN_AXES'
        r.empty_display_size = 0.3
        r.location = (-WB / 2, 0, 0)
        get_coll(MAIN_COLL).objects.link(r)
    return r


def remove_obj(name):
    o = bpy.data.objects.get(name)
    if o is not None:
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me is not None and getattr(me, "users", 1) == 0:
            try:
                bpy.data.meshes.remove(me)
            except Exception:
                pass


def clear_prefix(prefix):
    for o in [o for o in bpy.data.objects if o.name.startswith(prefix)]:
        remove_obj(o.name)


def get_mat(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    return m


class MeshB:
    """Accumulates grids / raw geometry into one mesh."""

    def __init__(self):
        self.v, self.f, self.mi = [], [], []

    def grid(self, V, flip=False, mat=0, closed_u=False, closed_v=False):
        nv, nu = V.shape[0], V.shape[1]
        base = len(self.v)
        self.v.extend(map(tuple, V.reshape(-1, 3)))
        ru = nu if closed_u else nu - 1
        rv = nv if closed_v else nv - 1
        for j in range(rv):
            j1 = (j + 1) % nv
            for i in range(ru):
                i1 = (i + 1) % nu
                q = (base + j * nu + i, base + j * nu + i1, base + j1 * nu + i1, base + j1 * nu + i)
                self.f.append(q[::-1] if flip else q)
                self.mi.append(mat)
        return base

    def raw(self, verts, faces, mat=0):
        base = len(self.v)
        self.v.extend(map(tuple, verts))
        for f in faces:
            self.f.append(tuple(base + i for i in f))
            self.mi.append(mat)
        return base

    def mirrored(self):
        m = MeshB()
        m.v = [(x, -y, z) for x, y, z in self.v]
        m.f = [f[::-1] for f in self.f]
        m.mi = list(self.mi)
        return m

    def build(self, name, coll, mats, weld=1e-4, smooth=True, parent=True):
        remove_obj(name)
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        if not isinstance(mats, (list, tuple)):
            mats = [mats]
        for m in mats:
            me.materials.append(get_mat(m) if isinstance(m, str) else m)
        me.polygons.foreach_set("material_index", self.mi)
        if weld is not None:
            bm = bmesh.new()
            bm.from_mesh(me)
            if weld:
                bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
            loose = [v for v in bm.verts if not v.link_faces]
            if loose:
                bmesh.ops.delete(bm, geom=loose, context='VERTS')
            bm.to_mesh(me)
            bm.free()
        if smooth:
            me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        me.update()
        ob = bpy.data.objects.new(name, me)
        (coll if not isinstance(coll, str) else sub(coll)).objects.link(ob)
        if parent:
            ob.parent = get_root()
        return ob


def add_shell(ob, thick=0.006, bevel=0.0012, mirror=False, subsurf=0):
    """Standard panel stack: optional mirror, inward thickness and a soft hem bevel."""
    if mirror:
        m = ob.modifiers.new("Mirror", 'MIRROR')
        m.use_axis = (False, True, False)
        m.use_clip = True
        m.merge_threshold = 0.0005
    if thick:
        s = ob.modifiers.new("Solidify", 'SOLIDIFY')
        s.thickness = thick
        s.offset = -1.0
        s.use_even_offset = False
        s.use_rim = True
    if bevel:
        b = ob.modifiers.new("Bevel", 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(50)
        b.harden_normals = False
    if subsurf:
        ss = ob.modifiers.new("Subsurf", 'SUBSURF')
        ss.levels = subsurf
        ss.render_levels = subsurf
    return ob


def build_lr(mb, name, coll, mats, **shell):
    """Build right (+Y) and left (-Y) copies of a side panel."""
    a = mb.build(name + "_R", coll, mats)
    b = mb.mirrored().build(name + "_L", coll, mats)
    for o in (a, b):
        add_shell(o, **shell)
    return a, b


# ----------------------------------------------------------------------------
# Polyline and mesh-builder utilities shared by the v3 modules
# ----------------------------------------------------------------------------


def rs2(P, n):
    """Arc-length resample of a 2D/3D polyline to n points."""
    P = np.asarray(P, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, P[:, i]) for i in range(P.shape[1])], 1)


def rounded(pts, r, n=6):
    """Open polyline through pts with its inner corners rounded over a distance r."""
    P = np.asarray(pts, float)
    out = [P[0]]
    for i in range(1, len(P) - 1):
        a, b, c = P[i - 1], P[i], P[i + 1]
        la, lc = np.linalg.norm(b - a), np.linalg.norm(c - b)
        d = min(r, 0.45 * la, 0.45 * lc)
        p0, p1 = b + (a - b) / la * d, b + (c - b) / lc * d
        out += [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * b + t * t * p1 for t in np.linspace(0, 1, n)]
    out.append(P[-1])
    return np.array(out)


def merge(*mbs):
    out = MeshB()
    for src in mbs:
        base = len(out.v)
        out.v.extend(src.v)
        out.f.extend(tuple(base + i for i in f) for f in src.f)
        out.mi.extend(src.mi)
    return out
