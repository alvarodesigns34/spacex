# Auditorías

Las auditorías del proyecto, con lo corregido y lo que quedó pendiente: 8 de octubre, 30 de septiembre y la externa del 2 de octubre de 2026 (ChatGPT).

Las secciones de este archivo se movieron del `README.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo bajó un nivel el título de cada sección). Los números de línea, rutas y nombres de sección que citan siguen siendo los de entonces.

[← Índice de rondas](README.md) · [← README](../../README.md)

## Auditoría del 8 de octubre de 2026

Dos auditores de solo lectura revisaron el commit `d2ea8e9` (informe fuera del repositorio, en `/mnt/project-files/auditoria/auditoria-2026-10-08.md`). Cada hallazgo se comprobó en el código antes de tocarlo. **Corregido:**

- **Cámara y secuencias** (`main.js`): tras un clic o una rueda durante el lanzamiento, elegir un expositor o empezar la visita ya no deja la secuencia corriendo bajo otro vehículo (B1); el lanzamiento y la reentrada detienen el F-16, el Porsche y la H2R si están en marcha (B3); la rejilla de colisiones de los tres se construye después de elegir el expositor, así que entrar desde la vista orbital del Roadster ya no la deja sin el campus (B2); el deslizador del sol ya no falla si se mueve durante la carga (B5).
- **Sonido e interfaz:** los nodos de cada sonido suelto se desconectan al terminar (B4); las escuchas de los consejos de la primera visita se vacían al cerrarlos (B6).
- **Herramientas:** las esperas de `ux-check` que se agotan dejan su causa en el registro (B7); `lod-pop` exige que cada encuadre vea su cambio de detalle (≥150 píxeles; el Roadster, el más pequeño, ≈1 400) con un control negativo por caso, la cámara de espaldas (B8); el sabotaje «frozen» de `cloud-check` congela ahora la nube en las dos rutas, el salto y la reproducción, y lo detecta la caducidad del humo (B9).
- **Comprobaciones de `verify.js`:** la holgura de las pinzas medida es de 22 mm y la ventana pasa de +8 cm a +4 cm, de modo que el anillo antiguo, 6 cm más fuera (82 mm), falla (A17; además el detalle imprimía centímetros como milímetros); el asiento del propulsor, medido a 0 m, pasa de ±35 a ±5 cm (A22); la altura de la torre se mide desde la explanada construida y no desde la declarada (A23).
- **Datos y textos:** la torre declarada es 149,35 m (480 + 10 ft), no 149,45, y su fila dice ≈149,4 m (A3); la ficha separa la huella trazada de la zanja (≈84 × 18 m) de la reconstruida (22 m libres, 88 m) y dice que no coinciden (A2); dice también que los tanques trazados son varias veces las capacidades citadas (un cilindro de 48,6 × 5,8 m es ≈1 280 m³, ≈339 000 galones de EE. UU.), sin inventar otras (A18); el área de sustentación del Porsche es ≈2,16 m² (A10); llantas rojas y pinzas negras en la ficha y en los comentarios (A21); la aguja del cuentavueltas barre 295°, no 300° (A26); el límite de la cola diferencial del F-16 es una sola constante, 5,375° (21,5° de alerón entre 4) (A27).
- **Materiales y geometría:** el carbono de dos caras del modelo de la H2R en código también lleva su tejido (A1; el `.glb` no cambia); el ruido de los tejidos de carbono y del metal cepillado es periódico y ya no deja costura al repetirse (A11); los tanques de 8,0 m, 6,5 m y 5,7–8,0 m de la granja ya no se atraviesan: cada par guarda los 0,65 m entre cascos que dejan los de 5,8 m al paso trazado de 6,45 m (≈; A20); `plate()` documenta que el bisel agranda el espesor y el contorno (A16, A19: sin cambiar la geometría, porque ni los 55 mm de la aleta de la Dragon ni la planta de la pata del Falcon son cifras publicadas).

**Pendiente, y por qué:** la geometría de la H2R (A4, dos calibraciones de la foto; A5, pernos de la tija; A6, anillo del amortiguador; el código muerto del basculante), porque está aparcada y cambiarla obliga a regenerar el `.glb`; el año del Roadster (A24), que depende de una fuente que no está en el repositorio; la costura de la normal del acero (A28): se confirma, pero el ruido de toda la textura de acero (color y rugosidad incluidos) no es periódico, así que una frecuencia entera no la quita y arreglarlo de verdad cambia el aspecto de todos los cascos. **No reproducido:** A25 (los 3,5 m [136 in] de la cofia del Falcon 1 sí están sobre su plano de separación, la estación 756,36 in, y no sobre el de etapas). A12 ya estaba retirado.

## Auditoría del 30 de septiembre de 2026

Una auditoría del repositorio entero (ramas, CI, Pages, `npm run check`, revisión del código del 29 de septiembre, fichas, README y un recorrido de todos los encuadres, del lanzamiento y de la reentrada) encontró estos fallos, ya corregidos:

- **G durante la reentrada dejaba la cámara estropeada hasta recargar.** El lanzamiento guardaba sus planos de recorte *antes* de cerrar la reentrada, así que se quedaba como propio el plano lejano de 1 700 km del capítulo. Con él se apagaban para siempre el plano cercano adaptativo y la oclusión ambiental. Ahora guarda los planos después (`launch.js`, `start` y `seek`).
- **La reentrada calculaba el cielo, el océano y los planos con la cámara del fotograma anterior.** Tras un salto (clic en el perfil, ←/→, *Restart*) el primer fotograma salía mal y, en pausa, se quedaba así: el amerizaje bajo un cielo negro de espacio y sin océano. Ahora se coloca primero la cámara y después todo lo que depende de ella, y en pausa se vuelve a aplicar todo.
- **Arrastrar durante la reentrada no daba el control.** El guion seguía moviendo la cámara y peleaba con la órbita. Ahora el arrastre toma la cámara y la órbita va montada en la nave (el centro de la órbita ya se mantiene sobre ella mientras manda el guion, para que el relevo no dé un salto); **C** la devuelve a la realización.
- **Elegir un vehículo o empezar la visita no detenía la reentrada**, que seguía corriendo por debajo. Ahora la termina, y el panel recupera siempre el texto y el perfil del lanzamiento, se cierre como se cierre el capítulo. `verify()` también la cierra antes de medir.
- **X (y G) desde el paseo** corrían con el campo de visión de 60° del paseo y el botón *Walk* encendido. Ahora pasan al modo órbita; el vuelo libre, que ya usa el campo de visión de la órbita, se respeta.
- **Plano de persecución entre 16 y 27 km:** seguía la velocidad, que ahí se vuelve casi vertical, y miraba el océano desde arriba: un azul liso, sin horizonte. Ahora no mira más de 12° hacia abajo.
- **El planeo rebotaba** (ver *Alabeo* arriba).
- **Alerones incandescentes:** desde a bordo se leían como pintura naranja plana. Ahora brillan con un rojo más apagado, de metal caliente.
- **Encuadre *Merlin 1D*** del Engine Row: cortaba la parte alta del motor de exposición nuevo.
- **Fichas:** filas nuevas para la orientación de la costa (≈85,3°, agua a ≈485 m de la mesa; la introducción del README decía 450 m) y para la unión cápsula–trunk de la Dragon (banda de ≈0,17 m), con las dos fotos de la NASA como fuentes. La cronología del vuelo 14 se leyó directamente en spacex.com: todos los tiempos coinciden. La ficha dice ahora lo que no se muestra: aquel día el propulsor encendió 31 de 33 motores en el *boostback* y 11 de 13 en el aterrizaje, y la nave perdió un Raptor Vacuum; la inserción orbital (T+25:17–25:36) no se ve; y qué hizo la nave en el agua tras el amerizaje no se publica (en vuelos anteriores volcó).
- **Comentarios que contradecían el código** (las quínticas del encendido y del descenso final), **código muerto** (`pitchTau`, `flightPathAt`, `buildHuman`, `WALL_ANGLE`) y la lista de mallas del Raptor Vacuum copiada a mano en `verify.js`, que ahora importa `RVAC_HULL`.
- **`npm run serve`** usaba Python; ahora es `tools/serve.mjs`.

**Pruebas nuevas.**
- `cloud-check.mjs` comprueba la trayectoria de la reentrada:
  - todo finito;
  - ningún segundo de subida antes del encendido;
  - el calentamiento no vuelve a subir tras su pico;
  - Mach 1 y Mach 0,8 a ±0,5 s de las llamadas citadas;
  - motores 3 → 2 → 1;
  - en reposo sobre el agua en el amerizaje;
  - un mutante `skip`, que quita el alabeo, tiene que fallar.
- `ux-check.mjs` recorre el capítulo con teclas y ratón reales:
  - X desde el paseo;
  - un salto en pausa al amerizaje, con un control negativo;
  - un arrastre que monta la órbita en la nave, y C para devolverla;
  - G durante el capítulo, que tiene que dejar el plano lejano como estaba;
  - una tecla de vehículo que lo termina y lo restaura todo.

**Pendiente, a decisión del usuario: la orientación del Pad 2.** Con las huellas de OpenStreetMap del 30 de septiembre, la conversión al marco de la zanja reproduce las posiciones del modelo: la torre sale a (−25,5, −20,2) m, frente a (−23,8, −18,3) m, y los tanques del deluge a (−104, 47) m, frente a (−107, 47) m. Pero respecto a la geografía de la escena (+X al rumbo de 100,8°, el mismo marco que ya siguen la costa y el globo) es **una reflexión, no un giro**. Los desfases de la torre y de los tanques son distintos (−36° y +198°), cosa que solo pasa con un espejo. En Starbase los tanques del deluge quedan al NE y ENE de la mesa (≈35–58°, hacia el mar) y la torre al norte (≈355°); en el modelo quedan al OSO (≈256°) y al NO (≈319°). Corregirlo significa reflejar el pad respecto al eje de la zanja y girarlo ≈67° respecto a la fila de expositores, con todas las vistas, obstáculos y pruebas que dependen de él. No se ha tocado.

## Auditoría técnica externa del 2 de octubre de 2026 (ChatGPT): lo corregido

Auditoría de la revisión `8e595b8`, con 60 hallazgos (1 crítico, 24 altos, 32 medios y 3 bajos). En esta ronda se han corregido los de prioridad P0 y algunos P1 acotados, cada uno con una prueba que falla con el fallo y pasa con la corrección. Los identificadores (H01…H60) son los de la auditoría.

**Porsche** (`src/sim/gt3Car.js`; pruebas en `tools/gt3rs-check.mjs`):

- **H01 (crítico): el reloj del coche dependía de los FPS.** Cada frame se redondeaba a pasos de 1/240 s y se perdía el resto: 10 s reales eran 6,9 s a 165 FPS, 12 s a 144 FPS y 0 s a 500 FPS. Ahora un acumulador conserva el resto. A cualquier frecuencia entre 30 y 1.000 FPS, con o sin tirones, el coche recorre los mismos 10 s con un error de un paso como mucho y llega a la misma velocidad (193,93 km/h). Un frame de más de 0,25 s (una pestaña parada) se recorta en vez de ejecutarse de golpe.
- **H03: el reset arrastraba estado del recorrido anterior** (corte del control de tracción, deslizamientos, ABS, entradas). Ahora un coche reiniciado es idéntico a uno nuevo; solo se conserva el PSM, que es una preferencia del visitante.
- **H04: las cargas podían sumar más que el peso.** Si una rueda quedaba en negativo se recortaba a cero sin conservar el total: con 45 m/s² laterales sumaban 27,3 kN frente a 17,1 kN. Ahora la transferencia no puede quitar a un eje o a un lado más de lo que carga, y la suma es siempre peso + carga aerodinámica.
- **H11: el arrastre ignoraba la velocidad lateral** y el cuadro mostraba solo la componente longitudinal. Ahora el arrastre se opone a la velocidad completa (de lado, ≈ con el CdA frontal, porque no hay cifra lateral publicada) y el cuadro muestra la velocidad sobre el suelo.
- **H12:** una entrada que no es un número (NaN, ±∞, `undefined`) se anula en la frontera en vez de contaminar el estado.
- **H47:** el humo de los neumáticos salía con una probabilidad por frame; ahora es una tasa por segundo, igual a cualquier frecuencia.
- **H48:** el sonido del coche se suspende con la pestaña oculta, como ya hacía el del lanzamiento.

**F-16** (`src/sim/f16Flight.js`, `f16Assist.js`, `f16Fly.js`, nuevo `src/core/f16Ground.js`; pruebas en `tools/f16-check.mjs`):

- **H13: el alabeo solo se leía de −90° a 90°**, porque salía de un arcoseno: 120° se leía como 60° y la protección para vuelo invertido nunca se activaba. Ahora se calcula con `atan2` sobre la vuelta completa (±180°) y lo comparten la ayuda de vuelo y el HUD.
- **H14: la llanura lejana se tomaba por mar.** Tierra o mar se decidía después de restar la caída por la curvatura terrestre: a 10 km la llanura, ya 7 m por debajo, «era» mar. Ahora se decide sobre la altura del terreno plano y después se aplica la curvatura. El suelo del avión está en `src/core/f16Ground.js` para poder probarlo sin navegador.
- **H36:** la caída por curvatura daba NaN más allá del radio terrestre; ahora se mantiene en el borde.
- **H18: la atmósfera se congelaba a 20 km.** Ahora sigue las siete capas de la atmósfera estándar de 1976 hasta 86 km (alturas geopotenciales) y por encima se extrapola isoterma. Los valores tabulados de 20, 30, 32, 47, 50 y 71 km se reproducen con un error inferior al 0,01 %.
- **H22: el reset dejaba la telemetría del vuelo anterior:** parado en la pista, el avión marcaba Mach 0,6 y 40 kN de empuje, sin peso en las ruedas, y conservaba el anclaje de freno de la última parada. Ahora un avión reiniciado es idéntico a uno nuevo.
- **H23: el mando de juego no funcionaba con los mandos sencillos**, que son los que vienen activados por defecto, porque no llegaban a leerlo. Ahora ambos modos leen el mando de la misma forma: RT y LT equivalen a W y S, el stick izquierdo a ↑ ↓ y al alabeo, B baja y sube el tren, Y cambia la cámara y Start pausa.
- **H21:** el tren bajaba a Mach 1,5. Ahora, por encima de ≈300 kt CAS la palanca no lo baja y avisa. Es la cifra habitual para el F-16; no procede de un manual de vuelo.
- **H60:** el bucle físico creaba vectores nuevos en cada subpaso. Ahora usa vectores de trabajo propios de cada avión; una prueba vuela dos aviones a la vez y comprueba que no se mezclan.

**Teclado y ventana modal** (H24; prueba en `tools/ux-check.mjs`): conduciendo o volando, el modo se quedaba con Tab y Escape aunque la guía (H) estuviera abierta, y Escape terminaba el recorrido dejando la guía en pantalla. Ahora, mientras la guía está abierta, el teclado es suyo: Shift+Tab no sale de ella, Escape la cierra sin terminar el recorrido y se sueltan las teclas que estuvieran pulsadas.

**Flight 14** (`src/sim/reentryFlight.js`, `launch.js`, `ui/hud.js`; nueva batería `tools/mission-check.mjs`):

- **H35: la nave saltaba ≈380 m (y 10,6 m de altura) en la interfaz de entrada**, porque la tabla de la reentrada empezaba un paso después del estado inicial. Ahora la posición y la velocidad son continuas. La prueba falla si se deshace la corrección.
- **H27:** la captura del propulsor figuraba con fuente «f14», pero en el vuelo 14 no hubo captura. Ahora es un evento del escenario («Booster caught (hypothetical)»), y la hora del vuelo 14 a la que ocurre se guarda aparte (`timeFrom`). Un control negativo comprueba que una captura atribuida a f14 se detecta. El panel ya no dice que todas las horas sean de SpaceX: lo son las que se muestran sin ≈.
- **H26:** la animación muestra la secuencia **planificada** de motores del V3 (33 y luego 13 en el retorno; 13 → 5 → 3 en la frenada). El panel dice ahora que el vuelo 14 encendió 31 de 33 para el retorno y 11 de 13 para la frenada. Esas cifras se leyeron directamente de la página del vuelo el 30-09; `BOOSTER_COUNTS` en `launch.js` guarda las dos secuencias por separado. Qué motores no se encendieron no está publicado, así que no se inventan.
  - **NO VERIFICADO:** la auditoría menciona además un Raptor Vacuum que se apagó en el ascenso. La página de SpaceX se genera con JavaScript y no se ha podido leer desde aquí, así que no se ha añadido.

**Herramientas, servidor y licencias:**

- **H43: el perfilador perdía el primer pase en calidad alta.** Reiniciaba los contadores cada vez que se dibujaba la escena principal, y GTAO la vuelve a dibujar para su G-buffer. Ahora reinicia una sola vez por frame de animación y suma todos los pases. En la vista general en alta mide **2.235 llamadas y 3,92 millones de triángulos por frame**, que coincide con la medición independiente de la auditoría (2.213 y 3,87 millones). El perfilador antiguo habría mostrado la mitad. Las cifras de llamadas y triángulos en alta de rondas anteriores estaban incompletas (son tiempos de SwiftShader, no de una GPU). Además, la métrica de memoria se llama ahora `heapGrowthKBPerFrame`: es crecimiento neto del heap, no asignación por frame.
- **H52:** con finales de línea CRLF (checkout en Windows), dos controles negativos de `tools/provenance-check.mjs` no llegaban a aplicar su mutación. Ahora el texto se normaliza al leerlo, y un control cuya mutación no se aplica falla como tal en vez de pasar por detector roto.
- **H55: el servidor local de las herramientas** (`tools/static.mjs`) dejaba salir de la raíz en Windows (`/%5c..%5coutside.txt`). Ahora resuelve cada ruta y rechaza con 403 todo lo que salga de la raíz: barras codificadas o invertidas, unidades, UNC, escapes rotos y NUL. Solo sirve GET y HEAD. Lo prueba `tools/static-check.mjs`. GitHub Pages no usa este servidor.
- **H56:** las fuentes IBM Plex viajan ahora con el texto completo de su licencia SIL OFL 1.1 (`vendor/fonts/OFL-IBM-Plex.txt`, copiado del repositorio oficial de IBM), que se publica con ellas en Pages.
- **H51: la prueba intermitente del CI** (el clic en «Fly» justo después de iniciar la visita agotó 30 s en dos de cinco ejecuciones del mismo commit). La causa está **NO VERIFICADA**. La más probable son los frames por software del runner compartido: Playwright espera dos frames con el botón quieto, y otro clic de la batería ya tardó 29,6 s en una ejecución que pasó. El clic tiene ahora el mismo plazo de 120 s que las capturas y la prueba de interfaz. Si vuelve a fallar, el informe dice por qué: la caja del botón, si algo lo tapa, quién tiene la vista y cuánto tardan los frames.
- **H57:** la descripción de `package.json` decía «ocho expositores»; son diez.

**Pendiente (P1 y siguientes, sin hacer en esta ronda):**

- **Porsche:** H02, H06, H07, H08, H09 y H10, hechos en la *mejora 5*; queda H05 (un modelo de neumático más completo: temperatura y presión).
- **F-16:** H15, H16 y H20 se resuelven en *F-16: Tierra redonda, combustible y límites del modelo*; queda el régimen supersónico con datos (H17); la separación del FLCS (H19) se hizo el 3 de octubre de 2026 (`src/sim/f16Flcs.js`).
- **Flight 14:** H28, H30, H32 y H33 (en parte) se resuelven en *Flight 14: una sola misión*. Quedan H29 y H31, la dinámica del volteo y el índice térmico dimensional (H34).
- **Datos:** procedencia por campos y conjuntos de validación independientes (H38, H39, H41, H50).
- **Rendimiento y estructura:** arranque progresivo (H42, H44–H46), módulos grandes (H49). La telemetría accesible (H25) ya está hecha.
- **Repositorio y CI:** orientación del pad (H37), tercera ventana del Dragon (H40, NO VERIFICADO), compatibilidad entre navegadores y ramas (H53, H54), Three.js vendorizado (H58) y permisos del flujo de trabajo (H59).
