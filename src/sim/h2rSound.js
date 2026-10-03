/**
 * The Ninja H2R's sound, synthesised, and opt-in like the Porsche's: nothing is created or played
 * until the visitor turns it on from the ride bar (a click, which browsers require for audio).
 *
 * What it models (≈, chosen by ear, not a recording or a measured spectrum):
 *  - The inline four's firing: a four-stroke four fires twice a turn, so the main note is order
 *    2 of the crank — 483 Hz at the 14,500 /min limiter, 43 Hz at idle — with order 4 above it
 *    and a little order 1 for the crank's own unevenness.
 *  - The supercharger: its impeller, gear-driven from the crank, whines at a fixed multiple of
 *    the engine's speed — ≈9.2 times, the up to ≈130,000 /min Kawasaki gives for it at the top of
 *    the range — louder with the boost (the throttle and the revs).
 *  - Load: the throttle opens the induction (band noise tracking the firing) and the exhaust's
 *    rasp; shut at high revs, a short chirp as the boost bleeds off, and now and then a crackle.
 *  - The tyres sliding on a hard surface, gravel's rumble off it, and the wind, which on a bike
 *    is most of what is heard at speed.
 */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const MAX = 14500, BLOWER = 9.2;

export function createH2rSound() {
  let ctx = null, enabled = false, N = null;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const r = rng(1000);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    const master = gain(0.7);
    master.connect(comp); comp.connect(ctx.destination);
    const eng = gain(1), clip = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), engOut = gain(0);
    clip.curve = Float32Array.from({ length: 1025 }, (_, i) => { const x = (i / 512 - 1) * 2.6; return Math.tanh(x) * 0.8; });
    clip.oversample = '2x';
    tone.type = 'lowpass'; tone.Q.value = 1.1;
    eng.connect(clip); clip.connect(tone); tone.connect(engOut); engOut.connect(master);
    const osc = (type, level, out = eng) => { const o = ctx.createOscillator(); o.type = type; const g = gain(level); o.connect(g); g.connect(out); o.start(); return o; };
    const o2 = osc('sawtooth', 0.55), o1 = osc('square', 0.1), o4 = osc('triangle', 0.25);
    // The supercharger's whine: a pure tone, straight to the output.
    const whG = gain(0); whG.connect(master);
    const wh = osc('sine', 1, whG), wh2 = osc('sine', 0.25, whG);
    const ind = ctx.createBiquadFilter(); ind.type = 'bandpass'; ind.Q.value = 3;
    const indG = gain(0); loopNoise().connect(ind); ind.connect(indG); indG.connect(master);
    // The chirp: a quick falling band as the throttle shuts on boost.
    const ch = ctx.createBiquadFilter(); ch.type = 'bandpass'; ch.Q.value = 6;
    const chG = gain(0); loopNoise().connect(ch); ch.connect(chG); chG.connect(master);
    const pop = ctx.createBiquadFilter(); pop.type = 'bandpass'; pop.frequency.value = 2000; pop.Q.value = 0.7;
    const popG = gain(0); loopNoise().connect(pop); pop.connect(popG); popG.connect(master);
    const sq = ctx.createBiquadFilter(); sq.type = 'bandpass'; sq.frequency.value = 1250; sq.Q.value = 14;
    const sqG = gain(0); loopNoise().connect(sq); sq.connect(sqG); sqG.connect(master);
    const gr = ctx.createBiquadFilter(); gr.type = 'lowpass'; gr.frequency.value = 260;
    const grG = gain(0); loopNoise().connect(gr); gr.connect(grG); grG.connect(master);
    const wd = ctx.createBiquadFilter(); wd.type = 'lowpass'; wd.frequency.value = 900;
    const wdG = gain(0); loopNoise().connect(wd); wd.connect(wdG); wdG.connect(master);
    N = { master, o1, o2, o4, wh, wh2, whG, tone, engOut, ind, indG, ch, chG, popG, sq, sqG, grG, wdG, popUntil: 0, chirpUntil: 0, lastThr: 0, r };
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
      if (on && !ctx && !build()) return;
      enabled = !!on;
      if (!ctx) return;
      if (enabled) ctx.resume?.();
      set(N.master.gain, enabled ? 0.7 : 0, 0.08);
    },
    /** Per frame while riding: `s` the bike's state (rpm, u, slide, crashed), `i` its input. */
    update(s, i, surface = 'track') {
      if (!enabled || !ctx || !N) return;
      set(N.master.gain, 0.7, 0.08);
      const dead = !!s.crashed;
      const rpm = Math.max(600, dead ? 0 : s.rpm), f = rpm / 60 * 2, thr = dead ? 0 : Math.max(0, Math.min(1, i.throttle));
      set(N.o2.frequency, f, 0.01); set(N.o1.frequency, f / 2, 0.01); set(N.o4.frequency, f * 2, 0.01);
      set(N.tone.frequency, 600 + 1400 * (rpm / MAX) + 4800 * thr, 0.03);
      set(N.engOut.gain, dead ? 0 : 0.10 + 0.22 * thr + 0.10 * rpm / MAX, 0.03);
      const blower = rpm * BLOWER / 60;
      set(N.wh.frequency, blower, 0.02); set(N.wh2.frequency, blower * 2, 0.02);
      set(N.whG.gain, dead ? 0 : 0.012 + 0.05 * thr * (rpm / MAX) ** 1.5, 0.05);
      set(N.ind.frequency, f * 2, 0.02);
      set(N.indG.gain, 0.12 * thr * (0.4 + rpm / MAX), 0.04);
      const t = ctx.currentTime;
      // Throttle snapped shut on boost: the chirp.
      if (N.lastThr > 0.6 && thr < 0.2 && rpm > 8000) { N.chirpUntil = t + 0.18; set(N.ch.frequency, 3200, 0.001); set(N.ch.frequency, 1400, 0.06); }
      N.lastThr = thr;
      set(N.chG.gain, t < N.chirpUntil ? 0.3 : 0, 0.01);
      if (thr < 0.05 && rpm > 7000 && t > N.popUntil && N.r() < 0.02) N.popUntil = t + 0.04 + 0.1 * N.r();
      set(N.popG.gain, t < N.popUntil ? 0.3 * (0.5 + N.r()) : 0, 0.006);
      const speed = Math.abs(s.u), hard = surface !== 'gravel' && surface !== 'grass';
      set(N.sqG.gain, hard ? Math.min(0.28, (s.slide ?? 0) * 1.2) * Math.min(1, speed / 4) : 0, 0.05);
      set(N.sq.frequency, 1150 + 180 * Math.sin(t * 7.3) + 120 * N.r(), 0.05);
      set(N.grG.gain, hard && !dead ? 0 : Math.min(0.5, speed / 20), 0.08);
      set(N.wdG.gain, Math.min(0.5, (speed / 70) ** 2 * 0.45), 0.1);
    },
    stop() { if (ctx && N) set(N.master.gain, 0, 0.05); },
  };
}
