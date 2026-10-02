/**
 * The F-16's simple controls: what a second pilot (and the F-16's own Auto-GCAS) does for a
 * beginner, working the same stick, throttle, pedals, brakes and gear handle a pilot has. The
 * airplane and its control laws (f16Flight.js) are not touched. No browser here, so the checks
 * (tools/f16-check.mjs) fly it headless with the keys a visitor would press.
 *
 *  - W/S the throttle, as in the car: W opens it (held on the runway, to full afterburner), S
 *    closes it; at idle S is the wheel brakes on the ground and the speed brakes in the air.
 *  - ↑/↓ climb and descend: they move the flight path the airplane holds (to ±40°); let go and
 *    it keeps that path, climbing, level or diving.
 *  - A/D bank, to 60° (Shift 80°), and the airplane pulls the g the turn needs by itself; let go
 *    and the wings come level. On the ground they steer the nose wheel.
 *  - The take-off rotates by itself at 120 kt to 11° of pitch (never past 12°: the nozzle strikes
 *    at ≈14.5°), ↑/↓ trimming it by 1°; climbing away the gear comes up.
 *  - Gear down (G) and neither W nor S held, the throttle and the speed brakes hold the approach
 *    speed, 150 kt.
 *  - Protections: below 180 kt with the gear up, full power; heading for the ground (under 3 s,
 *    plus one for every 60 m/s, to impact; or below 300 ft with the gear up and coming down) the
 *    wings level and it pulls to a climb (Auto-GCAS, on F-16s since 2014; with the gear down only
 *    a descent too steep for the wheels counts); with the gear down near the ground the descent
 *    is eased for the touchdown (the flare), and after it the throttle closes and the brakes come on.
 */
import * as THREE from 'three';
import { atmosphere } from './f16Flight.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, KT = 0.514444;
const clamp = THREE.MathUtils.clamp;

/**
 * Calibrated airspeed, m/s, as the airspeed indicator reads it: from the pitot's impact pressure,
 * isentropic below Mach 1 and behind the normal shock (Rayleigh's pitot formula) above, converted
 * at sea-level standard conditions.
 */
export function calibrated(M, P) {
  const P0 = 101325, a0 = 340.294;
  const qc = M <= 1 ? P * (Math.pow(1 + 0.2 * M * M, 3.5) - 1)
    : P * (166.921 * Math.pow(M, 7) / Math.pow(7 * M * M - 1, 2.5) - 1);
  // The inverse at sea level, subsonic or supersonic (by iteration on the Rayleigh form).
  const r = qc / P0;
  let V = a0 * Math.sqrt(5 * (Math.pow(r + 1, 2 / 7) - 1));
  if (V > a0) {
    for (let i = 0; i < 20; i++) {
      const m = V / a0;
      V = a0 * 0.881285 * Math.sqrt((r + 1) * Math.pow(1 - 1 / (7 * m * m), 2.5));
    }
  }
  return V;
}

/**
 * Attitude and flight path of the airframe, degrees. The bank is the full circle, −180…180°
 * (right wing down positive), from the right wing's and the canopy's heights together: the
 * right wing's alone (an arcsine) read 120° of bank as 60° and never saw the airplane inverted.
 * Straight up or down the bank is undefined and reads 0.
 */
const _a = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
export function attitude(s) {
  const a = _a.set(1, 0, 0).applyQuaternion(s.q);
  const y = _y.set(0, 1, 0).applyQuaternion(s.q);
  const z = _z.set(0, 0, 1).applyQuaternion(s.q);
  const V = Math.max(1, s.vel.length());
  return {
    pitch: Math.asin(clamp(a.y, -1, 1)) * R2D,
    bank: Math.abs(z.y) < 1e-9 && Math.abs(y.y) < 1e-9 ? 0 : Math.atan2(-z.y, y.y) * R2D,
    gamma: Math.asin(clamp(s.vel.y / V, -1, 1)) * R2D,
    V,
  };
}

/**
 * `pilot` is the f16Fly pilot (stick, pedals, throttle, brakes, speed brakes, gear handle), which
 * step() works; `note(text)` tells the visitor what the second pilot did.
 */
export function createF16Assist({ sim, pilot, note = () => {} }) {
  const s = sim.state;
  const st = { rolling: false, gearAuto: false, bankCmd: 0, gammaCmd: 0, gcas: false, lowSpeed: false, pI: 0, gPrev: null, gRate: 0, atI: 0 };
  function reset() { Object.assign(st, { rolling: false, gearAuto: false, bankCmd: 0, gammaCmd: 0, gcas: false, lowSpeed: false, pI: 0, gPrev: null, gRate: 0, atI: 0 }); }

  /** keys: { gas, cut, up, down, turn (−1 left … +1 right), shift }; touchdown: a landing is under way. */
  function step(keys, dt, { touchdown = false } = {}) {
    const ramp = (cur, target, rate) => cur + clamp(target - cur, -rate * dt, rate * dt);
    const { gas, cut, up, down, turn: tr, shift } = keys;
    const { pitch, bank, gamma, V } = attitude(s);
    // Throttle: 60 % of the lever a second either way.
    const before = pilot.throttle;
    pilot.throttle = clamp(pilot.throttle + ((gas ? 1 : 0) - (cut ? 1 : 0)) * 0.6 * dt, 0, 1);
    if (before < 0.77 && pilot.throttle >= 0.77) note('Afterburner');
    if (s.wow) {
      if (gas && pilot.parking) { pilot.parking = false; note('Brakes off · rolling'); }
      if (gas) st.rolling = true;
      // After a touchdown the throttle closes by itself until W opens it again.
      if (touchdown && !gas) { pilot.throttle = 0; st.rolling = false; }
      pilot.brake = pilot.parking || (cut && pilot.throttle < 0.02) || (touchdown && !gas) ? 1 : 0;
      pilot.speedBrake = touchdown && !gas;
      pilot.roll = ramp(pilot.roll, tr, tr ? 2.5 : 5);
      pilot.yaw = pilot.roll;
      // Rotation: from 120 kt the nose comes up to 11°, ↑/↓ trimming it by 1°, never past 12°.
      const kt = s.tas / KT, want = clamp(11 + (up ? 1 : 0) - (down ? 1 : 0), 0, 12);
      pilot.pitch = st.rolling && kt > 120 ? clamp(0.12 * (want - pitch) - 0.02 * s.w.y * R2D, -0.3, 0.9) : 0;
      if (pitch > 12) pilot.pitch = Math.min(pilot.pitch, -0.1);
      st.bankCmd = 0; st.gammaCmd = Math.max(8, gamma); st.gcas = false; st.pI = 0; st.gPrev = null; st.gRate = 0;
      return;
    }
    st.rolling = false;
    pilot.yaw = 0;
    pilot.brake = 0;
    const kcas = calibrated(s.mach, atmosphere(s.pos.y).P) / KT;
    // The flight path asked for: ↑/↓ move it 15°/s, and it holds when let go.
    if (up || down) st.gammaCmd = clamp(st.gammaCmd + ((up ? 1 : 0) - (down ? 1 : 0)) * 15 * dt, -40, 40);
    // Bank: held, the wings roll to 60° (80° with Shift); let go and they come level.
    const maxBank = shift ? 80 : 60;
    st.bankCmd = tr ? clamp(st.bankCmd + tr * 90 * dt, -maxBank, maxBank) : ramp(st.bankCmd, 0, 45);
    // Auto-GCAS: under ≈5 s to the ground, or low with the gear up and coming down: wings level
    // and a pull to a climb until safe; the pilot then has the airplane back.
    const sink = -s.vel.y, tti = sink > 1 ? s.agl / sink : Infinity;
    // Gear down and landing, only a descent far too steep for the wheels counts.
    const threat = pilot.gearDown ? tti < 2.5 && sink > 7 : tti < 3 + V / 60 || (s.agl < 90 && sink > 0.5);
    if (threat && !st.gcas) { st.gcas = true; note('Auto-GCAS: pull up'); }
    if (st.gcas) {
      st.bankCmd = 0; st.gammaCmd = Math.max(st.gammaCmd, 10);
      if (s.agl > 150 && s.vel.y > 0) st.gcas = false;
    }
    // With the gear down near the ground, the flare: the descent eased to ≈0.6 m/s at the wheels.
    if (pilot.gearDown && s.agl < 15 && !st.gcas) st.gammaCmd = Math.max(st.gammaCmd, -Math.asin(Math.min(1, (0.6 + s.agl * 0.12) / V)) * R2D);
    // What flies that path, in the terms of the airplane's own pitch law (C* = nz + (Vco/g)·q,
    // Vco = 122 m/s, f16Flight.js): a pitch rate closing the path's error, and the load factor
    // gravity, the turn and that pitch rate need. Slow, the law reads the stick as pitch rate;
    // fast, as g: asking for C* itself serves both.
    const err = (st.gammaCmd - gamma) * D2R;
    st.pI = clamp(st.pI + err * dt * 0.15, -0.05, 0.05);
    // The path's own rate, filtered, damps the slow swing the airplane's speed and path trade in.
    const gRate = st.gPrev === null ? 0 : (gamma - st.gPrev) * D2R / dt;
    st.gPrev = gamma;
    st.gRate += (gRate - st.gRate) * Math.min(1, dt * 4);
    const qCmd = clamp(0.55 * err + st.pI - 0.45 * st.gRate, -0.22, 0.22);
    const cosB = Math.max(0.2, Math.cos(bank * D2R));
    const cstar = Math.cos(gamma * D2R) / cosB + (V / 9.81) * qCmd + (122 / 9.81) * qCmd * 0.35;
    const n = clamp(cstar, -1.5, 7.5);
    const cmd = n >= 1 ? (n - 1) / 8 : (n - 1) / 4;
    pilot.pitch = ramp(pilot.pitch, Math.abs(bank) > 100 ? 0.1 : cmd, 3);
    pilot.roll = clamp(0.035 * (st.bankCmd - bank) - 0.004 * s.w.x * R2D, -0.8, 0.8);
    // The gear comes up by itself once, climbing away from the take-off.
    if (pilot.gearDown && !st.gearAuto && s.agl > 60 && s.vel.y > 2) { pilot.gearDown = false; st.gearAuto = true; note('Gear up · G lowers it to land'); }
    // Low-speed protection: full power below 180 kt with the gear up.
    const slow = !pilot.gearDown && kcas < 180;
    if (slow && !st.lowSpeed) note('Low speed: full power');
    st.lowSpeed = slow;
    if (slow) pilot.throttle = 1;
    pilot.speedBrake = !!cut && pilot.throttle < 0.02;
    // Gear down and neither W nor S held: the approach speed, 150 kt, held on the throttle and the
    // speed brakes; over the runway, in the flare, the throttle comes back to idle.
    if (pilot.gearDown && st.gearAuto && !gas && !cut) {
      const e = 150 - kcas;
      st.atI = clamp(st.atI + e * 0.01 * dt, -0.3, 0.3);
      pilot.throttle = s.agl < 6 ? 0 : clamp(0.45 + st.atI + e * 0.03, 0, 0.76);
      pilot.speedBrake = e < -12;
    }
  }
  return { step, reset, state: st };
}
