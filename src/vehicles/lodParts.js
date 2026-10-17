/**
 * Marks the small parts of a Blender asset for the level-of-detail manager (core/lod.js).
 *
 * The three Blender cars arrive as one mesh per part (122, 194 and 108 of them), every one drawn
 * from any distance: in the overview, 400 m away, a mirror stalk, a bolt head or a lamp bezel
 * costs a draw call in the scene pass, another in the occlusion pass and another in the shadow
 * pass, for a part a fraction of a pixel across. The code-built exhibits already tell the manager
 * how big their smallest detail is (`userData.lodFeature`) and it stops drawing a group once
 * that is under about a pixel; the assets said nothing, so they never shed anything.
 *
 * The size given is the diagonal of the mesh's bounding box, in the car's own metres. That is
 * the whole part, not its thinnest dimension (the rule the code-built groups follow): a part is
 * dropped only when ALL of it fits inside about one pixel, which is as conservative as the
 * manager allows. Parts bigger than `maxSize` are never registered; they stay drawn at any
 * distance, as before.
 *
 * Nothing in the cars' code toggles a part's visibility, so there is nobody for the manager to
 * fight over a flag. A close view is untouched: the manager only acts below its pixel threshold.
 */
import * as THREE from 'three';

const _size = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/** Sets `userData.lodFeature` on every mesh of `root` whose whole box is under `maxSize` metres. Returns how many. */
export function markSmallParts(root, maxSize = 0.45) {
  root.updateWorldMatrix(true, true);
  let marked = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData.lodFeature || o.isInstancedMesh || o.isSkinnedMesh) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    g.boundingBox.getSize(_size);
    o.matrixWorld.decompose(_pos, _quat, _scale);
    _size.multiply(_scale);
    const diagonal = _size.length();
    if (diagonal > 0 && diagonal < maxSize) { o.userData.lodFeature = diagonal; marked++; }
  });
  return marked;
}
