/**
 * Starlink V2 Mini. Public figures: bus ≈4.1 m wide, ≈800 kg, two solar wings, ≈30 m span,
 * ≈116 m² total area, argon Hall thrusters, laser links, phased-array antennas (Spaceflight Now,
 * SpaceNews, FCC filings via press). No official drawing exists: bus thickness, antenna count,
 * laser-terminal and thruster placement are reconstructed from deployment imagery.
 * Local frame: bus centred at origin, nadir face = −Y, wings along ±X.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';

const BUS_W = 2.7;   // along X (approx, derived)
const BUS_L = 4.1;   // along Z (press)
const BUS_T = 0.22;  // thickness (approx)
// Sized so the deployed span is exactly the published 30 m: (30 − 2.7)/2 − 0.55 yoke.
const WING_L = 13.1;
const WING_W = 4.1;

export function buildStarlink(M) {
  const g = new THREE.Group();
  g.name = 'starlink';

  // ---- Bus ----
  const bus = new THREE.BoxGeometry(BUS_W, BUS_T, BUS_L, 1, 1, 1);
  g.add(mesh(bus, M.aluminum, { name: 'bus' }));
  // Zenith face: white multi-layer insulation with the usual gold-taped seams. Photographs
  // of a deployed V2 Mini show a mostly white blanket, not the gold of a deep-space bus.
  g.add(mesh(new THREE.BoxGeometry(BUS_W - 0.1, 0.02, BUS_L - 0.1), M.mliWhite, { position: [0, BUS_T / 2 + 0.011, 0] }));
  const tape = [];
  for (const z of [-1.35, 1.35]) tape.push({ geometry: new THREE.BoxGeometry(BUS_W - 0.14, 0.006, 0.08), matrix: mat4([0, BUS_T / 2 + 0.024, z]) });
  g.add(mesh(mergeAll(tape), M.goldKapton, { castShadow: false }));
  // Nadir face: dark radome/antenna deck
  g.add(mesh(new THREE.BoxGeometry(BUS_W - 0.06, 0.02, BUS_L - 0.06), M.blackMatte, { position: [0, -BUS_T / 2 - 0.01, 0] }));
  // Phased-array antennas (nadir): three large user-link arrays + two smaller gateway arrays (approx)
  const arrays = [];
  const big = [[0, -1.35], [0, 0], [0, 1.35]];
  for (const [x, z] of big) arrays.push({ geometry: new THREE.BoxGeometry(1.2, 0.06, 1.2), matrix: mat4([x, -BUS_T / 2 - 0.05, z]) });
  for (const [x, z] of [[-1.0, -1.7], [1.0, 1.7], [-1.0, 1.7], [1.0, -1.7]]) arrays.push({ geometry: new THREE.CylinderGeometry(0.28, 0.28, 0.08, 32), matrix: mat4([x, -BUS_T / 2 - 0.05, z]) });
  for (const [x, z] of [[-0.9, 0], [0.9, 0]]) arrays.push({ geometry: new THREE.BoxGeometry(0.55, 0.06, 0.9), matrix: mat4([x, -BUS_T / 2 - 0.05, z]) });
  g.add(mesh(mergeAll(arrays), M.blackGloss, { name: 'phased-arrays' }));
  // Antenna surface detail: fine grid of patch elements on the large arrays
  const patches = [];
  for (const [x, z] of big) for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    patches.push({ geometry: new THREE.BoxGeometry(0.11, 0.01, 0.11), matrix: mat4([x - 0.53 + i * 0.152, -BUS_T / 2 - 0.085, z - 0.53 + j * 0.152]) });
  }
  g.add(mesh(mergeAll(patches), M.alumDark, { castShadow: false }));

  // Laser inter-satellite link terminals (3): small gimballed turrets on the zenith side edges
  for (const [x, z, rot] of [[-1.05, -1.75, 0.6], [1.05, -1.75, -0.6], [0, 1.85, Math.PI]]) {
    const t = new THREE.Group();
    t.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 24), M.alumDark, { position: [0, 0.09, 0] }));
    t.add(mesh(new THREE.SphereGeometry(0.16, 24, 16), M.aluminum, { position: [0, 0.3, 0] }));
    t.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 20), M.lens, { position: [0, 0.3, 0.17], rotation: [Math.PI / 2, 0, 0] }));
    t.position.set(x, BUS_T / 2, z);
    t.rotation.y = rot;
    g.add(t);
  }
  // Star trackers (2) and GNSS patch
  for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.32, 16), M.blackMatte, { position: [x, BUS_T / 2 + 0.16, z], rotation: [0.5, 0, x > 0 ? -0.5 : 0.5] }));
  }
  g.add(mesh(new THREE.BoxGeometry(0.25, 0.03, 0.25), M.aluminum, { position: [0, BUS_T / 2 + 0.03, -0.6] }));
  // Argon Hall thruster on the −Z edge (fires along −Z)
  const thr = new THREE.Group();
  thr.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 32), M.darkMetal, { rotation: [Math.PI / 2, 0, 0] }));
  thr.add(mesh(new THREE.TorusGeometry(0.11, 0.035, 12, 40), M.copper, { position: [0, 0, -0.08] }));
  thr.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16), M.alumDark, { position: [0, 0, -0.1], rotation: [Math.PI / 2, 0, 0] }));
  thr.add(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.2), M.alumDark, { position: [0, 0, 0.15] }));
  thr.position.set(0, 0, -BUS_L / 2 - 0.12);
  g.add(thr);
  // Argon tank (spherical, inside the bus but visible through an edge cut-out approximated as a bulge)
  g.add(mesh(new THREE.SphereGeometry(0.28, 24, 16), M.aluminum, { position: [0.75, 0, -1.65] }));

  // ---- Solar wings (2) ----
  const panels = 6; // accordion-folded segments (approx)
  const segL = WING_L / panels;
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.name = s < 0 ? 'wing-left' : 'wing-right';
    // Yoke/boom from bus edge to the first panel
    wing.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.35), M.alumDark, { position: [s * 0.25, 0, 0] }));
    wing.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, WING_W - 0.4, 12), M.aluminum, { position: [s * 0.5, 0, 0], rotation: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < panels; i++) {
      const x = s * (0.55 + segL * (i + 0.5));
      const cells = mesh(new THREE.BoxGeometry(segL - 0.06, 0.028, WING_W - 0.06), M.solarStarlink, { position: [x, 0, 0] });
      wing.add(cells);
      // Backside substrate slightly larger and darker
      wing.add(mesh(new THREE.BoxGeometry(segL - 0.02, 0.02, WING_W - 0.02), M.alumDark, { position: [x, -0.02, 0], castShadow: false }));
      // Hinge lines between segments
      if (i < panels - 1) wing.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, WING_W - 0.1, 8), M.aluminum, { position: [s * (0.55 + segL * (i + 1)), 0, 0], rotation: [Math.PI / 2, 0, 0] }));
    }
    // Edge stiffener beams along the wing
    for (const z of [-(WING_W / 2 - 0.02), WING_W / 2 - 0.02]) wing.add(mesh(new THREE.BoxGeometry(WING_L, 0.05, 0.04), M.aluminum, { position: [s * (0.55 + WING_L / 2), 0, z] }));
    wing.position.x = s * (BUS_W / 2);
    g.add(wing);
  }

  g.userData.height = BUS_T;
  g.userData.footprint = BUS_W + 2 * (0.55 + WING_L);
  g.userData.span = BUS_W + 2 * (0.55 + WING_L);
  g.userData.annotations = [
    { label: 'Bus (≈4.1 m wide)', position: [0, BUS_T + 0.4, 0] },
    { label: 'Phased-array antennas (nadir face)', position: [0, -0.7, 0] },
    { label: 'Inter-satellite laser terminal', position: [-1.05, 0.75, -1.75] },
    { label: 'Argon Hall thruster', position: [0, 0.1, -BUS_L / 2 - 0.9] },
    { label: 'Solar wing · ≈12.8 m × 4.1 m', position: [-(BUS_W / 2 + 0.55 + WING_L / 2), 0.4, 0] },
    { label: 'Star trackers', position: [0.6, 0.65, 0.6] },
  ];
  return g;
}
