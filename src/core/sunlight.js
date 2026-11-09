/**
 * The colour of direct sunlight at a given elevation, from the air it crosses (audit of 8-11-2026,
 * §35). It used to be an HSL ramp chosen by eye that at 5° gave a pale peach, (1, 0.94, 0.88): a
 * sunset that did not redden. Now:
 *
 *  - Transmittance per channel, exp(−τ·m), at 650, 550 and 450 nm (≈ the R, G, B of the display):
 *      Rayleigh optical depth of the whole atmosphere, sea level, by Hansen & Travis (1974, Space
 *        Sci. Rev. 16): τ ≈ 0.008569 λ⁻⁴ (1 + 0.0113 λ⁻² + 0.00013 λ⁻⁴), λ in µm: 0.049, 0.097,
 *        0.221. (Credited to Bodhaine et al. 1999 until 9-11-2026; Bodhaine's own fit, its eq. 30,
 *        agrees within ≈1 % here and is what tools/sunlight-check.mjs compares it with.)
 *      aerosol, Ångström's law τ = β λ^−α with α = 1.3 and β = 0.05 (≈ a clear coastal day:
 *        τ(550) ≈ 0.11; Starbase's own aerosol is not measured here);
 *      relative air mass m by Kasten and Young (1989), which stays finite at the horizon (≈38).
 *  - White balance: a camera's (or an eye's) white point follows the light, but not all the way —
 *    which is why a low sun reads golden at all. The colour shown is (T(e) / T(50°))^(1 − a): the
 *    transmittance against a daylight reference sun at 50°, with the white point carried a = 0.6 of
 *    the way towards the light (≈, chosen so the default 20° sun stays close to the neutral key
 *    the materials were calibrated under, (1, 0.96, 0.89) against the old (1, 0.98, 0.94)).
 * Three wavelengths are not a spectral integration nor a colorimetric transform: α, β, the white
 * point's 0.6 and the brightness ramp are choices (≈). A visual approximation with physical
 * components (external audit 8-11, finding 09).
 * Pure: numbers in, numbers out, so it is tested without a browser (tools/sunlight-check.mjs).
 */
const LAMBDA = [0.65, 0.55, 0.45];   // µm, R G B
const rayleigh = (l) => 0.008569 * l ** -4 * (1 + 0.0113 * l ** -2 + 0.00013 * l ** -4);
const ANGSTROM = { alpha: 1.3, beta: 0.05 };
/** Zenith optical depth per channel, R G B. */
export const TAU = LAMBDA.map((l) => rayleigh(l) + ANGSTROM.beta * l ** -ANGSTROM.alpha);
/** White balance: how far the white point follows the light (0 none, 1 completely). ≈ */
export const WB_FOLLOW = 0.6;
const REF_ELEV = 50;

/** Relative optical air mass at elevation `e` degrees (Kasten & Young 1989). */
export function airMass(e) {
  const h = Math.max(e, -0.5);
  return 1 / (Math.sin(h * Math.PI / 180) + 0.50572 * (h + 6.07995) ** -1.6364);
}
/** Direct-beam transmittance R G B at elevation `e` degrees. */
export function transmittance(e) {
  const m = airMass(e);
  return TAU.map((t) => Math.exp(-t * m));
}
/**
 * The displayed tint of direct sunlight at elevation `e` degrees, R G B with its largest channel 1:
 * the transmittance against the 50° reference, with the white balance following part of the way.
 */
export function sunTint(e) {
  const T = transmittance(e), R = transmittance(REF_ELEV);
  const c = T.map((v, i) => (v / R[i]) ** (1 - WB_FOLLOW));
  const k = Math.max(...c);
  return c.map((v) => v / k);
}
