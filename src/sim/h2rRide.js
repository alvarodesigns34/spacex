/**
 * Riding the Ninja H2R: the exhibit itself rides off its spot on the skid pad (as the Porsche
 * drives off its own), seen from the rider's own eyes, and comes back to it when the ride ends.
 *
 * Controls: W throttle, S brake (both ends, the front doing most of it), A/D lean — the bike
 * turns by leaning, so the keys ask for a lean and the bike rolls into it; Space the rear brake
 * alone; T the aids (wheelie, traction and rear-lift control, on by default); C the camera
 * (the rider's eyes, chase, trackside, your own orbit); Q / E gears down / up (manual from the
 * first press; the gearbox shifts by itself until then); K pause; M sound; Enter back to the
 * pad; Esc the end. The gearbox shifts by itself, with a quick-shifter's cut.
 *
 * The dynamics are h2rBike.js's; this poses the model on them — yaw, then the wheelie or stoppie
 * about the contact on the ground, then the lean about the tyres' crowns — turns the bars and
 * the wheels, works the springs, keeps the dash live, lays the tyres' marks, throws the water,
 * and when the bike falls, lets it slide on its side throwing sparks while the view, thrown clear,
 * follows it.
 */
import * as THREE from 'three';
import { createH2rBike, BIKE } from './h2rBike.js';
import { createH2rSound } from './h2rSound.js';
import { createSkidMarks, createTyreSmoke, createSpray } from './gt3Drive.js';
import { createEffects } from '../core/effects.js';
import { STEER_AXIS, AXLE_F, AXLE_R } from '../vehicles/h2r.js';
import { WHEELS, CHASSIS } from '../data/h2r.js';
import { trackCoords, toLocal, LAP, START } from '../core/circuitPlan.js';

const R2D = 180 / Math.PI;
const CAMERAS = ['rider', 'chase', 'trackside', 'orbit'];
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
  const dash = bike.getObjectByName('h2r-dash');
  const marks = createSkidMarks(scene, 6000);
  const smoke = createTyreSmoke(scene, 500);
  const spray = createSpray(scene, 800);
  const fx = createEffects(scene);
  const sound = createH2rSound();
  const sim = createH2rBike({ ground, obstacles });
  const s = sim.state;
  const state = { running: false, paused: false, camera: 'chase', readout: null, messages: [], lap: null, best: null, laps: 0 };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, fov: 0 };

  // ---- Controls -----------------------------------------------------------------------------
  const keys = new Set();
  const rider_ = { throttle: 0, brake: 0, rear: 0, lean: 0 };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyT', 'KeyK', 'KeyM', 'KeyQ', 'KeyE', 'KeyG', 'Escape', 'Enter']);
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
      case 'KeyE': sim.input.shiftUp = true; break;
      case 'KeyQ': sim.input.shiftDown = true; break;
      case 'KeyG': if (s.manual) { sim.input.auto = true; note('Gearbox: automatic again'); } break;
      case 'Enter': restart(); break;
      case 'Escape': reset(); break;
      default: break;
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); }
  function note(text) { state.messages.push({ text, t: performance.now() }); if (state.messages.length > 4) state.messages.shift(); }
  function setAids(on) { s.aids = !!on; note(s.aids ? 'Aids on: cornering ABS, traction, wheelie and rear-lift control' : 'Aids off: the brakes and the wheelies are yours; the lean limit stays'); }
  function setSound(on) { sound.setEnabled(on); note(sound.enabled ? 'Sound on: the four, the supercharger, the wind (synthesised)' : 'Sound off'); }
  function readControls(dt) {
    if (keys.size && modalOpen()) keys.clear();
    const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
    const ramp = (cur, target, rate) => cur + THREE.MathUtils.clamp(target - cur, -rate * dt, rate * dt);
    rider_.throttle = ramp(rider_.throttle, k('KeyW', 'ArrowUp'), 6);
    // The brake squeezed on over ≈0.2 s (a rider does not snatch it; the ABS does the rest).
    rider_.brake = ramp(rider_.brake, k('KeyS', 'ArrowDown'), 5);
    rider_.rear = ramp(rider_.rear, k('Space'), 7);
    // The lean asked for: in at a rider's pace, back up a little quicker.
    const want = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    rider_.lean = ramp(rider_.lean, want, want ? 2.2 : 3);
    Object.assign(sim.input, { throttle: rider_.throttle, brake: rider_.brake, rearBrake: rider_.rear, lean: rider_.lean });
  }

  // ---- Cameras --------------------------------------------------------------------------------
  let chase = null, ridePrev = null, trackside = null;
  const head = { roll: 0, g: 0 };
  // The springs' compression at rest (the bike settled on them), the zero of the visual pitch.
  const SAG = (() => { const b = createH2rBike(); return { f: b.state.susF, r: b.state.susR }; })();
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
    if (state.camera === 'rider' && !s.crashed) {
      // The rider's eyes: tucked in behind the screen at speed, sitting up when slow (≈ a 1.78 m
      // rider on the published 830 mm seat). Leant over, the rider hangs off into the turn (the
      // eye ≈0.22 m in and 0.06 m down at 45°), holds the head nearer level than the bike (≈ half
      // the lean, as helmet cameras show, smoothed over ≈0.12 s), looks through the turn (≈0.5 s
      // of the yaw ahead, up to 20°), and is pushed back and forth a little by the g (≈).
      const tuck = Math.min(1, Math.max(0, (s.u - 8) / 25));
      const k = Math.min(1, dt / 0.12);
      head.roll += (s.phi * 0.5 - head.roll) * k;
      head.g += (s.ax / 9.81 - head.g) * k;
      const hang = Math.sign(s.phi) * Math.min(1, Math.abs(s.phi) / (45 / R2D));
      _cam.set(-0.12 + 0.22 * tuck - 0.03 * head.g, 1.36 - 0.2 * tuck - 0.06 * Math.abs(hang), 0.22 * hang);
      leanIn.localToWorld(_cam);
      const yaw = THREE.MathUtils.clamp(-s.r * 0.5, -20 / R2D, 20 / R2D);
      _look.set(30 * Math.cos(yaw), 1.0 - 0.5 * tuck, -30 * Math.sin(yaw)); pitchIn.localToWorld(_look);
      camera.position.copy(_cam); camera.up.set(0, 1, 0);
      camera.lookAt(_look);
      camera.rotateZ(-head.roll);
      camera.fov = 75; camera.near = 0.03; camera.updateProjectionMatrix();
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
  let dashT = 0;
  function pose(dt) {
    // Down, the bike lies on its fairing and bars, ≈12 cm off the ground at its middle.
    holder.position.set(s.x, s.y + (s.crashed ? 0.12 * Math.sin(Math.abs(s.phi)) : 0), s.z);
    holder.rotation.set(0, s.psi, 0);
    // Pitch: the grade, and the wheelie about the rear contact or the stoppie about the front.
    const pivot = s.theta >= 0 ? AXLE_R.x : AXLE_F.x;
    pitchG.position.set(pivot, 0, 0); pitchIn.position.set(-pivot, 0, 0);
    pitchG.rotation.set(0, 0, s.theta + s.gradePitch);
    // The suspension's dive and squat, as a small pitch of the whole: the fork compresses along
    // its rake, the shock at the rear axle, over the wheelbase, from where they sit at rest. The
    // wheels pitch with it (the model is one piece), so half of it (≈), which keeps them within
    // ≈25 mm of the ground at full braking.
    leanG.rotation.set(s.phi, 0, 0.5 * Math.atan(((s.susR - SAG.r) - (s.susF - SAG.f) * Math.cos(CHASSIS.rake / R2D)) / BIKE.L));
    // The bars: at speed the steering is a degree or two; slow, up to the lock.
    if (steer) steer.quaternion.copy(steerBase).multiply(new THREE.Quaternion().setFromAxisAngle(STEER_AXIS, -s.steer));
    if (spinF) spinF.rotation.z = -(s.wheelAngleF % (Math.PI * 2));
    if (spinR) spinR.rotation.z = -(s.wheelAngleR % (Math.PI * 2));
    if (swing) swing.rotation.z = -s.susR * 1.2;
    // The dash, redrawn at ≈15 Hz.
    if (dash?.userData.draw && (dashT += dt) > 1 / 15) { dashT = 0; dash.userData.draw(s.rpm, s.crashed ? '-' : s.gear + 1, s.u * 3.6, s.phi * R2D, s.aids); }
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
  function placeHome() {
    spray.clear(); fx.clear(); marks.clear(); smoke.clear?.();
    sim.reset(home());
    Object.assign(rider_, { throttle: 0, brake: 0, rear: 0, lean: 0 });
    Object.assign(state, { paused: false, lap: null });
    lastS = null; fell = false; wheelieNoted = false; lastRefused = -10; leanNoted = false; lastHit = -10; splashed = false;
    head.roll = 0; head.g = 0;
    if (state.camera === 'chase' && fellCam) { setCamera('rider'); fellCam = false; }
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
    setCamera('rider');
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

  let fellCam = false;
  let fell = false, wheelieNoted = false, lastHit = -10, splashed = false, lastRefused = -10, leanNoted = false;
  /** The rider asking for more lean than the limit gives. */
  const leanHeld = () => !s.crashed && s.u > 3 && Math.abs(sim.input.lean) > 0.95 && Math.abs(s.phi) > s.leanCap - 2 / R2D;
  function events() {
    if (s.crashed && !fell) {
      fell = true;
      note(`${s.crashed.why} · Enter: back on the pad`);
      // Thrown clear: the view goes to the chase camera to watch the bike slide.
      if (state.camera === 'rider') { setCamera('chase'); fellCam = true; }
    }
    if (s.theta > 10 / R2D && !wheelieNoted) { wheelieNoted = true; note(`Wheelie${s.aids ? ' · the control holds it' : ''}`); }
    if (s.theta < 2 / R2D) wheelieNoted = false;
    if (s.impact > 2 && s.t - lastHit > 1) { lastHit = s.t; note(s.crashed ? `Contact at ${Math.round(s.impact * 3.6)} km/h` : `Scraped along it at ${Math.round(s.impact * 3.6)} km/h`); }
    if (s.shiftRefused > lastRefused) { lastRefused = s.shiftRefused; note('Downshift refused: it would over-rev'); }
    if (leanHeld() && !leanNoted) { leanNoted = true; note(`Lean limit: the tyres hold ${Math.round(s.leanCap * R2D)}° here`); }
    if (s.water > 0.02 && !splashed) { splashed = true; note('Into the water'); }
    if (s.water <= 0.02) splashed = false;
    // Scraping along a wall: sparks where the bike touches it.
    if (!s.crashed && s.hits.length && s.u > 3) {
      const h = s.hits[0], c = Math.cos(s.psi), sn = Math.sin(s.psi);
      const x = s.x + h.px * c - h.py * sn, z = s.z - h.px * sn - h.py * c, gh = ground(x, z).h;
      fx.burst('spark', new THREE.Vector3(x, gh + 0.35, z), Math.min(25, Math.round(4 + h.vn * 4)), { vel: new THREE.Vector3(s.u * c, 0, -s.u * sn), spread: 1.5 + s.u * 0.1, up: 1, floor: gh });
    }
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
      abs: s.abs, tc: s.tc, leanCap: s.leanCap * R2D, leanHeld: leanHeld(), manual: s.manual,
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
    sim, marks, sound, fx, start, reset, restart, setPaused, setCamera, cycleCamera, setAids, setSound, fmtTime,
    update(dt) { if (state.running) apply(dt); },
  };
}
