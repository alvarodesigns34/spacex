# SpaceX Vehicle Center

Experiencia 3D interactiva, a escala real (1 unidad = 1 metro), con recreaciones técnicas de nueve expositores: ocho de SpaceX y el X-15, el avión cohete hipersónico de la NASA y la USAF:

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
| X-15 | North American X-15 #1, USAF 56-6670, sobre su tren (patines y rueda de morro) como tras un vuelo: aleta ventral soltada, *ball nose* | 14,986 m de largo · 6,815 m de envergadura · 3,505 m de alto en configuración de aterrizaje |

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
- **1–9** selecciona expositor (Starship primero, luego del Falcon 1 al Engine Row y el X-15), **0** vista general, **L** etiquetas, **R** regla de altura, **T** pliega la ficha, **H** o **?** (o el botón *Guide*) abre la **guía rápida**: tres primeros pasos numerados y una tarjeta por cada forma de moverse (mirar, pasear, volar, lanzamiento) más expositores y pantalla, con la tarjeta del modo en uso marcada como *You are here*. La tercera línea de la primera visita lo recuerda.
- **P** (o el botón *Tour*) recorre el centro parada por parada; cualquier arrastre, rueda o clic lo termina y devuelve la cámara. Cada parada lleva un **texto breve con su fuente**: una cifra o un hecho de lo que hay en pantalla, con el enlace a la fuente de la ficha. `tools/provenance-check.mjs` comprueba que toda cifra con unidad de esos textos está en la ficha del expositor, que una cifra estimada o reconstruida lleva ≈ o la salvedad, y que la fuente existe, con tres controles negativos.
- **Primera visita:** tres líneas arriba en el centro explican cómo moverse, cómo llegar a los expositores y cómo lanzar. Desaparecen con la primera interacción (arrastrar, rueda, tecla o cualquier pulsación fuera de ellas) o a los 20 s, y no vuelven a salir (se guarda en `localStorage`; en una ventana privada se muestran una vez por visita). Por debajo de 1100 px de ancho no hay un hueco que no toque la ficha o las herramientas, así que no se muestran.
- **Encuadre en la parte libre de la pantalla:** en escritorio, la lista de vehículos ocupa los primeros ~256 px, y una vista centrada en toda la ventana dejaba su cuarto izquierdo debajo de ella (en la vista general, el Falcon 1 y el Falcon 9 quedaban enteros bajo la lista). Ahora el centro de proyección se desplaza hacia la zona libre con `setViewOffset`, sin mover la cámara, así que la selección con el ratón, las etiquetas y la profundidad siguen cuadrando. En el modo de escena limpia y en la vista orbital no hay desplazamiento.
- **G** (o el botón *Starship · Launch*) arranca la secuencia de Starship. Durante la cuenta atrás y el ascenso la cámara sigue un plan de planos, pero **arrastrar o girar la rueda devuelve el control al instante** sin detener la secuencia, y **la cámara sigue montada en el cohete**: el centro de la órbita se mueve con el vehículo y la cámara con él, así que se puede girar alrededor, pausar, reanudar o saltar a otro instante sin perderlo. Antes, al tomar el control la cámara se quedaba quieta donde la había dejado el plan de planos y el cohete salía de cuadro en segundos, con pausa o sin ella. El botón **Camera** (o **C**) elige entre los **planos de realización** y **tu órbita montada en el propulsor** o **en la nave** (tras la separación van cada uno por su lado); el cielo, los planos de recorte y las sombras siguen al vehículo en el que vas. El panel de misión lleva reloj, fase y el siguiente hito con su hora; **las dos etapas lado a lado, como en la retransmisión** (Super Heavy y Starship, cada una con su velocidad, su altitud y un **esquema de motores** que enciende un círculo por motor en el orden real: los 33 a la vez en el arranque del propulsor V3, 5 en la separación en caliente, y los 6 de la nave); un rótulo que aparece sobre la imagen al cruzar cada hito; un botón **Sound** (apagado por defecto, se recuerda) un botón **Pause** (o **K**, o la barra espaciadora fuera del vuelo libre) que congela el reloj de misión dejando la cámara libre para rodear la escena parada, un selector de velocidad **×¼** (cámara lenta) / ×1 / ×2 / ×5 / ×10 que multiplica el reloj (no salta hitos; el reloj de misión sigue al tiempo real aunque la imagen vaya a pocos fotogramas, y se detiene con la pestaña oculta) un botón **Restart** que vuelve a T−40 y un botón para terminar. Debajo de las cifras hay un **perfil de vuelo**: la altitud de la nave y la del propulsor en toda la misión, en escala de raíz cuadrada para que los 150 m de la captura y los ≈106 km del apogeo del propulsor quepan en la misma gráfica. Lleva una marca por hito y un cursor en el instante actual. Las curvas se muestrean de la misma trayectoria integrada que mueve los vehículos, así que no pueden contradecirse. El perfil es también la **línea de tiempo**: un clic o un arrastre sobre él salta a ese instante, y **←** / **→** van al hito anterior o siguiente. `seek(t)` es determinista (la nube se vuelve a simular desde la ignición), así que un salto cae en el mismo fotograma que se alcanzaría reproduciendo. En pantallas de menos de 560 px de alto se oculta.
- **X** (o el botón *Reentry*) reproduce la **reentrada de la nave del vuelo 14** y su amerizaje en el Pacífico norte, con los tiempos publicados por SpaceX (ver *Reentrada de Starship*). Usa el mismo panel de misión: reloj en horas (T+09:28:56…), fase, siguiente hito, velocidad y altitud de la nave, esquema de motores (3 → 2 → 1 en el encendido de aterrizaje) y perfil de altitud que sirve de línea de tiempo (sin la columna ni la leyenda del propulsor, y con el botón *Reentry* encendido en lugar de *Launch*). Arranca a ×10, porque son 22 minutos. **C** alterna entre realización, cámara a bordo y persecución. **Arrastrar o girar la rueda toma la cámara** como en el lanzamiento: la órbita queda montada en la nave y la sigue en su caída (el botón dice *riding the ship*), y **C** devuelve la cámara a la realización. **K** pausa, **←**/**→** saltan entre hitos y **X** o *End* terminan; también la terminan **G**, elegir un vehículo o la visita guiada. Si se pulsa X paseando, la cámara vuelve al modo órbita.
- **J** (o el botón *X-15 · Fly*) **pilota el X-15** (ver *X-15 #1: fase 4*). Se elige entre la suelta desde el B-52 (45.000 ft, Mach 0,8, todo el propulsante, 300 km antes de la pista) y una aproximación (9 km de altura, a 30 km). Mandos:
  - `W`/`S` cabeceo y `A`/`D` alabeo (también las flechas), `Q`/`E` timón de dirección;
  - `,`/`.` compensación del estabilizador;
  - `I` enciende y apaga el XLR99, y `R`/`F` mueven el mando de gases del 40 al 100 %;
  - manteniendo la **barra espaciadora**, la palanca mueve los cohetes de control;
  - `B` aerofrenos, `N` flaps, `G` tren (solo se baja una vez, como en el avión) e `Y` amortiguadores;
  - `C` cámara (persecución, cabina, torre o tu propia órbita, que también se toma arrastrando), `K` pausa y `Esc` vuelve al expositor;
  - un mando de juego también sirve.
  
  Mientras se vuela, los paneles del museo se apartan y queda un panel de instrumentos con:
  - horizonte artificial;
  - Mach, KEAS, altitud, velocidad vertical, α y β, factor de carga, q̄ y rumbo;
  - motor y propulsante con el tiempo de combustión que queda;
  - estabilizador y compensación, configuración, y distancia y rumbo a la pista 13.
  
  Al pararse en la pista, o al estrellarse, un resumen da la velocidad vertical de la toma, su velocidad, su posición respecto al umbral y al eje, y el recorrido. Las teclas del museo no actúan mientras se vuela.
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
- **Derivado:** el estado en la interfaz de entrada (120 km). La órbita y la masa no se publican y se suponen (≈): 200 km y ≈190 t. Con 11 s de un Raptor de 250 tf se pierden ≈142 m/s, y vis-viva da **≈7,74 km/s a −1,6°**.
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

### X-15 #1, USAF 56-6670 (fase 1: el modelo exterior, 30 de septiembre de 2026)

El noveno expositor es el **North American X-15 #1** (56-6670), el avión cohete de investigación hipersónica de la NASA y la USAF (tecla **9**). Está en la fila, entre el Falcon Heavy y la Dragon, delante de la plataforma, **de pie sobre su propio tren**: rueda de morro doble y dos patines de acero, con la aleta ventral soltada, como quedaba en el lago seco de Rogers tras un vuelo. No tiene peana. Es la primera de siete fases; en las siguientes podrá **volar**.

Plan por fases:
1. modelo exterior (esta);
2. acabados y detalle;
3. motor de vuelo 6-DOF con pruebas contra datos de vuelo de la NASA;
4. pista de aterrizaje y modo de vuelo;
5. cabina;
6. terreno real ampliado;
7. chorro del XLR99, calentamiento y sonido.

**Publicado y usado tal cual:**
- **NASA TN D-3343, tabla I:** superficies, cuerdas, flechas y límites de mando del ala, los flaps, el estabilizador horizontal, las aletas y los aerofrenos.
- **NASA TM X-236, tabla II:** las ordenadas del **NACA 66-005 modificado**, con una tabla para el ala y otra para el estabilizador. El 5 % de espesor al 45 % de la cuerda, los flancos rectos a partir del 67 % y el **borde de fuga romo del 1 %** salen de la tabla, no de un generador NACA genérico. En el estabilizador, sus puntos del 75 y el 90 % ya están sobre esa recta (1,652 % calculado frente a 1,653 % impreso).
- **NASA TM X-236, figura 2:** un three-view **acotado** del modelo a escala 0,02, en pulgadas; cada cota ×50 es la medida real. De ahí salen las estaciones:
  - borde de ataque del ala en la raíz, 7,000 m desde la punta del morro;
  - raíz expuesta del estabilizador, 12,164 m;
  - aletas, 11,468 m;
  - carenados laterales desde 3,81 m;
  - límite del timón, 1,156 m del eje;
  - puntas de las aletas, 2,108 m y 1,880 m. Suman 3,988 m, exactamente los 13 ft 1 in del manual.
- **NASA SP-60:** la tobera del XLR99, de **39,3 in** (0,998 m), con relación de áreas 9,8.
- **NASA TM X-207:** el tren. Patines de 3 ft × 6 in de acero 4130, neumáticos de morro de 18 × 4,4 in y **39,1 ft** entre la rueda de morro y los patines.
- **Manual de vuelo T.O. 1X-15-1:** **14,986 m** de largo (49 ft 2 in) y **3,505 m** de alto en configuración de aterrizaje (11 ft 6 in).
- La envergadura, **6,815 m** (22,36 ft), es la de TN D-3343. El manual la redondea a 22 ft 4 in.

**Comprobaciones hechas sobre el dibujo:**
- La cuerda media del ala, 2,465 in, da 3,130 m, y su posición en envergadura, 1,043 in (1,325 m), es la que sale de la geometría.
- El estabilizador horizontal solo cierra en su propio plano con anhedral: 45° en el cuarto de cuerda y 50,58° en el borde de ataque exigen una semienvergadura de 2,853 m sobre la superficie. Con 15° de anhedral se proyectan en los 2,755 m publicados, y la flecha del borde de fuga resulta de 19,5° (19,28° en el dibujo).

**Medido (≈ ±1 cm):** el contorno del fuselaje, trazado sobre la figura 2: la quilla, el lomo bajo la cabina, la cabina en alzado y en planta, y los carenados laterales con sus bordes. Superpuesto al dibujo, el modelo coincide casi al trazo en planta y en alzado.

**Reconstruido (≈):**
- **Secciones del fuselaje:** entre esos contornos, el cuerpo es una elipse y los carenados un lóbulo superelíptico, unidos con un acuerdo de 5 cm.
- **Cabina:** un parabrisas en V de dos lunas planas con montante central y un techo redondeado, según las fotos del NASM.
- **Ball nose:** los 49 ft 2 in del manual son 5 cm más que la ojiva del dibujo, y una bola en su punta dejaría el avión 14 cm más corto todavía. El morro del 56-6670 es, en todas sus fotos, un cono recto de metal desnudo desde un anillo remachado a ≈0,9 m. Su longitud es la que da la longitud del manual.
- Los montantes y tirantes del tren, los pivotes de timones y estabilizadores, y las góndolas de punta de ala. El 56-6670 las lleva en el Smithsonian; los dibujos de los años sesenta no.
- **Actitud en tierra, ≈1,4° morro abajo:** en la foto de la NASA EC67-1652 (el 56-6670 en Rogers, 1967), con el neumático de 18 in como regla, la quilla queda a 0,61 m del lecho en la rueda de morro. El esquemático de 1959 de TM X-207 dibuja ese tren ≈0,25 m más bajo.

**Verificación:** `verify.js` mide ahora también la **longitud**. El X-15 da 3,505 m de alto (hasta la punta de la aleta, como el manual), 6,815 m de envergadura (solo las alas, sin las góndolas) y 15,005 m de largo (+0,13 %, por la actitud en tierra). Las superficies móviles (flaps, estabilizadores, timones, aerofrenos) son piezas propias con su bisagra, preparadas para el modelo de vuelo.

**Todavía no:** cabina interior y vuelo (fases 3 a 7).

### X-15 #1: fase 2, acabados y detalle (1 de octubre de 2026)

Referencias: la foto de la NASA **EC67-1652** (el 56-6670 en Rogers, 1967; en alta resolución, con el neumático de 18 in como regla) y las 25 fotos del Smithsonian. Solo se han usado como referencia; ninguna está en el repositorio. Todas las posiciones y tamaños leídos en ellas son aproximados (≈).

**Fuselaje: un atlas propio, no una losa repetida.** Sus coordenadas de textura son (estación, longitud de arco alrededor de la sección), ambas en metros. Así, cada costura, fila de remaches, panel desnudo y rótulo cae donde está en el avión. El atlas lleva:
- **20 cuadernas y 10 largueros** como costuras;
- **remaches**: filas dobles a ≈25 mm en las cuadernas y filas sencillas cada 20° alrededor;
- **un tono y un brillo por chapa**, porque en las fotos las chapas se distinguen por cómo reflejan la luz;
- **chamuscado** marrón y gris azulado bajo la cola;
- **metal desnudo**: los paneles de los cohetes de control del morro y la bahía de cámaras bajo el morro, con sus dos ventanas;
- **grano** de la pintura.

**Materiales.** La pintura negra es un dieléctrico con barniz (*clearcoat*). Rugosidad y metalicidad van en un mismo mapa, de modo que solo el metal desnudo es metal. Las alas, los estabilizadores, las aletas, los aerofrenos, los timones, los flaps y la carlinga comparten una losa métrica de 1,2 m con chapas y filas de remaches. La parte fija de la aleta inferior es de **metal desnudo**: es el muñón que queda al soltar la ventral, como en EC67-1652. Para no pasar del presupuesto de la escena (200 materiales), varias piezas comparten material: la aleta usa el metal desnudo del morro, los patines usan el metal oscuro, y el pozo de la cabina y las toberas de control usan el negro mate de los neumáticos.

**Rótulos, solo texto.** No llevan la insignia de la USAF ni la marca de la NASA, que la regla del centro sobre banderas y logotipos deja fuera. Por eso tampoco está la banda amarilla con el nombre de la agencia en la punta de la aleta.
- **«U.S. AIR FORCE»** grande en ambos costados.
- En el costado izquierdo, como en EC67-1652:
  - **«U.S. AIR FORCE X-15 / A.F. SERIAL NO. 56-6670»** y **«X15-1»**;
  - la **flecha amarilla de rescate**, apuntando adelante;
  - **«RESCUE»** con **«EMERGENCY ENTRANCE / CONTROL ON OTHER SIDE»**.
- **«BEWARE OF BLAST»** junto a los cohetes del morro, en los dos costados.
- El **triángulo rojo «DANGER / EJECTION SEAT»** en el derecho, como en el Smithsonian.
- **«APU EXHAUST»**, **«H₂O₂ JETT»**, **«HYDROGEN PEROXIDE VENT»** y **«FWD JACKING POINT»**.
- **«66670»** en los dos lados de la parte fija de la aleta superior, bajo la junta del timón. Las cifras miden ≈0,32 m y van del 10 al 55 % de la cuerda, según la foto ampliada.

Los rótulos se pintan **a nivel**: conservan su altura sobre la línea de referencia aunque la sección crezca. Cada costado lleva la simetría que hace que el texto se lea bien: de morro a cola en el izquierdo y de cola a morro en el derecho.

**Tren de morro según EC67-1652:**
- cilindro del amortiguador de ≈104 mm con tres ranuras;
- vástago cromado;
- horquilla del eje;
- compás de torsión por delante;
- llantas de cinco radios con su buje;
- compuerta transversal abierta detrás de las ruedas.

**Corrección del marco.** Con X adelante e Y arriba, +Z es el costado **derecho** (X × Y), no el izquierdo como decía la fase 1. Los nombres de las piezas (`x15-wing-r`, `x15-flap-l`…) y la documentación están corregidos. Las piezas eran simétricas, así que la geometría no cambia; los rótulos asimétricos ya caen en su lado.

**Verificación.** `verify()` sigue dando 3,505 m, 6,815 m y 15,005 m, y no encuentra ningún problema de escena: escala de UV, normales ni islas degeneradas. Para que la escala de UV de flaps y puntas sea la de la losa, las tapas planas llevan UV métricas desde su primer punto. El atlas se pinta en ≈1,8 s con el renderizador por software de las pruebas. El grano se superpone como dos patrones de ruido, sin leer y reescribir los 6,7 millones de texels.

**Pendiente de la fase 2, aplazado:** la carlinga que se abre por detrás, que irá con la cabina (fase 5).

### X-15 #1: fase 3, el motor de vuelo (1 de octubre de 2026)

El X-15 ya tiene un **modelo de vuelo de seis grados de libertad** (`src/sim/x15Flight.js`). Funciona sin navegador y está validado contra datos de vuelo de la NASA. Todavía no se puede pilotar en el centro: la pista, los mandos y las cámaras son la fase 4.

**Qué simula:**
- **Tierra esférica sin rotación** con gravedad del inverso del cuadrado. La rotación terrestre se omite (≈): la aceleración de Coriolis a Mach 6 es ≈0,2 % de g.
- **Atmósfera estándar de 1976:** por capas hasta 86 km; por encima, con los valores tabulados de la norma.
- **Aerodinámica medida en vuelo, con el timón inferior quitado,** como el avión expuesto y los últimos vuelos. Cada tabla de `src/data/x15Aero.js` va marcada como PUBLISHED, DIGITIZED, DERIVED o ESTIMATE:
  - fuerza normal de **TN D-2532** (fig. 14);
  - resistencia en vuelo compensado de **TN D-3343** (fig. 9, digitalizada a 300 ppp);
  - estabilidad y control en cabeceo, guiñada y alabeo de TN D-2532 (figs. 15 a 25);
  - compensación de **TM X-714** (fig. 8);
  - amortiguamiento en alabeo derivado de **CR-2144** (tablas V-1 y V-6).
- **El momento de cabeceo** se construye para que el avión se compense donde TM X-714 lo midió. Entre las curvas, el control que resulta concuerda con el medido en TN D-2532: −0,0081 frente a −0,0088 por grado a Mach 3.
- **XLR99 de SP-60:** 57.000 lbf, 13.000 lb de propulsante por minuto, 18.000 lb y mando de gases del 40 al 100 % (hasta la revisión del 1 de octubre decía 50 %, pero SP-60 dice 40).
- **Masa e inercias variables** según el peso (TN D-2532, fig. 3), con el centro de gravedad al 20 % de la cuerda media.
- **Cohetes de control** de morro y alas, con dos sistemas.
- **Amortiguadores (SAS)** convencionales con las ganancias de CR-2144.
- **Contacto con el suelo:** rueda de morro y patines, con amortiguadores y rozamiento.

**Validación** (`npm run check:x15`, dentro del check):
- **Periodo corto:** en siete maniobras de TN D-2532 con el amortiguador de cabeceo apagado, el periodo cae dentro de un 25 % (1,42 s frente a 1,40 s a Mach 3,4; 3,05 frente a 2,90 s a Mach 4,5).
- **Balanceo holandés:** en seis maniobras de la tabla V, dentro de un 20 % (2,52 frente a 2,50 s a Mach 0,82). A Mach 2,3 sale un 15 % más corto.
- **Combustión del XLR99:** 83,1 s frente a los 85 s de SP-60.
- **Perfiles propulsados**, desde la suelta a 45.000 ft y Mach 0,8 con un piloto automático sencillo: de velocidad, Mach 5,7 (el récord del avión básico es 6,04); de altura, 334.000 ft (el récord es 354.200 ft).
- **Aterrizaje:** primero los patines, y la rueda de morro 0,71 s después (TM X-207 midió 0,52 s). En reposo queda a −1,42°, la actitud del expositor (−1,40°).
- **Otras pruebas:** atmósfera dentro del 0,3 %, energía conservada en vacío y aceleración angular de los cohetes igual a par entre inercia.
- **Mutantes:** cinco versiones saboteadas tienen que fallar, y fallan: la compensación extrapolada al revés, sin consumo de propulsante, el amortiguamiento con el signo cambiado, la Tierra plana y Cnβ de túnel en lugar del de vuelo.

**Aproximaciones declaradas (≈):**
- la rigidez de los amortiguadores del tren y el rozamiento de los patines (μ ≈ 0,3), con los que el avión desliza ≈1,7 km;
- los incrementos de flaps y tren;
- la autoridad del SAS;
- el amortiguamiento en guiñada, medido solo con el timón inferior puesto;
- el empuje de 57.000 lbf tomado como empuje en vacío;
- por debajo de Mach 1, la compensación de Mach 1;
- los cohetes de control (datos de la ficha del usuario) y sus brazos;
- sin calentamiento, sin viento, sin dinámica de actuadores y sin el agua oxigenada que alimenta los cohetes.

**Corrección de la fase 1:** la actitud sobre el tren (`groundAttitude`) está ahora en `src/data/x15.js`. La usan el expositor y el tren del modelo de vuelo, así que el avión en reposo y el expositor tienen la misma actitud por construcción.

### X-15 #1: fase 4, la pista y el vuelo (1 de octubre de 2026)

**La pista 13/31** es la única excepción autorizada a «sin objetos nuevos». Es una franja marcada sobre la arcilla desnuda de la llanura salina, al estilo de las pistas del lecho seco de Rogers donde aterrizaba el X-15:
- **Emplazamiento:** al noroeste del recinto. Ocupa la recta libre más larga dentro del disco de suelo (≈2,5 km de radio) que no pisa lomas, charcas, la playa ni el recinto.
- **Dimensiones:** 3,4 km de largo con rumbo verdadero 130,8° y 300 ft (91,4 m) de ancho, el de una pista del lecho seco. Las dos cifras son ≈: la longitud es la que cabe y la anchura no está contrastada con un plano.
- **Terreno:** el suelo se mantiene llano y desnudo en la franja y en un margen de 40 m, sin canales de marea ni matorral (`terrain.js`, `RUNWAY`).
- **Superficie:** arcilla clara con grietas de desecación en dos escalas.
- **Marcas negras:** líneas de borde, barras de umbral y los números «13» y «31» en cada cabecera, todo ≈. Comparten material con la arcilla, oscurecida por color de vértice como el alquitrán sobre ella, para que la escena siga en los 200 materiales de su presupuesto.

**El vuelo** (`src/sim/x15Fly.js`) usa el modelo de la fase 3 en tiempo real:
- **El avión es el del expositor:** el armazón sale de su tren y vuelve a él al terminar, así que el 56-6670 nunca está en dos sitios a la vez.
- **Superficies móviles:**
  - los estabilizadores, juntos para el cabeceo y en diferencial para el alabeo;
  - el timón superior;
  - los flaps y los cuatro aerofrenos, que se abren hacia fuera;
  - el tren, que se ve al bajarlo.
- **Integración:** pasos de 1/200 s en vuelo y de 1/400 s cerca del suelo.
- **Proyección:** la escena es un mapa equidistante azimutal alrededor de la plataforma, la misma proyección del globo con el mapa del Golfo. La actitud se transporta de vuelta por el mismo círculo máximo, así que el avión, el mapa y la pista coinciden al metro estén donde estén. Una prueba lo comprueba: el rumbo de un vuelo radial llega exacto a la plataforma.
- **Suelo:** a más de 40 km de la plataforma se guarda el recinto, porque el disco plano flotaría sobre el horizonte curvo (7 km de caída a 300 km) y el globo es entonces el suelo. Más cerca, el globo queda 1,2 m por debajo y asoma por el borde del disco. Desde la fase 6, el terreno real cubre el resto.
- **Toma de contacto:**
  - los patines y la rueda de morro son los muelles del modelo;
  - por encima de 9 ft/s, el límite de diseño del tren según TM X-207, la toma cuenta como accidente;
  - también es accidente que toque el suelo cualquier otra parte (morro, cola, puntas de ala, muñón de la aleta inferior), por ejemplo al aterrizar sin tren.

**Mandos:**
- La palanca mueve los estabilizadores ±20° alrededor de la compensación en cabeceo y ±15° en diferencial, los límites del piloto según TN D-2532. Los pedales mueven el timón ±7,5°.
- **Lo que es de esta simulación (≈):**
  - la respuesta cúbica de la palanca, para que las entradas pequeñas sean finas;
  - las rampas del teclado;
  - fusionar la palanca de cohetes con la principal mientras se mantiene la barra espaciadora (el avión tenía una palanca aparte a la izquierda);
  - los dos escenarios: el B-52 no aparece, y la aproximación es una posición de partida razonable, no un circuito publicado.

**Pruebas:**
- **`ux-check` lo pilota con teclas reales:**
  - J y el botón de la suelta lo dejan a 45.000 ft y Mach 0,8 con los paneles del museo apartados;
  - I enciende el motor y gasta propulsante, y una tecla de vehículo no saca del vuelo;
  - S tira de la palanca, el estabilizador pasa de la compensación hacia morro arriba y el avión cabecea;
  - C pasa a la cabina y G baja el tren;
  - Esc devuelve el armazón a su tren, y `verify()` sigue dando 3,505 / 6,815 / 15,005 m.
- **`x15-check` añade la proyección:** ida y vuelta al nanómetro, y el transporte del rumbo.

**Lo que no había todavía en esta fase:** la cabina (fase 5), el terreno real fuera del disco (fase 6) y el chorro del XLR99, el calentamiento y el sonido (fase 7).

### X-15 #1: fase 5, la cabina (1 de octubre de 2026)

La cabina se construye siguiendo el manual de vuelo **T.O. 1X-15-1, sección 1** (figura 1-2, el panel de instrumentos, y las figuras de las consolas). El manual está escaneado sin texto: se ha renderizado y leído página a página, solo como consulta, fuera del repositorio.

**La carlinga se abre hacia atrás**, como en la foto EC67 del 56-6670 en tierra:
- la parte que se abre va desde el parabrisas hasta la bisagra en la estación 4,0 m, justo detrás del asiento (≈, leída del perfil);
- detrás queda fijo el carenado hasta la estación 5,0 m;
- en el expositor está abierta 50° (≈, el ángulo de la foto) y en vuelo se cierra;
- por dentro lleva forro, y las lunas siguen siendo transparentes.

**El panel de instrumentos** (`src/materials/x15Panel.js`):
- es el de la figura 1-2: el panel principal abombado con sus dos alas inferiores, y cada instrumento, caja de luces e interruptor en su sitio. Las coordenadas son las de la figura;
- la escala sale de un dato estándar: la caja del altímetro es la de un instrumento de 3⅛ in (≈);
- los instrumentos que funcionan son los del propio manual, alimentados por el modelo de vuelo hasta 30 veces por segundo:
  - velocidad (nudos), altímetro de tres agujas, ángulo de ataque, acelerómetro (g), actitud (bola con cielo blanco y tierra negra), azimut, velocidad vertical;
  - altura y velocidad inerciales, régimen de alabeo, cantidad de propulsante, presión de cámara del XLR99 y reloj;
- las escalas se leen de la figura. Donde la figura no las muestra (el fondo de escala de los inerciales, las unidades del indicador de propulsante), son de esta simulación (≈);
- el resto de relojes (hidráulica, APU, helio, cabina…) están dibujados con la aguja en reposo;
- **este panel no tiene machímetro**, así que en la vista de cabina el panel de la pantalla se reduce a una línea con el Mach, la altitud, la KEAS, α, la carga, el motor y el propulsante.

**El interior** (posiciones y tamaños reconstruidos de las figuras del manual, todos ≈):
- bañera de la cabina, mamparos delantero y trasero, y el reborde del hueco;
- visera antirreflejos y caja del panel;
- consolas laterales;
- **palanca central**, **palanca lateral derecha** (la del piloto en vuelo atmosférico) y **palanca de los cohetes de reacción a la izquierda**;
- palanca de gases del XLR99 y mando de los aerofrenos;
- **asiento eyectable** con sus guías y los dos brazos estabilizadores.

En vuelo, la palanca central y la lateral siguen a la del simulador, y la de los cohetes se mueve con la barra espaciadora.

**La vista de cabina** (C en vuelo) pone el ojo del piloto en la estación 3,25 m, 0,62 m sobre la línea de referencia del fuselaje (≈). Mira 12° hacia abajo, para que se vean el panel y el horizonte a la vez.

**Presupuesto:** la cabina añade dos materiales, la pintura del interior y el lienzo del panel, que es único. El techo de materiales de `check.mjs` pasa de 200 a 240, con la justificación en el código.

### X-15 #1: fase 6, el terreno real (1 de octubre de 2026)

Más allá del disco del recinto, el suelo es ahora **el real**: alturas e imagen de datos públicos, solo suelo. La imagen es una fotografía tendida sobre el relieve; no se modela ninguna planta, edificio ni objeto.

**Fuentes** (descargadas con `tools/terrain-fetch.mjs`, que guarda la caché fuera del repositorio):
- **Alturas:** *Terrain Tiles* de AWS, codificación Terrarium (datos abiertos de Mapzen y la Linux Foundation, que en EE. UU. vienen del 3DEP y el NED del USGS, en otros sitios del SRTM, y mar adentro del ETOPO1). El fondo del mar se lleva a cota 0: la batimetría no es suelo.
- **Imagen:** *EOxCloudless 2016*, el mosaico sin nubes de Sentinel-2 de EOX IT Services GmbH (contiene datos Copernicus Sentinel modificados de 2016), con licencia **CC BY 4.0**. La atribución va en las fuentes del X-15.
- **Lo que se probó y se descartó:** la imagen del USGS (*USGSImageryOnly*, de dominio público) solo cubre Estados Unidos: México, a 3 km al sur de la plataforma, salía en blanco y el mar en negro. Sentinel-2 cubre los dos lados igual. Las capas de EOX de 2018 en adelante tienen licencia no comercial, y por eso se usa la de 2016.

**Dos zonas** de teselas Web Mercator:
- **cerca:** zoom 13, 8 × 8 teselas (≈35 km de lado) alrededor de la plataforma; ≈17 m por píxel y una altura cada ≈275 m;
- **lejos:** zoom 10, 10 × 9 teselas (≈350 × 320 km), desde el Golfo hasta más allá del punto de suelta, 300 km al noroeste; ≈138 m por píxel y una altura cada ≈2,2 km. Deja fuera lo que ya cubre la de cerca y se funde con el globo en su borde exterior.

Cada zona es un atlas JPEG (`src/assets/terrain/`, 2,1 MB entre los dos) y una rejilla de alturas en decímetros (`src/data/terrainTiles.js`).

**Cómo casa con el resto** (`src/core/realTerrain.js`, `src/core/geoMap.js`):
- **Mapa:** cada vértice va con el mismo mapa equidistante azimutal alrededor de la plataforma que usan el vuelo y el globo del lanzamiento. `x15-check` lo comprueba: Brownsville, Port Isabel, Laredo, el punto de suelta y una esquina de la zona lejana caen en la esfera del modelo de vuelo a menos de 1 cm. Un mutante que cambia norte por este tiene que fallar.
- **Curvatura:** se curva hacia abajo alrededor de la cámara como el globo, que es una esfera de radio terrestre con la cima bajo la cámara.
- **Luz y bruma:** usa la luz y la bruma del globo, y cerca del suelo la niebla de la escena, como el disco.
- **El disco:** dentro de su radio no se dibuja, porque allí el suelo es el disco. La costa del disco cae sobre la real.
- **Lo que no casa:** el disco es una reconstrucción (lomas, charcas y matorral verosímiles, no levantados), así que su borde no coincide con la foto. Se nota desde el aire: el disco es un círculo más verde con su propio mar.

**Vuelo y lanzamiento:**
- en el vuelo del X-15 el disco ya no se estira con la altitud, porque taparía el terreno real;
- en el lanzamiento sí sigue estirándose (hasta ≈85 km de diámetro), como antes, y el terreno real solo asoma más allá;
- no se dibuja en órbita ni bajo el Pacífico de la reentrada.

**Presupuesto:** dos texturas y ≈79 000 triángulos. El techo de texturas de `check.mjs` pasa de 120 a 150, con la justificación en el código.

**De paso, una prueba más robusta:** la de `ux-check` que arrastra la cámara en la reentrada pedía que la nave cayera más de 100 m en lo que tardara la medida. En un ejecutor lento de CI midió 1,7 s y la nave cayó justo 100 m, así que falló sin que nada estuviera mal. Ahora pide al menos 25 m/s, un tercio de los ≈58 m/s a los que cae ahí.

### X-15 #1: fase 7, el chorro, el calentamiento y el sonido (1 de octubre de 2026)

**El chorro del XLR99** (`src/sim/x15Plume.js`). El amoníaco anhidro quemado con oxígeno líquido da una llama casi transparente de día: en las fotos de la NASA del X-15 con el motor encendido (solo como referencia, ninguna en el repositorio) se ve un chorro tenue entre salmón y naranja, con una fila de diamantes de choque brillantes a poca altura, y arriba un resplandor ancho y pálido. La forma sale de la dinámica de gases del chorro:
- **Datos publicados de la tobera:** 39,3 in de salida y 57.000 lbf (SP-60), con la relación de áreas de 9,8 de la tobera estándar (NASA, la misma del modelo). SP-60 no dice a qué altura se dan esas 57.000 lbf; aquí, como en el modelo de vuelo, se toman como empuje en el vacío (≈).
- **Lo supuesto:** γ = 1,22 para los productos de la combustión (≈).
- **Presiones derivadas:** de ahí salen una presión de cámara de ≈1,8 MPa (267 psia), por el coeficiente de empuje en el vacío, y una presión de salida de ≈22 kPa (3,2 psia), por la expansión isentrópica (≈).
- **Forma del chorro:** frente a la presión del aire, el chorro se abre (presión de salida mayor que la ambiente) o se estrecha (menor), hasta el Mach y el diámetro de un chorro perfectamente expandido.
- **Celdas de choque:** su separación es L ≈ 1,22·D<sub>j</sub>·√(M<sub>j</sub>² − 1), la estimación clásica de Pack (1950) para un chorro supersónico mal expandido. Cada celda termina en la banda brillante de un disco de Mach.
- **Cifras resultantes:** a nivel del mar el chorro está sobreexpandido y sus celdas miden ≈1,6 m. A 45.000 ft miden ≈4,9 m. A 30 km el chorro ya mide varios metros de ancho y sus celdas decenas de metros. Más arriba se dibuja como un cono ancho y tenue.
- **Lo que es de esta simulación (≈):** los colores, el brillo y la distancia a la que se apagan los diamantes, ajustados a ojo con esas fotos.
- **Solo en vuelo:** el chorro se cuelga del avión al empezar el vuelo y se quita al acabar. Oculto en el expositor, contaba igualmente en su caja: `verify()` medía 15,009 m de largo en vez de 15,005, y la prueba de `ux-check` lo detectó.

**El calentamiento aerodinámico** (`src/sim/x15Heating.js`) sale de lo que se midió en el propio avión: **NASA TM X-1705** (Quinn y Olinger, 1969). Son medidas de 200 termopares en la piel de Inconel X en dos vuelos casi estacionarios: el 2-22 (Mach 5,1, α 2,0°) y el 2-28 (Mach 4,98, α 16,3°).
- **Dónde:** en la línea central inferior del fuselaje (φ = 0, figura 4), la de barlovento y la más caliente, en los cinco termopares medidos en los dos vuelos (tabla V). Cada uno tiene su propia piel, con la capacidad térmica ρcτ que da el informe.
- **Cómo:** con la reducción de datos del propio informe, pero hacia delante (sus ecuaciones 1–5): ρcτ·dT<sub>w</sub>/dt = St·ρV·(H<sub>R</sub> − H<sub>w</sub>) − εσT<sub>w</sub>⁴, con H<sub>R</sub> = H + η·V²/2, el factor de recuperación η = 0,9 y la emisividad ε = 0,76 del informe.
- **El número de Stanton** en cada punto es el medido. Entre los dos vuelos se interpola según el ángulo de ataque, y se mantiene fuera de ellos. Antes, cada vuelo se lleva a un mismo flujo másico con la ley turbulenta de placa plana St ∝ Re<sup>−0,2</sup> (≈).
- **Lo que no se modela:** la conducción a lo largo de la piel y hacia la estructura, y la transición de la capa límite.
- **Comprobación:** `x15-check` rehace los dos puntos del informe con sus propias cifras y exige los calentamientos medidos en los diez casos (cinco termopares, dos vuelos) con un margen del 5 %. Lo cumple dentro del 2,5 %. Un mutante con recuperación total (η = 1) tiene que fallar.
- **En pantalla:** el panel de vuelo da la temperatura de la piel del vientre (el más caliente de los cinco puntos) y su máximo del vuelo, en °F como en los informes; la línea de la cabina también la lleva.
- **Sin resplandor dibujado:** el Inconel X a 900–1.000 K, lo más alto de estos vuelos, brilla tan poco al lado de la piel iluminada por el sol que de día no se vería, así que no se pinta ninguno.

**El sonido** (`src/sim/sound.js`, con el mismo interruptor que el del lanzamiento y un botón *Sound* en el panel de vuelo):
- **Desde fuera:** el XLR99 se coloca en el avión y se apaga con el aire igual que los motores del lanzamiento, con el retumbar, el chasquido de los choques y la absorción de los agudos con la distancia.
- **Desde la cabina:**
  - el motor tal como lo transmite la estructura, un retumbar grave que sigue en el vacío, porque no viaja por el aire;
  - el aire que pasa sobre la carlinga, según la presión dinámica;
  - el silbido de los cohetes de peróxido cuando están en uso.
- **Todo sintetizado** sobre los mismos ruidos base del lanzamiento, con niveles a oído (≈).

**Corrección de paso:** por encima de 20 km el vuelo ponía el plano cercano de la cámara a 2 m, que en la vista de cabina recortaba el panel y la carlinga, a menos de un metro. Ahora la cabina lo mantiene en 5 cm a cualquier altura.

### Revisión de las fases 1–7 del X-15 (1 de octubre de 2026)

Se revisaron el código, los datos y su procedencia, y se renderizaron todas las vistas: las 26 de la galería del museo, las 19 del lanzamiento y la reentrada y siete nuevas del X-15. Las ocho del Roadster se revisaron en la galería regenerada. También vuelos de prueba a 45.000 ft, a 40 y 60 km sobre la ruta y en la aproximación, con cada cámara. Lo que se encontró y se corrigió:
- **Mando de gases del XLR99:** SP-60, la fuente citada, dice que el motor se regula «del 40 al 100 % del empuje», y el modelo usaba un mínimo del 50 %. Ahora es el 40 %.
- **La caja del panel y la visera antirreflejos** eran más anchas que el hueco de la cabina y, con la carlinga abierta, salían por la piel a los lados del hueco. Ahora no pasan de su anchura.
- **El globo y el terreno real se peleaban por la profundidad:**
  - a gran altura, y sobre todo desde la cabina, cuyo plano cercano está a 5 cm, el búfer de profundidad no distingue a 100 km dos superficies separadas 0,3 m (en el vuelo) o 40 m (en el lanzamiento);
  - ahora el globo no se dibuja donde el terreno real está entero (`FlightEarth.setCut`). Solo se solapan en la franja en que el terreno se funde, como debe ser.
- **Las etiquetas del pad aparecían sobre el Pacífico** durante la reentrada, en cuanto algo llamaba a `launch.reset` con el lanzamiento parado: su gancho de visibilidad decía «el vehículo está en su soporte» aunque la reentrada siguiera. Ahora los tres ganchos (lanzamiento, reentrada y X-15) miran si alguna de las tres secuencias sigue en marcha. `ux-check` lo comprueba.
- **Nombre de la fuente:** el chorro del XLR99 atribuía a SP-60 el «empuje en el vacío». SP-60 da 57.000 lbf sin decir a qué altura; ahora consta que tomarlo como empuje en el vacío es decisión del modelo (≈).

**Añadido para la galería:**
- el encuadre *Open canopy and cockpit* del X-15;
- el campo `x15` de `tools/shot.mjs`, que hace volar el avión antes de la foto;
- el manifiesto `tools/x15-shots.json`: expositor, carlinga abierta, cola, chorro, cabina, persecución y aproximación sobre el terreno real.

**Revisado y sin cambios:**
- **Sonido:** se activó en un vuelo con Chromium sin pantalla; el contexto de audio corre y no hay errores.
- **Fotograma de transición:** un rectángulo oscuro que salió al teletransportar el avión a 60 km era la cámara de persecución alcanzándolo. Un fotograma después desaparece, y en un vuelo normal no ocurre.

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

Regenerables con `npm run shots`, que recorre los encuadres declarados en `tools/docs-shots.json`, `tools/launch-shots.json` y `tools/roadster-shots.json`, siempre con el sol a 18° y en calidad alta forzada. Las del HUD en escritorio, tableta y móvil (`docs/hud`) salen de `node tools/shot.mjs docs/hud tools/hud-shots.json`. La última regeneración fue en `b1f09d3`, al final de la revisión corriendo la simulación (septiembre de 2026). **Están desfasadas en el HUD:** después cambiaron los paneles (88 % de opacidad, grises más claros, telemetría ≥ 11 px, horas del modelo con ≈), la etiqueta de la torre («≈144.5 m»), los botones con `aria-pressed` y, en la ronda del 28 de septiembre, la fila de transporte del panel de misión (pausa, ×¼, reinicio), el botón *Walk* y la nave tras la separación. Además, desde esa ronda las capturas del lanzamiento posteriores a T+2:40 muestran una trayectoria de la nave distinta. **Desde el 29 y el 30 de septiembre de 2026 tampoco coinciden:**
- la vista general, el complejo, la zanja y todas las del lanzamiento: la costa al este, la torre girada −37,5°, el deluge y la granja de propelentes nuevos, el fuego y la cronología del vuelo 14;
- `engines-row`, `engines-rvac` y `starship-engines`: toberas y motores rehechos;
- `dragon`: la banda de aluminio y el panel solar continuo;
- las del HUD: botones *Reentry* y *Guide*, reloj en horas y fila de transporte;
- las de `docs/review-sun18`.

Faltan ocho capturas ya declaradas en los guiones: `engines-raptor`, `engines-merlin`, `launch-ship-cutoff` y las cinco `reentry-*`. La regeneración espera la aprobación del usuario. La anterior fue en c2bec28, tras la ronda vehículo por vehículo.

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
src/data/figures.js        cifras comprobadas, una sola vez, con grado (A/B/C/D), fuente y tolerancia
src/data/specs.js          ficha técnica con procedencia de cada dato
src/data/verify.js         comprobación de coherencia entre lo declarado y lo construido
src/sim/missionClock.js    reloj de misión independiente de los fotogramas
src/ui/hud.js              interfaz
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
