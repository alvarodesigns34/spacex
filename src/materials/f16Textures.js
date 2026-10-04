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
 * values approximate the Federal Standard chips (≈). Seam positions are plausible for the
 * airframe's frames and access panels, read off general photographs, not a drawing (≈). No
 * insignia, no unit or national markings: the centre's rule on flags and logos.
 */
import { canvas, toTexture, heightToNormal, noise2 } from './textures.js';

export const SKIN_LEN = 15.2;
export const FS_COLOURS = { fs36118: [80, 86, 91], fs36270: [132, 137, 140], fs36375: [168, 173, 176], radome: [98, 102, 106] };

/** Circumferential seams (stations, m) and longitudinal ones (fractions of the way round). */
const FRAMES = [2.1, 2.55, 3.05, 3.6, 4.6, 5.3, 6.1, 6.9, 7.6, 8.4, 9.2, 10.0, 10.75, 11.5, 12.3, 13.0, 13.7];
const LONG = [0.08, 0.17, 0.26, 0.35, 0.44, 0.56, 0.65, 0.74, 0.83, 0.92];

export function makeF16Skin({ size = 2048 } = {}) {
  const W = size, H = size / 2;
  const px = (s) => (s / SKIN_LEN) * W, py = (f) => f * H;
  const col = canvas(W, H), hgt = canvas(W, H), orm = canvas(W, H);
  const cc = col.getContext('2d'), hc = hgt.getContext('2d'), oc = orm.getContext('2d');
  // Paint, row by row: medium grey on top, light grey on the sides and below, the line between
  // them soft and wandering, as sprayed.
  const img = cc.createImageData(W, H), d = img.data;
  const [a0, b, r, g] = [FS_COLOURS.fs36270, FS_COLOURS.fs36375, FS_COLOURS.radome, FS_COLOURS.fs36118];
  const a = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const f = y / H, up = 1 - Math.min(1, Math.abs(f - 0.5) / 0.5);   // 1 at the top centre
    for (let x = 0; x < W; x++) {
      const s = (x / W) * SKIN_LEN;
      const wob = 0.035 * (noise2(s * 0.9, f * 7) - 0.5) + 0.02 * (noise2(s * 3.1, f * 19) - 0.5);
      const k = Math.min(1, Math.max(0, (up - 0.62 + wob) / 0.05));    // 1 on the upper surfaces
      // The upper colour: medium grey forward, gunship grey from the canopy's back (≈ 6.0 m) aft.
      const aft = Math.min(1, Math.max(0, (s - 6.0 + 0.15 * wob / 0.035) / 0.12));
      for (let c = 0; c < 3; c++) a[c] = a0[c] + (g[c] - a0[c]) * aft;
      const tone = 1 + 0.03 * (noise2(s * 1.7 + f * 4, f * 23) - 0.5);
      let c0 = b[0] + (a[0] - b[0]) * k, c1 = b[1] + (a[1] - b[1]) * k, c2 = b[2] + (a[2] - b[2]) * k;
      const rad = Math.min(1, Math.max(0, (2.1 - s) / 0.02));        // the radome
      c0 += (r[0] - c0) * rad; c1 += (r[1] - c1) * rad; c2 += (r[2] - c2) * rad;
      const i = (y * W + x) * 4;
      d[i] = c0 * tone; d[i + 1] = c1 * tone; d[i + 2] = c2 * tone; d[i + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0);
  hc.fillStyle = 'rgb(128,128,128)'; hc.fillRect(0, 0, W, H);
  // Roughness: matte paint (G ≈ 0.62), the radome a little smoother.
  oc.fillStyle = 'rgb(255,158,0)'; oc.fillRect(0, 0, W, H);
  oc.fillStyle = 'rgb(255,128,0)'; oc.fillRect(0, 0, px(2.1), H);

  // Seams: shallow grooves, a little darker.
  hc.fillStyle = 'rgb(96,96,96)'; cc.fillStyle = 'rgba(70,74,78,0.45)';
  for (const s of FRAMES) { const x = px(s); hc.fillRect(x - 1, 0, 2, H); cc.fillRect(x - 0.5, 0, 1.2, H); }
  for (const f of LONG) {
    const y = py(f);
    hc.fillRect(px(2.1), y - 1, W, 2); cc.fillRect(px(2.1), y - 0.5, W, 1.2);
  }
  // Access panels: small rectangles between the seams, their outlines grooved.
  hc.strokeStyle = 'rgb(100,100,100)'; cc.strokeStyle = 'rgba(70,74,78,0.4)'; hc.lineWidth = 2; cc.lineWidth = 1;
  for (let i = 0; i < 46; i++) {
    const s = 2.4 + 11 * noise2(i * 3.7, 1.3), f = 0.04 + 0.92 * noise2(i * 1.9, 7.7);
    const w = px(0.25 + 0.4 * noise2(i, 3)), h = py(0.025 + 0.04 * noise2(i, 9));
    hc.strokeRect(px(s), py(f), w, h); cc.strokeRect(px(s), py(f), w, h);
  }
  // Fastener rows along the frames.
  cc.fillStyle = 'rgba(80,84,88,0.5)';
  for (const s of FRAMES) for (let y = 0; y < H; y += 7) cc.fillRect(px(s) + 4, y, 1.5, 1.5);
  // The M61's gun port and its gas vents, on the left side over the strake's root (≈ 4.7 m).
  cc.fillStyle = 'rgb(28,30,32)';
  cc.beginPath(); cc.ellipse(px(4.75), py(0.66), px(0.12), py(0.012), 0, 0, Math.PI * 2); cc.fill();
  for (let k = 0; k < 4; k++) cc.fillRect(px(5.0 + k * 0.09), py(0.655), px(0.05), py(0.012));

  // Weathering (≈, as on airframes in service): the panels' edges grimed a little, streaked aft
  // by the airflow from the seams and fastener rows; the hydraulic and fuel stains under the
  // fuselage behind the gear wells; the aft fuselage smoked by the engine bay's heat ahead of the
  // nozzle. Kept faint: a working jet, not a wreck.
  cc.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 260; i++) {
    const s = FRAMES[i % FRAMES.length] + 0.02, f = noise2(i * 2.31, 4.7);
    const len = px(0.15 + 0.6 * noise2(i * 0.77, 2.2)), y = py(f), a = 0.05 + 0.08 * noise2(i * 1.3, 9.1);
    const gr = cc.createLinearGradient(px(s), 0, px(s) + len, 0);
    gr.addColorStop(0, `rgba(96,98,100,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cc.fillStyle = gr; cc.fillRect(px(s), y, len, Math.max(1, py(0.002 + 0.004 * noise2(i, 5.5))));
  }
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

/** A 2 m tile for the flying surfaces: panels, fastener rows and a faint shade per sheet. */
export function makeF16SurfaceTile({ size = 512, tile = 2.0, tone = FS_COLOURS.fs36270 } = {}) {
  const c = canvas(size, size), h = canvas(size, size), o = canvas(size, size);
  const cc = c.getContext('2d'), hc = h.getContext('2d'), oc = o.getContext('2d');
  const step = size / 4;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const n = noise2(i * 2.3 + 0.5, j * 3.1 + 0.2) - 0.5;
    cc.fillStyle = `rgb(${tone[0] * (1 + n * 0.05)},${tone[1] * (1 + n * 0.05)},${tone[2] * (1 + n * 0.05)})`;
    cc.fillRect(i * step, j * step, step, step);
  }
  hc.fillStyle = 'rgb(128,128,128)'; hc.fillRect(0, 0, size, size);
  oc.fillStyle = 'rgb(255,158,0)'; oc.fillRect(0, 0, size, size);
  hc.fillStyle = 'rgb(100,100,100)'; cc.fillStyle = 'rgba(70,74,78,0.35)';
  for (let k = 0; k <= 4; k++) {
    const p = k * step;
    hc.fillRect(p - 1, 0, 2, size); hc.fillRect(0, p - 1, size, 2);
    cc.fillRect(p - 0.5, 0, 1, size); cc.fillRect(0, p - 0.5, size, 1);
  }
  cc.fillStyle = 'rgba(80,84,88,0.45)';
  for (let k = 0; k <= 4; k++) for (let y = 0; y < size; y += 6) { cc.fillRect(k * step + 4, y, 1.5, 1.5); cc.fillRect(y, k * step + 4, 1.5, 1.5); }
  const normal = heightToNormal(h, 2.0);
  return {
    map: toTexture(c, { srgb: true, tileSize: tile }),
    normalMap: toTexture(normal, { tileSize: tile }),
    roughnessMap: toTexture(o, { tileSize: tile }),
  };
}
