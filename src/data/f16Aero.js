/**
 * The F-16's aerodynamics and engine, as published by NASA. Every number here is printed in one
 * of the sources below; what the flight model does beyond them is in sim/f16Flight.js, marked ≈.
 *
 *  - Aerodynamics: E. A. Morelli, "Global nonlinear parametric modeling with application to F-16
 *    aerodynamics", NASA Langley (Proc. American Control Conference, 1998; NTRS 20040110310),
 *    tables 2 and 3. A single multivariate polynomial per coefficient, fitted to the wind-tunnel
 *    database of NASA TP-1538 (a 16 % model, Mach < 0.6, out of ground effect, gear up, no stores)
 *    over α −10…45°, β ±30°, δe ±25°, δa ±21.5°, δr ±30°; within 10 % of the tables in a doublet.
 *    Angles in radians, rates nondimensional (p̃ = pb/2V, q̃ = qc̄/2V, r̃ = rb/2V). Body axes:
 *    Cx forward, Cy right, Cz down; Cl, Cm, Cn right-wing-down, nose-up, nose-right. The moment
 *    reference is 0.35 c̄ (TP-1538 table I).
 *  - Thrust: TP-1538 table VI, the F100's installed thrust in newtons at idle, military and
 *    maximum (full afterburner), altitudes 0–15,240 m, Mach 0.2–1.0.
 *  - Control system: TP-1538 appendix A (surface limits, actuators, the leading-edge flap's
 *    schedule, the angle-of-attack limiter, roll-rate command to 308°/s, ARI, rudder fade).
 */

/** Morelli's table 3, by letter: a… for Cx(α, δe), b… Cxq(α), and so on (table 2 for the terms). */
export const MORELLI = {
  a: [-1.943367e-02, 2.136104e-01, -2.903457e-01, -3.348641e-03, -2.060504e-01, 6.988016e-01, -9.035381e-01],
  b: [4.833383e-01, 8.644627e+00, 1.131098e+01, -7.422961e+01, 6.075776e+01],
  c: [-1.145916e+00, 6.016057e-02, 1.642479e-01],
  d: [-1.006733e-01, 8.679799e-01, 4.260586e+00, -6.923267e+00],
  e: [8.071648e-01, 1.189633e-01, 4.177702e+00, -9.162236e+00],
  f: [-1.378278e-01, -4.211369e+00, 4.775187e+00, -1.026225e+01, 8.399763e+00, -4.354000e-01],
  g: [-3.054956e+01, -4.132305e+01, 3.292788e+02, -6.848038e+02, 4.080244e+02],
  h: [-1.058583e-01, -5.776677e-01, -1.672435e-02, 1.357256e-01, 2.172952e-01, 3.464156e+00, -2.835451e+00, -1.098104e+00],
  i: [-4.126806e-01, -1.189974e-01, 1.247721e+00, -7.391132e-01],
  j: [6.250437e-02, 6.067723e-01, -1.101964e+00, 9.100087e+00, -1.192672e+01],
  k: [-1.463144e-01, -4.073901e-02, 3.253159e-02, 4.851209e-01, 2.978850e-01, -3.746393e-01, -3.213068e-01],
  l: [2.635729e-02, -2.192910e-02, -3.152901e-03, -5.817803e-02, 4.516159e-01, -4.928702e-01, -1.579864e-02],
  m: [-2.029370e-02, 4.660702e-02, -6.012308e-01, -8.062977e-02, 8.320429e-02, 5.018538e-01, 6.378864e-01, 4.226356e-01],
  n: [-5.159153e+00, -3.554716e+00, -3.598636e+01, 2.247355e+02, -4.120991e+02, 2.411750e+02],
  o: [2.993363e-01, 6.594004e-02, -2.003125e-01, -6.233977e-02, -2.107885e+00, 2.141420e+00, 8.476901e-01],
  p: [2.677652e-02, -3.298246e-01, 1.926178e-01, 4.013325e+00, -4.404302e+00],
  q: [-3.698756e-01, -1.167551e-01, -7.641297e-01],
  r: [-3.348717e-02, 4.276655e-02, 6.573646e-03, 3.535831e-01, -1.373308e+00, 1.237582e+00, 2.302543e-01, -2.512876e-01, 1.588105e-01, -5.199526e-01],
  s: [-8.115894e-02, -1.156580e-02, 2.514167e-02, 2.038748e-01, -3.337476e-01, 1.004297e-01],
};
/** The ranges the fit covers (Morelli table 1), radians. */
export const MORELLI_RANGE = { alpha: [-0.1745, 0.7854], beta: [-0.5236, 0.5236], de: [-0.4363, 0.4363], da: [-0.3752, 0.3752], dr: [-0.5236, 0.5236] };

/**
 * The coefficients, Morelli's table 2 term by term. α, β, δ in radians; p̃, q̃, r̃ nondimensional.
 * Returns body-axis Cx, Cy, Cz and Cl, Cm, Cn about 0.35 c̄; `xcg` (fraction of c̄) moves the
 * pitching and yawing moments to the centre of gravity, as Morelli's equations 16 and 17 do.
 */
export function morelli(al, be, de, da, dr, ph, qh, rh, { xcg = 0.35, cbar, b } = {}) {
  const { a, b: B, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s } = MORELLI;
  const a2 = al * al, a3 = a2 * al, a4 = a3 * al, a5 = a4 * al, b2 = be * be, b3 = b2 * be;
  const Cx0 = a[0] + a[1] * al + a[2] * de * de + a[3] * de + a[4] * al * de + a[5] * a2 + a[6] * a3;
  const Cxq = B[0] + B[1] * al + B[2] * a2 + B[3] * a3 + B[4] * a4;
  const Cy0 = c[0] * be + c[1] * da + c[2] * dr;
  const Cyp = d[0] + d[1] * al + d[2] * a2 + d[3] * a3;
  const Cyr = e[0] + e[1] * al + e[2] * a2 + e[3] * a3;
  const Cz0 = (f[0] + f[1] * al + f[2] * a2 + f[3] * a3 + f[4] * a4) * (1 - b2) + f[5] * de;
  const Czq = g[0] + g[1] * al + g[2] * a2 + g[3] * a3 + g[4] * a4;
  const Cl0 = h[0] * be + h[1] * al * be + h[2] * a2 * be + h[3] * b2 + h[4] * al * b2 + h[5] * a3 * be + h[6] * a4 * be + h[7] * a2 * b2;
  const Clp = i[0] + i[1] * al + i[2] * a2 + i[3] * a3;
  const Clr = j[0] + j[1] * al + j[2] * a2 + j[3] * a3 + j[4] * a4;
  const Clda = k[0] + k[1] * al + k[2] * be + k[3] * a2 + k[4] * al * be + k[5] * a2 * be + k[6] * a3;
  const Cldr = l[0] + l[1] * al + l[2] * be + l[3] * al * be + l[4] * a2 * be + l[5] * a3 * be + l[6] * b2;
  const Cm0 = m[0] + m[1] * al + m[2] * de + m[3] * al * de + m[4] * de * de + m[5] * a2 * de + m[6] * de * de * de + m[7] * al * de * de;
  const Cmq = n[0] + n[1] * al + n[2] * a2 + n[3] * a3 + n[4] * a4 + n[5] * a5;
  const Cn0 = o[0] * be + o[1] * al * be + o[2] * b2 + o[3] * al * b2 + o[4] * a2 * be + o[5] * a2 * b2 + o[6] * a3 * be;
  const Cnp = p[0] + p[1] * al + p[2] * a2 + p[3] * a3 + p[4] * a4;
  const Cnr = q[0] + q[1] * al + q[2] * a2;
  const Cnda = r[0] + r[1] * al + r[2] * be + r[3] * al * be + r[4] * a2 * be + r[5] * a3 * be + r[6] * a2 + r[7] * a3 + r[8] * b3 + r[9] * al * b3;
  const Cndr = s[0] + s[1] * al + s[2] * be + s[3] * al * be + s[4] * a2 * be + s[5] * a2;
  const Cx = Cx0 + Cxq * qh;
  const Cy = Cy0 + Cyp * ph + Cyr * rh;
  const Cz = Cz0 + Czq * qh;
  const Cl = Cl0 + Clp * ph + Clr * rh + Clda * da + Cldr * dr;
  const Cm = Cm0 + Cmq * qh + Cz * (0.35 - xcg);
  const Cn = Cn0 + Cnp * ph + Cnr * rh + Cnda * da + Cndr * dr - Cy * (0.35 - xcg) * (cbar / b);
  return { Cx, Cy, Cz, Cl, Cm, Cn };
}

/** TP-1538 table VI (SI): installed thrust, newtons, [altitude][Mach]. */
export const THRUST = {
  alt: [0, 3048, 6096, 9144, 12192, 15240],
  mach: [0.2, 0.4, 0.6, 0.8, 1.0],
  idle: [
    [2824, 267, -4537, -12010, -16013],
    [1890, 111, -3158, -8451, -6227],
    [3069, 1535, -1334, -5782, -2647],
    [4492, 3358, 1557, -1099, -1521],
    [5916, 5026, 4048, 2669, -890],
    [7562, 6783, 6049, 4893, 3114],
  ],
  mil: [
    [56401, 56089, 56223, 55111, 51953],
    [40699, 41420, 43764, 45263, 43804],
    [28080, 29401, 31536, 34472, 35806],
    [17970, 19082, 20728, 23663, 27133],
    [10987, 11565, 12632, 14456, 16902],
    [6227, 6939, 7384, 8585, 10275],
  ],
  max: [
    [95276, 100970, 107820, 115959, 128485],
    [69834, 74993, 84112, 93742, 103723],
    [49929, 54488, 61204, 71057, 81398],
    [32573, 36269, 41300, 49440, 59977],
    [19727, 22240, 25354, 30513, 38440],
    [11565, 12610, 14300, 17570, 22494],
  ],
};

/** TP-1538 appendix A: the control system's published limits and dynamics. */
export const FCS = {
  stab: { limit: 25, rate: 60, tau: 0.0495 },
  // 5.375° is 21.5° of aileron over the ratio of 4; it was 5.38 here and 5.375 in f16.js, which
  // now reads this one (audit, 08-10).
  diffTail: { limit: 5.375, rate: 60, tau: 0.0495, ratio: 4 },   // 4° of aileron per 1° of differential tail
  aileron: { limit: 21.5, rate: 80, tau: 0.0495 },
  rudder: { limit: 30, rate: 120, tau: 0.0495, fade: [20, 30] },  // pilot rudder faded to zero 20–30° α
  // δlef = 1.38·(2s + 7.25)/(s + 7.25)·α − 9.05·q̄/ps + 1.45 (deg): a lead on α, the q̄/ps term and a bias.
  lef: { limit: 25, rate: 25, tau: 0.136, k: 1.38, pole: 7.25, q: 9.05, bias: 1.45 },
  rollRateMax: 308,
  aoaLimiter: { start: 15, knee: 20.4, slope1: 0.322, slope2: 1.322, limit: 25 },
  ari: { slope: 0.075 },
  departure: { alpha: 29, rudderGain: 0.75 },
};
