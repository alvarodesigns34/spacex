/**
 * The Porsche's damage in a crash, for the look: the bodywork dented where it struck, the parts
 * that come off, the sparks and the fragments. The physics of the contact is gt3Car.js's (its
 * impulse, the closing speed); this reads each contact it records and answers it on the model.
 *
 *  - Dents: the body is crushed along the blow against a plane set in from the point struck:
 *    what stood out beyond it is squeezed into the space just ahead of it, keeping its order (so
 *    the panels laid over one another fold together and none goes through another), fully on
 *    the line of the blow and smoothly less out to a radius beside it, with a little crumpling. The crush grows with the closing speed: ≈0,04 m per m/s, up to ≈0,6 m (≈: a car's
 *    front crushes about half a metre in a 56 km/h barrier test; this is a look, not a
 *    structural model). Small knocks (under ≈2 m/s) leave no mark.
 *  - Parts: past ≈6 m/s on a corner the door mirror on that side comes off; past ≈9 m/s at the
 *    tail the rear wing does. They fly off with the car's speed and a kick, tumble, and come to
 *    rest on the ground.
 *  - Sparks where metal scrapes, flakes of paint and black trim, and glass from the lamps.
 *
 * reset() puts every piece's own geometry and every part back.
 */
import * as THREE from 'three';

// What dents: everything on the sprung body but the cabin (its live instruments, the steering
// wheel) and the wing's flap (moved by the DRS); the wheels are not under it.
const KEEP_OUT = /^gt3-(cabin|wing-flap)$/;

export function createGt3Damage({ car, scene, effects, ground }) {
  const meshes = [];
  const rootInv = new THREE.Matrix4(), relInv = new THREE.Matrix4();
  const _c = new THREE.Vector3();
  let captured = false;
  /** Where each piece of the body is, in the car's frame (x forward, y up, z right). */
  function capture() {
    car.updateMatrixWorld(true);
    rootInv.copy(car.matrixWorld).invert();
    const sprung = car.getObjectByName('gt3-sprung') ?? car;
    (function walk(o) {
      if (KEEP_OUT.test(o.name)) return;
      if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.position) {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const bs = o.geometry.boundingSphere;
        const m = new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
        const c = bs.center.clone().applyMatrix4(m), r = bs.radius * m.getMaxScaleOnAxis();
        meshes.push({ o, rel: m, c, r, geo: null, local: null, toMesh: null, dirty: false, gone: false });
      }
      for (const k of o.children) walk(k);
    })(sprung);
    captured = true;
  }
  /**
   * A piece the blow reaches, the first time: a geometry of its own (the left and right halves
   * of the car share some), and its vertices in the car's frame.
   */
  function prepare(m) {
    m.geo = m.o.geometry;
    m.o.geometry = m.geo.clone();
    const P = m.o.geometry.attributes.position, v = new THREE.Vector3();
    m.local = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.rel); m.local.set([v.x, v.y, v.z], i * 3); }
    relInv.copy(m.rel).invert();
    m.toMesh = new THREE.Matrix3().setFromMatrix4(relInv);
  }
  const parts = [];        // detached: { obj (its own group), homes (each object's place on the car), vel, spin, rest }
  const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

  /**
   * A contact: (fx, fy) the point in the body frame (forward, left), (nx, ny) the normal towards
   * what it struck, vn the closing speed (m/s). y: the height struck, ≈ the bumpers'.
   */
  function hit(fx, fy, nx, ny, vn, y = 0.45) {
    if (vn < 2) return;
    if (!captured) capture();
    const depth = Math.min(0.6, 0.04 * vn), R = 0.35 + 0.035 * vn;
    // The car's frame: x forward, z right (= −left).
    const px = fx, pz = -fy, dx = -nx, dz = ny;          // pushed back along the blow, away from what it struck
    for (const m of meshes) {
      if (m.gone) continue;
      _c.set(m.c.x - px, (m.c.y - y) * 0.8, m.c.z - pz);
      if (_c.length() > R + m.r) continue;
      if (!m.local) prepare(m);
      const P = m.o.geometry.attributes.position, L = m.local, A = P.array;
      let touched = false;
      for (let i = 0; i < L.length; i += 3) {
        const ex = L[i] - px, ey = (L[i + 1] - y) * 0.8, ez = L[i + 2] - pz;
        // How far out towards what it struck, and how far to the side of the line of the blow.
        const out = -(ex * dx + ez * dz), side2 = ex * ex + ey * ey + ez * ez - out * out;
        if (out < -depth || side2 > R * R) continue;
        // Crushed against a plane `depth` in from the point struck: what stood out beyond it is
        // squeezed into the space just ahead of it, keeping its order, so panels laid one over
        // another fold together and none passes through another. Less to the side of the blow;
        // the squeeze varies a little, smoothly, with where the vertex is (the crumpling).
        // (The onset rounded over 8 cm, so a triangle spanning it does not kink.)
        const b = out + depth, beyond = b < 0.08 ? b * b / 0.16 : b - 0.04;
        const x = L[i], y0 = L[i + 1], z = L[i + 2];
        const keep = 0.22 + 0.12 * (0.5 + 0.5 * Math.sin(x * 9.1 + z * 6.3 + y0 * 2.1) * Math.sin(y0 * 8.7 - x * 4.3 + z * 3.9));
        const f = beyond * (1 - keep) * (1 - side2 / (R * R)) ** 2;
        _d.set(dx * f, 0, dz * f).applyMatrix3(m.toMesh);
        A[i] += _d.x; A[i + 1] += _d.y; A[i + 2] += _d.z;
        L[i] += dx * f; L[i + 2] += dz * f;
        touched = true;
      }
      if (touched) { P.needsUpdate = true; m.dirty = true; }
    }
    for (const m of meshes) if (m.dirty) { m.o.geometry.computeVertexNormals(); m.dirty = false; }
    // What flies off where it struck.
    _w.set(px, y, pz).applyMatrix4(car.matrixWorld);
    const g = ground(_w.x, _w.z).h;
    effects.burst('spark', _w, Math.min(80, 6 * vn), { spread: 2 + vn * 0.3, up: 1.5, floor: g });
    effects.burst('paint', _w, Math.min(40, 2 * vn), { spread: 1 + vn * 0.15, up: 1.5, floor: g });
    effects.burst('debris', _w, Math.min(30, 1.5 * vn), { spread: 1 + vn * 0.15, up: 1.5, floor: g });
    if (vn > 5) effects.burst('glass', _w, Math.min(60, 3 * vn), { spread: 1.5 + vn * 0.2, up: 1.2, floor: g });
    // Parts that come off.
    if (vn > 6 && Math.abs(fx) < 1.4 && Math.abs(fy) > 0.6) {
      const side = fy > 0 ? 'l' : 'r';
      detach([`gt3-mirror-${side}`, `gt3-mirror-base-${side}`, `gt3-mirror-rim-${side}`, `gt3-mirror-glass-${side}`, `gt3-mirror-arm-${side}`].map(n => car.getObjectByName(n)), vn, nx, ny);
    }
    if (vn > 9 && fx < -1.2) detach([car.getObjectByName('gt3-wing')], vn, nx, ny);
  }
  /** Off the car: the objects, together, into a group of their own that flies and tumbles. */
  function detach(objs, vn, nx = 0, ny = 0) {
    objs = objs.filter(o => o && !parts.some(p => p.homes.some(h => h.obj === o)));
    if (!objs.length) return;
    const grp = new THREE.Group();
    grp.name = 'gt3-debris';
    scene.add(grp);
    const box = new THREE.Box3();
    for (const o of objs) box.expandByObject(o);
    box.getCenter(grp.position);
    grp.updateMatrixWorld(true);
    const homes = objs.map(o => ({ obj: o, parent: o.parent, position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() }));
    for (const o of objs) grp.attach(o);
    for (const m of meshes) { let p = m.o; while (p && p !== grp) p = p.parent; if (p === grp) m.gone = true; }
    const vel = new THREE.Vector3(-nx * vn * 0.4 + (Math.random() - 0.5) * 2, 2 + Math.random() * 3, ny * vn * 0.4 + (Math.random() - 0.5) * 2);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    parts.push({ obj: grp, homes, vel, spin, rest: false });
  }
  function update(dt) {
    for (const p of parts) {
      if (p.rest) continue;
      p.vel.y -= 9.81 * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      _q.setFromEuler(_e.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt));
      p.obj.quaternion.multiply(_q);
      const g = ground(p.obj.position.x, p.obj.position.z).h + 0.05;
      if (p.obj.position.y < g) {
        p.obj.position.y = g;
        p.vel.y = -p.vel.y * 0.25; p.vel.x *= 0.5; p.vel.z *= 0.5; p.spin.multiplyScalar(0.4);
        if (Math.abs(p.vel.y) < 0.6 && p.vel.length() < 0.8) p.rest = true;
      }
    }
  }
  function reset() {
    for (const m of meshes) if (m.geo) { m.o.geometry.dispose(); m.o.geometry = m.geo; }
    meshes.length = 0; captured = false;
    for (const p of parts) {
      for (const h of p.homes) { h.parent.add(h.obj); h.obj.position.copy(h.position); h.obj.quaternion.copy(h.quaternion); h.obj.scale.copy(h.scale); }
      p.obj.removeFromParent();
    }
    parts.length = 0;
  }
  return { hit, update, reset, get parts() { return parts.length; }, get dented() { return meshes.filter(m => m.local).map(m => m.o.name || m.o.parent?.name); } };
}
