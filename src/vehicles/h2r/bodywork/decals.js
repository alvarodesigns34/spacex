/** Kawasaki's markings, laid on the panels. */
import * as THREE from 'three';
import { mirrorZ } from '../geometry.js';
import { skin } from './surfaces.js';

/**
 * A decal laid on a panel: its parallelogram in the side photograph's pixels (top-front corner,
 * top-rear, bottom-front — as the text reads on the left side, front to back), projected across
 * onto the base and mirrored so it reads the right way on both sides.
 */
export function decal(corners, base, mat, name, side = 'L') {
  // corners: [top of the text's start, top of its end, bottom of its start] in the side photograph's
  // pixels; the text runs from front to back on the left side and from back to front on the right.
  const [p0, p1, p2] = corners;
  const ax = [p1[0] - p0[0], p1[1] - p0[1]], bx = [p2[0] - p0[0], p2[1] - p0[1]];
  const det = ax[0] * bx[1] - ax[1] * bx[0];
  const uvOf = (u, v) => { const du = u - p0[0], dv = v - p0[1]; return [(du * bx[1] - dv * bx[0]) / det, (ax[0] * dv - ax[1] * du) / det]; };
  const outline = [p0, p1, [p1[0] + bx[0], p1[1] + bx[1]], p2];
  const m = skin(outline, base, { mat, name, levels: 4, proud: 0.002, mirror: false });
  let g = m.geometry;
  if (side === 'L') g = mirrorZ(g);
  const P = g.attributes.position, uv = new Float32Array(P.count * 2);
  const Ainv = (x, y) => [640.576 + (-559.17 * x + 0.887 * y), 809.183 + (-0.732 * x - 558.817 * y)];
  for (let i = 0; i < P.count; i++) { const [u, v] = Ainv(P.getX(i), P.getY(i)); const [s2, t] = uvOf(u, v); uv[i * 2] = s2; uv[i * 2 + 1] = 1 - t; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.geometry = g;
  m.castShadow = false;
  return m;
}

/** Text drawn on a transparent canvas for a decal (Kawasaki's own markings, drawn as type). */
export function decalMaterial(name, w, h, draw) {
  if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ name, visible: false });
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ name, map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, metalness: 0.5, roughness: 0.3 });
}

export function buildDecals(panel, tank, tail) {
  const g = new THREE.Group(); g.name = 'h2r-decals';
  const ninja = decalMaterial('h2r-decal-ninja', 512, 256, (x, w, h) => {
    x.fillStyle = '#eef1f3'; x.font = 'italic 190px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
    x.textBaseline = 'middle'; x.fillText('Ninja', 10, h * 0.55);
  });
  g.add(decal([[262, 362], [318, 360], [264, 396]], panel, ninja, 'h2r-decal-ninja'), decal([[338, 360], [282, 362], [336, 396]], panel, ninja, 'h2r-decal-ninja', 'R'));
  const badge = decalMaterial('h2r-decal-h2r', 256, 96, (x, w, h) => {
    x.fillStyle = '#e9ecee'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#16181a'; x.fillRect(6, 6, w - 12, h - 12);
    x.font = 'bold 72px Arial, Helvetica, sans-serif'; x.textBaseline = 'middle';
    x.fillStyle = '#e9ecee'; x.fillText('H2', 30, h / 2 + 3);
    x.fillStyle = '#d0141c'; x.fillText('R', 150, h / 2 + 3);
  });
  g.add(decal([[306, 377], [337, 375], [307, 392]], panel, badge, 'h2r-decal-h2r'), decal([[276, 377], [245, 379], [275, 392]], panel, badge, 'h2r-decal-h2r', 'R'));
  const kaw = decalMaterial('h2r-decal-kawasaki', 1024, 160, (x, w, h) => {
    x.font = 'italic 900 132px Arial Black, Arial, Helvetica, sans-serif'; x.textBaseline = 'middle';
    x.fillStyle = '#1e2124'; x.fillText('Kawasaki', 14, h / 2 + 4);
    x.fillStyle = '#5c6167'; x.fillText('Kawasaki', 8, h / 2);
  });
  g.add(decal([[535, 280], [611, 268], [536, 296]], tank, kaw, 'h2r-decal-kawasaki'), decal([[611, 268], [535, 280], [612, 284]], tank, kaw, 'h2r-decal-kawasaki', 'R'));
  // "Ninja" on the tail's upper mirror-coat panel (the right-side photograph through its camera:
  // ≈0.2 m long, from x −0.48 to −0.68 m), mirrored for each side.
  if (tail) g.add(decal([[908, 301], [1019, 266], [919, 324]], tail, ninja, 'h2r-decal-ninja-tail'), decal([[1019, 266], [908, 301], [1030, 289]], tail, ninja, 'h2r-decal-ninja-tail', 'R'));
  return g;
}
