/** The rest: the dash, the steering damper, the radiator and its shrouds, the rearsets, the shock's reservoir, the rear hugger's panel. */
import * as THREE from 'three';
import { segMatrix, slab, mergeAll, mesh } from './geometry.js';
import { PXY } from './photo.js';
import { radiatorTexture } from './materials.js';
import { buildDash } from './dash.js';

/**
 * The rest (the photographs): the instrument panel behind the screen, the radiator and the lower
 * side slats, the rearsets, the Öhlins shock's gold reservoir, the rear hugger and chain guard.
 */
export function buildDetails(M) {
  M.h2rLcd ??= new THREE.MeshStandardMaterial({ name: 'h2r-lcd', color: 0x0a0d10, metalness: 0.2, roughness: 0.15, emissive: 0x0b1820, emissiveIntensity: 0.6 });
  M.h2rRadiator ??= new THREE.MeshStandardMaterial({ name: 'h2r-radiator', color: 0x141516, metalness: 0.4, roughness: 0.7, map: radiatorTexture() });
  const g = new THREE.Group(); g.name = 'h2r-details';
  const P = (u, v, z = 0) => new THREE.Vector3(...PXY(u, v), z);
  // The instrument panel behind the screen (the H2's: an analogue tachometer and an LCD), facing
  // the rider; its face is drawn live by the ride (userData.draw).
  g.add(buildDash(M));
  // The Öhlins steering damper across the front of the top clamp (the detail photograph).
  { const A = P(405, 268, -0.12), B = P(405, 268, 0.12);
    g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 20).applyMatrix4(segMatrix(A, B, 0.016)), M.h2rSatin, { name: 'h2r-steering-damper' }));
    const ring = new THREE.TorusGeometry(0.016, 0.003, 8, 24); ring.rotateY(Math.PI / 2); ring.translate(A.x, A.y, -0.06); g.add(mesh(ring, M.h2rGold, { name: 'h2r-damper-ring' })); }
  // The radiator, behind the side panels, ahead of the engine.
  { const r = new THREE.BoxGeometry(0.05, 0.3, 0.42); const m = mesh(r, M.h2rRadiator, { name: 'h2r-radiator' }); m.position.copy(P(440, 500)); m.rotation.z = 0.2; g.add(m); }
  // The radiator's side shrouds, mirror-coated and bolted, between the engine's front and the lower
  // cowl (the right-side photograph through its calibrated camera: from (0.112, 0.611) m at the top
  // rear to the lower cowl at x 0.388 m, down to ≈0.48 m, 0.215–0.24 m out), with a ridge along the
  // top. (They replace three carbon blades that are not on the bike.)
  {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const out = [V(0.112, 0.611, 0.215), V(0.388, 0.618, 0.24), V(0.388, 0.495, 0.24), V(0.22, 0.476, 0.215)];
    const ridge = [V(0.127, 0.592, 0.228), V(0.373, 0.600, 0.25)];
    const pos = [], tri = (a, b, c) => pos.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    tri(out[0], ridge[0], ridge[1]); tri(out[0], ridge[1], out[1]);
    tri(ridge[0], out[3], out[2]); tri(ridge[0], out[2], ridge[1]);
    let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const L = geo.clone(); L.scale(1, 1, -1); const ix = L.attributes.position;
    for (let i = 0; i < ix.count; i += 3) { const t = [ix.getX(i + 1), ix.getY(i + 1), ix.getZ(i + 1)]; ix.setXYZ(i + 1, ix.getX(i + 2), ix.getY(i + 2), ix.getZ(i + 2)); ix.setXYZ(i + 2, ...t); }
    L.computeVertexNormals();
    M.h2rChrome2 ??= Object.assign(M.h2rChrome.clone(), { side: THREE.DoubleSide, name: 'h2r-mirror-coat-2s' });
    g.add(mesh(mergeAll([{ geometry: geo }, { geometry: L }]), M.h2rChrome2, { name: 'h2r-radiator-shroud' }));
    for (const s of [-1, 1]) { const b = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12); b.rotateX(Math.PI / 2); b.translate(0.252, 0.535, s * 0.229); g.add(mesh(b, M.h2rAlu, { name: 'h2r-shroud-bolt' })); }
  }
  // Rearsets: aluminium heel plates and pegs (the side photograph), the right one with the brake pedal.
  for (const s of [-1, 1]) {
    const plate = slab([PXY(742, 598), PXY(762, 560), PXY(826, 574), PXY(834, 610), PXY(800, 628), PXY(748, 626)], 0.008, 0.002);
    const m = mesh(plate, M.h2rAlu, { name: 'h2r-heel-plate' }); m.position.z = s * 0.205 - 0.004; g.add(m);
    const peg = new THREE.CylinderGeometry(0.011, 0.011, 0.075, 12); peg.rotateX(Math.PI / 2); peg.translate(...PXY(800, 604), s * 0.215);
    g.add(mesh(peg, M.h2rAlu, { name: 'h2r-footpeg' }));
    const knurl = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12); knurl.rotateX(Math.PI / 2); knurl.translate(...PXY(800, 604), s * 0.225);
    g.add(mesh(knurl, M.h2rGold, { name: 'h2r-peg-knurl' }));
  }
  // The Öhlins shock's gold reservoir and its black preload knob, under the seat inside the side
  // cover (it does not show in the right-side photograph).
  { const c = new THREE.CylinderGeometry(0.02, 0.02, 0.09, 20); c.rotateZ(Math.PI / 2); c.translate(...PXY(860, 438), 0.0); g.add(mesh(c, M.h2rGold, { name: 'h2r-shock-reservoir' }));
    const k = new THREE.CylinderGeometry(0.022, 0.022, 0.035, 20); k.rotateZ(Math.PI / 2); k.translate(...PXY(820, 438), 0.0); g.add(mesh(k, M.h2rSatin, { name: 'h2r-shock-knob' })); }
  // On the right, under the tail: the dark panel of the rear hugger and the subframe's side, between
  // the tail and the tyre (the right-side photograph through its camera: x −0.52 to −0.22 m, 0.46 to
  // 0.64 m up, a blade slanting down to the heel plate, ≈0.10 m out). The left side is the swingarm's
  // and the chain's.
  { const pl = slab([[-0.523, 0.643], [-0.374, 0.639], [-0.218, 0.483], [-0.366, 0.458]], 0.004, 0.001); pl.translate(0, 0, 0.098);
    M.h2rSatin2 ??= Object.assign(M.h2rSatin.clone(), { side: THREE.DoubleSide, name: 'h2r-satin-black-2s' });
    g.add(mesh(pl, M.h2rSatin2, { name: 'h2r-rear-hugger-panel' })); }
  return g;
}
