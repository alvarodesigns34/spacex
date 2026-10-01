/**
 * The X-15's finishes, painted procedurally like every map in the centre (textures.js), from
 * NASA's photograph EC67-1652 (56-6670 on Rogers Dry Lake, 1967) and the Smithsonian's
 * photographs of 56-6670 (reference only):
 *
 *  - the fuselage gets one atlas of its own, not a tile: UV = (station, arc length round the
 *    section), both in metres, so seams, rivet rows, bare-metal panels and the stencils can be
 *    put where they are on the airplane;
 *  - the flying surfaces share a tile of panels and rivet rows;
 *  - the paint is black and dielectric; the metal shows only where the paint does not cover it.
 *
 * Positions and sizes of seams, rivet rows and stencils are read off those photographs (≈); none
 * is a published dimension. No insignia and no agency marking: the centre's rule on flags and
 * logos leaves them off, and only the text stencils are painted.
 */
import * as THREE from 'three';
import { canvas, toTexture, heightToNormal, noise2 } from './textures.js';

/** Fuselage atlas extent: stations −0.1 … 15.1 m along X, 0 … 6 m of arc along Y. */
export const SKIN_S0 = -0.1, SKIN_LEN = 15.2, SKIN_ARC = 6.0;

/**
 * Circumferential seams (frames), stations in metres, and longitudinal ones as angles from the
 * top centre line, read off the photographs: the panel breaks the riveting shows.
 */
const FRAMES = [0.9, 1.32, 1.78, 2.03, 2.95, 3.81, 4.55, 5.25, 6.0, 6.75, 7.5, 8.25, 9.0, 9.75, 10.5, 11.25, 12.0, 12.75, 13.5, 14.29];
const LONGERONS = [0, 40, 75, 105, 140, 180, 220, 255, 285, 320];

/**
 * @param uvAt (s, phiDeg) → arc length at that station and angle (from the model, so the atlas
 *        and the geometry agree); phi 0 = top, 90 = the left side (−Z), 270 = the right
 * @param perimeter (s) → the section's perimeter
 * @param level (s0, phi0, s1) → the angle at s1 at the height of (s0, phi0)
 */
export function makeX15Skin({ uvAt, perimeter, level, size = 4096, decals = [] }) {
  const W = size, H = Math.round(size * SKIN_ARC / SKIN_LEN);
  const px = (s) => (s - SKIN_S0) / SKIN_LEN * W, py = (a) => a / SKIN_ARC * H;
  const col = canvas(W, H), hgt = canvas(W, H), orm = canvas(W, H);
  const cc = col.getContext('2d'), hc = hgt.getContext('2d'), oc = orm.getContext('2d');
  // Base: black paint, flat height, roughness ≈0.36 (G), metalness 0 (B).
  cc.fillStyle = '#141518'; cc.fillRect(0, 0, W, H);
  hc.fillStyle = 'rgb(128,128,128)'; hc.fillRect(0, 0, W, H);
  oc.fillStyle = 'rgb(255,92,0)'; oc.fillRect(0, 0, W, H);

  // Panels: each frame bay × longeron bay is one sheet, a shade and a sheen of its own — in
  // every photograph the sheets read by how they catch the light, not by their seams.
  const step = 0.05;
  for (let f = 0; f < FRAMES.length - 1; f++) {
    for (let l = 0; l < LONGERONS.length; l++) {
      const a0 = LONGERONS[l], a1 = LONGERONS[(l + 1) % LONGERONS.length] + (l === LONGERONS.length - 1 ? 360 : 0);
      const n = noise2(f * 3.1 + 0.7, l * 5.3 + 1.1) - 0.5;
      const tone = Math.round(20 + n * 9), rough = Math.round(92 + n * 34);
      cc.fillStyle = `rgb(${tone},${tone + 1},${tone + 4})`;
      oc.fillStyle = `rgb(255,${rough},0)`;
      for (let s = FRAMES[f]; s < FRAMES[f + 1]; s += step) {
        const y0 = py(uvAt(s, a0)), y1 = py(uvAt(s, Math.min(a1, 359.9)));
        const x = px(s), w = Math.ceil(px(s + step) - x) + 1;
        if (y1 > y0) { cc.fillRect(x, y0, w, y1 - y0); oc.fillRect(x, y0, w, y1 - y0); }
      }
    }
  }
  // Heat: the aft underside, under the engine bay, scorched to a brown and blue-grey sheen.
  for (let s = 11.0; s < 14.94; s += step) {
    const p = perimeter(s), a = uvAt(s, 180);
    const span = 0.22 * p, x = px(s), w = Math.ceil(px(s + step) - x) + 1;
    const g = cc.createLinearGradient(0, py(a - span), 0, py(a + span));
    const k = Math.min(1, (s - 11) / 2.2);
    g.addColorStop(0, 'rgba(70,58,48,0)');
    g.addColorStop(0.5, `rgba(78,66,58,${0.55 * k})`);
    g.addColorStop(1, 'rgba(70,58,48,0)');
    cc.fillStyle = g; cc.fillRect(x, py(a - span), w, py(2 * span));
  }

  // Seams: shallow grooves, a little lighter where the paint thins on the edge.
  hc.fillStyle = 'rgb(100,100,100)';
  cc.fillStyle = 'rgba(70,72,78,0.55)';
  for (const s of FRAMES) { const x = px(s); hc.fillRect(x - 1, 0, 2, H); cc.fillRect(x - 0.5, 0, 1, H); }
  // Longitudinal seams as polylines: drawn as steps they read as a hatch wherever the section
  // grows quickly (the nose), the angle's arc climbing across the atlas.
  hc.strokeStyle = 'rgb(100,100,100)'; cc.strokeStyle = 'rgba(70,72,78,0.55)';
  for (const phi of LONGERONS) {
    for (const [ctx, lw] of [[hc, 2], [cc, 1]]) {
      ctx.lineWidth = lw; ctx.beginPath();
      for (let s = SKIN_S0; s < 15.0; s += step) { const x = px(s), y = py(uvAt(s, phi)); if (s === SKIN_S0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  // Rivets: double rows along the frames, single rows along the longerons and between them
  // (the stringers), ≈25 mm pitch on seams and ≈40 mm on stringers. Flush heads: a faint dome
  // in the height map, a pin-point of lighter paint.
  const rivet = (x, y) => {
    hc.fillStyle = 'rgb(170,170,170)'; hc.fillRect(x - 1, y - 1, 2, 2);
    cc.fillStyle = 'rgba(96,98,104,0.75)'; cc.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
  };
  for (const s of FRAMES) {
    for (const off of [-0.018, 0.018]) {
      const p = perimeter(s + off);
      for (let a = 0; a < p; a += 0.025) rivet(px(s + off), py(a));
    }
  }
  for (let phi = 0; phi < 360; phi += 20) {
    const isSeam = LONGERONS.includes(phi);
    for (let s = 0.95; s < 14.9; s += isSeam ? 0.025 : 0.04) rivet(px(s), py(uvAt(s, phi)));
  }

  // Bare-metal panels (ORM: metalness 1, roughness ≈0.3).
  const bare = (s0, s1, phi0, phi1, tone = '#9d9a93') => {
    for (let s = s0; s < s1; s += 0.01) {
      const y0 = py(uvAt(s, phi0)), y1 = py(uvAt(s, phi1)), x = px(s), w = Math.ceil(px(s + 0.01) - x) + 1;
      cc.fillStyle = tone; cc.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0));
      oc.fillStyle = 'rgb(255,78,255)'; oc.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0));
    }
  };
  // The reaction-rocket panels on each side of the nose and above and below it.
  for (const phi of [90, 270]) bare(0.92, 1.30, phi - 22, phi + 22);
  for (const phi of [0, 180]) bare(0.92, 1.30, phi - 14, phi + 14);
  // Camera bay under the forward fuselage: a bare panel with two round windows (NASM).
  bare(1.55, 2.75, 160, 200);
  for (const [s, r] of [[2.0, 0.07], [2.4, 0.11]]) {
    const x = px(s), y = py(uvAt(s, 180));
    cc.fillStyle = '#2a2d31'; cc.beginPath(); cc.arc(x, y, r / SKIN_LEN * W, 0, Math.PI * 2); cc.fill();
    cc.strokeStyle = '#c9c6bf'; cc.lineWidth = 3; cc.stroke();
  }

  // Stencils. Each: station of its start, angle, height of the capitals (m), lines, colours.
  for (const d of decals) {
    // The atlas is mirrored against the skin (u aft, v round towards +Z), so each side gets the
    // mirror that makes its text read: on the left, nose → tail; on the right, tail → nose.
    // Either way d.s is the stencil's forward edge and d.phi its top.
    const left = d.phi < 180;
    const a = uvAt(d.s, d.phi);
    const x = px(d.s), y = py(a), h = d.size / SKIN_LEN * W;
    // Level: the baseline keeps its height above the FRL, which runs across the atlas wherever
    // the section grows or the fairings come in, so each stencil is turned to follow it.
    const run = 0.25, slope = Math.atan2(py(uvAt(d.s + run, level(d.s, d.phi, d.s + run))) - y, px(d.s + run) - x);
    cc.save();
    cc.translate(x, y);
    cc.rotate(slope);
    if (left) cc.scale(1, -1); else cc.scale(-1, 1);
    cc.font = `${d.weight ?? 700} ${h}px "Arial Narrow", Arial, sans-serif`;
    cc.textBaseline = 'top';
    const lines = d.lines;
    const wmax = Math.max(...lines.map(t => cc.measureText(t).width));
    const lh = h * 1.25;
    const bx = left ? 0 : -wmax, by = 0;
    if (d.box) {
      cc.fillStyle = d.box; cc.fillRect(bx - h * 0.3, by - h * 0.25, wmax + h * 0.6, lines.length * lh + h * 0.3);
      if (d.frame) { cc.strokeStyle = d.frame; cc.lineWidth = h * 0.18; cc.strokeRect(bx - h * 0.3, by - h * 0.25, wmax + h * 0.6, lines.length * lh + h * 0.3); }
    }
    if (d.triangle) {
      // The ejection-seat warning: a red triangle, point down, its lines centred in it (NASM).
      const T = wmax * 1.9;
      cc.fillStyle = d.triangle;
      cc.beginPath(); cc.moveTo(bx + wmax / 2 - T / 2, by - h * 0.4); cc.lineTo(bx + wmax / 2 + T / 2, by - h * 0.4); cc.lineTo(bx + wmax / 2, by - h * 0.4 + T * 0.866); cc.closePath(); cc.fill();
      cc.textAlign = 'center';
    }
    if (d.arrow) {
      // The rescue arrow: a yellow dart pointing forward, notched at its aft end (EC67-1652).
      cc.fillStyle = d.arrow;
      const L = d.arrowLength / SKIN_LEN * W, T = d.arrowHeight / SKIN_LEN * W, f = left ? 1 : -1;
      const dart = [[0, 0.6], [0.8, 0], [1, 0.04], [0.9, 0.55], [1, 1], [0.72, 1]];
      cc.beginPath();
      dart.forEach(([u, v], i) => cc[i ? 'lineTo' : 'moveTo'](f * u * L, v * T));
      cc.closePath(); cc.fill();
    }
    cc.fillStyle = d.color;
    lines.forEach((t, i) => cc.fillText(t, d.triangle ? bx + wmax / 2 : bx, by + i * lh + (d.arrow ? d.arrowHeight / SKIN_LEN * W * 0.3 : 0)));
    cc.restore();
  }

  // Grain: fine mottling of the paint, laid over as two noise tiles (light and dark) at two
  // scales instead of read back and rewritten texel by texel: the atlas is 6.7 million texels,
  // and reading a canvas that size back costs seconds on a software renderer.
  // White noise, so the tiles repeat without a seam; the coarse one is drawn enlarged and
  // smoothed into blotches. Seeded, so every load paints the same skin.
  let seed = 0x2f6b;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (const [scale, amp] of [[1, 6], [9, 8]]) {
    const n = 256, light = canvas(n, n), dark = canvas(n, n);
    const li = light.getContext('2d').createImageData(n, n), di = dark.getContext('2d').createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = (rnd() - 0.5) * 2, i = (y * n + x) * 4;
        const t = v > 0 ? li : di;
        t.data[i] = t.data[i + 1] = t.data[i + 2] = v > 0 ? 255 : 0;
        t.data[i + 3] = Math.round(Math.abs(v) * amp);
      }
    }
    light.getContext('2d').putImageData(li, 0, 0); dark.getContext('2d').putImageData(di, 0, 0);
    for (const tile of [light, dark]) {
      const pat = cc.createPattern(tile, 'repeat');
      pat.setTransform(new DOMMatrix().scale(scale * 1.5));
      cc.fillStyle = pat; cc.fillRect(0, 0, W, H);
    }
  }

  const opts = { tileSize: SKIN_ARC, tileSizeU: SKIN_LEN, wrap: THREE.ClampToEdgeWrapping };
  const map = toTexture(col, { srgb: true, ...opts });
  const normalMap = toTexture(heightToNormal(hgt, 1.6), opts);
  const ormMap = toTexture(orm, opts);
  // UVs run from the atlas's start: offset so u = station − SKIN_S0 lands at 0.
  // The canvas's rows run with v (no flip), so the angles above land where uvAt puts them.
  for (const t of [map, normalMap, ormMap]) { t.offset.set(-SKIN_S0 / SKIN_LEN, 0); t.flipY = false; }
  return { map, normalMap, ormMap };
}

/**
 * The flying surfaces' tile: rivet rows along the spars and ribs on a 1.2 m tile. The wings' and
 * tails' sweeps run their UVs in metres, chordwise and spanwise.
 */
export function makeX15SurfaceTile({ size = 1024, tile = 1.2 } = {}) {
  const col = canvas(size, size), hgt = canvas(size, size), orm = canvas(size, size);
  const cc = col.getContext('2d'), hc = hgt.getContext('2d'), oc = orm.getContext('2d');
  cc.fillStyle = '#151619'; cc.fillRect(0, 0, size, size);
  hc.fillStyle = 'rgb(128,128,128)'; hc.fillRect(0, 0, size, size);
  oc.fillStyle = 'rgb(255,96,0)'; oc.fillRect(0, 0, size, size);
  const m = size / tile;
  // Sheets: four per tile, each its own sheen.
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const n = noise2(i * 2.7 + 0.3, j * 4.1 + 0.9) - 0.5;
    const t = Math.round(21 + n * 7);
    cc.fillStyle = `rgb(${t},${t + 1},${t + 4})`; cc.fillRect(i * size / 2, j * size / 2, size / 2, size / 2);
    oc.fillStyle = `rgb(255,${Math.round(96 + n * 30)},0)`; oc.fillRect(i * size / 2, j * size / 2, size / 2, size / 2);
  }
  hc.fillStyle = 'rgb(104,104,104)';
  for (const p of [0, size / 2]) { hc.fillRect(p - 1, 0, 2, size); hc.fillRect(0, p - 1, size, 2); }
  for (let r = 0; r < 4; r++) {
    const c = (r + 0.5) * size / 4;
    for (let k = 0; k < size; k += 0.03 * m) {
      for (const [x, y] of [[c, k], [k, c]]) {
        hc.fillStyle = 'rgb(168,168,168)'; hc.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
        cc.fillStyle = 'rgba(92,94,100,0.7)'; cc.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
    }
  }
  const map = toTexture(col, { srgb: true, tileSize: tile });
  const normalMap = toTexture(heightToNormal(hgt, 1.4), { tileSize: tile });
  const ormMap = toTexture(orm, { tileSize: tile });
  return { map, normalMap, ormMap };
}

/** A transparent decal: white text on nothing, for the fin. */
export function makeX15Decal(text, { w = 1024, h = 256, color = '#f2f2ee', fill = false } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(h * 0.86)}px "Arial Narrow", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // fill: stretch the figures to the card's width (stencilled figures are wider than type).
  const k = fill ? w * 0.98 / ctx.measureText(text).width : 1;
  ctx.translate(w / 2, 0); ctx.scale(k, 1);
  if (fill) ctx.fillText(text, 0, h / 2 + h * 0.04); else ctx.fillText(text, 0, h / 2 + h * 0.04, w * 0.98);
  const t = toTexture(c, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  return t;
}
