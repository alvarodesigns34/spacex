/**
 * The Porsche's drive cameras, apart from the scene so the checks can run them without a browser.
 * Every filter here is a function of the time step, not of the frame: the same drive seen at
 * 30 fps and at 144 fps puts the camera in the same place, looking the same way.
 *
 *  - Chase: behind the car along a heading that follows the direction of travel (blended with
 *    the nose's, ≈0.55 of the way, so a slide shows), through a first-order filter of ≈0.17 s;
 *    it used to be a fixed mix recomputed every frame, so every twitch of the yaw jumped the view.
 *  - The driver's head: a spring of ≈2.5 Hz on the neck, well damped, pushed out of a turn and
 *    forward under braking, integrated in fixed sub-steps; the eyes looking a little into the turn.
 *    The head holds the horizon better than the body does: ≈half the body's roll on its springs
 *    is taken back (≈, as onboard footage shows the driver's view rolling less than the car).
 *  - The road under the tyres: a fixed texture along the distance travelled (two octaves of value
 *    noise, ≈0.9 m and ≈0.3 m long), so the same speed over the same surface shakes the same at
 *    any frame rate, and the shake's frequency rises with the speed as a real road's does. Its
 *    size follows what is under the wheels: the kerbs' and the gravel's coarse surface, a little
 *    on asphalt at speed (≈ amplitudes at the eye, after the seat and the springs).
 */
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
/** How rough each surface is under a tyre (1 = a kerb), ≈. */
export const ROUGH = { kerb: 1, gravel: 0.8, grass: 0.6, sand: 0.5, mud: 0.5, verge: 0.12, runway: 0.06, road: 0.06, pad: 0.04, track: 0.04 };
const roughOf = (k) => ROUGH[k] ?? 0.06;

// Value noise on a line: a smooth random profile, the same for the same position.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
/** The road's profile at a distance along it, −1..1, on its own seed. */
export const roadProfile = (d, seed = 0) => 0.6 * noise1(d / 0.9 + seed * 37.3) + 0.4 * noise1(d / 0.3 + seed * 91.7);

/** How many wheels are on a kerb, and how rough what is under the car is overall (0..1). */
export function underWheels(s) {
  let kerb = 0, rough = 0;
  for (const k of s.surface ?? []) { if (k === 'kerb') kerb++; rough = Math.max(rough, roughOf(k)); }
  return { kerb, rough };
}

/**
 * The shake at the eye from the road, m (x along the car, y up), deterministic: the profile at the
 * distance travelled, sized by the surface and the speed.
 */
export function roadShake(s) {
  const V = Math.hypot(s.u, s.v), { rough } = underWheels(s);
  const amp = 0.0045 * rough * Math.min(1, V / 15) + 0.0004 * Math.min(1, V / 70);
  const d = s.odo ?? 0;
  return { x: amp * 0.5 * roadProfile(d, 1), y: amp * roadProfile(d, 0) };
}

export function createGt3Cameras() {
  const dir = new THREE.Vector3(1, 0, 0), _t = new THREE.Vector3(), _v = new THREE.Vector3();
  let dirSet = false;
  const head = { x: 0, z: 0, vx: 0, vz: 0, look: 0 };
  const HEAD_H = 1 / 240;
  return {
    head,
    /** Forget the filters' state (a new camera, a reset): the next frame starts from the car. */
    reset() { dirSet = false; Object.assign(head, { x: 0, z: 0, vx: 0, vz: 0, look: 0 }); },
    /**
     * The chase camera's heading on the ground, a unit vector in x, z: towards the direction of
     * travel (the nose's when slow), filtered with a time constant of TAU s.
     */
    chaseDir(s, dt, TAU = 0.17) {
      const c = Math.cos(s.psi), sn = Math.sin(s.psi), V = Math.hypot(s.u, s.v);
      _t.set(c, 0, -sn);
      // (Going forward only: in reverse the travel is behind the nose and the mix would flip it.)
      if (V > 4 && s.u > 1) {
        const vx = s.u * c - s.v * sn, vz = -s.u * sn - s.v * c, L = Math.hypot(vx, vz);
        _t.lerp(_v.set(vx / L, 0, vz / L), 0.55).normalize();
      }
      if (!dirSet) { dir.copy(_t); dirSet = true; return dir; }
      if (dt > 0) dir.lerp(_t, 1 - Math.exp(-dt / TAU)).normalize();
      return dir;
    },
    /**
     * The driver's head on the neck, in the car's frame (x forward, z to the right as gt3Cabin
     * places the eye; m), and where the eyes look across (m at 30 m). Sub-stepped at 1/240 s.
     */
    headStep(s, dt) {
      const wn = 2 * Math.PI * 2.5, zeta = 0.8;
      const tz = clamp(s.ay * 0.0045, -0.06, 0.06), tx = clamp(-s.ax * 0.0035, -0.045, 0.045);
      let left = Math.min(dt, 0.25);
      while (left > 1e-9) {
        const h = Math.min(HEAD_H, left); left -= h;
        head.vz += (wn * wn * (tz - head.z) - 2 * zeta * wn * head.vz) * h; head.z += head.vz * h;
        head.vx += (wn * wn * (tx - head.x) - 2 * zeta * wn * head.vx) * h; head.x += head.vx * h;
      }
      const curv = s.r / Math.max(5, Math.abs(s.u));
      head.look += (clamp(-curv * 450 * 0.5, -9, 9) - head.look) * (1 - Math.exp(-dt * 3));
      return head;
    },
  };
}
