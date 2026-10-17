# Encargo del 4 de octubre de 2026 (cuarta sesión) y pasada decisiva

La pasada decisiva (bloques 1 a 4), el CI en rojo del bloque 3 y las fases 1 a 4 del encargo de la cuarta sesión (conducción, detalle de superficie, sonido, viento).

Las secciones de este archivo se movieron del `README.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo bajó un nivel el título de cada sección). Los números de línea, rutas y nombres de sección que citan siguen siendo los de entonces.

[← Índice de rondas](README.md) · [← README](../../README.md)

## Pasada decisiva: diagnósticos hechos, aplicación pendiente (4 de octubre de 2026)

El usuario pidió una pasada decisiva sobre la H2R, el Porsche y el F-16: modelos hiperrealistas sin simplificar, mejor sonido (el F-16 no tiene ninguno), arreglar un cuadrado negro intermitente en la zona de la H2R y el Porsche, conducción mucho más profunda (la moto no debe caerse al girar) y una pasada por el entorno y las físicas. Se hicieron seis auditorías de solo lectura; los resultados completos están en `docs/diagnostico-2026-10-04/` (índice en su `LEEME.md`). La aplicación va por bloques, cada uno con su sección (la primera, *Pasada decisiva, bloque 1*).

- **Cuadrado negro: causa confirmada, era el Porsche.** El splitter delantero tiene triángulos de área cero con normales nulas; dan un píxel NaN, el filtro de luciérnagas anterior al bloom lo deja pasar y el bloom lo convierte en un rectángulo negro que parpadea. Arreglo probado en la página: filtro a prueba de NaN, quitar los puntos colineales y un saneador de normales.
- **H2R:** con las ayudas, 193 de 200 recorridos aleatorios acababan en caída. Hay un prototipo con 0 caídas (presupuesto de agarre con prioridad lateral y tope de inclinación a 59,9°, donde toca la estribera). Aplicado en el bloque 2.
- **Porsche:** el volante con teclado pide el doble del ángulo útil, el DRS se abre en plena curva, el PDK corta el empuje 0,1 s, subvira en el límite y el diferencial no es el autoblocante del coche.
- **Sonido:** las explosiones se redondean a muestras enteras (≈ −25 dB de ruido), el silbido de alivio de la H2R se rompe a los 30 s y no hay modelo espacial. El F-16 no tiene sonido.
- **No se llegó a hacer:** la auditoría del detalle de los modelos y el presupuesto de rendimiento, y la del entorno y las físicas.

## Encargo del 4 de octubre (cuarta sesión): F-16, Porsche y H2R a fondo. F-16, toma de aire y cúpula

El usuario pidió una auditoría ambiciosa de los tres vehículos conducibles: modelos 3D mucho más detallados, conducción y vuelo más reales, entorno y una pasada final por las físicas. Se empezó por renderizar los tres de cerca. Lo más tosco era el F-16.

**F-16A, primera parte** (`src/vehicles/f16.js`):
- **La cúpula enseñaba dientes negros** a lo largo del borde. La abertura de la cabina se recortaba quitando los triángulos de la piel por su centro, y el borde quedaba en escalera por encima de los marcos. Ahora el cuarto superior de cada sección se reparte de modo que una fila de vértices cae justo en el borde de la abertura, y se corta por esa fila: una línea limpia.
- **El doble de resolución** en las secciones del fuselaje (24 puntos por cuarto en vez de 14). El avión pasa de ≈47.000 a ≈70.000 triángulos.
- **La toma de aire, como en el avión.** Antes era una prolongación del fuselaje, con la boca hasta las esquinas del lomo. Contrastada con fotos libres de Commons (solo como referencia: «F-16 Fighting Falcon air intake» y vistas laterales de museo):
  - la toma es su propio conducto bajo el fuselaje, separado de él por la **ranura del desviador de capa límite** (≈6,5 cm en el labio, ≈). La ranura se cierra hacia atrás en ≈1,1 m; es un surco de la misma superficie, sin juntas;
  - la boca va de un lado al otro de la toma, con las esquinas superiores redondeadas, y la sostienen un alma central y dos laterales;
  - el **labio** es un borde redondeado (≈2,5 cm de radio) que da toda la vuelta a la boca, con la parte de arriba algo adelantada (≈6 cm, ≈);
  - **el conducto por dentro es claro**, como en las fotos (antes era negro).
  - El área de captura, medida en el borde de ataque del labio, es 0,531 m² (TP-3355: 0,533 m²); la forma es ≈.
- **La cabina** (≈, reconstruida; se ve a través de la cúpula). Antes eran tres cajas. Ahora tiene:
  - el asiento ACES II, reclinado 30°, con sus laterales, cojines, el cabecero con el paracaídas y sus dos tubos pitot, los arneses y la maneta amarilla de eyección entre las rodillas;
  - las consolas laterales, con la palanca lateral (*side-stick*) a la derecha y el gas a la izquierda, como en el F-16;
  - el panel, con los biseles y las esferas de los instrumentos, la pantalla del radar y el panel de mando bajo el parasol.
- **El lanzador de punta de ala** (tipo LAU-129, ≈ en forma y tamaño) era una barra rectangular. Ahora es un raíl esbelto de sección redondeada, con el morro afilado, la cola en cuña, los dos carriles de lanzamiento por debajo y el adaptador perfilado que lo une a la punta del ala.
- **El tren de morro, como en las fotos** (Commons, «Last 3 F-16's Twenthe Airbase» y «Vegas Strong F-16 Gear Down Pass», solo como referencia; medidas ≈): la pata va inclinada, con la rueda ≈16 cm por delante de su anclaje (antes era vertical y con la rueda atrasada); lleva el tirante largo en diagonal hacia atrás y arriba, con el muelle de su actuador; y una sola compuerta larga, a la derecha, detrás de la pata, con la esquina trasera redondeada (antes, dos placas rectangulares).
- **La antena de pala del vientre se veía negra.** Para colgarla hacia abajo se reflejaba con una escala −1, y eso da la vuelta a sus caras (las 12 miraban hacia dentro). Ahora se gira 180°. `check.mjs` comprueba que las antenas tienen todas las caras hacia fuera (con el código anterior, 12 hacia dentro).
- **Caras del revés en el Porsche y la H2R**, encontradas con un detector nuevo (busca mallas cuyos triángulos giran al contrario que sus normales). Las **pinzas de freno izquierdas del Porsche** (delantera y trasera) y los **tornillos izquierdos de la cúpula de la H2R** eran copias reflejadas con escala −1 sin volver a girar sus caras: se dibujaban desde dentro. Corregido. El detector queda en `check.mjs` para los tres vehículos (con el código anterior, señala las tres mallas y la antena).
- **Velocidad máxima a nivel del mar, comprobada.** Las pruebas cubrían Mach 2 en altura, pero no la máxima a baja cota. Con postcombustión y nivelado a 300 m, el modelo llega a Mach 1,19 (1.445 km/h) en 200 s, y sigue subiendo hacia Mach 1,25. La cifra publicada es ≈Mach 1,2 (1.470 km/h, Wikipedia). Queda en `tools/f16-check.mjs`. A 3.000 m llega a Mach 1,43 y a 11.000 m a Mach 2,06.
- **Pruebas nuevas** (`tools/check.mjs`): el área de captura (±2 %) y que ningún vértice de la piel quede dentro de la abertura de la cabina. Con el código anterior, la segunda falla (31 vértices dentro).

## Fase 4 del encargo: física y entorno: el viento del sitio (4 de octubre de 2026)

Auditoría: el F-16 decía expresamente «sin efecto suelo y sin viento». El Porsche y la H2R medían su resistencia contra el suelo, no contra el aire. La manga de la pista estaba fija, el vapor de la plataforma derivaba hacia el sureste, contra la brisa del mar, y las cuatro capas de olas iban cada una por su lado. Ahora todo comparte un mismo viento.

**El viento** (`src/core/wind.js`):
- **Media:** la brisa del mar, del SSE (157,5°), a 6,2 m/s (13,9 mph, ≈12 kt) a 10 m. Fuente: los datos de ingeniería meteorológica de NOAA para Brownsville (WMO 722500, 1973–1996), cuyo viento medio coincidente de la estación cálida es de 13,9–15,7 mph, dominante del SSE. Es una tarde cálida típica, no un día concreto (≈).
- **Con la altura:** ley logarítmica sobre terreno abierto (z0 ≈ 3 cm), constante por encima de la capa superficial (≈300 m). Da 4,5 m/s a 2 m y 8,7 m/s a 100 m.
- **Ráfagas:** turbulencia «congelada» que viaja con el viento (la ráfaga que pasa por la manga llega a la pista segundos después), con σu ≈ 15 %, σv ≈ 0,75 σu y σw ≈ 0,5 σu (proporciones habituales de la capa superficial, ≈). Es determinista: las pruebas ven siempre el mismo viento.

**F-16:**
- **Vuela en el aire, no sobre el suelo.** La aerodinámica ve la velocidad respecto al aire; las ruedas, la del avión. El HUD muestra la velocidad sobre el suelo (GS) y el viento donde está el avión (W procedencia/nudos).
- **Efecto suelo:** la resistencia inducida baja con el factor de McCormick, φ = (16h/b)²/(1+(16h/b)²), y la pendiente de sustentación sube como la de un ala de alargamiento A/φ (fórmula de Helmbold, A = 3,0). En la pista da +5 % de sustentación y −9 % de inducida; a una envergadura, nada. El cambio de momento de cabeceo cerca del suelo no está modelado (≈).
- **Mandos simples, gas por energía total.** Con el viento del sitio, la aproximación automática rompía el tren: una ráfaga de cara subía la velocidad indicada, el autoacelerador quitaba gas y la senda se hundía (5,5 m/s de descenso al empezar la recogida). Es la trampa clásica de una aproximación con ráfagas. Ahora el gas atiende también a la senda: con viento toma a 1,8 m/s, volando cangrejeado 5,6°, y en calma a 1,5 m/s (antes 2,2).

- **El viento cruzado en tierra, como lo lleva un piloto.** El check completo destapó algo real: con la brisa del sitio a través de la pista, un F-16 sin pedal se pone proa al viento (efecto veleta). Una rueda de morro recta apenas resiste un giro amplio: con ≈1,8 kN·m de par basta un radio de ≈800 m, unos 3°/s a 40 m/s. Así giró 26° en 10 s de carrera de despegue y se salió de la pista. Con el pedal a fondo, el timón sí domina (comprobado), así que el modelo es coherente. Lo que faltaba es que se usara el pedal.
  - Los mandos simples llevan ahora los pedales en lazo cerrado sobre la velocidad de guiñada: la que pides al girar o la del rumbo al soltar, con acción integral para el par sostenido del viento y ganancia creciente con la velocidad (a alta velocidad trabaja el timón).
  - Sobre la pista y alineado con ella (±20°), siguen el eje apuntando a un punto ≈3 s por delante.
  - Con el viento del sitio, despegando, no se separa más de 3 m del eje (antes, 54 m: fuera de la pista).
  - La prueba manual de `ux-check` mantiene el rumbo con el pedal. La del mando compara la misma carrera con y sin stick: el viento es determinista, así que la diferencia es solo del stick.

**Porsche y H2R:** la resistencia y la carga aerodinámica se calculan con el aire relativo. Con 5 m/s de cara el Porsche pierde 8 km/h de punta y gana 15 con el viento de cola; la H2R pierde 15 y gana 11. El empuje lateral del viento sobre la moto inclinada no está modelado (≈).

**El entorno sigue al mismo viento:**
- **La manga de viento** se orienta cada fotograma al viento en lo alto del mástil (con ≈0,6 s de inercia) y se levanta con la velocidad: extendida del todo a 15 kt (FAA AC 150/5345-27) y lacia en calma; la caída intermedia es ≈.
- **El vapor de la plataforma** deriva a sotavento, en el marco en el que cuelgue (la plataforma girada o el propulsor inclinado).
- **Las olas:** el mar de fondo entra desde el ESE (≈) y las olas de viento, la marejadilla y las ondas corren delante del viento.

**Pruebas:**
- `tools/wind-check.mjs` (nueva, en `check:static`): perfil, dirección, estadística de ráfagas, turbulencia viajando a sotavento, la manga y el vapor;
- `f16-check`: efecto suelo (función y vuelo), viento aparcado, la aproximación y el despegue con el viento del sitio;
- `gt3rs-check` y `h2r-check`: punta con viento de cara y de cola.
- Todas fallan con el código anterior.

## Fase 3 del encargo: sonido (4 de octubre de 2026)

**El F-16 ya suena** (`src/sim/f16Sound.js`). Se activa con **M** o con el botón **Sound** de la barra de vuelo, y está apagado hasta que lo enciendes, como los coches. Es un motor F100 sintetizado muestra a muestra en un AudioWorklet con dos salidas: la toma (por delante) y el chorro (≈5 m por detrás de la tobera).
- **El fan:** el tono de paso de álabes y, cuando la punta del fan se acerca a supersónica (hacia potencia militar), el «buzz-saw»: todos los múltiplos de la velocidad del eje. Se genera como surge en realidad, con un diente de sierra por álabe, cada álabe con su propia intensidad (fija, aleatoria) y limitado en banda en cada salto (PolyBLEP). Debajo va el ruido de banda ancha del fan.
- **El núcleo:** el silbido agudo y débil del compresor.
- **El chorro:** el ruido de mezcla, con el pico en Strouhal ≈0,2 sobre el diámetro de salida. Crece muy deprisa con la velocidad del chorro (la potencia 8 de Lighthill, comprimida para que el ralentí se siga oyendo) y tiene su vaivén turbulento lento.
- **El poscombustor:** el chorro más rápido y ancho, el retumbo de la combustión, el crepitar (frentes de choque en ráfagas, como en el cohete) y un golpe sordo al encenderse.
- **En la cabina:** el motor llega apagado y grave a través del avión. Encima, el aire del sistema de climatización y el flujo sobre la cúpula, que crece con la presión dinámica.
- **Las ruedas:** la rodadura en la pista y el chirrido de la toma. La hidráulica del tren mientras se mueve.
- **Fuera de la cabina** se oye donde está (ver abajo). Por encima de Mach 1 no se oye nada por delante del cono de Mach. Si el cono te alcanza (desde la torre o tu propia vista), suena el estampido: una doble onda N.
- **Datos usados:** regímenes ≈ (núcleo ≈68 % al ralentí y ≈94 % en militar, las cifras habituales del indicador del F100); número de álabes ≈; velocidades del chorro ≈.
- **Pruebas** (`tools/sound-check.mjs`):
  - tono de paso de álabes +31 dB sobre su ruido;
  - los órdenes del eje pasan de −26 dB al 18 % de potencia a −9 dB en militar;
  - el chorro sube 20 dB del ralentí a militar y 10 dB más con poscombustión, que además añade +11 dB entre 20 y 70 Hz;
  - el golpe del encendido: +20 dB;
  - en cabina, el silbido del fan baja 23 dB y el aire sube 12 dB con la presión dinámica;
  - sin continua, sin saturación, la geometría del cono de Mach y el coste (1,8 % de un núcleo).
- **Prueba en el navegador** (`ux-check`): M enciende el sonido, el botón lo refleja y el motor llega al bus de audio.

**Un solo contexto de audio para todo** (`src/sim/audioBus.js`): el lanzamiento, el Porsche, la H2R y el F-16 comparten AudioContext y bus maestro. Antes había uno por vehículo: los navegadores permiten pocos y cada uno gasta un hilo. La política de pestaña oculta (suspender y reanudar si hay algún sonido encendido) está ahora en un solo sitio.

**Sonido espacial para los vehículos vistos desde fuera** (`createSpatial`):
- **El retraso de la distancia:** el sonido pasa por una línea de retardo de d/343 s. Al variar d, la velocidad de cambio del retardo desplaza el tono exactamente el factor Doppler de una fuente en movimiento (a primer orden), en las notas del motor y en el ruido por igual: el «ñiiiaaau» al pasar junto a la cámara de pista.
- **Posición, distancia y aire:** el sonido sale de donde está el vehículo (HRTF), baja como 1/d a partir de la distancia a la que se equilibró la síntesis (la de la cámara de persecución), y el aire le quita los agudos con la distancia (≈).
- **Cambios de cámara:** un salto de cámara no se oye como una fuente supersónica; el sonido baja, se recoloca y vuelve.
- **Desde dentro** (cabina, puesto del piloto, casco) no se aplica nada de esto.
- **El viento es del que escucha:** sobre todo dentro; en las vistas exteriores, poco.

**Porsche y H2R:**
- **Rodadura de los neumáticos:** un rumor de banda ancha que crece con la velocidad (≈ la potencia 1,5). Antes no existía, y es casi todo lo que hace un coche a 100 km/h constantes.
- **Sonido espacial** como el del F-16, con su efecto Doppler al pasar.

## Fase 2 del encargo, segunda parte: Porsche y F-16 (4 de octubre de 2026)

**CI en rojo tras la Fase 1, arreglado.** La prueba del mando en `ux-check` leía los alerones (`pilot.roll`), que en tierra ahora quedan centrados porque la dirección va por los pedales (rueda de morro). La prueba lee la dirección, exige alerones a 0 y mide el rumbo girado en 2 s. A plena potencia el avión pasa de 40 a 80 kt en ese tiempo y el giro está limitado a ≈0,15 g (≈2°/s): en 1 s solo giraba 0,3°, por eso el umbral anterior fallaba.

**Porsche 911 GT3 RS:**
- **Detalle de superficie en todos sus materiales** (`detailGt3` en `gt3rs.js`, y en `gt3Cabin.js` para el habitáculo):
  - piel de naranja en la laca de la carrocería y de las llantas;
  - granulado en los plásticos negros, el barril de la llanta y la pinza negra;
  - goma en los neumáticos y en los pasos de rueda;
  - fundición en las pinzas y superficie rectificada en los discos;
  - en el habitáculo: el pelo fino del Alcantara, el grano del cuero, la trama de los cinturones, el granulado de los plásticos y el cepillado del aluminio.
  - Escalas ≈.
- **La piel de naranja va en la laca.** `applyDetail` también perturba ahora la normal del *clearcoat* en los materiales físicos (opción `coat`), que es donde está la piel de naranja de verdad. Antes solo tocaba la capa de debajo, y el reflejo de la laca seguía perfecto.
- **Juntas de los paneles** (`gapOnBody`). Antes eran una línea negra brillante de 4 mm. Ahora miden ≈6 mm de pintura a pintura: el color pasa de la pintura, por el canto redondeado del panel (normales giradas ≈45° hacia la ranura, para que el canto recoja la luz), a casi negro en el fondo. El contorno de la puerta va por una spline centrípeta a ≈1 cm, así las esquinas son redondas y no poligonales. También se aplica a la tapa del depósito.
- **Retrovisores:** la carcasa está soldada y con sombreado suave (antes se veían las facetas). La línea entre pintura y negro se resuelve sección a sección, así sale recta (antes salía en dientes).
- **Lunas laterales:** una banda de pintura justo por fuera del borde inclinado tapa los escalones de la cuadrícula (dientes de ≈1 cm bajo el borde del techo y a lo largo del pilar A). El marco negro va pegado al contorno trazado.
- **Neumáticos:** reborde protector de llanta, ≈6 mm, y 128 segmentos de torno.
- **Frenos:** los doce pernos del disco flotante, en acero cincado.
- **Aletas negras** delante y detrás de las ruedas, con los cantos redondeados (≈3 mm) en vez de cortados en seco.

**F-16A: esquema «Hill Gray» de tres tonos**, el de los F-16A de la USAF desde finales de los setenta hasta principios de los noventa. Antes tenía dos tonos:
- FS 36118 (gris cañonero) arriba, desde la parte trasera de la cúpula y en el extradós de las alas;
- FS 36270 (gris medio) arriba, por delante, y encima de la toma;
- FS 36375 (gris fantasma claro) abajo, en la deriva y en los estabilizadores;
- el radomo, en su gris propio.
- Fuentes: referencias de modelismo (foros de FineScale y f-16.net), no un plano técnico; las líneas de separación son ≈.
- **Desgaste** discreto en el atlas del fuselaje: suciedad en los bordes de los paneles arrastrada hacia atrás por el aire, manchas de fluidos bajo el fuselaje detrás de los pozos del tren y el ahumado del fuselaje trasero junto a la tobera. Todo ≈.
- **Detalle de superficie:** granulado del poliuretano mate, metal estriado en los pétalos de la tobera y esmalte del tren.

## Fase 2 del encargo, primera parte: detalle de superficie y la H2R por dentro (4 de octubre de 2026)

- **Detalle de superficie para los vehículos** (`src/materials/detail.js`). Cada clase de superficie tiene un pequeño mapa de relieve y de rugosidad, sin costuras, generado al arrancar y compartido: fundición en arena, metal cepillado o mecanizado, granulado de pintura en polvo o plástico, goma, piel de naranja bajo la laca, grano de cuero y sarga de carbono 2×2 (esta también con color).
  - Se proyecta desde los tres ejes del propio espacio de la pieza (triplanar), no por UV, porque las piezas son barridos, tornos y extrusiones sin coordenadas métricas. Queda fija a la pieza y no resbala al moverse el vehículo.
  - Se suma al relieve y a la rugosidad que ya tenga el material. Tamaños e intensidades ≈.
- **El motor de la H2R, rehecho pieza a pieza** (`src/vehicles/h2rEngine.js`). Medido sobre una foto libre de la moto en una exposición (Wikimedia Commons, solo como referencia, no está en el repositorio), con su escala y su giro calculados con los dos ejes y la batalla publicada: 1,644 mm por píxel, ≈ ±1 cm. Tiene:
  - el cárter con su línea de partición, tornillos y nervios;
  - el cárter superior de fundición con su resalte redondo;
  - los cilindros y la culata inclinados, con su junta y sus nervios;
  - la tapa de levas con las cuatro pipetas;
  - la tapa del embrague (r 0,127 m) con su escalón, el disco interior (r 0,090 m), la pestaña y doce tornillos;
  - la tapa del captador (r 0,035 m) y el tapón de llenado con su anillo rojo;
  - el cárter de aceite con nervios y tapón de vaciado, el enfriador de aceite con aletas y el filtro;
  - a la izquierda, las tapas del alternador y del piñón (esta sobre el piñón de la cadena), la bomba de agua y los manguitos;
  - el compresor: la carcasa roja, la voluta en espiral hasta la salida, la boca pulida con el rodete de 6 álabes, y los tornillos;
  - los cuatro cuerpos de mariposa y la cámara de admisión con su junta y tornillería.
  - Las tapas torneadas del motor anterior no se veían: el perfil del torno iba al revés y sus caras miraban hacia dentro.
- **Escape:** cuatro colectores con el degradado térmico del titanio que muestran las fotos (pajizo, azul, violeta, bronce). Bajan por delante del enfriador y vuelven bajo el motor hasta el colector. El silencioso es largo, por la derecha, de ≈0,11 m de diámetro, con la boca cortada en bisel, su forro oscuro y dos abrazaderas.
- **Basculante monobrazo de fundición:** viga superior de sección cajón, brazo inferior, alma con rebaje y portabuje excéntrico. La corona y su portacoronas van por fuera, en el extremo del eje, y la cadena pasa por fuera del brazo, como en las fotos sin carenado.
- **Chasis:** los nudos son bosas de ≈34 mm, con su cordón de soldadura y el tornillo que llevan, en vez de discos de 4 cm.
- **Presupuesto** (`tools/check.mjs`), subido por orden del usuario: 4,5 M triángulos, 2.200 mallas, 340 materiales y 220 texturas.

## Fase 1 del encargo: conducción de la H2R y del F-16 (4 de octubre de 2026)

El usuario reordenó el trabajo en cuatro fases (conducción, modelos 3D, sonido, físicas y entorno), con un commit por fase y el check completo solo al final. Esta es la conducción; la del Porsche ya se hizo (bloque 3, dos partes).

**Ninja H2R: ya no se cae por nada.** Antes caía al pasar el caballito o la invertida del punto de equilibrio (sin ayudas, cualquier frenada fuerte en recta la volcaba por delante), al meterse en agua de más de 0,45 m y con cualquier golpe de más de 25 km/h. Ahora:
- **solo se cae en un choque fuerte:** de frente (más de 30°) y a más de ≈45 km/h de velocidad de cierre (`CRASH`, ≈). Un golpe más lento la para contra el obstáculo y rebota; uno de refilón la arrastra a lo largo;
- **el piloto se salva siempre**, con ayudas o sin ellas (un reflejo del piloto de la simulación, ≈):
  - si la trasera se levanta frenando, suelta la maneta: empieza a soltar a 3° y del todo a 10°, leyendo 0,15 s por delante;
  - sin ABS, no frena más de lo que levanta la trasera (≈5 % por encima). De 200 a 0 sin ayudas: 6,4 s, con la trasera a ≈5° como mucho;
  - en un caballito corta el gas antes del punto de equilibrio. Sin ayudas llega a 44° (el equilibrio está a 48°). Además hay un tope de seguridad;
- **agua profunda:** el motor se ahoga y la moto frena y se queda de pie;
- **R (o el botón «Pick up») levanta la moto** donde está, de pie y parada. Si ese sitio está mojado o dentro de lo que golpeó, la pone en el último punto seco y libre por el que pasó de pie. El motor arranca y se conservan las ayudas y el modo de la caja;
- **el límite de inclinación sigue igual:** nunca se cae al girar.

Pruebas (`tools/h2r-check.mjs`): caballito sin ayudas, frenada a fondo sin ayudas a 200 km/h, agua de 0,6 m con R, golpe a 30 km/h sin caída, R tras un choque a 80 km/h, y 200 recorridos aleatorios sin ninguna caída, ni por inclinación ni por cabeceo. En el navegador (`ux-check`): R levanta la moto tras una caída.

**F-16** (de `docs/diagnostico-2026-10-04/f16.json`):
- **En tierra ya no se tumba sobre un ala al girar.** Antes lo hacía a cualquier velocidad, incluso a 5 kt.
  - El recorrido de la rueda de morro (32°) se limita con la velocidad para pedir como mucho ≈0,15 g. El centro de gravedad está a 1,85 m de altura sobre una vía de 2,36 m, y los amortiguadores lo inclinan antes de los 0,54 g del vuelco estático.
  - Las ruedas tienen una fuerza lateral por ángulo de deriva, con círculo de fricción (μ ≈0,55 en pista, 0,35 en tierra, ≈).
  - Con mandos simples, A/D piden un ritmo de giro, el pedal es pequeño a velocidad (el timón casi no se mueve) y la palanca se queda centrada. A fondo 10 s, de 5 a 100 kt: gira sin volcar.
- **Autoacelerador:** al soltar W o S, el gas mantiene la velocidad que había (200–600 kt), sin postcombustión salvo que haga falta; tras el despegue, 350 kt. Antes se quedaba en postcombustión a fondo y el avión subía a Mach 1,65 y 83.000 ft.
- **Nivelado automático:** si no se tocan ↑/↓ desde el despegue, la subida se nivela entre 4.000 y 5.000 ft.
- **Aproximación con el tren abajo:**
  - nunca baja de 145 kt por encima de la pista; los aerofrenos solo se abren por encima de 150 kt;
  - en la recogida, por debajo de 20 m, S no cuenta;
  - el cabeceo se limita a 12° (la tobera toca a ≈14,5°);
  - el Auto-GCAS salta antes (bajando a más de 6 m/s a menos de 4 s del suelo).
  - Antes, S mantenida acababa en una caída sobre el tren a 25 m/s; ahora toma a 1,65 m/s.
- **El HUD indica la pista 28** (`src/sim/f16Cue.js`): un triángulo bajo el rumbo hacia el umbral y su distancia en millas. En final (a menos de 10 NM y alineado a menos de 30°), las desviaciones de la senda de 3° y del eje, como un ILS. También muestra la velocidad del autoacelerador («A/T»).
- **La cámara de persecución** suaviza su desplazamiento y no su posición: se queda a la misma distancia a cualquier velocidad (antes, 49 m a 80 m/s y 107 m a 350 m/s, frente a 26 m de diseño). Su «arriba» es el del avión mezclado con el del mundo, y no se tuerce en una subida vertical.
- Las ayudas leen la altitud geodésica y no la `y` de la escena.
- Pruebas nuevas en `tools/f16-check.mjs`: rodaje girando, nivelado y autoacelerador, aproximación con S mantenida e indicación de la pista.

## Pasada decisiva, bloque 4 (primera parte): el sonido de los motores, sin arenilla ni clics (4 de octubre de 2026)

Del diagnóstico `docs/diagnostico-2026-10-04/sonido.json`, pasos 0–2. Todo lo comprueba `tools/sound-check.mjs` (en `check:static`), que saca el código de cada worklet de su módulo y lo renderiza sin navegador a 48 kHz.
- **Cada explosión en su instante exacto.** Antes se redondeaba a la muestra entera más cercana: cuando el periodo de encendido no era un número entero de muestras, aparecía un ruido inarmónico que dependía de las rpm (−25 dB a 14.000 rpm en la H2R, −27 dB a 8.900 en el GT3: la «arenilla digital» al subir de vueltas). Ahora cada impulso se reparte entre dos muestras según su posición: −39,5 dB en la H2R a 14.000 rpm y −41,9 dB en el GT3 a 8.900 (con la variación aleatoria entre cilindros quitada para medir).
- **Controles muestra a muestra:** rpm, carga, gas, corte y encendido son parámetros de audio que el hilo principal desliza (`setTargetAtTime`), en vez de un mensaje por fotograma suavizado una vez por bloque. Se acaban la escalera de tono que dependía de los fps y el clic al pararse el motor (una caída o un motor ahogado): el salto al pararse es ahora menor que en marcha.
- **El gas que recibe el motor**, no el del pedal: el sonido lee `s.engThr` y `s.engLoad` (con los cortes del cambio rápido, el limitador, el golpe de gas del PDK al reducir y el control de tracción).
- **H2R, válvula de alivio:** su silbido tenía la fase atada al compresor y, tras ≈30 s, salía como ruido aliasado entre 2 y 47 kHz; además nunca sonaba en los cambios rápidos. Ahora tiene su propia fase: un silbido que cae de ≈2,7 a 1 kHz en ≈60 ms con el siseo del aire (banda de ≈4 kHz), del tamaño de la presión que suelta (≈). Suena cuando el gas del motor se cierra con presión, también en cada cambio rápido. La prueba exige el mismo silbido a los 0,5 s que a los 40 s.
- **H2R, compresor:** silba al paso de sus álabes, 6 en la punta (Kawasaki), 55,2 veces la velocidad del cigüeñal (≈12,9 kHz a 14.000 rpm), y ya no a la velocidad del eje (9,2×), que queda ≈20 dB por debajo. Nada por encima de 0,45 de la frecuencia de muestreo.
- **Sin continua a la salida:** el filtro que la quita va ahora después de la última curva (antes dejaba ≈0,03). Comprobado también en Chromium con un `OfflineAudioContext`: los dos worklets cargan y suenan. Cada motor gasta ≈1,5 % de un núcleo.

## Pasada decisiva, bloque 3 (segunda parte): PSM en tres etapas, cámaras, pianos, neumáticos y vuelta de referencia (4 de octubre de 2026)

Lo que quedaba de `conduccion-porsche.json`, más un dato del dossier de Porsche que el modelo no respetaba. Cada punto tiene su prueba en `tools/gt3rs-check.mjs` (o en `ux-check`), y cada prueba nueva se comprobó contra el código anterior.
- **PSM en tres etapas (P2-14)**, como en los GT de Porsche («desactivación opcional en dos etapas (ESC OFF y ESC+TC OFF)», dossier del 911 GT3; el del GT3 RS: ESC y TC «se pueden desactivar por completo»). **T** (o el botón, o X en el mando) recorre PSM → ESC OFF → ESC+TC OFF. Con ESC OFF solo trabaja el control de tracción: a la salida de una curva a fondo, el ESC no frena ninguna rueda y la tracción recorta el gas hasta el 36 %. El modo elegido se conserva al volver a la explanada. (La regulación del TC en varias posiciones del coche real no se modela.)
- **Testigos nuevos en el HUD:** TC (trabajando), PTV (freno de la trasera interior), la etapa del PSM en ámbar cuando no está entera, y una barra con el par que retiene el bloqueo del diferencial (escala ≈ de 2.000 N·m).
- **Cámaras independientes de los fotogramas (P2-12),** en `src/sim/gt3Camera.js`:
  - la de persecución sigue el rumbo con un filtro de 0,17 s (antes recalculaba una mezcla fija cada fotograma y saltaba con cada coletazo: la aceleración angular máxima en un eslalon baja de 6,3 a 2,7 rad/s²);
  - el cuello del piloto se integra en subpasos fijos (la diferencia entre 30 y 144 fps baja de 1,03 a 0,13 mm);
  - el piloto conserva ≈la mitad de la inclinación de la carrocería y la cámara del capó, toda (antes ninguna de las dos se inclinaba);
  - en marcha atrás la cámara ya no se da la vuelta.
- **Vibración de la carretera y de los pianos (P2-13),** determinista: un perfil fijo a lo largo de la distancia recorrida (ruido de dos octavas, ≈0,9 y 0,3 m), con un tamaño según lo que hay bajo las ruedas (piano 4,3 mm en el ojo a 80 km/h, asfalto 0,3 mm; ≈). Lo usan la cámara, el mando (más vibración con más ruedas en el piano) y el sonido: un retumbar cuya altura sube con la velocidad (≈ textura de 25 cm) y un golpe cada vez que una rueda pisa o deja el borde del piano. El piano sigue siendo el plano de 3 cm de antes: no se ha inventado geometría.
- **Neumáticos (P2-10):** las constantes de la fórmula mágica pasan a `TYRES` (`mfB`, `mfC`, `slipPeak`, `alphaPeak`) y se quitan seis campos que nadie leía. La longitud de relajación crece con la raíz de la carga (0,5 m a la carga estática, ≈) y el término de baja velocidad desaparece por encima de 3 m/s. Escalón de 3° a 100 km/h: guiñada al 90 % en 112 ms, sobreoscilación del 9,6 %.
- **Dirección del eje trasero según el dossier:** 2,0° en contra de las delanteras hasta ≈50 km/h y 2,0° a favor desde 80 km/h (antes pasaba por cero a 50 km/h y no llegaba al máximo hasta 100). El diámetro de giro sigue en 10,51 m.
- **Vuelta de referencia (P3):** `tools/gt3rs-lap.mjs` da una vuelta al circuito (2.505,5 m) con un conductor automático (persecución pura y un perfil de velocidad por curvatura), con el PSM puesto: 1:26,421 sin salirse, y 1,36 / 1,46 / 0,64 g de aceleración lateral máxima a 60 / 100 / 150 km/h. Va en `check:static` y falla si algo se mueve más de un 1 %. No es la vuelta más rápida posible (no es una trazada de carreras). La de Nordschleife (6:49,328) no se puede comprobar: no hay trazado con licencia.
- **Revisión adversarial** (hecha a mano; `docs/diagnostico-2026-10-04/revisiones/bloque3-porsche.json`): 150 recorridos aleatorios de 20 s con el teclado sobre el circuito por cada etapa del PSM. Con PSM: ningún trompo, ningún NaN, ningún despegue y el ABS cambia de sentido ≤2 veces por segundo. Con ESC OFF, un trompo (hierba, a fondo). Sin nada, 24 (casi todos con gas a fondo en hierba o grava). Encontró la cámara de marcha atrás y la etiqueta del HUD que se solapaba; las dos están corregidas.

## CI en rojo tras el bloque 3 (primera parte), arreglado (4 de octubre de 2026)

El check completo de `501d6f3` y de `9917115` falló en `tools/ux-check.mjs`, en «A restored WebGL context keeps the ground lit» (luminancia 111 antes y 125 después), y Pages no se actualizó. **No era el contexto WebGL.** La prueba nueva de la H2R mandaba sus teclas como eventos sintéticos sobre `window`; ahí el evento está en su destino y los atajos de la página, registrados antes, se ejecutan antes que el manejador de captura de la moto. La **G** (caja automática) arrancaba también el lanzamiento de Starship, cuya cámara se llevaba la vista entre las dos medidas. Con una tecla real el evento llega a `document.body` y la moto se lo queda (comprobado en el navegador). Arreglo, solo en la prueba:
- los ayudantes de teclado de `ux-check` despachan sobre `document.body`, como una tecla real;
- la prueba de la H2R exige además que **G** no arranque el lanzamiento (con el despacho viejo, falla);
- la prueba de la luz exige que no haya ninguna secuencia en marcha entre las dos medidas.

## Pasada decisiva, bloque 3 (primera parte): la conducción del Porsche (4 de octubre de 2026)

Aplicado del diagnóstico `docs/diagnostico-2026-10-04/conduccion-porsche.json` (P0, P1 y parte de P2). Cada punto tiene su prueba en `tools/gt3rs-check.mjs`.

- **DRS automático solo en recta:** se abre con menos de 0,3 g laterales y menos de 2° de volante en las ruedas, y el alerón tarda 0,3 s en moverse (`AERO.drsLatG`, `drsSteer`, `drsTime`, ≈). Antes se abría en una curva de 1,6 g y quitaba el 55 % de la carga de golpe.
- **Volante con teclado (`steerReach`):** pide el ángulo con el que las delanteras llegan a su agarre. Tiene en cuenta el μ del suelo, la carga aerodinámica (`TYRES.downGain` = 0,5, medido), el subviraje propio (`TYRES.kUs`, medido) y el eje trasero direccional, y se corrige con el deslizamiento real de las delanteras. Antes pedía el doble. El ritmo del volante es proporcional al alcance: a fondo en ≈0,28 s a cualquier velocidad (`steerRate`).
- **Mando de juego** (`src/sim/gt3Pad.js`):
  - zona muerta reescalada y recorrido x^1,6, limitado por el agarre;
  - gatillos analógicos;
  - LB/RB levas, X PSM, Y cámara, Start pausa;
  - vibración según los neumáticos, los pianos y el ABS.
- **Equilibrio:** la sensibilidad a la carga se toma respecto a la carga estática de cada eje. A 240 km/h en el límite el coche hacía trompo; ahora subvira, como el de calle.
- **PDK:**
  - cambio hacia arriba sin hueco de empuje: el embrague nuevo toma el par patinando, con el par del motor recortado al 40 % hasta sincronizar, en 50–120 ms;
  - mapa según el pedal: sube pronto con poco gas, y no sube en curva con gas;
  - *kickdown*: varias marchas de golpe;
  - `GEARBOX.efficiency` = 0,875, reajustado: 0–100 / 160 / 200 en 3,23 / 6,78 / 10,57 s y punta de 295,7 km/h, todo a ±2 % de lo publicado.
- **Control de tracción:** también corta si una trasera pasa de 1,1 de deslizamiento combinado (se va de lado), no solo si patina.
- **Diferencial PTV Plus** (`DIFF`, ≈):
  - las traseras se resuelven juntas, de forma implícita, con la inercia del motor solo en su suma (antes sumada a cada rueda: una rueda sola giraba 11 veces más despacio de lo debido);
  - bloqueo con mapa electrónico: abierto al entrar en curva, cerrado a la salida con gas y a alta velocidad; con PSM se abre si el coche guiña hacia donde no se le pide;
  - freno en la trasera interior mientras el coche subvira por debajo de 150 km/h.
  - Ahora, con gas a la salida y sin PSM, la cola sale (27° en 0,5 s); con agarre desigual sale en 4,2 s (abierto, 5,45 s).
- **Ruedas descargadas:** la delantera interior en el aire ya no da deslizamientos falsos (marcas, humo y chirrido van ponderados por la carga).
- **ABS proporcional-integral** sobre un deslizamiento objetivo: 8 cambios de sentido por segundo (antes ≈50) y la presión nunca baja del 56 %. Frena 100–0 en 27,5 m y 200–0 en 100,6 m (auto motor und sport: 28,0 y 97,0).
- **Diámetro de giro:** 10,53 m con el volante a tope (publicado: 10,5). El ángulo máximo pasa de 30° a 32° (≈).

## Pasada decisiva, bloque 2: la H2R ya no se cae al girar (4 de octubre de 2026)

**El fallo:** la moto se caía con muchísima facilidad. Con las ayudas puestas, 193 de 200 recorridos aleatorios de 30 s acababan en el suelo. Bastaba con soltar la tecla tras una curva a fondo, frenar o acelerar inclinado, pisar la hierba o entrar en un charco. El usuario pidió que no se pudiera caer al girar: «solo un límite de inclinación y ya está».

**El modelo nuevo** (`src/sim/h2rBike.js`):
- **Agarre compartido, con prioridad para la inclinación.** La parte lateral que pide la inclinación va primero, y lo que queda del círculo de fricción es lo que pueden usar el freno y el gas.
  - Con las ayudas, el ABS y el control de tracción en curva limitan freno y gas a ese resto, como hacen los sistemas publicados de la H2R (KCMF, KIBS y KTRC, que leen la inclinación de la IMU; verificado en la ficha del modelo 2026 de Kawasaki).
  - Sin ayudas, el círculo de fricción sigue siendo de los neumáticos: la delantera se bloquea y desliza (≈0,7 del agarre) o la trasera patina. Frena menos o abre la trazada, pero no se cae.
- **El límite de inclinación es lo único que sostiene la curva.** Es lo que agarran los neumáticos (atan del agarre que queda, a 0,92 del máximo, ≈) y nunca pasa de donde tocan las estriberas y el carenado (58°, ≈).
  - A baja velocidad también se limita a lo que el manillar puede equilibrar.
  - Si alguno de esos límites baja (al frenar hasta pararse, al pisar la hierba), el tope baja a ≈50°/s y la moto se levanta.
  - Más allá del agarre la moto se abre en vez de caerse, y la inclinación baja a la que equilibra su giro.
- **El cabeceo, con la altura real del centro de masas:** inclinada a φ está a h·cos φ del suelo, así que hace falta más freno para levantar la rueda trasera y más gas para el caballito.
- **Agua:** su arrastre (≈ del ancho del neumático delantero y la profundidad, como mucho 0,6 g) frena la moto, pero no cuenta contra el agarre. El tope de frenada de las ayudas lo descuenta, y la elevación de la trasera suelta el freno del todo a 4°.
- **Vallas:** los postes contiguos se tratan como una sola pared, con su normal. Al rozar, la moto se arrastra a lo largo, pierde velocidad y salen chispas. Solo se cae con un golpe de frente y fuerte (más de 7 m/s contra la valla y más de 20°). La moto avanza en pasos de 10 cm como máximo: a 255 km/h atravesaba una valla de postes.
- **Cambios de rasante:** si el suelo cae más deprisa de lo que la gravedad la lleva, vuela y aterriza sobre los muelles. Con la rueda delantera en el aire (caballito), el manillar no gira la moto.
- **Pendientes:** la gravedad tira a lo largo de la cuesta. Cuesta arriba sin gas se para donde dice la energía. Todavía no rueda hacia atrás.
- **Caja:**
  - rechaza una reducción que pasaría de vueltas;
  - el embrague patina para no calarse en cualquier marcha;
  - **G** vuelve al cambio automático;
  - sin freno motor durante el corte del cambio rápido (daba tirones de 0,3 g).
- **Dirección:** el giro en el suelo es el del manillar acortado por el avance (δ·cos 25,1°). Con los 27° publicados, el giro más cerrado es de ≈3,2 m, a paso de peatón.
- **Aceleración contra MOTORRAD:** un embrague que pasa el 70 % del par mientras patina en la salida (`ENGINE.launchClutch`, ≈, ajustado) y el aire forzado completo a 337 km/h.

| MOTORRAD (GPS, Lausitzring 2015) | Antes | Ahora |
|---|---|---|
| 0–100 km/h 3,1 s | 2,87 s | 3,08 s |
| 0–200 km/h 6,5 s (184 m) | 6,51 s (196 m) | 6,50 s (187 m) |
| 0–300 km/h 13,4 s (660 m) | 13,06 s (670 m) | 13,15 s (669 m) |
| 337 km/h | 338 km/h | 338 km/h |

**Pilotaje** (`h2rRide.js`, `h2rHud.js`):
- Cámara del piloto: se descuelga hacia dentro de la curva (≈0,22 m a 45°), mantiene la cabeza más nivelada que la moto (la mitad de la inclinación, filtrada), mira hacia la salida y se mueve un poco con las g.
- El freno delantero entra en ≈0,2 s.
- El indicador de inclinación marca el límite, y hay testigos **ABS**, **TC** y **LEAN**.
- Avisos: reducción rechazada, límite de inclinación y roce con la valla.
- El cabeceo de la suspensión se cuenta desde su reposo.

**Pruebas nuevas** (`tools/h2r-check.mjs`, con las rampas del teclado de la app):
- soltar la inclinación de 50 a 250 km/h;
- frenar y acelerar a fondo inclinada (frena más de 0,3 g);
- 200 recorridos aleatorios de 20 s con y sin ayudas, con cambios de superficie: 0 caídas no permitidas;
- baja velocidad;
- agua de hasta 0,44 m a 337 km/h;
- roce a 10°;
- valla de postes a 260–340 km/h;
- cambio de rasante;
- cuesta;
- caja;
- delantera bloqueada dentro del círculo de fricción;
- inclinación al patinar;
- radio mínimo.

En `ux-check.mjs`, una prueba en el navegador: con N y D a fondo, la moto llega al límite, se levanta al soltar y no se cae.

**Revisión adversarial:** tres agentes (cazador de caídas, realismo y código) encontraron 18 defectos en la primera versión de este bloque, todos corregidos. Entre ellos: la valla atravesada, el vuelco en agua frenando, el cabeceo sin la inclinación, el bloqueo de la delantera y las pruebas que medían poco.

**Pendiente:** sin ayudas, la moto vuelca por delante con frenadas fuertes en recta. Es físico, pero con un teclado que solo frena a fondo es fácil; se podría añadir una red de seguridad si el usuario la quiere. Tampoco rueda hacia atrás en una cuesta.

## Pasada decisiva, bloque 1: el cuadrado negro, arreglado (4 de octubre de 2026)

**El fallo:** cerca del Porsche y de la H2R aparecía a ratos un rectángulo negro que tapaba media pantalla y parpadeaba al mover la cámara.

**La causa:** había triángulos de área cero con normales (0, 0, 0). Por ejemplo, los del splitter del Porsche: su contorno se recortaba con un mínimo y dejaba puntos alineados.
- En el sombreado, `normalize(vec3(0))` da NaN en algún píxel suelto.
- El filtro de luciérnagas que va antes del bloom dejaba pasar ese NaN: la comparación `m > uPeak` es falsa con NaN. Además, un Inf lo convertía en NaN.
- El desenfoque del bloom extendía ese único píxel a un bloque negro de cientos de píxeles.

**El arreglo, en cinco capas:**
1. **Filtro a prueba de NaN e Inf** (`main.js`). Un píxel no finito pasa a negro antes del bloom. Se comprueba dos veces: con `isnan`/`isinf` y sobre los bits del exponente, porque un compilador que da por hecho que no hay NaN puede quitar la primera comprobación, pero no las operaciones con enteros.
2. **Splitter limpio en origen** (`buildSplitter`). Se quitan los puntos alineados del contorno; la forma no cambia.
3. **`sanitizeNormals(scene)`** (`geometry/utils.js`), una vez al arrancar.
   - Un triángulo con área cuya normal se anuló toma la normal de su cara.
   - Uno sin área se colapsa en un punto, que ya no puede dibujar nada.
   - El número de vértices y de triángulos no cambia.
   - Arregla 475 triángulos en 40 geometrías: la cabina, las aberturas, las ruedas, los pianos y el Roadster.
4. **Los golpes del Porsche:** cada abolladura recalcula las normales, y eso revivía 899 triángulos nulos en el morro, la cola, los faros y las aberturas. `gt3Damage.js` los vuelve a sanear tras cada golpe. (Lo encontró la revisión adversarial del cambio.)
5. **El pase de AO** dibuja las normales antes del filtro, y su eliminación de ruido extendía un NaN a una mancha de ≈9 px. Ahora una normal no finita se escribe como «sin normal», que el filtro de ruido ya descarta (`core/ao.js`).

Además, el tamaño de los puntos del humo y del agua del Porsche se acota a 1–512 px, como en `core/effects.js`.

**Medido en el navegador, antes y después:**

| | Antes | Después |
|---|---|---|
| Triángulos con normal nula en la escena | 495 | 0 |
| 40 fotogramas orbitando la H2R a 5 m (X = bloque negro) | `.................X.XX......XX..X.XX.....` | ninguno |
| Un NaN forzado de ≈4 px | 100 % de la imagen negra | 0,012 % de la imagen cambia |
| Tras 18 golpes al Porsche | 899 triángulos nulos | 0 |

**Pruebas nuevas:**
- `check.mjs` · «ningún triángulo con normal nula»: todas las mallas, sea cual sea su material, porque el AO las dibuja todas.
- `check.mjs` · «un píxel NaN no se convierte en un bloque negro»:
  - Dos fuentes: un sombreador que divide cero entre cero y un cuadrado iluminado con normales nulas.
  - Cada una con un control: sin el filtro, la imagen tiene que cambiar más de un 10 %, porque si no la prueba no demuestra nada. Con el filtro, menos de un 1 %.
  - Se dibuja con los render targets sin multimuestreo, porque el de SwiftShader se traga el NaN.
- `gt3rs-check.mjs` · «ningún triángulo del coche con normal nula»: el splitter recién construido, el coche saneado y el coche tras 18 golpes.
