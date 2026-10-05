/**
 * The intake chamber and what hangs under it, as the photographs of the bike without its bodywork
 * show them (Wikimedia Commons, "Kawasaki Ninja H2R exposed top right", "… exposed left rear";
 * Kawasaki Technical Review No. 180, Fig. 3; reference only):
 *  - the chamber: a big aluminium casting under the tank, its edges rounded large, in two halves
 *    joined by a flange round its waist with its bolts; the supercharger's air comes in at its
 *    back left through the spigot under it (supercharger.js);
 *  - on its top right, the fuel rail along it: black, on its posts, the four upper injectors' plugs
 *    and their loom; the pressure sensor on the rail's end;
 *  - under its front, the four throttle bodies down to the head's intake ports, their linkage and
 *    the throttle position sensor's box on the left end.
 * Sizes ≈ (the photographs scaled by the frame's tubes); the side outline keeps the studio
 * photograph's lines (≈ ±1 cm) and stays clear of the head's cam cover in front and the tank above.
 */
import * as THREE from 'three';
import { mergeAll, mesh } from '../geometry.js';
import { ext, bolt, capScrew, alongOutline } from './parts.js';

/** The chamber's side outline (x, y): low over the supercharger at the back, rising over the head at the front. */
const SIDE = [[-0.155, 0.722], [0.06, 0.722], [0.1, 0.742], [0.15, 0.8], [0.26, 0.818], [0.285, 0.84], [0.27, 0.858], [0.15, 0.866], [0.0, 0.862], [-0.12, 0.85], [-0.155, 0.83]];
const HALF = 0.142, WAIST = 0.775;

/** The spigot under the chamber's back left, where the supercharger's coupler clamps on. */
export const CHAMBER_INLET = { c: new THREE.Vector3(-0.123, 0.716, -0.105), r: 0.03 };

/** The chamber's footprint at its waist (x, z): a rectangle with rounded corners. */
function footprint(x0, x1, hz, rc) {
  const pts = [];
  const corner = (cx, cz, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * Math.PI / 2; pts.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc]); } };
  corner(x1 - rc, hz - rc, 0); corner(x0 + rc, hz - rc, Math.PI / 2); corner(x0 + rc, -hz + rc, Math.PI); corner(x1 - rc, -hz + rc, 1.5 * Math.PI);
  return pts;
}
/** The chamber's x extent at height y (its outline's span there). */
function spanAt(y) {
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < SIDE.length; i++) {
    const [ax, ay] = SIDE[i], [bx, by] = SIDE[(i + 1) % SIDE.length];
    if ((ay - y) * (by - y) <= 0 && ay !== by) { const x = ax + (bx - ax) * (y - ay) / (by - ay); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  return [x0, x1];
}

export function buildChamber(M) {
  M.h2rPlenum ??= new THREE.MeshStandardMaterial({ name: 'h2r-intake-chamber', color: 0xc4c8cc, metalness: 0.9, roughness: 0.3 });
  const g = new THREE.Group(); g.name = 'h2r-intake-chamber';
  const body = [], bright = [], dark = [], black = [];
  // ---- The casting: the side outline across the bike, its edges rounded 30 mm.
  body.push({ geometry: ext(SIDE, -HALF, HALF, 0.03, 6) });
  // The flange round its waist: a lip 9 mm out all round, 6 mm thick, and its bolts on top.
  {
    const [x0, x1] = spanAt(WAIST), fp = footprint(x0 - 0.009, x1 + 0.009, HALF + 0.009, 0.034);
    const s = new THREE.Shape(fp.map(([x, z]) => new THREE.Vector2(x, z)));
    const f = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1, curveSegments: 4 });
    // (The shape's (x, z) laid flat: its y becomes z, its depth runs down.)
    f.rotateX(Math.PI / 2); f.translate(0, WAIST + 0.003, 0);
    body.push({ geometry: f });
    for (const [x, z] of alongOutline(footprint(x0 - 0.004, x1 + 0.004, HALF + 0.004, 0.03), 0.055, 0.02)) {
      const b = bolt(0, 0, 0, 1, 0.0042, 0.0045); b.rotateX(-Math.PI / 2); b.translate(x, WAIST + 0.0042, z);
      bright.push({ geometry: b });
    }
  }
  // The spigot under the back left for the supercharger's coupler.
  {
    const c = CHAMBER_INLET.c, sp = new THREE.CylinderGeometry(CHAMBER_INLET.r, CHAMBER_INLET.r, 0.032, 48); sp.translate(c.x, c.y - 0.004, c.z);
    const bead = new THREE.TorusGeometry(CHAMBER_INLET.r + 0.0012, 0.0016, 8, 48); bead.rotateX(Math.PI / 2); bead.translate(c.x, c.y - 0.018, c.z);
    body.push({ geometry: sp }, { geometry: bead });
  }
  // ---- The fuel rail along the top right: on four posts, its four injectors' plugs and loom; the
  // pressure sensor at its front.
  {
    const z = 0.09, y = 0.868, xs = [-0.08, -0.01, 0.06, 0.13];
    const rail = new THREE.BoxGeometry(0.27, 0.014, 0.018); rail.translate(0.025, y + 0.012, z); black.push({ geometry: rail });
    for (const x of xs) {
      const post = new THREE.CylinderGeometry(0.008, 0.009, 0.012, 16); post.translate(x, y + 0.001, z); body.push({ geometry: post });
      const inj = new THREE.CylinderGeometry(0.0075, 0.0075, 0.022, 20); inj.translate(x + 0.02, y + 0.022, z); black.push({ geometry: inj });
      const plug = new THREE.BoxGeometry(0.016, 0.012, 0.014); plug.translate(x + 0.02, y + 0.038, z + 0.004); black.push({ geometry: plug });
      const clip = new THREE.BoxGeometry(0.006, 0.004, 0.016); clip.translate(x + 0.026, y + 0.045, z + 0.004); dark.push({ geometry: clip });
      bright.push({ geometry: capScrew(x - 0.014, y + 0.006, z + 0.009, 1, 0.0032, dark) });
    }
    // The loom along the plugs.
    const loom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(xs.map(x => new THREE.Vector3(x + 0.02, y + 0.048, z + 0.012)).concat([new THREE.Vector3(0.19, y + 0.04, z + 0.02)])), 40, 0.0035, 8);
    black.push({ geometry: loom });
    const sensor = new THREE.CylinderGeometry(0.011, 0.011, 0.02, 20); sensor.rotateZ(Math.PI / 2); sensor.translate(0.17, y + 0.012, z); black.push({ geometry: sensor });
  }
  // ---- The four throttle bodies under the front, from the chamber down to the head's ports, the
  // linkage's shaft across them and the throttle position sensor on the left end.
  {
    const dir = new THREE.Vector3(0.62, -0.78, 0).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    for (let i = 0; i < 4; i++) {
      const z = -0.114 + i * 0.076, top = new THREE.Vector3(0.075, 0.748, z), c = top.clone().addScaledVector(dir, 0.025);
      const tb = new THREE.CylinderGeometry(0.024, 0.026, 0.05, 32); tb.applyQuaternion(q); tb.translate(c.x, c.y, c.z); body.push({ geometry: tb });
      const boss = new THREE.BoxGeometry(0.024, 0.02, 0.016); boss.applyQuaternion(q); boss.translate(...c.clone().add(new THREE.Vector3(-0.022, -0.012, 0.03)).toArray()); body.push({ geometry: boss });
    }
    const shaft = new THREE.CylinderGeometry(0.0035, 0.0035, 0.3, 10); shaft.rotateX(Math.PI / 2); shaft.translate(0.058, 0.735, 0); bright.push({ geometry: shaft });
    const tps = new THREE.BoxGeometry(0.03, 0.035, 0.018); tps.translate(0.058, 0.735, -0.162); black.push({ geometry: tps });
  }
  g.add(mesh(mergeAll(body), M.h2rPlenum, { name: 'h2r-intake-chamber-body' }));
  g.add(mesh(mergeAll(bright), M.h2rMachined ?? M.h2rAlu, { name: 'h2r-intake-chamber-bolts' }));
  g.add(mesh(mergeAll(black), M.h2rSatin, { name: 'h2r-fuel-rail' }));
  g.add(mesh(mergeAll(dark), M.h2rVoid, { name: 'h2r-intake-chamber-dark' }));
  return g;
}
