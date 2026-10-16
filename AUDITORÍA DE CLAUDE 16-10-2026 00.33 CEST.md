# Auditoría de Claude — 16-10-2026, 00.33 CEST

Documento de revisión del repositorio `alvarodesigns34/spacex` en el estado del commit `36edb55` («H2R in Blender: broad two-tone spokes, tyre markings, occlusion on the right UV set»), publicado el 15-10-2026 a las 22:22 CEST. Está redactado como documentación: observaciones, riesgos y consejos. No es una lista de órdenes ni se ha modificado ningún archivo de código o de datos al hacerlo; el único archivo que añade esta auditoría es este.

---

## 0. Alcance, método y límites

**Qué se ha hecho**

- Lectura completa de `CLAUDE.md` y `TRASPASO.md` (1 230 líneas), y de las partes de `README.md` que describen el estado actual, las pasadas de Blender de los días 14 y 15 de octubre, la auditoría del 8 de octubre, la galería, la estructura y el rendimiento (≈1 986 líneas en total, no todas leídas con el mismo detalle).
- Lectura del código de integración (`src/main.js`: `LAYOUT`, constructores, carga de los `.glb`, `window.__vc`, manejo de errores), de `src/ui/audiLab.js`, de `src/vehicles/modelyAsset.js`, de partes de `f16.js`, de `core/quality.js`, de `tools/check.mjs`, `tools/census.mjs`, `pages.yml` y `package.json`.
- Ejecución real de las comprobaciones: `npm run check:static` y la comprobación de escena (`node tools/check.mjs`), más un recuento propio por expositor y un análisis de texturas con un navegador sin interfaz (Chromium con SwiftShader). Los scripts auxiliares se ejecutaron desde fuera del repositorio o como copias temporales eliminadas después; el árbol de trabajo quedó limpio.
- Consulta del estado de CI y de Pages con `gh` y `curl`.

**Qué no se ha hecho o no se puede afirmar**

- No hay GPU real: todo el renderizado se ha medido en software. Los tiempos de arranque (63–79 s en este entorno) incluyen análisis de los `.glb` y compilación de sombreadores en CPU y **no** son representativos de un equipo con GPU.
- No se ha leído línea a línea todo el código fuente (≈2,9 MB en `src/`); la lectura se concentró en la integración, los archivos citados por el traspaso y los puntos de mayor riesgo. Los 12 vehículos no se han auditado geometría a geometría.
- No se han contrastado de nuevo las cifras físicas o dimensionales de cada vehículo con sus fuentes; se ha revisado el sistema de procedencia (grados y etiquetas) y que sus pruebas pasen, no cada dato.
- Las comprobaciones `check:ux` y `check:lod` no se ejecutaron localmente; su estado se toma de CI (verde en el último commit de las cinco ramas de trabajo). `tools/audi-lab-check.mjs` tampoco se ejecutó aquí.
- El archivo `.glb` del Audi, el de mayor tamaño del repositorio, se ha revisado como integración (carga diferida, vista despiezada), no como modelo.

**Nota de contexto.** El Audi A3 Sportback 8V del «Audi Lab» procede del repositorio `audi` del mismo usuario y se incorporó a petición suya. Se trata, por tanto, de una decisión consciente; lo que se anota más abajo es únicamente que esa decisión **no está documentada** en el propio repositorio.

---

## 1. Resumen

| Aspecto | Valoración |
|---|---|
| Estado técnico | Sólido. Todas las comprobaciones ejecutadas pasan; CI y Pages en verde. |
| Documentación | La parte más desfasada del proyecto. Los recuentos (expositores, ramas, presupuesto, pesos) no coinciden entre `README.md`, `TRASPASO.md`, `package.json`, `index.html` y `CLAUDE.md`, y el Audi Lab no figura en ninguno. |
| Galería de capturas | Confirmada como desfasada: última regeneración el 02-10-2026; no contiene H2R, Model Y ni Audi Lab, y el Porsche que muestra es el procedural anterior a su paso a Blender. Además, los guiones de capturas no tienen entradas para esos tres. |
| Uniformidad del nivel | Hay dos «ligas» dentro del proyecto: los tres vehículos pasados por Blender (Porsche, H2R, Model Y) suman ≈2,5 M de triángulos y detalle horneado; los expositores procedurales de SpaceX están entre 8 k y 770 k. El listón de «hiperrealismo» está hoy cumplido de forma desigual. |
| Presupuesto de escena | Cercano al techo en triángulos (≈87 %) y materiales (≈86 %); holgado en mallas y texturas. Un expositor nuevo desde `.glb` volvería a rebasarlo (ya ocurrió el 13-10). |
| Medición | Una métrica del censo (`textureMB`) sobrestima ≈11 veces la memoria de texturas porque cuenta varias veces el mismo atlas compartido. |
| Reproducibilidad | Parcial: parte de los insumos de Blender no están en el repositorio y el Audi no tiene origen documentado. |

---

## 2. Estado verificado

### 2.1 Comprobaciones ejecutadas en esta auditoría

- `npm run check:static`: **221 comprobaciones PASS, 0 FAIL** (lint, procedencia, físicas, sonido, viento, misión, servidor estático).
- Comprobación de escena (`node tools/check.mjs`, Playwright + SwiftShader): **código de salida 0**, «Todas las comprobaciones pasan», consola limpia, sin caras del revés en F-16, Porsche y H2R, sin triángulos de normal nula tras el saneado (433 triángulos saneados al arrancar, repartidos en 36 geometrías).
- CI: último commit en verde en las cinco ramas de trabajo; Pages sirve la compilación de `36edb55`.

### 2.2 Presupuesto de la escena

Cifras de `tools/check.mjs` contra sus `LIMITS` (línea 906 del archivo):

| Magnitud | Medida (HEAD) | Límite | Uso |
|---|---|---|---|
| Triángulos construidos | 5 249 727 | 6 000 000 | ≈87,5 % |
| Triángulos dibujados (vista general) | 4 140 174 | — | — |
| Mallas | 1 836 (1 336 dibujadas) | 2 600 | ≈70,6 % |
| Materiales | 363 | 420 | ≈86,4 % |
| Texturas (recuento del gate) | 168 | 260 | ≈64,6 % |

Un recuento independiente con `sceneCensus` (calidad alta forzada) da cifras próximas pero no idénticas (5 236 130 triángulos, 1 844 mallas, 371 materiales). La diferencia es de menos del 1 % en triángulos; no se ha investigado su origen exacto (estado de la escena al contar o criterio de recuento), y no se interpreta como contradicción.

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

Los tres vehículos de Blender concentran ≈2,49 M de los ≈5,24 M triángulos (≈47 %) y no están registrados con `lodFeature`: en el código, el único uso de `lodFeature` se concentra en el Roadster, la nave, el Falcon 1, la fila de motores, el pad y poco más. Es decir, el mayor peso de la escena es precisamente el que no se reduce con la distancia (más allá del culling de la cámara).

El Audi Lab se carga de forma diferida y, por tanto, **no entra en estas cifras ni en el gate de presupuesto**. No se ha medido su coste.

---

## 3. Documentación: desfases y contradicciones

Se anotan con el archivo y la línea tal y como estaban en `36edb55`. Ninguna es grave por sí sola; juntas hacen que quien retome el proyecto lea tres versiones distintas del estado.

### 3.1 Recuentos

- `package.json` (descripción): «diez expositores: ocho de SpaceX, un F-16A Block 15 y un Porsche 911 GT3 RS». Faltan la H2R, el Model Y y el Audi Lab.
- `README.md` línea 3: «ocho de SpaceX, un caza, … un deportivo … y una moto»: no menciona el Model Y.
- `README.md` línea 40 y `TRASPASO.md` línea 11: «Once expositores». Con el Model Y son doce, y el Audi Lab es un decimotercero modelo, aunque con otro tratamiento.
- `README.md` línea 40, `TRASPASO.md` línea 12 y `CLAUDE.md` línea 6: «las seis ramas»; en cambio `CLAUDE.md` línea 5 enumera **cinco** ramas. Las ramas remotas son quince (ver §9), así que el número exacto de «ramas de trabajo» es ambiguo en los tres documentos.
- `index.html` (metadescripción): solo lista Starship, Falcon 9, Falcon Heavy, Dragon, Starlink, el Roadster y los motores. No hay F-16, Porsche, H2R ni Model Y.
- `src/core/quality.js` línea 4: el comentario habla de «1.1 M triangles, ~800 meshes» para la escena; hoy son ≈5,2 M y ≈1 840.

### 3.2 Cifras que han cambiado desde su redacción

- Presupuesto: `README.md` línea 44 y `TRASPASO.md` línea 17 citan el CI del 13-10 (5 073 256 triángulos, 1 810 mallas, 354 materiales, 157 texturas). El estado del 15-10 es 5 249 727 / 1 836 / 363 / 168.
- Peso de la H2R: `TRASPASO.md` línea 13 dice 35,6 MB; el archivo mide hoy ≈40,2 MB (tras la pasada del 15-10).
- Pesos que el traspaso y el README no recogen: Audi ≈55,9 MB, Model Y ≈32,6 MB, Porsche ≈28,1 MB (+ ≈0,3 MB de rótulos).

### 3.3 Estado del propio traspaso

- La cabecera de «Empieza aquí» dice «estado real al 08-10-2026», pero el bloque contiene las pasadas y encargos del 13, 14 y 15 de octubre. Quien lea solo el título puede descartar contenido reciente.
- `TRASPASO.md` línea 33 da la H2R como «hecha» («las fases 3 de materiales ya estaban en la web como recetas») y la línea 37 la da como «aparcado: el resto de la fase 3». Pueden ser compatibles (lo hecho en la web frente a lo pendiente en el `.glb`), pero tal y como están escritas parecen contradecirse.
- `TRASPASO.md` línea 20 deja A4, A5 y A6 de la auditoría del 8 de octubre como «aparcadas; obligan a regenerar el `.glb`». El `.glb` de la H2R se regeneró después (14 y 15 de octubre); el documento no dice si esos puntos quedaron resueltos, reabsorbidos o siguen abiertos. No se ha vuelto a comprobar su estado en el modelo.
- `TRASPASO.md` línea 593 (y la 22) incluyen rutas locales de Windows con el nombre de usuario del equipo del autor. En un repositorio público conviene valorar si es deseable que consten.

### 3.4 El Audi Lab no está documentado

- Una búsqueda de «Audi» (palabra completa) en `README.md`, `TRASPASO.md` y `CLAUDE.md` no encuentra el Audi Lab. El código sí lo integra (`src/ui/audiLab.js`, 522 líneas; enlaces en `src/main.js` hacia las líneas 892–900 y 1683; comprobación propia `tools/audi-lab-check.mjs`, 162 líneas), y el commit `Audi Lab: the Audi A3 Sportback 8V on its own, with an exploded view` es del 12-10.
- No consta en el repositorio de dónde sale el modelo (el repositorio `audi` del mismo usuario), ni en qué condiciones, ni quién lo modeló. Dado que es el archivo más grande (≈55,9 MB) y que el resto de modelos de Blender traen sus scripts en `blender/`, sería razonable que existiera al menos una nota de origen. Este punto debe leerse como una laguna documental, no como un defecto.
- `tools/audi-lab-check.mjs` no está enlazada desde `package.json` ni desde el CI: se podría romper el Audi Lab sin que ninguna comprobación automática lo detecte.

---

## 4. Galería de capturas

**Confirmado: está desfasada**, y por más de un motivo.

- `docs/screenshots` contiene 68 imágenes y coincide uno a uno con las 68 referencias del README (se comprobó que no hay huérfanas ni enlaces rotos). La última regeneración es del **02-10-2026**.
- No existe ninguna captura de la **Kawasaki H2R**, del **Tesla Model Y** ni del **Audi Lab**. Los guiones (`tools/docs-shots.json`, `launch-shots.json`, `roadster-shots.json`, etc.) **no tienen entradas** para ellos, así que `npm run shots` tal cual no los produciría.
- Las ocho capturas del Porsche (`gt3rs*.jpg`) son anteriores a que el coche pasara a cargarse del `.glb` de Blender (15-10): muestran el modelo procedural. Lo mismo ocurre con cualquier captura que enseñe detalles que cambiaron en las pasadas de Blender o en las rondas posteriores al 02-10 (ver `TRASPASO.md` línea 911: panel de misión, botón *Walk*, trayectoria de la nave, fuego nuevo, botón *Guide*, encuadre de la granja de tanques).
- `docs/hud` (tamaños de escritorio, tableta y móvil) no se ha revisado por separado; por el historial de commits de `docs/` es de la misma época.

**Contexto de la regla.** `CLAUDE.md` (línea 9) y `TRASPASO.md` impiden regenerar la galería sin aprobación explícita. Esa es la razón de que esté así, no un descuido; lo que se anota aquí es el alcance del trabajo pendiente cuando se apruebe: no basta con relanzar `npm run shots`, hay que añadir antes los encuadres de los vehículos nuevos.

---

## 5. Pendientes consolidados

Reunidos del traspaso (secciones «Estado actual» y §4) y comparados con el código cuando ha sido posible. La columna «Comprobado» indica lo que se ha podido ver en esta auditoría.

| Área | Pendiente declarado | Comprobado |
|---|---|---|
| Roadster y Starman | Cuarto en el orden del encargo del 15-10 (Model Y → Porsche → H2R → Roadster); el adaptador de carga seguiría en código | El Roadster sigue procedural (288 867 triángulos, `roadster.js` de 3 732 líneas); no hay `blender/roadster` |
| Raptor 3 en Blender | Aparcado, empezado y **sin subir** (`blender/raptor3/`, `blender/common/kit.py`) | `blender/raptor3` no existe en el repositorio; `blender/common/` no contiene `kit.py` |
| H2R | Resto de la fase 3 (carbono, titanio, goma, aluminio, espejo ahumado en dos capas), mecánica pieza a pieza, forma del carenado contra fotos; amortiguador trasero sin inventar | No verificado en el modelo |
| F-16 | Tren de aterrizaje (puertas planas, patas cilíndricas), luces de formación, receptáculo de repostaje, más paneles | **Confirmado el primero:** en `f16.js` (≈líneas 1150–1265) las puertas son trapecios planos de 12 mm y las patas, cilindros |
| F-16 | Despegue con postcombustión (172 kt a 407 m) ≈15 % largo según una fuente secundaria; sin fuente primaria no se tocó | No verificado |
| F-16 | En tierra a ≈120 kt, el alabeo a fondo con la palanca adelante tumba el avión sobre un ala (con mandos simples no) | No reproducido aquí |
| Porsche | Frontal: paragolpes algo abombado en las esquinas | No verificado |
| Auditoría 08-10 | A4, A5, A6 y el código muerto del basculante; A24 (año del Roadster, sin fuente en el repo); A28 (costura del acero: el ruido de `makeSteel` no es periódico) | No verificado; ver §3.3 sobre A4–A6 |
| Datos | Altura real de la torre (falta el registro OE/AAA); 17 s finales con 3 motores sin contrastar; nave tras la separación con masa seca, Isp y altitud supuestas (≈); pinzas del Falcon 1 en Omelek; **ventanas del Dragon** (4 laterales + escotilla en el modelo frente a 3 según la NASA actual) | Etiquetados como supuestos/≈ en el sistema de procedencia |
| Decisión del usuario | Orientación del Pad 2 en espejo respecto a la geografía real | Abierta |
| Física y entorno | Encargo amplio del 04-10 (conducción y vuelo, entorno, pasada final de bugs y físicas) | Abierto |
| Estructura | Modularizar archivos grandes (`roadster.js`, `launch.js`, `main.js` de 1 894 líneas), `@ts-check`, pruebas en WebKit y Firefox, variante exacta de Starlink | Abierto |
| Galería | Regenerar con aprobación (ver §4) | Pendiente de aprobación |
| Documentación | Ver §3 | — |

Un matiz sobre el listón: el propio traspaso admite que el Model Y es estático (sin puertas ni mecánica), mientras que el Porsche y la H2R se conducen; y que los datos del Model Y proceden de una fuente de segunda mano (evspecifications, grado C en el sistema de procedencia). Ambos puntos son coherentes con lo que se ve en el código, y ambos pueden pesar si el criterio de profundidad se aplica por igual a todos los expositores.

---

## 6. Rendimiento y carga

### 6.1 Peso de los activos

| Archivo | Tamaño | Notas |
|---|---:|---|
| `assets/audi/a3_sportback_8v.glb` | ≈55,9 MB | Carga diferida (Audi Lab) |
| `assets/h2r/h2r.glb` | ≈40,2 MB (≈14,5 MB con gzip local) | Cargado al arrancar |
| `assets/modely/modely.glb` | ≈32,6 MB (≈21,3 MB con gzip local) | Cargado al arrancar |
| `assets/gt3rs/gt3rs.glb` | ≈28,1 MB | Cargado al arrancar |
| `assets/gt3rs/markings.glb` | ≈0,3 MB | Cargado al arrancar |
| Total `assets/` | ≈150 MB en disco | — |

- GitHub Pages sirve los `.glb` con `content-encoding: gzip` (comprobado por cabeceras en el sitio publicado) y `cache-control: max-age=600`. Esa política no se controla desde el repositorio.
- Los tres `.glb` de Blender del arranque suman ≈101 MB sin comprimir; la descarga real es menor por la compresión, pero el análisis y la subida a la GPU ocurren siempre. En `src/main.js` los constructores de esos vehículos se esperan antes de levantar la pantalla de carga (en `builders`, ≈líneas 388–401), de modo que su tiempo se suma al arranque en frío.
- Ninguno de los archivos se acerca al límite de 100 MB por archivo de GitHub: el mayor (Audi) está al ≈56 %. La H2R pasó de ≈35,6 MB (cifra del traspaso) a ≈40,2 MB en las pasadas del 14 y 15 de octubre; con ese ritmo el margen es suficiente para varias iteraciones, pero no ilimitado.

### 6.2 Memoria de texturas: la métrica `textureMB` induce a error

El censo de `tools/census.mjs` (líneas 74–80) estima la memoria de texturas como `ancho × alto × 4 × 1,33` **por cada objeto `Texture`** que cuelga de un material. En el HEAD da **5 741 MB**, lo que alarmaría a cualquiera. Se ha comprobado:

- Hay 234 objetos `Texture`, de los cuales **49 son de 4096×4096**, todos mapas de oclusión (`aoMap`), que suman ≈5,4 GB de los 5,7 GB estimados.
- Esos 49 objetos comparten solo **2 imágenes** (`ImageBitmap`): un atlas de oclusión del Porsche y otro del Model Y, reutilizados por todos sus materiales. Three.js sube a la GPU cada `Source` una sola vez.
- Contando solo fuentes únicas (123 en total), la estimación baja a **≈495 MB** (RGBA8 con mipmaps, sin compresión de GPU). `renderer.info.memory.textures` indica 165 texturas en GPU.

Conclusión: la memoria real de texturas es del orden de medio gigabyte, no de casi seis. Aun así:

- Medio gigabyte descomprimido es mucho para equipos integrados o móviles; el propio proyecto está declarado como «solo ordenador».
- Los dos atlas de 4096² (≈85 MB estimados cada uno con mipmaps) son los mayores consumidores individuales. No se ha comprobado en qué formato de píxel se almacenan hoy ni si cabría una representación más compacta para un mapa de oclusión (que lleva un solo canal de información).
- Mientras la métrica cuente por objeto y no por fuente, no sirve para vigilar la memoria ni como gate. No se ha cambiado: es una observación.

### 6.3 LOD

`lodFeature` está registrado en el Roadster, la nave, el Falcon 1, la fila de motores y el pad, entre otros; **no** en el Porsche, la H2R ni el Model Y, que son ≈47 % de los triángulos. Los `.glb` llegan como mallas con nombre (el propio código de la H2R busca piezas por nombre), lo que sugiere que registrarlas en el gestor de LOD sería viable; no se ha probado. La consecuencia práctica, vista desde el presupuesto, es que el techo de 6 M se alcanzará sobre todo por estos tres.

### 6.4 Otros apuntes

- `index.html` no declara una política de seguridad de contenido (CSP). Para un sitio estático sin entrada de usuario el riesgo es bajo; se anota por completitud.
- El despliegue (`pages.yml`) copia `index.html src vendor docs assets`: `docs/` (≈17 MB, galería incluida) se publica también.

---

## 7. Calidad por expositor frente al listón de «hiperrealismo»

Valoración orientativa, basada en lo medido (triángulos, mallas, método de construcción) y en lo que el propio proyecto documenta. No sustituye a una revisión visual con GPU real.

- **Porsche 911 GT3 RS (Blender, conducible).** 590 k triángulos, 192 mallas, llantas de cinco radios en Y, rótulos del Cup 2 R, AO horneada. Es el vehículo con más tratamiento de detalle junto con la H2R; sus pendientes declarados son menores (frontal).
- **Kawasaki Ninja H2R (Blender, conducible).** 695 k triángulos. La fase 3 de materiales con mapas propios sigue declarada pendiente; es el caso en que el listón está más explícito en el traspaso.
- **Tesla Model Y (Blender, estático).** 1,21 M de triángulos: el modelo más pesado de la escena. Coherente con el listón en geometría y acabados; se queda corto en comportamiento (estático) y en la procedencia de sus datos (grado C).
- **Audi A3 Sportback 8V (Audi Lab).** ≈55,9 MB; vista despiezada. No evaluado como modelo.
- **Starship y Pad 2.** 769 k + 95 k triángulos; es el expositor con más ambición física (secuencia de lanzamiento y reentrada, penachos, humo) y con más hipótesis marcadas como ≈. Su riesgo no es de geometría sino de datos supuestos.
- **Roadster.** 289 k triángulos y 272 mallas; es el siguiente en el orden de Blender y está declarado como tal.
- **Falcon 1, Falcon 9, Falcon Heavy, Dragon, fila de motores, Starlink, F-16.** Entre 8 k y 152 k triángulos. El número de triángulos no mide el parecido con el real, pero la diferencia de un orden de magnitud con los vehículos de Blender es visible en el presupuesto y, previsiblemente, en pantalla. Dentro de este grupo, el Starlink (8 032 triángulos, 68 mallas) y el tren del F-16 (puertas planas, patas cilíndricas) son los puntos donde la distancia con el listón enunciado es más evidente sobre el papel.

Si el criterio es que **todo** alcance el nivel de los tres modelos de Blender, el trabajo restante es sustancial (nueve expositores más) y el presupuesto actual no lo admite sin subir los techos o introducir LOD en los `.glb`.

---

## 8. Pipeline de Blender y reproducibilidad

- `blender/` (≈336 KB) contiene los scripts de la H2R (`build.py`, `parts/`, `lib/`), el Porsche (`build.py`, `markings.py`, `parts/`), el Model Y (`ty_*.py`, `build.py`) y utilidades comunes (`webfinish.py`, `review.py`, `sheet.py`, `probe.py`).
- Insumos que **no** están en el repositorio y que el propio traspaso reconoce: `blender/h2r/source/code-parts.glb` (se regenera con `node tools/h2r-export.mjs`), las fotos de referencia (por derechos de autor, correctamente), `scratch/` con los scripts de sesión (`scratch/my/app.py`, `rig.py`, `crop.py`), y el Raptor 3 aparcado sin subir. Reproducir exactamente un `.glb` desde cero requiere por tanto entorno local del autor.
- Versiones: el traspaso menciona `bpy==5.0.1` para la H2R y Blender 5.2.x en el equipo del usuario para el resto. Mezclar versiones es una fuente conocida de diferencias sutiles en materiales y exportación glTF; conviene que quede anotado qué `.glb` salió de qué versión.
- El traspaso documenta con detalle lecciones valiosas (no construir dentro de la sesión abierta de Blender; cargar módulos `parts` por ruta para evitar colisiones entre paquetes con el mismo nombre; el exportador glTF no escribe la rugosidad conectada a un ruido). Esa memoria de proyecto es un activo.
- El Audi no tiene scripts ni nota de origen en este repositorio (§3.4).
- `modelyAsset.js` reconstruye en tiempo de carga materiales que no viajan en el archivo (pintura con barniz, cristales y ópticas por nombre). Esto acopla el runtime a los nombres de material del `.glb` (`TY_Paint_UltraRed`, `TY_Glass_*`, `TY_Lens_*`); un renombrado en Blender degradaría el aspecto sin romper ninguna prueba, salvo que alguna compruebe esos nombres.
- Si el `.glb` no carga, el Model Y degrada a un grupo vacío (`loadModelY`), mientras la H2R y el Porsche tienen respaldo procedural. Es un comportamiento aceptable pero distinto; el visitante vería un hueco en la exposición.

---

## 9. CI, herramientas e higiene del repositorio

### CI y comprobaciones

- Cuatro trabajos en paralelo (`check:static`, `check:scene`, `check:ux`, `check:lod`) y despliegue condicionado a su éxito: buen diseño. El episodio del 13-10 (el commit del Model Y rompió CI por presupuesto y no se desplegó) muestra que el gate funciona.
- Faltan en el CI: `tools/audi-lab-check.mjs`, y no se ha encontrado evidencia de pruebas con WebKit o Firefox (declaradas pendientes).
- Los límites de presupuesto se han subido dos veces en pocos días (4,5 M → 6 M triángulos, 2 200 → 2 600 mallas, 340 → 420 materiales, 220 → 260 texturas). Es legítimo, pero un techo que se desplaza con cada vehículo nuevo deja de decir si hay un problema; puede merecer anotarse el razonamiento de cada subida.

### Ramas

- Hay **quince ramas** remotas: las cinco de la política de empuje (`claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo`, `claude/affectionate-euler-o447rh`, `claude/spacex-vehicle-center-3d-48zlkm`) apuntan al mismo commit; otras diez (`claude/gifted-bohr-7bjkq9`, `claude/keen-heisenberg-4zblxy`, `claude/new-session-pnlz3h`, `claude/pensive-ride-5sjdza`, `claude/project-thread-nm0zn7`, `claude/sleepy-cannon-a1exgi`, `claude/youthful-noether-0ihafx`, `codex/fix-camera-state`, `codex/roadster-visual-quality`, `grok/vehicle-center-visual-pass`) apuntan a otros commits. No se ha medido hasta dónde están por detrás de HEAD. Alguna se cita en el traspaso como rama de sesión histórica.

### Peso de la historia

- `.git` ocupa ≈305 MB frente a ≈150 MB de `assets/`. Es esperable que buena parte provenga de las versiones sucesivas de los `.glb` (cada iteración de Blender añade decenas de MB), aunque no se ha analizado qué objetos pesan más. Con tres modelos que se siguen iterando y un cuarto (Roadster) previsto, el crecimiento es previsible; un clon completo ya es pesado y lo será más.

### Autoría y datos personales

- Los commits se reparten entre cuatro identidades de autor (273 de Claude, 29 del titular, 25 de otra identidad y 5 de Codex). No se reproducen aquí direcciones de correo. Dado que el repositorio es público, conviene que el usuario sepa qué metadatos de autor y qué rutas locales (§3.3) quedan expuestos.

---

## 10. Puntos fuertes

- Cultura de verificación poco habitual: 221 comprobaciones estáticas, comprobaciones de escena con control negativo (el «sabotaje» de `cloud-check`, por ejemplo), pruebas de física por vehículo y un gate de presupuesto que ha detenido de verdad un despliegue.
- Sistema de procedencia (grados A–D y etiquetas PUBLISHED/DERIVED/TRACED/ESTIMATE) verificado por pruebas: lo supuesto aparece marcado como tal, también en la interfaz.
- Documentación de método y lecciones aprendidas muy detallada; el traspaso permite retomar el trabajo con poco contexto previo.
- Disciplina con reglas difíciles: sin PRs, escala 1:1, sin fotos con derechos en el repositorio, sin eludir antibots, sin enviar datos personales a servicios externos.
- Robustez de arranque: saneado de geometrías al cargar, recuperación de contexto WebGL, tolerancia a fallos de carga de `.glb` (con diferencias, ver §8), consola limpia en la comprobación de escena.
- Integración limpia del Audi Lab (carga diferida, manejador de teclado en fase de captura, pausa del resto de la escena), aunque sin documentar.

---

## 11. Consejos de orden de lectura para quien retome el proyecto

1. Tomar `CLAUDE.md` y `TRASPASO.md` como punto de partida, sabiendo que sus recuentos (expositores, ramas, presupuesto, pesos) están por detrás del código (§3).
2. Considerar el Audi Lab como parte del producto aunque no aparezca en la documentación (§3.4).
3. Antes de añadir otro `.glb` pesado, medir con `node tools/check.mjs`: el margen en triángulos (≈0,75 M) y materiales (≈57) es corto.
4. Antes de fiarse de `textureMB`, tener presente la sobrestimación por atlas compartidos (§6.2).
5. La galería exige primero ampliar los guiones de capturas y después la aprobación del usuario (§4).

---

## Apéndice: cómo se obtuvieron las cifras

- Estático: `npm run check:static` → 221 PASS, 0 FAIL.
- Escena: `node tools/check.mjs` → «Todas las comprobaciones pasan», código 0. Presupuesto: «5.249.727 triángulos construidos, 4.140.174 dibujados en la vista general · 1836 mallas (1336 dibujadas) · 363 materiales · 168 texturas».
- Reparto por expositor y texturas: un script de lectura contra `window.__vc`, con `bootAtQuality(page, url, 'high')` y `sceneCensus({ perExhibit: true })` de `tools/census.mjs`, más un recuento de objetos `Texture` por `Source`. Entorno: Chromium + SwiftShader, sin GPU real.
- Pesos: tamaños en disco (`stat`/`du`) y cabeceras HTTP del sitio publicado.
- Galería: comparación de los manifiestos del README con `docs/screenshots` (68 = 68) y búsqueda de entradas de H2R, Model Y y Audi en `tools/*shots.json` (sin resultados).
- Ramas y autoría: `git ls-remote --heads origin` y `git log --format=%an`.
