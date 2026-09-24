/**
 * Material library. Textures are generated procedurally (see textures.js); this module maps
 * them to physically based materials shared by every vehicle.
 *
 * Two rules keep GPU memory in check: maps are generated once and shared wherever the same
 * physical surface appears, and each map is sized for the distance it is actually seen from
 * rather than at a uniform resolution.
 */
import * as THREE from 'three';
import * as TX from './textures.js';

export function createMaterials(onProgress = () => {}) {
  const T = {};
  const steps = [
    ['steel', () => TX.makeSteel()],
    // The skirt of a flown booster is SOOTED, not bronzed. At heat 0.85 the tempering term
    // pushed the whole band to base × (0.90, 0.76, 0.60) — a uniform straw tan that read as
    // cardboard wrapped round the bottom of the vehicle in every trench and liftoff shot.
    // Tempering is patchy and local to the welds; soot is what actually covers the skirt.
    ['steelSkirt', () => TX.makeSteel({ heat: 0.3, soot: 0.78 })],
    ['steelWarm', () => TX.makeSteel({ heat: 0.3, soot: 0.12 })],
    ['f9Body', () => TX.makeFalconBody({ name: 'FALCON 9', flown: false })],
    ['fhBody', () => TX.makeFalconBody({ name: 'FALCON HEAVY', flown: false })],
    ['f1Body', () => TX.makeFalconBody({ height: 12.65, name: 'FALCON 1', flown: false })],
    ['f1Interstage', () => TX.makeFalcon1Interstage()],
    ['white', () => TX.makeWhitePaint({ tile: 2.0 })],
    ['whitePanel', () => TX.makeWhitePaint({ size: 512, tile: 0.8, grid: 3, tone: 0.9 })],
    ['carbon', () => TX.makeCarbon()],
    ['solar', () => TX.makeSolar()],
    ['concrete', () => TX.makeConcrete()],
    ['asphalt', () => TX.makeAsphalt()],
    ['roadPaint', () => TX.makeRoadPaint()],
    ['terrain', () => TX.makeGroundTerrain()],
    ['trenchArmor', () => TX.makeTrenchArmor()],
    ['foil', () => TX.makeFoil()],
    ['frost', () => TX.makeFrost()],
    ['tps', () => TX.makeTpsPattern()],
    ['pica', () => TX.makePica()],
    ['bell', () => TX.makeEngineBell({ copper: 0.6 })],
    ['bellCool', () => TX.makeEngineBell({ copper: 0.12 })],
    ['greyDark', () => TX.makeGreyMetal({ tone: 0.28 })],
    ['weatheredSteel', () => TX.makeWeatheredSteel()],
    ['water', () => TX.makeWater()],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [key, fn] = steps[i];
    T[key] = fn();
    onProgress(key, (i + 1) / steps.length);
  }

  const M = {};

  // ---- Stainless steel (Starship / Super Heavy) -------------------------------------
  // Mill-finish 30X stainless: near-mirror on the panels, rough along every ring weld.
  // Anisotropy runs with the rolling direction (circumferential, the U axis of the metric
  // UVs), which stretches the sun's highlight vertically the way it does on the vehicle.
  const steelBase = {
    metalness: 1.0, roughness: 1.0, color: 0xffffff,
    anisotropy: 0.62, anisotropyRotation: 0, envMapIntensity: 0.82,
    normalScale: new THREE.Vector2(0.85, 0.85),
  };
  M.steel = new THREE.MeshPhysicalMaterial({ ...steelBase, map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap });
  M.steelSkirt = new THREE.MeshPhysicalMaterial({ ...steelBase, anisotropy: 0.2, envMapIntensity: 0.7, map: T.steelSkirt.map, roughnessMap: T.steelSkirt.roughnessMap, normalMap: T.steelSkirt.normalMap });
  M.steelWarm = new THREE.MeshPhysicalMaterial({ ...steelBase, anisotropy: 0.3, envMapIntensity: 0.78, map: T.steelWarm.map, roughnessMap: T.steelWarm.roughnessMap, normalMap: T.steelWarm.normalMap });
  // Payload-bay door seam: the same steel, darkened, so the outline reads without a decal.
  M.steelDoor = new THREE.MeshPhysicalMaterial({ ...steelBase, color: 0xeceded, map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap });
  // Flap skins: the same steel, but rougher so the rounded leading edge catches a soft
  // highlight instead of drawing a mirror-bright outline against the sky.
  // Both faces of a Starship flap read dark grey in photographs — the lee face carries a
  // dark blanket, not the mill finish of the tank sections.
  M.steelFlap = new THREE.MeshStandardMaterial({
    color: 0x53565c, metalness: 0.25, roughness: 0.72,
    normalMap: T.steel.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.45,
  });
  M.steelInner = new THREE.MeshStandardMaterial({ color: 0x7d8085, metalness: 0.9, roughness: 0.55 });

  // ---- Thermal protection ------------------------------------------------------------
  // Silica tiles are matte black and barely reflective; instanceColor supplies the
  // tile-to-tile variation, so the material itself stays white.
  // Silica tiles photograph as a mottled charcoal mosaic, not as a black void: they need
  // enough ambient response to show the form of the hull underneath.
  M.tile = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.62 });
  M.tileUnder = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.98, envMapIntensity: 0.15 });
  // Distant stand-in for the instanced tiles: the same mosaic baked into a map, so the shield
  // reads as one clean panel instead of dissolving into sub-pixel sparkle.
  // Roughness and ambient response are matched to M.tile above, not chosen independently: the
  // shell and the tile field are two renderings of the same surface, and a visitor walking in
  // crosses from one to the other. At 1.0 roughness and 0.62 ambient the shell read as a
  // markedly darker, flatter band than the mosaic that replaces it, and the switch was a
  // visible change of material rather than a change of detail.
  M.tpsShell = new THREE.MeshStandardMaterial({
    map: T.tps.map, roughnessMap: T.tps.roughnessMap, normalMap: T.tps.normalMap,
    // The baked map is darker than the mosaic it stands in for, because it averages the tile
    // faces together with the grooves between them while the real field is mostly tile face.
    // The lift is measured, not guessed: tools/lod-pop.mjs renders both states from the switch
    // distance and reports the signed luminance difference, which was +18/255 before this.
    color: new THREE.Color(2.0, 2.0, 2.07),
    normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.84, metalness: 0.0, envMapIntensity: 0.9,
    // It sits a couple of centimetres off the hull it covers; at a few hundred metres that is
    // inside the depth buffer's precision, so bias it forward as well.
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });

  // ---- Falcon airframe ---------------------------------------------------------------
  const paintBase = { metalness: 0.0, roughness: 1.0, clearcoat: 0.22, clearcoatRoughness: 0.42 };
  // Whole-body maps use normalized UVs. A metric paint normal map would span the
  // entire 33.5 m tank, so omit its unresolved micro-normal on these two materials.
  M.f9Stage1 = new THREE.MeshPhysicalMaterial({ ...paintBase, map: T.f9Body.map, roughnessMap: T.f9Body.roughnessMap });
  M.fhCore = new THREE.MeshPhysicalMaterial({ ...paintBase, map: T.fhBody.map, roughnessMap: T.fhBody.roughnessMap });
  // Side boosters carry the same markings as the centre core: reuse the map rather than
  // generating a second 1024×2048 pair for it.
  M.fhSide = M.fhCore;
  M.falcon1Stage1 = new THREE.MeshPhysicalMaterial({ ...paintBase, map: T.f1Body.map, roughnessMap: T.f1Body.roughnessMap, clearcoat: 0.16, clearcoatRoughness: 0.5 });
  M.falcon1Interstage = new THREE.MeshPhysicalMaterial({ map: T.f1Interstage.map, roughnessMap: T.f1Interstage.roughnessMap, color: 0xffffff, metalness: 0.08, roughness: 1.0, clearcoat: 0.08, clearcoatRoughness: 0.72 });
  M.white = new THREE.MeshPhysicalMaterial({ ...paintBase, map: T.white.map, roughnessMap: T.white.roughnessMap, normalMap: T.white.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.whiteFresh = new THREE.MeshPhysicalMaterial({ ...paintBase, color: 0xf6f6f4, clearcoat: 0.3, clearcoatRoughness: 0.34, map: T.white.map, roughnessMap: T.white.roughnessMap, normalMap: T.white.normalMap, normalScale: new THREE.Vector2(0.2, 0.2) });
  M.whitePanel = new THREE.MeshPhysicalMaterial({ ...paintBase, clearcoat: 0.18, map: T.whitePanel.map, roughnessMap: T.whitePanel.roughnessMap, normalMap: T.whitePanel.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) });
  M.carbon = new THREE.MeshPhysicalMaterial({
    map: T.carbon.map, roughnessMap: T.carbon.roughnessMap, normalMap: T.carbon.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45), metalness: 0.12, roughness: 1.0, clearcoat: 0.65, clearcoatRoughness: 0.22,
  });

  // ---- Power, thermal and structure ---------------------------------------------------
  const solarBase = {
    map: T.solar.map, roughnessMap: T.solar.roughnessMap, normalMap: T.solar.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35), metalness: 0.25, roughness: 1.0,
    clearcoat: 0.85, clearcoatRoughness: 0.08, envMapIntensity: 1.2,
  };
  // Dragon's trunk cells photograph near-black with a faint blue cast and thin silver lines.
  // The bare cell map (a navy base, pale 7 mm borders) read as a saturated royal-blue grid.
  M.solar = new THREE.MeshPhysicalMaterial({ ...solarBase, color: 0x6b7282, clearcoat: 0.6, clearcoatRoughness: 0.14, envMapIntensity: 0.7 });
  // Starlink's arrays photograph near-black with a faint blue cast and a silver grid. With the
  // cell map lifted ×0.8 and a mirror clearcoat the wings read, from the raised viewpoints the
  // exhibit is seen from, as a pale sky-blue sheet reflecting the sky — a toy's colours.
  M.solarStarlink = new THREE.MeshPhysicalMaterial({
    ...solarBase, color: 0x434a58, metalness: 0.04, clearcoat: 0.22, clearcoatRoughness: 0.2, envMapIntensity: 0.3,
    side: THREE.DoubleSide,
  });
  M.concrete = new THREE.MeshStandardMaterial({
    color: 0xd6d2ca,
    map: T.concrete.map, roughnessMap: T.concrete.roughnessMap, normalMap: T.concrete.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0.0, roughness: 1.0, envMapIntensity: 0.55,
  });
  M.terrain = new THREE.MeshStandardMaterial({
    map: T.terrain.map, roughnessMap: T.terrain.roughnessMap, normalMap: T.terrain.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0.0, roughness: 0.96, envMapIntensity: 0.55,
    vertexColors: true,
  });
  // Landscape-scale variation, in world space and without a period.
  //
  // One tiled map cannot describe five kilometres of coastal plain: whatever it carries at a
  // scale the eye can see repeats every 96 m, and a repeat that regular reads as a pattern
  // before it reads as ground. So the map carries grain only, and this does the rest:
  //
  //  · three octaves of value noise on world X/Z (190 m, 63 m, 21 m) split the plain into
  //    pale, warm salt crust and darker, browner damp hollows, the way a tidal flat
  //    actually varies;
  //  · the same map is sampled a second time, rotated 37° and scaled by the golden ratio, and
  //    blended in by a further noise field, so no two 96 m tiles look alike. Rotation and an
  //    irrational scale make the two lookups incommensurate: they never line up again.
  //
  // Cheap: five noise evaluations and one extra texture fetch per ground fragment.
  M.terrain.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVcWorld;\nattribute vec2 aShore;\nvarying vec2 vShore;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvVcWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvShore = aShore;');
    const NOISE = `
varying vec3 vVcWorld;
varying vec2 vShore;
float vcHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vcNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vcHash(i), vcHash(i + vec2(1.0, 0.0)), u.x),
             mix(vcHash(i + vec2(0.0, 1.0)), vcHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  vec2 vcUv2 = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.618 + vec2(0.31, 0.17);
  vec4 vcAlt = texture2D( map, vcUv2 );
  float vcMix = smoothstep(0.3, 0.7, vcNoise(vVcWorld.xz / 57.0 + vec2(3.7, -1.9)));
  sampledDiffuseColor = mix( sampledDiffuseColor, vcAlt, vcMix );
  diffuseColor *= sampledDiffuseColor;
#endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec2 wp = vVcWorld.xz;
    float macro = vcNoise(wp / 190.0) * 0.55 + vcNoise(wp / 63.0 + 17.3) * 0.30 + vcNoise(wp / 21.0 - 5.1) * 0.15;
    float salt = smoothstep(0.55, 0.80, macro);
    float damp = smoothstep(0.42, 0.18, macro);
    diffuseColor.rgb *= mix(1.0, 1.16, salt) * mix(1.0, 0.78, damp);
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.97, 0.97, 0.90), damp * 0.7);
    // Sparse low scrub: clumps of a few metres, thicker in the damp hollows, none on the salt
    // crust. Without it the plain read as one sheet of felt at any distance.
    float veg = vcNoise(wp / 9.0 + 41.0) * 0.6 + vcNoise(wp / 3.1 - 13.0) * 0.4;
    float beach = max(vShore.x, vShore.y);
    float scrub = smoothstep(0.60, 0.76, veg + damp * 0.10) * (1.0 - salt) * (1.0 - beach);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.70, 0.46), scrub * 0.75);
    // The beach (ground mesh only; other meshes on this material have no aShore and read 0):
    // pale quartz sand with a faint ripple of tone, darkening to wet sand at the water. A beach
    // tinted from the plain's olive map stayed grass-coloured all the way into the sea.
    float grain = 0.93 + 0.14 * vcNoise(wp / 5.0 + 71.0);
    // Linear values (this is after the sRGB map decode): dry sand ≈ sRGB (0.80, 0.70, 0.54),
    // wet sand ≈ sRGB (0.52, 0.46, 0.37). Warm on purpose: the low sky light cools it.
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.70, 0.48, 0.21) * grain, vShore.x * 0.92);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.19, 0.10) * grain, vShore.y * 0.85);
  }`);
  };
  M.terrain.customProgramCacheKey = () => 'vc-terrain-macro-4';
  // The Gulf beyond the beach. Water is a dielectric with a smooth surface: almost all of what
  // it shows is the sky it reflects, so the colour here is only the body tint of shallow,
  // silty coastal water, and the wave normals do the rest.
  M.water = new THREE.MeshStandardMaterial({
    color: 0x2c4a55, roughness: 0.12, metalness: 0.0, envMapIntensity: 1.2,
    normalMap: T.water.normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
  });
  M.trenchArmor = new THREE.MeshStandardMaterial({
    map: T.trenchArmor.map, roughnessMap: T.trenchArmor.roughnessMap, normalMap: T.trenchArmor.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0.82, roughness: 0.48, envMapIntensity: 0.72,
  });
  // Opaque industrial paint is dielectric. Concrete pores are not pipe coating texture.
  // The deluge tanks, water mains, risers and valves were a saturated royal blue that nothing
  // cites: no source gives the coating colour of the Pad 2 water system, and seven 17 m
  // blue tanks side by side were the loudest object in every site view — a toy block beside
  // the mount. A weathered light grey is the conventional coating on carbon-steel tankage
  // and makes no claim of its own.
  M.pipePaint = new THREE.MeshPhysicalMaterial({
    color: 0xaeb1b0, metalness: 0, roughness: 0.52, clearcoat: 0.12, clearcoatRoughness: 0.5,
  });
  M.pipeCryo = new THREE.MeshPhysicalMaterial({
    color: 0xe3e7ec, metalness: 0.75, roughness: 0.28, clearcoat: 0.2,
  });
  M.safetyYellow = new THREE.MeshStandardMaterial({
    color: 0xd49b25, metalness: 0.25, roughness: 0.55,
  });
  M.steelGrating = new THREE.MeshStandardMaterial({
    color: 0x484e56, metalness: 0.75, roughness: 0.42,
  });
  M.pica = new THREE.MeshStandardMaterial({
    map: T.pica.map, roughnessMap: T.pica.roughnessMap, normalMap: T.pica.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1.0, metalness: 0.0, envMapIntensity: 0.5,
  });
  M.bell = new THREE.MeshStandardMaterial({
    map: T.bell.map, roughnessMap: T.bell.roughnessMap, normalMap: T.bell.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45), metalness: 0.85, roughness: 1.0, envMapIntensity: 1.15,
  });
  M.bellCool = new THREE.MeshStandardMaterial({
    map: T.bellCool.map, roughnessMap: T.bellCool.roughnessMap, normalMap: T.bellCool.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28), metalness: 0.82, roughness: 1.0, envMapIntensity: 1.2,
  });
  M.bellInner = new THREE.MeshStandardMaterial({ color: 0x3a342e, metalness: 0.72, roughness: 0.48, envMapIntensity: 0.85 });
  // Inside a nozzle that has fired on a kerosene engine: a matte coat of soot, not bare metal.
  // With the clean-metal interior a flown Falcon's nine bells, seen from underneath, mirrored
  // the sky and read blue-grey; photographs of a recovered booster show them near-black.
  // Seen from under the stage, the inside of a Merlin bell is dark metal with a bronze cast
  // that picks up the light round the lip; at near-black and matt it read as nine black discs.
  M.bellInnerSoot = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, metalness: 0.55, roughness: 0.55, envMapIntensity: 0.6 });
  // Polymer cable jacket: it cannot inherit the ring welds of a Starship tank.
  M.conduit = new THREE.MeshStandardMaterial({ color: 0x555a61, metalness: 0, roughness: 0.76, envMapIntensity: 0.5 });
  M.darkMetal = new THREE.MeshStandardMaterial({ map: T.greyDark.map, roughnessMap: T.greyDark.roughnessMap, metalness: 0.85, roughness: 1.0 });
  // Flown titanium grid fins photograph dark: charcoal grey with a heat tint, the machined
  // faces dulled by re-entry. A bright, fairly smooth metal reflected the sky and read as a
  // white plastic lattice against the black interstage.
  M.titanium = new THREE.MeshPhysicalMaterial({ color: 0x5f5d59, metalness: 0.9, roughness: 0.6, anisotropy: 0.3 });
  M.blackMatte = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.78, metalness: 0.1 });
  M.blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.25, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  // Opaque dark-backed window approximation (no invented cabin). The front interface is
  // dielectric glass, IOR 1.5; dark backing is not a partially metallic pane.
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x152330, roughness: 0.09, metalness: 0, ior: 1.5, clearcoat: 0.3, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
  M.aluminum = new THREE.MeshPhysicalMaterial({ color: 0xd4d8de, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.2 });
  M.alumDark = new THREE.MeshPhysicalMaterial({ color: 0x5c6066, metalness: 0.9, roughness: 0.5 });
  M.radiator = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, metalness: 0.1, roughness: 0.32, clearcoat: 0.4 });
  M.mount = new THREE.MeshStandardMaterial({ color: 0x3b3e42, metalness: 0.6, roughness: 0.62 });
  // Pad 2's tower, arms and mount steel: a dark coating weathered by a coastal site — rust
  // weeping from joints, chipped spots, salt bloom — rather than a flat grey. Metric UVs only.
  M.towerSteel = new THREE.MeshStandardMaterial({
    name: 'tower-steel', map: T.weatheredSteel.map, roughnessMap: T.weatheredSteel.roughnessMap,
    normalMap: T.weatheredSteel.normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0xffffff, metalness: 0.2, roughness: 1.0, envMapIntensity: 0.5,
  });
  // Exhibit plinths: a satin graphite drum under a matte deck. The drum was the same
  // 60 %-metallic grey as the mount steel, and at that metalness it took its colour from the
  // sky: every plinth read navy blue.
  M.plinth = new THREE.MeshStandardMaterial({ color: 0x2c2e31, metalness: 0.15, roughness: 0.48 });
  M.plinthDeck = new THREE.MeshStandardMaterial({ color: 0x4a4c4f, metalness: 0.0, roughness: 0.86 });
  M.mountYellow = new THREE.MeshStandardMaterial({ color: 0x9d8330, metalness: 0.35, roughness: 0.62 });
  M.human = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.82 });
  M.humanDark = new THREE.MeshStandardMaterial({ color: 0x3d4a40, roughness: 0.86 });
  M.skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.68 });
  M.visitor = M.human;
  M.coverall = M.humanDark;
  M.boot = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.62, metalness: 0.04 });
  M.hardhat = new THREE.MeshStandardMaterial({ color: 0xd7a24a, roughness: 0.48, metalness: 0.04 });
  // The apron the exhibits stand on: poured concrete in 6 m slabs with sealed joints, the same
  // maps as the pad. It was an untextured vertex-coloured plane, a flat blue-grey card under
  // every vehicle. Vertex colour now TINTS the concrete: near-white for the slab, dark for the
  // asphalt road, darker still for the swale, and the dashes stay paint-bright.
  M.campusGround = new THREE.MeshStandardMaterial({
    vertexColors: true, map: T.concrete.map, roughnessMap: T.concrete.roughnessMap,
    normalMap: T.concrete.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 1.0, metalness: 0, envMapIntensity: 0.5,
  });
  // Visitor road: aged asphalt with crack sealing and patches (makeAsphalt), darkened in the
  // wheel paths through vertex colour. Paint is its own worn thermoplastic map, tinted per line.
  M.asphalt = new THREE.MeshStandardMaterial({
    // Warm tint: aged binder is brown-grey, and a neutral grey went navy under the skylight.
    color: 0xfff1e2, vertexColors: true, map: T.asphalt.map, roughnessMap: T.asphalt.roughnessMap, normalMap: T.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1.0, metalness: 0, envMapIntensity: 0.5,
  });
  M.gravel = new THREE.MeshStandardMaterial({ color: 0x8d8474, roughness: 0.96, metalness: 0 });
  M.swale = new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.98, metalness: 0 });
  M.roadPaint = new THREE.MeshStandardMaterial({
    vertexColors: true, map: T.roadPaint.map, roughness: 0.66, metalness: 0, envMapIntensity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  M.berm = new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.96, metalness: 0 });
  // Coastal brush in late summer: olive going to straw, not lawn green.
  M.scrub = new THREE.MeshStandardMaterial({ color: 0x626240, roughness: 0.96, metalness: 0, flatShading: false });
  // Beach grass on the foredune: sea oats and bitter panicum, straw going to pale green.
  M.duneGrass = new THREE.MeshStandardMaterial({ color: 0x9c9868, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  M.service = new THREE.MeshStandardMaterial({ color: 0x3c4650, roughness: 0.7, metalness: 0.06 });
  M.copper = new THREE.MeshPhysicalMaterial({ color: 0xb87333, metalness: 1.0, roughness: 0.35 });
  // White MLI: the foil colour map is gold, so take only its crinkle normals.
  // The crinkle is real but soft. At 0.85 of a normal map already built at strength 3, with a
  // clearcoat on top, the sky's reflection broke into bright flecks across the whole bus top
  // and the blanket read as a dusting of snow.
  M.mliWhite = new THREE.MeshPhysicalMaterial({ color: 0xdedbd4, metalness: 0.2, roughness: 0.55, normalMap: T.foil.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), clearcoat: 0.12, clearcoatRoughness: 0.4 });
  // Frost on loaded cryogenic tanks. Shared by the booster and ship shells; the launch
  // sequence drives its opacity. Transparent and depth-read-only, so it lies on the steel.
  M.frost = new THREE.MeshStandardMaterial({
    map: T.frost.map, alphaMap: T.frost.alphaMap, transparent: true, opacity: 0, depthWrite: false,
    roughness: 0.92, metalness: 0, envMapIntensity: 0.6,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  M.goldKapton = new THREE.MeshPhysicalMaterial({ color: 0xc89a3c, metalness: 0.85, roughness: 0.4, map: T.foil.map, normalMap: T.foil.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  M.lens = new THREE.MeshPhysicalMaterial({ color: 0x10131a, roughness: 0.05, metalness: 0, ior: 1.5, clearcoat: 0.3 });

  for (const m of Object.values(M)) m.shadowSide = THREE.FrontSide;
  return { T, M };
}
