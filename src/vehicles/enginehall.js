/**
 * Engine Row — the three engine types the rest of the centre only ever shows installed,
 * standing on the apron at 1:1 so a visitor can walk round them.
 *
 * Published figures used here, all already cited on the vehicle sheets:
 *   Raptor 3        1.3 m diameter · 2.9 m tall · 250 tf          (spacex.com — Starship)
 *   Raptor Vacuum   2.3 m diameter · 4.4 m tall · 275 tf          (spacex.com — Starship)
 *   Merlin 1D       0.92 m nozzle exit · 845 kN at sea level      (Wikipedia — SpaceX Merlin)
 *
 * The Merlin's overall height is not published and is read from SpaceX's factory portrait.
 * The engines themselves are display builds (engineExhibits.js), detailed from photographs;
 * the rockets carry lighter instanced versions of the same engines.
 *
 * Local frame: y = 0 at the apron, engines standing bell-down on welded stands.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';
import { raptorVacGeometry } from './engines.js';
import { buildMerlinExhibit, buildRaptor3Exhibit, buildRvacExhibit } from './engineExhibits.js';

const CRADLE_Y = 0.42;

// The three display engines are built in engineExhibits.js, from SpaceX's factory portraits,
// with every part in its own finish; the rockets keep their cheaper instanced silhouettes.
const STANDS = [
  { id: 'merlin', x: -4.15, build: buildMerlinExhibit, exitR: 0.46 },
  { id: 'raptor', x: -1.75, build: buildRaptor3Exhibit, exitR: 0.65 },
  { id: 'rvac', x: 1.55, build: buildRvacExhibit, exitR: 1.15 },
];

/** Welded stand: a base ring on four feet, uprights, and a top ring the bell rim sits in. */
function stand(M, r) {
  const parts = [];
  const R = r * 1.08;
  // Base ring, square section.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, a2 = ((i + 1) / 28) * Math.PI * 2;
    const mx = (Math.sin(a) + Math.sin(a2)) / 2 * R, mz = (Math.cos(a) + Math.cos(a2)) / 2 * R;
    parts.push({
      geometry: new THREE.BoxGeometry(R * 2 * Math.PI / 28 * 1.08, 0.055, 0.048),
      matrix: mat4([mx, 0.030, mz], [0, (a + a2) / 2, 0]),
    });
  }
  // Top ring the rim beds into.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, a2 = ((i + 1) / 28) * Math.PI * 2;
    const mx = (Math.sin(a) + Math.sin(a2)) / 2 * R, mz = (Math.cos(a) + Math.cos(a2)) / 2 * R;
    parts.push({
      geometry: new THREE.BoxGeometry(R * 2 * Math.PI / 28 * 1.08, 0.048, 0.062),
      matrix: mat4([mx, CRADLE_Y, mz], [0, (a + a2) / 2, 0]),
    });
  }
  // Four uprights and their gussets, plus feet.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    parts.push({ geometry: new THREE.BoxGeometry(0.052, CRADLE_Y - 0.02, 0.052), matrix: mat4([x, CRADLE_Y / 2 + 0.02, z]) });
    parts.push({ geometry: new THREE.CylinderGeometry(0.085, 0.095, 0.026, 14), matrix: mat4([x, 0.013, z]) });
    parts.push({
      geometry: new THREE.BoxGeometry(0.010, 0.16, 0.16),
      matrix: mat4([x * 0.94, CRADLE_Y - 0.10, z * 0.94], [0, a, 0]),
    });
  }
  // Rubber pads under the rim, at the four uprights.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push({
      geometry: new THREE.BoxGeometry(0.11, 0.020, 0.075),
      matrix: mat4([Math.sin(a) * R, CRADLE_Y + 0.034, Math.cos(a) * R], [0, a, 0]),
    });
  }
  return mesh(mergeAll(parts), M.mount, { name: 'engine-stand' });
}

export function buildEngineHall(M) {
  const root = new THREE.Group();
  root.name = 'engine-hall';

  for (const st of STANDS) {
    const g = new THREE.Group();
    g.name = `stand-${st.id}`;
    g.position.x = st.x;
    g.add(stand(M, st.exitR));

    // The builders put the exit plane at y = 0 with the engine running to +Y, which is how a
    // rocket carries it; standing one on a stand is the same frame lifted onto the ring.
    const eng = st.build(M);
    eng.position.y = CRADLE_Y;
    g.add(eng);

    // Low kerb ring on the apron, so each stand reads as its own station.
    const kerb = new THREE.Mesh(new THREE.RingGeometry(st.exitR * 1.34, st.exitR * 1.46, 64), M.mountYellow);
    kerb.rotation.x = -Math.PI / 2;
    kerb.position.y = 0.012;
    kerb.receiveShadow = true;
    kerb.name = `${st.id}-kerb`;
    g.add(kerb);

    root.add(g);
  }

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = !String(o.name).endsWith('-bell-inner');
  });

  // ---- Level of detail --------------------------------------------------------------------
  // Engine Row was the one exhibit the manager had no entries for at all. Three engines on
  // plinths, 4.4 m at the tallest: from the museum row they are three bells, and the propellant
  // runs, their clamps and the stiffening hoops are centimetres of hardware that cannot resolve
  // at that range — the clamps are 6 mm.
  //
  // The bells, their inner surfaces, the powerheads and the stands stay at every distance:
  // those are what the exhibit is for, and the silhouette of a Merlin against a Raptor is the
  // whole reason the row exists.
  // The fine hardware on each engine — bolts, lines, harnesses, valves — goes by the size of
  // its smallest part; the bells, the chamber stacks and the pump bodies always draw.
  const FINE = { braided: 0.028, harness: 0.022, engineGold: 0.06, engineBlue: 0.06, mountBlue: 0.03 };
  root.traverse((o) => {
    const k = String(o.name).split('-').pop();
    if (o.isMesh && FINE[k]) o.userData.lodFeature = FINE[k];
  });

  root.userData.height = raptorVacGeometry().height + CRADLE_Y;
  root.userData.annotations = [
    { label: 'Merlin 1D · 0.92 m nozzle · 845 kN at sea level', position: [-4.15, 2.85, 0.7] },
    { label: 'Raptor 3 · 1.3 m × 2.9 m · 250 tf', position: [-1.75, 3.45, 0.9] },
    { label: 'Raptor Vacuum · 2.3 m × 4.4 m · 275 tf', position: [1.55, 5.15, 1.4] },
    { label: 'Turbopump · single shaft, turbine exhaust below', position: [-3.7, 1.9, 0.35] },
    { label: 'Gas generator', position: [-4.5, 2.1, 0.3] },
    { label: 'Injector manifold', position: [-1.3, 2.45, 0.5] },
    { label: 'Turbopump block and thrust puck', position: [-1.75, 3.2, 0.4] },
    { label: 'Regeneratively cooled bell', position: [2.25, 3.2, 0.9] },
    { label: 'Radiatively cooled tube-wall extension', position: [2.3, 1.75, 1.35] },
  ];
  return root;
}
