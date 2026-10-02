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
