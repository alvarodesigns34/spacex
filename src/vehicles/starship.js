/**
 * Starship (Version 3 / Block 3) — Super Heavy booster + Starship ship, stacked.
 *
 * Verified figures (spacex.com unless noted): stack 124 m, diameter 9 m, booster 72 m,
 * ship 52 m, 33 Raptor on the booster (13 gimballing inner + 20 fixed outer, Wikipedia),
 * 3 Raptor + 3 RVac on the ship, Raptor 1.3 m × 2.9 m, RVac 2.3 m × 4.4 m, steel rings
 * 1.83 m, 3 grid fins in a 90°/90°/180° layout ~1.5× the size of V1/V2 fins and integrated
 * with the catch pins (Wikipedia), 1.8 m vented hot-stage section, ≈18 000 hexagonal silica
 * tiles ≈0.26 m across the flats (≈12 in point to point, press reports).
 *
 * Section boundaries are DERIVED, not published: every station below is an integer number of
 * 1.83 m rings, and the tank split follows the published propellant masses at LOX/LCH4
 * density. Flap planforms, chines, raceways and fin lattices are approximations from imagery.
 */
import * as THREE from 'three';
import {
  lathe, ogiveProfile, mesh, mergeAll, mat4, hexPrism, tileSurfaceOfRevolution, tilePolygon,
  profileAt, seeded, plate, aeroPlate, spanTaper, boxUV, tube,
} from '../geometry/utils.js';
import { raptorGeometry, raptorVacGeometry, instanceEngines, ringLayout } from './engines.js';

const R = 4.5;                 // 9 m diameter (spacex.com)
/** The hull radius the pad's clamps and seat have to meet. Exported so they can derive it. */
export const BOOSTER_R = R;
const RING = 1.83;             // steel ring height (Wikipedia)
const BOOSTER_H = 72;          // spacex.com
const SHIP_H = 52;             // spacex.com
const rings = (n) => n * RING; // helper: express a station as a ring count
// Leeward-side furniture, kept clear of each other (φ measured from the belly, +Z).
const RACE_PHI = Math.PI * 0.78;
const DOOR_PHI = Math.PI * 1.18;
/**
 * Exhibit yaw applied in main.js so the tile line, not the belly, faces the default camera.
 * Catch pins have to land on the pad's ±Z after this rotation: Mechazilla's arms close on
 * that axis (tower at −X). Keep this number in one place so the fins and the mount cannot
 * drift apart by 40° again.
 */
export const STARSHIP_YAW_DEG = 129.6;

// Tile geometry: reported ≈12 in (0.305 m) point to point → circumradius ≈0.152 m,
// ≈0.264 m across the flats. Instanced; ~13 500 of them cover the ship.
const TILE_R = 0.152;
const TILE_T = 0.016;

/**
 * The 33 Raptors, as three rings of (count, radius, y). Named rather than inlined because the
 * launch mount has to cut a hole the exhaust fits through, and it was cutting one 43 cm too
 * small: the outer ring sits at 3.86 m and a Raptor's exit plane is 0.62 m across the radius,
 * so the outermost bell rims reach 4.48 m — while the mount's water-cooled seat had a 4.05 m
 * throat hard-coded into it. Twenty bells hung over the steel lip, in the one view (the flame
 * trench) that looks straight up at it.
 */
const RAPTOR_EXIT_R = 0.62;
// y = 0 is the skirt / pad seat. Bells hang a little below so the trench can see them, the
// way Falcon 9 hangs Merlin below the tank datum. The outer ring's exit is the widest point;
// at the seat plane the bell has already tapered inboard of the 4.50 m skirt.
const ENGINE_HANG = 0.38;
const BOOSTER_RINGS = [[3, 1.02, 0.45 - ENGINE_HANG, Math.PI / 6], [10, 2.48, 0.35 - ENGINE_HANG, 0], [20, 3.86, 0.25 - ENGINE_HANG, Math.PI / 20]];
/** Radius the booster's engine bells actually reach at the EXIT plane. */
export const RAPTOR_ENVELOPE_R = Math.max(...BOOSTER_RINGS.map(([, r]) => r)) + RAPTOR_EXIT_R;
/** Inner radius of the annular seat the skirt sits on — inboard of the 9 m hull. */
export const RAPTOR_SEAT_R = BOOSTER_R - 0.08;

// ---------------------------------------------------------------------------------------
//  Shared sub-assemblies
// ---------------------------------------------------------------------------------------

/**
 * Lattice control surface. Real grid fins are an orthogonal waffle of thin webs inside a
 * closed frame; the cell count and web thickness here are read off photographs.
 */
function gridFin(M, { span = 5.4, chord = 3.5, depth = 0.42, cells = [8, 5], web = 0.05 } = {}) {
  const parts = [];
  const frame = 0.09;
  // Closed outer frame (span runs along +X, chord along ±Z, lattice depth along Y).
  parts.push({ geometry: new THREE.BoxGeometry(span, depth, frame), matrix: mat4([span / 2, 0, chord / 2 - frame / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(span, depth, frame), matrix: mat4([span / 2, 0, -chord / 2 + frame / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(frame, depth, chord), matrix: mat4([span - frame / 2, 0, 0]) });
  parts.push({ geometry: new THREE.BoxGeometry(frame, depth, chord), matrix: mat4([frame / 2, 0, 0]) });
  // Internal webs.
  for (let i = 1; i < cells[0]; i++) parts.push({ geometry: new THREE.BoxGeometry(web, depth, chord), matrix: mat4([(span * i) / cells[0], 0, 0]) });
  for (let j = 1; j < cells[1]; j++) parts.push({ geometry: new THREE.BoxGeometry(span, depth * 0.94, web), matrix: mat4([span / 2, 0, -chord / 2 + (chord * j) / cells[1]]) });
  const g = new THREE.Group();
  g.add(mesh(boxUV(mergeAll(parts)), M.steelWarm));
  return g;
}

/**
 * How far below the grid-fin station the catch pin sits. Published as part of the booster's
 * stations because the tower has to close its arms on it: the launch sequence used to carry
 * its own carriage height as a literal, and that literal was 6.8 m low, so the arms closed
 * around the methane tank while the pins hung in the air above them.
 */
const PIN_DROP = 1.5;

/**
 * Block 3 grid-fin assembly: the fin, its hinge shroud, the internal electric actuator and
 * the catch pin, which Block 3 integrates into the fin root rather than mounting separately.
 */
function gridFinAssembly(M, { withPin = true, span = 5.4, chord = 3.5, depth = 0.42 } = {}) {
  const g = new THREE.Group();
  g.name = 'grid-fin-assembly';
  const fin = gridFin(M, { span, chord, depth });
  fin.name = 'grid-fin-lattice';
  // Same Euler as Falcon 9: span → vertical, depth → radial. Without it the waffle is a
  // 5.4 × 3.5 m shelf, 42 cm tall — which is what the gridfins preset was looking at.
  fin.rotation.set(0, Math.PI / 2, Math.PI / 2);
  fin.position.set(0.75, -span * 0.18, 0);
  // Hinge is a child so the launch sequence can stow the waffle against the tank without
  // moving the catch pin, which lives on the root (the tower takes the vehicle's weight
  // there whether the fin is out or not).
  const hinge = new THREE.Group();
  hinge.name = 'grid-fin-hinge';
  hinge.userData.stowY = Math.PI / 2;
  hinge.add(fin);
  g.add(hinge);
  // SpaceX's 12 May 2026 V3 update places the shaft, actuator and fixed structure
  // inside the fuel tank. Only the fin-root fairing remains outside. The internal
  // envelope below is a reconstruction, not a published equipment dimension.
  g.add(mesh(new THREE.CylinderGeometry(depth * 0.85, depth * 0.85, chord, 20), M.steelSkirt, { position: [0.62, 0, 0], rotation: [Math.PI / 2, 0, 0], name: 'grid-fin-root' }));
  const actuator = new THREE.Group();
  actuator.name = 'grid-fin-internal-actuator';
  actuator.userData.reconstruction = true;
  actuator.visible = false; // Internal envelope retained for inspection checks, fully occluded by tank skin.
  actuator.add(mesh(new THREE.BoxGeometry(1.0, depth + 0.85, chord * 0.88), M.steelSkirt, { position: [-1.15, 0, 0] }));
  actuator.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 20), M.darkMetal, { position: [-1.15, -0.95, 0], rotation: [Math.PI / 2, 0, 0] }));
  g.add(actuator);
  if (withPin) {
    // Catch pin: a stub that the tower arms take the vehicle's weight on.
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.35, 24), M.darkMetal, { position: [0.95, -PIN_DROP, 0], rotation: [0, 0, -Math.PI / 2], name: 'catch-pin' }));
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 24), M.aluminum, { position: [1.6, -PIN_DROP, 0], rotation: [0, 0, -Math.PI / 2] }));
    g.add(mesh(new THREE.BoxGeometry(0.8, 1.5, 1.5), M.steelSkirt, { position: [0.2, -PIN_DROP, 0] }));
  }
  return g;
}

/**
 * Longitudinal conduit fairing (the raceway that carries pressurisation lines and cabling
 * up the outside of both stages). Built as a rounded half-section so it reads as sheet metal
 * wrapped over pipework rather than a box.
 */
/**
 * Longitudinal conduit fairing: a shallow half-section of sheet metal laid over the plumbing
 * and faired out at both ends. Built in the frame the caller places it in — local +Z points
 * radially outward, +Y runs along the vehicle, +X is tangential — so `width` is how far it
 * wraps around the hull and `depth` how far it stands off it.
 */
function raceway(M, length, { width = 0.9, depth = 0.24, material = null } = {}) {
  const taper = Math.min(length * 0.07, 2.2);
  const stations = [
    { s: 0.12, y: -length / 2 }, { s: 1, y: -length / 2 + taper },
    { s: 1, y: length / 2 - taper }, { s: 0.12, y: length / 2 },
  ];
  const SEG = 14, row = SEG + 1;
  const pts = [], uvs = [], idx = [];
  for (const st of stations) {
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI;                       // 0 → π sweeps the dome
      pts.push(Math.cos(a) * (width / 2) * st.s, st.y, Math.sin(a) * depth * st.s);
      uvs.push((i / SEG) * width, st.y);                   // metric, as the steel maps expect
    }
  }
  for (let j = 0; j < stations.length - 1; j++) {
    for (let i = 0; i < SEG; i++) {
      const a0 = j * row + i, a1 = a0 + 1, b0 = a0 + row, b1 = b0 + 1;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(mesh(geo, material ?? M.conduit));
  return g;
}

/**
 * Surface of revolution spanning a height-dependent angular window — the same window the
 * instanced tiles fill. Used as the far level of detail for the heat shield: one clean
 * surface with metric UVs, instead of thousands of sub-pixel hexagons.
 */
function coverageShell(profile, coverage, y0, y1, offset = 0.022, rows = 120, cols = 72) {
  const pos = [], uv = [], idx = [];
  let arc = 0, prevR = null, prevY = null;
  for (let j = 0; j <= rows; j++) {
    const y = y0 + (y1 - y0) * (j / rows);
    const p = profileAt(profile, y);
    const r = (p ? p.r : 0) + offset;
    if (prevR !== null) arc += Math.hypot(r - prevR, y - prevY);
    prevR = r; prevY = y;
    const half = coverage(y);
    for (let i = 0; i <= cols; i++) {
      const phi = -half + (2 * half) * (i / cols);
      pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r);
      uv.push(phi * r, arc);                       // metric UVs, as the lathe helper emits
    }
  }
  const row = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Chine: one of the four elongated tapered fairings low on the booster that house the COPVs,
 * avionics and batteries (NASASpaceflight). Block 3 nearly doubled the COPV count and made
 * the set asymmetric — the pair flanking the raceway is taller and closer together, the pair
 * on the opposite side shorter and further apart, which gives a little more lift during the
 * glide-back. Built here as a swept triangular fairing: blunt at the base, faired to nothing
 * at the top.
 */
function chine(M, { length = 22, width = 1.9, depth = 0.85 } = {}) {
  const stations = [
    { s: 0.15, y: 0 }, { s: 0.85, y: length * 0.10 }, { s: 1.0, y: length * 0.30 },
    { s: 0.82, y: length * 0.62 }, { s: 0.34, y: length * 0.88 }, { s: 0.04, y: length },
  ];
  const SEG = 12, row = SEG + 1;
  const pts = [], uvs = [], idx = [];
  for (const st of stations) {
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI;
      // A flattened half-ellipse whose crown is pulled outward into a soft ridge.
      const crown = Math.pow(Math.sin(a), 0.7);
      pts.push(Math.cos(a) * (width / 2) * st.s, st.y, crown * depth * st.s);
      // Metric UVs: the steel maps are keyed to metres, and a normal map with no UVs at all
      // makes the shader's tangent derivatives degenerate.
      uvs.push((i / SEG) * width, st.y);
    }
  }
  for (let j = 0; j < stations.length - 1; j++) {
    for (let i = 0; i < SEG; i++) {
      const a0 = j * row + i, a1 = a0 + 1, b0 = a0 + row, b1 = b0 + 1;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return mesh(geo, M.steel);
}

/** Vented hot-stage section: on Block 3 this is built into the top of the methane tank. */
function hotStageSection(M, height = 1.83) {
  const g = new THREE.Group();
  const n = 24;
  const step = (Math.PI * 2) / n;
  const ventPhi = step * 0.62;
  const colPhi = step - ventPhi;
  // Inner wall so the apertures read as holes, not boxes glued to a closed tube.
  g.add(mesh(lathe([{ r: R - 0.09, y: 0.06 }, { r: R - 0.09, y: height - 0.06 }], { segments: 96 }), M.steelInner, { castShadow: false }));
  for (let i = 0; i < n; i++) {
    const a0 = i * step + ventPhi / 2;
    g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: height }], { segments: 6, phiStart: a0, phiLength: colPhi }), M.steelSkirt));
  }
  const vents = [];
  for (let i = 0; i < n; i++) {
    const b = i * step + ventPhi / 2 + colPhi / 2;
    vents.push({ geometry: new THREE.BoxGeometry(0.16, height * 0.94, 0.16), matrix: mat4([Math.sin(b) * (R + 0.07), height * 0.5, Math.cos(b) * (R + 0.07)], [0, b, 0]) });
  }
  g.add(mesh(boxUV(mergeAll(vents)), M.blackMatte));
  g.add(mesh(new THREE.TorusGeometry(R + 0.03, 0.08, 8, 160), M.darkMetal, { position: [0, height - 0.06, 0], rotation: [Math.PI / 2, 0, 0] }));
  g.add(mesh(new THREE.TorusGeometry(R + 0.03, 0.06, 8, 160), M.darkMetal, { position: [0, 0.05, 0], rotation: [Math.PI / 2, 0, 0] }));
  return g;
}

// ---------------------------------------------------------------------------------------
//  Super Heavy
// ---------------------------------------------------------------------------------------
export function buildSuperHeavy(M) {
  const g = new THREE.Group();
  g.name = 'superheavy';

  const skirtTop = rings(3.5);            // 6.41 m engine/thrust section
  const hotStageH = RING;                 // 1.83 m vented section at the top
  const ringTop = BOOSTER_H - hotStageH;  // 70.17 m
  // Tank split from the published propellant loads at cryogenic density
  // (2 700 t LOX / 1 141 kg·m⁻³ vs 700 t LCH4 / 422 kg·m⁻³ ⇒ 59 % / 41 % by volume).
  const commonDome = skirtTop + (ringTop - skirtTop) * 0.59;

  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: skirtTop }], { segments: 160 }), M.steelSkirt, { name: 'skirt' }));
  g.add(mesh(lathe([{ r: R, y: skirtTop }, { r: R, y: ringTop }], { segments: 160 }), M.steel, { name: 'tanks' }));
  const hs = hotStageSection(M, hotStageH); hs.position.y = ringTop; g.add(hs);

  // Aft interior: skirt wall seen from below, thrust puck and engine-bay shielding.
  g.add(mesh(lathe([{ r: R - 0.03, y: 0.1 }, { r: R - 0.03, y: 4.3 }], { segments: 96, flip: true }), M.steelInner, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.5, 96), M.darkMetal, { position: [0, 4.35, 0] }));
  const bays = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + Math.PI / 20;
    bays.push({ geometry: new THREE.BoxGeometry(0.14, 3.3, 1.15), matrix: mat4([Math.sin(a) * 3.86, 1.95, Math.cos(a) * 3.86], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(bays), M.darkMetal));

  // 33 Raptor 3: 3 + 10 gimballing on the thrust puck, 20 fixed on the outer ring.
  // Inner rings get the small outward cant that ringLayout already knew how to apply;
  // the twenty on the skirt stay axial. The cant is a reconstruction from photographs,
  // not a published installation angle.
  const INNER_CANT = 0.055;
  const raptor = raptorGeometry({ exitRadius: RAPTOR_EXIT_R });
  g.add(instanceEngines(raptor, M,
    BOOSTER_RINGS.flatMap(([n, r, y, phase]) =>
      ringLayout(n, r, y, { phase, tilt: n < 20 ? INNER_CANT : 0 }))));

  // Four chines low on the tank section. Block 3 spacing: the pair either side of the
  // raceway sits closer together and runs taller than the pair opposite it.
  const chineBase = skirtTop + 0.6;
  for (const [phi, len] of [
    [RACE_PHI - 0.50, 23.0], [RACE_PHI + 0.50, 23.0],
    [RACE_PHI + Math.PI - 0.95, 17.0], [RACE_PHI + Math.PI + 0.95, 17.0],
  ]) {
    const c = chine(M, { length: len, width: 2.0, depth: 0.9 });
    c.position.set(Math.sin(phi) * (R - 0.06), chineBase, Math.cos(phi) * (R - 0.06));
    c.rotation.y = phi;
    g.add(c);
  }

  // Raceway up the leeward side, clear of the grid fins. Same φ as the chines that flank it.
  const raceLen = ringTop - skirtTop - 1.2;
  const race = raceway(M, raceLen, { width: 1.2, depth: 0.42 });
  race.position.set(Math.sin(RACE_PHI) * (R - 0.02), skirtTop + 0.6 + raceLen / 2, Math.cos(RACE_PHI) * (R - 0.02));
  race.rotation.y = RACE_PHI;
  g.add(race);

  // Grid fins: 3 in a 90°/90°/180° layout, catch pins on the two that face the chopsticks.
  // The exhibit is yawed STARSHIP_YAW_DEG so the tile line reads from the default camera;
  // the fins compensate so that after that yaw the pins sit on the pad's ±Z, which is the
  // axis Mechazilla's arms close on. Without the compensation the pins were ~40° off the
  // load pads — the height check still passed because it only looked at Y.
  const finY = ringTop - 3.9;
  const yaw = THREE.MathUtils.degToRad(STARSHIP_YAW_DEG);
  // World +Z, world +X (far side, no pin), world −Z. 90° / 90° / 180°.
  const finPhis = [-yaw, Math.PI / 2 - yaw, Math.PI - yaw];
  finPhis.forEach((phi, i) => {
    const a = gridFinAssembly(M, { withPin: i !== 1 });
    a.position.set(Math.sin(phi) * R, finY, Math.cos(phi) * R);
    a.rotation.y = phi - Math.PI / 2;
    g.add(a);
  });

  // Common-dome stiffener band (the visible weld band between the two tanks).
  g.add(mesh(new THREE.TorusGeometry(R + 0.025, 0.055, 6, 160), M.steelWarm, { position: [0, commonDome, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  // Hold-down / lift points at the base.
  const lugs = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    lugs.push({ geometry: new THREE.BoxGeometry(0.7, 0.5, 0.35), matrix: mat4([Math.sin(a) * (R + 0.15), skirtTop - 0.5, Math.cos(a) * (R + 0.15)], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(lugs), M.darkMetal));

  g.userData.annotations = [
    { label: '33 Raptor 3 · 3 + 10 + 20', position: [0, -0.3, 6.5] },
    { label: 'Grid fin (3 on V3, 90°/90°/180°)', position: [R + 6.4, finY + 0.6, 0] },
    { label: 'Integrated catch pin', position: [-(R + 2.6), finY - 1.5, 0] },
    { label: 'Vented hot-staging section', position: [0, ringTop + 1.0, R + 0.8] },
    { label: 'Liquid oxygen tank', position: [0, (skirtTop + commonDome) / 2, R + 0.5] },
    { label: 'Liquid methane tank', position: [0, (commonDome + ringTop) / 2, R + 0.5] },
    { label: 'Raceway (plumbing and wiring)', position: [0, skirtTop + 8, -(R + 1.4)] },
  ];
  g.userData.stations = { skirtTop, commonDome, ringTop, finY, pinY: finY - PIN_DROP, height: BOOSTER_H };
  return g;
}

// ---------------------------------------------------------------------------------------
//  Ship
// ---------------------------------------------------------------------------------------
export function buildShip(M) {
  const g = new THREE.Group();
  g.name = 'ship';
  const rng = seeded(7);

  // Stations, all ring-quantised. Tank split from the published loads at cryogenic density
  // (1 170 t LOX vs 330 t LCH4 ⇒ 57 % / 43 % by volume).
  const skirtTop = rings(2.5);      // 4.58 m aft/thrust section
  const barrelTop = rings(21);      // 38.43 m — start of the nose curve
  const payloadBase = rings(18);    // 32.94 m — payload bay above the methane tank
  const commonDome = skirtTop + (payloadBase - skirtTop) * 0.57;
  const noseLen = SHIP_H - barrelTop;   // 13.57 m (fineness ratio ≈1.5 D)

  const nose = ogiveProfile(R, noseLen, barrelTop, 34, 0.75);
  const profile = [
    { r: R, y: 0 },
    { r: R, y: skirtTop },
    { r: R, y: barrelTop },
    ...nose.slice(1),
  ];

  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: skirtTop }], { segments: 160 }), M.steelShip ?? M.steel, { name: 'skirt' }));
  g.add(mesh(lathe(profile.slice(1), { segments: 160 }), M.steel, { name: 'hull' }));
  g.add(mesh(lathe([{ r: R - 0.03, y: 0.1 }, { r: R - 0.03, y: 3.9 }], { segments: 96, flip: true }), M.steelInner, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.4, 96), M.darkMetal, { position: [0, 3.95, 0] }));

  // Common-dome stiffener on the ship — Super Heavy already has one; the annotation pointed
  // at a weld that was never built.
  g.add(mesh(new THREE.TorusGeometry(R + 0.025, 0.055, 6, 160), M.steelWarm, { position: [0, commonDome, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));

  // 3 Raptor (centre, gimballing) + 3 Raptor Vacuum (outer, fixed).
  // y = 0 is the ship's skirt / hot-stage interface. RVac is 4.4 m; hanging it 0.85 m
  // below the skirt puts the bells in the booster's vented ring — which is where they
  // sit on the stacked vehicle — instead of burying a 2.3 m nozzle inside a 4.6 m can.
  const SHIP_SL_Y = 0.12;
  const SHIP_VAC_Y = -0.85;
  g.add(instanceEngines(raptorGeometry(), M, ringLayout(3, 0.95, SHIP_SL_Y, { phase: 0 })));
  g.add(instanceEngines(raptorVacGeometry(), M, ringLayout(3, 3.05, SHIP_VAC_Y, { phase: Math.PI / 3 }), { bellMaterial: M.bellCool }));

  // ---- Thermal protection ------------------------------------------------------------
  // Coverage: a little over half the circumference on the barrel, widening across the nose
  // and wrapping fully at the tip, as photographed. Windward (belly) direction is +Z.
  // Coverage widens across the nose but never closes: the lee face of the nose cone is bare
  // steel to the tip on the vehicle, so a full wrap would read as a black cap.
  // Photographs of the lee side show the nose cone is mostly bare steel: the tile line runs
  // up it at roughly the same angle as on the barrel, widening only slightly, and only the
  // last metre or so of the tip is wrapped all the way round. Growing the coverage to a full
  // wrap across the whole nose turns the vehicle into a black bullet from every angle.
  const COVER_BARREL = THREE.MathUtils.degToRad(97);
  const COVER_NOSE = THREE.MathUtils.degToRad(118);
  const coverage = (y) => {
    const tip = 1.0;
    if (y > SHIP_H - tip) {
      const t = THREE.MathUtils.clamp((y - (SHIP_H - tip)) / tip, 0, 1);
      return COVER_NOSE + t * t * (Math.PI - COVER_NOSE);
    }
    const y0 = barrelTop - 3, y1 = SHIP_H - 3.4;
    if (y < y0) return COVER_BARREL;
    const t = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1);
    return COVER_BARREL + t * (COVER_NOSE - COVER_BARREL);
  };
  const tiles = new THREE.InstancedMesh(hexPrism(TILE_R, TILE_T), M.tile, 17000);
  tiles.name = 'tps';
  // The tiles are a skin a couple of centimetres thick: at any shadow-map resolution that
  // covers a 124 m vehicle, letting them cast shadows only produces per-tile acne that reads
  // as fish scales. The hull underneath casts the vehicle's shadow.
  tiles.castShadow = false;
  tiles.receiveShadow = true;

  // Ablative backing layer just under the tiles, so the gaps read as deep grooves.
  //
  // It has to follow coverage(y), not a constant angle. A lathe spans the same phi window at
  // every height, so cutting it at COVER_NOSE — the widest the tile field ever gets, up on the
  // nose — left 15° of bare backing standing past the last column of tiles all the way down
  // the barrel: at a 4.5 m radius that is a 1.2 m black stripe running thirty metres up each
  // side of the ship, in every view of the windward face. The tiles, this backing, the far
  // shell and the verification all take their footprint from the one `coverage` function now.
  //
  // It is allowed to stand proud by one tile circumradius, and no more: a tile whose centre
  // sits on the edge of the window overhangs by exactly that much, and backing narrower than
  // that would leave the outermost tiles lipping over bare steel.
  const tileBase = 1.0;
  const backCoverage = (y) => {
    const r = profileAt(profile, y)?.r ?? 1;
    return Math.min(Math.PI, coverage(y) + TILE_R / r);
  };
  const backing = mesh(
    coverageShell(profile, backCoverage, tileBase, SHIP_H - 0.02, 0.002, 140, 96),
    M.tileUnder, { castShadow: false });
  backing.name = 'tps-backing';
  g.add(backing);

  let count = tileSurfaceOfRevolution(tiles, profile, {
    y0: tileBase + 0.15, y1: SHIP_H - 0.3, phiCenter: 0, phiHalf: coverage,
    circumradius: TILE_R, rng, minRadius: TILE_R * 0.75,
  });

  // ---- Flaps -------------------------------------------------------------------------
  const FLAP_T = 0.62;
  const flapFaces = [];          // thin plates matching each tiled flap face, for the far LOD
  /**
   * Places one flap. `outline` is the planform in the local frame (x = radially outward from
   * the hull surface, y = along the vehicle); the solid is lofted with a rounded edge and a
   * span-wise thickness taper, and its windward face is tiled.
   */
  const makeFlap = (outline, phi, yBase, rootOffset, opts = {}) => {
    const xs = outline.map(p => p[0]);
    const geo = aeroPlate(outline, FLAP_T, {
      edge: FLAP_T * 0.16,
      taper: spanTaper(Math.min(...xs), Math.max(...xs), opts.tipScale ?? 0.4),
    });
    const e1 = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const e2 = new THREE.Vector3(0, 1, 0);
    const e3 = new THREE.Vector3().crossVectors(e1, e2);   // flap face normal
    const windwardIsPlusE3 = e3.z >= 0;
    // On the pad the flaps are stowed, folded back around the hull towards the lee side, not
    // held out perpendicular the way they are during entry. The hinge runs parallel to the
    // vehicle axis, so the fold is a rotation about the flap's own +Y at the root.
    const fold = (opts.fold ?? 0) * (windwardIsPlusE3 ? 1 : -1);
    const m = new THREE.Matrix4()
      .makeTranslation(e1.x * rootOffset, yBase, e1.z * rootOffset)
      .multiply(new THREE.Matrix4().makeBasis(e1, e2, e3))
      .multiply(new THREE.Matrix4().makeRotationY(fold));
    const flap = mesh(geo, M.steelFlap);
    flap.applyMatrix4(m);
    g.add(flap);

    // Tiles on whichever face looks into the airstream (+Z, the belly side). The tile itself
    // is turned to face −Z when needed; rotating the frame would mirror the planform and lay
    // the patch out somewhere it does not belong.
    const off = windwardIsPlusE3 ? FLAP_T * 0.34 : -FLAP_T * 0.34;
    const faceM = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, off));
    count = tilePolygon(tiles, outline, faceM, {
      circumradius: TILE_R, startIndex: count, rng, inset: 0.02, flip: !windwardIsPlusE3,
    });
    // ExtrudeGeometry's cap UVs are already in metres, which is what the mosaic map expects.
    flapFaces.push({
      geometry: plate(outline, 0.03),
      matrix: faceM.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, windwardIsPlusE3 ? 0.01 : -0.01)),
    });

    // Hinge fairing blended into the hull along the root, capped so the ends do not read as
    // bright spheres against the tiled hull. Forward flaps straddle the barrel/ogive
    // transition: a vertical capsule at constant radius punches through the nose or floats
    // off it. Follow the hull when a profile is supplied.
    const y0 = Math.min(...outline.map(p => p[1])), y1 = Math.max(...outline.map(p => p[1]));
    const hr = opts.hinge ?? 0.5;
    if (opts.followProfile) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const y = yBase + y0 + (y1 - y0) * (i / 10);
        const r = (profileAt(opts.followProfile, y)?.r ?? R) - 0.12;
        pts.push([e1.x * r, y, e1.z * r]);
      }
      g.add(mesh(tube(pts, hr, { tubular: 12, radial: 8, type: 'centripetal' }), M.steelFlap));
    } else {
      const hinge = mesh(new THREE.CapsuleGeometry(hr, Math.max(0.1, y1 - y0 - hr * 1.2), 6, 20), M.steelFlap);
      hinge.position.set(e1.x * (rootOffset - 0.12), yBase + (y0 + y1) / 2, e1.z * (rootOffset - 0.12));
      g.add(hinge);
    }
    return flap;
  };

  // Aft flaps: hinged about an axis parallel to the vehicle, just leeward of the sides.
  // Straight-edged swept trapezoid, as photographed: a near-perpendicular lower edge, an
  // almost straight outboard edge, and a long diagonal sweeping back to the root.
  const aftOutline = [[0, 0], [1.5, 0.05], [4.30, 1.25], [4.35, 5.20], [2.35, 7.55], [0, 7.9]];
  const aftPhi = THREE.MathUtils.degToRad(96);
  const AFT_FOLD = THREE.MathUtils.degToRad(46);
  makeFlap(aftOutline, aftPhi, rings(1), R - 0.08, { hinge: 0.55, fold: AFT_FOLD, tipScale: 0.62 });
  makeFlap(aftOutline, -aftPhi, rings(1), R - 0.08, { hinge: 0.55, fold: AFT_FOLD, tipScale: 0.62 });

  // Forward flaps: leeward, 140° apart on Block 2+, straddling the barrel/nose transition.
  const fwdBase = rings(20) - 0.6;                // 36.0 m
  const fwdLen = 6.6;
  const hullR = (y) => profileAt(profile, Math.min(fwdBase + y, SHIP_H - 0.05))?.r ?? R;
  const rootAt = (y) => hullR(y) - R;             // local x of the root, following the hull
  // Planform as a simple closed polygon: up the root, then back down the swept outer edge.
  const fwdOutline = [];
  for (let i = 0; i <= 10; i++) { const y = (i / 10) * fwdLen; fwdOutline.push([rootAt(y), y]); }
  fwdOutline.push([rootAt(fwdLen) + 0.45, fwdLen]);
  for (const [y, w] of [[6.5, 0.55], [5.45, 2.25], [2.05, 3.05], [0.75, 2.35], [0.1, 0.9]]) fwdOutline.push([rootAt(y) + w, y]);
  const fwdPhi = THREE.MathUtils.degToRad(110);   // ±110° ⇒ 140° apart across the lee side
  const FWD_FOLD = THREE.MathUtils.degToRad(60);
  makeFlap(fwdOutline, fwdPhi, fwdBase, R - 0.08, { hinge: 0.42, tipScale: 0.55, fold: FWD_FOLD, followProfile: profile });
  makeFlap(fwdOutline, -fwdPhi, fwdBase, R - 0.08, { hinge: 0.42, tipScale: 0.55, fold: FWD_FOLD, followProfile: profile });

  tiles.count = count;
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  g.add(tiles);
  g.userData.tileCount = count;

  // Far level of detail: the shield as one textured surface, plus a face plate on each flap.
  const far = new THREE.Group();
  far.name = 'tps-far';
  far.add(mesh(coverageShell(profile, coverage, tileBase + 0.1, SHIP_H - 0.25), M.tpsShell, { castShadow: false }));
  for (const f of flapFaces) far.add(mesh(f.geometry, M.tpsShell, { castShadow: false, matrix: f.matrix }));
  far.visible = false;              // the pair starts in the near state; main.js drives it
  g.add(far);
  // The swap has to happen where the two states look the same, and that is much further in
  // than the default threshold put it. At 3.5 px a 0.26 m tile is two or three pixels of hull:
  // the mosaic and its grooves are then a signal finer than the sampling grid, and it aliases
  // into a field of bright speckle that is both wrong and noticeably lighter than the baked
  // shell it replaced — visible as a hard pop across the whole windward face at about ninety
  // metres. `bias` is a multiplier on the threshold, so 2.1 holds the shell until a tile is
  // about seven pixels, where the hexagons and their grooves actually resolve. It is also the
  // cheaper setting: the one-mesh shell covers more of the range, not less.
  g.userData.lod = { name: 'tps', near: [tiles, backing], far, state: true, feature: TILE_R * 2, bias: 2.1 };

  // Leeward raceway over the LOX downcomer, stopping below the forward flaps.
  const raceLen = barrelTop - skirtTop - 2.4;
  const race = raceway(M, raceLen, { width: 1.0, depth: 0.34 });
  race.position.set(Math.sin(RACE_PHI) * (R - 0.02), skirtTop + 1.2 + raceLen / 2, Math.cos(RACE_PHI) * (R - 0.02));
  race.rotation.y = RACE_PHI;
  g.add(race);

  // Payload-bay door on the leeward side, clear of the raceway. Drawn as a slightly proud
  // panel inside a recessed outline so it reads as a hatch rather than as a painted patch.
  const doorH = rings(3), doorW = 4.4;
  const doorY = payloadBase + doorH / 2 - 0.4;
  const dPhi = doorW / R;
  const arc = (r, y0, y1, phi0, len, seg = 26) =>
    lathe([{ r, y: y0 }, { r, y: y1 }], { segments: seg, phiStart: phi0, phiLength: len });
  g.add(mesh(arc(R + 0.005, doorY - doorH / 2, doorY + doorH / 2, DOOR_PHI - dPhi / 2, dPhi),
    M.steelDoor, { castShadow: false, name: 'payload-door' }));
  const frame = [];
  const fw = 0.05;
  for (const s of [-1, 1]) {
    frame.push(arc(R + 0.012, doorY + s * (doorH / 2), doorY + s * (doorH / 2 - s * fw * 2), DOOR_PHI - dPhi / 2 - 0.01, dPhi + 0.02));
    frame.push(arc(R + 0.012, doorY - doorH / 2, doorY + doorH / 2, DOOR_PHI + s * dPhi / 2 - 0.008, 0.016, 2));
  }
  for (const f of frame) g.add(mesh(f, M.blackMatte, { castShadow: false }));

  // Catch hardpoints under the forward flaps (Block 3 is caught by the ship's own pins).
  for (const s of [1, -1]) {
    const phi = s * fwdPhi;
    const pin = mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.7, 20), M.darkMetal);
    pin.position.set(Math.sin(phi) * (R + 0.34), fwdBase - 0.9, Math.cos(phi) * (R + 0.34));
    pin.rotation.set(Math.PI / 2, phi, 0, 'YXZ');
    g.add(pin);
  }

  g.userData.annotations = [
    { label: '3 Raptor + 3 Raptor Vacuum', position: [0, -0.4, 5.0] },
    { label: 'Heat shield · ≈18,000 hexagonal tiles', position: [0, 18, R + 0.7] },
    { label: 'Aft flap', position: [R + 4.4, rings(1) + 3.5, 1.2] },
    { label: 'Forward flap (leeward side)', position: [Math.sin(fwdPhi) * (R + 2.4), fwdBase + 3.2, Math.cos(fwdPhi) * (R + 2.4)] },
    { label: 'Payload bay', position: [0, doorY, -(R + 0.9)] },
    { label: 'Liquid methane tank', position: [0, (commonDome + payloadBase) / 2, R + 0.5] },
    { label: 'Nose cone (header tanks)', position: [0, SHIP_H - 3.0, 1.6] },
  ];
  g.userData.stations = { skirtTop, commonDome, payloadBase, barrelTop, noseLen, height: SHIP_H };
  return g;
}

export function buildStarship(M) {
  const g = new THREE.Group();
  g.name = 'starship-stack';
  const booster = buildSuperHeavy(M);
  const ship = buildShip(M);
  ship.position.y = BOOSTER_H;
  g.add(booster, ship);
  g.userData.annotations = [
    ...booster.userData.annotations,
    ...ship.userData.annotations.map(a => ({ label: a.label, position: [a.position[0], a.position[1] + BOOSTER_H, a.position[2]] })),
  ];
  g.userData.height = BOOSTER_H + SHIP_H;
  g.userData.tileCount = ship.userData.tileCount;
  g.userData.stations = { booster: booster.userData.stations, ship: ship.userData.stations };
  return g;
}
