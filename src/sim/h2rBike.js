/**
 * The Ninja H2R's dynamics: a single-track vehicle with a rider, in fixed 1/240 s steps.
 *
 * What is modelled, and from what:
 *  - The engine: the published 228 kW at 14,000 rpm (240 kW with ram air, the ram's share
 *    growing with the square of the speed, ≈) and 165 Nm at 12,500 rpm, through the published
 *    primary, six gears and final drive to the 190/650 R17 rear tyre (data/h2r.js). The top
 *    speed is the gearing's at the limiter in sixth, ≈364 km/h (DERIVED; the limiter's rpm ≈).
 *  - Load transfer on the 1.450 m wheelbase from a centre of mass ≈0.62 m up with the rider
 *    tucked in (≈), so the front lifts when the drive is more than the weight's lever can hold:
 *    a wheelie, which the pitch dynamics carry about the rear contact; and the rear lifts under
 *    the front brake past the mirror case: a stoppie. The wheelie control holds the front low
 *    (on by default; T).
 *  - Leaning: the bike turns by leaning, its yaw rate g·tan φ / v in a steady turn; the rider
 *    asks for a lean and the bike rolls into it with a lag, quicker at moderate speed than at
 *    very high speed (the wheels' gyroscopic stiffness, ≈). Below ≈4 m/s it steers by the bars
 *    (up to the published 27° lock) and the rider's feet hold it up.
 *  - Grip: a friction circle per tyre (slick ≈1.35 times the surface's μ, ≈). With the aids on,
 *    the lean asked for is held inside it; asking for more — or braking hard leant over, or
 *    leaning on grass or gravel — slides the tyres and the bike falls: a lowside, sliding on
 *    its side to a stop.
 *  - Water (core/water.js through `ground`): drag on the tyres through it, and down in it past
 *    ≈0.45 m.
 *  - What stands on the ground (`obstacles`, circles in plan): hit hard, the bike falls.
 *
 * Not modelled: the tyres' slip angles and camber thrust as such (the turn is the lean's), the
 * chassis' weave and wobble, the rider's body moving on the bike.
 */
import { ENGINE, GEARBOX, WHEELS, CHASSIS, BODY, MASS } from '../data/h2r.js';

const G = 9.81, RHO = 1.2, D2R = Math.PI / 180;
export const BIKE = {
  m: BODY.curb + MASS.rider, L: BODY.wheelbase,
  lr: BODY.wheelbase * MASS.front, h: MASS.cgHeight,          // CG ahead of the rear axle, and up
  RF: WHEELS.front.dia / 2, RR: WHEELS.rear.dia / 2,
  front: 1.025, rear: -1.045, half: 0.2,                        // plan outline about the wheelbase's middle
  maxLean: 58 * D2R,                                            // ≈ where the pegs and fairing touch
};
BIKE.lf = BIKE.L - BIKE.lr;
BIKE.Ip = BIKE.m * (BIKE.lr ** 2 + BIKE.h ** 2) + 60;           // pitch inertia about the rear contact (≈)
const RATIO = (g) => GEARBOX.primary * GEARBOX.ratios[g] * GEARBOX.final;

export function engineTorque(rpm) {
  const c = ENGINE.torqueCurve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) { const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
  return c[c.length - 1][1];
}

export function createH2rBike({ ground = () => ({ h: 0, mu: 1, roll: 0, kind: 'track' }), obstacles = () => [] } = {}) {
  const input = { throttle: 0, brake: 0, rearBrake: 0, lean: 0 };
  const s = {};
  function reset({ x = 0, z = 0, psi = 0 } = {}) {
    Object.assign(s, {
      x, z, y: ground(x, z).h, psi, u: 0, r: 0, phi: 0, phiDot: 0, theta: 0, thetaDot: 0, steer: 0,
      gear: 0, rpm: ENGINE.idle, shift: 0, wheelAngleF: 0, wheelAngleR: 0, ax: 0, ay: 0,
      aids: true, wheelie: false, stoppie: false, slide: 0, crashed: null, down: 0, fallSide: 1,
      vx: 0, vz: 0, spinDown: 0, water: 0, immersion: 0, impact: 0, hits: [], susF: 0, susR: 0, t: 0, ramShare: 0,
      gradePitch: 0, bank: 0, grip: 1, fuelCut: false, surface: 'track',
    });
    Object.assign(input, { throttle: 0, brake: 0, rearBrake: 0, lean: 0 });
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

  function step(dt) {
    s.t += dt;
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    if (s.crashed) {
      // Down: on its side, sliding on its fairing and bars to a stop; the roll goes to the
      // ground (≈ 80° with the bars and the peg holding it off flat).
      s.phi += (s.fallSide * 80 * D2R - s.phi) * Math.min(1, dt * 8);
      s.theta *= Math.exp(-dt * 6);
      const v = Math.hypot(s.vx, s.vz), g = ground(s.x, s.z);
      const mu = g.water !== undefined ? 0.9 : (g.kind === 'grass' || g.kind === 'gravel' || g.kind === 'sand' || g.kind === 'mud' ? 0.7 : 0.42);
      const dv = Math.min(v, mu * G * dt);
      if (v > 1e-6) { s.vx -= s.vx / v * dv; s.vz -= s.vz / v * dv; }
      s.x += s.vx * dt; s.z += s.vz * dt;
      s.psi += s.spinDown * dt; s.spinDown *= Math.exp(-dt * 0.8);
      s.u = v; s.y = g.h; s.down = Math.min(1, s.down + dt * 3);
      s.rpm += (0 - s.rpm) * Math.min(1, dt * 2);
      collide(dt, true);
      return;
    }
    const g = ground(s.x, s.z);
    const surf = { track: 1, pad: 1, runway: 0.95, verge: 0.97, kerb: 0.9, gravel: 0.45, grass: 0.55, sand: 0.5, mud: 0.4 }[g.kind] ?? (g.mu ?? 1);
    s.surface = g.kind;
    const mu = 1.35 * (g.mu ?? surf);       // slick on the surface (≈)
    // Water at the wheels.
    const depth = g.water !== undefined ? Math.max(0, g.water - g.h) : 0;
    s.water = depth;
    s.immersion = depth;

    // ---- Engine and drive.
    const V = Math.max(0, s.u);
    const total = RATIO(s.gear);
    const wheelRpm = V / BIKE.RR * 60 / (2 * Math.PI);
    let rpm = wheelRpm * total;
    // The clutch slips below ≈ 4,500 rpm in the gear: a launch holds the revs up with the throttle.
    const slip = rpm < 4500;
    if (slip) rpm = Math.max(rpm, ENGINE.idle + input.throttle * 6500);
    s.shift = Math.max(0, s.shift - dt);
    // Automatic shifts, a quick-shifter's cut each (≈ the thresholds).
    if (!s.shift && rpm > GEARBOX.upshiftRpm && s.gear < 5 && !s.wheelie) { s.gear++; s.shift = GEARBOX.shiftTime; }
    else if (!s.shift && s.gear > 0 && wheelRpm * RATIO(s.gear - 1) < GEARBOX.downshiftRpm + 3000 && (input.throttle < 0.2 || wheelRpm * RATIO(s.gear) < 7000)) { s.gear--; s.shift = GEARBOX.shiftTime; }
    s.rpm += (rpm - s.rpm) * Math.min(1, dt * 25);
    s.fuelCut = s.rpm >= ENGINE.maxRpm;
    // Ram air: the published 240 kW against 228 kW, its share growing with the speed squared,
    // ≈ all of it by 300 km/h.
    s.ramShare = Math.min(1, (V / (300 / 3.6)) ** 2);
    const ram = 1 + (ENGINE.powerRam / ENGINE.power - 1) * s.ramShare;
    let thr = input.throttle;
    // Wheelie control: the throttle eased as the front comes up (≈ its logic).
    if (s.aids && s.theta > 2 * D2R) thr *= Math.max(0, 1 - (s.theta - 2 * D2R) / (4 * D2R)) * (s.thetaDot > 0 ? 0.6 : 1);
    if (s.shift || s.fuelCut) thr = 0;
    let Te = engineTorque(s.rpm) * thr * ram;
    if (thr < 0.05 && !slip) Te -= ENGINE.friction[0] + ENGINE.friction[1] * s.rpm;
    let Fdrive = Te * total * GEARBOX.efficiency / BIKE.RR;
    if (slip && Fdrive > 0) Fdrive *= 0.9;

    // ---- Brakes (the front does most of it), drag, rolling.
    const Fbf = input.brake * 1.25 * BIKE.m * G, Fbr = (input.brake * 0.25 + input.rearBrake * 0.4) * BIKE.m * G * 0.5;
    const Faero = 0.5 * RHO * MASS.cdA * V * V;
    const Froll = BIKE.m * G * (0.015 + (g.roll ?? 0)) * (V > 0.3 ? 1 : V / 0.3);
    const Fwater = depth > 0 ? 0.5 * 1000 * 0.9 * (0.12 + 0.19) * Math.min(depth, 0.3) * V * V : 0;

    // ---- Loads: static share, transfer with the last step's acceleration, lift in a wheelie.
    const lean = s.phi;
    const ay = s.u * s.r;
    s.ay = ay;
    let Nf = BIKE.m * G * BIKE.lr / BIKE.L - BIKE.m * s.ax * BIKE.h * Math.cos(lean) / BIKE.L;
    let Nr = BIKE.m * G - Nf;
    if (s.theta > 0.001) { Nr += Nf; Nf = 0; }
    if (s.theta < -0.001) { Nf += Nr; Nr = 0; }
    Nf = Math.max(0, Nf); Nr = Math.max(0, Nr);
    // Friction circles: the lateral share each tyre carries in the turn.
    const latF = Math.abs(ay) * BIKE.m * BIKE.lr / BIKE.L, latR = Math.abs(ay) * BIKE.m * BIKE.lf / BIKE.L;
    const capR = Math.sqrt(Math.max(0, (mu * Nr) ** 2 - latR ** 2)), capF = Math.sqrt(Math.max(0, (mu * Nf) ** 2 - latF ** 2));
    // Traction: the rear can only push what its circle has left; the aids hold it there,
    // without them the excess spins the tyre and steps the rear out (a slide).
    let Fx = Fdrive;
    if (Fx > capR) {
      if (s.aids) Fx = capR * 0.97;
      else { s.slide += (Fx - capR) / (BIKE.m * G) * dt * 6; Fx = capR; }
    }
    let Fb = Math.min(Fbf, s.aids ? capF * 0.97 : Fbf) + Math.min(Fbr, capR);
    if (s.aids) {
      // The aids keep the braking inside the tyres' grip together, and ease the front as the
      // rear comes up (≈ a cornering ABS and rear-lift mitigation's logic).
      Fb = Math.min(Fb, 0.97 * Math.sqrt(Math.max(0, (mu * BIKE.m * G) ** 2 - (ay * BIKE.m) ** 2)));
      // The rear lifts once the deceleration's moment about the front contact beats the
      // weight's (a > g·lf / h, ≈1.1 g here): held just short of it, and eased off if it rises.
      Fb = Math.max(0, Math.min(Fb, 0.96 * BIKE.m * G * BIKE.lf / BIKE.h - Faero - Math.max(0, -Fx)));
      if (s.theta < -1 * D2R) Fb *= Math.max(0.6, 1 + (s.theta + 1 * D2R) / (3 * D2R));
    }
    if (!s.aids && Fbf > capF && Math.abs(lean) > 15 * D2R) fall('The front tucked under the brake, leant over.');
    if (Fbf > capF * 1.05 && !s.aids && Math.abs(lean) <= 15 * D2R) s.slide += dt * 0.5;
    const brakeDir = V > 0.05 ? 1 : 0;
    const F = Fx - (Fb + Faero + Froll + Fwater) * brakeDir;
    s.ax = F / BIKE.m;
    s.u = Math.max(0, s.u + s.ax * dt);
    if (V < 0.05 && Fx <= 0) s.u = 0;

    // ---- Pitch: wheelie about the rear contact, stoppie about the front (≈ rigid body).
    {
      const a = s.ax;
      if (s.theta >= 0) {
        const lr = BIKE.lr * Math.cos(s.theta) - BIKE.h * Math.sin(s.theta), hh = BIKE.lr * Math.sin(s.theta) + BIKE.h * Math.cos(s.theta);
        const M = BIKE.m * a * hh - BIKE.m * G * lr;
        if (s.theta > 0 || M > 0) {
          s.thetaDot += M / BIKE.Ip * dt;
          s.thetaDot *= Math.exp(-dt * 0.8);
          s.theta += s.thetaDot * dt;
          if (s.theta < 0) { s.theta = 0; s.thetaDot = Math.max(0, -s.thetaDot * 0.15); }
        }
      }
      if (s.theta <= 0) {
        const lf = BIKE.lf * Math.cos(-s.theta) - BIKE.h * Math.sin(-s.theta), hh = BIKE.lf * Math.sin(-s.theta) + BIKE.h * Math.cos(-s.theta);
        const M = -BIKE.m * a * hh - BIKE.m * G * lf;        // a < 0 braking: rear up
        if (s.theta < 0 || M > 0) {
          s.thetaDot -= M / (BIKE.m * (BIKE.lf ** 2 + BIKE.h ** 2) + 60) * dt;
          s.thetaDot *= Math.exp(-dt * 0.8);
          s.theta += s.thetaDot * dt;
          if (s.theta > 0) { s.theta = 0; s.thetaDot = Math.min(0, -s.thetaDot * 0.15); }
        }
      }
      s.wheelie = s.theta > 0.5 * D2R;
      s.stoppie = s.theta < -0.5 * D2R;
      // Over the top: past the balance point it goes over backwards (or over the bars).
      const tip = Math.atan2(BIKE.lr, BIKE.h), tipF = Math.atan2(BIKE.lf, BIKE.h);
      if (s.theta > tip) fall('Looped it: the wheelie went past the balance point.', s.phi >= 0 ? 1 : -1);
      if (-s.theta > tipF) fall('Over the bars: the stoppie went past the balance point.', s.phi >= 0 ? 1 : -1);
    }

    // ---- Lean and turn.
    const grip = Math.sqrt(Math.max(0, mu * mu - (s.ax / G) ** 2));
    s.grip = grip;
    const gripLean = Math.atan(grip * 0.97);
    const reach = Math.min(BIKE.maxLean, s.aids ? gripLean : BIKE.maxLean);
    // The lean asked for: full lock asks for the lean the grip (or the clearance) allows; at low
    // speed less, a walking pace upright.
    const vLean = Math.min(1, Math.max(0, (V - 2) / 10));
    const want = input.lean * reach * vLean;
    const w = V < 4 ? 8 : 9 - 4 * Math.min(1, V / 90);            // roll response (≈)
    s.phiDot += (w * w * (want - s.phi) - 2 * 0.9 * w * s.phiDot) * dt;
    s.phi += s.phiDot * dt;
    if (Math.abs(s.phi) > BIKE.maxLean) { s.phi = Math.sign(s.phi) * BIKE.maxLean; s.phiDot = 0; }
    if (V > 4) {
      s.r = G * Math.tan(s.phi) / V;                               // + lean right: turns right
      s.steer = Math.atan(s.r * BIKE.L / V) * 1;
    } else {
      s.steer = input.lean * CHASSIS.steer * D2R * (1 - V / 8);
      s.r = V * Math.tan(s.steer) / BIKE.L;
    }
    // Lateral demand past the grip: a lowside.
    const demand = Math.hypot(s.ax, ay) / G;
    if (demand > mu * 1.02 && V > 6) s.slide += (demand - mu) * dt * 8;
    else s.slide = Math.max(0, s.slide - dt * 2);
    if (s.slide > 0.25) fall(g.kind === 'grass' || g.kind === 'gravel' ? `Lost the front on the ${g.kind}.` : 'Lowside: the tyres let go.');
    if (depth > 0.45) fall('Into the water: too deep to ride through.');

    // ---- Move. Yaw: + r turns right, i.e. the heading psi decreases (psi is anticlockwise from above).
    s.psi -= s.r * dt;
    const c2 = Math.cos(s.psi), sn2 = Math.sin(s.psi);
    s.x += s.u * c2 * dt; s.z -= s.u * sn2 * dt;
    // Ride height: the ground under each wheel; the grade pitches the bike.
    const hf = ground(s.x + (BIKE.L / 2) * c2, s.z - (BIKE.L / 2) * sn2).h, hr = ground(s.x - (BIKE.L / 2) * c2, s.z + (BIKE.L / 2) * sn2).h;
    s.y = (hf + hr) / 2;
    s.gradePitch = Math.atan2(hf - hr, BIKE.L);
    // Suspension (for the look): the fork dives under braking, the shock squats under drive.
    s.susF += ((Nf / (BIKE.m * G * BIKE.lr / BIKE.L) - 1) * 0.03 - s.susF) * Math.min(1, dt * 12);
    s.susR += ((Nr / (BIKE.m * G * BIKE.lf / BIKE.L) - 1) * 0.025 - s.susR) * Math.min(1, dt * 12);
    s.wheelAngleF += s.u / BIKE.RF * dt; s.wheelAngleR += (slip ? Math.max(s.u, s.u + (Fdrive > capR ? 3 : 0)) : s.u) / BIKE.RR * dt;
    void c; void sn;
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
        // Push out, and take the speed into it off.
        s.x += nx * (o.r - d); s.z += nz * (o.r - d);
        const vx = down ? s.vx : s.u * c, vz = down ? s.vz : -s.u * sn;
        const vn = -(vx * nx + vz * nz);
        if (vn > 0) {
          s.impact = Math.max(s.impact, vn);
          s.hits.push({ px, py, vn, nx, nz });
          if (down) { s.vx += nx * vn * 1.2; s.vz += nz * vn * 1.2; }
          else {
            // Along the bike's heading, the closing speed is lost; hard, it goes down.
            const along = vx * c - vz * sn;
            const lost = vn * Math.abs(nx * c - nz * sn);
            s.u = Math.max(0, along - lost * 1.1);
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
