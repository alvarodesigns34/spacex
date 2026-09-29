/**
 * Starship launch sequence: countdown, ignition, liftoff, ascent, Max-Q, MECO and
 * hot-stage separation.
 *
 * WHAT IS CITED AND WHAT IS RECONSTRUCTED
 *
 * The event times are taken verbatim from the published flight-test timeline (Wikipedia's
 * Starship flight test 7 article, itself transcribed from the SpaceX webcast): liftoff at
 * T+00:00:02, Max-Q at T+00:01:02, MECO at T+00:02:32, hot-stage separation at T+00:02:40.
 * The times are the cited part. The speed at separation is not: this file used to attribute
 * ≈ 5 700 km/h to IFT-3 behind a link to an article about the flight 5 catch, which carries no
 * such figure, and no flight timeline I could check gives one. It is the anchor the curve is
 * authored to, and it is declared as reconstructed on the sheet.
 *
 * The altitude and speed *curve* between those points is not published as a table anywhere,
 * so it is reconstructed: a monotone cubic through keyframes that hit the cited times and that
 * separation-speed anchor, flagged `approx` in data/specs.js and labelled in the mission
 * panel. Everything downstream is then derived from that one curve rather than invented
 * separately — the flight-path angle comes from dh/dt against speed, the downrange distance
 * from integrating the horizontal component, and the vehicle's attitude from the flight-path
 * angle. So the pitch you see and the numbers on the panel cannot disagree with each other.
 *
 * Time runs 1:1 by default. The speed control multiplies the mission clock, it does not skip.
 */
import * as THREE from 'three';
import { Plume, GroundCloud, EngineJets, Vapor, CondensationCollar, FlightEarth, Glow, Fire } from './plume.js';
import { BOOSTER_RINGS, RAPTOR_EXIT_R, ringAngle, BOOSTER_AFT } from '../vehicles/starship.js';
import { seeded, monotoneSlopes, hermite } from '../geometry/utils.js';
import { PAD } from '../vehicles/pad.js';

// ---- Cited event times (seconds from T-0) ------------------------------------------------
export const EVENTS = {
  // The terminal count, from the same flight 7 timeline (Wikipedia, Starship flight test 7):
  // the flight director's GO for launch at T−00:00:30, the flame deflector's water at
  // T−00:00:10 and Super Heavy engine ignition at T−00:00:03. The sequence opens ten seconds
  // before the GO, with the stack fuelled and venting.
  start: -40,
  goForLaunch: -30,    // cited: "Flight director verifies go for launch"
  deflector: -10,      // cited: "Flame deflector activation"
  ignition: -3,        // cited: "Super Heavy engine ignition"
  liftoff: 2,          // cited
  towerClear: 0,       // derived below from the integrated altitude (the base clears the tower top)
  maxQ: 62,            // cited
  meco: 152,           // cited
  separation: 160,     // cited
  // Booster return, from the flight 5 timeline (Wikipedia, Starship flight test 5): the
  // first time anyone caught an orbital-class booster. Times are that flight's, shifted by
  // nothing — its boostback started 1 s after this model's separation, which is close enough
  // that the two timelines can share a clock.
  boostbackStart: 165,   // cited: +00:02:45
  boostbackEnd: 221,     // cited: +00:03:41
  landingBurn: 390,      // cited: +00:06:30
  catch: 414,            // cited: +00:06:54, landing burn shutdown and catch
  end: 436,
};

/**
 * Reconstructed ascent, built from exactly two authored inputs so that nothing in the
 * simulation can contradict anything else:
 *
 *   1. a speed curve v(t), pinned to zero until the cited liftoff time and to the authored
 *      ≈ 5 700 km/h (1 583 m/s) anchor at the cited separation time;
 *   2. a gravity-turn pitch programme θ(t) — zero while the vehicle clears the tower, then
 *      an exponential approach to 72° from vertical with a 64 s time constant.
 *
 * Altitude and downrange distance are then *integrated* from those two, not authored
 * separately, so the attitude on screen, the altitude on the panel and the speed on the
 * panel are one object seen three ways. The integration lands the vehicle at 55,8 km and
 * 81 km downrange at separation, which is the right neighbourhood for a Starship staging
 * point; the shape of both inputs is a reconstruction and is labelled as such in the panel.
 */
const SPEED_KEYS = [
  [0, 0], [2, 0],          // cited: the stack leaves the mount at T+00:00:02
  [10, 52], [20, 105], [30, 165], [45, 262],
  [62, 392],               // cited time: Max-Q
  [80, 548], [100, 745], [120, 978], [140, 1272],
  [152, 1470],             // cited time: MECO
  // Cited time. The speed is NOT cited: it used to point at a NASASpaceflight article about
  // the flight 5 catch, which does not carry a separation speed, and neither Wikipedia flight
  // timeline gives one either. 1 583 m/s is the anchor this curve is authored to, and the
  // sheet says so rather than dressing it as published.
  [160, 1583],
  [175, 1690], [196, 1880], [260, 2380], [340, 3020], [436, 3760],
];
const PITCH = { start: EVENTS.liftoff + 6, max: THREE.MathUtils.degToRad(72), tau: 64 };
const pitchProgram = (t) => (t <= PITCH.start ? 0 : PITCH.max * (1 - Math.exp(-(t - PITCH.start) / PITCH.tau)));

/**
 * Integrates the two inputs once, at load, into a 0,25 s table. Doing it up front is what
 * makes seek() exact: the headless check can jump to any mission time and get the state the
 * animation would have reached by running there, rather than a separate approximation.
 *
 * Up to hot-staging the stack follows the authored speed curve and pitch programme. From
 * separation on, the SHIP is no longer authored at all: it is integrated as a point mass
 * (3-DOF in the flight plane) from the stack's exact state at separation, with its published
 * thrust and propellant load (spacex.com: 1 614 tf, 1 600 t) and assumed specific impulses
 * and dry mass (SHIP_ASSUMED, marked ≈ on the sheet). The old table carried the ascent
 * curve on to T+7:16, which had the ship's acceleration FALLING from 0,98 to 0,79 g while it
 * burned propellant (a rocket's rises as it gets lighter) and put it at 299 km and 3,8 km/s,
 * higher than any suborbital Starship flight and at half orbital speed.
 */
export const SHIP_ASSUMED = {
  thrust: 1614e3 * 9.80665,      // N, spacex.com (Starship, V3): 1 614 tf
  propellant: 1600e3,            // kg, spacex.com: 1 600 t
  dry: 150e3,                    // kg, ≈ assumed: dry mass plus residuals, not published for V3
  ispSL: 350,                    // s, ≈ assumed: Raptor 3 sea-level engines in vacuum
  ispVac: 380,                   // s, ≈ assumed: Raptor Vacuum
  slShare: 750 / 1575,           // thrust share of the three sea-level engines (3 × 250 of 3 × 250 + 3 × 275 tf)
  holdAltitude: 150e3,           // m, ≈ assumed: the ship levels off here by the end of the sequence
};
/** Linear-tangent constants, solved at load (see buildProfile). */
export const SHIP_STEERING = { e0: 0, c: 0 };
const G0 = 9.80665, R_EARTH = 6371e3;
/** Ship mass flow at full thrust: each engine group's thrust over its own Isp·g0. */
export const shipMassFlow = () => {
  const { thrust: F, slShare: k, ispSL, ispVac } = SHIP_ASSUMED;
  return (F * k) / (ispSL * G0) + (F * (1 - k)) / (ispVac * G0);
};
function buildProfile() {
  const xs = SPEED_KEYS.map(k => k[0]);
  const vy = SPEED_KEYS.map(k => k[1]);
  const vm = monotoneSlopes(xs, vy);
  const step = 0.25, sub = 5, dt = step / sub;
  const n = Math.round(EVENTS.end / step) + 1;
  const iSep = Math.round(EVENTS.separation / step);
  const alt = new Float64Array(n), spd = new Float64Array(n), down = new Float64Array(n), pit = new Float64Array(n), att = new Float64Array(n);
  const mass = new Float64Array(n), acc = new Float64Array(n);
  let h = 0, x = 0, t = 0;
  for (let i = 0; i <= iSep; i++) {
    if (i > 0) {
      for (let k = 0; k < sub; k++) {
        const v = hermite(xs, vy, vm, t + dt * 0.5), p = pitchProgram(t + dt * 0.5);
        h += v * Math.cos(p) * dt;
        x += v * Math.sin(p) * dt;
        t += dt;
      }
    }
    alt[i] = h; spd[i] = hermite(xs, vy, vm, i * step); down[i] = x; pit[i] = att[i] = pitchProgram(i * step);
  }
  // ---- Ship after separation: point mass, published thrust, mass from the rocket equation ----
  // Steering is the linear-tangent law of vacuum ascent (tan e = tan e₀ − c·(t − t_sep), e the
  // thrust elevation above the horizon), the textbook optimum for a burn outside the air. Its
  // two constants are not chosen: they are solved at load, by Newton, so the ship levels off at
  // the assumed hold altitude with no climb rate left at the end of the sequence. The attitude
  // slews from the stack's at separation to the law at 3°/s, so there is no snap.
  const S = SHIP_ASSUMED, mdot = shipMassFlow();
  const iEnd = n - 1;
  const MAX_RATE = THREE.MathUtils.degToRad(3);
  const throttleAt = (tt) => THREE.MathUtils.smoothstep(tt, EVENTS.separation - 1.5, EVENTS.separation + 1.5);
  const fly = (q, rec) => {
    const [e0, c] = q;
    let vx = spd[iSep] * Math.sin(pit[iSep]), vh = spd[iSep] * Math.cos(pit[iSep]);
    let m = S.propellant + S.dry, a = att[iSep], hh = alt[iSep], xx = down[iSep], tt = EVENTS.separation;
    if (rec) mass[iSep] = m;
    for (let i = iSep + 1; i <= iEnd; i++) {
      for (let k = 0; k < sub; k++) {
        const r = R_EARTH + hh, g = G0 * (R_EARTH / r) ** 2;
        const burning = m > S.dry;
        const thr = burning ? throttleAt(tt) : 0;
        const aT = thr * S.thrust / m;
        const want = Math.PI / 2 - Math.atan(Math.tan(e0) - c * (tt - EVENTS.separation));
        a += THREE.MathUtils.clamp(want - a, -MAX_RATE * dt, MAX_RATE * dt);
        vx += aT * Math.sin(a) * dt;
        vh += (aT * Math.cos(a) - g + (vx * vx) / r) * dt;
        xx += vx * dt; hh += vh * dt;
        if (burning) m = Math.max(S.dry, m - thr * mdot * dt);
        tt += dt;
      }
      if (rec) {
        alt[i] = hh; down[i] = xx; spd[i] = Math.hypot(vx, vh); pit[i] = Math.atan2(vx, vh); att[i] = a;
        mass[i] = m; acc[i] = m > S.dry ? throttleAt(tt) * S.thrust / m : 0;
      }
    }
    return [hh - S.holdAltitude, vh];
  };
  const q = [THREE.MathUtils.degToRad(30), 0.002];
  for (let it = 0; it < 30; it++) {
    const r = fly(q, false);
    if (Math.abs(r[0]) < 1 && Math.abs(r[1]) < 0.01) break;
    const d = [1e-4, 1e-6], J = d.map((dd, j) => { const qq = q.slice(); qq[j] += dd; const rr = fly(qq, false); return [(rr[0] - r[0]) / dd, (rr[1] - r[1]) / dd]; });
    const det = J[0][0] * J[1][1] - J[1][0] * J[0][1];
    q[0] -= (J[1][1] * r[0] - J[1][0] * r[1]) / det;
    q[1] -= (-J[0][1] * r[0] + J[0][0] * r[1]) / det;
  }
  fly(q, true);
  SHIP_STEERING.e0 = q[0]; SHIP_STEERING.c = q[1];
  return { step, n, alt, spd, down, pit, att, mass, acc };
}
const PROFILE = buildProfile();

// ---- Booster return ----------------------------------------------------------------------
// One integrated trajectory from separation to the arms. Position, velocity and attitude all
// come from it, so the booster on screen, the speed on the panel and the way it points cannot
// disagree — and nothing jumps at the joins.
//
// What is cited: the four times (boostback T+02:45–T+03:41, landing burn T+06:30, catch
// T+06:54, flight 5), the booster going transonic five seconds before its landing burn
// (flight 7: T+06:26 against a burn at T+06:31), and the state it starts from, which is the
// stack's own at separation (itself integrated from the ascent inputs above). What is assumed,
// and marked so in the sheet: a 250 t booster for drag over the 9 m disc, an exponential
// atmosphere (ρ₀ 1,225 kg/m³, 8,5 km scale height), a boostback of constant thrust direction
// and size, a landing burn of constant thrust against the velocity on the thirteen inner
// engines until the centre three take over at ≈T+06:37 (approximate and unverified, see below),
// and a steady 1,6 m/s² deceleration on the centre three from there into the arms. What is
// *solved*, rather than chosen: those two thrusts, the boostback's direction and the drag
// coefficient, by Newton iteration at load, so the booster goes transonic at the cited
// offset and the burn lit at the cited T+06:30 hands over to the centre three at the speed
// and height that deceleration needs. The
// centre three then set it down in the arms on a cubic that matches position and velocity
// at both ends.
//
// It used to take Cd ≈ 0,9 as given and solve only the burns. That booster was still at
// Mach 2,3, 5 km up, when its landing burn lit, and crossed Mach 1 seven seconds into the
// burn — the opposite order to every flight that has called it — and it kept the thirteen
// engines lit until T+06:46,5, against the only reading there was of three at T+06:37.
//
// The model integrates the booster's centre of mass, 30 m up its axis, not its base: it flips
// about that point, as a free body does, instead of swinging 70 m of tank about its engines.
const CATCH_BASE = 22;            // booster base held this far above the mount deck when caught
export const RETURN_ASSUMED = { mass: 250e3, diameter: 9, rho0: 1.225, scaleHeight: 8500, comOffset: 30, threeDecel: 1.6 };
export const TRANSONIC_LEAD = 5;   // cited: flight 7, transonic T+06:26, landing burn T+06:31
// ≈, NOT telemetry: an earlier external audit read the engine count off third-party (RGV)
// footage of flight 5 as 13 at T+6:30 and 3 by T+6:37. It has not been checked frame by frame
// against the original video; until it is, it stays approximate and is not re-timed.
export const BURN_THREE = 397;     // ≈T+06:37, 13 engines → centre 3 (approximate)
// V3 (Block 3) engine counts, from SpaceX's own flight summaries: flight 13's booster "completed
// the high thrust portion of the boostback burn with all 33 engines, the first time with a
// Super Heavy V3"; flight 14's relit for "the high-thrust portion of the landing burn" on the
// planned 13 "before down-selecting to five engines for trajectory fine-tuning, and then down
// to three" (spacex.com, flights 13 and 14, read through search summaries on 28 Sep 2026).
// The ORDER is cited; how long each portion lasts is not published, so these two are ≈.
export const BOOSTBACK_33 = 10;    // ≈ s of the boostback on all 33 before the inner 13 carry on
export const BURN_FIVE = BURN_THREE - 3;   // ≈ 13 → 5 engines, 3 s before the centre three
const FLIP_END = 166.5;            // the flip to boostback attitude, overlapping the throttle-up
const RETRO_BLEND = [221, 245];    // after the boostback: swing to engines-first

const pitchRate = (t) => (pitchProgram(t + 0.01) - pitchProgram(t - 0.01)) / 0.02;

const RETURN_ITER = { n: 0 };
const RETURN = (() => {
  const { mass: M, diameter, rho0, scaleHeight, comOffset: R, threeDecel } = RETURN_ASSUMED;
  const G = 9.81, AREA = Math.PI * (diameter / 2) ** 2, DT = 0.02;
  const K = (h, cd) => rho0 * Math.exp(-Math.max(h, 0) / scaleHeight) * cd * AREA / (2 * M);
  const T0 = EVENTS.separation, BB0 = EVENTS.boostbackStart, BB1 = EVENTS.boostbackEnd;
  const LB = EVENTS.landingBurn, TT = LB - TRANSONIC_LEAD;
  // Stop where the centre three can take it to the arms at a steady deceleration: over the
  // remaining 17 s at 1,6 m/s² that is 27 m/s, 231 m above the catch height.
  const T3 = EVENTS.catch - BURN_THREE;
  const STOP_V = -threeDecel * T3, STOP_H = CATCH_BASE + threeDecel * T3 * T3 / 2 + R;
  const sst = THREE.MathUtils.smoothstep;
  // Thrust per engine is the same whichever are lit, so the 33-engine portion pushes 33/13 as
  // hard as the rest of the boostback, and five engines push 5/13 of thirteen. The solve then
  // finds the per-engine thrust that meets the cited times with that shape.
  const bbWeight = (t) => sst(t, BB0, BB0 + 2) * (1 - sst(t, BB1 - 3, BB1))
    * (1 + (33 / 13 - 1) * (1 - sst(t, BB0 + BOOSTBACK_33 - 0.5, BB0 + BOOSTBACK_33 + 0.5)));
  const lbWeight = (t) => 1 - (1 - 5 / 13) * sst(t, BURN_FIVE - 0.25, BURN_FIVE + 0.25);

  // Initial state: the base of the stack at separation, plus R up the axis, moving with it.
  const p0 = pitchProgram(T0), w0 = pitchRate(T0), v0 = PROFILE.spd[EVENTS.separation / PROFILE.step];
  const init = [
    PROFILE.down[EVENTS.separation / PROFILE.step] + R * Math.sin(p0),
    PROFILE.alt[EVENTS.separation / PROFILE.step] + R * Math.cos(p0),
    v0 * Math.sin(p0) + R * w0 * Math.cos(p0),
    v0 * Math.cos(p0) - R * w0 * Math.sin(p0),
  ];

  function deriv(t, s, q, out) {
    const [, h, vx, vh] = s;
    const sp = Math.hypot(vx, vh), k = K(h, q[3]);
    let ax = -k * sp * vx, ah = -G - k * sp * vh;
    if (t >= BB0 && t <= BB1) { const w = bbWeight(t); ax += w * q[0]; ah += w * q[1]; }
    if (t >= LB) { const sp1 = sp || 1, w = sst(t, LB, LB + 1.5) * lbWeight(t); ax -= w * q[2] * vx / sp1; ah -= w * q[2] * vh / sp1; }
    out[0] = vx; out[1] = vh; out[2] = ax; out[3] = ah;
  }
  const k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0], tmp = [0, 0, 0, 0];
  function rk4(t, s, dt, q) {
    deriv(t, s, q, k1);
    for (let i = 0; i < 4; i++) tmp[i] = s[i] + k1[i] * dt / 2;
    deriv(t + dt / 2, tmp, q, k2);
    for (let i = 0; i < 4; i++) tmp[i] = s[i] + k2[i] * dt / 2;
    deriv(t + dt / 2, tmp, q, k3);
    for (let i = 0; i < 4; i++) tmp[i] = s[i] + k3[i] * dt;
    deriv(t + dt, tmp, q, k4);
    return s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  // Flies q = [boostback ax, boostback ah, landing-burn thrust (m/s²), Cd] from separation
  // until the burn has slowed the descent to STOP_V; returns the stop time and state, and the
  // moment the falling booster crossed Mach 1 (interpolated, so the solve sees it move smoothly).
  function fly(q, rec) {
    let s = init.slice(), t = T0, trans = null, m0 = 0;
    while (t < 440) {
      const n = rk4(t, s, DT, q);
      if (trans === null && t > BB1 && n[3] < 0) {
        const m1 = Math.hypot(n[2], n[3]) / soundSpeedAt(n[1] - R) - 1;
        if (m0 > 0 && m1 <= 0) trans = t + DT * m0 / (m0 - m1);
        m0 = m1;
      }
      if (t + DT > LB && n[3] >= STOP_V) {
        const f = (STOP_V - s[3]) / (n[3] - s[3]);
        const e = s.map((v, i) => v + (n[i] - v) * f);
        if (rec) rec.push([t + DT * f, ...e]);
        return { t: t + DT * f, s: e, trans };
      }
      s = n; t += DT;
      if (rec) rec.push([t, ...s]);
    }
    return { t, s, trans };
  }
  const residual = (q) => {
    const r = fly(q);
    return [r.s[0] / 1000, (r.s[1] - STOP_H) / 100, r.t - BURN_THREE, (r.trans ?? LB + 20) - TT];
  };
  // Seeded with the converged solution, so this normally takes one step to confirm it.
  let q = [-40.566336, 2.321945, 42.585252, 1.74135];
  for (let it = 0; it < 30; it++) {
    RETURN_ITER.n = it;
    const r0 = residual(q), n0 = Math.hypot(...r0);
    if (n0 < 1e-4) break;
    const J = q.map((_, j) => { const qq = q.slice(); qq[j] += 0.01; return residual(qq).map((v, i) => (v - r0[i]) / 0.01); });
    const d = solveN(r0.map((_, i) => J.map((col) => col[i])), r0.map((v) => -v));
    let lam = 1;
    while (lam > 1e-3) { const qn = q.map((v, j) => v + lam * d[j]); if (Math.hypot(...residual(qn)) < n0) { q = qn; break; } lam /= 2; }
    if (lam <= 1e-3) break;
  }
  const rec = [];
  const stop = fly(q, rec);
  // Resample onto a uniform table and append the final descent on the centre three: a cubic
  // per axis from the stop state to the arms (base 22 m over the mount, at rest) at the catch.
  const step = DT, t1 = EVENTS.end, n = Math.round((t1 - T0) / step) + 1;
  const tab = { step, n, x: new Float64Array(n), h: new Float64Array(n), vx: new Float64Array(n), vh: new Float64Array(n) };
  const Tf = EVENTS.catch - stop.t, [xs, hs, vxs, vhs] = stop.s, HT = CATCH_BASE + R;
  const cubic = (p0, v0, p1, u) => {
    const c = (3 * (p1 - p0) - 2 * v0 * Tf) / (Tf * Tf), d = (2 * (p0 - p1) + v0 * Tf) / (Tf * Tf * Tf);
    return [p0 + v0 * u + c * u * u + d * u * u * u, v0 + 2 * c * u + 3 * d * u * u];
  };
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = T0 + i * step;
    if (t <= stop.t) {
      while (j < rec.length - 2 && rec[j + 1][0] < t) j++;
      const a = j === 0 && t < rec[0][0] ? [T0, ...init] : rec[j], b = rec[j + 1] ?? rec[j];
      const f = b[0] > a[0] ? THREE.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
      tab.x[i] = a[1] + (b[1] - a[1]) * f; tab.h[i] = a[2] + (b[2] - a[2]) * f;
      tab.vx[i] = a[3] + (b[3] - a[3]) * f; tab.vh[i] = a[4] + (b[4] - a[4]) * f;
    } else if (t < EVENTS.catch) {
      const u = t - stop.t;
      [tab.x[i], tab.vx[i]] = cubic(xs, vxs, 0, u);
      [tab.h[i], tab.vh[i]] = cubic(hs, vhs, HT, u);
    } else { tab.x[i] = 0; tab.h[i] = HT; tab.vx[i] = 0; tab.vh[i] = 0; }
  }
  let apo = 0, apoT = T0, apoX = 0, vMax = 0, vMaxT = T0;
  for (let i = 0; i < n; i++) {
    if (tab.h[i] > apo) { apo = tab.h[i]; apoT = T0 + i * step; apoX = tab.x[i]; }
    const sp = Math.hypot(tab.vx[i], tab.vh[i]);
    if (T0 + i * step > BB1 && sp > vMax) { vMax = sp; vMaxT = T0 + i * step; }
  }
  const burnIdx = Math.round((LB - T0) / step);
  return {
    tab, q, stop,
    apogee: { t: apoT, h: apo - R, x: apoX },
    reentryPeak: { t: vMaxT, speed: vMax },
    burnStart: { h: tab.h[burnIdx] - R, speed: Math.hypot(tab.vx[burnIdx], tab.vh[burnIdx]) },
    bbPitch: Math.atan2(q[0], q[1]),
    transonic: stop.trans,
  };
})();

/** Gaussian elimination with partial pivoting, n × n. */
function solveN(A, b) {
  const n = b.length, m = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
    [m[i], m[p]] = [m[p], m[i]];
    for (let k = i + 1; k < n; k++) { const f = m[k][i] / m[i][i]; for (let c = i; c <= n; c++) m[k][c] -= f * m[i][c]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let v = m[i][n]; for (let c = i + 1; c < n; c++) v -= m[i][c] * x[c]; x[i] = v / m[i][i]; }
  return x;
}

/** Centre of mass and its velocity at t ≥ separation: cubic Hermite through the table. */
function returnState(t) {
  const T = RETURN.tab, u = THREE.MathUtils.clamp((t - EVENTS.separation) / T.step, 0, T.n - 1);
  const i = Math.min(Math.floor(u), T.n - 2), f = u - i, dt = T.step;
  const hp = (a, va, b, vb) => {
    const f2 = f * f, f3 = f2 * f;
    return (2 * f3 - 3 * f2 + 1) * a + (f3 - 2 * f2 + f) * dt * va + (-2 * f3 + 3 * f2) * b + (f3 - f2) * dt * vb;
  };
  return {
    x: hp(T.x[i], T.vx[i], T.x[i + 1], T.vx[i + 1]), h: hp(T.h[i], T.vh[i], T.h[i + 1], T.vh[i + 1]),
    vx: T.vx[i] + (T.vx[i + 1] - T.vx[i]) * f, vh: T.vh[i] + (T.vh[i + 1] - T.vh[i]) * f,
  };
}

/**
 * Attitude after separation, radians from vertical (positive leans the nose downrange):
 * flip to the boostback's thrust direction (the nose is where the engines push), hold it
 * through the burn, then swing engines-first — nose opposite the velocity, the way a booster
 * falls — and come upright over the last seconds into the arms.
 */
function returnPitch(t) {
  const sst = THREE.MathUtils.smoothstep;
  const pS = pitchProgram(EVENTS.separation), wS = pitchRate(EVENTS.separation), pB = RETURN.bbPitch;
  if (t < FLIP_END) {
    const T = FLIP_END - EVENTS.separation, u = (t - EVENTS.separation) / T, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * pS + (u3 - 2 * u2 + u) * T * wS + (-2 * u3 + 3 * u2) * pB;
  }
  if (t < RETRO_BLEND[0]) return pB;
  const s = returnState(t);
  const retro = Math.hypot(s.vx, s.vh) > 0.5 ? Math.atan2(-s.vx, -s.vh) : 0;
  const upright = sst(t, BURN_THREE, EVENTS.catch - 3);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(pB, retro, sst(t, RETRO_BLEND[0], RETRO_BLEND[1])), 0, upright);
}

export const boosterPitchAt = (t) => (t < EVENTS.separation ? pitchAt(t) : returnPitch(t));
// The base of the booster (its engines), which is what the scene positions.
export const boosterDownAt = (t) => {
  if (t < EVENTS.separation) return downrangeAt(t);
  return returnState(t).x - RETURN_ASSUMED.comOffset * Math.sin(returnPitch(t));
};
export const boosterAltAt = (t) => {
  if (t < EVENTS.separation) return altitudeAt(t);
  return Math.max(0, returnState(t).h - RETURN_ASSUMED.comOffset * Math.cos(returnPitch(t)));
};
/** The same trajectory's summary, for the data sheet and the checks. */
export const returnSummary = () => ({
  apogee: RETURN.apogee, reentryPeak: RETURN.reentryPeak, burnStart: RETURN.burnStart,
  boostback: { accel: Math.hypot(RETURN.q[0], RETURN.q[1]), pitchDeg: THREE.MathUtils.radToDeg(RETURN.bbPitch) },
  landingBurnAccel: RETURN.q[2], cd: RETURN.q[3], transonic: RETURN.transonic, stop: { t: RETURN.stop.t }, q: RETURN.q.slice(), iterations: RETURN_ITER.n,
});
/**
 * Speed of the booster's base, differentiated from the positions the scene uses, so the
 * number on the panel cannot contradict the thing on the screen. Every piece of the path is
 * C¹, so a narrow central difference is exact to well under 1 km/h.
 */
export function boosterSpeedAt(t) {
  if (t < EVENTS.separation) return speedAt(t);
  const h = 0.02;
  const dy = boosterAltAt(t + h) - boosterAltAt(t - h);
  const dx = boosterDownAt(t + h) - boosterDownAt(t - h);
  return Math.hypot(dx, dy) / (2 * h);
}

/** Booster engines after separation: the boostback burn, then the landing burn. */
function returnThrottle(t) {
  const sst = THREE.MathUtils.smoothstep;
  if (t >= EVENTS.boostbackStart && t <= EVENTS.boostbackEnd) {
    // All 33 for the high-thrust portion, then the inner 13 (V3; see BOOSTBACK_33).
    const share = 13 / 33 + (1 - 13 / 33) * (1 - sst(t, EVENTS.boostbackStart + BOOSTBACK_33 - 0.5, EVENTS.boostbackStart + BOOSTBACK_33 + 0.5));
    return share * sst(t, EVENTS.boostbackStart, EVENTS.boostbackStart + 2)
      * (1 - sst(t, EVENTS.boostbackEnd - 3, EVENTS.boostbackEnd));
  }
  if (t >= EVENTS.landingBurn && t <= EVENTS.catch) {
    // Thirteen engines to arrest the descent, five to fine-tune, the centre three for the approach.
    const n = t < BURN_FIVE ? 13 : t < BURN_THREE ? 5 : 3;
    const prev = t < BURN_FIVE ? 13 : t < BURN_THREE ? 13 : 5;
    const at = t < BURN_FIVE ? 0 : t < BURN_THREE ? BURN_FIVE : BURN_THREE;
    const lit = (prev + (n - prev) * sst(t, at - 0.25, at + 0.25)) / 33;
    return lit * (1 - sst(t, EVENTS.catch - 1.2, EVENTS.catch));
  }
  return 0;
}

/**
 * What the booster's engines are doing at any time, for the plume, the jets, the panel and the
 * sound. The three centre engines that hold the stack through hot-staging do not shut down at
 * separation: on every flight they stay lit through the flip and the inner ring relights around
 * them for the boostback. The trajectory's own thrust model is returnThrottle's; this adds only
 * the centre engines' low thrust between the two, which the integration leaves out.
 */
function boosterEngineThrottle(t) {
  if (t < EVENTS.separation) return boosterThrottle(t);
  const hold = t < EVENTS.boostbackStart + 3
    ? 0.1 * (1 - THREE.MathUtils.smoothstep(t, EVENTS.boostbackStart + 1, EVENTS.boostbackStart + 3))
    : 0;
  return Math.max(returnThrottle(t), hold);
}

/**
 * Which of the booster's engines are lit, as a share of the cluster's radius (rings at 1,02,
 * 2,48 and 3,86 m, 0,62 m exit radius, 4,48 m overall). Flight 5: 13 lit for the landing burn,
 * down to the centre 3 for the approach (≈T+6:37, an unverified reading of RGV footage); the inner
 * ring for the boostback (flight 7 relit 9 of 10); the centre 3 through hot-staging.
 */
const CENTRE_3 = (1.02 + 0.62) / 4.48, INNER_13 = (2.48 + 0.62) / 4.48;
function boosterSpread(t) {
  const sst = THREE.MathUtils.smoothstep;
  if (t < EVENTS.meco) return 1;
  if (t < EVENTS.boostbackStart) return CENTRE_3;
  if (t <= EVENTS.boostbackEnd) return THREE.MathUtils.lerp(1, INNER_13, sst(t, EVENTS.boostbackStart + BOOSTBACK_33 - 0.5, EVENTS.boostbackStart + BOOSTBACK_33 + 0.5));
  if (t < BURN_FIVE - 0.25) return INNER_13;
  // Five: the centre three and two of the inner ring, so the column is still about as wide.
  if (t < BURN_THREE - 0.25) return THREE.MathUtils.lerp(INNER_13, 0.5 * (INNER_13 + CENTRE_3), sst(t, BURN_FIVE - 0.25, BURN_FIVE + 0.25));
  return THREE.MathUtils.lerp(0.5 * (INNER_13 + CENTRE_3), CENTRE_3, sst(t, BURN_THREE - 0.25, BURN_THREE + 0.25));
}

/** How many booster engines are running, in lighting order (centre 3, inner 10, outer 20). */
function boosterLit(t) {
  if (t < EVENTS.ignition) return 0;
  if (t < EVENTS.liftoff) {
    // The same staggered start as boosterThrottle: centre, then inner ring, then outer.
    const u = (t - EVENTS.ignition) / (EVENTS.liftoff - EVENTS.ignition);
    return u < 0.18 ? 3 : u < 0.4 ? 13 : 33;
  }
  if (t < EVENTS.meco) return 33;
  if (t < EVENTS.boostbackStart) return 3;
  if (t < EVENTS.boostbackStart + BOOSTBACK_33) return 33;
  if (t < BURN_FIVE) return 13;
  if (t < BURN_THREE) return 5;
  return 3;
}

function sample(arr, t) {
  const u = THREE.MathUtils.clamp(t / PROFILE.step, 0, PROFILE.n - 1);
  const i = Math.floor(u), f = u - i;
  return i >= PROFILE.n - 1 ? arr[PROFILE.n - 1] : arr[i] * (1 - f) + arr[i + 1] * f;
}
/**
 * Position between table rows is a cubic Hermite on the integrated velocity (speed along the
 * pitch), not a straight line: linear rows made the velocity a staircase, a 0,25 s step of
 * a few km/h every row that any derivative of the position — the camera, the booster's
 * starting state — would pick up.
 */
function sampleC1(arr, comp, t) {
  const u = THREE.MathUtils.clamp(t / PROFILE.step, 0, PROFILE.n - 1);
  const i = Math.min(Math.floor(u), PROFILE.n - 2), f = u - i, dt = PROFILE.step;
  const va = PROFILE.spd[i] * comp(PROFILE.pit[i]), vb = PROFILE.spd[i + 1] * comp(PROFILE.pit[i + 1]);
  const f2 = f * f, f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * arr[i] + (f3 - 2 * f2 + f) * dt * va + (-2 * f3 + 3 * f2) * arr[i + 1] + (f3 - f2) * dt * vb;
}
export const altitudeAt = (t) => (t <= 0 ? 0 : sampleC1(PROFILE.alt, Math.cos, t));
export const speedAt = (t) => (t <= 0 ? 0 : sample(PROFILE.spd, t));
export const downrangeAt = (t) => (t <= 0 ? 0 : sampleC1(PROFILE.down, Math.sin, t));
/** Attitude, from vertical: the pitch programme on the stack, the thrust direction on the ship. */
export const pitchAt = (t) => (t <= 0 ? 0 : sample(PROFILE.att, t));
/** Flight-path angle, from vertical: the direction of the velocity. */
export const flightPathAt = (t) => (t <= 0 ? 0 : sample(PROFILE.pit, t));
/** Ship mass (kg) and thrust acceleration (m/s²) after separation, for the checks and the panel. */
export const shipMassAt = (t) => (t < EVENTS.separation ? null : sample(PROFILE.mass, t));
export const shipThrustAccelAt = (t) => (t < EVENTS.separation ? null : sample(PROFILE.acc, t));

// The moment the stack clears the tower is read off the integrated climb, not authored: the
// engines' exit plane has to rise from where it rests — BOOSTER_AFT under the deck, and the
// deck 13 m above the pad — past the ≈144,5 m tower top (a reported, unverified total). It was a fixed T+12, by which time
// the curve already has the stack ~300 m up.
{
  const CLIMB = 144.5 - (13 - BOOSTER_AFT);   // ≈, PAD_FIGURES.towerH (grade D)
  let t = EVENTS.liftoff;
  while (altitudeAt(t) < CLIMB && t < 60) t += 0.05;
  EVENTS.towerClear = Math.round(t * 10) / 10;
}

/**
 * Booster throttle. Rated thrust until the throttle-down through Max-Q, back up, then the
 * shutdown to the three centre engines that hold the stack steady through hot-staging.
 */
function boosterThrottle(t) {
  if (t < EVENTS.ignition) return 0;
  if (t < EVENTS.liftoff) {
    // Thirty-three engines do not come up together. Ignition is a staggered sequence over
    // about two seconds — the inner three, then the middle ten, then the outer twenty — and
    // the stack sits on the clamps at full thrust for a moment before they let go. A single
    // smoothstep made the thrust build like a dimmer, which is the one thing in the sequence
    // that reads as an animation rather than as a machine starting.
    const u = THREE.MathUtils.clamp((t - EVENTS.ignition) / (EVENTS.liftoff - EVENTS.ignition), 0, 1);
    const group = (start, share) =>
      share * THREE.MathUtils.smoothstep(u, start, start + 0.2);
    return Math.min(1, group(0.0, 3 / 33) + group(0.18, 10 / 33) + group(0.4, 20 / 33));
  }
  if (t < 46) return 1;
  if (t < EVENTS.maxQ) return 1 - 0.28 * THREE.MathUtils.smoothstep(t, 46, EVENTS.maxQ);
  if (t < 82) return 0.72 + 0.28 * THREE.MathUtils.smoothstep(t, EVENTS.maxQ, 82);
  if (t < 144) return 1;
  if (t < EVENTS.meco) return 1 - 0.9 * THREE.MathUtils.smoothstep(t, 144, EVENTS.meco);
  // Three centre engines out of thirty-three hold the stack through separation.
  if (t < EVENTS.separation + 3) return 0.1;
  return Math.max(0, 0.1 - 0.1 * THREE.MathUtils.smoothstep(t, EVENTS.separation + 3, EVENTS.separation + 7));
}
/** The ship lights through the vented hot-stage section a moment before it separates. */
function shipThrottle(t) {
  if (t < EVENTS.separation - 1.5) return 0;
  return THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation + 1.5);
}

/** Ship engines running: none until hot-staging, then its three sea-level Raptors and three
 *  vacuum Raptors together (flight 7: "Starship engine ignition and stage separation"). */
const shipLit = (t) => (shipThrottle(t) > 0.01 ? 6 : 0);

/**
 * Local speed of sound on the 1976 US Standard Atmosphere's temperature profile (troposphere
 * lapse, the isothermal tropopause, the two stratospheric gradients), a = √(γ·R·T).
 */
export function soundSpeedAt(h) {
  const T = h < 11000 ? 288.15 - 0.0065 * h
    : h < 20000 ? 216.65
    : h < 32000 ? 216.65 + 0.001 * (h - 20000)
    : h < 47000 ? 228.65 + 0.0028 * (h - 32000) : 270.65;
  return Math.sqrt(1.4 * 287.05 * T);
}

/**
 * Two moments the webcast calls that are not inputs here but consequences of the model, found
 * by scanning it: the stack going supersonic on the way up, and the booster falling back
 * through Mach 1 on the way down. Flight 7's timeline puts the second at T+06:26, five seconds
 * before its landing burn; this model's lands where its own trajectory puts it, and the sheet
 * says it is derived.
 */
const DERIVED = (() => {
  let supersonic = null, transonic = null;
  for (let t = EVENTS.liftoff; t < EVENTS.meco; t += 0.05) {
    if (speedAt(t) >= soundSpeedAt(altitudeAt(t))) { supersonic = Math.round(t * 10) / 10; break; }
  }
  for (let t = RETURN.reentryPeak.t; t < EVENTS.catch; t += 0.05) {
    if (boosterSpeedAt(t) < soundSpeedAt(boosterAltAt(t))) { transonic = Math.round(t * 10) / 10; break; }
  }
  return { supersonic, transonic, apogee: Math.round(RETURN.apogee.t) };
})();
export const derivedEvents = () => ({ ...DERIVED });

/**
 * Every milestone the panel calls out, in order. `src` says where the time comes from: a cited
 * timeline ('f7', 'f5') or this model ('model').
 */
export const MILESTONES = [
  { t: EVENTS.goForLaunch, label: 'GO for launch', src: 'f7' },
  { t: EVENTS.deflector, label: 'Flame deflector active', src: 'f7' },
  { t: EVENTS.ignition, label: 'Super Heavy ignition', src: 'f7' },
  { t: EVENTS.liftoff, label: 'Liftoff', src: 'f7' },
  { t: EVENTS.towerClear, label: 'Tower cleared', src: 'model' },
  ...(DERIVED.supersonic ? [{ t: DERIVED.supersonic, label: 'Supersonic', src: 'model' }] : []),
  { t: EVENTS.maxQ, label: 'Max-Q', src: 'f7' },
  { t: EVENTS.meco, label: 'MECO', src: 'f7' },
  { t: EVENTS.separation, label: 'Hot-staging', src: 'f7' },
  { t: EVENTS.boostbackStart, label: 'Boostback burn', src: 'f5' },
  { t: EVENTS.boostbackEnd, label: 'Boostback shutdown', src: 'f5' },
  { t: DERIVED.apogee, label: 'Booster apogee', src: 'model' },
  // The crossing is the model's own (T+6:25 on this clock). What is cited is the interval: the
  // drag is solved so it falls five seconds before the landing burn, as flight 7's did
  // (T+6:26, burn T+6:31). `tunedTo` keeps that apart from where the time comes from.
  ...(DERIVED.transonic ? [{ t: DERIVED.transonic, label: 'Booster transonic', src: 'model', tunedTo: 'f7' }] : []),
  { t: EVENTS.landingBurn, label: 'Landing burn', src: 'f5' },
  { t: EVENTS.catch, label: 'Booster caught', src: 'f5' },
].sort((a, b) => a.t - b.t);

/** Engine layouts for the panel's engine dials, in lighting order. */
export const ENGINE_LAYOUT = {
  booster: BOOSTER_RINGS.map((ring) => ({ n: ring[0], r: ring[1], phase: ring[3], angles: ring[4] ?? null, size: RAPTOR_EXIT_R })),
  ship: [{ n: 3, r: 0.95, phase: 0, size: RAPTOR_EXIT_R }, { n: 3, r: 3.05, phase: Math.PI / 3, size: 1.15 }],
};

const PHASES = [
  [EVENTS.goForLaunch, 'Terminal count'],
  [EVENTS.deflector, 'GO for launch'],
  [EVENTS.ignition, 'Flame deflector active'],
  [EVENTS.liftoff, 'Super Heavy ignition'],
  [EVENTS.towerClear, 'Liftoff'],
  // A phase never names an event the panel still lists as next: Max-Q used to start 6 s
  // early, under "Next · Max-Q", and "Supersonic" was announced but never shown.
  [DERIVED.supersonic ?? EVENTS.maxQ, 'Ascent · tower cleared'],
  ...(DERIVED.supersonic ? [[EVENTS.maxQ, 'Ascent · supersonic']] : []),
  [EVENTS.maxQ + 8, 'Max-Q · peak dynamic pressure'],
  [EVENTS.meco, 'Ascent'],
  [EVENTS.separation, 'MECO · engine cutoff'],
  [EVENTS.boostbackStart, 'Hot-staging'],
  [EVENTS.boostbackEnd, 'Booster boostback burn'],
  [EVENTS.landingBurn, 'Booster coasting back'],
  [EVENTS.catch, 'Booster landing burn'],
  [EVENTS.catch + 8, 'Caught by the tower'],
  [Infinity, 'Booster in the arms'],
];
const phaseAt = (t) => (PHASES.find(p => t < p[0]) ?? PHASES[PHASES.length - 1])[1];

// =========================================================================================
export function createLaunch({ scene, exhibits, complex, env, rig, camera, quality = {}, onState = () => {}, onFinish = () => {}, onStart = () => {} }) {
  const ex = exhibits.starship;
  const flight = new THREE.Group();
  flight.name = 'flight';
  // The vehicle is re-parented under a group of its own so the sequence can move and pitch
  // it without dragging the launch complex with it.
  ex.group.remove(ex.model);
  flight.add(ex.model);
  ex.group.add(flight);
  ex.flight = flight;

  const booster = ex.model.getObjectByName('superheavy');
  const ship = ex.model.getObjectByName('ship');
  const shipHome = ship.position.y;
  const parts = complex.userData.parts;

  // The booster flies its own trajectory after staging — out to 95 km downrange and back to
  // the tower — so it gets its own group beside the ship's rather than a small offset inside
  // it. Before separation the two are driven with identical transforms, which is also what
  // keeps seek() exact: there is no state carried across the split.
  const boosterHome = { parent: booster.parent, position: booster.position.clone() };
  // Two groups, not one: `flight` carries the trajectory and `ex.model` carries the exhibit's
  // own mount height and yaw, and the booster's chain has to compose in exactly the same order
  // or the two vehicles drift apart before they have separated. Collapsing them into a single
  // group did precisely that — at T+26 the ship was already flying beside its own booster.
  const boosterFlight = new THREE.Group();
  boosterFlight.name = 'booster-flight';
  const boosterModel = new THREE.Group();
  boosterModel.name = 'booster-model';
  boosterModel.position.copy(ex.model.position);
  boosterModel.rotation.copy(ex.model.rotation);
  boosterFlight.add(boosterModel);
  ex.group.add(boosterFlight);
  ex.boosterFlight = boosterFlight;

  /**
   * The booster only leaves ex.model while the sequence is live. Parked, it belongs to the
   * stack — otherwise verifyExhibits() measures a 53 m Starship, because measure() walks the
   * model and the booster is no longer in it.
   */
  let boosterDetached = false;
  function detachBooster(on) {
    if (on === boosterDetached) return;
    boosterDetached = on;
    (on ? boosterModel : boosterHome.parent).add(booster);
    booster.position.copy(boosterHome.position);
    booster.rotation.z = 0;
  }

  // Chopstick home state, so reset() puts the arms back where the launch found them.
  const chop = parts.chopsticks;
  const chopHome = {
    y: chop.position.y,
    arms: chop.children.filter(c => c.name.startsWith('arm-')).map(a => ({ obj: a, ry: a.rotation.y })),
  };
  /**
   * How far the arms close. It was a fixed 6,5°, which with the hinges 2,2 m either side of the
   * tower's centreline put the arms' bumper pads 2,6 m from the booster's axis: 1,9 m inside a
   * 4,5 m hull, so the arms passed straight through the tank. Now it is solved from the pad's
   * own geometry: each arm swings until its inboard pads stand 5 cm off the hull, at the
   * booster's axis, and stays outboard of it — the way the chopsticks close on a booster.
   */
  const CG = chop.userData.catchGeometry ?? { railTop: 2.3, padReach: 1.75, hinge: [8.2, 2.2] };
  const HULL_R = 4.5;
  const armToAxis = -chop.position.x - CG.hinge[0];
  const CATCH_ARM = Math.atan2(HULL_R + 0.05 + CG.padReach - CG.hinge[1], armToAxis);
  const CATCH_ALT = CATCH_BASE;                       // booster held this far above its launch station
  /**
   * Where the carriage has to be for the arms to take the load on the pins.
   *
   * This used to be the literal 98, and it was 6.8 m low: the pins are at station
   * finY - PIN_DROP = 64.77 m on the booster, and at the catch the booster's own origin is at
   * mount + CATCH_ALT = 40 m, which puts them at 104.8 m. The arms were closing on the
   * methane tank, eight metres under the hardware they are supposed to be holding - and the
   * gate could not see it, because all it asked was that the carriage end up above 80 m.
   *
   * Derived from the booster's published station so the two cannot drift apart again: move
   * the grid fins and the tower follows them.
   */
  // …and not with the pins buried halfway down the arm, where they sat: the pins rest ON the
  // rail along the top of each arm, so the carriage stops one rail height below them (pin
  // radius included).
  const CATCH_CARRIAGE = ex.lay.mount + CATCH_ALT + ex.model.userData.stations.booster.pinY - CG.railTop - 0.34;

  // ---- Plumes -------------------------------------------------------------------------
  // Cluster radii: the 33 Raptors sit inside a 3,86 m ring, the ship's six inside a 2,3 m
  // one, so those are the exit-plane radii the merged columns start from.
  // Thirty-three sea-level Raptors do not make a wisp. The exhaust column off the mount is
  // wider than the 9 m booster and runs several booster-lengths behind it before it breaks up;
  // at 6.0 the plume was about a quarter of the booster's length and the whole ascent read as
  // a model rocket.
  // 16 cluster radii (≈74 m) at the pad: in liftoff photographs the bright column is well over
  // a booster length before it breaks up into the cloud.
  // Flame sprites per plume, by quality tier: they are large, overlapping and blended, so their
  // cost is fill rate, which is what a weak GPU has least of.
  const fireScale = quality.name === 'low' ? 0.5 : quality.name === 'medium' ? 0.75 : 1;
  const boosterPlume = new Plume({ radius: 4.6, seaLevelLength: 16, name: 'plume-booster', fireCount: Math.round(180 * fireScale) });
  const shipPlume = new Plume({ radius: 2.6, seaLevelLength: 8.4, name: 'plume-ship', fireCount: Math.round(110 * fireScale) });
  booster.add(boosterPlume.group);
  ship.add(shipPlume.group);

  // Individual engine jets under the column: centre 3, inner 10, outer 20 in lighting order
  // for the booster; the ship's 3 sea-level Raptors, then its 3 vacuum engines.
  const ringPositions = (n, r, y, phase) => Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  });
  const boosterJets = new EngineJets({
    name: 'jets-booster',
    engines: BOOSTER_RINGS.flatMap((ring) => Array.from({ length: ring[0] }, (_, i) => { const a = ringAngle(ring, i); return { position: [Math.sin(a) * ring[1], ring[2], Math.cos(a) * ring[1]], radius: RAPTOR_EXIT_R }; })),
  });
  const shipJets = new EngineJets({
    name: 'jets-ship', seaLevelLength: 10,
    engines: [
      ...ringPositions(3, 0.95, 0.35, 0).map(position => ({ position, radius: RAPTOR_EXIT_R })),
      ...ringPositions(3, 3.05, 0.25, Math.PI / 3).map(position => ({ position, radius: 1.15 })),
    ],
  });
  booster.add(boosterJets.mesh);
  ship.add(shipJets.mesh);
  // Hot-staging: the ship lights its six engines while still sitting on the booster, and the
  // exhaust has nowhere to go but out through the 24 openings of the vented section at the top
  // of the booster (starship.js, hotStageSection), turned down and out by the louvres. A ring
  // of fire round the interstage for the second or two before the stages part, then the gap
  // opens and the ship's plume plays straight onto the booster's dome instead.
  const HS_STATION = (ex.model.userData.stations?.booster?.ringTop ?? 70.47) + 0.9;
  // At 65 km there is almost no air to hold the vent flames in, so each one fans out into a
  // wide tongue many metres long: from the ground the ring reads as a flower of fire round the
  // interstage (flight 7 and 8 tracking footage). They were 0,4 m jets a dozen metres long.
  const hotStageVents = new EngineJets({
    name: 'jets-hot-stage', seaLevelLength: 12, turbulence: 1,
    engines: Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return { position: [Math.sin(a) * 4.45, HS_STATION, Math.cos(a) * 4.45], radius: 0.6, direction: [Math.sin(a), -0.35, Math.cos(a)] };
    }),
  });
  booster.add(hotStageVents.mesh);
  const ventAt = (t) => shipThrottle(t) * (1 - THREE.MathUtils.smoothstep(t, EVENTS.separation + 0.4, EVENTS.separation + 2.6));
  // …and the fireball those vents make together, round the interstage, from the ship's
  // ignition until the gap opens.
  const stageGlow = new Glow({ name: 'glow-hot-stage' });
  stageGlow.mesh.position.set(0, HS_STATION, 0);
  booster.add(stageGlow.mesh);
  const stageGlowAt = (t) => {
    const up = THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation - 0.6);
    const down = 1 - THREE.MathUtils.smoothstep(t, EVENTS.separation + 0.2, EVENTS.separation + 3.2);
    return up * down;
  };

  // ---- Vapour: venting in the count, the deluge at ignition, venting after the catch -------
  // Emitters are placed in the stack's rest frame (engine exits BOOSTER_AFT under the deck, y up),
  // under a group that stays on the pad, so puffs born before liftoff do not ride up with the
  // vehicle. Stations are reconstructed: where a fuelled Starship is seen venting from, not a
  // plumbing diagram. Fewer puffs on the lower tiers.
  const vScale = quality.name === 'low' ? 0.45 : quality.name === 'medium' ? 0.7 : 1;
  const nv = (n) => Math.max(4, Math.round(n * vScale));
  const rest = new THREE.Group();
  rest.name = 'stack-rest-frame';
  rest.position.copy(ex.model.position);
  rest.rotation.copy(ex.model.rotation);
  ex.group.add(rest);
  const around = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
  const out = (a, up = 0) => [Math.sin(a), up, Math.cos(a)];
  const COUNT_WIN = [EVENTS.start, EVENTS.liftoff + 0.5];
  const countdownVent = new Vapor({
    name: 'vapor-countdown', rng: seeded(21), accel: [0.7, -0.45, 0.3], tau: 1.5, opacity: 0.78,
    emitters: [
      ...[0.6, 2.7, 4.8].map(a => ({ at: around(4.6, 48, a), dir: out(a, -0.2), speed: 2.2, spread: 0.35, count: nv(36), life: 9.1, size: 3.84, grow: 2.2, window: COUNT_WIN })),
      ...[1.4, 4.2].map(a => ({ at: around(4.6, 69, a), dir: out(a, 0.1), speed: 2.8, spread: 0.3, count: nv(30), life: 7.8, size: 3.36, grow: 2, window: COUNT_WIN })),
      ...[2.2, 5.3].map(a => ({ at: around(4.6, 76, a), dir: out(a, -0.1), speed: 2.4, spread: 0.3, count: nv(27), life: 7.8, size: 3.12, grow: 2, window: COUNT_WIN })),
      { at: around(3.0, 116, 3.1), dir: out(3.1, 0.3), speed: 2, spread: 0.3, count: nv(21), life: 6.5, size: 2.4, grow: 1.8, window: COUNT_WIN },
      ...[0.9, 3.9].map(a => ({ at: around(4.4, BOOSTER_AFT + 1.2, a), dir: out(a, -0.3), speed: 3, spread: 0.4, count: nv(30), life: 6.5, size: 4.32, grow: 2.8, window: COUNT_WIN })),
    ],
  });
  // The loaded stack's cold vapour, in bulk. SpaceX's photograph of the V3 wet dress rehearsal
  // on Pad 2 (11 May 2026) shows it pouring down the booster's sides in sheets from the top of
  // the LOX tank and piling up round the mount — far more than the few vent puffs above. Cold,
  // so it falls: a slow start and a strong downward pull keep it running down the hull; the
  // pile at the base spreads low. Positions and rates are reconstructed.
  const cascade = new Vapor({
    name: 'vapor-cascade', rng: seeded(26), accel: [0.25, -1.5, 0.15], tau: 1.8, opacity: 0.66,
    emitters: [0.3, 1.9, 3.4, 5.0].map(a => ({ at: around(4.75, 64, a), dir: out(a, -0.9), speed: 1.1, spread: 0.22, count: nv(40), life: 13, size: 3.4, grow: 2.4, jitter: 1.4, window: COUNT_WIN })),
  });
  const basePile = new Vapor({
    // Low and thinning, not a wall: at 0.6 and 3.2 m/s of growth it swallowed the whole mount
    // in the countdown's close shot, the deflector water and the QD arm with it.
    name: 'vapor-base', rng: seeded(27), accel: [0.3, -0.25, 0.2], tau: 2.2, opacity: 0.45,
    emitters: Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      return { at: around(7.5, BOOSTER_AFT + 0.8, a), dir: out(a, -0.05), speed: 2.2, spread: 0.3, count: nv(30), life: 12, size: 5.5, grow: 2.2, jitter: 1.5, window: COUNT_WIN };
    }),
  });
  // Deluge: water driven up through the mount's plate round the engines, from a couple of
  // seconds before ignition until the stack is clear. Spray, flashing to steam as it rises.
  const deluge = new Vapor({
    name: 'vapor-deluge', rng: seeded(22), accel: [0.4, -2.2, 0.2], tau: 0.9, opacity: 0.62,
    emitters: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      return { at: around(6.6, BOOSTER_AFT - 0.6, a), dir: out(a, 3.2), speed: 24, spread: 0.22, count: nv(33), life: 4.16, size: 5.28, grow: 8.4, jitter: 1.2, window: [EVENTS.deflector, EVENTS.liftoff + 10] };
    }),
  });
  // Landing: the last seconds of the burn blast the mount deck, and the exhaust and deck water
  // spread out across it as a low sheet of steam. It starts when the column can reach the
  // deck (the base within 55 m of it), not at a fixed time: tied to the switch to the centre
  // three it billowed up round the pad while the booster was still 280 m up.
  const SPRAY_FROM = (() => { let t = EVENTS.landingBurn; while (t < EVENTS.catch - 1 && boosterAltAt(t) > 55) t += 0.1; return t; })();
  const landingSpray = new Vapor({
    name: 'vapor-landing', rng: seeded(24), accel: [0.5, 0.8, 0.2], tau: 1.4, opacity: 0.38,
    emitters: Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      return { at: around(5.5, BOOSTER_AFT + 0.5, a), dir: out(a, 0.08), speed: 22, spread: 0.25, count: nv(10), life: 4.5, size: 7, grow: 9, jitter: 1.5, window: [SPRAY_FROM, EVENTS.catch - 0.5] };
    }),
  });
  rest.add(countdownVent.mesh, cascade.mesh, basePile.mesh, deluge.mesh, landingSpray.mesh);
  // After the catch the booster sits on the arms venting: off the top, round the upper tank,
  // and from the engine section. Attached to the booster, which no longer moves.
  const CATCH_WIN = [EVENTS.catch + 1.5, EVENTS.end + 60];
  const BOOSTER_TOP = ex.model.userData.stations?.booster?.height ?? 71.93;
  const catchVent = new Vapor({
    // Thin and spreading rather than dense: at 0,62 with slow growth each puff stayed a white
    // ball on the booster's flank, cotton wool rather than venting gas.
    name: 'vapor-caught', rng: seeded(23), accel: [0.9, -0.25, 0.35], tau: 1.6, opacity: 0.44,
    emitters: [
      { at: [0, BOOSTER_TOP - 0.8, 0], dir: [0.1, 1, 0], speed: 3.5, spread: 0.4, count: nv(39), life: 9.1, size: 4.32, grow: 3.6, jitter: 2, window: CATCH_WIN },
      ...[1.0, 3.6].map(a => ({ at: around(4.6, 58, a), dir: out(a, 0), speed: 2.4, spread: 0.35, count: nv(27), life: 7.8, size: 3.36, grow: 3.2, window: CATCH_WIN })),
      ...[0.3, 3.3].map(a => ({ at: around(4.3, BOOSTER_AFT + 1.2, a), dir: out(a, -0.3), speed: 2.6, spread: 0.4, count: nv(24), life: 6.5, size: 3.84, grow: 3.6, window: CATCH_WIN })),
    ],
  });
  booster.add(catchVent.mesh);
  // The flip. Once the ship is away the booster turns end over end on its engines and its
  // cold-gas thrusters, venting ullage gas from the top of the tank: in the thin air at 70 km
  // each puff flashes out wide and vanishes within a second or two.
  const flipVent = new Vapor({
    name: 'vapor-flip', rng: seeded(25), accel: [0, 0, 0], tau: 0.6, opacity: 0.18,
    emitters: [0.4, 2.5, 4.6].map(a => ({ at: around(4.4, BOOSTER_TOP - 2.5, a), dir: out(a, 0.3), speed: 30, spread: 0.6, count: nv(14), life: 1.4, size: 4, grow: 26, jitter: 0.8, window: [EVENTS.separation + 1.5, EVENTS.boostbackStart + 2] })),
  });
  booster.add(flipVent.mesh);
  // The landing burn trails dark smoke: on the flight 5 catch photograph a grey-brown stream
  // pours off the engine section and hangs in the air above the booster as it comes down.
  // Each puff leaves from where the engine bay was when it was emitted and then stays in the
  // air, so the booster falls out of the bottom of its own trail. The source path is sampled
  // through the same transforms as the booster, 5 m up from its base.
  const SMOKE_T = [EVENTS.landingBurn, EVENTS.catch + 4], SMOKE_N = 256;
  const smokePath = (() => {
    const pts = new Float32Array(SMOKE_N * 3), m = new THREE.Matrix4(), mm = new THREE.Matrix4(), v = new THREE.Vector3();
    mm.compose(ex.model.position, new THREE.Quaternion().setFromEuler(ex.model.rotation), new THREE.Vector3(1, 1, 1));
    for (let i = 0; i < SMOKE_N; i++) {
      const ts = SMOKE_T[0] + (SMOKE_T[1] - SMOKE_T[0]) * i / (SMOKE_N - 1);
      m.makeRotationZ(-boosterPitchAt(ts)).setPosition(boosterDownAt(ts), boosterAltAt(ts), 0).multiply(mm);
      v.copy(boosterHome.position).add(new THREE.Vector3(0, BOOSTER_AFT + 5, 0)).applyMatrix4(m);
      pts.set([v.x, v.y, v.z], i * 3);
    }
    return { t0: SMOKE_T[0], t1: SMOKE_T[1], points: pts };
  })();
  const landingSmoke = new Vapor({
    name: 'vapor-landing-smoke', rng: seeded(28), accel: [0.7, 0.5, 0.3], tau: 1.2, opacity: 0.2, path: smokePath,
    colors: [0x8f8a84, 0x55514c], fadeIn: 0.015,
    // Dense and large enough to stay one stream at the burn's 280 m/s start: at 80 puffs a
    // source and a 1.2 s fade-in it read as a dotted line. Half the sources stop as the
    // booster slows over the pad, and the rest a few seconds before the catch: at a steady
    // rate the smoke piles up where the booster lingers and stood a flat grey wall beside it.
    // Beads at 150 a source: at 280 m/s a puff every 0.08 s is 22 m of trail for a 12 m puff.
    // Fewer, larger puffs close the gaps without the fill cost of more of them.
    emitters: [0.5, 2.1, 3.7, 5.3].map((a, i) => ({ at: around(3, 0, a), dir: out(a, 0.4), speed: 7, spread: 0.5, count: nv(170), life: 12, size: 21, grow: 4.5, jitter: 3, window: [EVENTS.landingBurn + 0.5, i % 2 ? BURN_THREE + 5 : EVENTS.catch - 5] })),
  });
  ex.group.add(landingSmoke.mesh);

  // The ascent trail. Methalox burns to water and carbon dioxide, and every launch video shows
  // what that water does in the cold air behind the vehicle: a white trail, thin and bright
  // near the ground, then broader and drifting, that stays in the sky long after the rocket
  // has gone. The stack left none, so the sky behind it was empty. It starts behind the
  // bright part of the plume and stops by ~20 km, where the air is too thin to hold it
  // (≈ both; puff sizes and the fade are reconstructed from footage, not measured).
  const TRAIL_T = [EVENTS.liftoff + 6, 100], TRAIL_N = 240;
  const trailPath = (() => {
    const pts = new Float32Array(TRAIL_N * 3), m = new THREE.Matrix4(), mm = new THREE.Matrix4(), v = new THREE.Vector3();
    mm.compose(ex.model.position, new THREE.Quaternion().setFromEuler(ex.model.rotation), new THREE.Vector3(1, 1, 1));
    for (let i = 0; i < TRAIL_N; i++) {
      const ts = TRAIL_T[0] + (TRAIL_T[1] - TRAIL_T[0]) * i / (TRAIL_N - 1);
      const back = 40 + altitudeAt(ts) * 0.004;        // behind the bright column, which lengthens with height
      m.makeRotationZ(-pitchAt(ts)).setPosition(downrangeAt(ts), altitudeAt(ts), 0).multiply(mm);
      v.set(0, -back, 0).applyMatrix4(m);
      pts.set([v.x, v.y, v.z], i * 3);
    }
    return { t0: TRAIL_T[0], t1: TRAIL_T[1], points: pts };
  })();
  const ascentTrail = new Vapor({
    name: 'vapor-ascent-trail', rng: seeded(31), accel: [0.35, 0.04, 0.2], tau: 2.5, opacity: 0.2, path: trailPath,
    colors: [0xf4f5f6, 0x9aa1ab], fadeIn: 0.02,
    // Dense enough to read as one line from kilometres off, not a string of beads.
    emitters: [0, 2.1, 4.2].map((a) => ({ at: around(2, 0, a), dir: out(a, 0), speed: 3, spread: 0.6, count: nv(420), life: 34, size: 30, grow: 5, jitter: 8, window: TRAIL_T })),
  });
  ex.group.add(ascentTrail.mesh);
  const vapors = [countdownVent, cascade, basePile, deluge, landingSpray, catchVent, flipVent, landingSmoke, ascentTrail];
  for (const vp of vapors) vp.material.uniforms.uPad.value.set(ex.lay.x, ex.lay.z);

  // Max-Q: a condensation collar off the hot-stage ring, trailing down the booster, through
  // the transonic climb and peak dynamic pressure. Timing follows the ascent's own Max-Q.
  const collar = new CondensationCollar({ radius: 4.5, spread: 7.5, length: 30, y: (ex.model.userData.stations?.booster?.height ?? 71.93) - 0.8 });
  booster.add(collar.mesh);
  const collarShip = new CondensationCollar({ radius: 4.5, spread: 5, length: 16, y: 12, name: 'condensation-collar-ship' });
  ship.add(collarShip.mesh);
  // Tagged as effects: they hang off the vehicle's own groups, and a volume of vapour or a
  // plume's bounding box is not part of the vehicle. The dimensional check measured the stack
  // 1 m tall for as long as they were there — puffs of vapour parked half a metre under the
  // engines and plume boxes a metre under them — and passed only because the tolerance was 2 %.
  for (const o of [boosterPlume.group, shipPlume.group, boosterJets.mesh, shipJets.mesh, hotStageVents.mesh,
    stageGlow.mesh, rest, catchVent.mesh, flipVent.mesh, landingSmoke.mesh, ascentTrail.mesh, collar.mesh, collarShip.mesh]) o.userData.fx = true;
  const collarAt = (t) => {
    const k = THREE.MathUtils.smoothstep(t, EVENTS.maxQ - 22, EVENTS.maxQ - 12) * (1 - THREE.MathUtils.smoothstep(t, EVENTS.maxQ + 6, EVENTS.maxQ + 14));
    // Flickers as it forms and sheds, the way it does on film.
    return k * (0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2));
  };

  const cloud = new GroundCloud({ rng: seeded(11), count: quality.cloudParticles ?? 860 });
  cloud.points.position.set(ex.lay.x, 0, ex.lay.z);
  cloud.setPad(ex.lay.x, ex.lay.z);
  scene.add(cloud.points);
  // Emission is budgeted to the ring. At ~190 puffs a second living ~20 s, the high tier's 1600
  // slots were overwritten at ~8 s, halfway through each puff's life: the cloud popped away in
  // pieces and never built into a mass. Rates are now a share of the ring (≈ 0,95 of it alive
  // at the peak), and a smaller ring gets fewer, larger puffs covering the same volume.
  const CLOUD_RATE = cloud.count / 1600;
  const CLOUD_SIZE = Math.sqrt(1 / CLOUD_RATE);

  // Fire out of the trench. The 33 jets go down into the flame trench and leave through its two
  // mouths, 44 m either side of the mount, as flame for the first seconds and then as the
  // cloud. It was only a glow painted on the cloud; photographs of the flight 5 liftoff show
  // flame itself rolling out of the trench ends. Three turbulent jets per mouth, no shock
  // diamonds (the flow has hit the deflector), fading as the vehicle climbs.
  // Fire, not jets: it leaves each mouth as a rolling mass of flame that slows, spreads, lifts
  // and burns out into the smoke and steam of the cloud, so the cloud is seen to come out of
  // the trench instead of starting in mid-air beside a flat orange streak.
  const trenchFire = new Fire({
    name: 'fire-trench', rng: seeded(41), gain: 1.7, smoke: 0.5, smokeColor: 0x8a8076, occlude: 0.22,
    emitters: [1, -1].flatMap(sz => [-6, 0, 6].map(x => ({ at: [x, 2.8, sz * 38], dir: [x * 0.015, 0.1, sz], count: Math.round(46 * fireScale) }))),
  });
  trenchFire.mesh.position.set(ex.lay.x, 0, ex.lay.z);
  scene.add(trenchFire.mesh);
  // Fire over the mount's deck. Standing on the mount, the 33 engines fire down through its
  // 11 m opening into the trench; as the vehicle climbs, the column widens past the opening
  // and its outer part hits the deck and is thrown out sideways over it — a wall jet, as any
  // jet does against a plate — rolling off the edges of the mount. It lasts from a few metres
  // up until the column is too thin at deck level to matter (≈ both heights, from the jet's
  // widening; not measured).
  const deckFire = new Fire({
    name: 'fire-deck', rng: seeded(43), gain: 1.6, smoke: 0.35, smokeColor: 0x8d8379, occlude: 0.2,
    emitters: Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      return { at: [Math.sin(a) * (PAD.openingR + 0.8), PAD.deckTop + 0.6, Math.cos(a) * (PAD.openingR + 0.8)], dir: [Math.sin(a), 0.12, Math.cos(a)], count: Math.round(12 * fireScale) };
    }),
  });
  deckFire.mesh.position.set(ex.lay.x, 0, ex.lay.z);
  scene.add(deckFire.mesh);
  const deckFireAt = (t) => {
    const h = altitudeAt(t);
    return boosterThrottle(t) * THREE.MathUtils.smoothstep(h, 1, 8) * (1 - THREE.MathUtils.smoothstep(h, 30, 90));
  };
  // The light under the vehicle at liftoff: 33 Raptors a few metres over the mount are the
  // brightest thing for kilometres, and the camera sees a blinding glare through and round the
  // mount, not only the part of the column that clears it. A glow, blooming, at the engines.
  const baseGlare = new Glow({ name: 'glow-liftoff', color: 0xfff4dc, edge: 0xffa040 });
  baseGlare.mesh.position.set(0, -5, 0);
  booster.add(baseGlare.mesh);
  baseGlare.mesh.userData.fx = true;
  const trenchFireAt = (t) => boosterThrottle(t) * (1 - THREE.MathUtils.smoothstep(altitudeAt(t), 15, 160));

  // Above ~10 km the flat 1:1 site runs out long before the horizon: a curved Earth with a
  // limb takes over from there, following the camera over the ground.
  const flightEarth = new FlightEarth();
  scene.add(flightEarth.group);

  // The viewer's near plane follows the orbit distance (main.js), so the value to put back is
  // whatever it was when the sequence took the camera, not what it was at construction. On the
  // pad the sequence uses a fixed near plane of its own: its cameras work metres from the hull.
  const PAD_NEAR = 0.15;
  function saveCameraPlanes() { home.near = camera.near; home.far = camera.far; }

  // ---- Saved state, so reset() puts everything back exactly ----------------------------
  // Frost on the loaded tanks: shown for the sequence (the exhibit on its stand is dry), full
  // on the pad, shedding through the ascent as the vehicle shakes and the propellant drains.
  const frostShells = ['booster-frost', 'ship-frost'].map(n => ex.model.getObjectByName(n)).filter(Boolean);
  // Each shell gets its own copy of the frost material, so the booster's can go while the
  // ship's stays: the returning booster has drained its tanks, and SpaceX's photograph of the
  // Flight 5 landing burn shows no frost on it. Kept at 40 % it painted the returning booster
  // white from MECO to the catch.
  const frostMats = frostShells.map((f) => {
    const m = f.children[0]?.material?.clone();
    if (m) f.traverse((o) => { if (o.isMesh) o.material = m; });
    return m;
  });
  function applyFrost(t, on) {
    const k = !on ? 0 : t < EVENTS.liftoff + 15 ? 1
      : THREE.MathUtils.lerp(1, 0.4, THREE.MathUtils.smoothstep(t, EVENTS.liftoff + 15, EVENTS.meco));
    frostShells.forEach((f, i) => {
      const kf = f.name === 'booster-frost' ? k * (1 - THREE.MathUtils.smoothstep(t, EVENTS.separation, EVENTS.boostbackEnd)) : k;
      f.visible = kf > 0.01;
      if (frostMats[i]) frostMats[i].opacity = 0.9 * kf;
    });
  }

  // Soot on the returning booster (library.js, sootable): none on the pad or in the ascent;
  // the boostback relight, with its plume recirculating round the engine bay, puts the first
  // of it on, and reentry heating the rest before the landing burn. Clean again on reset.
  const soot = booster?.userData.soot;
  function applySoot(t, on) {
    if (!soot) return;
    soot.value = !on ? 0
      : 0.4 * THREE.MathUtils.smoothstep(t, EVENTS.boostbackStart, EVENTS.boostbackEnd)
      + 0.6 * THREE.MathUtils.smoothstep(t, EVENTS.boostbackEnd + 60, EVENTS.landingBurn - 20);
  }

  const home = {
    near: camera.near, far: camera.far,
    shadows: env.sun.castShadow,
    clamps: parts.holddowns.children.map(c => c.position.clone()),
    boosterQds: (parts.boosterQds ?? []).map(q => q.position.clone()),
  };

  const state = {
    running: false, armed: false, paused: false, t: EVENTS.start, speed: 1,
    // Who the camera is on when the visitor holds it: 'booster' or 'ship' (their orbit rides
    // along with that vehicle), or 'director' for the broadcast shot list.
    follow: 'director',
    phase: 'On the pad', altitude: 0, velocity: 0, throttle: 0, downrange: 0,
    ship: { altitude: 0, velocity: 0, lit: 0 }, booster: { altitude: 0, velocity: 0, lit: 0 }, next: null,
  };
  let visibilityHook = null;   // set by main.js: hides labels, rulers and figures while flying

  // ---- Camera ---------------------------------------------------------------------------
  const S = new THREE.Vector3(ex.lay.x, 0, ex.lay.z);        // site origin, on grade
  const PAD_CATCH_Y = ex.lay.mount + CATCH_ALT + 34;         // roughly the middle of the caught booster
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _pad = new THREE.Vector3();
  const _p2 = new THREE.Vector3(), _q2 = new THREE.Vector3();

  /**
   * Where the middle of the stack actually is, which is not simply "up": once the gravity
   * turn starts the vehicle rotates about its own base, so the mid-body swings downrange.
   */
  // The booster's mid-body, in world space, for the return shots.
  function boosterAt(t, out) {
    const p = boosterPitchAt(t), r = 36;
    return out.set(
      S.x + boosterDownAt(t) + Math.sin(p) * r,
      ex.lay.mount + boosterAltAt(t) + Math.cos(p) * r,
      S.z,
    );
  }

  function vehicleAt(t, out) {
    const p = pitchAt(t), r = 58;
    return out.set(
      S.x + downrangeAt(t) + Math.sin(p) * r,
      altitudeAt(t) + ex.lay.mount + Math.cos(p) * r,
      S.z,
    );
  }

  // The ship turns about its own middle, not about the booster's engines. The flight group's
  // origin is the stack's base (the engines' exit plane), which is right until separation;
  // after it the group carries the ship alone, and once the ship steers on its own (it pitches
  // up ~20° in the first seconds) rotating that group swung a 52 m ship round a point 72 m
  // below it — sideways by tens of metres, and through the booster. After separation the
  // integrated trajectory moves the ship's middle, and the group is placed so the ship
  // rotates about it.
  const SHIP_PIVOT = shipHome + 26;
  const ATT_SEP = pitchAt(EVENTS.separation);
  function shipMidAt(t, out) {
    const a = t <= EVENTS.separation ? pitchAt(t) : ATT_SEP;
    return out.set(S.x + downrangeAt(t) + Math.sin(a) * SHIP_PIVOT, ex.lay.mount + altitudeAt(t) + Math.cos(a) * SHIP_PIVOT, S.z);
  }
  /** What a visitor's orbit rides on during the sequence. */
  function focusAt(t, out) {
    if (t < EVENTS.separation) return vehicleAt(t, out);
    if (state.follow === 'ship') return shipMidAt(t, out);
    return boosterAt(t, out);
  }
  let followPrev = null;
  const _gapA = new THREE.Vector3(), _gapB = new THREE.Vector3(), _gapC = new THREE.Vector3();
  const _fo = new THREE.Vector3();
  /**
   * The visitor holds the camera but it rides with the rocket: the orbit's centre moves with
   * the vehicle, and the camera by the same amount, so a drag or a pause and resume still
   * leaves it on the rocket. Before this, taking the camera froze it where the shot list had
   * put it, and the rocket climbed out of frame within seconds, pause or no pause.
   */
  function followCamera(t) {
    // 'none' is the behaviour before the ride existed, kept only as the gate's negative control.
    if (state.follow === 'none') { followPrev = null; return; }
    focusAt(t, _fo);
    if (!followPrev) {
      rig.target.copy(_fo);
      followPrev = _fo.clone();
      return;
    }
    const dx = _fo.x - followPrev.x, dy = _fo.y - followPrev.y, dz = _fo.z - followPrev.z;
    camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
    rig.target.x += dx; rig.target.y += dy; rig.target.z += dz;
    followPrev.copy(_fo);
  }

  /** Shot list. Each writes a world position and look-at target for the mission time. */
  // The terminal count and the liftoff are cut the way a launch broadcast cuts them: a few
  // held shots with hard cuts between, each moving slowly, rather than one camera flying
  // between positions. A fast dolly between two pad positions (it used to cross 130 m in
  // 1,6 s at T+6) reads as a glitch, not as a cut.
  const ease = (t, a, b) => THREE.MathUtils.smoothstep(t, a, b);
  const SHOTS = [
    { until: -24, blend: 0, shot: (t, pos, tgt) => {
      // Establishing: the whole site from 800 m out, low over the flats, drifting in.
      const u = ease(t, EVENTS.start, -24);
      pos.set(S.x + THREE.MathUtils.lerp(780, 690, u), 10, S.z + THREE.MathUtils.lerp(330, 270, u));
      tgt.set(S.x, THREE.MathUtils.lerp(64, 70, u), S.z);
    } },
    { until: -12, blend: 0, shot: (t, pos, tgt) => {
      // The fuelled stack from the tower's height: frost on the tanks and boil-off venting
      // from the booster and the ship, sinking down the hull. Square to the tower-stack line
      // (down the trench axis, harmless before ignition) so the tower stands beside the
      // vehicle rather than behind it — and on the ship's lee side, where the frost is, with
      // the tower to the right: the angle of SpaceX's wet-dress-rehearsal photograph.
      const u = ease(t, -24, -12);
      pos.set(S.x + THREE.MathUtils.lerp(28, 14, u), THREE.MathUtils.lerp(100, 90, u), S.z - THREE.MathUtils.lerp(152, 136, u));
      tgt.set(S.x, ex.lay.mount + THREE.MathUtils.lerp(74, 62, u), S.z);
    } },
    { until: EVENTS.ignition + 1.2, blend: 0, shot: (t, pos, tgt) => {
      // The mount: the deflector's water coming up at T−10, the quick disconnect swinging
      // clear, and the first engines lighting under the skirt.
      const u = ease(t, -12, EVENTS.ignition + 1.2);
      pos.set(S.x + THREE.MathUtils.lerp(64, 58, u), THREE.MathUtils.lerp(15, 13, u), S.z + THREE.MathUtils.lerp(40, 50, u));
      tgt.set(S.x, ex.lay.mount + THREE.MathUtils.lerp(10, 12, u), S.z);
    } },
    { until: 14, blend: 0, shot: (t, pos, tgt) => {
      // Liftoff from the ground, 350 m off to the east-south-east: the tower and the whole
      // stack in frame, the steam going out of both trench mouths across the picture, and the
      // camera tilting to keep the vehicle as it climbs past the tower top.
      pos.set(S.x + 318, 4, S.z + 152);
      const alt = altitudeAt(t);
      tgt.set(S.x + downrangeAt(t) * 0.8, ex.lay.mount + 60 + alt * 0.86, S.z);
    } },
    { until: 48, blend: 3.0, shot: (t, pos, tgt) => {
      // Picks the vehicle up and holds it against the pad, which is now well below.
      vehicleAt(t, tgt);
      const d = 300;
      pos.set(tgt.x - d * 0.34, tgt.y - d * 0.34, tgt.z + d * 0.88);
    } },
    { until: EVENTS.meco - 8, blend: 2.5, shot: (t, pos, tgt) => {
      // Chase. The stand-off grows slowly so the vehicle keeps its size in frame while the
      // sky behind it drains to black.
      vehicleAt(t, tgt);
      const d = 270 + altitudeAt(t) * 0.0034;
      const a = 0.7 + t * 0.0042;
      pos.set(tgt.x + Math.cos(a) * d * 0.66, tgt.y - d * 0.30, tgt.z + Math.sin(a) * d * 0.82);
    } },
    { until: EVENTS.boostbackStart + 2, blend: 3.0, shot: (t, pos, tgt) => {
      // Separation: side on, and pulling back so both stages stay in frame as they part.
      // The aim point slides from the stack onto the booster before the boostback: once it
      // relights the two part at ~150 m/s² and no stand-off holds both, and a shot still
      // centred on the ship left the booster out of frame from T+2:45 to T+2:49, and for
      // half a second of the hand-over neither vehicle was in the picture.
      vehicleAt(t, tgt);
      boosterAt(t, _pad);
      const gap = tgt.distanceTo(_pad);
      tgt.lerp(_pad, ease(t, EVENTS.separation + 1, EVENTS.boostbackStart));
      const d = 340 + Math.min(gap, 400) * 0.6;
      pos.set(tgt.x + d * 0.26, tgt.y - d * 0.20, tgt.z + d * 0.94);
    } },
    { until: EVENTS.landingBurn - 26, blend: 4.0, shot: (t, pos, tgt) => {
      // The booster is the story from here. Held against the curve of its own trajectory,
      // far enough out that the flip and the boostback burn read.
      boosterAt(t, tgt);
      const d = 420;
      pos.set(tgt.x - d * 0.42, tgt.y + d * 0.16, tgt.z + d * 0.90);
    } },
    { until: EVENTS.catch - 6, blend: 4.0, shot: (t, pos, tgt) => {
      // Coming home: from beside the tower, looking up the line the booster is falling down,
      // so the pad enters frame underneath it as it arrives.
      // It used to hold a fixed spot near the pad and rise only halfway to the booster, which
      // at the landing burn left it 5 km away: a one-pixel dot on blue sky. Now it rides down
      // with the booster, ~400 m off and 140 m beneath it, and settles onto the tower-side
      // position as the booster nears the ground, so the pad enters frame as it arrives.
      boosterAt(t, tgt);
      const low = 1 - THREE.MathUtils.smoothstep(tgt.y, 250, 1800);   // 0 high up, 1 near the pad
      pos.set(
        THREE.MathUtils.lerp(tgt.x + 160, S.x + 150, low),
        Math.max(128, THREE.MathUtils.lerp(tgt.y - 140, 128, low)),
        S.z + THREE.MathUtils.lerp(400, 190, low),
      );
    } },
    { until: Infinity, blend: 3.0, shot: (t, pos, tgt) => {
      // The catch itself, from the height of the arms: the booster comes down into frame and
      // stops, and the tower is beside it for scale.
      const k = THREE.MathUtils.clamp((t - (EVENTS.catch - 6)) / 14, 0, 1);
      boosterAt(t, tgt);
      tgt.lerp(_pad.set(S.x, PAD_CATCH_Y, S.z), k * 0.65);
      pos.set(S.x + 118, THREE.MathUtils.lerp(122, 104, k), S.z + THREE.MathUtils.lerp(150, 104, k));
    } },
  ];

  function driveCamera(t) {
    let i = 0;
    while (i < SHOTS.length - 1 && t >= SHOTS[i].until) i++;
    SHOTS[i].shot(t, _p, _q);
    const s = SHOTS[i];
    if (i > 0 && s.blend > 0) {
      const started = SHOTS[i - 1].until;
      const k = THREE.MathUtils.clamp((t - started) / s.blend, 0, 1);
      if (k < 1) {
        SHOTS[i - 1].shot(t, _p2, _q2);
        const e = k * k * (3 - 2 * k);
        _p.lerpVectors(_p2, _p, e);
        _q.lerpVectors(_q2, _q, e);
      }
    }
    shake(t, _p, _q);
    camera.position.copy(_p);
    rig.target.copy(_q);
    camera.lookAt(_q);
  }

  /**
   * Ground shake near the pad, as the camera would feel it: it arrives with the sound, at
   * 343 m/s from the engines, so a camera 350 m out starts shaking 1 s after the light does,
   * and it falls off with distance and with the booster's height. Deterministic in mission
   * time, so a seek reproduces it. Off when the visitor asks the system for reduced motion.
   */
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shake(t, pos, tgt) {
    if (reduceMotion || t < EVENTS.ignition || t > EVENTS.liftoff + 40) return;
    const src = _pad.set(S.x + downrangeAt(t), ex.lay.mount + altitudeAt(t), S.z);
    const d = pos.distanceTo(src);
    const heard = t - d / 343;
    const k = boosterThrottle(heard) * Math.min(1, 380 / Math.max(d, 1)) * (1 - THREE.MathUtils.smoothstep(altitudeAt(heard), 400, 2500));
    if (k < 0.01) return;
    // Angular jitter in radians, a few hundredths of a degree at full strength: a tripod on
    // shaking ground, not a handheld.
    const amp = 0.0016 * k * pos.distanceTo(tgt);
    const n = (a, b, c) => Math.sin(t * a + c) * 0.55 + Math.sin(t * b + c * 1.7) * 0.45;
    tgt.x += amp * n(37.1, 61.7, 0.3);
    tgt.y += amp * n(43.3, 71.9, 1.1);
    tgt.z += amp * n(29.9, 53.3, 2.3);
  }

  // ---- Pad hardware ---------------------------------------------------------------------
  function driveHardware(t) {
    // Ship quick disconnect swings clear before ignition.
    const qd = THREE.MathUtils.clamp((t - (EVENTS.ignition - 5)) / 4, 0, 1);
    parts.qdArm.rotation.y = -THREE.MathUtils.degToRad(112) * (qd * qd * (3 - 2 * qd));
    // Reconstructed release timing/stroke: both fluid heads withdraw before liftoff.
    // Fixed housings and supply lines remain on the mount.
    const boosterRelease = THREE.MathUtils.smoothstep(t, 0.6, 1.6);
    (parts.boosterQds ?? []).forEach((q, i) => {
      q.position.copy(home.boosterQds[i]); q.position.x += 1.2 * boosterRelease;
    });
    // Hold-downs release at liftoff and retract radially out of the way.
    const rel = THREE.MathUtils.clamp((t - EVENTS.liftoff) / 0.7, 0, 1);
    parts.holddowns.children.forEach((c, i) => {
      const h = home.clamps[i];
      const k = rel * 1.05;
      c.position.set(h.x * (1 + k * 0.22), h.y, h.z * (1 + k * 0.22));
    });
  }

  /**
   * Steam, water deluge and dust leaving strictly through the two trench mouths (<- ->).
   * Deluge activates prior to ignition, then vaporizes violently upon engine start.
   * Confinement: The pad has concrete walls on X; exhaust is forced solely along Z (North & South).
   */
  const CLOUD_UNTIL = EVENTS.liftoff + 34;
  const CLOUD_STEP = 1 / 30;
  let cloudTick = 0;
  function resetCloud() {
    cloud.reset(seeded(11));
    cloudTick = 0;
  }
  // Integer ticks give playback and seeking the same random samples, emission counts and
  // integration intervals, independent of render rate or mission speed. Never cap cloud
  // time separately from mission time: doing so leaves smoke hanging around at ×10.
  function advanceCloud(t) {
    const target = Math.max(0, Math.floor((t - EVENTS.start) / CLOUD_STEP + 1e-7));
    while (cloudTick < target) {
      const u = EVENTS.start + cloudTick * CLOUD_STEP;
      // Once all launch puffs have died, the coast contains no cloud work to replay.
      if (!cloud.live && u >= CLOUD_UNTIL && u < EVENTS.catch - 16) {
        cloudTick = Math.min(target, Math.round((EVENTS.catch - 16 - EVENTS.start) / CLOUD_STEP));
        continue;
      }
      emitCloud(u, CLOUD_STEP);
      cloud.update(CLOUD_STEP, camera, env.sun);
      cloudTick++;
    }
  }
  function emitCloud(t, dt) {
    // The landing burn kicks up its own cloud off the pad as the booster settles into the
    // arms. Same trench mouths, much less of it: three engines, not thirty-three.
    if (t >= EVENTS.catch - 16 && t <= EVENTS.catch + 8) {
      // The landing burn's exhaust only reaches the deck in the last few tens of metres: the
      // centre three throw a ~50 m column, and on the flight 5 catch photograph it still ends
      // in clear air with the booster level with the arms. From 700 m the trench used to pour
      // steam with the booster a speck overhead, and until this round it still billowed up
      // either side of the pad with the booster 180 m up.
      const near = 1 - THREE.MathUtils.smoothstep(boosterAltAt(t), 30, 90);
      // …and only while they burn: it kept pouring for 8 s after shutdown in the arms.
      const burning = Math.min(1, boosterEngineThrottle(t) / 0.1);
      const n2 = near * burning * 10 * CLOUD_RATE * dt;
      if (n2 >= 0.05) {
        const m2 = Math.max(1, Math.round(n2 * 0.35));
        // Three engines, briefly, into a deck already wet: steam, not a thunderhead. Fewer,
        // larger puffs that grow into one another, so it reads as a sheet of vapour and not
        // as a pile of separate cotton balls hanging in the air.
        const k = { size0: 14 * CLOUD_SIZE, grow: 34 * CLOUD_SIZE };
        cloud.emit(m2, [0, 2.4, 44], [0, 0.05, 1.0], 46, 16, k);
        cloud.emit(m2, [0, 2.4, -44], [0, 0.05, -1.0], 46, 16, k);
      }
      return;
    }
    if (t < EVENTS.deflector || t >= CLOUD_UNTIL) return;

    // 1. Flame deflector activation (cited T−10) to ignition: water floods the steel plate and
    // a cold white mist rolls out of both mouths (<- ->), thickening as the flow comes up.
    if (t < EVENTS.ignition) {
      const deluge = 0.35 + 0.65 * THREE.MathUtils.smoothstep(t, EVENTS.deflector, EVENTS.ignition);
      const nWater = deluge * THREE.MathUtils.smoothstep(t, EVENTS.deflector, EVENTS.deflector + 1.5) * 14 * CLOUD_RATE * dt;
      if (nWater < 0.05) return;
      const m = Math.max(1, Math.round(nWater * 0.5));
      const k = { size0: 12 * CLOUD_SIZE, grow: 52 * CLOUD_SIZE };
      // North mouth (+Z)
      cloud.emit(m, [0, 2.2, 44], [0, 0.05, 1.0], 40, 18, k);
      // South mouth (-Z)
      cloud.emit(m, [0, 2.2, -44], [0, 0.05, -1.0], 40, 18, k);
      return;
    }

    // 2. High-energy rocket ignition and liftoff deluge vaporization (T-3 to T+34)
    // 33 Raptors blast into the steel deflector ridge. Most of the exhaust and steam is
    // channelled in TWO opposing directions (<- ->) along the flame trench axis, +Z and -Z.
    const alt = altitudeAt(t);
    const drive = boosterThrottle(t) * Math.max(0, 1 - alt / 380);
    // Measured against the flight 5 liftoff (Wikimedia Commons, "Liftoff of SpaceX IFT-5"):
    // seconds after liftoff the cloud off the two trench mouths is several hundred metres
    // across and taller than the tower's lower half. It was a few grey puffs. Faster out of
    // the mouths, larger, longer-lived and more of it; the ring buffer was enlarged to hold it.
    const n = drive * 62 * CLOUD_RATE * dt;
    if (n < 0.05) return;

    // Exactly 50% North (+Z) and 50% South (-Z). Fewer, larger puffs than before, each living
    // its whole life (see CLOUD_RATE), overlapping into one mass.
    const trenchCount = Math.max(1, Math.round(n * 0.5));
    // Born small, inside the fire at the mouth, and grown from there: at 24 m from birth each
    // puff was already a cloud when it appeared.
    const big = { size0: 11 * CLOUD_SIZE, grow: 190 * CLOUD_SIZE, life0: 12, lifeVar: 14 };
    cloud.emit(trenchCount, [0, 2.6, 44], [0, 0.10, 1.0], 125, 22, big);
    cloud.emit(trenchCount, [0, 2.6, -44], [0, 0.10, -1.0], 125, 22, big);
    // Dust. The blast scours the flats beyond each mouth and the pad itself, and in the Flight 12
    // photographs from Pad 2 a low brown haze spreads along the ground under and between the two
    // steam towers. Slower, wider, heavy (it barely rises) and translucent; it is what joins the
    // two clouds into one scene instead of two separate cotton balls.
    const dustCount = Math.max(1, Math.round(n * 0.1));
    const haze = { size0: 20 * CLOUD_SIZE, grow: 150 * CLOUD_SIZE, life0: 14, lifeVar: 12, kind: 1 };
    cloud.emit(dustCount, [0, 2.0, 50], [0, 0.02, 1.0], 70, 40, haze);
    cloud.emit(dustCount, [0, 2.0, -50], [0, 0.02, -1.0], 70, 40, haze);
    if (t > EVENTS.liftoff - 1 && t < EVENTS.liftoff + 8) {
      // Sideways off the pad as the vehicle clears the mount: the exhaust spills over the deck.
      for (const [dx, dz] of [[1, 0], [-1, 0]]) {
        cloud.emit(Math.max(1, Math.round(dustCount * 0.5)), [dx * 20, 5.5, dz], [dx, 0.02, 0], 40, 30, haze);
      }
    }

    // ...but not all of it. The trench takes the exhaust; the deluge does not go with it.
    // Thousands of litres a second flash to steam ON the deck and boil up around the mount,
    // and every launch camera near the pad is looking through that. With the two mouths as
    // the only sources, a shot framed on the vehicle at T+6 showed a smudge forty metres away
    // on one side and clean air everywhere else — the pad looked like nothing was happening.
    // Small, short-lived and low: deluge steam, not a second thunderhead. At the trench's
    // own growth rate these puffs reached ninety metres across in a few seconds and buried
    // the whole 124 m stack. They were still thrown upward at 11 m/s on top of the cloud's
    // buoyancy, which stood them up into a grey sheath round the climbing vehicle; the steam
    // off a deck rolls outward over its edge, so it leaves nearly flat.
    const near = Math.max(1, Math.round(n * 0.3));
    for (const [px, pz] of [[16, 11], [-16, 11], [16, -11], [-16, -11]]) {
      const r = Math.hypot(px, pz);
      cloud.emit(Math.max(1, Math.round(near / 4)), [px, 18.5, pz],
        [px / r * 0.95, 0.08, pz / r * 0.95], 24, 10,
        { size0: 8 * CLOUD_SIZE, grow: 30 * CLOUD_SIZE, life0: 3.5, lifeVar: 3.5 });
    }
  }

  // ---- The one function that maps a mission time to the whole scene ---------------------
  function apply(t) {
    applyFrost(t, true);
    applySoot(t, true);
    const alt = altitudeAt(t);
    const bt = boosterThrottle(t), st = shipThrottle(t);

    const att = pitchAt(t);
    if (t <= EVENTS.separation) flight.position.set(downrangeAt(t), alt, 0);
    else {
      // Pivot on the ship's middle (see SHIP_PIVOT): the trajectory point carries the offset it
      // had at separation, and the group is placed so the middle stays on it as the ship turns.
      flight.position.set(downrangeAt(t) + SHIP_PIVOT * (Math.sin(ATT_SEP) - Math.sin(att)),
        alt + SHIP_PIVOT * (Math.cos(ATT_SEP) - Math.cos(att)), 0);
    }
    flight.rotation.z = -att;

    // Hot staging. The ship keeps flying the ascent profile (its own engines, still
    // accelerating) and the booster its integrated return (three engines off, gravity and a
    // little drag), so the gap between them opens on its own at their difference in
    // acceleration — about 11 m/s² — without a separate push that the panel knew nothing of.
    ship.position.y = shipHome;

    // The booster on its own trajectory. Up to separation it is exactly where the stack is;
    // after it, it flies the return. Its attitude is part of that trajectory, so nothing here
    // adds a tilt or a drift of its own.
    detachBooster(true);
    const bAlt = boosterAltAt(t);
    boosterFlight.position.set(boosterDownAt(t), bAlt, 0);
    boosterFlight.rotation.z = -boosterPitchAt(t);
    booster.position.x = boosterHome.position.x;
    booster.rotation.z = 0;

    // The catch: the carriage rides up the tower as the booster comes home, and the arms close
    // on it in the last seconds of the landing burn.
    const ride = THREE.MathUtils.smoothstep(t, EVENTS.landingBurn - 60, EVENTS.landingBurn + 6);
    chop.position.y = THREE.MathUtils.lerp(chopHome.y, CATCH_CARRIAGE, ride);
    parts.hoist?.(chop.position.y);
    const close = THREE.MathUtils.smoothstep(t, BURN_THREE, EVENTS.catch - 1);
    for (const a of chopHome.arms) {
      const s2 = a.ry < 0 ? 1 : -1;
      a.obj.rotation.y = THREE.MathUtils.lerp(a.ry, -s2 * CATCH_ARM, close);
    }

    const bThrottle = boosterEngineThrottle(t);
    boosterPlume.setTime(t);
    shipPlume.setTime(t);
    // Per engine, the running ones are near full throttle whatever the cluster total says:
    // 13 engines carrying 42 % of the cluster's thrust are each at ~100 %.
    const lit = boosterLit(t);
    const perEngine = lit ? Math.min(1, bThrottle / (lit / 33)) : 0;
    boosterPlume.setThrottle(bThrottle, bAlt, boosterSpread(t), perEngine);
    boosterJets.setTime(t);
    boosterJets.setState(perEngine, bAlt, lit);
    shipJets.setTime(t);
    // Hot staging, as it is flown: the ship lights while still latched on, its exhaust hits the
    // booster's shielded forward dome inside the open hot-stage truss and is thrown out
    // sideways through it, and only as the gap opens does the plume run free. So the ship's
    // plume stops at the dome, and the fan of flame out of the truss lasts while the gap is
    // short — not for a fixed time — which is also what it did not do before: the plume ran on
    // straight through the booster's tanks.
    ship.updateWorldMatrix(true, false);
    booster.updateWorldMatrix(true, false);
    ship.localToWorld(_gapA.set(0, 0, 0));
    booster.localToWorld(_gapB.set(0, HS_STATION, 0));
    const gap = _gapA.distanceTo(_gapB);
    // Only an obstruction while the dome is actually in the plume's path, below the ship
    // along its axis: once the booster has swung away in its flip, the plume runs free.
    ship.localToWorld(_gapC.set(0, -1, 0)).sub(_gapA).normalize();
    const inPath = gap < 1 || _gapB.clone().sub(_gapA).normalize().dot(_gapC) > Math.cos(THREE.MathUtils.degToRad(22));
    const impinge = st > 0.01 && t < EVENTS.separation + 20 && inPath ? 1 - THREE.MathUtils.smoothstep(gap, 8, 45) : 0;
    const vent = Math.min(ventAt(t) + impinge * st, 1) * (t < EVENTS.separation ? 1 : impinge > 0 ? 1 : 0);
    hotStageVents.setTime(t);
    hotStageVents.setState(vent, alt, vent > 0.01 ? 24 : 0);
    const sg = stageGlowAt(t) * (t < EVENTS.separation ? 1 : Math.max(impinge, 0.15));
    stageGlow.set(3 * sg, 26 + 46 * THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation + 2.5), t);
    for (const vp of vapors) vp.update(t, camera, env.sun);
    collar.set(collarAt(t), t);
    collarShip.set(collarAt(t) * 0.8, t);
    const shipReach = t < EVENTS.separation + 20 && inPath ? Math.max(0.5, gap - 0.5) : Infinity;
    shipPlume.setThrottle(st, alt, 1, st, shipReach);
    shipJets.setState(st, alt, 6, shipReach);
    cloud.setFlame(bt * Math.max(0, 1 - alt / 160));
    const tf = trenchFireAt(t);
    trenchFire.setTime(t);
    trenchFire.set({ intensity: tf, life: 1.7, len: 95, drag: 2.4, r0: 4.5, widen: 0.28, size0: 7, grow: 30,
      rise: 22, stretch: 1.35, wander: 16 });
    deckFire.setTime(t);
    deckFire.set({ intensity: deckFireAt(t), life: 1.1, len: 26, drag: 1.8, r0: 1.5, widen: 0.35, size0: 5, grow: 16,
      rise: 9, stretch: 1.5, wander: 7 });
    // Glare while the column still plays on the mount and the trench, fading as it climbs away.
    const glare = bt * (1 - THREE.MathUtils.smoothstep(alt, 60, 600));
    baseGlare.set(1.6 * glare, 34 + 20 * glare, t);

    // The camera first (the shot list, or the visitor's orbit riding on the vehicle), so the
    // sky, the planes and the shadows below follow wherever it actually is.
    if (rig.external) { driveCamera(t); followPrev = null; }
    else if (rig.mode === 'orbit' && !rig.transition) followCamera(t);
    else followPrev = null;
    // The atmosphere follows whatever the camera is on: the ship until staging, the booster
    // afterwards, which is what brings the sky back as it comes down. A visitor riding with the
    // ship keeps the ship's thin sky.
    const onShip = t < EVENTS.boostbackStart || (!rig.external && state.follow === 'ship');
    env.setAltitude(onShip ? alt : bAlt);
    // A 340 m shadow frustum is meaningless once the vehicle is kilometres up, and it costs
    // a full shadow pass per frame.
    // The near/far plane and the shadows follow whichever vehicle the camera is on, so the
    // pad comes back into shadow range as the booster returns to it.
    const camAlt = onShip ? alt : bAlt;
    // The shadow map stops being REDRAWN up there, but the light keeps casting: whether a
    // light casts shadows is part of every lit material's program, so switching castShadow
    // off at 1,8 km and on again for the landing recompiled every visible material twice in
    // flight — 12 programs on the way up, 26 on the way down, each a stall on a real GPU.
    const shadowLive = home.shadows && camAlt < 1800;
    if (shadowLive && !env.sun.shadow.autoUpdate) env.sun.shadow.needsUpdate = true;
    env.sun.shadow.autoUpdate = shadowLive;
    // Far plane out to past the geometric horizon, sqrt(2·R·h), with the limb shell on top.
    camera.near = camAlt > 20000 ? 2 : camAlt > 900 ? 0.8 : PAD_NEAR;
    camera.far = camAlt > 900 ? Math.max(260000, Math.sqrt(2 * 6371000 * camAlt) * 1.3 + 60000) : home.far;
    camera.updateProjectionMatrix();

    driveHardware(t);
    flightEarth.update(camera, env.sunDir, camera.position.y);

    // After staging the panel follows the booster: it is what the camera is on and what the
    // remaining milestones belong to.
    // The panel and the camera change vehicle together, at the boostback burn: reading the
    // booster's numbers under a shot of the ship is worse than either.
    const onBooster = t >= EVENTS.boostbackStart;
    state.t = t;
    state.director = !!rig.external;
    state.altitude = onBooster ? bAlt : alt;
    state.velocity = onBooster ? boosterSpeedAt(t) : speedAt(t);
    state.downrange = onBooster ? boosterDownAt(t) : downrangeAt(t);
    state.throttle = onBooster ? bThrottle : Math.max(bt, st);
    state.phase = phaseAt(t);
    // Both vehicles, the way the webcast carries them: identical until they part.
    state.ship.altitude = alt; state.ship.velocity = speedAt(t); state.ship.lit = shipLit(t);
    state.booster.altitude = bAlt; state.booster.velocity = boosterSpeedAt(t);
    state.booster.lit = boosterEngineThrottle(t) > 0.001 ? boosterLit(t) : 0;
    const next = MILESTONES.find(m => m.t > t);
    state.next = next ?? null;
  }

  // ---- Public API -------------------------------------------------------------------
  function start() {
    if (state.running) return;
    saveCameraPlanes();
    // Whoever else was driving the camera has to be told, and it has to happen here rather
    // than at the button: start() is also reachable from the API and from the check.
    onStart();
    state.running = true;
    state.armed = true;
    state.paused = false;
    state.follow = 'director';
    followPrev = null;
    state.t = EVENTS.start;
    resetCloud();
    visibilityHook?.(true);
    rig.external = true;
    apply(state.t);
    onState(state);
  }

  /** @param {boolean} returnCamera fly back to the pad; false when only the state matters. */
  function reset(returnCamera = true, completed = false) {
    const wasRunning = state.running;
    state.running = false;
    state.armed = false;
    state.t = EVENTS.start;
    // The clock multiplier belongs to a run, not to the session: leaving it at ×10 meant the
    // next launch ran at ×10 while the panel showed ×1.
    state.speed = 1;
    state.paused = false;
    state.follow = 'director';
    followPrev = null;
    rig.releaseExternal();
    flight.position.set(0, 0, 0);
    flight.rotation.z = 0;
    ship.position.y = shipHome;
    booster.rotation.z = 0;
    booster.position.x = 0;
    boosterPlume.setThrottle(0, 0);
    boosterJets.setState(0, 0, 0);
    shipJets.setState(0, 0, 0);
    hotStageVents.setState(0, 0, 0);
    trenchFire.set({ intensity: 0 });
    deckFire.set({ intensity: 0 });
    baseGlare.set(0, 1, 0);
    stageGlow.set(0, 1, 0);
    for (const vp of vapors) vp.hide();
    collar.set(0, 0);
    collarShip.set(0, 0);
    flightEarth.hide();
    shipPlume.setThrottle(0, 0);
    resetCloud();
    parts.qdArm.rotation.y = 0;
    (parts.boosterQds ?? []).forEach((q, i) => q.position.copy(home.boosterQds[i]));
    parts.holddowns.children.forEach((c, i) => c.position.copy(home.clamps[i]));
    env.setAltitude(0);
    chop.position.y = chopHome.y;
    parts.hoist?.(chop.position.y);
    for (const a of chopHome.arms) a.obj.rotation.y = a.ry;
    boosterFlight.position.set(0, 0, 0);
    boosterFlight.rotation.z = 0;
    detachBooster(false);
    env.sun.castShadow = home.shadows;
    env.sun.shadow.autoUpdate = true; env.sun.shadow.needsUpdate = true;
    camera.near = home.near; camera.far = home.far;
    camera.updateProjectionMatrix();
    applyFrost(0, false);
    applySoot(0, false);
    visibilityHook?.(false);
    Object.assign(state, { phase: 'On the pad', altitude: 0, velocity: 0, throttle: 0, downrange: 0, next: null });
    Object.assign(state.ship, { altitude: 0, velocity: 0, lit: 0 });
    Object.assign(state.booster, { altitude: 0, velocity: 0, lit: 0 });
    onState(state);
    // The sequence ends 60 km up and 80 km downrange; leaving the viewer there would be a
    // trap, so control comes back looking at the pad the vehicle left.
    if (wasRunning && returnCamera) onFinish(completed);
  }

  /**
   * Jumps straight to a mission time. Used by the headless check and by the screenshot tool.
   * The ground cloud has no closed form, so it is re-simulated from ignition at a fixed step:
   * seeking therefore lands on the same state the animation would have reached by running
   * there, which is the only way a frame-by-frame check means anything.
   */
  function seek(t) {
    if (!state.running) { saveCameraPlanes(); onStart(); state.running = true; state.armed = true; visibilityHook?.(true); rig.external = true; }
    resetCloud();
    advanceCloud(t);
    apply(t);
    // Seeking changes the camera after replay; refresh lighting in its final view space.
    camera.updateMatrixWorld();
    cloud.update(0, camera, env.sun);
    onState(state);
  }

  function update(dt) {
    if (!state.running || state.paused) return;
    const prev = state.t;
    const t = prev + dt * state.speed;
    apply(t);

    advanceCloud(t);

    if (t >= EVENTS.end) { reset(true, true); return; }
    onState(state);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    setSpeed: (k) => { state.speed = k; },
    /** Holds the mission clock where it is; the camera stays free to move around the frozen scene. */
    setPaused: (on) => { if (!state.running) return; state.paused = !!on; onState(state); },
    /** 'director' | 'booster' | 'ship' — main.js hands the camera over accordingly. */
    setFollow: (w) => { state.follow = w; followPrev = null; if (state.running) apply(state.t); onState(state); },
    setVisibilityHook: (fn) => { visibilityHook = fn; },
    events: EVENTS,
    /**
     * Where the noise comes from at mission time t, for the sound: the booster's engines and
     * the ship's, in world space, with the throttle each was at and its altitude.
     */
    sources(t, out = [{ pos: new THREE.Vector3() }, { pos: new THREE.Vector3() }]) {
      const b = out[0], s = out[1];
      b.pos.set(S.x + boosterDownAt(t), ex.lay.mount + boosterAltAt(t), S.z);
      b.throttle = boosterEngineThrottle(t);
      b.altitude = boosterAltAt(t);
      s.pos.set(S.x + downrangeAt(t), ex.lay.mount + altitudeAt(t), S.z);
      s.throttle = shipThrottle(t);
      s.altitude = altitudeAt(t);
      return out;
    },
    start, reset, seek, update,
    /** Used by verify(): measuring the vehicle mid-flight would measure the wrong thing. */
    get atRest() { return !state.running; },
  };
}
