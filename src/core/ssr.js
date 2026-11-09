/**
 * Screen-space reflections on the sea (audit of 9-11-2026, block 2): until then the water reflected
 * the environment probe only — sky and a generic ground — so from the beach the pad, the tower and
 * the vehicles had no reflection in the sea in front of them.
 *
 * It reuses the ambient occlusion's depth and normal buffer (core/ao.js; high tier), and only acts on
 * the sea: a pixel is water when its world position lies at the sea's height and seaward of the
 * waterline (the same sampled shore as the waves, core/ocean.js). The buffer draws the sea flat (it
 * is drawn without the waves' vertex shader), so the normal is the waves' own at that point, every
 * wave as a slope (oceanFarSlopeGLSL). The reflected ray is marched in view space — 64 steps
 * growing ≈7 % each, out to ≈1 km — against the depth buffer, refined by bisection where it passes
 * behind a surface, and its colour mixed in by Schlick's Fresnel for water (F0 ≈ 0.02), faded where
 * the ray leaves the screen or finds nothing (there the probe's reflection stays).
 *
 * Limits (≈, the method's own): only what is on screen can be reflected; the depth buffer has one
 * layer, so a ray behind a thin object can hit it wrongly (a thickness test bounds that); the buffer
 * is redrawn when the view changes (core/gbufferCache.js), not for every wave.
 */
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SEA_LEVEL, offshoreGLSL, oceanFarSlopeGLSL, WAVES } from './ocean.js';

export function createSeaSSR(aoPass, camera, oceanU) {
  const shader = {
    name: 'SeaSSR',
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: aoPass.depthTexture },
      uProj: { value: new THREE.Matrix4() },
      uProjInv: { value: new THREE.Matrix4() },
      uViewToWorld: { value: new THREE.Matrix4() },
      uWorldToView: { value: new THREE.Matrix4() },
      uShore: oceanU.uShore,
      uOceanPhase: oceanU.uOceanPhase,
      uOn: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse, tDepth;
      uniform mat4 uProj, uProjInv, uViewToWorld, uWorldToView;
      uniform float uOn;
      uniform float uOceanPhase[${WAVES.length}];
      varying vec2 vUv;
      ${offshoreGLSL('ssrOffshore')}
      ${oceanFarSlopeGLSL('ssrSlope')}
      vec3 viewAt(vec2 uv, float d) {
        vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return p.xyz / p.w;
      }
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        gl_FragColor = base;
        if (uOn < 0.5) return;
        float d = texture2D(tDepth, vUv).x;
        if (d >= 1.0) return;
        vec3 P = viewAt(vUv, d);
        vec3 W = (uViewToWorld * vec4(P, 1.0)).xyz;
        // Water: at the sea's height (the swell is a metre or two), seaward of the waterline.
        if (abs(W.y - (${SEA_LEVEL.toFixed(2)})) > 2.5) return;
        float off = ssrOffshore(W.xz);
        if (off < 3.0) return;
        // The waves' normal there, in view space.
        vec2 g = ssrSlope(W.xz, 1e6, 0.0, smoothstep(2.0, 48.0, off), 0.0);
        vec3 N = normalize((uWorldToView * vec4(normalize(vec3(-g.x, 1.0, -g.y)), 0.0)).xyz);
        vec3 V = normalize(P);
        vec3 R = reflect(V, N);
        if (R.z > 0.0 && P.z > -5.0) return;
        float cosT = clamp(dot(-V, N), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
        // March: steps growing 7 % each, from 0.5 m.
        float t = 0.5, dt = 0.5, prevT = 0.0;
        vec2 hitUv = vec2(-1.0);
        for (int i = 0; i < 64; i++) {
          vec3 Q = P + R * t;
          vec4 c = uProj * vec4(Q, 1.0);
          vec2 uv = c.xy / c.w * 0.5 + 0.5;
          if (c.w <= 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) break;
          float sd = texture2D(tDepth, uv).x;
          if (sd < 1.0) {
            float sz = viewAt(uv, sd).z;
            float thick = max(1.0, t * 0.06);
            if (Q.z < sz && sz - Q.z < thick) {
              // Bisection between the last step in front and this one behind.
              float a = prevT, b = t;
              for (int k = 0; k < 6; k++) {
                float m = 0.5 * (a + b);
                vec3 M = P + R * m;
                vec4 mc = uProj * vec4(M, 1.0);
                vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
                float mz = viewAt(muv, texture2D(tDepth, muv).x).z;
                if (M.z < mz) b = m; else a = m;
                uv = muv;
              }
              hitUv = uv;
              break;
            }
          }
          prevT = t;
          dt *= 1.07;
          t += dt;
        }
        if (hitUv.x < 0.0) return;
        // Not on another stretch of the sea itself (the probe's sky is right there), and faded at the
        // screen's edges.
        vec3 HW = (uViewToWorld * vec4(viewAt(hitUv, texture2D(tDepth, hitUv).x), 1.0)).xyz;
        if (abs(HW.y - (${SEA_LEVEL.toFixed(2)})) < 2.0 && ssrOffshore(HW.xz) > 0.0) return;
        vec2 e = smoothstep(vec2(0.0), vec2(0.08), hitUv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - hitUv);
        float w = F * e.x * e.y;
        gl_FragColor = vec4(mix(base.rgb, texture2D(tDiffuse, hitUv).rgb, w), base.a);
      }`,
  };
  const pass = new ShaderPass(shader);
  pass.name = 'sea-ssr';
  return {
    pass,
    /** Per frame, before the composer renders. */
    update(on) {
      const u = pass.material.uniforms;
      u.uOn.value = on ? 1 : 0;
      u.tDepth.value = aoPass.depthTexture;
      u.uProj.value.copy(camera.projectionMatrix);
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.uViewToWorld.value.copy(camera.matrixWorld);
      u.uWorldToView.value.copy(camera.matrixWorldInverse);
    },
  };
}
