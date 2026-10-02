/**
 * Driving the Porsche 911 GT3 RS: the exhibit's own car, on its vehicle model (gt3Car.js),
 * from where it waits on the skid pad, onto its circuit or anywhere over the plain. No change
 * of scene: the car, the circuit, the site and the runway are the ones the visitor walks round.
 *
 * Controls: W throttle, S brake (held at a standstill, reverse), A/D steer, Space the parking
 * brake (pulled while moving it locks the rears, as a drifter uses it), T the traction control
 * (off by default), C the camera, Enter back to the pad, Esc to end. The keyboard's steering
 * ramps in and centres itself, and gives less lock the faster the car goes, except when the
 * tail is out, where it gives full lock for the counter-steer (≈ this simulation's).
 *
 * Tyre marks: where a tyre slides (combined slip past its peak) on a hard surface it lays a
 * dark strip of its own width, darker the harder it slides; the strips stay until the pool of
 * 12,000 segments wraps.
 */
import * as THREE from 'three';
import { createGt3Car, CAR } from './gt3Car.js';
import { AXLE_F, AXLE_R } from '../vehicles/gt3rs.js';
import { WHEELS } from '../data/gt3rs.js';
import { trackCoords, toLocal, LAP, START } from '../core/circuitPlan.js';

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
    name: 'gt3-tyre-marks', color: 0x0a0a0a, roughness: 0.75, metalness: 0, vertexColors: true, transparent: true,
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

export function createGt3Drive({ scene, exhibit, env, rig, camera, ground, hud, home, onStart = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const car = exhibit.model;            // the 'gt3rs' group
  const sprung = car.getObjectByName('gt3-sprung');
  const wheels = ['fl', 'fr', 'rl', 'rr'].map(t => car.getObjectByName(`gt3-wheel-${t[0]}${t[1]}`));
  const flap = car.getObjectByName('gt3-wing-flap');
  const flapBase = flap?.quaternion.clone();
  const holder = new THREE.Group();
  holder.name = 'gt3-drive';
  holder.visible = false;
  scene.add(holder);
  const marks = createSkidMarks(scene);

  const sim = createGt3Car({ ground });
  const s = sim.state;
  const state = { running: false, paused: false, camera: 'chase', readout: null, messages: [], manual: false, lap: null, best: null, laps: 0 };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, far: 0, fov: 0 };

  // ---- Controls ---------------------------------------------------------------------------------
  const keys = new Set();
  const driver = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyT', 'KeyK', 'Escape', 'Enter']);
  function onKeyDown(e) {
    if (!state.running || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
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
      case 'Enter': restart(); break;
      case 'Escape': reset(); break;
      default: break;
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); }
  function note(text) { state.messages.push({ text, t: performance.now() }); if (state.messages.length > 4) state.messages.shift(); }
  function setTraction(on) { s.tc = !!on; note(s.tc ? 'Traction control on' : 'Traction control off: the tail is yours'); }

  function readControls(dt) {
    if (state.manual) { toSim(); return; }
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
    // Steering: less lock at speed, unless the tail is out (the counter-steer needs it all).
    const v = Math.max(0, s.u);
    const slideDeg = Math.abs(Math.atan2(s.v, Math.max(1, Math.abs(s.u))) * R2D);
    const reach = THREE.MathUtils.clamp(1 / (1 + (v / 22) ** 1.6) + slideDeg / 25, 0.12, 1);
    const want = (left - right) * reach;
    driver.steer = ramp(driver.steer, want, want ? 2.4 : 3.5);
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
      // The driver's eye in the left-hand seat (≈), or low on the bonnet.
      const eye = state.camera === 'driver' ? [-0.12, 1.06, -0.37] : [1.05, 0.98, 0];
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
    holder.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.psi);
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
      w.rotation.y = i < 2 ? s.steer : 0;
    }
    if (flap && flapBase) flap.quaternion.copy(flapBase).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (s.drs ? 13 : 0) / R2D));
    void _e;
  }
  const _c = new THREE.Vector3(), _side = new THREE.Vector3();
  function layMarks() {
    for (let i = 0; i < 4; i++) {
      const [px, py] = sim.WP[i];
      const [x, z] = sim.worldOf(px, py);
      const hard = HARD.has(s.surface[i]);
      const slide = s.slip[i];
      if (!hard || slide < 1.15 || Math.hypot(s.u, s.v) < 1.5) { marks.lift(i); continue; }
      const a = THREE.MathUtils.clamp((slide - 1.15) / 1.6, 0.08, 0.85);
      _c.set(x, ground(x, z).h + 0.004, z);
      _side.set(Math.sin(s.psi), 0, Math.cos(s.psi));
      marks.lay(i, _c, _side, (i < 2 ? WHEELS.front.width : WHEELS.rear.width) * 0.45, a);
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
    note('W go · S brake · A D steer · Space parking brake · the circuit is through the lane');
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
    for (const w of wheels) if (w) { w.rotation.y = 0; if (w.userData.spin) w.userData.spin.rotation.z = 0; }
    if (flap && flapBase) flap.quaternion.copy(flapBase);
    saved.parent.add(car);
    car.position.copy(saved.position); car.quaternion.copy(saved.quaternion);
    holder.visible = false;
    camera.near = saved.near; camera.far = saved.far; camera.fov = saved.fov;
    camera.updateProjectionMatrix();
    rig.releaseExternal?.();
    visibilityHook?.(false);
    hud?.show(false);
    if (returnCamera) onFinish();
  }
  function setPaused(on) { if (state.running) state.paused = !!on; }

  function apply(dt) {
    readControls(dt);
    if (!state.paused && dt > 0) {
      sim.advance(Math.min(dt, 0.25));
      layMarks();
      timeLaps();
    }
    pose(Math.min(dt, 0.25));
    placeCamera(Math.max(dt, 1 / 120));
    if (rig.external) rig.target.copy(holder.position);
    publish();
  }

  function publish() {
    state.readout = {
      kmh: s.u * 3.6, rpm: Math.min(s.rpm, 9100), gear: s.reverse ? 'R' : s.gear, drs: s.drs, abs: s.abs, tc: s.tc,
      slide: Math.atan2(s.v, Math.max(1, Math.abs(s.u))) * R2D, g: Math.hypot(s.ax, s.ay) / 9.81,
      throttle: driver.throttle, brake: driver.brake, handbrake: driver.handbrake > 0, surface: s.surface[2],
      lap: state.lap !== null ? s.t - state.lap : null, best: state.best, laps: state.laps,
      camera: state.camera, paused: state.paused, marks: marks.count,
      messages: state.messages.filter(m => performance.now() - m.t < 5000).map(m => m.text),
    };
    hud?.update(state.readout);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    get position() { return holder.position; },
    sim, marks, driver, start, reset, restart, setPaused, setCamera, cycleCamera, setTraction, fmtTime,
    update(dt) { if (state.running) apply(dt); },
    AXLE_F, AXLE_R, CAR,
  };
}
