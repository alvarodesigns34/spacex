/**
 * The F-16's sound: its F100 turbofan, the air and the wheels, synthesised sample by sample, and
 * opt-in like the cars': nothing is made or played until the visitor turns it on (M, or the
 * flight bar's Sound button — a click, which browsers require for audio).
 *
 * What it is built from (≈, chosen by ear against published recordings — airshow passes, ramp
 * starts, cockpit videos — not a recording and not a measured spectrum):
 *  - The fan (heard ahead of the inlet). Its blades passing make the blade-passage tone; with the
 *    fan's tips past the speed of sound (towards military power) each blade's shock is a little
 *    different from the next, so the inlet radiates every multiple of the shaft's speed — the
 *    'buzz-saw' a jet makes as it taxis towards you at high power. Made here the way it arises:
 *    a sawtooth per blade, each blade its own (fixed, random) strength, band-limited at every
 *    step (PolyBLEP), the spread growing with the tip Mach number. Under it, the fan's broadband
 *    noise round the blade-passage frequency.
 *  - The core: the high-pressure compressor's whine, high and faint, on the core's speed.
 *  - The jet (heard behind, strongest ≈40° off the tail): the mixing noise of a hot jet, a
 *    broadband roar whose peak frequency follows the jet's velocity over its diameter (Strouhal
 *    ≈0.2) and whose power grows steeply with the velocity (Lighthill's eighth power, compressed
 *    here so idle is still heard); its slow turbulent swell.
 *  - The afterburner: the jet faster and wider (the roar louder and lower), the combustion's
 *    rumble, and the crackle — steep, one-sided shock fronts arriving in bursts, as in the
 *    launch's rocket noise; a thump as it lights.
 *  - In the cockpit the engine comes through the airframe muffled and low; over it the
 *    environmental control system's air and the airflow on the canopy, which grows with the
 *    dynamic pressure (most of what a pilot hears at speed).
 *  - The wheels: the tyres' rumble on the runway with the speed, a squeal on touchdown; the gear's
 *    hydraulics running while it moves.
 *  - From outside, heard where it is (audioBus.js): late by d/343 s, Doppler-shifted, panned,
 *    quieter and duller with distance. Faster than sound, nothing is heard ahead of the Mach cone;
 *    a listener the cone sweeps over (the tower, the visitor's own view) hears the boom, a double
 *    N-wave (≈ 0.1 s for a fighter at a few kilometres).
 * Engine speeds: the fan's and the core's from the power setting (≈ the usual F100 gauge figures:
 * core ≈68 % at idle, ≈94 % at military); blade counts ≈.
 */
import * as THREE from 'three';
import { audio, claim, createSpatial, placeListener, C_SOUND } from './audioBus.js';
import { LINES } from '../data/f16.js';
import { CG } from './f16Flight.js';

const WORKLET = `
class F16Engine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'n1', defaultValue: 0, minValue: 0, maxValue: 1.1 },      // fan speed, fraction of its maximum
      { name: 'n2', defaultValue: 0, minValue: 0, maxValue: 1.1 },      // core speed, fraction
      { name: 'vj', defaultValue: 0, minValue: 0, maxValue: 1500 },     // the jet's velocity, m/s
      { name: 'ab', defaultValue: 0, minValue: 0, maxValue: 1 },        // the afterburner's share
      { name: 'fpk', defaultValue: 100, minValue: 10, maxValue: 2000 }, // the jet noise's peak, Hz
      { name: 'cabin', defaultValue: 0, minValue: 0, maxValue: 1 },     // the listener in the cockpit
      { name: 'q', defaultValue: 0, minValue: 0, maxValue: 1 },         // dynamic pressure, of ≈80 kPa
      { name: 'on', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }
  constructor() {
    super();
    this.seed = 1600; this.ph1 = 0; this.ph2 = 0; this.hp = [0, 0]; this.hpX = [0, 0];
    // The fan's first stage, ≈ its blade count, and each blade's own strength (a fixed spread:
    // the machining and the wear; what makes the buzz-saw's shaft orders).
    this.B = 33; this.N1MAX = 10400 / 60; this.N2MAX = 13450 / 60; this.B2 = 40;
    this.dev = Array.from({ length: this.B }, () => this.rnd() * 2 - 1);
    const R = (f, q) => ({ f, q, x1: 0, x2: 0, y1: 0, y2: 0, b0: 0, a1: 0, a2: 0 });
    this.fanBand = R(800, 2); this.jet1 = R(100, 0.7); this.jet2 = R(300, 0.8); this.rum = R(45, 1.2);
    this.ecs = R(4500, 0.9); this.can = R(600, 0.6); this.crk = R(2500, 0.7);
    this.flut = 0; this.flut2 = 0; this.lpC = 0; this.lpC2 = 0; this.shock = 0; this.rate = 80; this.rateT = 80; this.nextRate = 0;
    this.light = 0; this.abPrev = 0; this.thPh = 0;
  }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  design(r, f, q) {
    const sr = sampleRate, w = 2 * Math.PI * Math.min(Math.max(f, 5), sr * 0.45) / sr, al = Math.sin(w) / (2 * q);
    const a0 = 1 + al; r.b0 = al / a0; r.a1 = -2 * Math.cos(w) / a0; r.a2 = (1 - al) / a0;
  }
  bq(r, x) {
    const o = r.b0 * x - r.b0 * r.x2 - r.a1 * r.y1 - r.a2 * r.y2;
    r.x2 = r.x1; r.x1 = x; r.y2 = r.y1; r.y1 = o;
    return o;
  }
  // PolyBLEP: the band-limiting residual near a unit step at t = 0 (t in cycles, dt per sample).
  blep(t, dt) {
    if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
    if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
    return 0;
  }
  process(_, outputs, P) {
    const fwd = outputs[0][0], aft = outputs[1] ? outputs[1][0] : null, n = fwd.length, sr = sampleRate;
    const at = (a, i) => (a.length > 1 ? a[i] : a[0]);
    // The filters follow the engine once a block.
    const n1b = at(P.n1, 0), fpk = at(P.fpk, 0), ab0 = at(P.ab, 0), q0 = at(P.q, 0);
    this.design(this.fanBand, Math.max(60, this.B * n1b * this.N1MAX), 2.2);
    this.design(this.jet1, fpk, 0.7); this.design(this.jet2, fpk * 3.2, 0.9);
    this.design(this.rum, 38 + 20 * ab0, 1.1); this.design(this.ecs, 4200, 0.8);
    this.design(this.can, 350 + 900 * Math.sqrt(q0), 0.55); this.design(this.crk, 2200, 0.6);
    const flutK = 1 - Math.exp(-1 / (sr * 0.12));
    for (let i = 0; i < n; i++) {
      const n1 = at(P.n1, i), n2 = at(P.n2, i), vj = at(P.vj, i), ab = at(P.ab, i), cabin = at(P.cabin, i), q = at(P.q, i), on = at(P.on, i);
      const nz = this.rnd() * 2 - 1, nz2 = this.rnd() * 2 - 1;
      // ---- The fan: a sawtooth per blade, each its own strength, band-limited at each step.
      const f1 = n1 * this.N1MAX, dRev = f1 / sr;
      this.ph1 += dRev; if (this.ph1 >= 1) this.ph1 -= 1;
      // The tips go supersonic towards military power (≈ above 80 % of the fan's speed).
      const sup = Math.min(1, Math.max(0, (n1 - 0.8) / 0.15));
      const spread = 0.08 + 0.5 * sup;
      const pb = this.ph1 * this.B, k = Math.floor(pb) % this.B, t = pb - Math.floor(pb), dt = dRev * this.B;
      const amp = (j) => 1 + spread * this.dev[(j + this.B) % this.B];
      let saw = amp(k) * (1 - 2 * t);
      if (dt < 0.5) {
        if (t < dt) saw += 0.5 * (amp(k - 1) + amp(k)) * this.blep(t, dt);
        else if (t > 1 - dt) saw += 0.5 * (amp(k) + amp(k + 1)) * this.blep(t, dt);
      } else saw = 0;
      const fanLevel = Math.pow(n1, 3.2) * (0.35 + 0.65 * sup);
      const fanTone = saw * fanLevel * 0.16;
      const fanNoise = this.bq(this.fanBand, nz) * Math.pow(n1, 2.5) * 0.35;
      // ---- The core's whine: the compressor's blades on the core's speed (high and faint).
      this.ph2 += n2 * this.N2MAX * this.B2 / sr; if (this.ph2 >= 1) this.ph2 -= 1;
      const core = (n2 * this.N2MAX * this.B2 < 0.45 * sr ? Math.sin(2 * Math.PI * this.ph2) : 0) * 0.02 * n2 * n2;
      let front = fanTone + fanNoise + core;
      // ---- The jet: its mixing noise, swelling slowly with the turbulence.
      this.flut += (nz2 - this.flut) * flutK * 6; this.flut2 += (this.flut - this.flut2) * flutK * 6;
      const swell = 1 + 2.4 * this.flut2;
      const vr = vj / 700;
      // Lighthill's V^8 in power is V^4 in pressure; compressed (≈ V^2.6) so idle is still heard.
      const jetLevel = Math.pow(vr, 2.6) * 1.8;
      let jet = (this.bq(this.jet1, nz) * 1.0 + this.bq(this.jet2, nz2) * 0.45) * jetLevel * swell;
      // ---- The afterburner: the combustion's rumble, the crackle, the light-off thump.
      if (ab > 0.02 && this.abPrev <= 0.02) { this.light = 1; this.thPh = 0; }
      this.abPrev = ab;
      let burn = 0;
      if (ab > 0.005) {
        burn += this.bq(this.rum, nz) * 3.0 * ab;
        // Shock fronts in bursts: the arrival rate wanders between tens and hundreds a second,
        // the strengths heavy-tailed (as in rocket crackle).
        if (--this.nextRate <= 0) { this.rateT = 30 + 260 * Math.pow(this.rnd(), 1.6); this.nextRate = Math.floor(sr * (0.06 + 0.2 * this.rnd())); }
        this.rate += (this.rateT - this.rate) * 0.0005;
        if (this.rnd() < this.rate * ab / sr) this.shock = Math.min(1.2, 0.1 / Math.pow(1 - this.rnd() * 0.985, 0.55));
        if (this.shock > 1e-4) { burn += this.bq(this.crk, this.shock) * 2.2; this.shock *= 0.93; }
      }
      if (this.light > 1e-3) {
        this.thPh += 2 * Math.PI * 34 / sr;
        burn += (Math.sin(this.thPh) * 1.4 + nz * 0.5) * this.light;
        this.light *= Math.exp(-1 / (sr * 0.16));
      }
      let rear = jet + burn;
      // ---- In the cockpit: the engine through the airframe, muffled and low; the air.
      if (cabin > 0.01) {
        const eng = front * 0.25 + rear;
        this.lpC += (eng - this.lpC) * 0.02; this.lpC2 += (this.lpC - this.lpC2) * 0.02;
        const muff = this.lpC2 * 4.0 + front * 0.03;
        const air = this.bq(this.ecs, nz) * 0.05 + this.bq(this.can, nz2) * q * 0.9;
        front = front * (1 - cabin) + (muff + air) * cabin;
        rear = rear * (1 - cabin);
      }
      // The level, a soft limit, and a DC block on each output.
      const outs = [front, rear];
      for (let c = 0; c < 2; c++) {
        const v = Math.tanh(outs[c] * 1.2) * 0.9 * on;
        this.hp[c] = 0.9985 * this.hp[c] + v - this.hpX[c]; this.hpX[c] = v;
      }
      fwd[i] = this.hp[0];
      if (aft) aft[i] = this.hp[1];
    }
    return true;
  }
}
registerProcessor('f16-f100', F16Engine);
`;

const R_NOZZLE = Math.sqrt(LINES.nozzle.exitArea / Math.PI);
/**
 * The engine's state for the sound, from its power setting (0 idle, 50 military, 100 full
 * afterburner; f16Flight.js): the fan's and the core's speeds as fractions of their maxima, the
 * jet's velocity (≈: ≈300 m/s at idle, ≈650 at military, ≈1,100 in full afterburner), the jet
 * noise's peak (Strouhal 0.2 on the nozzle's exit, opened ≈30 % in afterburner), the
 * afterburner's share.
 */
export function engineSound(power, flameout = false) {
  if (flameout) return { n1: 0, n2: 0, vj: 0, ab: 0, fpk: 40 };
  const p = Math.max(0, Math.min(100, power)), dry = Math.min(1, p / 50), ab = Math.max(0, (p - 50) / 50);
  const n2 = 0.68 + 0.26 * dry ** 1.3 + 0.02 * ab;
  const n1 = 0.42 + 0.55 * dry ** 1.2 + 0.03 * ab;
  const vj = 300 + 350 * dry ** 1.3 + 450 * ab;
  const dj = 2 * R_NOZZLE * (1 + 0.3 * ab);
  return { n1, n2, vj, ab, fpk: 0.2 * vj / dj };
}

/**
 * Whether a listener at (dx, dy, dz) from a source moving at `vel` (faster than sound) is inside
 * its Mach cone: within the half-angle asin(1/M) of the axis behind it. Ahead of the cone the
 * sound has not arrived.
 */
export function inMachCone(dx, dy, dz, vel) {
  const v = Math.hypot(vel.x, vel.y, vel.z), d = Math.hypot(dx, dy, dz);
  if (v <= C_SOUND || d === 0) return true;
  const cosBack = -(dx * vel.x + dy * vel.y + dz * vel.z) / (d * v);
  return cosBack > Math.cos(Math.asin(C_SOUND / v));
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createF16Sound() {
  let enabled = false, N = null, building = null, lastWow = true, lastGear = 1, boomArmed = true;

  async function build() {
    const A = audio();
    if (!A) return false;
    const { ctx, bus } = A;
    const r = rng(16);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const master = gain(0); master.connect(bus);
    // Two places on the airplane: the inlet, under the nose, and the jet, ≈5 m behind the nozzle
    // (where its noise is made); each heard on its own path. The level was set at the chase
    // camera's ≈26 m.
    const inlet = createSpatial(26), jet = createSpatial(26), wheels = createSpatial(26, { maxDelay: 30 });
    for (const p of [inlet, jet, wheels]) p.out.connect(master);
    let engine = null;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      engine = new AudioWorkletNode(ctx, 'f16-f100', { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 1] });
      engine.connect(inlet.input, 0); engine.connect(jet.input, 1);
    } catch {
      // An old browser: a fan tone and a filtered roar.
      const o = ctx.createOscillator(); o.type = 'sawtooth'; const og = gain(0.04); o.connect(og); og.connect(inlet.input); o.start();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const jg = gain(0); loopNoise().connect(lp); lp.connect(jg); jg.connect(jet.input);
      engine = null; N = { fallback: { o, jg } };
    }
    // The tyres on the runway (their rumble follows the speed) and the touchdown squeal.
    const tr = ctx.createBiquadFilter(); tr.type = 'bandpass'; tr.frequency.value = 120; tr.Q.value = 1.4;
    const trG = gain(0); loopNoise().connect(tr); tr.connect(trG); trG.connect(wheels.input);
    const sq = ctx.createBiquadFilter(); sq.type = 'bandpass'; sq.frequency.value = 1300; sq.Q.value = 9;
    const sqG = gain(0); loopNoise().connect(sq); sq.connect(sqG); sqG.connect(wheels.input);
    // The gear's hydraulics while it moves, and the boom (direct, not through the paths: it is
    // timed by the Mach cone's passing itself).
    const hy = ctx.createBiquadFilter(); hy.type = 'bandpass'; hy.frequency.value = 520; hy.Q.value = 6;
    const hyG = gain(0); loopNoise().connect(hy); hy.connect(hyG); hyG.connect(inlet.input);
    const boom = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    {
      // Two N-waves (the bow and the tail shocks merge into one N at a distance), ≈0.1 s each.
      const d = boom.getChannelData(0), sr = ctx.sampleRate, T = 0.1;
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (t < T ? 1 - 2 * t / T : 0) + (t > 0.14 && t < 0.14 + T ? 0.7 * (1 - 2 * (t - 0.14) / T) : 0); }
    }
    const boomLp = ctx.createBiquadFilter(); boomLp.type = 'lowpass'; boomLp.frequency.value = 1800;
    const boomG = gain(0.9); boomLp.connect(boomG); boomG.connect(master);
    N = { ...(N ?? {}), ctx, master, inlet, jet, wheels, engine, tr, trG, sq, sqG, hyG, boom, boomLp };
    return true;
  }

  const set = (p, v, tc = 0.04) => p.setTargetAtTime(v, N.ctx.currentTime, tc);
  // Where the sound is made, on the airframe (the flight's frame: x forward from the nose, y up
  // from the ground, as CG): the inlet's mouth under the cockpit, the jet's noise ≈5 m behind the
  // nozzle's exit (≈ four diameters, where the mixing is loudest), the main wheels (all ≈).
  const SRC = {
    inlet: new THREE.Vector3(-LINES.intakeLip, 1.3, 0), jet: new THREE.Vector3(-(LINES.nozzle.s1 + 5), 1.9, 0), wheels: new THREE.Vector3(-9.3, 0.4, 0),
  };
  const _p = new THREE.Vector3();
  const onAirframe = (s, pt) => _p.subVectors(pt, CG).applyQuaternion(s.q).add(s.pos);

  return {
    get enabled() { return enabled; },
    get contextState() { return N?.ctx?.state ?? 'none'; },
    setEnabled(on) {
      enabled = !!on;
      claim('f16', enabled);
      if (enabled && !N && !building) building = build().then(ok => { if (!ok) { enabled = false; claim('f16', false); } });
      if (N?.master) set(N.master.gain, enabled ? 1 : 0, 0.08);
    },
    /**
     * Per frame while flying: `s` the flight model's state, `camera`, `inside` true in the
     * cockpit, `dt` the frame's time.
     */
    update(s, camera, inside, dt) {
      if (!enabled || !N?.ctx || !N.master) return;
      const ctx = N.ctx, t = ctx.currentTime;
      set(N.master.gain, 1, 0.08);
      placeListener(camera);
      const e = engineSound(s.power, s.flameout);
      // The Mach cone: faster than sound, a listener ahead of it hears nothing yet; the moment
      // it passes over, the boom. Riding along (the chase camera, the cockpit) is always inside.
      const dx = camera.position.x - s.pos.x, dy = camera.position.y - s.pos.y, dz = camera.position.z - s.pos.z;
      const d = Math.hypot(dx, dy, dz);
      let gate = 1;
      if (!inside && d > 60 && Math.hypot(s.vel.x, s.vel.y, s.vel.z) > C_SOUND) {
        gate = inMachCone(dx, dy, dz, s.vel) ? 1 : 0;
        if (gate && boomArmed) {
          const src = ctx.createBufferSource(); src.buffer = N.boom;
          const g = ctx.createGain(); g.gain.value = Math.min(1, 1500 / Math.max(d, 300));
          src.connect(g); g.connect(N.boomLp); src.start(t);
        }
        boomArmed = !gate;
      } else boomArmed = true;
      N.inlet.update(onAirframe(s, SRC.inlet), camera, inside, gate, dt);
      N.jet.update(onAirframe(s, SRC.jet), camera, inside, gate, dt);
      N.wheels.update(onAirframe(s, SRC.wheels), camera, inside, gate, dt);
      if (N.engine) {
        const P = N.engine.parameters;
        // (The spool lag is the flight model's; the glides here only smooth the frames.)
        P.get('n1').setTargetAtTime(e.n1, t, 0.05); P.get('n2').setTargetAtTime(e.n2, t, 0.05);
        P.get('vj').setTargetAtTime(e.vj, t, 0.05); P.get('ab').setTargetAtTime(e.ab, t, 0.04);
        P.get('fpk').setTargetAtTime(e.fpk, t, 0.1);
        P.get('cabin').setTargetAtTime(inside ? 1 : 0, t, 0.05);
        P.get('q').setTargetAtTime(Math.min(1, (s.qbar ?? 0) / 80000), t, 0.1);
        P.get('on').setTargetAtTime(s.flameout ? 0 : 1, t, 0.3);
      } else if (N.fallback) {
        set(N.fallback.o.frequency, 33 * e.n1 * 10400 / 60, 0.05);
        set(N.fallback.jg.gain, 0.05 + 0.4 * (e.vj / 1100) ** 2, 0.05);
      }
      // Wheels: the rumble with the ground speed while on them, the squeal as they spin up.
      const vg = Math.hypot(s.vel.x, s.vel.z);
      set(N.trG.gain, s.wow ? Math.min(0.35, vg / 120) * (inside ? 0.5 : 1) : 0, 0.05);
      set(N.tr.frequency, 60 + vg * 1.4, 0.05);
      if (s.wow && !lastWow && vg > 40) {
        const p = N.sqG.gain, a = Math.min(0.5, 0.15 + vg / 250);
        p.cancelScheduledValues(t); p.setValueAtTime(a, t); p.setTargetAtTime(0, t + 0.05, 0.12);
      }
      lastWow = s.wow;
      // The gear's hydraulics: while the gear is between up and down.
      const moving = Math.abs(s.gear - lastGear) > 1e-4 || (s.gear > 0.01 && s.gear < 0.99 && s.gearCmd !== s.gear);
      set(N.hyG.gain, moving ? 0.05 : 0, 0.15);
      lastGear = s.gear;
    },
    stop() { if (N?.master) set(N.master.gain, 0, 0.05); },
  };
}
