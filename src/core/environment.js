/**
 * Lighting, sky, ground and the image-based environment used for reflections.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { starShell } from './backdrop.js';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';
import { noise2 } from '../materials/textures.js';
import { createClouds } from './clouds.js';

/**
 * The Gulf shore. Starbase stands on the coast at Boca Chica, and the plain runs out into a
 * beach and the sea; every wide view here ended instead in the same flat khaki to the horizon.
 * This is a PLAUSIBLE shore, not a survey: a gently wandering line about 1.1 km beyond the pad
 * (world z), a dry beach, a wet margin, and the ground sloping away under the water surface.
 * @returns the shore's world z at world x
 */
export function shoreZ(x) {
  return -1150 + 0.22 * x + 46 * (noise2(x / 280 + 3.1, 7.7) - 0.5) + 18 * (noise2(x / 90, 1.3) - 0.5);
}

/** Disc in the XY plane (rotated flat later) with a large-scale coastal tint. */
function coastalDisc(radius, rings, segs) {
  const count = 1 + rings * (segs + 1);
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  const idx = [];
  let k = 0;
  const push = (x, y) => {
    pos[k * 3] = x;
    pos[k * 3 + 1] = y;
    // Local y is world −z once the disc is laid flat; local z becomes height.
    const past = shoreZ(x) - -y;                 // metres seaward of the shoreline
    pos[k * 3 + 2] = past > 0 ? -9 * THREE.MathUtils.smoothstep(past, 0, 180) : 0.35 * THREE.MathUtils.smoothstep(-past, 0, 60) * (1 - THREE.MathUtils.smoothstep(-past, 60, 160));
    const broad = noise2(x / 110, y / 110);
    const patch = noise2(x / 42 + 19, y / 42 - 7);
    const salt = Math.max(0, broad - 0.46);
    const damp = Math.max(0, 0.4 - patch);
    let m = 1 + salt * 0.26 - damp * 0.2 + (noise2(x / 16 + 4, y / 16) - 0.5) * 0.05;
    // Beach: a pale dry band above the waterline, dark wet sand at it.
    const dry = THREE.MathUtils.smoothstep(past, -110, -40) * (1 - THREE.MathUtils.smoothstep(past, -12, 0));
    const wet = THREE.MathUtils.smoothstep(past, -14, 0);
    m = m * (1 + 0.34 * dry) * (1 - 0.32 * wet);
    col[k * 3] = m * (1 + salt * 0.04 + 0.03 * dry);
    col[k * 3 + 1] = m;
    col[k * 3 + 2] = m * (1 - salt * 0.05 - 0.04 * dry);
    uv[k * 2] = x;
    uv[k * 2 + 1] = y;
    return k++;
  };
  const center = push(0, 0);
  let prev = null;
  for (let j = 1; j <= rings; j++) {
    const rad = radius * (j / rings) ** 1.4;
    const row = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      row.push(push(Math.cos(a) * rad, Math.sin(a) * rad));
    }
    if (j === 1) {
      for (let i = 0; i < segs; i++) idx.push(center, row[i], row[i + 1]);
    } else {
      for (let i = 0; i < segs; i++) idx.push(prev[i], row[i], row[i + 1], prev[i], row[i + 1], prev[i + 1]);
    }
    prev = row;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Radius of the apron disc at ground level, before the ascent stretches it. */
const GROUND_R = 2500;

export function createEnvironment(renderer, scene, M, quality = {}) {
  const sunDir = new THREE.Vector3();

  // --- Sky (physical atmosphere shader) ---
  const sky = new Sky();
  // Big enough that the camera stays inside it at any altitude the launch reaches; the
  // shader only uses direction, so the box is re-centred on the camera every frame.
  sky.scale.setScalar(400000);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.8;
  su.rayleigh.value = 1.15;
  su.mieCoefficient.value = 0.0016;
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
  sky.renderOrder = -2;          // drawn first; the cloud layer goes over it
  scene.add(sky);
  const clouds = createClouds(scene);

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
  // Shadow resolution is a tier decision: one map covers the whole apron, so its cost scales
  // with nothing the viewer controls and a phone cannot afford 4096².
  const SHADOW_MAP = quality.shadowMap ?? 4096;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.032;
  sun.shadow.radius = 1.25;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd4ee, 0x6b6660, 0.45);
  scene.add(hemi);

  // --- Ground: coastal plain terrain ---
  // CircleGeometry emits UVs normalised over the whole disc: (x/r + 1)/2. Every material in
  // this project is keyed to metres and sets repeat = 1/tileSize, so a 48 m terrain tile was
  // being stretched across the full 5 km - one texel per twenty metres, which is why the apron
  // read as featureless grey in every wide shot. Rewriting the UVs in metres puts the texture
  // back on its intended scale; the disc is rotated flat afterwards, so x/y of the flat
  // geometry are the ground plane.
  // Denser than the old 28 × 72: the beach is tens of metres wide, and 100 m cells a kilometre
  // out would smear it into a blur or miss it.
  const groundGeo = coastalDisc(GROUND_R, 64, 180);
  const ground = new THREE.Mesh(groundGeo, M.terrain || M.concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // The sea: a water surface over the seaward part of the disc, just below the beach. Laid in
  // the ground's own frame so it stretches with it on the ascent. The land under it falls to
  // nine metres down within 180 m of the waterline, which keeps the two surfaces far enough
  // apart for the depth buffer a couple of kilometres out.
  {
    const shape = new THREE.Shape();
    const xs = [];
    for (let x = -GROUND_R; x <= GROUND_R; x += 25) xs.push(x);
    // Seaward boundary: the arc of the disc; landward: 30 m inside the waterline.
    const pts = xs.map((x) => [x, -(shoreZ(x) - 30)]).filter(([x, y]) => Math.hypot(x, y) < GROUND_R);
    shape.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) shape.lineTo(x, y);
    const a1 = Math.atan2(pts[pts.length - 1][1], pts[pts.length - 1][0]), a0 = Math.atan2(pts[0][1], pts[0][0]);
    shape.absarc(0, 0, GROUND_R, a1, a0 < a1 ? a0 + Math.PI * 2 : a0, false);
    const waterGeo = new THREE.ShapeGeometry(shape, 64);
    // Metric UVs for the wave normals.
    const wp = waterGeo.attributes.position, wuv = new Float32Array(wp.count * 2);
    for (let i = 0; i < wp.count; i++) { wuv[i * 2] = wp.getX(i); wuv[i * 2 + 1] = wp.getY(i); }
    waterGeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
    waterGeo.translate(0, 0, -0.9);
    const water = new THREE.Mesh(waterGeo, M.water ?? new THREE.MeshStandardMaterial({ color: 0x2f5160, roughness: 0.15 }));
    water.name = 'sea';
    water.receiveShadow = false;
    ground.add(water);
  }
  // The terrain material is the ground's alone, so its repeat can be driven from here.
  const groundMaps = [ground.material.map, ground.material.roughnessMap, ground.material.normalMap].filter(Boolean);
  const baseRepeat = groundMaps[0] ? groundMaps[0].repeat.clone() : new THREE.Vector2(1, 1);

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
  function addDisplayLight(x, z, radius, height, { tiers = 1 } = {}) {
    const H = THREE.MathUtils.clamp(height * 0.55 + 3.2, 4.2, 26);
    // To the side of the exhibit, a little behind it. Every overview camera stands in the
    // +x/+z quadrant, about 40° off the row, and so did the mast, at 45°: the comment promised
    // it would never come between a view and its exhibit, and at Dragon it stood square in
    // front of the capsule's flank. Moved round to +x it sits well clear of the line of sight
    // and still throws its light on the faces those cameras see, where a mast mirrored behind
    // the exhibit would only have backlit it.
    const px = x + radius * 1.2, pz = z - radius * 0.25;

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

    // One spot per tier. A single beam aimed a third of the way up works for a car on a
    // plinth and fails completely on a 124 m stack: the vehicle went black above the mount
    // and the centrepiece of the whole centre became a silhouette after dark. Tall subjects
    // get several beams from the same mast, each aimed at its own band, which is also how a
    // real launch complex is lit.
    for (let i = 0; i < tiers; i++) {
      const aimT = tiers === 1 ? 0.35 : 0.14 + (i / (tiers - 1)) * 0.78;
      // Higher beams are narrower and stronger: they have further to throw, and a wide cone
      // aimed at the top of a tower mostly lights the sky.
      const cone = THREE.MathUtils.lerp(0.62, 0.20, tiers === 1 ? 0 : i / (tiers - 1));
      const spot = new THREE.SpotLight(0xffe9c8, 0, radius * 9, cone, 0.5, 1.05);
      spot.position.set(px + Math.sin(g.rotation.y) * 0.6, H + 0.02 + i * 0.5, pz + Math.cos(g.rotation.y) * 0.6);
      spot.target.position.set(x, height * aimT, z);
      night.add(spot, spot.target);
      displayLights.push({ spot, peak: (55 + radius * radius * 3.4) * (1 + aimT * 1.9) / tiers });
    }
  }

  const fog = new THREE.FogExp2(0xc5cdd6, 0.00027);
  scene.fog = fog;
  const GROUND_FOG = 0.00027;
  let nightK = 0;

  /** Keeps the sky centred on the viewer. Cheap, and the only way it survives an ascent. */
  function followCamera(camera) {
    sky.position.copy(camera.position); stars.position.copy(camera.position); clouds.follow(camera);
  }

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
  const SKY_GROUND = { turbidity: 2.8, rayleigh: 1.15, mie: 0.0016 };
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
    // Orange only very near the horizon. At the 18° inspection elevation the key
    // stays neutral enough that steel, paint and aluminium separate by roughness.
    const warmth = Math.pow(1 - t, 3.4);
    sun.color.setHSL(0.09, 0.04 + 0.28 * warmth, THREE.MathUtils.lerp(0.74, 0.98, Math.pow(t, 0.55)));
    const daylight = THREE.MathUtils.lerp(1.2, 2.5, Math.pow(t, 0.55));
    sun.intensity = daylight * ((1 - n) + 0.012 * n);
    hemi.color.setHSL(0.58, 0.22 - 0.08 * warmth, 0.58 + 0.06 * t).lerp(_nightHemi, n);
    hemi.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.22, 0.36, t), 0.04, n) * (1 - j * 0.9);
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
    clouds.update(sunDir, n, h, !inSpace);
    night.visible = !inSpace && n > 0.02;
    lightMasts.visible = !inSpace;
    for (const d of displayLights) d.spot.intensity = d.peak * Math.pow(n, 1.3);
    lensMat.emissiveIntensity = 2.6 * Math.pow(n, 1.4);

    // Stretch the apron so there is still a surface under the vehicle on the way up. Scaling
    // the mesh scales its metric UVs with it, which would smear one 48 m tile over 1.6 km at
    // full stretch; counter-scaling the repeat keeps the texel density fixed in world space,
    // so the ground coarsens in the frame rather than dissolving.
    const gs = THREE.MathUtils.clamp(1 + h / 900, 1, 34);
    if (ground.scale.x !== gs) {
      ground.scale.setScalar(gs);
      for (const t of groundMaps) t.repeat.set(baseRepeat.x * gs, baseRepeat.y * gs);
    }

    scene.environmentIntensity = THREE.MathUtils.lerp(1.05, 1.45, n) * (1 - j * 0.55);

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

  /**
   * Moving the Sun changes two things at very different prices. The sky uniforms, the light
   * directions, the fog and the exposure are a handful of writes. The reflection probe is a
   * full PMREM pass over a private scene — and the slider fires on every input event, so
   * dragging it from noon to midnight asked for a hundred of them, one per pixel of travel.
   *
   * The cheap half runs on every input, so the sky and the shadows track the control exactly.
   * The probe is rebuilt at most `PROBE_MS` apart while the control is moving, and once more
   * when it stops, so what is left on screen is always the probe for the sun that is actually
   * set. Reflections lag a fraction of a second behind the sky during a drag, which is not
   * visible; a full pass per event is.
   */
  const PROBE_MS = 130;
  let probeAt = 0, probeTimer = 0;
  function setSun(elevationDeg, azimuthDeg, { immediate = false } = {}) {
    air.elev = elevationDeg;
    air.azim = azimuthDeg;
    const now = performance.now();
    const due = immediate || (now - probeAt) >= PROBE_MS;
    applyAtmosphere({ rebuildProbe: due });
    if (due) { probeAt = now; clearTimeout(probeTimer); probeTimer = 0; return; }
    // Always settle on the real thing: the last event of a drag is usually inside the window,
    // and without this the session would keep a probe for a sun position nobody chose.
    clearTimeout(probeTimer);
    probeTimer = setTimeout(() => {
      probeTimer = 0; probeAt = performance.now();
      applyAtmosphere({ rebuildProbe: true });
    }, PROBE_MS);
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
  setSun(42, 34, { immediate: true });

  return {
    sun, sky, hemi, ground, setSun, setAltitude, setSpace, followCamera, updateShadow, addStation,
    addDisplayLight, get night() { return nightK; },
    get inSpace() { return inSpace; }, get sunDir() { return sunDir; },
  };
}
