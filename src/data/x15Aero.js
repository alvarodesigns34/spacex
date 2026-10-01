/**
 * The X-15's aerodynamic, mass and propulsion data for the flight model (sim/x15Flight.js), each
 * table tagged with where it comes from:
 *
 *  - PUBLISHED: a number printed in the source;
 *  - DIGITIZED: read off a published figure (300 dpi scans for TN D-3343, 130–150 dpi for the
 *    others), the faired curve where the figure gives one; ≈±3 % of the figure's full scale;
 *  - DERIVED: computed from published or digitized numbers, the method stated;
 *  - ESTIMATE: no published value found; the basis is stated and the value is marked ≈.
 *
 * Sources (src/data/specs.js has the links):
 *  - TN D-3343 (Saltzman & Garringer 1966): full-scale trimmed lift and drag, power off;
 *  - TN D-2532 (Yancey 1964): flight-measured stability and control derivatives to Mach 6.02 and
 *    25° angle of attack, the inertias against weight (figure 3, the manufacturer's);
 *  - TM X-714 (Walker & Wolowicz 1962): the trim capability, α against Mach for three
 *    stabilizer settings (figure 8);
 *  - CR-2144 (Heffley & Jewell 1972): the dimensional lateral derivatives at ten flight
 *    conditions (table V-6), from which the roll-damping and cross derivatives are derived;
 *  - SP-60: the XLR99 (57,000 lbf, 13,000 lb of propellant a minute, 18,000 lb, 85 s);
 *  - TM X-207: the gear, the first landing (158 kt, 8.5°, 2 ft/s at the skids).
 *
 * Conventions are the reports': angles in degrees, derivatives per degree unless named "per
 * radian"; α and β the body angles of attack and sideslip; δh the horizontal tails' symmetric
 * deflection, leading edge up positive (so negative δh is nose up); δa the tails' differential
 * deflection, left surface trailing edge down positive; δv the rudder, trailing edge left positive.
 * Reference area S = 200 ft², span b = 22.36 ft, chord c̄ = 10.27 ft, the centre of gravity at
 * 20 % of c̄ (TN D-2532 table I).
 *
 * The configuration is the one the exhibit shows and the late flights flew: the lower rudder
 * (the ventral) off. Where a figure gives both, the "lower rudder off" panel is used; where it
 * gives only "on" (yaw damping), that is said.
 */

export const FT = 0.3048, LBF = 4.4482216152605, LB = 0.45359237, SLUG_FT2 = 1.3558179483314;

/** Reference geometry and masses (TN D-2532 table I, PUBLISHED). */
export const REF = {
  S: 200 * FT * FT,
  b: 22.36 * FT,
  cbar: 10.27 * FT,
  cgFractionMAC: 0.20,
  launchWeightLb: 33000,
  landingWeightLb: 14700,
};

/** Interpolation over a sorted abscissa, held flat beyond its ends. */
export function lerp1(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  const n = xs.length - 1;
  if (x >= xs[n]) return ys[n];
  let i = 0;
  while (x > xs[i + 1]) i++;
  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + (ys[i + 1] - ys[i]) * t;
}

/**
 * A derivative given in angle-of-attack bands (the reports plot one panel per band, each faired
 * through flight points at a representative α): interpolated in Mach on each band, then in α
 * between the bands' representative angles, held beyond the outer ones.
 */
export function banded(table, M, alpha) {
  const vals = table.bands.map(b => lerp1(table.M, b.v, M));
  return lerp1(table.bands.map(b => b.alpha), vals, Math.abs(alpha));
}

// ---- Lift and drag -------------------------------------------------------------------------------

/**
 * Normal-force-curve slope, per degree (TN D-2532 figure 14, DIGITIZED: the faired curves for
 * α −2.7°…8° and 8°…16°, drawn at α = 4° and 12°). The slope used as a secant, CN = α · slope:
 * the rise at high α is the hypersonic body lift.
 */
export const CN_ALPHA = {
  src: 'TN D-2532 fig. 14', tag: 'DIGITIZED',
  M: [0.6, 0.7, 1.0, 1.1, 1.2, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 6.8],
  bands: [
    { alpha: 4, v: [0.065, 0.0665, 0.077, 0.080, 0.082, 0.070, 0.063, 0.0535, 0.0445, 0.038, 0.034, 0.0307, 0.030, 0.030] },
    { alpha: 12, v: [0.065, 0.068, 0.083, 0.0874, 0.085, 0.075, 0.064, 0.057, 0.051, 0.047, 0.044, 0.040, 0.038, 0.0378] },
  ],
};

/**
 * Trimmed drag coefficient against Mach at constant lift coefficient, power off (TN D-3343
 * figure 9, DIGITIZED by column scans of the 300 dpi page, then checked by eye; dashed
 * "interpolated" stretches of the CL 0.4–0.6 curves included as printed). Rows: CL 0 … 0.6.
 * Below M 0.7 held; M 0.9 and 1.1 read by eye where the curves crowd.
 */
export const CD_POLAR = {
  src: 'TN D-3343 fig. 9', tag: 'DIGITIZED',
  M: [0.7, 0.8, 0.9, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2, 4.6, 5.0, 5.4, 5.7],
  CL: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
  CD: [
    [0.0636, 0.0657, 0.068, 0.122, 0.116, 0.099, 0.0901, 0.0821, 0.0764, 0.0712, 0.0643, 0.0570, 0.0495, 0.0438, 0.0397, 0.0362, 0.0340, 0.0315, 0.0300],
    [0.0658, 0.0660, 0.070, 0.127, 0.120, 0.103, 0.0930, 0.0861, 0.0809, 0.0769, 0.0709, 0.0639, 0.0580, 0.0542, 0.0511, 0.0483, 0.0463, 0.0445, 0.0435],
    [0.0719, 0.0726, 0.0743, 0.132, 0.126, 0.1142, 0.1057, 0.1001, 0.0962, 0.0920, 0.0870, 0.0849, 0.0844, 0.0842, 0.0840, 0.0835, 0.0828, 0.0814, 0.0799],
    [0.0830, 0.0833, 0.0861, 0.144, 0.1405, 0.1327, 0.1273, 0.1237, 0.1211, 0.1188, 0.1192, 0.1232, 0.1266, 0.1289, 0.1308, 0.1324, 0.1339, 0.1346, 0.1346],
    [0.0986, 0.0996, 0.1027, 0.161, 0.159, 0.1551, 0.1533, 0.1544, 0.1571, 0.1606, 0.1707, 0.1817, 0.1901, 0.1949, 0.1985, 0.2008, 0.2024, 0.2032, 0.2036],
    [0.1214, 0.1251, 0.1343, 0.187, 0.1854, 0.1859, 0.1890, 0.1940, 0.2013, 0.2096, 0.2277, 0.2458, 0.2616, 0.2743, 0.2815, 0.2857, 0.2883, 0.2892, 0.2892],
    [0.1374, 0.1518, 0.180, 0.218, 0.2174, 0.2218, 0.2309, 0.2443, 0.2587, 0.2727, 0.2987, 0.3209, 0.3418, 0.3607, 0.3754, 0.3831, 0.3879, 0.3902, 0.3902],
  ],
};

/**
 * Base drag of the fuselage and skids, power off (TN D-3343 figure 14a, DIGITIZED, the lowest
 * band). With the XLR99 burning, the jet fills that base, so the flight model takes it off the
 * polar (DERIVED; the report's base-pressure analysis supports the jet raising the fuselage
 * base pressure, not this exact amount).
 */
export const CD_BASE_FUSELAGE = {
  src: 'TN D-3343 fig. 14a', tag: 'DIGITIZED',
  M: [0.6, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0],
  v: [0.0225, 0.0225, 0.0211, 0.0184, 0.0146, 0.0110, 0.0082, 0.0044, 0.0025, 0.0016],
};

/**
 * Speed-brake drag increment, all four panels at 35°, on the wing area (TN D-3343 figure 19a,
 * DIGITIZED, the full-scale flight curve). Subsonic: held at the M 1 flight point (≈).
 */
export const CD_SPEEDBRAKE = {
  src: 'TN D-3343 fig. 19a', tag: 'DIGITIZED',
  M: [0.8, 1.0, 1.4, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 5.8],
  v: [0.118, 0.119, 0.100, 0.095, 0.082, 0.0727, 0.066, 0.0617, 0.0587, 0.056, 0.0547],
};

/**
 * Flaps (40° down) and gear: no flight increment was found. ESTIMATE (≈): plain flaps of 8 %
 * of the wing area at 40° (TN D-2532 table I) on a low-aspect-ratio wing, ΔCL ≈ 0.10 and
 * ΔCD ≈ 0.025; the extended skids and nose gear ΔCD ≈ 0.012. Used only below Mach 0.8.
 */
export const FLAPS_GEAR = { tag: 'ESTIMATE', flapCL: 0.10, flapCD: 0.025, gearCD: 0.012 };

// ---- Pitch -------------------------------------------------------------------------------------------

/** Static longitudinal stability, per degree, three α bands (TN D-2532 figure 15, DIGITIZED). */
export const CM_ALPHA = {
  src: 'TN D-2532 fig. 15', tag: 'DIGITIZED',
  M: [0.7, 1.0, 1.3, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 6.8],
  bands: [
    { alpha: 2, v: [-0.0143, -0.0218, -0.026, -0.0278, -0.0248, -0.0193, -0.0148, -0.0115, -0.0093, -0.0060, -0.0038, -0.0030] },
    { alpha: 9, v: [-0.024, -0.033, -0.032, -0.0316, -0.0265, -0.0204, -0.0145, -0.0115, -0.0087, -0.0056, -0.0043, -0.0036] },
    { alpha: 13.5, v: [-0.039, -0.036, -0.038, -0.034, -0.0246, -0.019, -0.0134, -0.0095, -0.0060, -0.0080, -0.0072, -0.0065] },
  ],
};

/** Longitudinal control, per degree of δh, two α bands (TN D-2532 figure 18, DIGITIZED). */
export const CM_DH = {
  src: 'TN D-2532 fig. 18', tag: 'DIGITIZED',
  M: [0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 6.8],
  bands: [
    { alpha: 3, v: [-0.0239, -0.0259, -0.0259, -0.0225, -0.0175, -0.0127, -0.0104, -0.0088, -0.0069, -0.0057, -0.0049, -0.0045] },
    { alpha: 14, v: [-0.0248, -0.0270, -0.0293, -0.0248, -0.0198, -0.0139, -0.0113, -0.0099, -0.0095, -0.0095, -0.0089, -0.0083] },
  ],
};

/**
 * Pitch damping Cmq + Cmα̇, per radian (TN D-2532 figure 17, DIGITIZED). The faired wind-tunnel
 * curve to Mach 3; from 3.4 to 4.4 the flight points (−6.5 … −7.3) lie well above it, and the
 * model follows them (−6.5), tapering to the curve's trend beyond (≈).
 */
export const CM_Q = {
  src: 'TN D-2532 fig. 17', tag: 'DIGITIZED',
  M: [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, 2.5, 3.0, 3.5, 4.4, 5.0, 6.0, 6.8],
  v: [-11.4, -13.3, -18.0, -13.3, -10.6, -8.5, -6.0, -5.3, -4.7, -6.5, -6.5, -6.0, -5.2, -4.5],
};

/**
 * Trim angle of attack for three stabilizer settings (TM X-714 figure 8, DIGITIZED: δh −10°,
 * −20° and −35°, Mach 1 to 6). The pitching moment is built so that the airplane trims there:
 * Cm = Cmα(α) · (α − αtrim(δh)) + Cmq·qc̄/2V. Between and beyond the printed settings αtrim
 * moves with δh at the rate −Cmδh/Cmα (DERIVED). Checked: the δh effectiveness that this implies
 * between the −10° and −20° curves is −0.0081 at M 3 and −0.0092 at M 5, against the
 * −0.0088 and −0.0095 TN D-2532 measured.
 * Below Mach 1 the figure has no data: the M 1.0 trim points are held (ESTIMATE, ≈).
 */
export const ALPHA_TRIM = {
  src: 'TM X-714 fig. 8', tag: 'DIGITIZED',
  M: [1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0],
  dh: [-10, -20, -35],
  alpha: [
    [13.0, 10.8, 7.3, 5.5, 5.1, 5.2, 5.6, 6.2, 7.5, 8.9],
    [19.5, 18.0, 14.1, 11.7, 10.2, 10.7, 13.5, 16.2, 19.0, 20.6],
    [20.2, 20.2, 18.8, 17.2, 17.1, 20.2, 23.7, 26.4, 29.7, 31.7],
  ],
};

// ---- Lateral-directional (lower rudder off) ----------------------------------------------------------

/**
 * Directional stability Cnβ, per degree (TN D-2532 figure 19b, DIGITIZED). Low-α band faired
 * through the flight points from Mach 2 to 5, which lie below the wind-tunnel line (≈0.0042
 * against 0.0051–0.0059 at Mach 2.3–3); the others on the wind-tunnel line.
 */
export const CN_BETA = {
  src: 'TN D-2532 fig. 19b', tag: 'DIGITIZED',
  M: [0.4, 1.0, 1.5, 2.0, 2.3, 2.5, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 4, v: [0.0074, 0.0084, 0.0096, 0.0060, 0.0042, 0.0042, 0.0042, 0.0041, 0.0030, 0.0030] },
    { alpha: 12, v: [0.0041, 0.0055, 0.0044, 0.0031, 0.0024, 0.0020, 0.0008, 0.0008, 0.0011, 0.0015] },
    { alpha: 20, v: [-0.0034, 0.0, -0.0021, -0.0013, -0.0009, -0.0006, 0.0, 0.0008, 0.0020, 0.0026] },
  ],
};

/** Effective dihedral Clβ, per degree (TN D-2532 figure 20b, DIGITIZED). */
export const CL_BETA = {
  src: 'TN D-2532 fig. 20b', tag: 'DIGITIZED',
  M: [0.5, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 4, v: [-0.0010, -0.00098, -0.00096, -0.00093, -0.0009, -0.0008, -0.0007, -0.0006, -0.0005, -0.0005] },
    { alpha: 12, v: [-0.00185, -0.0018, -0.0017, -0.00124, -0.0008, -0.0006, -0.0006, -0.00058, -0.00033, 0.0002] },
    { alpha: 20, v: [-0.00044, -0.0014, -0.0020, -0.0019, -0.00116, -0.0010, -0.0013, -0.0011, -0.00084, -0.0007] },
  ],
};

/** Side force CYβ, per degree (TN D-2532 figure 21b, DIGITIZED). */
export const CY_BETA = {
  src: 'TN D-2532 fig. 21b', tag: 'DIGITIZED',
  M: [0.6, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 4, v: [-0.0197, -0.0217, -0.0217, -0.0192, -0.0181, -0.0170, -0.0155, -0.0144, -0.0135] },
    { alpha: 12, v: [-0.0194, -0.0205, -0.0200, -0.0183, -0.0176, -0.0169, -0.0163, -0.0160, -0.0160] },
    { alpha: 20, v: [-0.0143, -0.0171, -0.0163, -0.0171, -0.0186, -0.0200, -0.0206, -0.0206, -0.0206] },
  ],
};

/**
 * Yaw damping Cnr − Cnβ̇, per radian (TN D-2532 figure 22, DIGITIZED). The report has it only
 * with the lower rudder on; used as it is (≈ for the lower-rudder-off airplane).
 */
export const CN_R = {
  src: 'TN D-2532 fig. 22', tag: 'DIGITIZED',
  M: [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0],
  v: [-1.33, -1.6, -1.87, -1.92, -1.8, -1.5, -1.46, -1.38, -1.14, -0.99, -0.88],
};

/** Rudder power Cnδv, per degree (TN D-2532 figure 23b, DIGITIZED). */
export const CN_DV = {
  src: 'TN D-2532 fig. 23b', tag: 'DIGITIZED',
  M: [0.5, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 3.5, v: [-0.00283, -0.00344, -0.00350, -0.00356, -0.00328, -0.00272, -0.00217, -0.00172, -0.00144] },
    { alpha: 10, v: [-0.00255, -0.00300, -0.00317, -0.00305, -0.00283, -0.00178, -0.00139, -0.00117, -0.00100] },
    { alpha: 18, v: [-0.0022, -0.0029, -0.0031, -0.0029, -0.0025, -0.00135, -0.00065, -0.00038, -0.00032] },
  ],
};

/** Rolling moment from the rudder Clδv, per degree (TN D-2532 figure 24b, DIGITIZED). */
export const CL_DV = {
  src: 'TN D-2532 fig. 24b', tag: 'DIGITIZED',
  M: [0.5, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 3.5, v: [0.00049, 0.00073, 0.00080, 0.00086, 0.00075, 0.00070, 0.00064, 0.00062, 0.00059] },
    { alpha: 10, v: [0.00046, 0.00070, 0.00075, 0.00072, 0.00068, 0.00060, 0.00058, 0.00052, 0.00050] },
    { alpha: 18, v: [0.00046, 0.00068, 0.00073, 0.00070, 0.00066, 0.00053, 0.00041, 0.00030, 0.00019] },
  ],
};

/** Roll control Clδa and adverse yaw Cnδa, per degree of δa (TN D-2532 figure 25, DIGITIZED). */
export const CL_DA = {
  src: 'TN D-2532 fig. 25', tag: 'DIGITIZED',
  M: [0.5, 0.6, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 8, v: [0.00125, 0.00129, 0.00164, 0.00146, 0.00114, 0.00089, 0.00071, 0.00060, 0.00060, 0.00061] },
    { alpha: 16, v: [0.00143, 0.00150, 0.00164, 0.00131, 0.00100, 0.00087, 0.00074, 0.00071, 0.00081, 0.00089] },
  ],
};
export const CN_DA = {
  src: 'TN D-2532 fig. 25', tag: 'DIGITIZED',
  M: [0.6, 0.9, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0],
  bands: [
    { alpha: 8, v: [0.00118, 0.00115, 0.00114, 0.00112, 0.00110, 0.00098, 0.00081, 0.00063, 0.00055, 0.00045] },
    { alpha: 16, v: [0.00095, 0.00083, 0.00100, 0.00120, 0.00146, 0.00139, 0.00124, 0.00109, 0.00095, 0.00083] },
  ],
};

/**
 * Roll damping Clp and the cross derivatives Cnp, Clr, per radian: DERIVED from CR-2144 table
 * V-6 (dimensional L'p, N'p, L'r at ten trimmed conditions) with that report's own mass and
 * flight-condition table V-1 (W 15,560 lb, Ix 3,650 slug·ft², Iz 82,000): Clp = L'p · Ix · 2V /
 * (q̄ S b²). The primes fold in Ixz = 590 slug·ft²; ignored (≈ 2 %). Clr scatters about zero
 * in that table (−0.05 … +0.08) and is taken as 0 (≈).
 */
export const LATERAL_DAMPING = {
  src: 'CR-2144 tables V-1, V-6', tag: 'DERIVED',
  M: [0.5, 0.8, 1.2, 2.0, 3.0, 6.0],
  Clp: [-0.28, -0.30, -0.36, -0.34, -0.24, -0.145],
  Cnp: [0.03, -0.01, -0.09, -0.055, -0.094, -0.128],
  Clr: 0,
};

// ---- Mass ---------------------------------------------------------------------------------------------

/**
 * Moments of inertia against gross weight, slug·ft², YLR99 airplane, power on (TN D-2532 figure
 * 3, the manufacturer's data; DIGITIZED). Ixz ≈ −600 throughout.
 */
export const INERTIA = {
  src: 'TN D-2532 fig. 3', tag: 'DIGITIZED',
  W: [14000, 16000, 18000, 20000, 22000, 24000, 26000, 28000, 30000, 32000, 33500],
  Ix: [3550, 3700, 3850, 4000, 4150, 4300, 4450, 4650, 4850, 5100, 5300],
  Iy: [87800, 89000, 90000, 91000, 93400, 96200, 99300, 102400, 106200, 110000, 114800],
  Iz: [85000, 88400, 90300, 91900, 93800, 96400, 99100, 102200, 106200, 110500, 116500],
  Ixz: -600,
};

// ---- Propulsion -------------------------------------------------------------------------------------

/**
 * XLR99 (SP-60, PUBLISHED): 57,000 lbf maximum, 13,000 lb of propellant a minute at maximum
 * thrust, 18,000 lb of propellant, 85 s; throttle 40–100 % (SP-60), 50–100 % in the flight
 * manual's procedures (used). Nozzle exit 39.3 in. DERIVED: the 57,000 lbf taken as the
 * vacuum thrust (rated at altitude, ≈), less the ambient pressure on the 8.42 ft² exit; the
 * flow scales with the throttle.
 */
export const XLR99 = {
  src: 'SP-60', tag: 'PUBLISHED',
  thrustLbf: 57000, flowLbPerMin: 13000, propellantLb: 18000, burnTimeS: 85,
  throttleMin: 0.5, exitDiameterIn: 39.3,
};

/**
 * Reaction controls (the brief's data sheet; ≈): hydrogen peroxide thrusters, two independent
 * systems; in the nose 113 lbf each for pitch and yaw, in the wings 40 lbf each for roll. Arms
 * from the model's own geometry (nose ports at the ring, wing ports ≈ at the tips).
 */
export const RCS = { tag: 'ESTIMATE', noseLbf: 113, wingLbf: 40, systems: 2 };

/**
 * Stability augmentation, the conventional rate dampers of 56-6670 (CR-2144 figure V-4,
 * PUBLISHED maximum gains): pitch δh = 0.75 rad per rad/s of pitch rate; roll δa = 0.50 per
 * rad/s of roll rate; yaw δv = 0.30 per rad/s of yaw rate. Gains in 10 % steps; the flight
 * model starts at 60 % (≈, the report notes the maxima were not always used). Authority
 * limits ≈ ±10° (ESTIMATE).
 */
export const SAS = { src: 'CR-2144 fig. V-4', tag: 'PUBLISHED', pitch: 0.75, roll: 0.50, yaw: 0.30, gain: 0.6, authorityDeg: 10 };

/**
 * Control limits (TN D-2532 table I, PUBLISHED): stabilizer −35° … +15° symmetric, ±15°
 * differential for the pilot; rudders ±7.5°; speed brakes 35°; flaps 40°.
 */
export const LIMITS = { dhMin: -35, dhMax: 15, daMax: 15, dvMax: 7.5, speedBrake: 35, flaps: 40 };

/**
 * Landing gear (TM X-207, PUBLISHED: skids 3 ft × 6 in, 18 × 4.4 in tyres, 18 in of nose strut
 * stroke, 2.577 in at the skids). Contact stiffness and damping are tuned so the static
 * attitude is the exhibit's ≈1.4° nose down (DERIVED); skid friction on the lakebed μ ≈ 0.3
 * and nose-wheel rolling μ ≈ 0.02 (ESTIMATE, no published value found).
 */
export const GEAR = { tag: 'ESTIMATE', skidMu: 0.3, wheelMu: 0.02 };

/** Every table, for the provenance listing and the checks. */
export const TABLES = { CN_ALPHA, CD_POLAR, CD_BASE_FUSELAGE, CD_SPEEDBRAKE, CM_ALPHA, CM_DH, CM_Q, ALPHA_TRIM, CN_BETA, CL_BETA, CY_BETA, CN_R, CN_DV, CL_DV, CL_DA, CN_DA, LATERAL_DAMPING, INERTIA };
