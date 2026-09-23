/**
 * Shared props: display mounts, pedestals and 1.80 m human figures for scale.
 * Mounts are presentation furniture (not to scale with any SpaceX ground equipment).
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, boxUV } from '../geometry/utils.js';

export function buildMount(M, { radius = 8, inner = 4.6, height = 8, legs = 6, clampRadius = 4.5, clamps = 4 } = {}) {
  const g = new THREE.Group();
  g.name = 'mount';
  const ring = new THREE.Shape();
  ring.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  ring.holes.push(hole);
  const deck = new THREE.ExtrudeGeometry(ring, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 64 });
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, height - 1.2, 0);
  g.add(mesh(deck, M.plinth ?? M.mount, { name: 'mount-deck' }));
  // Legs
  const legParts = [];
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + Math.PI / legs;
    const r = (radius + inner) / 2;
    legParts.push({ geometry: new THREE.BoxGeometry(1.4, height - 1.2, 1.4), matrix: mat4([Math.sin(a) * r, (height - 1.2) / 2, Math.cos(a) * r], [0, a, 0]) });
    legParts.push({ geometry: new THREE.BoxGeometry(2.2, 0.3, 2.2), matrix: mat4([Math.sin(a) * r, 0.15, Math.cos(a) * r], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(legParts), M.plinth ?? M.mount));
  // Hold-down clamps at the vehicle skirt
  const clampParts = [];
  for (let i = 0; i < clamps; i++) {
    const a = (i / clamps) * Math.PI * 2 + Math.PI / clamps;
    clampParts.push({ geometry: new THREE.BoxGeometry(0.66, 0.62, 0.46), matrix: mat4([Math.sin(a) * (clampRadius + 0.26), height + 0.31, Math.cos(a) * (clampRadius + 0.26)], [0, a, 0]) });
  }
  // Dark steel, not ochre: four 66 cm yellow blocks round the base were the brightest thing
  // in every view from under a Falcon, and nothing about museum furniture asks for them.
  if (clampParts.length) g.add(mesh(boxUV(mergeAll(clampParts)), M.darkMetal, { name: 'mount-clamps' }));
  // Safety rail
  const rail = new THREE.TorusGeometry(radius - 0.3, 0.05, 6, 96);
  rail.rotateX(Math.PI / 2);
  rail.translate(0, height + 1.1, 0);
  g.add(mesh(rail, M.mount, { castShadow: false }));
  const posts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    posts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), matrix: mat4([Math.sin(a) * (radius - 0.3), height + 0.55, Math.cos(a) * (radius - 0.3)]) });
  }
  g.add(mesh(mergeAll(posts), M.mount, { castShadow: false }));
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
