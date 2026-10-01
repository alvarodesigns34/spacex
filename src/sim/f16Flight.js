/**
 * The F-16A's flight model: six degrees of freedom, rigid body, on its wheels or in the air,
 * in the centre's own world (scene frame, metres, y up), with no change of scene anywhere.
 *
 * WHAT COMES FROM WHERE
 *  - Aerodynamics: Morelli's global polynomials of NASA TP-1538's wind-tunnel database
 *    (data/f16Aero.js), valid for Mach < 0.6, α −10…45°, β ±30°. Outside that the inputs are held
 *    at the edge of the fit (≈).
 *  - Mass and inertias: TP-1538 table I (20,500 lb). Constant: no fuel burn (≈).
 *  - Thrust: TP-1538 table VI, idle, military and maximum, 0–15,240 m, Mach 0.2–1.0.
 *  - Control system: TP-1538 appendix A for its structure and its published numbers (limits,
 *    actuators, the leading-edge flap's schedule, the α limiter, 308°/s roll-rate command, the
 *    rudder fade and the ARI's slope). The gains are tuned here, not published (≈).
 *  - Atmosphere: the 1976 US Standard Atmosphere to 20 km.
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
 *  - No ground effect, no wind, no fuel burn.
 */
import * as THREE from 'three';
import { morelli, MORELLI, MORELLI_RANGE, THRUST, FCS } from '../data/f16Aero.js';
import { WING, MASS, GEAR, MODEL, OVERALL } from '../data/f16.js';

const KBETA = -12;
/** The pitch law's gains (≈, tuned against tools/f16-check.mjs), per unit of the q̄ schedule. */
export const GAIN = { kp: 3, ki: 4.0, kq: 1.0 };
const G0 = 9.80665, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** 1976 US Standard Atmosphere, troposphere and the lower stratosphere (to 20 km). */
export function atmosphere(h) {
  const T0 = 288.15, P0 = 101325, L = 0.0065, R = 287.05287;
  const z = clamp(h, -500, 20000);
  let T, P;
  if (z < 11000) { T = T0 - L * z; P = P0 * Math.pow(T / T0, G0 / (L * R)); }
  else { T = 216.65; P = 22632.06 * Math.exp(-G0 * (z - 11000) / (R * T)); }
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
const S = WING.area, BSPAN = WING.span, CBAR = WING.mac, MASSKG = MASS.weight;
const W = MASSKG * G0;
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
/** Points that must never touch the ground: touching is a crash. From the model: the nose, the
 *  belly, the nozzle's lip (≈14.5° of pitch on the static gear), the wing tips, the ventral fins'
 *  tips and the stabilators' tips. */
const HARD = [
  [0.0, 1.80, 0], [-4.6, 0.99, 0], [-8.0, 0.99, 0], [-12.5, 1.30, 0], [-14.6, 1.33, 0],
  [-10.6, 1.86, -4.57], [-10.6, 1.86, 4.57], [-11.1, 0.55, -0.80], [-11.1, 0.55, 0.80],
  [-14.0, 1.45, -2.6], [-14.0, 1.45, 2.6],
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

export function createF16Flight({ ground }) {
  // ground(x, z) → { h, hard: true on pavement, water: true on the sea }.
  const s = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(),
    w: new THREE.Vector3(),             // angular velocity, body axes (p, q, r), rad/s
    power: 0, powerCmd: 0, gear: 1, gearCmd: 1, sb: 0, sbCmd: 0,
    crashed: null, wow: true, t: 0,
    alpha: 0, beta: 0, mach: 0, tas: 0, nz: 1, load: 1, qbar: 0, alt: 0, agl: 0, thrust: 0,
    surfaces: { de: 0, da: 0, dr: 0, lef: 0, flap: 0, diff: 0 },
    wheels: WHEELS.map(() => ({ comp: 0, load: 0, anchor: null })),
  };
  const act = {
    de: actuator(FCS.stab), da: actuator(FCS.aileron), dr: actuator(FCS.rudder),
    lef: actuator({ limit: FCS.lef.limit, rate: FCS.lef.rate, tau: FCS.lef.tau }, 0),
  };
  const ctl = { pitchI: 0, lefX: 0, ydX: 0, qLow: 0, nzF: 1 };
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
    s.crashed = null; s.t = 0; Object.assign(ctl, { pitchI: 0, lefX: 0, ydX: 0, qLow: 0, nzF: 1 });
    for (const k of Object.keys(act)) act[k].x = 0;
    Object.assign(input, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1, speedBrake: 0, gearDown: true });
  }

  /** The air data: α, β, Mach, q̄ and the body-axis velocity. */
  function airData() {
    tmpV.copy(s.vel); toModel(tmpV);
    const [u, v, w] = bodyFromModel(tmpV);
    const V = Math.max(1e-3, Math.hypot(u, v, w));
    const atm = atmosphere(s.pos.y);
    return { u, v, w, V, atm, alpha: Math.atan2(w, u), beta: Math.asin(clamp(v / V, -1, 1)), mach: V / atm.a, qbar: 0.5 * atm.rho * V * V };
  }

  /** The flight control system: pilot inputs → surface commands (TP-1538 appendix A, ≈ gains). */
  function fcs(air, dt) {
    const [p, q, r] = [s.w.x, s.w.y, s.w.z];
    const aDeg = air.alpha * R2D;
    const qn = Math.max(air.qbar, 800);                          // gain schedule floor (≈)
    const sched = clamp(12000 / qn, 0.15, 3.5);
    // Pitch: C* = Nz + (Vco/g)·q, the stick commanding load factor above 1 g, limited by the
    // α limiter (TP-1538: −0.322 g/deg from 15° to 20.4°, −1.322 g/deg above).
    const L = FCS.aoaLimiter;
    const nMax = 9 - L.slope1 * clamp(aDeg - L.start, 0, L.knee - L.start) - L.slope2 * Math.max(0, aDeg - L.knee);
    const st = input.pitch;
    let nCmd = 1 + (st >= 0 ? 8 * st : 4 * st);
    nCmd = Math.min(nCmd, Math.max(-3, nMax));
    const Vco = 122;
    let de;
    if (s.wow) {
      // On the wheels: a pitch-rate command; the integrator is held (no g to hold on the ground).
      // The stick moves the stabilators directly, damped by pitch rate, so the nose comes up
      // at the speed the pilot rotates at, not when a g command is met.
      ctl.pitchI = 0;
      de = -FCS.stab.limit * st + 3.0 * q * R2D;
    } else {
      // TP-1538: "washed-out pitch rate and filtered normal acceleration were fed back", with
      // a forward-loop integrator so the steady response matches the command. The washout
      // (≈ 1 s) leaves the pitch rate to damp the motion and the load factor to set it.
      ctl.qLow += (q - ctl.qLow) * dt / 1.0;
      ctl.nzF += (s.nz - ctl.nzF) * dt / 0.05;
      const cstar = ctl.nzF + (Vco / G0) * (q - ctl.qLow);
      const err = nCmd - cstar;
      ctl.pitchI = clamp(ctl.pitchI + err * dt, -10, 10);
      de = -(GAIN.kp * err + GAIN.ki * ctl.pitchI) * sched + GAIN.kq * q * R2D * Math.sqrt(sched);
      // Roll-coupling compensation (≈, not in TP-1538): the stabilators cancel the inertial
      // pitching moment −(Ix − Iz)pr − Ixz(p² − r²) of a fast roll before it shows as g.
      const mInert = -(I.x - I.z) * p * r - I.xz * (p * p - r * r);
      de += clamp(mInert / (Math.max(air.qbar, 500) * S * CBAR * -MORELLI.m[2]) * R2D, -10, 10);
    }
    // Roll: a roll-rate command up to 308°/s, aileron with 1° of differential tail per 4°.
    const pCmd = FCS.rollRateMax * D2R * (0.35 * input.roll + 0.65 * input.roll ** 3);
    const da = s.wow ? -input.roll * 10 : -(0.02 * pCmd + 1.6 * (pCmd - p)) * R2D * sched;
    // Yaw: pedal faded to zero from 20° to 30° α, a stability-axis yaw damper (r − pα) through a
    // washout, and the aileron–rudder interconnect (gain 0.075/deg of α).
    const fade = 1 - sstep(FCS.rudder.fade[0], FCS.rudder.fade[1], aDeg);
    const rs = r - p * air.alpha;
    ctl.ydX += (rs - ctl.ydX) * dt / 3.0;                        // 3 s washout (≈)
    const yd = s.wow ? 0 : 3.5 * (rs - ctl.ydX) * R2D * sched;
    const ari = s.wow ? 0 : clamp(FCS.ari.slope * Math.max(0, aDeg), 0, 1.5) * act.da.x;
    // Lateral acceleration feedback (TP-1538: "feedbacks of r − pα and ay"), here on sideslip,
    // which ay measures: it keeps β near zero through a fast roll, where p·β becomes α.
    const bf = s.wow ? 0 : KBETA * air.beta * R2D * sched;
    const dr = -30 * input.yaw * fade + yd + ari + bf;
    // Leading-edge flap: 1.38·(2s + 7.25)/(s + 7.25)·α − 9.05·q̄/ps + 1.45 (deg), 0…25°.
    const F = FCS.lef;
    ctl.lefX += (-F.pole * ctl.lefX + aDeg) * dt;
    const lead = 2 * aDeg - F.pole * ctl.lefX;
    const lef = s.wow ? 0 : F.k * lead - F.q * air.qbar / air.atm.P + F.bias;
    return { de, da, dr, lef };
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
    s.thrust = thrust(s.power, s.pos.y, air.mach);
    // Gear (≈ 6 s each way) and speed brakes (≈ 2 s).
    s.gearCmd = input.gearDown || s.wow ? 1 : 0;
    s.gear += clamp(s.gearCmd - s.gear, -dt / 6, dt / 6);
    s.sbCmd = clamp(input.speedBrake, 0, 1);
    s.sb += clamp(s.sbCmd - s.sb, -dt / 2, dt / 2);

    // Surfaces.
    const cmd = fcs(air, dt);
    const de = act.de.step(cmd.de, dt), da = act.da.step(cmd.da, dt), dr = act.dr.step(cmd.dr, dt), lef = act.lef.step(cmd.lef, dt);
    s.surfaces.de = de; s.surfaces.da = da; s.surfaces.dr = dr; s.surfaces.lef = lef;
    s.surfaces.diff = da / FCS.diffTail.ratio; s.surfaces.flap = s.gear > 0.5 ? 20 * s.gear : 0;

    // Aerodynamic forces and moments, body axes.
    const Fb = [0, 0, 0], Mb = [0, 0, 0];
    if (air.V > 1) {
      const R = MORELLI_RANGE;
      const al = clamp(air.alpha, R.alpha[0], R.alpha[1]), be = clamp(air.beta, R.beta[0], R.beta[1]);
      const [p, q, r] = [s.w.x, s.w.y, s.w.z];
      const c = morelli(al, be, de * D2R, da * D2R, dr * D2R, p * BSPAN / (2 * air.V), q * CBAR / (2 * air.V), r * BSPAN / (2 * air.V), { xcg: 0.35, cbar: CBAR, b: BSPAN });
      const comp = compressibility(air.mach);
      // The lift part of Cz scales with the lift slope; drag adds gear, speed brakes and waves.
      const Cz = c.Cz * comp.lift;
      const Cx = c.Cx - comp.wave - 0.015 * s.gear - 0.06 * s.sb;
      const qs = air.qbar * S;
      Fb[0] = qs * Cx; Fb[1] = qs * c.Cy; Fb[2] = qs * Cz;
      // The pitching moment grows with the lift slope too, but less (≈: part of Cm is not lift).
      Mb[0] = qs * BSPAN * c.Cl; Mb[1] = qs * CBAR * c.Cm * (0.6 + 0.4 * comp.lift); Mb[2] = qs * BSPAN * c.Cn;
    }
    Fb[0] += s.thrust;
    // To the world.
    const Fw = modelFromBody(Fb[0], Fb[1], Fb[2], new THREE.Vector3());
    toWorld(Fw);
    // The aerodynamic load factor, body z (positive up), for the pitch law.
    s.nz = -Fb[2] / W;

    // Gear and hard points against the ground.
    s.wow = false;
    const Mw = new THREE.Vector3();     // ground moments, world
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
        const rw = wh.r.clone(); toWorld(rw);
        const wWorld = modelFromBody(s.w.x, s.w.y, s.w.z, new THREE.Vector3()); toWorld(wWorld);
        const vp = new THREE.Vector3().crossVectors(wWorld, rw).add(s.vel);
        const Fn = Math.max(0, wh.k * pen - wh.c * vp.y);
        ws.load = Fn;
        // A strut loaded past ≈8 times its share of the weight fails (≈ a sink rate of 5 m/s;
        // the F-16's gear is designed for about 3, with the usual margin above it).
        if (Fn > 8 * wh.load) { hit = 'gear'; return; }
        // Rolling direction: the airframe's x on the ground, turned by the nose-wheel steering.
        const fwd = new THREE.Vector3(1, 0, 0);
        if (wh.steer) fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), -input.yaw * clamp(32 - air.V * 0.6, 5, 32) * D2R);
        toWorld(fwd); fwd.y = 0; fwd.normalize();
        const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const vl = vp.dot(fwd), vs = vp.dot(side);
        const mu = gnd.hard ? 0.02 : 0.07;
        const brake = wh.brake ? input.brake * (gnd.hard ? 0.5 : 0.3) : 0;
        const lim = (mu + brake) * Fn;
        let Fl;
        if (wh.brake && input.brake > 0.5 && Math.abs(vl) < 0.3) {
          // Held by the brakes: a stiff anchor where the wheel stopped, up to the tyre's grip.
          if (!ws.anchor) ws.anchor = pt.clone();
          const d = new THREE.Vector3().subVectors(pt, ws.anchor).dot(fwd);
          Fl = clamp(-60000 * d - 30000 * vl, -lim, lim);
          if (Math.abs(Fl) >= lim) ws.anchor = null;   // it skids
        } else {
          ws.anchor = null;
          Fl = -lim * Math.tanh(vl / 0.3);
        }
        const Fs = -clamp(vs * 8 * Fn / Math.max(1, Math.abs(vl) * 0.2 + 1), -0.7 * Fn, 0.7 * Fn);
        const F = new THREE.Vector3(0, Fn, 0).addScaledVector(fwd, Fl).addScaledVector(side, Fs);
        Fw.add(F);
        Mw.add(new THREE.Vector3().crossVectors(rw, F));
      });
    }
    for (const r of HARD) {
      tmpV.copy(r); toWorld(tmpV); tmpV.add(s.pos);
      const g = ground(tmpV.x, tmpV.z);
      if (tmpV.y < g.h) { hit = g.water ? 'water' : 'airframe'; break; }
    }
    if (s.gear <= 0.98) {
      // With the gear in transit or up there is nothing to roll on.
      for (const wh of WHEELS) {
        tmpV.copy(wh.r); toWorld(tmpV); tmpV.add(s.pos);
        if (tmpV.y < ground(tmpV.x, tmpV.z).h - 0.05) { hit = 'belly'; break; }
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
    const acc = Fw.multiplyScalar(1 / MASSKG); acc.y -= G0;
    s.vel.addScaledVector(acc, dt);
    s.pos.addScaledVector(s.vel, dt);

    // Rotation, Euler's equations in body axes with the cross product of inertia.
    const Mg = toModel(Mw.clone());
    const [gl, gm, gn] = bodyFromModel(Mg);
    const Lm = Mb[0] + gl, Mm = Mb[1] + gm, Nm = Mb[2] + gn;
    const [p, q, r] = [s.w.x, s.w.y, s.w.z];
    const hx = I.x * p - I.xz * r, hy = I.y * q, hz = I.z * r - I.xz * p;
    const tx = Lm - (q * hz - r * hy), ty = Mm - (r * hx - p * hz), tz = Nm - (p * hy - q * hx);
    const pd = (I.z * tx + I.xz * tz) / DET, qd = ty / I.y, rd = (I.xz * tx + I.x * tz) / DET;
    s.w.x += pd * dt; s.w.y += qd * dt; s.w.z += rd * dt;
    const wm = modelFromBody(s.w.x, s.w.y, s.w.z, new THREE.Vector3());
    const ang = wm.length() * dt;
    if (ang > 0) s.q.multiply(tmpQ.setFromAxisAngle(wm.normalize(), ang)).normalize();

    // Telemetry.
    const a2 = airData();
    s.alpha = a2.alpha * R2D; s.beta = a2.beta * R2D; s.mach = a2.mach; s.tas = a2.V; s.qbar = a2.qbar;
    s.alt = s.pos.y; s.agl = s.pos.y - ground(s.pos.x, s.pos.z).h - (CG.y);
  }

  return {
    state: s, input, reset,
    /** Advances by `dt` seconds in fixed 1/240 s steps. */
    advance(dt) { const n = Math.min(240, Math.ceil(dt * 240 - 1e-9)); for (let i = 0; i < n; i++) step(dt / n); },
    /** The airframe's pose for the visuals: the model origin's world position and the rotation. */
    pose(out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }) {
      out.quaternion.copy(s.q);
      out.position.copy(CG).applyQuaternion(s.q).negate().add(s.pos);
      return out;
    },
  };
}
