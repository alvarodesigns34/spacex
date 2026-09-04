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
  end: 196,
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
  [175, 1690], [196, 1880],
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
  [EVENTS.ignition, 'Cuenta atrás'],
  [EVENTS.liftoff, 'Encendido de los 33 Raptor'],
  [EVENTS.towerClear, 'Despegue'],
  [EVENTS.maxQ - 6, 'Ascenso · torre libre'],
  [EVENTS.maxQ + 8, 'Max-Q · presión dinámica máxima'],
  [EVENTS.meco, 'Ascenso'],
  [EVENTS.separation, 'MECO · corte de motores'],
  [EVENTS.separation + 12, 'Separación en caliente'],
  [Infinity, 'Segunda etapa en vuelo'],
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

  // ---- Plumes -------------------------------------------------------------------------
  // Cluster radii: the 33 Raptors sit inside a 3,86 m ring, the ship's six inside a 2,3 m
  // one, so those are the exit-plane radii the merged columns start from.
  const boosterPlume = new Plume({ radius: 4.1, seaLevelLength: 6.0, name: 'plume-booster' });
  const shipPlume = new Plume({ radius: 2.4, seaLevelLength: 7.0, name: 'plume-ship' });
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
  const V = new THREE.Vector3();                             // vehicle mid-body, world
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _pad = new THREE.Vector3();
  const _p2 = new THREE.Vector3(), _q2 = new THREE.Vector3();

  /**
   * Where the middle of the stack actually is, which is not simply "up": once the gravity
   * turn starts the vehicle rotates about its own base, so the mid-body swings downrange.
   */
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
    { until: Infinity, blend: 3.0, shot: (t, pos, tgt) => {
      // Separation: side on, and pulling back so both stages stay in frame as they part.
      vehicleAt(t, tgt);
      const d = 340 + Math.max(0, t - EVENTS.separation) * 6.5;
      pos.set(tgt.x + d * 0.26, tgt.y - d * 0.20, tgt.z + d * 0.94);
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

    // Hot staging: the ship lights first and pushes itself off the booster, which falls back
    // and starts to drift off axis.
    const sep = Math.max(0, t - EVENTS.separation);
    ship.position.y = shipHome + 0.5 * 7.5 * sep * sep;
    booster.rotation.z = THREE.MathUtils.degToRad(9) * Math.min(1, sep / 14);
    booster.position.x = -0.7 * sep;

    boosterPlume.setThrottle(bt, alt);
    shipPlume.setThrottle(st, alt);
    cloud.setFlame(bt * Math.max(0, 1 - alt / 160));

    env.setAltitude(alt);
    // A 340 m shadow frustum is meaningless once the vehicle is kilometres up, and it costs
    // a full shadow pass per frame.
    env.sun.castShadow = home.shadows && alt < 1800;
    camera.near = alt > 900 ? 0.8 : home.near;
    camera.far = alt > 900 ? 260000 : home.far;
    camera.updateProjectionMatrix();

    driveHardware(t);
    if (rig.external) driveCamera(t);

    state.t = t;
    state.altitude = alt;
    state.velocity = speedAt(t);
    state.downrange = downrangeAt(t);
    state.throttle = Math.max(bt, st);
    state.phase = t < EVENTS.ignition ? 'Cuenta atrás' : phaseAt(t);
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
    for (let u = -6.0; u < Math.min(t, CLOUD_UNTIL); u += step) {
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
