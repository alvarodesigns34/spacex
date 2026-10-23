/**
 * The Cybertruck Lab's studio: its two lighting environments, its three floors, the planar
 * reflection and the material finishing, ported from the cybertruck repository's viewer
 * (web/src/lighting.js, materials.js and the floors of main.js) so the truck looks here as it
 * does there and in its Blender renders. Everything is procedural: no image is shipped.
 */
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** A flat light source for the environment scenes: above 1, since the PMREM works in floating point (HDR). */
function emissive(color, k) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  m.color.multiplyScalar(k);
  return m;
}
function panel(s, w, h, pos, look, mat) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  p.position.set(...pos); p.lookAt(new THREE.Vector3(...look)); s.add(p);
}

/**
 * "Studio": a dark room with long softboxes on the ceiling and the sides, which draw long, sharp
 * highlights along the stainless steel's facets, a key box and a cold backlight.
 */
function studioScene() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 36), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.BackSide }));
  room.position.y = 7; s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: 0x15171a }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.95; s.add(floor);
  // Three ceiling strips along the truck (glTF Z) and one across.
  for (const x of [-3.2, 0, 3.2]) panel(s, 1.1, 18, [x, 13.5, 0], [x, 0, 0], emissive(0xffffff, 5.5));
  panel(s, 14, 0.9, [0, 13.4, -6], [0, 0, -6], emissive(0xfff6ec, 3.5));
  // Upright strips on both sides: the long lines on the slanted faces.
  for (const z of [-5, 1, 7]) {
    panel(s, 0.8, 7, [-16, 4.5, z], [0, 4.5, z], emissive(0xf3f6ff, 3.2));
    panel(s, 0.8, 7, [16, 4.5, z], [0, 4.5, z], emissive(0xfff4ea, 2.4));
  }
  // Key box (front three-quarter, driver's side) and a cold backlight.
  panel(s, 7, 4.5, [-11, 6, -12], [0, 1, 0], emissive(0xffffff, 4.0));
  panel(s, 9, 3, [8, 5, 14], [0, 1, 0], emissive(0xdde8ff, 2.2));
  // A faint horizon band, which separates the lower edge of the panels from the floor.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 17.5, 0.6, 64, 1, true), emissive(0x9aa3ad, 0.9));
  band.position.y = 0.6; s.add(band);
  return s;
}

/** "Exterior": a sky dome with a gradient, a sun and warm ground, to see the truck in daylight. */
function exteriorScene() {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x3d6fb3).multiplyScalar(1.6) },
      horizon: { value: new THREE.Color(0xdfe7ef).multiplyScalar(2.0) },
      ground: { value: new THREE.Color(0x6b6256).multiplyScalar(0.9) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; varying vec3 vDir;' +
      'void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon, ground, pow(-h, 0.35));' +
      ' gl_FragColor = vec4(c, 1.0); }',
  }));
  s.add(sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 12), emissive(0xfff1dc, 60));
  sun.position.set(-18, 22, -14);
  s.add(sun);
  return s;
}

/** The viewer's two settings: background, fog, exposure, environment strength and the key light. */
export const ENVIRONMENTS = {
  // The fog is nearer than the viewer's (22–60 m): with the opaque floor, its far rim, 35–37 m
  // from the default cameras, drew a hard horizon against the dark room.
  studio: { label: 'Studio', background: 0x0d0f12, fog: [0x0d0f12, 12, 30], exposure: 1.0, envIntensity: 1.0,
    key: { color: 0xffffff, intensity: 2.2, pos: [-6, 9, -5] }, hemi: 0.25 },
  exterior: { label: 'Exterior', background: 0xb9c7d6, fog: [0xb9c7d6, 30, 90], exposure: 0.72, envIntensity: 0.9,
    key: { color: 0xfff1dc, intensity: 3.2, pos: [-9, 11, -7] }, hemi: 0.45 },
};

/** Both environments, prefiltered once (PMREM); the scenes that made them are disposed. */
export function environmentMaps(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const maps = {};
  for (const [name, make, sigma] of [['studio', studioScene, 0.015], ['exterior', exteriorScene, 0.02]]) {
    const s = make();
    maps[name] = pmrem.fromScene(s, sigma).texture;
    s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  pmrem.dispose();
  return maps;
}

function radialTexture(stops, size, colorSpace) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), h = size / 2;
  const grd = g.createRadialGradient(h, h, size / 50, h, h, h);
  for (const [k, col] of stops) grd.addColorStop(k, col);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = colorSpace;
  return t;
}

/**
 * The three floors, as in the viewer. The glass one is the default: at full explosion, with the
 * default amplitude, 124 parts end up wholly below the ground (audit, C15), and an opaque floor
 * hides them. Glass: a translucent, faintly reflective sheet fading to the rim, with an invisible
 * catcher that keeps only the contact shadow. Opaque: the dark studio disc (or a pale pavement
 * outdoors). Hidden: nothing, and the camera can go round underneath.
 */
export function createFloors(scene) {
  const map = radialTexture([[0, '#2a2e34'], [0.55, '#16191d'], [1, '#0d0f12']], 512, THREE.SRGBColorSpace);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(26, 96),
    new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true;
  ground.name = 'cybertruck-lab-floor';
  const glass = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.MeshPhysicalMaterial({
    color: 0x8fa3b6, metalness: 0, roughness: 0.12, transparent: true, opacity: 0.24,
    alphaMap: radialTexture([[0, '#ffffff'], [0.45, '#bdbdbd'], [1, '#000000']], 256, THREE.NoColorSpace),
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false,
  }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = -0.002; glass.renderOrder = 2;
  glass.name = 'cybertruck-lab-glass';
  const catcher = new THREE.Mesh(new THREE.CircleGeometry(10, 64), new THREE.ShadowMaterial({ opacity: 0.32 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.001; catcher.receiveShadow = true; catcher.renderOrder = 3;
  const grid = new THREE.GridHelper(24, 48, 0x2a2f36, 0x1b1e23);
  grid.material.transparent = true; grid.material.opacity = 0.35;
  scene.add(ground, glass, catcher, grid);
  const floors = { ground, glass, catcher, grid, mode: 'glass' };
  floors.set = (mode, env) => {
    floors.mode = mode;
    ground.visible = mode === 'opaque';
    glass.visible = catcher.visible = mode === 'glass';
    grid.visible = mode !== 'hidden';
    grid.material.opacity = mode === 'glass' ? 0.22 : 0.35;
    const outdoors = env === 'exterior';
    ground.material.map = outdoors ? null : map;
    ground.material.color.set(outdoors ? 0x8b9096 : 0xffffff);
    ground.material.needsUpdate = true;
    glass.material.color.set(outdoors ? 0xc7d3de : 0x8fa3b6);
  };
  return floors;
}

/**
 * A real planar reflection of the truck on the floor, translucent and fading to the rim. It draws
 * the whole model a second time, so the Lab only builds it on the high tier (audit, §4.5).
 */
export function createFloorReflector(radius, scale) {
  const geo = new THREE.CircleGeometry(radius, 96);
  const size = (w, h) => [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
  const [tw, th] = size(window.innerWidth, window.innerHeight);
  const refl = new Reflector(geo, {
    textureWidth: tw, textureHeight: th, color: 0xffffff, clipBias: 0.002,
    shader: {
      name: 'FadingReflector',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, strength: { value: 0.24 }, fadeRadius: { value: radius } },
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vPos;' +
        'void main(){ vUv = textureMatrix * vec4(position, 1.0); vPos = position;' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform float strength;
        uniform float fadeRadius;
        varying vec4 vUv;
        varying vec3 vPos;
        void main() {
          vec4 base = texture2DProj(tDiffuse, vUv);
          float r = length(vPos.xy) / fadeRadius;
          float a = strength * (1.0 - smoothstep(0.25, 1.0, r));
          gl_FragColor = vec4(base.rgb * color, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  refl.material.transparent = true;
  refl.material.depthWrite = false;
  refl.rotation.x = -Math.PI / 2;
  refl.position.y = -0.0015;
  refl.renderOrder = 1;
  refl.name = 'cybertruck-lab-reflector';
  refl.setStrength = (k) => { refl.material.uniforms.strength.value = k; };
  refl.resize = (w, h) => refl.getRenderTarget().setSize(...size(w, h));
  return refl;
}

/**
 * The viewer's material finishing, by Blender material-name prefix: the parameters glTF does not
 * carry (environment strength, glass thickness, the LEDs' and screens' emission) on top of the
 * exported maps, which are kept. Its random brushed-steel fallback is not carried over: the GLB
 * has had its own roughness maps since version 2 (audit, C13).
 */
function glass(m, color, transmission, thickness = 0.005) {
  m.color = new THREE.Color(color);
  m.metalness = 0;
  m.roughness = Math.min(m.roughness ?? 0.03, 0.05);
  m.transmission = transmission;
  m.ior = 1.52;
  m.thickness = thickness;
  m.transparent = false;
  m.envMapIntensity = 1.2;
  m.specularIntensity = 1.0;
}
const FINISH = [
  ['CT_Stainless_Steel', (m) => { m.metalness = 1.0; if (!m.anisotropy) m.anisotropy = 0.55; m.envMapIntensity = 1.15; }],
  ['CT_Glass_Windshield', (m) => glass(m, 0xdfe7e5, 0.92, 0.0055)],
  ['CT_Glass_Side', (m) => glass(m, 0x8a9294, 0.80, 0.004)],
  ['CT_Glass_Roof', (m) => glass(m, 0x23272a, 0.55, 0.006)],
  ['CT_Lens_Clear', (m) => glass(m, 0xffffff, 0.9, 0.003)],
  ['CT_Lens_Red', (m) => { glass(m, 0xc8100c, 0.6, 0.003); m.attenuationColor = new THREE.Color(0xff1a10); }],
  ['CT_Lens_Smoked', (m) => glass(m, 0x1c1c1e, 0.5, 0.003)],
  ['CT_Mirror_Glass', (m) => { m.metalness = 1; m.roughness = 0.03; m.color.setRGB(0.92, 0.92, 0.92); }],
  ['CT_LED_White', (m) => { m.emissive = new THREE.Color(0xfff6ea); m.emissiveIntensity = 4.0; }],
  ['CT_LED_Red', (m) => { m.emissive = new THREE.Color(0xff1408); m.emissiveIntensity = 3.0; }],
  ['CT_LED_Amber', (m) => { m.emissive = new THREE.Color(0xff7a10); m.emissiveIntensity = 2.0; }],
  ['CT_Screen', (m) => {
    m.color.setRGB(0.01, 0.012, 0.016); m.roughness = 0.08; m.metalness = 0;
    m.emissive = new THREE.Color(0x1d2836); m.emissiveIntensity = 0.9; m.clearcoat = 1;
  }],
  ['CT_Upholstery', (m) => { m.sheenRoughness = 0.6; m.envMapIntensity = 0.8; }],
  ['CT_Headliner', (m) => { m.sheenRoughness = 0.8; m.envMapIntensity = 0.7; }],
  ['CT_Carpet', (m) => { m.sheenRoughness = 0.9; m.envMapIntensity = 0.6; }],
  ['CT_Tire', (m) => { m.envMapIntensity = 0.7; }],
  ['CT_Aluminium', (m) => { m.envMapIntensity = 1.05; }],
];

/** Every material as a MeshPhysicalMaterial with its finish; each source material is done once (`cache`). */
export function finishMaterial(mat, cache, maxAnisotropy) {
  if (!mat) return mat;
  let m = cache.get(mat);
  if (m) return m;
  m = mat;
  if (!m.isMeshPhysicalMaterial) {
    m = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, mat);
    m.name = mat.name;
    mat.dispose();
  }
  FINISH.find(([prefix]) => m.name?.startsWith(prefix))?.[1](m);
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) m[k].anisotropy = Math.max(m[k].anisotropy, Math.min(8, maxAnisotropy));
  m.needsUpdate = true;
  cache.set(mat, m);
  return m;
}
