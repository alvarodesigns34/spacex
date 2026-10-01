#!/usr/bin/env node
// The F-16's flight model, flown headless (no browser): the published numbers it is built on, and
// what it does with them — at rest on the gear, a take-off, level flight, a full roll, the α
// limiter, supersonic flight, a landing and a landing too hard for the gear. Each case is flown by
// a small autopilot working the same inputs a player has (stick, throttle, rudder, brakes).
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const THREE = await import('three');
const { createF16Flight, thrust, atmosphere, CG } = await import('../src/sim/f16Flight.js');
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

console.log(failed ? `\n${failed} comprobación(es) del F-16 fallida(s)` : '\nModelo de vuelo del F-16: todo correcto');
process.exit(failed ? 1 : 0);
