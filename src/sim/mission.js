/**
 * Flight 14 as one mission state, from the ship's engine cutoff to the entry interface: the
 * chapters (the ascent in launch.js, the re-entry in reentryFlight.js) are entry points into it,
 * not separate assumptions. In SI units, a point mass over a spherical, non-rotating Earth, in
 * the plane of the orbit.
 *
 *  1. Cutoff (T+8:11, cited): the ship's state and mass where the integrated burn leaves them
 *     (launch.js: its altitude, speed, flight-path angle and mass tables).
 *  2. The orbit that state is on (vis-viva, angular momentum): its energy, apogee and perigee.
 *  3. The coast to the deorbit burn (T+8:52:37, cited), by Kepler's equation: no drag at that
 *     height (≈), so energy and angular momentum stay what they were at cutoff.
 *  4. The deorbit burn (T+8:52:37–8:52:48, cited, one sea-level Raptor): its thrust and specific
 *     impulse (≈) give the propellant it burns and, through the rocket equation, its Δv, applied
 *     retrograde at the point of the orbit where the burn falls.
 *  5. The new orbit down to the entry interface (120 km, ≈ the usual definition): the speed and
 *     flight-path angle there, and the time it reaches it.
 *
 * Every mass change has its cause recorded (MISSION.masses): propellant burned at cutoff and in
 * the deorbit burn; a payload deploy if one is assumed (none here: flight 14's is not modelled,
 * and the mass at entry is the cutoff mass less the deorbit propellant).
 */
import { altitudeAt, speedAt, downrangeAt, shipMassAt, EVENTS } from './launch.js';

// One gravity for the whole mission: the ascent's (g0 at the surface of a 6,371 km sphere, μ = g0·R²).
export const R_EARTH = 6371e3, G0 = 9.80665, MU = G0 * R_EARTH * R_EARTH;
const hms = (h, m, s) => h * 3600 + m * 60 + s;
/** Cited times (spacex.com, flight 14) and the assumptions, marked ≈. */
export const MISSION = {
  cutoff: EVENTS.shipCutoff,
  deorbitStart: hms(8, 52, 37), deorbitEnd: hms(8, 52, 48),
  deorbit: { thrust: 250e3 * G0, isp: 350 },   // ≈ one sea-level Raptor 3: 250 tf, Isp ≈350 s (as the ascent assumes)
  payload: 0,                                  // ≈ none modelled
  interface: 120e3,                            // m, ≈
};

/** The ship's state at cutoff from the ascent's integrated tables: altitude, speed, flight-path angle, mass. */
export function cutoffState() {
  const t = MISSION.cutoff, e = 0.25;
  const h = altitudeAt(t), v = speedAt(t);
  const vh = (altitudeAt(t + e) - altitudeAt(t - e)) / (2 * e);
  return { t, h, v, gamma: Math.asin(Math.max(-1, Math.min(1, vh / v))), m: shipMassAt(t), down: downrangeAt(t) };
}

/** Orbit from radius, speed and flight-path angle: semi-major axis, eccentricity, energy, angular momentum, true anomaly. */
export function orbitOf(r, v, gamma) {
  const energy = v * v / 2 - MU / r, hAng = r * v * Math.cos(gamma);
  const a = -MU / (2 * energy), p = hAng * hAng / MU, e = Math.sqrt(Math.max(0, 1 - p / a));
  // True anomaly: from r = p / (1 + e cos ν), on the side the radial speed says.
  const cosNu = e > 1e-9 ? Math.max(-1, Math.min(1, (p / r - 1) / e)) : 1;
  const nu = Math.sign(Math.sin(gamma) || 1) * Math.acos(cosNu);
  return { a, e, p, energy, hAng, nu, apogee: a * (1 + e) - R_EARTH, perigee: a * (1 - e) - R_EARTH };
}
const E_of_nu = (nu, e) => 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
const nu_of_E = (E, e) => 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
/** Kepler: the true anomaly a time dt after true anomaly nu0 on orbit (a, e). */
export function propagate(o, nu0, dt) {
  const n = Math.sqrt(MU / o.a ** 3), E0 = E_of_nu(nu0, o.e), M0 = E0 - o.e * Math.sin(E0);
  const M = M0 + n * dt;
  let E = M;
  for (let i = 0; i < 30; i++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
  return nu_of_E(E, o.e);
}
/** Radius, speed and flight-path angle at true anomaly nu. */
export function stateOn(o, nu) {
  const r = o.p / (1 + o.e * Math.cos(nu)), v = Math.sqrt(MU * (2 / r - 1 / o.a));
  const gamma = Math.atan2(o.e * Math.sin(nu), 1 + o.e * Math.cos(nu));
  return { r, v, gamma };
}

/** The whole chain, once. */
export function missionChain() {
  const cut = cutoffState();
  const o1 = orbitOf(R_EARTH + cut.h, cut.v, cut.gamma);
  // Coast to the burn.
  const nuB = propagate(o1, o1.nu, MISSION.deorbitStart - cut.t);
  const atBurn = stateOn(o1, nuB);
  // The burn: propellant and Δv (retrograde, impulsive at its middle: 11 s against a 90 min orbit, ≈).
  const { thrust, isp } = MISSION.deorbit, dur = MISSION.deorbitEnd - MISSION.deorbitStart;
  const m0 = cut.m - MISSION.payload, prop = thrust * dur / (isp * G0), m1 = m0 - prop;
  const dv = isp * G0 * Math.log(m0 / m1);
  const vx = atBurn.v * Math.cos(atBurn.gamma) - dv, vy = atBurn.v * Math.sin(atBurn.gamma);
  const o2 = orbitOf(atBurn.r, Math.hypot(vx, vy), Math.atan2(vy, vx));
  // Down to the interface.
  const rI = R_EARTH + MISSION.interface;
  let entry = null;
  if (o2.perigee < MISSION.interface) {
    const cosNu = (o2.p / rI - 1) / o2.e, nuI = -Math.acos(Math.max(-1, Math.min(1, cosNu)));   // descending
    const sI = stateOn(o2, nuI);
    // Time from the burn to the interface, by mean anomalies.
    const n = Math.sqrt(MU / o2.a ** 3), Mof = (nu) => { const E = E_of_nu(nu, o2.e); return E - o2.e * Math.sin(E); };
    let dM = Mof(nuI) - Mof(o2.nu);
    while (dM < 0) dM += 2 * Math.PI;
    entry = { t: MISSION.deorbitEnd + dM / n - dur / 2, h: MISSION.interface, v: sI.v, gamma: sI.gamma, m: m1 };
  }
  return {
    cutoff: cut, orbit: o1, burn: { t0: MISSION.deorbitStart, t1: MISSION.deorbitEnd, m0, m1, propellant: prop, dv, at: atBurn },
    deorbitOrbit: o2, entry,
    masses: [
      { t: cut.t, what: 'cutoff: the ascent burn leaves it', m: cut.m },
      { t: MISSION.deorbitStart, what: 'payload deploy (≈ none modelled)', dm: -MISSION.payload },
      { t: MISSION.deorbitEnd, what: 'deorbit burn: propellant at thrust / (Isp·g0)', dm: -prop },
    ],
  };
}
