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
}
