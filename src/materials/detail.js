/**
 * Surface detail for the vehicles: what a material is made of, at the scale a close look sees it —
 * the grain of sand-cast aluminium, the lines of brushed metal, the stipple of a powder coat or a
 * moulded plastic, the micro-texture of rubber, the orange peel under a clear coat, the grain of
 * leather and suede, the weave of carbon. Each is a small tileable height field drawn once
 * (Canvas 2D), turned into a normal map, with a matching roughness map, shared by every material
 * that uses it.
 *
 * Applied by projection, not by UVs: the vehicles' parts are lofts, lathes, extrusions and tubes
 * whose UVs are anything but metric, so the maps are laid on from the three axes of the PART'S
 * OWN SPACE (triplanar, blended by the surface's direction), at a size in metres. The texture is
 * fixed to the part, so it does not slide when the vehicle drives. The detail normal is added to
 * whatever normal the material already has (its own normal map, flat shading), and the roughness
 * and colour are modulated about their own values. On a material with a clear coat the coat's
 * normal takes the same detail (orange peel is in the clear coat), unless `coat` is false.
 *
 * Scales and strengths are ≈ (chosen against close photographs of such surfaces, reference only).
 * Headless (no document) it does nothing: the checks build the models without textures.
 */
import { heightToNormal, toTexture } from './textures.js';

const SIZE = 512;
let LIB = null;

// A seeded value noise on a torus (tileable), and helpers on a Float32 height field.
function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const P = 256, lat = new Float32Array(P * P);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  return {
    rnd,
    /**
     * Value noise, period `per` lattice cells over the tile (u, v in 0..1), `perV` across v when
     * it differs (a streak). Both whole numbers, or the tile does not wrap: scaling u before the
     * call (u * 0.1 at a period of 256) stopped at 25.6 cells and left a seam at every repeat.
     */
    at(u, v, per, perV = per) {
      const x = u * per, y = v * perV, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const L = (a, b) => lat[(((b % perV) + perV) % perV) * P + (((a % per) + per) % per)];
      const a = L(ix, iy), b = L(ix + 1, iy), c = L(ix, iy + 1), d = L(ix + 1, iy + 1);
      return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    },
  };
}
function field(fn) {
  const H = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) H[y * SIZE + x] = fn(x / SIZE, y / SIZE, x, y);
  let lo = Infinity, hi = -Infinity;
  for (const v of H) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < H.length; i++) H[i] = (H[i] - lo) / Math.max(1e-9, hi - lo);
  return H;
}
function toCanvas(H, map = (v) => [v * 255, v * 255, v * 255]) {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const g = c.getContext('2d'), img = g.createImageData(SIZE, SIZE), d = img.data;
  for (let i = 0; i < H.length; i++) { const [r, gg, b] = map(H[i], i); d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}

/** Each kind: a height field, how steep its normal map is, and how its roughness follows it. */
const KINDS = {
  // Sand-cast aluminium: a fine, even grain with the odd pit.
  cast: (n) => ({
    h: field((u, v) => 0.5 * n.at(u, v, 64) + 0.3 * n.at(u, v, 128) + 0.2 * n.at(u, v, 256) - (n.at(u, v, 200) > 0.93 ? 0.6 : 0)),
    strength: 3.0, rough: (h) => 0.35 + 0.3 * (1 - h),
  }),
  // Brushed or machined metal: long fine lines along one direction.
  brushed: (n) => ({
    h: field((u, v) => 0.6 * n.at(u, v, 5, 256) + 0.3 * n.at(u, v, 6, 128) + 0.1 * n.at(u, v, 64)),
    strength: 1.6, rough: (h) => 0.4 + 0.2 * h,
  }),
  // A powder coat, a satin paint or a moulded plastic: a fine stipple.
  stipple: (n) => ({
    h: field((u, v) => 0.6 * n.at(u, v, 128) + 0.4 * n.at(u, v, 256)),
    strength: 1.2, rough: (h) => 0.45 + 0.1 * h,
  }),
  // Rubber: a soft, slightly lumpy matte skin (moulded, then scrubbed).
  rubber: (n) => ({
    h: field((u, v) => 0.5 * n.at(u, v, 32) + 0.35 * n.at(u, v, 96) + 0.15 * n.at(u, v, 256)),
    strength: 1.4, rough: (h) => 0.4 + 0.2 * h,
  }),
  // Orange peel under a clear coat: broad, gentle waves.
  peel: (n) => ({
    h: field((u, v) => 0.7 * n.at(u, v, 12) + 0.3 * n.at(u, v, 24)),
    strength: 0.6, rough: (h) => 0.48 + 0.04 * h,
  }),
  // Leather and suede (Race-Tex): a cellular grain.
  grain: (n) => {
    // A jittered grid of cells, one seed each, wrapped at the tile's edges (Worley's F2 − F1).
    const C = 36, seed = new Float32Array(C * C * 2);
    for (let i = 0; i < seed.length; i++) seed[i] = n.rnd();
    const cell = (u, v) => {
      const x = u * C, y = v * C, ix = Math.floor(x), iy = Math.floor(y);
      let d1 = 9, d2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = ix + i, cy = iy + j, k = ((((cy % C) + C) % C) * C + (((cx % C) + C) % C)) * 2;
        const dx = cx + seed[k] - x, dy = cy + seed[k + 1] - y, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return Math.sqrt(d2) - Math.sqrt(d1);
    };
    return { h: field((u, v) => Math.min(1, cell(u, v) * 2.2) + 0.2 * n.at(u, v, 128)), strength: 2.2, rough: (h) => 0.35 + 0.3 * (1 - h) };
  },
  // Carbon fibre, 2×2 twill: the tows crossing over and under, each tow's fibres along it.
  twill: (n) => {
    const T = 16;   // tows per tile each way
    return {
      h: field((u, v) => {
        const i = Math.floor(u * T), j = Math.floor(v * T), fu = u * T - i, fv = v * T - j;
        const warp = ((i + j) & 3) < 2;
        const across = warp ? fu : fv;
        const along = warp ? fv : fu;
        return Math.sin(Math.PI * across) * 0.8 + 0.15 * n.at(u, v, warp ? 26 : 256, warp ? 256 : 26) + 0.05 * Math.sin(Math.PI * along);
      }),
      strength: 2.6, rough: (h) => 0.5 + 0.1 * h,
      color: (h, i) => { const x = i % SIZE, y = Math.floor(i / SIZE), a = Math.floor(x / SIZE * T), b = Math.floor(y / SIZE * T), warp = ((a + b) & 3) < 2, k = 0.55 + 0.45 * h; const c = warp ? 92 : 62; return [c * k, c * k, (c + 6) * k]; },
    };
  },
};

function build(kind) {
  const n = makeNoise({ cast: 11, brushed: 23, stipple: 37, rubber: 41, peel: 53, grain: 67, twill: 79 }[kind]);
  const k = KINDS[kind](n);
  const hC = toCanvas(k.h);
  const normal = toTexture(heightToNormal(hC, k.strength), { srgb: false });
  const rough = toTexture(toCanvas(k.h, (h) => { const r = Math.max(0, Math.min(1, k.rough(h))) * 255; return [r, r, r]; }), { srgb: false });
  const color = k.color ? toTexture(toCanvas(k.h, k.color), { srgb: true }) : null;
  for (const t of [normal, rough, color]) if (t) { t.name = `detail-${kind}`; t.anisotropy = 4; }
  return { normal, rough, color };
}
function library(kind) {
  LIB ??= {};
  return (LIB[kind] ??= build(kind));
}

/**
 * Lays a kind of surface detail on a standard or physical material, in place.
 * @param mat       the material (its own maps and values are kept)
 * @param kind      'cast' | 'brushed' | 'stipple' | 'rubber' | 'peel' | 'grain' | 'twill'
 * @param size      the tile's size, m
 * @param normal    how much of the detail normal to add (0..)
 * @param rough     how far the roughness swings about the material's own (0..1)
 * @param color     how far the colour map (twill only) modulates the colour (0..1)
 * @param coat      how much of the detail normal the clear coat takes (physical materials), 0..
 */
export function applyDetail(mat, kind, { size = 0.05, normal = 1, rough = 0.3, color = 0, coat = normal } = {}) {
  if (typeof document === 'undefined' || !mat || mat.userData.detail) return mat;
  const L = library(kind);
  mat.userData.detail = kind;
  const U = {
    uDetN: { value: L.normal }, uDetR: { value: L.rough }, uDetC: { value: L.color ?? L.rough },
    uDetScale: { value: 1 / size }, uDetStrength: { value: normal }, uDetRough: { value: rough }, uDetColor: { value: L.color ? color : 0 },
    uDetCoat: { value: coat },
  };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDetP;\nvarying vec3 vDetN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDetP = position; vDetN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vDetP;
varying vec3 vDetN;
uniform mat3 normalMatrix;
uniform sampler2D uDetN, uDetR, uDetC;
uniform float uDetScale, uDetStrength, uDetRough, uDetColor, uDetCoat;
vec3 detW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / max(1e-5, w.x + w.y + w.z); }
float detScalar(sampler2D t, vec3 p, vec3 w) {
  return texture2D(t, p.zy).r * w.x + texture2D(t, p.xz).r * w.y + texture2D(t, p.xy).r * w.z;
}
vec3 detColor(sampler2D t, vec3 p, vec3 w) {
  return texture2D(t, p.zy).rgb * w.x + texture2D(t, p.xz).rgb * w.y + texture2D(t, p.xy).rgb * w.z;
}
// Triplanar normal mapping in object space, the 'whiteout' blend.
vec3 detNormal(vec3 p, vec3 n) {
  vec3 w = detW(n);
  vec3 tx = texture2D(uDetN, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(uDetN, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(uDetN, p.xy).xyz * 2.0 - 1.0;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 detPS = vDetP * uDetScale, detNS = normalize(vDetN);
  if (uDetColor > 0.0) diffuseColor.rgb *= mix(vec3(1.0), detColor(uDetC, detPS, detW(detNS)) * 2.4, uDetColor);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * mix(1.0, detScalar(uDetR, detPS, detW(detNS)) * 2.0, uDetRough), 0.02, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec3 detDelta = normalize(normalMatrix * detNormal(detPS, detNS)) * faceDirection - normalize(normalMatrix * detNS) * faceDirection;
  normal = normalize(normal + detDelta * uDetStrength);`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
  clearcoatNormal = normalize(clearcoatNormal + detDelta * uDetCoat);
#endif`);
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `vc-detail-${kind}${key ? key() : ''}`;
  mat.needsUpdate = true;
  return mat;
}
