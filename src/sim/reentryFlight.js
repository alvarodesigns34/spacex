/**
 * Starship's re-entry on flight 14, as a trajectory: pure functions, solved once at load, the
 * way the ascent and the booster's return are (launch.js).
 *
 * CITED — SpaceX's published flight 14 timeline (spacex.com, "Starship Flight 14", 28 Sep
 * 2026): deorbit burn T+8:52:37–8:52:48 on one sea-level Raptor; entry T+9:28:56; transonic
 * T+9:47:29; subsonic T+9:48:07; landing burn start T+9:50:11; landing flip T+9:50:13; three
 * to two engines T+9:50:21; two to one T+9:50:28; splashdown ("an exciting landing!")
 * T+9:50:30, on target in the northern Pacific, the landing burn relighting all three
 * sea-level Raptors.
 *
 * DERIVED — the state at entry. The orbit's altitude and the ship's mass are not published,
 * so they are assumed (ENTRY_ASSUMED, ≈): a 200 km circular orbit and ≈190 t after the
 * payload deploy; the 11 s burn on one 250 tf Raptor lowers the velocity by F·t/m ≈ 142 m/s
 * and vis-viva gives the speed and the flight-path angle at the 120 km entry interface
 * (≈7,74 km/s, ≈−1,6°).
 *
 * SOLVED — by Newton iteration, three coefficients that make the model meet the cited times:
 * the drag area per unit mass in the hypersonic, belly-first attitude, its lift-to-drag
 * ratio, and the drag area per unit mass once it falls flat (the "belly flop"), such that it
 * crosses Mach 1 at the transonic call, Mach 0,8 at the subsonic call (≈ — which Mach the
 * calls mean is not published), and reaches the landing-burn start at the height from which
 * a smooth 19 s burn stops it at the water. The results — peak heating, the belly-flop's
 * terminal speed — are consequences, not telemetry.
 *
 * Model: a point mass over a spherical, non-rotating Earth (downrange arc s, altitude h, the
 * horizontal and vertical velocity), gravity falling with height, drag and lift from an
 * exponential atmosphere with two scale heights (≈), the speed of sound from the 1976
 * standard atmosphere (launch.js soundSpeedAt). The lift is banked out of the vertical plane
 * whenever all of it would make the ship climb (≈, the equilibrium glide entry guidance
 * flies; SpaceX publishes no bank profile), so the descent never skips back up. The burn is a
 * quintic in each axis, matched in position and velocity at its start, from zero acceleration
 * (the belly flop is at its terminal speed there: ≈0,5 m/s² is left, which the quintic drops),
 * and ending at rest on the water with no acceleration left.
 */
import { soundSpeedAt } from './launch.js';

const hms = (h, m, s) => h * 3600 + m * 60 + s;
export const RE = {
  deorbitStart: hms(8, 52, 37), deorbitEnd: hms(8, 52, 48),
  entry: hms(9, 28, 56), transonic: hms(9, 47, 29), subsonic: hms(9, 48, 7),
  landingBurn: hms(9, 50, 11), flip: hms(9, 50, 13), twoEngines: hms(9, 50, 21), oneEngine: hms(9, 50, 28),
  splash: hms(9, 50, 30),
};
/** The chapter the visitor watches: from half a minute before entry to after the splash. */
export const CHAPTER = { start: RE.entry - 30, end: RE.splash + 25 };

export const ENTRY_ASSUMED = { orbitAltitude: 200e3, mass: 190e3, deorbitThrust: 2.4517e6, interface: 120e3 };
const MU = 3.986004418e14, RE_M = 6371e3;

/** Air density, kg/m³: 8,5 km scale height to 25 km, 6,8 km above (≈, a two-piece fit). */
export function densityAt(h) {
  if (h < 25000) return 1.225 * Math.exp(-Math.max(h, 0) / 8500);
  return 1.225 * Math.exp(-25000 / 8500) * Math.exp(-(h - 25000) / 6800);
}

/** Speed and flight-path angle at the entry interface, from the orbit and the deorbit burn. */
export function entryState() {
  const { orbitAltitude, mass, deorbitThrust, interface: hI } = ENTRY_ASSUMED;
  const r0 = RE_M + orbitAltitude, v0 = Math.sqrt(MU / r0);
  const dv = deorbitThrust / mass * (RE.deorbitEnd - RE.deorbitStart);
  const va = v0 - dv;                              // at apoapsis after the burn
  const a = 1 / (2 / r0 - va * va / MU);
  const r = RE_M + hI, v = Math.sqrt(MU * (2 / r - 1 / a));
  const gamma = -Math.acos(Math.min(1, (r0 * va) / (r * v)));
  return { h: hI, v, gamma, dv };
}

const ST = entryState();

/**
 * Flies q = [hypersonic drag area / mass (m²/kg), L/D, belly-flop drag area / mass] from
 * entry to the landing-burn start. Returns the crossing times of Mach 1 and 0,8, the state at
 * the burn, and (with rec) the whole record.
 */
function fly(q, rec) {
  const [k1, ld, k2] = q;
  let t = RE.entry, s = 0, h = ST.h, vx = ST.v * Math.cos(ST.gamma), vh = ST.v * Math.sin(ST.gamma);
  let m1 = null, m08 = null, prevM = Infinity;
  const DT = 0.05;
  const deriv = (t, h, vx, vh) => {
    const r = RE_M + h, v = Math.hypot(vx, vh) || 1e-6;
    const rho = densityAt(h);
    // Belly-first at hypersonic speed, flat once subsonic: the drag coefficient blends over
    // the transonic band and the lift goes with it (a flat plate falling has none to speak of).
    const M = v / soundSpeedAt(h);
    const w = Math.min(1, Math.max(0, (1.1 - M) / 0.4));
    const k = k1 + (k2 - k1) * w, L = ld * (1 - w);
    const D = 0.5 * rho * v * v * k;
    // Bank: the lift vector is rolled out of the vertical plane just enough that it never lifts
    // the ship into a climb — the equilibrium glide entry guidance flies. With the whole lift
    // kept vertical, a constant L/D skipped: 117 → 76 → 81 km, the heating falling and rising.
    // The rolled-out component goes to cross-range, which a 2-D model does not follow.
    const noLift = -D * vh / v - MU / (r * r) + vx * vx / r, up = L * D * vx / v;
    // Allowed: pulling out of the dive (vh towards 0 over ≈30 s, ≈); never climbing.
    const cap = -vh / 30;
    const c = up > 1e-9 && noLift + up > cap ? Math.max(-1, Math.min(1, (cap - noLift) / up)) : 1;
    const ax = -D * vx / v - c * L * D * vh / v - vx * vh / r;
    const ah = noLift + c * up;
    return [vx * RE_M / r, vh, ax, ah];
  };
  while (t < RE.landingBurn - 1e-9) {
    const dt = Math.min(DT, RE.landingBurn - t);
    const k1_ = deriv(t, h, vx, vh);
    const k2_ = deriv(t + dt / 2, h + k1_[1] * dt / 2, vx + k1_[2] * dt / 2, vh + k1_[3] * dt / 2);
    const k3_ = deriv(t + dt / 2, h + k2_[1] * dt / 2, vx + k2_[2] * dt / 2, vh + k2_[3] * dt / 2);
    const k4_ = deriv(t + dt, h + k3_[1] * dt, vx + k3_[2] * dt, vh + k3_[3] * dt);
    s += dt / 6 * (k1_[0] + 2 * k2_[0] + 2 * k3_[0] + k4_[0]);
    h += dt / 6 * (k1_[1] + 2 * k2_[1] + 2 * k3_[1] + k4_[1]);
    vx += dt / 6 * (k1_[2] + 2 * k2_[2] + 2 * k3_[2] + k4_[2]);
    vh += dt / 6 * (k1_[3] + 2 * k2_[3] + 2 * k3_[3] + k4_[3]);
    t += dt;
    const M = Math.hypot(vx, vh) / soundSpeedAt(h);
    if (m1 === null && prevM > 1 && M <= 1) m1 = t - dt * (1 - prevM) / (M - prevM);
    if (m08 === null && prevM > 0.8 && M <= 0.8) m08 = t - dt * (0.8 - prevM) / (M - prevM);
    prevM = M;
    if (rec) rec.push([t, s, h, vx, vh]);
    if (h < -50) break;
  }
  return { m1, m08, s, h, vx, vh };
}

const BURN_T = RE.splash - RE.landingBurn;
const residual = (q) => {
  const r = fly(q);
  // The burn is a quintic from (h, vh) to rest with no acceleration at either end, which
  // covers v·T/2: the height has to be that.
  return [((r.m1 ?? RE.landingBurn + 60) - RE.transonic) / 10, ((r.m08 ?? RE.landingBurn + 60) - RE.subsonic) / 10, (r.h - (-r.vh) * BURN_T / 2) / 100];
};

function solve3(A, b) {
  const m = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
    [m[i], m[p]] = [m[p], m[i]];
    for (let k = i + 1; k < 3; k++) { const f = m[k][i] / m[i][i]; for (let c = i; c <= 3; c++) m[k][c] -= f * m[i][c]; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let v = m[i][3]; for (let c = i + 1; c < 3; c++) v -= m[i][c] * x[c]; x[i] = v / m[i][i]; }
  return x;
}

export const SOLVE = { iterations: 0, residual: null };
const Q = (() => {
  // Seeded with the converged solution; the loop then only confirms it.
  let q = [0.0037322123456632827, 0.7171587516330207, 0.002357370799899564];
  const scale = [1e-4, 0.01, 1e-4];
  for (let it = 0; it < 40; it++) {
    SOLVE.iterations = it;
    const r0 = residual(q), n0 = Math.hypot(...r0);
    SOLVE.residual = n0;
    if (n0 < 1e-3) break;
    const J = q.map((_, j) => { const qq = q.slice(); qq[j] += scale[j]; return residual(qq).map((v, i) => (v - r0[i]) / scale[j]); });
    const d = solve3(r0.map((_, i) => J.map(col => col[i])), r0.map(v => -v));
    let lam = 1, moved = false;
    while (lam > 1e-4) {
      const qn = q.map((v, j) => Math.max(v * 0.2, v + lam * d[j]));
      if (Math.hypot(...residual(qn)) < n0) { q = qn; moved = true; break; }
      lam /= 2;
    }
    if (!moved) break;
  }
  return q;
})();

// ---- The table the scene reads --------------------------------------------------------
const REC = [];
const END = fly(Q, REC);
const STEP = 0.05;
const T0 = RE.entry, NT = Math.round((CHAPTER.end - T0) / STEP) + 1;
const TAB = { s: new Float64Array(NT), h: new Float64Array(NT), vx: new Float64Array(NT), vh: new Float64Array(NT), ax: new Float64Array(NT), ah: new Float64Array(NT) };
{
  // The burn: a quintic per axis from the state at its start to rest at the splash.
  const quint = (p0, v0, a0, T, u) => {
    const T2 = T * T, T3 = T2 * T;
    const c3 = (-20 * p0 - 12 * v0 * T - 3 * a0 * T2) / (2 * T3);
    const c4 = (30 * p0 + 16 * v0 * T + 3 * a0 * T2) / (2 * T3 * T);
    const c5 = (-12 * p0 - 6 * v0 * T - a0 * T2) / (2 * T3 * T2);
    return [p0 + v0 * u + a0 / 2 * u * u + c3 * u ** 3 + c4 * u ** 4 + c5 * u ** 5,
      v0 + a0 * u + 3 * c3 * u * u + 4 * c4 * u ** 3 + 5 * c5 * u ** 4,
      a0 + 6 * c3 * u + 12 * c4 * u * u + 20 * c5 * u ** 3];
  };
  let j = 0;
  for (let i = 0; i < NT; i++) {
    const t = T0 + i * STEP;
    if (t <= RE.landingBurn) {
      while (j < REC.length - 2 && REC[j + 1][0] < t) j++;
      const a = REC[j], b = REC[j + 1] ?? a;
      const f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
      TAB.s[i] = a[1] + (b[1] - a[1]) * f; TAB.h[i] = a[2] + (b[2] - a[2]) * f;
      TAB.vx[i] = a[3] + (b[3] - a[3]) * f; TAB.vh[i] = a[4] + (b[4] - a[4]) * f;
      if (i > 0) { TAB.ax[i] = (TAB.vx[i] - TAB.vx[i - 1]) / STEP; TAB.ah[i] = (TAB.vh[i] - TAB.vh[i - 1]) / STEP; }
    } else if (t < RE.splash) {
      const u = t - RE.landingBurn;
      [TAB.s[i], TAB.vx[i], TAB.ax[i]] = quint(END.s - (END.s + END.vx * BURN_T / 2), END.vx, 0, BURN_T, u);
      TAB.s[i] += END.s + END.vx * BURN_T / 2;
      [TAB.h[i], TAB.vh[i], TAB.ah[i]] = quint(END.h, END.vh, 0, BURN_T, u);
    } else {
      TAB.s[i] = END.s + END.vx * BURN_T / 2; TAB.h[i] = 0; TAB.vx[i] = 0; TAB.vh[i] = 0; TAB.ax[i] = 0; TAB.ah[i] = 0;
    }
  }
}
/** Where the ship comes down: the arc length from the entry interface, metres. */
export const SPLASH_S = END.s + END.vx * BURN_T / 2;

function at(t) {
  const u = Math.min(NT - 1, Math.max(0, (t - T0) / STEP));
  const i = Math.min(Math.floor(u), NT - 2), f = u - i;
  const L = (A) => A[i] + (A[i + 1] - A[i]) * f;
  return { s: L(TAB.s), h: Math.max(0, L(TAB.h)), vx: L(TAB.vx), vh: L(TAB.vh), ax: L(TAB.ax), ah: L(TAB.ah) };
}

/** State at mission time t (before entry, the ship coasts down to the interface on its orbit). */
export function reentryState(t) {
  if (t < T0) {
    const dt = T0 - t;
    return { s: -ST.v * Math.cos(ST.gamma) * dt, h: ST.h - ST.v * Math.sin(ST.gamma) * dt, vx: ST.v * Math.cos(ST.gamma), vh: ST.v * Math.sin(ST.gamma), ax: 0, ah: 0 };
  }
  return at(t);
}
export const reentrySpeedAt = (t) => { const s = reentryState(t); return Math.hypot(s.vx, s.vh); };
export const reentryAltAt = (t) => reentryState(t).h;
/** Distance still to fly to the splash point, metres (negative once past it). */
export const toSplashAt = (t) => SPLASH_S - reentryState(t).s;

/** Convective heating index, Sutton–Graves form √ρ·v³, normalised to its peak (0..1). */
const HEAT_PEAK = (() => { let m = 0; for (let t = T0; t < RE.subsonic; t += 1) { const s = at(t); m = Math.max(m, Math.sqrt(densityAt(s.h)) * Math.hypot(s.vx, s.vh) ** 3); } return m; })();
export function heatingAt(t) {
  if (t >= RE.subsonic) return 0;
  const s = reentryState(t);
  return Math.sqrt(densityAt(s.h)) * Math.hypot(s.vx, s.vh) ** 3 / HEAT_PEAK;
}

/**
 * Body attitude, radians above the horizontal of the ship's long axis (the nose), in the
 * trajectory plane. Hypersonic: nose ≈60° above the velocity, belly into the flow (≈; the
 * angle is not published). Through the transonic band it settles flat — the belly flop —
 * and at the landing flip (cited, T+9:50:13) it swings nose-up over ≈4 s, with a small
 * overshoot, to stand on its engines for the last seconds.
 */
export const ENTRY_AOA = 60 * Math.PI / 180;
export function reentryPitchAt(t) {
  const s = reentryState(t);
  const gamma = Math.atan2(s.vh, Math.max(1e-3, s.vx));
  const M = Math.hypot(s.vx, s.vh) / soundSpeedAt(s.h);
  const w = Math.min(1, Math.max(0, (1.1 - M) / 0.4));
  // Entry: nose above the velocity by the angle of attack. Flat: body horizontal.
  const entry = gamma + ENTRY_AOA;
  let p = entry + (0 - entry) * (w * w * (3 - 2 * w));
  if (t > RE.flip) {
    const u = Math.min(1, (t - RE.flip) / 4.2);
    const e = 1 - Math.pow(1 - u, 3);
    p = p + (Math.PI / 2 - p) * e + 0.12 * Math.sin(Math.PI * u) * (1 - u);
  }
  // In the water a ≈50 m ship cannot stand on its engines: as on the filmed splashdowns it
  // stays upright a moment and then topples, falling faster as it goes, to lie on the sea
  // (≈ the timing).
  if (t > RE.splash + 1.5) {
    const u = Math.min(1, (t - RE.splash - 1.5) / 5);
    p = Math.PI / 2 - (Math.PI / 2 - 0.06) * u * u;
  }
  return p;
}

/** Sea-level Raptors burning: three from the landing burn start, then two, then one. */
export function reentryEnginesAt(t) {
  if (t < RE.landingBurn || t >= RE.splash) return 0;
  return t < RE.twoEngines ? 3 : t < RE.oneEngine ? 2 : 1;
}

export const MILESTONES_RE = [
  { t: RE.entry, label: 'Starship entry', src: 'f14' },
  { t: RE.transonic, label: 'Transonic', src: 'f14' },
  { t: RE.subsonic, label: 'Subsonic', src: 'f14' },
  { t: RE.landingBurn, label: 'Landing burn start', src: 'f14' },
  { t: RE.flip, label: 'Landing flip', src: 'f14' },
  { t: RE.twoEngines, label: 'Landing burn · 3 → 2 engines', src: 'f14' },
  { t: RE.oneEngine, label: 'Landing burn · 2 → 1 engine', src: 'f14' },
  { t: RE.splash, label: 'Splashdown', src: 'f14' },
];

/** The solved coefficients and derived figures, for the sheet and the checks. */
export function reentrySummary() {
  let peak = { t: T0, q: 0 };
  for (let t = T0; t < RE.subsonic; t += 1) { const q = heatingAt(t); if (q > peak.q) peak = { t, q }; }
  const flop = reentryState(RE.landingBurn - 1);
  return {
    q: Q.slice(), iterations: SOLVE.iterations, residual: SOLVE.residual, entry: { ...ST },
    peakHeating: { t: peak.t, altitude: reentryAltAt(peak.t), speed: reentrySpeedAt(peak.t) },
    burnStart: { altitude: reentryAltAt(RE.landingBurn), speed: Math.hypot(flop.vx, flop.vh) },
    range: SPLASH_S,
  };
}
