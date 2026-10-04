# Diagnósticos de la pasada decisiva (4 de octubre de 2026)

Seis auditorías de solo lectura hechas por agentes. Se guardan aquí porque la carpeta de la sesión se pierde con el contenedor. Cada `.json` tiene `summary`, `findings` (título, gravedad, evidencia con archivo:línea y cifras, arreglo) y `plan`. Están en inglés, porque los leían otros agentes.

| Archivo | Frente | Estado |
|---|---|---|
| `cuadrado-negro.json` | Cuadrado negro intermitente | **Aplicado (bloque 1)** |
| `moto-h2r-pasada-1.json`, `moto-h2r-pasada-2.json` | Conducción de la H2R (dos pasadas del mismo agente; la 2.ª es la más reciente) | **Aplicado (bloque 2)** |
| `conduccion-porsche.json` | Conducción del Porsche | **Aplicado (bloque 3, dos partes)** |
| `f16.json` | Vuelo y sonido del F-16 | Plan de sonido; sin aplicar |
| `sonido.json` | Sonido de H2R, Porsche y cohete | Defectos medidos; sin aplicar |
| (falta) | Detalle de los modelos y presupuesto de rendimiento | **No se llegó a hacer** |
| (falta) | Entorno y físicas | **No se llegó a hacer** |

`revisiones/` guarda lo que encontraron las revisiones al aplicar los bloques 1 (cuadrado negro), 2 (H2R) y 3 (Porsche, hecha a mano): todo está corregido salvo lo que diga el TRASPASO.

`scripts/` son los scripts de medida de los agentes, con extensión `.txt` (se excluyen del linter y de las pruebas). Para usarlos, copia uno fuera del repositorio, quítale `.txt` y ejecútalo con `node --import <hooks.mjs> script.mjs`, donde `hooks.mjs` resuelve `three` a `vendor/three` (ver TRASPASO, «Lecciones»). Algunos suponen rutas de la carpeta temporal antigua y habrá que ajustarlas.

## Resumen de lo encontrado

### Cuadrado negro (Porsche, no la H2R)
1. `buildSplitter` (`src/vehicles/gt3rs.js` ≈1655–1665) recorta el contorno con `Math.min(halfW(x)*0.97, W)` y deja puntos colineales en z = ±0,825 m. Salen 20 triángulos de área cero con normales (0,0,0).
2. En el sombreado, `normalize(vec3(0))` da NaN en algún píxel suelto.
3. El filtro de luciérnagas antes del bloom (`src/main.js` ≈323–340) deja pasar el NaN (`m > uPeak` es falso con NaN) y convierte Inf en NaN.
4. El bloom extiende ese píxel a un rectángulo negro. Al moverse la cámara el rectángulo aparece y desaparece: parpadeo.
5. Evidencia: ocultar solo `gt3-splitter` deja 0 píxeles NaN. Con el bloom desactivado, el mismo NaN forzado deja 18 píxeles negros; con él, 360.000 de 360.000.
6. Arreglo: shader a prueba de NaN/Inf; quitar puntos colineales en `buildSplitter`; un `sanitizeNormals(scene)` que corrija normales nulas en todas las mallas (hoy hay 495 triángulos en 41 mallas). El JSON trae el código y dos pruebas de regresión para `tools/check.mjs`. Falta la causa menor: `gl_PointSize` sin acotar en `gt3Drive.js`.

### Conducción de la H2R
- Con las ayudas puestas, 193 de 200 recorridos aleatorios de 30 s acaban en caída (133 «lowside», 38 hierba, 22 grava). Sin ayudas, 200 de 200.
- Causas: la guiñada cinemática del contramanillar cuenta como demanda de agarre; el ABS solo mira la rueda delantera y el control de tracción solo la trasera; los cambios de superficie no se anticipan; las vallas son filas de círculos de r = 0,1875 m cada 0,25 m, con normales que dan choques frontales falsos al rozar.
- El prototipo `prototipos/h2rBike2.js.txt` (0 caídas con ayudas) cambia seis cosas: presupuesto de agarre con prioridad lateral, freno y gas acotados a lo que queda, objetivo de inclinación siempre limitado, giro de manillar limitado por el agarre, tope duro de inclinación (la estribera toca a 59,9°) y saturación lateral que abre la trayectoria en vez de tirar la moto.
- Aún caben: choque frontal con valla a alta velocidad y agua de 0,6 m.
- Otros: en parado y en marcha alta arranca en sexta (`slipClutch` solo en punto muerto); `GEARBOX.downshiftRpm` sin usar; modo manual pegajoso; un cambio durante el corte de 60 ms se pierde; la cámara del piloto no filtra el balanceo; el HUD no tiene testigos de TC/ABS; la «ABS» es una ayuda del simulador (la H2R es de circuito y no lleva KIBS: verificar en la ficha de Kawasaki).
- Cifras de prensa (MOTORRAD): 0–100 en 2,87 s (3,1 s medidos), 0–200 en 6,51 s (6,5), 0–300 en 13,06 s (13,4), 338 km/h (337 por GPS). Para llegar a 3,1 s hay que reajustar a la vez la altura del centro de masas, el umbral y la ganancia del control de caballito, y las pérdidas.

### Conducción del Porsche
- Crítico: el volante con teclado pide ≈2× el ángulo útil (trompo a 240 km/h sin PSM; con PSM el control frena una rueda en cada curva rápida). El DRS automático se abre en una curva de 1,6 g y quita el 55 % de la carga.
- Importante: PDK con corte total de 0,1 s, sin kickdown y sin mapa por carga (al 20 % de gas no sale de primera); subviraje fuerte en el límite (rueda delantera interior con 0–325 N a 1,2 g, traseras al 30–50 %); diferencial viscoso simple en vez del autoblocante electrónico (PTV Plus) con la inercia del motor sumada a cada rueda; mando de juego sin suavizar, sin levas ni vibración.
- Menor: ABS que vibra a ≈22 Hz; ruedas descargadas con deslizamiento falso (marcas, humo, chirrido); giro de 11,1 m (publicado 10,5); cámara que depende de los fps; cabeceo del piloto aleatorio en cada fotograma; pianos sin respuesta.
- El agarre lateral es creíble (1,34 g a 100 km/h, ≈1,7 g a 240 km/h). No se puede comprobar la vuelta de 6:49,328 a Nordschleife: no hay su trazado.

### Sonido
- Las explosiones se redondean a muestras enteras: ruido de −25 dB en vez de −48 (la principal «arenilla digital»). Colocarlas en tiempo fraccionario gana 15–19 dB (probado).
- El silbido de la válvula de alivio de la H2R es ruido aliasado tras ≈30 s (la fase crece hasta 1e6 rad) y nunca suena en los cambios rápidos (lee el gas del piloto, no el del motor).
- Ni la H2R ni el Porsche tienen modelo espacial (retardo, Doppler, distancia, panorama, reverberación); la H2R ni sabe qué cámara hay. Un paso a 250 km/h debería bajar ≈7 semitonos y subir ≈19 dB.
- Los controles llegan una vez por fotograma y se suavizan una vez por bloque: clics. Escape como filtros fijos en paralelo, sin guía de ondas. El silbido del compresor se sintetiza al orden del eje (9,2×) y no al paso de álabes.
- El cohete: sin Doppler, aire ≈4× demasiado brillante, respuesta truncada.
- **El F-16 no tiene ningún sonido ni botón de sonido.** `f16.json` trae el diseño (turbofán F100 con silbido de compresor, rugido, postquemador, ruido de entrada y de viento, ruido de neumáticos; vista de cabina frente a exterior; Doppler) sobre el patrón de `gt3Sound.js` y `h2rSound.js`.
