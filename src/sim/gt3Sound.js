/**
 * The GT3 RS's sound, synthesised, and opt-in like the launch's: nothing is created or played
 * until the visitor turns it on from the drive bar (a click, which browsers require for audio).
 *
 * What it models (≈, chosen by ear, not a recording or a measured spectrum):
 *  - The flat six's firing: a four-stroke six fires three times a turn, so the engine's main
 *    note is order 3 of the crank — 450 Hz at the 9,000 /min cut, 45 Hz at idle — with the
 *    half orders a boxer's two banks add (1.5) and order 6 above it.
 *  - Load: the throttle opens the induction roar (band noise tracking the firing) and the
 *    exhaust's rasp (a soft clipper and a low-pass that opens with the throttle); closed at high
 *    revs, the overrun crackles now and then.
 *  - The tyres: a squeal that rises with how far each tyre is past its grip, on hard surfaces;
 *    gravel's rumble instead off the track.
 *  - The wind: low-passed noise growing with the square of the speed.
 */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createGt3Sound() {
  let ctx = null, enabled = false, N = null;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const r = rng(911);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    const master = gain(0.7);
    master.connect(comp); comp.connect(ctx.destination);
    // Engine: three orders, summed, clipped softly, low-passed by the load.
    const eng = gain(1), clip = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), engOut = gain(0);
    clip.curve = Float32Array.from({ length: 1025 }, (_, i) => { const x = (i / 512 - 1) * 2.2; return Math.tanh(x) * 0.8; });
    clip.oversample = '2x';
    tone.type = 'lowpass'; tone.Q.value = 0.9;
    eng.connect(clip); clip.connect(tone); tone.connect(engOut); engOut.connect(master);
    const osc = (type, level) => { const o = ctx.createOscillator(); o.type = type; const g = gain(level); o.connect(g); g.connect(eng); o.start(); return o; };
    const o3 = osc('sawtooth', 0.55), o15 = osc('square', 0.16), o6 = osc('triangle', 0.22);
    // Induction: noise in a band round order 6, opened by the throttle.
    const ind = ctx.createBiquadFilter(); ind.type = 'bandpass'; ind.Q.value = 3;
    const indG = gain(0); loopNoise().connect(ind); ind.connect(indG); indG.connect(master);
    // Overrun crackle: short noise bursts through a high band.
    const pop = ctx.createBiquadFilter(); pop.type = 'bandpass'; pop.frequency.value = 1800; pop.Q.value = 0.7;
    const popG = gain(0); loopNoise().connect(pop); pop.connect(popG); popG.connect(master);
    // Tyres: squeal (a narrow band, wavering) and gravel (low rumble).
    const sq = ctx.createBiquadFilter(); sq.type = 'bandpass'; sq.frequency.value = 1150; sq.Q.value = 14;
    const sqG = gain(0); loopNoise().connect(sq); sq.connect(sqG); sqG.connect(master);
    const gr = ctx.createBiquadFilter(); gr.type = 'lowpass'; gr.frequency.value = 260;
    const grG = gain(0); loopNoise().connect(gr); gr.connect(grG); grG.connect(master);
    // Wind.
    const wd = ctx.createBiquadFilter(); wd.type = 'lowpass'; wd.frequency.value = 700;
    const wdG = gain(0); loopNoise().connect(wd); wd.connect(wdG); wdG.connect(master);
    N = { master, o3, o15, o6, tone, engOut, ind, indG, popG, sq, sqG, grG, wdG, popUntil: 0, r };
    return true;
  }

  const set = (p, v, tc = 0.04) => p.setTargetAtTime(v, ctx.currentTime, tc);

  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      if (on && !ctx && !build()) return;
      enabled = !!on;
      if (!ctx) return;
      if (enabled) ctx.resume?.();
      set(N.master.gain, enabled ? 0.7 : 0, 0.08);
    },
    /**
     * Per frame while driving: `s` the car's state (rpm, u, v, slip[4], gear), `i` its input
     * (throttle), `surface` the kind under the rear tyres ('track', 'gravel', …).
     */
    update(s, i, surface = 'track') {
      if (!enabled || !ctx || !N) return;
      set(N.master.gain, 0.7, 0.08);
      const rpm = Math.max(600, s.rpm), f = rpm / 60 * 3, thr = Math.max(0, Math.min(1, i.throttle));
      set(N.o3.frequency, f, 0.012); set(N.o15.frequency, f / 2, 0.012); set(N.o6.frequency, f * 2, 0.012);
      set(N.tone.frequency, 500 + 900 * (rpm / 9000) + 4200 * thr, 0.03);
      set(N.engOut.gain, 0.10 + 0.20 * thr + 0.10 * rpm / 9000, 0.03);
      set(N.ind.frequency, f * 2, 0.02);
      set(N.indG.gain, 0.12 * thr * (0.4 + rpm / 9000), 0.04);
      // Overrun: throttle shut above 4,500 /min, now and then a burst of pops.
      const t = ctx.currentTime;
      if (thr < 0.05 && rpm > 4500 && t > N.popUntil && N.r() < 0.02) N.popUntil = t + 0.05 + 0.12 * N.r();
      set(N.popG.gain, t < N.popUntil ? 0.35 * (0.5 + N.r()) : 0, 0.006);
      // Tyres: how far past the grip's peak (slip ≈1 at the peak, as the drive's marks use it).
      const over = Math.max(0, ...s.slip.map(k => k - 1)), speed = Math.hypot(s.u, s.v);
      const hard = surface !== 'gravel' && surface !== 'grass';
      set(N.sqG.gain, hard ? Math.min(0.28, 0.5 * over) * Math.min(1, speed / 4) : 0, 0.05);
      set(N.sq.frequency, 1050 + 180 * Math.sin(t * 7.3) + 120 * N.r(), 0.05);
      set(N.grG.gain, hard ? 0 : Math.min(0.5, speed / 25), 0.08);
      set(N.wdG.gain, Math.min(0.35, (speed / 80) ** 2 * 0.35), 0.1);
    },
    stop() { if (ctx && N) set(N.master.gain, 0, 0.05); },
  };
}
