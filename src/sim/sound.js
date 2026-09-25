/**
 * Launch sound, synthesised, and opt-in: nothing is created or played until the visitor turns
 * it on from the mission panel (a click, which is also what browsers require before audio).
 *
 * What it models, and what it does not. A rocket heard from the ground is a deep rumble with
 * a harsh, tearing crackle on top — the crackle is the supersonic jet's shocks reaching the
 * listener as a stream of sharp pressure spikes — and all of it arrives late: sound travels at
 * about 343 m/s, so from 450 m the pad is lit 1,3 s before anything is heard, and a vehicle
 * 10 km up is heard where it was half a minute ago. Here each source (booster, ship) is heard
 * with the throttle it had at t − d/343, loudness falls off with distance, the high end is
 * absorbed with distance (a far launch is all rumble), and the thin air at altitude carries
 * less and less. It is not a recording and not a measured spectrum: the three bands and their
 * levels are chosen by ear.
 */
const C_SOUND = 343;
const REF_D = 160;                       // full level inside this distance

function noiseBuffer(ctx, seconds, fill) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  fill(buf.getChannelData(0), ctx.sampleRate);
  return buf;
}
// Deterministic generator: the buffers are the same on every visit.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createLaunchSound({ launch, camera }) {
  let ctx = null, master = null, air = null, rumble = null, roar = null, crackle = null;
  let enabled = false;
  const out = [{ pos: camera.position.clone() }, { pos: camera.position.clone() }];
  const heardOut = [{ pos: camera.position.clone() }, { pos: camera.position.clone() }];

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const r = rng(7);
    // Brown noise for the rumble (integrated white noise: energy piled into the lows).
    const brown = noiseBuffer(ctx, 4, (d) => { let v = 0; for (let i = 0; i < d.length; i++) { v = (v + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = v * 3.5; } });
    const white = noiseBuffer(ctx, 3, (d) => { for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; });
    // Crackle: sparse spikes with a heavy-tailed amplitude, each a few milliseconds long.
    const spikes = noiseBuffer(ctx, 3, (d, sr) => {
      let i = 0;
      while (i < d.length) {
        i += Math.floor(sr * (-Math.log(1 - r()) / 90));       // ~90 spikes a second
        const a = Math.pow(r(), 3) * (r() < 0.5 ? -1 : 1);
        const len = Math.floor(sr * (0.0015 + r() * 0.004));
        for (let k = 0; k < len && i + k < d.length; k++) d[i + k] += a * Math.exp(-k / (len * 0.3));
        i += len;
      }
    });
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    master = ctx.createGain(); master.gain.value = 0.9;
    air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 12000; air.Q.value = 0.5;
    air.connect(master); master.connect(ctx.destination);
    const band = (src, type, f, q, g0) => {
      const f1 = ctx.createBiquadFilter(); f1.type = type; f1.frequency.value = f; f1.Q.value = q;
      const g = ctx.createGain(); g.gain.value = g0;
      loop(src).connect(f1); f1.connect(g); g.connect(air);
      return g;
    };
    rumble = band(brown, 'lowpass', 110, 0.7, 0);
    roar = band(white, 'bandpass', 420, 0.55, 0);
    crackle = band(spikes, 'highpass', 700, 0.7, 0);
    return true;
  }

  function setEnabled(on) {
    enabled = on;
    if (on && !ctx && !build()) { enabled = false; return; }
    if (!ctx) return;
    if (on) ctx.resume?.();
    else { for (const g of [rumble, roar, crackle]) g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
  }

  /** Called once per frame. */
  function update() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    let level = 0, nearest = Infinity;
    if (launch.running && launch.state.speed > 0) {
      const t = launch.state.t;
      launch.sources(t, out);
      for (let i = 0; i < 2; i++) {
        const d = camera.position.distanceTo(out[i].pos);
        const src = launch.sources(t - d / C_SOUND, heardOut)[i];
        if (!(src.throttle > 0.001)) continue;
        // Thin air carries little: the level scales with the ambient pressure at the source.
        const p = Math.exp(-Math.max(src.altitude, 0) / 7500);
        const l = src.throttle * p * Math.min(1, REF_D / Math.max(d, 1));
        if (l > level) { level = l; nearest = d; }
      }
    }
    const k = Math.min(1, level);
    // Near: all three bands. Far: the air takes the top off, and the crackle goes first.
    const near = Math.min(1, REF_D * 3 / Math.max(nearest, 1));
    rumble.gain.setTargetAtTime(0.9 * Math.pow(k, 0.6), now, 0.12);
    roar.gain.setTargetAtTime(0.35 * Math.pow(k, 0.8) * (0.4 + 0.6 * near), now, 0.12);
    crackle.gain.setTargetAtTime(0.55 * Math.pow(k, 0.8) * near, now, 0.08);
    air.frequency.setTargetAtTime(Math.max(350, Math.min(14000, 14000 * Math.pow(near, 1.6))), now, 0.2);
  }

  return { setEnabled, update, get enabled() { return enabled; } };
}
