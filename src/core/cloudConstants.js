/**
 * Numbers the cloud march (clouds.js) and its temporal resolve (cloudsTemporal.js) must agree on,
 * in a module of their own so neither has to import the other for them.
 */
/** The distance stored where a ray meets no cloud, m. Finite in a 16-bit float (max 65 504), and
 *  beyond the farthest cloud the march can reach (40 km to the slab + 16 km through it). */
export const CLOUD_FAR = 60000;
