/**
 * Material library. Textures are generated procedurally (see textures.js); this module maps
 * them to physically based materials shared by every vehicle.
 */
import * as THREE from 'three';
import * as TX from './textures.js';

export function createMaterials() {
  const T = {
    steel: TX.makeSteel(),
    steelSkirt: TX.makeSteel({ heat: 0.9, soot: 0.55 }),
    steelWarm: TX.makeSteel({ heat: 0.35, soot: 0.15 }),
    f9Body: TX.makeFalconBody({ name: 'FALCON 9', w: 1024, h: 2048 }),
    fhBody: TX.makeFalconBody({ name: 'FALCON HEAVY', w: 1024, h: 2048 }),
    fhSide: TX.makeFalconBody({ name: 'FALCON HEAVY', w: 1024, h: 1024 }),
    white: TX.makeWhitePaint({ tile: 2.0 }),
    whitePanel: TX.makeWhitePaint({ tile: 0.6, grid: 3, tone: 0.9 }),
    whiteFresh: TX.makeWhitePaint({ tile: 1.5, tone: 0.96 }),
    carbon: TX.makeCarbon(),
    solar: TX.makeSolar(),
    solarStarlink: TX.makeSolar({ tile: 0.8, cell: 0.1, tint: [0.09, 0.11, 0.22] }),
    concrete: TX.makeConcrete(),
    foil: TX.makeFoil(),
    pica: TX.makePica(),
    bell: TX.makeEngineBell({ copper: 0.6 }),
    bellCool: TX.makeEngineBell({ copper: 0.15 }),
    grey: TX.makeGreyMetal(),
    greyDark: TX.makeGreyMetal({ tone: 0.28 }),
  };

  const M = {};

  M.steel = new THREE.MeshPhysicalMaterial({
    map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), metalness: 1.0, roughness: 1.0, color: 0xffffff,
    anisotropy: 0.55, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.0,
  });
  M.steelSkirt = new THREE.MeshPhysicalMaterial({
    map: T.steelSkirt.map, roughnessMap: T.steelSkirt.roughnessMap, normalMap: T.steelSkirt.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), metalness: 1.0, roughness: 1.0, anisotropy: 0.35, anisotropyRotation: Math.PI / 2,
  });
  M.steelWarm = new THREE.MeshPhysicalMaterial({
    map: T.steelWarm.map, roughnessMap: T.steelWarm.roughnessMap, normalMap: T.steelWarm.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), metalness: 1.0, roughness: 1.0, anisotropy: 0.45, anisotropyRotation: Math.PI / 2,
  });
  M.steelInner = new THREE.MeshStandardMaterial({ color: 0x8c8c90, metalness: 0.9, roughness: 0.55 });

  // TPS tiles: instanced hex prisms use instanceColor for per-tile variation.
  M.tile = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0.0, envMapIntensity: 0.3 });
  M.tileUnder = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.95 }); // ablative backing layer

  M.f9Stage1 = new THREE.MeshPhysicalMaterial({
    map: T.f9Body.map, roughnessMap: T.f9Body.roughnessMap, normalMap: T.white.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3), metalness: 0.0, roughness: 1.0, clearcoat: 0.15, clearcoatRoughness: 0.5,
  });
  M.fhCore = new THREE.MeshPhysicalMaterial({
    map: T.fhBody.map, roughnessMap: T.fhBody.roughnessMap, metalness: 0.0, roughness: 1.0, clearcoat: 0.15, clearcoatRoughness: 0.5,
  });
  M.fhSide = new THREE.MeshPhysicalMaterial({
    map: T.fhSide.map, roughnessMap: T.fhSide.roughnessMap, metalness: 0.0, roughness: 1.0, clearcoat: 0.15, clearcoatRoughness: 0.5,
  });
  M.white = new THREE.MeshPhysicalMaterial({
    map: T.white.map, roughnessMap: T.white.roughnessMap, normalMap: T.white.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35), metalness: 0.0, roughness: 1.0, clearcoat: 0.2, clearcoatRoughness: 0.45,
  });
  M.whiteFresh = new THREE.MeshPhysicalMaterial({
    map: T.whiteFresh.map, roughnessMap: T.whiteFresh.roughnessMap, normalMap: T.whiteFresh.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1.0, clearcoat: 0.25, clearcoatRoughness: 0.4,
  });
  M.whitePanel = new THREE.MeshPhysicalMaterial({
    map: T.whitePanel.map, roughnessMap: T.whitePanel.roughnessMap, normalMap: T.whitePanel.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1.0,
  });
  M.carbon = new THREE.MeshPhysicalMaterial({
    map: T.carbon.map, roughnessMap: T.carbon.roughnessMap, normalMap: T.carbon.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0.15, roughness: 1.0, clearcoat: 0.6, clearcoatRoughness: 0.25,
  });
  M.solar = new THREE.MeshPhysicalMaterial({
    map: T.solar.map, roughnessMap: T.solar.roughnessMap, normalMap: T.solar.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4), metalness: 0.25, roughness: 1.0, clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  M.solarStarlink = new THREE.MeshPhysicalMaterial({
    map: T.solarStarlink.map, roughnessMap: T.solarStarlink.roughnessMap, normalMap: T.solarStarlink.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4), metalness: 0.35, roughness: 1.0, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide,
  });
  M.concrete = new THREE.MeshStandardMaterial({
    map: T.concrete.map, roughnessMap: T.concrete.roughnessMap, normalMap: T.concrete.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0.0, roughness: 1.0,
  });
  M.foil = new THREE.MeshPhysicalMaterial({
    map: T.foil.map, normalMap: T.foil.normalMap, normalScale: new THREE.Vector2(1.0, 1.0), metalness: 0.9, roughness: 0.32,
  });
  M.pica = new THREE.MeshStandardMaterial({
    map: T.pica.map, roughnessMap: T.pica.roughnessMap, normalMap: T.pica.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1.0, metalness: 0.0,
  });
  M.bell = new THREE.MeshStandardMaterial({ map: T.bell.map, roughnessMap: T.bell.roughnessMap, metalness: 0.85, roughness: 1.0 });
  M.bellCool = new THREE.MeshStandardMaterial({ map: T.bellCool.map, roughnessMap: T.bellCool.roughnessMap, metalness: 0.8, roughness: 1.0 });
  M.bellInner = new THREE.MeshStandardMaterial({ color: 0x2a2624, metalness: 0.7, roughness: 0.6 });
  M.darkMetal = new THREE.MeshStandardMaterial({ map: T.greyDark.map, roughnessMap: T.greyDark.roughnessMap, metalness: 0.85, roughness: 1.0 });
  M.greyMetal = new THREE.MeshStandardMaterial({ map: T.grey.map, roughnessMap: T.grey.roughnessMap, metalness: 0.8, roughness: 1.0 });
  M.titanium = new THREE.MeshPhysicalMaterial({ color: 0x8f8a83, metalness: 1.0, roughness: 0.48, anisotropy: 0.3 });
  M.blackMatte = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.78, metalness: 0.1 });
  M.blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.25, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1420, roughness: 0.06, metalness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.4 });
  M.aluminum = new THREE.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 1.0, roughness: 0.42 });
  M.alumDark = new THREE.MeshPhysicalMaterial({ color: 0x5c6066, metalness: 0.9, roughness: 0.5 });
  M.radiator = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, metalness: 0.1, roughness: 0.35, clearcoat: 0.4 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x202022, roughness: 0.95 });
  M.mount = new THREE.MeshStandardMaterial({ color: 0x3b3e42, metalness: 0.6, roughness: 0.62 });
  M.mountYellow = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.3, roughness: 0.6 });
  M.human = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8 });
  M.humanDark = new THREE.MeshStandardMaterial({ color: 0x2e3a4a, roughness: 0.85 });
  M.copper = new THREE.MeshPhysicalMaterial({ color: 0xb87333, metalness: 1.0, roughness: 0.35 });
  M.goldKapton = new THREE.MeshPhysicalMaterial({ color: 0xc89a3c, metalness: 0.85, roughness: 0.4, map: T.foil.map, normalMap: T.foil.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  M.lens = new THREE.MeshPhysicalMaterial({ color: 0x10131a, roughness: 0.05, metalness: 0.2, clearcoat: 1.0 });

  // Reasonable shadow/normal-map defaults for everything.
  for (const m of Object.values(M)) { m.shadowSide = THREE.FrontSide; }
  return { T, M };
}
