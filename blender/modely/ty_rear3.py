# Tesla Model Y 2025 - v3 rear (15-10-2026), from Commons photographs of the Juniper (Ultra Red in a showroom, rear
# three-quarter; Stealth Grey and Pearl White parked):
#  - the light bar's LED is a thin red line inside the smoked lens (≈8 mm), not the broad glowing tube it was;
#  - the DUAL MOTOR badge low on the right of the tailgate, as on the photographed cars (all-wheel drive); its letter
#    height (≈14 mm) and place are read off the photographs (≈).


def build_rear3(BODY):
    for nm in ("Taillight_Bar_LED", "Badge_DUAL_MOTOR"):
        remove_obj(nm)
    v_lb, v_lt, xtg = BODY['v_lb'], BODY['v_lt'], BODY['xtg']

    def cap_line(C, xi0, xi1, v, off, n=80):
        xi = np.linspace(xi0, xi1, n)
        P, N = [], []
        for x in xi:
            p, tu, tv, nn = frame_at(C, x, v)
            if nn[0] < 0:
                nn = -nn
            P.append(p); N.append(nn)
        P, N = np.array(P), np.array(N)
        return P + N * off, N
    vv = v_lb + 0.34 * (v_lt - v_lb)
    P, Nn = cap_line(CR, 0.0, float(xtg(vv)) - 0.012, vv, -0.0135)
    mb = MeshB(); mb.grid(tube(P, 0.0060, 10, 0.45, up=Nn), closed_u=True)
    finish(mb.build("Taillight_Bar_LED", "Lights", EMIT_R, weld=1e-5), gap=0, thick=0, bevel=0, mirror=True, sharp=0)
    m = bpy.data.materials.get(EMIT_R)
    if m:
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            b.inputs['Emission Strength'].default_value = 9.0

    # DUAL MOTOR: sans capitals, 14 mm, centred 0.44 m right of the middle and 0.86 m up, on the tailgate's face
    tv_, tf_ = text_mesh("DUAL MOTOR", 0.0185, 0.0008)
    xc = (tv_[:, 0].min() + tv_[:, 0].max()) / 2
    yc = (tv_[:, 1].min() + tv_[:, 1].max()) / 2
    yb, zb_ = 0.44, 0.86
    vz = CR.v_from_z
    xi = float(inv2d(CR, [[yb, zb_]], (1, 2), (0.0, 1.0), (0.0, 1.0))[0, 0])
    P, Tu, Tv, Nn = frame_at(CR, xi, float(vz(zb_)))
    if Nn[0] < 0:
        Nn = -Nn
    ey = np.array([0, 0, 1.0]) - Nn * Nn[2]; ey /= np.linalg.norm(ey)
    ex = np.cross(ey, Nn)
    if ex[1] < 0:
        ex = -ex
    Pt = P[None, :] + ex[None, :] * (tv_[:, 0:1] - xc) + ey[None, :] * (tv_[:, 1:2] - yc) + Nn[None, :] * (0.0004 + tv_[:, 2:3])
    mb = MeshB(); mb.raw(Pt, tf_)
    mb.build("Badge_DUAL_MOTOR", "Details", CHROME, weld=0)
