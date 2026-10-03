/**
 * The Ninja H2R's sound, synthesised sample by sample, and opt-in like the Porsche's: nothing is
 * created or played until the visitor turns it on (a click, which browsers require for audio).
 *
 * How (≈, chosen by ear against onboard recordings; not a recording):
 *  - The exhaust is built from its pulses. An inline four with a 180° crank fires evenly, twice a
 *    revolution, in the order 1-2-4-3: each firing is a pressure pulse — a fast rise and a decay
 *    of ≈1.5 ms — its size set by the load, with a little difference from cylinder to cylinder
 *    (the headers' lengths), so the note has the slight roughness a real four has. The pulse train
 *    rings the exhaust's resonances (≈ the collector, the headers and the silencer's cavity) and is
 *    clipped softly, more under load: a low howl at low revs, a scream towards 14,000.
 *  - The supercharger: its impeller, driven by the crank through gears, whines at ≈9.2 times the
 *    crank's speed (up to ≈130,000 /min, as Kawasaki gives it), louder with the boost; when the
 *    throttle snaps shut on boost, the recirculation chirps.
 *  - Overrun: with the throttle shut at high revs, the pulses weaken and some cylinders misfire into
 *    the hot exhaust — pops and crackles.
 *  - The primary gears' whine (49 teeth on the crank) under load, the intake's roar through the ram
 *    air, the quick-shifter's cut and the limiter's stutter come from the engine's own state; the
 *    tyres sliding and the wind (most of what a rider hears at speed) are mixed in on top.
 * Off the worklet (an old browser), it falls back to a few oscillators.
 */
const WORKLET = `
class H2RExhaust extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rpm = 1300; this.load = 0; this.thr = 0; this.cut = 0; this.on = 0;
    this.tRpm = 1300; this.tLoad = 0; this.tThr = 0; this.tCut = 0;
    this.theta = 0; this.next = 0; this.cyl = 0;
    this.env = 0; this.envSlow = 0; this.pop = 0; this.chirp = 0; this.lastThr = 0;
    this.sc = 0; this.gear = 0; this.seed = 12345;
    // Resonators (biquad band-passes) — state per filter.
    this.res = [ { f: 170, q: 3.2, g: 1.0 }, { f: 480, q: 4.5, g: 0.55 }, { f: 1150, q: 5, g: 0.3 }, { f: 2600, q: 3, g: 0.12 } ].map(r => ({ ...r, x1: 0, x2: 0, y1: 0, y2: 0, b0: 0, a1: 0, a2: 0 }));
    this.cylGain = [1.0, 0.93, 1.05, 0.97];
    this.lp = 0; this.lp2 = 0; this.hp = 0; this.nb = 0;
    this.port.onmessage = (e) => { const d = e.data; this.tRpm = d.rpm; this.tLoad = d.load; this.tThr = d.thr; this.tCut = d.cut; this.on = d.on; };
  }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  design(r, sr) {
    const w = 2 * Math.PI * r.f / sr, al = Math.sin(w) / (2 * r.q);
    const a0 = 1 + al; r.b0 = al / a0; r.a1 = -2 * Math.cos(w) / a0; r.a2 = (1 - al) / a0;
  }
  process(_, outputs) {
    const out = outputs[0][0], sr = sampleRate, n = out.length;
    // Smooth the controls over the block.
    this.rpm += (this.tRpm - this.rpm) * 0.25; this.load += (this.tLoad - this.load) * 0.2;
    this.thr += (this.tThr - this.thr) * 0.3; this.cut = this.tCut;
    // The resonances shift a little with the exhaust's temperature (≈ with revs and load).
    const heat = 1 + 0.12 * (this.rpm / 14000) + 0.05 * this.load;
    this.res[0].f = 170 * heat; this.res[1].f = 480 * heat; this.res[2].f = 1150 * heat; this.res[3].f = 2600 * heat;
    for (const r of this.res) this.design(r, sr);
    if (this.lastThr > 0.6 && this.thr < 0.2 && this.rpm > 8000) this.chirp = 1;
    this.lastThr = this.thr;
    const fCrank = this.rpm / 60, dTheta = 2 * Math.PI * fCrank / sr;
    const decay = Math.exp(-1 / (sr * (0.0011 + 0.0012 * (1 - this.rpm / 15000))));
    const slow = Math.exp(-1 / (sr * 0.006));
    const overrun = this.thr < 0.06 && this.rpm > 6000;
    for (let i = 0; i < n; i++) {
      this.theta += dTheta;
      let imp = 0;
      // A firing every 180° of crank.
      while (this.theta >= this.next) {
        this.next += Math.PI;
        const c = this.cyl; this.cyl = (this.cyl + 1) % 4;
        let a = (0.22 + 0.78 * this.load) * (0.55 + 0.75 * this.rpm / 14000) * this.cylGain[c] * (0.92 + 0.16 * this.rnd());
        if (this.cut > 0.5) a *= this.rnd() < 0.85 ? 0.04 : 0.6;      // the limiter / the quick-shifter's cut
        if (overrun) {
          a *= 0.18;
          if (this.rnd() < 0.035 * Math.min(1, this.rpm / 12000)) this.pop = 0.9 + 0.6 * this.rnd();   // a misfire lights in the pipe
        }
        imp += a;
      }
      if (this.theta > 1e6) { this.theta -= 1e6; this.next -= 1e6; }
      // The pulse: a fast rise into a short decay (two one-pole envelopes).
      this.env = this.env * decay + imp;
      this.envSlow = this.envSlow * slow + imp * 0.15;
      const pulse = this.env - this.envSlow * 0.6;
      // Pops: bursts of noise, decaying in ≈20 ms.
      let popS = 0;
      if (this.pop > 0.01) { popS = (this.rnd() * 2 - 1) * this.pop; this.pop *= 0.9975; }
      // Ring the exhaust's resonances.
      let y = 0;
      const x = pulse + popS * 0.8;
      for (const r of this.res) {
        const o = r.b0 * x - r.b0 * r.x2 - r.a1 * r.y1 - r.a2 * r.y2;
        r.x2 = r.x1; r.x1 = x; r.y2 = r.y1; r.y1 = o;
        y += o * r.g;
      }
      // The body of the pulse itself, low-passed: the thump under the note.
      this.lp += (pulse - this.lp) * 0.08; this.lp2 += (this.lp - this.lp2) * 0.08;
      y = y * 2.2 + this.lp2 * 0.9;
      // Soft clipping, harder with the load (the rasp).
      const drive = 1.2 + 2.4 * this.load;
      y = Math.tanh(y * drive) / Math.tanh(drive);
      // Supercharger whine: ≈9.2 × the crank, two harmonics, with the boost.
      this.sc += 2 * Math.PI * fCrank * 9.2 / sr; if (this.sc > 1e6) this.sc -= 1e6;
      const boost = this.load * Math.pow(this.rpm / 14000, 1.6);
      y += (Math.sin(this.sc) * 0.9 + Math.sin(this.sc * 2) * 0.25) * (0.006 + 0.07 * boost);
      // Primary gear whine (49 teeth on the crank).
      this.gear += 2 * Math.PI * fCrank * 49 / sr; if (this.gear > 1e6) this.gear -= 1e6;
      y += Math.sin(this.gear) * 0.012 * this.load * (this.rpm / 14000);
      // The recirculation chirp: a falling whistle as the boost bleeds off.
      if (this.chirp > 0.01) { y += Math.sin(this.sc * (0.6 + this.chirp)) * this.chirp * 0.18; this.chirp *= 0.99965; }
      // Intake roar through the ram air: band noise.
      const nz = this.rnd() * 2 - 1; this.nb += (nz - this.nb) * (0.15 + 0.3 * this.rpm / 14000);
      y += this.nb * 0.05 * this.thr * (0.3 + this.rpm / 14000);
      // A DC block.
      const o = y - this.hp; this.hp += o * 0.002;
      out[i] = Math.tanh(o * 0.6 * (0.8 + 1.6 * (this.rpm / 14000) ** 2)) * this.on;
    }
    return true;
  }
}
registerProcessor('h2r-exhaust', H2RExhaust);
`;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const MAX = 14500;

export function createH2rSound() {
  let ctx = null, enabled = false, N = null, building = null;

  async function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const r = rng(1000);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const master = gain(0.8);
    master.connect(comp); comp.connect(ctx.destination);
    let engine = null, fallback = null;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      engine = new AudioWorkletNode(ctx, 'h2r-exhaust', { numberOfOutputs: 1, outputChannelCount: [1] });
      engine.connect(master);
    } catch {
      // No worklet: a few oscillators on the firing orders.
      const eng = gain(0); eng.connect(master);
      const osc = (type, level) => { const o = ctx.createOscillator(); o.type = type; const g = gain(level); o.connect(g); g.connect(eng); o.start(); return o; };
      fallback = { eng, o2: osc('sawtooth', 0.5), o4: osc('triangle', 0.25) };
    }
    const sq = ctx.createBiquadFilter(); sq.type = 'bandpass'; sq.frequency.value = 1250; sq.Q.value = 14;
    const sqG = gain(0); loopNoise().connect(sq); sq.connect(sqG); sqG.connect(master);
    const gr = ctx.createBiquadFilter(); gr.type = 'lowpass'; gr.frequency.value = 260;
    const grG = gain(0); loopNoise().connect(gr); gr.connect(grG); grG.connect(master);
    // The wind round the helmet: broadband, low-passed, rising with the square of the speed.
    const wd = ctx.createBiquadFilter(); wd.type = 'lowpass'; wd.frequency.value = 900;
    const wdG = gain(0); loopNoise().connect(wd); wd.connect(wdG); wdG.connect(master);
    N = { master, engine, fallback, sq, sqG, grG, wd, wdG, r };
    return true;
  }

  const set = (p, v, tc = 0.04) => p.setTargetAtTime(v, ctx.currentTime, tc);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend?.();
      else if (enabled) ctx.resume?.();
    });
  }

  return {
    get enabled() { return enabled; },
    get contextState() { return ctx?.state ?? 'none'; },
    setEnabled(on) {
      enabled = !!on;
      if (enabled && !ctx && !building) building = build().then(ok => { if (!ok) enabled = false; });
      if (!ctx) return;
      if (enabled) ctx.resume?.();
      if (N) set(N.master.gain, enabled ? 0.8 : 0, 0.08);
    },
    /** Per frame while riding: `s` the bike's state, `i` its input, `surface` what is underneath. */
    update(s, i, surface = 'track') {
      if (!enabled || !ctx || !N) return;
      set(N.master.gain, 0.8, 0.08);
      const dead = !!s.crashed;
      const rpm = dead ? 0 : Math.max(900, s.rpm), thr = dead ? 0 : Math.max(0, Math.min(1, i.throttle));
      // Load: the throttle, held down a little by the traction control's and the shifter's cuts.
      const load = thr * (s.tc ? 0.6 : 1) * (s.shift > 0 ? 0.1 : 1);
      if (N.engine) N.engine.port.postMessage({ rpm, load, thr, cut: s.fuelCut || s.shift > 0 ? 1 : 0, on: dead ? 0 : 1 });
      else if (N.fallback) {
        const f = rpm / 60 * 2;
        set(N.fallback.o2.frequency, f, 0.01); set(N.fallback.o4.frequency, f * 2, 0.01);
        set(N.fallback.eng.gain, dead ? 0 : 0.1 + 0.25 * thr, 0.03);
      }
      const t = ctx.currentTime, speed = Math.abs(s.u), hard = surface !== 'gravel' && surface !== 'grass';
      const sliding = Math.max(s.slide ?? 0, Math.max(0, (s.slip ?? 0) - 0.15) * 2, s.lock > 0 ? 0.4 : 0);
      set(N.sqG.gain, hard ? Math.min(0.3, sliding * 1.2) * Math.min(1, speed / 4) : 0, 0.05);
      set(N.sq.frequency, 1150 + 180 * Math.sin(t * 7.3) + 120 * N.r(), 0.05);
      set(N.grG.gain, (hard && !dead) ? 0 : Math.min(0.5, speed / 20), 0.08);
      set(N.wdG.gain, Math.min(0.6, (speed / 70) ** 2 * 0.5), 0.1);
      set(N.wd.frequency, 500 + speed * 12, 0.1);
      void MAX;
    },
    stop() { if (ctx && N) set(N.master.gain, 0, 0.05); },
  };
}
