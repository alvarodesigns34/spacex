#!/usr/bin/env node
// The start-up and level-of-detail helpers that need no browser: the early download (core/prefetch.js)
// and the marking of a Blender asset's small parts (vehicles/lodParts.js).
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const THREE = await import('three');
const { prefetch, takeBytes } = await import('../src/core/prefetch.js');
const { markSmallParts } = await import('../src/vehicles/lodParts.js');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- prefetch: one request per file, the bytes handed over once, a failure reaches whoever takes it ----
{
  const calls = [];
  const realFetch = globalThis.fetch;
  const bytes = (n) => new Uint8Array(n).fill(7).buffer;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('missing')) return { ok: false, status: 404 };
    await new Promise(r => setTimeout(r, 5));
    return { ok: true, status: 200, arrayBuffer: async () => bytes(String(url).includes('big') ? 1000 : 10) };
  };
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    const a = prefetch('https://x/assets/a.glb');
    const b = prefetch('https://x/assets/a.glb');
    report(a === b && calls.length === 1, 'prefetch: pedir dos veces el mismo archivo hace una sola petición', `${calls.length} petición`);
    const got = await takeBytes('https://x/assets/a.glb');
    report(got.byteLength === 10 && calls.length === 1, 'takeBytes: entrega los bytes de la descarga ya empezada, sin pedirlos de nuevo');
    await takeBytes('https://x/assets/a.glb');
    report(calls.length === 2, 'takeBytes suelta la entrada: el búfer no se retiene tras usarlo', 'una segunda toma vuelve a pedir el archivo');
    const early = takeBytes(new URL('https://x/assets/big.glb'));
    const sameUrl = new URL('https://x/assets/big.glb');
    report((await early).byteLength === 1000 && String(sameUrl) === 'https://x/assets/big.glb', 'acepta objetos URL, como las rutas de los modelos');

    prefetch('https://x/assets/missing.glb');
    await new Promise(r => setTimeout(r, 30));
    report(unhandled.length === 0, 'una descarga anticipada que falla no deja un rechazo sin atender', `${unhandled.length} rechazos sin atender`);
    let message = '';
    try { await takeBytes('https://x/assets/missing.glb'); } catch (e) { message = e.message; }
    report(message === '404', 'el fallo le llega a quien toma los bytes (para que use el modelo de respaldo)', `error «${message}»`);
  } finally {
    process.off('unhandledRejection', onUnhandled);
    globalThis.fetch = realFetch;
  }
}

// ---- markSmallParts: a part is marked by the diagonal of its box, in the car's metres ----
{
  const mat = new THREE.MeshBasicMaterial();
  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const root = new THREE.Group();
  const add = (name, g, parent = root) => { const m = new THREE.Mesh(g, mat); m.name = name; parent.add(m); return m; };
  const bolt = add('bolt', box(0.02, 0.02, 0.02));
  const rod = add('rod', box(0.4, 0.01, 0.01));
  const body = add('body', box(4, 1, 1.8));
  const panel = add('panel', box(0.3, 0.3, 0.3));
  const scaled = new THREE.Group(); scaled.scale.setScalar(10); root.add(scaled);
  const bigBySize = add('scaled-bolt', box(0.1, 0.1, 0.1), scaled);
  const pre = add('premarked', box(0.05, 0.05, 0.05)); pre.userData.lodFeature = 0.123;
  const inst = new THREE.InstancedMesh(box(0.05, 0.05, 0.05), mat, 3); inst.name = 'instanced'; root.add(inst);
  const small = add('small-after', box(0.1, 0.1, 0.1));
  const n = markSmallParts(root);
  const f = (m) => m.userData.lodFeature;
  report(Math.abs(f(bolt) - Math.hypot(0.02, 0.02, 0.02)) < 1e-9, 'una pieza pequeña se marca con la diagonal de su caja', `${f(bolt)?.toFixed(4)} m`);
  report(f(rod) > 0.399 && f(rod) < 0.401, 'una varilla larga y fina se mide por su largo, no por su grosor (la política más prudente)', `${f(rod)?.toFixed(3)} m`);
  report(f(body) === undefined, 'una pieza grande no se registra: se dibuja a cualquier distancia');
  report(f(panel) === undefined, 'el límite es el de la diagonal: una caja de 0,3 m de lado (diagonal 0,52 m) queda fuera de 0,45 m');
  report(f(bigBySize) === undefined, 'la escala del padre cuenta: una caja de 0,1 m con escala 10 mide 1,7 m de diagonal y no se marca');
  report(f(pre) === 0.123, 'lo que ya traía su `lodFeature` no se pisa');
  report(f(inst) === undefined, 'las mallas instanciadas se dejan como están');
  report(n === 3 && f(small) !== undefined, 'devuelve cuántas marcó', `${n}`);
  const again = markSmallParts(root);
  report(again === 0, 'marcar dos veces no marca nada más');
}

console.log(failed ? `\n${failed} comprobaciones fallan` : '\nArranque y detalle: todo correcto');
process.exit(failed ? 1 : 0);
