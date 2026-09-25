/**
 * Falcon 9 Block 5 and Falcon Heavy.
 *
 * Verified figures: height 70 m, diameter 3.66 m (12 ft), standard fairing 13.2 m × 5.2 m
 * (SpaceX Falcon User's Guide, May 2025, §2 and §4.1.3; spacex.com rounds the diameter to
 * 3.7 m and gives the fairing as 13.1 m), 9 Merlin 1D per core, Falcon Heavy width 12.2 m
 * (spacex.com); first stage 41.2 m, second stage 13.8 m,
 * Merlin 1D nozzle exit 0.92 m, MVac nozzle 3.3 m, titanium grid fins (Wikipedia).
 *
 * The 41.2 m first-stage figure is the whole stage, interstage included — stacking a separate
 * interstage on top of it would make the booster a sixth too long. The stations below split
 * that 41.2 m into a 34.5 m tank section and a 6.7 m interstage, and place the second stage
 * so that the fairing base lands at 70 − 13.2 = 56.8 m. Interstage length, stowed leg length,
 * grid-fin size and Merlin plumbing detail are approximations from imagery.
 */
import * as THREE from 'three';
import { lathe, ogiveProfile, mesh, mergeAll, mat4, plate, boxUV } from '../geometry/utils.js';
import { merlinGeometry, merlinVacGeometry, instanceEngines, ringLayout } from './engines.js';

const R = 1.83;                    // 3.66 m (12 ft), Falcon User's Guide 2025
// y = 0 is the Merlin exit plane — the lowest point of the vehicle and the datum the 70 m
// overall height is measured from. The tank barrel therefore starts one nozzle length up.
const ENGINE_DROP = 1.0;
const TOTAL_H = 70;                // spacex.com
const S1_H = 41.2;                 // first stage, interstage included (Wikipedia)
const INTERSTAGE_H = 6.7;          // approx
const TANK_TOP = S1_H - INTERSTAGE_H;   // 34.5 m — top of the LOX tank / base of interstage
const S2_H = 13.8;                 // second stage (Wikipedia)
const S2_TOP = S1_H + S2_H;        // 55.0 m
const FAIRING_BASE = TOTAL_H - 13.2;    // 56.8 m (13.2 m standard fairing, Falcon User's Guide 2025)
const FAIRING_R = 2.6;             // 5.2 m diameter

/**
 * Titanium grid fin: an orthogonal waffle inside a closed frame.
 *
 * Cast and machined from a single titanium piece, so the frame is chunky and the webs are
 * thin — which is the proportion that makes it read as a grid fin rather than as a sheet of
 * graph paper. The webs used to be a constant 18 mm and the whole thing 12 cm deep; a real
 * fin is deeper than that relative to its chord, and the depth is what catches the light
 * between the cells.
 */
function titaniumGridFin(M, { span = 1.55, chord = 1.25, depth = 0.2 } = {}) {
  const parts = [];
  const frame = 0.055, web = 0.016;
  parts.push({ geometry: new THREE.BoxGeometry(span, depth, frame), matrix: mat4([span / 2, 0, chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(span, depth, frame), matrix: mat4([span / 2, 0, -chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(frame, depth, chord), matrix: mat4([span, 0, 0]) });
  parts.push({ geometry: new THREE.BoxGeometry(frame * 1.6, depth * 1.15, chord), matrix: mat4([0, 0, 0]) });
  const nx = 9, nz = 7;
  for (let i = 1; i < nx; i++) parts.push({ geometry: new THREE.BoxGeometry(web, depth * 0.92, chord), matrix: mat4([(span * i) / nx, 0, 0]) });
  for (let j = 1; j < nz; j++) parts.push({ geometry: new THREE.BoxGeometry(span, depth * 0.88, web), matrix: mat4([span / 2, 0, -chord / 2 + (chord * j) / nz]) });
  // Rolled leading and trailing edges on the frame: a cast fin has no sharp corners, and the
  // highlight running along them is most of what is visible of it from the ground.
  for (const s of [-1, 1]) {
    parts.push({
      geometry: new THREE.CylinderGeometry(frame * 0.62, frame * 0.62, span, 8),
      matrix: mat4([span / 2, 0, s * chord / 2], [0, 0, Math.PI / 2]),
    });
  }
  return mesh(boxUV(mergeAll(parts)), M.titanium);
}

/**
 * Landing leg, stowed flat against the base: a tapered composite fairing over the strut.
 *
 * The fairing is carbon, and carbon here is black with a woven sheen — not the mustard it was
 * reading as. `plate()` emits ExtrudeGeometry cap UVs in metres, but its SIDE walls get the
 * extruder's own parameterisation, and against a 0.6 m weave that left the visible faces
 * sampling one corner of the map: four khaki slabs where the legs should be. boxUV puts the
 * whole solid on metric coordinates.
 */
function landingLeg(M, { length = 9.6, wrapR = R + 0.12 } = {}) {
  const outline = [
    [-0.56, 0], [0.56, 0], [0.52, 1.1], [0.34, length * 0.55], [0.2, length - 0.5], [0.09, length],
    [-0.09, length], [-0.2, length - 0.5], [-0.34, length * 0.55], [-0.52, 1.1],
  ];
  // Half-width of the planform at height y, for the crown below.
  const halfW = (y) => {
    for (let i = 1; i < 6; i++) {
      const [x0, y0] = outline[i - 1], [x1, y1] = outline[i];
      if (y <= y1) return x0 + (x1 - x0) * ((y - y0) / Math.max(1e-6, y1 - y0));
    }
    return 0.09;
  };
  // The fairing wraps the tank and is crowned outboard. It was a flat extrusion: a 1.12 m
  // chord laid on a 1.95 m radius stands 8 cm off the tank at its edges, and a slab with a
  // square section reads as a plank bolted to the stage rather than as a moulded leg. Here the
  // same planform is bent round the stage axis (local z = −wrapR) and its outer face bulges by
  // up to 9 cm at the centreline, the rounded-triangle section the stowed legs photograph as.
  const geo = boxUV(plate(outline, 0.24, 0.05));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const w = Math.max(0.09, halfW(Math.min(length, Math.max(0, y))));
    const t = Math.min(1, Math.abs(x) / w);
    if (z > 0) z += 0.09 * (1 - t * t) * (z / 0.17);
    const th = x / wrapR, rr = wrapR + z;
    p.setXYZ(i, Math.sin(th) * rr, y, Math.cos(th) * rr - wrapR);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(mesh(geo, M.carbon, { name: 'leg-fairing' }));
  // Foot at the Octaweb: the rounded pad the leg stands on once deployed, seen end-on from
  // underneath while stowed. It was a 1.34 m box, which from below read as a brick. The
  // telescoping pusher lives behind the fairing and is not visible stowed, so it is not built.
  const foot = new THREE.CylinderGeometry(0.5, 0.56, 0.5, 28);
  foot.scale(1, 1, 0.48);
  foot.translate(0, 0.25, 0.02);
  g.add(mesh(boxUV(foot), M.darkMetal, { name: 'leg-hinge' }));
  // Hold-down latches along the fairing, and the crush core at the foot. A stowed leg that is
  // one smooth moulding says nothing; what says "this unfolds" is the hardware holding it.
  const latches = [];
  for (const y of [1.9, 4.6, 7.3]) {
    latches.push({ geometry: new THREE.BoxGeometry(0.5, 0.16, 0.2), matrix: mat4([0, y, -0.2]) });
    latches.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8), matrix: mat4([0, y, -0.3], [0, 0, Math.PI / 2]) });
  }
  latches.push({ geometry: new THREE.CylinderGeometry(0.3, 0.26, 0.34, 14), matrix: mat4([0, 0.2, -0.1]) });
  g.add(mesh(boxUV(mergeAll(latches)), M.alumDark, { name: 'leg-latches' }));
  return g;
}

/**
 * Panel joints on painted white structure. Photographs of a Falcon's fairing and second stage
 * show the frame stations and joints as faint grey lines, not black ones: the dark aluminium
 * torus read as a pen line drawn round the fairing.
 */
let _seam = null;
function seamMat(M) {
  _seam ??= new THREE.MeshStandardMaterial({ name: 'falcon-seam', color: 0xb8bcc0, roughness: 0.6, metalness: 0.1 });
  return _seam;
}

/**
 * Builds one core. variant: 'f9' | 'fh-center' | 'fh-side'.
 * Side boosters replace the interstage and second stage with a nose cone.
 */
export function buildFalconCore(M, { variant = 'f9', bodyMaterial } = {}) {
  const g = new THREE.Group();
  g.name = `falcon-core-${variant}`;
  const body = bodyMaterial ?? M.f9Stage1;

  // Tank section: RP-1 below, LOX above, one unwrapped texture over the whole barrel.
  g.add(mesh(lathe([{ r: R, y: ENGINE_DROP }, { r: R, y: TANK_TOP }], { segments: 128, uvMode: 'normalized' }), body, { name: 'stage1' }));

  // Base of the stage, as it is seen from underneath: a flat heat shield closing the bottom of
  // the Octaweb, with a cutout and a boot for each of the nine bells. What was here before was
  // an open drum looking up into the thrust structure, and none of what was inside it held
  // together once measured against the engines it shared the space with:
  //  - the eight radial webs sat on the outer engines' own azimuths, so each ran through the
  //    middle of a Merlin, powerhead and throat;
  //  - the eight "apron" plates were 1.5 m long on a 1.43 m radius, so every one stood 33 cm
  //    out through the side of the stage — a ring of black tabs round the base in the views of
  //    the legs and the Falcon Heavy aft interfaces;
  //  - the "helium bottles" were buried in the powerheads, and Falcon 9's helium COPVs are
  //    submerged in the LOX tank in any case, not hung round the engines.
  // The shield is what a visitor under the rocket actually sees, and it hides the thrust
  // structure the way the vehicle does. Cutout clearance is approximate.
  const OUTER_PHASE = Math.PI / 8;          // the 8-engine ring below
  const OUTER_RING = 1.27;
  {
    const SHIELD_Y = ENGINE_DROP + 0.004, HOLE_R = 0.30;
    const holes = [[0, 0], ...Array.from({ length: 8 }, (_, i) => {
      const a = OUTER_PHASE + (i / 8) * Math.PI * 2;
      return [Math.sin(a) * OUTER_RING, Math.cos(a) * OUTER_RING];
    })];
    const disc = new THREE.Shape();
    disc.absarc(0, 0, R - 0.001, 0, Math.PI * 2, false);
    for (const [x, z] of holes) {
      const h = new THREE.Path();
      h.absarc(x, z, HOLE_R, 0, Math.PI * 2, true);
      disc.holes.push(h);
    }
    const shield = new THREE.ShapeGeometry(disc, 48);
    shield.rotateX(Math.PI / 2);            // shape (x, y) → world (x, +z); the face looks down
    shield.translate(0, SHIELD_Y, 0);
    g.add(mesh(shield, M.blackMatte, { name: 'base-heat-shield', castShadow: false }));
    // Flexible boots closing the gap between each cutout and its bell.
    const boots = holes.map(([x, z]) => ({
      geometry: new THREE.TorusGeometry(HOLE_R - 0.014, 0.026, 6, 36),
      matrix: mat4([x, SHIELD_Y - 0.01, z], [Math.PI / 2, 0, 0]),
    }));
    g.add(mesh(boxUV(mergeAll(boots)), M.darkMetal, { name: 'heat-shield-boots', castShadow: false }));
  }
  // 9 Merlin 1D: eight almost touching on a 1.27 m ring plus one on the axis.
  g.add(instanceEngines(merlinGeometry(), M, [
    { position: [0, 0, 0], tilt: [0, 0], spin: 0 },
    ...ringLayout(8, OUTER_RING, 0, { phase: OUTER_PHASE }),
  ], { innerMaterial: M.bellInnerSoot }));

  // Four landing legs, stowed.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const leg = landingLeg(M);
    leg.position.set(Math.sin(a) * (R + 0.12), ENGINE_DROP + 0.25, Math.cos(a) * (R + 0.12));
    leg.rotation.y = a;
    g.add(leg);
  }
  // Raceway up the tank section.
  g.add(mesh(new THREE.BoxGeometry(0.44, TANK_TOP - ENGINE_DROP - 2.6, 0.2), M.blackMatte, { position: [0, (TANK_TOP + ENGINE_DROP) / 2 + 1.0, R + 0.09], name: 'raceway' }));
  // Stage separation flange.
  g.add(mesh(new THREE.TorusGeometry(R + 0.015, 0.05, 6, 96), M.darkMetal, { position: [0, TANK_TOP, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false, name: 'sep-flange' }));

  // Four titanium grid fins, stowed flat. Every Falcon booster that flies back carries them,
  // side boosters included — they perform their own boostback and landing burns.
  const addGridFins = (y) => {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const holder = new THREE.Group();
      const fin = titaniumGridFin(M);
      fin.rotation.set(0, Math.PI / 2, Math.PI / 2);   // span → vertical, depth → radial
      holder.add(fin);
      holder.position.set(Math.sin(a) * (R + 0.09), y, Math.cos(a) * (R + 0.09));
      holder.rotation.y = a;
      g.add(holder);
      const hinge = mesh(new THREE.BoxGeometry(1.35, 0.34, 0.4), M.darkMetal);
      hinge.position.set(Math.sin(a) * (R + 0.11), y - 0.1, Math.cos(a) * (R + 0.11));
      hinge.rotation.y = a;
      g.add(hinge);
    }
  };

  if (variant === 'fh-side') {
    // Measured against the Falcon Heavy demo on LC-39A (Wikimedia Commons, "Falcon Heavy Demo
    // Mission (40126460511)", side-on, scaled by the 70 m stack and checked against the fairing,
    // which it reads as 13.3 m against the guide's 13.2 m): all three sets of grid fins sit level at about 40 m,
    // and the side boosters' nose tips stand at about 45 m. So a side booster keeps a cylinder
    // where the Falcon 9 carries its interstage, with its grid fins at the top of it, and the
    // nose cone sits above that. It used to sit straight on the tank, 6 m lower, with the grid
    // fins at 33 m — a visibly squat pair of boosters. This is still SpaceX's "nose cone in
    // place of the interstage": the side booster's nose cone is a cylindrical skirt over the
    // interstage station, closed by the taper.
    const shoulder = S1_H - 0.3;              // top of the cylinder, level with the core's interstage
    const noseL = 4.3;                        // tip ≈ 45.2 m, as measured
    g.add(mesh(lathe([{ r: R, y: TANK_TOP }, { r: R, y: shoulder }], { segments: 128 }), M.whiteFresh, { name: 'side-upper' }));
    const prof = [{ r: R, y: shoulder }, ...ogiveProfile(R, noseL, shoulder, 30, 0.16).slice(1)];
    g.add(mesh(lathe(prof, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
    addGridFins(S1_H - 1.95);
    g.userData.top = shoulder + noseL;
    markFalconDetail(g);
    return g;
  }

  // Interstage: unpainted carbon composite, with the Merlin Vacuum nozzle inside it. The
  // paint/composite boundary is the sharpest line on the vehicle and was a bare butt joint;
  // on the real booster there is a lap, a ring of fasteners and a run of sooting above it.
  g.add(mesh(lathe([{ r: R, y: TANK_TOP }, { r: R, y: S1_H }], { segments: 128 }), M.carbon, { name: 'interstage' }));
  g.add(mesh(lathe([{ r: R - 0.03, y: TANK_TOP + 0.2 }, { r: R - 0.03, y: S1_H }], { segments: 64, flip: true }), M.blackMatte, { castShadow: false }));
  {
    const trim = [];
    // Lap joint at the bottom of the interstage and the ring at the top.
    trim.push({ geometry: new THREE.TorusGeometry(R + 0.03, 0.045, 8, 96), matrix: mat4([0, TANK_TOP + 0.12, 0], [Math.PI / 2, 0, 0]) });
    trim.push({ geometry: new THREE.TorusGeometry(R + 0.025, 0.035, 8, 96), matrix: mat4([0, S1_H - 0.1, 0], [Math.PI / 2, 0, 0]) });
    g.add(mesh(boxUV(mergeAll(trim)), M.alumDark, { name: 'interstage-trim' }));
  }
  // User's Guide §2.4: three latch points and four stage pushers, including one
  // redundant CENTRAL pusher. Counts/roles are cited; housing shape and station are
  // reconstructed. The fourth pusher is inside the interstage, not on its exterior.
  const pushers = new THREE.Group(), latches = new THREE.Group();
  pushers.name = 'stage-separation-pushers'; latches.name = 'stage-separation-latches';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    pushers.add(mesh(new THREE.BoxGeometry(0.28, 0.7, 0.16), M.alumDark, {
      position: [Math.sin(a) * (R + 0.05), S1_H - 0.62, Math.cos(a) * (R + 0.05)],
      rotation: [0, a, 0], name: `stage-pusher-peripheral-${i + 1}`,
    }));
    latches.add(mesh(new THREE.BoxGeometry(0.36, 0.18, 0.22), M.darkMetal, {
      position: [Math.sin(a) * (R + 0.04), S1_H - 0.18, Math.cos(a) * (R + 0.04)],
      rotation: [0, a, 0], name: `stage-latch-${i + 1}`,
    }));
  }
  pushers.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), M.alumDark,
    { position: [0, S1_H - 0.62, 0], name: 'stage-pusher-center' }));
  g.add(pushers, latches);
  g.userData.separation = { pusherCount: 4, latchCount: 3, centralPushers: 1, reconstructedGeometry: true };
  g.add(instanceEngines(merlinVacGeometry(), M, [{ position: [0, TANK_TOP + 0.9, 0], tilt: [0, 0], spin: 0 }], { bellMaterial: M.bellCool }));

  addGridFins(S1_H - 1.95);   // at the top of the interstage

  // Second stage: LOX/RP-1 tank plus the payload interface below the fairing.
  g.add(mesh(lathe([{ r: R, y: S1_H }, { r: R, y: S2_TOP }], { segments: 128 }), M.white, { name: 'stage2' }));
  // Common-dome band between the second stage's RP-1 and LOX tanks.
  g.add(mesh(new THREE.TorusGeometry(R + 0.008, 0.025, 6, 96), seamMat(M), { position: [0, S1_H + S2_H * 0.42, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  // Cold-gas thruster pods used for second-stage attitude control.
  for (const a of [Math.PI * 0.25, Math.PI * 1.25]) {
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 14), M.darkMetal,
      { position: [Math.sin(a) * (R + 0.06), S2_TOP - 1.2, Math.cos(a) * (R + 0.06)], rotation: [0, 0, Math.PI / 2] }));
  }
  // The published lengths (41.2 + 13.8 + 13.2 m, or 42.6 + 12.6 + 13.2 m in another table of
  // the same article) fall 1.8 m short of the declared 70 m. The shortfall is carried as the
  // second stage's forward skirt at full diameter, the way the stage meets the fairing's
  // boat-tail, with a seam at the published stage length. It used to be a tapering cone that
  // read as a measured payload adapter; nothing measures it.
  g.add(mesh(lathe([{ r: R, y: S2_TOP }, { r: R, y: FAIRING_BASE }], { segments: 128 }), M.white, { name: 'stage2-forward-skirt' }));
  g.add(mesh(new THREE.TorusGeometry(R + 0.006, 0.02, 5, 96), seamMat(M), { position: [0, S2_TOP, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false, name: 'stage2-forward-seam' }));
  g.add(mesh(new THREE.BoxGeometry(0.38, S2_H - 1.2, 0.18), M.blackMatte, { position: [0, S1_H + S2_H / 2, R + 0.08] }));

  // Fairing: 13.2 m × 5.2 m, two halves, blunt ogive nose.
  const ogiveStart = FAIRING_BASE + 6.1;
  const fProf = [
    { r: R, y: FAIRING_BASE }, { r: R, y: FAIRING_BASE + 0.1, sharp: true },
    { r: FAIRING_R, y: FAIRING_BASE + 1.55, sharp: true }, { r: FAIRING_R, y: ogiveStart },
    ...ogiveProfile(FAIRING_R, TOTAL_H - ogiveStart, ogiveStart, 48, 0.55).slice(1),
  ];
  g.add(mesh(lathe(fProf, { segments: 160 }), M.whiteFresh, { name: 'fairing' }));
  // Two frame stations on the cylindrical skirt, so the fairing is a shell with
  // structure rather than one unbroken ogive. Approximate, from imagery.
  g.add(mesh(mergeAll([
    { geometry: new THREE.TorusGeometry(FAIRING_R + 0.008, 0.014, 5, 64), matrix: mat4([0, FAIRING_BASE + 2.2, 0], [Math.PI / 2, 0, 0]) },
    { geometry: new THREE.TorusGeometry(FAIRING_R + 0.008, 0.014, 5, 64), matrix: mat4([0, ogiveStart - 0.35, 0], [Math.PI / 2, 0, 0]) },
  ]), seamMat(M), { name: 'fairing-frames', castShadow: false }));
  // Split line between the halves.
  for (const phi of [Math.PI / 2, -Math.PI / 2]) {
    g.add(mesh(lathe(fProf.map(p => ({ r: p.r + 0.014, y: p.y })), { segments: 2, phiStart: phi - 0.005, phiLength: 0.01 }), seamMat(M), { castShadow: false }));
  }
  // The standard fairing's single payload access door: circular, 610 mm (24 in) across, in the
  // cylindrical portion (Falcon User's Guide 2025, §4.1.3). Its exact station and clocking are
  // mission-specific and not given; placed low on the cylinder, facing the viewing side.
  {
    const DOOR_R = 0.305, doorY = FAIRING_BASE + 3.0, phi = 0;
    const ring = new THREE.TorusGeometry(DOOR_R, 0.012, 6, 40);
    g.add(mesh(ring, seamMat(M), {
      position: [Math.sin(phi) * (FAIRING_R + 0.024), doorY, Math.cos(phi) * (FAIRING_R + 0.024)],
      rotation: [0, phi, 0], castShadow: false, name: 'fairing-access-door',
    }));
  }
  g.add(mesh(new THREE.TorusGeometry(R + 0.02, 0.055, 6, 96), M.darkMetal, { position: [0, FAIRING_BASE + 0.06, 0], rotation: [Math.PI / 2, 0, 0] }));
  g.userData.top = TOTAL_H;
  markFalconDetail(g);
  return g;
}

/**
 * What stops being worth drawing on a 70 m booster, by the size of the smallest thing it
 * carries: the boots round the engine cutouts in the base heat shield, the leg latches, the
 * trim rings and the separation hardware — none of which can be seen from the museum row.
 *
 * The grid fins, the legs and the raceway stay: they break the cylinder's outline, and a
 * Falcon without them reads as a white tube.
 */
function markFalconDetail(g) {
  const FINE = {
    'heat-shield-boots': 0.05,
    'leg-latches': 0.04, 'interstage-trim': 0.05, 'sep-flange': 0.1,
    'stage-separation-pushers': 0.16, 'stage-separation-latches': 0.18,
    'fh-pusher-detail': 0.08, 'fairing-frames': 0.03,
  };
  g.traverse((o) => { const f = FINE[o.name]; if (f) o.userData.lodFeature = f; });
}

const commonAnnotations = () => [
  { label: 'RP-1 tank', position: [0, 10, R + 0.3] },
  { label: 'LOX tank', position: [0, 26, R + 0.3] },
  { label: 'Interstage (composite)', position: [0, TANK_TOP + 3.2, R + 0.35] },
  { label: 'Titanium grid fin', position: [Math.sin(Math.PI / 4) * 2.9, S1_H - 1.6, Math.cos(Math.PI / 4) * 2.9] },
  { label: 'Second stage · Merlin Vacuum', position: [0, S1_H + S2_H / 2, R + 0.35] },
  { label: 'Fairing · 13.2 m × 5.2 m', position: [0, FAIRING_BASE + 6, FAIRING_R + 0.4] },
];

export function buildFalcon9(M) {
  const g = new THREE.Group();
  g.name = 'falcon9';
  g.add(buildFalconCore(M, { variant: 'f9' }));
  g.userData.height = TOTAL_H;
  g.userData.stations = { tankTop: TANK_TOP, s1Top: S1_H, s2Top: S2_TOP, fairingBase: FAIRING_BASE };
  g.userData.annotations = [
    { label: '9 Merlin 1D · Octaweb', position: [0, -0.3, 2.6] },
    { label: 'Landing leg (stowed)', position: [Math.sin(Math.PI / 4) * 2.5, 6, Math.cos(Math.PI / 4) * 2.5] },
    ...commonAnnotations(),
  ];
  return g;
}

/**
 * A doubler plate bonded to a core's skin: a patch of the R cylinder centred on azimuth
 * `phi0` (lathe convention, x = sin φ · r), `halfW` radians either side, between y0 and y1.
 * It stands `t` proud in the middle and ramps down to the skin over `ramp` metres on every
 * edge, so it has no open side and no step for the light to catch as a slot.
 */
function skinDoubler(phi0, halfW, y0, y1, { t = 0.022, ramp = 0.07, cols = 18, rows = 8 } = {}) {
  const pos = [], uv = [], idx = [];
  const arcHalf = halfW * R;
  const lift = (d) => THREE.MathUtils.smoothstep(d, 0, ramp);
  for (let j = 0; j <= rows; j++) {
    const y = y0 + (y1 - y0) * (j / rows);
    for (let i = 0; i <= cols; i++) {
      const u = (i / cols) * 2 - 1;
      const phi = phi0 + u * halfW;
      const edge = Math.min(arcHalf - Math.abs(u) * arcHalf, y - y0, y1 - y);
      const r = R + 0.002 + t * lift(edge);
      pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r);
      uv.push(u * arcHalf, y);
    }
  }
  const row = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);         // outward: (+φ) × (+y) points away from the axis
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildFalconHeavy(M) {
  const g = new THREE.Group();
  g.name = 'falconheavy';
  const spacing = (12.2 - 2 * R) / 2;   // 4.27 m between core axes, from the 12.2 m width
  const center = buildFalconCore(M, { variant: 'fh-center', bodyMaterial: M.fhCore });
  const left = buildFalconCore(M, { variant: 'fh-side', bodyMaterial: M.fhSide });
  const right = buildFalconCore(M, { variant: 'fh-side', bodyMaterial: M.fhSide });
  left.position.x = -spacing; right.position.x = spacing;
  left.rotation.y = -Math.PI / 2; right.rotation.y = Math.PI / 2;   // local +Z raceways face outward
  g.add(center, left, right);

  // Falcon User's Guide (May 2025), §2.4: two forward and two aft pneumatic
  // separation mechanisms connect EACH side booster. Forward loads enter the top of
  // the centre LOX tank, not the carbon interstage. Exact stations, clevis sizes and
  // cylinder dimensions below are a reconstruction; the count and role are published.
  // https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf
  const struts = [];
  const detail = [], interfaces = [];
  const cylinder = (target, a, b, r) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    target.push({
      geometry: new THREE.CylinderGeometry(r, r, len, 12),
      matrix: new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)),
    });
  };
  for (const s of [-1, 1]) {
    for (const station of ['forward', 'aft']) for (const front of [-1, 1]) {
      const z = front * (station === 'forward' ? 0.55 : 0.7);
      // At an off-axis Z the skin lies on sqrt(R²-Z²), not X=R. Embed both ends
      // slightly into that actual surface so the pusher remains physically attached.
      const skinX = Math.sqrt(R * R - z * z) - 0.06;
      const y = station === 'forward' ? TANK_TOP - 0.45 : 2.6;
      const a = [s * skinX, y, z];
      const b = [s * (spacing - skinX), y, z];
      cylinder(struts, a, b, 0.12);
      interfaces.push({ station, side: s, center: a, booster: b });
      // Short sleeve, clevis blocks and hinge pins show how the pneumatic load path
      // meets the skin. Fine fittings can disappear; the connecting rods cannot.
      const sleeveEnd = a.map((v, i) => v + (b[i] - v) * 0.42);
      cylinder(detail, a, sleeveEnd, 0.145);
      for (const p of [a, b]) {
        detail.push({ geometry: new THREE.BoxGeometry(0.16, 0.26, 0.2), matrix: mat4(p) });
        cylinder(detail, [p[0], p[1], p[2] - 0.18], [p[0], p[1], p[2] + 0.18], 0.04);
      }
    }
  }
  // Where each pair of rods enters a core, a doubler: the load has to be spread into a
  // tank wall a few millimetres thick, and a curved plate bonded to the skin is how that is
  // done. These replace four 0.9 × 0.36 × 1.35 m boxes that sat in the 0.55 m gap between
  // the cores, ran 17 cm into both of them and hid the rods and clevises behind a block —
  // "the joint" read as four crates wedged between three tubes. Each doubler follows its own
  // core's cylinder and tapers to the skin on all four edges, so it reads as a plate on the
  // tank rather than a part stuck to it. Plate size and thickness are reconstructed.
  const saddles = [];
  for (const s of [-1, 1]) {
    for (const [y, zMax] of [[TANK_TOP - 0.45, 0.55], [2.6, 0.7]]) {
      const halfW = Math.asin(Math.min(0.95, (zMax + 0.34) / R));
      // Centre core: the plate faces the side booster (+X for s = 1).
      saddles.push({ geometry: skinDoubler(s * Math.PI / 2, halfW, y - 0.42, y + 0.42) });
      // Side core: the plate faces back towards the centre core.
      saddles.push({
        geometry: skinDoubler(-s * Math.PI / 2, halfW, y - 0.42, y + 0.42),
        matrix: mat4([s * spacing, 0, 0]),
      });
    }
  }
  // boxUV, like every other merged structural run in the project: merging keeps each
  // cylinder's own 0..1 UVs, so the grey-metal map — authored for a one-metre tile — was being
  // stretched over a four-metre strut. Planar metric UVs put it back on its own scale.
  g.add(mesh(boxUV(mergeAll(struts)), M.darkMetal, { name: 'fh-attach-struts' }));
  g.add(mesh(boxUV(mergeAll(detail)), M.alumDark, { name: 'fh-pusher-detail' }));
  g.add(mesh(boxUV(mergeAll(saddles)), M.alumDark, { name: 'fh-attach-doublers', castShadow: false }));
  g.userData.attachments = { reconstructedGeometry: true, interfaces };
  markFalconDetail(g);

  g.userData.height = TOTAL_H;
  g.userData.width = 12.2;
  g.userData.stations = { tankTop: TANK_TOP, s1Top: S1_H, s2Top: S2_TOP, fairingBase: FAIRING_BASE, spacing };
  g.userData.annotations = [
    { label: '27 Merlin 1D (3 × 9)', position: [0, -0.3, 2.8] },
    { label: 'Side booster with nose cone', position: [-spacing, S1_H + 1.8, 1.2] },
    { label: 'Reinforced centre core', position: [0, 18, R + 0.35] },
    { label: 'Forward pneumatic attach points (LOX tank)', position: [spacing - 2.1, TANK_TOP - 0.45, 1.2] },
    { label: 'Lower attach point (Octaweb)', position: [spacing - 2.1, 3.2, 1.4] },
    { label: 'Fairing · 13.2 m × 5.2 m', position: [0, FAIRING_BASE + 6, FAIRING_R + 0.4] },
  ];
  return g;
}
