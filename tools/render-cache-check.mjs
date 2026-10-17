#!/usr/bin/env node
// When the sun's shadow map (core/shadowCache.js) and the ambient occlusion's depth and normal
// buffer (core/gbufferCache.js) are redrawn, without a browser: a synthetic scene stands in for the
// centre. Each cache must redraw for every change that can alter its picture — the light or the
// camera, an object's matrix, an object shown, hidden, added or removed, deformed positions,
// instances — and for nothing else, so a still scene costs neither pass. The windsock rules, the age
// limit and the every-frame request for sequences are checked too, and negative controls prove the
// checks can fail: a cache that never redraws and one that always does.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const THREE = await import('three');
const { createShadowCache } = await import('../src/core/shadowCache.js');
const { createGBufferCache } = await import('../src/core/gbufferCache.js');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

/** A scene with a sun, a few casters, a distant flagged caster, and a cache over a stand-in renderer. */
function rig() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50; sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50; sun.shadow.camera.far = 1200;
  sun.position.set(100, 200, 100);
  scene.add(sun, sun.target);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  const caster = (x) => { const m = new THREE.Mesh(box, mat); m.castShadow = true; m.position.set(x, 0.5, 0); scene.add(m); m.updateMatrixWorld(); return m; };
  const casters = [caster(0), caster(5), caster(10)];
  const receiver = new THREE.Mesh(box, mat); receiver.receiveShadow = true; scene.add(receiver);
  const sock = caster(0); sock.userData.shadowLocal = true; sock.position.set(30, 0, 0); sock.updateMatrixWorld();
  const renderer = { shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false } };
  const cache = createShadowCache(renderer, scene, sun);
  let t = 0;
  /**
   * One frame as main.js runs it: prepare() sees the world matrices the LAST render left, then the
   * render brings them up to date. So a change made before this call is seen by it only through
   * what the last render knew (a visibility flag, the light, a geometry), and through a matrix one
   * frame later. Returns true when it asked for a redraw.
   */
  const frame = (everyFrame = false, dt = 16) => {
    t += dt;
    renderer.shadowMap.needsUpdate = false;
    cache.prepare(t, everyFrame);
    const asked = renderer.shadowMap.needsUpdate;
    scene.updateMatrixWorld(true);
    return asked;
  };
  /** The next `n` frames: true when any of them asked for a redraw. */
  const within = (n = 2) => { let hit = false; for (let i = 0; i < n; i++) if (frame()) hit = true; return hit; };
  const settle = () => { for (let i = 0; i < 3; i++) frame(); };
  return { scene, sun, casters, receiver, sock, renderer, cache, frame, within, settle, box, mat, caster, at: () => t };
}

{
  const r = rig();
  report(r.renderer.shadowMap.autoUpdate === false, 'la caché apaga el refresco propio del renderizador', 'sin esto se dibujaría el mapa en cada llamada a render()');
  r.settle();
  const idle = Array.from({ length: 20 }, () => r.frame());
  report(idle.every(d => !d), 'escena quieta: ningún fotograma redibuja el mapa', `${idle.filter(Boolean).length} de 20`);
}
{
  const r = rig(); r.settle();
  r.casters[1].position.x += 0.25;
  const first = r.within(); r.settle();
  report(first, 'un emisor que se mueve redibuja el mapa', 'como mucho un fotograma después de moverse: la matriz que ve es la del render anterior');
}
{
  const r = rig(); r.settle();
  r.casters[0].rotation.y += 0.01; const a = r.within();
  r.settle();
  r.casters[2].scale.setScalar(1.001); const b = r.within();
  report(a && b, 'un giro y un cambio de escala mínimos se detectan');
}
{
  const r = rig(); r.settle();
  r.casters[1].visible = false; const hid = r.frame(); r.settle();
  r.casters[1].visible = true; const shown = r.frame(); r.settle();
  report(hid && shown, 'ocultar y volver a mostrar un emisor redibuja (el LOD y los interruptores)');
}
{
  const r = rig(); r.settle();
  const extra = r.caster(20); const added = r.frame(); r.settle();
  extra.removeFromParent(); const removed = r.frame(); r.settle();
  report(added && removed, 'añadir y quitar un emisor redibuja');
}
{
  const r = rig(); r.settle();
  r.receiver.position.x += 3; r.receiver.visible = false;
  const quiet = r.within();
  report(!quiet, 'mover u ocultar algo que solo recibe sombra no redibuja');
}
{
  const r = rig(); r.settle();
  r.casters[0].geometry = r.box.clone();
  const swapped = r.frame(); r.settle();
  const p = r.casters[0].geometry.attributes.position; p.setX(0, p.getX(0) + 0.1); p.needsUpdate = true;
  const deformed = r.frame();
  report(swapped && deformed, 'cambiar la geometría o deformar sus posiciones redibuja', 'los paneles que se abollan');
}
{
  const r = rig(); r.settle();
  const im = new THREE.InstancedMesh(r.box, r.mat, 4); im.castShadow = true; r.scene.add(im);
  im.updateMatrixWorld(); r.settle();
  im.setMatrixAt(2, new THREE.Matrix4().makeTranslation(3, 0, 0)); im.instanceMatrix.needsUpdate = true;
  const moved = r.frame(); r.settle();
  im.count = 3; const fewer = r.frame();
  report(moved && fewer, 'mover una instancia o cambiar su número redibuja');
}
{
  const r = rig(); r.settle();
  r.sun.position.x += 1; const a = r.frame(); r.settle();
  r.sun.target.position.z += 0.5; const b = r.frame(); r.settle();
  r.sun.shadow.camera.right = 60; const c = r.frame(); r.settle();
  report(a && b && c, 'mover el Sol, su objetivo o cambiar el tamaño de su frustum redibuja');
}
{
  const r = rig(); r.settle();
  const seq = Array.from({ length: 5 }, () => r.frame(true));
  report(seq.every(Boolean), 'una secuencia o un pilotaje piden el mapa en cada fotograma', `${seq.filter(Boolean).length} de 5`);
}
{
  const r = rig(); r.settle();
  let at = -1;
  for (let i = 0; i < 80; i++) if (r.frame(false, 100)) { at = r.at(); break; }
  report(at > 0 && at - 1000 <= r.at(), 'con la escena quieta, el mapa se redibuja pasado el límite de edad', `tras ≈${at > 0 ? at : '?'} ms`);
}
{
  // The windsock turns every frame: far from the target it is outside the frustum and must not cost a redraw;
  // near the target it is inside it and must.
  const r = rig(); r.settle();
  r.sock.position.set(5000, 0, 0);
  r.settle();
  let far = 0;
  for (let i = 0; i < 20; i++) { r.sock.rotation.y += 0.05; if (r.frame()) far++; }
  r.sock.position.set(20, 0, 0); r.settle();
  let near = 0;
  for (let i = 0; i < 20; i++) { r.sock.rotation.y += 0.05; if (r.frame()) near++; }
  report(far === 0 && near >= 19, 'la manga de viento solo cuenta cuando cae dentro del frustum', `lejos ${far} de 20 · cerca ${near} de 20`);
}
{
  // Negative controls: a cache that never redraws must fail the "moved caster" check; one that always does, the "idle" check.
  const r = rig(); r.settle();
  r.cache.prepare = () => {};
  r.casters[1].position.x += 1;
  report(!r.within(), 'control negativo: una caché que nunca redibuja deja pasar un emisor que se mueve (el control detecta el fallo)');
}
{
  const r = rig(); r.settle();
  r.cache.enabled = false;
  const n = Array.from({ length: 5 }, () => r.frame()).filter(Boolean).length;
  report(n === 5, 'la caché desactivada redibuja en cada fotograma (la referencia con la que compara la comprobación en navegador)', `${n} de 5`);
}


// ---------------------------------------------------------------------------------------------
// The ambient occlusion's depth and normal buffer
// ---------------------------------------------------------------------------------------------

/** A scene, a camera and a stand-in AO pass, with a cache over them. */
function gRig() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.5, 5000);
  camera.position.set(0, 3, 30); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const opaque = (x) => { const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial()); m.position.set(x, 0.5, 0); scene.add(m); m.updateMatrixWorld(); return m; };
  const cars = [opaque(0), opaque(4), opaque(-4)];
  const glass = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ transparent: true })); glass.position.set(8, 0.5, 0); scene.add(glass);
  const glow = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending })); glow.position.set(-8, 0.5, 0); scene.add(glow);
  const noDepth = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ depthWrite: false })); noDepth.position.set(-12, 0.5, 0); scene.add(noDepth);
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.PointsMaterial()); scene.add(dust);
  const sock = opaque(0); sock.userData.shadowLocal = true; sock.scale.setScalar(1);
  scene.updateMatrixWorld(true);
  const pass = { enabled: true, width: 640, height: 400, reuseGBuffer: false, gbufferStale: false };
  const cache = createGBufferCache(pass, scene, camera);
  let t = 0;
  /** One frame as main.js runs it; true when the cache asked for the buffer to be drawn. */
  const frame = (everyFrame = false, dt = 16) => {
    t += dt;
    cache.prepare(t, everyFrame);
    const drawn = !pass.reuseGBuffer || pass.gbufferStale;
    if (drawn) pass.gbufferStale = false;   // what the pass does when it draws
    scene.updateMatrixWorld(true); camera.updateMatrixWorld();
    return drawn;
  };
  const within = (n = 2) => { let hit = false; for (let i = 0; i < n; i++) if (frame()) hit = true; return hit; };
  const settle = () => { for (let i = 0; i < 3; i++) frame(); };
  return { scene, camera, cars, glass, glow, noDepth, dust, sock, pass, cache, frame, within, settle, at: () => t };
}

{
  const r = gRig(); r.settle();
  const idle = Array.from({ length: 20 }, () => r.frame());
  report(idle.every(d => !d) && r.pass.reuseGBuffer, 'buffer geométrico, escena y cámara quietas: no se vuelve a dibujar', `${idle.filter(Boolean).length} de 20`);
}
{
  const r = gRig(); r.settle();
  r.camera.position.x += 0.01; const a = r.frame(); r.settle();
  r.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.001)); const b = r.frame(); r.settle();
  r.camera.fov = 41; r.camera.updateProjectionMatrix(); const c = r.frame(); r.settle();
  r.camera.setViewOffset(1000, 600, 40, 0, 1000, 600); const d = r.frame(); r.settle();
  report(a && b && c && d, 'la cámara que se mueve, gira, cambia de objetivo o recibe un desplazamiento de vista lo dibuja, en el mismo fotograma');
}
{
  const r = gRig(); r.settle();
  r.cars[1].position.x += 0.1; const moved = r.within(); r.settle();
  r.cars[2].visible = false; const hid = r.frame(); r.settle();
  r.cars[2].visible = true; const shown = r.frame(); r.settle();
  const extra = new THREE.Mesh(r.cars[0].geometry, r.cars[0].material); r.scene.add(extra);
  const added = r.frame(); r.settle();
  extra.removeFromParent(); const removed = r.frame();
  report(moved && hid && shown && added && removed, 'una malla opaca que se mueve, se oculta, se muestra, se añade o se quita lo dibuja');
}
{
  const r = gRig(); r.settle();
  const quiet = [];
  for (let i = 0; i < 5; i++) {
    r.glass.position.x += 0.3; r.glow.position.x += 0.3; r.noDepth.position.x += 0.3; r.dust.position.x += 0.3;
    r.dust.rotation.y += 0.1; quiet.push(r.frame());
  }
  report(quiet.every(d => !d), 'lo que GTAOPass no dibuja en su buffer (cristal, aditivo, sin profundidad, puntos) puede moverse sin coste', `${quiet.filter(Boolean).length} de 5 fotogramas dibujaron`);
  r.glass.material.transparent = false;
  report(r.within(), 'pero si el cristal deja de ser transparente, entra en el buffer y se dibuja');
}
{
  const r = gRig(); r.settle();
  r.cars[0].geometry = r.cars[0].geometry.clone();
  const swapped = r.frame(); r.settle();
  const p = r.cars[0].geometry.attributes.position; p.setX(0, p.getX(0) + 0.1); p.needsUpdate = true;
  const deformed = r.frame();
  report(swapped && deformed, 'cambiar la geometría o deformar sus posiciones lo dibuja');
}
{
  const r = gRig(); r.settle();
  r.pass.enabled = false; r.cache.prepare(r.at() + 16, false);
  report(r.pass.reuseGBuffer === false, 'con el pase apagado no se reutiliza nada');
  r.pass.enabled = true;
  report(r.frame(), 'al volver a encenderse el pase, el primer fotograma dibuja el buffer (el que tenía ya no es de fiar)');
  r.settle();
  r.pass.gbufferStale = true;
  report(r.frame(), 'un cambio de tamaño del objetivo (que borra el buffer) lo dibuja');
  r.settle();
  r.pass.width = 800;
  report(r.frame(), 'y también un ancho distinto del pase');
}
{
  const r = gRig(); r.settle();
  const seq = Array.from({ length: 5 }, () => r.frame(true));
  report(seq.every(Boolean), 'una secuencia o un pilotaje piden el buffer en cada fotograma', `${seq.filter(Boolean).length} de 5`);
  r.settle();
  let at = -1;
  for (let i = 0; i < 80; i++) if (r.frame(false, 100)) { at = r.at(); break; }
  report(at > 0, 'con todo quieto, el buffer se dibuja de nuevo pasado el límite de edad', `tras ≈${at > 0 ? at - 3 * 16 - 5 * 16 : '?'} ms de quietud`);
  r.settle();
  r.cache.invalidate();
  report(r.frame(), 'tras invalidar (un contexto perdido) el siguiente fotograma lo dibuja');
}
{
  // The windsock turns every frame: 1.7 m across at 1.5 km it is half a pixel (a stale buffer cannot show it); beside the camera it is big and counts.
  const r = gRig(); r.settle();
  r.sock.position.set(0, 0, -1500); r.sock.scale.setScalar(1); r.settle();
  let far = 0;
  for (let i = 0; i < 20; i++) { r.sock.rotation.y += 0.05; if (r.frame()) far++; }
  r.sock.position.set(2, 1, 20); r.sock.scale.setScalar(2); r.settle();
  let near = 0;
  for (let i = 0; i < 20; i++) { r.sock.rotation.y += 0.05; if (r.frame()) near++; }
  report(far === 0 && near >= 19, 'la manga de viento solo cuenta cuando se ve con un tamaño que importa', `lejos ${far} de 20 · cerca ${near} de 20`);
}
{
  const r = gRig(); r.settle();
  r.cache.prepare = () => { r.pass.reuseGBuffer = true; };
  r.cars[1].position.x += 1;
  report(!r.within(), 'control negativo: una caché ciega deja pasar una malla que se mueve (el control detecta el fallo)');
}
{
  const r = gRig(); r.settle();
  r.cache.enabled = false;
  const n = Array.from({ length: 5 }, () => r.frame()).filter(Boolean).length;
  report(n === 5, 'la caché desactivada dibuja el buffer en cada fotograma (la referencia de la comprobación en navegador)', `${n} de 5`);
}

console.log(failed ? `\n${failed} comprobaciones fallan` : '\nCachés de sombras y de buffer geométrico: todo correcto');
process.exit(failed ? 1 : 0);
