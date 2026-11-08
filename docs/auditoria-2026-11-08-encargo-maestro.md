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
Ver §5 (se completa al cerrar el bloque).

### G. Estado
Implementado; pendiente de medir en hardware real (sin GPU en el entorno).
