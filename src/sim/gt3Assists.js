/**
 * The Porsche 911 GT3 RS's driver aids, apart from the physics (gt3Car.js) they act through:
 * each takes the car's state and the driver's inputs and returns what it asks of the brakes and
 * the engine, so the vehicle model can be run, and tested, with any of them on or off.
 *
 *  - Traction control: eases the drive while the driven tyres slip past their peak.
 *  - Stability control: a yaw-rate reference from the steering and the speed (a neutral car's,
 *    capped by the grip) against the car's own rate and its slip angle, met by braking one wheel
 *    (and letting off the inner wheels' brakes when oversteering on them) and easing the throttle.
 *  - ABS: each wheel's slip held just short of its peak by a proportional–integral control of its
 *    pressure, so it stays near its best grip, steering and stable, instead of locking.
 *  - EBD and cornering brake control: the rears' share of the brake trimmed to the load they carry,
 *    and further in a corner.
 *  - The drift mode: a tap of the parking brake at speed starts a drift; PSM stands back while the
 *    car is sideways and the driver holds it there, and a yaw moment keeps the slide short of a
 *    spin (≈ this simulation's aid, PSM on only).
 *
 * PSM (traction and stability control together) is on by default, as on the road car. The
 * thresholds and gains are ≈: Porsche does not publish them.
 */
const G = 9.80665;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const ASSISTS = {
  tag: 'ESTIMATE',
  tc: { gain: 0.8, floor: 0.05, rate: 30, combMax: 1.1, combGain: 3 },
  esc: { rateDead: 0.04, betaDead: 0.04, kRate: 9000, kBeta: 60000, maxMoment: 9000, speed: 5 },
  abs: { target: 0.92, kp: 0.3, ki: 40, recover: 6, floor: 0.05, speed: 1.5 },
  drift: { start: 0.9, hold: 0.35, betaHold: 0.10, betaCap: 0.6, kCap: 70000, maxCap: 14000 },
  ebd: { rearMax: 0.72, cbc: 0.9, cbcFloor: 0.25 },
};

/**
 * Updates the drift timer and says whether PSM is working this step (on, and not standing back
 * for a drift).
 */
export function psmActive(s, input, dt, beta) {
  const D = ASSISTS.drift;
  if (input.handbrake > 0.5 && s.u > 8) s.drift = Math.max(s.drift, D.start);
  else if (Math.abs(beta) > D.betaHold && s.u > 4 && s.drift > 0) s.drift = Math.max(s.drift, D.hold);
  s.drift = Math.max(0, s.drift - dt);
  return s.tc && s.drift <= 0;
}

/**
 * Traction control: the share of the drive it lets through (s.tcCut, smoothed). On the driven
 * tyres' slip ratio, and on their combined slip too: a rear sliding sideways at the edge of its
 * friction circle has no grip to spare for the drive even before it spins up (the published
 * system works from the IMU as well as the wheel speeds).
 */
export function tractionControl(s, active, slipPeak, dt) {
  const T = ASSISTS.tc;
  const comb = Math.max(s.slip?.[2] ?? 0, s.slip?.[3] ?? 0);
  const target = active ? clamp(Math.min(1.6 - T.gain * (Math.max(s.kap[2], s.kap[3]) / slipPeak), 1 + T.combGain * (T.combMax - comb)), T.floor, 1) : 1;
  s.tcCut += (target - s.tcCut) * Math.min(1, dt * T.rate);
  return s.tcCut;
}

/**
 * Stability control and the drift aid: per-wheel brake torques to add, per-wheel shares of the
 * pedal's pressure to keep, the share of the drive to let through, and a direct yaw moment
 * (the drift aid's, which the yaw equation takes as it comes).
 */
export function stability(s, input, active, beta, geo) {
  const E = ASSISTS.esc, D = ASSISTS.drift;
  const out = { brake: [0, 0, 0, 0], keep: [1, 1, 1, 1], drive: 1, yaw: 0 };
  s.esc = 0;
  if (active && s.u > E.speed && !s.reverse) {
    const cap = 0.9 * geo.mu * G / s.u;
    const rRef = clamp(s.u * s.steer / (geo.L * (1 + 0.0012 * s.u * s.u)), -cap, cap);
    const e = s.r - rRef;
    const over = Math.sign(e) === Math.sign(s.r) && Math.abs(s.r) > Math.abs(rRef);
    let M = 0;
    if (Math.abs(e) > E.rateDead) M -= E.kRate * (e - Math.sign(e) * E.rateDead);
    if (Math.abs(beta) > E.betaDead) M += E.kBeta * (beta - Math.sign(beta) * E.betaDead);
    M = clamp(M, -E.maxMoment, E.maxMoment);
    s.esc = M;
    if (Math.abs(M) > 1) {
      // A braked wheel pulls the nose to its own side: the left wheels turn it left (M > 0).
      const left = M > 0, F = Math.abs(M) / ((over ? geo.tf : geo.tr) / 2);
      const i = over ? (left ? 0 : 1) : (left ? 2 : 3);
      // Never the inner rear while the car is braking hard: that tyre has nothing to spare.
      if (over || input.brake < 0.2) out.brake[i] = F * geo.R[i];
      // Oversteering on the brakes, it also lets off the inner wheels' brakes, whose pull turns the nose further in.
      if (over) for (const k of left ? [1, 3] : [0, 2]) out.keep[k] = clamp(1 - Math.abs(M) / 6000, 0.15, 1);
      out.drive = clamp(1 - Math.abs(M) / 9000, 0.25, 1);
    }
  }
  // The drift aid: holds the slide short of a spin, with PSM on.
  if (s.tc && s.drift > 0 && Math.abs(beta) > D.betaCap) {
    const M = clamp(D.kCap * (beta - Math.sign(beta) * D.betaCap), -D.maxCap, D.maxCap);
    const i = M > 0 ? 0 : 1;
    out.brake[i] += Math.abs(M) / (geo.tf / 2) * geo.R[i] * 0.4;
    out.yaw += M * 0.6;
    s.esc = M;
  }
  return out;
}

/** EBD and cornering brake control: the rears' share of the pedal's force. */
export function rearBrakeShare(s, bias, loadF, loadR, mu) {
  const B = ASSISTS.ebd;
  const cbc = clamp(1 - B.cbc * Math.abs(s.ay) / (mu * G), B.cbcFloor, 1);
  return Math.min(1 - bias, B.rearMax * loadR / Math.max(1, loadF + loadR)) * cbc;
}

/**
 * ABS for wheel i, given its slip ratio before this step's update: updates and returns s.absK[i].
 * A slip-target controller, proportional and integral: braking, each wheel's pressure is held so
 * its slip ratio sits just short of the peak (0.92 of it, less at walking pace), easing as soon
 * as it slips past and building back smoothly — not the bang-bang release and recovery it was,
 * which chattered at ≈22 Hz with deep dumps of pressure.
 */
export function abs(s, i, braking, wx, kap, slipPeak, dt) {
  const A = ASSISTS.abs;
  s.absI ??= [0, 0, 0, 0];
  if (braking && Math.abs(wx) > A.speed) {
    const kT = -A.target * slipPeak * clamp(Math.abs(wx) / 8, 0.6, 1);
    // (Past the peak sideways too — a tyre turning hard and braking — the target comes in.)
    const e = kap - kT * (s.slip[i] > 1.12 ? 0.6 : 1);
    s.absI[i] = clamp(s.absI[i] + e * dt * A.ki, -1, 0);
    s.absK[i] = clamp(1 + A.kp * e / slipPeak + s.absI[i], A.floor, 1);
  } else {
    s.absI[i] = 0;
    s.absK[i] = Math.min(1, s.absK[i] + dt * A.recover);
  }
  if (s.absK[i] < 0.97) s.abs = true;
  return s.absK[i];
}
