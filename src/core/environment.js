/**
 * Lighting, sky, ground and the image-based environment used for reflections.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createEnvironment(renderer, scene, M) {
  const sunDir = new THREE.Vector3();

  // --- Sky (physical atmosphere shader) ---
  const sky = new Sky();
  sky.scale.setScalar(6000);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.1;
  su.rayleigh.value = 1.9;
  su.mieCoefficient.value = 0.0035;
  su.mieDirectionalG.value = 0.86;
  scene.add(sky);

  // --- Environment map for reflections: a private scene with the same sky + a ground disc ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(60);
  envScene.add(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshBasicMaterial({ color: 0x4c4842 }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -0.4;
  envScene.add(envGround);
  let envRT = null;

  // --- Lights ---
  const sun = new THREE.DirectionalLight(0xfff2e0, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd4ee, 0x6b6660, 0.45);
  scene.add(hemi);

  // --- Ground: concrete apron ---
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2500, 96), M.concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // Painted apron markings (subtle): a wide dark band and station lines under each exhibit.
  const markingMat = new THREE.MeshStandardMaterial({ color: 0xd9c25a, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const markings = new THREE.Group();
  markings.name = 'markings';
  scene.add(markings);
  function addStation(x, radius) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.18, radius, 96), markingMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.01, 0); ring.receiveShadow = true;
    markings.add(ring);
  }

  const fog = new THREE.FogExp2(0xc9d3de, 0.00019);
  scene.fog = fog;

  function setSun(elevationDeg, azimuthDeg) {
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    sunDir.setFromSphericalCoords(1, phi, theta);
    su.sunPosition.value.copy(sunDir);
    envSky.material.uniforms.sunPosition.value.copy(sunDir);
    envSky.material.uniforms.turbidity.value = su.turbidity.value;
    envSky.material.uniforms.rayleigh.value = su.rayleigh.value;
    envSky.material.uniforms.mieCoefficient.value = su.mieCoefficient.value;
    envSky.material.uniforms.mieDirectionalG.value = su.mieDirectionalG.value;
    // Colour temperature and intensity vs elevation (simple, plausible curve).
    // Direct sunlight only turns strongly orange within a few degrees of the horizon; at
    // working elevations it is close to neutral, and an over-saturated sun tints bare metal.
    const t = THREE.MathUtils.clamp(elevationDeg / 60, 0, 1);
    const warmth = Math.pow(1 - t, 2.2);
    sun.color.setHSL(0.085, 0.05 + 0.42 * warmth, THREE.MathUtils.lerp(0.72, 0.99, Math.pow(t, 0.5)));
    sun.intensity = THREE.MathUtils.lerp(1.6, 3.6, Math.pow(t, 0.65));
    hemi.color.setHSL(0.58, 0.32 - 0.12 * warmth, 0.62 + 0.08 * t);
    hemi.intensity = THREE.MathUtils.lerp(0.3, 0.55, t);
    fog.color.setHSL(0.58, 0.18 + 0.14 * warmth, THREE.MathUtils.lerp(0.50, 0.70, t));
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.0;
  }

  const _tmp = new THREE.Vector3();
  function updateShadow(target, distance) {
    const size = THREE.MathUtils.clamp(distance * 1.25 + 8, 18, 340);
    const cam = sun.shadow.camera;
    if (Math.abs(cam.right - size) > 0.5) {
      cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
    sun.target.position.copy(target);
    _tmp.copy(sunDir).multiplyScalar(500).add(target);
    sun.position.copy(_tmp);
    sun.target.updateMatrixWorld();
  }

  // Azimuth is chosen so the exhibits are lit from the side the default views look from,
  // raked about 35° off the camera axis for modelling rather than flat frontal light.
  setSun(42, 34);

  return { sun, sky, hemi, ground, setSun, updateShadow, addStation, get sunDir() { return sunDir; } };
}
