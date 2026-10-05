/** The single-sided swingarm, the chain, the hugger, the rear wheel and its calliper. */
import * as THREE from 'three';
import { T, AXLE_R, PIVOT, RR, D2R, TAU, slab, loft, mergeAll, mesh } from './geometry.js';
import { PXY } from './photo.js';
import { buildWheel } from './wheels.js';
import { rearCalliper } from './brakes.js';
import { buildChain } from './chain.js';

/** The single-sided swingarm, on the left: tall at the pivot, sweeping down to its ring round the hub. */
export function buildSwingarm(M) {
  const g = new THREE.Group();
  g.name = 'h2r-swingarm';
  g.position.copy(PIVOT);
  const inner = new THREE.Group(); inner.position.copy(PIVOT).negate(); g.add(inner);
  // The arm, a black casting (traced on the side photograph): deep behind the pivot, its top falling
  // to the hub; on the left only, the wheel on its end.
  const st = [[722, 560, 650, -0.10, -0.165], [790, 548, 655, -0.11, -0.19], [870, 565, 660, -0.12, -0.2], [950, 595, 668, -0.125, -0.2], [1005, 612, 676, -0.13, -0.195]];
  const secs = st.map(([u, v0, v1, zi, zo]) => {
    const A = PXY(u, v0), B = PXY(u, v1);
    return [[A[0], A[1], zi], [A[0], A[1], zo + 0.02], [A[0], A[1] - 0.02, zo], [B[0], B[1] + 0.02, zo], [B[0], B[1], zo + 0.02], [B[0], B[1], zi]];
  });
  M.h2rSatin2 ??= M.h2rSatin.clone(); M.h2rSatin2.side = THREE.DoubleSide; M.h2rSatin2.name = 'h2r-satin-black-2s';
  void secs;
  // The arm, cast, dark grey satin (the photographs with the bodywork off): a box-section upper
  // beam from the pivot, rising a little and falling to the hub; a lower beam closing the
  // triangle; a web between them with a shallow recess; the eccentric hub carrier on its end
  // (≈ sections from the photographs; the pivot and the axle are the model's).
  M.h2rEngine ??= new THREE.MeshStandardMaterial({ name: 'h2r-engine', color: 0x34363a, metalness: 0.35, roughness: 0.52 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hub = AXLE_R;
  const arm = [];
  arm.push({ geometry: boxBeam([V(PIVOT.x, PIVOT.y + 0.02, -0.11), V(-0.3, 0.405, -0.112), V(-0.5, 0.395, -0.115), V(hub.x + 0.06, hub.y + 0.05, -0.118)], (t) => 0.075 - 0.02 * t, (t) => 0.055 - 0.01 * t) });
  arm.push({ geometry: boxBeam([V(PIVOT.x - 0.01, PIVOT.y - 0.04, -0.11), V(-0.36, 0.265, -0.113), V(hub.x + 0.07, hub.y - 0.045, -0.118)], (t) => 0.045 - 0.01 * t, (t) => 0.045) });
  {
    // The web between the beams, a little inboard, with its recess (a thinner panel inside a frame).
    const web = [[PIVOT.x - 0.04, PIVOT.y], [-0.3, 0.385], [-0.5, 0.375], [hub.x + 0.11, hub.y + 0.02], [hub.x + 0.11, hub.y - 0.02], [-0.36, 0.285], [PIVOT.x - 0.05, PIVOT.y - 0.03]];
    const wg = slab(web, 0.012, 0.004, 2); wg.translate(0, 0, -0.122); arm.push({ geometry: wg });
    const c = web.reduce((a, p) => [a[0] + p[0] / web.length, a[1] + p[1] / web.length], [0, 0]);
    const inset = web.map(([x, y]) => [c[0] + (x - c[0]) * 0.72, c[1] + (y - c[1]) * 0.62]);
    const ig = slab(inset, 0.004, 0.002, 1); ig.translate(0, 0, -0.13); arm.push({ geometry: ig });
  }
  // The hub carrier: the eccentric's housing round the axle, and its pinch bolts.
  arm.push({ geometry: (() => { const h = new THREE.CylinderGeometry(0.072, 0.072, 0.05, 48); h.rotateX(Math.PI / 2); h.translate(hub.x, hub.y, -0.125); return h; })() });
  arm.push({ geometry: (() => { const h = new THREE.TorusGeometry(0.072, 0.005, 10, 48); h.translate(hub.x, hub.y, -0.15); return h; })() });
  for (const dy of [-0.03, 0.03]) arm.push({ geometry: (() => { const b = new THREE.CylinderGeometry(0.007, 0.007, 0.03, 6); b.translate(hub.x + 0.075, hub.y + dy, -0.125); return b; })() });
  inner.add(mesh(mergeAll(arm), M.h2rEngine, { name: 'h2r-swingarm-beam' }));
  // The chain guard over the top run, and the hugger over the tyre.
  const cg = slab([PXY(895, 546), PXY(1090, 548), PXY(1080, 556), PXY(905, 558)], 0.07, 0.002); cg.translate(0, 0, -0.145);
  inner.add(mesh(cg, M.h2rSatin, { name: 'h2r-chain-guard' }));
  // The hugger: a black blade over the tyre's top front, off the arm (the side photograph).
  const hugS = [];
  for (let i = 0; i <= 10; i++) { const a = (62 + 50 * i / 10) * D2R, r = RR + 0.014; hugS.push([[AXLE_R.x + Math.cos(a) * r, AXLE_R.y + Math.sin(a) * r, -0.1], [AXLE_R.x + Math.cos(a) * (r + 0.006), AXLE_R.y + Math.sin(a) * (r + 0.006), 0.0], [AXLE_R.x + Math.cos(a) * r, AXLE_R.y + Math.sin(a) * r, 0.1]]); }
  inner.add(mesh(loft(hugS, { steps: 2 }), M.h2rSatin2, { name: 'h2r-hugger' }));
  // The chain, link by link, from the gearbox sprocket (≈18 teeth: 45.7 mm to the rollers' centres)
  // to the wheel's 42 teeth (106.2 mm).
  inner.add(buildChain(M, T(-790, 362, -0.165), AXLE_R.clone().setZ(-0.165), 0.0457, 0.1062));
  inner.add(buildWheel(M, 'r'));
  // The rear calliper under the swingarm, on the disc.
  const rc = rearCalliper(M); rc.position.set(AXLE_R.x + 0.02, AXLE_R.y - 0.105, 0.075); rc.rotation.z = Math.PI;
  inner.add(rc);
  return g;
}

/** A cast beam of rounded box section (height h(t), width w(t), t 0..1 along it) along points. */
function boxBeam(points, h, w, segs = 40) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const secs = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPoint(t), tan = curve.getTangent(t);
    const side = new THREE.Vector3(0, 0, 1), up = side.clone().cross(tan).normalize(), across = tan.clone().cross(up).normalize();
    const sec = [];
    for (let k = 0; k < 20; k++) {
      const a = k / 20 * TAU, c = Math.cos(a), sn = Math.sin(a), e = 0.32;
      sec.push(p.clone().addScaledVector(up, Math.sign(sn) * Math.abs(sn) ** e * h(t) / 2).addScaledVector(across, Math.sign(c) * Math.abs(c) ** e * w(t) / 2).toArray());
    }
    sec.push(sec[0]);
    secs.push(sec);
  }
  const g = loft(secs, { steps: 1, creaseDeg: 70 });
  // The ends closed.
  const parts = [{ geometry: g.index ? g.toNonIndexed() : g }];
  for (const [i, sgn] of [[0, -1], [secs.length - 1, 1]]) {
    const ring = secs[i], c = ring.slice(0, -1).reduce((a, p) => a.map((v, k) => v + p[k] / (ring.length - 1)), [0, 0, 0]);
    const pos = [], idx = [];
    pos.push(...c); ring.slice(0, -1).forEach(p => pos.push(...p));
    for (let k = 1; k < ring.length - 1; k++) { const a = k, b = k + 1 > ring.length - 1 ? 1 : k + 1; if (sgn > 0) idx.push(0, a, b); else idx.push(0, b, a); }
    idx.push(...(sgn > 0 ? [0, ring.length - 1, 1] : [0, 1, ring.length - 1]));
    const cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cap.setIndex(idx);
    const capN = cap.toNonIndexed(); capN.computeVertexNormals();
    parts.push({ geometry: capN });
  }
  return mergeAll(parts);
}
