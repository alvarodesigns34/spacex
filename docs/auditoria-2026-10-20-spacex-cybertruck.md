# Auditoría conjunta de `spacex` y `cybertruck` (20-10-2026; revisada el 23-10-2026)

**Objetivo de la auditoría:** dejar preparada, sin tocar código ni documentación, la integración del Cybertruck (repositorio `alvarodesigns34/cybertruck`) en la simulación «SpaceX Vehicle Center» (repositorio `alvarodesigns34/spacex`), según la orden del usuario de este día:

> El Cybertruck **no debe verse en el entorno principal** (donde están el resto de vehículos). Se añade **un botón** para él que lleva a un espacio **como el visor del repositorio `cybertruck`**.

Además se auditan ambos repositorios en general: código, documentación, pruebas, despliegue y datos.

**Segunda versión (misma fecha, a petición del usuario):** se añade la sección 8, un análisis de **mejoras** de los modelos y de la simulación, no solo de problemas: hiperrealismo de imagen, calidad de los modelos, conducción y vuelo, y fluidez sin renunciar a calidad. Cada mejora lleva su evidencia, su impacto, su coste y cómo comprobarla. También se añaden hallazgos nuevos que salieron de ese análisis (C21–C23 y S13–S14).

**Tercera versión (23-10-2026, a petición del usuario): Blender sin MCP.** El usuario ya no quiere que Claude use su Blender de escritorio por Blender MCP. Claude trabaja con su **propio Blender, sin interfaz, en el entorno del agente**. La nueva sección 11 explica qué cambia y qué se pierde o se gana con eso. Todo se comprobó en este entorno:

- Blender 5.2.2 LTS para Linux, la misma versión que la del usuario, con la suma SHA-256 oficial verificada.
- Reconstrucción completa del Cybertruck con sus scripts: 331 s, validación idéntica y GLB equivalente.
- Los tres motores de render funcionan: Cycles en CPU; EEVEE y Workbench con Mesa EGL.

Se añade también el hallazgo C24.

**Estados auditados:** `spacex` en `587e49c` (las cinco ramas de trabajo y `claude/amazing-ramanujan-dj19ea` en ese commit); `cybertruck` en `main` = `f021e08`.

**Restricción respetada:** las versiones 1 y 2 no modificaron ningún archivo de los repositorios. En la 3.ª, por orden del usuario, se actualiza la documentación de ambos repositorios con la preferencia sobre Blender y se sube este documento a los dos: `docs/auditoria-2026-10-20-spacex-cybertruck.md`, con el mismo texto en ambos. No se ha tocado código.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Método: qué se leyó, qué se ejecutó y qué no se pudo](#2-método)
3. [Estado verificado de ambos repositorios](#3-estado-verificado)
4. [La integración del Cybertruck en spacex](#4-la-integración-del-cybertruck-en-spacex)
5. [Hallazgos en `cybertruck`](#5-hallazgos-en-cybertruck)
6. [Hallazgos en `spacex`](#6-hallazgos-en-spacex)
7. [Correcciones prioritarias](#7-correcciones-prioritarias)
8. [**Mejoras de los modelos y de la simulación**](#8-mejoras-de-los-modelos-y-de-la-simulación) (nuevo)
9. [Decisiones que corresponden al usuario](#9-decisiones-que-corresponden-al-usuario)
10. [Anexos: cifras, cotas verificadas y reproducciones](#10-anexos)
11. [**Blender sin MCP: la preferencia del usuario y lo que cambia**](#11-blender-sin-mcp-la-preferencia-del-usuario-y-lo-que-cambia) (nuevo, 23-10)
12. [**Seguimiento: qué está hecho (23-10-2026)**](#12-seguimiento-qué-está-hecho-23-10-2026)

Escala de gravedad: **Crítico** (impide la integración o rompe producción) · **Alto** (fallo real visible o riesgo serio) · **Medio** (fallo menor o deuda que cuesta tiempo) · **Bajo** (cosmético o improbable) · **Info** (observación sin defecto).

---

## 1. Resumen ejecutivo

**Estado de partida: bueno.** Las dos webs están publicadas y su CI está en verde. En `spacex`, `npm run check:static` pasa en local (267 PASS, 0 FAIL, código 0), y el Three.js incluido en `vendor/three` es idéntico, archivo a archivo, al paquete oficial `three@0.170.0`. En `cybertruck`, el visor carga sin errores de consola, la explosión es reversible (desviación 0 en 1.138 piezas tras cinco ciclos) y las cotas del manifiesto coinciden con el manual del propietario de Tesla, comprobado en esta auditoría.

**La integración es viable y tiene precedente.** El 16 y el 17 de octubre existió en `spacex` el **Audi Lab** (`src/ui/audiLab.js`, retirado en `1694867`; su código sigue en `8e6a633`). Hacía lo que ahora se pide:

- un botón en la barra de herramientas y la tecla **U**;
- un espacio de estudio aparte, con su propia escena, cámara y compositor, que dibuja con el renderer de la simulación;
- el bucle principal se detiene mientras está abierto, y la simulación vuelve tal como estaba;
- el modelo se descarga solo la primera vez que se abre.

La auditoría del 16-10 sobre ese Lab dejó lecciones que se aplican tal cual (§4.3).

**Cinco bloqueos que hay que resolver sí o sí:**

| # | Bloqueo | Dónde | Gravedad |
|---|---|---|---|
| I1 | El GLB del Cybertruck **exige** `KHR_draco_mesh_compression` (las 2.038 primitivas van en Draco) y `spacex` no incluye `DRACOLoader` ni el decodificador. Sin ellos, el modelo no carga. | `spacex/vendor/three` | Crítico |
| I2 | El visor del Cybertruck carga Three.js, Draco y la tipografía de **CDN** (jsDelivr y Google Fonts). `spacex` prohíbe los CDN. Hay que incorporar `DRACOLoader.js`, `libs/draco/gltf/` y `objects/Reflector.js` de la misma versión r170. | `cybertruck/web/index.html`, `config.js` | Crítico |
| I3 | Si el Cybertruck entrara en la escena principal, rompería **tres de los cuatro techos** de `tools/check.mjs`: triángulos (5,25 M + 1,18 M = 6,43 M frente a 6 M), mallas (1.836 + ≈2.040 frente a 2.600) y materiales (363 + 83 = 446 frente a 420). El CI no desplegaría. La orden del usuario (fuera del entorno principal) lo evita, siempre que el espacio aparte use **su propia escena**. | `spacex/tools/check.mjs` | Crítico si se hace mal |
| I4 | La barra de carga del visor **pasa del 100 %** en producción (reproducido: hasta **136 %**). GitHub Pages sirve el GLB comprimido con gzip, y `Content-Length` es el tamaño comprimido (9,19 MB frente a 12,48 MB). Al copiar el código hay que evitarlo, y también el error del Audi Lab (descarga doble). | `cybertruck/web/src/main.js` | Alto |
| I5 | **Idioma**: la interfaz de `spacex` es en inglés por norma (`CLAUDE.md`), y las 1.138 etiquetas y notas del GLB (`label_es`, `note_es`) están en español. Lo decide el usuario (§9). | ambos | Decisión |

**Recomendación de arquitectura (§4.4):** un módulo `src/ui/cybertruckLab.js` hecho sobre el patrón del Audi Lab, con estas características:

- su propia `THREE.Scene`, nunca añadida a la escena principal: así el presupuesto de `check.mjs` no cambia;
- reutiliza la lógica del visor del Cybertruck (explosión por etapas, selección, ficha, sistemas, árbol, suelo de cristal, entornos);
- el GLB se copia a `spacex/assets/cybertruck/` y se carga en diferido;
- se entra con un botón en `.tools` y la tecla **U** (libre desde que se retiró el Audi Lab);
- tiene una prueba propia en CI y una prueba de contrato del GLB sin navegador.

**Mejoras (sección 8, nueva).** Las de más valor:

- **Oclusión ambiental para el Cybertruck**, que hoy no tiene ninguna: ni horneada (0 de 83 materiales) ni en pantalla.
- **Reflejos locales:** hoy todos los vehículos reflejan solo el cielo y un suelo plano.
- **UV de ruedas y frenos del Cybertruck:** el GLB es el único de los cinco que el validador de Khronos rechaza, con 17 errores.
- **Sombras con penumbra física:** el `shadow.radius` de los dos proyectos no tiene efecto con el tipo de sombra elegido.
- **Aperturas y las seis alturas oficiales de la suspensión en el Lab.**
- **Neumáticos más completos** en el Porsche y la H2R.
- **Caché de texturas** para el arranque, y la **medición en la RTX 3070 del usuario** antes de seguir optimizando.

**Una contradicción documental que hay que resolver antes de empezar:** `cybertruck/traspaso.md` §15.3 y `cybertruck/CLAUDE.md` piden colocar el Cybertruck **«al lado del Model Y»** como expositor. La orden de hoy dice lo contrario: **que no se vea en el entorno principal**. Prevalece la orden de hoy, y esos dos documentos tendrán que actualizarse cuando se implemente.

---

## 2. Método

**Leído entero o en las partes relevantes:**

- `spacex`: `CLAUDE.md`, `TRASPASO.md` (completo), `README.md` (estado, controles, verificación, CI, estructura, rendimiento y despliegue), `package.json`, `.github/workflows/pages.yml`, `src/main.js` (completo), `src/core/viewState.js` (completo), `src/core/layout.js`, `src/core/prefetch.js`, `src/vehicles/modelyAsset.js`, `src/vehicles/lodParts.js`, la cabecera de `src/ui/hud.js`, el bloque del presupuesto de `tools/check.mjs` y `eslint.config.js`. También, del historial: `src/ui/audiLab.js` (en `8e6a633`), el diff de su retirada (`1694867`) y la auditoría del 16-10 que lo revisó.
- `cybertruck`: `CLAUDE.md`, `traspaso.md` (completo), `README.md` (completo), `web/index.html`, `web/src/main.js`, `config.js`, `materials.js` y `lighting.js` (completos), `.github/workflows/pages.yml`, `tools/serve.mjs`, `tools/gen_inventory.mjs`, `blender/scripts/export_web.py` y `build_all.py`, `docs/validation-results.json` y la cabecera de `docs/component-inventory.md`.

**Ejecutado** (todo fuera de los repositorios, salvo `npm ci`, que solo crea `node_modules/`, ignorado por git):

| Prueba | Resultado |
|---|---|
| `spacex`: `npm ci` + `npm run check:static` | **Código 0**: 267 PASS, 0 FAIL |
| `spacex`: `node tools/check.mjs` (escena, con Chromium y SwiftShader) | **Código 0** en la segunda ejecución (la primera falló por plazo con la CPU cargada, §3.3) |
| `spacex`: comparación byte a byte de `vendor/three/**` con `three@0.170.0` de npm | **Idénticos** (todos los archivos) |
| `cybertruck`: análisis del GLB (cabecera, JSON, extensiones, nodos, extras, mallas, materiales) | §10.1 |
| `cybertruck`: manifiesto frente a GLB (1.138 componentes, nombres, etapas, fidelidad) | **0 diferencias** |
| `cybertruck`: visor en Chromium sin interfaz (servidor local, Three.js r170 servido en local en lugar de jsDelivr) | Carga en ≈4 s, **sin errores de consola**; 2.089 mallas y 1,27 M triángulos en escena; explosión reversible (desviación 0 tras 5 ciclos) |
| `cybertruck`: visor con un servidor que comprime con gzip como Pages | **La barra llega a 136 %** (reproducido) |
| Cabeceras de producción (`curl`) | GLB del Cybertruck: `content-encoding: gzip`, `content-length: 9194429`. GLB del Model Y: gzip, 21,1 MB |
| `cybertruck`: `pyflakes` sobre `blender/scripts/` | **0 errores reales**; ≈100 importaciones o variables sin usar |
| Cotas oficiales del Cybertruck en el manual del propietario (espejo `tesla.cn`, página «Dimensions, Weights, and Cargo Capacity») | **Coinciden** con el manifiesto (§10.2) |
| CI y ramas (GitHub) | §3 |
| **(2.ª versión)** Validador oficial de Khronos (`gltf-validator`) sobre los cinco GLB | Cybertruck: **17 errores**; Model Y, Porsche, rótulos del Porsche y H2R: 0 errores (§10.7) |
| **(2.ª versión)** Materiales, mapas, UV2 y resolución de imágenes de los cuatro GLB de coches | §10.7 |
| **(2.ª versión)** Primer plano de la rueda delantera izquierda en el visor del Cybertruck | El neumático llega sin UV (C21); el resto se ve correcto |
| **(2.ª versión)** Lectura del shader de sombras de r170 (`shadowmap_pars_fragment`) | `shadow.radius` no actúa con `PCFSoftShadowMap` (S13, C23) |
| **(2.ª versión)** Tabla completa de alturas de la suspensión en el manual del propietario | §10.2 |
| **(2.ª versión)** `Accept-Encoding: br` contra Pages | Pages no sirve Brotli |

**No se pudo:**

- ~~Ejecutar Blender~~ **Hecho en la 3.ª versión (23-10)**: Blender 5.2.2 sin interfaz instalado en el entorno del agente. Con él se ejecutaron `validate.run()`, la reconstrucción completa (`build_all.run` con todas las partes), `build_explode.verify_roundtrip()`, `interferencias.run()` y `export_web.export(...)` sobre una copia del repositorio. Resultados en §11.3.
- **Medir en GPU real.** Todo se dibuja con SwiftShader: sirve para comparar, no para dar FPS.
- **Medir las llamadas de dibujo del visor del Cybertruck.** La sonda se quedó sin tiempo mientras corría a la vez la prueba de escena de `spacex`. En §4.6 se dan estimaciones marcadas como tales.

---

## 3. Estado verificado

### 3.1 Ramas

- `spacex`: `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo`, `claude/affectionate-euler-o447rh` y `claude/spacex-vehicle-center-3d-48zlkm` están en **`587e49c`**. También lo está `claude/amazing-ramanujan-dj19ea`, que no figura en la lista de `CLAUDE.md` pero recibe los mismos empujes (es la sexta rama de la que habla `TRASPASO.md`).
- `spacex` tiene **11 ramas remotas antiguas** que ya nadie usa: `claude/gifted-bohr…` (04-10), `keen-heisenberg…` (13-10), `new-session…` (27-09), `pensive-ride…`, `project-thread…`, `sleepy-cannon…`, `youthful-noether…`, `codex/fix-camera-state` (11-09), `codex/roadster-visual-quality`, `grok/vehicle-center-visual-pass` (21-09) y `main`. Como el workflow se dispara con `claude/**`, `codex/**` y `grok/**`, un empuje accidental a cualquiera de ellas gasta CI.
- `cybertruck`: `main` = `f021e08`, el árbol limpio. Las ramas `modelo-v3-piezas-faltantes` y `modelo-v4-coche-completo` ya están fusionadas y se pueden borrar (el propio traspaso lo dice).

### 3.2 CI y despliegue

- `spacex`: las seis ejecuciones del commit `587e49c` (17-10, «F-16: fix the dark band…») terminaron en **success**. Pages sirve la versión publicada a las 20:46:30 GMT del 17-10, la del despliegue de ese commit.
- `cybertruck`: la última ejecución, «Versión 4.2», terminó en **success** el 18-10. **El flujo solo despliega: no valida nada** (§5, C10).

### 3.3 Prueba de escena de `spacex` en local

En la primera ejecución pasaron todas las comprobaciones dimensionales, de interfaces, de integridad, de nivel de detalle, de las 73 vistas y de la máquina de estados. **Falló una**: «carga de la aplicación — `page.click('#launch-btn')`: Timeout 30000ms exceeded».

Esa ejecución coincidió con otra prueba de navegador de esta auditoría que competía por la CPU. **Repetida sola, pasa entera (código 0)**; detalle y presupuesto en §10.4.

**Hallazgo independiente del resultado (S5, Medio):** `tools/check.mjs:523` hace `page.click('#launch-btn')` con el plazo por defecto de 30 s, mientras que en la línea 321 el mismo archivo da 120 s a otro clic. El README («Plazos en el runner») explica que un fotograma por software puede tardar segundos y que la prueba de interfaz ya usa 120 s. Este clic quedó fuera de esa corrección y es el punto frágil.

---

## 4. La integración del Cybertruck en spacex

### 4.1 Requisitos

Lo que pide el usuario:

1. El Cybertruck **no aparece en el entorno principal**: ni en la explanada, ni en la fila, ni en el plano, ni en la visita guiada.
2. **Un botón** propio para él.
3. El botón lleva a un **espacio aparte** que funciona **como el visor de `cybertruck`**: vista explosionada por etapas, selección de piezas con ficha, sistemas, árbol de componentes, suelo de cristal, cámaras predefinidas y una forma clara de **volver**.

Lo que imponen los repositorios:

- `spacex`: sin CDN; escala 1:1; solo medidas verificables, con las aproximaciones marcadas; interfaz en inglés; `check:static` antes de cada commit; el `check` completo al cerrar el bloque; empujar a las cinco ramas (más la de la sesión); README en español actualizado con cada cambio; no regenerar la galería sin aprobación.
- `cybertruck`: el GLB y el manifiesto los genera Blender (`export_web.py`). No se inventan datos.

### 4.2 Contradicción con la hoja de ruta escrita

`cybertruck/traspaso.md` §15.3 («Qué se pide: 1. Colocar el Cybertruck al lado del Model Y, como expositor de la simulación») y `cybertruck/CLAUDE.md` («integrar el Cybertruck en la simulación junto al Tesla Model Y») chocan con la orden de hoy. **Prevalece la de hoy.** Eso libera de dos de las tareas de §15.3: el nivel de detalle exterior para la exposición y el presupuesto de la escena principal.

### 4.3 El precedente: el Audi Lab y sus lecciones

Cómo funcionaba (`git show 8e6a633:src/ui/audiLab.js`, 526 líneas):

- Tenía su propia escena, cámara (`PerspectiveCamera` de 36°), `OrbitControls` sobre un **elemento propio superpuesto** (`.al-stage`, de modo que los eventos no llegaban al canvas de la simulación) y su propio `EffectComposer` (render pass y output pass). Su mapa de entorno de estudio se generaba con PMREM.
- `main.js` lo creaba con `createAudiLab({ renderer, onExit })`. En `frame()`, mientras el Lab estaba abierto, se dibujaba el Lab y se saltaba el resto.
- Al cerrarlo: `clock.getDelta()` (descarta el salto de tiempo) y se devuelve el foco al botón.
- No se abría con una secuencia en marcha (lanzamiento, reentrada, vuelo, conducción o moto).
- Teclado en fase de captura con `stopPropagation`, de modo que G, F, V… no llegaban a la simulación. **Esc** cerraba.
- Guardaba y restauraba `toneMappingExposure` y `shadowMap.autoUpdate`.

Lecciones de la auditoría del 16-10 que se repiten en el Cybertruck:

| Lección | Cómo aplica al Cybertruck |
|---|---|
| **Descarga doble con gzip** (`Content-Length` comprimido; el código volvía a pedir el archivo entero) | El visor del Cybertruck tiene la variante «barra > 100 %» (I4). No reutilizar ninguno de los dos patrones: progreso por bytes recibidos sin porcentaje, o un total conocido de antemano (el tamaño del GLB escrito en un JSON generado al copiarlo). |
| El modelo no se liberaba al cerrar | Decidir de forma explícita: conservarlo (reabrir al instante, ≈1,2 M triángulos y ≈71 texturas en memoria) o liberarlo (§4.6). |
| Sombras de 4096² y MSAA ×4 fijos, sin seguir `core/quality.js` | El visor del Cybertruck también decide por su cuenta (`HIGH_END`). En `spacex` debe seguir el nivel de calidad. |
| Su prueba (`audi-lab-check.mjs`) no estaba en CI y agotaba el tiempo en el primer clic | La prueba del Cybertruck debe entrar en CI con plazos de 120 s y, si hace falta, en un trabajo propio. |
| Falta de documentación en `TRASPASO.md` y `CLAUDE.md` | Documentar en los tres documentos y en los dos repositorios. |
| Prueba de contrato del activo (el `hinge` del Audi) | Contrato del GLB del Cybertruck: extras `system`, `explode_*`, `fidelity`, `label_es`, padres sin rotación, nombres únicos (§4.8). |

### 4.4 Opciones de arquitectura

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Lab en la misma página (recomendada)** | Módulo `src/ui/cybertruckLab.js` con escena, cámara, controles y compositor propios, que dibuja con el renderer de `spacex`; el bucle principal se pausa | Probada con el Audi; un solo contexto WebGL; volver es instantáneo y la simulación conserva su estado; fuera del presupuesto de la escena principal | Hay que portar el código del visor a la arquitectura de `spacex` y gestionar el estado compartido del renderer (§4.5) |
| B. `iframe` superpuesto con el visor | Copiar `cybertruck/web/` a `spacex/labs/cybertruck/` y abrirlo en un `iframe` a pantalla completa | Reutiliza el visor casi sin cambios | Un segundo contexto WebGL (más memoria de GPU junto a la escena principal, que ya ronda ≈0,5 GB de texturas según la auditoría del 16-10); un segundo Three.js; foco y teclado entre documentos; las pruebas de `spacex` no ven dentro; dos HUD de estilos distintos |
| C. Página aparte enlazada | Botón que navega a `labs/cybertruck/` o a `alvarodesigns34.github.io/cybertruck/` | Lo más sencillo | Al volver se recarga toda la simulación (30–60 s de arranque medidos en el README); se pierde el estado. No cumple «una forma clara de volver» con buena experiencia |

**Recomendación: A**, portando el código del visor en lugar de reescribirlo. La lógica de explosión (`applyExplode`, `STAGE_WINDOWS`, `b2g`), los ajustes de materiales (`materials.js`), los entornos (`lighting.js`), la selección y el árbol se trasladan casi literalmente. Cambian la gestión del renderer, el teclado y el DOM.

### 4.5 Diseño detallado de la opción A

**Archivos nuevos** (propuesta):

- `src/ui/cybertruckLab.js`: escena, cámara, controles, compositor, carga, explosión, selección y DOM.
- `src/data/cybertruck.js`: ficha con procedencia (las cotas del manual, grado A: §10.2), las etiquetas de los sistemas y las etapas, y las vistas de cámara, en el estilo de `data/h2r.js` y `data/gt3rs.js`.
- `assets/cybertruck/cybertruck.glb` (12,48 MB; 9,19 MB con gzip) y, si se quieren los textos o los recuentos, el manifiesto (493 KB; 46 KB con gzip).
- `vendor/three/examples/jsm/loaders/DRACOLoader.js`, `vendor/three/examples/jsm/libs/draco/gltf/` (`draco_decoder.wasm`, `draco_wasm_wrapper.js` y `draco_decoder.js` como respaldo sin WebAssembly; `draco_encoder.js` no hace falta) y `vendor/three/examples/jsm/objects/Reflector.js`, todos de `three@0.170.0`.
- `tools/cybertruck-lab-check.mjs` (con navegador) y una comprobación de contrato del GLB sin navegador, dentro de `check:static`.

**Estado del renderer que hay que guardar y restaurar.** En `spacex` el renderer es `ACESFilmic` con exposición 0,7, `PCFSoftShadowMap`, `SRGBColorSpace`, y `shadowMap.autoUpdate = false` lo gestiona `core/shadowCache.js`. El visor del Cybertruck usa `AgX` con exposición 1,0 (0,72 en «Exterior»).

- **Al abrir:** guardar `toneMapping`, `toneMappingExposure`, `shadowMap.autoUpdate`, `info.autoReset` (lo cambia `?perf`) y el render target activo. Fijar `AgX` (para que el aspecto coincida con los renders de Blender y con el visor publicado) y pedir `shadowMap.needsUpdate = true` solo cuando cambie la explosión, la luz o la visibilidad (dibujo bajo demanda, como hacía el Audi con `dirty` y `shadowDirty`).
- **Al cerrar:** restaurar todo lo anterior; llamar a `shadowCache.invalidate()` y a `gbufferCache?.invalidate()` (si la ventana cambió de tamaño con el Lab abierto, las cachés y el compositor de la simulación tienen que rehacerse); `clock.getDelta()` y `missionClock.discard()`, para que el tiempo pasado en el Lab no avance ninguna simulación; `rig.keys.clear()` y `rig.velocity.set(0, 0, 0)` también al abrir, como hacía el Audi.
- **Tamaño:** el `resize` de `main.js` sigue escuchando con el Lab abierto. El Lab debe redimensionar su compositor y su `Reflector` (`refl.resize`) en su propio manejador.

**Entrada:**

- `OrbitControls` sobre un elemento superpuesto propio, no sobre `#scene`. Si no, se disparan `claimUserControl()`, el doble clic de centrado y `rig.takeOver()` de la simulación.
- Teclado en fase de captura con `stopPropagation`. Si no, el manejador global de `main.js` recibe **G** (lanzamiento), **J**, **B**, **N**, **F**, **V**, **P**, **L**, **R**, **T**, **H** y los dígitos. El visor del Cybertruck usa **R** (restablecer vista), **espacio** (animar) y **Esc**; dentro del Lab no deben llegar a la simulación.
- **Esc**: si hay una pieza seleccionada o aislada, la libera; si no, cierra el Lab (patrón del Audi).

**Estado de la aplicación:**

- **No añadir el Cybertruck a `VEHICLES`** (`src/data/specs.js`). El bucle de `main.js` construye en la escena principal todo lo que esté en esa lista, y además lo usan el carril de vehículos, el plano, las teclas 1–9, `?vehicle=`, `provenance-check` y `verify.js`. El Lab va aparte, como el Audi.
- Los dígitos 1–9 ya solo alcanzan los nueve primeros de doce expositores, así que dejar el Cybertruck fuera de la lista no empeora nada.
- Abrir el Lab con una secuencia en marcha: el Audi lo ignoraba sin decir nada. Es mejor **terminar la secuencia** (`launch.reset(false)` y equivalentes, como hace `enforce`) o mostrar un aviso (`hud.notice`) que explique por qué no se abre.
- Valorar un campo en `ViewState` (por ejemplo `lab: 'cybertruck' | null`). El Audi Lab vivía fuera de la máquina de estados, y el propio `viewState.js` documenta que los fallos caros del proyecto salieron de banderas sueltas. Así la visita guiada, el lanzamiento y el «vuelo» tendrían una regla única al abrir o cerrar el Lab.

**HUD:**

- Botón en `.tools`, junto a «H2R · Ride», con el mismo patrón: `<button class="tool tool-btn" id="cybertruck-btn" title="Cybertruck Lab: the Tesla Cybertruck Cyberbeast on its own, with a staged exploded view of its 1,138 parts (U)">Cybertruck · Lab <kbd>U</kbd></button>`. Sería el elemento número 14 de esa barra: hay que comprobar con `ux-check` que no se solapa en los tamaños de escritorio que la prueba recorre (por debajo de ≈1300 px de ancho la barra ya va justa).
- Botón «← Back» (o «← Volver») visible siempre en el Lab, que devuelve el foco a `#cybertruck-btn` al cerrar.
- La guía rápida (`#help`) necesita una tarjeta para el Lab.

**Carga:**

- **No** añadir el GLB a `prefetch()` al arrancar: la orden es que no esté en el entorno principal, y la descarga anticipada retendría 12,5 MB en memoria para todos los visitantes. Se pide al abrir el Lab por primera vez. Opcionalmente, cuando el ratón pasa por encima del botón.
- Progreso: bytes recibidos («4.1 MB…»), o un porcentaje sobre un total fijado al copiar el GLB. Nunca `Content-Length` sin comprimir (I4) ni una segunda petición.
- `DRACOLoader` con `setDecoderPath` relativo (`new URL('../../vendor/three/examples/jsm/libs/draco/gltf/', import.meta.url)`) y `draco.dispose()` tras la carga, como ya hace el visor.
- Cargar el manifiesto solo si se usa. Hoy el visor lo descarga **y no lo usa** (C3). Los extras del GLB llevan ya todo lo que la interfaz muestra.

**Calidad (`core/quality.js`):**

- Tamaño del mapa de sombras, MSAA, densidad de píxeles y reflejo plano según el nivel (`high`, `medium`, `low`).
- El `Reflector` vuelve a dibujar el modelo entero (≈2.040 mallas): encendido solo en «high».
- El visor actual lo enciende con `(pointer: fine) && innerWidth >= 1100`, otro criterio.

**Materiales:**

- `transmission` en 5 materiales de vidrio y lentes (`CT_Glass_*`, `CT_Lens_*`). En `spacex` se retiró `transmission` de la escena principal porque obliga a dibujar otra vez todo lo opaco en cada fotograma (README, «Paso de transmisión»). **Dentro del Lab** es aceptable (es lo que da el aspecto del visor publicado), pero conviene medirlo. Una alternativa es el vidrio translúcido de `modelyAsset.js` (`transparent`, `opacity`, `depthWrite: false`).
- `KHR_materials_anisotropy` en 7 materiales y `export_tangents=False`: el Audi tuvo que apagar la anisotropía en las mallas sin UV porque salían negras. El visor del Cybertruck no muestra el fallo, pero conviene mantener la comprobación del Audi (`m.anisotropy > 0 && !geometry.attributes.uv`).
- Los 83 materiales son `doubleSided`, el valor por defecto del exportador de Blender. Duplica el coste de fragmentos y de sombras de las caras traseras. Se puede corregir en Blender (ocultación de caras traseras en los materiales de mallas cerradas) o en la carga, por material.

### 4.6 Rendimiento del Lab (estimaciones, sin medir en GPU)

- Escena: 2.038 primitivas del GLB (2.089 mallas en total contando suelo, rejilla y reflejo), 1,18 M triángulos.
- Llamadas de dibujo por fotograma: **≈2.000 en la pasada de color, más una pasada de sombras de tamaño parecido y, con el reflejo, otra más: del orden de 4.000–6.000** (estimación; no se pudo medir aquí). La escena principal de `spacex`, quieta, hace 620 tras la ronda de rendimiento del 17-10.
- Mejoras, de menor a mayor esfuerzo:
  1. **Dibujo bajo demanda**: solo cuando cambian la cámara, la explosión, la selección, la visibilidad o el entorno. El Audi ya lo hacía con `dirty`. Con el modelo quieto, el coste en reposo es cero.
  2. **Sombras en caché**: el mapa se rehace solo al cambiar la explosión o la luz.
  3. **Reflejo plano** solo en calidad alta.
  4. **`lodParts.markSmallParts`** no sirve aquí (es para la distancia de la escena principal; en el Lab la cámara está siempre cerca).
  5. **`BatchedMesh` por material** (r170 la admite con matrices y colores por instancia): pasaría de ≈2.000 a ≈83 llamadas manteniendo la explosión (matriz por pieza) y el resaltado (color por pieza). Es un cambio grande en la selección y el árbol. Solo si la medida en hardware real lo justifica.
- Memoria: 37 imágenes WebP (2,8 MB comprimidas; descomprimidas en GPU, del orden de decenas de MB) y ≈1,5 M vértices. **Decisión del usuario:** conservar el modelo al cerrar (reabrir al instante) o liberarlo (`geometry.dispose()` y texturas; reabrir cuesta volver a analizarlo, aunque el navegador tenga el archivo en caché 10 minutos, `max-age=600`).

### 4.7 Origen del GLB y sincronización

| Opción | A favor | En contra |
|---|---|---|
| **Copiar el GLB a `spacex/assets/cybertruck/` (recomendada)** | CI y local deterministas; sin dependencias entre despliegues | Dos copias que pueden divergir |
| Cargarlo en ejecución desde `/cybertruck/models/cybertruck.glb` (mismo origen: las dos webs están en `alvarodesigns34.github.io`, sin CORS) | Una sola fuente | El CI de `spacex` dependería de la red y de otro despliegue; un cambio en `cybertruck` podría romper `spacex` sin que su CI lo vea |

Con la copia, añadir una herramienta (por ejemplo `tools/cybertruck-sync.mjs`) que:

- copie el GLB desde la carpeta hermana `../cybertruck/web/models/`;
- anote su SHA-256, su tamaño y el commit de origen;
- haga comprobar a la prueba de contrato que el archivo coincide con lo anotado.

Así se sabe siempre de qué versión del Cybertruck viene la copia.

### 4.8 Pruebas que habría que añadir

**Sin navegador** (en `check:static`), contrato del GLB:

- `extensionsRequired` ⊆ {Draco, `KHR_texture_transform`, `EXT_texture_webp`}, y el decodificador incluido en `vendor`;
- 1.138 nodos con `system`, `explode_stage` ∈ 1…6, `explode_dir` unitario y no nulo, `explode_dist` > 0, `fidelity` ∈ {V, R, A} y `label_es`;
- nombres únicos;
- padres con hijos sin rotación (la regla de `cybertruck/CLAUDE.md`; hoy se cumple: los 25 nodos con rotación son hojas: pinzas, discos, ruedas y la matrícula);
- el tamaño y el SHA-256 coinciden con los anotados.

**Con navegador** (`tools/cybertruck-lab-check.mjs`, en CI con plazos de 120 s):

- antes de abrir, el GLB no se ha pedido;
- se abre con el botón y con **U**;
- cero errores de consola;
- 1.138 componentes;
- explosión 0 → 1 → 0,37 → 0 con desviación 0;
- seleccionar una pieza muestra su ficha;
- **Esc** vuelve;
- al volver, la simulación queda igual: `viewState()` idéntico, cámara en la misma posición y el render de la escena principal byte a byte igual al de antes de abrir (con el enfoque de `render-cache-equal.mjs`);
- los techos de `check.mjs` no cambian aunque el Lab se haya abierto antes. Ojo: `textures` se lee de `renderer.info.memory.textures`, que es de todo el renderer; si la prueba del Lab corre antes del presupuesto en el mismo navegador, las texturas del Lab cuentan;
- con un servidor que comprima (gzip y `Content-Length` comprimido): una sola petición del GLB y progreso ≤ 100 %.

### 4.9 Datos y procedencia

- Cotas del manual del propietario (grado A, comprobadas en esta auditoría, §10.2): longitud 5.682,9 mm; anchura con espejos 2.413,3 mm, con espejos plegados 2.200,7 mm y sin espejos 2.031,6 mm; altura en «Medium» 1.793,8 mm; batalla 3.635,0 mm; voladizos de 878,3 y 1.169,6 mm; altura libre en «Medium» 257,0 mm.
- Si la ficha del Lab muestra cifras, deberían ir en `src/data/figures.js` con grado y fuente, para que `provenance-check` las vigile. Hoy esa comprobación solo recorre `VEHICLES` y la tabla del README. Si el Cybertruck se añade a esa tabla, necesita su fila en `figures.js`.
- Las etiquetas de fidelidad del GLB (Verificado 20, Reconstruido 881, Aproximado 237) son el equivalente de los grados de `spacex`. La ficha del Lab debe mostrarlas, como ya hace el visor, para no presentar como medida lo que es reconstrucción.
- La discrepancia conocida de la anchura sin espejos (modelo 2.081,7 mm frente a 2.031,6 mm oficial; documentada en `cybertruck`) debe figurar en las aproximaciones de la ficha.

### 4.10 Plan por fases (para cuando el usuario lo pida)

1. **Activos:** traer `DRACOLoader`, el decodificador y `Reflector` de r170 a `vendor/`, comprobados byte a byte; copiar el GLB con la herramienta de sincronización; añadir la prueba de contrato. Pasar `check:static`.
2. **Lab mínimo:** escena, cámara, controles, carga diferida con progreso correcto, entorno de estudio, botón y tecla, volver; guardado y restauración del renderer; teclado en captura. Prueba con navegador.
3. **Funciones del visor:** explosión por etapas con máscaras, amplitud, animación, ensamblar; selección, ficha, aislar, ocultar y encuadrar; sistemas y árbol con búsqueda; suelo de cristal, opaco u oculto; entornos «Estudio» y «Exterior»; reflejo según la calidad.
4. **Calidad y rendimiento:** dibujo bajo demanda, sombras en caché, niveles de calidad; medir con `?perf` en el hardware del usuario.
5. **Documentación:** README (estado, controles, estructura, la sección de despliegue con los activos nuevos), `TRASPASO.md` («Estado actual»), `CLAUDE.md` de `spacex` (la existencia del Lab y la herramienta de sincronización), y `traspaso.md`, `README.md` y `CLAUDE.md` de `cybertruck` (§15.3 ya hecho, el cambio de criterio sobre «junto al Model Y»).
6. **Cierre:** `npm run check` completo, empujar a las ramas y comprobar el CI y Pages.

---

## 5. Hallazgos en `cybertruck`

| Id | Gravedad | Hallazgo | Evidencia |
|---|---|---|---|
| C1 | **Alto** | La barra de carga supera el 100 % en producción (136 %): con gzip, `ev.total` es el tamaño comprimido. | `web/src/main.js:487–492`; FileLoader de r170 lee `Content-Length`; reproducido con un servidor que comprime; `curl` confirma `content-encoding: gzip` y 9.194.429 B |
| C2 | **Alto** (riesgo) | Dependencia de CDN: Three.js, `DRACOLoader`, el decodificador Draco, `Reflector` (jsDelivr) y la tipografía JetBrains Mono (Google Fonts). Si jsDelivr no responde o está bloqueado (redes corporativas), el visor no arranca. `spacex` ya sufrió y corrigió algo parecido con las tipografías. | `web/index.html:13–20`, `web/src/config.js` (`DRACO_URL`) |
| C3 | Medio | El manifiesto se descarga **antes** que el GLB y en serie (`await fetch(MANIFEST_URL)` y después `loadAsync`): suma un viaje de red al arranque. Además **no se usa**: `buildUI(manifest)` no lee su parámetro. | `main.js:483–486`, `364`, `527` |
| C4 | Medio (probable, no reproducido) | `pagehide` libera el renderer, las geometrías y las texturas. Si el navegador guarda la página en la caché de ida y vuelta (bfcache) y el usuario vuelve con «Atrás», la página vuelve sin bucle ni recursos (lienzo negro). Habría que usar `pagehide` solo si `!event.persisted`, o reconstruir en `pageshow`. | `main.js:683–696` |
| C5 | Medio | Documentación con cifras desfasadas entre sí: README «1.137 objetos» y «12,0 MB» (líneas 28, 81, 181 y 201) frente a 1.139 objetos y 12,5 MB reales; `CLAUDE.md` dice «`Cybertruck.blend` de 16,5 MB» (línea 59) y «16,2 MB» (línea 84) en el mismo archivo (real: 16,2 MB); `CLAUDE.md` y `docs/model-specification.md` dicen «78 materiales» y el GLB tiene **83**; `traspaso.md` §2 sigue con la tabla de la versión 3 y §3 dice «aún sin empezar» de una hoja de ruta ya terminada (la nota de cabecera lo advierte solo en parte). | `grep` de cifras en los cinco documentos (§10.3) |
| C6 | Medio | `traspaso.md` §15.3 y `CLAUDE.md` piden el Cybertruck «junto al Model Y», en contra de la orden del 20-10. | §4.2 |
| C7 | Bajo | El servidor local comprueba la contención con `file.startsWith(root)`: una carpeta hermana con el mismo prefijo (`web2/` junto a `web/`) pasa la comprobación. Solo afecta a desarrollo local. `spacex/tools/serve.mjs` lo resolvió y tiene 12 pruebas de rutas. | `tools/serve.mjs:18–19` |
| C8 | Bajo | `innerHTML` con texto del modelo sin escapar (`title="${obj.name}"`, `label_es`, la línea de estado). Los datos son propios, así que no es explotable hoy, pero una comilla en una etiqueta rompería el HTML. Al portarlo a `spacex`, usar `textContent`. | `main.js:197–201`, `397`, `404`, `411–414` |
| C9 | Bajo | Accesibilidad: `#tree` declara `role="tree"` sin `treeitem` ni navegación por flechas; las pestañas (`role="tab"`) no se recorren con flechas. | `web/index.html`, `buildUI` |
| C10 | Medio | **El CI solo despliega**: no hay lint, ni comprobación del GLB, ni prueba del visor. Una exportación con un extra perdido o un error de JavaScript llega a producción sin aviso. | `.github/workflows/pages.yml` |
| C11 | Bajo | `isolate()` no actualiza los chips de sistema, y la etapa de cada pieza en el árbol no se refleja al ocultar por sistema. Son estados de interfaz que se desincronizan. | `main.js:441–474` |
| C12 | Bajo | Resaltar una pieza clona su material por malla. En conjuntos grandes provoca recompilaciones de shaders (un tirón al seleccionar). Se puede usar un material de resaltado compartido por material de origen. | `main.js:251–267` |
| C13 | Bajo | `materials.js` genera el rayado de respaldo con `Math.random()` (no determinista). Hoy no se usa, porque el GLB trae el mapa de rugosidad. | `materials.js:9–33` |
| C14 | Info | Etapas muy desequilibradas: la 6 («Piezas pequeñas») tiene 722 de 1.139 nodos, frente a 54–115 de las demás. Al animar, la última ventana (60–100 %) mueve dos tercios del modelo. | Análisis del GLB |
| C15 | Info | Con la explosión al 100 % y la amplitud por defecto de 1,5×, **124 piezas** quedan enteras por debajo del suelo (y < 0). Es la razón del suelo de cristal; el Lab de `spacex` debe heredar esa solución (cristal u oculto), no un suelo opaco. | Medido en el navegador |
| C16 | Info | `export_web.py` escribe `faces` con los polígonos **antes** de aplicar los modificadores (el inventario lo dice: «Caras de malla base»). Correcto, pero no son los triángulos reales del GLB (1,18 M). | `export_web.py` |
| C17 | Info | `pyflakes`: 0 errores; ≈100 importaciones o variables sin usar (en `ct_v4.py` pueden ser reexportaciones intencionadas de `ct_v3`). | §2 |
| C18 | Info | Neumático a z = −2,2 mm (ligera penetración en el suelo, `z_minimo_neumatico`). Es coherente con la huella de un neumático cargado, pero no está documentado como decisión. | `docs/validation-results.json` |
| C19 | Medio | Peso del historial: `.git` ocupa 87 MB para un árbol de 36 MB. Cada exportación añade ≈12,5 MB de GLB y ≈16 MB de `.blend`. Sin Git LFS el clon crece con cada versión. | `du` |
| C20 | Bajo | Las etiquetas de los sistemas están duplicadas en `web/src/config.js` y en `tools/gen_inventory.mjs`: dos fuentes que pueden divergir. | Ambos archivos |
| C21 | **Medio-Alto** | **El GLB no es válido según el validador oficial de Khronos: 17 errores.** Todos son `texCoord: -1` en 9 materiales duplicados que usan 27 primitivas sin UV (neumático, discos, pinzas, pastillas, bujes, protectores, tapacubos, tuercas y válvula). En la web esas piezas pierden sus texturas de goma, mecanizado y zincado, que los renders de Blender sí muestran. Los otros cuatro GLB del proyecto (Model Y, Porsche, rótulos del Porsche y H2R) dan **0 errores**. | `gltf-validator` (npm); comprobado en el navegador: `MESH_Tire_285_65R20` sin atributo `uv`, con `map`, `normalMap` y `roughnessMap` (§8.2, M-CT2) |
| C22 | Medio | El GLB trae los pivotes de puertas, frunk, portón y ruedas (`pivot_es`), pero el visor no los usa: no hay aperturas. | Extras de `DOOR_*`, `EXT_Frunk_Lid`, `EXT_Tailgate` y `WHEEL_*` (§8.2, M-CT4) |
| C23 | Bajo | `key.shadow.radius = 3` no tiene efecto: en r170, con `PCFSoftShadowMap`, el radio se ignora en las luces direccionales. | `main.js:51`; `shadowmap_pars_fragment` de r170 (§8.1, M-IMG2) |
| C24 | Bajo | 24 mallas del GLB conservan el nombre del bloque de datos temporal `_tmp_isl.NNN` que crea `build_montaje.py:267–275` al separar islas (por ejemplo, los nodos `BODY_DoorRing_L/R`, `CARGO_Bed_Side_Wall_*`, `INT_Trim_APillar_*` y `INT_SteeringWheel_Hub`). Los nodos sí tienen su nombre correcto y el visor usa el del nodo, así que no se ve; pero confunde a cualquier herramienta que busque por nombre de malla. Basta con renombrar la malla resultante con el nombre de su objeto. | Análisis del GLB; `build_montaje.py` |

**Lo que está bien** (para no tocarlo):

- Explosión como función pura del parámetro (verificado: desviación 0).
- Manifiesto y GLB consistentes (0 diferencias en 1.138 componentes).
- Nombres únicos.
- Padres sin rotación.
- Cotas fieles al manual (verificado).
- Fidelidad etiquetada en cada pieza.
- Las preferencias en `localStorage`, envueltas en `try/catch`.
- Movimiento reducido respetado.
- Liberación del cargador Draco tras usarlo.

---

## 6. Hallazgos en `spacex`

| Id | Gravedad | Hallazgo | Evidencia |
|---|---|---|---|
| S1 | **Crítico** para la integración | Faltan `DRACOLoader.js`, `libs/draco/gltf/` y `Reflector.js` en `vendor/three`. | `git ls-files vendor/` |
| S2 | Medio | El comentario del presupuesto dice «reports, does not gate» y el bloque **sí falla** el CI (`report(over.length === 0, …)`). Fue lo que dejó sin desplegar el commit del Model Y (`8728971`). El comentario engaña a quien lo lea antes de añadir un activo. | `tools/check.mjs:850–912` |
| S3 | Medio | `renderer.info.memory.textures` cuenta las texturas de **todo el renderer**, no solo las de la escena principal. Cualquier espacio aparte que comparta renderer (como el Lab) puede inflar el recuento según el orden de las pruebas. | `tools/check.mjs:880` |
| S4 | Medio | Documentación con estados contradictorios. **README:** «Estado actual» dice «La H2R se modela en Blender (el resto, por código)», mientras la línea 26 dice que H2R, Model Y y Porsche salen de `.glb`; la línea 3 (introducción) no menciona el Model Y aunque la tabla sí; «Estructura» no lista muchos módulos que existen (`sim/f16Fly.js`, `f16Flight.js`, `gt3Car.js`, `gt3Drive.js`, `reentry.js`, `reentryFlight.js`, `vehicles/modelyAsset.js`, `gt3Cabin.js`, `ui/f16Hud.js`, `ui/gt3Hud.js`…). **`TRASPASO.md`** §1: «ocho expositores, teclas 1–8» y la «Estructura del código» de entonces (hoy son doce y las teclas llegan a 9). **`CLAUDE.md`** habla de cinco ramas y «la de la sesión»; en la práctica se empuja también a `claude/amazing-ramanujan-dj19ea`. | Lectura y `grep` |
| S5 | Medio | Prueba frágil: `page.click('#launch-btn')` con el plazo por defecto de 30 s, frente a los 120 s que el propio archivo da a otros clics. En local, con la CPU cargada, falló justo ahí. | `tools/check.mjs:523`; §3.3 |
| S6 | Bajo | `tools/serve.mjs` no tiene tipo MIME para `.wasm` ni `.webp`. `DRACOLoader` lee el `.wasm` como `arraybuffer` y no lo necesita, pero conviene añadirlo al incorporar Draco. | `tools/serve.mjs:12` |
| S7 | Bajo | El despliegue copia `docs/` entero (18 MB: capturas, diagnósticos) al sitio publicado. No lo descarga ningún visitante, pero hace más pesado el artefacto de cada despliegue. | `.github/workflows/pages.yml` |
| S8 | Bajo | El CI instala Chromium (`npx playwright install --with-deps chromium`) en cada uno de los cuatro trabajos con navegador y en cada empuje (seis ramas por commit), sin caché. Cuesta minutos de ejecución por commit. | Mismo archivo |
| S9 | Bajo | Partículas del Porsche con `Math.random()` (salpicaduras y polvo): no deterministas. No afecta a las pruebas actuales, pero sí a la reproducibilidad de las capturas con `play`. | `src/sim/gt3Drive.js:110–471` |
| S10 | Info | Archivos grandes (`roadster.js` con 3.732 líneas, `gt3rs.js`, `launch.js`, `plume.js`, `main.js`): ya reconocido en `TRASPASO.md` como pendiente a decisión del usuario. | `wc -l` |
| S11 | Info | 11 ramas remotas antiguas que dispararían CI si se empujara a ellas por error (§3.1). | `git branch -r` |
| S13 | Bajo | `sun.shadow.radius = 1.25` no tiene efecto con `PCFSoftShadowMap` en r170 (el núcleo es fijo); quien ajuste las sombras con ese valor no verá cambios. | `src/core/environment.js:228` (§8.1, M-IMG2) |
| S14 | Medio | `settleLabels()` alterna escrituras y lecturas de maquetación por etiqueta en cada fotograma: con etiquetas desplazadas, cada lectura fuerza un recálculo de la maquetación. | `src/main.js:1398–1437` (§8.5, M-FL1) |
| S12 | Info | Galería de capturas desfasada (sin H2R, Model Y ni el Porsche de Blender). Regenerarla necesita aprobación del usuario: no se ha tocado. | `TRASPASO.md`, README |

**Lo que está bien:**

- `check:static` verde en local, con controles negativos (sabotajes) que fallan cuando deben.
- Three.js vendorizado idéntico al oficial.
- Máquina de estados de la vista bien documentada.
- Precarga sin descargas dobles (`prefetch.js` usa `arrayBuffer()`).
- Cachés de sombras y del buffer geométrico con prueba de igualdad byte a byte.
- Procedencia de las cifras con grados y tolerancias.
- Recuperación del contexto WebGL.
- Teclas protegidas contra la autorrepetición y los modificadores.

---

## 7. Correcciones prioritarias

**Para la integración** (por orden):

1. Incorporar Draco y `Reflector` r170 a `vendor/`, comprobados byte a byte (I1, I2, S1).
2. Construir el Lab con escena propia sobre el patrón del Audi (§4.5), sin entrar en `VEHICLES` ni en `prefetch`.
3. Progreso de carga correcto con gzip y una sola petición (I4, C1).
4. Pruebas de contrato y de Lab en CI, con plazos de 120 s (§4.8).
5. Dibujo bajo demanda y calidad según `quality.js` (§4.6).
6. Documentar en los dos repositorios (§4.10, paso 5).

**Para `cybertruck`:**

1. Un paso de validación en CI antes de desplegar: comprobación del GLB sin navegador y, si se quiere, una prueba de humo con Playwright (C10).
2. Corregir la barra de progreso (C1) y llevar Three.js, Draco y la tipografía al repositorio, como `spacex` (C2).
3. Cargar el manifiesto en paralelo o no cargarlo (C3); `pagehide` con `persisted` (C4).
4. Poner al día las cifras de los documentos (C5) y la §15.3 (C6).
5. Considerar Git LFS para `.blend` y `.glb` (C19).
6. Validar también la anchura con espejos plegados (2.200,7 mm, publicada y comprobada), que `validate.py` no mide hoy.

**Para `spacex`:**

1. Arreglar el comentario del presupuesto (S2) y decidir si `textures` debe contar solo la escena (S3).
2. Plazo de 120 s en el clic de `#launch-btn` (S5).
3. Poner al día el README y `TRASPASO.md` (S4), y la lista de ramas de `CLAUDE.md` (S4, S11).
4. Caché de los navegadores de Playwright en CI y no publicar `docs/` (S7, S8).
5. Borrar o archivar las ramas antiguas, con permiso del usuario (S11).

---

## 8. Mejoras de los modelos y de la simulación

### 8.0 Criterios

Cada mejora respeta las reglas de los dos repositorios:

- escala 1:1, solo medidas verificables y lo aproximado marcado con ≈;
- sin plataformas extra, sin modo noche, sin plantas ni objetos nuevos en el entorno;
- sin el regulador de calidad adaptativo (descartado por el usuario), sin stencil ni textura de profundidad en el render target con MSAA (`TRASPASO.md`, «No hacer»);
- «fluidez sin bajar la calidad»: una optimización solo vale si la imagen no cambia, comprobado byte a byte o con un umbral de píxeles, como ya hacen `render-cache-equal.mjs` y `lod-parts.mjs`.

Formato de cada mejora: **qué** · **por qué** (la evidencia en el código o los activos) · **impacto** (Alto, Medio o Bajo en lo que se ve o se siente) · **coste** (S: horas; M: una sesión; L: varias sesiones) · **cómo se comprueba**.

**Las diez de más valor, en orden:**

| # | Mejora | Repositorio | Impacto | Coste |
|---|---|---|---|---|
| 1 | Oclusión ambiental para el Cybertruck: horneada por pieza y en pantalla en el visor (M-CT1) | cybertruck | Alto | M |
| 2 | Reflejos locales: sondas cúbicas por zona, para que la pintura y el acero reflejen lo que tienen alrededor (M-IMG1) | spacex (y el Lab) | Alto | M |
| 3 | UV de ruedas y frenos del Cybertruck, para que lleguen a la web las texturas que hoy se pierden (M-CT2, C21) | cybertruck | Medio-Alto | S |
| 4 | Sombras con penumbra física (PCSS, el tamaño angular del Sol) (M-IMG2) | ambos | Alto | M |
| 5 | Lab del Cybertruck con aperturas (puertas, frunk, portón) y las seis alturas oficiales de la suspensión (M-CT4) | spacex | Alto | M |
| 6 | Materiales de la fase 3 de la H2R y pasada en Blender del Roadster y Starman (M-V3, M-V5) | spacex | Alto | L |
| 7 | Neumáticos del Porsche con fuerzas longitudinal y lateral separadas, caída, temperatura y par autoalineante (M-DIN1) | spacex | Alto (conducción) | M |
| 8 | Neumáticos de la H2R por ángulo de deriva y empuje por caída (M-DIN2) | spacex | Alto (pilotaje) | M |
| 9 | Caché de las texturas procedurales entre visitas (M-FL2) | spacex | Alto (arranque) | S |
| 10 | Medir en el hardware del usuario (RTX 3070) con `?perf` antes de cualquier otra optimización de GPU (M-FL8) | spacex | Habilita todo lo demás | S |

### 8.1 Imagen: mejoras transversales de iluminación y materiales

**M-IMG1. Reflejos locales con sondas cúbicas por zona** · Impacto Alto · Coste M

- **Por qué.** El mapa de reflejos de toda la escena es una sola sonda PMREM generada a partir de `envScene`, que contiene **solo el cielo y un suelo de color plano** (`src/core/environment.js:555–566`: `envSky`, `envGround`). Por eso la pintura del Porsche y del Model Y, el acero de Starship y el cromo reflejan cielo y un suelo gris, nunca lo que tienen al lado: la explanada, el circuito, el otro coche, la torre. La ronda del 04-10 ya decía que el Porsche «parecía de juguete» por la pintura en una llanura abierta (`TRASPASO.md`, sesión del 04-10).
- **Qué.** Una `CubeCamera` por zona, que da una sonda local en la explanada de los coches y otra en la fila de expositores; Starship puede quedarse con la global. Se renderizan **una vez** con la escena real y se convierten con PMREM. Se regeneran solo al mover el Sol (como la sonda actual, con su limitador `PROBE_MS`). Cada material de las zonas toma su `envMap` local. Opcionalmente, con corrección de paralaje en caja en el shader (`onBeforeCompile`) para que el reflejo no flote.
- **Coste en fluidez:** ninguno por fotograma; unos cientos de ms al cambiar el Sol.
- **Comprobación:** prueba nueva que cambie el Sol y compruebe que la sonda local se regenera; capturas de comparación aprobadas por el usuario.

**M-IMG2. Sombras con penumbra física** · Impacto Alto · Coste M

- **Por qué.** Hallazgo nuevo (S13 y C23): los dos proyectos fijan `shadow.radius` (spacex: `sun.shadow.radius = 1.25` en `environment.js:228`; visor: `key.shadow.radius = 3` en `main.js:51`; el Audi Lab usaba 5). Pero con `PCFSoftShadowMap`, en r170 el shader **ignora el radio** de las luces direccionales: la rama `SHADOWMAP_TYPE_PCF_SOFT` usa un núcleo fijo de 3×3 texeles (comprobado en `vendor/three/build/three.module.js`, `shadowmap_pars_fragment`). El borde de sombra es siempre de ≈1 texel, igual al pie de una rueda que a 140 m de la torre.
- **Qué.** El Sol mide 0,53°: la penumbra crece con la distancia entre el que proyecta la sombra y el que la recibe (≈9 mm a 1 m, ≈0,46 m a 50 m). PCSS (*percentage-closer soft shadows*) lo reproduce: una búsqueda del bloqueador y un filtro proporcional a la distancia. Se implementa sustituyendo el fragmento `shadowmap_pars_fragment` del Sol. Es un cambio de imagen (para mejor y físicamente correcto), así que necesita aprobación y capturas.
- **Coste:** algo más de muestreo por fragmento, solo en lo que recibe sombra; se compensa con la caché de sombras ya existente.
- **Además:** borrar o documentar los `radius` muertos, que confunden a quien ajuste las sombras.

**M-IMG3. Sombras en cascada para las vistas lejanas** · Impacto Medio · Coste M

- **Por qué.** Hay un único mapa de 4096² cuyo volumen sigue a la cámara en escalones de ×1,2 (README, «Estabilidad de la imagen»). De cerca da 3 mm por texel, pero en la vista general cada texel abarca decenas de centímetros. Las sombras finas de la fila (pinzas, brazos de la torre, valla) se pierden o tiemblan.
- **Qué.** 2–3 cascadas (CSM): la cercana, igual que hoy; las lejanas, para la fila y el pad. `shadowCache` pasa a decidir por cascada.
- **Coste:** una pasada de sombras más por cascada, pero solo cuando la caché lo pide; con la escena quieta, cero.

**M-IMG4. Oclusión ambiental solo sobre la luz indirecta** · Impacto Medio · Coste M

- **Por qué.** `GTAOPass` multiplica el color final de la escena (`src/core/ao.js`): oscurece también la luz directa del Sol y los reflejos especulares de los pliegues. Físicamente la oclusión ambiental solo atenúa la luz del cielo y la difusa indirecta. Es una de las razones por las que un pliegue al sol puede verse «sucio».
- **Qué.** Pasar el buffer de oclusión a los materiales como un `aoMap` en espacio de pantalla (`onBeforeCompile`: muestrear la textura de la pasada en `gl_FragCoord`), que three.js ya aplica solo a la parte indirecta. El G-buffer en caché (`gbufferCache`) se mantiene.
- **Comprobación:** imagen idéntica fuera de los pliegues y diferencia acotada en ellos.

**M-IMG5. Mapeo de tonos: probar AgX o Neutral frente a ACES** · Impacto Medio · Coste S (prueba) a M (recalibración)

- **Por qué.** `ACESFilmicToneMapping` desplaza los tonos de los colores saturados: los rojos intensos tiran a naranja o rosa y los saturados se apagan. El Model Y es «Ultra Red», el Porsche lleva llantas rojas y el F-16 tiene insignias. Three r170 trae `AgXToneMapping` (el que usa el visor del Cybertruck, igual que Blender) y `NeutralToneMapping` (Khronos PBR Neutral, pensado para colores de producto).
- **Qué.** Prueba A/B con las mismas capturas al Sol de 18° y comparación con las fotos de referencia. **Riesgo:** toda la calibración de exposición (0,7 y la curva de `environment.js:516`) y del acero «casi espejo» se hizo con ACES. Si se cambia, hay que recalibrar. Decide el usuario.

**M-IMG6. Antialiasing especular en las texturas procedurales** · Impacto Medio · Coste S

- **Por qué.** Las piezas metálicas finas y curvas generan píxeles brillantes que parpadean al mover la cámara. El proyecto lo trata después, con el limitador de pico antes del bloom (`main.js:191–219`).
- **Qué.** Toksvig o LEAN al generar los mipmaps de `textures.js`: la rugosidad de cada nivel crece con la variación de las normales que ese nivel promedia. No cuesta nada por fotograma y quita el parpadeo en origen. En los mapas de Blender se puede hacer en `webfinish.py`.

**M-IMG7. Suciedad y uso no periódicos en un atlas** · Impacto Medio · Coste M

- **Por qué.** La lección 3 de la v4 del Cybertruck lo dice: las texturas repetidas no sirven para huellas o suciedad localizada. Los coches de spacex ya tienen un atlas de oclusión en el segundo juego de UV (Model Y y Porsche a 4096²; H2R a 2048²).
- **Qué.** Hornear en ese mismo atlas, o en uno paralelo, la suciedad localizada: polvo en los bajos y en los pasos de rueda, marcas de agua bajo los cristales, huellas junto a las manetas, desgaste del pedal. Todo ello «aproximado» y marcado como tal. Se combina en el shader con la textura repetida, que da el detalle fino.

### 8.2 Cybertruck: modelo y visor (y el futuro Lab)

**M-CT1. Oclusión ambiental (la mejora de más valor)** · Impacto Alto · Coste M

- **Por qué.** Comprobado en el GLB: **0 de 83 materiales tienen `occlusionTexture` y 0 de 2.038 primitivas tienen un segundo juego de UV** (frente a 28/40 materiales y 172/196 primitivas en el Model Y, 23/31 en el Porsche y 58/63 en la H2R). Además, el visor **no tiene ninguna pasada de oclusión** (solo una luz principal, una hemisférica y el entorno). Es justo lo que el propio `ao.js` de spacex describe: sin oclusión, los primeros planos «se leen como maquetas de plástico sobre una mesa». En el Cybertruck se nota en pasos de rueda, juntas de paneles, el interior y los bajos.
- **Qué, en dos capas, por la vista explosionada:**
  1. **Horneada por pieza aislada** (autooclusión: los pliegues de cada pieza consigo misma), con `blender/common/webfinish.py` de spacex como modelo (atlas por pieza con estantes, UV2). Hornearla con el coche montado sería un error: al explosionar, cada pieza llevaría la sombra de vecinas que ya no están.
  2. **En pantalla** (GTAO, como `core/ao.js` de spacex) para el contacto entre piezas, que cambia con la explosión. En el Lab se reutiliza el `ao.js` de spacex tal cual.
- **Coste en tamaño:** un atlas de 4096² en WebP de alta calidad añade del orden de 1–3 MB al GLB.
- **Comprobación:** renders `CAM_*` con y sin oclusión; en la web, prueba de humo.

**M-CT2. UV para ruedas, frenos y bujes** · Impacto Medio-Alto · Coste S

- **Por qué.** Hallazgo nuevo (C21): el validador oficial de Khronos da **17 errores** en el GLB, todos `texCoord: -1`, en 9 materiales duplicados (`CT_Tire_Rubber`, `CT_Tire_Sidewall`, `CT_Brake_Rotor`, `CT_Brake_Pad`, `CT_Steel_Zinc`, `CT_Steel_Black`, `CT_Aluminium_Machined`, `CT_Rubber_Bushing`, `CT_Wheel_Cover`). Los usan 27 primitivas **sin UV**: el neumático (malla compartida por las cuatro ruedas), discos, pinzas, pastillas, bujes, protectores, tapacubos, tuercas y válvula. Comprobado en el navegador: `MESH_Tire_285_65R20` llega sin atributo `uv` y con `map`, `normalMap` y `roughnessMap`. Las texturas de goma, mecanizado del disco y zincado **no se ven en la web**, aunque sí en los renders de Blender. El README afirma que «el visor web muestra el mismo aspecto que Blender»; en ruedas y frenos no es así.
- **Qué.** En Blender, dar UV a esas mallas: probablemente se construyen por revolución sin UV y sus materiales usan coordenadas «Generated» u «Object», que el exportador glTF no puede traducir. Basta un desenvolvimiento cilíndrico o por proyección. Después hay que volver a exportar y validar.
- **Comprobación:** añadir el validador de Khronos al CI de `cybertruck` (C10), con **0 errores** como condición.

**M-CT3. El acero inoxidable** · Impacto Alto · Coste M

- **Por qué.** Los tres aceros (`CT_Stainless_Steel`, `_B`, `_C`) llevan anisotropía 0,55 **sin dirección** (`anisotropyRotation` ni `anisotropyTexture`): la dirección del cepillado la decide el eje U de la UV de cada panel. Su textura es de 512² o 1024², repetida ×2,5.
- **Qué:**
  1. Comprobar, panel a panel y con fotos, que el cepillado corre en la dirección real (en las fotos de prensa el veteado del Cybertruck corre a lo largo del coche) y fijarla con `anisotropyRotation` donde la UV no la dé.
  2. Variar el tono y la rugosidad **entre paneles** (el acero real cambia ligeramente de un panel a otro; ya hay tres variantes, que se podrían repartir por panel y no por familia).
  3. Huellas y manchas localizadas en el atlas del segundo juego de UV (M-IMG7), marcadas como aproximadas.

**M-CT4. Aperturas, ruedas y suspensión en el visor y en el Lab** · Impacto Alto · Coste M

- **Por qué.** El GLB ya trae los pivotes con su eje descrito (`pivot_es`): `DOOR_FL/FR/RL/RR` («eje de bisagras vertical junto al borde delantero»), `EXT_Frunk_Lid` («bisagra trasera junto a la base del parabrisas»), `EXT_Tailgate` («bisagras inferiores, apertura hacia abajo») y `WHEEL_*` («eje de giro = X local»). El visor no los usa (C22). El Audi Lab tenía aperturas con bisagras y era lo más vistoso.
- **Qué:**
  1. Botones «Puertas», «Frunk», «Portón» y «Tonneau» que giran sobre esos pivotes. Los ángulos de apertura no se publican: marcarlos ≈.
  2. **Selector de altura de la suspensión neumática** con las seis alturas oficiales del manual (verificadas en esta auditoría). Altura total: Entry 1.738,8 · Low 1.753,8 · Medium 1.793,8 · High 1.853,8 · Very High 1.893,8 · Extract 1.943,8 mm. Altura libre: 202 · 217 · 257 · 317 · 357 · 407 mm. Es un dato de grado A que hoy el modelo solo usa en «Medium». Hay que mover la carrocería y no las ruedas, y comprobar las interferencias en los extremos.
  3. Giro de las ruedas y dirección en la vista de «Dirección» (el Cyberbeast lleva dirección trasera; sus ángulos, si se publican, con fuente).

**M-CT5. Vidrio y luces** · Impacto Medio · Coste S–M

- **Por qué.** El vidrio usa `transmission` (5 materiales) sin `thickness`, `attenuationColor` ni `attenuationDistance` en el GLB; el visor añade el espesor por nombre. Las LED son emisivas, pero el visor **no tiene bloom**, así que la barra de luz no «brilla».
- **Qué:**
  1. Vidrio laminado con atenuación verdosa en los cantos (el parabrisas real se ve verde de canto), con su espesor por material. No hay cifra publicada: marcar ≈.
  2. Bloom suave en el visor y en el Lab, con el mismo limitador de píxeles brillantes de spacex (`main.js:191–219`) para no generar bloques.
  3. Faros con un perfil de emisión (más intenso en el centro) en lugar de un plano uniforme.

**M-CT6. Geometría de mayor fidelidad (necesita fuentes)** · Impacto Alto · Coste L

- Formas exactas de faros, retrovisores, paragolpes y fundiciones, y el molde real del Scorpion ATR: pendientes en `CLAUDE.md`, y todas necesitan fotografías ortogonales o escaneos usados solo como referencia.
- **Una fuente concreta y disponible:** la propia página de cotas del manual del propietario trae las vistas acotadas del vehículo. Sirve para medir, con fotogrametría de grado B, las dos inclinaciones de la sección transversal (6° y 19°) que hoy se deducen (README, «Limitaciones»), usando la anchura de 2.413,3 mm como regla.
- Validar también la **anchura con espejos plegados** (2.200,7 mm, publicada) en `validate.py`. Hoy no se comprueba.

**M-CT7. Vista explosionada más legible** · Impacto Medio · Coste S–M

- **Por qué.** La etapa 6 tiene 722 de 1.139 nodos (C14): en el último 40 % de la animación se mueve dos tercios del coche a la vez. Con la amplitud por defecto, 124 piezas quedan bajo el suelo (C15).
- **Qué:**
  1. Subdividir la etapa 6 por sistema (6a herrajes de carrocería, 6b tren motriz, 6c interior…), con sus ventanas.
  2. Un modo «explosión por sistema» que separe solo el sistema elegido.
  3. Líneas guía (*leader lines*) de cada pieza a su posición montada.
  4. Al explosionar, subir el conjunto lo necesario para que nada quede bajo el suelo, como alternativa al cristal (ya se le propuso al usuario en `traspaso.md` §3.4).

**M-CT8. Escala humana en el Lab** · Impacto Medio · Coste S

- spacex enseña la escala con figuras de 1,80 m (`buildHumanCrowd`). Una figura junto al Cybertruck en el Lab (dentro del Lab, no en el entorno principal) haría legibles sus 1,79 m de altura y 5,68 m de largo, con el mismo criterio del proyecto.

**M-CT9. Rendimiento del visor y del Lab sin perder calidad** · Impacto Alto · Coste M

1. **Dibujo bajo demanda**, solo cuando cambian la cámara, la explosión, la selección, la visibilidad o el entorno. El visor actual dibuja en cada fotograma ≈2.090 mallas, más sombras y reflejo, aunque nada se mueva.
2. **Sombras en caché**, rehechas solo al cambiar la explosión o la luz.
3. **Materiales de una sola cara** en las mallas cerradas: los 83 son `doubleSided` (el valor por defecto del exportador), y eso duplica los fragmentos y las sombras de las caras traseras sin cambiar nada de lo visible en un sólido cerrado. Se corrige en Blender, con «Backface Culling» en los materiales de mallas cerradas, verificado con `ct_lib.orient_closed_components`.
4. **Carga progresiva por sistemas** (ya pendiente en `CLAUDE.md`): primero la carrocería y las ruedas, después el resto, para ver el coche en ≈1 s.
5. Solo si la medida lo justifica: **`BatchedMesh` por material** (≈83 llamadas de dibujo en lugar de ≈2.000, con la explosión por instancia).

### 8.3 Vehículos de spacex

**M-V1. Model Y** · Coste M

- Los cuatro neumáticos comparten malla en el GLB (bien para la descarga), pero se dibujan 4 × 142.016 triángulos: el 47 % del modelo (README, ronda del 17-10). Con un **nivel de detalle por sustitución** (malla diezmada con error < 1 px en el umbral, medido con `lod-pop.mjs`) se ahorra ≈0,5 M de triángulos a distancia sin cambio visible. El README ya lo identifica como «proyecto aparte».
- Interior: la pantalla con imagen genérica; las fotos solo como referencia.

**M-V2. Porsche 911 GT3 RS** · Coste M

- Pendiente documentado: el frontal (paragolpes algo abombado en las esquinas), un pequeño diente en el borde trasero de la ventanilla y las aletas negras algo cuadradas.
- Habitáculo sin contrastar (no hay fotos libres del 992 GT3 RS en Commons). Buscar fuentes de Porsche (prensa oficial) solo como referencia.
- La pintura gana mucho con M-IMG1 (reflejos locales) y M-IMG5.

**M-V3. Kawasaki Ninja H2R** · Impacto Alto · Coste L

- La «fase 3» aparcada (`docs/rondas/h2r.md`): carbono con trama en relieve; titanio con el degradado de calor (pajizo, azul, violeta); goma del neumático y de los puños; aluminio cepillado y mecanizado; el espejo ahumado en dos capas (película de plata y barniz ahumado: en three.js, un metal muy pulido bajo un `clearcoat`, con el ahumado en el color base). Después, la mecánica pieza a pieza y la forma del carenado contra las fotos. **Solo si el usuario lo retoma** (está aparcado por decisión suya).
- Su atlas de oclusión es de **2048²** frente a los 4096² del Model Y y el Porsche: subirlo a 4096² mejora la nitidez de la oclusión a la misma distancia de cámara.
- El amortiguador trasero sigue sin fotos que muestren su disposición; no se inventa.

**M-V4. F-16A** · Coste M–L

- Pendientes documentados: el tren (puertas planas y patas cilíndricas hoy), las luces de formación, el receptáculo de repostaje y más paneles.
- Efectos visuales con base física: conos de vapor en transónico con humedad alta, vórtices de punta de ala con mucha incidencia y la distorsión por calor de la tobera con postcombustión. Son efectos atmosféricos, no objetos nuevos en el entorno, y van marcados ≈.

**M-V5. Roadster y Starman** · Impacto Alto · Coste L

- Es el cuarto vehículo del encargo del 15-10 (Model Y → Porsche → H2R → **Roadster**), aún sin hacer. Es el modelo de código más grande (3.732 líneas) y ya tiene las cotas del manual de servicio de Tesla. Una pasada en Blender con la misma cadena que el Model Y (`ty_bake.py`, `webfinish.py`) le daría la oclusión horneada y los detalles horneados que tienen los otros tres coches.

**M-V6. Starship, Falcon, Dragon y Starlink** · Coste variable

- Todos los pendientes están **a la espera de evidencia** (`TRASPASO.md` §4): la tercera ventana de la Dragon, las pinzas del Falcon 1, la variante exacta del Starlink, el registro de la FAA de la torre, la orientación del Pad 2 (decisión del usuario) y los tramos de la secuencia H29, H31 y H33.
- Mejoras de imagen que sí son posibles: el acero de Starship gana con M-IMG1 (refleja la torre y la explanada) y con M-IMG2 (penumbra de la torre); la escarcha de la carga y los penachos ya están muy trabajados.

### 8.4 Conducción y vuelo

**M-DIN1. Porsche: neumáticos más completos** · Impacto Alto · Coste M

- **Por qué.** `gt3Car.js` combina la deriva longitudinal y la lateral en **una sola fórmula mágica sobre la deriva normalizada** (líneas 14–15 y 60–62). Es robusto, pero da la misma forma de curva a la tracción, la frenada y el giro. Además: no hay caída ni empuje por caída, ni temperatura, ni presión, ni desgaste, ni par autoalineante en la dirección. El `Mz` del modelo es el par de guiñada del coche, no el de la rueda.
- **Qué, por orden de valor:**
  1. Curvas separadas para Fx y Fy con su combinación (elipse de fricción o la ponderación de Pacejka).
  2. **Par autoalineante** (estela neumática), que lleve la sensación de agarre al volante: el mando vibra hoy por superficie y deslizamiento (`rumbleFor`); con el par, la dirección «se aligera» al perder agarre delante.
  3. **Temperatura del neumático** (agarre con ventana térmica) y de los frenos (fatiga), con parámetros ≈ y marcados.
  4. Sensibilidad de la carga aerodinámica a la altura de marcha.
- **Comprobación:** las pruebas de `gt3rs-check` y `gt3rs-lap` deben seguir pasando: aceleración, velocidad punta y tiempos publicados.

**M-DIN2. H2R: neumáticos por deriva y empuje por caída** · Impacto Alto · Coste M

- **Por qué.** `h2rBike.js` (líneas 13–20) toma la guiñada de la cinemática de la dirección («el rastro y la elasticidad de los neumáticos, fuera»). Los neumáticos son un círculo de fricción, sin ángulo de deriva delantero ni empuje por caída, y una moto gira sobre todo por empuje de caída.
- **Qué:**
  1. Fuerzas laterales por deriva más empuje por caída en cada rueda.
  2. El perfil toroidal del neumático: el punto de contacto se desplaza con la inclinación, y la inclinación efectiva difiere de la geométrica.
  3. Avance (*trail*) y momento giroscópico explícitos.
  4. El empuje lateral del viento sobre la moto inclinada, documentado como hueco desde el 04-10.
- **Restricción:** el usuario decidió que la moto no se caiga por inclinarse; el modelo nuevo debe conservar ese límite.

**M-DIN3. F-16** · Impacto Medio · Coste M

- Turbulencia de Dryden (MIL-F-8785C) sobre el viento de brisa que ya existe, con intensidad ≈ según altura.
- El cambio del momento de cabeceo en efecto suelo, que es un hueco documentado.
- Inercias que varíen con el combustible (hoy fijas en las de la tabla I).
- El tramo de Mach 0,6–1,6 seguirá siendo ≈ mientras no haya datos públicos: no se inventa.

**M-DIN4. Entrada** · Impacto Medio · Coste S

- Volantes de juego: la Gamepad API los expone como ejes. Un perfil de mapeo (dirección en el eje 0, pedales separados) y una calibración en el HUD.
- (Los gatillos del mando ya son analógicos: `gt3Pad.js:23` lee `buttons[i].value`. Comprobado; no hace falta nada.)
- Retroalimentación de fuerza real no existe en la Web Gamepad API (solo vibración), así que el par autoalineante se transmite por vibración e indicador.

**M-DIN5. ¿Conducir el Model Y o el Cybertruck?** · Decisión del usuario

- El Model Y es estático. Reutilizar el modelo del Porsche con sus datos publicados (masa, potencia, relación y neumáticos) lo haría conducible.
- El Cybertruck **no debe estar en el entorno principal** según la orden de hoy, así que conducirlo exigiría cambiar esa orden. Tesla publica aceleración, velocidad máxima, masa y dirección trasera.
- Se recoge solo como idea.

### 8.5 Fluidez sin renunciar a la calidad (spacex)

**M-FL1. Etiquetas sin recálculos de maquetación forzados** · Impacto Medio · Coste S

- **Por qué.** Hallazgo nuevo (S14): `settleLabels()` (`main.js:1398–1437`) se ejecuta en **cada fotograma**. Para cada etiqueta primero escribe (`style.transform = ''`, `classList.remove`) y luego lee (`getBoundingClientRect`). Cuando alguna etiqueta estaba desplazada o recortada, cada lectura tras una escritura obliga al navegador a recalcular la maquetación: N recálculos por fotograma.
- **Qué.** Hacer todas las escrituras, después todas las lecturas, después las escritas finales. Mejor aún, ejecutarlo solo cuando la cámara o las etiquetas visibles cambian. La imagen es idéntica.

**M-FL2. Caché de las texturas procedurales entre visitas** · Impacto Alto (arranque) · Coste S

- **Por qué.** Generar las texturas en Canvas cuesta ≈7 s de hilo principal en el arranque (README, ronda del 17-10) y son **deterministas**: se repiten idénticas en cada visita.
- **Qué.** Guardarlas en la Cache Storage o en IndexedDB, como `ImageBitmap` o PNG sin pérdida, con una clave que sea la versión del generador más sus parámetros. Si la clave no coincide, se regenera. La segunda visita se ahorra esos segundos.
- **Comprobación:** prueba que compare byte a byte la textura de la caché con la generada.

**M-FL3. Texturas en hilos de trabajo** · Impacto Medio · Coste M

- `OffscreenCanvas` en un *worker*: ya se descartó «sin poder medirlo en hardware real». Con M-FL8 se puede medir. Es la misma imagen, pero el hilo principal queda libre durante la carga.

**M-FL4. Unir las mallas estáticas de los coches de Blender por material** · Impacto Medio · Coste M

- El Porsche (122 mallas), la H2R (194) y el Model Y (108 en el GLB; 196 primitivas) se dibujan pieza a pieza. Las que nunca se mueven ni se ocultan por separado (todo menos ruedas, dirección, piezas animadas y las pequeñas que retira `lodParts`) se pueden unir por material al cargar.
- Menos llamadas de dibujo en las tres pasadas: color, oclusión y sombras.
- **Comprobación:** con el mismo método de `render-cache-equal.mjs`, imagen idéntica.

**M-FL5. Nivel de detalle por sustitución para las mallas más pesadas** · Impacto Medio · Coste M

- Los neumáticos del Model Y (M-V1) y los cuerpos del Porsche y de la H2R (`Mesh_0` de 119.212 triángulos en el Porsche; `Mesh_73` de 72.048 en la H2R).
- Se generan en Blender (Decimate con un error medido) y se cambian por debajo del umbral de 3,5 px, con `lod-pop.mjs` vigilando el salto.

**M-FL6. Idle: el coste en reposo** · Impacto Medio (portátiles) · Coste S

- Con todo quieto se siguen dibujando cada fotograma la pasada de color, la de oclusión (con el G-buffer en caché) y el bloom, porque el agua y la manga de viento se animan.
- Opción que no cambia la calidad: limitar ese «reposo animado» a la frecuencia del monitor (ya lo hace `requestAnimationFrame`) y no hacer nada más.
- Opción que sí la cambia y por eso **no se propone**: bajar la resolución en reposo.

**M-FL7. Arranque: compresión en el servidor** · Impacto Bajo · Coste —

- Los tres GLB viajan con gzip (≈48 MB). La descarga anticipada ya existe.
- **Brotli no es una opción:** comprobado en esta auditoría, GitHub Pages no lo sirve. Con `Accept-Encoding: br` devuelve el `modely.glb` sin comprimir (32.554.136 B). No hay nada que ganar por este lado sin cambiar de alojamiento.

**M-FL8. Medir en hardware real antes de seguir optimizando la GPU** · Coste S

- Todo lo medido es SwiftShader. El usuario tiene una RTX 3070 (`TRASPASO.md`).
- Una sesión con `?perf` en su equipo, en cinco vistas fijas (las de `profile.mjs`), daría FPS, tiempo de fotograma (medio y p95) y llamadas de dibujo reales. Con esos datos se decide qué de M-IMG2/3 y M-FL3/4/5 compensa.
- Un `?perf=log` que vuelque esas cifras a JSON para pegarlas en el README.

### 8.6 Lo que se ve en las capturas de revisión

Ocho capturas de esta auditoría:

- Hechas con la herramienta del propio proyecto (`node tools/shot.mjs` y un guion propio), en calidad alta forzada, con el Sol de arranque (20°), a 1600 × 900 y con SwiftShader.
- Guardadas **fuera del repositorio**, en el directorio temporal de la sesión: no es la galería, que no se regenera sin aprobación.
- Encuadres: Model Y (tres cuartos delantera), Porsche, H2R, F-16, Roadster, el complejo de Starship, la Dragon y la vista general.

Lo que muestran, y la mejora que lo explica:

| Vehículo | Observación | Mejora |
|---|---|---|
| **Model Y** | La pintura «Ultra Red» se lee **satinada, casi mate**. El barniz no refleja nada reconocible del entorno; solo un brillo difuso. El parabrisas es muy transparente y casi no refleja el cielo en ángulo rasante, de modo que el interior claro se ve como a través de una ventana abierta. | M-IMG1 y la opacidad o reflejo del vidrio en `modelyAsset.js` (`PANES`) |
| **Porsche** | El blanco se ve plano, sin el reflejo del asfalto y del cielo que dibuja la forma en las fotos de estudio. Los faros se leen como dos manchas blancas. | M-IMG1, M-V2 |
| **H2R** | El «Mirror Coated Spark Black» se ve **gris oscuro mate**. El acabado real es de espejo ahumado: es el caso más claro de la falta de reflejos y de los materiales pendientes de la fase 3. El escape de titanio con su degradado de calor sí se aprecia. | M-IMG1, M-V3 |
| **F-16** | La cúpula **casi no se ve**: sin un reflejo marcado, la burbuja desaparece. La pista y las sombras se leen bien. | M-IMG1 y el material de la cúpula |
| **Roadster** | Las lentes de los faros parecen plástico gris plano y la rejilla es un hueco negro sin detalle. El traje de Starman se lee más como plástico que como tela a esta distancia. | M-V5 (pasada en Blender) |
| **Starship (complejo)** | El conjunto es muy convincente: marismas, costa, granja y torre. La pila se ve gris apagada, no «casi espejo» como describe el README; refleja solo el cielo. | M-IMG1, M-IMG2 (penumbra de la torre) |
| **Dragon** | Bien resuelta. El blanco es uniforme, sin variación entre paneles, y la explanada de hormigón se ve muy lisa a 15 m. | M-IMG7 (variación localizada entre paneles), sin inventar suciedad: el proyecto ya decidió presentar los Falcon «blanco limpio, como un cohete nuevo» (README) y lo mismo cabe aplicar aquí; lo decide el usuario |
| **Vista general** | Composición clara y legible. El primer plano de terreno ocupa mucha superficie con poca variación. | No se propone cambiar el entorno (prohibido añadir objetos). Solo la calidad del sombreado del suelo, si el usuario lo pide |
| **Figuras de 1,80 m** (en el Porsche, la H2R y el F-16) | Son figuras muy simples, de pocos polígonos y sin rasgos. Junto a coches hechos en Blender con este nivel de detalle, son lo que más «delata» lo sintético en los primeros planos. | **Mejora nueva, M-V7:** figuras con más detalle (proporciones y ropa de trabajo realistas), unidas igual que hoy en una malla por material (`buildHumanCrowd`, cinco llamadas de dibujo) y con su altura de 1,80 m verificada. Coste M |

**Conclusión de las capturas:** lo que más separa hoy la imagen de una fotografía es la **falta de reflejos del entorno** en todo lo brillante (pintura, acero, cúpulas, vidrio). Es la mejora M-IMG1 y la de mayor relación impacto/coste del documento. Le siguen los materiales pendientes (H2R y Roadster) y las figuras humanas.

### 8.7 Lo que no conviene hacer (y por qué)

- **Reducir la resolución automáticamente según los FPS:** el usuario descartó el regulador de calidad adaptativo.
- **Draco, KTX2 o Meshopt con cuantización en los GLB de spacex:** cambian la imagen; se probó y se descartó el 17-10 (README). El GLB del Cybertruck ya usa Draco: dentro del Lab no hay comparación con un original sin comprimir que respetar, pero si se quiere la máxima fidelidad, se puede exportar sin Draco (≈2× de peso) y dejar la decisión al usuario.
- **Reflejos en espacio de pantalla (SSR) en la escena principal:** necesitan una textura de profundidad del render target con MSAA, lo que el proyecto prohíbe por su coste en ANGLE/D3D11. M-IMG1 da la mayor parte del beneficio sin ese coste.
- **HDRI fotográficos de terceros en el Lab del Cybertruck:** solo si son CC0 y el usuario lo aprueba. El entorno procedural actual es coherente con la norma de no versionar imágenes con derechos.

## 9. Decisiones que corresponden al usuario

1. **Idioma del Lab.** (a) En español, como el Audi Lab y el visor actual: es una excepción a la norma de interfaz en inglés de `spacex`. (b) En inglés, con `label_en` y `note_en` añadidos en la exportación de Blender para las 1.138 piezas (trabajo de traducción con riesgo de errores técnicos). (c) Marco de la interfaz en inglés y nombres de piezas en español.
2. **Liberar o conservar el modelo** al cerrar el Lab (memoria frente a reabrir al instante).
3. **Origen del GLB**: copia sincronizada (recomendada) o carga desde la web del Cybertruck (§4.7).
4. **Tecla**: **U** (la del antiguo Audi Lab) u otra libre (**Y**, **I**, **O**, **Z**).
5. **Qué pasa si se pulsa el botón con una secuencia en marcha**: terminarla y abrir, o no abrir y avisar.
6. **¿Aparece el Cybertruck en la tabla de vehículos del README de `spacex`?** Si aparece, entra en `provenance-check` con sus cifras de grado A.
7. **Limpieza de ramas antiguas** en los dos repositorios.

---

## 10. Anexos

### 10.1 El GLB del Cybertruck (`web/models/cybertruck.glb`, versión 4.2)

| Dato | Valor |
|---|---|
| Tamaño | 12.480.868 B (JSON 1,75 MB; binario 10,73 MB); servido con gzip: 9.194.429 B |
| Generador | Khronos glTF Blender I/O v5.2.40 |
| Extensiones requeridas | `KHR_draco_mesh_compression`, `KHR_texture_transform`, `EXT_texture_webp` |
| Extensiones usadas | además: `KHR_materials_clearcoat` (5), `transmission` (5), `ior` (5), `emissive_strength` (3), `anisotropy` (7), `sheen` (6) |
| Nodos | 1.139 (raíz `CYBERTRUCK_ROOT` + 1.138 con extras); profundidad 0/1/2/3: 1/700/402/36 |
| Mallas / primitivas | 1.078 / 2.038 (todas con Draco) |
| Triángulos / vértices | 1.183.372 / 1.520.159 |
| Materiales / texturas / imágenes | 83 (todos `doubleSided`, todos `OPAQUE`) / 71 / 37 WebP (2,78 MB) |
| Nodos con rotación | 25, todos hojas (pinzas, pastillas, discos, protectores, bujes, ruedas FL/RL, matrícula trasera) |
| Etapas (1…6) | 115 · 86 · 106 · 54 · 55 · 722 |
| Fidelidad | Verificado 20 · Reconstruido 881 · Aproximado 237 |
| Sistemas | 20 (de 32 a 113 nodos por sistema) |
| Mallas más pesadas | `DU_R_Gear_Train_L/R` (18.628 triángulos cada una), neumático 285/65R20 (18.528, compartido por las cuatro ruedas), tornillería de la tapa de la reductora delantera (17.892), cuatro bloques de celdas (16.800 cada uno) |
| Escala y ejes | metros; glTF: +Y arriba, −Z delante; origen en el suelo, en el centro de la batalla |

### 10.2 Cotas oficiales comprobadas (manual del propietario de Tesla, página «Dimensions, Weights, and Cargo Capacity»)

| Cota | Manual (mm) | Manifiesto / validación |
|---|---|---|
| Longitud total | 5.682,9 | 5,6829 (modelo 5.684,9, +2,0) |
| Anchura con espejos | 2.413,3 | 2,4133 (modelo 0,0) |
| Anchura con espejos plegados | 2.200,7 | **no se valida** |
| Anchura sin espejos | 2.031,6 | 2,0316 (modelo 2.081,7, +50,1, discrepancia documentada) |
| Altura «Medium» | 1.793,8 | 1,7938 (modelo +2,9) |
| Batalla | 3.635,0 | 3,635 (0) |
| Voladizo delantero / trasero | 878,3 / 1.169,6 | modelo 880,5 (+2,2) / 1.169,4 (−0,2) |
| Altura libre «Medium» | 257,0 | 0,257 (modelo −0,4) |
| Vía (delante y detrás) | 1.772,0 | 1,772 (0); resuelve a favor de 1.772 el conflicto con 1.777 que recoge la ficha |

Alturas de la suspensión neumática (Premium AWD y Cyberbeast), del mismo manual, para M-CT4:

| Ajuste | Altura total (mm) | Altura libre (mm) |
|---|---|---|
| Entry/Exit | 1.738,8 | 202,0 |
| Low | 1.753,8 | 217,0 |
| Medium | 1.793,8 | 257,0 |
| High | 1.853,8 | 317,0 |
| Very High | 1.893,8 | 357,0 |
| Extract | 1.943,8 | 407,0 |

El manual añade: «Values are approximate. Dimensions can vary depending on a vehicle's options». Son cifras oficiales (grado A en el sistema de `spacex`), pero la ficha debería reproducir esa salvedad.

### 10.3 Cifras discrepantes en los documentos de `cybertruck`

- Objetos: «1.137» en `README.md:28,81`, `traspaso.md:7,301`, `docs/model-specification.md:103`, `docs/research-and-fidelity.md:374`; «1.139» en `CLAUDE.md` y `research-and-fidelity.md:479,540`. **Real: 1.139.**
- GLB: «12,0 MB» en `README.md:181,201`, `CLAUDE.md:105`, `model-specification.md:191`, `research-and-fidelity.md:376`, `traspaso.md:302`; «12,5 MB» en el resto. **Real: 12,48 MB.**
- `.blend`: «16,5 MB» en `CLAUDE.md:59,96` y `research-and-fidelity.md:480`; «16,2 MB» en `CLAUDE.md:84`, `traspaso.md:402` y otros. **Real: 16,21 MB.**
- Materiales: «78» en `CLAUDE.md:58` y `model-specification.md:107`. **En el GLB: 83.**

### 10.4 Repetición de la prueba de escena de `spacex`

Segunda ejecución de `node tools/check.mjs`, sin otra prueba en paralelo: **código 0, «Todas las comprobaciones pasan»** (101 líneas `ok`). El fallo de la primera ejecución fue, por tanto, de plazo bajo carga, no un defecto de la aplicación. El hallazgo S5 (plazo de 30 s en ese clic) sigue en pie como fragilidad.

Presupuesto medido en esta ejecución: **5.249.727 triángulos construidos** (3.948.251 dibujados en la vista general), **1.836 mallas** (1.119 dibujadas), **363 materiales** y **166 texturas**, frente a los techos de 6 M, 2.600, 420 y 260. Margen libre: 0,75 M triángulos, 764 mallas, 57 materiales y 94 texturas. El Cybertruck (1,18 M triángulos, ≈2.040 mallas, 83 materiales) no cabe en la escena principal sin subir tres techos, lo que confirma I3.

`ux-check`, `check:lod` y `check:cache` no se ejecutaron en local (≈15 min más); el CI los pasó en verde sobre este mismo commit.

### 10.5 Reproducciones

- **Barra > 100 %:** servidor Node que comprime con gzip y envía `Content-Length` comprimido (como Pages), Chromium cargando `cybertruck/web/`: textos del cargador «136 %», «126 %», «56 %».
- **Visor sin errores:** mismo montaje sin compresión: carga en 4,3 s, 0 mensajes de error o aviso en consola, 2.089 mallas y 1.267.500 triángulos en la escena, 1.138 piezas explosionables, desviación 0 tras cinco ciclos 1 → 0,37 → 0, 124 piezas bajo el suelo al 100 %.
- **Three.js vendorizado:** cada `.js` de `spacex/vendor/three` comparado con `cmp` contra `three@0.170.0` (npm): sin diferencias.

### 10.6 Fuentes externas consultadas

- Manual del propietario del Cybertruck, «Dimensions, Weights, and Cargo Capacity»: [tesla.cn/ownersmanual/cybertruck/en_us/GUID-12A976DD-…](https://www.tesla.cn/ownersmanual/cybertruck/en_us/GUID-12A976DD-EB60-431B-AFF1-5A37E95006DB.html) (espejo que el propio `traspaso.md` señala; `tesla.com` devuelve 403).
- Índice del manual: [tesla.cn/ownersmanual/cybertruck/en_us/](https://www.tesla.cn/ownersmanual/cybertruck/en_us/).
- Cabeceras de producción: `https://alvarodesigns34.github.io/cybertruck/models/cybertruck.glb` y `https://alvarodesigns34.github.io/spacex/assets/modely/modely.glb`.

### 10.7 Validación y materiales de los cinco GLB (2.ª versión)

Validador oficial de Khronos (`gltf-validator`, npm), con 2.000 incidencias como máximo:

| GLB | Errores | Avisos | Información |
|---|---|---|---|
| Cybertruck | **17** (`VALUE_NOT_IN_RANGE`: `texCoord` −1) | 1.248 (`MESH_PRIMITIVE_GENERATED_TANGENT_SPACE`: mapas de normales sin tangentes exportadas, que three.js calcula en el shader) | 735 (734 objetos sin usar y 1 extensión sin soporte en el validador) |
| Model Y | 0 | 109 (tangentes generadas) | 91 |
| Porsche | 0 | 2 | 121 |
| H2R | 0 | 0 | 184 |
| Rótulos del Porsche | 0 | 0 | 3 |

Mapas por material, segundo juego de UV y resolución de las imágenes:

| GLB | Materiales | Color / rugosidad-metal / normales / **oclusión** | Primitivas con UV2 | Imágenes |
|---|---|---|---|---|
| Cybertruck | 83 | 9 / 29 / 44 / **0** | **0 / 2.038** | 29 de 512² y 8 de 1024² (WebP, repetidas con `KHR_texture_transform`) |
| Model Y | 40 | 0 / 0 / 15 / 28 | 172 / 196 | atlas de oclusión de 4096² y 9 de 1024² |
| Porsche | 31 | 1 / 0 / 1 / 23 | 111 / 122 | atlas de oclusión de 4096² |
| H2R | 63 | 11 / 0 / 0 / 58 | 199 / 199 | atlas de oclusión de 2048² y rótulos pequeños |

Mallas más pesadas: neumático del Model Y, 142.016 triángulos compartidos por 4 nodos; Porsche, `Mesh_0` con 119.212; H2R, `Mesh_73` con 72.048.

---

## 11. Blender sin MCP: la preferencia del usuario y lo que cambia

### 11.1 La preferencia (orden del usuario del 23-10-2026)

- **No se usa Blender MCP**, es decir, el Blender de escritorio del usuario controlado a distancia. Deja de valer la «regla absoluta» del 15-10 de trabajar en su Blender abierto por MCP (`spacex/TRASPASO.md`).
- **Claude usa Blender en sus propias herramientas del agente:** un Blender sin interfaz instalado en el contenedor de la sesión, que se ejecuta con `blender -b` (modo *background*) y scripts de Python. Es el mismo Blender, la misma versión y la misma API `bpy`, pero sin ventana y sin conexión con el equipo del usuario.
- Queda documentado en `CLAUDE.md`, en el traspaso y en el README de los dos repositorios.

### 11.2 Cómo se instala y se ejecuta (comprobado en este entorno)

```bash
# 1. Blender 5.2.2 LTS para Linux (la versión del escritorio del usuario), con su suma oficial
cd /tmp && curl -sSO https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
curl -sS https://download.blender.org/release/Blender5.2/blender-5.2.2.sha256 | grep linux-x64 | sha256sum -c -
tar xJf blender-5.2.2-linux-x64.tar.xz && export BLENDER=/tmp/blender-5.2.2-linux-x64/blender

# 2. Librerías para EEVEE y Workbench sin pantalla (Cycles no las necesita)
apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri libxkbcommon0 libsm6 libxi6 libxrender1 libxxf86vm1 libxfixes3

# 3. Ejecutar un script contra el .blend del repositorio
$BLENDER -b blender/Cybertruck.blend --python mi_script.py -- argumentos
```

- Descarga de 383 MB; descompresión en menos de un minuto. `download.blender.org` es accesible desde este entorno.
- **Sin las librerías del paso 2, Blender se cierra al usar EEVEE** (`libEGL.so.1` no encontrada). Con ellas, los tres motores funcionan.
- Como el contenedor se reinicia en cada sesión, lo cómodo es poner los pasos 1 y 2 en el **script de configuración del entorno** (en la aplicación: el menú del entorno en la barra de título de la sesión → Editar → *Setup script*). Así cada sesión nueva arranca con Blender listo. Si no, Claude lo instala al empezar (≈1–2 min).
- `spacex` documenta además `pip install bpy==5.0.1` (Blender como módulo de Python 3.11), que es como se generó la H2R. Para no mezclar versiones, conviene usar el binario 5.2.2 para todo y, si se regenera la H2R, comprobar con `node tools/check.mjs` que el resultado no cambia de forma no deseada.

### 11.3 Prueba real: el Cybertruck reconstruido sin MCP

Sobre una copia del repositorio `cybertruck` (en `main`, `f021e08`), en el contenedor (4 núcleos, 15 GB de RAM, sin GPU):

| Paso | Resultado |
|---|---|
| `validate.run()` sobre `Cybertruck.blend` tal cual | Idéntico a `docs/validation-results.json` |
| `build_all.run(parts=(…todas…, "montaje", "explode", "scene"))` | **331 s** (en el equipo del usuario, «unos 5 min»), 1.139 objetos |
| `validate.run()` tras reconstruir | **Idéntico**: longitud +2,0 mm, altura libre −0,4 mm, siluetas iguales (perfil trasero 7,8 mm de media) |
| `build_explode.verify_roundtrip()` | 1.139 objetos, desviación **0,0** |
| `interferencias.run()` | 22 s, sin errores |
| `export_web.export(...)` | GLB de 12,48 MB y 1.138 componentes; **manifiesto idéntico**; nodos, materiales y las 37 imágenes idénticos byte a byte |
| Diferencias del GLB | 46 de 2.075 bloques binarios, todos geometría de unas 30 mallas que pasan por recortes booleanos (subchasis, actuadores de dirección, fundición delantera, interiores de inversores y pantallas…): de 0 a 3 vértices de diferencia por malla. Es la variación normal de los booleanos entre plataformas (Windows frente a Linux). |
| Texturas de `blender/textures/` | Sin cambios (deterministas) |
| Total con la carga y la exportación | 373 s |
| Motores de render (escena de prueba de 320 × 180) | Cycles en CPU 0,9 s; Workbench 0,5 s; EEVEE 42 s (rasterizado por software) |
| GPU | Ninguna: Cycles solo ve la CPU (Intel Xeon) |

**Conclusión:** el flujo del Cybertruck funciona completo sin MCP y da un modelo equivalente. Una reconstrucción en la nube **no es idéntica bit a bit** a la de Windows (los booleanos varían en unos pocos vértices), así que conviene subir un GLB regenerado solo cuando cambie algo de verdad, para no llenar el historial de diferencias sin contenido.

### 11.4 Qué se pierde, qué se gana y qué queda igual

**Se pierde:**

| Qué | Efecto | Cómo se compensa |
|---|---|---|
| **La GPU del usuario** (RTX 3070 con OptiX) | Los renders de Cycles y los horneados van en CPU, con 4 núcleos y sin GPU. La propia documentación de `spacex` lo cuantifica: el `build.py` entero de la H2R tarda 7,4 min con la 3070 (OptiX) y ≈30 min con 4 núcleos, casi todo por el horneado de la oclusión. EEVEE va por software (42 s para una escena trivial). | Renders de revisión en Workbench o en Cycles con pocas muestras y baja resolución; los horneados largos, en segundo plano. Los renders finales «de catálogo» los puede lanzar el usuario en su equipo con los mismos scripts, si los quiere a máxima calidad. |
| **Ver y tocar la escena en vivo** | El usuario ya no ve en su ventana de Blender cómo cambia el modelo mientras Claude trabaja, y Claude no ve su vista del visor ni su selección. | Claude renderiza imágenes a archivo y las revisa él mismo (puede leer PNG y JPG). El `.blend` resultante se sube al repositorio y el usuario lo abre cuando quiera. |
| **Lo que solo existe en el equipo del usuario** | Sus complementos, preferencias y archivos locales: por ejemplo, las fotos de referencia en `scratch/` de su disco y el `C:\Users\Álvaro\…` que citan los traspasos. | Las fotos de referencia se descargan en la sesión, solo como referencia y nunca al repositorio, como ya se hacía en la nube. Todo lo necesario para construir está en los repositorios. |
| **Las funciones propias del complemento MCP**, si se usaban | Según el complemento que tenga el usuario, puede haber capturas de la vista y descarga de recursos (Poly Haven, Sketchfab…). En los repositorios no consta que se usara nada de eso: solo la ejecución de código (`execute_blender_code`). | Las capturas se sustituyen por renders a archivo. Los recursos de terceros no se usan por las reglas de los proyectos. |
| **Persistencia** | El contenedor se borra al terminar la sesión. | Instalar con el script de configuración (§11.2) y subir siempre los resultados (`.blend`, `.glb`, documentación). |

**Se gana:**

| Qué | Por qué importa en estos proyectos |
|---|---|
| **Sin el corte de ≈100 s del MCP** | `cybertruck/traspaso.md` §5 y §14 documentan que el MCP cortaba las llamadas largas y obligaba a usar temporizadores (`bpy.app.timers`) y ficheros de resultado. Sin interfaz, la reconstrucción completa (331 s) corre de una vez y el script devuelve su resultado. |
| **Ningún riesgo para el Blender del usuario** | `spacex/TRASPASO.md` documenta que `object.join` y `shade_smooth_by_angle` por el puente MCP tumbaron su Blender varias veces (`BKE_base_eval_flags`), y que el solver booleano `EXACT` lo cerraba con mallas grandes. Ahora un fallo solo afecta a un proceso desechable. |
| **Reproducible** | Versión fija (5.2.2) y `--factory-startup`: sin complementos ni preferencias que cambien el resultado. Es la forma recomendada en `spacex` («Todo se construye con `blender -b --factory-startup -P …`; el MCP queda para mirar»). |
| **Pruebas automáticas** | Se puede encadenar construir, validar, exportar, `node tools/gen_inventory.mjs` y las pruebas de la web en una sola orden. Es la base para el paso de validación que hoy falta en el CI de `cybertruck` (C10). |
| **Independencia del equipo del usuario** | Claude puede trabajar con su ordenador apagado, desde cualquier sesión en la nube. |

**Queda igual:**

- La API `bpy` y todos los scripts de `blender/scripts/` (Cybertruck) y `blender/*/` (spacex): se ejecutan sin cambios. El docstring de `build_all.py` menciona el MCP como una de las formas de usarlo; sigue siendo válido.
- El formato `.blend` y el exportador glTF (Khronos glTF Blender I/O de la misma versión).
- Las validaciones (`validate.py`, `interferencias.py`, `build_explode`), que dan el mismo resultado.

### 11.5 Recomendaciones

1. Añadir los pasos de §11.2 al script de configuración del entorno en la nube. Es un ajuste de la aplicación que hace el usuario; no es parte de los repositorios.
2. Fijar la versión: 5.2.2 en todas partes. Si se actualiza Blender, hacerlo a la vez en el escritorio del usuario y en el script, y revalidar.
3. Para revisar visualmente sin GPU: Workbench con color aleatorio por objeto, para ver cruces (lo pide `cybertruck/traspaso.md` §15.2), y Cycles con 16–64 muestras a 1280 × 720 para materiales. Los renders de documentación (`docs/renders/`, 128 muestras) se pueden lanzar en segundo plano: tardan más en CPU, pero no bloquean.
4. No regenerar ni subir el GLB del Cybertruck si no cambia el modelo: una reconstrucción en Linux difiere en unos pocos vértices de la de Windows (§11.3).

---

## 12. Seguimiento: qué está hecho (23-10-2026)

Añadido al implementar, en la segunda sesión del 23-10. El resto del documento conserva el texto de la auditoría tal
como se escribió; esta sección dice qué se hizo con cada punto. Detalle en el README de cada repositorio («Estado
actual» en `spacex`; «Correcciones de la auditoría» en `cybertruck`).

**Decisiones del usuario (§9):** Lab con el marco en inglés y las piezas en español; tecla **U**; con una secuencia en
marcha, terminarla y abrir; conservar el modelo al cerrar; GLB copiado. Pendientes: tabla del README (9.6) y limpieza
de ramas (9.7).

**Integración (§4.10):**

| Fase | Estado |
|---|---|
| 1. Activos | Hecha: Draco y `Reflector` r170 en `vendor/` (byte a byte), `tools/cybertruck-sync.mjs`, contrato `tools/cybertruck-check.mjs` |
| 2. Lab mínimo | Hecha: `src/ui/cybertruckLab.js`, botón y **U**, carga diferida con progreso correcto, renderer guardado y restaurado, teclado en captura |
| 3. Funciones del visor | Hecha: explosión por etapas, selección y ficha, aislar/ocultar/encuadrar, sistemas, lista con búsqueda, datos, suelos, entornos, reflejo en calidad alta |
| 4. Calidad y rendimiento | Hecha la parte medible aquí: dibujo bajo demanda, sombras en caché, calidad por nivel; `?perf=log` listo para medir en la GPU del usuario |
| 5. Documentación | Hecha en los dos repositorios |
| 6. Cierre | Check completo, empujes, CI y Pages en verde en cada bloque |

**Hallazgos de `cybertruck` (§5):** corregidos C1, C2, C3, C4, C5, C7, C8, C9, C10, C11, C12, C13, C20, C21, C22 (con las
aperturas), C23 (fuera el `shadow.radius` sin efecto) y C24. Pendientes: C14 (etapas
desequilibradas; requiere reexportar con etapas nuevas), C19 (Git LFS, decide el usuario). Info sin acción: C15–C18.

**Hallazgos de `spacex` (§6):** corregidos S1 (fase 1), S2, S3 (documentado y prueba del Lab en su propio trabajo de
CI), S4, S5, S6, S7, S8, S13 y S14. Pendientes a decisión del usuario: S10 (partir archivos grandes), S11 (ramas
antiguas), S12 (galería de capturas).

**Mejoras (§8):**

- Hechas: M-CT2 (UV de ruedas y frenos: 0 errores de Khronos), M-CT4 (aperturas en el visor y en el Lab; alturas de
  suspensión como datos), M-CT5.2 (bloom en el Lab), M-CT7.2 y M-CT7.3 (explosión por sistema y línea guía en el Lab),
  M-CT8 (figura de 1,80 m en el Lab), M-CT9.1–9.2 (dibujo bajo demanda en el visor y en el Lab), M-FL1 (= S14), M-FL2
  (caché de texturas entre visitas: 4,6 s → 0,7 s en SwiftShader, idénticas píxel a píxel), M-FL8 (`?perf=log`).
- Medido: el Lab explosionándose hace 6.257 llamadas de dibujo por fotograma (§4.6 lo estimaba en 4.000–6.000).
- Pendientes: las que cambian la imagen y piden capturas aprobadas (M-IMG1–M-IMG7, M-CT3, M-CT5.1 y 5.3), M-CT1
  (oclusión ambiental del Cybertruck, un horneado largo en Blender), M-CT6 y M-V1–M-V6 (necesitan fuentes o Blender),
  M-CT7.1 y 7.4, M-CT9.3–9.5, M-DIN1–M-DIN4 y M-FL3–M-FL6 (mejor tras medir con `?perf=log` en la GPU del usuario).
