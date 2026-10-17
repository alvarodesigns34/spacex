# Rondas de septiembre de 2026: el complejo, el lanzamiento, las fuentes y la reentrada

Auditoría y rondas del 28 y 29 de septiembre de 2026: el lanzamiento, el realismo del Pad 2 y de la versión 3, la Tierra real, la reorientación de la costa y la reentrada de Starship (vuelo 14).

Las secciones de este archivo se movieron del `README.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo bajó un nivel el título de cada sección). Los números de línea, rutas y nombres de sección que citan siguen siendo los de entonces.

[← Índice de rondas](README.md) · [← README](../../README.md)

## Auditoría y mejoras del 28 de septiembre de 2026

Se auditó la simulación ejecutándola en Chromium con teclado, ratón y toques reales (1440 × 900, y 390 × 844 táctil antes de retirar el soporte de teléfono), con sondas de coste de CPU, fugas de memoria tras tres lanzamientos completos, pérdida y recuperación del contexto WebGL, y un análisis estático con ESLint. Estado de partida: sin errores de consola, sin fugas (geometrías, texturas, programas y objetos constantes tras tres ciclos), el código JS de cada fotograma despreciable (`lod.update` y `launch.update` ≈ 0,1–0,2 ms: el límite es la GPU) y la batería en verde. Lo que se encontró, y lo que se hizo:

- **La nave tras la separación no era físicamente coherente** (su aceleración bajaba mientras quemaba, 299 km y media velocidad orbital al final): ahora se integra como un cohete. Ver *El complejo de lanzamiento y la secuencia*.
- **Al perder y recuperar el contexto WebGL, el suelo perdía más de la mitad de su luz** (luminancia 108 → 49 en la vista del Falcon 9): la sonda de reflejos es un render target sin origen que volver a subir. Se reconstruye al recuperar el contexto. `tools/ux-check.mjs` lo mide, con un control negativo que quita la reconstrucción y ve el suelo oscurecerse (113,8 → 107,5 con ella; 107,5 → 48,1 sin ella).
- **El sonido seguía rugiendo con la pestaña oculta**, al último nivel: `requestAnimationFrame` se detiene y con él la actualización. El contexto de audio se suspende al ocultar la pestaña y se reanuda al volver (probado en `ux-check`).
- **El vuelo libre atravesaba el terreno**: su suelo era un plano a 0,4 m y las lomas llegan a ~7 m (el 3,9 % del terreno muestreado estaba por encima). Ahora el suelo es la misma función de altura con la que se construye el terreno, más el pad y su terraplén. Prueba con control negativo (con el suelo plano, la cámara se hunde en la loma).
- **La vista general en un móvil en vertical enseñaba un cuarto de la fila**: se añadió un encuadre que se aleja hasta que cabe la fila entera. Desde la segunda ronda del día se prueba en una ventana alta de escritorio (900 × 1200), porque el soporte de teléfono se retiró.
- **El panel de misión** se pliega al reloj, la fase y los controles con su botón. (En esta ronda empezaba plegado en pantallas bajas de móvil; desde la segunda ronda del día empieza siempre desplegado.)
- **Controles de la misión:** pausa, cámara lenta ×¼, reinicio, salto a cualquier instante desde el perfil de vuelo y ←/→ entre hitos (ver *Controles*). Todos probados con clics y teclas reales.
- **Paseo a la altura de los ojos** (tecla V) y **visita guiada con textos y fuentes** (ver *Controles*).
- **Humo y vapor:** la parte baja de cada bocanada se funde con el suelo que tiene debajo (la explanada, el pad y su terraplén) en vez de cortarse en una línea dura; el contorno de cada bocanada, donde la cúpula se ve de canto, se aclara y queda como un borde fino iluminado a contraluz; las lenguas de fuego de los respiraderos en la separación en caliente y el fuego de la zanja parpadean y se deshacen en jirones en lugar de formar una lámina naranja lisa («un pétalo»); y el vapor de la captura es más fino y se expande más, en lugar de bolas de algodón sueltas. Sin partículas nuevas ni pasadas nuevas: todo en los sombreadores que ya había.
- **Medidor `?perf`**, **ESLint** en la batería, **CI en cuatro trabajos paralelos** e **historial movido a `docs/historial.md`**.
- **Pequeños:** las cifras de la regla llevan un halo oscuro (sobre cielo blanco, el ámbar quedaba por debajo de 2:1). (Hubo también un tamaño mínimo de 36 px para pantallas táctiles, retirado con el soporte de teléfono.)

**Lo que no se pudo hacer en esta ronda:** el entorno solo tenía acceso a GitHub y a npm. spacex.com, la NASA, Wikipedia, NASASpaceflight y Tesla no eran accesibles, así que ninguna cifra se ha contrastado de nuevo con su fuente, no se ha verificado ningún pendiente (altura de la torre, giro de la pila, paso a 3 motores, pinzas del Falcon 1) y no se ha podido comprobar Pages con `curl`. La nave integrada usa las cifras publicadas que ya estaban en la ficha, y lo supuesto va marcado ≈.

## Lanzamiento, segunda ronda del 28 de septiembre de 2026

Revisión pedida por el usuario tras probar la ronda anterior: la cámara perdía el cohete, las llamas y el humo no parecían reales, y la separación en caliente parecía hacer algo imposible.

**Cámara que sigue al cohete.** Al arrastrar (o al pausar, girar y reanudar) la cámara se quedaba donde estaba: el plan de planos soltaba el control y nadie la movía, así que el cohete, a cientos de km/h, salía de cuadro en segundos. Ahora, mientras corre la secuencia, la órbita del visitante va montada en el vehículo: cada fotograma el centro de la órbita y la cámara se desplazan lo mismo que el vehículo, y se puede girar, acercar, pausar y reanudar sin perderlo. El botón *Camera* o la tecla **C** eligen entre los planos de realización y la órbita montada en el propulsor o en la nave. `ux-check` lo prueba con un arrastre real y 20 s de misión: la nave sigue en cuadro y a la misma distancia; con el seguimiento desactivado (control negativo) se queda atrás.

**La separación en caliente, como se hace.** Así funciona según las fuentes consultadas (la página de SpaceX sobre V3, el análisis de NASASpaceflight del Block 3 y, como secundaria, la wiki de aficionados): la nave enciende sus motores estando todavía unida al propulsor, que mantiene encendidos los tres centrales. El chorro de la nave da de lleno en la cúpula delantera del propulsor, que en el Block 3 está blindada dentro de la etapa caliente integrada (una celosía abierta), y sale hacia los lados a través de ella hasta que las etapas se separan. Así que la nave sí dispara directamente contra la parte superior del propulsor: es el diseño. Lo que estaba mal era otra cosa:
- **El penacho de la nave atravesaba el propulsor.** Se dibujaba entero, más de 100 m, a través de los tanques. Ahora se corta en la cúpula mientras la cúpula está en su camino (a menos de 22° de su eje), y el abanico de fuego que sale por la etapa caliente dura mientras la separación es corta, no un tiempo fijo. Los chorros individuales de la nave se cortan igual. `ux-check` mide en la escena que el penacho no pasa de la cúpula.
- **La nave giraba alrededor de la base del propulsor.** Desde que la nave se integra como un cohete (ronda anterior), su actitud cambia unos 20° en los primeros segundos, y el grupo que la mueve tiene el origen 72 m más abajo, en los motores del propulsor. La nave se desplazaba decenas de metros de lado y pasaba por el propulsor. Ahora gira sobre su propio centro.
- **En el vacío, el penacho era un pétalo naranja opaco.** La envolvente se hacía más opaca al subir, en lugar de más tenue, y el núcleo brillante se alargaba con ella. Ahora el núcleo se queda corto y la envolvente es un halo tenue y ancho que brilla más en el borde (ver abajo).

**Llamas.** Las dos ondulaciones senoidales que hacían de turbulencia dibujaban bandas regulares sobre un cono liso, que es justo lo que delata una llama dibujada. Ahora cada capa del penacho lleva ruido volumétrico en metros, arrastrado aguas abajo con el flujo: remolinos de pocos metros en la plataforma que crecen al expandirse el chorro, parpadeo de brillo en la capa de mezcla y un contorno deshilachado en lugar de una superficie cónica limpia. En el vacío la campana brilla sobre todo en el borde, donde la línea de visión cruza más capa de choque: la «medusa» de las imágenes a gran altura. Las lenguas de fuego de la separación y el fuego de la zanja ya parpadeaban y se deshacían en jirones desde la ronda anterior. Es aproximado: el aspecto se ajusta mirando fotografías y vídeos, no con un cálculo de la llama.

**Estela del ascenso.** El metano y el oxígeno se queman dando agua y CO₂, y en cualquier vídeo de lanzamiento esa agua deja en el aire frío una estela blanca que sigue en el cielo cuando el cohete ya se ha ido. El conjunto no dejaba ninguna. Ahora deja una estela de condensación desde que sale el penacho brillante hasta unos 20 km, que se ensancha y deriva. El tamaño de las bocanadas y dónde se acaba son una reconstrucción a partir de vídeos (≈).

**Propulsor V3: motores en el regreso.** Lo que SpaceX publica de los vuelos con el Block 3, leído a través de resúmenes de búsqueda (las páginas no se pudieron abrir desde este entorno): en el vuelo 13 el propulsor completó la fase de alto empuje del *boostback* con los 33 motores, la primera vez para un Super Heavy V3; en el vuelo 14 el encendido de aterrizaje usó los 13 previstos (se encendieron 11) y bajó a 5 para el ajuste fino y luego a 3. El modelo hacía el *boostback* con 13 motores y el aterrizaje de 13 a 3, como en el vuelo 5 con un V2. Ahora:
- el *boostback* arranca con los 33 motores y sigue con los 13 interiores;
- el aterrizaje pasa de 13 a 5 y luego a 3.

El orden está citado. Cuánto dura cada tramo no se publica: los ≈10 s con 33 motores y los ≈3 s con 5 son reconstruidos. El empuje del regreso se vuelve a resolver con esa forma, así que las horas citadas se siguen cumpliendo. Con los 33 motores el *boostback* llega a ≈8,2 g con los tanques casi vacíos. Por eso el límite de aceleración de `cloud-check` pasa de 8 a 12 g: sigue rechazando por un factor de cien el salto que esa prueba vigila (11 850 m/s²). Una prueba nueva comprueba los recuentos 33 → 13 y 13 → 5 → 3. **Limitación que queda:** los tiempos del regreso siguen siendo los del vuelo 5 (V2), el único con captura cuyo cronograma está publicado. Con ellos, un *boostback* de 56 s sale a unas 62 tf por motor, muy por debajo de las 250 tf de un Raptor 3. Un V3 real hace un *boostback* más corto y más fuerte, pero no hay un regreso de V3 con captura publicado con el que ajustarlo.

**El vuelo 14 (28 de septiembre de 2026), qué se ha usado.** Según SpaceX, CNN, NPR y ABC, leídos solo a través de resúmenes de búsqueda:
- fue el primer vuelo orbital de Starship: despegó a las 7:48 CT y desplegó 26 satélites Starlink V3;
- durante el ascenso se apagaron antes de tiempo un Raptor del propulsor y un Raptor Vacuum de la nave, y la nave quemó más tiempo con los otros cinco para compensar;
- el propulsor hizo su *boostback* (se encendieron 31 de los 33 motores) y amerizó en el golfo tras simular el aterrizaje, sin captura;
- la nave hizo su primera combustión de salida de órbita con un Raptor de nivel del mar, reentró y amerizó en el Pacífico norte, cerca de Hawái.

De todo eso, el modelo toma la secuencia de motores del aterrizaje V3. El resto no se usa: la demostración sigue siendo compuesta, con captura en la torre, y termina en T+7:16, antes de la entrada en órbita. Los datos de telemetría de las retransmisiones (velocidad y altitud en cada momento) no se han podido leer: ni las páginas ni los vídeos eran accesibles, y un cronograma que apareció en la búsqueda venía de un blog sin fuente, así que no se ha usado.

**Solo ordenador y paseo.** Ver *Controles*: la interfaz de teléfono se retiró y en su lugar hay un aviso. El paseo tiene ahora un campo de visión de 60°, ritmo regulable con la rueda, un doble clic que lleva hasta el expositor pasando por la puerta de la valla, y colisión con la valla y la zanja. `ux-check` pierde las pruebas de teléfono y tableta y gana las del seguimiento de la cámara (con control negativo), la tecla C, la separación, el ritmo del paseo, la valla y el viaje con doble clic hasta el Dragon a través de la puerta. En CI queda más corta.

## Tercera ronda del 28 y 29 de septiembre de 2026

**Losetas del escudo térmico.**
- **Se solapaban.** En las filas que no dan la vuelta entera (la mitad expuesta del casco), las filas impares se desplazaban un cuarto de columna en lugar de media, así que cada loseta pisaba a su vecina de la fila de al lado con el mismo patrón en todo el escudo. Ahora el desplazamiento es de media columna y encajan como un panal. El recuento baja de 13 361 a 13 267, porque ya no caben losetas montadas unas sobre otras.
- **El mosaico solo se veía de cerca.** El mosaico lejano era un mapa de 4 × 4 losetas con juntas apenas aclaradas: desde unas decenas de metros se leía como una piel gris con franjas verticales (la variación de tono se repetía cada metro), no como hexágonos. Ahora es un mapa de 16 × 16 losetas que enlosa sin costura, con juntas claras como los chaflanes de las losetas reales, tono distinto por loseta y manchas de unas pocas losetas. El cambio a losetas instanciadas se hace a unos 5 px por loseta en lugar de 7. Más cerca, las losetas instanciadas centellean. Hay un límite físico que ninguna técnica salva: a unos 150 m o más, una loseta de 0,26 m ocupa menos de dos píxeles en una pantalla normal, y su contorno no se puede dibujar. A esa distancia lo que se ve es el tono del campo. `lod-pop` mide el salto de brillo en el cambio: 0,9 y 3,1/255, dentro del margen de 6.

**Paseo: doble clic a través de la valla.** Con el visitante junto a la valla, toda línea de visión hacia un vehículo del otro lado pasa por la malla, y el rayo del doble clic se quedaba en ella: el destino caía en la propia valla, justo al otro lado de la línea. El viaje salía por la puerta y volvía por fuera hasta la cara exterior de la malla, donde se atascaba. Ahora, paseando, el rayo atraviesa la valla (malla, postes y barandillas) y se queda con lo que hay detrás, y cualquier destino a menos de 1 m de un muro (la valla o el borde de la zanja) se aparta 1 m por el lado en que cayó. `ux-check` lo prueba con un doble clic real del ratón sobre el Dragon a 3 m de la valla, comprobando antes que el primer objeto del rayo es la malla. El control negativo quita a la valla su nombre y reproduce exactamente el fallo descrito: el visitante acaba en la cara exterior de la valla, a 19,7 m del Dragon.

**Fuego.** Las llamas eran conos con ruido y rayas planas, y ninguna de las dos cosas se lee como fuego: el fuego tiene cientos de contornos, cada uno con su propio reloj.
- Hay un fuego nuevo (`Fire`, en `plume.js`) hecho de partículas de llama orientadas a la cámara. Cada una es una mancha turbulenta: textura procedural con el borde deformado y bolsas más brillantes. Se desplaza aguas abajo, crece y se enfría del blanco al amarillo, al naranja y al rojo oscuro. Al enfriarse se deshace desde el borde, así que el contorno del conjunto se rompe en lenguas que salen y desaparecen. Algunas acaban en humo. Todo depende solo del tiempo de misión: saltar a un instante da el mismo fotograma que reproducirlo, y la pausa congela la llama.
- **En el penacho**, en todas las fases (despegue, ascenso, separación, regreso, aterrizaje y la nave), las partículas recorren la parte brillante de la columna sobre los conos, que siguen dando el brillo continuo y los diamantes de choque. En el aire la llama es turbulenta; al subir y quedarse sin aire con el que arder, se reduce a un rastro de estructura en el núcleo, porque un penacho en el vacío es un resplandor liso.
- **En la zanja**, el fuego sale de las dos bocas como una masa que rueda, frena, se abre, sube y se apaga convertida en el humo y el vapor de la nube, en lugar de las seis rayas naranjas planas de antes.
- **Sobre la mesa de lanzamiento.** Apoyado en la mesa, el chorro baja por la abertura de 11 m hacia la zanja; al subir el cohete, la columna se ensancha más que la abertura y su parte exterior choca contra la mesa y sale despedida hacia los lados, como cualquier chorro contra una placa. Dura desde unos metros de altura hasta que la columna es demasiado estrecha a la altura de la mesa (≈ las dos alturas, deducidas del ensanchamiento del chorro, no medidas).
- **Resplandor de base.** Bajo los motores hay un resplandor que florece mientras la columna aún da en la mesa y la zanja: 33 Raptor a unos metros de la mesa ciegan la cámara a través y alrededor de ella, no solo en la parte de la columna que la sobrepasa.

**Humo que ya no sale de la nada.** Las bocanadas de la zanja nacían con 24 m y aparecían en la octava parte de una vida de 20 s: a cien metros de la boca, ya formadas, sin nada que las uniera a la zanja. Ahora nacen con 11 m dentro del fuego de la boca, son visibles en menos de un segundo y crecen desde allí. El humo del aterrizaje era una fila de bolas: a 280 m/s, una bocanada cada 0,08 s deja 22 m de estela para 12 m de bocanada. Ahora son menos pero más grandes (21 m) y la estela es continua, algo más clara y menos densa.

**Coste.** Medido con `tools/profile.mjs --quality low`, en el renderizador por software, frente al commit anterior: el despegue no cambia (1,50 → 1,51 s por fotograma) y la captura sube un 11 % (1,41 → 1,56 s), que es el fuego del aterrizaje. Una primera versión con más humo de aterrizaje subía un 23 % y se recortó. Las partículas de llama dependen del nivel de calidad (la mitad en calidad baja).

**Granja de tanques.** Lleva etiquetas: la granja (metano, LOX, N₂, He), el tanque horizontal de LOX de 95 000 galones, el de metano de 80 000, los subenfriadores de nitrógeno líquido y los tanques de agua del diluvio. Solo se nombra lo citado (Wikipedia, SpaceX Starbase); la fila de tanques verticales, cuya disposición es reconstruida, se etiqueta como la granja y no tanque a tanque. Hay un encuadre nuevo, *Tank farm*, desde el lado de tierra: desde la plataforma los tanques horizontales quedan detrás de la fila vertical y sus etiquetas caían sobre los tanques equivocados.

**Guía rápida.** Ver *Controles*.

**¿Y la nave?** La secuencia termina a los 7 min 16 s con el propulsor en los brazos. La nave sigue volando: en los vuelos de prueba planea casi una hora, reentra y ameriza en el océano (en el vuelo 14, el primero orbital, según los resúmenes de prensa, salió de órbita y amerizó cerca de Hawái). Al terminar la secuencia completa, un aviso sobre la escena lo explica. Simular la reentrada sería un capítulo propio (plasma, actitud con el vientre por delante, maniobra de las aletas, *flip* y encendido de aterrizaje), y queda propuesto en `TRASPASO.md`.

## Ronda de fuentes del 29 de septiembre de 2026

Con la red del entorno ampliada, las fuentes se leyeron directamente y no a través de resúmenes de búsqueda: spacex.com (páginas de Starship, Falcon 9, Falcon Heavy, Dragon y de los vuelos 12, 13 y 14), Wikipedia (Starship, Super Heavy, Raptor, Starbase, Dragon 2 y los artículos de los vuelos), la FAA (evaluaciones ambientales de Starbase, en PDF) y Wikimedia Commons (fotos del Falcon 1).

**Lo que cambió por ellas:**
- **La secuencia sigue la cronología publicada del vuelo 14** (V3, Pad 2), con el apagado de la nave en T+8:11 como último hito y un plano final de la nave. Ver *El complejo de lanzamiento y la secuencia*.
- **MECO a ≈64 km** (Wikipedia): el giro gravitatorio se resuelve para cumplirlo.
- **Cinco motores en la separación en caliente** (Wikipedia; el vuelo 12 lo confirma para la V3), no tres.
- **Nave hasta el apagado:** su masa no propelente se resuelve para que apague en lo alto del arco publicado del vuelo 12 (apogeo 195 km, perigeo −7 km). La combustión citada de 349 s a empuje completo gasta 1 544 de las 1 600 t publicadas, una comprobación cruzada.
- **Torre:** ≈480 ft con un pararrayos de 10 ft (FAA, 2022), en lugar de los 474 ft de una wiki de aficionados. Se añade la FAA como tipo de fuente de la ficha, y el control de procedencia exige ≈ también a las cifras publicadas como aproximadas.
- **Penachos fuera del aire:** blancos con halo azulado frío y sin llama turbulenta, en lugar de naranjas. El naranja de un penacho a nivel del mar es la combustión de su borde rico en combustible con el aire, y en el vacío no hay aire. Cierra el pendiente del penacho del boostback a gran altura.
- **Cuenta atrás:** el desviador de llama en T−17 (antes T−10) y el rociado alrededor de la mesa solo desde dos segundos antes del arranque, para que no entierre la mesa durante un cuarto de minuto.

**Contrastado sin cambios:** las alturas, diámetros, masas, empujes y cargas útiles de Starship, Falcon 9, Falcon Heavy y Dragon que da spacex.com coinciden con la ficha. Dos discrepancias entre fuentes quedan anotadas (altura de la pila V3 y diámetro del Raptor).

**Lo que las fuentes no resolvieron:**
- **Pinzas del Falcon 1 en Omelek:** en las fotos de Commons del despegue (vuelos 4 y 5) el polvo tapa la base, y la de 2005 es un contraluz de baja resolución.
- **Tercera ventana de la Dragon:** la NASA dice que se diseñó con tres; las fotos muestran dos, y ni Wikipedia ni spacex.com dan el número.
- **Telemetría:** SpaceX no la publica como datos, así que las curvas de velocidad y altura siguen siendo del modelo.

## Ronda de realismo del 29 de septiembre de 2026 (planos del Pad 2 y V3)

Con las huellas de OpenStreetMap del sitio de lanzamiento (leídas por su API; trazadas por la comunidad sobre imagen de satélite, © colaboradores de OpenStreetMap, ODbL) pasadas al marco de la zanja, un artículo de NASASpaceflight sobre el Pad 2 y los valores de reflectancia de physicallybased.info:

- **La torre ya no está a escuadra con la zanja.** En el Pad 2 la línea torre–mesa corta el eje de la zanja a **≈52,5°** (en el Pad 1, ≈55°), con la torre a ≈31 m del centro de la zanja, cuya huella trazada mide ≈84 × 18 m (la del modelo, reconstruida, tiene 22 m libres y 88 m de largo: no coinciden; ver la auditoría del 8 de octubre de 2026). La torre, sus brazos, su mástil y la pila giran juntos −37,5° (`STACK_YAW_DEG`, `PAD.towerYawDeg`); la zanja, la mesa y el resto del complejo no. Los pines del propulsor siguen cayendo sobre los brazos (comprobado: 0,0° de desvío, 0,34 m sobre el carril). Las vistas *Launch complex* y *Tower and arms* giran con la torre. Es ≈: huellas trazadas, no un levantamiento.
- **Tanques de agua del deluge:** 11 horizontales del lado de la torre, cinco de ≈39,4 m y seis de ≈26,1 m, ≈3,45 m de diámetro; suman ≈842 000 galones, dos operaciones de los ≈422 000 que la evaluación de la FAA asigna a cada lanzamiento (citada por NASASpaceflight). Antes eran un número y un tamaño reconstruidos.
- **Parque de propelentes:** filas de tanques horizontales de ≈48,6 × 5,8 m (10 de oxígeno líquido, 8 de nitrógeno líquido, 8 de metano, con los tamaños de los que difieren), con vaporizadores atmosféricos, en lugar de la fila vertical reconstruida. La fila se coloca junto a la plataforma y no a 200–400 m, donde cruzaría la fila de expositores; alturas, cabezas y cunas son reconstruidas.
- **Encendido simultáneo de los 33 motores** en el propulsor V3 (Block 3), en lugar del arranque escalonado 3 → 13 → 33 de los primeros bloques: el fuego de la zanja, el esquema de motores del panel y el golpe del sonido lo siguen.
- **Color del acero inoxidable:** los mapas del casco son grises neutros; el color del metal lleva ahora el matiz medido del inoxidable (reflectancia lineal 0,669 / 0,639 / 0,598, physicallybased.info), normalizado a su luminancia para que el brillo siga siendo el de los mapas. Es un cambio sutil, levemente cálido.

## Segunda ronda de realismo del 29 de septiembre de 2026 (la Tierra real y el regreso)

- **La Tierra que se ve desde la nave es la real.** Antes era una esfera con continentes de ruido al azar. Ahora lleva las costas de Natural Earth (tierra 1:10m menos lagos 1:50m, dominio público) y el color del mosaico sin nubes *Blue Marble Next Generation* de la NASA (agosto de 2004, recortado al golfo a ≈3 km por píxel, `src/assets/earth/gulf-bmng.jpg`). La esfera se coloca llevando el marco geográfico del Pad 2 (25,9965° N, 97,157° O) por el círculo máximo hasta el punto bajo la cámara, con el eje aguas abajo en un azimut de **≈100,8°**. Ese azimut no está publicado: se deduce de la inclinación de 28° del vuelo 12 (Wikipedia), cuyo arco sigue la nave, con sin(az) = cos 28° / cos 26,0° y la raíz del sur, porque ese vuelo fue «más al sur» para dejar los restos sobre el Caribe abierto; no incluye la rotación terrestre. Al apagar, la nave está sobre el golfo con Cuba, las Bahamas y Florida por delante; desde el propulsor se ve la costa de Texas y Tamaulipas. El agua profunda es de un solo color (el mosaico tiene costuras entre teselas en el océano abierto) y solo pasan del mosaico los bancos someros; hay reflejo del sol en el agua. La bruma mirando hacia abajo es ahora un tercio de la del horizonte: con el brillo del cielo en la vertical, el golfo salía gris azulado claro, cuando en las fotos desde órbita es azul marino. Las nubes siguen siendo genéricas, y la costa local del sitio 1:1 es plausible, no la real, así que entre 9 y 20 km, mientras una se funde con la otra, no tienen por qué coincidir.
- **Humo del encendido de aterrizaje:** era una columna gris opaca sobre el propulsor. En la foto de SpaceX de la aproximación final del vuelo 5 (Commons, 54063904149) es una estela parda y tenue que se abre y deriva hacia un lado. Ahora tiene opacidad 0,05 (antes 0,2), 70 bocanadas de 24 m por fuente (antes 170 de 21 m), más crecimiento y deriva con el viento. Vista desde abajo, la cámara mira a lo largo de la estela, y cientos de bocanadas en la misma visual se sumaban hasta taparlo todo fuera cual fuera la opacidad de cada una.
- **Separación en caliente:** los 24 chorros de los respiraderos acababan en rojo anaranjado durante el 70 % de su longitud, y el anillo de fuego se leía como una estrella roja de púas. Ahora terminan en naranja amarillento, y el borde del resplandor también.
- **Penachos en el vacío:** el halo era pervinca (con tanto rojo como verde) y bajo ACES salía lila. Ahora es azul frío.

**Lo que no se pudo leer:** overpass-api.de y web.archive.org no responden a través del proxy; oeaaa.faa.gov (expedientes de obstáculos de la FAA) deniega el acceso a clientes automatizados y no se ha intentado eludir; matweb y engineeringtoolbox solo sirven en `www.`, que no está en la lista de dominios.

## Ronda vehículo por vehículo del 29 de septiembre de 2026 (fotos de la NASA)

Recorriendo cada expositor en el navegador y comparándolo con fotografías de dominio público:

- **Engine Row, rehecha.** Los tres motores de la fila ya no son las siluetas instanciadas de los cohetes, sino piezas de exposición detalladas a partir de fotos (`engineExhibits.js`; referencias solo consultadas, nunca en el repositorio):
  - **Merlin 1D Block 5** (retrato de fábrica de SpaceX, 2017): tobera de metal **gris satinado**, con labio enrollado y un aro de refuerzo. La **garganta queda a ≈1,0 m de la salida**; antes estaba a 1,42 m, una tobera un 40 % demasiado larga para una relación de expansión de 16 con la salida publicada de 0,92 m. Tiene brida atornillada en la garganta, cámara cilíndrica con su colector y **turbobomba colgada al lado**, con el escape de la turbina, el **generador de gas** enfrente y el conducto caliente que los une. Arriba lleva líneas trenzadas, **mazos naranjas**, dos actuadores hidráulicos y la placa de montaje azul oscuro. Altura hasta la placa: ≈2,2 m.
  - **Raptor 3** (retratos del primer Raptor 3 que publicó SpaceX, agosto de 2024):
    - tobera **carbón mate** casi cónica;
    - **collarín abocinado** en la junta y garganta estrecha;
    - la **columna de anillos** de la cámara, con pernos;
    - el **disco del colector del inyector** a ≈2 m;
    - el anillo plateado atornillado, el **bloque de turbobombas** con sus bocas y el **disco de empuje plateado**;
    - el **conducto grueso** que baja en curva por un costado hasta la cámara;
    - válvulas y líneas finas en plata, oro y azul, casi el único color del motor.
  - **Raptor Vacuum:** la tobera de cubo de la foto de la NASA (abajo), rematada con la misma columna del Raptor 3, que es lo que vuela la V3.
  - Los **33 Raptor del propulsor y los 6 motores de la nave** llevan ahora esa misma tobera y la columna en versión ligera, sin pernos, válvulas ni líneas finas. Con ella pesan 204 000 triángulos en lugar de 306 000.
  - Todo lo que no es el diámetro, la altura o el empuje publicados es ≈ (fotogrametría a ojo contra esas cifras), y así lo dice la ficha.

- **Raptor Vacuum (fila de motores y nave):** la tobera era un cono oscuro y uniforme con siete aros. En la foto de la NASA de dos Raptor Vacuum junto a un Raptor de nivel del mar (Commons, «A person viewing Raptor Vacuum», dominio público), la tobera tiene forma de **cubo**: el tercio superior, refrigerado por el propelente, se abre deprisa desde la garganta hasta ≈93 % del ancho de salida y es **verde oliva grisáceo**; una junta de **color latón** lo separa de la extensión, que ocupa los dos tercios inferiores, es casi cilíndrica y de **tubos plateados verticales**, con un labio bronce en la salida y un solo aro tenue. Ahora el perfil, la textura (`makeRvacBell`) y el aro siguen la foto; las proporciones son ≈ (fotogrametría con la salida de 2,3 m como regla) y la foto es de un Raptor 2 Vacuum, la única de dominio público con el motor entero a la vista.
- **Dragon, unión cápsula–trunk:** en las fotos de la NASA en la plataforma (CRS-28, KSC-20230602-PH-SPX01-0006; Crew-13, KSC-20260927-PH-SPX01_0010) el pie de la cápsula es una **banda de aluminio satinado** de ≈0,17 m, la línea más brillante del vehículo, y lo que asoma encima del trunk es un filete fino **rojo pardo**. El modelo tenía un aro oscuro y un toro dorado de 15 cm. Altura de la banda ≈ (fotogrametría).
- **Dragon, panel solar del trunk:** llegaba a 0,3 m del borde superior dejando una franja blanca, y entre sus cinco bahías asomaba el blanco del trunk como tres rayas verticales. En la foto del CRS-28 el panel es continuo y oscuro hasta el filete; la franja blanca, con los herrajes, solo está al pie. Ahora el panel sube hasta 7 cm del borde y va sobre un respaldo oscuro.

## Reorientación de la costa (29 de septiembre de 2026)

La escena ya estaba orientada con la geografía para el vuelo: su eje +X es el rumbo de lanzamiento, ≈100,8°, y la Tierra real que se ve desde altura se coloca con ese eje. **La costa local, en cambio, estaba girada 90°**: la playa corría a lo largo de la fila de expositores, con el mar al −Z de la escena, que en ese marco es el **NNE** (≈10,8°). En Boca Chica la playa va casi de norte a sur, desde la desembocadura del Bravo hasta el paso de Brazos Santiago, con el Golfo al **este**. Por eso el cohete volaba paralelo a la playa, en vez de salir mar adentro como en todos los vuelos, y entre 9 y 20 km de altura la costa local y la del globo no coincidían.

Ahora la playa, el mar, las dunas y las exclusiones de vegetación se construyen en un **marco de costa** (`toCoast`/`fromCoast`/`seaward` en `terrain.js`) girado para que la normal hacia el mar tenga un **azimut de ≈85,3°**. Es la orientación de la costa de Natural Earth entre 25,97° N y 26,08° N, la que ya lleva el proyecto en `data/gulf.js`, que corre a ≈355°. El marco está centrado en el Pad 2, así que la distancia al agua (≈485 m desde la mesa) no cambia. La tendencia artificial de la línea de costa (un 22 % de pendiente respecto a la fila) se quita, porque la orientación ya es la real. Lo que se ve:

- el mar queda al este, a la derecha de la vista general;
- el cohete **despega hacia el mar**;
- el propulsor **vuelve desde el mar** hacia los brazos, que se abren hacia ese lado;
- la costa local enlaza con la del globo.

El recinto (la fila, los viales, la plataforma) no se mueve: lo que gira es el paisaje que lo rodea.

## Reentrada de Starship (vuelo 14, 29 de septiembre de 2026)

Un capítulo nuevo (**X**) con la vuelta de la nave del vuelo 14, **el primero orbital**:

- **Citado:** la cronología publicada por SpaceX (spacex.com, «Starship Flight 14»):
  - encendido de salida de órbita, T+8:52:37–8:52:48;
  - entrada, T+9:28:56;
  - transónico, T+9:47:29;
  - subsónico, T+9:48:07;
  - encendido de aterrizaje, T+9:50:11;
  - volteo, T+9:50:13;
  - de 3 a 2 motores, T+9:50:21;
  - de 2 a 1 motor, T+9:50:28;
  - amerizaje en el objetivo del Pacífico norte, T+9:50:30.
- **Derivado:** el estado en la interfaz de entrada (120 km). La órbita y la masa no se publican y se suponen (≈): 200 km y ≈190 t. Con 11 s de un Raptor de 250 tf se pierden ≈142 m/s, y vis-viva da **≈7,74 km/s a −1,6°**. (Desde el 2 de octubre sale de la misión encadenada: véase *Flight 14: una sola misión*.)
- **Resuelto por Newton** (`reentryFlight.js`): el arrastre y la relación sustentación/arrastre del planeo con el vientre por delante, y el arrastre de la caída en panza. Con ellos el modelo cruza **Mach 1 en la llamada de transónico**, **Mach 0,8 en la de subsónico** (qué Mach significa cada llamada es una lectura, ≈) y llega al encendido de aterrizaje a la altura desde la que un encendido suave de 19 s lo para sobre el agua.
- **Resultados, no telemetría:**
  - pico de calentamiento hacia 71 km y 7,4 km/s;
  - caída en panza que termina a ≈89 m/s;
  - encendido desde ≈840 m;
  - ≈5 400 km recorridos desde la entrada.
- **Alabeo (≈, desde el 30 de septiembre de 2026):** la sustentación se inclina fuera del plano vertical siempre que, entera hacia arriba, haría subir a la nave, como hace la guía de planeo de equilibrio. Antes iba toda hacia arriba con una relación sustentación/arrastre constante y el planeo **rebotaba**: bajaba a 76 km, volvía a 81 km y el calentamiento caía y subía otra vez, con la ondulación visible en el perfil del panel. SpaceX no publica el perfil de alabeo; la componente que se inclina iría al alcance lateral, que un modelo en 2-D no sigue.
- **Actitud:** ángulo de ataque de ≈60° con el vientre al flujo (≈), que pasa a la caída en panza (cuerpo horizontal) en la banda transónica. En el volteo citado se levanta sobre los motores en ≈4 s.
- **Lo que se ve:**
  - **plasma** que sigue el índice de calentamiento de Sutton–Graves (√ρ·v³), violeta arriba y naranja en el pico;
  - las **losetas y los alerones brillando en naranja**, con estelas desde las puntas de los alerones y una estela tras la nave;
  - los tres planos de la retransmisión: **cámara a bordo** mirando el alerón de popa, **persecución** y **boya** sobre el agua;
  - el encendido 3 → 2 → 1, el **amerizaje** con vapor y espuma, y el Pacífico abierto (genérico, sin costa).
- La nave sale del expositor para el capítulo, en un escenario de origen flotante: la nave queda sobre el origen y el océano y el globo se mueven bajo ella, para que ≈5 400 km de planeo no hagan temblar los vértices. Al terminar vuelve a su sitio.
