# Tesla Model Y 2025 - interior, second pass (14-10-2026): the front cabin as the photographs of the 2025 car show it
# (Wikimedia Commons: the showroom interior from the open driver's door and the dash seen from the rear seat; reference
# only). It replaces build_interior's dashboard, screen and steering wheel and adds the ambient strip round the cabin:
#  - the dash is layered: a dark soft-touch brow over the full width, the ambient LED strip tucked under the brow's lip,
#    a light grey textile band under it, the hidden air outlet as one dark slit across the car, and the dark lower dash
#    rolling down to the knees; at each end the layers sweep back into the doors;
#  - the strip carries on along the top of each door card (blue in every photograph; the colour is the owner's choice);
#  - the 15.4" screen stands landscape on a short arm from the brow, a thin black bezel round the glass;
#  - the steering wheel: a round rim, a rounded-square hub carrying TESLA, two gloss-black spokes with the scroll wheels
#    and a silver V spoke below.
# Every dimension is ≈, read off the photographs against the screen's published 15.4" diagonal and the car's track.

def _dash_section(t):
    """The dash's section at spanwise position t in [0, 1] (0 at the centre, 1 at the door), as (x, z) points from the
    windscreen's foot to the knee, and the material of each band."""
    sweep = 0.10 * t ** 4               # the ends sweep back towards the doors
    drop = 0.020 * t ** 3
    pts = [
        (0.24, 1.002), (0.40, 1.026), (0.58, 1.038), (0.72, 1.040), (0.800, 1.036),      # brow top (soft)
        (0.835, 1.028), (0.852, 1.012), (0.856, 0.996),                                   # brow lip, rounded
        (0.850, 0.988), (0.842, 0.986),                                                   # under the lip: LED groove
        (0.846, 0.978), (0.860, 0.972), (0.868, 0.950), (0.870, 0.928), (0.866, 0.918),  # textile band
        (0.850, 0.914), (0.846, 0.904), (0.862, 0.900),                                   # hidden outlet slit
        (0.872, 0.880), (0.866, 0.840), (0.840, 0.790), (0.790, 0.720), (0.720, 0.640),  # lower dash
        (0.640, 0.560), (0.560, 0.480),
    ]
    mats = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
    return [(x + sweep, z - drop) for x, z in pts], mats


def build_dash2():
    for nm in ("Int_Dashboard",):
        remove_obj(nm)
    ys = np.linspace(-0.835, 0.835, 121)
    rows = []
    for y in ys:
        P, mats = _dash_section(abs(y) / 0.835)
        rows.append([(x, y, z) for x, z in P])
    V = np.array(rows).transpose(1, 0, 2)              # (section points, span)
    mb = MeshB()
    _, mats = _dash_section(0.0)
    for k, mt in enumerate(mats):
        mb.grid(V[k:k + 2], mat=mt)
    # The LED strip: a thin emissive tube in the groove under the lip, the full width.
    led = V[8] + np.array([0.004, 0.0, 0.003])
    mb.grid(tube(led, 0.0014, 6), closed_u=True, mat=3)
    # The glovebox's shut line and the knee bolster's seam, as narrow dark grooves on the lower dash (≈).
    for yc, w in ((0.42, 0.46),):
        rbox(mb, (0.828, yc, 0.775), (0.006, w, 0.004), rotY(-40), 0.001, 1, 1)
        rbox(mb, (0.792, yc, 0.715), (0.006, w, 0.004), rotY(-48), 0.001, 1, 1)
    o = mb.build("Int_Dashboard", "Interior", [SOFT, HARD, "TY_Int_Fabric_Grey", "TY_Emit_Ambient"], weld=1e-5)
    o.data.set_sharp_from_angle(angle=math.radians(55))
    return o


def build_door_ambient():
    """The ambient strip along the top of each door card, the same light as the dash's (≈ height and run)."""
    remove_obj("Int_Ambient_Doors")
    mb = MeshB()
    for x0, x1, z0, z1 in ((0.50, 1.70, 1.000, 1.022), (1.78, 2.73, 1.040, 1.075)):
        for s in (-1, 1):
            xs = np.linspace(x0, x1, 40)
            y = s * (0.742 - 0.012 * np.sin(np.linspace(0, math.pi, 40)))
            P = np.stack([xs, y, np.linspace(z0, z1, 40)], 1)
            mb.grid(tube(P, 0.0014, 6), closed_u=True, mat=0)
    mb.build("Int_Ambient_Doors", "Interior", ["TY_Emit_Ambient"], weld=1e-5)


def build_screen2():
    for nm in ("Int_Screen_Body", "Int_Screen_Display"):
        remove_obj(nm)
    tilt = rotY(-12)
    cS = np.array([0.905, 0.0, 1.150])                  # the glass's centre: it stands well above the brow
    mb = MeshB()
    rbox(mb, cS, (0.012, 0.364, 0.226), tilt, 0.008, 4, 0)                                 # body with a thin bezel
    rbox(mb, cS + tilt @ np.array([-0.030, 0, -0.105]), (0.050, 0.085, 0.09), tilt, 0.015, 3, 1)   # arm
    rbox(mb, (0.875, 0.0, 1.045), (0.07, 0.10, 0.03), None, 0.012, 3, 1)                   # its foot on the brow
    ibuild(mb, "Int_Screen_Body", ["TY_Black_Gloss", HARD])
    hw, hh = 0.1700, 0.1060                             # 15.4" diagonal: 0.340 × 0.212 m of glass
    corners = [cS + tilt @ np.array([0.0062, sy_ * hw, sz_ * hh]) for sy_, sz_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    uv_quad("Int_Screen_Display", corners, bpy.data.materials.get("TY_Int_Screen_UI") or make_ui_image())


def build_wheel2():
    remove_obj("Int_SteeringWheel")
    a_ = np.array([math.cos(math.radians(22)), 0, math.sin(math.radians(22))])   # the column's axis, towards the driver
    e1 = np.array([0, 1.0, 0]); e2 = np.cross(a_, e1)
    Rw = np.stack([a_, e1, e2], 1)
    Cw = np.array([1.065, DRV_Y, 0.990])
    mb = MeshB()
    th = np.linspace(0, 2 * math.pi, 96, endpoint=False)
    ph = np.linspace(0, 2 * math.pi, 20, endpoint=False)
    Rr = 0.180
    # Rim: a rounded section, a little deeper than wide, thicker at quarter-to-three where the hands go.
    rt = 0.0160 + 0.0018 * np.cos(2 * th) ** 2
    ring = (Cw[None, None] + (e1[None, None] * np.cos(th)[:, None, None] + e2[None, None] * np.sin(th)[:, None, None])
            * (Rr + (rt[:, None] * np.cos(ph)[None, :]))[:, :, None]
            + a_[None, None] * (rt[:, None] * 1.25 * np.sin(ph)[None, :])[:, :, None])
    mb.grid(ring, closed_u=True, closed_v=True, mat=0)
    # Hub: the airbag cover, a rounded square, and its TESLA.
    rbox(mb, Cw - a_ * 0.028, (0.050, 0.150, 0.132), Rw, 0.038, 5, 0)
    tv_, tf_ = text_mesh("TESLA", 0.0105, 0.0004)
    xc = (tv_[:, 0].min() + tv_[:, 0].max()) / 2
    P = Cw[None] - a_[None] * 0.0025 + a_[None] * (0.0004 + tv_[:, 2:3]) + e1[None] * (tv_[:, 0:1] - xc) + e2[None] * (tv_[:, 1:2] + 0.018)
    mb.raw(P, tf_, 2)
    # Horizontal spokes: gloss-black pads framed in a thin bright trim, a scroll wheel and a button each (the "smile").
    for s in (-1, 1):
        c = Cw + e1 * s * 0.112 - a_ * 0.020 - e2 * 0.006
        rbox(mb, c, (0.026, 0.092, 0.050), Rw, 0.014, 4, 1)
        rbox(mb, c + a_ * 0.0135, (0.002, 0.080, 0.040), Rw, 0.010, 3, 3)
        cyl(mb, c + e1 * s * -0.018 + a_ * 0.010, c + e1 * s * -0.018 + a_ * 0.020, 0.0105, 20, 1)
        cyl(mb, c + e1 * s * 0.016 + a_ * 0.010 + e2 * 0.006, c + e1 * s * 0.016 + a_ * 0.016 + e2 * 0.006, 0.0055, 14, 1)
        # the bright trim's lower sweep that makes the smile
        P = np.array([Cw + e1 * s * (0.040 + 0.05 * k) - e2 * (0.040 - 0.010 * k * k) - a_ * 0.004 for k in np.linspace(0, 1, 10)])
        mb.grid(tube(P, 0.0030, 6), closed_u=True, mat=2)
    # The lower spoke: a silver V from the hub to the rim's bottom.
    for s in (-1, 1):
        P = np.array([Cw - e2 * 0.060 + e1 * s * 0.020 - a_ * 0.020, Cw - e2 * 0.120 + e1 * s * 0.030 - a_ * 0.016, Cw - e2 * 0.168 + e1 * s * 0.024 - a_ * 0.010])
        mb.grid(tube(polyline(P, 12), 0.0085, 10, 0.55, up=a_), closed_u=True, mat=2)
    # Column shroud and the right-hand stalk-free column (the 2025 car has stalks again: one on the left, ≈).
    cyl(mb, Cw - a_ * 0.050, Cw - a_ * 0.26, 0.044, 24, 1, r1=0.052)
    cyl(mb, Cw - a_ * 0.11 - e1 * 0.045 + e2 * 0.010, Cw - a_ * 0.10 - e1 * 0.170 + e2 * 0.026, 0.008, 10, 1, r1=0.011)
    o = ibuild(mb, "Int_SteeringWheel", [LEA, "TY_Black_Gloss", ALU, CHROME], sharp=45)
    return o


def refine_interior(BODY):
    build_dash2()
    build_door_ambient()
    build_screen2()
    build_wheel2()
