/**
 * Shared props: the Falcon launch mounts, display pedestals and 1.80 m human figures for scale.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, boxUV } from '../geometry/utils.js';

/**
 * Launch mount for the Falcon exhibits: the vehicle stands the way it does on the pad, on its
 * hold-down clamps, with the engines hanging free over an opening in the deck.
 *
 * What is cited (NASA Commercial Crew blog, "Modifications Transforming Pad A for Falcon
 * Launches", 2016; Spaceflight Now, Falcon Heavy STP-2 preview, 2019):
 *  - a single-stick Falcon 9 is held down by FOUR clamps, on the cardinal directions;
 *  - Falcon Heavy by EIGHT, the Falcon 9's east/west pair being removed because it would sit
 *    where the side cores' engines are; the vehicle's weight bears on the clamps, not on the
 *    engines, and the clamps release it at liftoff;
 *  - Falcon Heavy's TEL carries SIX tail service masts, which feed propellant, power and data
 *    into the three cores through umbilical plates at the base of each.
 * Reconstructed, not measured: the concrete block, the exhaust tunnel with its twin-sided
 * deflector, the clamp and mast envelopes and their exact stations, and the 35 cm the nozzle
 * exits stand above the deck. The eight Heavy clamps are split two on the centre core (the
 * Falcon 9 north/south pair) and three on each side core (north, south and outboard): the
 * total is cited, the split is an assumption.
 *
 * @param {object} o
 * @param {number} o.deck      height of the deck top above the apron
 * @param {number} o.halfX     half extent of the block along x (m)
 * @param {number} o.halfZ     half extent along z; the exhaust tunnel runs along z
 * @param {number} o.tunnelHalf half width of the exhaust tunnel (x)
 * @param {number} o.tunnelH   clear height of the tunnel
 * @param {{hx:number,hz:number}} o.opening  engine opening through the deck, a rounded slot
 * @param {Array} o.cores      [{ x, z, r, seatY, clamps: [azimuth], tsm: [azimuth] }] — seatY is
 *                             the height of the vehicle's bearing surface above the deck
 */
export function buildLaunchMount(M, {
  deck = 6.5, halfX = 6.5, halfZ = 6.5, tunnelHalf = 2.6, tunnelH = 4.2,
  opening = { hx: 1.95, hz: 1.95 }, cores = [], stairs = true,
} = {}) {
  const g = new THREE.Group();
  g.name = 'launch-mount';
  const plate = 0.3;                       // steel deck plate on the concrete
  const roofBottom = tunnelH;
  const concrete = M.concrete ?? M.plinth ?? M.mount, steel = M.mount, dark = M.darkMetal ?? M.mount;
  const block = (x0, x1, y0, y1, z0, z1) => ({
    geometry: new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
    matrix: mat4([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]),
  });

  // Side walls of the flame tunnel: solid concrete from the apron to the roof slab.
  const walls = [];
  for (const s of [-1, 1]) walls.push(block(s * tunnelHalf, s * halfX, 0, deck - plate, -halfZ, halfZ));
  g.add(mesh(boxUV(mergeAll(walls)), concrete, { name: 'launch-mount-walls' }));

  // Roof slab over the tunnel and the steel deck plate, both pierced by the engine opening.
  const slot = (hx, hz) => {
    const p = new THREE.Path(), rr = Math.min(hx, hz);
    p.absarc(hx - rr, hz - rr, rr, 0, Math.PI / 2, false);
    p.absarc(-hx + rr, hz - rr, rr, Math.PI / 2, Math.PI, false);
    p.absarc(-hx + rr, -hz + rr, rr, Math.PI, Math.PI * 1.5, false);
    p.absarc(hx - rr, -hz + rr, rr, Math.PI * 1.5, Math.PI * 2, false);
    return p;
  };
  const slab = (x0, x1, z0, z1, y0, y1, material, name) => {
    const sh = new THREE.Shape();
    sh.moveTo(x0, z0); sh.lineTo(x1, z0); sh.lineTo(x1, z1); sh.lineTo(x0, z1); sh.closePath();
    const hole = slot(opening.hx, opening.hz);
    sh.holes.push(new THREE.Path(hole.getPoints(24).reverse()));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(Math.PI / 2);              // shape (x, y) → world (x, z); extrusion runs down
    geo.translate(0, y1, 0);
    g.add(mesh(boxUV(geo), material, { name }));
  };
  slab(-tunnelHalf, tunnelHalf, -halfZ, halfZ, roofBottom, deck - plate, concrete, 'launch-mount-roof');
  slab(-halfX, halfX, -halfZ, halfZ, deck - plate, deck, steel, 'launch-mount-deck');

  // Flame deflector: a steel ridge under the opening that turns the exhaust both ways down the
  // tunnel, out of the two open ends. Built as a profile in (z, y) run along x.
  {
    const sh = new THREE.Shape(), peak = tunnelH * 0.72, n = 16;
    sh.moveTo(-halfZ, 0);
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = -halfZ + t * 2 * halfZ;
      const k = 1 - Math.abs(z) / halfZ;
      sh.lineTo(z, 0.06 + (peak - 0.06) * Math.pow(k, 1.8));
    }
    sh.lineTo(halfZ, 0); sh.closePath();
    const w = tunnelHalf * 2 - 0.02;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 8 });
    geo.rotateY(Math.PI / 2);                // shape x → world −z, extrusion → world +x
    geo.translate(-w / 2, 0, 0);
    g.add(mesh(boxUV(geo), steel, { name: 'flame-deflector' }));
  }

  // Hold-down clamps and tail service masts, per core.
  const clampParts = [], clampJaws = [], tsmParts = [], hoses = [];
  for (const c of cores) {
    const top = deck + c.seatY;              // the vehicle's bearing surface
    for (const az of c.clamps ?? []) {
      const place = (m) => new THREE.Matrix4().compose(
        new THREE.Vector3(c.x, 0, c.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), az),
        new THREE.Vector3(1, 1, 1)).multiply(m);
      // In the clamp frame +z points out from the core axis.
      const r = c.r;
      const ped = (x0, x1, y0, y1, z0, z1) => { const b = block(x0, x1, y0, y1, z0, z1); b.matrix = place(b.matrix); return b; };
      const k = c.scale ?? 1;                  // Falcon 1's clamps are a scaled-down set
      clampParts.push(ped(-0.55 * k, 0.55 * k, deck, deck + 0.16 * k, r + 0.05 * k, r + 1.35 * k));            // base plate
      clampParts.push(ped(-0.36 * k, 0.36 * k, deck + 0.16 * k, top - 0.34 * k, r + 0.18 * k, r + 0.95 * k));  // pedestal
      clampJaws.push(ped(-0.30 * k, 0.30 * k, top - 0.34 * k, top, r - 0.26 * k, r + 0.95 * k));               // seat under the base
      clampJaws.push(ped(-0.30 * k, 0.30 * k, top, top + 0.42 * k, r + 0.04 * k, r + 0.30 * k));               // retaining finger
      clampJaws.push(ped(-0.34 * k, 0.34 * k, top + 0.30 * k, top + 0.46 * k, r - 0.02 * k, r + 0.34 * k));    // finger head
      // Release actuator: a hydraulic cylinder from the base plate to the back of the jaw.
      const a = new THREE.Vector3(0, deck + 0.2 * k, r + 1.28 * k), b = new THREE.Vector3(0, top - 0.2 * k, r + 0.98 * k);
      const d = b.clone().sub(a);
      const cyl = new THREE.CylinderGeometry(0.09 * k, 0.09 * k, d.length(), 12);
      const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
      clampJaws.push({ geometry: cyl, matrix: place(m) });
    }
    for (const az of c.tsm ?? []) {
      const place = (m) => new THREE.Matrix4().compose(
        new THREE.Vector3(c.x, 0, c.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), az),
        new THREE.Vector3(1, 1, 1)).multiply(m);
      const r = c.r, rOut = r + 1.45, h = top + 2.4;
      const b = (x0, x1, y0, y1, z0, z1) => { const q = block(x0, x1, y0, y1, z0, z1); q.matrix = place(q.matrix); return q; };
      tsmParts.push(b(-0.62, 0.62, deck, deck + 0.9, rOut - 0.55, rOut + 0.62));            // valve housing
      tsmParts.push(b(-0.40, 0.40, deck + 0.9, h, rOut - 0.4, rOut + 0.4));                 // mast
      for (const y of [deck + 1.9, top + 0.3, h - 0.5]) tsmParts.push(b(-0.44, 0.44, y, y + 0.08, rOut - 0.44, rOut + 0.44));
      tsmParts.push(b(-0.5, 0.5, h, h + 0.12, rOut - 0.62, rOut + 0.5));                    // hood

      tsmParts.push(b(-0.28, 0.28, top + 0.55, top + 1.35, r + 0.03, r + 0.16));            // umbilical plate on the skin
      tsmParts.push(b(-0.18, 0.18, top + 0.75, top + 1.15, r + 0.16, rOut - 0.4));          // carrier arm
      for (const [x, y] of [[-0.2, top + 1.55], [0.2, top + 1.7]]) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, y, rOut - 0.4), new THREE.Vector3(x * 0.8, y - 0.1, (r + rOut) / 2 + 0.2),
          new THREE.Vector3(x * 0.6, top + 1.2, r + 0.22)]);
        hoses.push({ geometry: new THREE.TubeGeometry(curve, 16, 0.07, 8, false), matrix: place(new THREE.Matrix4()) });
      }
    }
  }
  if (clampParts.length) g.add(mesh(boxUV(mergeAll(clampParts)), steel, { name: 'holddown-pedestals' }));
  if (clampJaws.length) g.add(mesh(boxUV(mergeAll(clampJaws)), dark, { name: 'holddown-clamps' }));
  if (tsmParts.length) g.add(mesh(boxUV(mergeAll(tsmParts)), M.pipePaint ?? steel, { name: 'tail-service-masts' }));
  if (hoses.length) g.add(mesh(mergeAll(hoses), M.blackMatte ?? dark, { name: 'tsm-umbilical-hoses', castShadow: false }));

  // Guard rail round the deck edge.
  const rail = [];
  const postsAlong = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      rail.push(block(x - 0.03, x + 0.03, deck, deck + 1.1, z - 0.03, z + 0.03));
    }
    for (const y of [deck + 0.55, deck + 1.07]) {
      rail.push(block(Math.min(x0, x1) - 0.03, Math.max(x0, x1) + 0.03, y, y + 0.05, Math.min(z0, z1) - 0.03, Math.max(z0, z1) + 0.03));
    }
    rail.push(block(Math.min(x0, x1) - 0.02, Math.max(x0, x1) + 0.02, deck, deck + 0.12, Math.min(z0, z1) - 0.02, Math.max(z0, z1) + 0.02));
  };
  const ex = halfX - 0.15, ez = halfZ - 0.15;
  postsAlong(-ex, ez, ex, ez); postsAlong(-ex, -ez, ex, -ez);
  postsAlong(-ex, -ez, -ex, ez);
  // The +x side is left open at the stair head.
  postsAlong(ex, -ez, ex, stairs ? ez - 2.4 : ez);
  // Stair up the +x face: straight flight, stringers, treads and a handrail. Reconstructed.
  if (stairs && deck > 1.2) {
    const run = deck * 1.25, w = 1.1, x0 = halfX, zTop = ez - 1.25, zBot = zTop - run;
    const steps = Math.round(deck / 0.18), treads = [];
    for (let i = 0; i < steps; i++) {
      const y = (i + 1) * (deck / steps), z = zBot + (i + 1) * (run / steps);
      treads.push(block(x0 + 0.05, x0 + 0.05 + w, y - 0.04, y, z - run / steps, z));
    }
    g.add(mesh(boxUV(mergeAll(treads)), M.steelGrating ?? steel, { name: 'mount-stair-treads' }));
    const slope = Math.atan2(deck, run), len = Math.hypot(deck, run);
    for (const sx of [x0 + 0.02, x0 + 0.08 + w]) {
      rail.push({ geometry: new THREE.BoxGeometry(0.06, 0.3, len), matrix: mat4([sx, deck / 2 - 0.1, (zBot + zTop) / 2], [-slope, 0, 0]) });
      rail.push({ geometry: new THREE.BoxGeometry(0.05, 0.05, len), matrix: mat4([sx, deck / 2 + 0.95, (zBot + zTop) / 2], [-slope, 0, 0]) });
    }
    rail.push(block(x0 + 0.05, x0 + 0.05 + w, deck - plate, deck, zTop, zTop + 1.1));   // landing
  }
  g.add(mesh(boxUV(mergeAll(rail)), steel, { name: 'launch-mount-rail', castShadow: false }));
  g.userData.plan = { halfX, halfZ };
  return g;
}

export function buildPedestal(M, { radius = 1.2, height = 1.2, post = 0 } = {}) {
  const g = new THREE.Group();
  g.name = 'pedestal';
  // Museum plinth: a drum standing on a recessed kick (the shadow gap is what lifts it off the
  // apron), a brushed band round the top edge, and a matte deck for the exhibit to stand on.
  const kick = Math.min(0.08, height * 0.12), band = Math.min(0.05, height * 0.08);
  const plinth = M.plinth ?? M.mount, deck = M.plinthDeck ?? M.mount, trim = M.aluminum ?? M.mount;
  const foot = new THREE.CylinderGeometry(radius - 0.05, radius - 0.05, kick, 64);
  foot.translate(0, kick / 2, 0);
  g.add(mesh(foot, M.boot ?? plinth, { name: 'pedestal-kick' }));
  const drum = new THREE.CylinderGeometry(radius, radius, height - kick - band, 64, 1, true);
  drum.translate(0, kick + (height - kick - band) / 2, 0);
  g.add(mesh(drum, plinth, { name: 'pedestal-drum' }));
  const ring = new THREE.CylinderGeometry(radius + 0.004, radius + 0.004, band, 64, 1, true);
  ring.translate(0, height - band / 2, 0);
  g.add(mesh(ring, trim, { name: 'pedestal-band' }));
  const under = new THREE.CircleGeometry(radius, 64);
  under.rotateX(Math.PI / 2);
  under.translate(0, kick, 0);
  g.add(mesh(under, plinth, { castShadow: false }));
  const top = new THREE.CircleGeometry(radius + 0.004, 64);
  top.rotateX(-Math.PI / 2);
  top.translate(0, height, 0);
  g.add(mesh(top, deck, { name: 'pedestal-deck' }));
  if (post > 0) {
    const p = new THREE.CylinderGeometry(0.18, 0.22, post, 24);
    p.translate(0, height + post / 2, 0);
    g.add(mesh(p, plinth));
  }
  return g;
}

/**
 * 1.80 m person from standard anthropometric proportions.
 * A visitor in light coveralls, or a technician in a hard hat. Scale furniture,
 * not a scanned actor: boxes and cylinders, with a head, neck, elbows and knees
 * so the silhouette is a person rather than two capsules.
 */
/**
 * The parts of one figure, in its own frame, grouped by the material each takes.
 *
 * Split out of `buildHuman` so a whole crowd can be merged per material instead of per
 * figure — see `buildHumanCrowd`. The geometry is identical either way; only the number of
 * draw calls differs.
 */
/** A capsule of radius r from a to b, as a merge item. */
function limb(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), len = d.length();
  const geometry = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, 8);
  const m = new THREE.Matrix4().compose(
    A.add(B).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
    new THREE.Vector3(1, 1, 1));
  return { geometry, matrix: m };
}

function humanParts(M, suit) {
  const cloth = suit === 'white' ? M.visitor : M.coverall;
  // Rounded forms on the same 1.80 m frame: a lathed torso flattened front to back, capsule
  // limbs jointed at the knee and elbow, a slightly long head on a neck. Boxes and straight
  // cylinders read as a mannequin kit next to vehicles modelled to the centimetre.
  const torso = new THREE.LatheGeometry([
    [0.001, 0.86], [0.150, 0.87], [0.158, 0.94], [0.140, 1.06], [0.160, 1.22],
    [0.185, 1.36], [0.170, 1.44], [0.090, 1.49], [0.001, 1.50],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  torso.scale(1, 1, 0.62);
  const body = [{ geometry: torso, matrix: new THREE.Matrix4() }];
  for (const s of [-1, 1]) {
    body.push(limb([0.20 * s, 1.41, 0], [0.24 * s, 1.14, 0.02], 0.044));   // upper arm
    body.push(limb([0.24 * s, 1.14, 0.02], [0.25 * s, 0.90, 0.07], 0.037)); // forearm
  }
  const legs = [];
  for (const s of [-1, 1]) {
    legs.push(limb([0.085 * s, 0.90, 0], [0.090 * s, 0.50, 0.01], 0.064)); // thigh
    legs.push(limb([0.090 * s, 0.50, 0.01], [0.090 * s, 0.12, -0.01], 0.048)); // shin
  }
  const boots = [];
  for (const s of [-1, 1]) {
    const boot = new THREE.CapsuleGeometry(0.048, 0.14, 3, 8);
    boot.rotateX(Math.PI / 2);
    boot.scale(1.05, 0.75, 1);
    boots.push({ geometry: boot, matrix: mat4([0.09 * s, 0.045, 0.035]) });
  }
  const head = [];
  head.push({ geometry: new THREE.CylinderGeometry(0.042, 0.048, 0.10, 10), matrix: mat4([0, 1.54, 0]) });
  const skull = new THREE.SphereGeometry(0.092, 16, 12);
  skull.scale(0.92, 1.12, 1.0);
  head.push({ geometry: skull, matrix: mat4([0, 1.68, 0.005]) });
  for (const s of [-1, 1]) head.push({ geometry: new THREE.SphereGeometry(0.040, 10, 8), matrix: mat4([0.255 * s, 0.86, 0.08]) });
  const out = [
    [cloth, [...body, ...legs]],
    [M.boot, boots],
    [M.skin, head],
  ];
  if (suit !== 'white') {
    const hat = new THREE.SphereGeometry(0.108, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    hat.scale(1, 0.85, 1.1);
    const brim = new THREE.CylinderGeometry(0.125, 0.125, 0.008, 18);
    out.push([M.hardhat, [{ geometry: hat, matrix: mat4([0, 1.745, 0.005]) }, { geometry: brim, matrix: mat4([0, 1.745, 0.012]) }]]);
  }
  return out;
}

export function buildHuman(M, { suit = 'white' } = {}) {
  const g = new THREE.Group();
  g.name = 'human';
  for (const [material, parts] of humanParts(M, suit)) {
    g.add(mesh(mergeAll(parts), material, { castShadow: false }));
  }
  return g;
}

/**
 * Every scale figure in the centre, as one mesh per material instead of five per person.
 *
 * The figures were the worst cost-per-look in the scene: twenty-two people, four or five
 * meshes each, 99 draw calls in the overview for 13,286 triangles — more calls than the
 * Starship, the pad and the Roadster together, for a row of 1.80 m boxes. They are also the
 * easiest thing in the scene to merge: they never move, they never change material, and they
 * already cast no shadow, so nothing about how they look depends on their being separate.
 *
 * Each person's placement is baked into the geometry, so the result is the same picture from
 * the same place — verified by pixel diff, not by argument. The group keeps its name and its
 * visibility flag, so the "1.80 m figures" toggle is untouched.
 *
 * @param placements [{ x, y, z, ry, suit }]
 */
export function buildHumanCrowd(M, placements) {
  const g = new THREE.Group();
  g.name = 'human-crowd';
  // Keyed by material identity: two suits, boots, skin and hard hats come out as at most five
  // meshes however many people there are.
  const byMaterial = new Map();
  for (const p of placements) {
    const place = mat4([p.x, p.y, p.z], [0, p.ry ?? 0, 0]);
    for (const [material, parts] of humanParts(M, p.suit ?? 'white')) {
      if (!byMaterial.has(material)) byMaterial.set(material, []);
      const into = byMaterial.get(material);
      for (const part of parts) {
        into.push({
          geometry: part.geometry,
          // Compose in world order: the part's own matrix first, then where the person stands.
          matrix: new THREE.Matrix4().multiplyMatrices(place, part.matrix),
        });
      }
    }
  }
  for (const [material, parts] of byMaterial) {
    if (parts.length) g.add(mesh(mergeAll(parts), material, { castShadow: false, name: 'human-batch' }));
  }
  return g;
}
