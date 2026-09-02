/**
 * Starship (Version 3 / Block 3) — Super Heavy booster + Starship ship, stacked.
 *
 * Verified figures (spacex.com unless noted): stack 124 m, diameter 9 m, booster 72 m,
 * ship 52 m, 33 Raptor on the booster (13 gimballing inner + 20 fixed outer, Wikipedia),
 * 3 Raptor + 3 RVac on the ship, Raptor 1.3 m × 2.9 m, RVac 2.3 m × 4.4 m, steel rings 1.83 m,
 * 3 grid fins in a 90°/90°/180° layout on Block 3 (Wikipedia), ~18 000 hexagonal TPS tiles.
 * Everything else (nose length, flap outlines, chines, raceways, fin size) is approximated.
 */
import * as THREE from 'three';
import { lathe, ogiveProfile, mesh, mergeAll, mat4, hexPrism, tileSurfaceOfRevolution, tilePolygon, profileAt, seeded, plate } from '../geometry/utils.js';
import { raptorGeometry, raptorVacGeometry, instanceEngines, ringLayout } from './engines.js';

const R = 4.5;               // 9 m diameter
const BOOSTER_H = 72;        // spacex.com (V3)
const SHIP_H = 52;           // spacex.com (V3)
const RING = 1.83;           // ring height (Wikipedia)
const TILE_CIRCUMRADIUS = 0.125; // derived: ~18 000 tiles over the windward half → ≈0.22 m flat-to-flat

// ----------------------------------------------------------------------------------------
function gridFin(M, { span = 4.6, chord = 3.0, thickness = 0.5, cells = [7, 5] } = {}) {
  // Lattice fin: frame + vanes. Local frame: +X outward (span), +Z chord, +Y vertical (thickness).
  const parts = [];
  const t = 0.06;
  parts.push({ geometry: new THREE.BoxGeometry(span, thickness, t), matrix: mat4([span / 2, 0, chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(span, thickness, t), matrix: mat4([span / 2, 0, -chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(t, thickness, chord), matrix: mat4([span, 0, 0]) });
  for (let i = 1; i < cells[0]; i++) parts.push({ geometry: new THREE.BoxGeometry(t * 0.7, thickness, chord), matrix: mat4([(span * i) / cells[0], 0, 0]) });
  for (let j = 1; j < cells[1]; j++) parts.push({ geometry: new THREE.BoxGeometry(span, thickness, t * 0.7), matrix: mat4([span / 2, 0, -chord / 2 + (chord * j) / cells[1]]) });
  // Diagonal vanes (the fins use a lattice with diagonal members).
  const d = Math.hypot(span / cells[0], chord / cells[1]);
  for (let i = 0; i < cells[0]; i++) for (let j = 0; j < cells[1]; j++) {
    const cx = (span * (i + 0.5)) / cells[0], cz = -chord / 2 + (chord * (j + 0.5)) / cells[1];
    const ang = Math.atan2(chord / cells[1], span / cells[0]);
    parts.push({ geometry: new THREE.BoxGeometry(d, thickness * 0.85, t * 0.5), matrix: mat4([cx, 0, cz], [0, ((i + j) % 2 ? 1 : -1) * ang, 0]) });
  }
  const fin = mesh(mergeAll(parts), M.steelWarm);
  const g = new THREE.Group();
  g.add(fin);
  // Root actuator housing / hinge shroud
  g.add(mesh(new THREE.BoxGeometry(0.9, thickness + 0.5, chord + 0.4), M.steelSkirt, { position: [0.1, 0, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, chord + 0.6, 20), M.darkMetal, { position: [0.1, 0, 0], rotation: [Math.PI / 2, 0, 0] }));
  return g;
}

function chine(M, { length = 18, width = 1.3, depth = 0.5 } = {}) {
  // Aerodynamic fairing over plumbing/COPVs. Profile along Y (local): tapered both ends.
  const outline = [[0, 0], [depth * 0.35, 0.8], [depth, 3.0], [depth, length - 3.0], [depth * 0.35, length - 0.8], [0, length]];
  const g = plate(outline, width, 0.12);
  return mesh(g, M.steel);
}

function ventedRing(M) {
  // Hot-stage ring: 1.8 m, with vent openings (Block 3 integrates it into the tank section).
  const g = new THREE.Group();
  const H = 1.8;
  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: H }], { segments: 128 }), M.steelSkirt));
  const vents = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    vents.push({ geometry: new THREE.BoxGeometry(0.7, 0.9, 0.08), matrix: mat4([Math.sin(a) * (R + 0.02), H * 0.55, Math.cos(a) * (R + 0.02)], [0, a, 0]) });
    // truss members between vents
    vents.push({ geometry: new THREE.BoxGeometry(0.1, H * 0.9, 0.12), matrix: mat4([Math.sin(a + Math.PI / n) * (R + 0.06), H * 0.5, Math.cos(a + Math.PI / n) * (R + 0.06)], [0, a + Math.PI / n, 0]) });
  }
  g.add(mesh(mergeAll(vents), M.blackMatte));
  // Top interface flange
  g.add(mesh(new THREE.TorusGeometry(R - 0.05, 0.12, 8, 128), M.darkMetal, { position: [0, H - 0.05, 0], rotation: [Math.PI / 2, 0, 0] }));
  return g;
}

// ----------------------------------------------------------------------------------------
export function buildSuperHeavy(M) {
  const g = new THREE.Group();
  g.name = 'superheavy';
  const skirtH = 6.9;                    // engine section (approx)
  const ringTop = BOOSTER_H - 1.8;       // vented interstage occupies the top 1.8 m

  // Hull sections
  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: skirtH }], { segments: 160 }), M.steelSkirt, { name: 'skirt' }));
  g.add(mesh(lathe([{ r: R, y: skirtH }, { r: R, y: ringTop }], { segments: 160 }), M.steel, { name: 'tanks' }));
  const ring = ventedRing(M); ring.position.y = ringTop; g.add(ring);
  // Inner skirt wall visible from below + thrust structure
  g.add(mesh(lathe([{ r: R - 0.02, y: 0.1 }, { r: R - 0.02, y: 4.2 }], { segments: 96, flip: true }), M.steelInner, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.5, 96), M.darkMetal, { position: [0, 4.2, 0] }));
  // Engine shielding: individual bays for the 20 outer engines (approximation of the shielded skirt).
  const bays = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + Math.PI / 20;
    bays.push({ geometry: new THREE.BoxGeometry(0.12, 3.2, 1.1), matrix: mat4([Math.sin(a) * 3.85, 1.9, Math.cos(a) * 3.85], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(bays), M.darkMetal));

  // 33 Raptor 3: 3 inner + 10 middle (gimballing) + 20 outer (fixed).
  const raptor = raptorGeometry();
  const transforms = [
    ...ringLayout(3, 1.02, 0.45, { phase: Math.PI / 6 }),
    ...ringLayout(10, 2.48, 0.35, { phase: 0 }),
    ...ringLayout(20, 3.86, 0.25, { phase: Math.PI / 20 }),
  ];
  g.add(instanceEngines(raptor, M, transforms));

  // Chines (4) over the lower tank section
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const c = chine(M);
    c.position.set(Math.sin(a) * (R - 0.05), 5.0, Math.cos(a) * (R - 0.05));
    c.rotation.y = a - Math.PI / 2; // depth radial, width tangential
    g.add(c);
  }
  // Raceway (COPV / cable conduit) up the booster, opposite the empty grid-fin side
  const raceway = mesh(new THREE.BoxGeometry(0.5, ringTop - skirtH - 0.5, 0.35), M.steelWarm);
  raceway.position.set(Math.sin(Math.PI) * (R + 0.12), (ringTop + skirtH) / 2, Math.cos(Math.PI) * (R + 0.12));
  raceway.rotation.y = Math.PI;
  g.add(raceway);
  const pipes = [];
  for (const dx of [-0.32, 0.32]) pipes.push({ geometry: new THREE.CylinderGeometry(0.09, 0.09, ringTop - skirtH - 1, 10), matrix: mat4([dx, (ringTop + skirtH) / 2, -(R + 0.08)]) });
  g.add(mesh(mergeAll(pipes), M.aluminum));

  // Grid fins: 3, at 90°/90°/180° (fins at φ = 90°, 180°, 270°; the tower-facing side stays clear).
  const finY = ringTop - 3.4;
  for (const phi of [Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const fin = gridFin(M);
    fin.position.set(Math.sin(phi) * (R + 0.35), finY, Math.cos(phi) * (R + 0.35));
    fin.rotation.y = phi - Math.PI / 2; // local +X (span) → radial
    g.add(fin);
  }
  // Catch hardpoints (pins) integrated at the two opposite fins (φ = 90°, 270°).
  for (const phi of [Math.PI / 2, Math.PI * 1.5]) {
    const pin = mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.5, 24), M.darkMetal);
    pin.position.set(Math.sin(phi) * (R + 0.6), finY - 1.6, Math.cos(phi) * (R + 0.6));
    pin.rotation.set(Math.PI / 2, phi, 0, 'YXZ'); // cylinder axis → radial
    g.add(pin);
    const boss = mesh(new THREE.BoxGeometry(0.9, 1.2, 1.4), M.steelSkirt);
    boss.position.set(Math.sin(phi) * (R + 0.2), finY - 1.6, Math.cos(phi) * (R + 0.2));
    boss.rotation.y = phi;
    g.add(boss);
  }
  // Ring weld bands are in the steel texture; add the tank common-dome stiffener band on the outside.
  g.add(mesh(new THREE.TorusGeometry(R + 0.02, 0.05, 6, 160), M.steelWarm, { position: [0, 30.0, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));

  g.userData.annotations = [
    { label: '33 Raptor 3 · 3 + 10 + 20', position: [0, -0.3, 6.5] },
    { label: 'Chine (carenado de COPV)', position: [Math.sin(Math.PI / 4) * 5.3, 14, Math.cos(Math.PI / 4) * 5.3] },
    { label: 'Grid fin (3 en V3, 90°/90°/180°)', position: [R + 4.6, finY, 0] },
    { label: 'Pin de captura', position: [-(R + 0.9), finY - 1.6, 0] },
    { label: 'Anillo hot-staging integrado', position: [0, ringTop + 0.9, R + 0.6] },
    { label: 'Tanque de oxígeno líquido', position: [0, 22, R + 0.4] },
    { label: 'Tanque de metano líquido', position: [0, 55, R + 0.4] },
  ];
  return g;
}

// ----------------------------------------------------------------------------------------
export function buildShip(M) {
  const g = new THREE.Group();
  g.name = 'ship';
  const rng = seeded(7);
  const skirtH = 6.0;
  const barrelTop = 34.5;          // approx: nose section length ≈ 17.5 m
  const nose = ogiveProfile(R, SHIP_H - barrelTop, barrelTop, 40, 0.0, 1.0);
  // Round the very tip slightly by replacing the last points with a small cap.
  const profile = [{ r: R, y: 0 }, { r: R, y: skirtH, sharp: false }, { r: R, y: barrelTop }, ...nose.slice(1)];

  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: skirtH }], { segments: 160 }), M.steelWarm, { name: 'skirt' }));
  g.add(mesh(lathe(profile.slice(1), { segments: 160 }), M.steel, { name: 'hull' }));
  // Inner skirt + thrust puck
  g.add(mesh(lathe([{ r: R - 0.02, y: 0.1 }, { r: R - 0.02, y: 4.9 }], { segments: 96, flip: true }), M.steelInner, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.4, 96), M.darkMetal, { position: [0, 4.9, 0] }));

  // Engines: 3 Raptor (centre, gimballing) + 3 RVac (outer, fixed)
  const rap = raptorGeometry();
  const rvac = raptorVacGeometry();
  g.add(instanceEngines(rap, M, ringLayout(3, 0.95, 0.35, { phase: 0 })));
  g.add(instanceEngines(rvac, M, ringLayout(3, 3.05, 0.25, { phase: Math.PI / 3 }), { bellMaterial: M.bellCool }));

  // ---- Thermal protection: instanced hexagonal tiles on the windward half (+Z) ----
  const tileGeo = hexPrism(TILE_CIRCUMRADIUS, 0.03);
  const capacity = 26000;
  const tiles = new THREE.InstancedMesh(tileGeo, M.tile, capacity);
  tiles.name = 'tps';
  tiles.castShadow = true; tiles.receiveShadow = true;
  const windward = 0; // φ = 0 → +Z
  const hullProfile = profile;
  // Ablative backing layer (light) so tile gaps read correctly.
  const backing = lathe(hullProfile.map(p => ({ r: p.r + 0.012, y: p.y })), { segments: 96, phiStart: -Math.PI * 0.53, phiLength: Math.PI * 1.06 });
  g.add(mesh(backing, M.tileUnder, { castShadow: false }));
  let count = tileSurfaceOfRevolution(tiles, hullProfile, {
    y0: 0.35, y1: SHIP_H - 0.8, phiCenter: windward, phiHalf: Math.PI * 0.53, circumradius: TILE_CIRCUMRADIUS, rng,
    maskFn: (y, phi) => {
      // wrap fully around the nose tip above 49 m, taper coverage otherwise (approximation)
      if (y > 49.5) return true;
      return Math.abs(phi) < Math.PI * 0.53;
    },
  });
  // Full wrap at the nose tip
  count = tileSurfaceOfRevolution(tiles, hullProfile, { y0: 49.6, y1: SHIP_H - 0.6, phiCenter: Math.PI, phiHalf: Math.PI * 0.47, circumradius: TILE_CIRCUMRADIUS, rng, startIndex: count });

  // ---- Flaps ----
  const flapThickness = 0.55;
  const makeFlap = (outline, phi, yBase, rootOffset) => {
    // outline in local (x = radial outward from the hull surface, y = along vehicle)
    const geo = plate(outline, flapThickness, 0.08);
    const e1 = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const e2 = new THREE.Vector3(0, 1, 0);
    const e3 = new THREE.Vector3().crossVectors(e1, e2);
    const basis = new THREE.Matrix4().makeBasis(e1, e2, e3);
    const m = new THREE.Matrix4().makeTranslation(e1.x * rootOffset, yBase, e1.z * rootOffset).multiply(basis);
    const flap = mesh(geo, M.steel);
    flap.applyMatrix4(m);
    g.add(flap);
    // tiles on the windward face
    const windwardIsPlusE3 = e3.z >= 0;
    const faceM = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, windwardIsPlusE3 ? flapThickness / 2 : -flapThickness / 2));
    if (!windwardIsPlusE3) faceM.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
    count = tilePolygon(tiles, outline, faceM, { circumradius: TILE_CIRCUMRADIUS, startIndex: count, rng });
    // hinge fairing along the root
    const len = Math.max(...outline.map(p => p[1])) - Math.min(...outline.map(p => p[1]));
    const hinge = mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 20), M.steelWarm);
    hinge.position.copy(new THREE.Vector3(e1.x * (rootOffset - 0.15), yBase + len / 2, e1.z * (rootOffset - 0.15)));
    g.add(hinge);
    return flap;
  };
  // Aft flaps at the sides (±90°), slightly leeward. Outline approximate.
  const aftOutline = [[0, 0], [4.4, 0.6], [4.6, 2.4], [3.2, 8.2], [2.4, 10.6], [0, 11.0]];
  makeFlap(aftOutline, Math.PI / 2 + 0.12, 1.2, R - 0.05);
  makeFlap(aftOutline.map(([x, y]) => [x, y]), -Math.PI / 2 - 0.12, 1.2, R - 0.05);
  // Forward flaps: leeward, 140° apart (Block 2+). Root follows the nose profile.
  const fwdBase = 40.5;
  const fwdOutline = [];
  const fwdLen = 8.6;
  const inner = [], outer = [];
  const hullR = (y) => profileAt(hullProfile, fwdBase + y)?.r ?? R;
  for (let i = 0; i <= 8; i++) { const y = (i / 8) * fwdLen; inner.push([hullR(y) - R, y]); }
  // chord (outward width) tapers from ~2.9 m at the root to ~1.4 m near the tip (approximation)
  for (const [y, w] of [[0.5, 2.6], [1.6, 2.9], [4.5, 2.5], [7.0, 1.8], [8.3, 1.2]]) outer.push([hullR(y) - R + w, y]);
  fwdOutline.push(...inner, [hullR(fwdLen) - R + 0.5, fwdLen], ...outer.reverse());
  for (const phi of [Math.PI - 1.222, -(Math.PI - 1.222)]) makeFlap(fwdOutline, phi, fwdBase, R - 0.05);

  tiles.count = count;
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  g.add(tiles);
  g.userData.tileCount = count;

  // Header tank access & nose tip cap
  g.add(mesh(new THREE.SphereGeometry(0.16, 16, 12), M.steelWarm, { position: [0, SHIP_H - 0.12, 0] }));
  // Payload bay / forward dome stiffener band
  g.add(mesh(new THREE.TorusGeometry(R + 0.02, 0.05, 6, 160), M.steelWarm, { position: [0, 33.2, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  // Raceway on the leeward side
  const race = mesh(new THREE.BoxGeometry(0.45, barrelTop - skirtH - 1.0, 0.3), M.steelWarm);
  race.position.set(0, (barrelTop + skirtH) / 2, -(R + 0.1));
  g.add(race);

  g.userData.annotations = [
    { label: '3 Raptor + 3 Raptor Vacuum', position: [0, -0.4, 5.0] },
    { label: 'Escudo térmico · ≈18 000 losetas hexagonales', position: [0, 20, R + 0.6] },
    { label: 'Aleta trasera', position: [R + 4.6, 5, 0] },
    { label: 'Aleta delantera (a sotavento)', position: [Math.sin(Math.PI - 1.222) * (R + 2.2), fwdBase + 4, Math.cos(Math.PI - 1.222) * (R + 2.2)] },
    { label: 'Tanques de cabecera (morro)', position: [0, SHIP_H - 1.0, 1.2] },
    { label: 'Bahía de carga', position: [0, 30, -(R + 0.6)] },
  ];
  return g;
}

export function buildStarship(M) {
  const g = new THREE.Group();
  g.name = 'starship-stack';
  const booster = buildSuperHeavy(M);
  const ship = buildShip(M);
  ship.position.y = BOOSTER_H;
  g.add(booster, ship);
  const ann = [
    ...booster.userData.annotations,
    ...ship.userData.annotations.map(a => ({ label: a.label, position: [a.position[0], a.position[1] + BOOSTER_H, a.position[2]] })),
  ];
  g.userData.annotations = ann;
  g.userData.height = BOOSTER_H + SHIP_H;
  g.userData.tileCount = ship.userData.tileCount;
  return g;
}
