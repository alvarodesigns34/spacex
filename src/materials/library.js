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
import { WIND } from '../core/wind.js';

/**
 * Moving water. One wave-normal map (textures.js makeWater, a 420 m tile) sampled four times,
 * at four scales, each rotated and drifting its own way at its own speed: the long swell, the
 * wind waves on it, a chop, and ripples a few metres across that fade out with distance before
 * they can shimmer. Four scales of one map are what keep a surface from reading as a tiled
 * picture, and the drift is what makes it water rather than glass. Speeds are the phase speeds
 * of waves of about those lengths in deep water, √(gλ/2π), rounded: a few metres a second for
 * the swell, well under one for ripples.
 *
 * `calm` scales the two long layers: a pool a few centimetres deep on a flat carries ripples
 * and no swell. The clock is WAVE_TIME, advanced by the render loop.
 *
 * Where each layer travels: the swell comes in off the Gulf from the ESE (towards ≈290°, ≈), and
 * the wind waves, the chop and the ripples run before the site's wind (core/wind.js: the sea
 * breeze from the SSE), the shorter ones spread a little more about it. Before, the four layers
 * drifted four ways at once, up to 130° apart, whatever the wind.
 */
/**
 * Grass tussocks are thin double-sided blades. Lit with their own side normals, and with the
 * back faces' normals flipped the way three.js does for double-sided materials, half of every
 * clump faced away from the sky and the tufts on the dunes read from the tower as black
 * specks. A tussock is lit as a volume from above: every normal points up, and the material
 * (duneGrass) does not flip them for back faces.
 */
export function grassNormals(geo) {
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  n.needsUpdate = true;
  return geo;
}

export const WAVE_TIME = { value: 0 };
export function waveNormals(sh, { tileSize = 420, calm = 1 } = {}) {
  sh.uniforms.uWaveTime = WAVE_TIME;
  // [scale, rotation (rad), speed (m/s), weight, fade in from (m), fade out by (m), heading of travel (true °)]
  const wind = (WIND.fromDeg + 180) % 360;
  const L = [[1, 0.6, 4.5, 0.55 * calm, 0, 0, 290], [5.3, 1.25, 2.6, 0.45 * calm, 0, 0, wind], [23, 2.1, 1.4, 0.4, 700, 60, wind + 15], [97, 2.9, 0.7, 0.34, 140, 10, wind - 25]];
  const f = (x) => x.toFixed(5);
  const layers = L.map(([s, a, v, w, far, near, heading]) => {
    const c = Math.cos(a), sn = Math.sin(a), d = (v / tileSize) * s;
    // The travel in the map's coordinates (u = x, v = −z; +x bears 100.8°, bearings clockwise
    // towards +z). A sample offset moving by +o makes the pattern move by −R⁻¹o: so o = −R·m.
    const b = (heading - 100.8) * Math.PI / 180, mu = Math.cos(b), mv = -Math.sin(b);
    const ou = -(c * mu - sn * mv) * d, ov = -(sn * mu + c * mv) * d;
    const fade = far ? ` * (1.0 - smoothstep(${f(near)}, ${f(far)}, vcWaveDist))` : '';
    return `  vcWave += (texture2D(normalMap, mat2(${f(c)}, ${f(sn)}, ${f(-sn)}, ${f(c)}) * vNormalMapUv * ${f(s)} + uWaveTime * vec2(${f(ou)}, ${f(ov)})).xy * 2.0 - 1.0) * ${f(w)}${fade};`;
  }).join('\n');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uWaveTime;')
    // The include is expanded here, because onBeforeCompile sees the #include line, not its text.
    .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `
  float vcWaveDist = length(vViewPosition);
  vec2 vcWave = vec2(0.0);
${layers}
  vec3 mapN = vec3(vcWave, 1.0);`));
}

/**
 * The hull steel's map is one ring (1.83 m tall) with one vertical plate seam per tile, and
 * repeated as it is every ring came out identical: seams lined up into continuous vertical
 * lines from the engines to the nose, and a 70 m barrel read as one extruded tube with graph
 * paper on it. A Starship ring is rolled from separate sheets and stacked with its seams
 * staggered, and photographs show neighbouring rings and plates differing clearly in tone and
 * in how sharply they reflect. So each ring gets its own rotation of the pattern (the seams
 * stagger), and each plate — a ring and a seam-to-seam span — its own tone and sheen, from a
 * hash of its indices. The map UVs are metric, so ring and plate indices are real ones.
 */
function ringsAndPlates(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
float vcPlateHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('void main() {', `void main() {
  float vcRing = floor(vMapUv.y);
  vec2 vcSteelUv = vec2(vMapUv.x + vcPlateHash(vec2(vcRing, 3.1)), vMapUv.y);
  float vcPlate = floor(vcSteelUv.x + 0.5);
  float vcTone = 1.0 + (vcPlateHash(vec2(vcRing, vcPlate + 17.0)) - 0.5) * 0.035;
  float vcSheen = 1.0 + (vcPlateHash(vec2(vcPlate - 5.0, vcRing + 41.0)) - 0.5) * 0.18;`)
      .replace('#include <map_fragment>', `${THREE.ShaderChunk.map_fragment.replace(/vMapUv/g, 'vcSteelUv')}
  diffuseColor.rgb *= vcTone;`)
      .replace('#include <roughnessmap_fragment>', `${THREE.ShaderChunk.roughnessmap_fragment.replace(/vRoughnessMapUv/g, 'vcSteelUv')}
  roughnessFactor *= vcSheen;`)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g, 'vcSteelUv'));
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `vc-steel-plates-2${key ? key() : ''}`;
}

/**
 * Soot on a flown booster, driven by one shared uniform (0 clean, 1 as returned). A booster
 * coming back to the tower is not the mirror it left as: SpaceX's photograph of Flight 5's
 * landing burn beside the tower (spacex.com, "Starship's Fifth Flight Test") shows it dark
 * grey, black towards the engines, streaked down its length and stained brown in patches by
 * reentry heating. The pattern is procedural — heavier aft, vertical streaks, broad patches —
 * and approximate; the amount is set by the launch sequence from mission time.
 * Hooked after metalnessmap_fragment, which ringsAndPlates leaves intact and which runs after
 * the colour and roughness it modifies.
 */
function sootable(m, uSoot) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uSoot = uSoot;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSootP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSootP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSoot;
varying vec3 vSootP;
float sootHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sootNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sootHash(i), sootHash(i + vec2(1.0, 0.0)), u.x), mix(sootHash(i + vec2(0.0, 1.0)), sootHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  if (uSoot > 0.001) {
    float sAng = atan(vSootP.x, vSootP.z);
    float sY = vSootP.y;
    float aft = 1.0 - 0.6 * smoothstep(3.0, 50.0, sY);
    float streak = sootNoise(vec2(sAng * 11.0, sY * 0.045)) * 0.65 + sootNoise(vec2(sAng * 38.0, sY * 0.16)) * 0.35;
    float sPatch = sootNoise(vec2(sAng * 2.6 + 7.0, sY * 0.09));
    float sAmt = uSoot * clamp(0.5 + 0.4 * aft + (streak - 0.5) * 0.85 + (sPatch - 0.5) * 0.4, 0.0, 1.0);
    float scorch = uSoot * smoothstep(0.55, 0.8, sootNoise(vec2(sAng * 4.3 - 3.0, sY * 0.07 + 11.0))) * (1.0 - aft * 0.5);
    // Under the soot, the steel itself comes back heat-dulled and tan, not mirror-bright.
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.57, 0.52), uSoot);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.046, 0.043), sAmt * 0.9);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.19, 0.12), scorch * 0.5);
    metalnessFactor = mix(metalnessFactor, 0.25, sAmt);
    roughnessFactor = mix(roughnessFactor, 0.8, max(sAmt, 0.5 * uSoot));
  }`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `vc-soot-1${key ? key() : ''}`;
}

export async function createMaterials(onProgress = () => {}, pause = null) {
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
    // The circuit's and the skid pad's: the same mix, laid and kept smooth (no patches, no cracks).
    ['trackAsphalt', () => TX.makeAsphalt({ cracks: false, patches: 0, seed: 7716 })],
    ['roadPaint', () => TX.makeRoadPaint()],
    ['honeycomb', () => TX.makeHoneycomb()],
    ['terrain', () => TX.makeGroundTerrain()],
    ['trenchArmor', () => TX.makeTrenchArmor()],
    ['foil', () => TX.makeFoil()],
    ['frost', () => TX.makeFrost()],
    ['tps', () => TX.makeTpsPattern()],
    ['pica', () => TX.makePica()],
    // Clean, unflown engines, as the Falcons are shown: gunmetal with barely a heat tint.
    ['bell', () => TX.makeEngineBell({ copper: 0.12 })],
    ['bellCool', () => TX.makeEngineBell({ copper: 0.12 })],
    ['bellRvac', () => TX.makeRvacBell()],
    ['greyDark', () => TX.makeGreyMetal({ tone: 0.28 })],
    ['weatheredSteel', () => TX.makeWeatheredSteel()],
    ['towerClad', () => TX.makeTowerClad()],
    ['water', () => TX.makeWater()],
  ];
  // One texture, then a frame: the generators are the longest stretch of the start-up, and
  // run back to back they were one block in which the progress bar could not repaint.
  for (let i = 0; i < steps.length; i++) {
    const [key, fn] = steps[i];
    T[key] = fn();
    onProgress(key, (i + 1) / steps.length);
    if (pause) await pause();
  }

  const M = {};

  // ---- Stainless steel (Starship / Super Heavy) -------------------------------------
  // Mill-finish 30X stainless: near-mirror on the panels, rough along every ring weld.
  // Anisotropy runs with the rolling direction (circumferential, the U axis of the metric
  // UVs), which stretches the sun's highlight vertically the way it does on the vehicle.
  // The maps are neutral grey; the hue is the metal's own. Measured stainless reflectance
  // (physicallybased.info: linear F0 0.669 / 0.639 / 0.598) is faintly warm — the ratios
  // to its luminance are what the colour carries, so brightness stays with the maps.
  const stainless = new THREE.Color().setRGB(1.041, 0.995, 0.932, THREE.LinearSRGBColorSpace);
  const steelBase = {
    // 0.86: a touch sharper than the map alone, so each plate's own sheen (ringsAndPlates) shows.
    metalness: 1.0, roughness: 0.86, color: stainless,
    anisotropy: 0.62, anisotropyRotation: 0, envMapIntensity: 0.82,
    normalScale: new THREE.Vector2(0.85, 0.85),
  };
  M.steel = new THREE.MeshPhysicalMaterial({ ...steelBase, map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap });
  M.steelSkirt = new THREE.MeshPhysicalMaterial({ ...steelBase, anisotropy: 0.2, envMapIntensity: 0.7, map: T.steelSkirt.map, roughnessMap: T.steelSkirt.roughnessMap, normalMap: T.steelSkirt.normalMap });
  M.steelWarm = new THREE.MeshPhysicalMaterial({ ...steelBase, anisotropy: 0.3, envMapIntensity: 0.78, map: T.steelWarm.map, roughnessMap: T.steelWarm.roughnessMap, normalMap: T.steelWarm.normalMap });
  // Payload-bay door seam: the same steel, darkened, so the outline reads without a decal.
  M.steelDoor = new THREE.MeshPhysicalMaterial({ ...steelBase, color: new THREE.Color(0xeceded).multiply(stainless), map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap });
  for (const m of [M.steel, M.steelSkirt, M.steelWarm, M.steelDoor]) ringsAndPlates(m);
  // The booster's own copies of the three steels, with the soot hook: the ship and the exhibit
  // keep the clean ones. `M.boosterSoot` is the shared amount the launch sequence drives.
  M.boosterSoot = { value: 0 };
  M.boosterSteel = new THREE.MeshPhysicalMaterial({ ...steelBase, map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap });
  M.boosterSkirt = new THREE.MeshPhysicalMaterial({ ...steelBase, anisotropy: 0.2, envMapIntensity: 0.7, map: T.steelSkirt.map, roughnessMap: T.steelSkirt.roughnessMap, normalMap: T.steelSkirt.normalMap });
  M.boosterWarm = new THREE.MeshPhysicalMaterial({ ...steelBase, anisotropy: 0.3, envMapIntensity: 0.78, map: T.steelWarm.map, roughnessMap: T.steelWarm.roughnessMap, normalMap: T.steelWarm.normalMap });
  for (const m of [M.boosterSteel, M.boosterSkirt, M.boosterWarm]) { ringsAndPlates(m); sootable(m, M.boosterSoot); }
  // Flap skins: the same steel, but rougher so the rounded leading edge catches a soft
  // highlight instead of drawing a mirror-bright outline against the sky.
  // Both faces of a Starship flap read dark grey in photographs — the lee face carries a
  // dark blanket, not the mill finish of the tank sections.
  M.steelFlap = new THREE.MeshStandardMaterial({
    color: 0x53565c, metalness: 0.25, roughness: 0.72,
    normalMap: T.steel.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.45,
  });
  M.steelInner = new THREE.MeshStandardMaterial({ color: 0x7d8085, metalness: 0.9, roughness: 0.55 });
  // ---- Starship V3 finishes, read off SpaceX's and NASASpaceflight's 2026 photographs ------
  // Raptor 3 nozzle: a dark slate-grey matte coat, not bare metal (SpaceX's Raptor 3 portrait,
  // and every Booster 18/19 aft close-up, where the 33 bells read near-black with white
  // stencilled serials).
  // It rendered blue-grey and satin: at 0.3 metalness and 0.58 roughness the bells mirrored
  // the sky. NASASpaceflight's Booster 19 close-up (May 2026) has them near-black and matte,
  // with only a soft sheen along each bell.
  M.bellRaptor3 = new THREE.MeshStandardMaterial({ name: 'raptor3-bell', color: 0x28292c, metalness: 0.12, roughness: 0.8, envMapIntensity: 0.45 });
  // Block 3 grid fins photograph charcoal black, the arched cells of the lattice included.
  M.gridFin = new THREE.MeshStandardMaterial({ name: 'grid-fin', color: 0x2a2b2e, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.7 });
  // The aft section of a Block 3 booster: black-coated skirt and the ring of commodity pipes
  // and junction boxes round it.
  M.aftBlack = new THREE.MeshStandardMaterial({ name: 'booster-aft-black', color: 0x1c1d20, metalness: 0.2, roughness: 0.66, envMapIntensity: 0.6 });
  // Plating over the booster's forward dome, which takes the ship's exhaust at hot-staging:
  // it photographs a pale cream-grey inside the open truss.
  M.domePlate = new THREE.MeshStandardMaterial({ name: 'forward-dome-plate', color: 0xc9c0ad, metalness: 0.45, roughness: 0.5, envMapIntensity: 0.7 });
  // The metallic tiles over the tapered thrust plate between the engines: a speckled bronze.
  // Panel seams on a white spacecraft: in SpaceX's Crew Dragon pad photographs (Demo-2, LC-39A)
  // they are fine light-grey lines with rows of fasteners, not black strokes.
  M.seamGrey = new THREE.MeshStandardMaterial({ name: 'panel-seam', color: 0x8d9197, metalness: 0.1, roughness: 0.55, envMapIntensity: 0.6 });
  M.metalTile = new THREE.MeshStandardMaterial({ name: 'thrust-plate-tile', color: 0x5a4f42, metalness: 0.7, roughness: 0.55, envMapIntensity: 0.7 });

  // ---- Thermal protection ------------------------------------------------------------
  // Silica tiles are matte black and barely reflective; instanceColor supplies the
  // tile-to-tile variation, so the material itself stays white.
  // Silica tiles photograph as a mottled charcoal mosaic, not as a black void: they need
  // enough ambient response to show the form of the hull underneath.
  // vertexColors: the tile prism lights its chamfer pale (hexPrism's edgeShade).
  M.tile = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.5, vertexColors: true });
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
    // Scaled to the tile field, measured rather than guessed: tools/lod-pop.mjs renders both
    // states from the switch distance and gates on the signed luminance difference. The map
    // is darker than the field because it averages faces with joints. History worth keeping:
    // this was once dropped to 0.46 to match the near state while the near state was itself
    // wrong — the backing stood 2 mm over the tile faces and the "tiles" were a black skin. With
    // the faces clear of it the field is lighter again, and 1.75 matched it within 1/255 — seen
    // obliquely, as the old display yaw showed it. Face-on, as the belly now faces the exhibit
    // row, the tile chamfers catch more light and the field was 8/255 lighter than the shell:
    // 2.3 holds face-on, oblique and from above within ±2. With the 16 × 16 map and its paler
    // joints (September 2026) it still holds: the shell is 0.9 and 3.1/255 lighter at 45 m.
    color: new THREE.Color(2.3, 2.3, 2.38),
    normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.84, metalness: 0.0, envMapIntensity: 0.9,
    // It sits a couple of centimetres off the hull it covers; at a few hundred metres that is
    // inside the depth buffer's precision, so bias it forward as well.
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });

  // ---- Falcon airframe ---------------------------------------------------------------
  const paintBase = { metalness: 0.0, roughness: 1.0, clearcoat: 0.22, clearcoatRoughness: 0.42 };
  // Whole-body maps use normalized UVs. A metric paint normal map would span the
  // entire 33.5 m tank, so omit its unresolved micro-normal on these two materials.
  // White paint reflects about 80 %, not 100 %: with the map near white and the colour at
  // 1.0 the barrels clipped under the tone curve to one flat white with no roundness, which
  // is what made the Falcons read as plastic beside the steel and the tiles. The tint brings
  // the lit side under the knee so the cylinder shades from sun to shadow again.
  M.f9Stage1 = new THREE.MeshPhysicalMaterial({ ...paintBase, color: 0xe4e4e2, map: T.f9Body.map, roughnessMap: T.f9Body.roughnessMap });
  M.fhCore = new THREE.MeshPhysicalMaterial({ ...paintBase, color: 0xe4e4e2, map: T.fhBody.map, roughnessMap: T.fhBody.roughnessMap });
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
  // A car's black honeycomb grille (the GT3 RS's intakes and bonnet outlets).
  M.honeycomb = new THREE.MeshStandardMaterial({
    name: 'honeycomb-grille', map: T.honeycomb.map, normalMap: T.honeycomb.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
    color: 0xffffff, metalness: 0.15, roughness: 0.62,
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
    color: 0xe2dccf,
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
  // scale the eye can see repeats every 48 m (the tile, since round 4), and a repeat that regular reads as a pattern
  // before it reads as ground. So the map carries grain only, and this does the rest:
  //
  //  · three octaves of value noise on world X/Z (190 m, 63 m, 21 m) split the plain into
  //    pale, warm salt crust and darker, browner damp hollows, the way a tidal flat
  //    actually varies;
  //  · the same map is sampled a second time, rotated 37° and scaled by the golden ratio, and
  //    blended in by a further noise field, so no two 48 m tiles look alike. Rotation and an
  //    irrational scale make the two lookups incommensurate: they never line up again.
  //
  // Cheap: five noise evaluations and one extra texture fetch per ground fragment.
  M.terrain.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVcWorld;\nattribute vec2 aShore;\nvarying vec2 vShore;\nattribute float aLand;\nvarying float vLand;\nattribute float aMarsh;\nvarying float vMarsh;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvVcWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvShore = aShore;\nvLand = aLand;\nvMarsh = aMarsh;');
    const NOISE = `
varying vec3 vVcWorld;
varying vec2 vShore;
varying float vLand;
varying float vMarsh;
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
  // Close up, a third lookup 6,7 × finer and turned again, applied as contrast only (its own
  // value over its own blurred mean, read from a coarse mip): grain a few millimetres across
  // under a visitor's feet, fading out by 45 m where the base map already holds.
  float vcNear = 1.0 - smoothstep(8.0, 45.0, length(vViewPosition));
  if (vcNear > 0.0) {
    vec2 vcUv3 = mat2(0.28, 0.96, -0.96, 0.28) * vMapUv * 6.7 + vec2(0.57, 0.11);
    float vcFine = dot(texture2D( map, vcUv3 ).rgb, vec3(0.3, 0.59, 0.11));
    float vcMean = dot(texture2D( map, vcUv3, 6.0 ).rgb, vec3(0.3, 0.59, 0.11));
    sampledDiffuseColor.rgb *= mix(1.0, clamp(vcFine / max(vcMean, 0.02), 0.62, 1.45), vcNear * 0.55);
  }
  diffuseColor *= sampledDiffuseColor;
#endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float vcWater = 0.0;
  {
    vec2 wp = vVcWorld.xz;
    float beach = max(vShore.x, vShore.y);
    // Land cover, the way the ISS photographs of the Boca Chica plain show it: a blanket of
    // olive grass and scrub, broken by pale bare flats — salt crust and dry sand — in large
    // irregular districts, with darker damp ground where the flats are lowest. The old
    // version did the opposite (a pale tan plain with small green specks), which read as a
    // sandbox from the overview. Every field is domain-warped so the edges are ragged and
    // drawn out rather than the round blobs plain value noise makes.
    vec2 wq = wp / 23.0;
    vec2 warp = vec2(vcNoise(wq + 7.1), vcNoise(wq - 3.3)) - 0.5;
    vec2 bw = vec2(vcNoise(wp / 310.0 + 4.2), vcNoise(wp / 310.0 - 6.6)) - 0.5;
    float cover = vcNoise(wp / 260.0 + bw * 1.4 + 11.0) * 0.6
                + vcNoise(wp / 85.0 + bw * 2.0 - 3.0) * 0.3
                + vcNoise(wp / 27.0 + warp * 2.0) * 0.1;
    float veg = smoothstep(0.31, 0.45, cover) * (1.0 - beach);
    // Bare flats: the map's own sand-and-salt grain, paler on the crust, darker and greyer in
    // the damp lows.
    float low = smoothstep(0.30, 0.18, cover);
    // Grey-tan, not yellow: half-way to the map's own luminance, which is what sun-bleached
    // salt crust and dry sand look like beside grass.
    // Greyer than it was (0.22): SpaceX's Pad 2 photographs show the bare flats round the pad as
    // grey-brown silt and salt crust, not tan sand.
    vec3 bareBase = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.32);
    // A touch warmer than neutral: under a low sun half the light on flat ground is blue
    // skylight, and a neutral pale ground came out blue-grey.
    vec3 bare = bareBase * mix(vec3(0.97, 0.92, 0.85), vec3(0.64, 0.61, 0.56), low);
    // Vegetation, in linear colour: green grass and dry straw by district, dark shrub clumps a
    // few metres across. The map's luminance is kept as grain so the grass is not flat paint.
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) / 0.40;
    // More of it cured to straw, as the coastal prairie is for most of the year: seen at eye
    // level the plain was one grey-green lawn to the horizon.
    float straw = smoothstep(0.25, 0.64, vcNoise(wp / 140.0 - 9.0) + warp.x * 0.3);
    vec3 vegCol = mix(vec3(0.160, 0.168, 0.072), vec3(0.300, 0.250, 0.118), straw);
    float clump = vcNoise(wp / 6.0 + warp * 3.0 + 41.0) * 0.6 + vcNoise(wp / 2.3 - 13.0) * 0.4;
    // Darker shrub clumps: soft-edged and lighter than they were. At 0.62–0.80 and 0.55 they
    // were crisp dark blobs that read, from the tower, as camouflage paint on the plain.
    vegCol = mix(vegCol, vec3(0.095, 0.112, 0.052), smoothstep(0.58, 0.92, clump) * 0.38);
    vegCol *= mix(0.8, 1.2, clamp(lum, 0.0, 1.5) / 1.5);
    // Tussocks. At eye level a prairie is not one tone: every metre or two a clump of cured
    // straw stands among the green, with shadowed ground between the stems. Averaged away from
    // the tower; from a visitor's height it is what makes the ground read as grass.
    float tussock = smoothstep(0.45, 0.85, vcNoise(wp / 1.7 + warp * 2.0 + 5.0));
    vegCol = mix(vegCol, vec3(0.300, 0.250, 0.118) * (0.85 + 0.3 * lum), 0.45 * tussock);
    vegCol *= 0.82 + 0.34 * vcNoise(wp / 0.55 - 3.0);
    // Thornscrub cover on the lomas and the small rises of the plain (terrain.js thicket, per
    // vertex), as a ground tone: a dark olive mottle with bare clay between, not grass.
    float thick = smoothstep(0.08, 0.7, vLand);
    veg = max(veg, thick);
    vec3 scrubCol = mix(vec3(0.050, 0.064, 0.030), vec3(0.120, 0.112, 0.062), smoothstep(0.35, 0.75, clump));
    vegCol = mix(vegCol, scrubCol, thick * 0.85);
    // The fringe between the two is sparse: grass thinning out over bare ground.
    float fringe = smoothstep(0.0, 1.0, veg) * smoothstep(0.28, 0.78, clump + veg * 0.6);
    diffuseColor.rgb = mix(bare, vegCol, max(fringe, smoothstep(0.7, 1.0, veg)));
    // Tidal channels (terrain.js marsh): winding, water-filled cuts through the marsh grass
    // and the flats, the way SpaceX's Pad 2 photographs show the ground round the pad. Each
    // is an isoline of warped noise, so it wanders and never closes on a grid: main channels
    // a few metres to ten across, tapering out, with narrower creeks feeding them. Dark
    // silty water that mirrors the sky, inside a band of wet grey mud. Drawn, not surveyed.
    {
      // Stretched across the plain, the way the creeks drain: an isotropic field closes its
      // isolines into rings round every bump, and a marsh has no circular channels.
      vec2 cw = vec2(vcNoise(wp / 150.0 + 2.3), vcNoise(wp / 150.0 - 5.1)) - 0.5;
      float n1 = vcNoise(vec2(wp.x / 620.0, wp.y / 240.0) + cw * 1.5 + 17.0);
      float n2 = vcNoise(vec2(wp.x / 180.0, wp.y / 80.0) + cw * 2.2 - 8.0);
      float taper1 = smoothstep(0.3, 0.55, vcNoise(wp / 380.0 + 3.0));
      float taper2 = smoothstep(0.5, 0.72, vcNoise(wp / 190.0 - 21.0)) * smoothstep(0.3, 0.5, taper1 + vcNoise(wp / 90.0));
      // Antialiased against the pixel footprint (fwidth, so computed outside any branch): a
      // channel narrower than a pixel fades instead of breaking into a flickering thread, which
      // near the horizon drew rows of little rings.
      float e1 = abs(n1 - 0.5), e2 = abs(n2 - 0.5);
      float f1 = max(fwidth(n1), 1e-5), f2 = max(fwidth(n2), 1e-5);
      float w1 = 0.02 * taper1, w2 = 0.013 * taper2;
      float water = max((1.0 - smoothstep(w1 - f1, w1 + f1, e1)) * clamp(w1 / f1, 0.0, 1.0),
                        (1.0 - smoothstep(w2 - f2, w2 + f2, e2)) * clamp(w2 / f2, 0.0, 1.0)) * vMarsh;
      float mud = max((1.0 - smoothstep(2.6 * w1 - f1, 2.6 * w1 + f1, e1)) * clamp(2.6 * w1 / f1, 0.0, 1.0),
                      (1.0 - smoothstep(2.6 * w2 - f2, 2.6 * w2 + f2, e2)) * clamp(2.6 * w2 / f2, 0.0, 1.0)) * vMarsh;
      vec3 mudCol = vec3(0.105, 0.095, 0.078) * (0.9 + 0.2 * vcNoise(wp / 3.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, mud * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.115, 0.095), water);
      vcWater = water;
    }
    // The beach (ground mesh only; other meshes on this material have no aShore and read 0):
    // pale quartz sand with a faint ripple of tone, darkening to wet sand at the water. A beach
    // tinted from the plain's olive map stayed grass-coloured all the way into the sea.
    float grain = 0.93 + 0.14 * vcNoise(wp / 5.0 + 71.0);
    // Linear values (this is after the sRGB map decode): dry sand ≈ sRGB (0.80, 0.70, 0.54),
    // wet sand ≈ sRGB (0.52, 0.46, 0.37). Warm on purpose: the low sky light cools it.
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.70, 0.48, 0.21) * grain, vShore.x * 0.92);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.19, 0.10) * grain, vShore.y * 0.85);
  }`)
      // Wet sand holds a film of water and shines; dry sand does not.
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.28, vShore.y * 0.8);
  roughnessFactor = mix(roughnessFactor, 0.07, vcWater);`)
      // Grass, scrub and dry soil are not a surface but a tangle of blades and grains: light
      // that would glance off a smooth plane is trapped and scattered instead. As a microfacet
      // surface, the Fresnel term at grazing angles laid a sheet of reflected sky over the plain,
      // and from eye level every field read as one blue-grey lawn. Keep a third of it; keep all
      // of it on the wet sand, which does shine.
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    float vcSheen = mix(0.3, 1.0, max(vShore.y, vcWater));
    reflectedLight.indirectSpecular *= vcSheen;
    reflectedLight.directSpecular *= vcSheen;
  }`);
  };
  M.terrain.customProgramCacheKey = () => 'vc-terrain-macro-17';
  // The Gulf beyond the beach. Water is a dielectric with a smooth surface: almost all of what
  // it shows is the sky it reflects, so the colour here is only the body tint of shallow,
  // silty coastal water, and the wave normals do the rest.
  M.water = new THREE.MeshStandardMaterial({
    color: 0x2c4a55, roughness: 0.12, metalness: 0.0, envMapIntensity: 1.2,
    normalMap: T.water.normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
  });
  M.water.userData.tileSize = T.water.tileSize;
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
  // The runway's light lenses: one material, the colour per instance (white edge lights, green
  // and red at the ends, the PAPI's lenses). Glass, lit by day; there is no night to light them.
  M.runwayLens = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.18, name: 'runway-lens' });
  // The windsock's fabric: orange (FAA AC 150/5345-27 allows orange, yellow or white), seen
  // from inside through its open mouth.
  M.windsock = new THREE.MeshStandardMaterial({ color: 0xe0601e, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, name: 'windsock' });
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
  // ---- Engine Row exhibits, read off SpaceX's factory portraits (see engineExhibits.js) ----
  // Merlin 1D Block 5, unflown: satin light-grey metal bell and chamber.
  M.merlinNozzle = new THREE.MeshPhysicalMaterial({ name: 'merlin-nozzle', color: 0x9da1a5, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.0 });
  // Raptor 3's chamber, manifolds and ducts: the same matte charcoal as its bell, a touch of sheen.
  M.engineDark = new THREE.MeshStandardMaterial({ name: 'engine-dark', color: 0x3d3e41, metalness: 0.25, roughness: 0.56, envMapIntensity: 0.55 });
  // The cast turbopump block reads faintly violet-grey in the portraits.
  M.enginePurple = new THREE.MeshStandardMaterial({ name: 'engine-block', color: 0x3e3843, metalness: 0.45, roughness: 0.5, envMapIntensity: 0.6 });
  M.engineSilver = new THREE.MeshPhysicalMaterial({ name: 'engine-silver', color: 0xbfc3c8, metalness: 1.0, roughness: 0.4, envMapIntensity: 1.0 });
  M.engineGold = new THREE.MeshPhysicalMaterial({ name: 'engine-gold', color: 0xb8913f, metalness: 1.0, roughness: 0.35 });
  M.engineBlue = new THREE.MeshStandardMaterial({ name: 'engine-blue', color: 0x2f5fa8, metalness: 0.3, roughness: 0.45 });
  // Braided stainless lines and the orange instrumentation harnesses round a Merlin.
  M.braided = new THREE.MeshPhysicalMaterial({ name: 'braided-line', color: 0xaeb2b6, metalness: 0.9, roughness: 0.55 });
  M.harness = new THREE.MeshStandardMaterial({ name: 'harness', color: 0xd9661f, metalness: 0.0, roughness: 0.6 });
  // The anodised dark-blue mount plate the Merlin hangs from.
  M.mountBlue = new THREE.MeshStandardMaterial({ name: 'mount-blue', color: 0x223a66, metalness: 0.5, roughness: 0.45 });
  // Raptor Vacuum: olive regen bell, brass joint, silver tube-wall extension (makeRvacBell).
  M.bellRvac = new THREE.MeshStandardMaterial({
    name: 'rvac-bell', map: T.bellRvac.map, roughnessMap: T.bellRvac.roughnessMap, metalnessMap: T.bellRvac.metalnessMap,
    normalMap: T.bellRvac.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 1.0, roughness: 1.0, envMapIntensity: 1.1,
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
  // Dragon: the satin aluminium band round the capsule's foot and the red-brown closeout line
  // at the top of the trunk, both as NASA's pad photographs show them.
  M.dragonBand = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0, metalness: 1.0, roughness: 0.34, envMapIntensity: 1.1 });
  M.dragonCloseout = new THREE.MeshStandardMaterial({ color: 0x6a2a1e, roughness: 0.7, metalness: 0.1 });
  M.radiator = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, metalness: 0.1, roughness: 0.32, clearcoat: 0.4 });
  M.mount = new THREE.MeshStandardMaterial({ color: 0x3b3e42, metalness: 0.6, roughness: 0.62 });
  // Pad 2's tower, arms and mount steel: a dark coating weathered by a coastal site — rust
  // weeping from joints, chipped spots, salt bloom — rather than a flat grey. Metric UVs only.
  M.towerSteel = new THREE.MeshStandardMaterial({
    name: 'tower-steel', map: T.weatheredSteel.map, roughnessMap: T.weatheredSteel.roughnessMap,
    normalMap: T.weatheredSteel.normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0xffffff, metalness: 0.2, roughness: 1.0, envMapIntensity: 0.5,
  });
  // The tower itself is bare light-grey steel, clad at the corners in flat plate: in every
  // photograph of the finished Pad 2 it stands pale against the sky, where the arms, the
  // carriage and the QD arm are dark. Metric UVs only.
  M.towerClad = new THREE.MeshStandardMaterial({
    name: 'tower-clad', map: T.towerClad.map, roughnessMap: T.towerClad.roughnessMap,
    normalMap: T.towerClad.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0xffffff, metalness: 0.5, roughness: 1.0, envMapIntensity: 0.75,
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
    // Warm tint, as on the asphalt: a neutral slab went blue-grey under the skylight.
    color: 0xfff6ea, vertexColors: true, map: T.concrete.map, roughnessMap: T.concrete.roughnessMap,
    normalMap: T.concrete.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 1.0, metalness: 0, envMapIntensity: 0.32,
  });
  // Visitor road: aged asphalt with crack sealing and patches (makeAsphalt), darkened in the
  // wheel paths through vertex colour. Paint is its own worn thermoplastic map, tinted per line.
  M.asphalt = new THREE.MeshStandardMaterial({
    // Warm tint: aged binder is brown-grey, and a neutral grey went navy under the skylight.
    color: 0xfff1e2, vertexColors: true, map: T.asphalt.map, roughnessMap: T.asphalt.roughnessMap, normalMap: T.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1.0, metalness: 0, envMapIntensity: 0.5,
  });
  M.trackAsphalt = new THREE.MeshStandardMaterial({
    name: 'track-asphalt', color: 0xfff1e2, vertexColors: true, map: T.trackAsphalt.map, roughnessMap: T.trackAsphalt.roughnessMap, normalMap: T.trackAsphalt.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1.0, metalness: 0, envMapIntensity: 0.5,
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
  M.duneGrass.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  M.duneGrass.customProgramCacheKey = () => 'vc-grass-up-1';
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
