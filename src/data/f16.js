/**
 * The F-16A Block 15 (F100-PW-200), every figure with where it comes from. Tags as in the rest of
 * the centre: PUBLISHED (a number printed in the source), DERIVED (computed from published
 * numbers), TRACED (measured on a published drawing, ≈ ±5 cm), ESTIMATE (≈, reasoned, no source).
 *
 * Sources (NASA, public domain; downloaded for reference only, not in the repository):
 *  - NASA TP-1538 (Nguyen et al., 1979), "Simulator study of stall/post-stall characteristics of
 *    a fighter airplane with relaxed longitudinal static stability": table I (weight, inertias,
 *    wing, surface limits), figure 2 (a three-view sketch, 15.09 / 9.45 / 5.01 m).
 *  - NASA TP-3355 (1993), "Supersonic aerodynamic characteristics of an advanced F-16 derivative
 *    aircraft configuration": table II (the F-16C wind-tunnel model, 1/15 scale: every surface's
 *    area, span, chord, sweep and section) and figure 2 (its dimensioned three-view).
 *  - NACA TN-1368 (1947): the NACA 64A006 basic thickness form, figure 7, from which the 64A204's
 *    4 % thickness is scaled.
 *
 * Frame: s = metres aft of the nose probe's tip, z = metres above the model's waterline WL 6.607
 * (TP-3355 figure 2, the line the wing lies on); y = metres to the right. The 1/15 model's inches
 * are full-size feet × 0.8 (1 in model = 15 in): its 39.47 in overall length is 15.04 m.
 */
import { FCS } from './f16Aero.js';

const IN = 0.0254, FT = 0.3048;
const SCALE = 15 * IN;   // one model inch, full size, in metres

/** The F-16C model's own reference figures, full size (TP-3355 table II). */
export const MODEL = {
  src: 'TP-3355 table II and figure 2', tag: 'PUBLISHED',
  length: 39.47 * SCALE,                      // nose probe to the fin tip's trailing edge: 15.04 m
  mrc: (21.377 + 1.783) * SCALE,              // 0.35 c̄ moment reference, from the probe's FS −1.783: 8.82 m
};

/** Wing (TP-1538 table I; TP-3355 table II: 1.3333 ft², 24.000 in, λ 0.2275, c̄ 9.056 in). */
export const WING = (() => {
  const S = 300 * FT * FT, b = 30 * FT, lam = 0.2275, sweepLE = 40;
  // A trapezoid with an unswept trailing edge: cr − ct = (b/2)·tan Λ, cr + ct = 2S/b.
  const sum = (2 * S) / b, diff = (b / 2) * Math.tan(sweepLE * Math.PI / 180);
  const cr = (sum + diff) / 2, ct = (sum - diff) / 2;
  const mac = (2 / 3) * cr * (1 + lam + lam * lam) / (1 + lam);
  const yMac = (b / 6) * (1 + 2 * lam) / (1 + lam);
  // The 0.35 c̄ point is the model's moment reference: that places the wing along the fuselage.
  const leRoot = MODEL.mrc - 0.35 * mac - yMac * Math.tan(sweepLE * Math.PI / 180);
  return {
    src: 'TP-1538 table I, TP-3355 table II', tag: 'PUBLISHED',
    area: S, span: b, semispan: b / 2, taper: lam, sweepLE, sweepTE: 0, mac, yMac,
    cr, ct,                                    // DERIVED: 4.966 and 1.130 m (λ 0.2275 to 0.4 %)
    leRoot,                                    // DERIVED: the trapezoid's LE at the centre line, 6.10 m
    te: leRoot + cr,                           // DERIVED: 11.07 m, the whole span
    le: (y) => leRoot + y * Math.tan(sweepLE * Math.PI / 180),
    chord: (y) => cr + (ct - cr) * (y / (b / 2)),
    thickness: 0.04, airfoil: 'NACA 64A204', dihedral: 0,
    // The strake (TRACED, TP-3355 figure 2 planform): its edge from where it leaves the
    // forebody's side to where it meets the wing's leading edge.
    strake: [[5.0, 0.76], [5.6, 0.86], [6.2, 0.99], [6.7, 1.12], [7.21, 1.32]],
    // Control surfaces (TRACED): flaperon chord and span, leading-edge flap hinge line.
    flaperon: { y0: 0.97, y1: 3.3, chord: 0.55 },
    lefHinge: [[1.32, 0.79], [4.28, 0.35]],    // [y, chord aft of the LE]
  };
})();

/** Horizontal tails, each (TP-3355 table II: exposed 0.283 ft² both, semispan 4.642 in, c̄ 4.725 in). */
export const HTAIL = (() => {
  const S = 0.283 / 2 * 225 * FT * FT, b = 4.642 * SCALE, mac = 4.725 * SCALE;
  // cr + ct = 2S/b and cr² + cr·ct + ct² = 1.5·c̄·(cr + ct).
  const sum = 2 * S / b, q = 1.5 * mac * sum, prod = sum * sum - q;
  const d = Math.sqrt(sum * sum - 4 * prod);
  return {
    src: 'TP-3355 table II', tag: 'PUBLISHED', area: S, semispan: b, mac, sweepLE: 40, dihedral: -10,
    cr: (sum + d) / 2, ct: (sum - d) / 2,       // DERIVED: 2.47 and 0.88 m
    rootLE: 12.2, rootY: 0.97, rootZ: 0.0,      // TRACED: at the aft fuselage's side, on the waterline
    pivot: 13.0,                                // ESTIMATE: the all-moving tail's spindle station
    section: 'biconvex', tRoot: 0.06, tTip: 0.035,
  };
})();

/** Vertical tail (TP-3355 table II: 0.243 ft², exposed span 6.733 in, c̄ 5.470 in, Λ 47.5°). */
export const FIN = (() => {
  const S = 0.243 * 225 * FT * FT, b = 6.733 * SCALE, mac = 5.470 * SCALE;
  const sum = 2 * S / b, q = 1.5 * mac * sum, prod = sum * sum - q;
  const d = Math.sqrt(sum * sum - 4 * prod);
  return {
    src: 'TP-3355 table II', tag: 'PUBLISHED', area: S, span: b, mac, sweepLE: 47.5,
    cr: (sum + d) / 2, ct: (sum - d) / 2,       // DERIVED: 2.76 and 1.20 m
    // The exposed root on the spine at z 0.60 (TRACED); placed so the tip's trailing edge is the
    // model's overall length, 15.04 m (DERIVED): its leading edge then crosses z 1.10 at 11.59 m,
    // 9 cm aft of where the figure draws it, within the drawing's precision.
    rootZ: 0.60,
    get rootLE() { return MODEL.length - this.ct - this.span * Math.tan(47.5 * Math.PI / 180); },
    section: 'biconvex', tRoot: 0.053, tTip: 0.03,
    rudder: { z0: 1.0, z1: 2.85, chordRoot: 0.95, chordTip: 0.55 },   // TRACED (≈)
    dorsal: [[9.9, 0.60], [11.5, 1.10]],                               // TRACED: the root fillet
  };
})();

/** Ventral fins, each (TP-3355 table II: 0.071 ft² both, span 1.833 in, c̄ 3.321 in, 30°, 15° cant). */
export const VENTRAL = (() => {
  const S = 0.071 / 2 * 225 * FT * FT, b = 1.833 * SCALE, mac = 3.321 * SCALE;
  const sum = 2 * S / b, q = 1.5 * mac * sum, prod = sum * sum - q;
  const d = Math.sqrt(sum * sum - 4 * prod);
  return {
    src: 'TP-3355 table II', tag: 'PUBLISHED', area: S, span: b, mac, sweepLE: 30, cant: 15,
    cr: (sum + d) / 2, ct: (sum - d) / 2,
    rootLE: 10.45, rootY: 0.47, rootZ: -0.62,   // TRACED
    thickness: 0.0389,
  };
})();

/**
 * The fuselage's lines (TRACED on TP-3355 figure 2, the side view and the planform, ≈ ±5 cm),
 * [s, value] pairs: the top line (under the canopy, its sill), the forebody's bottom, the intake's
 * bottom, the half-width, the height of the widest point (the chine and strake line), the
 * intake's half-width, the canopy's top and half-width.
 */
export const LINES = {
  src: 'TP-3355 figure 2', tag: 'TRACED',
  top: [[0.62, -0.13], [0.75, -0.10], [1.0, 0.0], [1.5, 0.17], [2.0, 0.33], [2.5, 0.44], [3.0, 0.53], [3.5, 0.49], [4.0, 0.48], [4.5, 0.51], [5.0, 0.60], [5.5, 0.70], [6.1, 0.77], [7.0, 0.68], [8.0, 0.62], [9.0, 0.60], [10.0, 0.60], [11.0, 0.61], [12.0, 0.62], [13.0, 0.63], [13.7, 0.62], [14.0, 0.55], [14.6, 0.50]],
  bottom: [[0.62, -0.16], [0.75, -0.20], [1.5, -0.27], [2.5, -0.32], [3.5, -0.29], [4.6, -0.26]],
  intake: [[4.6, -0.86], [8.0, -0.86], [10.0, -0.83], [11.0, -0.70], [12.0, -0.60], [13.0, -0.53], [14.0, -0.47], [14.6, -0.50]],
  width: [[0.62, 0.0], [0.75, 0.06], [1.0, 0.2], [1.5, 0.32], [2.0, 0.42], [2.5, 0.48], [3.0, 0.50], [3.2, 0.57], [4.0, 0.66], [5.0, 0.74], [6.0, 0.83], [7.0, 0.90], [8.0, 0.95], [9.0, 0.97], [13.7, 0.97], [14.0, 0.62], [14.6, 0.52]],
  chine: [[0.62, -0.13], [2.0, -0.07], [3.0, -0.04], [4.6, -0.01], [7.0, 0.02], [14.0, 0.03], [14.6, 0.0]],
  intakeWidth: [[4.6, 0.60], [6.0, 0.62], [9.0, 0.66], [11.0, 0.75], [12.0, 0.84], [13.0, 0.90], [14.0, 0.60], [14.6, 0.52]],
  canopyTop: [[3.0, 0.53], [3.25, 0.72], [3.5, 0.85], [4.0, 1.00], [4.6, 1.10], [5.0, 1.10], [5.5, 0.98], [6.1, 0.77]],
  canopyWidth: [[3.0, 0.04], [3.3, 0.25], [3.7, 0.34], [4.5, 0.38], [5.3, 0.36], [5.8, 0.27], [6.1, 0.10]],
  radomeJoint: 2.1,                             // ESTIMATE (≈, the photographs' radome length)
  intakeLip: 4.6,                               // TRACED
  nozzle: { s0: 14.0, s1: 14.59, r0: 0.55, r1: 0.515, exitArea: 2.766 * 225 * IN * IN },  // TRACED; exit area TP-3355 (0.40 m²)
  inletArea: 3.674 * 225 * IN * IN,             // PUBLISHED (TP-3355 table II): 0.53 m²
};

/**
 * Landing gear (ESTIMATE, ≈: the widely published figures, no primary source reached — the US
 * government sites refuse automated readers): 4.00 m wheelbase, 2.36 m track, 27.75 × 8.75 in main
 * and 18 × 5.7 in nose tyres. The airplane's height on its gear is TP-1538's 5.01 m to the fin tip.
 */
export const GEAR = {
  tag: 'ESTIMATE', wheelbase: 4.00, track: 2.36,
  main: { s: 9.30, d: 27.75 * IN, w: 8.75 * IN }, nose: { s: 5.30, d: 18 * IN, w: 5.7 * IN },
  height: 5.01,                                 // PUBLISHED (TP-1538 figure 2), ground to fin tip
};

/** Mass and inertia (TP-1538 table I, PUBLISHED), and the control limits it gives. */
export const MASS = {
  src: 'TP-1538 table I', tag: 'PUBLISHED',
  weight: 91188 / 9.80665,                      // 20,500 lb
  ixx: 12875, iyy: 75674, izz: 85552, ixz: 1331,
  cgRef: 0.35,                                  // fraction of c̄
  limits: { stab: 25, stabDiff: FCS.diffTail.limit, aileron: 21.5, rudder: 30, lef: 25, speedBrake: 60 },
};

/** NACA 64A006 basic thickness form (TN-1368 figure 7), percent chord: x, half-thickness. */
export const NACA_64A006 = {
  x: [0, 0.5, 0.75, 1.25, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
  y: [0, 0.485, 0.585, 0.739, 1.016, 1.399, 1.684, 1.919, 2.283, 2.557, 2.757, 2.896, 2.977, 2.999, 2.945, 2.825, 2.653, 2.438, 2.188, 1.907, 1.602, 1.285, 0.967, 0.649, 0.331, 0.013],
};

/** Overall figures the exhibit's sheet shows and verify() checks (m). */
export const OVERALL = {
  length: MODEL.length,                         // 15.04 m
  span: 9.45,                                   // TP-1538 figure 2: over the wing-tip launchers
  height: GEAR.height,                          // 5.01 m
  groundWL: FIN.rootZ + FIN.span - GEAR.height, // the ground, below WL 6.607: −1.85 m
};
