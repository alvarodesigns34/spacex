/**
 * The land's shape and cover, as functions of world x/z, shared by what has to agree about
 * them: the ground mesh, the terrain shader's cover and the grass laid on top.
 *
 * WHAT IS CITED AND WHAT IS NOT
 *
 * The kind of landscape is the real one. The Boca Chica tract of the Lower Rio Grande Valley
 * National Wildlife Refuge is beach, saline flats, shallow bays and "unique dunes of wind-blown
 * clay known as lomas" (U.S. Fish & Wildlife Service, refuge visitor pages); on the lomas'
 * well-drained ground grows Tamaulipan thornscrub, a sparse to dense overstory of honey mesquite
 * over shrubs (Texas Parks & Wildlife, Ecological Mapping Systems of Texas: Tamaulipan Saline
 * Thornscrub). Here that cover is a darker, olive ground tone on the lomas, not modelled plants.
 *
 * Where each loma is and its size and height (a few metres, which is what these clay dunes
 * are) are NOT a survey: placed plausibly, clear of the built site, and flagged as reconstructed.
 */
import { noise2 } from '../materials/textures.js';
import { LAUNCH_SITE } from '../data/gulf.js';
import { circuitMask } from './circuitPlan.js';

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * The coast's own frame. At Boca Chica the Gulf beach runs almost due north–south: Natural
 * Earth's coastline (data/gulf.js) between 25,97° N and 26,08° N bears ≈355°, so the sea lies
 * to the east, its normal on an azimuth of ≈85°. The scene's +X is the launch azimuth
 * (100,8°, gulf.js), which puts that normal 74,5° clockwise of the scene's −Z, seen from
 * above. Until 29 September 2026 the shore ran along the scene's X axis, with the sea at −Z:
 * due NNE of the pad, 90° from where it is, so the rocket flew along the beach instead of out
 * over the Gulf, and the local coast and the real one on the globe did not meet.
 *
 * (u, w): u along the shore, w inland; the pad (0, −185) keeps w = −185, so its distance to
 * the water — "a few hundred yards", as cited in the README — is what it was.
 */
export const SHORE_NORMAL_AZ = 85.3;
const BETA = (SHORE_NORMAL_AZ - (LAUNCH_SITE.azimuthDeg - 90)) * Math.PI / 180;
const CB = Math.cos(BETA), SB = Math.sin(BETA), PAD_Z = -185;
/** World (x, z) → coast [u, w]. */
export function toCoast(x, z) { const dz = z - PAD_Z; return [CB * x + SB * dz, PAD_Z - SB * x + CB * dz]; }
/** Coast (u, w) → world [x, z]. */
export function fromCoast(u, w) { const dw = w - PAD_Z; return [CB * u - SB * dw, PAD_Z + SB * u + CB * dw]; }

/** The shoreline's w at u, in the coast frame (the line environment.js builds the beach on). */
export function shoreZ(u) {
  return -670 + 46 * (noise2(u / 280 + 3.1, 7.7) - 0.5) + 18 * (noise2(u / 90, 1.3) - 0.5);
}
/** Metres seaward of the shoreline at world (x, z); negative inland. */
export function seaward(x, z) { const [u, w] = toCoast(x, z); return shoreZ(u) - w; }

/**
 * Lomas: [x, z, half-length, half-width, height, axis angle]. Elongated along the prevailing
 * wind, a few metres high, all at least a few hundred metres inland of the beach and clear of
 * the exhibits, the pad and the pools. Reconstructed, not surveyed.
 */
// Four of them stood east of the site until the coast was turned to its real bearing
// (29 Sep 2026), where they would now be under the Gulf; they were moved inland, west,
// which is where the lomas of Boca Chica are.
export const LOMAS = [
  [-760, 200, 190, 80, 6.0, 0.4], [-640, -430, 140, 62, 4.5, 1.1], [-560, 660, 220, 90, 7.0, -0.3],
  [-1300, -520, 160, 70, 5.0, 0.9], [-1120, -150, 260, 105, 8.0, 0.2], [320, 740, 240, 95, 6.0, 0.15],
  [-400, 800, 200, 85, 5.5, -0.5], [-1700, 160, 270, 115, 9.0, 0.6], [-1420, 620, 310, 125, 8.5, -0.2],
  [110, 1320, 300, 130, 7.0, 0.1], [-950, -820, 180, 80, 5.0, 1.2], [-980, 420, 150, 70, 4.0, 0.8],
  [560, 980, 180, 80, 5.0, -0.7], [-160, 1050, 170, 75, 4.5, 0.3],
];

/**
 * Wind-tidal pools: [x, z, mean radius, seed], kept clear of the exhibit row and its road, the
 * access road, the pad and the dunes. campus.js draws them; the land is held flat round them.
 */
export const POOL_SPEC = [
  [-340, -170, 65, 1], [260, -240, 55, 2], [-170, 200, 50, 3], [310, 210, 75, 4],
  [-430, 60, 60, 5], [110, 270, 42, 6], [410, -70, 50, 7], [-250, -340, 60, 8],
].filter(([x, z, r]) => {
  const R = r * 1.4;
  if (Math.abs(z) < 75 + R && x > -230 - R && x < 240 + R) return false;       // exhibit row and road
  if (x > 25 - R && x < 75 + R && z > -135 - R && z < 40 + R) return false;       // access road
  if (Math.hypot(x, z + 185) < R + 165) return false;                              // Pad 2 and its berm
  return -seaward(x, z) - R > 200;                                                 // clear of the dunes and beach
});
/** Each pool's stretch (1,5–2,3 × along its own axis) and its long half-axis reach. */
export const poolStretch = (seed) => 1.5 + 0.8 * noise2(seed * 3.7, 0.5);
const POOLS = POOL_SPEC.map(([x, z, r, seed]) => [x, z, r * 1.3 * Math.sqrt(poolStretch(seed))]);

/**
 * A pool's outline, the one campus.js draws its water to, and its bed. Three scales of wander on
 * the outline (the pool's lobes, bays tens of metres across, the ragged few-metre edge that
 * wind-driven water leaves on a flat), stretched 1,5–2,3 × along the pool's own axis.
 *  - at(a, k): the world point at angle a, fraction k of the way out to the shore;
 *  - frac(x, z): how far out a world point is, as that fraction (1 on the shore).
 */
export function poolShape([cx, cz, R, seed]) {
  const rad = (a) => R * (0.72 + 0.55 * noise2(Math.cos(a) * 1.3 + seed * 7.1, Math.sin(a) * 1.3 + seed * 3.3)
    + 0.12 * noise2(Math.cos(a) * 4 + seed, Math.sin(a) * 4 - seed)
    + 0.05 * noise2(Math.cos(a) * 13 + seed * 2.3, Math.sin(a) * 13 + seed)
    + 0.02 * noise2(Math.cos(a) * 37 - seed, Math.sin(a) * 37 + seed * 1.7));
  const stretch = poolStretch(seed), axis = noise2(seed * 1.9, 2.5) * Math.PI;
  const ca = Math.cos(axis), sa = Math.sin(axis), sx = Math.sqrt(stretch), sz = 1 / Math.sqrt(stretch);
  const at = (a, r, k = 1) => {
    const lx = Math.cos(a) * r * k * sx, lz = Math.sin(a) * r * k * sz;
    return [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca];
  };
  const frac = (x, z) => {
    const dx = x - cx, dz = z - cz, lx = (dx * ca + dz * sa) / sx, lz = (-dx * sa + dz * ca) / sz;
    const a = Math.atan2(lz, lx);
    return Math.hypot(lx, lz) / rad(a);
  };
  return { cx, cz, R, seed, rad, at, frac, reach: R * 1.3 * sx };
}
export const POOL_SHAPES = POOL_SPEC.map(poolShape);
/**
 * The pools' beds: carved 0,35 m below the flat in the middle, rising to it at the shore, under
 * water standing 6 cm over the flat. Wind-tidal flats hold water centimetres to decimetres deep;
 * these depths are ≈ (no survey of these pools: they are drawn, not measured). The ground is
 * carved to them (environment.js groundSample).
 */
export const POOL_DEPTH = 0.35;
/** The water surface on the pools, m (campus.js lays the water there). */
export const POOL_SURFACE = 0.06;
/** How far below the flat the pool bed is at a world point: 0 outside every pool. */
export function poolDepth(x, z) {
  for (const p of POOL_SHAPES) {
    if (Math.abs(x - p.cx) > p.reach || Math.abs(z - p.cz) > p.reach) continue;
    const k = p.frac(x, z);
    if (k < 1) return POOL_DEPTH * (1 - k * k);
  }
  return 0;
}

/**
 * The F-16's runway: a strip on the open plain just south-west of the site, parallel to the
 * exhibit row, its east end ≈500 m from the row. Placed by a search for the line nearest the site
 * that stays inside the ground disc, ≥300 m inland of the shoreline, clear of the site, the pad
 * and the pools (until 1 Oct 2026 it lay 1.5 km out, which the user found far too far). 8,000 ft
 * by 150 ft (2,438 × 45.7 m), a common size for a fighter base's runway (≈: no particular runway
 * is drawn; 9,000 ft did not fit this close). True bearing 100.8° (the scene's +X): runway 10/28.
 * The F-16 waits on the 28 end, next to the site; its taxiway and apron (runway.js) lie there too,
 * on the side towards the site.
 *  - (a, c): along the centre line (+a towards the east end) and across it (+c to the right of
 *    +a, the south side), metres from the runway's centre.
 *  - idents: the designation painted at the west end (landing towards +a) and at the east end.
 */
export const RUNWAY = { x: -1000, z: 500, angleDeg: 0, length: 2438.4, width: 45.72, margin: 60, idents: ['10', '28'] };
const RW_C = Math.cos(RUNWAY.angleDeg * Math.PI / 180), RW_S = Math.sin(RUNWAY.angleDeg * Math.PI / 180);
/** World (x, z) → runway (a, c). */
export function toRunway(x, z) { const dx = x - RUNWAY.x, dz = z - RUNWAY.z; return [dx * RW_C + dz * RW_S, -dx * RW_S + dz * RW_C]; }
/** Runway (a, c) → world [x, z]. */
export function fromRunway(a, c) { return [RUNWAY.x + a * RW_C - c * RW_S, RUNWAY.z + a * RW_S + c * RW_C]; }
/** The apron and its taxiway, in runway coordinates: the side towards the site (−c). */
// Near the 28 end, 371–491 m in from its threshold.
export const APRON = { a0: RUNWAY.length / 2 - 491, a1: RUNWAY.length / 2 - 371, c0: -190, c1: -95, taxi: { a: RUNWAY.length / 2 - 431, c0: -95, c1: -RUNWAY.width / 2, width: 23 } };
/** 0 on the runway, its shoulders, the taxiway and the apron (plus a margin), 1 in open country. */
export function runwayMask(x, z) {
  const [a, c] = toRunway(x, z), M = RUNWAY.margin;
  const strip = Math.hypot(Math.max(0, Math.abs(a) - RUNWAY.length / 2 - 60), Math.max(0, Math.abs(c) - RUNWAY.width / 2 - 10));
  const ap = Math.hypot(Math.max(0, APRON.a0 - a, a - APRON.a1), Math.max(0, APRON.c0 - c, c - APRON.c1));
  return smooth(0, M, Math.min(strip, ap));
}

/**
 * Where the land must stay flat and bare: 0 on the built site (the exhibit row and its roads,
 * the pad and its berm, the access road), round the tidal pools, on the runway and on the
 * Porsche's circuit and skid pad (circuitPlan.js), 1 in open country, with a
 * soft edge.
 */
export function siteMask(x, z) {
  // Exhibit row, roads and the campus berms.
  const dx = Math.max(0, Math.abs(x - 5) - 270), dz = Math.max(0, Math.abs(z - 15) - 175);
  let m = smooth(0, 70, Math.hypot(dx, dz));
  // Pad 2, its berm, tank farm and the access road to it.
  m = Math.min(m, smooth(250, 330, Math.hypot(x, z + 185)));
  for (const [px, pz, pr] of POOLS) m = Math.min(m, smooth(pr * 1.05, pr * 1.6, Math.hypot(x - px, z - pz)));
  return Math.min(m, runwayMask(x, z), circuitMask(x, z));
}

/** 0 on the beach and the foredune, 1 from ~260 m inland of the waterline. */
export function inland(x, z) {
  return smooth(160, 260, -seaward(x, z));
}

/** 0..1 how far up a loma this point is (1 at the crest), and the loma's height there. */
function loma(x, z) {
  let best = 0, h = 0;
  for (const [cx, cz, L, W, H, a] of LOMAS) {
    const c = Math.cos(a), s = Math.sin(a);
    const u = (x - cx) * c + (z - cz) * s, v = -(x - cx) * s + (z - cz) * c;
    // A ragged outline: the ellipse distance is pushed about by noise, so no two are alike.
    const q = Math.hypot(u / L, v / W) * (1 + 0.28 * (noise2(x / 70 + cx * 0.01, z / 70) - 0.5));
    if (q >= 1) continue;
    const k = Math.pow(1 - q * q, 1.6);
    // Steeper to windward, hummocky on top.
    const top = 1 + 0.18 * (noise2(x / 28 + 5, z / 28 - cz * 0.01) - 0.5);
    const hh = H * k * top;
    if (hh > h) h = hh;
    if (k > best) best = k;
  }
  return { k: best, h };
}

/**
 * Ground height above the plain's datum, metres. Lomas plus a gentle micro-relief of hollows
 * and swells a few tens of centimetres deep — the plain is flat, not planar — all zero on the
 * built site and the beach, which have their own grading.
 */
export function terrainHeight(x, z) {
  const m = siteMask(x, z) * inland(x, z);
  if (m <= 0) return 0;
  const micro = 0.55 * (noise2(x / 75 + 1.7, z / 75 - 2.9) - 0.5) + 0.25 * (noise2(x / 23 - 4, z / 23 + 8) - 0.5);
  return m * (loma(x, z).h + micro);
}

/**
 * Where tidal channels may run, 0..1: the open low plain. None on the built site, the pools'
 * margins, the beach and foredune, or up the lomas, which stand above the tide. SpaceX's own
 * photograph of the V3 wet dress rehearsal on Pad 2 shows the ground round the pad as marsh
 * grass cut by winding, water-filled channels and grey-brown flats with standing water. Their
 * course here is drawn by noise, NOT surveyed: the kind of ground, not a map of it.
 */
export function marsh(x, z) {
  // Its own, tighter site mask: in the photograph the channels come within a couple of hundred
  // metres of the mount, well inside the berm-and-tank-farm circle siteMask keeps flat.
  const dx = Math.max(0, Math.abs(x - 5) - 270), dz = Math.max(0, Math.abs(z - 15) - 175);
  let m = smooth(0, 30, Math.hypot(dx, dz));
  m = Math.min(m, smooth(150, 200, Math.hypot(x, z + 185)));   // berm 82 m, tank farm to ~120 m
  for (const [px, pz, pr] of POOLS) m = Math.min(m, smooth(pr * 1.05, pr * 1.5, Math.hypot(x - px, z - pz)));
  m = Math.min(m, runwayMask(x, z), circuitMask(x, z));
  m *= inland(x, z);
  if (m <= 0) return 0;
  return m * (1 - smooth(0.02, 0.25, loma(x, z).k));
}

/**
 * How much thornscrub cover a point carries, 0..1 (drawn as a ground tone): dense on the
 * lomas, patchy on slight rises of the plain, none on the site, the beach or the pools.
 */
export function thicket(x, z) {
  const m = siteMask(x, z) * inland(x, z);
  if (m <= 0) return 0;
  const l = loma(x, z).k;
  // Mottes: small groves on slight rises of the open plain.
  const motte = smooth(0.66, 0.8, noise2(x / 55 + 12, z / 55 - 7)) * 0.55;
  return m * Math.min(1, Math.max(smooth(0.05, 0.4, l), motte));
}

