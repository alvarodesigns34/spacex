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
 * Local frame: y = 0 at the apron, engines standing bell-down on welded stands.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, lathe } from '../geometry/utils.js';
import { raptorGeometry, raptorVacGeometry, merlinGeometry } from './engines.js';

const CRADLE_Y = 0.42;

/**
 * A lathe whose radius is modulated with the angle, which is how a regeneratively cooled bell
 * is actually built: a few hundred milled channels brazed side by side, so the skin is fluted
 * rather than smooth. Costs nothing over a plain lathe and is the single detail that most
 * says "rocket engine" when the camera is a metre away.
 */
function flutedLathe(profile, { segments = 160, flutes = 84, amp = 0.004 } = {}) {
  const n = profile.length;
  const pos = new Float32Array((segments + 1) * n * 3);
  const uv = new Float32Array((segments + 1) * n * 2);
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * Math.PI * 2;
    // Fade the fluting out at the throat, where the channels run into the chamber jacket.
    const c = Math.cos(th), s2 = Math.sin(th);
    for (let j = 0; j < n; j++) {
      const p = profile[j];
      const fade = 1 - Math.min(1, j / (n - 1) / 0.82);
      const r = p.r + amp * fade * Math.cos(flutes * th);
      const k = (i * n + j) * 3;
      pos[k] = c * r; pos[k + 1] = p.y; pos[k + 2] = s2 * r;
      uv[(i * n + j) * 2] = i / segments;
      uv[(i * n + j) * 2 + 1] = j / (n - 1);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = (i + 1) * n + j, c2 = (i + 1) * n + j + 1, d = i * n + j + 1;
      idx.push(a, d, b, b, d, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const STANDS = [
  { id: 'merlin', x: -4.15, geo: () => merlinGeometry(), exitR: 0.46, flutes: 60, hoops: [] },
  { id: 'raptor', x: -1.75, geo: () => raptorGeometry(), exitR: 0.65, flutes: 96, hoops: [] },
  // The vacuum bell's extension is radiatively cooled sheet, not a channel wall: it is smooth,
  // and carries stiffening hoops instead.
  { id: 'rvac', x: 1.55, geo: () => raptorVacGeometry(), exitR: 1.15, flutes: 0, hoops: [0.16, 0.55, 1.05, 1.62, 2.25] },
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

    const geo = st.geo();
    // The builders put the exit plane at y = 0 with the engine running to +Y, which is how a
    // rocket carries it; standing one on a stand is the same frame lifted onto the ring.
    const eng = new THREE.Group();
    eng.position.y = CRADLE_Y;

    const bellMat = st.id === 'merlin' ? M.bellCool : M.bell;
    if (st.flutes && geo.profile) {
      eng.add(mesh(flutedLathe(geo.profile, { flutes: st.flutes, amp: st.exitR * 0.008 }), bellMat,
        { name: `${st.id}-bell` }));
    } else {
      eng.add(mesh(geo.outer, bellMat, { name: `${st.id}-bell` }));
    }
    eng.add(mesh(geo.inner, M.bellInner, { name: `${st.id}-bell-inner` }));
    eng.add(mesh(geo.head, M.darkMetal, { name: `${st.id}-head` }));

    // Stiffening hoops on a radiatively cooled extension.
    if (st.hoops.length && geo.profile) {
      const hoops = [];
      for (const y of st.hoops) {
        const p = geo.profile.find(q => q.y >= y) ?? geo.profile[geo.profile.length - 1];
        hoops.push({ geometry: new THREE.TorusGeometry(p.r * 1.004, 0.018, 8, 90), matrix: mat4([0, y, 0], [Math.PI / 2, 0, 0]) });
      }
      eng.add(mesh(mergeAll(hoops), M.darkMetal, { name: `${st.id}-hoops` }));
    }

    // Propellant plumbing down the side of the chamber: two runs and their clamps. Every engine
    // here has them; without any the powerhead reads as a plain grey drum.
    {
      const lines = [];
      const top = geo.height - 0.42, bot = geo.height * 0.68;
      for (const [ang, rad] of [[0.6, 0.022], [2.4, 0.017], [4.1, 0.014]]) {
        const rr = st.exitR * 0.44;
        lines.push({
          geometry: new THREE.CylinderGeometry(rad, rad, top - bot, 10),
          matrix: mat4([Math.sin(ang) * rr, (top + bot) / 2, Math.cos(ang) * rr]),
        });
        for (const yy of [bot + 0.08, (top + bot) / 2, top - 0.08]) {
          lines.push({
            geometry: new THREE.TorusGeometry(rad * 1.7, 0.006, 6, 12),
            matrix: mat4([Math.sin(ang) * rr, yy, Math.cos(ang) * rr], [Math.PI / 2, 0, 0]),
          });
        }
      }
      eng.add(mesh(mergeAll(lines), M.conduit ?? M.darkMetal, { name: `${st.id}-plumbing` }));
    }

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

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  root.userData.height = raptorVacGeometry().height + CRADLE_Y;
  root.userData.annotations = [
    { label: 'Merlin 1D · 0.92 m nozzle · 845 kN at sea level', position: [-4.15, 2.85, 0.7] },
    { label: 'Raptor 3 · 1.3 m × 2.9 m · 250 tf', position: [-1.75, 3.45, 0.9] },
    { label: 'Raptor Vacuum · 2.3 m × 4.4 m · 275 tf', position: [1.55, 5.15, 1.4] },
    { label: 'Milled cooling channels, brazed into the bell wall', position: [-1.45, 0.95, 0.78] },
    { label: 'Radiatively cooled extension with stiffening hoops', position: [2.25, 1.75, 1.35] },
  ];
  return root;
}
