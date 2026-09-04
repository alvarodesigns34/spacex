/**
 * Tesla Roadster — Starman.
 *
 * PROVENANCE & HISTORICAL SPECIFICATIONS:
 *  - Vehicle: Original First-Generation Tesla Roadster (2008 / 2.5 Sport edition),
 *    personal car of Elon Musk, launched as mass simulator payload on the maiden flight
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
import { mesh, mergeAll, mat4, tube, lathe, curve } from '../geometry/utils.js';
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
// fixes (length 3.946, width 1.728, height 1.128, wheelbase 2.352, tracks 1.455 / 1.490);
// everything between those is read off side, plan and three-quarter photographs of the Falcon
// Heavy Demo car and is approximate, as the exhibit copy says.

// The bumper caps roll forward of the last swept station, so the stations sit back from the
// declared extremes by exactly the cap depth and the finished car measures 3.946 m.
const CAP_NOSE = 0.070, CAP_TAIL = 0.052;
const Z_NOSE = 1.973 - CAP_NOSE;   // last swept station at the front
const Z_TAIL = -1.973 + CAP_TAIL;  // last swept station at the rear
const Z_AXLE_F = 1.176;
const Z_AXLE_R = -1.176;
const Z_COWL = 0.46;       // windscreen base — front edge of the door cut
const Z_BULK = -0.72;      // rear bulkhead — back edge of the door cut
const SHUT = 0.005;        // panel shut-line gap, 5 mm

// Section parameter landmarks. The full-width section is a 13-point centripetal Catmull-Rom,
// so control point i sits exactly at t = i/12 and panels split on those values with no seam.
const T_SILL_L = 0, T_SHOULDER_L = 4 / 12, T_CENTRE = 6 / 12, T_SHOULDER_R = 8 / 12, T_SILL_R = 1;

// Half-width. Widest at the rear haunch (0.864 -> 1.728 m overall). The ends keep most of
// their width and round their corners in plan, which is what a bumper does; collapsing the
// half-width to zero would make a boat prow, not a car.
const halfWidth = curve([
  [-1.973, 0.720], [-1.850, 0.800], [-1.650, 0.878], [-1.400, 0.918],
  [-1.176, 0.926], [-1.000, 0.916], [-0.720, 0.888], [-0.400, 0.868],
  [0.000, 0.858], [0.460, 0.872], [0.900, 0.898], [1.176, 0.912],
  [1.400, 0.895], [1.600, 0.845], [1.780, 0.755], [1.900, 0.660], [1.973, 0.560],
]);

// Beltline: the highest point of the bodywork at each station, reached at the shoulder. The
// windscreen header, built separately, is what sets the declared 1.128 m overall height.
// Read off the side elevation: this car's body top is close to level from the front fender
// crown to the rear haunch, and only falls away in the last half-metre at each end. The
// earlier tables dropped it to 0.55 at the tail and 0.51 at the nose, which is why both ends
// melted downwards instead of ending in a leading edge and a Kamm cut-off.
const yBelt = curve([
  [-1.973, 0.742], [-1.850, 0.826], [-1.650, 0.892], [-1.400, 0.918],
  [-1.176, 0.922], [-1.000, 0.912], [-0.720, 0.888], [-0.400, 0.874],
  [0.000, 0.872], [0.460, 0.888], [0.900, 0.894], [1.176, 0.896],
  [1.400, 0.874], [1.600, 0.836], [1.780, 0.744], [1.900, 0.648], [1.973, 0.572],
]);

// Centreline crown: the bonnet and deck at x = 0. It runs a few centimetres below the belt,
// which is what gives the clamshell its raised fender crowns without turning the bonnet into
// a valley — on the real car the difference across the bonnet is 3-4 cm, not the 17 cm the
// previous table carried.
const yCrown = curve([
  [-1.973, 0.734], [-1.850, 0.820], [-1.650, 0.884], [-1.400, 0.906],
  [-1.176, 0.906], [-1.000, 0.896], [-0.720, 0.868], [-0.400, 0.846],
  [0.000, 0.840], [0.460, 0.876], [0.900, 0.868], [1.176, 0.862],
  [1.400, 0.846], [1.600, 0.812], [1.780, 0.722], [1.900, 0.628], [1.973, 0.552],
]);

// Rocker: the bottom edge of the visible body side, before the wheel arches cut into it.
// The published ground clearance is 0.130 m at the floor; the visible sill edge sits above it
// and lifts at both ends where the bumpers undercut.
const ySillBase = curve([
  [-1.973, 0.262], [-1.700, 0.205], [-1.176, 0.172], [-0.400, 0.152],
  [0.400, 0.150], [1.176, 0.158], [1.600, 0.166], [1.860, 0.200], [1.973, 0.248],
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
  const half = [
    [0.905, ys],                       // sill / arch edge
    [0.962, ys + drop * 0.11],         // tuck-under
    [1.000, yb - drop * 0.56],         // maximum half-width
    [0.955, yb - drop * 0.26],         // flank
    [0.780, yb - drop * 0.02],         // shoulder / character line
    [0.430, yc + (yb - yc) * 0.70],    // crown shoulder
  ];
  const pts = [];
  for (const [fx, y] of half) pts.push(new THREE.Vector3(-fx * W, y, z));
  pts.push(new THREE.Vector3(0, yc, z));
  for (let i = half.length - 1; i >= 0; i--) pts.push(new THREE.Vector3(half[i][0] * W, half[i][1], z));
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  _sectionCache.z = z; _sectionCache.curve = c;
  return c;
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
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
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
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
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
  tex.anisotropy = 4;
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
  tex.anisotropy = 4;
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
  const cherryRed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x6f121e),
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

  // One transmissive surface on the whole car. Mixing opacity with transmission is what left
  // the old windscreen looking like a milky slab; transmission alone, front-facing, refracts.
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

  const taillightRed = new THREE.MeshPhysicalMaterial({
    color: 0xb4030f, metalness: 0.0, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.03,
    transmission: 0.30, ior: 1.55, thickness: 0.02, emissive: 0x2c0206,
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

  const grilleMesh = new THREE.MeshStandardMaterial({
    map: makeGrilleTexture(), color: 0x121418, roughness: 0.88, metalness: 0.20, side: THREE.DoubleSide,
  });

  // The Falcon's procedural carbon weave is already built at startup; the Roadster's seats,
  // PAF and booms are carbon, so they should use it rather than a flat grey stand-in.
  const carbonFiber = M.carbon || new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.36, metalness: 0.3 });
  const aluminium = M.aluminum || forgedAlloy;

  return {
    cherryRed, blackTrim, satinBlack, carbonFiber, chromeTrim, forgedAlloy, aluminium, reflectorBowl, lampHousing,
    tyreRubber, brakeRotor, brakeCaliper, amberReflector, windshieldGlass, headlightLens, taillightRed,
    starmanSuitWhite, starmanSuitGraphite, starmanVisor, quartzDisc, grilleMesh,
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
      for (let d = 0.100; d <= 0.300; d += 0.0035) set.add(T_CENTRE + s2 * d);
    }
    return [...set].sort((a, b) => a - b);
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
  const zFront = denser(stations(Z_COWL + SHUT / 2, Z_NOSE, 52), LAMP_FRONT.z0 + 0.02, LAMP_FRONT.z0 + LAMP_FRONT.za - 0.02, 0.005);
  const zRear = denser(stations(Z_TAIL, Z_BULK - SHUT / 2, 52), LAMP_REAR.z0 - 0.06, LAMP_REAR.z0 + 0.06, 0.005);
  const zDoor = stations(Z_BULK + SHUT / 2, Z_COWL - SHUT / 2, 22);

  const panels = [
    { geometry: sweep(zFront, tFront, false, (z, t) => lampContains(LAMP_FRONT, z, t, 1.02)) },
    { geometry: sweep(zRear, tRear, false, (z, t) => lampContains(LAMP_REAR, z, t, 1.02)) },
    { geometry: sweep(zDoor, tDoorL) },
    { geometry: sweep(zDoor, tDoorR) },
    // Bumper faces. The nose rolls deep, the tail is a Kamm cut-off with a tight radius.
    // Both are wound the same way: the tail was passing flip=true and rendering inside-out,
    // which at the old 30 mm cap depth was a sliver nobody could see and at a realistic depth
    // is a hole straight through the back of the car.
    { geometry: endCap(ringAt(Z_NOSE, tFront), 1, CAP_NOSE, 0.66, 4) },
    { geometry: endCap(ringAt(Z_TAIL, tRear), -1, CAP_TAIL, 0.86, 3, false) },
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
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(lip.length * 4), 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
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
  // Kept inside the wheelbase: at 3.88 m it reached past the bumpers and, because the rocker
  // line lifts to 0.33 m at each end, showed in side elevation as a slab hanging under the nose
  // and the tail.
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

  // Front cooling mouth. The old splitter and grille were authored against the previous nose
  // and, once the bumper stopped tapering to a point, hung in front of it as a black frame.
  // Rebuilt as a real opening in the fascia: a dark plenum behind a body-colour lip, with the
  // radiator matrix visible through it.
  {
    const zM = 1.945, yM = 0.322, wM = 0.492, hM = 0.058;
    const mouth = [];
    for (let i = 0; i <= 40; i++) {
      const ang = (i / 40) * Math.PI * 2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      // A wide, flat-cornered slot rather than an ellipse.
      mouth.push([
        Math.sign(c) * Math.pow(Math.abs(c), 0.55) * wM,
        yM + Math.sign(sn) * Math.pow(Math.abs(sn), 0.7) * hM,
        zM - Math.pow(Math.abs(c), 2) * 0.030,
      ]);
    }
    g.add(mesh(tube(mouth, 0.011, { tubular: 46, radial: 8, closed: true }), mats.cherryRed, {
      name: 'front-mouth-lip',
    }));
    g.add(mesh(new THREE.BoxGeometry(wM * 2 - 0.02, hM * 2 - 0.014, 0.10), mats.satinBlack, {
      position: [0, yM, zM - 0.075], name: 'front-mouth-plenum',
    }));
    g.add(mesh(new THREE.BoxGeometry(wM * 2 - 0.05, hM * 2 - 0.03, 0.018), mats.grilleMesh, {
      position: [0, yM, zM - 0.040], name: 'front-grille',
    }));
    g.add(mesh(new THREE.BoxGeometry(wM * 2 - 0.07, hM * 2 - 0.05, 0.016), mats.lampHousing, {
      position: [0, yM, zM - 0.070], name: 'radiator-core',
    }));
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

  // Rear underbody tray, tucked under the tail rather than hanging below it.
  {
    const parts = [{ geometry: new THREE.BoxGeometry(1.10, 0.062, 0.30), matrix: mat4([0, 0.246, -1.796]) }];
    for (const sx of [-0.42, -0.14, 0.14, 0.42]) {
      parts.push({ geometry: new THREE.BoxGeometry(0.014, 0.070, 0.28), matrix: mat4([sx * 0.80, 0.258, -1.796]) });
    }
    g.add(mesh(mergeAll(parts), mats.satinBlack, { name: 'rear-diffuser' }));
  }

  // The Demo car flew without plates, so the tail carries the empty recess and nothing else:
  // a black cavity is the faithful answer, an invented California plate is not. Bedded on the
  // tail surface rather than at a hardcoded height, which left it hanging off the old panel.
  {
    const p0 = bodyPoint(Z_TAIL + 0.030, T_CENTRE), n0 = bodyNormal(Z_TAIL + 0.030, T_CENTRE);
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.115, 0.022), mats.satinBlack, {
      position: [0, p0.y - 0.128, p0.z + n0.z * 0.004 - 0.010],
      name: 'rear-plate-recess',
    }));
  }

  // Dual lower rear cooling exhaust ports
  for (const s of [-0.34, 0.34]) {
    g.add(mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.026, 18), mats.satinBlack, {
      position: [s, 0.400, Z_TAIL - CAP_TAIL + 0.010],
      rotation: [Math.PI / 2, 0, 0],
      name: 'rear-cooling-port',
    }));
  }

  // ---------------------------------------------------------------------------------------
  //  AERODYNAMIC EXTERIOR MIRRORS (Sculpted organic teardrop shells on swept stems)
  // ---------------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    // Mirrors are mounted off the door skin, so take the root off the body surface instead of
    // the hardcoded coordinates the old body used — they left the housings floating in space
    // once the flank moved. Overall width with mirrors is the declared 1,873 m.
    const mt = side < 0 ? T_SHOULDER_L - 0.024 : T_SHOULDER_R + 0.024;
    const root = bodyPoint(0.325, mt);
    const armX = side * (ROADSTER_SPECS.widthMirrors / 2 - 0.048);
    const mirrorStem = tube([
      [root.x, root.y, root.z],
      [root.x + (armX - root.x) * 0.55, root.y + 0.016, root.z + 0.006],
      [armX, root.y + 0.022, root.z + 0.010],
    ], 0.012, { tubular: 16, radial: 8 });
    g.add(mesh(mirrorStem, mats.satinBlack));

    const mirrorHousing = new THREE.Group();
    mirrorHousing.name = `mirror-${side < 0 ? 'left' : 'right'}`;
    mirrorHousing.position.set(armX, root.y + 0.024, root.z + 0.010);
    mirrorHousing.rotation.set(-0.10, side * 0.20, -0.05);

    const mBody = new THREE.SphereGeometry(0.052, 20, 14);
    mBody.scale(1.18, 0.72, 0.82);
    mirrorHousing.add(mesh(mBody, mats.cherryRed));
    mirrorHousing.add(mesh(new THREE.TorusGeometry(0.043, 0.0045, 8, 22), mats.satinBlack, {
      position: [side * -0.026, 0, 0], rotation: [0, Math.PI / 2, 0],
    }));
    const mGlass = new THREE.PlaneGeometry(0.086, 0.058);
    mGlass.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    mirrorHousing.add(mesh(mGlass, mats.chromeTrim, { position: [side * -0.028, 0, 0] }));
    g.add(mirrorHousing);

    const ph = bodyPoint(-0.10, side < 0 ? T_SHOULDER_L + 0.055 : T_SHOULDER_R - 0.055);
    const handleGeo = new THREE.BoxGeometry(0.016, 0.032, 0.105);
    g.add(mesh(handleGeo, mats.satinBlack, {
      position: [ph.x - side * 0.004, ph.y, ph.z],
      name: `door-handle-${side < 0 ? 'left' : 'right'}`,
    }));

    // Side intake ahead of the rear wheel. The Elise's is a real scoop lofted into the flank,
    // not a plate stuck to it, so it is built from the master surface: the mouth ring is taken
    // off the body at the shut line and swept inboard into a duct.
    {
      const t0 = side < 0 ? T_SHOULDER_L - 0.10 : T_SHOULDER_R + 0.10;
      const mouth = [], duct = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const zc = -0.74 + Math.cos(a) * 0.115;
        const tc = t0 + Math.sin(a) * 0.072 * (side < 0 ? 1 : -1);
        const p = bodyPoint(zc, tc);
        mouth.push([p.x, p.y, p.z]);
        duct.push([p.x * 0.70, p.y * 0.93 + 0.02, p.z * 0.72 - 0.10]);
      }
      const wall = [];
      for (let i = 0; i < 16; i++) {
        wall.push({ geometry: tube([mouth[i], duct[i], duct[i + 1] || duct[0], mouth[i + 1] || mouth[0]], 0.010, { tubular: 8, radial: 5 }) });
      }
      g.add(mesh(mergeAll(wall), mats.satinBlack, { name: `side-intake-${side < 0 ? 'left' : 'right'}` }));
      g.add(mesh(tube(mouth, 0.008, { tubular: 34, radial: 6, closed: true }), mats.cherryRed, {
        name: `side-intake-lip-${side < 0 ? 'left' : 'right'}`,
      }));
    }
  }

  // Front splitter and the two corner intakes under the fascia. The car carries a black lower
  // valance the full width of the nose, not a bare bumper edge.
  {
    const splitter = [];
    for (let i = 0; i <= 26; i++) {
      const u = (i / 26) * 2 - 1;
      const x = u * 0.700;
      splitter.push([x, 0.186 - Math.pow(Math.abs(u), 2.4) * 0.026, 1.922 - Math.pow(Math.abs(u), 1.8) * 0.205]);
    }
    g.add(mesh(tube(splitter, 0.020, { tubular: 30, radial: 8 }), mats.satinBlack, { name: 'front-splitter' }));
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(0.115, 0.058, 0.055), mats.lampHousing, {
        position: [sx * 0.585, 0.286, 1.885], rotation: [0, sx * 0.34, 0], name: 'front-corner-intake',
      }));
    }
  }

  // Bonnet strakes. The clamshell is not a plain dome: it carries raised longitudinal ridges
  // either side of a raised centre panel, which is the first thing the eye picks up in every
  // photograph of the front of this car. Each is drawn along the master surface, so it follows
  // the crown instead of floating over it.
  {
    const ridges = [];
    for (const s2 of [-1, 1]) {
      for (const dt of [0.052, 0.104]) {
        const pts = [];
        for (let i = 0; i <= 30; i++) {
          const u = i / 30;
          const z = 0.560 + (1.640 - 0.560) * u;
          const t = T_CENTRE + s2 * dt * (0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
          const p = bodyPoint(z, t), n = bodyNormal(z, t);
          // Fade into the paint at both ends so the ridge starts and stops like pressed metal.
          const f = Math.min(1, Math.sin(Math.PI * u) * 2.2);
          pts.push([p.x + n.x * (f * 0.004 - 0.005), p.y + n.y * (f * 0.004 - 0.005), p.z + n.z * (f * 0.004 - 0.005)]);
        }
        ridges.push({ geometry: tube(pts, 0.0115, { tubular: 42, radial: 8 }) });
      }
    }
    g.add(mesh(mergeAll(ridges), mats.cherryRed, { name: 'bonnet-strakes' }));
  }

  // Rear deck lip. The tail finishes in a raised blade between the lamps, which is what stops
  // the back of the car reading as a rounded-off lump.
  {
    const lip = [];
    for (let i = 0; i <= 30; i++) {
      const t = T_CENTRE + ((i / 30) * 2 - 1) * 0.212;
      const p = bodyPoint(-1.842, t), n = bodyNormal(-1.842, t);
      lip.push([p.x + n.x * 0.010, p.y + n.y * 0.010 + 0.012, p.z + n.z * 0.010]);
    }
    g.add(mesh(tube(lip, 0.0135, { tubular: 34, radial: 8 }), mats.cherryRed, { name: 'rear-deck-lip' }));
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
const LAMP_FRONT = {
  z0: 1.884, za: -0.236, zb: 0.0,
  t0: 0.132, ta: 0.128, tb: 0.040,
  shape: (a) => Math.sin(Math.PI * Math.pow(a, 0.60)) * 0.86 + 0.14,
  rise: 0.006, depth: 0.046,
};
// The tail lamp runs across the tail rather than along the car, so its long axis is t and its
// short axis is z: on this surface, 45 mm of z at the tail is about 45 mm of height.
const LAMP_REAR = {
  z0: -1.872, za: 0.020, zb: 0.046,
  t0: 0.086, ta: 0.212, tb: 0.0,
  shape: (a) => Math.sin(Math.PI * Math.pow(a, 0.68)) * 0.84 + 0.16,
  rise: 0.005, depth: 0.040,
};

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
      // The pocket is seen from the inside as well, so it carries both windings; the lens must
      // not, or the two coincident transparent faces beat against each other and the glass
      // renders as a scaly mesh.
      if (both) idx.push(a, b, d, b, c, d, a, d, b, b, d, c);
      else if (s < 0) idx.push(a, b, d, b, c, d);
      else idx.push(a, d, b, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
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
    wallIdx.push(a, b, d, b, c, d, a, d, b, b, d, c);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wall.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((N + 1) * 4), 2));
  wall.setIndex(wallIdx);
  wall.computeVertexNormals();
  out.add(mesh(wall, mats.lampHousing, { name: 'lamp-aperture-wall' }));
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

  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.name = `taillight-${s < 0 ? 'left' : 'right'}`;

    lampSurround(LAMP_REAR, s, mats, side);
    side.add(mesh(lampPatch(LAMP_REAR, s, -LAMP_REAR.depth, 0.0), mats.lampHousing, { name: 'lamp-housing' }));

    side.add(lampCell(LAMP_REAR, s, 0.205, 0.041, mats, mats.reflectorBowl, mats.taillightRed));
    side.add(lampCell(LAMP_REAR, s, 0.530, 0.039, mats, mats.reflectorBowl, mats.headlightLens));
    side.add(lampCell(LAMP_REAR, s, 0.820, 0.030, mats, mats.reflectorBowl, mats.headlightLens));

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
  const Z_BASE = 0.415, Y_BASE = 0.792, HW_BASE = 0.596;
  const Z_HEAD = -0.150, Y_HEAD = 1.128, HW_HEAD = 0.494;

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
  frit.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(fritPos.length / 3 * 2), 2));
  frit.setIndex(fritIdx);
  frit.computeVertexNormals();
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

  // Two roll hoops behind the seats — the car has a pair, not a single targa bar.
  const hoops = [];
  for (const side of [-1, 1]) {
    const cx = side * 0.325, pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (i / 14);
      pts.push([cx - Math.cos(a) * 0.165, 0.782 + Math.sin(a) * 0.238, -0.690 + Math.sin(a) * 0.020]);
    }
    hoops.push({ geometry: tube(pts, 0.026, { tubular: 26, radial: 12 }) });
  }
  g.add(mesh(mergeAll(hoops), mats.satinBlack, { name: 'roll-hoops' }));

  // High-mounted brake light between the hoops.
  g.add(mesh(new THREE.BoxGeometry(0.17, 0.020, 0.014), mats.taillightRed, {
    position: [0, 0.905, -0.700], name: 'chmsl-brake-light',
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
  const n = sections[0].pts.length, pos = [], idx = [];
  for (const sec of sections) {
    for (const [x, z] of sec.pts) {
      pos.push(x * sec.scale, sec.y, z * sec.scale + sec.z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = (i + 1) * n + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (close) {
    for (const [ring, flip] of [[0, true], [sections.length - 1, false]]) {
      const base = ring * n;
      for (let j = 1; j < n - 2; j++) {
        if (flip) idx.push(base, base + j + 1, base + j);
        else idx.push(base, base + j, base + j + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
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
  screenUnit.position.set(0.0, 0.58, 0.27);
  // Facing toward driver/camera (facing along -Z, tilted up towards +Y, turned slightly toward driver)
  screenUnit.rotation.set(-0.35, Math.PI - 0.20, 0.0);

  // Touchscreen display panel with "DON'T PANIC!" texture (facing the camera!)
  const screenPanel = mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({
    map: texDontPanic,
    side: THREE.FrontSide,
  }), {
    position: [0, 0, 0.006],
  });
  screenUnit.add(screenPanel);

  // Carbon fiber display bezel frame sitting BEHIND the screen away from camera
  screenUnit.add(mesh(new THREE.BoxGeometry(0.24, 0.14, 0.010), mats.carbonFiber, {
    position: [0, 0, -0.001],
  }));

  g.add(screenUnit);

  // ---- Easter Egg 2: 1:64 Scale Hot Wheels Roadster on Dashboard Pad ---------------------
  const hwGroup = new THREE.Group();
  hwGroup.name = 'hot-wheels-easter-egg';
  hwGroup.position.set(0.12, 0.725, 0.34);
  hwGroup.rotation.set(-0.14, 0.10, 0);

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
  const pcbMesh = mesh(new THREE.PlaneGeometry(0.36, 0.18), new THREE.MeshStandardMaterial({
    map: texPcb,
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
  }), {
    position: [0.0, 0.24, 1.15],
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
    [0.062, 0.050, 0.043], starmanSuitWhite, 'left-arm-door-sill',
  ));
  g.add(limbChain(
    [[armX, 0.745, sillFwd.z - 0.10], [armX + 0.006, 0.727, sillFwd.z + 0.02]],
    [0.043, 0.038], starmanSuitGraphite, 'left-glove',
  ));

  g.add(limbChain(
    [[X + 0.155, 0.735, -0.395], [X + 0.155, 0.585, -0.185], [X + 0.028, 0.700, 0.100]],
    [0.062, 0.050, 0.042], starmanSuitWhite, 'right-arm-steering',
  ));
  g.add(limbChain(
    [[X + 0.028, 0.700, 0.100], [X - 0.010, 0.716, 0.146]],
    [0.042, 0.036], starmanSuitGraphite, 'right-glove',
  ));

  // Legs, folded into the footwell toward the pedals.
  for (const s of [-1, 1]) {
    const lx = X + s * 0.105;
    g.add(limbChain(
      [[lx, 0.430, -0.300], [lx + s * 0.012, 0.452, 0.075], [lx - s * 0.006, 0.268, 0.290]],
      [0.082, 0.068, 0.055], starmanSuitWhite, `leg-${s < 0 ? 'left' : 'right'}`,
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

  root.add(bodyShell);
  root.add(wheels);
  root.add(interior);
  root.add(starman);

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
    { label: 'Starman · mannequin in a SpaceX IVA suit', position: [-0.34, 1.12, -0.34] },
    { label: "«DON'T PANIC!» · dashboard screen", position: [0.02, 0.66, 0.30], scope: 'near' },
    { label: '1:64 Hot Wheels model with a micro-Starman', position: [0.16, 0.76, 0.30], scope: 'near' },
    { label: '«Made on Earth by humans» · circuit board', position: [0.0, 0.30, 1.15], scope: 'near' },
    { label: 'Arch Mission 5D archive · the Foundation trilogy', position: [0.34, 0.44, -0.16], scope: 'near' },
    { label: 'Falcon Heavy payload attach fitting (PAF)', position: [0.0, -0.30, 0.0], scope: 'orbital' },
    { label: 'Selfie camera on a carbon-fibre boom', position: [0.55, 0.95, 3.10], scope: 'orbital' },
  ];

  return root;
}
