/**
 * The Ninja H2R's ride model against what it should do: the published gearing's top speed, a
 * hypersport's acceleration and braking, leaning to turn, wheelies and their control, water,
 * walls and slopes — and never a fall from leaning: the lean limit holds every turn, braking or
 * accelerating in it, letting it go, on any surface, with the aids or without (fuzzed with the
 * keyboard's own ramps). The figures checked are the model's own results
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
const { KMH_TOP, BODY, PRESS } = await import('../src/data/h2r.js');
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
  // (The width to verify.js's tolerance for a grade-A figure, ±0.5 %, so check:static catches it.)
  report(Math.abs(L - BODY.length) < 0.012 && Math.abs(H - BODY.height) < 0.008 && Math.abs(W - BODY.width) / BODY.width < 0.005 && box.min.y > -0.01,
    'el modelo mide lo publicado: 2,070 × 0,850 × 1,160 m, sobre sus ruedas', `${L.toFixed(3)} × ${W.toFixed(3)} × ${H.toFixed(3)} m, lo más bajo a ${(box.min.y * 1000).toFixed(0)} mm`);
  // (The decals are drawn on a canvas: in the browser only, checked there by ux-check.)
  const names = ['h2r-steer', 'h2r-wheel-f-spin', 'h2r-wheel-r-spin', 'h2r-swingarm', 'h2r-trellis', 'h2r-tank', 'h2r-cowl', 'h2r-screen'];
  const missing = names.filter(n => !root.getObjectByName(n));
  report(!missing.length, 'el modelo tiene las piezas que mueve el pilotaje', missing.length ? `faltan ${missing.join(', ')}` : names.length + ' piezas');
}

// ---- The wind (core/wind.js; Phase 4): the drag is the air's ----------------------------------------
{
  const top = (wx) => {
    const b = createH2rBike({ ground: flat(), wind: (x, h, z, tt, out) => { out.x = wx; out.y = 0; out.z = 0; return out; } }); const s = b.state;
    b.reset(); b.input.throttle = 1;
    let v = 0, tt = 0; while (tt < 90 && !s.crashed) { b.step(DT); tt += DT; v = Math.max(v, s.u * 3.6); }
    return v;
  };
  const still = top(0), head = top(-5), tail = top(5);
  report(still - head > 7 && tail > still + 3, 'viento: 5 m/s de cara le quitan velocidad punta y de cola se la dan (la resistencia es la del aire)',
    `en calma ${still.toFixed(1)} km/h · de cara ${head.toFixed(1)} · de cola ${tail.toFixed(1)}`);
}
// ---- Straight line.
{
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); b.input.throttle = 1;
  let t = 0, x = 0; const at = {}, dist = {};
  while (t < 90 && !s.crashed) { b.step(DT); t += DT; x += s.u * DT; for (const k of [100, 200, 300]) if (s.u * 3.6 >= k && !at[k]) { at[k] = t; dist[k] = x; } }
  // Against MOTORRAD's GPS-timed runs (PRESS): within 0.15 s to 100 and 200 km/h, 0.4 s to 300,
  // 6 % of the distance.
  report(Math.abs(at[100] - PRESS.t100) < 0.15 && Math.abs(at[200] - PRESS.t200) < 0.15 && Math.abs(at[300] - PRESS.t300) < 0.4
    && Math.abs(dist[200] / PRESS.d200 - 1) < 0.06 && Math.abs(dist[300] / PRESS.d300 - 1) < 0.06,
    'acelera como la H2R de la prueba de MOTORRAD (GPS, Lausitzring): 0–100, 0–200 y 0–300 km/h',
    `0–100 ${at[100]?.toFixed(2)} s (${PRESS.t100}) · 0–200 ${at[200]?.toFixed(2)} s en ${dist[200]?.toFixed(0)} m (${PRESS.t200} s, ${PRESS.d200} m) · 0–300 ${at[300]?.toFixed(2)} s en ${dist[300]?.toFixed(0)} m (${PRESS.t300} s, ${PRESS.d300} m)`);
  const wheelKmh = s.wR * 0.325 * 3.6;
  report(s.gear === 5 && Math.abs(s.u * 3.6 - PRESS.vmaxGps) < 5 && wheelKmh < KMH_TOP && s.slip > 0 && s.slip < 0.07, 'la punta la da el arrastre en sexta, por debajo del corte: la de MOTORRAD por GPS',
    `${(s.u * 3.6).toFixed(0)} km/h sobre el suelo (${PRESS.vmaxGps} por GPS), la rueda a ${wheelKmh.toFixed(0)} km/h (desliza un ${(s.slip * 100).toFixed(1)} %), en ${s.gear + 1}.ª a ${s.rpm.toFixed(0)} rpm; desarrollo al corte ${KMH_TOP.toFixed(0)} km/h`);
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
  const bal = Math.atan2(BIKE.b, BIKE.h) * D;
  report(!s.crashed && max > 20 && max < 0.95 * bal, 'sin ayudas, gas a fondo en primera: caballito de verdad, pero el piloto corta antes del punto de equilibrio y no da la vuelta',
    `máx. ${max.toFixed(0)}° (equilibrio a ${bal.toFixed(0)}°) · ${s.crashed?.why ?? 'de pie'}`);
  // Without the aids, the front brake grabbed at 200 km/h on a straight: the rear lifts, the rider
  // eases off, it stops on both wheels (it used to go over the bars).
  b.reset(); s.aids = false; s.u = 200 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 4; b.input.brake = 1;
  let minT = 0, t = 0;
  while (s.u > 0.1 && t < 20 && !s.crashed) { b.step(DT); t += DT; minT = Math.min(minT, s.theta * D); }
  const balS = Math.atan2(BIKE.lf, BIKE.h) * D;
  report(!s.crashed && s.u < 0.2 && -minT < 0.95 * balS, 'sin ayudas, freno delantero a fondo a 200 km/h en recta: levanta la trasera pero no vuelca por delante',
    `para en ${t.toFixed(1)} s · trasera hasta ${(-minT).toFixed(0)}° (equilibrio a ${balS.toFixed(0)}°) · ${s.crashed?.why ?? 'de pie'}`);
}

// ---- Leaning.
{
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.u = 100 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 2; b.input.throttle = 0.25; b.input.lean = 1;
  for (let k = 0; k < 240 * 4; k++) b.step(DT);
  const ay = s.u * s.r / 9.81;
  report(s.phi * D > 52 && s.phi * D < 56 && Math.abs(ay - Math.tan(s.phi)) < 0.02 && !s.crashed, 'gira inclinándose: a 100 km/h, a fondo, el límite del agarre (52–56°) y g·tan φ de aceleración lateral', `${(s.phi * D).toFixed(1)}° · ${ay.toFixed(2)} g`);
  b.reset(); s.u = 100 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 2; b.input.lean = -1;
  for (let k = 0; k < 240 * 2; k++) b.step(DT);
  report(s.phi < 0 && s.r < 0, 'hacia la izquierda se inclina y gira a la izquierda', `${(s.phi * D).toFixed(0)}°, r ${s.r.toFixed(2)} rad/s`);
  // Leant over, hard on the front brake without the aids: the friction circle is still the
  // tyres', so the front locks and skids on what the lean leaves — a longer stop, not a fall.
  b.reset(); s.aids = false; s.u = 120 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 3; b.input.lean = 1;
  for (let k = 0; k < 240 * 2; k++) b.step(DT);
  b.input.brake = 1;
  const u0 = s.u; let minPhi = 90;
  for (let k = 0; k < 240 * 1.5 && !s.crashed; k++) { b.step(DT); minPhi = Math.min(minPhi, Math.abs(s.phi * D)); }
  const meanAx = (u0 - s.u) / 1.5 / 9.81;
  report(!s.crashed && minPhi > 40 && meanAx > 0.4, 'sin ayudas, frenar a fondo inclinado no la tira: la delantera se bloquea y frena con lo que deja la inclinación',
    s.crashed?.why ?? `inclinación mín. ${minPhi.toFixed(0)}° · ${meanAx.toFixed(2)} g de media`);
  // Down (brought down on purpose), it slides to a stop on its side.
  b.fall('test');
  for (let k = 0; k < 240 * 10; k++) b.step(DT);
  report(s.u < 0.2 && Math.abs(s.phi * D) > 70, 'en el suelo desliza de lado hasta pararse', `${(s.u * 3.6).toFixed(1)} km/h · ${(s.phi * D).toFixed(0)}°`);
  // On grass the grip is lower: the lean is held to what it can hold and the line opens.
  const radius = (ground, aids) => {
    const g = createH2rBike({ ground }); const q = g.state;
    g.reset(); q.aids = aids; q.u = 90 / 3.6; q.wR = q.u / BIKE.RR; q.gear = 2; g.input.lean = 1;
    let max = 0;
    for (let k = 0; k < 240 * 4 && !q.crashed; k++) { g.step(DT); max = Math.max(max, Math.abs(q.phi * D)); }
    return { R: q.u / Math.max(1e-6, Math.abs(q.r)), max, why: q.crashed?.why };
  };
  const capGrass = Math.atan(0.92 * 1.5 * 0.55) * D;
  const track = radius(flat(), true), grassOn = radius(flat(0.55, 'grass'), true), grassOff = radius(flat(0.55, 'grass'), false);
  report(!grassOn.why && !grassOff.why && grassOn.max < capGrass + 2 && grassOff.max < capGrass + 2 && grassOn.R > track.R * 1.5,
    'tumbarse a fondo en la hierba no la tira: la inclinación se queda en lo que agarra y la trazada se abre',
    grassOn.why ?? grassOff.why ?? `máx. ${grassOn.max.toFixed(1)}° con ayudas, ${grassOff.max.toFixed(1)}° sin ellas (límite ${capGrass.toFixed(1)}°) · radio ${grassOn.R.toFixed(0)} m frente a ${track.R.toFixed(0)} m en pista`);
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
  for (let k = 0; k < 240 * 8 && !s.crashed; k++) b.step(DT);
  const drowned = s.drowned, upright = !s.crashed, stopped = s.u < 1;
  b.pickUp();
  report(drowned && upright && stopped && !s.drowned && !s.crashed && s.x < 20 && s.u === 0,
    'en 0,6 m de agua el motor se ahoga y la moto se para de pie; R la levanta en el último sitio seco',
    `ahogada ${drowned} · de pie ${upright} · ${stopped ? 'parada' : 'sigue'} · levantada en x ${s.x.toFixed(1)} m`);
  const posts = [];
  for (let z = -4; z <= 4; z += 0.5) posts.push({ x: 30, z, r: 0.15 });
  const w = createH2rBike({ ground: flat(), obstacles: () => posts }); const t = w.state;
  w.reset(); t.u = 80 / 3.6; t.wR = t.u / BIKE.RR; t.gear = 2; w.input.throttle = 0.4;
  let maxX = -1e9;
  for (let k = 0; k < 240 * 4; k++) { w.step(DT); maxX = Math.max(maxX, t.x + BIKE.front); }
  report(!!t.crashed && maxX < 30.3, 'contra una valla a 80 km/h: no la atraviesa y cae', `morro hasta x ${maxX.toFixed(2)} m · ${t.crashed?.why}`);
  // R after that crash: upright, stopped, clear of the posts.
  for (let k = 0; k < 240 * 3; k++) w.step(DT);
  w.pickUp();
  const clearOf = posts.every(o => Math.hypot(o.x - t.x, o.z - t.z) > o.r + 0.5);
  for (let k = 0; k < 240; k++) w.step(DT);
  report(!t.crashed && clearOf && Math.abs(t.phi) < 0.05 && t.u < 0.5, 'R levanta la moto tras un choque: de pie, parada y lejos de lo que golpeó', `a ${Math.min(...posts.map(o => Math.hypot(o.x - t.x, o.z - t.z))).toFixed(1)} m del poste más cercano`);
  // Square on at 30 km/h: it stops against the posts and bounces, the rider stays on.
  w.reset(); t.u = 30 / 3.6; t.wR = t.u / BIKE.RR; t.gear = 0; w.input.throttle = 0.2;
  maxX = -1e9;
  for (let k = 0; k < 240 * 3; k++) { w.step(DT); maxX = Math.max(maxX, t.x + BIKE.front); }
  report(!t.crashed && maxX < 30.3, 'contra la misma valla a 30 km/h: se para contra ella y rebota, sin caerse (solo los golpes fuertes tiran la moto)', `morro hasta x ${maxX.toFixed(2)} m · ${t.crashed?.why ?? 'de pie'}`);
}

// ---- Ridden as the keyboard rides it: never down from leaning ---------------------------------
// The keys ramp as h2rRide.js ramps them (throttle 6/s, front brake 5/s, rear 7/s, lean 2.2/s in and 3/s back),
// read at 60 Hz, four physics steps a frame.
const ramp = (c, t, rate, dt) => c + Math.max(-rate * dt, Math.min(rate * dt, t - c));
// The only falls the model has left that leaning cannot cause, without the aids: past the balance point.
const PITCH = ['Looped it: the wheelie went past the balance point.', 'Over the bars: the stoppie went past the balance point.'];
function ride({ v0 = 0, gear, aids = true, ground = flat(), obstacles, keys, T = 6, psi = 0, each, resume = null }) {
  const b = createH2rBike({ ground, obstacles }); const s = b.state;
  const start = (x = 0, z = 0) => {
    b.reset({ x, z, psi }); s.aids = aids;
    if (v0) { s.u = v0 / 3.6; s.wR = s.u / BIKE.RR; s.gear = gear ?? Math.min(5, Math.floor(v0 / 55)); }
  };
  start();
  const r = { throttle: 0, brake: 0, rear: 0, lean: 0 }, f = 1 / 60;
  const out = { maxPhi: 0, minTheta: 0, b, s, falls: [] };
  for (let t = 0; t < T; t += f) {
    // (A fall the check allows — resume(why) says so — is noted and the ride goes on from there.)
    if (s.crashed) { if (resume?.(s.crashed.why)) { out.falls.push(s.crashed.why); start(s.x, s.z); Object.assign(r, { throttle: 0, brake: 0, rear: 0, lean: 0 }); } else break; }
    const k = keys(t, s), want = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    r.throttle = ramp(r.throttle, Number(k.w ?? 0), 6, f); r.brake = ramp(r.brake, k.s ? 1 : 0, 5, f); r.rear = ramp(r.rear, k.sp ? 1 : 0, 7, f);
    r.lean = ramp(r.lean, want, want ? 2.2 : 3, f);
    Object.assign(b.input, { throttle: r.throttle, brake: r.brake, rearBrake: r.rear, lean: r.lean });
    for (let i = 0; i < 4 && !s.crashed; i++) { b.step(DT); out.maxPhi = Math.max(out.maxPhi, Math.abs(s.phi * D)); out.minTheta = Math.min(out.minTheta, s.theta * D); each?.(t, s); }
  }
  return out;
}
{
  // Letting go of the lean after a full-lean turn: the bike stands up, it does not lowside.
  const bad = [];
  let slowest = 0;
  for (const aids of [true, false]) for (const v of [50, 80, 100, 130, 160, 200, 250]) for (const w of [0, 0.3]) {
    let upAt = null;
    const o = ride({ v0: v, aids, T: 4.5, keys: (t) => ({ d: t < 2.5, w }), each: (t, s) => { if (t >= 2.5 && upAt === null && Math.abs(s.phi * D) < 10) upAt = t - 2.5; } });
    if (o.s.crashed || upAt === null || upAt > 1.5) bad.push(`${v} km/h${aids ? '' : ' sin ayudas'}: ${o.s.crashed?.why ?? `${upAt?.toFixed(2) ?? '>2'} s`}`);
    else slowest = Math.max(slowest, upAt);
  }
  report(!bad.length, 'soltar la inclinación tras una curva a fondo la levanta sin caerse (de 50 a 250 km/h, con y sin ayudas)', bad.length ? bad.slice(0, 4).join(' · ') : `por debajo de 10° en ${slowest.toFixed(2)} s como mucho`);
}
{
  // Braking hard and accelerating hard while leant over, with the aids: the cornering ABS and
  // traction control keep them within what the lean leaves. And an accelerating circle from rest.
  const bad = [];
  let minDecel = Infinity;
  for (const v of [50, 80, 120, 160, 200, 250]) {
    let u15 = null;
    const o = ride({ v0: v, T: 5, keys: (t) => ({ d: 1, s: t > 1.5 }), each: (t, q) => { if (u15 === null && t > 1.5) u15 = q.u; if (u15 !== null && t > 2.5 && t < 2.52) minDecel = Math.min(minDecel, (u15 - q.u) / 1.0 / 9.81); } });
    if (o.s.crashed || o.minTheta < -2) bad.push(`freno ${v}: ${o.s.crashed?.why ?? `${o.minTheta.toFixed(1)}°`}`);
  }
  if (!(minDecel > 0.3)) bad.push(`frena poco: ${minDecel.toFixed(2)} g`);
  for (const v of [15, 30, 60, 90, 120]) {
    const o = ride({ v0: v, gear: Math.min(5, Math.floor(v / 55)), T: 5, keys: (t) => ({ d: 1, w: t > 1.5 }) });
    if (o.s.crashed) bad.push(`gas ${v}: ${o.s.crashed.why}`);
  }
  const circle = ride({ T: 8, keys: () => ({ d: 1, w: 1 }) });
  if (circle.s.crashed) bad.push(`círculo: ${circle.s.crashed.why}`);
  report(!bad.length, 'con las ayudas, frenar o acelerar a fondo inclinada no la tira (ABS y control de tracción en curva) y frena de verdad (> 0,3 g)', bad.length ? bad.join(' · ') : `frenando inclinada, al menos ${minDecel.toFixed(2)} g · círculo acelerando desde parado: ${(circle.s.u * 3.6).toFixed(0)} km/h a ${circle.maxPhi.toFixed(0)}°`);
}
{
  // 200 seeded random rides of 20 s each way, the keys pressed and released at random, the
  // ground changing between track, kerb, grass, gravel, pad and runway every 30–80 m.
  let seed = 0x2f6e2b1;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const kinds = [['track', 1], ['kerb', 0.9], ['grass', 0.55], ['gravel', 0.45], ['pad', 0.9], ['runway', 0.95]];
  for (const aids of [true, false]) {
    const why = {};
    let falls = 0, maxPhi = 0, pitchFalls = 0;
    for (let run = 0; run < 200; run++) {
      const span = 30 + rnd() * 50, offset = rnd() * 6;
      const ground = (x, z) => { const [kind, mu] = kinds[(Math.floor(Math.hypot(x, z) / span + offset) % kinds.length + kinds.length) % kinds.length]; return { h: 0, mu, roll: 0, kind }; };
      const keys = { d: 0, a: 0, w: 0, s: 0, sp: 0 };
      const o = ride({ v0: rnd() * 300, aids, ground, T: 20, psi: rnd() * 6.28, resume: aids ? null : (w) => PITCH.includes(w), keys: (t) => {
        if (rnd() < 0.08) { const l = Math.floor(rnd() * 3); keys.d = l === 2 ? 1 : 0; keys.a = l === 0 ? 1 : 0; }
        if (rnd() < 0.06) keys.w = rnd() < 0.55 ? 1 : 0;
        if (rnd() < 0.05) keys.s = rnd() < 0.3 ? 1 : 0;
        if (rnd() < 0.03) keys.sp = rnd() < 0.2 ? 1 : 0;
        void t; return keys;
      } });
      maxPhi = Math.max(maxPhi, o.maxPhi);
      for (const w of o.falls) { pitchFalls++; why[w] = (why[w] ?? 0) + 1; }
      if (o.s.crashed) { falls++; const w = o.s.crashed.why.replace(/\d+/g, '#'); why[w] = (why[w] ?? 0) + 1; }
    }
    report(falls === 0 && pitchFalls === 0 && maxPhi <= BIKE.maxLean * D + 0.01,
      aids ? '200 recorridos aleatorios de 20 s con las ayudas: ninguna caída' : '200 recorridos aleatorios de 20 s sin ayudas: ninguna caída, ni por inclinarse ni por caballitos o frenadas',
      `${falls} caídas no permitidas${aids ? '' : ` · ${pitchFalls} caballitos o vuelcos`}${Object.keys(why).length ? ` (${Object.entries(why).map(([w, n]) => `${n} × ${w}`).join('; ')})` : ''} · inclinación máx. ${maxPhi.toFixed(1)}° (tope ${(BIKE.maxLean * D).toFixed(0)}°)`);
  }
}
{
  // Slow: at 15 km/h a full lean turns tight; braking to a stop from 25 km/h while leant, the
  // bike comes upright without a jolt.
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.u = 15 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 0; b.input.lean = 1; b.input.throttle = 0.12;
  for (let k = 0; k < 240 * 3; k++) b.step(DT);
  const R = s.u / Math.max(1e-6, Math.abs(s.r));
  let maxRate = 0, prev = null, maxOver = 0;
  const o = ride({ v0: 25, gear: 0, T: 6, keys: (t) => ({ d: 1, s: t > 1 }), each: (t, q) => {
    if (prev !== null && t > 1) maxRate = Math.max(maxRate, Math.abs(q.phi - prev) / DT * D);
    prev = q.phi;
    // (Never lying on the pegs below the speed whose lean the bars can balance.)
    if (q.u > 3) maxOver = Math.max(maxOver, Math.abs(q.phi) - Math.atan(q.u * q.u * Math.tan(BIKE.steerMax) / (9.81 * BIKE.L)));
  } });
  report(!s.crashed && R < 5 && !o.s.crashed && maxRate < 60 && maxOver < 3 / D, 'a 15 km/h gira cerrado, y frenando hasta parar inclinada se levanta sin brusquedad',
    `radio ${R.toFixed(1)} m a ${(s.u * 3.6).toFixed(0)} km/h · ${o.s.crashed?.why ?? `frenando, la inclinación cambia a ${maxRate.toFixed(0)}°/s como mucho y nunca pasa en más de ${(maxOver * D).toFixed(1)}° de la que el manillar equilibra`}`);
}
{
  // Water to 0.4 m: it slows the bike hard, it does not throw it down.
  const bad = [];
  let worst = 0;
  for (const depth of [0.1, 0.2, 0.4]) for (const v of [50, 100, 200]) {
    const ground = (x) => ({ h: 0, mu: 1, roll: 0, kind: x > 10 ? 'mud' : 'track', water: x > 10 ? depth : undefined });
    let peak = 0;
    const o = ride({ v0: v, ground, T: 3, keys: () => ({ w: 0.3 }), each: (t, q) => { peak = Math.max(peak, -q.ax / 9.81); } });
    worst = Math.max(worst, peak);
    if (o.s.crashed || peak > 0.8) bad.push(`${depth} m a ${v}: ${o.s.crashed?.why ?? `${peak.toFixed(2)} g`}`);
  }
  report(!bad.length, 'en agua de hasta 0,4 m frena con fuerza pero no la tira (a 50, 100 y 200 km/h)', bad.length ? bad.join(' · ') : `deceleración máx. ${worst.toFixed(2)} g`);
}
{
  // A graze along a wall of posts (circles every 0.25 m, as the map builds its walls) at 10°:
  // it scrapes along it, turned parallel, and stays up.
  const posts = [];
  for (let x = 0; x <= 200; x += 0.25) posts.push({ x, z: -3, r: 0.1875 });
  const near = (x, z) => posts.filter(o => Math.abs(o.x - x) < 3 && Math.abs(o.z - z) < 3);
  const b = createH2rBike({ ground: flat(), obstacles: near }); const s = b.state;
  b.reset({ x: 0, z: 0, psi: 10 * Math.PI / 180 }); s.u = 100 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 3; b.input.throttle = 0.3;
  let touched = null;
  for (let k = 0; k < 240 * 4 && !s.crashed; k++) { b.step(DT); if (touched === null && s.hits.length) touched = s.t; s.hits.length = 0; if (touched !== null && s.t > touched + 1) break; }
  const heading = ((s.psi * D) % 360 + 540) % 360 - 180;
  report(touched !== null && !s.crashed && Math.abs(heading) < 3, 'rozar una valla a 10° y 100 km/h: se arrastra a lo largo, paralela a ella, sin caerse',
    touched === null ? 'no llegó a la valla' : s.crashed?.why ?? `rumbo ${heading.toFixed(1)}° respecto a la valla un segundo después, a ${(s.u * 3.6).toFixed(0)} km/h`);
}
{
  // Up a 1:3 slope from 30 km/h, coasting: gravity stops it where the energy says.
  const slope = (x) => ({ h: Math.max(0, x) / 3, mu: 1, roll: 0, kind: 'track' });
  const b = createH2rBike({ ground: slope }); const s = b.state;
  b.reset({ x: -0.5 }); s.u = 30 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 0;
  let x0 = null;
  for (let k = 0; k < 240 * 6 && s.u > 0.05; k++) { b.step(DT); if (x0 === null && s.x > 0.75) x0 = s.x; }
  const th = Math.atan(1 / 3), v0 = 30 / 3.6, expect = v0 * v0 / (2 * 9.81 * (Math.sin(th) + 0.015 * Math.cos(th))) * Math.cos(th);
  report(Math.abs((s.x - (x0 ?? 0)) / expect - 1) < 0.15, 'cuesta arriba 1:3 a 30 km/h, sin gas: la gravedad la para donde dice la energía',
    `se para a ${(s.x - (x0 ?? 0)).toFixed(1)} m (≈${expect.toFixed(1)} m)`);
}
{
  // The gearbox: a downshift that would over-rev is refused; stopped in third (manual) the clutch
  // slips rather than stall, and it pulls away; G hands it back to the automatic.
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.u = 200 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 3; s.manual = true;
  for (let k = 0; k < 4; k++) { b.input.shiftDown = true; b.step(DT); for (let i = 0; i < 30; i++) b.step(DT); }
  const refused = s.gear, maxRpm = s.rpm;
  b.reset(); s.manual = true; s.gear = 2;
  for (let k = 0; k < 240; k++) b.step(DT);
  const idleRpm = s.rpm;
  b.input.throttle = 0.6;
  for (let k = 0; k < 240 * 3; k++) b.step(DT);
  const moved = s.u * 3.6;
  b.input.auto = true; b.step(DT);
  report(refused >= 2 && maxRpm <= 14500 && idleRpm >= 1300 && moved > 10 && !s.manual, 'caja: rechaza una reducción que pasaría de vueltas; parada en tercera no se cala y arranca; G vuelve al automático',
    `a 200 km/h queda en ${refused + 1}.ª a ${maxRpm.toFixed(0)} rpm · parada en 3.ª a ${idleRpm.toFixed(0)} rpm · ${moved.toFixed(0)} km/h en 3 s`);
}

{
  // A wall of posts square across the road at 260 km/h, aimed between two posts: the bike does
  // not go through it (a step of 0.3 m was more than the wall is thick).
  const posts = [];
  for (let z = -6; z <= 6; z += 0.25) posts.push({ x: 30, z, r: 0.1875 });
  const near = (x, z) => posts.filter(o => Math.abs(o.x - x) < 3 && Math.abs(o.z - z) < 3);
  const bad = [];
  for (const z0 of [0, 0.0625, 0.125, 0.1875]) for (const v of [260, 300, 340]) {
    const b = createH2rBike({ ground: flat(), obstacles: near }); const s = b.state;
    b.reset({ x: 24, z: z0 }); s.u = v / 3.6; s.wR = s.u / BIKE.RR; s.gear = 5;
    let maxX = -1e9, hit = 0;
    for (let k = 0; k < 240 * 2; k++) { b.step(DT); maxX = Math.max(maxX, s.x); hit = Math.max(hit, s.impact); }
    if (maxX > 30 || hit === 0) bad.push(`${v} km/h, z ${z0}: x máx. ${maxX.toFixed(2)}, golpe ${hit.toFixed(1)} m/s`);
  }
  report(!bad.length, 'contra una valla de postes a 260–340 km/h no la atraviesa: el golpe se registra', bad.length ? bad.join(' · ') : '12 pasadas, ninguna al otro lado');
}
{
  // Water to 0.44 m at 337 km/h, braking hard with the aids: it slows, it does not go over the bars.
  const bad = [];
  for (const depth of [0.3, 0.44]) {
    const ground = (x) => ({ h: 0, mu: 1, roll: 0, kind: x > 5 ? 'mud' : 'track', water: x > 5 ? depth : undefined });
    const o = ride({ v0: 337, gear: 5, ground, T: 8, keys: () => ({ s: 1 }) });
    if (o.s.crashed) bad.push(`${depth} m: ${o.s.crashed.why}`);
  }
  report(!bad.length, 'frenando a fondo con las ayudas a 337 km/h en agua de 0,30 y 0,44 m: no vuelca por delante', bad.join(' · ') || 'sin caída');
}
{
  // Over a crest at 200 km/h (up 1:3, then down 1:3): it leaves the ground and lands on its
  // springs, instead of being snapped to the ground at hundreds of g.
  const crest = (x) => ({ h: x < 40 ? 0 : x < 50 ? (x - 40) / 3 : Math.max(0, 10 / 3 - (x - 50) / 3), mu: 1, roll: 0, kind: 'track' });
  const b = createH2rBike({ ground: crest }); const s = b.state;
  b.reset(); s.u = 200 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 3; b.input.throttle = 0.4;
  let flew = 0, worst = 0, prevVy = null;
  for (let k = 0; k < 240 * 3; k++) {
    b.step(DT);
    if (s.air) flew += DT;
    if (prevVy !== null && Number.isFinite(s.vy)) worst = Math.max(worst, Math.abs(s.vy - prevVy) / DT / 9.81);
    prevVy = s.vy;
  }
  report(flew > 0.1 && !s.crashed, 'un cambio de rasante a 200 km/h: vuela y aterriza sobre los muelles, sin caerse',
    `${flew.toFixed(2)} s en el aire · ${s.crashed?.why ?? 'de pie'} · aceleración vertical máx. ${worst.toFixed(0)} g (el aterrizaje, al instante)`);
}
{
  // Without the aids a front locked leant over skids on its sliding friction: it stops longer
  // than the cornering ABS does, and the line opens. And spinning the rear without the aids, the
  // lean comes up to what the turn balances instead of hanging over a straight line.
  const stop = (aids) => {
    const b = createH2rBike({ ground: flat() }); const s = b.state;
    b.reset(); s.aids = aids; s.u = 100 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 2; b.input.lean = 1;
    for (let k = 0; k < 240 * 2; k++) b.step(DT);
    const x0 = s.x, z0 = s.z; let d = 0, px = x0, pz = z0, demand = 0;
    b.input.brake = 1;
    for (let k = 0; k < 240 * 15 && s.u > 0.2 && !s.crashed; k++) {
      b.step(DT); d += Math.hypot(s.x - px, s.z - pz); px = s.x; pz = s.z;
      if (s.lock > 0) demand = Math.max(demand, Math.hypot(s.axTyre, s.ay) / 9.81 / 1.5);
    }
    return { d, demand, why: s.crashed?.why };
  };
  const on = stop(true), off = stop(false);
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.aids = false; s.u = 30 / 3.6; s.wR = s.u / BIKE.RR; s.gear = 0; b.input.lean = 1;
  for (let k = 0; k < 240 * 1.5; k++) b.step(DT);
  b.input.throttle = 1;
  let worst = 0, slid = 0;
  for (let k = 0; k < 240 * 1.5 && !s.crashed; k++) {
    b.step(DT);
    if (s.sliding) slid += DT;
    if (slid > 0.6 && s.sliding) worst = Math.max(worst, Math.abs(s.phi) * D - Math.atan(Math.abs(s.ay) / 9.81) * D);
  }
  report(!on.why && !off.why && off.demand <= 1.0 && slid > 0.6 && worst < 10, 'sin ayudas, la delantera bloqueada inclinada no inventa agarre (frena y gira dentro del círculo de fricción); y con la trasera patinando la inclinación sigue al giro',
    `de 100 km/h inclinada: ${on.d.toFixed(0)} m con ayudas, ${off.d.toFixed(0)} m sin ellas, bloqueada como mucho al ${(off.demand * 100).toFixed(0)} % del agarre · a 30 km/h en 1.ª a fondo patina ${slid.toFixed(2)} s y la inclinación pasa como mucho ${worst.toFixed(1)}° de la que equilibra el giro`);
}
{
  // Walking pace on full lock: the published 27° at the bars, the rake foreshortening them at
  // the ground, give a turn of ≈3.2 m.
  const b = createH2rBike({ ground: flat() }); const s = b.state;
  b.reset(); s.u = 2; s.wR = s.u / BIKE.RR; s.gear = 0; b.input.lean = 1; b.input.throttle = 0.02;
  for (let k = 0; k < 240 * 3; k++) { b.step(DT); s.u = 2; }
  const R = s.u / Math.abs(s.r);
  report(R > 2.9 && R < 3.5, 'a paso de peatón con el manillar a tope gira en ≈3,2 m (27° de dirección, el avance de la horquilla)', `radio ${R.toFixed(2)} m`);
}

console.log(failed ? `\n${failed} fallo(s)` : '\nPilotaje de la Ninja H2R: todo correcto');
process.exit(failed ? 1 : 0);
