/**
 * The GT3 RS's sound, synthesised sample by sample, and opt-in like the launch's: nothing is
 * created or played until the visitor turns it on from the drive bar (a click, which browsers
 * require for audio).
 *
 * How (≈, chosen by ear against onboard recordings; not a recording or a measured spectrum):
 *  - The exhaust is built from its pulses. The 4.0-litre flat six fires every 120° of crank in
 *    the order 1-6-2-4-3-5, so the firings alternate between the two banks (1-3 and 4-6): each
 *    bank's three pulses are evenly spaced, and each bank has its own header run to the silencer,
 *    so the two trains differ a little in strength and colour — the boxer's half orders under
 *    the main note (order 3: 45 Hz at idle, 450 Hz at the 9,000 /min cut). Each pulse is a fast
 *    rise and a short decay, its size set by the load, rung through the exhaust's resonances and
 *    clipped softly: a hard bark low down, the shriek towards the cut.
 *  - The induction: six individual throttle bodies behind the cabin, the GT3's signature at high
 *    revs — each intake stroke a suction pulse through the plenum's resonance, opened by the
 *    throttle and loudest high in the revs.
 *  - Load and overrun: the throttle shut at high revs leaves weak pulses and the odd late burn in
 *    the hot pipes — the crackle; the limiter cuts the fuel in a stutter; the PDK's upshift cuts
 *    the ignition for the shift's ≈0.1 s.
 *  - Mechanical: the valve train's tick (order 12) and the gearbox's whine, on top.
 *  - The tyres, gravel and the wind are mixed in on top, as before; and the kerbs' rumble, with a
 *    thump as a wheel goes over their edge.
 * Each firing lands at its exact time between two samples, and the controls are audio parameters
 * read sample by sample (tools/sound-check.mjs renders the worklet offline and checks it). The
 * load is the engine's own (the PDK's blips and cuts, the traction control's trim).
 *  - The tyres' rolling roar on the road, which grows with the speed (≈ as the 1.5th power of
 *    it in pressure) and is most of what a car makes at a steady 100 km/h, outside as well as in.
 *  - From outside, the car is heard where it is (audioBus.js): late by d/343 s, its pitch moved by
 *    the Doppler shift as it passes, panned, quieter and duller with distance; the wind is the
 *    listener's own, so only in the cabin. In the cabin the exhaust is muffled and the induction,
 *    right behind the seats, comes forward.
 * Off the worklet (an old browser), it falls back to a few oscillators on the firing orders.
 */
import { underWheels } from './gt3Camera.js';
import { audio, claim, createSpatial, placeListener } from './audioBus.js';
const WORKLET = `
class Gt3Flat6 extends AudioWorkletProcessor {
  // The controls arrive as audio parameters, read sample by sample (glided on the main thread).
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 12000 },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'thr', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'cut', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'on', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'gearW', defaultValue: 0, minValue: 0, maxValue: 20000 },
      { name: 'cabin', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }
  constructor() {
    super();
    this.theta = 0; this.next = 0; this.cyl = 0; this.cA = 0; this.cB = 0; this.hpX = 0;
    this.envA = 0; this.envB = 0; this.slowA = 0; this.slowB = 0; this.ind = 0; this.pop = 0;
    this.seed = 911; this.gearPh = 0; this.tick = 0; this.nb = 0; this.hp = 0; this.lp = 0; this.lp2 = 0;
    this.lastThr = 0; this.blip = 0;
    const R = (f, q, g) => ({ f, q, g, x1: 0, x2: 0, y1: 0, y2: 0, b0: 0, a1: 0, a2: 0 });
    // Each bank's pipe: a low body, a mid bark and a high rasp (≈); the two banks a little apart.
    this.resA = [R(140, 2.5, 1.0), R(420, 4, 0.6), R(1300, 4, 0.32), R(3100, 3, 0.12)];
    this.resB = [R(150, 2.5, 1.0), R(455, 4, 0.55), R(1380, 4, 0.3), R(3300, 3, 0.11)];
    // The intake plenum: a hollow howl.
    this.resI = [R(600, 6, 1.0), R(1750, 5, 0.5)];
    // The firing order 1-6-2-4-3-5: bank of each firing (A: 1-3, B: 4-6), and each cylinder's own strength.
    this.order = [1, 6, 2, 4, 3, 5];
    this.cylGain = [1.0, 0.96, 1.03, 0.98, 1.02, 0.95];
  }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  design(r, sr) {
    const w = 2 * Math.PI * Math.min(r.f, sr * 0.45) / sr, al = Math.sin(w) / (2 * r.q);
    const a0 = 1 + al; r.b0 = al / a0; r.a1 = -2 * Math.cos(w) / a0; r.a2 = (1 - al) / a0;
  }
  ring(rs, x) {
    let y = 0;
    for (const r of rs) {
      const o = r.b0 * x - r.b0 * r.x2 - r.a1 * r.y1 - r.a2 * r.y2;
      r.x2 = r.x1; r.x1 = x; r.y2 = r.y1; r.y1 = o;
      y += o * r.g;
    }
    return y;
  }
  process(_, outputs, P) {
    const out = outputs[0][0], sr = sampleRate, n = out.length;
    const at = (a, i) => (a.length > 1 ? a[i] : a[0]);
    // The pipes' resonances rise a little as the gas heats (≈ with revs and load), once a block.
    const x90 = at(P.rpm, 0) / 9000;
    const heat = 1 + 0.14 * x90 + 0.05 * at(P.load, 0);
    const baseA = [140, 420, 1300, 3100], baseB = [150, 455, 1380, 3300];
    for (let k = 0; k < 4; k++) { this.resA[k].f = baseA[k] * heat; this.resB[k].f = baseB[k] * heat; this.design(this.resA[k], sr); this.design(this.resB[k], sr); }
    // The plenum's howl follows the intake's tuning, pulled up a little with the revs (the variable intake).
    this.resI[0].f = 520 + 260 * x90; this.resI[1].f = 1600 + 500 * x90;
    for (const r of this.resI) this.design(r, sr);
    const slow = Math.exp(-1 / (sr * 0.007));
    const indDecay = Math.exp(-1 / (sr * 0.0035));
    for (let i = 0; i < n; i++) {
      const rpm = at(P.rpm, i), load = at(P.load, i), thr = at(P.thr, i), cut = at(P.cut, i), on = at(P.on, i);
      const gearW = at(P.gearW, i), cabin = at(P.cabin, i), x9 = rpm / 9000;
      const fCrank = rpm / 60, dTheta = 2 * Math.PI * fCrank / sr;
      const decay = Math.exp(-1 / (sr * (0.0009 + 0.0016 * (1 - x9))));
      const overrun = thr < 0.06 && rpm > 4200;
      this.theta += dTheta;
      // Each firing at its exact time between two samples, split across this one and the next,
      // per bank (rounded to the nearest sample, it left an rpm-dependent inharmonic floor).
      let impA = this.cA, impB = this.cB, impI = 0;
      this.cA = 0; this.cB = 0;
      // A firing every 120° of crank, alternating banks.
      while (this.theta >= this.next) {
        const fr = (this.theta - this.next) / dTheta;
        this.next += 2 * Math.PI / 3;
        const c = this.order[this.cyl]; this.cyl = (this.cyl + 1) % 6;
        let a = (0.32 + 0.68 * load) * (0.6 + 0.6 * x9) * this.cylGain[c - 1] * (0.93 + 0.14 * this.rnd());
        if (cut > 0.5) a *= this.rnd() < 0.8 ? 0.05 : 0.5;            // the limiter / the PDK's ignition cut
        if (overrun) {
          a *= 0.16;
          if (this.rnd() < 0.03 * Math.min(1, rpm / 8000)) this.pop = 0.7 + 0.6 * this.rnd();   // a late burn in the pipe
        }
        if (c <= 3) { impA += a * fr; this.cA += a * (1 - fr); } else { impB += a * fr; this.cB += a * (1 - fr); }
        // The same cylinder's intake stroke draws through the plenum (its timing is not the point: its rate is).
        impI += (0.15 + 0.85 * thr) * (0.3 + 0.7 * x9 * x9);
      }
      if (this.theta > 1e6) { this.theta -= 1e6; this.next -= 1e6; }
      this.envA = this.envA * decay + impA; this.slowA = this.slowA * slow + impA * 0.15;
      this.envB = this.envB * decay + impB; this.slowB = this.slowB * slow + impB * 0.15;
      this.ind = this.ind * indDecay + impI;
      const pA = this.envA - this.slowA * 0.6, pB = this.envB - this.slowB * 0.6;
      let popS = 0;
      if (this.pop > 0.01) { popS = (this.rnd() * 2 - 1) * this.pop; this.pop *= 0.997; }
      let y = this.ring(this.resA, pA + popS * 0.5) + this.ring(this.resB, pB + popS * 0.5);
      // The thump under the note.
      const body = pA + pB;
      this.lp += (body - this.lp) * 0.06; this.lp2 += (this.lp - this.lp2) * 0.06;
      y = y * 2.0 + this.lp2 * 0.8;
      const drive = 1.1 + 2.2 * load;
      y = Math.tanh(y * drive) / Math.tanh(drive);
      // The induction howl: the suction pulses through the plenum, plus the rush of air.
      const nz = this.rnd() * 2 - 1; this.nb += (nz - this.nb) * (0.2 + 0.3 * x9);
      const iv = this.ring(this.resI, this.ind * 0.6 + this.nb * 0.4 * thr);
      y += iv * (0.35 + 0.65 * cabin) * 0.55 * (0.2 + 0.8 * thr);
      // The valve train's tick (order 12) and the gearbox's whine (its own speed).
      this.tick += 2 * Math.PI * fCrank * 12 / sr; if (this.tick > 2 * Math.PI) this.tick -= 2 * Math.PI;
      y += Math.sin(this.tick) * 0.008 * x9;
      this.gearPh += 2 * Math.PI * gearW / sr; if (this.gearPh > 2 * Math.PI) this.gearPh -= 2 * Math.PI;
      if (gearW < 0.45 * sr) y += Math.sin(this.gearPh) * 0.014 * Math.min(1, gearW / 1500) * (0.4 + 0.6 * load);
      // The level, then a DC block on what comes out (it sat before the last curve and left an offset).
      const v = Math.tanh(y * 0.55 * (1.1 + 1.0 * x9 * x9)) * on;
      this.hp = 0.9985 * this.hp + v - this.hpX; this.hpX = v;
      out[i] = this.hp;
    }
    return true;
  }
}
registerProcessor('gt3-flat6', Gt3Flat6);
`;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createGt3Sound() {
  let ctx = null, enabled = false, N = null, building = null, lastKerb = 0;

  async function build() {
    const A = audio();
    if (!A) return false;
    ctx = A.ctx;
    const r = rng(911);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    // The car's sound goes out through its place in the world (the level set at the chase
    // camera's ≈7 m); the wind, the listener's own, straight to the bus.
    const master = gain(0), place = createSpatial(7), direct = gain(0);
    master.connect(place.input); place.out.connect(direct); direct.connect(A.bus);
    const own = gain(0); own.connect(A.bus);
    // The cabin: closed in, the exhaust is muffled and the induction behind the seats comes forward.
    const cabinLp = ctx.createBiquadFilter(); cabinLp.type = 'lowpass'; cabinLp.frequency.value = 18000; cabinLp.Q.value = 0.5;
    cabinLp.connect(master);
    let engine = null, fallback = null;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      engine = new AudioWorkletNode(ctx, 'gt3-flat6', { numberOfOutputs: 1, outputChannelCount: [1] });
      engine.connect(cabinLp);
    } catch {
      const eng = gain(0); eng.connect(cabinLp);
      const osc = (type, level) => { const o = ctx.createOscillator(); o.type = type; const g = gain(level); o.connect(g); g.connect(eng); o.start(); return o; };
      fallback = { eng, o3: osc('sawtooth', 0.5), o15: osc('square', 0.15), o6: osc('triangle', 0.2) };
    }
    const sq = ctx.createBiquadFilter(); sq.type = 'bandpass'; sq.frequency.value = 1150; sq.Q.value = 14;
    const sqG = gain(0); loopNoise().connect(sq); sq.connect(sqG); sqG.connect(master);
    const gr = ctx.createBiquadFilter(); gr.type = 'lowpass'; gr.frequency.value = 260;
    const grG = gain(0); loopNoise().connect(gr); gr.connect(grG); grG.connect(master);
    const wd = ctx.createBiquadFilter(); wd.type = 'lowpass'; wd.frequency.value = 700;
    const wdG = gain(0); loopNoise().connect(wd); wd.connect(wdG); wdG.connect(own);
    // The tyres rolling on the road: broadband round ≈1 kHz (≈), through the cabin's filter.
    const rl = ctx.createBiquadFilter(); rl.type = 'bandpass'; rl.frequency.value = 900; rl.Q.value = 0.7;
    const rlG = gain(0); loopNoise().connect(rl); rl.connect(rlG); rlG.connect(cabinLp);
    // The kerbs: their coarse surface drummed through the tyres and the body, a low rumble whose
    // pitch follows the speed over a ≈25 cm texture (≈), and a thump each time a wheel goes over
    // the kerb's ≈3 cm edge.
    const kb = ctx.createBiquadFilter(); kb.type = 'bandpass'; kb.frequency.value = 60; kb.Q.value = 2.2;
    const kbG = gain(0); loopNoise().connect(kb); kb.connect(kbG); kbG.connect(master);
    const th = ctx.createBiquadFilter(); th.type = 'lowpass'; th.frequency.value = 90;
    const thG = gain(0); loopNoise().connect(th); th.connect(thG); thG.connect(master);
    N = { master, place, direct, own, engine, fallback, cabinLp, sq, sqG, grG, wd, wdG, rl, rlG, kb, kbG, thG, r };
    return true;
  }

  const set = (p, v, tc = 0.04) => p.setTargetAtTime(v, ctx.currentTime, tc);
  const LEVEL = 0.7;

  return {
    get enabled() { return enabled; },
    get contextState() { return ctx?.state ?? 'none'; },
    setEnabled(on) {
      enabled = !!on;
      claim('gt3', enabled);
      if (enabled && !ctx && !building) building = build().then(ok => { if (!ok) { enabled = false; claim('gt3', false); } });
      if (N) { set(N.direct.gain, enabled ? 1 : 0, 0.08); set(N.own.gain, enabled ? 1 : 0, 0.08); }
    },
    /**
     * Per frame while driving: `s` the car's state (rpm, u, v, slip[4], gear, shift), `i` its
     * input (throttle), `surface` the kind under the rear tyres ('track', 'gravel', …), `inside`
     * true with the camera in the cabin; `where` the car's position and the camera (from outside,
     * the car is heard where it is), `dt` the frame's time.
     */
    update(s, i, surface = 'track', inside = false, where = null, dt = 1 / 60) {
      if (!enabled || !ctx || !N) return;
      set(N.master.gain, LEVEL, 0.08); set(N.direct.gain, 1, 0.08); set(N.own.gain, 1, 0.08);
      if (where) { placeListener(where.camera); N.place.update(where.pos, where.camera, inside, 1, dt); }
      else N.place.update({ x: 0, y: 0, z: 0 }, { position: { x: 0, y: 0, z: 0 } }, true, 1, dt);
      const dead = !!(s.dead || s.drowned);
      // The throttle the engine gets: the PDK's blips on a downshift, Launch Control's hold.
      const rpm = dead ? 0 : Math.max(600, s.rpm), thr = dead ? 0 : Math.max(0, Math.min(1, s.engThr ?? i.throttle));
      // Load: the engine's (cut through an upshift, at the limiter), trimmed by the traction control.
      const upshift = s.shift > 0 && s.shiftDir > 0;
      const load = dead ? 0 : Math.max(0, Math.min(1, (s.engLoad ?? thr) * (s.tcCut ?? 1)));
      const cut = upshift || rpm >= 9000 ? 1 : 0;
      const gearW = Math.abs((s.w?.[2] ?? 0) + (s.w?.[3] ?? 0)) / 2 * 4.27 / (2 * Math.PI) * 11;   // the pinion's mesh, Hz (4.27 final drive; ≈11 teeth)
      if (N.engine) {
        const P = N.engine.parameters, t0 = ctx.currentTime;
        P.get('rpm').setTargetAtTime(rpm, t0, 0.015); P.get('load').setTargetAtTime(load, t0, 0.02);
        P.get('thr').setTargetAtTime(thr, t0, 0.01); P.get('cut').setValueAtTime(cut, t0);
        P.get('on').setTargetAtTime(dead ? 0 : 1, t0, 0.01); P.get('gearW').setTargetAtTime(gearW, t0, 0.03);
        P.get('cabin').setTargetAtTime(inside ? 1 : 0, t0, 0.1);
      } else if (N.fallback) {
        const f = rpm / 60 * 3;
        set(N.fallback.o3.frequency, f, 0.012); set(N.fallback.o15.frequency, f / 2, 0.012); set(N.fallback.o6.frequency, f * 2, 0.012);
        set(N.fallback.eng.gain, dead ? 0 : 0.1 + 0.25 * thr, 0.03);
      }
      set(N.cabinLp.frequency, inside ? 3800 : 18000, 0.1);
      const t = ctx.currentTime;
      // Tyres: how far past the grip's peak (slip ≈1 at the peak, as the drive's marks use it).
      const over = Math.max(0, ...s.slip.map((k, j) => (k - 1) * Math.min(1, (s.load?.[j] ?? 3000) / 3000))), speed = Math.hypot(s.u, s.v);
      const hard = surface !== 'gravel' && surface !== 'grass';
      set(N.sqG.gain, hard ? Math.min(0.28, 0.5 * over) * Math.min(1, speed / 4) : 0, 0.05);
      set(N.sq.frequency, 1050 + 180 * Math.sin(t * 7.3) + 120 * N.r(), 0.05);
      set(N.grG.gain, hard ? 0 : Math.min(0.5, speed / 25), 0.08);
      // The wind is the listener's: in the cabin, a hiss round the glass; outside, the camera
      // flies with the car only in the chase view, and a microphone there would hear it too (≈).
      set(N.wdG.gain, Math.min(0.35, (speed / 80) ** 2 * 0.35) * (inside ? 0.6 : 0.5), 0.1);
      set(N.rlG.gain, hard ? Math.min(0.32, 0.05 * (speed / 10) ** 1.5) : 0, 0.08);
      set(N.rl.frequency, 700 + 6 * speed, 0.1);
      const { kerb } = underWheels(s);
      set(N.kbG.gain, kerb ? Math.min(0.45, (0.12 + 0.07 * kerb) * Math.min(1, speed / 6)) : 0, 0.03);
      set(N.kb.frequency, Math.max(35, Math.min(420, speed / 0.25)), 0.03);
      if (kerb !== lastKerb && speed > 2) {
        // A wheel onto or off the edge: a short low thump, harder the faster.
        const p = N.thG.gain, a = Math.min(0.6, 0.15 + speed / 60);
        p.cancelScheduledValues(t); p.setValueAtTime(a, t); p.setTargetAtTime(0, t + 0.01, 0.035);
      }
      lastKerb = kerb;
    },
    stop() { if (ctx && N) { set(N.master.gain, 0, 0.05); set(N.own.gain, 0, 0.05); } },
  };
}
