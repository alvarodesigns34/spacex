/**
 * The Ninja H2R's dynamics, in fixed 1/240 s steps: a single-track vehicle that balances, steers
 * and slides the way a motorcycle does, with no rider's figure but the rider's inputs.
 *
 *  - Balance and steering. The lean obeys the point-mass bicycle's equation (Whipple's, reduced):
 *      h·φ̈ = g·sin φ − (v²/L)·δ·cos φ − (b·v/L)·δ̇·cos φ
 *    (φ lean, δ the steer angle, h the centre of mass's height, b its distance ahead of the rear
 *    contact, L the wheelbase). Nothing makes it lean but steering: the rider's keys ask for a lean,
 *    and the rider's hands (a controller, ≈ a skilled rider's) find the steer that gets there — which
 *    is first the other way: counter-steering, as on the real bike. The hands are quick at walking
 *    pace and slow at speed, where the wheels' gyroscopic stiffness resists (≈ the rate falls with
 *    speed). Below ≈3 m/s the feet hold it up and the bars steer it, up to the published 27°.
 *  - Turning. The yaw rate is the steer's, v·tan δ / L (≈, the trail's and the tyres' compliance
 *    left out); the lateral acceleration v·r then balances the lean at g·tan φ.
 *  - Tyres. Each has a friction circle (a slick ≈1.35 × the surface's μ, ≈); the rear wheel has its
 *    own speed, coupled to the engine through the gearbox and the clutch, and drives with a
 *    magic-formula-like curve of its slip, so it spins up under too much throttle — which the
 *    traction control (aids, T) holds near the peak. The front brakes up to its grip (cornering
 *    ABS with the aids); past it the front locks: upright it skids, leant over it tucks.
 *  - Load transfer on the springs: the 120 mm fork and the 135 mm shock (published travel), their
 *    rates ≈, carry the weight and the inertia; when one wheel unloads the bike pitches about the
 *    other contact (wheelies and stoppies, which the aids' wheelie control and rear-lift mitigation
 *    hold); past the balance point it goes over.
 *  - Engine: the published 228 kW at 14,000 rpm (240 kW with ram air, its share growing with the
 *    square of the speed, ≈) and 165 Nm at 12,500 rpm, the published primary, six gears and final
 *    drive, a quick-shifter's ≈60 ms cut; automatic shifting, or manual (Q down, E up).
 *  - Falls: a lowside when the tyres let go, over the bars or over backwards past the balance point,
 *    into deep water, against anything standing on the ground.
 */
import { ENGINE, GEARBOX, WHEELS, CHASSIS, BODY, MASS } from '../data/h2r.js';

const G = 9.81, RHO = 1.2, D2R = Math.PI / 180;
export const BIKE = {
  m: BODY.curb + MASS.rider, L: BODY.wheelbase,
  b: BODY.wheelbase * MASS.front, h: MASS.cgHeight,            // CG ahead of the rear contact, and up
  RF: WHEELS.front.dia / 2, RR: WHEELS.rear.dia / 2,
  front: 1.025, rear: -1.045, half: 0.2,
  maxLean: 58 * D2R,                                            // ≈ where the pegs and the fairing touch
  steerMax: CHASSIS.steer * D2R,
  // Springs (≈ a superbike's): wheel rates and damping, N/m and N·s/m.
  kF: 21000, cF: 1800, kR: 26000, cR: 2200,
  travelF: CHASSIS.travelFront, travelR: CHASSIS.travelRear,
  Iw: 0.9,                                                      // rear wheel, kg·m² (≈)
};
BIKE.lr = BIKE.b; BIKE.lf = BIKE.L - BIKE.b;
BIKE.Ip = BIKE.m * (BIKE.b ** 2 + BIKE.h ** 2) + 60;           // pitch inertia about the rear contact (≈)
const RATIO = (g) => GEARBOX.primary * GEARBOX.ratios[g] * GEARBOX.final;

export function engineTorque(rpm) {
  const c = ENGINE.torqueCurve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) { const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
  return c[c.length - 1][1];
}
/** Longitudinal grip against slip ratio (a magic-formula shape): its peak at ≈7 %, falling a little past it. */
const tyreLong = (k) => Math.sin(1.6 * Math.atan(18 * k - 0.4 * (18 * k - Math.atan(18 * k))));

export function createH2rBike({ ground = () => ({ h: 0, mu: 1, roll: 0, kind: 'track' }), obstacles = () => [] } = {}) {
  const input = { throttle: 0, brake: 0, rearBrake: 0, lean: 0, shiftUp: false, shiftDown: false };
  const s = {};
  function reset({ x = 0, z = 0, psi = 0 } = {}) {
    Object.assign(s, {
      x, z, y: ground(x, z).h, psi, u: 0, r: 0, phi: 0, phiDot: 0, theta: 0, thetaDot: 0, steer: 0, steerDot: 0,
      wR: 0, gear: 0, rpm: ENGINE.idle, shift: 0, manual: false, wheelAngleF: 0, wheelAngleR: 0, ax: 0, ay: 0,
      aids: true, wheelie: false, stoppie: false, slide: 0, slip: 0, crashed: null, down: 0, fallSide: 1,
      vx: 0, vz: 0, spinDown: 0, water: 0, immersion: 0, impact: 0, hits: [],
      susF: 0, susR: 0, vF: 0, vR: 0, NF: 0, NR: 0, t: 0, ramShare: 0, gradePitch: 0, grip: 1, fuelCut: false,
      surface: 'track', abs: false, tc: false, lock: 0,
    });
    // Settled on its springs.
    const Wf = BIKE.m * G * BIKE.b / BIKE.L, Wr = BIKE.m * G - Wf;
    s.susF = Wf / BIKE.kF; s.susR = Wr / BIKE.kR; s.NF = Wf; s.NR = Wr;
    Object.assign(input, { throttle: 0, brake: 0, rearBrake: 0, lean: 0, shiftUp: false, shiftDown: false });
  }
  reset();

  function fall(why, side = Math.sign(s.phi) || 1) {
    if (s.crashed) return;
    s.crashed = { why, t: s.t, speed: s.u };
    s.fallSide = side;
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    s.vx = s.u * c; s.vz = -s.u * sn;
    s.spinDown = (Math.random() - 0.5) * 1.5;
  }

  function stepDown(dt) {
    // Down: on its side, sliding on its fairing and bars to a stop (≈80° of roll, the bars and a
    // peg holding it off flat).
    s.phi += (s.fallSide * 80 * D2R - s.phi) * Math.min(1, dt * 8);
    s.theta *= Math.exp(-dt * 6);
    const v = Math.hypot(s.vx, s.vz), g = ground(s.x, s.z);
    const mu = g.water !== undefined ? 0.9 : (['grass', 'gravel', 'sand', 'mud'].includes(g.kind) ? 0.7 : 0.42);
    const dv = Math.min(v, mu * G * dt);
    if (v > 1e-6) { s.vx -= s.vx / v * dv; s.vz -= s.vz / v * dv; }
    s.x += s.vx * dt; s.z += s.vz * dt;
    s.psi += s.spinDown * dt; s.spinDown *= Math.exp(-dt * 0.8);
    s.u = v; s.y = g.h; s.down = Math.min(1, s.down + dt * 3);
    s.rpm += (0 - s.rpm) * Math.min(1, dt * 2);
    s.wR *= Math.exp(-dt * 2);
    collide(dt, true);
  }

  function step(dt) {
    s.t += dt;
    if (s.crashed) { stepDown(dt); return; }
    const g = ground(s.x, s.z);
    s.surface = g.kind;
    const surf = { track: 1, pad: 1, runway: 0.95, verge: 0.97, kerb: 0.9, gravel: 0.45, grass: 0.55, sand: 0.5, mud: 0.4 }[g.kind] ?? 1;
    const mu = 1.5 * (g.mu ?? surf);       // a slick on the surface (≈)
    const depth = g.water !== undefined ? Math.max(0, g.water - g.h) : 0;
    s.water = depth; s.immersion = depth;
    const V = Math.max(0, s.u);

    // ---- Loads, from the springs: each axle's spring and damper (the published travels).
    let Nf = Math.max(0, BIKE.kF * s.susF + BIKE.cF * s.vF), Nr = Math.max(0, BIKE.kR * s.susR + BIKE.cR * s.vR);
    if (s.theta > 0.002) Nf = 0;
    if (s.theta < -0.002) Nr = 0;
    s.NF = Nf; s.NR = Nr;

    // ---- Engine, clutch, gearbox, rear wheel.
    s.shift = Math.max(0, s.shift - dt);
    if (input.shiftUp || input.shiftDown) s.manual = true;
    if (input.shiftUp && s.gear < 5 && !s.shift) { s.gear++; s.shift = GEARBOX.shiftTime; }
    if (input.shiftDown && s.gear > 0 && !s.shift) { s.gear--; s.shift = GEARBOX.shiftTime; }
    input.shiftUp = input.shiftDown = false;
    const total = RATIO(s.gear);
    const wheelRpm = s.wR * 60 / (2 * Math.PI);
    if (!s.manual && !s.shift) {
      if (s.rpm > GEARBOX.upshiftRpm && s.gear < 5 && !s.wheelie) { s.gear++; s.shift = GEARBOX.shiftTime; }
      else if (s.gear > 0 && wheelRpm * RATIO(s.gear - 1) < GEARBOX.upshiftRpm - 1500 && (input.throttle < 0.2 ? s.rpm < 7500 : s.rpm < 6000)) { s.gear--; s.shift = GEARBOX.shiftTime; }
    }
    const geared = wheelRpm * total;
    // Moving off the clutch slips (as a rider, or launch control, slips it): the engine held at a
    // speed of its own, ≈9,000 rpm at full throttle, until the wheel's speed catches it up; a slipping
    // clutch passes the engine's torque.
    const launchRpm = Math.max(2500, ENGINE.idle + input.throttle * 7700);
    const slipClutch = s.gear === 0 && geared < launchRpm;
    s.ramShare = Math.min(1, (V / (300 / 3.6)) ** 2);
    const ram = 1 + (ENGINE.powerRam / ENGINE.power - 1) * s.ramShare;
    let thr = input.throttle;
    // Wheelie control: the throttle eased as the front comes up (≈ its logic).
    if (s.aids && s.theta > 2 * D2R) thr *= Math.max(0, 1 - (s.theta - 2 * D2R) / (4 * D2R)) * (s.thetaDot > 0 ? 0.6 : 1);
    // Traction control: eased as the rear's slip passes its peak.
    s.tc = false;
    if (s.aids && s.slip > 0.1) { thr *= Math.max(0, 1 - (s.slip - 0.1) * 10); s.tc = true; }
    s.fuelCut = s.rpm >= ENGINE.maxRpm;
    if (s.shift || s.fuelCut) thr = 0;
    if (slipClutch) s.rpm += (Math.max(geared, launchRpm) - s.rpm) * Math.min(1, dt * 10);
    else s.rpm = geared;
    let Te = engineTorque(Math.max(ENGINE.idle, s.rpm)) * thr * ram;
    // Engine braking, eased by the aids (≈ KEBC's light setting).
    if (thr < 0.05 && !slipClutch) Te -= (ENGINE.friction[0] + ENGINE.friction[1] * s.rpm) * (s.aids ? 0.6 : 1);
    if (slipClutch && thr < 0.05) Te = 0;
    const Tw = Te * total * GEARBOX.efficiency;
    // The rear tyre's force against its slip, and the wheel's spin under the drive, the tyre and
    // the brake — integrated implicitly (the tyre's stiffness against so light a wheel would make
    // an explicit step ring).
    const lat = Math.abs(s.u * s.r) * BIKE.m * BIKE.lf / BIKE.L;
    const capR = Math.sqrt(Math.max(0, (mu * Nr) ** 2 - lat ** 2));
    const FxOf = (w) => capR * tyreLong((w * BIKE.RR - V) / Math.max(3, V));
    const J = BIKE.Iw + (slipClutch ? 0 : ENGINE.inertia * total * total);
    const Tbr = (input.rearBrake * 0.35 + input.brake * 0.08) * 380 * (s.wR > 0.1 ? 1 : 0);
    const f0 = (Tw - FxOf(s.wR) * BIKE.RR - Tbr) / J;
    const dFdw = (FxOf(s.wR + 0.01) - FxOf(s.wR)) / 0.01 * BIKE.RR / J;
    s.wR = Math.max(0, s.wR + dt * f0 / (1 + dt * Math.max(0, dFdw)));
    s.slip = (s.wR * BIKE.RR - V) / Math.max(3, V);
    const Fx = FxOf(s.wR);
    // The front brake, its force limited by the tyre (ABS with the aids; locked past it without).
    const latF = Math.abs(s.u * s.r) * BIKE.m * BIKE.lr / BIKE.L;
    const capF = Math.sqrt(Math.max(0, (mu * Nf) ** 2 - latF ** 2));
    let Fbf = input.brake * 1.3 * BIKE.m * G;
    s.abs = false;
    if (s.aids) {
      if (Fbf > capF * 0.95) { Fbf = capF * 0.95; s.abs = true; }
      // Held short of the deceleration that lifts the rear (a > g·lf/h, ≈1.1 g with the rider).
      const lift = Math.max(0, 0.96 * BIKE.m * G * BIKE.lf / BIKE.h - 0.5 * RHO * MASS.cdA * V * V);
      if (Fbf > lift) { Fbf = lift; s.abs = true; }
      // Rear-lift mitigation: the brake eased as the rear rises.
      if (s.theta < -1 * D2R) Fbf *= Math.max(0.5, 1 + (s.theta + 1 * D2R) / (3 * D2R));
    } else if (Fbf > capF && V > 2) {
      Fbf = capF * 0.85;               // locked: sliding friction
      s.lock += dt;
      if (Math.abs(s.phi) > 12 * D2R) fall('The front tucked under the brake, leant over.');
    } else s.lock = 0;
    const Faero = 0.5 * RHO * MASS.cdA * V * V;
    const Froll = BIKE.m * G * (0.015 + (g.roll ?? 0)) * (V > 0.3 ? 1 : V / 0.3);
    const Fwater = depth > 0 ? 0.5 * 1000 * 0.9 * (0.12 + 0.19) * Math.min(depth, 0.3) * V * V : 0;
    const Fres = (V > 0.05 ? 1 : 0) * (Fbf + Faero + Froll + Fwater);
    const F = Fx - Fres;
    s.ax = F / BIKE.m;
    s.u = Math.max(0, s.u + s.ax * dt);
    if (V < 0.05 && Fx <= 0) s.u = 0;

    // ---- Springs and pitch. The load transfer m·a·h/L moves weight between the axles through
    // the springs; when an axle unloads the bike rotates about the other contact.
    {
      // (And the air's drag, acting about the centre of mass's height (≈ the centre of pressure's),
      // loads the rear and lifts the front even at a steady speed: ≈800 N at 330 km/h.)
      const transfer = (BIKE.m * s.ax * BIKE.h + Faero * BIKE.h) / BIKE.L;
      const wantF = BIKE.m * G * BIKE.b / BIKE.L - transfer, wantR = BIKE.m * G * BIKE.lf / BIKE.L + transfer;
      // Each axle's spring–damper driven towards the load it must carry (≈ a quarter-bike each).
      const mF = 0.45 * BIKE.m * BIKE.b / BIKE.L, mR = 0.45 * BIKE.m * BIKE.lf / BIKE.L;
      s.vF += ((wantF - (BIKE.kF * s.susF + BIKE.cF * s.vF)) / mF) * dt;
      s.vR += ((wantR - (BIKE.kR * s.susR + BIKE.cR * s.vR)) / mR) * dt;
      s.susF = Math.min(BIKE.travelF, Math.max(0, s.susF + s.vF * dt));
      s.susR = Math.min(BIKE.travelR, Math.max(0, s.susR + s.vR * dt));
      if (s.susF <= 0 || s.susF >= BIKE.travelF) s.vF = 0;
      if (s.susR <= 0 || s.susR >= BIKE.travelR) s.vR = 0;
      const a = s.ax;
      if (s.theta >= 0) {
        const lr = BIKE.b * Math.cos(s.theta) - BIKE.h * Math.sin(s.theta), hh = BIKE.b * Math.sin(s.theta) + BIKE.h * Math.cos(s.theta);
        const M = (BIKE.m * a + Faero) * hh - BIKE.m * G * lr;
        if (s.theta > 0 || M > 0) {
          s.thetaDot += M / BIKE.Ip * dt; s.thetaDot *= Math.exp(-dt * 0.8); s.theta += s.thetaDot * dt;
          if (s.theta < 0) { s.theta = 0; s.thetaDot = Math.max(0, -s.thetaDot * 0.15); s.vF -= 0.6; }
        }
      }
      if (s.theta <= 0) {
        const lf = BIKE.lf * Math.cos(-s.theta) - BIKE.h * Math.sin(-s.theta), hh = BIKE.lf * Math.sin(-s.theta) + BIKE.h * Math.cos(-s.theta);
        const M = -BIKE.m * a * hh - BIKE.m * G * lf;
        if (s.theta < 0 || M > 0) {
          s.thetaDot -= M / (BIKE.m * (BIKE.lf ** 2 + BIKE.h ** 2) + 60) * dt; s.thetaDot *= Math.exp(-dt * 0.8); s.theta += s.thetaDot * dt;
          if (s.theta > 0) { s.theta = 0; s.thetaDot = Math.min(0, -s.thetaDot * 0.15); s.vR -= 0.6; }
        }
      }
      s.wheelie = s.theta > 0.5 * D2R; s.stoppie = s.theta < -0.5 * D2R;
      if (s.theta > Math.atan2(BIKE.b, BIKE.h)) fall('Looped it: the wheelie went past the balance point.', s.phi >= 0 ? 1 : -1);
      if (-s.theta > Math.atan2(BIKE.lf, BIKE.h)) fall('Over the bars: the stoppie went past the balance point.', s.phi >= 0 ? 1 : -1);
    }

    // ---- Balance and steering.
    const grip = Math.sqrt(Math.max(0, mu * mu - (s.ax / G) ** 2));
    s.grip = grip;
    const reach = Math.min(BIKE.maxLean, s.aids ? Math.atan(grip * 0.9) : BIKE.maxLean);
    if (V < 3) {
      // Walking pace: the feet hold it up, the bars steer it.
      const want = input.lean * BIKE.steerMax * (1 - V / 6);
      s.steerDot = (want - s.steer) * 6; s.steer += s.steerDot * dt;
      s.phi += (0 - s.phi) * Math.min(1, dt * 4); s.phiDot = 0;
      s.r = V * Math.tan(s.steer) / BIKE.L;
    } else {
      // The rider's hands: a lean asked for, reached by steering — first away (counter-steering),
      // then into the turn. Their bandwidth falls with speed (≈ the gyroscopic stiffness).
      const target = input.lean * reach * Math.min(1, (V - 3) / 8);
      const wn = Math.max(2.2, 6.5 - V / 20), zeta = 0.9;
      const phiDdWant = wn * wn * (target - s.phi) - 2 * zeta * wn * s.phiDot;
      const c = Math.cos(s.phi);
      let delta = ((G / BIKE.h) * Math.sin(s.phi) - phiDdWant) * BIKE.h * BIKE.L / (V * V * Math.max(0.3, c));
      const lim = Math.min(BIKE.steerMax, 0.6 / Math.max(1, V / 4));
      delta = Math.max(-lim, Math.min(lim, delta));
      const rate = 3.5;                // rad/s the hands turn the bars (≈)
      const dd = Math.max(-rate * dt, Math.min(rate * dt, delta - s.steer));
      s.steerDot = dd / dt; s.steer += dd;
      // The lean, from the bicycle's equation.
      const phiDd = (G * Math.sin(s.phi) - (V * V / BIKE.L) * s.steer * c - (BIKE.b * V / BIKE.L) * s.steerDot * c) / BIKE.h;
      s.phiDot += phiDd * dt;
      s.phi += s.phiDot * dt;
      s.r = V * Math.tan(s.steer) / BIKE.L;
      if (Math.abs(s.phi) > BIKE.maxLean + 4 * D2R) fall('Leant past the clearance: a peg and the fairing dug in.');
      if (Math.abs(s.phi) > 75 * D2R) fall('It fell over.');
    }
    const ay = s.u * s.r;
    s.ay = ay;
    // Past the grip: the tyres slide, and a slide held for a moment is a lowside.
    const demand = Math.hypot(s.ax, ay) / G;
    if (demand > mu * 1.02 && V > 6) s.slide += (demand - mu) * dt * 8;
    else s.slide = Math.max(0, s.slide - dt * 2);
    if (!s.aids && s.slip > 0.6 && Math.abs(s.phi) > 25 * D2R && V > 8) s.slide += dt * 2;     // spinning the rear leant over: a highside's start
    if (s.slide > 0.25) fall(g.kind === 'grass' || g.kind === 'gravel' ? `Lost the front on the ${g.kind}.` : 'Lowside: the tyres let go.');
    if (depth > 0.45) fall('Into the water: too deep to ride through.');

    // ---- Move. + r turns right: the heading ψ (anticlockwise from above) decreases.
    s.psi -= s.r * dt;
    const c2 = Math.cos(s.psi), sn2 = Math.sin(s.psi);
    s.x += s.u * c2 * dt; s.z -= s.u * sn2 * dt;
    const hf = ground(s.x + (BIKE.L / 2) * c2, s.z - (BIKE.L / 2) * sn2).h, hr = ground(s.x - (BIKE.L / 2) * c2, s.z + (BIKE.L / 2) * sn2).h;
    s.y = (hf + hr) / 2;
    s.gradePitch = Math.atan2(hf - hr, BIKE.L);
    s.wheelAngleF += s.u / BIKE.RF * dt; s.wheelAngleR += s.wR * dt;
    collide(dt, false);
  }

  /** The bike's plan outline against the obstacles: a hard hit brings it down. */
  function collide(dt, down) {
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    const pts = [[BIKE.front, 0], [BIKE.front * 0.6, 0.2], [BIKE.front * 0.6, -0.2], [0, 0.22], [0, -0.22], [BIKE.rear * 0.7, 0.15], [BIKE.rear * 0.7, -0.15], [BIKE.rear, 0]];
    s.impact = 0;
    for (const o of obstacles(s.x, s.z)) {
      for (const [px, py] of pts) {
        const wx = s.x + px * c - py * sn, wz = s.z - px * sn - py * c;
        const dx = wx - o.x, dz = wz - o.z, d = Math.hypot(dx, dz);
        if (d >= o.r || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d;
        s.x += nx * (o.r - d); s.z += nz * (o.r - d);
        const vx = down ? s.vx : s.u * c, vz = down ? s.vz : -s.u * sn;
        const vn = -(vx * nx + vz * nz);
        if (vn > 0) {
          s.impact = Math.max(s.impact, vn);
          s.hits.push({ px, py, vn, nx, nz });
          if (down) { s.vx += nx * vn * 1.2; s.vz += nz * vn * 1.2; }
          else {
            const along = vx * c - vz * sn, lost = vn * Math.abs(nx * c - nz * sn);
            s.u = Math.max(0, along - lost * 1.1); s.wR = s.u / BIKE.RR;
            if (vn > 3.5) { fall(`Hit it at ${(vn * 3.6).toFixed(0)} km/h.`, py >= 0 ? -1 : 1); s.vx = (s.u * c) + nx * vn * 0.3; s.vz = (-s.u * sn) + nz * vn * 0.3; }
          }
        }
      }
    }
  }

  let acc = 0;
  function advance(dt) {
    acc = Math.min(acc + dt, 0.25);
    const h = 1 / 240;
    while (acc >= h) { step(h); acc -= h; }
  }
  return { state: s, input, reset, advance, step, fall };
}
