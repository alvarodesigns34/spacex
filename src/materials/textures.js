/**
 * Procedural texture generation (Canvas 2D). Everything is generated at start-up so the
 * project needs no binary assets and every surface can be tuned in code.
 *
 * All textures are authored in metric tiles: `tileSize` is the physical size (m) covered by
 * one repeat, so materials set `repeat = 1 / tileSize` and geometry emits UVs in metres.
 */
import * as THREE from 'three';
import { seeded } from '../geometry/utils.js';

const rng = seeded(20260902);

// ---------- value-noise ----------
const LAT = 256;
const lattice = new Float32Array(LAT * LAT);
for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
function lat(ix, iy) { return lattice[((iy & (LAT - 1)) * LAT) + (ix & (LAT - 1))]; }
function smooth(t) { return t * t * (3 - 2 * t); }
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export function fbm(x, y, oct = 4, lac = 2.1, gain = 0.5) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
  return s / norm;
}

const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- canvas helpers ----------
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Runs fn(x, y, u, v) -> [r,g,b] (0..255) for every pixel. */
export function shade(c, fn) {
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data;
  const w = c.width, h = c.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rgb = fn(x, y, x / w, y / h);
      const i = (y * w + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Height (grayscale canvas) -> tangent-space normal map canvas, tileable. The heights are read
 * once into a float array and the wrap is resolved per row and column, not per sample: the
 * old version went through a closure with two modulos and a Math.hypot for each of four
 * samples a pixel, and was the single largest cost of building the materials.
 */
export function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0, n = w * h; i < n; i++) H[i] = sd[i * 4] / 255;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const row = y * w, up = ((y + h - 1) % h) * w, dn = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xl = x === 0 ? w - 1 : x - 1, xr = x === w - 1 ? 0 : x + 1;
      const nx = -(H[row + xr] - H[row + xl]) * strength;
      const ny = (H[dn + x] - H[up + x]) * strength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (row + x) * 4;
      d[i] = (nx * inv * 0.5 + 0.5) * 255; d[i + 1] = (ny * inv * 0.5 + 0.5) * 255; d[i + 2] = (inv * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * Ceiling on anisotropic filtering, set once from the quality tier and from what the hardware
 * actually offers.
 *
 * The tiers declared an `anisotropy` field from the day they were written and nothing read it:
 * every builder here asked for 8 or 16 outright, so the cheap tier paid the same per-sample
 * cost as the expensive one and the knob was decoration. Values passed below are requests now,
 * and this is the limit they are held to — which also stops the code asking a device for 16×
 * when it caps at 4 and silently getting something else.
 */
let ANISO_LIMIT = 8;
export function setAnisotropyLimit(n) { ANISO_LIMIT = Math.max(1, Math.floor(n) || 1); }
export function anisotropyLimit() { return ANISO_LIMIT; }

export function toTexture(c, { srgb = false, tileSize = null, tileSizeU = null, wrap = THREE.RepeatWrapping, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = wrap;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(anisotropy, ANISO_LIMIT);
  if (tileSize) t.repeat.set(1 / (tileSizeU ?? tileSize), 1 / tileSize);
  // Recorded so verify.js can ask the question that matters about a UV map: not "does it
  // vary?" but "does it vary at the rate this texture was authored for?". A map with a
  // tileSize expects metric UVs; one without expects a single normalised wrap. Mixing the two
  // is invisible in code and ruinous on screen — it is what left the 5 km apron untextured.
  t.userData.tileSize = tileSize ?? null;
  t.userData.tileSizeU = tileSize ? (tileSizeU ?? tileSize) : null;
  t.needsUpdate = true;
  return t;
}

// =====================================================================================
//  STAINLESS STEEL (Starship / Super Heavy) — one ring (1.83 m) per tile, weld seam on top.
// =====================================================================================
let _steelNormal = null;
export function makeSteel({ size = 768, ring = 1.83, heat = 0, soot = 0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  // Roll-forming leaves fine circumferential brushing; column-based streaks + fine grain.
  // Brushing runs fine and high-frequency: anything low-frequency here would tile visibly
  // around the circumference.
  const colStreak = new Float32Array(size);
  for (let x = 0; x < size; x++) colStreak[x] = fbm(x * 0.55, 3.7, 2) * 0.45 + fbm(x * 1.9, 11.1, 2) * 0.55;
  // Ring weld at v = 0.5 (one ring per tile) with its heat-affected zone, and the vertical
  // seam where two plates of a ring meet — the hull is rolled from plates, and photographs
  // show both weld directions clearly.
  const bead = new Float32Array(size);
  const haz = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    bead[y] = Math.exp(-Math.pow((v - 0.5) * size / 3.0, 2));
    haz[y] = Math.exp(-Math.pow((v - 0.5) * size / 11.0, 2));
  }
  const vseam = new Float32Array(size);
  const vhaz = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const u = x / size;
    vseam[x] = Math.exp(-Math.pow((u - 0.5) * size / 2.6, 2));
    vhaz[x] = Math.exp(-Math.pow((u - 0.5) * size / 9.0, 2));
    // Plates are slightly dished between welds; the shading falls off towards each seam.
    vhaz[x] += 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 2);
  }
  const marks = new Float32Array(size * size);
  {
    const mr = seeded(9127);
    const U = ring * 4;                       // metres across the tile
    const pxU = size / U, pxV = size / ring;  // px per metre, each way
    const dot = (cx, cy, rM) => {
      const rx = rM * pxU, ry = rM * pxV;
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d < 1.2) marks[y * size + x] = Math.max(marks[y * size + x], 0.55 * Math.min(1, (1.2 - d) * 5));
      }
    };
    const dash = (cx, cy, lenM, hM) => {
      for (let y = Math.floor(cy - hM * pxV); y <= cy + hM * pxV; y++) for (let x = Math.floor(cx - lenM * pxU / 2); x <= cx + lenM * pxU / 2; x++) {
        if (x >= 0 && y >= 0 && x < size && y < size) marks[y * size + x] = Math.max(marks[y * size + x], 0.5);
      }
    };
    // Kept clear of the ring weld (v = 0.5 in the tile).
    const place = () => [mr() * size, (mr() < 0.5 ? 0.12 + mr() * 0.3 : 0.58 + mr() * 0.3) * size];
    for (let k = 0; k < 7; k++) { const [x, y] = place(); dot(x, y, 0.012 + mr() * 0.008); }
    for (let k = 0; k < 3; k++) { const [x, y] = place(); dash(x - 0.05 * pxU, y, 0.07, 0.006); dash(x + 0.05 * pxU, y, 0.07, 0.006); }
    for (let k = 0; k < 2; k++) { const [x, y] = place(); for (let j = 0; j < 6; j++) dot(x + j * 0.035 * pxU, y, 0.006); }
    // Stringer stitch welds. The Block 3 barrels are stiffened by stringers welded on the inside,
    // and each stitch shows through the skin: vertical dotted lines about 30 cm apart, a dot
    // every 6 cm, over the whole hull (Booster 18/19 and Ship 40 photographs, 2026). Spacing
    // read off those photographs.
    const lineGap = 0.3 * pxU, dotGap = 0.06 * pxV;
    for (let lx = lineGap / 2; lx < size; lx += lineGap) {
      for (let ly = dotGap / 2; ly < size; ly += dotGap) {
        if (Math.abs(ly / size - 0.5) < 0.035) continue;      // not across the ring weld
        const cx = Math.round(lx), cy = Math.round(ly);
        for (let dy = -2; dy <= 2; dy++) for (let dx = 0; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < size && y >= 0 && y < size) marks[y * size + x] = Math.max(marks[y * size + x], 0.22 * (1 - Math.abs(dy) / 3));
        }
      }
    }
  }
  shade(map, (x, y, u, v) => {
    const streak = (colStreak[x] - 0.5) * 0.16;
    const grain = (noise2(x * 0.6, y * 0.6) - 0.5) * 0.045;
    const blotch = (fbm(u * 6 + 7, v * 9 + 3, 4) - 0.5) * 0.05;
    // Plate-to-plate variation. A Starship hull is rolled from sheet that does not all come
    // from the same coil, and the difference between neighbouring plates is clearly visible
    // in photographs — it is most of what stops a 70 m barrel reading as one extruded tube.
    // Keyed to the tile, so it varies by ring rather than washing across the whole vehicle.
    // Kept faint: in close photographs of a clean booster (BN4 in the High Bay, B7 on the
    // mount) neighbouring plates differ far less than the reflections across them do.
    const plate = (fbm(u * 1.7 + 31, v * 1.3 + 17, 2) - 0.5) * 0.03;
    // Mill-finish stainless is bright; the map is mostly reflectance modulation.
    // Mill-finish stainless photographs as a matte mid grey, not a mirror.
    let base = 0.74 + streak * 0.7 + grain + blotch + plate - vhaz[x] * 0.04;
    let r = base, g = base, b = base;
    // Heat-affected zone next to each weld runs slightly straw/blue.
    const hazMix = haz[y] * (0.35 + 0.65 * fbm(u * 6 + 2, v * 4, 3));
    r = lerp(r, base * 0.97, hazMix); g = lerp(g, base * 0.93, hazMix); b = lerp(b, base * 0.88, hazMix);
    if (heat > 0) {
      const heatMix = heat * (0.5 + 0.5 * fbm(u * 7 + 1, v * 5 + 9, 4));
      r = lerp(r, base * 0.90, heatMix); g = lerp(g, base * 0.76, heatMix); b = lerp(b, base * 0.60, heatMix);
      // Weld/flame discolouration on stainless runs straw → light blue; keep it subtle so it
      // reads as tempering rather than as paint.
      const blue = Math.max(0, fbm(u * 6 + 4, v * 6 + 2, 3) - 0.58) * heat * 1.1;
      r = lerp(r, base * 0.72, blue); g = lerp(g, base * 0.76, blue); b = lerp(b, base * 0.86, blue);
    }
    if (soot > 0) {
      const sm = soot * (0.35 + 0.65 * fbm(u * 5 + 11, v * 8, 4));
      r *= (1 - sm * 0.72); g *= (1 - sm * 0.72); b *= (1 - sm * 0.70);
    }
    const panel = (colStreak[x] - 0.5) * 0.05;
    // Ring welds read; the vertical plate seams are finer and, at 0.22, drew the hull as a
    // sheet of graph paper in every close view of the barrel.
    let dark = bead[y] * 0.20 + vseam[x] * 0.04;
    // Stencilled marks and fastener dots the photographs show scattered over every ring: small
    // dark dots, and pairs of short dashes (alignment and inspection marks), a few per plate.
    dark = Math.max(dark, marks[y * size + x]);
    return [clamp((r + panel) * (1 - dark) * 255), clamp((g + panel) * (1 - dark) * 255), clamp((b + panel) * (1 - dark) * 255)];
  });
  shade(rough, (x, y, u, v) => {
    // Bright mill finish: low roughness on the panels, rough at the weld and where it is
    // sooted or heat-tinted, which is what makes the ring seams read at a distance.
    // Mill-finish 304L off the coil is close to a mirror: the High Bay photographs of BN4 show
    // the hangar and the sky in it with sharp edges. 0.48 made a satin tube.
    const base = 0.33 + (colStreak[x] - 0.5) * 0.08 + (fbm(u * 7, v * 10, 3) - 0.5) * 0.06
      + bead[y] * 0.36 + haz[y] * 0.10 + vseam[x] * 0.14 + vhaz[x] * 0.06 + heat * 0.16 + soot * 0.34;
    const g = clamp(base * 255);
    return [g, g, g];
  });
  if (!_steelNormal) {
    const height = canvas(size, size);
    shade(height, (x, y, u, v) => {
      // Bead proud of the sheet, plus a shallow dish either side from weld shrinkage.
      const h = 0.5 + bead[y] * 0.40 - haz[y] * 0.10 + vseam[x] * 0.12 - vhaz[x] * 0.07
        + (noise2(x * 0.6, y * 0.6) - 0.5) * 0.05 + (fbm(u * 1.5, v * 16, 2) - 0.5) * 0.05;
      const g = clamp(h * 255);
      return [g, g, g];
    });
    _steelNormal = toTexture(heightToNormal(height, 1.8), { tileSize: ring, tileSizeU: ring * 4 });
  }
  const U = ring * 4;
  return {
    map: toTexture(map, { srgb: true, tileSize: ring, tileSizeU: U }),
    roughnessMap: toTexture(rough, { tileSize: ring, tileSizeU: U }),
    normalMap: _steelNormal,
    tileSize: ring,
  };
}

// =====================================================================================
//  FALCON first-stage full-body texture (unwrapped: u = around, v = height fraction).
//  Includes friction-stir-weld panel lines and markings. The exhibits are shown as new,
//  unflown vehicles, clean white as on the pad before a first flight: the gallery soot read as
//  a burnt, dirty finish rather than as flight history. `flown: true` keeps the reuse pattern.
// =====================================================================================
export function makeFalconBody({ w = 1024, h = 2048, height = 41.2, name = 'FALCON 9', flown = false } = {}) {
  const map = canvas(w, h);
  const rough = canvas(Math.round(w / 2), Math.round(h / 2));
  const circumference = Math.PI * 3.7;
  // Panel (barrel section) lines every ~2.4 m in height, plus 4 longitudinal welds (approximation).
  const panelPitch = 2.4 / height;
  // Soot on a flight-proven booster, as photographed after landing (Commons, B1019 at LZ-1, and
  // any reused core on the pad): the whole stage is greyed by the entry and landing burns, in
  // streaks that run down the airflow, heaviest over the LOX tank near the top of the stage and
  // on the side that faced the plume, and lightest at the base. Where the stowed legs covered
  // the skin there is a clean white shadow of each leg. The old pattern put the soot at the
  // BASE and nowhere else, which is the one place photographs show the stage cleanest, and
  // left the exhibit reading as a new, unflown white tube.
  const legU = [0.125, 0.375, 0.625, 0.875];            // leg azimuths π/4 + kπ/2, as u
  const legTop = 9.6 / height, circ = Math.PI * 3.7;
  const legShadow = (u, vv) => {
    if (vv > legTop + 0.01) return 0;
    const t = Math.min(1, vv / legTop);
    const half = (0.56 - 0.47 * t) / circ;                // the leg fairing's own taper
    let m = 0;
    for (const lu of legU) {
      const d = Math.abs(((u - lu + 1.5) % 1) - 0.5);
      m = Math.max(m, 1 - smoothstep(half * 0.85, half * 1.25, d));
    }
    return m * (1 - smoothstep(legTop - 0.01, legTop + 0.01, vv));
  };
  const sootAt = (u, vv) => {
    if (!flown) return 0;
    const streak = fbm(u * 70 + 5, vv * 2.4, 4);                    // long vertical streaks
    const patch = fbm(u * 9 + 2, vv * 5 + 7, 3);
    const amount = 0.66 + 0.30 * smoothstep(0.22, 0.88, vv);        // heavier towards the top
    const windward = 0.88 + 0.16 * Math.cos(Math.PI * 2 * (u - 0.62));
    const s = amount * windward * (0.62 + 0.38 * streak) * (0.88 + 0.24 * patch);
    return Math.min(0.9, s) * (1 - 0.9 * legShadow(u, vv));
  };
  // Falcon 9 and Falcon Heavy share the whole body shading and roughness; only the wordmark
  // painted on top differs. Shading a 1024 × 2048 map costs six million noise lookups, so the
  // unlettered result is kept per (size, height, flown) and the second vehicle copies it.
  const key = `${w}x${h}:${height}:${flown}`;
  const cached = FALCON_BODY_CACHE.get(key);
  if (cached) {
    map.getContext('2d').drawImage(cached.map, 0, 0);
    return letterFalconBody(map, cached.rough, w, h, name);
  }
  shade(map, (x, y, u, v) => {
    const vv = 1 - v; // canvas y=0 is the top of the stage
    let base = 0.93 + (fbm(u * 24, vv * 60, 3) - 0.5) * 0.05;
    const s = sootAt(u, vv);
    // Soot is a warm grey-brown, not neutral black.
    // Strong enough to survive the exposure: the stage is lit near white, and at 0.74 the
    // streaks came out as a faint tint. Photographs show a mid grey over most of the stage.
    let r = base * (1 - s * 0.9), g = base * (1 - s * 0.91), b = base * (1 - s * 0.88);
    // panel lines
    const pl = Math.abs(((vv / panelPitch) % 1) - 0.5) < 0.004 ? 0.08 : 0;
    const ll = Math.abs(((u * 4) % 1) - 0.5) < 0.0015 ? 0.06 : 0;
    r -= pl + ll; g -= pl + ll; b -= pl + ll;
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const vv = 1 - v;
    const s = sootAt(u, vv);
    const g = clamp((0.38 + (fbm(u * 30, vv * 80, 3) - 0.5) * 0.15 + s * 0.45) * 255);
    return [g, g, g];
  });
  const plain = canvas(w, h);
  plain.getContext('2d').drawImage(map, 0, 0);
  FALCON_BODY_CACHE.set(key, { map: plain, rough });
  return letterFalconBody(map, rough, w, h, name);
}
const FALCON_BODY_CACHE = new Map();

function letterFalconBody(map, rough, w, h, name) {
  // Markings: vehicle name reads top-to-bottom along the stage.
  const ctx = map.getContext('2d');
  ctx.save();
  ctx.translate(w * 0.115, h * 0.20);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#111114';
  ctx.font = `600 ${Math.round(w * 0.075)}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(w * 0.012)}px`;
  ctx.fillText(name, 0, 0);
  ctx.restore();
  // Secondary wordmark on the opposite side.
  ctx.save();
  ctx.translate(w * 0.615, h * 0.20);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#111114';
  ctx.font = `600 ${Math.round(w * 0.05)}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(w * 0.02)}px`;
  ctx.fillText('SPACEX', 0, 0);
  ctx.restore();
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: toTexture(rough, { wrap: THREE.ClampToEdgeWrapping }),
  };
}

/**
 * Falcon 1's exposed interstage was a dark, panel-built cylinder rather than a featureless
 * black band. This is a single normalized unwrap: broad composite/aluminium panels, lap seams
 * and restrained fastener rows. The pattern is intentionally low contrast so it survives at
 * the scale of a 1.68 m vehicle without turning into a checkerboard.
 */
export function makeFalcon1Interstage({ w = 768, h = 768 } = {}) {
  const map = canvas(w, h);
  const rough = canvas(w / 2, h / 2);
  shade(map, (x, y, u, v) => {
    const panel = (Math.floor(u * 8) + Math.floor(v * 3) * 3) % 5;
    const grain = (fbm(u * 22 + 5, v * 34 + 9, 4) - 0.5) * 0.055;
    const vertical = Math.min((u * 8) % 1, 1 - ((u * 8) % 1));
    const horizontal = Math.min((v * 3) % 1, 1 - ((v * 3) % 1));
    const seam = vertical < 0.010 || horizontal < 0.008;
    const fastenerPhase = ((u * 64 + 0.5) % 1);
    const nearBand = horizontal < 0.020;
    const rivet = nearBand && Math.abs(fastenerPhase - 0.5) < 0.08;
    let r = 0.105 + panel * 0.004 + grain;
    let g = 0.092 + panel * 0.003 + grain * 0.85;
    let b = 0.086 + panel * 0.002 + grain * 0.72;
    if (seam) { r *= 0.60; g *= 0.60; b *= 0.62; }
    if (rivet) { r += 0.20; g += 0.19; b += 0.18; }
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const vertical = Math.min((u * 8) % 1, 1 - ((u * 8) % 1));
    const horizontal = Math.min((v * 3) % 1, 1 - ((v * 3) % 1));
    const seam = vertical < 0.014 || horizontal < 0.012;
    const value = 0.63 + (fbm(u * 24, v * 30, 3) - 0.5) * 0.13 + (seam ? 0.18 : 0);
    const g = clamp(value * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: toTexture(rough, { wrap: THREE.ClampToEdgeWrapping }),
  };
}

// =====================================================================================
//  GENERIC WHITE PAINT (second stage, fairing, Dragon) with faint panel structure.
// =====================================================================================
export function makeWhitePaint({ size = 512, tile = 2.0, grid = 0, tone = 0.94, dirt = 0.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const hd = new Float32Array(size * size);
  shade(map, (x, y, u, v) => {
    let base = tone + (fbm(u * 12, v * 12, 3) - 0.5) * 0.04;
    let line = 0;
    if (grid > 0) {
      const gu = Math.abs(((u * grid) % 1) - 0.5) < 0.006 ? 1 : 0;
      const gv = Math.abs(((v * grid) % 1) - 0.5) < 0.006 ? 1 : 0;
      line = Math.max(gu, gv);
    }
    hd[y * size + x] = 0.5 - line * 0.4;
    const d = dirt * Math.max(0, fbm(u * 5 + 3, v * 5 + 7, 4) - 0.5) * 0.5;
    const c = clamp((base - line * 0.10 - d) * 255);
    return [c, c, clamp((base - line * 0.10 - d * 0.9) * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.42 + (fbm(u * 20, v * 20, 3) - 0.5) * 0.18) * 255); return [g, g, g]; });
  shade(height, (x, y) => { const g = clamp(hd[y * size + x] * 255); return [g, g, g]; });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 1.2), { tileSize: tile }),
    tileSize: tile,
  };
}

// =====================================================================================
//  THERMAL PROTECTION MOSAIC (distant level of detail for Starship's heat shield)
//
//  Thirteen thousand instanced hexagons of 0.26 m turn into sub-pixel noise as soon as the
//  vehicle is more than a few tens of metres away: the shield stops reading as a surface and
//  becomes a speckled smear with a frayed edge. This bakes the same mosaic into a tileable
//  map so the far view gets a clean panel, and the instanced tiles are kept for close range.
// =====================================================================================
export function makeTpsPattern({ size = 512, circumradius = 0.152, gap = 1.012, cols = 4, rows = 4 } = {}) {
  const w = Math.sqrt(3) * circumradius * gap;   // column pitch (flat to flat)
  const dy = 1.5 * circumradius * gap;           // row pitch
  const W = cols * w, H = rows * dy;             // physical size the texture covers
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const hash = (a, b) => {
    let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    return h / 4294967296;
  };
  // Nearest and second-nearest lattice centre give both the cell id and the seam distance.
  const cell = (x, y) => {
    let d1 = Infinity, d2 = Infinity, ca = 0, cb = 0;
    const r0 = Math.floor(y / dy);
    for (let rr = r0 - 1; rr <= r0 + 1; rr++) {
      const off = (((rr % 2) + 2) % 2) * w * 0.5;
      const c0 = Math.floor((x - off) / w);
      for (let cc = c0 - 1; cc <= c0 + 1; cc++) {
        const cx = cc * w + off, cy = rr * dy;
        const d = Math.hypot(x - cx, y - cy);
        if (d < d1) { d2 = d1; d1 = d; ca = cc; cb = rr; }
        else if (d < d2) d2 = d;
      }
    }
    return { d1, seam: d2 - d1, ca, cb };
  };
  const seamWidth = circumradius * 0.09;
  shade(map, (px, py, u, v) => {
    const { seam, ca, cb } = cell(u * W, v * H);
    const tone = 0.131 + (hash(ca, cb) - 0.5) * 0.045 + (fbm(u * 2.5, v * 2.5, 3) - 0.5) * 0.03;
    const g = Math.min(1, seam / seamWidth);            // 0 on the seam, 1 in the tile
    // The joints are pale (the instanced tiles' chamfered edges), but the baked seam is
    // several times wider than a real 3 mm joint, so it is only lifted a little: at the switch
    // distance a joint is a fraction of a pixel and only its share of the average survives.
    const c = tone * (g + 1.35 * (1 - g));
    return [clamp(c * 246), clamp(c * 250), clamp(c * 262)];
  });
  shade(rough, (px, py, u, v) => {
    const { seam } = cell(u * W, v * H);
    const g = Math.min(1, seam / seamWidth);
    const c = clamp((0.80 + (1 - g) * 0.16) * 255);
    return [c, c, c];
  });
  shade(height, (px, py, u, v) => {
    const { seam } = cell(u * W, v * H);
    const g = Math.min(1, seam / seamWidth);
    const c = clamp((0.30 + g * 0.62) * 255);
    return [c, c, c];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: H, tileSizeU: W }),
    roughnessMap: toTexture(rough, { tileSize: H, tileSizeU: W }),
    normalMap: toTexture(heightToNormal(height, 0.8), { tileSize: H, tileSizeU: W }),
    tileSize: H,
  };
}

// =====================================================================================
//  CARBON COMPOSITE (interstage, landing legs, fairing inside)
// =====================================================================================
export function makeCarbon({ size = 512, tile = 0.6 } = {}) {
  const map = canvas(size, size);
  const height = canvas(size, size);
  const rough = canvas(size, size);
  const cells = 48;
  shade(map, (x, y, u, v) => {
    const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
    const weave = ((cx + cy) % 2) ? 0.16 : 0.11;
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const strand = ((cx + cy) % 2) ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
    const c = clamp((weave + strand * 0.05 + (noise2(x * 0.8, y * 0.8) - 0.5) * 0.03) * 255);
    return [c, c, c + 2];
  });
  shade(height, (x, y, u, v) => {
    const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const strand = ((cx + cy) % 2) ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
    const g = clamp((0.4 + strand * 0.3) * 255);
    return [g, g, g];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.36 + (fbm(u * 10, v * 10, 2) - 0.5) * 0.1) * 255); return [g, g, g]; });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 0.8), { tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    tileSize: tile,
  };
}

// =====================================================================================
//  SOLAR CELLS
// =====================================================================================
export function makeSolar({ size = 512, tile = 1.0, cell = 0.125, tint = [0.13, 0.18, 0.34] } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const cells = tile / cell;
  shade(map, (x, y, u, v) => {
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const border = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97) ? 1 : 0;
    const bus = (Math.abs(fx - 0.5) < 0.012 || Math.abs(fx - 0.25) < 0.006 || Math.abs(fx - 0.75) < 0.006) ? 0.5 : 0;
    const n = (fbm(u * 30, v * 30, 2) - 0.5) * 0.06;
    const iri = fbm(u * 3 + 5, v * 3 + 2, 2);
    let r = tint[0] + n + iri * 0.06, g = tint[1] + n + iri * 0.05, b = tint[2] + n + iri * 0.02;
    if (border) { r = 0.72; g = 0.72; b = 0.70; }
    if (bus) { r = lerp(r, 0.75, bus); g = lerp(g, 0.75, bus); b = lerp(b, 0.72, bus); }
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const border = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97) ? 1 : 0;
    const g = clamp((border ? 0.5 : 0.18 + (fbm(u * 20, v * 20, 2) - 0.5) * 0.08) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const border = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97) ? 1 : 0;
    const g = clamp((border ? 0.3 : 0.6) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 0.6), { tileSize: tile }),
    tileSize: tile,
  };
}

// =====================================================================================
//  CONCRETE APRON (ground) with expansion joints.
// =====================================================================================
export function makeConcrete({ size = 768, tile = 12.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const joints = 2; // joints per tile => 6 m slabs
  shade(map, (x, y, u, v) => {
    const n = fbm(u * 6 + 2, v * 6 + 9, 5);
    const fine = (noise2(x * 0.9, y * 0.9) - 0.5) * 0.05;
    // The tile repeats every 12 m, so anything at the scale of metres in it repeats too: a
    // 5 m stain at 0.2 of contrast was the same dark blotch in every other slab across the
    // whole apron. Large-scale variation is kept faint, and each slab of the four in a tile
    // gets its own slight pour tone instead, which is what a slab apron actually shows.
    const stain = Math.max(0, fbm(u * 2.2 + 8, v * 2.2 + 1, 4) - 0.52) * 0.10;
    const slab = (noise2(Math.floor(u * joints) * 7.3 + 1.1, Math.floor(v * joints) * 5.9 + 3.7) - 0.5) * 0.05;
    const du = Math.abs(((u * joints) % 1) - 0.5);
    const dv = Math.abs(((v * joints) % 1) - 0.5);
    const jointDist = Math.min(du, dv);
    const joint = Math.max(0, 1 - jointDist / 0.008);
    const sealant = Math.max(0, 1 - jointDist / 0.0035);
    // 0.60 in sRGB is about 0.32 linear: weathered light-grey concrete. At 0.48 (0.2 linear),
    // times the material tint, the pad and the apron rendered as dark slate — darker than the
    // asphalt reads in photographs of Starbase, where the pads are pale.
    // Lighter and a little warmer again: under the default 20° sun most of the light on a flat
    // slab is blue skylight, and at 0.60 the apron still rendered slate blue-grey. Cured
    // concrete in the Texas sun is a pale warm grey.
    let c = 0.66 + (n - 0.5) * 0.06 + fine - stain * 0.5 + slab;
    c -= joint * 0.06 + sealant * 0.12;
    return [clamp(c * 1.04 * 255), clamp(c * 255), clamp(c * 0.92 * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const du = Math.abs(((u * joints) % 1) - 0.5);
    const dv = Math.abs(((v * joints) % 1) - 0.5);
    const jointDist = Math.min(du, dv);
    const sealant = Math.max(0, 1 - jointDist / 0.0035);
    const g = clamp((0.84 + (fbm(u * 12, v * 12, 3) - 0.5) * 0.15 - sealant * 0.25) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const du = Math.abs(((u * joints) % 1) - 0.5);
    const dv = Math.abs(((v * joints) % 1) - 0.5);
    const jointDist = Math.min(du, dv);
    const joint = Math.max(0, 1 - jointDist / 0.008);
    const sealant = Math.max(0, 1 - jointDist / 0.0035);
    const g = clamp((0.5 + (fbm(u * 24, v * 24, 3) - 0.5) * 0.18 - joint * 0.22 - sealant * 0.32) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 0.8), { tileSize: tile, anisotropy: 16 }),
    tileSize: tile,
  };
}

// =====================================================================================
//  GROUND TERRAIN (Boca Chica / Starbase coastal plain)
// =====================================================================================
export function makeGroundTerrain({ size = 1024, tile = 48.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  // Coastal salt flat. Frequencies are integer multiples of the lattice period
  // (256) so the tile meets itself: a non-periodic fbm drew a seam every tile,
  // which read as a grid across the apron.
  const period = (u, v, cells, ox = 0, oy = 0) => noise2(u * cells + ox, v * cells + oy);
  shade(map, (x, y, u, v) => {
    const dune = period(u, v, 256, 4, 9);
    const clay = period(u, v, 512, 20, 3);
    const salt = Math.max(0, dune - 0.42);
    const damp = Math.max(0, 0.48 - clay);
    const scrub = Math.max(0, period(u, v, 256, 80, 15) - 0.64);
    // No large-scale term in the tile. There was one — sin(2u)·cos(3v), integer cycles so the
    // 96 m repeat met itself — and it was the loudest artefact in the project: a regular grid
    // of light and dark bands, 32 to 48 m apart, across every wide shot, reading as corrugated
    // sheet rather than as a salt flat. Anything periodic at landscape scale does that, however
    // it is dressed. Landscape-scale variation now comes from world-space noise in the terrain
    // material's shader (library.js), which has no period at all; the tile carries only the
    // grain, which is too fine to be seen repeating.
    // Warm enough to survive the sky. At 18° of sun about half the light on flat ground is blue
    // skylight (hemisphere + environment), and a neutral tan multiplied by it came out
    // grey-green; the albedo carries a little more red so the plain still reads as sand.
    let r = 0.70, g = 0.615, b = 0.455;
    r = lerp(r, 0.80, salt); g = lerp(g, 0.725, salt); b = lerp(b, 0.545, salt);
    // Damp ground on a tidal flat is darker SAND — grey-brown mud — not green; the green is the
    // sparse scrub, and only where it grows. With damp hollows tinted olive as well, the two
    // together averaged the whole plain to grey-green felt at any distance past a hundred metres,
    // where Boca Chica reads pale tan with scattered darker patches.
    r = lerp(r, 0.45, damp * 0.8); g = lerp(g, 0.42, damp * 0.8); b = lerp(b, 0.34, damp * 0.8);
    r = lerp(r, 0.36, scrub * 1.3); g = lerp(g, 0.41, scrub * 1.3); b = lerp(b, 0.25, scrub * 1.3);
    // Close-range grain, at the resolution a visitor standing on the plain sees: 4.7 cm per
    // pixel over the 48 m tile. The old tile carried two noise frequencies (37 and 19 cm) and
    // nothing finer, so from a few metres the ground was a smooth wash. Now:
    //  · sand grain at the pixel scale;
    //  · short grass blades, streaks 4:1 in clusters, darker olive and dry straw;
    //  · small stones and pale shell grit scattered through it.
    // Every frequency is a whole multiple of the noise lattice's 256-cell period, so the tile
    // still meets itself.
    const grain = (period(u, v, 1024, 13, 5) - 0.5) * 0.07;
    r *= 1 + grain; g *= 1 + grain; b *= 1 + grain * 0.9;
    const blade = smoothstep(0.7, 0.88, noise2(u * 1024 + 71, v * 512 + 19)) * smoothstep(0.45, 0.65, period(u, v, 256, 55, 31));
    const straw = period(u, v, 512, 91, 7);
    r = lerp(r, lerp(0.30, 0.62, straw), blade * 0.45); g = lerp(g, lerp(0.34, 0.56, straw), blade * 0.45); b = lerp(b, lerp(0.17, 0.34, straw), blade * 0.45);
    const stone = smoothstep(0.84, 0.93, period(u, v, 1024, 101, 57));
    const shell = smoothstep(0.9, 0.97, period(u, v, 1024, 17, 211));
    r = lerp(r, 0.44, stone * 0.4); g = lerp(g, 0.4, stone * 0.4); b = lerp(b, 0.33, stone * 0.4);
    r = lerp(r, 0.86, shell * 0.35); g = lerp(g, 0.82, shell * 0.35); b = lerp(b, 0.72, shell * 0.35);
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const g = clamp((0.9 + (period(u, v, 512) - 0.5) * 0.08 + (period(u, v, 1024, 3, 9) - 0.5) * 0.06) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const blade = smoothstep(0.7, 0.88, noise2(u * 1024 + 71, v * 512 + 19)) * smoothstep(0.45, 0.65, period(u, v, 256, 55, 31));
    const stone = smoothstep(0.84, 0.93, period(u, v, 1024, 101, 57));
    const g = clamp((0.5 + (period(u, v, 256, 2, 6) - 0.5) * 0.2 + (period(u, v, 1024, 13, 5) - 0.5) * 0.12 + blade * 0.12 + stone * 0.18) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 1.1), { tileSize: tile, anisotropy: 16 }),
    tileSize: tile,
  };
}

// =====================================================================================
//  TRENCH REFRACTORY ARMOR (heat-scorched stainless steel flame deflector lining)
// =====================================================================================
export function makeTrenchArmor({ size = 512, tile = 8.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const panels = 2;
  shade(map, (x, y, u, v) => {
    const streak = fbm(u * 24 + 4, v * 4 + 1, 4);
    const soot = Math.max(0, fbm(u * 5, v * 2, 3) - 0.42) * 0.55;
    const pu = Math.abs(((u * panels) % 1) - 0.5);
    const seam = pu < 0.008 ? 1 : 0;
    let base = 0.44 + (streak - 0.5) * 0.09 - soot * 0.35;
    let r = base * 0.96, g = base * 0.97, b = base * 1.02;
    const heat = Math.max(0, fbm(u * 8 + 2, v * 3 + 7, 3) - 0.5) * 0.22;
    r += heat * 0.12; g += heat * 0.05;
    if (seam) { r *= 0.55; g *= 0.55; b *= 0.55; }
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const g = clamp((0.46 + (fbm(u * 14, v * 14, 3) - 0.5) * 0.16) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const pu = Math.abs(((u * panels) % 1) - 0.5);
    const seam = pu < 0.008 ? 1 : 0;
    const g = clamp((0.5 + (fbm(u * 18, v * 18, 2) - 0.5) * 0.1 - seam * 0.28) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 1.3), { tileSize: tile, anisotropy: 16 }),
    tileSize: tile,
  };
}

// =====================================================================================
//  MULTI-LAYER INSULATION FOIL (crinkled)
// =====================================================================================
/**
 * Cryogenic frost on a loaded tank: a white-blue skin of ice, streaked vertically where
 * condensate runs and refreezes, with bare-steel runs where sheets of it have already let go.
 * The colour map carries the ice tone; the alpha map is the coverage the launch sequence
 * fades in and out. Periodic in both directions (integer lattice frequencies) so the 4 m tile
 * meets itself round the hull.
 */
export function makeFrost({ size = 512, tile = 16.0, tileU = 4.0 } = {}) {
  // One tile is 4 m round the hull by 16 m up it, so nothing repeats at a height the eye can
  // lock onto; at 4 m square the pattern stacked into bands down the booster.
  const map = canvas(size, size);
  const alpha = canvas(size, size);
  const per = (u, v, fu, fv, ou = 0, ov = 0) => noise2(u * fu + ou, v * fv + ov);
  // Contrast, not whiteness, is what reads as frost on already-bright steel: matte ice with
  // darker vertical runs where condensate has melted and run down, and soft tall gaps where
  // sheets have fallen away.
  const runsAt = (u, v) => per(u, v, 80, 3, 11, 2) * 0.6 + per(u, v, 28, 2, 5, 9) * 0.4;
  shade(map, (x, y, u, v) => {
    const n = per(u, v, 64, 24, 3, 7);
    const wet = Math.max(0, runsAt(u, v) - 0.55) * 2.6;
    const c = (0.84 + (n - 0.5) * 0.06) * (1 - 0.42 * Math.min(1, wet));
    return [clamp(c * 0.95 * 255), clamp(c * 0.97 * 255), clamp(c * 255)];
  });
  shade(alpha, (x, y, u, v) => {
    const shed = per(u, v, 12, 3, 21, 13) * 0.7 + per(u, v, 40, 6, 3, 17) * 0.3;
    const gap = THREE.MathUtils.smoothstep(shed, 0.6, 0.75);
    const a = (0.72 + (runsAt(u, v) - 0.5) * 0.25) * (1 - 0.8 * gap);
    const g = clamp(a * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, tileSizeU: tileU }),
    alphaMap: toTexture(alpha, { tileSize: tile, tileSizeU: tileU }),
    tileSize: tile,
  };
}

export function makeFoil({ size = 256, tile = 0.5 } = {}) {
  const map = canvas(size, size);
  const height = canvas(size, size);
  shade(height, (x, y, u, v) => {
    const c = fbm(u * 18, v * 18, 5, 2.4, 0.55);
    const crease = Math.abs(fbm(u * 9 + 3, v * 9 + 1, 3) - 0.5) * 2;
    const g = clamp((c * 0.7 + crease * 0.3) * 255);
    return [g, g, g];
  });
  shade(map, (x, y, u, v) => {
    const c = 0.85 + (fbm(u * 18, v * 18, 4) - 0.5) * 0.2;
    return [clamp(c * 255), clamp(c * 0.78 * 255), clamp(c * 0.42 * 255)];
  });
  return { map: toTexture(map, { srgb: true, tileSize: tile }), normalMap: toTexture(heightToNormal(height, 3.0), { tileSize: tile }), tileSize: tile };
}

// =====================================================================================
//  PICA-X style ablative heat shield (Dragon): dark, matte, tiled in sectors.
// =====================================================================================
export function makePica({ size = 512 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  // polar tile pattern: 12 sectors x 4 rings around the centre of the texture.
  const polar = (u, v) => {
    const dx = u - 0.5, dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
    return [r, a];
  };
  // PICA-X: a phenolic-impregnated carbon ablator. The surface is a field of
  // small tiles with open pores and a char gradient (hotter toward the centre of
  // the shield), not a pie of twelve sectors and not a generic carbon weave.
  const cells = 18;
  shade(map, (x, y, u, v) => {
    const [rad] = polar(u, v);
    const cu = (u * cells) % 1, cv = (v * cells) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    const gap = Math.max(0, 1 - seam / 0.06);
    const pore = Math.max(0, fbm(u * 40, v * 40, 3) - 0.62);
    const tile = 0.16 + ((Math.floor(u * cells) * 5 + Math.floor(v * cells) * 3) % 7) * 0.012;
    const char = fbm(u * 3.5, v * 3.5, 3);
    // Centre of the cap chars darker; the rim, which sees less flux, stays browner.
    const heat = Math.max(0, 1 - rad * 1.15);
    let c = tile + (char - 0.5) * 0.05 - pore * 0.08 - gap * 0.07;
    c = lerp(c, c * 0.72, heat * 0.85);
    const warm = (1 - heat) * 0.18;
    return [clamp((c + warm) * 255), clamp((c + warm * 0.35) * 255), clamp(c * 0.86 * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const cu = (u * cells) % 1, cv = (v * cells) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    const gap = Math.max(0, 1 - seam / 0.06);
    const g = clamp((0.9 - gap * 0.08 + (fbm(u * 20, v * 20, 2) - 0.5) * 0.06) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const cu = (u * cells) % 1, cv = (v * cells) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    const gap = Math.max(0, 1 - seam / 0.07);
    const pore = fbm(u * 36, v * 36, 2);
    const g = clamp((0.62 - gap * 0.28 + (pore - 0.5) * 0.1) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: toTexture(rough, { wrap: THREE.ClampToEdgeWrapping }),
    normalMap: toTexture(heightToNormal(height, 1.5), { wrap: THREE.ClampToEdgeWrapping }),
  };
}

// =====================================================================================
//  DARK ALLOY (engine bells) — vertical gradient with heat discolouration bands.
// =====================================================================================
export function makeEngineBell({ size = 384, copper = 0.5 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  shade(map, (x, y, u, v) => {
    // v = 0 at the exit plane, 1 at the throat/chamber
    const streak = (fbm(u * 40, v * 3, 3) - 0.5) * 0.08;
    const band = fbm(u * 2, v * 9 + 3, 3);
    let r = 0.36 + streak, g = 0.34 + streak, b = 0.33 + streak;
    const heat = Math.max(0, 0.6 - Math.abs(v - 0.25) * 2) * copper;
    r = lerp(r, 0.55, heat * band); g = lerp(g, 0.32, heat * band); b = lerp(b, 0.22, heat * band);
    const blue = Math.max(0, 0.5 - Math.abs(v - 0.55) * 3) * copper * 0.7;
    r = lerp(r, 0.25, blue * (1 - band)); g = lerp(g, 0.28, blue * (1 - band)); b = lerp(b, 0.40, blue * (1 - band));
    // cooling channel ribs (regenerative cooling tubes)
    const rib = Math.sin(u * Math.PI * 2 * 90) * 0.5 + 0.5;
    const ribMix = 0.05 * (1 - v * 0.5);
    r += (rib - 0.5) * ribMix; g += (rib - 0.5) * ribMix; b += (rib - 0.5) * ribMix;
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.42 + (fbm(u * 12, v * 12, 3) - 0.5) * 0.2 + (1 - v) * 0.1) * 255); return [g, g, g]; });
  shade(height, (x, y, u, v) => {
    // Regenerative channels as relief, so a raking sun picks them out of the metal
    // instead of a painted stripe. One wrap of the bell, matching the colour map.
    const rib = Math.sin(u * Math.PI * 2 * 64) * 0.5 + 0.5;
    const lip = Math.max(0, 1 - v * 10);
    // A few tenths of a millimetre of tube relief, not a corrugated sheet.
    const g = clamp((0.48 + rib * 0.14 * (1 - v * 0.45) + lip * 0.1) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.RepeatWrapping }),
    roughnessMap: toTexture(rough),
    normalMap: toTexture(heightToNormal(height, 0.85), { wrap: THREE.RepeatWrapping }),
  };
}

// =====================================================================================
//  GRID (used on mount surfaces / small technical panels)
// =====================================================================================
export function makeGreyMetal({ size = 256, tile = 1.0, tone = 0.5 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  shade(map, (x, y, u, v) => {
    const c = tone + (fbm(u * 8, v * 8, 4) - 0.5) * 0.14 + (noise2(x * 0.7, y * 0.7) - 0.5) * 0.04;
    return [clamp(c * 255), clamp(c * 255), clamp(c * 1.02 * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.55 + (fbm(u * 10, v * 10, 3) - 0.5) * 0.25) * 255); return [g, g, g]; });
  return { map: toTexture(map, { srgb: true, tileSize: tile }), roughnessMap: toTexture(rough, { tileSize: tile }), tileSize: tile };
}

/**
 * Wave normals for the sea beyond the beach. Tiles on the noise lattice's 256-cell period, so
 * the only scale available is the tile's: 256 cells over 420 m gives swell of a metre or two,
 * with a finer chop on top — what a gentle Gulf surface looks like from a kilometre away.
 */
export function makeWater({ size = 512, tile = 420 } = {}) {
  const height = canvas(size, size);
  shade(height, (x, y, u, v) => {
    const swell = noise2(u * 256 + 3, v * 256 * 0.5 + 9) * 0.6 + noise2(u * 512 + 11, v * 512 + 2) * 0.4;
    const g = Math.max(0, Math.min(255, swell * 255));
    return [g, g, g];
  });
  return { normalMap: toTexture(heightToNormal(height, 1.4), { tileSize: tile, anisotropy: 8 }), tileSize: tile };
}

// =====================================================================================
//  ASPHALT (visitor road). Dense-graded hot mix, aged: the binder has oxidised to a mid grey
//  and the coarse aggregate stands proud of it. Crack sealing runs as glossy black
//  squiggles, and the odd rectangular patch sits a shade darker. Tiles every 6 m.
// =====================================================================================
export function makeAsphalt({ size = 1024, tile = 6.0 } = {}) {
  const map = canvas(size, size), rough = canvas(size, size), height = canvas(size, size);
  const r = seeded(4417);
  // Patches: axis-aligned, slightly darker and smoother, in tile units (wrap-safe inside).
  const patches = Array.from({ length: 3 }, () => {
    const w = 0.08 + r() * 0.16, h = 0.06 + r() * 0.12;
    const x = 0.05 + r() * (0.9 - w), y = 0.05 + r() * (0.9 - h);
    return [x, y, x + w, y + h, (r() - 0.5) * 0.04];
  });
  const patchAt = (u, v) => {
    for (const [x0, y0, x1, y1, t] of patches) if (u > x0 && u < x1 && v > y0 && v < y1) {
      const e = Math.min(u - x0, x1 - u, v - y0, y1 - v);
      return { t, edge: e < 0.0025 };
    }
    return null;
  };
  // Coarse aggregate: stones a few millimetres to a centimetre across (0.6 cm/px at 6 m / 1024).
  // All three maps read it at every pixel, so it is worked out once, not three times.
  const STONE = new Float32Array(size * size), PIT = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    STONE[y * size + x] = smoothstep(0.66, 0.78, noise2(x * 0.55, y * 0.55));
    PIT[y * size + x] = smoothstep(0.74, 0.86, noise2(x * 1.3 + 40, y * 1.3 + 17));
  }
  const grain = (x, y) => ({ stone: STONE[y * size + x], pit: PIT[y * size + x] });
  shade(map, (x, y, u, v) => {
    const { stone, pit } = grain(x, y);
    const broad = (fbm(u * 5 + 3, v * 5 + 11, 4) - 0.5) * 0.05;
    const p = patchAt(u, v);
    let c = 0.36 + broad + stone * 0.13 - pit * 0.10 + (noise2(x * 2.1, y * 2.1) - 0.5) * 0.05;
    if (p) c += p.t - 0.035 - (p.edge ? 0.05 : 0);
    // Stones catch colour of their own: some warm, some cool.
    const tint = (noise2(x * 0.55 + 90, y * 0.55 + 31) - 0.5) * stone * 0.06;
    return [clamp((c + tint) * 1.02 * 255), clamp(c * 255), clamp((c - tint) * 0.97 * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const { stone } = grain(x, y);
    const p = patchAt(u, v);
    const g = clamp((0.9 - stone * 0.12 - (p ? 0.05 : 0) + (fbm(u * 18, v * 18, 3) - 0.5) * 0.08) * 255);
    return [g, g, g];
  });
  shade(height, (x, y) => {
    const { stone, pit } = grain(x, y);
    const g = clamp((0.5 + stone * 0.35 - pit * 0.4) * 255);
    return [g, g, g];
  });
  // Crack sealing: meandering transverse and longitudinal runs, drawn over the three maps
  // (black and glossy on the colour and roughness, slightly proud on the height).
  const cracks = [];
  for (let i = 0; i < 7; i++) {
    const transverse = i < 4;
    let x = r() * size, y = r() * size;
    const pts = [[x, y]];
    const len = size * (0.25 + r() * 0.45);
    for (let s = 0; s < len; s += 6) {
      const a = (transverse ? Math.PI / 2 : 0) + (noise2(i * 13 + s * 0.02, 5) - 0.5) * 1.6;
      x += Math.cos(a) * 6; y += Math.sin(a) * 6;
      pts.push([x, y]);
    }
    cracks.push({ pts, w: 3 + r() * 4 });
  }
  const draw = (c, style, widen = 1) => {
    const ctx = c.getContext('2d');
    ctx.strokeStyle = style; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const { pts, w } of cracks) for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      ctx.lineWidth = w * widen;
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
      ctx.stroke();
    }
  };
  draw(map, 'rgba(22,22,24,0.9)');
  draw(rough, 'rgb(120,120,120)');
  draw(height, 'rgb(150,150,150)', 0.8);
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 8 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 4 }),
    normalMap: toTexture(heightToNormal(height, 1.4), { tileSize: tile, anisotropy: 4 }),
    tileSize: tile,
  };
}

// Road paint: thermoplastic worn by traffic. White, multiplied by vertex colour for the yellow
// centre line; the aggregate shows through in dark specks where the paint has abraded.
export function makeRoadPaint({ size = 256, tile = 1.0 } = {}) {
  const map = canvas(size, size);
  shade(map, (x, y, u, v) => {
    const wear = smoothstep(0.58, 0.72, fbm(u * 6 + 7, v * 6 + 3, 4));
    const speck = smoothstep(0.7, 0.8, noise2(x * 0.9, y * 0.9));
    const c = 0.93 - wear * 0.45 - speck * 0.35 + (noise2(x * 0.3, y * 0.3) - 0.5) * 0.05;
    return [clamp(c * 255), clamp(c * 255), clamp(c * 0.98 * 255)];
  });
  return { map: toTexture(map, { srgb: true, tileSize: tile }), tileSize: tile };
}

// =====================================================================================
//  WEATHERED PAINTED STEEL (Pad 2 tower, arms and mount). Dark grey coating on a coastal
//  site: uneven paint, rust weeping down from joints and edges in vertical streaks, chipped
//  spots showing lighter primer, a little salt bloom. Tiles every 4 m; boxUV maps it in
//  metres on every face, and on the vertical faces v runs up, so the streaks hang down.
// =====================================================================================
export function makeWeatheredSteel({ size = 512, tile = 4.0 } = {}) {
  const map = canvas(size, size), rough = canvas(size, size), height = canvas(size, size);
  const field = (x, y, u, v) => {
    const paint = (fbm(u * 6 + 3, v * 6 + 9, 4) - 0.5) * 0.06;
    // Rust weeps: narrow in u, long in v, strongest just below "joints" every metre.
    const col = fbm(u * 38 + 11, 3.7, 2);
    const weep = Math.max(0, col - 0.55) * 2.2 * (0.35 + 0.65 * ((v * 4) % 1));
    const chip = smoothstep(0.78, 0.84, noise2(x * 0.35 + 50, y * 0.35 + 20));
    const salt = Math.max(0, fbm(u * 3 + 40, v * 3 + 2, 3) - 0.62) * 0.8;
    return { paint, weep: Math.min(1, weep), chip, salt };
  };
  shade(map, (x, y, u, v) => {
    const { paint, weep, chip, salt } = field(x, y, u, v);
    let r = 0.25 + paint, g = 0.26 + paint, b = 0.28 + paint;
    // Rust: a warm brown laid over the grey.
    r = r * (1 - weep * 0.5) + 0.36 * weep * 0.5; g = g * (1 - weep * 0.5) + 0.22 * weep * 0.5; b = b * (1 - weep * 0.5) + 0.14 * weep * 0.5;
    // Chips show the lighter primer; salt bloom lifts the surface a little.
    r += chip * 0.14 + salt * 0.06; g += chip * 0.13 + salt * 0.06; b += chip * 0.11 + salt * 0.06;
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const { weep, chip, salt } = field(x, y, u, v);
    const g = clamp((0.62 + weep * 0.2 + chip * 0.15 + salt * 0.1 + (fbm(u * 20, v * 20, 3) - 0.5) * 0.1) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const { chip } = field(x, y, u, v);
    const g = clamp((0.5 - chip * 0.25 + (noise2(x * 0.8, y * 0.8) - 0.5) * 0.06) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 1.0), { tileSize: tile }),
    tileSize: tile,
  };
}

/**
 * Pad 2's tower cladding: bare light-grey steel plate, as the ground and aerial photographs of
 * the finished pad show it (NASASpaceflight, 2025–2026) — not the dark painted steel of the
 * arms. Plate-to-plate tone steps, faint grime streaks running down from the joints, and a
 * satin sheen. Metric UVs; one tile is `tile` metres.
 */
export function makeTowerClad({ size = 512, tile = 4.0 } = {}) {
  const map = canvas(size, size), rough = canvas(size, size), height = canvas(size, size);
  const field = (x, y, u, v) => {
    // Plates of 1 m × 2 m: each its own shade, a few per cent either side.
    const pu = Math.floor(u * 4), pv = Math.floor(v * 2);
    const plate = (noise2(pu * 7.3 + 1.1, pv * 5.9 + 3.7) - 0.5) * 0.07;
    const mottle = (fbm(u * 9 + 5, v * 9 + 1, 4) - 0.5) * 0.05;
    // Grime runs down from each plate's upper edge, narrow and fading.
    const col = fbm(u * 44 + 2, 7.1, 2);
    const run = Math.max(0, col - 0.58) * 2.4 * (1 - ((v * 2) % 1));
    const seam = Math.min(1, Math.max(smoothstep(0.985, 1.0, (u * 4) % 1), smoothstep(0.99, 1.0, (v * 2) % 1)));
    return { plate, mottle, run: Math.min(1, run), seam };
  };
  shade(map, (x, y, u, v) => {
    const { plate, mottle, run, seam } = field(x, y, u, v);
    let g = 0.6 + plate + mottle - run * 0.12 - seam * 0.18;
    return [clamp(g * 255), clamp((g + 0.006) * 255), clamp((g + 0.014) * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const { plate, run } = field(x, y, u, v);
    const g = clamp((0.5 + plate * 1.5 + run * 0.18 + (fbm(u * 24, v * 24, 3) - 0.5) * 0.08) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const { seam } = field(x, y, u, v);
    const g = clamp((0.5 - seam * 0.3 + (noise2(x * 0.9, y * 0.9) - 0.5) * 0.03) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 1.0), { tileSize: tile }),
    tileSize: tile,
  };
}
