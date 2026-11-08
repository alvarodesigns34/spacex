#!/usr/bin/env node
// Reproducible figures for the audit's §31 table (external audit 8-11, finding 05 and question 1):
//  - the tangential Δv at apogee that lifts a suborbital arc of apogee 270 km and perigee P to a
//    262 km perigee, by vis-viva, for the table's perigees, with the audit's μ and with the code's
//    (μ = g0·R², sim/mission.js);
//  - the Δv the insertion-burn hypothesis gives by the rocket equation (one sea-level Raptor, 250 tf,
//    Isp ≈350 s, 19 s at full thrust), from the ascent model's mass at cutoff less nothing else;
//  - and which perigee that Δv corresponds to, solved by bisection (not rounded).
// Analysis only: no simulation changes. Prints unrounded figures.
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });
const { R_EARTH, G0, MU, cutoffState } = await import('../src/sim/mission.js');

const MU_STD = 3.986004418e14;
const dvAt = (mu, apo, peri0, peri1) => {
  const ra = R_EARTH + apo, v = (rp) => Math.sqrt(mu * (2 / ra - 2 / (ra + R_EARTH + rp)));
  return v(peri1) - v(peri0);
};
console.log('Δv tangencial en el apogeo (270 km) para subir el perigeo a 262 km, por vis viva (m/s):');
console.log('perigeo del arco   μ estándar     μ = g0·R² (código)');
for (const p of [-300, -90, -32, 27, 87]) console.log(`${String(p).padStart(6)} km      ${dvAt(MU_STD, 270e3, p * 1e3, 262e3).toFixed(3).padStart(9)}      ${dvAt(MU, 270e3, p * 1e3, 262e3).toFixed(3).padStart(9)}`);

const cut = cutoffState();
const F = 250e3 * G0, isp = 350, dur = 19;
const prop = F * dur / (isp * G0), dvBurn = isp * G0 * Math.log(cut.m / (cut.m - prop));
console.log(`\nHipótesis de la inserción: 250 tf, Isp 350 s, ${dur} s → ${prop.toFixed(0)} kg de propelente; con la masa del modelo en el apagado (${(cut.m / 1000).toFixed(1)} t), Δv = ${dvBurn.toFixed(3)} m/s`);
// The perigee that Δv lifts to 262 km, by bisection.
let lo = -2000e3, hi = 262e3;
for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (dvAt(MU, 270e3, mid, 262e3) > dvBurn) lo = mid; else hi = mid; }
console.log(`Perigeo del arco que ese Δv sube a 262 km (μ del código): ${((lo + hi) / 2 / 1000).toFixed(2)} km`);
console.log('\nLa fila «76 km → −300 km → 177 m/s» del diario mezclaba dos cifras: 177 m/s era el Δv de la hipótesis, y −300 km un perigeo redondeado; por vis viva, −300 km pide ≈173 m/s. La altitud de 76 km salió de una copia del integrador que se borró y no se puede reproducir aquí.');
