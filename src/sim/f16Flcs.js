/**
 * The F-16's flight control system, in a module of its own (audit H19): the laws that turn the
 * pilot's stick and pedals into surface commands, after NASA TP-1538's appendix A, the gains ≈
 * (tuned against tools/f16-check.mjs). The airframe (f16Flight.js) hands it the air data, its
 * state and the actuators each step and moves the surfaces it commands; nothing here integrates
 * the airplane, so the laws can be read, changed and tested on their own.
 */
import { FCS } from '../data/f16Aero.js';

const G0 = 9.80665, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Sideslip feedback to the rudder, deg per deg (≈). */
export const KBETA = -12;
/** The pitch law's gains (≈, tuned against tools/f16-check.mjs), per unit of the q̄ schedule. */
export const GAIN = { kp: 3, ki: 4.0, kq: 1.0 };

/**
 * createF16Flcs({ I, S, CBAR, cmDe }) → { command(s, input, air, act, dt), reset(), state }:
 * I the inertias { x, y, z, xz }, S and CBAR the wing's area and chord, cmDe the stabilator's
 * pitching-moment derivative (for the roll-coupling compensation). command() takes the
 * airframe's state (w, nz, wow), the pilot's input, the air data and the actuators, and returns
 * the surface commands in degrees: { de, da, dr, lef }.
 */
export function createF16Flcs({ I, S, CBAR, cmDe }) {
  const ctl = { pitchI: 0, lefX: 0, ydX: 0, qLow: 0, nzF: 1 };
  function reset() { Object.assign(ctl, { pitchI: 0, lefX: 0, ydX: 0, qLow: 0, nzF: 1 }); }
  function command(s, input, air, act, dt) {
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
      de = -FCS.stab.limit * st + 1.2 * q * R2D;
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
      de += clamp(mInert / (Math.max(air.qbar, 500) * S * CBAR * -cmDe) * R2D, -10, 10);
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
  return { command, reset, state: ctl };
}
