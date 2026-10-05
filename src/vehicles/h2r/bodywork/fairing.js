/** The fairing: the carbon cowl, the mirror-coat side panel, the nose, the wings, the screen. */
import * as THREE from 'three';
import { loft, mesh, mirrorZ, mergeAll, withCreaseNormals } from '../geometry.js';
import { meshTexture, twoSided } from '../materials.js';
import { shell, facets } from './surfaces.js';

/**
 * The fairing as Kawasaki builds it: the carbon upper cowl (a narrow nose rising under the screen,
 * its sides running back above the side panel to the frame), and the mirror-coat side panel, a
 * separate shell with a crease along it (the photographs), standing out 0.17 m at its front tip and
 * 0.31 m at its rear. Below the panel the fairing is open on the radiator.
 */
export function buildFairing3(M) {
  const g = new THREE.Group(); g.name = 'h2r-fairing';
  const cowl = buildCowl(M);
  g.add(cowl);
  const panel = shell([
    // [top edge, crease (the upper facet's fold), lower edge tucked in] — angular, as pressed.
    // (Its front tip ≈4 cm further back and ≈5 cm further out than first traced: the right-side
    // and head-on photographs, triangulated, put it behind the eye's outer end.)
    [210, [[386, 0.200], [388, 0.208], [390, 0.198]]],
    [232, [[376, 0.210], [397, 0.224], [410, 0.185]]],
    [260, [[366, 0.222], [404, 0.252], [446, 0.18]]],
    [310, [[360, 0.242], [410, 0.284], [488, 0.17]]],
    [360, [[364, 0.256], [414, 0.302], [512, 0.18]]],
    [410, [[380, 0.266], [418, 0.312], [505, 0.2]]],
    [460, [[403, 0.268], [422, 0.306], [483, 0.23]]],
    [498, [[417, 0.262], [427, 0.295], [455, 0.25]]],
  ], M.h2rChrome, 'h2r-side-panel', { steps: 5, creaseDeg: 12 });
  g.add(panel);
  g.add(buildNose(M));
  g.add(buildPinstripe(M, cowl));
  g.userData.panel = panel;
  g.add(buildWings(M));
  g.add(buildScreen(M));
  return g;
}

export function buildScreen(M) { return buildScreen0(M); }

/** The screen: a smoked bubble from the beak to its top, wrapping round to its lower side edges. */
function buildScreen0(M) {
  // A light smoke (the photographs: the dash and the bars read through it). Its outside is glossy;
  // its inside, the face the rider looks through, is drawn as plain tint with no reflection: a
  // double-sided glossy sheet mirrored the bright sky back at the rider and read milky white.
  M.h2rScreen ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-screen', color: 0x1b1f23, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.FrontSide, envMapIntensity: 0.8 });
  M.h2rScreenIn ??= new THREE.MeshBasicMaterial({ name: 'h2r-screen-inside', color: 0x0d1013, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.BackSide });
  const rows = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, c = lerp3(SCREEN_C0, SCREEN_C1, t), e = alongPolyline(SCREEN_EDGE, t);
    const sec = [];
    for (let k = 0; k <= 8; k++) {
      const a = k / 8, f = a ** 1.8;
      sec.push([c[0] + (e[0] - c[0]) * f, c[1] + (e[1] - c[1]) * f, e[2] * Math.sin(a * Math.PI / 2)]);
    }
    rows.push(sec);
  }
  let geo = loft(rows, { steps: 3 });
  geo = mergeAll([{ geometry: geo }, { geometry: mirrorZ(geo) }]);
  const out = mesh(geo, M.h2rScreen, { name: 'h2r-screen' });
  out.add(mesh(geo, M.h2rScreenIn, { name: 'h2r-screen-inside' }));
  out.castShadow = false;
  // The black mounting strips along its side edges, with their screws (the head-on photograph).
  const strip = [], screws = [];
  for (let i = 0; i <= 10; i++) {
    const t = 0.25 + 0.75 * i / 10, e = alongPolyline(SCREEN_EDGE, t), c = lerp3(SCREEN_C0, SCREEN_C1, t);
    const d = new THREE.Vector3(c[0] - e[0], c[1] - e[1], -e[2]).normalize();
    const lift = [0.0015, 0.003, 0.002];
    strip.push([e[0] + lift[0], e[1] + lift[1], e[2] + lift[2]], [e[0] + d.x * 0.016 + lift[0], e[1] + d.y * 0.016 + lift[1], e[2] + d.z * 0.016 + lift[2]]);
    if (i % 2 === 1) screws.push([e[0] + d.x * 0.008, e[1] + d.y * 0.008 + 0.005, e[2] + d.z * 0.008 + 0.003]);
  }
  const polys = []; for (let i = 0; i < 10; i++) polys.push([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1]);
  out.add(facets(strip, polys, twoSided(M, 'h2rBlack2', M.h2rBlack, 'h2r-black-2s'), 'h2r-screen-strip'));
  const sg = screws.map(([x, y, z]) => ({ geometry: new THREE.SphereGeometry(0.0035, 8, 6).translate(x, y, z) }));
  const sm = mergeAll([...sg, ...sg.map(({ geometry }) => ({ geometry: mirrorZ(geometry) }))]);
  out.add(mesh(sm, M.h2rAlu ?? M.h2rBlack, { name: 'h2r-screen-screws' }));
  return out;
}

/**
 * The screen (the right-side and head-on photographs, triangulated): its centre line from under the
 * nose to the top (1.152 m, the published 1.160 m overall with the rubber edge), and its side edge,
 * the black strip, from the top corner (0.472, 1.08) m, 0.161 m out — the screen widens upwards —
 * down to (0.669, 0.955) m, 0.087 m out, where it passes under the nose's carbon, and on under it.
 */
const SCREEN_C0 = [0.830, 0.860, 0], SCREEN_C1 = [0.463, 1.157, 0];

const SCREEN_EDGE = [[0.80, 0.874, 0.074], [0.669, 0.955, 0.088], [0.57, 1.018, 0.125], [0.472, 1.080, 0.162]];

const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function alongPolyline(P, t) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(...P[i].map((v, k) => v - P[i - 1][k])));
  const d = t * L[L.length - 1];
  for (let i = 1; i < P.length; i++) if (d <= L[i] || i === P.length - 1) return lerp3(P[i - 1], P[i], Math.min(1, (d - L[i - 1]) / (L[i] - L[i - 1])));
  return P[P.length - 1];
}

/**
 * The carbon upper cowl, in metres (the right-side and head-on photographs triangulated, ≈ ±2 cm),
 * in three runs of sections so that its sharp places stay sharp:
 *  - the nose, from the beak (0.898, 0.79) m up to the screen's base (0.70, 0.96) m: a V-topped
 *    ridge whose edges carry the green pinstripes, falling outwards to the crease over the eyes;
 *  - the cowl's side behind it, low over the side panel and running back to the frame (as first
 *    traced);
 *  - the horns, strips from the screen's base up its side edges to its top corners
 *    (0.474, 1.079) m, 0.17–0.21 m out.
 * Rows: [inner edge, outer shoulder, side, crease], each point [x, y, z].
 */
function buildCowl(M) {
  const nose = [
    [[0.898, 0.792, 0], [0.898, 0.790, 0.012], [0.897, 0.787, 0.020], [0.895, 0.782, 0.026]],
    [[0.875, 0.812, 0], [0.875, 0.808, 0.036], [0.873, 0.795, 0.070], [0.872, 0.779, 0.072]],
    [[0.840, 0.842, 0], [0.840, 0.837, 0.050], [0.838, 0.818, 0.120], [0.840, 0.787, 0.118]],
    [[0.800, 0.876, 0], [0.800, 0.871, 0.064], [0.800, 0.850, 0.160], [0.795, 0.800, 0.190]],
    [[0.750, 0.919, 0], [0.750, 0.914, 0.078], [0.755, 0.893, 0.190], [0.750, 0.795, 0.205]],
    [[0.700, 0.962, 0], [0.700, 0.957, 0.090], [0.700, 0.935, 0.196], [0.700, 0.792, 0.218]],
  ];
  // The cowl's side behind the nose: low, so the cockpit shows above it from the side (the right-side
  // photograph: the bars and reservoirs between the screen's edge and the panel).
  const side = [
    [[0.700, 0.900, 0.195], [0.700, 0.890, 0.205], [0.700, 0.840, 0.214], [0.700, 0.792, 0.218]],
    [[0.580, 0.890, 0.200], [0.580, 0.885, 0.222], [0.580, 0.840, 0.240], [0.575, 0.799, 0.250]],
    [[0.466, 0.879, 0.150], [0.466, 0.870, 0.180], [0.466, 0.840, 0.225], [0.466, 0.773, 0.265]],
    [[0.359, 0.818, 0.180], [0.359, 0.811, 0.200], [0.359, 0.786, 0.240], [0.359, 0.732, 0.268]],
    [[0.216, 0.746, 0.210], [0.216, 0.741, 0.220], [0.216, 0.727, 0.240], [0.216, 0.700, 0.250]],
  ];
  // The horns: strips along the screen's side edges, ≈5 cm wide at the top corners and ≈10 cm low
  // down (head-on), ≈3–4 cm seen from the side, with a 1.5 cm return at their outer edge.
  const horn = [
    [[0.700, 0.957, 0.090], [0.700, 0.935, 0.196], [0.700, 0.920, 0.198]],
    [[0.640, 0.975, 0.104], [0.640, 0.968, 0.201], [0.640, 0.953, 0.203]],
    [[0.570, 1.019, 0.130], [0.580, 1.010, 0.206], [0.580, 0.995, 0.208]],
    [[0.520, 1.050, 0.148], [0.530, 1.043, 0.209], [0.530, 1.028, 0.211]],
    [[0.474, 1.079, 0.166], [0.484, 1.073, 0.212], [0.484, 1.058, 0.214]],
  ];
  const carbon2 = twoSided(M, 'h2rCarbon2', M.h2rCarbon, 'h2r-carbon-2s');
  const run = (rows, steps) => { const g = loft(rows, { steps, creaseDeg: 35 }); return withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), 35); };
  const g = new THREE.Group(); g.name = 'h2r-cowl-group';
  const cowl = mesh(mergeAll([{ geometry: run(nose, 3) }, { geometry: run(side, 4) }]), carbon2, { name: 'h2r-cowl' });
  g.add(cowl);
  g.add(mesh(run(horn, 3), carbon2, { name: 'h2r-cowl-horn' }));
  return g;
}

/** The green pinstripes along the nose's V and the horns (the photographs), laid on the cowl. */
function buildPinstripe(M, cowl) {
  const ray = new THREE.Raycaster(); cowl.updateMatrixWorld(true);
  const line = [[0.50, 0.195], [0.601, 0.160], [0.70, 0.112], [0.794, 0.072], [0.85, 0.052], [0.885, 0.030]];
  const pts = [];
  for (const [x, z] of line) for (const dz of [0.003, -0.003]) {
    ray.set(new THREE.Vector3(x, 2, z + dz), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(cowl, true)[0];
    pts.push([x, (hit ? hit.point.y : 0.9) + 0.002, z + dz]);
  }
  const lp = []; for (let i = 0; i < line.length - 1; i++) lp.push([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1]);
  return facets(pts, lp, M.h2rPinGreen, 'h2r-pinstripe-cowl');
}

/**
 * The nose below the carbon cowl's crease, as the head-on, right-side and three-quarter photographs
 * show it (the first two calibrated; x and y from the side camera, which fits ≈1.9 px, z from the
 * head-on one, which is close to orthographic; ≈ ±2 cm):
 *  - the eyes: two dark ducts under the crease, ≈6 cm tall, their mouths facing forward, pockets
 *    ≈7 cm deep; between them the nose's keel coming to a point under the emblem;
 *  - under each eye a carbon band, and below it the chevron: a carbon blade pointing forward and in,
 *    its lower edge picked out in green, from (0.693, 0.70) m, 0.22 m out, to (0.861, 0.663) m;
 *  - below the chevrons the dark lower face round the ram-air mouth, its lip ≈0.60 m up;
 *  - low on each side the chrome lower cowl, a blade continuing the side panel down to
 *    (0.365, 0.331) m, 0.235 m out, with the lower wing standing forward off it: an arrow-shaped
 *    chrome end plate 0.325 m out, from x 0.38 m back (0.514–0.596 m up) to its tip at
 *    (0.543, 0.537) m, and three carbon slats from the cowl to it.
 */
function buildNose(M) {
  const g = new THREE.Group(); g.name = 'h2r-nose';
  M.h2rMeshDark ??= new THREE.MeshStandardMaterial({ name: 'h2r-duct-mesh', color: 0xffffff, map: meshTexture(), metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });
  M.h2rPinGreen ??= new THREE.MeshStandardMaterial({ name: 'h2r-pinstripe', color: 0x46c23a, emissive: 0x0c3a08, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
  const carbon2 = twoSided(M, 'h2rCarbon2', M.h2rCarbon, 'h2r-carbon-2s');
  const black2 = twoSided(M, 'h2rBlack2', M.h2rBlack, 'h2r-black-2s');
  const chrome2 = twoSided(M, 'h2rChrome2', M.h2rChrome, 'h2r-mirror-coat-2s');
  // The eye: mouth (top outer, top inner, bottom inner, bottom outer) and its pocket's floor 7 cm in.
  const E = [[0.790, 0.800, 0.200], [0.886, 0.776, 0.046], [0.881, 0.716, 0.046], [0.797, 0.745, 0.186]];
  const Eb = E.map(([x, y, z]) => [x - 0.07, y + 0.004, z - 0.01]);
  const eyeV = [...E, ...Eb];
  g.add(facets(eyeV, [[4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3]], M.h2rMeshDark, 'h2r-eye'));
  // The keel between the eyes, under the beak, coming to a point at the chevrons' tips.
  g.add(facets([[0.908, 0.786, 0], [0.886, 0.776, 0.046], [0.876, 0.700, 0.034], [0.866, 0.655, 0], [0.84, 0.786, 0], [0.84, 0.70, 0.034]],
    [[0, 1, 2, 3], [1, 4, 5, 2]], black2, 'h2r-keel'));
  // The carbon band under the eye, down to the chevron's top edge.
  const K1 = [0.700, 0.713, 0.218], K2 = [0.858, 0.673, 0.050], K1b = [0.693, 0.692, 0.222], K2b = [0.862, 0.658, 0.048];
  g.add(facets([E[3], E[2], K2, K1], [[0, 1, 2, 3]], carbon2, 'h2r-under-eye'));
  // The chevron: a wedge, its front face and a top and bottom running ≈4 cm back and in.
  const back = ([x, y, z]) => [x - 0.035, y + 0.004, z - 0.012];
  g.add(facets([K1, K2, K2b, K1b, back(K1), back(K2), back(K2b), back(K1b)],
    [[0, 1, 2, 3], [0, 4, 5, 1], [3, 2, 6, 7], [1, 5, 6, 2]], carbon2, 'h2r-chevron'));
  // Its green pinstripe along the lower front edge.
  const up = ([x, y, z], d) => [x + 0.0015, y + d, z + 0.0005];
  g.add(facets([up(K1b, 0.0005), up(K2b, 0.0005), up(K2b, 0.006), up(K1b, 0.0065)], [[0, 1, 2, 3]], M.h2rPinGreen, 'h2r-pinstripe'));
  // The lower face under the chevrons, round the mouth (its inner edge 0.105 m out), and the mouth:
  // a floor (the lip) and a dark back wall inside.
  const L0 = [0.80, 0.605, 0.105], L1 = [0.66, 0.60, 0.215];
  g.add(facets([K2b, K1b, L1, L0, [0.866, 0.655, 0.0], [0.81, 0.606, 0.0]], [[0, 1, 2, 3], [4, 0, 3, 5]], black2, 'h2r-lower-face'));
  g.add(facets([[0.81, 0.606, 0], L0, [0.73, 0.60, 0.105], [0.73, 0.60, 0]], [[0, 1, 2, 3]], black2, 'h2r-mouth-lip'));
  g.add(facets([[0.73, 0.60, 0], [0.73, 0.60, 0.105], [0.76, 0.66, 0.06], [0.76, 0.66, 0]], [[0, 1, 2, 3]], M.h2rMeshDark, 'h2r-mouth'));
  // The chrome lower cowl: a blade from under the side panel down to its tip, in two facets
  // folding along its middle (the photographs: a lit upper facet, a darker one turning in).
  const C = [[0.555, 0.540, 0.300], [0.386, 0.590, 0.262], [0.365, 0.331, 0.235], [0.47, 0.55, 0.29], [0.40, 0.44, 0.255], [0.47, 0.43, 0.24]];
  g.add(facets([...C, [0.66, 0.60, 0.215], [0.60, 0.50, 0.22]], [[1, 3, 4], [3, 0, 5, 4], [4, 5, 2], [1, 4, 2], [0, 6, 7, 5], [5, 7, 2]], chrome2, 'h2r-lower-cowl'));
  // The lower wing: the chrome end plate and three carbon slats from the cowl out to it.
  const zE = 0.325, plateP = [[0.38, 0.596], [0.50, 0.574], [0.543, 0.537], [0.50, 0.522], [0.38, 0.514]];
  const plate = [...plateP.map(([x, y]) => [x, y, zE + 0.003]), ...plateP.map(([x, y]) => [x, y, zE - 0.003])];
  g.add(facets(plate, [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5], [0, 5, 6, 1], [1, 6, 7, 2], [2, 7, 8, 3], [3, 8, 9, 4], [4, 9, 5, 0]], chrome2, 'h2r-lower-wing-plate'));
  const slats = [];
  for (const y of [0.528, 0.553, 0.578]) {
    const x1 = y < 0.54 ? 0.52 : y < 0.56 ? 0.53 : 0.505, t = 0.003;
    const P = [[0.385, y + t, zE], [x1, y + t - 0.012, zE], [x1, y - t - 0.012, zE], [0.385, y - t, zE], [0.385, y + t, 0.245], [x1, y + t - 0.012, 0.27], [x1, y - t - 0.012, 0.27], [0.385, y - t, 0.245]];
    slats.push(P);
  }
  const slatV = slats.flat(), polys = [];
  for (let k = 0; k < 3; k++) { const o = k * 8; polys.push([o, o + 4, o + 5, o + 1], [o + 3, o + 2, o + 6, o + 7], [o + 1, o + 5, o + 6, o + 2]); }
  g.add(facets(slatV, polys, carbon2, 'h2r-lower-wing-slats'));
  return g;
}

/**
 * The upper wings, carbon, where a road bike's mirrors would be. Each is a thin flat blade that
 * leaves a triangular foot bolted to the cowl's side beside the screen's base, and runs out, up and
 * back, nose down; its square-cut outer end is the bike's widest point (the published 0.850 m).
 * Measured on the right-side photograph through its calibrated camera (≈1.9 px rms on the
 * published wheelbase and tyre diameters), the corners back-projected onto their planes: the root's
 * leading edge at (0.773, 0.886) m, 0.19 m out; the tip's leading and trailing edges at (0.672,
 * 0.948) and (0.594, 0.988) m, 0.425 m out. That is ≈15° of dihedral (≈18° in the head-on
 * photograph), ≈23° of sweep and ≈20° nose-down. The root's trailing edge (≈) is a 0.105 m chord
 * at that incidence. Thickness ≈. The head-on photograph (its camera solved on the same points,
 * ≈9 px) shows the tip ≈5 cm deep, the chord's drop: no down-turned lip.
 */
export function buildWings(M) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const plate = (pts, t) => {
    // A flat plate through the outline pts (in order round its face) with thickness t along its normal.
    const n = new THREE.Vector3().subVectors(pts[2], pts[0]).cross(new THREE.Vector3().subVectors(pts[3 % pts.length], pts[1])).normalize().multiplyScalar(t / 2);
    const top = pts.map(p => p.clone().add(n)), bot = pts.map(p => p.clone().sub(n));
    const pos = [], tri = (a, b, d) => pos.push(...a.toArray(), ...b.toArray(), ...d.toArray());
    for (let i = 1; i < pts.length - 1; i++) { tri(top[0], top[i], top[i + 1]); tri(bot[0], bot[i + 1], bot[i]); }
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; tri(top[i], bot[i], bot[j]); tri(top[i], bot[j], top[j]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 4 + pos[i + 2] * 4, pos[i + 1] * 4 + pos[i + 2] * 2);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  };
  const rootLE = V(0.773, 0.886, 0.19), rootTE = V(0.674, 0.922, 0.19);
  const tipLE = V(0.672, 0.948, 0.4245), tipTE = V(0.594, 0.988, 0.4245);
  const parts = [];
  // The blade.
  parts.push(plate([rootLE, tipLE, tipTE, rootTE], 0.009));
  // The foot: a vertical plate from the blade's root down into the cowl, ≈10 cm, swept like the blade.
  const footZ = 0.188;
  parts.push(plate([V(rootLE.x, rootLE.y, footZ), V(rootTE.x, rootTE.y, footZ), V(0.69, 0.81, footZ), V(0.80, 0.79, footZ)], 0.014));
  let g = withCreaseNormals(mergeAll(parts.map(geometry => ({ geometry }))), 30);
  g = mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]);
  return mesh(g, M.h2rCarbon, { name: 'h2r-wings' });
}
