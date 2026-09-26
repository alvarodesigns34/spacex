/**
 * Crew Dragon (Dragon 2).
 *
 * Verified figures: 8.1 m with the trunk, 4 m maximum diameter, 9.3 m³ pressurised and 37 m³
 * trunk volume, 16 Draco at 400 N, 8 SuperDraco at 71 kN, solar cells over one half of the
 * trunk (spacex.com); capsule alone 4.4 m × 3.7 m, PICA heat shield, two drogue and four main
 * parachutes (Wikipedia). The trunk is 3.66 m across — the diameter of the Falcon 9 it rides
 * on (Falcon User's Guide 2025) — and the capsule flares slightly wider than that at the heat-shield shoulder, which is
 * what makes the published 4 m and the 8.1 m total consistent: 3.7 m of trunk height plus
 * 4.4 m of capsule.
 *
 * WHAT IS RECONSTRUCTED. SpaceX publishes no drawing, so everything below the level of those
 * figures is read off photographs and is approximate: the wall angle, the sizes and heights
 * of the windows, hatch, SuperDraco recesses and Draco panels, the panel seams, and the
 * trunk's stringer and radiator layout. The data sheet says so. What the NASA photographs
 * settle outright is the ARRANGEMENT — two windows, both beside the hatch; fins in line with
 * the hatch; the nose cone hinged opposite it; radiators behind it — and the layout note
 * below cites them. What is NOT approximate is the count of things there are eight or
 * sixteen of, and verify.js measures those.
 *
 * WHY THERE IS SO MUCH OF IT. A capsule is a smooth white cone, and a smooth white cone with
 * nothing on it reads as a plastic toy at any distance — which is exactly how this one
 * photographed: windows the size of coins, a hatch that was an outline round nothing, pods
 * that were blisters. Everything here exists to give the eye something to measure the 4 m
 * against. The fine work is marked with `lodFeature` so it stops being drawn once it is
 * smaller than a few pixels.
 */
import * as THREE from 'three';
import { lathe, domeProfile, mesh, mergeAll, mat4, plate, boxUV } from '../geometry/utils.js';

const TRUNK_R = 1.83;      // 3.66 m — the diameter of the Falcon 9 it launches on (Falcon User's Guide 2025; spacex.com rounds to 3.7 m)
const CAP_R = 2.0;         // 4 m maximum diameter at the heat-shield shoulder (spacex.com)
const TRUNK_H = 3.7;
const CAP_H = 4.4;         // capsule alone (Wikipedia)
const TOP = TRUNK_H + CAP_H;   // 8.1 m (spacex.com)

// ---- Capsule profile, measured -------------------------------------------------------------
// Read off the dimensioned side elevation on Wikimedia Commons ("Crew Dragon Drawing.png",
// with a 0–5 m scale bar; 62.5 px/m, checked against the 4 m heat-shield diameter). Traced
// by alpha from the PNG rather than by eye:
//
//   along the sidewall   0      0.19   0.40   0.61   0.81   1.00
//   radius (m)           2.01   1.90   1.80   1.62   1.38   1.13
//
// Two things the first version had wrong follow directly from that table. The wall is
// CONVEX — it closes faster towards the top, which is what makes the capsule a gumdrop
// rather than a lampshade — and it ends at a radius of about 1.13 m, not 1.30. And the nose
// cone that closes it is shallow: a cap tangent to a 23° wall over a 1.13 m rim stands about
// three quarters of a metre, where the old one was a 1.35 m near-hemisphere on a straight
// cone. That dome is the single thing that turned the silhouette into a milk bottle.
//
// The drawing's proportions are used, not its absolute lengths: its own scale bar puts the
// whole stack about 4 % long against the published 8.1 m, so the sidewall is stretched to
// meet the 4.4 m capsule height and the cap is kept at the drawing's ratio.
const SHOULDER = TRUNK_H + 0.30;   // top of the constant-diameter shoulder band
const NOSE_BASE = TRUNK_H + 3.60;  // base of the hinged nose cone
const NOSE_R = 1.14;
const SPAN = NOSE_BASE - SHOULDER;
const WALL_ANGLE = Math.atan((CAP_R - NOSE_R) / SPAN);   // mean slope, ≈14.6° (from photographs; not a published figure)
// Fitted to the table above: Δ(u) = 0.45u + 0.55u^2.2 of the radius lost by the top.
const wallR = (y) => {
  const u = THREE.MathUtils.clamp((y - SHOULDER) / SPAN, 0, 1);
  return CAP_R - (CAP_R - NOSE_R) * (0.45 * u + 0.55 * Math.pow(u, 2.2));
};
/** Wall slope at the top, which the nose cone has to continue without a kink. */
const TOP_SLOPE = (CAP_R - NOSE_R) * (0.45 + 0.55 * 2.2) / SPAN;   // dr/dy, ≈0.42 → 23°

// ---- Where things sit round the capsule, measured from NASA photographs ------------------
// Everything on the shell is placed relative to the side hatch, because every photograph that
// shows the hatch shows the rest in the same arrangement. Read off four NASA images of three
// capsules — Crew-1 Resilience and Crew-4 Freedom square-on to the hatch on the recovery ship
// (NHQ202105020016, NHQ202210140028), Endeavour docked to the station (iss071e264174), and
// Freedom seen nose-on on approach with the nose cone open (iss070e075419):
//
//   hatch              the reference; a trunk fin stands directly under it (nose-on view)
//   nose-cone hinge    opposite the hatch (nose-on view)
//   windows            TWO, one each side of the hatch, ≈31° off its centre line, level with
//                      its middle. None anywhere else on the shell, and none in the hatch
//                      itself — every clean view of the door shows only its handle. The model
//                      used to carry four, plus a porthole in the hatch.
//   Draco panels       one square panel of two thrusters and one single below it, directly
//                      under each window (≈30°), and the same pair of groups on the hinge side
//   SuperDraco         four recesses at ≈62° either side of the hatch and of the hinge — two
//                      pairs, each pair centred on a side fin
//
// Angles are proportional readings off perspective photographs: good to about ±5°. Heights
// are fractions of the capsule's own 3.6 m from the heat shield to the nose-cone ring, read
// the same way, and are approximate to about ±0.15 m.
const HATCH = Math.PI / 2;           // the +X side, which the default views look at
const HINGE = HATCH + Math.PI;
const WIN_PSI = 0.54;                // ≈31°
const DRACO_PSI = 0.52;              // ≈30°
const POD_PSI = 1.08;                // ≈62°

/**
 * The closed nose cone, as a cubic Bézier in (r, y) from the rim to the tip: leaving the rim
 * along the wall's own slope, arriving at the axis horizontally. Shared by the cone, its
 * hinge and its split line, so the three cannot disagree about where the surface is.
 */
function noseAt(t) {
  const h = TOP - NOSE_BASE;
  const len = Math.hypot(1, TOP_SLOPE);
  const p0 = [NOSE_R, NOSE_BASE];
  const p1 = [NOSE_R - (TOP_SLOPE / len) * h * 0.55, NOSE_BASE + (1 / len) * h * 0.55];
  const p2 = [NOSE_R * 0.55, TOP];
  const p3 = [0, TOP];
  const s = 1 - t;
  const b = (i) => s * s * s * p0[i] + 3 * s * s * t * p1[i] + 3 * s * t * t * p2[i] + t * t * t * p3[i];
  return { r: b(0), y: b(1) };
}
const wallAngle = (y) => {
  const e = 0.03;
  return Math.atan2(wallR(y - e) - wallR(y + e), e * 2);
};

/** Places something flat against the sloping capsule wall at (phi, y), standing `out` proud. */
function onWall(phi, y, out = 0) {
  const r = wallR(y) + out;
  const m = new THREE.Matrix4().makeRotationY(phi)
    .multiply(new THREE.Matrix4().makeRotationX(-wallAngle(y)));
  m.setPosition(Math.sin(phi) * r, y, Math.cos(phi) * r);
  return m;
}

/** Wall points from y0 to y1, `out` metres proud of the measured profile. */
function wallRun(y0, y1, out, rows = 8) {
  const pts = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * (i / rows);
    pts.push({ r: wallR(y) + out, y });
  }
  return pts;
}

/**
 * A panel `w` × `h` lying ON the capsule wall — lathed from the wall's own profile rather
 * than cut from a flat box. A flat door on a curved shell touches it along one line and
 * stands off everywhere else: on the measured profile a 0.82 m parachute door near the top
 * stood 6 cm clear of the shell at its edges, and the edges of the side hatch nearly 8 cm,
 * both visible as dark slabs breaking the silhouette in every three-quarter view.
 */
function wallPatch(phi, y, w, h, out) {
  const dphi = w / (wallR(y) + out);
  return lathe(wallRun(y - h / 2, y + h / 2, out), { segments: 10, phiStart: phi - dphi / 2, phiLength: dphi });
}

/** The joint round a `wallPatch`: four hairline bands, each following the shell. */
function wallFrame(phi, y, w, h, bar, out) {
  const r = wallR(y) + out;
  const dphi = w / r, dbar = bar / r;
  const parts = [];
  for (const s of [-1, 1]) {
    // Sides: runs up the wall.
    parts.push({ geometry: lathe(wallRun(y - h / 2 - bar / 2, y + h / 2 + bar / 2, out),
      { segments: 1, phiStart: phi + s * dphi / 2 - dbar / 2, phiLength: dbar }) });
    // Top and bottom: arcs round it.
    const yy = y + s * h / 2;
    parts.push({ geometry: lathe(wallRun(yy - bar / 2, yy + bar / 2, out, 1),
      { segments: 10, phiStart: phi - dphi / 2 - dbar / 2, phiLength: dphi + dbar }) });
  }
  return parts;
}

/**
 * Any flat outline laid ON the capsule wall: `shape` is drawn in metres, x round the wall and
 * y up it, with (0, 0) at (phi, y). The outline is triangulated flat, then every triangle is
 * split until no edge is longer than `maxEdge` and each vertex is wrapped onto the measured
 * profile `out` metres proud — the same reason as `wallPatch`: a flat 0.9 m panel on this
 * shell stands 2 cm off it at the edges. Normals are the wall's own, so a patch shades as
 * part of the shell rather than as a faceted card; UVs are metric.
 */
function wallShape(shape, phi, y, out, maxEdge = 0.05) {
  const flat = new THREE.ShapeGeometry(shape, 12).toNonIndexed();
  const src = flat.attributes.position;
  const tris = [];
  for (let i = 0; i < src.count; i += 3) {
    tris.push([0, 1, 2].map(k => [src.getX(i + k), src.getY(i + k)]));
  }
  const out2 = [];
  while (tris.length) {
    const t = tris.pop();
    const d = [0, 1, 2].map(k => Math.hypot(t[k][0] - t[(k + 1) % 3][0], t[k][1] - t[(k + 1) % 3][1]));
    const k = d.indexOf(Math.max(...d));
    if (d[k] <= maxEdge) { out2.push(t); continue; }
    const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    tris.push([a, m, c], [m, b, c]);
  }
  const pos = new Float32Array(out2.length * 9), nor = new Float32Array(out2.length * 9), uv = new Float32Array(out2.length * 6);
  let p = 0, q = 0;
  for (const t of out2) {
    for (const [s, v] of t) {
      const yy = y + v;
      const r = wallR(yy) + out;
      const ph = phi + s / r;
      const wa = wallAngle(yy);
      pos.set([Math.sin(ph) * r, yy, Math.cos(ph) * r], p);
      nor.set([Math.sin(ph) * Math.cos(wa), Math.sin(wa), Math.cos(ph) * Math.cos(wa)], p);
      uv.set([s, v], q);
      p += 3; q += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A rounded rectangle, or a trapezoid with rounded corners, centred on the origin. */
function roundedOutline(wTop, wBot, h, rTop, rBot) {
  const s = new THREE.Shape();
  const x0 = wBot / 2, x1 = wTop / 2, y0 = -h / 2, y1 = h / 2;
  s.moveTo(-x0 + rBot, y0);
  s.lineTo(x0 - rBot, y0);
  s.quadraticCurveTo(x0, y0, x0, y0 + rBot);
  s.lineTo(x1, y1 - rTop);
  s.quadraticCurveTo(x1, y1, x1 - rTop, y1);
  s.lineTo(-x1 + rTop, y1);
  s.quadraticCurveTo(-x1, y1, -x1, y1 - rTop);
  s.lineTo(-x0, y0 + rBot);
  s.quadraticCurveTo(-x0, y0, -x0 + rBot, y0);
  return s;
}

export function buildDragon(M) {
  const g = new THREE.Group();
  g.name = 'dragon';
  /**
   * Fine detail, merged into as few meshes as possible and shed by the LOD manager.
   *
   * Split by how far each batch stays legible, not by material. A batch's `lodFeature` is what
   * decides when it stops being drawn, so mixing a 26 cm window frame in with a 1.4 cm bolt
   * throws the frame away as soon as the bolt stops resolving — which is what the first pass
   * did, and the windows lost their frames at seven metres.
   *
   *   trim   panel joints, frames, hinges: high contrast, legible well past their own width
   *   micro  fasteners: genuinely gone once they are under a few pixels
   */
  const fine = { white: [], dark: [], seam: [], metal: [], micro: [] };

  // ---- Trunk -------------------------------------------------------------------------
  // Solar cells wrap one half; the other half carries the radiator panels. Which half is which
  // is photographed: docked at the station (iss071e264174) the trunk behind the side hatch is
  // the white, fluted radiator, and seen from the hinge side after undocking (iss069e085578)
  // it is the dark array. So the radiators are centred on the hatch (+X) and the cells on the
  // hinge (−X), split at the side fins. The model had them the other way round.
  const RAD0 = 0;                           // radiator half: φ ∈ [0, π], centred on the hatch
  g.add(mesh(lathe([{ r: TRUNK_R, y: 0 }, { r: TRUNK_R, y: TRUNK_H }], { segments: 128, phiStart: RAD0, phiLength: Math.PI }), M.radiator, { name: 'trunk-radiator' }));
  const bays = 5;
  for (let i = 0; i < bays; i++) {
    const a0 = RAD0 - Math.PI + (i / bays) * Math.PI + 0.005;   // 1 cm seams, not 10 cm white bars
    g.add(mesh(lathe([{ r: TRUNK_R + 0.02, y: 0.22 }, { r: TRUNK_R + 0.02, y: TRUNK_H - 0.3 }],
      { segments: 22, phiStart: a0, phiLength: Math.PI / bays - 0.010 }), M.solar, { name: 'trunk-solar' }));
  }
  g.add(mesh(lathe([{ r: TRUNK_R, y: 0 }, { r: TRUNK_R, y: TRUNK_H }], { segments: 128, phiStart: RAD0 - Math.PI, phiLength: Math.PI }), M.white));
  g.add(mesh(lathe([{ r: TRUNK_R - 0.03, y: 0.05 }, { r: TRUNK_R - 0.03, y: TRUNK_H - 0.05 }], { segments: 64, flip: true }), M.blackMatte, { castShadow: false }));

  // Radiator plumbing: the coolant loop's feed and return runs, and the cross-ties between
  // panels. All of it belongs to the radiator half. The harness strips and stringers used to
  // be laid out over the wrong half, so half the plumbing ran straight across the solar cells:
  // black hoops and white bars caging the one face of the trunk that should be a continuous
  // dark array. (Torus arcs here are in the x = cos θ, z = sin θ convention; the radiator half
  // φ ∈ [0, π] of the lathe is x ≥ 0, i.e. θ ∈ [−π/2, π/2]. `ARC0` rotates an arc starting at
  // θ = 0 to start just past the radiator half's first edge.)
  const ARC0 = -Math.PI / 2 + Math.PI * 0.03;
  {
    const pipes = [];
    for (const yy of [0.55, TRUNK_H - 0.55]) {
      pipes.push({
        geometry: new THREE.TorusGeometry(TRUNK_R + 0.035, 0.038, 6, 48, Math.PI * 0.94),
        matrix: mat4([0, yy, 0], [Math.PI / 2, 0, ARC0]),
      });
    }
    for (let i = 0; i < 7; i++) {
      const a = RAD0 + 0.18 + (i / 6) * (Math.PI - 0.36);
      pipes.push({
        geometry: new THREE.CylinderGeometry(0.022, 0.022, TRUNK_H - 1.1, 7),
        matrix: mat4([Math.sin(a) * (TRUNK_R + 0.032), TRUNK_H / 2, Math.cos(a) * (TRUNK_R + 0.032)]),
      });
    }
    // Harness and radiator panel gaps on the white half, so the trunk is a bay
    // of hardware rather than a painted drum. Layout is reconstructed.
    for (let i = 0; i < 6; i++) {
      const a = RAD0 + 0.25 + (i / 5) * (Math.PI - 0.5);
      pipes.push({
        geometry: new THREE.BoxGeometry(0.02, TRUNK_H - 0.8, 0.012),
        matrix: mat4([Math.sin(a) * (TRUNK_R + 0.012), TRUNK_H / 2, Math.cos(a) * (TRUNK_R + 0.012)], [0, a, 0]),
      });
    }
    pipes.push({
      geometry: new THREE.TorusGeometry(TRUNK_R + 0.02, 0.012, 6, 40, Math.PI * 0.9),
      matrix: mat4([0, TRUNK_H * 0.45, 0], [Math.PI / 2, 0, ARC0 + Math.PI * 0.02]),
    });
    // White, like the panels they run over: docked at the station (iss071e264174) the
    // radiator half is white and fluted, with nothing dark on it.
    fine.white.push(...pipes);
  }
  // External stringers under the skin, every 15°, on the radiator half only: shallow ridges
  // that catch the light and stop the white drum reading as a paper tube. They went all the
  // way round, as white bars over the solar cells; the array is continuous.
  {
    const ribs = [];
    for (let i = 0; i <= 12; i++) {
      const a = RAD0 + (i / 12) * Math.PI;
      ribs.push({
        geometry: new THREE.BoxGeometry(0.075, TRUNK_H - 0.34, 0.03),
        matrix: mat4([Math.sin(a) * (TRUNK_R + 0.014), TRUNK_H / 2, Math.cos(a) * (TRUNK_R + 0.014)], [0, a, 0]),
      });
    }
    fine.white.push(...ribs);
  }

  // Internal stringers and the two end rings, visible through the open aft end.
  const ribs = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ribs.push({ geometry: new THREE.BoxGeometry(0.07, TRUNK_H - 0.25, 0.14), matrix: mat4([Math.sin(a) * (TRUNK_R - 0.11), TRUNK_H / 2, Math.cos(a) * (TRUNK_R - 0.11)], [0, a, 0]) });
  }
  ribs.push({ geometry: new THREE.TorusGeometry(TRUNK_R - 0.1, 0.055, 6, 64), matrix: mat4([0, 0.16, 0], [Math.PI / 2, 0, 0]) });
  ribs.push({ geometry: new THREE.TorusGeometry(TRUNK_R - 0.1, 0.055, 6, 64), matrix: mat4([0, TRUNK_H - 0.4, 0], [Math.PI / 2, 0, 0]) });
  g.add(mesh(mergeAll(ribs), M.alumDark));
  // Capsule interface ring at the top of the trunk.
  g.add(mesh(new THREE.TorusGeometry(TRUNK_R - 0.05, 0.075, 10, 96), M.goldKapton, { position: [0, TRUNK_H - 0.16, 0], rotation: [Math.PI / 2, 0, 0] }));
  // Separation plane at the foot: the ring the trunk rides on the second stage with.
  g.add(mesh(new THREE.TorusGeometry(TRUNK_R + 0.01, 0.055, 8, 96), M.alumDark, { position: [0, 0.07, 0], rotation: [Math.PI / 2, 0, 0] }));

  // Four stabilising fins (Crew Dragon only; Cargo Dragon flies without them).
  //
  // Aft-mounted, as both elevations of the drawing show them: full span along the bottom of
  // the trunk, where they have the longest lever arm on an abort, with the leading edge
  // swept forward into the drum about two thirds of the way up. They were a symmetric
  // trapezoid centred on the trunk — four boards standing out of the middle of the drum,
  // the least rocket-like thing on the vehicle. Span and sweep are read off the drawing and
  // are approximate; the count and the Crew-only fitment are not.
  // In line with the hatch and the hinge, not between them: nose-on on approach
  // (iss070e075419) one fin stands directly under the hatch, and every hangar photograph
  // shows a fin edge-on in the middle of the trunk with the other two on its outline. They
  // used to sit at 45° to the hatch.
  const FIN_SPAN = 0.74, FIN_FULL = 1.55, FIN_ROOT = 2.55;
  for (let i = 0; i < 4; i++) {
    const a = HATCH + (i * Math.PI) / 2;
    const fin = plate([[0, 0.02], [FIN_SPAN, 0.02], [FIN_SPAN, FIN_FULL], [0, FIN_ROOT]], 0.055, 0.014);
    const e1 = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const e3 = new THREE.Vector3().crossVectors(e1, new THREE.Vector3(0, 1, 0));
    const f = mesh(fin, M.white);
    f.applyMatrix4(new THREE.Matrix4()
      .makeTranslation(e1.x * (TRUNK_R - 0.01), 0, e1.z * (TRUNK_R - 0.01))
      .multiply(new THREE.Matrix4().makeBasis(e1, new THREE.Vector3(0, 1, 0), e3)));
    g.add(f);
    // Root fairing: a fin that meets the drum at a hard edge reads as card glued on. It runs
    // the length of the root and tapers out where the leading edge meets the drum.
    const root = mesh(new THREE.CylinderGeometry(0.035, 0.14, FIN_ROOT - 0.1, 10), M.white);
    root.position.set(e1.x * (TRUNK_R + 0.02), (FIN_ROOT - 0.1) / 2 + 0.05, e1.z * (TRUNK_R + 0.02));
    g.add(root);
  }

  // ---- Capsule -----------------------------------------------------------------------
  // PICA heat shield: a shallow convex cap, planar-mapped so the ablator's sector pattern
  // reads correctly across it.
  const depth = 0.26;
  const shield = lathe(domeProfile(CAP_R, depth, TRUNK_H, 18, -1).reverse(), { segments: 112 });
  {
    const pos = shield.attributes.position, uv = shield.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * CAP_R), 0.5 + pos.getZ(i) / (2 * CAP_R));
    uv.needsUpdate = true;
  }
  g.add(mesh(shield, M.pica, { name: 'heatshield' }));
  // Back-shell interface: the ring that closes the gap between the ablator and the sidewall.
  g.add(mesh(new THREE.TorusGeometry(CAP_R - 0.02, 0.05, 8, 112), M.darkMetal,
    { position: [0, TRUNK_H - 0.06, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));

  // Sidewall follows wallR, the same loft the windows and hatch are placed on.
  const wall = [{ r: CAP_R, y: TRUNK_H }, { r: CAP_R, y: SHOULDER, sharp: true }];
  for (let i = 1; i <= 6; i++) {
    const y = SHOULDER + (SPAN * i) / 6;
    wall.push({ r: wallR(y), y, sharp: i === 6 });
  }
  g.add(mesh(lathe(wall, { segments: 128 }), M.whiteFresh, { name: 'capsule-wall' }));
  g.add(mesh(new THREE.TorusGeometry(CAP_R, 0.035, 8, 128), M.darkMetal, { position: [0, TRUNK_H + 0.02, 0], rotation: [Math.PI / 2, 0, 0] }));

  // Longitudinal panel seams up the back shell. The shell is built in gores; the joints
  // between them are the only thing giving the cone a sense of size from more than a few
  // metres away, and it had none.
  // Eight of them, hairline, in grey rather than black. Sixteen black bars standing 6 mm
  // proud turned the capsule into a beach ball — a seam is a joint between panels, not a
  // strap over them, and on the vehicle it is barely darker than the paint either side.
  {
    const seams = [];
    // Each seam is a hairline strip lathed along the wall itself. A straight bar laid on a
    // convex wall touches it only in the middle and stands off at both ends, so on the
    // measured profile the old boxes would have floated centimetres clear of the shell.
    const seamProfile = [];
    for (let i = 0; i <= 16; i++) {
      const y = SHOULDER + 0.05 + (SPAN - 0.1) * (i / 16);
      seamProfile.push({ r: wallR(y) + 0.004, y });
    }
    // Four, on the fin lines — the middle of the hatch, hinge and side faces — which is where
    // the hangar close-ups show a vertical row of fasteners running up the shell (Crew-6,
    // Crew-8). There were eight, at 22.5° off those lines; one of them now crossed a window.
    for (let i = 0; i < 4; i++) {
      const a = HATCH + (i * Math.PI) / 2;
      seams.push({ geometry: lathe(seamProfile, { segments: 2, phiStart: a - 0.003, phiLength: 0.006, uvMode: 'normalized' }) });
    }
    // Two circumferential joints, where the shell's rings meet (reconstructed). The upper one
    // is kept clear of the top of the hatch frame.
    for (const y of [SHOULDER + 0.62, NOSE_BASE - 0.60]) {
      seams.push({
        geometry: new THREE.TorusGeometry(wallR(y) + 0.005, 0.008, 5, 112),
        matrix: mat4([0, y, 0], [Math.PI / 2, 0, 0]),
      });
    }
    fine.seam.push(...seams);
  }

  // No parachute doors on the sidewall. The model used to carry four 0.8 m doors at 45° to the
  // hatch; no photograph shows them. The hangar views of the other faces (Crew-3, Crew-8,
  // Crew-10) show plain shell there with a few small bolted access plates, and on the hatch
  // side that band is taken by the hatch's own frame.

  // Hinged nose cone over the docking adapter.
  const noseProfile = [];
  for (let i = 0; i <= 24; i++) noseProfile.push(noseAt(i / 24));
  g.add(mesh(lathe(noseProfile, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
  g.add(mesh(new THREE.TorusGeometry(NOSE_R + 0.005, 0.014, 8, 96), M.seamGrey ?? M.blackMatte, { position: [0, NOSE_BASE + 0.02, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  // The hinge it opens on, and the seam it opens along. A cone with neither reads as cast in
  // one piece, which is the opposite of the thing it is famous for doing.
  {
    // Opposite the hatch: nose-on on approach (iss070e075419) the open cone stands up on the
    // far side from the hatch and its two windows.
    const hingePhi = HINGE;
    const hinge = [];
    for (let i = 0; i < 5; i++) {
      const p = noseAt(0.04 + (i / 4) * 0.2);
      const y = p.y;
      const r = p.r + 0.03;
      hinge.push({
        geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10),
        matrix: mat4([Math.sin(hingePhi) * r, y, Math.cos(hingePhi) * r], [0, hingePhi, Math.PI / 2]),
      });
    }
    fine.metal.push(...hinge);
    // Split line running up and over from the hinge, as one continuous lathed band rather
    // than a row of short boxes: spaced boxes read as a dashed line drawn on the cone, which
    // is what the first pass produced.
    const lip = [];
    for (let i = 0; i <= 18; i++) {
      const p = noseAt(i / 18);
      lip.push({ r: p.r + 0.004, y: p.y });
    }
    for (const s of [1, -1]) {
      fine.seam.push({
        geometry: lathe(lip, { segments: 2, phiStart: s * Math.PI / 2 - 0.006, phiLength: 0.012, uvMode: 'normalized' }),
      });
    }
  }

  // ---- SuperDraco recesses -----------------------------------------------------------
  // Eight engines in four pairs, each pair firing out of a RECESS in the wall — not out of a
  // raised fairing. Every photograph agrees on the form: an arched pocket cut into the shell
  // with the two nozzles side by side in it, and the pocket's walls running on down to the
  // shoulder as a pair of folds that fan out, the channel the exhaust leaves along (clearest
  // on Crew-10 in the hangar, KSC-20250305-PH-SPX01_0002; before flight the pocket carries a
  // black cover with two holes in it, Crew-6, KSC-20230219-PH-SPX01_0002). The model had a
  // white blister with a black chin, a metre lower — the thing it most looked like was a
  // handle.
  //
  // Read off those photographs, approximately: the pocket about 0.9 m across and 0.6 m tall,
  // its top some 1.9 m above the heat shield, the nozzles about 1.55 m up, and the folds
  // reaching the shoulder about 1.25 m apart. The pocket is drawn as a dark panel lying on the
  // shell, since the shell is one closed surface; seen in daylight the real one reads as
  // exactly that, a dark shape in the wall, and the nozzles stand in it.
  let superDracos = 0;
  {
    const POCKET_Y = TRUNK_H + 1.62, POCKET_W = 0.88, POCKET_WB = 0.62, POCKET_H = 0.6;
    const pockets = [], edges = [], bells = [], bellInners = [], collars = [];
    const pocketShape = () => roundedOutline(POCKET_W, POCKET_WB, POCKET_H, 0.24, 0.08);
    for (const a of [HATCH - POD_PSI, HATCH + POD_PSI, HINGE - POD_PSI, HINGE + POD_PSI]) {
      pockets.push({ geometry: wallShape(pocketShape(), a, POCKET_Y, 0.006) });
      // The recess edge: a hairline round the pocket, then the two folds down to the shoulder.
      const rim = roundedOutline(POCKET_W + 0.05, POCKET_WB + 0.05, POCKET_H + 0.05, 0.265, 0.1);
      rim.holes.push(pocketShape());
      edges.push({ geometry: wallShape(rim, a, POCKET_Y, 0.005) });
      const yTop = -POCKET_H / 2 + 0.02, yBot = SHOULDER + 0.06 - POCKET_Y;
      for (const s of [-1, 1]) {
        const fold = new THREE.Shape();
        const x0 = s * (POCKET_WB / 2 + 0.02), x1 = s * 0.63;
        fold.moveTo(x0 - 0.012, yTop); fold.lineTo(x0 + 0.012, yTop);
        fold.lineTo(x1 + 0.012, yBot); fold.lineTo(x1 - 0.012, yBot);
        edges.push({ geometry: wallShape(fold, a, POCKET_Y, 0.005) });
      }
      // Nozzles side by side in the lower half of the pocket, canted out of the wall so they
      // fire down and away from it.
      const CANT = 0.52;   // ≈30° off the wall; reconstructed
      for (const s of [-0.2, 0.2]) {
        const y = POCKET_Y - 0.08;
        const base = onWall(a + s / wallR(y), y, 0)
          .multiply(new THREE.Matrix4().makeRotationX(-CANT));
        // Bell: narrow end up and into the wall, exit down and out, its lip at the surface.
        const bellAt = base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.02, -0.055));
        bells.push({ geometry: new THREE.CylinderGeometry(0.082, 0.118, 0.26, 20, 1, true), matrix: bellAt });
        // The inside of the bell, facing in, so the open exit shows a nozzle wall and not the
        // back of the pocket through it.
        const inner = new THREE.CylinderGeometry(0.078, 0.113, 0.26, 20, 1, true);
        const ix = inner.index.array;
        for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
        const nn = inner.attributes.normal.array;
        for (let k = 0; k < nn.length; k++) nn[k] = -nn[k];
        bellInners.push({ geometry: inner, matrix: bellAt });
        collars.push({ geometry: new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16), matrix: base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.17, -0.05)) });
        superDracos++;
      }
    }
    g.add(mesh(mergeAll(pockets), M.blackMatte, { name: 'superdraco-recess', castShadow: false }));
    g.add(mesh(mergeAll(bells), M.bellCool, { name: 'superdraco-bells' }));
    g.add(mesh(mergeAll(bellInners), M.bellInner, { name: 'superdraco-bell-inner', castShadow: false }));
    g.add(mesh(mergeAll(collars), M.darkMetal, { name: 'superdraco-collars', castShadow: false }));
    fine.seam.push(...edges);
  }
  g.userData.superDracoCount = superDracos;

  // ---- Windows, hatch and Draco ------------------------------------------------------
  // Two windows, one each side of the hatch (see the layout note at the top). Oval, about
  // 0.38 m across and 0.48 m tall in the glass, read off the same photographs against the
  // 1 m hatch; the model's four were 0.52 m circles. Built as a real assembly: a dark shade
  // ring round the aperture, the pane just under the surface, a frame proud of the paint and
  // a bezel fairing it into the shell.
  const winY = TRUNK_H + 2.15;
  const WIN_A = 0.19, WIN_B = 0.24;       // half-width and half-height of the glass
  const R0 = 0.215;                       // parts are built round and scaled to the oval
  for (const a of [HATCH - WIN_PSI, HATCH + WIN_PSI]) {
    const base = onWall(a, winY, 0);
    const oval = base.clone().multiply(new THREE.Matrix4().makeScale(WIN_A / R0, WIN_B / R0, 1));
    const flat = (m) => m.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    // An open tube hung behind the wall reads from outside as a black hole — the first
    // attempt's four dark ovals — so the recess is a short shade ring and the pane sits
    // just under the surface.
    g.add(mesh(new THREE.CylinderGeometry(R0, R0, 0.05, 32, 1, true), M.blackMatte,
      { matrix: flat(oval).multiply(new THREE.Matrix4().makeTranslation(0, -0.025, 0)), castShadow: false }));
    const pane = mesh(new THREE.CylinderGeometry(R0, R0, 0.035, 32), M.glass);
    pane.applyMatrix4(flat(oval).multiply(new THREE.Matrix4().makeTranslation(0, -0.012, 0)));
    g.add(pane);
    fine.metal.push({
      geometry: new THREE.TorusGeometry(R0 + 0.016, 0.03, 10, 40),
      matrix: oval.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.012)),
    });
    fine.white.push({
      geometry: new THREE.TorusGeometry(R0 + 0.06, 0.035, 8, 40),
      matrix: oval.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.006)),
    });
    // Retaining bolts round the frame, which is what makes the eye read glass rather than a
    // painted oval.
    for (let k = 0; k < 12; k++) {
      const th = (k / 12) * Math.PI * 2;
      fine.micro.push({
        geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6),
        matrix: base.clone()
          .multiply(new THREE.Matrix4().makeTranslation(Math.cos(th) * (WIN_A + 0.05), Math.sin(th) * (WIN_B + 0.05), 0.016))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
      });
    }
  }

  // Side hatch: a real door rather than a rectangle laid on the paint — outline, hinge line
  // and the handle. About 1.0 m across and 1.25 m tall, its middle level with the windows,
  // measured square-on on Resilience and Freedom. No porthole: the door in every clean
  // photograph carries only a small square handle recess to one side of centre.
  {
    const a = HATCH, hatchY = TRUNK_H + 2.18;
    const HW = 1.0, HH = 1.25;
    fine.white.push({ geometry: wallPatch(a, hatchY, HW - 0.06, HH - 0.06, 0.012) });
    // The door's joint is a grey line like the other panel joints, not a black stroke.
    fine.seam.push(...wallFrame(a, hatchY, HW, HH, 0.022, 0.008));
    // Hinge side.
    for (const dy of [-0.4, 0, 0.4]) {
      fine.metal.push({
        geometry: new THREE.CylinderGeometry(0.036, 0.036, 0.2, 10),
        // Rotated round the axis to the hatch edge, not slid along the tangent: sliding put
        // the barrels 7 cm off a shell that curves away under them.
        matrix: onWall(a - (HW / 2) / wallR(hatchY + dy), hatchY + dy, 0.03),
      });
    }
    // The handle recess on the opposite side of the door.
    fine.dark.push({ geometry: wallPatch(a + 0.3 / wallR(hatchY), hatchY - 0.05, 0.17, 0.17, 0.016) });
    fine.metal.push({
      geometry: new THREE.BoxGeometry(0.1, 0.03, 0.03),
      matrix: onWall(a + 0.3 / wallR(hatchY - 0.05), hatchY - 0.05, 0.03),
    });
  }

  // 16 Draco (spacex.com). Twelve of them are in four groups of three on the shell, each group
  // a square panel of two with a single one in a smaller panel below it and a little further
  // round: on the hatch side directly under each window, where Resilience and Freedom show
  // them square-on, and the same pair of groups at 30° either side of the hinge
  // (iss069e085578). The other four sit on the forward bulkhead round the docking adapter,
  // under the nose cone — NASA's Commercial Crew press kit: "additional Draco thrusters are
  // housed under the nose cone" — the four round ports the nose-on approach photograph shows at the
  // diagonals (iss070e075419) — so with the cone closed, as it is here, they are out of
  // sight. Positions approximate, like everything read off photographs; the count is
  // spacex.com's. Each is a raised housing with a recessed nozzle rather than a bare stub.
  const dracos = [];
  const dracoHousings = [];
  const addDraco = (phi, y) => {
    const base = onWall(phi, y, -0.015);
    dracos.push({ geometry: new THREE.CylinderGeometry(0.052, 0.038, 0.12, 12), matrix: base.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)) });
    dracoHousings.push({
      geometry: new THREE.CylinderGeometry(0.085, 0.095, 0.07, 14),
      matrix: base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.02)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
    });
  };
  for (const [c, out] of [[HATCH - DRACO_PSI, -1], [HATCH + DRACO_PSI, 1], [HINGE - DRACO_PSI, -1], [HINGE + DRACO_PSI, 1]]) {
    // `out` is the side away from the hatch (or hinge) centre line.
    const yPanel = TRUNK_H + 1.40, ySingle = TRUNK_H + 0.98;
    for (const [s, dy] of [[-0.035, 0.1], [0.035, -0.1]]) addDraco(c + (s * out) / wallR(yPanel + dy), yPanel + dy);
    fine.seam.push(...wallFrame(c, yPanel, 0.36, 0.46, 0.012, 0.005));
    const cs = c + (0.16 * out) / wallR(ySingle);
    addDraco(cs, ySingle);
    fine.seam.push(...wallFrame(cs, ySingle, 0.24, 0.26, 0.012, 0.005));
  }
  for (let i = 0; i < 4; i++) {
    const a = HATCH + Math.PI / 4 + (i * Math.PI) / 2;
    dracos.push({
      geometry: new THREE.CylinderGeometry(0.038, 0.052, 0.12, 12),
      matrix: mat4([Math.sin(a) * 0.62, NOSE_BASE + 0.06, Math.cos(a) * 0.62]),
    });
  }
  g.userData.dracoCount = dracos.length;
  g.add(mesh(mergeAll(dracos), M.blackMatte, { name: 'draco' }));
  fine.white.push(...dracoHousings);

  // ---- Fine detail, merged and marked for the level-of-detail manager ------------------
  // Four draw calls for everything above that is smaller than a hand. `lodFeature` is the
  // size of the smallest thing in each batch, so the manager sheds them when that stops
  // resolving rather than at a distance somebody guessed.
  // The feature size is what makes each batch READ, not the thinnest bar in it. A 2 cm dark
  // seam on a white shell is a panel division the eye follows from thirty metres; a 1.4 cm
  // bolt head is gone at five. Sizing both by their own width threw the panel lines away
  // along with the bolts.
  const batches = [
    ['dragon-trim-white', fine.white, M.whiteFresh, 0.14],
    ['dragon-trim-dark', fine.dark, M.blackMatte, 0.14],
    ['dragon-seams', fine.seam, M.seamGrey ?? M.alumDark, 0.12],
    ['dragon-trim-metal', fine.metal, M.darkMetal, 0.10],
    ['dragon-fasteners', fine.micro, M.aluminum, 0.018],
  ];
  for (const [name, parts, mat, feature] of batches) {
    if (!parts.length) continue;
    const m = mesh(boxUV(mergeAll(parts)), mat, { name, castShadow: false });
    m.userData.lodFeature = feature;
    g.add(m);
  }

  g.userData.height = TOP;
  g.userData.footprint = CAP_R * 2;
  g.userData.stations = { trunkTop: TRUNK_H, shoulder: SHOULDER, noseBase: NOSE_BASE, capR: CAP_R, trunkR: TRUNK_R };
  const around = (phi, y, r) => [Math.sin(phi) * r, y, Math.cos(phi) * r];
  g.userData.annotations = [
    { label: 'PICA heat shield', position: [0, TRUNK_H - 0.2, 1.3] },
    { label: 'SuperDraco recess (4 × 2 = 8)', position: around(HATCH - POD_PSI, TRUNK_H + 1.95, 2.3) },
    { label: 'Window (one each side of the hatch)', position: around(HATCH - WIN_PSI, winY + 0.35, 2.0) },
    { label: 'Side hatch', position: around(HATCH, TRUNK_H + 2.9, 1.9) },
    { label: 'Hinged nose cone · IDSS adapter', position: [0, TOP + 0.25, 0.6] },
    { label: 'Trunk · radiators and coolant loop', position: around(HATCH, 2.6, TRUNK_R + 0.35) },
    { label: 'Trunk · solar cells (half the circumference)', position: around(HINGE, 1.9, TRUNK_R + 0.35) },
    { label: 'Trunk fin', position: around(HATCH - Math.PI / 2, 0.9, TRUNK_R + 0.95) },
    { label: 'Draco (16)', position: around(HATCH + DRACO_PSI, TRUNK_H + 1.1, wallR(TRUNK_H + 1.1) + 0.35) },
  ];
  return g;
}
