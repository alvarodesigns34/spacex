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

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** The Gulf shore's world z at world x (the same line environment.js builds the beach on). */
export function shoreZ(x) {
  return -670 + 0.22 * x + 46 * (noise2(x / 280 + 3.1, 7.7) - 0.5) + 18 * (noise2(x / 90, 1.3) - 0.5);
}

/**
 * Lomas: [x, z, half-length, half-width, height, axis angle]. Elongated along the prevailing
 * wind, a few metres high, all at least a few hundred metres inland of the beach and clear of
 * the exhibits, the pad and the pools. Reconstructed, not surveyed.
 */
export const LOMAS = [
  [-760, 200, 190, 80, 6.0, 0.4], [-640, -430, 140, 62, 4.5, 1.1], [720, 340, 220, 90, 7.0, -0.3],
  [900, -90, 160, 70, 5.0, 0.9], [-1120, -150, 260, 105, 8.0, 0.2], [320, 740, 240, 95, 6.0, 0.15],
  [-400, 800, 200, 85, 5.5, -0.5], [1280, 520, 270, 115, 9.0, 0.6], [-1420, 620, 310, 125, 8.5, -0.2],
  [110, 1320, 300, 130, 7.0, 0.1], [1350, 160, 180, 80, 5.0, 1.2], [-980, 420, 150, 70, 4.0, 0.8],
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
  return z - R > -470;                                                             // clear of the dunes and beach
});
/** Each pool's stretch (1,5–2,3 × along its own axis) and its long half-axis reach. */
export const poolStretch = (seed) => 1.5 + 0.8 * noise2(seed * 3.7, 0.5);
const POOLS = POOL_SPEC.map(([x, z, r, seed]) => [x, z, r * 1.3 * Math.sqrt(poolStretch(seed))]);

/**
 * Where the land must stay flat and bare: 0 on the built site (the exhibit row and its roads,
 * the pad and its berm, the access road) and round the tidal pools, 1 in open country, with a
 * soft edge.
 */
export function siteMask(x, z) {
  // Exhibit row, roads and the campus berms.
  const dx = Math.max(0, Math.abs(x - 5) - 270), dz = Math.max(0, Math.abs(z - 15) - 175);
  let m = smooth(0, 70, Math.hypot(dx, dz));
  // Pad 2, its berm, tank farm and the access road to it.
  m = Math.min(m, smooth(250, 330, Math.hypot(x, z + 185)));
  for (const [px, pz, pr] of POOLS) m = Math.min(m, smooth(pr * 1.05, pr * 1.6, Math.hypot(x - px, z - pz)));
  return m;
}

/** 0 on the beach and the foredune, 1 from ~260 m inland of the waterline. */
export function inland(x, z) {
  return smooth(160, 260, z - shoreZ(x));
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

