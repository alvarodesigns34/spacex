/**
 * The Porsche 911 GT3 RS (type 992, model year 2023), every figure with where it comes from.
 * Tags as in the rest of the centre: PUBLISHED (a number printed in the source), DERIVED
 * (computed from published numbers), ESTIMATE (≈, reasoned, no source).
 *
 * Sources (downloaded for reference only, not in the repository):
 *  - Porsche AG, "Technical data 911 GT3 RS", MY P 08/2022, EU model (newsroom.porsche.com):
 *    the engine, gear ratios, steering, brakes, wheels and tyres, dimensions, weights and
 *    performance.
 *  - Porsche Cars North America, "The new Porsche 911 GT3 RS (992)" press kit (2022): the
 *    central radiator, the active aerodynamics, DRS and airbrake, 901 lb of downforce at
 *    124 mph and 1,896 lb at 177 mph.
 *
 * Frame for the model: x forward from the middle of the wheelbase, y up from the ground the
 * tyres stand on, z to the right.
 */
const KMH = 1 / 3.6, LB = 0.45359237, MPH = 0.44704;

/** The engine (technical data, page 1). */
export const ENGINE = {
  src: 'Porsche technical data 08/2022', tag: 'PUBLISHED',
  layout: 'six-cylinder naturally aspirated boxer, rear', displacement: 3996, bore: 102.0, stroke: 81.5,
  power: 386e3, powerRpm: 8500,          // 386 kW (525 PS) at 8,500 /min
  torque: 465, torqueRpm: 6300,          // 465 Nm at 6,300 /min
  maxRpm: 9000, compression: 13.3,
  // The full-load curve between the published points is not published: ≈ a high-revving
  // naturally aspirated six (flat from 4,000, peaking at 6,300, 434 Nm at 8,500 by the power
  // figure, falling to the 9,000 /min cut). ESTIMATE except the two marked points.
  torqueCurve: [[800, 260], [1500, 300], [2500, 350], [3500, 395], [4500, 425], [5500, 450],
    [6300, 465], [7000, 460], [7800, 448], [8500, 433.7], [9000, 410]],
  idle: 900,                              // ESTIMATE
  inertia: 0.14,                          // ESTIMATE, kg·m²: crank, flywheel, clutch
  friction: [18, 0.006],                  // ESTIMATE: engine braking, N·m and N·m per rpm (closed throttle)
};

/** Power transmission (technical data, page 2): rear-wheel drive, seven-speed PDK. */
export const GEARBOX = {
  src: 'Porsche technical data 08/2022', tag: 'PUBLISHED',
  ratios: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84], reverse: 3.42, final: 4.27,
  // ESTIMATE: the longest a shift may take, s. An upshift hands the drive from one clutch to the
  // other with no gap: the new gear's clutch takes it at once, slipping, the engine's torque cut to
  // upshiftCut while its speed comes down to the new gear's (≈60–80 ms); a downshift opens the
  // clutch and blips the engine up to the lower gear's speed.
  shiftTime: 0.1, upshiftCut: 0.4,
  efficiency: 0.875,                      // ESTIMATE: gearbox and final drive (fitted with the seamless upshift: 0–100/160/200 within 2 %)
  upshiftRpm: 8800,                       // ESTIMATE: the automatic mode shifts just short of the 9,000 cut
  downshiftRpm: 4200,                     // ESTIMATE: braking
  // ESTIMATE: the automatic mode's map by the pedal (filtered): up early at a light throttle
  // (upLight) and late at a full one; down pulling at downLight (light) to 5,200 rpm (full);
  // kickdown, the pedal stamped down, straight to the lowest gear under kickdownRpm.
  upLight: 2800, downLight: 1300, downFull: 5200, kickdownRpm: 7800,
};

/** Wheels and tyres (technical data, page 3). Diameters DERIVED from the tyre codes. */
const tyreDia = (w, ar, rim) => (rim * 25.4 + 2 * w * ar / 100) / 1000;
export const WHEELS = {
  src: 'Porsche technical data 08/2022', tag: 'PUBLISHED',
  front: { rim: '10 J × 20 ET 45', tyre: '275/35 ZR 20', width: 0.275, dia: tyreDia(275, 35, 20), rimDia: 20 * 0.0254, rimWidth: 10 * 0.0254, offset: 0.045 },
  rear: { rim: '13 J × 21 ET 31', tyre: '335/30 ZR 21', width: 0.335, dia: tyreDia(335, 30, 21), rimDia: 21 * 0.0254, rimWidth: 13 * 0.0254, offset: 0.031 },
  // DERIVED: 0.7005 m and 0.7344 m (rim plus two sidewalls, unloaded).
  centerLock: true,
};

/** Brakes (technical data, page 3): grey cast iron composite discs, aluminium monobloc callipers. */
export const BRAKES = {
  src: 'Porsche technical data 08/2022', tag: 'PUBLISHED',
  front: { disc: 0.408, thickness: 0.036, pistons: 6 },
  rear: { disc: 0.380, thickness: 0.030, pistons: 4 },
  bias: 0.66,                             // ESTIMATE: front share of the brake torque
};

/** Dimensions and weights (technical data, page 3). */
export const BODY = {
  src: 'Porsche technical data 08/2022', tag: 'PUBLISHED',
  length: 4.572, width: 1.900, widthMirrors: 2.027, height: 1.322,
  wheelbase: 2.457, trackFront: 1.630, trackRear: 1.582,
  mass: 1450,                             // unladen (DIN): 90 % fuel, no driver
  grossMass: 1795,
  steeringRatio: 14.1, turningCircle: 10.5, steeringWheel: 0.360,
  // Not published: ≈ from photographs and the published envelope.
  overhangFront: 1.04,                    // ESTIMATE ≈
  rideHeight: 0.105,                      // ESTIMATE ≈, the splitter's lowest edge
  frontShare: 0.39,                       // ESTIMATE ≈: the 992's rear-engined balance, 39/61
  cgHeight: 0.44,                         // ESTIMATE ≈
  inertiaYaw: 2100,                       // ESTIMATE ≈, kg·m²
  driver: 75,                             // the simulated car carries a 75 kg driver
};
BODY.overhangRear = BODY.length - BODY.wheelbase - BODY.overhangFront;   // DERIVED ≈ 1.075 m

/** Performance (technical data, page 4): the figures the dynamics check is held to. */
export const PERFORMANCE = {
  src: 'Porsche technical data 08/2022', tag: 'PUBLISHED',
  topSpeed: 296 * KMH,
  accel: [[100 * KMH, 3.2], [160 * KMH, 6.9], [200 * KMH, 10.6]],   // 0–100, 0–160, 0–200 km/h, s
  accel60mph: 3.0,
};

/**
 * Aerodynamics. Downforce PUBLISHED in the press kit (high-downforce setting): 901 lb at
 * 124 mph and 1,896 lb at 177 mph (409 kg at 200 km/h, 860 kg at 285 km/h). The lift
 * coefficient times area is DERIVED from them; the drag area is DERIVED from the published
 * top speed with the wings flat (DRS) and the power the engine makes there, so it is the drag
 * that stops the car at 296 km/h, not a published Cd (Porsche does not give one).
 */
const RHO = 1.225;
const clA = (lb, mph) => 2 * lb * LB * 9.80665 / (RHO * (mph * MPH) ** 2);
export const AERO = {
  src: 'Porsche press kit 2022 (downforce); DERIVED (drag)', tag: 'DERIVED',
  downforce: [[124 * MPH, 901 * LB], [177 * MPH, 1896 * LB]],   // PUBLISHED, kg
  clA: (clA(901, 124) + clA(1896, 177)) / 2,                    // DERIVED ≈ 2.15 m²
  frontShareDownforce: 0.40,              // ESTIMATE ≈
  cdA: 0.89,                              // DERIVED from 296 km/h, wings flat (see tools/gt3rs-check.mjs)
  cdAHigh: 1.10,                          // ESTIMATE ≈: wings at the high-downforce setting
  drsClFactor: 0.45,                      // ESTIMATE ≈: downforce left with the wings flat
  // Airbrake: hard on the brakes from speed, the wing's flap and the front diffuser's flaps go to
  // their steepest, for more drag (≈ how much: not published).
  airbrakeCdFactor: 1.15, airbrakeSpeed: 100 / 3.6, airbrakePedal: 0.5,   // ESTIMATE ≈
  // Auto-DRS opens only on a straight: under ≈0.3 g sideways and ≈2° of lock at the wheels, the
  // flaps travelling in ≈0.3 s (ESTIMATE ≈: Porsche publishes the logic, not its thresholds).
  drsLatG: 0.3, drsSteer: 2 * Math.PI / 180, drsTime: 0.3,
  rho: RHO,
};

/**
 * The suspension, for the body's motion over the ground: ride frequencies and damping of a
 * track-set car on its springs, the body's inertias in pitch and roll, the stiffness that shares a
 * twisted ground's load across the diagonals, and the travel to the bump stops. Not published:
 * ESTIMATE throughout (a road car's are ≈1.2–1.5 Hz; a track car's ≈2).
 */
export const SUSPENSION = {
  tag: 'ESTIMATE',
  heaveHz: 2.0, pitchHz: 2.2, rollHz: 2.5, zeta: 0.35,
  inertiaPitch: 1750, inertiaRoll: 520,   // kg·m²
  warp: 42000,                            // N per metre of diagonal twist
  bump: 0.055, droop: 0.075,              // m from the static ride height
  ackermann: 0.5,                         // share of full Ackermann steering geometry
};
/**
 * The rear differential: Porsche Torque Vectoring Plus, an electronically controlled locking
 * differential with brake torque vectoring on the inner rear (Porsche technical data: equipment;
 * its maps are not published, ESTIMATE ≈ throughout). The lock's capacity is a preload plus a
 * share of the torque through it, between the lower share (turning in) and the higher (powering
 * out of a corner, or at speed), on the drive and on the overrun; the coupling's stiffness, N·m
 * per rad/s of the rears turning apart; the inner rear's brake on turn-in, up to maxBrake N·m
 * below vMax.
 */
export const DIFF = {
  tag: 'ESTIMATE',
  preload: 40, drive: [0.25, 0.65], coast: [0.15, 0.45], kStiff: 2500,
  ptv: { on: true, maxBrake: 350, vMax: 150 / 3.6 },
};
/** The clutches of the PDK: their torque capacity when closed, and while launching (≈). */
export const CLUTCH = { tag: 'ESTIMATE', capacity: 620, dragCap: 90, launchRpm: 5500, slipBand: 6 };

/**
 * The tyres' grip: a simplified Pacejka "magic formula" per tyre with combined slip, the
 * peak friction falling a little with load. Not published by Porsche or Michelin: ≈ for a
 * road-legal track tyre (the Michelin Pilot Sport Cup 2 R class). ESTIMATE throughout.
 */
export const TYRES = {
  tag: 'ESTIMATE',
  mu: 1.48, muLoadSens: 0.08,             // peak μ at the static load, and its fall per extra static load
  B: 11, C: 1.5, E: 0.4,                  // lateral magic-formula shape (slip angle, rad)
  Bx: 14, Cx: 1.6, Ex: 0.4,               // longitudinal (slip ratio)
  relaxation: 0.35,                       // relaxation length, m
  kUs: 0.0029,                            // the model's understeer: rad of lock per m/s² of lateral acceleration (measured on it)
  downGain: 0.5,                          // the share of the downforce's load the four tyres turn into lateral grip (measured on the model: 1.7 g at 240 km/h)
  rolling: 0.012,
};

/**
 * The paint: the near-white grey of the car in Porsche's studio photographs (reference only),
 * matched by eye under the centre's light. ESTIMATE: the photographs do not name the colour.
 */
export const PAINT = { name: 'light grey (as photographed)', tag: 'ESTIMATE', srgb: 0xc4c7c9 };
