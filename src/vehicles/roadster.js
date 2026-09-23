/**
 * Tesla Roadster — Starman.
 *
 * PROVENANCE & HISTORICAL SPECIFICATIONS:
 *  - Vehicle: first-generation Tesla Roadster, model year 2010, on the pre-2.5 bodywork
 *    (Wikipedia — Elon Musk's Tesla Roadster). Not a 2.5: that facelift arrived in 2011 and
 *    brought a different nose, which is precisely the part of the car this file models.
 *    Personal car of Elon Musk, launched as mass simulator payload on the maiden flight
 *    of SpaceX Falcon Heavy on 6 February 2018 from Launch Complex 39A (KSC).
 *  - Documented Dimensions (Gen 1 Tesla Roadster published specifications):
 *      Overall length:  3.947 m (declared 3.95 m)
 *      Wheelbase:       2.352 m (front axle z = +1.176 m, rear axle z = -1.176 m)
 *      Overall width:   1.852 m (body) / 1.873 m (with exterior mirrors)
 *      Overall height:  1.128 m (declared 1.13 m)
 *      Front track:     1.463 m, Rear track: 1.499 m
 *      Ground clearance: 0.130 m
 *      Wheel sizes:     Front 175/55 R16 (ø 0.599 m), Rear 225/45 R17 (ø 0.634 m)
 *    Sources: evspecifications (Roadster 1.5, full chassis table), dimensions.com and
 *    autopadre (both 1.85 m explicitly \"without mirrors\"), wheel-size.com (OEM fitment),
 *    Wikipedia (1.873 m = across the mirrors). The 1.728 m this model carried until now is
 *    the Lotus Elise's width: the Tesla has its own carbon bodywork on wider tracks and is
 *    12 cm broader, which is most of why it read too narrow for its length.
 *  - Finish: Midnight Cherry Red metallic car paint with deep clearcoat gloss.
 *  - Configuration: Open cockpit (hardtop roof removed for flight).
 *  - Passenger: Starman mannequin in authentic SpaceX IVA flight spacesuit.
 *    Pose: Left arm resting comfortably on the door sill, right hand on the Momo steering wheel.
 *  - Documented Easter Eggs:
 *      1. Center touchscreen displaying "DON'T PANIC!" (Hitchhiker's Guide to the Galaxy).
 *      2. 1:64 scale Hot Wheels miniature Roadster with micro-Starman on the dashboard pad.
 *      3. Circuit board (PCB) engraved with "Made on Earth by humans".
 *      4. Arch Mission Foundation 5D quartz optical disc carrying Asimov's Foundation trilogy.
 *  - Payload Equipment:
 *      Falcon Heavy Payload Attach Fitting (PAF) carbon-composite truss adapter and
 *      three tubular carbon-fiber selfie camera boom arms.
 *
 * Local frame: Y=0 at tyre contact plane, +Y up, vehicle nose pointing along +Z,
 * driver side on -X (left-hand drive).
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, tube, lathe, curve, boxUV } from '../geometry/utils.js';
import { anisotropyLimit } from '../materials/textures.js';
import { canvas, shade, fbm, noise2, heightToNormal, toTexture } from '../materials/textures.js';

// ---- Dimensions -------------------------------------------------------------------------
export const ROADSTER_SPECS = {
  length: 3.947,      // total bumper-to-bumper length
  width: 1.852,       // body width, without mirrors
  widthMirrors: 1.873,// width across the exterior mirrors
  height: 1.128,      // ground to top of windshield header / roll bar
  wheelbase: 2.352,   // distance between front and rear axle centers
  trackFront: 1.463,
  trackRear: 1.499,
  rideHeight: 0.130,  // published ground clearance
  wheelRadiusFront: 0.2995,  // 175/55 R16
  wheelRadiusRear: 0.3172,   // 225/45 R17
};

// -----------------------------------------------------------------------------------------
//  Master surface
// -----------------------------------------------------------------------------------------
// A car body is a Class-A surface, not a surface of revolution, so the lathe that carries the
// rockets is the wrong tool here. What replaces it: four longitudinal key tables, each read
// through the same monotone cubic the ascent profile uses, feeding one full-width section
// curve that every body panel is cut from. Panels therefore share the surface by construction
// and cannot drift out of flush the way separately authored shapes do.
//
// The key tables reconstruct the shape between the points the published envelope actually
// fixes — see ROADSTER_SPECS above, which is where those figures live and the only place they
// should be read from; everything between them is read off side, plan and three-quarter
// photographs of the Falcon Heavy Demo car and is approximate, as the exhibit copy says.

// The bumper caps roll forward of the last swept station, so the stations sit back from the
// declared extremes by exactly the cap depth and the finished car measures 3.946 m.
const CAP_NOSE = 0.016, CAP_TAIL = 0.062;
const Z_NOSE = 1.973 - CAP_NOSE;   // last swept station at the front
const Z_TAIL = -1.973 + CAP_TAIL;  // last swept station at the rear
const Z_AXLE_F = 1.176;
const Z_AXLE_R = -1.176;
// The cabin — door cut, cockpit tub, seats, dash, Starman, roll hoop — measured off the side
// photograph against the two wheel centres (an orthographic render overlaid on it at the same
// scale): the door runs from about +0.66 m to -0.53 m and the windscreen stands on the scuttle
// AHEAD of the door, its base at about +0.78 m and its header at about +0.29 m. Everything in
// the cabin had been built 0.19 m further aft, the glass 0.37-0.44 m, which left no room for
// the side intake between the door and the rear wheel and put the windscreen over the seats.
// The interior builders keep their own coordinates; buildRoadster moves them by CABIN_DZ.
const CABIN_DZ = 0.19;
const Z_COWL = 0.46 + CABIN_DZ;   // front edge of the door cut
const Z_BULK = -0.72 + CABIN_DZ;  // rear bulkhead — back edge of the door cut
const SHUT = 0.005;        // panel shut-line gap, 5 mm

// Section parameter landmarks. The full-width section is a 13-point centripetal Catmull-Rom,
// so control point i sits exactly at t = i/12 and panels split on those values with no seam.
const T_SILL_L = 0, T_SHOULDER_L = 4 / 12, T_CENTRE = 6 / 12, T_SHOULDER_R = 8 / 12, T_SILL_R = 1;

// Half-width. Widest at the rear haunch (0.926 -> 1.852 m overall). The ends keep most of
// their width and round their corners in plan, which is what a bumper does; collapsing the
// half-width to zero would make a boat prow, not a car.
const halfWidth = curve([
  [-1.973, 0.800], [-1.850, 0.866], [-1.650, 0.905], [-1.400, 0.922],
  [-1.176, 0.926], [-1.000, 0.916], [-0.720, 0.888], [-0.400, 0.868],
  [0.000, 0.858], [0.460, 0.872], [0.900, 0.898], [1.176, 0.912],
  [1.400, 0.895], [1.600, 0.848], [1.790, 0.772], [1.870, 0.740],
  [1.920, 0.712], [1.950, 0.672], [1.968, 0.618], [1.973, 0.580],
]);

// Beltline: the highest point of the bodywork at each station, reached at the shoulder. The
// windscreen header, built separately, is what sets the declared 1.128 m overall height.
//
// MEASURED off a straight side photograph (Commons, orange Roadster Sport at the kerb), with the
// scale taken from the tyres (175/55 R16 front, 225/45 R17 rear) and checked against the
// published 1.128 m at the top of the soft top: the rear haunch stands about 0.88 m, the door
// tops about 0.72 m, the scuttle under the windscreen about 0.74 m and the front fender about
// 0.66-0.70 m. The top line FALLS from the tail to the nose — the wedge every photograph of the
// car shows. The previous table held it level at ~0.89 m from the rear haunch to the front
// axle, which put the bonnet and the door tops 10-20 cm too high: the car read as a tall,
// inflated blob instead of a low mid-engined roadster. The front fender is held a few
// centimetres above the photograph because the sweep needs body above the wheel-arch lip.
const yBelt = curve([
  [-1.973, 0.768], [-1.850, 0.832], [-1.650, 0.874], [-1.400, 0.898],
  [-1.176, 0.902], [-1.000, 0.896], [-0.720, 0.872], [-0.400, 0.826],
  [0.000, 0.800], [0.460, 0.786], [0.900, 0.742], [1.176, 0.715],
  [1.400, 0.690], [1.600, 0.655], [1.790, 0.598], [1.870, 0.556],
  [1.920, 0.505], [1.950, 0.425], [1.968, 0.345], [1.973, 0.312],
]);

// Centreline crown: the bonnet and deck at x = 0. Over the cockpit it runs a few centimetres
// below the belt; over the engine cover, between the rear haunches, about five. Over the
// bonnet it sits lower still: every photograph of the front of the car (show-floor front
// three-quarter, street front view) has the frunk lid and the louvre panel lying in a shallow
// trough between two fender crowns, with the headlamps on the crowns. At 3 cm the front
// section peaked NEAR THE CENTRE, and the nose read as a single inflated dome. The 7-8 cm here,
// together with the crest that frontCrest() puts on the fenders, is estimated from those
// photographs against the car's published width; it is not a measured figure.
const yCrown = curve([
  [-1.973, 0.772], [-1.850, 0.812], [-1.650, 0.846], [-1.400, 0.852],
  [-1.176, 0.854], [-1.000, 0.852], [-0.720, 0.842], [-0.400, 0.800],
  [0.000, 0.780], [0.460, 0.762], [0.900, 0.675], [1.176, 0.652],
  [1.400, 0.628], [1.600, 0.600], [1.790, 0.552], [1.870, 0.515],
  [1.920, 0.472], [1.950, 0.402], [1.968, 0.322], [1.973, 0.292],
]);

/**
 * How far the section's shoulder is lifted into a fender crest: 1 over the bonnet, 0.75 over
 * the engine cover. Zero over the cockpit, where the door tops and the windscreen base have
 * their own fit, and zero again at both ends, where the panels roll down into one edge.
 */
const frontCrest = (z) => THREE.MathUtils.smoothstep(z, 0.72, 1.02) * (1 - THREE.MathUtils.smoothstep(z, 1.70, 1.90))
  // The rear clamshell does the same thing, less strongly: the haunches over the rear wheels
  // stand above the engine cover between them (show-floor rear three-quarter photograph).
  + 0.75 * THREE.MathUtils.smoothstep(z, -1.80, -1.55) * (1 - THREE.MathUtils.smoothstep(z, -0.80, -0.56));

// Rocker: the bottom edge of the visible body side, before the wheel arches cut into it.
// The published ground clearance is 0.130 m at the floor; the visible sill edge sits above it
// and lifts at both ends where the bumpers undercut.
// The bumpers used to lift to 0.25 m at each end, which left the underbody open across the
// whole width of the car: in front elevation you looked straight under the nose and saw the
// wheel-well shields, and the shadow under the fascia merged with the cooling slot into one
// tall dark hole. A real fascia comes down to just above the 0.130 m ground clearance.
const ySillBase = curve([
  [-1.973, 0.182], [-1.700, 0.176], [-1.176, 0.172], [-0.400, 0.152],
  [0.400, 0.150], [1.176, 0.158], [1.600, 0.162], [1.860, 0.168], [1.920, 0.172],
  [1.950, 0.182], [1.968, 0.205], [1.973, 0.225],
]);

// Wheel arch openings. Radius is the tyre radius plus the gap the car actually carries — this
// chassis runs a visibly large arch gap, which is part of how it reads.
const ARCHES = [
  { z: Z_AXLE_F, r: 0.346, top: 0.636 },
  { z: Z_AXLE_R, r: 0.366, top: 0.678 },
];

/** Rocker line with the two arches cut out of it. */
function sillEdge(z) {
  const base = ySillBase(z);
  let y = base;
  for (const a of ARCHES) {
    const d = Math.abs(z - a.z) / a.r;
    if (d < 1) y = Math.max(y, base + (a.top - base) * Math.sqrt(1 - d * d));
  }
  return y;
}

/**
 * Full-width section at one station, as a centripetal Catmull-Rom through 13 points: sill,
 * tuck-under, maximum width, shoulder and crown on each side of a shared centreline point.
 * Because the centreline is an interior point of the curve, the tangent there is horizontal by
 * symmetry and the bonnet crosses x = 0 without the crease a mirrored half-surface leaves.
 */
const _sectionCache = { z: NaN, curve: null };
function sectionCurve(z) {
  if (z === _sectionCache.z) return _sectionCache.curve;
  const W = halfWidth(z), yb = yBelt(z), yc = yCrown(z), ys = sillEdge(z);
  const drop = Math.max(0.05, yb - ys);
  const fk = frontCrest(z);
  const half = [
    [0.905, ys],                       // sill / arch edge
    [0.962, ys + drop * 0.11],         // tuck-under
    [1.000, yb - drop * 0.56],         // maximum half-width
    [0.955, yb - drop * 0.26],         // flank
    // Shoulder / character line. Over the bonnet it rises to the belt and becomes the fender
    // crest; elsewhere it stays below it and the top of the section is the crown.
    [0.780 - 0.035 * fk, yb - drop * 0.12 * (1 - fk)],
    [0.430, yc + (yb - yc) * (0.48 - 0.24 * fk)],    // crown shoulder: a flatter lid over the bonnet
  ];
  const pts = [];
  for (const [fx, y] of half) pts.push(new THREE.Vector3(-fx * W, y, z));
  pts.push(new THREE.Vector3(0, yc, z));
  for (let i = half.length - 1; i >= 0; i--) pts.push(new THREE.Vector3(half[i][0] * W, half[i][1], z));
  // Tension 0.22 keeps the section on the control points. 0.5 bowed the flanks
  // out between them, which is the bloated plan and the swollen wheel arches.
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.22);
  _sectionCache.z = z; _sectionCache.curve = c;
  return c;
}

/**
 * Where the bodywork is, at a given point of the front (or rear) elevation.
 *
 * The section sweep gives one surface point per (z, t), and a section runs sill to sill over
 * the top, so a horizontal slot across the nose — the cooling mouth — is not a constant-z
 * path on it: the two ends of the slot live at mirrored t values and the middle would have to
 * cross the crown. Rather than fight the parameterisation, look the surface up the way the eye
 * does: march back along z from the extreme end and take the first station whose section
 * reaches the requested height at the requested half-width. Returns the z of the fascia, or
 * null if that (x, y) is off the bodywork.
 */
function fasciaZ(x, y, { from, to, step }) {
  const ax = Math.abs(x);
  for (let z = from; (step > 0 ? z <= to : z >= to); z += step) {
    if (halfWidth(z) < ax) continue;
    // Solve the section for the parameter whose x matches, then compare heights.
    const c = sectionCurve(z);
    let best = null, bestErr = Infinity;
    for (let i = 0; i <= 40; i++) {
      const p = c.getPoint(0.5 + (i / 40) * 0.5);
      const e = Math.abs(p.x - ax);
      if (e < bestErr) { bestErr = e; best = p; }
    }
    if (best && bestErr < 0.05 && best.y <= y) return z;
  }
  return null;
}

// Cooling-mouth outline, authored in the front elevation: half-width, half-height, centre
// height, and how far back along the car the fascia it belongs to reaches.
const MOUTH = { y: 0.382, w: 0.470, h: 0.044, zMin: 1.790 };

// The black lower fascia covers this band of the front elevation. The painted panel is cut
// away underneath it — a real car's paint stops where the moulding starts — which is also what
// stops the fascia paint showing through the cooling slot.
// Its top edge was at 0.470 m, which made the intake a 24 cm black rectangle filling most of
// the bumper face. The front photographs show a lower, wider slot whose top runs nearly level
// out to the corners, with body colour between it and the emblem. Heights approximate.
const FASCIA = { x: 0.585, y0: 0.222, y1: 0.352, zMin: 1.790, taperLo: 0.040, taperHi: 0.030 };
// Rear: in the straight rear photograph the black is only the diffuser at the very bottom;
// the bumper above it, with the plate recess, is body colour. The band had its top at 0.462 m,
// a black slab across half the tail.
const FASCIA_REAR = { x: 0.600, y0: 0.205, y1: 0.292, zMax: -1.760, taperLo: 0.030, taperHi: 0.030 };
function fasciaBand(F, u) {
  const f = Math.pow(1 - Math.min(1, Math.abs(u)), 0.42);
  return [F.y0 + (1 - f) * F.taperLo, F.y1 - (1 - f) * F.taperHi];
}
/** True where a point of the bodywork is behind one of the lower fascias, tested in elevation. */
function underFascia(F, z, t) {
  if (F.zMin !== undefined ? z < F.zMin : z > F.zMax) return false;
  const p = bodyPoint(z, t);
  if (Math.abs(p.x) > F.x * 0.985) return false;
  const [ya, yb] = fasciaBand(F, p.x / F.x);
  return p.y > ya + 0.004 && p.y < yb - 0.004;
}

const _bp = new THREE.Vector3();
/** One point on the master surface. t runs 0 (left sill) -> 0.5 (centreline) -> 1 (right sill). */
function bodyPoint(z, t) {
  sectionCurve(z).getPoint(THREE.MathUtils.clamp(t, 0, 1), _bp);
  return { x: _bp.x, y: _bp.y, z: _bp.z };
}

/**
 * Longitudinal sample stations. Uniform spacing wastes triangles on the flat door and starves
 * the arches, whose sqrt(1 - d^2) edge turns vertical; these refine near the arch rims, the
 * cowl and the ends.
 */
function stations(z0, z1, n) {
  const out = [];
  const refine = [Z_AXLE_F - 0.374, Z_AXLE_F + 0.374, Z_AXLE_R - 0.398, Z_AXLE_R + 0.398, Z_NOSE, Z_TAIL];
  for (let i = 0; i <= n; i++) {
    let u = i / n;
    // Ease toward each refinement point that falls inside the span.
    for (const r of refine) {
      const tr = (r - z0) / (z1 - z0);
      if (tr <= 0.02 || tr >= 0.98) continue;
      const d = u - tr;
      u -= 0.16 * d * Math.exp(-Math.pow(d / 0.10, 2));
    }
    out.push(z0 + (z1 - z0) * u);
  }
  out[0] = z0; out[out.length - 1] = z1;
  return out;
}

/**
 * Sweeps the master surface over a list of stations and section parameters. UVs are metric —
 * accumulated arc length across the section and along the sweep — so a paint flake map tiles
 * by the millimetre the same way the steel maps tile by the metre.
 */
function sweep(zs, ts, flip = false, skip = null) {
  const Nu = zs.length, Nv = ts.length;
  const pos = new Float32Array(Nu * Nv * 3);
  const uv = new Float32Array(Nu * Nv * 2);
  const idx = [];
  let vAcc = 0;
  let prevRow = null;
  for (let i = 0; i < Nu; i++) {
    const row = [];
    let uAcc = 0;
    for (let j = 0; j < Nv; j++) {
      const p = bodyPoint(zs[i], ts[j]);
      row.push(p);
      if (j > 0) uAcc += Math.hypot(p.x - row[j - 1].x, p.y - row[j - 1].y, p.z - row[j - 1].z);
      const k = i * Nv + j;
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uv[k * 2] = uAcc;
    }
    if (prevRow) {
      let d = 0;
      for (let j = 0; j < Nv; j++) d = Math.max(d, Math.hypot(row[j].x - prevRow[j].x, row[j].y - prevRow[j].y, row[j].z - prevRow[j].z));
      vAcc += d;
    }
    for (let j = 0; j < Nv; j++) uv[(i * Nv + j) * 2 + 1] = vAcc;
    prevRow = row;
  }
  for (let i = 0; i < Nu - 1; i++) {
    for (let j = 0; j < Nv - 1; j++) {
      // A panel with an opening in it — a lamp aperture — drops the quads inside the opening.
      // Leaving the surface closed and standing the lamp on top of it is what made the
      // headlights read as decals painted onto the wing.
      if (skip && skip((zs[i] + zs[i + 1]) / 2, (ts[j] + ts[j + 1]) / 2)) continue;
      const a = i * Nv + j, b = (i + 1) * Nv + j, c = (i + 1) * Nv + (j + 1), d = i * Nv + (j + 1);
      if (flip) { idx.push(a, d, b, b, d, c); } else { idx.push(a, b, d, b, c, d); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Section parameters between t0 and t1, refined toward the shoulder where curvature peaks. */
function params(t0, t1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    let u = i / n;
    for (const land of [T_SHOULDER_L, T_SHOULDER_R]) {
      const tr = (land - t0) / (t1 - t0);
      if (tr <= 0.02 || tr >= 0.98) continue;
      const d = u - tr;
      u -= 0.20 * d * Math.exp(-Math.pow(d / 0.12, 2));
    }
    out.push(t0 + (t1 - t0) * u);
  }
  out[0] = t0; out[out.length - 1] = t1;
  return out;
}

/**
 * Rounds a panel's open end over into a bumper face rather than letting the section taper to a
 * point. The ring rolls back through a quarter turn while shrinking toward its own centroid,
 * then a fan closes the remaining flat — a deep roll at the nose, a shallow one for the Kamm
 * tail, which is what the car has.
 */
function endCap(ring, dirZ, depth, flatFrac, rings = 4, flip = false) {
  const n = ring.length;
  let cx = 0, cy = 0;
  for (const p of ring) { cx += p.x; cy += p.y; }
  cx /= n; cy /= n;
  const pos = [], idx = [];
  for (let k = 0; k <= rings; k++) {
    const a = (k / rings) * Math.PI / 2;
    const zOff = dirZ * depth * Math.sin(a);
    const sc = 1 - (1 - flatFrac) * (1 - Math.cos(a));
    for (const p of ring) pos.push(cx + (p.x - cx) * sc, cy + (p.y - cy) * sc, p.z + zOff);
  }
  const centre = pos.length / 3;
  pos.push(cx, cy, ring[0].z + dirZ * depth);
  // The section ring runs sill to sill over the top and is NOT a closed loop, so wrapping the
  // last point back to the first is what closes the underside of the bumper. Without the wrap
  // the cap was a cone missing one wedge, and the car had a triangular hole under each end —
  // visible straight through the tail in rear elevation.
  for (let k = 0; k < rings; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      const a = k * n + j, b = (k + 1) * n + j, c = (k + 1) * n + j2, d = k * n + j2;
      if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
    }
  }
  for (let j = 0; j < n; j++) {
    const a = rings * n + j, b = rings * n + (j + 1) % n;
    if (flip) idx.push(a, centre, b); else idx.push(a, b, centre);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  boxUV(geo);
  return geo;
}

/**
 * Turns a panel edge back on itself so a shut line has a wall instead of showing the panel is
 * a zero-thickness sheet. Without this the 5 mm gaps read as cracks straight through the car.
 */
function edgeFlange(edge, inZ, drop, flip = false) {
  const pos = [], idx = [], n = edge.length;
  for (const p of edge) pos.push(p.x, p.y, p.z);
  for (const p of edge) pos.push(p.x * 0.985, p.y - drop, p.z + inZ);
  for (let j = 0; j < n - 1; j++) {
    const a = j, b = n + j, c = n + j + 1, d = j + 1;
    if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  boxUV(geo);
  return geo;
}

const _n1 = new THREE.Vector3(), _n2 = new THREE.Vector3(), _n3 = new THREE.Vector3();
/**
 * Outward normal of the master surface. Needed by anything that has to sit IN the paint
 * rather than on it — lamps, indicators, badges — which is what made the old headlights read
 * as accessories glued to the fender.
 */
function bodyNormal(z, t) {
  const dz = 0.004, dt = 0.004;
  const a = bodyPoint(z + dz, t), b = bodyPoint(z - dz, t);
  const c = bodyPoint(z, Math.min(1, t + dt)), d = bodyPoint(z, Math.max(0, t - dt));
  _n1.set(a.x - b.x, a.y - b.y, a.z - b.z);
  _n2.set(c.x - d.x, c.y - d.y, c.z - d.z);
  _n3.crossVectors(_n1, _n2).normalize();
  // t increases left-to-right, so the cross product points inward on one half of the car.
  if (_n3.y < 0) _n3.negate();
  return _n3;
}

/** The ring of points a panel ends on, for capping and flanging. */
function ringAt(z, ts) { return ts.map(t => bodyPoint(z, t)); }

// -----------------------------------------------------------------------------------------
//  Tail panel
// -----------------------------------------------------------------------------------------
// The tail was a flat Kamm plate with a dome, and every rear view read as the back of a bar of
// soap with two almonds on it. The photographs (Commons: 2008 Roadster rear three-quarter, grey,
// on a show floor; Roadster Sport straight rear, orange, at the kerb; the same orange car in
// side elevation) show three distinct surfaces stacked on top of each other:
//
//   - a BUMPER, body colour, full width, bulging back and rolling under towards the black
//     diffuser, with the plate recess pressed into it;
//   - above its top edge a crisp SHELF, and a LAMP BAND standing in from the bumper face, with
//     one black housing per side reaching from about a third of the way out to the corner;
//   - the DECK finishing in a ducktail LIP that comes back out over the band.
//
// So the face is now a height field, z = tailZ(x, y), over the tail outline, meshed on a
// regular grid in elevation (the shelf and the plate recess are straight lines in x and y, and
// a grid that runs along them keeps them crisp) with the grid snapped onto the outline and
// onto the lamp openings. Heights are read off the straight rear photograph with the lamp
// lenses as the ruler and cross-checked against the side elevation; they are approximate.
const TAIL_FACE_Z = -1.973;     // the bumper's rearmost point: the declared 3.947 m ends here
const TAIL_SHRINK = 0.94;       // the rolled rim pulls the outline in by this much
const TAIL = {
  bumperY: 0.470,   // height at which the bumper stands furthest back
  roll: 0.70,       // how quickly it rolls forward below that, m per m²
  crease: 0.510,    // the bumper's top edge: the shelf the lamp housings sit on
  shelf: 0.036,     // how far the lamp band stands in from the bumper
  lean: 0.08,       // the band leans forward going up
  lip: 0.040,       // how far the deck's trailing edge comes back out over the band
  plan: 0.030,      // the corners roll forward in plan
};
// Plate recess: pressed into the bumper, sized for a US plate (12 × 6 in). The Demo car flew
// without one, so the recess is empty paint.
const TAIL_PLATE = { y: 0.378, w: 0.168, h: 0.080, r: 0.020, d: 0.009 };

let _tailOutline = null;
/** The tail face's outline in elevation, and the height of its upper edge across the car. */
function tailOutline() {
  if (_tailOutline) return _tailOutline;
  const N = 600, ring = [];
  for (let i = 0; i <= N; i++) ring.push(bodyPoint(Z_TAIL, i / N));
  let cx = 0, cy = 0;
  for (const p of ring) { cx += p.x; cy += p.y; }
  cx /= ring.length; cy /= ring.length;
  const pts = ring.map(p => [cx + (p.x - cx) * TAIL_SHRINK, cy + (p.y - cy) * TAIL_SHRINK]);
  const X = 1.0, STEP = 0.002, top = [];
  for (let x = -X; x <= X + 1e-9; x += STEP) {
    let best = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((x0 - x) * (x1 - x) > 0 || x0 === x1) continue;
      best = Math.max(best, y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    }
    top.push(best);
  }
  _tailOutline = { pts, cx, cy, top, X, STEP };
  // The housing wraps to the corner, but it is laid on the face: stop it just inside.
  let half = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    if ((y0 - TAIL_LAMP.y) * (y1 - TAIL_LAMP.y) > 0 || y0 === y1) continue;
    half = Math.max(half, Math.abs(x0 + (x1 - x0) * (TAIL_LAMP.y - y0) / (y1 - y0)));
  }
  TAIL_LAMP.x1 = Math.min(TAIL_LAMP.x1, half - 0.014);
  return _tailOutline;
}
function tailTop(x) {
  const { top, X, STEP } = tailOutline();
  const f = (THREE.MathUtils.clamp(x, -X, X) + X) / STEP, i = Math.min(top.length - 2, Math.floor(f));
  const a = top[i], b = top[i + 1];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(a) ? a : b;
  return a + (b - a) * (f - i);
}

/** Signed distance to a rounded rectangle centred at the origin. */
function sdRoundRect(x, y, w, h, r) {
  const qx = Math.abs(x) - w + r, qy = Math.abs(y) - h + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** z of the tail surface at (x, y) in elevation. */
function tailZ(x, y) {
  const T = TAIL, ss = THREE.MathUtils.smoothstep;
  const dy = Math.min(y, T.crease) - T.bumperY;
  let z = (dy < 0 ? T.roll : 0.30) * dy * dy;
  z += ss(y, T.crease - 0.004, T.crease + 0.014) * (T.shelf + T.lean * Math.max(0, y - T.crease));
  z -= T.lip * ss(y, tailTop(x) - 0.058, tailTop(x) - 0.006);
  z += T.plan * Math.pow(Math.abs(x) / 0.75, 4);
  const P = TAIL_PLATE;
  z += P.d * (1 - ss(sdRoundRect(x, y - P.y, P.w, P.h, P.r), -0.005, 0.002));
  return TAIL_FACE_Z + z;
}
/** Outward normal of the tail surface. */
function tailNormal(x, y, out = new THREE.Vector3()) {
  const e = 0.0015;
  const fx = (tailZ(x + e, y) - tailZ(x - e, y)) / (2 * e);
  const fy = (tailZ(x, y + e) - tailZ(x, y - e)) / (2 * e);
  return out.set(fx, fy, -1).normalize();
}

// Tail lamp housings, in the tail's own elevation. Straight rear photograph, the 0.115 m lens
// of the big brake lamp as the scale: each black housing runs from about 0.33 m off the
// centreline out to the corner, rounded and tall at its inboard end, tapering to a point
// outboard at about the height of the lamp centres. It stands on the shelf and reaches up to
// the lip. Three round units in a row: brake/tail inboard with a red centre, a clear one, a
// small clear one at the tip.
// x1 is where the housing runs out at the corner: 0.785 m, or just inside the face if the face
// is narrower there (set when the outline is built).
const TAIL_LAMP = { x0: 0.340, x1: 0.785, y: 0.604, h0: 0.083, h1: 0.030 };
const TAIL_CELLS = [
  { x: 0.445, r: 0.056, red: true },
  { x: 0.572, r: 0.047 },
  { x: 0.678, r: 0.031 },
];
/** Half-height of the housing at u (0 inboard .. 1 outboard). */
function tailLampHalf(u) {
  const L = TAIL_LAMP, len = L.x1 - L.x0;
  const uIn = L.h0 / len;                       // the inboard end is a half-disc of radius h0
  const taper = L.h0 + (L.h1 - L.h0) * THREE.MathUtils.clamp((u - uIn) / (1 - uIn), 0, 1);
  let h = taper;
  if (u < uIn) { const d = 1 - u / uIn; h = L.h0 * Math.sqrt(Math.max(0, 1 - d * d)); }
  if (u > 0.93) { const d = (u - 0.93) / 0.07; h *= Math.sqrt(Math.max(0, 1 - d * d)); }
  return h;
}
/** The housing outline as a closed polygon, s = ±1 for the side, grown by `grow` metres. */
function tailLampPolygon(s, grow = 0, n = 72) {
  tailOutline();
  const L = TAIL_LAMP, out = [];
  const at = (u) => L.x0 + (L.x1 - L.x0) * u;
  // Cosine spacing packs points into both rounded ends.
  for (let i = 0; i <= n; i++) {
    const u = 0.5 - 0.5 * Math.cos(Math.PI * i / n);
    out.push([s * at(u), L.y + tailLampHalf(u) + grow]);
  }
  for (let i = n - 1; i > 0; i--) {
    const u = 0.5 - 0.5 * Math.cos(Math.PI * i / n);
    out.push([s * at(u), L.y - tailLampHalf(u) - grow]);
  }
  if (grow) {
    out[0][0] -= s * grow;
    out[n][0] += s * grow;
  }
  return out;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nearestOnPoly(x, y, poly) {
  let best = null, bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-12;
    const t = THREE.MathUtils.clamp(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1);
    const px = x0 + dx * t, py = y0 + dy * t, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return [best, bd];
}

/**
 * The tail: a rolled rim from the last swept station down onto the face, and the face itself,
 * gridded in elevation with the lamp housings cut out of it.
 */
function tailPanel(ring) {
  const { pts: outline, cx, cy } = tailOutline();
  const holes = [tailLampPolygon(-1), tailLampPolygon(1)];
  const parts = [];

  // Rolled rim: each ring point runs back through a quarter turn onto the face.
  {
    const n = ring.length, RINGS = 6, pos = [], idx = [];
    const ends = ring.map(p => {
      const x = cx + (p.x - cx) * TAIL_SHRINK, y = cy + (p.y - cy) * TAIL_SHRINK;
      return tailZ(x, y);
    });
    for (let r = 0; r <= RINGS; r++) {
      const a = (r / RINGS) * Math.PI / 2;
      const sc = 1 - (1 - TAIL_SHRINK) * (1 - Math.cos(a));
      ring.forEach((p, i) => pos.push(cx + (p.x - cx) * sc, cy + (p.y - cy) * sc, p.z + (ends[i] - p.z) * Math.sin(a)));
    }
    for (let r = 0; r < RINGS; r++) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a = r * n + i, b = (r + 1) * n + i, c = (r + 1) * n + j, d = r * n + j;
        idx.push(a, d, b, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    boxUV(geo);
    parts.push({ geometry: geo });
  }

  // The face: a grid in elevation, cells kept where they touch the panel, overhanging corners
  // pulled onto the outline or the lamp opening. Rows are horizontal up to the lamp band — the
  // shelf and the plate recess are horizontal lines — and above it they bend to follow the top
  // edge, so the lip, which follows that edge, runs along rows instead of across them. On a
  // plain grid the lip crossed the cells diagonally and its underside came out in teeth.
  {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of outline) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const DX = 0.008, DY = 0.005, YS = 0.600, BLEND = 0.060;
    const nx = Math.ceil(Math.max(-x0, x1) / DX), ny0 = Math.floor(y0 / DY), ny1 = Math.ceil(y1 / DY) + 1;
    const cols = 2 * nx + 1, rows = ny1 - ny0 + 1;
    const vTop = ny1 * DY;
    const gx = new Float32Array(cols * rows), gy = new Float32Array(cols * rows);
    for (let i = 0; i < cols; i++) {
      const x = (i - nx) * DX;
      const shift = Math.max(tailTop(x), YS + BLEND + 0.03) - vTop;
      for (let j = 0; j < rows; j++) {
        const v = (ny0 + j) * DY;
        gx[j * cols + i] = x;
        gy[j * cols + i] = v + shift * THREE.MathUtils.smoothstep(v, YS, YS + BLEND);
      }
    }
    const inDomain = (x, y) => pointInPoly(x, y, outline) && !holes.some(h => pointInPoly(x, y, h));
    const keep = new Uint8Array((cols - 1) * (rows - 1));
    const used = new Uint8Array(cols * rows);
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const k = [j * cols + i, j * cols + i + 1, (j + 1) * cols + i, (j + 1) * cols + i + 1];
        const cxm = (gx[k[0]] + gx[k[3]]) / 2, cym = (gy[k[0]] + gy[k[1]] + gy[k[2]] + gy[k[3]]) / 4;
        if (!inDomain(cxm, cym) && !k.some(q => inDomain(gx[q], gy[q]))) continue;
        keep[j * (cols - 1) + i] = 1;
        for (const q of k) used[q] = 1;
      }
    }
    const pos = new Float32Array(cols * rows * 3), nrm = new Float32Array(cols * rows * 3), uv = new Float32Array(cols * rows * 2);
    const _n = new THREE.Vector3();
    for (let k = 0; k < cols * rows; k++) {
      let x = gx[k], y = gy[k];
      if (used[k] && !inDomain(x, y)) {
        let best = null, bd = Infinity;
        for (const poly of [outline, ...holes]) {
          const [p, d] = nearestOnPoly(x, y, poly);
          if (d < bd) { bd = d; best = p; }
        }
        [x, y] = best;
      }
      pos.set([x, y, tailZ(x, y)], k * 3);
      tailNormal(x, y, _n);
      nrm.set([_n.x, _n.y, _n.z], k * 3);
      uv.set([x, y], k * 2);
    }
    const idx = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        if (!keep[j * (cols - 1) + i]) continue;
        const a = j * cols + i, b = a + 1, d = a + cols, c = d + 1;
        idx.push(a, c, b, a, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    parts.push({ geometry: geo });
  }

  return mergeAll(parts);
}

// -----------------------------------------------------------------------------------------
//  Procedural Textures for In-Cockpit Displays & Circuitry
// -----------------------------------------------------------------------------------------
function makeDontPanicTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Deep space obsidian background
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 512, 256);

  // High-tech bezel accent line
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);

  // Top header banner
  ctx.font = '600 15px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('SPACEX  ·  FALCON HEAVY 001  ·  STARMAN', 256, 44);

  // "DON'T PANIC!" headline centered with generous padding (completely unclipped!)
  ctx.font = '900 34px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("DON'T PANIC!", 256, 114);

  // Sub-status telemetry
  ctx.font = '700 15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('ORBIT: HELIOCENTRIC MARS CROSSING', 256, 166);

  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('APHELION: 1.67 AU  ·  PERIHELION: 0.98 AU', 256, 202);

  // Subtle CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 512, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, anisotropyLimit());
  return tex;
}

function makePcbTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b2b17';
  ctx.fillRect(0, 0, 512, 256);

  // Gold circuit traces
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = 20; y < 240; y += 32) {
    ctx.moveTo(16, y);
    ctx.lineTo(84, y);
    ctx.lineTo(124, y + 14);
    ctx.lineTo(210, y + 14);
    ctx.moveTo(300, y);
    ctx.lineTo(380, y);
    ctx.lineTo(420, y - 12);
    ctx.lineTo(496, y - 12);
  }
  ctx.stroke();

  // IC contact pads
  ctx.fillStyle = '#c5a028';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(36 + i * 16, 18, 9, 14);
    ctx.fillRect(36 + i * 16, 50, 9, 14);
    ctx.fillRect(380 + i * 11, 186, 7, 12);
  }

  // Silk screen inscription: "Made on Earth by humans"
  ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Made on Earth by humans', 256, 136);

  ctx.font = '15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#f0d775';
  ctx.fillText('TESLA ROADSTER · STARMAN AVIONICS PCB', 256, 172);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, anisotropyLimit());
  return tex;
}

function makeGrilleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0c0f';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1c2027';
  for (let y = 0; y < 128; y += 8) {
    for (let x = (y % 16 === 0 ? 0 : 4); x < 128; x += 8) {
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

/**
 * The Tesla T, drawn rather than approximated with a chrome cylinder. Alpha-cut so the shield
 * sits proud of the disc behind it. No other marking is added anywhere on the car.
 */
function makeEmblemTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = '#e9edf2';
  // Crossbar with the tapered ends the mark has.
  x.beginPath();
  x.moveTo(66, 74); x.lineTo(190, 74); x.lineTo(178, 100); x.lineTo(78, 100); x.closePath();
  x.fill();
  // Stem, narrowing to the point.
  x.beginPath();
  x.moveTo(114, 104); x.lineTo(142, 104); x.lineTo(134, 196); x.lineTo(122, 196); x.closePath();
  x.fill();
  // Shoulder hooks either side of the stem.
  x.beginPath();
  x.moveTo(66, 68); x.lineTo(96, 56); x.lineTo(104, 68); x.closePath();
  x.moveTo(190, 68); x.lineTo(160, 56); x.lineTo(152, 68); x.closePath();
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// -----------------------------------------------------------------------------------------
//  Material Factory
// -----------------------------------------------------------------------------------------
/**
 * Paint flake. Automotive metallic is a dielectric lacquer with aluminium flake suspended in
 * the base coat, under a clear coat — not a metal. Modelling it as metal (which is what
 * metalness: 0.88 does) makes the diffuse term vanish and the sun eats the colour, which is
 * why the previous car read as anodised black in daylight. The flake belongs in a fine
 * roughness/normal perturbation instead; at ~2 cm tile it is invisible up close and gives the
 * clear coat something to break up.
 */
/** Prism grid of a clear tail lens: a colour map and the normal map of its facets. */
function makeLensMaps() {
  const CELL = 8;
  // Each cell a low pyramid: brightest in the middle, dark along the cell edges.
  const pyramid = (x, y) => 0.5 - Math.max(Math.abs((x % CELL) / CELL - 0.5), Math.abs((y % CELL) / CELL - 0.5));
  const height = canvas(128, 128);
  shade(height, (x, y) => { const v = pyramid(x, y) * 510; return [v, v, v]; });
  const colour = canvas(128, 128);
  shade(colour, (x, y) => { const v = 188 + 64 * pyramid(x, y); return [v, v, v + 4]; });
  return { map: toTexture(colour, { srgb: true }), normalMap: toTexture(heightToNormal(height, 3.0)) };
}

function makeFlakeMaps() {
  const c = canvas(256, 256);
  shade(c, (x, y) => {
    const n = fbm(x * 0.55, y * 0.55, 4, 2.3, 0.55);
    const sparkle = Math.pow(Math.max(0, noise2(x * 1.9 + 11, y * 1.9 - 7)), 6);
    const v = 128 + n * 26 + sparkle * 90;
    return [v, v, v];
  });
  return {
    normalMap: toTexture(heightToNormal(c, 0.55), { tileSize: 0.02 }),
    roughnessMap: toTexture(c, { tileSize: 0.02 }),
  };
}

/** Tread blocks and sidewall lettering relief for the tyres. */
function makeTyreMaps() {
  const c = canvas(512, 128);
  shade(c, (x, y, u, v) => {
    // v across the section: 0..0.24 and 0.76..1 are sidewall, the middle is the tread.
    const shoulder = Math.min(v, 1 - v);
    if (shoulder < 0.24) {
      const rib = Math.sin(u * Math.PI * 2 * 46) * 0.5 + 0.5;
      const band = shoulder > 0.15 && shoulder < 0.21 ? rib * 34 : 0;
      return [96 + band + fbm(x * 0.4, y * 0.4, 3) * 8, 96 + band, 96 + band];
    }
    const g = (u * 512) % 42;
    const lat = Math.abs(shoulder - 0.5) * 2;
    const groove = g < 5 || Math.abs(g - 21 - lat * 9) < 4 ? 0 : 1;
    const circ = Math.abs(shoulder - 0.36) < 0.022 || Math.abs(shoulder - 0.64) < 0.022 ? 0 : 1;
    const v2 = 62 + groove * circ * 88 + fbm(x * 0.7, y * 0.7, 3) * 10;
    return [v2, v2, v2];
  });
  return { normalMap: toTexture(heightToNormal(c, 2.6), { tileSize: 1 }) };
}

function createRoadsterMaterials(M) {
  const flake = makeFlakeMaps();

  // Midnight Cherry Red. Dielectric base coat + clear coat, calibrated so that under the
  // exhibit's raked sun it reads as the saturated cherry the car photographs as, not black.
  // 0x6f121e came out as a dusty maroon under the grey-blue clearcoat reflection of the sky;
  // against the Petersen show-floor photograph the body is clearly redder and more saturated.
  const cherryRed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x8e0c1a),
    metalness: 0.0,
    roughness: 0.26,
    roughnessMap: flake.roughnessMap,
    normalMap: flake.normalMap,
    normalScale: new THREE.Vector2(0.10, 0.10),
    clearcoat: 1.0,
    clearcoatRoughness: 0.045,
    envMapIntensity: 1.05,
  });

  const blackTrim = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.20, roughness: 0.68 });
  const satinBlack = new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.32, roughness: 0.46 });

  // The reflector pocket behind each lamp: near-black, so the lamps read as depth.
  const reflectorBowl = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.5, roughness: 0.35 });

  // Moulded lamp housing — the matte black plastic the front and rear optics sit in. Both ends
  // of the car use it, and it is what makes the lamps read as assemblies rather than decals.
  const lampHousing = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.10, roughness: 0.62 });

  // Machined forged alloy, not show chrome. The Demo car wore silver forged wheels.
  const forgedAlloy = new THREE.MeshPhysicalMaterial({
    color: 0xb9bdc2, metalness: 0.92, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.16,
    envMapIntensity: 0.9,
  });

  // Chrome, only where the car has chrome: lug nuts, small fittings, mirror glass.
  const chromeTrim = new THREE.MeshStandardMaterial({
    color: 0xeef1f5, metalness: 0.98, roughness: 0.10, envMapIntensity: 1.15,
  });

  const tyre = makeTyreMaps();
  const tyreRubber = new THREE.MeshStandardMaterial({
    color: 0x16171a, metalness: 0.0, roughness: 0.92,
    normalMap: tyre.normalMap, normalScale: new THREE.Vector2(0.9, 0.9),
  });

  const brakeRotor = new THREE.MeshStandardMaterial({ color: 0x8d9198, metalness: 0.90, roughness: 0.30 });
  const brakeCaliper = new THREE.MeshStandardMaterial({ color: 0xb00d1a, metalness: 0.35, roughness: 0.26 });
  const amberReflector = new THREE.MeshPhysicalMaterial({
    color: 0xe08b12, metalness: 0.0, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.04,
    transmission: 0.35, ior: 1.5, thickness: 0.02,
  });

  // Four surfaces on the car transmit: this windscreen and the Arch quartz disc fully, the
  // amber reflector and the tail lenses at around a third, where the effect wanted is a tint
  // rather than a view through. Everything else that looks like glass — the headlight covers
  // most of all — fakes it with clearcoat, because Three renders the scene again for each
  // transmissive material and the car cannot afford a pass per lamp.
  // Mixing opacity with transmission is what left the old windscreen looking like a milky
  // slab; transmission alone, front-facing, refracts.
  const windshieldGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdceaf2, metalness: 0.0, roughness: 0.02, transmission: 0.94, ior: 1.52,
    thickness: 0.006, envMapIntensity: 1.0,
  });

  // Lens glass without transmission: clear coat over the chrome bowl behind it does the work,
  // and Three re-renders the scene once per transmissive object, which these do not need.
  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xe6eef6, metalness: 0.0, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.10, envMapIntensity: 1.15, depthWrite: false,
    side: THREE.DoubleSide,
  });

  // The brake lamp's red centre. Opaque: it is a small disc in front of a chrome cup, and a
  // transmissive material costs a whole extra scene render for it.
  const taillightRed = new THREE.MeshPhysicalMaterial({
    color: 0xa3030e, metalness: 0.0, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.03,
    emissive: 0x2c0206,
  });
  // The tail lenses in both rear photographs are clear, silvery and faceted — a grid of small
  // prisms over a chrome reflector — not red. Opaque and slightly metallic, with the prism grid
  // as a normal map, so they sparkle rather than read as grey discs.
  const lensMaps = makeLensMaps();
  const tailLens = new THREE.MeshPhysicalMaterial({
    color: 0xdfe3e8, metalness: 0.35, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.04,
    map: lensMaps.map, normalMap: lensMaps.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
    envMapIntensity: 1.2,
  });

  const starmanSuitWhite = new THREE.MeshPhysicalMaterial({
    color: 0xeef0f4, metalness: 0.0, roughness: 0.52, sheen: 0.4, sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xffffff),
  });
  const starmanSuitGraphite = new THREE.MeshStandardMaterial({ color: 0x1a1c21, roughness: 0.55, metalness: 0.16 });

  // Gold-tinted IVA visor, dark from outside and not bright enough to punch the bloom
  // threshold the composer runs at.
  const starmanVisor = new THREE.MeshPhysicalMaterial({
    color: 0x120d06, metalness: 0.96, roughness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.02,
    envMapIntensity: 1.3,
  });

  const quartzDisc = new THREE.MeshPhysicalMaterial({
    color: 0xdfeef8, metalness: 0.0, roughness: 0.03, transmission: 0.92, ior: 1.46, thickness: 0.002,
  });

  // Radiator matrix seen through the grille: dark, matt, and never bright enough to read as a
  // lit panel at the back of the opening.
  const radiatorCore = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, metalness: 0.55, roughness: 0.85 });

  // The moulded lower front fascia. On the real car it is a separate, darker panel below the
  // paint line, and it is what keeps the nose from reading as one continuous bulge.
  const lowerFascia = new THREE.MeshPhysicalMaterial({
    color: 0x191b1f, metalness: 0.10, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.28,
  });

  const grilleMesh = new THREE.MeshStandardMaterial({
    map: makeGrilleTexture(), color: 0x080a0c, roughness: 0.92, metalness: 0.15, side: THREE.DoubleSide,
  });

  // The Falcon's procedural carbon weave is already built at startup; the Roadster's seats,
  // PAF and booms are carbon, so they should use it rather than a flat grey stand-in.
  const carbonFiber = M.carbon || new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.36, metalness: 0.3 });
  const aluminium = M.aluminum || forgedAlloy;

  return {
    cherryRed, blackTrim, satinBlack, carbonFiber, chromeTrim, forgedAlloy, aluminium, reflectorBowl, lampHousing,
    tyreRubber, brakeRotor, brakeCaliper, amberReflector, windshieldGlass, headlightLens, taillightRed, tailLens,
    starmanSuitWhite, starmanSuitGraphite, starmanVisor, quartzDisc, grilleMesh, radiatorCore, lowerFascia,
  };
}
// -----------------------------------------------------------------------------------------
//  Body shell: panels cut from the master surface
// -----------------------------------------------------------------------------------------
function buildBodyShell(mats, M) {
  const g = new THREE.Group();
  g.name = 'body-shell';

  // The Elise-derived panel split the car actually has: one clamshell over the front, one over
  // the rear, and a door between them. Each is a cut of the same master surface, so they stay
  // flush; the 5 mm between them is the shut line, and each cut edge gets a flange so the gap
  // has a wall.
  const tFull = params(T_SILL_L, T_SILL_R, 60);
  const tDoorL = params(T_SILL_L, T_SHOULDER_L, 13);
  const tDoorR = params(T_SHOULDER_R, T_SILL_R, 13);

  // The front panel carries the lamp apertures, and a hole is only as clean as the grid it is
  // cut from: at the panel's normal spacing the aperture edge came out in 20 mm teeth. Densify
  // just the two bands the lamps live in — the rest of the panel keeps its usual sampling.
  const tFront = (() => {
    const set = new Set(tFull);
    for (const s2 of [-1, 1]) {
      // The lamp bands...
      for (let d = 0.100; d <= 0.300; d += 0.0035) set.add(T_CENTRE + s2 * d);
      // ...and the band the cooling mouth is cut from, low on the fascia.
      for (let d = 0.300; d <= 0.500; d += 0.0040) set.add(T_CENTRE + s2 * d);
    }
    return [...set].sort((a, b) => a - b).filter(v => v >= 0 && v <= 1);
  })();

  // The rear panel carries the tail-lamp apertures and needs the same treatment.
  const tRear = (() => {
    const set = new Set(tFull);
    for (const s2 of [-1, 1]) {
      for (let d = 0.050; d <= 0.330; d += 0.0035) set.add(T_CENTRE + s2 * d);
    }
    return [...set].sort((a, b) => a - b);
  })();

  // Densify along the sweep as well as across it. The t bands above fixed the long edges of
  // each aperture; the ends were still cut on 28 mm stations and came out in visible teeth.
  const denser = (zs, from, to, step) => {
    const set = new Set(zs);
    for (let z = Math.min(from, to); z <= Math.max(from, to); z += step) set.add(z);
    return [...set].sort((a, b) => a - b);
  };
  const zFront = denser(
    denser(stations(Z_COWL + SHUT / 2, Z_NOSE, 52), LAMP_FRONT.z0 + 0.02, LAMP_FRONT.z0 + LAMP_FRONT.za - 0.02, 0.005),
    MOUTH.zMin + 0.05, Z_NOSE, 0.004);
  // The rear panel's only cut is the fascia band, so the extra stations follow that band's own
  // z range. They used to follow LAMP_REAR, from back when the tail lamps were cut out of the
  // sweep; the lamps now live in the tail plane, and the density was landing in the wrong place
  // — too far aft, and stopping 56 mm short of where the band actually ends.
  const zRear = denser(stations(Z_TAIL, Z_BULK - SHUT / 2, 52), Z_TAIL, FASCIA_REAR.zMax + 0.01, 0.005);
  const zDoor = stations(Z_BULK + SHUT / 2, Z_COWL - SHUT / 2, 22);

  // The tail and the rear clamshell are kept as named geometries: the rear fascia moulding is
  // laid ON them (raycast below) instead of into a hole cut out of them.
  const rearGeo = sweep(zRear, tRear);
  const tailGeo = tailPanel(ringAt(Z_TAIL, tRear));
  const panels = [
    { geometry: sweep(zFront, tFront, false, (z, t) => lampContains(LAMP_FRONT, z, t, 1.02) || underFascia(FASCIA, z, t)) },
    // Not cut under the rear fascia. The black moulding lives on the tail plane; the band
    // also reached 15 cm forward round the rear corners of the clamshell, where the paint was
    // cut away cell by cell and nothing covered the hole — a staircase of black teeth round
    // both corners in any rear three-quarter view. The photographs have painted corners and
    // the black only across the tail, so the corners keep their paint.
    { geometry: rearGeo },
    { geometry: sweep(zDoor, tDoorL) },
    { geometry: sweep(zDoor, tDoorR) },
    // Bumper faces. The nose rolls deep, the tail is a Kamm cut-off with a tight radius.
    // Both are wound the same way: the tail was passing flip=true and rendering inside-out,
    // which at the old 30 mm cap depth was a sliver nobody could see and at a realistic depth
    // is a hole straight through the back of the car.
    { geometry: endCap(ringAt(Z_NOSE, tFront), 1, CAP_NOSE, 0.30, 4) },
    // The tail is its own panel, with the lamp openings and the fascia band cut out of it.
    // Only the lamp openings are cut. The fascia band used to be cut out of the tail as well,
    // on the panel's polar grid, and the flat moulding meant to cover it sat BEHIND the domed
    // tail — so the hole's stepped edge was the outline of the black band, and everything
    // below the band was open too.
    { geometry: tailGeo },
    // Shut-line walls.
    { geometry: edgeFlange(ringAt(Z_COWL + SHUT / 2, tFull), -0.013, 0.006) },
    { geometry: edgeFlange(ringAt(Z_BULK - SHUT / 2, tFull), 0.013, 0.006, true) },
    { geometry: edgeFlange(ringAt(Z_BULK + SHUT / 2, tDoorL), -0.013, 0.006, true) },
    { geometry: edgeFlange(ringAt(Z_BULK + SHUT / 2, tDoorR), -0.013, 0.006, true) },
    { geometry: edgeFlange(ringAt(Z_COWL - SHUT / 2, tDoorL), 0.013, 0.006) },
    { geometry: edgeFlange(ringAt(Z_COWL - SHUT / 2, tDoorR), 0.013, 0.006) },
  ];

  // Cockpit opening lip: the door's top edge rolled inboard, so the sill reads as pressed metal
  // rather than a paper cut.
  for (const ts of [[T_SHOULDER_L], [T_SHOULDER_R]]) {
    const lip = zDoor.map(z => bodyPoint(z, ts[0]));
    const pos = [], idx = [];
    for (const p of lip) pos.push(p.x, p.y, p.z);
    for (const p of lip) pos.push(p.x * 0.90, p.y - 0.022, p.z);
    for (let j = 0; j < lip.length - 1; j++) {
      const a = j, b = lip.length + j, c = lip.length + j + 1, d = j + 1;
      const inward = ts[0] === T_SHOULDER_L;
      if (inward) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    boxUV(geo);
    panels.push({ geometry: geo });
  }

  // Deliberately NOT welded with mergeVertices: soldering across panel boundaries at a 6 mm
  // threshold is what averages the character line away. Panels share vertices by construction
  // where they should and stay separate where the car separates them.
  g.add(mesh(mergeAll(panels), mats.cherryRed, { name: 'body-paint' }));

  // Rolled arch lips, following the cut the arches make in the rocker line.
  const archLips = [];
  for (const a of ARCHES) {
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 22; i++) {
        const ang = Math.PI * (i / 22);
        const z = a.z + a.r * Math.cos(ang) * 0.995;
        const p = bodyPoint(z, side < 0 ? T_SILL_L : T_SILL_R);
        pts.push([p.x, p.y, p.z]);
      }
      archLips.push({ geometry: tube(pts, 0.0070, { tubular: 34, radial: 10 }) });
    }
  }
  g.add(mesh(mergeAll(archLips), mats.cherryRed, { name: 'wheel-arch-lips' }));

  // 4. Cockpit tub (floor, firewall, tunnel, bulkhead, inner door panels)
  const cockpitTubGeo = sweep(stations(Z_COWL, Z_BULK, 26), params(T_SILL_L, T_SILL_R, 28), true);
  {
    const pos = cockpitTubGeo.attributes.position;
    const zs = stations(Z_COWL, Z_BULK, 26);
    const ts = params(T_SILL_L, T_SILL_R, 28);
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      const uEnd = Math.min((z - Z_COWL) / -0.30, (z - Z_BULK) / 0.30, 1);
      for (let j = 0; j < ts.length; j++) {
        const k = i * ts.length + j;
        const absS = Math.abs(ts[j] - T_CENTRE) * 2;
        const floor = 0.168 + (absS < 0.42 ? 0.115 * (1 - Math.pow(absS / 0.42, 2)) : 0);
        const rim = pos.getY(k);
        const blend = Math.min(1, Math.max(0, uEnd)) * (absS > 0.74 ? Math.max(0, (1 - absS) / 0.26) : 1);
        pos.setY(k, rim + (floor - rim) * blend);
        pos.setX(k, pos.getX(k) * (0.62 + 0.38 * (1 - blend)));
      }
    }
    pos.needsUpdate = true;
    cockpitTubGeo.computeVertexNormals();
  }
  g.add(mesh(cockpitTubGeo, mats.blackTrim, { name: 'cockpit-tub' }));

  // 5. WATERTIGHT ENCLOSED WHEEL ARCH LINER TUBS & INNER BULKHEADS
  const wheelLinerParts = [];
  // Front liners (z = 1.176, r = 0.36)
  for (const s of [-1, 1]) {
    const xOut = s * 0.78;
    const xIn = s * 0.44;
    const linerCurv = lathe([
      { r: 0.36, y: xOut },
      { r: 0.36, y: xIn },
      { r: 0.0, y: xIn },
    ], { segments: 32, phiStart: 0, phiLength: Math.PI });
    linerCurv.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    linerCurv.rotateY(Math.PI / 2);
    wheelLinerParts.push({
      geometry: linerCurv,
      matrix: mat4([0, 0.30, 1.176]),
    });
    // Vertical front splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.36, 0.48, 0.02),
      matrix: mat4([s * 0.61, 0.35, 1.176 + 0.36]),
    });
    // Vertical rear splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.36, 0.48, 0.02),
      matrix: mat4([s * 0.61, 0.35, 1.176 - 0.36]),
    });
    // Inboard splash shield bulkhead preventing light leaks
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.02, 0.48, 0.88),
      matrix: mat4([s * 0.44, 0.35, 1.176]),
    });
  }
  // Rear liners (z = -1.176, r = 0.38)
  for (const s of [-1, 1]) {
    const xOut = s * 0.86;
    const xIn = s * 0.44;
    const linerCurv = lathe([
      { r: 0.38, y: xOut },
      { r: 0.38, y: xIn },
      { r: 0.0, y: xIn },
    ], { segments: 32, phiStart: 0, phiLength: Math.PI });
    linerCurv.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    linerCurv.rotateY(Math.PI / 2);
    wheelLinerParts.push({
      geometry: linerCurv,
      matrix: mat4([0, 0.317, -1.176]),
    });
    // Vertical front splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.42, 0.50, 0.02),
      matrix: mat4([s * 0.65, 0.36, -1.176 + 0.38]),
    });
    // Vertical rear splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.42, 0.50, 0.02),
      matrix: mat4([s * 0.65, 0.36, -1.176 - 0.38]),
    });
    // Inboard splash shield bulkhead
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.02, 0.50, 0.92),
      matrix: mat4([s * 0.44, 0.36, -1.176]),
    });
  }
  g.add(mesh(mergeAll(wheelLinerParts), mats.satinBlack, { name: 'wheel-well-liners' }));

  // 6. UNDERBODY AERO PAN (Full-length flat belly tray from chin to diffuser)
  // 2.86 m — past the axles at both ends, but well inside the 3.947 m body. At the 3.88 m it
  // used to be it reached the bumpers and, because the rocker line lifts to 0.33 m at each
  // end, showed in side elevation as a slab hanging under the nose and the tail.
  const bellyPan = new THREE.BoxGeometry(1.34, 0.025, 2.86);
  g.add(mesh(bellyPan, mats.blackTrim, { position: [0, 0.138, 0], name: 'underbody-belly-pan' }));

  // Longitudinal battery cooling strakes along the underbody tray
  for (let i = -0.48; i <= 0.48; i += 0.24) {
    g.add(mesh(new THREE.BoxGeometry(0.015, 0.025, 2.20), mats.satinBlack, {
      position: [i, 0.125, 0.0],
      name: 'battery-cooling-strake',
    }));
  }

  // Aluminum chassis subframe crossmembers (front and rear)
  g.add(mesh(new THREE.BoxGeometry(1.30, 0.04, 0.12), mats.aluminium, {
    position: [0, 0.135, 1.176],
    name: 'front-subframe-crossmember',
  }));
  g.add(mesh(new THREE.BoxGeometry(1.30, 0.04, 0.12), mats.aluminium, {
    position: [0, 0.135, -1.176],
    name: 'rear-subframe-crossmember',
  }));

  // Front cooling intake.
  //
  // What the 2008 car has there, from the front three-quarter photograph on Wikimedia Commons
  // ("2008 Tesla Roadster front.jpg"): a wide, low intake of black mesh across the bottom of
  // the nose, in body-coloured bumper, with no separate black moulding round it. The model had
  // a black band with a slot cut out of it, and both halves of that were visible defects:
  //
  //  · the slot was cut by DROPPING GRID CELLS whose centre fell inside a superellipse, so its
  //    edge was a staircase of 20 mm steps however fine the grid, in every front view;
  //  · the painted body was cut away only under the band, not under the slot's plenum, so
  //    the nose's own end cap showed through the opening as a wavy red strip.
  //
  // The band IS the intake now. It is authored in the front elevation as before — a grid in
  // (x, y) dropped onto the bodywork with fasciaZ() and lifted 4 mm proud of it — but nothing is
  // removed from it, so its outline is the band's own smooth taper, and the paint underneath is
  // already cut away (underFascia), so nothing can show through. A body-colour lip runs round
  // the whole outline, following the band's real edge rather than a constant height.
  {
    // The panel OVERLAPS the cut in the paint, the way a moulding covers the edge of the hole
    // it is fitted into. The paint is cut away under the band cell by cell (underFascia), so
    // the edge of that cut is a staircase; a panel exactly the size of the band left the steps
    // showing as dark notches along its top edge where the cut ran past it. Grown by 1.5–2 cm
    // all round, it sits 4 mm proud over the ragged edge and hides it.
    const X = FASCIA.x * 1.025;
    const NX = 72, NY = 12;
    const band = (u) => {
      const [ya, yb] = fasciaBand(FASCIA, u);
      return [ya - 0.014, yb + 0.018];
    };
    const zOn = (x, y) => fasciaZ(x, y, { from: 1.972, to: FASCIA.zMin, step: -0.002 });

    const zAt = [];
    for (let i = 0; i <= NX; i++) {
      zAt[i] = [];
      const u = (i / NX) * 2 - 1, x = u * X;
      const [ya, yb] = band(u);
      for (let j = 0; j <= NY; j++) zAt[i][j] = zOn(x, ya + (yb - ya) * (j / NY));
    }
    // Fill any gap from its neighbours so the panel never tears.
    for (let i = 0; i <= NX; i++) {
      for (let j = 0; j <= NY; j++) {
        if (zAt[i][j] !== null) continue;
        let sum = 0, n = 0;
        for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0]]) {
          const v = zAt[i + di]?.[j + dj];
          if (v != null) { sum += v; n++; }
        }
        zAt[i][j] = n ? sum / n : FASCIA.zMin;
      }
    }
    const pos = [], idx = [];
    for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * 2 - 1, x = u * X;
      const [ya, yb] = band(u);
      for (let j = 0; j <= NY; j++) pos.push(x, ya + (yb - ya) * (j / NY), zAt[i][j] + 0.004);
    }
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NY; j++) {
        const a = i * (NY + 1) + j, b = (i + 1) * (NY + 1) + j;
        const c = (i + 1) * (NY + 1) + j + 1, d = i * (NY + 1) + j + 1;
        idx.push(a, b, d, b, c, d);
      }
    }
    const intake = new THREE.BufferGeometry();
    intake.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    intake.setIndex(idx);
    intake.computeVertexNormals();
    boxUV(intake);
    g.add(mesh(intake, mats.grilleMesh, { name: 'front-lower-fascia', castShadow: false }));

    // The lip: one closed loop round the band's actual outline, top edge, right end, bottom
    // edge, left end — the rim that makes a dark panel read as an opening in the bumper.
    const loop = [];
    const edgePt = (u, top) => {
      const x = u * X;
      const [ya, yb] = band(u);
      const y = top ? yb : ya;
      const z = zOn(x, y) ?? zAt[Math.round((u + 1) / 2 * NX)][top ? NY : 0];
      return [x, y, z + 0.006];
    };
    const K = 44;
    for (let k = 0; k <= K; k++) loop.push(edgePt(-0.985 + (k / K) * 1.97, true));
    for (let k = 0; k <= K; k++) loop.push(edgePt(0.985 - (k / K) * 1.97, false));
    g.add(mesh(tube(loop, 0.0065, { tubular: loop.length * 2, radial: 8, closed: true }), mats.cherryRed,
      { name: 'nose-crease', castShadow: false }));
  }

  // Nose emblem. Replaces the chrome cylinder that stood in for it: a thin disc bedded into
  // the clamshell carrying the Tesla T, sitting on the surface normal so it lies flush.
  {
    const pe = bodyPoint(1.836, T_CENTRE);
    const pf = bodyPoint(1.876, T_CENTRE), pb = bodyPoint(1.796, T_CENTRE);
    const pitch = Math.atan2(pb.y - pf.y, pf.z - pb.z);
    const emblem = new THREE.Group();
    emblem.name = 'tesla-nose-emblem';
    emblem.position.set(0, pe.y + 0.001, pe.z);
    emblem.rotation.set(Math.PI / 2 - pitch, 0, 0);
    emblem.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.0035, 28), mats.satinBlack));
    emblem.add(mesh(new THREE.PlaneGeometry(0.056, 0.056), new THREE.MeshStandardMaterial({
      map: makeEmblemTexture(), transparent: true, roughness: 0.22, metalness: 0.75,
    }), { position: [0, 0.0022, 0], rotation: [-Math.PI / 2, 0, 0] }));
    g.add(emblem);
  }

  // Black lower rear fascia across the bottom of the bumper, laid on the painted surface 4 mm
  // proud of it: a ray from behind the car finds the tail (or, round the corners, the
  // clamshell) at each grid point.
  {
    const F = FASCIA_REAR;
    const NX = 64, NY = 10;
    const pos = [], idx = [];
    const probe = new THREE.Group();
    const probeMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    probe.add(new THREE.Mesh(tailGeo, probeMat), new THREE.Mesh(rearGeo, probeMat));
    probe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const behind = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
    const surfaceZ = (x, y) => {
      behind.set(x, y, TAIL_FACE_Z - 0.5);
      ray.set(behind, fwd);
      const hit = ray.intersectObject(probe, true)[0];
      return hit ? hit.point.z : tailZ(x, y);
    };
    for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * 2 - 1, x = u * F.x;
      const [ya, yb] = fasciaBand(F, u);
      for (let j = 0; j <= NY; j++) {
        const y = ya + (yb - ya) * (j / NY);
        pos.push(x, y, surfaceZ(x, y) - 0.004);
      }
    }
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NY; j++) {
        const a = i * (NY + 1) + j, b = (i + 1) * (NY + 1) + j;
        const c = (i + 1) * (NY + 1) + j + 1, d = i * (NY + 1) + j + 1;
        idx.push(a, d, b, b, d, c);
      }
    }
    const panel = new THREE.BufferGeometry();
    panel.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    panel.setIndex(idx);
    panel.computeVertexNormals();
    boxUV(panel);
    g.add(mesh(panel, mats.lowerFascia, { name: 'rear-lower-fascia' }));

    // The diffuser opening: black mesh across most of the width (both rear photographs), on
    // the curved bumper rather than a flat card in front of it, and a moulded lip under it.
    {
      const W = 0.50, Y0 = 0.222, Y1 = 0.282, NU = 40, NV = 4, mp = [], mi = [], muv = [];
      for (let i = 0; i <= NU; i++) {
        const x = -W + 2 * W * i / NU;
        for (let j = 0; j <= NV; j++) {
          const y = Y0 + (Y1 - Y0) * j / NV;
          mp.push(x, y, surfaceZ(x, y) - 0.0055);
          muv.push(i / NU, j / NV);
        }
      }
      for (let i = 0; i < NU; i++) {
        for (let j = 0; j < NV; j++) {
          const a = i * (NV + 1) + j, b = a + NV + 1;
          mi.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      const grille = new THREE.BufferGeometry();
      grille.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
      grille.setAttribute('uv', new THREE.Float32BufferAttribute(muv, 2));
      grille.setIndex(mi);
      grille.computeVertexNormals();
      g.add(mesh(grille, mats.grilleMesh, { name: 'rear-diffuser-mesh' }));
      const lip = [];
      for (let i = 0; i <= 40; i++) {
        const x = -0.56 + 1.12 * i / 40;
        lip.push([x, 0.214, surfaceZ(x, 0.214) - 0.008]);
      }
      g.add(mesh(tube(lip, 0.009, { tubular: 44, radial: 8 }), mats.satinBlack, { name: 'rear-diffuser-lip' }));
    }
  }

  // Rear underbody tray, tucked under the tail rather than hanging below it.
  {
    const parts = [{ geometry: new THREE.BoxGeometry(1.10, 0.062, 0.30), matrix: mat4([0, 0.246, -1.796]) }];
    for (const sx of [-0.42, -0.14, 0.14, 0.42]) {
      parts.push({ geometry: new THREE.BoxGeometry(0.014, 0.070, 0.28), matrix: mat4([sx * 0.80, 0.258, -1.796]) });
    }
    g.add(mesh(mergeAll(parts), mats.satinBlack, { name: 'rear-diffuser' }));
  }

  // The plate recess is pressed into the bumper by tailZ itself; the Demo car flew without a
  // plate, so it stays empty paint rather than a black box or an invented plate.

  // ---------------------------------------------------------------------------------------
  //  AERODYNAMIC EXTERIOR MIRRORS (Sculpted organic teardrop shells on swept stems)
  // ---------------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    // Mirrors are mounted off the door skin, so take the root off the body surface instead of
    // the hardcoded coordinates the old body used — they left the housings floating in space
    // once the flank moved. Overall width with mirrors is the declared 1,873 m.
    const mt = side < 0 ? T_SHOULDER_L - 0.024 : T_SHOULDER_R + 0.024;
    const root = bodyPoint(0.40, mt);
    // Housing: a rounded pod about 15 cm across, 8 cm tall and 9 cm deep, as the front
    // three-quarter photograph shows it at the foot of the A-pillar — not the 6 cm ball it was,
    // which read as a red bead on a wire. Its outer face stops at the declared 1.873 m across
    // the mirrors, so it stands only a centimetre past the bodywork, as on the car.
    const POD_W = 0.150, POD_R = 0.042;
    const cx = side * (ROADSTER_SPECS.widthMirrors / 2 - POD_W / 2);
    const cy = root.y + 0.058, cz = root.z - 0.012;
    const inboard = cx - side * (POD_W / 2 - 0.012);
    const mirrorStem = tube([
      [root.x, root.y, root.z],
      [root.x + (inboard - root.x) * 0.5, root.y + 0.030, root.z - 0.004],
      [inboard, cy - 0.010, cz],
    ], 0.011, { tubular: 16, radial: 8 });
    g.add(mesh(mirrorStem, mats.satinBlack));

    const mirrorHousing = new THREE.Group();
    mirrorHousing.name = `mirror-${side < 0 ? 'left' : 'right'}`;
    mirrorHousing.position.set(cx, cy, cz);
    // Toed in a few degrees, so the glass looks back along the flank at the driver.
    mirrorHousing.rotation.set(0, side * 0.14, 0);

    const mBody = new THREE.CapsuleGeometry(POD_R, POD_W - 2 * POD_R, 6, 18);
    mBody.rotateZ(Math.PI / 2);                    // long axis across the car
    mBody.scale(1, 0.92, 1.05);
    mirrorHousing.add(mesh(mBody, mats.cherryRed));
    // The glass faces REARWARD. It was rotated to face sideways into the cockpit — a mirror
    // looking at the passenger — which is the one orientation a door mirror never has.
    const mGlass = new THREE.CircleGeometry(1, 28);
    mGlass.scale((POD_W - 0.022) / 2, POD_R * 0.80, 1);
    mGlass.rotateY(Math.PI);
    mirrorHousing.add(mesh(mGlass, mats.chromeTrim, { position: [0, 0, -POD_R * 1.05 - 0.001] }));
    const bezel = new THREE.TorusGeometry(1, 0.06, 6, 28);
    bezel.scale((POD_W - 0.018) / 2, POD_R * 0.86, 1);
    mirrorHousing.add(mesh(bezel, mats.satinBlack, { position: [0, 0, -POD_R * 1.04] }));
    g.add(mirrorHousing);

    // On the door skin just under its top edge, towards the rear. It was placed at t INSIDE the
    // shoulder, which is the cockpit opening once the door tops came down to their measured
    // height: two black blocks floating in the cabin beside the seats.
    const hz = Z_BULK + 0.16, ht = side < 0 ? T_SHOULDER_L - 0.028 : T_SHOULDER_R + 0.028;
    const ph = bodyPoint(hz, ht), hn = bodyNormal(hz, ht);
    const handle = mesh(new THREE.BoxGeometry(0.105, 0.026, 0.012), mats.satinBlack, {
      name: `door-handle-${side < 0 ? 'left' : 'right'}`,
    });
    handle.position.set(ph.x + hn.x * 0.004, ph.y + hn.y * 0.004, ph.z + hn.z * 0.004);
    handle.lookAt(ph.x + hn.x, ph.y + hn.y, ph.z + hn.z);   // face on the skin, long axis along the car
    g.add(handle);

    // Side intake. On the car (side photograph, rear three-quarter photographs) it is the front
    // of the rear clamshell: directly behind the door the panel's leading edge flares OUT over a
    // tall crescent-shaped opening, so the intake faces forward into the airflow and reads as a
    // scoop from any angle along the flank. It was a 0.23 × 0.14 m oval ring straddling the door
    // shut line, which read as a round dent. Built on the master surface: a dark crescent laid
    // on the skin, a paint ramp rising from the flank to a lip that stands 2-3 cm proud, and a
    // dark inner wall from the lip down into the opening. Proportions from the photographs;
    // approximate.
    {
      const tK = (k) => { const t = 0.312 - 0.118 * k; return side < 0 ? t : 1 - t; };
      const zDoor = Z_BULK - SHUT - 0.004;
      const width = (k) => 0.030 + 0.092 * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * k)), 0.8);
      const flare = (k) => 0.026 * Math.pow(Math.sin(Math.PI * k), 0.7);
      const at = (z, t, off) => {
        const p = bodyPoint(z, t), n = bodyNormal(z, t);
        return [p.x + n.x * off, p.y + n.y * off, p.z + n.z * off];
      };
      const sheet = (NK, NV, fn) => {
        const pos = [], idx = [];
        for (let i = 0; i <= NK; i++) for (let j = 0; j <= NV; j++) pos.push(...fn(i / NK, j / NV));
        for (let i = 0; i < NK; i++) for (let j = 0; j < NV; j++) {
          const a = i * (NV + 1) + j, b = a + NV + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return twoSided(boxUV(geo));
      };
      const NK = 20;
      // The opening: a crescent on the skin between the door edge and the lip.
      const slot = sheet(NK, 4, (k, v) => at(zDoor - width(k) * v, tK(k), 0.0015));
      // Inner wall: from the lip, back down onto the floor of the opening.
      const wall = sheet(NK, 3, (k, v) => {
        const z = zDoor - width(k) - 0.004;
        return at(z + 0.012 * v, tK(k), flare(k) * (1 - v) - 0.004 * v);
      });
      // Paint ramp: the flank rising to the lip.
      const ramp = sheet(NK, 5, (k, v) => {
        const z = zDoor - width(k) - 0.004 - 0.085 * (1 - v);
        return at(z, tK(k), 0.0012 + flare(k) * Math.pow(v, 1.6));
      });
      const lip = [];
      for (let i = 0; i <= NK; i++) { const k = i / NK; lip.push(at(zDoor - width(k) - 0.004, tK(k), flare(k) + 0.002)); }
      const tag = side < 0 ? 'left' : 'right';
      g.add(mesh(mergeAll([{ geometry: slot }, { geometry: wall }]), mats.satinBlack, { name: `side-intake-${tag}`, castShadow: false }));
      g.add(mesh(ramp, mats.cherryRed, { name: `side-intake-ramp-${tag}` }));
      g.add(mesh(tube(lip, 0.009, { tubular: 40, radial: 8 }), mats.cherryRed, { name: `side-intake-lip-${tag}` }));
    }
  }

  // Front splitter and the two corner intakes under the fascia. The car carries a black lower
  // valance the full width of the nose, not a bare bumper edge.
  {
    const splitter = [];
    for (let i = 0; i <= 26; i++) {
      const u = (i / 26) * 2 - 1;
      const x = u * 0.700;
      splitter.push([x, 0.156 - Math.pow(Math.abs(u), 2.4) * 0.018, 1.918 - Math.pow(Math.abs(u), 1.8) * 0.205]);
    }
    g.add(mesh(tube(splitter, 0.020, { tubular: 30, radial: 8 }), mats.satinBlack, { name: 'front-splitter' }));
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(0.115, 0.058, 0.055), mats.lampHousing, {
        position: [sx * 0.600, 0.300, 1.858], rotation: [0, sx * 0.34, 0], name: 'front-corner-intake',
      }));
    }
  }

  // Bonnet vent. Photographs of the car (show-floor, front three-quarter) show no longitudinal
  // ridges on the clamshell: behind the frunk lid, across nearly the whole width between the
  // fender crowns, there are three stepped louvres, each a curved blade lifting towards its
  // front edge over a dark slot. The four thin strakes that stood here were a guess, and the
  // wrong one — they drew the bonnet as a set of pinstripes. Each blade is laid on the master
  // surface, so it follows the crown; it rises from flush at its trailing edge to a lip at its
  // leading edge, fades back into the paint at both ends, and the riser under the lip is the
  // vent opening. Pitch, chord, lip height and the forward bow of the arcs are read off the
  // photographs against the car's published width; they are approximate.
  {
    const W = 0.47, ZR = 0.905, PITCH = 0.106, CHORD = 0.094, LIP = 0.025, BOW = 0.050;
    const NU = 36, NC = 5;
    const xL = bodyPoint(0.8, T_SHOULDER_L).x;
    // t at a given lateral offset, by bisection between the two shoulders (x is monotonic there).
    const tAtX = (z, x) => {
      let lo = T_SHOULDER_L, hi = T_SHOULDER_R;
      const sgn = Math.sign(bodyPoint(z, hi).x - bodyPoint(z, lo).x) || Math.sign(-xL);
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if ((bodyPoint(z, mid).x - x) * sgn < 0) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const onSkin = (z, x, lift) => {
      const t = tAtX(z, x), p = bodyPoint(z, t), n = bodyNormal(z, t);
      return [p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift];
    };
    const fade = (u) => 1 - THREE.MathUtils.smoothstep(Math.abs(u), 0.72, 1.0);
    const blades = [], slots = [];
    for (let k = 0; k < 3; k++) {
      const pos = [], uvs = [], idx = [];
      const spos = [], sidx = [];
      for (let i = 0; i <= NU; i++) {
        const u = (i / NU) * 2 - 1, x = u * W, fu = fade(u);
        const zRear = ZR + k * PITCH + BOW * (1 - u * u);
        for (let j = 0; j <= NC; j++) {
          const c = j / NC, z = zRear + c * CHORD;
          pos.push(...onSkin(z, x, 0.0015 + LIP * fu * c * (2 - c)));
          uvs.push(x, z);
        }
        // The riser under the lip: from the lip down to just below the paint.
        const zF = zRear + CHORD + 0.002;
        spos.push(...onSkin(zF, x, 0.0015 + LIP * fu), ...onSkin(zF, x, -0.004));
      }
      const row = NC + 1;
      for (let i = 0; i < NU; i++) {
        for (let j = 0; j < NC; j++) {
          const a = i * row + j, b = a + row;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
        const a = i * 2, b = a + 2;
        sidx.push(a, a + 1, b, b, a + 1, b + 1);   // the riser faces forward (+z)
      }
      const blade = new THREE.BufferGeometry();
      blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      blade.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      blade.setIndex(idx);
      blade.computeVertexNormals();
      blades.push({ geometry: blade });
      const slot = new THREE.BufferGeometry();
      slot.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3));
      slot.setIndex(sidx);
      slot.computeVertexNormals();
      slots.push({ geometry: boxUV(slot) });
    }
    g.add(mesh(mergeAll(blades), mats.cherryRed, { name: 'bonnet-louvres' }));
    g.add(mesh(mergeAll(slots), mats.satinBlack, { name: 'bonnet-louvre-slots', castShadow: false }));

    // Frunk lid shut line. The lid is the panel every front view of the car is organised
    // around — louvres behind it, headlamps either side, the T just below its leading edge —
    // and the clamshell had no line to say where it was. A 4 mm dark ribbon laid on the skin:
    // rear edge just ahead of the louvres and bowed forward with them, sides along the inner
    // edges of the headlamps, leading edge in a shallow arc above the emblem. The outline is
    // traced from the photographs; the corner radii are approximate.
    const zLR = ZR + 2 * PITCH + CHORD + 0.014, zLF = 1.738, WR = 0.470, WF = 0.385;
    const outline = [];
    const push = (z, x) => outline.push([z, x]);
    for (let i = 0; i <= 24; i++) { const u = -1 + (2 * i) / 24; push(zLR + BOW * (1 - u * u), u * WR); }
    for (let i = 1; i < 12; i++) { const k = i / 12; push(zLR + (zLF - zLR) * k, WR + (WF - WR) * k); }
    for (let i = 0; i <= 24; i++) { const u = 1 - (2 * i) / 24; push(zLF + 0.030 * (1 - u * u), u * WF); }
    for (let i = 1; i < 12; i++) { const k = 1 - i / 12; push(zLR + (zLF - zLR) * k, -(WR + (WF - WR) * k)); }
    // Round the four corners: a few passes of a closed moving average.
    let pts = outline;
    for (let pass = 0; pass < 6; pass++) {
      pts = pts.map((p, i) => {
        const q = pts[(i + pts.length - 1) % pts.length], r = pts[(i + 1) % pts.length];
        return [(q[0] + 2 * p[0] + r[0]) / 4, (q[1] + 2 * p[1] + r[1]) / 4];
      });
    }
    const on = pts.map(([z, x]) => {
      const t = tAtX(z, x), p = bodyPoint(z, t), n = bodyNormal(z, t);
      return { p: new THREE.Vector3(p.x, p.y, p.z), n: new THREE.Vector3(n.x, n.y, n.z) };
    });
    const rpos = [], ridx = [], HALF = 0.002;
    on.forEach(({ p, n }, i) => {
      const nx = on[(i + 1) % on.length].p, pv = on[(i + on.length - 1) % on.length].p;
      const tan = new THREE.Vector3().subVectors(nx, pv).normalize();
      const side = new THREE.Vector3().crossVectors(n, tan).normalize().multiplyScalar(HALF);
      const lift = n.clone().multiplyScalar(0.0009);
      rpos.push(...p.clone().add(lift).add(side).toArray(), ...p.clone().add(lift).sub(side).toArray());
    });
    for (let i = 0; i < on.length; i++) {
      const a0 = i * 2, b0 = ((i + 1) % on.length) * 2;
      ridx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1, a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3));
    ribbon.setIndex(ridx);
    ribbon.computeVertexNormals();
    // Both windings on shared vertices would cancel the normals (see twoSided); the ribbon is
    // lit from above only, so give it the skin's own normal instead.
    const nrm = new Float32Array(rpos.length);
    on.forEach(({ n }, i) => { nrm.set(n.toArray(), i * 6); nrm.set(n.toArray(), i * 6 + 3); });
    ribbon.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.add(mesh(boxUV(ribbon), mats.satinBlack, { name: 'frunk-lid-shutline', castShadow: false }));
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Headlights: the swept teardrop lens, built out of the fender surface
// -----------------------------------------------------------------------------------------
// Corrected against photographs of the car (Wikimedia Commons, 2008 Roadster front and front
// three-quarter). The lamp is NOT two small round lenses sitting on the paint, which is what
// this model carried and what made the nose read as a blob with stickers on it. It is one long
// clear teardrop lens, roughly 0.45 m of it, that starts narrow near the centre of the nose and
// sweeps outward and back over the crown of the front fender, with three round elements in a
// row inside it — a large projector inboard and two smaller units outboard — over a dark
// housing.
//
// Because the lens follows the fender, it is built from the master surface exactly like the
// side intakes: a patch of (z, t) with a teardrop planform, lifted along the surface normal by
// a rise that falls to zero at the rim, so the glass meets the paint flush all the way round.

// A lamp footprint is an affine patch of the (z, t) domain: a point (a, b) in the lamp's own
// frame — a along the lamp, b across it — maps to
//     z = z0 + za*a + zb*b        t = T_CENTRE + s*(t0 + ta*a + tb*b)
// The map is affine, so it inverts, which is what lets the same description both generate the
// lamp geometry and answer "is this vertex inside the opening?" when the panel is swept.
// Sized against the front photographs: each lamp is a long teardrop, its inner-front corner
// beside the frunk lid's front corner and its tail sweeping back and up over the fender crest
// to about a third of the way along the lid — about 0.4 m of lamp. It had been 0.25 m along the
// car and half as tall across it, which read as two small slits in a large nose.
const LAMP_FRONT = {
  z0: 1.900, za: -0.400, zb: 0.0,
  t0: 0.142, ta: 0.085, tb: 0.070,
  shape: (a) => Math.sin(Math.PI * Math.pow(a, 0.55)) * 0.84 + 0.16,
  rise: 0.007, depth: 0.052,
};
// There is no LAMP_REAR here any more. The tail lamps were cut out of the sweep in (z, t)
// while the tail was an end-cap fan; they are now cut out of the tail plane itself, in (x, y),
// by TAIL_LAMP — which is the right frame for a feature that runs across the back of the car
// rather than along it, and the reason the openings finally match their own rims.

/** (a, b) -> a point of the master surface, plus its normal. */
function lampPoint(L, s, a, b) {
  const z = L.z0 + L.za * a + L.zb * b;
  const t = T_CENTRE + s * (L.t0 + L.ta * a + L.tb * b);
  return { z, t, p: bodyPoint(z, t), n: bodyNormal(z, t) };
}

/** True where (z, t) falls inside the lamp opening. `k` scales the aperture across its width. */
function lampContains(L, z, t, k = 1) {
  for (const s of [-1, 1]) {
    const dz = z - L.z0, dt = (t - T_CENTRE) / s - L.t0;
    const det = L.za * L.tb - L.zb * L.ta;
    if (!det) continue;
    const a = (dz * L.tb - L.zb * dt) / det;
    const b = (L.za * dt - dz * L.ta) / det;
    if (a > 0 && a < 1 && Math.abs(b) < L.shape(a) * k) return true;
  }
  return false;
}

/**
 * Both faces of a thin sheet, each on its own vertices. The lamp pockets used to index the two
 * windings onto the SAME vertices, and computeVertexNormals then sums every face normal with
 * its own negative: what is left is rounding noise. The matte black housing behind each
 * headlamp lens lit up as crumpled grey foil — the "wrinkled" look in the headlamp close-up.
 */
function twoSided(geo) {
  geo.computeVertexNormals();
  const n = geo.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name], sz = a.itemSize;
    const arr = new Float32Array(n * 2 * sz);
    arr.set(a.array, 0); arr.set(a.array, n * sz);
    if (name === 'normal') for (let i = n * sz; i < arr.length; i++) arr[i] = -arr[i];
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  const idx = Array.from(geo.index.array), back = [];
  for (let i = 0; i < idx.length; i += 3) back.push(idx[i] + n, idx[i + 2] + n, idx[i + 1] + n);
  out.setIndex([...idx, ...back]);
  return out;
}

/**
 * Grid over a lamp footprint. `off` displaces along the surface normal; `bulge` adds the lens
 * rise, which is zero on the rim so the part sits flush in the bodywork.
 */
function lampPatch(L, s, off, bulge, both = true, Nu = 22, Nv = 10) {
  const pos = new Float32Array((Nu + 1) * (Nv + 1) * 3);
  const uv = new Float32Array((Nu + 1) * (Nv + 1) * 2);
  const idx = [];
  for (let i = 0; i <= Nu; i++) {
    const a = i / Nu;
    for (let j = 0; j <= Nv; j++) {
      const v = j / Nv, w = v * 2 - 1;
      const { p, n } = lampPoint(L, s, a, w * L.shape(a));
      const rise = bulge * Math.sqrt(Math.max(0, (1 - w * w) * Math.sin(Math.PI * a)));
      const d = off + rise;
      const k = (i * (Nv + 1) + j) * 3;
      pos[k] = p.x + n.x * d; pos[k + 1] = p.y + n.y * d; pos[k + 2] = p.z + n.z * d;
      uv[(i * (Nv + 1) + j) * 2] = a; uv[(i * (Nv + 1) + j) * 2 + 1] = v;
    }
  }
  for (let i = 0; i < Nu; i++) {
    for (let j = 0; j < Nv; j++) {
      const a = i * (Nv + 1) + j, b = (i + 1) * (Nv + 1) + j;
      const c = (i + 1) * (Nv + 1) + j + 1, d = i * (Nv + 1) + j + 1;
      // The pocket is seen from the inside as well, so it gets a back face (twoSided, below);
      // the lens must not, or the two coincident transparent faces beat against each other and
      // the glass renders as a scaly mesh.
      if (s < 0) idx.push(a, b, d, b, c, d);
      else idx.push(a, d, b, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return both ? twoSided(geo) : geo;
}

/**
 * The pocket wall and the pressed body-colour rim around one lamp opening. The paint edge is
 * cut on the panel grid and is therefore slightly ragged; the rim is what buries it.
 */
function lampSurround(L, s, mats, out) {
  const N = 48, wallPos = [], wallIdx = [], rim = [];
  for (let i = 0; i <= N; i++) {
    const half = i <= N / 2;
    const a = Math.min(0.9995, Math.max(0.0005, half ? i / (N / 2) : 2 - i / (N / 2)));
    const w = half ? 1 : -1;
    const outer = lampPoint(L, s, a, w * L.shape(a) * 1.12);
    const inner = lampPoint(L, s, a, w * L.shape(a) * 0.94);
    wallPos.push(outer.p.x + outer.n.x * 0.001, outer.p.y + outer.n.y * 0.001, outer.p.z + outer.n.z * 0.001);
    wallPos.push(inner.p.x - inner.n.x * L.depth, inner.p.y - inner.n.y * L.depth, inner.p.z - inner.n.z * L.depth);
    const r = lampPoint(L, s, a, w * L.shape(a) * 1.02);
    rim.push([r.p.x - r.n.x * 0.003, r.p.y - r.n.y * 0.003, r.p.z - r.n.z * 0.003]);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 3, d = i * 2 + 2;
    wallIdx.push(a, b, d, b, c, d);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wall.setIndex(wallIdx);
  wall.computeVertexNormals();
  boxUV(wall);
  out.add(mesh(twoSided(wall), mats.lampHousing, { name: 'lamp-aperture-wall' }));
  out.add(mesh(tube(rim, 0.0090, { tubular: 64, radial: 8, closed: true }), mats.cherryRed, { name: 'lamp-rim' }));
}

/** One round optic seated on the lamp's centreline at parameter a. */
function lampCell(L, s, a, r, mats, cup, lens) {
  const { p, n } = lampPoint(L, s, a, 0);
  const cell = new THREE.Group();
  cell.position.set(p.x - n.x * 0.013, p.y - n.y * 0.013, p.z - n.z * 0.013);
  cell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  cell.add(mesh(lathe([
    { r, y: 0.000 },
    { r: r * 0.80, y: -0.013 },
    { r: r * 0.46, y: -0.024 },
    { r: r * 0.16, y: -0.030 },
    { r: 0, y: -0.031 },
  ], { segments: 24 }), cup, { name: 'lamp-cup' }));
  cell.add(mesh(new THREE.SphereGeometry(r * 0.20, 10, 8), mats.chromeTrim, { position: [0, -0.018, 0] }));
  if (lens) {
    cell.add(mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.86, 0.012, 22), lens, { position: [0, 0.004, 0] }));
  }
  cell.add(mesh(new THREE.TorusGeometry(r, 0.0035, 6, 24), mats.satinBlack, { rotation: [Math.PI / 2, 0, 0] }));
  return cell;
}

function buildHeadlights(mats) {
  const g = new THREE.Group();
  g.name = 'headlights';

  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.name = `headlight-${s < 0 ? 'left' : 'right'}`;

    lampSurround(LAMP_FRONT, s, mats, side);
    side.add(mesh(lampPatch(LAMP_FRONT, s, -LAMP_FRONT.depth, 0.0), mats.lampHousing, { name: 'lamp-housing' }));

    // Three round elements in a row down the lens: projector, secondary, marker.
    side.add(lampCell(LAMP_FRONT, s, 0.28, 0.036, mats, mats.reflectorBowl, null));
    side.add(lampCell(LAMP_FRONT, s, 0.565, 0.031, mats, mats.reflectorBowl, null));
    side.add(lampCell(LAMP_FRONT, s, 0.815, 0.023, mats, mats.amberReflector, null));

    // The lens last, so it reads over the optics.
    side.add(mesh(lampPatch(LAMP_FRONT, s, 0.0015, LAMP_FRONT.rise, false), mats.headlightLens, { name: 'lamp-lens' }));

    // Amber side marker low on the fender flank, flush in its own pocket.
    const it = s < 0 ? T_CENTRE - 0.300 : T_CENTRE + 0.300;
    const ind = bodyPoint(1.560, it), inNrm = bodyNormal(1.560, it);
    const indGeo = new THREE.SphereGeometry(0.046, 18, 9, 0, Math.PI * 2, 0, 0.40);
    indGeo.scale(0.50, 1.0, 1.35);
    const indMesh = mesh(indGeo, mats.amberReflector, { name: 'indicator' });
    indMesh.position.set(ind.x - inNrm.x * 0.020, ind.y - inNrm.y * 0.020, ind.z - inNrm.z * 0.020);
    indMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inNrm);
    side.add(indMesh);

    g.add(side);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Taillights: three round lenses in one housing per side, cut into the tail
// -----------------------------------------------------------------------------------------
// Corrected against photographs (Commons, 2008 Roadster rear and rear three-quarter). What the
// car has is one tilted almond housing per side, wrapping from the tail panel around toward the
// haunch, with three circular lenses in a row inside it: red brake/tail inboard, a large clear
// unit next to it, a smaller clear one outboard. Four chrome rings floating off the tail —
// which is what this was, and they hung outside the bodywork once the car got its real width —
// is a different car. Built with the same aperture machinery as the headlamps, so it is a hole
// in the tail rather than jewellery pinned to it.
function buildTaillights(mats, M) {
  const g = new THREE.Group();
  g.name = 'taillights';
  const SINK = 0.013;            // the housing face sits this far in from the paint
  const _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.name = `taillight-${s < 0 ? 'left' : 'right'}`;
    const outline = tailLampPolygon(s);

    // Wall of the opening: from the paint edge straight in to the housing face.
    {
      const n = outline.length, pos = [], idx = [];
      for (const [x, y] of outline) {
        const z = tailZ(x, y);
        pos.push(x, y, z - 0.001, x, y, z + SINK + 0.004);
      }
      for (let i = 0; i < n; i++) {
        const a = i * 2, b = ((i + 1) % n) * 2;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
      const wall = new THREE.BufferGeometry();
      wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wall.setIndex(idx);
      wall.computeVertexNormals();
      side.add(mesh(twoSided(boxUV(wall)), mats.lampHousing, { name: 'taillight-pocket' }));
    }

    // Housing face: gloss black, the three lamp bores cut through it.
    {
      const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const c of TAIL_CELLS) {
        const hole = new THREE.Path();
        hole.absarc(s * c.x, TAIL_LAMP.y, c.r + 0.006, 0, Math.PI * 2, s < 0);
        shape.holes.push(hole);
      }
      const face = new THREE.ShapeGeometry(shape, 48);
      const p = face.attributes.position, nrm = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        p.setZ(i, tailZ(x, y) + SINK);
        tailNormal(x, y, _n);
        nrm.set([_n.x, _n.y, _n.z], i * 3);
      }
      face.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      // ShapeGeometry faces +z; the tail faces -z.
      const ix = face.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      side.add(mesh(face, mats.lampHousing, { name: 'taillight-housing' }));
    }

    // The lamps: bore, chrome reflector, faceted clear lens, chrome bezel; red centre on the
    // brake lamp. Each is aimed along the surface normal where it sits.
    for (const c of TAIL_CELLS) {
      const x = s * c.x, y = TAIL_LAMP.y, z = tailZ(x, y) + SINK;
      tailNormal(x, y, _n);
      const cell = new THREE.Group();
      cell.name = 'taillight-lamp';
      cell.position.set(x, y, z);
      // Local +z points into the car, along the inward normal.
      cell.quaternion.copy(_q.setFromUnitVectors(_z, _n.clone().negate()));
      const R = c.r + 0.006;
      cell.add(mesh(new THREE.CylinderGeometry(R, R, 0.026, 32, 1, true), mats.lampHousing,
        { rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.013], name: 'lamp-bore' }));
      cell.add(mesh(lathe([
        { r: R, y: 0 }, { r: R * 0.82, y: 0.010 }, { r: R * 0.45, y: 0.019 }, { r: 0, y: 0.022 },
      ], { segments: 32 }), mats.reflectorBowl, { rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.022], name: 'lamp-cup' }));
      cell.add(mesh(new THREE.CircleGeometry(c.r, 40), mats.tailLens,
        { rotation: [0, Math.PI, 0], position: [0, 0, 0.004], name: 'lamp-lens' }));
      if (c.red) {
        cell.add(mesh(new THREE.CircleGeometry(c.r * 0.38, 32), mats.taillightRed,
          { rotation: [0, Math.PI, 0], position: [0, 0, 0.0035], name: 'lamp-red' }));
      }
      cell.add(mesh(new THREE.TorusGeometry(c.r + 0.003, 0.0034, 8, 40), mats.chromeTrim,
        { position: [0, 0, 0.001], name: 'lamp-bezel' }));
      side.add(cell);
    }

    // Red side reflector on the bumper corner just behind the rear wheel arch, leaning with
    // the arch (rear three-quarter photograph; required on US cars). Laid on the flank.
    {
      const at = (z, y) => {
        let best = null, bd = Infinity;
        for (let i = 0; i <= 200; i++) {
          const t = s > 0 ? 0.5 + 0.5 * i / 200 : 0.5 - 0.5 * i / 200;
          const p = bodyPoint(z, t);
          if (p.y > 0.62) continue;
          const d = Math.abs(p.y - y);
          if (d < bd) { bd = d; best = { p, t }; }
        }
        const n = bodyNormal(z, best.t);
        return [best.p.x + n.x * 0.004, best.p.y + n.y * 0.004, best.p.z + n.z * 0.004];
      };
      const path = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        path.push(at(-1.612 - 0.036 * u, 0.352 + 0.118 * u));
      }
      side.add(mesh(tube(path, 0.0105, { tubular: 12, radial: 8 }), mats.taillightRed, { name: 'rear-side-reflector' }));
    }

    g.add(side);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Windshield, Sleek A-Pillars, Ceramic Frit, Rearview Mirror & Targa Roll Hoop
// -----------------------------------------------------------------------------------------
function buildWindshieldAndRollHoop(mats) {
  const g = new THREE.Group();
  g.name = 'windshield-and-roll-hoop';

  // Glass and frame are generated from the same two curves — a base line sitting on the cowl
  // and a header line at the declared 1.128 m — so the surround follows the glass instead of
  // being a separate cage of tubes bolted near it, which is how the old one read.
  // The base sits on the scuttle, which the side photograph puts at about 0.74 m; the header
  // stays on the published 1.128 m, so the glass is taller than it was, as it is on the car.
  // Local to the cabin group (moved by CABIN_DZ): base at +0.78 m and header at +0.29 m on the car.
  const Z_BASE = 0.590, Y_BASE = 0.728, HW_BASE = 0.596;
  const Z_HEAD = 0.100, Y_HEAD = 1.128, HW_HEAD = 0.494;

  const glassPt = (u, v) => {
    const hw = HW_BASE + (HW_HEAD - HW_BASE) * u;
    const bow = 0.052 * Math.sin(Math.PI * u);          // the screen bows forward mid-height
    const wrap = 0.185 * v * v * (0.62 + 0.38 * u);     // and wraps back at the pillars
    return {
      x: v * hw,
      y: Y_BASE + (Y_HEAD - Y_BASE) * u,
      z: Z_BASE + (Z_HEAD - Z_BASE) * u + bow - wrap,
    };
  };

  const NU = 18, NV = 26;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    for (let j = 0; j <= NV; j++) {
      const p = glassPt(i / NU, (j / NV - 0.5) * 2);
      pos.push(p.x, p.y, p.z);
      uv.push(j / NV, i / NU);
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = (i + 1) * (NV + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const glass = new THREE.BufferGeometry();
  glass.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  glass.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  glass.setIndex(idx);
  glass.computeVertexNormals();
  g.add(mesh(glass, mats.windshieldGlass, { name: 'windshield-glass' }));

  // Ceramic frit: a band on the glass's own surface, so it curves with it rather than sitting
  // as five coplanar boxes in front of it.
  const fritPos = [], fritIdx = [];
  const ring = [];
  for (let j = 0; j <= NV; j++) ring.push([1 - 0.055, (j / NV - 0.5) * 2, 1]);          // header band
  for (let j = 0; j <= NV; j++) ring.push([0.075, (j / NV - 0.5) * 2, 1]);              // base band
  let n = 0;
  for (const [uIn, uOut] of [[1, 1 - 0.052], [0.0, 0.062]]) {
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV - 0.5) * 2;
      const a = glassPt(uIn, v), b = glassPt(uOut, v);
      fritPos.push(a.x, a.y, a.z - 0.004 * Math.sign(0.5 - uIn) || a.z - 0.003);
      fritPos.push(b.x, b.y, b.z - 0.003);
    }
    for (let j = 0; j < NV; j++) {
      const k = n + j * 2;
      fritIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    n += (NV + 1) * 2;
  }
  const frit = new THREE.BufferGeometry();
  frit.setAttribute('position', new THREE.Float32BufferAttribute(fritPos, 3));
  frit.setIndex(fritIdx);
  frit.computeVertexNormals();
  boxUV(frit);
  g.add(mesh(frit, mats.satinBlack, { name: 'windshield-ceramic-frit' }));

  // Surround: A-pillars and header traced along the glass edge, slimmer than the 44 mm tubes
  // the old cage used.
  const surround = [];
  for (const side of [-1, 1]) {
    const pil = [];
    for (let i = 0; i <= 8; i++) { const p = glassPt(i / 8, side * 1.0); pil.push([p.x, p.y, p.z]); }
    surround.push({ geometry: tube(pil, 0.0165, { tubular: 20, radial: 10 }) });
  }
  const hdr = [], base = [];
  for (let j = 0; j <= NV; j++) {
    const v = (j / NV - 0.5) * 2;
    const h = glassPt(1, v), b = glassPt(0, v);
    hdr.push([h.x, h.y, h.z]); base.push([b.x, b.y, b.z]);
  }
  surround.push({ geometry: tube(hdr, 0.0155, { tubular: 26, radial: 10 }) });
  surround.push({ geometry: tube(base, 0.013, { tubular: 26, radial: 8 }) });
  g.add(mesh(mergeAll(surround), mats.satinBlack, { name: 'windshield-surround' }));

  // Interior mirror on the header.
  const rvm = new THREE.Group();
  const hm = glassPt(0.94, 0);
  rvm.position.set(0, hm.y - 0.052, hm.z - 0.030);
  rvm.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.040, 8), mats.blackTrim, { rotation: [0.42, 0, 0] }));
  rvm.add(mesh(new THREE.BoxGeometry(0.135, 0.042, 0.014), mats.blackTrim, { position: [0, -0.026, 0.010] }));
  rvm.add(mesh(new THREE.PlaneGeometry(0.125, 0.035), mats.chromeTrim, { position: [0, -0.026, 0.002], rotation: [0, Math.PI, 0] }));
  g.add(rvm);

  // Wiper parked along the base of the glass.
  const wipe = [];
  for (let i = 0; i <= 8; i++) { const p = glassPt(0.045, -0.86 + (i / 8) * 1.06); wipe.push([p.x, p.y, p.z - 0.012]); }
  g.add(mesh(tube(wipe, 0.0065, { tubular: 18, radial: 6 }), mats.blackTrim, { name: 'windshield-wiper' }));

  // The roll hoop: ONE carbon-fibre bar spanning the cockpit behind both seats, flat-topped,
  // with a blade section much deeper fore-and-aft than it is thick, and the high-mounted brake
  // light set into the top of its rear face. That is what every photograph of the car with
  // the roof off shows (show-floor shots from front and rear three-quarter). It was two thin
  // round tubes, one arched over each headrest, which read as a cage bolted behind the seats.
  // Its top sits just under the published 1.128 m, which is the height of the header and bar.
  const HOOP_Z = -0.690, HOOP_Y0 = 0.780, HOOP_TOP = 1.086;
  const HOOP_HW0 = 0.600, HOOP_HW1 = 0.530;     // half-width at the deck and across the top
  const HOOP_A = 0.026, HOOP_B = 0.056;         // half-thickness in the arch plane, half-depth
  {
    const N = 5, ALONG = 44, AROUND = 18;
    const centre = (t) => {
      const c = Math.cos(t), s = Math.sin(t);
      const sy = Math.pow(Math.abs(s), 2 / N);
      const hw = HOOP_HW1 + (HOOP_HW0 - HOOP_HW1) * (1 - sy);
      return [Math.sign(c) * Math.pow(Math.abs(c), 2 / N) * hw, HOOP_Y0 + (HOOP_TOP - HOOP_Y0) * sy];
    };
    const pos = [], uv = [], idx = [];
    const perim = 2 * Math.PI * Math.sqrt((HOOP_A * HOOP_A + HOOP_B * HOOP_B) / 2);
    let arc = 0, prev = null;
    for (let i = 0; i <= ALONG; i++) {
      const t = Math.PI * (i / ALONG);
      const p = centre(t);
      const q0 = centre(Math.max(0, t - 1e-3)), q1 = centre(Math.min(Math.PI, t + 1e-3));
      let tx = q1[0] - q0[0], ty = q1[1] - q0[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty, ny = tx;                   // in the arch plane, perpendicular to the bar
      if (prev) arc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
      for (let j = 0; j <= AROUND; j++) {
        const th = (j / AROUND) * Math.PI * 2;
        const ca = Math.cos(th) * HOOP_A, sb = Math.sin(th) * HOOP_B;
        pos.push(p[0] + nx * ca, p[1] + ny * ca, HOOP_Z + sb);
        uv.push(arc, (j / AROUND) * perim);
      }
    }
    const row = AROUND + 1;
    for (let i = 0; i < ALONG; i++) {
      for (let j = 0; j < AROUND; j++) {
        const a = i * row + j, b = a + row;
        idx.push(a, a + 1, b, b, a + 1, b + 1);     // outward: along × around
      }
    }
    const hoop = new THREE.BufferGeometry();
    hoop.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hoop.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hoop.setIndex(idx);
    hoop.computeVertexNormals();
    g.add(mesh(hoop, mats.carbonFiber, { name: 'roll-hoop' }));
  }

  // High-mounted brake light: a strip let into the top of the hoop's rear face.
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.016, 0.010), mats.taillightRed, {
    position: [0, HOOP_TOP - 0.004, HOOP_Z - HOOP_B + 0.003], name: 'chmsl-brake-light',
  }));

  // Bulkhead panel closing the space behind the seats.
  g.add(mesh(new THREE.BoxGeometry(0.94, 0.30, 0.035), mats.satinBlack, {
    position: [0, 0.700, -0.690], name: 'rear-bulkhead-panel',
  }));

  return g;
}
// -----------------------------------------------------------------------------------------
//  Double Wishbone Suspension, Ventilated Disc Brakes & Forged Alloy Wheels
// -----------------------------------------------------------------------------------------
function buildWheels(mats, M) {
  const g = new THREE.Group();
  g.name = 'wheels';

  const { wheelbase, trackFront, trackRear, wheelRadiusFront, wheelRadiusRear } = ROADSTER_SPECS;
  const wheelConfigs = [
    { name: 'wheel-fl', x: -trackFront / 2, y: wheelRadiusFront, z: wheelbase / 2, r: wheelRadiusFront, w: 0.18 },
    { name: 'wheel-fr', x: trackFront / 2, y: wheelRadiusFront, z: wheelbase / 2, r: wheelRadiusFront, w: 0.18 },
    { name: 'wheel-rl', x: -trackRear / 2, y: wheelRadiusRear, z: -wheelbase / 2, r: wheelRadiusRear, w: 0.23 },
    { name: 'wheel-rr', x: trackRear / 2, y: wheelRadiusRear, z: -wheelbase / 2, r: wheelRadiusRear, w: 0.23 },
  ];

  for (const wc of wheelConfigs) {
    const wGroup = new THREE.Group();
    wGroup.name = wc.name;
    wGroup.position.set(wc.x, wc.y, wc.z);

    const isLeft = wc.x < 0;

    // 1. Double Wishbone Suspension behind wheel
    const susp = [];
    const inboardX = isLeft ? 0.24 : -0.24;
    susp.push({
      geometry: tube([[0, 0.10, 0], [inboardX, 0.14, 0.12], [inboardX, 0.14, -0.12], [0, 0.10, 0]], 0.014, { tubular: 16, radial: 6 }),
    });
    susp.push({
      geometry: tube([[0, -0.12, 0], [inboardX, -0.10, 0.14], [inboardX, -0.10, -0.14], [0, -0.12, 0]], 0.016, { tubular: 16, radial: 6 }),
    });
    susp.push({
      geometry: tube([[0, 0.0, 0.12], [inboardX, 0.02, 0.14]], 0.012, { tubular: 8, radial: 6 }),
    });
    susp.push({
      geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.26, 12),
      matrix: mat4([inboardX * 0.45, 0.05, 0], [0, 0, isLeft ? -0.35 : 0.35]),
    });
    wGroup.add(mesh(mergeAll(susp), mats.aluminium, { name: 'suspension-wishbones' }));

    // 2. Tyre. The previous profile duplicated a point and jumped from the inner shoulder
    // straight to the outer bead, so it had no tread band at all and lathed into a cone —
    // which is why the wheels read as flat black discs. This one runs bead to bead: inner
    // bead, sidewall, shoulder, tread across the full section width, then back out.
    // Front 175/55 R16, rear 225/45 R17.
    const rimRadius = wc.r * (wc.w > 0.20 ? 0.665 : 0.700); // 17" rear, 16" front
    const hw = wc.w / 2;
    // Tread band with three circumferential grooves cut into it. A normal map alone leaves the
    // tyre reading as a smooth black torus as soon as the camera is inside a metre of it, which
    // is exactly where the wheel-and-arch view puts it.
    const tread = [];
    const bandEdge = hw * 0.745;
    const grooves = [-0.44, 0.0, 0.44].map(f => f * bandEdge);
    let cursor = -bandEdge;
    for (const gcz of grooves) {
      const gw = wc.w * 0.030, gd = wc.r * 0.021;
      tread.push({ r: wc.r, y: cursor });
      tread.push({ r: wc.r, y: gcz - gw });
      tread.push({ r: wc.r - gd, y: gcz - gw * 0.55 });
      tread.push({ r: wc.r - gd, y: gcz + gw * 0.55 });
      tread.push({ r: wc.r, y: gcz + gw });
      cursor = gcz + gw;
    }
    tread.push({ r: wc.r, y: bandEdge });
    const tyreProfile = [
      { r: rimRadius, y: -hw },
      { r: rimRadius * 1.02, y: -hw * 1.02 },       // bead seat
      { r: rimRadius * 1.14, y: -hw * 1.045 },      // bead heel
      { r: wc.r * 0.88, y: -hw * 1.05 },            // sidewall bulge
      { r: wc.r * 0.968, y: -hw * 0.93 },           // shoulder
      ...tread,
      { r: wc.r * 0.968, y: hw * 0.93 },
      { r: wc.r * 0.88, y: hw * 1.05 },
      { r: rimRadius * 1.14, y: hw * 1.045 },
      { r: rimRadius * 1.02, y: hw * 1.02 },
      { r: rimRadius, y: hw },
    ];
    const tyreGeo = lathe(tyreProfile, { segments: 64 });
    tyreGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(tyreGeo, mats.tyreRubber, { name: 'tyre' }));

    // 3. Forged alloy wheel. The Demo car wore machined silver forged wheels, not a chrome
    // barrel: chrome is left for the lug nuts.
    const barrel = lathe([
      { r: rimRadius * 0.98, y: -hw * 0.98 },
      { r: rimRadius * 0.90, y: -hw * 0.62 },
      { r: rimRadius * 0.90, y: hw * 0.30 },
      { r: rimRadius * 0.99, y: hw * 0.86 },
      { r: rimRadius, y: hw * 0.98 },
    ], { segments: 40 });
    barrel.rotateZ(Math.PI / 2);
    wGroup.add(mesh(barrel, mats.forgedAlloy, { name: 'rim-barrel' }));

    const faceX = isLeft ? -hw * 0.86 : hw * 0.86;
    const dir = isLeft ? -1 : 1;
    const spokeParts = [];
    // Seven spokes, tapering from the hub and meeting the rim flange rather than stopping a
    // few millimetres short of it, which left a visible ring of daylight at wheel distance.
    for (let sp = 0; sp < 7; sp++) {
      const ang = (sp / 7) * Math.PI * 2;
      const shape = new THREE.Shape();
      const rOut = rimRadius * 1.005, wHub = 0.030, wMid = 0.019, wTip = 0.026;
      shape.moveTo(-wHub, 0.044);
      shape.bezierCurveTo(-wHub, rOut * 0.34, -wMid, rOut * 0.52, -wMid, rOut * 0.70);
      shape.lineTo(-wTip, rOut * 0.965);
      // The tip follows the rim flange instead of cutting a chord across it, which is what
      // left a sliver of daylight between every spoke and the barrel.
      for (let q = 0; q <= 6; q++) {
        const a = Math.atan2(-wTip, rOut) + (q / 6) * (Math.atan2(wTip, rOut) - Math.atan2(-wTip, rOut));
        shape.lineTo(Math.sin(a) * rOut, Math.cos(a) * rOut);
      }
      shape.lineTo(wTip, rOut * 0.965);
      shape.lineTo(wMid, rOut * 0.70);
      shape.bezierCurveTo(wMid, rOut * 0.52, wHub, rOut * 0.34, wHub, 0.044);
      shape.closePath();
      const sg = new THREE.ExtrudeGeometry(shape, {
        depth: 0.020, bevelEnabled: true, bevelSize: 0.0032, bevelThickness: 0.0032,
        bevelSegments: 2, curveSegments: 8,
      });
      sg.translate(0, 0, -0.010);
      sg.rotateZ(ang);
      sg.rotateY(Math.PI / 2);
      spokeParts.push({ geometry: sg, matrix: mat4([faceX, 0, 0]) });
    }
    // Outer rim flange: gives the spokes something to land on and reads as the wheel lip.
    const flange = lathe([
      { r: rimRadius * 0.965, y: hw * 0.80 },
      { r: rimRadius * 1.005, y: hw * 0.88 },
      { r: rimRadius * 1.005, y: hw * 0.97 },
      { r: rimRadius * 0.945, y: hw * 0.99 },
    ], { segments: 44 });
    flange.rotateZ(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    spokeParts.push({ geometry: flange });
    // Hub face and centre bore.
    const hub = lathe([
      { r: 0.064, y: 0 },
      { r: 0.062, y: 0.014 },
      { r: 0.042, y: 0.026 },
      { r: 0.026, y: 0.029 },
      { r: 0.026, y: 0.006 },
    ], { segments: 26 });
    hub.rotateZ(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    spokeParts.push({ geometry: hub, matrix: mat4([faceX + dir * 0.006, 0, 0]) });
    wGroup.add(mesh(mergeAll(spokeParts), mats.forgedAlloy, { name: 'spokes' }));

    // Six chrome lug nuts recessed in the hub face.
    const lugs = [];
    for (let l = 0; l < 6; l++) {
      const lang = (l / 6) * Math.PI * 2;
      lugs.push({
        geometry: new THREE.CylinderGeometry(0.0085, 0.0085, 0.014, 6),
        matrix: mat4([faceX + dir * 0.028, Math.sin(lang) * 0.044, Math.cos(lang) * 0.044], [0, 0, Math.PI / 2]),
      });
    }
    wGroup.add(mesh(mergeAll(lugs), mats.chromeTrim, { name: 'lug-nuts' }));

    // Valve stem through the rim flange.
    wGroup.add(mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.026, 8), mats.satinBlack, {
      position: [faceX - dir * 0.010, rimRadius * 0.74, rimRadius * 0.30],
      rotation: [0, 0, Math.PI / 2], name: 'valve-stem',
    }));

    // 4. Ventilated Disc Brake Rotor with Central Mounting Hat
    const discRadius = rimRadius * 0.78;
    const rotorGeo = lathe([
      { r: discRadius * 0.46, y: -0.009 },
      { r: discRadius * 0.985, y: -0.009 },
      { r: discRadius, y: -0.005 },
      { r: discRadius, y: 0.005 },
      { r: discRadius * 0.985, y: 0.009 },
      { r: discRadius * 0.46, y: 0.009 },
    ], { segments: 40 });
    rotorGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rotorGeo, mats.brakeRotor, { position: [isLeft ? -wc.w * 0.12 : wc.w * 0.12, 0, 0] }));

    // Rotor central aluminum hat
    const hatGeo = new THREE.CylinderGeometry(discRadius * 0.45, discRadius * 0.45, 0.022, 16);
    hatGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(hatGeo, mats.satinBlack, { position: [isLeft ? -wc.w * 0.13 : wc.w * 0.13, 0, 0] }));

    // Sculpted Brembo Monobloc Brake Caliper (Mounted at upper rear quadrant of rotor)
    const caliperGroup = new THREE.Group();
    caliperGroup.name = 'brake-caliper';
    const calX = isLeft ? -wc.w * 0.12 : wc.w * 0.12;
    const calAngle = -0.42;
    caliperGroup.position.set(calX, discRadius * 0.68, -discRadius * 0.42);
    caliperGroup.rotation.set(calAngle, 0, 0);

    // Sculpted curved caliper bridge body
    const calBody = new THREE.BoxGeometry(0.042, 0.052, 0.118);
    caliperGroup.add(mesh(calBody, mats.brakeCaliper));

    // Dual piston cylindrical bosses on outer face
    for (const pz of [-0.028, 0.028]) {
      caliperGroup.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 14), mats.brakeCaliper, {
        position: [isLeft ? -0.023 : 0.023, 0, pz],
        rotation: [0, 0, Math.PI / 2],
      }));
    }
    // Stainless pad retaining spring clip on outer bridge
    caliperGroup.add(mesh(new THREE.BoxGeometry(0.020, 0.008, 0.06), mats.chromeTrim, {
      position: [0, 0.028, 0],
    }));
    // Bleeder fitting on top
    caliperGroup.add(mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.012, 8), mats.chromeTrim, {
      position: [0, 0.032, -0.02],
    }));

    wGroup.add(caliperGroup);

    g.add(wGroup);
  }

  return g;
}

/**
 * Lotus/Tesla composite bucket seat. Rebuilt from lathed and lofted sections: the old one was
 * eight boxes, and at the cockpit camera distances the exhibit authors views for, a box reads
 * as a box. Same discipline as Dragon — few pieces, library materials, real curvature.
 */
function seatSection(w, d, bolster, round) {
  // A rounded rectangle in the XZ plane, used as the cross-section of both cushion and back.
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const p = 1 / round;
    const x = Math.sign(c) * Math.pow(Math.abs(c), p) * (w / 2 + bolster * Math.pow(Math.abs(s), 2));
    const z = Math.sign(s) * Math.pow(Math.abs(s), p) * (d / 2);
    pts.push([x, z]);
  }
  return pts;
}

function loft(sections, close = true) {
  // Metric UVs, like the body sweep: accumulated arc length across the section and along the
  // loft. The shell is carbon and the cushion is grained leather, and both were sampling a
  // zero-filled placeholder — a constant vUv, which is the flat-shaded failure the integrity
  // check exists to catch and which it could not see while it only asked whether the attribute
  // existed at all.
  const n = sections[0].pts.length, pos = [], uv = [], idx = [];
  let vAcc = 0;
  let prev = null;
  for (const sec of sections) {
    const row = [];
    let uAcc = 0;
    for (let j = 0; j < sec.pts.length; j++) {
      const [x, z] = sec.pts[j];
      const p = [x * sec.scale, sec.y, z * sec.scale + sec.z];
      if (j > 0) uAcc += Math.hypot(p[0] - row[j - 1][0], p[1] - row[j - 1][1], p[2] - row[j - 1][2]);
      row.push(p);
      pos.push(p[0], p[1], p[2]);
      uv.push(uAcc, 0);
    }
    if (prev) {
      let d = 0;
      for (let j = 0; j < n; j++) d = Math.max(d, Math.hypot(row[j][0] - prev[j][0], row[j][1] - prev[j][1], row[j][2] - prev[j][2]));
      vAcc += d;
    }
    for (let j = 0; j < n; j++) uv[(uv.length / 2 - n + j) * 2 + 1] = vAcc;
    prev = row;
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = (i + 1) * n + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (close) {
    // The caps get their OWN vertices with a planar projection, instead of fanning over the
    // ring's side-wall vertices. Reusing those gave every triangle in a cap the same v — the
    // ring's accumulated distance along the loft — so all three corners sat on one line in UV
    // space and the triangle had zero area there. Fifty-two faces per seat, on the leather and
    // on the carbon shell, sampling a single texel: flat, and invisible to a check that only
    // asked whether the attribute as a whole varied.
    for (const [ring, flip] of [[0, true], [sections.length - 1, false]]) {
      const src = ring * n;
      const base = pos.length / 3;
      for (let j = 0; j < n; j++) {
        const x = pos[(src + j) * 3], y = pos[(src + j) * 3 + 1], z = pos[(src + j) * 3 + 2];
        pos.push(x, y, z);
        uv.push(x, z);                    // metres, like every other cap in the project
      }
      for (let j = 1; j < n - 2; j++) {
        if (flip) idx.push(base, base + j + 1, base + j);
        else idx.push(base, base + j, base + j + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildBucketSeat(s, mats) {
  const seat = new THREE.Group();
  seat.name = `seat-${s < 0 ? 'driver' : 'passenger'}`;
  seat.position.set(s * 0.34, 0, 0);

  // Cushion: a squab that swells at the bolsters and tapers at the front edge.
  const cushion = seatSection(0.30, 0.40, 0.045, 2.4);
  seat.add(mesh(loft([
    { pts: cushion, y: 0.182, z: -0.20, scale: 0.90 },
    { pts: cushion, y: 0.212, z: -0.20, scale: 1.00 },
    { pts: cushion, y: 0.248, z: -0.20, scale: 0.985 },
    { pts: cushion, y: 0.268, z: -0.21, scale: 0.90 },
    { pts: cushion, y: 0.276, z: -0.22, scale: 0.66 },
  ]), mats.blackTrim, { name: 'seat-cushion' }));

  // Backrest, reclined, narrowing into the headrest with the bolsters wrapping the torso.
  const back = seatSection(0.27, 0.115, 0.052, 2.2);
  const tilt = 0.34, zb = -0.415, yb = 0.255;
  const rung = (t, w, dz) => ({
    pts: back, scale: w,
    y: yb + t * Math.cos(tilt), z: zb - t * Math.sin(tilt) + dz,
  });
  seat.add(mesh(loft([
    rung(0.00, 0.94, 0), rung(0.07, 1.02, 0), rung(0.17, 1.045, 0), rung(0.30, 1.015, 0),
    rung(0.40, 0.955, 0), rung(0.475, 0.865, 0.002), rung(0.535, 0.770, 0.005),
    rung(0.585, 0.724, 0.006), rung(0.640, 0.740, 0.004), rung(0.700, 0.760, 0.001),
    rung(0.748, 0.700, -0.003), rung(0.778, 0.520, -0.007),
  ]), mats.blackTrim, { name: 'seat-back' }));

  // Composite shell behind it, following the same section a little larger.
  seat.add(mesh(loft([
    rung(-0.02, 1.10, -0.030), rung(0.24, 1.16, -0.034), rung(0.50, 1.02, -0.034),
    rung(0.66, 0.90, -0.030), rung(0.78, 0.66, -0.024),
  ]), mats.carbonFiber, { name: 'seat-shell' }));

  // Harness pass-throughs in the shoulder of the backrest.
  for (const hx of [-0.052, 0.052]) {
    const y = yb + 0.545 * Math.cos(tilt), z = zb - 0.545 * Math.sin(tilt);
    const slot = new THREE.TorusGeometry(0.020, 0.005, 8, 18);
    slot.scale(0.85, 1.35, 1.0);
    seat.add(mesh(slot, mats.satinBlack, { position: [hx, y, z + 0.055], rotation: [-tilt, 0, 0] }));
  }

  return seat;
}
/**
 * Dashboard. Was a full-width box with a second box under it and a half-cylinder binnacle
 * stuck on the front. At the cockpit camera distances this exhibit authors views for, a box
 * reads as a box, so it is swept instead: one section curled from the cowl edge over the top
 * pad and down the face, carried across the car, with the driver's binnacle as a local swell
 * in the same surface rather than a separate part.
 */
function buildDashSurface(mats) {
  const HALF = 0.545, NX = 46;
  // Section in (z, y) offsets from the station's top edge, cowl -> top pad -> face -> underside.
  const SEC = [
    [0.455, 0.000], [0.398, 0.006], [0.336, 0.001], [0.298, -0.022],
    [0.283, -0.062], [0.284, -0.118], [0.296, -0.166], [0.336, -0.202],
  ];
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NX; i++) {
    const x = -HALF + (2 * HALF) * (i / NX);
    // Rises toward the doors, and swells over the driver's instrument binnacle.
    const rise = 0.026 * Math.pow(Math.abs(x) / HALF, 1.6);
    const dz = (x - -0.34) / 0.185;
    const binnacle = Math.exp(-dz * dz) * 0.052;
    const yTop = 0.706 + rise + binnacle;
    for (let j = 0; j < SEC.length; j++) {
      const [z0, dy] = SEC[j];
      // The binnacle also pulls the pad forward, which is what makes it a hood over the dials.
      const fwd = binnacle * (j >= 1 && j <= 4 ? 0.62 : 0.1);
      pos.push(x, yTop + dy, z0 - fwd);
      uv.push(j / (SEC.length - 1), (x + HALF) / (2 * HALF));
    }
  }
  const N = SEC.length;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < N - 1; j++) {
      const a = i * N + j, b = (i + 1) * N + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mats.blackTrim, { name: 'dashboard' });
}

/** Speedometer and power-meter faces: one texture, two dials, rather than blank discs. */
function makeDialTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#0d0f12'; x.fillRect(0, 0, 512, 256);
  for (const [cx, major, label] of [[128, 20, 'km/h'], [384, 10, 'kW']]) {
    x.strokeStyle = '#c8cdd6'; x.fillStyle = '#c8cdd6';
    x.lineWidth = 2;
    for (let i = 0; i <= major * 2; i++) {
      const a = Math.PI * 0.75 + (i / (major * 2)) * Math.PI * 1.5;
      const big = i % 2 === 0;
      const r0 = big ? 76 : 84, r1 = 96;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
      x.lineTo(cx + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
      x.lineWidth = big ? 3 : 1.5;
      x.stroke();
    }
    x.font = '600 20px system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillText(label, cx, 176);
    // Needle, parked.
    x.strokeStyle = '#d8452f'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(cx, 128);
    x.lineTo(cx + Math.cos(Math.PI * 0.75) * 78, 128 + Math.sin(Math.PI * 0.75) * 78);
    x.stroke();
    x.fillStyle = '#2a2e35';
    x.beginPath(); x.arc(cx, 128, 9, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// -----------------------------------------------------------------------------------------
//  Cockpit Interior: Sculpted Dashboard, Waterfall Console & Easter Eggs
// -----------------------------------------------------------------------------------------
function buildInterior(mats, M, texDontPanic, texPcb) {
  const g = new THREE.Group();
  g.name = 'interior';

  // Driver foot pedals (accelerator, brake, dead pedal)
  for (const [px, pw, ph] of [[-0.42, 0.045, 0.08], [-0.34, 0.055, 0.08], [-0.26, 0.038, 0.12]]) {
    g.add(mesh(new THREE.BoxGeometry(pw, ph, 0.015), mats.chromeTrim, {
      position: [px, 0.23, 0.35],
      rotation: [-0.45, 0, 0],
    }));
  }

  // Lotus Elise / Tesla Roadster Sport Bucket Seats
  g.add(buildBucketSeat(-1, mats)); // Driver seat
  g.add(buildBucketSeat(1, mats));  // Passenger seat

  // 3-Point Seatbelt for Starman (Driver side)
  const beltPts = [
    [-0.48, 0.88, -0.62], // B-pillar / roll hoop anchor
    [-0.34, 0.65, -0.22], // Chest crossing
    [-0.18, 0.32, -0.24], // Center buckle
  ];
  g.add(mesh(tube(beltPts, 0.015, { tubular: 16, radial: 6 }), mats.satinBlack, { name: 'starman-seatbelt' }));
  g.add(mesh(new THREE.BoxGeometry(0.035, 0.05, 0.02), mats.chromeTrim, { position: [-0.18, 0.32, -0.24] }));

  // ---------------------------------------------------------------------------------------
  //  SCULPTED AUTOMOTIVE DASHBOARD & WATERFALL CENTER CONSOLE
  // ---------------------------------------------------------------------------------------
  const dashGroup = new THREE.Group();
  dashGroup.name = 'dashboard-assembly';

  dashGroup.add(buildDashSurface(mats));

  // Speedometer and power meter, set into the binnacle the dash surface swells to form.
  const dialTex = makeDialTexture();
  for (const [i, gx] of [[0, -0.404], [1, -0.276]]) {
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.010, 20), mats.satinBlack, {
      position: [gx, 0.734, 0.286], rotation: [-0.42, 0, 0],
    }));
    const face = new THREE.PlaneGeometry(0.070, 0.070);
    const faceMat = new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.42, metalness: 0.1 });
    // Each dial takes its own half of the shared texture.
    const uvA = face.attributes.uv;
    for (let k = 0; k < uvA.count; k++) uvA.setX(k, uvA.getX(k) * 0.5 + i * 0.5);
    uvA.needsUpdate = true;
    dashGroup.add(mesh(face, faceMat, {
      position: [gx, 0.734 + 0.0045 * Math.cos(0.42), 0.286 + 0.0045 * Math.sin(0.42) + 0.004],
      rotation: [-0.42, 0, 0], name: `dial-${i}`,
    }));
    dashGroup.add(mesh(new THREE.TorusGeometry(0.041, 0.0035, 8, 22), mats.chromeTrim, {
      position: [gx, 0.734, 0.290], rotation: [Math.PI / 2 - 0.42, 0, 0],
    }));
  }

  // Eyeball vents. A solid chrome face blew out to a flat white disc against the sky, which
  // is what the Don't Panic view was showing; a dark bore behind a thin bezel reads as a vent.
  for (const vx of [-0.475, -0.150, 0.150, 0.475]) {
    const p = [vx, 0.688, 0.318], r = [-0.42, 0, 0];
    dashGroup.add(mesh(new THREE.TorusGeometry(0.025, 0.0035, 8, 22), mats.chromeTrim, {
      position: p, rotation: [Math.PI / 2 - 0.42, 0, 0],
    }));
    // Recessed bore, with the vane inside it.
    const bore = lathe([
      { r: 0.025, y: 0 }, { r: 0.024, y: -0.010 }, { r: 0.018, y: -0.026 }, { r: 0, y: -0.030 },
    ], { segments: 20 });
    bore.rotateX(Math.PI / 2 - 0.42);
    dashGroup.add(mesh(bore, mats.satinBlack, { position: p }));
    dashGroup.add(mesh(new THREE.SphereGeometry(0.021, 16, 10), mats.blackTrim, {
      position: [vx, 0.688 - 0.010, 0.318 - 0.006], rotation: r,
    }));
    dashGroup.add(mesh(new THREE.BoxGeometry(0.036, 0.0025, 0.020), mats.satinBlack, {
      position: [vx, 0.688 - 0.006, 0.318 - 0.002], rotation: r,
    }));
  }

  // 2. WATERFALL CENTER CONSOLE (Flows behind display down to floor tunnel)
  const consoleGroup = new THREE.Group();
  consoleGroup.name = 'waterfall-center-console';

  // The console is one continuous surface running from behind the screen down to the tunnel —
  // the "waterfall" the car is known for — swept from a rounded section rather than assembled
  // from three boxes at different angles, which is what the Don't Panic view was showing.
  {
    const spine = [
      [0.560, 0.372, 0.135, 0.052],  // y, z, halfWidth, cornerRadius-ish
      [0.500, 0.352, 0.132, 0.050],
      [0.430, 0.318, 0.126, 0.048],
      [0.360, 0.268, 0.118, 0.046],
      [0.300, 0.198, 0.108, 0.046],
      [0.258, 0.104, 0.098, 0.048],
      [0.234, -0.010, 0.092, 0.050],
      [0.226, -0.180, 0.090, 0.052],
      [0.222, -0.360, 0.090, 0.052],
      [0.216, -0.520, 0.086, 0.050],
    ];
    const N = 22, pos = [], uv = [], idx = [];
    for (let i = 0; i < spine.length; i++) {
      const [y, z, hw, r] = spine[i];
      for (let j = 0; j <= N; j++) {
        const ang = -Math.PI / 2 + (j / N) * Math.PI;   // across the top, door to door
        const c = Math.cos(ang), sn = Math.sin(ang);
        pos.push(Math.sign(sn) * Math.pow(Math.abs(sn), 0.62) * hw, y + c * r * 0.55 - r * 0.55, z);
        uv.push(j / N, i / (spine.length - 1));
      }
    }
    for (let i = 0; i < spine.length - 1; i++) {
      for (let j = 0; j < N; j++) {
        const p0 = i * (N + 1) + j, p1 = (i + 1) * (N + 1) + j;
        idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    consoleGroup.add(mesh(geo, mats.blackTrim, { name: 'centre-console' }));
  }

  // Push-button gear selectors on the slope.
  for (let b = 0; b < 4; b++) {
    consoleGroup.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.007, 14), mats.chromeTrim, {
      position: [(b - 1.5) * 0.030, 0.352 - b * 0.001, 0.256 - b * 0.002],
      rotation: [-0.78, 0, 0],
    }));
  }

  // Handbrake lever on tunnel
  const handbrake = tube([
    [-0.05, 0.24, -0.06],
    [-0.05, 0.31, 0.04],
  ], 0.010, { tubular: 8, radial: 6 });
  consoleGroup.add(mesh(handbrake, mats.satinBlack));
  consoleGroup.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.015, 8), mats.chromeTrim, {
    position: [-0.05, 0.315, 0.045],
    rotation: [0.8, 0, 0],
  }));

  dashGroup.add(consoleGroup);
  g.add(dashGroup);

  // 3. Momo 3-Spoke Sport Steering Wheel
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'steering-wheel';
  wheelGroup.position.set(-0.34, 0.69, 0.16);
  wheelGroup.rotation.set(-0.45, 0, 0);

  // Outer thick leather rim
  wheelGroup.add(mesh(new THREE.TorusGeometry(0.155, 0.015, 12, 32), mats.blackTrim));
  // Center horn boss with red Tesla medallion
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 16), mats.cherryRed, { rotation: [Math.PI / 2, 0, 0] }));

  // 3 Spokes with drilled lightening holes
  for (const ang of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
    wheelGroup.add(mesh(new THREE.BoxGeometry(0.12, 0.020, 0.008), mats.chromeTrim, {
      position: [Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0],
      rotation: [0, 0, ang],
    }));
  }
  // Steering column and stalks
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 12), mats.blackTrim, {
    position: [0, 0, 0.10],
    rotation: [Math.PI / 2, 0, 0],
  }));
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), mats.blackTrim, {
    position: [-0.08, 0.04, 0.06],
    rotation: [0, 0, 1.2],
  }));
  g.add(wheelGroup);

  // ---- Easter Egg 1: "DON'T PANIC!" Center Screen ---------------------------------------
  // Set into the centre console stack, facing the driver.
  const screenUnit = new THREE.Group();
  screenUnit.name = 'screen-dont-panic';
  screenUnit.position.set(0.0, 0.585, 0.262);
  // Yaw first, then pitch about the screen's OWN x axis. With Three's default XYZ order the
  // pitch is applied in the world frame after the yaw, which rolls the panel — that is why the
  // DON'T PANIC text ran diagonally across the screen instead of sitting level on it.
  screenUnit.rotation.order = 'YXZ';
  screenUnit.rotation.set(-0.33, Math.PI - 0.18, 0.0);

  // Touchscreen display panel with "DON'T PANIC!" texture (facing the camera!)
  const screenPanel = mesh(new THREE.PlaneGeometry(0.186, 0.104), new THREE.MeshBasicMaterial({
    map: texDontPanic,
    side: THREE.FrontSide,
  }), {
    position: [0, 0, 0.007],
  });
  screenUnit.add(screenPanel);

  // Housing behind the glass, and a raised bezel around it so the display is set into the
  // console rather than stuck on the front of it.
  screenUnit.add(mesh(new THREE.BoxGeometry(0.196, 0.114, 0.012), mats.satinBlack, {
    position: [0, 0, 0.000],
  }));
  const bezel = [];
  for (const [w, h, dx, dy] of [[0.216, 0.010, 0, 0.062], [0.216, 0.010, 0, -0.062],
    [0.010, 0.134, -0.103, 0], [0.010, 0.134, 0.103, 0]]) {
    bezel.push({ geometry: new THREE.BoxGeometry(w, h, 0.016), matrix: mat4([dx, dy, 0.004]) });
  }
  screenUnit.add(mesh(mergeAll(bezel), mats.carbonFiber, { name: 'screen-bezel' }));

  g.add(screenUnit);

  // ---- Easter Egg 2: 1:64 Scale Hot Wheels Roadster on Dashboard Pad ---------------------
  const hwGroup = new THREE.Group();
  hwGroup.name = 'hot-wheels-easter-egg';
  // Sitting ON the pad: buildDashSurface puts its top edge at 0.706 + a rise toward the doors,
  // and the model's tyres hang 10 mm below its own origin.
  hwGroup.position.set(0.156, 0.7195, 0.352);
  hwGroup.rotation.order = 'YXZ';
  hwGroup.rotation.set(-0.06, 0.26, 0);

  // Miniature sports car body
  const hwBody = new THREE.BoxGeometry(0.034, 0.013, 0.072);
  hwGroup.add(mesh(hwBody, mats.cherryRed));
  // Tiny windshield
  const hwGlass = new THREE.BoxGeometry(0.028, 0.009, 0.020);
  hwGroup.add(mesh(hwGlass, mats.windshieldGlass, { position: [0, 0.009, 0.006], rotation: [-0.4, 0, 0] }));
  // 4 Micro chrome wheels
  for (const hx of [-0.018, 0.018]) for (const hz of [-0.022, 0.022]) {
    hwGroup.add(mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.004, 8), mats.chromeTrim, {
      position: [hx, -0.004, hz],
      rotation: [0, 0, Math.PI / 2],
    }));
  }
  // Micro-Starman figure in driver seat
  hwGroup.add(mesh(new THREE.SphereGeometry(0.0044, 8, 8), mats.starmanSuitWhite, { position: [-0.006, 0.011, -0.004] }));
  g.add(hwGroup);

  // ---- Easter Egg 3: Arch Mission 5D Optical Quartz Disc ---------------------------------
  const disc = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.006, 24), mats.quartzDisc, {
    position: [0.32, 0.36, -0.15],
    rotation: [0, 0.35, 0],
    name: 'arch-5d-foundation-disc',
  });
  g.add(disc);

  // ---- Easter Egg 4: "Made on Earth by humans" Circuit Board -----------------------------
  // The engraving is documented; where the board sits on the car is not. It used to be laid
  // at z = 1.15, which is inside the frunk under a closed bonnet — nothing could see it, while
  // a callout in mid-air announced it. Put on the console tunnel between the seats instead,
  // where the open cockpit actually shows it. Its size is not published either; 16 × 8 cm is a
  // plausible board and is listed with the other approximations on the sheet.
  const pcbMesh = mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({
    map: texPcb,
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
  }), {
    position: [0.0, 0.2295, -0.30],
    rotation: [-Math.PI / 2, 0, 0],
    name: 'pcb-made-on-earth',
  });
  g.add(pcbMesh);

  return g;
}

// -----------------------------------------------------------------------------------------
//  Starman Mannequin: Authentic SpaceX IVA Flight Spacesuit & Unified Aerodynamic Helmet
// -----------------------------------------------------------------------------------------
/**
 * Starman. The pose was already right — left arm on the door sill, right hand on the Momo
 * rim, head turned toward the door camera — but the anatomy was cylinders and spheres placed
 * independently, so the shoulders and elbows never met and it read as a snowman. This builds
 * every limb from a joint chain instead: a sphere at each joint and a tapered segment between
 * consecutive joints, so the solids intersect by construction whatever the pose.
 */
function limbChain(joints, radii, material, name) {
  const parts = [];
  const v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  for (let i = 0; i < joints.length; i++) {
    parts.push({
      geometry: new THREE.SphereGeometry(radii[i], 14, 10),
      matrix: mat4(joints[i]),
    });
    if (i === joints.length - 1) break;
    const a = new THREE.Vector3(...joints[i]), b = new THREE.Vector3(...joints[i + 1]);
    v.subVectors(b, a);
    const len = v.length();
    const seg = new THREE.CylinderGeometry(radii[i + 1], radii[i], len, 14, 1, true);
    q.setFromUnitVectors(up, v.clone().normalize());
    const m = new THREE.Matrix4().compose(a.clone().addScaledVector(v, 0.5), q, new THREE.Vector3(1, 1, 1));
    seg.applyMatrix4(m);
    parts.push({ geometry: seg });
  }
  return mesh(mergeAll(parts), material, { name });
}

function gloveFingers(origin, dir, material, name) {
  const o = new THREE.Vector3(...origin);
  const d = new THREE.Vector3(...dir);
  if (d.lengthSq() < 1e-8) d.set(0, 0, 1);
  d.normalize();
  const side = Math.abs(d.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(-d.z, 0, d.x).normalize();
  const up = new THREE.Vector3().crossVectors(side, d).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 0.014;
    const len = i === 0 ? 0.042 : 0.055;
    const root = o.clone().addScaledVector(side, spread).addScaledVector(up, i === 3 ? -0.01 : 0.004);
    parts.push({
      geometry: new THREE.CylinderGeometry(0.007, 0.009, len, 6),
      matrix: new THREE.Matrix4().compose(root.clone().addScaledVector(d, len * 0.5), q, new THREE.Vector3(1, 1, 1)),
    });
  }
  return mesh(mergeAll(parts), material, { name });
}

function buildStarman(mats) {
  const g = new THREE.Group();
  g.name = 'starman';

  const { starmanSuitWhite, starmanSuitGraphite, starmanVisor, blackTrim } = mats;
  const X = -0.34; // driver seat centreline

  // Door sill the left forearm rests on, taken from the body surface rather than guessed, so
  // the arm stays on the car if the body profile is ever retuned.
  const sillMid = bodyPoint(-0.06, T_SHOULDER_L);
  const sillFwd = bodyPoint(0.20, T_SHOULDER_L);
  const armX = sillMid.x * 0.93;

  // Torso: a lathe shell with real shoulders and a waist, reclined into the seat.
  const torso = new THREE.Group();
  torso.position.set(X, 0.50, -0.30);
  torso.rotation.set(-0.30, 0.06, 0);
  const torsoGeo = lathe([
    { r: 0.128, y: -0.20 },   // hips
    { r: 0.140, y: -0.10 },
    { r: 0.132, y: 0.02 },    // waist
    { r: 0.158, y: 0.16 },    // chest
    { r: 0.170, y: 0.26 },    // shoulders
    { r: 0.140, y: 0.325 },
    { r: 0.086, y: 0.35 },    // neck root
  ], { segments: 26 });
  torsoGeo.scale(1.0, 1, 0.70);
  torso.add(mesh(torsoGeo, starmanSuitWhite, { name: 'suit-torso' }));
  // The suit's graphite shoulder yoke and side articulation panels.
  const yokeGeo = lathe([
    { r: 0.170, y: 0.205 },
    { r: 0.176, y: 0.255 },
    { r: 0.150, y: 0.312 },
  ], { segments: 26 });
  yokeGeo.scale(1.0, 1, 0.70);
  torso.add(mesh(yokeGeo, starmanSuitGraphite, { name: 'suit-yoke' }));
  torso.add(mesh(new THREE.TorusGeometry(0.090, 0.011, 10, 24), starmanSuitGraphite, {
    position: [0, 0.352, 0], rotation: [Math.PI / 2, 0, 0], name: 'suit-neck-ring',
  }));
  g.add(torso);

  // Arms. Shoulder -> elbow -> wrist, with the gloves as their own smaller chain.
  g.add(limbChain(
    [[X - 0.155, 0.735, -0.395], [armX - 0.010, 0.756, -0.235], [armX, 0.745, sillFwd.z - 0.10]],
    [0.048, 0.040, 0.034], starmanSuitWhite, 'left-arm-door-sill',
  ));
  g.add(limbChain(
    [[armX, 0.745, sillFwd.z - 0.10], [armX + 0.006, 0.727, sillFwd.z + 0.02]],
    [0.043, 0.038], starmanSuitGraphite, 'left-glove',
  ));
  g.add(gloveFingers([armX + 0.006, 0.727, sillFwd.z + 0.02], [0.01, -0.15, 1], starmanSuitGraphite, 'left-fingers'));

  g.add(limbChain(
    [[X + 0.155, 0.735, -0.395], [X + 0.155, 0.585, -0.185], [X + 0.028, 0.700, 0.100]],
    [0.048, 0.040, 0.034], starmanSuitWhite, 'right-arm-steering',
  ));
  g.add(limbChain(
    [[X + 0.028, 0.700, 0.100], [X - 0.010, 0.716, 0.146]],
    [0.042, 0.036], starmanSuitGraphite, 'right-glove',
  ));
  g.add(gloveFingers([X - 0.010, 0.716, 0.146], [-0.15, 0.05, 0.85], starmanSuitGraphite, 'right-fingers'));
  // Shoulder and lap belts. They leave the yoke and meet the seat, so the
  // torso is buckled in rather than posed above it.
  g.add(mesh(mergeAll([
    { geometry: tube([[X - 0.10, 0.78, -0.34], [X - 0.04, 0.58, -0.22], [X + 0.02, 0.44, -0.26]], 0.011, { tubular: 10, radial: 5 }) },
    { geometry: tube([[X + 0.10, 0.78, -0.36], [X + 0.02, 0.56, -0.24], [X - 0.02, 0.43, -0.28]], 0.011, { tubular: 10, radial: 5 }) },
    { geometry: tube([[X - 0.12, 0.46, -0.22], [X, 0.42, -0.16], [X + 0.12, 0.46, -0.22]], 0.012, { tubular: 8, radial: 5 }) },
  ]), blackTrim, { name: 'seat-belts' }));

  // Legs, folded into the footwell toward the pedals.
  for (const s of [-1, 1]) {
    const lx = X + s * 0.105;
    g.add(limbChain(
      [[lx, 0.430, -0.300], [lx + s * 0.012, 0.452, 0.075], [lx - s * 0.006, 0.268, 0.290]],
      [0.064, 0.052, 0.042], starmanSuitWhite, `leg-${s < 0 ? 'left' : 'right'}`,
    ));
    // Flight boot.
    const boot = new THREE.SphereGeometry(0.062, 14, 10);
    boot.scale(0.78, 0.62, 1.65);
    g.add(mesh(boot, blackTrim, { position: [lx - s * 0.008, 0.238, 0.360], rotation: [0.22, 0, 0] }));
  }

  // SpaceX IVA helmet: one lathed shell from crown to neck ring, not a sphere plus a cylinder
  // plus a chin box. The visor is a single spherical cap laid over the front of that shell,
  // which is what the (heavily photographed) real helmet looks like.
  const head = new THREE.Group();
  head.name = 'spacex-helmet';
  head.position.set(X, 0.925, -0.335);
  head.rotation.set(0.04, -0.46, -0.03); // turned toward the door camera, as in the flight photos
  const shell = lathe([
    { r: 0.000, y: 0.148 },
    { r: 0.052, y: 0.142 },
    { r: 0.096, y: 0.118 },
    { r: 0.124, y: 0.070 },
    { r: 0.132, y: 0.010 },   // widest, at the brow line
    { r: 0.128, y: -0.048 },
    { r: 0.112, y: -0.092 },  // jaw
    { r: 0.092, y: -0.118 },
    { r: 0.083, y: -0.140 },  // neck
  ], { segments: 32 });
  shell.scale(0.94, 1, 1.02);
  head.add(mesh(shell, starmanSuitWhite, { name: 'helmet-shell' }));

  // Visor: a cap of a larger sphere, so it sits proud of the shell the way a real one does.
  // A SpaceX IVA visor covers most of the front of the helmet, brow to chin. The previous
  // 71-degree arc only reached the equator, so it read as a small dark patch on a white egg.
  const visorR = 0.166;
  const visor = new THREE.SphereGeometry(visorR, 34, 22, Math.PI * 0.5 - 1.02, 2.04, 0.58, 1.16);
  visor.scale(1, 0.90, 0.80);
  head.add(mesh(visor, starmanVisor, { position: [0, 0.020, 0.030], name: 'helmet-visor' }));

  // Gasket around the visor aperture, traced on the visor's own surface so it sits flush.
  const gasket = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const th = 0.58 + 1.16 * (0.5 + 0.5 * Math.cos(a));
    const ph = Math.PI * 0.5 + 1.02 * Math.sin(a);
    gasket.push([
      -visorR * Math.sin(th) * Math.cos(ph),
      visorR * Math.cos(th) * 0.90 + 0.020,
      visorR * Math.sin(th) * Math.sin(ph) * 0.80 + 0.030,
    ]);
  }
  head.add(mesh(tube(gasket, 0.005, { tubular: 44, radial: 6, closed: true }), blackTrim, {
    name: 'helmet-visor-gasket',
  }));

  // Neck lock ring joining helmet to suit.
  head.add(mesh(new THREE.TorusGeometry(0.086, 0.013, 10, 26), starmanSuitGraphite, {
    position: [0, -0.146, 0], rotation: [Math.PI / 2, 0, 0], name: 'helmet-neck-ring',
  }));

  g.add(head);

  // PLSS backpack and the suit umbilical into the seat. The photographed suit
  // carries both; a torso with neither reads as a mannequin in coveralls.
  const pack = new THREE.Group();
  pack.name = 'starman-plss';
  pack.position.set(X, 0.62, -0.48);
  pack.rotation.x = -0.30;
  pack.add(mesh(new THREE.BoxGeometry(0.28, 0.34, 0.12), starmanSuitWhite, { name: 'plss-shell' }));
  pack.add(mesh(new THREE.BoxGeometry(0.22, 0.08, 0.04), starmanSuitGraphite, { position: [0, 0.08, 0.07], name: 'plss-hatch' }));
  pack.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), blackTrim, {
    position: [0.1, -0.05, 0.12], rotation: [0.8, 0, 0], name: 'suit-umbilical',
  }));
  g.add(pack);

  return g;
}
// -----------------------------------------------------------------------------------------
//  Falcon Heavy Payload Adapter & Selfie Camera Booms
// -----------------------------------------------------------------------------------------
function buildPayloadAdapter(mats, M) {
  const g = new THREE.Group();
  g.name = 'payload-adapter';

  const carbon = mats.carbonFiber;
  const metal = mats.forgedAlloy;

  // 1. Conical Payload Attach Fitting (PAF) Ring Structure
  const pafCone = [];
  pafCone.push({
    geometry: new THREE.CylinderGeometry(0.78, 1.25, 0.65, 32, 1, true),
    matrix: mat4([0, -0.22, 0]),
  });
  pafCone.push({
    geometry: new THREE.TorusGeometry(0.78, 0.04, 8, 32),
    matrix: mat4([0, 0.10, 0], [Math.PI / 2, 0, 0]),
  });
  pafCone.push({
    geometry: new THREE.TorusGeometry(1.25, 0.055, 8, 32),
    matrix: mat4([0, -0.54, 0], [Math.PI / 2, 0, 0]),
  });
  g.add(mesh(mergeAll(pafCone), carbon, { name: 'paf-cone' }));

  // 2. Tubular Carbon-Fiber Support Truss Struts
  const struts = [];
  const corners = [
    [-0.65, 0.16, 1.15],
    [0.65, 0.16, 1.15],
    [-0.68, 0.16, -1.15],
    [0.68, 0.16, -1.15],
  ];
  for (const [cx, cy, cz] of corners) {
    struts.push({
      geometry: tube([[cx, cy, cz], [cx * 0.65, -0.15, cz * 0.55], [cx * 0.45, -0.48, cz * 0.35]], 0.038, { tubular: 16, radial: 8 }),
    });
  }
  g.add(mesh(mergeAll(struts), metal, { name: 'chassis-support-struts' }));

  // 3. Three Carbon-Fiber Selfie Camera Booms
  const booms = [];

  // (A) Front Selfie Boom: pointing at Starman
  const frontBoomPts = [
    [0.25, 0.22, 1.85],
    [0.45, 0.45, 2.45],
    [0.55, 0.85, 3.10],
  ];
  booms.push({ geometry: tube(frontBoomPts, 0.024, { tubular: 24, radial: 8 }) });

  const camA = new THREE.Group();
  camA.name = 'selfie-cam-front';
  camA.position.set(0.55, 0.85, 3.10);
  camA.lookAt(-0.34, 0.90, -0.2);
  camA.add(mesh(new THREE.BoxGeometry(0.10, 0.08, 0.14), carbon));
  camA.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16), mats.chromeTrim, { position: [0, 0, 0.08], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camA);

  // (B) Right Lateral Selfie Boom
  const sideBoomPts = [
    [0.82, 0.35, -0.20],
    [1.35, 0.65, -0.10],
    [1.75, 1.05, 0.15],
  ];
  booms.push({ geometry: tube(sideBoomPts, 0.022, { tubular: 24, radial: 8 }) });

  const camB = new THREE.Group();
  camB.name = 'selfie-cam-side';
  camB.position.set(1.75, 1.05, 0.15);
  camB.lookAt(-0.20, 0.75, 0.0);
  camB.add(mesh(new THREE.BoxGeometry(0.09, 0.08, 0.12), carbon));
  camB.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 16), mats.chromeTrim, { position: [0, 0, 0.07], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camB);

  // (C) Rear Over-the-Shoulder Boom
  const rearBoomPts = [
    [-0.25, 0.85, -1.25],
    [-0.38, 1.15, -1.65],
    [-0.45, 1.35, -2.10],
  ];
  booms.push({ geometry: tube(rearBoomPts, 0.020, { tubular: 20, radial: 8 }) });

  const camC = new THREE.Group();
  camC.name = 'selfie-cam-rear';
  camC.position.set(-0.45, 1.35, -2.10);
  camC.lookAt(-0.34, 0.85, 0.8);
  camC.add(mesh(new THREE.BoxGeometry(0.09, 0.07, 0.12), carbon));
  camC.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16), mats.chromeTrim, { position: [0, 0, 0.07], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camC);

  g.add(mesh(mergeAll(booms), carbon, { name: 'camera-boom-tubes' }));

  return g;
}

// =========================================================================================
//  Main Builder Export
// =========================================================================================
export function buildRoadster(M) {
  const root = new THREE.Group();
  root.name = 'roadster';

  const texDontPanic = makeDontPanicTexture();
  const texPcb = makePcbTexture();
  const mats = createRoadsterMaterials(M);

  // Exterior
  const bodyShell = buildBodyShell(mats, M);
  const headlights = buildHeadlights(mats);
  const taillights = buildTaillights(mats, M);
  const glassAndHoop = buildWindshieldAndRollHoop(mats);

  // Mechanicals, Cockpit & Occupant
  const wheels = buildWheels(mats, M);
  const interior = buildInterior(mats, M, texDontPanic, texPcb);
  const starman = buildStarman(mats);
  const adapter = buildPayloadAdapter(mats, M);

  bodyShell.add(headlights);
  bodyShell.add(taillights);
  bodyShell.add(glassAndHoop);

  // The cabin builders work in their own frame; the body's door cut is already at Z_COWL/Z_BULK.
  glassAndHoop.position.z += CABIN_DZ;
  interior.position.z += CABIN_DZ;
  starman.position.z += CABIN_DZ;

  root.add(bodyShell);
  root.add(wheels);
  root.add(interior);
  root.add(starman);

  // ---- Level of detail ------------------------------------------------------------------
  // This exhibit is 247 meshes and 219,000 triangles on a 3.9 m car, and in the overview it
  // is eight pixels tall — the stitched seats, the Hot Wheels model on the dash, the circuit
  // board on the console and Starman's gloves were all being drawn in full at 300 m. Nothing
  // is simplified: whole assemblies stop being drawn once the detail they exist for has
  // stopped resolving, and `lodFeature` is the size of the smallest thing each one carries,
  // so the same threshold applies here as on a Dragon window frame or a Starship tile.
  //
  // The body, the wheels and the glass are NOT in this list. They are the car's silhouette
  // and have to be drawn at every distance the car is drawn at all.
  interior.userData.lodFeature = 0.035;     // stitching, switchgear, the easter eggs
  starman.userData.lodFeature = 0.05;       // glove seams, helmet fittings
  interior.name = 'roadster-interior';
  starman.name = 'roadster-starman';

  // The rest of the car, by the size of the smallest thing each part carries.
  //
  // Retiring the interior and the occupant was the easy half and left the hard half in place:
  // in the overview this car is eight pixels tall and was still drawing both headlight bowls
  // with their reflector cups and retaining rims, both taillight pockets, the wiper, the
  // ceramic frit band, the arch lips, the splitter, the diffuser strakes and its mesh, the
  // belly pan, two subframe crossmembers, the battery cooling strake, and on each of the four
  // wheels a double wishbone, a vented rotor, a caliper, five lug nuts and a valve stem.
  //
  // WHAT IS DELIBERATELY NOT HERE: the painted body, the four tyres, the rims and their
  // spokes, the glass, the lamp lenses and the roll hoops. Those are the car's silhouette and
  // its colour — the things that make eight pixels read as a red Roadster rather than a red
  // smudge — and they are drawn whenever the car is drawn at all.
  //
  // Each figure is a measurement of that assembly, not a tuning knob: it is the smallest
  // feature the assembly exists to show, and the manager turns it into a distance.
  const FINE = {
    // Lamp internals. Visible through the covers up close; at range the lens is the lamp.
    'lamp-cup': 0.015, 'lamp-housing': 0.015, 'lamp-aperture-wall': 0.015, 'lamp-rim': 0.012,
    'taillight-pocket': 0.015, 'lamp-bore': 0.015, 'lamp-bezel': 0.012, 'rear-side-reflector': 0.012,
    'chmsl-brake-light': 0.012,
    // Surface trim and apertures: none of it changes the outline, all of it is centimetres.
    'wheel-arch-lips': 0.02, 'nose-crease': 0.018,
    'bonnet-louvres': 0.02, 'bonnet-louvre-slots': 0.02, 'frunk-lid-shutline': 0.01, 'front-splitter': 0.025, 'front-grille': 0.015,
    'front-corner-intake': 0.02, 'front-mouth-plenum': 0.03, 'rear-cooling-port': 0.015,
    'rear-diffuser-lip': 0.02, 'rear-diffuser-mesh': 0.012,
    'rear-bulkhead-panel': 0.025, 'battery-cooling-strake': 0.02,
    'windshield-wiper': 0.015, 'windshield-ceramic-frit': 0.02, 'windshield-surround': 0.02,
    // Underbody: not visible at all except from the one preset that goes looking for it.
    'underbody-belly-pan': 0.04, 'front-subframe-crossmember': 0.03,
    'rear-subframe-crossmember': 0.03, 'chassis-support-struts': 0.03,
    // Wheel hardware. The brakes sit behind the spokes, so they cannot resolve before the
    // spokes do; the spokes themselves stay, because a rim with no spokes reads as a disc.
    'suspension-wishbones': 0.03, 'lug-nuts': 0.012, 'valve-stem': 0.01,
    'wheel-well-liners': 0.05,
  };
  let marked = 0;
  root.traverse((o) => {
    const f = FINE[o.name];
    if (f && !o.userData.lodFeature) { o.userData.lodFeature = f; marked++; }
  });
  // The brake rotor and its hat are built unnamed, one pair per wheel, and sit inside the rim.
  for (const w of ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr']) {
    const g = root.getObjectByName(w);
    for (const c of g?.children ?? []) {
      if (!c.name && c.isMesh) { c.userData.lodFeature = 0.02; c.name = `${w}-brake`; marked++; }
    }
  }
  root.userData.lodMarked = marked;

  // The exhibit was carrying two metaphors at once: a museum plinth AND the payload adapter
  // hanging under it with the three selfie booms. It is one or the other depending on the
  // view, so the flight hardware lives in its own group and only appears in the orbital
  // preset, where the plinth goes away instead.
  adapter.visible = false;
  root.add(adapter);
  root.userData.setOrbital = (on) => { adapter.visible = !!on; };

  // Hull metadata for verification measuring
  // Matches HULLS.roadster in verify.js
  root.userData.height = ROADSTER_SPECS.height;
  root.userData.footprint = ROADSTER_SPECS.length;
  root.userData.length = ROADSTER_SPECS.length;
  root.userData.width = ROADSTER_SPECS.width;

  root.userData.parts = {
    body: bodyShell,
    wheels,
    interior,
    starman,
    adapter,
  };

  // Callouts are tagged by the range they make sense at. Eight of them on a 3,9 m car buries
  // the car; the near set only appears in the cockpit views and the flight-hardware set only
  // in the orbital one.
  root.userData.annotations = [
    { label: 'Tesla Roadster (1st generation) · continuous-surface body', position: [0.86, 0.62, 0.55] },
    { label: 'Swept teardrop headlamp · three round optics per side', position: [0.52, 0.72, 1.60], scope: 'near' },
    { label: 'Starman · mannequin in a SpaceX IVA suit', position: [-0.34, 1.12, -0.34 + CABIN_DZ] },
    { label: "«DON'T PANIC!» · dashboard screen", position: [0.02, 0.66, 0.30 + CABIN_DZ], scope: 'near' },
    { label: '1:64 Hot Wheels model with a micro-Starman', position: [0.16, 0.76, 0.30 + CABIN_DZ], scope: 'near' },
    { label: '«Made on Earth by humans» · circuit board', position: [0.0, 0.30, -0.30 + CABIN_DZ], scope: 'near' },
    { label: 'Arch Mission 5D archive · the Foundation trilogy', position: [0.34, 0.44, -0.16 + CABIN_DZ], scope: 'near' },
    { label: 'Falcon Heavy payload attach fitting (PAF)', position: [0.0, -0.30, 0.0], scope: 'orbital' },
    { label: 'Selfie camera on a carbon-fibre boom', position: [0.55, 0.95, 3.10], scope: 'orbital' },
  ];

  return root;
}
