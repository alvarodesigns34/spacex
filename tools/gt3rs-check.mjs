#!/usr/bin/env node
// The Porsche 911 GT3 RS's vehicle model, driven headless (no browser), against Porsche's own
// figures: 0–100, 0–160 and 0–200 km/h and the top speed (technical data, 08/2022), the drag
// area derived from that top speed, the downforce of the press kit; and what a driver does with
// it — a stop from 100 km/h, a steady corner, power oversteer with the traction control off, a
// spin on the spot, reverse, the gravel's drag, and the kerbs and verges of the circuit.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { createGt3Car, CAR, fullTorque } = await import('../src/sim/gt3Car.js');
const { ENGINE, GEARBOX, PERFORMANCE, AERO, BODY } = await import('../src/data/gt3rs.js');
const { circuitSurface } = await import('../src/core/circuit.js');
const { toWorld, LAP, CENTRE } = await import('../src/core/circuitPlan.js');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const KMH = 1 / 3.6, DT = 1 / 240;
const flat = (mu = 1, roll = 0, kind = 'track') => () => ({ h: 0, mu, roll, kind });
const make = (ground = flat()) => { const c = createGt3Car({ ground }); c.reset(); return { c, s: c.state, i: c.input }; };
/** Rolling at speed v in gear g, wheels turning with the road. */
const rolling = (s, v, g) => { s.u = v; s.gear = g; s.w = s.w.map((_, k) => v / (k < 2 ? CAR.rf : CAR.rr)); };

// ---- The published numbers, as used ----------------------------------------------------------
{
  const pw = fullTorque(ENGINE.powerRpm) * ENGINE.powerRpm * 2 * Math.PI / 60;
  report(fullTorque(ENGINE.torqueRpm) === ENGINE.torque && Math.abs(pw - ENGINE.power) / ENGINE.power < 0.002,
    'motor: 465 Nm a 6.300 rpm y 386 kW a 8.500 rpm en la curva de plena carga', `${fullTorque(ENGINE.torqueRpm)} Nm · ${(pw / 1000).toFixed(1)} kW`);
  report(fullTorque(ENGINE.maxRpm + 1) === 0, 'motor: corte a 9.000 rpm', `${fullTorque(ENGINE.maxRpm + 1)} Nm a 9.001`);
  const kg = (v) => 0.5 * AERO.rho * AERO.clA * v * v / 9.80665;
  const [[v1, m1], [v2, m2]] = AERO.downforce;
  report(Math.abs(kg(v1) - m1) / m1 < 0.05 && Math.abs(kg(v2) - m2) / m2 < 0.05,
    'carga aerodinámica: 409 kg a 200 km/h y 860 kg a 285 km/h (dossier) con el ClA derivado', `${kg(v1).toFixed(0)} y ${kg(v2).toFixed(0)} kg`);
}

// ---- Acceleration and top speed, as Porsche measures them: launch control, PSM on ----------------
{
  const { c, s, i } = make();
  s.tc = true; i.throttle = 1;
  const at = {};
  let top = 0;
  for (let t = 0; t < 120; t += DT) {
    c.step(DT);
    const kmh = s.u * 3.6;
    for (const [v] of PERFORMANCE.accel) if (at[v] === undefined && s.u >= v) at[v] = t;
    top = Math.max(top, kmh);
  }
  for (const [v, want] of PERFORMANCE.accel) {
    const got = at[v];
    report(got !== undefined && Math.abs(got - want) / want < 0.05, `0–${Math.round(v * 3.6)} km/h en ${want} s (±5 %)`, `${got?.toFixed(2)} s`);
  }
  report(Math.abs(top - PERFORMANCE.topSpeed * 3.6) < 4, `velocidad máxima ${Math.round(PERFORMANCE.topSpeed * 3.6)} km/h (±4), en 7.ª con el DRS`, `${top.toFixed(1)} km/h, ${s.gear}.ª, ${s.rpm.toFixed(0)} rpm, DRS ${s.drs}`);
  report(s.rpm < ENGINE.maxRpm && s.gear === 7, 'a la máxima, por debajo del corte: la resistencia la limita, no el motor', `${s.rpm.toFixed(0)} rpm`);
}

// ---- Braking and cornering ------------------------------------------------------------------------
{
  const { c, s, i } = make();
  rolling(s, 100 * KMH, 3);
  i.brake = 1;
  const x0 = s.x;
  let t = 0;
  while (s.u > 0.05 && t < 10) { c.step(DT); t += DT; }
  const d = s.x - x0;
  // Not published by Porsche: a modern track car on its tyres stops from 100 km/h in 29–33 m.
  report(d > 25 && d < 34, 'frenada 100–0 km/h con ABS: 25–34 m (≈, no publicada)', `${d.toFixed(1)} m en ${t.toFixed(2)} s`);
}
{
  const { c, s, i } = make();
  rolling(s, 22, 3);
  let best = 0;
  for (let st = 0.02; st <= 0.4; st += 0.01) {
    i.steer = st;
    for (let k = 0; k < 480; k++) { i.throttle = s.u < 22 ? 0.6 : 0.2; c.step(DT); }
    best = Math.max(best, Math.abs(s.u * s.r));
  }
  report(best / 9.81 > 1.1 && best / 9.81 < 1.5, 'curva estable a 80 km/h: 1,1–1,5 g laterales (≈, neumáticos de pista)', `${(best / 9.81).toFixed(2)} g`);
}

// ---- Drifting: power oversteer with the TC off, a spin, reverse ---------------------------------------
{
  const { c, s, i } = make();
  rolling(s, 60 * KMH, 2);
  i.throttle = 1; i.steer = 0.5;
  let maxSlide = 0, marks = 0;
  for (let t = 0; t < 2; t += DT) {
    c.step(DT);
    maxSlide = Math.max(maxSlide, Math.abs(Math.atan2(s.v, Math.max(1, s.u))) * 180 / Math.PI);
    if (s.slip[2] > 1.15 || s.slip[3] > 1.15) marks++;
  }
  report(maxSlide > 10, 'sobreviraje con gas (control de tracción fuera): la zaga desliza más de 10°', `${maxSlide.toFixed(0)}°`);
  report(marks > 100, 'los traseros pasan del pico de agarre (lo que deja marcas)', `${marks} pasos`);
}
{
  const { c, s, i } = make();
  i.throttle = 1; i.steer = -1;
  const psi0 = s.psi;
  for (let t = 0; t < 4; t += DT) c.step(DT);
  const turns = Math.abs(s.psi - psi0) / (2 * Math.PI);
  report(turns > 0.8 && Math.hypot(s.x, s.z) < 40, 'trompo en el sitio a fondo y con todo el volante', `${turns.toFixed(2)} vueltas, a ${Math.hypot(s.x, s.z).toFixed(0)} m`);
}
{
  const { c, s, i } = make();
  i.reverse = true; i.throttle = 0.35;
  for (let t = 0; t < 3; t += DT) c.step(DT);
  report(s.reverse && s.u < -2, 'marcha atrás desde parado', `${(s.u * 3.6).toFixed(0)} km/h`);
}
{
  // Gravel: the same car rolling at 80 km/h stops much sooner off-throttle in a trap.
  const coast = (ground) => { const { c, s } = make(ground); rolling(s, 80 * KMH, 3); let t = 0; while (s.u > 1 && t < 30) { c.step(DT); t += DT; } return s.x; };
  const road = coast(flat()), trap = coast(flat(0.45, 0.22, 'gravel'));
  report(trap < road * 0.3, 'la grava frena el coche: en punto muerto se para mucho antes que en el asfalto', `${trap.toFixed(0)} m frente a ${road.toFixed(0)} m`);
}
{
  // Never NaN, never through the ground, after a minute of everything at once.
  const { c, s, i } = make();
  for (let t = 0; t < 60; t += DT) {
    i.throttle = (Math.sin(t * 0.7) + 1) / 2; i.brake = t % 9 < 1 ? 1 : 0; i.steer = Math.sin(t * 1.3); i.handbrake = t % 13 < 0.6 ? 1 : 0;
    c.step(DT);
  }
  const ok = [s.x, s.z, s.u, s.v, s.r, s.rpm, ...s.w].every(Number.isFinite);
  report(ok, 'un minuto de mandos al azar: todo finito', `x ${s.x.toFixed(0)} z ${s.z.toFixed(0)} · ${(s.u * 3.6).toFixed(0)} km/h`);
}

// ---- The circuit's surfaces ----------------------------------------------------------------------
{
  const mid = CENTRE[Math.floor(CENTRE.length * 0.1)];
  const [x, z] = toWorld(mid.u, mid.v);
  const s0 = circuitSurface(x, z);
  report(s0?.kind === 'track' && Math.abs(LAP - 2505.5) < 1, 'el circuito: asfalto en el eje, 2.505 m por vuelta', `${s0?.kind} · ${LAP.toFixed(1)} m`);
  const kinds = new Set();
  for (const p of CENTRE.filter((_, k) => k % 3 === 0)) for (const d of [-6.8, 6.8, -12, 12, -20, 20]) {
    const [xx, zz] = toWorld(p.u - Math.sin(p.h) * d, p.v + Math.cos(p.h) * d);
    const k = circuitSurface(xx, zz)?.kind;
    if (k) kinds.add(k);
  }
  report(['kerb', 'verge', 'gravel'].every(k => kinds.has(k)), 'pianos, arcenes y grava junto a la pista', [...kinds].join(', '));
}

void GEARBOX; void BODY;
console.log(failed ? `\n${failed} fallo(s) en el modelo del GT3 RS` : '\nModelo del GT3 RS: todo correcto');
process.exit(failed ? 1 : 0);
