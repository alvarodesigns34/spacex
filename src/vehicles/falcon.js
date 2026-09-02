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
import { lathe, ogiveProfile, mesh, mergeAll, mat4, plate } from '../geometry/utils.js';
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

/** Titanium grid fin: an orthogonal waffle inside a closed frame. */
function titaniumGridFin(M, { span = 1.55, chord = 1.25, depth = 0.12 } = {}) {
  const parts = [];
  const frame = 0.035, web = 0.018;
  parts.push({ geometry: new THREE.BoxGeometry(span, depth, frame), matrix: mat4([span / 2, 0, chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(span, depth, frame), matrix: mat4([span / 2, 0, -chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(frame, depth, chord), matrix: mat4([span, 0, 0]) });
  parts.push({ geometry: new THREE.BoxGeometry(frame * 1.6, depth, chord), matrix: mat4([0, 0, 0]) });
  const nx = 9, nz = 7;
  for (let i = 1; i < nx; i++) parts.push({ geometry: new THREE.BoxGeometry(web, depth, chord), matrix: mat4([(span * i) / nx, 0, 0]) });
  for (let j = 1; j < nz; j++) parts.push({ geometry: new THREE.BoxGeometry(span, depth * 0.95, web), matrix: mat4([span / 2, 0, -chord / 2 + (chord * j) / nz]) });
  return mesh(mergeAll(parts), M.titanium);
}

/** Landing leg, stowed flat against the base: a tapered composite fairing over the strut. */
function landingLeg(M, { length = 9.6 } = {}) {
  const outline = [
    [-0.56, 0], [0.56, 0], [0.52, 1.1], [0.34, length * 0.55], [0.2, length - 0.5], [0.09, length],
    [-0.09, length], [-0.2, length - 0.5], [-0.34, length * 0.55], [-0.52, 1.1],
  ];
  const g = new THREE.Group();
  g.add(mesh(plate(outline, 0.3, 0.06), M.carbon));
  // Hinge block at the octaweb and the telescoping pusher behind the fairing.
  g.add(mesh(mergeAll([
    { geometry: new THREE.BoxGeometry(1.34, 0.62, 0.46), matrix: mat4([0, 0.34, 0.0]) },
    { geometry: new THREE.CylinderGeometry(0.15, 0.19, 2.4, 14), matrix: mat4([0, 1.7, 0.24]) },
  ]), M.darkMetal));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 12), M.aluminum, { position: [0, 3.6, 0.2] }));
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

  // Octaweb thrust structure and base heat shield.
  g.add(mesh(lathe([{ r: R - 0.03, y: ENGINE_DROP + 0.05 }, { r: R - 0.03, y: ENGINE_DROP + 2.6 }], { segments: 64, flip: true }), M.darkMetal, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.25, 64), M.blackMatte, { position: [0, ENGINE_DROP + 2.6, 0] }));
  const octaweb = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    octaweb.push({ geometry: new THREE.BoxGeometry(0.09, 2.4, 0.95), matrix: mat4([Math.sin(a) * 0.86, ENGINE_DROP + 1.3, Math.cos(a) * 0.86], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(octaweb), M.darkMetal));
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
  g.add(mesh(new THREE.BoxGeometry(0.44, TANK_TOP - ENGINE_DROP - 2.6, 0.2), M.blackMatte, { position: [0, (TANK_TOP + ENGINE_DROP) / 2 + 1.0, R + 0.09] }));
  // Stage separation flange.
  g.add(mesh(new THREE.TorusGeometry(R + 0.015, 0.05, 6, 96), M.darkMetal, { position: [0, TANK_TOP, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));

  if (variant === 'fh-side') {
    // Nose cone in place of the interstage (spacex.com); length approximated from imagery.
    const noseL = 6.5;
    const prof = [{ r: R, y: TANK_TOP }, { r: R, y: TANK_TOP + 0.5 }, ...ogiveProfile(R, noseL - 0.5, TANK_TOP + 0.5, 30, 0.16).slice(1)];
    g.add(mesh(lathe(prof, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
    g.userData.top = TANK_TOP + noseL;
    return g;
  }

  // Interstage: unpainted carbon composite, with the Merlin Vacuum nozzle inside it.
  g.add(mesh(lathe([{ r: R, y: TANK_TOP }, { r: R, y: S1_H }], { segments: 128 }), M.carbon, { name: 'interstage' }));
  g.add(mesh(lathe([{ r: R - 0.03, y: TANK_TOP + 0.2 }, { r: R - 0.03, y: S1_H }], { segments: 64, flip: true }), M.blackMatte, { castShadow: false }));
  g.add(instanceEngines(merlinVacGeometry(), M, [{ position: [0, TANK_TOP + 0.9, 0], tilt: [0, 0], spin: 0 }], { bellMaterial: M.bellCool }));

  // Four titanium grid fins, stowed flat at the top of the interstage.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const holder = new THREE.Group();
    const fin = titaniumGridFin(M);
    fin.rotation.set(0, Math.PI / 2, Math.PI / 2);   // span → vertical, depth → radial
    holder.add(fin);
    holder.position.set(Math.sin(a) * (R + 0.09), S1_H - 1.95, Math.cos(a) * (R + 0.09));
    holder.rotation.y = a;
    g.add(holder);
    const hinge = mesh(new THREE.BoxGeometry(1.35, 0.34, 0.4), M.darkMetal);
    hinge.position.set(Math.sin(a) * (R + 0.11), S1_H - 2.05, Math.cos(a) * (R + 0.11));
    hinge.rotation.y = a;
    g.add(hinge);
  }

  // Second stage: LOX/RP-1 tank plus the payload interface below the fairing.
  g.add(mesh(lathe([{ r: R, y: S1_H }, { r: R, y: S2_TOP }], { segments: 128 }), M.white, { name: 'stage2' }));
  g.add(mesh(lathe([{ r: R, y: S2_TOP }, { r: R * 0.97, y: FAIRING_BASE }], { segments: 128 }), M.whitePanel, { name: 'payload-adapter' }));
  g.add(mesh(new THREE.BoxGeometry(0.38, S2_H - 1.2, 0.18), M.blackMatte, { position: [0, S1_H + S2_H / 2, R + 0.08] }));

  // Fairing: 13.1 m × 5.2 m, two halves, blunt ogive nose.
  const ogiveStart = FAIRING_BASE + 6.1;
  const fProf = [
    { r: R * 0.97, y: FAIRING_BASE }, { r: R * 0.97, y: FAIRING_BASE + 0.1, sharp: true },
    { r: FAIRING_R, y: FAIRING_BASE + 1.55, sharp: true }, { r: FAIRING_R, y: ogiveStart },
    ...ogiveProfile(FAIRING_R, TOTAL_H - ogiveStart, ogiveStart, 34, 0.34).slice(1),
  ];
  g.add(mesh(lathe(fProf, { segments: 160 }), M.whiteFresh, { name: 'fairing' }));
  // Split line between the halves.
  for (const phi of [Math.PI / 2, -Math.PI / 2]) {
    g.add(mesh(lathe(fProf.map(p => ({ r: p.r + 0.014, y: p.y })), { segments: 2, phiStart: phi - 0.005, phiLength: 0.01 }), M.blackMatte, { castShadow: false }));
  }
  g.add(mesh(new THREE.TorusGeometry(R * 0.97 + 0.02, 0.055, 6, 96), M.darkMetal, { position: [0, FAIRING_BASE + 0.06, 0], rotation: [Math.PI / 2, 0, 0] }));
  g.userData.top = TOTAL_H;
  return g;
}

const commonAnnotations = () => [
  { label: 'Tanque RP-1', position: [0, 10, R + 0.3] },
  { label: 'Tanque LOX', position: [0, 26, R + 0.3] },
  { label: 'Interetapa (composite)', position: [0, TANK_TOP + 3.2, R + 0.35] },
  { label: 'Grid fin de titanio', position: [Math.sin(Math.PI / 4) * 2.9, S1_H - 1.6, Math.cos(Math.PI / 4) * 2.9] },
  { label: '2.ª etapa · Merlin Vacuum', position: [0, S1_H + S2_H / 2, R + 0.35] },
  { label: 'Cofia · 13,1 m × 5,2 m', position: [0, FAIRING_BASE + 6, FAIRING_R + 0.4] },
];

export function buildFalcon9(M) {
  const g = new THREE.Group();
  g.name = 'falcon9';
  g.add(buildFalconCore(M, { variant: 'f9' }));
  g.userData.height = TOTAL_H;
  g.userData.stations = { tankTop: TANK_TOP, s1Top: S1_H, s2Top: S2_TOP, fairingBase: FAIRING_BASE };
  g.userData.annotations = [
    { label: '9 Merlin 1D · Octaweb', position: [0, -0.3, 2.6] },
    { label: 'Pata de aterrizaje (plegada)', position: [Math.sin(Math.PI / 4) * 2.5, 6, Math.cos(Math.PI / 4) * 2.5] },
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
  left.rotation.y = Math.PI / 2; right.rotation.y = -Math.PI / 2;   // raceways face outward
  g.add(center, left, right);

  // Attachment struts at the nose-cone shoulder and across the octawebs.
  const struts = [];
  const strut = (a, b, r = 0.13) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    struts.push({
      geometry: new THREE.CylinderGeometry(r, r, len, 12),
      matrix: new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)),
    });
  };
  for (const s of [-1, 1]) {
    const x0 = s * (spacing - R), x1 = s * R;
    strut([x0 + s * 0.2, TANK_TOP + 0.8, 0.55], [x1 - s * 0.2, TANK_TOP + 2.4, 0.55]);
    strut([x0 + s * 0.2, TANK_TOP + 0.8, -0.55], [x1 - s * 0.2, TANK_TOP + 2.4, -0.55]);
    strut([x0 + s * 0.2, TANK_TOP + 0.8, 0.55], [x0 + s * 0.2, TANK_TOP + 0.8, -0.55], 0.1);
    strut([x0, 2.6, 0.7], [x1, 2.6, 0.7], 0.16);
    strut([x0, 2.6, -0.7], [x1, 2.6, -0.7], 0.16);
    strut([x0, 4.4, 0], [x1, 4.4, 0], 0.16);
  }
  g.add(mesh(mergeAll(struts), M.darkMetal));

  g.userData.height = TOTAL_H;
  g.userData.width = 12.2;
  g.userData.stations = { tankTop: TANK_TOP, s1Top: S1_H, s2Top: S2_TOP, fairingBase: FAIRING_BASE, spacing };
  g.userData.annotations = [
    { label: '27 Merlin 1D (3 × 9)', position: [0, -0.3, 2.8] },
    { label: 'Propulsor lateral con cono de morro', position: [-spacing, TANK_TOP + 4.4, 1.2] },
    { label: 'Núcleo central reforzado', position: [0, 18, R + 0.35] },
    { label: 'Unión superior (cono / interetapa)', position: [spacing - 2.1, TANK_TOP + 1.8, 1.2] },
    { label: 'Unión inferior (Octaweb)', position: [spacing - 2.1, 3.2, 1.4] },
    { label: 'Cofia · 13,1 m × 5,2 m', position: [0, FAIRING_BASE + 6, FAIRING_R + 0.4] },
  ];
  return g;
}
