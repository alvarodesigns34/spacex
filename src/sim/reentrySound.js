/**
 * Re-entry sound, synthesised and opt-in like the launch's (sound.js): the same "Sound" switch in
 * the mission panel turns both on, and nothing is created until it is pressed.
 *
 * No recording of a Starship re-entry exists (SpaceX's on-board views are silent), so what is
 * heard is physics applied to the model's own flight (reentryFlight.js), with every level set by
 * ear (≈):
 *  - Where and when: every source is heard where it was d/343 s ago. The chapter's scene moves
 *    with the ship (it stays at x = 0 and the ocean slides under it), so the delay is solved in
 *    the ocean's fixed frame: the ship at arc length s(τ), height h(τ), heard at τ = t − d(τ)/c.
 *  - The flow over the hull, for a camera riding with the ship (on board, the chase): its level
 *    follows the dynamic pressure ½ρv² (aerodynamic noise scales with it), its brightness the
 *    Mach number. High up, at entry, the air is too thin to carry anything: silence, building as
 *    the ship gets into the thicker air and fading again as it slows in the belly flop.
 *  - The sonic boom, from the moment the model's ship last flies above Mach 1.2 on the way down
 *    (as the launch's booster boom), heard far below as a double N-wave (nose and skirt),
 *    weaker the higher it was made.
 *  - The landing burn: three sea-level Raptors, then two, then one, at the cited times
 *    (reentryEnginesAt); the launch's roar recipe — deep body, roar, crackle — scaled by the
 *    engine count and the distance.
 *  - The splash: a heavy low impact and a long wash, at the cited splashdown, delayed by the
 *    distance; and near the water, the sea itself.
 * It is not a measured spectrum, and the boom's time is the model's, not the flight's.
 */
import { RE, reentryState, reentryEnginesAt, densityAt, toSplashAt } from './reentryFlight.js';
import { soundSpeedAt } from './launch.js';
import { audio, claim } from './audioBus.js';

const C_SOUND = 343;
const REF_D = 160;          // engines at full level inside this distance (the launch's)
const RIDE_D = 400;         // a camera this close to the ship rides in its air

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Dynamic pressure, Pa, at mission time t. */
export function dynamicPressureAt(t) {
  const s = reentryState(t);
  return 0.5 * densityAt(s.h) * (s.vx * s.vx + s.vh * s.vh);
}
/** Its peak over the glide (s, Pa), the flow noise's reference level. */
export const Q_PEAK = (() => {
  let best = { t: RE.entry, q: 0 };
  for (let t = RE.entry; t < RE.landingBurn; t += 1) { const q = dynamicPressureAt(t); if (q > best.q) best = { t, q }; }
  return best;
})();
/** When the ship last flies above Mach 1.2 on its way down: its boom's emission time. */
export const BOOM_T = (() => {
  for (let t = RE.transonic; t > RE.entry; t -= 0.25) {
    const s = reentryState(t);
    if (Math.hypot(s.vx, s.vh) > 1.2 * soundSpeedAt(s.h)) return t;
  }
  return RE.transonic - 20;
})();

/**
 * When a sound made by the ship reaches a listener at `cam` (scene frame) at mission time t:
 * the emission time τ = t − d(τ)/c, by fixed-point iteration (it converges while the ship is
 * slower than sound along the line of sight; above that the latest emission that has arrived is
 * kept). Returns { tau, d, x, y } — the ship then, in the scene frame of time t.
 */
export function heardAt(t, cam) {
  const s0 = reentryState(t).s;
  let tau = t, d = 0, x = 0, y = 0;
  for (let k = 0; k < 12; k++) {
    const s = reentryState(tau);
    x = s.s - s0; y = s.h;
    d = Math.hypot(x - cam.x, y - cam.y, cam.z);
    const next = t - d / C_SOUND;
    if (Math.abs(next - tau) < 1e-3) { tau = next; break; }
    tau = next;
  }
  return { tau, d, x, y };
}

export function createReentrySound({ reentry, camera }) {
  let ctx = null, enabled = false, master = null, panner = null, splashPan = null;
  let eng = null, flow = null, flowLP = null, sea = null;
  let oneShots = {}, lastTau = null, lastSplash = null;

  function build() {
    const A = audio();
    if (!A) return false;
    ctx = A.ctx;
    const r = rng(41);
    const buffer = (seconds, fill) => {
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
      fill(b.getChannelData(0), ctx.sampleRate);
      return b;
    };
    const white = buffer(4, (d) => { for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; });
    const brown = buffer(5, (d) => { let v = 0; for (let i = 0; i < d.length; i++) { v = (v + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = v * 3.5; } });
    const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(A.bus);
    const mkPanner = () => { const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.connect(master); return p; };
    panner = mkPanner(); splashPan = mkPanner();
    const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 12000; air.Q.value = 0.5;
    air.connect(panner);
    const band = (src, type, f, q, to = air) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(b); b.connect(g); g.connect(to); return g; };
    // The landing burn: the launch's bands, for three engines rather than thirty-nine.
    const skew = ctx.createWaveShaper();
    skew.curve = Float32Array.from({ length: 1025 }, (_, i) => { const x = i / 512 - 1; return Math.max(-1, Math.min(1, 0.4 * x + 0.9 * Math.max(0, x) ** 2 - 0.2 * Math.max(0, -x) ** 3)); });
    const pre = ctx.createGain(); pre.gain.value = 2.2;
    const cn = ctx.createBiquadFilter(); cn.type = 'bandpass'; cn.frequency.value = 1000; cn.Q.value = 0.4;
    loop(white, 1.03).connect(cn); cn.connect(pre); pre.connect(skew);
    eng = {
      air,
      rumble: band(loop(brown, 1.04), 'lowpass', 80, 0.8),
      roar: band(loop(white, 1.08), 'bandpass', 220, 0.5),
      crackle: band(skew, 'highpass', 600, 0.7),
    };
    // The flow over the hull: broadband noise, its top opening with the Mach number.
    flowLP = ctx.createBiquadFilter(); flowLP.type = 'lowpass'; flowLP.frequency.value = 400; flowLP.Q.value = 0.4;
    flowLP.connect(master);
    flow = { body: band(loop(brown, 0.8), 'lowpass', 160, 0.5, flowLP), hiss: band(loop(white, 0.95), 'bandpass', 900, 0.35, flowLP) };
    // The sea near the camera: a slow, low wash.
    const seaLP = ctx.createBiquadFilter(); seaLP.type = 'bandpass'; seaLP.frequency.value = 420; seaLP.Q.value = 0.3;
    sea = ctx.createGain(); sea.gain.value = 0;
    loop(brown, 0.5).connect(seaLP); seaLP.connect(sea); sea.connect(master);
    oneShots = {
      // Sonic boom: an N-wave, 0,15 s (a ≈50 m ship's is shorter than the booster's).
      boom: buffer(0.8, (d, sr) => { const T = 0.15; for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = t < T ? 1 - 2 * t / T : 0; } }),
      // Splash: a low impact under a rush of water that falls back over seconds.
      splash: buffer(5, (d, sr) => { const rr = rng(13); let lp = 0, lp2 = 0; for (let i = 0; i < d.length; i++) { const t = i / sr; lp += 0.04 * ((rr() * 2 - 1) - lp); lp2 += 0.3 * ((rr() * 2 - 1) - lp2); d[i] = Math.sin(2 * Math.PI * 32 * t) * Math.exp(-t / 0.25) * 0.8 + lp * 5 * Math.exp(-t / 0.6) + lp2 * 0.5 * Math.min(1, t / 0.15) * Math.exp(-t / 1.6); } }),
    };
    return true;
  }

  function play(name, { gain = 1, pan = master, lowpass = 20000, delay = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = oneShots[name];
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(pan);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    s.start(ctx.currentTime + delay);
  }

  const all = () => [eng.rumble, eng.roar, eng.crackle, flow.body, flow.hiss, sea];
  function silence(tc, k = 0.1) { for (const g of all()) g.gain.setTargetAtTime(0, tc, k); lastTau = lastSplash = null; }

  function setEnabled(on) {
    enabled = !!on;
    claim('reentry', enabled);
    if (enabled && !ctx && !build()) { enabled = false; claim('reentry', false); return; }
    if (!ctx) return;
    if (enabled) ctx.resume?.(); else silence(ctx.currentTime, 0.05);
  }

  const setPos = (p, x, y, z) => { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); };
  const _f = { x: 0, y: 0, z: 0 };

  /** Called once per frame, after the chapter has placed the ship and the camera. */
  function update() {
    if (!enabled || !ctx) return;
    const tc = ctx.currentTime, st = reentry.state;
    if (!reentry.running || st.paused || !(st.speed > 0)) { silence(tc, 0.15); return; }
    const L = ctx.listener, cp = camera.position, e = camera.matrixWorld.elements;
    _f.x = -e[8]; _f.y = -e[9]; _f.z = -e[10];
    if (L.positionX) {
      L.positionX.value = cp.x; L.positionY.value = cp.y; L.positionZ.value = cp.z;
      L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z;
      L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
    } else { L.setPosition(cp.x, cp.y, cp.z); L.setOrientation(_f.x, _f.y, _f.z, e[4], e[5], e[6]); }

    const t = st.t;
    const h = heardAt(t, cp);
    setPos(panner, h.x, h.y, 0);
    // Thin air at the source carries less (the launch's rule); the air takes the top off with distance.
    const p = densityAt(h.y) / 1.225;
    eng.air.frequency.setTargetAtTime(Math.max(180, Math.min(15000, 15000 * 250 / Math.max(h.d, 250))), tc, 0.2);
    const k = Math.min(1.4, reentryEnginesAt(h.tau) / 3 * p * Math.min(1, REF_D / Math.max(h.d, 1)) * 1.2);
    const near = Math.min(1, REF_D * 3 / Math.max(h.d, 1));
    eng.rumble.gain.setTargetAtTime(1.0 * Math.pow(k, 0.55), tc, 0.08);
    eng.roar.gain.setTargetAtTime(0.5 * Math.pow(k, 0.7) * (0.4 + 0.6 * near), tc, 0.08);
    eng.crackle.gain.setTargetAtTime(0.3 * Math.pow(k, 0.8) * near, tc, 0.06);

    // The flow, for a camera in the ship's own air.
    const ship = reentryState(t), dShip = Math.hypot(cp.x, cp.y - ship.h, cp.z);
    const ride = Math.max(0, 1 - dShip / RIDE_D) * (t < RE.splash ? 1 : 0);
    const q = dynamicPressureAt(t) / Q_PEAK.q;
    const mach = Math.hypot(ship.vx, ship.vh) / soundSpeedAt(ship.h);
    const lvl = ride * Math.min(1, Math.sqrt(q));
    flow.body.gain.setTargetAtTime(0.7 * lvl, tc, 0.25);
    flow.hiss.gain.setTargetAtTime(0.35 * lvl * Math.min(1, mach / 3), tc, 0.25);
    flowLP.frequency.setTargetAtTime(400 + 2600 * Math.min(1, mach / 4), tc, 0.3);

    // The sea, for a camera low over the water.
    sea.gain.setTargetAtTime(0.18 * Math.exp(-Math.max(0, cp.y) / 25), tc, 0.5);

    // One-shots, as their wavefront reaches the camera.
    if (lastTau !== null && h.tau > lastTau && h.tau - lastTau < 30) {
      if (lastTau < BOOM_T && h.tau >= BOOM_T && h.d > 2000) {
        // Heard below, not riding: an overpressure that falls with the height it was made at.
        const gb = Math.min(0.9, 0.35 + 6000 / Math.max(h.y, 3000) * 0.2);
        play('boom', { gain: gb, pan: panner, lowpass: 2500 });
        play('boom', { gain: gb * 0.75, pan: panner, lowpass: 2500, delay: 0.12 });
      }
    }
    lastTau = h.tau;
    // The splash, from the splash point: in the scene frame it is where the ocean puts it.
    const sp = { x: Math.max(0, toSplashAt(t)), y: 0 };
    const dSplash = Math.hypot(cp.x - sp.x, cp.y, cp.z);
    const tSplash = t - dSplash / C_SOUND;
    if (lastSplash !== null && lastSplash < RE.splash && tSplash >= RE.splash && tSplash - lastSplash < 30) {
      setPos(splashPan, sp.x, 0, 0);
      play('splash', { gain: Math.min(1, 0.25 + REF_D * 2 / Math.max(dSplash, 1)), pan: splashPan, lowpass: Math.max(300, Math.min(16000, 16000 * 250 / Math.max(dSplash, 250))) });
    }
    lastSplash = tSplash;
  }

  /** The current levels (for the checks): the engines' body, the flow over the hull, the sea. */
  const levels = () => (ctx ? { engines: eng.rumble.gain.value, flow: flow.body.gain.value, sea: sea.gain.value } : null);

  return { setEnabled, update, levels, get enabled() { return enabled; }, get contextState() { return ctx?.state ?? 'none'; } };
}
