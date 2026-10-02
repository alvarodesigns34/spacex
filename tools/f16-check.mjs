#!/usr/bin/env node
// The F-16's flight model, flown headless (no browser): the published numbers it is built on, and
// what it does with them — at rest on the gear, a take-off, level flight, a full roll, the α
// limiter, supersonic flight, a landing and a landing too hard for the gear. Each case is flown by
// a small autopilot working the same inputs a player has (stick, throttle, rudder, brakes). Then
// the simple controls (f16Assist.js) flown with the keys a visitor presses: W held from the
// threshold, a dive at the ground, a hard turn, and an approach with the hands off to a stop.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const THREE = await import('three');
const { createF16Flight, thrust, atmosphere, CG } = await import('../src/sim/f16Flight.js');
const { createF16Assist, calibrated, attitude } = await import('../src/sim/f16Assist.js');
const { morelli, MORELLI, THRUST } = await import('../src/data/f16Aero.js');
const { MASS } = await import('../src/data/f16.js');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const KT = 0.514444, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const W = MASS.weight * 9.80665;

// A flat world: pavement everywhere, at height 0.
const flat = () => ({ h: 0, hard: true, water: false });
const make = () => { const f = createF16Flight({ ground: flat }); return { f, s: f.state, i: f.input }; };
const pitchOf = (s) => new THREE.Euler().setFromQuaternion(s.q, 'YZX').z * R2D;
const rollOf = (s) => new THREE.Euler().setFromQuaternion(s.q, 'YZX').x * R2D;
/** Airborne, level along +x at h, speed V, attitude a (deg), gear and power set. */
function airborne(f, s, { h, V, a, power, gear = false }) {
  f.reset({ x: 0, z: 0 });
  s.pos.set(0, h, 0); s.vel.set(V, 0, 0);
  s.q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a * D2R);
  f.input.brake = 0; f.input.gearDown = gear; s.gear = gear ? 1 : 0; s.wow = false;
  s.power = power; f.input.throttle = power <= 50 ? 0.77 * power / 50 : 0.77 + 0.23 * (power - 50) / 50;
}
/** A PI loop on one input, for the autopilots. */
const pid = (kp, ki, lo, hi) => { let acc = 0; return (err, dt) => { acc = Math.max(lo, Math.min(hi, acc + err * ki * dt)); return Math.max(lo, Math.min(hi, kp * err + acc)); }; };

// ---- The published numbers, as used ----------------------------------------------------------
{
  const c0 = morelli(0, 0, 0, 0, 0, 0, 0, 0, { cbar: 3.45, b: 9.144 });
  report(Math.abs(c0.Cz - MORELLI.f[0]) < 1e-9 && Math.abs(c0.Cx - MORELLI.a[0]) < 1e-9,
    'Morelli: Cz y Cx a α = 0 son f0 y a0 de su tabla 3', `Cz ${c0.Cz.toFixed(4)}, Cx ${c0.Cx.toFixed(4)}`);
  const t = [thrust(50, 0, 0.2), thrust(100, 0, 0.2), thrust(0, 0, 0.2), thrust(100, 9144, 0.8)];
  report(t[0] === THRUST.mil[0][0] && t[1] === THRUST.max[0][0] && t[2] === THRUST.idle[0][0] && Math.abs(t[3] - THRUST.max[3][3]) < 1e-6,
    'empuje: la tabla VI de TP-1538 en sus nodos', t.map(x => `${(x / 1000).toFixed(1)} kN`).join(' · '));
  const a = atmosphere(11000);
  report(Math.abs(a.T - 216.65) < 0.01 && Math.abs(a.P - 22632) < 5, 'atmósfera estándar en la tropopausa', `${a.T.toFixed(2)} K, ${a.P.toFixed(0)} Pa`);
}

// ---- At rest on the gear ---------------------------------------------------------------------
{
  const { f, s } = make();
  f.reset({ x: 0, z: 0 });
  const p0 = s.pos.clone();
  f.advance(20);
  const loads = s.wheels.map(w => w.load), sum = loads.reduce((a, b) => a + b, 0);
  const moved = s.pos.distanceTo(p0);
  report(Math.abs(sum - W) / W < 0.01 && loads[0] / sum > 0.10 && loads[0] / sum < 0.15 && moved < 0.05 && !s.crashed,
    'en reposo sobre el tren, frenos puestos y motor al ralentí',
    `cargas ${loads.map(l => (l / 1000).toFixed(1)).join(' / ')} kN (peso ${(W / 1000).toFixed(1)}), morro ${(100 * loads[0] / sum).toFixed(1)} %, se movió ${(moved * 100).toFixed(1)} cm`);
  const cgH = s.pos.y;
  report(Math.abs(cgH - CG.y) < 0.01, 'el avión queda a la altura del modelo', `centro de gravedad a ${cgH.toFixed(3)} m (modelo ${CG.y.toFixed(3)} m)`);
}

// ---- Take-off with full afterburner ------------------------------------------------------------
let liftoff = null;
{
  const { f, s, i } = make();
  f.reset({ x: 0, z: 0 });
  f.advance(2);
  i.brake = 0; i.throttle = 1;
  const x0 = s.pos.x;
  let maxPitch = 0, rotated = null;
  for (let k = 0; k < 600 && !s.crashed; k++) {
    const kt = s.tas / KT, th = pitchOf(s);
    // Rotate at 135 kt to ≈12° pitch, then hold it.
    if (kt > 135 && !rotated) rotated = { kt, x: s.pos.x - x0 };
    i.pitch = !rotated ? 0 : Math.max(-0.3, Math.min(1, (12 - th) * 0.12 - s.w.y * R2D * 0.05));
    f.advance(0.05);
    maxPitch = Math.max(maxPitch, th);
    if (!liftoff && !s.wow && s.pos.y - CG.y > 0.5) liftoff = { kt: s.tas / KT, x: s.pos.x - x0, t: s.t };
    if (s.pos.y > 150) break;
  }
  report(!!liftoff && !s.crashed && liftoff.x < 900 && liftoff.kt > 140 && liftoff.kt < 200 && maxPitch < 16,
    'despegue con postcombustión desde parado', liftoff ? `rota a ${rotated.kt.toFixed(0)} kt a ${rotated.x.toFixed(0)} m; despega a ${liftoff.kt.toFixed(0)} kt a ${liftoff.x.toFixed(0)} m (${(liftoff.x / 0.3048).toFixed(0)} ft); cabeceo máximo ${maxPitch.toFixed(1)}°` : `sin despegar ${s.crashed ? JSON.stringify(s.crashed) : ''}`);
}

// ---- Level flight, M 0.6 at 3,000 m: held by an altitude-and-speed autopilot -------------------
{
  const { f, s, i } = make();
  airborne(f, s, { h: 3000, V: 196, a: 2, power: 35 });
  const vsLoop = pid(0.02, 0.01, -0.5, 0.5), spLoop = pid(0.02, 0.01, 0, 0.77);
  let maxDh = 0, alphaSum = 0, n = 0;
  for (let k = 0; k < 1200; k++) {
    const dt = 0.05;
    i.pitch = vsLoop((3000 - s.pos.y) * 0.1 - s.vel.y, dt);
    i.throttle = spLoop(196 - s.tas, dt);
    f.advance(dt);
    if (k > 600) { maxDh = Math.max(maxDh, Math.abs(s.pos.y - 3000)); alphaSum += s.alpha; n++; }
  }
  const a = alphaSum / n;
  report(!s.crashed && maxDh < 15 && a > 0.3 && a < 3, 'vuelo nivelado a Mach 0,6 y 3.000 m', `α medio ${a.toFixed(2)}°, desvío máximo ${maxDh.toFixed(1)} m, motor ${s.power.toFixed(0)} %`);
}

// ---- A full roll at 400 kt --------------------------------------------------------------------
{
  const { f, s, i } = make();
  airborne(f, s, { h: 4000, V: 400 * KT, a: 1.5, power: 45 });
  f.advance(3);
  i.roll = 1;
  let pMax = 0, nzMax = 0, turned = 0, last = rollOf(s);
  for (let k = 0; k < 60; k++) {
    f.advance(0.025);
    pMax = Math.max(pMax, s.w.x * R2D); nzMax = Math.max(nzMax, Math.abs(s.nz));
    const r = rollOf(s); let d = r - last; if (d < -180) d += 360; if (d > 180) d -= 360; turned += d; last = r;
  }
  i.roll = 0; f.advance(2);
  report(pMax > 250 && pMax < 308 * 1.05 && nzMax < 2.5 && !s.crashed && Math.abs(s.w.x * R2D) < 5,
    'alabeo con la palanca a fondo (TP-1538: hasta 308°/s)', `p máx ${pMax.toFixed(0)}°/s, ${turned.toFixed(0)}° en 1,5 s, |nz| máx ${nzMax.toFixed(2)} g, se detiene al soltar`);
}

// ---- The α limiter: full aft stick at 250 kt ---------------------------------------------------
{
  const { f, s, i } = make();
  airborne(f, s, { h: 4000, V: 250 * KT, a: 5, power: 50 });
  f.advance(2);
  i.pitch = 1;
  let aMax = 0, nzMax = 0;
  for (let k = 0; k < 400; k++) { f.advance(0.025); aMax = Math.max(aMax, s.alpha); nzMax = Math.max(nzMax, s.nz); }
  report(aMax < 27 && aMax > 20 && !s.crashed, 'el limitador de α con la palanca a fondo atrás (TP-1538: ≈25°)', `α máx ${aMax.toFixed(1)}°, nz máx ${nzMax.toFixed(2)} g`);
}

// ---- Supersonic: full afterburner at 11,000 m ---------------------------------------------------
{
  const { f, s, i } = make();
  airborne(f, s, { h: 11000, V: 270, a: 3, power: 100 });
  const vsLoop = pid(0.03, 0.01, -0.5, 0.5);
  let mMax = 0, t15 = null;
  for (let k = 0; k < 4000 && !s.crashed; k++) {
    i.pitch = vsLoop((11000 - s.pos.y) * 0.05 - s.vel.y, 0.05);
    f.advance(0.05);
    mMax = Math.max(mMax, s.mach);
    if (!t15 && s.mach > 1.5) t15 = s.t;
  }
  const finite = Number.isFinite(s.pos.x) && Number.isFinite(s.vel.x);
  report(finite && !s.crashed && t15 && mMax < 2.3, 'supersónico a 11.000 m con postcombustión', `Mach 1,5 a los ${t15?.toFixed(0)} s, máximo ${mMax.toFixed(2)} en 200 s`);
}

// ---- A landing: 3° glide path at 13° α, flare, touchdown, brakes --------------------------------
/** Flies a short final on a 3° path to touch down at x = 0, then brakes; returns what happened. */
function land({ sinkTarget = null } = {}) {
  const { f, s, i } = make();
  // A short final: 60 m up on the 3° path, at 12° α and 145 kt, with the power for it.
  const glide = 3 * D2R, h0 = 60, x0 = -h0 / Math.tan(glide), V0 = 145 * KT;
  airborne(f, s, { h: h0 + CG.y, V: V0, a: 12 - 3, power: 14, gear: true });
  s.pos.x = x0;
  s.vel.set(V0 * Math.cos(glide), -V0 * Math.sin(glide), 0);
  // Flown the way the F-16 is: the stick holds 12° α on the approach (below its 122 m/s
  // crossover the pitch law answers mostly in pitch rate), the throttle holds the 3° path,
  // corrected towards it by height. From 20 m the stick flares, with the throttle still on.
  const aLoop = pid(0.02, 0.01, -0.4, 0.4), gLoop = pid(3, 0.8, -0.2, 0.4);
  let td = null, stop = null, vyBefore = 0, flare = null;
  for (let k = 0; k < 8000 && !s.crashed; k++) {
    const dt = 0.05, hgt = s.pos.y - CG.y;
    if (!td) {
      const V = s.vel.length(), gamma = Math.asin(Math.max(-1, Math.min(1, s.vel.y / V)));
      const path = -s.pos.x * Math.tan(glide);
      if (sinkTarget !== null) {
        // Driven into the ground at a set sink rate.
        i.pitch = aLoop(10 - s.alpha, dt);
        i.throttle = Math.max(0, Math.min(0.77, 0.3 + 4 * (sinkTarget / V - gamma)));
      } else if (hgt > 20) {
        i.pitch = aLoop(12 - s.alpha, dt);
        const gCmd = -glide - Math.max(-0.03, Math.min(0.03, 0.004 * (hgt - path)));
        i.throttle = Math.max(0, Math.min(0.77, 0.22 + gLoop(gCmd - gamma, dt)));
      } else {
        // The flare: the stick raises the nose in proportion to how much faster the airplane
        // sinks than the rate wanted at this height (1.0 m/s at 5 m, 0.4 m/s at the wheels).
        flare ??= i.pitch;
        // Held near 13° of pitch at most: the nozzle's lip strikes at about 14.5°. The throttle
        // keeps working the sink rate down to the wheels (a power-on flare).
        const want = -(0.4 + 0.12 * hgt);
        i.pitch = Math.max(-0.4, Math.min(0.5, flare + 0.08 * (want - s.vel.y) - 0.01 * s.w.y * R2D - 0.25 * Math.max(0, pitchOf(s) - 12.5)));
        i.throttle = Math.max(0, Math.min(0.77, 0.22 + gLoop(want / V - gamma, dt)));
      }
    } else {
      // On the wheels: idle, the nose lowered at about 3°/s, then brakes and speed brakes.
      const th = pitchOf(s);
      i.pitch = th > 1 ? Math.max(-0.2, Math.min(0.8, i.pitch + 0.05 * (-3 - s.w.y * R2D) * dt * 4)) : 0;
      i.throttle = 0; i.speedBrake = 1; i.brake = th > 1 ? 0 : 1;
    }
    vyBefore = s.vel.y;
    f.advance(dt);
    if (!td && s.wow) td = { sink: -vyBefore, kt: s.tas / KT, x: s.pos.x, alpha: s.alpha, pitch: pitchOf(s), t: s.t };
    if (td && s.tas < 0.5) { stop = { x: s.pos.x - td.x, t: s.t }; break; }
  }
  return { td, stop, crashed: s.crashed };
}
{
  const r = land();
  report(r.td && r.stop && !r.crashed && r.td.sink < 3 && r.td.kt > 120 && r.td.kt < 165 && Math.abs(r.td.x) < 600 && r.stop.x < 1500,
    'aterrizaje: senda de 3°, recogida, toma y frenada', r.td ? `toma a los ${r.td.t.toFixed(0)} s a ${r.td.kt.toFixed(0)} kt con ${r.td.sink.toFixed(2)} m/s de descenso y ${r.td.pitch.toFixed(1)}° de cabeceo, ${r.td.x.toFixed(0)} m del punto; para en ${r.stop?.x.toFixed(0)} m${r.crashed ? ` — ${JSON.stringify(r.crashed)}` : ''}` : `sin tomar tierra ${JSON.stringify(r.crashed)}`);
  const hard = land({ sinkTarget: -7 });
  report(!!hard.crashed, 'una toma a 7 m/s rompe el tren o el avión', hard.crashed ? `${hard.crashed.what}, ${hard.crashed.sink.toFixed(1)} m/s` : 'no se detectó');
}

// ---- The simple controls, flown with the visitor's keys ----------------------------------------
function assisted({ setup, plan, T }) {
  const { f, s } = make();
  f.reset({ x: 0, z: 0 });
  const pilot = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1, parking: true, speedBrake: false, gearDown: true };
  const notes = [], A = createF16Assist({ sim: f, pilot, note: (t) => notes.push(t) });
  setup?.(f, s, pilot, A);
  const r = { lift: null, td: null, maxAgl: 0, minAgl: Infinity, airborne: false, stopped: false, notes };
  for (let k = 0; k < T * 30 && !s.crashed; k++) {
    const t = k / 30, kc = calibrated(s.mach, atmosphere(s.pos.y).P) / KT;
    A.step(plan(t, s, kc), 1 / 30, { touchdown: !!r.td });
    Object.assign(f.input, { pitch: pilot.pitch, roll: pilot.roll, yaw: pilot.yaw, throttle: pilot.throttle, brake: pilot.brake, speedBrake: pilot.speedBrake ? 1 : 0, gearDown: pilot.gearDown });
    const vy = s.vel.y;
    f.advance(1 / 30);
    if (!s.wow && s.agl > 2 && !r.lift) r.lift = kc;
    if (!s.wow && s.agl > 5) r.airborne = true;
    if (r.airborne && s.wow && !r.td) r.td = { sink: -vy, kt: kc };
    if (r.airborne && !s.wow) { r.maxAgl = Math.max(r.maxAgl, s.agl); if (t > 25) r.minAgl = Math.min(r.minAgl, s.agl); }
    if (r.td && s.tas < 0.5) { r.stopped = true; break; }
  }
  r.crashed = s.crashed; r.s = s; return r;
}
{
  const r = assisted({ plan: () => ({ gas: 1 }), T: 40 });
  report(!r.crashed && r.lift > 140 && r.lift < 195 && r.maxAgl > 300 && r.s.gear < 0.1,
    'mandos simples: W mantenida desde la cabecera despega sola (rota, se va al aire, sube y recoge el tren), sin estrellarse',
    `despega a ${r.lift?.toFixed(0)} kt, sube a ${(r.maxAgl / 0.3048).toFixed(0)} ft, tren ${r.s.gear.toFixed(2)}${r.crashed ? ', ' + r.crashed.what : ''}`);
}
{
  const r = assisted({ plan: (t) => (t < 25 ? { gas: 1 } : t < 45 ? { down: 1 } : {}), T: 70 });
  report(!r.crashed && r.notes.includes('Auto-GCAS: pull up') && r.minAgl > 60, 'mandos simples: picando hacia el suelo, el Auto-GCAS nivela y tira antes del impacto, con margen',
    `altura mínima ${(r.minAgl / 0.3048).toFixed(0)} ft${r.crashed ? ', ' + r.crashed.what : ''}`);
}
{
  const r = assisted({ plan: (t) => (t < 25 ? { gas: 1 } : t < 45 ? { turn: -1 } : t < 55 ? { turn: 1, shift: 1 } : {}), T: 70 });
  const a = attitude(r.s);
  report(!r.crashed && Math.abs(a.bank) < 10, 'mandos simples: viraje a 60° y a 80°, y al soltar las alas se nivelan', `alabeo final ${a.bank.toFixed(1)}°${r.crashed ? ', ' + r.crashed.what : ''}`);
}
{
  const setup = (f, s, pilot, A) => {
    const V = 150 * KT, g = 3 * D2R;
    s.pos.set(-2200, CG.y + 2200 * Math.tan(g), 0); s.vel.set(V * Math.cos(g), -V * Math.sin(g), 0);
    s.q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 5 * D2R); s.wow = false; s.gear = 1; s.agl = 115;
    s.power = 35; pilot.throttle = 0.55; pilot.parking = false; pilot.brake = 0;
    A.state.gearAuto = true; A.state.gammaCmd = -3;
  };
  const r = assisted({ setup, plan: () => ({}), T: 120 });
  report(!r.crashed && r.td && r.td.sink < 2.5 && r.td.kt > 125 && r.td.kt < 165 && r.stopped,
    'mandos simples: en la senda de 3° con el tren abajo y sin tocar nada, mantiene 150 kt, recoge, toma y se para',
    r.td ? `toma a ${r.td.kt.toFixed(0)} kt con ${r.td.sink.toFixed(2)} m/s de descenso${r.stopped ? ', parado' : ''}` : (r.crashed?.what ?? 'sin toma'));
}

// ---- Audit of 2 Oct 2026: bank, ground, atmosphere, reset ------------------------------------
{
  // Bank over the whole circle (H13): set it, read it back, at several pitches.
  const { s } = make();
  let worst = 0;
  for (const pitch of [-60, -20, 0, 20, 60]) for (const bank of [0, 60, -60, 90, -90, 120, -120, 150, -150, 179, -179]) {
    s.q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch * D2R).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bank * D2R));
    const got = attitude(s).bank, err = Math.abs(((got - bank + 540) % 360) - 180);
    worst = Math.max(worst, err);
  }
  report(worst < 1e-6, 'actitud: el alabeo se lee entero, −180…180° (120° ya no se lee como 60°), con cabeceo de −60 a 60°', `error máx. ${worst.toExponential(1)}°`);
}
{
  // Land and sea do not depend on the curvature (H14): the same answer as the flat terrain, near
  // and far, and a finite height anywhere.
  const { f16Ground, SEA_LEVEL } = await import('../src/core/f16Ground.js');
  const { groundSample } = await import('../src/core/environment.js');
  const { curvatureDrop } = await import('../src/core/outerGround.js');
  let wrong = 0, land = 0, far = 0;
  for (const r of [0, 4000, 10000, 100000, 450000]) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a);
    const g = f16Ground(x, z);
    if (g.hard) continue;
    const sea = groundSample(x, -z).h < SEA_LEVEL;
    if (g.water !== sea) wrong++;
    if (!g.water && r >= 10000) { land++; if (Math.abs(g.h - (groundSample(x, -z).h - curvatureDrop(r))) < 1e-9) far++; }
  }
  const ext = [6371001, 1e8, Infinity].map(curvatureDrop);
  report(wrong === 0 && land > 0 && far === land, 'suelo: tierra o mar se decide antes de la curvatura (a 10–450 km la llanura ya no es mar)', `${wrong} discrepancias · ${land} puntos de tierra lejos`);
  report(ext.every(Number.isFinite), 'curvatura: finita más allá del radio terrestre (antes NaN)', ext.map(v => (v / 1000).toFixed(0) + ' km').join(' · '));
}
{
  // The standard atmosphere above 20 km (H18): 1976 USSA values at geopotential heights.
  const ref = [[20000, 216.65, 5474.89], [30000, 226.65, 1171.87], [32000, 228.65, 868.02], [47000, 270.65, 110.91], [50000, 270.65, 75.94], [71000, 214.65, 3.956]];
  let worst = 0;
  for (const [h, T, P] of ref) { const a = atmosphere(h); worst = Math.max(worst, Math.abs(a.T - T) / T, Math.abs(a.P - P) / P); }
  const mono = [0, 5e3, 11e3, 2e4, 3e4, 5e4, 8e4, 1e5].map(h => atmosphere(h).rho).every((r, i, arr) => i === 0 || r < arr[i - 1]);
  report(worst < 0.002 && mono, 'atmósfera: capas de la estándar de 1976 hasta 86 km (antes, todo por encima de 20 km era 20 km)',
    `error máx. ${(worst * 100).toFixed(3)} % · 30 km ${atmosphere(30000).P.toFixed(0)} Pa`);
}
{
  // A reset airplane is a new airplane (H22): fly, brake to an anchor, reset, compare.
  const fresh = make(); fresh.f.reset({ x: 0, z: 0 });
  const used = make();
  airborne(used.f, used.s, { h: 3000, V: 200, a: 2, power: 60 });
  for (let k = 0; k < 480; k++) used.f.advance(1 / 240);
  used.s.wheels[1].anchor = new THREE.Vector3(5, 0, 5);
  used.f.reset({ x: 0, z: 0 });
  const pick = (s) => JSON.stringify({ ...s, q: s.q.toArray(), pos: s.pos.toArray(), vel: s.vel.toArray(), w: s.w.toArray(), wheels: s.wheels.map(w => ({ ...w, anchor: w.anchor && w.anchor.toArray() })) });
  report(pick(used.s) === pick(fresh.s), 'reset: la telemetría, las ruedas y sus anclajes quedan como en un avión nuevo (antes Mach 0,6 y 40 kN parado)',
    `Mach ${used.s.mach} · empuje ${(used.s.thrust / 1000).toFixed(1)} kN · wow ${used.s.wow}`);
  const a = []; for (let k = 0; k < 240; k++) { used.f.advance(1 / 240); fresh.f.advance(1 / 240); }
  a.push(used.s.pos.distanceTo(fresh.s.pos));
  report(a[0] === 0, 'reset: un segundo después, los dos aviones siguen exactamente en el mismo sitio', `${a[0].toExponential(1)} m`);
}
{
  // Two airplanes stepped side by side give the same answer as each alone: the step's scratch is
  // per airplane (H60).
  const one = make(), two = make(), solo = make();
  for (const m of [one, two, solo]) airborne(m.f, m.s, { h: 2000, V: 180, a: 3, power: 55 });
  two.i.roll = 0.5;
  for (let k = 0; k < 480; k++) { one.f.advance(1 / 240); two.f.advance(1 / 240); solo.f.advance(1 / 240); }
  report(one.s.pos.distanceTo(solo.s.pos) === 0 && one.s.q.equals(solo.s.q), 'dos aviones a la vez no se mezclan sus temporales', `${one.s.pos.distanceTo(solo.s.pos)} m`);
}

// ---- The audit's P1 for the airplane (H15, H16, H20) -------------------------------------------
{
  // H15: far out over the curved ground, the altitude is the height over the sea beneath, along
  // its normal, and gravity points down that normal and falls with height.
  const F = await import('../src/sim/f16Flight.js');
  const R = 6371000, far = F.geodesy(300e3, 5000, 0), near = F.geodesy(0, 5000, 0), high = F.geodesy(0, 10000, 0);
  const tilt = Math.asin(far.nx);
  report(Math.abs(tilt - 300e3 / R) < 0.003 && far.h > 5000 + 6000 && Math.abs(near.nx) < 1e-12 && Math.abs(high.g / 9.80665 - (R / (R + high.h)) ** 2) < 1e-9,
    'marco geodésico: a 300 km la gravedad se inclina con la curvatura y la altura se mide sobre el mar de debajo; g cae con la altura',
    `inclinación ${(tilt * 180 / Math.PI).toFixed(2)}° (r/R ${(300e3 / R * 180 / Math.PI).toFixed(2)}°) · altura ${(far.h / 1e3).toFixed(1)} km sobre el mar a y = 5 km · g a 10 km ${high.g.toFixed(3)} m/s²`);
}
{
  // H16: outside Morelli's fit (α 60°) and above TP-1538's Mach 0.6 the state says so.
  const { f, s } = make();
  f.reset({ x: 0, z: 0 }); s.gear = 0; s.gearCmd = 0; s.wow = false;
  s.pos.set(0, 3000, 0); s.vel.set(100 * Math.cos(60 * D2R), -100 * Math.sin(60 * D2R), 0);
  f.input.gearDown = false; f.advance(1 / 240);
  const hiA = { ...s.domain };
  const g = make(); g.f.reset({ x: 0, z: 0 }); g.s.gear = 0; g.f.input.gearDown = false; g.s.pos.set(0, 3000, 0); g.s.vel.set(300, 0, 0); g.f.advance(1 / 240);
  const fast = { ...g.s.domain };
  const h = make(); h.f.reset({ x: 0, z: 0 }); h.s.gear = 0; h.f.input.gearDown = false; h.s.pos.set(0, 3000, 0); h.s.vel.set(150, 0, 0); h.f.advance(1 / 240);
  report(hiA.alpha && hiA.out && fast.mach && !fast.alpha && !h.s.domain.out, 'dominio de los datos: α de 60° y Mach 0,9 quedan marcados fuera; a Mach 0,45 y α pequeño, dentro',
    `α 60°: ${hiA.alpha} · Mach ${g.s.mach.toFixed(2)}: ${fast.mach} · Mach ${h.s.mach.toFixed(2)}: ${h.s.domain.out ? 'fuera' : 'dentro'}`);
}
{
  // H20: the fuel burns at the engine's consumption and the mass falls with it; out of fuel the engine stops.
  const F = await import('../src/sim/f16Flight.js');
  const { f, s, i } = make();
  f.reset({ x: 0, z: 0 }); i.brake = 1; i.throttle = 1;
  const m0 = s.mass, q0 = s.fuel;
  for (let k = 0; k < 240 * 10; k++) f.advance(1 / 240);
  const burned = q0 - s.fuel, same = Math.abs((m0 - s.mass) - burned) < 1e-6;
  const exp = F.fuelFlow(100, s.thrust) * 1;   // ≈ the last second's flow at full afterburner
  s.fuel = 0.5;
  for (let k = 0; k < 240; k++) f.advance(1 / 240);
  report(burned > 20 && same && s.flameout && s.thrust === 0 && exp > 3,
    'configuración y combustible: el motor gasta según su consumo, la masa baja lo mismo y sin combustible se apaga',
    `${burned.toFixed(0)} kg en 10 s a fondo (${exp.toFixed(1)} kg/s en postcombustión) · apagado ${s.flameout} · ${F.CONFIG.stores}, c.g. ${F.CONFIG.cg} c̄`);
}

console.log(failed ? `\n${failed} comprobación(es) del F-16 fallida(s)` : '\nModelo de vuelo del F-16: todo correcto');
process.exit(failed ? 1 : 0);
