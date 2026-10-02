/**
 * The Porsche 911 GT3 RS's cabin (992, 2023, left-hand drive), modelled on Porsche's interior
 * press photographs (the driver's view, the seats from the passenger's door, the instrument
 * cluster, the gear selector, the door; reference only, not in the repository). Positions and
 * sizes ≈ from those photographs at the car's published dimensions, the published 360 mm
 * steering wheel and 14.1:1 steering ratio aside. No logos, script or crests.
 *
 *  - The dashboard: the flat upper deck under the windscreen with its defrost slots and the
 *    stopwatch on top, the Alcantara face with a carbon strip across the passenger's side, the
 *    driver's vent by the door.
 *  - The instrument cluster under its hood: the analogue tachometer in the middle (to 10,000 /min,
 *    red from 9,000), a live needle, the gear and the speed in its foot; a screen each side with
 *    two round displays (the dampers' compression and rebound settings, as photographed).
 *  - The centre stack: the touchscreen, the carbon strip, five toggle switches, two vents; the
 *    console falling to the tunnel with the short gear selector in its Alcantara boot, the
 *    tray, the carbon sides and the armrest.
 *  - The GT steering wheel in Alcantara: oval rim, yellow twelve-o'clock band, three spokes with
 *    their button pods and the four rotary switches, the shift paddles; it turns with the
 *    front wheels at the published ratio.
 *  - Two carbon full bucket seats lofted along their spine: the shell, the black bolsters, the
 *    dark red perforated centres, the cut-outs under the headrest; the red three-point belts.
 *  - The door cards: the leather capping, the Alcantara panel, the perforated insert, the
 *    armrest, the red pull strap, the window switches.
 *  - The floor with its mats, the footwell, the pedals and the footrest, the sills; the
 *    Clubsport package's bolted roll cage behind the seats; the rear compartment closed by the
 *    engine bulkhead; the sun visors and the mirror.
 *
 * Frame: the car's (X forward from the middle of the wheelbase, Y up from the ground, Z to the
 * right). The group carries userData.instruments.update({ rpm, gear, kmh, steer, reverse }).
 */
import * as THREE from 'three';
import { mesh, mergeAll, curve } from '../geometry/utils.js';
import { BODY } from '../data/gt3rs.js';

const TAU = Math.PI * 2;
/** The driver's and the passenger's centre lines (left-hand drive). */
export const DZ = -0.37, PZ = 0.37;
/** The driver's eye (≈: the head just ahead of the headrest of a seat set for a 1.80 m driver). */
export const EYE = [-0.30, 1.05, DZ];
/** The steering wheel's centre and the tilt of its axis from the horizontal (≈). */
// Its outer diameter is the published 360 mm: rim centre line 0.163 m, the rim 35 mm thick.
const WHEEL = { x: 0.175, y: 0.80, z: DZ, tilt: 0.40, R: BODY.steeringWheel / 2 - 0.0175, tube: 0.0175 };
const STEERING_RATIO = BODY.steeringRatio;

// ---- Shape helpers ---------------------------------------------------------------------------
const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
/**
 * A superellipsoid w × h × d centred at the origin: exponents near 0.2 give a box with soft
 * edges, 1 an ellipsoid; `puff` bulges the faces (a cushion's crown).
 */
export function cushion(w, h, d, { e1 = 0.3, e2 = 0.3, nu = 20, nv = 12, puff = 0 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nv; i++) {
    const th = -Math.PI / 2 + Math.PI * i / nv, ct = Math.cos(th), st = Math.sin(th);
    for (let j = 0; j <= nu; j++) {
      const ph = -Math.PI + TAU * j / nu, cp = Math.cos(ph), sp = Math.sin(ph);
      let x = spow(ct, e1) * spow(cp, e2), y = spow(st, e1), z = spow(ct, e1) * spow(sp, e2);
      if (puff) { const k = 1 + puff * (1 - x * x) * (1 - z * z); y *= k; }
      pos.push(x * w / 2, y * h / 2, z * d / 2); uv.push(j / nu * (w + d), i / nv * h);
    }
  }
  for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
    const a = i * (nu + 1) + j, b = a + nu + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Places a geometry: rotation (Euler YXZ), then position. */
export const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
  return geo;
};
/** A box w × h × d with rounded edges of radius r, centred at the origin. */
export function roundBox(w, h, d, r, segs = 2) {
  const sh = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
  sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.absarc(x, -y, r, -Math.PI / 2, 0, false);
  sh.lineTo(w / 2, y); sh.absarc(x, y, r, 0, Math.PI / 2, false);
  sh.lineTo(-x, h / 2); sh.absarc(-x, y, r, Math.PI / 2, Math.PI, false);
  sh.lineTo(-w / 2, -y); sh.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: segs, curveSegments: segs });
  geo.translate(0, 0, -(d - 2 * r) / 2);
  return geo;
}
/** A plain box: switches, slats, slots (too small for rounded edges to show). */
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** A grid surface from rows of points (each row one section): UVs in metres along both. */
function gridSurface(rows, { closed = false, flip = false } = {}) {
  const n = rows[0].length, m = rows.length, pos = [], uv = [], idx = [];
  const vAcc = new Float64Array(n);
  for (let i = 0; i < m; i++) {
    let u = 0;
    for (let j = 0; j < n; j++) {
      const p = rows[i][j];
      if (j) u += p.distanceTo(rows[i][j - 1]);
      if (i) vAcc[j] += p.distanceTo(rows[i - 1][j]);
      pos.push(p.x, p.y, p.z); uv.push(u, vAcc[j]);
    }
  }
  const cols = closed ? n : n - 1;
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < cols; j++) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Turns a geometry's faces to look away from point c (or towards it with `towards`). */
function faceFrom(g, c, towards = false) {
  const n = g.attributes.normal, p = g.attributes.position;
  let s = 0;
  for (let i = 0; i < n.count; i++) s += n.getX(i) * (p.getX(i) - c.x) + n.getY(i) * (p.getY(i) - c.y) + n.getZ(i) * (p.getZ(i) - c.z);
  if ((s < 0) !== towards) {
    const ix = g.index.array;
    g.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]]));
    g.computeVertexNormals();
  }
  return g;
}
/** A tube of elliptical section (a across, b up the path's binormal) along a curve. */
function ovalTube(path, a, b, n = 24, na = 12, closed = false) {
  const frames = path.computeFrenetFrames(n, closed);
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAt(Math.min(1, i / n)), N = frames.normals[i % (closed ? n : n + 1)], B = frames.binormals[i % (closed ? n : n + 1)];
    const row = [];
    for (let j = 0; j <= na; j++) {
      const th = TAU * j / na;
      row.push(p.clone().addScaledVector(N, a * Math.cos(th)).addScaledVector(B, b * Math.sin(th)));
    }
    rows.push(row);
  }
  return gridSurface(rows);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- Textures (browser only; null in node) ----------------------------------------------------
function canvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (!x) return null;
    draw(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  } catch { return null; }
}
/** A round display on a screen: ring, scale, value in the middle (the photographs' layout). */
function roundDisplay(x, cx, cy, r, label, value, sub) {
  x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fillStyle = '#0a0d10'; x.fill();
  x.lineWidth = r * 0.07; x.strokeStyle = '#2b3138'; x.stroke();
  x.lineWidth = r * 0.09; x.strokeStyle = '#3d8fe0';
  x.beginPath(); x.arc(cx, cy, r * 0.82, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * 0.62)); x.stroke();
  x.fillStyle = '#e9edf0'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `600 ${Math.round(r * 0.5)}px sans-serif`; x.fillText(value, cx, cy);
  x.font = `${Math.round(r * 0.2)}px sans-serif`; x.fillStyle = '#9aa3ab'; x.fillText(sub, cx, cy + r * 0.48);
  if (label) { x.font = `${Math.round(r * 0.24)}px sans-serif`; x.fillStyle = '#cfd5da'; x.fillText(label, cx, cy - r * 1.22); }
}
/**
 * The screens, on one canvas (one texture, one material): the cluster's two screens either side
 * of the tachometer in the top 384 rows (its place left black), the centre screen's page below
 * (rows 400–820, the left half). SCREEN_UV gives each its part of the texture.
 */
const SCREEN_H = 832;
export const SCREEN_UV = {
  cluster: (u, v) => [u, 1 - 384 / SCREEN_H + v * 384 / SCREEN_H],
  centre: (u, v) => [u * 0.5, 1 - 820 / SCREEN_H + v * 420 / SCREEN_H],
};
function screens() {
  return canvas(2048, SCREEN_H, (x) => {
    x.fillStyle = '#030405'; x.fillRect(0, 0, 2048, SCREEN_H);
    // The cluster's screens.
    const H = 384;
    const panel = (x0, x1) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0f13'); g.addColorStop(1, '#05070a'); x.fillStyle = g; x.fillRect(x0, 24, x1 - x0, H - 48); };
    panel(40, 820); panel(1228, 2008);
    roundDisplay(x, 260, 205, 118, 'Compression', '+2', 'Front');
    roundDisplay(x, 600, 205, 118, '', '+4', 'Rear');
    roundDisplay(x, 1448, 205, 118, 'Rebound', '+2', 'Front');
    roundDisplay(x, 1788, 205, 118, '', '+4', 'Rear');
    x.fillStyle = '#7f8a94'; x.font = '30px sans-serif'; x.textAlign = 'left';
    x.fillText('13.2 km', 70, 352); x.textAlign = 'right'; x.fillText('24.5 °C  TRACK', 1978, 352);
    // The centre screen: a dark page of tiles, their values blank (no figures the car has not given; no logos).
    x.save(); x.translate(0, 400);
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 1024, 420);
    x.fillStyle = '#10151b'; x.fillRect(0, 0, 120, 420);
    for (let k = 0; k < 6; k++) { x.fillStyle = k === 1 ? '#3d8fe0' : '#59636d'; x.beginPath(); x.arc(60, 46 + k * 64, 15, 0, TAU); x.fill(); }
    const tile = (tx, ty, tw, th, title, big) => {
      x.fillStyle = '#121920'; x.fillRect(tx, ty, tw, th);
      x.fillStyle = '#8f9aa4'; x.font = '24px sans-serif'; x.textAlign = 'left'; x.fillText(title, tx + 18, ty + 36);
      x.fillStyle = '#eef2f5'; x.font = '600 54px sans-serif'; x.fillText(big, tx + 18, ty + th - 30);
    };
    tile(140, 20, 420, 180, 'Lap time', '–:––.–');
    tile(580, 20, 424, 180, 'Best lap', '–:––.–');
    tile(140, 220, 270, 180, 'Oil', '– °C');
    tile(424, 220, 270, 180, 'Tyres', '– bar');
    tile(708, 220, 296, 180, 'Lateral', '– g');
    x.restore();
  });
}
/**
 * The dials, on one canvas: the tachometer's (the left half: 0–10 × 1,000 /min over 300°, red
 * from 9) and the stopwatch's (a clock face with its sub-dial, x 640–896, y 128–384). DIAL_UV
 * maps a circle's own UVs into each.
 */
export const DIAL_UV = {
  tach: (u, v) => [u * 0.5, v],
  clock: (u, v) => [(640 + u * 256) / 1024, (128 + v * 256) / 512],
};
function dials() {
  return canvas(1024, 512, (x) => {
    x.fillStyle = '#050607'; x.fillRect(0, 0, 1024, 512);
    let c = 256;
    const g = x.createRadialGradient(c, c, 40, c, c, 256); g.addColorStop(0, '#111316'); g.addColorStop(1, '#050607');
    x.fillStyle = g; x.beginPath(); x.arc(c, c, 256, 0, TAU); x.fill();
    const a0 = Math.PI * 0.68, span = Math.PI * 1.64;
    x.lineWidth = 16; x.strokeStyle = '#a3141b';
    x.beginPath(); x.arc(c, c, 214, a0 + span * 0.9, a0 + span); x.stroke();
    for (let k = 0; k <= 50; k++) {
      const a = a0 + span * k / 50, big = k % 5 === 0;
      x.strokeStyle = k >= 45 ? '#e2343b' : '#eef1f3'; x.lineWidth = big ? 6 : 3;
      const r0 = big ? 186 : 200;
      x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * 224, c + Math.sin(a) * 224); x.stroke();
      if (big) {
        x.fillStyle = '#eef1f3'; x.font = '600 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(k / 5), c + Math.cos(a) * 150, c + Math.sin(a) * 150);
      }
    }
    // The stopwatch.
    x.save(); x.translate(640, 128); c = 128;
    x.fillStyle = '#07080a'; x.beginPath(); x.arc(c, c, 128, 0, TAU); x.fill();
    for (let k = 0; k < 60; k++) {
      const a = TAU * k / 60, big = k % 5 === 0;
      x.strokeStyle = '#e9ecef'; x.lineWidth = big ? 5 : 2;
      x.beginPath(); x.moveTo(c + Math.cos(a) * (big ? 96 : 106), c + Math.sin(a) * (big ? 96 : 106)); x.lineTo(c + Math.cos(a) * 118, c + Math.sin(a) * 118); x.stroke();
    }
    x.strokeStyle = '#444b52'; x.lineWidth = 3; x.beginPath(); x.arc(c, c + 44, 24, 0, TAU); x.stroke();
    x.strokeStyle = '#e9ecef'; x.lineWidth = 5; x.beginPath(); x.moveTo(c, c); x.lineTo(c + 52, c - 42); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(c, c); x.lineTo(c - 18, c - 88); x.stroke();
    x.restore();
  });
}
/** Remaps a geometry's UVs through f (an atlas's part). */
const remapUV = (geo, f) => {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const [a, b] = f(uv.getX(i), uv.getY(i)); uv.setXY(i, a, b); }
  return geo;
};
/** The door's and the seats' perforated panels: black with a red glow through the holes. */
function perforated(base, dot) {
  return canvas(256, 256, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    x.fillStyle = dot;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      x.beginPath(); x.arc(8 + j * 16 + (i % 2) * 8, 8 + i * 16, 3.2, 0, TAU); x.fill();
    }
  });
}

// ---- Materials ---------------------------------------------------------------------------------
function cabinMaterials(M) {
  if (M.gt3cAlcantara) return M;
  const rep = (t, r) => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(r, r); } return t; };
  // Alcantara: the body's own lining material (the headliner and the pillars are Alcantara too).
  M.gt3cAlcantara = M.gt3Interior ?? new THREE.MeshStandardMaterial({ name: 'gt3c-alcantara', color: 0x1a1b1d, metalness: 0, roughness: 1, side: THREE.DoubleSide });
  M.gt3cLeather = new THREE.MeshStandardMaterial({ name: 'gt3c-leather', color: 0x0f1012, metalness: 0, roughness: 0.52 });
  const seatMap = rep(perforated('#3a0c11', '#140405'), 14);
  M.gt3cSeatRed = new THREE.MeshStandardMaterial({ name: 'gt3c-seat-centre', color: seatMap ? 0xffffff : 0x4a1015, map: seatMap, metalness: 0, roughness: 0.82 });
  const doorMap = rep(perforated('#0d0e10', '#8e1a22'), 16);
  M.gt3cDoorMesh = new THREE.MeshStandardMaterial({ name: 'gt3c-door-insert', color: doorMap ? 0xffffff : 0x2a1214, map: doorMap, metalness: 0.1, roughness: 0.7 });
  M.gt3cCarbon = (M.carbon ?? new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.3, roughness: 0.3 })).clone();
  M.gt3cCarbon.name = 'gt3c-carbon'; M.gt3cCarbon.side = THREE.DoubleSide;
  M.gt3cGloss = new THREE.MeshPhysicalMaterial({ name: 'gt3c-piano-black', color: 0x060708, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  M.gt3cBlack = new THREE.MeshStandardMaterial({ name: 'gt3c-black', color: 0x0e0f11, metalness: 0.1, roughness: 0.5 });
  M.gt3cCarpet = M.gt3cAlcantara;   // the carpets read the same under the dash: one material (the scene's budget)
  M.gt3cAlu = new THREE.MeshStandardMaterial({ name: 'gt3c-alu', color: 0x9aa0a6, metalness: 0.85, roughness: 0.38 });
  M.gt3cRed = new THREE.MeshStandardMaterial({ name: 'gt3c-belt', color: 0xb5161f, metalness: 0, roughness: 0.66, side: THREE.DoubleSide });
  M.gt3cYellow = new THREE.MeshStandardMaterial({ name: 'gt3c-yellow', color: 0xd9c22b, metalness: 0, roughness: 0.85 });
  M.gt3cCage = M.gt3cBlack;
  const scr = (map, name, k = 1) => new THREE.MeshStandardMaterial({ name, color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: map ? k : 0, roughness: 0.25, metalness: 0 });
  M.gt3cScreen = scr(screens(), 'gt3c-screens', 0.9);
  M.gt3cCluster = M.gt3cScreen;
  M.gt3cTach = scr(dials(), 'gt3c-dials', 0.9);
  M.gt3cClock = M.gt3cTach;
  // The cabin sees a fraction of the sky the environment map assumes (the roof, the pillars, the
  // dash over the footwells): its reflections are turned down to match (≈, an occlusion term).
  for (const k of ['gt3cAlcantara', 'gt3cLeather', 'gt3cSeatRed', 'gt3cDoorMesh', 'gt3cCarbon', 'gt3cGloss', 'gt3cBlack', 'gt3cAlu', 'gt3cRed', 'gt3cYellow']) M[k].envMapIntensity = k === 'gt3cGloss' ? 0.6 : 0.4;
  return M;
}

// ---- The parts -----------------------------------------------------------------------------------
/** The dashboard: one smooth section across the car (the deck, the lip, the face, the knee roll). */
function dashboard(P) {
  const sh = new THREE.Shape();
  sh.moveTo(0.80, 0.858);
  sh.quadraticCurveTo(0.66, 0.905, 0.50, 0.905);
  sh.quadraticCurveTo(0.418, 0.905, 0.414, 0.872);
  sh.lineTo(0.420, 0.80);
  sh.quadraticCurveTo(0.426, 0.70, 0.445, 0.64);
  sh.quadraticCurveTo(0.47, 0.565, 0.56, 0.535);
  sh.lineTo(0.79, 0.52);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.50, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -0.75);
  P('alcantara', geo);
  // The deck's leather top: a skin over the flat part.
  const top = new THREE.Shape();
  top.moveTo(0.79, 0.861); top.quadraticCurveTo(0.66, 0.908, 0.50, 0.908); top.quadraticCurveTo(0.43, 0.908, 0.425, 0.896);
  top.lineTo(0.43, 0.894); top.quadraticCurveTo(0.49, 0.903, 0.50, 0.903); top.quadraticCurveTo(0.66, 0.902, 0.79, 0.857); top.closePath();
  const deck = new THREE.ExtrudeGeometry(top, { depth: 1.52, bevelEnabled: false, curveSegments: 10 });
  deck.translate(0, 0, -0.76);
  P('leather', deck);
  // The carbon strip across the passenger's face and under the centre screen.
  P('carbon', at(roundBox(0.012, 0.024, 0.66, 0.004), 0.421, 0.762, 0.40));
  // Defrost slots under the windscreen.
  for (const z of [-0.30, 0.30]) for (let k = 0; k < 6; k++) P('black', at(box(0.010, 0.004, 0.17), 0.72 - k * 0.014, 0.888 + k * 0.0035, z, 0, 0, -0.30));
  // The driver's vent by the door, the passenger's at the far end: a frame and four slats.
  for (const z of [-0.70, 0.69]) {
    P('gloss', at(roundBox(0.02, 0.085, 0.09, 0.012), 0.425, 0.815, z));
    for (let k = 0; k < 4; k++) P('black', at(box(0.03, 0.006, 0.075), 0.418, 0.785 + k * 0.019, z));
  }
}
/** The cluster: hood, screens, the tachometer with its live needle. Returns the needle. */
function cluster(P, g, M) {
  // The face: a band of a cylinder about the driver's eye, leaning back ≈15°.
  const R = 0.705, cx = EYE[0], a0 = -0.36, a1 = 0.36, y0 = 0.832, y1 = 0.932, lean = Math.tan(15 * Math.PI / 180);
  const pt = (a, y, dr = 0) => { const r = R - (y - y0) * lean + dr; return V(cx + r * Math.cos(a), y, DZ + r * Math.sin(a)); };
  {
    const rows = [];
    for (let i = 0; i <= 8; i++) { const y = y0 + (y1 - y0) * i / 8, row = []; for (let j = 0; j <= 48; j++) row.push(pt(a0 + (a1 - a0) * j / 48, y)); rows.push(row); }
    const geo = gridSurface(rows);
    // UVs across the canvas: u along the band, v up it.
    const uv = geo.attributes.uv;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 48; j++) uv.setXY(i * 49 + j, ...SCREEN_UV.cluster(j / 48, i / 8));
    faceFrom(geo, V(...EYE), true);
    g.add(mesh(geo, M.gt3cCluster, { name: 'gt3-cluster-screens', castShadow: false }));
  }
  // The hood: a thin brow from the face's top edge back towards the driver; towards its ends it
  // reaches less far and comes down to the deck, and cheeks close the tub at the sides.
  {
    const prof = [[0, 0], [-0.004, 0.016], [-0.028, 0.031], [-0.072, 0.032], [-0.094, 0.022], [-0.097, 0.011], [-0.086, 0.008], [-0.03, 0.012], [-0.006, 0.004], [0, 0]];
    const A = 0.405, deck = 0.905, end = (a) => smooth(0.30, A, Math.abs(a));
    const hoodAt = (a, dr, dy) => pt(a, y1 + dy - (y1 + 0.012 - deck) * end(a), dr * (1 - 0.7 * end(a)));
    const rows = [];
    for (let j = 0; j <= 64; j++) { const a = -A + 2 * A * j / 64; rows.push(prof.map(([dr, dy]) => hoodAt(a, dr, dy))); }
    P('leather', faceFrom(gridSurface(rows), pt(0, y1 - 0.05, -0.05)));
    // Cheeks: from the face's side edges out to the hood's ends, from the bezel up under the hood.
    for (const sg of [-1, 1]) {
      const cr = [];
      for (let j = 0; j <= 6; j++) {
        const a = sg * (a1 + (A - a1) * j / 6), top = hoodAt(a, -0.006, 0.004).y, row = [];
        for (let i = 0; i <= 6; i++) { const y = y0 - 0.012 + (top - y0 + 0.012) * i / 6; row.push(pt(a, y, 0.002)); }
        cr.push(row);
      }
      P('alcantara', faceFrom(gridSurface(cr), V(...EYE), true));
    }
    // The bezel's lip under the face.
    const low = [];
    for (let j = 0; j <= 48; j++) { const a = -A + 2 * A * j / 48; low.push([pt(a, y0 + 0.003, 0.002), pt(a, y0 - 0.006, -0.012), pt(a, y0 - 0.016, -0.014), pt(a, y0 - 0.028, 0.004)]); }
    P('alcantara', faceFrom(gridSurface(low), V(...EYE), true));
  }
  // The tachometer: a round instrument in the middle, its bezel standing proud of the screens.
  const c = pt(0, (y0 + y1) / 2, -0.006);
  const tach = new THREE.Group();
  tach.name = 'gt3-tachometer';
  tach.position.copy(c);
  // Facing the driver: local +Z towards the eye.
  tach.lookAt(V(...EYE));
  const face = remapUV(new THREE.CircleGeometry(0.049, 48), DIAL_UV.tach);
  tach.add(mesh(face, M.gt3cTach, { name: 'gt3-tach-face', castShadow: false }));
  const ring = new THREE.TorusGeometry(0.0505, 0.004, 8, 48);
  ring.translate(0, 0, 0.002);
  tach.add(mesh(ring, M.gt3cBlack, { name: 'gt3-tach-bezel', castShadow: false }));
  const cup = new THREE.CylinderGeometry(0.054, 0.054, 0.022, 48, 1, true);
  cup.rotateX(Math.PI / 2); cup.translate(0, 0, -0.0115);
  tach.add(mesh(cup, M.gt3cGloss, { name: 'gt3-tach-cup', castShadow: false }));
  const needle = new THREE.Group();
  needle.name = 'gt3-tach-needle';
  needle.position.z = 0.004;
  // The blade: a strip of the digits' canvas painted yellow (one material for the needle and the digits).
  const digits = digitsDisplay();
  if (digits) needle.add(mesh(digits.uv(new THREE.PlaneGeometry(0.0036, 0.044).translate(0, 0.016, 0), 'needle'), digits.material, { name: 'gt3-tach-needle-blade', castShadow: false }));
  needle.add(mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 20).rotateX(Math.PI / 2), M.gt3cBlack, { name: 'gt3-tach-hub', castShadow: false }));
  tach.add(needle);
  // The gear over the needle's hub and the speed in the gap at the dial's foot, drawn live.
  if (digits) {
    tach.add(mesh(digits.uv(new THREE.PlaneGeometry(0.016, 0.016).translate(0, 0.019, 0.003), 'gear'), digits.material, { name: 'gt3-tach-gear', castShadow: false }));
    tach.add(mesh(digits.uv(new THREE.PlaneGeometry(0.030, 0.015).translate(0, -0.033, 0.003), 'speed'), digits.material, { name: 'gt3-tach-speed', castShadow: false }));
  }
  g.add(tach);
  return { needle, digits };
}
/**
 * One small canvas, redrawn when the gear or the speed changes: the gear (x 0–128, y 0–128), the
 * speed (y 128–256) and a yellow strip for the needle's blade (x 224–256, y 0–96).
 */
function digitsDisplay() {
  if (typeof document === 'undefined') return null;
  try {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    if (!x) return null;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    x.fillStyle = '#ffd23a'; x.fillRect(224, 0, 32, 96);
    const R = { gear: [0, 0, 128, 128], speed: [0, 128, 256, 128], needle: [228, 8, 24, 80] };
    const uv = (geo, k) => {
      const [x0, y0, w, h] = R[k];
      return remapUV(geo, (u, v) => [(x0 + u * w) / 256, 1 - (y0 + (1 - v) * h) / 256]);
    };
    let last = '';
    const draw = (gear, kmh) => {
      const key = `${gear}|${kmh}`;
      if (key === last) return;
      last = key;
      x.clearRect(0, 0, 128, 128); x.clearRect(0, 128, 256, 128);
      x.fillStyle = '#f4f6f8'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '700 104px sans-serif'; x.fillText(String(gear), 64, 68);
      x.font = '600 84px sans-serif'; x.fillText(String(kmh), 128, 178);
      x.font = '26px sans-serif'; x.fillStyle = '#9aa3ab'; x.fillText('km/h', 128, 236);
      tex.needsUpdate = true;
    };
    draw('N', 0);
    return { material, uv, draw };
  } catch { return null; }
}
/** The centre stack and the console down to the armrest. */
function centreStack(P) {
  // The touchscreen in its gloss surround, flush with the face.
  P('gloss', at(roundBox(0.014, 0.106, 0.262, 0.005), 0.416, 0.816, 0.045, 0, 0, 0.05));
  // Turned to face the driver, then leaned back with the surround (an Euler would spin it in its own
  // plane); just proud of the surround, whose bevel stands ≈5 mm out of its nominal box.
  P('screen', remapUV(new THREE.PlaneGeometry(0.245, 0.095), SCREEN_UV.centre).rotateY(-Math.PI / 2).rotateZ(0.05).translate(0.4025, 0.817, 0.045));
  // The carbon strip under it, the five toggles, the vents.
  P('carbon', at(roundBox(0.014, 0.016, 0.30, 0.004), 0.422, 0.755, 0.045));
  for (let k = -2; k <= 2; k++) {
    P('gloss', at(box(0.012, 0.014, 0.022), 0.421, 0.738, 0.045 + k * 0.032));
    P('alu', at(box(0.010, 0.003, 0.014), 0.414, 0.741, 0.045 + k * 0.032, 0, 0, -0.5));
  }
  for (const z of [-0.025, 0.115]) {
    P('gloss', at(roundBox(0.014, 0.036, 0.12, 0.006), 0.424, 0.700, z));
    for (let k = 0; k < 3; k++) P('black', at(box(0.02, 0.003, 0.108), 0.419, 0.689 + k * 0.011, z));
  }
  // The console: a carbon body from the face down to the tunnel, the gloss top over it.
  const side = new THREE.Shape([[0.442, 0.665], [0.40, 0.655], [0.20, 0.555], [0.03, 0.505], [-0.12, 0.49], [-0.12, 0.23], [0.55, 0.23], [0.52, 0.60]].map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.ExtrudeGeometry(side, { depth: 0.23, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6 });
  body.translate(0, 0, -0.115 + 0.045);
  P('carbon', body);
  // The gloss top: three plates following the slope, the selector's surround in the middle.
  const plate = (x0, y0, x1, y1, w) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    return at(roundBox(len, 0.008, w, 0.003), (x0 + x1) / 2, (y0 + y1) / 2 + 0.012, 0.045, 0, 0, ang);
  };
  P('gloss', plate(0.43, 0.664, 0.33, 0.62, 0.20));
  P('gloss', plate(0.33, 0.62, 0.14, 0.535, 0.21));
  P('gloss', plate(0.14, 0.535, -0.11, 0.497, 0.22));
  // Buttons either side of the selector, and the starter.
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P('black', at(box(0.022, 0.010, 0.026), 0.385 - k * 0.032, 0.660 - k * 0.015, 0.045 + s * 0.068, 0, 0, 0.42));
  // The selector: a short stick in its Alcantara boot, the knob on top (the PDK's, shaped like a gearstick's).
  {
    const sx = 0.255, sy = 0.600, sz = 0.045;
    P('gloss', at(roundBox(0.12, 0.012, 0.10, 0.006), sx, sy - 0.004, sz, 0, 0, 0.42));
    const boot = new THREE.LatheGeometry([[0.044, 0], [0.042, 0.012], [0.032, 0.035], [0.020, 0.062], [0.013, 0.085], [0.011, 0.09]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    P('alcantara', at(boot, sx, sy, sz, 0, 0, 0.28));
    const tip = [Math.sin(-0.28) * 0.10, Math.cos(0.28) * 0.10];
    const knob = new THREE.LatheGeometry([[0, 0], [0.018, 0.004], [0.026, 0.022], [0.028, 0.040], [0.024, 0.056], [0.012, 0.064], [0, 0.066]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
    P('black', at(knob, sx + tip[0], sy + tip[1] - 0.012, sz, 0, 0, 0.28));
    P('alu', at(new THREE.CylinderGeometry(0.0125, 0.0125, 0.003, 24), sx + tip[0] - 0.0185, sy + tip[1] + 0.051, sz, 0, 0, 0.28));
  }
  // The tray in the tunnel and the armrest between the seats.
  P('black', at(roundBox(0.12, 0.012, 0.13, 0.008), 0.03, 0.513, 0.045, 0, 0, 0.12));
  P('alcantara', at(cushion(0.34, 0.07, 0.17, { e1: 0.3, e2: 0.35, puff: 0.15 }), -0.30, 0.575, 0.0));
  P('carbon', at(roundBox(0.34, 0.11, 0.15, 0.02), -0.30, 0.49, 0.0));
}
/** The GT steering wheel, built facing the driver (axis along −X), tilted and placed. */
function steeringWheel(M) {
  const w = new THREE.Group();
  w.name = 'gt3-steering-wheel';
  const parts = { alcantara: [], black: [], yellow: [], gloss: [], alu: [], red: [] };
  const P = (k, geo) => parts[k].push({ geometry: geo });
  // In the wheel's own frame: X along its axis (towards the dash), Y up, Z across.
  // The rim: an oval section (a little deeper than thick), the yellow band at twelve o'clock.
  {
    const rim = new THREE.TorusGeometry(WHEEL.R, WHEEL.tube, 14, 96);
    rim.scale(1, 1, 0.82); rim.rotateY(Math.PI / 2);
    P('alcantara', rim);
    const band = new THREE.TorusGeometry(WHEEL.R, WHEEL.tube * 1.04, 14, 8, 0.11);
    band.scale(1, 1, 0.82); band.rotateZ(Math.PI / 2 - 0.055); band.rotateY(Math.PI / 2);
    P('yellow', band);
  }
  // The hub: the airbag's cover, its housing behind.
  P('black', at(cushion(0.050, 0.112, 0.124, { e1: 0.5, e2: 0.62, puff: 0 }), 0.012, 0.004, 0));
  P('black', at(cushion(0.020, 0.104, 0.114, { e1: 0.45, e2: 0.6, puff: 0.1 }), -0.016, 0.006, 0));
  // Side spokes with their button pods; the lower spoke in two arms.
  for (const s of [-1, 1]) {
    P('alcantara', at(cushion(0.030, 0.040, 0.10, { e1: 0.4, e2: 0.4 }), 0.004, -0.012, s * 0.108));
    P('black', at(cushion(0.016, 0.034, 0.05, { e1: 0.35, e2: 0.3 }), -0.012, -0.004, s * 0.088));
    for (let k = 0; k < 3; k++) P('gloss', at(box(0.006, 0.008, 0.011), -0.021, 0.004 - k * 0.012, s * (0.074 + (k % 2) * 0.014)));
    // The arms of the lower spoke, from the hub's foot to the rim.
    const arm = new THREE.CatmullRomCurve3([V(0.006, -0.052, s * 0.040), V(0.004, -0.10, s * 0.028), V(0.0, -0.150, s * 0.018)]);
    P('alcantara', ovalTube(arm, 0.012, 0.016, 10, 10));
    // Two rotary switches each side under the hub (drive mode, the dampers, the traction control, PTV).
    for (const [y, z] of [[-0.058, 0.064], [-0.096, 0.050]]) {
      const knob = new THREE.CylinderGeometry(0.0115, 0.0125, 0.012, 24);
      knob.rotateZ(Math.PI / 2);
      P('black', at(knob, -0.012, y, s * z));
      P(y < -0.07 && s < 0 ? 'red' : 'alu', at(new THREE.TorusGeometry(0.0118, 0.0012, 4, 24).rotateY(Math.PI / 2), -0.0185, y, s * z));
    }
  }
  // The shift paddles behind the side spokes, the column into the dash.
  for (const s of [-1, 1]) P('black', at(roundBox(0.006, 0.075, 0.075, 0.01), 0.038, 0.02, s * 0.13, 0, 0, 0));
  const col = new THREE.CylinderGeometry(0.03, 0.04, 0.26, 18);
  col.rotateZ(Math.PI / 2); col.translate(0.15, 0, 0);
  P('black', col);
  P('black', at(cushion(0.12, 0.07, 0.10, { e1: 0.35, e2: 0.4 }), 0.09, -0.005, 0));
  const MAT = { alcantara: M.gt3cAlcantara, black: M.gt3cBlack, yellow: M.gt3cYellow, gloss: M.gt3cGloss, alu: M.gt3cAlu, red: M.gt3cRed };
  for (const [k, list] of Object.entries(parts)) if (list.length) w.add(mesh(mergeAll(list), MAT[k], { name: `gt3-wheel-${k}` }));
  // The column stalks stay put; the wheel turns about its own axis inside a tilted holder.
  const holder = new THREE.Group();
  holder.name = 'gt3-steering';
  holder.position.set(WHEEL.x, WHEEL.y, WHEEL.z);
  // Axis along −X towards the driver, leaning up by the tilt.
  holder.rotation.set(0, 0, -WHEEL.tilt, 'YXZ');
  holder.add(w);
  for (const s of [-1, 1]) {
    const stalk = new THREE.CylinderGeometry(0.006, 0.008, 0.11, 10);
    stalk.rotateX(Math.PI / 2 * s * 0.9); stalk.translate(0.07, 0.035, s * 0.07);
    holder.add(mesh(stalk, M.gt3cBlack, { name: `gt3-stalk-${s > 0 ? 'r' : 'l'}` }));
  }
  return { holder, wheel: w };
}
/**
 * A carbon full bucket seat lofted along its spine (seat-local: ξ forward, η up, across ζ; the
 * crease between cushion and backrest at the origin), placed at (x, y, z). Recline ≈22°.
 */
function bucketSeat(M, x, y, z, side) {
  const g = new THREE.Group();
  g.name = `gt3-seat-${side > 0 ? 'r' : 'l'}`;
  const recline = 22 * Math.PI / 180;
  const up = [-Math.sin(recline), Math.cos(recline)];
  const spineKeys = [[0.47, 0.075], [0.40, 0.050], [0.22, 0.025], [0.08, 0.008], [0, 0]];
  for (const L of [0.10, 0.25, 0.40, 0.55, 0.66, 0.76, 0.84]) spineKeys.push([up[0] * L, up[1] * L]);
  // The headrest's top rolls forward over the head.
  spineKeys.push([up[0] * 0.885 + 0.02, up[1] * 0.885], [up[0] * 0.90 + 0.05, up[1] * 0.90 - 0.005]);
  const spine = new THREE.CatmullRomCurve3(spineKeys.map(([a, b]) => V(a, b, 0)), false, 'centripetal');
  const length = spine.getLength();
  // Where along the spine (metres from the front lip) the crease and each band of the back lie.
  const sCrease = (() => { let best = 0, bd = Infinity; for (let i = 0; i <= 400; i++) { const p = spine.getPointAt(i / 400); const d = Math.hypot(p.x, p.y); if (d < bd) { bd = d; best = i / 400; } } return best * length; })();
  const L = (s) => s - sCrease;                               // metres up the back (negative: on the cushion)
  // Width between the bolsters' crests, and their height, along the spine.
  const halfWk = curve([[-0.60, 0.245], [-0.20, 0.255], [0, 0.26], [0.30, 0.262], [0.50, 0.25], [0.62, 0.236], [0.74, 0.232], [0.79, 0.21], [0.84, 0.18], [0.88, 0.15], [0.91, 0.12], [0.94, 0.06], [0.96, 0.015]]);
  const bolsterK = curve([[-0.60, 0.085], [-0.30, 0.066], [-0.10, 0.058], [0.05, 0.08], [0.20, 0.104], [0.40, 0.086], [0.58, 0.062], [0.75, 0.05], [0.90, 0.035], [0.96, 0.0]]);
  const halfW = (s) => halfWk(L(s)), bolster = (s) => bolsterK(L(s));
  const hole = (u, l) => (l > 0.625 && l < 0.725) && (Math.abs(u) < 0.17 || (Math.abs(u) > 0.30 && Math.abs(u) < 0.66));
  const NS = 110;
  const frame = (s) => {
    const t = Math.min(1, Math.max(0, s / length));
    const p = spine.getPointAt(t), tg = spine.getTangentAt(t);
    // Normal into the occupant: the tangent turned a quarter (cushion: up; back: forward).
    const n = V(-tg.y, tg.x, 0);
    if (n.y < 0 && L(s) < 0.1) n.negate();
    if (L(s) > 0.1 && n.x < 0) n.negate();
    return { p, n };
  };
  const toCar = (p) => V(x + p.x, y + p.y, z + p.z * side);
  const surfPt = (s, u, lift = 0) => {
    const { p, n } = frame(s), W = halfW(s), au = Math.abs(u), B = bolster(s);
    const h = B * (smooth(0.52, 0.86, au) - 0.55 * smooth(0.90, 1.0, au)) - 0.012 * (1 - u * u) + (au > 0.49 && au < 0.53 ? -0.006 : 0) + lift;
    return toCar(V(p.x + n.x * h, p.y + n.y * h, W * u));
  };
  // Padding: black bolsters and the red centre, the cut-out band left open.
  const bands = [[0, sCrease + 0.62], [sCrease + 0.735, length]];
  const pad = { red: [], black: [] };
  for (const [s0, s1] of bands) {
    const rowsR = [], rowsLo = [], rowsHi = [];
    const n = Math.max(6, Math.round((s1 - s0) / length * NS));
    for (let i = 0; i <= n; i++) {
      const s = s0 + (s1 - s0) * i / n;
      rowsR.push(Array.from({ length: 17 }, (_, j) => surfPt(s, -0.5 + j / 16)));
      rowsLo.push(Array.from({ length: 13 }, (_, j) => surfPt(s, -1 + 0.5 * j / 12)));
      rowsHi.push(Array.from({ length: 13 }, (_, j) => surfPt(s, 0.5 + 0.5 * j / 12)));
    }
    const behind = toCar(V(-0.35, -0.35, 0));
    pad[L(s0) < 0.7 ? 'red' : 'black'].push(faceFrom(gridSurface(rowsR), behind));
    pad.black.push(faceFrom(gridSurface(rowsLo), behind), faceFrom(gridSurface(rowsHi), behind));
  }
  // The shell: a carbon U behind the padding, rolling over its edges, with the cut-outs.
  const shellRows = [];
  const NSh = NS;
  const ring = (s) => {
    const { p, n } = frame(s), W = halfW(s) + 0.022, B = bolster(s) * 0.45;
    const pts = [];
    const across = [[-1, B + 0.012], [-1.04, B - 0.01], [-1.06, -0.03], [-0.92, -0.065], [-0.6, -0.078], [0, -0.082], [0.6, -0.078], [0.92, -0.065], [1.06, -0.03], [1.04, B - 0.01], [1, B + 0.012]];
    for (const [u, h] of across) pts.push(toCar(V(p.x + n.x * h, p.y + n.y * h, W * u)));
    return pts;
  };
  for (let i = 0; i <= NSh; i++) shellRows.push(ring(length * i / NSh));
  const shell = gridSurface(shellRows);
  // Cut-outs: drop the shell's faces in the holes (they show through the open band).
  {
    const ix = shell.index.array, keep = [], per = 11;
    for (let k = 0; k < ix.length; k += 3) {
      const i = Math.floor(ix[k] / per), j = ix[k] % per;
      const s = length * (i + 0.5) / NSh, u = [-1, -1.04, -1.06, -0.92, -0.6, 0, 0.6, 0.92, 1.06, 1.04, 1][Math.min(per - 1, j)];
      if (hole(u * 0.9, L(s)) && j > 2 && j < 8) continue;
      keep.push(ix[k], ix[k + 1], ix[k + 2]);
    }
    shell.setIndex(keep);
  }
  // A carbon plate across the open band (its frame round the holes): the padding's absent there.
  const band = [];
  {
    const s0 = sCrease + 0.615, s1 = sCrease + 0.74, rows = [];
    for (let i = 0; i <= 16; i++) {
      const s = s0 + (s1 - s0) * i / 16, row = [];
      for (let j = 0; j <= 40; j++) row.push(surfPt(s, -1 + 2 * j / 40, -0.03));
      rows.push(row);
    }
    const plate = gridSurface(rows), ix = plate.index.array, keep = [];
    for (let k = 0; k < ix.length; k += 6) {
      const a = ix[k], i = Math.floor(a / 41), j = a % 41;
      const s = s0 + (s1 - s0) * (i + 0.5) / 16, u = -1 + 2 * (j + 0.5) / 40;
      if (hole(u, L(s))) continue;
      keep.push(...ix.slice(k, k + 6));
    }
    plate.setIndex(keep);
    band.push(plate);
  }
  // The front lip and the headrest's top: closing caps between the padding and the shell.
  const caps = [];
  for (const s of [0.0005, length - 0.0005]) {
    const outer = ring(s), inner = Array.from({ length: 21 }, (_, j) => surfPt(s, -1 + 2 * j / 20));
    const c = inner.reduce((m, q) => m.add(q), V(0, 0, 0)).multiplyScalar(1 / inner.length).lerp(outer[5], 0.5);
    const loop = [...inner, ...outer.slice().reverse()];
    const pos = [];
    for (let k = 0; k < loop.length; k++) { const a = loop[k], b = loop[(k + 1) % loop.length]; pos.push(c.x, c.y, c.z, a.x, a.y, a.z, b.x, b.y, b.z); }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.computeVertexNormals();
    caps.push(cg);
  }
  // The caps come unindexed, the rest indexed: merged flat.
  const flat = (geo) => ({ geometry: geo.index ? geo.toNonIndexed() : geo });
  g.add(mesh(mergeAll([shell, ...band, ...caps].map(flat)), M.gt3cCarbon, { name: `${g.name}-shell` }));
  g.add(mesh(mergeAll(pad.red.map(geometry => ({ geometry }))), M.gt3cSeatRed, { name: `${g.name}-centre` }));
  g.add(mesh(mergeAll(pad.black.map(geometry => ({ geometry }))), M.gt3cLeather, { name: `${g.name}-bolsters` }));
  // The belt: over the outer shoulder, across the chest to the buckle by the tunnel; the lap belt.
  {
    const path = (pts) => pts.map(([s, u]) => surfPt(s, u, 0.006));
    const shoulder = [];
    for (let k = 0; k <= 16; k++) { const f = k / 16; shoulder.push([sCrease + 0.80 - 0.74 * f, (side > 0 ? 1 : -1) * (0.62 - 1.45 * f)]); }
    const lap = [];
    for (let k = 0; k <= 10; k++) { const f = k / 10; lap.push([sCrease - 0.045, (side > 0 ? 1 : -1) * (0.95 - 1.80 * f)]); }
    const ribbon = (pts, wid) => {
      const P3 = path(pts), rows = [[], []];
      for (let i = 0; i < P3.length; i++) {
        const a = P3[Math.max(0, i - 1)], b = P3[Math.min(P3.length - 1, i + 1)], d = b.clone().sub(a).normalize();
        const s = pts[i][0], { n } = frame(s), across = V(n.x, n.y, 0).cross(d).normalize().multiplyScalar(wid / 2);
        rows[0].push(P3[i].clone().add(across)); rows[1].push(P3[i].clone().sub(across));
      }
      return gridSurface([rows[0], rows[1]]);
    };
    const belts = [ribbon(shoulder, 0.048), ribbon(lap, 0.048)];
    g.add(mesh(mergeAll(belts.map(geometry => ({ geometry }))), M.gt3cRed, { name: `${g.name}-belt`, castShadow: false }));
    const buckle = surfPt(sCrease + 0.02, (side > 0 ? 1 : -1) * -1.02, 0.02);
    g.add(mesh(at(roundBox(0.06, 0.026, 0.02, 0.006), buckle.x, buckle.y, buckle.z, 0, 0, 0.3), M.gt3cAlu, { name: `${g.name}-buckle` }));
  }
  // The rails and the frame under the shell.
  const rails = [];
  for (const s of [-1, 1]) rails.push({ geometry: at(roundBox(0.46, 0.03, 0.03, 0.006), x + 0.12, 0.245, z + s * 0.18) });
  g.add(mesh(mergeAll(rails), M.gt3cBlack, { name: `${g.name}-rails` }));
  return g;
}
/** A door card on side sd (−1 the driver's): capping, panel, insert, armrest, strap, switches. */
function doorCard(P, sd) {
  const zIn = sd * 0.772;
  // The panel: a slab following the door from the A-pillar's foot to the B-pillar.
  const outline = [[-0.47, 0.30], [0.60, 0.30], [0.64, 0.52], [0.62, 0.87], [-0.47, 0.875]];
  const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const panel = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  panel.translate(0, 0, sd > 0 ? 0 : -0.03);
  panel.translate(0, 0, zIn + sd * 0.006);
  P('alcantara', panel);
  // The leather capping along the beltline.
  const cap = new THREE.CatmullRomCurve3([V(-0.47, 0.872, zIn - sd * 0.008), V(0.10, 0.876, zIn - sd * 0.012), V(0.62, 0.866, zIn - sd * 0.006)]);
  P('leather', ovalTube(cap, 0.018, 0.022, 24, 10));
  // The perforated insert in the lower half, its red behind the holes.
  P('mesh', at(new THREE.PlaneGeometry(0.62, 0.21), 0.05, 0.43, zIn - sd * 0.0035, 0, sd > 0 ? Math.PI : 0, 0));
  P('leather', at(roundBox(0.66, 0.012, 0.012, 0.004), 0.05, 0.545, zIn - sd * 0.006));
  // The armrest: a long bar sweeping up to the pull's recess at the front.
  const arm = new THREE.CatmullRomCurve3([V(-0.40, 0.62, zIn - sd * 0.035), V(-0.05, 0.625, zIn - sd * 0.045), V(0.22, 0.66, zIn - sd * 0.04), V(0.40, 0.76, zIn - sd * 0.025)]);
  P('alcantara', ovalTube(arm, 0.028, 0.03, 30, 12));
  // The red pull strap in the recess at the front, the window switches on the armrest.
  P('black', at(roundBox(0.11, 0.07, 0.02, 0.012), 0.36, 0.765, zIn - sd * 0.008));
  const strap = new THREE.CatmullRomCurve3([V(0.32, 0.79, zIn - sd * 0.012), V(0.35, 0.745, zIn - sd * 0.03), V(0.39, 0.74, zIn - sd * 0.03), V(0.41, 0.785, zIn - sd * 0.012)]);
  P('red', ovalTube(strap, 0.004, 0.014, 16, 8));
  P('gloss', at(roundBox(0.09, 0.012, 0.045, 0.006), -0.18, 0.648, zIn - sd * 0.05));
  for (const k of [0, 1]) P('black', at(box(0.022, 0.008, 0.016), -0.20 + k * 0.035, 0.656, zIn - sd * 0.05));
  // The speaker's grille low at the front.
  P('black', at(new THREE.CircleGeometry(0.06, 32), 0.48, 0.42, zIn - sd * 0.002, 0, sd > 0 ? Math.PI : 0, 0));
}
/** The roll cage: the main hoop behind the seats with its cross, the harness bar, the stays aft. */
function rollCage(M) {
  const tubes = [];
  const tube = (pts, r = 0.02) => tubes.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), 20, r, 10) });
  const X = -0.74;
  tube([[X, 0.24, -0.62], [X, 0.70, -0.64], [X - 0.01, 1.0, -0.63], [X - 0.02, 1.15, -0.47], [X - 0.02, 1.19, 0], [X - 0.02, 1.15, 0.47], [X - 0.01, 1.0, 0.63], [X, 0.70, 0.64], [X, 0.24, 0.62]]);
  tube([[X, 0.28, -0.60], [X - 0.02, 1.14, 0.44]], 0.019);
  tube([[X, 0.28, 0.60], [X - 0.02, 1.14, -0.44]], 0.019);
  tube([[X, 0.66, -0.635], [X, 0.66, 0.635]], 0.018);
  for (const sd of [-1, 1]) tube([[X - 0.02, 1.15, sd * 0.47], [X - 0.30, 1.05, sd * 0.52], [X - 0.62, 0.86, sd * 0.56]], 0.019);
  // The base plates where it bolts to the floor.
  for (const sd of [-1, 1]) tubes.push({ geometry: at(box(0.09, 0.008, 0.09), X, 0.236, sd * 0.62) });
  return mesh(mergeAll(tubes), M.gt3cCage, { name: 'gt3-roll-cage' });
}

export function buildCabin(M) {
  cabinMaterials(M);
  const g = new THREE.Group();
  g.name = 'gt3-cabin';
  const parts = { alcantara: [], leather: [], carbon: [], gloss: [], black: [], alu: [], red: [], carpet: [], mesh: [], screen: [] };
  const P = (k, geo) => parts[k].push({ geometry: geo });
  dashboard(P);
  const { needle, digits } = cluster(P, g, M);
  centreStack(P);
  // The stopwatch on the dash's top, turned towards the driver.
  {
    const pod = new THREE.Group();
    pod.name = 'gt3-stopwatch';
    pod.position.set(0.63, 0.925, 0.0);
    pod.lookAt(V(...EYE).add(V(0, 0.25, 0)));
    pod.add(mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.05, 32).rotateX(Math.PI / 2).translate(0, 0, -0.022), M.gt3cBlack, { name: 'gt3-stopwatch-pod' }));
    pod.add(mesh(remapUV(new THREE.CircleGeometry(0.038, 40), DIAL_UV.clock).translate(0, 0, 0.0035), M.gt3cClock, { name: 'gt3-stopwatch-face', castShadow: false }));
    pod.add(mesh(new THREE.TorusGeometry(0.041, 0.004, 6, 40).translate(0, 0, 0.003), M.gt3cAlu, { name: 'gt3-stopwatch-ring', castShadow: false }));
    g.add(pod);
    P('black', at(roundBox(0.06, 0.03, 0.07, 0.01), 0.635, 0.905, 0.0));
  }
  const { holder, wheel } = steeringWheel(M);
  g.add(holder);
  for (const sd of [-1, 1]) doorCard(P, sd);
  // Floor, mats, the footwell's wall, the sills, the pedals and the footrest.
  P('carpet', at(roundBox(1.50, 0.03, 1.50, 0.01), -0.06, 0.215, 0));
  for (const z of [DZ, PZ]) P('carpet', at(roundBox(0.46, 0.008, 0.40, 0.004), 0.47, 0.233, z));
  {
    const wall = new THREE.Shape([[0.78, 0.23], [0.86, 0.23], [0.86, 0.56], [0.70, 0.56], [0.66, 0.40]].map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(wall, { depth: 1.50, bevelEnabled: false });
    geo.translate(0, 0, -0.75);
    P('carpet', geo);
  }
  for (const sd of [-1, 1]) {
    P('black', at(roundBox(1.12, 0.10, 0.06, 0.02), 0.08, 0.275, sd * 0.745));
    P('alu', at(box(0.90, 0.004, 0.05), 0.06, 0.327, sd * 0.745));
  }
  // The accelerator hinged on the floor, the brake hanging from above, the footrest by the wall.
  P('alu', at(roundBox(0.010, 0.17, 0.055, 0.005), 0.71, 0.33, DZ + 0.10, 0, 0, -0.55));
  P('alu', at(roundBox(0.010, 0.06, 0.085, 0.006), 0.67, 0.37, DZ - 0.04, 0, 0, -0.30));
  P('black', at(new THREE.CylinderGeometry(0.007, 0.007, 0.22).rotateZ(0.5), 0.72, 0.47, DZ - 0.04));
  P('carpet', at(roundBox(0.012, 0.14, 0.075, 0.005), 0.72, 0.34, DZ - 0.20, 0, 0, -0.75));
  // The rear compartment: no rear seats on the RS; its floor and the engine's bulkhead.
  P('carpet', at(roundBox(0.62, 0.30, 1.40, 0.04), -1.12, 0.37, 0));
  P('carpet', at(roundBox(0.05, 0.40, 1.30, 0.02), -1.42, 0.70, 0, 0, 0, 0.35));
  // The mirror on the windscreen (the visors lie folded against the headliner, out of sight).
  P('black', at(cushion(0.02, 0.05, 0.19, { e1: 0.35, e2: 0.3 }), 0.29, 1.165, 0.0, 0, 0, 0.6));
  P('black', at(new THREE.CylinderGeometry(0.007, 0.009, 0.05), 0.31, 1.19, 0.0, 0, 0, 0.9));
  // The seats and the cage.
  g.add(bucketSeat(M, -0.16, 0.30, DZ, -1), bucketSeat(M, -0.16, 0.30, PZ, 1));
  g.add(rollCage(M));
  const MAT = {
    alcantara: M.gt3cAlcantara, leather: M.gt3cLeather, carbon: M.gt3cCarbon, gloss: M.gt3cGloss, black: M.gt3cBlack,
    alu: M.gt3cAlu, red: M.gt3cRed, carpet: M.gt3cCarpet, mesh: M.gt3cDoorMesh, screen: M.gt3cScreen,
  };
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    // Extrusions come unindexed, the rest indexed: merge each kind separately.
    const idx = list.filter(o => o.geometry.index), flat = list.filter(o => !o.geometry.index);
    if (idx.length) g.add(mesh(mergeAll(idx.map(o => ({ geometry: o.geometry.toNonIndexed() }))), MAT[k], { name: `gt3-cabin-${k}`, castShadow: k !== 'screen' }));
    if (flat.length) g.add(mesh(mergeAll(flat), MAT[k], { name: `gt3-cabin-${k}-x`, castShadow: k !== 'screen' }));
  }
  // Live instruments: the needle over 300° (0 to 10,000 /min), the digits, the wheel at 14.1:1.
  const A0 = 0.68 * Math.PI, SPAN = 1.64 * Math.PI;
  g.userData.instruments = {
    update({ rpm = 0, gear = 'N', kmh = 0, steer = 0 } = {}) {
      // The dial's angles run clockwise on the canvas from its +X; the needle is drawn along +Y.
      // A canvas angle a (clockwise, y down) is the direction (cos a, −sin a) on the face; the blade's +Y turned by −(a + π/2) points there.
      needle.rotation.z = -(A0 + SPAN * Math.min(1, Math.max(0, rpm / 10000)) + Math.PI / 2);
      digits?.draw(gear, Math.round(kmh));
      wheel.rotation.x = steer * STEERING_RATIO;
    },
  };
  g.userData.instruments.update({ rpm: 0 });
  return g;
}
