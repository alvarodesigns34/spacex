/**
 * North American X-15 #1, USAF 56-6670: the figures the model is built from, each with where
 * it comes from. Three kinds, kept apart on purpose:
 *
 *   PUBLISHED  printed by NASA or in the flight manual, used as given;
 *   MEASURED   read off a dimensioned NASA drawing (TM X-236 figure 2, a 0.02-scale model
 *              drawn in inches, × 50 here), to the drawing's precision (≈ ±1 cm full scale);
 *   DERIVED    worked out from published figures, or reconstructed from photographs (≈).
 *
 * Sources (all consulted for this model on 30 Sep 2026, none of them stored in the repository):
 *  - NASA TN D-3343 (1966), table I "Physical characteristics of the basic X-15 airplane";
 *  - NASA TM X-236 (1960), table II "Airfoil section ordinates" and figure 2 (dimensioned);
 *  - NASA TM X-207 (1959), the landing gear: figures 2–4 and its text;
 *  - T.O. 1X-15-1 flight manual, section I, "Airplane dimensions" (serials 56-6670 to -6672);
 *  - NASA SP-60 (1965), "X-15 Research Results": the XLR99 and the tank capacities;
 *  - Smithsonian NASM, object A19690360000 (56-6670 itself): photographs, reference only;
 *  - NASA photograph EC67-1652: 56-6670 on Rogers Dry Lake after a flight, 1967 (reference).
 *
 * Frame: stations `s` in metres aft of the drawing's nose apex along the fuselage reference
 * line (FRL); heights above the FRL; half-widths from the plane of symmetry.
 */
const FT = 0.3048, IN = 0.0254;
/** TM X-236 figure 2 is a 0.02-scale model drawn in inches: one drawing inch is 1.27 m. */
const MODEL_IN = 50 * IN;

// ---- Published -------------------------------------------------------------------------
export const X15 = {
  // Flight manual T.O. 1X-15-1, p. 1-1: in flight, gear up, ventral retained.
  length: 49 * FT + 2 * IN,          // 14.986 m
  span: 22 * FT + 4 * IN,            // 6.807 m (TN D-3343: 22.36 ft = 6.815 m)
  height: 13 * FT + 1 * IN,          // 3.988 m, fin tip to fin tip
  // Landing configuration: gear down, ventral jettisoned, fin tip to the ground.
  landingHeight: 11 * FT + 6 * IN,   // 3.505 m
  launchWeightLb: 32900,

  // TN D-3343, table I.
  wing: {
    area: 200 * FT * FT, span: 22.36 * FT, mac: 10.27 * FT, rootChord: 14.91 * FT, tipChord: 2.98 * FT,
    sweepQuarter: 25.64, taper: 0.2, aspect: 2.5, incidence: 0, dihedral: 0, twist: 0,
    flap: { area: 8.3 * FT * FT, span: 4.5 * FT, inboardChord: 2.61 * FT, outboardChord: 1.08 * FT, deflection: 32, deflectionOriginal: 40 },
  },
  htail: {
    area: 115.34 * FT * FT, span: 18.08 * FT, mac: 7.05 * FT, rootChord: 10.22 * FT, tipChord: 2.11 * FT,
    sweepQuarter: 45, dihedral: -15, movableArea: 51.77 * FT * FT, up: 15, down: 35, differential: 15,
  },
  upperFin: { area: 40.91 * FT * FT, span: 4.58 * FT, rootChord: 10.21 * FT, tipChord: 7.56 * FT, sweepQuarter: 23.41, wedge: 10, movableArea: 26.45 * FT * FT, deflection: 7.5 },
  lowerFin: { area: 34.41 * FT * FT, span: 3.83 * FT, rootChord: 10.21 * FT, tipChord: 8.0 * FT, sweepQuarter: 23.41, wedge: 10, movableArea: 19.95 * FT * FT, deflection: 7.5 },
  fuselage: { length: 49.5 * FT, maxWidth: 7.33 * FT, maxDepth: 4.67 * FT, depthOverCanopy: 4.97 * FT },
  speedBrake: { area: 5.37 * FT * FT, meanSpan: 1.6 * FT, chord: 3.36 * FT, deflection: 35 },

  // SP-60 p. 28: XLR99 nozzle diameter 39.3 in, overall length 82 in, 1025 lb, 57 000 lbf.
  // Area ratio 9.8 (NASA, the standard nozzle); throat = exit / √9.8.
  xlr99: { exitDiameter: 39.3 * IN, length: 82 * IN, areaRatio: 9.8, thrustLbf: 57000 },

  // TM X-207: main-gear skids 3 ft × 6 in of 4130 steel; nose tyres 18 × 4.4 in, rolling
  // radius 8 in; nose to main gear 39.1 ft (its figure 2); main oleo 12.710 in extended,
  // 2.577 in of stroke; nose strut 18 in of travel.
  gear: { skidLength: 3 * FT, skidWidth: 6 * IN, noseTyreDiameter: 18 * IN, noseTyreWidth: 4.4 * IN, noseRollingRadius: 8 * IN, wheelbase: 39.1 * FT, noseTravel: 18 * IN },
};

// ---- Measured on TM X-236 figure 2 (model inches × 50) ---------------------------------
export const STATIONS = {
  apexToBase: 11.76 * MODEL_IN,        // 14.935 m: the drawn ogive's apex to the base
  wingRootLE: 5.512 * MODEL_IN,        // on the centre line, theoretical: 7.000 m
  htailExposedLE: 9.578 * MODEL_IN,    // at the side-fairing edge: 12.164 m
  finRootLE: 9.030 * MODEL_IN,         // at the fuselage surface: 11.468 m
  fairingStart: 3.00 * MODEL_IN,       // 3.810 m
  fairingEnd: 11.25 * MODEL_IN,        // blunt end: 14.288 m
  canopyStart: 1.577 * MODEL_IN,       // windshield base, plan view: 2.003 m
  bodyRadius: 1.12 / 2 * MODEL_IN,     // 0.711 m (TN D-3343: 4.67 ft depth)
  baseRadius: 0.96 / 2 * MODEL_IN,     // 0.610 m, boat-tailed base
  fairingHalfWidth: 1.76 / 2 * MODEL_IN, // 1.118 m (TN D-3343: 7.33 ft)
  upperFinTip: 1.660 * MODEL_IN,       // 2.108 m above the FRL
  lowerFinTip: 1.480 * MODEL_IN,       // 1.880 m below it: 2.108 + 1.880 = 3.988 m, the manual's height
  rudderBoundary: 0.910 * MODEL_IN,    // 1.156 m from the FRL, up and down: fixed fin inboard, rudder out
  wingLESweep: 36.75, wingTESweep: 17.74,
  htailLESweep: 50.58, htailTESweep: 19.28,
  finLESweep: 30,
};

/**
 * Fuselage outline traced on figure 2 (full-scale metres; station, value). Upper: the body's
 * top line (under the canopy, the canopy's base). Lower: the keel line, below the FRL.
 * Plan: the outer half-width (the side fairing from 3.81 m). The nose is not symmetric about
 * the FRL: the keel falls away faster than the top, as in every side view of the aircraft.
 */
export const OUTLINE = {
  top: [[0.25, 0.069], [0.48, 0.135], [0.71, 0.195], [0.94, 0.254], [1.17, 0.294], [1.40, 0.347], [1.63, 0.380], [1.85, 0.413], [2.08, 0.439], [2.31, 0.453], [2.54, 0.466], [2.77, 0.472], [3.23, 0.482], [3.45, 0.512], [3.68, 0.545], [3.91, 0.572], [4.14, 0.591], [4.37, 0.611], [4.60, 0.638], [4.83, 0.660], [5.28, 0.680], [5.51, 0.691], [5.97, 0.704], [6.50, 0.711]],
  keel: [[0.38, 0.229], [0.91, 0.355], [1.45, 0.454], [1.98, 0.533], [2.52, 0.586], [3.05, 0.639], [3.58, 0.666], [4.12, 0.699], [4.65, 0.711], [11.6, 0.711], [12.12, 0.705], [12.65, 0.692], [13.18, 0.672], [13.72, 0.646], [14.935, 0.610]],
  // Plan half-width, corrected for the drawing's 1.7 % taller-than-wide scan (the 1.76 in
  // fairing reads 172 px across and the 1.12 in body 107.5 px high).
  plan: [[0.30, 0.153], [0.58, 0.245], [0.86, 0.322], [1.14, 0.387], [1.42, 0.446], [1.70, 0.504], [1.98, 0.550], [2.26, 0.583], [2.54, 0.615], [2.82, 0.635], [3.10, 0.654], [3.38, 0.667], [3.66, 0.680], [3.81, 0.700], [4.2, 0.711]],
  // Side fairing: plan half-width from its start, and its upper and lower edges.
  fairingWidth: [[3.81, 0.711], [4.22, 0.777], [4.50, 0.823], [4.78, 0.869], [5.06, 0.914], [5.33, 0.953], [5.61, 0.992], [5.89, 1.031], [6.17, 1.063], [6.45, 1.090], [6.73, 1.103], [7.01, 1.112], [7.30, 1.118], [14.288, 1.118]],
  fairingUp: [[3.81, 0.0], [4.30, 0.17], [5.08, 0.267], [5.79, 0.300], [6.50, 0.347], [7.21, 0.386], [7.92, 0.406], [8.64, 0.432], [9.35, 0.426], [10.77, 0.413], [11.84, 0.400], [12.90, 0.380], [13.97, 0.347], [14.288, 0.340]],
  fairingLo: [[3.81, 0.0], [4.30, 0.22], [5.08, 0.355], [5.79, 0.381], [6.50, 0.414], [7.21, 0.434], [7.92, 0.447], [8.64, 0.454], [9.70, 0.447], [10.77, 0.441], [11.84, 0.421], [12.55, 0.394], [12.90, 0.388], [14.288, 0.380]],
  // Canopy: its top line in side view, and its half-width in plan.
  canopyTop: [[1.85, 0.413], [1.96, 0.439], [2.06, 0.532], [2.16, 0.618], [2.26, 0.691], [2.36, 0.730], [2.46, 0.763], [2.57, 0.770], [2.72, 0.783], [2.92, 0.790], [3.23, 0.797], [3.61, 0.797], [3.91, 0.790], [4.14, 0.777], [4.37, 0.763], [4.52, 0.744], [4.67, 0.724], [4.75, 0.711], [4.90, 0.690], [5.05, 0.680]],
  canopyHalf: [[2.03, 0.0], [2.11, 0.044], [2.21, 0.077], [2.31, 0.110], [2.41, 0.143], [2.52, 0.183], [2.62, 0.222], [2.72, 0.255], [2.82, 0.288], [2.92, 0.322], [3.23, 0.322], [3.45, 0.316], [3.68, 0.303], [3.91, 0.283], [4.14, 0.264], [4.37, 0.232], [4.60, 0.186], [4.83, 0.140], [4.98, 0.100]],
};

// ---- Derived ---------------------------------------------------------------------------
/**
 * The ball nose. Flight 56-6670 flew the late "ball nose" (a flow-direction sensor) rather
 * than the pitot boom drawn in 1959. The manual's 49 ft 2 in is ≈0.05 m more than the drawn
 * ogive's apex to the base, and a ball at the ogive's own point would make the airplane
 * ≈0.14 m shorter still: the ball-nose section is a straight cone, bare metal in every
 * photograph of 56-6670, from a riveted ring at ≈0.9 m to the ball. Its length is set so the
 * whole airplane is the manual's; the ball and the ring are sized off the NASM photographs (≈).
 */
export const NOSE = {
  tip: STATIONS.apexToBase - X15.length,  // −0.051 m: the ball's front, ahead of the drawn apex
  ballRadius: 0.115,                       // ≈ (NASM photograph, against the cone)
  ringStation: 0.9,                        // ≈ the end of the bare-metal cone
};

/** Straight-tapered planform, as the tables give it: LE station and chord at a span station. */
export function planform({ rootLE, rootChord, tipChord, semispan, leSweep }) {
  const t = Math.tan(leSweep * Math.PI / 180);
  return {
    le: (y) => rootLE + y * t,
    chord: (y) => rootChord + (tipChord - rootChord) * y / semispan,
    semispan,
  };
}

/**
 * The wing. Its root chord is theoretical, on the centre line; the tip's LE follows from the
 * 36.75° LE sweep and lands where 25.64° at the quarter chord puts it (a check: 2.545 m aft of
 * the root LE either way).
 */
export const WING = planform({ rootLE: STATIONS.wingRootLE, rootChord: X15.wing.rootChord, tipChord: X15.wing.tipChord, semispan: X15.wing.span / 2, leSweep: STATIONS.wingLESweep });

/**
 * The horizontal tail's planform is defined in its own (anhedral) plane: 45° at the quarter
 * chord and 50.58° at the LE meet only with a 2.853 m semispan along the surface, which the 15°
 * of anhedral projects to the published 18.08 ft / 2 = 2.755 m. The root LE, on the centre
 * line, puts the exposed root (chord 2.106 m, figure 2) at the measured 12.164 m.
 */
const HT_SEMI = X15.htail.span / 2 / Math.cos(15 * Math.PI / 180);
const HT_T = Math.tan(STATIONS.htailLESweep * Math.PI / 180);
const HT_EXPOSED_ROOT = 1.658 * MODEL_IN;            // 2.106 m (TM X-236 table I)
const HT_E_EXPOSED = (X15.htail.rootChord - HT_EXPOSED_ROOT) / (X15.htail.rootChord - X15.htail.tipChord) * HT_SEMI;
export const HTAIL = planform({ rootLE: STATIONS.htailExposedLE - HT_E_EXPOSED * HT_T, rootChord: X15.htail.rootChord, tipChord: X15.htail.tipChord, semispan: HT_SEMI, leSweep: STATIONS.htailLESweep });
export const HTAIL_EXPOSED_ROOT = HT_E_EXPOSED;      // ≈1.083 m along the surface

/** Vertical tails: 30° LE, 0° TE, root LE at the fuselage surface at 11.468 m. */
export const UPPER_FIN = { rootLE: STATIONS.finRootLE, rootY: STATIONS.upperFinTip - X15.upperFin.span, span: X15.upperFin.span, rootChord: X15.upperFin.rootChord, tipChord: X15.upperFin.tipChord };
export const LOWER_FIN = { rootLE: STATIONS.finRootLE, rootY: STATIONS.lowerFinTip - X15.lowerFin.span, span: X15.lowerFin.span, rootChord: X15.lowerFin.rootChord, tipChord: X15.lowerFin.tipChord };

/**
 * Modified NACA 66-005 half-thickness, percent of chord (TM X-236 table II). Wing: root and tip
 * columns, linear taper between them forward of 15 % chord; straight sides aft of 67 % to a
 * 1 %-thick (blunt) trailing edge. LE radius 0.015 in (model) at the root, 0.008 at the tip:
 * 19 mm and 10 mm full scale.
 */
export const WING_AIRFOIL = {
  x: [0, 1.25, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 67, 100],
  root: [0, 0.358, 0.533, 0.854, 1.137, 1.382, 1.759, 2.001, 2.182, 2.318, 2.416, 2.476, 2.500, 2.485, 2.432, 2.332, 2.151, 2.085, 0.500],
  tip: [0, 1.048, 1.123, 1.263, 1.395, 1.523, 1.769, 2.001, 2.182, 2.318, 2.416, 2.476, 2.500, 2.485, 2.432, 2.332, 2.151, 2.085, 0.500],
  leRadius: [0.015 * MODEL_IN, 0.008 * MODEL_IN],
};
/** Horizontal tails: their own table (TM X-236 table II(b)), LE radius 0.010 / 0.005 in. */
export const HTAIL_AIRFOIL = {
  x: [0, 0.1, 0.25, 0.5, 0.75, 1.25, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 100],
  root: [0, 0.269, 0.408, 0.531, 0.590, 0.650, 0.791, 1.048, 1.268, 1.458, 1.765, 2.001, 2.182, 2.318, 2.416, 2.476, 2.500, 2.485, 2.432, 2.332, 1.653, 0.961, 0.500],
  tip: [0, 0.348, 0.538, 0.728, 0.846, 0.969, 1.052, 1.206, 1.353, 1.493, 1.768, 2.001, 2.182, 2.318, 2.416, 2.476, 2.500, 2.485, 2.432, 2.332, 1.653, 0.961, 0.500],
  leRadius: [0.010 * MODEL_IN, 0.005 * MODEL_IN],
};

/**
 * Landing gear. Stations measured on TM X-207 figure 2 (the 49.5 ft fuselage as the rule): the
 * nose wheels' contact 1.55 m aft of the apex, the skids' 39.1 ft (published) behind it. The
 * height at the nose is NASA's photograph EC67-1652 (56-6670 on Rogers Dry Lake, 1967), with
 * the 18 in tyre as the rule: the keel 0.61 m above the lakebed at the nose gear, so the FRL
 * 1.08 m up (≈). TM X-207's 1959 schematic draws the nose gear ≈0.25 m shorter. The skids'
 * height is the one that puts the upper fin tip at the manual's 11 ft 6 in with the ventral
 * gone, which leaves the airplane ≈1.4° nose-down on its gear.
 */
export const GEAR = {
  noseStation: 1.55,
  skidStation: 1.55 + X15.gear.wheelbase,   // 13.468 m
  noseFRLHeight: 1.08,                      // ≈ measured on EC67-1652
  tread: 9.17 * FT,                         // TM X-207 table II: "maximum allowable tread" (≈ as built)
};

/** Wing-tip pods: on 56-6670 as the NASM keeps it (late experiment pods). Sized off its photographs (≈). */
export const TIP_POD = { radius: 0.105, length: 1.12, front: -0.18 };

export const MODEL_INCH = MODEL_IN;
