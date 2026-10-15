# Tesla Model Y 2025 - v3 finish for the web (15-10-2026): what Blender draws with procedural shaders does not travel in a
# glTF file, so the asset carries it as images:
#  - every mesh's modifiers applied (through the data API) and a first UV set in metres (a box projection: the detail
#    maps below tile on it at their real size);
#  - detail normal maps, made here as periodic noise so that they tile without a seam: the pebble grain of the leather,
#    the stipple of the moulded plastics, the rubber, the felt of the arch liners and headliner, the weave of the
#    textile, the carpet's pile, the brushed aluminium, the speaker grilles' perforations and the paint's metallic flake.
#    Their scales are ≈ (what such surfaces measure: a 2 mm grain, a 0.4 mm flake), not measured on this car;
#  - ambient occlusion baked by Cycles into one atlas on a second UV set ('ao'), as for the H2R: the contact shadows in
#    the panel gaps, the wheel wells and the cabin that a real-time renderer cannot find on its own. The glass, the
#    lenses and the lamps are left out of the bake, so the cabin and the lamps' insides are lit through them.
# Run from build.py (headless): the unwrapping and the bake use operators.
import os

DETAIL = {   # material: (map, tile size in metres, strength)
    "TY_Paint_UltraRed": ("flake", 0.060, 0.18),
    "TY_Rubber_Tire": ("rubber", 0.080, 0.45),
    "TY_Plastic_Textured": ("stipple", 0.050, 0.70),
    "TY_Plastic_Satin": ("stipple", 0.060, 0.30),
    "TY_Liner_Black": ("felt", 0.100, 0.90),
    "TY_Int_Leather_White": ("leather", 0.090, 0.55),
    "TY_Int_Leather_Black": ("leather", 0.090, 0.55),
    "TY_Int_Leather_White_Perf": ("perf", 0.030, 0.80),
    "TY_Int_Fabric_Grey": ("weave", 0.030, 0.60),
    "TY_Int_Carpet": ("carpet", 0.050, 1.00),
    "TY_Int_Headliner": ("felt", 0.080, 0.45),
    "TY_Int_Plastic_Soft": ("stipple", 0.060, 0.35),
    "TY_Int_Plastic_Hard": ("stipple", 0.050, 0.50),
    "TY_Int_Aluminium": ("brushed", 0.200, 0.20),
    "TY_Int_Speaker_Mesh": ("perf", 0.025, 1.00),
}
AO_SIZE = 4096
AO_SKIP = ("TY_Glass_", "TY_Lens_", "TY_Emit_", "TY_Int_Screen_UI")


def _bandpass(n, f0, bw, seed, low=0.0):
    rng = np.random.default_rng(seed)
    F = np.fft.fft2(rng.standard_normal((n, n)))
    f = np.fft.fftfreq(n) * n
    r = np.hypot(*np.meshgrid(f, f))
    filt = np.exp(-((r - f0) / bw) ** 2) + (low * np.exp(-(r / (f0 * 0.25)) ** 2) if low else 0)
    h = np.real(np.fft.ifft2(F * filt))
    return h / (np.abs(h).max() + 1e-9)


def _height(kind, n):
    """A periodic height field in [-1, 1] (n x n)."""
    y, x = np.mgrid[0:n, 0:n] / n
    if kind == "leather":
        return -np.abs(_bandpass(n, 34, 10, 1)) * 1.4 + 0.35 * _bandpass(n, 9, 4, 2)
    if kind == "stipple":
        return _bandpass(n, 70, 26, 3)
    if kind == "rubber":
        return 0.7 * _bandpass(n, 60, 30, 4) + 0.3 * _bandpass(n, 12, 6, 5)
    if kind == "felt":
        return _bandpass(n, 110, 70, 6) + 0.4 * _bandpass(n, 20, 10, 7)
    if kind == "carpet":
        return -np.abs(_bandpass(n, 90, 40, 8)) + 0.3 * _bandpass(n, 14, 6, 9)
    if kind == "weave":
        k = 24
        a, b = np.sin(2 * np.pi * k * x), np.sin(2 * np.pi * k * y)
        over = np.sign(np.sin(np.pi * k * x) * np.sin(np.pi * k * y))
        return 0.5 * (np.abs(a) * (over > 0) + np.abs(b) * (over <= 0)) + 0.15 * _bandpass(n, 80, 40, 10)
    if kind == "brushed":
        rng = np.random.default_rng(11)
        lines = np.convolve(rng.standard_normal(n * 3), np.ones(3) / 3, 'same')[n:2 * n]
        h = np.tile(lines[:, None], (1, n)) + 0.2 * _bandpass(n, 6, 3, 12)
        return h / np.abs(h).max()
    if kind == "perf":
        k = 10
        d = np.hypot((x * k) % 1 - 0.5, (y * k) % 1 - 0.5)
        return -np.clip((0.30 - d) / 0.05, 0, 1)
    raise KeyError(kind)


def _flake_normals(n, cells=150, tilt=0.16, seed=13):
    """Metallic flake: a jittered grid of tiny tilted mirrors (each pixel takes its nearest flake's tilt)."""
    rng = np.random.default_rng(seed)
    jit = rng.random((cells, cells, 2))
    tx = rng.normal(0, tilt, (cells, cells)); ty = rng.normal(0, tilt, (cells, cells))
    y, x = np.mgrid[0:n, 0:n] * (cells / n)
    ci, cj = np.floor(y).astype(int), np.floor(x).astype(int)
    best = np.full((n, n), 9.0); bi = ci.copy(); bj = cj.copy()
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ii, jj = (ci + di) % cells, (cj + dj) % cells
            py = ci + di + jit[ii, jj, 0]; px = cj + dj + jit[ii, jj, 1]
            d = (py - y) ** 2 + (px - x) ** 2
            m = d < best
            best[m], bi[m], bj[m] = d[m], ii[m], jj[m]
    N = np.stack([tx[bi, bj], ty[bi, bj], np.ones((n, n))], -1)
    return N / np.linalg.norm(N, axis=-1, keepdims=True)


def detail_image(kind, n=1024, cache=None):
    name = "TY_Detail_" + kind
    img = bpy.data.images.get(name)
    if img:
        return img
    if kind == "flake":
        N = _flake_normals(n)
    else:
        h = _height(kind, n)
        gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
        gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
        s = n / 64.0                                    # a full-range height step over 1/64 of the tile tilts ≈45°
        N = np.stack([-gx * s, -gy * s, np.ones_like(h)], -1)
        N /= np.linalg.norm(N, axis=-1, keepdims=True)
    rgba = np.concatenate([N * 0.5 + 0.5, np.ones((n, n, 1))], -1).astype(np.float32)
    img = bpy.data.images.new(name, n, n, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    if cache:
        os.makedirs(cache, exist_ok=True)
        path = os.path.join(cache, name + ".jpg")
        img.filepath_raw = path; img.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 94
        img.save()
        img.source = 'FILE'; img.reload()
    return img


def flatten_roughness():
    """A roughness driven by a noise (a Map Range) does not export: it becomes the middle of its range."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for b in [x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED']:
            # the exporter writes the sheen's colour without its weight: the weight goes into the colour (same in Cycles)
            w = b.inputs['Sheen Weight'].default_value
            if 0 < w < 1:
                t = b.inputs['Sheen Tint'].default_value
                b.inputs['Sheen Tint'].default_value = (t[0] * w, t[1] * w, t[2] * w, 1)
                b.inputs['Sheen Weight'].default_value = 1.0
            s = b.inputs['Roughness']
            if s.is_linked:
                src = s.links[0].from_node
                if src.type == 'MAP_RANGE':
                    s.default_value = 0.5 * (src.inputs['To Min'].default_value + src.inputs['To Max'].default_value)
                m.node_tree.links.remove(s.links[0])


def wire_detail(cache=None):
    """Each material in DETAIL loses its procedural bump and gets its tiled normal map on UV set 0."""
    flatten_roughness()
    for mname, (kind, tile, strength) in DETAIL.items():
        m = bpy.data.materials.get(mname)
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        b = next((x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED'), None)
        if b is None:
            continue
        for x in [x for x in nt.nodes if x.type in ('BUMP', 'TEX_NOISE', 'TEX_VORONOI', 'TEX_WAVE')]:
            nt.nodes.remove(x)
        img = detail_image(kind, cache=cache)
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1)
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Linear'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.uv_map = 'UVMap'; nm.inputs['Strength'].default_value = strength
        nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], tx.inputs['Vector'])
        nt.links.new(tx.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])


def export_meshes():
    root = get_root()
    return [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']


def apply_modifiers(objs):
    """Each object's evaluated mesh becomes its own (data API: no operator, no context)."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if not o.modifiers:
            continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        old = o.data
        o.modifiers.clear()
        o.data = me
        me.name = old.name
        if old.users == 0:
            bpy.data.meshes.remove(old)


def metric_uv(objs):
    """UV set 0 in metres by box projection (per face, along its dominant axis); meshes that have UVs keep them."""
    done = set()
    for o in objs:
        me = o.data
        if me.name in done or me.uv_layers:
            continue
        done.add(me.name)
        n = len(me.polygons)
        if n == 0:
            continue
        nrm = np.empty(n * 3); me.polygons.foreach_get('normal', nrm); nrm = nrm.reshape(n, 3)
        ls = np.empty(n, int); me.polygons.foreach_get('loop_start', ls)
        lt = np.empty(n, int); me.polygons.foreach_get('loop_total', lt)
        lv = np.empty(len(me.loops), int); me.loops.foreach_get('vertex_index', lv)
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        face = np.repeat(np.arange(n), lt)
        ax = np.abs(nrm).argmax(1)[face]
        sg = np.sign(nrm[face, ax]); sg[sg == 0] = 1
        P = co[lv]
        u = np.where(ax == 0, P[:, 1] * sg, np.where(ax == 1, -P[:, 0] * sg, P[:, 0]))
        v = np.where(ax == 2, P[:, 1] * sg, P[:, 2])
        layer = me.uv_layers.new(name='UVMap')
        layer.data.foreach_set('uv', np.stack([u, v], 1).ravel())


def _skip(o):
    return all(s.material is None or s.material.name.startswith(AO_SKIP) for s in o.material_slots)


def bake_ao(objs, cache, samples=64, size=AO_SIZE):
    """The ambient-occlusion atlas (see above), wired to every material as the glTF occlusion."""
    import bmesh as _bm  # noqa: F401  (operators below need an object mode context)
    hidden = [o for o in objs if _skip(o)]
    for o in hidden:
        o.hide_render = True
    uniq, seen = [], set()
    for o in objs:
        if o in hidden or o.data.name in seen or len(o.data.polygons) == 0:
            continue
        seen.add(o.data.name); uniq.append(o)
    # unwrap each mesh on its own, then give it a square of the atlas in proportion to its surface (as for the H2R)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    tiles = []
    for o in uniq:
        me = o.data
        if 'ao' not in me.uv_layers:
            me.uv_layers.new(name='ao')
        me.uv_layers.active = me.uv_layers['ao']
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.0, scale_to_bounds=False)
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(margin=0.003, rotate=True, shape_method='CONCAVE')
        bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
        area = sum(p.area for p in me.polygons)
        uvd = me.uv_layers['ao'].data
        cov = 0.0
        for p in me.polygons:
            pts = [uvd[i].uv for i in range(p.loop_start, p.loop_start + p.loop_total)]
            cov += 0.5 * abs(sum(pts[k].x * pts[k - 1].y - pts[k - 1].x * pts[k].y for k in range(len(pts))))
        tiles.append((o, (area / max(cov, 1e-6)) ** 0.5))
    pad = 3.0 / size

    def shelf(sizes):
        order = sorted(range(len(sizes)), key=lambda i: -sizes[i])
        out, x, y, sh = [None] * len(sizes), 0.0, 0.0, 0.0
        for i in order:
            s = sizes[i]
            if x + s > 1 - 6 / size:
                x, y, sh = 0.0, y + sh, 0.0
            if y + s > 1 - 6 / size:
                return None
            out[i] = (x, y); x += s; sh = max(sh, s)
        return out
    lo, hi = 0.0, 10.0
    for _ in range(40):
        k = (lo + hi) / 2
        if shelf([t * k + pad for _, t in tiles]) is None:
            hi = k
        else:
            lo = k
    corners = shelf([t * lo + pad for _, t in tiles])
    for (o, t), (x, y) in zip(tiles, corners):
        s = t * lo
        uvd = o.data.uv_layers['ao'].data
        co = np.empty(len(uvd) * 2); uvd.foreach_get('uv', co); co = co.reshape(-1, 2)
        uvd.foreach_set('uv', (np.array([x, y]) + pad / 2 + co * s).ravel())
        o.data.uv_layers.active = o.data.uv_layers[0]
    print(f'ao atlas: {len(tiles)} meshes, texel ≈{1 / (lo * size) * 1000:.1f} mm')
    image = bpy.data.images.new('TY_AO', size, size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    # wire: every material of the baked objects gets the image as its glTF occlusion (and as the bake target)
    group = bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        group.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        group.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    mats = {s.material for o in uniq for s in o.material_slots if s.material}
    for m in mats:
        nt = m.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.name = tex.label = 'ao-bake'; tex.image = image
        if not m.name.startswith(AO_SKIP):
            uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'ao'
            nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
            g = nt.nodes.new('ShaderNodeGroup'); g.node_tree = group
            nt.links.new(sep.outputs[0], g.inputs['Occlusion'])
        nt.nodes.active = tex
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.samples = samples; s.cycles.device = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'; prefs.refresh_devices()
        if any(d.type == 'OPTIX' for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == 'OPTIX'
            s.cycles.device = 'GPU'
    except (TypeError, KeyError):
        pass
    if s.world is None:
        s.world = bpy.data.worlds.new('bake-world')
    s.world.light_settings.distance = 0.35          # occlusion within 35 cm
    for o in uniq:
        o.select_set(True)
    bpy.context.view_layer.objects.active = uniq[0]
    bpy.ops.object.bake(type='AO', uv_layer='ao', margin=8, use_clear=True)
    for o in hidden:
        o.hide_render = False
    # the meshes that share a baked one's data point at the same atlas; the skipped ones get no 'ao' set at all
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, 'TY_AO.jpg')
    image.filepath_raw = path; image.file_format = 'JPEG'
    s.render.image_settings.quality = 92
    image.save()
    return path


def finish_for_web(cache, bake=True):
    objs = export_meshes()
    apply_modifiers(objs)
    metric_uv(objs)
    wire_detail(cache)
    if bake:
        return bake_ao(objs, cache)
