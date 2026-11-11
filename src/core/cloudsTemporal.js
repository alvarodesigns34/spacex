/**
 * The cumulus march, spread over frames (measured on the user's RTX 3070, 11-11-2026).
 *
 * Marching every sky pixel every frame (clouds.js, 'volume') cost 62 of the overview's 76 ms of GPU
 * time at 3424 × 1345: the frame rate was 12–13 fps, and with the clouds off 68. The clouds do not
 * move (the cover is fixed in the world) and are soft, so a pixel's march need not be redone each
 * frame — what game engines do with their volumetric skies (Schneider, "The real-time volumetric
 * cloudscapes of Horizon Zero Dawn", SIGGRAPH 2015: one pixel in 16 per frame, the rest reprojected).
 *
 * Each frame, here:
 *  1. march: one pixel in each 4 × 4 block, at full resolution, the block's pixel changing every
 *     frame in a Bayer order, so in 16 frames every pixel has been marched. The march is the same
 *     function as before (clouds.js cloudMarch), and the dither offset moves on by the golden ratio
 *     each frame, so a pixel's successive marches sample different points along its ray.
 *  2. resolve, full resolution: the pixel marched this frame takes the new sample, averaged with
 *     its history (which halves the dither every time it comes round); every other pixel takes its
 *     history, reprojected — the cloud point it saw (the camera's ray out to the stored distance of
 *     the first cloud met) projected through last frame's camera. A pixel whose point was off screen
 *     last frame takes the new samples round it until its own turn comes.
 *  3. the dome, in the scene pass, draws the resolved picture (premultiplied) at the depth of its
 *     cloud, as the per-pixel dome did, so whatever is in front of a cloud stays in front.
 *
 * What it changes on screen: with a still or slowly turning camera, nothing but less grain (each
 * pixel averages its marches). A view that swings fast shows its newly uncovered edge at 4-pixel
 * resolution for up to a quarter of a second; a change of Sun or cover re-marches every pixel over
 * the next 16 frames from the old picture. The cube cameras of the reflection probes still see the
 * per-pixel dome (this needs a history in screen space).
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { COVER_GLSL, VOLUME_FN } from './clouds.js';

const BLOCK = 4;
// The pixel of a 4 × 4 block marched at frame n: a Bayer order, so each frame's samples are spread.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const ORDER = BAYER.map((_, i) => BAYER.indexOf(i)).map(k => [k % BLOCK, Math.floor(k / BLOCK)]);

const VERT = /* glsl */`
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// The ray of a full-resolution pixel, from the unjittered camera.
const RAY_GLSL = /* glsl */`
  uniform mat4 uInvVP;
  uniform vec3 uCam;
  uniform vec2 uRes;
  vec3 rayOf(vec2 px) {
    vec2 ndc = px / uRes * 2.0 - 1.0;
    vec4 w = uInvVP * vec4(ndc, 1.0, 1.0);
    return normalize(w.xyz / w.w - uCam);
  }`;

export function createCloudTemporal(uniforms) {
  const opts = { type: THREE.HalfFloatType, depthBuffer: false, count: 2, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const fresh = new THREE.WebGLRenderTarget(1, 1, { ...opts, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  let hist = [new THREE.WebGLRenderTarget(1, 1, opts), new THREE.WebGLRenderTarget(1, 1, opts)];
  for (const t of [fresh, ...hist]) for (const tx of t.textures) tx.generateMipmaps = false;

  const tu = {
    uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() },
    uCam: { value: new THREE.Vector3() }, uRes: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: new THREE.Vector2() }, uFrame: { value: 0 },
    uFreshC: { value: fresh.textures[0] }, uFreshD: { value: fresh.textures[1] },
    uHistC: { value: null }, uHistD: { value: null },
    uValid: { value: 0 }, uMix: { value: 0.5 },
  };

  const march = new FullScreenQuad(new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...uniforms, ...tu },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uSun, uSunColor, uShade;
      uniform float uLight, uFade, uCover;
      uniform vec2 uOffset;
      uniform float uFrame;
      layout(location = 0) out vec4 oColor;
      layout(location = 1) out vec4 oDist;
      ${COVER_GLSL}
      ${VOLUME_FN}
      ${RAY_GLSL}
      void main() {
        vec2 px = floor(gl_FragCoord.xy) * ${BLOCK.toFixed(1)} + uOffset + 0.5;
        float hit;
        oColor = cloudMarch(uCam, rayOf(px), px, fract(uFrame * 0.6180339887), hit);
        oDist = vec4(hit, 0.0, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));

  const resolve = new FullScreenQuad(new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: tu,
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform mat4 uPrevVP;
      uniform vec2 uOffset;
      uniform sampler2D uFreshC, uFreshD, uHistC, uHistD;
      uniform float uValid, uMix;
      in vec2 vUv;
      layout(location = 0) out vec4 oColor;
      layout(location = 1) out vec4 oDist;
      ${RAY_GLSL}
      vec2 prevUv(vec3 p, out bool on) {
        vec4 c = uPrevVP * vec4(p, 1.0);
        vec2 uv = c.xy / c.w * 0.5 + 0.5;
        on = c.w > 0.0 && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
        return uv;
      }
      void main() {
        vec2 px = floor(gl_FragCoord.xy);
        vec2 sub = mod(px, ${BLOCK.toFixed(1)});
        bool marched = all(equal(sub, uOffset));
        ivec2 cell = ivec2(px / ${BLOCK.toFixed(1)});
        vec3 d = rayOf(px + 0.5);
        // The cloud point this pixel sees, found from the history's distances (twice: the second
        // lookup at the first one's reprojection), then where it was on last frame's screen.
        bool on = false;
        vec2 uv = px / uRes + 0.5 / uRes;
        float dist = texture(uHistD, uv).r;
        vec2 p1 = prevUv(uCam + d * dist, on);
        if (on) { dist = texture(uHistD, p1).r; p1 = prevUv(uCam + d * dist, on); }
        bool valid = uValid > 0.5 && on;
        vec4 hc = texture(uHistC, p1);
        float hd = texture(uHistD, p1).r;
        if (marched) {
          vec4 fc = texelFetch(uFreshC, cell, 0);
          float fd = texelFetch(uFreshD, cell, 0).r;
          oColor = valid ? mix(hc, fc, uMix) : fc;
          oDist = vec4(valid && hc.a > 0.004 && fc.a > 0.004 ? mix(hd, fd, uMix) : (fc.a > 0.004 ? fd : hd), 0.0, 0.0, 1.0);
        } else if (valid) {
          oColor = hc; oDist = vec4(hd, 0.0, 0.0, 1.0);
        } else {
          // No history: the new samples round it, bilinear over the marched grid.
          vec2 fuv = ((px - uOffset) / ${BLOCK.toFixed(1)} + 0.5) / vec2(textureSize(uFreshC, 0));
          oColor = texture(uFreshC, fuv);
          oDist = vec4(texture(uFreshD, fuv).r, 0.0, 0.0, 1.0);
        }
      }`,
    depthTest: false, depthWrite: false,
  }));
  // The fresh grid is read bilinear for the fill-in above, nearest (texelFetch) for its own pixel.
  fresh.textures[0].minFilter = fresh.textures[0].magFilter = THREE.LinearFilter;
  fresh.textures[1].minFilter = fresh.textures[1].magFilter = THREE.LinearFilter;

  const vp = new THREE.Matrix4(), prevVP = new THREE.Matrix4();
  const lastSun = new THREE.Vector3(), lastCover = { v: -1 };
  let frame = 0, valid = false, w = 0, h = 0;
  const size = new THREE.Vector2();
  const stats = { marched: 0, resets: 0 };

  return {
    stats,
    /** The resolved picture: premultiplied colour and coverage, and the distance of the cloud. */
    get color() { return hist[0].textures[0]; },
    get dist() { return hist[0].textures[1]; },
    get resolution() { return tu.uRes.value; },
    /** Forget the history (a lost context, a change of size). */
    invalidate() { valid = false; },
    /** Once a frame, before the scene is drawn, with the camera as it will be drawn (unjittered). */
    render(renderer, camera, mark = null) {
      renderer.getDrawingBufferSize(size);
      if (size.x !== w || size.y !== h) {
        w = size.x; h = size.y;
        fresh.setSize(Math.ceil(w / BLOCK), Math.ceil(h / BLOCK));
        for (const t of hist) t.setSize(w, h);
        tu.uRes.value.set(w, h);
        valid = false;
      }
      camera.updateMatrixWorld();
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      tu.uInvVP.value.copy(vp).invert();
      tu.uCam.value.setFromMatrixPosition(camera.matrixWorld);
      tu.uPrevVP.value.copy(valid ? prevVP : vp);
      const [ox, oy] = ORDER[frame % ORDER.length];
      tu.uOffset.value.set(ox, oy);
      tu.uFrame.value = frame;
      // A new Sun or cover: the old picture is still the best guess, but a pixel's turn replaces it.
      const relit = lastSun.distanceToSquared(uniforms.uSun.value) > 1e-10 || lastCover.v !== uniforms.uCover.value;
      lastSun.copy(uniforms.uSun.value); lastCover.v = uniforms.uCover.value;
      tu.uMix.value = relit ? 1 : 0.5;
      tu.uValid.value = valid ? 1 : 0;

      const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(fresh);
      march.render(renderer);
      tu.uHistC.value = hist[0].textures[0]; tu.uHistD.value = hist[0].textures[1];
      mark?.('cloud resolve');
      renderer.setRenderTarget(hist[1]);
      resolve.render(renderer);
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAuto;
      hist = [hist[1], hist[0]];
      prevVP.copy(vp);
      valid = true;
      frame++;
      stats.marched++;
      if (relit) stats.resets++;
    },
    dispose() { fresh.dispose(); for (const t of hist) t.dispose(); march.dispose(); resolve.dispose(); },
  };
}
