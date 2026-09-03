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
    ['steelSkirt', () => TX.makeSteel({ heat: 0.85, soot: 0.5 })],
    ['steelWarm', () => TX.makeSteel({ heat: 0.3, soot: 0.12 })],
    ['f9Body', () => TX.makeFalconBody({ name: 'FALCON 9' })],
    ['fhBody', () => TX.makeFalconBody({ name: 'FALCON HEAVY' })],
    ['white', () => TX.makeWhitePaint({ tile: 2.0 })],
    ['whitePanel', () => TX.makeWhitePaint({ size: 512, tile: 0.8, grid: 3, tone: 0.9 })],
    ['carbon', () => TX.makeCarbon()],
    ['solar', () => TX.makeSolar()],
    ['concrete', () => TX.makeConcrete()],
    ['terrain', () => TX.makeGroundTerrain()],
    ['trenchArmor', () => TX.makeTrenchArmor()],
    ['foil', () => TX.makeFoil()],
    ['tps', () => TX.makeTpsPattern()],
    ['pica', () => TX.makePica()],
    ['bell', () => TX.makeEngineBell({ copper: 0.6 })],
    ['bellCool', () => TX.makeEngineBell({ copper: 0.12 })],
    ['greyDark', () => TX.makeGreyMetal({ tone: 0.28 })],
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
    anisotropy: 0.4, anisotropyRotation: 0, envMapIntensity: 1.0,
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
  M.tpsShell = new THREE.MeshStandardMaterial({
    map: T.tps.map, roughnessMap: T.tps.roughnessMap, normalMap: T.tps.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1.0, metalness: 0.0, envMapIntensity: 0.62,
    // It sits a couple of centimetres off the hull it covers; at a few hundred metres that is
    // inside the depth buffer's precision, so bias it forward as well.
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });

  // ---- Falcon airframe ---------------------------------------------------------------
  const paintBase = { metalness: 0.0, roughness: 1.0, clearcoat: 0.22, clearcoatRoughness: 0.42 };
  M.f9Stage1 = new THREE.MeshPhysicalMaterial({ ...paintBase, map: T.f9Body.map, roughnessMap: T.f9Body.roughnessMap, normalMap: T.white.normalMap, normalScale: new THREE.Vector2(0.22, 0.22) });
  M.fhCore = new THREE.MeshPhysicalMaterial({ ...paintBase, map: T.fhBody.map, roughnessMap: T.fhBody.roughnessMap, normalMap: T.white.normalMap, normalScale: new THREE.Vector2(0.22, 0.22) });
  // Side boosters carry the same markings as the centre core: reuse the map rather than
  // generating a second 1024×2048 pair for it.
  M.fhSide = M.fhCore;
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
  M.solar = new THREE.MeshPhysicalMaterial(solarBase);
  M.solarStarlink = new THREE.MeshPhysicalMaterial({ ...solarBase, color: 0xc9d2e6, side: THREE.DoubleSide });
  M.concrete = new THREE.MeshStandardMaterial({
    map: T.concrete.map, roughnessMap: T.concrete.roughnessMap, normalMap: T.concrete.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0.0, roughness: 1.0, envMapIntensity: 0.75,
  });
  M.terrain = new THREE.MeshStandardMaterial({
    map: T.terrain.map, roughnessMap: T.terrain.roughnessMap, normalMap: T.terrain.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0.0, roughness: 0.96, envMapIntensity: 0.55,
  });
  M.trenchArmor = new THREE.MeshStandardMaterial({
    map: T.trenchArmor.map, roughnessMap: T.trenchArmor.roughnessMap, normalMap: T.trenchArmor.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0.82, roughness: 0.48, envMapIntensity: 0.72,
  });
  M.pipeBlue = new THREE.MeshPhysicalMaterial({
    color: 0x1f5c8f, metalness: 0.35, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.25,
    normalMap: T.concrete.normalMap, normalScale: new THREE.Vector2(0.12, 0.12),
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
  M.bell = new THREE.MeshStandardMaterial({ map: T.bell.map, roughnessMap: T.bell.roughnessMap, metalness: 0.85, roughness: 1.0 });
  M.bellCool = new THREE.MeshStandardMaterial({ map: T.bellCool.map, roughnessMap: T.bellCool.roughnessMap, metalness: 0.8, roughness: 1.0 });
  M.bellInner = new THREE.MeshStandardMaterial({ color: 0x241f1d, metalness: 0.7, roughness: 0.55 });
  M.conduit = new THREE.MeshPhysicalMaterial({ color: 0x8f9499, metalness: 0.3, roughness: 0.7, map: T.steelWarm.map, roughnessMap: T.steelWarm.roughnessMap, envMapIntensity: 0.3 });
  M.darkMetal = new THREE.MeshStandardMaterial({ map: T.greyDark.map, roughnessMap: T.greyDark.roughnessMap, metalness: 0.85, roughness: 1.0 });
  M.titanium = new THREE.MeshPhysicalMaterial({ color: 0xa08a63, metalness: 1.0, roughness: 0.46, anisotropy: 0.3 });
  M.blackMatte = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.78, metalness: 0.1 });
  M.blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.25, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1420, roughness: 0.05, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.6 });
  M.aluminum = new THREE.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 1.0, roughness: 0.4 });
  M.alumDark = new THREE.MeshPhysicalMaterial({ color: 0x5c6066, metalness: 0.9, roughness: 0.5 });
  M.radiator = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, metalness: 0.1, roughness: 0.32, clearcoat: 0.4 });
  M.mount = new THREE.MeshStandardMaterial({ color: 0x3b3e42, metalness: 0.6, roughness: 0.62 });
  M.mountYellow = new THREE.MeshStandardMaterial({ color: 0x9d8330, metalness: 0.35, roughness: 0.62 });
  M.human = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8 });
  M.humanDark = new THREE.MeshStandardMaterial({ color: 0x2e3a4a, roughness: 0.85 });
  M.copper = new THREE.MeshPhysicalMaterial({ color: 0xb87333, metalness: 1.0, roughness: 0.35 });
  // White MLI: the foil colour map is gold, so take only its crinkle normals.
  M.mliWhite = new THREE.MeshPhysicalMaterial({ color: 0xdedbd4, metalness: 0.3, roughness: 0.4, normalMap: T.foil.normalMap, normalScale: new THREE.Vector2(0.85, 0.85), clearcoat: 0.3 });
  M.goldKapton = new THREE.MeshPhysicalMaterial({ color: 0xc89a3c, metalness: 0.85, roughness: 0.4, map: T.foil.map, normalMap: T.foil.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  M.lens = new THREE.MeshPhysicalMaterial({ color: 0x10131a, roughness: 0.05, metalness: 0.2, clearcoat: 1.0 });

  for (const m of Object.values(M)) m.shadowSide = THREE.FrontSide;
  return { T, M };
}
