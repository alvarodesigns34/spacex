/**
 * Lighting, sky, ground and the image-based environment used for reflections.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { starShell } from './backdrop.js';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';

export function createEnvironment(renderer, scene, M) {
  const sunDir = new THREE.Vector3();

  // --- Sky (physical atmosphere shader) ---
  const sky = new Sky();
  // Big enough that the camera stays inside it at any altitude the launch reaches; the
  // shader only uses direction, so the box is re-centred on the camera every frame.
  sky.scale.setScalar(400000);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.1;
  su.rayleigh.value = 1.9;
  su.mieCoefficient.value = 0.0035;
  su.mieDirectionalG.value = 0.86;
  // The atmosphere shader applies its own tone curve, so pulling its scattering to zero
  // still leaves a grey-blue field rather than space. Fading the whole sky out over a black
  // background is the honest way to reach a black sky at altitude.
  const skyFade = { value: 1 };
  sky.material.transparent = true;
  sky.material.depthWrite = false;
  sky.material.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = skyFade;
    sh.fragmentShader = `uniform float uFade;\n${sh.fragmentShader}`
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor, uFade );');
  };
  scene.background = new THREE.Color(0x03050b);
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

  // --- Ground: coastal plain terrain ---
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2500, 96), M.terrain || M.concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // Painted apron markings (subtle): a wide dark band and station lines under each exhibit.
  const markingMat = new THREE.MeshStandardMaterial({ color: 0xd9c25a, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const markings = new THREE.Group();
  markings.name = 'markings';
  scene.add(markings);
  function addStation(x, z, radius) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.18, radius, 96), markingMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.01, z); ring.receiveShadow = true;
    markings.add(ring);
  }

  // --- Night ---------------------------------------------------------------------------
  // The sun control used to be an elevation slider that stopped at 6 degrees. Taking it below
  // the horizon costs one blend factor and turns the whole centre into a different place, so
  // the exhibits get display lighting and the sky gets stars. The floodlights and the tower
  // beacons are display lighting, not flight hardware, and the sheet says so.
  const night = new THREE.Group();
  night.name = 'night';
  night.visible = false;
  scene.add(night);
  const stars = starShell(3400);
  stars.material.opacity = 0; stars.material.transparent = true;
  night.add(stars);
  const displayLights = [];
  // The luminaires are real furniture, so they stand in the scene by day as well; only the
  // lens and the light itself follow the sun down. A bare SpotLight with nothing to come out
  // of is what the first version was, and at night the exhibits were lit by nothing visible.
  const lightMasts = new THREE.Group();
  lightMasts.name = 'light-masts';
  scene.add(lightMasts);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x2a2c30, emissive: 0xffe2ae, emissiveIntensity: 0, roughness: 0.35, metalness: 0.1,
  });

  /**
   * One floodlight per station: a slim mast set outside the station ring with a shoebox head
   * angled in at the exhibit. No shadow map — seven shadow-casting spots is not worth it, and
   * the sun already owns the shadows.
   */
  function addDisplayLight(x, z, radius, height) {
    const H = THREE.MathUtils.clamp(height * 0.55 + 3.2, 4.2, 26);
    // Behind and to one side, so it never stands between the default views and the exhibit.
    const px = x + radius * 0.92, pz = z + radius * 0.92;

    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    // Aim the head at the exhibit.
    g.rotation.y = Math.atan2(x - px, z - pz);

    const parts = [];
    parts.push({ geometry: new THREE.CylinderGeometry(0.24, 0.30, 0.10, 20), matrix: mat4([0, 0.05, 0]) });
    parts.push({ geometry: new THREE.CylinderGeometry(0.062, 0.098, H, 16), matrix: mat4([0, H / 2 + 0.08, 0]) });
    // Arm reaching in over the exhibit.
    parts.push({ geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.62, 12), matrix: mat4([0, H + 0.02, 0.30], [Math.PI / 2, 0, 0]) });
    g.add(mesh(mergeAll(parts), M.mount, { name: 'light-mast' }));

    const head = new THREE.Group();
    head.position.set(0, H + 0.02, 0.60);
    head.rotation.x = 0.52;   // tilted down at the exhibit
    head.add(mesh(new THREE.BoxGeometry(0.46, 0.16, 0.30), M.mount, { name: 'luminaire' }));
    head.add(mesh(new THREE.BoxGeometry(0.40, 0.02, 0.24), lensMat, { position: [0, -0.088, 0], name: 'luminaire-lens' }));
    g.add(head);
    lightMasts.add(g);

    const spot = new THREE.SpotLight(0xffe9c8, 0, radius * 7, 0.60, 0.52, 1.15);
    spot.position.set(px + Math.sin(g.rotation.y) * 0.6, H + 0.02, pz + Math.cos(g.rotation.y) * 0.6);
    spot.target.position.set(x, height * 0.35, z);
    night.add(spot, spot.target);
    displayLights.push({ spot, peak: 55 + radius * radius * 3.4 });
  }

  const fog = new THREE.FogExp2(0xc9d3de, 0.00019);
  scene.fog = fog;
  const GROUND_FOG = 0.00019;
  let nightK = 0;

  /** Keeps the sky centred on the viewer. Cheap, and the only way it survives an ascent. */
  function followCamera(camera) { sky.position.copy(camera.position); stars.position.copy(camera.position); }

  // ---- One place composes the atmosphere ------------------------------------------------
  // Three things thin, darken or colour the air: the sun's elevation (day to night), the
  // camera's altitude (ground to space), and the orbital view. They used to write the same
  // uniforms from three functions, in whatever order they happened to be called, and the
  // composition was wrong: setAltitude() reassigned fog.density from the ground constant with
  // no night factor, so the launch — which calls it every frame — pulled daytime fog back over
  // a night scene, and reset()'s setAltitude(0) left day fog under lit floodlights.
  //
  // Now the three are inputs, and this function is the only writer. It is pure in the sense
  // that matters: called twice with the same inputs it produces the same scene.
  const air = { elev: 42, azim: 34, altitude: 0 };
  const SKY_GROUND = { turbidity: 2.1, rayleigh: 1.9, mie: 0.0035 };
  const _nightHemi = new THREE.Color(0x2c3d5e), _nightFog = new THREE.Color(0x070a12);

  /** @param rebuildProbe regenerate the PMREM. Costly: only when the sun itself moved. */
  function applyAtmosphere({ rebuildProbe = false } = {}) {
    const { elev, azim, altitude: h } = air;

    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(azim);
    sunDir.setFromSphericalCoords(1, phi, theta);
    su.sunPosition.value.copy(sunDir);

    // Night blend: starts a few degrees above the horizon, complete a few below it.
    nightK = THREE.MathUtils.clamp((5 - elev) / 15, 0, 1);
    const n = nightK * nightK * (3 - 2 * nightK);
    // Altitude blend: fully thin by ~26 km.
    const k = THREE.MathUtils.clamp(h / 26000, 0, 1);
    const j = 1 - Math.pow(1 - k, 2.2);

    // Colour temperature vs elevation. Direct sunlight only turns strongly orange within a few
    // degrees of the horizon; an over-saturated sun tints bare metal at working elevations.
    const t = THREE.MathUtils.clamp(elev / 60, 0, 1);
    const warmth = Math.pow(1 - t, 2.2);
    sun.color.setHSL(0.085, 0.05 + 0.42 * warmth, THREE.MathUtils.lerp(0.72, 0.99, Math.pow(t, 0.5)));
    sun.intensity = THREE.MathUtils.lerp(1.6, 3.6, Math.pow(t, 0.65)) * ((1 - n) + 0.012 * n);
    hemi.color.setHSL(0.58, 0.32 - 0.12 * warmth, 0.62 + 0.08 * t).lerp(_nightHemi, n);
    hemi.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.3, 0.55, t), 0.05, n) * (1 - j * 0.9);
    fog.color.setHSL(0.58, 0.18 + 0.14 * warmth, THREE.MathUtils.lerp(0.50, 0.70, t)).lerp(_nightFog, n);

    // Scattering: the two blends multiply. Everything is computed from the ground constants,
    // never read back out of the uniforms — reading and multiplying compounds on every call.
    const nightSky = {
      turbidity: SKY_GROUND.turbidity * (1 - n * 0.55),
      rayleigh: SKY_GROUND.rayleigh * (1 - n * 0.45),
      mie: SKY_GROUND.mie,
    };
    su.turbidity.value = nightSky.turbidity * (1 - j * 0.97);
    su.rayleigh.value = nightSky.rayleigh * (1 - j * 0.985);
    su.mieCoefficient.value = nightSky.mie * (1 - j * 0.9);
    fog.density = GROUND_FOG * (1 + n * 1.6) * (1 - THREE.MathUtils.clamp(h / 9000, 0, 1));
    skyFade.value = (1 - n * 0.86) * (1 - j * 0.94);

    stars.material.opacity = Math.pow(n, 1.6);
    night.visible = !inSpace && n > 0.02;
    lightMasts.visible = !inSpace;
    for (const d of displayLights) d.spot.intensity = d.peak * Math.pow(n, 1.3);
    lensMat.emissiveIntensity = 2.6 * Math.pow(n, 1.4);

    // Stretch the apron so there is still a surface under the vehicle on the way up. The
    // concrete tiles metrically, so it coarsens rather than smearing.
    ground.scale.setScalar(THREE.MathUtils.clamp(1 + h / 900, 1, 34));

    scene.environmentIntensity = THREE.MathUtils.lerp(1.0, 1.6, n) * (1 - j * 0.55);

    if (rebuildProbe) {
      // The probe is the sky at ground level for this sun, so chrome and clearcoat go dark
      // with the scene; it deliberately ignores the altitude thinning, which changes every
      // frame of an ascent and would cost a full PMREM pass each time.
      envSky.material.uniforms.sunPosition.value.copy(sunDir);
      envSky.material.uniforms.turbidity.value = nightSky.turbidity;
      envSky.material.uniforms.rayleigh.value = nightSky.rayleigh;
      envSky.material.uniforms.mieCoefficient.value = nightSky.mie;
      envSky.material.uniforms.mieDirectionalG.value = su.mieDirectionalG.value;
      envGround.material.color.setScalar(THREE.MathUtils.lerp(0.30, 0.02, n));
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene, 0.02);
      scene.environment = envRT.texture;
    }
  }

  function setAltitude(h) { air.altitude = h; applyAtmosphere(); }
  function setSun(elevationDeg, azimuthDeg) {
    air.elev = elevationDeg;
    air.azim = azimuthDeg;
    applyAtmosphere({ rebuildProbe: true });
  }

  /**
   * Takes the ground away for the Roadster's orbital view. The atmosphere is still thinned by
   * altitude, but the apron is still there, and in space a grey slab across the frame is worse
   * than no backdrop at all. Reversible: setSpace(false) restores the ground, its markings, the
   * sky and the fog exactly, which is what the check asserts after entering and leaving.
   */
  let inSpace = false;
  function setSpace(on) {
    if (on === inSpace) return;
    inSpace = !!on;
    ground.visible = !inSpace;
    markings.visible = !inSpace;
    sky.visible = !inSpace;
    scene.fog = inSpace ? null : fog;
    applyAtmosphere();
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

  return {
    sun, sky, hemi, ground, setSun, setAltitude, setSpace, followCamera, updateShadow, addStation,
    addDisplayLight, get night() { return nightK; },
    get inSpace() { return inSpace; }, get sunDir() { return sunDir; },
  };
}
