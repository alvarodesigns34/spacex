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
// Deliberately alter real geometry/transforms/nodes after construction: changing a metadata
// count cannot make these tests pass when the model a visitor sees is wrong.
if (mutant === 'raceway') sides[0].rotation.y *= -1;
if (mutant === 'rod') paths.geometry.translate(0, 0, 2);
if (mutant === 'pusher') { const p = f9.getObjectByName('stage-pusher-center'); p.parent.remove(p); }
if (mutant === 'qd') pad.getObjectByName('booster-qd-methane').position.x -= 40;
if (mutant === 'actuator') actuators[0].position.x += 10;
if (mutant === 'lod-path') paths.userData.lodFeature = 0.14;
if (mutant === 'lod-side') delete sides[0].getObjectByName('heat-shield-boots').userData.lodFeature;
if (mutant === 'f1-fairing') f1.getObjectByName('falcon1-fairing').scale.y = 0.8;
if (mutant === 'shield-hole') f9.getObjectByName('base-heat-shield').rotation.y = Math.PI / 8;
if (mutant === 'bay-phase') booster.getObjectByName('engine-bay-dividers').rotation.y = Math.PI / 20;
if (mutant === 'shield-skin') f9.getObjectByName('base-heat-shield').scale.set(1.2, 1, 1.2);
if (mutant === 'f1-engine') f1.getObjectByName('falcon1-merlin1c-turbopump').removeFromParent();
for (const root of [f1, f9, fh, pad, booster]) root.updateMatrixWorld(true);
const world = o => o.getWorldPosition(new T.Vector3());
const bounds = o => new T.Box3().setFromObject(o);
const finite = p => p.toArray().every(Number.isFinite);

const f1Fairing = f1.getObjectByName('falcon1-fairing'), f1FairingBox = bounds(f1Fairing);
// Figure 2-5 of the 2008 guide: separation plane at station 756.36 in, tip at 891.83, Ø60.00 in.
// (Figure 2-1 rounds the same fairing to 3.5 m [136 in] and 1.5 m [60 in].)
assert.ok(Math.abs(f1FairingBox.max.y - f1FairingBox.min.y - (891.83 - 756.36) * 0.0254) < 0.002, 'Falcon 1 fairing is the drawing\'s 135.47 in (3.441 m)');
assert.ok(Math.abs(Math.max(Math.abs(f1FairingBox.min.x), Math.abs(f1FairingBox.max.x)) - 0.762) < 0.002,
  'Falcon 1 fairing is the drawing\'s 60.00 in diameter');
// The engine hangs below the stage on an open thrust frame: the stage ends at station 133.3.
{
  const s1 = bounds(f1.getObjectByName('falcon1-stage1'));
  assert.ok(Math.abs(s1.min.y - (133.3 - 26.3) * 0.0254) < 0.01, 'Falcon 1 first stage ends at its aft ring (station 133.3), no boat-tail');
}
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
  for (const name of ['heat-shield-boots', 'leg-latches']) assert.ok(side.getObjectByName(name).userData.lodFeature > 0, `side detail ${name} participates in LOD`);
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
  assert.ok(Math.hypot(centerX, c.z) < 1.83, 'rod center endpoint intersects center hull');
  assert.ok(Math.hypot(sideX - s * 4.27, c.z) < 1.83, 'rod side endpoint intersects side hull');
  assert.ok(c.y < 34.5, 'forward connections enter LOX tank below interstage');
}
assert.equal(rods.filter(b => b.getCenter(new T.Vector3()).y > 30).length, 4, 'four forward connections');
assert.equal(rods.filter(b => b.getCenter(new T.Vector3()).y < 5).length, 4, 'four aft connections');


// Engines and the structure round them. Twice now a ring of plates has been laid out on the
// engines' own azimuths and run straight through them — Super Heavy's twenty bay dividers and
// Falcon's Octaweb webs — so these are measured against the placed engine instances, not
// against the constants that were wrong in the first place.

/** Points spread over every triangle of a mesh, in world space. A box's eight corners can all
 *  lie clear of an engine while its face runs straight through it, so vertices are not enough. */
function surfaceSamples(mesh, n = 8) {
  const g = mesh.geometry, a = g.getAttribute('position'), ix = g.index, out = [];
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
  const tris = ix ? ix.count / 3 : a.count / 3;
  for (let t = 0; t < tris; t++) {
    const k = (j) => (ix ? ix.getX(t * 3 + j) : t * 3 + j);
    A.fromBufferAttribute(a, k(0)); B.fromBufferAttribute(a, k(1)); C.fromBufferAttribute(a, k(2));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n;
      out.push(new T.Vector3().copy(A).multiplyScalar(1 - u - v).addScaledVector(B, u).addScaledVector(C, v).applyMatrix4(mesh.matrixWorld));
    }
  }
  return out;
}
function engineAxes(root, radiusMin = 0) {
  const axes = [], m = new T.Matrix4(), p = new T.Vector3();
  root.traverse(o => {
    if (!o.isInstancedMesh || o.parent?.name !== 'engines') return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
      if (Math.hypot(p.x - world(root).x, p.z - world(root).z) >= radiusMin) axes.push(p.clone());
    }
  });
  // Each engine has three instanced meshes (outer bell, inner bell, head): one axis per engine.
  return axes.filter((a, i) => axes.findIndex(b => b.distanceTo(a) < 1e-4) === i);
}
for (const core of [f9.children.find(o => o.name === 'falcon-core-f9'), ...sides]) {
  // The core also carries the second stage's Merlin Vacuum; only the nine at the base count.
  const shield = core.getObjectByName('base-heat-shield'), axes = engineAxes(core).filter(e => e.y < world(core).y + 5);
  assert.equal(axes.length, 9, 'nine Merlin axes per core');
  const c = world(core);
  let clear = Infinity, reach = 0;
  for (const p of surfaceSamples(shield, 3)) {
    reach = Math.max(reach, Math.hypot(p.x - c.x, p.z - c.z));
    for (const e of axes) clear = Math.min(clear, Math.hypot(p.x - e.x, p.z - e.z));
  }
  // 0.254 m is the Merlin bell's radius at the shield plane (engines.js profile, 1.0 m up).
  assert.ok(clear > 0.27, `base heat shield clears every bell (${clear.toFixed(3)} m from an axis)`);
  assert.ok(reach <= 1.831, `base heat shield stays inside the 3.66 m skin (${reach.toFixed(3)} m)`);
}
{
  const outer = engineAxes(booster, 3.5);
  assert.equal(outer.length, 20, 'twenty outer Raptor axes');
  const dividers = booster.getObjectByName('engine-bay-dividers');
  let worst = Infinity;
  for (const p of surfaceSamples(dividers, 10)) {
    // Raptor bell radius at this height, from the engine's own profile; the exit plane is at y = 0.25.
    const local = p.y - outer[0].y;
    if (local > 2.2) continue;
    const bellR = local < 0.45 ? 0.62 - (0.62 - 0.533) * (local / 0.45) : 0.533 - (0.533 - 0.434) * Math.min(1, (local - 0.45) / 0.4);
    for (const e of outer) worst = Math.min(worst, Math.hypot(p.x - e.x, p.z - e.z) - bellR);
  }
  assert.ok(worst > 0, `Super Heavy bay dividers stay outside every outer bell (${worst.toFixed(3)} m)`);
}

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
for (const actuator of actuators) actuator.traverse(o => {
  if (!o.isMesh) return;
  const a = o.geometry.getAttribute('position'), p = new T.Vector3();
  for (let i = 0; i < a.count; i++) { p.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); assert.ok(Math.hypot(p.x, p.z) < 4.5, 'every V3 actuator vertex lies inside booster hull'); }
});
console.log('PASS hardware: stage release counts, FH contacts/orientation/LOD, dual QDs, separate bunker rooms, internal V3 actuators');
if (!mutant) for (const name of ['raceway', 'rod', 'pusher', 'qd', 'actuator', 'lod-path', 'lod-side', 'f1-fairing', 'f1-engine', 'shield-hole', 'bay-phase', 'shield-skin']) {
  const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--mutant=${name}`], { encoding: 'utf8' });
  assert.notEqual(run.status, 0, `must detect sabotage ${name}`);
  assert.match(run.stderr, /AssertionError/, `sabotage ${name} must fail an assertion`);
  console.log(`PASS sabotage rejected: ${name}`);
}
