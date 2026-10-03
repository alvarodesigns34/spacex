/**
 * The Ninja H2R's ride model against what it should do: the published gearing's top speed, a
 * hypersport's acceleration and braking, leaning to turn, wheelies and their control, falls
 * when the grip is exceeded, water and walls. The figures checked are the model's own results
 * (≈ against published road tests where those exist), recorded on the exhibit's sheet.
 * Run: node tools/h2r-check.mjs
 */
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { createH2rBike, BIKE } = await import('../src/sim/h2rBike.js');
const { KMH_TOP, BODY } = await import('../src/data/h2r.js');
const { buildH2r } = await import('../src/vehicles/h2r.js');
const THREE = await import('three');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const DT = 1 / 240, D = 180 / Math.PI;
const flat = (mu = 1, kind = 'track') => () => ({ h: 0, mu, roll: 0, kind });

// ---- The model.
{
  const root = buildH2r({});
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const L = box.max.x - box.min.x, H = box.max.y, W = box.max.z - box.min.z;
  report(Math.abs(L - BODY.length) < 0.012 && Math.abs(H - BODY.height) < 0.008 && Math.abs(W - BODY.width) < 0.01 && box.min.y > -0.01,
    'el modelo mide lo publicado: 2,070 × 0,850 × 1,160 m, sobre sus ruedas', `${L.toFixed(3)} × ${W.toFixed(3)} × ${H.toFixed(3)} m, lo más bajo a ${(box.min.y * 1000).toFixed(0)} mm`);
  // (The decals are drawn on a canvas: in the browser only, checked there by ux-check.)
  const names = ['h2r-steer', 'h2r-wheel-f-spin', 'h2r-wheel-r-spin', 'h2r-swingarm', 'h2r-trellis', 'h2r-tank', 'h2r-cowl', 'h2r-screen'];
  const missing = names.filter(n => !root.getObjectByName(n));
  report(!missing.length, 'el modelo tiene las piezas que mueve el pilotaje', missing.length ? `faltan ${missing.join(', ')}` : names.length + ' piezas');
}

// ---- Straight line.
{
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); b.input.throttle = 1;
  let t = 0; const at = {};
  while (t < 60 && !s.crashed) { b.step(DT); t += DT; for (const k of [100, 200]) if (s.u * 3.6 >= k && !at[k]) at[k] = t; }
  report(at[100] > 2.2 && at[100] < 3.0 && at[200] > 4.8 && at[200] < 6.2, 'acelera como una hiperdeportiva con las ayudas: 0–100 y 0–200 km/h',
    `0–100 ${at[100]?.toFixed(2)} s · 0–200 ${at[200]?.toFixed(2)} s`);
  const wheelKmh = s.wR * 0.325 * 3.6;
  report(s.gear === 5 && s.rpm > 14000 && Math.abs(wheelKmh - KMH_TOP) < 6 && s.slip > 0 && s.slip < 0.07, 'la punta la dan el desarrollo en sexta, el arrastre y el deslizamiento del neumático trasero',
    `${(s.u * 3.6).toFixed(0)} km/h sobre el suelo, la rueda a ${wheelKmh.toFixed(0)} km/h (desliza un ${(s.slip * 100).toFixed(1)} %), en ${s.gear + 1}.ª a ${s.rpm.toFixed(0)} rpm; desarrollo al corte ${KMH_TOP.toFixed(0)} km/h`);
  b.reset(); s.u = 200 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 4; b.input.brake = 1; t = 0; let minPitch = 0;
  while (s.u > 0.1 && t < 15) { b.step(DT); t += DT; minPitch = Math.min(minPitch, s.theta * D); }
  report(t > 4.4 && t < 6.2 && !s.crashed && minPitch > -2, 'frena de 200 a 0 sin levantar la rueda trasera con las ayudas', `${t.toFixed(2)} s (≈${(200 / 3.6 / t / 9.81).toFixed(2)} g de media) · cabeceo mín. ${minPitch.toFixed(1)}°`);
}

// ---- Wheelies.
{
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); b.input.throttle = 1; let max = 0;
  for (let k = 0; k < 240 * 4; k++) { b.step(DT); max = Math.max(max, s.theta * D); }
  report(max > 0.5 && max < 8 && !s.crashed, 'con el control de caballito la rueda delantera apenas se levanta', `máx. ${max.toFixed(1)}°`);
  b.reset(); s.aids = false; b.input.throttle = 1; max = 0;
  for (let k = 0; k < 240 * 4 && !s.crashed; k++) { b.step(DT); max = Math.max(max, s.theta * D); }
  report(!!s.crashed && /wheelie/.test(s.crashed.why), 'sin ayudas, gas a fondo en primera: el caballito pasa del punto de equilibrio', `${max.toFixed(0)}° · ${s.crashed?.why}`);
}

// ---- Leaning.
{
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.u = 100 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 2; b.input.throttle = 0.25; b.input.lean = 1;
  for (let k = 0; k < 240 * 4; k++) b.step(DT);
  const ay = s.u * s.r / 9.81;
  report(s.phi * D > 45 && s.phi * D < 58 && Math.abs(ay - Math.tan(s.phi)) < 0.02 && !s.crashed, 'gira inclinándose: a 100 km/h, a fondo, ≈52° y g·tan φ de aceleración lateral', `${(s.phi * D).toFixed(1)}° · ${ay.toFixed(2)} g`);
  b.reset(); s.u = 100 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 2; b.input.lean = -1;
  for (let k = 0; k < 240 * 2; k++) b.step(DT);
  report(s.phi < 0 && s.r < 0, 'hacia la izquierda se inclina y gira a la izquierda', `${(s.phi * D).toFixed(0)}°, r ${s.r.toFixed(2)} rad/s`);
  // Leant over, hard on the front brake without the aids: the front tucks.
  b.reset(); s.aids = false; s.u = 120 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 3; b.input.lean = 1;
  for (let k = 0; k < 240 * 2; k++) b.step(DT);
  b.input.brake = 1;
  for (let k = 0; k < 240 * 2 && !s.crashed; k++) b.step(DT);
  report(!!s.crashed, 'sin ayudas, frenar fuerte inclinado tira la moto al suelo', s.crashed?.why ?? 'sigue de pie');
  // Down, it slides to a stop on its side.
  for (let k = 0; k < 240 * 10; k++) b.step(DT);
  report(s.u < 0.2 && Math.abs(s.phi * D) > 70, 'en el suelo desliza de lado hasta pararse', `${(s.u * 3.6).toFixed(1)} km/h · ${(s.phi * D).toFixed(0)}°`);
  // On grass the grip is lower: the same lean at the same speed goes down without the aids.
  const g = createH2rBike({ ground: flat(0.55, 'grass') }); const q = g.state;
  g.reset(); q.aids = false; q.u = 90 / 3.6; q.wR = q.u / BIKE.RR; q.gear = 2; g.input.lean = 1;
  for (let k = 0; k < 240 * 4 && !q.crashed; k++) g.step(DT);
  report(!!q.crashed, 'sin ayudas, tumbarse a fondo en la hierba la tira', q.crashed?.why ?? 'sigue de pie');
}

// ---- Counter-steering and a throttle chopped mid-corner.
{
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.u = 110 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 2; b.input.throttle = 0.6; b.input.lean = 1;
  let first = 0;
  for (let k = 0; k < 120; k++) { b.step(DT); if (!first && Math.abs(s.steer) > 0.002) first = s.steer; }
  for (let k = 0; k < 240 * 2; k++) b.step(DT);
  report(first < 0 && s.phi > 0.6 && s.steer > 0, 'contramanillar: para inclinarse a la derecha gira primero el manillar a la izquierda, luego entra en la curva',
    `primer giro ${(first * D).toFixed(2)}°, luego ${(s.steer * D).toFixed(2)}° con ${(s.phi * D).toFixed(0)}° de inclinación`);
  b.input.throttle = 0;
  for (let k = 0; k < 240 * 2; k++) b.step(DT);
  report(!s.crashed, 'con las ayudas, cortar gas a fondo de inclinación no la tira', s.crashed?.why ?? `sigue a ${(s.phi * D).toFixed(0)}°`);
}

// ---- Water and walls.
{
  const deep = (x) => ({ h: 0, mu: 1, roll: 0, kind: x > 20 ? 'mud' : 'track', water: x > 20 ? 0.6 : undefined });
  const b = createH2rBike({ ground: (x) => deep(x) }); const s = b.state;
  b.reset(); s.u = 60 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 1; b.input.throttle = 0.3;
  for (let k = 0; k < 240 * 4 && !s.crashed; k++) b.step(DT);
  report(!!s.crashed && /water/.test(s.crashed.why), 'en 0,6 m de agua no se puede seguir: cae al agua', s.crashed?.why ?? `sigue a ${(s.u * 3.6).toFixed(0)} km/h`);
  const posts = [];
  for (let z = -4; z <= 4; z += 0.5) posts.push({ x: 30, z, r: 0.15 });
  const w = createH2rBike({ ground: flat(), obstacles: () => posts }); const t = w.state;
  w.reset(); t.u = 80 / 3.6; t.wR = t.u / BIKE.RR; t.gear = 2; w.input.throttle = 0.4;
  let maxX = -1e9;
  for (let k = 0; k < 240 * 4; k++) { w.step(DT); maxX = Math.max(maxX, t.x + BIKE.front); }
  report(!!t.crashed && maxX < 30.3, 'contra una valla a 80 km/h: no la atraviesa y cae', `morro hasta x ${maxX.toFixed(2)} m · ${t.crashed?.why}`);
}

console.log(failed ? `\n${failed} fallo(s)` : '\nPilotaje de la Ninja H2R: todo correcto');
process.exit(failed ? 1 : 0);
