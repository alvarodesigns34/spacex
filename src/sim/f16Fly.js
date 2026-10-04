/**
 * Flying the F-16: the exhibit's own airframe, on the flight model (f16Flight.js), from where it
 * stands — lined up on runway 28, next to the site — through the take-off, anywhere over the centre's world and
 * back to a landing. There is no change of scene: the airplane, the runway, the site and the
 * ground out to 450 km are the same ones the visitor walks round.
 *
 * What the pilot has (the F-16's own controls, on a keyboard or a gamepad):
 *  - the side stick: load factor in pitch, roll rate in roll (the control laws are the
 *    airplane's, f16Flight.js); the rudder pedals, which also steer the nose wheel on the ground;
 *  - the throttle, idle to military, and through the detent into the afterburner;
 *  - wheel brakes, speed brakes, the gear.
 * Keyboard stick and pedals ramp in and centre themselves when let go (≈ this simulation's).
 */
import * as THREE from 'three';
import { createF16Flight, CG, atmosphere } from './f16Flight.js';
import { createF16Assist, calibrated, attitude } from './f16Assist.js';
import { runwayCue } from './f16Cue.js';
import { createF16Sound } from './f16Sound.js';
import { windAt } from '../core/wind.js';
import { createEffects } from '../core/effects.js';

export { calibrated };
import { RUNWAY, fromRunway, toRunway } from '../core/terrain.js';
import { COCKPIT } from '../vehicles/f16.js';
import { OVERALL, LINES } from '../data/f16.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, FT = 0.3048, KT = 0.514444;
/** The departure runway: the east end's designation and its true heading (the scene's +X bears
 *  100.8°, gulf.js; the F-16 waits there facing −a). */
const RW_NAME = RUNWAY.idents[1], RW_HEADING = (100.8 + RUNWAY.angleDeg + 180) % 360;
const L2 = RUNWAY.length / 2;
const CAMERAS = ['chase', 'cockpit', 'tower', 'orbit'];

export function createF16Fly({ scene, exhibit, env, rig, camera, ground, solid = null, hud, onStart = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const airframe = exhibit.model.getObjectByName('f16-airframe');
  const gearGroup = airframe.getObjectByName('f16-landing-gear');
  // What a crash leaves (core/effects.js): the fireball, the burning wreck's smoke, the pieces, the
  // water thrown up. Fast into the ground or into something standing on it, the fuel goes up and
  // the airframe breaks into pieces; into the water, a column of spray, and the airframe breaks up
  // too if it came in fast, else settles whole and goes down;
  // a collapsed gear or a belly landing, sparks and dust, the airframe where it stopped (≈ the
  // look of such crashes filmed; nothing here models fire or fracture).
  const fx = createEffects(scene);
  let wreck = null;
  const holder = new THREE.Group();
  holder.name = 'f16-flight';
  holder.visible = false;
  scene.add(holder);

  // The moving surfaces: each hinge group, its axis and its resting turn.
  const hinge = (name) => {
    const o = airframe.getObjectByName(name);
    if (!o?.userData.hinge) return null;
    return { o, axis: new THREE.Vector3(...o.userData.hinge.axis).normalize(), base: o.quaternion.clone() };
  };
  const surf = {
    stabL: hinge('f16-stab-l'), stabR: hinge('f16-stab-r'), rudder: hinge('f16-rudder'),
    flapL: hinge('f16-flaperon-l'), flapR: hinge('f16-flaperon-r'), lefL: hinge('f16-lef-l'), lefR: hinge('f16-lef-r'),
    sb: ['l-upper', 'l-lower', 'r-upper', 'r-lower'].map(t => hinge(`f16-speedbrake-${t}`)),
  };
  const _q = new THREE.Quaternion();
  const turn = (h, deg) => { if (h) h.o.quaternion.copy(h.base).multiply(_q.setFromAxisAngle(h.axis, deg * D2R)); };
  function animate(st) {
    const { de, diff, da, dr, lef, flap } = st.surfaces;
    // Stabilators: together for pitch (trailing edge down positive), differentially for roll.
    turn(surf.stabL, -(de - diff)); turn(surf.stabR, -(de + diff));
    // Flaperons: drooped with the gear down, and the aileron's share either way.
    turn(surf.flapL, flap - da); turn(surf.flapR, -(flap + da));
    turn(surf.lefL, lef); turn(surf.lefR, lef);
    turn(surf.rudder, dr);
    for (const h of surf.sb) turn(h, 60 * st.sb);
    if (gearGroup) gearGroup.visible = st.gear > 0.35;
  }

  // The afterburner's flame at the nozzle's exit (≈, a visual: an additive cone whose length and
  // brightness follow the afterburner's share of the thrust). On the airplane only while it flies,
  // so it never counts in the exhibit's measured length.
  const flame = (() => {
    const { s1, exitArea } = LINES.nozzle, r = Math.sqrt(exitArea / Math.PI);
    const geo = new THREE.LatheGeometry([[0, 0], [r * 0.92, 0.02], [r * 0.78, 0.35], [r * 0.45, 0.75], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    geo.rotateZ(Math.PI / 2);   // along −x, out of the nozzle
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, name: 'f16-afterburner' });
    const m = new THREE.Mesh(geo, mat);
    m.name = 'f16-afterburner-flame';
    // On the nozzle's axis: the petals' lathe is centred on it (vehicles/f16.js buildNozzle).
    m.position.set(-s1, airframe.getObjectByName('f16-nozzle-petals')?.position.y ?? -OVERALL.groundWL, 0);
    m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2;
    return m;
  })();
  function updateFlame(st) {
    const ab = THREE.MathUtils.clamp((st.power - 50) / 50, 0, 1);
    flame.visible = ab > 0.01;
    flame.scale.set(1.2 + 3.8 * ab, 1, 1);
    flame.material.opacity = 0.2 + 0.35 * ab;
    flame.material.color.setRGB(1, 0.42 + 0.12 * ab, 0.16 + 0.1 * ab);
  }

  // The site's wind (core/wind.js): the airplane flies in it, the HUD shows it.
  const sim = createF16Flight({ ground, solid: (a, b) => solid?.(a, b) ?? false, wind: windAt });
  const s = sim.state;
  // The sound (f16Sound.js): off until the visitor turns it on (M, the bar's button).
  const sound = createF16Sound();
  function setSound(on) { sound.setEnabled(on); note(sound.enabled ? 'Sound on: the F100, the air, the wheels (synthesised)' : 'Sound off'); }
  // `manual`: the checks set `pilot` themselves and the keyboard is not read.
  const state = { running: false, paused: false, camera: 'chase', outcome: null, touchdown: null, messages: [], readout: null, flown: false, manual: false, assist: true };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, far: 0, fov: 0 };

  // ---- Controls ---------------------------------------------------------------------------------
  const keys = new Set();
  const pilot = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1, parking: true, speedBrake: false, gearDown: true };
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyR', 'KeyF', 'PageUp', 'PageDown', 'Space', 'KeyB', 'KeyG', 'KeyC', 'KeyK', 'KeyM', 'Escape', 'Enter', 'ShiftLeft', 'ShiftRight']);
  // An open modal dialog (the guide) owns the keyboard: Tab and Shift+Tab stay inside it and
  // Escape closes it, not the flight; and the keys held when it opened are let go.
  const modalOpen = () => typeof document !== 'undefined' && !!document.querySelector('[role="dialog"][aria-modal="true"]:not(.hidden)');
  function onKeyDown(e) {
    if (!state.running || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (modalOpen()) { keys.clear(); return; }
    // The flight owns the keyboard while it runs: the centre's own shortcuts (the vehicle
    // numbers, G, X, V, L…) would end it from under the pilot. Only the guide (H, ?) gets through.
    if (e.code === 'KeyH' || e.key === '?') return;
    e.stopImmediatePropagation();
    if (!CODES.has(e.code)) return;
    e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyB': pilot.speedBrake = !pilot.speedBrake; note(pilot.speedBrake ? 'Speed brakes out' : 'Speed brakes in'); break;
      case 'KeyG': toggleGear(); break;
      case 'KeyC': cycleCamera(); break;
      case 'KeyK': setPaused(!state.paused); break;
      case 'KeyM': setSound(!sound.enabled); break;
      case 'Enter': restart(); break;
      case 'Escape': reset(); break;
      default: break;
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); }
  /** The gear's limit speed, KCAS (≈: the figure usually quoted for the F-16, 300 kt; not from a flight manual here). */
  const GEAR_LIMIT_KCAS = 300;
  function toggleGear() {
    if (pilot.gearDown && s.wow) { note('Gear handle locked: weight on the wheels'); return; }
    // Faster than the gear's limit the handle stays up: before, it came down at Mach 1.5.
    if (!pilot.gearDown && calibrated(s.mach, atmosphere(s.alt).P) / KT > GEAR_LIMIT_KCAS) {
      note(`Too fast for the gear: below ${GEAR_LIMIT_KCAS} kt (≈)`); return;
    }
    pilot.gearDown = !pilot.gearDown;
    note(pilot.gearDown ? 'Gear down' : 'Gear up');
  }
  function setAssist(on) { state.assist = !!on; note(state.assist ? 'Simple controls: W S power, ↑ ↓ climb, A D turn, G gear' : 'Full controls: every control is yours'); }
  function note(text) { state.messages.push({ text, t: performance.now() }); if (state.messages.length > 4) state.messages.shift(); }

  const padPrev = new Map();
  const padEdge = (g, i, fn) => { const k = `${g.index}:${i}`, on = !!g.buttons[i]?.pressed; if (on && !padPrev.get(k)) fn(); padPrev.set(k, on); };
  /** Keyboard and gamepad to stick, pedals, throttle and brakes. dt in real seconds. */
  function readControls(dt) {
    if (state.manual) { toSim(); return; }
    if (keys.size && modalOpen()) keys.clear();
    if (state.assist) { easyControls(dt); toSim(); return; }
    const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
    const ramp = (cur, target, rate) => cur + THREE.MathUtils.clamp(target - cur, -rate * dt, rate * dt);
    // Pull (S, ↓) is nose up. Held, the stick moves out at a rate; Shift doubles its reach.
    const reach = k('ShiftLeft', 'ShiftRight') ? 1 : 0.5;
    const tp = (k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp')) * reach;
    const tr = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    const ty = k('KeyE') - k('KeyQ');
    pilot.pitch = ramp(pilot.pitch, tp, tp ? 1.2 : 3);
    pilot.roll = ramp(pilot.roll, tr, tr ? 2.5 : 5);
    pilot.yaw = ramp(pilot.yaw, ty, ty ? 2 : 4);
    // The afterburner detent at 0.77.
    const before = pilot.throttle;
    // Throttle: R (or Page Up) forward, F (or Page Down) back, half the lever's travel a second.
    pilot.throttle = THREE.MathUtils.clamp(pilot.throttle + (k('KeyR', 'PageUp') - k('KeyF', 'PageDown')) * 0.5 * dt, 0, 1);
    if (before < 0.77 && pilot.throttle >= 0.77) note('Afterburner');
    if (before >= 0.77 && pilot.throttle < 0.77) note('Military power');
    // The parking brake holds the airplane on the threshold until the throttle comes off idle:
    // at idle the F100 pushes harder than the tyres roll, and it crept off on its own.
    if (pilot.parking && pilot.throttle > 0.05) { pilot.parking = false; note('Parking brake off'); }
    pilot.brake = k('Space') || pilot.parking ? 1 : 0;
    const pad = readPad();
    if (pad) {
      // The pad's sticks take over only when moved, so the keyboard still works with one plugged in.
      if (pad.roll || pad.pitch) { pilot.roll = pad.roll; pilot.pitch = pad.pitch; }
      if (pad.yaw) pilot.yaw = pad.yaw;
      pilot.throttle = THREE.MathUtils.clamp(pilot.throttle + (pad.gas - pad.cut) * 0.4 * dt, 0, 1);
      if (pad.brake) pilot.brake = 1;
    }
    toSim();
  }

  /**
   * The first connected gamepad, read the same way for both control modes: the sticks (dead zone
   * 0.08; left stick roll and pitch, pull is nose up), the triggers (RT power, LT back), A the
   * brakes, and the buttons' presses (B gear, X speed brakes, Y camera, Start pause). Before, the
   * simple controls (the default) returned before reading the pad at all, so it did nothing there.
   */
  function readPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) {
      if (!g || !g.connected) continue;
      const dz = (v) => (Number.isFinite(v) && Math.abs(v) >= 0.08 ? v : 0);
      const b = (i) => { const v = g.buttons[i]?.value ?? 0; return Number.isFinite(v) ? v : 0; };
      padEdge(g, 1, toggleGear);
      padEdge(g, 2, () => { pilot.speedBrake = !pilot.speedBrake; });
      padEdge(g, 3, cycleCamera);
      padEdge(g, 9, () => setPaused(!state.paused));
      return {
        roll: dz(g.axes[0] ?? 0), pitch: dz(g.axes[1] ?? 0), yaw: g.axes.length >= 3 ? dz(g.axes[2]) : 0,
        gas: b(7), cut: b(6), brake: b(0) > 0.5,
      };
    }
    return null;
  }

  /** The simple controls (on by default; the bar's Assist button gives every control back): f16Assist.js. */
  const assist = createF16Assist({ sim, pilot, note });
  function easyControls(dt) {
    const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
    // The keyboard and the pad as one intent: RT/LT are W/S, the left stick's pull and push are
    // ↑/↓ (past a third of its travel), its sideways travel banks as far as it is pushed.
    const pad = readPad();
    const turnKeys = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    const gas = k('KeyW') || (pad?.gas ?? 0) > 0.1 ? 1 : 0;
    assist.step({
      gas, cut: k('KeyS') || (pad?.cut ?? 0) > 0.1 ? 1 : 0,
      up: k('ArrowUp') || (pad?.pitch ?? 0) > 0.33 ? 1 : 0, down: k('ArrowDown') || (pad?.pitch ?? 0) < -0.33 ? 1 : 0,
      turn: turnKeys || (pad?.roll ?? 0), shift: k('ShiftLeft', 'ShiftRight'),
    }, dt, { touchdown: !!state.touchdown });
    if (gas && s.wow) { state.touchdown = null; if (state.outcome?.kind === 'stopped') state.outcome = null; }
  }
  function toSim() {
    Object.assign(sim.input, {
      pitch: pilot.pitch, roll: pilot.roll, yaw: pilot.yaw, throttle: pilot.throttle,
      brake: pilot.brake, speedBrake: pilot.speedBrake ? 1 : 0, gearDown: pilot.gearDown,
    });
  }

  // ---- Cameras ----------------------------------------------------------------------------------
  let chase = null, ridePrev = null;
  const _cam = new THREE.Vector3(), _look = new THREE.Vector3(), _v = new THREE.Vector3(), _u = new THREE.Vector3(), _off = new THREE.Vector3();
  const _Y = new THREE.Vector3(0, 1, 0), camUp = new THREE.Vector3(0, 1, 0);
  function cycleCamera() { setCamera(CAMERAS[(CAMERAS.indexOf(state.camera) + 1) % CAMERAS.length]); }
  function setCamera(name) {
    state.camera = name;
    chase = null; camUp.set(0, 1, 0);
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
      // The pilot's eye (vehicles/f16.js COCKPIT, ≈), looking along the nose.
      _cam.set(-COCKPIT.eye.s, COCKPIT.eye.z - OVERALL.groundWL, 0);
      holder.localToWorld(_cam);
      _look.set(1, -0.05, 0).applyQuaternion(holder.quaternion).multiplyScalar(100).add(_cam);
      _u.set(0, 1, 0).applyQuaternion(holder.quaternion);
      camera.up.copy(_u);
      camera.position.copy(_cam);
      camera.lookAt(_look);
      camera.up.set(0, 1, 0);
      camera.fov = 70; camera.near = 0.05; camera.updateProjectionMatrix();
      return;
    }
    if (state.camera === 'tower') {
      // Beside runway 28's touchdown zone, 300 m off the centre line on the apron's side, 15 m up.
      const [x, z] = fromRunway(L2 - 450, -300);
      camera.position.set(x, 15, z);
      camera.lookAt(holder.position);
      const dist = camera.position.distanceTo(holder.position);
      camera.fov = THREE.MathUtils.clamp(2 * Math.atan(30 / dist) * R2D, 3, 60);
      camera.updateProjectionMatrix();
      return;
    }
    // Chase: behind along the flight path and a little above, trailing the turns (along the nose
    // when nearly stopped). The OFFSET from the airplane is what is smoothed, not the camera's
    // position: smoothing the position left it v/4 behind (49 m at 80 m/s, 107 m at 350, for 26
    // designed). Up is the airframe's, 70 % of the way back to the world's, so a vertical climb
    // has a defined up and a roll shows a little.
    if (s.tas > 25) _v.copy(s.vel).normalize(); else _v.set(1, 0, 0).applyQuaternion(holder.quaternion);
    _u.set(0, 1, 0).applyQuaternion(holder.quaternion).lerp(_Y, 0.7).normalize();
    _cam.copy(_v).multiplyScalar(-26).addScaledVector(_u, 5.5);
    if (!chase) chase = _cam.clone();
    chase.lerp(_cam, 1 - Math.exp(-dt * 4));
    camUp.lerp(_u, 1 - Math.exp(-dt * 4)).normalize();
    _look.copy(s.pos).add(chase);
    const g = ground(_look.x, _look.z).h;
    _look.y = Math.max(_look.y, g + 1.5);
    camera.position.copy(_look);
    camera.up.copy(camUp);
    camera.lookAt(s.pos);
    camera.up.set(0, 1, 0);
    camera.fov = saved.fov; camera.updateProjectionMatrix();
  }

  /** The air, the fog and the depth range follow the camera's height. */
  function updateWorld() {
    const camAlt = Math.max(0, camera.position.y);
    env.setAltitude(camAlt, { flight: true });
    camera.near = state.camera === 'cockpit' ? 0.05 : camAlt > 5000 ? 1 : 0.2;
    camera.far = Math.max(60000, Math.sqrt(2 * 6371000 * Math.max(camAlt, 1)) * 1.3 + 60000);
    camera.updateProjectionMatrix();
    // The shadow box and the orbit's centre follow the airplane.
    if (rig.external) rig.target.copy(holder.position);
  }

  // ---- Touchdown, crash, stop ---------------------------------------------------------------------
  const onPavement = (x, z) => ground(x, z).hard;
  const tmpDir = new THREE.Vector3();
  function crashEffects(c) {
    const at = holder.position.clone(), g = ground(at.x, at.z), v = c.speed;
    const floor = g.h;
    at.y = Math.max(at.y, floor + 0.5);
    if (c.what === 'water') {
      const surf = g.water ? g.h : (g.surface ?? g.h);
      // From the surface it struck (the airframe's middle may already be under it).
      at.y = surf + 0.3;
      // The water is thrown up along the last stretch of the track, carried forward with what
      // struck it: a curtain of fine spray and heavier sheets, the mist hanging after.
      const run = Math.min(30, v * 0.2), dir = tmpDir.set(s.vel.x, 0, s.vel.z), hv = dir.length();
      if (hv > 0.1) dir.multiplyScalar(1 / hv);
      const carry = dir.clone().multiplyScalar(hv * 0.5);
      for (let k = 0; k < 6; k++) {
        const p = at.clone().addScaledVector(dir, -run * k / 5), w = 1 - k / 7;
        fx.burst('spray', p, Math.round(Math.min(220, 40 + v * 1.5) * w), { vel: carry, spread: 3 + v * 0.08, up: (6 + v * 0.16) * w, floor: surf });
        fx.burst('splash', p, Math.round(Math.min(60, 10 + v * 0.4) * w), { vel: carry, spread: 2 + v * 0.05, up: (4 + v * 0.1) * w, floor: surf });
      }
      fx.burst('mist', at, 30, { vel: carry, spread: 3 + v * 0.05, up: 3, floor: surf });
      // Fast, the water is as hard as the ground: the airframe breaks up, some fuel burns on the
      // surface; slower, a ditching: it settles whole and goes down.
      if (v > 60) {
        fx.burst('fire', at, 30, { spread: 4, up: 2 });
        fx.burst('debris', at, 160, { vel: s.vel, spread: 8 + v * 0.1, up: 7, floor: surf });
        airframe.visible = false;
      }
      wreck = { at, t: 0, burn: v > 60 ? 8 : 0, sink: v <= 60, surf };
    } else if (v > 30 || c.what === 'structure') {
      fx.burst('fire', at, 180, { spread: 5 + v * 0.06, up: 5 });
      fx.burst('ember', at, 160, { spread: 8 + v * 0.1, up: 8, floor });
      fx.burst('smoke', at, 70, { spread: 4, up: 3 });
      fx.burst('debris', at, 300, { vel: s.vel, spread: 10 + v * 0.15, up: 9, floor });
      fx.burst('spark', at, 200, { spread: 10 + v * 0.1, up: 4, floor });
      fx.burst('dust', at, 40, { spread: 6, up: 2, floor });
      airframe.visible = false;
      wreck = { at, t: 0, burn: 30, sink: false };
    } else {
      fx.burst('spark', at, 160, { spread: 4, up: 1.5, floor });
      fx.burst('dust', at, 40, { spread: 3, up: 1, floor });
      fx.burst('debris', at, 25, { spread: 3, up: 2, floor });
      wreck = { at, t: 0, burn: 0, sink: false };
    }
  }
  /** The wreck: burning, and smoking for a while after; or going down in the water. */
  function tendWreck(dt) {
    fx.update(dt);
    if (!wreck) return;
    wreck.t += dt;
    if (wreck.t < wreck.burn) {
      const k = 1 - wreck.t / wreck.burn;
      if (Math.random() < dt * 30 * k) fx.burst('fire', wreck.at, 2, { spread: 1.5, up: 2 });
      // (On the water the smoke rises once the spray has fallen back, ≈1,5 s.)
      if ((wreck.surf === undefined || wreck.t > 1.5) && Math.random() < dt * 20) fx.burst('smoke', wreck.at, 1, { spread: 1, up: 2 });
    }
    if (wreck.sink && holder.position.y > wreck.surf - 4) {
      holder.position.y -= dt * 0.6;
      if (holder.position.y < wreck.surf - 3.5) airframe.visible = false;
    }
  }
  function judge() {
    if (s.crashed && !state.outcome) {
      const why = {
        gear: `The gear collapsed: touchdown at ${(s.crashed.sink).toFixed(1)} m/s (${(s.crashed.sink / FT * 60).toFixed(0)} ft/min).`,
        airframe: 'The airframe struck the ground.',
        belly: 'Belly landing: the gear was not down.',
        water: 'Into the water.',
        structure: 'Struck a structure on the ground.',
      }[s.crashed.what] ?? 'Crashed.';
      state.outcome = { kind: 'crash', why };
      note(why);
      crashEffects(s.crashed);
      return;
    }
    // Moving again after a stop: the last landing's card goes away.
    if (state.outcome?.kind === 'stopped' && s.tas > 3) { state.outcome = null; state.touchdown = null; }
    if (!s.wow) { if (state.touchdown && s.agl > 3) state.touchdown = null; state.flown ||= s.agl > 15; return; }
    if (state.flown && !state.touchdown) {
      const [a, c] = toRunway(s.pos.x, s.pos.z);
      state.touchdown = { sink: s.wheels.length ? lastSink : 0, kt: s.tas / KT, fromThreshold: a + RUNWAY.length / 2, offCentre: c, onRunway: onPavement(s.pos.x, s.pos.z) };
      note(`Touchdown · ${(state.touchdown.sink / FT * 60).toFixed(0)} ft/min · ${state.touchdown.kt.toFixed(0)} kt${state.touchdown.onRunway ? '' : ' · off the pavement'}`);
    }
    if (state.touchdown && s.tas < 0.5 && !state.outcome) {
      const [a, c] = toRunway(s.pos.x, s.pos.z);
      state.outcome = { kind: 'stopped', why: `Stopped ${(L2 - a).toFixed(0)} m from runway ${RW_NAME}'s threshold, ${Math.abs(c).toFixed(1)} m off the centre line.` };
      note('Stopped · Enter to fly again, Esc to end');
      state.flown = false;
    }
  }
  let lastSink = 0;

  // ---- Lifecycle ---------------------------------------------------------------------------------
  /** On runway 28's threshold where the exhibit stands, at rest, brakes on. */
  function placeOnRunway() {
    // A new start: the wreck cleared, the airframe whole.
    wreck = null; fx.clear(); airframe.visible = true;
    // The exhibit's spot: the airplane's middle 40 m + half its length in from the 28 threshold,
    // the nose towards the west end.
    const a = L2 - 40 - OVERALL.length / 2;
    const [nx, nz] = fromRunway(a - OVERALL.length / 2, 0);   // the nose tip
    sim.reset({ x: nx, z: nz, yaw: (180 - RUNWAY.angleDeg) * D2R });
    Object.assign(pilot, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1, parking: true, speedBrake: false, gearDown: true });
    Object.assign(state, { outcome: null, touchdown: null, flown: false, paused: false });
    assist.reset();
  }
  function start() {
    if (state.running) return;
    onStart();
    saved.parent = airframe.parent;
    saved.position.copy(airframe.position);
    saved.quaternion.copy(airframe.quaternion);
    saved.near = camera.near; saved.far = camera.far; saved.fov = camera.fov;
    holder.add(airframe);
    airframe.position.set(0, 0, 0);
    airframe.quaternion.identity();
    holder.visible = true;
    airframe.add(flame);
    placeOnRunway();
    state.running = true;
    state.messages = [];
    if (rig.mode !== 'orbit') rig.setMode('orbit');
    setCamera('chase');
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    visibilityHook?.(true);
    hud?.show(true);
    note(state.assist ? 'Hold W for power · it rotates by itself · ↑ ↓ climb and descend · A D turn · G gear to land' : 'Hold R for throttle (afterburner past 77 %) · at 135 kt hold S to rotate');
    apply(0);
  }
  function restart() {
    if (!state.running) return;
    placeOnRunway();
    note(`Back on runway ${RW_NAME}`);
  }
  function reset(returnCamera = true) {
    if (!state.running) return;
    state.running = false;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    keys.clear();
    sound.stop();
    for (const h of [surf.stabL, surf.stabR, surf.rudder, surf.flapL, surf.flapR, surf.lefL, surf.lefR, ...surf.sb]) if (h) h.o.quaternion.copy(h.base);
    if (gearGroup) gearGroup.visible = true;
    flame.removeFromParent();
    wreck = null; fx.clear(); airframe.visible = true;
    saved.parent.add(airframe);
    airframe.position.copy(saved.position);
    airframe.quaternion.copy(saved.quaternion);
    holder.visible = false;
    env.setAltitude(0);
    camera.near = saved.near; camera.far = saved.far; camera.fov = saved.fov;
    camera.updateProjectionMatrix();
    rig.releaseExternal?.();
    visibilityHook?.(false);
    hud?.show(false);
    if (returnCamera) onFinish(state.outcome);
  }
  function setPaused(on) { if (state.running) state.paused = !!on; }

  /** Advances by dt real seconds, then poses the airplane and the camera. */
  function apply(dt) {
    readControls(dt);
    if (!state.paused && !state.outcome?.kind?.startsWith('crash') && dt > 0) {
      const vy = s.vel.y;
      sim.advance(Math.min(dt, 0.5));
      if (s.wow && vy < 0) lastSink = -vy;
      judge();
    }
    if (!wreck?.sink) sim.pose(holder);
    tendWreck(state.paused ? 0 : Math.min(dt, 0.25));
    animate(s);
    updateFlame(s);
    placeCamera(Math.max(dt, 1 / 120));
    updateWorld();
    camera.updateMatrixWorld();
    if (state.paused || state.outcome?.kind?.startsWith('crash')) sound.stop();
    else sound.update(s, camera, state.camera === 'cockpit', Math.max(dt, 1 / 240));
    publish();
  }

  /** What the HUD shows. */
  function publish() {
    // Heading: the nose's direction on the ground; the scene's +X bears 100.8°, angles grow
    // clockwise seen from above (towards +Z).
    _v.set(1, 0, 0).applyQuaternion(s.q);
    const hdg = (100.8 + Math.atan2(_v.z, _v.x) * R2D + 360) % 360;
    const cas = calibrated(s.mach, atmosphere(s.alt).P);
    const [a, c] = toRunway(s.pos.x, s.pos.z);
    state.readout = {
      // The altitude over the sea beneath (the round Earth's, f16Flight geodesy), not over the pad's plane.
      kcas: cas / KT, ktas: s.tas / KT, mach: s.mach, gsKt: s.gs / KT,
      // The wind where the airplane is: where it blows from (true) and its speed.
      windFrom: (100.8 + Math.atan2(s.windV.z, s.windV.x) * R2D + 180 + 360) % 360, windKt: Math.hypot(s.windV.x, s.windV.z) / KT, altFt: (s.alt - CG.y) / FT, aglFt: s.agl / FT,
      vsFpm: s.vel.y / FT * 60, alpha: s.alpha, beta: s.beta, nz: s.load, heading: hdg,
      // The same attitude the simple controls fly by (bank over the full circle, ±180°).
      pitch: attitude(s).pitch, roll: attitude(s).bank,
      throttle: pilot.throttle, power: s.power, ab: s.power > 50, thrust: s.thrust,
      gear: s.gear, gearDown: pilot.gearDown, brake: pilot.brake > 0, speedBrake: s.sb, wow: s.wow,
      fuel: s.fuel, flameout: s.flameout,
      // Where the model runs beyond its data (H16): α or β outside Morelli's fit, Mach above 0.6.
      outside: s.domain.out ? [s.domain.alpha && 'α', s.domain.beta && 'β', s.domain.mach && 'M>0.6'].filter(Boolean) : null,
      runway: { along: L2 - a, across: c, heading: RW_HEADING, name: RW_NAME },
      // Where runway 28 is (f16Cue.js), and the speed the simple controls' autothrottle holds.
      cue: runwayCue(s.pos.x, s.pos.z, s.agl, hdg), vHold: state.assist && !pilot.gearDown ? assist.state.vHold : null,
      camera: state.camera, paused: state.paused, assist: state.assist, outcome: state.outcome, touchdown: state.touchdown, sound: sound.enabled,
      messages: state.messages.filter(m => performance.now() - m.t < 5000).map(m => m.text),
      velocity: s.vel, position: s.pos, quaternion: s.q,
    };
    hud?.update(state.readout, camera);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    get position() { return holder.position; },
    sim, sound, start, reset, restart, setPaused, setCamera, cycleCamera, setAssist, setSound,
    update(dt) { if (state.running) apply(dt); },
    /** For the checks: the pilot's controls, set directly (the keyboard is read over them). */
    pilot,
  };
}
