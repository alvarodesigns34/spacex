/** The tank. */
import * as THREE from 'three';
import { part } from './surfaces.js';
import { topV } from '../photo.js';

export function buildTank(M) {
  // Stations: u, the mirror-coat top's lower edge (v), the black side's lower edge on the frame rail
  // (v), the half-widths at the top's edge and at the side's foot (m).
  const S = [
    [462, 300, 345, 0.08, 0.10],
    [485, 297, 356, 0.11, 0.115],
    [515, 300, 368, 0.135, 0.125],
    [550, 302, 378, 0.15, 0.13],
    [590, 303, 388, 0.158, 0.13],
    [630, 304, 397, 0.158, 0.13],
    [670, 305, 405, 0.15, 0.125],
    [705, 310, 412, 0.138, 0.12],
    [730, 322, 418, 0.125, 0.115],
    [748, 340, 420, 0.115, 0.11],
  ];
  const rows = S.map(([u, vc, vb, zc, zb]) => {
    const vt = topV(u), h = Math.max(4, vc - vt);
    return [u, [[vt, 0], [vt + 0.08 * h, 0.4 * zc], [vt + 0.3 * h, 0.8 * zc], [vt + 0.7 * h, 0.97 * zc], [vc, zc], [vc + 0.3 * (vb - vc), zc * 0.98], [vb, zb]]];
  });
  const g = new THREE.Group(); g.name = 'h2r-tank';
  g.add(...part(rows, [[0, 4, M.h2rChrome, 'h2r-tank-top'], [4, 6, M.h2rBlack, 'h2r-tank-side']], { creaseDeg: 24 }));
  return g;
}
