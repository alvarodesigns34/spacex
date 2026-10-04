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
 *  - Tyres. Each has a friction circle (a slick ≈1.5 × the surface's μ, ≈); the rear wheel has its
 *    own speed, coupled to the engine through the gearbox and the clutch, and drives with a
 *    magic-formula-like curve of its slip, so it spins up under too much throttle — which the
 *    traction control (aids, T) holds near the peak. The grip is shared with the lean first: the
 *    lateral share the lean needs, then what is left for drive and brake (the published KCMF/KIBS
 *    and KTRC work from the IMU's lean the same way). Past it, without the aids, the front locks
 *    and skids or the rear spins — a longer stop, a wider line — never a fall.
 *  - The lean limit, and nothing else, keeps a turn on its wheels: the lean the rider can ask for
 *    is what the tyres can hold (atan of the grip left, ≈) and never past where the pegs and the
 *    fairing touch; past the tyres' grip the bike runs wide instead of going down.
 *  - Load transfer on the springs: the 120 mm fork and the 135 mm shock (published travel), their
 *    rates ≈, carry the weight and the inertia; when one wheel unloads the bike pitches about the
 *    other contact (wheelies and stoppies, which the aids' wheelie control and rear-lift mitigation
 *    hold); past the balance point it goes over.
 *  - Engine: the published 228 kW at 14,000 rpm (240 kW with ram air, its share growing with the
 *    square of the speed, ≈) and 165 Nm at 12,500 rpm, the published primary, six gears and final
 *    drive, a quick-shifter's ≈60 ms cut; automatic shifting, or manual (Q down, E up).
 *  - Falls: none from leaning, braking or accelerating in a turn. It still goes down over the bars
 *    or over backwards past the balance point (without the aids), into water too deep to ride
 *    through, and into anything standing on the ground hit hard and square (a graze scrapes along).
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
const STAND_UP = 0.9;                                           // rad/s the lean limit comes down at (≈)
/**
 * What puts the rider down against something: a hit square on (more than CRASH.angle) at more than
 * CRASH.vn of closing speed (≈45 km/h); anything less bounces off or scrapes along (≈, this
 * simulation's choice: a ride that ends only in a real crash).
 */
export const CRASH = { vn: 12.5, angle: 30 * Math.PI / 180 };
// The steer at the ground is the bars' angle foreshortened by the rake (≈ δ·cos λ): what turns
// the bike. The published 27° are at the bars.
const GS = Math.cos(CHASSIS.rake * D2R);

export function engineTorque(rpm) {
  const c = ENGINE.torqueCurve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) { const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
  return c[c.length - 1][1];
}
/** Longitudinal grip against slip ratio (a magic-formula shape): its peak at ≈7 %, falling a little past it. */
const tyreLong = (k) => Math.sin(1.6 * Math.atan(18 * k - 0.4 * (18 * k - Math.atan(18 * k))));

export function createH2rBike({ ground = () => ({ h: 0, mu: 1, roll: 0, kind: 'track' }), obstacles = () => [], wind = null } = {}) {
  // The wind (core/wind.js), at ≈0.9 m (the rider's and the fairing's centre of pressure, ≈);
  // none in the checks unless given.
  const AIR = { x: 0, y: 0, z: 0 };
  const input = { throttle: 0, brake: 0, rearBrake: 0, lean: 0, shiftUp: false, shiftDown: false, auto: false };
  const s = {};
  function reset({ x = 0, z = 0, psi = 0 } = {}) {
    Object.assign(s, {
      x, z, y: ground(x, z).h, psi, u: 0, r: 0, phi: 0, phiDot: 0, theta: 0, thetaDot: 0, steer: 0, steerDot: 0,
      wR: 0, gear: 0, rpm: ENGINE.idle, shift: 0, manual: false, wheelAngleF: 0, wheelAngleR: 0, ax: 0, ay: 0,
      aids: true, wheelie: false, stoppie: false, slide: 0, slip: 0, crashed: null, down: 0, fallSide: 1,
      vx: 0, vz: 0, spinDown: 0, water: 0, immersion: 0, impact: 0, hits: [],
      susF: 0, susR: 0, vF: 0, vR: 0, NF: 0, NR: 0, t: 0, ramShare: 0, gradePitch: 0, grip: 1, fuelCut: false, engThr: 0, engLoad: 0,
      surface: 'track', abs: false, tc: false, lock: 0, budget: 1, leanCap: 0, sliding: false, axTyre: 0, axF: 0, stop: BIKE.maxLean, slideCap: BIKE.maxLean,
      vy: NaN, air: false,             // vertical speed (NaN until the first step reads the slope)
      shiftRefused: -10, scrape: -10, drowned: false, drownedAt: 0,
      safe: { x, z, psi },             // the last spot it stood on dry, clear ground, upright (R picks it up there)
    });
    // Settled on its springs.
    const Wf = BIKE.m * G * BIKE.b / BIKE.L, Wr = BIKE.m * G - Wf;
    s.susF = Wf / BIKE.kF; s.susR = Wr / BIKE.kR; s.NF = Wf; s.NR = Wr;
    Object.assign(input, { throttle: 0, brake: 0, rearBrake: 0, lean: 0, shiftUp: false, shiftDown: false, auto: false });
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
    s.impact = 0;
    const n = Math.max(1, Math.ceil(v * dt / 0.1));
    for (let k = 0; k < n; k++) { s.x += s.vx * dt / n; s.z += s.vz * dt / n; collide(dt, true); }
    s.psi += s.spinDown * dt; s.spinDown *= Math.exp(-dt * 0.8);
    s.u = v; s.y = g.h; s.down = Math.min(1, s.down + dt * 3);
    s.rpm += (0 - s.rpm) * Math.min(1, dt * 2);
    s.wR *= Math.exp(-dt * 2);
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
    // The air's drag on the bike and rider, through the air (the wind along the bike taken off:
    // forward is (cos ψ, −sin ψ) in x, z). A crosswind's push on the lean is not modelled (≈).
    if (wind) wind(s.x, 0.9, s.z, s.t, AIR); else { AIR.x = 0; AIR.z = 0; }
    const ua = V - (AIR.x * Math.cos(s.psi) - AIR.z * Math.sin(s.psi));
    const Faero = 0.5 * RHO * MASS.cdA * ua * Math.abs(ua);

    // ---- Loads, from the springs: each axle's spring and damper (the published travels).
    let Nf = Math.max(0, BIKE.kF * s.susF + BIKE.cF * s.vF), Nr = Math.max(0, BIKE.kR * s.susR + BIKE.cR * s.vR);
    if (s.theta > 0.002) Nf = 0;
    if (s.theta < -0.002) Nr = 0;
    if (s.air) { Nf = 0; Nr = 0; }          // over a crest, off the ground: no tyre force at all
    s.NF = Nf; s.NR = Nr;
    // Leant over, the centre of mass stands h·cos φ above the ground: that is the height the
    // pitch works on (a stoppie needs more braking, a wheelie more drive, the more it leans).
    const hE = BIKE.h * Math.cos(Math.min(Math.abs(s.phi), 1.2));
    const IpE = BIKE.m * (BIKE.b ** 2 + hE ** 2) + 60;

    // ---- The grip, shared with the lean first. Its lateral share is tan φ (in g); what is left
    // of the friction circle is what drive and brake may use with the aids (the published
    // cornering management reads the lean from the IMU the same way). 0.95 of the peak (≈).
    const leanTan = Math.tan(Math.min(Math.abs(s.phi), 1.3));
    const axBudget = G * Math.sqrt(Math.max(0, (0.95 * mu) ** 2 - leanTan ** 2));
    s.budget = axBudget / G;

    // ---- Engine, clutch, gearbox, rear wheel.
    s.shift = Math.max(0, s.shift - dt);
    const wheelRpm = s.wR * 60 / (2 * Math.PI);
    if (input.shiftUp || input.shiftDown) s.manual = true;
    if (input.auto) s.manual = false;
    if (input.shiftUp && s.gear < 5 && !s.shift) { s.gear++; s.shift = GEARBOX.shiftTime; }
    if (input.shiftDown && s.gear > 0 && !s.shift) {
      // Refused where it would over-rev the engine (as the quick-shifter's ECU refuses it).
      if (wheelRpm * RATIO(s.gear - 1) > ENGINE.maxRpm - 300) s.shiftRefused = s.t;
      else { s.gear--; s.shift = GEARBOX.shiftTime; }
    }
    input.shiftUp = input.shiftDown = input.auto = false;
    if (!s.manual && !s.shift) {
      if (s.rpm > GEARBOX.upshiftRpm && s.gear < 5 && !s.wheelie) { s.gear++; s.shift = GEARBOX.shiftTime; }
      else if (s.gear > 0 && wheelRpm * RATIO(s.gear - 1) < GEARBOX.upshiftRpm - 1500
        && s.rpm < GEARBOX.downshiftRpm - (input.throttle < 0.2 ? 1000 : 2500)) { s.gear--; s.shift = GEARBOX.shiftTime; }
    }
    const total = RATIO(s.gear);
    const geared = wheelRpm * total;
    // Moving off the clutch slips (as a rider, or launch control, slips it): the engine held at a
    // speed of its own, ≈9,000 rpm at full throttle in first, until the wheel's speed catches it
    // up. In a higher gear the clutch slips only to keep the engine from stalling (≈2,500 rpm).
    const launchRpm = s.gear === 0 ? Math.max(2500, ENGINE.idle + input.throttle * 7700) : 2500;
    const slipClutch = geared < launchRpm;
    s.ramShare = Math.min(1, (V / (337 / 3.6)) ** 2);
    const ram = 1 + (ENGINE.powerRam / ENGINE.power - 1) * s.ramShare;
    let thr = input.throttle;
    // Wheelie control: the throttle eased from 1° of lift and shut by 4° (≈ its logic).
    if (s.aids && s.theta > 1 * D2R) thr *= Math.max(0, 1 - (s.theta - 1 * D2R) / (3 * D2R)) * (s.thetaDot > 0 ? 0.6 : 1);
    // Without the aids, the rider's own reflex (this simulation's, as any rider does it): past ≈60 %
    // of the balance point (read ≈0.15 s ahead) the throttle comes off, shut by ≈85 %, so a
    // wheelie never loops.
    const balW = Math.atan2(BIKE.b, hE);
    const upAhead = s.theta + 0.15 * s.thetaDot;
    if (upAhead > 0.6 * balW) thr *= Math.max(0, 1 - (upAhead - 0.6 * balW) / (0.25 * balW));
    // Traction control: eased as the rear's slip passes its peak, and the drive held within what
    // the lean leaves of the grip.
    s.tc = false;
    if (s.aids && s.slip > 0.1) { thr *= Math.max(0, 1 - (s.slip - 0.1) * 10); s.tc = true; }
    if (s.aids && V > 3) {
      const fxNow = engineTorque(Math.max(ENGINE.idle, s.rpm)) * ram * total * GEARBOX.efficiency / BIKE.RR;
      if (thr * fxNow > BIKE.m * axBudget) { thr = BIKE.m * axBudget / fxNow; s.tc = true; }
    }
    s.fuelCut = s.rpm >= ENGINE.maxRpm;
    if (s.shift || s.fuelCut || s.drowned) thr = 0;
    if (slipClutch) s.rpm += (Math.max(geared, launchRpm) - s.rpm) * Math.min(1, dt * 10);
    else s.rpm = geared;
    let Te = engineTorque(Math.max(ENGINE.idle, s.rpm)) * thr * ram;
    // What the engine gets, for the sound: the throttle past the aids and the cuts, and its load.
    s.engThr = thr; s.engLoad = thr * (slipClutch ? ENGINE.launchClutch : 1);
    // A slipping clutch passes part of the engine's torque (ESTIMATE, fitted to the 0–100 km/h).
    if (slipClutch) Te *= ENGINE.launchClutch;
    // Engine braking, eased by the aids (≈ KEBC's light setting) — when the rider shuts the
    // throttle, not during the quick-shifter's cut or at the limiter.
    if (input.throttle < 0.05 && !slipClutch) Te -= (ENGINE.friction[0] + ENGINE.friction[1] * s.rpm) * (s.aids ? 0.6 : 1);
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
    // Water pushed aside by the front tyre (≈ Cd 0.9 on the tyre's width and the depth, up to
    // 0.3 m), capped at 0.6 g (≈): it slows the bike, it is not the tyres' grip.
    const Fwater = depth > 0 ? Math.min(0.6 * BIKE.m * G, 0.5 * 1000 * 0.9 * WHEELS.front.width * Math.min(depth, 0.3) * V * V) : 0;
    const waterDrag = Fwater;
    // The front brake, its force limited by the tyre (KIBS with the aids; locked past it without).
    const latF = Math.abs(s.u * s.r) * BIKE.m * BIKE.lr / BIKE.L;
    const capF = Math.sqrt(Math.max(0, (mu * Nf) ** 2 - latF ** 2));
    // Drowned, the rider brakes to a stop in the water (≈0.3 g).
    let Fbf = Math.max(input.brake * 1.3 * BIKE.m * G, s.drowned ? 0.3 * BIKE.m * G : 0);
    s.abs = false;
    if (s.aids) {
      if (Fbf > capF * 0.95) { Fbf = capF * 0.95; s.abs = true; }
      // Held short of the deceleration that lifts the rear (a > g·lf/h, ≈1.1 g with the rider,
      // more leant over), counting what the air and the water already take.
      const lift = Math.max(0, 0.96 * BIKE.m * G * BIKE.lf / hE - Faero - waterDrag);
      if (Fbf > lift) { Fbf = lift; s.abs = true; }
      // Rear-lift mitigation: the brake eased as the rear rises, let off entirely by 4° of it.
      if (s.theta < -1 * D2R) Fbf *= Math.max(0, 1 + (s.theta + 1 * D2R) / (3 * D2R));
      // Cornering (KCMF): both tyres' braking within what the lean leaves (Fx < 0 when the rear brakes).
      const room = Math.max(0, BIKE.m * axBudget + Fx);
      if (Fbf > room) { Fbf = room; s.abs = true; }
      // And slow, leant over: no harder than lets the bike come up as fast as the lean the bars
      // can balance falls with the speed (≈0.5 g at walking pace; nothing above ≈30 km/h).
      const k = Math.tan(Math.min(BIKE.steerMax, 0.6 / Math.max(1, V / 4))) / (G * BIKE.L);
      if (V > 1 && Math.abs(s.phi) > Math.atan(V * V * k) - 8 * D2R) {
        const aUp = 0.75 * STAND_UP * (1 + V ** 4 * k * k) / (2 * V * k);
        if (Fbf > BIKE.m * aUp + Fx) { Fbf = Math.max(0, BIKE.m * aUp + Fx); s.abs = true; }
      }
      s.lock = 0;
    } else {
      // Without the aids the brake is the rider's, but the friction circle is still the tyres':
      // past what the lean leaves of it (the lateral share first) or past the front's own grip,
      // the front locks and skids on its sliding friction — a longer stop, not a fall.
      // The rider's hand: no harder than just lifts the rear (≈5 % past it, a light rear), as a
      // rider brakes without ABS; it is the aids' hold (0.96) that keeps it planted.
      const feel = Math.max(0, 1.05 * BIKE.m * G * BIKE.lf / hE - Faero - waterDrag);
      if (Fbf > feel) Fbf = feel;
      const roomPhys = Math.max(0, BIKE.m * G * Math.sqrt(Math.max(0, mu * mu - leanTan * leanTan)) + Fx);
      if ((Fbf > capF || Fbf > roomPhys) && V > 2) { Fbf = Math.min(capF, roomPhys) * 0.7; s.lock += dt; }
      else s.lock = 0;
    }
    // The rider's reflex on the front brake (with or without the aids): the rear lifting past ≈3°,
    // the lever is eased, let off by ≈10°: hard braking lifts the rear a little, it never throws
    // the rider over the bars nor rides a long stoppie (≈, this simulation's rider).
    // (Read ≈0.15 s ahead from the pitch rate, as a rider feels the rear going light before it rises.)
    const liftAhead = -s.theta - 0.15 * s.thetaDot;
    if (liftAhead > 3 * D2R) Fbf *= Math.max(0, 1 - (liftAhead - 3 * D2R) / (7 * D2R));
    const Froll = BIKE.m * G * (0.015 + (g.roll ?? 0)) * (V > 0.3 ? 1 : V / 0.3);
    // The grade: gravity along the slope (the pitch of the last step).
    const Fgrade = s.air ? 0 : BIKE.m * G * Math.sin(s.gradePitch);
    const Fres = (V > 0.05 ? 1 : 0) * (Fbf + Faero + Froll + Fwater);
    const F = Fx - Fres - Fgrade;
    s.ax = F / BIKE.m;
    s.axTyre = (Fx - Fbf) / BIKE.m;      // what the tyres carry: neither the air nor the water
    s.u = Math.max(0, s.u + s.ax * dt);
    if (V < 0.05 && Fx <= 0 && Fgrade >= 0) s.u = 0;

    // ---- Springs and pitch. The load transfer m·a·h/L moves weight between the axles through
    // the springs; when an axle unloads the bike rotates about the other contact.
    {
      // (And the air's drag, acting about the centre of mass's height (≈ the centre of pressure's),
      // loads the rear and lifts the front even at a steady speed: ≈800 N at 330 km/h. The water
      // pushes at half its depth, not at the centre of mass.)
      const hw = depth / 2;
      const transfer = (BIKE.m * s.ax * hE + Faero * hE + Fwater * (hE - hw)) / BIKE.L;
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
        const lr = BIKE.b * Math.cos(s.theta) - hE * Math.sin(s.theta), hh = BIKE.b * Math.sin(s.theta) + hE * Math.cos(s.theta);
        const M = (BIKE.m * a + Faero + Fwater) * hh - Fwater * hw - BIKE.m * G * lr;
        if (s.theta > 0 || M > 0) {
          s.thetaDot += M / IpE * dt; s.thetaDot *= Math.exp(-dt * 0.8); s.theta += s.thetaDot * dt;
          if (s.theta < 0) { s.theta = 0; s.thetaDot = Math.max(0, -s.thetaDot * 0.15); s.vF -= 0.6; }
        }
      }
      if (s.theta <= 0) {
        const lf = BIKE.lf * Math.cos(-s.theta) - hE * Math.sin(-s.theta), hh = BIKE.lf * Math.sin(-s.theta) + hE * Math.cos(-s.theta);
        const M = -(BIKE.m * a + Fwater) * hh + Fwater * hw - BIKE.m * G * lf;
        if (s.theta < 0 || M > 0) {
          s.thetaDot -= M / (BIKE.m * (BIKE.lf ** 2 + hE ** 2) + 60) * dt; s.thetaDot *= Math.exp(-dt * 0.8); s.theta += s.thetaDot * dt;
          if (s.theta > 0) { s.theta = 0; s.thetaDot = Math.min(0, -s.thetaDot * 0.15); s.vR -= 0.6; }
        }
      }
      s.wheelie = s.theta > 0.5 * D2R; s.stoppie = s.theta < -0.5 * D2R;
      // Never past the balance point (the reflexes above keep it there; this is the backstop).
      const thMax = 0.9 * Math.atan2(BIKE.b, hE), thMin = -0.8 * Math.atan2(BIKE.lf, hE);
      if (s.theta > thMax) { s.theta = thMax; s.thetaDot = Math.min(0, s.thetaDot); }
      if (s.theta < thMin) { s.theta = thMin; s.thetaDot = Math.max(0, s.thetaDot); }
    }

    // ---- Balance and steering.
    // The grip left for the lean: the friction circle less what drive or brake take of it (their
    // share filtered over ≈0.17 s, as the tyres' loads and slips build; ≈), 0.92 of the peak.
    s.axF = (s.axF ?? 0) + ((s.axTyre ?? 0) - (s.axF ?? 0)) * Math.min(1, dt * 6);
    const grip = Math.sqrt(Math.max(0, (0.92 * mu) ** 2 - (Math.min(Math.abs(s.axF), 0.5 * 0.92 * mu * G) / G) ** 2));
    s.grip = grip;
    // The lean limit: what the tyres can hold, and never past where the pegs touch.
    const reach = Math.min(BIKE.maxLean, Math.atan(grip));
    // Slow, the lean is what the bars' lock allows at this speed (≈0.9 of it).
    const lowCap = Math.atan(V * V * Math.tan(0.9 * BIKE.steerMax * GS) / (G * BIKE.L));
    s.leanCap = Math.min(reach, lowCap);
    s.sliding = false;
    const rPrev = s.r;
    if (V < 3) {
      // Walking pace: the feet hold it up, the bars steer it (to the lock: the tightest turn is
      // made slowest), and it leans only as much as the turn.
      const want = input.lean * BIKE.steerMax;
      s.steerDot = (want - s.steer) * 6; s.steer += s.steerDot * dt;
      s.r = V * Math.tan(s.steer * GS) / BIKE.L;
      s.phi += (Math.atan(V * s.r / G) - s.phi) * Math.min(1, dt * 4); s.phiDot = 0;
      s.stop = Math.max(Math.abs(s.phi), 2 * D2R);
    } else {
      // The rider's hands: a lean asked for, reached by steering — first away (counter-steering),
      // then into the turn. Their bandwidth falls with speed (≈ the gyroscopic stiffness).
      const target = input.lean * s.leanCap;
      const wn = Math.max(2.2, 6.5 - V / 20), zeta = 0.9;
      const phiDdWant = wn * wn * (target - s.phi) - 2 * zeta * wn * s.phiDot;
      const c = Math.cos(s.phi);
      let delta = ((G / BIKE.h) * Math.sin(s.phi) - phiDdWant) * BIKE.h * BIKE.L / (V * V * Math.max(0.3, c)) / GS;
      // The bars: no more than the tyres can turn with (the steer whose turn their full grip
      // holds — a margin over the lean's own share, so the hands can still correct at the limit).
      const lim = Math.min(BIKE.steerMax, 0.6 / Math.max(1, V / 4), Math.atan(mu * G * BIKE.L / (V * V)) / GS);
      delta = Math.max(-lim, Math.min(lim, delta));
      const rate = 3.5;                // rad/s the hands turn the bars (≈)
      const dd = Math.max(-rate * dt, Math.min(rate * dt, delta - s.steer));
      s.steerDot = dd / dt; s.steer += dd;
      // The lean, from the bicycle's equation.
      const phiDd = (G * Math.sin(s.phi) - (V * V / BIKE.L) * s.steer * GS * c - (BIKE.b * V / BIKE.L) * s.steerDot * GS * c) / BIKE.h;
      s.phiDot += phiDd * dt;
      s.phi += s.phiDot * dt;
      // The lean limit: never past where the pegs and the fairing touch, nor (by more than 2°)
      // past what the tyres hold or the bars' lock can balance at this speed. When either falls
      // — slowing down, onto grass — the limit follows at ≈50°/s, so the bike is brought up, not
      // let down. This is what keeps a turn on its wheels.
      const balance = Math.atan(V * V * Math.tan(Math.min(BIKE.steerMax, 0.6 / Math.max(1, V / 4)) * GS) / (G * BIKE.L));
      const want = Math.min(BIKE.maxLean, Math.min(reach, balance) + 2 * D2R, s.slideCap);
      s.stop = want >= s.stop ? want : Math.max(want, s.stop - STAND_UP * dt);
      if (Math.abs(s.phi) > s.stop) { s.phi = Math.sign(s.phi) * s.stop; if (s.phi * s.phiDot > 0) s.phiDot = 0; }
      s.r = V * Math.tan(s.steer * GS) / BIKE.L;
    }
    // The front wheel in the air (a wheelie) or both off the ground: the bars turn nothing, the
    // bike keeps the yaw it had.
    if (Nf === 0 && (s.theta > 0.002 || s.air)) s.r = rPrev;
    // Past the grip the tyres slide and the bike runs wide: the turn saturates, it does not fall.
    // A front skidding locked has its sliding friction only (≈0.8 of its grip).
    let ay = s.u * s.r;
    const ayMax = G * Math.sqrt(Math.max(0, mu * mu - (s.axTyre / G) ** 2)) * (s.lock > 0 ? 0.8 : 1);
    if (Math.abs(ay) > ayMax && V > 0.5) { ay = Math.sign(ay) * ayMax; s.r = ay / V; s.sliding = true; }
    s.ay = ay;
    // Running wide, the bike comes up to the lean its turn balances (atan of the lateral
    // acceleration) at the same pace as the lean limit, instead of hanging leant over a straight line.
    if (s.sliding && V >= 3) s.slideCap = Math.max(Math.atan(Math.abs(ay) / G) + 2 * D2R, Math.min(s.slideCap, Math.abs(s.phi)) - STAND_UP * dt);
    else s.slideCap = Math.min(BIKE.maxLean, s.slideCap + 1.5 * dt);
    // How hard the tyres are working past their grip, for the marks, the smoke and the sound
    // (spinning the rear without the aids counts too).
    const demand = Math.hypot(s.axTyre, ay) / G;
    const over = Math.max(0, demand / mu - 0.98) * 6 + (s.sliding ? 0.3 : 0) + (!s.aids && s.slip > 0.3 ? Math.min(1, s.slip - 0.3) : 0);
    s.slide += (Math.min(1, over) - s.slide) * Math.min(1, dt * 8);
    // Too deep: the water reaches the intake and the engine drowns; the bike stays up (the rider's
    // feet), stopped by the water (R picks it up out of it).
    if (depth > 0.45 && !s.drowned) { s.drowned = true; s.drownedAt = s.t; }
    // Where to pick it up if it goes down: the last dry, clear spot it stood upright on (every 0.5 s).
    if (!s.drowned && depth < 0.05 && Math.abs(s.phi) < 0.35 && s.t - s.scrape > 1.5 && s.t - (s.safeT ?? -1) > 0.5) { s.safe = { x: s.x, z: s.z, psi: s.psi }; s.safeT = s.t; }

    // ---- Move. + r turns right: the heading ψ (anticlockwise from above) decreases. In steps of
    // 10 cm at most, each checked against what stands on the ground: at 255 km/h a whole step
    // (0.3 m) was more than a wall of posts is thick, and the bike went through.
    s.psi -= s.r * dt;
    const c2 = Math.cos(s.psi), sn2 = Math.sin(s.psi);
    const n = Math.max(1, Math.ceil(s.u * dt / 0.1));
    s.impact = 0;
    for (let k = 0; k < n && !s.crashed; k++) {
      s.x += s.u * Math.cos(s.psi) * dt / n; s.z -= s.u * Math.sin(s.psi) * dt / n;
      collide(dt, false);
    }
    const c3 = Math.cos(s.psi), sn3 = Math.sin(s.psi);
    void c2; void sn2;
    const hf = ground(s.x + (BIKE.L / 2) * c3, s.z - (BIKE.L / 2) * sn3).h, hr = ground(s.x - (BIKE.L / 2) * c3, s.z + (BIKE.L / 2) * sn3).h;
    const gy = (hf + hr) / 2, pitch = Math.atan2(hf - hr, BIKE.L);
    // Over a crest taken fast the ground falls away faster than gravity can pull the bike down
    // after it: it flies, keeping its pitch, and lands on its springs. (The vertical speed along
    // the slope, u·sin(pitch), so a kerb's step is ridden over, not launched from.)
    const vSlope = s.u * Math.sin(pitch);
    if (!Number.isFinite(s.vy)) s.vy = vSlope;
    if (!s.air) {
      if ((vSlope - s.vy) / dt < -G && s.u > 8) { s.air = true; s.vy -= G * dt; s.y += s.vy * dt; }
      else { s.vy = vSlope; s.y = gy; s.gradePitch = pitch; }
    } else {
      s.vy -= G * dt; s.y += s.vy * dt;
      if (s.y <= gy) {
        // Landing: what the slope does not take of the fall goes into the springs.
        const hit = Math.max(0, vSlope - s.vy);
        s.vF += hit * 0.5; s.vR += hit * 0.5;
        s.air = false; s.y = gy; s.vy = vSlope; s.gradePitch = pitch;
      }
    }
    s.wheelAngleF += s.u / BIKE.RF * dt; s.wheelAngleR += s.wR * dt;
  }

  /**
   * The bike's plan outline against the obstacles. Every penetration this step is merged into
   * one contact: a wall built of small circles has one normal (the line through its posts), not
   * one per post, which turned a graze into a head-on hit. Hit hard and square it goes down;
   * a glancing contact scrapes along, losing speed and turned along the wall.
   */
  function collide(dt, down) {
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    const pts = [[BIKE.front, 0], [BIKE.front * 0.6, 0.2], [BIKE.front * 0.6, -0.2], [0, 0.22], [0, -0.22], [BIKE.rear * 0.7, 0.15], [BIKE.rear * 0.7, -0.15], [BIKE.rear, 0]];
    const near = obstacles(s.x, s.z);
    let nx = 0, nz = 0, depth = 0, hitPx = 0, hitPy = 0;
    for (const o of near) for (const [px, py] of pts) {
      const wx = s.x + px * c - py * sn, wz = s.z - px * sn - py * c;
      const dx = wx - o.x, dz = wz - o.z, d = Math.hypot(dx, dz);
      if (d >= o.r || d < 1e-6) continue;
      const pen = o.r - d;
      nx += dx / d * pen; nz += dz / d * pen;
      if (pen > depth) { depth = pen; hitPx = px; hitPy = py; }
    }
    const nl = Math.hypot(nx, nz);
    if (nl < 1e-9) return;
    nx /= nl; nz /= nl;
    // A wall of posts: its normal from the line through the posts near the contact (their
    // principal axis), when they do make a line.
    {
      const hx = s.x + hitPx * c - hitPy * sn, hz = s.z - hitPx * sn - hitPy * c;
      const line = near.filter(o => Math.hypot(o.x - hx, o.z - hz) < 0.8);
      if (line.length >= 3) {
        let mx = 0, mz = 0;
        for (const o of line) { mx += o.x; mz += o.z; }
        mx /= line.length; mz /= line.length;
        let sxx = 0, szz = 0, sxz = 0;
        for (const o of line) { const dx = o.x - mx, dz = o.z - mz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
        const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ex = Math.cos(ang), ez = Math.sin(ang);
        const l1 = (sxx + szz) / 2 + Math.hypot((sxx - szz) / 2, sxz), l2 = (sxx + szz) - l1;
        if (l1 > 4 * l2) { let wx = -ez, wz = ex; if (wx * nx + wz * nz < 0) { wx = -wx; wz = -wz; } nx = wx; nz = wz; }
      }
    }
    // Out against the motion, never along it: a point that has crossed a post's centre gives a
    // normal pointing on, which pushed the bike through the wall.
    const vx = down ? s.vx : s.u * c, vz = down ? s.vz : -s.u * sn;
    if (vx * nx + vz * nz > 0 && Math.hypot(vx, vz) > 0.5) { nx = -nx; nz = -nz; }
    s.x += nx * depth; s.z += nz * depth;
    const vn = -(vx * nx + vz * nz);
    if (vn <= 0) return;
    s.impact = Math.max(s.impact, vn);
    s.hits.push({ px: hitPx, py: hitPy, vn, nx, nz });
    if (down) { s.vx += nx * vn * 1.2; s.vz += nz * vn * 1.2; return; }
    const speed = Math.hypot(vx, vz), angle = Math.asin(Math.min(1, vn / Math.max(1e-6, speed)));
    // Down only from a hard, square hit (≈45 km/h of closing speed, more than 30° on); anything
    // less bounces off or scrapes along, the rider staying on.
    if (vn > CRASH.vn && angle > CRASH.angle) {
      fall(`Hit it at ${(vn * 3.6).toFixed(0)} km/h.`, hitPy >= 0 ? -1 : 1);
      s.vx = vx + nx * vn * 1.3; s.vz = vz + nz * vn * 1.3;
      return;
    }
    // Square on but slow: it stops against it and bounces back a little.
    if (angle > CRASH.angle) {
      const tx = vx + nx * vn, tz = vz + nz * vn, vt = Math.hypot(tx, tz);
      s.u = Math.max(0, vt * 0.5); s.wR = s.u / BIKE.RR; s.phiDot *= 0.3;
      s.x += nx * 0.05; s.z += nz * 0.05; s.scrape = s.t;
      if (vt > 0.5) s.psi = Math.atan2(-tz, tx);
      return;
    }
    // Glancing: the normal speed is lost, the bike is turned along the wall and scrubs speed.
    const tx = vx + nx * vn, tz = vz + nz * vn, vt = Math.hypot(tx, tz);
    s.u = vt * Math.max(0.6, 1 - vn / 20); s.wR = s.u / BIKE.RR;
    if (vt > 0.5) s.psi = Math.atan2(-tz, tx);
    s.phiDot *= 0.5;
    s.scrape = s.t;
  }

  /**
   * Picks the bike up (R): upright and stopped, where it lies if that spot is dry and clear of
   * what it hit, else on the last such spot it stood on, facing the way it went. The engine runs
   * again (a drowned one too: ≈ this simulation's kindness). The gear back to neutral.
   */
  function pickUp() {
    const clear = (x, z) => {
      const g = ground(x, z), wet = g.water !== undefined && g.water - g.h > 0.05;
      return !wet && !obstacles(x, z).some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.6);
    };
    const here = clear(s.x, s.z) ? { x: s.x, z: s.z, psi: s.psi } : s.safe;
    const aids = s.aids, manual = s.manual;
    reset(here);
    s.aids = aids; s.manual = manual;
  }

  let acc = 0;
  function advance(dt) {
    acc = Math.min(acc + dt, 0.25);
    const h = 1 / 240;
    while (acc >= h) { step(h); acc -= h; }
  }
  return { state: s, input, reset, advance, step, fall, pickUp };
}
