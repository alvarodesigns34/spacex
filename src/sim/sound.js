/**
 * Launch sound, synthesised, and opt-in: nothing is created or played until the visitor turns
 * it on from the mission panel (a click, which is also what browsers require before audio).
 *
 * What it models:
 *  - Every source is heard where and as it was d/343 s ago: a camera 350 m from the pad hears
 *    ignition a second after it sees it, and a vehicle 10 km up is heard where it was half a
 *    minute earlier. Each stage is placed in space relative to the camera (HRTF panning), so
 *    the sound comes from where the vehicle is.
 *  - A large rocket's noise is a broadband roar whose energy peaks low (tens of hertz for a
 *    vehicle this size) with the characteristic CRACKLE on top: the jet's shocks reach the
 *    listener as steep, one-sided pressure jumps. Crackle is made here the way it arises: a
 *    train of N-shaped shock fronts arriving in bursts, at a rate that wanders between tens
 *    and hundreds a second, with heavy-tailed amplitudes, over a little skewed noise.
 *  - The roar is not steady: a slow random flutter swells and sags it by about a quarter.
 *  - Near the ground each stage is heard twice, directly and off the flats, and the changing
 *    gap between the two as the vehicle climbs sweeps a comb filter down the spectrum: the
 *    phasing of every liftoff recorded from the ground.
 *  - The air takes the top off with distance (absorption grows with frequency), so a far
 *    launch is a rumble; thin air at the source carries less, so the ship is silent in space.
 *  - An open-field reverberation: a long, low, diffuse echo off the land around the site.
 *  - Before ignition, the fuelled stack vents (cryogenic hiss, near the pad) and at T−10 the
 *    flame deflector's water comes on (a broadband rush). The staggered ignition (3 → 13 → 33
 *    engines) comes from the booster's throttle, so the roar rises in steps, each step opening
 *    with a low thump as the chambers light. One-shots: the
 *    hot-staging crack, and the returning booster's sonic booms, heard at the pad on every
 *    catch. The booms are timed from the model's own descent through Mach 1.2, delayed by the
 *    distance, and played as a triple N-wave.
 * It is not a recording and not a measured spectrum: band levels are chosen by ear against
 * published launch and catch videos, and the booms' timing is the model's, not a flight's.
 */
import { EVENTS, boosterSpeedAt, boosterAltAt, soundSpeedAt, derivedEvents } from './launch.js';

const C_SOUND = 343;
const REF_D = 160;                       // full level inside this distance

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function buffer(ctx, seconds, fill, channels = 1) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(channels, n, ctx.sampleRate);
  for (let c = 0; c < channels; c++) fill(b.getChannelData(c), ctx.sampleRate, c);
  return b;
}

/** When the returning booster is last above Mach 1.2 on the way down: its boom's emission time. */
const BOOM_T = (() => {
  const d = derivedEvents();
  for (let t = (d.transonic ?? 390) - 1; t > EVENTS.boostbackEnd; t -= 0.25) {
    if (boosterSpeedAt(t) > 1.2 * soundSpeedAt(boosterAltAt(t))) return t;
  }
  return (d.transonic ?? 390) - 10;
})();

export function createLaunchSound({ launch, camera }) {
  let ctx = null, enabled = false, master = null, reverbIn = null;
  const src = [];                       // per stage: { panner, air, rumble, roar, crackle }
  let vent = null, deluge = null, wind = null;
  const now = [{ pos: camera.position.clone() }, { pos: camera.position.clone() }];
  const heard = [{ pos: camera.position.clone() }, { pos: camera.position.clone() }];
  const lastHeard = [null, null];
  let oneShots = {};

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const r = rng(7);
    // Noise beds, generated once and looped.
    const white = buffer(ctx, 4, (d) => { for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; });
    const brown = buffer(ctx, 5, (d) => { let v = 0; for (let i = 0; i < d.length; i++) { v = (v + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = v * 3.5; } });
    // Crackle as it is measured in rocket noise: not a hiss but a train of shock fronts, each a
    // near-instant pressure jump followed by a slower fall (an N-wave a millisecond or two
    // long), arriving in bursts. The arrival rate itself wanders between a few tens and a few
    // hundred a second on a ~0,2 s time scale, and the amplitudes are heavy-tailed: mostly
    // small, now and then one that tears. Eight seconds, so the loop is not heard.
    const shocks = buffer(ctx, 8, (d, sr) => {
      let i = 0, rate = 120, target = 120, next = 0;
      while (i < d.length) {
        if (i >= next) { target = 30 + 260 * Math.pow(r(), 1.6); next = i + Math.floor(sr * (0.08 + r() * 0.25)); }
        rate += (target - rate) * 0.2;
        i += Math.max(1, Math.floor(sr * (-Math.log(1 - r()) / rate)));
        const a = Math.min(1, 0.12 / Math.pow(1 - r() * 0.985, 0.55));  // Pareto-like tail
        const len = Math.floor(sr * (0.0006 + r() * 0.0022));
        for (let k = 0; k < len && i + k < d.length; k++) d[i + k] += a * (1 - 1.9 * k / len);
        i += len;
      }
      for (let k = 0; k < d.length; k++) d[k] = Math.max(-1, Math.min(1, d[k] * 0.8));
    });
    // Slow turbulence: the roar of a real jet swells and sags by a third, irregularly, over
    // fractions of a second. Low-passed noise around zero, used to modulate a gain.
    const flutter = buffer(ctx, 11, (d, sr) => {
      let v = 0, w = 0;
      for (let i = 0; i < d.length; i++) { v += 0.0009 * ((r() * 2 - 1) - v); w += 0.0009 * (v - w); d[i] = w * 22; }
    });
    const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };

    // Output: compressor so the ignition does not clip, and a reverb send.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = buffer(ctx, 3.6, (d, sr, c) => {
      const rr = rng(31 + c);
      // Open field: a first ground-and-terrain return after ~60 ms, then a long diffuse tail,
      // darkening as it decays (the high end is absorbed on every bounce).
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, env = t < 0.06 ? 0 : Math.exp(-(t - 0.06) / 0.9);
        const k = 0.08 + 0.5 * Math.exp(-t / 0.5);
        lp += k * ((rr() * 2 - 1) - lp);
        d[i] = lp * env * 0.9;
      }
    }, 2);
    reverbIn = ctx.createGain(); reverbIn.gain.value = 0.34;
    reverbIn.connect(verb); verb.connect(master);

    // Crackle: band-limited noise skewed by a cubic waveshaper (steep positive jumps), plus
    // the sparse one-sided impulses.
    const skew = ctx.createWaveShaper();
    skew.curve = Float32Array.from({ length: 1025 }, (_, i) => { const x = i / 512 - 1; return Math.max(-1, Math.min(1, 0.4 * x + 0.9 * Math.max(0, x) ** 2 - 0.2 * Math.max(0, -x) ** 3)); });
    skew.oversample = '4x';

    for (let k = 0; k < 2; k++) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'linear'; panner.rolloffFactor = 0;
      const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 12000; air.Q.value = 0.5;
      // Ground reflection. Near the ground every source is heard twice, directly and off the
      // flats, a few milliseconds apart; as the vehicle climbs the gap changes and the comb of
      // cancellations it makes sweeps down the spectrum — the phasing whoosh that is on every
      // recording of a liftoff made from the ground. The delay is set per frame in update().
      const refl = ctx.createDelay(0.1); refl.delayTime.value = 0.004;
      const reflGain = ctx.createGain(); reflGain.gain.value = 0;
      const out = ctx.createGain(); out.gain.value = 1;
      air.connect(out); air.connect(refl); refl.connect(reflGain); reflGain.connect(out);
      out.connect(panner); panner.connect(master); out.connect(reverbIn);
      // Turbulence: every band passes through one gain that the flutter noise modulates.
      const am = ctx.createGain(); am.gain.value = 1;
      const fl = loop(flutter, 1 + 0.13 * k); const flDepth = ctx.createGain(); flDepth.gain.value = 1.2;
      fl.connect(flDepth); flDepth.connect(am.gain); am.connect(air);
      const band = (node, type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; node.connect(b); b.connect(g); g.connect(am); return g; };
      // Deep body (brown noise under 70 Hz), the roar (peaking round 150 Hz for an engine
      // cluster this size), the mid-band tearing, and the crackle.
      const rumble = band(loop(brown, 1 - 0.05 * k), 'lowpass', 70, 0.8);
      const roar = band(loop(white, 1 + 0.03 * k), 'bandpass', 160, 0.5);
      const tear = band(loop(white, 0.93 + 0.04 * k), 'bandpass', 1100, 0.6);
      const cn = ctx.createBiquadFilter(); cn.type = 'bandpass'; cn.frequency.value = 900; cn.Q.value = 0.4;
      loop(white, 0.97 + 0.05 * k).connect(cn);
      const pre = ctx.createGain(); pre.gain.value = 2.2; cn.connect(pre); pre.connect(skew);
      const crackle = band(skew, 'highpass', 500, 0.7);
      const imp = band(loop(shocks, 1 + 0.02 * k), 'highpass', 250, 0.6);
      src.push({ panner, air, out, refl, reflGain, rumble, roar, tear, crackle, imp });
    }
    // Pad sounds before ignition, from the stack's position: vent hiss and the deluge.
    const padPanner = ctx.createPanner(); padPanner.panningModel = 'HRTF'; padPanner.distanceModel = 'linear'; padPanner.rolloffFactor = 0;
    padPanner.connect(master);
    const padBand = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; loop(white, 0.9 + r() * 0.2).connect(b); b.connect(g); g.connect(padPanner); g.connect(reverbIn); return g; };
    vent = padBand('highpass', 3500, 0.5);
    deluge = padBand('bandpass', 1400, 0.3);
    src.pad = padPanner;
    // Wind over the flats, very low, so silence between events is not digital silence.
    const w = ctx.createBiquadFilter(); w.type = 'lowpass'; w.frequency.value = 380; w.Q.value = 0.3;
    wind = ctx.createGain(); wind.gain.value = 0; loop(brown, 0.6).connect(w); w.connect(wind); wind.connect(master);

    // One-shot buffers.
    oneShots = {
      // Hot-staging: a hard crack with a short rough tail.
      crack: buffer(ctx, 1.6, (d, sr) => { const rr = rng(5); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr; lp += 0.35 * ((rr() * 2 - 1) - lp); d[i] = (t < 0.004 ? 1 : 0) + lp * Math.exp(-t / 0.25); } }),
      // An engine group coming up: a low thump as the chambers light, then the roar building.
      thump: buffer(ctx, 1.2, (d, sr) => { const rr = rng(9); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr; lp += 0.03 * ((rr() * 2 - 1) - lp); d[i] = Math.sin(2 * Math.PI * 38 * t) * Math.exp(-t / 0.18) * 0.9 + lp * 6 * Math.exp(-t / 0.35); } }),
      // Sonic boom: an N-wave (sharp rise, linear fall through zero, sharp return), 0,18 s.
      boom: buffer(ctx, 0.9, (d, sr) => { const T = 0.18; for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = t < T ? 1 - 2 * t / T : 0; } }),
    };
    return true;
  }

  function play(name, { gain = 1, at = 0, pan = null, lowpass = 20000, delay = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = oneShots[name];
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g);
    if (pan) g.connect(pan); else g.connect(master);
    g.connect(reverbIn);
    s.start(ctx.currentTime + at + delay);
  }

  function setEnabled(on) {
    enabled = on;
    if (on && !ctx && !build()) { enabled = false; return; }
    if (!ctx) return;
    if (on) ctx.resume?.();
    else {
      for (const s of src) for (const k of ['rumble', 'roar', 'tear', 'crackle', 'imp', 'reflGain']) s[k].gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      for (const g of [vent, deluge, wind]) g?.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
  }

  const setPos = (p, v) => {
    if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z);
  };
  const _f = { x: 0, y: 0, z: 0 };

  /** Called once per frame. */
  function update() {
    if (!enabled || !ctx) return;
    const tc = ctx.currentTime;
    // Listener at the camera, facing where it looks.
    const L = ctx.listener, cp = camera.position, e = camera.matrixWorld.elements;
    _f.x = -e[8]; _f.y = -e[9]; _f.z = -e[10];
    if (L.positionX) {
      L.positionX.value = cp.x; L.positionY.value = cp.y; L.positionZ.value = cp.z;
      L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z;
      L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
    } else { L.setPosition(cp.x, cp.y, cp.z); L.setOrientation(_f.x, _f.y, _f.z, e[4], e[5], e[6]); }

    const live = launch.running && launch.state.speed > 0;
    const t = launch.state.t;
    wind.gain.setTargetAtTime(live ? 0.05 : 0, tc, 0.5);
    if (!live) {
      for (const s of src) for (const k of ['rumble', 'roar', 'tear', 'crackle', 'imp', 'reflGain']) s[k].gain.setTargetAtTime(0, tc, 0.15);
      vent.gain.setTargetAtTime(0, tc, 0.2); deluge.gain.setTargetAtTime(0, tc, 0.2);
      lastHeard[0] = lastHeard[1] = null;
      return;
    }
    launch.sources(t, now);
    for (let i = 0; i < 2; i++) {
      const d = camera.position.distanceTo(now[i].pos);
      const th = t - d / C_SOUND;
      const h = launch.sources(th, heard)[i];
      const s = src[i];
      setPos(s.panner, h.pos);
      const p = Math.exp(-Math.max(h.altitude, 0) / 7500);
      const k = Math.min(1.4, (h.throttle > 0.001 ? h.throttle : 0) * p * Math.min(1, REF_D / Math.max(d, 1)) * 1.2);
      // Slow, irregular swell: the roar breathes as the jet's turbulence and the ground's
      // reflections interfere.
      const breathe = 0.85 + 0.15 * Math.sin(tc * 2.3 + i) * Math.sin(tc * 0.7 + 1.3 * i);
      const near = Math.min(1, REF_D * 3 / Math.max(d, 1));
      s.rumble.gain.setTargetAtTime(1.0 * Math.pow(k, 0.55) * breathe, tc, 0.1);
      s.roar.gain.setTargetAtTime(0.5 * Math.pow(k, 0.7) * breathe * (0.4 + 0.6 * near), tc, 0.1);
      s.tear.gain.setTargetAtTime(0.16 * Math.pow(k, 0.8) * near, tc, 0.1);
      s.crackle.gain.setTargetAtTime(0.28 * Math.pow(k, 0.8) * Math.min(1, near * 1.4), tc, 0.06);
      // The shock train is what carries: it is the crackle a crowd hears kilometres away.
      s.imp.gain.setTargetAtTime(0.85 * Math.pow(k, 0.75) * Math.min(1, 0.35 + near), tc, 0.06);
      // Ground reflection: path difference between the direct and the ground-bounced ray, for
      // a source at height hs and a listener at hl over flat ground, horizontal distance dh.
      // Faded out when the camera itself is off the ground (a chase view hears no bounce).
      const hl = Math.max(camera.position.y, 1.2), hs = Math.max(h.pos.y, 0.5);
      const dh = Math.hypot(camera.position.x - h.pos.x, camera.position.z - h.pos.z);
      const diff = Math.hypot(dh, hs + hl) - Math.hypot(dh, hs - hl);
      s.refl.delayTime.setTargetAtTime(Math.min(0.095, Math.max(0.0002, diff / C_SOUND)), tc, 0.05);
      s.reflGain.gain.setTargetAtTime(0.75 * Math.exp(-(hl - 1.2) / 40), tc, 0.2);
      // Air absorption: the cut-off falls roughly as 1/distance.
      s.air.frequency.setTargetAtTime(Math.max(180, Math.min(15000, 15000 * 250 / Math.max(d, 250))), tc, 0.2);

      // One-shots, when their wavefront reaches the camera.
      const prev = lastHeard[i];
      if (prev !== null && th > prev && th - prev < 3) {
        const cross = (te) => prev < te && th >= te;
        const lp = Math.max(200, Math.min(16000, 16000 * 250 / Math.max(d, 250)));
        const g = Math.min(1, REF_D / Math.max(d, 1));
        if (i === 0) for (const [te, gt] of [[EVENTS.ignition, 0.5], [EVENTS.ignition + 0.9, 0.75], [EVENTS.ignition + 2, 1]]) {
          if (cross(te)) play('thump', { gain: gt * Math.min(1, REF_D * 2 / Math.max(d, 1)), pan: s.panner, lowpass: lp });
        }
        if (i === 1 && cross(EVENTS.separation - 1.2)) play('crack', { gain: 0.9 * g * p + 0.05, pan: s.panner, lowpass: lp });
        if (i === 0 && cross(BOOM_T)) {
          // A returning booster's boom arrives as two or three N-waves a fraction of a second
          // apart (nose, grid fins, engine skirt), louder the lower it is.
          const gb = Math.min(1, 0.6 + 12000 / Math.max(h.altitude, 1000) * 0.1);
          play('boom', { gain: gb, pan: s.panner, lowpass: 2500 });
          play('boom', { gain: gb * 0.8, pan: s.panner, lowpass: 2500, delay: 0.23 });
          play('boom', { gain: gb * 0.65, pan: s.panner, lowpass: 2500, delay: 0.41 });
        }
      }
      lastHeard[i] = th;
    }
    // The pad before ignition: venting from the stack and, from T−10, the deflector's water.
    const dPad = camera.position.distanceTo(now[0].pos);
    const thPad = t - dPad / C_SOUND;
    setPos(src.pad, now[0].pos);
    const g = Math.min(1, REF_D / Math.max(dPad, 1));
    const ventOn = thPad < EVENTS.liftoff + 1 ? 1 : 0;
    const water = thPad >= EVENTS.deflector && thPad < EVENTS.liftoff + 12 ? 1 : 0;
    vent.gain.setTargetAtTime(0.12 * ventOn * Math.pow(g, 1.3), tc, 0.3);
    deluge.gain.setTargetAtTime(0.35 * water * g, tc, 0.4);
  }

  return { setEnabled, update, get enabled() { return enabled; } };
}
