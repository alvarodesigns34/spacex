/**
 * The drive chain, link by link: a 525 chain (5/8 in pitch, 15.875 mm; rollers 10.16 mm), its inner
 * and outer links alternating, each a pair of figure-of-eight plates, the rollers between the inner
 * plates and the pins riveted through the outer ones. It runs on the exact common tangents of the
 * gearbox sprocket and the 42-tooth wheel sprocket (≈ the routing of the photographs; the gearbox
 * sprocket's size ≈ 18 teeth).
 */
import * as THREE from 'three';
import { TAU, mergeAll, mesh } from './geometry.js';

const PITCH = 0.015875, ROLLER = 0.01016 / 2, PLATE_H = 0.0151, T = 0.0015, INNER = 0.0079;

/** The figure-of-eight plate outline, centred between its two pins (along x). */
function plateShape(p) {
  const s = new THREE.Shape(), r = PLATE_H / 2, waist = PLATE_H * 0.36, n = 14, pts = [];
  // Round each end, the waist between them drawn in.
  for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + Math.PI * k / n; pts.push([p / 2 + Math.cos(a) * r * 0.97, Math.sin(a) * r]); }
  for (let k = 1; k < 6; k++) { const u = k / 6, x = p / 2 - p * u; pts.push([x, r - (r - waist) * Math.sin(Math.PI * u)]); }
  for (let k = 0; k <= n; k++) { const a = Math.PI / 2 + Math.PI * k / n; pts.push([-p / 2 + Math.cos(a) * r * 0.97, Math.sin(a) * r]); }
  for (let k = 1; k < 6; k++) { const u = k / 6, x = -p / 2 + p * u; pts.push([x, -r + (r - waist) * Math.sin(Math.PI * u)]); }
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

/**
 * The chain round a front sprocket (centre A, pitch radius r0) and a rear one (B, r1), in the plane
 * z = zc (A and B carry it). Returns the plates, rollers and pins as three geometries.
 */
export function chainGeometry(A, B, r0, r1) {
  const zc = A.z;
  const a = new THREE.Vector2(A.x, A.y), b = new THREE.Vector2(B.x, B.y);
  const D = a.distanceTo(b), u = b.clone().sub(a).divideScalar(D), n = new THREE.Vector2(-u.y, u.x);
  const beta = Math.asin((r1 - r0) / D);
  // The common external tangents' points (upper with +n, lower with −n).
  const dirUp = n.clone().multiplyScalar(Math.cos(beta)).sub(u.clone().multiplyScalar(Math.sin(beta)));
  const dirLo = n.clone().multiplyScalar(-Math.cos(beta)).sub(u.clone().multiplyScalar(Math.sin(beta)));
  const ang = (v) => Math.atan2(v.y, v.x);
  // The path: along the top from the front to the rear, round the rear, back along the bottom, round the front.
  const segs = [];
  segs.push({ kind: 'line', p0: a.clone().addScaledVector(dirUp, r0), p1: b.clone().addScaledVector(dirUp, r1) });
  {
    let a0 = ang(dirUp), a1 = ang(dirLo); while (a1 > a0) a1 -= TAU;   // clockwise round the rear's back
    segs.push({ kind: 'arc', c: b, r: r1, a0, a1 });
  }
  segs.push({ kind: 'line', p0: b.clone().addScaledVector(dirLo, r1), p1: a.clone().addScaledVector(dirLo, r0) });
  {
    let a0 = ang(dirLo), a1 = ang(dirUp); while (a1 > a0) a1 -= TAU;
    segs.push({ kind: 'arc', c: a, r: r0, a0, a1 });
  }
  const len = (s) => (s.kind === 'line' ? s.p0.distanceTo(s.p1) : Math.abs(s.a1 - s.a0) * s.r);
  const total = segs.reduce((t, s) => t + len(s), 0);
  const nLinks = Math.round(total / PITCH / 2) * 2, step = total / nLinks;
  const at = (d) => {
    for (const s of segs) {
      const L = len(s);
      if (d <= L) return s.kind === 'line' ? s.p0.clone().lerp(s.p1, d / L) : new THREE.Vector2(s.c.x + Math.cos(s.a0 + (s.a1 - s.a0) * d / L) * s.r, s.c.y + Math.sin(s.a0 + (s.a1 - s.a0) * d / L) * s.r);
      d -= L;
    }
    return segs[0].p0.clone();
  };
  const pins = []; for (let i = 0; i < nLinks; i++) pins.push(at(i * step));
  // One plate of each kind, placed per link; rollers and pins per pin.
  const plate = new THREE.ExtrudeGeometry(plateShape(step), { depth: T - 0.0004, bevelEnabled: true, bevelThickness: 0.0002, bevelSize: 0.0002, bevelSegments: 1, curveSegments: 4 });
  plate.translate(0, 0, -T / 2 + 0.0002);
  const roller = new THREE.CylinderGeometry(ROLLER, ROLLER, INNER - 0.0002, 12, 1, true); roller.rotateX(Math.PI / 2);
  const pinG = new THREE.CylinderGeometry(0.0025, 0.0025, INNER + 4 * T + 0.0016, 8); pinG.rotateX(Math.PI / 2);
  const head = new THREE.SphereGeometry(0.0028, 8, 4, 0, TAU, 0, Math.PI / 2); head.rotateX(Math.PI / 2);
  const plates = [], rollers = [], pinsG = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < nLinks; i++) {
    const p0 = pins[i], p1 = pins[(i + 1) % nLinks], mid = p0.clone().add(p1).multiplyScalar(0.5), rot = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const outer = i % 2 === 0, off = INNER / 2 + T / 2 + (outer ? T : 0);
    for (const s of [-1, 1]) {
      m4.makeRotationZ(rot).setPosition(mid.x, mid.y, zc + s * off);
      plates.push({ geometry: plate, matrix: m4.clone() });
    }
    rollers.push({ geometry: roller, matrix: new THREE.Matrix4().makeTranslation(p0.x, p0.y, zc) });
    if (outer) {
      for (const q of [p0, p1]) {
        pinsG.push({ geometry: pinG, matrix: new THREE.Matrix4().makeTranslation(q.x, q.y, zc) });
        for (const s of [-1, 1]) {
          const h = new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI).setPosition(q.x, q.y, zc + s * (INNER / 2 + 2 * T));
          pinsG.push({ geometry: head, matrix: h });
        }
      }
    }
  }
  return { plates: mergeAll(plates), rollers: mergeAll(rollers), pins: mergeAll(pinsG), links: nLinks };
}

/** The chain as meshes: plates dark steel, rollers and pins bright. */
export function buildChain(M, A, B, r0, r1) {
  const g = new THREE.Group(); g.name = 'h2r-chain';
  const c = chainGeometry(A, B, r0, r1);
  M.h2rChainPin ??= new THREE.MeshStandardMaterial({ name: 'h2r-chain-pin', color: 0xc4c7ca, metalness: 0.95, roughness: 0.28 });
  g.add(mesh(c.plates, M.h2rChain, { name: 'h2r-chain-plates' }));
  g.add(mesh(c.rollers, M.h2rChainPin, { name: 'h2r-chain-rollers' }));
  g.add(mesh(c.pins, M.h2rChainPin, { name: 'h2r-chain-pins' }));
  g.userData.links = c.links;
  return g;
}
