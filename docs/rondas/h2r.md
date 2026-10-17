# Kawasaki Ninja H2R

Todo el trabajo de la Ninja H2R (3 a 5 de octubre de 2026): la segunda versión, las fotos calibradas, la prueba de MOTORRAD, el nivel de proyecto de Blender y el paso a Blender.

Las secciones de este archivo se movieron del `README.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo bajó un nivel el título de cada sección). Los números de línea, rutas y nombres de sección que citan siguen siendo los de entonces.

[← Índice de rondas](README.md) · [← README](../../README.md)

## La Ninja H2R, rehecha (3 de octubre de 2026, segunda versión)

El usuario juzgó la primera versión «horrible» y pidió una copia idéntica de la moto real, conducción real, mejor sonido y la moto sin piloto, vista desde los ojos de quien la lleva. Se rehízo entera.

- **Medida sobre las fotos con cámaras calibradas.** Se descargaron como referencia las imágenes oficiales de Kawasaki (estudio, detalles, chasis, motor, cuadro); no van al repositorio.
  - Las dos cámaras de estudio, la lateral izquierda y la de tres cuartos delantera derecha, se resolvieron a la vez (un ajuste de haces, ≈2 px de error medio) sobre la batalla, los diámetros de los neumáticos y la altura publicados.
  - Así cada rasgo visible en ambas fotos tiene posición en 3D, no solo en perfil: los tornillos y la punta del panel lateral, los nudos del chasis, las esquinas de las alas.
  - Los contornos se trazan en la foto lateral (≈ ±1 cm); las anchuras, ≈ ±1,5 cm.
- **Modelo nuevo** (`src/vehicles/h2r.js`, `h2rParts.js`, `h2rBody.js`):
  - Cúpula de carbono y panel lateral con espejo como dos piezas separadas, con el pliegue del panel; depósito con el techo cromado y los costados negros; asiento; colín anguloso con su panel cromado y su piloto rojo; tapa lateral; alas de carbono triangulares bajo la cúpula ahumada.
  - Chasis multitubular verde por los nudos triangulados; motor de cuatro cilindros con sus tapas (la del embrague en gris, la tapa de llenado con anillo rojo), cárter, cámara de admisión de aluminio, compresor rojo detrás de los cilindros y el conducto de carbono que lo alimenta; cuatro colectores de titanio bajo el motor y el silencioso subiendo por la derecha.
  - Basculante monobrazo con guardacadenas, protector, corona de 42 dientes con su portacorona mecanizado y la cadena; horquilla invertida de 43 mm a 25,1°, tijas negras con tapones verdes; amortiguador de dirección Öhlins.
  - Llantas negras con cantos mecanizados (la delantera de cinco radios dobles con su filete verde; la trasera, la estrella de cinco puntas), slicks, discos flotantes de 330 y 250 mm taladrados (el trasero a la derecha), pinzas Brembo Stylema.
  - Semimanillares, manetas, depósitos de líquido de freno, piñas, estriberas de aluminio y el cuadro de instrumentos, que se redibuja en vivo (cuentarrevoluciones, velocidad, marcha, inclinación, control de tracción).
  - Rótulos de fábrica en su sitio y orientados para cada lado (excepción autorizada por el usuario): «Kawasaki» en el depósito, «Ninja» y «H2R» en el panel, «brembo» en las pinzas.
  - Verificación dimensional: 2,075 × 0,850 × 1,159 m (publicado: 2,070 × 0,850 × 1,160).
- **Conducción nueva** (`src/sim/h2rBike.js`):
  - La inclinación obedece la ecuación de la bicicleta de masa puntual (Whipple reducida): h·φ̈ = g·sin φ − (v²/L)·δ·cos φ − (b·v/L)·δ̇·cos φ. Nada inclina la moto salvo el manillar. Las teclas piden una inclinación y unas «manos» de piloto (un controlador) buscan el giro de manillar que la consigue: primero hacia el otro lado, es decir, contramanillar, como en la moto real. Más lentas a alta velocidad (≈ el efecto giroscópico).
  - Rueda trasera con su propia velocidad, unida al motor por el cambio y el embrague, con una curva de agarre longitudinal frente al deslizamiento: patina con demasiado gas, y el control de tracción la mantiene cerca del pico. Freno delantero con ABS en curva (ayudas) o bloqueo sin ellas.
  - Horquilla y amortiguador con muelles y amortiguación (recorridos publicados): hunde al frenar y se agacha al acelerar. Caballitos y *stoppies* alrededor de cada contacto, con sus controles.
  - Embrague que patina en la salida hasta ≈9.000 rpm; cambio automático o manual con **Q**/**E** (cambio rápido de ≈60 ms).
  - Sin piloto: la cámara por defecto es la de sus ojos, agachado tras la cúpula a ritmo y erguido despacio, con la cabeza inclinándose ≈60 % de lo que se inclina la moto. Al caer, la vista pasa a la cámara de persecución para ver la moto deslizar.
  - Resultados (`tools/h2r-check.mjs`): 0–100 km/h en 2,55 s, 0–200 km/h en 5,45 s, 200–0 km/h en ≈5,1 s, 348 km/h de punta con la rueda a 362 km/h (desliza un 4 %), 52° y 1,3 g de inclinación a 100 km/h, contramanillar de ≈0,8° antes de entrar.
- **Sonido nuevo** (`src/sim/h2rSound.js`): sintetizado muestra a muestra en un AudioWorklet.
  - Cada explosión del cuatro en línea de 180° (orden 1-2-4-3) es un pulso de presión con su variación por cilindro, que hace sonar las resonancias del escape y se satura según la carga.
  - Encima: el silbido del compresor a ≈9,2 veces el cigüeñal según la presión de soplado, el chirrido al cortar gas con presión, los petardeos al retener, el corte del cambio rápido y del limitador, el silbido de la primaria y la admisión.
  - Es una síntesis a oído, no una grabación.

## La H2R a nivel de proyecto de Blender (5 de octubre de 2026)

El usuario pidió centrar esta tanda en la Ninja H2R, con detalle absoluto, y organizar el código por piezas.

**Paso 1: el código, pieza a pieza.** Los cuatro archivos de la moto (`h2r.js`, `h2rParts.js`, `h2rBody.js`, `h2rEngine.js`, ≈1.800 líneas) pasan a un directorio, `src/vehicles/h2r/`, con un módulo por pieza o sistema: ruedas, frenos, dirección (horquilla, tijas, manillar), basculante, chasis, motor, admisión, escape, cuadro de instrumentos, detalles y, en `bodywork/`, depósito, asiento y colín, carenado, rótulos y las superficies que comparten. `src/vehicles/h2r.js` queda como punto de entrada. Cada función se movió literalmente; el modelo resultante es idéntico malla a malla (comprobado con una huella de cada malla: nombre, material, vértices y sumas de posiciones y normales), y en el navegador da los mismos 112.905 triángulos, 146 mallas, 43 materiales y 11 texturas. Se quitaron dos versiones del carenado que ya no se usaban.

**Paso 2: ruedas, frenos y cadena** (`wheels.js`, `brakes.js`, `chain.js`), contrastados con las fotos libres de la moto sin carrocería (Wikimedia Commons, «Kawasaki Ninja H2R exposd right front», «… exposed left front», «… exposed left rear»; solo como referencia):
- **Neumáticos:** el perfil completo de un slick, desde el talón: el nervio protector de llanta (≈6 mm), el flanco abombado con su línea de moldeo, el hombro y la corona. La banda de rodadura va mate y rozada; los flancos, de un negro satinado más profundo (dos materiales).
- **Llantas:** sección de verdad, con los asientos del talón y sus resaltes, el pozo central y las pestañas en J con el labio mecanizado; la franja verde en las dos caras de las dos llantas, como en las fotos.
- **Radios:** barridos, de sección redondeada y con los cantos exteriores mecanizados. Delante, cinco radios que se abren en Y; detrás, cinco en Y cuyos brazos, rectos, se juntan con los del vecino en la llanta (la estrella).
- **Discos:** la banda de frenado taladrada **de verdad** (antes era una máscara de transparencia), en filas diagonales de cuatro taladros; las pestañas del borde interior; los botones flotantes con su centro taladrado; el soporte negro con ventanas entre sus brazos y sus tornillos al buje. Delante, 330 mm; detrás, 250 mm (publicados). En la rueda delantera izquierda, el anillo dentado del sensor de velocidad, como en la foto.
- **Corona y transmisión:** la corona de 42 dientes con el perfil del diente y su asiento para el rodillo, anodizada oscura; el soporte del amortiguador de transmisión, mecanizado, con sus nueve ventanas y los tacos de goma; la tuerca almenada del eje.
- **La cadena, eslabón a eslabón:** una 525 (paso 5/8 in, 15,875 mm; rodillos de 10,16 mm), eslabones interiores y exteriores alternos, cada uno con sus dos placas en forma de ocho, los rodillos y los bulones remachados. Sigue las tangentes exactas entre el piñón (≈18 dientes) y la corona.
- **Pinzas:** la Stylema rehecha: un cuerpo de aluminio con dos lóbulos sobre los pistones y «brembo» en rojo a lo largo, el puente sobre el disco con su ventana y las pastillas vistas por ella, el pasador y su muelle, las orejas de anclaje radial con sus tornillos, el racor banjo y el purgador con su capuchón. La izquierda se construye ya reflejada, con el rótulo legible (antes se leía al revés). Detrás, una pinza propia de dos pistones (antes era la delantera a escala).
- **Latiguillos trenzados** con sus casquillos: de cada pinza, por detrás de su barra y sujetos con una grapa, al repartidor bajo la tija inferior, y de ahí a la bomba del manillar derecho (recorrido ≈).
- **Triángulos sin área:** una forma con muchos agujeros a veces une tres puntos alineados en un triángulo sin área, de normal nula. Se quitan tras la extrusión (`dropSlivers` en `geometry.js`).
- La moto pasa de ≈113.000 a ≈357.000 triángulos.

**Paso 3: horquilla, tijas y mandos** (`fork.js`, `clamps.js`, `controls.js`; `steer.js` queda como montaje), contrastados con «Kawasaki Ninja H2R exposed top right» y «… exposed left front» (Commons, solo referencia; medidas ≈, a escala de los tubos de 43 mm y los semimanillares de 22 mm):
- **Barras:** el tubo interior de 43 mm cromado duro; el guardapolvos negro en la boca del retén; el portarretén escalonado en aros mecanizados; el tubo exterior (≈56 mm) anodizado en champán claro, con su chaflán arriba; los tapones verdes hexagonales con el regulador de precarga plateado y el tornillo de amortiguación dorado.
- **Pies:** negros, fundidos alrededor del eje con su ranura de apriete y sus dos tornillos detrás; los dos anclajes radiales de la pinza, colocados exactamente bajo las orejas de la Stylema, con su eje radial.
- **Tijas:** la superior, una pletina mecanizada con un reborde elevado que sigue su contorno alrededor de dos vaciados; cada abrazadera de barra partida por detrás y cerrada por su tornillo Allen; la tuerca de la pipa embutida en el centro, con sus cuatro ranuras. La inferior, más gruesa, con dos tornillos por abrazadera.
- **Semimanillares:** la abrazadera alrededor de la barra, partida y con sus dos tornillos, y el manillar de 22 mm.
- **Puños estriados**, el derecho sobre el tubo del gas con su pestaña, y contrapesos negros con sus ranuras.
- **Piñas de mandos** con sus botones, el interruptor de parada en rojo, la carcasa del gas y sus dos cables.
- **Bombas radiales** de freno (derecha) y de embrague (izquierda): la abrazadera, el cuerpo hacia delante, el eje de la maneta con su rueda de regulación y su anillo dorado, y la maneta negra, curvada delante del puño y con bola en la punta. Los depósitos redondos ahumados, con tapa negra estriada, sobre sus soportes, y el latiguillo corto hasta la bomba. La bomba de embrague baja su manguito hacia el motor.
- El latiguillo de freno nace ahora en el racor de la bomba derecha.

**Paso 4: escape** (`exhaust.js`), contrastado con «Kawasaki Ninja H2R right» y «… exposd right front» (Commons, solo referencia; medidas ≈):
- **Colectores:** cuatro tubos de titanio con su degradado de calor (pajizo junto a la culata, azul y violeta al bajar, bronce en las curvas), cada uno sujeto a su lumbrera por una brida ovalada con dos tuercas y sus espárragos, y con su cordón de soldadura azul ≈8 cm más abajo.
- **Colector 4 en 1** dorado bajo el motor, con la sonda lambda y su cable; su salida sigue ya el eje del silenciador.
- **Silenciador** de acero cepillado: tubo de unión de ≈62 mm que se abre en un cono largo hasta ≈104 mm en la boca, bajo el colín. La boca está cortada en bisel, con una pared de 4 mm, el labio enrollado, el interior oscuro y el núcleo perforado retranqueado.
- **Unión deslizante** tras el colector, con su manguito y dos muelles enganchados; abrazadera del soporte bajo la estribera derecha, con su orejeta, y la pletina calada que sube hasta la placa del talón con dos tornillos Allen.
- **Corregido:** las caras del silenciador estaban al revés (por fuera se veía el interior oscuro, de ahí el «silenciador negro»).

**Paso 5: motor y compresor, primera parte** (`engine/`, ahora una carpeta con un módulo por pieza):
- **Calibración nueva:** la foto lateral derecha («Kawasaki Ninja H2R right», Commons, solo referencia) se proyecta sobre el plano lateral del modelo alineando los centros de los dos ejes (1,644 mm por píxel, 1,3° de giro). Sobre esa rejilla milimétrica se trazan las tapas del motor (≈ ±3 mm).
- **Tapa del embrague** (`right.js`): contorno trazado, gris oscuro satinado, de cantos redondeados. Lleva el tambor del embrague en relieve (Ø ≈198 mm en la base, cara de Ø 141 mm) con la faceta plana de su parte trasera superior, la tapa del captador (Ø 70 mm) embutida con su ranura y su orificio central, el tapón de llenado de aceite plateado, el tapón de vaciado dorado y los tornillos con brida del borde, cada uno sobre su resalte.
- **Cárter superior** de aluminio con el emblema «SUPER CHARGED» en su aro (rótulo de fábrica de la H2R, como en la moto). **Cárter inferior** fundido con sus nervios y tornillos, y el radiador de aceite con sus aletas verticales y sus racores.
- **Compresor** (`supercharger.js`, con la Kawasaki Technical Review n.º 180, 2019, figs. 3 y 10):
  - rodete de Ø 69 mm (dato de prensa, ≈) con 6 álabes completos y 6 intermedios de ≈1 mm de espesor, curvados en espiral, que gira a 9,2 veces el cigüeñal (lo anima el modo de pilotaje con las vueltas del motor);
  - carcasa roja anodizada con la voluta que crece en espiral hasta la salida, la boca con su campana pulida mirando a la izquierda, la corona de tornillos y la caja de la transmisión detrás;
  - salida vertical hasta el acople de silicona naranja, con dos abrazaderas sobre la boquilla de la cámara.
- **Cámara de admisión** (`chamber.js`): fundición de cantos muy redondeados en dos mitades con pestaña atornillada en la cintura, raíl de inyectores encima (cuatro conectores, mazo de cables, sensor de presión) y los cuatro cuerpos de mariposa debajo, con el eje del acelerador y el sensor de posición.
- **Conducto de admisión de aire dinámico:** termina recto y redondo sobre la campana del compresor. **Corregido:** tenía las caras hacia dentro, y desde fuera solo se veía la pared del fondo, como una cinta.
- Bloque, culata y cárter de aceite pasan a gris oscuro, como en las fotos sin carenado; los cantos redondeados de las piezas extruidas se sombrean ya suaves, sin facetas.

**Paso 6: lado izquierdo del motor, estriberas y chasis:**
- **Lado izquierdo del motor:** tapa del piñón negra y angulosa, con su resalte redondo sobre el eje y sus tornillos (como en las fotos, ya no redonda con ranuras). Encima, el cilindro receptor del embrague hidráulico con su purgador y la manguera hasta la bomba del manillar. La tapa del alternador lleva ahora la cara plana con un chaflán ancho.
- **Estriberas** (`rearsets.js`, trazadas en la rejilla milimétrica de la foto derecha; el lado izquierdo es simétrico):
  - en cada lado, un soporte de aluminio mecanizado en forma de X, atornillado al nudo de la pata trasera del chasis;
  - encima, la talonera plana con su ranura;
  - la estribera abatible, moleteada, con su horquilla y su muelle de retorno.
  - A la derecha, el pedal de freno hasta su puntera, la bomba trasera vertical con su varilla y el depósito ámbar sujeto con su abrazadera al nudo superior.
  - A la izquierda, la palanca de cambio y la varilla con sus dos rótulas hasta el brazo del eje del cambio, por fuera del chasis.
  - El soporte del silenciador cuelga ahora del brazo inferior de la estribera derecha.
- **Chasis:** el arriostramiento en V detrás de la pipa (figura 4 de la Kawasaki Technical Review n.º 180), las cartelas de la pipa, los aros de las tazas de dirección y un cordón de soldadura en el extremo de cada tubo.
- **Corregido:** una malla vacía del motor, sin vértices, que había quedado tras mover las tapas.

**Paso 7: acabado del carenado:**
- **Mirror Coated Spark Black** como lo describe Kawasaki (Technical Review n.º 180, fig. 14): película de plata real bajo un barniz ahumado. Ahora es un espejo oscuro (color base más oscuro, rugosidad 0,07, barniz de 0,02): negro donde mira a la sombra y plateado donde le da la luz, como en las fotos del Petersen y de Goodwood. Antes se leía como un plateado claro casi mate.
- **Tapón de combustible** (`bodywork/fasteners.js`) sobre el depósito, justo detrás de la pipa: aro mecanizado con chaflán, tapa negra con cerradura de llave, bisagra y respiradero. Se proyecta sobre la superficie del depósito y se orienta según su normal.
- **Tornillería de los paneles laterales:** tornillos de cabeza abombada con arandela y hexágono interior, en la punta trasera, en el borde superior junto a la cúpula y en el borde inferior sobre las aletas (posiciones ≈, de las fotos). Se proyectan sobre los paneles y se reflejan al lado izquierdo.

## La H2R pasa a Blender (5 de octubre de 2026)

Decisión del usuario: **el modelo 3D de la H2R se hace en Blender; las físicas, el pilotaje, el sonido y las animaciones siguen en código.**

**Fase 1: la cadena de trabajo.**
- `blender/h2r/build.py` construye la moto en Blender 5 (como módulo `bpy`, sin interfaz) y exporta `assets/h2r/h2r.glb`. Uso: `node tools/h2r-export.mjs` y después `python3 blender/h2r/build.py`.
- Por ahora parte del modelo en código: `tools/h2r-export.mjs` lo exporta a glTF desde un navegador sin interfaz (`blender/h2r/source/code-parts.glb`, un intermedio que no va al repositorio). Lo ya hecho (motor, frenos, cadena, ruedas…) sirve así de base para refinarlo en Blender.
- `src/vehicles/h2rAsset.js` carga el `.glb` al arrancar:
  - quita los sufijos `.001` que Blender pone a los nombres repetidos, para que el código encuentre `h2r-steer`, `h2r-wheel-f-spin`, `h2r-wheel-r-spin`, `h2r-swingarm`, `h2r-impeller` y `h2r-dash` con su nombre exacto;
  - vuelve a aplicar el detalle de superficie de cada material: su receta viaja como `extras` del glTF en `userData.detailSpec`;
  - pone el salpicadero vivo, que redibuja el pilotaje.
  - Si el archivo no se puede cargar, entra el modelo en código.
- `tools/glb.mjs`: un lector de GLB para Node. `h2r-check.mjs` mide ya el `.glb` publicado (2,075 × 0,850 × 1,157 m), comprueba las piezas que mueve el pilotaje y que las ruedas giran sobre sus ejes (0,00 mm).
- `GLTFLoader` y `GLTFExporter` de Three.js r170 en `vendor/`.

**Fase 2: el carenado como piezas moldeadas y prensadas** (`blender/h2r/parts/bodywork.py`):
- Cada panel es una sola superficie: vértices soldados y pliegues marcados donde las fotos muestran una arista.
- Las piezas moldeadas y redondeadas (tapa y costados del depósito, colín, tapa lateral, asiento) se suavizan con subdivisión Catmull-Clark, conservando los pliegues. Antes, sus triángulos se reunían en cuadriláteros para que la superficie no ondule.
- Los paneles prensados y facetados (cúpula, paneles laterales, alas, quilla, aletas inferiores) conservan sus planos.
- Todos tienen pared (≈2,5 mm; el asiento, 12 mm) con su canto, un bisel fino que capta la luz como el borde de un panel real y normales endurecidas: los planos se ven planos y los pliegues, vivos.
- Los rótulos se envuelven sobre la superficie terminada («shrinkwrap»), sin flotar.
- La comparación lateral en Blender (`lib/review.py`: cámara ortográfica a 1 px = 1 mm sobre la misma rejilla que la foto calibrada) confirma que los contornos ajustados antes coinciden con la foto; lo que faltaba era la superficie.
- **Corregido tras el CI:** el grosor y el bisel creaban caras sin área en las coordenadas de textura. Ahora se aplican los modificadores en Blender y cada triángulo sin área recibe coordenadas por su posición, según el eje más cercano a su normal. Además, `GLTFLoader` quita el punto de los nombres: el `.001` de Blender llega como `001`, y el cargador lo quita también. El despliegue de Pages no copiaba `assets/`, así que la web caía al modelo en código; ya lo copia, y `h2r-check` lo vigila.

**Fase 3, primer paso: oclusión ambiental horneada** (`blender/h2r/parts/bake.py`):
- Las sombras de contacto en cada rincón, unión y hueco (el motor entre los tubos del chasis, la tapa del embrague contra el cárter, el borde de un panel sobre el motor), que la luz ambiental en tiempo real no encuentra sola.
- Un atlas de 2048 × 2048 para toda la moto, en un segundo juego de coordenadas (`uv1`), horneado con Cycles con todas las piezas presentes para que se ensombrezcan entre sí (≈3 mm por texel). Cada pieza se despliega por separado y recibe un cuadrado del atlas proporcional a su superficie; las piezas de miles de islas diminutas (cadena, rótulos, tiras finas) apuntan a una esquina blanca.
- Se exporta como `occlusionTexture` de glTF, que en Three.js es el `aoMap`: oscurece solo la luz ambiental y la del entorno, como hace la oclusión real.
- `verify.js` comprueba ya cada textura en el juego de coordenadas que usa: canal 0 para los mapas de superficie y canal 1 para el horneado. En el canal del horneado solo exige que el atributo exista.

**Fase 3, resto: materiales (PENDIENTE; el usuario la deja aparcada por ahora).** Falta pasar a Blender los materiales de cada pieza, con sus mapas propios en lugar del detalle por proyección del navegador:
- carbono con su trama en relieve y sus brillos propios;
- titanio con el degradado de calor (pajizo, azul y violeta) pintado sobre la pieza;
- goma del neumático y de los puños;
- aluminio cepillado y mecanizado;
- las dos capas del espejo ahumado (película de plata y barniz ahumado).

Quedan además fuera de la fase 3 la mecánica refinada pieza a pieza y una pasada de la forma del carenado contra las fotos. Ver «Pendiente» en `TRASPASO.md`.

## La Ninja H2R contra fotos calibradas: frontal, alas, cúpula y cabina (3 de octubre de 2026, tercera versión)

Las fotos oficiales de Kawasaki no se pudieron volver a descargar en esta sesión. Se usaron como referencia fotos libres de Wikimedia Commons de la moto en exposiciones: perfil derecho, frontal, tres cuartos y varias sin carenado. Ninguna está en el repositorio.
- **Cámaras resueltas sobre las cotas publicadas.**
  - **Lateral derecha:** batalla y diámetros de los neumáticos, con 1,9 px de error medio. En la foto la moto está sobre un caballete y la rueda trasera queda libre, 1,7 cm levantada.
  - **Frontal:** con los puntos ya medidos; es casi ortográfica.
  - De la lateral salen x e y; de la frontal, z (≈ ±2 cm). El banco de pruebas aislado (render con la cámara de cada foto y superposición de bordes) está en la carpeta temporal.
- **Alas:**
  - Eran placas casi verticales.
  - Ahora son una tabla plana de carbono que sale de un pie atornillado junto a la base del parabrisas y va hacia fuera, hacia arriba y hacia atrás, morro abajo: ≈15–18° de diedro, ≈23° de flecha, ≈20° de incidencia.
  - Su punta, cortada en recto, es el punto más ancho (0,850 m).
- **Parabrisas:**
  - Se ensancha hacia arriba hasta ±0,16 m; antes se estrechaba a ±0,07 m.
  - Lleva las tiras negras atornilladas en sus bordes y los cuernos de carbono a lo largo de ellos.
  - Desde los ojos del piloto ya no se ve blanquecino: la cara interior es solo tinte, sin reflejos, y la exterior conserva el brillo.
- **Morro:**
  - Capó de carbono rehecho en metros, con su V y los filetes verdes.
  - Ojos oscuros en bolsillo, quilla central y galones de carbono con el filete verde.
  - Cara inferior con la toma de aire dinámico.
  - Carenados inferiores cromados que bajan hasta ≈0,33 m, y aletas inferiores de láminas con su placa en flecha.
  - La punta del panel lateral se retrasa ≈4 cm y sale ≈5 cm, como en la foto.
  - Las tres láminas de carbono bajo el panel, que la moto no tiene, se sustituyen por las tapas cromadas atornilladas del radiador.
- **Dirección:**
  - El tubo verde de la pipa atravesaba la tija superior y se veía como un disco desde los ojos del piloto.
  - Ahora la tija superior, de aluminio mecanizado como en las fotos sin carenado, va encima, a ≈0,97 m. Las barras asoman ≈3 cm por encima, con su tapa verde, y los semimanillares quedan ≈4 cm por debajo.
  - El cuadro de instrumentos sube 5 cm para verse por encima de la tija. Las barras exteriores de la horquilla son plateadas.
- **Motor y colín:**
  - Tapa del embrague con su aro y su disco abombado, tapa del encendido y placa redonda de la culata en su sitio (medidas en la foto).
  - Bloque, culata y cárter de aluminio fundido claro; colectores con el tono bronce del titanio y silencioso pulido.
  - El depósito del amortiguador queda tras la tapa, como en la foto.
  - El colín tiene aristas vivas y el rótulo «Ninja» de fábrica en su panel.
  - Bajo el colín, a la derecha, el panel oscuro del guardabarros interior y del lateral del subchasis: una pala inclinada entre el colín y el reposapiés, medida en la foto. Antes ahí se veía el fondo.

## La conducción de la H2R contra la prueba de MOTORRAD (3 de octubre de 2026)

Se contrastó con una prueba de prensa publicada: la revista alemana MOTORRAD cronometró con GPS la H2R en el óvalo de Dekra en el Lausitzring (julio de 2015; la misma potencia publicada de 228/240 kW).

| | MOTORRAD | Modelo antes | Modelo ahora |
|---|---|---|---|
| 0–100 km/h | 3,1 s | 2,55 s | 2,87 s |
| 0–200 km/h | 6,5 s en 184 m | 5,44 s en 158 m | 6,51 s en 196 m |
| 0–300 km/h | 13,4 s en 660 m | 10,2 s en 498 m | 13,06 s en 670 m |
| Punta | 337 km/h por GPS (357 en el cuadro) | 348 km/h, contra el corte | 338 km/h, por la resistencia del aire |

- **Fallo de física corregido.**
  - La transferencia de carga al eje trasero solo tenía en cuenta la aceleración neta. Faltaba el momento de la resistencia del aire, que actúa a la altura del centro de presión: carga la rueda trasera y aligera la delantera aunque la velocidad sea constante (≈800 N a 330 km/h).
  - Sin él, con una resistencia realista, la punta la limitaba el agarre del neumático trasero, que patinaba un 10 %.
  - Se corrige también en el momento que levanta la rueda delantera.
- **Ajustados a la prueba** (todos estimados, ≈):
  - La altura del centro de masas con el piloto: de 0,62 a 0,68 m. Fija dónde se levanta la rueda delantera (≈1,1 g), que es lo que limita la salida.
  - El área de resistencia con las alas y el piloto agachado: de 0,30 a 0,39 m².
  - Las pérdidas de transmisión: 0,85, que incluyen la diferencia con la potencia declarada que MOTORRAD midió en su banco (261 CV, sin aire dinámico).
  - La potencia, el par y los desarrollos publicados no cambian.
- `tools/h2r-check.mjs` compara ahora con esas cifras (`PRESS` en `src/data/h2r.js`): ±0,35 s y ±10 % de distancia, y la punta a ±8 km/h de la de GPS.
- El 0–100 queda 0,2 s más rápido que el medido: en la prueba la salida la hizo un piloto. La frenada de 200 a 0 km/h (≈5,7 s, ≈1 g) no tiene medida publicada con la que contrastarla.
