/**
 * Shared props: the Falcon launch mounts, display pedestals and 1.80 m human figures for scale.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, boxUV } from '../geometry/utils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
 * 1.80 m people from standard anthropometric proportions: visitors in everyday clothes and
 * pad technicians in coveralls and hard hats. Scale furniture, not scanned actors — but not
 * mannequins either. They used to be one pose in two colours, arms held off the body, hands
 * as balls, and no shadow, so they sat on the ground like cut-outs. Now each has a pose (arms
 * at rest, hands in pockets, hands behind the back looking up, or pointing up at the vehicle),
 * a head with a nose, ears and hair, clothes, skin and hair drawn from small palettes by a
 * seeded hash of where the person stands, and a shadow cast along the real sun direction.
 */
/** A capsule of radius r from a to b, as a merge item. */
function limb(a, b, r, seg = 7) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), len = d.length();
  const geometry = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, seg);
  const m = new THREE.Matrix4().compose(
    A.add(B).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
    new THREE.Vector3(1, 1, 1));
  return { geometry, matrix: m };
}

const hex = (h) => new THREE.Color(h);
const PALETTE = {
  top: [0x2c3e5c, 0xe6e4df, 0x8a8d91, 0x9c3b35, 0x5d6448, 0x232427, 0x7c9cc4, 0xc9b79a].map(hex),
  trousers: [0x3a4a66, 0xa89a7a, 0x2a2b2e, 0x5b5e63, 0x34405a].map(hex),
  coverall: [0x2b3340, 0x3d4a40, 0x2a2a2c].map(hex),
  skin: [0xf1c9a5, 0xe0ac86, 0xc68a64, 0x8d5a3b, 0x5c3a24].map(hex),
  hair: [0x1d1a17, 0x3b2a1e, 0x6b4a2e, 0xa98b5f, 0x8f8f8f].map(hex),
};
const POSES = ['rest', 'pockets', 'up', 'point'];

/** Arms (shoulder → elbow → wrist → knuckles) and head tilt for a pose, left and right. */
function poseArms(pose, s) {
  if (pose === 'pockets') return { e: [0.225 * s, 1.14, -0.02], w: [0.175 * s, 0.94, 0.065], h: [0.16 * s, 0.9, 0.07], tilt: 0 };
  if (pose === 'up') return { e: [0.21 * s, 1.14, -0.075], w: [0.1 * s, 0.98, -0.15], h: [0.05 * s, 0.965, -0.16], tilt: 0.38 };
  if (pose === 'point' && s > 0) return { e: [0.24, 1.49, 0.2], w: [0.265, 1.6, 0.42], h: [0.272, 1.635, 0.5], tilt: 0.32 };
  if (pose === 'point') return { e: [-0.215, 1.13, -0.01], w: [-0.225, 0.885, 0.035], h: [-0.228, 0.8, 0.045], tilt: 0.32 };
  return { e: [0.215 * s, 1.13, -0.01], w: [0.225 * s, 0.885, 0.035], h: [0.228 * s, 0.8, 0.045], tilt: 0 };
}

/**
 * The parts of one figure, in its own frame (+z forward), each tagged with the layer (the
 * material) it belongs to and its colour. `look` picks the palette entries and the pose.
 */
function humanParts(suit, look) {
  const pick = (list, k) => list[Math.floor(look[k] * list.length) % list.length];
  const tech = suit !== 'white';
  const top = tech ? pick(PALETTE.coverall, 0) : pick(PALETTE.top, 0);
  const legs = tech ? top : pick(PALETTE.trousers, 1);
  const skin = pick(PALETTE.skin, 2), hair = pick(PALETTE.hair, 3);
  const pose = POSES[Math.floor(look[4] * POSES.length) % POSES.length];
  const parts = [];
  const add = (layer, color, item) => parts.push({ layer, color, ...item });

  // Torso and hips in one lathe, flattened front to back; coloured by height below.
  const torso = new THREE.LatheGeometry([
    [0.001, 0.84], [0.150, 0.85], [0.165, 0.92], [0.160, 0.98], [0.140, 1.06], [0.150, 1.16],
    [0.172, 1.28], [0.188, 1.38], [0.170, 1.44], [0.100, 1.485], [0.001, 1.50],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  torso.scale(1, 1, 0.62);
  parts.push({ layer: 'cloth', color: (y) => (y > 0.955 ? top : legs), geometry: torso, matrix: new THREE.Matrix4() });

  const head = [];
  for (const s of [-1, 1]) {
    const arm = poseArms(pose, s);
    const sh = [0.19 * s, 1.395, 0];
    add('cloth', top, { geometry: new THREE.SphereGeometry(0.058, 8, 6), matrix: mat4(sh) });
    add('cloth', top, limb(sh, arm.e, 0.046));
    add('cloth', top, limb(arm.e, arm.w, 0.039));
    const hand = limb(arm.w, arm.h, 0.03, 6);
    hand.geometry.scale(0.78, 1, 1);
    add('skin', skin, hand);
    add('cloth', legs, limb([0.088 * s, 0.9, 0], [0.092 * s, 0.49, 0.012], 0.066));
    add('cloth', legs, limb([0.092 * s, 0.49, 0.012], [0.092 * s, 0.11, -0.005], 0.05));
    const shoe = new THREE.CapsuleGeometry(0.046, 0.17, 3, 8);
    shoe.rotateX(Math.PI / 2);
    shoe.scale(1.0, 0.78, 1);
    add('boot', null, { geometry: shoe, matrix: mat4([0.092 * s, 0.046, 0.05]) });
    head.push({ layer: 'skin', color: skin, geometry: new THREE.SphereGeometry(0.022, 8, 6), matrix: mat4([0.086 * s, 1.67, -0.002]) });
  }
  const tilt = poseArms(pose, 1).tilt;
  head.push({ layer: 'skin', color: skin, geometry: new THREE.CylinderGeometry(0.044, 0.05, 0.10, 10), matrix: mat4([0, 1.535, 0]) });
  const skull = new THREE.SphereGeometry(0.092, 14, 10);
  skull.scale(0.9, 1.12, 1.0);
  head.push({ layer: 'skin', color: skin, geometry: skull, matrix: mat4([0, 1.675, 0.008]) });
  head.push({ layer: 'skin', color: skin, geometry: new THREE.SphereGeometry(0.017, 8, 6), matrix: mat4([0, 1.655, 0.097]) });
  if (tech) {
    const hat = new THREE.SphereGeometry(0.108, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    hat.scale(1, 0.85, 1.1);
    head.push({ layer: 'hat', color: null, geometry: hat, matrix: mat4([0, 1.745, 0.005]) });
    head.push({ layer: 'hat', color: null, geometry: new THREE.CylinderGeometry(0.125, 0.125, 0.008, 20), matrix: mat4([0, 1.745, 0.012]) });
  } else {
    const cap = new THREE.SphereGeometry(0.097, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.56);
    cap.scale(0.93, 1.1, 1.04);
    head.push({ layer: 'hair', color: hair, geometry: cap, matrix: mat4([0, 1.69, -0.004], [-0.28, 0, 0]) });
  }
  // Looking up: the head turns back about the top of the neck.
  const pivot = new THREE.Matrix4().makeTranslation(0, 1.53, 0)
    .multiply(new THREE.Matrix4().makeRotationX(-tilt))
    .multiply(new THREE.Matrix4().makeTranslation(0, -1.53, 0));
  for (const h of head) parts.push({ ...h, matrix: new THREE.Matrix4().multiplyMatrices(pivot, h.matrix) });
  return parts;
}

/** Transforms each part into place, colours it, carries extra per-vertex attributes, merges. */
function mergeParts(items, extra = {}) {
  const geos = items.map((it) => {
    let g = it.geometry.clone();
    g.applyMatrix4(it.matrix);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    const n = g.attributes.position.count;
    if (it.color !== undefined) {
      const col = new Float32Array(n * 3), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        c.copy(typeof it.color === 'function' ? it.color(it.localY[i]) : (it.color ?? new THREE.Color(1, 1, 1)));
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    for (const [name, [size, value]] of Object.entries(extra)) {
      const v = typeof value === 'function' ? value(it) : value;
      const a = new Float32Array(n * size);
      for (let i = 0; i < n; i++) a.set(v, i * size);
      g.setAttribute(name, new THREE.BufferAttribute(a, size));
    }
    g.clearGroups();
    return g;
  });
  return mergeGeometries(geos, false);
}

let _crowdMats = null;
function crowdMaterials(M) {
  return (_crowdMats ??= {
    cloth: new THREE.MeshStandardMaterial({ name: 'crowd-cloth', vertexColors: true, roughness: 0.86 }),
    skin: new THREE.MeshStandardMaterial({ name: 'crowd-skin', vertexColors: true, roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ name: 'crowd-hair', vertexColors: true, roughness: 0.92 }),
    boot: M.boot,
    hat: M.hardhat,
  });
}

/**
 * A shadow for the whole crowd in one draw: every figure's geometry again, flattened in the
 * vertex shader onto the ground it stands on along the live sun direction, in a translucent
 * dark tint. The figures stay out of the shadow map (they are small, many, and the map's texel
 * is larger than a forearm), but without any shadow they floated. A stencil marks each pixel
 * the first time a shadow covers it, so where limbs and bodies overlap it is not darkened twice.
 * `aClip` bounds a shadow to the deck a person stands on.
 */
function crowdShadowMaterial(sunDir) {
  const mat = new THREE.MeshBasicMaterial({
    name: 'crowd-shadow', color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSun = { value: sunDir };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGround;\nattribute vec4 aClip;\nuniform vec3 uSun;\nvarying vec2 vShXZ;\nvarying vec4 vClip;')
      .replace('#include <project_vertex>', `
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vec3 sd = normalize(uSun);
        float up = max(sd.y, 0.08);
        wp.xyz -= sd * ((wp.y - aGround) / up);
        wp.y = aGround + 0.035;   // the apron paving stands 12 mm proud of grade
        vShXZ = wp.xz; vClip = aClip;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vShXZ;\nvarying vec4 vClip;')
      .replace('void main() {', 'void main() {\n  if (vShXZ.x < vClip.x || vShXZ.x > vClip.y || vShXZ.y < vClip.z || vShXZ.y > vClip.w) discard;');
  };
  return mat;
}

/** One figure on its own (kept for tools and one-offs); the centre uses `buildHumanCrowd`. */
export function buildHuman(M, { suit = 'white' } = {}) {
  return buildHumanCrowd(M, [{ x: 0, y: 0, z: 0, suit }]);
}

/**
 * Every scale figure in the centre, as one mesh per material instead of five per person.
 *
 * The figures were the worst cost-per-look in the scene: twenty-two people, four or five
 * meshes each, 99 draw calls in the overview for 13,286 triangles — more calls than the
 * Starship, the pad and the Roadster together, for a row of 1.80 m boxes. They are also the
 * easiest thing in the scene to merge: they never move, they never change material, and they
 * cast no shadow into the shadow map, so nothing about how they look depends on their being
 * separate. Clothes, skin and hair carry per-vertex colour, so variety costs no extra meshes:
 * cloth, skin, hair, shoes, hard hats and the crowd's shadow come out as six.
 *
 * @param placements [{ x, y, z, ry, suit, clip?: [xmin, xmax, zmin, zmax] }]
 * @param opts.sunDir live world-space direction to the sun (the shadow follows it)
 */
export function buildHumanCrowd(M, placements, { sunDir = new THREE.Vector3(0.5, 0.6, 0.3) } = {}) {
  const g = new THREE.Group();
  g.name = 'human-crowd';
  const mats = crowdMaterials(M);
  const byLayer = new Map(), shadow = [];
  const frac = (v) => v - Math.floor(v);
  const INF = 1e6;
  placements.forEach((p, idx) => {
    // A seeded look per person, from where they stand: stable across builds and reorderings.
    const h = (k) => frac(Math.sin((p.x * 12.9898 + p.z * 78.233 + k * 37.719 + idx * 0.013) * 43758.5453));
    const look = [h(1), h(2), h(3), h(4), h(5)];
    const place = mat4([p.x, p.y, p.z], [0, p.ry ?? 0, 0]);
    for (const part of humanParts(p.suit ?? 'white', look)) {
      const item = { ...part, matrix: new THREE.Matrix4().multiplyMatrices(place, part.matrix) };
      // Colour by height needs each vertex's own height before placing.
      if (typeof part.color === 'function') {
        const pos = part.geometry.index ? part.geometry.toNonIndexed().attributes.position : part.geometry.attributes.position;
        const ly = new Float32Array(pos.count), v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) ly[i] = v.fromBufferAttribute(pos, i).applyMatrix4(part.matrix).y;
        item.localY = ly;
      }
      if (!byLayer.has(part.layer)) byLayer.set(part.layer, []);
      byLayer.get(part.layer).push(item);
      shadow.push({ geometry: part.geometry, matrix: item.matrix, ground: p.y, clip: p.clip ?? [-INF, INF, -INF, INF] });
    }
  });
  for (const [layer, items] of byLayer) {
    const colored = layer === 'cloth' || layer === 'skin' || layer === 'hair';
    const geo = mergeParts(colored ? items : items.map(({ color, ...rest }) => rest));
    g.add(mesh(geo, mats[layer], { castShadow: false, name: 'human-batch' }));
  }
  const sh = mergeParts(shadow, { aGround: [1, (it) => [it.ground]], aClip: [4, (it) => it.clip] });
  g.add(mesh(sh, crowdShadowMaterial(sunDir), { castShadow: false, receiveShadow: false, name: 'human-shadow' }));
  return g;
}
