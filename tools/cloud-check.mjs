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
    // The defect found in review: positions met at staging but the velocity did not.
    // The defect found in the 28-09 audit: the ship's acceleration fell while it burned.
    if (mutant === 'shipmass') source = source.replace('if (burning) m = Math.max(S.dry, m - thr * mdot * dt);', '');
    if (mutant === 'kink') source = source.replace('v0 * Math.sin(p0) + R * w0 * Math.cos(p0)', '0.55 * v0 * Math.sin(p0) + R * w0 * Math.cos(p0)');
    return { ...result, source };
  },
});
// GroundCloud's procedural texture needs only a pixel buffer; rendering is irrelevant here.
globalThis.document = { createElement: () => ({ getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
}) }) };
const THREE = await import('three');
const { createLaunch, altitudeAt, downrangeAt, pitchAt, speedAt, boosterAltAt, boosterDownAt, boosterPitchAt, boosterSpeedAt, EVENTS, shipMassAt, shipThrustAccelAt, shipMassFlow, SHIP_ASSUMED, SHIP_STEERING, MECO_ALTITUDE, BURN_THREE, BURN_FIVE } = await import('../src/sim/launch.js');
for (const [name, before, after] of [['altitude', altitudeAt, boosterAltAt], ['downrange', downrangeAt, boosterDownAt], ['pitch', pitchAt, boosterPitchAt]]) {
  assert.ok(Math.abs(before(EVENTS.separation) - after(EVENTS.separation)) < 1e-9, `staging ${name} must be continuous`);
}
// Position continuity is not enough: the review found the positions meeting at staging while
// the speed fell from 5 695 to 3 155 km/h in 0,2 s. Velocity is differentiated from the very
// positions the scene uses, over the whole flight, for the stack and then the booster, and
// three things are asserted: no speed change beyond 12 g (the landing burn in dense air peaks
// near 7,3 g, thrust plus drag; the V3 boostback on 33 engines near 8,2 g), no kink in the velocity *vector* (a change of direction at
// constant speed is a jump too), and an attitude that turns no faster than 40°/s (the flip).
{
  // 12 g, not 8: the V3 boostback's high-thrust portion on all 33 engines, with the tanks
  // nearly empty, peaks near 8,2 g here. A genuine jump (the staging defect this test was
  // written for) reads 11 850 m/s², a hundred times the bound either way.
  const H = 0.02, STEP = 0.05, G8 = 12 * 9.81;
  const vel = (t) => [(boosterDownAt(t + H) - boosterDownAt(t - H)) / (2 * H), (boosterAltAt(t + H) - boosterAltAt(t - H)) / (2 * H)];
  let worstA = [0, 0], worstV = [0, 0], worstP = [0, 0];
  let prev = vel(EVENTS.liftoff + 1), prevS = boosterSpeedAt(EVENTS.liftoff + 1), prevP = boosterPitchAt(EVENTS.liftoff + 1);
  for (let t = EVENTS.liftoff + 1 + STEP; t < EVENTS.catch - 0.1; t += STEP) {
    const v = vel(t), sp = boosterSpeedAt(t), p = boosterPitchAt(t);
    const dvec = Math.hypot(v[0] - prev[0], v[1] - prev[1]) / STEP;
    const dsp = Math.abs(sp - prevS) / STEP, dp = Math.abs(p - prevP) / STEP;
    if (dvec > worstV[1]) worstV = [t, dvec];
    if (dsp > worstA[1]) worstA = [t, dsp];
    if (dp > worstP[1]) worstP = [t, dp];
    prev = v; prevS = sp; prevP = p;
  }
  assert.ok(worstA[1] < G8, `booster speed jumps ${worstA[1].toFixed(0)} m/s² at T+${worstA[0].toFixed(2)}`);
  assert.ok(worstV[1] < G8, `booster velocity vector kinks ${worstV[1].toFixed(0)} m/s² at T+${worstV[0].toFixed(2)}`);
  assert.ok(worstP[1] < THREE.MathUtils.degToRad(40), `booster attitude turns ${THREE.MathUtils.radToDeg(worstP[1]).toFixed(0)}°/s at T+${worstP[0].toFixed(2)}`);
  // The panel's number and the moving booster: the same speed at separation, and a speed the
  // booster actually has (position-derived) everywhere after it.
  assert.ok(Math.abs(boosterSpeedAt(EVENTS.separation + 0.01) - speedAt(EVENTS.separation)) < 5, 'panel speed continuous through staging');
  for (const t of [EVENTS.boostbackStart + 8, EVENTS.boostbackEnd + 60, 330, EVENTS.landingBurn - 5, BURN_THREE + 1, EVENTS.catch - 4]) {
    const v = vel(t);
    assert.ok(Math.abs(Math.hypot(...v) - boosterSpeedAt(t)) < 0.5, `panel speed matches motion at T+${t}`);
  }
  // It comes home: at rest on the axis, 22 m over the deck, at the cited catch time.
  assert.ok(Math.abs(boosterDownAt(EVENTS.catch)) < 0.05 && Math.abs(boosterAltAt(EVENTS.catch) - 22) < 0.05 && boosterSpeedAt(EVENTS.catch) < 0.1, 'booster at rest in the arms at the catch');
  console.log(`PASS trajectory: max ${worstA[1].toFixed(0)} m/s² speed change, ${worstV[1].toFixed(0)} m/s² vector change, ${THREE.MathUtils.radToDeg(worstP[1]).toFixed(0)}°/s attitude`);
}
// The ship after separation is a rocket, not a curve: its mass falls at the published thrust
// over the assumed Isp, so its thrust acceleration RISES as it burns (the old authored curve
// had it falling from 0,98 to 0,79 g); its engines stop at the cited cutoff (T+8:11), level at
// flight 12's published apogee and at the speed of the top of that arc, below orbital; its
// position-derived speed matches the panel's; and it never turns faster than 3°/s.
{
  const G0 = 9.80665;
  let prevA = 0, worstP = 0;
  for (let t = EVENTS.separation + 3; t <= EVENTS.end - 0.25; t += 0.5) {
    const a = shipThrustAccelAt(t);
    if (t < EVENTS.shipCutoff - 1) {
      assert.ok(a >= prevA - 1e-6, `ship thrust acceleration must rise while it burns: ${a.toFixed(2)} after ${prevA.toFixed(2)} m/s² at T+${t}`);
      prevA = a;
      const expect = SHIP_ASSUMED.propellant + SHIP_ASSUMED.dry - shipMassFlow() * (t - EVENTS.separation);
      assert.ok(Math.abs(shipMassAt(t) - expect) < 0.01 * expect, `ship mass follows the mass flow at T+${t}`);
    } else if (t > EVENTS.shipCutoff + 0.5) {
      assert.ok(a === 0, `ship engines off after the cited cutoff: ${a} m/s² at T+${t}`);
    }
    const H = 0.05;
    const v = Math.hypot((downrangeAt(t + H) - downrangeAt(t - H)) / (2 * H), (altitudeAt(t + H) - altitudeAt(t - H)) / (2 * H));
    assert.ok(Math.abs(v - speedAt(t)) < 2, `ship panel speed matches its motion at T+${t}: ${v.toFixed(1)} vs ${speedAt(t).toFixed(1)}`);
    worstP = Math.max(worstP, Math.abs(pitchAt(t + 0.25) - pitchAt(t - 0.25)) / 0.5);
  }
  const h = altitudeAt(EVENTS.shipCutoff), v = speedAt(EVENTS.shipCutoff + 0.5);
  const orbital = Math.sqrt(3.986004418e14 / (6371e3 + h));
  assert.ok(Math.abs(h - SHIP_ASSUMED.holdAltitude) < 200 && Math.abs(v - SHIP_STEERING.cutoffSpeed) < 2 && v < orbital,
    `ship cuts off at the arc's top, suborbital: ${(h / 1e3).toFixed(1)} km, ${v.toFixed(0)} of ${orbital.toFixed(0)} m/s`);
  // Full thrust to the cutoff on a 1 614 tf ship is ≈6 g at the end; that is the consequence of
  // the published thrust, propellant and cutoff time, not a limit anyone publishes. The bound
  // catches a runaway (a mass that stops falling or drops to nothing), not a number.
  assert.ok(prevA / G0 < 7, `ship ends under 7 g: ${(prevA / G0).toFixed(2)} g`);
  assert.ok(worstP < THREE.MathUtils.degToRad(3.2), `ship attitude slews ≤ 3°/s: ${THREE.MathUtils.radToDeg(worstP).toFixed(2)}°/s`);
  assert.ok(Math.abs(pitchAt(EVENTS.separation) - boosterPitchAt(EVENTS.separation)) < 1e-9, 'ship and booster share the attitude at staging');
  // MECO where the cited profile puts it.
  assert.ok(Math.abs(altitudeAt(EVENTS.meco) - MECO_ALTITUDE) < 200, `MECO at ≈64 km: ${(altitudeAt(EVENTS.meco) / 1e3).toFixed(1)} km`);
  console.log(`PASS ship after staging: ${(prevA / G0).toFixed(2)} g at cutoff, ${(h / 1e3).toFixed(0)} km, ${(v * 3.6).toFixed(0)} km/h; MECO ${(altitudeAt(EVENTS.meco) / 1e3).toFixed(1)} km`);
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
for (const t of [0, 6, 36, 45, 100, EVENTS.catch - 14, EVENTS.catch + 3]) {
  launch.seek(t); const expected = snapshot();
  launch.seek(t); assert.deepEqual(snapshot(), expected, `repeat seek ${t} must be deterministic`);
  for (const [speed, dt] of [[1, 1 / 60], [10, 1 / 30], [4, 1 / 24]]) {
    launch.reset(false); launch.start(); launch.setSpeed(speed);
    const frames = Math.floor((t - EVENTS.start) / (dt * speed));
    for (let i = 0; i < frames; i++) launch.update(dt);
    const remaining = t - launch.state.t;
    if (remaining > 1e-8) launch.update(remaining / speed);
    assert.deepEqual(snapshot(), expected, `playback ${t}, speed ${speed}, dt ${dt} must match seek`);
  }
  if (t === 100) assert.equal(expected.count, 0, 'launch smoke must have expired by T+100');
}
launch.reset(false); assert.equal(snapshot().count, 0, 'reset clears all particles');
// V3 engine counts on the way home, in the order SpaceX's flight summaries give them: all 33
// for the boostback's high-thrust portion, then the inner 13; 13 → 5 → 3 in the landing burn.
{
  const lit = (t) => { launch.seek(t); return launch.state.booster.lit; };
  const at = [EVENTS.separation + 1, EVENTS.boostbackStart + 5, EVENTS.boostbackStart + 20, BURN_FIVE - 2, BURN_FIVE + 1.5, BURN_THREE + 3];
  const seen = at.map(lit);
  assert.deepEqual(seen, [5, 33, 13, 13, 5, 3], `booster engines lit at T+${at.join('/')}: ${seen}`);
  launch.reset(false);
  console.log('PASS V3 engine counts: 5 through hot-staging, 33 → 13 (boostback), 13 → 5 → 3 (landing)');
}
console.log('PASS deterministic clouds, all playback rates, smoke expiry, reset and staging continuity');
if (!mutant) {
  for (const name of ['random', 'frozen', 'speed', 'staging', 'kink', 'shipmass']) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--mutant=${name}`], { encoding: 'utf8' });
    assert.notEqual(run.status, 0, `regression test must reject sabotage: ${name}`);
    assert.match(run.stderr, /AssertionError/, `sabotage ${name} must fail an assertion, not crash`);
    console.log(`PASS sabotage rejected: ${name}`);
  }
}
