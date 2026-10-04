/**
 * The F-16A's flight model: six degrees of freedom, rigid body, on its wheels or in the air,
 * in the centre's own world (scene frame, metres, y up), with no change of scene anywhere.
 *
 * WHAT COMES FROM WHERE
 *  - Aerodynamics: Morelli's global polynomials of NASA TP-1538's wind-tunnel database
 *    (data/f16Aero.js), valid for Mach < 0.6, α −10…45°, β ±30°. Outside that the inputs are held
 *    at the edge of the fit (≈).
 *  - Mass and inertias: TP-1538 table I (20,500 lb), taken as the weight at engine start; the
 *    fuel then burns at the engine's specific consumption (CONFIG, ≈), the mass falling with it
 *    (the inertias held at table I's, ≈). The configuration flown is recorded (CONFIG): clean,
 *    no stores, the centre of gravity at 0.35 c̄.
 *  - Thrust: TP-1538 table VI, idle, military and maximum, 0–15,240 m, Mach 0.2–1.0.
 *  - Control system: TP-1538 appendix A for its structure and its published numbers (limits,
 *    actuators, the leading-edge flap's schedule, the α limiter, 308°/s roll-rate command, the
 *    rudder fade and the ARI's slope). The gains are tuned here, not published (≈).
 *  - Atmosphere: the 1976 US Standard Atmosphere to 86 km.
 *  - The Earth: the scene's ground is flat to the edge of its disc and falls away beyond it with
 *    the curvature (core/outerGround.js). The airplane's altitude is its height over the sea's
 *    surface beneath it, along that surface's normal, and gravity points down that normal and
 *    falls with height (geodesy(), H15): far out over the curved ground, flying level is flying
 *    level over the sea, not along the pad's plane.
 *  - Where the data stop: outside Morelli's fit (α, β) and above Mach 0.6 the model is
 *    extrapolated, and the state says so (s.domain, H16): the HUD shows it.
 *
 * APPROXIMATIONS (≈), all of them here and nowhere else:
 *  - Compressibility above Mach 0.6: the lift slope scaled by a DATCOM-type planform formula
 *    (aspect ratio 3.0) through the transonic range to linear supersonic theory with the tip
 *    correction, and a wave-drag
 *    rise of ≈0.028 in C_D0 centred near Mach 1. The public F-16 data stop at Mach 0.6 (TP-1538)
 *    and start again at 1.6 (TP-3355); between them nothing is published.
 *  - Thrust beyond Mach 1.0 extrapolated on table VI's last slope, tapering (to Mach 2.0), below Mach 0.2
 *    held at its 0.2 value, above 15,240 m scaled with the air's density.
 *  - Engine spool: ≈4 s from idle to military, ≈1.5 s to light the afterburner.
 *  - Gear: struts as spring–dampers, tyre friction, brakes and nose-wheel steering, with
 *    plausible stiffness, damping and friction. Gear drag ≈0.015, speed-brake drag ≈0.06.
 *  - Control-system gains, washouts and filters: tuned here (tools/f16-check.mjs flies the
 *    cases). Two loops are not in TP-1538: a roll-coupling compensation in pitch and sideslip
 *    feedback standing in for its lateral-acceleration loop.
 *  - The gear fails above ≈8 times a strut's static load (≈5 m/s of sink); the nozzle's lip
 *    strikes the ground at ≈14.5° of pitch on the static gear.
 *  - Wind (core/wind.js, passed in as `wind`): the aerodynamics see the air's velocity, the
 *    wheels and the ground the airplane's own; the HUD's airspeed is the air's, the ground speed
 *    the airplane's. The checks fly in still air unless they pass a wind.
 *  - Ground effect, from the wing's height over the ground h against its span b: the induced
 *    drag falls by McCormick's factor φ = (16h/b)² / (1 + (16h/b)²), and the lift slope rises as
 *    for a wing of aspect ratio A/φ (Helmbold's low-aspect-ratio formula, A = 3.0): ≈ +6 % of
 *    lift and ≈ −11 % of induced drag on the runway (h/b ≈ 0.18), nothing above one span. The
 *    pitching moment's change near the ground is not modelled (≈). Oswald's e ≈ 0.8.
 *  - The Earth does not rotate.
 */
import * as THREE from 'three';
import { morelli, MORELLI, MORELLI_RANGE, THRUST, FCS } from '../data/f16Aero.js';
import { WING, MASS, GEAR, MODEL, OVERALL } from '../data/f16.js';
import { curvatureDrop } from '../core/outerGround.js';
import { SEA_LEVEL } from '../core/f16Ground.js';
import { createF16Flcs, GAIN } from './f16Flcs.js';

export { GAIN };

const G0 = 9.80665, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * 1976 US Standard Atmosphere, its seven layers to 86 km (geopotential heights, close enough to
 * geometric ones at these altitudes: 0.3 % at 20 km), and isothermal above as a stated
 * extrapolation. Before, the stratosphere stopped at 20 km and every height above it read as 20 km.
 */
const ATM_LAYERS = (() => {
  const R = 287.05287, base = [0, 11000, 20000, 32000, 47000, 51000, 71000, 84852];
  const lapse = [-0.0065, 0, 0.001, 0.0028, 0, -0.0028, -0.002];
  const out = [];
  let T = 288.15, P = 101325;
  for (let i = 0; i < base.length; i++) {
    const L = lapse[i] ?? 0;
    out.push({ h: base[i], T, P, L });
    if (i === base.length - 1) break;
    const dh = base[i + 1] - base[i], T1 = T + L * dh;
    P = L === 0 ? P * Math.exp(-G0 * dh / (R * T)) : P * Math.pow(T1 / T, -G0 / (L * R));
    T = T1;
  }
  return out;
})();
export function atmosphere(h) {
  const R = 287.05287;
  const z = Math.max(-500, Number.isFinite(h) ? h : 0);
  let k = 0; while (k < ATM_LAYERS.length - 1 && z >= ATM_LAYERS[k + 1].h) k++;
  const { h: hb, T: Tb, P: Pb, L } = ATM_LAYERS[k];
  const T = Tb + L * (z - hb);
  const P = L === 0 ? Pb * Math.exp(-G0 * (z - hb) / (R * Tb)) : Pb * Math.pow(T / Tb, -G0 / (L * R));
  return { T, P, rho: P / (R * T), a: Math.sqrt(1.4 * R * T) };
}

/** Table VI at an altitude and Mach, interpolated; extrapolated as the header says (≈). */
function tableAt(tab, h, M) {
  const { alt, mach } = THRUST;
  const hh = clamp(h, 0, alt[alt.length - 1]);
  let i = 0; while (i < alt.length - 2 && hh > alt[i + 1]) i++;
  const th = (hh - alt[i]) / (alt[i + 1] - alt[i]);
  const row = (k) => {
    const r = tab[k];
    if (M <= mach[0]) return r[0];
    if (M >= mach[mach.length - 1]) {
      // Beyond the table: its last slope, tapering as the fixed inlet's shock losses grow (≈).
      const n = mach.length - 1, slope = (r[n] - r[n - 1]) / (mach[n] - mach[n - 1]);
      const dM = Math.min(M, 2.0) - mach[n];
      return r[n] + slope * dM * (1 - 0.35 * dM);
    }
    let j = 0; while (j < mach.length - 2 && M > mach[j + 1]) j++;
    const t = (M - mach[j]) / (mach[j + 1] - mach[j]);
    return r[j] + (r[j + 1] - r[j]) * t;
  };
  return row(i) + (row(i + 1) - row(i)) * th;
}
const RHO_TOP = atmosphere(THRUST.alt[THRUST.alt.length - 1]).rho;
const R_EARTH = 6371000;
/**
 * Where the airplane is over the round Earth (H15): its altitude over the sea's surface beneath it
 * (along that surface's normal), and gravity there, pointing down the normal and falling with
 * height (g0·(R/(R+h))²). Inside the flat disc the normal is straight up.
 */
export function geodesy(x, y, z, out = { h: 0, g: 0, nx: 0, ny: 1, nz: 0 }) {
  const r = Math.hypot(x, z);
  const slope = r > 1 ? (curvatureDrop(r + 1) - curvatureDrop(r - 1)) / 2 : 0;
  const k = 1 / Math.sqrt(1 + slope * slope);
  out.h = (y - SEA_LEVEL + curvatureDrop(r)) * k;
  out.g = G0 * (R_EARTH / (R_EARTH + Math.max(out.h, -1000))) ** 2;
  out.nx = r > 1 ? slope * x / r * k : 0; out.ny = k; out.nz = r > 1 ? slope * z / r * k : 0;
  return out;
}
/**
 * The configuration flown (H20): clean (no stores, no tanks), the weight at engine start TP-1538's
 * 20,500 lb, of it ≈3,100 kg of internal fuel (≈: TP-1538 gives the weight, not its split), and
 * the engine's specific consumption at military power and in full afterburner (≈ for an F100
 * class turbofan; not published for this airplane here), so the mass falls as it flies.
 */
export const CONFIG = {
  tag: 'ESTIMATE', stores: 'clean', cg: MASS.cgRef, startMass: MASS.weight, fuel: 3100,
  tsfc: { idle: 0.9, mil: 0.73, max: 2.05 },   // kg per kgf·h (= lb per lbf·h)
};
/** Fuel flow, kg/s, at a power level and a thrust: the specific consumption blended across the range. */
export function fuelFlow(power, T) {
  const c = CONFIG.tsfc, k = power <= 50 ? c.idle + (c.mil - c.idle) * power / 50 : c.mil + (c.max - c.mil) * (power - 50) / 50;
  return k * (T / G0) / 3600;
}
/** Thrust, newtons, for an engine power level 0…100 (0 idle, 50 military, 100 full afterburner). */
export function thrust(power, h, M) {
  const idle = tableAt(THRUST.idle, h, M), mil = tableAt(THRUST.mil, h, M), max = tableAt(THRUST.max, h, M);
  let T = power <= 50 ? idle + (mil - idle) * power / 50 : mil + (max - mil) * (power - 50) / 50;
  const top = THRUST.alt[THRUST.alt.length - 1];
  if (h > top) T *= atmosphere(h).rho / RHO_TOP;
  return T;
}

/** Lift-slope factor relative to Mach 0.6, and the wave-drag rise (≈, see the header). */
const A = WING.span * WING.span / WING.area, TAN_HALF = Math.tan(Math.atan((WING.le(WING.semispan) + WING.ct / 2 - WING.leRoot - WING.cr / 2) / WING.semispan));
function subsonicSlope(M) {
  const b2 = 1 - M * M;
  return (2 * Math.PI * A) / (2 + Math.sqrt(4 + A * A * b2 * (1 + TAN_HALF * TAN_HALF / b2)));
}
const SLOPE06 = subsonicSlope(0.6);
export function compressibility(M) {
  let k = 1;
  if (M > 0.6) {
    // Supersonic: linear theory with the tip correction for a low-aspect-ratio planform.
    const sub = subsonicSlope(Math.min(M, 0.95)) / SLOPE06;
    const bm = Math.sqrt(Math.max(M, 1.3) ** 2 - 1);
    const sup = (4 / bm) * (1 - 1 / (2 * A * bm)) / SLOPE06;
    k = M < 0.95 ? sub : M > 1.3 ? sup : sub + (sup - sub) * sstep(0.95, 1.3, M);
  }
  const wave = 0.028 * sstep(0.85, 1.1, M) - 0.008 * sstep(1.2, 2.0, M);
  return { lift: k, wave };
}

// ---- The airframe in the model's frame (vehicles/f16.js: x forward, y up, z right; the nose
// probe's tip at x = 0, the ground at y = 0 on the static gear). The centre of gravity is the
// 0.35 c̄ moment reference, on the wing's waterline (≈: TP-1538 gives it along the chord only).
export const CG = new THREE.Vector3(-MODEL.mrc, -OVERALL.groundWL, 0);
const S = WING.area, BSPAN = WING.span, CBAR = WING.mac;
const W = MASS.weight * G0;   // TP-1538 table I: the reference the load factor and the struts are given against
// Body axes (x forward, y right, z down) from the model's (x forward, y up, z right).
const I = { x: MASS.ixx, y: MASS.iyy, z: MASS.izz, xz: MASS.ixz };
const DET = I.x * I.z - I.xz * I.xz;

/** The gear: contact points, each strut's share of the weight and its static compression. */
const NOSE_S = GEAR.nose.s, MAIN_S = GEAR.main.s;
const noseShare = (MAIN_S - MODEL.mrc) / (MAIN_S - NOSE_S);
const WHEELS = [
  { name: 'nose', p: new THREE.Vector3(-NOSE_S, 0, 0), load: W * noseShare, static: 0.10, steer: true },
  { name: 'left', p: new THREE.Vector3(-MAIN_S, 0, -GEAR.track / 2), load: W * (1 - noseShare) / 2, static: 0.12, brake: true },
  { name: 'right', p: new THREE.Vector3(-MAIN_S, 0, GEAR.track / 2), load: W * (1 - noseShare) / 2, static: 0.12, brake: true },
].map(w => {
  const k = w.load / w.static, m = w.load / G0;
  return { ...w, k, c: 2 * 0.7 * Math.sqrt(k * m), r: w.p.clone().sub(CG), travel: 0.30 };
});
/** Points that must never touch the ground or anything standing on it: touching is a crash. From
 *  the model: the nose, the belly, the nozzle's lip (≈14.5° of pitch on the static gear), the wing
 *  tips, the ventral fins' tips, the stabilators' tips, and (for what stands on the ground) the
 *  canopy's top and the fin's tip (≈ read off the model's side view). */
const HARD = [
  [0.0, 1.80, 0], [-4.6, 0.99, 0], [-8.0, 0.99, 0], [-12.5, 1.30, 0], [-14.6, 1.33, 0],
  [-10.6, 1.86, -4.57], [-10.6, 1.86, 4.57], [-11.1, 0.55, -0.80], [-11.1, 0.55, 0.80],
  [-14.0, 1.45, -2.6], [-14.0, 1.45, 2.6], [-4.6, 2.94, 0], [-14.0, 5.0, 0],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).sub(CG));

const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

/** A first-order actuator with a rate and position limit (TP-1538 appendix A's surfaces). */
function actuator({ limit, rate, tau }, lo = -limit) {
  return { x: 0, step(cmd, dt) {
    const want = clamp(cmd, lo, limit);
    const v = clamp((want - this.x) / tau, -rate, rate);
    this.x = clamp(this.x + v * dt, lo, limit);
    return this.x;
  } };
}

/**
 * Ground effect at a height h (m) of the wing over the ground: { lift, induced } — the factor on
 * the lift slope, and the share of the induced drag left (1, 1 out of it).
 */
export function groundEffect(h) {
  const b = BSPAN, A = WING.span ** 2 / WING.area;
  if (!(h > 0) || h >= b) return { lift: 1, induced: 1 };
  const k = (16 * h / b) ** 2, phi = k / (1 + k);
  const slope = (a) => 2 * Math.PI * a / (2 + Math.sqrt(a * a + 4));
  // Faded out towards one span, where it is negligible.
  const fade = 1 - sstep(0.6 * b, b, h);
  return { lift: 1 + (slope(A / phi) / slope(A) - 1) * fade, induced: 1 - (1 - phi) * fade };
}
const OSWALD = 0.8;

export function createF16Flight({ ground, solid = null, wind = null }) {
  // Each hard point's place at the last step, for the swept test against what stands on the ground.
  const hardPrev = HARD.map(() => Object.assign(new THREE.Vector3(), { valid: false }));
  // ground(x, z) → { h, hard: true on pavement, water: true on the sea }.
  const s = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(),
    w: new THREE.Vector3(),             // angular velocity, body axes (p, q, r), rad/s
    power: 0, powerCmd: 0, gear: 1, gearCmd: 1, sb: 0, sbCmd: 0,
    crashed: null, wow: true, t: 0,
    alpha: 0, beta: 0, mach: 0, tas: 0, nz: 1, load: 1, qbar: 0, alt: 0, agl: 0, thrust: 0,
    windV: new THREE.Vector3(), gs: 0, ge: 1,
    mass: CONFIG.startMass, fuel: CONFIG.fuel, flameout: false,
    // Where the model is outside its data (H16): α or β outside Morelli's fit, Mach above TP-1538's 0.6.
    domain: { alpha: false, beta: false, mach: false, out: false, tOut: 0 },
    g: G0,
    surfaces: { de: 0, da: 0, dr: 0, lef: 0, flap: 0, diff: 0 },
    wheels: WHEELS.map(() => ({ comp: 0, load: 0, anchor: null })),
  };
  const act = {
    de: actuator(FCS.stab), da: actuator(FCS.aileron), dr: actuator(FCS.rudder),
    lef: actuator({ limit: FCS.lef.limit, rate: FCS.lef.rate, tau: FCS.lef.tau }, 0),
  };
  // The flight control laws (f16Flcs.js), one instance per airplane.
  const flcs = createF16Flcs({ I, S, CBAR, cmDe: MORELLI.m[2] });
  const GEO = { h: 0, g: G0, nx: 0, ny: 1, nz: 0 };   // this airplane's own (never shared)
  // Scratch for the step, one set per airplane (no allocation in the 240 Hz loop; never shared
  // between two instances, so two airplanes cannot alias each other's temporaries).
  const X = {
    Fw: new THREE.Vector3(), Mw: new THREE.Vector3(), rw: new THREE.Vector3(), wW: new THREE.Vector3(),
    vp: new THREE.Vector3(), fwd: new THREE.Vector3(), side: new THREE.Vector3(), F: new THREE.Vector3(),
    d: new THREE.Vector3(), M: new THREE.Vector3(), wm: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0),
  };
  const input = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0, speedBrake: 0, gearDown: true };

  /** Model frame → world, and back, for a vector (no translation). */
  const toWorld = (v) => v.applyQuaternion(s.q);
  const toModel = (v) => v.applyQuaternion(tmpQ.copy(s.q).invert());
  const bodyFromModel = (m) => [m.x, m.z, -m.y];
  const modelFromBody = (bx, by, bz, out) => out.set(bx, -bz, by);

  /** Places the airplane at rest on its gear: cg at the world point over (x, z), yaw in rad. */
  function reset({ x, z, yaw = 0 }) {
    s.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const g = ground(x, z).h;
    s.pos.set(x, g, z).add(tmpV.copy(CG).applyQuaternion(s.q));
    s.vel.set(0, 0, 0); s.w.set(0, 0, 0);
    s.power = s.powerCmd = 0; s.gear = s.gearCmd = 1; s.sb = s.sbCmd = 0;
    for (const p of hardPrev) p.valid = false;
    s.crashed = null; s.t = 0; flcs.reset();
    s.mass = CONFIG.startMass; s.fuel = CONFIG.fuel; s.flameout = false;
    Object.assign(s.domain, { alpha: false, beta: false, mach: false, out: false, tOut: 0 });
    for (const k of Object.keys(act)) act[k].x = 0;
    Object.assign(input, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1, speedBrake: 0, gearDown: true });
    // Everything the last flight left in the telemetry and on the wheels goes too: before, a
    // reset airplane sat still on the runway reading Mach 0.6, 40 kN of thrust and no weight on
    // its wheels, and a wheel's brake anchor from the last stop held it to the old spot.
    Object.assign(s.surfaces, { de: 0, da: 0, dr: 0, lef: 0, flap: 20, diff: 0 });
    for (const w of s.wheels) Object.assign(w, { comp: 0, load: 0, anchor: null });
    s.wow = true; s.nz = 1; s.load = 1; s.thrust = thrust(0, s.pos.y, 0);
    s.alpha = 0; s.beta = 0; s.mach = 0; s.tas = 0; s.qbar = 0; s.windV.set(0, 0, 0); s.gs = 0; s.ge = 1;
    geodesy(s.pos.x, s.pos.y, s.pos.z, GEO); s.alt = GEO.h; s.g = GEO.g; s.agl = s.pos.y - g - CG.y;
    for (let i = 0; i < WHEELS.length; i++) s.wheels[i].load = WHEELS[i].load;
  }

  /** The air data: α, β, Mach, q̄ and the body-axis velocity — through the air, not over the ground. */
  function airData() {
    if (wind) wind(s.pos.x, Math.max(0, s.agl + CG.y), s.pos.z, s.t, s.windV); else s.windV.set(0, 0, 0);
    tmpV.copy(s.vel).sub(s.windV); toModel(tmpV);
    const [u, v, w] = bodyFromModel(tmpV);
    const V = Math.max(1e-3, Math.hypot(u, v, w));
    const atm = atmosphere(geodesy(s.pos.x, s.pos.y, s.pos.z, GEO).h);
    return { u, v, w, V, atm, alpha: Math.atan2(w, u), beta: Math.asin(clamp(v / V, -1, 1)), mach: V / atm.a, qbar: 0.5 * atm.rho * V * V };
  }

  function step(dt) {
    if (s.crashed) return;
    // A control input that is not a number (a lost gamepad axis, a bad key map) reads as neutral.
    for (const k of Object.keys(input)) if (typeof input[k] === 'number' && !Number.isFinite(input[k])) input[k] = 0;
    s.t += dt;
    const air = airData();
    // Engine: power lever 0…1 → power 0…100 (military at 0.77), with spool lag (≈).
    const thr = clamp(input.throttle, 0, 1);
    s.powerCmd = thr <= 0.77 ? 50 * thr / 0.77 : 50 + 50 * (thr - 0.77) / 0.23;
    const up = s.powerCmd > s.power;
    const tau = s.power < 50 || s.powerCmd < 50 ? (up ? 1.0 : 0.7) : 0.45;
    s.power += clamp((s.powerCmd - s.power) * dt / tau, -60 * dt, (s.power < 50 ? 25 : 60) * dt);
    if (Math.abs(s.powerCmd - s.power) < 0.01) s.power = s.powerCmd;
    // Out of fuel, the engine stops.
    if (s.fuel <= 0) { s.fuel = 0; s.flameout = true; s.power = 0; }
    s.thrust = s.flameout ? 0 : thrust(s.power, GEO.h, air.mach);
    if (!s.flameout) { const dm = fuelFlow(s.power, s.thrust) * dt; s.fuel -= dm; s.mass -= dm; }
    // Gear (≈ 6 s each way) and speed brakes (≈ 2 s).
    s.gearCmd = input.gearDown || s.wow ? 1 : 0;
    s.gear += clamp(s.gearCmd - s.gear, -dt / 6, dt / 6);
    s.sbCmd = clamp(input.speedBrake, 0, 1);
    s.sb += clamp(s.sbCmd - s.sb, -dt / 2, dt / 2);

    // Surfaces.
    const cmd = flcs.command(s, input, air, act, dt);
    const de = act.de.step(cmd.de, dt), da = act.da.step(cmd.da, dt), dr = act.dr.step(cmd.dr, dt), lef = act.lef.step(cmd.lef, dt);
    s.surfaces.de = de; s.surfaces.da = da; s.surfaces.dr = dr; s.surfaces.lef = lef;
    s.surfaces.diff = da / FCS.diffTail.ratio; s.surfaces.flap = s.gear > 0.5 ? 20 * s.gear : 0;

    // Aerodynamic forces and moments, body axes.
    const Fb = [0, 0, 0], Mb = [0, 0, 0];
    {
      const R = MORELLI_RANGE, d = s.domain;
      d.alpha = air.V > 20 && (air.alpha < R.alpha[0] || air.alpha > R.alpha[1]);
      d.beta = air.V > 20 && (air.beta < R.beta[0] || air.beta > R.beta[1]);
      d.mach = air.mach > 0.6;
      d.out = d.alpha || d.beta || d.mach;
      d.tOut = d.out ? d.tOut + dt : 0;
    }
    if (air.V > 1) {
      const R = MORELLI_RANGE;
      const al = clamp(air.alpha, R.alpha[0], R.alpha[1]), be = clamp(air.beta, R.beta[0], R.beta[1]);
      const [p, q, r] = [s.w.x, s.w.y, s.w.z];
      const c = morelli(al, be, de * D2R, da * D2R, dr * D2R, p * BSPAN / (2 * air.V), q * CBAR / (2 * air.V), r * BSPAN / (2 * air.V), { xcg: 0.35, cbar: CBAR, b: BSPAN });
      const comp = compressibility(air.mach);
      // The lift part of Cz scales with the lift slope; drag adds gear, speed brakes and waves.
      let Cz = c.Cz * comp.lift;
      let Cx = c.Cx - comp.wave - 0.015 * s.gear - 0.06 * s.sb;
      // Ground effect: in the wind axes, the lift up by the slope's factor, the induced drag
      // down by φ's; back to the body. (The wing's height: the CG's over the ground, ≈ the
      // wing's within a few tens of centimetres.)
      const ge = groundEffect(s.agl + CG.y);
      s.ge = ge.lift;
      if (ge.lift !== 1) {
        const ca = Math.cos(air.alpha), sa = Math.sin(air.alpha);
        const CL = -Cz * ca + Cx * sa, CD = -Cx * ca - Cz * sa;
        const CDi = CL * CL / (Math.PI * OSWALD * (BSPAN * BSPAN / S));
        const CL2 = CL * ge.lift, CD2 = CD - (1 - ge.induced) * CDi;
        Cz = -CL2 * ca - CD2 * sa; Cx = CL2 * sa - CD2 * ca;
      }
      const qs = air.qbar * S;
      Fb[0] = qs * Cx; Fb[1] = qs * c.Cy; Fb[2] = qs * Cz;
      // The pitching moment grows with the lift slope too, but less (≈: part of Cm is not lift).
      Mb[0] = qs * BSPAN * c.Cl; Mb[1] = qs * CBAR * c.Cm * (0.6 + 0.4 * comp.lift); Mb[2] = qs * BSPAN * c.Cn;
    }
    Fb[0] += s.thrust;
    // To the world.
    const Fw = modelFromBody(Fb[0], Fb[1], Fb[2], X.Fw);
    toWorld(Fw);
    // The aerodynamic load factor, body z (positive up), for the pitch law.
    s.nz = -Fb[2] / W;

    // Gear and hard points against the ground.
    s.wow = false;
    const Mw = X.Mw.set(0, 0, 0);       // ground moments, world
    let hit = null;
    if (s.gear > 0.98) {
      WHEELS.forEach((wh, i) => {
        // The strut's virtual tip: the tyre's contact point, extended by the static compression.
        tmpV.copy(wh.r).add(tmpW.set(0, -wh.static, 0)); toWorld(tmpV);
        const pt = tmpV.add(s.pos);
        const gnd = ground(pt.x, pt.z);
        const pen = gnd.h - pt.y;
        const ws = s.wheels[i];
        ws.comp = Math.max(0, pen); ws.load = 0;
        if (pen <= 0) return;
        if (gnd.water) { hit = 'water'; return; }
        if (pen > wh.static + wh.travel) { hit = 'gear'; return; }
        s.wow = true;
        // Velocity of the contact point (world).
        const rw = X.rw.copy(wh.r); toWorld(rw);
        const wWorld = modelFromBody(s.w.x, s.w.y, s.w.z, X.wW); toWorld(wWorld);
        const vp = X.vp.crossVectors(wWorld, rw).add(s.vel);
        const Fn = Math.max(0, wh.k * pen - wh.c * vp.y);
        ws.load = Fn;
        // A strut loaded past ≈8 times its share of the weight fails (≈ a sink rate of 5 m/s;
        // the F-16's gear is designed for about 3, with the usual margin above it).
        if (Fn > 8 * wh.load) { hit = 'gear'; return; }
        // Rolling direction: the airframe's x on the ground, turned by the nose-wheel steering.
        // The steering's reach falls with the speed so a turn asks at most ≈0.15 g of the tyres
        // (≈ a nose-wheel steering's own schedule): the jet's CG is 1.85 m up on a 2.36 m track,
        // statically it tips at ≈0.54 g, and its soft struts let it lean towards that well before
        // (at 0.3 g and 60 kt it went over).
        const fwd = X.fwd.set(1, 0, 0);
        const vGround = Math.hypot(s.vel.x, s.vel.z);
        const steerMax = Math.min(32 * D2R, Math.atan(0.15 * G0 * GEAR.wheelbase / Math.max(1, vGround * vGround)));
        // The pedals' full travel is 32° of the nose wheel, clipped by that reach: fast, a touch of
        // pedal steers (and the rudder, on the same pedals, barely moves).
        if (wh.steer) fwd.applyAxisAngle(X.Y, -clamp(input.yaw * 32 * D2R, -steerMax, steerMax));
        toWorld(fwd); fwd.y = 0; fwd.normalize();
        const side = X.side.set(-fwd.z, 0, fwd.x);
        const vl = vp.dot(fwd), vs = vp.dot(side);
        const mu = gnd.hard ? 0.02 : 0.07;
        const brake = wh.brake ? input.brake * (gnd.hard ? 0.5 : 0.3) : 0;
        const lim = (mu + brake) * Fn;
        let Fl;
        if (wh.brake && input.brake > 0.5 && Math.abs(vl) < 0.3) {
          // Held by the brakes: a stiff anchor where the wheel stopped, up to the tyre's grip.
          if (!ws.anchor) ws.anchor = pt.clone();
          const d = X.d.subVectors(pt, ws.anchor).dot(fwd);
          Fl = clamp(-60000 * d - 30000 * vl, -lim, lim);
          if (Math.abs(Fl) >= lim) ws.anchor = null;   // it skids
        } else {
          ws.anchor = null;
          Fl = -lim * Math.tanh(vl / 0.3);
        }
        // The side force from the tyre's slip angle, saturating at its grip (≈0.55 on a hard
        // surface, 0.35 on soft ground), and the two forces within the friction circle together.
        const muY = gnd.hard ? 0.55 : 0.35;
        const slipA = Math.atan2(vs, Math.max(Math.abs(vl), 0.5));
        let Fs = -muY * Fn * Math.tanh(slipA / (6 * D2R));
        const muT = Math.max(muY, mu + brake), Ft = Math.hypot(Fl, Fs);
        if (Ft > muT * Fn) { const k = muT * Fn / Ft; Fl *= k; Fs *= k; }
        const F = X.F.set(0, Fn, 0).addScaledVector(fwd, Fl).addScaledVector(side, Fs);
        Fw.add(F);
        Mw.add(X.M.crossVectors(rw, F));
      });
    }
    for (let i = 0; i < HARD.length; i++) {
      tmpV.copy(HARD[i]); toWorld(tmpV); tmpV.add(s.pos);
      const g = ground(tmpV.x, tmpV.z);
      if (tmpV.y < g.h) { hit = g.water ? 'water' : 'airframe'; break; }
      // Below a pool's surface (core/water.js): into the water.
      if (Number.isFinite(g.surface) && tmpV.y < g.surface) { hit = 'water'; break; }
      // Into something standing on the ground (core/colliders.js), along the step just flown.
      const prev = hardPrev[i];
      if (solid && prev.valid && solid(prev, tmpV)) { hit = 'structure'; break; }
      prev.copy(tmpV); prev.valid = true;
    }
    if (!hit && s.gear <= 0.98) {
      // With the gear in transit or up there is nothing to roll on: a belly landing if it came
      // down gently (≈ under 4 m/s of sink), else the airframe struck the ground; on the sea,
      // into the water.
      for (const wh of WHEELS) {
        tmpV.copy(wh.r); toWorld(tmpV); tmpV.add(s.pos);
        const g = ground(tmpV.x, tmpV.z);
        if (tmpV.y < g.h - 0.05) { hit = g.water ? 'water' : -s.vel.y > 4 ? 'airframe' : 'belly'; break; }
      }
    }
    if (hit) {
      const vs = -s.vel.y;
      s.crashed = { what: hit, speed: s.vel.length(), sink: vs, t: s.t };
      s.vel.set(0, 0, 0); s.w.set(0, 0, 0);
      return;
    }

    // The load factor the pilot feels: every force but gravity, along the airframe's up.
    s.load = Fw.dot(tmpV.set(0, 1, 0).applyQuaternion(s.q)) / W;
    // Translation.
    // Gravity down the normal of the sea beneath, falling with height (geodesy()).
    const acc = Fw.multiplyScalar(1 / s.mass);
    acc.x -= GEO.g * GEO.nx; acc.y -= GEO.g * GEO.ny; acc.z -= GEO.g * GEO.nz;
    s.vel.addScaledVector(acc, dt);
    s.pos.addScaledVector(s.vel, dt);

    // Rotation, Euler's equations in body axes with the cross product of inertia.
    const Mg = toModel(Mw);
    const [gl, gm, gn] = bodyFromModel(Mg);
    const Lm = Mb[0] + gl, Mm = Mb[1] + gm, Nm = Mb[2] + gn;
    const [p, q, r] = [s.w.x, s.w.y, s.w.z];
    const hx = I.x * p - I.xz * r, hy = I.y * q, hz = I.z * r - I.xz * p;
    const tx = Lm - (q * hz - r * hy), ty = Mm - (r * hx - p * hz), tz = Nm - (p * hy - q * hx);
    const pd = (I.z * tx + I.xz * tz) / DET, qd = ty / I.y, rd = (I.xz * tx + I.x * tz) / DET;
    s.w.x += pd * dt; s.w.y += qd * dt; s.w.z += rd * dt;
    const wm = modelFromBody(s.w.x, s.w.y, s.w.z, X.wm);
    const ang = wm.length() * dt;
    if (ang > 0) s.q.multiply(tmpQ.setFromAxisAngle(wm.normalize(), ang)).normalize();

    // Telemetry.
    const a2 = airData();
    s.alpha = a2.alpha * R2D; s.beta = a2.beta * R2D; s.mach = a2.mach; s.tas = a2.V; s.qbar = a2.qbar; s.gs = Math.hypot(s.vel.x, s.vel.z);
    geodesy(s.pos.x, s.pos.y, s.pos.z, GEO); s.alt = GEO.h; s.g = GEO.g; s.agl = s.pos.y - ground(s.pos.x, s.pos.z).h - (CG.y);
  }

  return {
    state: s, input, reset,
    /** Advances by `dt` seconds in n equal steps of at most 1/240 s (dt is kept whole; f16Fly caps it per frame). */
    advance(dt) { const n = Math.min(240, Math.ceil(dt * 240 - 1e-9)); for (let i = 0; i < n; i++) step(dt / n); },
    /** The airframe's pose for the visuals: the model origin's world position and the rotation. */
    pose(out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }) {
      out.quaternion.copy(s.q);
      out.position.copy(CG).applyQuaternion(s.q).negate().add(s.pos);
      return out;
    },
  };
}
