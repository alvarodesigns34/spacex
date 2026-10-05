/** The seat, the tail and the side cover. */
import * as THREE from 'three';
import { part, skin, sidePatch } from './surfaces.js';
import { topV, lerpTable } from '../photo.js';

export function buildSeatTail(M) {
  const g = new THREE.Group(); g.name = 'h2r-seat-tail';
  // The seat: from the tank's back to the hump, ≈250 mm wide, its base on the subframe.
  const seat = [
    [745, 0.10, 0.12, 380], [770, 0.12, 0.13, 384], [800, 0.125, 0.13, 384], [830, 0.12, 0.125, 382], [860, 0.11, 0.12, 380], [888, 0.10, 0.11, 378],
  ].map(([u, z1, z2, vb]) => { const vt = topV(u); return [u, [[vt, 0], [vt + 2, z1 * 0.6], [vt + 6, z1], [vt + 14, z2], [vb, z2 * 0.95]]]; });
  g.add(...part(seat, [[0, 4, M.h2rSeat, 'h2r-seat']]));
  // The tail: the pillion cowl's hump and the long tapering tail to the tip, black underneath, a
  // mirror-coat side panel (stations: u, top v, lower edge v, half-width at the top shoulder and at
  // the lower edge).
  const LOW = [[888, 420], [910, 412], [927, 400], [953, 387], [980, 368], [1007, 347], [1030, 322], [1050, 300], [1070, 285], [1090, 273], [1105, 258], [1112, 250]];
  const tail = [
    [890, 0.10, 0.115], [905, 0.105, 0.12], [925, 0.105, 0.12], [950, 0.10, 0.115], [975, 0.092, 0.105], [1000, 0.082, 0.095], [1025, 0.07, 0.08], [1050, 0.058, 0.066], [1075, 0.045, 0.05], [1095, 0.03, 0.034], [1108, 0.012, 0.014],
  ].map(([u, z1, z2]) => { const vt = Math.min(topV(u), u > 890 && u < 960 ? topV(u) : topV(u)), vb = lerpTable(LOW, u), h = vb - vt; return [u, [[vt, 0], [vt + 0.04 * h, z1 * 0.7], [vt + 0.12 * h, z1], [vt + 0.5 * h, z2], [vb - 0.08 * h, z2 * 0.9], [vb, z2 * 0.4]]]; });
  // Sharp-edged sections: the tail is pressed in flat facets (the right-side photograph).
  const tparts = part(tail, [[0, 5, M.h2rBlack, 'h2r-tail']], { creaseDeg: 14 });
  g.add(...tparts);
  // The mirror-coat wedge on the tail's side, the black inlay above it, the red lamp at the tip.
  g.add(skin([[905, 360], [960, 300], [1000, 290], [1060, 272], [1100, 258], [1050, 300], [1000, 340], [945, 385], [895, 418], [870, 430]], tparts[0], { mat: M.h2rChrome, name: 'h2r-tail-panel' }));
  g.add(skin([[1046, 276], [1100, 258], [1108, 252], [1062, 292], [1048, 300]], tparts[0], { mat: M.h2rTail, name: 'h2r-tail-lamp', proud: 0.003 }));
  // The black side cover under the seat's front, between the tank and the tail.
  g.add(sidePatch([[745, 382], [800, 380], [860, 372], [895, 365], [905, 362], [880, 410], [810, 420], [748, 425]].map(([u, v]) => [u, v, 0.11 + (v < 400 ? 0.015 : 0) - (u - 745) * 0.00005]), { mat: M.h2rBlack, name: 'h2r-side-cover' }));
  return g;
}
