/**
 * The stack's figures that the trajectory model and the pad need, without the geometry: moved out of
 * vehicles/starship.js on 9-11-2026 (external audit 8-11, finding 14) so that sim/launchModel.js and
 * the pad's dimensions can be read without three.js. starship.js imports and re-exports them, so
 * every existing import keeps working.
 */
/** The hull radius the pad's clamps and seat have to meet: 9 m diameter (spacex.com). */
export const BOOSTER_R = 4.5;
//
// The pad frame is the flame trench's (it runs along Z). The tower is not square to it: on Pad 2
// the tower–mount line meets the trench axis at ≈52,5°, from OpenStreetMap's traced footprints
// (trench 84 × 18 m, tower 11,6 m square, 31 m from the trench centre) and an NSF aerial of the
// trench under construction; Pad 1's footprints give ≈55°. The stack keeps its relation to the
// tower (belly square to the tower–mount line), so it turns with the tower: −37,5° about Y
// puts the tower at 52,5° to the trench. ≈, from traced footprints, not a survey.
export const STACK_YAW_DEG = -37.5;
export const RAPTOR_EXIT_R = 0.62;
// Block 3 has no skirt round its engines: all 33 hang in the open below the black thrust
// ring, powerheads and plumbing on show (NASASpaceflight, Booster 18/19 photographs, May 2026).
// The ring's lower edge — what the pad's clamps hold — is therefore one Raptor 3 height
// (2.9 m, spacex.com) plus the outer engines' exit-plane offset above the bells' exits.
export const BOOSTER_AFT = 3.15;
// The centre three are not 120° apart on Block 3: they are clocked 108°–108°–144°, and the
// inner ten were rotated, so that no engine fires straight onto the ridge of the pad's flame
// diverter (NASASpaceflight, "Super Heavy Block 3", May 2026). The fifth entry, where present,
// gives each engine's angle explicitly; the inner ring's new clocking is not published.
const DEG = Math.PI / 180;
export const BOOSTER_RINGS = [[3, 1.02, 0.45, Math.PI / 6, [0, 108 * DEG, 216 * DEG]], [10, 2.48, 0.35, 0], [20, 3.86, 0.25, Math.PI / 20]];
/** Azimuth of engine i of a BOOSTER_RINGS entry. */
export const ringAngle = (ring, i) => ring[3] + (ring[4] ? ring[4][i] : (i / ring[0]) * Math.PI * 2);
/** Radius the booster's engine bells actually reach. The pad derives its throat from this. */
export const RAPTOR_ENVELOPE_R = Math.max(...BOOSTER_RINGS.map(([, r]) => r)) + RAPTOR_EXIT_R;
