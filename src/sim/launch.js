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
import { Plume, GroundCloud, EngineJets, Vapor, CondensationCollar, FlightEarth } from './plume.js';
import { BOOSTER_RINGS, RAPTOR_EXIT_R } from '../vehicles/starship.js';
import { seeded, monotoneSlopes, hermite } from '../geometry/utils.js';

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
 */
function buildProfile() {
  const xs = SPEED_KEYS.map(k => k[0]);
  const vy = SPEED_KEYS.map(k => k[1]);
  const vm = monotoneSlopes(xs, vy);
  const step = 0.25, sub = 5, dt = step / sub;
  const n = Math.round(EVENTS.end / step) + 1;
  const alt = new Float64Array(n), spd = new Float64Array(n), down = new Float64Array(n), pit = new Float64Array(n);
  let h = 0, x = 0, t = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      for (let k = 0; k < sub; k++) {
        const v = hermite(xs, vy, vm, t + dt * 0.5), p = pitchProgram(t + dt * 0.5);
        h += v * Math.cos(p) * dt;
        x += v * Math.sin(p) * dt;
        t += dt;
      }
    }
    alt[i] = h; spd[i] = hermite(xs, vy, vm, i * step); down[i] = x; pit[i] = pitchProgram(i * step);
  }
  return { step, n, alt, spd, down, pit };
}
const PROFILE = buildProfile();

// ---- Booster return ----------------------------------------------------------------------
// One integrated trajectory from separation to the arms. Position, velocity and attitude all
// come from it, so the booster on screen, the speed on the panel and the way it points cannot
// disagree — and nothing jumps at the joins.
//
// What is cited: the four times (boostback T+02:45–T+03:41, landing burn T+06:30, catch
// T+06:54, flight 5) and the state it starts from, which is the stack's own at separation
// (itself integrated from the ascent inputs above). What is assumed, and marked so in the
// sheet: a 250 t booster for drag with Cd ≈ 0,9 end-on over the 9 m disc, an exponential
// atmosphere (ρ₀ 1,225 kg/m³, 8,5 km scale height), a boostback of constant thrust direction
// and size, and a landing burn of constant thrust against the velocity. What is *solved*,
// rather than chosen: those two thrusts and the boostback's direction, by Newton iteration at
// load, so the landing burn lit at the cited T+06:30 brings the booster to walking pace
// (12 m/s) 45 m above the catch height at T+06:46,5 — the moment the thirteen engines give way to
// the centre three, 7,5 s before the cited catch. The centre three then set it down in the
// arms on a cubic that matches position and velocity at both ends.
//
// The model integrates the booster's centre of mass, 30 m up its axis, not its base: it flips
// about that point, as a free body does, instead of swinging 70 m of tank about its engines.
const CATCH_BASE = 22;            // booster base held this far above the mount deck when caught
export const RETURN_ASSUMED = { mass: 250e3, cd: 0.9, diameter: 9, rho0: 1.225, scaleHeight: 8500, comOffset: 30 };
export const BURN_THREE = 406.5;   // landing burn: 13 engines → centre 3; 12 m/s, 45 m above the catch
const FLIP_END = 166.5;            // the flip to boostback attitude, overlapping the throttle-up
const RETRO_BLEND = [221, 245];    // after the boostback: swing to engines-first

const pitchRate = (t) => (pitchProgram(t + 0.01) - pitchProgram(t - 0.01)) / 0.02;

const RETURN_ITER = { n: 0 };
const RETURN = (() => {
  const { mass: M, cd: CD, diameter, rho0, scaleHeight, comOffset: R } = RETURN_ASSUMED;
  const G = 9.81, AREA = Math.PI * (diameter / 2) ** 2, DT = 0.02;
  const K = (h) => rho0 * Math.exp(-Math.max(h, 0) / scaleHeight) * CD * AREA / (2 * M);
  const T0 = EVENTS.separation, BB0 = EVENTS.boostbackStart, BB1 = EVENTS.boostbackEnd;
  const LB = EVENTS.landingBurn, STOP_V = -12;
  // Stop where the centre three can take it to the arms at a steady deceleration: 12 m/s over
  // the remaining 7,5 s is 45 m, so the burn hands over 45 m above the catch height.
  const STOP_H = CATCH_BASE + 45 + R;
  const sst = THREE.MathUtils.smoothstep;
  const bbWeight = (t) => sst(t, BB0, BB0 + 2) * (1 - sst(t, BB1 - 3, BB1));

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
    const sp = Math.hypot(vx, vh), k = K(h);
    let ax = -k * sp * vx, ah = -G - k * sp * vh;
    if (t >= BB0 && t <= BB1) { const w = bbWeight(t); ax += w * q[0]; ah += w * q[1]; }
    if (t >= LB) { const sp1 = sp || 1, w = sst(t, LB, LB + 1.5); ax -= w * q[2] * vx / sp1; ah -= w * q[2] * vh / sp1; }
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
  // Flies q = [boostback ax, boostback ah, landing-burn thrust] (m/s²) from separation until
  // the burn has slowed the descent to STOP_V; returns the stop time and state.
  function fly(q, rec) {
    let s = init.slice(), t = T0;
    while (t < 440) {
      const n = rk4(t, s, DT, q);
      if (t + DT > LB && n[3] >= STOP_V) {
        const f = (STOP_V - s[3]) / (n[3] - s[3]);
        const e = s.map((v, i) => v + (n[i] - v) * f);
        if (rec) rec.push([t + DT * f, ...e]);
        return { t: t + DT * f, s: e };
      }
      s = n; t += DT;
      if (rec) rec.push([t, ...s]);
    }
    return { t, s };
  }
  const residual = (q) => { const r = fly(q); return [r.s[0] / 1000, (r.s[1] - STOP_H) / 100, r.t - BURN_THREE]; };
  // Seeded with the converged solution, so this normally takes one step to confirm it.
  let q = [-39.143829, 4.758797, 40.967829];
  for (let it = 0; it < 30; it++) {
    RETURN_ITER.n = it;
    const r0 = residual(q), n0 = Math.hypot(...r0);
    if (n0 < 1e-4) break;
    const J = [0, 1, 2].map((j) => { const qq = q.slice(); qq[j] += 0.01; return residual(qq).map((v, i) => (v - r0[i]) / 0.01); });
    const d = solve3([0, 1, 2].map((i) => [J[0][i], J[1][i], J[2][i]]), r0.map((v) => -v));
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
  };
})();

/** Gaussian elimination with partial pivoting, 3 × 3. */
function solve3(A, b) {
  const m = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
    [m[i], m[p]] = [m[p], m[i]];
    for (let k = i + 1; k < 3; k++) { const f = m[k][i] / m[i][i]; for (let c = i; c < 4; c++) m[k][c] -= f * m[i][c]; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let v = m[i][3]; for (let c = i + 1; c < 3; c++) v -= m[i][c] * x[c]; x[i] = v / m[i][i]; }
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
  landingBurnAccel: RETURN.q[2], stop: { t: RETURN.stop.t }, q: RETURN.q.slice(), iterations: RETURN_ITER.n,
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
  if (t >= EVENTS.boostbackStart && t <= EVENTS.boostbackEnd) {
    return 0.40 * THREE.MathUtils.smoothstep(t, EVENTS.boostbackStart, EVENTS.boostbackStart + 2)
      * (1 - THREE.MathUtils.smoothstep(t, EVENTS.boostbackEnd - 3, EVENTS.boostbackEnd));
  }
  if (t >= EVENTS.landingBurn && t <= EVENTS.catch) {
    // Thirteen engines to arrest the descent, down to three for the last few seconds.
    const lit = t < BURN_THREE - 1.5 ? 0.42 : 0.42 * (1 - 0.72 * THREE.MathUtils.smoothstep(t, BURN_THREE - 1.5, BURN_THREE + 0.5));
    return lit * (1 - THREE.MathUtils.smoothstep(t, EVENTS.catch - 1.2, EVENTS.catch));
  }
  return 0;
}

/**
 * Which of the booster's engines are lit, as a share of the cluster's radius (rings at 1,02,
 * 2,48 and 3,86 m, 0,62 m exit radius, 4,48 m overall). Flight 5: 13 lit for the landing burn,
 * down to the centre 3 for the last seconds (RGV engine count, T+6:30 and T+6:37); the inner
 * ring for the boostback (flight 7 relit 9 of 10); the centre 3 through hot-staging.
 */
const CENTRE_3 = (1.02 + 0.62) / 4.48, INNER_13 = (2.48 + 0.62) / 4.48;
function boosterSpread(t) {
  if (t < EVENTS.meco) return 1;
  if (t < EVENTS.boostbackStart) return CENTRE_3;
  if (t <= EVENTS.boostbackEnd) return INNER_13;
  if (t < BURN_THREE - 1.5) return INNER_13;
  return THREE.MathUtils.lerp(INNER_13, CENTRE_3, THREE.MathUtils.smoothstep(t, BURN_THREE - 1.5, BURN_THREE + 0.5));
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
  if (t < BURN_THREE) return 13;
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
export const pitchAt = (t) => (t <= 0 ? 0 : sample(PROFILE.pit, t));

// The moment the stack clears the tower is read off the integrated climb, not authored: the
// base has to rise from the mount deck (9 m above the pad) past the 144,5 m tower top, 135,5 m.
// It was a fixed T+12, by which time the curve already has the stack ~300 m up.
{
  const CLIMB = 144.5 - 9;
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
  ...(DERIVED.transonic ? [{ t: DERIVED.transonic, label: 'Booster transonic', src: 'model' }] : []),
  { t: EVENTS.landingBurn, label: 'Landing burn', src: 'f5' },
  { t: EVENTS.catch, label: 'Booster caught', src: 'f5' },
].sort((a, b) => a.t - b.t);

/** Engine layouts for the panel's engine dials, in lighting order. */
export const ENGINE_LAYOUT = {
  booster: BOOSTER_RINGS.map(([n, r, , phase]) => ({ n, r, phase, size: RAPTOR_EXIT_R })),
  ship: [{ n: 3, r: 0.95, phase: 0, size: RAPTOR_EXIT_R }, { n: 3, r: 3.05, phase: Math.PI / 3, size: 1.15 }],
};

const PHASES = [
  [EVENTS.goForLaunch, 'Terminal count'],
  [EVENTS.deflector, 'GO for launch'],
  [EVENTS.ignition, 'Flame deflector active'],
  [EVENTS.liftoff, 'Super Heavy ignition'],
  [EVENTS.towerClear, 'Liftoff'],
  [EVENTS.maxQ - 6, 'Ascent · tower cleared'],
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
  const boosterPlume = new Plume({ radius: 4.6, seaLevelLength: 16, name: 'plume-booster' });
  const shipPlume = new Plume({ radius: 2.6, seaLevelLength: 8.4, name: 'plume-ship' });
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
    engines: BOOSTER_RINGS.flatMap(([n, r, y, phase]) => ringPositions(n, r, y, phase).map(position => ({ position, radius: RAPTOR_EXIT_R }))),
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
  const hotStageVents = new EngineJets({
    name: 'jets-hot-stage', seaLevelLength: 9,
    engines: Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return { position: [Math.sin(a) * 4.45, HS_STATION, Math.cos(a) * 4.45], radius: 0.42, direction: [Math.sin(a), -0.45, Math.cos(a)] };
    }),
  });
  booster.add(hotStageVents.mesh);
  const ventAt = (t) => shipThrottle(t) * (1 - THREE.MathUtils.smoothstep(t, EVENTS.separation + 0.4, EVENTS.separation + 2.6));

  // ---- Vapour: venting in the count, the deluge at ignition, venting after the catch -------
  // Emitters are placed in the stack's rest frame (booster base at the mount deck, y up),
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
      ...[0.9, 3.9].map(a => ({ at: around(4.4, 2.5, a), dir: out(a, -0.3), speed: 3, spread: 0.4, count: nv(30), life: 6.5, size: 4.32, grow: 2.8, window: COUNT_WIN })),
    ],
  });
  // Deluge: water driven up through the mount's plate round the engines, from a couple of
  // seconds before ignition until the stack is clear. Spray, flashing to steam as it rises.
  const deluge = new Vapor({
    name: 'vapor-deluge', rng: seeded(22), accel: [0.4, -2.2, 0.2], tau: 0.9, opacity: 0.62,
    emitters: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      return { at: around(6.6, -0.6, a), dir: out(a, 3.2), speed: 24, spread: 0.22, count: nv(33), life: 4.16, size: 5.28, grow: 8.4, jitter: 1.2, window: [EVENTS.deflector, EVENTS.liftoff + 10] };
    }),
  });
  // Landing: the last seconds of the burn blast the mount deck, and the exhaust and deck water
  // spread out across it as a low sheet of steam.
  const landingSpray = new Vapor({
    name: 'vapor-landing', rng: seeded(24), accel: [0.5, 0.8, 0.2], tau: 1.4, opacity: 0.38,
    emitters: Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      return { at: around(5.5, 0.5, a), dir: out(a, 0.08), speed: 22, spread: 0.25, count: nv(10), life: 4.5, size: 7, grow: 9, jitter: 1.5, window: [BURN_THREE - 1, EVENTS.catch - 0.5] };
    }),
  });
  rest.add(countdownVent.mesh, deluge.mesh, landingSpray.mesh);
  // After the catch the booster sits on the arms venting: off the top, round the upper tank,
  // and from the engine section. Attached to the booster, which no longer moves.
  const CATCH_WIN = [EVENTS.catch + 1.5, EVENTS.end + 60];
  const BOOSTER_TOP = ex.model.userData.stations?.booster?.height ?? 72.3;
  const catchVent = new Vapor({
    name: 'vapor-caught', rng: seeded(23), accel: [0.9, -0.25, 0.35], tau: 1.6, opacity: 0.62,
    emitters: [
      { at: [0, BOOSTER_TOP - 0.8, 0], dir: [0.1, 1, 0], speed: 3.5, spread: 0.4, count: nv(39), life: 9.1, size: 4.32, grow: 2.6, jitter: 2, window: CATCH_WIN },
      ...[1.0, 3.6].map(a => ({ at: around(4.6, 58, a), dir: out(a, 0), speed: 2.4, spread: 0.35, count: nv(27), life: 7.8, size: 3.36, grow: 2.2, window: CATCH_WIN })),
      ...[0.3, 3.3].map(a => ({ at: around(4.3, 2, a), dir: out(a, -0.3), speed: 2.6, spread: 0.4, count: nv(24), life: 6.5, size: 3.84, grow: 2.4, window: CATCH_WIN })),
    ],
  });
  booster.add(catchVent.mesh);
  const vapors = [countdownVent, deluge, landingSpray, catchVent];

  // Max-Q: a condensation collar off the hot-stage ring, trailing down the booster, through
  // the transonic climb and peak dynamic pressure. Timing follows the ascent's own Max-Q.
  const collar = new CondensationCollar({ radius: 4.5, spread: 7.5, length: 30, y: (ex.model.userData.stations?.booster?.height ?? 72.3) - 0.8 });
  booster.add(collar.mesh);
  const collarShip = new CondensationCollar({ radius: 4.5, spread: 5, length: 16, y: 12, name: 'condensation-collar-ship' });
  ship.add(collarShip.mesh);
  const collarAt = (t) => {
    const k = THREE.MathUtils.smoothstep(t, EVENTS.maxQ - 22, EVENTS.maxQ - 12) * (1 - THREE.MathUtils.smoothstep(t, EVENTS.maxQ + 6, EVENTS.maxQ + 14));
    // Flickers as it forms and sheds, the way it does on film.
    return k * (0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2));
  };

  const cloud = new GroundCloud({ rng: seeded(11), count: quality.cloudParticles ?? 860 });
  cloud.points.position.set(ex.lay.x, 0, ex.lay.z);
  scene.add(cloud.points);

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
  const frostMat = frostShells[0]?.children[0]?.material;
  function applyFrost(t, on) {
    const k = !on ? 0 : t < EVENTS.liftoff + 15 ? 1
      : THREE.MathUtils.lerp(1, 0.4, THREE.MathUtils.smoothstep(t, EVENTS.liftoff + 15, EVENTS.meco));
    for (const f of frostShells) f.visible = k > 0.01;
    if (frostMat) frostMat.opacity = 0.9 * k;
  }

  const home = {
    near: camera.near, far: camera.far,
    shadows: env.sun.castShadow,
    clamps: parts.holddowns.children.map(c => c.position.clone()),
    boosterQds: (parts.boosterQds ?? []).map(q => q.position.clone()),
  };

  const state = {
    running: false, armed: false, t: EVENTS.start, speed: 1,
    phase: 'On the pad', altitude: 0, velocity: 0, throttle: 0, downrange: 0,
    ship: { altitude: 0, velocity: 0, lit: 0 }, booster: { altitude: 0, velocity: 0, lit: 0 }, next: null,
  };
  let visibilityHook = null;   // set by main.js: hides labels, rulers and figures while flying

  // ---- Camera ---------------------------------------------------------------------------
  const S = new THREE.Vector3(ex.lay.x, 0, ex.lay.z);        // site origin, on grade
  const PAD_CATCH_Y = ex.lay.mount + CATCH_ALT + 34;         // roughly the middle of the caught booster
  const V = new THREE.Vector3();                             // vehicle mid-body, world
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
      // vehicle rather than behind it.
      const u = ease(t, -24, -12);
      pos.set(S.x + THREE.MathUtils.lerp(28, 14, u), THREE.MathUtils.lerp(100, 90, u), S.z + THREE.MathUtils.lerp(152, 136, u));
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
      vehicleAt(t, tgt);
      const d = 340 + Math.max(0, t - EVENTS.separation) * 6.5;
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
      const near = 1 - THREE.MathUtils.clamp(boosterAltAt(t) / 700, 0, 1);
      const n2 = near * 34 * dt;
      if (n2 >= 0.05) {
        const m2 = Math.max(1, Math.round(n2 * 0.5));
        cloud.emit(m2, [0, 2.4, 44], [0, 0.05, 1.0], 46, 16, { grow: 52 });
        cloud.emit(m2, [0, 2.4, -44], [0, 0.05, -1.0], 46, 16, { grow: 52 });
      }
      return;
    }
    if (t < EVENTS.deflector || t >= CLOUD_UNTIL) return;

    // 1. Flame deflector activation (cited T−10) to ignition: water floods the steel plate and
    // a cold white mist rolls out of both mouths (<- ->), thickening as the flow comes up.
    if (t < EVENTS.ignition) {
      const deluge = 0.35 + 0.65 * THREE.MathUtils.smoothstep(t, EVENTS.deflector, EVENTS.ignition);
      const nWater = deluge * THREE.MathUtils.smoothstep(t, EVENTS.deflector, EVENTS.deflector + 1.5) * 30 * dt;
      if (nWater < 0.05) return;
      const m = Math.max(1, Math.round(nWater * 0.5));
      // North mouth (+Z)
      cloud.emit(m, [0, 2.2, 44], [0, 0.05, 1.0], 52, 18, { size0: 10, grow: 46 });
      // South mouth (-Z)
      cloud.emit(m, [0, 2.2, -44], [0, 0.05, -1.0], 52, 18, { size0: 10, grow: 46 });
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
    const n = drive * 150 * dt;
    if (n < 0.05) return;

    // Exactly 50% North (+Z) and 50% South (-Z)
    const trenchCount = Math.max(1, Math.round(n * 0.50));
    const big = { size0: 18, grow: 150, life0: 12, lifeVar: 16 };
    cloud.emit(trenchCount, [0, 2.6, 44], [0, 0.10, 1.0], 125, 22, big);
    cloud.emit(trenchCount, [0, 2.6, -44], [0, 0.10, -1.0], 125, 22, big);

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
    const near = Math.max(1, Math.round(n * 0.26));
    for (const [px, pz] of [[16, 11], [-16, 11], [16, -11], [-16, -11]]) {
      const r = Math.hypot(px, pz);
      cloud.emit(Math.max(1, Math.round(near / 4)), [px, 18.5, pz],
        [px / r * 0.95, 0.08, pz / r * 0.95], 24, 10,
        { size0: 8, grow: 30, life0: 3.5, lifeVar: 3.5 });
    }
  }

  // ---- The one function that maps a mission time to the whole scene ---------------------
  function apply(t) {
    applyFrost(t, true);
    const alt = altitudeAt(t);
    const bt = boosterThrottle(t), st = shipThrottle(t);

    flight.position.set(downrangeAt(t), alt, 0);
    flight.rotation.z = -pitchAt(t);

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

    const bThrottle = t < EVENTS.separation ? bt : returnThrottle(t);
    boosterPlume.setTime(t);
    shipPlume.setTime(t);
    boosterPlume.setThrottle(bThrottle, bAlt, boosterSpread(t));
    // Per engine, the running ones are near full throttle whatever the cluster total says:
    // 13 engines carrying 42 % of the cluster's thrust are each at ~100 %.
    const lit = boosterLit(t);
    boosterJets.setTime(t);
    boosterJets.setState(lit ? Math.min(1, bThrottle / (lit / 33)) : 0, bAlt, lit);
    shipJets.setTime(t);
    shipJets.setState(st, alt, 6);
    const vent = ventAt(t);
    hotStageVents.setTime(t);
    hotStageVents.setState(vent, alt, vent > 0.01 ? 24 : 0);
    for (const vp of vapors) vp.update(t, camera, env.sun);
    collar.set(collarAt(t), t);
    collarShip.set(collarAt(t) * 0.8, t);
    shipPlume.setThrottle(st, alt);
    cloud.setFlame(bt * Math.max(0, 1 - alt / 160));

    // The atmosphere follows whatever the camera is on: the ship until staging, the booster
    // afterwards, which is what brings the sky back as it comes down.
    env.setAltitude(t < EVENTS.boostbackStart ? alt : bAlt);
    // A 340 m shadow frustum is meaningless once the vehicle is kilometres up, and it costs
    // a full shadow pass per frame.
    // The near/far plane and the shadows follow whichever vehicle the camera is on, so the
    // pad comes back into shadow range as the booster returns to it.
    const camAlt = t < EVENTS.boostbackStart ? alt : bAlt;
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
    if (rig.external) driveCamera(t);
    flightEarth.update(camera, env.sunDir, camera.position.y);

    // After staging the panel follows the booster: it is what the camera is on and what the
    // remaining milestones belong to.
    // The panel and the camera change vehicle together, at the boostback burn: reading the
    // booster's numbers under a shot of the ship is worse than either.
    const onBooster = t >= EVENTS.boostbackStart;
    state.t = t;
    state.altitude = onBooster ? bAlt : alt;
    state.velocity = onBooster ? boosterSpeedAt(t) : speedAt(t);
    state.downrange = onBooster ? boosterDownAt(t) : downrangeAt(t);
    state.throttle = onBooster ? bThrottle : Math.max(bt, st);
    state.phase = phaseAt(t);
    // Both vehicles, the way the webcast carries them: identical until they part.
    state.ship.altitude = alt; state.ship.velocity = speedAt(t); state.ship.lit = shipLit(t);
    state.booster.altitude = bAlt; state.booster.velocity = boosterSpeedAt(t);
    state.booster.lit = t >= EVENTS.separation ? (returnThrottle(t) > 0.001 ? boosterLit(t) : 0) : boosterLit(t);
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
    state.t = EVENTS.start;
    resetCloud();
    visibilityHook?.(true);
    rig.external = true;
    apply(state.t);
    onState(state);
  }

  /** @param {boolean} returnCamera fly back to the pad; false when only the state matters. */
  function reset(returnCamera = true) {
    const wasRunning = state.running;
    state.running = false;
    state.armed = false;
    state.t = EVENTS.start;
    // The clock multiplier belongs to a run, not to the session: leaving it at ×10 meant the
    // next launch ran at ×10 while the panel showed ×1.
    state.speed = 1;
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
    visibilityHook?.(false);
    Object.assign(state, { phase: 'On the pad', altitude: 0, velocity: 0, throttle: 0, downrange: 0, next: null });
    Object.assign(state.ship, { altitude: 0, velocity: 0, lit: 0 });
    Object.assign(state.booster, { altitude: 0, velocity: 0, lit: 0 });
    onState(state);
    // The sequence ends 60 km up and 80 km downrange; leaving the viewer there would be a
    // trap, so control comes back looking at the pad the vehicle left.
    if (wasRunning && returnCamera) onFinish();
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
    if (!state.running) return;
    const prev = state.t;
    const t = prev + dt * state.speed;
    apply(t);

    advanceCloud(t);

    if (t >= EVENTS.end) { reset(); return; }
    onState(state);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    setSpeed: (k) => { state.speed = k; },
    setVisibilityHook: (fn) => { visibilityHook = fn; },
    events: EVENTS,
    /**
     * Where the noise comes from at mission time t, for the sound: the booster's engines and
     * the ship's, in world space, with the throttle each was at and its altitude.
     */
    sources(t, out = [{ pos: new THREE.Vector3() }, { pos: new THREE.Vector3() }]) {
      const b = out[0], s = out[1];
      b.pos.set(S.x + boosterDownAt(t), ex.lay.mount + boosterAltAt(t), S.z);
      b.throttle = t < EVENTS.separation ? boosterThrottle(t) : returnThrottle(t);
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
