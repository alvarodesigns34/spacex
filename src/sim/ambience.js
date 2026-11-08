/**
 * The site's ambient sound: the surf and the wind, synthesised, driven by what the scene already
 * simulates. Until 8 November 2026 the centre was silent unless an engine ran.
 *
 *  - Surf: brown noise (the low roar of breaking water) through a band-pass, swelling as each crest
 *    of the long swell reaches the beach — the same swell phase that drives the swash foam
 *    (environment.js, core/ocean.js), so what is heard breaking is what is seen breaking. It falls
 *    with the distance from the waterline: as 1/d past 30 m (spreading from a line source is 1/√d;
 *    the extra fall stands in for the dunes and the site between, ≈), and duller with distance.
 *  - Wind: pink noise through a band-pass whose level and brightness follow the site's wind at the
 *    camera's height (core/wind.js: the measured mean, its gusts), a rustle at 6 m/s, a roar aloft.
 * Neither is a recording (none with a licence to ship was used); both are tuned by ear, ≈.
 *
 * Off in space and the orbital views. The levels are pure functions (surfLevel, windLevel) so
 * tools/ambience-check.mjs can test them without a browser.
 */
import { audio, claim } from './audioBus.js';
import { offshore, oceanPhases, WAVES, OCEAN_CLOCK } from '../core/ocean.js';
import { windAt } from '../core/wind.js';

/** Surf loudness 0..1 at d metres from the waterline (negative inland), at swell phase `ph` (rad). */
export function surfLevel(d, ph) {
  const dist = Math.max(Math.abs(d), 1);
  const spread = Math.min(1, 30 / dist);
  // Each breaker: a quick rise as the crest falls, a long hiss as it runs up the sand.
  const s = 0.5 + 0.5 * Math.sin(ph);
  const breaker = 0.45 + 0.55 * Math.pow(s, 3);
  return spread * breaker;
}
/** Wind loudness 0..1 and band centre (Hz) for a wind speed in m/s. */
export function windLevel(speed) {
  const v = Math.max(0, speed);
  // Wind noise at the ear rises steeply with speed (≈ v^2 in power past a few m/s).
  const level = Math.min(1, Math.pow(v / 18, 2));
  return { level, freq: 250 + 45 * v };
}

function noiseBuffer(ctx, kind) {
  const n = ctx.sampleRate * 4, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  // A fixed seed: the same noise every visit.
  let seed = kind === 'brown' ? 1234567 : 7654321;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let i = 0; i < n; i++) {
    const w = rnd();
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
  }
  return buf;
}

export function createAmbience() {
  let on = false, nodes = null;
  const wind = { x: 0, y: 0, z: 0 };
  const ph = new Float32Array(WAVES.length);

  function build() {
    const A = audio();
    if (!A) return null;
    const { ctx, bus } = A;
    const mk = (kind, type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, kind); src.loop = true;
      const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = f; filt.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(filt); filt.connect(g); g.connect(bus); src.start();
      return { src, filt, g };
    };
    return { ctx, surf: mk('brown', 'lowpass', 900, 0.5), wind: mk('pink', 'bandpass', 500, 0.7) };
  }

  return {
    get on() { return on; },
    /** Start or stop; starting must follow a click (browsers allow audio only after one). */
    set(v) {
      on = !!v;
      if (on && !nodes) nodes = build();
      claim('ambience', on);
      if (!on && nodes) { const t = nodes.ctx.currentTime; nodes.surf.g.gain.setTargetAtTime(0, t, 0.2); nodes.wind.g.gain.setTargetAtTime(0, t, 0.2); }
    },
    /** Per frame: the levels from where the camera is. `space` silences both (orbit, space). */
    update(camera, space = false) {
      if (!on || !nodes) return;
      const t = nodes.ctx.currentTime, p = camera.position;
      const h = Math.max(0, p.y);
      oceanPhases(OCEAN_CLOCK.value, ph);
      const d = offshore(p.x, p.z);
      // The long swell's phase at the shore nearest the camera (its first wave, as the swash).
      const w0 = WAVES[0];
      const swell = w0.k * (w0.dx * p.x + w0.dz * p.z) - ph[0] + w0.ph;
      const air = space ? 0 : Math.max(0, 1 - h / 600);
      const surf = surfLevel(d, swell) * air;
      nodes.surf.g.gain.setTargetAtTime(0.32 * surf, t, 0.25);
      nodes.surf.filt.frequency.setTargetAtTime(380 + 900 * Math.min(1, 40 / Math.max(Math.abs(d), 1)), t, 0.3);
      windAt(p.x, Math.max(h, 2), p.z, OCEAN_CLOCK.value, wind);
      const ws = windLevel(Math.hypot(wind.x, wind.y, wind.z));
      nodes.wind.g.gain.setTargetAtTime((space ? 0 : 0.22 * ws.level), t, 0.4);
      nodes.wind.filt.frequency.setTargetAtTime(ws.freq, t, 0.4);
    },
  };
}
