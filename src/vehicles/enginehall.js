/**
 * Engine Row — the three engine types the rest of the centre only ever shows installed,
 * standing on the apron at 1:1 so a visitor can walk round them.
 *
 * Published figures used here, all already cited on the vehicle sheets:
 *   Raptor 3        1.3 m diameter · 2.9 m tall · 250 tf          (spacex.com — Starship)
 *   Raptor Vacuum   2.3 m diameter · 4.4 m tall · 275 tf          (spacex.com — Starship)
 *   Merlin 1D       0.92 m nozzle exit · 845 kN at sea level      (Wikipedia — SpaceX Merlin)
 *
 * The Merlin's overall height is not published and is reconstructed from imagery, as it
 * already is where the Falcon uses the same geometry. Nothing else here is new data: the
 * engines are the same builders the rockets use, at the same scale.
 *
 * Local frame: y = 0 at the apron, engines standing bell-down on open cradles.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';
import { raptorGeometry, raptorVacGeometry, merlinGeometry } from './engines.js';

const CRADLE_Y = 0.34;

const STANDS = [
  { id: 'merlin', x: -4.15, geo: () => merlinGeometry(), exitR: 0.46, label: 'Merlin 1D' },
  { id: 'raptor', x: -1.75, geo: () => raptorGeometry(), exitR: 0.65, label: 'Raptor 3' },
  { id: 'rvac', x: 1.55, geo: () => raptorVacGeometry(), exitR: 1.15, label: 'Raptor Vacuum' },
];

/** Open cradle: a ring the bell rim sits in, on three splayed legs. */
function cradle(M, r) {
  const parts = [
    { geometry: new THREE.TorusGeometry(r * 1.06, 0.030, 10, 44), matrix: mat4([0, CRADLE_Y, 0], [Math.PI / 2, 0, 0]) },
    { geometry: new THREE.TorusGeometry(r * 1.06, 0.022, 8, 44), matrix: mat4([0, 0.06, 0], [Math.PI / 2, 0, 0]) },
  ];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    parts.push({
      geometry: new THREE.CylinderGeometry(0.026, 0.030, CRADLE_Y - 0.04, 12),
      matrix: mat4([Math.sin(a) * r * 1.06, (CRADLE_Y + 0.06) / 2, Math.cos(a) * r * 1.06]),
    });
  }
  return mesh(mergeAll(parts), M.mount, { name: 'engine-cradle' });
}

export function buildEngineHall(M) {
  const root = new THREE.Group();
  root.name = 'engine-hall';

  for (const st of STANDS) {
    const g = new THREE.Group();
    g.name = `stand-${st.id}`;
    g.position.x = st.x;
    g.add(cradle(M, st.exitR));

    const geo = st.geo();
    // The builders put the exit plane at y = 0 with the engine running to +Y, which is how a
    // rocket carries it; standing one on a cradle is the same frame lifted onto the ring.
    const eng = new THREE.Group();
    eng.position.y = CRADLE_Y;
    eng.add(mesh(geo.outer, st.id === 'merlin' ? M.bellCool : M.bell, { name: `${st.id}-bell` }));
    eng.add(mesh(geo.inner, M.bellInner, { name: `${st.id}-bell-inner` }));
    eng.add(mesh(geo.head, M.darkMetal, { name: `${st.id}-head` }));
    g.add(eng);

    // Low kerb ring on the apron, so each stand reads as its own station.
    const kerb = new THREE.Mesh(new THREE.RingGeometry(st.exitR * 1.30, st.exitR * 1.42, 64), M.mountYellow);
    kerb.rotation.x = -Math.PI / 2;
    kerb.position.y = 0.012;
    kerb.receiveShadow = true;
    kerb.name = `${st.id}-kerb`;
    g.add(kerb);

    root.add(g);
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  root.userData.height = raptorVacGeometry().height + CRADLE_Y;
  root.userData.annotations = [
    { label: 'Merlin 1D · 0.92 m nozzle · 845 kN at sea level', position: [-4.15, 2.75, 0.7] },
    { label: 'Raptor 3 · 1.3 m × 2.9 m · 250 tf', position: [-1.75, 3.35, 0.9] },
    { label: 'Raptor Vacuum · 2.3 m × 4.4 m · 275 tf', position: [1.55, 5.05, 1.4] },
    { label: 'Regeneratively cooled bell', position: [-1.55, 0.85, 0.75] },
    { label: 'Radiatively cooled nozzle extension', position: [2.15, 1.55, 1.35] },
  ];
  return root;
}
