/**
 * The sea's waves as a surface that moves, shared by what draws it and what floats or wades in
 * it. Until 8 November 2026 the sea was a flat sheet 0.9 m below the site with four drifting
 * normal maps on it (library.js waveNormals): it shaded like water but had no swell to see on
 * the horizon or against the beach, and the cars' wading depth (core/water.js) read a fixed level.
 *
 * WHAT IT IS: a sum of six Gerstner waves (GPU Gems 1, ch. 1, "Effective Water Simulation from
 * Physical Models", eq. 9 and 12): each a trochoid that lifts the surface and pulls it towards
 * the crests, so the crests sharpen and the troughs flatten as on real swell. Two swells come in
 * off the Gulf from the east-south-east and four shorter wind waves run before the site's sea
 * breeze (core/wind.js). Phase speeds are deep-water ones, ω = √(g·k).
 *
 * WHY NOT AN FFT OCEAN: an FFT spectrum (Tessendorf) gives a richer sea, but it is a GPU
 * simulation the physics in JavaScript cannot sample without reading textures back; a handful
 * of closed-form waves is the same function on both sides, costs a few dozen instructions per
 * vertex, and the fine detail an FFT would add is what the four normal-map layers already draw.
 *
 * WHAT IS CITED AND WHAT IS NOT: the directions follow the coast's bearing (terrain.js) and the
 * measured prevailing wind (wind.js). The heights are NOT a measurement of Boca Chica's surf:
 * they make a significant wave height of ≈0.9 m (Hs = 4σ, σ² = Σa²/2), a moderate day on this
 * coast, chosen as plausible (≈). Real series are at NOAA's NDBC (historical data of the western
 * Gulf's buoys), which are offshore stations, not the beach.
 *
 * NEAR THE SHORE (≈, reconstructed, not surveyed): the waves are scaled by the distance offshore
 * from the waterline: a slight shoaling rise outside the outer bar, then losing height across the
 * surf zone (where environment.js draws the broken water) to nothing at the swash. Refraction
 * and the shortening of the waves in shallow water are not modelled.
 *
 * GPU AND PHYSICS AGREE: the GLSL is generated from the same table (oceanGLSL), the clock is one
 * (OCEAN_CLOCK, the old WAVE_TIME), the phases ω·t are reduced on the CPU in double precision for
 * both, and the shore distance comes from the same sampled table. What the drawing leaves out
 * is only the waves its mesh is too coarse to carry (waveFilter, by vertex spacing, metres from
 * the camera) and the fade to flat at the edge of the moving patch, kilometres from the camera.
 * tools/ocean-check.mjs measures the agreement and the rest of the invariants.
 */
import { shoreZ, COAST_FRAME } from './terrain.js';

/** Sea surface below the pad's plane, m (f16Ground.js SEA_LEVEL is this value). */
export const SEA_LEVEL = -0.9;
/** Metres seaward of shoreZ at which the ground drops to the sea surface. */
export const WATERLINE = 35.3;
export const G = 9.81;

/** The clock the waves run on, s: advanced by the render loop, read by the physics. */
export const OCEAN_CLOCK = { value: 0 };

// [wavelength m, amplitude m, heading of travel (true °), steepness Q, phase rad]. The shore
// normal points seaward on 85.3° (terrain.js), so straight onshore is a heading of 265.3°.
// The sea breeze blows from 157.5° (wind.js): its waves travel towards 337.5°, along the beach
// and a little onshore of it.
const TABLE = [
  [72, 0.24, 278, 0.8, 0.0],      // the long Gulf swell, ≈6.8 s
  [51, 0.15, 266, 0.8, 2.1],      // a second swell train, ≈5.7 s
  [33, 0.08, 332, 1.0, 4.4],      // wind waves before the sea breeze
  [23, 0.10, 347, 1.0, 1.3],
  [15, 0.07, 317, 1.0, 5.6],
  [10, 0.045, 3, 1.0, 3.0],
];
const D2R = Math.PI / 180;
/** The waves with their derived constants; +x bears 100.8°, bearings clockwise towards +z. */
export const WAVES = TABLE.map(([lambda, a, heading, q, ph]) => {
  const k = 2 * Math.PI / lambda, th = (heading - 100.8) * D2R;
  return { lambda, a, heading, q, ph, k, omega: Math.sqrt(G * k), dx: Math.cos(th), dz: Math.sin(th) };
});

/** Significant wave height of the open sea, m (Hs = 4σ). */
export const HS = 4 * Math.sqrt(WAVES.reduce((s, w) => s + w.a * w.a / 2, 0));

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Wave height scale at d metres offshore of the waterline (≈): 0 at the swash, ≈1.15 outside the bar, 1 at sea. */
export function envelope(d) {
  const b = (d - 80) / 45;
  return smooth(2, 48, d) * (1 + 0.15 * Math.exp(-b * b));
}

/** How much of a wave a mesh with vertices `spacing` metres apart can carry (1 = all of it). */
export function waveFilter(lambda, spacing) { return 1 - smooth(lambda / 8, lambda / 4, spacing); }

// The shoreline sampled once, for both sides: the GPU cannot run terrain.js's noise, and the
// physics reads the same samples so the two agree exactly.
export const SHORE_TABLE = { u0: -12285, du: 6, n: 4096 };
let shoreData = null;
export function shoreSamples() {
  if (!shoreData) {
    shoreData = new Float32Array(SHORE_TABLE.n);
    for (let i = 0; i < SHORE_TABLE.n; i++) shoreData[i] = shoreZ(SHORE_TABLE.u0 + i * SHORE_TABLE.du);
  }
  return shoreData;
}

/** Metres offshore of the waterline at world (x, z), from the sampled shore; negative inland. */
export function offshore(x, z) {
  const { cos: CB, sin: SB, padZ } = COAST_FRAME, dz = z - padZ;
  const u = CB * x + SB * dz, w = padZ - SB * x + CB * dz;
  const s = shoreSamples(), { u0, du, n } = SHORE_TABLE;
  const p = Math.min(Math.max((u - u0) / du, 0), n - 1.001), i = Math.floor(p), f = p - i;
  return s[i] + (s[i + 1] - s[i]) * f - w - WATERLINE;
}

/** ω·t of each wave reduced to [0, 2π), in double precision: the GPU gets these, never t itself. */
export function oceanPhases(t, out = new Float32Array(WAVES.length)) {
  for (let i = 0; i < WAVES.length; i++) {
    const p = (WAVES[i].omega * t) % (2 * Math.PI);
    out[i] = p < 0 ? p + 2 * Math.PI : p;
  }
  return out;
}

const PH = new Float64Array(WAVES.length);
/**
 * The surface point that rests at (x0, z0): its displacement and normal at time t. `spacing` is
 * the drawing mesh's vertex spacing (0: every wave, the physics' case), `amp` an extra scale.
 */
export function displace(x0, z0, t, out = {}, spacing = 0, amp = 1, open = false) {
  for (let i = 0; i < WAVES.length; i++) { const p = (WAVES[i].omega * t) % (2 * Math.PI); PH[i] = p; }
  // `open`: the open ocean (the re-entry's northern Pacific), no coast anywhere, no shore envelope.
  const e = (open ? 1 : envelope(offshore(x0, z0))) * amp;
  let ox = 0, oy = 0, oz = 0, nx = 0, ny = 1, nz = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const A = w.a * e * (spacing > 0 ? waveFilter(w.lambda, spacing) : 1);
    if (A === 0) continue;
    const th = w.k * (w.dx * x0 + w.dz * z0) - PH[i] + w.ph, s = Math.sin(th), c = Math.cos(th);
    ox += w.q * A * w.dx * c; oz += w.q * A * w.dz * c; oy += A * s;
    nx -= w.dx * w.k * A * c; nz -= w.dz * w.k * A * c; ny -= w.q * w.k * A * s;
  }
  const l = Math.hypot(nx, ny, nz);
  out.x = ox; out.y = oy; out.z = oz; out.nx = nx / l; out.ny = ny / l; out.nz = nz / l;
  return out;
}

const _d = {};
/**
 * Height of the sea surface above SEA_LEVEL at world (x, z), time t, m. A Gerstner surface moves
 * its points sideways, so the point now over (x, z) rested elsewhere: found by fixed-point
 * iteration (x0 ← x − Dx(x0)), which converges because Σ Q·k·a < 1 (no wave folds over).
 */
export function oceanHeight(x, z, t = OCEAN_CLOCK.value, iters = 4) {
  let x0 = x, z0 = z;
  for (let i = 0; i < iters; i++) { displace(x0, z0, t, _d); x0 = x - _d.x; z0 = z - _d.z; }
  return displace(x0, z0, t, _d).y;
}

/**
 * The open ocean of the re-entry chapter (sim/reentry.js): the same six waves with no coast, scaled
 * by OPEN_SEA_AMP. ≈ — a moderate open-ocean sea (Hs ≈ 1.6 m, chosen as plausible for the northern
 * Pacific, not a measurement of the splashdown's sea state, which is not published).
 */
export const OPEN_SEA_AMP = 1.8;
/** Height of the open sea at (x, z) in the ocean's own frame, time t, m (as oceanHeight). */
export function openOceanHeight(x, z, t, iters = 4) {
  let x0 = x, z0 = z;
  for (let i = 0; i < iters; i++) { displace(x0, z0, t, _d, 0, OPEN_SEA_AMP, true); x0 = x - _d.x; z0 = z - _d.z; }
  return displace(x0, z0, t, _d, 0, OPEN_SEA_AMP, true).y;
}

const f = (v) => {
  const s = Number(v).toPrecision(9);
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
};
/** GLSL of offshore() under the given name, with the uShore sampler it reads. */
export function offshoreGLSL(name) {
  const { cos: CB, sin: SB, padZ } = COAST_FRAME, { u0, du, n } = SHORE_TABLE;
  return `
uniform sampler2D uShore;
float ${name}(vec2 p) {
  float dz = p.y - (${f(padZ)});
  float u = ${f(CB)} * p.x + ${f(SB)} * dz, w = ${f(padZ)} - ${f(SB)} * p.x + ${f(CB)} * dz;
  float x = clamp((u - (${f(u0)})) / ${f(du)}, 0.0, ${f(n - 1.001)});
  int i = int(floor(x)); float fr = x - float(i);
  float s = mix(texelFetch(uShore, ivec2(i, 0), 0).r, texelFetch(uShore, ivec2(i + 1, 0), 0).r, fr);
  return s - w - ${f(WATERLINE)};
}`;
}

/**
 * GLSL for the vertex stage: uniforms uShore (the shore samples, R32F) and uOceanPhase, and
 * vcOffshore(p), vcEnvelope(d), vcOcean(p, spacing, amp, out n) mirroring offshore, envelope and
 * displace above (p = world (x, z)).
 */
export function oceanGLSL({ open = false } = {}) {
  const waves = WAVES.map((w, i) => `
  {
    float A = ${f(w.a)} * e * (1.0 - smoothstep(${f(w.lambda / 8)}, ${f(w.lambda / 4)}, spacing));
    float th = ${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - uOceanPhase[${i}] + ${f(w.ph)};
    float s = sin(th), c = cos(th);
    o.x += ${f(w.q * w.dx)} * A * c; o.z += ${f(w.q * w.dz)} * A * c; o.y += A * s;
    nn.x -= ${f(w.dx * w.k)} * A * c; nn.z -= ${f(w.dz * w.k)} * A * c; nn.y -= ${f(w.q * w.k)} * A * s;
  }`).join('');
  if (open) {
    return `
uniform float uOceanPhase[${WAVES.length}];
vec3 vcOcean(vec2 p, float spacing, float amp, out vec3 n) {
  float e = amp;
  vec3 o = vec3(0.0), nn = vec3(0.0, 1.0, 0.0);${waves}
  n = normalize(nn);
  return o;
}`;
  }
  return `
uniform float uOceanPhase[${WAVES.length}];
${offshoreGLSL('vcOffshore')}
float vcEnvelope(float d) { float b = (d - 80.0) / 45.0; return smoothstep(2.0, 48.0, d) * (1.0 + 0.15 * exp(-b * b)); }
vec3 vcOcean(vec2 p, float spacing, float amp, out vec3 n) {
  float e = vcEnvelope(vcOffshore(p)) * amp;
  vec3 o = vec3(0.0), nn = vec3(0.0, 1.0, 0.0);${waves}
  n = normalize(nn);
  return o;
}`;
}
