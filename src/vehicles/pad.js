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
import { dressPad } from './padDressing.js';
import { RAPTOR_ENVELOPE_R, BOOSTER_R } from './starship.js';

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
  // Clamp ring radius, set so the shoe's inner face lands ON the skirt rather than near it.
  // At the old 4.92 the twenty clamps closed to 4.56 m around a 4.50 m hull: six centimetres
  // of air, in close-ups of the one piece of hardware whose whole job is to hold the vehicle
  // down. CLAMP_DEPTH is the shoe's radial thickness, below.
  clampR: BOOSTER_R + 0.36,
  // The hole the exhaust leaves through, derived rather than declared: whatever the outermost
  // Raptor bells reach, plus a working gap. Hard-coding it at 4.05 m put the steel lip 43 cm
  // inside twenty of them — the seat is meant to be smaller than the 9 m vehicle, not smaller
  // than its engines. Moving a ring now moves the throat with it.
  throatR: RAPTOR_ENVELOPE_R + 0.25,
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
  farmX: 150.0,
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

  // Earth embankment round the outer berm. The berm was a 3.5 m concrete plinth with vertical
  // sides standing on the plain — a box set down on a table — where a graded pad site runs out
  // into the surrounding ground on a slope. The slope is fill, drawn with the terrain's own
  // material so it shares the plain's grain and landscape noise; it runs out 1 in 3 from the
  // berm's top edge, with rounded corners, and stops either side of the trench mouths so the
  // flame trench still opens at both ends. The concrete face stays inside it, unseen.
  if (M.terrain) {
    const HX = 74, HZ = 52, RUN = bermY * 3, SINK = 0.25, MOUTH = tw + 1.2, ARC = 8;
    const pts = [];      // [x, z, nx, nz] round the rectangle, counter-clockwise from +x,+z
    const side = (x0, z0, x1, z1, nx, nz, n) => {
      for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz]); }
    };
    const corner = (cx, cz, a0) => {
      for (let i = 0; i < ARC; i++) { const a = a0 + (i / ARC) * Math.PI / 2; pts.push([cx, cz, Math.cos(a), Math.sin(a)]); }
    };
    side(HX, -HZ, HX, HZ, 1, 0, 26); corner(HX, HZ, 0);
    side(HX, HZ, -HX, HZ, 0, 1, 48); corner(-HX, HZ, Math.PI / 2);
    side(-HX, HZ, -HX, -HZ, -1, 0, 26); corner(-HX, -HZ, Math.PI);
    side(-HX, -HZ, HX, -HZ, 0, -1, 48); corner(HX, -HZ, Math.PI * 1.5);
    const pos = [], uv = [], col = [], idx = [];
    const ROWS = 4;
    for (const [x, z, nx, nz] of pts) {
      for (let r = 0; r <= ROWS; r++) {
        const t = r / ROWS;
        // A slightly convex fill profile: rounded at the crest, easing into the plain.
        const y = bermY - (bermY + SINK) * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
        const px = x + nx * RUN * t, pz = z + nz * RUN * t;
        pos.push(px, y, pz); uv.push(px, -pz); col.push(1, 1, 1);
      }
    }
    const n = pts.length, row = ROWS + 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [xi, zi, , nzi] = pts[i], [xj, , , nzj] = pts[j];
      // Leave the trench mouths open on the two z faces.
      if (nzi !== 0 && nzj !== 0 && Math.abs(nzi) > 0.99 && (Math.abs(xi) < MOUTH || Math.abs(xj) < MOUTH)) continue;
      for (let r = 0; r < ROWS; r++) {
        const a0 = i * row + r, b0 = j * row + r;
        idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);   // faces up and out
      }
    }
    const slope = new THREE.BufferGeometry();
    slope.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    slope.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    slope.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    slope.setIndex(idx);
    slope.computeVertexNormals();
    g.add(mesh(slope, M.terrain, { name: 'pad-berm-slope', castShadow: false }));
  }

  // Refractory stainless steel armor cladding on the trench walls and floor.
  const clad = [];
  for (const s of [-1, 1]) {
    clad.push(block(s * tw - 0.12, s * tw + 0.12, trenchFloorY, padY, -46, 46));
  }
  clad.push(block(-tw, tw, trenchFloorY, trenchFloorY + 0.12, -46, 46));
  // Vertical structural armor panel retaining ribs along the trench walls
  for (let z = -44; z <= 44; z += 4) {
    for (const s of [-1, 1]) {
      clad.push(block(s * (tw - 0.08) - 0.05, s * (tw - 0.08) + 0.05, trenchFloorY, padY, z - 0.12, z + 0.12));
    }
  }
  // Named so verifyPad can measure the trench floor off the built geometry instead of
  // recomputing it from the same constant that produced it.
  g.add(mesh(boxUV(mergeAll(clad)), M.trenchArmor || M.darkMetal, { name: 'trench-armor' }));

  // Bidirectional flame diverter: aerodynamic wedge under the engine opening that splits the plume
  // down both arms of the trench, reinforced with structural stiffener ribs.
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
    e.rotateY(Math.PI / 2);
    e.translate(-tw, 0, 0);
    ramps.push({ geometry: e });
  }
  // Diverter central splitter spine and transverse stiffener ribs along the flame slope
  ramps.push(block(-tw, tw, crest - 0.25, crest + 0.18, -0.35, 0.35));
  for (const sz of [-1, 1]) {
    for (let r = 2.5; r < run; r += 3.2) {
      const yr = crest - (r / run) * (crest - trenchFloorY - 0.35);
      ramps.push(block(-tw + 0.2, tw - 0.2, yr - 0.1, yr + 0.18, sz * r - 0.18, sz * r + 0.18));
    }
  }
  g.add(mesh(boxUV(mergeAll(ramps)), M.trenchArmor || M.darkMetal, { name: 'trench-ramps' }));
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

  // Concrete foundation plinths and heavy steel baseplates under the four piers
  const plinths = [];
  const baseplates = [];
  const steel = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * pierAt, z = sz * pierAt;
    // Reinforced concrete plinth rising from pad level
    plinths.push(block(x - pierHalf - 0.45, x + pierHalf + 0.45, padY, padY + 1.1, z - pierHalf - 0.45, z + pierHalf + 0.45));
    // Heavy steel baseplate with gusset stiffeners
    baseplates.push(block(x - pierHalf - 0.2, x + pierHalf + 0.2, padY + 1.1, padY + 1.35, z - pierHalf - 0.2, z + pierHalf + 0.2));
    // Structural steel column
    steel.push(block(x - pierHalf, x + pierHalf, padY + 1.35, deckBottom, z - pierHalf, z + pierHalf));
  }
  g.add(mesh(boxUV(mergeAll(plinths)), M.concrete));
  g.add(mesh(boxUV(mergeAll(baseplates)), M.darkMetal, { name: 'mount-baseplates' }));

  // Girders under the deck, spanning pier to pier both ways.
  for (const s of [-1, 1]) {
    steel.push(block(-pierAt, pierAt, deckBottom - 1.6, deckBottom, s * pierAt - 0.7, s * pierAt + 0.7));
    steel.push(block(s * pierAt - 0.7, s * pierAt + 0.7, deckBottom - 1.6, deckBottom, -pierAt, pierAt));
  }
  // Diagonal bracing in the four bays between the piers.
  const braceH = deckBottom - 1.6 - (padY + 1.35);
  const diag = Math.hypot(braceH, pierAt * 2);
  for (const s of [-1, 1]) {
    for (const d of [-1, 1]) {
      steel.push({
        geometry: B(0.55, diag, 0.55),
        matrix: mat4([s * pierAt, padY + 1.35 + braceH / 2, 0], [Math.atan2(pierAt * 2 * d, braceH), 0, 0]),
      });
      steel.push({
        geometry: B(0.55, diag, 0.55),
        matrix: mat4([0, padY + 1.35 + braceH / 2, s * pierAt], [0, 0, Math.atan2(pierAt * 2 * d, braceH)]),
      });
    }
  }
  g.add(mesh(boxUV(mergeAll(steel)), M.mount));

  // Intermediate service mezzanine catwalk under the table (Y = 13.5 m)
  const catwalk = [];
  const catwalkRail = [];
  for (const s of [-1, 1]) {
    catwalk.push(block(-pierAt + pierHalf, pierAt - pierHalf, 13.5, 13.62, s * pierAt - 1.2, s * pierAt + 1.2));
    catwalk.push(block(s * pierAt - 1.2, s * pierAt + 1.2, 13.5, 13.62, -pierAt + pierHalf, pierAt - pierHalf));
    catwalkRail.push(block(-pierAt + pierHalf, pierAt - pierHalf, 14.65, 14.75, s * (pierAt - 1.25) - 0.04, s * (pierAt - 1.25) + 0.04));
    catwalkRail.push(block(s * (pierAt - 1.25) - 0.04, s * (pierAt - 1.25) + 0.04, 14.65, 14.75, -pierAt + pierHalf, pierAt - pierHalf));
  }
  g.add(mesh(boxUV(mergeAll(catwalk)), M.steelGrating || M.mount, { name: 'mount-catwalk' }));
  g.add(mesh(boxUV(mergeAll(catwalkRail)), M.mount, { castShadow: false, name: 'mount-catwalk-rail' }));

  // Deluge water supply risers climbing the piers to the table manifold
  const risers = [];
  for (const sx of [-1, 1]) {
    risers.push({
      geometry: new THREE.CylinderGeometry(0.38, 0.38, deckBottom - 0.4 - (padY + 1.35), 16),
      matrix: mat4([sx * (pierAt - 1.2), padY + 1.35 + (deckBottom - 0.4 - padY - 1.35) / 2, -pierAt - pierHalf - 0.45]),
    });
  }
  g.add(mesh(boxUV(mergeAll(risers)), M.pipePaint, { name: 'mount-risers' }));

  // Water-cooled table seat: an annular steel plate cantilevered inboard of the deck opening
  // for the booster skirt to sit on. Its inner edge is what actually sets the size of the
  // hole the exhaust leaves through — smaller than the 9 m vehicle, as it has to be.
  const { throatR } = PAD;
  const seat = new THREE.Shape();
  seat.absarc(0, 0, tableR + 1.0, 0, Math.PI * 2, false);
  const seatHole = new THREE.Path();
  seatHole.absarc(0, 0, throatR, 0, Math.PI * 2, true);
  seat.holes.push(seatHole);
  const seatGeo = new THREE.ExtrudeGeometry(seat, { depth: 0.55, bevelEnabled: false, curveSegments: 48 });
  seatGeo.rotateX(-Math.PI / 2);
  seatGeo.translate(0, deckTop - 0.55, 0);
  const inner = new THREE.CylinderGeometry(openingR, openingR, deckThick, 64, 1, true);
  inner.translate(0, deckTop - deckThick / 2, 0);
  const throat = new THREE.CylinderGeometry(throatR, throatR, 1.9, 48, 1, true);
  throat.translate(0, deckTop - 1.5, 0);
  g.add(mesh(boxUV(mergeAll([{ geometry: seatGeo }, { geometry: inner }, { geometry: throat }])), M.darkMetal, { name: 'table-seat' }));
  const manifold = new THREE.TorusGeometry(openingR + 0.9, 0.32, 8, 64);
  manifold.rotateX(Math.PI / 2);
  manifold.translate(0, deckBottom - 0.4, 0);
  g.add(mesh(boxUV(mergeAll([{ geometry: manifold }])), M.conduit, { name: 'deck-manifold' }));

  // Deluge headers on the deck: a ring of nozzles pointing at the vehicle base.
  const nozzles = [];
  radial(32, (a) => {
    nozzles.push({ geometry: new THREE.CylinderGeometry(0.09, 0.09, 0.75, 6), matrix: mat4([Math.sin(a) * (tableR + 0.85), deckTop + 0.38, Math.cos(a) * (tableR + 0.85)], [0.35 * Math.cos(a), 0, -0.35 * Math.sin(a)]) });
  });
  g.add(mesh(boxUV(mergeAll(nozzles)), M.conduit, { castShadow: false, name: 'deck-nozzles' }));

  // Deck fascia and the perimeter walkway rail. Without them the deck reads as a bare table
  // rather than a structure people work on, and the rail is the only thing at the top of the
  // mount whose size a viewer already knows.
  const trim = [];
  for (const s2 of [-1, 1]) {
    trim.push(block(-h, h, deckTop - deckThick - 0.9, deckTop - deckThick, s2 * h - 0.5, s2 * h));
    trim.push(block(s2 * h - 0.5, s2 * h, deckTop - deckThick - 0.9, deckTop - deckThick, -h, h));
  }
  g.add(mesh(boxUV(mergeAll(trim)), M.mount, { name: 'mount-trim' }));
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
  g.add(mesh(boxUV(mergeAll(rail)), M.mount, { castShadow: false, name: 'mount-rail' }));

  // Twenty hold-down clamps. Kept as separate meshes so the launch sequence can release
  // them individually; twenty extra draw calls is a fair price for that.
  const holds = new THREE.Group();
  holds.name = 'holddowns';
  const CLAMP_DEPTH = 0.72;      // radial thickness of the shoe; PAD.clampR is set from it
  const FOOT_DEPTH = 0.95;
  const clampGeo = boxUV(mergeAll([
    { geometry: B(0.9, 1.05, CLAMP_DEPTH), matrix: mat4([0, 0.52, 0]) },
    // The foot is deeper than the shoe, so it is pushed outboard to share the shoe's inner
    // face. Centred on the same axis it reached 8 cm further in - through the hull.
    { geometry: B(1.15, 0.28, FOOT_DEPTH), matrix: mat4([0, 0.14, (FOOT_DEPTH - CLAMP_DEPTH) / 2]) },
  ]));
  radial(PAD.clamps, (a) => {
    // Bare steel, like the mount they are bolted to. They were ochre, which no photograph of
    // the Starbase mounts shows, and from below they closed a gold ring round the engines.
    const m = mesh(clampGeo, M.steelSkirt);
    m.position.set(Math.sin(a) * PAD.clampR, deckTop, Math.cos(a) * PAD.clampR);
    m.rotation.y = a;
    m.userData.home = m.position.clone();
    m.userData.azimuth = a;
    holds.add(m);
  });
  g.add(holds);

  // SpaceX, Introducing Starship V3 (12 May 2026): two separate methane/oxygen
  // QDs on the side opposite the tower, fed from separate rooms in a hardened
  // bunker beside the mount. Counts and topology are documented; spacing,
  // envelopes and pipe routing are reconstructed. +X is opposite this tower.
  const bqd = new THREE.Group();
  bqd.name = 'booster-qd';
  bqd.userData.reconstruction = true;
  for (const [fluid, z] of [['methane', -1.5], ['oxygen', 1.5]]) {
    const mechanism = new THREE.Group();
    mechanism.name = `booster-qd-${fluid}`;
    mechanism.userData.fluid = fluid;
    mechanism.add(mesh(boxUV(mergeAll([
      block(tableR + 0.1, tableR + 2.5, deckTop, deckTop + 2.7, z - 0.55, z + 0.55),
    ])), M.mount));
    mechanism.add(mesh(boxUV(mergeAll([
      block(4.15, tableR + 0.4, deckTop + 1.35, deckTop + 2.2, z - 0.35, z + 0.35),
    ])), M.mount, { name: `booster-qd-contact-${fluid}` }));
    mechanism.add(mesh(tube([
      [tableR + 2.2, deckTop + 0.9, z],
      [17, deckTop + 0.9, z], [18, padY + 5.6, z],
    ], 0.21, { tubular: 24, radial: 8 }), M.pipeCryo || M.conduit, { name: `booster-fill-${fluid}` }));
    bqd.add(mechanism);
  }
  g.add(bqd);

  const bunker = new THREE.Group();
  bunker.name = 'booster-fluid-bunker';
  bunker.userData.reconstruction = true;
  bunker.add(mesh(boxUV(mergeAll([
    block(14, 23, padY, padY + 0.45, -5, 5),
    block(14, 23, padY + 5.6, padY + 6.4, -5, 5),
    block(14, 14.6, padY, padY + 5.6, -5, 5),
    block(14, 23, padY, padY + 5.6, -5, -4.4),
    block(14, 23, padY, padY + 5.6, 4.4, 5),
    block(22.4, 23, padY, padY + 5.6, -5, 5),
  ])), M.concrete, { name: 'bunker-shell' }));
  bunker.add(mesh(boxUV(mergeAll([
    block(14.6, 22.4, padY + 0.45, padY + 5.6, -0.3, 0.3),
  ])), M.concrete, { name: 'bunker-fluid-divider' }));
  for (const [fluid, z] of [['methane', -2.5], ['oxygen', 2.5]]) {
    bunker.add(mesh(new THREE.BoxGeometry(0.12, 3.2, 2.4), M.darkMetal, {
      position: [23.07, padY + 2.05, z], name: `bunker-${fluid}-access`,
    }));
  }
  g.add(bunker);
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
  pivot.add(mesh(boxUV(mergeAll(lines)), M.conduit, { castShadow: false, name: 'qd-lines' }));
  return pivot;
}

/** Lightning masts and the cryogenic farm that make the site read at its true size. */
function buildField(M) {
  const g = new THREE.Group();
  g.name = 'pad-field';
  const masts = [];
  // Both on the far side of the complex from the museum row, not one either side of it.
  // Straddling the pad put one of them 107 m directly behind the Falcon Heavy as seen from
  // the row, so a 150 m spike ran up through the middle of that exhibit's overview. Their
  // position is reconstructed, not cited, so it can serve the composition.
  for (const z of [-58, -132]) {
    const x = -96;
    masts.push({ geometry: new THREE.CylinderGeometry(0.35, 1.5, PAD.mastH, 12), matrix: mat4([x, PAD.mastH / 2, z]) });
    masts.push({ geometry: new THREE.CylinderGeometry(0.08, 0.2, 9, 8), matrix: mat4([x, PAD.mastH + 4.5, z]) });
  }
  g.add(mesh(boxUV(mergeAll(masts)), M.alumDark));

  // Set well back from the mount, and off the axis the launch cameras work along, so the
  // tanks read as part of the site rather than as furniture in front of the lens.
  const farm = new THREE.Group();
  farm.name = 'pad-farm';
  farm.position.z = -70;
  const slab = [block(PAD.farmX - 16, PAD.farmX + 20, -0.4, 1.2, -42, 42)];
  farm.add(mesh(boxUV(mergeAll(slab)), M.concrete));

  const tanks = [];
  for (let i = 0; i < 6; i++) {
    const z = -32 + i * 13;
    tanks.push({ geometry: new THREE.CylinderGeometry(4.5, 4.5, 21, 32), matrix: mat4([PAD.farmX, 1.2 + 10.5, z]) });
    tanks.push({ geometry: new THREE.SphereGeometry(4.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat4([PAD.farmX, 1.2 + 21, z]) });
  }
  for (const z of [-24, 8]) {
    tanks.push({ geometry: new THREE.CylinderGeometry(6.0, 6.0, 14, 32), matrix: mat4([PAD.farmX + 15, 1.2 + 7, z]) });
  }
  farm.add(mesh(boxUV(mergeAll(tanks)), M.aluminum));
  g.add(farm);
  return g;
}

// =========================================================================================
//  Pad infrastructure: trench coping parapets, safety handrails, deluge water pipelines,
//  cryogenic pipe bridge, equipment housekeeping skids, and industrial floodlight towers.
// =========================================================================================
function buildPadInfrastructure(M) {
  const g = new THREE.Group();
  g.name = 'pad-infrastructure';
  const { padY, trenchHalfW: tw, farmX } = PAD;

  // 1. Trench parapet coping curbs (reinforced concrete edge beam with hazard striping)
  const curbs = [];
  const curbYellow = [];
  for (const s of [-1, 1]) {
    const cx = s * (tw + 0.32);
    curbs.push(block(cx - 0.28, cx + 0.28, padY, padY + 0.45, -46, 46));
    curbYellow.push(block(s < 0 ? cx - 0.28 : cx + 0.14, s < 0 ? cx - 0.14 : cx + 0.28, padY + 0.42, padY + 0.46, -46, 46));
  }
  g.add(mesh(boxUV(mergeAll(curbs)), M.concrete));
  g.add(mesh(boxUV(mergeAll(curbYellow)), M.safetyYellow));

  // 2. Trench perimeter safety handrails (prevent falling 8.2 m into the pit)
  const rails = [];
  const railYellow = [];
  for (const s of [-1, 1]) {
    const rx = s * (tw + 0.65);
    for (const [z0, z1] of [[-45, -15], [15, 45]]) {
      for (const ry of [padY + 0.55, padY + 1.1]) {
        rails.push(block(rx - 0.03, rx + 0.03, ry - 0.02, ry + 0.02, z0, z1));
      }
      for (let z = z0; z <= z1; z += 3) {
        railYellow.push(block(rx - 0.04, rx + 0.04, padY, padY + 1.12, z - 0.04, z + 0.04));
      }
    }
  }
  g.add(mesh(boxUV(mergeAll(rails)), M.mount, { castShadow: false }));
  g.add(mesh(boxUV(mergeAll(railYellow)), M.safetyYellow, { castShadow: false }));

  // 3. Maintenance access stairs into trench
  const stairs = [];
  for (const s of [-1, 1]) {
    const sx = s * (tw - 1.2);
    for (let st = 0; st < 16; st++) {
      const frac = st / 16;
      const sy = 0.8 + frac * (padY - 0.8);
      const sz = (s > 0 ? 40 : -40) - frac * 5 * s;
      stairs.push(block(sx - 0.6, sx + 0.6, sy, sy + 0.12, sz - 0.35, sz + 0.35));
    }
  }
  g.add(mesh(boxUV(mergeAll(stairs)), M.steelGrating || M.mount));

  // 4. Vertical High-Pressure Deluge Tanks (Water Battery next to the pad)
  const delugeTankGroup = [];
  const delugeTankPipes = [];
  const tankX = 72;
  delugeTankGroup.push(block(tankX - 6, tankX + 6, -0.4, 1.2, -26, 26));
  for (let i = 0; i < 7; i++) {
    const tz = -21 + i * 7;
    delugeTankPipes.push({
      geometry: new THREE.CylinderGeometry(2.1, 2.1, 17, 24),
      matrix: mat4([tankX, 1.2 + 8.5, tz]),
    });
    delugeTankPipes.push({
      geometry: new THREE.SphereGeometry(2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      matrix: mat4([tankX, 1.2 + 17, tz]),
    });
  }
  delugeTankPipes.push({
    geometry: new THREE.CylinderGeometry(0.3, 0.3, 44, 16),
    matrix: mat4([tankX, 1.2 + 18.5, 0], [Math.PI / 2, 0, 0]),
  });
  g.add(mesh(boxUV(mergeAll(delugeTankGroup)), M.concrete));
  g.add(mesh(boxUV(mergeAll(delugeTankPipes)), M.pipePaint));

  // 5. Massive 48-Inch (1.2 m diameter) Deluge Water Supply Mains
  const bigPipes = [];
  const saddles = [];
  for (const pz of [-26, 26]) {
    bigPipes.push({
      geometry: new THREE.CylinderGeometry(0.6, 0.6, 58, 24),
      matrix: mat4([(tankX + 14) / 2, padY + 1.2, pz], [0, 0, Math.PI / 2]),
    });
    bigPipes.push({
      geometry: new THREE.CylinderGeometry(0.6, 0.6, 6.5, 24),
      matrix: mat4([14, padY - 2.0, pz]),
    });
    for (let px = 20; px <= tankX - 4; px += 10) {
      saddles.push(block(px - 0.8, px + 0.8, padY, padY + 0.6, pz - 1.0, pz + 1.0));
    }
  }
  g.add(mesh(boxUV(mergeAll(bigPipes)), M.pipePaint));
  g.add(mesh(boxUV(mergeAll(saddles)), M.concrete));

  // 6. Cryogenic Pipe Bridge & Racks (connecting Tank Farm to the Pad)
  const bridgeSteel = [];
  const bridgePipes = [];
  const bridgeCryo = [];
  const bz = -30;
  for (let bx = 66; bx <= farmX - 10; bx += 16) {
    bridgeSteel.push(block(bx - 0.25, bx + 0.25, 0, 8.5, bz - 2.2, bz - 1.8));
    bridgeSteel.push(block(bx - 0.25, bx + 0.25, 0, 8.5, bz + 1.8, bz + 2.2));
    bridgeSteel.push(block(bx - 0.3, bx + 0.3, 5.0, 5.3, bz - 2.2, bz + 2.2));
    bridgeSteel.push(block(bx - 0.3, bx + 0.3, 8.2, 8.5, bz - 2.2, bz + 2.2));
  }
  bridgeSteel.push(block(64, farmX, 8.2, 8.5, bz - 2.0, bz - 1.8));
  bridgeSteel.push(block(64, farmX, 8.2, 8.5, bz + 1.8, bz + 2.0));

  for (const oy of [5.7, 6.5]) {
    bridgeCryo.push({
      geometry: new THREE.CylinderGeometry(0.32, 0.32, farmX - 64, 16),
      matrix: mat4([(64 + farmX) / 2, oy, bz - 0.9], [0, 0, Math.PI / 2]),
    });
  }
  for (const oy of [5.7, 6.5]) {
    bridgePipes.push({
      geometry: new THREE.CylinderGeometry(0.28, 0.28, farmX - 64, 16),
      matrix: mat4([(64 + farmX) / 2, oy, bz + 0.9], [0, 0, Math.PI / 2]),
    });
  }
  g.add(mesh(boxUV(mergeAll(bridgeSteel)), M.mount));
  g.add(mesh(boxUV(mergeAll(bridgeCryo)), M.pipeCryo || M.conduit));
  g.add(mesh(boxUV(mergeAll(bridgePipes)), M.conduit));

  // 7. Pad Housekeeping Equipment Skids
  const skids = [];
  const cabinets = [];
  for (const sz of [-34, 34]) {
    skids.push(block(26 - 4, 26 + 4, padY, padY + 0.3, sz - 3, sz + 3));
    cabinets.push(block(26 - 2.5, 26 - 0.5, padY + 0.3, padY + 2.6, sz - 2, sz + 0.5));
    cabinets.push(block(26 + 0.5, 26 + 2.5, padY + 0.3, padY + 2.2, sz - 1.5, sz + 1.5));
  }
  g.add(mesh(boxUV(mergeAll(skids)), M.concrete));
  g.add(mesh(boxUV(mergeAll(cabinets)), M.darkMetal));

  // 8. Perimeter High-Mast Industrial Floodlight Towers
  const floodlights = [];
  for (const fx of [-54, 54]) for (const fz of [-44, 44]) {
    floodlights.push({
      geometry: new THREE.CylinderGeometry(0.25, 0.8, 28, 8),
      matrix: mat4([fx, padY + 14, fz]),
    });
    floodlights.push(block(fx - 2.2, fx + 2.2, padY + 27.5, padY + 28.5, fz - 0.6, fz + 0.6));
  }
  g.add(mesh(boxUV(mergeAll(floodlights)), M.alumDark));

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
  g.add(buildPadInfrastructure(M));
  dressPad(g, M, PAD.padY);

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
    boosterQds: ['methane', 'oxygen'].map(fluid => table.getObjectByName(`booster-qd-contact-${fluid}`)),
    holddowns: table.getObjectByName('holddowns'),
    qdArm: qd,
    chopsticks: chop,
  };
  // ---- Level of detail --------------------------------------------------------------------
  // The complex is nearly always looked at from a hundred metres or more, and a good deal of
  // what it carries is centimetres: the grating on the mount's catwalk and its handrail, the
  // deluge nozzles across the deck, the blue risers feeding them, the trim strips, the
  // carriage rail and the QD arm's flex lines. None of it changes the shape of anything.
  //
  // Everything structural stays at every distance — tower, mount, deck, clamps, arms, trench
  // and its armour — because the complex's silhouette is the reason it is there.
  const FINE = {
    'mount-catwalk': 0.05, 'mount-catwalk-rail': 0.05, 'mount-risers': 0.12,
    'deck-manifold': 0.2, 'deck-nozzles': 0.06, 'mount-trim': 0.09,
    'mount-rail': 0.1, 'trench-ramps': 0.3, 'qd-lines': 0.08,
    'mount-baseplates': 0.14, 'pad-cable-tray': 0.12, 'pad-valves': 0.18,
  };
  g.traverse((o) => { const f = FINE[o.name]; if (f) o.userData.lodFeature = f; });

  g.userData.annotations = [
    { label: 'Integration and launch tower · 144.5 m', position: [PAD.towerX - 9, PAD.padY + 96, 0] },
    { label: 'Catch arms · 36 m', position: [PAD.towerX + 16, PAD.armY + 4, -22] },
    { label: 'Ship quick-disconnect arm', position: [PAD.towerX + 14, PAD.qdY + 4, 0] },
    { label: 'Launch mount · water-cooled deck', position: [17, PAD.deckTop + 2.5, 14] },
    { label: '20 hold-down clamps', position: [8.5, PAD.deckTop + 3.6, -9] },
    { label: 'Bidirectional flame trench · 8.2 m', position: [0, PAD.trenchFloorY + 3, 40] },
  ];
  return g;
}
