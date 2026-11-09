/**
 * Temporal anti-aliasing while the view holds still (audit of 9-11-2026, M4).
 *
 * MSAA (4×) smooths geometry edges only. What a shader draws — the cloud march's dither, the
 * 0.26 m heat-shield tiles and the tower's lattice going sub-pixel, the soft-shadow taps, a
 * specular glint — aliases inside the triangles. Full TAA reprojects the history with per-pixel
 * motion vectors, which this scene does not render. What it does render is a camera that very often
 * holds still (an exhibit, the photo mode, a paused sequence), and there the history needs no
 * reprojection: each still frame the projection is shifted by a sub-pixel Halton (2, 3) offset and
 * the frame is averaged into the history, 1/(n + 1) at frame n and never under 1/8, so a few dozen
 * frames give a supersampled picture. When the camera or the sequence moves it starts again from
 * the plain frame (MSAA, no ghosting). The sea and anything else animated keep moving under a held
 * camera: the 1/8 floor bounds their trail to a few frames.
 *
 * A pass placed after the AO and the sea's reflections and before the bloom, in linear HDR. Off
 * under automation (the checks compare exact frames) unless ?stillaa asks for it.
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const halton = (i, b) => { let f = 1, r = 0; for (; i > 0; i = Math.floor(i / b)) { f /= b; r += f * (i % b); } return r; };
const JITTER = Array.from({ length: 32 }, (_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5]);

class StillAAPass extends Pass {
  constructor() {
    super();
    this.history = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.blend = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tCur: { value: null }, tHist: { value: null }, uAlpha: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tCur, tHist; uniform float uAlpha; varying vec2 vUv;
        void main() { vec4 c = texture2D(tCur, vUv); gl_FragColor = mix(texture2D(tHist, vUv), c, uAlpha); }`,
      depthTest: false, depthWrite: false,
    }));
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }',
      depthTest: false, depthWrite: false,
    }));
    this.alpha = 1;
  }
  setSize(w, h) { this.history.setSize(w, h); this.alpha = 1; }
  render(renderer, writeBuffer, readBuffer) {
    const b = this.blend.material.uniforms;
    b.tCur.value = readBuffer.texture; b.tHist.value = this.history.texture; b.uAlpha.value = this.alpha;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.blend.render(renderer);
    // The result becomes the history.
    this.copy.material.uniforms.tSrc.value = this.renderToScreen ? readBuffer.texture : writeBuffer.texture;
    renderer.setRenderTarget(this.history);
    this.copy.render(renderer);
  }
  dispose() { this.history.dispose(); this.blend.dispose(); this.copy.dispose(); }
}

export function createStillAA(camera, { enabled = true } = {}) {
  const pass = new StillAAPass();
  pass.name = 'still-aa';
  const last = new THREE.Matrix4(), lastP = new THREE.Matrix4(), saved = new THREE.Matrix4();
  let n = 0, jittered = false;
  return {
    pass,
    get frames() { return n; },
    enabled,
    /**
     * Before the composer renders: is the view the same as last frame? Then shift the projection by
     * this frame's sub-pixel offset and set the blend; otherwise start over. `moving`: a sequence or
     * a drive is changing the scene.
     */
    begin(width, height, moving) {
      const still = this.enabled && !moving && camera.matrixWorld.equals(last) && camera.projectionMatrix.equals(lastP);
      last.copy(camera.matrixWorld); lastP.copy(camera.projectionMatrix);
      n = still ? n + 1 : 0;
      pass.alpha = n === 0 ? 1 : Math.max(1 / (n + 1), 1 / 8);
      jittered = n > 0;
      if (jittered) {
        const [jx, jy] = JITTER[n % JITTER.length];
        saved.copy(camera.projectionMatrix);
        camera.projectionMatrix.elements[8] += (2 * jx) / width;
        camera.projectionMatrix.elements[9] += (2 * jy) / height;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
    },
    /** After the composer has rendered: the projection back as it was. */
    end() {
      if (!jittered) return;
      camera.projectionMatrix.copy(saved);
      camera.projectionMatrixInverse.copy(saved).invert();
      jittered = false;
    },
  };
}
