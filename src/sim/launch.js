/**
 * Starship launch sequence: countdown, ignition, liftoff, ascent, Max-Q, MECO and
 * hot-stage separation.
 *
 * WHAT IS CITED AND WHAT IS RECONSTRUCTED
 *
 * The event times are SpaceX's own, from the published timeline of flight 14 (28 September
 * 2026, spacex.com/launches/starship-flight-14, read directly): the V3 vehicle on Pad 2 that the
 * exhibit models. Countdown: GO for launch T−0:30, flame diverter T−0:17, booster engine
 * startup command T−0:03. Flight: liftoff T+0:00, Max-Q 0:58, MECO 2:20, hot-staging 2:22,
 * boostback 2:27–3:07, landing burn 6:36–7:01, Starship engine cutoff 8:11. Flights 12 and 13
 * (the other two V3 flights) publish the same structure within a few seconds.
 *
 * One thing is not flight 14's: its booster was planned to splash down in the Gulf, and this
 * sequence ends its landing burn in the tower's arms. No V3 booster has been caught yet.
 *
 * The altitude and speed *curve* between the cited times is not published as a table anywhere,
 * so it is reconstructed: a monotone cubic through keyframes that hit the cited times and a
 * separation-speed anchor that is declared as reconstructed on the sheet. Everything
 * downstream is then derived from that one curve rather than invented separately — the
 * flight-path angle, the downrange distance and the attitude — so the pitch you see and the
 * numbers on the panel cannot disagree with each other.
 *
 * Time runs 1:1 by default. The speed control multiplies the mission clock, it does not skip.
 */
import * as THREE from 'three';
import { Plume, GroundCloud, EngineJets, Vapor, CondensationCollar, FlightEarth, Glow, Fire } from './plume.js';
import { BOOSTER_RINGS, RAPTOR_EXIT_R, ringAngle, BOOSTER_AFT } from '../vehicles/starship.js';
import { seeded } from '../geometry/utils.js';
import { PAD } from '../vehicles/pad.js';
import { BURN_THREE, CATCH_BASE, EVENTS, MILESTONES, altitudeAt, boosterAltAt, boosterDownAt, boosterEngineThrottle, boosterLit, boosterPitchAt, boosterSpeedAt, boosterSpread, boosterThrottle, downrangeAt, phaseAt, pitchAt, shipLit, shipThrottle, speedAt } from './launchModel.js';

// The trajectory model (launchModel.js), re-exported: every import of './launch.js' keeps working.
export * from './launchModel.js';

export function createLaunch({ scene, exhibits, complex, env, rig, camera, quality = {}, onState = () => {}, onFinish = () => {}, onStart = () => {} }) {
  const ex = exhibits.starship;
  const flight = new THREE.Group();
  flight.name = 'flight';
  // The vehicle is re-parented under a group of its own so the sequence can move and pitch
  // it without dragging the launch complex with it.
  ex.group.remove(ex.model);
  flight.add(ex.model);
  ex.group.add(flight);
  ex.flight = flight;

  const booster = ex.model.getObjectByName('superheavy');
  const ship = ex.model.getObjectByName('ship');
  const shipHome = ship.position.y;
  // The re-entry borrows the ship (sim/reentry.js start(): it re-parents it to its own mount, engines
  // at the origin). A reset of the launch while it is borrowed — reset() runs whether or not the
  // launch is running — put it back 71.9 m up inside the re-entry's mount: the ship floated ≈70 m over
  // the sea at the splash, in the gallery's capture too (found 8-11-2026). Only the launch's own.
  const shipParent = ship.parent;
  const shipToStack = () => { if (ship.parent === shipParent) ship.position.y = shipHome; };
  const parts = complex.userData.parts;

  // The booster flies its own trajectory after staging — out to 95 km downrange and back to
  // the tower — so it gets its own group beside the ship's rather than a small offset inside
  // it. Before separation the two are driven with identical transforms, which is also what
  // keeps seek() exact: there is no state carried across the split.
  const boosterHome = { parent: booster.parent, position: booster.position.clone() };
  // Two groups, not one: `flight` carries the trajectory and `ex.model` carries the exhibit's
  // own mount height and yaw, and the booster's chain has to compose in exactly the same order
  // or the two vehicles drift apart before they have separated. Collapsing them into a single
  // group did precisely that — at T+26 the ship was already flying beside its own booster.
  const boosterFlight = new THREE.Group();
  boosterFlight.name = 'booster-flight';
  const boosterModel = new THREE.Group();
  boosterModel.name = 'booster-model';
  boosterModel.position.copy(ex.model.position);
  boosterModel.rotation.copy(ex.model.rotation);
  boosterFlight.add(boosterModel);
  ex.group.add(boosterFlight);
  ex.boosterFlight = boosterFlight;

  /**
   * The booster only leaves ex.model while the sequence is live. Parked, it belongs to the
   * stack — otherwise verifyExhibits() measures a 53 m Starship, because measure() walks the
   * model and the booster is no longer in it.
   */
  let boosterDetached = false;
  function detachBooster(on) {
    if (on === boosterDetached) return;
    boosterDetached = on;
    (on ? boosterModel : boosterHome.parent).add(booster);
    booster.position.copy(boosterHome.position);
    booster.rotation.z = 0;
  }

  // Chopstick home state, so reset() puts the arms back where the launch found them.
  const chop = parts.chopsticks;
  const chopHome = {
    y: chop.position.y,
    arms: chop.children.filter(c => c.name.startsWith('arm-')).map(a => ({ obj: a, ry: a.rotation.y })),
  };
  /**
   * How far the arms close. It was a fixed 6,5°, which with the hinges 2,2 m either side of the
   * tower's centreline put the arms' bumper pads 2,6 m from the booster's axis: 1,9 m inside a
   * 4,5 m hull, so the arms passed straight through the tank. Now it is solved from the pad's
   * own geometry: each arm swings until its inboard pads stand 5 cm off the hull, at the
   * booster's axis, and stays outboard of it — the way the chopsticks close on a booster.
   */
  const CG = chop.userData.catchGeometry ?? { railTop: 2.3, padReach: 1.75, hinge: [8.2, 2.2] };
  const HULL_R = 4.5;
  const armToAxis = -chop.position.x - CG.hinge[0];
  const CATCH_ARM = Math.atan2(HULL_R + 0.05 + CG.padReach - CG.hinge[1], armToAxis);
  const CATCH_ALT = CATCH_BASE;                       // booster held this far above its launch station
  /**
   * Where the carriage has to be for the arms to take the load on the pins.
   *
   * This used to be the literal 98, and it was 6.8 m low: the pins are at station
   * finY - PIN_DROP = 64.77 m on the booster, and at the catch the booster's own origin is at
   * mount + CATCH_ALT = 40 m, which puts them at 104.8 m. The arms were closing on the
   * methane tank, eight metres under the hardware they are supposed to be holding - and the
   * gate could not see it, because all it asked was that the carriage end up above 80 m.
   *
   * Derived from the booster's published station so the two cannot drift apart again: move
   * the grid fins and the tower follows them.
   */
  // …and not with the pins buried halfway down the arm, where they sat: the pins rest ON the
  // rail along the top of each arm, so the carriage stops one rail height below them (pin
  // radius included).
  const CATCH_CARRIAGE = ex.lay.mount + CATCH_ALT + ex.model.userData.stations.booster.pinY - CG.railTop - 0.34;

  // ---- Plumes -------------------------------------------------------------------------
  // Cluster radii: the 33 Raptors sit inside a 3,86 m ring, the ship's six inside a 2,3 m
  // one, so those are the exit-plane radii the merged columns start from.
  // Thirty-three sea-level Raptors do not make a wisp. The exhaust column off the mount is
  // wider than the 9 m booster and runs several booster-lengths behind it before it breaks up;
  // at 6.0 the plume was about a quarter of the booster's length and the whole ascent read as
  // a model rocket.
  // 16 cluster radii (≈74 m) at the pad: in liftoff photographs the bright column is well over
  // a booster length before it breaks up into the cloud.
  // Flame sprites per plume, by quality tier: they are large, overlapping and blended, so their
  // cost is fill rate, which is what a weak GPU has least of.
  const fireScale = quality.name === 'low' ? 0.5 : quality.name === 'medium' ? 0.75 : 1;
  const boosterPlume = new Plume({ radius: 4.6, seaLevelLength: 16, name: 'plume-booster', fireCount: Math.round(180 * fireScale) });
  const shipPlume = new Plume({ radius: 2.6, seaLevelLength: 8.4, name: 'plume-ship', fireCount: Math.round(110 * fireScale) });
  booster.add(boosterPlume.group);
  ship.add(shipPlume.group);

  // Individual engine jets under the column: centre 3, inner 10, outer 20 in lighting order
  // for the booster; the ship's 3 sea-level Raptors, then its 3 vacuum engines.
  const ringPositions = (n, r, y, phase) => Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  });
  const boosterJets = new EngineJets({
    name: 'jets-booster',
    engines: BOOSTER_RINGS.flatMap((ring) => Array.from({ length: ring[0] }, (_, i) => { const a = ringAngle(ring, i); return { position: [Math.sin(a) * ring[1], ring[2], Math.cos(a) * ring[1]], radius: RAPTOR_EXIT_R }; })),
  });
  const shipJets = new EngineJets({
    name: 'jets-ship', seaLevelLength: 10,
    engines: [
      ...ringPositions(3, 0.95, 0.35, 0).map(position => ({ position, radius: RAPTOR_EXIT_R })),
      ...ringPositions(3, 3.05, 0.25, Math.PI / 3).map(position => ({ position, radius: 1.15 })),
    ],
  });
  booster.add(boosterJets.mesh);
  ship.add(shipJets.mesh);
  // Hot-staging: the ship lights its six engines while still sitting on the booster, and the
  // exhaust has nowhere to go but out through the 24 openings of the vented section at the top
  // of the booster (starship.js, hotStageSection), turned down and out by the louvres. A ring
  // of fire round the interstage for the second or two before the stages part, then the gap
  // opens and the ship's plume plays straight onto the booster's dome instead.
  const HS_STATION = (ex.model.userData.stations?.booster?.ringTop ?? 70.47) + 0.9;
  // At 65 km there is almost no air to hold the vent flames in, so each one fans out into a
  // wide tongue many metres long: from the ground the ring reads as a flower of fire round the
  // interstage (flight 7 and 8 tracking footage). They were 0,4 m jets a dozen metres long.
  const hotStageVents = new EngineJets({
    name: 'jets-hot-stage', seaLevelLength: 12, turbulence: 1,
    engines: Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return { position: [Math.sin(a) * 4.45, HS_STATION, Math.cos(a) * 4.45], radius: 0.6, direction: [Math.sin(a), -0.35, Math.cos(a)] };
    }),
  });
  // Orange-yellow to the tips: with the sea-level jets' red-orange tail over 70 % of their
  // length, 24 thin tongues read as a red starburst rather than the ring of fire in the footage.
  hotStageVents.material.uniforms.uWarm.value.set(0xffc46e).convertSRGBToLinear();
  hotStageVents.material.uniforms.uTail.value.set(0xff9442).convertSRGBToLinear();
  booster.add(hotStageVents.mesh);
  const ventAt = (t) => shipThrottle(t) * (1 - THREE.MathUtils.smoothstep(t, EVENTS.separation + 0.4, EVENTS.separation + 2.6));
  // …and the fireball those vents make together, round the interstage, from the ship's
  // ignition until the gap opens.
  const stageGlow = new Glow({ name: 'glow-hot-stage', edge: 0xff9a44 });
  stageGlow.mesh.position.set(0, HS_STATION, 0);
  booster.add(stageGlow.mesh);
  const stageGlowAt = (t) => {
    const up = THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation - 0.6);
    const down = 1 - THREE.MathUtils.smoothstep(t, EVENTS.separation + 0.2, EVENTS.separation + 3.2);
    return up * down;
  };

  // ---- Vapour: venting in the count, the deluge at ignition, venting after the catch -------
  // Emitters are placed in the stack's rest frame (engine exits BOOSTER_AFT under the deck, y up),
  // under a group that stays on the pad, so puffs born before liftoff do not ride up with the
  // vehicle. Stations are reconstructed: where a fuelled Starship is seen venting from, not a
  // plumbing diagram. Fewer puffs on the lower tiers.
  const vScale = quality.name === 'low' ? 0.45 : quality.name === 'medium' ? 0.7 : 1;
  const nv = (n) => Math.max(4, Math.round(n * vScale));
  const rest = new THREE.Group();
  rest.name = 'stack-rest-frame';
  rest.position.copy(ex.model.position);
  rest.rotation.copy(ex.model.rotation);
  ex.group.add(rest);
  const around = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
  const out = (a, up = 0) => [Math.sin(a), up, Math.cos(a)];
  const COUNT_WIN = [EVENTS.start, EVENTS.liftoff + 0.5];
  const countdownVent = new Vapor({
    name: 'vapor-countdown', rng: seeded(21), accel: [0.7, -0.45, 0.3], tau: 1.5, opacity: 0.78,
    emitters: [
      ...[0.6, 2.7, 4.8].map(a => ({ at: around(4.6, 48, a), dir: out(a, -0.2), speed: 2.2, spread: 0.35, count: nv(36), life: 9.1, size: 3.84, grow: 2.2, window: COUNT_WIN })),
      ...[1.4, 4.2].map(a => ({ at: around(4.6, 69, a), dir: out(a, 0.1), speed: 2.8, spread: 0.3, count: nv(30), life: 7.8, size: 3.36, grow: 2, window: COUNT_WIN })),
      ...[2.2, 5.3].map(a => ({ at: around(4.6, 76, a), dir: out(a, -0.1), speed: 2.4, spread: 0.3, count: nv(27), life: 7.8, size: 3.12, grow: 2, window: COUNT_WIN })),
      { at: around(3.0, 116, 3.1), dir: out(3.1, 0.3), speed: 2, spread: 0.3, count: nv(21), life: 6.5, size: 2.4, grow: 1.8, window: COUNT_WIN },
      ...[0.9, 3.9].map(a => ({ at: around(4.4, BOOSTER_AFT + 1.2, a), dir: out(a, -0.3), speed: 3, spread: 0.4, count: nv(30), life: 6.5, size: 4.32, grow: 2.8, window: COUNT_WIN })),
    ],
  });
  // The loaded stack's cold vapour, in bulk. SpaceX's photograph of the V3 wet dress rehearsal
  // on Pad 2 (11 May 2026) shows it pouring down the booster's sides in sheets from the top of
  // the LOX tank and piling up round the mount — far more than the few vent puffs above. Cold,
  // so it falls: a slow start and a strong downward pull keep it running down the hull; the
  // pile at the base spreads low. Positions and rates are reconstructed.
  const cascade = new Vapor({
    name: 'vapor-cascade', rng: seeded(26), accel: [0.25, -1.5, 0.15], tau: 1.8, opacity: 0.66,
    emitters: [0.3, 1.9, 3.4, 5.0].map(a => ({ at: around(4.75, 64, a), dir: out(a, -0.9), speed: 1.1, spread: 0.22, count: nv(40), life: 13, size: 3.4, grow: 2.4, jitter: 1.4, window: COUNT_WIN })),
  });
  const basePile = new Vapor({
    // Low and thinning, not a wall: at 0.6 and 3.2 m/s of growth it swallowed the whole mount
    // in the countdown's close shot, the deflector water and the QD arm with it.
    name: 'vapor-base', rng: seeded(27), accel: [0.3, -0.25, 0.2], tau: 2.2, opacity: 0.45,
    emitters: Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      return { at: around(7.5, BOOSTER_AFT + 0.8, a), dir: out(a, -0.05), speed: 2.2, spread: 0.3, count: nv(30), life: 12, size: 5.5, grow: 2.2, jitter: 1.5, window: COUNT_WIN };
    }),
  });
  // Deluge: water driven up through the mount's plate round the engines, from a couple of
  // seconds before ignition until the stack is clear. Spray, flashing to steam as it rises.
  const deluge = new Vapor({
    name: 'vapor-deluge', rng: seeded(22), accel: [0.4, -2.2, 0.2], tau: 0.9, opacity: 0.62,
    emitters: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      // From two seconds before the startup command: the diverter's water starts at T−17
      // (flight 14), but it is the engines that flash it into this spray round the mount; at
      // T−17 the sprays buried the whole mount for the last quarter-minute of the count.
      return { at: around(6.6, BOOSTER_AFT - 0.6, a), dir: out(a, 3.2), speed: 24, spread: 0.22, count: nv(33), life: 4.16, size: 5.28, grow: 8.4, jitter: 1.2, window: [EVENTS.ignition - 2, EVENTS.liftoff + 10] };
    }),
  });
  // Landing: the last seconds of the burn blast the mount deck, and the exhaust and deck water
  // spread out across it as a low sheet of steam. It starts when the column can reach the
  // deck (the base within 55 m of it), not at a fixed time: tied to the switch to the centre
  // three it billowed up round the pad while the booster was still 280 m up.
  const SPRAY_FROM = (() => { let t = EVENTS.landingBurn; while (t < EVENTS.catch - 1 && boosterAltAt(t) > 55) t += 0.1; return t; })();
  const landingSpray = new Vapor({
    name: 'vapor-landing', rng: seeded(24), accel: [0.5, 0.8, 0.2], tau: 1.4, opacity: 0.38,
    emitters: Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      return { at: around(5.5, BOOSTER_AFT + 0.5, a), dir: out(a, 0.08), speed: 22, spread: 0.25, count: nv(10), life: 4.5, size: 7, grow: 9, jitter: 1.5, window: [SPRAY_FROM, EVENTS.catch - 0.5] };
    }),
  });
  rest.add(countdownVent.mesh, cascade.mesh, basePile.mesh, deluge.mesh, landingSpray.mesh);
  // After the catch the booster sits on the arms venting: off the top, round the upper tank,
  // and from the engine section. Attached to the booster, which no longer moves.
  const CATCH_WIN = [EVENTS.catch + 1.5, EVENTS.end + 60];
  const BOOSTER_TOP = ex.model.userData.stations?.booster?.height ?? 71.93;
  const catchVent = new Vapor({
    // Thin and spreading rather than dense: at 0,62 with slow growth each puff stayed a white
    // ball on the booster's flank, cotton wool rather than venting gas.
    name: 'vapor-caught', rng: seeded(23), accel: [0.9, -0.25, 0.35], tau: 1.6, opacity: 0.44,
    emitters: [
      { at: [0, BOOSTER_TOP - 0.8, 0], dir: [0.1, 1, 0], speed: 3.5, spread: 0.4, count: nv(39), life: 9.1, size: 4.32, grow: 3.6, jitter: 2, window: CATCH_WIN },
      ...[1.0, 3.6].map(a => ({ at: around(4.6, 58, a), dir: out(a, 0), speed: 2.4, spread: 0.35, count: nv(27), life: 7.8, size: 3.36, grow: 3.2, window: CATCH_WIN })),
      ...[0.3, 3.3].map(a => ({ at: around(4.3, BOOSTER_AFT + 1.2, a), dir: out(a, -0.3), speed: 2.6, spread: 0.4, count: nv(24), life: 6.5, size: 3.84, grow: 3.6, window: CATCH_WIN })),
    ],
  });
  booster.add(catchVent.mesh);
  // The flip. Once the ship is away the booster turns end over end on its engines and its
  // cold-gas thrusters, venting ullage gas from the top of the tank: in the thin air at 70 km
  // each puff flashes out wide and vanishes within a second or two.
  const flipVent = new Vapor({
    name: 'vapor-flip', rng: seeded(25), accel: [0, 0, 0], tau: 0.6, opacity: 0.18,
    emitters: [0.4, 2.5, 4.6].map(a => ({ at: around(4.4, BOOSTER_TOP - 2.5, a), dir: out(a, 0.3), speed: 30, spread: 0.6, count: nv(14), life: 1.4, size: 4, grow: 26, jitter: 0.8, window: [EVENTS.separation + 1.5, EVENTS.boostbackStart + 2] })),
  });
  booster.add(flipVent.mesh);
  // The landing burn trails dark smoke: on the flight 5 catch photograph a grey-brown stream
  // pours off the engine section and hangs in the air above the booster as it comes down.
  // Each puff leaves from where the engine bay was when it was emitted and then stays in the
  // air, so the booster falls out of the bottom of its own trail. The source path is sampled
  // through the same transforms as the booster, 5 m up from its base.
  const SMOKE_T = [EVENTS.landingBurn, EVENTS.catch + 4], SMOKE_N = 256;
  const smokePath = (() => {
    const pts = new Float32Array(SMOKE_N * 3), m = new THREE.Matrix4(), mm = new THREE.Matrix4(), v = new THREE.Vector3();
    mm.compose(ex.model.position, new THREE.Quaternion().setFromEuler(ex.model.rotation), new THREE.Vector3(1, 1, 1));
    for (let i = 0; i < SMOKE_N; i++) {
      const ts = SMOKE_T[0] + (SMOKE_T[1] - SMOKE_T[0]) * i / (SMOKE_N - 1);
      m.makeRotationZ(-boosterPitchAt(ts)).setPosition(boosterDownAt(ts), boosterAltAt(ts), 0).multiply(mm);
      v.copy(boosterHome.position).add(new THREE.Vector3(0, BOOSTER_AFT + 5, 0)).applyMatrix4(m);
      pts.set([v.x, v.y, v.z], i * 3);
    }
    return { t0: SMOKE_T[0], t1: SMOKE_T[1], points: pts };
  })();
  const landingSmoke = new Vapor({
    // Faint, brown and spreading: on SpaceX's flight 5 final-approach photograph (Commons,
    // 54063904149) the trail is a thin tan smear drifting off to one side, the sky showing
    // through it, not an opaque grey column. At 0.2 it stood above the booster like a chimney.
    name: 'vapor-landing-smoke', rng: seeded(28), accel: [2.2, 0.3, 1.1], tau: 1.2, opacity: 0.05, path: smokePath,
    colors: [0x9c9083, 0x6b6259], fadeIn: 0.015,
    // Seen from below, the camera looks down the length of the trail, and a few hundred
    // puffs along one line of sight add up to an opaque column whatever each one's opacity:
    // 70 a source, 24 m and growing fast, drifting off with the wind, keep it a smear. Half
    // the sources stop as the booster slows over the pad and the rest a few seconds before
    // the catch, so the smoke does not pile up where the booster lingers.
    emitters: [0.5, 2.1, 3.7, 5.3].map((a, i) => ({ at: around(3, 0, a), dir: out(a, 0.4), speed: 7, spread: 0.5, count: nv(70), life: 12, size: 24, grow: 9, jitter: 3, window: [EVENTS.landingBurn + 0.5, i % 2 ? BURN_THREE + 5 : EVENTS.catch - 5] })),
  });
  ex.group.add(landingSmoke.mesh);

  // The ascent trail. Methalox burns to water and carbon dioxide, and every launch video shows
  // what that water does in the cold air behind the vehicle: a white trail, thin and bright
  // near the ground, then broader and drifting, that stays in the sky long after the rocket
  // has gone. The stack left none, so the sky behind it was empty. It starts behind the
  // bright part of the plume and stops by ~20 km, where the air is too thin to hold it
  // (≈ both; puff sizes and the fade are reconstructed from footage, not measured).
  const TRAIL_T = [EVENTS.liftoff + 6, 100], TRAIL_N = 240;
  const trailPath = (() => {
    const pts = new Float32Array(TRAIL_N * 3), m = new THREE.Matrix4(), mm = new THREE.Matrix4(), v = new THREE.Vector3();
    mm.compose(ex.model.position, new THREE.Quaternion().setFromEuler(ex.model.rotation), new THREE.Vector3(1, 1, 1));
    for (let i = 0; i < TRAIL_N; i++) {
      const ts = TRAIL_T[0] + (TRAIL_T[1] - TRAIL_T[0]) * i / (TRAIL_N - 1);
      const back = 40 + altitudeAt(ts) * 0.004;        // behind the bright column, which lengthens with height
      m.makeRotationZ(-pitchAt(ts)).setPosition(downrangeAt(ts), altitudeAt(ts), 0).multiply(mm);
      v.set(0, -back, 0).applyMatrix4(m);
      pts.set([v.x, v.y, v.z], i * 3);
    }
    return { t0: TRAIL_T[0], t1: TRAIL_T[1], points: pts };
  })();
  const ascentTrail = new Vapor({
    name: 'vapor-ascent-trail', rng: seeded(31), accel: [0.35, 0.04, 0.2], tau: 2.5, opacity: 0.2, path: trailPath,
    colors: [0xf4f5f6, 0x9aa1ab], fadeIn: 0.02,
    // Dense enough to read as one line from kilometres off, not a string of beads.
    emitters: [0, 2.1, 4.2].map((a) => ({ at: around(2, 0, a), dir: out(a, 0), speed: 3, spread: 0.6, count: nv(420), life: 34, size: 30, grow: 5, jitter: 8, window: TRAIL_T })),
  });
  ex.group.add(ascentTrail.mesh);
  const vapors = [countdownVent, cascade, basePile, deluge, landingSpray, catchVent, flipVent, landingSmoke, ascentTrail];
  for (const vp of vapors) vp.material.uniforms.uPad.value.set(ex.lay.x, ex.lay.z);

  // Max-Q: a condensation collar off the hot-stage ring, trailing down the booster, through
  // the transonic climb and peak dynamic pressure. Timing follows the ascent's own Max-Q.
  const collar = new CondensationCollar({ radius: 4.5, spread: 7.5, length: 30, y: (ex.model.userData.stations?.booster?.height ?? 71.93) - 0.8 });
  booster.add(collar.mesh);
  const collarShip = new CondensationCollar({ radius: 4.5, spread: 5, length: 16, y: 12, name: 'condensation-collar-ship' });
  ship.add(collarShip.mesh);
  // Tagged as effects: they hang off the vehicle's own groups, and a volume of vapour or a
  // plume's bounding box is not part of the vehicle. The dimensional check measured the stack
  // 1 m tall for as long as they were there — puffs of vapour parked half a metre under the
  // engines and plume boxes a metre under them — and passed only because the tolerance was 2 %.
  for (const o of [boosterPlume.group, shipPlume.group, boosterJets.mesh, shipJets.mesh, hotStageVents.mesh,
    stageGlow.mesh, rest, catchVent.mesh, flipVent.mesh, landingSmoke.mesh, ascentTrail.mesh, collar.mesh, collarShip.mesh]) o.userData.fx = true;
  const collarAt = (t) => {
    const k = THREE.MathUtils.smoothstep(t, EVENTS.maxQ - 22, EVENTS.maxQ - 12) * (1 - THREE.MathUtils.smoothstep(t, EVENTS.maxQ + 6, EVENTS.maxQ + 14));
    // Flickers as it forms and sheds, the way it does on film.
    return k * (0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.2));
  };

  const cloud = new GroundCloud({ rng: seeded(11), count: quality.cloudParticles ?? 860 });
  cloud.points.position.set(ex.lay.x, 0, ex.lay.z);
  cloud.setPad(ex.lay.x, ex.lay.z);
  scene.add(cloud.points);
  // Emission is budgeted to the ring. At ~190 puffs a second living ~20 s, the high tier's 1600
  // slots were overwritten at ~8 s, halfway through each puff's life: the cloud popped away in
  // pieces and never built into a mass. Rates are now a share of the ring (≈ 0,95 of it alive
  // at the peak), and a smaller ring gets fewer, larger puffs covering the same volume.
  const CLOUD_RATE = cloud.count / 1600;
  const CLOUD_SIZE = Math.sqrt(1 / CLOUD_RATE);

  // Fire out of the trench. The 33 jets go down into the flame trench and leave through its two
  // mouths, 44 m either side of the mount, as flame for the first seconds and then as the
  // cloud. It was only a glow painted on the cloud; photographs of the flight 5 liftoff show
  // flame itself rolling out of the trench ends. Three turbulent jets per mouth, no shock
  // diamonds (the flow has hit the deflector), fading as the vehicle climbs.
  // Fire, not jets: it leaves each mouth as a rolling mass of flame that slows, spreads, lifts
  // and burns out into the smoke and steam of the cloud, so the cloud is seen to come out of
  // the trench instead of starting in mid-air beside a flat orange streak.
  const trenchFire = new Fire({
    name: 'fire-trench', rng: seeded(41), gain: 1.7, smoke: 0.5, smokeColor: 0x8a8076, occlude: 0.22,
    emitters: [1, -1].flatMap(sz => [-6, 0, 6].map(x => ({ at: [x, 2.8, sz * 38], dir: [x * 0.015, 0.1, sz], count: Math.round(46 * fireScale) }))),
  });
  trenchFire.mesh.position.set(ex.lay.x, 0, ex.lay.z);
  scene.add(trenchFire.mesh);
  // Fire over the mount's deck. Standing on the mount, the 33 engines fire down through its
  // 11 m opening into the trench; as the vehicle climbs, the column widens past the opening
  // and its outer part hits the deck and is thrown out sideways over it — a wall jet, as any
  // jet does against a plate — rolling off the edges of the mount. It lasts from a few metres
  // up until the column is too thin at deck level to matter (≈ both heights, from the jet's
  // widening; not measured).
  const deckFire = new Fire({
    name: 'fire-deck', rng: seeded(43), gain: 1.6, smoke: 0.35, smokeColor: 0x8d8379, occlude: 0.2,
    emitters: Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      return { at: [Math.sin(a) * (PAD.openingR + 0.8), PAD.deckTop + 0.6, Math.cos(a) * (PAD.openingR + 0.8)], dir: [Math.sin(a), 0.12, Math.cos(a)], count: Math.round(12 * fireScale) };
    }),
  });
  deckFire.mesh.position.set(ex.lay.x, 0, ex.lay.z);
  scene.add(deckFire.mesh);
  const deckFireAt = (t) => {
    const h = altitudeAt(t);
    return boosterThrottle(t) * THREE.MathUtils.smoothstep(h, 1, 8) * (1 - THREE.MathUtils.smoothstep(h, 30, 90));
  };
  // The light under the vehicle at liftoff: 33 Raptors a few metres over the mount are the
  // brightest thing for kilometres, and the camera sees a blinding glare through and round the
  // mount, not only the part of the column that clears it. A glow, blooming, at the engines.
  const baseGlare = new Glow({ name: 'glow-liftoff', color: 0xfff4dc, edge: 0xffa040 });
  baseGlare.mesh.position.set(0, -5, 0);
  booster.add(baseGlare.mesh);
  baseGlare.mesh.userData.fx = true;
  const trenchFireAt = (t) => boosterThrottle(t) * (1 - THREE.MathUtils.smoothstep(altitudeAt(t), 15, 160));

  // Above ~10 km the flat 1:1 site runs out long before the horizon: a curved Earth with a
  // limb takes over from there, following the camera over the ground.
  const flightEarth = new FlightEarth();
  flightEarth.setOrigin(ex.lay.x, ex.lay.z);
  scene.add(flightEarth.group);

  // The viewer's near plane follows the orbit distance (main.js), so the value to put back is
  // whatever it was when the sequence took the camera, not what it was at construction. On the
  // pad the sequence uses a fixed near plane of its own: its cameras work metres from the hull.
  const PAD_NEAR = 0.15;
  function saveCameraPlanes() { home.near = camera.near; home.far = camera.far; }

  // ---- Saved state, so reset() puts everything back exactly ----------------------------
  // Frost on the loaded tanks: shown for the sequence (the exhibit on its stand is dry), full
  // on the pad, shedding through the ascent as the vehicle shakes and the propellant drains.
  const frostShells = ['booster-frost', 'ship-frost'].map(n => ex.model.getObjectByName(n)).filter(Boolean);
  // Each shell gets its own copy of the frost material, so the booster's can go while the
  // ship's stays: the returning booster has drained its tanks, and SpaceX's photograph of the
  // Flight 5 landing burn shows no frost on it. Kept at 40 % it painted the returning booster
  // white from MECO to the catch.
  const frostMats = frostShells.map((f) => {
    const m = f.children[0]?.material?.clone();
    if (m) f.traverse((o) => { if (o.isMesh) o.material = m; });
    return m;
  });
  function applyFrost(t, on) {
    const k = !on ? 0 : t < EVENTS.liftoff + 15 ? 1
      : THREE.MathUtils.lerp(1, 0.4, THREE.MathUtils.smoothstep(t, EVENTS.liftoff + 15, EVENTS.meco));
    frostShells.forEach((f, i) => {
      const kf = f.name === 'booster-frost' ? k * (1 - THREE.MathUtils.smoothstep(t, EVENTS.separation, EVENTS.boostbackEnd)) : k;
      f.visible = kf > 0.01;
      if (frostMats[i]) frostMats[i].opacity = 0.9 * kf;
    });
  }

  // Soot on the returning booster (library.js, sootable): none on the pad or in the ascent;
  // the boostback relight, with its plume recirculating round the engine bay, puts the first
  // of it on, and reentry heating the rest before the landing burn. Clean again on reset.
  const soot = booster?.userData.soot;
  function applySoot(t, on) {
    if (!soot) return;
    soot.value = !on ? 0
      : 0.4 * THREE.MathUtils.smoothstep(t, EVENTS.boostbackStart, EVENTS.boostbackEnd)
      + 0.6 * THREE.MathUtils.smoothstep(t, EVENTS.boostbackEnd + 60, EVENTS.landingBurn - 20);
  }

  const home = {
    near: camera.near, far: camera.far,
    shadows: env.sun.castShadow,
    clamps: parts.holddowns.children.map(c => c.position.clone()),
    boosterQds: (parts.boosterQds ?? []).map(q => q.position.clone()),
  };

  const state = {
    running: false, armed: false, paused: false, t: EVENTS.start, speed: 1,
    // Who the camera is on when the visitor holds it: 'booster' or 'ship' (their orbit rides
    // along with that vehicle), or 'director' for the broadcast shot list.
    follow: 'director',
    phase: 'On the pad', altitude: 0, velocity: 0, throttle: 0, downrange: 0,
    ship: { altitude: 0, velocity: 0, lit: 0 }, booster: { altitude: 0, velocity: 0, lit: 0 }, next: null,
  };
  let visibilityHook = null;   // set by main.js: hides labels, rulers and figures while flying

  // ---- Camera ---------------------------------------------------------------------------
  const S = new THREE.Vector3(ex.lay.x, 0, ex.lay.z);        // site origin, on grade
  const PAD_CATCH_Y = ex.lay.mount + CATCH_ALT + 34;         // roughly the middle of the caught booster
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _pad = new THREE.Vector3();
  const _p2 = new THREE.Vector3(), _q2 = new THREE.Vector3();

  /**
   * Where the middle of the stack actually is, which is not simply "up": once the gravity
   * turn starts the vehicle rotates about its own base, so the mid-body swings downrange.
   */
  // The booster's mid-body, in world space, for the return shots.
  function boosterAt(t, out) {
    const p = boosterPitchAt(t), r = 36;
    return out.set(
      S.x + boosterDownAt(t) + Math.sin(p) * r,
      ex.lay.mount + boosterAltAt(t) + Math.cos(p) * r,
      S.z,
    );
  }

  function vehicleAt(t, out) {
    const p = pitchAt(t), r = 58;
    return out.set(
      S.x + downrangeAt(t) + Math.sin(p) * r,
      altitudeAt(t) + ex.lay.mount + Math.cos(p) * r,
      S.z,
    );
  }

  // The ship turns about its own middle, not about the booster's engines. The flight group's
  // origin is the stack's base (the engines' exit plane), which is right until separation;
  // after it the group carries the ship alone, and once the ship steers on its own (it pitches
  // up ~20° in the first seconds) rotating that group swung a 52 m ship round a point 72 m
  // below it — sideways by tens of metres, and through the booster. After separation the
  // integrated trajectory moves the ship's middle, and the group is placed so the ship
  // rotates about it.
  const SHIP_PIVOT = shipHome + 26;
  const ATT_SEP = pitchAt(EVENTS.separation);
  function shipMidAt(t, out) {
    const a = t <= EVENTS.separation ? pitchAt(t) : ATT_SEP;
    return out.set(S.x + downrangeAt(t) + Math.sin(a) * SHIP_PIVOT, ex.lay.mount + altitudeAt(t) + Math.cos(a) * SHIP_PIVOT, S.z);
  }
  /** What a visitor's orbit rides on during the sequence. */
  function focusAt(t, out) {
    if (t < EVENTS.separation) return vehicleAt(t, out);
    if (state.follow === 'ship') return shipMidAt(t, out);
    return boosterAt(t, out);
  }
  let followPrev = null;
  const _gapA = new THREE.Vector3(), _gapB = new THREE.Vector3(), _gapC = new THREE.Vector3();
  const _fo = new THREE.Vector3();
  /**
   * The visitor holds the camera but it rides with the rocket: the orbit's centre moves with
   * the vehicle, and the camera by the same amount, so a drag or a pause and resume still
   * leaves it on the rocket. Before this, taking the camera froze it where the shot list had
   * put it, and the rocket climbed out of frame within seconds, pause or no pause.
   */
  function followCamera(t) {
    // 'none' is the behaviour before the ride existed, kept only as the gate's negative control.
    if (state.follow === 'none') { followPrev = null; return; }
    focusAt(t, _fo);
    if (!followPrev) {
      rig.target.copy(_fo);
      followPrev = _fo.clone();
      return;
    }
    const dx = _fo.x - followPrev.x, dy = _fo.y - followPrev.y, dz = _fo.z - followPrev.z;
    camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
    rig.target.x += dx; rig.target.y += dy; rig.target.z += dz;
    followPrev.copy(_fo);
  }

  /** Shot list. Each writes a world position and look-at target for the mission time. */
  // The terminal count and the liftoff are cut the way a launch broadcast cuts them: a few
  // held shots with hard cuts between, each moving slowly, rather than one camera flying
  // between positions. A fast dolly between two pad positions (it used to cross 130 m in
  // 1,6 s at T+6) reads as a glitch, not as a cut.
  const ease = (t, a, b) => THREE.MathUtils.smoothstep(t, a, b);
  // After the catch the broadcast cuts back to the ship for its engine cutoff.
  const SHIP_FINALE = EVENTS.catch + 10;
  const SHOTS = [
    { until: -28, blend: 0, shot: (t, pos, tgt) => {
      // Establishing: the whole site from 800 m out, low over the flats, drifting in.
      const u = ease(t, EVENTS.start, -28);
      pos.set(S.x + THREE.MathUtils.lerp(780, 690, u), 10, S.z + THREE.MathUtils.lerp(330, 270, u));
      tgt.set(S.x, THREE.MathUtils.lerp(64, 70, u), S.z);
    } },
    { until: EVENTS.deflector - 1, blend: 0, shot: (t, pos, tgt) => {
      // The fuelled stack from the tower's height: frost on the tanks and boil-off venting
      // from the booster and the ship, sinking down the hull. Square to the tower-stack line
      // (down the trench axis, harmless before ignition) so the tower stands beside the
      // vehicle rather than behind it — and on the ship's lee side, where the frost is, with
      // the tower to the right: the angle of SpaceX's wet-dress-rehearsal photograph.
      const u = ease(t, -28, EVENTS.deflector - 1);
      pos.set(S.x + THREE.MathUtils.lerp(28, 14, u), THREE.MathUtils.lerp(100, 90, u), S.z - THREE.MathUtils.lerp(152, 136, u));
      tgt.set(S.x, ex.lay.mount + THREE.MathUtils.lerp(74, 62, u), S.z);
    } },
    { until: EVENTS.ignition + 1.2, blend: 0, shot: (t, pos, tgt) => {
      // The mount: the diverter's water coming up at T−17, the quick disconnect swinging
      // clear, and the first engines lighting under the skirt.
      const u = ease(t, EVENTS.deflector - 1, EVENTS.ignition + 1.2);
      pos.set(S.x + THREE.MathUtils.lerp(64, 58, u), THREE.MathUtils.lerp(15, 13, u), S.z + THREE.MathUtils.lerp(40, 50, u));
      tgt.set(S.x, ex.lay.mount + THREE.MathUtils.lerp(10, 12, u), S.z);
    } },
    { until: EVENTS.liftoff + 12, blend: 0, shot: (t, pos, tgt) => {
      // Liftoff from the ground, 350 m off to the east-south-east: the tower and the whole
      // stack in frame, the steam going out of both trench mouths across the picture, and the
      // camera tilting to keep the vehicle as it climbs past the tower top.
      pos.set(S.x + 318, 4, S.z + 152);
      const alt = altitudeAt(t);
      tgt.set(S.x + downrangeAt(t) * 0.8, ex.lay.mount + 60 + alt * 0.86, S.z);
    } },
    { until: EVENTS.liftoff + 46, blend: 3.0, shot: (t, pos, tgt) => {
      // Picks the vehicle up and holds it against the pad, which is now well below.
      vehicleAt(t, tgt);
      const d = 300;
      pos.set(tgt.x - d * 0.34, tgt.y - d * 0.34, tgt.z + d * 0.88);
    } },
    { until: EVENTS.meco - 8, blend: 2.5, shot: (t, pos, tgt) => {
      // Chase. The stand-off grows slowly so the vehicle keeps its size in frame while the
      // sky behind it drains to black.
      vehicleAt(t, tgt);
      const d = 270 + altitudeAt(t) * 0.0034;
      const a = 0.7 + t * 0.0042;
      pos.set(tgt.x + Math.cos(a) * d * 0.66, tgt.y - d * 0.30, tgt.z + Math.sin(a) * d * 0.82);
    } },
    { until: EVENTS.boostbackStart + 2, blend: 3.0, shot: (t, pos, tgt) => {
      // Separation: side on, and pulling back so both stages stay in frame as they part.
      // The aim point slides from the stack onto the booster before the boostback: once it
      // relights the two part at ~150 m/s² and no stand-off holds both, and a shot still
      // centred on the ship left the booster out of frame from T+2:45 to T+2:49, and for
      // half a second of the hand-over neither vehicle was in the picture.
      vehicleAt(t, tgt);
      boosterAt(t, _pad);
      const gap = tgt.distanceTo(_pad);
      tgt.lerp(_pad, ease(t, EVENTS.separation + 1, EVENTS.boostbackStart));
      const d = 340 + Math.min(gap, 400) * 0.6;
      pos.set(tgt.x + d * 0.26, tgt.y - d * 0.20, tgt.z + d * 0.94);
    } },
    { until: EVENTS.landingBurn - 26, blend: 4.0, shot: (t, pos, tgt) => {
      // The booster is the story from here. Held against the curve of its own trajectory,
      // far enough out that the flip and the boostback burn read.
      boosterAt(t, tgt);
      const d = 420;
      pos.set(tgt.x - d * 0.42, tgt.y + d * 0.16, tgt.z + d * 0.90);
    } },
    { until: EVENTS.catch - 6, blend: 4.0, shot: (t, pos, tgt) => {
      // Coming home: from beside the tower, looking up the line the booster is falling down,
      // so the pad enters frame underneath it as it arrives.
      // It used to hold a fixed spot near the pad and rise only halfway to the booster, which
      // at the landing burn left it 5 km away: a one-pixel dot on blue sky. Now it rides down
      // with the booster, ~400 m off and 140 m beneath it, and settles onto the tower-side
      // position as the booster nears the ground, so the pad enters frame as it arrives.
      boosterAt(t, tgt);
      const low = 1 - THREE.MathUtils.smoothstep(tgt.y, 250, 1800);   // 0 high up, 1 near the pad
      pos.set(
        THREE.MathUtils.lerp(tgt.x + 160, S.x + 150, low),
        Math.max(128, THREE.MathUtils.lerp(tgt.y - 140, 128, low)),
        S.z + THREE.MathUtils.lerp(400, 190, low),
      );
    } },
    { until: SHIP_FINALE, blend: 3.0, shot: (t, pos, tgt) => {
      // The catch itself, from the height of the arms: the booster comes down into frame and
      // stops, and the tower is beside it for scale.
      const k = THREE.MathUtils.clamp((t - (EVENTS.catch - 6)) / 14, 0, 1);
      boosterAt(t, tgt);
      tgt.lerp(_pad.set(S.x, PAD_CATCH_Y, S.z), k * 0.65);
      pos.set(S.x + 118, THREE.MathUtils.lerp(122, 104, k), S.z + THREE.MathUtils.lerp(150, 104, k));
    } },
    { until: Infinity, blend: 0, shot: (t, pos, tgt) => {
      // Meanwhile, 195 km up and 1 200 km downrange: the ship finishing its burn. A hard cut, as
      // the broadcast makes it, and held beside and a little behind so the plume goes out at
      // the cited engine cutoff (T+8:11) in frame.
      shipMidAt(t, tgt);
      const a = pitchAt(t);
      pos.set(tgt.x - Math.sin(a) * 150, tgt.y - Math.cos(a) * 150 + 30, tgt.z + 210);
    } },
  ];

  function driveCamera(t) {
    let i = 0;
    while (i < SHOTS.length - 1 && t >= SHOTS[i].until) i++;
    SHOTS[i].shot(t, _p, _q);
    const s = SHOTS[i];
    if (i > 0 && s.blend > 0) {
      const started = SHOTS[i - 1].until;
      const k = THREE.MathUtils.clamp((t - started) / s.blend, 0, 1);
      if (k < 1) {
        SHOTS[i - 1].shot(t, _p2, _q2);
        const e = k * k * (3 - 2 * k);
        _p.lerpVectors(_p2, _p, e);
        _q.lerpVectors(_q2, _q, e);
      }
    }
    shake(t, _p, _q);
    camera.position.copy(_p);
    rig.target.copy(_q);
    camera.lookAt(_q);
  }

  /**
   * Ground shake near the pad, as the camera would feel it: it arrives with the sound, at
   * 343 m/s from the engines, so a camera 350 m out starts shaking 1 s after the light does,
   * and it falls off with distance and with the booster's height. Deterministic in mission
   * time, so a seek reproduces it. Off when the visitor asks the system for reduced motion.
   */
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shake(t, pos, tgt) {
    if (reduceMotion || t < EVENTS.ignition || t > EVENTS.liftoff + 40) return;
    const src = _pad.set(S.x + downrangeAt(t), ex.lay.mount + altitudeAt(t), S.z);
    const d = pos.distanceTo(src);
    const heard = t - d / 343;
    const k = boosterThrottle(heard) * Math.min(1, 380 / Math.max(d, 1)) * (1 - THREE.MathUtils.smoothstep(altitudeAt(heard), 400, 2500));
    if (k < 0.01) return;
    // Angular jitter in radians, a few hundredths of a degree at full strength: a tripod on
    // shaking ground, not a handheld.
    const amp = 0.0016 * k * pos.distanceTo(tgt);
    const n = (a, b, c) => Math.sin(t * a + c) * 0.55 + Math.sin(t * b + c * 1.7) * 0.45;
    tgt.x += amp * n(37.1, 61.7, 0.3);
    tgt.y += amp * n(43.3, 71.9, 1.1);
    tgt.z += amp * n(29.9, 53.3, 2.3);
  }

  // ---- Pad hardware ---------------------------------------------------------------------
  function driveHardware(t) {
    // Ship quick disconnect swings clear before ignition.
    const qd = THREE.MathUtils.clamp((t - (EVENTS.ignition - 5)) / 4, 0, 1);
    parts.qdArm.rotation.y = -THREE.MathUtils.degToRad(112) * (qd * qd * (3 - 2 * qd));
    // Reconstructed release timing/stroke: both fluid heads withdraw before liftoff.
    // Fixed housings and supply lines remain on the mount.
    const boosterRelease = THREE.MathUtils.smoothstep(t, EVENTS.liftoff - 1.4, EVENTS.liftoff - 0.4);
    (parts.boosterQds ?? []).forEach((q, i) => {
      q.position.copy(home.boosterQds[i]); q.position.x += 1.2 * boosterRelease;
    });
    // Hold-downs release at liftoff and retract radially out of the way.
    const rel = THREE.MathUtils.clamp((t - EVENTS.liftoff) / 0.7, 0, 1);
    parts.holddowns.children.forEach((c, i) => {
      const h = home.clamps[i];
      const k = rel * 1.05;
      c.position.set(h.x * (1 + k * 0.22), h.y, h.z * (1 + k * 0.22));
    });
  }

  /**
   * Steam, water deluge and dust leaving strictly through the two trench mouths (<- ->).
   * Deluge activates prior to ignition, then vaporizes violently upon engine start.
   * Confinement: The pad has concrete walls on X; exhaust is forced solely along Z (North & South).
   */
  const CLOUD_UNTIL = EVENTS.liftoff + 34;
  const CLOUD_STEP = 1 / 30;
  let cloudTick = 0;
  function resetCloud() {
    cloud.reset(seeded(11));
    cloudTick = 0;
  }
  // Integer ticks give playback and seeking the same random samples, emission counts and
  // integration intervals, independent of render rate or mission speed. Never cap cloud
  // time separately from mission time: doing so leaves smoke hanging around at ×10.
  function advanceCloud(t) {
    const target = Math.max(0, Math.floor((t - EVENTS.start) / CLOUD_STEP + 1e-7));
    while (cloudTick < target) {
      const u = EVENTS.start + cloudTick * CLOUD_STEP;
      // Once all launch puffs have died, the coast contains no cloud work to replay.
      if (!cloud.live && u >= CLOUD_UNTIL && u < EVENTS.catch - 16) {
        cloudTick = Math.min(target, Math.round((EVENTS.catch - 16 - EVENTS.start) / CLOUD_STEP));
        continue;
      }
      emitCloud(u, CLOUD_STEP);
      cloud.update(CLOUD_STEP, camera, env.sun);
      cloudTick++;
    }
  }
  function emitCloud(t, dt) {
    // The landing burn kicks up its own cloud off the pad as the booster settles into the
    // arms. Same trench mouths, much less of it: three engines, not thirty-three.
    if (t >= EVENTS.catch - 16 && t <= EVENTS.catch + 8) {
      // The landing burn's exhaust only reaches the deck in the last few tens of metres: the
      // centre three throw a ~50 m column, and on the flight 5 catch photograph it still ends
      // in clear air with the booster level with the arms. From 700 m the trench used to pour
      // steam with the booster a speck overhead, and until this round it still billowed up
      // either side of the pad with the booster 180 m up.
      const near = 1 - THREE.MathUtils.smoothstep(boosterAltAt(t), 30, 90);
      // …and only while they burn: it kept pouring for 8 s after shutdown in the arms.
      const burning = Math.min(1, boosterEngineThrottle(t) / 0.1);
      const n2 = near * burning * 10 * CLOUD_RATE * dt;
      if (n2 >= 0.05) {
        const m2 = Math.max(1, Math.round(n2 * 0.35));
        // Three engines, briefly, into a deck already wet: steam, not a thunderhead. Fewer,
        // larger puffs that grow into one another, so it reads as a sheet of vapour and not
        // as a pile of separate cotton balls hanging in the air.
        const k = { size0: 14 * CLOUD_SIZE, grow: 34 * CLOUD_SIZE };
        cloud.emit(m2, [0, 2.4, 44], [0, 0.05, 1.0], 46, 16, k);
        cloud.emit(m2, [0, 2.4, -44], [0, 0.05, -1.0], 46, 16, k);
      }
      return;
    }
    if (t < EVENTS.deflector || t >= CLOUD_UNTIL) return;

    // 1. Flame deflector activation (cited T−10) to ignition: water floods the steel plate and
    // a cold white mist rolls out of both mouths (<- ->), thickening as the flow comes up.
    if (t < EVENTS.ignition) {
      const deluge = 0.35 + 0.65 * THREE.MathUtils.smoothstep(t, EVENTS.deflector, EVENTS.ignition);
      const nWater = deluge * THREE.MathUtils.smoothstep(t, EVENTS.deflector, EVENTS.deflector + 1.5) * 14 * CLOUD_RATE * dt;
      if (nWater < 0.05) return;
      const m = Math.max(1, Math.round(nWater * 0.5));
      const k = { size0: 12 * CLOUD_SIZE, grow: 52 * CLOUD_SIZE };
      // North mouth (+Z)
      cloud.emit(m, [0, 2.2, 44], [0, 0.05, 1.0], 40, 18, k);
      // South mouth (-Z)
      cloud.emit(m, [0, 2.2, -44], [0, 0.05, -1.0], 40, 18, k);
      return;
    }

    // 2. High-energy rocket ignition and liftoff deluge vaporization (T-3 to T+34)
    // 33 Raptors blast into the steel deflector ridge. Most of the exhaust and steam is
    // channelled in TWO opposing directions (<- ->) along the flame trench axis, +Z and -Z.
    const alt = altitudeAt(t);
    const drive = boosterThrottle(t) * Math.max(0, 1 - alt / 380);
    // Measured against the flight 5 liftoff (Wikimedia Commons, "Liftoff of SpaceX IFT-5"):
    // seconds after liftoff the cloud off the two trench mouths is several hundred metres
    // across and taller than the tower's lower half. It was a few grey puffs. Faster out of
    // the mouths, larger, longer-lived and more of it; the ring buffer was enlarged to hold it.
    const n = drive * 62 * CLOUD_RATE * dt;
    if (n < 0.05) return;

    // Exactly 50% North (+Z) and 50% South (-Z). Fewer, larger puffs than before, each living
    // its whole life (see CLOUD_RATE), overlapping into one mass.
    const trenchCount = Math.max(1, Math.round(n * 0.5));
    // Born small, inside the fire at the mouth, and grown from there: at 24 m from birth each
    // puff was already a cloud when it appeared.
    const big = { size0: 11 * CLOUD_SIZE, grow: 190 * CLOUD_SIZE, life0: 12, lifeVar: 14 };
    cloud.emit(trenchCount, [0, 2.6, 44], [0, 0.10, 1.0], 125, 22, big);
    cloud.emit(trenchCount, [0, 2.6, -44], [0, 0.10, -1.0], 125, 22, big);
    // Dust. The blast scours the flats beyond each mouth and the pad itself, and in the Flight 12
    // photographs from Pad 2 a low brown haze spreads along the ground under and between the two
    // steam towers. Slower, wider, heavy (it barely rises) and translucent; it is what joins the
    // two clouds into one scene instead of two separate cotton balls.
    const dustCount = Math.max(1, Math.round(n * 0.1));
    const haze = { size0: 20 * CLOUD_SIZE, grow: 150 * CLOUD_SIZE, life0: 14, lifeVar: 12, kind: 1 };
    cloud.emit(dustCount, [0, 2.0, 50], [0, 0.02, 1.0], 70, 40, haze);
    cloud.emit(dustCount, [0, 2.0, -50], [0, 0.02, -1.0], 70, 40, haze);
    if (t > EVENTS.liftoff - 1 && t < EVENTS.liftoff + 8) {
      // Sideways off the pad as the vehicle clears the mount: the exhaust spills over the deck.
      for (const [dx, dz] of [[1, 0], [-1, 0]]) {
        cloud.emit(Math.max(1, Math.round(dustCount * 0.5)), [dx * 20, 5.5, dz], [dx, 0.02, 0], 40, 30, haze);
      }
    }

    // ...but not all of it. The trench takes the exhaust; the deluge does not go with it.
    // Thousands of litres a second flash to steam ON the deck and boil up around the mount,
    // and every launch camera near the pad is looking through that. With the two mouths as
    // the only sources, a shot framed on the vehicle at T+6 showed a smudge forty metres away
    // on one side and clean air everywhere else — the pad looked like nothing was happening.
    // Small, short-lived and low: deluge steam, not a second thunderhead. At the trench's
    // own growth rate these puffs reached ninety metres across in a few seconds and buried
    // the whole 124 m stack. They were still thrown upward at 11 m/s on top of the cloud's
    // buoyancy, which stood them up into a grey sheath round the climbing vehicle; the steam
    // off a deck rolls outward over its edge, so it leaves nearly flat.
    const near = Math.max(1, Math.round(n * 0.3));
    for (const [px, pz] of [[16, 11], [-16, 11], [16, -11], [-16, -11]]) {
      const r = Math.hypot(px, pz);
      cloud.emit(Math.max(1, Math.round(near / 4)), [px, 18.5, pz],
        [px / r * 0.95, 0.08, pz / r * 0.95], 24, 10,
        { size0: 8 * CLOUD_SIZE, grow: 30 * CLOUD_SIZE, life0: 3.5, lifeVar: 3.5 });
    }
  }

  // ---- The one function that maps a mission time to the whole scene ---------------------
  function apply(t) {
    applyFrost(t, true);
    applySoot(t, true);
    const alt = altitudeAt(t);
    const bt = boosterThrottle(t), st = shipThrottle(t);

    const att = pitchAt(t);
    if (t <= EVENTS.separation) flight.position.set(downrangeAt(t), alt, 0);
    else {
      // Pivot on the ship's middle (see SHIP_PIVOT): the trajectory point carries the offset it
      // had at separation, and the group is placed so the middle stays on it as the ship turns.
      flight.position.set(downrangeAt(t) + SHIP_PIVOT * (Math.sin(ATT_SEP) - Math.sin(att)),
        alt + SHIP_PIVOT * (Math.cos(ATT_SEP) - Math.cos(att)), 0);
    }
    flight.rotation.z = -att;

    // Hot staging. The ship keeps flying the ascent profile (its own engines, still
    // accelerating) and the booster its integrated return (three engines off, gravity and a
    // little drag), so the gap between them opens on its own at their difference in
    // acceleration — about 11 m/s² — without a separate push that the panel knew nothing of.
    shipToStack();

    // The booster on its own trajectory. Up to separation it is exactly where the stack is;
    // after it, it flies the return. Its attitude is part of that trajectory, so nothing here
    // adds a tilt or a drift of its own.
    detachBooster(true);
    const bAlt = boosterAltAt(t);
    boosterFlight.position.set(boosterDownAt(t), bAlt, 0);
    boosterFlight.rotation.z = -boosterPitchAt(t);
    booster.position.x = boosterHome.position.x;
    booster.rotation.z = 0;

    // The catch: the carriage rides up the tower as the booster comes home, and the arms close
    // on it in the last seconds of the landing burn.
    const ride = THREE.MathUtils.smoothstep(t, EVENTS.landingBurn - 60, EVENTS.landingBurn + 6);
    chop.position.y = THREE.MathUtils.lerp(chopHome.y, CATCH_CARRIAGE, ride);
    parts.hoist?.(chop.position.y);
    const close = THREE.MathUtils.smoothstep(t, BURN_THREE, EVENTS.catch - 1);
    for (const a of chopHome.arms) {
      const s2 = a.ry < 0 ? 1 : -1;
      a.obj.rotation.y = THREE.MathUtils.lerp(a.ry, -s2 * CATCH_ARM, close);
    }

    const bThrottle = boosterEngineThrottle(t);
    boosterPlume.setTime(t);
    shipPlume.setTime(t);
    // Per engine, the running ones are near full throttle whatever the cluster total says:
    // 13 engines carrying 42 % of the cluster's thrust are each at ~100 %.
    const lit = boosterLit(t);
    const perEngine = lit ? Math.min(1, bThrottle / (lit / 33)) : 0;
    boosterPlume.setThrottle(bThrottle, bAlt, boosterSpread(t), perEngine);
    boosterJets.setTime(t);
    boosterJets.setState(perEngine, bAlt, lit);
    shipJets.setTime(t);
    // Hot staging, as it is flown: the ship lights while still latched on, its exhaust hits the
    // booster's shielded forward dome inside the open hot-stage truss and is thrown out
    // sideways through it, and only as the gap opens does the plume run free. So the ship's
    // plume stops at the dome, and the fan of flame out of the truss lasts while the gap is
    // short — not for a fixed time — which is also what it did not do before: the plume ran on
    // straight through the booster's tanks.
    ship.updateWorldMatrix(true, false);
    booster.updateWorldMatrix(true, false);
    ship.localToWorld(_gapA.set(0, 0, 0));
    booster.localToWorld(_gapB.set(0, HS_STATION, 0));
    const gap = _gapA.distanceTo(_gapB);
    // Only an obstruction while the dome is actually in the plume's path, below the ship
    // along its axis: once the booster has swung away in its flip, the plume runs free.
    ship.localToWorld(_gapC.set(0, -1, 0)).sub(_gapA).normalize();
    const inPath = gap < 1 || _gapB.clone().sub(_gapA).normalize().dot(_gapC) > Math.cos(THREE.MathUtils.degToRad(22));
    const impinge = st > 0.01 && t < EVENTS.separation + 20 && inPath ? 1 - THREE.MathUtils.smoothstep(gap, 8, 45) : 0;
    const vent = Math.min(ventAt(t) + impinge * st, 1) * (t < EVENTS.separation ? 1 : impinge > 0 ? 1 : 0);
    hotStageVents.setTime(t);
    hotStageVents.setState(vent, alt, vent > 0.01 ? 24 : 0);
    const sg = stageGlowAt(t) * (t < EVENTS.separation ? 1 : Math.max(impinge, 0.15));
    stageGlow.set(3 * sg, 26 + 46 * THREE.MathUtils.smoothstep(t, EVENTS.separation - 1.5, EVENTS.separation + 2.5), t);
    for (const vp of vapors) vp.update(t, camera, env.sun);
    collar.set(collarAt(t), t);
    collarShip.set(collarAt(t) * 0.8, t);
    const shipReach = t < EVENTS.separation + 20 && inPath ? Math.max(0.5, gap - 0.5) : Infinity;
    shipPlume.setThrottle(st, alt, 1, st, shipReach);
    shipJets.setState(st, alt, 6, shipReach);
    cloud.setFlame(bt * Math.max(0, 1 - alt / 160));
    const tf = trenchFireAt(t);
    trenchFire.setTime(t);
    trenchFire.set({ intensity: tf, life: 1.7, len: 95, drag: 2.4, r0: 4.5, widen: 0.28, size0: 7, grow: 30,
      rise: 22, stretch: 1.35, wander: 16 });
    deckFire.setTime(t);
    deckFire.set({ intensity: deckFireAt(t), life: 1.1, len: 26, drag: 1.8, r0: 1.5, widen: 0.35, size0: 5, grow: 16,
      rise: 9, stretch: 1.5, wander: 7 });
    // Glare while the column still plays on the mount and the trench, fading as it climbs away.
    const glare = bt * (1 - THREE.MathUtils.smoothstep(alt, 60, 600));
    baseGlare.set(1.6 * glare, 34 + 20 * glare, t);

    // The camera first (the shot list, or the visitor's orbit riding on the vehicle), so the
    // sky, the planes and the shadows below follow wherever it actually is.
    if (rig.external) { driveCamera(t); followPrev = null; }
    else if (rig.mode === 'orbit' && !rig.transition) followCamera(t);
    else followPrev = null;
    // The atmosphere follows whatever the camera is on: the ship until staging, the booster
    // afterwards, which is what brings the sky back as it comes down. A visitor riding with the
    // ship keeps the ship's thin sky.
    const finale = rig.external && t >= SHIP_FINALE;
    const onShip = t < EVENTS.boostbackStart || finale || (!rig.external && state.follow === 'ship');
    env.setAltitude(onShip ? alt : bAlt);
    // A 340 m shadow frustum is meaningless once the vehicle is kilometres up, and it costs
    // a full shadow pass per frame.
    // The near/far plane and the shadows follow whichever vehicle the camera is on, so the
    // pad comes back into shadow range as the booster returns to it.
    const camAlt = onShip ? alt : bAlt;
    // The shadow map stops being REDRAWN up there, but the light keeps casting: whether a
    // light casts shadows is part of every lit material's program, so switching castShadow
    // off at 1,8 km and on again for the landing recompiled every visible material twice in
    // flight — 12 programs on the way up, 26 on the way down, each a stall on a real GPU.
    const shadowLive = home.shadows && camAlt < 1800;
    if (shadowLive && !env.sun.shadow.autoUpdate) env.sun.shadow.needsUpdate = true;
    env.sun.shadow.autoUpdate = shadowLive;
    // Far plane out to past the geometric horizon, sqrt(2·R·h), with the limb shell on top.
    camera.near = camAlt > 20000 ? 2 : camAlt > 900 ? 0.8 : PAD_NEAR;
    camera.far = camAlt > 900 ? Math.max(260000, Math.sqrt(2 * 6371000 * camAlt) * 1.3 + 60000) : home.far;
    camera.updateProjectionMatrix();

    driveHardware(t);
    flightEarth.update(camera, env.sunDir, camera.position.y);

    // After staging the panel follows the booster: it is what the camera is on and what the
    // remaining milestones belong to.
    // The panel and the camera change vehicle together, at the boostback burn: reading the
    // booster's numbers under a shot of the ship is worse than either.
    const onBooster = t >= EVENTS.boostbackStart && !finale;
    state.t = t;
    state.director = !!rig.external;
    state.altitude = onBooster ? bAlt : alt;
    state.velocity = onBooster ? boosterSpeedAt(t) : speedAt(t);
    state.downrange = onBooster ? boosterDownAt(t) : downrangeAt(t);
    state.throttle = onBooster ? bThrottle : Math.max(bt, st);
    state.phase = phaseAt(t);
    // Both vehicles, the way the webcast carries them: identical until they part.
    state.ship.altitude = alt; state.ship.velocity = speedAt(t); state.ship.lit = shipLit(t);
    state.booster.altitude = bAlt; state.booster.velocity = boosterSpeedAt(t);
    state.booster.lit = boosterEngineThrottle(t) > 0.001 ? boosterLit(t) : 0;
    const next = MILESTONES.find(m => m.t > t);
    state.next = next ?? null;
  }

  // ---- Public API -------------------------------------------------------------------
  function start() {
    if (state.running) return;
    // Whoever else was driving the camera has to be told, and it has to happen here rather
    // than at the button: start() is also reachable from the API and from the check.
    // Told FIRST, then the planes saved: the re-entry chapter hands them back when it stops, and
    // saving them before that kept its 1 700 km far plane as "home" for good (audit, 30-09).
    onStart();
    saveCameraPlanes();
    state.running = true;
    state.armed = true;
    state.paused = false;
    state.follow = 'director';
    followPrev = null;
    state.t = EVENTS.start;
    resetCloud();
    visibilityHook?.(true);
    // The shot list is framed for the orbit camera's field of view, not the walk's 60° (free
    // flight keeps its own mode: its field of view is the orbit's, and the visitor may fly on).
    if (rig.mode === 'walk') rig.setMode('orbit');
    rig.external = true;
    apply(state.t);
    onState(state);
  }

  /** @param {boolean} returnCamera fly back to the pad; false when only the state matters. */
  function reset(returnCamera = true, completed = false) {
    const wasRunning = state.running;
    state.running = false;
    state.armed = false;
    state.t = EVENTS.start;
    // The clock multiplier belongs to a run, not to the session: leaving it at ×10 meant the
    // next launch ran at ×10 while the panel showed ×1.
    state.speed = 1;
    state.paused = false;
    state.follow = 'director';
    followPrev = null;
    rig.releaseExternal();
    flight.position.set(0, 0, 0);
    flight.rotation.z = 0;
    shipToStack();
    booster.rotation.z = 0;
    booster.position.x = 0;
    boosterPlume.setThrottle(0, 0);
    boosterJets.setState(0, 0, 0);
    shipJets.setState(0, 0, 0);
    hotStageVents.setState(0, 0, 0);
    trenchFire.set({ intensity: 0 });
    deckFire.set({ intensity: 0 });
    baseGlare.set(0, 1, 0);
    stageGlow.set(0, 1, 0);
    for (const vp of vapors) vp.hide();
    collar.set(0, 0);
    collarShip.set(0, 0);
    flightEarth.hide();
    shipPlume.setThrottle(0, 0);
    resetCloud();
    parts.qdArm.rotation.y = 0;
    (parts.boosterQds ?? []).forEach((q, i) => q.position.copy(home.boosterQds[i]));
    parts.holddowns.children.forEach((c, i) => c.position.copy(home.clamps[i]));
    env.setAltitude(0);
    chop.position.y = chopHome.y;
    parts.hoist?.(chop.position.y);
    for (const a of chopHome.arms) a.obj.rotation.y = a.ry;
    boosterFlight.position.set(0, 0, 0);
    boosterFlight.rotation.z = 0;
    detachBooster(false);
    env.sun.castShadow = home.shadows;
    env.sun.shadow.autoUpdate = true; env.sun.shadow.needsUpdate = true;
    camera.near = home.near; camera.far = home.far;
    camera.updateProjectionMatrix();
    applyFrost(0, false);
    applySoot(0, false);
    visibilityHook?.(false);
    Object.assign(state, { phase: 'On the pad', altitude: 0, velocity: 0, throttle: 0, downrange: 0, next: null });
    Object.assign(state.ship, { altitude: 0, velocity: 0, lit: 0 });
    Object.assign(state.booster, { altitude: 0, velocity: 0, lit: 0 });
    onState(state);
    // The sequence ends 60 km up and 80 km downrange; leaving the viewer there would be a
    // trap, so control comes back looking at the pad the vehicle left.
    if (wasRunning && returnCamera) onFinish(completed);
  }

  /**
   * Jumps straight to a mission time. Used by the headless check and by the screenshot tool.
   * The ground cloud has no closed form, so it is re-simulated from ignition at a fixed step:
   * seeking therefore lands on the same state the animation would have reached by running
   * there, which is the only way a frame-by-frame check means anything.
   */
  function seek(t) {
    if (!state.running) { onStart(); saveCameraPlanes(); state.running = true; state.armed = true; visibilityHook?.(true); if (rig.mode === 'walk') rig.setMode('orbit'); rig.external = true; }
    resetCloud();
    advanceCloud(t);
    apply(t);
    // Seeking changes the camera after replay; refresh lighting in its final view space.
    camera.updateMatrixWorld();
    cloud.update(0, camera, env.sun);
    onState(state);
  }

  function update(dt) {
    if (!state.running || state.paused) return;
    const prev = state.t;
    const t = prev + dt * state.speed;
    apply(t);

    advanceCloud(t);

    if (t >= EVENTS.end) { reset(true, true); return; }
    onState(state);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    setSpeed: (k) => { state.speed = k; },
    /** Holds the mission clock where it is; the camera stays free to move around the frozen scene. */
    setPaused: (on) => { if (!state.running) return; state.paused = !!on; onState(state); },
    /** 'director' | 'booster' | 'ship' — main.js hands the camera over accordingly. */
    setFollow: (w) => { state.follow = w; followPrev = null; if (state.running) apply(state.t); onState(state); },
    setVisibilityHook: (fn) => { visibilityHook = fn; },
    events: EVENTS,
    /**
     * Where the noise comes from at mission time t, for the sound: the booster's engines and
     * the ship's, in world space, with the throttle each was at and its altitude.
     */
    sources(t, out = [{ pos: new THREE.Vector3() }, { pos: new THREE.Vector3() }]) {
      const b = out[0], s = out[1];
      b.pos.set(S.x + boosterDownAt(t), ex.lay.mount + boosterAltAt(t), S.z);
      b.throttle = boosterEngineThrottle(t);
      b.altitude = boosterAltAt(t);
      s.pos.set(S.x + downrangeAt(t), ex.lay.mount + altitudeAt(t), S.z);
      s.throttle = shipThrottle(t);
      s.altitude = altitudeAt(t);
      return out;
    },
    start, reset, seek, update,
    /** Used by verify(): measuring the vehicle mid-flight would measure the wrong thing. */
    get atRest() { return !state.running; },
  };
}
