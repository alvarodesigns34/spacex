# Auditoría y primera ronda del «encargo maestro» (8-11-2026)

Encargo del usuario del 8-11-2026: auditoría integral (agua, nubes, atmósfera, reflejos, sombras,
materiales, entorno, lanzamiento, reentrada, vehículos, sonido, cámaras, interfaz, rendimiento) y
empezar por la mejora de mayor impacto que se pueda verificar. Este documento recoge la línea base
comprobada, la matriz de problemas con prioridad, y el primer bloque hecho (el mar).

Regla seguida: **nada de la auditoría externa se da por bueno sin comprobarlo en el código actual**.
Cada fila dice si se confirmó, si ya estaba corregido o si es nuevo.

## 1. Línea base (Fase 0)

| Qué | Resultado |
|---|---|
| Rama de la sesión | `claude/vigilant-bohr-mlvmxf`, creada en `c92c657` (el commit de referencia del encargo) |
| Las cinco ramas de trabajo | las cinco en `c92c657`; CI y despliegue de Pages en verde en las cinco (ejecuciones 981–985 del 23-10) |
| Árbol de trabajo | limpio |
| `npm run check:static` | código 0, 30 s (4 núcleos, sin GPU) |
| Censo de la vista general (calidad alta, SwiftShader) | 1 844 mallas (1 143 dibujadas), 5 236 130 triángulos construidos (4 375 009 dibujados), 234 texturas; techo de `check.mjs`: 6 M triángulos |
| Entorno de pruebas | contenedor sin GPU: Chromium con SwiftShader (render por software). Una tanda de 5 capturas a calidad alta tarda ≈7–9 min. **Ninguna cifra de FPS de este entorno vale para hardware real**: solo sirven las comparaciones relativas y los recuentos (mallas, triángulos, texturas). |

**Hallazgo de proceso (P0, decisión del usuario):** la rama `claude/cybertruck-spacex-integration-h7sx0c`
lleva cinco commits del 23-10 posteriores a `c92c657` (`97b8345` aperturas y figura del Lab,
`fcabaf6` caché de texturas entre visitas, `9b9f51c` `?perf=log`, `9108de6` explosión por sistema,
`8292f47` caché desactivada bajo automatización; 14 archivos, +643/−53) que **no están en las cinco
ramas ni en Pages**. Desciende de `c92c657`, así que se puede fusionar sin conflicto de historia,
pero toca `main.js` y el Lab: no se ha fusionado sin permiso.

## 2. Hallazgos de la auditoría externa, comprobados en el HEAD

| # | Hallazgo | Estado en `c92c657` | Evidencia |
|---|---|---|---|
| A1 | El mar es una lámina plana con normales animadas | **Confirmado** (corregido en este bloque, §4) | `environment.js`: «A flat sea: every normal is straight up» |
| A2 | La física del agua consulta un nivel fijo | **Confirmado** (corregido, §4) | `water.js`: `surface: SEA_LEVEL` |
| A3 | Nubes: ruido 2D sobre un plano a 1 400 m en una cúpula que sigue a la cámara; se desvanecen al subir | **Confirmado** | `clouds.js`, cabecera y `BASE = 1400` |
| A4 | Reflejos: la sonda solo tiene cielo y un disco de suelo | **Confirmado** | `environment.js`, `envScene` |
| A5 | `shadow.radius` ineficaz con `PCFSoftShadowMap` | **Ya corregido** (S13) | comentario en `environment.js` |
| A6 | Lecturas y escrituras alternas en el layout de etiquetas | **Ya corregido** (S14, `c92c657`) | mensaje de `c92c657` |
| A7 | `mission.js`: cadena simplificada y `payload: 0`; la inserción orbital del vuelo 14 no se modela | **Confirmado** | `mission.js` l. 19 y 32: «flight 14's is not modelled» |
| A8 | Tierra orbital procedural e ilustrativa | **Confirmado** (y declarado como tal) | `backdrop.js`, cabecera |
| A9 | El Cybertruck queda en memoria al cerrar el Lab | **Confirmado, por decisión del usuario** (auditoría del 20-10, §9: «conservar el modelo al cerrar») | `cybertruckLab.js` |

## 3. Matriz de problemas y mejoras

Impacto visual y coste: A (alto), M (medio), B (bajo). «Nuevo» = encontrado en esta auditoría.

| Prio. | Área | Problema / mejora | Impacto | Coste | Riesgo | Estado |
|---|---|---|---|---|---|---|
| P0 | Proceso | 5 commits de `h7sx0c` sin fusionar en las ramas de trabajo | — | B | M (toca `main.js`) | **Decisión del usuario** |
| P0 | Misión | Vuelo 14: falta la inserción orbital (T+00:25:17–00:25:36), la nueva órbita y la carga de 26 Starlink V3; `payload: 0` | M | A | M (cambia la reentrada encadenada) | Pendiente: requiere investigar la fuente primaria; no se corrige con una constante |
| P1 | Agua | Mar plano, física con nivel fijo (A1, A2) | **A** | M | M | **Hecho, §4** |
| P1 | Agua | Motas grises en mar abierto: rayos reflejados bajo el horizonte leen el disco gris de la sonda (**nuevo**) | **A** | B | B | **Hecho, §4** |
| P1 | Nubes | Capa 2D; no se pueden atravesar ni ver desde arriba (A3) | A | A | A (coste en el F-16) | Pendiente; propuesta: capa volumétrica fina (ray marching de 16–32 pasos a media resolución) solo en calidad alta, la actual como respaldo |
| P1 | Reflejos | Sonda sin entorno local (A4) | A | M | M | Pendiente; propuesta: sondas locales estáticas (torre, fila de expositores) regeneradas solo al cambiar el sol |
| P1 | Lanzamiento | Nube de suelo: masas redondeadas | A | A | M | Pendiente de capturas de la secuencia |
| P1 | Rendimiento | Medición en hardware real | — | B | B | **Bloqueado**: el contenedor no tiene GPU; `?perf=log` está en la rama sin fusionar |
| P2 | Tierra orbital | Textura geográfica real (Blue Marble, dominio público de la NASA) en lugar de la procedural (A8) | A en órbita | M | B | Pendiente |
| P2 | Atmósfera | Exposición adaptativa por luminancia | M | M | M | Pendiente |
| P2 | Model Y | 4 × 142 000 triángulos en neumáticos sin LOD por sustitución | B | M | B | Pendiente (ya anotado el 17-10) |
| P2 | Arquitectura | Archivos de más de 1 500 líneas (`launch.js`, `plume.js`, `roadster.js`, `gt3rs.js`, `main.js`) | — | A | A | Pendiente; no se parte sin pruebas por módulo |
| P3 | WebGPU | Prueba comparativa aislada | — | A | A | Pendiente; no se migra |

## 4. Bloque 1: el mar con oleaje (hecho)

### A. Problema
- El mar (`environment.js`) era una lámina a −0,9 m con todas las normales hacia arriba; el
  movimiento venía de cuatro capas de un mapa de normales (`library.js waveNormals`). No había
  oleaje que ver en la silueta ni contra la playa, y de cerca las dos capas largas se leían como
  una textura con manchas.
- La física (`water.js waterAt`, el suelo del F-16 en `f16Ground.js`) leía un nivel fijo.
- **Nuevo:** en mar abierto aparecían motas grises: la normal del mapa inclina el rayo reflejado
  por debajo del horizonte y la sonda de entorno devuelve allí su disco de suelo gris (`envGround`).
  Certeza: alta (desaparecen al reflejar esos rayos sobre el horizonte, §F).

### B. Objetivo
Oleaje con geometría real, coherente con el viento y la costa, que la física lea igual que se dibuja.

### C. Alternativas
- **Sencilla:** desplazar la lámina actual. Su malla tiene 20 m entre vértices a lo largo de la costa:
  no puede llevar olas de 10–30 m.
- **Intermedia (elegida):** suma de seis ondas de Gerstner (GPU Gems 1, cap. 1) sobre una malla polar
  que sigue a la cámara; la misma función en JavaScript para la física.
- **Avanzada:** océano FFT (Tessendorf). Más rico, pero es una simulación en GPU que la física en
  JavaScript no puede muestrear sin leer texturas de vuelta, y su detalle fino es lo que ya dibujan
  las capas de normales. Descartada por coste y por romper la coherencia física.

### D. Decisión
- `src/core/ocean.js`: una tabla de seis ondas (dos marejadas del ESE, 72 y 51 m; cuatro olas de
  viento de 10–33 m ante la brisa del SSE de `wind.js`), dispersión de aguas profundas ω = √(g·k),
  Hs ≈ 0,91 m (**≈, elegida como día moderado, no medida**; las series reales están en NDBC/NOAA y son
  de boyas mar adentro, no de la playa). Cerca de la costa, una envolvente por distancia a la línea de
  agua (**≈, reconstruida**): leve asomeramiento fuera de la barra y pérdida de altura en la rompiente
  hasta cero en la orilla. No se modelan la refracción ni el acortamiento de las olas en aguas someras.
- El GLSL se genera desde la misma tabla; las fases ω·t se reducen en la CPU en doble precisión; la
  línea de costa se muestrea una vez (4 096 muestras cada 6 m) y la leen la GPU y la física.
- La malla polar (256 sectores en calidad alta, 192 media, 128 baja; vértices a 0,6 m bajo la cámara,
  crecientes con la distancia, 1 400 m de radio) solo lleva las olas que su separación puede dibujar
  (filtro λ/8–λ/4), se aplana en el borde y cede el resto a la lámina y al mar exterior, que la
  descartan dentro de su radio (6 m de solape donde ambas son planas). Se apaga en el ascenso (disco
  estirado), en el espacio y por encima de 1 500 m. Se ancla a una rejilla de 2 m para que sus vértices
  no «naden» por las olas.
- En el parche, las dos capas largas del mapa de normales entran solo a partir de 60–300 m, donde la
  malla ya no lleva las olas cortas: de cerca manda la geometría.
- El rayo reflejado del mar se refleja sobre el horizonte (aproximación habitual del segundo rebote).
- La espuma de la orilla sigue la fase de la marejada larga (6,8 s); las líneas de rotura avanzan a
  ≈3,4 m/s (√(g·h) con h ≈ 1,2 m). Crestas algo más claras y borreguillos escasos mar adentro.

### E. Implementación
`src/core/ocean.js` (nuevo), `src/core/environment.js`, `src/core/water.js`, `src/core/f16Ground.js`,
`src/core/terrain.js` (exporta `COAST_FRAME`), `src/materials/library.js` (`WAVE_TIME` es ahora el
reloj del océano; `swellFrom`), `tools/ocean-check.mjs` (en `check:static`), `tools/sea-shots.json`.

### F. Validación
Ver §5.

### G. Estado
Implementado y verificado en el entorno sin GPU; **pendiente de medir el tiempo de fotograma en
hardware real**.

## 5. Validación del bloque 1

**Prueba sin navegador** (`node tools/ocean-check.mjs`, dentro de `check:static`), resultados reales:

| Comprobación | Resultado |
|---|---|
| Altura significativa del mar abierto | 0,91 m (≈, elegida) |
| Ninguna ola se pliega (Σ Q·k·a con el máximo de la costa < 1) | 0,151 |
| Periodos (ω = √(g·k)) | 6,8 · 5,7 · 4,6 · 3,8 · 3,1 · 2,5 s |
| Envolvente costera: cero en la orilla y tierra adentro; continua | salto máximo 0,0017 en 5 cm |
| Costa muestreada (la que leen GPU y física) frente a la exacta de `terrain.js` | 4,5 cm como máximo |
| Inversión de Gerstner (altura bajo un punto) frente a la superficie | < 1 µm; 4 iteraciones = 12 |
| Continuidad en el tiempo, también a los 3 días de sesión | 0,74 m/s máx. ≤ 1,05 m/s teórico |
| `waterAt` y el suelo del F-16 sobre el mar leen esa superficie | exacto (misma función) |
| Dibujo frente a física, a 5 / 20 / 40 m de la cámara | 0,2 / 0,2 / 0,4 cm (tolerancia 1 cm) |
| Dibujo frente a física, a 100 / 300 m | 7,0 / 27,8 cm: las olas cortas que la malla lejana no lleva (cota calculada 8,0 / 34,9 cm) |

Tolerancia documentada: donde se conduce, se pilota o se cae al agua (la cámara a menos de 40 m)
la superficie dibujada y la que lee la física coinciden a 1 cm.

**Capturas comparables** (`node tools/shot.mjs <dir> tools/sea-shots.json`, calidad alta, sol a 18°,
misma cámara, mismo código salvo el bloque): a la izquierda `c92c657`, a la derecha este bloque.

![Mar antes y después: a ras, en la orilla, desde el aire](auditoria-2026-11-08/mar-antes-despues.jpg)

Lectura razonada, no solo diferencia de píxeles:
- **A ras (3 m):** desaparecen las motas grises y el mosaico de manchas; se ve el oleaje con
  silueta, bandas de Fresnel y la marejada cruzada con las olas de viento.
- **Orilla:** el agua tiene relieve hasta la rompiente; la lámina de la orilla sube y baja con la
  marejada. (Se suavizó después la modulación de la espuma de la orilla, que había quedado tenue.)
- **Desde el aire (220 m) y desde la plataforma (90 m):** mejora menor; sin manchas grises, pero el
  mar lejano sigue dependiendo de las capas de normales. Honestamente, el salto visible está de
  cerca y a ras.
- Revisado además con el arnés: a contraluz (sol a 14° y 40°) el reflejo solar se alarga sobre el
  oleaje sin centelleo apreciable; al atardecer (sol a 4°) se leen las crestas; sin costura en el
  borde del parche tras calcular la distancia a la costa por píxel.

**Coste:** +1 llamada de dibujo y ≈+106 000 triángulos en calidad alta (+2 % de los 5,24 M de la
vista general; 5 342 370 construidos, bajo el techo de 6 M), seis ondas por vértice en el sombreador
de vértices y dos lecturas de textura por píxel cerca del parche. **Tiempo de fotograma: no medido.**
En SwiftShader cada fotograma tarda 2–5 s y la variación entre repeticiones supera el efecto (se
intentó: activado/desactivado en tres vistas, resultados incoherentes); no se publica ninguna cifra.

**Regresiones vigiladas:** `check:static` en verde (incluye las físicas del F-16, el Porsche y la
H2R, que leen el agua); `tools/check.mjs` (escena completa con navegador) en verde con los bloques 1–2b: 5 355 967
triángulos construidos y 4 051 791 dibujados en la vista general, 1 837 mallas, 373 materiales y
172 texturas.

**Limitaciones conocidas:** sin refracción ni acortamiento de las olas en aguas someras; la costa
muestreada se fija pasados ±12 km a lo largo de la playa; la malla lejana pierde las olas cortas
(compensado con las capas de normales); los borreguillos son una aproximación por altura de cresta;
no hay salpicaduras ni ondas generadas por impactos (pendiente, enlazable con `effects.js`).

## 6. P0 de la misión del vuelo 14: lo que se ha podido comprobar (sin cambios en el código)

`src/sim/mission.js` encadena: apagado del ascenso (T+8:11) → vuelo libre kepleriano → encendido de
desorbitación (T+8:52:37–8:52:48, «cited») → interfaz de entrada a 120 km, con `payload: 0` y sin
inserción orbital. Es coherente por dentro, pero no es la misión entera.

Fuentes consultadas el 8-11-2026:
- **spacex.com/launches/starship-flight-14** (primaria): la página se genera con JavaScript y la
  lectura automática solo devuelve el título. **No verificada en esta sesión**; hay que leerla en
  un navegador.
- Secundarias (prensa, 28–29-9-2026; coinciden): Starship llegó a órbita y desplegó **26 Starlink V3**
  con su dispensador; SpaceX dijo haber contactado con los 26. Un motor de la etapa se apagó antes de
  tiempo en el ascenso; la **inserción orbital la hizo un solo Raptor de nivel del mar** (el encargo
  la sitúa entre T+00:25:17 y T+00:25:36, ≈19 s, cifra que la búsqueda solo encontró en una vista
  previa). SpaceX acortó el vuelo y no completó todas las órbitas previstas.
- **Discrepancia sin resolver:** un blog que cita a Jonathan McDowell pone la desorbitación a las
  2 h 12 min (dos órbitas); `mission.js` tiene T+8:52:37 «citado». Una de las dos no corresponde al
  vuelo real (o el código cita la previsión y no lo ocurrido). **Hay que resolverlo con la fuente
  primaria antes de tocar nada**: es exactamente el tipo de error que el encargo pide no introducir.

Plan propuesto (pendiente de la verificación anterior): separar en `mission.js` un modo **histórico**
(eventos documentados: apagado, vuelo libre suborbital, inserción con un Raptor y su Δv por la
ecuación del cohete con masa e Isp ≈, despliegue de 26 × masa de un V3 — dato a buscar, ≈ si no se
publica —, órbita resultante, desorbitación real) y uno **hipotético** (el actual), etiquetados en la
interfaz; y ampliar `tools/mission-check.mjs` con continuidad de estado en cada costura, conservación
de energía en vuelo libre, contabilidad de masas y convergencia con el paso, sin usar como
«validación» los mismos puntos con los que se ajusta.

Fuentes secundarias: [Payload](https://payloadspace.com/starship-reaches-orbit-on-14th-test-flight/),
[SpacePolicyOnline](https://spacepolicyonline.com/news/starship-achieves-orbit-for-the-first-time/),
[Aerospace America](https://aerospaceamerica.aiaa.org/spacex-shortens-starships-first-orbital-flight-but-achieves-other-objectives/),
[Basenor (cita a J. McDowell; menos fiable)](https://www.basenor.com/blogs/news/starship-flight-14-reaches-orbit-then-returns-early-after-1-orbit).

## 7. Bloque 2a: el suelo de la sonda de reflejos (hecho; efecto pequeño)

**Problema (confirmado, A4):** la mitad inferior de la sonda de entorno era un disco gris uniforme
hasta el horizonte: ningún metal, pintura o cristal reflejaba el Golfo al este ni la marisma y la
playa alrededor.

**Hecho:** `environment.js probeGround()`: el disco lleva, vértice a vértice, lo que hay en esa
dirección visto desde 6 m sobre el centro de la fila de expositores: el gris del recinto hasta
≈150 m (el mismo 0,30 de antes), después los albedos del propio sombreador del terreno (hierba y
paja de la llanura, matorral, arena seca y mojada) por las mismas funciones que los colocan, y el mar.
Radiancia = albedo × 1,35, la proporción que el gris anterior suponía. ≈: un solo punto de vista
para todo el recinto y el mar «como se ve en rasante». Interruptor de comparación en consola:
`__vc.env.setProbeGround('flat')` / `'site'`. Prueba sin navegador `tools/probe-check.mjs` (en
`check:static`): el mar al este, tierra al oeste, el gris junto a la fila, colores finitos.

**Validación visual (misma sesión, misma cámara, solo cambia la sonda):** en el acero de Starship
(vista *lee*) y en el costado del Porsche la diferencia es **apenas perceptible**: esas superficies
reflejan sobre todo la franja del horizonte, que no cambia. Es una corrección de coherencia, sin
coste por fotograma (la sonda se rehace solo al cambiar el sol), no el salto visual que pide el
encargo.

**2b (hecho después, §8).** Propuesta original: sondas locales capturadas de la escena real (`CubeCamera` + PMREM,
solo al cambiar el sol y sin el propio vehículo), empezando por Starship junto a la torre, con sus
materiales propios apuntando a esa sonda. Riesgos a medir: materiales compartidos entre vehículos
(clonarlos sube la cuenta, hoy 363 de 420), el coste de seis pasadas de la escena por cambio de sol
(en el arrastre del deslizador habría que diferirlas a cuando se suelta) y las pruebas que comparan
luminancias.

## 8. Bloque 2b: sonda de reflejos local para Starship (hecho; efecto moderado)

**Problema:** el acero casi especular de Starship está a ≈30 m de la torre y reflejaba el cielo
abierto donde está la celosía, y nada de la plataforma.

**Decisión:** `src/core/localProbes.js`, genérico: una captura cúbica de la escena real desde un
punto (el vehículo oculto mientras tanto), prefiltrada con PMREM como la sonda común y asignada a
copias privadas de los materiales de ese vehículo (26 en Starship; presupuesto medido por `tools/check.mjs`
tras el bloque: 373 materiales, techo 420). Se rehace solo cuando se rehace la sonda común (cambio de sol, contexto
recuperado), 250 ms después de la última petición: arrastrar el sol cuesta una captura al soltarlo.
Mientras no está lista, y durante el lanzamiento y la reentrada (el vehículo ya no está allí), las
copias usan la sonda común. Comprobado en el código de three r170: con `envMap` propio el material
no recibe `scene.environmentIntensity` (atenuado de noche y altura), que se copia a mano cada
fotograma, y `clone()` no copia `onBeforeCompile` ni `customProgramCacheKey`, que se copian.
Punto de captura: el eje de la pila, a 45 m sobre su base (≈: una sola sonda para 124 m de
vehículo; las partes bajas tienen algo de paralaje).

**Validación visual (misma sesión y cámara, vista *lee*, esperando a que el cambio se aplique):**
con la sonda local el casco gana contraste y su borde iluminado deja de quemarse, porque el lado de
la torre refleja estructura y suelo en lugar de cielo claro; la celosía no se distingue como forma
(la rugosidad del acero la difumina en el PMREM). Diferencia media del encuadre ≈1/255: cambio
**real pero moderado**. Consola: `__vc.localProbes.probes[0].active = () => false` para comparar.

**Coste:** seis pasadas de la escena a 256² por cambio de sol (no por fotograma) y un PMREM. No
medido en hardware real.

**Pendiente:** más sondas (Falcon 9, Falcon Heavy, Porsche, Roadster) si la medición en hardware
real lo permite; en reflejos de formas nítidas (cristales, pintura con barniz) el salto sería mayor
que en el acero rugoso.

## 9. Bloque 3: nubes con volumen (hecho; pendiente de medir el coste en hardware real)

**Problema (confirmado, A3):** `clouds.js` era ruido 2D en un plano a 1 400 m dentro de una cúpula
que sigue a la cámara: sin espesor, sin sombra propia, y desvanecido al subir hacia la base porque
un plano no se puede ver desde arriba.

**Alternativas:** volumen completo con texturas 3D y reproyección temporal (lo mejor, pero exige
un pase a media resolución y acumulación entre fotogramas que el compositor actual no tiene);
**capa volumétrica marchada en la propia cúpula** (elegida: contenida en `clouds.js`, sin pases
nuevos); impostores (no se pueden atravesar).

**Hecho:** el rayo de vista se recorre por la capa de 1 400 a 2 600 m (≈) con la **misma cobertura**
que la capa plana, de modo que los dos niveles dibujan las mismas nubes. Densidad = cobertura ×
perfil vertical (base plana, cima en cúpula que sube donde la nube es más gruesa) − erosión por ruido
3D en tres escalas. Luz: Beer-Lambert, tres muestras hacia el Sol para la sombra propia, fase de
Henyey-Greenstein de dos lóbulos, efecto «powder», ambiente más claro arriba que abajo, y
perspectiva aérea por la distancia al primer impacto. Escribe la profundidad de ese impacto
(`gl_FragDepth`): desde arriba el suelo queda detrás de la nube y un avión delante de ella sigue
delante. En vuelo (`setAltitude(…, { flight: true })`) ya no se desvanece al llegar a la base; se
puede entrar, atravesar y mirar desde arriba. El lanzamiento conserva el desvanecido anterior.
Pasos por rayo según la calidad (`quality.js cloudSteps`): 32 alta, 20 media, 0 baja (la capa plana
de siempre). Consola: `__vc.env.clouds.setMode('layer' | 'volume')`.

**Validación visual (arnés, misma cámara):**
![Capa plana (izquierda) frente a volumen (derecha)](auditoria-2026-11-08/nubes-capa-volumen.jpg)
- Desde el suelo: cúmulos con cimas iluminadas, bases grises y perspectiva hasta el horizonte,
  donde antes había un velo plano.
- Desde arriba (3 500 m) y dentro de la capa (1 900 m): se ven las cimas y el mar por los huecos, y
  jirones dentro. La cámara del arnés no es la del F-16 (su plano lejano es 9 km): falta revisarlo
  en un vuelo real.
- Primeras versiones corregidas en la misma sesión: cimas en cono que se leían como montañas y luz
  solar demasiado débil desde arriba.

**Limitaciones conocidas:** grano fino estático por el desfase aleatorio de cada píxel (no hay
acumulación temporal); alguna cima aún algo aguda; el plano lejano corta lo que queda más allá.
**Coste no medido** en hardware real: 32 pasos con ruido 2D y 3D por píxel de cielo, más tres de luz
donde hay nube. Si en la RTX 3070 del usuario no cabe, la vía es bajar los pasos del nivel alto o
pasar a media resolución con reproyección; el nivel bajo no cambia.

**Correcciones tras el check completo (misma sesión):**
- **Defecto del bloque 2b encontrado por `check:cache`** («el Sol sube a 55°: mapa de sombras
  idéntico», 87 886 bytes distintos): la captura de la sonda local renderiza la escena con Starship
  oculto, y si el mapa de sombras se redibujaba en ese momento quedaba guardado sin su sombra hasta
  la siguiente invalidación. Ahora la captura congela el mapa de sombras (`autoUpdate` y
  `needsUpdate` guardados y restaurados). `check:cache` vuelve a verde.
- **Escena e interfaz agotaban el tiempo** con las nubes nuevas, incluso con 6 pasos: con un bucle de
  longitud constante, SwiftShader desenrollaba el marcado completo y tardaba minutos en compilar el
  sombreador al cargar. Ahora los pasos son un uniforme (`uSteps`, bucle dinámico de GLSL ES 3.0):
  no se desenrolla y se pueden cambiar en vivo (`__vc.env.clouds.steps = 16`), lo que deja la puerta
  abierta a una calidad adaptativa sin recompilar. Bajo automatización (`navigator.webdriver`) se
  usan 6 pasos salvo `?clouds=full`, para que las pruebas sigan dibujando el volumen sin minutos por
  fotograma. Con esto `tools/check.mjs` y `tools/ux-check.mjs` pasan (escena 8 min 45 s, interfaz
  33 min en este contenedor).
- Check completo en verde por partes: estáticas, escena, interfaz, LOD, cachés y Cybertruck Lab.

**Revisión en un vuelo real del F-16 (misma sesión):** con el avión colocado a 3 300 m (sobre la capa)
y a 2 000 m (dentro), su cámara de persecución y su plano lejano (≈270–330 km):
- con los 6 pasos de la automatización, grano muy fuerte; con los 32 del nivel alto
  (`__vc.env.clouds.steps = 32`), masas de nube reales, el suelo entre ellas y jirones al
  atravesarlas;
- desde arriba, las cimas aún se leían como picos nevados: el perfil pasa a cúpula
  (`sqrt` del grosor) y la sombra propia pesa más (pliegues más marcados). Queda alguna cima aguda y
  el grano estático del muestreo.
