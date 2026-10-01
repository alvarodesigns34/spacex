/**
 * Flying the X-15: the exhibit's own airframe leaves its gear and flies on the flight model
 * (x15Flight.js), from a drop at the B-52's altitude to a landing on the runway (terrain.js
 * RUNWAY), with the pilot's controls on the keyboard or a gamepad.
 *
 * Frames. The flight model works in an Earth-centred frame with the launch point at its +X; the
 * scene's ground is an azimuthal equidistant map round the pad (the same projection the globe
 * under the flight uses, plume.js FlightEarth): a point's ground track sits at the pad plus its
 * north/east distance turned onto the scene's axes (+X on a bearing of 100.8°), at its altitude.
 * The attitude is carried back to the pad along the same great circle, so the airplane, the map
 * and the runway agree wherever the flight goes.
 *
 * What the pilot has (X-15 #1, the conventional controls):
 *  - centre stick: the horizontal tails together for pitch, differentially for roll (±15° for
 *    the pilot, TN D-2532 table I); rudder pedals: the upper rudder (±7.5°);
 *  - the ballistic stick on the left: the reaction jets (here: the same stick while the jets are
 *    selected);
 *  - the XLR99 throttle, 50–100 %, engine start and shutdown; stabilizer trim;
 *  - speed brakes, flaps, the gear (lowered once: the X-15's could not be raised in flight);
 *  - the rate dampers (SAS), on or off.
 * The stick's gearing to the surfaces (cubic, so small inputs are fine) and the keyboard's
 * ramp rates are this simulation's, not the airplane's (≈).
 */
import * as THREE from 'three';
import {
  makeState, step, describe, groundTrack, toOriginFrame, rotate, trimStabilizer, alphaTrim,
  MASS, CG_STATION, GEAR_MODEL, R_EARTH, atmosphere,
} from './x15Flight.js';
import { LIMITS, XLR99 } from '../data/x15Aero.js';
import { GEAR, STATIONS, LOWER_FIN, NOSE, WING } from '../data/x15.js';
import { LAUNCH_SITE } from '../data/gulf.js';
import { RUNWAY, fromRunway, toRunway, offRunway } from '../core/terrain.js';
import { COCKPIT } from '../vehicles/x15.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, FT = 0.3048, KT = 0.514444;
const AZ = LAUNCH_SITE.azimuthDeg * D2R, SA = Math.sin(AZ), CA = Math.cos(AZ);

/** Scene (dx, dz from the pad) ↔ ground track (north, east). */
export const sceneToTrack = (dx, dz) => ({ north: dx * CA - dz * SA, east: dx * SA + dz * CA });
export const trackToScene = (north, east) => [east * SA + north * CA, east * CA - north * SA];
/** An (up, east, north) vector at the pad → scene axes. */
const uenToScene = (v, out) => out.set(v[1] * SA + v[2] * CA, v[0], v[1] * CA - v[2] * SA);

/** Runway geometry in the flight model's terms: the heading of runway 13 and its thresholds. */
const RW_HEADING = (LAUNCH_SITE.azimuthDeg + RUNWAY.angleDeg + 360) % 360;   // 130.8°

/**
 * Where the drop and the approach start, relative to the runway (this simulation's setups, ≈):
 *  - drop: 45,000 ft and Mach 0.8, wings level, on the extended centre line of runway 13,
 *    300 km uprange — the B-52's launch conditions (the brief: ≈13.7 km, Mach ≈0.8) and the
 *    distance of the X-15's launch lakes from Edwards, in kind;
 *  - approach: 30 km out on the centre line at 9 km, 230 m/s, propellant gone, as after a burn.
 */
export const SCENARIOS = {
  drop: { label: 'B-52 drop · 45,000 ft · Mach 0.8', out: 300000, altitude: 45000 * FT, mach: 0.8, alpha: 4, propellant: MASS.propellant },
  approach: { label: 'Approach · 9 km · 30 km out (≈)', out: 30000, altitude: 9000, speed: 230, alpha: 6, propellant: 0 },
};

/** Points that must never touch the ground (body axes about the CG): a crash if they do. */
const HARD_POINTS = (() => {
  const P = (s, up, right = 0) => [CG_STATION - s, right, -up];
  const sTail = STATIONS.apexToBase;
  return [
    P(NOSE.tip, 0), P(sTail, -0.55), P(sTail, 0.55),
    P(WING.le(WING.semispan) + 0.5, 0, WING.semispan), P(WING.le(WING.semispan) + 0.5, 0, -WING.semispan),
    P(LOWER_FIN.rootLE + 1.5, -(STATIONS.rudderBoundary)), P(GEAR.skidStation, -0.75, 0),
  ];
})();

export function createX15Flight({ scene, exhibits, env, rig, camera, flightEarth, groundAt, padX, padZ, panel, onStart = () => {}, onState = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const exhibit = exhibits.x15.model;
  const airframe = exhibit.getObjectByName('x15-airframe');
  const gearGroup = airframe.getObjectByName('x15-landing-gear');
  const canopy = airframe.getObjectByName('x15-canopy-hinge');
  const sticks = {
    centre: airframe.getObjectByName('x15-centre-stick'), side: airframe.getObjectByName('x15-side-stick'),
    ballistic: airframe.getObjectByName('x15-ballistic-stick'), throttle: airframe.getObjectByName('x15-throttle'),
  };
  const panelInfo = exhibit.userData.panel ?? null;

  // The airplane's holder: at the centre of gravity, turned to the attitude. The airframe's own
  // frame has its origin at the nose apex, X = −station; the CG is CG_STATION aft of it.
  const holder = new THREE.Group();
  holder.name = 'x15-flight';
  holder.visible = false;
  scene.add(holder);

  // Moving surfaces, each with the sign that moves it the way its deflection means.
  const surf = {};
  const _bb = new THREE.Box3(), _c0 = new THREE.Vector3(), _c1 = new THREE.Vector3();
  function hingeOf(name) {
    const o = airframe.getObjectByName(name);
    if (!o) return null;
    const h = o.userData.hinge;
    return { o, axis: new THREE.Vector3(...h.axis).normalize(), base: o.quaternion.clone() };
  }
  for (const n of ['x15-flap-l', 'x15-flap-r', 'x15-hstab-l', 'x15-hstab-r', 'x15-upper-fin-rudder']) surf[n] = hingeOf(n);
  // Speed brakes open outward: the sign that moves each panel's centre away from the fin's plane.
  const brakes = [];
  airframe.traverse((o) => { if (/speedbrake-[lr]$/.test(o.name)) brakes.push(hingeOf(o.name)); });
  for (const b of brakes) {
    _bb.setFromObject(b.o); _bb.getCenter(_c0);
    b.o.quaternion.copy(b.base).multiply(new THREE.Quaternion().setFromAxisAngle(b.axis, 0.3));
    b.o.updateMatrixWorld(true);
    _bb.setFromObject(b.o); _bb.getCenter(_c1);
    airframe.worldToLocal(_c0); airframe.worldToLocal(_c1);
    b.sign = Math.abs(_c1.z) > Math.abs(_c0.z) ? 1 : -1;
    b.o.quaternion.copy(b.base);
  }
  const setHinge = (h, deg, sign = 1) => { if (h) h.o.quaternion.copy(h.base).multiply(_q.setFromAxisAngle(h.axis, sign * deg * D2R)); };
  const _q = new THREE.Quaternion();

  const state = {
    running: false, paused: false, scenario: 'drop', camera: 'chase', t: 0,
    sim: null, d: null, ctl: null, outcome: null, touchdown: null, messages: [],
  };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, far: 0, fov: 0 };

  // ---- Controls -------------------------------------------------------------------------------
  const keys = new Set();
  const input = { pitch: 0, roll: 0, yaw: 0, trim: 0, throttle: 1, engine: false, rcsMode: false, speedBrake: false, flaps: false, gear: false, sas: true };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const FLIGHT_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Comma', 'Period', 'KeyR', 'KeyF', 'KeyI', 'KeyB', 'KeyN', 'KeyG', 'KeyY', 'KeyC', 'KeyK', 'KeyX', 'KeyZ', 'KeyV', 'KeyP', 'KeyL', 'KeyT', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']);
  function onKeyDown(e) {
    if (!state.running || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!FLIGHT_CODES.has(e.code)) return;
    // The flight owns these keys: main.js's shortcuts (vehicle numbers, G, X, V, L, T…) wait.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    keys.add(e.code);
    switch (e.code) {
      case 'KeyR': input.throttle = Math.min(1, Math.round((input.throttle + 0.1) * 10) / 10); break;
      case 'KeyF': input.throttle = Math.max(XLR99.throttleMin, Math.round((input.throttle - 0.1) * 10) / 10); break;
      case 'KeyI': toggleEngine(); break;
      case 'KeyB': input.speedBrake = !input.speedBrake; break;
      case 'KeyN': input.flaps = !input.flaps; break;
      case 'KeyG': lowerGear(); break;
      case 'KeyY': input.sas = !input.sas; note(input.sas ? 'Dampers on' : 'Dampers off'); break;
      case 'KeyC': cycleCamera(); break;
      case 'KeyK': setPaused(!state.paused); break;
      case 'Escape': reset(); break;
      default: break;
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  // A key released in another window never arrives: drop them all when the page loses focus.
  function onBlur() { keys.clear(); }

  function toggleEngine() {
    if (input.engine) { input.engine = false; note('XLR99 shut down'); return; }
    if (!(state.sim?.prop > 0)) { note('No propellant left'); return; }
    input.engine = true;
    note('XLR99 lit');
  }
  function lowerGear() {
    if (input.gear) return;
    input.gear = true;
    gearGroup.visible = true;
    note('Gear down (it cannot be raised again)');
  }
  function note(text) { state.messages.push({ text, t: performance.now() }); if (state.messages.length > 4) state.messages.shift(); }

  /** Keyboard and gamepad to stick, pedals, trim. dt in real seconds. */
  function readControls(dt) {
    const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
    const ramp = (cur, target, rate) => cur + THREE.MathUtils.clamp(target - cur, -rate * dt, rate * dt);
    // Pull back (S, ↓) is nose up.
    const tp = k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp');
    const tr = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    const ty = k('KeyE', 'KeyE') - k('KeyQ', 'KeyQ');
    input.pitch = ramp(input.pitch, tp, tp ? 2.2 : 4);
    input.roll = ramp(input.roll, tr, tr ? 2.6 : 5);
    input.yaw = ramp(input.yaw, ty, ty ? 2.6 : 5);
    input.trim += (k('Period', 'Period') - k('Comma', 'Comma')) * 2.0 * dt;   // degrees of δh per second
    input.rcsMode = keys.has('Space');
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) {
      if (!g || !g.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.08 ? 0 : v);
      if (g.axes.length >= 2 && (Math.abs(g.axes[0]) > 0.08 || Math.abs(g.axes[1]) > 0.08)) { input.roll = dz(g.axes[0]); input.pitch = dz(g.axes[1]); }
      if (g.axes.length >= 3 && Math.abs(g.axes[2]) > 0.08) input.yaw = dz(g.axes[2]);
      const b = (i) => !!g.buttons[i]?.pressed;
      if (b(0)) input.rcsMode = true;
      if (b(7)) input.throttle = Math.min(1, input.throttle + 0.4 * dt);
      if (b(6)) input.throttle = Math.max(XLR99.throttleMin, input.throttle - 0.4 * dt);
      if (b(4)) input.trim -= 2 * dt;
      if (b(5)) input.trim += 2 * dt;
      padEdge(g, 1, () => { input.speedBrake = !input.speedBrake; });
      padEdge(g, 2, () => { input.flaps = !input.flaps; });
      padEdge(g, 3, lowerGear);
      padEdge(g, 8, () => { input.sas = !input.sas; });
      padEdge(g, 9, () => setPaused(!state.paused));
      padEdge(g, 10, toggleEngine);
      padEdge(g, 11, cycleCamera);
      break;
    }
    input.trim = THREE.MathUtils.clamp(input.trim, LIMITS.dhMin, LIMITS.dhMax);
  }
  const padPrev = new Map();
  function padEdge(g, i, fn) {
    const key = `${g.index}:${i}`, on = !!g.buttons[i]?.pressed;
    if (on && !padPrev.get(key)) fn();
    padPrev.set(key, on);
  }

  /** The flight model's control inputs from the pilot's. */
  function controls() {
    const cubic = (x) => 0.45 * x + 0.55 * x * x * x;
    const stick = !input.rcsMode;
    const c = {
      dh: input.trim - (stick ? cubic(input.pitch) * 20 : 0),
      da: stick ? cubic(input.roll) * LIMITS.daMax : 0,
      dv: -cubic(input.yaw) * LIMITS.dvMax,
      throttle: input.engine ? input.throttle : 0,
      speedBrake: input.speedBrake ? LIMITS.speedBrake : 0,
      flaps: input.flaps ? 32 : 0,
      gear: input.gear,
      sas: input.sas,
      rcs: input.rcsMode ? [input.roll, input.pitch, input.yaw] : null,
      groundAlt: state.groundAlt ?? 0,
    };
    return c;
  }

  // ---- Frames -----------------------------------------------------------------------------------
  const _u = new THREE.Vector3(), _xs = new THREE.Vector3(), _ys = new THREE.Vector3(), _zs = new THREE.Vector3(), _m = new THREE.Matrix4();
  /** Scene position of a flight-model position. */
  function scenePos(r, out) {
    const gt = groundTrack(r);
    const [x, z] = trackToScene(gt.north, gt.east);
    return out.set(padX + x, Math.hypot(r[0], r[1], r[2]) - R_EARTH, padZ + z);
  }
  /** A body-axis vector at state s, in the scene's axes. */
  function sceneDir(s, vb, out) { return uenToScene(toOriginFrame(rotate(s.q, vb), s.r), out); }
  function placeAirplane(s) {
    scenePos(s.r, holder.position);
    // Model axes: X forward (body x), Y up (−body z), Z right (body y).
    sceneDir(s, [1, 0, 0], _xs); sceneDir(s, [0, 0, -1], _ys); sceneDir(s, [0, 1, 0], _zs);
    _m.makeBasis(_xs, _ys, _zs);
    holder.quaternion.setFromRotationMatrix(_m);
    holder.updateMatrixWorld(true);
  }
  function groundAltAt(s) {
    const p = scenePos(s.r, _u);
    return Math.max(0, groundAt(p.x, p.z));
  }

  // ---- Surfaces ---------------------------------------------------------------------------------
  function animateSurfaces(info, ctl) {
    if (!info) return;
    // LE-up deflection of each all-moving tail: δh ± δa/2 (left trailing edge down for +δa).
    setHinge(surf['x15-hstab-l'], info.dh + info.da / 2);
    setHinge(surf['x15-hstab-r'], info.dh - info.da / 2);
    setHinge(surf['x15-upper-fin-rudder'], -info.dv);
    setHinge(surf['x15-flap-l'], ctl.flaps);
    setHinge(surf['x15-flap-r'], ctl.flaps);
    for (const b of brakes) setHinge(b, ctl.speedBrake, b.sign);
    gearGroup.visible = !!ctl.gear;
    // The pilot's hands: the centre and side sticks with the stick, the left one with the
    // jets, the throttle with the throttle (±15° and ±30° of travel: ≈).
    const aero = !input.rcsMode;
    for (const k of [sticks.centre, sticks.side]) if (k) k.rotation.set(aero ? input.roll * 0.26 : 0, 0, aero ? input.pitch * 0.26 : 0);
    if (sticks.ballistic) sticks.ballistic.rotation.set(aero ? 0 : input.roll * 0.3, aero ? 0 : input.yaw * 0.3, aero ? 0 : input.pitch * 0.3);
    if (sticks.throttle) sticks.throttle.rotation.z = input.engine ? -(input.throttle - 0.75) * 1.0 : 0.5;
  }

  // ---- Cameras ----------------------------------------------------------------------------------
  const CAMERAS = ['chase', 'cockpit', 'tower', 'orbit'];
  const _cam = new THREE.Vector3(), _look = new THREE.Vector3(), _off = new THREE.Vector3(), _vel = new THREE.Vector3();
  let chase = null, ridePrev = null;
  function cycleCamera() {
    const i = CAMERAS.indexOf(state.camera);
    setCamera(CAMERAS[(i + 1) % CAMERAS.length]);
  }
  function setCamera(name) {
    state.camera = name;
    chase = null;
    if (name === 'orbit') {
      rig.releaseExternal?.();
      rig.external = false;
      rig.target.copy(holder.position);
      ridePrev = holder.position.clone();
      camera.fov = saved.fov; camera.updateProjectionMatrix();
    } else {
      rig.external = true;
      ridePrev = null;
    }
    note(`Camera · ${name}`);
  }
  function placeCamera(dt) {
    const s = state.sim, d = state.d;
    if (!rig.external) {
      // The visitor's own orbit, riding on the airplane.
      if (!ridePrev) ridePrev = holder.position.clone();
      _off.subVectors(holder.position, ridePrev);
      camera.position.add(_off);
      rig.target.add(_off);
      ridePrev.copy(holder.position);
      state.camera = 'orbit';
      return;
    }
    if (state.camera === 'cockpit') {
      // The pilot's eye in his seat (COCKPIT, x15.js: ≈).
      _cam.set(-COCKPIT.eye.station, COCKPIT.eye.up, 0); airframe.localToWorld(_cam);
      // Looking along the nose and 12° down, where the panel is (≈).
      sceneDir(s, [Math.cos(0.21), 0, Math.sin(0.21)], _look).multiplyScalar(100).add(_cam);
      sceneDir(s, [0, 0, -1], _u);
      camera.up.copy(_u);
      camera.position.copy(_cam);
      camera.lookAt(_look);
      camera.up.set(0, 1, 0);
      camera.fov = 66; camera.near = 0.05; camera.updateProjectionMatrix();
      return;
    }
    if (state.camera === 'tower') {
      // On the flat beside runway 13's touchdown zone, 400 m off the centre line, 12 m up.
      const [x, z] = fromRunway(-RUNWAY.length / 2 + 500, -400);
      camera.position.set(x, 12, z);
      camera.lookAt(holder.position);
      const dist = camera.position.distanceTo(holder.position);
      camera.fov = THREE.MathUtils.clamp(2 * Math.atan(40 / dist) * R2D, 4, 60);
      camera.updateProjectionMatrix();
      return;
    }
    // Chase: behind along the flight path, a little above; smoothed so it trails the turns.
    // Along the airplane's nose when it is nearly stopped, along its velocity otherwise.
    const vs = d.V > 20 ? uenToScene(toOriginFrame(s.v, s.r), _vel).normalize() : sceneDir(s, [1, 0, 0], _vel);
    vs.y = Math.max(-0.5, vs.y); vs.normalize();
    const back = 34, up = 7;
    _cam.copy(holder.position).addScaledVector(vs, -back);
    _cam.y += up;
    if (!chase || chase.distanceTo(_cam) > 500) chase = _cam.clone();
    const k = 1 - Math.exp(-dt * 3.5);
    chase.lerp(_cam, k);
    // Never under the ground.
    chase.y = Math.max(chase.y, (state.groundAlt ?? 0) + 2);
    // The camera keeps up with the airplane's motion first, then eases towards its slot.
    camera.position.copy(chase);
    camera.lookAt(holder.position);
    camera.fov = saved.fov; camera.updateProjectionMatrix();
  }

  // ---- World ------------------------------------------------------------------------------------
  // The centre's ground is a flat disc 2.5 km across: from far off it would float above the
  // curved Earth's horizon (7 km of drop at 300 km). Past 40 km the site is put away and the
  // globe alone is the ground; within it, the disc and the globe meet at the disc's edge.
  let siteParts = [];
  function siteVisible(on) {
    if (!on && !siteParts.length) {
      const names = new Set(['campus', 'markings', 'ground', 'x15-runway']);
      siteParts = scene.children.filter(o => o !== holder && o.visible && !o.isLight && (names.has(o.name) || o.name.startsWith('exhibit-') || o.name === 'launch-complex' || o === env.ground));
      for (const o of siteParts) o.visible = false;
    } else if (on && siteParts.length) {
      for (const o of siteParts) o.visible = true;
      siteParts = [];
    }
  }
  function updateWorld() {
    siteVisible(Math.hypot(camera.position.x - padX, camera.position.z - padZ) < 40000);
    for (const o of siteParts) o.visible = false;
    const camAlt = Math.max(0, camera.position.y);
    env.setAltitude(camAlt);
    flightEarth.update(camera, env.sunDir, camAlt, { force: true, drop: 1.2 });
    camera.near = camAlt > 20000 ? 2 : 0.3;
    camera.far = Math.max(90000, Math.sqrt(2 * 6371000 * Math.max(camAlt, 1)) * 1.3 + 60000);
    camera.updateProjectionMatrix();
    // The shadow box and the orbit's centre follow the airplane.
    if (rig.external) rig.target.copy(holder.position);
  }

  // ---- Ground: touchdown, crash, stop -------------------------------------------------------------
  function checkGround(s, d, ctl) {
    const g = state.groundAlt ?? 0;
    // Hard points below the ground: a crash.
    for (const p of HARD_POINTS) {
      const pi = rotate(s.q, p), r = [s.r[0] + pi[0], s.r[1] + pi[1], s.r[2] + pi[2]];
      if (Math.hypot(...r) - R_EARTH < g - 0.05) return finish('crash', ctl.gear ? 'The airframe struck the ground.' : 'Belly landing: the gear was not down.');
    }
    if (!state.touchdown) {
      const contact = GEAR_MODEL.points.some((gp) => { const pi = rotate(s.q, gp.p); return Math.hypot(s.r[0] + pi[0], s.r[1] + pi[1], s.r[2] + pi[2]) - R_EARTH < g; });
      if (contact && ctl.gear) {
        const p = scenePos(s.r, _u), [a, c] = toRunway(p.x, p.z);
        state.touchdown = {
          sink: -d.vD, speedKt: d.V / KT, alpha: d.alpha, on: offRunway(p.x, p.z) < 1,
          fromThreshold: a + RUNWAY.length / 2, offCentre: c, heading: d.psi,
        };
        // TM X-207: the gear's design sink rate is 9 ft/s for the airplane (18 ft/s at the nose).
        if (state.touchdown.sink > 9 * FT) return finish('crash', `Touchdown at ${(state.touchdown.sink / FT).toFixed(1)} ft/s: beyond the gear's 9 ft/s design limit (TM X-207).`);
        note(`Touchdown · ${(state.touchdown.sink / FT).toFixed(1)} ft/s · ${state.touchdown.speedKt.toFixed(0)} kt`);
      }
    } else if (d.V < 0.3) {
      return finish('stopped');
    }
    return null;
  }
  function finish(outcome, why = '') {
    state.outcome = { kind: outcome, why, touchdown: state.touchdown, t: state.sim.t, stop: null };
    if (outcome === 'stopped') {
      const p = scenePos(state.sim.r, _u), [a, c] = toRunway(p.x, p.z);
      state.outcome.stop = { fromThreshold: a + RUNWAY.length / 2, offCentre: c, onRunway: offRunway(p.x, p.z) < 1 };
    }
    state.paused = true;
    return outcome;
  }

  // ---- Lifecycle --------------------------------------------------------------------------------
  function initialState(name) {
    const sc = SCENARIOS[name];
    // Uprange of runway 13's threshold along its centre line, heading down it.
    const [tx, tz] = fromRunway(-RUNWAY.length / 2, 0);
    const back = RW_HEADING * D2R;
    const t0 = sceneToTrack(tx - padX, tz - padZ);
    const north = t0.north - sc.out * Math.cos(back), east = t0.east - sc.out * Math.sin(back);
    const speed = sc.speed ?? sc.mach * atmosphere(sc.altitude).a;
    return makeState({ altitude: sc.altitude, north, east, speed, heading: RW_HEADING, gamma: 0, alpha: sc.alpha, propellant: sc.propellant });
  }

  function start(name = 'drop') {
    if (state.running) reset(false);
    onStart();
    state.scenario = SCENARIOS[name] ? name : 'drop';
    saved.parent = airframe.parent;
    saved.position.copy(airframe.position);
    saved.quaternion.copy(airframe.quaternion);
    saved.near = camera.near; saved.far = camera.far; saved.fov = camera.fov;
    holder.add(airframe);
    airframe.position.set(CG_STATION, 0, 0);
    airframe.quaternion.identity();
    saved.canopy = canopy?.rotation.z ?? 0;
    if (canopy) canopy.rotation.z = 0;
    holder.visible = true;
    Object.assign(input, { pitch: 0, roll: 0, yaw: 0, throttle: 1, engine: false, rcsMode: false, speedBrake: false, flaps: false, gear: false, sas: true });
    state.sim = initialState(state.scenario);
    state.groundAlt = 0;
    // Trim for the start: the stabilizer that holds the starting α.
    const d0 = describe(state.sim);
    input.trim = trimStabilizer(Math.max(0.6, d0.mach), d0.alpha);
    Object.assign(state, { running: true, paused: false, t: 0, outcome: null, touchdown: null, messages: [], d: d0, ctl: controls() });
    if (rig.mode !== 'orbit') rig.setMode('orbit');
    setCamera('chase');
    placeAirplane(state.sim);
    animateSurfaces({ dh: input.trim, da: 0, dv: 0 }, state.ctl);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    visibilityHook?.(true);
    note(state.scenario === 'drop' ? 'Dropped from the B-52 · I lights the XLR99' : 'Approach · runway 13 ahead');
    panel?.show(true);
    apply(0);
  }

  function reset(returnCamera = true) {
    if (!state.running) return;
    state.running = false;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    keys.clear();
    // The airframe goes back on its gear in the row, every surface at rest.
    for (const h of [...Object.values(surf), ...brakes]) if (h) h.o.quaternion.copy(h.base);
    gearGroup.visible = true;
    if (canopy) canopy.rotation.z = saved.canopy;
    for (const k of Object.values(sticks)) k?.rotation.set(0, 0, 0);
    saved.parent.add(airframe);
    airframe.position.copy(saved.position);
    airframe.quaternion.copy(saved.quaternion);
    holder.visible = false;
    siteVisible(true);
    flightEarth.hide();
    env.setAltitude(0);
    camera.near = saved.near; camera.far = saved.far; camera.fov = saved.fov;
    camera.updateProjectionMatrix();
    rig.releaseExternal?.();
    visibilityHook?.(false);
    panel?.show(false);
    onState(state);
    if (returnCamera) onFinish(state.outcome);
  }

  function setPaused(on) {
    if (!state.running) return;
    if (state.outcome && !on) return;   // after a stop or a crash, only a restart flies again
    state.paused = !!on;
  }

  /** Advances the flight by dt real seconds and redraws. */
  function apply(dt) {
    readControls(dt);
    const ctl = controls();
    state.ctl = ctl;
    if (!state.paused && dt > 0) {
      let left = Math.min(dt, 0.1);
      let n = 0;
      while (left > 1e-6 && n < 60) {
        const nearGround = state.d.agl < 25;
        const h = Math.min(left, nearGround ? 1 / 400 : 1 / 200);
        state.groundAlt = groundAltAt(state.sim);
        ctl.groundAlt = state.groundAlt;
        state.sim = step(state.sim, ctl, h);
        state.d = describe(state.sim, state.groundAlt);
        left -= h; n++;
        if (state.sim.prop <= 0 && input.engine) { input.engine = false; note('Burnout: propellant exhausted'); }
        if (checkGround(state.sim, state.d, ctl)) break;
      }
      state.t = state.sim.t;
    }
    placeAirplane(state.sim);
    animateSurfaces(state.sim.info ?? { dh: ctl.dh, da: ctl.da, dv: ctl.dv }, ctl);
    placeCamera(Math.max(dt, 1 / 120));
    updateWorld();
    publish();
  }

  /** What the instruments show. */
  function publish() {
    const s = state.sim, d = state.d, info = s.info ?? {};
    const atm = atmosphere(Math.max(0, d.altitude));
    const p = scenePos(s.r, _u), [a, c] = toRunway(p.x, p.z);
    const toThreshold = -RUNWAY.length / 2 - a;
    state.readout = {
      t: s.t, mach: d.mach, keas: d.V * Math.sqrt(atm.rho / 1.225) / KT, ktas: d.V / KT,
      // The airspeed indicator reads impact pressure; below Mach 1 that is EAS with a small
      // compressibility correction, taken as EAS here (≈).
      kias: d.V * Math.sqrt(atm.rho / 1.225) / KT, rollRate: d.p * R2D,
      altitudeFt: d.altitude / FT, aglFt: d.agl / FT, vsFpm: -d.vD / FT * 60,
      alpha: d.alpha, beta: d.beta, pitch: d.theta, roll: d.phi, heading: (d.psi + 360) % 360,
      qbarPsf: d.qbar / 47.880259, throttle: input.engine ? input.throttle : 0, engine: input.engine,
      propellantLb: s.prop / 0.45359237, burnLeft: input.engine ? s.prop / (XLR99.flowLbPerMin / 60 * 0.45359237 * input.throttle) : null,
      massLb: d.mass / 0.45359237, dh: info.dh ?? 0, trim: input.trim, da: info.da ?? 0, dv: info.dv ?? 0,
      sas: input.sas, rcs: input.rcsMode, speedBrake: input.speedBrake, flaps: input.flaps, gear: input.gear,
      runway: { distKm: Math.hypot(toThreshold, c) / 1000 * Math.sign(toThreshold || 1), along: a, across: c, bearing: bearingTo(p, fromRunway(-RUNWAY.length / 2, 0)) },
      alphaTrim: alphaTrim(Math.max(0.6, d.mach), input.trim), nz: info.nz ?? 1,
      camera: state.camera, paused: state.paused, outcome: state.outcome, touchdown: state.touchdown,
      messages: state.messages.filter(m => performance.now() - m.t < 5000).map(m => m.text),
    };
    panel?.update(state.readout);
    if (state.camera === 'cockpit' || !rig.external) panelInfo?.update(state.readout);
    onState(state);
  }
  function bearingTo(p, [x, z]) {
    const { north, east } = sceneToTrack(x - p.x, z - p.z);
    return (Math.atan2(east, north) * R2D + 360) % 360;
  }

  function update(dt) {
    if (!state.running) return;
    apply(dt);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    start, reset, update, setPaused, setCamera, cycleCamera,
    scenarios: SCENARIOS,
    /** For the checks: the pilot's inputs, set directly. */
    input,
  };
}
