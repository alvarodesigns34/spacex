/**
 * The F-16's runway complex (terrain.js RUNWAY has where and why): runway 10/28, one taxiway
 * and a small apron. A runway with its markings, lights and a windsock, not an airport: no
 * terminal, hangars, tower or buildings.
 *
 * WHAT IS CITED AND WHAT IS NOT
 *
 * Markings follow FAA AC 150/5340-1M, Standards for Airport Markings (2019, Change 1 2020), for a
 * precision runway 150 ft wide (paragraphs 2.3–2.8 and figure A-1):
 *  - threshold: 12 stripes, 150 ft × 5.75 ft, 5.75 ft gaps, the middle pair 11.5 ft apart,
 *    starting 20 ft from the threshold (table 2-2, §2.5);
 *  - designation: numerals 60 ft high, 40 ft past the threshold stripes (figure A-1);
 *  - centre line: stripes 120 ft long, gaps 80 ft, 36 in wide (precision), the pattern evened
 *    out between the two designations (§2.4: the AC adjusts it at the midpoint, ≈ here);
 *  - aiming point: two bars 150 ft × 30 ft, inner sides 72 ft apart, from 1,020 ft (§2.6);
 *  - touchdown zone: bars 75 ft × 6 ft, 5 ft apart, inner sides 72 ft apart, in groups of 3, 3,
 *    2, 2 and 1 every 500 ft; an 8,000 ft runway (≥7,990 ft) takes the full set at both ends (table 2-4);
 *  - edge lines 3 ft wide along the full length (§2.8);
 *  - taxiway: yellow centre line 6 in wide, dual edge lines 6 in wide 6 in apart, and the runway
 *    holding position marking, pattern A: two solid and two dashed lines 12 in wide, 12 in apart
 *    (§3.3.4).
 * The numerals' strokes, the hold line's distance from the runway (250 ft, a common figure for
 * fighters), the shoulders (25 ft paved), the 1 % crown, the lights' spacing (200 ft, the
 * AC 150/5340-30 maximum for edge lights), the PAPI's place and units, the windsock (a 12 ft
 * sock) and the rubber deposits in the touchdown zones are plausible, not drawn from a plan (≈).
 *
 * Frame: built in runway coordinates (a along the centre line towards the 28 end, c across,
 * +c to the right of +a, towards the south-west), then turned onto the world by the group's yaw.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';
import { RUNWAY, APRON, fromRunway, terrainHeight } from './terrain.js';
import { windAt, WIND } from './wind.js';

const FT = 0.3048, IN = 0.0254;
const HALF = RUNWAY.width / 2, L2 = RUNWAY.length / 2;
const SHOULDER = 25 * FT;                // ≈ paved shoulders
const EDGE_Y = 0.06, CROWN = 0.01;       // ≈ pavement 6 cm proud of the ground at its edge, 1 % fall
const PAINT = 0.006;

const BEVEL = 0.3, LOW_Y = 0.005;
const SH = HALF + SHOULDER;
const inTaxi = (a, c) => Math.abs(a - APRON.taxi.a) <= APRON.taxi.width / 2 + 1e-6 && c >= APRON.taxi.c0 - 1e-6 && c <= -SH + 1e-6;
const inApron = (a, c) => a >= APRON.a0 - 1e-6 && a <= APRON.a1 + 1e-6 && c >= APRON.c0 - 1e-6 && c <= APRON.c1 + 1e-6;

/**
 * The pavement's height at (a, c), in runway coordinates: the runway's crown, its flat
 * shoulders, the taxiway and the apron; just above the ground elsewhere, where each slab's
 * outer row is bevelled down to meet it.
 */
export function runwaySurface(a, c) {
  const ac = Math.abs(c);
  if (Math.abs(a) <= L2 + 1e-6 && ac <= HALF) return EDGE_Y + CROWN * (HALF - ac);
  if (Math.abs(a) <= L2 + 1e-6 && ac <= SH + 1e-6) return EDGE_Y;
  if (inTaxi(a, c) || inApron(a, c)) return EDGE_Y;
  return LOW_Y;
}

/** A gridded slab of pavement over the along × across stations, its height from runwaySurface. */
function pavement(a0, a1, cs, { da = 10, tone = () => 1, bevel = [true, true], axis = 'a' } = {}) {
  const along = [];
  if (bevel[0]) along.push(a0 - BEVEL);
  for (let a = a0; a < a1; a += da) along.push(a);
  along.push(a1);
  if (bevel[1]) along.push(a1 + BEVEL);
  const across = cs;
  const pos = [], uv = [], col = [], idx = [];
  for (const s of along) for (const t of across) {
    // Along a (the runway) or along c (the taxiway); positions always in (a, y, c).
    const [a, c] = axis === 'a' ? [s, t] : [t, s];
    pos.push(a, runwaySurface(a, c), c);
    uv.push(a, c);
    const k = tone(a, c);
    col.push(k, k * 0.995, k * 0.985);
  }
  const n = across.length;
  for (let i = 0; i < along.length - 1; i++) for (let j = 0; j < n - 1; j++) {
    const p = i * n + j, q = p + n;
    // Wound to face up either way.
    if (axis === 'a') idx.push(p, p + 1, q, q, p + 1, q + 1); else idx.push(p, q, p + 1, q, q + 1, p + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Collects painted rectangles draped on the pavement, one colour per vertex. */
function paintBatch() {
  const pos = [], uv = [], col = [], idx = [];
  // A rectangle a0…a1 × c0…c1, cut along its length so it follows the crown.
  const rect = (a0, a1, c0, c1, rgb) => {
    const as = [a0];
    for (let a = a0 + 12; a < a1; a += 12) as.push(a);
    as.push(a1);
    const cs = c0 < 0 && c1 > 0 ? [c0, 0, c1] : [c0, c1];
    const base = pos.length / 3, n = cs.length;
    for (const a of as) for (const c of cs) {
      pos.push(a, runwaySurface(a, c) + PAINT, c);
      uv.push(a, c); col.push(...rgb);
    }
    for (let i = 0; i < as.length - 1; i++) for (let j = 0; j < n - 1; j++) {
      const p = base + i * n + j, q = p + n;
      idx.push(p, p + 1, q, q, p + 1, q + 1);
    }
  };
  const build = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  return { rect, build };
}

/**
 * The numerals in a 60 ft × 20 ft box, as strokes (u across the box from the pilot's left, v
 * along it from the end nearest the threshold, the numeral's foot), 5 ft wide (≈ the form of
 * figure A-6).
 */
const STROKE = 5 * FT, NUM_H = 60 * FT, NUM_W = 20 * FT, NUM_GAP = 15 * FT;
const GLYPHS = {
  1: [[NUM_W / 2 - STROKE / 2, NUM_W / 2 + STROKE / 2, 0, NUM_H]],
  3: [[0, NUM_W, NUM_H - STROKE, NUM_H], [NUM_W * 0.2, NUM_W, NUM_H / 2 - STROKE / 2, NUM_H / 2 + STROKE / 2], [0, NUM_W, 0, STROKE],
    [NUM_W - STROKE, NUM_W, 0, NUM_H]],
  0: [[0, STROKE, 0, NUM_H], [NUM_W - STROKE, NUM_W, 0, NUM_H], [STROKE, NUM_W - STROKE, NUM_H - STROKE, NUM_H], [STROKE, NUM_W - STROKE, 0, STROKE]],
  2: [[0, NUM_W, NUM_H - STROKE, NUM_H], [NUM_W - STROKE, NUM_W, NUM_H / 2, NUM_H - STROKE], [0, NUM_W, NUM_H / 2 - STROKE / 2, NUM_H / 2 + STROKE / 2],
    [0, STROKE, STROKE, NUM_H / 2], [0, NUM_W, 0, STROKE]],
  8: [[0, STROKE, 0, NUM_H], [NUM_W - STROKE, NUM_W, 0, NUM_H], [STROKE, NUM_W - STROKE, NUM_H - STROKE, NUM_H], [STROKE, NUM_W - STROKE, 0, STROKE],
    [STROKE, NUM_W - STROKE, NUM_H / 2 - STROKE / 2, NUM_H / 2 + STROKE / 2]],
};

function markRunway(paint, WHITE) {
  const T = 20 * FT;
  for (const dir of [1, -1]) {
    // Distance d from this end's threshold, lateral u to the pilot's right.
    const end = -dir * L2;
    const at = (d) => end + dir * d;
    // The pilot faces +a at the west (10) end and −a at the east (28) end; +c lies to the right of +a.
    const cOf = (u) => dir * u;
    const bar = (d0, d1, u0, u1) => {
      const a0 = at(d0), a1 = at(d1), c0 = cOf(u0), c1 = cOf(u1);
      paint.rect(Math.min(a0, a1), Math.max(a0, a1), Math.min(c0, c1), Math.max(c0, c1), WHITE);
    };
    // Threshold: six stripes each side; outer edges 5.75 ft apart, the middle pair 11.5 ft.
    const sw = 5.75 * FT;
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
      const u0 = 11.5 * FT / 2 + k * 2 * sw;
      bar(T, T + 150 * FT, s * u0, s * (u0 + sw));
    }
    // Designation, read left to right by the pilot landing here: "10" at the west end, "28" east.
    const digits = (dir > 0 ? RUNWAY.idents[0] : RUNWAY.idents[1]).split('');
    const d0 = T + 150 * FT + 40 * FT, total = NUM_W * 2 + NUM_GAP;
    digits.forEach((ch, i) => {
      const u0 = -total / 2 + i * (NUM_W + NUM_GAP);
      for (const [x0, x1, v0, v1] of GLYPHS[ch]) bar(d0 + v0, d0 + v1, u0 + x0, u0 + x1);
    });
    // Aiming point and the touchdown zone, both sides of the centre line.
    const inner = 72 * FT / 2;
    for (const s of [-1, 1]) bar(1020 * FT, 1170 * FT, s * inner, s * (inner + 30 * FT));
    const groups = [[520, 3], [1520, 3], [2020, 2], [2520, 2], [3020, 1]];
    for (const [d, n] of groups) for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
      const u0 = inner + k * (6 + 5) * FT;
      bar(d * FT, (d + 75) * FT, s * u0, s * (u0 + 6 * FT));
    }
  }
  // Centre line, between the two designations: 120 ft stripes, gaps evened out near 80 ft.
  const c0 = -L2 + (20 + 150 + 40 + 60 + 40) * FT, c1 = -c0, len = c1 - c0;
  const n = Math.floor((len + 80 * FT) / (200 * FT)), gap = (len - n * 120 * FT) / (n - 1);
  for (let k = 0; k < n; k++) {
    const a = c0 + k * (120 * FT + gap);
    paint.rect(a, a + 120 * FT, -18 * IN, 18 * IN, WHITE);
  }
  // Edge lines, 3 ft, along the full length at the pavement's edge.
  for (const s of [-1, 1]) paint.rect(-L2, L2, s > 0 ? HALF - 3 * FT : -HALF, s > 0 ? HALF : -HALF + 3 * FT, WHITE);
}

function markTaxiway(paint, YELLOW) {
  const { a, c0, c1, width } = APRON.taxi;
  const w2 = width / 2, line = 6 * IN;
  // Centre line from the apron to the runway's edge, and on across the apron (≈ a taxi lane).
  paint.rect(a - line / 2, a + line / 2, APRON.c0 + 20, c1, YELLOW);
  // Dual edge lines along both sides of the taxiway.
  for (const s of [-1, 1]) {
    const e = a + s * w2;
    paint.rect(Math.min(e, e - s * line), Math.max(e, e - s * line), c0, -SH, YELLOW);
    const e2 = e - s * 2 * line;
    paint.rect(Math.min(e2, e2 - s * line), Math.max(e2, e2 - s * line), c0, -SH, YELLOW);
  }
  // Holding position, pattern A, 250 ft from the runway's centre line (≈): the dashed pair on
  // the runway side. Lines 12 in, spaces 12 in; dashes 3 ft with 3 ft gaps.
  const W = 12 * IN, hold = -250 * FT, reach = w2 - 3 * line, dash = 3 * FT;
  const lines = [hold - 3.5 * W, hold - 1.5 * W, hold + 0.5 * W, hold + 2.5 * W];   // solid, solid, dashed, dashed
  lines.forEach((cl, i) => {
    if (i < 2) { paint.rect(a - reach, a + reach, cl, cl + W, YELLOW); return; }
    // One dash centred on the taxiway's centre line, the rest every 6 ft out to the edges.
    for (let k = -Math.floor(reach / (2 * dash)); k <= Math.floor(reach / (2 * dash)); k++) {
      const lo = Math.max(-reach, k * 2 * dash - dash / 2), hi = Math.min(reach, k * 2 * dash + dash / 2);
      if (hi > lo) paint.rect(a + lo, a + hi, cl, cl + W, YELLOW);
    }
  });
}

/** Elevated lights, the PAPI and the windsock. */
function buildFixtures(g, M, lensMat, sockMat) {
  const lights = [];   // [a, c, rgb]
  const WHITE = [1, 0.97, 0.86], GREEN = [0.25, 0.85, 0.45], RED = [0.9, 0.18, 0.12];
  // Edge lights every 200 ft (≈ the maximum), 3 m outside the edge, along both sides.
  const n = Math.round(RUNWAY.length / (200 * FT));
  for (let k = 0; k <= n; k++) {
    const a = -L2 + k * RUNWAY.length / n;
    for (const s of [-1, 1]) lights.push([a, s * (HALF + 3), WHITE]);
  }
  // Threshold and end lights across each end, 3 m beyond it (≈ eight per end in two groups):
  // green to the approaching pilot, red to the one rolling out. The lens is drawn green at the
  // west end and red at the east end only for the eye; both ends carry both in a real fixture.
  for (const s of [-1, 1]) for (const c of [-21, -18, -15, -12, 12, 15, 18, 21]) lights.push([s * (L2 + 3), c, s < 0 ? GREEN : RED]);

  const stem = new THREE.CylinderGeometry(0.025, 0.03, 0.26, 8);
  stem.translate(0, 0.13, 0);
  const stems = new THREE.InstancedMesh(stem, M.safetyYellow ?? M.aluminum, lights.length);
  const lens = new THREE.CylinderGeometry(0.06, 0.07, 0.11, 12);
  lens.translate(0, 0.315, 0);
  const lenses = new THREE.InstancedMesh(lens, lensMat, lights.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  lights.forEach(([a, c, rgb], i) => {
    m.makeTranslation(a, EDGE_Y, c);
    stems.setMatrixAt(i, m); lenses.setMatrixAt(i, m);
    lenses.setColorAt(i, col.setRGB(...rgb));
  });
  stems.name = 'runway-light-stems'; lenses.name = 'runway-light-lenses';
  for (const o of [stems, lenses]) { o.castShadow = false; o.receiveShadow = true; g.add(o); }

  // PAPI: four light units on the left of each runway, the inner one 50 ft from the edge, 30 ft
  // apart (AC 150/5345-28 ranges; ≈ 1,100 ft from the threshold). A housing on two legs.
  const unit = mergeAll([
    { geometry: new THREE.BoxGeometry(0.8, 0.45, 1.1), matrix: mat4([0, 0.75, 0]) },
    { geometry: new THREE.BoxGeometry(0.08, 0.55, 0.08), matrix: mat4([0, 0.27, -0.4]) },
    { geometry: new THREE.BoxGeometry(0.08, 0.55, 0.08), matrix: mat4([0, 0.27, 0.4]) },
  ]);
  const papis = [];
  for (const dir of [1, -1]) for (let k = 0; k < 4; k++) {
    // The pilot's left: −c landing on 10 (towards +a), +c landing on 28.
    papis.push([-dir * L2 + dir * 1100 * FT, -dir * (HALF + 50 * FT + k * 30 * FT)]);
  }
  const boxes = new THREE.InstancedMesh(unit, M.alumDark ?? M.aluminum, papis.length);
  papis.forEach(([a, c], i) => boxes.setMatrixAt(i, m.makeTranslation(a, 0, c)));
  boxes.name = 'runway-papi'; boxes.castShadow = true; boxes.receiveShadow = true;
  g.add(boxes);
  // Their lenses: three per unit, facing the approach.
  const lensFace = new THREE.CircleGeometry(0.1, 16);
  const faces = new THREE.InstancedMesh(lensFace, lensMat, papis.length * 3);
  let f = 0;
  papis.forEach(([a, c], i) => {
    const dir = i < 4 ? 1 : -1;
    for (const dc of [-0.3, 0, 0.3]) {
      m.makeRotationY(-dir * Math.PI / 2).setPosition(a - dir * 0.41, 0.78, c + dc);
      faces.setMatrixAt(f, m); faces.setColorAt(f++, col.setRGB(1, 0.95, 0.9));
    }
  });
  faces.name = 'runway-papi-lenses';
  g.add(faces);

  // Windsock near the 28 end, by the site, clear of the runway safety area (≈ a 12 ft sock on a hinged mast).
  // It streams downwind of the site's wind (core/wind.js: the sea breeze from the SSE), and moves
  // with it: tick(t) turns it to the wind at the mast's top and lifts it with the wind's speed —
  // a sock is built to stand straight out at 15 kt (FAA AC 150/5345-27) and hangs limp in calm
  // air; in between its droop is ≈.
  const wa = L2 - 1000 * FT, wc = 110;
  const [wx, wz] = fromRunway(wa, wc);
  const sock = new THREE.Group();
  sock.name = 'runway-windsock';
  sock.position.set(wa, terrainHeight(wx, wz), wc);
  const mast = 5.0;
  sock.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, mast, 10), M.aluminum, { position: [0, mast / 2, 0], name: 'runway-windsock-mast' }));
  // The sock streams along −x of its frame, which turns about the mast (yaw) and droops about its
  // own z. +a bears 100.8° + the runway's turn, +c lies to its right (clockwise): a yaw θ points
  // −x of the frame at the bearing (base + 180° − θ).
  const base = 100.8 + RUNWAY.angleDeg;
  const frame = new THREE.Group();
  frame.name = 'runway-windsock-frame';
  frame.position.set(0, mast, 0);
  frame.rotation.order = 'YZX';
  frame.add(mesh(new THREE.TorusGeometry(0.46, 0.02, 6, 20), M.aluminum, { rotation: [0, Math.PI / 2, 0], name: 'runway-windsock-ring' }));
  const L = 12 * FT;
  const cloth = new THREE.CylinderGeometry(0.46, 0.23, L, 20, 6, true);
  cloth.rotateZ(Math.PI / 2);
  cloth.translate(-L / 2, 0, 0);
  // The fabric sags a little along its length, whatever the frame's angle (≈).
  const p = cloth.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = -p.getX(i); p.setY(i, p.getY(i) - 0.012 * x * x); }
  cloth.computeVertexNormals();
  frame.add(mesh(cloth, sockMat, { name: 'runway-windsock-sock' }));
  sock.add(frame);
  g.add(sock);
  const w = { x: 0, y: 0, z: 0 }, at = new THREE.Vector3();
  let yaw = null, droop = 0, last = null;
  const aim = (t) => {
    // The wind at the mast's top, in the world (the runway's group sits on the scene's axes but turned).
    sock.getWorldPosition(at);
    windAt(at.x, mast, at.z, t, w);
    const U = Math.hypot(w.x, w.z), toward = 100.8 + Math.atan2(w.z, w.x) * 180 / Math.PI;
    return { yaw: (base + 180 - toward) * Math.PI / 180, droop: Math.pow(1 - Math.min(1, U / (15 * 0.514444)), 1.3) * 75 * Math.PI / 180 };
  };
  /** Turns the sock to the wind at time t (s); it swings after it with ≈0.6 s of lag. */
  sock.userData.tick = (t) => {
    const want = aim(t), k = last === null ? 1 : 1 - Math.exp(-Math.max(0, Math.min(0.5, t - last)) / 0.6);
    last = t;
    if (yaw === null) yaw = want.yaw;
    yaw += (Math.atan2(Math.sin(want.yaw - yaw), Math.cos(want.yaw - yaw))) * k;
    droop += (want.droop - droop) * k;
    frame.rotation.set(0, yaw, droop);
  };
  sock.userData.wind = WIND;
  // Pointed once at build time (the scene's still pictures see it right before any frame runs).
  sock.userData.tick(0);
}

export function buildRunway(M) {
  const g = new THREE.Group();
  g.name = 'runway-complex';
  g.position.set(RUNWAY.x, 0, RUNWAY.z);
  g.rotation.y = -RUNWAY.angleDeg * Math.PI / 180;

  // Runway and shoulders: asphalt; the shoulders a shade lighter, the touchdown zones darkened
  // by tyre rubber over the middle of the runway.
  const rub = (a) => {
    const d = L2 - Math.abs(a);
    return Math.exp(-(((d - 380) / 170) ** 2));
  };
  const cs = [-SH - BEVEL, -SH, -HALF - 0.3, -HALF, -HALF + 6, -12, -6, -3, 0, 3, 6, 12, HALF - 6, HALF, HALF + 0.3, SH, SH + BEVEL];
  const tone = (a, c) => {
    const ac = Math.abs(c);
    if (ac > HALF + 0.1) return 1.12;
    return 1 - 0.35 * rub(a) * Math.exp(-((c / 8) ** 2)) - 0.04 * Math.exp(-((c / 3) ** 2));
  };
  const strip = pavement(-L2, L2, cs, { da: 12, tone });
  g.add(mesh(strip, M.asphalt, { name: 'runway-pavement', castShadow: false }));

  // Taxiway and apron: concrete in slabs. The taxiway runs from the apron's edge to the
  // shoulder's; across the slab its outer stations are bevelled to the ground.
  const { a: ta, c0: tc0, width: tw } = APRON.taxi;
  const taxi = pavement(tc0, -SH, [ta - tw / 2 - BEVEL, ta - tw / 2, ta, ta + tw / 2, ta + tw / 2 + BEVEL], { da: 6, bevel: [false, false], axis: 'c' });
  const apron = pavement(APRON.a0, APRON.a1, [APRON.c0 - BEVEL, APRON.c0, (APRON.c0 + APRON.c1) / 2, APRON.c1, APRON.c1 + BEVEL], { da: 7.5 });
  g.add(mesh(mergeGeometries([taxi, apron], false), M.campusGround, { name: 'runway-apron', castShadow: false }));

  const paint = paintBatch();
  markRunway(paint, [0.93, 0.93, 0.9]);
  markTaxiway(paint, [0.96, 0.74, 0.16]);
  g.add(mesh(paint.build(), M.roadPaint, { name: 'runway-markings', castShadow: false }));

  buildFixtures(g, M, M.runwayLens, M.windsock);
  return g;
}
