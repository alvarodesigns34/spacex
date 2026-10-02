/**
 * Driving the Porsche 911 GT3 RS: the exhibit's own car, on its vehicle model (gt3Car.js),
 * from where it waits on the skid pad, onto its circuit or anywhere over the plain. No change
 * of scene: the car, the circuit, the site and the runway are the ones the visitor walks round.
 *
 * Controls: W throttle, S brake (held at a standstill, reverse; with W, Launch Control: let go of S to launch), A/D steer, Space the parking
 * brake (tapped into a corner it locks the rears and starts a drift, which the throttle and the
 * counter-steer then hold), T the PSM (traction and stability control, on by default), C the
 * camera, M the engine's sound (off until turned on), Enter back to the pad, Esc to end. The
 * keyboard's steering ramps in and centres itself, and asks for as much lock as the grip can
 * use at the speed and under the braking of the moment (steerReach), more the way a slide is
 * caught, for the counter-steer (≈ this simulation's aid).
 *
 * Tyre marks: where a tyre slides (combined slip past its peak) on a hard surface it lays a
 * dark strip of its own width, darker the harder it slides; the strips stay until the pool of
 * 12,000 segments wraps.
 */
import * as THREE from 'three';
import { createGt3Car, CAR, steerReach } from './gt3Car.js';
import { AXLE_F, AXLE_R } from '../vehicles/gt3rs.js';
import { EYE } from '../vehicles/gt3Cabin.js';
import { WHEELS } from '../data/gt3rs.js';
import { trackCoords, toLocal, LAP, START } from '../core/circuitPlan.js';
import { createGt3Sound } from './gt3Sound.js';

const R2D = 180 / Math.PI;
const CAMERAS = ['chase', 'driver', 'bonnet', 'trackside', 'orbit'];
const HARD = new Set(['track', 'verge', 'kerb', 'pad', 'runway', 'road']);

/** The marks: one geometry of quads in a ring buffer, drawn just above the surface. */
function createSkidMarks(scene, max = 12000) {
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
function createTyreSmoke(scene, max = 900) {
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
      void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
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

export function createGt3Drive({ scene, exhibit, env, rig, camera, ground, obstacles, hud, home, onStart = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const car = exhibit.model;            // the 'gt3rs' group
  const sprung = car.getObjectByName('gt3-sprung');
  const wheels = ['fl', 'fr', 'rl', 'rr'].map(t => car.getObjectByName(`gt3-wheel-${t[0]}${t[1]}`));
  const flap = car.getObjectByName('gt3-wing-flap');
  const flapBase = flap?.quaternion.clone();
  // The cabin's live instruments: the tachometer's needle, the gear and the speed, the steering wheel.
  const instruments = car.getObjectByName('gt3-cabin')?.userData.instruments;
  const holder = new THREE.Group();
  holder.name = 'gt3-drive';
  holder.visible = false;
  scene.add(holder);
  const marks = createSkidMarks(scene);
  const smoke = createTyreSmoke(scene);
  const sound = createGt3Sound();

  const sim = createGt3Car({ ground, obstacles });
  // Each wheel's place on the car, for its travel on the springs.
  const wheelY = wheels.map(w => w?.position.y ?? 0);
  const s = sim.state;
  const state = { running: false, paused: false, camera: 'chase', readout: null, messages: [], manual: false, lap: null, best: null, laps: 0 };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, far: 0, fov: 0 };

  // ---- Controls ---------------------------------------------------------------------------------
  const keys = new Set();
  const driver = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyT', 'KeyK', 'KeyM', 'Escape', 'Enter']);
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
      case 'KeyT': setTraction(!s.tc); break;
      case 'KeyK': setPaused(!state.paused); break;
      case 'KeyM': setSound(!sound.enabled); break;
      case 'Enter': restart(); break;
      case 'Escape': reset(); break;
      default: break;
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); }
  function note(text) { state.messages.push({ text, t: performance.now() }); if (state.messages.length > 4) state.messages.shift(); }
  function setTraction(on) { s.tc = !!on; note(s.tc ? 'PSM on: traction and stability control' : 'PSM off: the tail is yours'); }
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
    driver.steer = ramp(driver.steer, want, want ? 1.8 : 3.0);
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) {
      if (!g || !g.connected) continue;
      const dz = (x) => (Math.abs(x) < 0.08 ? 0 : x);
      if (g.axes.length && dz(g.axes[0])) driver.steer = -dz(g.axes[0]);
      const b = (i) => g.buttons[i]?.value ?? 0;
      if (b(7) > 0.02) driver.throttle = b(7);
      if (b(6) > 0.02) driver.brake = b(6);
      if (b(0) > 0.5) driver.handbrake = 1;
      break;
    }
    toSim();
  }
  function toSim() { Object.assign(sim.input, { throttle: driver.throttle, brake: driver.brake, steer: driver.steer, handbrake: driver.handbrake }); }

  // ---- Cameras ----------------------------------------------------------------------------------
  let chase = null, ridePrev = null, trackside = null;
  const _cam = new THREE.Vector3(), _look = new THREE.Vector3(), _f = new THREE.Vector3(), _off = new THREE.Vector3();
  function cycleCamera() { setCamera(CAMERAS[(CAMERAS.indexOf(state.camera) + 1) % CAMERAS.length]); }
  function setCamera(name) {
    state.camera = name; chase = null; trackside = null;
    if (name === 'orbit') {
      rig.releaseExternal?.(); rig.external = false;
      rig.target.copy(holder.position); ridePrev = holder.position.clone();
      camera.fov = saved.fov; camera.updateProjectionMatrix();
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
      const eye = state.camera === 'driver' ? EYE : [1.05, 0.98, 0];
      _cam.set(...eye);
      sprung.localToWorld(_cam);
      _look.set(eye[0] + 30, eye[1] - 0.8, eye[2]);
      sprung.localToWorld(_look);
      camera.position.copy(_cam); camera.lookAt(_look);
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
      camera.position.copy(trackside);
      camera.lookAt(holder.position.x, holder.position.y + 0.6, holder.position.z);
      const dist = camera.position.distanceTo(holder.position);
      camera.fov = THREE.MathUtils.clamp(2 * Math.atan(4 / dist) * R2D, 5, 55); camera.updateProjectionMatrix();
      return;
    }
    // Chase: behind along the direction of travel (the nose's when slow), trailing the slides.
    const V = Math.hypot(s.u, s.v);
    if (V > 4) {
      const c = Math.cos(s.psi), sn = Math.sin(s.psi);
      _look.set(s.u * c - s.v * sn, 0, -s.u * sn - s.v * c).normalize();
      _f.lerp(_look, 0.55).normalize();
    }
    _cam.copy(holder.position).addScaledVector(_f, -6.4);
    _cam.y += 2.1;
    if (!chase || chase.distanceTo(_cam) > 40) chase = _cam.clone();
    chase.lerp(_cam, 1 - Math.exp(-dt * 5));
    chase.y = Math.max(chase.y, ground(chase.x, chase.z).h + 0.6);
    camera.position.copy(chase);
    camera.lookAt(holder.position.x, holder.position.y + 0.75, holder.position.z);
    camera.fov = saved.fov; camera.updateProjectionMatrix();
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
    if (flap && flapBase) flap.quaternion.copy(flapBase).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (s.aero === 'drs' ? 13 : s.aero === 'airbrake' ? -8 : 0) / R2D));
    instruments?.update({ rpm: s.rpm, gear: s.reverse ? 'R' : s.gear, kmh: Math.hypot(s.u, s.v) * 3.6, steer: s.steer });
    void _e;
  }
  const _c = new THREE.Vector3(), _side = new THREE.Vector3();
  function layMarks(dt) {
    for (let i = 0; i < 4; i++) {
      const [px, py] = sim.WP[i];
      const [x, z] = sim.worldOf(px, py);
      const hard = HARD.has(s.surface[i]);
      const slide = s.slip[i];
      if (!hard || slide < 1.15 || Math.hypot(s.u, s.v) < 1.5) { marks.lift(i); continue; }
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
    car.position.set(0, 0, 0); car.quaternion.identity();
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
    instruments?.update({ rpm: 0, gear: 'N', kmh: 0, steer: 0 });
    saved.parent.add(car);
    car.position.copy(saved.position); car.quaternion.copy(saved.quaternion);
    holder.visible = false;
    camera.near = saved.near; camera.far = saved.far; camera.fov = saved.fov;
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
      timeLaps();
    }
    pose(Math.min(dt, 0.25));
    placeCamera(Math.max(dt, 1 / 120));
    if (rig.external) rig.target.copy(holder.position);
    if (state.paused) sound.stop(); else sound.update(s, sim.input, s.surface[2]);
    publish();
  }

  // What the driver is told: a contact, the water, Launch Control armed, a jump.
  let lastHit = -10, drowned = false, armed = false;
  function events() {
    if (s.impact > 2.5 && s.t - lastHit > 1) { lastHit = s.t; note(`Contact at ${Math.round(s.impact * 3.6)} km/h`); }
    if (s.wet > 1.5 && !drowned) { drowned = true; note('In the water: the engine has drowned · Enter: back to the pad'); }
    if (s.wet === 0) drowned = false;
    if (s.launch && sim.input.brake > 0.1 && !armed) { armed = true; note('Launch Control: let go of S to launch'); }
    if (!s.launch) armed = false;
    if (s.air > 0.35 && s.air < 0.37) note('Airborne');
  }
  function publish() {
    state.readout = {
      // Speed over the ground, sideways included (a drift is not slower than it moves).
      kmh: Math.hypot(s.u, s.v) * 3.6, rpm: Math.min(s.rpm, 9100), gear: s.reverse ? 'R' : s.gear, drs: s.drs, abs: s.abs, tc: s.tc,
      esc: s.tc && Math.abs(s.esc) > 800, drift: s.drift > 0,
      slide: Math.atan2(s.v, Math.max(1, Math.abs(s.u))) * R2D, g: Math.hypot(s.ax, s.ay) / 9.81,
      throttle: driver.throttle, brake: driver.brake, handbrake: driver.handbrake > 0, surface: s.surface[2],
      lap: state.lap !== null ? s.t - state.lap : null, best: state.best, laps: state.laps,
      camera: state.camera, paused: state.paused, marks: marks.count, sound: sound.enabled,
      messages: state.messages.filter(m => performance.now() - m.t < 5000).map(m => m.text),
    };
    hud?.update(state.readout);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    get position() { return holder.position; },
    sim, marks, smoke, sound, driver, start, reset, restart, setPaused, setCamera, cycleCamera, setTraction, setSound, fmtTime,
    update(dt) { if (state.running) apply(dt); },
    AXLE_F, AXLE_R, CAR,
  };
}
