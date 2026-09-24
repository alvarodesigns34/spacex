/**
 * Coastal campus around the exhibits. It is not a survey of Starbase and it must
 * not be read as one. Four kinds of geometry live here:
 *
 *  - observed infrastructure: none. SpaceX publishes no plan of the ground between
 *    the museum row and Pad 2, and none of these meshes claim to be that plan.
 *  - reconstruction from references: none in this file. The Pad 2 tower, mount,
 *    trench and tank farm are built in pad.js from cited and photogrammetric figures.
 *  - plausible environmental context: the salt-flat colour, low dunes and scrub,
 *    which match the coastal plain at Boca Chica in kind (flat, pale, sparse) and
 *    not in surveyed position.
 *  - non-structural dressing: the gravel terrace, the visitor road and its centre
 *    line, the drainage swale, and the three service trucks. They give scale.
 *    They are not roads, drains or vehicles that exist at those coordinates.
 *
 * Coordinates follow the exhibit row in main.js (z = 0, x = −153…163) and leave
 * Pad 2, at world (0, −185), on its own deck.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, mergeAll, mat4, boxUV } from '../geometry/utils.js';
import { noise2 } from '../materials/textures.js';

function quad(x0, z0, x1, z1, y) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

/** One material for the whole apron. Colour is per vertex so the terrace, road,
 *  dashes and swale are a single draw instead of four. */
function painted(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * Parked service truck, axis along Z, wheels rolled about X. Museum furniture:
 * not a specific vehicle, and not flight hardware.
 */
function truckParts(x, z, yaw) {
  const body = [];
  const wheels = [];
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const wheelQ = yawQ.clone().multiply(rollQ);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const place = (list, geometry, lx, ly, lz, quat) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x + lx * c + lz * s, ly, z - lx * s + lz * c),
      quat,
      new THREE.Vector3(1, 1, 1),
    );
    list.push({ geometry, matrix: m });
  };
  place(body, new THREE.BoxGeometry(2.05, 0.7, 4.7), 0, 0.64, 0, yawQ);
  place(body, new THREE.BoxGeometry(1.85, 0.62, 1.55), 0, 1.22, -1.15, yawQ);
  place(body, new THREE.BoxGeometry(1.95, 0.22, 1.3), 0, 1.02, 1.25, yawQ);
  for (const [wx, wz] of [[1.02, 1.5], [-1.02, 1.5], [1.02, -1.5], [-1.02, -1.5]]) {
    place(wheels, new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), wx, 0.34, wz, wheelQ);
  }
  return { body, wheels };
}

/**
 * One strip of road surface: a grid across and along it with a crown (2 % cross-fall is the
 * AASHTO range for a two-lane paved road; this is ~1.5 %), a bevelled 5 cm edge where the mat
 * meets the shoulder, and the wheel paths of each lane darkened in vertex colour, where tyres
 * polish the binder and drip oil. Metric UVs: u along the road, v across it.
 *
 * @param {object} o
 * @param {'x'|'z'} o.axis  direction of travel
 * @param {number} o.a0 @param {number} o.a1  extent along the axis
 * @param {number} o.c0  where the cross-section starts on the other axis
 * @param {number} o.width
 * @param {number} [o.crown]  crown height at the centre line above the edges
 * @param {boolean} [o.wear]  darken the wheel paths
 * @param {number[]} [o.fade] ends ('a0'/'a1' as 0/1) where the surface eases down flat to
 *                           tuck under the road it joins
 */
function roadStrip({ axis, a0, a1, c0, width: W, crown = 0.055, wear = true, fade = [] }) {
  const TOP = 0.05, LOW = 0.045;
  const across = [0, 0.1];
  for (let v = 0.5; v < W - 0.1; v += 0.4) across.push(v);
  across.push(W - 0.1, W);
  const along = [a0, a1];
  if (fade.length) {
    for (const d of [0.3, 1, 2, 3, 4, 6]) { if (fade.includes(0)) along.push(a0 + d); if (fade.includes(1)) along.push(a1 - d); }
  }
  along.sort((p, q) => p - q);
  const h = (v, a) => {
    const edge = Math.min(v, W - v);
    let y = edge < 0.1 ? 0.008 + (TOP - 0.008) * (edge / 0.1) : TOP + crown * (1 - Math.abs(v - W / 2) / (W / 2));
    let t = 0;
    if (fade.includes(0)) t = Math.max(t, 1 - THREE.MathUtils.smoothstep(a - a0, 0.3, 6));
    if (fade.includes(1)) t = Math.max(t, 1 - THREE.MathUtils.smoothstep(a1 - a, 0.3, 6));
    if (edge >= 0.1) y = y + (LOW - y) * t;
    return y;
  };
  const lanes = W > 6 ? [W * 0.125, W * 0.375, W * 0.625, W * 0.875] : [];
  const tone = (v) => {
    if (!wear) return 1;
    let k = 1.02;
    for (const p of lanes) k -= 0.11 * Math.exp(-(((v - p) / 0.32) ** 2));
    return k;
  };
  const pos = [], uv = [], col = [], idx = [];
  for (const a of along) for (const v of across) {
    const c = c0 + v, y = h(v, a);
    if (axis === 'x') pos.push(a, y, c); else pos.push(c, y, a);
    uv.push(a, v);
    const k = tone(v); col.push(k, k * 0.995, k * 0.985);
  }
  const n = across.length;
  for (let i = 0; i < along.length - 1; i++) for (let j = 0; j < n - 1; j++) {
    const p = i * n + j, q = p + n;
    // Wind so the face points up whichever axis the road runs along.
    if (axis === 'x') idx.push(p, p + 1, q, q, p + 1, q + 1); else idx.push(p, q, p + 1, q, q + 1, p + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, h };
}

/**
 * The visitor road and the service road to Pad 2, as a rural two-lane road in Texas would be
 * built and marked (FHWA MUTCD, 2009 ed., Part 3): white edge lines 15 cm wide; a broken yellow
 * centre line of 3.05 m (10 ft) dashes on a 12.19 m (40 ft) cycle; a white stop line 45 cm wide
 * across the approach lane, 1.2 m (4 ft) back from the through road, with a 75 cm (30 in)
 * R1-1 STOP sign on the right, its lower edge 1.5 m (5 ft) above the road (§2B.05, §2A.18).
 * Flexible delineators line the shoulders. Positions are dressing, not a survey.
 */
function buildRoads(g, M) {
  const W = 7.2;
  const main = roadStrip({ axis: 'x', a0: -186, a1: 196, c0: 24, width: W });
  const access = roadStrip({ axis: 'z', a0: -109.3, a1: 24.3, c0: 45.9, width: W, fade: [0, 1] });
  const turn = roadStrip({ axis: 'x', a0: 36, a1: 63, c0: -121, width: 12, crown: 0, wear: false });
  g.add(mesh(mergeGeometries([main.geometry, access.geometry, turn.geometry], false), M.asphalt, {
    name: 'campus-road', castShadow: false,
  }));

  // Markings, draped on the crown 4 mm proud of it.
  const WHITE = [0.93, 0.93, 0.9], YELLOW = [0.96, 0.74, 0.16];
  const pos = [], uv = [], col = [], idx = [];
  const stripe = (axis, a0, a1, c0, v0, v1, h, rgb) => {
    const base = pos.length / 3;
    for (const a of [a0, a1]) for (const v of [v0, v1]) {
      const y = h(v, a) + 0.004;
      if (axis === 'x') pos.push(a, y, c0 + v); else pos.push(c0 + v, y, a);
      uv.push(a, v); col.push(...rgb);
    }
    if (axis === 'x') idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    else idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
  };
  // Main road: edge lines (the north one breaks for the junction) and the centre line.
  stripe('x', -186, 196, 24, W - 0.45, W - 0.30, main.h, WHITE);
  stripe('x', -186, 43.5, 24, 0.30, 0.45, main.h, WHITE);
  stripe('x', 55.5, 196, 24, 0.30, 0.45, main.h, WHITE);
  for (let x = -186; x + 3.05 < 196; x += 12.19) stripe('x', x, x + 3.05, 24, W / 2 - 0.075, W / 2 + 0.075, main.h, YELLOW);
  // Access road: edge lines, centre line, and the stop line across the southbound (+z) lane,
  // whose right-hand side is −x.
  stripe('z', -108.5, 22.5, 45.9, 0.30, 0.45, access.h, WHITE);
  stripe('z', -108.5, 22.5, 45.9, W - 0.45, W - 0.30, access.h, WHITE);
  for (let z = -106; z + 3.05 < 20; z += 12.19) stripe('z', z, z + 3.05, 45.9, W / 2 - 0.075, W / 2 + 0.075, access.h, YELLOW);
  stripe('z', 24 - 1.2 - 0.45, 24 - 1.2, 45.9, 0.45, W / 2 - 0.1, access.h, WHITE);
  const paint = new THREE.BufferGeometry();
  paint.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  paint.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  paint.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  paint.setIndex(idx);
  paint.computeVertexNormals();
  g.add(mesh(paint, M.roadPaint, { name: 'campus-road-markings', castShadow: false }));

  // STOP sign: 0.76 m octagon on a 2 m galvanised post, facing traffic coming down the access
  // road (toward −z), set 0.9 m off the edge on the right.
  const sign = new THREE.Group(); sign.name = 'campus-stop-sign';
  sign.position.set(45.9 - 0.9, 0, 24 - 1.9);
  sign.add(mesh(new THREE.BoxGeometry(0.05, 2.25, 0.05), M.aluminum ?? M.mount, { position: [0, 1.125, 0.03] }));
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const oct = (r, fill) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };
  oct(128, '#f4f4f2'); oct(119, '#b3121b');
  ctx.fillStyle = '#f4f4f2'; ctx.font = 'bold 76px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('STOP', 128, 132);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.CircleGeometry(0.38 / Math.cos(Math.PI / 8), 8, Math.PI / 8);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0, name: 'stop-sign-face' });
  sign.add(mesh(face, faceMat, { position: [0, 1.5 + 0.38, 0.06], rotation: [0, Math.PI, 0], castShadow: true }));
  const back = face.clone();
  sign.add(mesh(back, M.aluminum ?? M.mount, { position: [0, 1.5 + 0.38, 0.065] }));
  g.add(sign);

  // Delineators: white flexible posts with a reflector, every 40 m along both shoulders.
  const spots = [];
  for (let x = -180; x <= 190; x += 40) { spots.push([x, 32.0]); if (x < 42 || x > 57) spots.push([x, 23.2]); }
  for (let z = -100; z <= 0; z += 40) spots.push([45.3, z], [53.7, z]);
  const post = mergeAll([
    { geometry: new THREE.BoxGeometry(0.09, 1.1, 0.04), matrix: mat4([0, 0.55, 0]) },
  ]);
  const posts = new THREE.InstancedMesh(post, M.visitor ?? M.aluminum ?? M.mount, spots.length);
  const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.18, 0.05), M.safetyYellow ?? M.mount, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    posts.setMatrixAt(i, m.makeTranslation(x, 0, z));
    refl.setMatrixAt(i, m.makeTranslation(x, 0.98, z));
  });
  posts.name = 'campus-delineators'; refl.name = 'campus-delineator-reflectors';
  for (const o of [posts, refl]) { o.castShadow = true; o.receiveShadow = true; g.add(o); }
}

/**
 * Wind-tidal flats. The plain round Starbase is not dry scrub to the horizon: between the
 * dunes it is salt flat that holds sheets of shallow standing water after rain and wind tides,
 * mirror-flat and sky-coloured, ringed by dark wet mud fading through drier silt into the flat. These are a few
 * such pools, placed clear of the exhibits, the roads and the pad. Positions and outlines are
 * plausible, not surveyed.
 */
function buildFlats(g, M, avoid) {
  const spec = [
    // x, z, mean radius (m), seed
    [-340, -170, 65, 1], [260, -240, 55, 2], [-170, 200, 50, 3], [310, 210, 75, 4],
    [-430, 60, 60, 5], [110, 270, 42, 6], [410, -70, 50, 7], [-250, -340, 60, 8],
  ].filter(([x, z, r]) => avoid(x, z, r));
  const water = [], rims = [];
  const N = 64;
  for (const [cx, cz, R, seed] of spec) {
    const rad = (a) => R * (0.72 + 0.55 * noise2(Math.cos(a) * 1.3 + seed * 7.1, Math.sin(a) * 1.3 + seed * 3.3)
      + 0.12 * noise2(Math.cos(a) * 4 + seed, Math.sin(a) * 4 - seed));
    const ring = Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2; return [a, rad(a)]; });
    // Water: a fan from the centre, 6 cm above the flat ground.
    {
      const pos = [cx, 0.06, cz], uv = [cx, -cz], idx = [];
      ring.forEach(([a, r]) => { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pos.push(x, 0.06, z); uv.push(x, -z); });
      for (let i = 0; i < N; i++) idx.push(0, 1 + ((i + 1) % N), 1 + i);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      water.push(geo);
    }
    // Rim: wet mud at the water's edge, fading out through drier silt over ~30 % of R.
    {
      const pos = [], col = [], idx = [];
      const bands = [[0.98, [0.2, 0.18, 0.15], 1], [1.06, [0.3, 0.27, 0.22], 0.8], [1.16, [0.56, 0.53, 0.46], 0.3], [1.3, [0.6, 0.57, 0.5], 0]];
      for (const [k, c, alpha] of bands) ring.forEach(([a, r]) => {
        pos.push(cx + Math.cos(a) * r * k, 0.035, cz + Math.sin(a) * r * k);
        col.push(c[0], c[1], c[2], alpha);
      });
      for (let b = 0; b < bands.length - 1; b++) for (let i = 0; i < N; i++) {
        const p = b * N + i, q = b * N + ((i + 1) % N);
        idx.push(p, q, p + N, q, q + N, p + N);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      geo.setIndex(idx); geo.computeVertexNormals();
      rims.push(geo);
    }
  }
  if (!water.length) return;
  const pondMat = M.water.clone();
  pondMat.name = 'tidal-flat-water';
  pondMat.color.setHex(0x3a4442);
  pondMat.roughness = 0.08;
  pondMat.envMapIntensity = 0.75;
  pondMat.normalScale.set(0.12, 0.12);
  pondMat.polygonOffset = true; pondMat.polygonOffsetFactor = -4; pondMat.polygonOffsetUnits = -4;
  const rimMat = new THREE.MeshStandardMaterial({
    name: 'tidal-flat-rim', vertexColors: true, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, envMapIntensity: 0.25,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  g.add(mesh(mergeGeometries(rims, false), rimMat, { name: 'tidal-flat-rims', castShadow: false }));
  g.add(mesh(mergeGeometries(water, false), pondMat, { name: 'tidal-flat-water', castShadow: false }));
}

/**
 * @param {import('three').Scene} scene
 * @param {Record<string, import('three').Material>} M
 */
export function dressCampus(scene, M) {
  const g = new THREE.Group();
  g.name = 'campus';
  g.userData.provenance = 'environmental-reconstruction';

  M.campusGround.polygonOffset = true;
  M.campusGround.polygonOffsetFactor = -2;
  M.campusGround.polygonOffsetUnits = -2;

  // Tints over the concrete map (whose mean is a mid grey): slab, asphalt, swale, paint.
  // The same rectangles, as a plan, for the HUD's site map.
  g.userData.plan = [
    { kind: 'apron', x0: -178, z0: -18, x1: 188, z1: 20 },
    { kind: 'road', x0: -186, z0: 24, x1: 196, z1: 31.2 },
    { kind: 'road', x0: 45.9, z0: -109, x1: 53.1, z1: 24 },
    { kind: 'road', x0: 36, z0: -121, x1: 63, z1: -109 },
  ];
  // Gravel shoulders either side of the asphalt. The access road's are left off where it
  // crosses the exhibit apron, which is paved to the road edge.
  const SHOULDER = 0xd4c8b0;
  const apron = [
    painted(quad(-178, -18, 188, 20, 0.012), 0xe2dccf),
    painted(quad(-186, 22.8, 196, 24, 0.016), SHOULDER),
    painted(quad(-186, 31.2, 196, 32.4, 0.016), SHOULDER),
    ...[[-109, -18], [20, 22.8]].flatMap(([z0, z1]) => [
      painted(quad(44.7, z0, 45.9, z1, 0.016), SHOULDER), painted(quad(53.1, z0, 54.3, z1, 0.016), SHOULDER)]),
  ];
  // Metric UVs in the ground plane, as every map in the project expects.
  for (const geo of apron) {
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = -p.getZ(i); }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  g.add(mesh(mergeGeometries(apron, false), M.campusGround, {
    name: 'campus-apron', castShadow: false,
  }));

  buildRoads(g, M);
  buildFlats(g, M, (x, z, r) => {
    const R = r * 1.4;
    if (Math.abs(z) < 75 + R && x > -230 - R && x < 240 + R) return false;       // exhibit row and road
    if (x > 25 - R && x < 75 + R && z > -135 - R && z < 40 + R) return false;       // access road
    if (Math.hypot(x, z + 185) < R + 165) return false;                              // Pad 2 and its berm
    return z > -900;                                                                 // clear of the beach
  });

  // Low dunes. They were flattened spheres standing on their bottom pole: the widest part of
  // each sat a third of a metre ABOVE the ground with a dark lip under it, in a flat khaki of
  // its own, so every dune read as a coin laid on the plain. A dune rises out of the ground
  // it is made of. These are raised-cosine mounds whose edge is tangent to the plain and sunk
  // a few centimetres into it, built in world space with metric UVs and drawn with the
  // terrain's own material — same grain, same landscape noise — so the only thing that marks
  // one is its shape in the light, plus a slight sandy lift on the crest carried in vertex
  // colour and fading to exactly the plain's value at the rim. Ten mounds, one draw.
  const duneSpec = [
    [-210, 70, 18, 1.3],
    [40, 95, 14, 0.9],
    [210, 48, 16, 1.5],
    [-90, 120, 20, 1.0],
    [130, -90, 15, 1.2],
    [-170, -80, 13, 0.8],
    [250, -40, 22, 0.7],
    [-240, 20, 17, 1.1],
    [80, 160, 19, 0.85],
    [-40, -140, 12, 1.4],
  ].filter(([x, z]) => Math.hypot(x, z + 185) >= 140);
  const RINGS = 9, SEGS = 28, SINK = 0.04;
  const duneParts = [];
  duneSpec.forEach(([cx, cz, radius, h], d) => {
    const n = 1 + RINGS * SEGS;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    const idx = [];
    // A slightly irregular rim, so ten mounds are not ten copies of one ellipse.
    const wob = (a) => 1 + 0.12 * Math.sin(a * 3 + d * 1.7) + 0.06 * Math.sin(a * 5 - d);
    const put = (k, x, z, t) => {
      // Raised cosine: flat on top, tangent to the plain at the rim, then sunk a little so
      // the rim cannot z-fight the ground it grows out of.
      const y = h * 0.62 * (0.5 + 0.5 * Math.cos(Math.PI * t)) - SINK;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = x; uv[k * 2 + 1] = -z;
      const lift = 1 + 0.07 * (1 - t) * (1 - t);
      col[k * 3] = lift; col[k * 3 + 1] = lift * 0.99; col[k * 3 + 2] = lift * 0.95;
    };
    put(0, cx, cz, 0);
    for (let j = 1; j <= RINGS; j++) {
      const t = j / RINGS;
      for (let i = 0; i < SEGS; i++) {
        const a = (i / SEGS) * Math.PI * 2;
        const w = wob(a);
        put(1 + (j - 1) * SEGS + i, cx + Math.cos(a) * radius * t * w, cz + Math.sin(a) * radius * 0.72 * t * w, t);
      }
    }
    for (let i = 0; i < SEGS; i++) idx.push(0, 1 + ((i + 1) % SEGS), 1 + i);
    for (let j = 1; j < RINGS; j++) {
      const a0 = 1 + (j - 1) * SEGS, b0 = 1 + j * SEGS;
      for (let i = 0; i < SEGS; i++) {
        const i1 = (i + 1) % SEGS;
        idx.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    // Normals while still indexed, so the mound shades smoothly; after de-indexing each
    // triangle would get its own normal and the dune would come out faceted.
    geo.computeVertexNormals();
    duneParts.push(geo.toNonIndexed());
  });
  if (duneParts.length) {
    const duneGeo = mergeGeometries(duneParts, false);
    g.add(mesh(duneGeo, M.terrain, { name: 'campus-berms', castShadow: false }));
  }

  // Salt-flat scrub: low, rounded clumps of coastal brush, instanced. They were three crossed
  // 0.4 × 0.7 m planes, which from any distance read as bright green posts standing on the
  // plain. A clump is a lumpy, flattened dome, olive-brown, wider than it is tall, sitting
  // down in the ground, and lit from the sky above rather than as a flat card.
  const scrubGeo = (() => {
    const geo = new THREE.IcosahedronGeometry(0.5, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.22 * Math.sin(x * 9.1 + z * 4.3) * Math.cos(y * 7.7 - x * 3.1) + 0.12 * Math.sin(z * 13.0 + y * 5.0);
      p.setXYZ(i, x * k, Math.max(-0.12, y * 0.62 * k), z * k);
    }
    geo.translate(0, 0.06, 0);
    geo.computeVertexNormals();
    return geo;
  })();
  const spots = [];
  const scrubCount = 140;
  let seed = 17;
  let guard = 0;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
  while (spots.length < scrubCount * 3 && guard < 4000) {
    guard++;
    const x = -240 + rnd() * 500;
    const z = -80 + rnd() * 220;
    const onRow = z > -22 && z < 36 && x > -190 && x < 200;
    const onPad = Math.hypot(x, z + 185) < 150;
    if (onRow || onPad) continue;
    spots.push(x, z, rnd());
  }
  const scrub = new THREE.InstancedMesh(scrubGeo, M.scrub, spots.length / 3);
  scrub.name = 'campus-scrub';
  scrub.castShadow = false;
  scrub.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < spots.length; i += 3) {
    const s = 0.6 + spots[i + 2] * 1.9;
    dummy.position.set(spots[i], 0, spots[i + 1]);
    dummy.scale.set(s * (0.8 + spots[i + 2] * 0.5), s * (0.55 + spots[i + 2] * 0.35), s);
    dummy.rotation.y = spots[i + 2] * 6;
    dummy.updateMatrix();
    scrub.setMatrixAt(i / 3, dummy.matrix);
  }
  scrub.instanceMatrix.needsUpdate = true;
  g.add(scrub);

  // Three service trucks on the road shoulder. They are scale furniture.
  const bodies = [];
  const wheels = [];
  for (const [x, z, yaw] of [[-168, 34.4, 0], [172, 34.8, Math.PI], [62, 36.8, Math.PI / 2]]) {
    const t = truckParts(x, z, yaw);
    bodies.push(...t.body);
    wheels.push(...t.wheels);
  }
  g.add(mesh(boxUV(mergeAll(bodies)), M.service, { name: 'campus-trucks', castShadow: true }));
  g.add(mesh(boxUV(mergeAll(wheels)), M.boot, { name: 'campus-truck-wheels', castShadow: true }));

  scene.add(g);
  return g;
}
