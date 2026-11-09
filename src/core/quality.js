/**
 * How hard to push the machine that is actually running this.
 *
 * The centre is one scene: 1.1 M triangles, ~800 meshes, a 4096² shadow map, MSAA and bloom,
 * and a procedural texture set that costs a couple of seconds of main thread to build. On a
 * desktop GPU that is comfortable. On a phone it is not, and the failure mode is not a
 * stutter — it is a blank screen and a killed tab.
 *
 * Three tiers, deliberately coarse. Since 8-11-2026 (the user's rule: never lower the quality to
 * gain speed) the centre always starts at `high`; the other two exist only for ?quality=medium|low
 * (testing a cheaper path on purpose) and the device probe is reported, not applied:
 *
 *   high    a discrete or desktop-class GPU with room to spare
 *   medium  a capable laptop or tablet: full geometry, cheaper shadows and pixels
 *   low     a phone, a software renderer, or anything that looks starved
 *
 * The tier changes cost, never correctness: every vehicle is still built at 1:1 from the same
 * figures, every published dimension still measures the same, and the verification gate does
 * not know which tier it ran under. What moves is pixel ratio, shadow resolution, whether
 * bloom runs, how eagerly the level-of-detail system drops to its far state, and how many
 * particles the ground cloud carries.
 */

import { setAnisotropyLimit } from '../materials/textures.js';

/**
 * Reads what the platform will tell us. Deliberately cheap and side-effect free: it runs
 * before anything else is built, and a probe that hangs is worse than a wrong guess.
 */
function probe(renderer) {
  const gl = renderer.getContext();
  let vendor = '', model = '';
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) ?? '');
      model = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '');
    }
  } catch { /* the extension is optional and is blocked by some privacy settings */ }
  return {
    renderer: `${vendor} ${model}`.trim(),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? 0,
    // Not a core count: it is the number of workers the browser is willing to admit to, which
    // is the closest thing to a device class that is actually exposed.
    threads: navigator.hardwareConcurrency ?? 4,
    memory: navigator.deviceMemory ?? null,          // GB, Chromium only
    dpr: window.devicePixelRatio || 1,
    // Coarse pointer and no hover is the honest signal for "phone or tablet"; a narrow window
    // on a desktop is not the same thing and must not be demoted.
    touch: matchMedia?.('(pointer: coarse)').matches ?? false,
    area: window.innerWidth * window.innerHeight,
  };
}

const TIERS = {
  high: {
    name: 'high',
    pixelRatio: 2,
    shadowMap: 4096,
    shadows: true,
    bloom: true,
    // Ambient occlusion: a second full-scene pass for the G-buffer plus two screen passes.
    ao: true,
    msaa: 4,
    // Pixels below which a level-of-detail entry drops its detail. 0 = never: the user's rule of
    // 8-11-2026 (no detail lost for speed in the normal mode) — every vehicle is drawn in full at
    // every distance. The reduced tiers keep their thresholds; they are only used when asked for.
    lodPixels: 0,
    cloudParticles: 1600,
    // Most iterations per view ray through the cumulus (clouds.js: long steps through empty air,
    // short ones, 18–70 m, inside cloud); 0 keeps the flat layer. 32 equal steps until 8-11-2026,
    // 256 until 9-11: replaying the march on the real cover (tools/sky-clouds-check.mjs) put 14 % of
    // rays over it, the low ones near the horizon, cut short — the specks there. 640 covers the 99th
    // percentile of that conservative replay; the cost is paid only on long rays.
    cloudSteps: 640,
    anisotropy: 16,
  },
  medium: {
    name: 'medium',
    pixelRatio: 1.5,
    shadowMap: 2048,
    shadows: true,
    bloom: true,
    msaa: 4,
    lodPixels: 5,
    // The cloud grew (bigger, longer-lived puffs); on the mid tier the count rises only a
    // little, since fill rate, not count, is what a full-screen transparent cloud costs.
    cloudParticles: 640,
    cloudSteps: 384,
    anisotropy: 8,
  },
  low: {
    name: 'low',
    pixelRatio: 1,
    shadowMap: 1024,
    shadows: true,
    bloom: false,
    msaa: 0,
    lodPixels: 9,
    cloudParticles: 300,
    cloudSteps: 0,
    anisotropy: 4,
  },
};

/**
 * @param renderer a live WebGLRenderer, for the context probe
 * @param force    'high' | 'medium' | 'low', from ?quality= — the escape hatch for testing
 *                 a tier you do not own, and for the headless gate, which must always see the
 *                 full scene or it would be checking a reduced one.
 */
export function pickQuality(renderer, force = null) {
  const info = probe(renderer);
  // Always the full tier unless one is asked for (?quality=). Until 8-11-2026 the probe below
  // demoted phones, software renderers and small-memory devices to `medium` or `low` on its own;
  // the user's rule of that day is maximum quality by default and no automatic reduction, so what
  // it would have picked is only reported (tier.suggested, the technical panel), never applied.
  let suggested = 'high';
  if (info.touch) suggested = 'medium';
  // SwiftShader and llvmpipe are CPU rasterisers: whatever else the device has, the GPU path
  // is not being used and nothing here will be fast.
  if (/swiftshader|llvmpipe|software|basic render/i.test(info.renderer)) suggested = 'low';
  else if (/mali-[gt]?[0-5]\d\b|adreno \(tm\) [1-5]\d\d\b|powervr/i.test(info.renderer)) suggested = 'low';
  if (info.memory !== null && info.memory <= 4) suggested = 'low';
  if (info.threads <= 4 && info.touch) suggested = 'low';
  if (suggested === 'medium' && info.area > 2.2e6 && info.threads <= 6) suggested = 'low';
  const name = force && TIERS[force] ? force : 'high';

  const tier = { ...TIERS[name], forced: !!force && !!TIERS[force], suggested, probe: info };
  // Never ask for more than the hardware admits to.
  tier.shadowMap = Math.min(tier.shadowMap, info.maxTexture || tier.shadowMap);
  tier.maxPixelRatio = tier.pixelRatio;           // the tier's own ceiling, for a later change of screen
  tier.pixelRatio = Math.min(tier.pixelRatio, info.dpr);
  return tier;
}

/**
 * Applies the parts of a tier that belong to the renderer itself, and publishes the
 * anisotropy ceiling to the texture builders — which is the one setting that has to be in
 * place BEFORE the materials are generated, because a CanvasTexture takes its filtering at
 * construction. It is also held to what the context reports: asking a device for 16× when it
 * caps at 4 does not fail, it just quietly gives you something else.
 */
export function applyQuality(renderer, tier) {
  renderer.setPixelRatio(tier.pixelRatio);
  renderer.shadowMap.enabled = tier.shadows;
  const hw = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
  tier.anisotropy = Math.max(1, Math.min(tier.anisotropy, hw));
  setAnisotropyLimit(tier.anisotropy);
}
