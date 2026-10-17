# Porsche 911 GT3 RS

Todo el trabajo del Porsche 911 GT3 RS (2 a 4 de octubre de 2026): el circuito y la explanada, el coche y la conducción, las mejoras 1 a 7, la pasada vehículo a vehículo y la frenada.

Las secciones de este archivo se movieron del `README.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo bajó un nivel el título de cada sección). Los números de línea, rutas y nombres de sección que citan siguen siendo los de entonces.

[← Índice de rondas](README.md) · [← README](../../README.md)

## Porsche 911 GT3 RS, fase 1: el circuito y la explanada (2 de octubre de 2026)

El siguiente vehículo es un **Porsche 911 GT3 RS (992, 2023, 525 CV)**, conducible, con un circuito y una explanada de asfalto. Esta primera fase prepara los datos y el terreno; el coche llega en las siguientes.

- **Datos** (`src/data/gt3rs.js`), cada cifra con su etiqueta:
  - de la ficha técnica oficial de Porsche (MY P 08/2022, modelo UE):
    - motor de 3.996 cm³, 386 kW (525 CV) a 8.500 rpm y 465 Nm a 6.300 rpm, corte a 9.000 rpm;
    - las siete relaciones del PDK y el grupo de 4,27;
    - discos de 408 y 380 mm, neumáticos 275/35 ZR 20 y 335/30 ZR 21;
    - 4.572 × 1.900 × 1.322 mm, 2.457 mm de batalla, vías de 1.630 y 1.582 mm y 1.450 kg (DIN);
    - prestaciones: 0–100 en 3,2 s, 0–160 en 6,9 s, 0–200 en 10,6 s y 296 km/h.
  - del dossier de prensa: la carga aerodinámica, 901 lb a 124 mph y 1.896 lb a 177 mph (409 kg a 200 km/h y 860 kg a 285 km/h).
  - Derivados: el diámetro de cada rueda a partir de su medida y la superficie de sustentación a partir de la carga publicada. Porsche no publica el Cd, así que el área de resistencia sale de la velocidad máxima.
  - Estimados (≈): el reparto de pesos (39/61), la altura del centro de gravedad, la curva de par entre los dos puntos publicados, los neumáticos y el tiempo de cambio.
- **Circuito** (`src/core/circuitPlan.js` y `src/core/circuit.js`):
  - Es un trazado propio, no la copia de uno real. Mide **2.505 m por vuelta** en sentido horario y tiene 13 curvas: la recta principal de ≈463 m, una frenada fuerte a la primera (radio 30 m), eses, una curva rápida a izquierdas, la recta de atrás con una chicane, una horquilla de 22 m y una curva larga a izquierdas.
  - Está hecho de rectas y arcos de radio constante, así que el radio de cada curva se conoce exactamente. Dos rectas se calculan para que la vuelta cierre.
  - Sección (≈, la práctica habitual de los circuitos europeos): asfalto de **12 m**, la anchura mínima de la FIA que se suele citar para circuitos nuevos; arcenes asfaltados de 3 m; pianos rojos y blancos de 1,5 m en las curvas; grava por fuera de las curvas cerradas; líneas de borde blancas; línea de salida y una parrilla escalonada de 10 puestos.
  - No lleva barreras, edificios, gradas, banderas ni carteles.
- **Explanada**: un cuadrado de asfalto liso de 160 × 100 m, sin marcas, junto a la recta principal y unido a ella por un carril de 10 m. Está hacia el recinto, a unos **450 m** del extremo oeste de la fila.
- **Ubicación**: la buscó un script, como la pista. Es el sitio más cercano a la fila que queda dentro del disco de terreno, a 320 m o más de la costa y sin pisar el recinto, el pad, las charcas ni la pista. La recta principal va de norte a sur por x = −675 m y la vuelta queda al oeste.
- **Terreno**: `circuitMask` aplana el suelo y quita matorral y canales bajo el circuito y la explanada, igual que en la pista. `circuitSurface(x, z)` dice qué pisa cada rueda (asfalto, arcén, piano, grava o explanada) y a qué altura.

## Porsche 911 GT3 RS, fase 2: el coche y la conducción (2 de octubre de 2026)

El GT3 RS ya está en el centro: aparcado en la explanada del circuito, mirando al sur a lo largo de ella. Se conduce con **B** o con el botón *Porsche · Drive*.

- **Modelo** (`src/vehicles/gt3rs.js`), a 1:1:
  - **Superficie:** la carrocería es una sola superficie maestra. Son secciones de 15 puntos (umbral, entrante, anchura máxima, flanco, cadera, hombro, borde superior y eje) a lo largo de tablas trazadas sobre las fotos de estudio de Porsche, que solo sirven de referencia y no están en el repositorio. La escala sale de la batalla y la altura publicadas, y al superponer el perfil a la foto lateral, los extremos caen a 4,575 m frente a los 4,572 publicados.
  - **Altura:** los 1.322 mm publicados son la altura al **borde superior del ala**, que según Porsche sobresale del techo. El techo queda en ≈1,29 m.
  - **Regiones:** cristales, juntas, tomas y faldones negros, salidas del radiador en el capó, rejillas de las aletas, tomas detrás de las ruedas delanteras, toma lateral trasera, salidas de los pasos traseros, franja de luces, grupos ópticos, panel negro y difusor son regiones de esa misma superficie, así que no pueden despegarse de ella.
  - **Faros:** son redondos, proyectados sobre la aleta con un método de Newton, con fondo cromado oscuro, lente, bisel y los cuatro puntos LED.
  - **Otros elementos:** las juntas de puertas y capós, el splitter, las salidas de escape dobles centrales y las aletas del difusor.
  - **Ala de cuello de cisne:** con el flap del DRS en su bisagra, sus derivas laterales y los dos cuellos.
  - **Retrovisores:** con su cara exterior en los 2.027 mm publicados.
  - **Ruedas:** de cierre central, con 10 radios, discos de 408 y 380 mm y pinzas rojas. Los tamaños son los publicados.
  - **Habitáculo visible:** asientos baquet, jaula antivuelco, salpicadero y volante de 360 mm.
  - **Sin logotipos:** ni emblemas ni rótulos «GT3 RS».
- **Dinámica** (`src/sim/gt3Car.js`): cuatro neumáticos, cada uno con su carga y su deslizamiento combinado (una «fórmula mágica» sobre el deslizamiento normalizado), así que un neumático que patina o se bloquea pierde agarre lateral. Por eso el coche derrapa.
  - Usa la curva de par con sus dos puntos publicados, las siete relaciones del PDK y el grupo, cambios automáticos de 0,1 s (≈), un autoblocante (≈), ABS y eje trasero direccional (≈).
  - La aerodinámica sale de la carga publicada y de un área de resistencia de 0,89 m², derivada de los 296 km/h. El DRS se abre en recta a fondo.
  - Las ruedas se integran de forma implícita, porque la fuerza longitudinal del neumático es demasiado rígida para un paso explícito de 1/240 s.
- **Comprobado contra Porsche** (`tools/gt3rs-check.mjs`, dentro de `npm run check`): 0–100 en 3,25 s (publicado 3,2), 0–160 en 6,96 s (6,9), 0–200 en 10,66 s (10,6) y 296,4 km/h (296). La prueba también comprueba:
  - una frenada de 100 a 0 km/h de unos 27 m (no publicada);
  - 1,29 g en curva;
  - sobreviraje con gas, trompo y marcha atrás;
  - que la grava frena el coche;
  - un minuto de mandos al azar sin valores no finitos.
- **Conducción** (`src/sim/gt3Drive.js`, instrumentos en `src/ui/gt3Hud.js`):
  - **Mandos:**
    - **W** gas;
    - **S** freno, y marcha atrás si se mantiene parado;
    - **A/D** volante: menos giro cuanto más rápido, salvo con la zaga fuera, que da todo el giro para el contravolante;
    - **Espacio** freno de mano;
    - **T** PSM (control de tracción y de estabilidad), encendido por defecto;
    - **C** cámara: persecución, conductor, capó, pista y órbita propia;
    - **Enter** vuelve a la explanada y **Esc** termina.
  - **Instrumentos:** cuentarrevoluciones hasta 9.000 rpm con luz de cambio, marcha, km/h, DRS, ABS, PSM (ámbar mientras actúa), ángulo de derrape, g y tiempos de vuelta, que se miden al cruzar la línea de salida.
  - **Marcas de neumático:** las deja cualquier neumático que deslice más allá de su pico de agarre sobre una superficie dura. Son tiras oscuras de su anchura, más oscuras cuanto más desliza, y se guardan hasta 12.000 segmentos.
  - **Superficies:** cada rueda sabe qué pisa. En asfalto, explanada y pista de aterrizaje agarra del todo; en el arcén un poco menos, y en el piano, el 90 %. La grava agarra la mitad y frena; la hierba agarra un 55 % y frena algo.
- **Arreglos de paso:**
  - El asfalto del circuito y de la explanada es liso, sin los parches ni las grietas selladas de la carretera vieja (`makeAsphalt({ cracks: false, patches: 0 })`).
  - Con diez expositores, el atajo numérico comparaba cadenas (`'5' <= '10'` es falso) y habría desactivado las teclas 2 a 9. Ahora las teclas 1–9 eligen los nueve primeros.
  - Los techos del presupuesto suben con el coche: 3,2 M de triángulos, 1.600 mallas, 240 materiales y 140 texturas.

## Porsche 911 GT3 RS, fase 3: revisión (2 de octubre de 2026)

- **Morro y cola planos con placas.** Las zonas negras del morro y de la cola eran regiones de los triángulos de sus tapas, y sus bordes salían escalonados. La franja de luces se veía a trazos. Ahora cada tapa es plana y lleva sus piezas como placas de contorno exacto: la toma central con tres lamas, las tomas de las esquinas, el panel negro inferior, la franja roja, los grupos ópticos y los catadióptricos.
- **Bordes de los cristales laterales.** Sus juntas negras siguen ahora los bordes exactos, inclinados incluidos. La banda de las ventanillas tiene filas cada centímetro, y el montante B es negro.
- **Faros.** La lente reflejaba tanto cielo que el faro parecía un disco blanco. Ahora la lente es más discreta, el reflector es oscuro y destacan los cuatro puntos LED.
- **Marcas de neumático.** Solo se veían a ratos: cada segmento se orientaba según el sentido de la marcha y la mitad quedaban boca abajo, así que se descartaban. Ahora son de doble cara, más oscuras y mates, y la explanada es algo más clara para que contrasten.
- **Humo de neumáticos.** Al derrapar o patinar sobre superficie dura salen bocanadas grises que crecen, suben y se desvanecen (≈, un efecto visual).
- **Vista *The circuit*.** Miraba al lado contrario desde que el coche se giró hacia el sur; ahora encuadra la recta, la parrilla, el carril, la explanada y el trazado.

## Porsche 911 GT3 RS, mejora 1: la carrocería contra las fotos (2 de octubre de 2026)

El coche se ha vuelto a medir sobre las fotos de prensa de Porsche (solo como referencia, fuera del repositorio), esta vez con la cámara de cada foto ajustada: la lateral, la frontal y la trasera. Así cada pieza se lee a su profundidad real y no en el plano medio.

- **Sección de 15 puntos.** Añade la cadera (la cresta de la aleta, el borde de la puerta y el anca) al hombro y al borde superior. La parte trasera del habitáculo ya no sale ancha en las vistas de frente y de detrás.
- **Ventanillas.** Su base estaba ≈6 cm alta; ahora queda a ≈0,885 m, como en la foto. El contorno se traza por alturas, con su marco negro, y el montante B está en su sitio (≈−0,52 a −0,58 m).
- **Morro y cola redondeados.** Ya no son caras planas con arista viva: cada una se curva hasta quedar tangente a los costados, como las esquinas de los paragolpes. El centro sigue en los 4,572 m publicados.
- **Frontal.** Lleva el panel negro inferior, la toma central de rejilla en nido de abeja con sus dos barras, las dos grandes aberturas laterales y las cejas negras sobre ellas.
- **Zaga.** El panel negro es más ancho y envuelve las esquinas. Los pilotos, la franja roja y los catadióptricos tienen ahora la medida de la foto.
- **Capó.** Las dos salidas del radiador central se ensanchan hacia delante, con su rejilla, la pared negra alta en el lado interior, dos álabes y el labio delantero.
- **Laterales:**
  - las lamas sobre las ruedas delanteras;
  - las láminas negras delante y detrás de cada rueda delantera;
  - la salida oscura con el intermitente ámbar;
  - la toma inclinada delante de la rueda trasera, que antes estaba en otro sitio;
  - la salida negra detrás de la rueda trasera;
  - los tiradores enrasados;
  - la puerta con sus juntas medidas (antes empezaba 17 cm más atrás);
  - el tapón del depósito en la aleta delantera derecha.
- **Retrovisores.** Carcasa perfilada de color carrocería con la parte inferior negra, espejo y brazo negro desde la esquina de la puerta. Su posición sale de la foto; la anchura sobre los espejos sigue en los 2,027 m publicados.
- **Más detalles:** las aletas del techo, los limpiaparabrisas y los pasos de rueda negros (antes se veía el hueco).
- **Envergadura del ala.** Porsche no la publica. La cámara frontal da ≈1,63 m entre las caras interiores de las derivas y la trasera ≈1,80 sobre las exteriores; el modelo usa 1,74 m (≈ ±5 cm).

## Porsche 911 GT3 RS, mejora 2: ruedas, ala, habitáculo, sonido y visita (2 de octubre de 2026)

- **Ruedas.** Llanta forjada de cierre central con diez radios que se abren en Y antes de la llanta, cóncava hacia fuera (más en las traseras), con su barril y sus pestañas. La tuerca central lleva su tapa. Neumático con hombros redondeados, flancos abombados y tres ranuras, sin rótulos. Las medidas son las publicadas.
- **Frenos.** Discos de 408 × 36 y 380 × 30 mm (publicados) con tres filas de taladros (≈) sobre su campana de aluminio. Pinzas monobloque de seis y cuatro pistones abrazando el borde de salida del disco (tamaño ≈).
- **Ala.** Trazada con la cámara de cada foto:
  - plano fijo y flap del DRS, de carbono;
  - derivas negras grandes;
  - cuellos de cisne con su pata delantera inclinada y la trasera vertical, desde la tapa del motor;
  - el cilindro hidráulico rojo del DRS dentro de cada cuello.
  - El borde superior sigue en los 1,322 m publicados.
- **Habitáculo** (posiciones ≈ por las fotos del interior):
  - salpicadero con el capó del cuadro y sus cinco esferas, con el cuentavueltas analógico en el centro, hasta 10.000 rpm y en rojo desde 9.000;
  - pantalla central, aireadores y el cronómetro sobre el salpicadero;
  - volante GT de 360 mm (publicado) en Alcantara, con la marca amarilla a las doce, tres radios, el centro y las levas;
  - consola con el selector y dos pedales (PDK);
  - baquets de carbono con sus huecos, el centro rojo oscuro y cinturones rojos;
  - tiradores rojos de las puertas y la jaula atornillada del paquete Clubsport con su cruz.
  - El revestimiento interior se abre en los cristales: desde el asiento se ve fuera, y desde fuera se ve el interior.
- **Sonido** (tecla **M** o botón *Sound*, apagado por defecto). Sintetizado, no es una grabación:
  - el seis bóxer suena con su orden 3 (tres explosiones por vuelta: 450 Hz al corte de 9.000 rpm), los medios órdenes de las dos bancadas y el orden 6;
  - el gas abre la admisión y la aspereza del escape, y al soltar a altas vueltas hay petardeos;
  - los neumáticos chirrían al pasar del agarre máximo, la grava retumba y el viento crece con el cuadrado de la velocidad.
- **Visita guiada.** Cuatro paradas del Porsche: las cotas, el motor, el ala con su carga aerodinámica y las ruedas con los frenos. Todas las cifras son de la ficha.

## Conducción del Porsche y vuelo del F-16, revisados (2 de octubre de 2026)

**Porsche: derrapes solo cuando se buscan.** El coche se cruzaba donde un GT3 RS no lo haría. Había tres causas:
- el control de tracción arrancaba apagado y no había control de estabilidad;
- el ABS actuaba a golpes y el reparto fijo de frenada bloqueaba las traseras cuando el peso pasaba delante, así que la zaga se iba al frenar en curva;
- el volante del teclado pedía demasiado giro a velocidad (15° en las ruedas a 80 km/h).

Ahora:
- **PSM encendido de serie**, como en el coche real (≈ la lógica):
  - control de tracción;
  - control de estabilidad: compara el giro que pide el volante con el que hace el coche, frena una rueda y quita gas;
  - ante un sobreviraje en frenada, suelta además los frenos del lado interior.
- **Frenos:** ABS continuo, que tiene cada rueda en su pico de agarre; reparto electrónico (EBD) según la carga de cada eje, y menos presión atrás en curva.
- **Neumáticos:** los traseros, más anchos (335 frente a 275 mm), agarran algo más y son más rígidos (≈).
- **Dirección con teclado:** pide el giro que el agarre aprovecha a cada velocidad, descontando lo que ya se lleva la frenada. Da más giro solo en el sentido del contravolante.
- **Derrape con Espacio:** un toque al entrar en la curva bloquea las traseras y cruza la zaga; con gas y contravolante se sostiene. Mientras dura, el PSM se aparta y una ayuda evita el trompo más allá de unos 40°. Con PSM apagado (**T**) no hay ayuda.
- **Comprobado** en `tools/gt3rs-check.mjs`, conduciendo como el teclado:
  - a fondo y con todo el volante a 80 km/h, se cruza menos de 5°;
  - frenando a fondo desde 150 km/h y girando, 4,8° (7,6° sin PSM);
  - un toque de Espacio da más de 4 s de derrape sostenido sin trompo.
  - Las cifras de Porsche (0–100, 0–160, 0–200 y 296 km/h) siguen clavadas.

**F-16: despegar ya no es imposible.** En el modo sencillo, W despegaba, pero en el aire bajaba el morro. Quien la mantenía pulsada, como en el coche, volvía a la pista de cabeza a los 13 s. Mantener S hacía un looping hasta la pérdida. Los mandos sencillos se han rehecho (`src/sim/f16Assist.js`, sin navegador, de modo que las pruebas lo vuelan):
- W/S potencia, ↑/↓ subir y bajar, A/D virar con nivelación al soltar;
- rotación automática y la amortiguación de cabeceo en tierra rebajada, para que rote a tiempo;
- protección de baja velocidad, Auto-GCAS, y un autoacelerador a 150 kt con el tren abajo, con recogida.
- El bucle de trayectoria pide a la ley de mando del avión la combinación C* que espera, así que sirve igual a 150 que a 600 kt; la variación de la trayectoria lo amortigua.
- **Comprobado** en `tools/f16-check.mjs` con las teclas del visitante:
  - con W mantenida, despega a 176 kt y sube sin estrellarse;
  - picando contra el suelo, el Auto-GCAS lo saca con más de 500 ft de margen;
  - tras virajes a 60° y 80°, las alas se nivelan al soltar;
  - en la senda de 3° sin tocar nada, toma a 145 kt con 1,2 m/s de descenso y se para.
- El modo completo (botón *Simple*) no cambia: todos los mandos del avión.

## Pasada vehículo a vehículo (2 de octubre de 2026)

He revisado cada expositor en todas sus vistas, el lanzamiento de Starship hito a hito (de T−20 a la captura del propulsor), la reentrada y el amerizaje, el vuelo del F-16 y la conducción del Porsche. Corregido:

- **Nube del despegue de Starship.** Las bocanadas iluminadas por las llamas se teñían de naranja por igual y perdían su sombreado: parecían bolas de algodón salmón. Ahora el brillo conserva el modelado de cada torreta y es más fuerte en su cara inferior, la que mira al fuego.
- **Reentrada y amerizaje:**
  - en mitad del Pacífico asomaba la plataforma de la pista del F-16, que no se ocultaba con el recinto; ahora se ocultan también la pista y el circuito;
  - la nave seguía de pie sobre el agua tras amerizar; ahora, como en los amerizajes filmados, se mantiene vertical un momento y vuelca sobre su base hasta quedar tumbada (≈ los tiempos).
- **Falcon 1, vista del corte.** La cámara miraba el corte de canto y la media carcasa tapaba el interior; ahora lo mira de frente. La carcasa se ve también por dentro, que es como se ve a través del corte.
- **Pista del F-16:**
  - el desgaste de las marcas blancas salía en manchas cuadradas pixeladas; ahora es suave y discreto;
  - el sellado de las grietas, demasiado brillante, reflejaba el sol bajo y dibujaba líneas blancas; ahora es satinado y oscuro, como el betún.

Sin errores de consola en ninguna vista. Lo demás, revisado sin hallazgos: Starship y la torre, Falcon 9, Falcon Heavy, Dragon, Starlink, el Roadster, los motores, el F-16 y el Porsche.

## Porsche 911 GT3 RS, mejora 3: carrocería nueva contra las cuatro fotos de estudio (2 de octubre de 2026)

Orden del usuario: que el Porsche sea una copia visual del coche real, por fuera y por dentro. Esta fase rehace el exterior; el habitáculo llega en la siguiente.

**Método.** Las fotos de prensa de Porsche se usan solo como referencia y no están en el repositorio. A las cámaras lateral, frontal y trasera se suma la de tres cuartos delantera, resuelta por PnP con un error de 36 px sobre 4.000. Cada render del banco de pruebas se superpone a la foto: los bordes de la foto en gris y los del modelo en rojo. Las posiciones quedan a ≈ ±1,5 cm y las profundidades a ≈ ±2 cm.

- **Color.** El coche de las fotos es de un gris casi blanco con llantas rojas, no Arctic Grey. El modelo lleva ese gris (≈ el tono) como pintura lisa con barniz, las llantas rojas y las pinzas negras. El color es una estimación (`PAINT`, etiqueta ESTIMATE) y la ficha lo dice.
- **Perfil delantero.** La cresta de la aleta, el capó y el hombro siguen ahora la silueta de la foto lateral, que baja de 0,856 m sobre la rueda a 0,60 m donde empieza el paragolpes. Antes el morro quedaba alto y romo.
- **Morro y cola como relieves.** El barrido de la carrocería termina en x = +2,00 y −2,10 m. Cada extremo es un relieve sobre el contorno de la última sección, que se curva tangente a los costados, de modo que no hay arista entre el extremo y la carrocería. Las tomas son agujeros con su pared, su fondo y su labio a lo largo del contorno exacto, y ya no siguen los escalones de la malla.
  - **Morro:** la toma central con rejilla, las dos tomas laterales, las ranuras de las esquinas y el borde inferior negro de lado a lado.
  - **Cola:** el labio del *ducktail* a 0,906 m, el hueco bajo él con la franja de luz, los pilotos que sobresalen ≈2 cm con su lente ahumada, el panel negro inferior con el hueco de la matrícula (sin placa), los catadióptricos, y el paragolpes negro que envuelve las esquinas desde el costado.
- **Faros.** Cada uno es un cuenco hundido ≈7 cm con su lente abombada y su bisel. Dentro llevan el aro cromado, el módulo del proyector y las cuatro luces diurnas, todo sobre el plano inclinado de la abertura (antes estaban en un plano vertical y quedaban ocultas).
- **Detrás de la rueda trasera.** La aleta negra alta rodea el borde del paso de rueda a ≈2 cm de la carrocería, con la salida oscura detrás y el paragolpes negro debajo, que sube hacia la cola. Sustituye a dos parches con contorno escalonado.
- **Difusor.** Seis aletas bajo una rampa que sube del suelo a la cola.
- **Lamas de la aleta delantera.** Ahora corren a lo largo del coche, escalonadas por la pendiente como en la foto lateral y en el primer plano de la aleta. Antes eran transversales.
- **Ventanillas.** Toda la abertura es vidrio. El marco negro y el montante B se dibujan como líneas sobre su contorno exacto, sin escalones en los bordes inclinados.
- **Ruedas y ala.** Los radios son más finos (36 mm en la base). El plano principal del ala es plata satinada y el *flap* del DRS, negro. El borde del *splitter*, los escapes (centros a 0,29 m, separados 0,12 m) y las aletas del difusor (de 0,14 a 0,27 m) se han medido en la foto trasera.
- **Retrovisores** algo más redondeados.
- **Corregido de paso:** la normal de la cara trasera tenía invertidas sus componentes laterales. Los parches de la cola se hundían hacia dentro cerca del borde y la cara los tapaba.

## Porsche 911 GT3 RS, mejora 4: el habitáculo nuevo, con instrumentos vivos (2 de octubre de 2026)

El habitáculo se ha rehecho desde cero en su propio módulo (`src/vehicles/gt3Cabin.js`) sobre las fotos de interior de Porsche: la vista del conductor, los asientos desde la puerta del acompañante, el cuadro, el selector y la puerta. Como siempre, las fotos se usan solo como referencia y no están en el repositorio. Las posiciones y tamaños son ≈; el volante de 360 mm y la desmultiplicación de 14,1:1 son los publicados. No lleva logotipos, rótulos ni escudos.

- **Cuadro de instrumentos** bajo su visera, curvado alrededor del ojo del conductor. En el centro va el cuentarrevoluciones analógico (hasta 10.000 rpm, rojo desde 9.000). A cada lado, una pantalla con dos indicadores redondos: la compresión y el rebote de los amortiguadores, como en la foto.
- **Instrumentos vivos.** Mientras se conduce, la aguja sigue las revoluciones del motor simulado, el pie del reloj muestra la marcha y la velocidad, y el volante gira con las ruedas delanteras a 14,1:1. En la vista del conductor, el reloj del HUD se aparta a la esquina inferior derecha, más pequeño, para no tapar el cuadro real.
- **Salpicadero:** la parte superior de cuero bajo el parabrisas, con las ranuras del desempañador y el cronómetro encima; la cara de Alcantara con la tira de carbono en el lado del acompañante; las salidas de aire laterales.
- **Consola central:**
  - la pantalla táctil (una página de tiempos por vuelta, sin marcas);
  - la tira de carbono y los cinco interruptores;
  - dos salidas de aire;
  - la consola que baja hasta el túnel, con el selector corto en su fuelle de Alcantara;
  - la bandeja, los laterales de carbono y el reposabrazos.
- **Volante GT** de Alcantara:
  - aro ovalado y banda amarilla a las doce;
  - tres radios con sus botoneras y los cuatro mandos giratorios;
  - levas de cambio, columna y palancas.
- **Asientos baquet de carbono**, construidos a lo largo de su eje: la carcasa, los laterales negros, los centros rojo oscuro perforados, los huecos bajo el reposacabezas y los cinturones rojos de tres puntos apoyados sobre el asiento.
- **Puertas:** remate de cuero, panel de Alcantara, inserto perforado con el rojo detrás, reposabrazos, tirador de cinta roja e interruptores de las ventanillas.
- **Más:**
  - el suelo con alfombrillas, el reposapiés, los pedales (acelerador articulado en el suelo, freno colgado) y los umbrales;
  - la jaula del paquete Clubsport, atornillada tras los asientos;
  - el compartimento trasero cerrado por el mamparo del motor (el RS no lleva asientos traseros);
  - el retrovisor interior.
- **Ojo del conductor:** la cámara interior se ha retrasado de x = −0,12 a −0,30 m, con la cabeza justo delante del reposacabezas (≈). Antes la cabeza quedaba 20 cm por delante del asiento.
- **Luz:** el interior ve solo una parte del cielo que supone el mapa de entorno, así que sus reflejos se han bajado (≈, como término de oclusión). Antes el Alcantara negro se veía gris claro.
- **Materiales.** Las pantallas comparten una textura (el cuadro y la pantalla central); los relojes, otra (el cuentarrevoluciones y el cronómetro); la aguja, la marcha y la velocidad, un lienzo pequeño. El Alcantara es el mismo material que el forro del techo. Así la escena se queda en sus 240 materiales.
  - **Corregido:** el commit `bb348c6` se subió con esta comprobación del presupuesto en rojo (249 materiales); este commit la deja en verde.
- El habitáculo tiene ≈53.000 triángulos. El coche entero, con la carrocería nueva, se queda en ≈452.000 (antes ≈527.000) y la escena, dentro de su presupuesto.

## Porsche 911 GT3 RS, mejora 5: la dinámica P1 de la auditoría (2 de octubre de 2026)

Los hallazgos P1 de la auditoría externa sobre el Porsche, cada uno con su prueba en `tools/gt3rs-check.mjs`. Todas las cifras nuevas son estimaciones (≈) y están en `src/data/gt3rs.js` con su etiqueta: `SUSPENSION`, `CLUTCH` y el aerofreno de `AERO`.

- **H02: el suelo bajo cada rueda y la suspensión.** El modelo lee el suelo en las cuatro huellas y calcula el plano que pasa por ellas.
  - En una pendiente, el peso tira a lo largo de ella: en una del 10 % el coche sin pedales cae hacia atrás, y frenado se queda.
  - La carrocería va sobre muelles y amortiguadores (cabeceo, balanceo y altura, ≈2 Hz) que solo empujan. Cada rueda recibe lo que su muelle añade, y en un suelo alabeado carga más una diagonal.
  - Por una cresta a 110 km/h el coche despega: ≈1 s en el aire, sin carga en las ruedas, y aterriza.
  - En pantalla, el coche entero se inclina con el terreno y cada rueda sube y baja con su recorrido.
- **H06: el motor con inercia y el embrague del PDK.**
  - El embrague coge la tracción al arrancar, se abre en cada cambio y vuelve a cerrar. Al reducir frenando, un golpe de gas sube el motor al régimen de la marcha inferior.
  - Frenando fuerte, o con el ABS trabajando atrás, deja pasar poco freno motor para no bloquear las traseras.
  - **Launch Control:** W+S con el coche parado sostiene el motor a ≈5.500 rpm con el embrague abierto; al soltar S, sale. Las cifras de aceleración de Porsche se miden así (con el PDK va de serie; la ficha no lo especifica), y la prueba las mide igual: 0–100 en 3,19 s (publicado 3,2), 0–160 en 6,90 (6,9) y 0–200 en 10,65 (10,6).
  - Sin Launch Control el coche tarda más: el motor tiene que subir de vueltas mientras el embrague coge.
- **H07: las ayudas, separadas de la física.** El control de tracción, el de estabilidad, el ABS, el EBD y el modo derrape están en `src/sim/gt3Assists.js`, con sus umbrales en una tabla, y se pueden probar solos. El cambio se hizo primero sin modificar el comportamiento: las pruebas daban lo mismo, bit a bit.
- **H08: Ackermann.** La rueda delantera interior gira más que la exterior (la mitad de la geometría completa, ≈): 32,8° frente a 27,9° con todo el volante. En pantalla, cada rueda gira su propio ángulo.
- **H09: aerodinámica activa con tres estados.** DRS en recta a fondo; aerofreno al frenar fuerte por encima de 100 km/h (más resistencia, ≈ +15 %), con el *flap* del ala en su posición más inclinada; y la posición normal entre ambos.
- **H10: choques y agua.**
  - El coche, con su contorno publicado, choca con los demás vehículos expuestos. Sus huellas son los mismos círculos que ya esquiva el visitante a pie. Rebota (≈22 % de la velocidad de cierre), roza con fricción y, si el golpe es de refilón, gira.
  - Contra un poste a 50 km/h se detiene sin atravesarlo, y el panel avisa del golpe.
  - En el mar, el agua lo frena en ≈5 m, el motor se ahoga y el panel lo dice.
- La frenada de 100 a 0 km/h baja de 29,7 a 27,7 m (≈, no publicada). La prueba de interfaz que arranca con W da ahora 3 s en vez de 2,2 para ver el paso a 2.ª: sin Launch Control, el coche llega a ella hacia los 2,5 s.

## Porsche 911 GT3 RS, mejora 6: alerón, llantas, frontal, zaga y faros contra las fotos (2 de octubre de 2026)

Revisión pieza a pieza contra las fotos de estudio, con sus cámaras ajustadas y una regla en metros sobre cada foto; las fotos de Porsche se usan solo como referencia y no están en el repositorio. Fallos encontrados y corregidos:

- **El alerón se veía raro, y lo era:**
  - Las placas laterales medían 0,79 m de largo; en la foto miden 0,47 m. Ahora son un paralelogramo redondeado, con el borde inferior que sube hacia atrás y el delantero inclinado, medidas en su propia profundidad (±0,87 m).
  - Cada cuello de cisne tenía una pata vertical detrás que el coche real no tiene. Ahora es una sola pala que sale de la tapa del motor inclinada hacia atrás, con su ventana triangular entre las dos patas. Delante del borde de ataque se convierte en un brazo que pasa por encima de los dos planos y se engancha a la aleta, con una pestaña atornillada al plano principal; el cilindro rojo del DRS va por dentro, del brazo a la palanca de la aleta (fotos AKOS5335 y AKOS5487).
  - Los dos planos son plateados satinados, como en las fotos; antes la aleta era negra.
  - La foto lateral pone el canto superior a 1,275 m y la trasera a ≈1,34 m: el alerón queda a la altura publicada, 1,322 m, entre las dos.
- **Las llantas eran convexas:** el buje sobresalía y los radios se hundían hacia la llanta. En la real es al revés: el centro va hundido. Además, las horquillas de los diez radios no se abrían lo bastante para tocar las del radio vecino. Ahora las puntas se juntan en diez uves contra la llanta, como en la foto, el buje es más pequeño y la tuerca central es negra.
- **El frontal tenía dos tomas laterales separadas** que el coche no tiene. La parte baja es una sola superficie negra en forma de U, que sube hasta los intermitentes por los lados y hasta justo debajo de la matrícula en el centro.
  - La toma central de panal es más ancha (±0,46 m, de 0,21 a 0,34 m de altura).
  - Las cortinas de aire de las esquinas llegan a 0,58 m.
  - Se añaden los intermitentes bajo las cejas.
  - El splitter, que sobresalía por las esquinas, sigue ahora el contorno del morro a su altura y es negro.
- **Los faros** tenían un proyector en forma de disco que salía del cuenco y un aro cromado aplastado. Ahora llevan el proyector ancho y casi plano dentro del cuenco, los cuatro DRL como palas anchas a 45° y la banda de pequeñas luces de la matriz abajo (foto frontal ampliada). El aro y el proyector son redondos vistos de frente, como la abertura.
- **La zaga:**
  - La barra de luz estaba 2 cm baja; ahora va a 0,81–0,823 m, dentro de una banda negra de 0,77 a 0,84 m.
  - Los pilotos estaban 13 cm demasiado hacia fuera; ahora ocupan de 0,46 a 0,80 m y son más planos, con las dos láminas rojas por dentro.
  - Los catadióptricos suben 3 cm.
  - Las seis aletas del difusor van donde la foto: ±0,155, ±0,306 y ±0,474 m, de 0,19 a 0,32 m de altura; antes colgaban por debajo del coche.
- **Retrovisores:** la carcasa medía 0,13 m de ancho vista de frente; en la foto, ≈0,17 m.

## Porsche 911 GT3 RS: frenada contra auto motor und sport y revisión con fotos libres (4 de octubre de 2026)

- **Frenada.** Porsche no publica distancias de frenada. El Supertest de auto motor und sport (septiembre de 2023) midió 28,0 m de 100 a 0 km/h en caliente (41,4 m en frío) y 97,0 m de 200 a 0 km/h. Las cifras se leyeron en el resumen del buscador, porque la tabla está tras el muro de pago: se marcan como ≈.
  - El modelo da 27,7 m y 99,7 m sin tocar nada.
  - `tools/gt3rs-check.mjs` lo comprueba ahora contra esas cifras (±5 %) en vez de un intervalo genérico.
- **Revisión con 18 fotos libres de Wikimedia Commons** (traseras y frontales de tres cuartos de varios coches; solo como referencia, no están en el repositorio).
  - La parte baja negra de la trasera es correcta: en los coches blanco, azul claro y gris oscuro el panel alrededor de la matrícula es negro y las esquinas son del color de la carrocería. Solo un coche gris la lleva pintada.
  - El difusor tiene tres aletas a cada lado de la caja de los escapes, como el modelo.
- **Habitáculo.** No hay fotos libres del interior del 992 GT3 RS en Commons, así que el salpicadero no se ha podido contrastar en esta sesión.

## Porsche 911 GT3 RS, mejora 7: piezas, vista del piloto, levas y sonido (3 de octubre de 2026)

El usuario juzgó el Porsche «deficiente» en modelado y conducción. La silueta ya cuadraba con las cuatro fotos de estudio (±1–2 cm sobre los bordes, con sus cámaras ajustadas). Lo que fallaba eran las piezas que se miran de cerca y la experiencia al volante. Las fotos de Porsche se usan solo como referencia y no están en el repositorio.

- **Llantas:** la foto ampliada de la rueda trasera muestra radios en Y que se abren a ≈0,4 del radio, con tallos de ≈30 mm y brazos finos (≈14 mm). El modelo los abría a media llanta, con brazos gruesos, y parecía una estrella. Ahora los diez radios forman la tela fina de la foto, y el barril, la campana y el disco son oscuros, como en las fotos (≈ los acabados).
- **Frontal:**
  - La parte baja negra ya no es un parche pintado sobre la cara: va hundida ≈2,8 cm tras el borde blanco, con su escalón, y proyecta sombra.
  - El panal central está a pocos centímetros de la cara, donde le llega la luz; antes, a 11 cm, se veía negro.
- **Faros:** cuenco cromado brillante en vez de gris mate; proyector con aro cromado y cristal oscuro; las cuatro luces diurnas en sus copas cromadas; la banda de LED matriciales en dos filas de puntos.
- **Zaga:**
  - Se añade la rejilla negra del capó del motor bajo la luna, con ocho lamas a cada lado, y el piloto de freno central (foto trasera).
  - Las salidas de escape son de titanio oscuro, como en la foto; antes eran de aluminio brillante.
- **Toma de la aleta trasera:** ≈7 cm de ancho abajo y ≈11 cm arriba, con su reborde (antes, 5,6 y 8,4 cm).
- **Lamas sobre las ruedas delanteras:** a ras de la abertura, como en la foto; antes sobresalían como un peine.
- **Parabrisas y montante A:** el parabrisas acababa ≈8 cm por dentro del borde del techo, y entre él y la ventanilla quedaban ≈25 cm de montante, que tapaban un cuarto de la vista del piloto. Ahora el cristal rodea la esquina como en el 992. El montante pintado mide ≈7–12 cm a lo largo del coche en su mitad alta (en la foto lateral, ≈6,5 cm de ancho) y se ensancha hacia el retrovisor.
- **Levas (cambio PDK manual):**
  - **E** sube y **Q** baja. El primer toque pone el modo manual, y **G** devuelve el automático.
  - El cambio rechaza la reducción que pasaría del corte, como el PDK. En manual no sube solo: el motor llega al limitador. Solo reduce por sí mismo para no calarse.
  - Los toques dados mientras entra una marcha esperan su turno.
  - El cuadro muestra **M** o **A** junto a la marcha, en rojo un instante si rechaza una reducción.
  - Prueba nueva en `tools/gt3rs-check.mjs`.
- **Vista del piloto viva:**
  - La cabeza va sobre un muelle (≈2,5 Hz, bien amortiguado): se desplaza hacia fuera en las curvas y hacia delante al frenar, unos centímetros con el agarre del coche.
  - La mirada se adelanta hacia donde va la trazada a 30 m.
  - Los pianos, la grava y la velocidad hacen vibrar la vista (≈).
- **Cámara de persecución:** se aleja y baja un poco con la velocidad, y abre el campo de visión hasta 9° (≈).
- **Luces de freno:** las láminas de los pilotos y el piloto central se encienden al frenar; sin freno quedan en un rojo ahumado. Los catadióptricos ya no brillan como luces.
- **Plásticos negros satinados**, no mates: en las fotos de estudio los paragolpes y faldones negros dejan ver su forma con brillos suaves (≈ el acabado).
- **Prueba de interfaz más robusta:** la de «B arranca el Porsche en la explanada» esperaba 600 ms fijos. Con la máquina cargada por la comprobación completa, el primer paso de la simulación llegó más tarde y la prueba falló una vez. Ahora espera a que la simulación haya dado sus primeros pasos (como mucho, 5 s), y lo que comprueba no cambia.
- **Sonido nuevo** (`src/sim/gt3Sound.js`), sintetizado muestra a muestra en un AudioWorklet, como el de la H2R:
  - El bóxer de seis cilindros enciende cada 120° en el orden 1-6-2-4-3-5, alternando bancadas. Cada bancada tiene su colector, algo distinto en fuerza y color, y de ahí salen los medios órdenes bajo la nota principal: orden 3, 45 Hz al ralentí y 450 Hz en el corte a 9.000 /min.
  - Cada pulso hace sonar las resonancias del escape y se satura con la carga.
  - Encima van el aullido de la admisión por las seis mariposas, más fuerte dentro del habitáculo; el corte del PDK al subir y el del limitador; los petardeos al retener; el tic de la distribución y el silbido del grupo.
  - Dentro del coche, el escape suena filtrado.
  - Es una síntesis a oído, no una grabación.

## El Porsche sabe dónde está desde el primer instante (3 de octubre de 2026)

- En CI, la prueba «B starts the Porsche on its skid pad» falló en una de las cinco ramas con el mismo commit (`onPad: false`). Causa: `reset()` de `gt3Car.js` dejaba la superficie bajo cada rueda en su valor inicial (`'track'`) hasta el primer paso de la física, y en un runner cargado ese paso no llegó antes de que la prueba mirara.
- Ahora `reset()` lee el suelo de las cuatro huellas al posar el coche, así que el estado ya es el real antes del primer paso (el cuadro y el sonido lo leen).
