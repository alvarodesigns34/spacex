/**
 * A scene's signature for one purpose, compared value by value from one frame to the next.
 *
 * Two caches ask "has anything that this picture is made of changed?": the sun's shadow map
 * (core/shadowCache.js) and the ambient occlusion's depth and normal buffer (core/gbufferCache.js).
 * What each is made of differs — the first of the shadow casters, the second of the opaque meshes the
 * camera sees — but the question is the same one, so it is asked here.
 *
 * Every object `include` accepts is walked, in tree order, and the following is kept for each:
 * its geometry (id and version of its positions, so a deformed panel counts), its instance count
 * and instance matrix version, and its 16 world-matrix values. Hidden subtrees are skipped, so a
 * shown or hidden object changes the sequence and is seen. The comparison is exact, never a hash.
 *
 * The matrices are the ones the LAST render left. A mover that nothing else announces is seen one
 * frame after it moves, and then on every frame it keeps moving; callers that know a sequence is
 * running ask for every frame instead.
 *
 * `skip(object, matrixElements)` leaves an object out of the signature while it cannot change
 * the picture (the windsock far from the shadow, or a few pixels across).
 */

// geometry id, positions version, instance count, instance matrix version, then the 16 matrix values
const PER_OBJECT = 20;

export function createSceneSignature({ include, skip = null }) {
  let state = new Float64Array(64 * PER_OBJECT);
  let count = 0;

  return {
    /** True when anything differs from the signature of the last call (which is stored). */
    changed(root) {
      let i = 0, changed = false;
      const walk = (o) => {
        if (!o.visible) return;
        if (include(o)) {
          // A skinned or morphing mesh changes its depth without touching a matrix.
          if (o.isSkinnedMesh || o.morphTargetInfluences?.length) changed = true;
          const e = o.matrixWorld.elements;
          if (!(skip && skip(o, e))) {
            if ((i + 1) * PER_OBJECT > state.length) {
              const next = new Float64Array(state.length * 2);
              next.set(state); state = next; changed = true;
            }
            const s = i * PER_OBJECT, g = o.geometry, inst = o.isInstancedMesh;
            const id = g?.id ?? 0, pv = g?.attributes?.position?.version ?? 0;
            const ic = inst ? o.count : 0, iv = inst ? o.instanceMatrix.version : 0;
            if (state[s] !== id || state[s + 1] !== pv || state[s + 2] !== ic || state[s + 3] !== iv) {
              changed = true; state[s] = id; state[s + 1] = pv; state[s + 2] = ic; state[s + 3] = iv;
            }
            for (let k = 0; k < 16; k++) if (state[s + 4 + k] !== e[k]) { changed = true; state[s + 4 + k] = e[k]; }
            i++;
          }
        }
        const ch = o.children;
        for (let k = 0, n = ch.length; k < n; k++) walk(ch[k]);
      };
      walk(root);
      if (i !== count) { changed = true; count = i; }
      return changed;
    },
    /** Forget everything: the next call reports a change. */
    reset() { count = -1; },
  };
}
