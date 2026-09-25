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
 * figures is read off photographs and is approximate: the wall angle, where the windows and
 * the hatch sit, the shape of the SuperDraco fairings, the panel seams, the parachute-bay
 * doors, the Draco groupings, and the trunk's stringer and radiator layout. The data sheet
 * says so. What is NOT approximate is the count of things there are eight or sixteen of, and
 * verify.js measures those.
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
  // Solar cells wrap one half (+X); the other half (−X) carries the radiator panels. The split
  // is turned so the default view, from the front-right, sees both halves and the boundary
  // between them; it used to look square at the radiators and the trunk read as a white drum.
  const RAD0 = Math.PI;                     // radiator half: φ ∈ [π, 2π]
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
  // φ ∈ [π, 2π] of the lathe is x ≤ 0, i.e. θ ∈ [π/2, 3π/2].)
  {
    const pipes = [];
    for (const yy of [0.55, TRUNK_H - 0.55]) {
      pipes.push({
        geometry: new THREE.TorusGeometry(TRUNK_R + 0.035, 0.038, 6, 48, Math.PI * 0.94),
        matrix: mat4([0, yy, 0], [Math.PI / 2, 0, Math.PI * 0.53]),
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
      matrix: mat4([0, TRUNK_H * 0.45, 0], [Math.PI / 2, 0, Math.PI * 0.55]),
    });
    fine.metal.push(...pipes);
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
  const FIN_SPAN = 0.74, FIN_FULL = 1.55, FIN_ROOT = 2.55;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
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
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      seams.push({ geometry: lathe(seamProfile, { segments: 2, phiStart: a - 0.003, phiLength: 0.006, uvMode: 'normalized' }) });
    }
    // Two circumferential joints, where the shell's rings meet.
    for (const y of [SHOULDER + 0.62, NOSE_BASE - 0.78]) {
      seams.push({
        geometry: new THREE.TorusGeometry(wallR(y) + 0.005, 0.008, 5, 112),
        matrix: mat4([0, y, 0], [Math.PI / 2, 0, 0]),
      });
    }
    fine.seam.push(...seams);
  }

  // Parachute bay doors on the upper shell: two drogues and four mains live under them, and
  // on the real vehicle they are the largest features on that part of the cone.
  for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    const y = NOSE_BASE - 0.52;
    fine.dark.push(...wallFrame(a, y, 0.82, 0.62, 0.020, 0.006));
    // The door itself, very slightly proud, so it catches a different highlight.
    fine.white.push({ geometry: wallPatch(a, y, 0.78, 0.58, 0.009) });
  }

  // Hinged nose cone over the docking adapter.
  const noseProfile = [];
  for (let i = 0; i <= 24; i++) noseProfile.push(noseAt(i / 24));
  g.add(mesh(lathe(noseProfile, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
  g.add(mesh(new THREE.TorusGeometry(NOSE_R + 0.005, 0.02, 8, 96), M.blackMatte, { position: [0, NOSE_BASE + 0.02, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  // The hinge it opens on, and the seam it opens along. A cone with neither reads as cast in
  // one piece, which is the opposite of the thing it is famous for doing.
  {
    const hingePhi = Math.PI;
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

  // ---- SuperDraco pods ---------------------------------------------------------------
  // Eight engines in four pods, built into the capsule wall as raised fairings rather than
  // external pods, each with a pair of canted nozzles under a dark scalloped chin. The chin
  // is the detail that makes a pod read as an engine installation instead of a blister: on
  // the vehicle it is a heat-protective apron the exhaust washes over.
  let superDracos = 0;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    // Low on the wall and about 1.2 m long, as the side elevation shows them: they sit just
    // above the heat-shield shoulder, which is where an abort motor has to be to push the
    // capsule off a rocket. At 1.55 m up and 1.87 m long they had drifted halfway to the
    // windows and read as handles.
    const podY = SHOULDER + 0.92;
    const pod = new THREE.Group();
    pod.name = `superdraco-pod-${i}`;
    const shell = new THREE.CapsuleGeometry(0.44, 0.62, 6, 22);
    shell.scale(1, 1, 0.34);                       // flattened into the wall
    pod.add(mesh(shell, M.whiteFresh));
    // No lip ring around the base. A flat ellipse there sinks into a conical wall unevenly,
    // and only its top arc came out — a stray black bow hanging over the nearest window. The
    // blister's own silhouette against the shell is the join.
    // Dark chin and the shield between the nozzles.
    // Rounded rather than a sharp box, and matte: the gloss black mirrored the sky and the
    // chin read as a grey block bolted under the fairing.
    const roundedBlock = (w, h, d, r) => {
      const sh = new THREE.Shape();
      const x = w / 2 - r, y = h / 2 - r;
      sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.absarc(x, -y, r, -Math.PI / 2, 0, false);
      sh.lineTo(w / 2, y); sh.absarc(x, y, r, 0, Math.PI / 2, false);
      sh.lineTo(-x, h / 2); sh.absarc(-x, y, r, Math.PI / 2, Math.PI, false);
      sh.lineTo(-w / 2, -y); sh.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 6 });
      geo.translate(0, 0, -(d - 0.04) / 2);
      return geo;
    };
    pod.add(mesh(roundedBlock(0.76, 0.30, 0.34, 0.1), M.blackMatte, { position: [0, -0.60, 0.06] }));
    pod.add(mesh(roundedBlock(0.86, 0.10, 0.40, 0.04), M.blackMatte, { position: [0, -0.74, 0.04] }));
    for (const dx of [-0.19, 0.19]) {
      // Bell, throat collar and the mounting boss behind it.
      pod.add(mesh(new THREE.CylinderGeometry(0.125, 0.082, 0.28, 20), M.bellCool, { position: [dx, -0.80, 0.05], rotation: [0.42, 0, 0] }));
      pod.add(mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.09, 16), M.darkMetal, { position: [dx, -0.68, 0.10], rotation: [0.42, 0, 0] }));
      pod.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12), M.alumDark, { position: [dx, -0.56, 0.14], rotation: [0.42, 0, 0] }));
      superDracos++;
    }
    pod.position.set(Math.sin(a) * (wallR(podY) - 0.02), podY, Math.cos(a) * (wallR(podY) - 0.02));
    // The wall's slope where the pod sits, not the mean slope: on a convex wall they differ,
    // and a pod tilted to the average would stand off the shell at one end.
    pod.rotation.set(-wallAngle(podY), a, 0, 'YXZ');
    g.add(pod);
  }
  g.userData.superDracoCount = superDracos;

  // ---- Windows, hatch and Draco ------------------------------------------------------
  // Four windows, built as a real assembly: a recessed pocket, an inner pane set back behind
  // a thick frame, and a sill. They used to be 4 cm discs flush with the paint, which at any
  // distance read as dots and at close range as stickers.
  const winY = TRUNK_H + 2.35;
  const WIN_R = 0.26;
  for (const a of [0.62, -0.62, Math.PI + 0.62, Math.PI - 0.62]) {
    const base = onWall(a, winY, 0);
    const flat = (m) => m.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    // A shallow recess, built the way a porthole is: a dark shade ring around the aperture,
    // then the pane just under the surface. The first attempt hung an open-ended cylinder
    // behind the wall, and an open tube seen from outside is a black hole, which is exactly
    // what the render showed — four dark ovals where the windows should be.
    g.add(mesh(new THREE.CylinderGeometry(WIN_R, WIN_R, 0.05, 28, 1, true), M.blackMatte,
      { matrix: flat(base).multiply(new THREE.Matrix4().makeTranslation(0, -0.025, 0)), castShadow: false }));
    const pane = mesh(new THREE.CylinderGeometry(WIN_R, WIN_R, 0.035, 28), M.glass);
    pane.applyMatrix4(flat(base).multiply(new THREE.Matrix4().makeTranslation(0, -0.012, 0)));
    g.add(pane);
    // Frame proud of the paint, then the wider bezel that fairs it into the shell.
    fine.metal.push({
      geometry: new THREE.TorusGeometry(WIN_R + 0.018, 0.036, 10, 36),
      matrix: base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.014)),
    });
    fine.white.push({
      geometry: new THREE.TorusGeometry(WIN_R + 0.08, 0.055, 8, 32),
      matrix: base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.008)),
    });
    // Retaining bolts around the frame — the smallest thing on the capsule, and the reason
    // the eye reads it as 26 cm of glass rather than as a painted circle.
    for (let k = 0; k < 12; k++) {
      const th = (k / 12) * Math.PI * 2;
      fine.micro.push({
        geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6),
        matrix: base.clone()
          .multiply(new THREE.Matrix4().makeTranslation(Math.cos(th) * (WIN_R + 0.058), Math.sin(th) * (WIN_R + 0.058), 0.018))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
      });
    }
  }

  // Side hatch: a real door rather than a rectangle laid on the paint — outline, hinge line,
  // latch recess, and the window in it that the crew boards through.
  {
    const a = Math.PI / 2, hatchY = TRUNK_H + 1.85;
    const HW = 1.06, HH = 1.16;
    fine.white.push({ geometry: wallPatch(a, hatchY, HW - 0.06, HH - 0.06, 0.012) });
    fine.dark.push(...wallFrame(a, hatchY, HW, HH, 0.028, 0.008));
    // Hinge side.
    for (const dy of [-0.34, 0, 0.34]) {
      fine.metal.push({
        geometry: new THREE.CylinderGeometry(0.036, 0.036, 0.2, 10),
        // Rotated round the axis to the hatch edge, not slid along the tangent: sliding put
        // the barrels 7 cm off a shell that curves away under them.
        matrix: onWall(a - (HW / 2) / wallR(hatchY + dy), hatchY + dy, 0.03),
      });
    }
    // Latch recess on the opposite edge.
    fine.metal.push({
      geometry: new THREE.BoxGeometry(0.1, 0.24, 0.05),
      matrix: onWall(a + (HW / 2 - 0.09) / wallR(hatchY), hatchY, 0.024),
    });
    // The hatch window.
    const hb = onWall(a, hatchY + 0.2, 0.02);
    const hp = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 24), M.glass);
    hp.applyMatrix4(hb.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    g.add(hp);
    fine.metal.push({ geometry: new THREE.TorusGeometry(0.185, 0.026, 8, 28), matrix: hb });
  }

  // 16 Draco (spacex.com): four clusters of three near the shoulder, four more around the
  // nose. The published figure is the count, not the grouping — how the sixteen are
  // distributed round the hull is reconstructed from photographs, like everything else at
  // this scale. Each is a raised housing with a recessed nozzle rather than a bare stub, so
  // the cluster reads as an installation and the "Draco (16)" callout points at something.
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
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    // Beside each SuperDraco pod rather than under it: with the pods moved down to the
    // shoulder where the side elevation puts them, the old row at +0.62 m on the pods' own
    // azimuth sat inside the fairings. Alternate sides so no cluster lands on the hatch.
    const side = i % 2 === 0 ? -1 : 1;
    const c = a + side * 0.38;
    // Two side by side on the lower row, one centred above them.
    for (const [dphi, dy] of [[-0.075, 0], [0.075, 0], [0, 0.2]]) addDraco(c + dphi, SHOULDER + 1.30 + dy);
  }
  for (let i = 0; i < 4; i++) addDraco((i * Math.PI) / 2, NOSE_BASE - 0.42);
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
    ['dragon-seams', fine.seam, M.alumDark, 0.12],
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
  g.userData.annotations = [
    { label: 'PICA heat shield', position: [0, TRUNK_H - 0.2, 1.3] },
    { label: 'SuperDraco pod (2 × 4 = 8)', position: [Math.sin(Math.PI / 4) * 2.35, SHOULDER + 0.92, Math.cos(Math.PI / 4) * 2.35] },
    { label: 'Window', position: [Math.sin(0.62) * 2.0, winY, Math.cos(0.62) * 2.0] },
    { label: 'Side hatch', position: [2.2, TRUNK_H + 1.85, 0] },
    { label: 'Parachute bay doors', position: [Math.sin(Math.PI * 0.25) * 1.7, NOSE_BASE - 0.3, Math.cos(Math.PI * 0.25) * 1.7] },
    { label: 'Hinged nose cone · IDSS adapter', position: [0, TOP + 0.25, 0.6] },
    { label: 'Trunk · solar cells (half the circumference)', position: [TRUNK_R + 0.35, 1.9, 0] },
    { label: 'Trunk · radiators and coolant loop', position: [-(TRUNK_R + 0.35), 2.6, 0] },
    { label: 'Trunk fin', position: [Math.sin(Math.PI / 4) * (TRUNK_R + 0.95), 0.9, Math.cos(Math.PI / 4) * (TRUNK_R + 0.95)] },
    { label: 'Draco (16)', position: [0, NOSE_BASE - 0.42, wallR(NOSE_BASE - 0.42) + 0.3] },
  ];
  return g;
}
