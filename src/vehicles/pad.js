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
 *   cited    lightning rod and small weather station on the tower top; deluge water in
 *            horizontal tanks driven by compressed gas; a 95,000 gal horizontal LOX tank and
 *            an 80,000 gal methane tank in the farm, with LN2 subcoolers
 *   approx   every plan dimension, the deck and trench levels, the truss members, the
 *            distance from the tower to the mount, tank positions, counts and diameters
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
  farmX: 150.0,
};
PAD.towerH = PAD.section * PAD.sections + PAD.mast;   // 144,5 m
PAD.trenchDepth = PAD.padY - PAD.trenchFloorY;        // 8,2 m

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/**
 * Axis-aligned block given by its extents, as a {geometry, matrix} pair for mergeAll.
 * The extents may come in either order. They used not to: a mirrored call — the catch pads
 * on the north arm, written as −s·2.1 … −s·1.35 — made a box of negative depth, turned inside
 * out, whose inverted normals the ambient-occlusion pass read as fully buried: black pads
 * with scanline streaks.
 */
const block = (x0, x1, y0, y1, z0, z1) => ({
  geometry: B(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
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

  // Bidirectional flame diverter. Cited (Wikipedia, SpaceX Starbase): on Pad 2 it is built from
  // "many steel pipes" forming a flame bucket. It was drawn as a smooth steel wedge with a few
  // ribs. Now the wedge is a concrete core, and what the exhaust meets is a bed of steel pipes
  // laid across the trench, side by side down both slopes, fed from a header along each wall.
  // Pipe size, count and the header layout are reconstructed; the 4.2 m crest and 15 m run are
  // the old wedge's, so the trench's measured depth and clearances do not move.
  const core = [];
  const crest = trenchFloorY + 4.2, run = 15.0, drop = crest - trenchFloorY - 0.35;
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
    core.push({ geometry: e });
  }
  g.add(mesh(boxUV(mergeAll(core)), M.concrete, { name: 'trench-diverter-core' }));

  const pipes = [], headers = [];
  const PIPE_R = 0.24, slopeLen = Math.hypot(run, drop);
  const nx = drop / slopeLen, ny = run / slopeLen;        // slope normal, in (along-z, y)
  const span = (tw - 0.75) * 2;
  const n = Math.floor(slopeLen / (PIPE_R * 2.08));
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const z = s * (run * t + nx * PIPE_R), y = crest - drop * t + ny * PIPE_R;
      pipes.push({ geometry: new THREE.CylinderGeometry(PIPE_R, PIPE_R, span, 14), matrix: mat4([0, y, z], [0, 0, Math.PI / 2]) });
    }
    // Headers down each wall, just proud of the pipe ends.
    for (const x of [-(tw - 0.42), tw - 0.42]) {
      headers.push(rod([x, crest + 0.35, 0], [x, trenchFloorY + 0.35 + 0.35, s * run], 0.4, 16));
    }
  }
  // Ridge cap along the crest, where the two beds meet under the engines.
  headers.push({ geometry: new THREE.CylinderGeometry(0.42, 0.42, span + 0.6, 18), matrix: mat4([0, crest + 0.3, 0], [0, 0, Math.PI / 2]) });
  g.add(mesh(boxUV(mergeAll(pipes)), M.trenchArmor || M.darkMetal, { name: 'trench-ramps' }));
  g.add(mesh(boxUV(mergeAll(headers)), M.trenchArmor || M.darkMetal, { name: 'trench-diverter-headers' }));
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
//  Tower: 122 m of open square truss on a concrete foundation, lightning rod on top
// =========================================================================================
/** A straight member from a to b with a square (n = 4) or round section, for mergeAll. */
function rod(a, b, r, n = 4) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const len = A.distanceTo(Bv);
  const geometry = n === 4 ? B(r * 2, len, r * 2) : new THREE.CylinderGeometry(r, r, len, n);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
  const m = new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return { geometry, matrix: m };
}

function buildTower(M) {
  const g = new THREE.Group();
  g.name = 'olit';
  g.position.x = PAD.towerX;
  const { padY, towerHalf: h, section, sections, mast } = PAD;
  const base = padY, top = base + section * sections;

  g.add(mesh(boxUV(mergeAll([block(-9, 9, PAD.bermY, padY + 1.2, -9, 9)])), M.concrete));

  // The tower is a lattice you can see the sky through. It used to carry a solid 5.2 m box
  // up its middle as the "service core", which turned the whole 122 m into a dark slab at
  // every distance past a few hundred metres. Now: four corner columns, a horizontal ring
  // every half-section, two X-braced bays per face per section, and an open lift shaft and
  // stair inside. Member sizes are reconstructed from photographs; the height is cited.
  const steel = [], light = [];
  const c = h - 0.7;                       // corner-column centreline
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * c, z = sz * c;
    steel.push(block(x - 0.7, x + 0.7, base, top, z - 0.7, z + 0.7));
  }
  const half = section / 2;
  for (let y = base; y <= top + 0.01; y += half) {
    for (const s of [-1, 1]) {
      steel.push(block(-c, c, y - 0.3, y + 0.3, s * c - 0.3, s * c + 0.3));
      steel.push(block(s * c - 0.3, s * c + 0.3, y - 0.3, y + 0.3, -c, c));
    }
    // Plan bracing across the ring, every other level: keeps the square square.
    if (Math.round((y - base) / half) % 2 === 0) {
      light.push(rod([-c, y, -c], [c, y, c], 0.14));
      light.push(rod([-c, y, c], [c, y, -c], 0.14));
    }
  }
  for (let i = 0; i < sections * 2; i++) {
    const y0 = base + half * i, y1 = y0 + half;
    for (const s of [-1, 1]) {
      // Faces at z = ±c and x = ±c, one X per bay.
      steel.push(rod([-c, y0, s * c], [c, y1, s * c], 0.2));
      steel.push(rod([c, y0, s * c], [-c, y1, s * c], 0.2));
      steel.push(rod([s * c, y0, -c], [s * c, y1, c], 0.2));
      steel.push(rod([s * c, y0, c], [s * c, y1, -c], 0.2));
    }
  }
  // Lift shaft: four light columns and a frame every 3 m, open on all sides.
  const L = 1.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    light.push(block(sx * L - 0.14, sx * L + 0.14, base, top, sz * L - 0.14, sz * L + 0.14));
  }
  for (let y = base + 3; y < top; y += 3.05) {
    for (const s of [-1, 1]) {
      light.push(block(-L, L, y - 0.08, y + 0.08, s * L - 0.08, s * L + 0.08));
      light.push(block(s * L - 0.08, s * L + 0.08, y - 0.08, y + 0.08, -L, L));
    }
  }
  // Switchback stair on the landward side of the shaft: a landing every half-section and
  // a flight between each pair, alternating direction.
  for (let i = 0; i < sections * 2; i++) {
    const y0 = base + half * i, y1 = y0 + half;
    light.push(block(-c + 0.7, -L - 0.3, y1 - 0.12, y1, -3.6, -1.0));        // landing
    const dir = i % 2 === 0 ? 1 : -1;
    light.push(rod([-3.3, y0, -2.3 - dir * 1.2], [-3.3, y1, -2.3 + dir * 1.2], 0.12));
    light.push(rod([-2.2, y0, -2.3 - dir * 1.2], [-2.2, y1, -2.3 + dir * 1.2], 0.12));
  }
  // Grated work decks where the tower does its work: at the QD arm and at the crown.
  const decks = [];
  for (const y of [PAD.qdY - 1.6, top - 0.2]) decks.push(block(-c, c, y - 0.1, y + 0.1, -c, c));
  // Carriage rails on the pad face.
  for (const s of [-1, 1]) steel.push(block(h - 0.35, h + 0.45, base, top, s * 3.4 - 0.45, s * 3.4 + 0.45));
  g.add(mesh(boxUV(mergeAll(steel)), M.mount, { name: 'tower-truss' }));
  g.add(mesh(boxUV(mergeAll(light)), M.steelGrating, { name: 'tower-core', castShadow: true }));
  g.add(mesh(boxUV(mergeAll(decks)), M.steelGrating, { name: 'tower-decks' }));

  // Crown: a lightning rod that takes the tower to its published 144,5 m, and the small
  // weather station beside it (both cited: Wikipedia, SpaceX Starbase). The station's mast
  // is well under the rod's tip, so the measured height stays the rod's.
  const crown = [];
  const spire = new THREE.CylinderGeometry(0.16, 0.75, mast, 12);
  spire.translate(0, top + mast / 2, 0);
  crown.push({ geometry: spire });
  const wx = c - 1.2, wz = -c + 1.2;
  crown.push(rod([wx, top, wz], [wx, top + 6, wz], 0.07, 8));
  crown.push(rod([wx - 0.9, top + 5.6, wz], [wx + 0.9, top + 5.6, wz], 0.035, 6));
  crown.push({ geometry: B(0.45, 0.6, 0.3), matrix: mat4([wx, top + 1.6, wz + 0.25]) });
  for (const d of [-0.9, 0.9]) {
    crown.push({ geometry: new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), matrix: mat4([wx + d, top + 5.8, wz]) });
  }
  g.add(mesh(boxUV(mergeAll(crown)), M.alumDark, { name: 'mast' }));

  // ---- Carriage hoist --------------------------------------------------------------------
  // Cited (Wikipedia, SpaceX Starbase): the chopstick carriage hangs from a pulley at the top of
  // the tower and is driven by a winch and spool at its base. It used to hang from nothing.
  // Built here: a sheave frame on the crown over the pad face, two cable falls from it down to
  // the carriage (their length follows the carriage; see userData.hoist), the return runs down
  // inside the truss, and a winch skid with two drums beside the tower foot. Sizes reconstructed.
  const face = h + 0.9;                  // the carriage's inner face, as buildChopsticks has it
  const sheaveY = top - 1.8;
  const hoist = [];
  hoist.push(block(h - 1.2, face + 1.4, top - 0.4, top + 0.4, -2.6, 2.6));       // crown beam
  for (const z of [-2.2, 2.2]) hoist.push(block(face + 0.6, face + 1.4, sheaveY - 1.3, top, z - 0.35, z + 0.35));
  const sheaves = [];
  for (const z of [-1.5, 1.5]) {
    sheaves.push({ geometry: new THREE.CylinderGeometry(1.1, 1.1, 0.35, 28), matrix: mat4([face + 0.2, sheaveY, z], [Math.PI / 2, 0, 0]) });
    sheaves.push({ geometry: new THREE.CylinderGeometry(0.22, 0.22, 4.6, 12), matrix: mat4([face + 0.2, sheaveY, 0], [Math.PI / 2, 0, 0]) });
  }
  // Winch skid on the landward side of the foot, and the return falls up inside the truss.
  const hx = -h - 5.5;
  hoist.push(block(hx - 3.5, hx + 3.5, padY, padY + 0.6, -5, 5));                  // skid
  for (const z of [-2.4, 2.4]) {
    sheaves.push({ geometry: new THREE.CylinderGeometry(1.25, 1.25, 2.4, 32), matrix: mat4([hx, padY + 2.2, z], [Math.PI / 2, 0, 0]) });
    hoist.push(block(hx - 1.4, hx + 1.4, padY + 0.6, padY + 1.2, z - 1.5, z + 1.5));   // drum pedestal
    hoist.push(block(hx + 1.9, hx + 3.3, padY + 0.6, padY + 2.4, z - 0.9, z + 0.9));   // motor
  }
  const cable = [];
  for (const z of [-1.5, 1.5]) {
    cable.push(rod([hx, padY + 3.4, z * 1.6], [-h + 1.2, padY + 6, z], 0.06, 6));
    cable.push(rod([-h + 1.2, padY + 6, z], [-h + 1.2, sheaveY + 1.0, z], 0.06, 6));
    cable.push(rod([-h + 1.2, sheaveY + 1.0, z], [face - 0.9, sheaveY + 1.0, z], 0.06, 6));
  }
  g.add(mesh(boxUV(mergeAll(hoist)), M.mount, { name: 'hoist-frame' }));
  g.add(mesh(boxUV(mergeAll(sheaves)), M.darkMetal, { name: 'hoist-sheaves' }));
  g.add(mesh(boxUV(mergeAll(cable)), M.darkMetal, { name: 'hoist-cable-return', castShadow: false }));
  // The two falls from the sheaves to the carriage: unit-length rods hung from the sheave,
  // stretched to reach the carriage wherever it is.
  const fallGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6);
  fallGeo.translate(0, -0.5, 0);
  const falls = [];
  // Untextured: the falls are stretched to length, and a metric map on a unit rod would be
  // smeared along it (the integrity gate rejects exactly that). A wire rope reads as its
  // colour and sheen anyway.
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, metalness: 0.7, roughness: 0.45 });
  for (const z of [-1.5, 1.5]) {
    const f = mesh(fallGeo, ropeMat, { name: 'hoist-fall', castShadow: false });
    f.position.set(face + 1.3, sheaveY, z);   // off the outboard edge of the sheave
    g.add(f);
    falls.push(f);
  }
  const carriageTop = 3.2;                    // the carriage block's top, in its own frame
  /** @param carriageY the chopstick group's y in the complex frame, as launch.js sets it */
  g.userData.hoist = (carriageY) => {
    const len = Math.max(0.5, sheaveY - (carriageY + carriageTop));
    for (const f of falls) f.scale.y = len;
    return len;
  };
  g.userData.hoist(PAD.armY);
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
    // A box truss in the envelope the solid beam had (36 m × 3.4 m × 2.7 m, so the catch
    // geometry the gate measures is unchanged): four chords, a post every 3 m, a diagonal
    // per bay on the two vertical faces and on the bottom, and a closed deck on top that
    // carries the rail the booster's pins land on. Member sizes are reconstructed.
    const A = PAD.armLen, hy = 1.7, hz = 1.35, k = 0.24;
    const parts = [];
    for (const y of [-hy + k, hy - k]) for (const z of [-hz + k, hz - k]) {
      parts.push(block(0, A, y - k, y + k, z - k, z + k));
    }
    const bays = 12, bay = A / bays;
    for (let i = 0; i <= bays; i++) {
      const x = Math.min(A - k, Math.max(k, i * bay));
      for (const z of [-hz + k, hz - k]) parts.push(block(x - 0.16, x + 0.16, -hy, hy, z - 0.16, z + 0.16));
      parts.push(block(x - 0.16, x + 0.16, -hy + 0.1, -hy + 0.4, -hz, hz));
      if (i === bays) break;
      const x0 = i * bay, x1 = x0 + bay, up = i % 2 === 0 ? 1 : -1;
      for (const z of [-hz + k, hz - k]) parts.push(rod([x0, -up * (hy - k), z], [x1, up * (hy - k), z], 0.13));
      parts.push(rod([x0, -hy + k, -up * (hz - k)], [x1, -hy + k, up * (hz - k)], 0.1));
    }
    parts.push(block(0.6, A - 0.6, hy - 0.2, hy, -hz, hz));                 // top deck
    parts.push(block(2, A - 2, hy, 2.3, -1.0, 1.0));                          // catch rail
    // Root: a solid plated section where the arm meets its hinge on the carriage.
    parts.push(block(0, 3.2, -hy, hy, -hz, hz));
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
  // A box truss like the catch arms, in the envelope the solid beam had, ending in the hood
  // that closes over the ship's quick-disconnect panel. It was one 18.5 m block: from the
  // ground the arm read as a plank bolted to the tower. Member sizes are reconstructed.
  const hy = 1.3, hz = 1.2, k = 0.2;
  const beam = [];
  for (const y of [-hy + k, hy - k]) for (const z of [-hz + k, hz - k]) beam.push(block(0, L - 2.4, y - k, y + k, z - k, z + k));
  const bays = 6, bay = (L - 2.4) / bays;
  for (let i = 0; i <= bays; i++) {
    const x = Math.min(L - 2.4 - k, Math.max(k, i * bay));
    for (const z of [-hz + k, hz - k]) beam.push(block(x - 0.14, x + 0.14, -hy, hy, z - 0.14, z + 0.14));
    for (const y of [-hy + k, hy - k]) beam.push(block(x - 0.12, x + 0.12, y - 0.12, y + 0.12, -hz, hz));
    if (i === bays) break;
    const x0 = i * bay, x1 = x0 + bay, up = i % 2 === 0 ? 1 : -1;
    for (const z of [-hz + k, hz - k]) beam.push(rod([x0, -up * (hy - k), z], [x1, up * (hy - k), z], 0.11));
    for (const y of [-hy + k, hy - k]) beam.push(rod([x0, y, -up * (hz - k)], [x1, y, up * (hz - k)], 0.09));
  }
  beam.push(block(0, 1.6, -hy, hy, -hz, hz));                                  // hinge root
  beam.push(block(0.4, L - 3, hy, hy + 0.12, -0.9, 0.9));                       // walkway deck
  pivot.add(mesh(boxUV(mergeAll(beam)), M.mount, { name: 'qd-beam' }));
  // The hood: a box open towards the ship, with a lip round its mouth.
  const hood = [
    block(L - 2.4, L - 2.1, -2.1, 2.1, -1.9, 1.9),        // back plate
    block(L - 2.4, L + 0.4, 1.8, 2.1, -1.9, 1.9),          // roof
    block(L - 2.4, L + 0.4, -2.1, -1.8, -1.9, 1.9),        // floor
    block(L - 2.4, L + 0.4, -2.1, 2.1, -1.9, -1.6),        // sides
    block(L - 2.4, L + 0.4, -2.1, 2.1, 1.6, 1.9),
  ];
  pivot.add(mesh(boxUV(mergeAll(hood)), M.mount, { name: 'qd-hood' }));
  // Walkway handrail along the deck.
  const rail = [];
  // Outboard of the three umbilicals, which run at z = −0.85, 0 and 0.85.
  for (const z of [-1.08, 1.08]) {
    rail.push(block(0.5, L - 3.1, hy + 1.1, hy + 1.16, z - 0.03, z + 0.03));
    for (let x = 0.6; x < L - 3; x += 1.8) rail.push(block(x - 0.03, x + 0.03, hy + 0.12, hy + 1.16, z - 0.03, z + 0.03));
  }
  pivot.add(mesh(boxUV(mergeAll(rail)), M.safetyYellow, { name: 'qd-rail', castShadow: false }));
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

/**
 * Cryogenic tank farm, set back from the pad on the landward side.
 *
 * Cited (Wikipedia, SpaceX Starbase): the farm holds methane, liquid oxygen, water, nitrogen,
 * helium and hydraulic fluid; it includes a 95,000 US gal horizontal LOX tank and an 80,000
 * US gal methane tank; subcoolers beside it chill the propellant with liquid nitrogen.
 * Reconstructed: the row of tall vertical storage tanks, every position and diameter. The two
 * horizontal tanks take their LENGTH from the cited volume at an assumed 3.8 m diameter, so
 * their proportions follow the published capacity rather than a guess.
 *
 * The two free-standing 150 m lightning masts that used to stand here are gone: no source
 * places any at Pad 2, and the one cited lightning rod is on top of the tower.
 */
const GAL = 0.003785411784;   // m³ per US gallon
/** Length of a cylinder with hemispherical heads that holds `m3` at radius r. */
const capsuleLength = (m3, r) => (m3 - (4 / 3) * Math.PI * r ** 3) / (Math.PI * r * r);

function buildField(M) {
  const g = new THREE.Group();
  g.name = 'pad-field';

  const farm = new THREE.Group();
  farm.name = 'pad-farm';
  farm.position.z = -70;
  const fx = PAD.farmX;
  const slab = [block(fx - 18, fx + 34, -0.4, 1.2, -44, 44)];
  farm.add(mesh(boxUV(mergeAll(slab)), M.concrete));

  // Tall vertical storage: a shell with stiffening rings, a domed head, a railed roof
  // platform and a caged ladder. Six in a row, as the old block-out had them.
  const shells = [], rings = [], rails = [], pipes = [];
  const R = 4.5, H = 21, y0 = 1.2;
  for (let i = 0; i < 6; i++) {
    const z = -32 + i * 13;
    shells.push({ geometry: new THREE.CylinderGeometry(R, R, H, 40, 1, true), matrix: mat4([fx, y0 + H / 2, z]) });
    shells.push({ geometry: new THREE.SphereGeometry(R, 40, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), matrix: mat4([fx, y0 + H - R * Math.cos(Math.PI * 0.32) + 0.02, z]) });
    for (let y = y0 + 2.5; y < y0 + H; y += 3.1) {
      rings.push({ geometry: new THREE.TorusGeometry(R + 0.06, 0.09, 6, 48), matrix: mat4([fx, y, z], [Math.PI / 2, 0, 0]) });
    }
    rings.push({ geometry: new THREE.CylinderGeometry(R + 0.25, R + 0.4, 0.8, 40), matrix: mat4([fx, y0 + 0.4, z]) });   // skirt
    // Roof rail round the head, and a caged ladder up the landward side.
    const topY = y0 + H + 1.2;
    rails.push({ geometry: new THREE.TorusGeometry(R * 0.72, 0.04, 4, 40), matrix: mat4([fx, topY + 1.0, z], [Math.PI / 2, 0, 0]) });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      rails.push(rod([fx + Math.cos(a) * R * 0.72, topY - 0.6, z + Math.sin(a) * R * 0.72], [fx + Math.cos(a) * R * 0.72, topY + 1.0, z + Math.sin(a) * R * 0.72], 0.03));
    }
    rails.push(rod([fx + R + 0.35, y0, z - 0.3], [fx + R + 0.35, topY, z - 0.3], 0.035));
    rails.push(rod([fx + R + 0.35, y0, z + 0.3], [fx + R + 0.35, topY, z + 0.3], 0.035));
    for (let y = y0 + 2.4; y < topY; y += 1.2) {
      rails.push({ geometry: new THREE.TorusGeometry(0.45, 0.025, 4, 12, Math.PI), matrix: mat4([fx + R + 0.55, y, z], [Math.PI / 2, 0, -Math.PI / 2]) });
    }
    // Fill and draw line from the base into the header.
    pipes.push(rod([fx - R - 0.2, y0 + 1.4, z], [fx - R - 3.2, y0 + 1.4, z], 0.22, 10));
  }
  pipes.push(rod([fx - R - 3.2, y0 + 1.4, -42], [fx - R - 3.2, y0 + 1.4, 42], 0.32, 12));   // header

  // The two cited horizontal tanks on saddles, alongside the row: LOX and methane.
  const r = 1.9;
  const horiz = [];
  const saddles = [];
  // [volume, start z, z of the gap in the vertical row that its line runs through]
  for (const [gal, z, lineZ] of [[95000, -30, -25.5], [80000, 6, 13.5]]) {
    const len = capsuleLength(gal * GAL, r);
    const x = fx + 19;
    horiz.push({ geometry: new THREE.CylinderGeometry(r, r, len, 36), matrix: mat4([x, y0 + 2.6, z + len / 2], [Math.PI / 2, 0, 0]) });
    for (const e of [0, len]) {
      horiz.push({ geometry: new THREE.SphereGeometry(r, 36, 12), matrix: mat4([x, y0 + 2.6, z + e]) });
    }
    for (let k = 0; k < 4; k++) {
      const sz = z + len * (0.12 + 0.76 * (k / 3));
      saddles.push(block(x - 1.6, x + 1.6, y0, y0 + 1.4, sz - 0.4, sz + 0.4));
    }
    pipes.push(rod([x - r, y0 + 2.6, lineZ], [fx - R - 3.2, y0 + 1.4, lineZ], 0.18, 8));
  }

  // Subcooler skids: a nitrogen tank and a boxed heat-exchanger/pump unit each. The
  // arrangement is reconstructed; that the subcoolers exist and use LN2 is cited.
  const units = [];
  for (const [z, lineZ] of [[-38, -40], [38, 39]]) {
    const x = fx + 29;
    units.push(block(x - 3.5, x + 3.5, y0, y0 + 3.6, z - 5, z + 1.5));
    units.push(block(x - 2.6, x + 2.6, y0 + 3.6, y0 + 4.2, z - 4.2, z + 0.7));
    horiz.push({ geometry: new THREE.CylinderGeometry(1.6, 1.6, 13, 28), matrix: mat4([x, y0 + 6.5, z + 4.2]) });
    horiz.push({ geometry: new THREE.SphereGeometry(1.6, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat4([x, y0 + 13, z + 4.2]) });
    pipes.push(rod([x - 3.5, y0 + 2.2, lineZ], [fx - R - 3.2, y0 + 2.2, lineZ], 0.16, 8));
  }

  farm.add(mesh(boxUV(mergeAll(shells)), M.pipePaint, { name: 'farm-tanks' }));
  farm.add(mesh(boxUV(mergeAll(horiz)), M.pipeCryo, { name: 'farm-horizontal-tanks' }));
  farm.add(mesh(boxUV(mergeAll(rings)), M.alumDark, { name: 'farm-tank-rings' }));
  farm.add(mesh(boxUV(mergeAll(rails)), M.safetyYellow, { name: 'farm-rails', castShadow: false }));
  farm.add(mesh(boxUV(mergeAll(pipes)), M.pipeCryo, { name: 'farm-pipes' }));
  farm.add(mesh(boxUV(mergeAll(saddles)), M.concrete, { name: 'farm-saddles' }));
  farm.add(mesh(boxUV(mergeAll(units)), M.darkMetal, { name: 'farm-subcoolers' }));
  g.add(farm);
  return g;
}

// =========================================================================================
//  Pad infrastructure: trench coping parapets, safety handrails, deluge water storage and
//  mains, cryogenic pipe bridge and equipment skids. No floodlight towers: nothing cites any,
//  and the four 28 m poles that stood here read as street lamps round the pad.
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

  // 4. Deluge water storage. Cited (Wikipedia, SpaceX Starbase; NASASpaceflight): the water
  // is held in a tank farm of HORIZONTAL tanks and driven out by compressed gas. Count and
  // size are reconstructed. They stand on grade past the toe of the berm — the old vertical
  // "water battery" stood on a slab buried inside the berm, with its mains floating 7 m in
  // the air where the pad deck ended.
  const tankX = 96, tankR = 1.8, tankLen = 11;
  const delugeSlab = [block(tankX - 8, tankX + 8, -0.4, 0.6, -24, 24)];
  const delugeTanks = [], delugeSaddles = [], delugePipes = [];
  for (let i = 0; i < 7; i++) {
    const tz = -18 + i * 6;
    delugeTanks.push({ geometry: new THREE.CylinderGeometry(tankR, tankR, tankLen, 32), matrix: mat4([tankX, 0.6 + tankR + 0.9, tz], [0, 0, Math.PI / 2]) });
    for (const e of [-1, 1]) {
      delugeTanks.push({ geometry: new THREE.SphereGeometry(tankR, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat4([tankX + e * tankLen / 2, 0.6 + tankR + 0.9, tz], [0, 0, -e * Math.PI / 2]) });
      delugeSaddles.push(block(tankX + e * 3.4 - 0.4, tankX + e * 3.4 + 0.4, 0.6, 0.6 + 1.6, tz - 1.3, tz + 1.3));
    }
    delugePipes.push(rod([tankX - tankLen / 2 - tankR + 0.2, 0.6 + tankR + 0.9, tz], [tankX - 9, 1.1, tz], 0.2, 10));
  }
  delugePipes.push(rod([tankX - 9, 1.1, -20], [tankX - 9, 1.1, 20], 0.45, 16));   // manifold
  g.add(mesh(boxUV(mergeAll(delugeSlab)), M.concrete, { name: 'deluge-slab' }));
  g.add(mesh(boxUV(mergeAll(delugeTanks)), M.pipePaint, { name: 'deluge-tanks' }));
  g.add(mesh(boxUV(mergeAll(delugeSaddles)), M.concrete, { name: 'deluge-saddles' }));

  // 5. Deluge mains, 1.2 m, from the manifold to the mount: along grade, up the berm slope,
  // across the berm, up the pad's retaining face and along the deck. Concrete saddles carry
  // them wherever they run on a surface.
  const saddles = [];
  const { bermY } = PAD;
  for (const pz of [-20, 20]) {
    const path = [
      [tankX - 9, 1.1, pz], [83.5, 1.1, pz],               // grade
      [74, bermY + 0.7, pz], [65, bermY + 0.7, pz],          // up the fill, across the berm
      [65, padY + 0.7, pz], [14, padY + 0.7, pz],            // up the face, along the deck
      [14, padY - 2.0, pz],                                   // down into the mount's feed
    ];
    for (let k = 0; k < path.length - 1; k++) delugePipes.push(rod(path[k], path[k + 1], 0.6, 20));
    for (let px = 20; px <= 60; px += 10) saddles.push(block(px - 0.8, px + 0.8, padY, padY + 0.3, pz - 1.0, pz + 1.0));
    saddles.push(block(66, 67.6, bermY, bermY + 0.3, pz - 1.0, pz + 1.0));
    saddles.push(block(86, 87.6, 0, 0.6, pz - 1.0, pz + 1.0));
  }
  g.add(mesh(boxUV(mergeAll(delugePipes)), M.pipePaint, { name: 'deluge-mains' }));
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

  // The four lines. They used to stop dead against the pad's retaining wall, six metres up.
  // Now each rises at the pad edge, crosses the deck at 4.4 m on T-posts (clear of the deluge
  // mains at 0.7 m and of the bunker doors), and turns in to its room of the booster fluid
  // bunker: two lines to the methane side, two to the oxygen side. The turns are staggered so
  // no line crosses another. Routing reconstructed.
  const X0 = 67, riseX = 66.3, runH = padY + 4.4;
  const lines = [
    { y: 5.7, z: bz - 1.2, zEnd: -3.4, cryo: true },
    { y: 6.5, z: bz - 0.4, zEnd: -1.4, cryo: true },
    { y: 5.7, z: bz + 0.4, zEnd: 1.4, cryo: false },
    { y: 6.5, z: bz + 1.2, zEnd: 3.4, cryo: false },
  ];
  const posts = [];
  lines.forEach((ln, i) => {
    const r = ln.cryo ? 0.32 : 0.28;
    const out = ln.cryo ? bridgeCryo : bridgePipes;
    out.push({ geometry: new THREE.CylinderGeometry(r, r, farmX - X0, 16), matrix: mat4([(X0 + farmX) / 2, ln.y, ln.z], [0, 0, Math.PI / 2]) });
    const xt = 26 + i;                                   // staggered turn: inner line turns last
    const path = [[X0, ln.y, ln.z], [riseX, ln.y, ln.z], [riseX, runH, ln.z], [xt, runH, ln.z], [xt, runH, ln.zEnd], [23.0, runH, ln.zEnd]];
    for (let k = 0; k < path.length - 1; k++) out.push(rod(path[k], path[k + 1], r, 14));
    for (let k = 1; k < path.length - 1; k++) out.push({ geometry: new THREE.SphereGeometry(r * 1.05, 14, 10), matrix: mat4(path[k]) });   // elbows
  });
  // T-posts under the deck run and the northward legs.
  for (let x = 62; x >= 32; x -= 6) {
    posts.push(block(x - 0.15, x + 0.15, padY, runH - 0.4, bz - 0.15, bz + 0.15));
    posts.push(block(x - 0.2, x + 0.2, runH - 0.4, runH - 0.34, bz - 1.7, bz + 1.7));
  }
  for (let z = bz + 6; z <= -6; z += 6) {
    posts.push(block(27.35, 27.65, padY, runH - 0.4, z - 0.15, z + 0.15));
    posts.push(block(25.5, 29.5, runH - 0.4, runH - 0.34, z - 0.2, z + 0.2));
  }
  g.add(mesh(boxUV(mergeAll(posts)), M.mount, { name: 'pad-pipe-posts' }));
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

  return g;
}

// =========================================================================================
export function buildLaunchComplex(M) {
  const g = new THREE.Group();
  g.name = 'launch-complex';
  g.add(buildGround(M));
  const table = buildMountTable(M);
  g.add(table);
  const tower = buildTower(M);
  g.add(tower);
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
    // Call after moving the carriage: stretches the hoist falls down to it.
    hoist: (y) => tower.userData.hoist(y),
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
    'mount-rail': 0.1, 'trench-ramps': 0.3, 'qd-lines': 0.08, 'qd-rail': 0.05,
    'mount-baseplates': 0.14, 'pad-cable-tray': 0.12, 'pad-valves': 0.18,
    'hoist-cable-return': 0.12,
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
