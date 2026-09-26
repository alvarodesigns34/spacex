# Traspaso de contexto: SpaceX Vehicle Center 3D

Hola, Claude. Continúas un proyecto que llevo trabajando contigo durante muchas sesiones. Aquí tienes todo lo necesario para seguir exactamente donde lo dejamos, con los mismos criterios y la misma forma de trabajar. Léelo entero antes de hacer nada.

---

## 0. Reglas innegociables (léelas primero)

1. **Habla SIEMPRE en español conmigo.** Ni una palabra en inglés en mensajes, resúmenes, preguntas, avisos de progreso ni descripciones de comandos. Está en `CLAUDE.md` del repo y en mi `~/.claude/CLAUDE.md`. Excepciones:
   - el texto de la interfaz de la simulación sigue en inglés;
   - los comentarios del código siguen el estilo existente (en inglés);
   - los mensajes de commit se escriben en inglés, como todos los del historial.
2. **No crear pull requests.** Empujar siempre el mismo commit a estas **tres ramas**:
   - `claude/dreamy-bell-qn1eth`
   - `grok/sun18-audit-10c9929`
   - `claude/spacex-vehicle-center-3d-48zlkm` (la rama por defecto; la que despliega Pages)
3. **Antes de cada commit, `npm run check` tiene que terminar con código 0.** Tarda unos 25 minutos. Nunca confirmes sin él.
4. **Tras cada push, comprueba que GitHub Pages sirve la versión nueva:** https://alvarodesigns34.github.io/spacex/
5. **No regenerar la galería de capturas** (`docs/screenshots`, `docs/hud`, `npm run shots`) **hasta que yo lo apruebe explícitamente.** La galería actual está desactualizada (muestra la torre oscura, el faldón antiguo del propulsor, etc.). Aún no lo he aprobado.
6. **Escala 1:1, solo medidas verificables, y las aproximaciones marcadas como tales** (≈, `approx: true`, «reconstruido»).
7. **Prohibido:**
   - banderas o logotipos nuevos;
   - plataformas de lanzamiento extra;
   - modo noche;
   - plantas u objetos nuevos en el entorno.
8. **El README se escribe en español y se actualiza con cada cambio.**
9. **Pie de los commits** (exactamente estas dos líneas al final del mensaje):
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: <la URL de la sesión que te dé el sistema>
   ```
   No pongas el identificador del modelo en ningún otro sitio (código, README ni resto del commit). Si el sistema te da otro pie de atribución, usa el que te dé.
10. **Nunca eludir Cloudflare ni protecciones antibots** al investigar.
11. **Fotos con derechos de autor** (NSF, etc.) se usan **solo como referencia visual**, nunca se añaden al repositorio.
12. **Mi email no se envía a servicios externos.** Por ejemplo, nunca en la cabecera User-Agent de peticiones a Wikimedia; usa una cabecera genérica como `Mozilla/5.0 (research script)`. Ya se coló una vez y no debe repetirse.

---

## 1. Qué es el proyecto

**SpaceX Vehicle Center 3D**:
- **Qué es:** una simulación web en Three.js (ES modules, sin bundler, `vendor/` con three) de un museo al aire libre con ocho expositores de SpaceX **a escala 1:1**, sobre un entorno costero tipo Boca Chica.
- **Repositorio:** `alvarodesigns34/spacex`. Trabajo local en `/home/user/spacex`.
- **Web publicada:** https://alvarodesigns34.github.io/spacex/

### Expositores (orden en el HUD; teclas 1–8, 0 = vista general)
1. **Starship V3** (Super Heavy Block 3 + nave) sobre una reconstrucción del **Pad 2 de Starbase**: mesa, zanja de llamas, torre con brazos de captura, granja criogénica, deluge. Incluye la **secuencia de lanzamiento completa**: cuenta atrás, despegue, max-Q, separación en caliente, boostback, regreso y captura del propulsor en la torre, con sonido sintetizado.
2. **Falcon 1** (configuración de 2008, con erector y torre umbilical de Omelek, corte educativo de la 2.ª etapa).
3. **Falcon 9** Block 5 (sobre su mesa con 4 pinzas).
4. **Falcon Heavy** (8 pinzas, 6 mástiles de cola).
5. **Dragon** (Crew Dragon con trunk, sobre adaptador cónico).
6. **Starlink** V2 Mini (sobre poste).
7. **Tesla Roadster** con **Starman** (vista «In orbit» con adaptador PAF y brazos de cámara selfie).
8. **Engine Row**: Merlin 1D, Raptor 3 y Raptor Vacuum sobre cunas.

### Estructura del código
- `src/main.js`: arranque, escena, disposición de expositores (`LAYOUT`: `x`, `z`, `mount`, `yaw`…) y `worldPreset()`.
- `src/vehicles/`: un builder por vehículo:
  - `starship.js`, `falcon.js`, `falcon1.js`, `dragon.js`, `starlink.js`, `roadster.js` (≈3600 líneas), `enginehall.js`;
  - `engines.js`: geometrías de motores instanciadas;
  - `pad.js`: Pad 2;
  - `padDressing.js` y `common.js`: mesas de los Falcon y utilidades.
- `src/sim/`:
  - `launch.js`: trayectoria, eventos, cámara, nubes, vapores;
  - `plume.js`: penachos, nube del suelo, `Glow`, `Vapor`, `EngineJets`;
  - `sound.js`: WebAudio sintetizado.
- `src/core/`:
  - `environment.js`: cielo, sol, niebla, altitud;
  - `terrain.js`, `campus.js`, `clouds.js`, `backdrop.js`;
  - `lod.js`: nivel de detalle con histéresis;
  - `quality.js`: niveles high/medium/low;
  - `cameraRig.js`, `viewState.js`, `ao.js`.
- `src/materials/`:
  - `library.js`: materiales `M.*`;
  - `textures.js`: texturas procedurales en Canvas con UV métricas y `tileSize`.
- `src/data/`:
  - `specs.js`: fichas de datos y fuentes (`SOURCES`), presets de cámara por vehículo, `SOURCE_LABEL`;
  - `verify.js`: verificación dimensional, integridad de mallas e interfaces;
  - `falcon1.js`.
- `src/ui/hud.js`: interfaz.
- `tools/`: pruebas:
  - `check.mjs`: la principal;
  - `cloud-check.mjs`, `hardware-check.mjs`, `ux-check.mjs`;
  - `lod-pop.mjs`: mide el salto visual al cambiar de nivel de detalle; no está en el check;
  - `profile.mjs`, `shot.mjs`, `census.mjs`, `static.mjs`…
- `.github/workflows/pages.yml`: valida con `npm run check` en `main`, `master`, `claude/**`, `codex/**` y `grok/**`, con una cola de concurrencia por rama, y despliega solo desde la rama por defecto.

### Objeto global de depuración (en el navegador): `window.__vc`
- `v.jump(id, presetId)` y `v.jump(null)` (vista general); `v.claimUserControl()`; `v.rig.jumpTo(pos, target)`.
- `v.launch.seek(t)`, `v.launch.setSpeed(0)`, `v.launch.reset(false)`.
- `v.lod.pin(name, true|false)`, `v.lod.update()`, `v.lod.forceDetailed()`, `v.lod.entries`.
- `v.exhibits[id].model`, `.lay`, `v.complex` (el Pad 2), `v.scene`, `v.camera`, `v.composer`, `v.renderer`, `v.setToggle('labels'|'ruler'|'humans', bool)`.

---

## 2. Cómo trabajamos (método)

- **Investigación profunda con fuentes primarias**:
  - spacex.com (incluido el artículo «Introducing Starship V3», 12 mayo 2026), guía de usuario de Falcon 2025, guía de Falcon 1 2008;
  - manuales oficiales de Tesla;
  - NASA (API `images-api.nasa.gov`; descargar por HTTPS desde `images-assets.nasa.gov/image/<id>/<id>~medium.jpg`);
  - NASASpaceflight (NSF), Wikimedia Commons (con `Special:FilePath/<archivo>?width=1280` y una cabecera genérica; tiene límite de peticiones).

  Cuando WebFetch da 403, uso un Chromium real (herramienta `_web.mjs`, anexo). Si dos fuentes chocan, manda la primaria. Si no hay cota publicada, hago **fotogrametría sobre fotos** (con un diámetro o ancho conocido como regla) y lo marco como aproximado.
- **Verificar visualmente cada cambio**: renderizo fotogramas con `_frames.mjs` y los reviso, con hojas de contacto (`sheet.py`) y recortes ampliados. Comparo con las fotos reales. No me conformo con que la prueba pase.
- **Auditorías externas**: el usuario me ha pasado auditorías de Grok y de ChatGPT. Contrasto cada punto con la fuente primaria y el código, implemento lo demostrable, rebato con pruebas lo que no se sostiene y no borro nada sin evidencia.
- **Comprobación completa** en segundo plano y consulta periódica:
  ```
  S=<scratchpad>; rm -f $S/check.log; (npm run check > $S/check.log 2>&1; echo "EXIT $?" >> $S/check.log)
  until grep -q '^EXIT' $S/check.log; do sleep 10; done   # (con timeout ≤ 590 s por llamada)
  ```
  **No edites archivos servidos mientras corre el check** (el servidor sirve en vivo).
- **Push a las tres ramas con reintentos:**
  ```
  for b in claude/dreamy-bell-qn1eth grok/sun18-audit-10c9929 claude/spacex-vehicle-center-3d-48zlkm; do for d in 2 4 8 16; do git push -q origin HEAD:$b 2>/dev/null && { echo "ok $b"; break; } || sleep $d; done; done
  ```
- **Comprobar Pages**: hacer `curl` a un archivo cambiado con `?x=$RANDOM` hasta que contenga el texto nuevo. El workflow tarda unos 12 minutos porque ejecuta el check antes de desplegar.
- **Estilo de respuesta que quiero**: en español, claro y honesto. Si algo falla, lo digo con la salida. Pequeños avisos de progreso mientras trabajas en tareas largas.
- **Entorno**: contenedor remoto. Chromium en `/opt/pw-browsers`; no ejecutar `playwright install`. Para que Chromium navegue por el proxy hace falta la CA en NSS:
  ```
  apt-get install -y libnss3-tools   # si falta certutil
  mkdir -p /root/.pki/nssdb && certutil -A -d sql:/root/.pki/nssdb -n ccr-agent-proxy -t "C,," -i /root/.ccr/agent-proxy-ca.crt
  ```
  y lanzar con `proxy: { server: process.env.HTTPS_PROXY }`.
- **Sin `gh` CLI**: GitHub se usa mediante las herramientas MCP `mcp__github__*`. Por ejemplo, `actions_list` para ver las ejecuciones del workflow.

---

## 3. Historia del trabajo (resumen cronológico)

Hay 118 commits. Los más recientes:

```
6ec11a5 Document the Falcon 9 stations against the FH demo photograph; README: external audit outcomes
b2f5ad7 Roadster to Tesla's own figures: 1.851 m across the mirrors, 0.871/0.724 m overhangs, 1.456/1.485 m tracks, 1.127 m high; body width reconstructed; per-figure tolerances in the check; CI gates grok/** with one concurrency queue per branch
d568c60 Heat shield tiles charcoal with pale chamfered edges, as in the Ship 39 close-ups
d83b172 Pad 2 tower in bare light-grey steel with dark arms, clad tower base with its rear housing; Block 3 booster with its 33 Raptors hanging in the open below the thrust ring
23658d6 Liftoff plume yellow-white rather than salmon; flaps preset frames the flap in profile
8006275 Pad 2 pin centring (one sled and a telescopic pusher per arm); Raptor Vacuum carries the sea-level pack
518498a Pad 2 chopsticks about 26 m (NSF)
215b1ce Starman suit greys; Starlink figures re-read at source
2edc3b3 Falcon fairing access door (610 mm, User's Guide 2025)
c5b86c6 Close the tank-farm domes; carbon louvre panel on the Roadster bonnet
66d0242 Starship V3 and Pad 2 checked against official data and photographs
```

### Rondas anteriores (ya hechas y documentadas en el README)
- **Pad 2 rehecho con referencias**: se quitaron mástiles y farolas sin sentido.
- **Estabilidad del render**: parpadeos y huecos entre losetas.
- **Vehículos y montaje**: HUD, Falcon 1 muy mejorado, Falcons limpios (sin hollín) y apoyados de verdad sobre mesas con pinzas, carretera realista (MUTCD), Starman mucho mejor.
- **Auditoría de Grok (A1–A16)**: pines del propulsor alineados con los brazos, pines de la nave, etc.
- **Rondas R3/R4**: entorno (terreno, costa, dunas, lagunas, cielo, mar), cada vehículo y el lanzamiento sin tirones.
- **Correcciones pedidas por el usuario**: hierba junto a la costa, captura sin que los brazos atraviesen el propulsor, más calidad del suelo, Starship primero en el HUD, sol más bajo por defecto, losa de la explanada solapando la carretera.
- **Ronda 5 (lanzamiento, sonido y entorno)**:
  - presupuesto de partículas de la nube, atlas 2×2 de bocanadas, fuego por la zanja, `Glow`;
  - penacho con mezcla premultiplicada;
  - sonido: crepitar por choques en N, fluctuación, reflexión en el suelo (filtro en peine), golpes de encendido 3 → 13 → 33;
  - oclusión ambiental desactivada durante el lanzamiento.
- **«Starship V3 contra las fotos»**:
  - alturas oficiales: propulsor 236 ft = 71,93 m, nave 171 ft = 52,12 m, total 124,05 m; Raptor 3 de 1,3 × 2,9 m;
  - propulsor: etapa caliente integrada tipo N1 (20 pares de puntales), cúpula delantera blindada, 3 rejillas negras con celdas en escama, acero casi espejo con líneas punteadas de largueros, anillos de tuberías y cajas de conexiones en la popa, toberas Raptor 3 grafito mate, giro 108°–108°–144° de los 3 centrales, conducto exterior hasta media altura;
  - nave: conos de acoplamiento;
  - Pad 2: mesa con contrafuertes, plataforma a 5 m y cubierta a 18 m;
  - otros vehículos: tanques de la granja, puerta de 610 mm de la cofia, grises del traje de Starman, lamas de carbono del Roadster, Starlink (2 × 52,5 m² de paneles).

### Esta última sesión (en orden)
1. **Brazos del Pad 2**: miden ≈26 m (NSF: 10 m menos que los ≈36 m del Pad 1). La verificación lo comprueba (`EXPECTED_PAD.armLen`).
2. **Centrado de pines** (NSF): un carro por brazo y un empujador telescópico en la punta. Tamaños reconstruidos.
3. **Raptor Vacuum**: ahora lleva el mismo paquete de turbobombas que el Raptor de nivel del mar (antes, un tambor pequeño). Se añadió `profileRadius()` (interpolado) para los aros de la tobera, que antes quedaban escondidos. Las tuberías de la fila de motores solo van en el Merlin.
4. **Penacho**: el núcleo pasa de salmón a blanco-amarillo; la ganancia depende de la presión (`3.4 + 3.6·p`). Encuadre «Flaps and nose» cambiado.
5. **Torre del Pad 2**, según fotos NSF del pad terminado (mayo 2026):
   - acero **gris claro** (`M.towerClad`, textura `makeTowerClad`), con brazos, carro y QD **grafito oscuro** (`M.towerSteel`);
   - **base de la torre**: bloque revestido de ≈9 m con volumen trasero de 6,5 m, dos plantas de huecos y pasarela, medido en la foto (aproximado);
   - cabrestante detrás de la base; el cable entra por encima de ella.
6. **Popa del Super Heavy V3**: los **33 Raptor cuelgan al aire** bajo el anillo negro de empuje (antes, escondidos en un faldón de 3 m).
   - `BOOSTER_AFT = 3.15` (en `starship.js`): el anillo, la placa de empuje y las tuberías empiezan a esa altura sobre la salida de las toberas.
   - **Todo el conjunto baja 3,15 m en la mesa**: `mount: PAD.deckTop - BOOSTER_AFT` en `main.js`; las pinzas agarran el borde del anillo.
   - `qdY = 96 − BOOSTER_AFT`; los emisores de vapor apegados a la mesa se desplazan igual; `towerClear` se recalcula (`CLIMB = 144.5 − (13 − BOOSTER_AFT)`).
   - Sin separadores de bahía; `hardware-check.mjs` lo comprueba ahora.
7. **Losetas del escudo** (primer plano NSF del Ship 39):
   - color carbón (base `0x37383d`, `envMapIntensity` 0,5);
   - **bisel claro** de ≈7 mm con colores por vértice (`hexPrism(..., 0.045, 3.0)`, `M.tile.vertexColors`);
   - se descartó aclarar la capa inferior, porque desde ~30 m aclaraba todo el escudo;
   - `tools/lod-pop.mjs`: |Δ| 20 frente a 24 antes.
   - Ojo: `_frames.mjs` no actualiza el nivel de detalle. Para ver las losetas reales de cerca hay que llamar `v.lod.pin('starship-tps', true)`.
8. **Auditoría externa de ChatGPT**, contrastada:
   - **Roadster: error real, corregido.** El manual de servicio y el del propietario de Tesla dan 3946 mm de largo, **1851 mm de ancho con espejos**, 1127 mm de alto, 2351 mm de batalla, **voladizos 871/724 mm**, vías 1456/1485 mm y 130 mm de altura libre.
     - El modelo usaba 1852 mm como anchura sin espejos (mala lectura de fuentes secundarias) y tenía los voladizos simétricos.
     - Corrección en `reshapeToPublished()` (`roadster.js`), un post-proceso de vértices con normales corregidas:
       - estrecha la carrocería a **≈1,75 m (reconstruido)**;
       - deja los espejos con la cara exterior en 1851/2, sin tener en cuenta el giro hacia dentro de la carcasa;
       - estira los voladizos solo más allá de los pasos de rueda, con mezcla cuadrática;
       - escala el parabrisas hasta 1,127 m;
       - desplaza a Starman con su asiento;
       - recentra el coche (−7,35 cm).
     - Ejes resultantes: +1,102 y −1,249 m.
   - **Tolerancias por figura** (`tols` en `EXPECTED`) y la nueva medida «anchura total con espejos» en `verify.js`.
   - **Falcon 1**: README corregido a 21,98 m / Ø1,681 m (plano acotado de la guía 2008).
   - **CI**: `grok/**` añadido; concurrencia por rama.
   - **Falcon 9**: se mantienen las estaciones (41,2 m de primera etapa incluyendo la interetapa). Verificado por fotogrametría en la foto del FH de la demo: rejillas a ≈39,5 m. Documentado en `falcon.js`. La cofia sigue en 13,2 × 5,2 m (guía 2025).
   - **Dragon: PENDIENTE.** Número de ventanas: el modelo tiene 4 en el costado más la de la escotilla. La NASA actual dice 3 y documentos antiguos 4. No se encontró una foto clara. No se ha tocado nada.

---

## 4. Estado actual y pendientes

- **HEAD** `6ec11a5` en las tres ramas. Check verde. Pages sirve esta versión.
- **Pendiente de mi aprobación:** regenerar la galería de capturas. Está desactualizada; no la regeneres sin que te lo diga.
- **Pendientes técnicos abiertos:**
  - **Dragon**: identificar la configuración (Crew Dragon actual) y el número y posición de ventanas con fotos claras. Solo cambiar con evidencia.
  - **Propuestas de la auditoría de ChatGPT aún no abordadas** (tengo que priorizarlas):
    - capa de datos canónica con procedencia (A = primaria medida, B = primaria visual/fotogrametría, C = secundaria fiable, D = reconstruida) para que `specs.js`, los builders, `verify.js` y el README no se desincronicen, y generar o verificar la tabla del README;
    - tolerancias por procedencia en el resto de vehículos y en el Pad 2 (ahora solo el Roadster tiene `tols`);
    - regresión visual interna nueva (no la galería pública): cámaras, sol y semilla fijos, comparación perceptual;
    - prueba automática de salto de nivel de detalle en el check (ahora `lod-pop.mjs` va aparte);
    - regulador de calidad adaptativo según el tiempo de fotograma;
    - modo físico 3-DOF del lanzamiento (sin romper lo visual);
    - modularizar `roadster.js`, `launch.js`, `main.js`, `plume.js`, `textures.js` y `pad.js`;
    - ESLint, `// @ts-check` y pruebas unitarias baratas;
    - mover el historial del README a `docs/ACCURACY.md` / `docs/PROVENANCE.md` / `docs/CHANGELOG_VISUAL.md`;
    - accesibilidad (axe-core, `prefers-reduced-motion`) y pruebas de humo en WebKit y Firefox;
    - Starlink: fijar la variante exacta y revisar filings de la FCC.
  - **Posibles mejoras visuales detectadas:**
    - popa de la nave V3;
    - base de la torre (fondo real desconocido);
    - hollín bajo las rejillas en propulsores probados (decidimos mostrar los vehículos limpios).
- **Última petición general del usuario:** «Mejora todo, revisa todo al máximo. Añade detalle y realismo en todo… AMBICIÓN.» Mantener la ambición, pero siempre con evidencia y sin inventar.

---

## 5. Datos y convenciones técnicas útiles

- **Marco de Starship**: el origen del conjunto es el plano de salida de las toberas del propulsor.
  - `ex.lay.mount = PAD.deckTop − BOOSTER_AFT` (18 − 3,15).
  - `PAD`: `padY 5`, `bermY 2.5`, `deckTop 18`, `towerX −30`, `towerHalf 6.1`, `section 12.2` × 10, `mast 22.5` (torre de 144,5 m), `armLen 26`, `armY 46`, `qdY 96 − BOOSTER_AFT`, `trenchFloorY 0.8`.
  - Guiñada del conjunto: `STACK_YAW_DEG = 129.6`; en el modelo, la panza (losetas) mira a +z local.
- **Presets de cámara**: por defecto en el marco del vehículo (giran con él). Con `frame: 'site'` van en el marco del sitio. Se definen en `specs.js`.
- **Integridad de mallas** (`verify.js`): comprueba que la escala de las UV cuadre con el `tileSize` del mapa. Una geometría construida lejos del origen da falsos positivos, así que conviene construirla centrada y posicionarla.
- **Materiales**: `M.steel`, `M.steelSkirt`, `M.aftBlack`, `M.bellRaptor3`, `M.metalTile`, `M.domePlate`, `M.gridFin`, `M.tile`, `M.tileUnder` (oscuro), `M.tpsShell`, `M.towerClad`, `M.towerSteel`, `M.concrete`, `M.darkMetal`, `M.blackMatte`, etc.
- **Tiempos de la secuencia** (`launch.js`, `EVENTS`):
  - liftoff T+2, maxQ 62, meco 152, separación 160;
  - boostback 165–221, encendido de aterrizaje 390, captura 414, fin 436.
- **Fuentes clave ya usadas**:
  - spacex.com (Starship, V3), Falcon User's Guide 2025, Falcon 1 User's Guide 2008;
  - Tesla Roadster Service Manual: https://service.tesla.com/docs/Public/Roadster/ServiceManual/en-us/GUID-4E037ADB-D0F4-48A0-9261-1083193D4C1B.html
  - NSF: «Starbase Pad 2: Design Advancements» (ago. 2025), «Super Heavy Block 3» (may. 2026), Ship 39 (feb. 2026);
  - Wikipedia, con precaución.

---

## Anexo: herramientas locales (no están en el repo; recréalas)

Están excluidas en `.git/info/exclude` (`tools/_frames.mjs`, `tools/_probe.mjs`, `tools/_web.mjs`…). En un contenedor nuevo no existen: créalas con este contenido y añádelas a `.git/info/exclude`.

### `tools/_frames.mjs`: renderiza fotogramas directamente del compositor
Uso: `node tools/_frames.mjs <frames.js> <outdir> [--port 8814] [--w 1280 --h 720]`.

`frames.js` es una expresión JS que devuelve un array `[{ name, t?, setup? }]`, donde `setup` es el cuerpo de JS que se ejecuta tras el seek, con `v` y `THREE` en el ámbito. Ejemplo:

```js
[{ name: 'a', t: 8 }, { name: 'b', setup: "v.jump('starship','engines'); await new Promise(r=>setTimeout(r,3500));" }]
```

Los fotogramas sin `t` heredan el estado del anterior. Usa `t: -40` y `v.launch.reset(false)` para tener el conjunto en la mesa.
```js
// Local, not committed: boots once and renders a list of frames straight from the composer.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { staticHandler } from './static.mjs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(argOf('--port') ?? 8814);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const W = Number(argOf('--w') ?? 1280), H = Number(argOf('--h') ?? 720);
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
const out = args[1];
await mkdir(out, { recursive: true });
try {
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/${argOf('--query') ?? ''}`, argOf('--quality') ?? 'high');
  await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; const v = window.__vc; v.setToggle('labels', false); v.setToggle('ruler', false); v.hud?.hideCoach?.(); });
  const list = await page.evaluate(`(async () => { const v = window.__vc; const THREE = await import('three'); return ${await readFile(args[0], 'utf8')}; })()`);
  for (const f of list) {
    const t0 = Date.now();
    const url = await page.evaluate(`(async () => {
      const v = window.__vc; const THREE = await import('three');
      const f = ${JSON.stringify(f)};
      if (f.t !== undefined) { v.launch.setSpeed(0); v.launch.seek(f.t); }
      ${f.setup ?? ''}
      v.camera.updateMatrixWorld();
      v.composer.render(); v.composer.render();
      return v.renderer.domElement.toDataURL('image/jpeg', 0.88);
    })()`);
    await writeFile(`${out}/${f.name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(f.name, `${Date.now() - t0} ms`);
  }
} finally { await browser.close(); server.close(); }
```

### `tools/_probe.mjs`: evalúa un script en la página y devuelve el resultado en JSON
Uso: `node tools/_probe.mjs <script.js> [--port 8813]`. En el script ya están `v` y `THREE`; **no vuelvas a declarar `const THREE`**.
```js
// Local, not committed: boots the page at high quality and evaluates a JS file against it.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { staticHandler } from './static.mjs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(argOf('--port') ?? 8813);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const W = Number(argOf('--w') ?? 1600), H = Number(argOf('--h') ?? 900);
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('CONSOLE', m.text()); });
try {
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/${argOf('--query') ?? ''}`, argOf('--quality') ?? 'high');
  const body = await readFile(args[0], 'utf8');
  const out = await page.evaluate(`(async () => { const v = window.__vc; const THREE = await import('three'); ${body} })()`);
  if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  const shot = argOf('--shot');
  if (shot) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.screenshot({ path: shot, timeout: 300000 });
  }
} finally { await browser.close(); server.close(); }
```

### `tools/_web.mjs`: navegador real para investigar
Uso: `node tools/_web.mjs <url> <prefijo-salida> [--wait 6000] [--full]`. Escribe `.png`, `.txt`, `.imgs` y `.links`. Requiere la CA del proxy en NSS (ver sección 2).
```js
// Local, not committed: a real browser for research.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const [url, out] = args;
const browser = await chromium.launch({ args: ['--no-sandbox'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({
  viewport: { width: Number(argOf('--w') ?? 1440), height: Number(argOf('--h') ?? 900) },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  locale: 'en-US', ignoreHTTPSErrors: false,
});
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(Number(argOf('--wait') ?? 5000));
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}.png`, fullPage: args.includes('--full') });
  const text = await page.evaluate(() => document.body.innerText);
  await writeFile(`${out}.txt`, text);
  const imgs = await page.evaluate(() => [...document.images].map(i => `${i.naturalWidth}x${i.naturalHeight} ${i.currentSrc || i.src} | ${(i.alt || '').slice(0, 80)}`));
  await writeFile(`${out}.imgs`, imgs.join('\n'));
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => `${a.href} | ${(a.innerText || a.title || '').trim().slice(0, 60)}`));
  await writeFile(`${out}.links`, links.join('\n'));
  console.log('ok', (await page.title()), text.length, 'chars');
} catch (e) { console.log('ERR', e.message); }
await browser.close();
```

### `sheet.py` (en el scratchpad): hoja de contactos de una carpeta de JPG
Uso: `python3 sheet.py <carpeta> <salida.jpg> [columnas]`.
```python
import sys, glob
from PIL import Image, ImageDraw
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3
fs = sorted(glob.glob(d + '/*.jpg'))
fs = [f for f in fs if not f.endswith('sheet.jpg')]
w, h = 520, 293
W = Image.new('RGB', (w * cols, h * ((len(fs) + cols - 1) // cols)))
for i, f in enumerate(fs):
    im = Image.open(f).resize((w, h))
    ImageDraw.Draw(im).text((6, 4), f.split('/')[-1], fill=(255, 0, 0))
    W.paste(im, ((i % cols) * w, (i // cols) * h))
W.save(out, quality=85)
```

**Encuadres de todos los expositores**: la lista de presets está en `specs.js`. Para auditar, genero un `frames.js` con `v.jump(id, preset)` para cada uno y reviso la hoja de contactos.

---

Cuando hayas leído todo, confírmame en español que tienes el contexto y dime qué propones atacar primero. No empieces a cambiar nada hasta que te diga qué priorizar, salvo que yo te lo pida directamente.
