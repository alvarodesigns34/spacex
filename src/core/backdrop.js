/**
 * Orbital backdrop for the Roadster's "Tierra al fondo" view.
 *
 * The preset promised an Earth and showed desert and sky, which oversold it. This supplies the
 * thing the name claims — but as an explicitly illustrative backdrop, not a measured object:
 * the globe carries generic ocean, cloud and terminator shading, no attempt at real coastlines,
 * and the exhibit copy says so. Everything else in the centre is built to a cited dimension;
 * this is scenery, and is labelled as scenery.
 */
import * as THREE from 'three';
import { canvas, shade, fbm } from '../materials/textures.js';
import { mesh, seeded } from '../geometry/utils.js';

function earthMaps() {
  const c = canvas(1024, 512);
  shade(c, (x, y, u, v) => {
    const lat = (v - 0.5) * 2;
    // Land/sea mask: banded noise, deliberately generic. The threshold is the measured 71st
    // percentile of this fbm, so the globe comes out roughly 29 % land like the real one — at
    // the old 0.055 it was 95 % land and read as an olive swamp planet. Slight northward bias.
    const land = fbm(x * 0.026, y * 0.026, 5, 2.2, 0.52) - 0.564 + lat * 0.030 - Math.abs(lat) * 0.045;
    const ice = Math.max(0, Math.abs(lat) - 0.80) / 0.20;
    const cloud = Math.max(0, fbm(x * 0.045 + 40, y * 0.045 - 18, 5, 2.4, 0.55) * 1.5
      + 0.32 * Math.cos(lat * Math.PI * 2.6) - 0.46);
    let r, g, b;
    if (land > 0.0) {
      const dry = fbm(x * 0.09, y * 0.09, 3);
      const edge = THREE.MathUtils.clamp(land * 14, 0, 1);   // green coasts, drier interiors
      r = 62 + dry * 78 * edge + 18; g = 84 + dry * 40; b = 52 + dry * 26;
    } else {
      const deep = THREE.MathUtils.clamp(-land * 5.5, 0, 1);
      r = 12 + (1 - deep) * 26; g = 44 + (1 - deep) * 52; b = 112 + (1 - deep) * 62;
    }
    const w = THREE.MathUtils.clamp(Math.max(cloud, ice), 0, 1);
    return [r + (238 - r) * w, g + (242 - g) * w, b + (248 - b) * w];
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Point stars as an additive shell, far enough out to sit behind the globe. */
function starShell(radius) {
  const N = 2600, rnd = seeded(4172);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = radius * s * Math.cos(th);
    pos[i * 3 + 1] = radius * u;
    pos[i * 3 + 2] = radius * s * Math.sin(th);
    const b = 0.25 + Math.pow(rnd(), 3) * 0.95;
    const warm = 0.9 + rnd() * 0.2;
    col[i * 3] = b * warm; col[i * 3 + 1] = b; col[i * 3 + 2] = b * (2 - warm);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.name = 'stars';
  p.frustumCulled = false;
  return p;
}

/**
 * @param {THREE.Vector3} centre  where the globe sits, in world metres
 * @param {number} radius         globe radius in world metres
 */
export function buildOrbitalBackdrop(centre, radius) {
  const g = new THREE.Group();
  g.name = 'orbital-backdrop';
  g.visible = false;

  const globe = mesh(new THREE.SphereGeometry(radius, 96, 64), new THREE.MeshStandardMaterial({
    map: earthMaps(), roughness: 0.92, metalness: 0.0, envMapIntensity: 0.15,
  }), { name: 'earth' });
  globe.position.copy(centre);
  globe.rotation.set(0.32, 1.9, 0.18);
  globe.castShadow = globe.receiveShadow = false;
  g.add(globe);

  // Atmospheric limb: a slightly larger back-faced shell fading at the edge, which is what
  // makes a sphere read as a planet rather than a ball.
  const limb = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.022, 72, 48),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x6fa8ff) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main(){ float d = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float a = pow(clamp(d, 0.0, 1.0), 3.2) * 0.85;
          if (!(a >= 0.004)) discard;
          gl_FragColor = vec4(uColor * a, a); }`,
    }),
  );
  limb.position.copy(centre);
  limb.name = 'earth-limb';
  g.add(limb);

  g.add(starShell(Math.max(radius * 2.6, 6200)));

  g.userData.dispose = () => {
    g.traverse(o => {
      if (!o.isMesh && !o.isPoints) return;
      o.geometry.dispose();
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    });
  };
  return g;
}
