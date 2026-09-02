/**
 * Falcon 9 Block 5 and Falcon Heavy.
 *
 * Verified figures: height 70 m, diameter 3.7 m, fairing 13.1 m × 5.2 m, 9 Merlin per core,
 * Falcon Heavy width 12.2 m (spacex.com); first stage 41.2 m, second stage 13.8 m, Merlin 1D
 * nozzle 0.92 m, MVac nozzle 3.3 m, titanium grid fins (Wikipedia).
 * Approximated: interstage length (~6.7 m), stowed leg length, fin size, strut geometry, nose cones.
 */
import * as THREE from 'three';
import { lathe, ogiveProfile, mesh, mergeAll, mat4, plate } from '../geometry/utils.js';
import { merlinGeometry, merlinVacGeometry, instanceEngines, ringLayout } from './engines.js';

const R = 1.85;                 // 3.7 m diameter
const S1_H = 41.2;              // first stage (Wikipedia)
const INTERSTAGE_H = 6.7;       // approx
const S2_TOP = 70 - 13.1;       // 56.9 m: fairing base
const FAIRING_R = 2.6;          // 5.2 m diameter
const TOTAL_H = 70;

function titaniumGridFin(M, { span = 1.5, chord = 1.2, thickness = 0.12 } = {}) {
  const parts = [];
  const t = 0.02;
  parts.push({ geometry: new THREE.BoxGeometry(span, thickness, t), matrix: mat4([span / 2, 0, chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(span, thickness, t), matrix: mat4([span / 2, 0, -chord / 2]) });
  parts.push({ geometry: new THREE.BoxGeometry(t, thickness, chord), matrix: mat4([span, 0, 0]) });
  parts.push({ geometry: new THREE.BoxGeometry(t * 2, thickness, chord), matrix: mat4([0, 0, 0]) });
  const nx = 9, nz = 7;
  for (let i = 1; i < nx; i++) parts.push({ geometry: new THREE.BoxGeometry(t, thickness, chord), matrix: mat4([(span * i) / nx, 0, 0]) });
  for (let j = 1; j < nz; j++) parts.push({ geometry: new THREE.BoxGeometry(span, thickness, t), matrix: mat4([span / 2, 0, -chord / 2 + (chord * j) / nz]) });
  return mesh(mergeAll(parts), M.titanium);
}

function landingLeg(M, { length = 10.6 } = {}) {
  // Stowed leg: tapered carbon-fibre fairing lying flat along the hull with the foot pad at the bottom.
  const outline = [[-0.55, 0], [0.55, 0], [0.5, 0.9], [0.25, length - 0.6], [0.12, length], [-0.12, length], [-0.25, length - 0.6], [-0.5, 0.9]];
  const body = plate(outline, 0.34, 0.06);
  body.rotateX(0); // plate lies in local XY, thickness along Z (outward)
  const g = new THREE.Group();
  g.add(mesh(body, M.carbon));
  // Telescoping strut housing (hinge at the octaweb)
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.2, 16), M.darkMetal, { position: [0, 1.6, 0.3] }));
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.5, 0.5), M.darkMetal, { position: [0, 0.3, 0.05] }));
  return g;
}

/**
 * Builds one core. variant: 'f9' | 'fh-center' | 'fh-side'
 */
export function buildFalconCore(M, { variant = 'f9', bodyMaterial } = {}) {
  const g = new THREE.Group();
  g.name = `falcon-core-${variant}`;
  const body = bodyMaterial ?? M.f9Stage1;

  // First stage tank barrel with the unwrapped full-body texture.
  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: S1_H }], { segments: 128, uvMode: 'normalized' }), body, { name: 'stage1' }));
  // Octaweb thrust structure and heat shield plate
  g.add(mesh(lathe([{ r: R - 0.02, y: 0.05 }, { r: R - 0.02, y: 2.6 }], { segments: 64, flip: true }), M.darkMetal, { castShadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.25, 64), M.blackMatte, { position: [0, 2.6, 0] }));
  const octaweb = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    octaweb.push({ geometry: new THREE.BoxGeometry(0.08, 2.4, 0.9), matrix: mat4([Math.sin(a) * 0.85, 1.3, Math.cos(a) * 0.85], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(octaweb), M.darkMetal));
  // 9 Merlin 1D: 8 in a ring + centre; nozzles hang ~1 m below the octaweb base.
  const merlin = merlinGeometry();
  const tf = [{ position: [0, -1.0, 0], tilt: [0, 0], spin: 0 }, ...ringLayout(8, 1.27, -1.0, { phase: Math.PI / 8 })];
  g.add(instanceEngines(merlin, M, tf));

  // Landing legs (4), stowed
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const leg = landingLeg(M);
    leg.position.set(Math.sin(a) * (R + 0.17), 0.35, Math.cos(a) * (R + 0.17));
    leg.rotation.y = a;
    g.add(leg);
  }
  // Raceway (cable/pipe conduit) along the stage
  const race = mesh(new THREE.BoxGeometry(0.42, S1_H - 3.5, 0.22), M.blackMatte);
  race.position.set(0, S1_H / 2 + 1.5, R + 0.1);
  g.add(race);

  if (variant === 'fh-side') {
    // Nose cone replaces the interstage (spacex.com). Length approximate.
    const noseL = 6.2;
    const prof = [{ r: R, y: S1_H }, { r: R, y: S1_H + 0.6 }, ...ogiveProfile(R, noseL - 0.6, S1_H + 0.6, 28, 0.0, 0.9).slice(1)];
    g.add(mesh(lathe(prof, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
    g.add(mesh(new THREE.SphereGeometry(0.22, 16, 12), M.whiteFresh, { position: [0, S1_H + noseL - 0.15, 0] }));
    g.userData.top = S1_H + noseL;
  } else {
    // Interstage: black carbon composite
    g.add(mesh(lathe([{ r: R, y: S1_H }, { r: R, y: S1_H + INTERSTAGE_H }], { segments: 128 }), M.carbon, { name: 'interstage' }));
    g.add(mesh(lathe([{ r: R - 0.02, y: S1_H + 0.2 }, { r: R - 0.02, y: S1_H + INTERSTAGE_H }], { segments: 64, flip: true }), M.blackMatte, { castShadow: false }));
    // Merlin Vacuum sits inside the interstage
    const mvac = merlinVacGeometry();
    g.add(instanceEngines(mvac, M, [{ position: [0, S1_H + 1.2, 0], tilt: [0, 0], spin: 0 }], { bellMaterial: M.bellCool }));
    // Titanium grid fins (4), stowed flat against the interstage
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const fin = titaniumGridFin(M);
      // span → vertical (+Y), thickness → radial (+Z of the holder), chord → tangential
      fin.rotation.set(0, Math.PI / 2, Math.PI / 2);
      const holder = new THREE.Group();
      holder.add(fin);
      holder.position.set(Math.sin(a) * (R + 0.1), S1_H + INTERSTAGE_H - 1.75, Math.cos(a) * (R + 0.1));
      holder.rotation.y = a;
      g.add(holder);
      const hinge = mesh(new THREE.BoxGeometry(1.4, 0.35, 0.42), M.darkMetal);
      hinge.position.set(Math.sin(a) * (R + 0.12), S1_H + INTERSTAGE_H - 1.85, Math.cos(a) * (R + 0.12));
      hinge.rotation.y = a;
      g.add(hinge);
    }
    // Second stage
    const s2Base = S1_H + INTERSTAGE_H;
    g.add(mesh(lathe([{ r: R, y: s2Base }, { r: R, y: S2_TOP }], { segments: 128 }), M.white, { name: 'stage2' }));
    const race2 = mesh(new THREE.BoxGeometry(0.38, S2_TOP - s2Base - 0.6, 0.2), M.blackMatte);
    race2.position.set(0, (S2_TOP + s2Base) / 2, R + 0.08);
    g.add(race2);
    // Fairing: 13.1 m × 5.2 m, two halves.
    const fProf = [
      { r: R, y: S2_TOP }, { r: R, y: S2_TOP + 0.15, sharp: true }, { r: FAIRING_R, y: S2_TOP + 1.7, sharp: true }, { r: FAIRING_R, y: S2_TOP + 6.1 },
      ...ogiveProfile(FAIRING_R, TOTAL_H - (S2_TOP + 6.1), S2_TOP + 6.1, 36, 0.0, 0.95).slice(1),
    ];
    g.add(mesh(lathe(fProf, { segments: 160 }), M.whiteFresh, { name: 'fairing' }));
    g.add(mesh(new THREE.SphereGeometry(0.25, 16, 12), M.whiteFresh, { position: [0, TOTAL_H - 0.18, 0] }));
    // Half seams
    for (const phi of [Math.PI / 2, -Math.PI / 2]) {
      g.add(mesh(lathe(fProf.map(p => ({ r: p.r + 0.012, y: p.y })), { segments: 2, phiStart: phi - 0.006, phiLength: 0.012 }), M.blackMatte, { castShadow: false }));
    }
    // Fairing separation ring
    g.add(mesh(new THREE.TorusGeometry(R + 0.02, 0.06, 6, 96), M.darkMetal, { position: [0, S2_TOP + 0.1, 0], rotation: [Math.PI / 2, 0, 0] }));
    g.userData.top = TOTAL_H;
  }
  // Stage-1 top separation flange
  g.add(mesh(new THREE.TorusGeometry(R + 0.015, 0.05, 6, 96), M.darkMetal, { position: [0, S1_H, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));
  return g;
}

export function buildFalcon9(M) {
  const g = new THREE.Group();
  g.name = 'falcon9';
  g.add(buildFalconCore(M, { variant: 'f9' }));
  g.userData.height = TOTAL_H;
  g.userData.annotations = [
    { label: '9 Merlin 1D · Octaweb', position: [0, -1.2, 2.6] },
    { label: 'Pata de aterrizaje (plegada)', position: [Math.sin(Math.PI / 4) * 2.4, 6, Math.cos(Math.PI / 4) * 2.4] },
    { label: 'Tanque RP-1', position: [0, 12, R + 0.3] },
    { label: 'Tanque LOX', position: [0, 30, R + 0.3] },
    { label: 'Interetapa (composite)', position: [0, S1_H + 3, R + 0.3] },
    { label: 'Grid fin de titanio', position: [Math.sin(Math.PI / 4) * 2.6, S1_H + INTERSTAGE_H - 1.2, Math.cos(Math.PI / 4) * 2.6] },
    { label: '2.ª etapa · Merlin Vacuum', position: [0, 52, R + 0.3] },
    { label: 'Cofia · 13,1 m × 5,2 m', position: [0, 63, FAIRING_R + 0.3] },
  ];
  return g;
}

export function buildFalconHeavy(M) {
  const g = new THREE.Group();
  g.name = 'falconheavy';
  const spacing = (12.2 - 3.7) / 2; // 4.25 m between core axes (derived from the 12.2 m width)
  const center = buildFalconCore(M, { variant: 'fh-center', bodyMaterial: M.fhCore });
  const left = buildFalconCore(M, { variant: 'fh-side', bodyMaterial: M.fhSide });
  const right = buildFalconCore(M, { variant: 'fh-side', bodyMaterial: M.fhSide });
  left.position.x = -spacing; right.position.x = spacing;
  left.rotation.y = Math.PI / 2; right.rotation.y = -Math.PI / 2; // raceways face outward
  g.add(center, left, right);
  // Attachment struts: nose-cone level, interstage level and Octaweb level (approximate).
  const struts = [];
  const strut = (a, b, r = 0.13) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const geo = new THREE.CylinderGeometry(r, r, len, 12);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    struts.push({ geometry: geo, matrix: m });
  };
  for (const s of [-1, 1]) {
    const x0 = s * (spacing - R), x1 = s * R;
    // top: from side-booster shoulder to the centre-core interstage
    strut([x0 + s * 0.2, S1_H + 0.9, 0.55], [x1 - s * 0.2, S1_H + 2.6, 0.55]);
    strut([x0 + s * 0.2, S1_H + 0.9, -0.55], [x1 - s * 0.2, S1_H + 2.6, -0.55]);
    strut([x0 + s * 0.2, S1_H + 0.9, 0.55], [x0 + s * 0.2, S1_H + 0.9, -0.55], 0.1);
    // bottom: Octaweb-to-Octaweb
    strut([x0, 1.6, 0.7], [x1, 1.6, 0.7], 0.16);
    strut([x0, 1.6, -0.7], [x1, 1.6, -0.7], 0.16);
    strut([x0, 3.4, 0], [x1, 3.4, 0], 0.16);
  }
  g.add(mesh(mergeAll(struts), M.darkMetal));
  g.userData.height = TOTAL_H;
  g.userData.annotations = [
    { label: '27 Merlin 1D (3 × 9)', position: [0, -1.2, 2.8] },
    { label: 'Propulsor lateral con cono de morro', position: [-spacing, S1_H + 5.5, 1.2] },
    { label: 'Núcleo central reforzado', position: [0, 20, R + 0.3] },
    { label: 'Unión superior (cono / interetapa)', position: [spacing - 2.1, S1_H + 2.0, 1.2] },
    { label: 'Unión inferior (Octaweb)', position: [spacing - 2.1, 2.2, 1.4] },
    { label: 'Cofia · 13,1 m × 5,2 m', position: [0, 63, FAIRING_R + 0.3] },
  ];
  return g;
}
