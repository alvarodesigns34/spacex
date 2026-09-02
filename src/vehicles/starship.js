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
  profileAt, seeded, plate, aeroPlate, spanTaper,
} from '../geometry/utils.js';
import { raptorGeometry, raptorVacGeometry, instanceEngines, ringLayout } from './engines.js';

const R = 4.5;                 // 9 m diameter (spacex.com)
const RING = 1.83;             // steel ring height (Wikipedia)
const BOOSTER_H = 72;          // spacex.com
const SHIP_H = 52;             // spacex.com
const rings = (n) => n * RING; // helper: express a station as a ring count
// Leeward-side furniture, kept clear of each other (φ measured from the belly, +Z).
const RACE_PHI = Math.PI * 0.78;
const DOOR_PHI = Math.PI * 1.18;

// Tile geometry: reported ≈12 in (0.305 m) point to point → circumradius ≈0.152 m,
// ≈0.264 m across the flats. Instanced; ~13 500 of them cover the ship.
const TILE_R = 0.152;
const TILE_T = 0.016;

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
  // Internal webs.
  for (let i = 1; i < cells[0]; i++) parts.push({ geometry: new THREE.BoxGeometry(web, depth, chord), matrix: mat4([(span * i) / cells[0], 0, 0]) });
  for (let j = 1; j < cells[1]; j++) parts.push({ geometry: new THREE.BoxGeometry(span, depth * 0.94, web), matrix: mat4([span / 2, 0, -chord / 2 + (chord * j) / cells[1]]) });
  const g = new THREE.Group();
  g.add(mesh(mergeAll(parts), M.steelWarm));
  return g;
}

/**
 * Block 3 grid-fin assembly: the fin, its hinge shroud, the electric actuator housing and
 * the catch pin, which Block 3 integrates into the fin root rather than mounting separately.
 */
function gridFinAssembly(M, { withPin = true, span = 5.4, chord = 3.5, depth = 0.42 } = {}) {
  const g = new THREE.Group();
  const fin = gridFin(M, { span, chord, depth });
  fin.position.x = 0.75;
  g.add(fin);
  // Hinge shroud blended into the hull, and the actuator can behind it.
  g.add(mesh(new THREE.CylinderGeometry(depth * 0.85, depth * 0.85, chord, 20), M.steelSkirt, { position: [0.62, 0, 0], rotation: [Math.PI / 2, 0, 0] }));
  g.add(mesh(new THREE.BoxGeometry(1.0, depth + 0.85, chord * 0.88), M.steelSkirt, { position: [0.2, 0, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 20), M.darkMetal, { position: [0.3, -0.95, 0], rotation: [Math.PI / 2, 0, 0] }));
  if (withPin) {
    // Catch pin: a stub that the tower arms take the vehicle's weight on.
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.35, 24), M.darkMetal, { position: [0.95, -1.5, 0], rotation: [0, 0, -Math.PI / 2] }));
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 24), M.aluminum, { position: [1.6, -1.5, 0], rotation: [0, 0, -Math.PI / 2] }));
    g.add(mesh(new THREE.BoxGeometry(0.8, 1.5, 1.5), M.steelSkirt, { position: [0.2, -1.5, 0] }));
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
  const pts = [], idx = [];
  for (const st of stations) {
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI;                       // 0 → π sweeps the dome
      pts.push(Math.cos(a) * (width / 2) * st.s, st.y, Math.sin(a) * depth * st.s);
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
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(mesh(geo, material ?? M.conduit));
  return g;
}

/** Vented hot-stage section: on Block 3 this is built into the top of the methane tank. */
function hotStageSection(M, height = 1.83) {
  const g = new THREE.Group();
  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: height }], { segments: 160 }), M.steelSkirt));
  const n = 24;
  const vents = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Vent apertures with the structural columns between them.
    vents.push({ geometry: new THREE.BoxGeometry(0.72, 1.0, 0.1), matrix: mat4([Math.sin(a) * (R + 0.01), height * 0.52, Math.cos(a) * (R + 0.01)], [0, a, 0]) });
    const b = a + Math.PI / n;
    vents.push({ geometry: new THREE.BoxGeometry(0.16, height * 0.94, 0.16), matrix: mat4([Math.sin(b) * (R + 0.07), height * 0.5, Math.cos(b) * (R + 0.07)], [0, b, 0]) });
  }
  g.add(mesh(mergeAll(vents), M.blackMatte));
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
  const raptor = raptorGeometry();
  g.add(instanceEngines(raptor, M, [
    ...ringLayout(3, 1.02, 0.45, { phase: Math.PI / 6 }),
    ...ringLayout(10, 2.48, 0.35, { phase: 0 }),
    ...ringLayout(20, 3.86, 0.25, { phase: Math.PI / 20 }),
  ]));

  // Raceway up the leeward side, clear of the grid fins.
  const raceLen = ringTop - skirtTop - 1.2;
  const race = raceway(M, raceLen, { width: 1.2, depth: 0.42 });
  race.position.set(0, skirtTop + 0.6 + raceLen / 2, -(R - 0.02));
  race.rotation.y = Math.PI;                                // local +Z → radially outward
  g.add(race);

  // Grid fins: 3 in a 90°/90°/180° layout, catch pins integrated into two of them.
  const finY = ringTop - 3.9;
  const finPhis = [Math.PI / 2, Math.PI, Math.PI * 1.5];
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
    { label: 'Grid fin (3 en V3, 90°/90°/180°)', position: [R + 6.4, finY + 0.6, 0] },
    { label: 'Pin de captura integrado', position: [-(R + 2.6), finY - 1.5, 0] },
    { label: 'Sección hot-staging ventilada', position: [0, ringTop + 1.0, R + 0.8] },
    { label: 'Tanque de oxígeno líquido', position: [0, (skirtTop + commonDome) / 2, R + 0.5] },
    { label: 'Tanque de metano líquido', position: [0, (commonDome + ringTop) / 2, R + 0.5] },
    { label: 'Raceway (conductos y cableado)', position: [0, skirtTop + 8, -(R + 1.4)] },
  ];
  g.userData.stations = { skirtTop, commonDome, ringTop, finY, height: BOOSTER_H };
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

  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: skirtTop }], { segments: 160 }), M.steelSkirt, { name: 'skirt' }));
  g.add(mesh(lathe(profile.slice(1), { segments: 160 }), M.steel, { name: 'hull' }));
  g.add(mesh(lathe([{ r: R - 0.03, y: 0.1 }, { r: R - 0.03, y: 3.9 }], { segments: 96, flip: true }), M.steelInner, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.4, 96), M.darkMetal, { position: [0, 3.95, 0] }));

  // 3 Raptor (centre, gimballing) + 3 Raptor Vacuum (outer, fixed).
  g.add(instanceEngines(raptorGeometry(), M, ringLayout(3, 0.95, 0.35, { phase: 0 })));
  g.add(instanceEngines(raptorVacGeometry(), M, ringLayout(3, 3.05, 0.25, { phase: Math.PI / 3 }), { bellMaterial: M.bellCool }));

  // ---- Thermal protection ------------------------------------------------------------
  // Coverage: a little over half the circumference on the barrel, widening across the nose
  // and wrapping fully at the tip, as photographed. Windward (belly) direction is +Z.
  // Coverage widens across the nose but never closes: the lee face of the nose cone is bare
  // steel to the tip on the vehicle, so a full wrap would read as a black cap.
  const coverage = (y) => {
    const y0 = barrelTop - 2, y1 = SHIP_H - 1.6;
    if (y < y0) return THREE.MathUtils.degToRad(103);
    if (y > y1) return Math.PI;                       // small tiled cap over the tip
    const t = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1);
    return THREE.MathUtils.degToRad(103) + t * t * (Math.PI - THREE.MathUtils.degToRad(103));
  };
  const tiles = new THREE.InstancedMesh(hexPrism(TILE_R, TILE_T), M.tile, 17000);
  tiles.name = 'tps';
  // The tiles are a skin a couple of centimetres thick: at any shadow-map resolution that
  // covers a 124 m vehicle, letting them cast shadows only produces per-tile acne that reads
  // as fish scales. The hull underneath casts the vehicle's shadow.
  tiles.castShadow = false;
  tiles.receiveShadow = true;

  // Ablative backing layer just under the tiles, so the gaps read as deep grooves.
  const tileBase = 1.0;
  const backProfile = profile.filter(p => p.y >= tileBase).map(p => ({ r: p.r + 0.002, y: p.y }));
  backProfile.unshift({ r: profileAt(profile, tileBase).r + 0.002, y: tileBase });
  g.add(mesh(lathe(backProfile, { segments: 112, phiStart: -Math.PI * 0.62, phiLength: Math.PI * 1.24 }), M.tileUnder, { castShadow: false }));

  let count = tileSurfaceOfRevolution(tiles, profile, {
    y0: tileBase + 0.15, y1: SHIP_H - 0.3, phiCenter: 0, phiHalf: coverage,
    circumradius: TILE_R, rng, minRadius: TILE_R * 0.75,
  });

  // ---- Flaps -------------------------------------------------------------------------
  const FLAP_T = 0.62;
  /**
   * Places one flap. `outline` is the planform in the local frame (x = radially outward from
   * the hull surface, y = along the vehicle); the solid is lofted with a rounded edge and a
   * span-wise thickness taper, and its windward face is tiled.
   */
  const makeFlap = (outline, phi, yBase, rootOffset, opts = {}) => {
    const xs = outline.map(p => p[0]);
    const geo = aeroPlate(outline, FLAP_T, {
      edge: FLAP_T * 0.26,
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

    // Hinge fairing blended into the hull along the root, capped so the ends do not read as
    // bright spheres against the tiled hull.
    const y0 = Math.min(...outline.map(p => p[1])), y1 = Math.max(...outline.map(p => p[1]));
    const hr = opts.hinge ?? 0.5;
    const hinge = mesh(new THREE.CapsuleGeometry(hr, Math.max(0.1, y1 - y0 - hr * 1.2), 6, 20), M.steelFlap);
    hinge.position.set(e1.x * (rootOffset - 0.12), yBase + (y0 + y1) / 2, e1.z * (rootOffset - 0.12));
    g.add(hinge);
    return flap;
  };

  // Aft flaps: hinged about an axis parallel to the vehicle, just leeward of the sides.
  const aftOutline = [[0, 0], [2.2, 0.35], [3.9, 1.5], [4.25, 3.2], [3.6, 6.1], [2.5, 7.5], [0, 7.8]];
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
  for (const [y, w] of [[6.35, 0.95], [5.3, 2.1], [3.7, 2.95], [1.9, 3.05], [0.55, 1.75]]) fwdOutline.push([rootAt(y) + w, y]);
  const fwdPhi = THREE.MathUtils.degToRad(110);   // ±110° ⇒ 140° apart across the lee side
  const FWD_FOLD = THREE.MathUtils.degToRad(60);
  makeFlap(fwdOutline, fwdPhi, fwdBase, R - 0.08, { hinge: 0.42, tipScale: 0.55, fold: FWD_FOLD });
  makeFlap(fwdOutline, -fwdPhi, fwdBase, R - 0.08, { hinge: 0.42, tipScale: 0.55, fold: FWD_FOLD });

  tiles.count = count;
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  g.add(tiles);
  g.userData.tileCount = count;

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
    { label: 'Escudo térmico · ≈18 000 losetas hexagonales', position: [0, 18, R + 0.7] },
    { label: 'Aleta trasera', position: [R + 4.4, rings(1) + 3.5, 1.2] },
    { label: 'Aleta delantera (a sotavento)', position: [Math.sin(fwdPhi) * (R + 2.4), fwdBase + 3.2, Math.cos(fwdPhi) * (R + 2.4)] },
    { label: 'Bahía de carga', position: [0, doorY, -(R + 0.9)] },
    { label: 'Tanque de metano líquido', position: [0, (commonDome + payloadBase) / 2, R + 0.5] },
    { label: 'Morro (tanques de cabecera)', position: [0, SHIP_H - 3.0, 1.6] },
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
