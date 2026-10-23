/**
 * The firefly clamp that goes ahead of a bloom pass (the site's, since September 2026, and the
 * Cybertruck Lab's). A thin, curved, polished part — a weld ring, a rail, a tube — always has a
 * pixel somewhere that mirrors the sun straight into the lens, and in HDR that one pixel can be
 * hundreds of times white. The bloom's mip chain spread it into a bright square hanging beside
 * the booster on its way home. The clamp scales any pixel down to a peak of 12, far above where
 * the tone mapping has already saturated to white, so the image is unchanged and only the bloom
 * stops blowing single pixels up into blocks.
 *
 * The same pass drops non-finite pixels. One NaN — a zero-length normal on a sliver triangle,
 * normalize(vec3(0)) in the lit shader — or one Inf from a half-float overflow went through the
 * clamp untouched (NaN fails `m > uPeak`; Inf · (uPeak / Inf) is NaN), and the bloom's blur chain
 * spread it into a black rectangle hundreds of pixels wide that flickered as the camera moved near
 * the Porsche and the H2R (October 2026). The check is made twice: with isnan/isinf, and on the
 * bits (an all-ones exponent is NaN or Inf), because a compiler that assumes no NaN (HLSL's
 * without IEEE strictness, fast-math elsewhere) may fold isnan and any float comparison away, but
 * not integer operations.
 */
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function fireflyClampPass(peak = 12.0) {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uPeak: { value: peak } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uPeak; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          const uint EXP = 0x7f800000u;
          bvec3 nonFinite = equal(floatBitsToUint(c.rgb) & uvec3(EXP), uvec3(EXP));
          if (any(isnan(c.rgb)) || any(isinf(c.rgb)) || any(nonFinite)) c.rgb = vec3(0.0);
          if (isnan(c.a) || (floatBitsToUint(c.a) & EXP) == EXP) c.a = 1.0;
          float m = max(max(c.r, c.g), c.b);
          gl_FragColor = vec4(m > uPeak ? c.rgb * (uPeak / m) : c.rgb, c.a);
        }`,
  });
}
