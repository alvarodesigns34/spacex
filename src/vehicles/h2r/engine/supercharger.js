/**
 * The supercharger, behind the cylinders on the left above the gearbox, as Kawasaki shows it
 * (Kawasaki Technical Review No. 180, 2019, Figs. 3 and 10: the engine cut away, the impeller in
 * its housing) and the photographs of the bike without its bodywork (Wikimedia Commons; reference
 * only):
 *  - the impeller: a centrifugal wheel machined from billet aluminium, its blades ≈1 mm thick
 *    curving "continuously in a spiral" (Kawasaki), six full blades from the eye and six
 *    splitters between them from part-way down; 69 mm across its tips (published by the press,
 *    not by Kawasaki: ≈), spinning at 9.2 × the crankshaft;
 *  - the housing, red anodised: the shroud round the blades, the scroll (volute) spiralling out
 *    round it to the outlet, the inlet's short tube and bell facing left to the ram-air duct, the
 *    ring of bolts on its cover; behind it the drive's housing on the case;
 *  - the outlet rising from the scroll's back into the orange silicone coupler, held by two clamps
 *    on the intake chamber's spigot (the "exposed top right" photograph).
 * The impeller turns with the engine through userData.spin (radians per crank radian: 9.2).
 * Sizes not published ≈.
 */
import * as THREE from 'three';
import { mergeAll, mesh, TAU } from '../geometry.js';
import { turned, boltRing, hoseClamp } from './parts.js';

/** The supercharger's axis: across the bike, at the ram-air duct's end (intake.js). */
export const SC = { x: -0.058, y: 0.605, back: -0.07 };
const R_TIP = 0.0345, R_EYE = 0.0235, R_HUB0 = 0.0085, DEPTH = 0.03;

/** The impeller's hub (h) and shroud (s) lines in the meridional plane: [r, z] for m ∈ [0, 1] (z out of the back plate, towards the inlet). */
const hubLine = (m) => [R_HUB0 + (R_TIP - R_HUB0) * m ** 2.2, DEPTH * 0.9 * (1 - m) ** 1.5];
const tipLine = (m) => [R_EYE + (R_TIP - R_EYE) * m ** 2.6, 0.0045 + (DEPTH - 0.0045) * (1 - m ** 1.35)];

/** One blade's surface (both faces: its material is two-sided), from meridional m0 to the outlet, starting at angle a. */
function blade(a, m0) {
  const NM = 22, NS = 6, pos = [], idx = [];
  // (The wrap: the leading edge raked forward at the eye, the blade swept back towards the tip.)
  const wrap = (m, s) => 1.05 * (1 - m) ** 1.7 * (0.55 + 0.45 * s) - 0.32 * m ** 1.4;
  for (let i = 0; i <= NM; i++) {
    const m = m0 + (1 - m0) * i / NM, [rh, zh] = hubLine(m), [rs, zs] = tipLine(m);
    for (let j = 0; j <= NS; j++) {
      const s = j / NS, r = rh + (rs - rh) * s, z = zh + (zs - zh) * s, th = a + wrap(m, s);
      pos.push(Math.cos(th) * r, Math.sin(th) * r, z);
    }
  }
  for (let i = 0; i < NM; i++) for (let j = 0; j < NS; j++) { const p = i * (NS + 1) + j, q = p + NS + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** The impeller in its own frame (axis z, the back plate at z = 0, the eye towards +z). */
function impeller() {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    parts.push({ geometry: blade(k / 6 * TAU, 0) });
    parts.push({ geometry: blade((k + 0.5) / 6 * TAU + 0.12, 0.38) });
  }
  // The hub: turned along the hub line, its nose and the nut on it; the back plate.
  const prof = [[R_TIP + 0.0004, -0.003], [R_TIP + 0.0004, 0]];
  for (let i = 20; i >= 0; i--) { const [r, z] = hubLine(i / 20); prof.push([r, z]); }
  prof.push([0.0062, DEPTH * 0.9 + 0.002], [0.0058, DEPTH * 0.9 + 0.008], [0.0035, DEPTH * 0.9 + 0.011], [0, DEPTH * 0.9 + 0.012]);
  const hub = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 64); hub.rotateX(Math.PI / 2);
  const nut = new THREE.CylinderGeometry(0.0062, 0.0062, 0.005, 6); nut.rotateX(Math.PI / 2); nut.translate(0, 0, DEPTH * 0.9 + 0.0045);
  return { blades: mergeAll(parts), hub: mergeAll([{ geometry: hub }, { geometry: nut }]) };
}

/** The scroll's centreline and section: from its tongue round (clockwise seen from the right) to the outlet at the back, growing. */
function volute(cx, cy, z) {
  const pts = [], radii = [], N = 64;
  // (Clockwise seen from the right, so that at the back (angle π) it runs upward into the outlet.)
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = Math.PI + TAU * 0.92 * (1 - t);
    const rr = 0.0105 + 0.0125 * t, rc = R_TIP + 0.006 + rr * 0.9;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, z)); radii.push(rr);
  }
  return { pts, radii };
}

/** A tube along points with its radius varying (one radius per point). */
function varTube(pts, radii, segs = 32) {
  const curve = new THREE.CatmullRomCurve3(pts), n = pts.length * 3;
  const frames = curve.computeFrenetFrames(n, false), pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), f = t * (radii.length - 1), k = Math.min(radii.length - 2, Math.floor(f)), r = radii[k] + (radii[k + 1] - radii[k]) * (f - k);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= segs; j++) { const a = j / segs * TAU; pos.push(p.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z)); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** The supercharger; `chamberInlet` is the intake chamber's spigot (its centre and radius, below the chamber). */
export function buildSupercharger(M, chamberInlet) {
  M.h2rRedAnod ??= new THREE.MeshStandardMaterial({ name: 'h2r-red-anodised', color: 0xa3200f, metalness: 0.7, roughness: 0.32 });
  M.h2rImpeller ??= new THREE.MeshStandardMaterial({ name: 'h2r-impeller', color: 0xdfe2e5, metalness: 1, roughness: 0.12, side: THREE.DoubleSide });
  M.h2rSilicone ??= new THREE.MeshStandardMaterial({ name: 'h2r-silicone-orange', color: 0xd2541c, metalness: 0, roughness: 0.55 });
  const g = new THREE.Group(); g.name = 'h2r-supercharger';
  const { x: cx, y: cy } = SC, red = [], bright = [], dark = [];
  const zb = SC.back;                       // the impeller's back plate
  // ---- The impeller, its eye facing left (−z): its own group, spun about its axis.
  {
    const imp = impeller(), spin = new THREE.Group(); spin.name = 'h2r-impeller';
    spin.add(mesh(imp.blades, M.h2rImpeller, { name: 'h2r-impeller-blades' }), mesh(imp.hub, M.h2rMachined ?? M.h2rAlu, { name: 'h2r-impeller-hub' }));
    spin.position.set(cx, cy, zb); spin.rotation.y = Math.PI;   // (its +z, the eye, to the left)
    g.add(spin); g.userData.spin = { object: spin, ratio: 9.2 };
  }
  // ---- The housing: the back (on the drive's housing), the shroud's outside and the cover, turned
  // about the axis from the back out to the inlet's bell.
  red.push({ geometry: turned([[0.03, 0], [0.074, 0], [0.079, -0.004], [0.08, -0.012], [0.078, -0.02], [0.068, -0.027], [0.052, -0.032], [0.04, -0.036], [0.034, -0.04], [0.032, -0.05], [0.032, -0.072]], cx, cy, zb + 0.008, 1, 96) });
  // (The shroud's inside, hugging the blades' tips: seen through the inlet.)
  {
    // (From the blades' outlet, along their tips to the eye, on into the inlet's tube.)
    const prof = []; for (let i = 16; i >= 0; i--) { const [r, z] = tipLine(i / 16); prof.push([r + 0.0006, -(z + 0.0002)]); }
    prof.push([0.0262, -0.04], [0.0262, -0.072]);
    const inner = turned(prof, cx, cy, zb, 1, 72);
    // (Faces inward: the lathe's outward faces flipped.)
    const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    inner.computeVertexNormals(); red.push({ geometry: inner });
  }
  // The inlet's bell, polished, and its lip where the duct's sleeve slides on; the cover's bolts.
  bright.push({ geometry: turned([[0.0262, -0.072], [0.0322, -0.072], [0.0335, -0.074], [0.0335, -0.083], [0.031, -0.086], [0.0272, -0.0855], [0.0262, -0.083]], cx, cy, zb, 1, 72) });
  boltRing(bright, cx, cy, zb - 0.026, -1, 0.071, 10, { head: 0.0036, h: 0.004, a0: 0.15 });
  // ---- The scroll round the housing, its tongue, and the outlet rising from it.
  const vz = zb - 0.012, v = volute(cx, cy, vz);
  red.push({ geometry: varTube(v.pts, v.radii, 28) });
  const top = chamberInlet.c.clone(), outA = v.pts[v.pts.length - 1].clone(), r1 = v.radii[v.radii.length - 1];
  const outPts = [outA, outA.clone().add(new THREE.Vector3(0, 0.03, 0)), new THREE.Vector3(top.x, top.y - 0.045, (outA.z + top.z) / 2), new THREE.Vector3(top.x, top.y - 0.03, top.z)];
  red.push({ geometry: varTube(outPts, [r1, r1, chamberInlet.r - 0.0015, chamberInlet.r - 0.0015], 28) });
  // A flange where the outlet leaves the scroll, and its bolts.
  {
    const f = new THREE.CylinderGeometry(r1 + 0.007, r1 + 0.007, 0.006, 40); f.translate(outA.x, outA.y + 0.02, outA.z); red.push({ geometry: f });
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4, b = new THREE.CylinderGeometry(0.0034, 0.0034, 0.005, 6); b.translate(outA.x + Math.cos(a) * (r1 + 0.0045), outA.y + 0.0255, outA.z + Math.sin(a) * (r1 + 0.0045)); bright.push({ geometry: b }); }
  }
  // ---- The drive's housing behind it, on the case (dark), and the oil feed's banjo.
  dark.push({ geometry: turned([[0.05, 0], [0.05, 0.026], [0.046, 0.03], [0.03, 0.03]], cx, cy, zb + 0.008, 1, 64) });
  boltRing(bright, cx, cy, zb + 0.012, -1, 0.045, 6, { head: 0.0038, h: 0.004 });
  // ---- The coupler: orange silicone over the outlet and the chamber's spigot, two clamps.
  {
    const c = chamberInlet.c, r = chamberInlet.r + 0.003;
    const sil = new THREE.CylinderGeometry(r, r, 0.05, 48, 1, true); sil.translate(c.x, c.y - 0.022, c.z);
    const beads = [-0.04, -0.004].map(d => { const t = new THREE.TorusGeometry(r, 0.0025, 8, 48); t.rotateX(Math.PI / 2); t.translate(c.x, c.y + d, c.z); return { geometry: t }; });
    g.add(mesh(mergeAll([{ geometry: sil }, ...beads]), M.h2rSilicone, { name: 'h2r-supercharger-coupler' }));
    const Y = new THREE.Vector3(0, 1, 0);
    bright.push({ geometry: hoseClamp(new THREE.Vector3(c.x, c.y - 0.034, c.z), Y, r + 0.0008, 0.009) }, { geometry: hoseClamp(new THREE.Vector3(c.x, c.y - 0.012, c.z), Y, r + 0.0008, 0.009) });
  }
  g.add(mesh(mergeAll(red), M.h2rRedAnod, { name: 'h2r-supercharger-housing' }));
  g.add(mesh(mergeAll(bright), M.h2rMachined ?? M.h2rAlu, { name: 'h2r-supercharger-hardware' }));
  g.add(mesh(mergeAll(dark), M.h2rEngine, { name: 'h2r-supercharger-drive' }));
  return g;
}
