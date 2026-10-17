/**
 * The F-16A's finish, painted procedurally like every map in the centre (textures.js).
 *
 *  - The fuselage gets an atlas of its own: U = station s / SKIN_LEN, V = the fraction of the
 *    way round the section from the bottom centre line (0) through the right side (≈0.25), the
 *    top (0.5) and the left side (≈0.75). Seams, the radome, the gun port and the paint's
 *    demarcation are put where they are on the airplane.
 *  - The flying surfaces share a tile of panels and fastener rows in metres.
 *
 * The paint is the F-16A's 'Hill Gray' three-tone scheme (USAF, late 1970s to the early 1990s):
 * FS 36118 gunship grey on the upper surfaces from the canopy back, FS 36270 medium grey on the
 * upper forward fuselage and the intake's top, FS 36375 light ghost grey below, up round the nose
 * at the cockpit, and on the fin and the tailplanes (modellers' references, not a T.O. drawing:
 * the demarcations are ≈); the radome a darker grey of its own (its coating varies, ≈). sRGB
 * values approximate the Federal Standard chips (≈). The paint lines are masked ones: they run
 * along panel seams, sharp, with about a centimetre of overspray. Before 17 October 2026 they
 * wandered by several centimetres and were feathered over about ten, and the upper band read
 * as a stain rather than as paint. Seam positions are plausible for the airframe's frames and access panels, read
 * off general photographs, not a drawing (≈); the panels stagger from row to row instead of
 * forming one grid. No insignia, no unit or national markings: the centre's rule on flags and
 * logos.
 */
import { canvas, toTexture, heightToNormal, noise2 } from './textures.js';

export const SKIN_LEN = 15.2;
export const FS_COLOURS = { fs36118: [80, 86, 91], fs36270: [132, 137, 140], fs36375: [168, 173, 176], radome: [98, 102, 106] };

/**
 * The fuselage's panel layout (≈, read off general photographs, not a drawing): rows of panels
 * between longitudinal seams (fractions of the way round the section), each row broken at its
 * own stations so the joints stagger like bricks instead of making one grid over the whole
 * airframe. The paint's demarcation runs along the seams at 0.35 and 0.65, the way a masked
 * line does: on a panel joint, sharp, with only a hair of overspray.
 */
const ROWS = [
  // f0, f1, the stations (m) at which the row's panels break, and what the row is.
  { f0: 0.00, f1: 0.08, frames: [2.55, 4.6, 6.9, 8.4, 10.0, 11.5, 13.0], kind: 'keel' },
  { f0: 0.08, f1: 0.26, frames: [2.1, 3.05, 4.6, 6.1, 7.6, 9.2, 10.75, 12.3, 13.7], kind: 'lower' },
  { f0: 0.26, f1: 0.35, frames: [2.1, 3.6, 5.3, 6.9, 8.4, 10.0, 11.5, 13.0], kind: 'side' },
  { f0: 0.35, f1: 0.46, frames: [2.1, 3.05, 4.6, 6.1, 7.6, 9.2, 10.75, 12.3, 13.7], kind: 'top' },
  { f0: 0.46, f1: 0.54, frames: [3.6, 6.1, 6.9, 8.4, 10.0, 11.5, 13.0], kind: 'spine' },
  { f0: 0.54, f1: 0.65, frames: [2.1, 3.05, 4.6, 6.1, 7.6, 9.2, 10.75, 12.3, 13.7], kind: 'top' },
  { f0: 0.65, f1: 0.74, frames: [2.1, 3.6, 5.3, 6.9, 8.4, 10.0, 11.5, 13.0], kind: 'side' },
  { f0: 0.74, f1: 0.92, frames: [2.1, 3.05, 4.6, 6.1, 7.6, 9.2, 10.75, 12.3, 13.7], kind: 'lower' },
  { f0: 0.92, f1: 1.00, frames: [2.55, 4.6, 6.9, 8.4, 10.0, 11.5, 13.0], kind: 'keel' },
];
const NOSE = 2.1;          // the radome's base (m)
const UPPER = [0.35, 0.65]; // the paint line's seams
const STEP = 6.1;          // where the gunship grey starts on the upper surfaces: the frame behind the canopy

/** A rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export function makeF16Skin({ size = 2048 } = {}) {
  const W = size, H = size / 2;
  const px = (s) => (s / SKIN_LEN) * W, py = (f) => f * H;
  const col = canvas(W, H), hgt = canvas(W, H), orm = canvas(W, H);
  const cc = col.getContext('2d'), hc = hgt.getContext('2d'), oc = orm.getContext('2d');
  // Paint, pixel by pixel: the light grey everywhere, the medium grey on the upper forward
  // fuselage, the gunship grey from the frame behind the canopy aft. Both lines are masked ones:
  // a hair of overspray (≈1 cm) and a millimetre of waver, not the broad soft smudge a spray
  // gun leaves with no tape. The paint lines sit on panel seams (ROWS above).
  const img = cc.createImageData(W, H), d = img.data;
  const [a0, b, r, g] = [FS_COLOURS.fs36270, FS_COLOURS.fs36375, FS_COLOURS.radome, FS_COLOURS.fs36118];
  const edge = (x, soft) => Math.min(1, Math.max(0, x / soft + 0.5));
  const softF = 0.003;      // the feathering across the paint line, in V (≈ 1 cm on a ≈ 3 m section)
  for (let y = 0; y < H; y++) {
    const f = y / H;
    for (let x = 0; x < W; x++) {
      const s = (x / W) * SKIN_LEN;
      const wob = 0.0006 * (noise2(s * 2.3, f * 41) - 0.5);
      const k = edge(f - UPPER[0] + wob, softF) * edge(UPPER[1] - f + wob, softF);   // 1 on the upper surfaces
      const aft = edge(s - STEP + wob * 6, 0.012);
      let c0 = a0[0] + (g[0] - a0[0]) * aft, c1 = a0[1] + (g[1] - a0[1]) * aft, c2 = a0[2] + (g[2] - a0[2]) * aft;
      c0 = b[0] + (c0 - b[0]) * k; c1 = b[1] + (c1 - b[1]) * k; c2 = b[2] + (c2 - b[2]) * k;
      const rad = edge(NOSE - s, 0.012);                              // the radome
      c0 += (r[0] - c0) * rad; c1 += (r[1] - c1) * rad; c2 += (r[2] - c2) * rad;
      // A faint mottle of the paint's film, not of its colour: well under 2 %.
      const tone = 1 + 0.014 * (noise2(s * 3.1 + f * 4, f * 31) - 0.5);
      const i = (y * W + x) * 4;
      d[i] = c0 * tone; d[i + 1] = c1 * tone; d[i + 2] = c2 * tone; d[i + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0);
  hc.fillStyle = 'rgb(128,128,128)'; hc.fillRect(0, 0, W, H);
  // Roughness: matte paint (G ≈ 0.62), the radome a little smoother.
  oc.fillStyle = 'rgb(255,158,0)'; oc.fillRect(0, 0, W, H);
  oc.fillStyle = 'rgb(255,128,0)'; oc.fillRect(0, 0, px(NOSE), H);

  // Panels. Each row's panels are drawn on their own: a groove (height), a thin dark line
  // (colour), fasteners round the edge and, on the doors that open, quarter-turn latches. A
  // panel repainted at some depot is a hair lighter or darker than its neighbour.
  const panels = [];
  ROWS.forEach((row, ri) => {
    const fr = [NOSE, ...row.frames.filter(s => s > NOSE + 0.01), SKIN_LEN - 1.5];
    for (let i = 0; i + 1 < fr.length; i++) panels.push({ s0: fr[i], s1: fr[i + 1], f0: row.f0, f1: row.f1, kind: row.kind, id: ri * 31 + i });
  });
  for (const p of panels) {
    const x0 = px(p.s0), x1 = px(p.s1), y0 = py(p.f0), y1 = py(p.f1);
    const n = noise2(p.id * 1.37, 2.9) - 0.5;
    cc.fillStyle = n > 0 ? `rgba(255,255,255,${0.035 * n * 2})` : `rgba(0,0,0,${0.035 * -n * 2})`;
    cc.fillRect(x0, y0, x1 - x0, y1 - y0);
    hc.strokeStyle = 'rgb(98,98,98)'; hc.lineWidth = 2.2; hc.strokeRect(x0, y0, x1 - x0, y1 - y0);
    cc.strokeStyle = 'rgba(58,62,66,0.5)'; cc.lineWidth = 1.1; cc.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // Fasteners, inset from the edge, every ≈ 4.5 cm; the doors' have a slightly bigger head.
    const door = (p.kind === 'spine' || p.kind === 'keel') && p.s1 - p.s0 < 2.0;
    const step = door ? 5.5 : 7;
    cc.fillStyle = 'rgba(66,70,74,0.55)'; hc.fillStyle = 'rgb(140,140,140)';
    for (let x = x0 + 5; x < x1 - 4; x += step) { cc.fillRect(x, y0 + 4, 1.5, 1.5); cc.fillRect(x, y1 - 5.5, 1.5, 1.5); }
    for (let y = y0 + 5; y < y1 - 4; y += step) { cc.fillRect(x0 + 4, y, 1.5, 1.5); cc.fillRect(x1 - 5.5, y, 1.5, 1.5); }
  }
  // Access doors inside some panels: a rounded outline with its latches.
  const DOORS = [
    [2.7, 3.5, 0.28, 0.33], [3.7, 4.5, 0.27, 0.33], [3.1, 4.2, 0.69, 0.72],   // avionics bays, either side
    [7.0, 8.3, 0.47, 0.53], [8.55, 9.9, 0.47, 0.53], [10.1, 11.4, 0.47, 0.53],  // dorsal doors
    [6.2, 7.5, 0.1, 0.24], [9.3, 10.6, 0.1, 0.24], [6.2, 7.5, 0.76, 0.9], [9.3, 10.6, 0.76, 0.9],   // engine bay, lower sides
    [8.5, 9.9, 0.94, 0.99], [10.15, 11.4, 0.0, 0.05],                          // keel doors
  ];
  hc.lineWidth = 2; cc.lineWidth = 1;
  for (const [s0, s1, f0, f1] of DOORS) {
    const x = px(s0), y = py(f0), w = px(s1) - px(s0), h = py(f1) - py(f0);
    hc.strokeStyle = 'rgb(104,104,104)'; roundRect(hc, x, y, w, h, 6); hc.stroke();
    cc.strokeStyle = 'rgba(58,62,66,0.45)'; roundRect(cc, x, y, w, h, 6); cc.stroke();
    cc.fillStyle = 'rgba(40,44,48,0.6)';
    for (const [lx, ly] of [[x + 9, y + h / 2], [x + w - 9, y + h / 2], [x + w / 2, y + 8], [x + w / 2, y + h - 8]]) { cc.beginPath(); cc.ellipse(lx, ly, 2.2, 1.4, 0, 0, Math.PI * 2); cc.fill(); }
  }
  // The M61's gun port and its gas vents, on the left side over the strake's root (≈ 4.7 m).
  cc.fillStyle = 'rgb(28,30,32)';
  cc.beginPath(); cc.ellipse(px(4.75), py(0.69), px(0.12), py(0.011), 0, 0, Math.PI * 2); cc.fill();
  for (let k = 0; k < 4; k++) cc.fillRect(px(5.0 + k * 0.09), py(0.684), px(0.05), py(0.011));

  // Weathering (≈, as on airframes in service): the panels' edges grimed a little, streaked aft
  // by the airflow from the seams; the hydraulic and fuel stains under the fuselage behind the
  // gear wells; the aft fuselage smoked by the engine bay's heat ahead of the nozzle. Kept faint:
  // a working jet, not a wreck. The streaks start at a panel's forward edge and run aft.
  cc.globalCompositeOperation = 'multiply';
  panels.forEach((p, i) => {
    const len = px(0.12 + 0.5 * noise2(i * 0.77, 2.2)), a = 0.05 + 0.07 * noise2(i * 1.3, 9.1);
    const x = px(p.s0), y = py(p.f0 + (p.f1 - p.f0) * noise2(i * 2.1, 4.4));
    const gr = cc.createLinearGradient(x, 0, x + len, 0);
    gr.addColorStop(0, `rgba(96,98,100,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cc.fillStyle = gr; cc.fillRect(x, y, len, Math.max(1, py(0.0016 + 0.0035 * noise2(i, 5.5))));
  });
  for (let i = 0; i < 40; i++) {
    const s = 5.6 + 5.5 * noise2(i * 1.7, 3.3), f = 0.03 * (noise2(i * 3.1, 1.1) - 0.5) + (i % 2 ? 0.015 : 0.985);   // either side of the bottom centre line (V 0 ≡ 1)
    const len = px(0.4 + 1.2 * noise2(i * 0.9, 6.6)), y = py(Math.min(0.999, Math.max(0, f)));
    const gr = cc.createLinearGradient(px(s), 0, px(s) + len, 0);
    gr.addColorStop(0, 'rgba(120,112,98,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cc.fillStyle = gr; cc.fillRect(px(s), y - py(0.004), len, py(0.008));
  }
  {
    const gr = cc.createLinearGradient(px(12.6), 0, px(SKIN_LEN), 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(150,146,140,0.6)'); gr.addColorStop(1, 'rgba(110,104,98,0.85)');
    cc.fillStyle = gr; cc.fillRect(px(12.6), 0, px(SKIN_LEN - 12.6), H);
  }
  cc.globalCompositeOperation = 'source-over';

  const normal = heightToNormal(hgt, 2.2);
  return {
    map: toTexture(col, { srgb: true, wrap: 1001 }),
    normalMap: toTexture(normal, { wrap: 1001 }),
    roughnessMap: toTexture(orm, { wrap: 1001 }),
  };
}

/**
 * A 2 m tile for the flying surfaces. Its panels are not a grid: three bands of unequal width,
 * the joints of each band broken at their own places so they stagger, and every edge wraps, so
 * the tile repeats without a visible seam. Fastener rows run round each panel, a faint repaint
 * shade differs from one panel to the next (≈).
 */
export function makeF16SurfaceTile({ size = 512, tile = 2.0, tone = FS_COLOURS.fs36270 } = {}) {
  const c = canvas(size, size), h = canvas(size, size), o = canvas(size, size);
  const cc = c.getContext('2d'), hc = h.getContext('2d'), oc = o.getContext('2d');
  const k = size / tile;                      // pixels per metre
  cc.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`; cc.fillRect(0, 0, size, size);
  hc.fillStyle = 'rgb(128,128,128)'; hc.fillRect(0, 0, size, size);
  oc.fillStyle = 'rgb(255,158,0)'; oc.fillRect(0, 0, size, size);
  // Bands (their seams, m) and, per band, where its panels break.
  const bands = [
    { y0: 0.35, y1: 1.05, xs: [0.18, 0.92, 1.47] },
    { y0: 1.05, y1: 1.65, xs: [0.45, 1.1, 1.78] },
    { y0: 1.65, y1: 2.35, xs: [0.0, 0.72, 1.38] },
  ];
  /** Draws `fn(x, y)` at the tile's position and at its wrapped copies, so nothing is cut at an edge. */
  const wrapped = (x0, y0, x1, y1, fn) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (x1 + ox < 0 || x0 + ox > size || y1 + oy < 0 || y0 + oy > size) continue;
      fn(ox, oy);
    }
  };
  bands.forEach((band, bi) => {
    const xs = [...band.xs, band.xs[0] + tile];
    for (let i = 0; i < band.xs.length; i++) {
      const x0 = xs[i] * k, x1 = xs[i + 1] * k, y0 = band.y0 * k, y1 = band.y1 * k;
      const n = noise2(bi * 3.1 + i * 1.7, 5.3) - 0.5;
      wrapped(x0, y0, x1, y1, (ox, oy) => {
        cc.fillStyle = n > 0 ? `rgba(255,255,255,${0.05 * n * 2})` : `rgba(0,0,0,${0.05 * -n * 2})`;
        cc.fillRect(x0 + ox, y0 + oy, x1 - x0, y1 - y0);
        hc.strokeStyle = 'rgb(100,100,100)'; hc.lineWidth = 2; hc.strokeRect(x0 + ox, y0 + oy, x1 - x0, y1 - y0);
        cc.strokeStyle = 'rgba(66,70,74,0.4)'; cc.lineWidth = 1; cc.strokeRect(x0 + ox, y0 + oy, x1 - x0, y1 - y0);
        cc.fillStyle = 'rgba(74,78,82,0.5)';
        for (let x = x0 + 6; x < x1 - 4; x += 9) { cc.fillRect(x + ox, y0 + 4 + oy, 1.5, 1.5); cc.fillRect(x + ox, y1 - 5.5 + oy, 1.5, 1.5); }
        for (let y = y0 + 6; y < y1 - 4; y += 9) { cc.fillRect(x0 + 4 + ox, y + oy, 1.5, 1.5); cc.fillRect(x1 - 5.5 + ox, y + oy, 1.5, 1.5); }
      });
    }
  });
  const normal = heightToNormal(h, 2.0);
  return {
    map: toTexture(c, { srgb: true, tileSize: tile }),
    normalMap: toTexture(normal, { tileSize: tile }),
    roughnessMap: toTexture(o, { tileSize: tile }),
  };
}
