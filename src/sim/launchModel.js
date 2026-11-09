/**
 * The launch's trajectory model, moved out of launch.js unchanged (8-11-2026, refactor §36 of
 * docs/auditoria-2026-11-08-encargo-maestro.md): the cited event times, the ascent profile, the
 * booster's integrated return, the throttles and lit engines, the milestones. Pure: no scene, no
 * renderer. launch.js builds the sequence on it and re-exports all of it, so every import of
 * './launch.js' keeps working; tools/launch-regressions-check.mjs and tools/mission-check.mjs test it.
 */
// Pure since 9-11-2026 (external audit 8-11, finding 14): no three.js, no vehicle builders. The
// figures come from data modules and the few helpers below are three.js's MathUtils, same formulas.
import { BOOSTER_RINGS, RAPTOR_EXIT_R, BOOSTER_AFT } from '../data/stackFigures.js';
import { monotoneSlopes, hermite } from '../geometry/curves.js';
import { PAD } from '../data/padFigures.js';

const MathUtils = {
  clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
  lerp: (a, b, t) => (1 - t) * a + t * b,
  smoothstep: (x, min, max) => { if (x <= min) return 0; if (x >= max) return 1; x = (x - min) / (max - min); return x * x * (3 - 2 * x); },
  degToRad: (d) => d * (Math.PI / 180),
  radToDeg: (r) => r * (180 / Math.PI),
};
const THREE = { MathUtils };

// ---- Cited event times (seconds from T-0) ------------------------------------------------
// SpaceX, flight 14 timeline (spacex.com/launches/starship-flight-14; "all times approximate").
export const EVENTS = {
  // The sequence opens ten seconds before the GO, with the stack fuelled and venting.
  start: -40,
  goForLaunch: -30,    // cited: "SpaceX flight director verifies go for launch"
  deflector: -17,      // cited: "Flame diverter activation"
  ignition: -3,        // cited: "Booster engine startup command"
  liftoff: 0,          // cited
  towerClear: 0,       // derived below from the integrated altitude (the base clears the tower top)
  maxQ: 58,            // cited: 00:00:58
  meco: 140,           // cited: 00:02:20
  separation: 142,     // cited: 00:02:22, "Starship Raptor ignition and stage separation"
  boostbackStart: 147, // cited: 00:02:27
  boostbackEnd: 187,   // cited: 00:03:07
  landingBurn: 396,    // cited: 00:06:36
  catch: 421,          // cited time: 00:07:01, landing burn shutdown (flight 14 splashed down in the Gulf)
  shipCutoff: 491,     // cited: 00:08:11, "Starship engine cutoff"
  end: 500,
};

/**
 * Reconstructed ascent, built from exactly two authored inputs so that nothing in the
 * simulation can contradict anything else:
 *
 *   1. a speed curve v(t), pinned to zero at the cited liftoff and to the authored ≈ 5 700 km/h
 *      (1 583 m/s) anchor at the cited separation time;
 *   2. a gravity-turn pitch programme θ(t) — zero while the vehicle clears the tower, then
 *      an exponential approach to 72° from vertical, its time constant solved so the stack
 *      reaches the cited ≈64 km at MECO (see MECO_ALTITUDE).
 *
 * Altitude and downrange distance are then *integrated* from those two, not authored
 * separately, so the attitude on screen, the altitude on the panel and the speed on the
 * panel are one object seen three ways. The curve is the one built for the flight 7 clock,
 * compressed onto V3's: a V3 stack reaches MECO twelve seconds sooner (2:20 against 2:32)
 * on ≈80 MN rather than ≈74 (Wikipedia, Super Heavy). No V3 telemetry is published; the shape
 * is a reconstruction and is labelled as such in the panel.
 */
const SPEED_KEYS = [
  [0, 0],                  // cited: liftoff at T+0:00
  [10, 58], [20, 117], [30, 184], [45, 294],
  [58, 420],               // cited time: Max-Q
  [75, 590], [95, 810], [115, 1080], [130, 1370],
  [140, 1565],             // cited time: MECO
  // Cited time, authored speed: no flight timeline gives a separation speed. 1 583 m/s is the
  // anchor this curve is built to, and the sheet says so rather than dressing it as published.
  [142, 1583],
  [155, 1690], [175, 1880], [240, 2380], [320, 3020], [500, 4200],
];
const PITCH = { start: EVENTS.liftoff + 6, max: THREE.MathUtils.degToRad(72), tau: 60 };
const pitchProgram = (t) => (t <= PITCH.start ? 0 : PITCH.max * (1 - Math.exp(-(t - PITCH.start) / PITCH.tau)));
// The turn's time constant is solved, not chosen: MECO comes "at an altitude of roughly 64 km"
// (Wikipedia, SpaceX Starship, flight profile), so τ is bisected at load until the integrated
// climb reaches it at the cited MECO time. With the flight 7 turn (τ 64 s) on this faster clock
// the stack cut off at 48 km.
export const MECO_ALTITUDE = 64e3;   // m, ≈ "roughly 64 km"
{
  const xs = SPEED_KEYS.map(k => k[0]), vy = SPEED_KEYS.map(k => k[1]), vm = monotoneSlopes(xs, vy);
  const climb = (tau) => {
    PITCH.tau = tau;
    let h = 0;
    for (let t = 0, dt = 0.05; t < EVENTS.meco - 1e-9; t += dt) h += hermite(xs, vy, vm, t + dt / 2) * Math.cos(pitchProgram(t + dt / 2)) * dt;
    return h;
  };
  let lo = 30, hi = 250;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (climb(mid) < MECO_ALTITUDE) lo = mid; else hi = mid; }
  PITCH.tau = (lo + hi) / 2;
}

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
  // N, spacex.com (Starship, V3): 1 614 tf, the ship's total as SpaceX states it. It is NOT the sum
  // of the per-engine figures of the V3 update (3 × 250 + 3 × 275 = 1 575 tf): the two published
  // numbers differ by ≈2.5 % and the source does not say at which ambient pressure each applies
  // (≈, external audit 8-11, finding 07). One figure for the whole burn: no rise of the sea-level
  // engines' thrust with altitude is modelled.
  thrust: 1614e3 * 9.80665,
  propellant: 1600e3,            // kg, spacex.com: 1 600 t
  // kg, SOLVED at load, not assumed: everything that is not propellant (structure, payload,
  // residuals). It is the mass that makes the published thrust, the published propellant load
  // and the assumed Isp reach the cutoff speed below at the cited cutoff time. See buildProfile.
  dry: 150e3,
  ispSL: 350,                    // s, ≈ assumed: Raptor 3 sea-level engines in vacuum
  ispVac: 380,                   // s, ≈ assumed: Raptor Vacuum
  // Thrust share of the three sea-level engines, from the per-engine figures (3 × 250 of
  // 3 × 250 + 3 × 275 tf): a ratio, applied to the 1 614 tf total above (≈).
  slShare: 750 / 1575,
  // m, ≈: the burn is steered to end level in a circular 200 km orbit, the re-entry's assumption
  // (one assumption for both chapters, not two). It is NOT flight 14's orbit: the flight as flown
  // reached ≈262 × 275 km (Wikipedia, citing SpaceX; mission.js AS_FLOWN) and was shortened to
  // about three hours, not the ≈9 h 50 min of the pre-flight plan the re-entry chapter flies, and
  // a Raptor Vacuum shut down early with the others compensating, which this burn does not
  // reproduce (external audit 8-11, finding 06). (The burn used to end on flight 12's suborbital
  // arc, apogee 195 km and perigee −7 km.)
  holdAltitude: 200e3,
  perigee: 200e3,
};
/** Linear-tangent constants, solved at load (see buildProfile). */
export const SHIP_STEERING = { e0: 0, c: 0, cutoffSpeed: 0 };
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
  // Lit through the hot-stage ring a moment before separation, shut down at the cited engine
  // cutoff (T+8:11), then coasting.
  const throttleAt = (tt) => THREE.MathUtils.smoothstep(tt, EVENTS.separation - 1.5, EVENTS.separation + 1.5)
    * (1 - THREE.MathUtils.smoothstep(tt, EVENTS.shipCutoff - 1, EVENTS.shipCutoff));
  const fly = (q, rec) => {
    const [e0, c] = q;
    let vx = spd[iSep] * Math.sin(pit[iSep]), vh = spd[iSep] * Math.cos(pit[iSep]);
    let m = S.propellant + S.dry, a = att[iSep], hh = alt[iSep], xx = down[iSep], tt = EVENTS.separation;
    let atCut = null;
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
        if (atCut === null && tt >= EVENTS.shipCutoff) atCut = [hh, vh, vx];
      }
      if (rec) {
        alt[i] = hh; down[i] = xx; spd[i] = Math.hypot(vx, vh); pit[i] = Math.atan2(vx, vh); att[i] = a;
        mass[i] = m; acc[i] = m > S.dry ? throttleAt(tt) * S.thrust / m : 0;
      }
    }
    // Steered so the burn ends level at the hold altitude, at the speed of the top of the arc.
    const [hc, vc, uc] = atCut ?? [hh, vh, vx];
    return [(hc - S.holdAltitude) / 1000, vc / 10, (Math.hypot(uc, vc) - V_CUT) / 10];
  };
  const MU = G0 * R_EARTH * R_EARTH, ra = R_EARTH + S.holdAltitude, sma = R_EARTH + (S.holdAltitude + S.perigee) / 2;
  const V_CUT = Math.sqrt(MU * (2 / ra - 1 / sma));
  // Newton on the steering constants and the non-propellant mass together.
  const q = [THREE.MathUtils.degToRad(30), 0.002, 300e3];
  const setQ = (qq) => { S.dry = qq[2]; return qq; };
  for (let it = 0; it < 40; it++) {
    const r = fly(setQ(q), false);
    if (Math.hypot(...r) < 1e-3) break;
    const d = [1e-4, 1e-6, 100];
    const J = d.map((dd, j) => { const qq = q.slice(); qq[j] += dd; const rr = fly(setQ(qq), false); return rr.map((v, i) => (v - r[i]) / dd); });
    const step = solveN(r.map((_, i) => J.map((col) => col[i])), r.map((v) => -v));
    for (let j = 0; j < 3; j++) q[j] += step[j];
  }
  fly(setQ(q), true);
  SHIP_STEERING.e0 = q[0]; SHIP_STEERING.c = q[1];
  SHIP_STEERING.cutoffSpeed = V_CUT;
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
// centre three then set it down in the arms on a quintic per axis that matches position,
// velocity and acceleration at both ends.
//
// It used to take Cd ≈ 0,9 as given and solve only the burns. That booster was still at
// Mach 2,3, 5 km up, when its landing burn lit, and crossed Mach 1 seven seconds into the
// burn — the opposite order to every flight that has called it — and it kept the thirteen
// engines lit until T+06:46,5, against the only reading there was of three at T+06:37.
//
// The model integrates the booster's centre of mass, 30 m up its axis, not its base: it flips
// about that point, as a free body does, instead of swinging 70 m of tank about its engines.
export const CATCH_BASE = 22;            // booster base held this far above the mount deck when caught
// The divert. SpaceX's photograph of flight 5's booster on final approach (Commons, "Starship
// Booster Return on Final Approach (54063904149).jpg") has it leaning ≈15° towards the tower a
// few hundred metres up: a booster aims its landing burn offshore of the tower and only diverts
// into the arms in the last seconds. So the burn here ends DIVERT metres out to sea of the axis
// (downrange, +x), and the centre three carry it across on a quintic that arrives at rest with no
// residual acceleration; the attitude follows the thrust that path needs. The distance is not
// published: ≈130 m is what makes the steepest lean of that path ≈15°, as photographed.
export const DIVERT = 130;
export const RETURN_ASSUMED = { mass: 250e3, diameter: 9, rho0: 1.225, scaleHeight: 8500, comOffset: 30, threeDecel: 1.6 };
export const TRANSONIC_LEAD = 5;   // cited: flight 7, transonic T+06:26, landing burn T+06:31
// ≈, NOT telemetry: an earlier external audit read the engine count off third-party (RGV)
// footage of flight 5 as 13 at T+6:30 and 3 by T+6:37. It has not been checked frame by frame
// against the original video; until it is, it stays approximate and is not re-timed.
// Seventeen seconds from the centre three to the arms, as the flight 5 reading had it (T+6:37 to
// T+6:54), carried over to V3's cited burn: ≈T+6:44 here.
export const BURN_THREE = EVENTS.catch - 17;
// V3 (Block 3) engine counts, from SpaceX's own flight summaries: flight 13's booster "completed
// the high thrust portion of the boostback burn with all 33 engines, the first time with a
// Super Heavy V3"; flight 14's relit for "the high-thrust portion of the landing burn" on the
// planned 13 "before down-selecting to five engines for trajectory fine-tuning, and then down
// to three" (spacex.com, flights 13 and 14; flight 14's page read directly on 30 Sep 2026,
// which adds that on the day 31 of the 33 and 11 of the 13 relit: the planned counts are shown).
// The ORDER is cited; how long each portion lasts is not published, so these two are ≈.
export const BOOSTBACK_33 = 10;    // ≈ s of the boostback on all 33 before the inner 13 carry on
/**
 * The booster's engine counts, the planned V3 sequence the animation shows against what flight 14
 * itself did, per spacex.com's flight 14 page (read 30 Sep 2026): 31 of the planned 33 relit for
 * the boostback (oxygen availability) and 11 of the planned 13 for the landing burn's start, then
 * five and three. Which engines did not relight is not published, so the animation, which ends in
 * a hypothetical catch, keeps the plan rather than invent which ones went dark.
 */
export const BOOSTER_COUNTS = {
  planned: { ascent: 33, hotStaging: 5, boostback: 33, boostbackInner: 13, landing: [13, 5, 3] },
  flight14: { ascent: 33, boostback: 31, landing: [11, 5, 3], src: 'https://www.spacex.com/launches/starship-flight-14' },
  shown: 'planned',
};
export const BURN_FIVE = BURN_THREE - 3;   // ≈ 13 → 5 engines, 3 s before the centre three
// The flip to boostback attitude, overlapping the throttle-up: V3 starts its boostback five
// seconds after staging (flight 14: 2:22 → 2:27), so the flip has to be done by then.
const FLIP_END = EVENTS.boostbackStart + 1.5;
const RETRO_BLEND = [EVENTS.boostbackEnd, EVENTS.boostbackEnd + 24];    // after the boostback: swing to engines-first

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
    while (t < EVENTS.end + 4) {
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
    return [(r.s[0] - DIVERT) / 1000, (r.s[1] - STOP_H) / 100, r.t - BURN_THREE, (r.trans ?? LB + 20) - TT];
  };
  // Seeded with the converged solution, so this normally takes one step to confirm it.
  let q = [-31.694321, -2.339211, 51.117445, 1.900502];
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
  // Resample onto a uniform table and append the final descent on the centre three: a quintic
  // per axis from the stop state to the arms (base 22 m over the mount, at rest) at the catch.
  const step = DT, t1 = EVENTS.end, n = Math.round((t1 - T0) / step) + 1;
  const tab = { step, n, x: new Float64Array(n), h: new Float64Array(n), vx: new Float64Array(n), vh: new Float64Array(n) };
  const Tf = EVENTS.catch - stop.t, [xs, hs, vxs, vhs] = stop.s, HT = CATCH_BASE + R;
  // Across to the axis: position, velocity and acceleration from the stop state (the burn's
  // own lateral deceleration at that instant) to rest with none left at the catch, so the
  // booster is upright in the arms.
  const [axs, ahs] = (() => { const d = [0, 0, 0, 0]; deriv(stop.t, stop.s, q, d); return [d[2], d[3]]; })();
  const quintic = (p0, v0, a0, u) => {
    const T = Tf, T2 = T * T, T3 = T2 * T;
    const c3 = (-20 * p0 - 12 * v0 * T - 3 * a0 * T2) / (2 * T3);
    const c4 = (30 * p0 + 16 * v0 * T + 3 * a0 * T2) / (2 * T3 * T);
    const c5 = (-12 * p0 - 6 * v0 * T - a0 * T2) / (2 * T3 * T2);
    return [
      p0 + v0 * u + a0 / 2 * u * u + c3 * u ** 3 + c4 * u ** 4 + c5 * u ** 5,
      v0 + a0 * u + 3 * c3 * u * u + 4 * c4 * u ** 3 + 5 * c5 * u ** 4,
      a0 + 6 * c3 * u + 12 * c4 * u * u + 20 * c5 * u ** 3,
    ];
  };
  const ax = new Float64Array(n), ah = new Float64Array(n);
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
      [tab.x[i], tab.vx[i], ax[i]] = quintic(xs, vxs, axs, u);
      // Vertically too, starting from the burn's own deceleration, so the thrust direction
      // (and the attitude that follows it) carries straight on from the burn.
      const [hh, vv, aa] = quintic(hs - HT, vhs, ahs, u);
      tab.h[i] = hh + HT; tab.vh[i] = vv; ah[i] = aa;
    } else { tab.x[i] = 0; tab.h[i] = HT; tab.vx[i] = 0; tab.vh[i] = 0; }
  }
  let apo = 0, apoT = T0, apoX = 0, vMax = 0, vMaxT = T0;
  for (let i = 0; i < n; i++) {
    if (tab.h[i] > apo) { apo = tab.h[i]; apoT = T0 + i * step; apoX = tab.x[i]; }
    const sp = Math.hypot(tab.vx[i], tab.vh[i]);
    if (T0 + i * step > BB1 && sp > vMax) { vMax = sp; vMaxT = T0 + i * step; }
  }
  const burnIdx = Math.round((LB - T0) / step);
  tab.ax = ax; tab.ah = ah;
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
  const falling = THREE.MathUtils.lerp(pB, retro, sst(t, RETRO_BLEND[0], RETRO_BLEND[1]));
  if (t <= RETURN.stop.t) return falling;
  // On the centre three the nose points along the thrust the divert needs: tilted towards the
  // tower as it starts across, back through upright as it brakes, and settled upright in the
  // last seconds, as the arms close. The burn's thrust already points along the retrograde, so
  // this carries straight on from it.
  const T = RETURN.tab, u = THREE.MathUtils.clamp((t - EVENTS.separation) / T.step, 0, T.n - 1);
  const i = Math.min(Math.floor(u), T.n - 2), f = u - i;
  const ax = T.ax[i] + (T.ax[i + 1] - T.ax[i]) * f, ah = T.ah[i] + (T.ah[i + 1] - T.ah[i]) * f;
  const thrust = Math.atan2(ax, ah + 9.81);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(falling, thrust, sst(t, RETURN.stop.t, RETURN.stop.t + 0.6)), 0, sst(t, EVENTS.catch - 5, EVENTS.catch - 0.5));
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
 * sound. The five engines that hold the stack through hot-staging do not shut down at
 * separation: they stay lit through the flip and the rest relight around them for the
 * boostback. The trajectory's own thrust model is returnThrottle's; this adds only
 * the centre engines' low thrust between the two, which the integration leaves out.
 */
export function boosterEngineThrottle(t) {
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
 * ring for the boostback (flight 7 relit 9 of 10); five (the centre 3 and two of the inner ring) through hot-staging.
 */
const CENTRE_3 = (1.02 + 0.62) / 4.48, INNER_13 = (2.48 + 0.62) / 4.48;
// Five: the centre three and two of the inner ring, so the column is about as wide as thirteen's.
const FIVE = 0.5 * (INNER_13 + CENTRE_3);
export function boosterSpread(t) {
  const sst = THREE.MathUtils.smoothstep;
  if (t < EVENTS.meco) return 1;
  if (t < EVENTS.boostbackStart) return FIVE;
  if (t <= EVENTS.boostbackEnd) return THREE.MathUtils.lerp(1, INNER_13, sst(t, EVENTS.boostbackStart + BOOSTBACK_33 - 0.5, EVENTS.boostbackStart + BOOSTBACK_33 + 0.5));
  if (t < BURN_FIVE - 0.25) return INNER_13;
  if (t < BURN_THREE - 0.25) return THREE.MathUtils.lerp(INNER_13, FIVE, sst(t, BURN_FIVE - 0.25, BURN_FIVE + 0.25));
  return THREE.MathUtils.lerp(FIVE, CENTRE_3, sst(t, BURN_THREE - 0.25, BURN_THREE + 0.25));
}

/** How many booster engines are running, in lighting order (centre 3, inner 10, outer 20). */
export function boosterLit(t) {
  if (t < EVENTS.ignition) return 0;
  // All 33 together on Block 3 (see boosterThrottle).
  if (t < EVENTS.liftoff) return 33;
  if (t < EVENTS.meco) return 33;
  if (t < EVENTS.boostbackStart) return 5;
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
/** Ship mass (kg) and thrust acceleration (m/s²) after separation, for the checks and the panel. */
export const shipMassAt = (t) => (t < EVENTS.separation ? null : sample(PROFILE.mass, t));
export const shipThrustAccelAt = (t) => (t < EVENTS.separation ? null : sample(PROFILE.acc, t));

// The moment the stack clears the tower is read off the integrated climb, not authored: the
// engines' exit plane has to rise from where it rests — BOOSTER_AFT under the deck, and the
// deck 13 m above the pad — past the ≈149,5 m tower top (FAA planning figure). It was a fixed T+12, by which time
// the curve already has the stack ~300 m up.
{
  const CLIMB = PAD.towerH - (PAD.deckTop - PAD.padY - BOOSTER_AFT);   // ≈, PAD_FIGURES.towerH (FAA, 2022)
  let t = EVENTS.liftoff;
  while (altitudeAt(t) < CLIMB && t < 60) t += 0.05;
  EVENTS.towerClear = Math.round(t * 10) / 10;
}

/**
 * Booster throttle. Rated thrust until the throttle-down through Max-Q, back up, then the
 * shutdown to the three centre engines that hold the stack steady through hot-staging.
 */
export function boosterThrottle(t) {
  if (t < EVENTS.ignition) return 0;
  if (t < EVENTS.liftoff) {
    // Block 3 lights all 33 at once: the new 50 m transfer tube and plumbing let "SpaceX ignite
    // all 33 Raptor 3 engines simultaneously" (NASASpaceflight, "Super Heavy Block 3", May 2026),
    // where Block 1 and 2 started the inner three, then the middle ten, then the outer twenty.
    // Thrust comes up over about a second and a half — each engine's own start-up transient,
    // with a little spread between them (≈) — and the stack sits on the clamps at full thrust
    // before they let go at T−0.
    const u = THREE.MathUtils.clamp((t - EVENTS.ignition) / (EVENTS.liftoff - EVENTS.ignition), 0, 1);
    return THREE.MathUtils.smoothstep(u, 0.05, 0.55);
  }
  // The throttle bucket: down over the 16 s before Max-Q, back up over the 20 s after it; then
  // the last 8 s before MECO shut the cluster down to the five that stay lit through staging.
  const q0 = EVENTS.maxQ - 16, q1 = EVENTS.maxQ + 20, m0 = EVENTS.meco - 8;
  if (t < q0) return 1;
  if (t < EVENTS.maxQ) return 1 - 0.28 * THREE.MathUtils.smoothstep(t, q0, EVENTS.maxQ);
  if (t < q1) return 0.72 + 0.28 * THREE.MathUtils.smoothstep(t, EVENTS.maxQ, q1);
  if (t < m0) return 1;
  if (t < EVENTS.meco) return 1 - 0.9 * THREE.MathUtils.smoothstep(t, m0, EVENTS.meco);
  // Five engines "at reduced throttle" hold the stack through separation (Wikipedia, SpaceX
  // Starship, flight profile; flight 12: "just before hot staging, the booster purposely went
  // down to five engines"). 0,1 of the cluster is five of 33 at ≈65 % (≈: the throttle is not
  // given).
  if (t < EVENTS.separation + 3) return 0.1;
  return Math.max(0, 0.1 - 0.1 * THREE.MathUtils.smoothstep(t, EVENTS.separation + 3, EVENTS.separation + 7));
}
/** The ship lights through the vented hot-stage section a moment before it separates. */
export function shipThrottle(t) {
  if (t < EVENTS.separation - 1.5) return 0;
  return THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation + 1.5)
    * (1 - THREE.MathUtils.smoothstep(t, EVENTS.shipCutoff - 1, EVENTS.shipCutoff));
}

/** Ship engines running: none until hot-staging, then its three sea-level Raptors and three
 *  vacuum Raptors together (flight 7: "Starship engine ignition and stage separation"). */
export const shipLit = (t) => (shipThrottle(t) > 0.01 ? 6 : 0);

/**
 * Local speed of sound on the 1976 US Standard Atmosphere's temperature profile (troposphere
 * lapse, the isothermal tropopause, the two stratospheric gradients), a = √(γ·R·T).
 */
export function soundSpeedAt(h) {
  // USSA 1976 temperature layers on the height as given (≈: geometric height used as geopotential,
  // under 1 % off below 86 km). Above 47 km it used to stay at 270.65 K into space; the mesosphere
  // cools to ≈187 K at 86 km (audit of 9-11-2026, M8), held there above.
  const T = h < 11000 ? 288.15 - 0.0065 * h
    : h < 20000 ? 216.65
    : h < 32000 ? 216.65 + 0.001 * (h - 20000)
    : h < 47000 ? 228.65 + 0.0028 * (h - 32000)
    : h < 51000 ? 270.65
    : h < 71000 ? 270.65 - 0.0028 * (h - 51000)
    : h < 84852 ? 214.65 - 0.002 * (h - 71000) : 186.946;
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
 * Every milestone the panel calls out, in order. `src` says where the event comes from: SpaceX's
 * published flight 14 timeline ('f14'), this model ('model', its time shown ≈), or this
 * demonstration's own scenario ('scenario': an event flight 14 did not have, at a time taken from
 * one it did, `timeFrom`).
 */
export const MILESTONES = [
  { t: EVENTS.goForLaunch, label: 'GO for launch', src: 'f14' },
  { t: EVENTS.deflector, label: 'Flame diverter active', src: 'f14' },
  { t: EVENTS.ignition, label: 'Booster engine startup', src: 'f14' },
  { t: EVENTS.liftoff, label: 'Liftoff', src: 'f14' },
  { t: EVENTS.towerClear, label: 'Tower cleared', src: 'model' },
  ...(DERIVED.supersonic ? [{ t: DERIVED.supersonic, label: 'Supersonic', src: 'model' }] : []),
  { t: EVENTS.maxQ, label: 'Max-Q', src: 'f14' },
  { t: EVENTS.meco, label: 'MECO', src: 'f14' },
  { t: EVENTS.separation, label: 'Hot-staging', src: 'f14' },
  { t: EVENTS.boostbackStart, label: 'Boostback burn', src: 'f14' },
  { t: EVENTS.boostbackEnd, label: 'Boostback shutdown', src: 'f14' },
  { t: DERIVED.apogee, label: 'Booster apogee', src: 'model' },
  // The crossing is the model's own. What is cited is the interval: the drag is solved so it
  // falls five seconds before the landing burn, as flight 7's did (T+6:26, burn T+6:31) — no
  // V3 timeline calls it. `tunedTo` keeps that apart from where the time comes from.
  ...(DERIVED.transonic ? [{ t: DERIVED.transonic, label: 'Booster transonic', src: 'model', tunedTo: 'f7' }] : []),
  { t: EVENTS.landingBurn, label: 'Landing burn', src: 'f14' },
  // Flight 14's landing burn shutdown, T+7:01; the catch at that moment is this demonstration's
  // hypothesis, not flight 14's (its booster came down in the Gulf): the action is the scenario's,
  // only its time is flight 14's.
  { t: EVENTS.catch, label: 'Booster caught (hypothetical)', src: 'scenario', timeFrom: 'f14' },
  { t: EVENTS.shipCutoff, label: 'Starship engine cutoff', src: 'f14' },
].sort((a, b) => a.t - b.t);

/** Engine layouts for the panel's engine dials, in lighting order. */
export const ENGINE_LAYOUT = {
  booster: BOOSTER_RINGS.map((ring) => ({ n: ring[0], r: ring[1], phase: ring[3], angles: ring[4] ?? null, size: RAPTOR_EXIT_R })),
  ship: [{ n: 3, r: 0.95, phase: 0, size: RAPTOR_EXIT_R }, { n: 3, r: 3.05, phase: Math.PI / 3, size: 1.15 }],
};

const PHASES = [
  [EVENTS.goForLaunch, 'Terminal count'],
  [EVENTS.deflector, 'GO for launch'],
  [EVENTS.ignition, 'Flame diverter active'],
  [EVENTS.liftoff, 'Booster engine startup'],
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
  [EVENTS.shipCutoff, 'Booster in the arms · Starship still burning'],
  [Infinity, 'Starship engine cutoff · coasting'],
];
export const phaseAt = (t) => (PHASES.find(p => t < p[0]) ?? PHASES[PHASES.length - 1])[1];

// =========================================================================================
