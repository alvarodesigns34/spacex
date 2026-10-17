/**
 * The Porsche 911 GT3 RS's markings from their Blender-built asset (assets/gt3rs/markings.glb, made
 * by blender/gt3rs/markings.py): the crest on the front lid, the PORSCHE lettering across the rear
 * light band and the red GT3 RS decal on each flank, hung in gt3-sprung so they ride the springs
 * with the body; and the crest on each centre-lock cap, put on the wheel's spinning part so it
 * turns with the wheel. The body markings
 * were placed in Blender on the code-built body's own surface, in the car's frame; the cap crest is
 * built facing +Z and set on the face of each cap here.
 * If the asset cannot be had, the car stands without its markings, as it did before.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { takeBytes } from '../core/prefetch.js';
import { buildGt3rs } from './gt3rs.js';

export const GT3RS_MARKINGS = new URL('../../assets/gt3rs/markings.glb', import.meta.url);
const _box = new THREE.Box3();

/** Hangs the markings (the asset's scene) on the built car. */
export function applyMarkings(car, scene) {
  const sprung = car.getObjectByName('gt3-sprung');
  const take = (name) => {
    const o = scene.getObjectByName(name);
    if (!o) return null;
    o.removeFromParent();
    o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
    return o;
  };
  const body = ['gt3-mark-crest-front', 'gt3-mark-porsche-rear', 'gt3-mark-rs-left', 'gt3-mark-rs-right'];
  for (const name of body) {
    const o = take(name);
    if (o && sprung) sprung.add(o);
  }
  const capCrest = take('gt3-mark-crest-cap');
  let caps = 0;
  if (capCrest) {
    car.traverse(w => {
      const spin = w.userData?.spin;
      if (!spin) return;
      const cap = spin.children.find(c => c.name.endsWith('-nut-cap'));
      if (!cap) return;
      cap.geometry.computeBoundingBox();
      _box.copy(cap.geometry.boundingBox);
      // The cap's outer face: whichever end of it is further from the wheel's centre plane.
      const out = Math.abs(_box.max.z) >= Math.abs(_box.min.z);
      const c = capCrest.clone();
      c.name = `${w.name}-crest`;
      c.position.set(0, 0, (out ? _box.max.z : _box.min.z) + (out ? 0.0003 : -0.0003));
      if (!out) c.rotation.y = Math.PI;
      spin.add(c);
      caps++;
    });
  }
  car.userData.markings = { body: body.filter(n => sprung?.getObjectByName(n)).length, caps };
  return car;
}

/** The code-built car with its markings (if the asset loads). */
export async function loadGt3rs(M) {
  const car = buildGt3rs(M);
  try {
    const gltf = await new GLTFLoader().parseAsync(await takeBytes(GT3RS_MARKINGS), '');
    applyMarkings(car, gltf.scene);
  } catch (e) {
    console.warn(`GT3 RS markings not loaded (${e.message}): the car stands without them`);
  }
  return car;
}
