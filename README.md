# SpaceX Vehicle Center

Experiencia 3D interactiva, a escala real (1 unidad = 1 metro), con recreaciones técnicas de ocho expositores de SpaceX, un caza, el F-16A, con su propia pista, y un deportivo, el Porsche 911 GT3 RS, con su circuito:

| Vehículo | Configuración modelada | Altura / envergadura |
|---|---|---|
| Falcon 1 | Configuración tardía de 2008: Merlin 1C, Kestrel y cofia bicónica; corte educativo de la segunda etapa | 21,98 m de la salida de la tobera a la punta · 1,681 m de diámetro (plano acotado de la guía de 2008) |
| Starship + Super Heavy | Versión 3 (Block 3): 33 Raptor 3, 3 grid fins con pines de captura integrados, etapa caliente integrada en celosía abierta | 124 m |
| Falcon 9 | Block 5 con cofia de 5,2 m, patas plegadas, grid fins de titanio | 70 m |
| Falcon Heavy | Tres núcleos, propulsores laterales con cono de morro | 70 m · 12,2 m de ancho |
| Dragon | Crew Dragon con trunk (paneles solares en media circunferencia, radiadores, aletas) | 8,1 m |
| Starlink | V2 Mini con las dos alas solares desplegadas | 30 m de envergadura |
| Tesla Roadster | 1.ª generación (modelo 2010, carrocería anterior al 2.5) con Starman, carga útil del vuelo inaugural del Falcon Heavy | 3,946 m · 1,851 m de ancho con espejos · 1,127 m de alto |
| Engine Row | Raptor 3, Raptor Vacuum y Merlin 1D sobre cunas, a 1:1 | 4,4 m (RVac) |
| F-16A | Block 15 con motor F100-PW-200, sobre su tren en la cabecera de su pista; geometría de los informes NASA TP-1538 y TP-3355 | 15,038 m de largo · 9,144 m de envergadura · 5,01 m de alto |
| Porsche 911 GT3 RS | 992 de 2023 en el gris casi blanco y las llantas rojas de las fotos de estudio de Porsche, conducible, en la explanada junto a su circuito; cotas de la ficha técnica de Porsche | 4,572 m de largo · 1,900 m de ancho · 1,322 m de alto (al ala) |
| Kawasaki Ninja H2R | Modelo 2027 en Mirror Coated Spark Black con el chasis verde de las fotos de estudio de Kawasaki, pilotable, junto al Porsche; cotas de la ficha de Kawasaki | 2,070 m de largo · 0,850 m de ancho · 1,160 m de alto |

**Starship** encabeza la lista, porque es el expositor principal y el del lanzamiento (tecla **1**). Le sigue el **Falcon 1** (tecla **2**), que abre la línea histórica: Falcon 1 → Falcon 9 → Falcon Heavy.

Starship no está sobre un soporte de museo sino sobre su plataforma: una reconstrucción a escala del **Pad 2 de Starbase** — la explanada, la zanja de llamas bidireccional revestida de inoxidable con su deflector central, la mesa de lanzamiento cuadrada de cubierta refrigerada por agua con sus veinte pinzas de sujeción, las conexiones separadas de metano y oxígeno del propulsor con su búnker dividido, la torre de integración de ≈149,5 m (≈480 ft y un pararrayos de 10 ft, según la FAA), los brazos de captura de unos 26 m, el brazo de desconexión rápida de la nave, el pararrayos y la estación meteorológica en lo alto de la torre, el depósito de agua del deluge en tanques horizontales y la granja criogénica con sus tanques horizontales de oxígeno y metano y los subenfriadores. Los tres Falcon tampoco: **están de pie como en la plataforma**, sobre sus pinzas de sujeción y con los motores colgando libres sobre una abertura de la mesa. Antes descansaban con las toberas sobre un anillo más ancho que el propio cohete y, vistos de lado, flotaban. Lo citado (blog de NASA Commercial Crew sobre la adaptación de la plataforma 39A, 2016; Spaceflight Now, 2019): el Falcon 9 lo sujetan **cuatro pinzas** en los puntos cardinales y el Falcon Heavy **ocho**, porque el par este-oeste del Falcon 9 caería donde están los motores de los laterales; el peso del cohete descansa sobre las pinzas y no sobre los motores, y el TEL del Heavy lleva **seis mástiles de servicio de cola** que alimentan los tres núcleos por placas umbilicales en la base. Cada mesa es un bloque de hormigón con cubierta de acero, un túnel de escape que lo atraviesa con un deflector de dos vertientes bajo la abertura, barandilla y escalera; las pinzas (placa base, pedestal, asiento bajo el borde de la base, dedo de retención y cilindro hidráulico) sostienen el borde inferior de la etapa. El reparto de las ocho del Heavy —dos en el núcleo central y tres en cada lateral—, el bloque, el túnel, los mástiles y sus posiciones están reconstruidos. El **Falcon 1** se apoya en el canto inferior de su cola troncocónica y tiene al lado el equipo de tierra que se ve en las fotos de Omelek: un **erector** de celosía blanca con dos brazos que abrazan la etapa y una **torre umbilical** triangular con su pluma, de la que baja en bucle la manguera a la segunda etapa y otra más fina a la primera (todo reconstruido de fotografías; nada de ello tiene cotas publicadas). Starship, en cambio, se sostiene como en Starbase: la mesa de lanzamiento del Pad 2 lo agarra por el faldón con sus veinte pinzas.

Desde ahí **despega**: con **G** o el botón *Launch* corre la secuencia completa, de la cuenta atrás a la separación en caliente — y después **el propulsor vuelve y la torre lo atrapa**, con el ciclo de boostback, el descenso, el encendido de aterrizaje y los brazos cerrándose sobre él.

Todo el modelo es procedural (sin binarios): las geometrías se generan a partir de perfiles de revolución con normales analíticas y UV métricas, los materiales PBR usan texturas generadas en Canvas (acero laminado con soldadura de anillo cada 1,83 m y costura vertical de placa cada 7,3 m, asfalto envejecido con sellado de grietas, composite de carbono, células solares, PICA, hormigón en losas de 6 m, oleaje) y el escudo térmico de Starship son 13 267 losetas hexagonales instanciadas de 0,26 m entre caras sobre la mitad expuesta del casco, el morro y las aletas.

Los acabados están calibrados contra fotografías del vehículo real: el acero inoxidable es **casi un espejo**, como en las fotos de los Booster 18 y 19 y del Ship 39 (2026), con las soldaduras de anillo, las líneas punteadas de los largueros y marcas de plantilla, y apenas diferencia de tono entre chapas; las losetas forman un **mosaico de gris carbón con variación en manchas** — no ruido por loseta, que se lee como escamas de pez — y no proyectan sombra sobre sí mismas; y las aletas son **oscuras por ambas caras**, con la de barlovento texturada. En los Falcon, las **grid fins de titanio** son gris carbón (antes, un titanio claro y pulido reflejaba el cielo y se leía como una celosía de plástico blanco), el **interior de las toberas** es oscuro y mate en lugar de metal desnudo, y las **patas plegadas** envuelven el tanque con sección abombada en vez de ser placas planas separadas 8 cm de él en los bordes. Las juntas de la cofia y de la segunda etapa son líneas grises tenues, como en las fotos, y no las líneas negras que parecían dibujadas a rotulador alrededor del vehículo. El interior de las toberas Merlin, visto desde debajo de la etapa, es de metal oscuro con un tono bronce que recoge la luz del borde; antes, casi negro y mate, se veían nueve discos negros. El **fuselaje del Falcon 9 y del Falcon Heavy es blanco limpio**, como un cohete nuevo en la plataforma: el hollín en vetas de un propulsor reutilizado se leía en la exposición como un acabado quemado y sucio (el patrón sigue disponible en la textura, desactivado). Las **células solares del trunk de la Dragon** son casi negras con líneas plateadas finas, no la rejilla azul saturada que mostraban. La manta térmica blanca del bus del **Starlink** conserva un arrugado suave; con normales exageradas y barniz, el reflejo del cielo se rompía en motas y parecía nieve. Las SuperDraco disparan desde huecos oscuros en la pared de la cápsula, no desde carenados en relieve (ver *Crew Dragon contra las fotos de la NASA*). La **etapa caliente** de Super Heavy es, en el Block 3, una celosía abierta de puntales en zigzag sobre la cúpula delantera blindada (ver *Starship V3 contra las fotos*). El **escudo térmico** ya no deja ver agujeros entre losetas a ciertas distancias: la capa oscura de respaldo iba solo 2 mm por encima del casco facetado, y entre facetas el acero asomaba por las juntas; ahora va 8 mm por encima (media loseta) con una malla más fina, y la cobertura del morro crece de forma continua hasta la punta en lugar de saltar de 112° a 180°, lo que dibujaba un anillo 3 m por debajo del vértice. Las **llantas del Roadster** muestran las dos caras del barril y la pestaña del borde: antes, a través de los radios, se veía el exterior de la pared opuesta como un arco fino y roto. **Starman** lleva un traje que se lee como tela y no como plástico —exterior mate con brillo de tejido en los bordes—, más holgado (pecho, brazos y piernas de traje, no de maniquí), con los paneles grafito de hombros y rodillas, cuello grafito en vez de la banda que le cubría el pecho como un chaleco negro, guantes oscuros con manguito, el conector umbilical en el muslo derecho y las bisagras del visor a ambos lados de un casco un 8 % mayor (proporciones reconstruidas de las fotos del vuelo). Tenía manchas grafito de borde dentado en hombros, codos y muñecas. No eran sombras, lo que se comprobó apagándolas: eran los paneles de hombro y los manguitos de los guantes, que quedaban a 4–7 mm de la superficie del brazo, con 14 y 18 segmentos cada uno, y las dos superficies facetadas se cruzaban en dientes de sierra. Ahora sobresalen 9 mm, con 28–32 segmentos, y el borde es un anillo limpio. El traje ya no lleva el mapa de pliegues: sus esferas y cilindros tienen UV que se pellizcan en los polos, y el marco tangente que deriva de ellas se invertía en cada articulación. Después, brazos y piernas dejaron de ser esferas y cilindros apilados como los de un maniquí: ahora son una manga continua sobre una curva suave que pasa por las articulaciones, algo más ancha en codos y rodillas, con unos pocos pliegues de compresión en la cara interior del codo o la rodilla. Los paneles de hombro son casquetes sobre el hombro, no bolas. El pecho lleva dos costuras grafito del cuello a la cintura. El blanco baja un punto y el brillo de tejido se reduce a la mitad para que se vean los pliegues. Las proporciones son las de antes; los pliegues y la posición de las costuras se leen de las fotos del vuelo y son aproximados.

El **llano de marea** del entorno lleva canales de drenaje: líneas sinuosas de uno o dos metros, más oscuras y húmedas, solo en algunas zonas, como en cualquier foto aérea de Boca Chica. Son la curva de nivel 0,5 de un ruido deformado, y a distancia se atenúan según el trozo de píxel que cubren en vez de convertirse en líneas negras de grosor fijo. Las manchas de matorral usan ruido deformado y tienen bordes irregulares en lugar de las manchas redondas del ruido simple. El trazado es verosímil, no un levantamiento.

El entorno es contexto verosímil, no un levantamiento: la llanura costera de Boca Chica con matorral bajo, dunas y una playa que da al Golfo de México con el agua a ≈485 m de la mesa de lanzamiento (las crónicas sitúan el complejo «a unos cientos de yardas» de la playa de Boca Chica; antes estaba a 1,1 km), un cielo con cúmulos de buen tiempo a 1,4 km (que se desvanecen con la altitud), la explanada del museo en losas de hormigón y el terraplén de la plataforma en talud 1:3 hacia el terreno. Entre la llanura y la playa hay ahora una **duna costera**, como en las fotos de Starbase tomadas desde la playa: una cresta de 2 a 7 m levantada por el viento, con otra más baja y antigua detrás, cortada por huecos de erosión y sujeta por matas de hierba de playa (unas 5 900 matas de nueve hojas, que no se generan en calidad baja). La cara que mira al mar es arena y la cresta y la ladera trasera tienen hierba. Va en su propia banda que sigue la línea de agua, porque la malla del terreno (celdas de unos 40 m) es demasiado gruesa para llevarla, y se asienta sobre la misma función de altura del terreno, hundida unos centímetros en los bordes. Alturas y anchuras son verosímiles para una duna del golfo, no un levantamiento. La **carretera** paralela a la fila es ahora una carretera rural de Texas: calzada de 7,2 m con bombeo central y borde biselado de 5 cm, asfalto envejecido con árido visible, sellado de grietas y parches, rodadas más oscuras en cada carril, arcenes de grava y balizas flexibles cada 40 m. Las marcas siguen el MUTCD de la FHWA: líneas de borde blancas de 15 cm, eje amarillo discontinuo de 3,05 m cada 12,19 m (10/40 ft), y en el vial de acceso una línea de detención blanca de 45 cm a 1,2 m del cruce con su señal STOP R1-1 de 75 cm a la derecha. Su trazado es decorado, no un levantamiento. El recinto tiene el **mobiliario** que tiene una exposición al aire libre: un atril informativo delante de cada vehículo, orientado hacia la carretera por la que llegan los visitantes y sin texto ni marcas (representa el panel, no imita el de nadie), y una **valla de malla metálica** de 2,4 m con postes galvanizados cada 3 m alrededor de la parte trasera y los laterales, abierta donde sale el vial de servicio hacia la plataforma. La malla es una textura con transparencia de rombos de 5 cm, su paso real. La **Dragon** ya no se apoya sobre cuatro postes cuadrados, que parecían cajas apiladas bajo la nave, sino sobre un adaptador cónico de acero, como sobre la segunda etapa: un tronco de cono desde la base del trunk de 3,7 m hasta la peana, con un anillo de unión atornillado arriba y otro de pie abajo (proporciones reconstruidas). La **vegetación** ya no son cúpulas lisas que, en cualquier vista amplia, parecían rocas verdes. Cada **mata** es follaje: unas 170 hojas pequeñas repartidas en una cúpula achatada, a dos caras, en los verdes de la llanura (oliva, verde grisáceo, paja seca), sobre unos pocos tallos desnudos. Entre ellas hay unas 7 000 **macollas de gramínea** de nueve hojas, a manchas según un campo de ruido de baja frecuencia y fuera del recinto, los viales, la plataforma y las charcas: la pradera costera de Starbase tiene tanta hierba como matorral. Las macollas no se generan en calidad baja. La llanura tiene además **charcas de marisma** —láminas de agua somera de 40 a 100 m, lisas como un espejo y del color del cielo, bordeadas de barro húmedo que se aclara hacia el limo seco—, como las llanuras mareales que rodean Starbase; están fuera de la fila, los viales y la plataforma, y su posición y contorno son verosímiles, no levantados. El vial de acceso termina al pie del terraplén del pad en una explanada de maniobra; antes seguía hasta desaparecer por debajo del terraplén. La playa se mide desde donde está de verdad el agua: el mar queda 0,9 m por debajo y el terreno solo alcanza esa cota unos 35 m mar adentro de la línea de costa, así que una playa pintada desde la línea de costa dejaba 35 m de ladera con hierba bajando hasta el agua. Ahora el terreno lleva por vértice cuánto tiene de arena seca y de arena húmeda, y el shader quita el matorral y pinta arena clara con una leve ondulación de tono, más oscura en la franja mojada.

![Vista general del centro](docs/screenshots/overview.jpg)

La interfaz de la simulación (menús, ficha técnica, etiquetas y vistas) está en inglés; esta documentación, en español.

## Ejecutar

Es un sitio estático con módulos ES e *import map*; Three.js r170 (núcleo + los addons usados) va incluido en `vendor/three`, así que no depende de ningún CDN. Sólo necesita un servidor HTTP:

```bash
npm run serve          # http://127.0.0.1:8080/  (o: npx serve .)
```

y abrir la URL que indique. `npm run serve` es un servidor en Node (`tools/serve.mjs`, admite `--port N`), así que funciona igual en Windows, donde antes hacía falta Python. Requiere WebGL 2.

`.claude/settings.json` es la configuración de Claude Code para este proyecto: esfuerzo alto, *ultracode* (flujos de trabajo con varios agentes) y los flujos de trabajo activados. No afecta a la web.

## Controles

**Pensada para ordenador.** La simulación está hecha para un ordenador de sobremesa o portátil con teclado, ratón y pantalla grande. La pantalla de carga lo dice («Designed for a desktop or laptop computer…»), y en un teléfono, una tableta o una ventana de menos de 900 × 560 px aparece una vez un aviso que se puede cerrar. La interfaz de teléfono (la barra inferior con sus cajones, la disposición vertical y los ajustes para táctil) se retiró el 28 de septiembre de 2026: costaba mucho tiempo mantenerla y la escena se ve mucho mejor en un ordenador. En la escena limpia queda un único botón, *Show interface*, para volver.

- **Arrastrar** orbita, **rueda** acerca hacia lo que hay bajo el cursor, **botón derecho** desplaza y **doble clic** centra la órbita en el punto señalado (la cámara conserva el rumbo y se acerca a la mitad de la distancia). Los saltos largos entre vistas viajan en arco, para no atravesar la torre ni los vehículos.
- **F** cambia a vuelo libre: `W A S D` mover, `Q`/`E` bajar/subir, arrastrar para mirar, `Shift` ×4, `Ctrl` ×0,2, rueda ajusta la velocidad. El suelo del vuelo libre es el terreno real (las lomas y el pad), no un plano a 0,4 m: antes se atravesaban las lomas, que llegan a unos 7 m.
- **V** (o el botón *Walk*) cambia a **paseo a la altura de los ojos**: la cámara baja al suelo delante de lo que se estaba mirando y camina con los ojos a 1,7 m sobre el terreno, el pad y su terraplén. Es la vista que enseña qué significa 1:1: un cohete de 70 m visto desde donde está un visitante.
  - **Campo de visión de 60°** (vertical; unos 90° de ancho en una pantalla 16:9) mientras se camina. Con los 42° de la órbita, junto al Starship todo quedaba comprimido como con un teleobjetivo y el cohete no imponía; al salir del paseo vuelve a 42°.
  - `W A S D` o las flechas para andar, arrastrar para mirar. **La rueda cambia el ritmo**: 1,4 m/s (paseo), 3, 6, 12 y 25 m/s, y lo indica sobre la escena; `Shift` lo dobla. Empieza en 3 m/s: 1,4 m/s es realista, pero el recinto mide 400 m.
  - **Doble clic sobre un expositor** o sobre un punto: te lleva hasta allí a paso de viaje (cruza el recinto en unos segundos, arrancando y frenando suave), se para a unos metros del borde del expositor por el lado del que vienes y gira hacia lo que señalaste. **Si el camino cruza la valla, pasa por la puerta del vial de servicio** (o rodea el extremo de la valla lateral). Antes el doble clic andaba a 1,4 m/s y se quedaba parado contra la valla o contra el borde de la zanja. **Paseando, la valla es transparente al doble clic**: lo que se ve a través de la malla es lo que se señala, y ningún destino queda a menos de 1 m de la valla o del borde de la zanja (ver *Tercera ronda*).
  - Andando con el teclado no se atraviesan las mesas, peanas, la mesa de lanzamiento, la base de la torre, **la valla** ni **el borde de la zanja** (una caída de 4,2 m sin salida). Un escalón de más de 0,6 m (los muros de 2,5 m del pad) es una pared. En vez de pararse en seco, el visitante se desliza a lo largo del obstáculo.
- La vista **In orbit** del Roadster cambia la peana por el adaptador de carga y el suelo por la Tierra, y deja el coche solo: la explanada, sus matorrales, los camiones de servicio y los otros siete expositores se ocultan al entrar y vuelven al salir (antes seguían ahí, y el coche aparecía aparcado sobre hormigón a 30 km de altura).
- El **plano del recinto** (arriba a la derecha) muestra la franja de exposición, los viales y el complejo de lanzamiento, con cada expositor como una parada numerada —un clic la visita— y la cámara como una cuña que apunta hacia donde mira. Se aparta cuando se despliega la ficha técnica y se oculta en pantallas estrechas, durante el vuelo y en la vista orbital del Roadster.
- **1–9** selecciona los nueve primeros expositores (Starship primero, luego del Falcon 1 al Engine Row y el F-16A; el Porsche se elige en la lista), **0** vista general, **L** etiquetas, **R** regla de altura, **T** pliega la ficha, **H** o **?** (o el botón *Guide*) abre la **guía rápida**: tres primeros pasos numerados y una tarjeta por cada forma de moverse (mirar, pasear, volar, lanzamiento) más expositores y pantalla, con la tarjeta del modo en uso marcada como *You are here*. La tercera línea de la primera visita lo recuerda.
- **P** (o el botón *Tour*) recorre el centro parada por parada; cualquier arrastre, rueda o clic lo termina y devuelve la cámara. Cada parada lleva un **texto breve con su fuente**: una cifra o un hecho de lo que hay en pantalla, con el enlace a la fuente de la ficha. `tools/provenance-check.mjs` comprueba que toda cifra con unidad de esos textos está en la ficha del expositor, que una cifra estimada o reconstruida lleva ≈ o la salvedad, y que la fuente existe, con tres controles negativos.
- **Primera visita:** tres líneas arriba en el centro explican cómo moverse, cómo llegar a los expositores y cómo lanzar. Desaparecen con la primera interacción (arrastrar, rueda, tecla o cualquier pulsación fuera de ellas) o a los 20 s, y no vuelven a salir (se guarda en `localStorage`; en una ventana privada se muestran una vez por visita). Por debajo de 1100 px de ancho no hay un hueco que no toque la ficha o las herramientas, así que no se muestran.
- **Encuadre en la parte libre de la pantalla:** en escritorio, la lista de vehículos ocupa los primeros ~256 px, y una vista centrada en toda la ventana dejaba su cuarto izquierdo debajo de ella (en la vista general, el Falcon 1 y el Falcon 9 quedaban enteros bajo la lista). Ahora el centro de proyección se desplaza hacia la zona libre con `setViewOffset`, sin mover la cámara, así que la selección con el ratón, las etiquetas y la profundidad siguen cuadrando. En el modo de escena limpia y en la vista orbital no hay desplazamiento.
- **G** (o el botón *Starship · Launch*) arranca la secuencia de Starship. Durante la cuenta atrás y el ascenso la cámara sigue un plan de planos, pero **arrastrar o girar la rueda devuelve el control al instante** sin detener la secuencia, y **la cámara sigue montada en el cohete**: el centro de la órbita se mueve con el vehículo y la cámara con él, así que se puede girar alrededor, pausar, reanudar o saltar a otro instante sin perderlo. Antes, al tomar el control la cámara se quedaba quieta donde la había dejado el plan de planos y el cohete salía de cuadro en segundos, con pausa o sin ella. El botón **Camera** (o **C**) elige entre los **planos de realización** y **tu órbita montada en el propulsor** o **en la nave** (tras la separación van cada uno por su lado); el cielo, los planos de recorte y las sombras siguen al vehículo en el que vas. El panel de misión lleva reloj, fase y el siguiente hito con su hora; **las dos etapas lado a lado, como en la retransmisión** (Super Heavy y Starship, cada una con su velocidad, su altitud y un **esquema de motores** que enciende un círculo por motor en el orden real: los 33 a la vez en el arranque del propulsor V3, 5 en la separación en caliente, y los 6 de la nave); un rótulo que aparece sobre la imagen al cruzar cada hito; un botón **Sound** (apagado por defecto, se recuerda) un botón **Pause** (o **K**, o la barra espaciadora fuera del vuelo libre) que congela el reloj de misión dejando la cámara libre para rodear la escena parada, un selector de velocidad **×¼** (cámara lenta) / ×1 / ×2 / ×5 / ×10 que multiplica el reloj (no salta hitos; el reloj de misión sigue al tiempo real aunque la imagen vaya a pocos fotogramas, y se detiene con la pestaña oculta) un botón **Restart** que vuelve a T−40 y un botón para terminar. Debajo de las cifras hay un **perfil de vuelo**: la altitud de la nave y la del propulsor en toda la misión, en escala de raíz cuadrada para que los 150 m de la captura y los ≈106 km del apogeo del propulsor quepan en la misma gráfica. Lleva una marca por hito y un cursor en el instante actual. Las curvas se muestrean de la misma trayectoria integrada que mueve los vehículos, así que no pueden contradecirse. El perfil es también la **línea de tiempo**: un clic o un arrastre sobre él salta a ese instante, y **←** / **→** van al hito anterior o siguiente. `seek(t)` es determinista (la nube se vuelve a simular desde la ignición), así que un salto cae en el mismo fotograma que se alcanzaría reproduciendo. En pantallas de menos de 560 px de alto se oculta.
- **X** (o el botón *Reentry*) reproduce la **reentrada de la nave del vuelo 14** y su amerizaje en el Pacífico norte, con los tiempos publicados por SpaceX (ver *Reentrada de Starship*). Usa el mismo panel de misión: reloj en horas (T+09:28:56…), fase, siguiente hito, velocidad y altitud de la nave, esquema de motores (3 → 2 → 1 en el encendido de aterrizaje) y perfil de altitud que sirve de línea de tiempo (sin la columna ni la leyenda del propulsor, y con el botón *Reentry* encendido en lugar de *Launch*). Arranca a ×10, porque son 22 minutos. **C** alterna entre realización, cámara a bordo y persecución. **Arrastrar o girar la rueda toma la cámara** como en el lanzamiento: la órbita queda montada en la nave y la sigue en su caída (el botón dice *riding the ship*), y **C** devuelve la cámara a la realización. **K** pausa, **←**/**→** saltan entre hitos y **X** o *End* terminan; también la terminan **G**, elegir un vehículo o la visita guiada. Si se pulsa X paseando, la cámara vuelve al modo órbita.
- **J** (o el botón *F-16 · Fly*) **pilota el F-16** desde donde está, en la cabecera de la pista 28, junto al recinto. Despega, vuela por el mismo mundo de la simulación, sin cambiar de escena, y aterriza. Los mandos son simples:
  - **W/S** son la potencia, como en el coche. Manteniendo **W** en la pista, el motor llega a postcombustión, el avión rota solo hacia los 120 kt, despega y sube el tren. Con el gas al mínimo, **S** frena en tierra y saca los aerofrenos en el aire.
  - **↑/↓** suben y bajan: fijan la trayectoria que el avión mantiene (hasta ±40°). Al soltarlas, sigue subiendo, nivelado o bajando.
  - **A/D** (o **←/→**) inclinan hasta 60° (80° con **Shift**) y el avión tira solo los g del viraje; al soltar, las alas se nivelan. En tierra giran la rueda delantera.
  - **G** baja el tren para aterrizar. Si no se tocan W ni S, el motor y los aerofrenos mantienen 150 kt; cerca del suelo recoge solo, y tras tocar tierra corta gas y frena.
  - **Protecciones** (las de un segundo piloto, y el Auto-GCAS que llevan los F-16 desde 2014):
    - por debajo de 180 kt con el tren arriba, potencia máxima;
    - si va hacia el suelo, nivela las alas y tira hasta subir.
  - **C** cámara (persecución, cabina con HUD, torre, tu órbita), **M** (o el botón *Sound*) sonido, apagado hasta que se enciende, y **Esc** termina y devuelve el avión a su sitio.
  - **Viento:** sopla la brisa del mar del sitio, del SSE, ≈12 kt con ráfagas. El HUD muestra la velocidad sobre el suelo (GS) y el viento (W). En tierra, los mandos simples mantienen el eje de la pista con los pedales.
  - El botón *Simple* de la barra quita la ayuda y da todos los mandos del avión: `R`/`F` gases, `Q`/`E` pedales, `Espacio` frenos, `B` aerofrenos, `Shift` palanca a fondo.
- **B** (o el botón *Porsche · Drive*) **conduce el Porsche 911 GT3 RS** desde su explanada: **W** gas, **S** freno (parado, marcha atrás), **A/D** volante, **Espacio** freno de mano, **T** PSM en tres etapas (encendido de serie; ESC OFF, con el control de tracción; ESC+TC OFF), **C** cámara, **M** sonido (apagado hasta que se enciende), **Enter** vuelve a la explanada, **Esc** termina. Con el PSM el coche va por donde se le dirige y frena recto. Para derrapar, un toque de **Espacio** al entrar en la curva cruza la zaga, y el gas y el contravolante la sostienen; el PSM se aparta mientras el coche va de lado y vuelve al enderezarlo. Los neumáticos dejan marcas.
- **N** (o el botón *H2R · Ride*) **pilota la Kawasaki Ninja H2R** desde su explanada:
  - **W** gas, **S** freno delantero, **Espacio** freno trasero.
  - **A/D** inclinan: la moto contravira sola para tumbarse.
  - **Q/E** bajan y suben de marcha (manual desde la primera pulsación) y **G** vuelve al cambio automático.
  - **T** ayudas: ABS y control de tracción en curva, control de caballito y de elevación de la rueda trasera.
  - **C** cámara (ojos del piloto, persecución, pista, tu órbita), **K** pausa, **M** sonido, **R** levanta la moto, **Enter** vuelve a la explanada y **Esc** termina.
  - **La moto no se cae por inclinarse.** Hay un límite de inclinación: lo que agarran los neumáticos, hasta donde tocan las estriberas. El indicador lo marca y se enciende **LEAN** al llegar.
  - Solo se cae en un choque fuerte y de frente (≈45 km/h de cierre). El piloto nunca deja pasar un caballito ni una frenada del punto de equilibrio, y en agua profunda el motor se ahoga y la moto se queda de pie. **R** (o *Pick up*) la levanta donde está, o en el último sitio seco y libre.
- **Vista general en una ventana alta** (un monitor en vertical): la cámara retrocede por su propia línea de visión hasta que los extremos de la fila caben en el campo horizontal. En una ventana apaisada no cambia nada.
- **`?perf`** en la URL muestra un medidor pequeño: fotogramas por segundo, tiempo medio y percentil 95 de los dos últimos segundos, llamadas de dibujo y triángulos de todo el fotograma (todas las pasadas del compositor), el nivel de calidad y la GPU que declara el navegador. Es la forma de tener cifras de una GPU real: la puerta de CI corre sobre un rasterizador por software.
- Deslizador **Sol** de 4° a 75° de elevación: de la luz rasante y cálida de última hora a mediodía (se recalibran luz, sombras, niebla y mapa de entorno). No hay modo noche: el centro es una exposición de día. La inspección visual de referencia es **18°**: a esa elevación el sol es rasante, la exposición ACES queda en ≈0,72 (0,7 a los 20° de inicio; sigue a la luz a medias, ver *Revisión corriendo la simulación*) y el relleno hemisférico es bajo para que el acero satinado, la pintura blanca, el aluminio y el hormigón no se confundan ni se quemen. El azimut está fijado para iluminar los vehículos desde el lado desde el que miran las vistas por defecto. La simulación **arranca con el sol a 20°**. Antes arrancaba más alto, y con el sol bajo la escena ganaba relieve: sombras largas, el acero y la pintura modelados, menos velo. Se compararon 16°, 20°, 22°, 28° y 42° en los mismos encuadres, y 20° da esa luz rasante sin que las caras en sombra se queden negras.
- En calidad alta, una pasada de **oclusión ambiental** (GTAO de Three.js) oscurece los pliegues y contactos que el sol no sombrea — pasos de rueda, bajos del coche, entre los Raptor, bajo los brazos de la torre —; su radio sigue a la distancia de la cámara, de unos 35 cm junto al Roadster a varios metros en la vista de Starship, y se apaga en el vuelo y en órbita. Se calcula a resolución completa: a media resolución, reescalada, se derramaba sobre los bordes de profundidad y dejaba un halo gris dentado alrededor de lo claro que tiene detrás algo oscuro (el traje de Starman contra el asiento, visto de cerca), y su grosor es el 30 % del radio para que una superficie lejana detrás de un objeto fino no cuente como si lo tapara.

## Precisión y fuentes

Cada cifra de la ficha técnica lleva su procedencia:

- `spacex.com` — valores publicados en las páginas oficiales de cada vehículo.
- `Wikipedia` — artículo del vehículo, que a su vez cita a SpaceX/NSF (altura de etapas, número de losetas, grid fins de Block 3, dimensiones de la cápsula Dragon…).
- `prensa` — Spaceflight Now / Space.com para el Starlink V2 Mini y el tamaño de loseta; NASASpaceflight y Space Explored para el Pad 2.
- `derivado` — calculado a partir de las anteriores.
- **≈** — sin valor público exacto; reconstruido a partir de fotografías. Cada vehículo lista explícitamente estos elementos en *Elementos aproximados*.

### Datos derivados, no inventados

Donde SpaceX no publica una cota, el modelo la deriva de algo que sí está publicado, y lo dice:

- **Estaciones de sección de Starship**: múltiplos enteros del anillo de acero de 1,83 m (faldón 3,5 anillos, base del morro en el anillo 21).
- **Reparto de tanques**: de las masas de propelente publicadas a densidad criogénica — 59 % / 41 % del volumen en Super Heavy, 57 % / 43 % en la nave.
- **Sección de tanques del Falcon 9**: 34,5 m = los 41,2 m de primera etapa menos la interetapa. Los 41,2 m publicados **incluyen** la interetapa; apilarla encima alargaría el propulsor un 16 %.
- **Separación entre núcleos del Falcon Heavy**: 4,25 m, de los 12,2 m de anchura y los 3,7 m de diámetro.
- **Reparto de la Dragon**: 3,7 m de trunk + 4,4 m de cápsula = los 8,1 m declarados; la cápsula se ensancha a 4 m en el hombro del escudo, que es de donde sale el diámetro publicado.

### Comparación con fotografías

Donde no hay cota publicada, la forma se mide contra fotografías en lugar de estimarse de memoria. El caso más claro es el Roadster: un render ortográfico lateral se superpone a una foto de perfil del coche a la misma escala (los centros de rueda como puntos de registro y los 1,128 m publicados como comprobación). De ahí salen la línea superior en cuña — ~0,88 m en la cadera trasera, ~0,72 m en las puertas, ~0,66–0,70 m en la aleta delantera —, la posición de la cabina y del parabrisas, la toma lateral en media luna tras la puerta, las tres lamas escalonadas del capó, el arco antivuelco único de carbono y el tamaño de faros y pilotos. Estas cotas son estimaciones fotográficas y la ficha las marca como aproximadas.

La trasera se rehízo con el mismo método, contra una foto trasera recta y una de tres cuartos traseros, usando la lente de 0,115 m del piloto de freno como regla. Ya no es una placa plana con dos almendras: son tres superficies apiladas — el **paragolpes** en color carrocería, que se abomba hacia atrás y se recoge hacia el difusor negro de malla y lleva estampado el hueco de matrícula (vacío: el coche voló sin placa); encima, un **escalón** nítido y la **banda de pilotos** metida ~4 cm, con una carcasa negra por lado que va de ~0,34 m del eje hasta la esquina; y el **labio** en cola de pato con el que termina la tapa. Cada carcasa lleva tres ópticas redondas de ~11, 9,5 y 6 cm con lente transparente facetada sobre reflector cromado y el centro rojo en la de freno, como en las fotos; y tras cada paso de rueda, el catadióptrico lateral rojo. La cara trasera es un campo de alturas z(x, y) mallado en rejilla de alzado, de modo que el escalón, el labio y el hueco de matrícula quedan como líneas limpias. La anterior tenía además la cara hundida en el centro y 26 mm de hueco entre la cara y su borde redondeado, lo que alargaba el coche 2,5 cm; ahora mide lo declarado.

El trunk de la Dragon lleva los radiadores en la mitad de la escotilla y las células solares en la de la bisagra del cono, como en las fotos de la NASA. La vista principal mira al lado de la escotilla, y la vista «Trunk and solar cells», al de las células.

### Auditoría y mejoras del 28 de septiembre de 2026

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

### Lanzamiento, segunda ronda del 28 de septiembre de 2026

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

### Tercera ronda del 28 y 29 de septiembre de 2026

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

### Ronda de fuentes del 29 de septiembre de 2026

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

### Ronda de realismo del 29 de septiembre de 2026 (planos del Pad 2 y V3)

Con las huellas de OpenStreetMap del sitio de lanzamiento (leídas por su API; trazadas por la comunidad sobre imagen de satélite, © colaboradores de OpenStreetMap, ODbL) pasadas al marco de la zanja, un artículo de NASASpaceflight sobre el Pad 2 y los valores de reflectancia de physicallybased.info:

- **La torre ya no está a escuadra con la zanja.** En el Pad 2 la línea torre–mesa corta el eje de la zanja a **≈52,5°** (en el Pad 1, ≈55°), con la torre a ≈31 m del centro de una zanja de ≈84 × 18 m. La torre, sus brazos, su mástil y la pila giran juntos −37,5° (`STACK_YAW_DEG`, `PAD.towerYawDeg`); la zanja, la mesa y el resto del complejo no. Los pines del propulsor siguen cayendo sobre los brazos (comprobado: 0,0° de desvío, 0,34 m sobre el carril). Las vistas *Launch complex* y *Tower and arms* giran con la torre. Es ≈: huellas trazadas, no un levantamiento.
- **Tanques de agua del deluge:** 11 horizontales del lado de la torre, cinco de ≈39,4 m y seis de ≈26,1 m, ≈3,45 m de diámetro; suman ≈842 000 galones, dos operaciones de los ≈422 000 que la evaluación de la FAA asigna a cada lanzamiento (citada por NASASpaceflight). Antes eran un número y un tamaño reconstruidos.
- **Parque de propelentes:** filas de tanques horizontales de ≈48,6 × 5,8 m (10 de oxígeno líquido, 8 de nitrógeno líquido, 8 de metano, con los tamaños de los que difieren), con vaporizadores atmosféricos, en lugar de la fila vertical reconstruida. La fila se coloca junto a la plataforma y no a 200–400 m, donde cruzaría la fila de expositores; alturas, cabezas y cunas son reconstruidas.
- **Encendido simultáneo de los 33 motores** en el propulsor V3 (Block 3), en lugar del arranque escalonado 3 → 13 → 33 de los primeros bloques: el fuego de la zanja, el esquema de motores del panel y el golpe del sonido lo siguen.
- **Color del acero inoxidable:** los mapas del casco son grises neutros; el color del metal lleva ahora el matiz medido del inoxidable (reflectancia lineal 0,669 / 0,639 / 0,598, physicallybased.info), normalizado a su luminancia para que el brillo siga siendo el de los mapas. Es un cambio sutil, levemente cálido.

### Segunda ronda de realismo del 29 de septiembre de 2026 (la Tierra real y el regreso)

- **La Tierra que se ve desde la nave es la real.** Antes era una esfera con continentes de ruido al azar. Ahora lleva las costas de Natural Earth (tierra 1:10m menos lagos 1:50m, dominio público) y el color del mosaico sin nubes *Blue Marble Next Generation* de la NASA (agosto de 2004, recortado al golfo a ≈3 km por píxel, `src/assets/earth/gulf-bmng.jpg`). La esfera se coloca llevando el marco geográfico del Pad 2 (25,9965° N, 97,157° O) por el círculo máximo hasta el punto bajo la cámara, con el eje aguas abajo en un azimut de **≈100,8°**. Ese azimut no está publicado: se deduce de la inclinación de 28° del vuelo 12 (Wikipedia), cuyo arco sigue la nave, con sin(az) = cos 28° / cos 26,0° y la raíz del sur, porque ese vuelo fue «más al sur» para dejar los restos sobre el Caribe abierto; no incluye la rotación terrestre. Al apagar, la nave está sobre el golfo con Cuba, las Bahamas y Florida por delante; desde el propulsor se ve la costa de Texas y Tamaulipas. El agua profunda es de un solo color (el mosaico tiene costuras entre teselas en el océano abierto) y solo pasan del mosaico los bancos someros; hay reflejo del sol en el agua. La bruma mirando hacia abajo es ahora un tercio de la del horizonte: con el brillo del cielo en la vertical, el golfo salía gris azulado claro, cuando en las fotos desde órbita es azul marino. Las nubes siguen siendo genéricas, y la costa local del sitio 1:1 es plausible, no la real, así que entre 9 y 20 km, mientras una se funde con la otra, no tienen por qué coincidir.
- **Humo del encendido de aterrizaje:** era una columna gris opaca sobre el propulsor. En la foto de SpaceX de la aproximación final del vuelo 5 (Commons, 54063904149) es una estela parda y tenue que se abre y deriva hacia un lado. Ahora tiene opacidad 0,05 (antes 0,2), 70 bocanadas de 24 m por fuente (antes 170 de 21 m), más crecimiento y deriva con el viento. Vista desde abajo, la cámara mira a lo largo de la estela, y cientos de bocanadas en la misma visual se sumaban hasta taparlo todo fuera cual fuera la opacidad de cada una.
- **Separación en caliente:** los 24 chorros de los respiraderos acababan en rojo anaranjado durante el 70 % de su longitud, y el anillo de fuego se leía como una estrella roja de púas. Ahora terminan en naranja amarillento, y el borde del resplandor también.
- **Penachos en el vacío:** el halo era pervinca (con tanto rojo como verde) y bajo ACES salía lila. Ahora es azul frío.

**Lo que no se pudo leer:** overpass-api.de y web.archive.org no responden a través del proxy; oeaaa.faa.gov (expedientes de obstáculos de la FAA) deniega el acceso a clientes automatizados y no se ha intentado eludir; matweb y engineeringtoolbox solo sirven en `www.`, que no está en la lista de dominios.

### Ronda vehículo por vehículo del 29 de septiembre de 2026 (fotos de la NASA)

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

### Reorientación de la costa (29 de septiembre de 2026)

La escena ya estaba orientada con la geografía para el vuelo: su eje +X es el rumbo de lanzamiento, ≈100,8°, y la Tierra real que se ve desde altura se coloca con ese eje. **La costa local, en cambio, estaba girada 90°**: la playa corría a lo largo de la fila de expositores, con el mar al −Z de la escena, que en ese marco es el **NNE** (≈10,8°). En Boca Chica la playa va casi de norte a sur, desde la desembocadura del Bravo hasta el paso de Brazos Santiago, con el Golfo al **este**. Por eso el cohete volaba paralelo a la playa, en vez de salir mar adentro como en todos los vuelos, y entre 9 y 20 km de altura la costa local y la del globo no coincidían.

Ahora la playa, el mar, las dunas y las exclusiones de vegetación se construyen en un **marco de costa** (`toCoast`/`fromCoast`/`seaward` en `terrain.js`) girado para que la normal hacia el mar tenga un **azimut de ≈85,3°**. Es la orientación de la costa de Natural Earth entre 25,97° N y 26,08° N, la que ya lleva el proyecto en `data/gulf.js`, que corre a ≈355°. El marco está centrado en el Pad 2, así que la distancia al agua (≈485 m desde la mesa) no cambia. La tendencia artificial de la línea de costa (un 22 % de pendiente respecto a la fila) se quita, porque la orientación ya es la real. Lo que se ve:

- el mar queda al este, a la derecha de la vista general;
- el cohete **despega hacia el mar**;
- el propulsor **vuelve desde el mar** hacia los brazos, que se abren hacia ese lado;
- la costa local enlaza con la del globo.

El recinto (la fila, los viales, la plataforma) no se mueve: lo que gira es el paisaje que lo rodea.

### Reentrada de Starship (vuelo 14, 29 de septiembre de 2026)

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

### Auditoría del 30 de septiembre de 2026

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

### El X-15 se retira; viene un F-16 (1 de octubre de 2026)

Entre el 30 de septiembre y el 1 de octubre se construyó un X-15 #1 (56-6670) volable, en siete fases y una revisión. El usuario lo probó y decidió quitarlo: el avión real se soltaba desde un B-52, no despegaba por sí mismo, quemaba todo su propulsante en 85 s y planeaba sin motor hasta aterrizar sobre patines. Para el vuelo que se busca —despegar de una pista, volar en el entorno de la simulación sin cambios de escenario y aterrizar— ponía demasiadas trabas.

- **Qué se ha quitado:**
  - el expositor del X-15 y su modo de vuelo, sus instrumentos y su cabina;
  - la pista 13/31 del noroeste;
  - el terreno de imagen de satélite de alrededor;
  - el chorro del XLR99, el calentamiento y el sonido del vuelo;
  - sus pruebas (`x15-check`) y su documentación.

  El historial de git los conserva: commits del `5f77233` al `f688ba8`.
- **Qué se conserva, porque no era del X-15:**
  - **Etiquetas en la reentrada:** las del pad ya no vuelven sobre el Pacífico durante la reentrada. Antes, `launch.reset` con el lanzamiento parado decía a la vista que el vehículo había vuelto a su soporte. Ahora los ganchos de visibilidad miran si alguna secuencia sigue en marcha, y `ux-check` lo comprueba.
  - **Prueba de arrastre en la reentrada:** la de `ux-check` pedía que la nave cayera más de 100 m. En un ejecutor lento de CI midió 1,7 s y la nave cayó justo 100 m, así que falló sin que nada estuviera mal. Ahora pide al menos 25 m/s.
  - **Espera de `ux-check`:** la altura del panel del lanzamiento espera 60 s, como las demás esperas ligadas a fotogramas.
- **Lo que viene:** un **F-16A Block 15** con su propia pista. Despegará, volará dentro del entorno de la simulación, ampliado con el mismo estilo de suelo, y aterrizará. Su modelo de vuelo saldrá de los datos públicos de la NASA: TP-1538 (aerodinámica a baja velocidad hasta 90° de ángulo de ataque, motor y mandos de vuelo) y TP-3355 (supersónico, Mach 1,6 a 2,16).

### F-16, fase 2: el entorno ampliado (1 de octubre de 2026)

Un caza cruza el disco del recinto (2,5 km de radio) en pocos segundos. Para que despegue, vuele y aterrice sin cambiar nunca de escenario, el mismo paisaje sigue ahora **hasta 450 km** (`src/core/outerGround.js`):
- **Tierra:** la del disco. Una sola función (`groundSample` en `environment.js`) da a los dos la altura, la cubierta, la playa y los canales de marea de `terrain.js`, con el mismo material de terreno, así que se juntan en el borde como una sola llanura. Las lomas siguen donde estaban; más allá queda el microrrelieve de la llanura. Verosímil, como el disco, no un levantamiento.
- **Mar:** la superficie del agua del disco continúa, con el mismo material, con su plataforma y su rompiente graduadas por la distancia a la costa. Tierra y mar solo se solapan en la costa. Así el búfer de profundidad nunca tiene que separar, a cientos de kilómetros, dos superficies a pocos metros una de otra.
- **Curvatura:** la Tierra es redonda. A partir del borde del disco el suelo baja ρ²/(R + √(R² − ρ²)), con R = 6371 km, contado desde el borde para que empalme. Desde 10 km de altura el horizonte cae a 357 km y 3,2° por debajo de la horizontal, donde corresponde; el disco plano se separa de la esfera 0,5 m en su borde.
- **Celdas:** crecen con la distancia y son cuadradas en planta (un 2,45 % del radio: ≈60 m en el borde del disco, ≈11 km en el borde exterior). En total son ≈111.000 triángulos, sin materiales ni texturas nuevos.
- **Bruma de vuelo:** la niebla del museo deja unos pocos kilómetros de visibilidad y pondría un muro blanco alrededor de un avión. En vuelo (`env.setAltitude(h, { flight: true })`) la bruma da ≈40 km de visibilidad a nivel del suelo y se aclara con la densidad del aire (escala de 8 km). El suelo de debajo se ve nítido y el horizonte se funde en ella a cualquier altura (≈, un día claro de costa). En vuelo el disco tampoco se estira.
- **Lanzamiento y reentrada:** siguen como estaban, con su disco estirado y su globo; el anillo no se dibuja mientras corren, ni en órbita.

### F-16, fase 3: el modelo exterior (1 de octubre de 2026)

El F-16A Block 15 ya está en el centro, a escala 1:1 (`src/vehicles/f16.js`, datos en `src/data/f16.js`, acabado en `src/materials/f16Textures.js`). Está sobre su tren, en la cabecera de la pista 13, a 40 m del umbral y alineado con ella. La pista se dibuja en la fase 4; por ahora el terreno de debajo ya está allanado y sin matorral.

- **Medidas publicadas (grado A):**
  - **15,038 m** de largo, de la punta de la sonda del morro al borde de salida de la deriva: el modelo acotado de TP-3355 (39,47 in a escala 1/15).
  - **9,144 m** de envergadura (30 ft) sin los lanzadores de punta de ala.
  - **5,01 m** de alto sobre el tren: TP-1538, figura 2.
  - El ala sale de TP-1538, tabla I, y de TP-3355, tabla II: 27,87 m² (300 ft²), alargamiento 3,0, estrechamiento 0,2275, flecha de 40° en el borde de ataque, cuerda media de 3,45 m (11,32 ft) y perfil NACA 64A204. Es un trapecio con el borde de salida recto; sus cuerdas, de 4,966 y 1,130 m, se derivan de esas cifras.
  - El estabilizador, la deriva y las aletas ventrales salen de TP-3355, tabla II: área, envergadura, cuerda media y flecha.
  - Los recorridos de los mandos salen de TP-1538, tabla I: flaperones ±21,5°, flaps de borde de ataque 0–25°, frenos aerodinámicos hasta 60°.
  - La toma de aire tiene 0,533 m² y la tobera 0,402 m² de salida (TP-3355).
- **Reconstruido (≈):**
  - Las secciones del fuselaje se calcaron de las tres vistas acotadas de TP-3355: alto, fondo, anchura, quilla y toma.
  - Los hombros anchos del cuerpo fusionado se mezclan entre 4,5 y 6,5 m con una cúbica sacada de fotografías.
  - El 64A204 es el 64A006 de NACA TN-1368 escalado al 4 % con una línea media a = 1 (la diferencia con la a = 0,8 modificada es menor del 0,2 % de la cuerda).
  - El tren (batalla 4,00 m, vía 2,36 m, neumáticos de 27,75×8,75 in y 18×5,7 in), la cabina (tina, panel, visera, combinador del HUD y asiento ACES II) y el lanzador de punta de ala.
- **Acabado:**
  - Gris de superioridad aérea de la USAF: FS 36270 encima y FS 36375 en los costados y debajo, con la línea entre los dos pulverizada; el radomo, más oscuro. Los valores sRGB aproximan las muestras FS (≈).
  - Costuras, paneles de acceso, remaches y la boca del cañón M61 a la izquierda. Sin insignias ni marcas de unidad, como manda la norma del centro sobre banderas y logotipos.
- **Nada transparente por dentro:**
  - La toma es un conducto oscuro que se estrecha hasta la cara del fan, un disco macizo.
  - La tobera lleva al fondo la cara de la turbina, también maciza.
  - Desde ningún ángulo se ve el cielo a través del avión. Este fue el fallo más grave del X-15.
- **Partes móviles:** los flaps de borde de ataque, los flaperones, el estabilizador, el timón y los frenos aerodinámicos son grupos con su eje de bisagra y su recorrido, listos para el modelo de vuelo de la fase 5.
- **Comprobaciones:** `verify()` mide en la escena el largo, la envergadura y la altura contra las tres cifras de grado A. La tabla de arriba y la ficha se validan con `provenance-check`.

### F-16, fase 4: la pista (1 de octubre de 2026)

El F-16 tiene su propio complejo, como Starship tiene el suyo: una pista con su calle de rodaje y una plataforma pequeña, en la llanura al noroeste del recinto (`src/core/runway.js`). Es una pista con detalle, **no un aeropuerto**: no hay terminal, hangares, torre ni edificios.

- **Pista 13/31:**
  - 9.000 × 150 ft (2.743 × 45,7 m) de asfalto, con arcenes pavimentados de ≈25 ft. Es un tamaño corriente en una base de cazas; no se dibuja ninguna pista concreta (≈).
  - Rumbo verdadero 130,8° (de ahí el 13).
  - Bombeo del 1 % desde el eje (≈) y una franja más oscura de caucho en cada zona de toma de contacto (≈).
- **Marcas, según la FAA** (AC 150/5340-1M, *Standards for Airport Markings*, 2019, con el cambio 1 de 2020; pista de precisión de 150 ft, figura A-1):
  - **Umbral:** 12 franjas de 150 × 5,75 ft con huecos de 5,75 ft, el par central a 11,5 ft, a 20 ft del umbral.
  - **Números:** de 60 ft de alto, 40 ft después de las franjas. El trazo de los números (5 ft) es aproximado a la figura A-6.
  - **Eje:** trazos de 120 ft, huecos de 80 ft y 36 in de ancho. La AC ajusta el patrón en el centro de la pista; aquí los huecos se igualan a lo largo (≈).
  - **Punto de visada:** dos barras de 150 × 30 ft a 1.020 ft, con 72 ft entre sus caras interiores.
  - **Zona de toma de contacto:** barras de 75 × 6 ft separadas 5 ft, en grupos de 3, 3, 2, 2 y 1 cada 500 ft. Una pista de 9.000 ft lleva el juego completo en las dos cabeceras (tabla 2-4).
  - **Bordes:** líneas de 3 ft en toda la longitud.
  - **Calle de rodaje:** eje amarillo de 6 in, bordes dobles de 6 in y la marca de punto de espera de patrón A (dos líneas continuas y dos discontinuas de 12 in). Está a 250 ft del eje de la pista, una distancia habitual para cazas (≈).
- **Luces y manga (≈, verosímiles, sin plano):**
  - Luces de borde elevadas cada 200 ft (el máximo de AC 150/5340-30).
  - Luces de umbral y de final en cada cabecera.
  - Un PAPI de cuatro unidades a la izquierda de cada cabecera, a 50 ft del borde.
  - Una manga naranja de 12 ft que apunta al noroeste, con la brisa del sureste de la costa.
  - De día las luces se ven como vidrio; no hay modo noche.
- **El F-16** está a 40 m dentro del umbral de la 13, sobre el bombeo, alineado para despegar hacia el sureste. La ficha tiene una vista nueva, *Runway 13*.
- **Presupuesto:** dos materiales nuevos (las lentes, con el color por instancia, y la tela de la manga) y ninguna textura nueva. El asfalto, el hormigón y la pintura reutilizan los mapas de la carretera y del recinto.

### F-16, fase 5: el modelo de vuelo (1 de octubre de 2026)

El F-16 ya tiene un modelo de vuelo de seis grados de libertad, de sólido rígido, que funciona igual sobre las ruedas que en el aire y siempre en el mundo de la simulación (`src/sim/f16Flight.js`, datos en `src/data/f16Aero.js`). Todavía no se puede pilotar: los mandos, las cámaras y la cabina llegan en la fase 6.

- **Lo que viene de la NASA:**
  - **Aerodinámica:** los polinomios globales de Morelli (NASA Langley, 1998), ajustados a la base de datos de túnel de TP-1538: maqueta al 16 %, Mach < 0,6, α de −10° a 45°, β ±30°. Son las seis fuerzas y momentos con sus derivadas de amortiguamiento y de mando. Las tablas III de TP-1538 están escaneadas con poca calidad y el OCR no las lee bien; los polinomios, publicados con todos sus coeficientes, son la misma base de datos en forma compacta, con menos del 10 % de diferencia en una maniobra.
  - **Masa e inercias:** tabla I de TP-1538, 20.500 lb.
  - **Motor:** tabla VI de TP-1538, el empuje instalado del F100 al ralentí, a régimen militar y con postcombustión máxima, de 0 a 15.240 m y de Mach 0,2 a 1,0.
  - **Mandos de vuelo:** apéndice A de TP-1538. Mando de factor de carga con la velocidad de cabeceo lavada y un integrador; limitador de α de −0,322 g/° entre 15° y 20,4° y de −1,322 g/° por encima, que deja el α en unos 25°. Mando de velocidad de alabeo hasta 308°/s, con 1° de cola diferencial por cada 4° de alerón. Amortiguador de guiñada sobre r − pα e interconexión alerón-timón de 0,075/°. El pedal se anula entre 20° y 30° de α. La ley del flap de borde de ataque y los actuadores son los publicados: 0,0495 s; 60, 80 y 120°/s; ±25°, ±21,5° y ±30°.
  - **Atmósfera:** la estándar de EE. UU. de 1976, hasta 20 km.
- **Lo que es aproximado (≈), todo en la cabecera del código:**
  - **Por encima de Mach 0,6:** no hay datos públicos del F-16 entre Mach 0,6 y 1,6. La pendiente de sustentación sigue una fórmula de tipo DATCOM para alargamiento 3 hasta la teoría lineal supersónica, y la resistencia de onda sube ≈0,028 cerca de Mach 1.
  - **Empuje:** más allá de Mach 1 se extrapola la última pendiente de la tabla, cada vez menor; arriba de 15.240 m, con la densidad.
  - **Motor:** ≈4 s del ralentí al régimen militar.
  - **Ganancias:** las del sistema de mando están ajustadas aquí, no publicadas. Dos lazos no están en TP-1538: la compensación del acoplamiento inercial en cabeceo, porque a 300°/s el término (Ix − Iz)·p·r levantaba el morro, y la realimentación de deriva en lugar de la de aceleración lateral.
  - **Tren:** amortiguadores de muelle, fricción de neumáticos, frenos y dirección de la rueda delantera. Se rompe por encima de unas 8 veces la carga estática (≈5 m/s de descenso).
  - **Sin** efecto suelo, viento ni consumo de combustible.
- **Comprobado sin navegador (`tools/f16-check.mjs`, dentro de `npm run check`).** Un piloto automático pequeño pilota cada caso con los mismos mandos que tendrá el jugador:
  - **En reposo:** las cargas de las ruedas suman el peso; el morro lleva el 13,5 % con el motor al ralentí.
  - **Despegue con postcombustión:** rota a 136 kt y despega a 184 kt en 466 m (1.528 ft).
  - **Vuelo nivelado** a Mach 0,6 y 3.000 m, con 0,9° de α.
  - **Alabeo con la palanca a fondo:** unos 300°/s, que paran al soltar.
  - **Palanca a fondo atrás:** el α se queda en 25,6°.
  - **Supersónico** a 11.000 m: Mach 1,5 a los 65 s y Mach 2,0 a los 200 s.
  - **Aterrizaje:** final de 3° a 12° de α y recogida con motor. Toca a 137 kt con 2,4 m/s de descenso y para en 870 m (≈2.850 ft) con frenos y aerofrenos.
  - **Toma dura:** a 7 m/s rompe el tren.

### F-16, fase 6: el modo de vuelo (1 de octubre de 2026)

El F-16 se pilota (`src/sim/f16Fly.js`, HUD en `src/ui/f16Hud.js`). **J** o *F-16 · Fly* empiezan donde está el expositor: en la cabecera de la pista 13, con los frenos puestos y el motor al ralentí. El avión que vuela es el mismo del expositor; al terminar vuelve a su sitio exacto.

- **Sin cambios de escena:** se despega, se vuela y se aterriza en el mundo de siempre.
  - El recinto, la pista, la costa y el suelo ampliado hasta 450 km son los que se ven paseando.
  - El suelo bajo las ruedas es el que se dibuja: el pavimento de la pista (con su bombeo), la función de altura del terreno con la playa y el mar, y más allá del disco la caída por la curvatura.
  - La bruma de vuelo y los planos de recorte siguen a la altura de la cámara.
- **Mandos:** los del F-16 (palanca, pedales, gases con postcombustión, frenos, aerofrenos y tren), con las leyes de mando de la fase 5, en el teclado o en un mando de juego.
  - En el teclado, la palanca sale a un ritmo y se centra al soltarla. Por defecto llega a media carrera (4 g); con `Shift`, a la carrera completa (≈, propio de esta simulación).
  - El tren no se sube con peso en las ruedas.
- **Cámaras (`C`):**
  - **Persecución:** detrás de la trayectoria, siguiendo los virajes.
  - **Cabina:** el ojo del piloto en su asiento (≈), con el HUD conforme con el mundo.
  - **Torre:** junto a la zona de toma de contacto de la 13, con zoom.
  - **Tu órbita:** montada en el avión.
- **HUD** (simbología del F-16 en su tipo, ≈, verde):
  - Marcador de trayectoria y escalera de cabeceo cada 5° (continua sobre el horizonte, discontinua bajo él).
  - Velocidad calibrada en nudos a la izquierda y altitud en pies a la derecha; rumbo arriba (131 en la cabecera de la 13).
  - Carga en g, Mach y α; velocidad vertical, radioaltímetro y potencia o postcombustión.
  - Configuración (tren, aerofrenos, frenos) y avisos (tren arriba cerca del suelo, α alto, *pull up*).
  - Desde fuera de la cabina se ve en un recuadro arriba a la derecha, para no tapar el avión.
- **Superficies vivas:** estabilizadores (juntos y diferenciales), flaperones (con el tren bajado caen 20°, ≈), flaps de borde de ataque según su ley, timón y aerofrenos se mueven con lo que manda el sistema de vuelo.
  - El tren desaparece al subirlo (≈: no hay animación de recogida ni compuertas).
  - La postcombustión enciende una llama aditiva en la tobera (≈, un efecto visual) que solo existe en vuelo, para que no cuente en la longitud medida.
- **Toma y final:**
  - La toma se anota con su velocidad de descenso, su velocidad y si fue sobre el pavimento.
  - Al pararse, el panel dice dónde, respecto al umbral y al eje.
  - Choque: un punto de la estructura toca el suelo; tren roto: más de ≈5 m/s de descenso; aterrizar sin tren; caer al agua. En todos los casos, `Intro` vuelve a la pista y `Esc` termina.
- **Comprobado en el navegador (`ux-check`):**
  - J empieza en la pista, sobre las ruedas, con el HUD y en la misma escena.
  - Las teclas numéricas no sacan del avión.
  - Con postcombustión despega y sube por encima de 300 m sobre el mismo mundo, con el suelo exterior visible.
  - C pasa a la cabina.
  - Esc deja el avión en su sitio, con la cámara y la escena como estaban.
- **Sin sonido** por ahora.

### F-16, fase 7: revisión (1 de octubre de 2026)

- **Freno de estacionamiento al empezar.** Al ralentí, el F100 empuja 2,8 kN, más de lo que frena la rodadura de los neumáticos (≈1,8 kN). En cuanto se soltaba el freno inicial, el avión echaba a rodar solo. Ahora el freno de estacionamiento lo sujeta hasta que se dan gases.
- **El cartel de la toma se retira** al volver a rodar después de pararse.
- **Velocidad calibrada en el HUD.** Antes era la equivalente, que sale de la presión dinámica como si el aire fuera incompresible. Ahora sale de la presión de impacto del tubo de Pitot: isentrópica por debajo de Mach 1, con la fórmula de Rayleigh por encima, y convertida a nivel del mar estándar, como la lee el anemómetro. A Mach 0,8 y 30.000 ft marca 304 kt, igual que las tablas.
- **La galería de capturas no se ha regenerado**, a la espera de la confirmación del usuario.

### F-16: el vuelo iba a cámara lenta (1 de octubre de 2026)

El usuario lo probó y el avión iba «súper lento». El motivo: el vuelo avanzaba con el paso de tiempo de la cámara, que está limitado a 0,05 s por fotograma para que la cámara no salte tras un parón. Por debajo de 20 fotogramas por segundo, que es lo normal con esta escena en muchos ordenadores, todo el vuelo iba más despacio que el tiempo real: a 10 fps, a la mitad; a 5 fps, a un cuarto. Ahora el vuelo usa el tiempo real, como el lanzamiento de Starship, y `ux-check` comprueba que su reloj sigue al reloj de pared con el renderizador por software de la comprobación.

También es más claro cómo se da gas:
- en tierra y al ralentí, un aviso en el centro de la vista: *Hold R for throttle · S to rotate at 135 kt*;
- además de `R`/`F`, sirven `Re Pág`/`Av Pág`;
- la palanca de gases corre más deprisa: media carrera por segundo.

**Cómo despegar:**
1. Mantén **R** unos dos segundos hasta pasar el 77 %: entra la postcombustión y se suelta el freno de estacionamiento.
2. A unos **135 kt** mantén **S** (con `Shift`, palanca a fondo) hasta unos 12° de cabeceo.
3. El avión despega hacia los 180 kt.
4. Sube el tren con **G**.

### F-16: mandos simples (1 de octubre de 2026)

El usuario encontró el avión demasiado complejo de pilotar, así que ahora se vuela con **W A S D y G** (más C para la cámara y Esc para salir). El avión, su modelo de vuelo y sus leyes de mando no cambian. Lo que cambia es que una ayuda hace, como un segundo piloto, lo que cuesta a quien empieza:
- **El despegue entero con W** (histórico, rehecho el 2 de octubre: ver *Conducción del Porsche y vuelo del F-16, revisados*): motor a fondo, frenos fuera, rotación a 140 kt hasta 10° de cabeceo (nunca más de 11°, para no tocar con la tobera), ese ángulo en el ascenso y el tren arriba a 60 m.
- **A/D ordenan una inclinación**, hasta 60°, en vez de una velocidad de alabeo. Con la ley del avión, 1 s de tecla eran más de 180° de giro. Al soltar, las alas vuelven a nivel.
- **Al soltar W/S, vuelo nivelado**, con el tirón que pide el viraje.
- **El motor solo:** mantiene 350 kt, o 145 kt con el tren bajado, y saca los aerofrenos si con el tren abajo va rápido. Tras tocar tierra pasa a ralentí y frena.

Además se corrigió el alabeo del HUD visto desde fuera, que mostraba el cabeceo.

### F-16: viraje directo, pista más cerca y modelo revisado (1 de octubre de 2026)

El usuario no quería la estabilización automática y le costaba virar. Además, la pista quedaba demasiado lejos y el modelo tenía defectos a la vista, sobre todo la tobera por detrás.
- **Viraje directo.** A/D cambian la inclinación a 90°/s mientras se pulsan, hasta 80°, y el avión se queda inclinado al soltar. Sin nivelación de alas ni mantenimiento de altura. Con 0,8 s de D el avión pasa a 72° y gira unos 8,5°/s. El cabeceo añade solo el tirón que necesita el viraje.
- **La pista, junto al recinto.** Sigue siendo el mismo complejo (pista, rodaje, plataforma, PAPI, luces y manga), pero se movió a la zona llana más cercana a la fila. La buscó un script: dentro de 2,35 km, a 320 m o más de la costa y sin pisar el recinto, el pad ni las charcas. Ahora es la **10/28**, de **8.000 × 150 ft (2.438 × 45,7 m)**, con rumbo verdadero 100,8°/280,8°. Su extremo este queda a unos 500 m de la fila. Los 9.000 ft de antes no cabían. El F-16 espera en la cabecera 28, y numerales, manga, cámara de torre y textos siguen a la pista.
- **Tobera rehecha** a partir de la foto de dominio público de la USAF «F16 Pratt & Whitney F100 nozzle maintenance»:
  - un carenado de cierre desde el último anillo del fuselaje;
  - la carcasa de 16 pétalos con sus juntas y herrajes;
  - un borde de salida macizo;
  - los flaps interiores hasta la garganta;
  - el revestimiento de la postcombustión, los estabilizadores de llama y la cara de la turbina.

  Antes, el borde y la carcasa eran un mismo tubo cuyas caras miraban hacia dentro, así que desde atrás se veían agujeros y, a través de ellos, las juntas del lado contrario. Medidas ≈, en reposo.
- **Booms y aerofrenos.** Las cajas se sustituyen por un carenado redondeado que nace del costado del fuselaje bajo el estabilizador. Sus últimos 0,75 m (≈) son el aerofreno de concha: dos pétalos, uno arriba y otro abajo, que abren 60°, cada uno con su cara interior y el herraje del actuador. Antes, los pétalos del lado derecho se abrían al revés y se cruzaban.
- **Tren.** Cada pata lleva:
  - el cilindro del amortiguador y su vástago cromado;
  - los compases de torsión;
  - la horquilla de la rueda delantera y el faro del tren de morro;
  - en el tren principal, el tirante de arrastre.

  Los neumáticos tienen perfil real de talón a talón, con llanta, pestañas, buje y pernos. El freno queda hacia el avión. Las compuertas siguen la pata. Tamaños de rueda publicados; todo lo demás, ≈.
- **Detalles.** Sondas de ángulo de ataque a cada lado del morro y antenas de pala en el lomo y bajo la toma (posiciones ≈).

### Porsche 911 GT3 RS, fase 1: el circuito y la explanada (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, fase 2: el coche y la conducción (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, fase 3: revisión (2 de octubre de 2026)

- **Morro y cola planos con placas.** Las zonas negras del morro y de la cola eran regiones de los triángulos de sus tapas, y sus bordes salían escalonados. La franja de luces se veía a trazos. Ahora cada tapa es plana y lleva sus piezas como placas de contorno exacto: la toma central con tres lamas, las tomas de las esquinas, el panel negro inferior, la franja roja, los grupos ópticos y los catadióptricos.
- **Bordes de los cristales laterales.** Sus juntas negras siguen ahora los bordes exactos, inclinados incluidos. La banda de las ventanillas tiene filas cada centímetro, y el montante B es negro.
- **Faros.** La lente reflejaba tanto cielo que el faro parecía un disco blanco. Ahora la lente es más discreta, el reflector es oscuro y destacan los cuatro puntos LED.
- **Marcas de neumático.** Solo se veían a ratos: cada segmento se orientaba según el sentido de la marcha y la mitad quedaban boca abajo, así que se descartaban. Ahora son de doble cara, más oscuras y mates, y la explanada es algo más clara para que contrasten.
- **Humo de neumáticos.** Al derrapar o patinar sobre superficie dura salen bocanadas grises que crecen, suben y se desvanecen (≈, un efecto visual).
- **Vista *The circuit*.** Miraba al lado contrario desde que el coche se giró hacia el sur; ahora encuadra la recta, la parrilla, el carril, la explanada y el trazado.

### Porsche 911 GT3 RS, mejora 1: la carrocería contra las fotos (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, mejora 2: ruedas, ala, habitáculo, sonido y visita (2 de octubre de 2026)

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

### Conducción del Porsche y vuelo del F-16, revisados (2 de octubre de 2026)

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

### Pasada vehículo a vehículo (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, mejora 3: carrocería nueva contra las cuatro fotos de estudio (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, mejora 4: el habitáculo nuevo, con instrumentos vivos (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, mejora 5: la dinámica P1 de la auditoría (2 de octubre de 2026)

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

### Porsche 911 GT3 RS, mejora 6: alerón, llantas, frontal, zaga y faros contra las fotos (2 de octubre de 2026)

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

### La Ninja H2R, rehecha (3 de octubre de 2026, segunda versión)

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

### Pasada decisiva: diagnósticos hechos, aplicación pendiente (4 de octubre de 2026)

El usuario pidió una pasada decisiva sobre la H2R, el Porsche y el F-16: modelos hiperrealistas sin simplificar, mejor sonido (el F-16 no tiene ninguno), arreglar un cuadrado negro intermitente en la zona de la H2R y el Porsche, conducción mucho más profunda (la moto no debe caerse al girar) y una pasada por el entorno y las físicas. Se hicieron seis auditorías de solo lectura; los resultados completos están en `docs/diagnostico-2026-10-04/` (índice en su `LEEME.md`). La aplicación va por bloques, cada uno con su sección (la primera, *Pasada decisiva, bloque 1*).

- **Cuadrado negro: causa confirmada, era el Porsche.** El splitter delantero tiene triángulos de área cero con normales nulas; dan un píxel NaN, el filtro de luciérnagas anterior al bloom lo deja pasar y el bloom lo convierte en un rectángulo negro que parpadea. Arreglo probado en la página: filtro a prueba de NaN, quitar los puntos colineales y un saneador de normales.
- **H2R:** con las ayudas, 193 de 200 recorridos aleatorios acababan en caída. Hay un prototipo con 0 caídas (presupuesto de agarre con prioridad lateral y tope de inclinación a 59,9°, donde toca la estribera). Aplicado en el bloque 2.
- **Porsche:** el volante con teclado pide el doble del ángulo útil, el DRS se abre en plena curva, el PDK corta el empuje 0,1 s, subvira en el límite y el diferencial no es el autoblocante del coche.
- **Sonido:** las explosiones se redondean a muestras enteras (≈ −25 dB de ruido), el silbido de alivio de la H2R se rompe a los 30 s y no hay modelo espacial. El F-16 no tiene sonido.
- **No se llegó a hacer:** la auditoría del detalle de los modelos y el presupuesto de rendimiento, y la del entorno y las físicas.

### La H2R a nivel de proyecto de Blender (5 de octubre de 2026)

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

### Encargo del 4 de octubre (cuarta sesión): F-16, Porsche y H2R a fondo. F-16, toma de aire y cúpula

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

### Fase 4 del encargo: física y entorno: el viento del sitio (4 de octubre de 2026)

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

### Fase 3 del encargo: sonido (4 de octubre de 2026)

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

### Fase 2 del encargo, segunda parte: Porsche y F-16 (4 de octubre de 2026)

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

### Fase 2 del encargo, primera parte: detalle de superficie y la H2R por dentro (4 de octubre de 2026)

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

### Fase 1 del encargo: conducción de la H2R y del F-16 (4 de octubre de 2026)

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

### Pasada decisiva, bloque 4 (primera parte): el sonido de los motores, sin arenilla ni clics (4 de octubre de 2026)

Del diagnóstico `docs/diagnostico-2026-10-04/sonido.json`, pasos 0–2. Todo lo comprueba `tools/sound-check.mjs` (en `check:static`), que saca el código de cada worklet de su módulo y lo renderiza sin navegador a 48 kHz.
- **Cada explosión en su instante exacto.** Antes se redondeaba a la muestra entera más cercana: cuando el periodo de encendido no era un número entero de muestras, aparecía un ruido inarmónico que dependía de las rpm (−25 dB a 14.000 rpm en la H2R, −27 dB a 8.900 en el GT3: la «arenilla digital» al subir de vueltas). Ahora cada impulso se reparte entre dos muestras según su posición: −39,5 dB en la H2R a 14.000 rpm y −41,9 dB en el GT3 a 8.900 (con la variación aleatoria entre cilindros quitada para medir).
- **Controles muestra a muestra:** rpm, carga, gas, corte y encendido son parámetros de audio que el hilo principal desliza (`setTargetAtTime`), en vez de un mensaje por fotograma suavizado una vez por bloque. Se acaban la escalera de tono que dependía de los fps y el clic al pararse el motor (una caída o un motor ahogado): el salto al pararse es ahora menor que en marcha.
- **El gas que recibe el motor**, no el del pedal: el sonido lee `s.engThr` y `s.engLoad` (con los cortes del cambio rápido, el limitador, el golpe de gas del PDK al reducir y el control de tracción).
- **H2R, válvula de alivio:** su silbido tenía la fase atada al compresor y, tras ≈30 s, salía como ruido aliasado entre 2 y 47 kHz; además nunca sonaba en los cambios rápidos. Ahora tiene su propia fase: un silbido que cae de ≈2,7 a 1 kHz en ≈60 ms con el siseo del aire (banda de ≈4 kHz), del tamaño de la presión que suelta (≈). Suena cuando el gas del motor se cierra con presión, también en cada cambio rápido. La prueba exige el mismo silbido a los 0,5 s que a los 40 s.
- **H2R, compresor:** silba al paso de sus álabes, 6 en la punta (Kawasaki), 55,2 veces la velocidad del cigüeñal (≈12,9 kHz a 14.000 rpm), y ya no a la velocidad del eje (9,2×), que queda ≈20 dB por debajo. Nada por encima de 0,45 de la frecuencia de muestreo.
- **Sin continua a la salida:** el filtro que la quita va ahora después de la última curva (antes dejaba ≈0,03). Comprobado también en Chromium con un `OfflineAudioContext`: los dos worklets cargan y suenan. Cada motor gasta ≈1,5 % de un núcleo.

### Pasada decisiva, bloque 3 (segunda parte): PSM en tres etapas, cámaras, pianos, neumáticos y vuelta de referencia (4 de octubre de 2026)

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

### CI en rojo tras el bloque 3 (primera parte), arreglado (4 de octubre de 2026)

El check completo de `501d6f3` y de `9917115` falló en `tools/ux-check.mjs`, en «A restored WebGL context keeps the ground lit» (luminancia 111 antes y 125 después), y Pages no se actualizó. **No era el contexto WebGL.** La prueba nueva de la H2R mandaba sus teclas como eventos sintéticos sobre `window`; ahí el evento está en su destino y los atajos de la página, registrados antes, se ejecutan antes que el manejador de captura de la moto. La **G** (caja automática) arrancaba también el lanzamiento de Starship, cuya cámara se llevaba la vista entre las dos medidas. Con una tecla real el evento llega a `document.body` y la moto se lo queda (comprobado en el navegador). Arreglo, solo en la prueba:
- los ayudantes de teclado de `ux-check` despachan sobre `document.body`, como una tecla real;
- la prueba de la H2R exige además que **G** no arranque el lanzamiento (con el despacho viejo, falla);
- la prueba de la luz exige que no haya ninguna secuencia en marcha entre las dos medidas.

### Pasada decisiva, bloque 3 (primera parte): la conducción del Porsche (4 de octubre de 2026)

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

### Pasada decisiva, bloque 2: la H2R ya no se cae al girar (4 de octubre de 2026)

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

### Pasada decisiva, bloque 1: el cuadrado negro, arreglado (4 de octubre de 2026)

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

### La Ninja H2R contra fotos calibradas: frontal, alas, cúpula y cabina (3 de octubre de 2026, tercera versión)

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

### Porsche 911 GT3 RS: frenada contra auto motor und sport y revisión con fotos libres (4 de octubre de 2026)

- **Frenada.** Porsche no publica distancias de frenada. El Supertest de auto motor und sport (septiembre de 2023) midió 28,0 m de 100 a 0 km/h en caliente (41,4 m en frío) y 97,0 m de 200 a 0 km/h. Las cifras se leyeron en el resumen del buscador, porque la tabla está tras el muro de pago: se marcan como ≈.
  - El modelo da 27,7 m y 99,7 m sin tocar nada.
  - `tools/gt3rs-check.mjs` lo comprueba ahora contra esas cifras (±5 %) en vez de un intervalo genérico.
- **Revisión con 18 fotos libres de Wikimedia Commons** (traseras y frontales de tres cuartos de varios coches; solo como referencia, no están en el repositorio).
  - La parte baja negra de la trasera es correcta: en los coches blanco, azul claro y gris oscuro el panel alrededor de la matrícula es negro y las esquinas son del color de la carrocería. Solo un coche gris la lleva pintada.
  - El difusor tiene tres aletas a cada lado de la caja de los escapes, como el modelo.
- **Habitáculo.** No hay fotos libres del interior del 992 GT3 RS en Commons, así que el salpicadero no se ha podido contrastar en esta sesión.

### La conducción de la H2R contra la prueba de MOTORRAD (3 de octubre de 2026)

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

### Porsche 911 GT3 RS, mejora 7: piezas, vista del piloto, levas y sonido (3 de octubre de 2026)

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

### El Porsche sabe dónde está desde el primer instante (3 de octubre de 2026)

- En CI, la prueba «B starts the Porsche on its skid pad» falló en una de las cinco ramas con el mismo commit (`onPad: false`). Causa: `reset()` de `gt3Car.js` dejaba la superficie bajo cada rueda en su valor inicial (`'track'`) hasta el primer paso de la física, y en un runner cargado ese paso no llegó antes de que la prueba mirara.
- Ahora `reset()` lee el suelo de las cuatro huellas al posar el coche, así que el estado ya es el real antes del primer paso (el cuadro y el sonido lo leen).

### Choques de verdad y la nave cayendo al agua (3 de octubre de 2026)

El usuario pidió que chocar con el Porsche o con el F-16 fuera realista y que, cuando la nave cae al agua, pareciera agua. Antes un choque solo paraba el vehículo y el amerizaje era una nube de vapor sobre un mar intacto.

- **El Porsche se abolla** (`src/sim/gt3Damage.js`):
  - Cada contacto de más de ≈2 m/s aplasta la carrocería contra un plano metido hacia dentro desde el punto del golpe: ≈4 cm por m/s, hasta ≈0,6 m. Como orden de magnitud, en la prueba de barrera a 56 km/h el frontal de un coche se aplasta ≈0,5 m (≈: es un aspecto, no un modelo estructural).
  - Lo que sobresalía se comprime por delante del plano **sin cambiar de orden**: las piezas montadas unas sobre otras (pintura, rejillas, pasos de rueda, faros) se pliegan juntas y ninguna atraviesa a otra. El efecto es pleno en la línea del golpe y se suaviza hacia los lados, con un arrugado suave.
  - Cada pieza afectada recibe su propia geometría, porque las mitades izquierda y derecha del coche comparten algunas.
  - Por encima de ≈6 m/s en un costado se suelta el retrovisor de ese lado, y por encima de ≈9 m/s en la zaga, el alerón. Salen despedidos, giran y quedan en el suelo.
  - Saltan chispas, escamas de pintura, trozos negros y cristal de los faros.
  - Por encima de ≈6 m/s el golpe resta salud: el par cae hasta un 60 % y, con el daño total, el motor se para («too badly damaged»). Al reiniciar vuelve todo a su sitio.
  - Corregido de paso: el modelo iba 0,27 m por detrás del centro de gravedad de la física, porque el origen del modelo está en el centro de la batalla.
- **El F-16 se estrella** (`src/sim/f16Fly.js`, efectos en el nuevo `src/core/effects.js`):
  - **Contra el suelo o una estructura**, por encima de ≈30 m/s: bola de fuego, pavesas, humo negro que sube en columna durante ≈30 s, restos, chispas y polvo. El avión desaparece: se ha roto. Más despacio solo saltan chispas, polvo y algunos trozos.
  - **En el agua:** una cortina de agua a lo largo del último tramo de la trayectoria, llevada hacia delante, con rocío fino, láminas más pesadas y niebla.
    - Por encima de ≈60 m/s el agua es tan dura como el suelo: el avión se rompe y el combustible arde unos segundos en la superficie; el humo sube cuando el agua ha vuelto a caer.
    - Más despacio es un amaraje: queda entero y se hunde.
  - Corregido: tocar el suelo con el tren subido daba siempre «aterrizaje de panza», aunque el golpe ya fuera otro. Ahora es panza solo si bajaba a menos de ≈4 m/s; si no, es el fuselaje contra el suelo, o el agua.
- **La nave cae al agua** (`src/sim/reentry.js`). Agua de verdad, que sube y cae por la gravedad, además del vapor que ya había. Los tamaños y velocidades son ≈, a ojo de los vídeos de los amerizajes:
  - En los últimos ≈45 m, el chorro del Raptor barre la superficie y lanza una falda de agua baja hacia todos lados, más fuerte al final.
  - Al tocar el agua, a paso de persona, se levanta un anillo de agua alrededor de la base.
  - Al volcar, el casco cae de plano a los 6,5 s con la punta a ≈30 m/s (0,6 rad/s × 52 m). Cada tramo levanta agua según su propia velocidad, así que las láminas suben más hacia el morro y dejan niebla a lo largo del casco.
  - Espuma dibujada sobre el mar: agua blanca alrededor de la base desde que llega el chorro, un anillo que se aleja y una mancha alargada donde cayó el casco, con vetas de ruido, que se abren y se desvanecen.

### Físicas del mapa: agua de verdad, desniveles y colisiones con todo (3 de octubre de 2026)

El usuario lo encontró: con el Porsche se pasaba por encima de los lagos como si nada, y se atravesaban vallas, vehículos y estructuras. Era así:
- Las charcas solo existían en el sombreador y en una lámina de agua de 6 cm sobre suelo plano.
- El mar era un «suelo» duro a −0,9 m.
- El coche solo chocaba con los expositores, como círculos.

Ahora:

- **El agua tiene fondo** (`src/core/water.js`, `terrain.js` `poolShape`/`poolDepth`):
  - Las charcas son la misma silueta que dibuja `campus.js`, ahora compartida, con el lecho excavado en el suelo hasta 0,35 m en el centro bajo el agua (≈: no hay batimetría de estas charcas).
  - El mar conserva su superficie a −0,9 m sobre el talud real de la orilla, hasta 9 m de fondo.
  - Los canales de marisma que pinta el sombreador se calculan con la misma función, portada a JavaScript con la precisión simple de la GPU: lo que se ve como agua es agua. Ahí es una película de ≈4 cm sobre barro, porque la malla del suelo es demasiado gruesa para tallar cauces de pocos metros.
- **El coche en el agua** (`gt3Car.js`):
  - Con más de ≈3 mm de lámina pierde agarre (≈0,85 del de la superficie), y deprisa hace aquaplaning. Empieza hacia el 80 % de la velocidad que da la regla de Horne de la NASA, V ≈ 10,35·√p (mph, psi): ≈94 km/h a ≈2,2 bar (presión ≈).
  - Cada neumático empuja el agua por la que pasa, ½ρ·Cd·(ancho × profundidad)·v² con Cd ≈0,7. Una charca por un solo lado hace girar el coche.
  - Con el agua por encima del suelo del coche (≈0,14 m), la carrocería la aparta (Cd ≈1) y flota sobre lo que desplaza (≈80 % de su planta). A 0,40 m de agua un coche de 1.450 kg queda a flote y sin tracción, como advierte el servicio meteorológico de EE. UU. («Turn Around Don't Drown»).
  - Se inunda poco a poco, ≈45 s con los umbrales bajo el agua (≈), y se hunde hasta el fondo. A flote va nivelado y la pendiente del fondo ya no lo empuja.
  - El motor se ahoga cuando el agua llega a la admisión (≈0,65 m sobre el fondo en el eje trasero) y no vuelve a arrancar hasta reiniciar.
  - Se ve: cada neumático en el agua levanta salpicaduras balísticas que caen de vuelta, y la carrocería empuja una ola de proa. Los avisos dicen cuándo entra en el agua, cuándo flota, cuándo se ahoga el motor y cuándo se hunde. La cámara de persecución no baja del agua.
- **Desniveles:** el coche pisa también el pad de lanzamiento: sus dos niveles de hormigón, el foso de llamas 4 m más abajo y el terraplén 1:3 alrededor. Antes lo atravesaba al nivel del suelo.
- **Colisiones con todo lo sólido** (`src/core/colliders.js`):
  - Cada triángulo de la escena estática se reparte en celdas de 0,25 m en planta, con la altura mínima y máxima de lo que las cruza. Se construye una vez al empezar a conducir o a volar, sin el vehículo que se mueve, en menos de 1 s.
  - Para el coche, cada celda donde algo se alza más de 12 cm sobre el suelo y por debajo del techo es un pequeño obstáculo: la valla, los postes, los tanques, los atriles, las personas, los demás vehículos. Las caras horizontales (cubiertas, suelos) no cuentan: lo que para un coche son los lados.
  - El movimiento se comprueba en pasos de 10 cm como mucho: a 250 km/h el coche choca con una valla de postes y no la atraviesa entre dos comprobaciones.
  - El F-16 comprueba sus puntos duros, ahora también la cúpula y la punta de la deriva, a lo largo de cada paso de vuelo. Contra cualquier estructura, tejados incluidos, se estrella; también si toca el agua de una charca.
- **Pruebas nuevas:**
  - en `tools/gt3rs-check.mjs`: el mar (frena, se ahoga el motor, flota, se inunda y se hunde), las charcas (0,25 m las cruza; 0,40 m flota), el aquaplaning (agarra a 60 km/h, lo pierde a 150) y la valla a 250 km/h;
  - en `tools/f16-check.mjs`: una torre (a 20 m se estrella; a 80 m pasa por encima).
- **F-16, puertas del tren:** la del tren de morro iba delante de la pata, y en las fotos de la USAF (DVIDS 7682498 y 8138193, dominio público) va detrás. La del tren principal era un rectángulo centrado sobre la rueda; es un trapecio por delante de ella, colgado del borde inferior del fuselaje y abierto hacia fuera.
- **Nota de la reentrada:** seguía dando el estado de entrada anterior a la cadena de misión (≈190 t, 7,74 km/s a −1,6°). Ahora da el de la cadena, ≈262 t, 7,78 km/s a −1,3°, y el desfase de 22 min.

### Flight 14: una sola misión del corte a la entrada (2 de octubre de 2026)

Hallazgos P1 de la auditoría sobre Flight 14 (H28, H30, H32 y H33, en parte). Las pruebas nuevas están en `tools/mission-check.mjs`.

- **H28: el ascenso y la reentrada no eran una misión.** El barco terminaba su encendido en el arco **suborbital** del vuelo 12 (apogeo 195 km, perigeo −7 km). Desde ahí habría reentrado hacia T+8:59, media hora antes de la entrada citada. El vuelo 14, en cambio, es el primero orbital. La reentrada, por su parte, partía de una órbita circular de 200 km y una masa de 190 t supuestas por separado, sin relación con el ascenso.
  - Ahora el encendido termina a T+8:11 **en órbita**: la circular de 200 km de la que parte la reentrada. Es una sola suposición para las dos fases (≈: la órbita real no se publica). El ascenso resuelve de nuevo su masa no propelente: ≈209 t, antes ≈215.
  - El nuevo `src/sim/mission.js` encadena:
    - el estado del barco al corte (altura, velocidad, ángulo y masa de las tablas del ascenso);
    - su órbita (vis-viva y momento angular);
    - el vuelo libre hasta el encendido de salida citado, con la ecuación de Kepler;
    - ese encendido de 11 s con un Raptor: 7,9 t de propelente y ≈101 m/s por la ecuación del cohete;
    - y la nueva órbita hasta la interfaz de 120 km.
  - Con eso, la reentrada parte de **7,78 km/s a −1,3° y ≈262 t**, que son la masa y la energía que trae del ascenso. Toda la misión usa una sola gravedad, la del ascenso.
  - **Discrepancia medida, no ocultada:** esa cadena llega a la interfaz hacia **T+9:07**, 22 min antes de la entrada citada (T+9:28:56). Con el encendido citado, ninguna órbita circular razonable cuadra (haría falta ≈450 km). La órbita o la masa reales no son las supuestas, y los datos publicados no permiten saber cuál es. El capítulo conserva la hora citada, y el panel y la ficha dan el desfase.
- **H30:** la masa no propelente resuelta se describe como lo que es: estructura, carga y reservas juntas, que este ajuste no puede separar.
- **H32: el alcance lateral.** La parte de la sustentación que se inclina fuera del plano ya no se descarta. Se integra como **cota**: sin invertir nunca el alabeo, llevaría la nave ≈600 km de lado en 5.700 km de recorrido. La guía real invierte el alabeo para quedarse en su pasillo, y SpaceX no publica el perfil.
- **H33: el aterrizaje, comprobado contra empuje y propelente.** El encendido final pide como mucho 1,7 g, de los 2,9 g que dan tres Raptor a esa masa, y ≈20 t de propelente de las ≈53 t que quedan. Sigue siendo una trayectoria guiada (una quíntica), ahora con su factibilidad verificada.
- **La reentrada se ha reajustado** con su estado de entrada nuevo:
  - El resolvedor de Newton se atascaba en el primer paso y se ha cambiado por uno de Levenberg–Marquardt.
  - La retirada del picado pasa de 30 a 60 s. Con 30 s, tras la entrada más tendida, la nave volaba a nivel a 73 km durante minutos y el calentamiento volvía a subir al caer de esa meseta.
  - Resultados (no telemetría): pico de calentamiento a ≈73 km, caída en panza a ≈90 m/s, encendido desde ≈850 m y ≈5.700 km de recorrido.
- **Sigue pendiente:**
  - un ascenso de la pila dirigido por fuerzas con el Max-Q como hito reservado (H29);
  - el retorno del propulsor con masa y combustible por encendido (H31);
  - la actitud dinámica del volteo (H33).

### F-16: Tierra redonda, combustible y límites del modelo; telemetría en vivo (2 de octubre de 2026)

Hallazgos P1 de la auditoría sobre el F-16 (H15, H16, en parte H17, y H20) y la telemetría accesible (H25). Las pruebas nuevas están en `tools/f16-check.mjs` y `tools/ux-check.mjs`.

- **H15: la altitud y la gravedad, sobre la Tierra redonda.** Más allá del disco plano, el suelo lejano baja con la curvatura (`core/outerGround.js`), pero el avión medía su altura sobre el plano de la escena y caía siempre en vertical. Ahora `geodesy()` (en `src/sim/f16Flight.js`) da la altura sobre el mar que tiene debajo, a lo largo de la normal de esa superficie, y la gravedad apunta según esa normal y disminuye con la altura (g₀·(R/(R+h))²). La atmósfera, el empuje, la velocidad calibrada y el altímetro del HUD usan esa altura.
  - Comprobación: a 300 km del centro la gravedad se inclina 2,70°, que es el ángulo r/R; un punto a 5 km sobre el plano está allí a 12,1 km sobre el mar; y a 10 km de altura g vale 9,776 m/s².
- **H16: el modelo dice cuándo sale de sus datos.** El ajuste de Morelli cubre α de −10° a 45° y β de ±30°, y el de este modelo está tomado a Mach 0,6. Fuera de eso el modelo extrapola: el estado lo marca (`s.domain`) y el HUD lo muestra con discreción («EXTRAPOLATED α», «M>0.6»).
  - La prueba comprueba que α de 60° y Mach 0,91 quedan marcados y que Mach 0,46 con α pequeño queda dentro.
  - **H17 sigue pendiente:** el régimen supersónico sigue siendo la corrección ≈ de la pendiente de sustentación y la resistencia de onda. Ahora queda declarado, pero no se ha sustituido por datos.
- **H20: la configuración del avión, declarada, y el combustible, que se gasta.** El avión vuela limpio, sin cargas ni depósitos. Pesa 20.500 lb al arrancar, la cifra del TP-1538, y de esa masa ≈3.100 kg son combustible interno (≈: el informe da el peso, no el reparto).
  - El motor consume según su consumo específico: ≈0,73 kg por kgf·h a potencia militar y ≈2,05 en postcombustión plena (≈, valores típicos de un turbofán de la clase F100; no publicados para este avión).
  - La masa baja con lo que se quema, y sin combustible el motor se apaga.
  - El HUD muestra el combustible y avisa con FUEL por debajo de 300 kg y con FLAMEOUT.
  - Comprobación: 10 s a fondo gastan 43 kg, unos 5,5 kg/s en postcombustión.
- **H19, hecho el 3 de octubre de 2026:** las leyes del FLCS viven ahora en su propio módulo, `src/sim/f16Flcs.js` (C*, limitador de α, alabeo, guiñada, flap de borde de ataque y su programa con q̄). El modelo de vuelo le da los datos de aire, su estado y los actuadores, y mueve las superficies que pide. Una prueba nueva lo ejercita aislado en `tools/f16-check.mjs`.
- **H25: telemetría accesible.** Los instrumentos del coche y del avión se dibujan en un lienzo que un lector de pantalla no ve. Ahora las lecturas principales están también como texto (`src/ui/telemetryList.js`): una lista de definiciones fuera de la vista, pero no oculta al lector.
  - Para el coche: velocidad, marcha, régimen, aceleración, derrape, ayudas y vueltas. Para el avión: velocidad, Mach, altitud, velocidad vertical, rumbo, g, α, motor, combustible, tren y si el modelo extrapola.
  - Se refresca como mucho dos veces por segundo. No es una región viva, porque un valor que cambia sesenta veces por segundo no dejaría de hablar: el lector la consulta cuando el visitante quiere, y los eventos siguen anunciándose en la lista de mensajes.
  - La prueba de `ux-check` comprueba que la lista existe, que está fuera de la vista pero no oculta, que no es una región viva y que sus valores están al día.
- **Telemetría en vivo del Porsche** (mejora propia). A la izquierda del cuadro, en pantallas de 900 px de ancho o más, aparecen:
  - las trazas de los últimos 20 s de velocidad, acelerador y freno, con la leyenda en sus colores;
  - el círculo de adherencia (g-g): las g longitudinales frente a las laterales, con su estela, la frenada arriba y anillos de 1 y 1,5 g.
  - Se muestrea con el reloj de la simulación, cada 50 ms, así que un frame lento no estira las trazas. En pausa no avanza y se reinicia con el coche.

### Auditoría técnica externa del 2 de octubre de 2026 (ChatGPT): lo corregido

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

### Historial

Las rondas anteriores —entorno, vehículos contra las fotos, nube y sonido del lanzamiento, revisión corriendo la simulación y las auditorías externas de Grok y ChatGPT— están en [docs/historial.md](docs/historial.md), rotuladas como históricas. Este README describe el estado actual.

### Discrepancias entre fuentes

El modelo no las oculta:

- Las cifras del Falcon 9 (41,2 + 13,8 + 13,1 = 68,1 m) no suman los 70 m declarados; los 1,9 m que faltan son el faldón delantero de la segunda etapa a diámetro completo (antes se asignaban a un adaptador de carga bajo la cofia).
- Los ~18 000 losetas y el tamaño publicado de loseta no son consistentes entre sí; el modelo respeta el tamaño.
- Los ≈30 m de envergadura y los ≈116 m² de superficie del Starlink V2 Mini sí son compatibles: con dos alas de 13,1 × 4,0 m y un bus de 2,7 × 4,1 m suman ≈115,9 m². Una versión anterior quedaba un 8 % corta de superficie; ya no.
- Los 12,2 m del Falcon Heavy se miden entre cilindros; las patas plegadas sobresalen unos 0,3 m.
- **Altura de la pila V3:** SpaceX da 124 m / 407 ft (72 m + 52 m) y Wikipedia, 124,4 m con un propulsor de 72,3 m. El modelo sigue a SpaceX (se construye con los pies: 236 + 171 ft = 124,05 m).
- **Diámetro del Raptor:** spacex.com da 1,3 m. Veinte campanas de 1,3 m en un solo anillo necesitan un radio de al menos 4,16 m entre ejes, y con ellas la envolvente pasaría de 4,8 m, más que el propulsor de 9 m. El modelo usa 1,24 m de salida para que el anillo exterior quepa; la cifra publicada debe de ser la de otro diámetro del motor.

### El complejo de lanzamiento y la secuencia

SpaceX **no publica ninguna dimensión** de su infraestructura de tierra, así que el pad se construye con lo que sí es citable y se reconstruye el resto explícitamente:

| | |
|---|---|
| Citado | brazos de unos 26 m (los ≈36 m del Pad 1 menos los ≈10 m que da NSF para el Pad 2) · en cada brazo un solo carro sobre el raíl y un empujador telescópico en la punta que centran el pin del propulsor, donde el Pad 1 lleva dos carros (NSF; tamaños reconstruidos) · 20 pinzas de sujeción · mesa cuadrada con cubierta refrigerada por agua · zanja de llamas bidireccional de hormigón revestida de inoxidable, con el propulsor varios metros más bajo que en el Pad A · pararrayos y pequeña estación meteorológica en lo alto de la torre · carro de los brazos colgado de una polea en la corona y movido por un cabrestante en la base · desviador de llama hecho de tuberías de acero · agua del deluge en tanques horizontales impulsada por gas a presión · tanque horizontal de LOX de 95 000 galones, tanque de metano de 80 000 galones y subenfriadores de nitrógeno líquido (Wikipedia, *SpaceX Starbase*) |
| Publicado, aproximado (**≈**) | altura de la torre: «approximately 480 feet tall with a 10-foot lightning rod on top» (FAA, evaluación ambiental programática de Starbase, junio de 2022, §2.1.4.3). Es una cifra de planificación, anterior a la construcción, y por eso lleva ≈: 12 tramos de 12,2 m (146,4 m) y un pararrayos de 3,05 m, ≈149,5 m en total. Sustituye a los 474 ft (≈144,5 m) que solo daba una wiki de aficionados. Coincide con la única lectura independiente que había: en la foto del ensayo del 11 de mayo de 2026 la celosía sigue presente a ≈145–150 m, por extrapolación con su error |
| Reconstruido (**≈**) | la altura de los brazos aparcados (≈132 m), toda dimensión en planta, las cotas de la explanada y de la cubierta, los perfiles de la celosía, el hueco del ascensor y la escalera, la distancia de la torre al eje, el número y tamaño de los tanques del deluge, la fila de tanques verticales, los subenfriadores y todas las posiciones. Los dos tanques horizontales de propelente toman su longitud del volumen citado con un diámetro supuesto de 3,8 m |

**Acero de la torre.** La torre, los brazos y la mesa llevaban un gris liso uniforme. Ahora usan una textura procedural de acero pintado a la intemperie en la costa: pintura irregular, regueros de óxido que cuelgan de las juntas, desconchones que dejan ver la imprimación y eflorescencia de sal. Se repite cada 4 m con UV métricas, y en las caras verticales los regueros caen hacia abajo. El patrón es verosímil, no una copia de fotos concretas.

**Etiquetas de los tanques.** Nave y propulsor tienen cada uno un tanque de oxígeno y uno de metano, y las cuatro etiquetas decían solo *Liquid oxygen/methane tank*. Ahora indican a qué etapa pertenecen, y la nave tiene también su etiqueta de oxígeno, que faltaba. La del pin de captura integrado se ha movido con el trío de grid fins al lado correcto.

Lo que **no** está: no hay mástiles pararrayos exentos ni torres de focos. Durante un tiempo el complejo tuvo dos mástiles de 150 m y cuatro postes de 28 m con foco que ninguna fuente sitúa en el Pad 2; en la vista general se leían como antenas y farolas plantadas alrededor de la plataforma, y se retiraron. La torre, que antes llevaba un núcleo macizo de 5,2 m que la convertía en una losa oscura desde lejos, es ahora una celosía abierta: cuatro pilares, un anillo cada medio tramo, dos recuadros en X por cara y tramo, y dentro el hueco del ascensor y la escalera, por lo que se ve el cielo a través. Los brazos de captura son celosías de tubo redondo (ver *Starship V3 contra las fotos*) con la cubierta, el raíl y las almohadillas en la misma envolvente que medía la verificación. Las almohadillas de apoyo de uno de los dos brazos se construían como cajas de profundidad negativa —vueltas del revés— y la oclusión ambiental las leía como totalmente enterradas: negras y con rayas. El constructor de bloques del pad acepta ahora los extremos en cualquier orden. Las cuatro líneas del puente de tuberías que viene de la granja ya no terminan contra el muro del pad a seis metros de altura: suben en vertical junto al borde, cruzan la cubierta a 4,4 m sobre postes en T —por encima de las tuberías del deluge y de las puertas del búnker— y giran escalonadas, sin cruzarse, hasta el búnker de conexiones del propulsor, dos a la sala del metano y dos a la del oxígeno (trazado reconstruido). El desviador de llama del centro de la zanja es, como describe Wikipedia para el Pad 2, un lecho de tuberías de acero: un núcleo de hormigón en cuña cubierto por tubos de 48 cm tendidos de muro a muro, uno junto a otro por las dos pendientes, alimentados por un colector a lo largo de cada muro y rematados en la cresta (número, diámetro y colectores reconstruidos; la cresta de 4,2 m y la pendiente de 15 m no cambian). Antes era una cuña de acero lisa con unos nervios. El carro de los brazos ya no flota: según Wikipedia (*SpaceX Starbase*) cuelga de una polea en lo alto de la torre y lo mueve un cabrestante con tambor en la base, y así está construido —un bastidor con dos poleas en la corona sobre la cara del pad, dos ramales de cable hasta el carro que se acortan y alargan con él durante la captura, los retornos por dentro de la celosía y una bancada con dos tambores y sus motores junto al pie de la torre (tamaños reconstruidos). El brazo de desconexión rápida de la nave también es ahora una viga de celosía, con pasarela, barandilla y la campana que se cierra sobre el panel de conexiones de la nave.

La escala de lo reconstruido sale de la única referencia dura que hay en cualquier fotografía del pad: los **9 m de diámetro del propulsor**.

**Contraste con fotografías.** El despegue se ha comparado con la foto del vuelo 5 de Commons (*Liftoff of SpaceX IFT-5*) renderizando el nuestro con un teleobjetivo desde un punto parecido, a unos 2,6 km. Faltaban tres cosas, y ahora están:
- **Nube de tierra:** en la foto, segundos después del despegue, ocupa cientos de metros y supera la mitad inferior de la torre; la nuestra eran unas bocanadas grises. Sale ahora más rápido de las bocas de la zanja (125 m/s frente a 92), más grande (crece 150 m frente a 85), vive más y sube con más empuje térmico. El búfer pasa de 860 a 1600 partículas en calidad alta (de 520 a 640 en media y de 240 a 300 en baja, porque lo que cuesta una nube transparente a pantalla completa es el relleno, no el número), y el vapor del agua de la cubierta alrededor de la mesa también crece.
- **Iluminación del penacho sobre la nube:** en la foto, la parte baja de la nube brilla en amarillo-naranja en un par de cientos de metros. La luz del penacho llega ahora hasta unos 160 m y 70 m de altura, en HDR, y cae con el cuadrado de la distancia: la nube va del naranja encendido abajo a su propio blanco grisáceo al sol arriba. Antes se quedaba en un beis a unos metros de las bocas; una primera versión más fuerte la convertía en un muro amarillo plano.
- **Penacho:** una columna Raptor a nivel del mar se fotografía blanca y saturada contra un cielo claro. El núcleo es ahora emisivo (×2,6) y satura a blanco; antes, al sumarse sobre un cielo pálido, quedaba de un crema rosado.
- **Escarcha:** un vehículo cargado de propelente criogénico está escarchado, y el expositor en reposo no (una pieza de museo está seca). Durante la secuencia, unas carcasas sobre los tanques del propulsor y sobre la cara de acero de la nave muestran hielo mate con regueros oscuros de condensación y calvas donde se ha desprendido, con una banda libre en el domo común. Está completa en la plataforma y se va desprendiendo durante el ascenso. La textura mide 4 m de ancho por 16 m de alto para que no se repita a una altura que el ojo pueda captar.
- **Chorros por motor:** en cualquier foto tomada cerca del pad, los motores se ven como chorros individuales durante los primeros metros, cada uno con su tren de diamantes de Mach, antes de fundirse en la columna. Ahora cada tobera tiene el suyo (33 en el propulsor, 6 en la nave). Van instanciados y ordenados por grupo de encendido, así que los que arden son los que deben: los 33 a la vez en el arranque (el Block 3 los enciende simultáneamente), 5 en la separación en caliente, 33 y luego los 13 interiores en el boostback y 13 → 5 → 3 en el aterrizaje. La columna del propulsor se estrecha a la vez: un apagado del anillo exterior se ve como tal, y no solo como un atenuado. Estrechan y se alargan con la presión: cuello de chorro sobreexpandido a nivel del mar, apertura en altura.
- **Columna más larga y sin cola violeta:** el penacho mide ahora unos 74 m a nivel del mar, en lugar de 44. Su cola termina en naranja apagado: la cola azul, mezclada con la banda naranja, se veía rosa-lila, y ninguna foto de un encendido de aterrizaje del Raptor muestra una llama rosa.
- **Nube de vapor, no de polvo:** el agua del deluge convierte la nube de la zanja en vapor, blanco al sol y con huecos de gris frío. Los tonos beis anteriores la hacían parecer una tormenta de arena.
- **Venteo y deluge:** en la cuenta atrás, el vehículo cargado ventea vapor blanco que cae por sus costados, porque está más frío y es más denso que el aire. Sale del tanque de oxígeno, de lo alto del propulsor, de la popa y del morro de la nave y de la base. El desviador de llama se activa en T−17 (citado, vuelo 14) y el agua sale por las bocas de la zanja; desde dos segundos antes del arranque de motores, el agua que sube por la placa de la mesa alrededor de los motores se convierte en espuma y vapor. Tras la captura, el propulsor ventea en los brazos. Son partículas que dependen solo del tiempo de misión, así que saltar a un instante da el mismo fotograma que llegar reproduciendo. Los puntos de venteo están reconstruidos, no sacados de un plano de tuberías.
- **Regreso del propulsor integrado de principio a fin:** ver el párrafo sobre el regreso más abajo. Sustituye a una curva dibujada cuya velocidad caía de 5 695 a 3 155 km/h en 0,2 s en la separación y cuya actitud, durante el boostback, apuntaba el morro aguas abajo: el empuje lo habría alejado del pad.
- **Collar de condensación en Max-Q:** en la subida transónica y en la máxima presión dinámica se forma una vaina de nube blanca que arranca del anillo de separación en caliente y de la popa de la nave, con lóbulos irregulares y parpadeo, como en las filmaciones.
- **Aterrizaje sobre la mesa:** en los últimos segundos del encendido, el chorro barre la cubierta de la mesa y el vapor se extiende en una lámina baja.
- **Tierra curva en altura:** por encima de unos 10 km, el terreno plano de 5 km del recinto se acaba mucho antes que el horizonte. Antes el disco se estiraba con la altitud y, visto desde 50–96 km, se quedaba plano por encima de donde debería curvarse el suelo. Ahora, entre 9 y 20 km, entra una Tierra esférica de radio real (6 371 km) que sigue a la cámara en horizontal, y el disco vuelve a su tamaño. El horizonte cae donde toca: unos 9,9° por debajo de la horizontal a 96 km, a unos 1 100 km de distancia, que es donde se sitúa el plano lejano de la cámara (√(2·R·h) con margen). El limbo atmosférico es analítico: cada rayo brilla según el aire que atraviesa en su punto más cercano al suelo, con dos capas (escala de 7 km para la línea brillante, 30 km para el azul que sube por encima). Se dibuja sobre una esfera de 150 km alrededor de la cámara, siempre dentro del plano lejano. Antes estaba en una capa a 120 km de altura: desde 24 km quedaba a 1 100 km en el horizonte, más allá del plano lejano, que la cortaba en una cresta oscura. El suelo se ve a través de una bruma de masa de aire plano-paralela (espesor óptico ≈ 0,35 dividido por el coseno del ángulo de visión), así que el horizonte se funde en neblina y el nadir se ve con claridad. La Tierra es un casquete de 25° con anillos cada vez más densos en lugar de una esfera de 192 × 96 con caras de 208 km. Tierra, océano y nubes son **genéricos**, generados con ruido: es un fondo, no un mapa del golfo de México.

El **Falcon Heavy** se midió contra la foto de la misión de demostración en el LC-39A (*Falcon Heavy Demo Mission*), escalada con los 70 m de la pila y contrastada con la cofia (13,3 m leídos frente a 13,1 m publicados): los tres juegos de grid fins están a la misma altura, unos 40 m, y la punta de los propulsores laterales a unos 45 m. El modelo tenía el cono de los laterales asentado directamente sobre el tanque, con la punta a 41 m y los grid fins a 33 m. Ahora el cono de cada lateral tiene un faldón cilíndrico a la altura de la interetapa del núcleo central, con los grid fins en su parte alta, y la punta queda a 45,2 m.

La Dragon se midió contra la foto de la NASA del Crew-3 en el LC-39A (*SpaceX Crew-3 Falcon 9 Vertical at LC 39A*): el radio de la cápsula a 0,7 / 1,4 / 2,1 / 2,8 / 3,3 m sobre el hombro es de 1,89 / 1,82 / 1,54 / 1,35 / 1,12 m en la foto, frente a 1,90 / 1,76 / 1,59 / 1,36 / 1,15 en el modelo. Coincide en un 3 %, así que el perfil no se tocó.

En el regreso, la cámara acompaña al propulsor en su caída —a unos 400 m y 140 m por debajo— y se asienta junto a la torre cuando se acerca al suelo; antes esperaba en un punto fijo cerca del pad y, en el encendido de aterrizaje, lo dejaba a 5 km: un punto de un píxel en el cielo.

La secuencia sigue la misma disciplina. **Desde el 29 de septiembre de 2026 todos sus tiempos son los de SpaceX para el vuelo 14** (28 de septiembre de 2026), el primer vuelo orbital de la V3 que se expone, sacados directamente de su página con la cronología publicada: GO en T−0:30, desviador de llama en T−0:17, orden de arranque de motores en T−0:03, despegue en T+0:00, Max-Q en 0:58, MECO en 2:20, separación en caliente en 2:22, boostback de 2:27 a 3:07, encendido de aterrizaje de 6:36 a 7:01 y apagado de la nave en 8:11. Los vuelos 12 y 13 publican la misma estructura con pocos segundos de diferencia. Hasta ahora la secuencia mezclaba el vuelo 7 (ascenso) y el 5 (regreso y captura), de 2024-2025 y con la V2. **Lo único que no es del vuelo 14** es el final: su propulsor iba a amerizar en el golfo, y aquí el encendido de aterrizaje termina en los brazos de la torre. Ningún propulsor V3 ha sido atrapado todavía. Entre los hitos hay **dos entradas de autor**: la velocidad en la separación y la curva de velocidad. Los ≈5 700 km/h de la separación **no son una cifra publicada**: son el ancla a la que se construye la curva, así marcados en la ficha. El giro gravitatorio (72° desde la vertical) ya no se elige: su constante de tiempo se resuelve al cargar para que el ascenso integrado llegue al MECO a **≈64 km**, la altitud que da Wikipedia (*SpaceX Starship*, perfil de vuelo); con el giro del vuelo 7 sobre el reloj más rápido de la V3 cortaba a 48 km. **La altitud, la distancia recorrida y la actitud del vehículo se integran** de esas entradas, no se declaran aparte. Por la misma fuente, en la separación en caliente quedan **cinco motores** encendidos a empuje reducido (el artículo del vuelo 12 lo confirma para la V3), no los tres centrales de antes.

El **regreso del propulsor** se integra también, en 2D (distancia y altitud), desde el estado exacto de la pila en la separación hasta los brazos. Posición, velocidad y actitud salen de esa misma integración, así que son continuas y no se contradicen. Qué es cada cosa:
- **Citado:** los tiempos del vuelo 14 (boostback de T+2:27 a T+3:07, encendido de aterrizaje de T+6:36 a T+7:01; SpaceX) y el paso a transónico cinco segundos antes del encendido de aterrizaje, como en el vuelo 7 (T+06:26 y T+06:31): ninguna cronología de la V3 lo da.
- **Aproximado (≈), sin verificar:** los últimos 17 s con los 3 motores centrales (≈T+6:44 aquí), trasladados de una lectura del vuelo 5 que una auditoría externa hizo en imágenes de terceros (RGV) y que no se ha comprobado fotograma a fotograma. El orden 13 → 5 → 3 sí es citado (SpaceX, vuelo 14).
- **Supuesto (≈):** 250 t para la resistencia sobre el disco de 9 m, atmósfera exponencial (1,225 kg/m³ y 8,5 km de altura de escala), un boostback de empuje y dirección constantes un encendido de aterrizaje de empuje constante contra la velocidad y una deceleración constante de 1,6 m/s² con los 3 motores centrales. Se integra el centro de masas, 30 m por encima de la base, para que el giro sea el de un cuerpo libre.
- **Resuelto al cargar, no elegido:** por Newton, el empuje del boostback (≈ 32 m/s², de vuelta hacia el pad), su dirección, el empuje de aterrizaje (≈ 51 m/s²) y un **coeficiente de arrastre efectivo (≈ 1,9)**, que engloba las rejillas y el ángulo de ataque. Son los valores con los que el propulsor pasa a transónico en ≈T+6:31 y el encendido citado de T+6:36 lo deja a 27 m/s y 231 m sobre la altura de captura en ≈T+6:44, cuando entran los 3 centrales.
- **El desvío final (≈):** el encendido de aterrizaje apunta a un punto **≈130 m mar adentro** del eje de la torre, y los 3 centrales lo cruzan hasta los brazos, como en la foto de SpaceX del vuelo 5 en aproximación final (Commons, 54063904149), donde el propulsor llega **inclinado ≈15° hacia la torre**. La distancia no está publicada: es la que hace que la inclinación máxima del desvío sea ≈15°. El modelo se inclina hasta ≈15,7° hacia la torre en ≈T+6:48, se endereza y frena inclinándose al otro lado, y entra vertical y en reposo en los brazos.
- **Interpolado:** solo esos últimos 17 s, con una quíntica por eje que parte de la posición, la velocidad y la aceleración del encendido y llega a los brazos en reposo y sin aceleración.
- **Actitud:** gira hasta la dirección del empuje durante la separación (el morro hacia el pad, la llama aguas abajo), la mantiene en el boostback y después cae con los motores por delante, con el morro opuesto a la velocidad; con los 3 centrales sigue la dirección del empuje que pide el desvío, y se endereza en los últimos segundos, al cerrarse los brazos.

Los resultados son **consecuencias de esos supuestos, no datos de vuelo**: apogeo ≈ 106 km hacia T+3:50 a unos 56 km de distancia, pico de reentrada ≈ 4 300 km/h, y ≈ 980 km/h a 1,2 km cuando se enciende el aterrizaje. Ninguna fuente pública da la trayectoria de Super Heavy segundo a segundo, y así lo indica la ficha. La distancia entre ambas etapas se abre sola por su diferencia de aceleración. `tools/cloud-check.mjs` recorre el vuelo entero en pasos de 0,05 s, deriva la velocidad de las mismas posiciones que usa la escena y falla si la rapidez o el vector velocidad cambian más de 12 g entre dos pasos o si la actitud gira más de 40°/s.

**La nave, desde la separación, es un cohete y no una curva (28 de septiembre de 2026).** Hasta esta ronda la curva de velocidad autorada del ascenso seguía para la nave hasta el final de la secuencia, y la auditoría de esta ronda midió lo que eso implicaba: una aceleración que **bajaba** de 0,98 a 0,79 g mientras la nave quemaba propelente (en un cohete sube al aligerarse), 299 km de altitud en T+7:16 (más que cualquier vuelo suborbital de Starship) y 3,8 km/s, la mitad de la velocidad orbital. Ahora la nave se integra desde el estado exacto de la pila en la separación como una masa puntual en el plano de vuelo (3 grados de libertad), con gravedad que decrece con la altura y el alivio centrífugo de la velocidad horizontal:
- **Publicado (spacex.com, Starship V3):** empuje de la nave, 1 614 tf, y propelente, 1 600 t.
- **Supuesto (≈, en la ficha):** impulso específico ≈ 350 s para los tres Raptor de nivel del mar en vacío y ≈ 380 s para los tres Raptor Vacuum (el reparto del empuje sale de los 3 × 250 + 3 × 275 tf modelados). Sin arrastre: por encima de 55 km es despreciable, y sin la rotación de la Tierra.
- **Resuelto al cargar, no elegido:** el guiado es la ley de la tangente lineal, el óptimo clásico de una combustión fuera de la atmósfera (tan e = tan e₀ − c·t). Sus dos constantes **y la masa que no es propelente** (estructura, carga útil y reservas, todo junto) se resuelven por Newton para que, al apagarse los motores en el T+8:11 citado, la nave esté en lo alto de la trayectoria del vuelo 12 publicada en Wikipedia (apogeo 195 km, perigeo −7 km): a 195 km, sin velocidad vertical y a √(μ(2/r − 1/a)) ≈ 7,72 km/s. Antes la masa en seco se suponía (150 t) y la nave se nivelaba a 150 km en T+7:16, con la mitad de la combustión por hacer.
- **Resultado:** ≈215 t que no son propelente; la masa baja de 1 815 t a ≈276 t en el apagado y la aceleración de empuje sube de ≈0,9 g a ≈5,8 g, porque sigue a empuje completo hasta el final (no se publica si la V3 reduce potencia antes del apagado); la nave apaga a 195 km y ≈27 800 km/h, por debajo de la velocidad orbital. La combustión de 349 s a empuje completo gasta 1 544 t de las 1 600 publicadas, una comprobación independiente de que el tiempo citado, el empuje y el propelente encajan. Son **consecuencias de esos supuestos, no telemetría**: SpaceX no publica la telemetría como datos, y así lo dice la ficha. Tras la captura, la realización corta a la nave para su apagado.
- `tools/cloud-check.mjs` comprueba que la aceleración de empuje sube mientras quema, que la masa sigue el caudal, que los motores se apagan en el tiempo citado, que la nave apaga en lo alto de ese arco y por debajo de la velocidad orbital, que el MECO queda a ≈64 km, que la velocidad del panel es la del movimiento y que la actitud no gira más de 3°/s. Una mutación que deja la masa constante tiene que fallar, y falla.

En la ronda del 28 de septiembre el vuelo se revisó fotograma a fotograma en los últimos 30 s (T+6:28 a T+6:56). El propulsor cae con los motores por delante, se inclina contra su movimiento durante el frenado, hace el desvío hacia la torre (desde el 29 de septiembre, ver arriba), entra vertical entre los brazos y los brazos se cierran sobre él. La velocidad del panel es la del movimiento y la cámara no lo pierde. Sus límites: los empujes están resueltos para cumplir unos hitos escogidos, no medidos; los últimos segundos son una quíntica que encaja posición, velocidad y aceleración, no una integración con el empuje de tres motores; y en la caída la orientación es exactamente contraria a la velocidad, sin el ángulo de ataque con el que las grid fins pilotan un propulsor real. Hacerlo más fiel exigiría datos que no son públicos.

El penacho se calcula a partir de la presión ambiente, no de un guion: corto, estrecho y con tren de diamantes de choque en la plataforma; ancho y acampanado cuando ya no hay aire contra el que empujar.

**Ronda 4: la cuenta atrás, el despegue sin tirones y la retransmisión.**
- **Tirones al despegar, medidos y quitados.** Recorriendo la secuencia instante a instante y contando los programas de sombreado de la GPU, el vuelo compilaba 83 a mitad de secuencia: 27 en el encendido, otros tantos a lo largo del ascenso y del regreso. Cada uno es un parón en una GPU real. Había tres causas: la luz del penacho aparecía con su grupo al encender los motores, y el número de luces forma parte de cada material iluminado; las sombras del sol se apagaban por encima de 1,8 km y se volvían a encender para el aterrizaje, que también cambia cada material; y los efectos ocultos (penachos, chorros, vapor, nubes, la Tierra curva) no pasaban por el precalentado de la carga. Ahora la luz está siempre y a cero con los motores parados, la sombra deja de redibujarse en altura pero no se apaga, y el precalentado dibuja también lo oculto, incluidas las partes de primer nivel que empiezan invisibles. Resultado: **0 programas nuevos de T−40 a la captura** (105 al cargar, 105 al final).
- **El vehículo ya no desaparece en su vapor.** Con los motores a pleno, el vapor que hierve sobre la cubierta salía disparado hacia arriba a 11 m/s y formaba una vaina gris alrededor de la pila que la tapaba de T+0 a T+6. Ahora sale casi horizontal por el borde de la cubierta, como hace. Además, la nube y el vapor del deluge se dibujaban **después** del penacho y, como ninguno escribe profundidad, las bocanadas situadas detrás de la columna la tapaban. Ahora se dibujan antes, y la llama brilla a través del vapor de su base.
- **Cuenta atrás desde T−40**, con los hitos del vuelo 7 (Wikipedia, *Starship flight test 7*): «el director de vuelo verifica GO para el lanzamiento» en T−00:00:30, **activación del desviador de llama** en T−00:00:10 (el agua y la neblina salen por las dos bocas de la zanja desde ese instante) e **ignición de Super Heavy** en T−00:00:03.
- **Planos de retransmisión con cortes secos,** en lugar de una cámara que volaba entre posiciones (a T+6 cruzaba 130 m en 1,6 s y parecía un fallo):
  1. un plano general a 800 m, bajo sobre el llano;
  2. la pila cargada a la altura de la torre, con la escarcha y el venteo, en perpendicular a la línea torre-vehículo para que la torre quede al lado y no detrás;
  3. la mesa, con el agua del desviador, el brazo de desconexión apartándose y los primeros motores encendiéndose bajo el faldón;
  4. el despegue desde el suelo a 350 m, con la torre y la pila enteras en cuadro y el vapor saliendo por las dos bocas de la zanja a través de la imagen.
- **Vibración del suelo** en ese último plano. Llega con el sonido, a 343 m/s desde los motores, así que empieza un segundo después de la luz, y se atenúa con la distancia y con la altura. Es determinista (saltar a un instante da el mismo encuadre) y se desactiva si el sistema pide reducir el movimiento.
- **Separación en caliente visible:** la nave enciende sus seis motores sobre el propulsor y el escape sale por las 24 aberturas de la sección ventilada, hacia abajo y hacia fuera por las lamas, durante el segundo o dos antes de que las etapas se separen.
- **Hitos derivados del modelo, marcados como tales:**
  - paso de la torre (T+9,2);
  - supersónico (T+52, cuando la velocidad supera la del sonido local según el perfil de temperatura de la atmósfera estándar de 1976);
  - apogeo del propulsor (T+4:00, ≈ 83 km).
- **Propulsor transónico cinco segundos antes del encendido de aterrizaje.** El cruce que se ve (≈T+6:25) es del modelo y el panel lo marca con ≈; lo citado es el intervalo del vuelo 7 (transónico en T+6:26, encendido en T+6:31), no su hora. Es una condición del ajuste: el coeficiente de arrastre efectivo se resuelve junto con los dos encendidos para cumplirla (sale ≈ 1,7, que engloba las rejillas y el ángulo de ataque). Antes se tomaba Cd ≈ 0,9 como dato y el propulsor seguía a Mach 2,3, a 5 km de altura, cuando encendía; cruzaba Mach 1 siete segundos después, al revés que en todos los vuelos.
- **Sonido opcional**, sintetizado y no grabado. Cada etapa es una fuente situada en el espacio (panorámica HRTF: suena de donde está el vehículo) y se oye con el empuje, la posición y la altitud que tenía hace d/343 s. Está hecho de un retumbo muy grave (ruido browniano bajo 70 Hz), un rugido de banda media y el **crepitar** característico de los motores grandes. El crepitar sale como en la realidad, de las ondas de choque del chorro que llegan como saltos de presión bruscos y asimétricos: un tren de choques en N a ráfagas, sobre un poco de ruido deformado, no chasquidos sobre un siseo. El rugido fluctúa con la turbulencia y, cerca del suelo, el rebote en el llano produce el barrido de fase del despegue. El aire se come primero los agudos con la distancia, así que un lanzamiento lejano es solo retumbo, y el aire fino de la altura apaga la nave. El conjunto pasa por una reverberación de campo abierto de 3,6 s y un compresor para que el encendido no sature. Por fases: en la cuenta atrás, el siseo del venteo criogénico junto a la plataforma y, desde T−17, el agua del desviador de llama; el encendido simultáneo de los 33 motores del Block 3 sube el rugido de golpe; un chasquido en la separación en caliente; y los **estampidos sónicos** del propulsor al volver, como triple onda en N (morro, grid fins, faldón). Esos estampidos se oyen en Starbase en cada captura. Se emiten cuando el propulsor del modelo baja por última vez de Mach 1,2 y llegan con el retardo de la distancia. Los niveles de cada banda se ajustaron de oído con vídeos de lanzamientos y capturas. No es un espectro medido, y el momento de los estampidos es el del modelo, no el de un vuelo concreto. No suena nada hasta pulsar el botón.

### Verificación automática

`src/data/verify.js` hace dos pasadas independientes, disponibles con `?verify` en la URL o llamando a `window.__vc.verify()`:

**0. Procedencia** — todas las cifras que se comprueban están una sola vez en `src/data/figures.js`, cada una con su **grado**, su fuente y, por tanto, su tolerancia:

| Grado | Qué es | Tolerancia del modelo |
|---|---|---|
| **A** | primaria publicada: spacex.com, las guías de usuario de Falcon, el manual de servicio de Tesla | ±0,5 % |
| **B** | primaria medida: fotogrametría sobre una foto primaria contra una cota conocida | ±2 % |
| **C** | secundaria: enciclopedia o prensa especializada | ±1 % |
| **D** | reconstruida: no hay cifra; se elige para cuadrar con las fotos y se muestra con ≈ | ±3 % |

La tolerancia no es la incertidumbre de la cifra, sino cuánto puede apartarse el modelo del número que afirma. Una cifra publicada se exige al máximo porque la interfaz la presenta como un hecho. Una reconstrucción se exige menos, para que la prueba no la haga pasar por medida. Los recuentos (motores, Draco, pinzas) son exactos sea cual sea su grado.

De ese módulo salen las expectativas de `verify.js` y la altura y la huella de cada ficha. `tools/provenance-check.mjs`, sin navegador y el primero de `npm run check`, falla en tres casos:
- si una fila de la ficha enlazada a una cifra (`fig`/`pad` en `specs.js`) dice otro número;
- si su fuente no casa con el grado: una cifra publicada mostrada con ≈ o citada a Wikipedia, o una reconstrucción sin ≈;
- si la tabla de vehículos del principio de este README no enuncia la cifra que le corresponde.

Nueve controles negativos (una altura cambiada en el README, una fila con otra cifra, una cifra publicada marcada ≈, una fuente inexistente…) tienen que fallar, y fallan.

Al montarlo afloraron tres desajustes, ya corregidos:
- **Starship: 1 m de más en la medida.** La verificación medía 125,05 m porque la caja incluía los efectos del lanzamiento (penachos y vapor) que cuelgan del vehículo, y aun así pasaba por la tolerancia global del 2 %. Ahora los efectos están marcados y no se miden, y la altura sale 124,054 m.
- **Raptor Vacuum: 2,317 m frente a 2,3 m.** Los aros de refuerzo sobresalen 1 cm del borde de salida. El diámetro publicado es el de salida, así que ahora se mide sobre la tobera.
- **Zanja del Pad 2:** la ficha decía 8,2 m de profundidad y el modelo tiene 4,2 m desde que se rehízo la plataforma. Ahora la ficha dice 4,2 m, y la anchura de la zanja y el lado de la mesa también se miden.

**1. Dimensional** — mide la caja envolvente real de cada modelo construido, en su propio sistema de referencia, y la compara con lo declarado con la tolerancia de su grado (extracto):

```
vehicle       measure                 declared   grade   built     err%
starship      altura                  124.05     A       124.054   0.00
falcon9       altura                  70         A       70        0
falconheavy   envergadura / diámetro  12.2       A       12.2      0
dragon        altura                  8.1        A       8.1       0
starlink      envergadura             30         C       30        0
roadster      anchura con espejos     1.851      A       1.851     0
roadster      anchura de carrocería   1.75       D       1.749    -0.04
engines       diámetro de salida RVac 2.3        A       2.3       0
```

**2. Complejo de lanzamiento** — `verifyPad()` mide la geometría construida del pad contra las cifras declaradas (altura de torre, longitud de brazo, cotas de cubierta y explanada, profundidad y anchura de la zanja, lado de la mesa, número de pinzas) y marca cada fila con su grado: *prensa* (C) o *reconstruido* (D). Detectó la losa de la cubierta extruida hacia arriba desde su cota, que había enterrado los 2,4 m inferiores del vehículo dentro de ella.

**2b. Interfaces** — `verifyInterfaces()` mide **dónde dos subsistemas construidos por separado tienen que encajar**, que es donde han vivido los errores caros de este proyecto: cada cifra era defendible por su cuenta y estaba mal contra su vecina. Las campanas de los motores tienen que pasar por el agujero de la mesa (la garganta se cortaba 43 cm dentro de veinte de ellas), las pinzas tienen que llegar al faldón (cerraban a 6 cm de él, y su pie entraba 8 cm por dentro), el propulsor tiene que apoyarse en la cubierta, y los brazos de la torre tienen que cerrarse **a la altura de los pines** (lo hacían 6,8 m por debajo, alrededor del tanque de metano). Todo se mide sobre la geometría construida, nunca recalculando la constante que la produjo.

**3. Integridad de la escena** — recorre todas las mallas y detecta los modos de fallo que realmente han ocurrido en este proyecto: material que muestrea una textura sobre una geometría **sin atributo `uv`** (Three.js deriva las tangentes de las derivadas de `vUv`, así que un `vUv` constante las degenera y la superficie sale negra o reventada), UVs que existen pero son **constantes** (`mergeAll` fabrica un atributo a ceros para que `mergeGeometries` no reviente, que es el mismo fallo disfrazado), UVs **a la escala equivocada**, geometría sin normales, vértices no finitos y **transformadas no finitas**.

La escala de UVs merece su propia nota. El proyecto tiene dos convenciones: UVs en metros contra mapas que fijan `repeat = 1/tileSize`, y UVs normalizadas contra mapas que envuelven una sola vez. Mezclarlas es invisible en el código y ruinoso en pantalla. `toTexture` guarda el tamaño de teselado para el que se creó cada mapa, así que la comprobación no pregunta *¿varían estas UVs?* sino *¿varían al ritmo que esta textura espera?*. Fue lo que dejó cinco kilómetros de explanada con una sola repetición de una textura de 48 m — un téxel cada veinte metros, y el suelo gris liso en todas las vistas generales.

Todas están auto-testeadas: romper cada cosa a propósito hace saltar su comprobación con un diagnóstico útil, y repararla la devuelve a cero.

### Puerta de validación en CI

`npm run check` ejecuta primero **ESLint** (`eslint.config.js`: nombres sin definir, variables e importaciones sin usar, comparaciones sueltas…; al introducirlo había 28 avisos, todos importaciones o variables sin usar, y se han quitado), después la prueba de procedencia y las regresiones deterministas de nube, trayectoria y hardware, después levanta el sitio en Chromium headless, recorre las 46 vistas autoradas y termina con cinco tamaños responsive a DPR 2. Comprueba que la cámara es finita, la geometría conserva sus interfaces, el HUD no se solapa, el diálogo modal bloquea los atajos del fondo y la consola queda limpia. La escena principal se carga con `?quality=high` y **se comprueba**: el rasterizador por software sobre el que corre CI caería en el nivel más barato, y la puerta estaría midiendo una escena reducida sin enterarse, porque una escena reducida es coherente consigo misma. Los checks sin navegador requieren Node 22.15 o posterior para cargar Three.js vendorizado sin alterar los imports de producción.

**En paralelo en CI.** El flujo de GitHub Actions ya no ejecuta la batería entera en un runner (unos 13–15 minutos): la reparte en cuatro trabajos simultáneos —estático (lint, procedencia, nube y trayectoria, hardware), escena (`check:scene`), interfaz (`check:ux`) y nivel de detalle (`check:lod`)— y el despliegue espera a los cuatro. En local, `npm run check` sigue ejecutando todo.

**Comprobación por niveles (desde el 3 de octubre de 2026).** El check completo tarda ≈25–30 min en local (la escena se dibuja por software). Para no pagarlo en cada commit:
- antes de cada commit se ejecuta `npm run check:static` (≈2–3 min: lint, procedencia y las pruebas de física de todos los vehículos);
- el `npm run check` completo, una vez al cerrar cada bloque de trabajo;
- CI, que ya lo ejecuta en cada push y no despliega si falla, cubre lo demás.

También comprueba las **combinaciones**, que es donde han estado los errores: del lanzamiento al vuelo libre, de la vista orbital al lanzamiento y de vuelta, sol bajo + vuelo completo + reset devolviendo la misma atmósfera, redimensionar en mitad de una transición, veinte cambios de vista seguidos dejando un estado coherente, y el detalle retirándose con la distancia y volviendo al acercarse. Y las invariantes de la máquina de estados directamente: que una vista inexistente cae en la primera del expositor, que la vista orbital se *deduce* en vez de fijarse, y que el dueño de la cámara pasa limpiamente de visita a lanzamiento a visitante.

El último paso es `tools/lod-pop.mjs`, que mide el **salto visible al cambiar de nivel de detalle**. Desde la distancia exacta del umbral de cada intercambio (el escudo de la Starship y la carrocería del Roadster), renderiza los dos estados con la misma cámara y falla en tres casos:
- si la superficie se aclara u oscurece de golpe (Δ medio con signo mayor de 6/255);
- si cambia la silueta;
- si la escena registra un intercambio que la prueba no tiene encuadrado.

Un control negativo, el mosaico lejano un 33 % más claro, tiene que fallar, y falla.

**Plazos en el runner.** En el runner compartido, un fotograma de la escena completa por software puede tardar varios segundos, y Playwright espera dos fotogramas estables antes de pulsar un botón. El primer clic en el dock móvil, justo después de pasar de 1920×1080 a 390×844, tardó 29,6 s en una ejecución que pasó y agotó el plazo de 30 s en la siguiente, sin que cambiara nada de la interfaz. La prueba de interfaz da ahora a clics y esperas los mismos 120 s que ya daba a las capturas. Lo que mide es la maquetación; el tiempo de fotograma lo mide el perfilado.

Cierra con un **presupuesto de escena** que informa en vez de bloquear: triángulos construidos y dibujados, mallas, materiales y texturas. Sus techos están muy por encima de las cifras de hoy, así que detecta que algo se ha duplicado — algo construido dentro de un bucle — sin tumbar una compilación por ruido entre máquinas.

También **recorre la secuencia de lanzamiento**. `launch.seek(t)` reproduce el estado completo de un instante de misión — nube de tierra incluida, resimulada desde la ignición a paso fijo — en vez de limitarse a avanzar, y eso es lo que la hace comprobable: el gate visita diecisiete hitos exigiendo transformadas finitas y cámara sobre la explanada, comprueba que el perfil de ascenso nunca retrocede (hasta la separación: después el panel sigue al propulsor, que baja a propósito), comprueba que **el propulsor sube, vuelve al eje de la torre y los brazos se cierran sobre él** —con los pines apoyados en el carril y ningún vértice de los brazos a menos de 4,45 m del eje, es decir, junto al casco y sin atravesarlo—, y comprueba que guardar la secuencia deja la escena **exactamente** como estaba (vehículo, brazo de desconexión, las veinte pinzas, los brazos de captura, planos de cámara y niebla). Sale con código distinto de cero si algo falla, y el flujo de GitHub Actions **bloquea el despliegue** con ella.

## Capturas

| | |
|---|---|
| ![33 Raptor](docs/screenshots/starship-engines.jpg) | ![Escudo térmico](docs/screenshots/starship-tiles.jpg) |
| ![Morro y aletas delanteras](docs/screenshots/starship-nose.jpg) | ![Costado a sotavento](docs/screenshots/starship-leeward.jpg) |
| ![Grid fins y hot-staging](docs/screenshots/starship-gridfins.jpg) | ![Interetapa del Falcon 9](docs/screenshots/falcon9-interstage.jpg) |
| ![Falcon Heavy](docs/screenshots/falconheavy.jpg) | ![Crew Dragon](docs/screenshots/dragon.jpg) |
| ![Interfaces delanteras del Falcon Heavy](docs/screenshots/falconheavy-interfaces.jpg) | ![Interfaces traseras del Falcon Heavy](docs/screenshots/falconheavy-aft.jpg) |
| ![Falcon 1](docs/screenshots/falcon1-overview.jpg) | ![Segunda etapa del Falcon 1 en corte educativo](docs/screenshots/falcon1-cutaway.jpg) |
| ![Merlin 1C del Falcon 1](docs/screenshots/falcon1-merlin1c.jpg) | ![Vista general](docs/screenshots/overview.jpg) |
| ![Escudo PICA desde el trunk](docs/screenshots/dragon-trunk-inside.jpg) | ![Bus del Starlink V2 Mini](docs/screenshots/starlink-bus.jpg) |
| ![Complejo de lanzamiento](docs/screenshots/launch-site.jpg) | ![Zanja de llamas](docs/screenshots/launch-trench.jpg) |
| ![Conexiones separadas de metano y oxígeno](docs/screenshots/pad-booster-qd.jpg) | ![Cofia bicónica del Falcon 1](docs/screenshots/falcon1-fairing.jpg) |
| ![Pila cargada desde sotavento, con escarcha](docs/screenshots/launch-fuelled.jpg) | ![Encendido de aterrizaje con humo](docs/screenshots/launch-landing.jpg) |
| ![Ignición](docs/screenshots/launch-ignition.jpg) | ![Ascenso](docs/screenshots/launch-ascent.jpg) |
| ![Separación en caliente](docs/screenshots/launch-staging.jpg) | ![Boostback del propulsor](docs/screenshots/launch-boostback.jpg) |
| ![La torre atrapa el propulsor](docs/screenshots/launch-catch.jpg) | ![Propulsor en los brazos](docs/screenshots/launch-caught.jpg) |
| ![Falcon 9](docs/screenshots/falcon9.jpg) | ![Tesla Roadster](docs/screenshots/roadster-overview.jpg) |
| ![Trasera del Roadster](docs/screenshots/roadster-rear.jpg) | ![Starman](docs/screenshots/roadster-starman.jpg) |
| ![Cámara del selfie](docs/screenshots/roadster-selfie.jpg) | ![Pantalla «Don't Panic»](docs/screenshots/roadster-dontpanic.jpg) |
| ![Faros y morro](docs/screenshots/roadster-detail.jpg) | ![Tierra al fondo](docs/screenshots/roadster-earth.jpg) |
| ![Rueda y paso](docs/screenshots/roadster-underbody.jpg) | ![Fila de motores](docs/screenshots/engines-row.jpg) |
| ![Raptor Vacuum](docs/screenshots/engines-rvac.jpg) | ![Starship completo](docs/screenshots/starship-full.jpg) |
| ![Raptor 3](docs/screenshots/engines-raptor.jpg) | ![Merlin 1D](docs/screenshots/engines-merlin.jpg) |
| ![Corte de motores de la nave](docs/screenshots/launch-ship-cutoff.jpg) | ![Reentrada, cámara a bordo](docs/screenshots/reentry-onboard.jpg) |
| ![Plasma de la reentrada](docs/screenshots/reentry-plasma.jpg) | ![Caída panza abajo](docs/screenshots/reentry-bellyflop.jpg) |
| ![Volteo y encendido de aterrizaje](docs/screenshots/reentry-flip.jpg) | ![Amerizaje en el Pacífico](docs/screenshots/reentry-splash.jpg) |
| ![F-16A en la cabecera de la pista 28](docs/screenshots/f16.jpg) | ![Cabina del F-16](docs/screenshots/f16-cockpit.jpg) |
| ![Pista 10/28](docs/screenshots/f16-runway.jpg) | ![Cola y tobera del F-16](docs/screenshots/f16-tail.jpg) |
| ![El F-16 despega manteniendo W](docs/screenshots/f16-takeoff.jpg) | ![El F-16 en vuelo, virando](docs/screenshots/f16-flight.jpg) |
| ![HUD del F-16 desde la cabina](docs/screenshots/f16-hud.jpg) | ![Porsche 911 GT3 RS en su explanada](docs/screenshots/gt3rs.jpg) |
| ![Frontal del GT3 RS](docs/screenshots/gt3rs-front.jpg) | ![Zaga y ala del GT3 RS](docs/screenshots/gt3rs-rear.jpg) |
| ![Perfil del GT3 RS](docs/screenshots/gt3rs-side.jpg) | ![Rueda y freno delanteros](docs/screenshots/gt3rs-wheel.jpg) |
| ![El circuito](docs/screenshots/gt3rs-circuit.jpg) | ![Derrape con el freno de mano](docs/screenshots/gt3rs-drift.jpg) |
| ![Desde el asiento del conductor](docs/screenshots/gt3rs-cockpit.jpg) | ![Vista general](docs/screenshots/overview.jpg) |

Regenerables con `npm run shots`, que recorre los encuadres declarados en `tools/docs-shots.json`, `tools/launch-shots.json` y `tools/roadster-shots.json`, siempre con el sol a 18° y en calidad alta forzada. Las del HUD en escritorio, tableta y móvil (`docs/hud`) salen de `node tools/shot.mjs docs/hud tools/hud-shots.json` (vehículos, ficha, escena limpia y misión en cada tamaño; desde el 28 de septiembre la web es solo para ordenador, así que las de tableta y móvil documentan cómo se ve en un tamaño no admitido, con paneles que se solapan), y las de la revisión con el sol bajo (`docs/review-sun18`) de `node tools/shot.mjs docs/review-sun18 tools/sun18-shots.json --sun 18`. Un encuadre puede llevar `play`: pilota el F-16 o conduce el Porsche con las teclas del visitante antes de la foto (así salen el despegue, el vuelo, el HUD, el derrape y la vista del conductor). **Regeneradas todas el 2 de octubre de 2026**, con la aprobación del usuario, tras la revisión vehículo a vehículo: corresponden al estado actual.

## Estructura

```
index.html                 entrada (import map de Three.js)
vendor/three/              Three.js r170 (build + addons usados)
src/main.js                escena, distribución de los vehículos, oclusión de etiquetas, bucle
src/core/viewState.js      qué está mostrando el centro: dueño de la cámara, expositor, vista,
                           vuelo y mobiliario, como una máquina de estados con transiciones
src/core/lod.js            detalle en función del tamaño en pantalla, para todo el centro
src/core/quality.js        nivel de calidad del dispositivo (píxeles, sombras, post, partículas)
src/core/environment.js    cielo físico, sol, sombras dinámicas, mapa de entorno PMREM, suelo, playa y mar
src/core/terrain.js        relieve (lomas y microrrelieve), cobertura, costa y lagunas: una sola
                           función que comparten el suelo, su color y la hierba
src/core/circuitPlan.js    trazado del circuito del Porsche y su explanada, sin Three.js: lo leen el
                           terreno, las mallas y los neumáticos
src/core/circuit.js        asfalto, arcenes, pianos, grava, líneas y parrilla del circuito, y la explanada
src/core/f16Ground.js      el suelo que toca el F-16: pista, terreno, playa, mar y curvatura terrestre
src/core/ao.js             oclusión ambiental GTAO (nivel alto) con radio ligado a la distancia
src/core/backdrop.js       fondo orbital (Tierra ilustrativa + estrellas) de la vista del Roadster
src/core/cameraRig.js      órbita + vuelo libre + transiciones + límite polar sobre el suelo
src/geometry/utils.js      lathe con normales analíticas, ojivas romas, losetas instanciadas,
                           superficies aerodinámicas lofteadas
src/materials/textures.js  texturas procedurales (Canvas 2D → color / rugosidad / normales)
src/materials/library.js   materiales PBR, compartidos para no duplicar mapas
src/vehicles/*.js          constructores de cada vehículo y motores instanciados
src/vehicles/pad.js        complejo de lanzamiento (Pad 2 de Starbase) a escala
src/sim/launch.js          secuencia de lanzamiento: perfil integrado, planos y hardware
src/sim/plume.js           penacho gobernado por la presión ambiente y nube de tierra
src/sim/sound.js           sonido opcional del lanzamiento, retardado a la velocidad del sonido
src/data/gt3rs.js          Porsche 911 GT3 RS (992): cada cifra con su fuente y su etiqueta
src/data/figures.js        cifras comprobadas, una sola vez, con grado (A/B/C/D), fuente y tolerancia
src/data/specs.js          ficha técnica con procedencia de cada dato
src/data/verify.js         comprobación de coherencia entre lo declarado y lo construido
src/sim/missionClock.js    reloj de misión independiente de los fotogramas
src/sim/mission.js         Flight 14 como una sola misión: corte, órbita, salida de órbita, entrada
src/sim/gt3Damage.js       daños del Porsche en un choque: abolladuras, piezas que se sueltan, chispas
src/sim/gt3Camera.js       cámaras de la conducción del Porsche y vibración de la carretera, independientes de los fps
src/sim/f16Flcs.js         leyes de control de vuelo del F-16 (FLCS), en su propio módulo
src/data/h2r.js            ficha de la Kawasaki Ninja H2R con la procedencia de cada cifra
src/vehicles/h2r.js        punto de entrada del modelo de la H2R (lo construye vehicles/h2r/)
src/vehicles/h2r/          la H2R pieza a pieza: index.js (montaje), geometry.js, photo.js (calibración de la foto),
                           materials.js, wheels.js, brakes.js, steer.js (horquilla, tijas, manillar), swingarm.js,
                           trellis.js (chasis), engine.js, intake.js, exhaust.js, details.js, dash.js
src/vehicles/h2r/bodywork/ carrocería: tank.js, seat.js, fairing.js (cúpula, panel, morro, alas, pantalla), decals.js, surfaces.js
src/sim/h2rBike.js         dinámica de la moto: contramanillar, neumáticos, suspensión, embrague, caídas
src/sim/h2rRide.js         modo de pilotaje: postura, cámaras, marcas, el piloto al caer
src/sim/h2rSound.js        sonido del cuatro en línea por pulsos de escape (AudioWorklet) y su compresor
src/ui/h2rHud.js           instrumentos de la moto: vueltas, marcha, inclinación, ayudas
src/ui/hud.js              interfaz
src/ui/telemetryList.js    lecturas de conducción y vuelo como texto, para lectores de pantalla
src/core/water.js          dónde hay agua (mar, charcas, canales) y a qué profundidad
src/core/colliders.js      todo lo sólido de la escena, en celdas de 0,25 m, para los choques
src/core/effects.js        lo que salta en un choque: chispas, fuego, humo, restos, cristal, agua
eslint.config.js           análisis estático (primer paso de npm run check)
docs/historial.md          rondas anteriores, rotuladas como históricas
```

## Presupuesto de rendimiento

**Coste de esta ronda (escudo y nube), en calidad baja.** Se comparó `tools/profile.mjs --quality low` en el commit anterior a la ronda (`23b5d4a`) y en el actual, con el mismo renderizador por software. Los tiempos absolutos de SwiftShader no dicen nada sobre una GPU real; la comparación entre versiones sí.
- La escena no cambia: los mismos 1,96 M triángulos, 1017 mallas, 144 materiales, 77 texturas y 155,5 MB de texturas. El arranque pasa de 24,6 a 24,8 s.
- El **primer plano del escudo** cuesta un 48 % más por fotograma (de 1,09 a 1,62 s): las 13 361 losetas ahora se dibujan de verdad. Antes el respaldo las tapaba y la GPU descartaba casi todos sus fragmentos. Es el coste de que se vean. A distancia no cambia, porque ahí se dibuja el mosaico lejano.
- El **despegue** cuesta un 6 % más (nube con polvo y variantes).
- Las vistas del pad y del complejo cuestan un 3–8 % más en mediciones repetidas. Una primera medición daba +20 % en el pad, pero al repetirla resultó ser ruido.
- El resto de vistas queda dentro del ruido (±2 %).

No se ha medido en una GPU ni en un móvil real, porque desde este entorno no hay acceso a ese hardware.

Medido con `npm run profile`, que informa del reparto del arranque, triángulos, draw calls, materiales, texturas y tiempo de fotograma en la vista general, en un primer plano y durante el lanzamiento. `node tools/cpu-profile.mjs` baja un nivel: graba un perfil de CPU de V8 durante el arranque y reparte el tiempo propio por función y por archivo. Ahí se vio que el coste no estaba en los triángulos.

**Antes y después** (`cad7219` frente a esta revisión). Mismas condiciones: Chromium sin GPU (SwiftShader), 1280 × 800, `profile.mjs --frames 6 --only overview,starship-tps-near,roadster-detail,launch-maxq,launch-catch`, las dos versiones seguidas en la misma máquina. **SwiftShader rasteriza en la CPU**: sus milisegundos por fotograma sirven para comparar las dos versiones entre sí, no como FPS de una GPU.

| | alta | media | baja |
|---|---|---|---|
| Arranque (s) | 47,4 → 32,9 | 45,3 → 39,1 | 46,0 → 27,7 |
| Construcción del Roadster (s) | 8,8 → 2,5 | 8,4 → 2,4 | 8,4 → 2,6 |
| Vista general: ms/fotograma · draw calls | 11 681 → 6 828 · 1 115 → 1 146 | 9 503 → 5 015 · 1 653 → 1 097 | 4 691 → 1 388 · 1 635 → 1 068 |
| Roadster de cerca: ms · draw calls | 15 200 → 8 703 · 816 → 826 | 12 511 → 6 442 · 1 355 → 844 | 8 152 → 3 129 · 1 321 → 805 |
| Escudo térmico de cerca: triángulos por fotograma | 1,05 M → 0,76 M | 1,06 M → 0,76 M | 0,70 M → 0,70 M |

Qué lo explica, de mayor a menor:
- **Paso de transmisión.** El parabrisas, un reflector y el disco de cuarzo del Roadster usaban `transmission`. Three vuelve a dibujar todos los objetos opacos de la escena en un objetivo con mipmaps en cada fotograma en que haya uno en pantalla. El Roadster sale en la vista general, así que la escena entera se pintaba dos veces en casi cualquier plano. Por eso las calidades media y baja hacían *más* draw calls que la alta. Ahora son vidrio translúcido con barniz y reflejos, como ya lo eran los faros.
- **Construcción del Roadster.** Unos 920 rayos contra la cola y el paso de rueda trasero probaban todos los triángulos. Todos son paralelos a *z*, así que ahora se resuelven con una rejilla de triángulos por su caja en *x/y* y una prueba exacta en el plano. El resultado es idéntico: misma suma de control de los 632 266 vértices. Además, la pertenencia de cada vértice de la rejilla de la cola se calcula una vez en vez de cinco.
- **Hierba.** Los 7 000 penachos del llano y la hierba de la duna eran dos `InstancedMesh` del tamaño del terreno. Nunca se descartaban por el tronco de visión y se dibujaban siempre, incluida la que queda detrás de la cámara. Ahora van en trozos de 110–150 m, cada uno descartable y registrado en el LOD por el tamaño de un penacho. La valla de la explanada tenía `lodFeature` y nadie lo registraba: ahora sí.
- **Texturas.** `heightToNormal` lee las alturas una vez en un array y resuelve el envolvente por fila, sin un cierre con dos módulos y un `Math.hypot` por muestra. El Falcon 9 y el Falcon Heavy comparten el sombreado del cuerpo (solo cambia el rótulo). El asfalto calcula su árido una vez para los tres mapas. Los materiales bajan de ~6,0 a ~5,5 s en este entorno. Los que más pesan siguen siendo el asfalto (0,8 s), el hormigón, el acero ×4 y las losetas (0,3–0,5 s cada uno).
- **Sombreadores.** Se precompilan con `compileAsync`, que en controladores con `KHR_parallel_shader_compile` los enlaza en paralelo. SwiftShader no tiene esa extensión, así que aquí no se nota. En una GPU real puede acortar el arranque, pero no está medido.

Los triángulos *construidos* suben algo (1 999 360 → 2 050 432 según la puerta de CI, sobre todo la Tierra curva de la secuencia, 77 000, que solo se dibuja en vuelo). Los *dibujados* en la vista general bajan (1 322 812 → 1 232 986 en la puerta, que mide después de recorrer el resto de estados). **Carrocería lejana del Roadster.** Se dibujaba completa (162 000 triángulos) aunque en la vista general midiese unos píxeles. Ahora, a partir de unos 54 m (umbral de 3,5 px sobre 0,18 m en calidad alta), la sustituye la misma superficie maestra muestreada con una rejilla gruesa: los mismos tres paneles, la cabina abierta y unos 3 000 triángulos. No se inventa nada de la silueta. Comparando el mismo fotograma con cada estado forzado, a 45 m cambian 470 píxeles de 1,28 millones (sobre todo los huecos de los faros, que quedan cerrados), y a 80 m, 185. Con ella, la puerta de CI pasa de 1 232 986 a 1 081 441 triángulos dibujados en la vista general (−12 %).

**Rendimiento percibido** (`tools/perceived.mjs`). Mide el tiempo hasta el primer fotograma y hasta poder interactuar, las tareas largas (más de 50 ms) del hilo principal durante el arranque, la memoria JS y los cambios de expositor. En SwiftShader y calidad alta, la versión anterior bloqueaba el hilo **10,4 s seguidos** en una sola tarea: el primer render, donde se suben a la GPU todas las texturas y buffers y se compilan los programas de sombra, todo a la vez. Durante ese tiempo la barra de progreso no podía redibujarse. Precompilar con `compileAsync` no lo evitaba, porque esa compilación solo tardaba 1,2 s. Ahora la escena se «calienta» por partes (cada expositor, el pad, el suelo), dibujando la escena real en un objetivo de 1 × 1 con solo esa parte visible y un fotograma entre partes. Además, la generación de texturas cede un fotograma tras cada textura. La tarea más larga baja a **5,6 s**, y lo que queda es el primer fotograma completo, que en SwiftShader cuesta eso por sí solo. El tiempo hasta poder interactuar **no mejora** en este entorno: varía entre 33 y 44 s de una ejecución a otra, porque cada fotograma de software cuesta segundos. Los tiempos de cambio de expositor están dominados por esos fotogramas y no dicen nada útil aquí. **Nada de esto se ha medido en una GPU ni en un móvil real**: no hay acceso a ese hardware desde este entorno.

Las losetas usan un prisma hexagonal de 28 triángulos sin cara trasera (nunca visible, siempre apoyada en el casco) y un chaflán superior que da el brillo del borde.

### Nivel de detalle

`src/core/lod.js` hace una sola pregunta por entrada — *¿cuántos píxeles ocupa ahora mismo el detalle más pequeño que esto dibuja?* — y con la respuesta cambia entre estados que los constructores ya produjeron, o deja de dibujar lo que nadie puede ver. **No simplifica mallas ni construye modelos alternativos**, así que las vistas cercanas quedan exactamente igual.

Cada entrada declara `lodFeature`: el tamaño real, en metros, de la pieza más pequeña que contiene. Así el mismo umbral significa lo mismo en una loseta de 0,26 m, en el marco de una ventana de la Dragon y en la junta de 2 cm de su panel trasero.

Hay dos umbrales. **Sustituir** una cosa por otra (las losetas por la carcasa del escudo) se hace a 3,5 px en calidad alta, porque hacerlo antes no se nota. **Ocultar** usa el 30 % de ese umbral, unos 1 px. Lo que se registra es la dimensión más fina, como una junta de 2 cm o un larguero de 3 cm de varios metros de largo, y una línea de un píxel se sigue viendo como línea. Con un único umbral, cada vehículo perdía costuras, marcos, bisagras y herrajes en su propia vista general: el Starlink ocultaba 17 de 18 grupos a 35 m y el Falcon 9 los 10. En el Starlink, además, cada pieza se registra ahora por el tamaño que el ojo resuelve (un terminal láser de 0,4 m, no los 4,5 cm de sus brazos). Tras el cambio oculta 1 de 18 (la cinta de 2,5 cm) en su vista general, que también se acerca de 35 a 25 m. Sus células solares se oscurecen hacia el negro azulado de las fotos.

- **Escudo térmico.** Trece mil hexágonos de 0,26 m se vuelven ruido sub-píxel a unas decenas de metros. Pasados ~90 m las instancias se sustituyen por una superficie de revolución con el mismo mosaico horneado, cubriendo la misma ventana angular: de cerca se ve la geometría real; de lejos, un panel limpio — y 373 000 triángulos menos.
- **Interior del Roadster y Starman.** 86 mallas sobre un coche de 3,9 m que en la vista general mide ocho píxeles. Los asientos cosidos, el Hot Wheels del salpicadero y la placa de circuito dejan de dibujarse; la carrocería, las ruedas y el cristal no, porque son la silueta.
- **Filigrana de la Dragon.** Juntas de panel, marcos, bisagras y tornillería, separadas en dos lotes porque un marco de ventana de 26 cm se lee mucho más lejos que un tornillo de 1,4 cm.

Medido en `25ecf59`, en la vista general, contra la misma escena con todo forzado a su estado detallado: **533 mallas y 877 935 triángulos, frente a 828 y 1 394 203**. Son 182 grupos, y todos se retiran en la vista general.

### Estabilidad de la imagen

La cámara usaba un plano cercano fijo de 0,15 m con el lejano a 9 km. La resolución del búfer de profundidad cae con el cuadrado de la distancia, así que en la vista general, a 400 m, solo distinguía superficies separadas más de ~0,6 m: losas, marcas viales, blindaje de la zanja y la línea de agua parpadeaban contra lo que tienen debajo al mover la cámara. Ahora el plano cercano sigue a la distancia de órbita (el 0,6 % de ella, entre 0,1 y 2 m), unas trece veces más precisión en la vista general sin perder nada de cerca. La secuencia de lanzamiento fija sus propios planos y, al terminar, devuelve los que tenía la cámara cuando empezó.

Las sombras tenían un problema parecido: el volumen de sombra del sol seguía al objetivo de forma continua y cambiaba de tamaño con cada paso de la rueda, así que cada téxel del mapa de sombras caía cada fotograma en un sitio ligeramente distinto y todos los bordes de sombra de la escena titilaban al mover la cámara. Ahora el tamaño cambia en escalones de ×1,2 —unas pocas veces en todo el recorrido del zoom— y el centro se ajusta a la rejilla de téxeles en el propio marco de la luz, de modo que un téxel cubre siempre el mismo trozo de suelo. El volumen mínimo baja de 36 a 12 m de lado, así que en los primeros planos cada téxel mide 3 mm en lugar de 9.

Un tercer fallo tenía la misma familia de causa: una pieza metálica fina y curva —un anillo de soldadura, una barandilla, un tubo— siempre tiene algún píxel que refleja el sol directamente hacia la cámara, y en HDR ese píxel puede valer cientos de veces el blanco. El bloom lo esparcía por su cadena de mipmaps como un cuadrado blanco flotando junto al vehículo (se veía al lado de Super Heavy durante el boostback y el aterrizaje). Antes del bloom, un pase limita ahora el pico de cada píxel a 12, muy por encima de donde ACES ya satura a blanco: la imagen final no cambia y el bloom deja de convertir píxeles sueltos en bloques.

### Niveles de calidad

`src/core/quality.js` elige uno de tres niveles al arrancar, a partir de lo que la máquina declara —no de su *user-agent*— y fija con él la densidad de píxeles, la resolución del mapa de sombras, la oclusión ambiental, el bloom, el MSAA, el umbral de detalle y el número de partículas de la nube. **El nivel cambia el coste, nunca la corrección**: los vehículos se siguen construyendo a 1:1 desde las mismas cifras y la verificación mide lo mismo. `?quality=low|medium|high` fuerza uno, que es como se prueba un nivel que no tienes — y cómo la puerta de CI se asegura de estar midiendo la escena completa, ya que el rasterizador por software sobre el que corre caería si no en el nivel más bajo.

## Despliegue

El flujo de GitHub Actions en `.github/workflows/pages.yml` publica el sitio en GitHub Pages.
