/**
 * The pad's dimensions (vehicles/pad.js has their sources and what is approximate), without the
 * geometry: moved out of pad.js on 9-11-2026 (external audit 8-11, finding 14) so the trajectory
 * model can read them without three.js. pad.js imports and re-exports PAD.
 */
import { RAPTOR_ENVELOPE_R, BOOSTER_R, BOOSTER_AFT, STACK_YAW_DEG } from './stackFigures.js';

// ---- Dimensions -------------------------------------------------------------------------
export const PAD = {
  // Ground
  gradeY: 0,
  // The site stands only a few metres proud of the flats. Every ground-level photograph of
  // the finished pad (SpaceX's Booster 19 static fire, April 2026; NSF's stacking shots from
  // the road) shows the mount rising some 13 m straight out of it, trucks parked at its
  // foot, where a 9 m pad hid the mount behind a concrete wall from anywhere on the ground.
  // 5 m is as low as it goes: the trench floor must stay above grade (the ground plane would
  // cut it) and the deflector crest needs its 4.2 m.
  bermY: 2.5,             // outer berm top
  padY: 5.0,              // pad surface the tower and the mount stand on
  trenchFloorY: 0.8,      // trench floor: kept above grade so the ground plane never cuts it
  trenchHalfW: 11.0,      // 22 m clear width
  trenchHalfL: 44.0,      // 88 m of trench inside the pad, open at both ends
  // Launch mount
  deckTop: 18.0,          // 13 m above the pad surface (≈, from the photographs)
  deckThick: 2.4,
  mountHalf: 13.0,        // 26 m square
  openingR: 5.5,          // ø 11 m engine opening
  tableR: 5.2,            // steel ring the booster skirt seats on
  clamps: 20,
  // Clamp ring radius, set so the shoe's inner face lands ON the skirt rather than near it.
  // At the old 4.92 the twenty clamps closed to 4.56 m around a 4.50 m hull: six centimetres
  // of air, in close-ups of the one piece of hardware whose whole job is to hold the vehicle
  // down. CLAMP_DEPTH is the shoe's radial thickness, below.
  clampR: BOOSTER_R + 0.36,
  // The hole the exhaust leaves through, derived rather than declared: whatever the outermost
  // Raptor bells reach, plus a working gap. Hard-coding it at 4.05 m put the steel lip 43 cm
  // inside twenty of them — the seat is meant to be smaller than the 9 m vehicle, not smaller
  // than its engines. Moving a ring now moves the throat with it.
  throatR: RAPTOR_ENVELOPE_R + 0.25,
  pierHalf: 2.0,          // 4 m square corner piers
  pierAt: 12.0,
  // Tower (OLIT), in its own frame: towerX from the mount centre along that frame's −X. The
  // frame turns about the mount by towerYawDeg (the stack's yaw, starship.js), so the tower
  // stands at ≈52,5° to the trench axis as on Pad 2 (OpenStreetMap footprints; NSF aerial).
  // The ≈31 m the footprints give from tower centre to trench centre agrees with the 30 m here.
  towerX: -30.0,
  towerYawDeg: STACK_YAW_DEG,
  towerHalf: 6.1,         // 12,2 m square truss
  // Truss and lightning rod, from the FAA's programmatic environmental assessment for Starbase
  // (June 2022, §2.1.4.3, "Integration Towers"): "Each tower would be approximately 480 feet
  // tall with a 10-foot lightning rod on top". Two towers were proposed, one per pad; Pad 2's is
  // the second. A planning figure, stated as approximate, so it is shown with ≈. Twelve 12,2 m
  // sections are 146,4 m (480 ft is 146,3 m), and the rod 3,05 m: ≈149,5 m to its tip.
  //
  // It replaces ≈144,5 m (474 ft), which only a fan wiki gave. It also agrees with the one
  // independent reading there was: on SpaceX's photograph of the V3 wet dress rehearsal on Pad 2
  // (11 May 2026) the truss still stands at ≈145–150 m by an extrapolation off the ship QD arm,
  // which the old 140,3 m of truss could not reach.
  section: 12.2,
  sections: 12,           // 146,4 m of truss: ≈480 ft (FAA, 2022)
  mast: 3.05,             // 10 ft lightning rod (FAA, 2022)
  // Chopstick carriage height with the arms parked open for launch, near the top of the truss.
  // SpaceX's photographs of Pad 2 show them there with the full stack loaded (V3 wet dress
  // rehearsal, 11 May 2026) and over Booster 19 alone (static fire, 15 April 2026); they were
  // parked round the booster's middle, at 46 m. On the wet-dress photograph, with the same
  // extrapolation and the same caveat, the carriage spans ≈124–137 m: reconstructed, ≈.
  armY: 132.0,
  // Pad 2's chopsticks are about 10 m shorter than Pad 1's ≈36 m (NASASpaceflight, "Starbase
  // Pad 2: Design Advancements from Pad 1", August 2025; Wikipedia: "a new shorter design").
  armLen: 26.0,
  // Ship quick-disconnect arm: at the ship's QD panel, which moved down with the stack when
  // Block 3's booster came to stand on its thrust ring with the engines in the mount.
  qdY: 96.0 - BOOSTER_AFT,
  qdLen: 18.5,
  // Field
  farmX: 150.0,
};
PAD.towerH = PAD.section * PAD.sections + PAD.mast;   // ≈149,5 m (146,4 truss + 3,05 rod)
PAD.trenchDepth = PAD.padY - PAD.trenchFloorY;        // 4,2 m
