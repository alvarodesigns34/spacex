/**
 * A game controller for the Porsche (the Gamepad API's standard mapping), read into the same
 * driver inputs as the keyboard's — kept apart from the drive so the checks can run it without a
 * browser.
 *  - Steering: the left stick, its dead zone rescaled (no step out of it), its travel shaped
 *    (x^1.6: fine near the centre) and scaled to what the grip can use at this speed
 *    (steerReach, more the way a slide is caught), at the same speed-scaled rate as the keys.
 *  - Throttle and brake on the triggers, analog; the parking brake on A.
 *  - Buttons, on the press only: LB/RB the paddles, X the PSM, Y the camera, Start the pause.
 */
import { steerReach, steerRate } from './gt3Car.js';
import { underWheels } from './gt3Camera.js';

const DEAD = 0.06;
const BUTTONS = { 4: 'down', 5: 'up', 2: 'psm', 3: 'camera', 9: 'pause' };

/**
 * @param g a Gamepad (or anything shaped like one: axes[], buttons[{ value, pressed }])
 * @param s the car's state; d the driver's inputs, changed in place; prev the buttons' last state
 * @returns { active, actions } — whether the pad is in use this frame, and the buttons just pressed
 */
export function readPad(g, s, d, dt, prev = {}) {
  const b = (i) => g.buttons?.[i]?.value ?? (g.buttons?.[i]?.pressed ? 1 : 0);
  const x = g.axes?.[0] ?? 0;
  const m = Math.max(0, (Math.abs(x) - DEAD) / (1 - DEAD));
  const dir = -Math.sign(x) * (m > 0 ? 1 : 0);
  const want = dir * m ** 1.6 * steerReach(s, dir);
  const throttle = b(7), brake = b(6), hand = b(0);
  const active = m > 0 || throttle > 0.02 || brake > 0.02 || hand > 0.5;
  if (active) {
    const rate = steerRate(s, dir !== 0) * dt;
    d.steer += Math.max(-rate, Math.min(rate, want - d.steer));
    d.throttle = throttle ** 1.2; d.brake = brake; d.handbrake = hand > 0.5 ? 1 : 0;
  }
  const actions = [];
  for (const [i, name] of Object.entries(BUTTONS)) {
    const down = b(+i) > 0.5;
    if (down && !prev[i]) actions.push(name);
    prev[i] = down;
  }
  return { active, actions };
}

/**
 * Rumble for what the tyres and the road are doing (where the pad has an actuator): the strong
 * motor for the tyres past their grip, the weak one for the kerbs (harder the more wheels are on
 * them), gravel or grass at speed, or the ABS.
 */
export function rumbleFor(s) {
  let over = 0;
  for (let i = 0; i < 4; i++) over = Math.max(over, ((s.slip?.[i] ?? 0) - 1) * Math.min(1, (s.load?.[i] ?? 0) / 3000));
  // The road: more wheels on a kerb, harder; gravel and grass too; none of it standing still.
  const { kerb, rough } = underWheels(s), V = Math.hypot(s.u ?? 0, s.v ?? 0), moving = Math.min(1, V / 8);
  const road = kerb ? (0.3 + 0.13 * kerb) * moving : rough >= 0.5 ? 0.3 * moving : 0;
  return { strong: Math.max(0, Math.min(1, over)), weak: Math.min(1, Math.max(road, s.abs ? 0.35 : 0)) };
}
