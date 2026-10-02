/**
 * The Porsche's circuit and skid pad (circuitPlan.js has the layout, where it lies and why):
 * the asphalt lap with its paved verges, red and white kerbs on the corners, gravel traps on
 * the outside of the heavy-braking corners, white edge lines, the start line and a staggered
 * grid, the skid pad and the lane joining it to the main straight. A circuit's surface, not a
 * venue: no barriers, buildings, stands, flags or signs.
 *
 * WHAT IS CITED AND WHAT IS NOT
 *
 * Nothing here is a survey or a published drawing. The 12 m width is the figure widely quoted
 * as the FIA's minimum for new circuits; the 3 m verges, the 1.5 m kerbs and their stripes,
 * the gravel traps' depth, the 0.1 m edge lines and the grid's 8 m pitch are the usual practice
 * of European circuits, drawn plausibly (≈).
 */
import * as THREE from 'three';
import { mesh } from '../geometry/utils.js';
import { CIRCUIT, SKIDPAD, START, CENTRE, LAP, toWorld, trackCoords, skidpadDistance, toLocal } from './circuitPlan.js';

const HALF = CIRCUIT.width / 2, SH = HALF + CIRCUIT.shoulder, KERB = CIRCUIT.kerbWidth;
const EDGE_Y = 0.06, LOW_Y = 0.005, BEVEL = 0.3, KERB_Y = 0.03, PAINT = 0.005;
const GRAVEL = 22;                     // ≈ depth of a gravel trap beyond the verge
const N = CENTRE.length;

/** The corners: each run of centre-line points on one arc, with its radius and hand. */
export const CORNERS = (() => {
  const out = [];
  let i = 0;
  // Start the scan on a straight point so no arc is split across the lap's seam.
  while (CENTRE[i].k !== 0) i++;
  const first = i;
  do {
    const k = CENTRE[i].k;
    if (k === 0) { i = (i + 1) % N; continue; }
    const i0 = i;
    while (CENTRE[(i + 1) % N].k === k && (i + 1) % N !== first) i = (i + 1) % N;
    const s0 = CENTRE[i0].s - 2, s1 = CENTRE[i].s;
    out.push({ s0, s1, R: 1 / Math.abs(k), side: Math.sign(k) });
    i = (i + 1) % N;
  } while (i !== first);
  return out.map((c, n) => ({ ...c, n: n + 1 }));
})();
/** Kerbs: the inside over the middle of the arc, the outside from past the apex to the exit. */
const KERBS = CORNERS.flatMap(c => {
  const L = c.s1 - c.s0;
  return [
    { side: c.side, s0: c.s0 + 0.15 * L, s1: c.s1 - 0.1 * L },
    { side: -c.side, s0: c.s0 + 0.55 * L, s1: c.s1 + Math.min(30, 0.4 * L) },
  ];
});
/** Gravel on the outside of the tight corners (R ≤ 40 m), from before the turn-in to the exit. */
const TRAPS = CORNERS.filter(c => c.R <= 40).map(c => ({ side: -c.side, s0: c.s0 - 25, s1: c.s1 + 25 }));

const wrapS = (s) => ((s % LAP) + LAP) % LAP;
const inSpan = (s, a, b) => { const x = wrapS(s - a), L = wrapS(b - a); return x <= L; };
const kerbAt = (s, side) => KERBS.some(k => k.side === side && inSpan(s, k.s0, k.s1));

/**
 * What the ground is at world (x, z): { kind, y } with kind 'track', 'verge', 'kerb', 'gravel',
 * 'pad' (the skid pad and its lane) or null off the circuit, and y the surface's height.
 */
export function circuitSurface(x, z) {
  const [u, v] = toLocal(x, z);
  if (skidpadDistance(u, v) <= 0) return { kind: 'pad', y: EDGE_Y };
  const t = trackCoords(u, v);
  if (!t) return null;
  const side = Math.sign(t.d) || 1;
  if (t.dist <= HALF) return { kind: 'track', y: EDGE_Y };
  if (t.dist <= HALF + KERB && kerbAt(t.s, side)) return { kind: 'kerb', y: EDGE_Y + KERB_Y };
  if (t.dist <= SH) return { kind: 'verge', y: EDGE_Y };
  if (t.dist <= SH + GRAVEL && TRAPS.some(g => g.side === side && inSpan(t.s, g.s0, g.s1))) return { kind: 'gravel', y: LOW_Y + 0.02 };
  return null;
}

/** A point at (s-station i, offset d) in the world, and the ribbon builder over the lap. */
const at = (i, d) => { const c = CENTRE[i]; return toWorld(c.u - Math.sin(c.h) * d, c.v + Math.cos(c.h) * d); };
function ribbon(rows, { closed = true, colour = () => [1, 1, 1] } = {}) {
  // rows: per station i an array of [d, y]; all rows the same length.
  // UVs in metres along the strip from its first row, so a strip across the lap's seam (s = 0)
  // does not jump by a lap; a closed strip repeats its first row at the end, one lap on.
  const pos = [], uv = [], col = [], idx = [];
  const n = rows[0].d.length;
  const all = closed ? [...rows, rows[0]] : rows;
  const s0 = CENTRE[rows[0].i].s;
  all.forEach((r, k) => {
    const along = k === all.length - 1 && closed ? LAP : wrapS(CENTRE[r.i].s - s0);
    r.d.forEach((d, j) => {
      const [x, z] = at(r.i, d);
      pos.push(x, r.y[j], z); uv.push(along, d); col.push(...colour(r, j));
    });
  });
  const m = all.length;
  for (let a = 0; a < m - 1; a++) {
    const b = a + 1;
    for (let j = 0; j < n - 1; j++) {
      const p = a * n + j, q = b * n + j;
      // +d is to the right of travel; seen from above that winds the quad counter-clockwise.
      idx.push(p, p + 1, q, q, p + 1, q + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Faces up, whichever way the frame winds.
  if (g.attributes.normal.getY(0) < 0) {
    const ix = g.index.array;
    for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}
/** Stations i covering s0 → s1 (wrapping), every `step` points. */
function stations(s0, s1, step = 1) {
  const out = [];
  for (let i = 0; i < N; i += step) if (inSpan(CENTRE[i].s, s0, s1)) out.push(i);
  // Order them from s0 round to s1.
  return out.sort((a, b) => wrapS(CENTRE[a].s - s0) - wrapS(CENTRE[b].s - s0));
}

function buildTrack(M) {
  const ds = [-SH - BEVEL, -SH, -HALF - 0.05, -HALF, -3, 0, 3, HALF, HALF + 0.05, SH, SH + BEVEL];
  const ys = ds.map(d => Math.abs(d) > SH ? LOW_Y : EDGE_Y);
  const rows = [];
  for (let i = 0; i < N; i++) rows.push({ i, d: ds, y: ys });
  // Race asphalt is darker and smoother than a road's; a rubbered line through the corners;
  // the verges a shade lighter.
  const colour = (r, j) => {
    const d = Math.abs(ds[j]);
    if (d > HALF + 0.01) return [0.95, 0.94, 0.92];
    const k = Math.abs(CENTRE[r.i].k) > 0 ? 0.9 : 1;
    const t = 0.62 * k;
    return [t, t * 0.99, t * 0.98];
  };
  return mesh(ribbon(rows, { colour }), M.trackAsphalt ?? M.asphalt, { name: 'circuit-asphalt', castShadow: false });
}

function buildKerbs(M) {
  const RED = [0.78, 0.1, 0.08], WHITE = [0.94, 0.94, 0.92], STRIPE = 2.0;   // ≈ 2 m stripes
  const g = new THREE.Group();
  g.name = 'circuit-kerbs';
  KERBS.forEach((k, n) => {
    const st = stations(k.s0, k.s1);
    if (st.length < 2) return;
    const s = k.side, inner = s * HALF, outer = s * (HALF + KERB);
    // A low hump: up from the track's edge, flat, down to the verge.
    const d = [inner, s * (HALF + 0.3), s * (HALF + KERB - 0.3), outer];
    const y = [EDGE_Y + 0.002, EDGE_Y + KERB_Y, EDGE_Y + KERB_Y, EDGE_Y + 0.002];
    // Stripes with sharp edges: where the colour changes, the station is laid twice, once in
    // each colour, so no quad blends red into white.
    const stripe = (i) => (Math.floor(wrapS(CENTRE[i].s - k.s0) / STRIPE + 1e-6) % 2 ? WHITE : RED);
    const rows = [];
    st.forEach((i, m) => {
      const c = stripe(i);
      if (m > 0 && rows.at(-1).c !== c) rows.push({ i, d, y, c: rows.at(-1).c });
      rows.push({ i, d, y, c });
    });
    const colour = (r) => r.c;
    g.add(mesh(ribbon(rows, { closed: false, colour }), M.roadPaint, { name: `circuit-kerb-${n}`, castShadow: false }));
  });
  return g;
}

function buildTraps(M) {
  const g = new THREE.Group();
  g.name = 'circuit-gravel';
  TRAPS.forEach((t, n) => {
    const st = stations(t.s0, t.s1);
    const L = t.s1 - t.s0;
    const s = t.side;
    const rows = st.map(i => {
      // Tapered at both ends so the trap's edge meets the verge in a curve.
      const x = wrapS(CENTRE[i].s - t.s0) / L, deep = GRAVEL * Math.sin(Math.PI * Math.min(1, Math.max(0, x))) ** 0.5;
      const d1 = SH + 0.4, d2 = SH + 0.4 + Math.max(0.5, deep);
      return { i, d: s > 0 ? [d1, d2] : [-d2, -d1], y: [LOW_Y + 0.02, LOW_Y + 0.02] };
    });
    g.add(mesh(ribbon(rows, { closed: false }), M.berm, { name: `circuit-gravel-${n}`, castShadow: false }));
  });
  return g;
}

function buildPaint(M) {
  const WHITE = [0.93, 0.93, 0.9];
  const pos = [], col = [], uv = [], idx = [];
  // Each quad wound to face up on its own: the two edge lines run mirrored.
  const quad = (pts) => {
    const b = pos.length / 3;
    for (const [x, y, z] of pts) { pos.push(x, y, z); col.push(...WHITE); uv.push(x, z); }
    const [p0, p1, p2] = pts;
    const up = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
    if (up >= 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  };
  // Edge lines, 0.1 m (≈), just inside the track's edge, the whole lap.
  for (const side of [-1, 1]) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, d0 = side * (HALF - 0.12), d1 = side * (HALF - 0.02);
    const [ax, az] = at(i, d0), [bx, bz] = at(i, d1), [cx, cz] = at(j, d1), [dx, dz] = at(j, d0);
    const y = EDGE_Y + PAINT;
    quad([[ax, y, az], [bx, y, bz], [cx, y, cz], [dx, y, dz]]);
  }
  // A straight band across the main straight (local u fixed), v from v0 to v1, w metres wide.
  const band = (u, w, v0, v1) => {
    const y = EDGE_Y + PAINT;
    const [ax, az] = toWorld(u - w / 2, v0), [bx, bz] = toWorld(u - w / 2, v1), [cx, cz] = toWorld(u + w / 2, v1), [dx, dz] = toWorld(u + w / 2, v0);
    quad([[ax, y, az], [bx, y, bz], [cx, y, cz], [dx, y, dz]]);
  };
  // Start line, 0.3 m (≈), across the track.
  band(START.u, 0.3, -HALF + 0.12, HALF - 0.12);
  // Grid: staggered slots behind the line, each a 0.1 m bar across its half of the track (≈).
  for (let k = 0; k < START.gridSlots; k++) {
    const u = START.u - 8 - k * START.slotPitch, left = k % 2 === 0;
    band(u, 0.12, left ? -HALF + 1 : 0.5, left ? -0.5 : HALF - 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, M.roadPaint, { name: 'circuit-markings', castShadow: false });
}

/** The skid pad and its lane: one flat asphalt slab each, the edges bevelled to the ground. */
function buildSkidpad(M) {
  const slab = (u0, u1, v0, v1, step) => {
    const us = [u0 - BEVEL], vs = [v0 - BEVEL];
    for (let u = u0; u < u1; u += step) us.push(u);
    us.push(u1, u1 + BEVEL);
    for (let v = v0; v < v1; v += step) vs.push(v);
    vs.push(v1, v1 + BEVEL);
    const pos = [], uv = [], col = [], idx = [];
    for (const u of us) for (const v of vs) {
      const edge = u < u0 || u > u1 || v < v0 || v > v1;
      const [x, z] = toWorld(u, v);
      pos.push(x, edge ? LOW_Y : EDGE_Y, z); uv.push(u, v);
      col.push(0.82, 0.81, 0.8);
    }
    const n = vs.length;
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < n - 1; j++) {
      const p = i * n + j, q = p + n;
      idx.push(p, q, p + 1, q, q + 1, p + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) {
      const ix = g.index.array;
      for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
      g.computeVertexNormals();
    }
    return g;
  };
  const P = SKIDPAD, L = P.lane;
  const g = new THREE.Group();
  g.name = 'circuit-skidpad';
  g.add(mesh(slab(P.u0, P.u1, P.v0, P.v1, 10), M.trackAsphalt ?? M.asphalt, { name: 'circuit-skidpad-slab', castShadow: false }));
  // The lane, from the pad to the verge of the main straight.
  g.add(mesh(slab(L.u - L.width / 2, L.u + L.width / 2, P.v1, -SH, 5), M.trackAsphalt ?? M.asphalt, { name: 'circuit-skidpad-lane', castShadow: false }));
  return g;
}

export function buildCircuit(M) {
  const g = new THREE.Group();
  g.name = 'circuit';
  g.add(buildTrack(M));
  g.add(buildKerbs(M));
  g.add(buildTraps(M));
  g.add(buildPaint(M));
  g.add(buildSkidpad(M));
  return g;
}
