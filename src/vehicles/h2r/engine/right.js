/**
 * The engine's right side, traced in millimetres on the right-side photograph (parts.js's grid) and
 * detailed on the photographs of the bike without its bodywork (Wikimedia Commons, "Kawasaki Ninja
 * H2R exposd right front", "… exposed top right"; reference only):
 *  - the clutch cover, dark satin: its outline; the clutch's drum standing out of it (r ≈0.099 m
 *    at its foot, its face r 0.071 m) with the flat facet cut across the face's upper rear; the
 *    pickup's round cover (r 0.035 m) let into it, its rim a fine groove and a hole in its centre;
 *    the oil filler's silver plug; the gold drain plug at its foot; the silver flanged bolts round
 *    its edge, each on its boss;
 *  - above it, the cast upper case's side, bare aluminium, with the "SUPER CHARGED" emblem in its
 *    ring (Kawasaki's own marking on the engine, as on the bike);
 *  - below it, the lower case's cast side with its ribs and bolts, and the oil cooler's fins.
 * Depths across the bike ≈.
 */
import * as THREE from 'three';
import { mergeAll, mesh, TAU, canvasTexture } from '../geometry.js';
import { mm, ext, turned, bolt, capScrew, inset, alongOutline } from './parts.js';

const ZC = 0.15;          // the crankcase's right face
const DRUM = [-0.028, 0.475], PICKUP = [0.0985, 0.425], FILLER = [0.0556, 0.538], DRAIN = [-0.051, 0.324];
const COVER = mm([[-144.4, 315.6], [-127.8, 298.9], [-61.1, 298.9], [-22.2, 307.2], [0, 329.4], [50, 350], [133.3, 351.7], [180, 362.8],
  [190, 404.4], [190, 448.9], [178, 482.2], [133.3, 537.8], [88.9, 573.9], [33.3, 582.2], [-33.3, 581.1], [-83.3, 571.1], [-119.4, 548.9], [-138.9, 515.6], [-144.4, 471.1]]);
const UPPER = mm([[-139, 575], [25, 575], [25, 600], [-4, 628], [-40, 668], [-70, 676], [-112, 668], [-130, 640], [-139, 600]]);
const LOWER = mm([[-60, 263], [3, 243], [80, 243], [93, 253], [107, 340], [100, 357], [40, 353], [17, 343], [-3, 323], [-47, 297], [-67, 283]]);

/** "SUPER CHARGED" in silver on the emblem's black disc (≈ the photographs' lettering). */
function emblemTexture() {
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#0c0c0d'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 70, 0, 190); g.addColorStop(0, '#f2f3f4'); g.addColorStop(0.5, '#9a9ea3'); g.addColorStop(1, '#e6e8ea');
    c.fillStyle = g; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'italic 700 46px "Arial Black", Arial, sans-serif'; c.fillText('SUPER', w / 2, h / 2 - 26);
    c.font = 'italic 700 40px "Arial Black", Arial, sans-serif'; c.fillText('CHARGED', w / 2, h / 2 + 24);
    c.fillRect(w * 0.2, h / 2 - 1.5, w * 0.6, 3);
  });
}

/** The clutch's face: the disc less its facet (the region past the polyline across its upper rear). */
function faceShape(r) {
  // (The facet's edge, traced, relative to the drum's centre: from the rim at 110.7° in to the
  // middle and back out to the rim at 195.2°.)
  const P = mm([[-24.8, 65.6], [-16.4, 25], [-49.8, -12.2], [-72, -19.5]]);
  const a0 = Math.atan2(P[0][1], P[0][0]), a1 = Math.atan2(P[3][1], P[3][0]) + TAU;
  const pts = [];
  // Round the rim from the facet's lower end the long way (anticlockwise) to its upper end…
  for (let k = 0; k <= 64; k++) { const a = a1 + (a0 + TAU - a1) * k / 64; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  // …and back along the facet's edge.
  for (const [x, y] of [P[1], P[2]]) pts.push(new THREE.Vector2(x, y));
  return new THREE.Shape(pts);
}

export function buildRightSide(M) {
  M.h2rCover ??= new THREE.MeshStandardMaterial({ name: 'h2r-engine-cover', color: 0x5a5d63, metalness: 0.3, roughness: 0.46 });
  M.h2rBrass ??= new THREE.MeshStandardMaterial({ name: 'h2r-brass', color: 0xc9a245, metalness: 1, roughness: 0.3 });
  const g = new THREE.Group(); g.name = 'h2r-engine-right';
  const cover = [], cast = [], bright = [], dark = [], brass = [];

  // ---- The clutch cover: its body, rounded at its edge, standing 22 mm off the case.
  cover.push({ geometry: ext(COVER, ZC - 0.004, ZC + 0.022, 0.01, 4) });
  // Each edge bolt on its boss, 9 mm in from the edge.
  for (const [x, y] of alongOutline(inset(COVER, 0.009), 0.047, 0.03)) {
    if (Math.hypot(x - DRUM[0], y - DRUM[1]) < 0.106 || Math.hypot(x - FILLER[0], y - FILLER[1]) < 0.02) continue;
    const boss = new THREE.CylinderGeometry(0.0078, 0.0085, 0.02, 20); boss.rotateX(Math.PI / 2); boss.translate(x, y, ZC + 0.008);
    cover.push({ geometry: boss });
    bright.push({ geometry: bolt(x, y, ZC + 0.018, 1, 0.0042, 0.0045) });
  }
  // The drum, its foot flaring into the cover, its face flat.
  const zf = ZC + 0.017 + 0.032;
  cover.push({ geometry: turned([[0.0995, 0], [0.0992, 0.004], [0.0965, 0.012], [0.091, 0.021], [0.083, 0.027], [0.076, 0.0305], [0.0712, 0.032], [0, 0.032]], DRUM[0], DRUM[1], ZC + 0.017, 1, 128) });
  {
    const f = new THREE.ExtrudeGeometry(faceShape(0.0705), { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1, curveSegments: 8 });
    f.translate(DRUM[0], DRUM[1], zf - 0.0006);
    cover.push({ geometry: f });
    // Two small screws on the face (the photograph's pair, on the facet's side).
    for (const [dx, dy] of mm([[-33, 20], [-6, 48]])) bright.push({ geometry: capScrew(DRUM[0] + dx, DRUM[1] + dy, zf + 0.0024, 1, 0.0028, dark) });
  }
  // The pickup's cover, let in: its face, the fine groove round it, the hole in its middle.
  {
    const [x, y] = PICKUP, z = ZC + 0.022;
    const d = new THREE.CylinderGeometry(0.0345, 0.0345, 0.0016, 72); d.rotateX(Math.PI / 2); d.translate(x, y, z + 0.0008); cover.push({ geometry: d });
    const groove = new THREE.TorusGeometry(0.0352, 0.0009, 6, 96); groove.translate(x, y, z + 0.0002); dark.push({ geometry: groove });
    const hole = new THREE.CylinderGeometry(0.0042, 0.0042, 0.001, 20); hole.rotateX(Math.PI / 2); hole.translate(x, y, z + 0.0013); dark.push({ geometry: hole });
  }
  // The oil filler's plug: a turned silver cap with its hex socket.
  {
    const [x, y] = FILLER;
    bright.push({ geometry: turned([[0.0158, 0], [0.0158, 0.003], [0.0148, 0.0045], [0.0128, 0.0052], [0.0128, 0.0105], [0.0115, 0.0118], [0, 0.0118]], x, y, ZC + 0.021, 1, 48) });
    const s = new THREE.CylinderGeometry(0.0055, 0.0055, 0.001, 6); s.rotateX(Math.PI / 2); s.translate(x, y, ZC + 0.0332); dark.push({ geometry: s });
  }
  // The drain plug, gold, on its washer.
  brass.push({ geometry: bolt(DRAIN[0], DRAIN[1], ZC + 0.02, 1, 0.0085, 0.008) });

  // ---- The upper case's cast side and the emblem's ring, its three bolts.
  cast.push({ geometry: ext(UPPER, 0.09, 0.168, 0.006, 3) });
  const E = [-0.075, 0.632];
  cast.push({ geometry: turned([[0.0322, 0], [0.0322, 0.006], [0.0305, 0.0085], [0.0262, 0.0092], [0.0252, 0.0088], [0.0252, 0.007]], E[0], E[1], 0.168, 1, 72) });
  for (const [x, y] of mm([[-132, 646], [-45, 664], [-106, 610], [10, 592]])) bright.push({ geometry: bolt(x, y, 0.168, 1, 0.0042, 0.005) });
  {
    M.h2rEmblem ??= new THREE.MeshStandardMaterial({ name: 'h2r-emblem', color: 0xffffff, map: emblemTexture(), metalness: 0.6, roughness: 0.35 });
    const disc = new THREE.CircleGeometry(0.0252, 64); disc.translate(E[0], E[1], 0.168 + 0.0071);
    g.add(mesh(disc, M.h2rEmblem, { name: 'h2r-supercharged-emblem' }));
  }

  // ---- The lower case's cast side: its ribs and bolts; the oil cooler's finned core and frame.
  cast.push({ geometry: ext(LOWER, 0.08, 0.158, 0.005, 3) });
  for (const x of [20, 47, 83]) cast.push({ geometry: ext(mm([[x - 2, 255], [x + 2, 255], [x + 2, 338], [x - 2, 338]]), 0.155, 0.162, 0.0012, 1) });
  for (const [x, y] of mm([[10, 340], [60, 355], [80, 338], [55, 330], [130, 358], [-52, 292], [77, 247], [93, 250]])) bright.push({ geometry: bolt(x, y, 0.158, 1, 0.0045, 0.005) });
  {
    const x0 = 0.108, x1 = 0.212, y0 = 0.254, y1 = 0.338, zh = 0.095;
    dark.push({ geometry: ext([[x0, y0], [x1, y0], [x1, y0 + 0.007], [x0, y0 + 0.007]], -zh, zh, 0.0015, 1) });
    dark.push({ geometry: ext([[x0, y1 - 0.007], [x1, y1 - 0.007], [x1, y1], [x0, y1]], -zh, zh, 0.0015, 1) });
    for (const xs of [x0, x1 - 0.006]) dark.push({ geometry: ext([[xs, y0], [xs + 0.006, y0], [xs + 0.006, y1], [xs, y1]], -zh, zh, 0.0015, 1) });
    // The fins: vertical plates 2.6 mm apart, seen edge-on from the side.
    for (let x = x0 + 0.008; x < x1 - 0.007; x += 0.0026) {
      const f = new THREE.BoxGeometry(0.0005, y1 - y0 - 0.014, 2 * zh - 0.006); f.translate(x, (y0 + y1) / 2, 0); dark.push({ geometry: f });
    }
    // Its two oil unions on the right, and their banjo bolts.
    for (const y of [y0 + 0.022, y1 - 0.022]) {
      bright.push({ geometry: turned([[0.009, 0], [0.009, 0.01], [0.0065, 0.012], [0.0065, 0.02], [0, 0.02]], x1 - 0.02, y, zh, 1, 6) });
    }
  }

  g.add(mesh(mergeAll(cover), M.h2rCover, { name: 'h2r-clutch-cover' }));
  g.add(mesh(mergeAll(cast), M.h2rCast, { name: 'h2r-engine-right-castings' }));
  g.add(mesh(mergeAll(bright), M.h2rMachined ?? M.h2rAlu, { name: 'h2r-engine-right-bolts' }));
  g.add(mesh(mergeAll(dark), M.h2rVoid, { name: 'h2r-engine-right-dark' }));
  g.add(mesh(mergeAll(brass), M.h2rBrass, { name: 'h2r-drain-plug' }));
  return g;
}
