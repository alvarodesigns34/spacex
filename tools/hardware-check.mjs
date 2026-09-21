/** Physical hardware gate, without a browser, canvas or GPU. Node 22.15+.
 * Checks built geometry and scene nodes, not builder metadata. Mutations must fail.
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });
const T = await import('three');
const { buildFalcon9, buildFalconHeavy } = await import('../src/vehicles/falcon.js');
const { buildFalcon1 } = await import('../src/vehicles/falcon1.js');
const { buildLaunchComplex } = await import('../src/vehicles/pad.js');
const { buildSuperHeavy } = await import('../src/vehicles/starship.js');
const material = new T.MeshStandardMaterial();
const M = new Proxy({}, { get: () => material });
const f1 = buildFalcon1(M), f9 = buildFalcon9(M), fh = buildFalconHeavy(M), pad = buildLaunchComplex(M), booster = buildSuperHeavy(M);
const mutant = process.argv.find(a => a.startsWith('--mutant='))?.split('=')[1];
const sides = fh.children.filter(o => o.name === 'falcon-core-fh-side');
const paths = fh.getObjectByName('fh-attach-struts');
const actuators = []; booster.traverse(o => { if (o.name === 'grid-fin-internal-actuator') actuators.push(o); });
const lattices = []; booster.traverse(o => { if (o.name === 'grid-fin-lattice') lattices.push(o); });
const pins = []; booster.traverse(o => { if (o.name === 'catch-pin') pins.push(o); });
// Deliberately alter real geometry/transforms/nodes after construction: changing a metadata
// count cannot make these tests pass when the model a visitor sees is wrong.
if (mutant === 'raceway') sides[0].rotation.y *= -1;
if (mutant === 'rod') paths.geometry.translate(0, 0, 2);
if (mutant === 'pusher') { const p = f9.getObjectByName('stage-pusher-center'); p.parent.remove(p); }
if (mutant === 'qd') pad.getObjectByName('booster-qd-methane').position.x -= 40;
if (mutant === 'actuator') actuators[0].position.x += 10;
if (mutant === 'lod-path') paths.userData.lodFeature = 0.14;
if (mutant === 'lod-side') delete sides[0].getObjectByName('base-bottles').userData.lodFeature;
if (mutant === 'f1-fairing') f1.getObjectByName('falcon1-fairing').scale.y = 0.8;
if (mutant === 'f1-engine') f1.getObjectByName('falcon1-merlin1c-turbopump').removeFromParent();
for (const root of [f1, f9, fh, pad, booster]) root.updateMatrixWorld(true);
const world = o => o.getWorldPosition(new T.Vector3());
const bounds = o => new T.Box3().setFromObject(o);
const finite = p => p.toArray().every(Number.isFinite);

const f1Fairing = f1.getObjectByName('falcon1-fairing'), f1FairingBox = bounds(f1Fairing);
assert.ok(Math.abs(f1FairingBox.max.y - f1FairingBox.min.y - 3.5) < 0.002, 'Falcon 1 fairing is the published 3.50 m');
assert.ok(Math.abs(Math.max(Math.abs(f1FairingBox.min.x), Math.abs(f1FairingBox.max.x)) - 0.77) < 0.002,
  'Falcon 1 fairing is the published 1.54 m diameter');
assert.equal(f1.children.filter(o => o.name === 'falcon1-fairing-frame').length, 2, 'Falcon 1 has both biconic break frames');
assert.equal(f1.getObjectByName('falcon1-closed-shell').children.filter(o => o.name === 'falcon1-upper-stage-rcs').length, 4,
  'Falcon 1 RCS stays attached to the hidden shell in cutaway');
assert.ok(f1.getObjectByName('falcon1-cutaway-rear-shell')?.isMesh, 'Falcon 1 cutaway retains airframe context');
assert.ok(f1.getObjectByName('falcon1-cutaway-interstage-shell')?.isMesh, 'Falcon 1 cutaway retains interstage context');
assert.equal(f1.getObjectsByProperty('name', 'falcon1-kestrel-thrust-frame').length, 6, 'Falcon 1 has a six-member Kestrel thrust frame');
for (const name of ['falcon1-merlin1c-turbopump', 'falcon1-merlin1c-gas-generator',
  'falcon1-merlin1c-turbine-exhaust', 'falcon1-merlin1c-thrust-ring']) {
  assert.ok(f1.getObjectByName(name), `Falcon 1 engine carries ${name}`);
}

for (const root of [f9, fh]) {
  const core = root.children.find(o => o.name === 'falcon-core-f9' || o.name === 'falcon-core-fh-center');
  const pushers = core.getObjectByName('stage-separation-pushers');
  const latches = core.getObjectByName('stage-separation-latches');
  assert.equal(pushers.children.filter(o => o.isMesh).length, 4, 'four actual stage pusher meshes');
  assert.equal(latches.children.filter(o => o.isMesh).length, 3, 'three actual latch meshes');
  const center = core.getObjectByName('stage-pusher-center');
  assert.ok(center?.isMesh, 'redundant central pusher exists');
  const cb = bounds(center); assert.ok(Math.max(Math.abs(cb.min.x), Math.abs(cb.max.x), Math.abs(cb.min.z), Math.abs(cb.max.z)) < 0.2, 'central pusher stays on axis');
  for (const o of pushers.children.filter(o => o !== center)) assert.ok(Math.hypot(world(o).x, world(o).z) > 1.7, 'other pushers stay peripheral');
}
for (const side of sides) {
  assert.ok((world(side.getObjectByName('raceway')).x - world(side).x) * Math.sign(world(side).x) > 1.8, 'side raceway faces outward');
  for (const name of ['base-bottles', 'octaweb-structure', 'leg-latches']) assert.ok(side.getObjectByName(name).userData.lodFeature > 0, `side detail ${name} participates in LOD`);
}
assert.equal(paths.userData.lodFeature, undefined, 'primary attachment paths survive LOD');
assert.ok(fh.getObjectByName('fh-pusher-detail').userData.lodFeature > 0, 'fine attachment fittings use LOD');

// Weld coincident indexed vertices, then find each physically connected component of the
// merged mesh. This recovers all eight separate rods directly from their triangles.
function components(mesh) {
  const g = mesh.geometry, a = g.getAttribute('position'), ids = [], parent = [], points = [], keyed = new Map();
  const p = new T.Vector3();
  for (let i = 0; i < a.count; i++) {
    p.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld); assert.ok(finite(p), 'finite hardware vertices');
    const key = p.toArray().map(v => Math.round(v * 1e5)).join(',');
    if (!keyed.has(key)) { keyed.set(key, points.length); parent.push(points.length); points.push(p.clone()); }
    ids.push(keyed.get(key));
  }
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const ix = g.index;
  for (let i = 0; i < (ix?.count ?? a.count); i += 3) {
    const v = [0, 1, 2].map(j => ids[ix ? ix.getX(i + j) : i + j]);
    parent[find(v[1])] = find(v[0]); parent[find(v[2])] = find(v[0]);
  }
  const sets = new Map();
  points.forEach((p, i) => { const root = find(i); if (!sets.has(root)) sets.set(root, new T.Box3()); sets.get(root).expandByPoint(p); });
  return [...sets.values()];
}
const rods = components(paths); assert.equal(rods.length, 8, 'eight physical FH rods');
for (const box of rods) {
  const c = box.getCenter(new T.Vector3()), s = Math.sign(c.x);
  const centerX = s > 0 ? box.min.x : box.max.x, sideX = s > 0 ? box.max.x : box.min.x;
  assert.ok(Math.hypot(centerX, c.z) < 1.85, 'rod center endpoint intersects center hull');
  assert.ok(Math.hypot(sideX - s * 4.25, c.z) < 1.85, 'rod side endpoint intersects side hull');
  assert.ok(c.y < 34.5, 'forward connections enter LOX tank below interstage');
}
assert.equal(rods.filter(b => b.getCenter(new T.Vector3()).y > 30).length, 4, 'four forward connections');
assert.equal(rods.filter(b => b.getCenter(new T.Vector3()).y < 5).length, 4, 'four aft connections');

const tower = world(pad.getObjectByName('olit'));
const qds = pad.getObjectByName('booster-qd').children;
assert.equal(qds.length, 2, 'two booster QD mechanisms');
for (const fluid of ['methane', 'oxygen']) {
  const qd = pad.getObjectByName(`booster-qd-${fluid}`), box = bounds(qd);
  assert.ok(box.min.x > 0 && tower.x < 0, `${fluid} QD lies opposite tower`);
  assert.ok(qd.getObjectByName(`booster-fill-${fluid}`)?.isMesh, `${fluid} has a physical fill line`);
}
const bunker = pad.getObjectByName('booster-fluid-bunker');
assert.ok(bounds(bunker).min.x > 0, 'fluid bunker lies opposite tower');
const divider = bounds(bunker.getObjectByName('bunker-fluid-divider'));
assert.ok(divider.min.z < 0 && divider.max.z > 0, 'bunker divides the fluid rooms');
const methane = bounds(bunker.getObjectByName('bunker-methane-access'));
const oxygen = bounds(bunker.getObjectByName('bunker-oxygen-access'));
assert.ok(methane.max.z < divider.min.z && oxygen.min.z > divider.max.z, 'independent access to separate fluid rooms');
assert.equal(actuators.length, 3, 'three V3 fin actuators');
assert.equal(lattices.length, 3, 'three V3 grid-fin lattices');
assert.equal(pins.length, 2, 'two catch pins on Super Heavy');
for (const fin of lattices) {
  const b = bounds(fin);
  assert.ok(b.max.y - b.min.y > 3, 'grid fin stands taller than 3 m (not a shelf)');
  assert.ok(b.max.y - b.min.y < 7, 'grid fin span stays inside the published envelope');
}
assert.ok(fh.getObjectByName('fh-octaweb-beam')?.isMesh, 'Falcon Heavy has a shared aft thrust beam');
for (const actuator of actuators) actuator.traverse(o => {
  if (!o.isMesh) return;
  const a = o.geometry.getAttribute('position'), p = new T.Vector3();
  for (let i = 0; i < a.count; i++) { p.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); assert.ok(Math.hypot(p.x, p.z) < 4.5, 'every V3 actuator vertex lies inside booster hull'); }
});
console.log('PASS hardware: stage release counts, FH contacts/orientation/LOD, dual QDs, separate bunker rooms, internal V3 actuators, grid-fin pose, FH thrust beam');
if (!mutant) for (const name of ['raceway', 'rod', 'pusher', 'qd', 'actuator', 'lod-path', 'lod-side', 'f1-fairing', 'f1-engine']) {
  const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--mutant=${name}`], { encoding: 'utf8' });
  assert.notEqual(run.status, 0, `must detect sabotage ${name}`);
  assert.match(run.stderr, /AssertionError/, `sabotage ${name} must fail an assertion`);
  console.log(`PASS sabotage rejected: ${name}`);
}
