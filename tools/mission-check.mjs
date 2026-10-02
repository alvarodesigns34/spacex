#!/usr/bin/env node
// Flight 14 as the simulation tells it, headless: the re-entry's table is continuous where the
// glide starts (it jumped ≈380 m at the entry interface), and where each milestone and engine
// count comes from is kept apart — flight 14's published timeline, this model's own numbers, and
// this demonstration's hypothetical catch (audit of 2 Oct 2026, H26, H27, H35).
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { MILESTONES, BOOSTER_COUNTS, EVENTS } = await import('../src/sim/launch.js');
const { RE, reentryState, MILESTONES_RE } = await import('../src/sim/reentryFlight.js');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- The re-entry table: continuous through the entry interface and its first cells ----------
{
  let worstS = 0, worstH = 0;
  for (const t of [RE.entry, RE.entry + 0.05, RE.entry + 0.1, RE.entry + 1, RE.transonic, RE.subsonic]) {
    for (const e of [1e-6, 1e-4]) {
      const a = reentryState(t - e), b = reentryState(t + e);
      // What it moved beyond what its speed allows in 2ε: a jump in the table.
      worstS = Math.max(worstS, Math.abs(b.s - a.s) - Math.hypot(a.vx, a.vh) * 2 * e * 1.01);
      worstH = Math.max(worstH, Math.abs(b.h - a.h));
    }
  }
  const e0 = reentryState(RE.entry);
  // Over ±1e-4 s the ship moves ≈1.5 m at 7.7 km/s: a jump would be hundreds.
  report(worstS < 2 && worstH < 0.1 && Math.abs(e0.s) < 1e-6 && Math.abs(e0.h - 120000) < 1e-3,
    'reentrada: posición continua en la interfaz de entrada y en sus primeras celdas (antes saltaba ≈380 m y 10,6 m)',
    `salto máx. ${worstS.toFixed(3)} m en el recorrido, ${worstH.toFixed(4)} m en altura · en la entrada s ${e0.s.toFixed(4)} m, h ${e0.h.toFixed(2)} m`);
  const v0 = reentryState(RE.entry - 1e-6), v1 = reentryState(RE.entry + 1e-6);
  report(Math.abs(Math.hypot(v1.vx, v1.vh) - Math.hypot(v0.vx, v0.vh)) < 0.05, 'reentrada: velocidad continua en la entrada', `${Math.hypot(v0.vx, v0.vh).toFixed(2)} → ${Math.hypot(v1.vx, v1.vh).toFixed(2)} m/s`);
}

// ---- One mission state from the cutoff to the entry interface (audit H28, H30, H33) ------------
{
  const M = await import('../src/sim/mission.js');
  const { SHIP_ASSUMED } = await import('../src/sim/launch.js');
  const R = await import('../src/sim/reentryFlight.js');
  const C = M.missionChain(), G0 = 9.80665;
  // Orbital at cutoff (flight 14 was), on the orbit the re-entry starts from.
  report(C.orbit.perigee > 150e3 && Math.abs(C.orbit.apogee - SHIP_ASSUMED.holdAltitude) < 1e3,
    'misión: al corte la nave queda en órbita (perigeo por encima de la interfaz), la de la que parte la reentrada', `${(C.orbit.apogee / 1e3).toFixed(1)} × ${(C.orbit.perigee / 1e3).toFixed(1)} km`);
  // The coast keeps the orbit's energy and angular momentum: the state at the burn lies on it.
  const atB = C.burn.at, eB = atB.v ** 2 / 2 - M.MU / atB.r, hB = atB.r * atB.v * Math.cos(atB.gamma);
  report(Math.abs(eB - C.orbit.energy) / Math.abs(C.orbit.energy) < 1e-9 && Math.abs(hB - C.orbit.hAng) / C.orbit.hAng < 1e-9,
    'misión: el vuelo libre de T+8:11 al encendido de salida conserva energía y momento angular', `ΔE/E ${((eB - C.orbit.energy) / C.orbit.energy).toExponential(1)}`);
  // The burn: propellant from the thrust and the Isp, Δv from the rocket equation, mass carried on.
  const prop = M.MISSION.deorbit.thrust * 11 / (M.MISSION.deorbit.isp * G0);
  const dv = M.MISSION.deorbit.isp * G0 * Math.log(C.burn.m0 / C.burn.m1);
  report(Math.abs(C.burn.propellant - prop) < 1e-6 && Math.abs(C.burn.dv - dv) < 1e-9 && Math.abs(C.cutoff.m - M.MISSION.payload - C.burn.propellant - C.entry.m) < 1e-6
    && Math.abs(R.entryState().m - C.entry.m) < 1e-9 && Math.abs(R.entryState().v - C.entry.v) < 1e-9,
    'misión: la masa en la entrada es la del corte menos el propelente del encendido de salida, y la reentrada parte de ese estado',
    `${(C.cutoff.m / 1e3).toFixed(1)} t − ${(C.burn.propellant / 1e3).toFixed(1)} t = ${(C.entry.m / 1e3).toFixed(1)} t · Δv ${C.burn.dv.toFixed(1)} m/s · ${C.entry.v.toFixed(0)} m/s a ${(C.entry.gamma * 180 / Math.PI).toFixed(2)}°`);
  // The time the chain reaches the interface is a prediction against the cited one: the gap is
  // measured and reported, not hidden (the orbit and the ship's mass are not published).
  const gap = C.entry.t - R.RE.entry;
  report(Number.isFinite(gap) && Math.abs(gap) < 45 * 60, 'misión: la hora prevista de la interfaz se compara con la citada (discrepancia medida, no ocultada)',
    `prevista T+${(C.entry.t / 3600).toFixed(0)}:${String(Math.floor(C.entry.t / 60) % 60).padStart(2, '0')}:${String(Math.round(C.entry.t % 60)).padStart(2, '0')} frente a la citada T+9:28:56 · ${(gap / 60).toFixed(1)} min`);
  // The landing burn the re-entry flies: within three sea-level Raptors' thrust at that mass, and
  // within the propellant left (H33).
  let worst = 0, dvBurn = 0;
  const T = (t) => { const s = R.reentryState(t); return Math.hypot(s.ax, s.ah + G0); };
  for (let t = R.RE.landingBurn; t < R.RE.splash; t += 0.05) { const a = T(t); worst = Math.max(worst, a); dvBurn += a * 0.05; }
  const aMax = 3 * 250e3 * G0 / C.entry.m, fuel = C.entry.m * (1 - Math.exp(-dvBurn / (350 * G0))), left = C.cutoff.m - SHIP_ASSUMED.dry - C.burn.propellant;
  report(worst < aMax && fuel < left, 'aterrizaje: el encendido pide menos empuje que el de tres Raptor a esa masa y menos propelente del que queda',
    `${(worst / G0).toFixed(2)} g de ${(aMax / G0).toFixed(2)} · ${(fuel / 1e3).toFixed(1)} t de ${(left / 1e3).toFixed(1)} t`);
}

{
  // The lift rolled out of the vertical plane is no longer thrown away (H32): what it would carry
  // the ship sideways, the bank never reversed, is followed and reported as a bound.
  const R = await import('../src/sim/reentryFlight.js');
  const S = R.reentrySummary();
  report(S.crossRangeBound > 50e3 && S.crossRangeBound < S.range, 'reentrada: el alcance lateral de la sustentación inclinada se integra (cota sin invertir el alabeo)', `${(S.crossRangeBound / 1e3).toFixed(0)} km de lado frente a ${(S.range / 1e3).toFixed(0)} km de recorrido`);
}

// ---- Provenance of the milestones ------------------------------------------------------------
{
  // A milestone flight 14 did not have can never carry flight 14 as its source.
  const NOT_F14 = /caught|catch/i;
  const audit = (list) => list.filter(m => NOT_F14.test(m.label) && m.src === 'f14').map(m => m.label);
  const caught = MILESTONES.find(m => /caught/i.test(m.label));
  report(audit(MILESTONES).length === 0 && caught?.src === 'scenario' && caught.timeFrom === 'f14' && /hypothetical/i.test(caught.label) && caught.t === EVENTS.catch,
    'hitos: la captura del booster es del escenario (hipotética), con la hora de flight 14 aparte', `${caught?.label} · src ${caught?.src} · hora de ${caught?.timeFrom}`);
  const mutated = MILESTONES.map(m => (m === caught ? { ...m, src: 'f14' } : m));
  report(audit(mutated).length === 1, 'control negativo: una captura marcada como de flight 14 se detecta', audit(mutated).join(', ') || 'NO detectada');
  const kinds = new Set([...MILESTONES, ...MILESTONES_RE].map(m => m.src));
  report([...kinds].every(k => ['f14', 'model', 'scenario'].includes(k)), 'hitos: toda procedencia es f14, model o scenario', [...kinds].join(', '));
}

// ---- Engine counts: the plan shown, flight 14's own counts stated ----------------------------
{
  const c = BOOSTER_COUNTS;
  report(c.planned.boostback === 33 && c.planned.landing.join() === '13,5,3' && c.flight14.boostback === 31 && c.flight14.landing.join() === '11,5,3' && c.shown === 'planned',
    'motores: el plan V3 (33; 13 → 5 → 3) y lo que hizo flight 14 (31; 11 → 5 → 3) quedan separados', `se muestra «${c.shown}»`);
  const hud = readFileSync(new URL('../src/ui/hud.js', import.meta.url), 'utf8');
  const note = hud.slice(hud.indexOf('Flight 14 timeline · sources and limits'));
  report(/31 of the 33/.test(note) && /11 of the 13/.test(note) && /planned/.test(note) && !/Every time on this clock is SpaceX/.test(note),
    'panel: dice que los recuentos son los planificados, da los de flight 14 y no atribuye todas las horas a SpaceX', '');
}

console.log(failed ? `\n${failed} fallo(s) en la misión` : '\nMisión (Flight 14): todo correcto');
process.exit(failed ? 1 : 0);
