/**
 * Starship launch sequence: countdown, ignition, liftoff, ascent, Max-Q, MECO and
 * hot-stage separation.
 *
 * WHAT IS CITED AND WHAT IS RECONSTRUCTED
 *
 * The event times are taken verbatim from the published flight-test timeline (Wikipedia's
 * Starship flight test 7 article, itself transcribed from the SpaceX webcast): liftoff at
 * T+00:00:02, Max-Q at T+00:01:02, MECO at T+00:02:32, hot-stage separation at T+00:02:40.
 * The speed at separation, ≈ 5 700 km/h, is reported for IFT-3.
 *
 * The altitude and speed *curve* between those points is not published as a table anywhere,
 * so it is reconstructed: a monotone cubic through keyframes that hit the cited times and the
 * cited separation speed, flagged `approx` in data/specs.js and labelled in the mission
 * panel. Everything downstream is then derived from that one curve rather than invented
 * separately — the flight-path angle comes from dh/dt against speed, the downrange distance
 * from integrating the horizontal component, and the vehicle's attitude from the flight-path
 * angle. So the pitch you see and the numbers on the panel cannot disagree with each other.
 *
 * Time runs 1:1 by default. The speed control multiplies the mission clock, it does not skip.
 */
import * as THREE from 'three';
import { Plume, GroundCloud } from './plume.js';
import { seeded, monotoneSlopes, hermite } from '../geometry/utils.js';

// ---- Cited event times (seconds from T-0) ------------------------------------------------
export const EVENTS = {
  start: -12,
  ignition: -3,        // Raptor ignition sequence, derived from the T-0/liftoff interval
  liftoff: 2,          // cited
  towerClear: 12,      // derived: the stack clears the 144,5 m tower at this point
  maxQ: 62,            // cited
  meco: 152,           // cited
  separation: 160,     // cited
  // Booster return, from the flight 5 timeline (Wikipedia, Starship flight test 5): the
  // first time anyone caught an orbital-class booster. Times are that flight's, shifted by
  // nothing — its boostback started 1 s after this model's separation, which is close enough
  // that the two timelines can share a clock.
  boostbackStart: 165,   // cited: +00:02:45
  boostbackEnd: 221,     // cited: +00:03:41
  landingBurn: 390,      // cited: +00:06:30
  catch: 414,            // cited: +00:06:54, landing burn shutdown and catch
  end: 436,
};

/**
 * Reconstructed ascent, built from exactly two authored inputs so that nothing in the
 * simulation can contradict anything else:
 *
 *   1. a speed curve v(t), pinned to zero until the cited liftoff time and to the cited
 *      ≈ 5 700 km/h (1 583 m/s) at the cited separation time;
 *   2. a gravity-turn pitch programme θ(t) — zero while the vehicle clears the tower, then
 *      an exponential approach to 72° from vertical with a 64 s time constant.
 *
 * Altitude and downrange distance are then *integrated* from those two, not authored
 * separately, so the attitude on screen, the altitude on the panel and the speed on the
 * panel are one object seen three ways. The integration lands the vehicle at 55,8 km and
 * 81 km downrange at separation, which is the right neighbourhood for a Starship staging
 * point; the shape of both inputs is a reconstruction and is labelled as such in the panel.
 */
const SPEED_KEYS = [
  [0, 0], [2, 0],          // cited: the stack leaves the mount at T+00:00:02
  [10, 52], [20, 105], [30, 165], [45, 262],
  [62, 392],               // cited time: Max-Q
  [80, 548], [100, 745], [120, 978], [140, 1272],
  [152, 1470],             // cited time: MECO
  [160, 1583],             // cited time and cited speed: separation at ≈ 5 700 km/h
  [175, 1690], [196, 1880], [260, 2380], [340, 3020], [436, 3760],
];
const PITCH = { start: EVENTS.liftoff + 6, max: THREE.MathUtils.degToRad(72), tau: 64 };
const pitchProgram = (t) => (t <= PITCH.start ? 0 : PITCH.max * (1 - Math.exp(-(t - PITCH.start) / PITCH.tau)));

/**
 * Integrates the two inputs once, at load, into a 0,25 s table. Doing it up front is what
 * makes seek() exact: the headless check can jump to any mission time and get the state the
 * animation would have reached by running there, rather than a separate approximation.
 */
function buildProfile() {
  const xs = SPEED_KEYS.map(k => k[0]);
  const vy = SPEED_KEYS.map(k => k[1]);
  const vm = monotoneSlopes(xs, vy);
  const step = 0.25, sub = 5, dt = step / sub;
  const n = Math.round(EVENTS.end / step) + 1;
  const alt = new Float64Array(n), spd = new Float64Array(n), down = new Float64Array(n), pit = new Float64Array(n);
  let h = 0, x = 0, t = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      for (let k = 0; k < sub; k++) {
        const v = hermite(xs, vy, vm, t + dt * 0.5), p = pitchProgram(t + dt * 0.5);
        h += v * Math.cos(p) * dt;
        x += v * Math.sin(p) * dt;
        t += dt;
      }
    }
    alt[i] = h; spd[i] = hermite(xs, vy, vm, i * step); down[i] = x; pit[i] = pitchProgram(i * step);
  }
  return { step, n, alt, spd, down, pit };
}
const PROFILE = buildProfile();

// ---- Booster return ----------------------------------------------------------------------
// The ascent is integrated from a speed curve because its endpoints are cited. The return is
// not: no public source gives Super Heavy's altitude second by second, so this is an authored
// trajectory pinned to the four cited times above and to the two facts that bracket it — the
// booster is at the staging point when the boostback burn lights, and it is in the arms at
// T+06:54. Apogee near 96 km and a downrange peak near 95 km are the reported neighbourhood
// for a flight 5 return, and the shape between the pins is a reconstruction.
//
// Altitude is not monotone here — it keeps climbing for a minute after staging — so this uses
// a plain Catmull-Rom through the keys rather than the monotone cubic the ascent uses.
// The last few keys are close together on purpose: a Catmull-Rom through a 3 800 m -> 10 m
// drop with nothing after it overshoots straight through the ground, which is exactly what it
// did — the booster arrived at altitude 0 and 80 cm the wrong side of the pad centre.
const RETURN_ALT = [
  [160, 55800], [180, 68000], [200, 78500], [221, 85000], [250, 93000], [272, 96000],
  [300, 91000], [330, 76000], [360, 49000], [385, 17000], [398, 4200], [405, 900],
  [410, 140], [413, 34], [414, 22], [418, 22], [426, 22], [436, 22],
];
const RETURN_DOWN = [
  [160, 84000], [180, 92000], [200, 95500], [221, 93000], [250, 79000], [272, 66000],
  [300, 46000], [330, 26000], [360, 10500], [385, 2400], [398, 420], [405, 90],
  [410, 14], [413, 2], [414, 0], [418, 0], [426, 0], [436, 0],
];
// Attitude, in radians from vertical. Nose-up at staging, swung retrograde for the boostback
// burn, then engines-first — which for Super Heavy means upright — for the descent and catch.
const RETURN_PITCH = [
  [160, 1.14], [166, 1.60], [180, 2.30], [221, 2.30], [240, 1.20], [270, 0.34],
  [330, 0.16], [385, 0.05], [414, 0.0], [436, 0.0],
];

/** Catmull-Rom through (t, value) keys. Unlike the ascent's cubic this may rise and fall. */
function catmull(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u
    + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2
    + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
}
export const boosterAltAt = (t) => (t < EVENTS.separation ? altitudeAt(t) : Math.max(0, catmull(RETURN_ALT, t)));
export const boosterDownAt = (t) => (t < EVENTS.separation ? downrangeAt(t) : catmull(RETURN_DOWN, t));
export const boosterPitchAt = (t) => (t < EVENTS.separation ? pitchAt(t) : catmull(RETURN_PITCH, t));
/**
 * Speed of the booster, differentiated from its own trajectory rather than authored, so the
 * number on the panel cannot contradict the thing on the screen.
 */
export function boosterSpeedAt(t) {
  if (t < EVENTS.separation) return speedAt(t);
  const h = 0.5;
  const dy = boosterAltAt(t + h) - boosterAltAt(t - h);
  const dx = boosterDownAt(t + h) - boosterDownAt(t - h);
  return Math.hypot(dx, dy) / (2 * h);
}

/** Booster engines after separation: the boostback burn, then the landing burn. */
function returnThrottle(t) {
  if (t >= EVENTS.boostbackStart && t <= EVENTS.boostbackEnd) {
    return 0.40 * THREE.MathUtils.smoothstep(t, EVENTS.boostbackStart, EVENTS.boostbackStart + 2)
      * (1 - THREE.MathUtils.smoothstep(t, EVENTS.boostbackEnd - 3, EVENTS.boostbackEnd));
  }
  if (t >= EVENTS.landingBurn && t <= EVENTS.catch) {
    // Thirteen engines to arrest the descent, down to three for the last few seconds.
    const lit = t < EVENTS.catch - 9 ? 0.42 : 0.42 * (1 - 0.72 * THREE.MathUtils.smoothstep(t, EVENTS.catch - 9, EVENTS.catch - 1));
    return lit * (1 - THREE.MathUtils.smoothstep(t, EVENTS.catch - 1.2, EVENTS.catch));
  }
  return 0;
}

function sample(arr, t) {
  const u = THREE.MathUtils.clamp(t / PROFILE.step, 0, PROFILE.n - 1);
  const i = Math.floor(u), f = u - i;
  return i >= PROFILE.n - 1 ? arr[PROFILE.n - 1] : arr[i] * (1 - f) + arr[i + 1] * f;
}
export const altitudeAt = (t) => (t <= 0 ? 0 : sample(PROFILE.alt, t));
export const speedAt = (t) => (t <= 0 ? 0 : sample(PROFILE.spd, t));
export const downrangeAt = (t) => (t <= 0 ? 0 : sample(PROFILE.down, t));
export const pitchAt = (t) => (t <= 0 ? 0 : sample(PROFILE.pit, t));

/**
 * Booster throttle. Rated thrust until the throttle-down through Max-Q, back up, then the
 * shutdown to the three centre engines that hold the stack steady through hot-staging.
 */
function boosterThrottle(t) {
  if (t < EVENTS.ignition) return 0;
  if (t < EVENTS.liftoff) return THREE.MathUtils.smoothstep(t, EVENTS.ignition, EVENTS.liftoff);
  if (t < 46) return 1;
  if (t < EVENTS.maxQ) return 1 - 0.28 * THREE.MathUtils.smoothstep(t, 46, EVENTS.maxQ);
  if (t < 82) return 0.72 + 0.28 * THREE.MathUtils.smoothstep(t, EVENTS.maxQ, 82);
  if (t < 144) return 1;
  if (t < EVENTS.meco) return 1 - 0.9 * THREE.MathUtils.smoothstep(t, 144, EVENTS.meco);
  // Three centre engines out of thirty-three hold the stack through separation.
  if (t < EVENTS.separation + 3) return 0.1;
  return Math.max(0, 0.1 - 0.1 * THREE.MathUtils.smoothstep(t, EVENTS.separation + 3, EVENTS.separation + 7));
}
/** The ship lights through the vented hot-stage section a moment before it separates. */
function shipThrottle(t) {
  if (t < EVENTS.separation - 1.5) return 0;
  return THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation + 1.5);
}

const PHASES = [
  [EVENTS.ignition, 'Countdown'],
  [EVENTS.liftoff, '33 Raptor ignition'],
  [EVENTS.towerClear, 'Liftoff'],
  [EVENTS.maxQ - 6, 'Ascent · tower cleared'],
  [EVENTS.maxQ + 8, 'Max-Q · peak dynamic pressure'],
  [EVENTS.meco, 'Ascent'],
  [EVENTS.separation, 'MECO · engine cutoff'],
  [EVENTS.boostbackStart, 'Hot-staging'],
  [EVENTS.boostbackEnd, 'Booster boostback burn'],
  [EVENTS.landingBurn, 'Booster coasting back'],
  [EVENTS.catch, 'Booster landing burn'],
  [EVENTS.catch + 8, 'Caught by the tower'],
  [Infinity, 'Booster in the arms'],
];
const phaseAt = (t) => (PHASES.find(p => t < p[0]) ?? PHASES[PHASES.length - 1])[1];

// =========================================================================================
export function createLaunch({ scene, exhibits, complex, env, rig, camera, onState = () => {}, onFinish = () => {} }) {
  const ex = exhibits.starship;
  const flight = new THREE.Group();
  flight.name = 'flight';
  // The vehicle is re-parented under a group of its own so the sequence can move and pitch
  // it without dragging the launch complex with it.
  ex.group.remove(ex.model);
  flight.add(ex.model);
  ex.group.add(flight);
  ex.flight = flight;

  const booster = ex.model.getObjectByName('superheavy');
  const ship = ex.model.getObjectByName('ship');
  const shipHome = ship.position.y;
  const parts = complex.userData.parts;

  // The booster flies its own trajectory after staging — out to 95 km downrange and back to
  // the tower — so it gets its own group beside the ship's rather than a small offset inside
  // it. Before separation the two are driven with identical transforms, which is also what
  // keeps seek() exact: there is no state carried across the split.
  const boosterHome = { parent: booster.parent, position: booster.position.clone() };
  // Two groups, not one: `flight` carries the trajectory and `ex.model` carries the exhibit's
  // own mount height and yaw, and the booster's chain has to compose in exactly the same order
  // or the two vehicles drift apart before they have separated. Collapsing them into a single
  // group did precisely that — at T+26 the ship was already flying beside its own booster.
  const boosterFlight = new THREE.Group();
  boosterFlight.name = 'booster-flight';
  const boosterModel = new THREE.Group();
  boosterModel.name = 'booster-model';
  boosterModel.position.copy(ex.model.position);
  boosterModel.rotation.copy(ex.model.rotation);
  boosterFlight.add(boosterModel);
  ex.group.add(boosterFlight);
  ex.boosterFlight = boosterFlight;

  /**
   * The booster only leaves ex.model while the sequence is live. Parked, it belongs to the
   * stack — otherwise verifyExhibits() measures a 53 m Starship, because measure() walks the
   * model and the booster is no longer in it.
   */
  let boosterDetached = false;
  function detachBooster(on) {
    if (on === boosterDetached) return;
    boosterDetached = on;
    (on ? boosterModel : boosterHome.parent).add(booster);
    booster.position.copy(boosterHome.position);
    booster.rotation.z = 0;
  }

  // Chopstick home state, so reset() puts the arms back where the launch found them.
  const chop = parts.chopsticks;
  const chopHome = {
    y: chop.position.y,
    arms: chop.children.filter(c => c.name.startsWith('arm-')).map(a => ({ obj: a, ry: a.rotation.y })),
  };
  const CATCH_ARM = THREE.MathUtils.degToRad(6.5);   // arms just embracing the 9 m hull
  const CATCH_CARRIAGE = 98;                          // carriage height at the catch: the lift
                                                      // pins sit below the grid fins, not at the top
  const CATCH_ALT = 22;                               // booster held this far above its launch station

  // ---- Plumes -------------------------------------------------------------------------
  // Cluster radii: the 33 Raptors sit inside a 3,86 m ring, the ship's six inside a 2,3 m
  // one, so those are the exit-plane radii the merged columns start from.
  // Thirty-three sea-level Raptors do not make a wisp. The exhaust column off the mount is
  // wider than the 9 m booster and runs several booster-lengths behind it before it breaks up;
  // at 6.0 the plume was about a quarter of the booster's length and the whole ascent read as
  // a model rocket.
  const boosterPlume = new Plume({ radius: 4.6, seaLevelLength: 9.6, name: 'plume-booster' });
  const shipPlume = new Plume({ radius: 2.6, seaLevelLength: 8.4, name: 'plume-ship' });
  booster.add(boosterPlume.group);
  ship.add(shipPlume.group);

  const cloud = new GroundCloud({ rng: seeded(11) });
  cloud.points.position.set(ex.lay.x, 0, ex.lay.z);
  scene.add(cloud.points);

  // ---- Saved state, so reset() puts everything back exactly ----------------------------
  const home = {
    near: camera.near, far: camera.far,
    shadows: env.sun.castShadow,
    clamps: parts.holddowns.children.map(c => c.position.clone()),
  };

  const state = {
    running: false, armed: false, t: EVENTS.start, speed: 1,
    phase: 'En plataforma', altitude: 0, velocity: 0, throttle: 0, downrange: 0,
  };
  let visibilityHook = null;   // set by main.js: hides labels, rulers and figures while flying

  // ---- Camera ---------------------------------------------------------------------------
  const S = new THREE.Vector3(ex.lay.x, 0, ex.lay.z);        // site origin, on grade
  const PAD_CATCH_Y = ex.lay.mount + CATCH_ALT + 34;         // roughly the middle of the caught booster
  const V = new THREE.Vector3();                             // vehicle mid-body, world
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _pad = new THREE.Vector3();
  const _p2 = new THREE.Vector3(), _q2 = new THREE.Vector3();

  /**
   * Where the middle of the stack actually is, which is not simply "up": once the gravity
   * turn starts the vehicle rotates about its own base, so the mid-body swings downrange.
   */
  // The booster's mid-body, in world space, for the return shots.
  function boosterAt(t, out) {
    const p = boosterPitchAt(t), r = 36;
    return out.set(
      S.x + boosterDownAt(t) + Math.sin(p) * r,
      ex.lay.mount + boosterAltAt(t) + Math.cos(p) * r,
      S.z,
    );
  }

  function vehicleAt(t, out) {
    const p = pitchAt(t), r = 58;
    return out.set(
      S.x + downrangeAt(t) + Math.sin(p) * r,
      altitudeAt(t) + ex.lay.mount + Math.cos(p) * r,
      S.z,
    );
  }

  /** Shot list. Each writes a world position and look-at target for the mission time. */
  const SHOTS = [
    { until: EVENTS.liftoff + 4, blend: 0, shot: (t, pos, tgt) => {
      // The classic pad camera: low, off the corner of the mount, looking up past the deck.
      // Off the plateau on both axes: standing on it puts the camera at deck level, where
      // the concrete fills the frame, and standing straight down the trench puts the smoke
      // into the lens.
      pos.set(S.x + 118, 13, S.z + 118);
      tgt.set(S.x, 24 + altitudeAt(t) * 0.7, S.z);
    } },
    { until: 15, blend: 1.6, shot: (t, pos, tgt) => {
      // Stays on the ground while the stack climbs past the tower, and keeps the pad in the
      // bottom of the frame: the tower is the only thing in shot whose size the viewer
      // already knows, so letting it slide away would throw the sense of scale out.
      pos.set(S.x + 210, 18, S.z + 210);
      vehicleAt(t, tgt);
      tgt.lerp(_pad.set(S.x, ex.lay.mount + 8, S.z), 0.42);
    } },
    { until: 48, blend: 2.0, shot: (t, pos, tgt) => {
      // Picks the vehicle up and holds it against the pad, which is now well below.
      vehicleAt(t, tgt);
      const d = 300;
      pos.set(tgt.x - d * 0.34, tgt.y - d * 0.34, tgt.z + d * 0.88);
    } },
    { until: EVENTS.meco - 8, blend: 2.5, shot: (t, pos, tgt) => {
      // Chase. The stand-off grows slowly so the vehicle keeps its size in frame while the
      // sky behind it drains to black.
      vehicleAt(t, tgt);
      const d = 270 + altitudeAt(t) * 0.0034;
      const a = 0.7 + t * 0.0042;
      pos.set(tgt.x + Math.cos(a) * d * 0.66, tgt.y - d * 0.30, tgt.z + Math.sin(a) * d * 0.82);
    } },
    { until: EVENTS.boostbackStart + 2, blend: 3.0, shot: (t, pos, tgt) => {
      // Separation: side on, and pulling back so both stages stay in frame as they part.
      vehicleAt(t, tgt);
      const d = 340 + Math.max(0, t - EVENTS.separation) * 6.5;
      pos.set(tgt.x + d * 0.26, tgt.y - d * 0.20, tgt.z + d * 0.94);
    } },
    { until: EVENTS.landingBurn - 26, blend: 4.0, shot: (t, pos, tgt) => {
      // The booster is the story from here. Held against the curve of its own trajectory,
      // far enough out that the flip and the boostback burn read.
      boosterAt(t, tgt);
      const d = 420;
      pos.set(tgt.x - d * 0.42, tgt.y + d * 0.16, tgt.z + d * 0.90);
    } },
    { until: EVENTS.catch - 6, blend: 4.0, shot: (t, pos, tgt) => {
      // Coming home: from beside the tower, looking up the line the booster is falling down,
      // so the pad enters frame underneath it as it arrives.
      boosterAt(t, tgt);
      const k = THREE.MathUtils.clamp((t - (EVENTS.landingBurn - 26)) / 70, 0, 1);
      const d = THREE.MathUtils.lerp(900, 190, k);
      pos.set(S.x + 150, THREE.MathUtils.lerp(tgt.y * 0.55 + 60, 128, k), S.z + d);
    } },
    { until: Infinity, blend: 3.0, shot: (t, pos, tgt) => {
      // The catch itself, from the height of the arms: the booster comes down into frame and
      // stops, and the tower is beside it for scale.
      const k = THREE.MathUtils.clamp((t - (EVENTS.catch - 6)) / 14, 0, 1);
      boosterAt(t, tgt);
      tgt.lerp(_pad.set(S.x, PAD_CATCH_Y, S.z), k * 0.65);
      pos.set(S.x + 118, THREE.MathUtils.lerp(122, 104, k), S.z + THREE.MathUtils.lerp(150, 104, k));
    } },
  ];

  function driveCamera(t) {
    let i = 0;
    while (i < SHOTS.length - 1 && t >= SHOTS[i].until) i++;
    SHOTS[i].shot(t, _p, _q);
    const s = SHOTS[i];
    if (i > 0 && s.blend > 0) {
      const started = SHOTS[i - 1].until;
      const k = THREE.MathUtils.clamp((t - started) / s.blend, 0, 1);
      if (k < 1) {
        SHOTS[i - 1].shot(t, _p2, _q2);
        const e = k * k * (3 - 2 * k);
        _p.lerpVectors(_p2, _p, e);
        _q.lerpVectors(_q2, _q, e);
      }
    }
    camera.position.copy(_p);
    rig.target.copy(_q);
    camera.lookAt(_q);
  }

  // ---- Pad hardware ---------------------------------------------------------------------
  function driveHardware(t) {
    // Ship quick disconnect swings clear before ignition.
    const qd = THREE.MathUtils.clamp((t - (EVENTS.ignition - 5)) / 4, 0, 1);
    parts.qdArm.rotation.y = -THREE.MathUtils.degToRad(112) * (qd * qd * (3 - 2 * qd));
    // Hold-downs release at liftoff and retract radially out of the way.
    const rel = THREE.MathUtils.clamp((t - EVENTS.liftoff) / 0.7, 0, 1);
    parts.holddowns.children.forEach((c, i) => {
      const h = home.clamps[i];
      const k = rel * 1.05;
      c.position.set(h.x * (1 + k * 0.22), h.y, h.z * (1 + k * 0.22));
    });
  }

  /**
   * Steam, water deluge and dust leaving strictly through the two trench mouths (<- ->).
   * Deluge activates prior to ignition, then vaporizes violently upon engine start.
   * Confinement: The pad has concrete walls on X; exhaust is forced solely along Z (North & South).
   */
  const CLOUD_UNTIL = EVENTS.liftoff + 34;
  function emitCloud(t, dt) {
    // The landing burn kicks up its own cloud off the pad as the booster settles into the
    // arms. Same trench mouths, much less of it: three engines, not thirty-three.
    if (t >= EVENTS.catch - 16 && t <= EVENTS.catch + 8) {
      const near = 1 - THREE.MathUtils.clamp(boosterAltAt(t) / 700, 0, 1);
      const n2 = near * 34 * dt;
      if (n2 >= 0.05) {
        const m2 = Math.max(1, Math.round(n2 * 0.5));
        cloud.emit(m2, [0, 2.4, 44], [0, 0.05, 1.0], 46, 16);
        cloud.emit(m2, [0, 2.4, -44], [0, 0.05, -1.0], 46, 16);
      }
      return;
    }
    if (t < -6.0 || t >= CLOUD_UNTIL) return;

    // 1. Water deluge pre-ignition activation (T-6 to T-3)
    // Water floods the plate and dense cold white mist rushes out both mouths (<- ->)
    if (t < EVENTS.ignition) {
      const deluge = THREE.MathUtils.smoothstep(t, -6.0, -3.0);
      const nWater = deluge * 44 * dt;
      if (nWater < 0.05) return;
      const m = Math.max(1, Math.round(nWater * 0.5));
      // North mouth (+Z)
      cloud.emit(m, [0, 2.2, 44], [0, 0.05, 1.0], 52, 18);
      // South mouth (-Z)
      cloud.emit(m, [0, 2.2, -44], [0, 0.05, -1.0], 52, 18);
      return;
    }

    // 2. High-energy rocket ignition and liftoff deluge vaporization (T-3 to T+34)
    // 33 Raptors blast into the steel deflector ridge. The exhaust and steam are channeled
    // exclusively in TWO opposing directions (<- ->) along the flame trench axis: +Z and -Z!
    const alt = altitudeAt(t);
    const drive = boosterThrottle(t) * Math.max(0, 1 - alt / 380);
    const n = drive * 110 * dt;
    if (n < 0.05) return;

    // Exactly 50% North (+Z) and 50% South (-Z)
    const trenchCount = Math.max(1, Math.round(n * 0.50));
    cloud.emit(trenchCount, [0, 2.6, 44], [0, 0.06, 1.0], 92, 20);
    cloud.emit(trenchCount, [0, 2.6, -44], [0, 0.06, -1.0], 92, 20);
  }

  // ---- The one function that maps a mission time to the whole scene ---------------------
  function apply(t) {
    const alt = altitudeAt(t);
    const bt = boosterThrottle(t), st = shipThrottle(t);

    flight.position.set(downrangeAt(t), alt, 0);
    flight.rotation.z = -pitchAt(t);

    // Hot staging: the ship lights first and pushes itself off the booster.
    const sep = Math.max(0, t - EVENTS.separation);
    ship.position.y = shipHome + 0.5 * 7.5 * sep * sep;

    // The booster on its own trajectory. Up to separation it is exactly where the stack is;
    // after it, it flies the return.
    detachBooster(true);
    const bAlt = boosterAltAt(t);
    boosterFlight.position.set(boosterDownAt(t), bAlt, 0);
    boosterFlight.rotation.z = -boosterPitchAt(t);
    // A little sideways drift as it is pushed off, and then it is on its own.
    booster.position.x = boosterHome.position.x - 0.7 * Math.min(sep, 6);
    booster.rotation.z = THREE.MathUtils.degToRad(9) * Math.min(1, sep / 14) * Math.max(0, 1 - sep / 26);

    // The catch: the carriage rides up the tower as the booster comes home, and the arms close
    // on it in the last seconds of the landing burn.
    const ride = THREE.MathUtils.smoothstep(t, EVENTS.landingBurn - 60, EVENTS.landingBurn + 6);
    chop.position.y = THREE.MathUtils.lerp(chopHome.y, CATCH_CARRIAGE, ride);
    const close = THREE.MathUtils.smoothstep(t, EVENTS.catch - 11, EVENTS.catch - 1);
    for (const a of chopHome.arms) {
      const s2 = a.ry < 0 ? 1 : -1;
      a.obj.rotation.y = THREE.MathUtils.lerp(a.ry, -s2 * CATCH_ARM, close);
    }

    const bThrottle = t < EVENTS.separation ? bt : returnThrottle(t);
    boosterPlume.setThrottle(bThrottle, bAlt);
    shipPlume.setThrottle(st, alt);
    cloud.setFlame(bt * Math.max(0, 1 - alt / 160));

    // The atmosphere follows whatever the camera is on: the ship until staging, the booster
    // afterwards, which is what brings the sky back as it comes down.
    env.setAltitude(t < EVENTS.boostbackStart ? alt : bAlt);
    // A 340 m shadow frustum is meaningless once the vehicle is kilometres up, and it costs
    // a full shadow pass per frame.
    // The near/far plane and the shadows follow whichever vehicle the camera is on, so the
    // pad comes back into shadow range as the booster returns to it.
    const camAlt = t < EVENTS.boostbackStart ? alt : bAlt;
    env.sun.castShadow = home.shadows && camAlt < 1800;
    camera.near = camAlt > 900 ? 0.8 : home.near;
    camera.far = camAlt > 900 ? 260000 : home.far;
    camera.updateProjectionMatrix();

    driveHardware(t);
    if (rig.external) driveCamera(t);

    // After staging the panel follows the booster: it is what the camera is on and what the
    // remaining milestones belong to.
    // The panel and the camera change vehicle together, at the boostback burn: reading the
    // booster's numbers under a shot of the ship is worse than either.
    const onBooster = t >= EVENTS.boostbackStart;
    state.t = t;
    state.altitude = onBooster ? bAlt : alt;
    state.velocity = onBooster ? boosterSpeedAt(t) : speedAt(t);
    state.downrange = onBooster ? boosterDownAt(t) : downrangeAt(t);
    state.throttle = onBooster ? bThrottle : Math.max(bt, st);
    state.phase = t < EVENTS.ignition ? 'Countdown' : phaseAt(t);
  }

  // ---- Public API -------------------------------------------------------------------
  function start() {
    if (state.running) return;
    state.running = true;
    state.armed = true;
    state.t = EVENTS.start;
    cloud.reset();
    visibilityHook?.(true);
    rig.external = true;
    apply(state.t);
    onState(state);
  }

  /** @param {boolean} returnCamera fly back to the pad; false when only the state matters. */
  function reset(returnCamera = true) {
    const wasRunning = state.running;
    state.running = false;
    state.armed = false;
    state.t = EVENTS.start;
    // The clock multiplier belongs to a run, not to the session: leaving it at ×10 meant the
    // next launch ran at ×10 while the panel showed ×1.
    state.speed = 1;
    rig.releaseExternal();
    flight.position.set(0, 0, 0);
    flight.rotation.z = 0;
    ship.position.y = shipHome;
    booster.rotation.z = 0;
    booster.position.x = 0;
    boosterPlume.setThrottle(0, 0);
    shipPlume.setThrottle(0, 0);
    cloud.reset();
    parts.qdArm.rotation.y = 0;
    parts.holddowns.children.forEach((c, i) => c.position.copy(home.clamps[i]));
    env.setAltitude(0);
    chop.position.y = chopHome.y;
    for (const a of chopHome.arms) a.obj.rotation.y = a.ry;
    boosterFlight.position.set(0, 0, 0);
    boosterFlight.rotation.z = 0;
    detachBooster(false);
    env.sun.castShadow = home.shadows;
    camera.near = home.near; camera.far = home.far;
    camera.updateProjectionMatrix();
    visibilityHook?.(false);
    Object.assign(state, { phase: 'En plataforma', altitude: 0, velocity: 0, throttle: 0, downrange: 0 });
    onState(state);
    // The sequence ends 60 km up and 80 km downrange; leaving the viewer there would be a
    // trap, so control comes back looking at the pad the vehicle left.
    if (wasRunning && returnCamera) onFinish();
  }

  /**
   * Jumps straight to a mission time. Used by the headless check and by the screenshot tool.
   * The ground cloud has no closed form, so it is re-simulated from ignition at a fixed step:
   * seeking therefore lands on the same state the animation would have reached by running
   * there, which is the only way a frame-by-frame check means anything.
   */
  function seek(t) {
    if (!state.running) { state.running = true; state.armed = true; visibilityHook?.(true); rig.external = true; }
    cloud.reset();
    const step = 1 / 30;
    // Two windows produce ground cloud: the launch, and the landing burn as the booster
    // settles into the arms. Seeking past either has to re-simulate it, or the check and the
    // screenshot tool see a different pad from the one the animation reaches.
    const from = t > EVENTS.catch - 16 ? EVENTS.catch - 16 : -6.0;
    const until = t > EVENTS.catch - 16 ? t : Math.min(t, CLOUD_UNTIL);
    for (let u = from; u < until; u += step) {
      emitCloud(u, step);
      cloud.update(step, camera, env.sun);
    }
    apply(t);
    onState(state);
  }

  function update(dt) {
    if (!state.running) return;
    const prev = state.t;
    const t = prev + dt * state.speed;
    apply(t);

    const cdt = Math.min(dt * state.speed, 0.12);
    emitCloud(t, cdt);
    cloud.update(cdt, camera, env.sun);

    if (t >= EVENTS.end) { reset(); return; }
    onState(state);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    setSpeed: (k) => { state.speed = k; },
    setVisibilityHook: (fn) => { visibilityHook = fn; },
    events: EVENTS,
    start, reset, seek, update,
    /** Used by verify(): measuring the vehicle mid-flight would measure the wrong thing. */
    get atRest() { return !state.running; },
  };
}
