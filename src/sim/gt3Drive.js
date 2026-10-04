/**
 * Driving the Porsche 911 GT3 RS: the exhibit's own car, on its vehicle model (gt3Car.js),
 * from where it waits on the skid pad, onto its circuit or anywhere over the plain. No change
 * of scene: the car, the circuit, the site and the runway are the ones the visitor walks round.
 *
 * Controls: W throttle, S brake (held at a standstill, reverse; with W, Launch Control: let go of S to launch), A/D steer, Space the parking
 * brake (tapped into a corner it locks the rears and starts a drift, which the throttle and the
 * counter-steer then hold), T the PSM's stages (on by default; ESC OFF; ESC+TC OFF), C the
 * camera, M the engine's sound (off until turned on), E and Q the paddles (up and down: the PDK's
 * manual mode; G back to automatic), Enter back to the pad, Esc to end. The
 * keyboard's steering ramps in and centres itself, and asks for as much lock as the grip can
 * use at the speed and under the braking of the moment (steerReach), more the way a slide is
 * caught, for the counter-steer (≈ this simulation's aid).
 *
 * Tyre marks: where a tyre slides (combined slip past its peak) on a hard surface it lays a
 * dark strip of its own width, darker the harder it slides; the strips stay until the pool of
 * 12,000 segments wraps.
 */
import * as THREE from 'three';
import { createGt3Car, CAR, steerReach, steerRate, OUTLINE } from './gt3Car.js';
import { AXLE_F, AXLE_R } from '../vehicles/gt3rs.js';
import { EYE } from '../vehicles/gt3Cabin.js';
import { WHEELS } from '../data/gt3rs.js';
import { trackCoords, toLocal, LAP, START } from '../core/circuitPlan.js';
import { createGt3Sound } from './gt3Sound.js';
import { windAt } from '../core/wind.js';
import { createEffects } from '../core/effects.js';
import { createGt3Damage } from './gt3Damage.js';
import { readPad, rumbleFor } from './gt3Pad.js';
import { createGt3Cameras, roadShake } from './gt3Camera.js';

const R2D = 180 / Math.PI;
const CAMERAS = ['chase', 'driver', 'bonnet', 'trackside', 'orbit'];
const HARD = new Set(['track', 'verge', 'kerb', 'pad', 'runway', 'road']);

/** The marks: one geometry of quads in a ring buffer, drawn just above the surface. */
export function createSkidMarks(scene, max = 12000) {
  const pos = new Float32Array(max * 4 * 3), col = new Float32Array(max * 4 * 4);
  const idx = new Uint32Array(max * 6);
  for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  // The marks lie flat on the ground: one normal, straight up.
  const nor = new Float32Array(max * 4 * 3);
  for (let i = 0; i < max * 4; i++) nor[i * 3 + 1] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.MeshStandardMaterial({
    name: 'gt3-tyre-marks', color: 0x050505, roughness: 0.92, metalness: 0, vertexColors: true, transparent: true,
    // A segment's winding follows the way the tyre was going: either face may be the upper one.
    side: THREE.DoubleSide,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'gt3-tyre-marks';
  m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1;
  scene.add(m);
  let n = 0, used = 0;
  const last = new Map();       // per tyre: { l: [x,y,z], r: [x,y,z], a }
  /** Extends tyre i's mark to its contact patch (centre c, lateral unit vector side, half-width w). */
  function lay(i, c, side, w, a) {
    const L = [c.x - side.x * w, c.y, c.z - side.z * w], R = [c.x + side.x * w, c.y, c.z + side.z * w];
    const p = last.get(i);
    if (p && Math.hypot(c.x - p.c[0], c.z - p.c[2]) < 4) {
      if (Math.hypot(c.x - p.c[0], c.z - p.c[2]) < 0.12) return;   // a segment every 12 cm
      const k = n % max;
      pos.set([...p.l, ...p.r, ...L, ...R], k * 12);
      col.set([1, 1, 1, p.a, 1, 1, 1, p.a, 1, 1, 1, a, 1, 1, 1, a], k * 16);
      n++; used = Math.min(max, used + 1);
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, used * 6);
    }
    last.set(i, { c: [c.x, c.y, c.z], l: L, r: R, a });
  }
  function lift(i) { last.delete(i); }
  function clear() { n = 0; used = 0; last.clear(); geo.setDrawRange(0, 0); }
  return { lay, lift, clear, mesh: m, get count() { return used; } };
}

/**
 * Tyre smoke: soft grey puffs from a tyre sliding hard on a hard surface, growing, rising a
 * little and drifting back as they thin out (≈, a look, not a simulation of the rubber's
 * vapour). A pool of point sprites with their own size and opacity.
 */
export function createTyreSmoke(scene, max = 900) {
  const pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  const vel = new Float32Array(max * 3), age = new Float32Array(max).fill(1e9), life = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    name: 'gt3-tyre-smoke', transparent: true, depthWrite: false,
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
      void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * scale / max(0.5, -mv.z), 1.0, 512.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = vA * smoothstep(0.5, 0.1, r); gl_FragColor = vec4(vec3(0.84, 0.85, 0.86), a); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'gt3-tyre-smoke';
  points.frustumCulled = false;
  points.renderOrder = 3;
  scene.add(points);
  let next = 0;
  function emit(x, y, z, vx, vz, strength) {
    const i = next; next = (next + 1) % max;
    pos.set([x + (Math.random() - 0.5) * 0.2, y + 0.15, z + (Math.random() - 0.5) * 0.2], i * 3);
    vel.set([vx * 0.25 + (Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.3, vz * 0.25 + (Math.random() - 0.5) * 0.6], i * 3);
    age[i] = 0; life[i] = 1.6 + Math.random() * 1.4 * strength;
  }
  function update(dt) {
    let any = false;
    for (let i = 0; i < max; i++) {
      if (age[i] > life[i]) { alpha[i] = 0; continue; }
      any = true;
      age[i] += dt;
      const k = age[i] / life[i];
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      vel[i * 3] *= 1 - dt; vel[i * 3 + 2] *= 1 - dt;
      size[i] = 0.5 + 3.2 * Math.sqrt(k);
      alpha[i] = 0.22 * (1 - k) * Math.min(1, age[i] * 6);
    }
    points.visible = any;
    geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
  }
  function clear() { age.fill(1e9); alpha.fill(0); points.visible = false; }
  return { emit, update, clear, points };
}

/**
 * Spray: the water a tyre throws up running through it, and the bow wave the body pushes ahead
 * of it. Droplets fly on ballistic paths and fall back to the water (≈ the sizes and speeds:
 * a tyre's spray leaves at a fraction of the road speed, sideways and up off the tread).
 */
export function createSpray(scene, max = 1600) {
  const pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  const vel = new Float32Array(max * 3), age = new Float32Array(max).fill(1e9), life = new Float32Array(max), floor = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    name: 'gt3-spray', transparent: true, depthWrite: false,
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
      void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * scale / max(0.5, -mv.z), 1.0, 512.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = vA * smoothstep(0.5, 0.15, r); gl_FragColor = vec4(vec3(0.86, 0.9, 0.93), a); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'gt3-spray';
  points.frustumCulled = false;
  points.renderOrder = 3;
  scene.add(points);
  let next = 0;
  /** A droplet from (x, y, z) at velocity (vx, vy, vz), falling back to the surface at height `surface`. */
  function emit(x, y, z, vx, vy, vz, surface, big = 0) {
    const i = next; next = (next + 1) % max;
    pos.set([x, y, z], i * 3);
    vel.set([vx, vy, vz], i * 3);
    age[i] = 0; life[i] = 2.5; floor[i] = surface; size[i] = 0.05 + 0.12 * Math.random() + big * 0.25;
  }
  function update(dt) {
    let any = false;
    for (let i = 0; i < max; i++) {
      if (age[i] > life[i]) { alpha[i] = 0; continue; }
      any = true;
      age[i] += dt;
      vel[i * 3 + 1] -= 9.81 * dt;
      // Air drag on a droplet, ≈.
      const k = 1 - 0.6 * dt;
      vel[i * 3] *= k; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < floor[i] && vel[i * 3 + 1] < 0) { age[i] = 1e9; alpha[i] = 0; continue; }
      size[i] *= 1 + 0.4 * dt;
      alpha[i] = 0.55 * Math.min(1, age[i] * 12) * (1 - age[i] / life[i]);
    }
    points.visible = any;
    geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
  }
  function clear() { age.fill(1e9); alpha.fill(0); points.visible = false; }
  return { emit, update, clear, points };
}

export function createGt3Drive({ scene, exhibit, env, rig, camera, ground, obstacles, hud, home, onStart = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const car = exhibit.model;            // the 'gt3rs' group
  const sprung = car.getObjectByName('gt3-sprung');
  const wheels = ['fl', 'fr', 'rl', 'rr'].map(t => car.getObjectByName(`gt3-wheel-${t[0]}${t[1]}`));
  const flap = car.getObjectByName('gt3-wing-flap');
  const flapBase = flap?.quaternion.clone();
  // The brake lights: lit on the brakes (the material the lamp units' blades and the high-level light share).
  const brakeMat = car.getObjectByName('gt3-brake-light')?.material ?? null;
  const brakeOff = brakeMat?.emissiveIntensity ?? 0;
  // The cabin's live instruments: the tachometer's needle, the gear and the speed, the steering wheel.
  const instruments = car.getObjectByName('gt3-cabin')?.userData.instruments;
  const holder = new THREE.Group();
  holder.name = 'gt3-drive';
  holder.visible = false;
  scene.add(holder);
  const marks = createSkidMarks(scene);
  const smoke = createTyreSmoke(scene);
  const spray = createSpray(scene);
  // What a crash does to the car and throws about (gt3Damage.js, core/effects.js).
  const fx = createEffects(scene);
  const damage = createGt3Damage({ car, scene, effects: fx, ground });
  const sound = createGt3Sound();

  // In the site's wind (core/wind.js).
  const sim = createGt3Car({ ground, obstacles, wind: windAt });
  // Each wheel's place on the car, for its travel on the springs.
  const wheelY = wheels.map(w => w?.position.y ?? 0);
  const s = sim.state;
  const state = { running: false, paused: false, camera: 'chase', readout: null, messages: [], manual: false, lap: null, best: null, laps: 0 };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, far: 0, fov: 0 };

  // ---- Controls ---------------------------------------------------------------------------------
  const keys = new Set();
  const driver = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyT', 'KeyK', 'KeyM', 'KeyQ', 'KeyE', 'KeyG', 'Escape', 'Enter']);
  // An open modal dialog (the guide) owns the keyboard: Tab and Shift+Tab stay inside it and
  // Escape closes it, not the drive; and the keys held when it opened are let go.
  const modalOpen = () => typeof document !== 'undefined' && !!document.querySelector('[role="dialog"][aria-modal="true"]:not(.hidden)');
  function onKeyDown(e) {
    if (!state.running || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (modalOpen()) { keys.clear(); return; }
    if (e.code === 'KeyH' || e.key === '?') return;
    e.stopImmediatePropagation();
    if (!CODES.has(e.code)) return;
    e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyC': cycleCamera(); break;
      case 'KeyT': cyclePsm(); break;
      case 'KeyK': setPaused(!state.paused); break;
      case 'KeyM': setSound(!sound.enabled); break;
      case 'KeyE': paddle(1); break;
      case 'KeyQ': paddle(-1); break;
      case 'KeyG': setPaddles(!s.paddles); break;
      case 'Enter': restart(); break;
      case 'Escape': reset(); break;
      default: break;
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); }
  function note(text) { state.messages.push({ text, t: performance.now() }); if (state.messages.length > 4) state.messages.shift(); }
  // The PSM's three stages, as Porsche's GT cars have them: on, ESC OFF (the traction control still
  // works), ESC+TC OFF. T steps through them.
  const PSM_NOTES = {
    on: 'PSM on: traction and stability control',
    escOff: 'ESC OFF: the traction control still works, the slides are yours',
    off: 'ESC+TC OFF: the tail is yours',
  };
  function setPsm(mode) { s.psm = PSM_NOTES[mode] ? mode : 'on'; note(PSM_NOTES[s.psm]); }
  function cyclePsm() { setPsm({ on: 'escOff', escOff: 'off', off: 'on' }[s.psm]); }
  function setTraction(on) { setPsm(on ? 'on' : 'off'); }
  // The paddles: the first pull puts the PDK in its manual mode; G gives it back its automatic one.
  // Pulls made while a shift is still going through wait their turn, as the PDK takes them.
  let pulls = 0;
  const padPrev = {};
  let padRumbleT = 0;
  function paddle(dir) {
    if (!s.paddles) setPaddles(true);
    pulls = THREE.MathUtils.clamp(pulls + dir, -3, 3);
  }
  function setPaddles(on) {
    s.paddles = !!on; pulls = 0;
    note(s.paddles ? 'PDK manual: E up · Q down · G back to automatic' : 'PDK automatic');
  }
  function setSound(on) { sound.setEnabled(on); note(sound.enabled ? 'Sound on: the flat six, the tyres, the wind (synthesised)' : 'Sound off'); }

  function readControls(dt) {
    if (state.manual) { toSim(); return; }
    if (keys.size && modalOpen()) keys.clear();
    const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
    const ramp = (cur, target, rate) => cur + THREE.MathUtils.clamp(target - cur, -rate * dt, rate * dt);
    const gas = k('KeyW', 'ArrowUp'), brake = k('KeyS', 'ArrowDown');
    const left = k('KeyA', 'ArrowLeft'), right = k('KeyD', 'ArrowRight');
    // Throttle and brake ramp in over ≈0.15 s, as a foot does.
    driver.throttle = ramp(driver.throttle, s.reverse ? brake * 0.35 : gas, 7);
    driver.brake = ramp(driver.brake, s.reverse ? gas : brake, 8);
    // Reverse: S held at a standstill.
    sim.input.reverse = brake && !gas && Math.abs(s.u) < 0.5 ? true : (s.reverse && !gas);
    driver.handbrake = k('Space');
    // Steering: as much lock as the grip can use at this speed, more when the tail is out (the
    // counter-steer needs it); it turns in at a hand's pace and centres itself.
    const want = (left - right) * steerReach(s, left - right);
    driver.steer = ramp(driver.steer, want, steerRate(s, want !== 0));
    // A game controller (gt3Pad.js): when in use it drives; its buttons act on the press.
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) {
      if (!g || !g.connected) continue;
      const { actions } = readPad(g, s, driver, dt, padPrev);
      for (const a of actions) {
        if (a === 'up') paddle(1); else if (a === 'down') paddle(-1);
        else if (a === 'psm') cyclePsm(); else if (a === 'camera') cycleCamera();
        else if (a === 'pause') setPaused(!state.paused);
      }
      // Rumble every ≈50 ms, where the pad has the motors.
      if ((padRumbleT += dt) > 0.05 && g.vibrationActuator?.playEffect) {
        padRumbleT = 0;
        const r = rumbleFor(s);
        if (r.strong > 0.02 || r.weak > 0.02) g.vibrationActuator.playEffect('dual-rumble', { duration: 60, strongMagnitude: r.strong, weakMagnitude: r.weak }).catch?.(() => {});
      }
      break;
    }
    toSim();
  }
  function toSim() {
    Object.assign(sim.input, { throttle: driver.throttle, brake: driver.brake, steer: driver.steer, handbrake: driver.handbrake });
    // One queued pull a shift.
    if (pulls && s.shift <= 0 && !sim.input.shiftUp && !sim.input.shiftDown) {
      if (pulls > 0) { sim.input.shiftUp = true; pulls--; } else { sim.input.shiftDown = true; pulls++; }
    }
  }

  // ---- Cameras ----------------------------------------------------------------------------------
  let chase = null, ridePrev = null, trackside = null;
  const cams = createGt3Cameras();
  const _cam = new THREE.Vector3(), _look = new THREE.Vector3(), _f = new THREE.Vector3(), _off = new THREE.Vector3();
  const _up = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _qUp = new THREE.Quaternion();
  function cycleCamera() { setCamera(CAMERAS[(CAMERAS.indexOf(state.camera) + 1) % CAMERAS.length]); }
  function setCamera(name) {
    state.camera = name; chase = null; trackside = null; cams.reset();
    if (name === 'orbit') {
      rig.releaseExternal?.(); rig.external = false;
      rig.target.copy(holder.position); ridePrev = holder.position.clone();
      camera.up.set(0, 1, 0); camera.fov = saved.fov; camera.updateProjectionMatrix();
    } else { rig.external = true; ridePrev = null; }
    note(`Camera · ${name}`);
  }
  function placeCamera(dt) {
    if (!rig.external) {
      if (!ridePrev) ridePrev = holder.position.clone();
      _off.subVectors(holder.position, ridePrev);
      camera.position.add(_off); rig.target.add(_off); ridePrev.copy(holder.position);
      state.camera = 'orbit';
      return;
    }
    _f.set(Math.cos(s.psi), 0, -Math.sin(s.psi));
    if (state.camera === 'driver' || state.camera === 'bonnet') {
      // The driver's eye in the left-hand seat (≈, gt3Cabin.js), or low on the bonnet.
      const inside = state.camera === 'driver';
      const eye = inside ? EYE : [1.05, 0.98, 0];
      // The head on the neck, the eyes into the turn, and the road's texture under the tyres
      // (gt3Camera.js: deterministic, the same at any frame rate). On the bonnet, the road only.
      const head = cams.headStep(s, dt), shake = roadShake(s);
      _cam.set(eye[0] + (inside ? head.x : 0) + shake.x, eye[1] + shake.y, eye[2] + (inside ? head.z : 0));
      sprung.localToWorld(_cam);
      _look.set(eye[0] + 30, eye[1] - 0.8, eye[2] + (inside ? head.look : 0));
      sprung.localToWorld(_look);
      // Up is the body's up: a camera on the bonnet rolls and pitches with the car; the driver
      // holds the horizon better than the body does and keeps about half of its tilt (≈).
      sprung.getWorldQuaternion(_qUp);
      _up.set(0, 1, 0).applyQuaternion(_qUp);
      if (inside) _up.lerp(_Y, 0.5).normalize();
      camera.position.copy(_cam); camera.up.copy(_up); camera.lookAt(_look);
      camera.fov = 68; camera.near = 0.03; camera.updateProjectionMatrix();
      return;
    }
    if (state.camera === 'trackside') {
      // A fixed camera by the road, moved on when the car is 70 m past it.
      if (!trackside || trackside.distanceTo(holder.position) > 90) {
        const side = new THREE.Vector3(Math.sin(s.psi), 0, Math.cos(s.psi));
        trackside = holder.position.clone().addScaledVector(_f, 45 + s.u * 1.2).addScaledVector(side, 14);
        trackside.y = ground(trackside.x, trackside.z).h + 1.6;
      }
      camera.position.copy(trackside); camera.up.set(0, 1, 0);
      camera.lookAt(holder.position.x, holder.position.y + 0.6, holder.position.z);
      const dist = camera.position.distanceTo(holder.position);
      camera.fov = THREE.MathUtils.clamp(2 * Math.atan(4 / dist) * R2D, 5, 55); camera.updateProjectionMatrix();
      return;
    }
    // Chase: behind along the direction of travel (the nose's when slow), trailing the slides.
    const V = Math.hypot(s.u, s.v);
    _f.copy(cams.chaseDir(s, dt));
    // A little further back and lower with the speed, and a wider view: the sense of speed a
    // chase camera on a real car gives (≈).
    _cam.copy(holder.position).addScaledVector(_f, -(6.4 + Math.min(1.6, V * 0.02)));
    _cam.y += 2.1 - Math.min(0.35, V * 0.004);
    if (!chase || chase.distanceTo(_cam) > 40) chase = _cam.clone();
    chase.lerp(_cam, 1 - Math.exp(-dt * 5));
    // Over the ground, and over the water: the chase camera stays above the surface.
    { const gc = ground(chase.x, chase.z); chase.y = Math.max(chase.y, gc.h + 0.6, (gc.water ?? -Infinity) + 0.4); }
    camera.position.copy(chase); camera.up.set(0, 1, 0);
    camera.lookAt(holder.position.x, holder.position.y + 0.75, holder.position.z);
    camera.fov = saved.fov + Math.min(9, V * 0.11); camera.updateProjectionMatrix();
  }

  // ---- Pose, wheels, marks ------------------------------------------------------------------
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const spinAngle = [0, 0, 0, 0];
  function pose(dt) {
    holder.position.set(s.x, s.y, s.z);
    // The heading, then the body's attitude on its springs over the ground (nose up, left side up).
    holder.rotation.set(s.br, s.psi, s.bp, 'YZX');
    // The body on its springs: the nose up under power and down under braking (about Z, the car's
    // lateral axis), leaning out of a turn (about X): s.ay > 0 is a left turn, the right side sinks.
    if (sprung) sprung.rotation.set(s.roll, 0, s.pitch, 'XYZ');
    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      if (!w) continue;
      spinAngle[i] = (spinAngle[i] + s.w[i] * dt) % (Math.PI * 2);
      const spin = w.userData.spin;
      // Rolling forward turns the top of the wheel forward: a negative turn about the axle, on both
      // sides (the left wheel's mirroring in Z does not change a turn about Z).
      if (spin) spin.rotation.z = -spinAngle[i];
      w.rotation.y = s.steerW[i];
      w.position.y = wheelY[i] + s.travel[i];
    }
    // The flap: flat for the DRS, steepest as an airbrake.
    if (flap && flapBase) flap.quaternion.copy(flapBase).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (13 * (s.drsT ?? (s.aero === 'drs' ? 1 : 0)) + (s.aero === 'airbrake' ? -8 : 0)) / R2D));
    instruments?.update({ rpm: s.rpm, gear: s.reverse ? 'R' : s.gear, kmh: Math.hypot(s.u, s.v) * 3.6, steer: s.steer });
    if (brakeMat) brakeMat.emissiveIntensity = sim.input.brake > 0.05 ? 3.2 : brakeOff;
    void _e;
  }
  const _c = new THREE.Vector3(), _side = new THREE.Vector3();
  function layMarks(dt) {
    for (let i = 0; i < 4; i++) {
      const [px, py] = sim.WP[i];
      const [x, z] = sim.worldOf(px, py);
      const hard = HARD.has(s.surface[i]);
      // (The slip weighted by the tyre's load: an unloaded wheel lays no rubber.)
      const slide = s.slipShown?.[i] ?? s.slip[i];
      if (!hard || slide < 1.15 || s.load[i] < 400 || Math.hypot(s.u, s.v) < 1.5) { marks.lift(i); continue; }
      const a = THREE.MathUtils.clamp(0.3 + (slide - 1.15) / 1.4, 0.3, 0.95);
      _c.set(x, ground(x, z).h + 0.004, z);
      _side.set(Math.sin(s.psi), 0, Math.cos(s.psi));
      marks.lay(i, _c, _side, (i < 2 ? WHEELS.front.width : WHEELS.rear.width) * 0.45, a);
      // Smoke where it slides hardest: a puff or two a frame from a spinning or sideways tyre.
      // (A rate per second, not per frame: the same slide smokes the same at any frame rate.)
      if (slide > 1.8 && Math.random() < 1 - Math.pow(1 - Math.min(0.9, (slide - 1.8) * 0.5), dt * 60)) {
        const c = Math.cos(s.psi), sn = Math.sin(s.psi);
        smoke.emit(x, _c.y, z, s.u * c - s.v * sn, -s.u * sn - s.v * c, Math.min(1, (slide - 1.8) / 3));
      }
    }
  }

  // The water: each tyre running through it throws spray up and out behind, more the deeper and
  // faster; the body, deeper than its floor, pushes a bow wave ahead and out to the sides.
  function throwSpray(dt) {
    const c = Math.cos(s.psi), sn = Math.sin(s.psi), V = Math.hypot(s.u, s.v);
    const fx = c, fz = -sn, lx = -sn, lz = -c;          // forward and left in the world
    for (let i = 0; i < 4; i++) {
      const d = s.water[i];
      if (d < 0.005 || V < 1) continue;
      const [px, py] = sim.WP[i];
      const [x, z] = sim.worldOf(px, py);
      const g = ground(x, z), wsf = g.water ?? g.h;
      const n = Math.min(40, V * Math.min(1, d / 0.05) * 3 * dt * 60);
      const side = py > 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const out = (0.15 + 0.35 * Math.random()) * V * 0.35, up = (0.3 + 0.5 * Math.random()) * Math.min(9, V * 0.4), back = -(0.2 + 0.4 * Math.random()) * V * 0.3;
        const vx = s.u * c - s.v * sn, vz = -s.u * sn - s.v * c;
        spray.emit(x + (Math.random() - 0.5) * 0.3, wsf + 0.02, z + (Math.random() - 0.5) * 0.3,
          vx * 0.5 + fx * back + lx * side * out, up, vz * 0.5 + fz * back + lz * side * out, wsf);
      }
    }
    if (s.immersion > 0.02 && V > 0.8) {
      const [x, z] = sim.worldOf(OUTLINE.front, 0);
      const wsf = ground(x, z).water ?? 0;
      const n = Math.min(60, V * s.immersion * 40 * dt * 60);
      for (let k = 0; k < n; k++) {
        const across = (Math.random() - 0.5) * 1.9, side = Math.sign(across) || 1;
        spray.emit(x + lx * across, wsf + 0.02, z + lz * across,
          s.u * c * 0.9 + lx * side * V * (0.2 + 0.3 * Math.random()), Math.min(6, V * (0.2 + 0.3 * Math.random())) * Math.min(1, s.immersion * 3), -s.u * sn * 0.9 + lz * side * V * (0.2 + 0.3 * Math.random()), wsf, 1);
      }
    }
  }

  // ---- Laps -----------------------------------------------------------------------------------------
  let lastS = null;
  function timeLaps() {
    const [u, v] = toLocal(s.x, s.z);
    const tc = trackCoords(u, v);
    if (!tc || tc.dist > 12) { lastS = null; return; }
    const sLine = START.u;     // the start line's station (the main straight starts at s = 0)
    const rel = ((tc.s - sLine) % LAP + LAP) % LAP;
    if (lastS !== null && lastS > LAP - 60 && rel < 60) {
      // Crossed the line in the racing direction.
      if (state.lap !== null) {
        const t = s.t - state.lap;
        state.laps++;
        if (state.best === null || t < state.best) state.best = t;
        note(`Lap ${state.laps} · ${fmtTime(t)}${state.best === t ? ' · best' : ''}`);
      }
      state.lap = s.t;
    }
    lastS = rel;
  }
  const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;

  // ---- Lifecycle ---------------------------------------------------------------------------------
  function placeHome() {
    spray.clear(); fx.clear(); damage.reset();
    sim.reset(home());
    Object.assign(driver, { throttle: 0, brake: 0, steer: 0, handbrake: 0 });
    Object.assign(state, { paused: false, lap: null });
    lastS = null;
  }
  function start() {
    if (state.running) return;
    onStart();
    saved.parent = car.parent;
    saved.position.copy(car.position);
    saved.quaternion.copy(car.quaternion);
    saved.near = camera.near; saved.far = camera.far; saved.fov = camera.fov;
    holder.add(car);
    // The model's origin is midway between its axles; the vehicle model's is the centre of mass,
    // ahead of it by the published weight split (gt3Car.js CAR.a): the model sits back by the
    // difference, so its wheels stand where the model's tyres touch the ground.
    car.position.set(CAR.a - AXLE_F.x, 0, 0); car.quaternion.identity();
    holder.visible = true;
    placeHome();
    state.running = true; state.messages = [];
    if (rig.mode !== 'orbit') rig.setMode('orbit');
    setCamera('chase');
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    visibilityHook?.(true);
    hud?.show(true);
    note('W go · S brake · A D steer · Space into a corner to drift · W+S standing: Launch Control · the circuit is through the lane');
    apply(0);
  }
  function restart() { if (state.running) { placeHome(); note('Back on the skid pad'); } }
  function reset(returnCamera = true) {
    if (!state.running) return;
    state.running = false;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    keys.clear();
    if (sprung) sprung.rotation.set(0, 0, 0);
    wheels.forEach((w, i) => { if (w) { w.rotation.y = 0; w.position.y = wheelY[i]; if (w.userData.spin) w.userData.spin.rotation.z = 0; } });
    if (flap && flapBase) flap.quaternion.copy(flapBase);
    if (brakeMat) brakeMat.emissiveIntensity = brakeOff;
    instruments?.update({ rpm: 0, gear: 'N', kmh: 0, steer: 0 });
    // Back on its plinth whole: dents out, parts back on.
    damage.reset(); fx.clear(); spray.clear();
    saved.parent.add(car);
    car.position.copy(saved.position); car.quaternion.copy(saved.quaternion);
    holder.visible = false;
    camera.near = saved.near; camera.far = saved.far; camera.fov = saved.fov; camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    rig.releaseExternal?.();
    sound.stop();
    visibilityHook?.(false);
    hud?.show(false);
    if (returnCamera) onFinish();
  }
  function setPaused(on) { if (state.running) state.paused = !!on; }

  function apply(dt) {
    readControls(dt);
    if (!state.paused && dt > 0) {
      sim.advance(Math.min(dt, 0.25));
      events();
      layMarks(Math.min(dt, 0.25));
      smoke.update(Math.min(dt, 0.25));
      throwSpray(Math.min(dt, 0.25));
      // The contacts since the last frame, answered on the model (its frame sits back from the
      // centre of mass by CAR.a − AXLE_F.x; the height struck ≈ the bumpers').
      for (const h of s.hits) damage.hit(h.fx - (CAR.a - AXLE_F.x), h.fy, h.nx, h.ny, h.vn);
      s.hits.length = 0;
      damage.update(Math.min(dt, 0.25));
      fx.update(Math.min(dt, 0.25));
      spray.update(Math.min(dt, 0.25));
      timeLaps();
    }
    pose(Math.min(dt, 0.25));
    placeCamera(state.paused ? 0 : Math.min(dt, 0.25));
    if (rig.external) rig.target.copy(holder.position);
    camera.updateMatrixWorld();
    if (state.paused) sound.stop(); else sound.update(s, sim.input, s.surface[2], state.camera === 'driver', { pos: holder.position, camera }, Math.max(dt, 1 / 240));
    publish();
  }

  // What the driver is told: a contact, the water, Launch Control armed, a jump.
  let lastHit = -10, drowned = false, armed = false, floated = false, sank = false, splashed = false, wrecked = false;
  function events() {
    if (s.impact > 2.5 && s.t - lastHit > 1) { lastHit = s.t; note(`Contact at ${Math.round(s.impact * 3.6)} km/h`); }
    const inWater = s.water.some(d => d > 0.05);
    if (inWater && !splashed) { splashed = true; note('Into the water'); }
    if (!inWater) splashed = false;
    if (s.drowned && !drowned) { drowned = true; note('The water has reached the intake: the engine has drowned · Enter: back to the pad'); }
    if (!s.drowned) drowned = false;
    if (s.afloat && !floated) { floated = true; note('Afloat: the tyres have lost the ground'); }
    if (s.sunk && !sank) { sank = true; note('The car has flooded and sunk · Enter: back to the pad'); }
    if (!s.sunk) sank = false;
    if (s.dead && !wrecked) { wrecked = true; note('The car is too badly damaged to go on: the engine has stopped · Enter: back to the pad'); }
    if (!s.dead) wrecked = false;
    if (!inWater) floated = false;
    if (s.launch && sim.input.brake > 0.1 && !armed) { armed = true; note('Launch Control: let go of S to launch'); }
    if (!s.launch) armed = false;
    if (s.air > 0.35 && s.air < 0.37) note('Airborne');
  }
  function publish() {
    state.readout = {
      // Speed over the ground, sideways included (a drift is not slower than it moves).
      kmh: Math.hypot(s.u, s.v) * 3.6, rpm: Math.min(s.rpm, 9100), gear: s.reverse ? 'R' : s.gear, drs: s.drs, abs: s.abs, tc: s.tc, psm: s.psm,
      esc: s.psm === 'on' && Math.abs(s.esc) > 800, drift: s.drift > 0, tcWorking: s.psm !== 'off' && s.tcCut < 0.9,
      // The differential: its lock's torque (N·m between the rears) and the inner rear's brake.
      diffLock: Math.abs(s.diffLock ?? 0), ptv: (s.ptv ?? 0) > 20,
      slide: Math.atan2(s.v, Math.max(1, Math.abs(s.u))) * R2D, g: Math.hypot(s.ax, s.ay) / 9.81,
      gLong: s.ax / 9.81, gLat: s.ay / 9.81, t: s.t,
      throttle: driver.throttle, brake: driver.brake, handbrake: driver.handbrake > 0, surface: s.surface[2],
      lap: state.lap !== null ? s.t - state.lap : null, best: state.best, laps: state.laps,
      camera: state.camera, paused: state.paused, marks: marks.count, sound: sound.enabled, paddles: s.paddles, refused: s.refused > 0,
      messages: state.messages.filter(m => performance.now() - m.t < 5000).map(m => m.text),
    };
    hud?.update(state.readout);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    get position() { return holder.position; },
    sim, marks, smoke, sound, driver, damage, fx, start, reset, restart, setPaused, setCamera, cycleCamera, setTraction, setPsm, cyclePsm, setSound, setPaddles, paddle, fmtTime,
    update(dt) { if (state.running) apply(dt); },
    AXLE_F, AXLE_R, CAR,
  };
}
