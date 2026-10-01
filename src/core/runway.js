/**
 * The X-15's runway on the saline flat (terrain.js RUNWAY has where and why): the bare clay of
 * the flat, smoothed and lighter where the strip is graded, and black lines laid on it as on the
 * lakebed runways of Rogers Dry Lake — edge lines, threshold bars and the runway's numbers.
 * Line widths, bar sizes and the numbers' height are not taken from any drawing (≈).
 */
import * as THREE from 'three';
import { canvas, toTexture, noise2 } from '../materials/textures.js';
import { RUNWAY, fromRunway } from './terrain.js';

/** Dry clay with a polygonal net of desiccation cracks, on a 24 m tile. */
function clayTexture() {
  const N = 512, TILE = 24;
  const c = canvas(N, N), g = c.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  // Cracks: the edges of a jittered Voronoi net, polygons of ≈0.6 m and ≈0.2 m.
  const cells = (n, seed) => {
    const pts = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const jx = noise2(i * 1.7 + seed, j * 2.3), jy = noise2(i * 2.9, j * 1.3 + seed);
      pts.push([(i + 0.15 + 0.7 * jx) / n, (j + 0.15 + 0.7 * jy) / n]);
    }
    return { n, pts };
  };
  const coarse = cells(40, 3.1), fine = cells(110, 7.7);
  // Distance between the two nearest seeds (periodic, so the tile repeats without a seam).
  const edge = ({ n, pts }, u, v) => {
    const ci = Math.floor(u * n), cj = Math.floor(v * n);
    let d1 = 9, d2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, i = ((ii % n) + n) % n, j = ((jj % n) + n) % n;
      const px = pts[j * n + i][0] + Math.floor(ii / n), py = pts[j * n + i][1] + Math.floor(jj / n);
      const dd = Math.hypot(u - px, v - py);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
    }
    return (d2 - d1) * n;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const e1 = edge(coarse, u, v), e2 = edge(fine, u, v);
      const crack = Math.max(1 - Math.min(1, e1 / 0.05), 0.55 * (1 - Math.min(1, e2 / 0.06)));
      const tone = 0.92 + 0.1 * (noise2(u * 18, v * 18) - 0.5) + 0.05 * (noise2(u * 90, v * 90) - 0.5);
      const i = (y * N + x) * 4;
      d[i] = 214 * tone * (1 - 0.35 * crack);
      d[i + 1] = 192 * tone * (1 - 0.37 * crack);
      d[i + 2] = 156 * tone * (1 - 0.4 * crack);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { srgb: true, tileSize: TILE });
}

/** Block numerals, as painted bars: segments of a 3 × 5 grid. */
const DIGITS = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'], 1: ['b', 'c'], 2: ['a', 'b', 'g', 'e', 'd'], 3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'], 5: ['a', 'f', 'g', 'c', 'd'], 6: ['a', 'f', 'g', 'e', 'c', 'd'], 7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 9: ['a', 'b', 'c', 'd', 'f', 'g'],
};

/**
 * @returns a group: the graded clay and the black markings, both a few centimetres over the
 * flat (which terrain.js holds at zero height over the strip and its margin).
 */
export function buildRunway() {
  const group = new THREE.Group();
  group.name = 'x15-runway';
  const L = RUNWAY.length, W = RUNWAY.width;
  // One material for the clay and the lines (the scene's budget is 200): the lines are the
  // same cracked clay darkened by their vertex colour, as tar laid on it would be.
  let clayMat = null;

  // Graded clay: the strip and a 40 m margin, fading out at the margin's edge (vertex alpha).
  {
    const A = L / 2 + 40, C = W / 2 + 40, na = 68, nc = 10;
    const pos = [], uv = [], col = [], idx = [];
    for (let j = 0; j <= nc; j++) {
      for (let i = 0; i <= na; i++) {
        const a = -A + 2 * A * i / na, c = -C + 2 * C * j / nc;
        const [x, z] = fromRunway(a, c);
        pos.push(x, 0.03, z);
        uv.push(x, z);
        const fa = THREE.MathUtils.smoothstep(A - Math.abs(a), 0, 40), fc = THREE.MathUtils.smoothstep(C - Math.abs(c), 0, 40);
        col.push(1, 1, 1, fa * fc);
      }
    }
    for (let j = 0; j < nc; j++) for (let i = 0; i < na; i++) {
      const p = j * (na + 1) + i, q = p + na + 1;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    clayMat = new THREE.MeshStandardMaterial({
      name: 'runway-clay', map: clayTexture(), vertexColors: true, transparent: true, depthWrite: false,
      roughness: 0.93, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(g, clayMat);
    m.name = 'runway-clay';
    m.receiveShadow = true;
    m.renderOrder = 1;
    group.add(m);
  }

  // Markings: rectangles in runway coordinates, merged into one mesh.
  {
    const rects = [];
    const rect = (a0, a1, c0, c1) => rects.push([a0, a1, c0, c1]);
    const EDGE = 2.4;
    rect(-L / 2, L / 2, W / 2 - EDGE, W / 2);
    rect(-L / 2, L / 2, -W / 2, -W / 2 + EDGE);
    // Threshold bars across each end, and a numeral pair beyond them, read on the approach.
    const bars = 10, bw = 4, gap = (W - 2 * EDGE - bars * bw) / (bars + 1);
    for (const end of [-1, 1]) {
      for (let k = 0; k < bars; k++) {
        const c0 = -W / 2 + EDGE + gap + k * (bw + gap);
        const a0 = end * (L / 2 - 6), a1 = end * (L / 2 - 6 - 45);
        rect(Math.min(a0, a1), Math.max(a0, a1), c0, c0 + bw);
      }
    }
    // Numerals 30 m long, 18 m wide, bars 4 m: "13" at the north-west end (landing towards
    // 130.8°), "31" at the south-east end, each upright for an airplane landing over it.
    const H = 30, Wd = 18, T = 4;
    const seg = { a: [0, 1, 1, 1], b: [1, 1, 0.5, 1], c: [1, 1, 0, 0.5], d: [0, 1, 0, 0], e: [0, 0, 0, 0.5], f: [0, 0, 0.5, 1], g: [0, 1, 0.5, 0.5] };
    const numeral = (text, endSign) => {
      // Reading direction: an airplane landing from this end flies towards −endSign along.
      const dir = -endSign, base = endSign * (L / 2 - 70);
      const width = text.length * Wd + (text.length - 1) * 8;
      [...text].forEach((ch, n) => {
        const left = -width / 2 + n * (Wd + 8);
        for (const s of DIGITS[ch]) {
          const [x0, x1, y0, y1] = seg[s];
          // Glyph x across the runway (to the pilot's right), y along (up = away from the pilot).
          const gx0 = left + x0 * (Wd - T), gx1 = left + x1 * (Wd - T) + T;
          const gy0 = y0 * (H - T), gy1 = y1 * (H - T) + T;
          const a0 = base + dir * gy0, a1 = base + dir * gy1;
          // +across is the pilot's right flying towards +along (bearing 130.8° + 90°).
          const c0 = dir * gx0, c1 = dir * gx1;
          rect(Math.min(a0, a1), Math.max(a0, a1), Math.min(c0, c1), Math.max(c0, c1));
        }
      });
    };
    numeral('13', -1);
    numeral('31', 1);
    const pos = [], uv = [], col = [], idx = [];
    for (const [a0, a1, c0, c1] of rects) {
      const n = pos.length / 3;
      for (const [a, c] of [[a0, c0], [a1, c0], [a1, c1], [a0, c1]]) { const [x, z] = fromRunway(a, c); pos.push(x, 0.06, z); uv.push(x, z); col.push(0.09, 0.09, 0.09, 1); }
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Faces up whichever way the corners went round.
    const nrm = g.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const m = new THREE.Mesh(g, clayMat);
    m.name = 'runway-markings';
    m.receiveShadow = true;
    m.renderOrder = 2;   // over the clay, which writes no depth
    group.add(m);
  }
  group.userData.runway = RUNWAY;
  return group;
}
