/**
 * What is screwed onto the bodywork, as the photographs show it (Wikimedia Commons, "Kawasaki Ninja
 * H2R Petersen Automotive Museum", "2019 Kawasaki Ninja H2R FOS19"; reference only):
 *  - the side panels' button-head screws: at the panel's rear tip, along its upper edge where it
 *    meets the cowl, and along its lower edge over the fins (positions ≈, from the photographs,
 *    laid on the model's own surfaces);
 *  - the fuel cap on the tank's top, just behind the steering head: its machined ring, the hinged
 *    lid with its key lock and the breather, flush with the tank's top cover.
 * Each piece is cast onto the surface it sits on (a ray across the bike for the side, down for the
 * top) and turned to its normal; the side's screws are mirrored to the left.
 */
import * as THREE from 'three';
import { mergeAll, mesh, mirrorZ } from '../geometry.js';

const _ray = new THREE.Raycaster();
const Z = new THREE.Vector3(0, 0, 1);

/** The point and normal where a ray from `from` along `dir` first meets `targets`. */
function cast(targets, from, dir) {
  _ray.set(from, dir);
  const h = _ray.intersectObjects(targets, false)[0];
  if (!h) return null;
  const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
  if (n.dot(dir) > 0) n.negate();
  return { p: h.point, n };
}

/** A button-head screw (dome and hex socket) standing on p along n. */
function screw(p, n, r = 0.0042) {
  const q = new THREE.Quaternion().setFromUnitVectors(Z, n);
  const dome = new THREE.SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2); dome.rotateX(Math.PI / 2); dome.scale(1, 1, 0.45);
  const washer = new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.0008, 20); washer.rotateX(Math.PI / 2); washer.translate(0, 0, 0.0004);
  dome.translate(0, 0, 0.0008);
  const head = mergeAll([{ geometry: dome }, { geometry: washer }]);
  head.applyQuaternion(q); head.translate(p.x, p.y, p.z);
  const sock = new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.0006, 6); sock.rotateX(Math.PI / 2); sock.translate(0, 0, 0.0008 + r * 0.45 + 0.0001);
  sock.applyQuaternion(q); sock.translate(p.x, p.y, p.z);
  return { head, sock };
}

/** The side panels' screws: (x, y) in metres on the side view, cast across onto the panels. */
// (None on the "Ninja" lettering: the photographs show the panel clear there.)
const SIDE_SCREWS = [[0.3, 0.69], [0.42, 0.757], [0.745, 0.748], [0.69, 0.565], [0.48, 0.605]];

export function buildFasteners(M, root) {
  const g = new THREE.Group(); g.name = 'h2r-fasteners';
  root.updateMatrixWorld(true);
  const named = (re) => { const out = []; root.traverse(o => { if (o.isMesh && re.test(o.name)) out.push(o); }); return out; };
  const heads = [], socks = [];
  // ---- The side panels' screws.
  const panels = named(/^h2r-(side-panel|cowl|lower-cowl|lower-wing-plate|keel)$/);
  for (const [x, y] of SIDE_SCREWS) {
    const h = cast(panels, new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    if (!h || h.p.z < 0.02) continue;
    const s = screw(h.p, h.n);
    heads.push({ geometry: s.head }, { geometry: mirrorZ(s.head) }); socks.push({ geometry: s.sock }, { geometry: mirrorZ(s.sock) });
  }
  g.add(mesh(mergeAll(heads), M.h2rMachined ?? M.h2rAlu, { name: 'h2r-panel-screws' }));
  g.add(mesh(mergeAll(socks), M.h2rVoid, { name: 'h2r-panel-screw-sockets' }));
  // ---- The fuel cap, cast down onto the tank's top on the centre line.
  {
    const top = named(/^h2r-tank-top$/), h = cast(top, new THREE.Vector3(0.215, 1.5, 0), new THREE.Vector3(0, -1, 0));
    if (h) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.n);
      const place = (geo) => { geo.applyQuaternion(q); geo.translate(h.p.x, h.p.y, h.p.z); return geo; };
      // The ring: turned, its outer edge chamfered, a groove inside; then the lid, the lock, the hinge.
      const ring = new THREE.LatheGeometry([[0.047, -0.003], [0.047, 0.0015], [0.045, 0.0032], [0.0405, 0.0034], [0.0395, 0.002], [0.0385, 0.002]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
      const lid = new THREE.LatheGeometry([[0.0375, 0.0015], [0.0375, 0.0035], [0.035, 0.0048], [0, 0.0052]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
      const lock = new THREE.CylinderGeometry(0.0085, 0.0085, 0.0016, 32); lock.translate(-0.012, 0.0058, 0);
      const key = new THREE.BoxGeometry(0.0095, 0.0006, 0.0018); key.translate(-0.012, 0.0067, 0);
      const hinge = new THREE.BoxGeometry(0.014, 0.004, 0.02); hinge.translate(0.042, 0.003, 0);
      const vent = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0008, 12); vent.translate(0.022, 0.0053, 0.012);
      g.add(mesh(place(mergeAll([{ geometry: ring }, { geometry: hinge }, { geometry: lock }])), M.h2rMachined ?? M.h2rAlu, { name: 'h2r-fuel-cap-ring' }));
      g.add(mesh(place(lid), M.h2rSatin, { name: 'h2r-fuel-cap-lid' }));
      g.add(mesh(place(mergeAll([{ geometry: key }, { geometry: vent }])), M.h2rVoid, { name: 'h2r-fuel-cap-slots' }));
    }
  }
  return g;
}
