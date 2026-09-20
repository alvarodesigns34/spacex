/**
 * One scene census, shared by every tool that reports what the centre costs.
 *
 * It exists because the same bug was written twice. `Object3D.traverse` does not stop at a
 * hidden group: it keeps descending, and each child of a hidden group still reports
 * `visible === true` on itself, because `visible` is a local flag and not an inherited state.
 * So a counter that asks `o.visible` per mesh counts everything inside every hidden group as
 * being drawn. In `check.mjs` that said 859 of 866 meshes were on screen when the real figure
 * was 705 — and `profile.mjs` and `shot.mjs` each carried their own copy of the same mistake,
 * which is how a fix in one place left the other two wrong for a week.
 *
 * The rule the walk implements is the one the renderer implements:
 *
 *     effectiveVisible(o) = effectiveVisible(o.parent) && o.visible
 *
 * The function below is injected into the page by Playwright, so it must be self-contained:
 * no imports, no closure over anything in this module. Everything it needs comes from
 * `window.__vc` and from its one argument.
 */

/**
 * Walks the live scene and returns what is built and what is actually drawn.
 *
 * Runs inside the browser. Pass it to `page.evaluate` directly — Playwright serialises the
 * source, so it sees none of this file's scope.
 *
 * @param {{perExhibit?: boolean, startup?: boolean}} [opts]
 */
export function sceneCensus(opts = {}) {
  const v = window.__vc;
  const mats = new Set(), drawnMats = new Set(), geos = new Set(), texes = new Map();

  let meshes = 0, drawn = 0;
  let tris = 0, drawnTris = 0;
  let verts = 0, drawnVerts = 0;
  let bufferBytes = 0, drawnBufferBytes = 0;
  let shadowCasters = 0, drawnShadowCasters = 0;
  let transparentDrawn = 0, doubleSided = 0;

  /** Triangles a mesh contributes, instance count included. */
  const triOf = (o) => {
    const g = o.geometry;
    if (!g?.attributes?.position) return 0;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    return n * (o.isInstancedMesh ? o.count : 1);
  };

  /**
   * Vertex-buffer bytes a geometry occupies on the GPU. `mergeAll()` de-indexes before merging,
   * which leaves the triangle count alone and multiplies this — so a triangle budget alone
   * cannot see the cost it moves. Counted once per geometry by the caller.
   */
  const bytesOf = (g) => {
    if (!g?.attributes) return 0;
    let b = 0;
    for (const a of Object.values(g.attributes)) b += (a.count ?? 0) * (a.itemSize ?? 0) * (a.array?.BYTES_PER_ELEMENT ?? 4);
    if (g.index) b += g.index.count * (g.index.array?.BYTES_PER_ELEMENT ?? 4);
    return b;
  };

  const noteMat = (m, on) => {
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      if (!mm) continue;
      mats.add(mm);
      if (on) {
        drawnMats.add(mm);
        if (mm.transparent) transparentDrawn++;
      }
      if (mm.side === 2) doubleSided++;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
        'emissiveMap', 'alphaMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap']) {
        const t = mm[k];
        if (!t?.image) continue;
        const w = t.image.width ?? 0, h = t.image.height ?? 0;
        // 4 bytes/texel plus a third for the mip chain. An estimate, but a stable one to diff.
        texes.set(t, Math.round(w * h * 4 * 1.33));
      }
    }
  };

  const seenGeo = new Set();
  const walk = (o, parentOn) => {
    const on = parentOn && o.visible;
    if (o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine) {
      meshes++;
      const g = o.geometry;
      const t = triOf(o);
      const nv = (g?.attributes?.position?.count ?? 0) * (o.isInstancedMesh ? o.count : 1);
      tris += t;
      verts += nv;
      if (o.castShadow) shadowCasters++;
      if (g && !seenGeo.has(g)) { seenGeo.add(g); geos.add(g); bufferBytes += bytesOf(g); }
      if (on) {
        drawn++;
        drawnTris += t;
        drawnVerts += nv;
        if (o.castShadow) drawnShadowCasters++;
        if (g) drawnBufferBytes += bytesOf(g);
      }
      noteMat(o.material, on);
    }
    for (const c of o.children) walk(c, on);
  };
  walk(v.scene, true);

  let texBytes = 0;
  for (const b of texes.values()) texBytes += b;

  const out = {
    meshes, drawnMeshes: drawn,
    tris: Math.round(tris), drawnTris: Math.round(drawnTris),
    vertices: verts, drawnVertices: drawnVerts,
    bufferMB: +(bufferBytes / 1048576).toFixed(1),
    drawnBufferMB: +(drawnBufferBytes / 1048576).toFixed(1),
    shadowCasters, drawnShadowCasters,
    transparentDrawn, doubleSidedMaterials: doubleSided,
    materials: mats.size, drawnMaterials: drawnMats.size,
    geometries: geos.size,
    textures: texes.size,
    textureMB: +(texBytes / 1048576).toFixed(1),
    rendererGeometries: v.renderer.info.memory.geometries,
    rendererTextures: v.renderer.info.memory.textures,
    quality: v.quality?.name ?? null,
    qualityForced: !!v.quality?.forced,
  };

  if (opts.perExhibit) {
    const per = {};
    for (const [id, ex] of Object.entries(v.exhibits)) {
      let et = 0, em = 0;
      ex.model.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { em++; et += triOf(o); } });
      per[id] = { tris: Math.round(et), meshes: em };
    }
    out.perExhibit = per;
    let padTris = 0, padMeshes = 0;
    v.complex?.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { padMeshes++; padTris += triOf(o); } });
    out.pad = { tris: Math.round(padTris), meshes: padMeshes };
  }
  if (opts.startup) out.startup = v.timings;
  return out;
}

/**
 * Boots a page against the local server the way every tool needs it: full quality, loaded,
 * and proven to be at the tier that was asked for rather than the one the device would pick.
 *
 * CI and the screenshot runs go through SwiftShader, which `quality.js` correctly identifies
 * as a software rasteriser and correctly demotes to the cheap tier. That is right for a
 * visitor on a weak machine and wrong for both of these jobs: the gate would be measuring a
 * reduced scene that is perfectly self-consistent, and the documentation screenshots would be
 * showing a lower pixel ratio, a quarter-resolution shadow map, no bloom, greedier detail
 * shedding and a third of the cloud — a worse render than the project actually produces.
 */
export async function bootAtQuality(page, url, tier = 'high') {
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}quality=${tier}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__vc, null, { timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 120000 });
  const got = await page.evaluate(() => ({ name: window.__vc.quality?.name, forced: !!window.__vc.quality?.forced }));
  if (got.name !== tier || !got.forced) {
    throw new Error(`quality tier: pedido ${tier} forzado, obtenido ${got.name} (forced=${got.forced})`);
  }
  return got;
}
