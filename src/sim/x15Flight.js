/**
 * The X-15's flight model: six degrees of freedom over a round, non-rotating Earth, no renderer.
 *
 * State: position and velocity in an Earth-centred inertial frame (m, m/s), attitude as a unit
 * quaternion from body to that frame, body rates (rad/s), propellant (kg). The launch point is
 * at latitude 0, longitude 0 of this frame: there +X is up, +Y east and +Z north.
 *
 * Body axes are the flight-mechanics ones: x forward along the fuselage reference line, y to the
 * right wing, z down. (The 3D model's frame is x forward, y up, z right: the same x, y_model =
 * −z_body, z_model = y_body.)
 *
 * What is modelled, and from what (src/data/x15Aero.js tags every table):
 *  - the 1976 US Standard Atmosphere to 86 km, its tabulated density and pressure above;
 *  - inverse-square gravity, μ = 3.986 004 418 × 10¹⁴ m³/s², R = 6 371 km; no Earth rotation (≈:
 *    the Coriolis acceleration at Mach 6 is ≈0.2 % of g);
 *  - aerodynamics from the flight-measured derivatives and trimmed polars of TN D-2532,
 *    TN D-3343 and TM X-714, the trim built into the pitching moment;
 *  - the XLR99 at 50–100 %, its flow, propellant burn-off and the inertias against weight;
 *  - the reaction controls (two systems; nose pitch and yaw, wing roll);
 *  - the conventional rate dampers (SAS);
 *  - the nose gear and the two skids on the ground, oleos as springs and dampers, Coulomb
 *    friction on the skids.
 *
 * Not modelled (said here so nothing is implied): Earth's rotation and oblateness, wind, the
 * ventral fin and its jettison (the airplane flies as the exhibit stands, lower rudder off), the
 * MH-96 adaptive system of the #3 airplane, heating, actuator dynamics, the hydrogen-peroxide
 * supply of the reaction controls and the APUs.
 */
import {
  LBF, LB, SLUG_FT2, REF, lerp1, banded,
  CN_ALPHA, CD_POLAR, CD_BASE_FUSELAGE, CD_SPEEDBRAKE, FLAPS_GEAR, CM_ALPHA, CM_DH, CM_Q, ALPHA_TRIM,
  CN_BETA, CL_BETA, CY_BETA, CN_R, CN_DV, CL_DV, CL_DA, CN_DA, LATERAL_DAMPING,
  INERTIA, XLR99, RCS, SAS, LIMITS, GEAR as GEAR_DATA,
} from '../data/x15Aero.js';
import { X15, WING, NOSE, GEAR, groundAttitude } from '../data/x15.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const MU = 3.986004418e14, R_EARTH = 6371000, G0 = 9.80665;

// ---- Atmosphere ---------------------------------------------------------------------------------
/** 1976 US Standard Atmosphere, geopotential layers to 84.852 km (86 km geometric). */
const LAYERS = [
  // base geopotential height (m), base temperature (K), lapse rate (K/m), base pressure (Pa)
  [0, 288.15, -0.0065, 101325],
  [11000, 216.65, 0, 22632.06],
  [20000, 216.65, 0.001, 5474.889],
  [32000, 228.65, 0.0028, 868.0187],
  [47000, 270.65, 0, 110.9063],
  [51000, 270.65, -0.0028, 66.93887],
  [71000, 214.65, -0.002, 3.956420],
  [84852, 186.946, 0, 0.3733836],
];
/** Above 86 km: the standard's own tabulated values (geometric km, K, Pa, kg/m³). */
const UPPER = [
  [86, 186.87, 0.37338, 6.958e-6],
  [90, 186.87, 0.18359, 3.416e-6],
  [100, 195.08, 3.2011e-2, 5.604e-7],
  [110, 240.0, 7.1042e-3, 9.708e-8],
  [120, 360.0, 2.5382e-3, 2.222e-8],
  [150, 634.39, 4.5422e-4, 2.076e-9],
  [200, 854.56, 8.4736e-5, 2.541e-10],
];
const RAIR = 287.05287, GAMMA = 1.4;
/** Temperature (K), pressure (Pa), density (kg/m³) and speed of sound (m/s) at a geometric altitude. */
export function atmosphere(h) {
  let T, p, rho;
  if (h < 86000) {
    const z = Math.max(-1000, h), H = R_EARTH * z / (R_EARTH + z);
    let i = LAYERS.length - 1;
    while (i > 0 && H < LAYERS[i][0]) i--;
    const [Hb, Tb, L, pb] = LAYERS[i];
    T = Tb + L * (H - Hb);
    p = L === 0 ? pb * Math.exp(-G0 * (H - Hb) / (RAIR * Tb)) : pb * (T / Tb) ** (-G0 / (RAIR * L));
    rho = p / (RAIR * T);
  } else {
    const km = Math.min(h / 1000, 200);
    let i = 0;
    while (i < UPPER.length - 2 && km > UPPER[i + 1][0]) i++;
    const a = UPPER[i], b = UPPER[i + 1], t = (km - a[0]) / (b[0] - a[0]);
    T = a[1] + (b[1] - a[1]) * t;
    p = Math.exp(Math.log(a[2]) + (Math.log(b[2]) - Math.log(a[2])) * t);
    rho = Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * t);
    if (h > 200000) { const f = Math.exp(-(h - 200000) / 50000); p *= f; rho *= f; }
  }
  return { T, p, rho, a: Math.sqrt(GAMMA * RAIR * T) };
}

// ---- Mass, centre of gravity, geometry --------------------------------------------------------
const W_LAUNCH = REF.launchWeightLb * LB, PROP_FULL = XLR99.propellantLb * LB;
export const MASS = { launch: W_LAUNCH, dry: W_LAUNCH - PROP_FULL, propellant: PROP_FULL, landing: REF.landingWeightLb * LB };
/** Moments of inertia (kg·m²) at a mass (kg): TN D-2532 figure 3 by weight. */
export function inertiaAt(m) {
  const W = m / LB;
  return {
    Ix: lerp1(INERTIA.W, INERTIA.Ix, W) * SLUG_FT2,
    Iy: lerp1(INERTIA.W, INERTIA.Iy, W) * SLUG_FT2,
    Iz: lerp1(INERTIA.W, INERTIA.Iz, W) * SLUG_FT2,
    Ixz: INERTIA.Ixz * SLUG_FT2,
  };
}
/**
 * Mean aerodynamic chord from the wing's own planform (data/x15.js): 3.131 m (TN D-2532 prints
 * 10.27 ft = 3.130 m), its leading edge at station 7.990 m; the centre of gravity at 20 % of it,
 * station 8.616 m (TN D-2532 table I, 20 ± 1 %, held fixed as propellant burns: ≈).
 */
const MAC = (() => {
  const s = WING.semispan, cr = WING.chord(0), ct = WING.chord(s), lam = ct / cr;
  const mac = 2 / 3 * cr * (1 + lam + lam * lam) / (1 + lam);
  const y = s / 3 * (1 + 2 * lam) / (1 + lam);
  return { chord: mac, le: WING.le(y), y };
})();
export const CG_STATION = MAC.le + REF.cgFractionMAC * MAC.chord;
/** A point given by station (m aft of the nose apex), height above the FRL and right offset, in body axes about the CG. */
export const bodyPoint = (station, up, right = 0) => [CG_STATION - station, right, -up];

/** The reaction-control arms: the nose ports just aft of the ring, the wing ports ≈ at the tips. */
const RCS_NOSE_ARM = CG_STATION - (NOSE.ringStation + 0.2), RCS_WING_ARM = WING.semispan - 0.3;

// ---- Landing gear --------------------------------------------------------------------------------
/**
 * Contact points, body axes: the nose tyres and the two skids, at their positions with the
 * struts extended. Static deflections (≈): 0.10 m at the nose (of 18 in of travel), 0.03 m at the
 * skids (of 2.577 in); the spring rates follow from the landing weight's load on each, so the
 * airplane at rest takes the exhibit's attitude, ≈1.40° nose down (DERIVED).
 */
export const GEAR_MODEL = (() => {
  const th = groundAttitude();
  const sN = GEAR.noseStation, sS = GEAR.skidStation, hN = GEAR.noseFRLHeight;
  const hS = hN + (sS - sN) * Math.tan(th);       // FRL height at the skids
  const dN = 0.10, dS = 0.03;
  const W = MASS.landing * G0;
  const fN = W * (sS - CG_STATION) / (sS - sN), fS = W - fN;
  const kN = fN / dN, kS = fS / 2 / dS;
  const half = GEAR.tread / 2;
  return {
    pitch: th,
    points: [
      { name: 'nose', p: bodyPoint(sN, -(hN * Math.cos(th) + dN)), k: kN, c: 2 * 0.6 * Math.sqrt(kN * fN / G0), mu: GEAR_DATA.wheelMu, caster: true },
      { name: 'skid-l', p: bodyPoint(sS, -(hS * Math.cos(th) + dS), -half), k: kS, c: 2 * 0.6 * Math.sqrt(kS * fS / 2 / G0), mu: GEAR_DATA.skidMu },
      { name: 'skid-r', p: bodyPoint(sS, -(hS * Math.cos(th) + dS), half), k: kS, c: 2 * 0.6 * Math.sqrt(kS * fS / 2 / G0), mu: GEAR_DATA.skidMu },
    ],
  };
})();

// ---- Small vector and quaternion helpers -----------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
/** Rotates a body vector into the inertial frame by q = [w, x, y, z]. */
export function rotate(q, v) {
  const [w, x, y, z] = q, u = [x, y, z];
  const t = mul(cross(u, v), 2);
  return add(add(v, mul(t, w)), cross(u, t));
}
export const conj = (q) => [q[0], -q[1], -q[2], -q[3]];
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qnorm = (q) => { const n = Math.hypot(...q); return q.map(x => x / n); };
/** Quaternion from a rotation matrix whose columns are the body axes in the inertial frame. */
function quatFromAxes(xb, yb, zb) {
  const m00 = xb[0], m11 = yb[1], m22 = zb[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [0.25 * s, (yb[2] - zb[1]) / s, (zb[0] - xb[2]) / s, (xb[1] - yb[0]) / s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [(yb[2] - zb[1]) / s, 0.25 * s, (yb[0] + xb[1]) / s, (zb[0] + xb[2]) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(zb[0] - xb[2]) / s, (yb[0] + xb[1]) / s, 0.25 * s, (zb[1] + yb[2]) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(xb[1] - yb[0]) / s, (zb[0] + xb[2]) / s, (zb[1] + yb[2]) / s, 0.25 * s]; }
  return qnorm(q);
}

/** The local north-east-down axes at an inertial position (unit vectors in the inertial frame). */
export function localNED(r) {
  const up = mul(r, 1 / norm(r));
  const poleN = [0, 0, 1];
  let east = cross(poleN, up);
  const e = norm(east);
  east = e > 1e-9 ? mul(east, 1 / e) : [0, 1, 0];
  const north = cross(up, east);
  return { n: north, e: east, d: mul(up, -1) };
}

// ---- Aerodynamics ------------------------------------------------------------------------------
/** Drag coefficient on the trimmed polar at (M, CL), extrapolated past CL 0.6 on its last slope in CL². */
function polarCD(M, CL) {
  const cl = Math.abs(CL), P = CD_POLAR;
  const row = (i) => lerp1(P.M, P.CD[i], M);
  if (cl >= 0.6) {
    const c5 = row(5), c6 = row(6), K = (c6 - c5) / (0.36 - 0.25);
    return c6 + K * (cl * cl - 0.36);
  }
  const i = Math.min(5, Math.floor(cl / 0.1)), t = cl / 0.1 - i;
  return row(i) + (row(i + 1) - row(i)) * t;
}

/** The trim angle of attack at a stabilizer setting (TM X-714 figure 8; see x15Aero.js). */
export function alphaTrim(M, dh) {
  const T = ALPHA_TRIM, m = Math.max(M, T.M[0]);
  const a = T.alpha.map(row => lerp1(T.M, row, m));
  // Beyond the printed settings: the slope the derivatives give, −Cmδh / Cmα at that α.
  const slope = (al) => -banded(CM_DH, M, al) / banded(CM_ALPHA, M, al);
  if (dh >= T.dh[0]) return a[0] + slope(a[0]) * (dh - T.dh[0]);
  if (dh <= T.dh[2]) return a[2] + slope(a[2]) * (dh - T.dh[2]);
  const i = dh >= T.dh[1] ? 0 : 1, t = (dh - T.dh[i]) / (T.dh[i + 1] - T.dh[i]);
  return a[i] + (a[i + 1] - a[i]) * t;
}
/** The stabilizer setting that trims at α (degrees), by bisection within the stabilizer's travel. */
export function trimStabilizer(M, alpha) {
  let lo = LIMITS.dhMin, hi = LIMITS.dhMax;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (alphaTrim(M, mid) > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Aerodynamic coefficients in body axes (x forward, y right, z down), and the moments' coefficients
 * about the centre of gravity. Angles in degrees, rates in rad/s.
 * c: { dh, da, dv, speedBrake, flaps, gear, powered }
 */
export function aeroCoefficients(M, alpha, beta, p, q, r, V, c) {
  const a = Math.max(-30, Math.min(30, alpha)), aa = Math.abs(a), sgn = a < 0 ? -1 : 1;
  const Mc = Math.max(0.6, M);
  // Normal force: the secant slope between the two banded curves.
  let CN = sgn * aa * banded(CN_ALPHA, Mc, aa);
  const subsonic = M < 0.8 ? 1 : 0;
  const flapF = (c.flaps ?? 0) / X15.wing.flap.deflection;
  CN += subsonic * flapF * FLAPS_GEAR.flapCL;
  // Axial force from the trimmed polar: CA such that (CL, CD) lies on it.
  const ar = a * D2R, ca = Math.cos(ar), sa = Math.sin(ar);
  let CA = polarCD(Mc, 0);
  for (let i = 0; i < 4; i++) {
    const CL = CN * ca - CA * sa;
    CA = (polarCD(Mc, CL) - CN * sa) / ca;
  }
  let dCD = 0;
  if (c.powered) dCD -= lerp1(CD_BASE_FUSELAGE.M, CD_BASE_FUSELAGE.v, Mc);
  dCD += lerp1(CD_SPEEDBRAKE.M, CD_SPEEDBRAKE.v, Mc) * (c.speedBrake ?? 0) / LIMITS.speedBrake;
  dCD += subsonic * (flapF * FLAPS_GEAR.flapCD + (c.gear ? FLAPS_GEAR.gearCD : 0));
  CA += dCD * ca;   // a drag increment, carried on the axial force (small α where it matters)

  const b = beta;
  const CY = banded(CY_BETA, Mc, aa) * b + 0.0044 * (c.dv ?? 0) * (M < 2 ? 1 : 0.5);
  const hb = REF.b / (2 * Math.max(V, 1)), hc = REF.cbar / (2 * Math.max(V, 1));
  const Cl = banded(CL_BETA, Mc, aa) * b + banded(CL_DA, Mc, aa) * (c.da ?? 0) + banded(CL_DV, Mc, aa) * (c.dv ?? 0)
    + lerp1(LATERAL_DAMPING.M, LATERAL_DAMPING.Clp, Mc) * p * hb + LATERAL_DAMPING.Clr * r * hb;
  const Cn = banded(CN_BETA, Mc, aa) * b + banded(CN_DA, Mc, aa) * (c.da ?? 0) + banded(CN_DV, Mc, aa) * (c.dv ?? 0)
    + lerp1(LATERAL_DAMPING.M, LATERAL_DAMPING.Cnp, Mc) * p * hb + lerp1(CN_R.M, CN_R.v, Mc) * r * hb;
  const Cm = banded(CM_ALPHA, Mc, aa) * (a - alphaTrim(Mc, c.dh ?? 0)) + lerp1(CM_Q.M, CM_Q.v, Mc) * q * hc;
  return { CN, CA, CY, Cl, Cm, Cn };
}

// ---- Propulsion -----------------------------------------------------------------------------------
const EXIT_AREA = Math.PI * (XLR99.exitDiameterIn * 0.0254 / 2) ** 2;
const F_VAC = XLR99.thrustLbf * LBF, FLOW = XLR99.flowLbPerMin / 60 * LB;
/** Thrust (N) and propellant flow (kg/s) at a throttle setting (0 or 0.5–1) and ambient pressure. */
export function xlr99(throttle, pAmb) {
  if (!(throttle >= XLR99.throttleMin)) return { thrust: 0, flow: 0 };
  const t = Math.min(1, throttle);
  return { thrust: Math.max(0, t * F_VAC - pAmb * EXIT_AREA), flow: t * FLOW };
}

// ---- State -------------------------------------------------------------------------------------
/**
 * A state at a point given in local terms: altitude (m), downrange north and east of the launch
 * point (m), true airspeed (m/s), heading (deg, from north), flight-path angle (deg), angle of
 * attack (deg), bank (deg), propellant (kg).
 */
export function makeState({ altitude, north = 0, east = 0, speed, heading = 0, gamma = 0, alpha = 0, bank = 0, propellant = 0, rates = [0, 0, 0] }) {
  const lat = north / R_EARTH, lon = east / R_EARTH, rr = R_EARTH + altitude;
  const r = [rr * Math.cos(lat) * Math.cos(lon), rr * Math.cos(lat) * Math.sin(lon), rr * Math.sin(lat)];
  const L = localNED(r);
  const hd = heading * D2R, gm = gamma * D2R;
  const vNED = [Math.cos(gm) * Math.cos(hd), Math.cos(gm) * Math.sin(hd), -Math.sin(gm)];
  const v = add(add(mul(L.n, vNED[0] * speed), mul(L.e, vNED[1] * speed)), mul(L.d, vNED[2] * speed));
  // Body axes: the velocity axes (wings level: y to the right of the heading, horizontal),
  // banked about the velocity (right wing down positive), then pitched up by α.
  const xw = mul(v, 1 / speed);
  const horiz = add(mul(L.n, Math.cos(hd)), mul(L.e, Math.sin(hd)));
  const yw0 = cross(L.d, horiz);   // right of the heading: d × n = e
  const zw0 = cross(xw, yw0);
  const ph = bank * D2R;
  const yw = add(mul(yw0, Math.cos(ph)), mul(zw0, Math.sin(ph)));
  const zw = cross(xw, yw);
  const al = alpha * D2R;
  const xb = add(mul(xw, Math.cos(al)), mul(zw, -Math.sin(al)));
  const zb = add(mul(xw, Math.sin(al)), mul(zw, Math.cos(al)));
  const yb = cross(zb, xb);
  return { t: 0, r, v, q: quatFromAxes(xb, yb, zb), w: [...rates], prop: propellant };
}

/** Readable quantities of a state: altitude, Mach, q̄, α, β, Euler angles, speeds. */
export function describe(s, groundAlt = 0) {
  const h = norm(s.r) - R_EARTH, atm = atmosphere(h), L = localNED(s.r);
  const vb = rotate(conj(s.q), s.v), V = norm(s.v);
  const alpha = Math.atan2(vb[2], vb[0]) * R2D, beta = Math.asin(Math.max(-1, Math.min(1, vb[1] / Math.max(V, 1e-6)))) * R2D;
  const xb = rotate(s.q, [1, 0, 0]), yb = rotate(s.q, [0, 1, 0]), zb = rotate(s.q, [0, 0, 1]);
  const xn = [dot(xb, L.n), dot(xb, L.e), dot(xb, L.d)], yn = [dot(yb, L.n), dot(yb, L.e), dot(yb, L.d)], zn = [dot(zb, L.n), dot(zb, L.e), dot(zb, L.d)];
  const theta = Math.asin(Math.max(-1, Math.min(1, -xn[2]))) * R2D;
  const phi = Math.atan2(yn[2], zn[2]) * R2D;
  const psi = Math.atan2(xn[1], xn[0]) * R2D;
  const vN = dot(s.v, L.n), vE = dot(s.v, L.e), vD = dot(s.v, L.d);
  const lat = Math.asin(s.r[2] / norm(s.r)), lon = Math.atan2(s.r[1], s.r[0]);
  return {
    t: s.t, altitude: h, agl: h - groundAlt, mach: V / atm.a, qbar: 0.5 * atm.rho * V * V, V, alpha, beta, theta, phi, psi,
    gamma: Math.asin(Math.max(-1, Math.min(1, -vD / Math.max(V, 1e-6)))) * R2D, vN, vE, vD,
    p: s.w[0], q: s.w[1], r: s.w[2], mass: MASS.dry + s.prop, north: lat * R_EARTH, east: lon * R_EARTH,
  };
}

// ---- Equations of motion -----------------------------------------------------------------------------
/**
 * Controls (all optional): dh, da, dv (deg; the pilot's, before the dampers), throttle (0, or
 * 0.5–1), speedBrake (deg), flaps (deg), gear (bool), rcs [roll, pitch, yaw] each −1 … 1 (one
 * thruster pair at 1; both systems fire), rcsSystems (1 or 2), sas (bool), sasGain (0–1),
 * groundAlt (m, the ground's altitude for the gear).
 */
function derivatives(s, ctl, out) {
  const rn = norm(s.r), h = rn - R_EARTH, atm = atmosphere(h);
  const m = MASS.dry + Math.max(0, s.prop), I = inertiaAt(m);
  const V = norm(s.v), vb = rotate(conj(s.q), s.v);
  const [p, q, r] = s.w;
  const alpha = Math.atan2(vb[2], vb[0]) * R2D, beta = Math.asin(Math.max(-1, Math.min(1, vb[1] / Math.max(V, 1e-3)))) * R2D;
  const M = V / atm.a, qbar = 0.5 * atm.rho * V * V;

  // Rate dampers: on the surfaces, within their authority, then the surfaces' limits.
  const lim = (x, a, b) => Math.max(a, Math.min(b, x));
  let dh = ctl.dh ?? 0, da = ctl.da ?? 0, dv = ctl.dv ?? 0;
  if (ctl.sas !== false) {
    const g = ctl.sasGain ?? SAS.gain, A = SAS.authorityDeg;
    dh += lim(SAS.pitch * g * q * R2D, -A, A);
    da += lim(-SAS.roll * g * p * R2D, -A, A);
    dv += lim(SAS.yaw * g * r * R2D, -A, A);
  }
  dh = lim(dh, LIMITS.dhMin, LIMITS.dhMax); da = lim(da, -LIMITS.daMax, LIMITS.daMax); dv = lim(dv, -LIMITS.dvMax, LIMITS.dvMax);

  const eng = s.prop > 0 ? xlr99(ctl.throttle ?? 0, atm.p) : { thrust: 0, flow: 0 };
  let F = [eng.thrust, 0, 0], Mo = [0, 0, 0];
  if (qbar > 1e-3 && V > 1) {
    const C = aeroCoefficients(M, alpha, beta, p, q, r, V, { dh, da, dv, speedBrake: ctl.speedBrake, flaps: ctl.flaps, gear: ctl.gear, powered: eng.thrust > 0 });
    const qS = qbar * REF.S;
    F = add(F, [-C.CA * qS, C.CY * qS, -C.CN * qS]);
    Mo = add(Mo, [C.Cl * qS * REF.b, C.Cm * qS * REF.cbar, C.Cn * qS * REF.b]);
  }
  // Reaction controls: pure couples (the nose pair fires up and down, the wing pair one each).
  if (ctl.rcs) {
    const n = ctl.rcsSystems ?? RCS.systems, cl = (x) => lim(x, -1, 1);
    Mo = add(Mo, [cl(ctl.rcs[0]) * n * 2 * RCS.wingLbf * LBF * RCS_WING_ARM, cl(ctl.rcs[1]) * n * RCS.noseLbf * LBF * RCS_NOSE_ARM, cl(ctl.rcs[2]) * n * RCS.noseLbf * LBF * RCS_NOSE_ARM]);
  }
  // Gear: each contact point below the ground pushes back along the local vertical.
  let Fi = rotate(s.q, F);
  const ground = R_EARTH + (ctl.groundAlt ?? 0);
  if (ctl.gear !== false && rn - ground < 6) {
    const up = mul(s.r, 1 / rn);
    for (const g of GEAR_MODEL.points) {
      const pi = rotate(s.q, g.p), P = add(s.r, pi);
      const depth = ground - dot(P, up);
      if (depth <= 0) continue;
      const vP = add(s.v, rotate(s.q, cross(s.w, g.p)));
      const vn = dot(vP, up);
      const N = Math.max(0, g.k * depth - g.c * vn);
      const vt = sub(vP, mul(up, vn)), vtn = norm(vt);
      let fr = [0, 0, 0];
      if (vtn > 1e-6) {
        if (g.caster) {
          // A castering wheel: rolling resistance along the fuselage only.
          const xb = rotate(s.q, [1, 0, 0]), xh = sub(xb, mul(up, dot(xb, up))), xl = norm(xh);
          if (xl > 1e-6) { const xu = mul(xh, 1 / xl), vx = dot(vt, xu); fr = mul(xu, -g.mu * N * Math.tanh(vx / 0.3)); }
        } else {
          fr = mul(vt, -g.mu * N * Math.tanh(vtn / 0.3) / vtn);
        }
      }
      const Fc = add(mul(up, N), fr);
      Fi = add(Fi, Fc);
      Mo = add(Mo, cross(g.p, rotate(conj(s.q), Fc)));
    }
  }
  // Translation.
  const grav = mul(s.r, -MU / (rn * rn * rn));
  out.r = s.v;
  out.v = add(grav, mul(Fi, 1 / m));
  // Rotation: I ẇ = M − w × I w, with the product of inertia.
  const Iw = [I.Ix * p - I.Ixz * r, I.Iy * q, I.Iz * r - I.Ixz * p];
  const rhs = sub(Mo, cross(s.w, Iw));
  const det = I.Ix * I.Iz - I.Ixz * I.Ixz;
  out.w = [(I.Iz * rhs[0] + I.Ixz * rhs[2]) / det, rhs[1] / I.Iy, (I.Ixz * rhs[0] + I.Ix * rhs[2]) / det];
  out.q = mul4(qmul(s.q, [0, p, q, r]), 0.5);
  out.prop = -eng.flow;
  out.info = { alpha, beta, M, qbar, thrust: eng.thrust, dh, da, dv, mass: m };
  return out;
}
const mul4 = (q, k) => [q[0] * k, q[1] * k, q[2] * k, q[3] * k];

/** One fourth-order Runge–Kutta step of dt seconds; returns the new state (the old is untouched). */
export function step(s, ctl, dt) {
  const k1 = derivatives(s, ctl, {});
  const at = (k, f) => ({
    t: s.t + dt * f, r: add(s.r, mul(k.r, dt * f)), v: add(s.v, mul(k.v, dt * f)),
    q: qnorm(s.q.map((x, i) => x + k.q[i] * dt * f)), w: add(s.w, mul(k.w, dt * f)), prop: s.prop + k.prop * dt * f,
  });
  const k2 = derivatives(at(k1, 0.5), ctl, {});
  const k3 = derivatives(at(k2, 0.5), ctl, {});
  const k4 = derivatives(at(k3, 1), ctl, {});
  const comb = (key) => (i) => (k1[key][i] + 2 * k2[key][i] + 2 * k3[key][i] + k4[key][i]) / 6;
  const r = [0, 1, 2].map(i => s.r[i] + dt * comb('r')(i));
  const v = [0, 1, 2].map(i => s.v[i] + dt * comb('v')(i));
  const w = [0, 1, 2].map(i => s.w[i] + dt * comb('w')(i));
  const q = qnorm([0, 1, 2, 3].map(i => s.q[i] + dt * comb('q')(i)));
  const prop = Math.max(0, s.prop + dt * (k1.prop + 2 * k2.prop + 2 * k3.prop + k4.prop) / 6);
  return { t: s.t + dt, r, v, q, w, prop, info: k1.info };
}

/** Specific mechanical energy (J/kg): kinetic plus inverse-square potential. */
export const specificEnergy = (s) => 0.5 * dot(s.v, s.v) - MU / norm(s.r);
