/**
 * Starship launch complex — Starbase Pad 2 (Pad B), the pad Version 3 flies from.
 *
 * PROVENANCE. SpaceX publishes no dimensions for its ground infrastructure, so this model is
 * built from the handful of figures that are citable and, for everything else, from
 * photogrammetry against the one hard scale reference in every photograph of the pad: the
 * 9 m diameter of the booster. Each figure below is marked accordingly, and the same marks
 * are carried into the vehicle sheet in data/specs.js so the interface never presents a
 * reconstructed number as a published one.
 *
 *   cited    tower height 144,5 m (474 ft) · chopstick arms ≈ 36 m · 20 hold-down clamps
 *   cited    square launch mount with a water-cooled deck; integrated bidirectional flame
 *            trench, a concrete "bathtub" clad in stainless; booster sits several metres
 *            lower than Pad A's stilted OLM
 *   approx   every plan dimension, the deck and trench levels, the truss section, the
 *            distance from the tower to the mount, the tank farm and the lightning masts
 *
 * Frame: origin at the centre of the launch mount, on grade. +Y up, tower at −X, and the
 * flame trench runs along Z with a mouth at each end.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, boxUV, tube, radial } from '../geometry/utils.js';

// ---- Dimensions -------------------------------------------------------------------------
export const PAD = {
  // Ground
  gradeY: 0,
  bermY: 3.0,             // outer berm top
  padY: 9.0,              // pad surface the tower and the mount stand on
  trenchFloorY: 0.8,      // trench floor: kept above grade so the ground plane never cuts it
  trenchHalfW: 11.0,      // 22 m clear width
  trenchHalfL: 44.0,      // 88 m of trench inside the pad, open at both ends
  // Launch mount
  deckTop: 18.0,          // 9 m above the pad surface
  deckThick: 2.4,
  mountHalf: 13.0,        // 26 m square
  openingR: 5.5,          // ø 11 m engine opening
  tableR: 5.2,            // steel ring the booster skirt seats on
  clamps: 20,
  clampR: 4.92,
  pierHalf: 2.0,          // 4 m square corner piers
  pierAt: 12.0,
  // Tower (OLIT)
  towerX: -30.0,
  towerHalf: 6.1,         // 12,2 m square truss
  section: 12.2,
  sections: 10,           // 122 m of truss
  mast: 22.5,             // lightning mast on top
  armY: 46.0,             // chopstick carriage height at launch (arms parked open)
  armLen: 36.0,
  qdY: 96.0,              // ship quick-disconnect arm
  qdLen: 18.5,
  // Field
  mastH: 150.0,
  farmX: 82.0,
};
PAD.towerH = PAD.section * PAD.sections + PAD.mast;   // 144,5 m
PAD.trenchDepth = PAD.padY - PAD.trenchFloorY;        // 8,2 m

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** Axis-aligned block given by its extents, as a {geometry, matrix} pair for mergeAll. */
const block = (x0, x1, y0, y1, z0, z1) => ({
  geometry: B(x1 - x0, y1 - y0, z1 - z0),
  matrix: mat4([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]),
});

// =========================================================================================
//  Ground: berm, pad surface and the flame trench cut through both
// =========================================================================================
function buildGround(M) {
  const g = new THREE.Group();
  g.name = 'pad-ground';
  const { bermY, padY, trenchHalfW: tw, trenchFloorY } = PAD;
  const concrete = [];
  // Outer berm and the pad surface on top of it, in two halves either side of the trench.
  for (const s of [-1, 1]) {
    const inner = s < 0 ? -tw : tw;
    concrete.push(block(Math.min(inner, s * 74), Math.max(inner, s * 74), -0.5, bermY, -52, 52));
    concrete.push(block(Math.min(inner, s * 64), Math.max(inner, s * 64), bermY, padY, -46, 46));
  }
  // Trench floor, a slab sitting just proud of grade so the ground plane cannot z-fight it.
  concrete.push(block(-tw, tw, trenchFloorY - 0.6, trenchFloorY, -52, 52));
  g.add(mesh(boxUV(mergeAll(concrete)), M.concrete));

  // Stainless cladding on the trench walls and floor. The trench is the one part of the pad
  // that is lined rather than bare concrete, because it takes the exhaust directly.
  const clad = [];
  for (const s of [-1, 1]) {
    clad.push(block(s * tw - 0.12, s * tw + 0.12, trenchFloorY, padY, -46, 46));
  }
  clad.push(block(-tw, tw, trenchFloorY, trenchFloorY + 0.12, -46, 46));
  g.add(mesh(boxUV(mergeAll(clad)), M.darkMetal));

  // Bidirectional flame diverter: a ridge under the engine opening that splits the plume
  // down both arms of the trench. Modelled as two ramps meeting at the crest.
  const ramps = [];
  const crest = trenchFloorY + 4.2, run = 15.0;
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, trenchFloorY);
    shape.lineTo(0, crest);
    shape.lineTo(s * run, trenchFloorY + 0.35);
    shape.lineTo(s * run, trenchFloorY);
    shape.closePath();
    const e = new THREE.ExtrudeGeometry(shape, { depth: tw * 2, bevelEnabled: false });
    // Extruded in XY along +Z; rotate so the ramp runs along Z and spans the trench in X.
    e.rotateY(Math.PI / 2);
    e.translate(-tw, 0, 0);
    ramps.push({ geometry: e });
  }
  g.add(mesh(boxUV(mergeAll(ramps)), M.darkMetal));
  return g;
}

// =========================================================================================
//  Launch mount: square water-cooled deck on four piers, spanning the trench
// =========================================================================================
function buildMountTable(M) {
  const g = new THREE.Group();
  g.name = 'launch-mount';
  const { deckTop, deckThick, mountHalf: h, openingR, tableR, padY, pierHalf, pierAt } = PAD;
  const deckBottom = deckTop - deckThick;

  // Deck: a square slab with the engine opening through it.
  const sq = new THREE.Shape();
  sq.moveTo(-h, -h); sq.lineTo(h, -h); sq.lineTo(h, h); sq.lineTo(-h, h); sq.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, openingR, 0, Math.PI * 2, true);
  sq.holes.push(hole);
  const deck = new THREE.ExtrudeGeometry(sq, { depth: deckThick, bevelEnabled: false, curveSegments: 48 });
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, deckTop - deckThick, 0);
  g.add(mesh(boxUV(mergeAll([{ geometry: deck }])), M.mount));

  // Piers and their bracing, standing on the pad surface clear of the trench walls.
  const steel = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * pierAt, z = sz * pierAt;
    steel.push(block(x - pierHalf, x + pierHalf, padY, deckBottom, z - pierHalf, z + pierHalf));
  }
  // Girders under the deck, spanning pier to pier both ways.
  for (const s of [-1, 1]) {
    steel.push(block(-pierAt, pierAt, deckBottom - 1.6, deckBottom, s * pierAt - 0.7, s * pierAt + 0.7));
    steel.push(block(s * pierAt - 0.7, s * pierAt + 0.7, deckBottom - 1.6, deckBottom, -pierAt, pierAt));
  }
  // Diagonal bracing in the four bays between the piers.
  const braceH = deckBottom - 1.6 - padY;
  const diag = Math.hypot(braceH, pierAt * 2);
  for (const s of [-1, 1]) {
    for (const d of [-1, 1]) {
      steel.push({
        geometry: B(0.55, diag, 0.55),
        matrix: mat4([s * pierAt, padY + braceH / 2, 0], [Math.atan2(pierAt * 2 * d, braceH), 0, 0]),
      });
      steel.push({
        geometry: B(0.55, diag, 0.55),
        matrix: mat4([0, padY + braceH / 2, s * pierAt], [0, 0, Math.atan2(pierAt * 2 * d, braceH)]),
      });
    }
  }
  g.add(mesh(boxUV(mergeAll(steel)), M.mount));

  // Water-cooled table seat: an annular steel plate cantilevered inboard of the deck opening
  // for the booster skirt to sit on. Its inner edge is what actually sets the size of the
  // hole the exhaust leaves through — smaller than the 9 m vehicle, as it has to be.
  const seat = new THREE.Shape();
  seat.absarc(0, 0, tableR + 1.0, 0, Math.PI * 2, false);
  const seatHole = new THREE.Path();
  seatHole.absarc(0, 0, 4.05, 0, Math.PI * 2, true);
  seat.holes.push(seatHole);
  const seatGeo = new THREE.ExtrudeGeometry(seat, { depth: 0.55, bevelEnabled: false, curveSegments: 48 });
  seatGeo.rotateX(-Math.PI / 2);
  seatGeo.translate(0, deckTop - 0.55, 0);
  const inner = new THREE.CylinderGeometry(openingR, openingR, deckThick, 64, 1, true);
  inner.translate(0, deckTop - deckThick / 2, 0);
  const throat = new THREE.CylinderGeometry(4.05, 4.05, 1.9, 48, 1, true);
  throat.translate(0, deckTop - 1.5, 0);
  g.add(mesh(boxUV(mergeAll([{ geometry: seatGeo }, { geometry: inner }, { geometry: throat }])), M.darkMetal, { name: 'table-seat' }));
  const manifold = new THREE.TorusGeometry(openingR + 0.9, 0.32, 8, 64);
  manifold.rotateX(Math.PI / 2);
  manifold.translate(0, deckBottom - 0.4, 0);
  g.add(mesh(boxUV(mergeAll([{ geometry: manifold }])), M.conduit));

  // Deluge headers on the deck: a ring of nozzles pointing at the vehicle base.
  const nozzles = [];
  radial(32, (a) => {
    nozzles.push({ geometry: new THREE.CylinderGeometry(0.09, 0.09, 0.75, 6), matrix: mat4([Math.sin(a) * (tableR + 0.85), deckTop + 0.38, Math.cos(a) * (tableR + 0.85)], [0.35 * Math.cos(a), 0, -0.35 * Math.sin(a)]) });
  });
  g.add(mesh(boxUV(mergeAll(nozzles)), M.conduit, { castShadow: false }));

  // Deck fascia and the perimeter walkway rail. Without them the deck reads as a bare table
  // rather than a structure people work on, and the rail is the only thing at the top of the
  // mount whose size a viewer already knows.
  const trim = [];
  for (const s2 of [-1, 1]) {
    trim.push(block(-h, h, deckTop - deckThick - 0.9, deckTop - deckThick, s2 * h - 0.5, s2 * h));
    trim.push(block(s2 * h - 0.5, s2 * h, deckTop - deckThick - 0.9, deckTop - deckThick, -h, h));
  }
  g.add(mesh(boxUV(mergeAll(trim)), M.mount));
  const rail = [];
  for (const s2 of [-1, 1]) {
    for (const y of [deckTop + 0.62, deckTop + 1.15]) {
      rail.push(block(-h + 0.2, h - 0.2, y - 0.05, y + 0.05, s2 * (h - 0.35) - 0.05, s2 * (h - 0.35) + 0.05));
      rail.push(block(s2 * (h - 0.35) - 0.05, s2 * (h - 0.35) + 0.05, y - 0.05, y + 0.05, -h + 0.2, h - 0.2));
    }
    for (let i = 0; i <= 12; i++) {
      const t = -h + 0.4 + (i / 12) * (h * 2 - 0.8);
      rail.push(block(t - 0.05, t + 0.05, deckTop, deckTop + 1.15, s2 * (h - 0.35) - 0.05, s2 * (h - 0.35) + 0.05));
      rail.push(block(s2 * (h - 0.35) - 0.05, s2 * (h - 0.35) + 0.05, deckTop, deckTop + 1.15, t - 0.05, t + 0.05));
    }
  }
  g.add(mesh(boxUV(mergeAll(rail)), M.mount, { castShadow: false }));

  // Twenty hold-down clamps. Kept as separate meshes so the launch sequence can release
  // them individually; twenty extra draw calls is a fair price for that.
  const holds = new THREE.Group();
  holds.name = 'holddowns';
  const clampGeo = boxUV(mergeAll([
    { geometry: B(0.9, 1.05, 0.72), matrix: mat4([0, 0.52, 0]) },
    { geometry: B(1.15, 0.28, 0.95), matrix: mat4([0, 0.14, 0]) },
  ]));
  radial(PAD.clamps, (a) => {
    const m = mesh(clampGeo, M.mountYellow);
    m.position.set(Math.sin(a) * PAD.clampR, deckTop, Math.cos(a) * PAD.clampR);
    m.rotation.y = a;
    m.userData.home = m.position.clone();
    m.userData.azimuth = a;
    holds.add(m);
  });
  g.add(holds);

  // Booster quick disconnect: at Starbase this comes up through the mount itself, not from
  // the tower, so it is part of the table rather than a swing arm.
  const bqd = boxUV(mergeAll([
    block(-1.5, 1.5, deckTop - 0.2, deckTop + 3.4, -tableR - 2.6, -tableR - 0.2),
    block(-0.6, 0.6, deckTop + 1.0, deckTop + 2.4, -tableR - 0.4, -tableR + 0.9),
  ]));
  const bqdMesh = mesh(bqd, M.mount, { name: 'booster-qd' });
  bqdMesh.rotation.y = -Math.PI / 2;   // face the tower
  g.add(bqdMesh);
  return g;
}

// =========================================================================================
//  Tower: 122 m of square truss on a concrete foundation, with a lightning mast on top
// =========================================================================================
function buildTower(M) {
  const g = new THREE.Group();
  g.name = 'olit';
  g.position.x = PAD.towerX;
  const { padY, towerHalf: h, section, sections, mast } = PAD;
  const base = padY, top = base + section * sections;

  g.add(mesh(boxUV(mergeAll([block(-9, 9, PAD.bermY, padY + 1.2, -9, 9)])), M.concrete));

  const steel = [];
  // Four corner columns.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (h - 0.7), z = sz * (h - 0.7);
    steel.push(block(x - 0.7, x + 0.7, base, top, z - 0.7, z + 0.7));
  }
  // Horizontal ties every half-section, all four faces.
  const half = section / 2;
  for (let y = base; y <= top + 0.01; y += half) {
    for (const s of [-1, 1]) {
      steel.push(block(-h + 0.7, h - 0.7, y - 0.28, y + 0.28, s * (h - 0.7) - 0.28, s * (h - 0.7) + 0.28));
      steel.push(block(s * (h - 0.7) - 0.28, s * (h - 0.7) + 0.28, y - 0.28, y + 0.28, -h + 0.7, h - 0.7));
    }
  }
  // One X-brace per face per section.
  const span = (h - 0.7) * 2;
  const dLen = Math.hypot(span, section);
  const tilt = Math.atan2(span, section);
  for (let i = 0; i < sections; i++) {
    const yc = base + section * (i + 0.5);
    for (const s of [-1, 1]) for (const d of [-1, 1]) {
      steel.push({ geometry: B(0.34, dLen, 0.34), matrix: mat4([0, yc, s * (h - 0.7)], [0, 0, tilt * d]) });
      steel.push({ geometry: B(0.34, dLen, 0.34), matrix: mat4([s * (h - 0.7), yc, 0], [tilt * d, 0, 0]) });
    }
  }
  // Service core inside the truss (lifts and stairs) and the carriage rails on the pad face.
  steel.push(block(-2.6, 2.6, base, top, -2.6, 2.6));
  for (const s of [-1, 1]) steel.push(block(h - 0.35, h + 0.45, base, top, s * 3.4 - 0.45, s * 3.4 + 0.45));
  g.add(mesh(boxUV(mergeAll(steel)), M.mount));

  // Lightning mast: a tapered spire that takes the tower to its published 144,5 m.
  const spire = new THREE.CylinderGeometry(0.16, 0.75, mast, 12);
  spire.translate(0, top + mast / 2, 0);
  g.add(mesh(boxUV(mergeAll([{ geometry: spire }])), M.alumDark, { name: 'mast' }));
  return g;
}

/** Chopstick carriage and arms, parked open at launch height. */
function buildChopsticks(M) {
  const g = new THREE.Group();
  g.name = 'chopsticks';
  g.position.set(PAD.towerX, PAD.armY, 0);
  const face = PAD.towerHalf + 0.9;
  g.add(mesh(boxUV(mergeAll([
    block(face - 1.4, face + 2.2, -3.2, 3.2, -7.5, 7.5),
    block(face - 0.4, face + 0.4, -4.6, 4.6, -8.4, -6.6),
    block(face - 0.4, face + 0.4, -4.6, 4.6, 6.6, 8.4),
  ])), M.mount, { name: 'carriage' }));

  // Arms open to ±42°, which clears the 9 m hull by a wide margin at the vehicle station.
  const open = THREE.MathUtils.degToRad(42);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = `arm-${s < 0 ? 'north' : 'south'}`;
    arm.position.set(face + 1.2, 0, s * 2.2);
    arm.rotation.y = -s * open;
    const parts = [
      block(0, PAD.armLen, -1.7, 1.7, -1.35, 1.35),                 // main beam
      block(2, PAD.armLen - 2, 1.7, 2.3, -1.0, 1.0),                // top rail
    ];
    // Load-bearing pads the booster hangs from, on the inboard face.
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 7;
      parts.push(block(x, x + 2.4, -1.9, 1.9, -s * 2.1, -s * 1.35));
    }
    arm.add(mesh(boxUV(mergeAll(parts)), M.mount));
    g.add(arm);
  }
  return g;
}

/** Ship quick-disconnect swing arm, connected before launch and retracted at T−0. */
function buildQdArm(M) {
  const pivot = new THREE.Group();
  pivot.name = 'qd-arm';
  pivot.position.set(PAD.towerX + PAD.towerHalf + 0.6, PAD.qdY, 0);
  const L = PAD.qdLen;
  pivot.add(mesh(boxUV(mergeAll([
    block(0, L, -1.3, 1.3, -1.2, 1.2),
    block(L - 2.4, L + 0.4, -2.1, 2.1, -1.9, 1.9),   // the plate that mates with the ship
    block(0.4, L - 3, 1.3, 1.7, -0.8, 0.8),
  ])), M.mount, { name: 'qd-beam' }));
  // Umbilicals looping from the tower along the arm.
  const lines = [];
  for (const dz of [-0.85, 0, 0.85]) {
    lines.push({
      geometry: tube([[0.2, 1.9, dz], [L * 0.35, 2.5, dz], [L * 0.75, 2.1, dz], [L - 1.6, 1.4, dz]], 0.17, { tubular: 20, radial: 7 }),
    });
  }
  pivot.add(mesh(boxUV(mergeAll(lines)), M.conduit, { castShadow: false }));
  return pivot;
}

/** Lightning masts and the cryogenic farm that make the site read at its true size. */
function buildField(M) {
  const g = new THREE.Group();
  g.name = 'pad-field';
  const masts = [];
  for (const sz of [-1, 1]) {
    const x = 52, z = sz * 62;
    masts.push({ geometry: new THREE.CylinderGeometry(0.35, 1.5, PAD.mastH, 12), matrix: mat4([x, PAD.mastH / 2, z]) });
    masts.push({ geometry: new THREE.CylinderGeometry(0.08, 0.2, 9, 8), matrix: mat4([x, PAD.mastH + 4.5, z]) });
  }
  g.add(mesh(boxUV(mergeAll(masts)), M.alumDark));

  const slab = [block(PAD.farmX - 16, PAD.farmX + 20, -0.4, 1.2, -42, 42)];
  g.add(mesh(boxUV(mergeAll(slab)), M.concrete));

  const tanks = [];
  for (let i = 0; i < 6; i++) {
    const z = -32 + i * 13;
    tanks.push({ geometry: new THREE.CylinderGeometry(4.5, 4.5, 21, 32), matrix: mat4([PAD.farmX, 1.2 + 10.5, z]) });
    tanks.push({ geometry: new THREE.SphereGeometry(4.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat4([PAD.farmX, 1.2 + 21, z]) });
  }
  for (const z of [-24, 8]) {
    tanks.push({ geometry: new THREE.CylinderGeometry(6.0, 6.0, 14, 32), matrix: mat4([PAD.farmX + 15, 1.2 + 7, z]) });
  }
  g.add(mesh(boxUV(mergeAll(tanks)), M.aluminum));
  return g;
}

// =========================================================================================
export function buildLaunchComplex(M) {
  const g = new THREE.Group();
  g.name = 'launch-complex';
  g.add(buildGround(M));
  const table = buildMountTable(M);
  g.add(table);
  g.add(buildTower(M));
  const chop = buildChopsticks(M);
  g.add(chop);
  const qd = buildQdArm(M);
  g.add(qd);
  g.add(buildField(M));

  g.userData.stations = {
    padY: PAD.padY,
    deckTop: PAD.deckTop,
    trenchFloor: PAD.trenchFloorY,
    trenchDepth: PAD.trenchDepth,
    towerX: PAD.towerX,
    towerH: PAD.towerH,
    towerTop: PAD.padY + PAD.towerH,
    armY: PAD.armY,
    armLen: PAD.armLen,
    qdY: PAD.qdY,
  };
  g.userData.parts = {
    holddowns: table.getObjectByName('holddowns'),
    qdArm: qd,
    chopsticks: chop,
  };
  g.userData.annotations = [
    { label: 'Torre de integración y lanzamiento · 144,5 m', position: [PAD.towerX - 9, PAD.padY + 96, 0] },
    { label: 'Brazos de captura · 36 m', position: [PAD.towerX + 16, PAD.armY + 4, -22] },
    { label: 'Brazo de desconexión rápida de la nave', position: [PAD.towerX + 14, PAD.qdY + 4, 0] },
    { label: 'Mesa de lanzamiento · cubierta refrigerada por agua', position: [17, PAD.deckTop + 2.5, 14] },
    { label: '20 pinzas de sujeción', position: [8.5, PAD.deckTop + 3.6, -9] },
    { label: 'Zanja de llamas bidireccional · 8,2 m', position: [0, PAD.trenchFloorY + 3, 40] },
  ];
  return g;
}
