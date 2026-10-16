# Auditoría de Claude — 16-10-2026, 17.14 CEST (revisión 2)

Documento de revisión del repositorio `alvarodesigns34/spacex` en el estado del commit `247bb30` («Audi Lab: A3 Sportback 8V model v0.4 with real hinges from the asset»), publicado el 16-10-2026. **Sustituye a la primera versión** (16-10-2026, 00.33 CEST, sobre `36edb55`), que se subió en el commit `78fdf13`. Está redactado como documentación: observaciones, riesgos y consejos. No es una lista de órdenes y no se ha modificado ningún archivo de código o de datos; lo único que cambia en el repositorio es este documento.

El archivo conserva el nombre «AUDITORÍA DE CLAUDE 16-10-2026 …» (sin barras, porque `/` no es válido en un nombre de archivo) y lleva ahora la hora en que se terminó esta revisión.

---

## 0. Registro de revisión

### 0.1 Qué ha cambiado en el repositorio desde la primera versión

Entre `36edb55` y `247bb30` hay dos commits: el de la primera auditoría y el de la v0.4 del Audi. Este último toca tres archivos:

- `assets/audi/a3_sportback_8v.glb`: de 55 906 088 a 57 661 556 bytes (+3,1 %).
- `src/ui/audiLab.js`: +12 / −4 líneas. El Lab lee ahora el extra `hinge` de cada grupo del GLB y solo recurre a la estimación por caja envolvente (`HINGES`) si el modelo no lo trae.
- `README.md`: +10 líneas. Es la primera vez que el Audi Lab aparece en la documentación (línea 48 y sección de las líneas 385–392).

El modelo se generó en el repositorio `audi` (commits `9119e83`, `8ecbe9b` y `bdee7e7`, 16-10 entre las 15:30 y las 15:49).

### 0.2 Correcciones a la primera versión

Estas afirmaciones de la versión de las 00.33 eran inexactas, estaban incompletas o han dejado de ser ciertas:

1. **«Los límites de presupuesto se han subido dos veces» (§9) era incorrecto.** El historial de `tools/check.mjs` muestra que los `LIMITS` se tocaron en diez commits entre el 25-09 y el 13-10. Triángulos: 2,2 M (20-09) → 2,8 M (25-09) → 3,2 M (02-10) → 3,6 M (03-10) → 4,5 M (04-10) → 6,0 M (13-10), es decir, cinco subidas. Mallas: 1 400 → 1 600 → 1 800 → 2 200 → 2 600. Materiales: 160 → 200 → 240 → 200 → 240 → 290 → 340 → 420 (con una bajada intermedia). Texturas: 120 → 150 → 120 → 140 → 160 → 220 → 260. Lo que en la primera versión figuraba como «dos subidas» era solo el último escalón.
2. **«El Audi Lab no figura en la documentación» (§1, §3.4, §8, §11) ya no es cierto** desde `247bb30`: el README lo documenta. Sigue siendo cierto para `TRASPASO.md`, `CLAUDE.md`, `package.json` e `index.html` (ver §4).
3. **«No consta de dónde sale el modelo» (§3.4)**: ahora el README dice que procede del repositorio `audi` y que es copia de su `docs/models/a3_sportback_8v.glb`. Quedan sin documentar la licencia y la autoría de las medidas y fotos de referencia.
4. **`docs/hud` «de la misma época» (§4)** era una inferencia; ahora está comprobado: se regeneró el 02-10, igual que las capturas.
5. **Cifras que se han actualizado, no porque estuvieran mal sino por el paso del tiempo:** Audi 55,9 → 57,7 MB; `assets/` ≈150 → ≈152 MB; `.git` ≈305 → ≈344 MB; commits 332 → 334; CI y Pages ahora en `247bb30`.
6. **La primera versión no analizó la ruta de carga del Audi Lab con un servidor que comprime**, que es como lo sirve GitHub Pages. Al hacerlo aparece un fallo real de doble descarga (§3.1).
7. **Lo que sí se mantiene tras recomprobarlo:** la ausencia de H2R, Model Y y Audi en la galería y en los guiones de capturas, las 68 imágenes referenciadas sin enlaces rotos, los recuentos desfasados de `README.md`, `TRASPASO.md`, `CLAUDE.md`, `package.json` e `index.html`, el presupuesto (el Audi es diferido y no entra), la sobrestimación de `textureMB`, las rutas locales con nombre de usuario en `TRASPASO.md` (líneas 22, 591 y 593) y los recuentos de ramas y autores.

### 0.3 Alcance, método y límites

**Qué se ha hecho**

- Lectura completa de `CLAUDE.md` y `TRASPASO.md` (1 230 líneas), de las partes de `README.md` sobre el estado actual, las pasadas de Blender, las auditorías anteriores, la galería, la estructura y el rendimiento, y de la sección nueva del Audi.
- Lectura del código de integración (`src/main.js`, `src/ui/audiLab.js` completo, `src/vehicles/modelyAsset.js`, partes de `f16.js`, `core/quality.js`, `tools/check.mjs`, `tools/census.mjs`, `tools/audi-lab-check.mjs`, `pages.yml`, `package.json`) y de los documentos y el generador del repositorio `audi` (README, `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/REVISION_FORMA.md`, `tools/`, partes de `src/a3/`).
- Ejecución de `npm run check:static` y de la comprobación de escena (`node tools/check.mjs`), un censo propio por expositor, un análisis de texturas, **un análisis del GLB del Audi** (triángulos, mallas, materiales, imágenes, extras `hinge`), **una reproducción de la descarga del Audi Lab con un servidor que comprime** y capturas del Lab cerrado y abierto desde cinco ángulos. Los scripts auxiliares se ejecutaron fuera del repositorio.
- Búsqueda de exportaciones sin uso, enlaces locales rotos del README y scripts de `package.json` sin destino.
- Consulta de CI y Pages con `gh` y `curl`, y contraste de un dato físico con Wikipedia.

**Qué no se ha hecho o no se puede afirmar**

- **No hay GPU real**: todo el renderizado se ha hecho en software (Chromium con SwiftShader, 2 CPU). Los tiempos de arranque (63–79 s) y cualquier medida de coste por fotograma **no** son representativos de un equipo con GPU. Por eso tampoco se ha medido el coste de dibujo del Audi.
- **`tools/audi-lab-check.mjs` no se pudo ejecutar con éxito aquí**: se probó tres veces y se agota el tiempo en el primer clic sobre `#audi-btn` (§3.5). No se ha establecido la causa; lo más probable es el entorno (análisis de 57 MB con renderizado por software), pero no se ha demostrado.
- Las comprobaciones `check:ux` y `check:lod` no se ejecutaron localmente; su estado se toma de CI (verde en `247bb30` en las cinco ramas de trabajo).
- No se ha leído línea a línea todo el código (≈2,9 MB en `src/`), ni se han auditado los 12 vehículos geometría a geometría, ni se han contrastado de nuevo las cifras físicas de cada ficha con sus fuentes. Se revisó el sistema de procedencia y que sus pruebas pasen, y se contrastó **un** dato (§5.1).
- **El Audi no se ha evaluado como obra de modelado.** Se ha comprobado que la integración de las bisagras funciona y que las capturas abren los paneles de forma plausible; no se ha comparado la geometría con fotos del coche real ni se ha juzgado su realismo.
- El contenido de los extras `hinge` se ha comprobado contra el código del Lab (ids y convenciones de signo), no contra un Audi A3 real.

---

## 1. Resumen

| Aspecto | Valoración |
|---|---|
| Estado técnico | Sólido. Todas las comprobaciones ejecutadas pasan; CI y Pages en verde en las cinco ramas de trabajo. |
| **Fallo confirmado** | **El Audi Lab descarga su GLB dos veces cuando el servidor comprime (Pages lo hace).** Reproducido; ninguna comprobación del proyecto puede verlo (§3.1). |
| Audi v0.4 | La integración de las bisagras funciona. El modelo es el más pesado del repositorio (≈1,98 M de triángulos, ≈57,7 MB) y está fuera del presupuesto y de la procedencia; por su propia documentación, interior, mecánica y bajos siguen aproximados (§3). |
| Documentación | La parte más desfasada. Los recuentos (expositores, ramas, presupuesto, pesos) no coinciden entre `README.md`, `TRASPASO.md`, `package.json`, `index.html` y `CLAUDE.md`; el Audi Lab figura solo en el README (§4). |
| Galería de capturas | Desfasada: última regeneración 02-10-2026; sin H2R, Model Y ni Audi Lab, con el Porsche procedural anterior a Blender y sin entradas en los guiones (§6). |
| Datos | Un valor probablemente erróneo (Isp del Merlin Vacuum, 397 s) que lleva en el repositorio desde el primer commit y que el sistema de procedencia no puede detectar (§5.1). |
| Uniformidad del nivel | Dos «ligas»: los tres vehículos de Blender (≈2,5 M de triángulos) frente a los procedurales de SpaceX (8 k–770 k). Con el Audi (≈2 M) la liga alta se vuelve cuatro vehículos. |
| Presupuesto de escena | ≈87 % en triángulos y ≈86 % en materiales; un `.glb` más desde el arranque volvería a rebasarlo. Los techos se han movido diez veces en tres semanas (§8.3). |
| Medición | `textureMB` sobrestima ≈11 veces la memoria de texturas (§7.2). |
| Reproducibilidad | Parcial: insumos de Blender fuera del repositorio; el Audi se genera en otro repositorio. |
| Higiene | Historia de 344 MB, sin aviso de marcas ni de no afiliación, flujo de CI con permisos globales y acciones por etiqueta (§9). |

---

## 2. Estado verificado

### 2.1 Comprobaciones ejecutadas

- `npm run check:static`: **221 comprobaciones PASS, 0 FAIL** (lint, procedencia, físicas, sonido, viento, misión, servidor estático).
- Comprobación de escena (`node tools/check.mjs`, Playwright + SwiftShader): **código de salida 0**, consola limpia, sin caras del revés en F-16, Porsche y H2R, sin triángulos de normal nula tras el saneado (433 saneados al arrancar, en 36 geometrías). Medida sobre `36edb55`; los cambios posteriores no tocan la escena principal (el Audi es diferido), por lo que no se repitió.
- CI: verde en `247bb30` en las cinco ramas de trabajo y Pages desplegado con ese commit.
- README: 66 enlaces locales, todos existentes. Los 14 scripts de `package.json` apuntan a archivos que existen.

### 2.2 Presupuesto de la escena

Cifras de `tools/check.mjs` contra sus `LIMITS` (línea 906):

| Magnitud | Medida | Límite | Uso |
|---|---|---|---|
| Triángulos construidos | 5 249 727 | 6 000 000 | ≈87,5 % |
| Triángulos dibujados (vista general) | 4 140 174 | — | — |
| Mallas | 1 836 (1 336 dibujadas) | 2 600 | ≈70,6 % |
| Materiales | 363 | 420 | ≈86,4 % |
| Texturas (recuento del gate) | 168 | 260 | ≈64,6 % |

Un recuento independiente con `sceneCensus` da cifras próximas (5 236 130 triángulos, 1 844 mallas, 371 materiales); no se ha investigado la diferencia de <1 % y no se interpreta como contradicción.

### 2.3 Reparto por expositor (calidad alta, medido)

| Expositor | Triángulos | Mallas | Origen |
|---|---:|---:|---|
| Starship | 769 172 | 106 | procedural |
| Pad 2 / complejo | 95 000 | 98 | procedural |
| Falcon 1 | 57 072 | 89 | procedural |
| Falcon 9 | 63 350 | 54 | procedural |
| Falcon Heavy | 151 586 | 117 | procedural |
| Dragon | 52 128 | 41 | procedural |
| Starlink | 8 032 | 68 | procedural |
| Roadster | 288 867 | 272 | procedural |
| Fila de motores | 59 924 | 29 | procedural |
| F-16A | 82 003 | 126 | procedural |
| Porsche 911 GT3 RS | 590 136 | 192 | `.glb` de Blender |
| Kawasaki Ninja H2R | 694 544 | 194 | `.glb` de Blender |
| Tesla Model Y | 1 208 054 | 120 | `.glb` de Blender |
| *Audi A3 Sportback 8V (Lab, diferido)* | *1 979 915* | *856 en el GLB* | *`.glb` generado en el repositorio `audi`* |

Los tres vehículos de Blender de la escena principal concentran ≈2,49 M de los ≈5,24 M triángulos (≈47 %) y no están registrados con `lodFeature`. **El Audi, con ≈1,98 M, tiene más triángulos que cualquiera de ellos y no entra en estas cifras ni en el gate**: si estuviera en la escena principal, el total pasaría de 7,2 M frente a un techo de 6 M. Que sea diferido es lo que lo mantiene fuera; conviene tenerlo presente al leer «87 % del presupuesto».

---

## 3. Audi Lab: revisión de la v0.4

### 3.1 Hallazgo principal: descarga doble con un servidor que comprime

**Qué ocurre.** `fetchAsset()` (`src/ui/audiLab.js`, líneas 231–247) lee `Content-Length` como tamaño total, reserva un `Uint8Array` de ese tamaño y copia en él los fragmentos que llegan. Cuando el servidor comprime (GitHub Pages sirve los `.glb` con `content-encoding: gzip`), `Content-Length` es el tamaño **comprimido**, pero los fragmentos que entrega el navegador son los bytes **ya descomprimidos**. En cuanto lo leído supera el total, la línea 241 abandona la lectura y vuelve a pedir el archivo entero (`return (await fetch(AUDI_ASSET)).arrayBuffer()`). El comentario del propio código reconoce el caso («a compressed transfer: sizes do not match»); lo que falla es la manera de resolverlo.

**Lo reproducido.** Con un servidor local que comprime y entrega `Content-Length` comprimido como Pages (GLB de 57 661 556 B; ≈41,98 MB comprimidos en la prueba), cargando la página real y abriendo el Lab en Chromium:

- El servidor recibió **dos peticiones** del GLB, ambas servidas completas.
- Bytes enviados por la red: **≈80,1 MB frente a ≈40,0 MB** que costaría una sola descarga.
- El modelo termina cargando bien (45 grupos), de modo que el fallo es de coste, no de funcionamiento.

**Matices honestos.**
- El servidor de la prueba no envía `cache-control`; Pages envía `max-age=600`. La primera respuesta se abandona a medias y, en principio, un navegador no guarda en caché una respuesta sin terminar de leer, pero **no se ha probado** con las cabeceras de Pages, así que el sobrecoste real en producción puede ser algo menor que el medido.
- El código no llama a `reader.cancel()` antes de volver a pedir (lectura del código; en la prueba el servidor terminó de enviar la primera respuesta).
- De la lectura del código, no de una observación visual: en el momento del reinicio la barra está en torno al 90 % con un texto del tipo «40 / 40 MB» y la segunda descarga se hace sin ningún indicador de progreso.

**Por qué nada lo detecta.** La comprobación del Lab (`tools/audi-lab-check.mjs`) y el servidor de pruebas del proyecto sirven el GLB sin comprimir, así que `Content-Length` coincide con los bytes leídos y la rama de reintento no se ejecuta. Solo ocurre en producción.

**Consejo (vía posible, no orden).** El caso se resuelve sin segunda petición si, cuando los tamaños no cuadran, se sigue leyendo la misma respuesta y se deja de usar `Content-Length` como tamaño de reserva (por ejemplo acumulando los fragmentos en una lista y uniéndolos al final), mostrando el progreso solo cuando el tamaño sea fiable.

**Hallazgo vecino, no verificado en navegador.** El visor del repositorio `audi` (`docs/index.html`, three 0.160.0) calcula su barra de progreso con `e.loaded / e.total` del cargador. Con la misma combinación (`Content-Length` comprimido, bytes descomprimidos) la barra podría superar el 100 %. Es una inferencia a partir del código del cargador, no se ha comprobado visualmente. No se ha mirado si los cargadores de los `.glb` del arranque de `spacex` sufren lo mismo en su barra.

### 3.2 Integración de las bisagras: funciona

- Los 45 grupos `G_<id>` conservan sus ids y extras (`group`, `label`, `explode`); coinciden con `CATEGORIES` y `HINGES`.
- Seis grupos llevan el extra `hinge` (`pivot`, `axis`, `angle`, `source: "E"`): `puerta_di`, `puerta_dd`, `puerta_ti`, `puerta_td`, `capo` y `porton`. Pivotes: capó (−0,4; 0,9; 0), portón (−2,7; 1,365; 0), puertas delanteras (−0,5; 0,62; ±0,83), traseras (−1,6; 0,62; ±0,815, con el eje inclinado ≈−0,063). Ángulos: ±62° delanteras, ±60° traseras, 50° capó y −75° portón.
- El código del Lab usa el extra cuando existe y la estimación por caja envolvente si no; los signos de giro son coherentes con el lado de cada puerta.
- En las capturas (cerrado en tres cuartos, y abierto desde arriba, delante, detrás y de perfil izquierdo) las puertas, el capó y el portón se abren de forma plausible, sin interpenetraciones evidentes a esa distancia.

Observaciones menores:

- **Pivotes con valores redondos.** Varios (−0,4; 0,9; −2,7; −0,5) son cifras redondas, lo que sugiere, aunque no lo prueba, que se fijaron a ojo o por redondeo más que punto a punto. El README habla de pivotes «en las líneas de junta reales, unos 30 mm por dentro de la chapa»; la redacción es más segura que lo que el dato lleva, porque el propio GLB marca cada bisagra con `source: "E"` (estimación según la convención del proyecto `audi`). El encabezado del README dice «bisagras reales»; con la convención de procedencia del repositorio sería más exacto «bisagras estimadas».
- **Sin prueba de contrato.** Ninguna comprobación automática verifica que el GLB traiga el `hinge` ni que el Lab lo use: si una regeneración futura lo perdiera, el Lab volvería en silencio a las estimaciones.

### 3.3 El GLB del Audi (medido)

| Dato | Valor |
|---|---|
| Tamaño | 57 661 556 B (≈55,0 MiB); ≈42 MB comprimido con gzip en la prueba |
| Triángulos | 1 979 915 |
| Mallas | 856 en el glTF (934 objetos `Mesh` en el Lab) |
| Materiales | 83, **todos `doubleSided`**, 6 con transmisión |
| Imágenes | 25 PNG; unos ≈119 MB de memoria de texturas descomprimida (estimación `ancho × alto × 4 × 1,33`) |
| Ruedas | 131 560 triángulos cada una; las cuatro suman ≈26,6 % del modelo |

Lectura:

- **Es el modelo más pesado del repositorio**, un 64 % por encima del Model Y en triángulos (1,98 M frente a 1,21 M) y el mayor archivo.
- **Tamaño de archivo por encima del aviso de GitHub.** El GLB supera los 50 MiB a partir de los que GitHub avisa en cada subida (el límite duro son 100 MiB). Hay dos versiones de él en la historia (≈55,0 y ≈53,3 MiB). No impide nada hoy, pero cada iteración del modelo añade ≈40 MB comprimidos a la historia.
- **83 de 83 materiales a doble cara.** Anula el descarte de caras traseras en carrocería y piezas cerradas y duplica trabajo de rasterizado; es habitual cuando el exportador deja `doubleSided` por defecto. No se ha comprobado si está justificado en todas las piezas ni cuánto cuesta en una GPU real.
- **Transmisión en 6 materiales.** En Three.js cada material con transmisión obliga a un pase extra de la escena opaca; con una malla de 2 M de triángulos esto puede pesar en GPUs modestas. Sin medir.
- **Ruedas.** Un cuarto del modelo está en cuatro ruedas idénticas; instanciarlas en el GLB ahorraría memoria, pero no triángulos dibujados. Es una observación sobre el peso, no sobre la calidad.

### 3.4 Coste en memoria y calidad fija

Lectura de `audiLab.js` (sin medir en GPU):

- **El modelo no se libera al cerrar el Lab.** Es razonable para reabrir sin redescargar, pero deja en memoria ≈2 M de triángulos y ≈119 MB de texturas estimadas junto a la escena principal (≈0,5 GB de texturas estimadas, §7.2), en una pestaña pensada para ordenador.
- **Sombras de 4096² y MSAA de 4 muestras fijos** en `buildScene`, sin seguir el ajuste de calidad del resto de la aplicación (`core/quality.js`). En un equipo justo, el Lab será la pantalla más costosa de todo el proyecto y no tiene escalón de bajada.
- **Carga diferida correcta:** el GLB solo se pide al abrir el Lab. El manejador de teclado se registra en fase de captura y detiene la propagación, de modo que no interfiere con el resto.

### 3.5 La comprobación `tools/audi-lab-check.mjs`

- No está enlazada desde `package.json` ni desde `.github/workflows`: ni `npm run check` ni CI la ejecutan.
- No hace ninguna afirmación sobre `hinge`.
- Sirve el GLB sin comprimir, así que **aunque estuviera en CI no detectaría el fallo de §3.1**.
- En este entorno se agota el tiempo en `page.click('#audi-btn')` (tres intentos). Con renderizado por software y 2 CPU es verosímil que sea cuestión de entorno; no se ha investigado más ni se afirma que el código falle.

### 3.6 Lo que sigue pendiente del propio Audi (según su documentación)

El repositorio `audi` lista honestamente lo que queda (`docs/STATUS.md`, «Estado exacto al cerrar la sesión (v0.4)» y «Errores y carencias conocidos»):

- Interior: salpicadero, asientos S line y paneles de puerta aproximados; botoneras del volante y radio inferior simplificados.
- Mecánica y bajos: estimados (E); no hay fotos de bajos ni del vano motor.
- Extremos del alerón y punta de los retrovisores: forma aproximada (E).
- Luneta: reflejo de la caja de luz del estudio en vistas traseras (no es geometría); lunas sin oscurecer, pregunta abierta.
- Capó: reflejos ondulados cerca de los faros; manetas con el hueco demasiado grande; línea «tornado» poco marcada.
- Sin emblemas traseros de modelo.

**Relación con el objetivo declarado** («todas las piezas de verdad, materiales, formas, todo»): la v0.4 es una ronda de correcciones (zaga, retrovisores medidos, faros, volante, bisagras), no un cierre. Por su propia documentación, interior, mecánica y bajos siguen sin llegar a ese listón; conviene no leer el «v0.4» del README de `spacex` como «terminado».

**Pequeños desfases en `audi`:** `docs/HANDOFF.md` (hacia la línea 109) todavía manda leer `docs/STATUS.md` como «estado v0.3»; ese documento ya describe la v0.4. La sesión que hizo la v0.4 sí usó una escena de Blender abierta por MCP para la revisión de forma (lo recogen `STATUS.md` y `HANDOFF.md`).

### 3.7 Datos del Audi fuera del sistema de procedencia

El sistema de procedencia de `spacex` (grados A–D, etiquetas de fuente y aproximación, comprobado por `tools/provenance-check.mjs`) **no cubre** al Audi: sus etiquetas, medidas y la convención E/S viven en el repositorio `audi` y dentro del GLB. En el Lab, el texto y las etiquetas están en español «por decisión del propietario» (lo dice el propio código); es deliberado, pero rompe la regla de interfaz en inglés del resto de la aplicación.

---

## 4. Documentación: desfases y contradicciones

Se anotan con archivo y línea tal y como están en `247bb30`. Ninguna es grave por sí sola; juntas hacen que quien retome el proyecto lea tres versiones distintas del estado.

### 4.1 Recuentos

- `package.json` (descripción, línea 5): «diez expositores: ocho de SpaceX, un F-16A Block 15 y un Porsche 911 GT3 RS». Faltan H2R, Model Y y Audi Lab.
- `README.md` línea 3: no menciona el Model Y. **Línea 26** afirma que «todo el modelo es procedural (sin binarios), salvo la H2R, el Model Y y el Porsche»; el Audi (otro `.glb`, el mayor, de 57,7 MB) no figura en esa excepción, de modo que la frase contradice a la sección que el propio README tiene ahora sobre el Audi Lab.
- `README.md` línea 40 y `TRASPASO.md` línea 11: «Once expositores». Con el Model Y son doce, y el Audi Lab es un decimotercer modelo con otro tratamiento.
- `README.md` línea 40, `TRASPASO.md` línea 12 y `CLAUDE.md` línea 6: «las seis ramas»; `CLAUDE.md` línea 5 enumera **cinco**. Las ramas remotas son quince (§9).
- `index.html` (metadescripción, línea 7): solo lista Starship, Falcon 9, Falcon Heavy, Dragon, Starlink, Roadster y motores.
- `src/core/quality.js` línea 4: el comentario habla de «1.1 M triangles, ~800 meshes»; hoy son ≈5,2 M y ≈1 840.

### 4.2 Cifras que han cambiado

- Presupuesto: `README.md` línea 44 y `TRASPASO.md` línea 17 citan el CI del 13-10 (5 073 256 / 1 810 / 354 / 157). El estado vigente es 5 249 727 / 1 836 / 363 / 168.
- Peso de la H2R: `TRASPASO.md` línea 13 dice 35,6 MB; hoy ≈40,2 MB.
- Pesos que traspaso y README no recogen: Model Y ≈32,6 MB, Porsche ≈28,1 MB (+ ≈0,3 MB de rótulos). El Audi (≈57,7 MB) sí consta en la sección nueva del README.

### 4.3 Estado del propio traspaso

- La cabecera de «Empieza aquí» dice «estado real al 08-10-2026», pero el bloque contiene pasadas del 13, 14 y 15 de octubre.
- `TRASPASO.md` línea 33 da la fase 3 de la H2R como «hecha» y la línea 37 como «aparcado: el resto de la fase 3». Pueden ser compatibles, pero tal y como están escritas parecen contradecirse.
- `TRASPASO.md` línea 20 deja A4, A5 y A6 de la auditoría del 8-10 «aparcadas; obligan a regenerar el `.glb`». El `.glb` se regeneró después; el documento no dice si quedaron resueltas.
- **El Audi Lab no aparece** en `TRASPASO.md` ni en `CLAUDE.md`, que son los dos documentos que `CLAUDE.md` manda leer al retomar. Quien empiece por ahí no sabrá que existe la tecla **U**, el repositorio `audi` ni el hallazgo de §3.1.
- `TRASPASO.md` líneas 22, 591 y 593 incluyen rutas locales de Windows con el nombre de usuario del equipo del autor (no se reproducen aquí).

---

## 5. Datos y contenido

### 5.1 Merlin Vacuum: impulso específico de 397 s, probablemente erróneo

`src/data/specs.js` da «1 Merlin Vacuum · 981 kN · 397 s» para la segunda etapa del Falcon 9 (línea 239) y del Falcon Heavy (línea 279), y «981 kN / 397 s» en la ficha de motores (línea 443), los tres con fuente `spacex` (grado A en el sistema de procedencia).

- Wikipedia (consultada el 16-10-2026) da para el motor Merlin Vacuum **348 s** en el texto del artículo y 342 s para el anuncio de 2009; la casilla resumen del artículo muestra 311 s, que contradice a su propio texto. **Ninguna fuente consultada da 397 s.**
- La página `spacex.com/vehicles/falcon-9` no devuelve contenido legible para la consulta (solo metadatos), así que **no se ha podido confirmar ni refutar** el valor contra la fuente primaria que el proyecto cita.
- El valor está en el repositorio desde el primer commit (02-09).
- Como lleva la etiqueta de la fuente oficial, ninguna comprobación del proyecto puede marcarlo: las pruebas de procedencia verifican que la etiqueta exista, no que el número sea el de la fuente.

Conviene contrastarlo con una fuente primaria. La cifra de 981 kN sí coincide con la de la casilla de Wikipedia.

### 5.2 Otros datos ya señalados

Siguen vigentes los datos declarados como supuestos en el traspaso (altura de la torre, 17 s finales con 3 motores, masa seca e Isp de la nave tras la separación, pinzas del Falcon 1, ventanas del Dragon). Están marcados como ≈ o supuestos en el sistema de procedencia; no se han contrastado de nuevo.

---

## 6. Galería de capturas

**Confirmado: está desfasada**, y por más de un motivo.

- `docs/screenshots` contiene 68 imágenes y coincide uno a uno con las 68 referencias del README (sin huérfanas ni enlaces rotos). Última regeneración: **02-10-2026** (también `docs/hud`).
- No existe ninguna captura de la **H2R**, del **Model Y** ni del **Audi Lab**, y los guiones (`tools/docs-shots.json`, `launch-shots.json`, `roadster-shots.json`, …) **no tienen entradas** para ellos: `npm run shots` tal cual no los produciría.
- Las ocho capturas del Porsche (`gt3rs*.jpg`) muestran el modelo procedural anterior al paso a Blender (15-10), y lo mismo ocurre con cualquier captura de detalles que cambiaron después del 02-10 (panel de misión, botón *Walk*, trayectoria de la nave, fuego, botón *Guide*, encuadre de la granja de tanques).

**Contexto de la regla.** `CLAUDE.md` (línea 9) impide regenerar la galería sin aprobación; esa es la razón de que esté así. Lo que se anota es el alcance cuando se apruebe: no basta con relanzar `npm run shots`, hay que añadir antes los encuadres de los vehículos nuevos.

---

## 7. Rendimiento y carga

### 7.1 Peso de los activos

| Archivo | Tamaño | Notas |
|---|---:|---|
| `assets/audi/a3_sportback_8v.glb` | ≈57,7 MB (≈42 MB con gzip) | Diferido (Audi Lab); descarga doble con compresión (§3.1) |
| `assets/h2r/h2r.glb` | ≈40,2 MB (≈14,5 MB con gzip local) | Al arrancar |
| `assets/modely/modely.glb` | ≈32,6 MB (≈21,3 MB con gzip local) | Al arrancar |
| `assets/gt3rs/gt3rs.glb` | ≈28,1 MB | Al arrancar |
| `assets/gt3rs/markings.glb` | ≈0,3 MB | Al arrancar |
| Total `assets/` | ≈152 MB en disco | — |

- Los `.glb` del arranque suman ≈101 MB sin comprimir y del orden de 46–48 MB comprimidos (estimación con gzip local). El análisis y la subida a la GPU ocurren siempre; en `src/main.js` esos constructores se esperan dentro del bucle de carga (líneas ≈408–416), de modo que su tiempo se suma al arranque en frío.
- GitHub Pages sirve los `.glb` con `content-encoding: gzip` y `cache-control: max-age=600`; esa política no se controla desde el repositorio.
- Con 57,7 MB, el Audi está al ≈58 % del límite duro de 100 MB por archivo de GitHub y por encima del umbral de aviso de 50 MiB.

### 7.2 Memoria de texturas: la métrica `textureMB` induce a error

`tools/census.mjs` (líneas 74–80) estima la memoria de texturas como `ancho × alto × 4 × 1,33` **por objeto `Texture`**. En el HEAD da **5 741 MB**. Comprobado:

- Hay 234 objetos `Texture`, de ellos **49 de 4096×4096**, todos mapas de oclusión, que suman ≈5,4 GB de los 5,7 GB.
- Esos 49 comparten solo **2 imágenes** (un atlas del Porsche y otro del Model Y). Three.js sube a la GPU cada `Source` una vez.
- Contando fuentes únicas (123), la estimación baja a **≈495 MB** (RGBA8 con mipmaps, sin compresión de GPU); `renderer.info.memory.textures` indica 165 texturas en GPU.

La memoria real es del orden de medio gigabyte, no de casi seis. Aun así es mucho para equipos integrados; los dos atlas de 4096² (≈85 MB cada uno) son los mayores consumidores. Mientras la métrica cuente por objeto no sirve para vigilar la memoria ni como gate. No se ha cambiado: es una observación.

### 7.3 LOD

`lodFeature` está registrado en el Roadster, la nave, el Falcon 1, la fila de motores y el pad, entre otros; **no** en Porsche, H2R ni Model Y (≈47 % de los triángulos), ni, por supuesto, en el Audi. Los `.glb` llegan como mallas con nombre, lo que sugiere que registrarlas en el gestor de LOD sería viable; no se ha probado.

### 7.4 Otros apuntes

- `index.html` no declara una política de seguridad de contenido (CSP). Para un sitio estático sin entrada de usuario el riesgo es bajo.
- El despliegue copia `index.html src vendor docs assets`: `docs/` (≈17 MB, galería incluida) se publica; `LICENSE` y `README.md` de la raíz no. `vendor/three/LICENSE` sí viaja con `vendor/`.

---

## 8. Calidad por expositor y pendientes

### 8.1 Calidad frente al listón de «hiperrealismo»

Valoración orientativa basada en lo medido y en lo que el proyecto documenta; no sustituye a una revisión visual con GPU real.

- **Porsche 911 GT3 RS (Blender, conducible).** 590 k triángulos, llantas de cinco radios en Y, rótulos del Cup 2 R, AO horneada. Pendientes menores (frontal).
- **Kawasaki Ninja H2R (Blender, conducible).** 695 k triángulos; la fase 3 de materiales con mapas propios sigue pendiente.
- **Tesla Model Y (Blender, estático).** 1,21 M de triángulos, el más pesado de la escena principal; se queda corto en comportamiento (estático) y en procedencia (grado C).
- **Audi A3 Sportback 8V (Lab).** ≈2 M de triángulos; vista despiezada con bisagras. Interior, mecánica y bajos aproximados según su propia documentación (§3.6).
- **Starship y Pad 2.** 769 k + 95 k triángulos; el expositor con más ambición física y con más hipótesis marcadas como ≈. Su riesgo es de datos supuestos, no de geometría.
- **Roadster.** 289 k triángulos y 272 mallas; es el siguiente en el orden de Blender.
- **Falcon 1, Falcon 9, Falcon Heavy, Dragon, fila de motores, Starlink, F-16.** Entre 8 k y 152 k triángulos. El número de triángulos no mide el parecido con el real, pero la diferencia de un orden de magnitud con los vehículos de Blender se nota en el presupuesto y, previsiblemente, en pantalla. El Starlink (8 032 triángulos, 68 mallas) y el tren del F-16 (puertas planas, patas cilíndricas) son los puntos donde la distancia con el listón es más evidente sobre el papel.

Si el criterio es que **todo** alcance el nivel de los modelos de Blender, el trabajo restante es sustancial (nueve expositores más) y el presupuesto actual no lo admite sin subir los techos o introducir LOD en los `.glb`.

### 8.2 Pendientes consolidados

| Área | Pendiente declarado | Comprobado |
|---|---|---|
| Roadster y Starman | Siguiente en el orden de Blender | Sigue procedural (288 867 triángulos, `roadster.js` de 3 732 líneas); no hay `blender/roadster` |
| Raptor 3 en Blender | Aparcado, empezado y sin subir | `blender/raptor3` no existe; `blender/common/` no contiene `kit.py` |
| H2R | Resto de la fase 3, mecánica pieza a pieza, forma del carenado contra fotos | No verificado en el modelo |
| F-16 | Tren de aterrizaje (puertas planas, patas cilíndricas), luces, receptáculo, más paneles | **Confirmado el primero** (`f16.js`, ≈líneas 1150–1265) |
| F-16 | Despegue con postcombustión ≈15 % largo según una fuente secundaria; vuelco en tierra a ≈120 kt con alabeo a fondo | No verificado / no reproducido |
| Porsche | Frontal: paragolpes algo abombado | No verificado |
| Auditoría 08-10 | A4, A5, A6, código muerto del basculante, A24, A28 | No verificado; ver §4.3 |
| Datos | Torre, 17 s finales, nave tras separación, pinzas del Falcon 1, ventanas del Dragon | Etiquetados como supuestos/≈ |
| Decisión del usuario | Orientación del Pad 2 en espejo respecto a la geografía real | Abierta |
| Física y entorno | Encargo amplio del 04-10 | Abierto |
| Estructura | Modularizar `roadster.js`, `launch.js`, `main.js` (1 894 líneas), `@ts-check`, pruebas en WebKit y Firefox | Abierto |
| Audi | Interior, mecánica y bajos, alerón, reflejos (§3.6) | Declarado por el propio `audi` |
| Galería | Regenerar con aprobación (§6) | Pendiente de aprobación |
| Documentación | §4 | — |

El propio traspaso admite que el Model Y es estático y que sus datos proceden de una fuente de segunda mano (evspecifications, grado C); ambos puntos concuerdan con lo visto en el código.

### 8.3 Evolución de los límites de presupuesto

Los `LIMITS` de `tools/check.mjs` (`tris`, `meshes`, `materials`, `textures`) nacieron el 20-09 en 2,2 M / 1 400 / 160 / 120 y hoy son 6,0 M / 2 600 / 420 / 260. Cambiaron en diez commits (25-09, 29-09, 01-10 ×3, 02-10 ×2, 03-10, 04-10, 13-10), con subidas y alguna bajada de materiales y texturas. Es legítimo, y el gate sí detuvo un despliegue el 13-10, pero un techo que se desplaza con cada vehículo nuevo deja de indicar si hay un problema. Puede merecer anotar, junto a cada cambio, qué se compró con él. Además, como se vio en §2.3, el Audi quedaría fuera de cualquier techo mientras siga diferido.

---

## 9. Pipeline, CI, herramientas e higiene

### 9.1 Pipeline de Blender y reproducibilidad

- `blender/` (≈336 KB) contiene los scripts de la H2R, el Porsche y el Model Y, y utilidades comunes.
- Insumos que **no** están en el repositorio y que el traspaso reconoce: `blender/h2r/source/code-parts.glb` (se regenera con `node tools/h2r-export.mjs`), las fotos de referencia (correctamente, por derechos de autor), `scratch/` y el Raptor 3 aparcado. Reproducir un `.glb` desde cero requiere el entorno local del autor.
- **El Audi se genera en otro repositorio** (`audi`: `src/a3/`, `tools/run.py`, `publish.sh`, `blender.sh`) con `bpy` por código y se copia al repositorio de `spacex` a mano. Nada comprueba que la copia en `assets/audi/` sea la última publicada (hoy sí lo es: contenido idéntico a `audi/docs/models/`).
- El traspaso menciona `bpy==5.0.1` para la H2R y Blender 5.2.x en el equipo del usuario para el resto; mezclar versiones es fuente conocida de diferencias sutiles en materiales y exportación.
- `modelyAsset.js` reconstruye en carga materiales que no viajan en el archivo (pintura con barniz, cristales y ópticas por nombre): un renombrado en Blender degradaría el aspecto sin romper ninguna prueba, salvo que alguna compruebe esos nombres.
- Si el `.glb` no carga, el Model Y degrada a un grupo vacío, mientras H2R y Porsche tienen respaldo procedural.

### 9.2 CI y comprobaciones

- Cuatro trabajos en paralelo (`check:static`, `check:scene`, `check:ux`, `check:lod`) y despliegue condicionado a su éxito y solo desde la rama por defecto: buen diseño.
- Faltan en CI: `tools/audi-lab-check.mjs` (§3.5), `tools/profile-check.mjs` (no está referenciada en `package.json`, en los flujos ni en README o traspaso, aunque su propia cabecera la describe como una comprobación de regresión) y pruebas con WebKit o Firefox.
- **Endurecimiento del flujo de Pages (`pages.yml`):** `permissions` está declarado a nivel de flujo con `pages: write` e `id-token: write`, de modo que también los trabajos de comprobación los reciben; lo habitual es concederlos solo al trabajo de despliegue. Las acciones (`actions/checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`) están fijadas por etiqueta y no por SHA. Riesgo bajo en un repositorio personal; se anota por completitud.

### 9.3 Código

- Un script propio detecta **67 de 498 exportaciones** que ningún otro archivo importa. La mayoría se usan dentro de su propio módulo (exportadas sin necesidad). Al menos una, `inSideGlass` en `src/vehicles/gt3rs.js`, no se usa en ningún sitio. El resto de constantes y constructores listados (por ejemplo `GT3RS_ASSET`, `adoptH2r`, `buildShip`) se usan internamente. No es un defecto, pero indica superficie que podría recortarse.
- `src/vehicles/gt3rs.js` (1 870 líneas) es hoy sobre todo el respaldo procedural del Porsche.
- Sin marcadores `TODO`/`FIXME` en `src`, `tools` ni `blender`.

### 9.4 Ramas

Hay **quince ramas** remotas: las cinco de la política de empuje apuntan al mismo commit (`247bb30`); otras diez (`claude/gifted-bohr-7bjkq9`, `claude/keen-heisenberg-4zblxy`, `claude/new-session-pnlz3h`, `claude/pensive-ride-5sjdza`, `claude/project-thread-nm0zn7`, `claude/sleepy-cannon-a1exgi`, `claude/youthful-noether-0ihafx`, `codex/fix-camera-state`, `codex/roadster-visual-quality`, `grok/vehicle-center-visual-pass`) apuntan a commits más antiguos. No se ha medido cuánto se alejan de HEAD.

### 9.5 Peso de la historia

- `.git` ocupa ≈344 MB frente a ≈152 MB de `assets/`; creció ≈39 MB desde la primera versión de esta auditoría, lo que cuadra con la nueva versión del GLB del Audi (el empaquetado de git también influye; no se aisló la causa).
- Hay 16 versiones de `.glb` en la historia, que suman ≈427 MB sin comprimir (Audi ≈55,0 y ≈53,3 MiB; H2R hasta ≈38,4 MiB en 6 versiones; Model Y ≈31,0 MiB y otra menor; Porsche ≈26,8 MiB). El repositorio `audi` publica además, por versión, del orden de 127 MB de modelos (GLB y USDZ), según lo medido en su clon.
- Con cuatro modelos que se siguen iterando, el crecimiento es previsible y un clon completo ya es pesado. Un clon superficial (como el de esta auditoría) esquiva la historia, pero no el GLB vigente.

### 9.6 Licencia, marcas y datos personales

- La licencia es MIT a nombre del titular. Desde el 14-10 se han añadido a los vehículos logotipos y rótulos reales de marcas (por orden expresa del usuario) y el repositorio incluye modelos de Porsche, Kawasaki, Tesla, Audi y SpaceX. **No hay en README, `index.html` ni `CLAUDE.md` ningún aviso de marcas ni de no afiliación** (búsqueda de «afiliación», «no oficial», «trademark»). La licencia MIT cubre el código y los modelos propios, no concede derechos sobre marcas de terceros; conviene que el aviso exista, sobre todo al estar publicado.
- Los commits se reparten entre cuatro identidades de autor (275 de Claude, 29 del titular, 25 de otra identidad y 5 de Codex). No se reproducen aquí direcciones de correo; conviene que el usuario sepa qué metadatos de autor y qué rutas locales (§4.3) quedan expuestos en un repositorio público.

---

## 10. Puntos fuertes

- Cultura de verificación poco habitual: 221 comprobaciones estáticas, comprobaciones de escena con control negativo, pruebas de física por vehículo y un gate de presupuesto que ha detenido de verdad un despliegue.
- Sistema de procedencia (grados A–D y etiquetas) verificado por pruebas: lo supuesto aparece marcado como tal, también en la interfaz. (Su límite está en §5.1.)
- Documentación de método y lecciones aprendidas muy detallada; el traspaso permite retomar con poco contexto.
- Disciplina con reglas difíciles: sin PRs, escala 1:1, sin fotos con derechos en el repositorio, sin eludir antibots, sin enviar datos personales a servicios externos.
- Robustez de arranque: saneado de geometrías, recuperación de contexto WebGL, tolerancia a fallos de carga de `.glb`, consola limpia.
- **Documentación honesta del Audi en su propio repositorio:** las carencias de la v0.4 están listadas con su causa, su prioridad y qué es medido y qué estimado.
- Integración del Audi Lab ordenada: carga diferida, manejador de teclado en captura, y ahora bisagras tomadas del propio activo con respaldo en las estimaciones (un buen contrato: si falta el dato, sigue funcionando).
- README sin enlaces locales rotos (66 comprobados) y galería sin huérfanas.

---

## 11. Consejos de orden de lectura para quien retome el proyecto

1. Tomar `CLAUDE.md` y `TRASPASO.md` como punto de partida, sabiendo que sus recuentos están por detrás del código (§4) y que **ninguno menciona el Audi Lab**: para él, leer la sección del README (líneas 385–392) y los documentos de `audi`.
2. Tener presente que el Audi Lab es el mayor coste de carga y de memoria del proyecto y que queda fuera del presupuesto (§2.3, §3.3, §3.4); y que su descarga es doble en producción (§3.1).
3. Antes de añadir otro `.glb` pesado, medir con `node tools/check.mjs`: el margen en triángulos (≈0,75 M) y materiales (≈57) es corto.
4. Antes de fiarse de `textureMB`, tener presente la sobrestimación por atlas compartidos (§7.2).
5. Contrastar con fuente primaria el Isp del Merlin Vacuum (§5.1).
6. La galería exige primero ampliar los guiones de capturas y después la aprobación del usuario (§6).

---

## Apéndice: cómo se obtuvieron las cifras

- **Estático:** `npm run check:static` → 221 PASS, 0 FAIL.
- **Escena:** `node tools/check.mjs` → código 0. Presupuesto: «5.249.727 triángulos construidos, 4.140.174 dibujados en la vista general · 1836 mallas (1336 dibujadas) · 363 materiales · 168 texturas».
- **Reparto por expositor y texturas:** script de lectura contra `window.__vc` con `bootAtQuality(page, url, 'high')` y `sceneCensus({ perExhibit: true })` de `tools/census.mjs`, más un recuento de objetos `Texture` por `Source`. Chromium + SwiftShader, sin GPU real.
- **GLB del Audi:** lectura directa del contenedor glTF (triángulos por primitiva, materiales, imágenes, extras de nodo); tamaño en disco; idéntico al de `audi/docs/models/`.
- **Descarga doble:** servidor Node propio que comprime con gzip y envía `Content-Length` comprimido (como Pages), Chromium cargando la página real y abriendo el Lab; recuento de peticiones y bytes enviados por el servidor (80,1 frente a 40,0 MB).
- **Capturas del Lab:** cinco vistas con Chromium + SwiftShader, vistas solo para esta revisión (no se añaden al repositorio ni a la galería).
- **Límites de presupuesto:** `git log -p -- tools/check.mjs` filtrando la línea de `LIMITS`.
- **Exportaciones sin uso, enlaces y scripts:** script propio de recorrido de `src/` y `tools/` y comprobación de existencia de destinos.
- **Pesos y ramas:** `stat`/`du`, `git count-objects`, tamaños de blobs con `git rev-list --objects`, `git ls-remote --heads origin`, `git log --format=%an`.
- **Dato del Merlin:** `git log -S` sobre `src/data/specs.js` y consulta de Wikipedia (`SpaceX Merlin`); `spacex.com/vehicles/falcon-9` sin contenido legible.
- **Galería:** comparación de los manifiestos del README con `docs/screenshots` (68 = 68) y búsqueda de entradas de H2R, Model Y y Audi en `tools/*shots.json` (sin resultados).
