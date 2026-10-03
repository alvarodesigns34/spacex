/**
 * The Porsche 911 GT3 RS's dynamics: a four-wheel vehicle model over the ground of this same
 * scene, with the published engine, gearbox, mass, geometry and aerodynamics (data/gt3rs.js) and
 * tyres, suspension and driveline that are not published (≈).
 *
 * What it is:
 *  - the body moves over the ground plane (x, z, yaw); under it, the ground at each of the four
 *    contact patches and the plane through them. On a slope the weight pulls along it, so the car
 *    rolls back unbraked. The body rides that plane on springs and dampers that can only push
 *    (SUSPENSION): heave, pitch and roll, each wheel's load gaining what its spring adds, a twisted
 *    ground loading one diagonal; over a crest taken fast the car goes light and leaves the ground,
 *    its tyres carrying nothing until it lands;
 *  - four tyres, each with its own load (static share, longitudinal and lateral transfer,
 *    downforce, the springs'), slip ratio and slip angle, combined through one "magic formula" on
 *    the normalised slip, so a tyre that is spinning or locked has less grip sideways — which is
 *    what lets the car drift and leaves the marks; Ackermann steering, the inner front turning tighter;
 *  - the engine on its own inertia and its full-load curve (465 Nm at 6,300 rpm and 386 kW at
 *    8,500, published; the rest of the curve ≈); the PDK's clutch, which takes up the drive pulling
 *    away, opens through each 0.1 s shift (≈) and closes again (blipping the engine up to the lower
 *    gear's speed on a downshift), and keeps the engine's drag off the rears on the brakes; Launch
 *    Control (brake and throttle at a standstill); the seven ratios and the 4.27 final drive
 *    (published); the rear wheels joined by a locking differential (≈ its locking torque);
 *  - brakes split 66/34 (≈) with a continuous ABS that holds each wheel near its peak slip,
 *    and a parking brake on the rears that ABS does not touch;
 *  - PSM, on by default as on the road car (traction and stability control, and a drift started
 *    with the parking brake that it stands back for), its own module (gt3Assists.js);
 *  - drag and downforce from the published downforce and the published top speed; the active
 *    aerodynamics in three states: DRS on a straight at full throttle, as Porsche's Auto-DRS
 *    does, the airbrake hard on the brakes from speed, and the normal setting between;
 *  - rear-axle steering, opposite to the fronts at low speed and with them at high (≈ angles);
 *  - contacts with what stands on the ground: the scene's own solid geometry (core/colliders.js)
 *    and the other exhibits;
 *  - water (core/water.js): wet grip and aquaplaning, the drag of the water each tyre and the
 *    body push through, the lift of what the body displaces, flooding, a drowned engine.
 *
 * Frame: world x, z (y up); the car's heading ψ is the angle of its nose from +x towards −z
 * (the scene's yaw), body velocity (u forward, v to the LEFT).
 */
import { ENGINE, GEARBOX, WHEELS, BRAKES, BODY, AERO, TYRES, PERFORMANCE, SUSPENSION, CLUTCH } from '../data/gt3rs.js';
import { psmActive, tractionControl, stability, rearBrakeShare, abs } from './gt3Assists.js';

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

/**
 * The car's outline in plan for contacts, in the body frame from the CG: the published length and
 * width, the ends at the published overhangs ahead of and behind the axles (DERIVED ≈).
 */
export const OUTLINE = { front: CAR.a + BODY.overhangFront, rear: -(CAR.b + BODY.overhangRear), half: BODY.width / 2 };
/** Contacts: how much of the closing speed comes back (a bumper's and a barrier's give, ≈), and the sliding friction. */
const RESTITUTION = 0.22, CONTACT_MU = 0.5;
/**
 * Water (core/water.js): the ground function gives each tyre the water's surface over its bed.
 *  - Tyres: a film past ≈3 mm takes some of the grip (≈0.85 of the surface's own, ≈), and fast
 *    enough a tyre rides up on the water and loses nearly all of it: aquaplaning from ≈0.8 of the
 *    speed Horne's NASA rule gives for its pressure, V ≈ 10.35·√p (mph, p in psi), ≈94 km/h at
 *    ≈2.2 bar (the pressure ≈). Each tyre ploughs the water it runs in, ½ρ·Cd·(width × depth)·v²,
 *    Cd ≈0.7 (≈): one side in a pool pulls the car round.
 *  - The body: deeper than its floor (≈0.14 m up), it pushes the water ahead of it and aside,
 *    ½ρ·Cd·(its width, or length, × the depth over the floor)·v², Cd ≈1; and it floats on what it
 *    displaces, ≈80 % of its plan times that depth, ρg, less what has flooded in. Water over the
 *    floor finds its way in, ≈45 s to full with the sills under (≈0.3 m over the floor), slower
 *    shallower (≈: a car sinks in tens of seconds to minutes; there is no figure for this one),
 *    and the car goes down.
 *  - The engine drowns when the water reaches its intake (≈0.65 m over the bed at the rear axle).
 */
const WATER = {
  rho: 1000, film: 0.003, wetMu: 0.85, vAq: 26.1, tyreCd: 0.7, floor: 0.14, bodyCd: 1.0,
  plan: 0.8, sills: 0.3, floodTime: 45, intake: 0.65, sunk: 1.2,
};
const TYRE_W = [WHEELS.front.width, WHEELS.front.width, WHEELS.rear.width, WHEELS.rear.width];

export function createGt3Car({ ground = () => ({ h: 0, mu: 1, roll: 0, kind: 'track' }), obstacles = () => [] } = {}) {
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
    steerW: [0, 0, 0, 0],             // each wheel's steering angle (Ackermann at the front, the rear-axle steering)
    aero: 'normal',                   // the active aerodynamics: 'normal', 'drs' or 'airbrake'
    clutchLocked: false, shiftDir: 0, // the PDK's clutch closed (engine and wheels together), the last shift's direction
    launch: false,                    // Launch Control armed (brake and throttle at a standstill) or launching
    hz: 0, hzV: 0, bp: 0, bpV: 0, br: 0, brV: 0,   // the body on its springs: height, pitch (nose up), roll (left up), and rates
    gnd: [0, 0, 0],                   // the ground plane's height at the CG and its pitch and roll, last step
    travel: [0, 0, 0, 0],             // each wheel's travel from the body's plane, m (+ compressed)
    air: 0,                           // s airborne
    impact: 0,                        // the hardest contact this step: closing speed, m/s
    wet: 0,                           // s since the engine drowned (0 while it runs)
    drowned: false,                   // the engine has taken in water: dead until the car is reset
    water: [0, 0, 0, 0],              // the water's depth at each tyre, m
    immersion: 0,                     // the water's depth over the body's floor, m
    flood: 0,                         // how far the body has flooded, 0..1
    afloat: false, sunk: false,
  });
  const s = Object.assign(fresh(), { tc: true });   // PSM (traction and stability control): on by default
  const input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false };
  let acc = 0;                        // real time not yet stepped, s (under one step)

  function reset({ x = 0, z = 0, psi = 0 } = {}) {
    Object.assign(s, fresh(), { x, z, psi, tc: s.tc });
    Object.assign(input, { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false });
    acc = 0;
    // The body settled on the ground where it stands.
    const g = groundPlane();
    Object.assign(s, { hz: g.hc, bp: g.th, br: g.ph, y: g.hc });
    s.gnd = [g.hc, g.th, g.ph];
  }
  /** The ground under each tyre and the plane through the four: its height at the CG, pitch (nose up) and roll (left up), and its twist. */
  function groundPlane() {
    const grs = WP.map(([px, py]) => ground(...worldOf(px, py)));
    const hF = (grs[0].h + grs[1].h) / 2, hR = (grs[2].h + grs[3].h) / 2;
    const gx = (hF - hR) / CAR.L;
    const gy = ((grs[0].h - grs[1].h) / CAR.tf + (grs[2].h - grs[3].h) / CAR.tr) / 2;
    return { grs, hc: hR + gx * CAR.b, th: Math.atan(gx), ph: Math.atan(gy), warp: ((grs[0].h - grs[1].h) - (grs[2].h - grs[3].h)) / 2 };
  }
  /** Inputs from a device, a script or a replay: a number out of range or not a number at all is clamped or zeroed here. */
  const fin = (x, lo, hi) => (Number.isFinite(x) ? clamp(x, lo, hi) : 0);

  // The wheels' positions in the body frame (forward, left), FL, FR, RL, RR.
  const WP = [[CAR.a, CAR.tf / 2], [CAR.a, -CAR.tf / 2], [-CAR.b, CAR.tr / 2], [-CAR.b, -CAR.tr / 2]];
  const RAD = [CAR.rf, CAR.rf, CAR.rr, CAR.rr];
  const GEO = { L: CAR.L, tf: CAR.tf, tr: CAR.tr, R: RAD, mu: TYRES.mu };

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
    // Airbrake: hard on the brakes from speed, the flaps at their steepest for more drag.
    const airbrake = !s.drs && input.brake > AERO.airbrakePedal && s.u > AERO.airbrakeSpeed;
    s.aero = s.drs ? 'drs' : airbrake ? 'airbrake' : 'normal';
    const cdA = s.drs ? AERO.cdA : AERO.cdAHigh * (airbrake ? AERO.airbrakeCdFactor : 1);
    const clA = AERO.clA * (s.drs ? AERO.drsClFactor : 1);
    const kD = 0.5 * AERO.rho * cdA * V;
    const dragX = kD * s.u, dragY = kD * s.v, down = 0.5 * AERO.rho * s.u * s.u * clA;
    // ---- The ground, and the body on its springs (SUSPENSION): heave, pitch and roll follow the
    // plane through the four contact patches, through springs and dampers that can only push —
    // over a crest taken fast the car goes light, and leaves the ground.
    const gp = groundPlane(), grs = gp.grs, S = SUSPENSION;
    // ---- Water: its depth at each tyre, and over the body's floor; the lift it gives, flooding.
    let wS = -Infinity;
    for (let i = 0; i < 4; i++) {
      const wsf = grs[i].water;
      s.water[i] = Number.isFinite(wsf) ? Math.max(0, wsf - grs[i].h) : 0;
      if (Number.isFinite(wsf)) wS = Math.max(wS, wsf);
    }
    const imm = Number.isFinite(wS) ? clamp(wS - (s.hz + WATER.floor), 0, 1.1) : 0;
    s.immersion = imm;
    // Water over the floor finds its way in through the seals and vents, faster the deeper it is.
    if (imm > 0.12) s.flood = Math.min(1, s.flood + dt / WATER.floodTime * clamp(imm / WATER.sills, 0.4, 2));
    const planA = WATER.plan * BODY.length * BODY.width;
    const buoy = WATER.rho * G * planA * imm * (1 - 0.92 * s.flood);
    const lifted = clamp(buoy / (CAR.m * G), 0, 1);
    // Afloat, the body rides at its draft on the water instead of on its springs.
    const draft = CAR.m / (WATER.rho * planA * Math.max(0.08, 1 - 0.92 * s.flood));
    const floatH = Number.isFinite(wS) ? wS - draft - WATER.floor : -Infinity;
    // (Only while what it displaces, the body's height at most, can hold its weight up.)
    s.afloat = draft < 1.1 && floatH > gp.hc + 0.02;
    // Afloat it rides level on the water, and the bed's slope no longer acts on it.
    if (s.afloat) { gp.hc = floatH; gp.th = 0; gp.ph = 0; gp.warp = 0; }
    s.sunk = Number.isFinite(wS) && wS - s.hz > WATER.sunk;
    const wH = TAU * S.heaveHz, wP = TAU * S.pitchHz, wL = TAU * S.rollHz;
    const hcDot = clamp((gp.hc - s.gnd[0]) / dt, -3, 3), thDot = clamp((gp.th - s.gnd[1]) / dt, -3, 3), phDot = clamp((gp.ph - s.gnd[2]) / dt, -3, 3);
    s.gnd[0] = gp.hc; s.gnd[1] = gp.th; s.gnd[2] = gp.ph;
    // (No faster down than the weight and the downforce pull it, with the springs pushing nothing.)
    const aH = Math.max(-G - down / CAR.m, wH * wH * (gp.hc - s.hz) + 2 * S.zeta * wH * (hcDot - s.hzV));
    const carried = (G + aH + down / CAR.m) / (G + down / CAR.m);   // the share of the load on the springs: 0 in the air
    const aP = carried > 0.02 ? wP * wP * (gp.th - s.bp) + 2 * S.zeta * wP * (thDot - s.bpV) : 0;
    const aR = carried > 0.02 ? wL * wL * (gp.ph - s.br) + 2 * S.zeta * wL * (phDot - s.brV) : 0;
    s.hzV += aH * dt; s.hz += s.hzV * dt;
    s.bpV += aP * dt; s.bp += s.bpV * dt;
    s.brV += aR * dt; s.br += s.brV * dt;
    // The bump stops.
    if (s.hz < gp.hc - S.bump) { s.hz = gp.hc - S.bump; s.hzV = Math.max(s.hzV, hcDot); }
    s.air = carried < 0.02 ? s.air + dt : 0;
    // ---- Loads: static share (of the weight's part normal to the slope), downforce, the transfer
    // from the last step's accelerations, and what the springs add as the body heaves, pitches and rolls.
    const mg = CAR.m * G * Math.cos(gp.th) * Math.cos(gp.ph);
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
    if (aH !== 0 || aP !== 0 || aR !== 0 || gp.warp !== 0) {
      const heave = CAR.m * aH, pitch = S.inertiaPitch * aP / CAR.L, rollF = S.inertiaRoll * aR / (2 * CAR.tf), rollR = S.inertiaRoll * aR / (2 * CAR.tr);
      const warp = S.warp * gp.warp / 2;
      const shareF = CAR.b / CAR.L / 2, shareR = CAR.a / CAR.L / 2;
      load[0] = Math.max(0, load[0] + heave * shareF + pitch / 2 + rollF + warp);
      load[1] = Math.max(0, load[1] + heave * shareF + pitch / 2 - rollF - warp);
      load[2] = Math.max(0, load[2] + heave * shareR - pitch / 2 + rollR - warp);
      load[3] = Math.max(0, load[3] + heave * shareR - pitch / 2 - rollR + warp);
    }
    if (carried < 0.02) load.fill(0);
    // What the water carries, the tyres do not.
    if (lifted > 0) for (let i = 0; i < 4; i++) load[i] *= 1 - lifted;
    // ay > 0 is to the left: the right-hand tyres take the load.
    s.load = load;
    // ---- Steering: the fronts, and the rears a little (opposite slow, with them fast).
    const ds = input.steer * CAR.maxSteer - s.steer;
    s.steer += clamp(ds, -2.2 * dt, 2.2 * dt);   // ≈ the rack's rate, rad/s at the wheels
    const kRear = clamp((s.u - 14) / 14, -1, 1);  // −1 below 50 km/h, +1 above 100
    const rearAngle = kRear * CAR.rearSteer * Math.abs(s.steer) / CAR.maxSteer * Math.sign(s.steer);
    const steerAt = [s.steer, s.steer, rearAngle, rearAngle];
    // Ackermann: the inner front wheel turns tighter than the outer (a share of the full geometry).
    if (Math.abs(s.steer) > 1e-4) {
      const d = Math.abs(s.steer), Rt = CAR.L / Math.tan(d), k = SUSPENSION.ackermann, sg = Math.sign(s.steer);
      const dIn = sg * (d + k * (Math.atan(CAR.L / (Rt - CAR.tf / 2)) - d)), dOut = sg * (d + k * (Math.atan(CAR.L / (Rt + CAR.tf / 2)) - d));
      steerAt[0] = s.steer > 0 ? dIn : dOut; steerAt[1] = s.steer > 0 ? dOut : dIn;
    }
    for (let i = 0; i < 4; i++) s.steerW[i] = steerAt[i];
    // In water: the engine drowns once the water reaches its intake, and stays dead.
    if (Number.isFinite(wS) && wS - (grs[2].h + grs[3].h) / 2 > WATER.intake) s.drowned = true;
    const drowned = s.drowned;
    s.wet = drowned ? s.wet + dt : 0;
    // ---- Drive: the engine on its own inertia, the PDK's clutch, the gearbox.
    const ratio = s.reverse ? -GEARBOX.reverse : GEARBOX.ratios[s.gear - 1];
    const Gt = ratio * GEARBOX.final;
    const wRear = (s.w[2] + s.w[3]) / 2;
    const wc = wRear * Gt;                 // the clutch's driven side, at engine speed (rad/s)
    const rpmWheel = wc * RPM;
    if (s.shift > 0) s.shift -= dt;
    const shifting = s.shift > 0;
    // The throttle the engine gets: cut through an upshift, blipped through a downshift to bring
    // it up to the lower gear's speed, and opened a little at idle (the idle governor).
    let thr = input.throttle;
    if (shifting) thr = s.shiftDir > 0 ? 0 : clamp((rpmWheel - s.rpm) / 900, 0, 1);
    if (!s.clutchLocked) thr = Math.max(thr, clamp((ENGINE.idle + 120 - s.rpm) / 400, 0, 0.35));
    // Launch Control: at a standstill with the brake and the throttle both pressed, the engine is
    // held at the launch speed, the clutch open; let go of the brake and the car goes.
    const standing = Math.abs(s.u) < 0.5 && !s.reverse;
    if (standing && input.brake > 0.5 && input.throttle > 0.5) s.launch = true;
    else if (s.launch && (input.throttle < 0.5 || Math.abs(rpmWheel) > CLUTCH.launchRpm - 400)) s.launch = false;
    const held = s.launch && input.brake > 0.1;
    if (held) thr = clamp((CLUTCH.launchRpm - s.rpm) / 600, 0, 1);
    const limiter = s.rpm >= ENGINE.maxRpm ? 0 : 1;
    const Te = drowned ? -(ENGINE.friction[0] + ENGINE.friction[1] * s.rpm) * 4 : thr * fullTorque(s.rpm) * limiter - (1 - thr) * (ENGINE.friction[0] + ENGINE.friction[1] * s.rpm);
    // The clutch: open through a shift; pulling away, slipping — taking up the drive as the engine
    // gathers revs, or, launching, holding it at the launch speed; otherwise closed, up to its capacity.
    // (Launching, it slips until the wheels have caught the engine up.)
    const launching = s.launch || (Math.abs(rpmWheel) < 1800 && (input.throttle > 0.02 || Math.abs(s.u) < 2));
    let cap;
    if (shifting || held) cap = 0;
    else if (launching && s.launch) cap = clamp(Te + 0.6 * (s.rpm - CLUTCH.launchRpm), 0, CLUTCH.capacity);
    else if (launching) cap = input.throttle > 0.02 ? input.throttle * CLUTCH.capacity * clamp((s.rpm - ENGINE.idle) / (CLUTCH.launchRpm - ENGINE.idle), 0, 1) ** 2 : 0;
    else cap = CLUTCH.capacity;
    // Engine drag control: hard on the brakes, or with the ABS easing a rear, the clutch lets the
    // engine's drag and inertia through only up to a little torque, so they cannot lock the rears.
    const absRear = Math.min(s.absK[2], s.absK[3]) < 0.95;
    if (input.brake > 0.5 || absRear) cap = Math.min(cap, CLUTCH.dragCap);
    const we = s.rpm / RPM;
    if (s.clutchLocked && (launching || shifting || Math.abs(Te) > cap)) s.clutchLocked = false;
    else if (!s.clutchLocked && !launching && !shifting && Math.abs(we - wc) < CLUTCH.slipBand && Math.abs(Te) <= cap) s.clutchLocked = true;
    let driveT, reflected = 0;            // torque at the rear axle (both wheels); the engine's inertia the rears carry
    if (s.clutchLocked) {
      driveT = Te * Gt * GEARBOX.efficiency;
      reflected = ENGINE.inertia * Gt * Gt;
    } else {
      const Tcl = cap * clamp((we - wc) / CLUTCH.slipBand, -1, 1);
      driveT = Tcl * Gt * GEARBOX.efficiency;
      s.rpm = Math.max(300, (we + (Te - Tcl) / ENGINE.inertia * dt) * RPM);
    }
    // Automatic shifts (the PDK in its automatic mode).
    if (!s.reverse && s.shift <= 0) {
      // Up on the road speed's rpm (not a spinning wheel's), down with hysteresis: 2,600 rpm
      // pulling, 4,200 braking, and never into a gear that would over-rev.
      const below = s.gear > 1 ? rpmWheel * GEARBOX.ratios[s.gear - 2] / GEARBOX.ratios[s.gear - 1] : Infinity;
      const roadRpm = (s.u / CAR.rr) * Gt * RPM;
      if (Math.min(s.rpm, roadRpm * 1.08) > GEARBOX.upshiftRpm && s.gear < 7 && input.throttle > 0.1) { s.gear++; s.shift = GEARBOX.shiftTime; s.shiftDir = 1; }
      else if (s.gear > 1 && below < 7600 && rpmWheel < (input.brake > 0.1 ? GEARBOX.downshiftRpm : 2600)) { s.gear--; s.shift = GEARBOX.shiftTime * 0.8; s.shiftDir = -1; }
    }
    // Reverse: from a standstill, the brake held.
    if (!s.reverse && input.reverse && Math.abs(s.u) < 0.5) { s.reverse = true; s.gear = 1; }
    if (s.reverse && !input.reverse && input.throttle > 0) s.reverse = false;
    // ---- Driver aids (gt3Assists.js): PSM working or standing back for a drift, traction control, stability control.
    const beta = Math.atan2(s.v, Math.max(1, Math.abs(s.u)));
    const psm = psmActive(s, input, dt, beta);
    driveT *= tractionControl(s, psm, SLIP_PEAK, dt);
    const aid = stability(s, input, psm, beta, GEO);
    driveT *= aid.drive;
    s.r += aid.yaw / CAR.Iz * dt;
    const escBrake = aid.brake, escKeep = aid.keep;
    // Locking differential: open, plus a locking torque that resists the two rears turning apart.
    const lock = clamp((s.w[2] - s.w[3]) * 400, -(250 + 0.45 * Math.abs(driveT)), 250 + 0.45 * Math.abs(driveT));
    const wheelDrive = [0, 0, driveT / 2 - lock, driveT / 2 + lock];
    // ---- Brakes: the pedal's force split front/rear by the hydraulics (≈ 66/34), the rears' share
    // trimmed to the load they carry (electronic brake-force distribution: as the weight comes
    // forward the rears would lock first and the tail come round), and the stability control's.
    const tB = input.brake * 1.9 * mg;    // ≈ the pedal's full force, N, at the contact patches
    const rearShare = rearBrakeShare(s, BRAKES.bias, load[0] + load[1], load[2] + load[3], TYRES.mu);
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
      const gr = grs[i];
      s.surface[i] = gr.kind;
      let mu = TYRES.mu * AXLE_MU[i] * gr.mu * (1 - TYRES.muLoadSens * (load[i] / (mg / 4) - 1));
      // Water on the road: less grip, and fast enough, aquaplaning.
      if (s.water[i] > WATER.film) {
        const ride = clamp((Math.abs(wx) - 0.8 * WATER.vAq) / (0.3 * WATER.vAq), 0, 1) * clamp(s.water[i] / 0.008, 0, 1);
        mu *= WATER.wetMu * (1 - 0.9 * ride);
      }
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
      abs(s, i, brakeT[i] > 0, wx, kap0, SLIP_PEAK, dt);
      // The parking brake works on the rears past the ABS: that is what locks them for a drift.
      let bt = brakeT[i] * s.absK[i] * escKeep[i] + (i >= 2 ? handT : 0);
      const e = 0.01, k = (tyre(s.w[i] + e)[0] - fx0) / e;           // dFx/dω
      const bSign = Math.abs(s.w[i]) > 0.3 ? Math.sign(s.w[i]) : Math.sign(wx) || 1;
      const net0 = wheelDrive[i] - fx0 * R - bSign * bt;
      const Iw = CAR.Iw[i] + (i >= 2 ? reflected / 2 : 0);
      let wn = s.w[i] + dt * net0 / (Iw + dt * k * R);
      // A brake stops a wheel; it cannot turn it backwards.
      if (bt > Math.abs(wheelDrive[i]) && Math.sign(wn) !== Math.sign(s.w[i]) && Math.abs(s.w[i]) > 0) wn = 0;
      s.w[i] = wn;
      const [fx, fy, sl, kap] = tyre(wn);
      s.slip[i] = sl; s.kap[i] = kap;
      // Rolling resistance and the surface's drag (gravel) act on the car, not through the wheel.
      roll += (TYRES.rolling + gr.roll) * load[i] * Math.tanh(wx / 0.5);
      // The water the tyre ploughs through, against its rolling.
      const fw = s.water[i] > 0 ? 0.5 * WATER.rho * WATER.tyreCd * TYRE_W[i] * Math.min(s.water[i], 2 * R) * wx * Math.abs(wx) : 0;
      // Back to the body frame.
      const bx = (fx - fw) * cd - fy * sd, by = (fx - fw) * sd + fy * cd;
      Fx += bx; Fy += by;
      Mz += px * by - py * bx;
    }
    Fx -= roll;
    // ---- Body.
    Fx -= dragX; Fy -= dragY;
    // The body pushing the water ahead of it and aside, and the water damping its turning.
    if (imm > 0) {
      const kW = 0.5 * WATER.rho * WATER.bodyCd * imm;
      Fx -= kW * BODY.width * s.u * Math.abs(s.u); Fy -= kW * BODY.length * s.v * Math.abs(s.v);
      Mz -= kW * BODY.width * BODY.length ** 3 / 32 * s.r * Math.abs(s.r);
    }
    // On a slope, the weight's part along it (as far as the springs carry the car).
    const onBed = carried * (1 - lifted);
    const axB = Fx / CAR.m - G * Math.sin(gp.th) * onBed, ayB = Fy / CAR.m - G * Math.sin(gp.ph) * onBed;
    s.u += (axB + s.v * s.r) * dt;
    s.v += (ayB - s.u * s.r) * dt;
    s.r += Mz / CAR.Iz * dt;
    // At a standstill, no creeping: friction holds it.
    // (Not on a slope steeper than the rolling resistance holds, without the brake: there it rolls.)
    if (V < 0.05 && input.throttle === 0 && !s.afloat && (input.brake > 0.05 || Math.abs(Math.sin(gp.th)) < TYRES.rolling * 1.5)) { s.u *= 0.9; s.v *= 0.9; s.r *= 0.9; }
    s.ax += (axB - s.ax) * Math.min(1, dt * 12);
    s.ay += (ayB - s.ay) * Math.min(1, dt * 12);
    // Heading and position (ψ from +x towards −z: forward is (cos ψ, −sin ψ) in x, z; left is (−sin ψ, −cos ψ)).
    s.psi += s.r * dt;
    // The move, and the contacts along it: in steps of 10 cm at most, so a fast car meets a thin
    // fence instead of stepping over it between two checks.
    const dxm = (s.u * c - s.v * sn) * dt, dzm = (-s.u * sn - s.v * c) * dt;
    const nm = Math.max(1, Math.ceil(Math.hypot(dxm, dzm) / 0.1));
    s.impact = 0;
    for (let k = 0; k < nm; k++) { s.x += dxm / nm; s.z += dzm / nm; contacts(); }
    // The engine follows the wheels while the clutch is closed (a stalling engine opens it).
    if (s.clutchLocked) {
      s.rpm = (s.w[2] + s.w[3]) / 2 * Gt * RPM;
      // Off the throttle near idle the PDK opens the clutch, as it would before the engine stalled.
      if (s.rpm < ENGINE.idle * (input.throttle < 0.05 ? 1.15 : 0.75)) { s.clutchLocked = false; s.rpm = Math.max(s.rpm, 300); }
    }
    // Height: the body on its springs; each wheel's travel from the body's plane (for the look).
    s.y = s.hz;
    for (let i = 0; i < 4; i++) s.travel[i] = clamp(grs[i].h - (s.hz + Math.tan(s.bp) * WP[i][0] + Math.tan(s.br) * WP[i][1]), -SUSPENSION.droop, SUSPENSION.bump);
    // Pitch and roll on top of the body's attitude: the load transfer, sprung (≈, the look).
    const pT = s.ax * 0.0035, rT = s.ay * 0.006;       // ≈ rad per m/s²: nose up under power, out of the turn
    s.pitchV += ((pT - s.pitch) * 120 - s.pitchV * 16) * dt; s.pitch += s.pitchV * dt;
    s.rollV += ((rT - s.roll) * 110 - s.rollV * 15) * dt; s.roll += s.rollV * dt;
    s.t += dt;
  }
  /**
   * Contacts with what stands on the ground: obstacles(x, z) gives circles in plan ({ x, z, r }).
   * The car's outline is pushed out of each, the closing speed turned back by the restitution and
   * the sliding along it braked by friction, the impulse acting where they touch, so a glancing
   * blow turns the car. s.impact keeps the hardest closing speed of the step.
   */
  function contacts() {
    for (const o of obstacles(s.x, s.z)) {
      const c = Math.cos(s.psi), sn = Math.sin(s.psi);
      // The obstacle's centre in the body frame (forward, left).
      const dx = o.x - s.x, dz = o.z - s.z, fx = dx * c - dz * sn, fy = -dx * sn - dz * c;
      let qx = clamp(fx, OUTLINE.rear, OUTLINE.front), qy = clamp(fy, -OUTLINE.half, OUTLINE.half);
      let nx = fx - qx, ny = fy - qy, pen;
      const d = Math.hypot(nx, ny);
      if (d >= o.r) continue;
      if (d > 1e-6) { nx /= d; ny /= d; pen = o.r - d; }
      else {
        // Its centre inside the outline: out through the nearest side.
        const sides = [[OUTLINE.front - fx, 1, 0], [fx - OUTLINE.rear, -1, 0], [OUTLINE.half - fy, 0, 1], [fy + OUTLINE.half, 0, -1]];
        const [m, ax, ay] = sides.reduce((a, b) => (b[0] < a[0] ? b : a));
        nx = ax; ny = ay; pen = m + o.r; qx = fx; qy = fy;
      }
      // Out, away from it.
      s.x -= (nx * c - ny * sn) * pen; s.z -= (-nx * sn - ny * c) * pen;
      // The contact point's velocity; moving into the obstacle, the impulse.
      const vx = s.u - s.r * qy, vy = s.v + s.r * qx, vn = vx * nx + vy * ny;
      if (vn <= 0) continue;
      s.impact = Math.max(s.impact, vn);
      const tx = -ny, ty = nx, rn = qx * ny - qy * nx, rt = qx * ty - qy * tx;
      const J = (1 + RESTITUTION) * vn / (1 / CAR.m + rn * rn / CAR.Iz);
      const vt = vx * tx + vy * ty, Jt = clamp(-vt / (1 / CAR.m + rt * rt / CAR.Iz), -CONTACT_MU * J, CONTACT_MU * J);
      const Ix = -J * nx + Jt * tx, Iy = -J * ny + Jt * ty;
      s.u += Ix / CAR.m; s.v += Iy / CAR.m; s.r += (qx * Iy - qy * Ix) / CAR.Iz;
    }
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
