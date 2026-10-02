/**
 * The Porsche 911 GT3 RS's dynamics: a four-wheel vehicle model on the ground plane, in this
 * same scene, with the published engine, gearbox, mass, geometry and aerodynamics
 * (data/gt3rs.js) and tyres, suspension and driveline that are not published (≈).
 *
 * What it is:
 *  - the body moves in the ground plane (x, z, yaw) with its height, pitch and roll following
 *    the ground and the load transfer (a spring-damper for the look, not a suspension model);
 *  - four tyres, each with its own load (static share, longitudinal and lateral transfer,
 *    downforce), slip ratio and slip angle, combined through one "magic formula" on the
 *    normalised slip, so a tyre that is spinning or locked has less grip sideways — which is
 *    what lets the car drift and leaves the marks;
 *  - the engine on its full-load curve (465 Nm at 6,300 rpm and 386 kW at 8,500, published;
 *    the rest of the curve ≈), the seven PDK ratios and the 4.27 final drive (published), a
 *    0.1 s shift (≈), launch with the clutch slipping, rear wheels joined by a locking
 *    differential (≈ its locking torque);
 *  - brakes split 66/34 (≈) with a continuous ABS that holds each wheel near its peak slip,
 *    and a parking brake on the rear wheels that ABS does not touch;
 *  - PSM, on by default as on the road car: traction control (holds the driven tyres near
 *    their peak slip) and stability control (a yaw-rate reference from the steering and the
 *    speed, met by braking one wheel and easing the throttle). Pulling the parking brake at
 *    speed starts a drift: PSM stands back while the car is sideways and the driver keeps it
 *    there, and comes back once it straightens. Off (T), the car is all the driver's;
 *  - drag and downforce from the published downforce and the published top speed (DRS opens
 *    on a straight at full throttle, as Porsche's Auto-DRS does);
 *  - rear-axle steering, opposite to the fronts at low speed and with them at high (≈ angles).
 *
 * Frame: world x, z (y up); the car's heading ψ is the angle of its nose from +x towards −z
 * (the scene's yaw), body velocity (u forward, v to the LEFT).
 */
import { ENGINE, GEARBOX, WHEELS, BRAKES, BODY, AERO, TYRES, PERFORMANCE } from '../data/gt3rs.js';

const G = 9.80665;
const TAU = 2 * Math.PI;
const RPM = 60 / TAU;               // rad/s → rpm
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Full-load torque at an engine speed (rpm), N·m: the published two points and the curve between them (≈). */
export function fullTorque(rpm) {
  const c = ENGINE.torqueCurve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) {
    const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
    return lerp(c[i - 1][1], c[i][1], t);
  }
  // Past the cut: the limiter.
  return 0;
}
/** The tyres' shape: a magic formula on the normalised combined slip, 1 at its peak (s = 1). */
const MF_B = 2.36, MF_C = 1.35;
const magic = (s) => Math.sin(MF_C * Math.atan(MF_B * s));
const SLIP_PEAK = 0.10, ALPHA_PEAK = 0.13;   // ≈ the slip ratio and angle (rad) at peak grip
// The rears are 335 mm wide against the fronts' 275: more rubber on the road, a stiffer carcass —
// a little more grip and their peak at a smaller slip angle (≈).
const AXLE_MU = [1, 1, 1.07, 1.07], AXLE_ALPHA = [ALPHA_PEAK, ALPHA_PEAK, 0.115, 0.115];

export const CAR = (() => {
  const m = BODY.mass + BODY.driver;
  const L = BODY.wheelbase, a = L * (1 - BODY.frontShare), b = L * BODY.frontShare;   // CG to front / rear axle
  return {
    m, L, a, b, h: BODY.cgHeight, Iz: BODY.inertiaYaw,
    tf: BODY.trackFront, tr: BODY.trackRear,
    rf: WHEELS.front.dia / 2 * 0.975, rr: WHEELS.rear.dia / 2 * 0.975,   // ≈ rolling radius, 2.5 % under the free radius
    Iw: [1.1, 1.1, 1.6, 1.6],         // ≈ wheel, tyre and disc, kg·m² (FL, FR, RL, RR)
    maxSteer: 30 * Math.PI / 180,     // ≈ from the 10.5 m turning circle with rear-axle steering
    rearSteer: 2 * Math.PI / 180,     // ≈
  };
})();

/**
 * How much of the steering lock a keyboard (or a full stick) should ask for at this speed: the
 * angle at which the front tyres reach about their grip in a steady turn — the geometric angle
 * for the tightest turn the grip allows, L·a/u², plus the tyres' own slip angle at the peak —
 * so a key held down turns the car as hard as it can turn, not past it into a slide. When the
 * car is already sideways, more is allowed the way the slide is caught, for the counter-steer (≈ this simulation's aid, as
 * any driving game needs one for a binary key).
 */
export function steerReach(s, dir = 0) {
  const u = Math.max(1, Math.abs(s.u));
  // What the braking or the drive already takes from the friction circle is not there to turn.
  const lat = Math.sqrt(Math.max(0.12, 1 - (s.ax / (TYRES.mu * G)) ** 2));
  const grip = (CAR.L * 1.25 * TYRES.mu * G / (u * u)) * lat + ALPHA_PEAK * 0.9 * Math.sqrt(lat);
  // The tail out to the right (β < 0) is caught by steering right (dir < 0), and vice versa;
  // more lock into the turn would only wind the slide up.
  const beta = Math.atan2(s.v, u), counter = dir !== 0 && Math.sign(dir) === Math.sign(beta) ? Math.abs(beta) * 1.8 : 0;
  return clamp(grip / CAR.maxSteer + counter, 0.08, 1);
}

export function createGt3Car({ ground = () => ({ h: 0, mu: 1, roll: 0, kind: 'track' }) } = {}) {
  // Every integrated or filtered quantity starts from here, at creation and at each reset, so a
  // reset car is the same car as a new one (only PSM, the visitor's choice, survives a reset).
  const fresh = () => ({
    x: 0, z: 0, psi: 0, y: 0,
    u: 0, v: 0, r: 0,                 // body velocity: forward, left; yaw rate (rad/s, +left turn)
    ax: 0, ay: 0,                     // filtered body accelerations (load transfer and the look)
    w: [0, 0, 0, 0],                  // wheel speeds, rad/s (FL, FR, RL, RR)
    slip: [0, 0, 0, 0],               // each tyre's combined slip, normalised (1 = peak grip)
    alpha: [0, 0, 0, 0],              // relaxed slip angles
    load: [0, 0, 0, 0],
    rpm: ENGINE.idle, gear: 1, shift: 0, clutch: 0, reverse: false,
    steer: 0, drs: false, abs: false, t: 0, pitch: 0, roll: 0, pitchV: 0, rollV: 0,
    surface: ['track', 'track', 'track', 'track'],
    tcCut: 1,                         // traction control's share of the drive
    esc: 0,                           // the stability control's yaw moment this step, N·m (for the readout)
    drift: 0,                         // s left of a handbrake-started drift, while PSM stands back
    absK: [1, 1, 1, 1],               // ABS: each wheel's share of its brake pressure
    kap: [0, 0, 0, 0],                // slip ratios
  });
  const s = Object.assign(fresh(), { tc: true });   // PSM (traction and stability control): on by default
  const input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false };
  let acc = 0;                        // real time not yet stepped, s (under one step)

  function reset({ x = 0, z = 0, psi = 0 } = {}) {
    Object.assign(s, fresh(), { x, z, psi, tc: s.tc });
    Object.assign(input, { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false });
    acc = 0;
    s.y = ground(x, z).h;
  }
  /** Inputs from a device, a script or a replay: a number out of range or not a number at all is clamped or zeroed here. */
  const fin = (x, lo, hi) => (Number.isFinite(x) ? clamp(x, lo, hi) : 0);

  // The wheels' positions in the body frame (forward, left), FL, FR, RL, RR.
  const WP = [[CAR.a, CAR.tf / 2], [CAR.a, -CAR.tf / 2], [-CAR.b, CAR.tr / 2], [-CAR.b, -CAR.tr / 2]];
  const RAD = [CAR.rf, CAR.rf, CAR.rr, CAR.rr];

  /** One fixed step of the model. */
  function step(dt) {
    input.throttle = fin(input.throttle, 0, 1); input.brake = fin(input.brake, 0, 1);
    input.steer = fin(input.steer, -1, 1); input.handbrake = fin(input.handbrake, 0, 1); input.reverse = !!input.reverse;
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    const V = Math.hypot(s.u, s.v);
    // ---- Aerodynamics. Auto-DRS: flat wings on a straight at full throttle above 100 km/h.
    s.drs = input.throttle > 0.95 && Math.abs(input.steer) < 0.15 && s.u > 28 && input.brake === 0;
    // Drag acts against the car's whole velocity (sideways too, in a slide: ≈ with the frontal
    // CdA, as no side figure is published); the downforce comes from the flow along the car.
    const cdA = s.drs ? AERO.cdA : AERO.cdAHigh;
    const clA = AERO.clA * (s.drs ? AERO.drsClFactor : 1);
    const kD = 0.5 * AERO.rho * cdA * V;
    const dragX = kD * s.u, dragY = kD * s.v, down = 0.5 * AERO.rho * s.u * s.u * clA;
    // ---- Loads: static share, downforce, and the transfer from the last step's accelerations.
    const mg = CAR.m * G;
    const fF = mg * CAR.b / CAR.L + down * AERO.frontShareDownforce;
    const fR = mg * CAR.a / CAR.L + down * (1 - AERO.frontShareDownforce);
    // The transfer can empty an axle or a side but not take more than it carries: the four loads
    // always add up to the weight and the downforce (a wheel at zero is a wheel off the ground,
    // the most a planar model can say; it does not roll the car over).
    const dLong = clamp(CAR.m * s.ax * CAR.h / CAR.L, -fR, fF);
    const axF = fF - dLong, axR = fR + dLong;
    const latF = clamp(CAR.m * s.ay * CAR.h * 0.55 / CAR.tf, -axF / 2, axF / 2);   // ≈ roll stiffness 55/45
    const latR = clamp(CAR.m * s.ay * CAR.h * 0.45 / CAR.tr, -axR / 2, axR / 2);
    const load = [axF / 2 - latF, axF / 2 + latF, axR / 2 - latR, axR / 2 + latR];
    // ay > 0 is to the left: the right-hand tyres take the load.
    s.load = load;
    // ---- Steering: the fronts, and the rears a little (opposite slow, with them fast).
    const ds = input.steer * CAR.maxSteer - s.steer;
    s.steer += clamp(ds, -2.2 * dt, 2.2 * dt);   // ≈ the rack's rate, rad/s at the wheels
    const kRear = clamp((s.u - 14) / 14, -1, 1);  // −1 below 50 km/h, +1 above 100
    const rearAngle = kRear * CAR.rearSteer * Math.abs(s.steer) / CAR.maxSteer * Math.sign(s.steer);
    const steerAt = [s.steer, s.steer, rearAngle, rearAngle];
    // ---- Drive: engine, gearbox, clutch.
    const ratio = s.reverse ? -GEARBOX.reverse : GEARBOX.ratios[s.gear - 1];
    const Gt = ratio * GEARBOX.final;
    const wRear = (s.w[2] + s.w[3]) / 2;
    let rpmWheel = wRear * Gt * RPM;
    let driveT = 0;                     // torque at the rear axle (sum of both wheels)
    const thr = s.shift > 0 ? 0 : input.throttle;
    if (s.shift > 0) s.shift -= dt;
    if (rpmWheel < 1800 && (thr > 0.02 || s.u < 2)) {
      // Pulling away: the clutch slips, the engine runs where the launch puts it.
      const target = ENGINE.idle + thr * 4600;
      s.rpm += (target - s.rpm) * Math.min(1, dt * 12);
      const engineT = thr * fullTorque(s.rpm);
      const grip = clamp((s.rpm - rpmWheel) / 600, 0, 1);
      driveT = engineT * Gt * GEARBOX.efficiency * grip;
    } else {
      s.rpm = Math.max(ENGINE.idle, rpmWheel);
      const limiter = s.rpm >= ENGINE.maxRpm ? 0 : 1;
      const engineT = thr * fullTorque(s.rpm) * limiter - (1 - thr) * (ENGINE.friction[0] + ENGINE.friction[1] * s.rpm);
      driveT = engineT * Gt * GEARBOX.efficiency;
    }
    // Automatic shifts (the PDK in its automatic mode).
    if (!s.reverse && s.shift <= 0) {
      // Up on the road speed's rpm (not a spinning wheel's), down with hysteresis: 2,600 rpm
      // pulling, 4,200 braking, and never into a gear that would over-rev.
      const below = s.gear > 1 ? rpmWheel * GEARBOX.ratios[s.gear - 2] / GEARBOX.ratios[s.gear - 1] : Infinity;
      const roadRpm = (s.u / CAR.rr) * Gt * RPM;
      if (Math.min(s.rpm, roadRpm * 1.08) > GEARBOX.upshiftRpm && s.gear < 7 && thr > 0.1) { s.gear++; s.shift = GEARBOX.shiftTime; }
      else if (s.gear > 1 && below < 7600 && rpmWheel < (input.brake > 0.1 ? GEARBOX.downshiftRpm : 2600)) { s.gear--; s.shift = GEARBOX.shiftTime * 0.8; }
    }
    // Reverse: from a standstill, the brake held.
    if (!s.reverse && input.reverse && Math.abs(s.u) < 0.5) { s.reverse = true; s.gear = 1; }
    if (s.reverse && !input.reverse && input.throttle > 0) s.reverse = false;
    // ---- PSM. A drift started with the parking brake: it lasts while the car is sideways.
    const beta = Math.atan2(s.v, Math.max(1, Math.abs(s.u)));
    if (input.handbrake > 0.5 && s.u > 8) s.drift = Math.max(s.drift, 0.9);
    else if (Math.abs(beta) > 0.10 && s.u > 4 && s.drift > 0) s.drift = Math.max(s.drift, 0.35);
    s.drift = Math.max(0, s.drift - dt);
    const psm = s.tc && s.drift <= 0;
    // Traction control: holds the driven tyres near their peak slip.
    if (psm) {
      const spin = Math.max(s.kap[2], s.kap[3]) / SLIP_PEAK;
      s.tcCut += (clamp(1.6 - 0.8 * spin, 0.05, 1) - s.tcCut) * Math.min(1, dt * 30);
    } else s.tcCut += (1 - s.tcCut) * Math.min(1, dt * 30);
    driveT *= s.tcCut;
    // Stability control: the yaw rate the steering asks for at this speed (a neutral car's,
    // capped by the grip), against the one the car has; the difference, and the slip angle,
    // become a yaw moment made by braking one wheel, and the throttle eases while it works.
    const escBrake = [0, 0, 0, 0], escKeep = [1, 1, 1, 1];
    s.esc = 0;
    if (psm && s.u > 5 && !s.reverse) {
      const rRef = clamp(s.u * s.steer / (CAR.L * (1 + 0.0012 * s.u * s.u)), -0.9 * TYRES.mu * G / s.u, 0.9 * TYRES.mu * G / s.u);
      const e = s.r - rRef;
      const over = Math.sign(e) === Math.sign(s.r) && Math.abs(s.r) > Math.abs(rRef);
      let M = 0;
      if (Math.abs(e) > 0.04) M -= 9000 * (e - Math.sign(e) * 0.04);
      if (Math.abs(beta) > 0.04) M += 60000 * (beta - Math.sign(beta) * 0.04);
      M = clamp(M, -9000, 9000);
      s.esc = M;
      if (Math.abs(M) > 1) {
        // A braked wheel pulls the car's nose to its own side: the left wheels turn it left (M > 0).
        const left = M > 0, F = Math.abs(M) / ((over ? CAR.tf : CAR.tr) / 2);
        const i = over ? (left ? 0 : 1) : (left ? 2 : 3);
        // Never the inner rear while the car is braking hard: that tyre has nothing to spare.
        if (over || input.brake < 0.2) escBrake[i] = F * RAD[i];
        // Oversteering on the brakes, it also lets off the inner wheels' brakes, whose pull
        // turns the nose further in.
        if (over) for (const k of left ? [1, 3] : [0, 2]) escKeep[k] = clamp(1 - Math.abs(M) / 6000, 0.15, 1);
        driveT *= clamp(1 - Math.abs(M) / 9000, 0.25, 1);
      }
    }
    // Drift aid, PSM on only: while a drift runs, a yaw moment holds the slide short of a spin
    // (beyond ≈40°), so it can be held with the throttle and the counter-steer (≈ this
    // simulation's aid; with PSM off the car spins as it would).
    if (s.tc && s.drift > 0 && Math.abs(beta) > 0.6) {
      const M = clamp(70000 * (beta - Math.sign(beta) * 0.6), -14000, 14000);
      const left = M > 0, i = left ? 0 : 1;
      escBrake[i] += Math.abs(M) / (CAR.tf / 2) * RAD[i] * 0.4;
      s.r += M * 0.6 / CAR.Iz * dt;
      s.esc = M;
    }
    // Locking differential: open, plus a locking torque that resists the two rears turning apart.
    const lock = clamp((s.w[2] - s.w[3]) * 400, -(250 + 0.45 * Math.abs(driveT)), 250 + 0.45 * Math.abs(driveT));
    const wheelDrive = [0, 0, driveT / 2 - lock, driveT / 2 + lock];
    // ---- Brakes: the pedal's force split front/rear by the hydraulics (≈ 66/34), the rears' share
    // trimmed to the load they carry (electronic brake-force distribution: as the weight comes
    // forward the rears would lock first and the tail come round), and the stability control's.
    const tB = input.brake * 1.9 * mg;    // ≈ the pedal's full force, N, at the contact patches
    const loadF = load[0] + load[1], loadR = load[2] + load[3];
    // Cornering, the rears' pressure comes down further (cornering brake control): their grip
    // is already holding the tail.
    const cbc = clamp(1 - 0.9 * Math.abs(s.ay) / (TYRES.mu * G), 0.25, 1);
    const rearShare = Math.min(1 - BRAKES.bias, 0.72 * loadR / Math.max(1, loadF + loadR)) * cbc;
    const brakeT = [
      tB * (1 - rearShare) / 2 * CAR.rf + escBrake[0], tB * (1 - rearShare) / 2 * CAR.rf + escBrake[1],
      tB * rearShare / 2 * CAR.rr + escBrake[2], tB * rearShare / 2 * CAR.rr + escBrake[3],
    ];
    const handT = input.handbrake * 1700;
    // ---- Tyres.
    let Fx = 0, Fy = 0, Mz = 0, roll = 0;
    s.abs = false;
    for (let i = 0; i < 4; i++) {
      const [px, py] = WP[i];
      // The contact patch's velocity in the body frame, turned into the wheel's frame.
      const vx = s.u - s.r * py, vy = s.v + s.r * px;
      const d = steerAt[i], cd = Math.cos(d), sd = Math.sin(d);
      const wx = vx * cd + vy * sd, wy = -vx * sd + vy * cd;
      const gr = ground(...worldOf(px, py));
      s.surface[i] = gr.kind;
      const mu = TYRES.mu * AXLE_MU[i] * gr.mu * (1 - TYRES.muLoadSens * (load[i] / (mg / 4) - 1));
      const R = RAD[i];
      const denom = Math.max(Math.abs(wx), 3);
      // Slip angle with a relaxation length: it builds over the first ≈0.35 m rolled.
      const aT = Math.atan2(wy, denom);
      s.alpha[i] += (aT - s.alpha[i]) * Math.min(1, (Math.abs(wx) + 2) * dt / TYRES.relaxation);
      const sy = Math.tan(s.alpha[i]) / AXLE_ALPHA[i];
      const Fmax = mu * load[i];
      const tyre = (w) => {
        const sx = ((w * R - wx) / denom) / SLIP_PEAK, sl = Math.hypot(sx, sy);
        const F = sl > 1e-6 ? Fmax * magic(sl) / sl : Fmax * MF_B * MF_C;
        return [F * sx, -F * sy, sl, sx * SLIP_PEAK];
      };
      // The wheel's spin, implicitly: the tyre's longitudinal force is stiff (it would ring
      // at the step), so it is linearised about the current speed and solved for the new one.
      const [fx0, , , kap0] = tyre(s.w[i]);
      // ABS: each wheel's pressure eases as soon as it slips past the peak and comes back as it
      // recovers, so the tyre stays near its best grip, steering and stable, instead of locking.
      if (brakeT[i] > 0 && Math.abs(wx) > 1.5 && (kap0 < -SLIP_PEAK * 1.05 || (kap0 < -0.02 && s.slip[i] > 1.12))) { s.absK[i] = Math.max(0.05, s.absK[i] - dt * 30 * s.absK[i]); s.abs = true; }
      else s.absK[i] = Math.min(1, s.absK[i] + dt * 6);
      // The parking brake works on the rears past the ABS: that is what locks them for a drift.
      let bt = brakeT[i] * s.absK[i] * escKeep[i] + (i >= 2 ? handT : 0);
      const e = 0.01, k = (tyre(s.w[i] + e)[0] - fx0) / e;           // dFx/dω
      const bSign = Math.abs(s.w[i]) > 0.3 ? Math.sign(s.w[i]) : Math.sign(wx) || 1;
      const net0 = wheelDrive[i] - fx0 * R - bSign * bt;
      let wn = s.w[i] + dt * net0 / (CAR.Iw[i] + dt * k * R);
      // A brake stops a wheel; it cannot turn it backwards.
      if (bt > Math.abs(wheelDrive[i]) && Math.sign(wn) !== Math.sign(s.w[i]) && Math.abs(s.w[i]) > 0) wn = 0;
      s.w[i] = wn;
      const [fx, fy, sl, kap] = tyre(wn);
      s.slip[i] = sl; s.kap[i] = kap;
      // Rolling resistance and the surface's drag (gravel) act on the car, not through the wheel.
      roll += (TYRES.rolling + gr.roll) * load[i] * Math.tanh(wx / 0.5);
      // Back to the body frame.
      const bx = fx * cd - fy * sd, by = fx * sd + fy * cd;
      Fx += bx; Fy += by;
      Mz += px * by - py * bx;
    }
    Fx -= roll;
    // ---- Body.
    Fx -= dragX; Fy -= dragY;
    const axB = Fx / CAR.m, ayB = Fy / CAR.m;
    s.u += (axB + s.v * s.r) * dt;
    s.v += (ayB - s.u * s.r) * dt;
    s.r += Mz / CAR.Iz * dt;
    // At a standstill, no creeping: friction holds it.
    if (V < 0.05 && input.throttle === 0) { s.u *= 0.9; s.v *= 0.9; s.r *= 0.9; }
    s.ax += (axB - s.ax) * Math.min(1, dt * 12);
    s.ay += (ayB - s.ay) * Math.min(1, dt * 12);
    // Heading and position (ψ from +x towards −z: forward is (cos ψ, −sin ψ) in x, z; left is (−sin ψ, −cos ψ)).
    s.psi += s.r * dt;
    s.x += (s.u * c - s.v * sn) * dt;
    s.z += (-s.u * sn - s.v * c) * dt;
    // Height, pitch and roll: the ground under the car and the load transfer, sprung (≈).
    s.y = ground(s.x, s.z).h;
    const pT = s.ax * 0.0035, rT = s.ay * 0.006;       // ≈ rad per m/s²: nose up under power, out of the turn
    s.pitchV += ((pT - s.pitch) * 120 - s.pitchV * 16) * dt; s.pitch += s.pitchV * dt;
    s.rollV += ((rT - s.roll) * 110 - s.rollV * 15) * dt; s.roll += s.rollV * dt;
    s.t += dt;
  }
  function worldOf(px, py) {
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    return [s.x + px * c - py * sn, s.z - px * sn - py * c];
  }
  /**
   * Advances by dt of real time in fixed 1/240 s steps. What is left under a step is carried to
   * the next call, so the car's clock keeps the wall clock's at any frame rate; a backlog over
   * 0.25 s (a stalled tab) is dropped rather than run all at once. Returns the steps taken.
   */
  const H = 1 / 240, MAX_STEPS = 60;
  function advance(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return 0;
    acc = Math.min(acc + dt, MAX_STEPS * H);
    let n = 0;
    while (acc >= H * (1 - 1e-9) && n < MAX_STEPS) { step(H); acc -= H; n++; }
    acc = Math.max(0, acc);
    return n;
  }
  return { state: s, input, reset, advance, step, worldOf, WP };
}
export { PERFORMANCE };
