/**
 * Falcon 9 Block 5 and Falcon Heavy.
 *
 * Verified figures: height 70 m, diameter 3.7 m, fairing 13.1 m × 5.2 m, 9 Merlin 1D per
 * core, Falcon Heavy width 12.2 m (spacex.com); first stage 41.2 m, second stage 13.8 m,
 * Merlin 1D nozzle exit 0.92 m, MVac nozzle 3.3 m, titanium grid fins (Wikipedia).
 *
 * The 41.2 m first-stage figure is the whole stage, interstage included — stacking a separate
 * interstage on top of it would make the booster a sixth too long. The stations below split
 * that 41.2 m into a 34.5 m tank section and a 6.7 m interstage, and place the second stage
 * so that the fairing base lands at 70 − 13.1 = 56.9 m. Interstage length, stowed leg length,
 * grid-fin size and Merlin plumbing detail are approximations from imagery.
 */
import * as THREE from 'three';
import { lathe, ogiveProfile, mesh, mergeAll, mat4, plate, boxUV } from '../geometry/utils.js';
import { merlinGeometry, merlinVacGeometry, instanceEngines, ringLayout } from './engines.js';

const R = 1.85;                    // 3.7 m diameter
// y = 0 is the Merlin exit plane — the lowest point of the vehicle and the datum the 70 m
// overall height is measured from. The tank barrel therefore starts one nozzle length up.
const ENGINE_DROP = 1.0;
const TOTAL_H = 70;                // spacex.com
const S1_H = 41.2;                 // first stage, interstage included (Wikipedia)
const INTERSTAGE_H = 6.7;          // approx
const TANK_TOP = S1_H - INTERSTAGE_H;   // 34.5 m — top of the LOX tank / base of interstage
const S2_H = 13.8;                 // second stage (Wikipedia)
const S2_TOP = S1_H + S2_H;        // 55.0 m
const FAIRING_BASE = TOTAL_H - 13.1;    // 56.9 m (fairing height from spacex.com)
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
function landingLeg(M, { length = 9.6 } = {}) {
  const outline = [
    [-0.56, 0], [0.56, 0], [0.52, 1.1], [0.34, length * 0.55], [0.2, length - 0.5], [0.09, length],
    [-0.09, length], [-0.2, length - 0.5], [-0.34, length * 0.55], [-0.52, 1.1],
  ];
  const g = new THREE.Group();
  g.add(mesh(boxUV(plate(outline, 0.3, 0.06)), M.carbon, { name: 'leg-fairing' }));
  // Hinge block at the octaweb and the telescoping pusher behind the fairing.
  g.add(mesh(boxUV(mergeAll([
    { geometry: new THREE.BoxGeometry(1.34, 0.62, 0.46), matrix: mat4([0, 0.34, 0.0]) },
    { geometry: new THREE.CylinderGeometry(0.15, 0.19, 2.4, 14), matrix: mat4([0, 1.7, 0.24]) },
  ])), M.darkMetal));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 12), M.aluminum, { position: [0, 3.6, 0.2] }));
  // Hold-down latches along the fairing, and the crush core at the foot. A stowed leg that is
  // one smooth slab reads as a moulding; what says "this unfolds" is the hardware holding it.
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
 * Builds one core. variant: 'f9' | 'fh-center' | 'fh-side'.
 * Side boosters replace the interstage and second stage with a nose cone.
 */
export function buildFalconCore(M, { variant = 'f9', bodyMaterial } = {}) {
  const g = new THREE.Group();
  g.name = `falcon-core-${variant}`;
  const body = bodyMaterial ?? M.f9Stage1;

  // Tank section: RP-1 below, LOX above, one unwrapped texture over the whole barrel.
  g.add(mesh(lathe([{ r: R, y: ENGINE_DROP }, { r: R, y: TANK_TOP }], { segments: 128, uvMode: 'normalized' }), body, { name: 'stage1' }));

  // Octaweb thrust structure and base heat shield. This is the view the "Octaweb · 9 Merlins"
  // preset looks straight up into, and it was a dark cylinder with eight plates in it.
  g.add(mesh(lathe([{ r: R - 0.03, y: ENGINE_DROP + 0.05 }, { r: R - 0.03, y: ENGINE_DROP + 2.6 }], { segments: 64, flip: true }), M.darkMetal, { castShadow: false, name: 'octaweb-wall' }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.25, 64), M.blackMatte, { position: [0, ENGINE_DROP + 2.6, 0] }));
  const octaweb = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    // Radial web between each pair of outer engines, with a flange top and bottom: the real
    // structure is a welded aluminium spider, and the flanges are what give it depth when the
    // camera is underneath looking up at it.
    octaweb.push({ geometry: new THREE.BoxGeometry(0.09, 2.4, 0.95), matrix: mat4([Math.sin(a) * 0.86, ENGINE_DROP + 1.3, Math.cos(a) * 0.86], [0, a, 0]) });
    for (const dy of [-1.15, 1.15]) {
      octaweb.push({ geometry: new THREE.BoxGeometry(0.2, 0.08, 0.95), matrix: mat4([Math.sin(a) * 0.86, ENGINE_DROP + 1.3 + dy, Math.cos(a) * 0.86], [0, a, 0]) });
    }
  }
  // Base heat shield: the segmented apron between the engines and the tank, and the cutouts
  // the nine bells come through.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    octaweb.push({
      geometry: new THREE.BoxGeometry(0.06, 0.5, 1.5),
      matrix: mat4([Math.sin(a) * (R - 0.42), ENGINE_DROP + 0.3, Math.cos(a) * (R - 0.42)], [0, a, 0]),
    });
  }
  g.add(mesh(boxUV(mergeAll(octaweb)), M.darkMetal, { name: 'octaweb-structure' }));
  // Helium COPVs and the hydraulic accumulators clustered round the thrust structure — the
  // spheres and bottles that are the most recognisable thing in a photograph of a Falcon base.
  {
    const bottles = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      bottles.push({ geometry: new THREE.SphereGeometry(0.28, 16, 12), matrix: mat4([Math.sin(a) * (R - 0.52), ENGINE_DROP + 1.9, Math.cos(a) * (R - 0.52)]) });
      bottles.push({ geometry: new THREE.CylinderGeometry(0.11, 0.11, 0.9, 12), matrix: mat4([Math.sin(a + 0.34) * (R - 0.4), ENGINE_DROP + 1.5, Math.cos(a + 0.34) * (R - 0.4)]) });
    }
    g.add(mesh(boxUV(mergeAll(bottles)), M.aluminum, { name: 'base-bottles' }));
  }
  // 9 Merlin 1D: eight almost touching on a 1.27 m ring plus one on the axis.
  g.add(instanceEngines(merlinGeometry(), M, [
    { position: [0, 0, 0], tilt: [0, 0], spin: 0 },
    ...ringLayout(8, 1.27, 0, { phase: Math.PI / 8 }),
  ]));

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
    // Nose cone in place of the interstage (spacex.com); length approximated from imagery.
    const noseL = 6.5;
    const prof = [{ r: R, y: TANK_TOP }, { r: R, y: TANK_TOP + 0.5 }, ...ogiveProfile(R, noseL - 0.5, TANK_TOP + 0.5, 30, 0.16).slice(1)];
    g.add(mesh(lathe(prof, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
    addGridFins(TANK_TOP - 1.6);
    g.userData.top = TANK_TOP + noseL;
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
  g.add(mesh(new THREE.TorusGeometry(R + 0.012, 0.035, 6, 96), M.darkMetal, { position: [0, S1_H + S2_H * 0.42, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  // Cold-gas thruster pods used for second-stage attitude control.
  for (const a of [Math.PI * 0.25, Math.PI * 1.25]) {
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 14), M.darkMetal,
      { position: [Math.sin(a) * (R + 0.06), S2_TOP - 1.2, Math.cos(a) * (R + 0.06)], rotation: [0, 0, Math.PI / 2] }));
  }
  g.add(mesh(lathe([{ r: R, y: S2_TOP }, { r: R * 0.97, y: FAIRING_BASE }], { segments: 128 }), M.whitePanel, { name: 'payload-adapter' }));
  g.add(mesh(new THREE.BoxGeometry(0.38, S2_H - 1.2, 0.18), M.blackMatte, { position: [0, S1_H + S2_H / 2, R + 0.08] }));

  // Fairing: 13.1 m × 5.2 m, two halves, blunt ogive nose.
  const ogiveStart = FAIRING_BASE + 6.1;
  const fProf = [
    { r: R * 0.97, y: FAIRING_BASE }, { r: R * 0.97, y: FAIRING_BASE + 0.1, sharp: true },
    { r: FAIRING_R, y: FAIRING_BASE + 1.55, sharp: true }, { r: FAIRING_R, y: ogiveStart },
    ...ogiveProfile(FAIRING_R, TOTAL_H - ogiveStart, ogiveStart, 48, 0.55).slice(1),
  ];
  g.add(mesh(lathe(fProf, { segments: 160 }), M.whiteFresh, { name: 'fairing' }));
  // Two frame stations on the cylindrical skirt, so the fairing is a shell with
  // structure rather than one unbroken ogive. Approximate, from imagery.
  g.add(mesh(mergeAll([
    { geometry: new THREE.TorusGeometry(FAIRING_R + 0.008, 0.014, 5, 64), matrix: mat4([0, FAIRING_BASE + 2.2, 0], [Math.PI / 2, 0, 0]) },
    { geometry: new THREE.TorusGeometry(FAIRING_R + 0.008, 0.014, 5, 64), matrix: mat4([0, ogiveStart - 0.35, 0], [Math.PI / 2, 0, 0]) },
  ]), M.alumDark, { name: 'fairing-frames', castShadow: false }));
  // Split line between the halves.
  for (const phi of [Math.PI / 2, -Math.PI / 2]) {
    g.add(mesh(lathe(fProf.map(p => ({ r: p.r + 0.014, y: p.y })), { segments: 2, phiStart: phi - 0.005, phiLength: 0.01 }), M.blackMatte, { castShadow: false }));
  }
  g.add(mesh(new THREE.TorusGeometry(R * 0.97 + 0.02, 0.055, 6, 96), M.darkMetal, { position: [0, FAIRING_BASE + 0.06, 0], rotation: [Math.PI / 2, 0, 0] }));
  g.userData.top = TOTAL_H;
  markFalconDetail(g);
  return g;
}

/**
 * What stops being worth drawing on a 70 m booster, by the size of the smallest thing it
 * carries. Almost all of it lives in the two and a half metres above the ground, inside the
 * Octaweb, where the "9 Merlins" preset looks straight up into it — and where nothing at all
 * can be seen of it from the museum row, because it is under the rocket.
 *
 * The grid fins, the legs and the raceway stay: they break the cylinder's outline, and a
 * Falcon without them reads as a white tube.
 */
function markFalconDetail(g) {
  const FINE = {
    'octaweb-wall': 0.12, 'octaweb-structure': 0.06, 'base-bottles': 0.22,
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
  { label: 'Fairing · 13.1 m × 5.2 m', position: [0, FAIRING_BASE + 6, FAIRING_R + 0.4] },
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

export function buildFalconHeavy(M) {
  const g = new THREE.Group();
  g.name = 'falconheavy';
  const spacing = (12.2 - 3.7) / 2;   // 4.25 m between core axes, from the 12.2 m width
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
  // Housings across the gap, kept off the rod mesh so the eight pneumatic
  // paths stay eight components. Reconstructed; the count of rods is published.
  const saddles = [];
  for (const s of [-1, 1]) {
    for (const y of [TANK_TOP - 0.45, 2.6]) {
      saddles.push({
        geometry: new THREE.BoxGeometry(0.9, 0.36, 1.35),
        matrix: mat4([s * spacing / 2, y, 0]),
      });
    }
  }
  // boxUV, like every other merged structural run in the project: merging keeps each
  // cylinder's own 0..1 UVs, so the grey-metal map — authored for a one-metre tile — was being
  // stretched over a four-metre strut. Planar metric UVs put it back on its own scale.
  g.add(mesh(boxUV(mergeAll(struts)), M.darkMetal, { name: 'fh-attach-struts' }));
  g.add(mesh(boxUV(mergeAll(detail)), M.alumDark, { name: 'fh-pusher-detail' }));
  g.add(mesh(boxUV(mergeAll(saddles)), M.darkMetal, { name: 'fh-attach-housings', castShadow: false }));
  g.userData.attachments = { reconstructedGeometry: true, interfaces };
  markFalconDetail(g);

  g.userData.height = TOTAL_H;
  g.userData.width = 12.2;
  g.userData.stations = { tankTop: TANK_TOP, s1Top: S1_H, s2Top: S2_TOP, fairingBase: FAIRING_BASE, spacing };
  g.userData.annotations = [
    { label: '27 Merlin 1D (3 × 9)', position: [0, -0.3, 2.8] },
    { label: 'Side booster with nose cone', position: [-spacing, TANK_TOP + 4.4, 1.2] },
    { label: 'Reinforced centre core', position: [0, 18, R + 0.35] },
    { label: 'Forward pneumatic attach points (LOX tank)', position: [spacing - 2.1, TANK_TOP - 0.45, 1.2] },
    { label: 'Lower attach point (Octaweb)', position: [spacing - 2.1, 3.2, 1.4] },
    { label: 'Fairing · 13.1 m × 5.2 m', position: [0, FAIRING_BASE + 6, FAIRING_R + 0.4] },
  ];
  return g;
}
