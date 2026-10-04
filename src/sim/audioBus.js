/**
 * One audio context for the whole centre, and how a vehicle's sound reaches the camera.
 *
 * Every sound (the launch, the GT3 RS, the H2R, the F-16) plays through the same AudioContext
 * and the same master bus: browsers allow only a few contexts, each costs a thread, and with one
 * per vehicle the hidden-tab and volume policies had to be repeated in each. The context is made
 * on the first sound a visitor turns on (a click: browsers allow audio only after one); it is
 * suspended while the tab is hidden (requestAnimationFrame stops with it, so nothing would update
 * the notes) and resumed on return while any sound is on.
 *
 * A vehicle seen from outside is heard where it is (createSpatial):
 *  - late by the distance over the speed of sound (343 m/s): the sound goes through a delay line
 *    of d/c, and as d changes the delay's rate of change shifts the pitch by exactly the Doppler
 *    factor of a moving source (1 − ḋ/c, to first order in v/c), engine notes and noise alike;
 *  - placed in space round the listener (HRTF panning), so it comes from where the vehicle is;
 *  - quieter with distance (spherical spreading, 1/d past a reference distance at which the
 *    synthesis was balanced), and duller: the air takes the top off with distance (≈ the cut-off
 *    falls as 1/d, the same rule as the launch's).
 * From inside (the cockpit, the driver's seat, the rider's helmet) none of that applies: the
 * listener rides with the source.
 */

let ctx = null, bus = null, comp = null;
const users = new Set();

/** The shared context and its master bus (made on first use; null without Web Audio). */
export function audio() {
  if (ctx) return { ctx, bus };
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
  bus = ctx.createGain(); bus.gain.value = 1;
  bus.connect(comp); comp.connect(ctx.destination);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend?.();
      else if (users.size) ctx.resume?.();
    });
  }
  return { ctx, bus };
}

/** A sound turned on or off by its owner (`id`): the context runs while any is on. */
export function claim(id, on) {
  if (on) users.add(id); else users.delete(id);
  if (!ctx) return;
  if (users.size && !(typeof document !== 'undefined' && document.hidden)) ctx.resume?.();
}

export const C_SOUND = 343;
const _f = { x: 0, y: 0, z: 0 };

/** The listener at the camera, facing where it looks. */
export function placeListener(camera) {
  if (!ctx) return;
  const L = ctx.listener, cp = camera.position, e = camera.matrixWorld.elements;
  _f.x = -e[8]; _f.y = -e[9]; _f.z = -e[10];
  if (L.positionX) {
    const t = ctx.currentTime;
    L.positionX.setValueAtTime(cp.x, t); L.positionY.setValueAtTime(cp.y, t); L.positionZ.setValueAtTime(cp.z, t);
    L.forwardX.setValueAtTime(_f.x, t); L.forwardY.setValueAtTime(_f.y, t); L.forwardZ.setValueAtTime(_f.z, t);
    L.upX.setValueAtTime(e[4], t); L.upY.setValueAtTime(e[5], t); L.upZ.setValueAtTime(e[6], t);
  } else { L.setPosition(cp.x, cp.y, cp.z); L.setOrientation(_f.x, _f.y, _f.z, e[4], e[5], e[6]); }
}

/**
 * The path from a source to the listener: input → delay (d/c) → air → panner → output. `ref`
 * is the distance at which the source's own level was set (≈ its chase camera's), `maxDelay`
 * how far it can be heard from (s of travel).
 */
export function createSpatial(ref, { maxDelay = 30 } = {}) {
  const input = ctx.createGain();
  const delay = ctx.createDelay(maxDelay); delay.delayTime.value = 0;
  const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 18000; air.Q.value = 0.5;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF'; panner.distanceModel = 'linear'; panner.rolloffFactor = 0;
  const out = ctx.createGain(); out.gain.value = 1;
  input.connect(delay); delay.connect(air); air.connect(panner); panner.connect(out);
  let lastDelay = null, lastInside = null;
  const setPos = (p, x, y, z, t) => {
    if (p.positionX) { p.positionX.setValueAtTime(x, t); p.positionY.setValueAtTime(y, t); p.positionZ.setValueAtTime(z, t); } else p.setPosition(x, y, z);
  };
  return {
    input, out,
    /**
     * Per frame: the source at `pos`, the listener at the camera; `inside` true when the listener
     * rides in the vehicle. `gate` (0…1) multiplies the level (the F-16's Mach cone); `dt` the
     * frame's time, s. Returns the distance.
     */
    update(pos, camera, inside = false, gate = 1, dt = 1 / 60) {
      const t = ctx.currentTime, cp = camera.position;
      const d = inside ? 0 : Math.hypot(pos.x - cp.x, pos.y - cp.y, pos.z - cp.z);
      const want = Math.min(maxDelay - 0.05, d / C_SOUND);
      const g = (inside ? 1 : Math.min(1.5, ref / Math.max(d, 0.5))) * gate;
      // A jump (a camera cut, into or out of the cabin) is not a source moving at supersonic
      // speed: fade out, set the delay, fade back in, instead of sweeping the pitch.
      // (Faster than twice the speed of sound along the line of sight: a cut, not a flight.)
      const jump = lastDelay === null || inside !== lastInside || Math.abs(want - lastDelay) > 2 * Math.max(dt, 1 / 240) + 0.01;
      if (jump) {
        out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, 0.008);
        delay.delayTime.cancelScheduledValues(t); delay.delayTime.setValueAtTime(want, t + 0.04);
        out.gain.setTargetAtTime(g, t + 0.045, 0.02);
      } else {
        // Glided over about a frame, so the pitch moves smoothly (the Doppler) without steps.
        delay.delayTime.setTargetAtTime(want, t, 0.03);
        out.gain.setTargetAtTime(g, t, 0.03);
      }
      if (inside) setPos(panner, cp.x, cp.y, cp.z - 0.01, t);
      else setPos(panner, pos.x, pos.y, pos.z, t);
      air.frequency.setTargetAtTime(inside ? 18000 : Math.max(500, Math.min(18000, 18000 * 120 / Math.max(d, 120))), t, 0.1);
      lastDelay = want; lastInside = inside;
      return d;
    },
  };
}
