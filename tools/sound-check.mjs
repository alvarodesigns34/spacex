#!/usr/bin/env node
// The engines' sound, rendered offline (no browser): each AudioWorklet's own source is taken out
// of its module and run here at 48 kHz in 128-sample blocks, its audio parameters fed as the main
// thread glides them (setTargetAtTime). What it checks (docs/diagnostico-2026-10-04/sonido.json):
//  - the firings at their exact time between samples: with the random cylinder spread taken out,
//    the energy off the engine's harmonics stays under -38 dB at any rpm (rounded to whole samples
//    it reached -25 dB at the H2R's 14,000 rpm and -27 dB at the GT3's 8,900);
//  - the H2R's relief-valve chirp: the same chirp whenever it comes (it was aliased noise after
//    ≈30 s of riding, its phase grown to 1e6 rad), and it comes on a quick-shift's cut too;
//  - no DC offset at the output; no click when the engine stops (a crash, a drowned engine);
//  - the cost: well under a core.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SR = 48000, B = 128;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

/** The worklet's class from a module's source, with optional text edits (each must match). */
function load(file, edits = []) {
  const t = readFileSync(ROOT + file, 'utf8');
  let src = t.slice(t.indexOf('const WORKLET = `') + 17, t.indexOf('`;', t.indexOf('const WORKLET')));
  for (const [a, b] of edits) { if (!src.includes(a)) throw new Error(`${file}: no match for ${a}`); src = src.split(a).join(b); }
  let cls;
  class AWP { constructor() { this.port = { onmessage: null, postMessage() {} }; } }
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', src)(AWP, (_, c) => { cls = c; }, SR);
  return cls;
}
/**
 * Renders `seconds` after `warm` seconds of warm-up. `ctl(t)` gives the parameters' targets at
 * time t (s from the start of the warm-up); each glides to its target with its time constant, per
 * sample, as setTargetAtTime does.
 */
function render(Cls, ctl, seconds, warm = 1, tau = {}) {
  const p = new Cls(), desc = Cls.parameterDescriptors;
  const cur = Object.fromEntries(desc.map(d => [d.name, d.defaultValue]));
  const P = Object.fromEntries(desc.map(d => [d.name, new Float32Array(B)]));
  const N = Math.floor(SR * seconds), W = Math.floor(SR * warm), out = new Float32Array(N), blk = [new Float32Array(B)];
  for (let i = 0; i < W + N; i += B) {
    const want = ctl(i / SR);
    for (const d of desc) {
      const tc = tau[d.name] ?? 0.015, k = 1 - Math.exp(-1 / (SR * tc)), a = P[d.name];
      for (let j = 0; j < B; j++) { if (want[d.name] !== undefined) cur[d.name] += (want[d.name] - cur[d.name]) * (tc > 0 ? k : 1); a[j] = cur[d.name]; }
    }
    p.process([], [blk], P);
    if (i >= W) out.set(blk[0].subarray(0, Math.min(B, N - (i - W))), i - W);
  }
  return out;
}
function spectrum(x) {
  let n = 1; while (n * 2 <= x.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const c = Math.cos(a * k), s = Math.sin(a * k), h = len / 2;
      const vr = re[i + k + h] * c - im[i + k + h] * s, vi = re[i + k + h] * s + im[i + k + h] * c;
      re[i + k + h] = re[i + k] - vr; im[i + k + h] = im[i + k] - vi; re[i + k] += vr; im[i + k] += vi;
    }
  }
  const mag = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) mag[i] = re[i] ** 2 + im[i] ** 2;
  return { mag, df: SR / n };
}
const dB = (v) => 10 * Math.log10(v + 1e-30);
/** The energy off the half-order harmonics of the crank (a four-stroke's cycle), dB of the total above 30 Hz. */
function inharmonic(x, rpm) {
  const { mag, df } = spectrum(x), h = rpm / 60 / 2;
  let tot = 0, harm = 0;
  for (let i = Math.ceil(30 / df); i < mag.length; i++) tot += mag[i];
  for (let k = 1; k * h < SR / 2 - 50; k++) { const c = Math.round(k * h / df); for (let b = c - 3; b <= c + 3; b++) if (b >= Math.ceil(30 / df)) harm += mag[b] || 0; }
  return dB(1 - harm / tot);
}
const band = (x, f0, f1) => { const { mag, df } = spectrum(x); let e = 0; for (let i = Math.ceil(f0 / df); i < Math.min(mag.length, f1 / df); i++) e += mag[i]; return e; };

const H2R = 'src/sim/h2rSound.js', GT3 = 'src/sim/gt3Sound.js';
// Deterministic engines: no cylinder-to-cylinder jitter, no noise layers (only the firings' timing left).
const detH = [['(0.92 + 0.16 * this.rnd())', '1'], ['y += this.nb * 0.05', 'y += 0 * this.nb'], ['(Math.sin(this.bp) * bpOk + Math.sin(this.sc) * 0.1)', '0']];
const detG = [['(0.93 + 0.14 * this.rnd())', '1'], ['this.nb * 0.4 * thr', '0']];
const wot = (rpm, extra = {}) => () => ({ rpm, load: 1, thr: 1, cut: 0, on: 1, ...extra });

// ---- The firings' timing ------------------------------------------------------------------------
{
  const H = load(H2R, detH), G = load(GT3, detG);
  const h = [6000, 10000, 13000, 14000].map(r => [r, inharmonic(render(H, wot(r), 2.73), r)]);
  const g = [4000, 7000, 8900].map(r => [r, inharmonic(render(G, wot(r, { gearW: 0, cabin: 0 }), 2.73), r)]);
  report([...h, ...g].every(([, v]) => v < -38),
    'explosiones en su instante exacto: la energía fuera de los armónicos del motor, por debajo de -38 dB a cualquier régimen',
    `H2R ${h.map(([r, v]) => `${r}: ${v.toFixed(1)}`).join(' · ')} dB · GT3 ${g.map(([r, v]) => `${r}: ${v.toFixed(1)}`).join(' · ')} dB`);
}
// ---- The H2R's relief valve ---------------------------------------------------------------------
{
  const H = load(H2R);
  // Flat out at 11,000 rpm for `warm` s, then the throttle shut: the chirp's energy at 1–3.5 kHz and
  // above 8 kHz over 0.12 s, against the same shut-off with the chirp silenced.
  const quiet = load(H2R, [['this.chirp = 1;', 'this.chirp = 0;']]);
  const shut = (Cls, warm) => render(Cls, (t) => ({ rpm: 11000, load: t < warm ? 1 : 0, thr: t < warm ? 1 : 0, cut: 0, on: 1 }), 0.12, warm);
  const chirpBands = (warm) => {
    const a = shut(H, warm), b = shut(quiet, warm);
    return { mid: dB(band(a, 1000, 3500)) - dB(band(b, 1000, 3500)), high: dB(band(a, 8000, 24000)) - dB(band(b, 8000, 24000)) };
  };
  const early = chirpBands(0.5), late = chirpBands(40);
  // A quick-shift: the engine's throttle cut for 60 ms while the rider's stays open (s.engThr).
  const qs = render(H, (t) => ({ rpm: 11000, load: t > 1 && t < 1.06 ? 0 : 1, thr: t > 1 && t < 1.06 ? 0 : 1, cut: t > 1 && t < 1.06 ? 1 : 0, on: 1 }), 0.12, 1.0);
  const qsQuiet = render(quiet, (t) => ({ rpm: 11000, load: t > 1 && t < 1.06 ? 0 : 1, thr: t > 1 && t < 1.06 ? 0 : 1, cut: t > 1 && t < 1.06 ? 1 : 0, on: 1 }), 0.12, 1.0);
  const qsMid = dB(band(qs, 1000, 3500)) - dB(band(qsQuiet, 1000, 3500));
  report(early.mid > 3 && Math.abs(late.mid - early.mid) < 2 && late.high < early.high + 2 && qsMid > 3,
    'H2R: la válvula de alivio silba igual a los 0,5 s que a los 40 s (no se convierte en ruido) y también en un cambio rápido',
    `1–3,5 kHz +${early.mid.toFixed(1)} dB a los 0,5 s y +${late.mid.toFixed(1)} dB a los 40 s · >8 kHz ${early.high.toFixed(1)} y ${late.high.toFixed(1)} dB · cambio rápido +${qsMid.toFixed(1)} dB`);
}
// ---- DC and clicks ------------------------------------------------------------------------------
{
  const rows = [];
  for (const [name, file, rpm] of [['H2R', H2R, 9000], ['GT3', GT3, 7000]]) {
    const C = load(file);
    const x = render(C, wot(rpm), 2);
    const dc = x.reduce((a, b) => a + b, 0) / x.length;
    // The engine stopping at 1 s (a crash, the water): the biggest sample-to-sample step at the
    // stop, against the biggest in steady running.
    const y = render(C, (t) => (t < 1 ? { rpm, load: 1, thr: 1, on: 1 } : { rpm: 0, load: 0, thr: 0, on: 0 }), 1.2, 0, { on: 0.01, rpm: 0.015 });
    let steady = 0, atStop = 0;
    for (let i = SR * 0.5 + 1; i < SR * 1.2; i++) { const d = Math.abs(y[i] - y[i - 1]); if (i < SR) steady = Math.max(steady, d); else atStop = Math.max(atStop, d); }
    rows.push({ name, dc, steady, atStop });
  }
  report(rows.every(r => Math.abs(r.dc) < 0.005 && r.atStop <= 1.2 * r.steady),
    'sin continua a la salida y sin clic cuando el motor se para',
    rows.map(r => `${r.name}: continua ${r.dc.toFixed(4)} · salto al parar ${r.atStop.toFixed(3)} frente a ${r.steady.toFixed(3)} en marcha`).join(' · '));
}
// ---- Cost ---------------------------------------------------------------------------------------
{
  // The worklets' own process() only, its parameters held (as most blocks see them).
  const cost = (file, values) => {
    const C = load(file), p = new C(), blk = [new Float32Array(B)];
    const P = Object.fromEntries(C.parameterDescriptors.map(d => [d.name, new Float32Array([values[d.name] ?? d.defaultValue])]));
    for (let i = 0; i < SR; i += B) p.process([], [blk], P);
    const t0 = performance.now();
    for (let i = 0; i < 5 * SR; i += B) p.process([], [blk], P);
    return (performance.now() - t0) / 1000 / 5;
  };
  const h = cost(H2R, { rpm: 12000, load: 1, thr: 1, on: 1 }), g = cost(GT3, { rpm: 8000, load: 1, thr: 1, on: 1, gearW: 800 });
  report(h < 0.05 && g < 0.05, 'coste: cada motor gasta menos del 5 % de un núcleo', `H2R ${(h * 100).toFixed(1)} % · GT3 ${(g * 100).toFixed(1)} %`);
}

console.log(failed ? `\n${failed} fallo(s) en el sonido` : '\nSonido: todo correcto');
process.exit(failed ? 1 : 0);
