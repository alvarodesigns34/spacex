/**
 * The Kawasaki Ninja H2R (ZX1000Y, model year 2027), every figure with where it comes from.
 * Tags as in the rest of the centre: PUBLISHED (a number printed in the source), DERIVED
 * (computed from published numbers), TRACED (read off Kawasaki's studio side photograph, scaled
 * by the published wheelbase and height), ESTIMATE (≈, reasoned, no source).
 *
 * Source (read for reference only, not in the repository): Kawasaki Motors Europe, "Ninja
 * H2R" specifications, model year 2027 (kawasaki.eu): engine, gearing, frame geometry,
 * suspension, brakes, tyres, dimensions, weights, the colour and the carbon wings. Kawasaki's
 * studio photographs of the bike in Mirror Coated Spark Black (left side, right side, right
 * front) are the reference for the shapes; they are not in the centre.
 *
 * The H2R is a closed-course machine: no lights but a tail lamp, carbon wings where a road
 * bike's mirrors would be, slick tyres.
 *
 * Frame for the model: x forward from the front axle, y up from the ground the tyres stand
 * on, z to the right. The exhibit's own origin is the middle of the wheelbase (MID).
 */
const KMH = 1 / 3.6;

export const ENGINE = {
  src: 'Kawasaki H2R specifications MY2027', tag: 'PUBLISHED',
  layout: 'liquid-cooled four-stroke inline four, supercharged', displacement: 998, bore: 76.0, stroke: 55.0,
  compression: 8.3,
  power: 228e3, powerRam: 240e3, powerRpm: 14000,   // 228 kW (310 PS); 240 kW (326 PS) with ram air
  torque: 165, torqueRpm: 12500,
  // The full-load curve between the published points is not published: ≈ a supercharged four,
  // the boost building with the engine's speed (the supercharger is gear-driven from the
  // crank), 165 Nm at 12,500 and 155.5 Nm at 14,000 by the power figure. ESTIMATE except those.
  torqueCurve: [[1500, 55], [3000, 70], [5000, 92], [7000, 115], [9000, 138], [11000, 158], [12500, 165], [14000, 155.5], [14500, 146]],
  maxRpm: 14500,                          // ESTIMATE: the limiter just past peak power
  idle: 1300,                             // ESTIMATE
  inertia: 0.035,                         // ESTIMATE, kg·m²: crank, clutch and the supercharger's impeller
  // ESTIMATE: engine braking, N·m and N·m per rpm: ≈0.45 g in first at 12,000 rpm, ≈0.3 g with
  // the aids' lighter setting (KEBC), as a supercharged litre four's friction and pumping give.
  friction: [12, 0.0028],
  // ESTIMATE, fitted to MOTORRAD's 0–100 km/h: the share of the engine's torque a slipping clutch
  // passes while the bike moves off (the rider's hand, or launch control, feeding it in).
  launchClutch: 0.7,
};

export const GEARBOX = {
  src: 'Kawasaki H2R specifications MY2027', tag: 'PUBLISHED',
  primary: 1.551, ratios: [3.188, 2.526, 2.045, 1.727, 1.524, 1.348], final: 2.333,   // 76/49; 42/18
  shiftTime: 0.06,                        // ESTIMATE: a quick-shifter's cut, s
  // ESTIMATE, fitted (with MASS below) to MOTORRAD's GPS-timed runs on the Lausitzring oval (2015):
  // the primary, gearbox and chain, and the shortfall against the published power that MOTORRAD's
  // own dyno showed (261 PS, falling off from 12,200 rpm, no ram air on a dyno).
  efficiency: 0.85,
  upshiftRpm: 14200, downshiftRpm: 8500,  // ESTIMATE: the automatic mode
};

/** 120/600 R17 and 190/650 R17: the second number is the tyre's outside diameter in mm. */
export const WHEELS = {
  src: 'Kawasaki H2R specifications MY2027', tag: 'PUBLISHED',
  front: { tyre: '120/600 R17', width: 0.120, dia: 0.600, rimDia: 17 * 0.0254 },
  rear: { tyre: '190/650 R17', width: 0.190, dia: 0.650, rimDia: 17 * 0.0254 },
};

export const CHASSIS = {
  src: 'Kawasaki H2R specifications MY2027', tag: 'PUBLISHED',
  frame: 'trellis, high-tensile steel', rake: 25.1, trail: 0.108,
  travelFront: 0.120, travelRear: 0.135, steer: 27,
  fork: '43 mm inverted', shock: 'Öhlins TTX36, Uni-Trak, single-sided swingarm',
  brakesFront: { disc: 0.330, discs: 2, caliper: 'Brembo Stylema monobloc, radial, 4 pistons' },
  brakesRear: { disc: 0.250, discs: 1, caliper: 'Brembo, 2 pistons' },
};

export const BODY = {
  src: 'Kawasaki H2R specifications MY2027', tag: 'PUBLISHED',
  length: 2.070, width: 0.850, height: 1.160, wheelbase: 1.450, clearance: 0.130, seat: 0.830,
  fuel: 17.0, curb: 216, dry: 196,
};

/**
 * ESTIMATE: centre of mass with a 75 kg rider tucked in (≈ a superbike's 52 % on the front), its
 * height and the drag area fitted to MOTORRAD's GPS-timed acceleration test (Dekra oval, Lausitzring,
 * July 2015): 0–100 km/h 3.1 s, 0–200 km/h 6.5 s in 184 m, 0–300 km/h 13.4 s in 660 m, 337 km/h by
 * GPS (357 on the display). The model gives 3.08 s, 6.50 s / 187 m, 13.15 s / 669 m and 338 km/h
 * (tools/h2r-check.mjs), with the launch clutch (ENGINE.launchClutch) and the ram air's share
 * reaching its full at 337 km/h. The centre of mass's height sets where the front lifts (≈1.1 g), which
 * holds the launch; the drag area, with the wings and the rider tucked, sets the top speed.
 */
export const MASS = {
  tag: 'ESTIMATE', rider: 75, front: 0.52, cgHeight: 0.68,
  cdA: 0.39,                              // ESTIMATE, m²: bike, wings and rider tucked (fitted)
};

/** MOTORRAD's measurements (2015 H2R, the same published 228/240 kW), what the ride model is held to. */
export const PRESS = {
  src: 'MOTORRAD, acceleration test of the Ninja H2 and H2R, Dekra oval at the Lausitzring, 23 July 2015', tag: 'PUBLISHED',
  t100: 3.1, t200: 6.5, d200: 184, t300: 13.4, d300: 660, vmaxGps: 337, vmaxDisplay: 357,
};

/** DERIVED: the top speed the gearing allows at the limiter, in sixth. */
export const TOP_GEARED = ENGINE.maxRpm / (GEARBOX.primary * GEARBOX.ratios[5] * GEARBOX.final) * Math.PI * WHEELS.rear.dia / 60;
export const KMH_TOP = TOP_GEARED / KMH;
