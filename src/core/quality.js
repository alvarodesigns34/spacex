/**
 * How hard to push the machine that is actually running this.
 *
 * The centre is one scene: 1.1 M triangles, ~800 meshes, a 4096² shadow map, MSAA and bloom,
 * and a procedural texture set that costs a couple of seconds of main thread to build. On a
 * desktop GPU that is comfortable. On a phone it is not, and the failure mode is not a
 * stutter — it is a blank screen and a killed tab.
 *
 * So the renderer's settings come from a tier picked once, at start-up, from what the device
 * actually reports rather than from a user-agent string. Three tiers, deliberately coarse:
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
    // Metres of object per screen pixel at which detail is dropped. Lower is greedier.
    lodPixels: 3.5,
    cloudParticles: 1600,
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
  let name = 'high';

  if (info.touch) name = 'medium';
  // SwiftShader and llvmpipe are CPU rasterisers: whatever else the device has, the GPU path
  // is not being used and nothing here will be fast.
  if (/swiftshader|llvmpipe|software|basic render/i.test(info.renderer)) name = 'low';
  else if (/mali-[gt]?[0-5]\d\b|adreno \(tm\) [1-5]\d\d\b|powervr/i.test(info.renderer)) name = 'low';
  if (info.memory !== null && info.memory <= 4) name = 'low';
  if (info.threads <= 4 && info.touch) name = 'low';
  // A large window on a weak device is the expensive combination, because cost scales with
  // pixels and the tier's pixelRatio has not been applied yet.
  if (name === 'medium' && info.area > 2.2e6 && info.threads <= 6) name = 'low';
  if (force && TIERS[force]) name = force;

  const tier = { ...TIERS[name], forced: !!force && !!TIERS[force], probe: info };
  // Never ask for more than the hardware admits to.
  tier.shadowMap = Math.min(tier.shadowMap, info.maxTexture || tier.shadowMap);
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
