/**
 * Riding the Ninja H2R: the exhibit itself rides off its spot on the skid pad (as the Porsche
 * drives off its own), with a rider aboard, and comes back to it when the ride ends.
 *
 * Controls: W throttle, S brake (both ends, the front doing most of it), A/D lean — the bike
 * turns by leaning, so the keys ask for a lean and the bike rolls into it; Space the rear brake
 * alone; T the aids (wheelie, traction and rear-lift control, on by default); C the camera
 * (chase, the rider's helmet, trackside, your own orbit); K pause; M sound; Enter back to the
 * pad; Esc the end. The gearbox shifts by itself, with a quick-shifter's cut.
 *
 * The dynamics are h2rBike.js's; this poses the model on them — yaw, then the wheelie or stoppie
 * about the contact on the ground, then the lean about the tyres' crowns — turns the bars and
 * the wheels, hangs the rider off to the inside of the turns, lays the tyres' marks, throws the
 * water, and when the bike falls, separates the rider from it: each slides and tumbles to a stop
 * on its own, the bike on its side throwing sparks.
 */
import * as THREE from 'three';
import { createH2rBike, BIKE } from './h2rBike.js';
import { createH2rSound } from './h2rSound.js';
import { createSkidMarks, createTyreSmoke, createSpray } from './gt3Drive.js';
import { createEffects } from '../core/effects.js';
import { buildH2rRider } from '../vehicles/h2rRider.js';
import { STEER_AXIS, AXLE_F, AXLE_R } from '../vehicles/h2r.js';
import { WHEELS } from '../data/h2r.js';
import { trackCoords, toLocal, LAP, START } from '../core/circuitPlan.js';

const R2D = 180 / Math.PI;
const CAMERAS = ['chase', 'helmet', 'trackside', 'orbit'];
const HARD = new Set(['track', 'verge', 'kerb', 'pad', 'runway', 'road']);
/** The tyres' crowns, which the bike leans about (≈ the mean of the two sections' half-widths). */
const CROWN = 0.08;

export function createH2rRide({ scene, exhibit, rig, camera, ground, obstacles, hud, home, M, onStart = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const bike = exhibit.model;            // the 'h2r' group
  const steer = bike.getObjectByName('h2r-steer');
  const spinF = bike.getObjectByName('h2r-wheel-f-spin'), spinR = bike.getObjectByName('h2r-wheel-r-spin');
  const swing = bike.getObjectByName('h2r-swingarm');
  const steerBase = steer?.quaternion.clone() ?? new THREE.Quaternion();
  const holder = new THREE.Group(); holder.name = 'h2r-ride'; holder.visible = false; scene.add(holder);
  const pitchG = new THREE.Group(), pitchIn = new THREE.Group(), leanG = new THREE.Group(), leanIn = new THREE.Group();
  holder.add(pitchG); pitchG.add(pitchIn); pitchIn.add(leanG); leanG.add(leanIn);
  leanG.position.y = CROWN; leanIn.position.y = -CROWN;
  const rider = buildH2rRider(M);
  const marks = createSkidMarks(scene, 6000);
  const smoke = createTyreSmoke(scene, 500);
  const spray = createSpray(scene, 800);
  const fx = createEffects(scene);
  const sound = createH2rSound();
  const sim = createH2rBike({ ground, obstacles });
  const s = sim.state;
  const state = { running: false, paused: false, camera: 'chase', readout: null, messages: [], lap: null, best: null, laps: 0 };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, fov: 0 };
  // The rider off the bike after a fall: its own slide and tumble.
  const thrown = { on: false, vel: new THREE.Vector3(), spin: new THREE.Vector3(), rest: false };
  const tumbler = new THREE.Group(); tumbler.name = 'h2r-rider-fall';

  // ---- Controls -----------------------------------------------------------------------------
  const keys = new Set();
  const rider_ = { throttle: 0, brake: 0, rear: 0, lean: 0 };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyT', 'KeyK', 'KeyM', 'Escape', 'Enter']);
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
      case 'KeyT': setAids(!s.aids); break;
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
  function setAids(on) { s.aids = !!on; note(s.aids ? 'Aids on: wheelie, traction and rear-lift control' : 'Aids off: the wheelies and the grip are yours'); }
  function setSound(on) { sound.setEnabled(on); note(sound.enabled ? 'Sound on: the four, the supercharger, the wind (synthesised)' : 'Sound off'); }
  function readControls(dt) {
    if (keys.size && modalOpen()) keys.clear();
    const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
    const ramp = (cur, target, rate) => cur + THREE.MathUtils.clamp(target - cur, -rate * dt, rate * dt);
    rider_.throttle = ramp(rider_.throttle, k('KeyW', 'ArrowUp'), 6);
    rider_.brake = ramp(rider_.brake, k('KeyS', 'ArrowDown'), 7);
    rider_.rear = ramp(rider_.rear, k('Space'), 7);
    // The lean asked for: in at a rider's pace, back up a little quicker.
    const want = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    rider_.lean = ramp(rider_.lean, want, want ? 2.2 : 3);
    Object.assign(sim.input, { throttle: rider_.throttle, brake: rider_.brake, rearBrake: rider_.rear, lean: rider_.lean });
  }

  // ---- Cameras --------------------------------------------------------------------------------
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
    if (state.camera === 'helmet' && !s.crashed) {
      // From inside the helmet: low behind the screen, rolling with the bike and the rider.
      const e = rider.userData.eye;
      _cam.copy(e); rider.localToWorld(_cam);
      _look.set(e.x + 30, e.y - 1.2, e.z); rider.localToWorld(_look);
      camera.position.copy(_cam); camera.up.set(0, 1, 0);
      camera.lookAt(_look);
      // Roll the view with the head: most of the bike's lean (≈ riders hold their heads nearer level).
      camera.rotateZ(-s.phi * 0.55);
      camera.fov = 72; camera.near = 0.03; camera.updateProjectionMatrix();
      return;
    }
    if (state.camera === 'trackside') {
      if (!trackside || trackside.distanceTo(holder.position) > 90) {
        const side = new THREE.Vector3(Math.sin(s.psi), 0, Math.cos(s.psi));
        trackside = holder.position.clone().addScaledVector(_f, 45 + s.u * 1.2).addScaledVector(side, 14);
        trackside.y = ground(trackside.x, trackside.z).h + 1.6;
      }
      camera.position.copy(trackside);
      camera.lookAt(holder.position.x, holder.position.y + 0.6, holder.position.z);
      const dist = camera.position.distanceTo(holder.position);
      camera.fov = THREE.MathUtils.clamp(2 * Math.atan(3 / dist) * R2D, 4, 55); camera.updateProjectionMatrix();
      return;
    }
    // Chase: behind and above, level (a chase bike's camera does not roll with the bike).
    _cam.copy(holder.position).addScaledVector(_f, -4.6);
    _cam.y += 1.7;
    if (!chase || chase.distanceTo(_cam) > 40) chase = _cam.clone();
    chase.lerp(_cam, 1 - Math.exp(-dt * 12));
    { const gc = ground(chase.x, chase.z); chase.y = Math.max(chase.y, gc.h + 0.6, (gc.water ?? -Infinity) + 0.4); }
    camera.position.copy(chase); camera.up.set(0, 1, 0);
    camera.lookAt(holder.position.x, holder.position.y + 0.8, holder.position.z);
    camera.fov = saved.fov; camera.near = saved.near; camera.updateProjectionMatrix();
  }

  // ---- Pose -----------------------------------------------------------------------------------
  const _p = new THREE.Vector3();
  function pose(dt) {
    // Down, the bike lies on its fairing and bars, ≈12 cm off the ground at its middle.
    holder.position.set(s.x, s.y + (s.crashed ? 0.12 * Math.sin(Math.abs(s.phi)) : 0), s.z);
    holder.rotation.set(0, s.psi, 0);
    // Pitch: the grade, and the wheelie about the rear contact or the stoppie about the front.
    const pivot = s.theta >= 0 ? AXLE_R.x : AXLE_F.x;
    pitchG.position.set(pivot, 0, 0); pitchIn.position.set(-pivot, 0, 0);
    pitchG.rotation.set(0, 0, s.theta + s.gradePitch);
    // The suspension's dive and squat, as a small pitch of the whole (≈).
    leanG.rotation.set(s.phi, 0, (s.susR - s.susF) * 0.3);
    // The bars: at speed the steering is a degree or two; slow, up to the lock.
    if (steer) steer.quaternion.copy(steerBase).multiply(new THREE.Quaternion().setFromAxisAngle(STEER_AXIS, -s.steer));
    if (spinF) spinF.rotation.z = -(s.wheelAngleF % (Math.PI * 2));
    if (spinR) spinR.rotation.z = -(s.wheelAngleR % (Math.PI * 2));
    if (swing) swing.rotation.z = -s.susR * 1.2;
    if (!thrown.on) rider.userData.hangOff(THREE.MathUtils.clamp(s.phi / 0.9, -1, 1) * Math.min(1, s.u / 15));
    void dt; void _p;
  }

  // ---- Marks, water, the fall --------------------------------------------------------------------
  const _c = new THREE.Vector3(), _side = new THREE.Vector3();
  function layMarks(dt) {
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    _side.set(Math.sin(s.psi), 0, Math.cos(s.psi));
    if (s.crashed) {
      // The bike on its side: a scrape, and sparks from the pegs and bars on a hard surface.
      marks.lift(0); marks.lift(1);
      const g = ground(s.x, s.z);
      if (s.u > 1.5) {
        _c.set(s.x, g.h + 0.004, s.z);
        marks.lay(2, _c, _side, 0.08, 0.5);
        if (HARD.has(g.kind)) fx.burst('spark', _c.clone().setY(g.h + 0.1), Math.min(30, Math.round(s.u * 1.5 * dt * 60)), { vel: new THREE.Vector3(s.vx, 0, s.vz), spread: 2 + s.u * 0.15, up: 1.2, floor: g.h });
        else fx.burst('dust', _c.clone().setY(g.h + 0.1), 2, { spread: 1, up: 0.6, floor: g.h });
      } else marks.lift(2);
      return;
    }
    marks.lift(2);
    for (const [i, ax] of [[0, BIKE.L / 2], [1, -BIKE.L / 2]]) {
      const x = s.x + ax * c, z = s.z - ax * sn, g = ground(x, z);
      const sliding = (i === 1 && s.slide > 0.05) || (i === 1 && sim.input.throttle > 0.9 && s.gear === 0 && s.u < 12 && !s.aids) || (i === 0 && sim.input.brake > 0.95 && !s.aids);
      const lifted = (i === 0 && s.wheelie) || (i === 1 && s.stoppie);
      if (!HARD.has(g.kind) || !sliding || lifted || s.u < 1) { marks.lift(i); continue; }
      _c.set(x, g.h + 0.004, z);
      marks.lay(i, _c, _side, (i ? WHEELS.rear.width : WHEELS.front.width) * 0.4, 0.6);
      if (i === 1 && Math.random() < dt * 30) smoke.emit(x, _c.y, z, s.u * c * 0.6, -s.u * sn * 0.6, 0.7);
    }
  }
  function throwSpray(dt) {
    if (s.water < 0.005 || s.u < 1) return;
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    for (const ax of [BIKE.L / 2, -BIKE.L / 2]) {
      const x = s.x + ax * c, z = s.z - ax * sn, g = ground(x, z), w = g.water ?? g.h;
      const n = Math.min(30, s.u * Math.min(1, s.water / 0.05) * 2 * dt * 60);
      for (let k = 0; k < n; k++) {
        const side = Math.random() < 0.5 ? -1 : 1, out = (0.2 + 0.4 * Math.random()) * s.u * 0.3;
        spray.emit(x, w + 0.02, z, s.u * c * 0.4 + Math.sin(s.psi) * side * out, (0.3 + 0.5 * Math.random()) * Math.min(7, s.u * 0.4), -s.u * sn * 0.4 + Math.cos(s.psi) * side * out, w);
      }
    }
  }
  function throwRider() {
    // The rider leaves the bike with its speed, a little up and to the outside, and tumbles.
    // It turns about its own middle: a pivot there, carrying the figure.
    holder.updateMatrixWorld(true);
    tumbler.position.set(-0.08, 0.95, 0); rider.localToWorld(tumbler.position);
    tumbler.rotation.set(0, s.psi, 0);
    scene.add(tumbler); tumbler.updateMatrixWorld(true);
    tumbler.attach(rider);
    const c = Math.cos(s.psi), sn = Math.sin(s.psi);
    thrown.on = true; thrown.rest = false;
    thrown.vel.set(s.vx || s.u * c, 1.5 + Math.random(), s.vz || -s.u * sn);
    thrown.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6);
    rider.userData.hangOff(0);
  }
  function tumble(dt) {
    if (!thrown.on || thrown.rest) return;
    thrown.vel.y -= 9.81 * dt;
    tumbler.position.addScaledVector(thrown.vel, dt);
    tumbler.rotation.x += thrown.spin.x * dt; tumbler.rotation.z += thrown.spin.z * dt;
    const g = ground(tumbler.position.x, tumbler.position.z);
    // Lying in leathers, the body's middle ≈0.15 m off the ground.
    const floor = g.h + 0.15;
    if (tumbler.position.y < floor) {
      tumbler.position.y = floor;
      thrown.vel.y = Math.abs(thrown.vel.y) * 0.2;
      const v = Math.hypot(thrown.vel.x, thrown.vel.z), mu = 0.55, dv = Math.min(v, mu * 9.81 * dt * 4);
      if (v > 1e-6) { thrown.vel.x -= thrown.vel.x / v * dv; thrown.vel.z -= thrown.vel.z / v * dv; }
      thrown.spin.multiplyScalar(Math.exp(-dt * 2));
      // Coming to rest lying down.
      if (v < 3) {
        // Settling flat: on its back or front, whichever is nearer.
        tumbler.rotation.x += (Math.round(tumbler.rotation.x / Math.PI) * Math.PI - tumbler.rotation.x) * Math.min(1, dt * 2);
        tumbler.rotation.z += (Math.round((tumbler.rotation.z - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2 - tumbler.rotation.z) * Math.min(1, dt * 2);
      }
      if (v < 0.2) thrown.rest = true;
    }
  }

  // ---- Laps -------------------------------------------------------------------------------------
  let lastS = null;
  function timeLaps() {
    const [u, v] = toLocal(s.x, s.z);
    const tc = trackCoords(u, v);
    if (!tc || tc.dist > 12) { lastS = null; return; }
    const rel = ((tc.s - START.u) % LAP + LAP) % LAP;
    if (lastS !== null && lastS > LAP - 60 && rel < 60 && !s.crashed) {
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

  // ---- Lifecycle --------------------------------------------------------------------------------
  function seatRider() {
    thrown.on = false;
    tumbler.removeFromParent();
    leanIn.add(rider);
    rider.position.set(0, 0, 0); rider.rotation.set(0, 0, 0);
    rider.userData.hangOff(0);
  }
  function placeHome() {
    spray.clear(); fx.clear(); marks.clear(); smoke.clear?.();
    sim.reset(home());
    Object.assign(rider_, { throttle: 0, brake: 0, rear: 0, lean: 0 });
    Object.assign(state, { paused: false, lap: null });
    lastS = null; fell = false; wheelieNoted = false;
    seatRider();
  }
  function start() {
    if (state.running) return;
    onStart();
    saved.parent = bike.parent;
    saved.position.copy(bike.position);
    saved.quaternion.copy(bike.quaternion);
    saved.near = camera.near; saved.fov = camera.fov;
    leanIn.add(bike);
    bike.position.set(0, 0, 0); bike.quaternion.identity();
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
    note('W throttle · S brake · A D lean · Space rear brake · the circuit is through the lane');
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
    if (steer) steer.quaternion.copy(steerBase);
    if (spinF) spinF.rotation.z = 0;
    if (spinR) spinR.rotation.z = 0;
    if (swing) swing.rotation.z = 0;
    rider.removeFromParent(); tumbler.removeFromParent();
    fx.clear(); spray.clear(); marks.clear();
    saved.parent.add(bike);
    bike.position.copy(saved.position); bike.quaternion.copy(saved.quaternion);
    holder.visible = false;
    camera.near = saved.near; camera.fov = saved.fov; camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    rig.releaseExternal?.();
    sound.stop();
    visibilityHook?.(false);
    hud?.show(false);
    if (returnCamera) onFinish();
  }
  function setPaused(on) { if (state.running) state.paused = !!on; }

  let fell = false, wheelieNoted = false, lastHit = -10, splashed = false;
  function events() {
    if (s.crashed && !fell) {
      fell = true;
      note(`${s.crashed.why} · Enter: back on the pad`);
      throwRider();
    }
    if (s.theta > 10 / R2D && !wheelieNoted) { wheelieNoted = true; note(`Wheelie${s.aids ? ' · the control holds it' : ''}`); }
    if (s.theta < 2 / R2D) wheelieNoted = false;
    if (s.impact > 2 && s.t - lastHit > 1) { lastHit = s.t; note(`Contact at ${Math.round(s.impact * 3.6)} km/h`); }
    if (s.water > 0.02 && !splashed) { splashed = true; note('Into the water'); }
    if (s.water <= 0.02) splashed = false;
    s.hits.length = 0;
  }
  function apply(dt) {
    readControls(dt);
    if (!state.paused && dt > 0) {
      const h = Math.min(dt, 0.25);
      sim.advance(h);
      events();
      layMarks(h);
      smoke.update(h);
      throwSpray(h);
      tumble(h);
      fx.update(h);
      spray.update(h);
      timeLaps();
    }
    pose(Math.min(dt, 0.25));
    placeCamera(Math.max(dt, 1 / 120));
    if (rig.external) rig.target.copy(holder.position);
    if (state.paused) sound.stop(); else sound.update(s, sim.input, s.surface);
    publish();
  }
  function publish() {
    state.readout = {
      kmh: s.u * 3.6, rpm: Math.min(s.rpm, 14600), gear: s.gear + 1, lean: s.phi * R2D, pitch: s.theta * R2D,
      aids: s.aids, wheelie: s.wheelie, stoppie: s.stoppie, ram: s.ramShare, limiter: s.fuelCut, down: !!s.crashed,
      g: Math.hypot(s.ax, s.ay) / 9.81, gLong: s.ax / 9.81, gLat: s.ay / 9.81, t: s.t,
      throttle: rider_.throttle, brake: Math.max(rider_.brake, rider_.rear * 0.5), surface: s.surface,
      lap: state.lap !== null ? s.t - state.lap : null, best: state.best, laps: state.laps,
      camera: state.camera, paused: state.paused, sound: sound.enabled,
      messages: state.messages.filter(m => performance.now() - m.t < 5000).map(m => m.text),
    };
    hud?.update(state.readout);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    get position() { return holder.position; },
    sim, marks, sound, rider, fx, start, reset, restart, setPaused, setCamera, cycleCamera, setAids, setSound, fmtTime,
    update(dt) { if (state.running) apply(dt); },
  };
}
