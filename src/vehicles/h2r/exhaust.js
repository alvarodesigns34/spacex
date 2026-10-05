/**
 * The exhaust, traced on the right-side photograph (engine/parts.js's calibration) and detailed on the
 * photographs of the bike without its bodywork (Wikimedia Commons, "Kawasaki Ninja H2R exposd right
 * front"; reference only; sizes ≈):
 *  - four titanium headers out of the head's front, each held to its port by a flange and two nuts,
 *    a weld ring ≈8 cm down, falling past the oil cooler in a tight bunch and turning back under
 *    the engine; titanium's heat tint along them: straw by the ports, blue and violet down the
 *    front, bronze in the bends under the engine;
 *  - the collector under the engine, gold-tinted, where the four become one, its oxygen sensor;
 *  - the link pipe rising to the silencer, the joint's band and its two springs;
 *  - the long silencer along the right side, brushed stainless, ≈0.11 m across, its outlet cut on
 *    a slant: a wall with its thickness and the rolled lip at the cut, the perforated core inside,
 *    its hanger's band and the bracket up to the rearset's plate.
 */
import * as THREE from 'three';
import { D2R, TAU, sweep, mergeAll, mesh } from './geometry.js';
import { heatTint } from './materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = new THREE.Vector3(0, 1, 0);

/** The headers' traced routes (port first), one per cylinder. */
function headerRoutes() {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const z = -0.114 + i * 0.076, k = i - 1.5;
    out.push([V(0.275, 0.6, z), V(0.31, 0.53, z * 1.02), V(0.326, 0.42, z * 1.04), V(0.33 - k * 0.004, 0.29, z), V(0.3 - k * 0.006, 0.215 + k * 0.004, z * 0.85),
      V(0.22, 0.183 + k * 0.006, z * 0.6), V(0.12, 0.172 + k * 0.004, z * 0.42 + 0.02), V(0.07, 0.175, z * 0.24 + 0.05)]);
  }
  return out;
}

/** A tube from A to B, radius r(t) along it, its far end cut on a slant of `slash` to the axis; `inward` faces it to its axis. */
function slashTube(A, B, r, slash, { rings = 48, segs = 56, inward = false } = {}) {
  const ax = B.clone().sub(A), L = ax.length(); ax.normalize();
  const u = Math.abs(ax.y) < 0.9 ? Y.clone() : new THREE.Vector3(1, 0, 0);
  const e1 = u.clone().sub(ax.clone().multiplyScalar(u.dot(ax))).normalize(), e2 = ax.clone().cross(e1);
  const pos = [], idx = [], last = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j <= segs; j++) {
      const a = j / segs * TAU, rr = r(t), c = Math.cos(a), s = Math.sin(a);
      // The cut: the last ring set back along the axis, longest on the upper side.
      const along = L * t - (i === rings ? Math.tan(slash) * r(1) * (1 - c) : 0);
      const p = A.clone().addScaledVector(ax, along).addScaledVector(e1, c * rr).addScaledVector(e2, s * rr);
      pos.push(p.x, p.y, p.z);
      if (i === rings) last.push(p);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + segs + 1;
    if (inward) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return { g, last, ax, e1, e2, L };
}

function materials(M) {
  M.h2rTi ??= new THREE.MeshStandardMaterial({ name: 'h2r-titanium', color: 0xffffff, map: heatTint(), metalness: 1, roughness: 0.26 });
  M.h2rTiGold ??= new THREE.MeshStandardMaterial({ name: 'h2r-titanium-gold', color: 0xb99a5c, metalness: 1, roughness: 0.3 });
  M.h2rTiBlue ??= new THREE.MeshStandardMaterial({ name: 'h2r-titanium-weld', color: 0x3f63b8, metalness: 1, roughness: 0.3 });
  M.h2rSilencer ??= new THREE.MeshStandardMaterial({ name: 'h2r-silencer', color: 0xc6c9cc, metalness: 0.95, roughness: 0.34 });
  M.h2rVoid ??= new THREE.MeshStandardMaterial({ name: 'h2r-void', color: 0x0a0a0b, metalness: 0.2, roughness: 0.7 });
}

export function buildExhaust(M) {
  materials(M);
  const g = new THREE.Group(); g.name = 'h2r-exhaust';
  const R = 0.0168;
  const routes = headerRoutes();
  // The headers.
  const tubes = routes.map(pts => ({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 140, R, 24) }));
  g.add(mesh(mergeAll(tubes), M.h2rTi, { name: 'h2r-headers' }));
  // At each port: the flange (an oval plate) with its two nuts on their studs; the weld ring below.
  const flanges = [], nuts = [], welds = [];
  for (const pts of routes) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const p0 = curve.getPoint(0.004), t0 = curve.getTangent(0.004);
    const q = new THREE.Quaternion().setFromUnitVectors(Y, t0);
    const sh = new THREE.Shape(); const n = 28;
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; sh[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 0.033, Math.sin(a) * 0.019); }
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    fg.rotateX(-Math.PI / 2); fg.applyQuaternion(q); fg.translate(p0.x, p0.y, p0.z);
    flanges.push({ geometry: fg });
    // (The flange's long axis across the bike: its studs either side of the pipe.)
    const across = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    for (const sgn of [-1, 1]) {
      const c = p0.clone().addScaledVector(across, sgn * 0.025).addScaledVector(t0, 0.007);
      const nut = new THREE.CylinderGeometry(0.0058, 0.0058, 0.008, 6); nut.applyQuaternion(q); nut.translate(c.x, c.y, c.z);
      const stud = new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 10); stud.applyQuaternion(q); stud.translate(...c.clone().addScaledVector(t0, 0.006).toArray());
      nuts.push({ geometry: nut }, { geometry: stud });
    }
    // The weld ring: a bead round the pipe, its heat tint deep blue.
    for (const t of [0.135]) {
      const p = curve.getPoint(t), tan = curve.getTangent(t), w = new THREE.TorusGeometry(R + 0.0006, 0.0013, 6, 32);
      w.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan)); w.translate(p.x, p.y, p.z);
      welds.push({ geometry: w });
    }
  }
  g.add(mesh(mergeAll(flanges), M.h2rMachined, { name: 'h2r-header-flanges' }));
  g.add(mesh(mergeAll(nuts), M.h2rAlu, { name: 'h2r-header-nuts' }));
  g.add(mesh(mergeAll(welds), M.h2rTiBlue, { name: 'h2r-header-welds' }));
  // The collector: from the four pipes' ends (an oval taking them all in) to the one pipe, gold;
  // the oxygen sensor's boss, its hex and its lead.
  // (Its end runs on along the silencer's axis, so that the link pipe's sleeve slips straight over it.)
  const cC = V(-0.03, 0.2, 0.11), B = V(-0.57, 0.415, 0.165), axis = B.clone().sub(cC).normalize(), RL = 0.031;
  const cA = V(0.085, 0.176, 0.05), cB = cC.clone().addScaledVector(axis, -0.04);
  const ease = (t) => Math.min(1, t * 1.4);
  g.add(mesh(sweep([cA, V(0.045, 0.182, 0.078), cB, cC], (t) => 0.095 - (0.095 - 2 * RL) * ease(t), (t) => 0.048 + (2 * RL - 0.048) * ease(t), { up: Y, e: 0.75, steps: 30, n: 28, open: true }), M.h2rTiGold, { name: 'h2r-collector' }));
  {
    const at = V(0.02, 0.17, 0.1), tube = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 16); tube.translate(at.x, at.y - 0.006, at.z);
    const hex = new THREE.CylinderGeometry(0.011, 0.011, 0.008, 6); hex.translate(at.x, at.y - 0.02, at.z);
    g.add(mesh(mergeAll([{ geometry: tube }, { geometry: hex }]), M.h2rAlu, { name: 'h2r-o2-sensor' }));
    g.add(mesh(sweep([V(at.x, at.y - 0.026, at.z), V(at.x - 0.01, at.y - 0.05, at.z + 0.01), V(at.x - 0.06, at.y - 0.03, at.z + 0.03)], 0.006, 0.006, { e: 1, steps: 16, n: 8, open: true }), M.h2rHose ?? M.h2rSatin, { name: 'h2r-o2-lead' }));
  }
  // The silencer (the right-side photograph): the link pipe out of the collector, ≈62 mm, then the
  // long cone opening to ≈104 mm at the outlet under the tail, cut on a slant; its wall 4 mm thick,
  // the rolled lip at the cut, dark inside, the perforated core set back in the outlet.
  const A = cC.clone(), slash = 30 * D2R, T0 = 0.28, T1 = 0.9, RO = 0.052, WALL = 0.004;
  const rOut = (t) => RL + (RO - RL) * Math.min(1, Math.max(0, (t - T0) / (T1 - T0)));
  const outer = slashTube(A, B, rOut, slash, { rings: 72 });
  g.add(mesh(outer.g, M.h2rSilencer, { name: 'h2r-silencer' }));
  const s0 = outer.L - 0.16;
  const innerT = slashTube(A.clone().addScaledVector(outer.ax, s0), B, (t) => rOut((s0 + t * (outer.L - s0)) / outer.L) - WALL, slash, { inward: true, rings: 16 });
  g.add(mesh(innerT.g, M.h2rVoid, { name: 'h2r-silencer-inside' }));
  {
    // The lip: rolled round from the outside's cut edge to the inside's, a half-round bead.
    const pos = [], idx = [], n = outer.last.length, K = 6;
    for (let j = 0; j < n; j++) for (let k = 0; k <= K; k++) {
      const u = k / K, p = outer.last[j].clone().lerp(innerT.last[j], u).addScaledVector(outer.ax, Math.sin(Math.PI * u) * WALL / 2);
      pos.push(p.x, p.y, p.z);
    }
    for (let j = 0; j < n - 1; j++) for (let k = 0; k < K; k++) { const a = j * (K + 1) + k, b = a + K + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const lip = new THREE.BufferGeometry(); lip.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lip.setIndex(idx); lip.computeVertexNormals();
    // (Facing out along the axis at the bead's crown.)
    const nm = lip.attributes.normal, c = K / 2;
    if (nm.getX(c) * outer.ax.x + nm.getY(c) * outer.ax.y + nm.getZ(c) * outer.ax.z < 0) {
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      lip.setIndex(idx); lip.computeVertexNormals();
    }
    g.add(mesh(lip, M.h2rSilencer, { name: 'h2r-silencer-lip' }));
    // The perforated core, set back inside the outlet, and the baffle ring round it.
    const qa = new THREE.Quaternion().setFromUnitVectors(Y, outer.ax);
    const core = new THREE.CylinderGeometry(0.026, 0.026, 0.1, 32, 1, true);
    core.applyQuaternion(qa); core.translate(...A.clone().addScaledVector(outer.ax, outer.L - 0.12).toArray());
    const ends = new THREE.RingGeometry(0.026, RO - WALL, 40);
    ends.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), outer.ax)); ends.translate(...A.clone().addScaledVector(outer.ax, outer.L - 0.07).toArray());
    M.h2rCore ??= new THREE.MeshStandardMaterial({ name: 'h2r-silencer-core', color: 0x2a2826, metalness: 0.6, roughness: 0.7, side: THREE.DoubleSide });
    g.add(mesh(mergeAll([{ geometry: core }, { geometry: ends }]), M.h2rCore, { name: 'h2r-silencer-core' }));
  }
  {
    const bands = [], springs = [], dark = [];
    const qa = new THREE.Quaternion().setFromUnitVectors(Y, outer.ax);
    const at = (d) => A.clone().addScaledVector(outer.ax, d);
    // A band on the pipe from `d0` to `d1` along it, `gap` proud of its wall (radii follow the cone).
    const band = (d0, d1, gap) => {
      const b = new THREE.CylinderGeometry(rOut(d1 / outer.L) + gap, rOut(d0 / outer.L) + gap, d1 - d0, 48, 1, true);
      b.applyQuaternion(qa); b.translate(...at((d0 + d1) / 2).toArray()); return b;
    };
    // The slip joint behind the collector: the link pipe's sleeve over it, a chamfer at its mouth,
    // and two springs from hooks on the collector to hooks on the sleeve.
    bands.push({ geometry: band(-0.004, 0.045, 0.0028) });
    {
      const ch = new THREE.CylinderGeometry(RL + 0.0028, RL + 0.0008, 0.003, 48, 1, true); ch.applyQuaternion(qa); ch.translate(...at(-0.0055).toArray());
      bands.push({ geometry: ch });
    }
    for (const ang of [0.5, 0.5 + Math.PI]) {
      const off = (d, rr) => at(d).addScaledVector(outer.e1, Math.cos(ang) * rr).addScaledVector(outer.e2, Math.sin(ang) * rr);
      const pts = [];
      for (let k = 0; k <= 80; k++) {
        const u = k / 80, a = k * 0.9;
        const c = off(-0.03 + 0.085 * u, RL + 0.011);
        pts.push(c.addScaledVector(outer.e1, Math.cos(ang) * Math.cos(a) * 0.004).addScaledVector(outer.ax, Math.sin(a) * 0.004));
      }
      springs.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.0009, 5) });
      for (const d of [-0.034, 0.059]) {
        const hook = new THREE.BoxGeometry(0.006, 0.014, 0.003); hook.applyQuaternion(qa);
        const h = off(d, RL + 0.006); hook.translate(h.x, h.y, h.z); bands.push({ geometry: hook });
      }
    }
    // The hanger's band round the cone under the rearset, its clamp lug and bolt.
    const dh = 0.25 / 0.54 * outer.L;
    bands.push({ geometry: band(dh - 0.016, dh + 0.016, 0.0018) });
    const up = new THREE.Vector3(0, 0.6, 0.8).normalize();
    const radial = up.clone().sub(outer.ax.clone().multiplyScalar(up.dot(outer.ax))).normalize();
    const rh = rOut(dh / outer.L) + 0.0018;
    const foot = at(dh).addScaledVector(radial, rh);
    {
      const lug = new THREE.BoxGeometry(0.03, 0.012, 0.012); lug.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), outer.ax));
      lug.translate(...foot.clone().addScaledVector(radial, 0.005).toArray()); bands.push({ geometry: lug });
    }
    g.add(mesh(mergeAll(bands), M.h2rAlu, { name: 'h2r-silencer-bands' }));
    g.add(mesh(mergeAll(springs), M.h2rAlu, { name: 'h2r-silencer-springs' }));
    // The hanger: a pierced aluminium plate from the band's lug up to the inside of the right heel
    // plate (details.js: its inner face at z ≈ 0.197, the peg at x −0.28 m, 0.37 m up), its
    // triangular window, two socket-head bolts into the heel plate.
    const top = V(foot.x - 0.005, 0.385, 0.193);
    const X = new THREE.Vector3(1, 0, 0), S = top.clone().sub(foot); S.addScaledVector(X, -S.dot(X)); const Ls = S.length(); S.normalize();
    const N = X.clone().cross(S);
    const sh = new THREE.Shape([[-0.02, 0.004], [0.02, 0.004], [0.032, Ls + 0.012], [-0.036, Ls + 0.012]].map(([x, y]) => new THREE.Vector2(x, y)));
    sh.holes.push(new THREE.Path([[-0.008, 0.02], [0.01, 0.02], [0.016, Ls - 0.016], [-0.018, Ls - 0.016]].map(([x, y]) => new THREE.Vector2(x, y))));
    const br = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1 });
    br.translate(0, 0, -0.002);
    const m4 = new THREE.Matrix4().makeBasis(X, S, N).setPosition(foot.clone().addScaledVector(radial, 0.008));
    br.applyMatrix4(m4);
    g.add(mesh(br, M.h2rAlu, { name: 'h2r-silencer-hanger' }));
    const heads = [];
    for (const dx of [-0.022, 0.018]) {
      const h = new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 20); h.rotateX(Math.PI / 2);
      h.translate(dx, Ls + 0.002, -0.0048); h.applyMatrix4(m4);   // (on its inner face: N points out)
      heads.push({ geometry: h });
      const hx = new THREE.CylinderGeometry(0.002, 0.002, 0.001, 6); hx.rotateX(Math.PI / 2);
      hx.translate(dx, Ls + 0.002, -0.0069); hx.applyMatrix4(m4); dark.push({ geometry: hx });
    }
    g.add(mesh(mergeAll(heads), M.h2rSatin, { name: 'h2r-silencer-hanger-bolts' }));
    g.add(mesh(mergeAll(dark), M.h2rVoid, { name: 'h2r-silencer-hanger-hex' }));
  }
  return g;
}
