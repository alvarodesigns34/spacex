/**
 * Where everything stands: the exhibits' places on the apron, the overview frame, the cylinders
 * that hide labels behind a vehicle. Moved out of main.js unchanged.
 */
import * as THREE from 'three';
import { circuitSurface } from './circuit.js';
import { SKIDPAD, toWorld as circuitToWorld } from './circuitPlan.js';
import { runwaySurface } from './runway.js';
import { RUNWAY, fromRunway, toRunway } from './terrain.js';
import { STACK_YAW_DEG, BOOSTER_AFT } from '../vehicles/starship.js';
import { PAD } from '../vehicles/pad.js';

// Exhibit layout (world X, metres). Mount heights are presentation choices.
// `yaw` turns an exhibit on its mount. Starship is asymmetric — heat shield on the belly,
// bare steel on the lee side — and facing its belly straight at the default camera shows
// nothing but the black shield. Turning it puts the tile line across the vehicle, which is
// how it is almost always photographed and how the two finishes read against each other.
// The seven museum exhibits stand in a row on z = 0. Starship does not: it sits on a launch
// complex of its own, set back behind the row, because a ≈149,5 m tower and a flame trench do
// not belong in a line of display mounts and because the launch sequence needs the room.
// `people` is declared per exhibit rather than inferred. It used to fall through to a generic
// branch that read lay.mountRadius, which Engine Row does not have — undefined + 3.5 is NaN,
// and three visitors were being planted at (NaN, 0, NaN). Inferring "is there a plinth?" from
// a radius that only some layouts carry is the kind of thing that breaks the next time an
// exhibit is added, so the layout says it outright.
export const LAYOUT = {
  // Falcon 1 is the small historical bookend of the row, immediately outside Falcon 9.
  // The Falcons stand on launch mounts (common.js, buildLaunchMount): `mount` is the deck
  // height, `lift` how far above it the nozzle exits hang when the vehicle sits on its clamps.
  falcon1: {
    x: -153, z: 0, mount: 2.0, lift: 0.3, mountRadius: 3.1, people: [[4.2, 0, 2, 0.5], [-4.2, 0, 2, -0.5]],
    launchMount: {
      halfX: 3.1, halfZ: 3.1, tunnelHalf: 0.9, tunnelH: 1.05, opening: { hx: 0.6, hz: 0.6 },
      // Bearing on the stage's aft ring, which Figure 2-5 of the 2008 guide labels as the
      // launch-mount interface: station 133.3 in, 2.72 m above the nozzle exit, r ≈ 0.75 m. The
      // Merlin and its thrust frame hang free inside the four clamp pedestals.
      cores: [{ x: 0, z: 0, r: 0.75, seatY: 0.3 + 2.718, scale: 0.5, clamps: [1, 3, 5, 7].map(i => i * Math.PI / 4) }],
    },
  },
  falcon9: {
    x: -135, z: 0, mount: 6.5, lift: 0.35, mountRadius: 6.5,
    people: [[10, 0, 2, 0.5], [8.5, 0, -4, -2.0], [-9.5, 0, 3, 2.2]],
    launchMount: {
      halfX: 6.5, halfZ: 6.5, tunnelHalf: 2.6, tunnelH: 4.2, opening: { hx: 1.95, hz: 1.95 },
      cores: [{ x: 0, z: 0, r: 1.83, seatY: 0.35 + 1.0, clamps: [0, 1, 2, 3].map(i => i * Math.PI / 2), tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] }],
    },
  },
  falconheavy: {
    x: -62, z: 0, mount: 6.5, lift: 0.35, mountRadius: 10,
    people: [[15, 0, 2, 0.5], [13.5, 0, -4, -2.0], [-14.5, 0, 3, 2.2]],
    launchMount: {
      halfX: 10, halfZ: 7, tunnelHalf: 7, tunnelH: 4.2, opening: { hx: 6.2, hz: 1.95 },
      cores: [
        { x: 0, z: 0, r: 1.83, seatY: 1.35, clamps: [0, Math.PI], tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] },
        { x: -4.27, z: 0, r: 1.83, seatY: 1.35, clamps: [0, Math.PI, Math.PI * 1.5], tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] },
        { x: 4.27, z: 0, r: 1.83, seatY: 1.35, clamps: [0, Math.PI / 2, Math.PI], tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] },
      ],
    },
  },
  starship: {
    // The stack's origin is the engines' exit plane; the deck carries the thrust ring's edge,
    // BOOSTER_AFT above it, with the 33 Raptors hanging down into the mount's throat.
    x: 0, z: -185, mount: PAD.deckTop - BOOSTER_AFT, yaw: STACK_YAW_DEG, pad: true,
    people: [[26, PAD.padY, 16, 0.8], [30, PAD.padY, -10, -1.6], [-19, PAD.padY, 24, 2.4]],
  },
  dragon: { x: 18, z: 0, mount: 1.6, people: [[3.4, 0, 1.6, 0.6], [-2.8, 0, 2.6, -0.8]] },
  starlink: { x: 78, z: 0, mount: 6.2, people: [[3.2, 0, 2.4, 0.4], [-2.6, 0, 3.0, -1.2]] },
  // Figures stand clear of every authored view: at [2.8, 1.8] one was 2.7 m in front of the
  // Roadster's overview camera, a hard hat cut off by the bottom of the frame (another
  // filled the left of the Selfie Cam view, 6 m out), and at
  // [3.4, 2.6] another filled the right third of the RVac close-up.
  roadster: { x: 118, z: 0, mount: 1.4, yaw: 25, people: [[5.3, 0, 1.4, 0.5], [-6.3, 0, -1.7, -1.8]] },
  engines: {
    x: 163, z: 0, mount: 0, yaw: -12,
    people: [[4.8, 0, -2.8, -0.6], [-5.8, 0, 2.2, -1.4], [1.2, 0, -3.0, 2.6]],
  },
  // The F-16 stands on its own runway (terrain.js RUNWAY), as Starship stands on its pad: lined
  // up on runway 28's threshold (the east end, next to the site), 40 m in, ready to roll. Not in the row (`remote`): the row's
  // lecterns and its overview leave it out.
  f16: (() => {
    // People are placed by world offsets; each stands on the pavement where it falls.
    const a = RUNWAY.length / 2 - 40 - 7.52, [x, z] = fromRunway(a, 0);
    const person = (dx, dz, ry) => [dx, runwaySurface(...toRunway(x + dx, z + dz)), dz, ry];
    return { x, z, mount: runwaySurface(a, 0), yaw: 180 - RUNWAY.angleDeg, remote: true, people: [person(3.5, 6.5, 0.6), person(-8.0, -6.0, -2.2)] };
  })(),
  // The Porsche waits on its skid pad (core/circuitPlan.js), beside the circuit's main straight:
  // at the pad's north end, nose to the south along its 160 m, with the lane to the circuit on
  // its right. Not in the row either.
  gt3rs: (() => {
    const [x, z] = circuitToWorld(SKIDPAD.u0 + 18, (SKIDPAD.v0 + SKIDPAD.v1) / 2);
    return { x, z, mount: circuitSurface(x, z)?.y ?? 0.06, yaw: -90, remote: true, people: [[-6.0, 0.06, -3.4, 0.9], [5.5, 0.06, -5.0, -2.0]] };
  })(),
  // The Ninja H2R beside it, 4.5 m to the car's left and a metre ahead, facing the same way.
  h2r: (() => {
    const [x, z] = circuitToWorld(SKIDPAD.u0 + 19, (SKIDPAD.v0 + SKIDPAD.v1) / 2 - 4.5);
    return { x, z, mount: circuitSurface(x, z)?.y ?? 0.06, yaw: -90, remote: true, people: [] };
  })(),
  // The Model Y on the car's other side, 4.5 m to its right, facing the same way.
  modely: (() => {
    const [x, z] = circuitToWorld(SKIDPAD.u0 + 18, (SKIDPAD.v0 + SKIDPAD.v1) / 2 + 4.5);
    return { x, z, mount: circuitSurface(x, z)?.y ?? 0.06, yaw: -90, remote: true, people: [] };
  })(),
};
// Recomposed when the Roadster became the sixth exhibit: the old frame was centred on x = -14
// and the car sat at the right-hand edge, so the first thing a visitor saw did not contain it.
// Recomposed again when Engine Row became the seventh exhibit at x = 163: the row now spans
// nearly 300 m, so the frame has to sit further back and centre on the middle of it.
export const OVERVIEW = { pos: [3, 72, 330], target: [-1, 39, -68] };
/**
 * The overview for the window actually open. The authored frame spans the row for a landscape
 * window; on a phone held upright the horizontal field of view is a third of that, and the
 * overview showed the pad and a quarter of the row under a title promising eight exhibits.
 * The camera backs off along its own line of sight until the row's ends (plus a margin) fit
 * the horizontal field of view, and never comes closer than authored.
 */
// Half the row's width about the camera's line: Falcon 1's mount at x ≈ −159 to Engine Row's
// cradles at ≈ +166 m, seen from x = 3. At 1440 × 900 with the rail showing that is exactly the
// authored frame, so a desktop window keeps it.
export const ROW_HALF = 166;
export function overviewFor(aspect, fovDeg = 42) {
  const [px, py, pz] = OVERVIEW.pos, [tx, ty, tz] = OVERVIEW.target;
  const d0 = Math.hypot(px - tx, py - ty, pz - tz);
  const tanH = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * aspect;
  // The camera's distance to the row (z = 0) is tz + (pz − tz)·k along the scaled line of sight.
  const need = ROW_HALF / tanH;
  const k = THREE.MathUtils.clamp((need - tz) / (pz - tz), 1, 3.4);
  const pos = [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k];
  return { pos, target: OVERVIEW.target, scale: k, d: d0 * k };
}

// Cylinders used to hide annotations that sit behind a vehicle. CSS2D labels always draw on
// top of the scene, so without this the far-side callouts read as if they were in front.
//
// A number is one cylinder of that radius on the exhibit's axis, which is what a rocket is.
// Engine Row is not: it is three separate engines standing side by side over nine metres, and
// a single cylinder at the origin would both hide labels nothing is in front of and fail to
// hide the ones behind the vacuum bell. It gets one cylinder per stand, given as [x, z, r, top]
// in the exhibit's own frame — each with its own height, because a 2.9 m Raptor must not
// occlude to the 4.8 m of the vacuum engine standing next to it. Starlink is a flat panel and
// needs none.
export const OCCLUDER = {
  falcon1: 0.8402,
  starship: 4.5, falcon9: 1.9, falconheavy: 1.9, dragon: 2.0, starlink: 0, roadster: 1.0,
  engines: [[-4.15, 0, 0.50, 2.6], [-1.75, 0, 0.70, 3.4], [1.55, 0, 1.20, 4.9]],
  // The F-16 along its own X: the fuselage as a chain of cylinders, a wing and a stabilator each
  // side, the fin. Also the walking visitor's obstacles.
  f16: [[5.8, 0, 0.6, 2.2], [3.2, 0, 0.9, 3.0], [0.6, 0, 1.0, 2.2], [-2.2, 0, 1.0, 2.4], [-5.0, 0, 1.0, 2.6], [-6.5, 0, 0.9, 5.0],
    [-1.6, 2.6, 1.6, 2.0], [-1.6, -2.6, 1.6, 2.0], [-6.2, 1.9, 0.9, 2.0], [-6.2, -1.9, 0.9, 2.0]],
  // The car along its own X: three cylinders from the nose to the wing.
  gt3rs: [[1.4, 0, 0.95, 1.0], [0, 0, 0.95, 1.3], [-1.5, 0, 0.95, 1.33]],
  // The bike along its own X: front wheel and cowl, the tank, the tail.
  h2r: [[0.6, 0, 0.42, 1.16], [-0.1, 0, 0.3, 1.02], [-0.75, 0, 0.3, 1.02]],
  // The Model Y along its own X: the nose, the cabin, the tail.
  modely: [[1.5, 0, 0.95, 1.1], [0, 0, 0.95, 1.62], [-1.5, 0, 0.95, 1.3]],
};
