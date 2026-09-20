/** Renderer-independent launch regressions. Node 22.15+; no browser or GPU required.
 * Mutations deliberately restore earlier defects and must be caught by these assertions.
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mutant = process.argv.find(a => a.startsWith('--mutant='))?.split('=')[1];
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
    if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    const result = next(url, context);
    if (!mutant || !url.endsWith('/src/sim/launch.js')) return result;
    let source = String(result.source).replace(/\r\n/g, '\n');
    if (mutant === 'random') source = source.replace('cloud.reset(seeded(11))', 'cloud.reset()');
    if (mutant === 'frozen') source = source.replace('advanceCloud(t);', 'advanceCloud(Math.min(t, CLOUD_UNTIL));');
    if (mutant === 'speed') source = source.replace('    advanceCloud(t);\n\n    if (t >=', '    advanceCloud(prev + Math.min(dt * state.speed, 0.12));\n\n    if (t >=');
    if (mutant === 'staging') source = source.replace('PROFILE.down[EVENTS.separation / PROFILE.step]', '84000');
    return { ...result, source };
  },
});
// GroundCloud's procedural texture needs only a pixel buffer; rendering is irrelevant here.
globalThis.document = { createElement: () => ({ getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
}) }) };
const THREE = await import('three');
const { createLaunch, altitudeAt, downrangeAt, pitchAt, boosterAltAt, boosterDownAt, boosterPitchAt } = await import('../src/sim/launch.js');
for (const [name, before, after] of [['altitude', altitudeAt, boosterAltAt], ['downrange', downrangeAt, boosterDownAt], ['pitch', pitchAt, boosterPitchAt]]) {
  assert.ok(Math.abs(before(160) - after(160)) < 1e-9, `staging ${name} must be continuous`);
}
function fixture() {
  const scene = new THREE.Scene(), model = new THREE.Group(), group = new THREE.Group();
  for (const name of ['ship', 'superheavy']) { const part = new THREE.Group(); part.name = name; model.add(part); }
  model.userData.stations = { booster: { pinY: 64.77 } };
  group.add(model); scene.add(group);
  const parts = { chopsticks: new THREE.Group(), holddowns: new THREE.Group(), qdArm: new THREE.Group() };
  const sun = new THREE.DirectionalLight();
  const camera = new THREE.PerspectiveCamera();
  const rig = { target: new THREE.Vector3(), external: false, releaseExternal() { this.external = false; } };
  const launch = createLaunch({ scene, exhibits: { starship: { model, group, lay: { x: 0, z: 0, mount: 18 } } },
    complex: { userData: { parts } }, env: { sun, setAltitude() {} }, rig, camera, quality: { cloudParticles: 96 } });
  const geometry = scene.getObjectByName('ground-cloud').geometry;
  const snapshot = () => ({ count: geometry.instanceCount, arrays: ['aOffset', 'aSize', 'aAlpha', 'aRot'].map(k => Array.from(geometry.getAttribute(k).array)) });
  return { launch, snapshot };
}
const { launch, snapshot } = fixture();
for (const t of [0, 6, 36, 45, 100, 407, 424]) {
  launch.seek(t); const expected = snapshot();
  launch.seek(t); assert.deepEqual(snapshot(), expected, `repeat seek ${t} must be deterministic`);
  for (const [speed, dt] of [[1, 1 / 60], [10, 1 / 30], [4, 1 / 24]]) {
    launch.reset(false); launch.start(); launch.setSpeed(speed);
    const frames = Math.floor((t + 12) / (dt * speed));
    for (let i = 0; i < frames; i++) launch.update(dt);
    const remaining = t - launch.state.t;
    if (remaining > 1e-8) launch.update(remaining / speed);
    assert.deepEqual(snapshot(), expected, `playback ${t}, speed ${speed}, dt ${dt} must match seek`);
  }
  if (t === 100) assert.equal(expected.count, 0, 'launch smoke must have expired by T+100');
}
launch.reset(false); assert.equal(snapshot().count, 0, 'reset clears all particles');
console.log('PASS deterministic clouds, all playback rates, smoke expiry, reset and staging continuity');
if (!mutant) {
  for (const name of ['random', 'frozen', 'speed', 'staging']) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--mutant=${name}`], { encoding: 'utf8' });
    assert.notEqual(run.status, 0, `regression test must reject sabotage: ${name}`);
    assert.match(run.stderr, /AssertionError/, `sabotage ${name} must fail an assertion, not crash`);
    console.log(`PASS sabotage rejected: ${name}`);
  }
}
