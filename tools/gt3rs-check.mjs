#!/usr/bin/env node
// The Porsche 911 GT3 RS's vehicle model, driven headless (no browser), against Porsche's own
// figures: 0–100, 0–160 and 0–200 km/h and the top speed (technical data, 08/2022), the drag
// area derived from that top speed, the downforce of the press kit; and what a driver does with
// it — a stop from 100 km/h, a steady corner, power oversteer with PSM off, a spin on the spot,
// reverse, the gravel's drag, and the kerbs and verges of the circuit; and driven as the
// keyboard drives it (steerReach, the pedals' ramps): stable with PSM on where a road car is —
// flat out round a corner, braking hard into one — and a drift started with the parking brake
// that the throttle and the counter-steer hold without a spin.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { createGt3Car, CAR, fullTorque, steerReach, OUTLINE } = await import('../src/sim/gt3Car.js');
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
  // Launch Control: brake and throttle held at a standstill (the engine at its launch speed),
  // then the brake let go; the clock starts there.
  s.tc = true; i.throttle = 1; i.brake = 1;
  for (let t = 0; t < 1.5; t += DT) c.step(DT);
  const armed = s.launch, launchRpm = s.rpm;
  i.brake = 0;
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
  report(armed && Math.abs(launchRpm - 5500) < 300, 'Launch Control: parado con freno y gas, el motor espera a su régimen de salida con el embrague abierto', `${launchRpm.toFixed(0)} rpm`);
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
  s.tc = false;
  rolling(s, 30 * KMH, 1);
  i.throttle = 1; i.steer = 0.5;
  let maxSlide = 0, marks = 0;
  for (let t = 0; t < 2; t += DT) {
    c.step(DT);
    maxSlide = Math.max(maxSlide, Math.abs(Math.atan2(s.v, Math.max(1, s.u))) * 180 / Math.PI);
    if (s.slip[2] > 1.15 || s.slip[3] > 1.15) marks++;
  }
  report(maxSlide > 10, 'sobreviraje con gas en 1.ª a 30 km/h (PSM fuera): la zaga desliza más de 10°', `${maxSlide.toFixed(0)}°`);
  report(marks > 100, 'los traseros pasan del pico de agarre (lo que deja marcas)', `${marks} pasos`);
}
{
  const { c, s, i } = make();
  s.tc = false;
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

// ---- Driven as the keyboard drives it --------------------------------------------------------------
/** Keys over time → the drive's pedals and steering (its ramps and steerReach), on flat asphalt. */
function drive({ v0 = 0, gear = 1, psm = true, keys, T = 5 }) {
  const { c, s, i } = make();
  s.tc = psm; rolling(s, v0, gear);
  const d = { throttle: 0, brake: 0, steer: 0 }, F = 1 / 60;
  const ramp = (cur, t, r) => cur + Math.max(-r * F, Math.min(r * F, t - cur));
  let maxBeta = 0, sideways = 0;
  const psi0 = s.psi;
  for (let t = 0; t < T; t += F) {
    const k = keys(t, s);
    d.throttle = ramp(d.throttle, k.w ? 1 : 0, 7); d.brake = ramp(d.brake, k.s ? 1 : 0, 8);
    const dir = (k.a ? 1 : 0) - (k.d ? 1 : 0);
    d.steer = ramp(d.steer, dir * steerReach(s, dir), dir ? 1.8 : 3.0);
    Object.assign(i, { throttle: d.throttle, brake: d.brake, steer: d.steer, handbrake: k.space ? 1 : 0 });
    c.advance(F);
    const b = Math.abs(Math.atan2(s.v, Math.max(1, Math.abs(s.u)))) * 180 / Math.PI;
    maxBeta = Math.max(maxBeta, b);
    if (b > 15 && s.u > 4) sideways += F;
  }
  return { s, maxBeta, sideways, turned: Math.abs(s.psi - psi0) * 180 / Math.PI };
}
{
  const r = drive({ v0: 80 * KMH, gear: 3, keys: () => ({ w: true, a: true }) });
  report(r.maxBeta < 5, 'PSM: a fondo y con todo el volante a 80 km/h, el coche gira sin cruzarse (< 5°)', `${r.maxBeta.toFixed(1)}°`);
}
{
  const on = drive({ v0: 150 * KMH, gear: 5, keys: (t) => ({ s: true, a: t > 0.3 }), T: 4 });
  const off = drive({ v0: 150 * KMH, gear: 5, psm: false, keys: (t) => ({ s: true, a: t > 0.3 }), T: 4 });
  report(on.maxBeta < 8 && off.maxBeta < 15, 'frenando a fondo desde 150 km/h y girando: ABS, EBD y PSM lo mantienen recto de cola (< 8°; sin PSM < 15°)', `${on.maxBeta.toFixed(1)}° · sin PSM ${off.maxBeta.toFixed(1)}°`);
}
{
  // A drifter: Space tapped with A into the corner, then the throttle and counter-steer on the slide angle.
  const drifter = (t, s) => { const b = Math.atan2(s.v, Math.max(1, Math.abs(s.u))); return t < 0.35 ? { space: true, a: true } : { w: true, d: b < -0.35, a: b > -0.12 }; };
  const r = drive({ v0: 60 * KMH, gear: 2, keys: drifter, T: 6 });
  report(r.sideways > 2 && r.maxBeta < 75 && r.s.u > 5, 'derrape con el freno de mano: un toque de Espacio lo inicia y el gas y el contravolante lo sostienen sin trompo', `${r.sideways.toFixed(1)} s cruzado más de 15°, máx. ${r.maxBeta.toFixed(0)}°, sale a ${(r.s.u * 3.6).toFixed(0)} km/h`);
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

// ---- Audit of 2 Oct 2026: the clock, the reset, the loads, the inputs, the drag ----------------
{
  // The same 10 s of full throttle at any frame rate, with and without a jittery frame time:
  // the car's clock keeps the wall clock's to within one step (H01).
  const res = [];
  for (const fps of [30, 60, 75, 90, 120, 144, 165, 240, 360, 500, 1000]) {
    for (const jitter of [0, 0.35]) {
      const { c, s, i } = make();
      i.throttle = 1;
      let wall = 0, k = 0;
      while (wall < 10 - 1e-9) {
        const dt = Math.min(10 - wall, (1 / fps) * (1 + jitter * Math.sin(k++ * 2.3)));
        c.advance(dt); wall += dt;
      }
      res.push({ fps, jitter, t: s.t, kmh: s.u * 3.6 });
    }
  }
  const ref = res.find(r => r.fps === 240 && !r.jitter);
  const worstT = Math.max(...res.map(r => Math.abs(r.t - 10)));
  const worstV = Math.max(...res.map(r => Math.abs(r.kmh - ref.kmh)));
  report(worstT <= DT + 1e-9 && worstV < 0.3, 'reloj: 10 s reales son 10 s del coche a 30–1.000 FPS, con y sin tirones (± un paso)',
    `peor desfase ${(worstT * 1000).toFixed(2)} ms · velocidad ${ref.kmh.toFixed(2)} km/h ± ${worstV.toFixed(3)}`);
  const { c, s } = make();
  const n0 = c.advance(0) + c.advance(-1) + c.advance(NaN) + c.advance(Infinity);
  report(n0 === 0 && s.t === 0, 'reloj: un dt nulo, negativo o no finito no avanza nada', `${n0} pasos`);
  c.advance(5);
  report(Math.abs(s.t - 0.25) < 1e-9, 'reloj: un frame de 5 s (pestaña parada) se recorta a 0,25 s en vez de ejecutarse de golpe', `${s.t.toFixed(3)} s`);
}
{
  // A reset car is a new car (H03): contaminate everything, reset, and compare state and output.
  const run = (c, i) => { i.throttle = 1; for (let k = 0; k < 240; k++) c.step(DT); return c.state; };
  const a = make();
  rolling(a.s, 30, 3); a.i.throttle = 1; a.i.handbrake = 1; a.i.steer = 0.6;
  for (let k = 0; k < 300; k++) a.c.step(DT);
  a.s.tcCut = 0.2; a.s.kap = [0.5, 0.5, 0.5, 0.5]; a.s.abs = true; a.s.load = [1, 2, 3, 4]; a.s.surface = ['water', 'water', 'water', 'water'];
  a.c.reset();
  const b = make();
  const keysA = JSON.stringify(a.s), keysB = JSON.stringify(b.s);
  const inputClean = Object.values(a.i).every(v => !v);
  report(keysA === keysB && inputClean, 'reset: el estado y las entradas quedan idénticos a los de un coche nuevo', keysA === keysB ? 'iguales' : 'distintos');
  const ua = run(a.c, a.i).u, ub = run(b.c, b.i).u;
  report(ua === ub, 'reset: 1 s de gas a fondo da lo mismo que en un coche nuevo', `${ua.toFixed(6)} y ${ub.toFixed(6)} m/s`);
  const p = make(); p.s.tc = false; p.c.reset();
  report(p.s.tc === false, 'reset: el PSM, que es una preferencia del visitante, se conserva', `tc ${p.s.tc}`);
}
{
  // The loads add up to the weight and the downforce, whatever the transfer asks (H04).
  let worst = 0, neg = false;
  for (const u of [0, 20, 40, 80]) for (const ax of [-40, -15, 0, 15, 40]) for (const ay of [-45, -20, 0, 20, 45]) {
    const { c, s } = make();
    rolling(s, u, 4); s.ax = ax; s.ay = ay;
    c.step(DT);
    const down = 0.5 * AERO.rho * u * u * AERO.clA * (s.drs ? AERO.drsClFactor : 1);
    const sum = s.load.reduce((x, y) => x + y, 0), want = CAR.m * 9.80665 + down;
    worst = Math.max(worst, Math.abs(sum - want) / want);
    if (s.load.some(l => l < 0)) neg = true;
  }
  report(worst < 1e-9 && !neg, 'cargas: nunca negativas y siempre suman peso + carga aerodinámica (barrido hasta 45 m/s²)', `error máx. ${(worst * 100).toExponential(1)} %`);
}
{
  // Inputs that are not numbers are zeroed at the boundary (H12).
  const { c, s, i } = make();
  rolling(s, 20, 3);
  Object.assign(i, { throttle: NaN, brake: Infinity, steer: -Infinity, handbrake: undefined });
  for (let k = 0; k < 240; k++) c.step(DT);
  const ok = ['x', 'z', 'u', 'v', 'r', 'rpm'].every(k => Number.isFinite(s[k])) && s.w.every(Number.isFinite);
  report(ok && i.brake === 0 && i.throttle === 0 && i.steer === 0, 'entradas no finitas (NaN, ±Infinity, undefined): se anulan y el estado sigue finito', `u ${s.u.toFixed(2)} m/s`);
}
{
  // A car sliding sideways meets the air too (H11): sideways speed bleeds off even with the
  // tyres taken out of it (zero grip), where before only the longitudinal speed felt drag.
  const { c, s } = make(flat(0));
  s.v = 30;
  for (let k = 0; k < 240; k++) c.step(DT);
  // ½ρ·CdA·v²/m ≈ 0.31 m/s² at 30 m/s: ≈ 29.7 m/s after a second (before, it stayed at 30).
  report(s.v < 29.8 && s.v > 29.5, 'arrastre: también se opone a la velocidad lateral en un derrape (sin agarre, 1 s a 30 m/s ≈ 29,7)', `${s.v.toFixed(2)} m/s`);
}

// ---- The audit's P1: the ground, the suspension, the engine, the aids, the contacts -----------------
{
  // On a 10 % grade, standing with no pedal, the car rolls back; the brake holds it (H02).
  const slope = () => (x) => ({ h: 0.1 * x, mu: 1, roll: 0, kind: 'track' });
  const g = slope();
  const { c, s } = make((x) => g(x));
  for (let k = 0; k < 480; k++) c.step(DT);
  const back = s.u;
  const h = make((x) => g(x)); h.i.brake = 1;
  for (let k = 0; k < 480; k++) h.c.step(DT);
  report(back < -1.2 && Math.abs(h.s.u) < 0.05, 'pendiente del 10 %: sin pedales el coche cae hacia atrás; frenado, se queda', `${back.toFixed(2)} m/s en 2 s · frenado ${h.s.u.toFixed(3)} m/s`);
}
{
  // Over a crest taken fast the car leaves the ground, carries nothing on its tyres in the air and
  // lands (H02): a 2 m ramp over 12 m, then the ground falls away.
  const ramp = (x) => ({ h: x > 0 && x < 12 ? x / 6 : 0, mu: 1, roll: 0, kind: 'track' });
  const { c, s } = make(ramp);
  c.reset({ x: -40 }); rolling(s, 110 * KMH, 3);
  let air = 0, airLoad = 0, landed = false, peak = 0;
  for (let k = 0; k < 240 * 4; k++) {
    c.step(DT);
    if (s.air > 0) { air = Math.max(air, s.air); airLoad = Math.max(airLoad, ...s.load); peak = Math.max(peak, s.y); }
    if (air > 0 && s.air === 0) landed = true;
  }
  const finite = [s.x, s.u, s.y, s.hz, ...s.load].every(Number.isFinite);
  report(air > 0.3 && airLoad < 1 && landed && finite, 'salto: por una cresta a 110 km/h despega, en el aire las ruedas no cargan nada y aterriza', `${air.toFixed(2)} s en el aire, a ${peak.toFixed(2)} m · carga máx. en el aire ${airLoad.toFixed(0)} N`);
}
{
  // A twisted ground (one diagonal higher) loads that diagonal (H02).
  const twist = (x, z) => ({ h: 0.02 * x * z, mu: 1, roll: 0, kind: 'track' });
  const { c, s } = make(twist);
  for (let k = 0; k < 240; k++) c.step(DT);
  const d = s.load[1] + s.load[2] - (s.load[0] + s.load[3]);
  report(Math.abs(d) > 500, 'suelo alabeado: una diagonal carga más que la otra', `${d.toFixed(0)} N de diferencia`);
}
{
  // Ackermann: at full lock the inner front wheel turns tighter than the outer (H08).
  const { c, s, i } = make();
  rolling(s, 3, 1); i.steer = 1;
  for (let k = 0; k < 240; k++) c.step(DT);
  report(s.steerW[0] > s.steerW[1] + 0.02, 'Ackermann: con todo el volante a la izquierda, la delantera izquierda gira más que la derecha', `${(s.steerW[0] * 57.3).toFixed(1)}° y ${(s.steerW[1] * 57.3).toFixed(1)}°`);
}
{
  // The active aerodynamics: DRS on a straight, the airbrake hard on the brakes from speed (H09).
  const { c, s, i } = make();
  rolling(s, 200 * KMH, 5); i.brake = 1;
  c.step(DT);
  const ab = s.aero;
  const d0 = make(); rolling(d0.s, 200 * KMH, 5); d0.i.brake = 0.3; d0.c.step(DT);
  report(ab === 'airbrake' && d0.s.aero === 'normal', 'aerodinámica activa: aerofreno al frenar fuerte a 200 km/h; normal con un toque de freno', `${ab} · ${d0.s.aero}`);
}
{
  // The engine on its own inertia (H06): through a downshift under braking the PDK blips it up to
  // the lower gear's speed; and pulling away without Launch Control the clutch takes up the drive
  // as the engine gathers revs, so the car starts later than launched.
  const { c, s, i } = make();
  rolling(s, 70 * KMH, 3); s.rpm = 70 * KMH / CAR.rr * GEARBOX.ratios[2] * GEARBOX.final * 60 / (2 * Math.PI);
  i.brake = 0.4;
  let before = 0, peak = 0, seen = false;
  for (let k = 0; k < 240 * 3 && !seen; k++) {
    const g0 = s.gear; const r0 = s.rpm;
    c.step(DT);
    if (s.gear < g0) { before = r0; peak = r0; for (let m = 0; m < 30; m++) { c.step(DT); peak = Math.max(peak, s.rpm); } seen = true; }
  }
  report(seen && peak > before + 800, 'motor con inercia: al reducir frenando, el golpe de gas sube el motor al régimen de la marcha inferior', `${before.toFixed(0)} → ${peak.toFixed(0)} rpm`);
  const a = make(); a.s.tc = true; a.i.throttle = 1;
  let t1 = 0; while (a.s.u < 50 * KMH && t1 < 5) { a.c.step(DT); t1 += DT; }
  const b = make(); b.s.tc = true; b.i.throttle = 1; b.i.brake = 1;
  for (let k = 0; k < 360; k++) b.c.step(DT);
  b.i.brake = 0;
  let t2 = 0; while (b.s.u < 50 * KMH && t2 < 5) { b.c.step(DT); t2 += DT; }
  report(t1 > t2 + 0.1, 'salida: sin Launch Control el coche tarda más que con él (el motor sube de vueltas mientras el embrague coge)', `0–50 km/h en ${t1.toFixed(2)} s frente a ${t2.toFixed(2)} s`);
}
{
  // The paddles (the PDK's manual mode): a pull is one gear; a downshift that would over-rev the
  // engine is refused; on the paddles the gearbox never shifts up by itself (the engine runs into
  // its limiter), and the mode survives a reset like PSM.
  const { c, s, i } = make(); s.paddles = true; i.throttle = 1;
  for (let k = 0; k < 240 * 6; k++) c.step(DT);
  const held = s.gear, limiter = s.rpm;
  i.shiftUp = true; for (let k = 0; k < 60; k++) c.step(DT);
  const up = s.gear;
  i.throttle = 0;
  const m2 = make(); m2.s.paddles = true; rolling(m2.s, 150 * KMH, 3); m2.i.shiftDown = true; m2.c.step(DT);
  const refused = m2.s.gear === 3 && m2.s.refused > 0;
  const m3 = make(); m3.s.paddles = true; rolling(m3.s, 150 * KMH, 5); m3.i.shiftDown = true; m3.c.step(DT);
  const taken = m3.s.gear === 4;
  c.reset();
  report(held === 1 && limiter > ENGINE.maxRpm - 400 && up === 2 && refused && taken && s.paddles, 'levas: una marcha por toque, la reducción que pasaría del corte se rechaza, en manual no sube sola y el modo sobrevive al reset', `en 1.ª a ${limiter.toFixed(0)} rpm · sube a ${up}.ª · 5.ª→4.ª ${taken} · 3.ª→2.ª a 150 km/h rechazada ${refused}`);
}
{
  // The aids are their own module, driven here alone (H07): traction control cuts the drive as the
  // rears spin past their peak, and stability control brakes the outer front when the car oversteers.
  const A = await import('../src/sim/gt3Assists.js');
  const st = { kap: [0, 0, 0.30, 0.30], tcCut: 1 };
  for (let k = 0; k < 30; k++) A.tractionControl(st, true, 0.10, DT);
  const car = { u: 25, v: -2, r: 0.9, steer: 0.05, reverse: false, tc: true, drift: 0, esc: 0 };
  const aid = A.stability(car, { brake: 0, handbrake: 0 }, true, Math.atan2(car.v, car.u), { L: CAR.L, tf: CAR.tf, tr: CAR.tr, R: [CAR.rf, CAR.rf, CAR.rr, CAR.rr], mu: 1.48 });
  report(st.tcCut < 0.3 && aid.brake[1] > 0 && aid.brake[0] === 0, 'ayudas en su propio módulo: el control de tracción corta con las traseras patinando y el de estabilidad frena la delantera exterior al sobrevirar', `corte ${st.tcCut.toFixed(2)} · freno delantera derecha ${aid.brake[1].toFixed(0)} N·m`);
}
{
  // Contacts (H10): driven into a post at 50 km/h the car stops against it and bounces back a
  // little, never through it; a glancing blow turns it.
  const post = [{ x: 20, z: 0, r: 0.3 }];
  const c = createGt3Car({ ground: flat(), obstacles: () => post }); c.reset();
  const s = c.state; rolling(s, 50 * KMH, 2);
  let impact = 0, worst = Infinity;
  for (let k = 0; k < 240 * 3; k++) {
    c.step(DT); impact = Math.max(impact, s.impact);
    worst = Math.min(worst, 20 - 0.3 - (s.x + OUTLINE.front));
  }
  report(impact > 10 && s.u < 0.5 && worst > -0.05, 'choque de frente contra un poste a 50 km/h: se detiene contra él y no lo atraviesa', `cierre ${impact.toFixed(1)} m/s · penetración máx. ${Math.max(0, -worst * 100).toFixed(1)} cm · sale a ${(s.u * 3.6).toFixed(1)} km/h`);
  const g2 = createGt3Car({ ground: flat(), obstacles: () => [{ x: 20, z: -0.95, r: 0.3 }] }); g2.reset();
  rolling(g2.state, 50 * KMH, 2);
  let yaw = 0;
  for (let k = 0; k < 240 * 2; k++) { g2.step(DT); yaw = Math.max(yaw, Math.abs(g2.state.r)); }
  report(yaw > 0.3, 'golpe de refilón en la esquina: el impulso hace girar el coche', `${yaw.toFixed(2)} rad/s`);
}
{
  // A fence (core/colliders.js gives the scene's solid geometry as small cells, ≈0.19 m circles
  // a quarter of a metre apart): driven at it at 250 km/h, the car must not step through it
  // between two checks of the contacts.
  const fence = []; for (let z = -6; z <= 6; z += 0.25) fence.push({ x: 30, z, r: 0.19 });
  const c = createGt3Car({ ground: flat(), obstacles: () => fence }); c.reset();
  const s = c.state; rolling(s, 250 * KMH, 6);
  let worst = Infinity;
  for (let k = 0; k < 240 * 2; k++) { c.step(DT); worst = Math.min(worst, 30 - (s.x + OUTLINE.front)); }
  report(worst > -0.25 && s.x < 30, 'contra una valla fina a 250 km/h: no la atraviesa entre dos comprobaciones', `penetración máx. ${Math.max(0, -worst * 100).toFixed(0)} cm · morro a ${(s.x + OUTLINE.front).toFixed(2)} m de los postes`);
}
{
  // Water (core/water.js; the user's report of 2 Oct 2026: the car drove over the pools and the
  // sea as if they were dry). Down a beach into the sea at 60 km/h, throttle held: the water
  // stops it within a few tens of metres, the engine drowns, it floats a while, floods and goes down.
  const beach = (x) => { const h = x > 10 ? -Math.min(9, (x - 10) * 0.12) : 0; return { h, mu: h < 0 ? 0.6 : 1, roll: h < 0 ? 0.2 : 0, kind: h < 0 ? 'sand' : 'track', water: h < -0.9 ? -0.9 : null }; };
  const { c, s, i } = make(beach);
  rolling(s, 60 * KMH, 2); i.throttle = 1;
  let floated = false, tFlood = null;
  for (let k = 0; k < 240 * 120; k++) {
    c.step(DT);
    if (s.afloat) floated = true;
    if (tFlood === null && s.sunk) tFlood = k * DT;
  }
  report(s.x < 70 && s.drowned && floated && tFlood !== null && tFlood > 20 && Math.abs(s.u) < 0.5,
    'al mar: el agua lo frena, el motor se ahoga, flota un rato, se inunda y se hunde',
    `se para a ${(s.x - 10).toFixed(1)} m de la orilla · flotó: ${floated} · hundido a los ${tFlood?.toFixed(0)} s · motor ahogado: ${s.drowned}`);
}
{
  // The pools (terrain.js: their beds carved under the water). A quarter of a metre deep and
  // crossed at 80 km/h: the water drags the car down hard, the tyres ploughing and the body
  // pushing, and with the throttle it climbs out the far side, its engine running. Forty
  // centimetres deep (the middle of the deepest): the body floats on what it displaces and the
  // tyres lose their grip, as little water does to a car (the US National Weather Service's
  // "Turn Around Don't Drown": a foot of moving water carries most cars away).
  const cross = (depth) => {
    const pool = (x) => (x > 20 && x < 60 ? { h: 0.06 - depth, mu: 0.55, roll: 0.06, kind: 'grass', water: 0.06 } : { h: 0, mu: 0.55, roll: 0.06, kind: 'grass' });
    const { c, s, i } = make(pool);
    rolling(s, 80 * KMH, 3);
    let vMin = Infinity, t = 0, floated = false;
    for (let k = 0; k < 240 * 30 && s.x < 70; k++) {
      c.step(DT); t += DT;
      if (s.x > 22 && s.x < 58) { vMin = Math.min(vMin, s.u); i.throttle = s.u < 4 ? 0.6 : 0; floated ||= s.afloat; }
    }
    return { vMin, out: s.x >= 70, t, floated, drowned: s.drowned };
  };
  const a = cross(0.25), b = cross(0.40);
  report(a.vMin < 0.6 * 80 * KMH && a.out && !a.drowned && !a.floated && b.floated && !b.out,
    'charcas: a 0,25 m el agua lo frena con fuerza y sale por el otro lado con el motor en marcha; a 0,40 m flota y se queda',
    `0,25 m: mínimo ${(a.vMin * 3.6).toFixed(0)} km/h, fuera a los ${a.t.toFixed(1)} s · 0,40 m: flota ${b.floated}, sale ${b.out}`);
}
{
  // Aquaplaning (Horne's rule, ≈94 km/h at ≈2,2 bar): on a centimetre of water the tyres hold a
  // turn at 60 km/h but let go at 150.
  const wet = () => ({ h: 0, mu: 1, roll: 0, kind: 'track', water: 0.01 });
  const lat = (v) => {
    const { c, s, i } = make(wet);
    rolling(s, v * KMH, v > 100 ? 4 : 2); i.steer = 0.25;
    let ay = 0;
    for (let k = 0; k < 240 * 1.5; k++) { c.step(DT); ay = Math.max(ay, Math.abs(s.ay)); }
    return ay;
  };
  const slow = lat(60), fast = lat(150);
  report(slow > 3 && fast < slow * 0.6, 'aquaplaning sobre 1 cm de agua: agarra a 60 km/h y lo pierde a 150',
    `aceleración lateral ${slow.toFixed(1)} m/s² a 60 km/h · ${fast.toFixed(1)} m/s² a 150`);
}

void GEARBOX; void BODY;
console.log(failed ? `\n${failed} fallo(s) en el modelo del GT3 RS` : '\nModelo del GT3 RS: todo correcto');
process.exit(failed ? 1 : 0);
