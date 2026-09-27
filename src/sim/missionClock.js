/**
 * Two clocks from one frame delta.
 *
 * The frame loop used to clamp its delta to 0,05 s and hand that to everything, the mission
 * included. The clamp is right for the camera and the effects — after a stall they should not
 * leap — but it tied the mission clock to the frame rate: under 20 fps the launch ran slow
 * (at 10 fps, at half speed; at 5 fps, a quarter), while the panel still promised 1:1.
 *
 * Now the view gets the clamped step and the mission gets wall time, multiplied by the speed
 * control inside launch.update. Two limits remain, both deliberate:
 *   - a hidden tab does not advance the mission: the gap is discarded when the page is shown
 *     again (discard()), so milestones, sound and the end are not skipped in one jump;
 *   - a single step is capped at MISSION_STEP_MAX, against a frame that stalls for seconds
 *     (a shader compile, a debugger). Down to 2 fps the mission keeps wall time.
 *
 * Pure and time-source-free, so the check can drive it with a synthetic clock.
 */
export const VIEW_STEP_MAX = 0.05;
export const MISSION_STEP_MAX = 0.5;

export function createMissionClock({ viewMax = VIEW_STEP_MAX, missionMax = MISSION_STEP_MAX } = {}) {
  let skip = false;
  return {
    /** @param raw seconds since the last frame; returns the step for each clock */
    step(raw) {
      const r = Math.max(0, Number.isFinite(raw) ? raw : 0);
      if (skip) { skip = false; return { view: Math.min(r, viewMax), mission: 0 }; }
      return { view: Math.min(r, viewMax), mission: Math.min(r, missionMax) };
    },
    /** The next step's wall time is not mission time (the page was hidden in between). */
    discard() { skip = true; },
  };
}
