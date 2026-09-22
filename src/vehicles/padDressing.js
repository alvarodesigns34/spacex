/**
 * Extra Pad 2 furniture that is reconstructed, not cited: a cable tray, valves on
 * the deluge side of the deck, and one low service shed. Nothing here moves the
 * mount, the clamps or the trench. `padY` is the deck elevation the pad already built.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, boxUV } from '../geometry/utils.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export function dressPad(parent, M, padY) {
  const steel = [];
  const valves = [];

  // Cable tray along the east deck, clear of the 26 m mount. A channel, not a grate.
  steel.push({ geometry: box(22, 0.08, 0.32), matrix: mat4([46, padY + 1.55, 18]) });
  steel.push({ geometry: box(22, 0.1, 0.04), matrix: mat4([46, padY + 1.62, 18.15]) });
  steel.push({ geometry: box(22, 0.1, 0.04), matrix: mat4([46, padY + 1.62, 17.85]) });
  for (let x = 36; x <= 56; x += 5) {
    steel.push({ geometry: box(0.08, 1.45, 0.08), matrix: mat4([x, padY + 0.72, 18]) });
  }
  // Stair from grade up the east berm face. Treads and a handrail, reconstructed.
  for (let i = 0; i < 12; i++) {
    const y = 0.4 + i * 0.72;
    steel.push({ geometry: box(1.1, 0.08, 0.32), matrix: mat4([68, y, 8 + i * 0.28]) });
    steel.push({ geometry: box(0.05, 0.9, 0.05), matrix: mat4([68.5, y + 0.45, 8 + i * 0.28]) });
    steel.push({ geometry: box(0.04, 0.04, 0.36), matrix: mat4([68.5, y + 0.92, 8 + i * 0.28]) });
  }
  // Bollards and a drain slot along the east deck edge. Same steel mesh.
  for (let i = 0; i < 7; i++) {
    steel.push({ geometry: new THREE.CylinderGeometry(0.07, 0.08, 0.72, 8), matrix: mat4([24 + i * 5.2, padY + 0.36, 38]) });
  }
  steel.push({ geometry: box(9.5, 0.06, 0.18), matrix: mat4([42, padY + 0.04, -30]) });

  // Header the two valve sets tie into. Reconstructed routing, not a surveyed line.
  valves.push({
    geometry: new THREE.CylinderGeometry(0.1, 0.1, 44, 12),
    matrix: mat4([34, padY + 1.15, 0], [Math.PI / 2, 0, 0]),
  });
  for (const z of [-22, 22]) {
    valves.push({
      geometry: new THREE.CylinderGeometry(0.16, 0.16, 0.26, 14),
      matrix: mat4([34, padY + 1.15, z], [0, 0, Math.PI / 2]),
    });
    valves.push({
      geometry: new THREE.TorusGeometry(0.14, 0.025, 8, 14),
      matrix: mat4([34.15, padY + 1.48, z], [Math.PI / 2, 0, 0]),
    });
  }

  parent.add(mesh(boxUV(mergeAll(steel)), M.mount, { name: 'pad-cable-tray', castShadow: true }));
  parent.add(mesh(boxUV(mergeAll(valves)), M.pipeBlue, { name: 'pad-valves', castShadow: true }));

  // Shed on the deck, outside the mount square and inside the pad slab (±64 m, ±46 m).
  const shed = [];
  shed.push({ geometry: box(7.5, 3.1, 4.6), matrix: mat4([56, padY + 1.55, 34]) });
  shed.push({ geometry: box(8, 0.18, 5.1), matrix: mat4([56, padY + 3.2, 34]) });
  parent.add(mesh(boxUV(mergeAll(shed)), M.concrete, { name: 'pad-service-shed', castShadow: true }));
  addBayLights(parent, M);
}

/**
 * Closeout lamps under the deck, aimed into the engine bay, plus one cool point
 * standing in for bounce off the pale water-cooled steel. Reconstructed service
 * lighting: it is not sunlight, and it is not bright enough to light the pad.
 * The lamps stay on the mount when the vehicle leaves.
 */
function addBayLights(parent, M) {
  const g = new THREE.Group();
  g.name = 'bay-inspection-lights';
  g.userData.provenance = 'reconstructed-service-lighting';
  const heads = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 5.4, z = Math.sin(a) * 5.4;
    const spot = new THREE.SpotLight(0xfff1d4, 48, 22, 0.7, 0.35, 1.2);
    spot.position.set(x, 16.4, z);
    spot.target.position.set(Math.cos(a) * 1.4, 20.2, Math.sin(a) * 1.4);
    spot.castShadow = false;
    spot.name = 'bay-closeout-lamp';
    g.add(spot, spot.target);
    heads.push({ geometry: box(0.28, 0.12, 0.18), matrix: mat4([x, 16.35, z]) });
  }
  const bounce = new THREE.PointLight(0xd5dde8, 14, 20, 2);
  bounce.position.set(0, 15.4, 0);
  bounce.castShadow = false;
  bounce.name = 'deck-bounce';
  g.add(bounce);
  g.add(mesh(boxUV(mergeAll(heads)), M.mount, { name: 'bay-lamp-heads', castShadow: false }));
  parent.add(g);
}
